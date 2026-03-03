const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const emailService = require('../services/EmailService');

// POST /resend/:dnId - resend shipping confirmation email
router.post('/resend/:dnId', async (req, res, next) => {
  try {
    const { dnId } = req.params;

    // Get delivery note with items
    const { data: dn, error: dnError } = await supabase
      .from('delivery_notes')
      .select('*')
      .eq('id', dnId)
      .single();

    if (dnError || !dn) {
      return res.status(404).json({ error: 'Delivery note not found' });
    }

    if (!dn.tracking_token) {
      return res.status(400).json({ error: 'No tracking token - label must be generated first' });
    }

    const { data: items } = await supabase
      .from('delivery_note_items')
      .select('*')
      .eq('delivery_note_id', dn.id)
      .order('id');

    const dnWithItems = { ...dn, items: items || [] };
    await emailService.sendShipmentEmail(dnWithItems);

    // Update email_sent_at
    await supabase
      .from('delivery_notes')
      .update({ email_sent_at: new Date().toISOString() })
      .eq('id', dnId);

    res.json({ success: true, message: 'Email resent successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
