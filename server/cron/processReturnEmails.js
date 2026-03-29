/**
 * Cron: process return email queue every 1 minute.
 */
let intervalId = null;
let isRunning = false;

module.exports = {
  start() {
    const INTERVAL = 60 * 1000; // 1 min

    const run = async () => {
      if (isRunning) return;
      isRunning = true;
      try {
        const emailService = require('../services/retino/ReturnEmailService');
        const sent = await emailService.processQueue();
        if (sent > 0) {
          console.log(`[Cron] processReturnEmails: sent ${sent} emails`);
        }
      } catch (err) {
        console.error('[Cron] processReturnEmails error:', err.message);
      } finally {
        isRunning = false;
      }
    };

    // First run after 30s
    setTimeout(run, 30000);
    intervalId = setInterval(run, INTERVAL);
    console.log('[Cron] processReturnEmails started (every 1 min)');
  },

  stop() {
    if (intervalId) clearInterval(intervalId);
  },
};
