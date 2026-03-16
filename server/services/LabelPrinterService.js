const axios = require('axios');
const qs = require('qs');

class LabelPrinterService {
  constructor() {
    this.baseUrl = process.env.LP_BASE_URL;
    this.clientId = process.env.LP_CLIENT_ID;
    this.clientSecret = process.env.LP_CLIENT_SECRET;
    this.scope = process.env.LP_SCOPE;
    this.token = null;
    this.tokenExpiry = null;
  }

  async getToken() {
    // Return cached token if valid and more than 5 min remaining
    if (this.token && this.tokenExpiry && (this.tokenExpiry - Date.now() > 5 * 60 * 1000)) {
      return this.token;
    }

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await axios.post(
      `${this.baseUrl}/connect/token`,
      qs.stringify({ grant_type: 'client_credentials', scope: this.scope }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
        timeout: 30000,
      }
    );

    this.token = response.data.access_token;
    this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);

    return this.token;
  }

  async get(path) {
    const token = await this.getToken();
    const response = await axios.get(`${this.baseUrl}${path}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 30000,
    });
    return response.data;
  }

  async post(path, data) {
    const token = await this.getToken();
    try {
      const response = await axios.post(`${this.baseUrl}${path}`, data, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 60000,
      });
      return response.data;
    } catch (err) {
      if (err.response) {
        console.error(`[LP API] POST ${path} → ${err.response.status}:`, JSON.stringify(err.response.data));
      }
      throw err;
    }
  }

  async delete(path) {
    const token = await this.getToken();
    const response = await axios.delete(`${this.baseUrl}${path}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.data || {};
  }

  async getShippers() {
    return this.get('/shippers');
  }

  async createShipment(data) {
    return this.post('/shipments', data);
  }

  async getTracking(shipmentId) {
    return this.get(`/tracking/${shipmentId}`);
  }

  async searchShipments(params) {
    return this.post('/shipments/search', params);
  }

  async deleteShipment(id) {
    return this.delete(`/shipments/${id}`);
  }

  async getShipment(id) {
    return this.get(`/shipments/${id}`);
  }

  async getGoodsCheckings(shipmentId) {
    return this.get(`/goodscheckings/${shipmentId}`);
  }
}

module.exports = new LabelPrinterService();
