const supabase = require('../db/supabase');
const labelPrinterService = require('./LabelPrinterService');
const emailService = require('./EmailService');
const trackingEmailService = require('./TrackingEmailService');
const automationEngine = require('./AutomationEngine');
const carrierRouter = require('./carriers/CarrierRouter');
const { classifyDescription, translateDescription } = require('./retino/tracking-status-mapper');
const eddService = require('./EDDService');

class TrackingSyncService {
  constructor() {
    // Rate limit for LP API: 1 request per 2 seconds to avoid overloading
    this.LP_DELAY_MS = 2000;
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async syncAll(carrierFilter = null) {
    console.log(`[TrackingSync] Starting sync...${carrierFilter ? ` (carrier: ${carrierFilter})` : ''}`);

    // Log which carriers have direct API configured
    const configured = carrierRouter.getConfiguredCarriers();
    console.log('[TrackingSync] Direct carrier APIs:', JSON.stringify(configured));

    // Paginate through ALL matching shipments (Supabase default limit is 1000)
    // Skip final statuses — no need to re-check delivered/returned packages
    // Only sync shipments from last 60 days (older ones are likely resolved)
    const SKIP_UNIFIED = ['delivered', 'returned_to_sender'];
    const SYNC_DAYS = 60;
    const dateFrom = new Date(Date.now() - SYNC_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const PAGE_SIZE = 1000;
    let offset = 0;
    let allShipments = [];

    while (true) {
      let query = supabase
        .from('delivery_notes')
        .select('*')
        .not('unified_status', 'in', `(${SKIP_UNIFIED.join(',')})`)
        .not('status', 'eq', 'cancelled')
        .not('tracking_number', 'is', null)
        .gte('date_issued', dateFrom)
        .range(offset, offset + PAGE_SIZE - 1);

      if (carrierFilter) {
        query = query.eq('shipper_code', carrierFilter);
      }

      const { data: batch, error } = await query;

      if (error) {
        console.error('[TrackingSync] Error fetching shipments:', error);
        return;
      }

      if (!batch || batch.length === 0) break;
      allShipments = allShipments.concat(batch);
      if (batch.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    if (allShipments.length === 0) {
      console.log('[TrackingSync] No shipments to sync');
      return;
    }

    // Split shipments: direct API vs LP API fallback
    const directShipments = [];
    const lpShipments = [];

    for (const s of allShipments) {
      if (carrierRouter.getService(s.shipper_code, s.tracking_number)) {
        directShipments.push(s);
      } else {
        lpShipments.push(s);
      }
    }

    console.log(`[TrackingSync] Syncing ${allShipments.length} shipments (direct API: ${directShipments.length}, LP API fallback: ${lpShipments.length})`);

    // Sync direct carrier API shipments (fast, no LP dependency)
    if (directShipments.length > 0) {
      await this.syncDirectCarriers(directShipments);
    }

    // Sync remaining via LP API — with rate limiting (1 req / 2s)
    // Skip LP sync entirely if LP_SYNC_DISABLED env is set
    if (lpShipments.length > 0) {
      if (process.env.LP_SYNC_DISABLED === 'true') {
        console.log(`[TrackingSync] LP API sync DISABLED (LP_SYNC_DISABLED=true), skipping ${lpShipments.length} shipments`);
      } else {
        let lpSynced = 0;
        for (let i = 0; i < lpShipments.length; i++) {
          await this.syncViaLPAPI(lpShipments[i]);
          lpSynced++;
          if ((i + 1) % 50 === 0) {
            console.log(`[TrackingSync/LP] ${i + 1}/${lpShipments.length} processed`);
          }
          // Rate limit — wait between LP API requests
          if (i < lpShipments.length - 1) {
            await this._sleep(this.LP_DELAY_MS);
          }
        }
        console.log(`[TrackingSync/LP] Done. Processed: ${lpSynced}`);
      }
    }

    console.log('[TrackingSync] Sync complete');
  }

  /**
   * Sync shipments via direct carrier APIs (GLS, CP, PPL, DPD, UPS, etc).
   * Groups by carrier for better logging.
   */
  async syncDirectCarriers(shipments) {
    // Group by carrier
    const byCarrier = {};
    for (const s of shipments) {
      const code = s.shipper_code || 'UNKNOWN';
      if (!byCarrier[code]) byCarrier[code] = [];
      byCarrier[code].push(s);
    }

    for (const [carrier, carrierShipments] of Object.entries(byCarrier)) {
      let synced = 0;
      let errors = 0;

      for (const shipment of carrierShipments) {
        try {
          if (!shipment.tracking_number) continue;

          const result = await carrierRouter.getTracking(carrier, shipment.tracking_number);
          if (!result || !result.statuses || result.statuses.length === 0) continue;

          // Find most recent meaningful status by date (skip infoscans etc.)
          const sorted = [...result.statuses].sort((a, b) => {
            const da = a.date ? new Date(a.date).getTime() : 0;
            const db = b.date ? new Date(b.date).getTime() : 0;
            return db - da; // newest first
          });

          // Find first status that maps to something meaningful
          let unifiedStatus = null;
          let lastDescription = sorted[0]?.description || '';
          for (const st of sorted) {
            const mapped = this.mapCarrierStatus(carrier, st);
            if (mapped) {
              unifiedStatus = mapped;
              lastDescription = st.description || lastDescription;
              break;
            }
          }
          if (!unifiedStatus) unifiedStatus = 'in_transit'; // fallback

          // Post-processing: if "delivered" but timeline contains returned_to_sender,
          // it means the parcel was "delivered" back to sender, not to customer.
          // Same for failed_delivery — if parcel was damaged/refused and then "delivered" back.
          if (unifiedStatus === 'delivered') {
            const allMapped = sorted.map(st => this.mapCarrierStatus(carrier, st)).filter(Boolean);
            if (allMapped.includes('returned_to_sender')) {
              unifiedStatus = 'returned_to_sender';
              // Find the return event description
              const returnEvent = sorted.find(st => this.mapCarrierStatus(carrier, st) === 'returned_to_sender');
              if (returnEvent) lastDescription = returnEvent.description || lastDescription;
            }
          }

          // Build tracking data
          const trackingData = {
            source: `${carrier.toLowerCase()}_direct`,
            data: [{
              trackingNumber: shipment.tracking_number,
              shipperCode: carrier,
              trackingItems: result.statuses.map(s => ({
                description: s.description,
                date: s.date,
                location: s.location || s.depotCity || s.postName || null,
                statusCode: s.statusCode,
              })),
            }],
          };

          // Save to tracking_sync_log
          const stateCode = sorted[0]?.statusCode;
          const stateCodeInt = stateCode && !isNaN(Number(stateCode)) ? Number(stateCode) : null;
          const { error: logErr } = await supabase.from('tracking_sync_log').insert({
            delivery_note_id: shipment.id,
            lp_state_code: stateCodeInt,
            lp_state_name: (lastDescription || '').substring(0, 50),
            tracking_data: trackingData,
          });
          if (logErr) console.error(`[TrackingSync] Log insert error ${shipment.doc_number}:`, logErr.message);

          // Update unified_status + timestamps
          if (unifiedStatus !== shipment.unified_status) {
            console.log(`[TrackingSync] ${shipment.doc_number}: ${shipment.unified_status} → ${unifiedStatus} (${lastDescription?.substring(0, 40)})`);
          }
          const updates = {
            unified_status: unifiedStatus,
            last_tracking_update: new Date().toISOString(),
            last_tracking_description: translateDescription(lastDescription),
          };

          // Set timestamp fields on status transitions
          const now = new Date().toISOString();
          if (unifiedStatus === 'available_for_pickup' && !shipment.pickup_at) {
            updates.pickup_at = now;
          }
          if (unifiedStatus === 'delivered' && !shipment.delivered_at) {
            updates.delivered_at = now;
          }

          await supabase
            .from('delivery_notes')
            .update(updates)
            .eq('id', shipment.id);

          // On delivery: calculate timeliness
          if (unifiedStatus === 'delivered' && unifiedStatus !== shipment.unified_status) {
            try {
              await eddService.updateEDDForShipment({ ...shipment, ...updates, unified_status: unifiedStatus });
            } catch (eddErr) {
              console.error(`[TrackingSync] EDD error ${shipment.doc_number}:`, eddErr.message);
            }
          }

          // On status change: send email + run automation rules
          if (unifiedStatus !== shipment.unified_status) {
            try {
              await trackingEmailService.processStatusChange(shipment, unifiedStatus, shipment.unified_status);
            } catch (emailErr) {
              console.error(`[TrackingSync/${carrier}] Email error ${shipment.doc_number}:`, emailErr.message);
            }
            try {
              await automationEngine.processStatusChange(shipment, unifiedStatus, shipment.unified_status);
            } catch (autoErr) {
              console.error(`[TrackingSync/${carrier}] Automation error ${shipment.doc_number}:`, autoErr.message);
            }
          }

          synced++;
        } catch (err) {
          errors++;
          if (!err.message?.includes('Unauthorized') && !err.message?.includes('not configured')) {
            console.error(`[TrackingSync/${carrier}] Error ${shipment.doc_number}:`, err.message);
          }
        }
      }

      console.log(`[TrackingSync/${carrier}] Done. Synced: ${synced}, Errors: ${errors}, Total: ${carrierShipments.length}`);
    }
  }

  /**
   * Map carrier-specific status to unified status.
   * Uses carrier-specific mapping when available, falls back to description classification.
   */
  mapCarrierStatus(carrier, statusEvent) {
    const code = statusEvent.statusCode;
    const desc = (statusEvent.description || '').toLowerCase();

    // GLS — well-defined numeric codes
    if (carrier === 'GLS') {
      return this.mapGLSStatus(code);
    }

    // Česká Pošta — code-based mapping
    if (carrier === 'CP') {
      return this.mapCPStatus(code, desc);
    }

    // FOFR — status text mapping
    if (carrier === 'FOFR' || carrier === 'Fofr') {
      return this.mapFOFRStatus(code, desc);
    }

    // DPD — status code mapping
    if (carrier === 'DPD') {
      return this.mapDPDStatus(code, desc);
    }

    // UPS — status code mapping
    if (carrier === 'UPS') {
      return this.mapUPSStatus(code, desc);
    }

    // Zásilkovna — numeric status codes
    if (carrier === 'Zasilkovna' || carrier === 'ZASILKOVNA') {
      return this.mapZasilkovnaStatus(code, desc);
    }

    // PPL — event code mapping
    if (carrier === 'PPL') {
      return this.mapPPLStatus(code, desc);
    }

    // InTime — description-based (Czech texts)
    if (carrier === 'INTIME' || carrier === 'InTime') {
      return this.mapFromDescription(desc) || 'in_transit';
    }

    // Generic: try to classify from description text
    return this.mapFromDescription(desc) || 'in_transit';
  }

  /**
   * GLS StatusCode mapping.
   */
  /**
   * GLS StatusCode mapping (01-09, 51).
   */
  mapGLSStatus(code) {
    const c = String(code).padStart(2, '0');
    const map = {
      '51': 'label_created',          // Data přijata
      '01': 'handed_to_carrier',      // Převzato do přepravy
      '02': 'in_transit',             // V přepravě (třídění)
      '03': 'in_transit',             // V přepravě (mezidepo)
      '04': 'out_for_delivery',       // Na doručení
      '05': 'delivered',              // Doručeno
      '06': 'returned_to_sender',     // Vráceno odesílateli
      '07': 'available_for_pickup',   // K vyzvednutí v ParcelShopu
      '08': 'failed_delivery',        // Nedoručeno
      '09': 'in_transit',             // Speciální událost
    };
    return map[c] || 'in_transit';
  }

  /**
   * Česká Pošta status mapping.
   * Common codes: 91=delivered, 51/52=in transit, 53=available for pickup
   */
  /**
   * ČP status code mapping (11, 21, 41, 51-53, 72-73, 91, 99).
   */
  mapCPStatus(code, desc) {
    const c = String(code);
    const d = (desc || '').toLowerCase();
    // Code-based first
    const codeMap = {
      '91': 'delivered',              // Doručeno
      '53': 'available_for_pickup',   // Uloženo na poště
      '72': 'returned_to_sender',     // Vráceno odesílateli
      '73': 'returned_to_sender',     // Vrácení
      '99': 'failed_delivery',        // Nedoručitelné
      '11': 'handed_to_carrier',      // Podáno
      '21': 'handed_to_carrier',      // Podáno na poště
      '41': 'in_transit',             // V přepravě
      '51': 'in_transit',             // Přeprava
      '52': 'in_transit',             // V přepravě
    };
    if (codeMap[c]) return codeMap[c];
    // Description fallback (order: negatives first!)
    if (d.includes('nedoručen') || d.includes('nezastiž') || d.includes('not deliver')) return 'failed_delivery';
    if (d.includes('vrácen') || d.includes('return')) return 'returned_to_sender';
    if (d.includes('doručen') || d.includes('delivered')) return 'delivered';
    if (d.includes('uložen') || d.includes('k vyzvednutí')) return 'available_for_pickup';
    if (d.includes('podán') || d.includes('přijat')) return 'handed_to_carrier';
    if (d.includes('doručován') || d.includes('výdejn')) return 'out_for_delivery';
    return 'in_transit';
  }

  /**
   * DPD status mapping.
   */
  /**
   * FOFR status mapping.
   * FOFR statuses: doručená, ve skladu, na cestě, vrácená, pořízená
   */
  mapFOFRStatus(code, desc) {
    const d = String(desc).toLowerCase();
    // IMPORTANT: check negatives BEFORE positives (nedoručen contains doručen)
    if (d.includes('nedoručen')) return 'failed_delivery';
    if (d.includes('vrácen')) return 'returned_to_sender';
    if (d.includes('doručen')) return 'delivered';
    if (d.includes('na cestě') || d.includes('přeprav')) return 'in_transit';
    if (d.includes('ve skladu') || d.includes('sklad')) return 'in_transit';
    if (d.includes('připraven') || d.includes('k vyzvednutí')) return 'available_for_pickup';
    if (d.includes('pořízená') || d.includes('exportovaná')) return 'handed_to_carrier';
    return 'in_transit';
  }

  /**
   * DPD SCANCODE mapping.
   * 01=data received, 02=at depot, 03=out for delivery, 05=picked up from sender,
   * 07=control scan, 10=on way to depot, 13=delivered, 14=not delivered,
   * 15=parcelshop, 17=returned, 18=infoscan (ignore), 20=customs
   */
  /**
   * DPD SCANCODE mapping (01-20).
   */
  mapDPDStatus(code, desc) {
    const c = String(code).trim();
    const scanMap = {
      '01': 'label_created',          // Parcel has finished consolidation
      '02': 'in_transit',             // Parcel is at our depot
      '03': 'out_for_delivery',       // Parcel is with our courier
      '04': 'failed_delivery',        // Could not be delivered, returned to depot
      '05': 'handed_to_carrier',      // Parcel has been picked up at sender
      '06': 'in_transit',             // Parcel was redirected
      '07': 'in_transit',             // Control scan
      '08': 'in_transit',             // Parcel was stored at depot (waiting)
      '09': 'in_transit',             // Parcel was stored at depot (2nd attempt prep)
      '10': 'in_transit',             // On the way to delivery depot
      '11': 'available_for_pickup',   // V parcelshop
      '12': 'returned_to_sender',     // Vráceno
      '13': 'delivered',              // Parcel was successfully delivered
      '14': 'failed_delivery',        // Parcel could not be delivered
      '15': 'available_for_pickup',   // V parcelshop k vyzvednutí
      '16': 'in_transit',             // Celnice
      '17': 'returned_to_sender',     // Vrácení odesílateli
      '19': 'delivered',              // Platba dobírky (= doručeno)
      '20': 'in_transit',             // Proclení
      '23': 'available_for_pickup',   // Parcel is delivered to DPD ParcelShop
    };
    if (scanMap[c]) return scanMap[c];
    // Infoscan (18) — multi-purpose code, must check description
    if (c === '18') {
      const d = (desc || '').toLowerCase();
      // IMPORTANT: negatives/parcelshop BEFORE generic deliver
      if (d.includes('not deliver') || d.includes('nedoruč')) return 'failed_delivery';
      if (d.includes('return') || d.includes('vrác')) return 'returned_to_sender';
      if (d.includes('parcelshop') || d.includes('pickup point')) return 'available_for_pickup';
      if (d.includes('picked up by consignee')) return 'delivered';
      if (d.includes('handed over to driver')) return 'out_for_delivery';
      if (d.includes('deliver') || d.includes('doručen')) return 'delivered';
      return null; // pure infoscan = don't update status
    }
    // Fallback for NULL codes — negatives and parcelshop BEFORE positives
    const d = (desc || '').toLowerCase();
    if (d.includes('not deliver') || d.includes('nedoruč') || d.includes('could not')) return 'failed_delivery';
    if (d.includes('return') || d.includes('vrác') || d.includes('back to sender')) return 'returned_to_sender';
    if (d.includes('parcelshop') || d.includes('pickup point') || d.includes('k vyzvednutí')) return 'available_for_pickup';
    if (d.includes('úspěšně doručili') || d.includes('doručili') || d.includes('delivered') || d.includes('doručen')) return 'delivered';
    if (d.includes('courier') || d.includes('dnes doručuje') || d.includes('doručován')) return 'out_for_delivery';
    return 'in_transit';
  }

  /**
   * UPS status mapping.
   * UPS codes: D=Delivered, I=In Transit, P=Pickup, X=Exception, M=Billing, MV=Voided
   */
  /**
   * UPS status code mapping (P, I, D, X, M, MV, RS, DO, DD, KB, FS).
   */
  mapUPSStatus(code, desc) {
    const c = String(code).toUpperCase();
    const codeMap = {
      'D': 'delivered',               // Delivered
      'DD': 'delivered',              // Delivered Destination
      'DO': 'delivered',              // Delivered Origin
      'KB': 'delivered',              // UPS Access Point delivery
      'FS': 'handed_to_carrier',      // First Scan
      'P': 'handed_to_carrier',       // Pickup
      'OR': 'handed_to_carrier',      // Origin scan (dorazil do zařízení)
      'MP': 'label_created',          // Manifest pickup (štítek vytvořen)
      'I': 'in_transit',             // In Transit
      'AR': 'in_transit',            // Arrival scan (dorazil do zařízení)
      'DP': 'in_transit',            // Departure scan (opustil zařízení)
      'OT': 'in_transit',            // Out for today
      'SR': 'in_transit',            // Special routing
      'X': 'failed_delivery',        // Exception
      'RS': 'returned_to_sender',    // Return to Sender
      'MV': 'returned_to_sender',    // Manifest Voided
      'M': 'in_transit',             // Billing info
    };
    if (codeMap[c]) return codeMap[c];
    // Fallback to description — IMPORTANT: negatives BEFORE positives
    const d = (desc || '').toLowerCase();
    if (d.includes('not deliver') || d.includes('nedoručen') || d.includes('exception')) return 'failed_delivery';
    if (d.includes('return') || d.includes('vrácen') || d.includes('back to sender')) return 'returned_to_sender';
    if (d.includes('delivered') || d.includes('doručen')) return 'delivered';
    if (d.includes('pickup') || d.includes('access point')) return 'available_for_pickup';
    return 'in_transit';
  }

  /**
   * Zásilkovna status mapping.
   * Codes: 1=received data, 2=arrived, 3=prepared, 4=departed, 5=ready for pickup,
   * 6=forwarded to other carrier, 7=delivered, 8=returned, 10=cancelled
   */
  mapZasilkovnaStatus(code, desc) {
    const c = String(code);
    const map = {
      '1': 'label_created',          // received data
      '2': 'in_transit',             // arrived
      '3': 'in_transit',             // prepared for departure
      '4': 'in_transit',             // departed
      '5': 'available_for_pickup',   // ready for pickup
      '6': 'handed_to_carrier',      // forwarded to another carrier
      '7': 'delivered',              // delivered
      '8': 'returned_to_sender',     // returned
      '9': 'failed_delivery',        // undeliverable
      '10': 'returned_to_sender',    // cancelled
    };
    return map[c] || this.mapFromDescription(desc) || 'in_transit';
  }

  /**
   * PPL status mapping.
   * Uses event code/group from trackAndTrace.events[]
   */
  mapPPLStatus(code, desc) {
    const c = String(code || '').toLowerCase();
    // PPL CPL API event codes (e.g. "Delivered", "ShipmentInTransport.TakeOverFromSender")
    // IMPORTANT: negatives BEFORE positives, parcelshop BEFORE delivered
    if (c.includes('notdelivered') || c.includes('undeliverable') || c.includes('undelivered')) return 'failed_delivery';
    if (c.includes('backshipment') || c.includes('backtosender') || (c.includes('return') && !c.includes('returnch'))) return 'returned_to_sender';
    // Delivered.Parcelshop = delivered to pickup point, NOT to customer
    if (c.includes('delivered') && c.includes('parcelshop')) return 'available_for_pickup';
    if (c.startsWith('delivered') || c.includes('deliveryfinished')) return 'delivered';
    if (c.includes('delivering') || c === 'delivery') return 'out_for_delivery';
    if (c.includes('waitingforshipment') || c === 'dataaccepted') return 'handed_to_carrier';
    if (c.includes('loadingfordelivery') || c.includes('outfordelivery') || c.includes('readyfordelivery')) return 'out_for_delivery';
    if (c.includes('accesspoint') || c.includes('parcelshop') || c.includes('storedforpickup')) return 'available_for_pickup';
    if (c.includes('takeover') || c.includes('pickedup') || c.includes('accepted') || c.includes('handedoverto')) return 'handed_to_carrier';
    if (c.includes('shipmentintransport') || c.includes('intransit') || c.includes('preparingfordelivery') || c.includes('transit') || c.includes('otherdepot') || c.includes('inputdepot') || c.includes('deliverydepot')) return 'in_transit';
    // Fallback to description — negatives BEFORE positives
    const d = (desc || '').toLowerCase();
    if (d.includes('nedoručen') || d.includes('not deliver')) return 'failed_delivery';
    if (d.includes('vrácen') || d.includes('return') || d.includes('zpět') || d.includes('back to sender')) return 'returned_to_sender';
    if (d.includes('pick-up point') || d.includes('výdejní místo') || d.includes('parcelshop')) return 'available_for_pickup';
    if (d.includes('delivered') || d.includes('doručen')) return 'delivered';
    if (d.includes('being delivered today') || d.includes('doručován') || d.includes('se dnes doručuje') || d.includes('dnes doručuje')) return 'out_for_delivery';
    return this.mapFromDescription(desc) || 'in_transit';
  }

  /**
   * Generic description-based status classification.
   */
  mapFromDescription(desc) {
    if (!desc) return null;
    const d = desc.toLowerCase();
    // IMPORTANT: Check negatives BEFORE positives! "nedoručeno" contains "doručen"
    // Failed delivery
    if (d.includes('nedoručen') || d.includes('nebyla doručen') || d.includes('not deliver') || d.includes('nezastiž') || d.includes('undeliverable') || d.includes('neúspěšný pokus') || d.includes('nicht zugestellt')) return 'failed_delivery';
    // Returned
    if (d.includes('vrácen') || d.includes('return') || d.includes('zpět') || d.includes('back to sender') || d.includes('zurück')) return 'returned_to_sender';
    // Delivered (after failed/returned checks)
    if (d.includes('doručen') || d.includes('delivered') || d.includes('zugestellt') || d.includes('the parcel is delivered')) return 'delivered';
    // Available for pickup
    if (d.includes('k vyzvednutí') || d.includes('pickup') || d.includes('uložen') || d.includes('výdejn') || d.includes('parcelshop') || d.includes('pobočk')) return 'available_for_pickup';
    // Out for delivery
    if (d.includes('doručován') || d.includes('out for') || d.includes('v doručení') || d.includes('on the way') || d.includes('na cestě k příjemci') || d.includes('with our courier') || d.includes('se dnes doručuje') || d.includes('dnes doručuje')) return 'out_for_delivery';
    // Handed to carrier
    if (d.includes('přijat') || d.includes('podán') || d.includes('picked up') || d.includes('převzat') || d.includes('předán')) return 'handed_to_carrier';
    // In transit
    if (d.includes('in transit') || d.includes('přeprav') || d.includes('na cestě') || d.includes('transport') || d.includes('sorting') || d.includes('třídění') || d.includes('depo') || d.includes('scan')) return 'in_transit';
    return null;
  }

  /**
   * Sync single shipment via LP API (for carriers without direct integration).
   */
  async syncViaLPAPI(shipment) {
    try {
      const tracking = await labelPrinterService.getTracking(shipment.lp_shipment_id);

      // Insert into tracking_sync_log
      await supabase.from('tracking_sync_log').insert({
        delivery_note_id: shipment.id,
        lp_state_code: tracking.stateCode || null,
        lp_state_name: tracking.stateName || null,
        tracking_data: tracking,
      });

      // Update status based on tracking state
      const stateCode = tracking.stateCode;
      let newStatus = null;

      if (stateCode === 5 || stateCode === 6) {
        newStatus = 'delivered';
      }
      if (stateCode === 7 || stateCode === 8) {
        newStatus = 'returned';
      }

      if (newStatus && newStatus !== shipment.status) {
        await supabase
          .from('delivery_notes')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', shipment.id);

        console.log(`[TrackingSync] Updated ${shipment.doc_number} to ${newStatus}`);
      }

      // Check for packages shipped > 3 working days without delivery
      if (shipment.status === 'shipped' && shipment.label_generated_at) {
        const shippedDate = new Date(shipment.label_generated_at);
        const workingDaysSince = this.countWorkingDays(shippedDate, new Date());

        if (workingDaysSince > 3 && stateCode !== 5 && stateCode !== 6) {
          if (!shipment.problem_email_sent) {
            try {
              await emailService.sendProblemEmail(shipment);
              await supabase
                .from('delivery_notes')
                .update({ problem_email_sent: true })
                .eq('id', shipment.id);
              console.log(`[TrackingSync] Problem email sent for ${shipment.doc_number}`);
            } catch (emailErr) {
              console.error(`[TrackingSync] Failed to send problem email for ${shipment.doc_number}:`, emailErr.message);
            }
          }
        }
      }
    } catch (err) {
      console.error(`[TrackingSync] Error syncing ${shipment.doc_number}:`, err.message);
    }
  }

  countWorkingDays(startDate, endDate) {
    let count = 0;
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    while (current < end) {
      current.setDate(current.getDate() + 1);
      const day = current.getDay();
      if (day !== 0 && day !== 6) {
        count++;
      }
    }
    return count;
  }
}

module.exports = new TrackingSyncService();
