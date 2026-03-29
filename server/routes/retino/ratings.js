const express = require('express');
const router = express.Router();
const supabase = require('../../db/supabase');

// GET /analytics — aggregate rating analytics
// Must be defined before /:deliveryNoteId to avoid route conflict
router.get('/analytics', async (req, res, next) => {
  try {
    const { days = 30, shipper } = req.query;

    const sinceDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000).toISOString();

    // Fetch ratings joined with delivery notes
    let query = supabase
      .from('delivery_ratings')
      .select('rating, problems, delivery_note_id, created_at, delivery_notes(shipper_code)')
      .gte('created_at', sinceDate);

    const { data: ratings, error } = await query;
    if (error) throw error;

    // Filter by shipper if specified
    let filtered = ratings || [];
    if (shipper) {
      filtered = filtered.filter(r => r.delivery_notes?.shipper_code === shipper);
    }

    if (filtered.length === 0) {
      return res.json({
        averageRating: 0,
        totalRatings: 0,
        satisfiedPercent: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        problemBreakdown: {},
        byCarrier: {},
      });
    }

    // Calculate analytics
    const totalRatings = filtered.length;
    const sumRating = filtered.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = Math.round((sumRating / totalRatings) * 100) / 100;
    const satisfiedCount = filtered.filter(r => r.rating >= 4).length;
    const satisfiedPercent = Math.round((satisfiedCount / totalRatings) * 10000) / 100;

    // Rating distribution
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of filtered) {
      ratingDistribution[r.rating] = (ratingDistribution[r.rating] || 0) + 1;
    }

    // Problem breakdown
    const problemBreakdown = {};
    for (const r of filtered) {
      if (Array.isArray(r.problems)) {
        for (const p of r.problems) {
          problemBreakdown[p] = (problemBreakdown[p] || 0) + 1;
        }
      }
    }

    // By carrier
    const byCarrier = {};
    for (const r of filtered) {
      const carrier = r.delivery_notes?.shipper_code || 'unknown';
      if (!byCarrier[carrier]) byCarrier[carrier] = { sum: 0, count: 0 };
      byCarrier[carrier].sum += r.rating;
      byCarrier[carrier].count++;
    }
    const byCarrierAvg = {};
    for (const [carrier, stats] of Object.entries(byCarrier)) {
      byCarrierAvg[carrier] = Math.round((stats.sum / stats.count) * 100) / 100;
    }

    res.json({
      averageRating,
      totalRatings,
      satisfiedPercent,
      ratingDistribution,
      problemBreakdown,
      byCarrier: byCarrierAvg,
    });
  } catch (err) {
    next(err);
  }
});

// POST / — submit a delivery rating
router.post('/', async (req, res, next) => {
  try {
    const { delivery_note_id, rating, problems, comment } = req.body;

    if (!delivery_note_id || !rating) {
      return res.status(400).json({ error: 'Missing required fields: delivery_note_id, rating' });
    }

    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
    }

    if (problems && !Array.isArray(problems)) {
      return res.status(400).json({ error: 'problems must be an array of strings' });
    }

    // Check delivery note exists and is delivered
    const { data: note, error: noteErr } = await supabase
      .from('delivery_notes')
      .select('id, unified_status')
      .eq('id', delivery_note_id)
      .single();

    if (noteErr || !note) {
      return res.status(404).json({ error: 'Delivery note not found' });
    }

    if (note.unified_status !== 'delivered') {
      return res.status(400).json({ error: 'Rating can only be submitted for delivered shipments' });
    }

    // Insert rating
    const { data, error } = await supabase
      .from('delivery_ratings')
      .insert({
        delivery_note_id,
        rating,
        problems: problems || [],
        comment: comment || null,
      })
      .select()
      .single();

    if (error) {
      // UNIQUE constraint violation
      if (error.code === '23505') {
        return res.status(409).json({ error: 'This delivery has already been rated' });
      }
      throw error;
    }

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// GET /:deliveryNoteId — get rating for a specific shipment
router.get('/:deliveryNoteId', async (req, res, next) => {
  try {
    const { deliveryNoteId } = req.params;

    const { data, error } = await supabase
      .from('delivery_ratings')
      .select('*')
      .eq('delivery_note_id', deliveryNoteId)
      .single();

    if (error && error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Rating not found' });
    }
    if (error) throw error;

    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
