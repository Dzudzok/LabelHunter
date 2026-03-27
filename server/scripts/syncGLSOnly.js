/**
 * Safe GLS-only sync. 1 request per second to avoid rate limits.
 * Usage: cd server && node scripts/syncGLSOnly.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const supabase = require('../db/supabase');
const glsService = require('../services/carriers/GLSService');

const CONCURRENCY = 3;   // 3 parallel requests
const DELAY_MS = 500;    // 500ms between batches (~6 req/s)
const PAGE_SIZE = 1000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function mapGLSStatus(code) {
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

async function run() {
  console.log('[GLS Sync] Starting safe GLS-only sync (1 req/s)...');

  let offset = 0;
  let allNotes = [];

  // Fetch all GLS packages needing sync
  while (true) {
    const { data, error } = await supabase
      .from('delivery_notes')
      .select('id, doc_number, tracking_number, unified_status')
      .eq('shipper_code', 'GLS')
      .not('unified_status', 'in', '(delivered,returned_to_sender)')
      .neq('status', 'cancelled')
      .not('tracking_number', 'is', null)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) { console.error('Fetch error:', error.message); break; }
    if (!data || data.length === 0) break;
    allNotes = allNotes.concat(data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`[GLS Sync] Found ${allNotes.length} GLS packages to sync`);

  let synced = 0, skipped = 0, errors = 0;

  for (let i = 0; i < allNotes.length; i += CONCURRENCY) {
    const chunk = allNotes.slice(i, i + CONCURRENCY);

    await Promise.allSettled(chunk.map(async (note) => {
      try {
        const result = await glsService.getParcelStatuses(note.tracking_number);

        if (!result.statuses || result.statuses.length === 0) {
          skipped++;
          await supabase.from('delivery_notes')
            .update({ last_tracking_update: new Date().toISOString() })
            .eq('id', note.id);
        } else {
          const lastStatus = result.statuses[0];
          const unifiedStatus = mapGLSStatus(lastStatus.statusCode);

          await supabase.from('tracking_sync_log').insert({
            delivery_note_id: note.id,
            lp_state_code: lastStatus.statusCode,
            lp_state_name: lastStatus.description,
            tracking_data: {
              source: 'gls_direct',
              data: [{
                trackingNumber: note.tracking_number,
                shipperCode: 'GLS',
                trackingItems: result.statuses.map(s => ({
                  description: s.description,
                  date: s.date,
                  location: s.depotCity,
                  statusCode: s.statusCode,
                })),
              }],
            },
          });

          await supabase.from('delivery_notes')
            .update({
              unified_status: unifiedStatus,
              last_tracking_update: new Date().toISOString(),
              last_tracking_description: lastStatus.description,
            })
            .eq('id', note.id);

          synced++;
        }
      } catch (err) {
        errors++;
      }
    }));

    const done = Math.min(i + CONCURRENCY, allNotes.length);
    if (done % 99 < CONCURRENCY) {
      console.log(`[GLS Sync] ${done}/${allNotes.length} — synced: ${synced}, skipped: ${skipped}, errors: ${errors}`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`[GLS Sync] DONE. Total: ${allNotes.length}, Synced: ${synced}, Skipped: ${skipped}, Errors: ${errors}`);
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
