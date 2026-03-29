const express = require('express');
const router = express.Router();
const supabase = require('../../db/supabase');
const aboGenerator = require('../../services/retino/AboFileGenerator');

// GET /queue — returns awaiting refund
router.get('/queue', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('returns')
      .select('id, return_number, customer_name, customer_email, resolution_amount, refund_method, refund_bank_account, refund_variable_symbol, resolution_type, resolved_at, refund_status')
      .in('status', ['approved', 'refund_pending'])
      .eq('resolution_type', 'refund')
      .is('refund_batch_id', null)
      .not('resolution_amount', 'is', null)
      .order('resolved_at');

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

// POST /batch — create refund batch + generate ABO file
router.post('/batch', async (req, res, next) => {
  try {
    const { returnIds, accountId, workerId } = req.body;

    if (!returnIds?.length || !accountId) {
      return res.status(400).json({ error: 'returnIds and accountId are required' });
    }

    // Fetch account
    const { data: account } = await supabase
      .from('refund_accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (!account) return res.status(404).json({ error: 'Account not found' });

    // Fetch returns
    const { data: returns } = await supabase
      .from('returns')
      .select('id, return_number, resolution_amount, refund_bank_account, refund_variable_symbol')
      .in('id', returnIds);

    if (!returns?.length) return res.status(400).json({ error: 'No valid returns found' });

    const totalAmount = returns.reduce((sum, r) => sum + (parseFloat(r.resolution_amount) || 0), 0);

    // Generate batch number
    const batchNumber = `ABO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${require('crypto').randomBytes(3).toString('hex')}`;

    // Create batch
    const { data: batch, error: batchErr } = await supabase
      .from('refund_batches')
      .insert({
        batch_number: batchNumber,
        account_id: accountId,
        total_amount: totalAmount,
        currency: account.currency || 'CZK',
        item_count: returns.length,
        status: 'created',
        created_by: workerId || null,
      })
      .select()
      .single();

    if (batchErr) throw batchErr;

    // Create batch items
    const items = returns.map(r => ({
      batch_id: batch.id,
      return_id: r.id,
      amount: parseFloat(r.resolution_amount) || 0,
      recipient_account: r.refund_bank_account || '',
      variable_symbol: r.refund_variable_symbol || r.return_number?.replace(/\D/g, '') || '',
    }));

    await supabase.from('refund_batch_items').insert(items);

    // Update returns
    await supabase
      .from('returns')
      .update({ refund_status: 'in_batch', refund_batch_id: batch.id })
      .in('id', returnIds);

    // Generate ABO file
    const aboContent = aboGenerator.generate({
      senderAccount: account.account_number,
      batchNumber,
      items: items.map(i => ({
        recipientAccount: i.recipient_account,
        amount: i.amount,
        variableSymbol: i.variable_symbol,
        message: `Vraceni ${batchNumber}`,
      })),
    });

    // Store ABO as base64 in batch
    const aboBase64 = Buffer.from(aboContent, 'utf-8').toString('base64');
    await supabase
      .from('refund_batches')
      .update({ abo_file_url: `data:text/plain;base64,${aboBase64}` })
      .eq('id', batch.id);

    res.status(201).json({
      batch: { ...batch, item_count: returns.length, total_amount: totalAmount },
      aboContent,
    });
  } catch (err) {
    next(err);
  }
});

// GET /batches — list refund batches
router.get('/batches', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('refund_batches')
      .select('*, refund_accounts(name, account_number)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

// GET /batches/:id — batch detail with items
router.get('/batches/:id', async (req, res, next) => {
  try {
    const { data: batch } = await supabase
      .from('refund_batches')
      .select('*, refund_accounts(name, account_number)')
      .eq('id', req.params.id)
      .single();

    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    const { data: items } = await supabase
      .from('refund_batch_items')
      .select('*, returns(return_number, customer_name)')
      .eq('batch_id', batch.id)
      .order('id');

    res.json({ ...batch, items: items || [] });
  } catch (err) {
    next(err);
  }
});

// PATCH /batches/:id/status — update batch status
router.patch('/batches/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const valid = ['created', 'exported', 'sent_to_bank', 'completed'];
    if (!valid.includes(status)) return res.status(400).json({ error: `Invalid status. Valid: ${valid.join(', ')}` });

    const { data, error } = await supabase
      .from('refund_batches')
      .update({ status })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // If completed, mark returns as refunded
    if (status === 'completed') {
      const { data: items } = await supabase
        .from('refund_batch_items')
        .select('return_id')
        .eq('batch_id', req.params.id);

      if (items?.length) {
        const returnIds = items.map(i => i.return_id);
        await supabase
          .from('returns')
          .update({ refund_status: 'refunded', status: 'refunded' })
          .in('id', returnIds);
      }
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/mark-refunded — manually mark a single return as refunded
router.patch('/:id/mark-refunded', async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('returns')
      .update({ refund_status: 'refunded', status: 'refunded', updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// --- Refund Accounts CRUD ---

// GET /accounts
router.get('/accounts', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('refund_accounts')
      .select('*')
      .order('is_default', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

// POST /accounts
router.post('/accounts', async (req, res, next) => {
  try {
    const { name, accountNumber, iban, bic, currency, isDefault } = req.body;
    if (!name || !accountNumber) return res.status(400).json({ error: 'name and accountNumber required' });

    // If new account is default, unset other defaults
    if (isDefault) {
      await supabase.from('refund_accounts').update({ is_default: false }).eq('is_default', true);
    }

    const { data, error } = await supabase
      .from('refund_accounts')
      .insert({
        name, account_number: accountNumber,
        iban: iban || null, bic: bic || null,
        currency: currency || 'CZK', is_default: isDefault || false,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// DELETE /accounts/:id
router.delete('/accounts/:id', async (req, res, next) => {
  try {
    const { error } = await supabase.from('refund_accounts').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
