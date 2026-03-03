const supabase = require('../db/supabase');
const labelPrinterService = require('./LabelPrinterService');
const emailService = require('./EmailService');

class TrackingSyncService {
  async syncAll() {
    console.log('[TrackingSync] Starting sync...');

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const { data: shipments, error } = await supabase
      .from('delivery_notes')
      .select('*')
      .in('status', ['shipped', 'label_generated'])
      .not('lp_shipment_id', 'is', null)
      .gte('label_generated_at', fourteenDaysAgo.toISOString());

    if (error) {
      console.error('[TrackingSync] Error fetching shipments:', error);
      return;
    }

    if (!shipments || shipments.length === 0) {
      console.log('[TrackingSync] No shipments to sync');
      return;
    }

    console.log(`[TrackingSync] Syncing ${shipments.length} shipments`);

    for (const shipment of shipments) {
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

        // Delivered states
        if (stateCode === 5 || stateCode === 6) {
          newStatus = 'delivered';
        }
        // Returned states
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
            // Check if we already sent a problem email (avoid spamming)
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

    console.log('[TrackingSync] Sync complete');
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
