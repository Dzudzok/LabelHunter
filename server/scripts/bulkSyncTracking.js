/**
 * One-time bulk sync: fetch tracking data from LP API for ALL delivery_notes
 * that have lp_shipment_id but no tracking data yet (unified_status = 'unknown').
 *
 * Usage: cd server && node scripts/bulkSyncTracking.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const supabase = require('../db/supabase');
const labelPrinterService = require('../services/LabelPrinterService');
const { getUnifiedStatus } = require('../services/retino/tracking-status-mapper');

const CONCURRENCY = 5;      // parallel API calls
const DELAY_MS = 200;        // delay between batches to avoid rate limits
const PAGE_SIZE = 1000;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function bulkSync() {
  console.log('[BulkSync] Starting bulk tracking sync...');

  let offset = 0;
  let totalFetched = 0;
  let totalUpdated = 0;
  let totalErrors = 0;
  let totalSkipped = 0;
  let hasMore = true;

  while (hasMore) {
    // Get batch of DNs that need tracking
    const { data: notes, error } = await supabase
      .from('delivery_notes')
      .select('id, lp_shipment_id, doc_number, unified_status')
      .eq('unified_status', 'unknown')
      .not('lp_shipment_id', 'is', null)
      .is('last_tracking_update', null)
      .order('id', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('[BulkSync] Fetch error:', error.message);
      break;
    }

    if (!notes || notes.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`[BulkSync] Processing batch offset=${offset}, count=${notes.length}`);

    // Process in chunks of CONCURRENCY
    for (let i = 0; i < notes.length; i += CONCURRENCY) {
      const chunk = notes.slice(i, i + CONCURRENCY);

      const results = await Promise.allSettled(chunk.map(async (note) => {
        try {
          const tracking = await labelPrinterService.getTracking(note.lp_shipment_id);

          if (!tracking) {
            totalSkipped++;
            // Mark as synced to avoid re-fetching
            await supabase.from('delivery_notes').update({ last_tracking_update: new Date().toISOString() }).eq('id', note.id);
            return;
          }

          // Check if data is empty (e.g. data: [null])
          const hasData = tracking.data && Array.isArray(tracking.data) && tracking.data.some(d => d !== null);
          if (!hasData) {
            totalSkipped++;
            await supabase.from('delivery_notes').update({ last_tracking_update: new Date().toISOString() }).eq('id', note.id);
            return;
          }

          // Save to tracking_sync_log
          await supabase.from('tracking_sync_log').insert({
            delivery_note_id: note.id,
            lp_state_code: tracking.stateCode || null,
            lp_state_name: tracking.stateName || null,
            tracking_data: tracking,
          });

          // Compute unified status
          const result = getUnifiedStatus(tracking);

          // Update delivery_note
          await supabase
            .from('delivery_notes')
            .update({
              unified_status: result.status,
              last_tracking_update: new Date().toISOString(),
              last_tracking_description: result.lastDescription,
            })
            .eq('id', note.id);

          totalUpdated++;
        } catch (err) {
          // 404 or similar — no tracking data available
          if (err.response?.status === 404) {
            // Mark as synced with no data to avoid re-fetching
            await supabase
              .from('delivery_notes')
              .update({ last_tracking_update: new Date().toISOString() })
              .eq('id', note.id);
            totalSkipped++;
          } else {
            console.error(`[BulkSync] Error DN ${note.id} (${note.doc_number}):`, err.message);
            totalErrors++;
          }
        }
      }));

      totalFetched += chunk.length;

      if (totalFetched % 100 === 0) {
        console.log(`[BulkSync] Progress: ${totalFetched} fetched, ${totalUpdated} updated, ${totalSkipped} skipped, ${totalErrors} errors`);
      }

      await sleep(DELAY_MS);
    }

    // Since we're filtering by last_tracking_update IS NULL,
    // successfully processed records won't appear again — keep offset at 0
    // But increment offset for records that might have failed
    if (notes.length < PAGE_SIZE) {
      hasMore = false;
    }
    // Don't increment offset — processed records now have last_tracking_update set
  }

  console.log(`[BulkSync] DONE. Fetched: ${totalFetched}, Updated: ${totalUpdated}, Skipped: ${totalSkipped}, Errors: ${totalErrors}`);
}

bulkSync().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
