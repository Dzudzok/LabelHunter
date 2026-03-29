const express = require('express');
const router = express.Router();
const supabase = require('../../db/supabase');

// GET / — list webhook endpoints
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

// POST / — create webhook endpoint
router.post('/', async (req, res, next) => {
  try {
    const { name, url, secret, events, enabled } = req.body;
    if (!name || !url) return res.status(400).json({ error: 'name and url required' });
    try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }

    const { data, error } = await supabase
      .from('webhook_endpoints')
      .insert({
        name, url, secret: secret || null,
        events: events || ['return_created'],
        enabled: enabled !== false,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// PATCH /:id — update endpoint
router.patch('/:id', async (req, res, next) => {
  try {
    const updates = {};
    const { name, url, secret, events, enabled } = req.body;
    if (name !== undefined) updates.name = name;
    if (url !== undefined) updates.url = url;
    if (secret !== undefined) updates.secret = secret;
    if (events !== undefined) updates.events = events;
    if (enabled !== undefined) updates.enabled = enabled;

    const { data, error } = await supabase
      .from('webhook_endpoints')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// DELETE /:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { error } = await supabase.from('webhook_endpoints').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /log — recent webhook logs
router.get('/log', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('webhook_log')
      .select('*, webhook_endpoints(name)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

// POST /:id/test — send test webhook
router.post('/:id/test', async (req, res, next) => {
  try {
    const { data: ep } = await supabase.from('webhook_endpoints').select('*').eq('id', req.params.id).single();
    if (!ep) return res.status(404).json({ error: 'Endpoint not found' });

    const webhookService = require('../../services/retino/WebhookService');
    await webhookService.sendWebhook(ep, 'test', { message: 'Test webhook from Retino', timestamp: new Date().toISOString() });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
