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

    // Try CPL API first for ALL numbers (DHL + domestic are both there)
    try {
      const result = await this._getCPLTracking(shipmentNumber);
      if (result && result.statuses && result.statuses.length > 0) {
        return result;
      }
    } catch (e) {
      // CPL failed — try SOAP for domestic
    }

    // Fallback: myAPI SOAP for domestic numbers not in CPL
    try {
      return await this._getDomesticTracking(shipmentNumber);
    } catch (e) {
      return { trackingNumber: shipmentNumber, statuses: [] };
    }
  }

  async _getCPLTracking(shipmentNumber) {

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
   * Get tracking for PPL CZ domestic shipments via myAPI SOAP.
   * @param {string} packNumber - PPL domestic tracking number (707/457/407...)
   */
  async _getDomesticTracking(packNumber) {
    const soapUser = process.env.PPL_SOAP_USERNAME || 'Mroauto';
    const soapPass = process.env.PPL_SOAP_PASSWORD || '1993002';
    const soapCustId = process.env.PPL_SOAP_CUSTID || '1993002';

    const soap = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:v1="http://myapi.ppl.cz/v1" xmlns:arr="http://schemas.microsoft.com/2003/10/Serialization/Arrays">
  <soapenv:Body>
    <v1:GetPackages>
      <v1:Auth>
        <v1:CustId>${soapCustId}</v1:CustId>
        <v1:Password>${soapPass}</v1:Password>
        <v1:UserName>${soapUser}</v1:UserName>
      </v1:Auth>
      <v1:Filter>
        <v1:PackNumbers>
          <arr:string>${packNumber}</arr:string>
        </v1:PackNumbers>
      </v1:Filter>
    </v1:GetPackages>
  </soapenv:Body>
</soapenv:Envelope>`;

    const res = await axios.post('https://myapi.ppl.cz/MyAPI.svc', soap, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://myapi.ppl.cz/v1/IMyApi2/GetPackages',
      },
      timeout: 15000,
    });

    const xml = res.data;

    // Parse tracking events
    const statuses = [];
    const eventRegex = /<a:StatusInfo>([\s\S]*?)<\/a:StatusInfo>/g;
    let match;
    while ((match = eventRegex.exec(xml)) !== null) {
      const block = match[1];
      const get = (tag) => {
        const m = block.match(new RegExp(`<a:${tag}>([^<]*)<\\/a:${tag}>`));
        return m ? m[1] : null;
      };
      statuses.push({
        statusCode: get('ID') || get('Code') || null,
        description: get('Name') || get('Text') || get('Description') || '',
        date: get('Date') ? new Date(get('Date')).toISOString() : null,
        location: get('DepotName') || get('Location') || null,
      });
    }

    // If no StatusInfo, try PackageStatusInfo pattern
    if (statuses.length === 0) {
      const altRegex = /<a:PackStatusInfo>([\s\S]*?)<\/a:PackStatusInfo>/g;
      while ((match = altRegex.exec(xml)) !== null) {
        const block = match[1];
        const get = (tag) => {
          const m = block.match(new RegExp(`<a:${tag}>([^<]*)<\\/a:${tag}>`));
          return m ? m[1] : null;
        };
        statuses.push({
          statusCode: get('StatusCode') || get('ID') || null,
          description: get('StatusText') || get('Name') || '',
          date: get('Date') ? new Date(get('Date')).toISOString() : null,
          location: get('DepotName') || get('DepotCode') || null,
        });
      }
    }

    return {
      trackingNumber: packNumber,
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
