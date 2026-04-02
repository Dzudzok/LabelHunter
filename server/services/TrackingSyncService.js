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
    // Track unmapped events per sync run (carrier -> Set of "code|description")
    this.unmappedEvents = new Map();
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async syncAll(carrierFilter = null) {
    console.log(`[TrackingSync] Starting sync...${carrierFilter ? ` (carrier: ${carrierFilter})` : ''}`);

    // Log which carriers have direct API configured
    const configured = carrierRouter.getConfiguredCarriers();
    console.log('[TrackingSync] Direct carrier APIs:', JSON.stringify(configured));

    // Paginate through ALL matching shipments (Supabase default limit is 1000)
    // Skip only truly final statuses — delivered is final, but returned_to_sender
    // may later change to delivered (e.g. redelivery, new address)
    // Only sync shipments from last 60 days (older ones are likely resolved)
    const SKIP_UNIFIED = ['delivered'];
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

          // Post-processing: if newest status is "delivered" but the PREVIOUS meaningful
          // status was "returned_to_sender", the "delivered" means delivered BACK to sender.
          // However, if returned_to_sender is older and there are transit events after it
          // leading to delivered, it means redelivery — keep as delivered.
          if (unifiedStatus === 'delivered') {
            // Find the second meaningful status (the one before delivered)
            let secondStatus = null;
            let foundFirst = false;
            for (const st of sorted) {
              const mapped = this.mapCarrierStatus(carrier, st);
              if (!mapped) continue;
              if (!foundFirst) { foundFirst = true; continue; } // skip first (delivered)
              secondStatus = mapped;
              break;
            }
            // Only override if the event right before delivered is returned_to_sender
            // This catches: returned → "delivered" (back to sender)
            // But NOT: returned → in_transit → out_for_delivery → delivered (redelivery)
            if (secondStatus === 'returned_to_sender') {
              unifiedStatus = 'returned_to_sender';
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

    // Clean stale label_created — if no carrier update after 3 days, label was never shipped
    try {
      const staleDays = 3;
      const staleCutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000).toISOString();
      const { data: stale, error: staleErr } = await supabase
        .from('delivery_notes')
        .update({ unified_status: null, last_tracking_update: null, last_tracking_description: null })
        .eq('unified_status', 'label_created')
        .lt('date_issued', staleCutoff)
        .not('tracking_number', 'is', null)
        .select('id');
      if (!staleErr && stale && stale.length > 0) {
        console.log(`[TrackingSync] Cleaned ${stale.length} stale label_created shipments (older than ${staleDays} days)`);
      }
    } catch (e) {
      console.error('[TrackingSync] Error cleaning stale labels:', e.message);
    }

    // Log unmapped events summary
    const unmapped = this.getUnmappedSummary(true);
    if (Object.keys(unmapped).length > 0) {
      console.log('[TrackingSync] ⚠ Unmapped events (fell to in_transit fallback):');
      for (const [carrier, items] of Object.entries(unmapped)) {
        for (const item of items.slice(0, 10)) {
          console.log(`  ${carrier} | code:${item.code} | "${item.description}" (x${item.count})`);
        }
      }
      // Save to DB for dashboard access
      try {
        await supabase.from('tracking_unmapped_log').upsert({
          id: 1,
          data: unmapped,
          updated_at: new Date().toISOString(),
        });
      } catch (e) {
        // Table may not exist yet — just log
      }
    }
  }

  /**
   * Map carrier-specific status to unified status.
   * Uses carrier-specific mapping when available, falls back to description classification.
   * Tracks unmapped/fallback events for diagnostics.
   */
  mapCarrierStatus(carrier, statusEvent) {
    const code = statusEvent.statusCode;
    const desc = (statusEvent.description || '').toLowerCase();
    let result;

    // GLS — well-defined numeric codes, but some events come without code
    if (carrier === 'GLS') {
      result = this.mapGLSStatus(code, desc);
    } else if (carrier === 'CP') {
      result = this.mapCPStatus(code, desc);
    } else if (carrier === 'FOFR' || carrier === 'Fofr') {
      result = this.mapFOFRStatus(code, desc);
    } else if (carrier === 'DPD') {
      result = this.mapDPDStatus(code, desc);
    } else if (carrier === 'UPS') {
      result = this.mapUPSStatus(code, desc);
    } else if (carrier === 'Zasilkovna' || carrier === 'ZASILKOVNA') {
      result = this.mapZasilkovnaStatus(code, desc);
    } else if (carrier === 'PPL') {
      result = this.mapPPLStatus(code, desc);
    } else if (carrier === 'INTIME' || carrier === 'InTime') {
      result = this.mapFromDescription(desc) || 'in_transit';
    } else {
      result = this.mapFromDescription(desc) || 'in_transit';
    }

    // Track unmapped events (result is in_transit but not from a known code)
    this._trackUnmapped(carrier, code, statusEvent.description, result);

    return result;
  }

  // Codes that are EXPLICITLY mapped to in_transit (not fallback) — don't log these
  static KNOWN_TRANSIT_CODES = new Set([
    // GLS
    'GLS:02', 'GLS:03', 'GLS:09', 'GLS:10', 'GLS:22', 'GLS:26',
    'GLS:2', 'GLS:3', 'GLS:9',
    // DPD
    'DPD:02', 'DPD:06', 'DPD:07', 'DPD:08', 'DPD:10', 'DPD:16', 'DPD:20',
    // UPS
    'UPS:I', 'UPS:AR', 'UPS:DP', 'UPS:EP', 'UPS:IP', 'UPS:DS', 'UPS:WH',
    'UPS:YP', 'UPS:HL', 'UPS:HM', 'UPS:DQ', 'UPS:SR', 'UPS:M', 'UPS:MF',
    'UPS:08', 'UPS:C5', 'UPS:C6', 'UPS:17', 'UPS:34', 'UPS:5R', 'UPS:ZA', 'UPS:ZB', 'UPS:XA',
    // Zásilkovna
    'Zasilkovna:2', 'Zasilkovna:3', 'Zasilkovna:4', 'Zasilkovna:27', 'Zasilkovna:30',
    // ČP
    'CP:-I', 'CP:-B', 'CP:-F', 'CP:41', 'CP:51', 'CP:52',
    // PPL — string-based codes, known in_transit ones
    'PPL:ShipmentInTransport', 'PPL:PreparingForDelivery', 'PPL:InputDepot.Foreign',
    'PPL:DeliveryDepot.Foreign', 'PPL:1521',
    // FOFR
    'FOFR:3', 'FOFR:4',
  ]);

  /**
   * Track events that fell through to fallback/generic mapping.
   * Helps identify new carrier codes or descriptions we should handle explicitly.
   */
  _trackUnmapped(carrier, code, description, result) {
    if (!description) return;
    if (result === null) return;
    if (result !== 'in_transit') return;
    // Skip codes explicitly mapped to in_transit
    const codeKey = `${carrier}:${code}`;
    if (code != null && TrackingSyncService.KNOWN_TRANSIT_CODES.has(codeKey)) return;
    const key = `${code || 'NULL'}|${(description || '').substring(0, 80)}`;
    if (!this.unmappedEvents.has(carrier)) {
      this.unmappedEvents.set(carrier, new Map());
    }
    const carrierMap = this.unmappedEvents.get(carrier);
    carrierMap.set(key, (carrierMap.get(key) || 0) + 1);
  }

  /**
   * Get unmapped events summary and reset.
   * Called after sync to log and expose via API.
   */
  getUnmappedSummary(reset = true) {
    const summary = {};
    for (const [carrier, events] of this.unmappedEvents) {
      const items = [];
      for (const [key, count] of events) {
        const [code, desc] = key.split('|', 2);
        items.push({ code, description: desc, count });
      }
      // Sort by count desc
      items.sort((a, b) => b.count - a.count);
      if (items.length > 0) summary[carrier] = items;
    }
    if (reset) this.unmappedEvents.clear();
    return summary;
  }

  /**
   * GLS StatusCode mapping.
   */
  /**
   * GLS StatusCode mapping (01-09, 51).
   */
  mapGLSStatus(code, desc) {
    if (code != null) {
      const c = String(code);
      // GLS uses numeric codes — some single digit, some multi-digit
      const map = {
        // Core lifecycle (01-09, 51)
        '51': 'label_created',          // Data přijata
        '1': 'handed_to_carrier',       // Převzato do přepravy
        '01': 'handed_to_carrier',
        '2': 'in_transit',              // V přepravě (třídění)
        '02': 'in_transit',
        '3': 'in_transit',              // V přepravě (mezidepo)
        '03': 'in_transit',
        '4': 'out_for_delivery',        // Na doručení
        '04': 'out_for_delivery',
        '5': 'delivered',               // Doručeno
        '05': 'delivered',
        '6': 'returned_to_sender',      // Vráceno odesílateli
        '06': 'returned_to_sender',
        '7': 'available_for_pickup',    // K vyzvednutí v ParcelShopu
        '07': 'available_for_pickup',
        '8': 'failed_delivery',         // Nedoručeno
        '08': 'failed_delivery',
        '9': 'in_transit',              // Speciální událost
        '09': 'in_transit',
        // Extended codes
        '10': 'in_transit',             // Rollcarte Check
        '12': 'failed_delivery',        // Note left (pokus o doručení, zanechán lístek)
        '17': 'failed_delivery',        // Refused (odmítnuto příjemcem)
        '18': 'problem',                // Wrong address
        '22': 'returned_to_sender',     // Back to the HUB (vrácení odesílateli)
        '26': 'in_transit',             // HUB Inbound (příjem na HUB)
        '30': 'problem',                // Damaged
        '52': 'label_created',          // COD data sent (data dobírky)
        '81': null,                     // RQ Info Normal (informační, skip)
        '401': 'problem',               // ParcelLocker capacity problem
      };
      if (c in map) return map[c];
    }
    // NULL code — fallback to description (GLS sometimes sends events without code)
    if (desc) {
      return this.mapFromDescription(desc) || 'in_transit';
    }
    return 'in_transit';
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
    // Code-based mapping — ČP has numeric (11-99), letter (-B,-F,-I,-L,-M,-3) and special (P2,QB,9V)
    const codeMap = {
      // Delivered
      '91': 'delivered',              // Dodání zásilky / Zásilka vyzvednuta
      // Available for pickup
      '53': 'available_for_pickup',   // Doručování zásilky (at post office)
      '82': 'available_for_pickup',   // Uložení zásilky — adresát nezastižen
      '86': 'available_for_pickup',   // Uložení zásilky na žádost adresáta
      'P2': 'available_for_pickup',   // Zásilka uložena v Balíkovně
      // Returned to sender
      '72': 'returned_to_sender',     // Vráceno odesílateli
      '73': 'returned_to_sender',     // Vrácení
      '95': 'returned_to_sender',     // Odeslání zpět — adresát odmítl
      '9V': 'returned_to_sender',     // Vrácení zásilky odesílateli
      // Failed delivery
      '99': 'failed_delivery',        // Nedoručitelné
      // Handed to carrier
      '11': 'handed_to_carrier',      // Podáno
      '21': 'handed_to_carrier',      // Zásilka převzata do přepravy
      '22': 'handed_to_carrier',      // Zásilka převzata do přepravy (alt)
      // In transit
      '41': 'in_transit',             // V přepravě
      '51': 'in_transit',             // Příprava zásilky k doručení
      '52': 'in_transit',             // V přepravě
      // Label created
      '-M': 'label_created',          // Obdrženy údaje k zásilce
      '-L': 'label_created',          // Obdrženy údaje zásilce
      // In transit (sorting/transport)
      '-I': 'in_transit',             // Zásilka vypravena z třídícího centra
      '-B': 'in_transit',             // Přeprava zásilky k dodací poště
      '-F': 'in_transit',             // Zásilka v přepravě
      // Notifications (SMS/email) — informational only, don't change status
      '42': null,                     // SMS zpráva adresátovi (info only)
      '43': null,                     // E-mail adresátovi (info only)
      // Other
      'QB': null,                     // Geografická data z pokusu o doručení (info)
      '-3': null,                     // Zásilka není v evidenci (info/error)
    };
    if (c in codeMap) return codeMap[c]; // null = skip (notifications)
    // Description fallback for unknown codes — negatives BEFORE positives
    if (d.includes('nedoručen') || d.includes('nezastiž') || d.includes('not deliver')) return 'failed_delivery';
    if (d.includes('vrácen') || d.includes('zpět odesílateli') || d.includes('odmítl')) return 'returned_to_sender';
    if (d.includes('uložen') || d.includes('balíkovn') || d.includes('k vyzvednutí')) return 'available_for_pickup';
    if (d.includes('dodání zásilky') || d.includes('vyzvednuta')) return 'delivered';
    if (d.includes('doručování') || (d.includes('příprava') && d.includes('doručení'))) return 'out_for_delivery';
    if (d.includes('podán') || d.includes('převzat')) return 'handed_to_carrier';
    if (d.includes('obdrženy údaje')) return 'label_created';
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
    // FOFR has numeric codes + Czech descriptions
    const c = String(code || '');
    const codeMap = {
      '1': 'label_created',          // pořízená (data received)
      '2': 'handed_to_carrier',      // exportovaná (handed to FOFR)
      '3': 'in_transit',             // ve skladu
      '4': 'in_transit',             // na cestě
      '5': 'out_for_delivery',       // rozvážená (being delivered)
      '6': 'delivered',              // doručená
      '7': 'returned_to_sender',     // vrácená
      '8': 'failed_delivery',        // nedoručená
      '71': 'handed_to_carrier',     // řidič - převzatá
      '72': 'delivered',             // řidič - doručená
    };
    if (codeMap[c]) return codeMap[c];
    // Description fallback — negatives BEFORE positives
    const d = String(desc).toLowerCase();
    if (d.includes('nedoručen')) return 'failed_delivery';
    if (d.includes('vrácen')) return 'returned_to_sender';
    if (d.includes('doručen')) return 'delivered';
    if (d.includes('rozváž')) return 'out_for_delivery';
    if (d.includes('na cestě') || d.includes('přeprav')) return 'in_transit';
    if (d.includes('ve skladu') || d.includes('sklad')) return 'in_transit';
    if (d.includes('připraven') || d.includes('k vyzvednutí')) return 'available_for_pickup';
    if (d.includes('pořízená') || d.includes('exportovaná') || d.includes('převzat')) return 'handed_to_carrier';
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
    // UPS has 40+ activity codes — map the known ones explicitly
    const codeMap = {
      // Delivered
      'D': 'delivered',               // Delivered
      'DD': 'delivered',              // Delivered Destination
      'DO': 'delivered',              // Delivered Origin
      'KB': 'delivered',              // UPS Access Point — picked up by customer
      '2W': 'delivered',              // Delivered (alt code)
      '9E': 'delivered',              // Delivered (alt code)
      // Available for pickup (UPS Access Point)
      '2Q': 'available_for_pickup',   // Doručeno do UPS Access Point (parcel arrived at AP)
      'ZP': 'available_for_pickup',   // Uschováno na UPS Access Point (stored at AP)
      '5G': 'available_for_pickup',   // Balík zůstává v AP, blíží se konec úložní doby
      'ZC': 'available_for_pickup',   // Na žádost příjemce doručen na AP
      // On the way to Access Point (not yet there)
      '5R': 'in_transit',             // Na cestě do UPS AP (will be available_for_pickup when arrives)
      'ZA': 'in_transit',             // Čeká se na doručení na AP
      'ZB': 'in_transit',             // Žádost o AP zatím nevyřízena
      // Out for delivery
      'OT': 'out_for_delivery',       // Připraveno pro doručení dnes
      'OF': 'out_for_delivery',       // Zásilka se doručuje / naloženo v vozidle
      // Handed to carrier
      'FS': 'handed_to_carrier',      // First Scan
      'P': 'handed_to_carrier',       // Pickup from sender
      'OR': 'handed_to_carrier',      // Origin scan
      // Label created
      'MP': 'label_created',          // Manifest pickup (štítek vytvořen)
      // In transit
      'I': 'in_transit',              // In Transit
      'AR': 'in_transit',             // Arrival scan
      'DP': 'in_transit',             // Departure scan
      'EP': 'in_transit',             // Export scan
      'IP': 'in_transit',             // Import scan
      'DS': 'in_transit',             // Zpracování v zařízení
      'WH': 'in_transit',             // Warehouse scan
      'YP': 'in_transit',             // Zpracování v zařízení
      'HL': 'in_transit',             // Balík zpracován v zařízení
      'HM': 'in_transit',             // Přesměrován do doručovacího střediska
      'DQ': 'in_transit',             // Odlehlá oblast — dodatečný čas
      'SR': 'in_transit',             // Special routing
      'M': 'in_transit',              // Billing info
      'MF': 'in_transit',             // Zásilka zadržena pro budoucí doručení
      // Delays
      '08': 'in_transit',             // Provozní zpoždění
      'C5': 'in_transit',             // Události mimo kontrolu — zpoždění
      'C6': 'in_transit',             // Doručení opožděno o 1 den
      '17': 'in_transit',             // Pozdní příjezd přívěsu
      '34': 'in_transit',             // Nesprávně roztříděno
      // Failed delivery
      '48': 'failed_delivery',        // Příjemce nezastižen
      'X': 'failed_delivery',         // Exception
      // Problems (address, damage, lost)
      '45': 'problem',                // Balík poškozen/zlikvidován
      'AJ': 'problem',                // Zboží chybí, krabice zlikvidována
      'H9': 'problem',                // Neshoda nebezpečný materiál
      'AE': 'problem',                // Číslo ulice chybné
      'AF': 'problem',                // Adresa neúplná
      'AB': 'problem',                // Příjemce není v seznamu budovy
      'AD': 'problem',                // Jméno příjemce chybné
      'AK': 'problem',                // Název státu chybný
      'XA': 'in_transit',             // Kontakt s příjemcem pro odbavení (celnice)
      // UPS Access Point issues
      'G3': 'failed_delivery',        // Pobočka zavřena, další pokus
      '7A': 'failed_delivery',        // Nelze doručit do AP, další pokus
      // Return
      'RS': 'returned_to_sender',     // Return to Sender
      'MV': 'returned_to_sender',     // Manifest Voided
    };
    if (codeMap[c]) return codeMap[c];
    // Fallback to description — IMPORTANT: negatives BEFORE positives
    const d = (desc || '').toLowerCase();
    if (d.includes('poškozen') || d.includes('zlikvidován') || d.includes('chybí')) return 'problem';
    if (d.includes('nezastižen') || d.includes('nemohl') || d.includes('not deliver') || d.includes('nedoručen')) return 'failed_delivery';
    if (d.includes('vrácen') || d.includes('return') || d.includes('back to sender')) return 'returned_to_sender';
    if (d.includes('access point') && (d.includes('uschováno') || d.includes('doručeno do') || d.includes('zůstává'))) return 'available_for_pickup';
    if (d.includes('doručeno') || d.includes('delivered')) return 'delivered';
    if (d.includes('doručuje') || d.includes('doručení dnes') || d.includes('naloženo')) return 'out_for_delivery';
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
      '2': 'in_transit',             // arrived at depot
      '3': 'in_transit',             // prepared for departure
      '4': 'in_transit',             // departed
      '5': 'available_for_pickup',   // ready for pickup
      '6': 'handed_to_carrier',      // forwarded to another carrier
      '7': 'delivered',              // delivered / picked up by customer
      '8': 'returned_to_sender',     // returned
      '9': 'returned_to_sender',     // posted back (vráceno odesílateli)
      '10': 'returned_to_sender',    // cancelled / returned
      '20': 'returned_to_sender',    // storage time expired → vráceno
      '23': 'out_for_delivery',      // Z-BOX delivery attempt
      '24': 'failed_delivery',       // Z-BOX last delivery attempt (failed)
      '26': 'problem',               // packet under investigation
      '27': 'in_transit',            // investigation resolved → continues
      '30': 'in_transit',            // no favourite point set, redirect
    };
    if (map[c]) return map[c];
    // NULL code — check description
    const d = (desc || '').toLowerCase();
    if (d.includes('už víme') || d.includes('čekáme') || d.includes('obdrženy')) return 'label_created';
    return this.mapFromDescription(desc) || 'in_transit';
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
    if (d.includes('vrácen') || d.includes('return') || d.includes('zpět') || d.includes('back to sender') || d.includes('back to the shipper') || d.includes('zurück')) return 'returned_to_sender';
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
