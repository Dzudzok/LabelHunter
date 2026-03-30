const crypto = require('crypto');
const axios = require('axios');

/**
 * GLS MyGLS API - direct carrier integration.
 * Docs: https://api.mygls.cz
 * Auth: Username + SHA512(password) as byte array
 */
class GLSService {
  constructor() {
    this.baseUrl = 'https://api.mygls.cz';
    this.username = process.env.GLS_USERNAME || '';
    this.password = process.env.GLS_PASSWORD || '';
    this.clientNumber = process.env.GLS_CLIENT_NUMBER || '';
  }

  _getPasswordHash() {
    return Array.from(
      crypto.createHash('sha512').update(this.password, 'utf8').digest()
    );
  }

  /**
   * Get tracking statuses for a single parcel.
   * @param {number|string} parcelNumber - GLS tracking number
   * @returns {object} { parcelNumber, statuses[], clientReference, weight, ... }
   */
  async getParcelStatuses(parcelNumber) {
    const res = await axios.post(
      `${this.baseUrl}/ParcelService.svc/json/GetParcelStatuses`,
      {
        Username: this.username,
        Password: this._getPasswordHash(),
        ParcelNumber: Number(parcelNumber),
        ReturnPOD: false,
        LanguageIsoCode: 'CZ',
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      }
    );

    const data = res.data;
    if (data.GetParcelStatusErrors?.length > 0) {
      const err = data.GetParcelStatusErrors[0];
      throw new Error(`GLS API Error ${err.ErrorCode}: ${err.ErrorDescription}`);
    }

    // Parse statuses
    const statuses = (data.ParcelStatusList || []).map((s) => ({
      statusCode: s.StatusCode,
      description: s.StatusDescription,
      date: this._parseDate(s.StatusDate),
      depotCity: s.DepotCity,
      depotNumber: s.DepotNumber,
    }));

    return {
      parcelNumber: data.ParcelNumber,
      clientReference: data.ClientReference,
      weight: data.Weight,
      deliveryCountryCode: data.DeliveryCountryCode,
      deliveryZipCode: data.DeliveryZipCode,
      statuses,
    };
  }

  /**
   * Get parcel list by date range.
   * @param {Date} from
   * @param {Date} to
   */
  async getParcelList(from, to) {
    const res = await axios.post(
      `${this.baseUrl}/ParcelService.svc/json/GetParcelList`,
      {
        Username: this.username,
        Password: this._getPasswordHash(),
        PickupDateFrom: this._toDateString(from),
        PickupDateTo: this._toDateString(to),
        PrintDateFrom: null,
        PrintDateTo: null,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      }
    );
    return res.data;
  }

  /**
   * Create parcel and get label PDF via PrintLabels endpoint.
   * @param {object} opts - { senderName, senderStreet, senderCity, senderZip, senderCountry, senderPhone, senderEmail,
   *                          recipientName, recipientStreet, recipientCity, recipientZip, recipientCountry, recipientPhone, recipientEmail,
   *                          reference, weight, count }
   * @returns {object} { parcelId, parcelNumber, labels (base64 PDF) }
   */
  async printLabels(opts) {
    const parcel = {
      ClientNumber: parseInt(this.clientNumber),
      ClientReference: opts.reference || '',
      Count: opts.count || 1,
      DeliveryAddress: {
        ContactEmail: opts.recipientEmail || '',
        ContactName: opts.recipientName || '',
        ContactPhone: opts.recipientPhone || '',
        Name: opts.recipientName || '',
        Street: opts.recipientStreet || '',
        City: opts.recipientCity || '',
        ZipCode: String(opts.recipientZip || '').replace(/\s/g, ''),
        CountryIsoCode: opts.recipientCountry || 'CZ',
      },
      PickupAddress: {
        ContactEmail: opts.senderEmail || '',
        ContactName: opts.senderName || '',
        ContactPhone: opts.senderPhone || '',
        Name: opts.senderName || '',
        Street: opts.senderStreet || '',
        City: opts.senderCity || '',
        ZipCode: String(opts.senderZip || '').replace(/\s/g, ''),
        CountryIsoCode: opts.senderCountry || 'CZ',
      },
      ServiceList: [],
    };

    const requestBody = {
      Username: this.username,
      Password: this._getPasswordHash(),
      ParcelList: [parcel],
      PrintPosition: 1,
      ShowPrintDialog: false,
    };

    console.log('[GLS] PrintLabels request:', JSON.stringify(requestBody).substring(0, 500));

    const res = await axios.post(
      `${this.baseUrl}/ParcelService.svc/json/PrintLabels`,
      requestBody,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      }
    );

    const data = res.data;

    // Check errors
    if (data.PrintLabelsErrorList?.length > 0) {
      const errs = data.PrintLabelsErrorList.map(e =>
        (e.ErrorDescriptionList || []).map(d => `${d.ErrorCode}: ${d.ErrorDescription}`).join('; ')
      ).join(' | ');
      throw new Error(`GLS PrintLabels error: ${errs}`);
    }

    // Extract parcel info
    const printed = data.PrintLabelsInfoList?.[0];
    const parcelId = printed?.ParcelId || null;
    const parcelNumber = printed?.ParcelNumber || null;

    return {
      parcelId,
      parcelNumber,
      labels: data.Labels || null, // base64 PDF
    };
  }

  /**
   * Parse GLS date format: "/Date(1774252163000+0100)/"
   */
  _parseDate(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/\/Date\((\d+)([+-]\d{4})?\)\//);
    if (match) {
      return new Date(parseInt(match[1])).toISOString();
    }
    return null;
  }

  _toDateString(date) {
    return `/Date(${date.getTime()})/`;
  }
}

module.exports = new GLSService();
