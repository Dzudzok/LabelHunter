const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const nextisService = require('../services/NextisService');
const { getTransportMap } = require('../utils/transportMap');

// POST /import - manual import trigger
// Query params: ?limit=10 (for testing), ?dateFrom=2026-02-28, ?dateTo=2026-02-28
router.post('/import', async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const result = await importDeliveryNotes(req.query.dateFrom, req.query.dateTo, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

async function importDeliveryNotes(dateFrom, dateTo, limit = null) {
  // Default to today only (not 7 days — can be slow)
  if (!dateFrom || !dateTo) {
    const today = new Date();
    dateFrom = `${today.toISOString().split('T')[0]}T00:00:00.000Z`;
    dateTo = `${today.toISOString().split('T')[0]}T23:59:59.000Z`;
  }

  console.log(`[Nextis Import] Fetching delivery notes from ${dateFrom} to ${dateTo}${limit ? ` (limit: ${limit})` : ''}`);

  const response = await nextisService.getDeliveryNotes(dateFrom, dateTo);

  // Nextis returns { items: [...], status: "OK", duration: ... }
  if (!response || !response.items) {
    console.log('[Nextis Import] No items returned from Nextis. Response:', JSON.stringify(response).slice(0, 200));
    return { imported: 0, skipped: 0, total: 0 };
  }

  let deliveryNotes = Array.isArray(response.items) ? response.items : [];

  // Apply limit for testing
  if (limit && limit > 0) {
    deliveryNotes = deliveryNotes.slice(0, limit);
  }

  console.log(`[Nextis Import] Processing ${deliveryNotes.length} delivery notes`);

  // Pre-fetch all existing nextis_ids in one query to avoid N+1
  const nextisIds = deliveryNotes.map(n => n.id).filter(Boolean);
  const existingIds = new Set();
  if (nextisIds.length > 0) {
    // Supabase IN query has a limit, so batch in chunks of 500
    for (let i = 0; i < nextisIds.length; i += 500) {
      const chunk = nextisIds.slice(i, i + 500);
      const { data: existingRows } = await supabase
        .from('delivery_notes')
        .select('nextis_id')
        .in('nextis_id', chunk);
      if (existingRows) {
        for (const row of existingRows) existingIds.add(row.nextis_id);
      }
    }
  }
  console.log(`[Nextis Import] Found ${existingIds.size} already imported notes`);

  // Load transport map once before the loop
  const transportMap = await getTransportMap();
  const newTransports = [];

  let imported = 0;
  let skipped = 0;

  for (const note of deliveryNotes) {
    try {
      // Check if already imported (from pre-fetched set)
      if (existingIds.has(note.id)) {
        skipped++;
        continue;
      }

      // Map transport name to shipper
      const transportName = (note.transportName || '').trim();
      let transport = transportMap[transportName];

      // Auto-register unknown transport names
      if (!transport && transportName && !transportName.startsWith('Rozvoz')) {
        console.log(`[Nextis Import] New transport detected: "${transportName}" — adding to transport_map (unmapped)`);
        try {
          await supabase.from('transport_map').insert({
            nextis_name: transportName,
            shipper_code: null,
            service_code: null,
            skip: false,
          });
        } catch (insertErr) {
          // ignore duplicate insert errors
        }
        transport = { shipperCode: null, serviceCode: null, skip: false };
        transportMap[transportName] = transport; // cache for remaining notes
        newTransports.push(transportName);
      }

      if (!transport) {
        transport = { shipperCode: null, serviceCode: null, skip: false };
      }

      // LEJEK: pomiń jeśli oznaczone skip=true w transport_map,
      // lub jeśli nazwa transportu zaczyna się od "Rozvoz" (własna dostawa)
      if (transport.skip || transportName.startsWith('Rozvoz')) {
        skipped++;
        continue;
      }

      // Nextis structure: headAddress for customer, deliveryAddress for delivery
      const headAddress = note.headAddress || {};
      const deliveryAddress = note.deliveryAddress || {};

      // Invoice/order come from items (all items in one DN share the same invoice/order)
      const goodsItems = (note.items || []).filter(i => i.type === 'goods');
      const firstItem = goodsItems[0] || note.items?.[0] || {};
      const invoiceNumber = (firstItem.invoice || '').trim();
      const orderNumber = (firstItem.order || '').trim();

      // Insert delivery note
      // note.no = doc_number (e.g. "DL820552026")
      const { data: inserted, error: insertError } = await supabase
        .from('delivery_notes')
        .insert({
          nextis_id: note.id,
          doc_number: (note.no || '').trim(),
          invoice_number: invoiceNumber,
          order_number: orderNumber,
          date_issued: note.dateIssued || null,
          customer_name: (headAddress.companyName || headAddress.name || '').trim(),
          customer_email: (headAddress.email || '').trim(),
          customer_phone: (headAddress.phone || '').trim(),
          customer_street: (headAddress.street || '').trim(),
          customer_city: (headAddress.city || '').trim(),
          customer_postal_code: (headAddress.postalCode || '').trim(),
          customer_country: (headAddress.country || '').trim(),
          delivery_street: (deliveryAddress.street || '').trim(),
          delivery_city: (deliveryAddress.city || '').trim(),
          delivery_postal_code: (deliveryAddress.postalCode || '').trim(),
          delivery_country: (deliveryAddress.country || '').trim(),
          delivery_phone: (deliveryAddress.phone || '').trim(),
          delivery_email: (deliveryAddress.email || '').trim(),
          transport_name: transportName,
          amount_netto: note.amountNetto || 0,
          amount_brutto: note.amountBrutto || 0,
          currency: (note.currency || 'CZK').trim(),
          shipper_code: transport.shipperCode,
          shipper_service: transport.serviceCode,
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) {
        console.error(`[Nextis Import] Error inserting DN ${note.no}:`, insertError.message);
        continue;
      }

      // Insert all items (goods + nongoods)
      const items = note.items || [];
      if (items.length > 0) {
        const itemRecords = items.map(item => ({
          delivery_note_id: inserted.id,
          nextis_item_id: item.id || null,
          item_type: (item.type || '').trim(),
          code: (item.code || '').trim(),
          brand: (item.brand || '').trim(),
          text: (item.text || '').trim(),
          note: (item.note || '').trim(),
          qty: item.qty || 0,
          price_unit: item.priceUnit || 0,
          price_total: item.priceTotal || 0,
          price_unit_inc_vat: item.priceUnitIncVAT || 0,
          price_total_inc_vat: item.priceTotalIncVAT || 0,
          vat_rate: item.vatRate || 0,
          unit_weight_netto: item.unitWeightNetto || 0,
        }));

        const { error: itemsError } = await supabase
          .from('delivery_note_items')
          .insert(itemRecords);

        if (itemsError) {
          console.error(`[Nextis Import] Error inserting items for DN ${note.no}:`, itemsError.message);
        }
      }

      imported++;
    } catch (noteErr) {
      console.error(`[Nextis Import] Error processing DN ${note.id}:`, noteErr.message);
    }
  }

  if (newTransports.length > 0) {
    console.log(`[Nextis Import] New transports found: ${newTransports.join(', ')}`);
  }
  console.log(`[Nextis Import] Done. Imported: ${imported}, Skipped: ${skipped}`);
  return { imported, skipped, total: deliveryNotes.length, newTransports };
}

// Export both router and import function (for cron)
module.exports = router;
module.exports.importDeliveryNotes = importDeliveryNotes;
