const express = require('express');
const router = express.Router();
const supabase = require('../../db/supabase');

// GET /analytics — aggregate cost analytics
router.get('/analytics', async (req, res) => {
  try {
    const { days = 30, shipper } = req.query;
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - Number(days));
    const dateFromStr = dateFrom.toISOString().split('T')[0];

    let query = supabase
      .from('shipping_costs')
      .select('*, delivery_notes(id, tracking_number, shipper_code, date_issued)')
      .gte('created_at', dateFromStr);

    if (shipper) {
      query = query.eq('shipper_code', shipper);
    }

    const { data: costs, error } = await query;
    if (error) throw error;

    let totalRevenue = 0;
    let totalCost = 0;
    const byCarrier = {};
    const byMonthMap = {};
    let unmatchedInvoices = 0;

    for (const row of costs || []) {
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
    console.error('Cost analytics error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /import — CSV import of cost data
router.post('/import', express.text({ type: '*/*', limit: '10mb' }), async (req, res) => {
  try {
    const raw = typeof req.body === 'string' ? req.body : String(req.body);
    const lines = raw.split(/\r?\n/).filter(l => l.trim());

    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV must have a header row and at least one data row' });
    }

    // Detect delimiter
    const headerLine = lines[0];
    const delimiter = headerLine.includes(';') ? ';' : ',';

    const headers = headerLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

    const colIndex = (name) => {
      const idx = headers.indexOf(name);
      return idx;
    };

    const iTrack = colIndex('tracking_number');
    const iShipper = colIndex('shipper_code');
    const iCost = colIndex('cost_amount');
    const iRevenue = colIndex('revenue_amount');
    const iWeight = colIndex('weight_kg');
    const iInvoice = colIndex('invoice_number');
    const iDate = colIndex('invoice_date');

    if (iTrack === -1) {
      return res.status(400).json({ error: 'CSV must contain a tracking_number column' });
    }

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
      const trackingNumber = cols[iTrack] || '';
      if (!trackingNumber) continue;

      rows.push({
        tracking_number: trackingNumber,
        shipper_code: iShipper >= 0 ? cols[iShipper] || null : null,
        cost_amount: iCost >= 0 ? parseFloat(cols[iCost]) || 0 : 0,
        revenue_amount: iRevenue >= 0 ? parseFloat(cols[iRevenue]) || 0 : 0,
        weight_kg: iWeight >= 0 ? parseFloat(cols[iWeight]) || null : null,
        invoice_number: iInvoice >= 0 ? cols[iInvoice] || null : null,
        invoice_date: iDate >= 0 ? cols[iDate] || null : null,
      });
    }

    // Match tracking numbers to delivery_notes
    const trackingNumbers = rows.map(r => r.tracking_number);
    const { data: notes, error: notesErr } = await supabase
      .from('delivery_notes')
      .select('id, tracking_number, shipper_code')
      .in('tracking_number', trackingNumbers);

    if (notesErr) throw notesErr;

    const noteMap = {};
    for (const n of notes || []) {
      noteMap[n.tracking_number] = n;
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

    res.json({ imported: toInsert.length, matched, unmatched });
  } catch (err) {
    console.error('Cost import error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET / — list cost records with pagination + filters
router.get('/', async (req, res) => {
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
    console.error('Cost list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST / — manual single cost entry
router.post('/', async (req, res) => {
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
    console.error('Cost create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id — delete cost record
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('shipping_costs')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('Cost delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
