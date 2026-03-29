const express = require('express');
const router = express.Router();
const supabase = require('../../db/supabase');

// ── Tags CRUD ───────────────────────────────────────────────

// GET / — list all tags
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('shipment_tags')
      .select('*');

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

// POST / — create tag
router.post('/', async (req, res, next) => {
  try {
    const { name, color, bg_color } = req.body;

    const { data, error } = await supabase
      .from('shipment_tags')
      .insert({ name, color, bg_color })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// DELETE /:id — delete tag by UUID
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('shipment_tags')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── Shipment Tags ───────────────────────────────────────────

// GET /shipment/:deliveryNoteId — get tags for a shipment
router.get('/shipment/:deliveryNoteId', async (req, res, next) => {
  try {
    const { deliveryNoteId } = req.params;

    const { data, error } = await supabase
      .from('delivery_note_tags')
      .select('*, shipment_tags(*)')
      .eq('delivery_note_id', deliveryNoteId);

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

// POST /shipment/:deliveryNoteId — add tag to shipment
router.post('/shipment/:deliveryNoteId', async (req, res, next) => {
  try {
    const { deliveryNoteId } = req.params;
    const { tag_id, added_by } = req.body;

    const { data, error } = await supabase
      .from('delivery_note_tags')
      .insert({ delivery_note_id: deliveryNoteId, tag_id, added_by })
      .select('*, shipment_tags(*)')
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// DELETE /shipment/:deliveryNoteId/:tagId — remove tag from shipment
router.delete('/shipment/:deliveryNoteId/:tagId', async (req, res, next) => {
  try {
    const { deliveryNoteId, tagId } = req.params;

    const { error } = await supabase
      .from('delivery_note_tags')
      .delete()
      .eq('delivery_note_id', deliveryNoteId)
      .eq('tag_id', tagId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── Shipment Notes ──────────────────────────────────────────

// GET /notes/:deliveryNoteId — get notes for a shipment
router.get('/notes/:deliveryNoteId', async (req, res, next) => {
  try {
    const { deliveryNoteId } = req.params;

    const { data, error } = await supabase
      .from('shipment_notes')
      .select('*')
      .eq('delivery_note_id', deliveryNoteId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

// POST /notes/:deliveryNoteId — create note
router.post('/notes/:deliveryNoteId', async (req, res, next) => {
  try {
    const { deliveryNoteId } = req.params;
    const { author, content, is_internal } = req.body;

    const { data, error } = await supabase
      .from('shipment_notes')
      .insert({ delivery_note_id: deliveryNoteId, author, content, is_internal })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// ── Email Log ───────────────────────────────────────────────

// GET /emails/:deliveryNoteId — get email log for a shipment
router.get('/emails/:deliveryNoteId', async (req, res, next) => {
  try {
    const { deliveryNoteId } = req.params;

    const { data, error } = await supabase
      .from('email_log')
      .select('*')
      .eq('delivery_note_id', deliveryNoteId)
      .order('sent_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
