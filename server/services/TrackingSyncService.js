const supabase = require('../db/supabase');
const labelPrinterService = require('./LabelPrinterService');
const emailService = require('./EmailService');
const trackingEmailService = require('./TrackingEmailService');
const automationEngine = require('./AutomationEngine');
const carrierRouter = require('./carriers/CarrierRouter');
const { classifyDescription } = require('./retino/tracking-status-mapper');
const eddService = require('./EDDService');

class TrackingSyncService {
  constructor() {
    // Rate limit for LP API: 1 request per 2 seconds to avoid overloading
    this.LP_DELAY_MS = 2000;
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async syncAll() {
    console.log('[TrackingSync] Starting sync...');

    // Log which carriers have direct API configured
    const configured = carrierRouter.getConfiguredCarriers();
    console.log('[TrackingSync] Direct carrier APIs:', JSON.stringify(configured));

    // Paginate through ALL matching shipments (Supabase default limit is 1000)
    // Skip final statuses — no need to re-check delivered/returned packages
    const SKIP_UNIFIED = ['delivered', 'returned_to_sender'];
    const PAGE_SIZE = 1000;
    let offset = 0;
    let allShipments = [];

    while (true) {
      const { data: batch, error } = await supabase
        .from('delivery_notes')
        .select('*')
        .not('unified_status', 'in', `(${SKIP_UNIFIED.join(',')})`)
        .not('status', 'eq', 'cancelled')
        .not('lp_shipment_id', 'is', null)
        .range(offset, offset + PAGE_SIZE - 1);

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

          // Last status = first in array (most recent)
          const lastStatus = result.statuses[0];
          const unifiedStatus = this.mapCarrierStatus(carrier, lastStatus);
          const lastDescription = lastStatus.description;

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
          await supabase.from('tracking_sync_log').insert({
            delivery_note_id: shipment.id,
            lp_state_code: lastStatus.statusCode,
            lp_state_name: lastDescription,
            tracking_data: trackingData,
          });

          // Update unified_status + timestamps
          const updates = {
            unified_status: unifiedStatus,
            last_tracking_update: new Date().toISOString(),
            last_tracking_description: lastDescription,
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

    // Generic: try to classify from description text
    return this.mapFromDescription(desc) || 'in_transit';
  }

  /**
   * GLS StatusCode mapping.
   */
  mapGLSStatus(code) {
    const codeStr = String(code).padStart(2, '0');
    const map = {
      '51': 'label_created',
      '01': 'handed_to_carrier',
      '02': 'in_transit',
      '03': 'in_transit',
      '04': 'out_for_delivery',
      '05': 'delivered',
      '06': 'returned_to_sender',
      '07': 'available_for_pickup',
      '08': 'failed_delivery',
      '09': 'in_transit',
    };
    return map[codeStr] || 'in_transit';
  }

  /**
   * Česká Pošta status mapping.
   * Common codes: 91=delivered, 51/52=in transit, 53=available for pickup
   */
  mapCPStatus(code, desc) {
    const codeStr = String(code);
    if (codeStr === '91' || desc.includes('doručen') || desc.includes('delivered')) return 'delivered';
    if (codeStr === '53' || desc.includes('uložen') || desc.includes('k vyzvednutí')) return 'available_for_pickup';
    if (desc.includes('vrácen') || desc.includes('return')) return 'returned_to_sender';
    if (desc.includes('nedoručen') || desc.includes('nezastiž')) return 'failed_delivery';
    if (desc.includes('podán') || desc.includes('přijat')) return 'handed_to_carrier';
    if (desc.includes('výdejn') || desc.includes('doručován')) return 'out_for_delivery';
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
    if (d.includes('doručen')) return 'delivered';
    if (d.includes('vrácen')) return 'returned_to_sender';
    if (d.includes('na cestě') || d.includes('přeprav')) return 'in_transit';
    if (d.includes('ve skladu') || d.includes('sklad')) return 'in_transit';
    if (d.includes('připraven') || d.includes('k vyzvednutí')) return 'available_for_pickup';
    if (d.includes('nedoručen')) return 'failed_delivery';
    if (d.includes('pořízená') || d.includes('exportovaná')) return 'handed_to_carrier';
    return 'in_transit';
  }

  mapDPDStatus(code, desc) {
    if (desc.includes('deliver') || desc.includes('doručen')) return 'delivered';
    if (desc.includes('pickup') || desc.includes('výdejn') || desc.includes('parcelshop')) return 'available_for_pickup';
    if (desc.includes('return') || desc.includes('vrác')) return 'returned_to_sender';
    if (desc.includes('not delivered') || desc.includes('nedoruč')) return 'failed_delivery';
    if (desc.includes('out for') || desc.includes('doručován')) return 'out_for_delivery';
    if (desc.includes('picked up') || desc.includes('přijat') || desc.includes('scan')) return 'handed_to_carrier';
    return 'in_transit';
  }

  /**
   * UPS status mapping.
   * UPS codes: D=Delivered, I=In Transit, P=Pickup, X=Exception, M=Billing, MV=Voided
   */
  mapUPSStatus(code, desc) {
    const c = String(code).toUpperCase();
    if (c === 'D' || c === 'KB' || c === 'FS') return 'delivered';
    if (c === 'X' || c === 'RS') return 'failed_delivery';
    if (c === 'P') return 'handed_to_carrier';
    if (c === 'I') return 'in_transit';
    if (c === 'MV') return 'returned_to_sender';
    // Fallback to description
    if (desc.includes('deliver')) return 'delivered';
    if (desc.includes('return')) return 'returned_to_sender';
    if (desc.includes('exception')) return 'failed_delivery';
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
    // PPL event codes
    if (c.includes('delivered') || c === 'deliveryfinished') return 'delivered';
    if (c.includes('waitingforshipment') || c === 'dataaccepted') return 'label_created';
    if (c.includes('intransit') || c.includes('transit')) return 'in_transit';
    if (c.includes('outfordelivery') || c.includes('readyfordelivery')) return 'out_for_delivery';
    if (c.includes('accesspoint') || c.includes('pickup')) return 'available_for_pickup';
    if (c.includes('return') || c.includes('backshipment')) return 'returned_to_sender';
    if (c.includes('undeliverable') || c.includes('notdelivered')) return 'failed_delivery';
    if (c.includes('pickedup') || c.includes('accepted')) return 'handed_to_carrier';
    // Fallback to description
    return this.mapFromDescription(desc) || 'in_transit';
  }

  /**
   * Generic description-based status classification.
   */
  mapFromDescription(desc) {
    if (!desc) return null;
    const d = desc.toLowerCase();
    if (d.includes('doručen') || d.includes('deliver') || d.includes('zugestellt')) return 'delivered';
    if (d.includes('vrácen') || d.includes('return') || d.includes('zpět')) return 'returned_to_sender';
    if (d.includes('nedoručen') || d.includes('not deliver') || d.includes('nezastiž')) return 'failed_delivery';
    if (d.includes('k vyzvednutí') || d.includes('pickup') || d.includes('uložen') || d.includes('výdejn')) return 'available_for_pickup';
    if (d.includes('doručován') || d.includes('out for') || d.includes('v doručení')) return 'out_for_delivery';
    if (d.includes('přijat') || d.includes('podán') || d.includes('picked up')) return 'handed_to_carrier';
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
