const axios = require('axios');

/**
 * Česká Pošta B2C API — FREE public tracking, no auth needed.
 * Docs: https://b2c.cpost.cz/
 *
 * Response format: array of parcels, each with .states.state[]
 * State fields: id (status code), date, text, postcode, postoffice
 */
class CeskaPostaService {
  constructor() {
    this.baseUrl = 'https://b2c.cpost.cz/services/ParcelHistory';
  }

  /**
   * Get tracking history for a parcel.
   * @param {string} trackingNumber
   * @returns {object} { trackingNumber, statuses[] }
   */
  async getParcelStatuses(trackingNumber) {
    const res = await axios.get(
      `${this.baseUrl}/getDataAsJson`,
      {
        params: { idParcel: trackingNumber },
        timeout: 15000,
      }
    );

    const data = res.data;

    // CP returns an array of parcels: [ { attributes: {...}, states: { state: [...] } } ]
    const parcel = Array.isArray(data) ? data[0] : data;
    if (!parcel || !parcel.states) {
      return { trackingNumber, statuses: [] };
    }

    const statesRaw = parcel.states.state || parcel.states || [];
    const states = Array.isArray(statesRaw) ? statesRaw : [statesRaw];

    const statuses = states
      .filter(s => s)
      .map(s => ({
        statusCode: s.id || null,
        description: s.text || '',
        date: s.date || null,
        postCode: s.postcode || null,
        postOffice: s.postoffice || null,
      }));

    return {
      trackingNumber,
      statuses,
    };
  }
}

module.exports = new CeskaPostaService();
