const cron = require('node-cron');
const { importDeliveryNotes } = require('../routes/nextis');

let task = null;

function start() {
  // Run every 30 minutes
  task = cron.schedule('*/30 * * * *', async () => {
    console.log('[Cron] Running delivery notes import...');
    try {
      const result = await importDeliveryNotes();
      console.log(`[Cron] Import complete: ${result.imported} imported, ${result.skipped} skipped`);
    } catch (err) {
      console.error('[Cron] Import error:', err.message);
    }
  });

  console.log('[Cron] Delivery notes import scheduled (every 30 minutes)');
}

function stop() {
  if (task) {
    task.stop();
    task = null;
  }
}

module.exports = { start, stop };
