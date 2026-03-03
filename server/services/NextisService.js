const axios = require('axios');

class NextisService {
  constructor() {
    this.baseUrl = process.env.NEXTIS_URL_API;
    this.token = process.env.NEXTIS_TOKEN_ADMIN;
  }

  trimObject(obj) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return obj.trim();
    if (Array.isArray(obj)) return obj.map(item => this.trimObject(item));
    if (typeof obj === 'object') {
      const trimmed = {};
      for (const [key, value] of Object.entries(obj)) {
        trimmed[key] = this.trimObject(value);
      }
      return trimmed;
    }
    return obj;
  }

  async getDeliveryNotes(dateFrom, dateTo) {
    const response = await axios.post(
      `${this.baseUrl}/documents/deliverynotes`,
      {
        token: this.token,
        tokenIsMaster: true,
        language: 'cs',
        loadAll: true,
        dateFrom,
        dateTo,
      },
      { timeout: 60000 }
    );
    return this.trimObject(response.data);
  }

  async getInvoicePdf(documentNumber) {
    const response = await axios.post(`${this.baseUrl}/documents/invoice-file`, {
      token: this.token,
      tokenIsMaster: true,
      documentNumber,
    });
    return response.data;
  }
}

module.exports = new NextisService();
