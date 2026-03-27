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
    this.username = process.env.GLS_USERNAME || 'pavel@mroauto.cz';
    this.password = process.env.GLS_PASSWORD || 'Mrozek120';
    this.clientNumber = process.env.GLS_CLIENT_NUMBER || '50018867';
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
