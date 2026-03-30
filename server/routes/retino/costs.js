const express = require('express');
const router = express.Router();
const supabase = require('../../db/supabase');
const XLSX = require('xlsx');

// GET /analytics — aggregate cost analytics
router.get('/analytics', async (req, res, next) => {
  try {
    const { days = 30, shipper } = req.query;
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - Number(days));
    const dateFromStr = dateFrom.toISOString().split('T')[0];

    // Paginated fetch to get ALL cost records (Supabase default limit is 1000)
    let costs = [];
    let offset = 0;
    const PAGE = 1000;
    while (true) {
      let query = supabase
        .from('shipping_costs')
        .select('id, shipper_code, cost_amount, revenue_amount, invoice_date, created_at, delivery_note_id')
        .gte('created_at', dateFromStr)
        .range(offset, offset + PAGE - 1);
      if (shipper) query = query.eq('shipper_code', shipper);
      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) break;
      costs = costs.concat(data);
      if (data.length < PAGE) break;
      offset += PAGE;
    }

    let totalRevenue = 0;
    let totalCost = 0;
    const byCarrier = {};
    const byMonthMap = {};
    let unmatchedInvoices = 0;

    for (const row of costs) {
      const rev = Number(row.revenue_amount) || 0;
      const cost = Number(row.cost_amount) || 0;
      totalRevenue += rev;
      totalCost += cost;

      if (!row.delivery_note_id) {
        unmatchedInvoices++;
      }

      // By carrier
      const carrier = row.shipper_code || 'Neznámý';
      if (!byCarrier[carrier]) {
        byCarrier[carrier] = { revenue: 0, cost: 0, margin: 0, count: 0 };
      }
      byCarrier[carrier].revenue += rev;
      byCarrier[carrier].cost += cost;
      byCarrier[carrier].margin += rev - cost;
      byCarrier[carrier].count++;

      // By month
      const date = row.invoice_date || row.created_at;
      const month = date ? String(date).substring(0, 7) : 'unknown';
      if (!byMonthMap[month]) {
        byMonthMap[month] = { month, revenue: 0, cost: 0, margin: 0 };
      }
      byMonthMap[month].revenue += rev;
      byMonthMap[month].cost += cost;
      byMonthMap[month].margin += rev - cost;
    }

    const totalMargin = totalRevenue - totalCost;
    const marginPercent = totalRevenue > 0 ? ((totalMargin / totalRevenue) * 100) : 0;

    const byMonth = Object.values(byMonthMap).sort((a, b) => a.month.localeCompare(b.month));

    res.json({
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      totalMargin: Math.round(totalMargin * 100) / 100,
      marginPercent: Math.round(marginPercent * 100) / 100,
      analyzedShipments: (costs || []).length,
      byCarrier,
      byMonth,
      unmatchedInvoices,
    });
  } catch (err) {
    next(err);
  }
});

// Carrier CSV column mappings — maps known carrier CSV headers to our fields
// Each carrier can have multiple possible header names (aliases)
const CARRIER_MAPPINGS = {
  GLS: {
    shipper_code: 'GLS',
    tracking: ['číslo balíku / parcel number', 'číslo balíku', 'parcel number', 'parcel_number', 'cislo baliku', 'parcelno'],
    cost: ['celková cena / total amount', 'celková cena', 'total amount', 'cena přepravy / transport fee', 'cena přepravy', 'price', 'cena', 'cena bez dph'],
    weight: ['váha / weight / size', 'váha / weight', 'váha', 'weight', 'vaha', 'hmotnost'],
    invoice: ['číslo faktury / invoice number', 'číslo faktury', 'invoice number', 'invoice', 'faktura', 'cislo faktury'],
    date: ['datum vystavení faktury / invoice date', 'datum vystavení faktury', 'invoice date', 'date', 'datum', 'datum faktury'],
    // Extra GLS-specific fields
    sheetName: 'rozpis k doručení',
  },
  PPL: {
    shipper_code: 'PPL',
    tracking: ['shipment number', 'shipmentnumber', 'cislo zasilky', 'číslo zásilky', 'tracking', 'consignment number'],
    cost: ['price', 'total price', 'amount', 'cena', 'cena celkem', 'castka', 'price czk', 'cena bez dph'],
    weight: ['weight', 'weight kg', 'vaha', 'váha', 'hmotnost'],
    invoice: ['invoice', 'invoice no', 'faktura', 'cislo faktury'],
    date: ['date', 'invoice date', 'datum', 'datum faktury'],
  },
  DPD: {
    shipper_code: 'DPD',
    tracking: ['parcel no', 'parcel number', 'tracking number', 'cislo baliku', 'reference'],
    cost: ['net amount', 'amount', 'price', 'total', 'cena', 'castka'],
    weight: ['weight', 'actual weight', 'vaha', 'váha'],
    invoice: ['invoice', 'invoice number', 'faktura'],
    date: ['date', 'invoice date', 'datum'],
  },
  Zasilkovna: {
    shipper_code: 'Zasilkovna',
    tracking: ['barcode', 'cislo zasilky', 'číslo zásilky', 'tracking number', 'id zasilky', 'zásilka'],
    cost: ['cena', 'castka', 'price', 'celkem', 'cena za dopravu'],
    weight: ['hmotnost', 'vaha', 'váha', 'weight'],
    invoice: ['faktura', 'cislo faktury', 'invoice'],
    date: ['datum', 'date', 'datum faktury'],
  },
  UPS: {
    shipper_code: 'UPS',
    tracking: ['tracking number', 'shipment id', 'package id', 'tracking'],
    cost: ['net charge', 'total charge', 'charge amount', 'amount', 'price'],
    weight: ['billed weight', 'actual weight', 'weight'],
    invoice: ['invoice number', 'invoice', 'invoice no'],
    date: ['invoice date', 'date', 'ship date'],
  },
  CP: {
    shipper_code: 'CP',
    tracking: ['podaci cislo', 'podací číslo', 'cislo zasilky', 'číslo zásilky', 'tracking'],
    cost: ['cena', 'castka', 'částka', 'poplatek', 'cena celkem'],
    weight: ['hmotnost', 'vaha', 'váha', 'weight'],
    invoice: ['faktura', 'cislo faktury', 'číslo faktury'],
    date: ['datum', 'datum podani', 'datum podání', 'date'],
  },
};

// Find best matching column index from CSV headers using aliases
function findColumn(headers, aliases) {
  if (!aliases) return -1;
  for (const alias of aliases) {
    const idx = headers.indexOf(alias);
    if (idx >= 0) return idx;
  }
  // Fuzzy: try partial match
  for (const alias of aliases) {
    const idx = headers.findIndex(h => h.includes(alias) || alias.includes(h));
    if (idx >= 0) return idx;
  }
  return -1;
}

// Auto-detect carrier from CSV headers
function detectCarrier(headers) {
  let bestCarrier = null;
  let bestScore = 0;
  for (const [carrier, mapping] of Object.entries(CARRIER_MAPPINGS)) {
    let score = 0;
    if (findColumn(headers, mapping.tracking) >= 0) score += 3;
    if (findColumn(headers, mapping.cost) >= 0) score += 2;
    if (findColumn(headers, mapping.weight) >= 0) score += 1;
    if (score > bestScore) {
      bestScore = score;
      bestCarrier = carrier;
    }
  }
  return bestCarrier;
}

// Parse number from various formats: "1 234,56" -> 1234.56, "1.234,56" -> 1234.56
function parseAmount(str) {
  if (!str) return 0;
  let clean = String(str).trim();
  // If has both dot and comma, determine which is decimal
  if (clean.includes(',') && clean.includes('.')) {
    if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
      // 1.234,56 format
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      // 1,234.56 format
      clean = clean.replace(/,/g, '');
    }
  } else if (clean.includes(',')) {
    clean = clean.replace(/\s/g, '').replace(',', '.');
  } else {
    clean = clean.replace(/\s/g, '');
  }
  return parseFloat(clean) || 0;
}

// GET /carrier-mappings — return available carrier mappings for frontend
router.get('/carrier-mappings', (req, res) => {
  const mappings = Object.keys(CARRIER_MAPPINGS);
  res.json(mappings);
});

// POST /import — CSV/XLSX import with auto-detection or explicit carrier mapping
router.post('/import', express.raw({ type: '*/*', limit: '20mb' }), async (req, res, next) => {
  try {
    const carrierParam = req.query.carrier; // optional: explicit carrier selection
    const sheetParam = req.query.sheet; // optional: sheet name/index for XLSX

    // Detect if binary XLSX or text CSV
    const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
    let lines;

    // Check for XLSX magic bytes (PK zip header)
    const isXlsx = buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4B;

    if (isXlsx) {
      const workbook = XLSX.read(buf, { type: 'buffer' });

      // Pick sheet: explicit param > carrier-specific sheet > first sheet
      let sheetName;
      if (sheetParam) {
        sheetName = workbook.SheetNames.find(s => s.toLowerCase() === sheetParam.toLowerCase()) || workbook.SheetNames[0];
      } else if (carrierParam && CARRIER_MAPPINGS[carrierParam]?.sheetName) {
        const preferred = CARRIER_MAPPINGS[carrierParam].sheetName;
        sheetName = workbook.SheetNames.find(s => s.toLowerCase() === preferred) || workbook.SheetNames[0];
      } else {
        sheetName = workbook.SheetNames[0];
      }

      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ';' });
      lines = csv.split(/\r?\n/).filter(l => l.trim());
    } else {
      const raw = buf.toString('utf8');
      lines = raw.split(/\r?\n/).filter(l => l.trim());
    }

    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV musí mít hlavičku a alespoň jeden řádek dat' });
    }

    // Detect delimiter
    const headerLine = lines[0];
    const delimiter = headerLine.includes(';') ? ';' : headerLine.includes('\t') ? '\t' : ',';

    const headers = headerLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

    // Determine carrier mapping
    let carrier = carrierParam || null;
    let mapping = carrier ? CARRIER_MAPPINGS[carrier] : null;

    if (!mapping) {
      // Auto-detect from headers
      carrier = detectCarrier(headers);
      mapping = carrier ? CARRIER_MAPPINGS[carrier] : null;
    }

    // Find column indices — use mapping aliases or fallback to standard names
    let iTrack, iCost, iWeight, iInvoice, iDate, iShipper;

    if (mapping) {
      iTrack = findColumn(headers, mapping.tracking);
      iCost = findColumn(headers, mapping.cost);
      iWeight = findColumn(headers, mapping.weight);
      iInvoice = findColumn(headers, mapping.invoice);
      iDate = findColumn(headers, mapping.date);
      iShipper = -1; // carrier is known from mapping
    } else {
      // Fallback: standard column names
      iTrack = findColumn(headers, ['tracking_number', 'tracking', 'trackingnumber']);
      iCost = findColumn(headers, ['cost_amount', 'cost', 'price', 'amount', 'cena']);
      iWeight = findColumn(headers, ['weight_kg', 'weight', 'vaha']);
      iInvoice = findColumn(headers, ['invoice_number', 'invoice', 'faktura']);
      iDate = findColumn(headers, ['invoice_date', 'date', 'datum']);
      iShipper = findColumn(headers, ['shipper_code', 'shipper', 'carrier', 'dopravce']);
    }

    if (iTrack === -1) {
      return res.status(400).json({
        error: 'Nepodařilo se najít sloupec s tracking číslem',
        detectedCarrier: carrier,
        headers,
      });
    }

    const shipperCode = mapping?.shipper_code || null;

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
      const trackingNumber = String(cols[iTrack] || '').trim();
      if (!trackingNumber) continue;

      rows.push({
        tracking_number: trackingNumber,
        shipper_code: shipperCode || (iShipper >= 0 ? cols[iShipper] || null : null),
        cost_amount: iCost >= 0 ? parseAmount(cols[iCost]) : 0,
        revenue_amount: 0,
        weight_kg: iWeight >= 0 ? parseAmount(cols[iWeight]) || null : null,
        invoice_number: iInvoice >= 0 ? cols[iInvoice] || null : null,
        invoice_date: iDate >= 0 ? cols[iDate] || null : null,
      });
    }

    // Match tracking numbers to delivery_notes (in batches to avoid URL length limits)
    const noteMap = {};
    const trackingNumbers = rows.map(r => r.tracking_number);
    const MATCH_BATCH = 200;
    for (let i = 0; i < trackingNumbers.length; i += MATCH_BATCH) {
      const batch = trackingNumbers.slice(i, i + MATCH_BATCH);
      const { data: notes, error: notesErr } = await supabase
        .from('delivery_notes')
        .select('id, tracking_number, shipper_code')
        .in('tracking_number', batch);
      if (notesErr) throw notesErr;
      for (const n of notes || []) {
        noteMap[n.tracking_number] = n;
      }
    }

    let matched = 0;
    let unmatched = 0;
    const toInsert = rows.map(row => {
      const note = noteMap[row.tracking_number];
      if (note) {
        matched++;
        return {
          ...row,
          delivery_note_id: note.id,
          shipper_code: row.shipper_code || note.shipper_code,
        };
      } else {
        unmatched++;
        return { ...row, delivery_note_id: null };
      }
    });

    // Insert in batches of 500
    const BATCH = 500;
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const batch = toInsert.slice(i, i + BATCH);
      const { error: insertErr } = await supabase.from('shipping_costs').insert(batch);
      if (insertErr) throw insertErr;
    }

    // Sample tracking numbers for debugging matching issues
    const sampleImported = rows.slice(0, 3).map(r => r.tracking_number);

    res.json({
      imported: toInsert.length,
      matched,
      unmatched,
      detectedCarrier: carrier,
      columnsUsed: {
        tracking: iTrack >= 0 ? headers[iTrack] : null,
        cost: iCost >= 0 ? headers[iCost] : null,
        weight: iWeight >= 0 ? headers[iWeight] : null,
        invoice: iInvoice >= 0 ? headers[iInvoice] : null,
        date: iDate >= 0 ? headers[iDate] : null,
      },
      sampleTrackingNumbers: sampleImported,
    });
  } catch (err) {
    next(err);
  }
});

// Keywords that identify a shipping/transport line item in Nextis CSV
const SHIPPING_KEYWORDS = [
  'gls', 'ppl', 'dpd', 'zasilkovna', 'zásilkovna', 'česká pošta', 'ceska posta',
  'doprava', 'shipping', 'přeprava', 'preprava', 'poštovné', 'postovne',
  'fofr', 'gopay', 'dobírka', 'dobirka', 'mezinárodní doprava',
];

function isShippingItem(description) {
  if (!description) return false;
  const lower = description.toLowerCase();
  return SHIPPING_KEYWORDS.some(kw => lower.includes(kw));
}

// POST /import-revenue — import revenue from Nextis export (item-level CSV with shipping lines)
// Format: Popis položky;Typ položky;Datum prodeje;Druh dokladu;Číslo dokladu;Název odběratele;Množství;PC
router.post('/import-revenue', express.raw({ type: '*/*', limit: '20mb' }), async (req, res, next) => {
  try {
    const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
    let lines;

    const isXlsx = buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4B;

    if (isXlsx) {
      const workbook = XLSX.read(buf, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ';' });
      lines = csv.split(/\r?\n/).filter(l => l.trim());
    } else {
      const raw = buf.toString('utf8');
      lines = raw.split(/\r?\n/).filter(l => l.trim());
    }

    if (lines.length < 2) {
      return res.status(400).json({ error: 'Soubor musí mít hlavičku a alespoň jeden řádek dat' });
    }

    const headerLine = lines[0];
    const delimiter = headerLine.includes(';') ? ';' : headerLine.includes('\t') ? '\t' : ',';
    const headers = headerLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, '').replace(/^\uFEFF/, ''));

    // Find columns — Nextis format
    const iDescription = findColumn(headers, ['popis položky', 'popis polozky', 'popis', 'nazev', 'název']);
    const iInvoice = findColumn(headers, ['číslo dokladu', 'cislo dokladu', 'číslo faktury', 'cislo faktury', 'doklad', 'faktura']);
    const iPrice = findColumn(headers, ['pc', 'cena', 'částka', 'castka', 'price', 'amount']);

    if (iInvoice === -1) {
      return res.status(400).json({ error: 'Nepodařilo se najít sloupec s číslem dokladu', headers });
    }
    if (iPrice === -1) {
      return res.status(400).json({ error: 'Nepodařilo se najít sloupec s cenou (PC)', headers });
    }

    // Parse rows — only keep shipping-related items
    // Group by invoice number (one FV can have multiple shipping lines: balné + doprava)
    const revenueByInvoice = {};
    let totalRows = 0;
    let shippingRows = 0;
    let skippedRows = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
      totalRows++;

      const description = iDescription >= 0 ? cols[iDescription] || '' : '';
      const invoiceNumber = String(cols[iInvoice] || '').trim();
      if (!invoiceNumber) continue;

      // Filter: only shipping items (if description column exists)
      if (iDescription >= 0 && !isShippingItem(description)) {
        skippedRows++;
        continue;
      }

      const price = parseAmount(cols[iPrice]);
      if (price <= 0) continue;

      shippingRows++;
      // Sum multiple shipping lines per invoice (balné + doprava)
      revenueByInvoice[invoiceNumber] = (revenueByInvoice[invoiceNumber] || 0) + price;
    }

    const invoiceNumbers = Object.keys(revenueByInvoice);
    if (invoiceNumbers.length === 0) {
      return res.status(400).json({ error: 'Žádné řádky s dopravou nalezeny' });
    }

    // Match invoice numbers to delivery_notes
    const noteMap = {};
    const MATCH_BATCH = 200;
    for (let i = 0; i < invoiceNumbers.length; i += MATCH_BATCH) {
      const batch = invoiceNumbers.slice(i, i + MATCH_BATCH);
      const { data: notes, error } = await supabase
        .from('delivery_notes')
        .select('id, invoice_number, tracking_number')
        .in('invoice_number', batch);
      if (error) throw error;
      for (const n of notes || []) {
        noteMap[n.invoice_number] = n;
      }
    }

    // Update/create shipping_costs with revenue
    let updated = 0;
    let created = 0;
    let notFound = 0;

    for (const [invoiceNumber, revenue] of Object.entries(revenueByInvoice)) {
      const note = noteMap[invoiceNumber];
      if (!note) {
        notFound++;
        continue;
      }

      if (note.tracking_number) {
        const { data: existing } = await supabase
          .from('shipping_costs')
          .select('id')
          .eq('tracking_number', note.tracking_number)
          .limit(1)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('shipping_costs')
            .update({ revenue_amount: revenue })
            .eq('id', existing.id);
          updated++;
        } else {
          await supabase
            .from('shipping_costs')
            .insert({
              delivery_note_id: note.id,
              tracking_number: note.tracking_number,
              revenue_amount: revenue,
              cost_amount: 0,
            });
          created++;
        }
      }
    }

    res.json({
      totalRows,
      shippingRows,
      skippedRows,
      uniqueInvoices: invoiceNumbers.length,
      updated,
      created,
      notFound,
    });
  } catch (err) {
    next(err);
  }
});

// GET / — list cost records with pagination + filters
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 50, shipper, dateFrom, dateTo } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('shipping_costs')
      .select('*, delivery_notes(id, tracking_number, order_number)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (shipper) query = query.eq('shipper_code', shipper);
    if (dateFrom) query = query.gte('invoice_date', dateFrom);
    if (dateTo) query = query.lte('invoice_date', dateTo);

    const { data, count, error } = await query;
    if (error) throw error;

    res.json({ data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
});

// POST / — manual single cost entry
router.post('/', async (req, res, next) => {
  try {
    const {
      delivery_note_id,
      shipper_code,
      tracking_number,
      invoice_number,
      cost_amount,
      revenue_amount,
      weight_kg,
      currency,
      invoice_date,
    } = req.body;

    const { data, error } = await supabase
      .from('shipping_costs')
      .insert({
        delivery_note_id: delivery_note_id || null,
        shipper_code,
        tracking_number,
        invoice_number,
        cost_amount: cost_amount || 0,
        revenue_amount: revenue_amount || 0,
        weight_kg: weight_kg || null,
        currency: currency || 'CZK',
        invoice_date: invoice_date || null,
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// DELETE /:id — delete cost record
router.delete('/:id', async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('shipping_costs')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
