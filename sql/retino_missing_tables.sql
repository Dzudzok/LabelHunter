-- ============================================================
-- Retino Tracking — brakujące tabele i kolumny
-- Odpal w Supabase SQL Editor
-- ============================================================

-- 1. Tagi zásilek
CREATE TABLE IF NOT EXISTS shipment_tags (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#ffffff',
  bg_color text NOT NULL DEFAULT '#3b82f6',
  created_at timestamptz DEFAULT now()
);

-- 2. Přiřazení tagů k zásilkám (M:N)
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

-- 3. Poznámky k zásilkám
CREATE TABLE IF NOT EXISTS shipment_notes (
  id serial PRIMARY KEY,
  delivery_note_id integer NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
  author text,
  content text NOT NULL,
  is_internal boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sn_dn ON shipment_notes(delivery_note_id);

-- 4. E-mail log
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

-- 5. Pravidla automatizace
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

-- 6. Hodnocení doručení (rating widget)
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

-- 7. Chybějící sloupce v delivery_notes (e-mail flagy)
ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS email_in_transit_sent boolean DEFAULT false;
ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS email_pickup_sent boolean DEFAULT false;
ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS email_delivered_sent boolean DEFAULT false;
ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS email_failed_delivery_sent boolean DEFAULT false;

-- 8. Timestamp sloupce (pickup, delivery)
ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS pickup_at timestamptz;
ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- 9. Sub-status
ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS sub_status text;
