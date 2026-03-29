-- Email templates — add missing columns to existing table
-- (table already exists with: code, subject_template, body_html, description, is_active, updated_at)

ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS heading text;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Default templates (using existing 'code' column)
INSERT INTO email_templates (code, subject_template, heading, body_html, is_active) VALUES
  ('in_transit', 'Vaše zásilka [[order.code]] je na cestě', 'Vaše zásilka je na cestě', '<p>Vaše zásilka byla úspěšně odeslána a právě je na cestě. O dalších změnách stavu Vás budeme informovat e-mailem.</p>', true),
  ('available_for_pickup', 'Zásilka [[order.code]] je připravena k vyzvednutí', 'Připraveno k vyzvednutí', '<p>Vaše zásilka dorazila na výdejní místo a je připravena k vyzvednutí. Prosím vyzvedněte si ji co nejdříve.</p>', true),
  ('delivered', 'Zásilka [[order.code]] byla doručena', 'Zásilka byla doručena', '<p>Vaše zásilka byla úspěšně doručena. Děkujeme za Váš nákup u MROAUTO a těšíme se na další objednávku!</p>', true),
  ('failed_delivery', 'Nepodařilo se doručit zásilku [[order.code]]', 'Doručení se nezdařilo', '<p>Bohužel se nepodařilo doručit Vaši zásilku. Dopravce se pokusí o opětovné doručení nebo bude zásilka připravena k vyzvednutí.</p>', true),
  ('order_confirmed', 'Potvrzení objednávky [[order.code]]', 'Objednávka potvrzena', '<p>Děkujeme za Vaši objednávku! Vaše objednávka [[order.code]] byla přijata a bude co nejdříve zpracována.</p>', true),
  ('order_shipped', 'Objednávka [[order.code]] byla odeslána', 'Objednávka odeslána', '<p>Vaše objednávka byla odeslána. Sledujte stav zásilky na odkazu níže.</p>', true)
ON CONFLICT (code) DO NOTHING;

-- Email design settings (global)
CREATE TABLE IF NOT EXISTS email_design (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  header_bg_color text DEFAULT '#1046A0',
  header_text_color text DEFAULT '#ffffff',
  button_bg_color text DEFAULT '#D8112A',
  button_text_color text DEFAULT '#ffffff',
  footer_bg_color text DEFAULT '#1046A0',
  footer_text text DEFAULT 'MROAUTO AUTODÍLY s.r.o.\nČs. armády 360, Pudlov, 735 51 Bohumín',
  company_name text DEFAULT 'MROAUTO AUTODÍLY',
  company_subtitle text DEFAULT 'Sledování zásilky',
  contact_email text DEFAULT 'info@mroauto.cz',
  contact_phone text DEFAULT '+420 774 917 859',
  logo_url text,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO email_design (id) VALUES (gen_random_uuid()) ON CONFLICT DO NOTHING;
