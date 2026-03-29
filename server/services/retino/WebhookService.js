const axios = require('axios');
const crypto = require('crypto');
const supabase = require('../../db/supabase');

/**
 * WebhookService — fire webhooks for return events.
 */
class WebhookService {
  /**
   * Fire webhooks for a given event.
   * @param {string} event - return_created, status_changed, resolved, message
   * @param {object} payload - event data
   */
  async fire(event, payload) {
    try {
      const { data: endpoints } = await supabase
        .from('webhook_endpoints')
        .select('*')
        .eq('enabled', true)
        .contains('events', [event]);

      if (!endpoints?.length) return;

      for (const ep of endpoints) {
        this.sendWebhook(ep, event, payload);
      }
    } catch (err) {
      console.error('[Webhook] Error fetching endpoints:', err.message);
    }
  }

  async sendWebhook(endpoint, event, payload) {
    const start = Date.now();
    const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload });

    const headers = {
      'Content-Type': 'application/json',
      'X-Retino-Event': event,
    };

    // Sign payload if secret configured
    if (endpoint.secret) {
      const signature = crypto.createHmac('sha256', endpoint.secret).update(body).digest('hex');
      headers['X-Retino-Signature'] = signature;
    }

    try {
      const res = await axios.post(endpoint.url, body, {
        headers,
        timeout: 10000,
      });

      await supabase.from('webhook_log').insert({
        endpoint_id: endpoint.id,
        event,
        payload,
        status_code: res.status,
        response_body: typeof res.data === 'string' ? res.data.slice(0, 1000) : JSON.stringify(res.data).slice(0, 1000),
        duration_ms: Date.now() - start,
      });
    } catch (err) {
      await supabase.from('webhook_log').insert({
        endpoint_id: endpoint.id,
        event,
        payload,
        status_code: err.response?.status || null,
        error: err.message,
        duration_ms: Date.now() - start,
      });
      console.error(`[Webhook] ${endpoint.name} failed:`, err.message);
    }
  }
}

module.exports = new WebhookService();
