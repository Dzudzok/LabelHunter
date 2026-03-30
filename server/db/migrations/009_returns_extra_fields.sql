-- =============================================
-- 009: Returns extra fields — VIN, workshop, extra costs, bank account edit log
-- =============================================

-- New columns on returns table
ALTER TABLE returns ADD COLUMN IF NOT EXISTS vin VARCHAR(17);
ALTER TABLE returns ADD COLUMN IF NOT EXISTS workshop_name VARCHAR(200);
ALTER TABLE returns ADD COLUMN IF NOT EXISTS workshop_address VARCHAR(500);
ALTER TABLE returns ADD COLUMN IF NOT EXISTS extra_costs_description TEXT;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS extra_costs_amount NUMERIC(10,2);

-- Bank account edit log — tracks changes to bank account number
CREATE TABLE IF NOT EXISTS bank_account_log (
  id SERIAL PRIMARY KEY,
  return_id INTEGER NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  old_account VARCHAR(100),
  new_account VARCHAR(100) NOT NULL,
  changed_by VARCHAR(200),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bal_return ON bank_account_log(return_id);
