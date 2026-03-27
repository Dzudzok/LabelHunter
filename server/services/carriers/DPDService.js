const axios = require('axios');

/**
 * DPD CZ GeoAPI v2.
 * Docs: https://geoapi.dpd.cz/v2/swagger/
 * Auth: API key in x-api-key header
 *
 * Env vars: DPD_API_KEY
 */
class DPDService {
  constructor() {
    this.baseUrl = 'https://geoapi.dpd.cz/v2';
    // DPD GeoAPI — might use username as API key, or separate key
    this.apiKey = process.env.DPD_API_KEY || '';
  }

  isConfigured() {
    return !!this.apiKey;
  }

  /**
   * Get tracking for a single parcel.
   * @param {string} parcelNumber - 14-digit DPD parcel number
   * @returns {object} { trackingNumber, statuses[] }
   */
  async getParcelStatuses(parcelNumber) {
    if (!this.isConfigured()) {
      throw new Error('DPD API not configured (DPD_API_KEY missing)');
    }

    const res = await axios.get(
      `${this.baseUrl}/parcels/${parcelNumber}/tracking`,
      {
        headers: {
          'x-api-key': this.apiKey,
          Accept: 'application/json',
        },
        timeout: 15000,
      }
    );

    const data = res.data;
    const events = data?.parcelEvents || data?.events || [];

    const statuses = (Array.isArray(events) ? events : [])
      .map(e => ({
        statusCode: e.status?.statusCode || e.statusCode || null,
        description: e.status?.description || e.description || '',
        date: e.createdAt || e.date ? new Date(e.createdAt || e.date).toISOString() : null,
        location: e.additionalInfo?.city || e.location || null,
      }));

    return {
      trackingNumber: parcelNumber,
      statuses,
    };
  }
}

module.exports = new DPDService();
