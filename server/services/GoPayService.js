const axios = require('axios');

/**
 * GoPayService — OAuth2 REST API integration.
 * Zatím placeholder — podpojíme na konci.
 *
 * ENV:
 *   GOPAY_CLIENT_ID, GOPAY_CLIENT_SECRET, GOPAY_GOID
 *   GOPAY_BASE_URL (default: https://gw.sandbox.gopay.com/api)
 */
class GoPayService {
  constructor() {
    this.clientId = process.env.GOPAY_CLIENT_ID || '';
    this.clientSecret = process.env.GOPAY_CLIENT_SECRET || '';
    this.goId = process.env.GOPAY_GOID || '';
    this.baseUrl = process.env.GOPAY_BASE_URL || 'https://gw.sandbox.gopay.com/api';
    this._token = null;
    this._tokenExpiry = 0;
  }

  isConfigured() {
    return !!(this.clientId && this.clientSecret && this.goId);
  }

  /**
   * Get OAuth2 access token (cached).
   */
  async getToken() {
    if (this._token && Date.now() < this._tokenExpiry) return this._token;

    const res = await axios.post(`${this.baseUrl}/oauth2/token`, 'grant_type=client_credentials&scope=payment-create', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      auth: { username: this.clientId, password: this.clientSecret },
      timeout: 10000,
    });

    this._token = res.data.access_token;
    this._tokenExpiry = Date.now() + (res.data.expires_in - 60) * 1000;
    return this._token;
  }

  /**
   * Create a payment for return shipping label.
   * @param {object} params - { amount, currency, orderNumber, description, returnUrl, notifyUrl }
   * @returns {object} { paymentId, gatewayUrl }
   */
  async createPayment({ amount, currency = 'CZK', orderNumber, description, returnUrl, notifyUrl }) {
    if (!this.isConfigured()) throw new Error('GoPay not configured');

    const token = await this.getToken();

    const body = {
      payer: {
        default_payment_instrument: 'PAYMENT_CARD',
        allowed_payment_instruments: ['PAYMENT_CARD', 'BANK_ACCOUNT'],
      },
      amount: Math.round(amount * 100), // GoPay uses cents
      currency,
      order_number: orderNumber,
      order_description: description || 'Zpětný štítek',
      lang: 'CS',
      target: { type: 'ACCOUNT', goid: Number(this.goId) },
      callback: {
        return_url: returnUrl,
        notification_url: notifyUrl,
      },
    };

    const res = await axios.post(`${this.baseUrl}/payments/payment`, body, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    return {
      paymentId: String(res.data.id),
      gatewayUrl: res.data.gw_url,
      state: res.data.state,
    };
  }

  /**
   * Get payment status.
   */
  async getPaymentStatus(paymentId) {
    if (!this.isConfigured()) throw new Error('GoPay not configured');

    const token = await this.getToken();
    const res = await axios.get(`${this.baseUrl}/payments/payment/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 10000,
    });

    return {
      paymentId: String(res.data.id),
      state: res.data.state, // CREATED, PAYMENT_METHOD_CHOSEN, PAID, CANCELED, TIMEOUTED, REFUNDED
      amount: res.data.amount / 100,
      currency: res.data.currency,
    };
  }

  /**
   * Refund a payment (full or partial).
   */
  async refundPayment(paymentId, amount) {
    if (!this.isConfigured()) throw new Error('GoPay not configured');

    const token = await this.getToken();
    const res = await axios.post(
      `${this.baseUrl}/payments/payment/${paymentId}/refund`,
      `amount=${Math.round(amount * 100)}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 15000,
      }
    );

    return { result: res.data.result };
  }
}

module.exports = new GoPayService();
