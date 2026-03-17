const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const supabase = require('../db/supabase');
const labelPrinterService = require('../services/LabelPrinterService');
const emailService = require('../services/EmailService');
const { getTransportMap } = require('../utils/transportMap');

// Helper: log action to package_history
async function logHistory(deliveryNoteId, action, workerId, details) {
  try {
    let workerName = null;
    if (workerId) {
      const { data: w } = await supabase.from('workers').select('name').eq('id', workerId).single();
      workerName = w?.name || null;
    }
    await supabase.from('package_history').insert({
      delivery_note_id: deliveryNoteId,
      action,
      worker_id: workerId || null,
      worker_name: workerName,
      details: details || null,
    });
  } catch (err) {
    console.error('[audit] Failed to log history:', err.message);
  }
}

// GET / - list packages with filtering
router.get('/', async (req, res, next) => {
  try {
    const { date, status, search } = req.query;

    // Paginate to bypass Supabase max_rows=1000 limit
    const PAGE_SIZE = 1000;
    let allData = [];
    let page = 0;

    while (true) {
      let query = supabase
        .from('delivery_notes')
        .select('*, delivery_note_items(id, item_type)')
        .order('date_issued', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (date) {
        const dayStart = `${date}T00:00:00.000Z`;
        const dayEnd = `${date}T23:59:59.999Z`;
        query = query.gte('date_issued', dayStart).lte('date_issued', dayEnd);
      }
      if (status) {
        query = query.eq('status', status);
      }
      if (search) {
        query = query.or(`invoice_number.ilike.%${search}%,doc_number.ilike.%${search}%,customer_name.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) break;
      allData = allData.concat(data);
      if (data.length < PAGE_SIZE) break;
      page++;
    }

    res.json(allData);
  } catch (err) {
    next(err);
  }
});

// GET /search - advanced search across all dates
// MUST be before /:id to avoid Express matching "search" as an id
router.get('/search', async (req, res, next) => {
  try {
    const { invoice_number, order_number, customer_name, doc_number, date_from, date_to, status } = req.query;

    let query = supabase
      .from('delivery_notes')
      .select('*')
      .order('date_issued', { ascending: false })
      .limit(100);

    if (invoice_number) {
      query = query.ilike('invoice_number', `%${invoice_number}%`);
    }
    if (order_number) {
      query = query.ilike('order_number', `%${order_number}%`);
    }
    if (customer_name) {
      query = query.ilike('customer_name', `%${customer_name}%`);
    }
    if (doc_number) {
      query = query.ilike('doc_number', `%${doc_number}%`);
    }
    if (date_from) {
      query = query.gte('date_issued', `${date_from}T00:00:00.000Z`);
    }
    if (date_to) {
      query = query.lte('date_issued', `${date_to}T23:59:59.999Z`);
    }
    if (status) {
      const statuses = status.split(',');
      if (statuses.length === 1) {
        query = query.eq('status', statuses[0]);
      } else {
        query = query.in('status', statuses);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /stats - aggregated stats for a date
// MUST be before /:id to avoid Express matching "stats" as an id
router.get('/stats', async (req, res, next) => {
  try {
    const { date } = req.query;
    const d = date || new Date().toISOString().split('T')[0];
    const from = `${d}T00:00:00.000Z`;
    const to   = `${d}T23:59:59.999Z`;

    // Fetch all notes for the day (paginated to bypass Supabase max_rows=1000)
    const PAGE_SIZE = 1000;
    let notes = [];
    let page = 0;
    while (true) {
      const { data, error } = await supabase
        .from('delivery_notes')
        .select('id, status, shipper_code, transport_name, invoice_number, doc_number, customer_name, scanned_by, scanned_at, label_generated_by, label_generated_at')
        .gte('date_issued', from)
        .lte('date_issued', to)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      notes = notes.concat(data);
      if (data.length < PAGE_SIZE) break;
      page++;
    }

    // Fetch all workers for name lookup
    const { data: workers } = await supabase.from('workers').select('id, name');
    const workerMap = {};
    for (const w of (workers || [])) workerMap[w.id] = w.name;

    // Aggregate
    const byStatus = {};
    const byShipper = {};
    const workerStats = {}; // id -> { name, scanned, labeled }

    for (const n of (notes || [])) {
      byStatus[n.status] = (byStatus[n.status] || 0) + 1;

      if (n.shipper_code) {
        byShipper[n.shipper_code] = (byShipper[n.shipper_code] || 0) + 1;
      }

      if (n.scanned_by) {
        if (!workerStats[n.scanned_by]) workerStats[n.scanned_by] = { name: workerMap[n.scanned_by] || '?', scanned: 0, labeled: 0 };
        workerStats[n.scanned_by].scanned++;
      }

      if (n.label_generated_by) {
        if (!workerStats[n.label_generated_by]) workerStats[n.label_generated_by] = { name: workerMap[n.label_generated_by] || '?', scanned: 0, labeled: 0 };
        workerStats[n.label_generated_by].labeled++;
      }
    }

    // History: packages that had a label generated, sorted newest first
    const history = (notes || [])
      .filter(n => n.label_generated_at)
      .sort((a, b) => new Date(b.label_generated_at) - new Date(a.label_generated_at))
      .slice(0, 40)
      .map(n => ({
        id: n.id,
        invoice_number: n.invoice_number,
        doc_number: n.doc_number,
        customer_name: n.customer_name,
        shipper_code: n.shipper_code,
        label_generated_at: n.label_generated_at,
        scanned_at: n.scanned_at,
        label_worker: workerMap[n.label_generated_by] || null,
        scan_worker: workerMap[n.scanned_by] || null,
      }));

    const total = (notes || []).length;
    const done = (notes || []).filter(n => ['label_generated', 'shipped', 'delivered'].includes(n.status)).length;
    const pending = (notes || []).filter(n => ['pending', 'scanning', 'verified'].includes(n.status)).length;

    res.json({ total, done, pending, byStatus, byShipper, workers: Object.values(workerStats), history });
  } catch (err) {
    next(err);
  }
});

// GET /by-invoice/:invoice - get package by invoice number (for barcode scan)
// MUST be before /:id to avoid Express matching "by-invoice" as an id
router.get('/by-invoice/:invoice', async (req, res, next) => {
  try {
    const { invoice } = req.params;

    // Try exact match first, then zero-padded variants (e.g. "47015826" → "0047015826")
    const candidates = [invoice];
    if (/^\d+$/.test(invoice)) {
      for (let len = invoice.length + 1; len <= 12; len++) {
        candidates.push(invoice.padStart(len, '0'));
      }
    }

    let dn = null;
    for (const candidate of candidates) {
      const { data } = await supabase
        .from('delivery_notes')
        .select('*')
        .eq('invoice_number', candidate)
        .maybeSingle();
      if (data) { dn = data; break; }
    }

    if (!dn) {
      return res.status(404).json({ error: 'Package not found for this invoice' });
    }

    const { data: items, error: itemsError } = await supabase
      .from('delivery_note_items')
      .select('*')
      .eq('delivery_note_id', dn.id)
      .order('id');

    if (itemsError) throw itemsError;

    res.json({ ...dn, items: items || [] });
  } catch (err) {
    next(err);
  }
});

// GET /:id - get single package with items
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: dn, error: dnError } = await supabase
      .from('delivery_notes')
      .select('*')
      .eq('id', id)
      .single();

    if (dnError) throw dnError;
    if (!dn) return res.status(404).json({ error: 'Package not found' });

    const { data: items, error: itemsError } = await supabase
      .from('delivery_note_items')
      .select('*')
      .eq('delivery_note_id', id)
      .order('id');

    if (itemsError) throw itemsError;

    res.json({ ...dn, items: items || [] });
  } catch (err) {
    next(err);
  }
});

// PUT /:id/address - update delivery address
router.put('/:id/address', async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      customer_name,
      delivery_street, delivery_city, delivery_postal_code, delivery_country,
      delivery_phone, delivery_email,
    } = req.body;

    const { data, error } = await supabase
      .from('delivery_notes')
      .update({
        customer_name,
        delivery_street, delivery_city, delivery_postal_code, delivery_country,
        delivery_phone, delivery_email,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await logHistory(parseInt(id), 'address_update', null, {
      customer_name,
      delivery_street, delivery_city, delivery_postal_code, delivery_country,
    });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// PUT /:id/status - update package status
router.put('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, workerId } = req.body;

    // Get old status for history
    const { data: old } = await supabase.from('delivery_notes').select('status').eq('id', id).single();

    const { data, error } = await supabase
      .from('delivery_notes')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await logHistory(parseInt(id), 'status_change', workerId || null, {
      old_status: old?.status,
      new_status: status,
    });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// PUT /:id/scan-item - update item scan qty
router.put('/:id/scan-item', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { itemId, qty, workerId } = req.body;

    const { data, error } = await supabase
      .from('delivery_note_items')
      .update({
        scanned_qty: qty,
        scan_verified: true,
      })
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;

    // Track who scanned (set only on first scan)
    if (workerId) {
      await supabase
        .from('delivery_notes')
        .update({ scanned_by: workerId, scanned_at: new Date().toISOString() })
        .eq('id', id)
        .is('scanned_by', null);
    }

    await logHistory(parseInt(id), 'scan_item', workerId, {
      item_id: itemId,
      item_code: data.code,
      scanned_qty: qty,
    });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// PUT /:id/skip-item - skip single item scanning
router.put('/:id/skip-item', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { itemId } = req.body;

    const { error: skipError } = await supabase
      .from('delivery_note_items')
      .update({ scan_skipped: true })
      .eq('id', itemId);

    if (skipError) throw skipError;

    await logHistory(parseInt(id), 'skip_item', null, { item_id: itemId });

    // Return full package with items (same as GET /:id)
    const { data: dn, error: dnError } = await supabase
      .from('delivery_notes')
      .select('*')
      .eq('id', id)
      .single();

    if (dnError) throw dnError;

    const { data: items, error: itemsError } = await supabase
      .from('delivery_note_items')
      .select('*')
      .eq('delivery_note_id', id)
      .order('id');

    if (itemsError) throw itemsError;

    res.json({ ...dn, items: items || [] });
  } catch (err) {
    next(err);
  }
});

// PUT /:id/skip-all - skip all items scanning
router.put('/:id/skip-all', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('delivery_note_items')
      .update({ scan_skipped: true })
      .eq('delivery_note_id', id);

    if (error) throw error;

    await logHistory(parseInt(id), 'skip_all', null, {});

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /manual-label - create a new manual shipment + generate LP label immediately
router.post('/manual-label', async (req, res, next) => {
  try {
    const {
      shipperCode, serviceCode,
      recipientName, recipientStreet, recipientCity, recipientPostalCode,
      recipientCountry, recipientPhone, recipientEmail,
      weight, codAmount, currency,
      invoiceNumber, orderNumber,
      workerId,
    } = req.body;

    if (!shipperCode || !serviceCode) {
      return res.status(400).json({ error: 'shipperCode a serviceCode jsou povinné' });
    }

    const cod = codAmount ? parseFloat(codAmount) : null;
    const curr = currency || 'CZK';

    const shipmentData = {
      shipperCode,
      serviceCode,
      variableSymbol: invoiceNumber || orderNumber || `M${Date.now()}`,
      orderNumber: orderNumber || invoiceNumber || `M${Date.now()}`,
      paymentInAdvance: !cod,
      price: cod || 0,
      priceCurrency: curr,
      cod: cod || null,
      codCurrency: cod ? curr : null,
      description: 'Autodíly',
      recipient: {
        company: recipientName || '',
        street: recipientStreet || '',
        city: recipientCity || '',
        postalCode: recipientPostalCode || '',
        countryCode: recipientCountry || 'CZ',
        phone: recipientPhone || '',
        email: recipientEmail || '',
      },
      parcels: [{ weight: Math.max(parseFloat(weight) || 0.5, 0.1), ...((shipperCode || '').toUpperCase() === 'UPS' ? { packagingType: '02' } : {}) }],
      labels: { format: 'A6' },
    };

    console.log('[manual-label] Sending to LP:', JSON.stringify(shipmentData));
    const result = await labelPrinterService.createShipment(shipmentData);

    const lpItem = result.data && result.data[0] ? result.data[0] : {};
    let labelPdfUrl = null;
    const labelsField = lpItem.labels;
    const labelBase64 = Array.isArray(labelsField) ? labelsField[0] : labelsField;

    if (labelBase64 && typeof labelBase64 === 'string' && labelBase64.length > 10) {
      const labelsDir = path.join(__dirname, '..', 'labels');
      const filename = `${lpItem.id}.pdf`;
      fs.writeFileSync(path.join(labelsDir, filename), Buffer.from(labelBase64, 'base64'));
      labelPdfUrl = `/labels/${filename}`;
    }

    const shipmentResult = result.data && result.data[0] ? result.data[0] : {};
    const allParcels = shipmentResult.parcels || [];
    const firstParcel = allParcels[0] || {};
    const trackingToken = crypto.randomUUID();

    const { data: dn, error: dnError } = await supabase
      .from('delivery_notes')
      .insert({
        source: 'manual',
        doc_number: `M${Date.now()}`,
        invoice_number: invoiceNumber || '',
        order_number: orderNumber || '',
        date_issued: new Date().toISOString(),
        customer_name: recipientName || '',
        customer_street: recipientStreet || '',
        customer_city: recipientCity || '',
        customer_postal_code: recipientPostalCode || '',
        customer_country: recipientCountry || 'CZ',
        customer_phone: recipientPhone || '',
        customer_email: recipientEmail || '',
        delivery_street: recipientStreet || '',
        delivery_city: recipientCity || '',
        delivery_postal_code: recipientPostalCode || '',
        delivery_country: recipientCountry || 'CZ',
        delivery_phone: recipientPhone || '',
        delivery_email: recipientEmail || '',
        transport_name: serviceCode,
        shipper_code: shipperCode,
        shipper_service: serviceCode,
        amount_netto: 0,
        amount_brutto: cod || 0,
        currency: curr,
        status: 'label_generated',
        lp_shipment_id: shipmentResult.id,
        lp_barcode: firstParcel.barcode || null,
        lp_parcels: allParcels.length > 0 ? allParcels.map(p => ({ barcode: p.barcode, trackingNumber: p.trackingNumber || p.barcode, weight: p.weight })) : null,
        tracking_number: firstParcel.trackingNumber || firstParcel.barcode || null,
        tracking_url: firstParcel.trackingUrl || null,
        label_pdf_url: labelPdfUrl,
        tracking_token: trackingToken,
        label_generated_at: new Date().toISOString(),
        label_generated_by: workerId || null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dnError) throw dnError;

    res.json({ id: dn.id, label_url: labelPdfUrl, tracking_number: firstParcel.trackingNumber || firstParcel.barcode, barcode: firstParcel.barcode });
  } catch (err) {
    if (err.response) {
      console.error('[manual-label] LP API error:', JSON.stringify(err.response.data));
      return res.status(400).json({ error: 'LP API error', details: err.response.data });
    }
    next(err);
  }
});

// POST /:id/generate-label - generate LP label
router.post('/:id/generate-label', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Fetch delivery note with items
    const { data: dn, error: dnError } = await supabase
      .from('delivery_notes')
      .select('*')
      .eq('id', id)
      .single();

    if (dnError) throw dnError;
    if (!dn) return res.status(404).json({ error: 'Package not found' });

    // Get items for weight calculation
    const { data: items, error: itemsError } = await supabase
      .from('delivery_note_items')
      .select('*')
      .eq('delivery_note_id', id);

    if (itemsError) throw itemsError;

    // Map transport to shipper — priority: body override > LP sync codes > transport_map fallback
    const { shipperCode: bodyShipper, serviceCode: bodyService, workerId, parcels: bodyParcels, codAmount: bodyCodAmount } = req.body || {};
    let transport;
    if (bodyShipper) {
      transport = { shipperCode: bodyShipper, serviceCode: bodyService || bodyShipper };
    } else if (dn.shipper_code) {
      transport = { shipperCode: dn.shipper_code, serviceCode: dn.shipper_service || dn.shipper_code };
    } else {
      const transportMap = await getTransportMap();
      transport = transportMap[dn.transport_name];
    }
    if (!transport || !transport.shipperCode) {
      return res.status(400).json({ error: `Unsupported transport: ${dn.transport_name}` });
    }

    // Calculate total weight from items (used as fallback)
    let autoWeight = 0;
    if (items) {
      for (const item of items) {
        if (item.unit_weight_netto && item.qty) {
          autoWeight += parseFloat(item.unit_weight_netto) * parseFloat(item.qty);
        }
      }
    }
    if (autoWeight < 0.5) autoWeight = 0.5;

    // Build parcels array — from body (user-defined) or auto single parcel
    const isUPS = (transport.shipperCode || '').toUpperCase() === 'UPS';
    let parcelsForLP;
    if (bodyParcels && Array.isArray(bodyParcels) && bodyParcels.length > 0) {
      parcelsForLP = bodyParcels.map(p => ({
        weight: Math.round(Math.max(parseFloat(p.weight) || 0.5, 0.1) * 100) / 100,
        ...(isUPS ? { packagingType: '02' } : {}),
      }));
    } else {
      parcelsForLP = [{ weight: Math.round(autoWeight * 100) / 100, ...(isUPS ? { packagingType: '02' } : {}) }];
    }

    // Build shipment data for LP API
    const shipmentData = {
      shipperCode: transport.shipperCode,
      serviceCode: transport.serviceCode,
      variableSymbol: dn.invoice_number || dn.doc_number,
      orderNumber: dn.order_number || '',
      paymentInAdvance: bodyCodAmount != null ? (parseFloat(bodyCodAmount) <= 0) : !(parseFloat(dn.cod_amount || 0) > 0),
      price: parseFloat(dn.amount_brutto || 0),
      priceCurrency: dn.currency || 'CZK',
      cod: bodyCodAmount != null ? (parseFloat(bodyCodAmount) || null) : (parseFloat(dn.cod_amount || 0) > 0 ? parseFloat(dn.cod_amount) : null),
      codCurrency: (bodyCodAmount != null ? parseFloat(bodyCodAmount) : parseFloat(dn.cod_amount || 0)) > 0 ? (dn.currency || 'CZK') : null,
      description: 'Autodíly',
      recipient: {
        company: dn.customer_name,
        street: dn.delivery_street || dn.customer_street,
        city: dn.delivery_city || dn.customer_city,
        postalCode: dn.delivery_postal_code || dn.customer_postal_code,
        countryCode: dn.delivery_country || dn.customer_country || 'CZ',
        phone: dn.delivery_phone || dn.customer_phone,
        email: dn.delivery_email || dn.customer_email,
      },
      parcels: parcelsForLP,
      labels: { format: 'A6' },
    };

    // Create shipment in LP
    console.log('[generate-label] Sending to LP:', JSON.stringify(shipmentData));
    const result = await labelPrinterService.createShipment(shipmentData);

    // Extract label PDF from response
    // LP API returns labels as array of base64 strings: ["JVBERi0x..."]
    const lpItem = result.data && result.data[0] ? result.data[0] : {};
    let labelPdfUrl = null;
    const labelsField = lpItem.labels;

    // Normalize: accept string or array of strings
    const labelBase64 = Array.isArray(labelsField) ? labelsField[0] : labelsField;

    if (labelBase64 && typeof labelBase64 === 'string' && labelBase64.length > 10) {
      const labelsDir = path.join(__dirname, '..', 'labels');
      const filename = `${lpItem.id}.pdf`;
      const filePath = path.join(labelsDir, filename);

      const pdfBuffer = Buffer.from(labelBase64, 'base64');
      console.log('[generate-label] PDF saved:', filename, pdfBuffer.length, 'bytes');
      fs.writeFileSync(filePath, pdfBuffer);
      labelPdfUrl = `/labels/${filename}`;
    } else {
      console.warn('[generate-label] No labels in LP response. type:', typeof labelsField, Array.isArray(labelsField) ? 'array len=' + labelsField.length : '');
    }

    // Extract shipment details — LP response: data[0].id, data[0].parcels[]
    const shipmentResult = result.data && result.data[0] ? result.data[0] : {};
    const allParcels = shipmentResult.parcels || [];
    const firstParcel = allParcels[0] || {};
    const trackingToken = crypto.randomUUID();

    // Store all parcels as JSON
    const lpParcelsData = allParcels.map(p => ({
      barcode: p.barcode,
      trackingNumber: p.trackingNumber || p.barcode,
      trackingUrl: p.trackingUrl,
      weight: p.weight,
    }));

    // Update delivery note
    const { data: updated, error: updateError } = await supabase
      .from('delivery_notes')
      .update({
        lp_shipment_id: shipmentResult.id,
        lp_barcode: firstParcel.barcode,
        lp_parcels: lpParcelsData,
        tracking_number: firstParcel.trackingNumber || firstParcel.barcode,
        tracking_url: firstParcel.trackingUrl,
        label_pdf_url: labelPdfUrl,
        shipper_code: transport.shipperCode,
        shipper_service: transport.serviceCode,
        status: 'label_generated',
        label_generated_at: new Date().toISOString(),
        label_generated_by: workerId || null,
        tracking_token: trackingToken,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    await logHistory(parseInt(id), 'generate_label', workerId || null, {
      tracking_number: updated.tracking_number,
      shipper_code: transport.shipperCode,
      shipper_service: transport.serviceCode,
      lp_shipment_id: shipmentResult.id,
    });

    // Delete items after label generated — not needed anymore, LP desktop is the archive
    await supabase.from('delivery_note_items').delete().eq('delivery_note_id', id);

    // Email is sent by lp-sync on BOLOPC (SMTP works from there, not from Render)
    // lp-sync checks for label_pdf_url NOT NULL + email_sent_at IS NULL and sends from BOLOPC
    const emailTo = updated.delivery_email || updated.customer_email;
    console.log(`[Email] Will be sent by lp-sync on BOLOPC (to=${emailTo})`);
    await supabase.from('delivery_notes').update({ status: 'shipped' }).eq('id', id);

    res.json({
      success: true,
      label_url: labelPdfUrl,
      tracking_number: updated.tracking_number,
      barcode: updated.lp_barcode,
      deliveryNote: updated,
    });
  } catch (err) {
    // If LP API returned error details, pass them through
    if (err.response) {
      return res.status(err.response.status).json({
        error: 'LP API Error',
        details: err.response.data,
      });
    }
    next(err);
  }
});

// GET /:id/download-label - stream label PDF (as attachment)
router.get('/:id/download-label', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: dn, error } = await supabase
      .from('delivery_notes')
      .select('label_pdf_url, invoice_number')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!dn?.label_pdf_url) return res.status(404).json({ error: 'No label found' });

    const filePath = path.join(__dirname, '..', dn.label_pdf_url);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Label file not found' });

    const filename = `label-${dn.invoice_number || id}.pdf`;
    const stat = fs.statSync(filePath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', stat.size);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
});

// GET /:id/view-label - stream label PDF inline (for printing in iframe)
router.get('/:id/view-label', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: dn, error } = await supabase
      .from('delivery_notes')
      .select('label_pdf_url, invoice_number')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!dn?.label_pdf_url) return res.status(404).json({ error: 'No label found' });

    const filePath = path.join(__dirname, '..', dn.label_pdf_url);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Label file not found' });

    const stat = fs.statSync(filePath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Content-Length', stat.size);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
});

// DELETE /:id/label - cancel LP shipment
router.delete('/:id/label', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: dn, error: dnError } = await supabase
      .from('delivery_notes')
      .select('lp_shipment_id, label_pdf_url')
      .eq('id', id)
      .single();

    if (dnError) throw dnError;
    if (!dn || !dn.lp_shipment_id) {
      return res.status(400).json({ error: 'No label to cancel' });
    }

    // Delete from LP API
    await labelPrinterService.deleteShipment(dn.lp_shipment_id);

    // Delete local PDF file if exists
    if (dn.label_pdf_url) {
      const filePath = path.join(__dirname, '..', dn.label_pdf_url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Reset delivery note fields
    const { data: updated, error: updateError } = await supabase
      .from('delivery_notes')
      .update({
        lp_shipment_id: null,
        lp_barcode: null,
        tracking_number: null,
        tracking_url: null,
        label_pdf_url: null,
        shipper_code: null,
        shipper_service: null,
        status: 'pending',
        label_generated_at: null,
        tracking_token: null,
        email_sent_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    await logHistory(parseInt(id), 'cancel_label', null, {
      lp_shipment_id: dn.lp_shipment_id,
    });

    res.json({ success: true, deliveryNote: updated });
  } catch (err) {
    next(err);
  }
});

// GET /:id/history - get audit history for a package
router.get('/:id/history', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('package_history')
      .select('*')
      .eq('delivery_note_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
