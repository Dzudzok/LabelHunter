const express = require('express');
const router = express.Router();
const supabase = require('../../db/supabase');

// GET /overview — returns overview stats
router.get('/overview', async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    const { data: returns } = await supabase
      .from('returns')
      .select('id, type, status, reason_code, resolution_type, resolution_amount, requested_at, resolved_at')
      .gte('requested_at', since.toISOString());

    const data = returns || [];
    const total = data.length;

    // Status breakdown
    const byStatus = {};
    data.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });

    // Type breakdown
    const byType = {};
    data.forEach(r => { byType[r.type] = (byType[r.type] || 0) + 1; });

    // Resolution type breakdown
    const byResolution = {};
    data.filter(r => r.resolution_type).forEach(r => {
      byResolution[r.resolution_type] = (byResolution[r.resolution_type] || 0) + 1;
    });

    // Avg resolution time (days)
    const resolved = data.filter(r => r.resolved_at && r.requested_at);
    const avgResolutionDays = resolved.length > 0
      ? resolved.reduce((sum, r) => {
          const diff = (new Date(r.resolved_at) - new Date(r.requested_at)) / (1000 * 60 * 60 * 24);
          return sum + diff;
        }, 0) / resolved.length
      : null;

    // Total refund amount
    const totalRefunded = data
      .filter(r => r.resolution_type === 'refund' && r.resolution_amount)
      .reduce((sum, r) => sum + parseFloat(r.resolution_amount), 0);

    res.json({
      total,
      byStatus,
      byType,
      byResolution,
      avgResolutionDays: avgResolutionDays ? parseFloat(avgResolutionDays.toFixed(1)) : null,
      totalRefunded: parseFloat(totalRefunded.toFixed(2)),
      resolvedCount: resolved.length,
    });
  } catch (err) {
    next(err);
  }
});

// GET /reasons — top return reasons
router.get('/reasons', async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    const { data } = await supabase
      .from('returns')
      .select('reason_code, type')
      .gte('requested_at', since.toISOString());

    const reasons = {};
    (data || []).forEach(r => {
      const key = r.reason_code || 'unknown';
      if (!reasons[key]) reasons[key] = { code: key, count: 0, byType: {} };
      reasons[key].count++;
      reasons[key].byType[r.type] = (reasons[key].byType[r.type] || 0) + 1;
    });

    // Fetch reason labels
    const { data: reasonDefs } = await supabase
      .from('return_reasons')
      .select('code, label_cs');

    const labelMap = {};
    (reasonDefs || []).forEach(r => { labelMap[r.code] = r.label_cs; });

    const result = Object.values(reasons)
      .map(r => ({ ...r, label: labelMap[r.code] || r.code }))
      .sort((a, b) => b.count - a.count);

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /resolution-time — resolution time distribution
router.get('/resolution-time', async (req, res, next) => {
  try {
    const { days = 90 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    const { data } = await supabase
      .from('returns')
      .select('type, requested_at, resolved_at')
      .not('resolved_at', 'is', null)
      .gte('requested_at', since.toISOString());

    const buckets = { '0-1': 0, '1-3': 0, '3-7': 0, '7-14': 0, '14+': 0 };
    const byType = {};

    (data || []).forEach(r => {
      const diffDays = (new Date(r.resolved_at) - new Date(r.requested_at)) / (1000 * 60 * 60 * 24);
      let bucket;
      if (diffDays <= 1) bucket = '0-1';
      else if (diffDays <= 3) bucket = '1-3';
      else if (diffDays <= 7) bucket = '3-7';
      else if (diffDays <= 14) bucket = '7-14';
      else bucket = '14+';

      buckets[bucket]++;

      if (!byType[r.type]) byType[r.type] = { total: 0, sumDays: 0 };
      byType[r.type].total++;
      byType[r.type].sumDays += diffDays;
    });

    const byTypeResult = Object.entries(byType).map(([type, d]) => ({
      type,
      count: d.total,
      avgDays: parseFloat((d.sumDays / d.total).toFixed(1)),
    }));

    res.json({ buckets, byType: byTypeResult });
  } catch (err) {
    next(err);
  }
});

// GET /by-product — returns by product
router.get('/by-product', async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    const { data: returns } = await supabase
      .from('returns')
      .select('id')
      .gte('requested_at', since.toISOString());

    if (!returns?.length) return res.json([]);

    const returnIds = returns.map(r => r.id);
    const { data: items } = await supabase
      .from('return_items')
      .select('delivery_note_item_id, qty_returned, delivery_note_items(code, brand, text)')
      .in('return_id', returnIds);

    const products = {};
    (items || []).forEach(i => {
      const key = i.delivery_note_items?.code || 'unknown';
      if (!products[key]) {
        products[key] = {
          code: key,
          brand: i.delivery_note_items?.brand || '',
          text: i.delivery_note_items?.text || '',
          returnCount: 0,
          totalQty: 0,
        };
      }
      products[key].returnCount++;
      products[key].totalQty += i.qty_returned || 1;
    });

    const result = Object.values(products).sort((a, b) => b.returnCount - a.returnCount).slice(0, 50);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /trend — daily returns count for chart
router.get('/trend', async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    const { data } = await supabase
      .from('returns')
      .select('requested_at, type')
      .gte('requested_at', since.toISOString())
      .order('requested_at');

    // Group by date
    const daily = {};
    (data || []).forEach(r => {
      const date = r.requested_at?.slice(0, 10);
      if (!daily[date]) daily[date] = { date, count: 0, byType: {} };
      daily[date].count++;
      daily[date].byType[r.type] = (daily[date].byType[r.type] || 0) + 1;
    });

    res.json(Object.values(daily));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
