const express = require('express');
const router = express.Router();
const supabase = require('../../db/supabase');
const { getUnifiedStatus, getStatusLabel } = require('../../services/retino/tracking-status-mapper');
const { getStatusLabel: getReturnStatusLabel } = require('../../services/retino/return-workflow');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /verify — verify order by doc_number + email → return items
router.post('/verify', async (req, res, next) => {
  try {
    const { docNumber, email } = req.body;
    if (!docNumber || !email) {
      return res.status(400).json({ error: 'docNumber and email are required' });
    }

    const { data: note, error } = await supabase
      .from('delivery_notes')
      .select('id, doc_number, invoice_number, order_number, date_issued, customer_name, customer_email, shipper_code, unified_status')
      .or(`invoice_number.eq.${docNumber},doc_number.eq.${docNumber},order_number.eq.${docNumber}`)
      .limit(1)
      .single();

    if (error || !note) {
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

    res.status(201).json({
      returnNumber,
      accessToken: ret.access_token,
      statusUrl: `/vraceni/stav/${ret.access_token}`,
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

    const ext = req.file.originalname.split('.').pop();
    const fileName = `return-${ret.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

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

    res.json({
      ...note,
      statusLabel: getStatusLabel(note.unified_status),
      items: items || [],
      trackingTimeline,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
