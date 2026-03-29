const express = require('express');
const router = express.Router();
const supabase = require('../../db/supabase');
const { getUnifiedStatus, getStatusLabel } = require('../../services/retino/tracking-status-mapper');
const { getStatusLabel: getReturnStatusLabel } = require('../../services/retino/return-workflow');
const multer = require('multer');
const crypto = require('crypto');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

// POST /verify — verify order by doc_number + email → return items
router.post('/verify', async (req, res, next) => {
  try {
    const { docNumber, email } = req.body;
    if (!docNumber || !email) {
      return res.status(400).json({ error: 'docNumber and email are required' });
    }

    const searchVal = String(docNumber).trim().slice(0, 50);

    // Search by exact match first, then case-insensitive partial match
    let note = null;

    // 1) Exact match on invoice_number, doc_number, or order_number
    const { data: exactMatch } = await supabase
      .from('delivery_notes')
      .select('id, doc_number, invoice_number, order_number, date_issued, customer_name, customer_email, shipper_code, unified_status')
      .or(`invoice_number.eq.${searchVal},doc_number.eq.${searchVal},order_number.eq.${searchVal}`)
      .limit(1)
      .maybeSingle();

    if (exactMatch) {
      note = exactMatch;
    } else {
      // 2) Case-insensitive partial match (handles prefixes, trailing spaces, etc.)
      const { data: fuzzyMatch } = await supabase
        .from('delivery_notes')
        .select('id, doc_number, invoice_number, order_number, date_issued, customer_name, customer_email, shipper_code, unified_status')
        .or(`invoice_number.ilike.%${searchVal}%,doc_number.ilike.%${searchVal}%,order_number.ilike.%${searchVal}%`)
        .limit(1)
        .maybeSingle();

      if (fuzzyMatch) {
        note = fuzzyMatch;
      }
    }

    if (!note) {
      return res.status(404).json({ error: 'Objednávka nenalezena' });
    }

    // Verify email matches (case-insensitive)
    const noteEmail = (note.customer_email || '').toLowerCase().trim();
    const inputEmail = email.toLowerCase().trim();
    if (noteEmail !== inputEmail) {
      return res.status(403).json({ error: 'E-mail neodpovídá objednávce' });
    }

    // Fetch items (only goods)
    const { data: items } = await supabase
      .from('delivery_note_items')
      .select('id, code, brand, text, qty, price_unit_inc_vat, item_type')
      .eq('delivery_note_id', note.id)
      .eq('item_type', 'goods')
      .order('id');

    res.json({
      deliveryNote: note,
      items: items || [],
    });
  } catch (err) {
    next(err);
  }
});

// GET /case-types — active case types for public form
router.get('/case-types', async (req, res, next) => {
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

// GET /reasons — active return reasons
router.get('/reasons', async (req, res, next) => {
  try {
    const { type } = req.query;
    let query = supabase
      .from('return_reasons')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    const { data, error } = await query;
    if (error) throw error;

    // Filter by type if provided
    let reasons = data || [];
    if (type) {
      reasons = reasons.filter(r => r.applies_to && r.applies_to.includes(type));
    }

    res.json(reasons);
  } catch (err) {
    next(err);
  }
});

// POST /create — create a return request
router.post('/create', async (req, res, next) => {
  try {
    const {
      deliveryNoteId, type = 'return', reasonCode, reasonDetail,
      vehicleInfo, wasMounted, customerName, customerEmail, customerPhone,
      items, // array of { deliveryNoteItemId, qtyReturned, condition, itemNote, images }
      shippingMethod, shippingData, // transport zwrotny
    } = req.body;

    if (!deliveryNoteId || !reasonCode || !items || items.length === 0) {
      return res.status(400).json({ error: 'deliveryNoteId, reasonCode and items are required' });
    }

    // Verify delivery note exists
    const { data: note } = await supabase
      .from('delivery_notes')
      .select('id, customer_email')
      .eq('id', deliveryNoteId)
      .single();

    if (!note) return res.status(404).json({ error: 'Objednávka nenalezena' });

    // Generate return number: RET-YYYY-XXXXX
    const year = new Date().getFullYear();
    const { data: seqData } = await supabase.rpc('nextval', { seq_name: 'return_number_seq' }).single();
    // Fallback: count existing returns
    let seqNum;
    if (seqData) {
      seqNum = seqData;
    } else {
      const { count } = await supabase.from('returns').select('id', { count: 'exact', head: true });
      seqNum = (count || 0) + 1;
    }
    const returnNumber = `RET-${year}-${String(seqNum).padStart(5, '0')}`;

    // Insert return
    const { data: ret, error: retErr } = await supabase
      .from('returns')
      .insert({
        delivery_note_id: deliveryNoteId,
        return_number: returnNumber,
        type,
        reason_code: reasonCode,
        reason_detail: reasonDetail || null,
        vehicle_info: vehicleInfo || null,
        was_mounted: wasMounted || false,
        customer_name: customerName || null,
        customer_email: customerEmail || note.customer_email || null,
        customer_phone: customerPhone || null,
        status: 'new',
        created_by_type: 'customer',
      })
      .select()
      .single();

    if (retErr) throw retErr;

    // Insert return items
    const returnItems = items.map(item => ({
      return_id: ret.id,
      delivery_note_item_id: item.deliveryNoteItemId || null,
      qty_returned: item.qtyReturned || 1,
      condition: item.condition || 'unopened',
      item_note: item.itemNote || null,
      images: item.images || [],
    }));

    const { error: itemsErr } = await supabase.from('return_items').insert(returnItems);
    if (itemsErr) throw itemsErr;

    // Insert initial status log
    await supabase.from('return_status_log').insert({
      return_id: ret.id,
      previous_status: null,
      new_status: 'new',
      change_source: 'customer',
      note: 'Žádost vytvořena zákazníkem',
    });

    // Create return shipment if shipping method provided
    let shipmentInfo = null;
    if (shippingMethod && shippingMethod !== 'none') {
      try {
        const returnShippingService = require('../../services/retino/ReturnShippingService');
        const carrier = shippingData?.carrier || (shippingMethod === 'self_ship' ? 'self' : 'zasilkovna');
        const shipment = await returnShippingService.createShipment({
          returnId: ret.id,
          carrier,
          shippingMethod,
          pickupPoint: shippingData?.pickupPoint || null,
          customerAddress: shippingData?.customerAddress || null,
          notes: shippingData?.notes || null,
        });

        // Update cost
        const cost = returnShippingService.getShippingCost(carrier, shippingMethod);
        if (cost > 0) {
          await supabase
            .from('return_shipments')
            .update({ cost })
            .eq('id', shipment.id);
        }

        shipmentInfo = {
          id: shipment.id,
          carrier,
          shippingMethod,
          trackingNumber: shipment.tracking_number || null,
          labelUrl: shipment.label_url || null,
          cost,
        };
      } catch (shipErr) {
        console.error('[Returns] Shipment creation error:', shipErr.message);
        // Non-critical — return still created
      }
    }

    // Trigger email: return_created
    try {
      const emailService = require('../../services/retino/ReturnEmailService');
      await emailService.enqueueEmail('return_created', ret);
    } catch (emailErr) {
      console.error('[Returns] Email trigger error:', emailErr.message);
    }

    // Trigger webhooks
    try {
      const webhookService = require('../../services/retino/WebhookService');
      webhookService.fire('return_created', { return_id: ret.id, return_number: returnNumber, type, reason_code: reasonCode });
    } catch { /* non-critical */ }

    res.status(201).json({
      returnNumber,
      accessToken: ret.access_token,
      statusUrl: `/vraceni/stav/${ret.access_token}`,
      shipment: shipmentInfo,
    });
  } catch (err) {
    next(err);
  }
});

// GET /:accessToken — return status for customer
router.get('/:accessToken', async (req, res, next) => {
  try {
    const { accessToken } = req.params;

    const { data: ret, error } = await supabase
      .from('returns')
      .select('*')
      .eq('access_token', accessToken)
      .single();

    if (error || !ret) return res.status(404).json({ error: 'Žádost nenalezena' });

    // Fetch items with product info
    const { data: items } = await supabase
      .from('return_items')
      .select('*, delivery_note_items(code, brand, text, qty, price_unit_inc_vat)')
      .eq('return_id', ret.id)
      .order('id');

    // Fetch status timeline
    const { data: timeline } = await supabase
      .from('return_status_log')
      .select('new_status, note, change_source, created_at')
      .eq('return_id', ret.id)
      .order('created_at', { ascending: true });

    // Fetch messages (only non-internal)
    const { data: messages } = await supabase
      .from('return_messages')
      .select('id, author_type, content, attachments, created_at')
      .eq('return_id', ret.id)
      .eq('is_internal', false)
      .order('created_at', { ascending: true });

    // Fetch return shipments
    const { data: shipments } = await supabase
      .from('return_shipments')
      .select('id, carrier, shipping_method, tracking_number, label_url, status, cost, currency, pickup_point_name, pickup_point_address, customer_address')
      .eq('return_id', ret.id)
      .order('created_at', { ascending: false });

    // Get reason label
    const { data: reason } = await supabase
      .from('return_reasons')
      .select('label_cs')
      .eq('code', ret.reason_code)
      .single();

    res.json({
      ...ret,
      statusLabel: getReturnStatusLabel(ret.status),
      reasonLabel: reason?.label_cs || ret.reason_code,
      items: items || [],
      timeline: (timeline || []).map(t => ({
        ...t,
        statusLabel: getReturnStatusLabel(t.new_status),
      })),
      messages: messages || [],
      shipments: shipments || [],
    });
  } catch (err) {
    next(err);
  }
});

// POST /:accessToken/message — customer sends a message
router.post('/:accessToken/message', async (req, res, next) => {
  try {
    const { accessToken } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Verify return exists
    const { data: ret } = await supabase
      .from('returns')
      .select('id')
      .eq('access_token', accessToken)
      .single();

    if (!ret) return res.status(404).json({ error: 'Žádost nenalezena' });

    const { data: msg, error } = await supabase
      .from('return_messages')
      .insert({
        return_id: ret.id,
        author_type: 'customer',
        content: content.trim(),
        is_internal: false,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(msg);
  } catch (err) {
    next(err);
  }
});

// POST /:accessToken/upload — upload attachment to Supabase Storage
router.post('/:accessToken/upload', upload.single('file'), async (req, res, next) => {
  try {
    const { accessToken } = req.params;

    const { data: ret } = await supabase
      .from('returns')
      .select('id')
      .eq('access_token', accessToken)
      .single();

    if (!ret) return res.status(404).json({ error: 'Žádost nenalezena' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'Nepovolený typ souboru. Povolené: JPEG, PNG, WebP, GIF, PDF' });
    }

    const ext = req.file.originalname.split('.').pop();
    const fileName = `return-${ret.id}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;

    const { data, error } = await supabase.storage
      .from('return-attachments')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('return-attachments')
      .getPublicUrl(fileName);

    res.status(201).json({
      path: fileName,
      url: urlData.publicUrl,
    });
  } catch (err) {
    next(err);
  }
});

// GET /track/:trackingToken — public tracking page data
router.get('/track/:trackingToken', async (req, res, next) => {
  try {
    const { trackingToken } = req.params;

    const { data: note, error } = await supabase
      .from('delivery_notes')
      .select('id, doc_number, invoice_number, order_number, date_issued, customer_name, shipper_code, tracking_number, tracking_url, unified_status, last_tracking_description')
      .eq('tracking_token', trackingToken)
      .single();

    if (error || !note) return res.status(404).json({ error: 'Zásilka nenalezena' });

    // Fetch items
    const { data: items } = await supabase
      .from('delivery_note_items')
      .select('code, brand, text, qty, item_type')
      .eq('delivery_note_id', note.id)
      .eq('item_type', 'goods');

    // Fetch tracking timeline
    const { data: logs } = await supabase
      .from('tracking_sync_log')
      .select('tracking_data, synced_at')
      .eq('delivery_note_id', note.id)
      .order('synced_at', { ascending: false })
      .limit(1);

    let trackingTimeline = [];
    if (logs && logs.length > 0) {
      const td = logs[0].tracking_data;
      const shipmentData = td?.data || td;
      const shipments = Array.isArray(shipmentData) ? shipmentData : [shipmentData];
      for (const s of shipments) {
        for (const item of (s?.trackingItems || [])) {
          trackingTimeline.push({
            date: item.date,
            description: item.description,
            location: item.placeOfEvent || null,
          });
        }
      }
      trackingTimeline.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }

    // Check if rating already exists
    const { data: existingRating } = await supabase
      .from('delivery_ratings')
      .select('id, rating, problems, comment, created_at')
      .eq('delivery_note_id', note.id)
      .maybeSingle();

    res.json({
      ...note,
      statusLabel: getStatusLabel(note.unified_status),
      items: items || [],
      trackingTimeline,
      rating: existingRating || null,
    });

    // Log T&T page view (fire and forget)
    supabase.from('tt_page_views').insert({
      delivery_note_id: note.id,
      tracking_token: trackingToken,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    }).then(() => {}).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// POST /track/:trackingToken/rate — submit rating from public T&T page
router.post('/track/:trackingToken/rate', async (req, res, next) => {
  try {
    const { trackingToken } = req.params;
    const { rating, problems, comment } = req.body;

    if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return res.status(400).json({ error: 'Rating must be integer 1-5' });
    }

    // Find delivery note
    const { data: note, error: noteErr } = await supabase
      .from('delivery_notes')
      .select('id, unified_status')
      .eq('tracking_token', trackingToken)
      .single();

    if (noteErr || !note) return res.status(404).json({ error: 'Zásilka nenalezena' });
    if (note.unified_status !== 'delivered') {
      return res.status(400).json({ error: 'Hodnocení lze zadat pouze pro doručené zásilky' });
    }

    // Insert rating
    const { data, error } = await supabase
      .from('delivery_ratings')
      .insert({
        delivery_note_id: note.id,
        rating,
        problems: problems || [],
        comment: comment || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Tato zásilka již byla hodnocena' });
      }
      throw error;
    }

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
