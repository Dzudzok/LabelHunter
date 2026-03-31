const axios = require('axios');

/**
 * FOFR CZ (Transforwarding) — public tracking API.
 * No auth needed — public JSON endpoint.
 * Docs: https://info.tfw.cz/online-sluzby-fofr-netspedice/#sluzba-60
 *
 * URL: https://objednavky.fofrcz.cz/zasilka-sledovani/{trackingNumber}/{rok}/json
 */
class FOFRService {
  constructor() {
    this.baseUrl = 'https://objednavky.fofrcz.cz/zasilka-sledovani';
  }

  isConfigured() {
    return true; // Public API, no credentials needed
  }

  /**
   * Get tracking for a FOFR shipment.
   * @param {string} trackingNumber - FOFR tracking number
   * @returns {object} { trackingNumber, statuses[] }
   */
  async getParcelStatuses(trackingNumber) {
    const year = new Date().getFullYear();

    // Try current year first, then previous year
    for (const rok of [year, year - 1]) {
      try {
        const res = await axios.get(`${this.baseUrl}/${trackingNumber}/${rok}/json`, {
          timeout: 15000,
          headers: { 'Accept': 'application/json' },
        });

        const data = Array.isArray(res.data) ? res.data[0] : res.data;
        if (!data || !data.shipment_num) continue;

        const statuses = [{
          statusCode: String(data.posledni_statut || ''),
          description: data.posledni_statut_text || '',
          date: data.posledni_statut_datum_p || null,
          location: data.prij_mesto || null,
        }];

        return {
          trackingNumber: data.shipment_num,
          statuses,
          rawStatus: data.statut,
          senderCity: data.odes_mesto,
          recipientCity: data.prij_mesto,
          exportDate: data.datum_exportu,
        };
      } catch (err) {
        if (err.response?.status === 404) continue;
        throw err;
      }
    }

    return { trackingNumber, statuses: [] };
  }
}

module.exports = new FOFRService();
