const axios = require('axios');

/**
 * Zásilkovna / Packeta REST API.
 * Docs: https://docs.packeta.com/docs/packet-tracking/tracking
 * Auth: API password in XML body (first 16 chars = API key)
 *
 * Env vars: ZASILKOVNA_API_PASSWORD
 */
class ZasilkovnaService {
  constructor() {
    this.baseUrl = 'https://www.zasilkovna.cz/api/rest';
    // API key = first 16 chars of API password. For packetTracking, API password is needed.
    this.apiPassword = process.env.ZASILKOVNA_API_PASSWORD || '952a8476660123c8';
  }

  isConfigured() {
    return !!this.apiPassword;
  }

  /**
   * Get tracking for a packet by ID.
   * @param {string} packetId - Zásilkovna packet number
   * @returns {object} { trackingNumber, statuses[] }
   */
  async getParcelStatuses(packetId) {
    if (!this.isConfigured()) {
      throw new Error('Zásilkovna API not configured (ZASILKOVNA_API_PASSWORD missing)');
    }

    const xmlBody = `<packetTracking>
  <apiPassword>${this.apiPassword}</apiPassword>
  <packetId>${packetId}</packetId>
</packetTracking>`;

    const res = await axios.post(this.baseUrl, xmlBody, {
      headers: {
        'Content-Type': 'text/xml',
        'Accept-Language': 'cs_CZ',
      },
      timeout: 15000,
    });

    // Parse XML response — simple regex parsing (no heavy XML lib needed)
    const xml = res.data;
    const statuses = [];

    // Extract <record> elements
    const recordRegex = /<record>([\s\S]*?)<\/record>/g;
    let match;
    while ((match = recordRegex.exec(xml)) !== null) {
      const block = match[1];
      const get = (tag) => {
        const m = block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
        return m ? m[1] : null;
      };
      statuses.push({
        statusCode: get('statusCode') || get('type'),
        description: get('codeText') || get('text') || get('name') || '',
        date: get('dateTime') || get('date') || null,
        location: get('branchName') || get('name') || null,
      });
    }

    // If no <record> tags, try <status> wrapper
    if (statuses.length === 0) {
      const statusCode = xml.match(/<statusCode>(\d+)<\/statusCode>/)?.[1];
      const codeText = xml.match(/<codeText>([^<]*)<\/codeText>/)?.[1];
      const dateTime = xml.match(/<dateTime>([^<]*)<\/dateTime>/)?.[1];
      if (statusCode || codeText) {
        statuses.push({
          statusCode: statusCode || null,
          description: codeText || '',
          date: dateTime || null,
          location: null,
        });
      }
    }

    return {
      trackingNumber: packetId,
      statuses,
    };
  }
}

module.exports = new ZasilkovnaService();
