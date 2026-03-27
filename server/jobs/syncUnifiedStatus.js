const supabase = require('../db/supabase');
const { getUnifiedStatus } = require('../services/retino/tracking-status-mapper');

/**
 * Sync unified_status on delivery_notes from tracking_sync_log data.
 * Paginates through ALL delivery_notes with tracking numbers.
 */
async function syncAll() {
  console.log('[syncUnifiedStatus] Starting...');
  let updated = 0;
  let errors = 0;
  let totalProcessed = 0;

  const PAGE_SIZE = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: notes, error: fetchErr } = await supabase
      .from('delivery_notes')
      .select('id, unified_status, last_tracking_update')
      .not('tracking_number', 'is', null)
      .not('unified_status', 'in', '(delivered,returned_to_sender)')
      .order('id', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (fetchErr) {
      console.error('[syncUnifiedStatus] Failed to fetch delivery_notes:', fetchErr.message);
      errors++;
      break;
    }

    if (!notes || notes.length === 0) {
      hasMore = false;
      break;
    }

    totalProcessed += notes.length;
    console.log(`[syncUnifiedStatus] Processing batch offset=${offset}, count=${notes.length}`);

    // Process in sub-batches of 100 for tracking_sync_log queries
    const BATCH = 100;
    for (let i = 0; i < notes.length; i += BATCH) {
      const batch = notes.slice(i, i + BATCH);
      const ids = batch.map(n => n.id);

      const { data: logs, error: logErr } = await supabase
        .from('tracking_sync_log')
        .select('delivery_note_id, tracking_data, synced_at')
        .in('delivery_note_id', ids)
        .order('synced_at', { ascending: false });

      if (logErr) {
        console.error('[syncUnifiedStatus] Failed to fetch logs:', logErr.message);
        errors++;
        continue;
      }

      // Group by delivery_note_id, keep only latest
      const latestByDn = {};
      for (const log of (logs || [])) {
        if (!latestByDn[log.delivery_note_id]) {
          latestByDn[log.delivery_note_id] = log;
        }
      }

      for (const note of batch) {
        const log = latestByDn[note.id];
        if (!log) continue;

        // Skip if already up to date
        if (note.unified_status !== 'unknown' && note.last_tracking_update) {
          const logTime = new Date(log.synced_at).getTime();
          const lastTime = new Date(note.last_tracking_update).getTime();
          if (logTime <= lastTime) continue;
        }

        try {
          const result = getUnifiedStatus(log.tracking_data);

          const { error: updateErr } = await supabase
            .from('delivery_notes')
            .update({
              unified_status: result.status,
              last_tracking_update: log.synced_at,
              last_tracking_description: result.lastDescription,
            })
            .eq('id', note.id);

          if (updateErr) {
            console.error(`[syncUnifiedStatus] Update failed for DN ${note.id}:`, updateErr.message);
            errors++;
          } else {
            updated++;
          }
        } catch (err) {
          console.error(`[syncUnifiedStatus] Error processing DN ${note.id}:`, err.message);
          errors++;
        }
      }
    }

    if (notes.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      offset += PAGE_SIZE;
    }
  }

  console.log(`[syncUnifiedStatus] Done. Processed: ${totalProcessed}, Updated: ${updated}, Errors: ${errors}`);
  return { updated, errors, totalProcessed };
}

module.exports = { syncAll };
