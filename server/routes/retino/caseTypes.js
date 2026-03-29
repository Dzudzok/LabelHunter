const express = require('express');
const router = express.Router();
const supabase = require('../../db/supabase');

// GET / — list all case types
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('case_types')
      .select('*')
      .order('sort_order');

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

// GET /active — only enabled types (for public portal)
router.get('/active', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('case_types')
      .select('id, code, name_cs, color, icon')
      .eq('enabled', true)
      .order('sort_order');

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

// POST / — create custom case type
router.post('/', async (req, res, next) => {
  try {
    const { code, nameCz, color, icon, enabled, sortOrder } = req.body;
    if (!code || !nameCz) return res.status(400).json({ error: 'code and nameCz required' });

    const { data, error } = await supabase
      .from('case_types')
      .insert({
        code, name_cs: nameCz, color: color || '#3B82F6',
        icon: icon || 'box', enabled: enabled !== false,
        is_system: false, sort_order: sortOrder || 99,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// PATCH /:id — update case type
router.patch('/:id', async (req, res, next) => {
  try {
    const { nameCz, color, icon, enabled, sortOrder } = req.body;
    const updates = {};
    if (nameCz !== undefined) updates.name_cs = nameCz;
    if (color !== undefined) updates.color = color;
    if (icon !== undefined) updates.icon = icon;
    if (enabled !== undefined) updates.enabled = enabled;
    if (sortOrder !== undefined) updates.sort_order = sortOrder;

    const { data, error } = await supabase
      .from('case_types')
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

// DELETE /:id — delete custom type (not system types)
router.delete('/:id', async (req, res, next) => {
  try {
    // Check if system type
    const { data: ct } = await supabase.from('case_types').select('is_system').eq('id', req.params.id).single();
    if (ct?.is_system) return res.status(400).json({ error: 'Cannot delete system type' });

    const { error } = await supabase.from('case_types').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
