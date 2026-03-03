const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');

// GET / - list all active workers
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('workers')
      .select('id, name, is_active, created_at')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST / - create new worker
router.post('/', async (req, res, next) => {
  try {
    const { name, pin } = req.body;
    if (!name || !pin) {
      return res.status(400).json({ error: 'Name and PIN are required' });
    }

    const { data, error } = await supabase
      .from('workers')
      .insert({ name, pin })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// PUT /:id - update worker
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, pin } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (pin !== undefined) updates.pin = pin;

    const { data, error } = await supabase
      .from('workers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// DELETE /:id - deactivate worker
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('workers')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /verify - verify worker PIN
router.post('/verify', async (req, res, next) => {
  try {
    const { workerId, pin } = req.body;
    if (!workerId || !pin) {
      return res.status(400).json({ error: 'workerId and pin are required' });
    }

    const { data, error } = await supabase
      .from('workers')
      .select('id, name, is_active')
      .eq('id', workerId)
      .eq('pin', pin)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
