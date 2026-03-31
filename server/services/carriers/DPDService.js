const axios = require('axios');

/**
 * DPD CZ GeoAPI v1 (SOAP).
 * Endpoint: https://reg-prijemce.dpd.cz/GeoAPI_v1_4_0/GeoAPI.svc
 * Auth: login + password in SOAP body
 *
 * Env vars: DPD_USERNAME, DPD_PASSWORD
 */
class DPDService {
  constructor() {
    this.baseUrl = 'https://reg-prijemce.dpd.cz/GeoAPI_v1_4_0/GeoAPI.svc';
    this.username = process.env.DPD_USERNAME || '';
    this.password = process.env.DPD_PASSWORD || '';
  }

  isConfigured() {
    return !!(this.username && this.password);
  }

  async _soapCall(action, bodyXml) {
    const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/" xmlns:arr="http://schemas.microsoft.com/2003/10/Serialization/Arrays">
  <soap:Body>
    ${bodyXml}
  </soap:Body>
</soap:Envelope>`;

    const res = await axios.post(this.baseUrl, envelope, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': `http://tempuri.org/IGeoAPI/${action}`,
      },
      timeout: 15000,
    });

    return res.data;
  }

  /**
   * Get tracking for parcels.
   * @param {string} parcelNumber - DPD parcel number
   * @returns {object} { trackingNumber, statuses[] }
   */
  async getParcelStatuses(parcelNumber) {
    if (!this.isConfigured()) {
      throw new Error('DPD API not configured (DPD_USERNAME/DPD_PASSWORD missing)');
    }

    const xml = await this._soapCall('GetTrackingByParcelno', `
    <tem:GetTrackingByParcelno>
      <tem:login>${this.username}</tem:login>
      <tem:password>${this.password}</tem:password>
      <tem:parcelno>
        <arr:string>${parcelNumber}</arr:string>
      </tem:parcelno>
    </tem:GetTrackingByParcelno>`);

    // Parse tracking events from SOAP XML
    // DPD GeoAPI fields: SCANCODE, SCANTEXT, SCANDATETIME, DEPOT, RNAME
    const events = [];
    const regex = /<a:TrackingDetailVO>([\s\S]*?)<\/a:TrackingDetailVO>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      const block = match[1];
      const get = (tag) => {
        const m = block.match(new RegExp(`<a:${tag}>([^<]*)<\\/a:${tag}>`));
        return m ? m[1]?.trim() : null;
      };

      const scanText = get('SCANTEXT') || '';
      const scanCode = get('SCANCODE') || '';
      const scanDate = get('SCANDATETIME') || '';
      const depot = get('DEPOT') || '';

      if (!scanText && !scanCode) continue;

      events.push({
        statusCode: scanCode,
        description: scanText,
        date: scanDate || null,
        location: depot || null,
      });
    }

    return {
      trackingNumber: parcelNumber,
      statuses: events,
    };
  }
}

module.exports = new DPDService();
