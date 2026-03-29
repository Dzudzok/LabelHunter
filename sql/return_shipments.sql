-- Return shipments — transport zwrotny
CREATE TABLE IF NOT EXISTS return_shipments (
  id serial PRIMARY KEY,
  return_id integer NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  carrier text NOT NULL,                -- 'zasilkovna', 'ppl', 'gls', 'cp', 'self'
  shipping_method text NOT NULL,        -- 'drop_off', 'courier_pickup', 'self_ship'
  tracking_number text,
  label_url text,
  label_data jsonb,
  status text DEFAULT 'pending',        -- pending, label_generated, shipped, in_transit, delivered
  cost numeric(10,2) DEFAULT 0,
  currency text DEFAULT 'CZK',
  paid_by text DEFAULT 'customer',      -- customer, eshop, free
  payment_status text DEFAULT 'unpaid', -- unpaid, paid, free
  pickup_point_id text,
  pickup_point_name text,
  pickup_point_address text,
  customer_address jsonb,               -- {street, city, zip, country}
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rs_return ON return_shipments(return_id);
CREATE INDEX IF NOT EXISTS idx_rs_status ON return_shipments(status);
