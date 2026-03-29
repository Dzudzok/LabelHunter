const supabase = require('../db/supabase');
const trackingEmailService = require('./TrackingEmailService');

class AutomationEngine {
  /**
   * Called by TrackingSyncService when a shipment's unified_status changes.
   */
  async processStatusChange(deliveryNote, newStatus, oldStatus) {
    try {
      const { data: rules, error } = await supabase
        .from('automation_rules')
        .select('*')
        .eq('enabled', true)
        .eq('trigger_type', 'status_change');

      if (error) {
        console.error('[AutomationEngine] Failed to fetch status_change rules:', error.message);
        return;
      }

      for (const rule of (rules || [])) {
        try {
          if (rule.trigger_config?.status !== newStatus) continue;
          if (!this._checkConditions(rule.conditions, deliveryNote)) continue;

          await this._executeActions(rule, deliveryNote);
        } catch (err) {
          console.error(`[AutomationEngine] Error processing rule "${rule.name}":`, err.message);
        }
      }
    } catch (err) {
      console.error('[AutomationEngine] processStatusChange error:', err.message);
    }
  }

  /**
   * Called by a cron job. Evaluates time-based rules against matching shipments.
   */
  async runScheduledChecks() {
    try {
      const { data: rules, error } = await supabase
        .from('automation_rules')
        .select('*')
        .eq('enabled', true)
        .in('trigger_type', ['days_no_update', 'days_on_branch', 'days_until_expiry']);

      if (error) {
        console.error('[AutomationEngine] Failed to fetch scheduled rules:', error.message);
        return;
      }

      for (const rule of (rules || [])) {
        try {
          const shipments = await this._findMatchingShipments(rule);
          for (const dn of shipments) {
            if (!this._checkConditions(rule.conditions, dn)) continue;
            await this._executeActions(rule, dn);
          }
        } catch (err) {
          console.error(`[AutomationEngine] Error processing scheduled rule "${rule.name}":`, err.message);
        }
      }
    } catch (err) {
      console.error('[AutomationEngine] runScheduledChecks error:', err.message);
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────

  /**
   * Find shipments matching a time-based rule trigger.
   */
  async _findMatchingShipments(rule) {
    const days = rule.trigger_config?.days || 0;
    const now = new Date();

    if (rule.trigger_type === 'days_no_update') {
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('delivery_notes')
        .select('*')
        .lt('last_tracking_update', cutoff)
        .not('unified_status', 'in', '("delivered","returned_to_sender")');

      if (error) {
        console.error('[AutomationEngine] days_no_update query error:', error.message);
        return [];
      }
      return data || [];
    }

    if (rule.trigger_type === 'days_on_branch') {
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('delivery_notes')
        .select('*')
        .eq('unified_status', 'available_for_pickup')
        .lt('pickup_at', cutoff);

      if (error) {
        console.error('[AutomationEngine] days_on_branch query error:', error.message);
        return [];
      }
      return data || [];
    }

    if (rule.trigger_type === 'days_until_expiry') {
      const deadline = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('delivery_notes')
        .select('*')
        .gt('stored_until', now.toISOString())
        .lte('stored_until', deadline);

      if (error) {
        console.error('[AutomationEngine] days_until_expiry query error:', error.message);
        return [];
      }
      return data || [];
    }

    return [];
  }

  /**
   * Check whether a delivery note satisfies the rule's conditions.
   */
  _checkConditions(conditions, deliveryNote) {
    if (!conditions || typeof conditions !== 'object') return true;

    for (const [key, value] of Object.entries(conditions)) {
      if (deliveryNote[key] !== value) return false;
    }
    return true;
  }

  /**
   * Execute all actions defined in a rule against a single delivery note.
   */
  async _executeActions(rule, deliveryNote) {
    for (const action of (rule.actions || [])) {
      try {
        console.log(`[AutomationEngine] Rule "${rule.name}" → action "${action.type}" on DN: ${deliveryNote.doc_number}`);

        switch (action.type) {
          case 'add_tag':
            await this._addTag(deliveryNote, action.config);
            break;
          case 'remove_tag':
            await this._removeTag(deliveryNote, action.config);
            break;
          case 'send_email':
            await this._sendEmail(deliveryNote, action.config);
            break;
          case 'webhook':
            await this._callWebhook(deliveryNote, action.config);
            break;
          default:
            console.warn(`[AutomationEngine] Unknown action type: ${action.type}`);
        }
      } catch (err) {
        console.error(`[AutomationEngine] Action "${action.type}" failed for DN ${deliveryNote.doc_number}:`, err.message);
      }
    }
  }

  // ─── Action executors ───────────────────────────────────────────────

  async _addTag(deliveryNote, config) {
    const { data: tag, error: tagErr } = await supabase
      .from('shipment_tags')
      .select('id')
      .eq('name', config.tag_name)
      .single();

    if (tagErr || !tag) {
      console.warn(`[AutomationEngine] Tag "${config.tag_name}" not found`);
      return;
    }

    // Skip if already exists
    const { data: existing } = await supabase
      .from('delivery_note_tags')
      .select('id')
      .eq('delivery_note_id', deliveryNote.id)
      .eq('tag_id', tag.id)
      .single();

    if (existing) return;

    const { error } = await supabase
      .from('delivery_note_tags')
      .insert({ delivery_note_id: deliveryNote.id, tag_id: tag.id });

    if (error) {
      console.error(`[AutomationEngine] Failed to add tag "${config.tag_name}":`, error.message);
    }
  }

  async _removeTag(deliveryNote, config) {
    const { data: tag, error: tagErr } = await supabase
      .from('shipment_tags')
      .select('id')
      .eq('name', config.tag_name)
      .single();

    if (tagErr || !tag) {
      console.warn(`[AutomationEngine] Tag "${config.tag_name}" not found`);
      return;
    }

    const { error } = await supabase
      .from('delivery_note_tags')
      .delete()
      .eq('delivery_note_id', deliveryNote.id)
      .eq('tag_id', tag.id);

    if (error) {
      console.error(`[AutomationEngine] Failed to remove tag "${config.tag_name}":`, error.message);
    }
  }

  async _sendEmail(deliveryNote, config) {
    const method = config.email_type;
    if (typeof trackingEmailService[method] === 'function') {
      await trackingEmailService[method](deliveryNote);
    } else {
      console.warn(`[AutomationEngine] Unknown email_type: ${method}`);
    }
  }

  async _callWebhook(deliveryNote, config) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (config.secret) {
        headers['X-Retino-Secret'] = config.secret;
      }

      const res = await fetch(config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(deliveryNote),
        signal: controller.signal,
      });

      console.log(`[AutomationEngine] Webhook ${config.url} responded with status ${res.status}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}

module.exports = new AutomationEngine();
