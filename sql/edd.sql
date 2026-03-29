-- EDD config per carrier+country
CREATE TABLE IF NOT EXISTS edd_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  shipper_code text NOT NULL,
  country_code text DEFAULT 'CZ',
  business_days integer NOT NULL DEFAULT 3,
  count_weekends boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(shipper_code, country_code)
);

-- Default configs
INSERT INTO edd_config (shipper_code, country_code, business_days) VALUES
  ('GLS', 'CZ', 2), ('GLS', 'SK', 3),
  ('PPL', 'CZ', 2), ('PPL', 'SK', 3),
  ('DPD', 'CZ', 2), ('Zasilkovna', 'CZ', 3),
  ('CP', 'CZ', 3), ('UPS', 'CZ', 3),
  ('INTIME', 'CZ', 2)
ON CONFLICT DO NOTHING;

-- Timeliness status column on delivery_notes
ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS expected_delivery_date date;
ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS timeliness text; -- 'on_time', 'late', 'early', 'in_progress_on_time', 'in_progress_late'

-- Track & Trace page views
CREATE TABLE IF NOT EXISTS tt_page_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_note_id integer REFERENCES delivery_notes(id),
  tracking_token text,
  ip_address text,
  user_agent text,
  viewed_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tt_views_token ON tt_page_views(tracking_token);
CREATE INDEX IF NOT EXISTS idx_tt_views_date ON tt_page_views(viewed_at);
