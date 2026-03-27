/**
 * Safe LP API sync for non-GLS packages. 1 request per 2 seconds.
 * Usage: cd server && node scripts/syncLPOnly.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const supabase = require('../db/supabase');
const labelPrinterService = require('../services/LabelPrinterService');
const { getUnifiedStatus } = require('../services/retino/tracking-status-mapper');

const DELAY_MS = 2000; // 1 request per 2 seconds — safe for LP API
const PAGE_SIZE = 1000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('[LP Sync] Starting safe LP-only sync (1 req/2s, no GLS)...');

  let offset = 0;
  let allNotes = [];

  while (true) {
    const { data, error } = await supabase
      .from('delivery_notes')
      .select('id, doc_number, lp_shipment_id, tracking_number, unified_status')
      .neq('shipper_code', 'GLS')
      .eq('unified_status', 'unknown')
      .neq('status', 'cancelled')
      .not('lp_shipment_id', 'is', null)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) { console.error('Fetch error:', error.message); break; }
    if (!data || data.length === 0) break;
    allNotes = allNotes.concat(data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`[LP Sync] Found ${allNotes.length} non-GLS packages to sync`);

  let synced = 0, skipped = 0, errors = 0;

  for (let i = 0; i < allNotes.length; i++) {
    const note = allNotes[i];

    try {
      const tracking = await labelPrinterService.getTracking(note.lp_shipment_id);

      if (!tracking) {
        skipped++;
        await supabase.from('delivery_notes')
          .update({ last_tracking_update: new Date().toISOString() })
          .eq('id', note.id);
        await sleep(DELAY_MS);
        continue;
      }

      // Check if data is empty (e.g. data: [null])
      const hasData = tracking.data && Array.isArray(tracking.data) && tracking.data.some(d => d !== null);
      if (!hasData) {
        skipped++;
        await supabase.from('delivery_notes')
          .update({ last_tracking_update: new Date().toISOString() })
          .eq('id', note.id);
        await sleep(DELAY_MS);
        continue;
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

      await supabase.from('delivery_notes')
        .update({
          unified_status: result.status,
          last_tracking_update: new Date().toISOString(),
          last_tracking_description: result.lastDescription,
        })
        .eq('id', note.id);

      synced++;
    } catch (err) {
      if (err.response?.status === 404) {
        skipped++;
        await supabase.from('delivery_notes')
          .update({ last_tracking_update: new Date().toISOString() })
          .eq('id', note.id);
      } else {
        errors++;
      }
    }

    if ((i + 1) % 50 === 0) {
      console.log(`[LP Sync] ${i + 1}/${allNotes.length} — synced: ${synced}, skipped: ${skipped}, errors: ${errors}`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`[LP Sync] DONE. Total: ${allNotes.length}, Synced: ${synced}, Skipped: ${skipped}, Errors: ${errors}`);
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
