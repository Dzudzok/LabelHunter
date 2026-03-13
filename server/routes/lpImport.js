const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const mssql = require('../db/mssql');

// POST /import - import shipments from LP MSSQL (state=4 = Pripraveny / do zpracovani)
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
  console.log(`[LP Import] Fetching shipments with state=4 (Pripraveny)${limit ? ` (limit: ${limit})` : ''}`);

  // Query LP MSSQL for shipments in state 4 (Pripraveny = do zpracovani)
  const topClause = limit ? `TOP ${parseInt(limit)}` : '';
  const { recordset: shipments } = await mssql.query(`
    SELECT ${topClause}
      s.pk_shipment,
      s.companyOrName,
      s.attention,
      s.address1,
      s.city,
      s.postalCode,
      s.phone,
      s.email,
      s.reference1,
      s.reference2,
      s.fk_shipment_state,
      s.fk_service_type,
      s.weight,
      s.numberOfPackages,
      s.dateCreated,
      s.countryCode,
      st.name AS service_name,
      st.shipperCode
    FROM dbo.shipment s
    LEFT JOIN dbo.service_type st ON s.fk_service_type = st.pk_service_type
    WHERE s.fk_shipment_state = 4
    ORDER BY s.pk_shipment DESC
  `);

  console.log(`[LP Import] Found ${shipments.length} shipments in state 4`);

  if (shipments.length === 0) {
    return { imported: 0, skipped: 0, total: 0 };
  }

  // Pre-fetch existing lp_ids to avoid duplicates
  const lpIds = shipments.map(s => s.pk_shipment);
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

  // Batch-fetch goods for all shipments in one query
  const { recordset: allGoods } = await mssql.query(`
    SELECT
      g.pk_goods,
      g.fk_shipment,
      g.barcode,
      g.name,
      g.quantity,
      g.unitPrice,
      g.unitCode
    FROM dbo.goods g
    WHERE g.fk_shipment IN (${lpIds.join(',')})
  `);

  // Group goods by shipment
  const goodsByShipment = {};
  for (const g of allGoods) {
    if (!goodsByShipment[g.fk_shipment]) goodsByShipment[g.fk_shipment] = [];
    goodsByShipment[g.fk_shipment].push(g);
  }

  // Batch-fetch barcodes (parcel barcodes) for all shipments
  const { recordset: allBarcodes } = await mssql.query(`
    SELECT
      b.pk_barcode,
      b.fk_shipment,
      b.barcode,
      b.weight,
      b.trackingNumber
    FROM dbo.barcode b
    WHERE b.fk_shipment IN (${lpIds.join(',')})
  `);

  const barcodesByShipment = {};
  for (const b of allBarcodes) {
    if (!barcodesByShipment[b.fk_shipment]) barcodesByShipment[b.fk_shipment] = [];
    barcodesByShipment[b.fk_shipment].push(b);
  }

  let imported = 0;
  let skipped = 0;

  for (const ship of shipments) {
    try {
      if (existingLpIds.has(ship.pk_shipment)) {
        skipped++;
        continue;
      }

      const goods = goodsByShipment[ship.pk_shipment] || [];
      const barcodes = barcodesByShipment[ship.pk_shipment] || [];

      // reference1 = invoice number, reference2 = order number
      const invoiceNumber = (ship.reference1 || '').trim();
      const orderNumber = (ship.reference2 || '').trim();

      // Map shipper code from service_type
      const shipperCode = (ship.shipperCode || '').trim() || null;

      // Build parcels JSON from barcodes
      const lpParcels = barcodes.map(b => ({
        barcode: b.barcode,
        trackingNumber: b.trackingNumber || b.barcode,
        weight: b.weight,
      }));

      // Insert delivery note
      const { data: inserted, error: insertError } = await supabase
        .from('delivery_notes')
        .insert({
          lp_id: ship.pk_shipment,
          nextis_id: null,
          source: 'lp',
          doc_number: `LP${ship.pk_shipment}`,
          invoice_number: invoiceNumber,
          order_number: orderNumber,
          date_issued: ship.dateCreated || null,
          customer_name: (ship.companyOrName || ship.attention || '').trim(),
          customer_email: (ship.email || '').trim(),
          customer_phone: (ship.phone || '').trim(),
          customer_street: (ship.address1 || '').trim(),
          customer_city: (ship.city || '').trim(),
          customer_postal_code: (ship.postalCode || '').trim(),
          customer_country: (ship.countryCode || 'CZ').trim(),
          delivery_street: (ship.address1 || '').trim(),
          delivery_city: (ship.city || '').trim(),
          delivery_postal_code: (ship.postalCode || '').trim(),
          delivery_country: (ship.countryCode || 'CZ').trim(),
          delivery_phone: (ship.phone || '').trim(),
          delivery_email: (ship.email || '').trim(),
          transport_name: ship.service_name || '',
          shipper_code: shipperCode,
          shipper_service: ship.service_name || null,
          amount_netto: 0,
          amount_brutto: 0,
          currency: 'CZK',
          status: 'pending',
          lp_parcels: lpParcels.length > 0 ? lpParcels : null,
        })
        .select()
        .single();

      if (insertError) {
        console.error(`[LP Import] Error inserting shipment ${ship.pk_shipment}:`, insertError.message);
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
          console.error(`[LP Import] Error inserting items for shipment ${ship.pk_shipment}:`, itemsError.message);
        }
      }

      imported++;
    } catch (shipErr) {
      console.error(`[LP Import] Error processing shipment ${ship.pk_shipment}:`, shipErr.message);
    }
  }

  console.log(`[LP Import] Done. Imported: ${imported}, Skipped: ${skipped}`);
  return { imported, skipped, total: shipments.length };
}

module.exports = router;
module.exports.importFromLP = importFromLP;
