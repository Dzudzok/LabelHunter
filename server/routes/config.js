const express = require('express');
const router = express.Router();
const { getTransportMapRows, saveTransportMapRows } = require('../utils/transportMap');

// GET /transport-map
router.get('/transport-map', async (req, res, next) => {
  try {
    const rows = await getTransportMapRows();
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// PUT /transport-map
router.put('/transport-map', async (req, res, next) => {
  try {
    const rows = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'Expected array' });
    await saveTransportMapRows(rows);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
