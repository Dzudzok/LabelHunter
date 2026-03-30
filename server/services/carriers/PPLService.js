const axios = require('axios');

/**
 * PPL CZ (DHL CPL API / MyAPI2).
 * Docs: https://ppl-cpl-api.apidog.io
 * Auth: OAuth 2.0 Client Credentials
 *
 * Only works for PPL DHL shipments (tracking numbers starting with 207..., service EB).
 * Domestic PPL CZ (707/457/407) uses a different system and needs LP API.
 *
 * Env vars: PPL_CLIENT_ID, PPL_CLIENT_SECRET
 */
class PPLService {
  constructor() {
    this.baseUrl = 'https://api.dhl.com/ecs/ppl/myapi2';
    this.clientId = process.env.PPL_CLIENT_ID || '';
    this.clientSecret = process.env.PPL_CLIENT_SECRET || '';
    this.token = null;
    this.tokenExpiry = 0;
  }

  isConfigured() {
    return !!(this.clientId && this.clientSecret);
  }

  /**
   * Check if a tracking number is a PPL DHL shipment (international).
   * Only PPL DHL shipments (207...) are available via CPL API.
   */
  isPPLDHL(trackingNumber) {
    return String(trackingNumber).startsWith('207');
  }

  async _getToken() {
    const now = Date.now();
    if (this.token && now < this.tokenExpiry - 60000) return this.token;

    const res = await axios.post(
      `${this.baseUrl}/login/getAccessToken`,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: 'myapi2',
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      }
    );

    this.token = res.data.access_token;
    this.tokenExpiry = now + (res.data.expires_in || 1800) * 1000;
    return this.token;
  }

  /**
   * Get tracking for a PPL DHL shipment (207... numbers).
   * Returns tracking + JJD number.
   * @param {string} shipmentNumber - PPL shipment number (20755797408)
   * @returns {object} { trackingNumber, jjdNumber, statuses[] }
   */
  async getParcelStatuses(shipmentNumber) {
    if (!this.isConfigured()) {
      throw new Error('PPL API not configured (PPL_CLIENT_ID/PPL_CLIENT_SECRET missing)');
    }

    if (!this.isPPLDHL(shipmentNumber)) {
      throw new Error(`PPL CZ domestic (${shipmentNumber}) not supported via CPL API — use LP API`);
    }

    const token = await this._getToken();

    const res = await axios.get(
      `${this.baseUrl}/shipment`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        params: {
          ShipmentNumbers: shipmentNumber,
          Limit: 1,
          Offset: 0,
        },
        timeout: 15000,
      }
    );

    const shipments = Array.isArray(res.data) ? res.data : [];
    const shipment = shipments.find(s => s.shipmentNumber === shipmentNumber);

    if (!shipment) {
      return { trackingNumber: shipmentNumber, jjdNumber: null, statuses: [] };
    }

    // Extract JJD number from externalNumbers
    const jjdEntry = shipment.externalNumbers?.find(e => e.code === 'PJJD');
    const jjdNumber = jjdEntry?.externalNumber || null;

    // Extract tracking events
    const tt = shipment.trackAndTrace || {};
    const events = tt.events || [];

    const statuses = events.map(e => ({
      statusCode: e.code || String(e.statusId) || null,
      description: e.name || '',
      date: e.eventDate ? new Date(e.eventDate).toISOString() : null,
      location: null,
      phase: e.phase || null,
      group: e.group || null,
    }));

    return {
      trackingNumber: shipmentNumber,
      jjdNumber,
      externalNumbers: shipment.externalNumbers || [],
      recipient: shipment.recipient ? {
        name: shipment.recipient.name,
        country: shipment.recipient.country,
      } : null,
      shipmentState: shipment.shipmentState,
      statuses,
    };
  }

  /**
   * Batch fetch JJD numbers for multiple PPL DHL shipments.
   * Paginates through CPL API and matches by shipment number.
   * @param {string[]} shipmentNumbers - Array of 207... numbers
   * @returns {Object} Map of shipmentNumber → jjdNumber
   */
  async batchGetJJDNumbers(shipmentNumbers) {
    if (!this.isConfigured() || shipmentNumbers.length === 0) return {};

    const token = await this._getToken();
    const result = {};

    // CPL API supports ShipmentNumbers as comma-separated or array
    // Process in batches of 20 to avoid URL length limits
    const batchSize = 20;
    for (let i = 0; i < shipmentNumbers.length; i += batchSize) {
      const batch = shipmentNumbers.slice(i, i + batchSize);

      try {
        const res = await axios.get(
          `${this.baseUrl}/shipment`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params: {
              ShipmentNumbers: batch.join(','),
              Limit: batchSize,
              Offset: 0,
            },
            timeout: 20000,
          }
        );

        const data = Array.isArray(res.data) ? res.data : [];
        for (const s of data) {
          const jjd = s.externalNumbers?.find(e => e.code === 'PJJD');
          if (jjd) {
            result[s.shipmentNumber] = jjd.externalNumber;
          }
        }
      } catch (err) {
        console.error(`[PPLService] Batch JJD fetch error:`, err.message);
      }
    }

    return result;
  }
}

module.exports = new PPLService();
