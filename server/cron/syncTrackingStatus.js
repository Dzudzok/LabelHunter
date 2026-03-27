const cron = require('node-cron');
const trackingSyncService = require('../services/TrackingSyncService');

let task = null;
let isSyncing = false;

function start() {
  // Run every 2 hours
  task = cron.schedule('0 */2 * * *', async () => {
    if (isSyncing) {
      console.log('[Cron] Tracking sync already running, skipping');
      return;
    }
    isSyncing = true;
    console.log('[Cron] Running tracking status sync...');
    try {
      await trackingSyncService.syncAll();
      // After tracking sync, update unified statuses for Retino
      const { syncAll: syncUnified } = require('../jobs/syncUnifiedStatus');
      await syncUnified();
      console.log('[Cron] Tracking sync complete');
    } catch (err) {
      console.error('[Cron] Tracking sync error:', err.message);
    } finally {
      isSyncing = false;
    }
  });

  console.log('[Cron] Tracking status sync scheduled (every 2 hours)');
}

function stop() {
  if (task) {
    task.stop();
    task = null;
  }
}

module.exports = { start, stop };
