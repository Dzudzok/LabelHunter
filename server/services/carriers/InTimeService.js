const axios = require('axios');

/**
 * InTime (One by Allegro) REST API.
 * Docs: https://bridge.intime.cz/doc/restapi.html
 * Auth: HTTP Basic Authentication
 *
 * Env vars: INTIME_API_URL, INTIME_USERNAME, INTIME_PASSWORD
 */
class InTimeService {
  constructor() {
    this.baseUrl = process.env.INTIME_API_URL || 'https://bridge.intime.cz/api';
    this.username = process.env.INTIME_USERNAME || '';
    this.password = process.env.INTIME_PASSWORD || '';
  }

  isConfigured() {
    return !!(this.username && this.password);
  }

  /**
   * Get package status by order number.
   * @param {string} orderNumber - InTime order/tracking number
   * @returns {object} { trackingNumber, statuses[] }
   */
  async getParcelStatuses(orderNumber) {
    if (!this.isConfigured()) {
      throw new Error('InTime API not configured (INTIME_USERNAME/INTIME_PASSWORD missing)');
    }

    const res = await axios.get(
      `${this.baseUrl}/package/${orderNumber}`,
      {
        auth: {
          username: this.username,
          password: this.password,
        },
        headers: { Accept: 'application/json' },
        timeout: 15000,
      }
    );

    const data = res.data;
    const statusHistory = data?.statusHistory || data?.statuses || [];

    const statuses = (Array.isArray(statusHistory) ? statusHistory : [])
      .map(s => ({
        statusCode: s.statusCode || s.code || null,
        description: s.description || s.statusText || '',
        date: s.date || s.created ? new Date(s.date || s.created).toISOString() : null,
        location: s.location || s.depot || null,
      }));

    // If no history, use the main status
    if (statuses.length === 0 && data?.status) {
      statuses.push({
        statusCode: data.status.code || data.statusCode || null,
        description: data.status.text || data.statusText || '',
        date: data.updated || data.created || null,
        location: null,
      });
    }

    return {
      trackingNumber: orderNumber,
      statuses,
    };
  }
}

module.exports = new InTimeService();
