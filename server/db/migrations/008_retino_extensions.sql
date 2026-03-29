-- =============================================
-- 008: RETINO EXTENSIONS — Consolidated migration
-- All tables from sql/*.sql that were not in 007_retino_init.sql
-- Run in Supabase SQL Editor
-- =============================================

-- ============================================================
-- FIX D1: returns.status DEFAULT 'new' (007 had 'requested')
-- ============================================================
ALTER TABLE returns ALTER COLUMN status SET DEFAULT 'new';

-- ============================================================
-- FIX D4: nextval helper for return_number
-- ============================================================
CREATE OR REPLACE FUNCTION nextval_text(seq_name text)
RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  RETURN nextval(seq_name)::text;
END;
$$;

-- ============================================================
-- SHIPPING COSTS
-- ============================================================
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
CREATE INDEX IF NOT EXISTS idx_shipping_costs_dn ON shipping_costs(delivery_note_id);
CREATE INDEX IF NOT EXISTS idx_shipping_costs_shipper ON shipping_costs(shipper_code);

-- ============================================================
-- EDD CONFIG + TT PAGE VIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS edd_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  shipper_code text NOT NULL,
  country_code text DEFAULT 'CZ',
  business_days integer NOT NULL DEFAULT 3,
  count_weekends boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(shipper_code, country_code)
);

INSERT INTO edd_config (shipper_code, country_code, business_days) VALUES
  ('GLS', 'CZ', 2), ('GLS', 'SK', 3),
  ('PPL', 'CZ', 2), ('PPL', 'SK', 3),
  ('DPD', 'CZ', 2), ('Zasilkovna', 'CZ', 3),
  ('CP', 'CZ', 3), ('UPS', 'CZ', 3),
  ('INTIME', 'CZ', 2)
ON CONFLICT DO NOTHING;

ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS expected_delivery_date date;
ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS timeliness text;

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

-- ============================================================
-- EMAIL TEMPLATES EXTENSIONS + EMAIL DESIGN (FIX D3)
-- ============================================================
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS heading text;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

INSERT INTO email_templates (code, subject_template, heading, body_html, is_active) VALUES
  ('in_transit', 'Vaše zásilka [[order.code]] je na cestě', 'Vaše zásilka je na cestě', '<p>Vaše zásilka byla úspěšně odeslána a právě je na cestě.</p>', true),
  ('available_for_pickup', 'Zásilka [[order.code]] je připravena k vyzvednutí', 'Připraveno k vyzvednutí', '<p>Vaše zásilka dorazila na výdejní místo a je připravena k vyzvednutí.</p>', true),
  ('delivered', 'Zásilka [[order.code]] byla doručena', 'Zásilka byla doručena', '<p>Vaše zásilka byla úspěšně doručena. Děkujeme za Váš nákup!</p>', true),
  ('failed_delivery', 'Nepodařilo se doručit zásilku [[order.code]]', 'Doručení se nezdařilo', '<p>Bohužel se nepodařilo doručit Vaši zásilku.</p>', true),
  ('order_confirmed', 'Potvrzení objednávky [[order.code]]', 'Objednávka potvrzena', '<p>Děkujeme za Vaši objednávku!</p>', true),
  ('order_shipped', 'Objednávka [[order.code]] byla odeslána', 'Objednávka odeslána', '<p>Vaše objednávka byla odeslána.</p>', true)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS email_design (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  header_bg_color text DEFAULT '#1046A0',
  header_text_color text DEFAULT '#ffffff',
  button_bg_color text DEFAULT '#D8112A',
  button_text_color text DEFAULT '#ffffff',
  footer_bg_color text DEFAULT '#1046A0',
  footer_text text DEFAULT 'MROAUTO AUTODÍLY s.r.o.',
  company_name text DEFAULT 'MROAUTO AUTODÍLY',
  company_subtitle text DEFAULT 'Sledování zásilky',
  contact_email text DEFAULT 'info@mroauto.cz',
  contact_phone text DEFAULT '+420 774 917 859',
  logo_url text,
  updated_at timestamptz DEFAULT now()
);
INSERT INTO email_design (id) VALUES (gen_random_uuid()) ON CONFLICT DO NOTHING;

-- ============================================================
-- MISSING RETINO TABLES (tags, notes, automation, ratings)
-- ============================================================
CREATE TABLE IF NOT EXISTS shipment_tags (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#ffffff',
  bg_color text NOT NULL DEFAULT '#3b82f6',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS delivery_note_tags (
  id serial PRIMARY KEY,
  delivery_note_id integer NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
  tag_id integer NOT NULL REFERENCES shipment_tags(id) ON DELETE CASCADE,
  added_by text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(delivery_note_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_dnt_dn ON delivery_note_tags(delivery_note_id);
CREATE INDEX IF NOT EXISTS idx_dnt_tag ON delivery_note_tags(tag_id);

CREATE TABLE IF NOT EXISTS shipment_notes (
  id serial PRIMARY KEY,
  delivery_note_id integer NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
  author text,
  content text NOT NULL,
  is_internal boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sn_dn ON shipment_notes(delivery_note_id);

CREATE TABLE IF NOT EXISTS email_log (
  id serial PRIMARY KEY,
  delivery_note_id integer REFERENCES delivery_notes(id) ON DELETE SET NULL,
  email_type text,
  recipient text,
  subject text,
  status text DEFAULT 'sent',
  sent_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_el_dn ON email_log(delivery_note_id);

CREATE TABLE IF NOT EXISTS automation_rules (
  id serial PRIMARY KEY,
  name text NOT NULL,
  trigger_type text NOT NULL,
  trigger_config jsonb DEFAULT '{}',
  conditions jsonb DEFAULT '{}',
  actions jsonb DEFAULT '[]',
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS delivery_ratings (
  id serial PRIMARY KEY,
  delivery_note_id integer NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  problems text[] DEFAULT '{}',
  comment text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(delivery_note_id)
);
CREATE INDEX IF NOT EXISTS idx_dr_dn ON delivery_ratings(delivery_note_id);

-- delivery_notes extra columns
ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS email_in_transit_sent boolean DEFAULT false;
ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS email_pickup_sent boolean DEFAULT false;
ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS email_delivered_sent boolean DEFAULT false;
ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS email_failed_delivery_sent boolean DEFAULT false;
ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS pickup_at timestamptz;
ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS sub_status text;

-- ============================================================
-- RETURN SHIPMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS return_shipments (
  id serial PRIMARY KEY,
  return_id integer NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  carrier text NOT NULL,
  shipping_method text NOT NULL,
  tracking_number text,
  label_url text,
  label_data jsonb,
  status text DEFAULT 'pending',
  cost numeric(10,2) DEFAULT 0,
  currency text DEFAULT 'CZK',
  paid_by text DEFAULT 'customer',
  payment_status text DEFAULT 'unpaid',
  pickup_point_id text,
  pickup_point_name text,
  pickup_point_address text,
  customer_address jsonb,
  notes text,
  gopay_payment_id text,
  gopay_payment_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rs_return ON return_shipments(return_id);
CREATE INDEX IF NOT EXISTS idx_rs_status ON return_shipments(status);

-- ============================================================
-- GOPAY PAYMENT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_log (
  id serial PRIMARY KEY,
  return_id integer REFERENCES returns(id) ON DELETE SET NULL,
  shipment_id integer REFERENCES return_shipments(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'gopay',
  external_id text,
  amount numeric(10,2) NOT NULL,
  currency text DEFAULT 'CZK',
  status text DEFAULT 'created',
  raw_response jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pl_return ON payment_log(return_id);
CREATE INDEX IF NOT EXISTS idx_pl_external ON payment_log(external_id);

-- ============================================================
-- REFUNDS (accounts, batches, items)
-- ============================================================
CREATE TABLE IF NOT EXISTS refund_accounts (
  id serial PRIMARY KEY,
  name text NOT NULL,
  account_number text NOT NULL,
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
  status text DEFAULT 'created',
  created_by uuid REFERENCES workers(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refund_batch_items (
  id serial PRIMARY KEY,
  batch_id integer NOT NULL REFERENCES refund_batches(id) ON DELETE CASCADE,
  return_id integer NOT NULL REFERENCES returns(id),
  amount numeric(10,2) NOT NULL,
  recipient_account text,
  variable_symbol text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rbi_batch ON refund_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_rbi_return ON refund_batch_items(return_id);

ALTER TABLE returns ADD COLUMN IF NOT EXISTS refund_status text DEFAULT NULL;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS refund_batch_id integer REFERENCES refund_batches(id);

-- ============================================================
-- CASE TYPES
-- ============================================================
CREATE TABLE IF NOT EXISTS case_types (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name_cs text NOT NULL,
  color text DEFAULT '#3B82F6',
  icon text DEFAULT 'box',
  enabled boolean DEFAULT true,
  is_system boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  workflow_steps jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

INSERT INTO case_types (code, name_cs, color, icon, enabled, is_system, sort_order) VALUES
  ('return', 'Vrácení', '#3B82F6', 'refresh', true, true, 1),
  ('complaint', 'Reklamace', '#EF4444', 'alert', true, true, 2),
  ('warranty', 'Záruka', '#8B5CF6', 'shield', true, true, 3)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- CUSTOM FIELDS + WEBHOOKS
-- ============================================================
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  label_cs text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  options jsonb DEFAULT '[]',
  required boolean DEFAULT false,
  applies_to text[] DEFAULT '{return}',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS custom_field_values (
  id serial PRIMARY KEY,
  return_id integer NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  field_id integer NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
  value text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(return_id, field_id)
);
CREATE INDEX IF NOT EXISTS idx_cfv_return ON custom_field_values(return_id);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id serial PRIMARY KEY,
  name text NOT NULL,
  url text NOT NULL,
  secret text,
  events text[] DEFAULT '{return_created}',
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_log (
  id serial PRIMARY KEY,
  endpoint_id integer REFERENCES webhook_endpoints(id) ON DELETE SET NULL,
  event text NOT NULL,
  payload jsonb NOT NULL,
  status_code integer,
  response_body text,
  error text,
  duration_ms integer,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wl_endpoint ON webhook_log(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_wl_event ON webhook_log(event);

-- ============================================================
-- MISSING INDEXES (from audit)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_return_reasons_code ON return_reasons(code);
CREATE INDEX IF NOT EXISTS idx_return_reasons_active ON return_reasons(is_active);
CREATE INDEX IF NOT EXISTS idx_case_types_code ON case_types(code);
CREATE INDEX IF NOT EXISTS idx_case_types_enabled ON case_types(enabled);
CREATE INDEX IF NOT EXISTS idx_custom_fields_code ON custom_field_definitions(code);
CREATE INDEX IF NOT EXISTS idx_custom_fields_active ON custom_field_definitions(is_active);
CREATE INDEX IF NOT EXISTS idx_refund_accounts_default ON refund_accounts(is_default);
CREATE INDEX IF NOT EXISTS idx_refund_batches_status ON refund_batches(status);
CREATE INDEX IF NOT EXISTS idx_shipment_tags_name ON shipment_tags(name);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_enabled ON webhook_endpoints(enabled);
CREATE INDEX IF NOT EXISTS idx_tracking_sync_log_dn ON tracking_sync_log(delivery_note_id);
CREATE INDEX IF NOT EXISTS idx_customer_messages_dn ON customer_messages(delivery_note_id);

-- ============================================================
-- FIX D2: Storage bucket (run manually in Supabase dashboard)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('return-attachments', 'return-attachments', false)
-- ON CONFLICT DO NOTHING;
-- ============================================================
