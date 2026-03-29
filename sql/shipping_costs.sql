-- Shipping costs table for Retino Cost Analysis
-- Run this SQL in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS shipping_costs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_note_id integer REFERENCES delivery_notes(id),
  shipper_code text,
  tracking_number text,
  invoice_number text,
  cost_amount decimal(10,2),
  revenue_amount decimal(10,2),
  weight_kg decimal(8,3),
  currency text DEFAULT 'CZK',
  invoice_date date,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_shipping_costs_dn ON shipping_costs(delivery_note_id);
CREATE INDEX idx_shipping_costs_shipper ON shipping_costs(shipper_code);
