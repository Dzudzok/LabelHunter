-- =============================================
-- RETINO MODULE - Initial Migration
-- Run this on Supabase SQL Editor
-- =============================================

-- 1A: New columns on delivery_notes
ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS unified_status VARCHAR(50) DEFAULT 'unknown';
ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS last_tracking_update TIMESTAMPTZ;
ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS last_tracking_description VARCHAR(500);
CREATE INDEX IF NOT EXISTS idx_dn_unified_status ON delivery_notes(unified_status);
CREATE INDEX IF NOT EXISTS idx_dn_shipper ON delivery_notes(shipper_code);
CREATE INDEX IF NOT EXISTS idx_dn_customer_email ON delivery_notes(customer_email);

-- 1B: Extend returns table
ALTER TABLE returns ADD COLUMN IF NOT EXISTS return_number VARCHAR(20) UNIQUE;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'return';
ALTER TABLE returns ADD COLUMN IF NOT EXISTS reason_code VARCHAR(50);
ALTER TABLE returns ADD COLUMN IF NOT EXISTS reason_detail TEXT;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS vehicle_info VARCHAR(200);
ALTER TABLE returns ADD COLUMN IF NOT EXISTS was_mounted BOOLEAN DEFAULT false;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS customer_name VARCHAR(200);
ALTER TABLE returns ADD COLUMN IF NOT EXISTS customer_email VARCHAR(200);
ALTER TABLE returns ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50);
ALTER TABLE returns ADD COLUMN IF NOT EXISTS return_tracking_number VARCHAR(100);
ALTER TABLE returns ADD COLUMN IF NOT EXISTS return_shipping_method VARCHAR(30);
ALTER TABLE returns ADD COLUMN IF NOT EXISTS resolution_type VARCHAR(30);
ALTER TABLE returns ADD COLUMN IF NOT EXISTS resolution_amount NUMERIC(10,2);
ALTER TABLE returns ADD COLUMN IF NOT EXISTS resolution_note TEXT;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES workers(id);
ALTER TABLE returns ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS refund_method VARCHAR(30);
ALTER TABLE returns ADD COLUMN IF NOT EXISTS refund_bank_account VARCHAR(100);
ALTER TABLE returns ADD COLUMN IF NOT EXISTS refund_variable_symbol VARCHAR(20);
ALTER TABLE returns ADD COLUMN IF NOT EXISTS refund_sent_at TIMESTAMPTZ;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';
ALTER TABLE returns ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES workers(id);
ALTER TABLE returns ADD COLUMN IF NOT EXISTS created_by_type VARCHAR(20) DEFAULT 'customer';
ALTER TABLE returns ADD COLUMN IF NOT EXISTS created_by_worker UUID REFERENCES workers(id);
ALTER TABLE returns ADD COLUMN IF NOT EXISTS access_token VARCHAR(64) DEFAULT encode(gen_random_bytes(32), 'hex');
ALTER TABLE returns ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE SEQUENCE IF NOT EXISTS return_number_seq START 1;
CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(status);
CREATE INDEX IF NOT EXISTS idx_returns_type ON returns(type);
CREATE INDEX IF NOT EXISTS idx_returns_token ON returns(access_token);
CREATE INDEX IF NOT EXISTS idx_returns_number ON returns(return_number);

-- 1C: New tables

-- Return reasons (configurable catalog)
CREATE TABLE IF NOT EXISTS return_reasons (
  code VARCHAR(50) PRIMARY KEY,
  label_cs VARCHAR(200) NOT NULL,
  applies_to TEXT[] NOT NULL DEFAULT '{return,complaint,warranty}',
  requires_photos BOOLEAN DEFAULT false,
  min_photos INTEGER DEFAULT 0,
  blocks_if_mounted BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

INSERT INTO return_reasons (code, label_cs, applies_to, requires_photos, min_photos, blocks_if_mounted, sort_order) VALUES
  ('wrong_part',      'Špatný díl (nehodí se na mé auto)',  '{return}',                    false, 0, false, 10),
  ('not_needed',      'Díl už nepotřebuji',                 '{return}',                    false, 0, false, 20),
  ('wrong_delivery',  'Doručen jiný díl než objednaný',     '{return,complaint}',          true,  2, false, 30),
  ('damaged_transit', 'Poškozeno při přepravě',             '{complaint}',                 true,  3, false, 40),
  ('defective',       'Vadný díl',                          '{complaint,warranty}',        true,  2, true,  50),
  ('not_matching',    'Neodpovídá popisu / fotce',          '{return,complaint}',          true,  2, false, 60),
  ('opened_liquid',   'Otevřené balení (olej/kapalina)',    '{return}',                    false, 0, false, 70),
  ('other',           'Jiný důvod',                         '{return,complaint,warranty}', false, 0, false, 99)
ON CONFLICT (code) DO NOTHING;

-- Return items (which products are being returned)
CREATE TABLE IF NOT EXISTS return_items (
  id SERIAL PRIMARY KEY,
  return_id INTEGER REFERENCES returns(id) ON DELETE CASCADE,
  delivery_note_item_id INTEGER REFERENCES delivery_note_items(id),
  qty_returned NUMERIC NOT NULL DEFAULT 1,
  condition VARCHAR(30) DEFAULT 'unopened',
  item_note TEXT,
  images JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_return_items_return ON return_items(return_id);

-- Return status change log (audit trail)
CREATE TABLE IF NOT EXISTS return_status_log (
  id SERIAL PRIMARY KEY,
  return_id INTEGER REFERENCES returns(id) ON DELETE CASCADE,
  previous_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  changed_by UUID REFERENCES workers(id),
  change_source VARCHAR(20) DEFAULT 'admin',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_return_log_return ON return_status_log(return_id);

-- Return messages (customer <-> admin communication)
CREATE TABLE IF NOT EXISTS return_messages (
  id SERIAL PRIMARY KEY,
  return_id INTEGER REFERENCES returns(id) ON DELETE CASCADE,
  author_type VARCHAR(20) NOT NULL,
  author_worker_id UUID REFERENCES workers(id),
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_return_msg_return ON return_messages(return_id);

-- Email templates (configurable email content)
CREATE TABLE IF NOT EXISTS email_templates (
  code VARCHAR(50) PRIMARY KEY,
  subject_template VARCHAR(500) NOT NULL,
  body_html TEXT NOT NULL,
  description VARCHAR(200),
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed basic email templates
INSERT INTO email_templates (code, subject_template, body_html, description) VALUES
  ('return_created',
   'MROAUTO — Vaše žádost o vrácení {{return_number}} byla přijata',
   '<p>Dobrý den,</p><p>obdrželi jsme Vaši žádost o vrácení zboží <strong>{{return_number}}</strong>.</p><p>Aktuální stav můžete sledovat na: <a href="{{status_url}}">{{status_url}}</a></p><p>Jakmile zásilku obdržíme, budeme Vás informovat o dalším postupu.</p><p>S pozdravem,<br>MROAUTO AUTODÍLY</p>',
   'Sent to customer when return request is created'),
  ('return_status_changed',
   'MROAUTO — Aktualizace žádosti {{return_number}}',
   '<p>Dobrý den,</p><p>stav Vaší žádosti <strong>{{return_number}}</strong> byl změněn na: <strong>{{new_status_label}}</strong>.</p>{{#note}}<p>Poznámka: {{note}}</p>{{/note}}<p>Sledovat stav: <a href="{{status_url}}">{{status_url}}</a></p><p>S pozdravem,<br>MROAUTO AUTODÍLY</p>',
   'Sent when return status changes'),
  ('return_message',
   'MROAUTO — Nová zpráva k žádosti {{return_number}}',
   '<p>Dobrý den,</p><p>k Vaší žádosti <strong>{{return_number}}</strong> byla přidána nová zpráva:</p><blockquote>{{message}}</blockquote><p>Odpovědět můžete na: <a href="{{status_url}}">{{status_url}}</a></p><p>S pozdravem,<br>MROAUTO AUTODÍLY</p>',
   'Sent when admin sends a message to customer'),
  ('return_resolved',
   'MROAUTO — Žádost {{return_number}} byla vyřízena',
   '<p>Dobrý den,</p><p>Vaše žádost <strong>{{return_number}}</strong> byla vyřízena.</p><p><strong>Způsob řešení:</strong> {{resolution_label}}</p>{{#resolution_note}}<p>Poznámka: {{resolution_note}}</p>{{/resolution_note}}{{#refund_amount}}<p>Částka k vrácení: {{refund_amount}} {{currency}}</p>{{/refund_amount}}<p>Děkujeme za Vaši trpělivost.</p><p>S pozdravem,<br>MROAUTO AUTODÍLY</p>',
   'Sent when return is resolved (approved/rejected)')
ON CONFLICT (code) DO NOTHING;

-- Email queue (outgoing emails with retry)
CREATE TABLE IF NOT EXISTS email_queue (
  id SERIAL PRIMARY KEY,
  recipient_email VARCHAR(200) NOT NULL,
  recipient_name VARCHAR(200),
  template_code VARCHAR(50) REFERENCES email_templates(code),
  template_data JSONB NOT NULL DEFAULT '{}',
  subject VARCHAR(500),
  body_html TEXT,
  delivery_note_id INTEGER REFERENCES delivery_notes(id),
  return_id INTEGER REFERENCES returns(id),
  status VARCHAR(20) DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_pending ON email_queue(status, next_retry_at) WHERE status IN ('pending', 'failed');
