-- Transport map table (replaces transport_map.json file)
CREATE TABLE IF NOT EXISTS transport_map (
  id SERIAL PRIMARY KEY,
  nextis_name TEXT UNIQUE NOT NULL,
  shipper_code TEXT,
  service_code TEXT
);

-- Seed default mappings
INSERT INTO transport_map (nextis_name, shipper_code, service_code) VALUES
  ('1. GLS Kurýrní Služba',   'GLS',        'AH'),
  ('2. Zásilkovna',            'ZASILKOVNA', 'ZASILKOVNA'),
  ('3. We|Do Kurýrní Služba', 'WEDO',       'WEDO'),
  ('4. GLS Výdejní místo',    'GLS',        'SM'),
  ('6. PPL Kurýrní Služba',   'PPL',        'PPL'),
  ('7. Česká Pošta',          'CP',         'DR'),
  ('8. PPL Parcelbox',        'PPL',        'PPL'),
  ('9. DPD Kurýrní Služba',   'DPD',        'CL'),
  ('UPS',                     'UPS',        'UPS'),
  ('Osobní odběr',            NULL,         NULL),
  ('Shipping to Europe',      'GLS',        'EBP'),
  ('DPD SK (Slovensko)',      'DPD',        NULL),
  ('Firemní rozvoz',          NULL,         NULL),
  ('Shipping to the UE PPL',  'PPL',        NULL),
  ('',                        NULL,         NULL)
ON CONFLICT (nextis_name) DO NOTHING;
