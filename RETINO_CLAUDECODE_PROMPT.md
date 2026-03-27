# MROAUTO Retino — Claude Code Implementation Prompt

## Kontekst projektu

Rozszerzam istniejący projekt **LabelHunter** o moduł **Retino** — system śledzenia przesyłek (Tracking Dashboard) i obsługi zwrotów/reklamacji (Returns) inspirowany Retino.com. To NIE jest nowy projekt — dobudowuję nowe routes, services i komponenty do istniejącej aplikacji.

**Stack:** React/Vite (frontend) + Node.js/Express (backend) + Supabase (PostgreSQL) + Render.com

---

## Istniejący schemat bazy danych (NIE ZMIENIAJ tych tabel — Retino CZYTA z nich)

### delivery_notes (główna tabela przesyłek)
```
id (integer PK), nextis_id, doc_number, invoice_number, order_number, date_issued,
customer_name, customer_email, customer_phone, customer_street, customer_city, 
customer_postal_code, customer_country,
delivery_street, delivery_city, delivery_postal_code, delivery_country, delivery_phone, delivery_email,
transport_name, amount_netto, amount_brutto, currency, status,
lp_shipment_id, lp_barcode, tracking_number, tracking_url, label_pdf_url,
shipper_code, shipper_service, scanned_by, scanned_at, label_generated_at,
email_sent_at, tracking_token, imported_at, updated_at, label_generated_by,
lp_parcels (jsonb), lp_id, source, cod_amount, weight, delivery_point_id
```

### delivery_note_items (produkty z objednávky)
```
id (integer PK), delivery_note_id (FK→delivery_notes), nextis_item_id,
item_type, code, brand, text, note, qty, price_unit, price_total,
price_unit_inc_vat, price_total_inc_vat, vat_rate, unit_weight_netto,
scanned_qty, scan_verified, scan_skipped, ean
```

### tracking_sync_log (historia statusów)
```
id (integer PK), delivery_note_id (FK), lp_state_code (vždy NULL), lp_state_name (vždy NULL),
tracking_data (jsonb — TADY JSOU DATA), synced_at
```

**Struktura tracking_data JSONB:**
```json
{
  "code": 200,
  "data": [{
    "weight": 0.2, "barcode": "904540710179", "shipmentId": 993737,
    "orderNumber": "47193126", "shipperCode": "GLS",
    "trackingNumber": "90454071017",
    "trackingUrl": "https://gls-group.eu/CZ/cs/sledovani-zasilek.html?match=90454071017",
    "trackingItems": [
      { "date": "2026-03-18 10:47:16", "description": "Ostatní data přijata", "placeOfEvent": "Czech Republic", "postalCode": null },
      { "date": "2026-03-19 08:30:00", "description": "Na doručení", "placeOfEvent": "Prague" }
    ]
  }]
}
```

### workers (admin users — reuse)
```
id (uuid PK), name, pin, is_active, created_at
```

### returns (EXISTUJE s min. sloupci — ROZŠÍŘÍME)
```
id (integer PK), delivery_note_id (FK), return_label_pdf, shipper_code, status, requested_at, received_at
```

### transport_map
```
id (integer PK), nextis_name, shipper_code, service_code, skip
```

---

## KROK 1: SQL Migrace

Vytvoř soubor `supabase/migrations/retino_001_init.sql` a spusť ho. Obsah:

### 1A: Nové sloupce na delivery_notes

```sql
ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS unified_status VARCHAR(50) DEFAULT 'unknown';
ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS last_tracking_update TIMESTAMPTZ;
ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS last_tracking_description VARCHAR(500);
CREATE INDEX IF NOT EXISTS idx_dn_unified_status ON delivery_notes(unified_status);
CREATE INDEX IF NOT EXISTS idx_dn_shipper ON delivery_notes(shipper_code);
CREATE INDEX IF NOT EXISTS idx_dn_customer_email ON delivery_notes(customer_email);
```

### 1B: Rozšíření returns

```sql
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
```

### 1C: Nové tabulky

```sql
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

CREATE TABLE IF NOT EXISTS email_templates (
  code VARCHAR(50) PRIMARY KEY,
  subject_template VARCHAR(500) NOT NULL,
  body_html TEXT NOT NULL,
  description VARCHAR(200),
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
```

---

## KROK 2: Backend Services

### tracking-status-mapper.js

Vytvoř `server/services/retino/tracking-status-mapper.js`. Mapuje czesky/anglicky `description` text z `tracking_data.data[0].trackingItems[].description` na unified_status.

Reálné descriptions z databáze (150k+ záznamů) a jejich mapping:

| Description (regex) | → unified_status |
|---|---|
| `^doručeno\s*$`, `the parcel is delivered`, `zásilka je u vás`, `balíček jsme úspěšně doručili`, `dodání zásilky` | **delivered** |
| `doručení do parcelshop`, `uskladněno v parcelshop`, `parcellocker deposit`, `delivered.*pick-?up point`, `doručeno do ups access point`, `uschováno na ups access point` | **available_for_pickup** |
| `adresát nezastižen`, `odmítnutí převzetí` | **failed_delivery** |
| `zpětné zaslání odesílateli` | **returned_to_sender** |
| `^damaged$` | **problem** |
| `^na doručení$`, `being delivered today`, `připraveno pro doručení dnes`, `zásilka se doručuje`, `příprava zásilky k doručení`, `doručování zásilky`, `termín doručení` | **out_for_delivery** |
| `received.*from the sender`, `zásilka převzata do přepravy`, `received.*for delivery` | **handed_to_carrier** |
| `dorazil.*do zařízení`, `opustil.*zařízení`, `zásilka dorazila na depo`, `zásilka byla (připravena\|odeslána)`, `zásilka v přepravě`, `rollkarte\|depo vstup\|hub inbound\|hub storage`, `on the way to.*depot`, `located at.*depot`, `skenování`, `přeprava zásilky`, `vypravena`, `zpracování v zařízení`, `dorazila do cílové`, `balík byl zpracován` | **in_transit** |
| `ostatní data přijata`, `^registrace$`, `cod data přijata`, `o vaší zásilce už víme`, `odesílatel vytvořil štítek`, `obdrženy údaje`, `small parcel` | **label_created** |

**DŮLEŽITÉ:** Matching musí být v tomto pořadí (delivered PŘED out_for_delivery). Funkce `getUnifiedStatus(trackingData)` parsuje celý JSONB a vrací nejpokročilejší status (dle priority: delivered=100 > available_for_pickup=90 > failed=80 > out_for_delivery=70 > in_transit=60 > handed_to_carrier=50 > label_created=40).

### return-workflow.js

Vytvoř `server/services/retino/return-workflow.js`:

```
Povolené přechody:
new → awaiting_shipment | under_review | cancelled
awaiting_shipment → in_transit | cancelled
in_transit → received
received → under_review
under_review → approved | rejected
approved → refund_pending | resolved
refund_pending → refunded
refunded → resolved
rejected → resolved

Funkce: canTransition(currentStatus, newStatus) → boolean
Funkce: getStatusLabel(status) → český text
```

### syncUnifiedStatus.js (job)

Vytvoř `server/jobs/syncUnifiedStatus.js`:
- Najdi delivery_notes kde unified_status='unknown' OR kde existuje novější tracking_sync_log
- Pro každou: najdi poslední tracking_sync_log, parsuj tracking_data přes getUnifiedStatus()
- UPDATE delivery_notes SET unified_status, last_tracking_update, last_tracking_description
- Exportuj funkci která se volá po každém tracking sync + jako standalone job

---

## KROK 3: Backend Routes

Vytvoř v `server/routes/retino/`:

### tracking.js (auth required)
```
GET /api/retino/tracking/dashboard — statusCounts + carrierStats (posledních 30 dní)
GET /api/retino/tracking/shipments — filtry: status, shipper, dateFrom, dateTo, search (doc_number/tracking_number/customer_name/customer_email), paginace
GET /api/retino/tracking/shipments/:id — detail + items + tracking timeline (parsovaná z tracking_sync_log → trackingItems → mapovaná přes status mapper)
```

### returnsPublic.js (BEZ auth — public)
```
POST /api/retino/public/returns/verify — {docNumber, email} → ověření + items z delivery_note_items
GET  /api/retino/public/returns/reasons — return_reasons WHERE is_active
POST /api/retino/public/returns/create — validace, generuj return_number (RET-YYYY-XXXXX), access_token, INSERT returns + return_items + return_status_log
GET  /api/retino/public/returns/:accessToken — stav, items, timeline, messages (jen is_internal=false)
POST /api/retino/public/returns/:accessToken/message — {content} → INSERT return_messages
POST /api/retino/public/returns/:accessToken/upload — multipart → Supabase Storage bucket 'return-attachments'
GET  /api/retino/public/track/:trackingToken — delivery_notes WHERE tracking_token + tracking timeline
```

### returnsAdmin.js (auth required)
```
GET    /api/retino/returns — seznam s filtry (status, type, assigned, date, search) + paginace
GET    /api/retino/returns/dashboard — statusCounts, avgResolutionDays
GET    /api/retino/returns/:id — detail vč. items, timeline, messages (i interní)
POST   /api/retino/returns/admin-create — admin vyplní za zákazníka
PATCH  /api/retino/returns/:id/status — {newStatus, note} s validací canTransition()
PATCH  /api/retino/returns/:id/assign — {workerId}
PATCH  /api/retino/returns/:id/resolve — {resolutionType, amount, note, refundMethod, bankAccount, variableSymbol}
POST   /api/retino/returns/:id/messages — {content, isInternal}
```

Registrace routes do hlavního Express app (existující index.js/app.js).

---

## KROK 4: Frontend Komponenty

### Routing — přidej do App.jsx:
```jsx
// Admin (auth)
<Route path="/retino/tracking" element={<TrackingDashboard />} />
<Route path="/retino/tracking/:id" element={<ShipmentDetail />} />
<Route path="/retino/returns" element={<ReturnsDashboard />} />
<Route path="/retino/returns/new" element={<ReturnAdminCreate />} />
<Route path="/retino/returns/:id" element={<ReturnDetail />} />

// Public (no auth)
<Route path="/sledovani/:trackingToken" element={<TrackAndTrace />} />
<Route path="/vraceni" element={<ReturnForm />} />
<Route path="/vraceni/stav/:accessToken" element={<ReturnStatus />} />
```

### Navigace — přidej do sidebaru/nav:
Nové položky: **Tracking** (→ /retino/tracking), **Vrácení** (→ /retino/returns)

### Struktura souborů:
```
src/components/retino/
├── tracking/
│   ├── TrackingDashboard.jsx   — stats karty + shipment tabulka s filtry
│   ├── ShipmentList.jsx        — tabulka s doc#, tracking#, kurýr, status badge, zákazník, datum
│   ├── ShipmentDetail.jsx      — detail + items + tracking timeline (vertical stepper)
│   └── StatusBadge.jsx         — barevný badge dle unified_status
├── returns/
│   ├── ReturnsDashboard.jsx    — stats karty + returns tabulka
│   ├── ReturnsList.jsx         — tabulka: RET#, zákazník, typ, status, přiřazeno, datum
│   ├── ReturnDetail.jsx        — detail + workflow actions + messages + resolve
│   ├── ReturnAdminCreate.jsx   — admin formulář
│   ├── ReturnStatusStepper.jsx — vizuální workflow kroky
│   └── ReturnResolveModal.jsx  — dialog: refund/replacement/reject
└── shared/
    ├── StatsCards.jsx          — reusable stats karty s čísly a barvami
    └── DataTable.jsx           — reusable tabulka s filtry a paginací

src/components/public/
├── TrackAndTrace.jsx           — /sledovani/:trackingToken (MROAUTO branding)
├── ReturnForm/
│   ├── ReturnForm.jsx          — wizard wrapper (4 kroky)
│   ├── Step1Verify.jsx         — doc_number + email
│   ├── Step2Products.jsx       — checkboxy produktů + qty
│   ├── Step3Details.jsx        — typ, důvod, auto info, fotky, popis
│   └── Step4Confirm.jsx        — shrnutí + submit
└── ReturnStatus.jsx            — /vraceni/stav/:accessToken
```

### Barvy unified_status:
```
label_created: #9CA3AF (gray), handed_to_carrier: #3B82F6 (blue),
in_transit: #8B5CF6 (purple), out_for_delivery: #F59E0B (amber),
available_for_pickup: #F59E0B (amber), delivered: #10B981 (green),
failed_delivery: #EF4444 (red), returned_to_sender: #EF4444 (red),
problem: #DC2626 (dark red), unknown: #6B7280 (gray)
```

### MROAUTO branding (public pages):
- Modrá: #1046A0, Červená: #D8112A
- Logo v headeru, firemní patička
- Jazyk: **kompletně čeština**

---

## KROK 5: Pořadí implementace

1. SQL migrace (všechny najednou)
2. tracking-status-mapper.js + syncUnifiedStatus job → spustit → naplnit unified_status
3. Tracking API routes → TrackingDashboard + ShipmentDetail
4. TrackAndTrace (public page)
5. Return workflow + public API routes
6. ReturnForm (public wizard)
7. ReturnStatus (public page)
8. Returns admin routes → ReturnsDashboard + ReturnDetail

---

## Pravidla

- **NEPŘEPISUJ existující LabelHunter kód.** Jen přidávej. Jediné změny v existujících souborech: routes v App.jsx, navigation links, registrace nových Express routes.
- **Jazyk UI: čeština** na všech zákaznických stránkách. Admin panel může být CZ/EN mix.
- **Supabase client:** použij stejný jako existující LabelHunter kód.
- **Auth:** pro admin routes použij stejný mechanismus jako LabelHunter. Public routes jsou bez auth.
- **Respektuj konvence projektu** — styling, naming, imports, component patterns.
- **Všechny nové API routes pod /api/retino/** pro čistou separaci.
