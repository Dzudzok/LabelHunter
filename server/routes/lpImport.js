const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const labelPrinterService = require('../services/LabelPrinterService');

// POST /import - import shipments from LP API (state=4 = Pripraveny / do zpracovani)
router.post('/import', async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const result = await importFromLP(limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

async function importFromLP(limit = null) {
  // Search for today's shipments via LP API
  const today = new Date().toISOString().split('T')[0];
  console.log(`[LP Import] Searching shipments for ${today}${limit ? ` (limit: ${limit})` : ''}`);

  const searchResult = await labelPrinterService.searchShipments({
    shipmentDayFrom: today,
    shipmentDayTo: today,
  });

  // LP API returns { code: 200, data: [...], errors: [] }
  const allShipments = (searchResult && searchResult.data) || [];

  // Filter only state=4 (Pripraveny = do zpracovani)
  let shipments = allShipments.filter(s => s.state && s.state.code === 4);

  if (limit && limit > 0) {
    shipments = shipments.slice(0, limit);
  }

  console.log(`[LP Import] Found ${allShipments.length} total, ${shipments.length} in state 4`);

  if (shipments.length === 0) {
    return { imported: 0, skipped: 0, total: 0 };
  }

  // Pre-fetch existing lp_ids to avoid duplicates
  const lpIds = shipments.map(s => s.id);
  const existingLpIds = new Set();
  for (let i = 0; i < lpIds.length; i += 500) {
    const chunk = lpIds.slice(i, i + 500);
    const { data: existingRows } = await supabase
      .from('delivery_notes')
      .select('lp_id')
      .in('lp_id', chunk);
    if (existingRows) {
      for (const row of existingRows) existingLpIds.add(row.lp_id);
    }
  }
  console.log(`[LP Import] Found ${existingLpIds.size} already imported`);

  let imported = 0;
  let skipped = 0;

  for (const ship of shipments) {
    try {
      if (existingLpIds.has(ship.id)) {
        skipped++;
        continue;
      }

      // Fetch goods via goodscheckings endpoint
      let goods = [];
      try {
        const goodsResult = await labelPrinterService.getGoodsCheckings(ship.id);
        // goodscheckings returns { code, data: [{ items: [{ goods: {...}, quantity, ... }] }] }
        const checkings = (goodsResult && goodsResult.data) || [];
        for (const checking of checkings) {
          for (const item of (checking.items || [])) {
            goods.push({
              barcode: item.goods?.barcode || '',
              name: item.goods?.name || item.name || '',
              quantity: item.goods?.quantity || item.quantity || 0,
              unitPrice: item.goods?.unitPrice || 0,
              unitCode: item.goods?.unitCode || 'ks',
            });
          }
        }
      } catch (goodsErr) {
        // goodscheckings may return 404 if no checking done yet — that's OK
        if (goodsErr.response?.status !== 404) {
          console.warn(`[LP Import] Could not fetch goods for shipment ${ship.id}:`, goodsErr.message);
        }
      }

      // Build parcels from LP API response
      const parcels = (ship.parcels || []).map(p => ({
        barcode: p.barcode,
        trackingNumber: p.trackingNumber || p.barcode,
        trackingUrl: p.trackingUrl,
        weight: p.weight,
      }));

      const firstParcel = parcels[0] || {};

      // Insert delivery note
      const { data: inserted, error: insertError } = await supabase
        .from('delivery_notes')
        .insert({
          lp_id: ship.id,
          nextis_id: null,
          source: 'lp',
          doc_number: `LP${ship.id}`,
          invoice_number: (ship.variableSymbol || '').trim(),
          order_number: (ship.orderNumber || '').trim(),
          date_issued: ship.shipmentDay || null,
          customer_name: '',
          customer_email: '',
          customer_phone: '',
          customer_street: '',
          customer_city: '',
          customer_postal_code: '',
          customer_country: 'CZ',
          delivery_street: '',
          delivery_city: '',
          delivery_postal_code: '',
          delivery_country: 'CZ',
          delivery_phone: '',
          delivery_email: '',
          transport_name: ship.shipperService || ship.shipper || '',
          shipper_code: ship.shipper || null,
          shipper_service: ship.shipperService || null,
          amount_netto: 0,
          amount_brutto: ship.price || 0,
          currency: 'CZK',
          status: 'pending',
          lp_shipment_id: ship.id,
          lp_barcode: firstParcel.barcode || null,
          lp_parcels: parcels.length > 0 ? parcels : null,
          tracking_number: firstParcel.trackingNumber || null,
          tracking_url: firstParcel.trackingUrl || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error(`[LP Import] Error inserting shipment ${ship.id}:`, insertError.message);
        continue;
      }

      // Insert goods as delivery_note_items
      if (goods.length > 0) {
        const itemRecords = goods.map(g => ({
          delivery_note_id: inserted.id,
          nextis_item_id: null,
          item_type: 'goods',
          code: (g.barcode || '').trim(),
          brand: '',
          text: (g.name || '').trim(),
          note: '',
          qty: g.quantity || 0,
          price_unit: g.unitPrice || 0,
          price_total: (g.unitPrice || 0) * (g.quantity || 0),
          price_unit_inc_vat: 0,
          price_total_inc_vat: 0,
          vat_rate: 0,
          unit_weight_netto: 0,
        }));

        const { error: itemsError } = await supabase
          .from('delivery_note_items')
          .insert(itemRecords);

        if (itemsError) {
          console.error(`[LP Import] Error inserting items for shipment ${ship.id}:`, itemsError.message);
        }
      }

      imported++;
    } catch (shipErr) {
      console.error(`[LP Import] Error processing shipment ${ship.id}:`, shipErr.message);
    }
  }

  console.log(`[LP Import] Done. Imported: ${imported}, Skipped: ${skipped}`);
  return { imported, skipped, total: shipments.length };
}

module.exports = router;
module.exports.importFromLP = importFromLP;
