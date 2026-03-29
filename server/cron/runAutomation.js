const cron = require('node-cron');
const automationEngine = require('../services/AutomationEngine');

let task = null;
let isRunning = false;

function start() {
  // Run every 4 hours
  task = cron.schedule('0 */4 * * *', async () => {
    if (isRunning) {
      console.log('[Cron] Automation checks already running, skipping');
      return;
    }
    isRunning = true;
    console.log('[Cron] Running automation scheduled checks...');
    try {
      await automationEngine.runScheduledChecks();
      console.log('[Cron] Automation checks complete');
    } catch (err) {
      console.error('[Cron] Automation checks error:', err.message);
    } finally {
      isRunning = false;
    }
  });

  console.log('[Cron] Automation scheduled checks scheduled (every 4 hours)');
}

function stop() {
  if (task) {
    task.stop();
    task = null;
  }
}

module.exports = { start, stop };
