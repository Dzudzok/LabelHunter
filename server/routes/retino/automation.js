const express = require('express');
const router = express.Router();
const supabase = require('../../db/supabase');

const VALID_TRIGGER_TYPES = ['status_change', 'days_no_update', 'days_on_branch', 'days_until_expiry'];
const VALID_ACTION_TYPES = ['send_email', 'add_tag', 'remove_tag', 'webhook'];

// GET /rules — list all automation rules
router.get('/rules', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('automation_rules')
      .select('*')
      .order('created_at');

    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

// POST /rules — create automation rule
router.post('/rules', async (req, res, next) => {
  try {
    const { name, trigger_type, trigger_config, conditions, actions, enabled } = req.body;

    if (!name || !trigger_type || !actions) {
      return res.status(400).json({ error: 'Missing required fields: name, trigger_type, actions' });
    }

    if (!VALID_TRIGGER_TYPES.includes(trigger_type)) {
      return res.status(400).json({ error: `Invalid trigger_type. Must be one of: ${VALID_TRIGGER_TYPES.join(', ')}` });
    }

    if (!Array.isArray(actions) || actions.length === 0) {
      return res.status(400).json({ error: 'actions must be a non-empty array' });
    }

    for (const action of actions) {
      if (!action.type || !VALID_ACTION_TYPES.includes(action.type)) {
        return res.status(400).json({ error: `Invalid action type. Must be one of: ${VALID_ACTION_TYPES.join(', ')}` });
      }
    }

    const { data, error } = await supabase
      .from('automation_rules')
      .insert({
        name,
        trigger_type,
        trigger_config: trigger_config || {},
        conditions: conditions || {},
        actions,
        enabled: enabled !== undefined ? enabled : true,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// PATCH /rules/:id — update automation rule
router.patch('/rules/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, trigger_type, trigger_config, conditions, actions, enabled } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (trigger_type !== undefined) {
      if (!VALID_TRIGGER_TYPES.includes(trigger_type)) {
        return res.status(400).json({ error: `Invalid trigger_type. Must be one of: ${VALID_TRIGGER_TYPES.join(', ')}` });
      }
      updates.trigger_type = trigger_type;
    }
    if (trigger_config !== undefined) updates.trigger_config = trigger_config;
    if (conditions !== undefined) updates.conditions = conditions;
    if (actions !== undefined) {
      if (!Array.isArray(actions) || actions.length === 0) {
        return res.status(400).json({ error: 'actions must be a non-empty array' });
      }
      for (const action of actions) {
        if (!action.type || !VALID_ACTION_TYPES.includes(action.type)) {
          return res.status(400).json({ error: `Invalid action type. Must be one of: ${VALID_ACTION_TYPES.join(', ')}` });
        }
      }
      updates.actions = actions;
    }
    if (enabled !== undefined) updates.enabled = enabled;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const { data, error } = await supabase
      .from('automation_rules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Rule not found' });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// DELETE /rules/:id — delete automation rule
router.delete('/rules/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('automation_rules')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /rules/:id/toggle — toggle enabled/disabled
router.post('/rules/:id/toggle', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Fetch current state
    const { data: rule, error: fetchErr } = await supabase
      .from('automation_rules')
      .select('id, enabled')
      .eq('id', id)
      .single();

    if (fetchErr || !rule) return res.status(404).json({ error: 'Rule not found' });

    // Toggle
    const { data, error } = await supabase
      .from('automation_rules')
      .update({ enabled: !rule.enabled })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
