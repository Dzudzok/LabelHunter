/**
 * LP Sync — runs on BOLOPC
 * Reads shipments (state=4, Pripraveny) from LP MSSQL
 * and inserts them into Supabase (delivery_notes + delivery_note_items).
 *
 * Usage:
 *   node sync.js              — sync all state=4 shipments
 *   node sync.js --limit 5    — sync max 5 (for testing)
 */

const sql = require('mssql/msnodesqlv8');
const { createClient } = require('@supabase/supabase-js');
const { MSSQL_CONFIG, SUPABASE_URL, SUPABASE_SERVICE_KEY } = require('./config');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Parse --limit arg
const limitArg = process.argv.find(a => a.startsWith('--limit'));
const LIMIT = limitArg ? parseInt(process.argv[process.argv.indexOf(limitArg) + 1]) || null : null;

async function main() {
  let pool;
  try {
    console.log('[LP Sync] Connecting to MSSQL...');
    pool = await sql.connect(MSSQL_CONFIG);
    console.log('[LP Sync] Connected.');

    // 1. Fetch shipments in state 4 (Pripraveny = do zpracovani)
    const topClause = LIMIT ? `TOP ${LIMIT}` : '';
    const { recordset: shipments } = await pool.request().query(`
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
        s.codIndex,
        s.price,
        s.isPaymentInAdvance,
        s.ico,
        st.name AS service_name,
        st.serviceTypeCode AS lp_service_code,
        pt.code AS lp_shipper_code,
        c.iso2Letters AS country_code,
        cur.iso4217 AS currency_code
      FROM dbo.shipment s
      LEFT JOIN dbo.service_type st ON s.fk_service_type = st.pk_service_type
      LEFT JOIN dbo.package_type pt ON st.fk_package_type = pt.pk_package_type
      LEFT JOIN dbo.country c ON s.fk_country = c.pk_country
      LEFT JOIN dbo.currency cur ON s.fk_currency = cur.pk_currency
      WHERE s.fk_shipment_state = 4
      ORDER BY s.pk_shipment DESC
    `);

    console.log(`[LP Sync] Found ${shipments.length} shipments in state 4`);

    if (shipments.length === 0) {
      console.log('[LP Sync] Nothing to import.');
      return;
    }

    // 2. Check which are already imported (dedup by lp_id)
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
    console.log(`[LP Sync] Already imported: ${existingLpIds.size}`);

    // 3. Batch-fetch goods for all shipments
    const { recordset: allGoods } = await pool.request().query(`
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

    const goodsByShipment = {};
    for (const g of allGoods) {
      if (!goodsByShipment[g.fk_shipment]) goodsByShipment[g.fk_shipment] = [];
      goodsByShipment[g.fk_shipment].push(g);
    }

    // 4. Batch-fetch barcodes (parcel barcodes)
    const { recordset: allBarcodes } = await pool.request().query(`
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

    // 5. Import each shipment
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

        const invoiceNumber = (ship.reference1 || '').trim();
        const orderNumber = (ship.reference2 || '').trim();
        const shipperCode = ship.lp_shipper_code || null;
        const serviceCode = ship.lp_service_code || null;
        const isCod = (ship.codIndex || 0) > 0;
        const codAmount = isCod ? (ship.price || 0) : 0;
        const countryCode = (ship.country_code || 'CZ').trim();
        const currencyCode = (ship.currency_code || 'CZK').trim();

        // Parcels from barcode table (skip placeholder barcodes)
        const lpParcels = barcodes
          .filter(b => b.barcode && !b.barcode.includes('PŘEGENEROVÁNO'))
          .map(b => ({
            barcode: b.barcode,
            trackingNumber: b.trackingNumber || b.barcode,
            weight: b.weight,
          }));

        const firstParcel = lpParcels[0] || {};

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
            customer_country: countryCode,
            delivery_street: (ship.address1 || '').trim(),
            delivery_city: (ship.city || '').trim(),
            delivery_postal_code: (ship.postalCode || '').trim(),
            delivery_country: countryCode,
            delivery_phone: (ship.phone || '').trim(),
            delivery_email: (ship.email || '').trim(),
            transport_name: ship.service_name || '',
            shipper_code: shipperCode,
            shipper_service: serviceCode,
            amount_netto: 0,
            amount_brutto: codAmount,
            currency: currencyCode,
            status: 'pending',
            lp_shipment_id: ship.pk_shipment,
            lp_barcode: firstParcel.barcode || null,
            lp_parcels: lpParcels.length > 0 ? lpParcels : null,
            tracking_number: firstParcel.trackingNumber || null,
          })
          .select()
          .single();

        if (insertError) {
          console.error(`[LP Sync] Error inserting shipment ${ship.pk_shipment}:`, insertError.message);
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
            console.error(`[LP Sync] Error inserting items for ${ship.pk_shipment}:`, itemsError.message);
          }
        }

        console.log(`  + ${ship.pk_shipment} | ${invoiceNumber || '-'} | ${(ship.companyOrName || '').substring(0, 30)} | ${goods.length} items`);
        imported++;
      } catch (shipErr) {
        console.error(`[LP Sync] Error processing ${ship.pk_shipment}:`, shipErr.message);
      }
    }

    console.log(`[LP Sync] Done. Imported: ${imported}, Skipped: ${skipped}, Total: ${shipments.length}`);
  } catch (err) {
    console.error('[LP Sync] Fatal error:', err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
  }
}

main();
