const express = require('express');
const router = express.Router();
const returnShippingService = require('../../services/retino/ReturnShippingService');
const supabase = require('../../db/supabase');

// GET /api/retino/return-shipments/:returnId — get shipments for a return
router.get('/:returnId', async (req, res, next) => {
  try {
    const returnId = parseInt(req.params.returnId, 10);
    if (!returnId) return res.status(400).json({ error: 'Invalid returnId' });

    const shipments = await returnShippingService.getShipmentsByReturn(returnId);
    res.json(shipments);
  } catch (err) {
    next(err);
  }
});

// POST /api/retino/return-shipments/ — create return shipment (admin)
router.post('/', async (req, res, next) => {
  try {
    const { returnId, carrier, shippingMethod, pickupPoint, customerAddress, notes } = req.body;

    if (!returnId || !carrier || !shippingMethod) {
      return res.status(400).json({ error: 'returnId, carrier and shippingMethod are required' });
    }

    // Verify return exists
    const { data: ret } = await supabase
      .from('returns')
      .select('id, status')
      .eq('id', returnId)
      .single();

    if (!ret) return res.status(404).json({ error: 'Return not found' });

    const cost = returnShippingService.getShippingCost(carrier, shippingMethod);

    const shipment = await returnShippingService.createShipment({
      returnId, carrier, shippingMethod, pickupPoint, customerAddress, notes,
    });

    // Update cost
    if (cost > 0) {
      await supabase
        .from('return_shipments')
        .update({ cost })
        .eq('id', shipment.id);
      shipment.cost = cost;
    }

    res.status(201).json(shipment);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/retino/return-shipments/:id/status — update shipment status
router.patch('/:id/status', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, trackingNumber } = req.body;

    if (!status) return res.status(400).json({ error: 'status is required' });

    const validStatuses = ['pending', 'label_generated', 'shipped', 'in_transit', 'delivered'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Valid: ${validStatuses.join(', ')}` });
    }

    const extras = {};
    if (trackingNumber) extras.tracking_number = trackingNumber;

    const shipment = await returnShippingService.updateStatus(id, status, extras);
    res.json(shipment);
  } catch (err) {
    next(err);
  }
});

// POST /api/retino/return-shipments/:id/generate-label — generate label via LP API (admin)
router.post('/:id/generate-label', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

    // Fetch shipment
    const { data: shipment, error } = await supabase
      .from('return_shipments')
      .select('id, return_id, carrier, status, label_url')
      .eq('id', id)
      .single();

    if (error || !shipment) return res.status(404).json({ error: 'Shipment not found' });
    if (shipment.label_url) return res.status(400).json({ error: 'Label already generated' });

    const carrier = (shipment.carrier || '').toUpperCase();
    if (!['GLS', 'PPL', 'DPD', 'CP'].includes(carrier)) {
      return res.status(400).json({ error: `LP label not supported for carrier: ${shipment.carrier}` });
    }

    const label = await returnShippingService.generateLPLabel(shipment.return_id, shipment.id, carrier);

    const { data: updated } = await supabase
      .from('return_shipments')
      .update({
        tracking_number: label.trackingNumber || null,
        label_url: label.labelUrl || null,
        label_data: label,
        status: 'label_generated',
      })
      .eq('id', shipment.id)
      .select()
      .single();

    res.json(updated || shipment);
  } catch (err) {
    next(err);
  }
});

// GET /api/retino/return-shipments/costs/config — get shipping cost config
router.get('/costs/config', async (req, res) => {
  const costs = {
    zasilkovna: { drop_off: { cost: 89, currency: 'CZK', label: 'Zásilkovna — výdejní místo' } },
    ppl: { courier_pickup: { cost: 149, currency: 'CZK', label: 'PPL — svoz kurýrem' } },
    gls: { courier_pickup: { cost: 139, currency: 'CZK', label: 'GLS — svoz kurýrem' } },
    cp: { drop_off: { cost: 99, currency: 'CZK', label: 'Česká pošta — podání na pobočce' } },
    self: { self_ship: { cost: 0, currency: 'CZK', label: 'Vlastní doprava' } },
  };
  res.json(costs);
});

module.exports = router;
