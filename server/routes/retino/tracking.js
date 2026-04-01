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
    if (dateFrom) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) return res.status(400).json({ error: 'Invalid dateFrom format (YYYY-MM-DD)' });
      query = query.gte('date_issued', `${dateFrom}T00:00:00.000Z`);
    }
    if (dateTo) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) return res.status(400).json({ error: 'Invalid dateTo format (YYYY-MM-DD)' });
      query = query.lte('date_issued', `${dateTo}T23:59:59.999Z`);
    }
    if (search) {
      const s = String(search).slice(0, 100);
      query = query.or(`doc_number.ilike.%${s}%,tracking_number.ilike.%${s}%,customer_name.ilike.%${s}%,customer_email.ilike.%${s}%,invoice_number.ilike.%${s}%`);
    }

    const from = (parseInt(page) - 1) * parseInt(pageSize);
    const to = from + parseInt(pageSize) - 1;
    query = query.order(sortBy, { ascending: sortDir === 'asc' }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    // Fetch tags for all shipments in this page
    let shipments = data || [];
    if (shipments.length > 0) {
      const ids = shipments.map(s => s.id);
      const { data: tagLinks } = await supabase
        .from('delivery_note_tags')
        .select('delivery_note_id, shipment_tags(id, name, color, bg_color)')
        .in('delivery_note_id', ids);

      if (tagLinks && tagLinks.length > 0) {
        const tagMap = {};
        for (const link of tagLinks) {
          if (!tagMap[link.delivery_note_id]) tagMap[link.delivery_note_id] = [];
          if (link.shipment_tags) tagMap[link.delivery_note_id].push(link.shipment_tags);
        }
        shipments = shipments.map(s => ({ ...s, tags: tagMap[s.id] || [] }));
      } else {
        shipments = shipments.map(s => ({ ...s, tags: [] }));
      }
    }

    res.json({
      shipments,
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

// GET /depot-stuck — shipments sitting at pickup point for N+ days
router.get('/depot-stuck', async (req, res, next) => {
  try {
    const minDays = parseInt(req.query.minDays) || 4;
    const page = parseInt(req.query.page) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize) || 50, 200);
    const offset = (page - 1) * pageSize;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - minDays);

    const { data, error, count } = await supabase
      .from('delivery_notes')
      .select('id, doc_number, invoice_number, customer_name, shipper_code, tracking_number, unified_status, date_issued, pickup_at, last_tracking_update', { count: 'exact' })
      .eq('unified_status', 'available_for_pickup')
      .not('tracking_number', 'is', null)
      .order('date_issued', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    const now = new Date();
    const shipments = (data || [])
      .map(s => {
        const pickupDate = s.pickup_at || s.last_tracking_update || s.date_issued;
        const daysAtDepot = pickupDate
          ? Math.floor((now - new Date(pickupDate)) / (1000 * 60 * 60 * 24))
          : 0;
        return { ...s, days_at_depot: daysAtDepot };
      })
      .filter(s => s.days_at_depot >= minDays);

    res.json({ shipments, total: shipments.length });
  } catch (err) {
    next(err);
  }
});

// GET /expiring — shipments available_for_pickup nearing storage expiry ("brzy se bude vracet")
router.get('/expiring', async (req, res, next) => {
  try {
    const { days = 2, page = 1, pageSize = 50 } = req.query;

    // Default storage limits by carrier (days)
    const CARRIER_STORAGE_DAYS = {
      GLS: 7, PPL: 7, DPD: 7, UPS: 5,
      Zasilkovna: 7, ZASILKOVNA: 7,
      CP: 15, INTIME: 7, InTime: 7,
    };

    // Get all available_for_pickup shipments
    let all = [];
    let offset = 0;
    const PAGE = 1000;
    while (true) {
      const { data: batch, error } = await supabase
        .from('delivery_notes')
        .select('id, doc_number, customer_name, customer_email, shipper_code, tracking_number, unified_status, pickup_at, stored_until, last_tracking_description, date_issued')
        .eq('unified_status', 'available_for_pickup')
        .range(offset, offset + PAGE - 1);
      if (error) throw error;
      if (!batch || batch.length === 0) break;
      all = all.concat(batch);
      if (batch.length < PAGE) break;
      offset += PAGE;
    }

    const now = new Date();
    const daysThreshold = parseInt(days);

    // Calculate expiry for each and filter
    const expiring = all.map(s => {
      const storageDays = CARRIER_STORAGE_DAYS[s.shipper_code] || 7;
      const pickupDate = s.pickup_at ? new Date(s.pickup_at) : (s.date_issued ? new Date(s.date_issued) : now);
      const expiryDate = s.stored_until ? new Date(s.stored_until) : new Date(pickupDate.getTime() + storageDays * 24 * 60 * 60 * 1000);
      const daysLeft = Math.ceil((expiryDate - now) / (24 * 60 * 60 * 1000));
      return { ...s, expiry_date: expiryDate.toISOString(), days_left: daysLeft, storage_days: storageDays };
    }).filter(s => s.days_left <= daysThreshold && s.days_left >= -3) // include recently expired (up to 3 days ago)
      .sort((a, b) => a.days_left - b.days_left);

    const total = expiring.length;
    const from = (parseInt(page) - 1) * parseInt(pageSize);
    const paged = expiring.slice(from, from + parseInt(pageSize));

    res.json({
      shipments: paged,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(pageSize)),
    });
  } catch (err) {
    next(err);
  }
});

// POST /extend-storage/:id — extend storage period at carrier pickup point
router.post('/extend-storage/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const storageService = require('../../services/StorageExtensionService');

    const { data: note, error } = await supabase
      .from('delivery_notes')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !note) return res.status(404).json({ error: 'Zásilka nenalezena' });

    if (note.unified_status !== 'available_for_pickup') {
      return res.status(400).json({ error: 'Prodloužení je možné pouze pro zásilky čekající na vyzvednutí' });
    }

    const result = await storageService.extendStorage(note);
    res.json(result);
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

    // Update delivery_notes with JJD numbers (batched)
    const updates = allPPLDHL
      .filter(s => jjdMap[s.tracking_number])
      .map(s => ({ id: s.id, jjd: jjdMap[s.tracking_number] }));

    // Batch update in chunks of 100
    let synced = 0;
    for (let i = 0; i < updates.length; i += 100) {
      const chunk = updates.slice(i, i + 100);
      const ids = chunk.map(u => u.id);
      // Update each unique JJD value
      const byJjd = {};
      for (const u of chunk) {
        if (!byJjd[u.jjd]) byJjd[u.jjd] = [];
        byJjd[u.jjd].push(u.id);
      }
      await Promise.all(Object.entries(byJjd).map(([jjd, shipIds]) =>
        supabase.from('delivery_notes').update({ jjd_number: jjd }).in('id', shipIds)
      ));
      synced += chunk.length;
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

// POST /shipments/:id/send-email — send manual email to customer from shipment detail
router.post('/shipments/:id/send-email', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { subject, message } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ error: 'Předmět a zpráva jsou povinné' });
    }
    if (subject.length > 200) {
      return res.status(400).json({ error: 'Předmět je příliš dlouhý (max 200 znaků)' });
    }

    // Fetch delivery note
    const { data: note, error } = await supabase
      .from('delivery_notes')
      .select('id, doc_number, customer_email, customer_name, tracking_number, tracking_token, order_number, shipper_code, transport_name, unified_status')
      .eq('id', id)
      .single();
    if (error || !note) {
      return res.status(404).json({ error: 'Zásilka nenalezena' });
    }

    if (process.env.DISABLE_EMAIL_RETURO === 'true') {
      return res.status(400).json({ error: 'Odesílání e-mailů je vypnuto (DISABLE_EMAIL_RETURO=true)' });
    }

    const TrackingEmailService = require('../../services/TrackingEmailService');
    const recipient = TrackingEmailService.prototype.getRecipient(note);
    if (!recipient) {
      return res.status(400).json({ error: 'Zákazník nemá e-mailovou adresu' });
    }

    const from = TrackingEmailService.prototype.getFromAddress();
    const trackingLink = TrackingEmailService.prototype.getTrackingLink(note);

    // Build simple HTML email
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1046A0; padding: 20px; text-align: center;">
          <h2 style="color: white; margin: 0;">MROAUTO AUTODÍLY</h2>
        </div>
        <div style="padding: 24px; background: #fff;">
          <p>Dobrý den${note.customer_name ? `, ${note.customer_name}` : ''},</p>
          <div style="white-space: pre-line; margin: 16px 0;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
          ${trackingLink ? `<p style="margin-top: 16px;"><a href="${trackingLink}" style="background: #1046A0; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">Sledovat zásilku</a></p>` : ''}
        </div>
        <div style="background: #f3f4f6; padding: 16px; text-align: center; font-size: 12px; color: #6b7280;">
          MROAUTO AUTODÍLY s.r.o. | info@mroauto.cz
        </div>
      </div>
    `;

    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: (parseInt(process.env.SMTP_PORT, 10) || 587) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      tls: { rejectUnauthorized: false },
    });

    await transporter.sendMail({
      from,
      to: recipient,
      subject,
      html,
    });

    // Log to email_log
    await supabase.from('email_log').insert({
      delivery_note_id: note.id,
      email_type: 'manual',
      recipient,
      subject,
      status: 'sent',
    });

    res.json({ success: true, recipient });
  } catch (err) {
    next(err);
  }
});

// POST /re-evaluate — re-evaluate unified_status from existing tracking_sync_log data
router.post('/re-evaluate', async (req, res, next) => {
  try {
    const { carrier } = req.body;
    const { getUnifiedStatus } = require('../../services/retino/tracking-status-mapper');

    // Get non-final shipments
    let query = supabase
      .from('delivery_notes')
      .select('id, doc_number, unified_status, shipper_code')
      .not('unified_status', 'in', '(delivered,returned_to_sender)')
      .not('tracking_number', 'is', null);

    if (carrier) query = query.eq('shipper_code', carrier);

    const { data: shipments, error } = await query;
    if (error) throw error;

    let updated = 0;
    for (const ship of (shipments || [])) {
      // Get latest tracking_sync_log
      const { data: logs } = await supabase
        .from('tracking_sync_log')
        .select('tracking_data')
        .eq('delivery_note_id', ship.id)
        .order('synced_at', { ascending: false })
        .limit(1);

      if (!logs?.[0]?.tracking_data) continue;

      const { status: newStatus, lastDescription } = getUnifiedStatus(logs[0].tracking_data);
      if (newStatus && newStatus !== 'unknown' && newStatus !== ship.unified_status) {
        const updates = { unified_status: newStatus, last_tracking_description: lastDescription };
        if (newStatus === 'delivered') updates.delivered_at = new Date().toISOString();
        if (newStatus === 'available_for_pickup' && !ship.pickup_at) updates.pickup_at = new Date().toISOString();

        await supabase.from('delivery_notes').update(updates).eq('id', ship.id);
        console.log(`[ReEvaluate] ${ship.doc_number}: ${ship.unified_status} → ${newStatus}`);
        updated++;
      }
    }

    res.json({ total: shipments?.length || 0, updated });
  } catch (err) {
    next(err);
  }
});

// POST /force-sync — force tracking sync now (admin trigger, optional carrier filter)
router.post('/force-sync', async (req, res, next) => {
  try {
    const { carrier } = req.body; // optional: 'GLS', 'PPL', 'DPD', etc.
    const trackingSyncService = require('../../services/TrackingSyncService');
    console.log(`[TrackingSync] Manual sync triggered${carrier ? ` for ${carrier}` : ' (all carriers)'}`);

    trackingSyncService.syncAll(carrier || null)
      .then(() => console.log('[TrackingSync] Manual sync completed'))
      .catch(err => console.error('[TrackingSync] Manual sync error:', err.message));

    res.json({ message: `Sync started${carrier ? ` for ${carrier}` : ''}. Check logs for progress.` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
