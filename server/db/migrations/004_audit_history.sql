-- Audit history for delivery notes
-- Tracks all changes: scanning, label generation, status changes, address edits, etc.
CREATE TABLE IF NOT EXISTS package_history (
  id SERIAL PRIMARY KEY,
  delivery_note_id INTEGER REFERENCES delivery_notes(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,       -- e.g. 'scan_item', 'skip_item', 'skip_all', 'generate_label', 'cancel_label', 'status_change', 'address_update', 'import'
  worker_id UUID REFERENCES workers(id),
  worker_name VARCHAR(100),
  details JSONB,                     -- action-specific data (e.g. item code, old/new status, changed fields)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ph_dn_id ON package_history(delivery_note_id);
CREATE INDEX IF NOT EXISTS idx_ph_created ON package_history(created_at);
