-- Custom fields — dynamické pole pro returns
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  label_cs text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',   -- text, number, select, checkbox, date
  options jsonb DEFAULT '[]',                 -- pro select: ["option1", "option2"]
  required boolean DEFAULT false,
  applies_to text[] DEFAULT '{return}',       -- case types: return, complaint, warranty
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

-- Webhooks — external notifications
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id serial PRIMARY KEY,
  name text NOT NULL,
  url text NOT NULL,
  secret text,                               -- shared secret for signature
  events text[] DEFAULT '{return_created}',   -- return_created, status_changed, resolved, message
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
