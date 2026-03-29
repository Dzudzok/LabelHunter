-- Refunds — bankovní účty, dávky refundací, ABO soubory

CREATE TABLE IF NOT EXISTS refund_accounts (
  id serial PRIMARY KEY,
  name text NOT NULL,
  account_number text NOT NULL,         -- CZ format: 123456789/0100
  iban text,
  bic text,
  currency text DEFAULT 'CZK',
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refund_batches (
  id serial PRIMARY KEY,
  batch_number text NOT NULL UNIQUE,
  account_id integer REFERENCES refund_accounts(id),
  total_amount numeric(12,2) DEFAULT 0,
  currency text DEFAULT 'CZK',
  item_count integer DEFAULT 0,
  abo_file_url text,
  status text DEFAULT 'created',        -- created, exported, sent_to_bank, completed
  created_by uuid REFERENCES workers(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refund_batch_items (
  id serial PRIMARY KEY,
  batch_id integer NOT NULL REFERENCES refund_batches(id) ON DELETE CASCADE,
  return_id integer NOT NULL REFERENCES returns(id),
  amount numeric(10,2) NOT NULL,
  recipient_account text,               -- číslo účtu příjemce
  variable_symbol text,
  status text DEFAULT 'pending',        -- pending, sent, completed, failed
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rbi_batch ON refund_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_rbi_return ON refund_batch_items(return_id);

-- Add refund tracking columns to returns
ALTER TABLE returns ADD COLUMN IF NOT EXISTS refund_status text DEFAULT NULL;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS refund_batch_id integer REFERENCES refund_batches(id);
