const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');

// GET / - list all hunters
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('hunters')
      .select('*')
      .order('name');

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

// POST / - create hunter
router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const { data, error } = await supabase
      .from('hunters')
      .insert({ name: name.trim() })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// DELETE /:id - delete hunter
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('hunters')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// PUT /:id - toggle active status
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    const { data, error } = await supabase
      .from('hunters')
      .update({ active })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /assign - assign hunter to a package
router.post('/assign', async (req, res, next) => {
  try {
    const { deliveryNoteId, hunterId, workerId, itemsCount } = req.body;

    if (!deliveryNoteId || !hunterId) {
      return res.status(400).json({ error: 'deliveryNoteId and hunterId required' });
    }

    // Get worker name
    let workerName = null;
    if (workerId) {
      const { data: w } = await supabase.from('workers').select('name').eq('id', workerId).single();
      workerName = w?.name || null;
    }

    // Check if already assigned — update if so
    const { data: existing } = await supabase
      .from('hunter_assignments')
      .select('id')
      .eq('delivery_note_id', deliveryNoteId)
      .single();

    if (existing) {
      const { data, error } = await supabase
        .from('hunter_assignments')
        .update({
          hunter_id: hunterId,
          worker_id: workerId || null,
          worker_name: workerName,
          items_count: itemsCount || 0,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } else {
      const { data, error } = await supabase
        .from('hunter_assignments')
        .insert({
          delivery_note_id: deliveryNoteId,
          hunter_id: hunterId,
          worker_id: workerId || null,
          worker_name: workerName,
          items_count: itemsCount || 0,
        })
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    }
  } catch (err) {
    next(err);
  }
});

// GET /assignment/:deliveryNoteId - get hunter assignment for a package
router.get('/assignment/:deliveryNoteId', async (req, res, next) => {
  try {
    const { deliveryNoteId } = req.params;

    const { data, error } = await supabase
      .from('hunter_assignments')
      .select('*, hunters(name)')
      .eq('delivery_note_id', deliveryNoteId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    res.json(data || null);
  } catch (err) {
    next(err);
  }
});

// POST /error - report hunter error
router.post('/error', async (req, res, next) => {
  try {
    const { deliveryNoteId, hunterId, workerId, errorType, note } = req.body;

    if (!deliveryNoteId || !hunterId || !errorType) {
      return res.status(400).json({ error: 'deliveryNoteId, hunterId and errorType required' });
    }

    const validTypes = ['wrong_qty', 'missing_product', 'wrong_product'];
    if (!validTypes.includes(errorType)) {
      return res.status(400).json({ error: `Invalid errorType. Must be one of: ${validTypes.join(', ')}` });
    }

    // Get worker name
    let workerName = null;
    if (workerId) {
      const { data: w } = await supabase.from('workers').select('name').eq('id', workerId).single();
      workerName = w?.name || null;
    }

    const { data, error } = await supabase
      .from('hunter_errors')
      .insert({
        delivery_note_id: deliveryNoteId,
        hunter_id: hunterId,
        worker_id: workerId || null,
        worker_name: workerName,
        error_type: errorType,
        note: note || null,
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /errors/:deliveryNoteId - get errors for a package
router.get('/errors/:deliveryNoteId', async (req, res, next) => {
  try {
    const { deliveryNoteId } = req.params;

    const { data, error } = await supabase
      .from('hunter_errors')
      .select('*, hunters(name)')
      .eq('delivery_note_id', deliveryNoteId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

// GET /stats - hunter statistics for date range
router.get('/stats', async (req, res, next) => {
  try {
    const { date_from, date_to } = req.query;

    // Default to current week (Monday-Sunday)
    let from, to;
    if (date_from && date_to) {
      from = `${date_from}T00:00:00.000Z`;
      to = `${date_to}T23:59:59.999Z`;
    } else {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      from = `${monday.toISOString().split('T')[0]}T00:00:00.000Z`;
      to = `${now.toISOString().split('T')[0]}T23:59:59.999Z`;
    }

    // Get all hunters
    const { data: hunters } = await supabase.from('hunters').select('*').order('name');

    // Get assignments in range
    const { data: assignments } = await supabase
      .from('hunter_assignments')
      .select('*')
      .gte('created_at', from)
      .lte('created_at', to);

    // Get errors in range
    const { data: errors } = await supabase
      .from('hunter_errors')
      .select('*')
      .gte('created_at', from)
      .lte('created_at', to);

    // Build per-hunter stats
    const hunterStats = (hunters || []).map(h => {
      const myAssignments = (assignments || []).filter(a => a.hunter_id === h.id);
      const myErrors = (errors || []).filter(e => e.hunter_id === h.id);

      const totalPackages = myAssignments.length;
      const totalItems = myAssignments.reduce((sum, a) => sum + (a.items_count || 0), 0);

      const errorsByType = {
        wrong_qty: myErrors.filter(e => e.error_type === 'wrong_qty').length,
        missing_product: myErrors.filter(e => e.error_type === 'missing_product').length,
        wrong_product: myErrors.filter(e => e.error_type === 'wrong_product').length,
      };
      const totalErrors = myErrors.length;
      const errorRate = totalPackages > 0 ? Math.round((totalErrors / totalPackages) * 100) : 0;

      return {
        id: h.id,
        name: h.name,
        active: h.active,
        totalPackages,
        totalItems,
        totalErrors,
        errorsByType,
        errorRate,
      };
    });

    // Sort by packages prepared (desc)
    hunterStats.sort((a, b) => b.totalPackages - a.totalPackages);

    // Recent errors list
    const recentErrors = (errors || []).slice(0, 20).map(e => {
      const hunter = (hunters || []).find(h => h.id === e.hunter_id);
      return {
        ...e,
        hunter_name: hunter?.name || '?',
      };
    });

    res.json({
      dateFrom: from,
      dateTo: to,
      hunters: hunterStats,
      recentErrors,
      totals: {
        packages: (assignments || []).length,
        errors: (errors || []).length,
        hunters: (hunters || []).length,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
