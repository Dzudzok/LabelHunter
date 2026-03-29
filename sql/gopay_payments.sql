-- GoPay payments — platby za zpětné štítky
-- Podpojíme až na konci, zatím jen struktura

ALTER TABLE return_shipments
  ADD COLUMN IF NOT EXISTS gopay_payment_id text,
  ADD COLUMN IF NOT EXISTS gopay_payment_url text;

CREATE TABLE IF NOT EXISTS payment_log (
  id serial PRIMARY KEY,
  return_id integer REFERENCES returns(id) ON DELETE SET NULL,
  shipment_id integer REFERENCES return_shipments(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'gopay',       -- gopay, manual
  external_id text,                              -- GoPay payment ID
  amount numeric(10,2) NOT NULL,
  currency text DEFAULT 'CZK',
  status text DEFAULT 'created',                 -- created, paid, cancelled, refunded, error
  raw_response jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pl_return ON payment_log(return_id);
CREATE INDEX IF NOT EXISTS idx_pl_external ON payment_log(external_id);
