const cron = require('node-cron');
const trackingSyncService = require('../services/TrackingSyncService');

let task = null;

function start() {
  // Run every 2 hours
  task = cron.schedule('0 */2 * * *', async () => {
    console.log('[Cron] Running tracking status sync...');
    try {
      await trackingSyncService.syncAll();
      console.log('[Cron] Tracking sync complete');
    } catch (err) {
      console.error('[Cron] Tracking sync error:', err.message);
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
