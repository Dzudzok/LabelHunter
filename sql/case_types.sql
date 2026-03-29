-- Case types — konfigurovatelné typy případů

CREATE TABLE IF NOT EXISTS case_types (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name_cs text NOT NULL,
  color text DEFAULT '#3B82F6',
  icon text DEFAULT 'box',              -- box, tool, shield, refresh, alert
  enabled boolean DEFAULT true,
  is_system boolean DEFAULT false,      -- system types can't be deleted
  sort_order integer DEFAULT 0,
  workflow_steps jsonb DEFAULT '[]',    -- optional custom workflow per type
  created_at timestamptz DEFAULT now()
);

-- Seed default system types
INSERT INTO case_types (code, name_cs, color, icon, enabled, is_system, sort_order) VALUES
  ('return', 'Vrácení', '#3B82F6', 'refresh', true, true, 1),
  ('complaint', 'Reklamace', '#EF4444', 'alert', true, true, 2),
  ('warranty', 'Záruka', '#8B5CF6', 'shield', true, true, 3)
ON CONFLICT (code) DO NOTHING;
