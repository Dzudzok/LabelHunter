const express = require('express');
const router = express.Router();
const supabase = require('../../db/supabase');
const { canTransition, getAllowedTransitions, getStatusLabel, STATUS_LABELS } = require('../../services/retino/return-workflow');

// GET / — list returns with filters + pagination
router.get('/', async (req, res, next) => {
  try {
    const {
      status, type, assigned, dateFrom, dateTo, search,
      page = 1, pageSize = 50, sortBy = 'requested_at', sortDir = 'desc',
    } = req.query;

    let query = supabase
      .from('returns')
      .select('id, return_number, delivery_note_id, type, status, reason_code, customer_name, customer_email, assigned_to, requested_at, updated_at, resolution_type', { count: 'exact' });

    if (status) query = query.eq('status', status);
    if (type) query = query.eq('type', type);
    if (assigned) query = query.eq('assigned_to', assigned);
    if (dateFrom) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) return res.status(400).json({ error: 'Invalid dateFrom format' });
      query = query.gte('requested_at', `${dateFrom}T00:00:00.000Z`);
    }
    if (dateTo) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) return res.status(400).json({ error: 'Invalid dateTo format' });
      query = query.lte('requested_at', `${dateTo}T23:59:59.999Z`);
    }
    if (search) {
      const s = String(search).slice(0, 100);
      query = query.or(`return_number.ilike.%${s}%,customer_name.ilike.%${s}%,customer_email.ilike.%${s}%`);
    }

    const from = (parseInt(page) - 1) * parseInt(pageSize);
    const to = from + parseInt(pageSize) - 1;
    query = query.order(sortBy, { ascending: sortDir === 'asc' }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    // Enrich with status labels
    const returns = (data || []).map(r => ({
      ...r,
      statusLabel: getStatusLabel(r.status),
    }));

    res.json({
      returns,
      total: count || 0,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      totalPages: Math.ceil((count || 0) / parseInt(pageSize)),
    });
  } catch (err) {
    next(err);
  }
});

// GET /dashboard — status counts, avg resolution days
router.get('/dashboard', async (req, res, next) => {
  try {
    // Paginate to get ALL returns (Supabase default limit is 1000)
    let returns = [];
    let offset = 0;
    const PAGE = 1000;
    while (true) {
      const { data: batch, error } = await supabase
        .from('returns')
        .select('id, status, requested_at, resolved_at')
        .range(offset, offset + PAGE - 1);
      if (error) throw error;
      if (!batch || batch.length === 0) break;
      returns = returns.concat(batch);
      if (batch.length < PAGE) break;
      offset += PAGE;
    }

    const statusCounts = {};
    for (const key of Object.keys(STATUS_LABELS)) {
      statusCounts[key] = 0;
    }

    let resolvedCount = 0;
    let totalResolutionDays = 0;

    for (const r of (returns || [])) {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;

      if (r.resolved_at && r.requested_at) {
        resolvedCount++;
        const days = (new Date(r.resolved_at) - new Date(r.requested_at)) / (1000 * 60 * 60 * 24);
        totalResolutionDays += days;
      }
    }

    res.json({
      total: (returns || []).length,
      statusCounts,
      statusLabels: STATUS_LABELS,
      avgResolutionDays: resolvedCount > 0 ? Math.round((totalResolutionDays / resolvedCount) * 10) / 10 : null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /:id — return detail with items, timeline, messages
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: ret, error } = await supabase
      .from('returns')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !ret) return res.status(404).json({ error: 'Return not found' });

    // Fetch items with product info
    const { data: items } = await supabase
      .from('return_items')
      .select('*, delivery_note_items(code, brand, text, qty, price_unit_inc_vat)')
      .eq('return_id', id)
      .order('id');

    // Fetch timeline
    const { data: timeline } = await supabase
      .from('return_status_log')
      .select('*, workers(name)')
      .eq('return_id', id)
      .order('created_at', { ascending: true });

    // Fetch ALL messages (including internal)
    const { data: messages } = await supabase
      .from('return_messages')
      .select('*, workers:author_worker_id(name)')
      .eq('return_id', id)
      .order('created_at', { ascending: true });

    // Fetch reason label
    const { data: reason } = await supabase
      .from('return_reasons')
      .select('label_cs')
      .eq('code', ret.reason_code)
      .single();

    // Fetch related delivery note info
    const { data: note } = await supabase
      .from('delivery_notes')
      .select('doc_number, invoice_number, order_number, date_issued, customer_name, customer_email, shipper_code, tracking_number')
      .eq('id', ret.delivery_note_id)
      .single();

    res.json({
      ...ret,
      statusLabel: getStatusLabel(ret.status),
      reasonLabel: reason?.label_cs || ret.reason_code,
      allowedTransitions: getAllowedTransitions(ret.status).map(s => ({
        status: s,
        label: getStatusLabel(s),
      })),
      deliveryNote: note || null,
      items: items || [],
      timeline: (timeline || []).map(t => ({
        ...t,
        statusLabel: getStatusLabel(t.new_status),
        workerName: t.workers?.name || null,
      })),
      messages: (messages || []).map(m => ({
        ...m,
        workerName: m.workers?.name || null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin-create — admin creates return on behalf of customer
router.post('/admin-create', async (req, res, next) => {
  try {
    const {
      deliveryNoteId, type = 'return', reasonCode, reasonDetail,
      vehicleInfo, wasMounted, customerName, customerEmail, customerPhone,
      items, workerId,
    } = req.body;

    if (!deliveryNoteId || !reasonCode || !items || items.length === 0) {
      return res.status(400).json({ error: 'deliveryNoteId, reasonCode and items are required' });
    }

    // Generate return number
    const year = new Date().getFullYear();
    const { count } = await supabase.from('returns').select('id', { count: 'exact', head: true });
    const seqNum = (count || 0) + 1;
    const returnNumber = `RET-${year}-${String(seqNum).padStart(5, '0')}`;

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
        customer_email: customerEmail || null,
        customer_phone: customerPhone || null,
        status: 'new',
        created_by_type: 'admin',
        created_by_worker: workerId || null,
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

    await supabase.from('return_items').insert(returnItems);

    // Status log
    await supabase.from('return_status_log').insert({
      return_id: ret.id,
      previous_status: null,
      new_status: 'new',
      changed_by: workerId || null,
      change_source: 'admin',
      note: 'Žádost vytvořena administrátorem',
    });

    res.status(201).json(ret);
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/status — change return status
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newStatus, note, workerId } = req.body;

    if (!newStatus) return res.status(400).json({ error: 'newStatus is required' });

    // Fetch current status
    const { data: ret } = await supabase
      .from('returns')
      .select('id, status')
      .eq('id', id)
      .single();

    if (!ret) return res.status(404).json({ error: 'Return not found' });

    if (!canTransition(ret.status, newStatus)) {
      return res.status(400).json({
        error: `Cannot transition from '${ret.status}' to '${newStatus}'`,
        allowed: getAllowedTransitions(ret.status),
      });
    }

    // Update status
    const updates = { status: newStatus, updated_at: new Date().toISOString() };
    if (['resolved', 'refunded'].includes(newStatus)) {
      updates.resolved_at = new Date().toISOString();
    }

    const { error: updateErr } = await supabase
      .from('returns')
      .update(updates)
      .eq('id', id);

    if (updateErr) throw updateErr;

    // Log status change
    await supabase.from('return_status_log').insert({
      return_id: parseInt(id),
      previous_status: ret.status,
      new_status: newStatus,
      changed_by: workerId || null,
      change_source: 'admin',
      note: note || null,
    });

    // Trigger email: return_status_changed
    try {
      const { data: fullRet } = await supabase.from('returns').select('*').eq('id', id).single();
      if (fullRet?.customer_email) {
        const emailService = require('../../services/retino/ReturnEmailService');
        await emailService.enqueueEmail('return_status_changed', fullRet, {
          new_status_label: getStatusLabel(newStatus),
          previous_status_label: getStatusLabel(ret.status),
          note: note || '',
        });
      }
    } catch (emailErr) {
      console.error('[Returns] Email trigger error:', emailErr.message);
    }

    // Trigger webhooks
    try {
      const webhookService = require('../../services/retino/WebhookService');
      webhookService.fire('status_changed', { return_id: parseInt(id), previous_status: ret.status, new_status: newStatus, note });
    } catch { /* non-critical */ }

    res.json({ success: true, previousStatus: ret.status, newStatus });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/assign — assign worker
router.patch('/:id/assign', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { workerId } = req.body;

    const { error } = await supabase
      .from('returns')
      .update({ assigned_to: workerId || null, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/resolve — resolve return (approve/reject with details)
router.patch('/:id/resolve', async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      resolutionType, amount, note: resNote, refundMethod,
      bankAccount, variableSymbol, workerId,
    } = req.body;

    if (!resolutionType) return res.status(400).json({ error: 'resolutionType is required' });

    const updates = {
      resolution_type: resolutionType,
      resolution_amount: amount || null,
      resolution_note: resNote || null,
      refund_method: refundMethod || null,
      refund_bank_account: bankAccount || null,
      refund_variable_symbol: variableSymbol || null,
      resolved_by: workerId || null,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('returns')
      .update(updates)
      .eq('id', id);

    if (error) throw error;

    // Trigger email: return_resolved
    try {
      const { data: fullRet } = await supabase.from('returns').select('*').eq('id', id).single();
      if (fullRet?.customer_email) {
        const emailService = require('../../services/retino/ReturnEmailService');
        const resolutionLabels = { refund: 'Vrácení peněz', replacement: 'Výměna zboží', repair: 'Oprava', rejected: 'Zamítnuto' };
        await emailService.enqueueEmail('return_resolved', fullRet, {
          resolution_label: resolutionLabels[resolutionType] || resolutionType,
          resolution_note: resNote || '',
          refund_amount: amount || '',
          currency: 'CZK',
        });
      }
    } catch (emailErr) {
      console.error('[Returns] Email trigger error:', emailErr.message);
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /:id/messages — admin sends message
router.post('/:id/messages', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content, isInternal = false, workerId } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const { data: msg, error } = await supabase
      .from('return_messages')
      .insert({
        return_id: parseInt(id),
        author_type: 'admin',
        author_worker_id: workerId || null,
        content: content.trim(),
        is_internal: isInternal,
      })
      .select()
      .single();

    if (error) throw error;

    // Trigger email: return_message (only for non-internal messages)
    if (!isInternal) {
      try {
        const { data: fullRet } = await supabase.from('returns').select('*').eq('id', id).single();
        if (fullRet?.customer_email) {
          const emailService = require('../../services/retino/ReturnEmailService');
          await emailService.enqueueEmail('return_message', fullRet, {
            message: content.trim(),
          });
        }
      } catch (emailErr) {
        console.error('[Returns] Email trigger error:', emailErr.message);
      }
    }

    res.status(201).json(msg);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
