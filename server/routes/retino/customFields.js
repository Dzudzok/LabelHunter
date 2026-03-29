const express = require('express');
const router = express.Router();
const supabase = require('../../db/supabase');

// GET / — list all field definitions
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('custom_field_definitions')
      .select('*')
      .order('sort_order');

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

// GET /active — only active fields (for forms)
router.get('/active', async (req, res, next) => {
  try {
    const { type } = req.query;
    let query = supabase
      .from('custom_field_definitions')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    const { data, error } = await query;
    if (error) throw error;

    let fields = data || [];
    if (type) {
      fields = fields.filter(f => f.applies_to?.includes(type));
    }

    res.json(fields);
  } catch (err) {
    next(err);
  }
});

// POST / — create field definition
router.post('/', async (req, res, next) => {
  try {
    const { code, labelCs, fieldType, options, required, appliesTo, sortOrder } = req.body;
    if (!code || !labelCs) return res.status(400).json({ error: 'code and labelCs required' });

    const { data, error } = await supabase
      .from('custom_field_definitions')
      .insert({
        code, label_cs: labelCs, field_type: fieldType || 'text',
        options: options || [], required: required || false,
        applies_to: appliesTo || ['return'], sort_order: sortOrder || 99,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// PATCH /:id — update field
router.patch('/:id', async (req, res, next) => {
  try {
    const updates = {};
    const { labelCs, fieldType, options, required, appliesTo, sortOrder, isActive } = req.body;
    if (labelCs !== undefined) updates.label_cs = labelCs;
    if (fieldType !== undefined) updates.field_type = fieldType;
    if (options !== undefined) updates.options = options;
    if (required !== undefined) updates.required = required;
    if (appliesTo !== undefined) updates.applies_to = appliesTo;
    if (sortOrder !== undefined) updates.sort_order = sortOrder;
    if (isActive !== undefined) updates.is_active = isActive;

    const { data, error } = await supabase
      .from('custom_field_definitions')
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
    const { error } = await supabase.from('custom_field_definitions').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /values/:returnId — get custom field values for a return
router.get('/values/:returnId', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('custom_field_values')
      .select('*, custom_field_definitions(code, label_cs, field_type)')
      .eq('return_id', req.params.returnId);

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

// POST /values/:returnId — save custom field values for a return
router.post('/values/:returnId', async (req, res, next) => {
  try {
    const returnId = parseInt(req.params.returnId, 10);
    const { values } = req.body; // [{ fieldId, value }]

    if (!values?.length) return res.status(400).json({ error: 'values array required' });

    const rows = values.map(v => ({
      return_id: returnId,
      field_id: v.fieldId,
      value: String(v.value ?? ''),
    }));

    // Upsert
    const { data, error } = await supabase
      .from('custom_field_values')
      .upsert(rows, { onConflict: 'return_id,field_id' })
      .select();

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
