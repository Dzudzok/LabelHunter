# 🏷️ LabelHunter — Prompt dla Claude Code

## INSTRUKCJE DLA AGENTA

Budujesz system **LabelHunter** — aplikację do zarządzania wysyłką paczek dla firmy **MROAUTO AUTODÍLY s.r.o.** (eshop z częściami samochodowymi w Czechach).

**WAŻNE: Po każdym ukończonym module/etapie zapisuj postęp w pliku `PROGRESS.md` w katalogu głównym projektu. Zapisuj tam co zostało zrobione, co działa, co wymaga jeszcze pracy. Przed rozpoczęciem pracy sprawdź `PROGRESS.md` żeby wiedzieć gdzie skończyłeś.**

**Możesz wykorzystać Agent Teams do równoległej pracy nad niezależnymi modułami (np. frontend + backend + public tracking page jednocześnie).**

---

## 1. OPIS PROJEKTU

### Cel
System do drukowania etykiet wysyłkowych w magazynie. Magazynier skanuje kod kreskowy z faktury (numer FV/Invoice), system pokazuje paczkę do przygotowania, magazynier skanuje produkty do weryfikacji, po kontroli generuje etykietę wysyłkową. Klient otrzymuje email z linkiem do śledzenia paczki.

### Kluczowe wymagania UX
- **Ekrany dotykowe 24"** — wszystkie przyciski duże, łatwe do naciśnięcia palcem
- **Skaner kodów kreskowych na palcu** — główne workflow oparte na skanowaniu
- **Każda akcja wymagająca potwierdzenia = wielki kod kreskowy na pół ekranu**, który też można zeskanować zamiast klikać
- **SZYBKOŚĆ jest priorytetem #1** — dane cache'owane lokalnie, minimalne czasy ładowania
- Font duży, kontrast wysoki, animacje minimalne

### Stack technologiczny
```
Frontend:  React (Vite) + TailwindCSS
Backend:   Node.js (Express)
Baza:      Supabase (PostgreSQL)  
Deploy:    Render.com via GitHub
Email:     Nodemailer (konfiguracja SMTP z .env)
```

---

## 2. ARCHITEKTURA SYSTEMU

### Struktura projektu
```
labelhunter/
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard/     # Panel główny magazyniera
│   │   │   ├── PackageView/   # Widok pojedynczej paczki
│   │   │   ├── Scanner/       # Komponent skanera
│   │   │   ├── BarcodeAction/ # Wielki kod kreskowy do potwierdzenia akcji
│   │   │   ├── Search/        # Zaawansowane wyszukiwanie
│   │   │   ├── SentPackages/  # Sekcja wysłanych paczek
│   │   │   ├── Workers/       # Zarządzanie pracownikami
│   │   │   └── Auth/          # Logowanie PIN
│   │   ├── pages/
│   │   │   ├── TrackingPage/  # Publiczna strona śledzenia (dla klienta)
│   │   │   └── ReturnPage/    # Strona generowania zwrotu
│   │   ├── hooks/
│   │   ├── services/          # API calls
│   │   ├── store/             # State management (zustand)
│   │   └── utils/
│   └── public/
├── server/                    # Express backend
│   ├── routes/
│   │   ├── nextis.js          # Nextis ERP integration
│   │   ├── labelprinter.js    # Label Printer API integration
│   │   ├── packages.js        # CRUD paczki
│   │   ├── tracking.js        # Tracking publiczny
│   │   ├── workers.js         # Zarządzanie pracownikami
│   │   ├── email.js           # Wysyłka emaili
│   │   └── returns.js         # Obsługa zwrotów
│   ├── services/
│   │   ├── NextisService.js
│   │   ├── LabelPrinterService.js
│   │   ├── EmailService.js
│   │   └── TrackingSyncService.js
│   ├── middleware/
│   ├── cron/                  # Scheduled jobs
│   │   ├── importDeliveryNotes.js   # Co 30min import z Nextis
│   │   └── syncTrackingStatus.js    # Co 2h sync statusów
│   └── db/
│       └── migrations/
├── PROGRESS.md                # POSTĘP PRACY — aktualizuj po każdym etapie!
├── .env.example
└── render.yaml
```

---

## 3. BAZA DANYCH (Supabase)

### Tabele

```sql
-- Pracownicy
CREATE TABLE workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  pin VARCHAR(4) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Delivery notes zaimportowane z Nextis
CREATE TABLE delivery_notes (
  id SERIAL PRIMARY KEY,
  nextis_id INTEGER UNIQUE NOT NULL,         -- id z Nextis
  doc_number VARCHAR(50) NOT NULL,           -- "no" z Nextis (np. DL820552026)
  invoice_number VARCHAR(50),                -- numer faktury (z items[].invoice)
  order_number VARCHAR(50),                  -- numer zamówienia (z items[].order)
  date_issued TIMESTAMPTZ,
  
  -- Adres główny (headAddress)
  customer_name VARCHAR(200),
  customer_email VARCHAR(200),
  customer_phone VARCHAR(50),
  customer_street VARCHAR(200),
  customer_city VARCHAR(100),
  customer_postal_code VARCHAR(20),
  customer_country VARCHAR(5),
  
  -- Adres dostawy (deliveryAddress)  
  delivery_street VARCHAR(200),
  delivery_city VARCHAR(100),
  delivery_postal_code VARCHAR(20),
  delivery_country VARCHAR(5),
  delivery_phone VARCHAR(50),
  delivery_email VARCHAR(200),
  
  -- Transport
  transport_name VARCHAR(100),               -- np. "1. GLS Kurýrní Služba"
  
  -- Kwoty
  amount_netto DECIMAL(13,4),
  amount_brutto DECIMAL(13,4),
  currency VARCHAR(5),
  
  -- Status paczki w LabelHunter
  status VARCHAR(30) DEFAULT 'pending',      -- pending | scanning | verified | label_generated | shipped | delivered | returned | problem
  
  -- Label Printer
  lp_shipment_id INTEGER,                   -- id z Label Printer po utworzeniu
  lp_barcode VARCHAR(50),                   -- barcode z Label Printer
  tracking_number VARCHAR(100),
  tracking_url VARCHAR(500),
  label_pdf_url TEXT,                        -- URL do zapisanego PDF etykiety
  shipper_code VARCHAR(20),                  -- kod przewoźnika LP (CP, DPD, GLS...)
  shipper_service VARCHAR(50),               -- kod usługi LP
  
  -- Meta
  scanned_by UUID REFERENCES workers(id),
  scanned_at TIMESTAMPTZ,
  label_generated_at TIMESTAMPTZ,
  email_sent_at TIMESTAMPTZ,
  tracking_token VARCHAR(100) UNIQUE,       -- token do publicznej strony śledzenia
  
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexy do szybkiego wyszukiwania
  CONSTRAINT idx_invoice UNIQUE (invoice_number, date_issued)
);

CREATE INDEX idx_dn_invoice ON delivery_notes(invoice_number);
CREATE INDEX idx_dn_status ON delivery_notes(status);
CREATE INDEX idx_dn_date ON delivery_notes(date_issued);
CREATE INDEX idx_dn_tracking_token ON delivery_notes(tracking_token);
CREATE INDEX idx_dn_doc_number ON delivery_notes(doc_number);

-- Pozycje (produkty) z delivery note
CREATE TABLE delivery_note_items (
  id SERIAL PRIMARY KEY,
  delivery_note_id INTEGER REFERENCES delivery_notes(id) ON DELETE CASCADE,
  nextis_item_id INTEGER,
  item_type VARCHAR(20),                    -- "goods" | "nongoods" | "rounding"
  code VARCHAR(100),                        -- kod produktu (= barcode EAN do skanowania!)
  brand VARCHAR(100),
  text VARCHAR(500),                        -- nazwa produktu
  note TEXT,
  qty DECIMAL(13,4),
  price_unit DECIMAL(13,4),
  price_total DECIMAL(13,4),
  price_unit_inc_vat DECIMAL(13,4),
  price_total_inc_vat DECIMAL(13,4),
  vat_rate DECIMAL(5,2),
  unit_weight_netto DECIMAL(13,4),
  
  -- Weryfikacja skanowania
  scanned_qty DECIMAL(13,4) DEFAULT 0,
  scan_verified BOOLEAN DEFAULT false,
  scan_skipped BOOLEAN DEFAULT false        -- pominięte skanowanie (produkt bez kodu)
);

CREATE INDEX idx_dni_dn_id ON delivery_note_items(delivery_note_id);
CREATE INDEX idx_dni_code ON delivery_note_items(code);

-- Log syncu trackingu
CREATE TABLE tracking_sync_log (
  id SERIAL PRIMARY KEY,
  delivery_note_id INTEGER REFERENCES delivery_notes(id),
  lp_state_code INTEGER,
  lp_state_name VARCHAR(50),
  tracking_data JSONB,                      -- pełne dane trackingu z LP API
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wiadomości od klientów (formularz kontaktowy ze strony śledzenia)
CREATE TABLE customer_messages (
  id SERIAL PRIMARY KEY,
  delivery_note_id INTEGER REFERENCES delivery_notes(id),
  customer_email VARCHAR(200),
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- Zwroty
CREATE TABLE returns (
  id SERIAL PRIMARY KEY,
  delivery_note_id INTEGER REFERENCES delivery_notes(id),
  return_label_pdf TEXT,
  shipper_code VARCHAR(20),
  status VARCHAR(30) DEFAULT 'requested',   -- requested | label_generated | in_transit | received
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  received_at TIMESTAMPTZ
);
```

---

## 4. API INTEGRACJE — DOKŁADNA SPECYFIKACJA

### 4.1 Nextis ERP API

**Base URL:** pobierz z env `NEXTIS_URL_API`
**Auth:** Token w body requestu

#### POST /documents/deliverynotes
Import delivery notes na dany dzień:
```json
{
  "token": "{{NEXTIS_TOKEN_ADMIN}}",
  "tokenIsMaster": true,
  "language": "cs",
  "dateFrom": "2026-02-28T00:00:00.000Z",
  "dateTo": "2026-02-28T23:59:00.000Z",
  "loadAll": true
}
```

**Response structure:**
```json
{
  "items": [
    {
      "id": 1609597,                          // ← nextis_id
      "type": "DeliveryNote",
      "dateIssued": "2026-02-28T07:11:02.187",
      "no": "DL820552026",                    // ← doc_number
      "items": [
        {
          "id": 9505275,
          "type": "goods",                    // WAŻNE: goods = produkt do skanowania
          "code": "1987302015",               // ← KOD PRODUKTU = to jest barcode do skanowania!
          "brand": "BOSCH",
          "text": "Zarovka, hlavni svetlomet",
          "qty": 3,                           // ← ilość do zweryfikowania
          "priceUnit": 77,
          "priceTotal": 231,
          "priceUnitIncVAT": 93.17,
          "priceTotalIncVAT": 279.51,
          "vatRate": 21,
          "invoice": "31956526",              // ← NUMER FAKTURY — to skanuje magazynier!
          "order": "W67758126",               // ← numer zamówienia
          "unitWeightNetto": 0.012
        },
        {
          "type": "nongoods",                 // nongoods = usługa (transport, balné) — NIE skanujemy
          "code": "PPL výdejní místo",
          "text": "PPL výdejní místo",
          "qty": 1
        }
      ],
      "headAddress": {
        "companyName": "František Ryybenský",
        "street": "Pod Vinicí 1364",
        "city": "Choceň",
        "postalCode": "56501",
        "country": "CZ",
        "phone": "+420604468190",
        "email": "fjrybicky@seznam.cz"
      },
      "deliveryAddress": {
        "street": "Pod Vinicí 1364",
        "city": "Choceň",
        "postalCode": "56501",
        "country": "CZ",
        "phone": "+420604468190",
        "email": "fjrybicky@seznam.cz"
      },
      "transportName": "8. PPL Parcelbox",    // ← z tego mapujemy przewoźnika LP
      "amountNetto": 312.81,
      "amountBrutto": 378.5,
      "currency": "CZK"
    }
  ],
  "status": "OK",
  "duration": 17020
}
```

**WAŻNE mapowanie transportName → shipper LP:**
```
"1. GLS Kurýrní Služba"           → shipperCode: "GLS", serviceCode: trzeba zmapować
"2. Zásilkovna"                    → shipperCode: "ZASILKOVNA"  
"3. We|Do Kurýrní Služba"         → shipperCode: trzeba sprawdzić w LP shippers
"4. GLS Výdejní místo"            → shipperCode: "GLS" + deliveryPointId
"6. PPL Kurýrní Služba"           → shipperCode: "PPL"
"7. Česká Pošta"                   → shipperCode: "CP"
"8. PPL Parcelbox"                 → shipperCode: "PPL" + deliveryPointId
"9. DPD Kurýrní Služba"           → shipperCode: "DPD"
"Osobní odběr"                     → osobní odběr — nie wysyłamy kurierem
"Shipping to Europe"               → international shipping
"UPS"                              → shipperCode: "UPS"
```
To mapowanie MUSI być konfigurowalne w bazie/env! Na starcie pobierz listę przewoźników z LP GET /shippers i zapisz w cache.

#### POST /documents/invoice-file
Pobranie PDF faktury (do załączenia do paczki):
```json
{
  "token": "{{NEXTIS_TOKEN_ADMIN}}",
  "tokenIsMaster": true,
  "language": "cs",
  "documentNumber": "31956526"
}
```

---

### 4.2 Label Printer API (Diamond Software)

**Base URL:** `https://lpapi.mroauto.eu`
**Auth:** OAuth 2.0 Client Credentials

#### Autentykacja — POST /connect/token
```
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(LP_CLIENT_ID:LP_CLIENT_SECRET)

grant_type=client_credentials&scope=lp_api_full
```
Response:
```json
{
  "access_token": "4d060bc068f44909c1375c6cd4b773a3",
  "expires_in": 1800,
  "token_type": "Bearer"
}
```
**Token wygasa po 30 min!** Implementuj automatyczne odświeżanie tokena.

#### GET /shippers — Lista przewoźników
```
Authorization: Bearer {{token}}
```
Response zwraca tablicę przewoźników z ich usługami (services), np:
```json
{ "code": "CP", "name": "Česká pošta", "services": [{"code": "DR", "name": "Do ruky"}, ...] }
{ "code": "DPD", "name": "DPD", "services": [{"code": "CL", "name": "DPD Classic"}, ...] }
{ "code": "GLS", ... }
```

#### POST /shipments — Utworzenie zásilky + generowanie etykiety
```json
{
  "shipperCode": "CP",
  "serviceCode": "DR",
  "variableSymbol": "31956526",          // ← numer faktury = variableSymbol
  "orderNumber": "W67758126",            // ← numer zamówienia
  "paymentInAdvance": true,              // dobírka lub platba předem
  "price": 378.50,
  "priceCurrency": "CZK",
  "cod": null,                           // kwota dobírky (null jeśli płacone z góry)
  "codCurrency": null,
  "description": "Autodíly",
  "recipient": {
    "company": "František Ryybenský",
    "street": "Pod Vinicí 1364",
    "city": "Choceň",
    "postalCode": "56501",
    "countryCode": "CZ",
    "phone": "+420604468190",
    "email": "fjrybicky@seznam.cz"
  },
  "parcels": [
    {
      "weight": 2.5                       // waga — oblicz z unitWeightNetto * qty
    }
  ],
  "goods": [                              // produkty — opcjonalnie do kontroli w LP
    {
      "name": "Zarovka, hlavni svetlomet",
      "barcode": "1987302015",
      "quantity": 3,
      "unitCode": "ks",
      "unitPrice": 77.00,
      "currencyCode": "CZK"
    }
  ],
  "labels": {
    "format": "A6"                        // ← format etykiety
  }
}
```

**Response 201** zwraca:
```json
{
  "code": 200,
  "data": [{
    "id": 1206,                           // ← lp_shipment_id — ZAPISZ!
    "variableSymbol": "31956526",
    "state": { "code": 2, "name": "Tištěný" },
    "parcels": [{
      "barcode": "DR9027000448C",         // ← lp_barcode — numer paczki
      "trackingNumber": "DR9027000448C",  // ← tracking_number
      "trackingUrl": "https://..."        // ← tracking_url
    }],
    "labels": "BASE64_PDF_CONTENT"        // ← etykieta w base64 → zapisz jako PDF
  }]
}
```

#### GET /tracking/{id} — Śledzenie zásilky
Response:
```json
{
  "data": [{
    "shipmentId": 1061,
    "variableSymbol": "1",
    "barcode": "0000000009*101",
    "trackingNumber": "0000000009",
    "shipperCode": "FOFR",
    "trackingUrl": "https://...",
    "trackingItems": [
      {
        "date": "2020-02-20 00:00:00",
        "description": "Čeká se na přenos dat",
        "postalCode": null,
        "placeOfEvent": "CP"
      }
    ]
  }]
}
```

#### POST /tracking — Śledzenie wielu zásilek naraz
```json
{
  "variableSymbols": [],
  "shipmentDayFrom": "2026-02-01",
  "shipmentDayTo": "2026-02-28",
  "barcodes": ["DR9027000448C"]
}
```

#### POST /shipments/search — Wyszukiwanie zásilek
```json
{
  "variableSymbols": ["31956526"],
  "shipmentDayFrom": "2026-02-01",
  "shipmentDayTo": "2026-02-28",
  "includeHistory": true
}
```

#### GET /shipments/{id}/state — Stan zásilky
#### DELETE /shipments/{id} — Storno zásilky

#### Stany zásilek w LP:
```
1 = Netištěný (Niewydrukowany)
2 = Tištěný (Wydrukowany)  
3 = Stornovaný (Anulowany)
4 = Připravený (Przygotowany)
5 = Nenačtený (Niezaładowany)
6 = Spojený (Połączony)
7 = Tištěný s chybou (Wydrukowany z błędem)
```

---

## 5. FLOW PRACY MAGAZYNIERA

### 5.1 Logowanie
1. Ekran wyboru pracownika (lista przycisków z imionami — duże, dotykowe)
2. Wpisanie 4-cyfrowego PIN-u (klawiatura numeryczna na ekranie, duże przyciski)
3. → Dashboard

### 5.2 Dashboard (główny widok)
**Górny pasek:**
- Imię pracownika
- Data (z możliwością cofania się na poprzednie dni)
- Statystyki: `✅ Wysłane: 47 | 📦 Do zrobienia: 16 | ⏳ Łącznie: 63`
- Przycisk "Importuj teraz" (ręczne odświeżanie z Nextis)
- Przycisk zarządzania pracownikami

**Główna część:**
- **WIELKIE pole wyszukiwania** u góry (auto-focus, gotowe na skan kodu kreskowego FV)
- Lista paczek pogrupowanych wg statusu:
  - 🔴 Do zrobienia (pending)
  - 🟡 W trakcie (scanning)
  - 🟢 Wysłane (shipped)
- Każda paczka na liście pokazuje: numer FV, imię klienta, przewoźnik, ilość pozycji, status

**Auto-import:** Co 30 minut w tle pobieraj nowe delivery notes z Nextis. Tylko NOWE dodawaj (sprawdzaj po nextis_id). Przycisk "Importuj teraz" robi to samo ręcznie.

### 5.3 Widok paczki (po zeskanowaniu FV)
Magazynier skanuje kod kreskowy z faktury → system szuka po `invoice_number` → otwiera widok paczki.

**Lewa strona (60%):**
- Dane klienta (imię, adres, telefon, email)
- Przewoźnik
- Numer FV, zamówienia

**Prawa strona (40%):**
- Lista produktów do skanowania (tylko type="goods"):
  ```
  ☐ 3x BOSCH 1987302015 — Zarovka, hlavni svetlomet
  ☐ 1x VALEO 402407 — Brzdový kotouč
  ```
- Pole skanowania produktu (auto-focus)
- Po zeskanowaniu kodu produktu → zaznacz ✅ i zmniejsz counter
- Przycisk "Pomiń skanowanie" przy każdej pozycji (dla produktów bez kodu)
- Przycisk "Pomiń wszystko" (skip scan całej paczki)

**Po zweryfikowaniu wszystkich pozycji (lub pominięciu):**
- Pojawia się WIELKI przycisk "🏷️ GENERUJ ETYKIETĘ" 
- A pod nim **WIELKI kod kreskowy akcji** (np. "GENERATE_LABEL_31956526") na pół ekranu
- Magazynier może kliknąć przycisk LUB zeskanować ten kod kreskowy

### 5.4 Generowanie etykiety
1. Wywołaj POST /shipments na LP API z danymi z paczki
2. Odbierz etykietę w base64 → przekonwertuj na PDF → zapisz
3. Wyświetl PDF do druku (lub otwórz w nowej karcie)
4. Zmień status paczki na `label_generated`
5. Wyślij email do klienta z linkiem do śledzenia
6. Po 2 sekundach → wróć do Dashboard (gotowy na kolejny skan)

### 5.5 Kody kreskowe akcji
Każda akcja wymagająca potwierdzenia wyświetla wielki kod kreskowy. System nasłuchuje na te specjalne prefiksy:
```
ACTION:GENERATE:{invoice}    → Generuj etykietę
ACTION:SKIP_ALL:{invoice}    → Pomiń skanowanie całej paczki
ACTION:CONFIRM:{invoice}     → Potwierdź akcję
ACTION:BACK                  → Wróć do Dashboard
```

---

## 6. PUBLICZNA STRONA ŚLEDZENIA PACZKI

### URL: `/tracking/{tracking_token}`

Każda paczka dostaje unikalny `tracking_token` (np. UUID lub nanoid). Klient otrzymuje link w emailu.

### Zawartość strony:
1. **Logo + nazwa firmy** MROAUTO AUTODÍLY s.r.o.
2. **Status paczki** — duży, kolorowy (np. 🟡 V přepravě / 🟢 Doručeno / 🔴 Problém)
3. **Timeline tracking** — wszystkie eventy z LP API trackingItems (data, opis, miejsce)
4. **Dane paczki:**
   - Numer faktury
   - Numer zamówienia  
   - Przewoźnik + link do trackingu przewoźnika (trackingUrl z LP)
   - Numer paczki (barcode)
   - Lista produktów (co jest w paczce)
5. **Kontakt:**
   - Email: info@mroauto.cz
   - Logistika: +420 774 917 859
6. **Formularz kontaktowy** — klient pisze wiadomość → email na info@mroauto.cz + zapis w customer_messages z pełnymi danymi paczki
7. **Przycisk "Vrátit zásilku" (Zwróć przesyłkę):**
   - Klient klika → wybiera przewoźnika
   - System generuje etykietę zwrotną z adresem:
     ```
     MROAUTO AUTODÍLY s.r.o.
     Čs. armády 360, Pudlov
     735 51 Bohumín
     Email: info@mroauto.cz
     Logistika: +420 774 917 859
     ```
   - Etykieta zwrotna do pobrania jako PDF

### Strona musi:
- Być responsywna (mobile-first — klienci otwierają na telefonie)
- Przy każdym wejściu pobierać aktualny status z LP API (GET /tracking/{lp_shipment_id})
- Wyglądać profesjonalnie (kolory: ciemnoniebieski #1a2332 + pomarańczowy akcent #f97316)

---

## 7. SYSTEM EMAILI

### 7.1 Email po wygenerowaniu etykiety
**Temat:** `Vaše zásilka od MROAUTO byla odeslána! | Objednávka {{order_number}}`

**Treść (HTML dynamiczny):**
- Logo MROAUTO
- "Dobrý den {{customer_name}},"
- Info o paczce (numer FV, zamówienie, przewoźnik)
- Numer sledovací paczki + link do trackingu przewoźnika
- **DUŻY przycisk** "Sledovat zásilku" → link do naszej strony śledzenia
- Lista produktów w paczce
- Kontakt: info@mroauto.cz, +420 774 917 859
- Stopka z adresem firmy

### 7.2 Email automatyczny — problem z dostawą
Jeśli paczka ma status `shipped` dłużej niż 3 dni robocze i nie jest `delivered`:
**Temat:** `Informace o Vaší zásilce | {{order_number}}`

**Treść:**
- "Zaznamenali jsme, že Vaše zásilka zatím nebyla doručena..."
- Link do naszej strony śledzenia
- Numer paczki + kontakt na przewoźnika
- Formularz kontaktowy link
- Kontakt MROAUTO

### 7.3 Konfiguracja (.env)
```env
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=info@mroauto.cz
SMTP_FROM_NAME=MROAUTO AUTODÍLY
```

---

## 8. CRON JOBS

### Import z Nextis — co 30 minut
```javascript
// Pseudocode
1. Pobierz delivery notes z Nextis na dzisiejszy dzień
2. Dla każdego dokumentu:
   a. Sprawdź czy nextis_id istnieje w bazie
   b. Jeśli NIE → wstaw nowy rekord + items
   c. Jeśli TAK → pomiń (nie nadpisuj!)
3. Log: "Imported X new delivery notes"
```

### Sync tracking — co 2 godziny
```javascript
// Pseudocode
1. Pobierz wszystkie paczki ze statusem 'shipped' lub 'label_generated' (nie starsze niż 14 dni)
2. Dla każdej paczki z lp_shipment_id:
   a. GET /tracking/{lp_shipment_id}
   b. Zapisz tracking_data w tracking_sync_log
   c. Jeśli parcel.delivered != null → zmień status na 'delivered'
   d. Jeśli parcel.returned != null → zmień status na 'returned'
3. Sprawdź paczki shipped > 3 dni robocze + nie delivered → wyślij email ostrzegawczy
```

---

## 9. ENV VARIABLES

```env
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# Nextis ERP
NEXTIS_URL_API=
NEXTIS_TOKEN_ADMIN=

# Label Printer (Diamond Software)  
LP_BASE_URL=https://lpapi.mroauto.eu
LP_CLIENT_ID=
LP_CLIENT_SECRET=
LP_SCOPE=lp_api_full

# SMTP Email
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=info@mroauto.cz
SMTP_FROM_NAME=MROAUTO AUTODÍLY

# App
APP_URL=                                    # URL frontendu na renderze
PORT=3001
NODE_ENV=production
```

---

## 10. KOLEJNOŚĆ IMPLEMENTACJI

### FAZA 1 — Fundament (zrób najpierw!)
- [ ] Inicjalizacja projektu (Vite + Express + Supabase)
- [ ] Migracje bazy danych (wszystkie tabele)
- [ ] Serwis autentykacji LP API (OAuth 2.0 z auto-refresh tokena)
- [ ] Serwis Nextis API (import delivery notes)
- [ ] Zapis do `PROGRESS.md`

### FAZA 2 — Backend core
- [ ] CRUD paczki (routes/packages.js)
- [ ] Import cron job (co 30 min)
- [ ] Tworzenie zásilky w LP (POST /shipments)
- [ ] Tracking sync service
- [ ] Email service (Nodemailer)
- [ ] Zapis do `PROGRESS.md`

### FAZA 3 — Frontend magazynier
- [ ] Auth (wybór pracownika + PIN)
- [ ] Dashboard (lista paczek, statystyki, import button)
- [ ] Scanner component (nasłuchiwanie na input z kodu kreskowego)
- [ ] PackageView (weryfikacja produktów skanowaniem)
- [ ] BarcodeAction (wielki kod kreskowy do potwierdzenia)
- [ ] Generowanie etykiety flow
- [ ] Wyszukiwanie zaawansowane
- [ ] Zarządzanie pracownikami
- [ ] Zapis do `PROGRESS.md`

### FAZA 4 — Strona publiczna + email
- [ ] Strona śledzenia (/tracking/:token)
- [ ] Formularz kontaktowy
- [ ] System zwrotów
- [ ] Template emaili (HTML)
- [ ] Email po wysłaniu paczki
- [ ] Email automatyczny przy problemie z dostawą
- [ ] Zapis do `PROGRESS.md`

### FAZA 5 — Sekcja wysłanych paczek
- [ ] Widok "Wysłane paczki" z filtrami (data, status, przewoźnik)
- [ ] Cofanie się na poprzednie dni
- [ ] Alerty: paczki >3 dni bez dostawy
- [ ] Zapis do `PROGRESS.md`

### FAZA 6 — Deploy
- [ ] render.yaml (web service + cron jobs)
- [ ] GitHub Actions CI
- [ ] .env.example
- [ ] README.md
- [ ] Finałowy `PROGRESS.md`

---

## 11. UWAGI KRYTYCZNE

1. **SZYBKOŚĆ** — Frontend musi działać natychmiast. Używaj zustand do local state, dane trzymaj w pamięci po załadowaniu. Lazy loading tam gdzie trzeba.

2. **KODY KRESKOWE** — Skaner na palcu wysyła znaki jak klawiatura. Po zeskanowaniu wysyła Enter. Implementuj globalny listener keydown który buforuje znaki i po Enter przetwarza. Rozróżniaj:
   - Kod zaczynający się od cyfry = numer FV (szukaj paczki)
   - Kod = kod produktu (skanuj pozycję)
   - Kod zaczynający się od "ACTION:" = akcja systemowa

3. **MAPOWANIE PRZEWOŹNIKÓW** — `transportName` z Nextis musi być mapowany na `shipperCode` + `serviceCode` w LP. Zrób tabelę mapowania w bazie lub konfigurowalny JSON. Na starcie pobierz GET /shippers z LP.

4. **TOKEN LP** — Wygasa po 30 min. Trzymaj w pamięci z timestampem, odświeżaj 5 min przed wygaśnięciem.

5. **OSOBNÍ ODBĚR** — Paczki z transportName = "Osobní odběr" NIE generują etykiet wysyłkowych. Oznaczaj je specjalnie.

6. **PROGRESS.md** — PO KAŻDYM UKOŃCZONYM ETAPIE zapisz co zrobiłeś, co działa, jakie są problemy. To jest Twoja pamięć między sesjami.

7. **Agent Teams** — Możesz użyć Agent Teams do równoległej pracy:
   - Agent 1: Backend (API integracje, cron jobs)
   - Agent 2: Frontend (komponenty React)
   - Agent 3: Public pages (tracking, returns, email templates)

8. **WALIDACJA DANYCH** — Pola z Nextis mają trailing spaces (np. postalCode: "56501     ", email: "fjrybicky@seznam.cz        "). Trimuj WSZYSTKO przy imporcie!

9. **ETYKIETY PDF** — LP API zwraca etykiety w base64 w polu `labels` response. Dekoduj i zapisz jako plik PDF. Narazie zapisuj na dysku / Supabase Storage.

---

## 12. DANE FIRMY (do emaili, stron, etykiet zwrotnych)

```
MROAUTO AUTODÍLY s.r.o.
Čs. armády 360, Pudlov
735 51 Bohumín
Česká republika

IČO: 06630405
Email: info@mroauto.cz
Logistika: +420 774 917 859
Web: www.mroauto.cz
```

---

**START: Zainicjalizuj projekt, utwórz PROGRESS.md, i zacznij od FAZY 1.**