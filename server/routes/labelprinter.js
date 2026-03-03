const express = require('express');
const router = express.Router();
const labelPrinterService = require('../services/LabelPrinterService');

// GET /shippers - proxy to LP /shippers
router.get('/shippers', async (req, res, next) => {
  try {
    const data = await labelPrinterService.getShippers();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /tracking/:id - proxy to LP /tracking/{id}
router.get('/tracking/:id', async (req, res, next) => {
  try {
    const data = await labelPrinterService.getTracking(req.params.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /state/:id - proxy to LP /shipments/{id}/state
router.get('/state/:id', async (req, res, next) => {
  try {
    const data = await labelPrinterService.get(`/shipments/${req.params.id}/state`);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
