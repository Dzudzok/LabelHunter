const express = require('express');
const router = express.Router();
const supabase = require('../../db/supabase');
const creditNoteGenerator = require('../../services/retino/CreditNoteGenerator');

// POST /:returnId/generate — generate credit note PDF for a return
router.post('/:returnId/generate', async (req, res, next) => {
  try {
    const returnId = parseInt(req.params.returnId, 10);

    // Fetch return with items
    const { data: ret } = await supabase
      .from('returns')
      .select('*')
      .eq('id', returnId)
      .single();

    if (!ret) return res.status(404).json({ error: 'Return not found' });

    const { data: items } = await supabase
      .from('return_items')
      .select('*, delivery_note_items(code, brand, text, qty, price_unit_inc_vat)')
      .eq('return_id', returnId);

    // Fetch delivery note for invoice info
    const { data: note } = await supabase
      .from('delivery_notes')
      .select('invoice_number, doc_number, customer_name')
      .eq('id', ret.delivery_note_id)
      .single();

    // Generate credit note number
    const year = new Date().getFullYear();
    const { count } = await supabase.from('returns').select('id', { count: 'exact', head: true }).not('resolution_type', 'is', null);
    const creditNoteNumber = `DOB-${year}-${String((count || 0) + 1).padStart(5, '0')}`;

    const pdfItems = (items || []).map(i => ({
      text: i.delivery_note_items?.text || 'Produkt',
      qty: i.qty_returned || 1,
      pricePerUnit: parseFloat(i.delivery_note_items?.price_unit_inc_vat) || 0,
      vatRate: 21,
    }));

    const totalAmount = parseFloat(ret.resolution_amount) || pdfItems.reduce((sum, i) => sum + i.qty * i.pricePerUnit, 0);

    const pdfBuffer = await creditNoteGenerator.generate({
      creditNoteNumber,
      originalInvoice: note?.invoice_number || note?.doc_number || '-',
      date: new Date().toLocaleDateString('cs-CZ'),
      returnNumber: ret.return_number,
      seller: {
        name: 'MROAUTO AUTODÍLY s.r.o.',
        address: 'Průmyslová 1472, 280 02 Kolín',
        ico: process.env.COMPANY_ICO || '',
        dic: process.env.COMPANY_DIC || '',
      },
      buyer: {
        name: ret.customer_name || note?.customer_name || '-',
        address: '',
      },
      items: pdfItems,
      totalAmount,
      currency: 'CZK',
      note: ret.resolution_note || '',
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${creditNoteNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

// GET /:returnId — check if credit note exists (placeholder for future storage)
router.get('/:returnId', async (req, res) => {
  // For now just returns info that it can be generated
  res.json({ canGenerate: true });
});

module.exports = router;
