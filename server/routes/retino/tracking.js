const express = require('express');
const router = express.Router();
const supabase = require('../../db/supabase');
const { getUnifiedStatus, getStatusLabel, getStatusColor, STATUS_LABELS } = require('../../services/retino/tracking-status-mapper');

// Dashboard cache — refreshes max every 2 minutes
let dashboardCache = null;
let dashboardCacheTime = 0;
const CACHE_TTL = 2 * 60 * 1000; // 2 min

// GET /dashboard — status counts + carrier stats (last 30 days)
router.get('/dashboard', async (req, res, next) => {
  try {
    const now = Date.now();
    if (dashboardCache && (now - dashboardCacheTime) < CACHE_TTL) {
      return res.json(dashboardCache);
    }

    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Paginate to get ALL notes (Supabase default limit is 1000)
    let notes = [];
    let offset = 0;
    const PAGE = 1000;
    while (true) {
      const { data: batch, error } = await supabase
        .from('delivery_notes')
        .select('id, unified_status, shipper_code')
        .not('tracking_number', 'is', null)
        .gte('date_issued', thirtyDaysAgo)
        .range(offset, offset + PAGE - 1);

      if (error) throw error;
      if (!batch || batch.length === 0) break;
      notes = notes.concat(batch);
      if (batch.length < PAGE) break;
      offset += PAGE;
    }

    // Status counts
    const statusCounts = {};
    for (const key of Object.keys(STATUS_LABELS)) {
      statusCounts[key] = 0;
    }
    const carrierStats = {};

    for (const note of notes) {
      const s = note.unified_status || 'unknown';
      statusCounts[s] = (statusCounts[s] || 0) + 1;

      const carrier = note.shipper_code || 'unknown';
      if (!carrierStats[carrier]) carrierStats[carrier] = { total: 0, delivered: 0, in_transit: 0, problem: 0 };
      carrierStats[carrier].total++;
      if (s === 'delivered') carrierStats[carrier].delivered++;
      if (['in_transit', 'out_for_delivery', 'handed_to_carrier'].includes(s)) carrierStats[carrier].in_transit++;
      if (['failed_delivery', 'returned_to_sender', 'problem'].includes(s)) carrierStats[carrier].problem++;
    }

    dashboardCache = {
      total: notes.length,
      statusCounts,
      carrierStats,
      statusLabels: STATUS_LABELS,
    };
    dashboardCacheTime = now;

    res.json(dashboardCache);
  } catch (err) {
    next(err);
  }
});

// GET /shipments — list with filters + pagination
router.get('/shipments', async (req, res, next) => {
  try {
    const {
      status, shipper, dateFrom, dateTo, search,
      page = 1, pageSize = 50, sortBy = 'date_issued', sortDir = 'desc',
    } = req.query;

    let query = supabase
      .from('delivery_notes')
      .select('id, doc_number, invoice_number, order_number, date_issued, customer_name, customer_email, shipper_code, tracking_number, tracking_url, unified_status, last_tracking_update, last_tracking_description, status', { count: 'exact' })
      .not('tracking_number', 'is', null);

    if (status) {
      const statuses = status.split(',');
      if (statuses.length === 1) query = query.eq('unified_status', status);
      else query = query.in('unified_status', statuses);
    }
    if (shipper) query = query.eq('shipper_code', shipper);
    if (dateFrom) query = query.gte('date_issued', `${dateFrom}T00:00:00.000Z`);
    if (dateTo) query = query.lte('date_issued', `${dateTo}T23:59:59.999Z`);
    if (search) {
      query = query.or(`doc_number.ilike.%${search}%,tracking_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_email.ilike.%${search}%,invoice_number.ilike.%${search}%`);
    }

    const from = (parseInt(page) - 1) * parseInt(pageSize);
    const to = from + parseInt(pageSize) - 1;
    query = query.order(sortBy, { ascending: sortDir === 'asc' }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({
      shipments: data || [],
      total: count || 0,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      totalPages: Math.ceil((count || 0) / parseInt(pageSize)),
    });
  } catch (err) {
    next(err);
  }
});

// GET /shipments/:id — detail + items + tracking timeline
router.get('/shipments/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Fetch delivery note
    const { data: note, error: noteErr } = await supabase
      .from('delivery_notes')
      .select('*')
      .eq('id', id)
      .single();

    if (noteErr || !note) return res.status(404).json({ error: 'Shipment not found' });

    // Fetch items
    const { data: items } = await supabase
      .from('delivery_note_items')
      .select('*')
      .eq('delivery_note_id', id)
      .order('id');

    // Fetch tracking timeline from tracking_sync_log
    const { data: logs } = await supabase
      .from('tracking_sync_log')
      .select('tracking_data, synced_at')
      .eq('delivery_note_id', id)
      .order('synced_at', { ascending: false })
      .limit(1);

    // Parse tracking items from latest log
    let trackingTimeline = [];
    if (logs && logs.length > 0) {
      const td = logs[0].tracking_data;
      const data = td?.data || td;
      const shipments = Array.isArray(data) ? data : [data];
      for (const s of shipments) {
        for (const item of (s?.trackingItems || [])) {
          trackingTimeline.push({
            date: item.date,
            description: item.description,
            location: item.placeOfEvent || null,
            postalCode: item.postalCode || null,
            unifiedStatus: getUnifiedStatus({ data: [{ trackingItems: [item] }] }).status,
          });
        }
      }
      // Sort chronologically descending (newest first)
      trackingTimeline.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }

    res.json({
      ...note,
      statusLabel: getStatusLabel(note.unified_status),
      statusColor: getStatusColor(note.unified_status),
      items: items || [],
      trackingTimeline,
    });
  } catch (err) {
    next(err);
  }
});

// GET /carriers — show which carrier APIs are configured
router.get('/carriers', async (req, res) => {
  const carrierRouter = require('../../services/carriers/CarrierRouter');
  res.json(carrierRouter.getConfiguredCarriers());
});

// POST /sync-jjd — fetch JJD numbers from PPL CPL API for PPL DHL shipments
router.post('/sync-jjd', async (req, res, next) => {
  try {
    const pplService = require('../../services/carriers/PPLService');

    if (!pplService.isConfigured()) {
      return res.status(400).json({ error: 'PPL API not configured' });
    }

    // Get all PPL DHL shipments (tracking_number starting with 207) without JJD
    let allPPLDHL = [];
    let offset = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('delivery_notes')
        .select('id, tracking_number, doc_number, jjd_number')
        .eq('shipper_code', 'PPL')
        .is('jjd_number', null)
        .not('tracking_number', 'is', null)
        .like('tracking_number', '207%')
        .range(offset, offset + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allPPLDHL = allPPLDHL.concat(data);
      if (data.length < PAGE) break;
      offset += PAGE;
    }

    if (allPPLDHL.length === 0) {
      return res.json({ message: 'All PPL DHL shipments already have JJD numbers', synced: 0 });
    }

    // Batch fetch JJD numbers
    const trackingNumbers = allPPLDHL.map(s => s.tracking_number);
    const jjdMap = await pplService.batchGetJJDNumbers(trackingNumbers);

    // Update delivery_notes with JJD numbers
    let synced = 0;
    for (const shipment of allPPLDHL) {
      const jjd = jjdMap[shipment.tracking_number];
      if (jjd) {
        await supabase
          .from('delivery_notes')
          .update({ jjd_number: jjd })
          .eq('id', shipment.id);
        synced++;
      }
    }

    res.json({
      message: `JJD sync complete`,
      total: allPPLDHL.length,
      synced,
      notFound: allPPLDHL.length - synced,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
