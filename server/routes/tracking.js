const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const labelPrinterService = require('../services/LabelPrinterService');
const emailService = require('../services/EmailService');

// GET /public/:token - get delivery note by tracking token (public)
router.get('/public/:token', async (req, res, next) => {
  try {
    const { token } = req.params;

    const { data: dn, error: dnError } = await supabase
      .from('delivery_notes')
      .select('id, doc_number, invoice_number, order_number, date_issued, customer_name, transport_name, status, shipper_code, tracking_number, tracking_url, lp_shipment_id, label_generated_at, delivery_city, delivery_country')
      .eq('tracking_token', token)
      .single();

    if (dnError || !dn) {
      return res.status(404).json({ error: 'Tracking not found' });
    }

    // Get items
    const { data: items } = await supabase
      .from('delivery_note_items')
      .select('code, text, qty, item_type')
      .eq('delivery_note_id', dn.id)
      .eq('item_type', 'goods')
      .order('id');

    // Get latest tracking from LP API if shipment exists
    let trackingData = null;
    if (dn.lp_shipment_id) {
      try {
        trackingData = await labelPrinterService.getTracking(dn.lp_shipment_id);
      } catch (trackErr) {
        console.error('Error fetching LP tracking:', trackErr.message);
      }
    }

    res.json({
      package: dn,
      items: items || [],
      tracking: trackingData,
    });
  } catch (err) {
    next(err);
  }
});

// POST /public/:token/message - save customer message
router.post('/public/:token/message', async (req, res, next) => {
  try {
    const { token } = req.params;
    const { email, message } = req.body;

    if (!email || !message) {
      return res.status(400).json({ error: 'Email and message are required' });
    }

    // Find delivery note
    const { data: dn, error: dnError } = await supabase
      .from('delivery_notes')
      .select('*')
      .eq('tracking_token', token)
      .single();

    if (dnError || !dn) {
      return res.status(404).json({ error: 'Tracking not found' });
    }

    // Save message to DB
    const { error: msgError } = await supabase
      .from('customer_messages')
      .insert({
        delivery_note_id: dn.id,
        customer_email: email,
        message,
      });

    if (msgError) throw msgError;

    // Send email in background (don't block response)
    emailService.sendContactFormEmail(dn, email, message)
      .catch(emailErr => console.error('Failed to send contact form email:', emailErr.message));

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
