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
const nodemailer = require('nodemailer');
const { MSSQL_CONFIG, SUPABASE_URL, SUPABASE_SERVICE_KEY, SMTP_CONFIG, APP_URL, DISABLE_EMAIL, EMAIL_OVERRIDE_TO } = require('./config');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Marketplace email filter
const MARKETPLACE_PATTERN = /@marketplace\.amazon|@kaufland-marktplatz|@kaufland-mark|@allegromail|@members\.ebay/i;

function buildShipmentEmailHtml(dn, items) {
  const trackingLink = `${APP_URL}/tracking/${dn.tracking_token}`;
  const carrierName = dn.transport_name || dn.shipper_code || 'Dopravce';
  const goodsItems = (items || []).filter(i => i.item_type === 'goods');
  const itemsHtml = goodsItems.length > 0 ? `
      <div style="margin:25px 0;">
        <p style="font-size:15px;font-weight:bold;margin-bottom:10px;">Obsah z\u00e1silky:</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr style="background:#0047ab;color:#ffffff;">
            <th style="padding:8px 12px;text-align:left;">K\u00f3d</th>
            <th style="padding:8px 12px;text-align:left;">N\u00e1zev</th>
            <th style="padding:8px 12px;text-align:center;">Ks</th>
          </tr>
          ${goodsItems.map((i, idx) => `
          <tr style="background:${idx % 2 === 0 ? '#f8f9fa' : '#ffffff'};">
            <td style="padding:8px 12px;font-family:monospace;font-weight:bold;">${i.code || '-'}</td>
            <td style="padding:8px 12px;">${i.name || i.text || '-'}</td>
            <td style="padding:8px 12px;text-align:center;">${i.qty || 1}</td>
          </tr>`).join('')}
        </table>
      </div>` : '';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:#0047ab;padding:30px;text-align:center;">
      <img src="https://ckeditor.nextis.cz/filemanager/uploads/0E1D0AF7179CBD54DA902DDFAFD59F3F/MROdesign_2022_2%20(1).png" alt="MROAUTO" style="width:180px;height:auto;border-radius:8px;" />
      <p style="color:#ffffff;margin:12px 0 0;font-size:15px;font-weight:bold;">Va\u0161e z\u00e1silka byla odesl\u00e1na!</p>
    </div>
    <div style="padding:30px;color:#333333;line-height:1.7;">
      <p style="font-size:16px;">Dobr\u00fd den${dn.customer_name ? ', <strong>' + dn.customer_name + '</strong>' : ''},</p>
      <p style="font-size:15px;">s radost\u00ed V\u00e1m oznamujeme, \u017ee Va\u0161e z\u00e1silka byla odesl\u00e1na a je na cest\u011b!</p>
      <div style="background:#f0f4ff;border-left:4px solid #0047ab;padding:18px;margin:25px 0;border-radius:0 8px 8px 0;">
        <strong>Faktura:</strong> ${dn.invoice_number || '-'}<br>
        <strong>Objedn\u00e1vka:</strong> ${dn.order_number || '-'}<br>
        <strong>Dopravce:</strong> ${carrierName}<br>
        <strong>Sledovac\u00ed \u010d\u00edslo:</strong> ${dn.tracking_number || dn.lp_barcode || '-'}
        ${dn.tracking_url ? '<br><a href="' + dn.tracking_url + '" style="color:#0047ab;font-weight:bold;">Sledovat u dopravce</a>' : ''}
      </div>${itemsHtml}
      <p style="text-align:center;margin:30px 0;">
        <a href="${trackingLink}" style="display:inline-block;padding:16px 36px;background:#e31e24;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;">Sledovat z\u00e1silku</a>
      </p>
      <p style="margin-top:25px;font-size:14px;color:#666;">V p\u0159\u00edpad\u011b dotaz\u016f n\u00e1s nev\u00e1hejte kontaktovat.</p>
      <p style="font-size:14px;">S pozdravem,<br><strong>T\u00fdm MROAUTO</strong></p>
    </div>
    <div style="background:#0047ab;padding:20px;text-align:center;color:#c0d0f0;font-size:12px;">
      <p style="margin:0 0 5px;">MROAUTO AUTOD\u00cdLY s.r.o. | \u010cs. arm\u00e1dy 360, Pudlov, 735 51 Bohum\u00edn</p>
      <p style="margin:0;">Tel: +420 774 917 859 | <a href="mailto:info@mroauto.cz" style="color:#ffffff;">info@mroauto.cz</a></p>
    </div>
  </div>
</body></html>`;
}

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
        s.deliveryPointId AS shipment_deliveryPointId,
        dp.deliveryPointId AS delivery_point_external_id,
        st.name AS service_name,
        st.serviceTypeCode AS lp_service_code,
        pt.code AS lp_shipper_code,
        c.iso2Letters AS country_code,
        cur.iso4217 AS currency_code
      FROM dbo.shipment s
      LEFT JOIN dbo.service_type st ON s.fk_service_type = st.pk_service_type
      LEFT JOIN dbo.package_type pt ON st.fk_package_type = pt.pk_package_type
      LEFT JOIN dbo.delivery_point dp ON s.fk_delivery_point = dp.pk_delivery_point
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

    // 3b. Batch-fetch goods_alternative (EAN barcodes) for all goods
    const allGoodsPks = allGoods.map(g => g.pk_goods);
    const altByGoods = {};
    if (allGoodsPks.length > 0) {
      for (let i = 0; i < allGoodsPks.length; i += 500) {
        const chunk = allGoodsPks.slice(i, i + 500);
        const { recordset: alts } = await pool.request().query(`
          SELECT fk_goods, barcode FROM dbo.goods_alternative
          WHERE fk_goods IN (${chunk.join(',')})
        `);
        for (const a of alts) {
          if (!altByGoods[a.fk_goods]) altByGoods[a.fk_goods] = [];
          altByGoods[a.fk_goods].push(a.barcode);
        }
      }
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
        const codAmount = isCod ? (ship.price || 0) : 0;  // dobírka = ship.price when COD
        const countryCode = (ship.country_code || 'CZ').trim();
        const currencyCode = (ship.currency_code || 'CZK').trim();

        // Cena zásilky = sum of goods value
        let shipmentValue = 0;
        for (const g of goods) {
          shipmentValue += (g.unitPrice || 0) * (g.quantity || 0);
        }

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
            amount_netto: shipmentValue,
            amount_brutto: shipmentValue,
            cod_amount: codAmount,
            weight: ship.weight || 0,
            delivery_point_id: (ship.delivery_point_external_id || ship.shipment_deliveryPointId || '').trim() || null,
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
          const itemRecords = goods.map(g => {
            const eans = altByGoods[g.pk_goods] || [];
            return {
              delivery_note_id: inserted.id,
              nextis_item_id: null,
              item_type: 'goods',
              code: (g.barcode || '').trim(),
              ean: eans.join(',') || null,
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
            };
          });

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

    // 6. Update MSSQL state for shipments that have labels generated in LabelHunter
    console.log('[LP Sync] Checking for labeled shipments to update in MSSQL...');
    const STATE_PRINTED = 2;

    // Fetch LP shipments from Supabase that have labels generated
    let labeledLpIds = [];
    let sbPage = 0;
    const SB_PAGE = 1000;
    while (true) {
      const { data, error: sbErr } = await supabase
        .from('delivery_notes')
        .select('lp_id')
        .eq('source', 'lp')
        .not('lp_id', 'is', null)
        .not('label_pdf_url', 'is', null)
        .range(sbPage * SB_PAGE, (sbPage + 1) * SB_PAGE - 1);
      if (sbErr) { console.error('[LP Sync] Supabase error:', sbErr.message); break; }
      if (!data || data.length === 0) break;
      labeledLpIds = labeledLpIds.concat(data.map(d => d.lp_id));
      if (data.length < SB_PAGE) break;
      sbPage++;
    }

    if (labeledLpIds.length > 0) {
      // Find which of these are still in state 4 in MSSQL
      const idList = labeledLpIds.join(',');
      const { recordset: stillState4 } = await pool.request().query(`
        SELECT pk_shipment FROM dbo.shipment
        WHERE pk_shipment IN (${idList}) AND fk_shipment_state = 4
      `);

      if (stillState4.length > 0) {
        const updateIds = stillState4.map(r => r.pk_shipment).join(',');
        await pool.request().query(`
          UPDATE dbo.shipment SET fk_shipment_state = ${STATE_PRINTED}
          WHERE pk_shipment IN (${updateIds})
        `);
        console.log(`[LP Sync] Updated ${stillState4.length} shipments to state ${STATE_PRINTED} (Tištěný)`);
      } else {
        console.log('[LP Sync] No shipments to update in MSSQL.');
      }
    } else {
      console.log('[LP Sync] No labeled shipments found.');
    }

    // 6b. Mark pending packages as shipped if they were printed in desktop LP (state ≠ 4)
    console.log('[LP Sync] Checking for packages printed in desktop LP...');
    let pendingLpIds = [];
    let pendingPage = 0;
    while (true) {
      const { data, error: pErr } = await supabase
        .from('delivery_notes')
        .select('id, lp_id')
        .eq('source', 'lp')
        .eq('status', 'pending')
        .not('lp_id', 'is', null)
        .range(pendingPage * SB_PAGE, (pendingPage + 1) * SB_PAGE - 1);
      if (pErr) { console.error('[LP Sync] Pending query error:', pErr.message); break; }
      if (!data || data.length === 0) break;
      pendingLpIds = pendingLpIds.concat(data);
      if (data.length < SB_PAGE) break;
      pendingPage++;
    }

    if (pendingLpIds.length > 0) {
      const lpIdList = pendingLpIds.map(d => d.lp_id).join(',');
      // Only mark as shipped if state is 2 (printed) or 3 (cancelled)
      // State 1 (unprinted) = still needs processing, keep as pending
      const { recordset: notState4 } = await pool.request().query(`
        SELECT pk_shipment FROM dbo.shipment
        WHERE pk_shipment IN (${lpIdList}) AND fk_shipment_state IN (2, 3)
      `);

      if (notState4.length > 0) {
        const notState4Set = new Set(notState4.map(r => r.pk_shipment));
        const toUpdate = pendingLpIds.filter(d => notState4Set.has(d.lp_id)).map(d => d.id);

        for (let i = 0; i < toUpdate.length; i += 100) {
          const chunk = toUpdate.slice(i, i + 100);
          await supabase
            .from('delivery_notes')
            .update({ status: 'shipped', updated_at: new Date().toISOString() })
            .in('id', chunk);
        }
        console.log(`[LP Sync] Marked ${notState4.length} packages as shipped (printed in desktop LP)`);
      } else {
        console.log('[LP Sync] No desktop-printed packages to update.');
      }
    }

    // 7. Send pending shipment emails from BOLOPC (SMTP works here, not from Render)
    if (DISABLE_EMAIL) {
      console.log('[LP Sync] Email sending disabled (DISABLE_EMAIL=true in config.js)');
    } else {
    console.log('[LP Sync] Checking for pending emails...');
    let pendingEmails = [];
    let emailPage = 0;
    while (true) {
      const { data, error: eErr } = await supabase
        .from('delivery_notes')
        .select('id, customer_name, customer_email, delivery_email, invoice_number, order_number, transport_name, shipper_code, tracking_number, lp_barcode, tracking_url, tracking_token')
        .not('label_pdf_url', 'is', null)
        .is('email_sent_at', null)
        .range(emailPage * SB_PAGE, (emailPage + 1) * SB_PAGE - 1);
      if (eErr) { console.error('[LP Sync] Email query error:', eErr.message); break; }
      if (!data || data.length === 0) break;
      pendingEmails = pendingEmails.concat(data);
      if (data.length < SB_PAGE) break;
      emailPage++;
    }

    if (pendingEmails.length > 0) {
      const transporter = nodemailer.createTransport({
        host: SMTP_CONFIG.host,
        port: SMTP_CONFIG.port,
        secure: SMTP_CONFIG.secure,
        auth: SMTP_CONFIG.auth,
      });

      let emailsSent = 0;
      let emailsSkipped = 0;

      for (const dn of pendingEmails) {
        const originalEmail = dn.delivery_email || dn.customer_email;
        if (!originalEmail) { emailsSkipped++; continue; }
        if (MARKETPLACE_PATTERN.test(originalEmail)) {
          console.log(`  [Email] Skipped marketplace: ${originalEmail}`);
          // Mark as sent so we don't retry
          await supabase.from('delivery_notes')
            .update({ email_sent_at: new Date().toISOString(), status: 'shipped' })
            .eq('id', dn.id);
          emailsSkipped++;
          continue;
        }

        // Override: send all emails to test address if configured
        const emailTo = EMAIL_OVERRIDE_TO || originalEmail;

        // Fetch items for this delivery note
        const { data: items } = await supabase
          .from('delivery_note_items')
          .select('*')
          .eq('delivery_note_id', dn.id)
          .order('id');

        try {
          await transporter.sendMail({
            from: SMTP_CONFIG.from,
            to: emailTo,
            subject: `Vaše zásilka od MROAUTO byla odeslána! | Objednávka ${dn.order_number || ''}`,
            html: buildShipmentEmailHtml(dn, items),
          });

          await supabase.from('delivery_notes')
            .update({ email_sent_at: new Date().toISOString(), status: 'shipped' })
            .eq('id', dn.id);

          console.log(`  [Email] Sent to ${emailTo}${EMAIL_OVERRIDE_TO ? ` (override, original: ${originalEmail})` : ''} (${dn.invoice_number || dn.id})`);
          emailsSent++;

          // 2s delay between emails (Gmail rate limit)
          if (emailsSent % 10 === 0) await new Promise(r => setTimeout(r, 2000));
        } catch (emailErr) {
          console.error(`  [Email] FAILED ${emailTo}: ${emailErr.message}`);
        }
      }

      transporter.close();
      console.log(`[LP Sync] Emails: sent=${emailsSent}, skipped=${emailsSkipped}, total=${pendingEmails.length}`);
    } else {
      console.log('[LP Sync] No pending emails.');
    }
    } // end DISABLE_EMAIL check
  } catch (err) {
    console.error('[LP Sync] Fatal error:', err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
  }
}

main();
