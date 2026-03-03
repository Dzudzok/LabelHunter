-- Workers
CREATE TABLE IF NOT EXISTS workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  pin VARCHAR(4) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Delivery notes from Nextis
CREATE TABLE IF NOT EXISTS delivery_notes (
  id SERIAL PRIMARY KEY,
  nextis_id INTEGER UNIQUE NOT NULL,
  doc_number VARCHAR(50) NOT NULL,
  invoice_number VARCHAR(50),
  order_number VARCHAR(50),
  date_issued TIMESTAMPTZ,
  customer_name VARCHAR(200),
  customer_email VARCHAR(200),
  customer_phone VARCHAR(50),
  customer_street VARCHAR(200),
  customer_city VARCHAR(100),
  customer_postal_code VARCHAR(20),
  customer_country VARCHAR(5),
  delivery_street VARCHAR(200),
  delivery_city VARCHAR(100),
  delivery_postal_code VARCHAR(20),
  delivery_country VARCHAR(5),
  delivery_phone VARCHAR(50),
  delivery_email VARCHAR(200),
  transport_name VARCHAR(100),
  amount_netto DECIMAL(13,4),
  amount_brutto DECIMAL(13,4),
  currency VARCHAR(5),
  status VARCHAR(30) DEFAULT 'pending',
  lp_shipment_id INTEGER,
  lp_barcode VARCHAR(50),
  tracking_number VARCHAR(100),
  tracking_url VARCHAR(500),
  label_pdf_url TEXT,
  shipper_code VARCHAR(20),
  shipper_service VARCHAR(50),
  scanned_by UUID REFERENCES workers(id),
  scanned_at TIMESTAMPTZ,
  label_generated_at TIMESTAMPTZ,
  email_sent_at TIMESTAMPTZ,
  tracking_token VARCHAR(100) UNIQUE,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dn_invoice ON delivery_notes(invoice_number);
CREATE INDEX IF NOT EXISTS idx_dn_status ON delivery_notes(status);
CREATE INDEX IF NOT EXISTS idx_dn_date ON delivery_notes(date_issued);
CREATE INDEX IF NOT EXISTS idx_dn_tracking_token ON delivery_notes(tracking_token);
CREATE INDEX IF NOT EXISTS idx_dn_doc_number ON delivery_notes(doc_number);

-- Delivery note items
CREATE TABLE IF NOT EXISTS delivery_note_items (
  id SERIAL PRIMARY KEY,
  delivery_note_id INTEGER REFERENCES delivery_notes(id) ON DELETE CASCADE,
  nextis_item_id INTEGER,
  item_type VARCHAR(20),
  code VARCHAR(100),
  brand VARCHAR(100),
  text VARCHAR(500),
  note TEXT,
  qty DECIMAL(13,4),
  price_unit DECIMAL(13,4),
  price_total DECIMAL(13,4),
  price_unit_inc_vat DECIMAL(13,4),
  price_total_inc_vat DECIMAL(13,4),
  vat_rate DECIMAL(5,2),
  unit_weight_netto DECIMAL(13,4),
  scanned_qty DECIMAL(13,4) DEFAULT 0,
  scan_verified BOOLEAN DEFAULT false,
  scan_skipped BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_dni_dn_id ON delivery_note_items(delivery_note_id);
CREATE INDEX IF NOT EXISTS idx_dni_code ON delivery_note_items(code);

-- Tracking sync log
CREATE TABLE IF NOT EXISTS tracking_sync_log (
  id SERIAL PRIMARY KEY,
  delivery_note_id INTEGER REFERENCES delivery_notes(id),
  lp_state_code INTEGER,
  lp_state_name VARCHAR(50),
  tracking_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer messages
CREATE TABLE IF NOT EXISTS customer_messages (
  id SERIAL PRIMARY KEY,
  delivery_note_id INTEGER REFERENCES delivery_notes(id),
  customer_email VARCHAR(200),
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- Returns
CREATE TABLE IF NOT EXISTS returns (
  id SERIAL PRIMARY KEY,
  delivery_note_id INTEGER REFERENCES delivery_notes(id),
  return_label_pdf TEXT,
  shipper_code VARCHAR(20),
  status VARCHAR(30) DEFAULT 'requested',
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  received_at TIMESTAMPTZ
);

-- Insert default workers
INSERT INTO workers (name, pin) VALUES
  ('Admin', '1234'),
  ('Magazynier 1', '1111'),
  ('Magazynier 2', '2222')
ON CONFLICT DO NOTHING;
