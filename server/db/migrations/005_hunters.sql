-- Hunters (warehouse pickers/preparers)
CREATE TABLE IF NOT EXISTS hunters (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hunter assignment: which hunter prepared which package
CREATE TABLE IF NOT EXISTS hunter_assignments (
  id SERIAL PRIMARY KEY,
  delivery_note_id INTEGER REFERENCES delivery_notes(id) ON DELETE CASCADE,
  hunter_id INTEGER REFERENCES hunters(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES workers(id),
  worker_name VARCHAR(100),
  items_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ha_dn_id ON hunter_assignments(delivery_note_id);
CREATE INDEX IF NOT EXISTS idx_ha_hunter_id ON hunter_assignments(hunter_id);
CREATE INDEX IF NOT EXISTS idx_ha_created ON hunter_assignments(created_at);

-- Hunter errors: mistakes reported on hunters
CREATE TABLE IF NOT EXISTS hunter_errors (
  id SERIAL PRIMARY KEY,
  delivery_note_id INTEGER REFERENCES delivery_notes(id) ON DELETE CASCADE,
  hunter_id INTEGER REFERENCES hunters(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES workers(id),
  worker_name VARCHAR(100),
  error_type VARCHAR(30) NOT NULL, -- 'wrong_qty', 'missing_product', 'wrong_product'
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_he_hunter_id ON hunter_errors(hunter_id);
CREATE INDEX IF NOT EXISTS idx_he_created ON hunter_errors(created_at);
