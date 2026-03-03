const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const supabase = require('../db/supabase');
const labelPrinterService = require('../services/LabelPrinterService');

// POST / - create return shipment
router.post('/', async (req, res, next) => {
  try {
    const { delivery_note_id, shipper_code } = req.body;

    if (!delivery_note_id) {
      return res.status(400).json({ error: 'delivery_note_id is required' });
    }

    // Get original delivery note
    const { data: dn, error: dnError } = await supabase
      .from('delivery_notes')
      .select('*')
      .eq('id', delivery_note_id)
      .single();

    if (dnError || !dn) {
      return res.status(404).json({ error: 'Delivery note not found' });
    }

    const shipperToUse = shipper_code || dn.shipper_code || 'GLS';

    // Create return shipment in LP (swap sender/recipient)
    const shipmentData = {
      shipperCode: shipperToUse,
      serviceCode: shipperToUse, // Use same code for returns
      recipient: {
        name: 'MROAUTO AUTODÍLY s.r.o.',
        street: 'Čs. armády 360, Pudlov',
        city: 'Bohumín',
        postalCode: '73551',
        country: 'CZ',
        phone: '+420 774 917 859',
        email: 'info@mroauto.cz',
      },
      sender: {
        name: dn.customer_name,
        street: dn.delivery_street || dn.customer_street,
        city: dn.delivery_city || dn.customer_city,
        postalCode: dn.delivery_postal_code || dn.customer_postal_code,
        country: dn.delivery_country || dn.customer_country || 'CZ',
        phone: dn.delivery_phone || dn.customer_phone,
        email: dn.delivery_email || dn.customer_email,
      },
      packages: [{
        weight: 1, // Default return weight
      }],
      reference: `RET-${dn.invoice_number || dn.doc_number}`,
    };

    const result = await labelPrinterService.createShipment(shipmentData);

    // Extract and save label PDF
    let returnLabelPdf = null;
    if (result.data && result.data[0] && result.data[0].labels) {
      const labelBase64 = result.data[0].labels;
      const labelsDir = path.join(__dirname, '..', 'labels');
      const shipmentId = result.data[0].shipmentId || result.data[0].id;
      const filename = `return_${shipmentId}.pdf`;
      const filePath = path.join(labelsDir, filename);

      fs.writeFileSync(filePath, Buffer.from(labelBase64, 'base64'));
      returnLabelPdf = `/labels/${filename}`;
    }

    // Save return record
    const { data: returnRecord, error: returnError } = await supabase
      .from('returns')
      .insert({
        delivery_note_id,
        return_label_pdf: returnLabelPdf,
        shipper_code: shipperToUse,
        status: 'requested',
      })
      .select()
      .single();

    if (returnError) throw returnError;

    res.status(201).json({
      success: true,
      return: returnRecord,
      labelUrl: returnLabelPdf,
    });
  } catch (err) {
    next(err);
  }
});

// GET /delivery-note/:dnId - get returns for delivery note
router.get('/delivery-note/:dnId', async (req, res, next) => {
  try {
    const { dnId } = req.params;

    const { data, error } = await supabase
      .from('returns')
      .select('*')
      .eq('delivery_note_id', dnId)
      .order('requested_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
