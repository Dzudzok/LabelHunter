const axios = require('axios');

/**
 * UPS Tracking API (global).
 * Docs: https://developer.ups.com/tag/Tracking
 * Auth: OAuth 2.0 Client Credentials
 *
 * Env vars: UPS_CLIENT_ID, UPS_CLIENT_SECRET
 */
class UPSService {
  constructor() {
    this.baseUrl = 'https://onlinetools.ups.com/api';
    this.clientId = process.env.UPS_CLIENT_ID || '';
    this.clientSecret = process.env.UPS_CLIENT_SECRET || '';
    this.token = null;
    this.tokenExpiry = 0;
  }

  isConfigured() {
    return !!(this.clientId && this.clientSecret);
  }

  async _getToken() {
    const now = Date.now();
    if (this.token && now < this.tokenExpiry - 60000) return this.token;

    const res = await axios.post(
      'https://onlinetools.ups.com/security/v1/oauth/token',
      'grant_type=client_credentials',
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        auth: {
          username: this.clientId,
          password: this.clientSecret,
        },
        timeout: 15000,
      }
    );

    this.token = res.data.access_token;
    this.tokenExpiry = now + (res.data.expires_in || 14400) * 1000;
    return this.token;
  }

  /**
   * Get tracking details for a package.
   * @param {string} trackingNumber - UPS tracking number (1Z...)
   * @returns {object} { trackingNumber, statuses[] }
   */
  async getParcelStatuses(trackingNumber) {
    if (!this.isConfigured()) {
      throw new Error('UPS API not configured (UPS_CLIENT_ID/UPS_CLIENT_SECRET missing)');
    }

    const token = await this._getToken();

    const res = await axios.get(
      `${this.baseUrl}/track/v1/details/${trackingNumber}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          transId: `lh-${Date.now()}`,
          transactionSrc: 'LabelHunter',
          Accept: 'application/json',
        },
        params: { locale: 'cs_CZ' },
        timeout: 15000,
      }
    );

    const shipment = res.data?.trackResponse?.shipment?.[0];
    const pkg = shipment?.package?.[0];
    const activities = pkg?.activity || [];

    const statuses = activities.map(a => {
      let date = null;
      if (a.date && a.time) {
        // UPS date: "20240315", time: "143000"
        const d = a.date;
        const t = a.time;
        date = new Date(
          `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}T${t.substring(0, 2)}:${t.substring(2, 4)}:${t.substring(4, 6)}`
        ).toISOString();
      }

      return {
        statusCode: a.status?.code || null,
        description: a.status?.description || '',
        date,
        location: [a.location?.address?.city, a.location?.address?.country]
          .filter(Boolean)
          .join(', ') || null,
      };
    });

    return {
      trackingNumber,
      statuses,
    };
  }
}

module.exports = new UPSService();
