const express = require('express');
const router = express.Router();
const { getTransportMapRows, saveTransportMapRows } = require('../utils/transportMap');

// GET /transport-map
router.get('/transport-map', (req, res) => {
  res.json(getTransportMapRows());
});

// PUT /transport-map
router.put('/transport-map', (req, res) => {
  try {
    const rows = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'Expected array' });
    saveTransportMapRows(rows);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
