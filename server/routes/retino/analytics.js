const express = require('express');
const router = express.Router();
const supabase = require('../../db/supabase');
const { STATUS_LABELS } = require('../../services/retino/tracking-status-mapper');
const eddService = require('../../services/EDDService');

const PAGE = 1000;

// Statuses to exclude from analytics — no real tracking data
const EXCLUDED_STATUSES = ['unknown', 'label_created'];

// Helper: paginated fetch of delivery_notes
async function fetchAllNotes(select, filters = {}) {
  let all = [];
  let offset = 0;
  while (true) {
    let q = supabase.from('delivery_notes').select(select).not('tracking_number', 'is', null);
    // Exclude unknown + label_created by default (unless caller explicitly wants a specific status)
    if (!filters.status && !filters.includeAll) {
      q = q.not('unified_status', 'in', `(${EXCLUDED_STATUSES.join(',')})`);
    }
    if (filters.dateFrom) q = q.gte('date_issued', filters.dateFrom);
    if (filters.dateTo) q = q.lte('date_issued', filters.dateTo);
    if (filters.shipper) q = q.eq('shipper_code', filters.shipper);
    if (filters.status) q = q.eq('unified_status', filters.status);
    if (filters.notStatus) q = q.neq('unified_status', filters.notStatus);
    q = q.range(offset, offset + PAGE - 1);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

// Cache for analytics (max 50 entries to prevent memory leak)
let analyticsCache = {};
const CACHE_TTL = 3 * 60 * 1000; // 3 min
const CACHE_MAX_ENTRIES = 50;

function getCacheKey(name, query) {
  const sortedKeys = Object.keys(query).sort();
  const stable = sortedKeys.map(k => `${k}=${query[k]}`).join('&');
  return `${name}:${stable}`;
}

function setCache(key, data) {
  const keys = Object.keys(analyticsCache);
  if (keys.length >= CACHE_MAX_ENTRIES) {
    // Remove oldest entry
    let oldest = null, oldestTime = Infinity;
    for (const k of keys) {
      if (analyticsCache[k].time < oldestTime) { oldest = k; oldestTime = analyticsCache[k].time; }
    }
    if (oldest) delete analyticsCache[oldest];
  }
  analyticsCache[key] = { data, time: Date.now() };
}

// GET /overview — carrier performance, volume trends, status breakdown
router.get('/overview', async (req, res, next) => {
  try {
    const { days = '90', shipper } = req.query;
    const cacheKey = getCacheKey('overview', { days, shipper });
    const now = Date.now();
    if (analyticsCache[cacheKey] && (now - analyticsCache[cacheKey].time) < CACHE_TTL) {
      return res.json(analyticsCache[cacheKey].data);
    }

    const daysNum = parseInt(days) || 90;
    const dateFrom = new Date(now - daysNum * 24 * 60 * 60 * 1000).toISOString();
    const filters = { dateFrom };
    if (shipper) filters.shipper = shipper;

    const notes = await fetchAllNotes(
      'id, unified_status, shipper_code, date_issued, label_generated_at, last_tracking_update',
      filters
    );

    // Status counts (only tracked statuses — unknown & label_created excluded by query)
    const statusCounts = {};
    const activeStatuses = Object.keys(STATUS_LABELS).filter(s => !EXCLUDED_STATUSES.includes(s));
    for (const key of activeStatuses) statusCounts[key] = 0;

    // Carrier performance
    const carriers = {};

    // Volume by day
    const dailyVolume = {};

    for (const note of notes) {
      const s = note.unified_status || 'unknown';
      if (EXCLUDED_STATUSES.includes(s)) continue; // safety net
      statusCounts[s] = (statusCounts[s] || 0) + 1;

      // Carrier stats
      const c = note.shipper_code || 'Neznámý';
      if (!carriers[c]) {
        carriers[c] = { total: 0, delivered: 0, in_transit: 0, problem: 0, pickup: 0 };
      }
      carriers[c].total++;
      if (s === 'delivered') carriers[c].delivered++;
      else if (['in_transit', 'out_for_delivery', 'handed_to_carrier'].includes(s)) carriers[c].in_transit++;
      else if (['failed_delivery', 'returned_to_sender', 'problem'].includes(s)) carriers[c].problem++;
      else if (s === 'available_for_pickup') carriers[c].pickup++;

      // Daily volume
      const day = (note.date_issued || '').substring(0, 10);
      if (day) dailyVolume[day] = (dailyVolume[day] || 0) + 1;
    }

    // Build carrier table with percentages
    const carrierTable = Object.entries(carriers)
      .map(([code, stats]) => ({
        carrier: code,
        total: stats.total,
        delivered: stats.delivered,
        deliveredPct: stats.total > 0 ? Math.round((stats.delivered / stats.total) * 1000) / 10 : 0,
        in_transit: stats.in_transit,
        inTransitPct: stats.total > 0 ? Math.round((stats.in_transit / stats.total) * 1000) / 10 : 0,
        problem: stats.problem,
        problemPct: stats.total > 0 ? Math.round((stats.problem / stats.total) * 1000) / 10 : 0,
        pickup: stats.pickup,
        pickupPct: stats.total > 0 ? Math.round((stats.pickup / stats.total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Volume trend (sorted by date)
    const volumeTrend = Object.entries(dailyVolume)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    // Overall KPIs
    const total = notes.length;
    const delivered = statusCounts.delivered || 0;
    const deliveryRate = total > 0 ? Math.round((delivered / total) * 1000) / 10 : 0;

    const result = {
      total,
      delivered,
      deliveryRate,
      statusCounts,
      statusLabels: Object.fromEntries(activeStatuses.map(s => [s, STATUS_LABELS[s]])),
      carrierTable,
      volumeTrend,
      days: daysNum,
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /delivery-time — delivery time distribution per carrier (with country filter)
router.get('/delivery-time', async (req, res, next) => {
  try {
    const { days = '90', shipper, country } = req.query;
    const cacheKey = getCacheKey('delivery-time', { days, shipper, country: country || '' });
    const now = Date.now();
    if (analyticsCache[cacheKey] && (now - analyticsCache[cacheKey].time) < CACHE_TTL) {
      return res.json(analyticsCache[cacheKey].data);
    }

    const daysNum = parseInt(days) || 90;
    const dateFrom = new Date(now - daysNum * 24 * 60 * 60 * 1000).toISOString();
    const filters = { dateFrom, status: 'delivered' };
    if (shipper) filters.shipper = shipper;

    const notes = await fetchAllNotes(
      'id, shipper_code, date_issued, label_generated_at, last_tracking_update, delivered_at, delivery_country',
      filters
    );

    // Filter by country if specified
    const filtered = country
      ? notes.filter(n => (n.delivery_country || 'CZ').toUpperCase() === country.toUpperCase())
      : notes;

    // Collect unique countries for filter dropdown
    const countrySet = new Set();
    for (const n of notes) countrySet.add((n.delivery_country || 'CZ').toUpperCase());
    const countries = [...countrySet].sort();

    // Calculate delivery days for each shipment
    // Prefer delivered_at over last_tracking_update for more accurate end date
    const deliveryDays = [];
    const byCarrier = {};

    for (const note of filtered) {
      const startDate = note.label_generated_at || note.date_issued;
      const endDate = note.delivered_at || note.last_tracking_update;
      if (!startDate || !endDate) continue;

      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffMs = end - start;
      if (diffMs < 0) continue; // skip invalid

      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const bucket = days >= 7 ? '7+' : String(days);
      deliveryDays.push({ days, bucket, carrier: note.shipper_code || 'Neznámý' });

      const c = note.shipper_code || 'Neznámý';
      if (!byCarrier[c]) byCarrier[c] = { totalDays: 0, count: 0, buckets: {} };
      byCarrier[c].totalDays += days;
      byCarrier[c].count++;
      byCarrier[c].buckets[bucket] = (byCarrier[c].buckets[bucket] || 0) + 1;
    }

    // Overall distribution
    const distribution = { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7+': 0 };
    for (const d of deliveryDays) {
      distribution[d.bucket] = (distribution[d.bucket] || 0) + 1;
    }

    const totalMeasured = deliveryDays.length;
    const avgDays = totalMeasured > 0
      ? Math.round((deliveryDays.reduce((sum, d) => sum + d.days, 0) / totalMeasured) * 10) / 10
      : null;

    // Distribution as percentages
    const distributionPct = {};
    for (const [k, v] of Object.entries(distribution)) {
      distributionPct[k] = totalMeasured > 0 ? Math.round((v / totalMeasured) * 1000) / 10 : 0;
    }

    // Per-carrier averages
    const carrierAvg = Object.entries(byCarrier)
      .map(([carrier, stats]) => ({
        carrier,
        avgDays: stats.count > 0 ? Math.round((stats.totalDays / stats.count) * 10) / 10 : null,
        count: stats.count,
        buckets: stats.buckets,
      }))
      .sort((a, b) => b.count - a.count);

    const result = {
      totalMeasured,
      avgDays,
      distribution,
      distributionPct,
      carrierAvg,
      countries,
      days: daysNum,
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /problems — problem shipments analysis
router.get('/problems', async (req, res, next) => {
  try {
    const { days = '90', shipper } = req.query;
    const cacheKey = getCacheKey('problems', { days, shipper });
    const now = Date.now();
    if (analyticsCache[cacheKey] && (now - analyticsCache[cacheKey].time) < CACHE_TTL) {
      return res.json(analyticsCache[cacheKey].data);
    }

    const daysNum = parseInt(days) || 90;
    const dateFrom = new Date(now - daysNum * 24 * 60 * 60 * 1000).toISOString();
    const filters = { dateFrom };
    if (shipper) filters.shipper = shipper;

    const notes = await fetchAllNotes(
      'id, doc_number, customer_name, shipper_code, date_issued, unified_status, last_tracking_description, tracking_number',
      filters
    );

    const problemStatuses = ['failed_delivery', 'returned_to_sender', 'problem'];
    const problems = notes.filter(n => problemStatuses.includes(n.unified_status));
    const total = notes.length;

    // Problem breakdown by status
    const byStatus = {};
    for (const s of problemStatuses) byStatus[s] = 0;
    for (const p of problems) {
      byStatus[p.unified_status] = (byStatus[p.unified_status] || 0) + 1;
    }

    // Problem breakdown by carrier
    const byCarrier = {};
    for (const p of problems) {
      const c = p.shipper_code || 'Neznámý';
      if (!byCarrier[c]) byCarrier[c] = { total: 0, failed_delivery: 0, returned_to_sender: 0, problem: 0 };
      byCarrier[c].total++;
      byCarrier[c][p.unified_status] = (byCarrier[c][p.unified_status] || 0) + 1;
    }

    const carrierProblems = Object.entries(byCarrier)
      .map(([carrier, stats]) => {
        // Find total shipments for this carrier
        const carrierTotal = notes.filter(n => (n.shipper_code || 'Neznámý') === carrier).length;
        return {
          carrier,
          problems: stats.total,
          carrierTotal,
          problemRate: carrierTotal > 0 ? Math.round((stats.total / carrierTotal) * 1000) / 10 : 0,
          failed_delivery: stats.failed_delivery,
          returned_to_sender: stats.returned_to_sender,
          problem: stats.problem,
        };
      })
      .sort((a, b) => b.problems - a.problems);

    // Daily problem trend
    const dailyProblems = {};
    for (const p of problems) {
      const day = (p.date_issued || '').substring(0, 10);
      if (day) dailyProblems[day] = (dailyProblems[day] || 0) + 1;
    }
    const problemTrend = Object.entries(dailyProblems)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    // Recent problem shipments (last 20)
    const recentProblems = problems
      .sort((a, b) => (b.date_issued || '').localeCompare(a.date_issued || ''))
      .slice(0, 20)
      .map(p => ({
        id: p.id,
        doc_number: p.doc_number,
        customer_name: p.customer_name,
        shipper_code: p.shipper_code,
        date_issued: p.date_issued,
        status: p.unified_status,
        statusLabel: STATUS_LABELS[p.unified_status] || p.unified_status,
        description: p.last_tracking_description,
        tracking_number: p.tracking_number,
      }));

    const result = {
      totalShipments: total,
      totalProblems: problems.length,
      problemRate: total > 0 ? Math.round((problems.length / total) * 1000) / 10 : 0,
      byStatus,
      carrierProblems,
      problemTrend,
      recentProblems,
      days: daysNum,
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /timeliness — timeliness analytics (with country filter)
router.get('/timeliness', async (req, res, next) => {
  try {
    const { days = '90', shipper, country } = req.query;
    const cacheKey = getCacheKey('timeliness', { days, shipper, country: country || '' });
    const now = Date.now();
    if (analyticsCache[cacheKey] && (now - analyticsCache[cacheKey].time) < CACHE_TTL) {
      return res.json(analyticsCache[cacheKey].data);
    }

    const daysNum = parseInt(days) || 90;
    const dateFrom = new Date(now - daysNum * 24 * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from('delivery_notes')
      .select('id, timeliness, shipper_code, expected_delivery_date, last_tracking_update, unified_status, delivery_country')
      .not('expected_delivery_date', 'is', null)
      .gte('date_issued', dateFrom);

    if (shipper) query = query.eq('shipper_code', shipper);

    // Paginated fetch
    let all = [];
    let offset = 0;
    while (true) {
      const { data, error } = await query.range(offset, offset + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < PAGE) break;
      offset += PAGE;
      // Re-create query for next page
      query = supabase
        .from('delivery_notes')
        .select('id, timeliness, shipper_code, expected_delivery_date, last_tracking_update, unified_status, delivery_country')
        .not('expected_delivery_date', 'is', null)
        .gte('date_issued', dateFrom);
      if (shipper) query = query.eq('shipper_code', shipper);
    }

    // Collect unique countries
    const countrySet = new Set();
    for (const n of all) countrySet.add((n.delivery_country || 'CZ').toUpperCase());
    const countries = [...countrySet].sort();

    // Filter by country if specified
    const filtered = country
      ? all.filter(n => (n.delivery_country || 'CZ').toUpperCase() === country.toUpperCase())
      : all;

    let onTime = 0, late = 0, early = 0, inProgressOnTime = 0, inProgressLate = 0;
    const byCarrier = {};

    for (const note of filtered) {
      const t = note.timeliness;
      if (!t) continue;

      if (t === 'on_time') onTime++;
      else if (t === 'late') late++;
      else if (t === 'early') early++;
      else if (t === 'in_progress_on_time') inProgressOnTime++;
      else if (t === 'in_progress_late') inProgressLate++;

      const c = note.shipper_code || 'Neznamy';
      if (!byCarrier[c]) byCarrier[c] = { onTime: 0, late: 0, early: 0, total: 0 };
      byCarrier[c].total++;
      if (t === 'on_time' || t === 'early') byCarrier[c].onTime++;
      if (t === 'early') byCarrier[c].early++;
      if (t === 'late') byCarrier[c].late++;
    }

    const total = filtered.length;
    const onTimePercent = total > 0 ? Math.round(((onTime + early) / total) * 1000) / 10 : 0;

    const byCarrierResult = {};
    for (const [carrier, stats] of Object.entries(byCarrier)) {
      byCarrierResult[carrier] = {
        onTime: stats.onTime,
        late: stats.late,
        early: stats.early,
        total: stats.total,
        percent: stats.total > 0 ? Math.round((stats.onTime / stats.total) * 1000) / 10 : 0,
      };
    }

    const result = {
      onTime,
      late,
      early,
      inProgressOnTime,
      inProgressLate,
      total,
      onTimePercent,
      byCarrier: byCarrierResult,
      countries,
      days: daysNum,
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /edd-config — list all edd_config entries
router.get('/edd-config', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('edd_config')
      .select('*')
      .order('shipper_code');

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

// POST /edd-config — upsert edd_config
router.post('/edd-config', async (req, res, next) => {
  try {
    const { shipper_code, country_code = 'CZ', business_days, count_weekends = false } = req.body;

    if (!shipper_code || !business_days) {
      return res.status(400).json({ error: 'shipper_code and business_days are required' });
    }

    const { data, error } = await supabase
      .from('edd_config')
      .upsert(
        { shipper_code, country_code, business_days: parseInt(business_days), count_weekends },
        { onConflict: 'shipper_code,country_code' }
      )
      .select()
      .single();

    if (error) throw error;

    // Clear analytics cache
    analyticsCache = {};

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /tt-analytics — Track & Trace page view analytics
router.get('/tt-analytics', async (req, res, next) => {
  try {
    const { days = '30' } = req.query;
    const cacheKey = getCacheKey('tt-analytics', { days });
    const now = Date.now();
    if (analyticsCache[cacheKey] && (now - analyticsCache[cacheKey].time) < CACHE_TTL) {
      return res.json(analyticsCache[cacheKey].data);
    }

    const daysNum = parseInt(days) || 30;
    const dateFrom = new Date(now - daysNum * 24 * 60 * 60 * 1000).toISOString();

    // Fetch all page views in period
    let allViews = [];
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from('tt_page_views')
        .select('id, delivery_note_id, tracking_token, ip_address, viewed_at')
        .gte('viewed_at', dateFrom)
        .range(offset, offset + PAGE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;
      allViews = allViews.concat(data);
      if (data.length < PAGE) break;
      offset += PAGE;
    }

    const totalViews = allViews.length;
    const uniqueIPs = new Set(allViews.map(v => v.ip_address).filter(Boolean));
    const uniqueVisitors = uniqueIPs.size;

    // Views by day
    const viewsByDayMap = {};
    for (const v of allViews) {
      const day = (v.viewed_at || '').substring(0, 10);
      if (day) viewsByDayMap[day] = (viewsByDayMap[day] || 0) + 1;
    }
    const viewsByDay = Object.entries(viewsByDayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, views]) => ({ date, views }));

    // Top shipments by views
    const byToken = {};
    for (const v of allViews) {
      const token = v.tracking_token;
      if (!token) continue;
      if (!byToken[token]) byToken[token] = { tracking_token: token, delivery_note_id: v.delivery_note_id, views: 0 };
      byToken[token].views++;
    }
    const topTokens = Object.values(byToken).sort((a, b) => b.views - a.views).slice(0, 20);

    // Enrich top shipments with doc_number and tracking_number
    let topShipments = [];
    if (topTokens.length > 0) {
      const noteIds = topTokens.map(t => t.delivery_note_id).filter(Boolean);
      if (noteIds.length > 0) {
        const { data: notes } = await supabase
          .from('delivery_notes')
          .select('id, doc_number, tracking_number')
          .in('id', noteIds);

        const noteMap = {};
        for (const n of (notes || [])) noteMap[n.id] = n;

        topShipments = topTokens.map(t => ({
          doc_number: noteMap[t.delivery_note_id]?.doc_number || '-',
          tracking_number: noteMap[t.delivery_note_id]?.tracking_number || '-',
          views: t.views,
        }));
      }
    }

    const result = {
      totalViews,
      uniqueVisitors,
      viewsByDay,
      topShipments,
      days: daysNum,
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
