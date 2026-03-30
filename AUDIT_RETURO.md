# AUDYT RETURO (Retino) — Pełny przegląd modułu

Data audytu: 2026-03-30
Projekt: LabelHunter / RETURO

---

## 1. BACKEND ROUTES — server/routes/retino/

| # | Plik | Problem | Priorytet | Status |
|---|------|---------|-----------|--------|
| R1 | `returnsPublic.js` | Generowanie return_number — race condition przy concurrent requests | HIGH | TODO |
| R2 | `returnsPublic.js` | Shipment creation error cichy — brak info o braku paymentUrl | WARN | TODO |
| R3 | `returnShipments.js` | generate-label obsługuje tylko GLS, komunikat mówi "GLS a Zásilkovnu" | BUG | TODO |
| R4 | `returnsPublic.js` | `gopay_payment_url` nie przechodzi do frontendu — brakuje w select | DONE | DONE |
| R5 | `tracking.js` | Endpoint `/depot-stuck` — filtracja po stronie serwera, nie DB | WARN | OK |

---

## 2. BACKEND SERVICES — server/services/retino/

| # | Plik | Problem | Priorytet | Status |
|---|------|---------|-----------|--------|
| S1 | `ReturnShippingService.js` | GOPAY_LINK_* env vars muszą być ustawione na Render | CRITICAL | TODO |
| S2 | `ReturnShippingService.js` | API_PUBLIC_URL hardcoded na render.com — nie działa lokalnie | WARN | OK (env) |
| S3 | `ReturnShippingService.js` | Zásilkovna label — brak sprawdzenia czy API_PASSWORD ustawiony | WARN | TODO |
| S4 | `ReturnEmailService.js` | DISABLE_EMAIL_RETURO blokuje wszystkie maile | OK | DONE |
| S5 | `GoPayService.js` | REST API gotowe ale nieużywane — statyczne linki z GoPay portal | INFO | OK |

---

## 3. CARRIER SERVICES — server/services/carriers/

| Przewoźnik | API | Status | Brakuje |
|---|---|---|---|
| GLS | MyGLS API | **Działa** | Klucze w env |
| PPL | DHL CPL API | **Działa** | Klucze w env |
| Zásilkovna | Packeta XML | **Działa** | Klucz w env |
| Česká pošta | B2C (publiczne) | **Działa** | Nic |
| UPS | OAuth2 REST | **Działa** | Klucze w env |
| DPD | GeoAPI v2 | **Nie działa** | API key z portálu DPD |
| InTime | Bridge API | **Nie działa** | USERNAME + PASSWORD |

---

## 4. FRONTEND PUBLICZNY — Formularz zwrotu klienta

| # | Plik | Problem | Status |
|---|------|---------|--------|
| F1 | `ReturnForm.jsx` | i18n CZ/EN z przełącznikiem | DONE |
| F2 | `Step3Details.jsx` | VIN (obowiązkowe reklamacja), warsztat, koszty, konto | DONE |
| F3 | `StepTransport.jsx` | GLS + Zásilkovna + Vlastní doprava | DONE |
| F4 | `Step4Confirm.jsx` | Podsumowanie z nowymi polami | DONE |
| F5 | `ReturnForm.jsx` | Przycisk GoPay na stronie potwierdzenia | DONE |
| F6 | `ReturnStatus.jsx` | Status `pending_payment` + przycisk "Zaplatit" | DONE |
| F7 | `PaymentReturn.jsx` | Strona po płatności GoPay (OK/FAIL) | DONE |
| F8 | `index.css` | Dark theme overridował publiczne strony (biały tekst na białym tle) | DONE |
| F9 | `App.jsx` | `returo.` domena nie była rozpoznawana (tylko `retino.`) | DONE |

---

## 5. FRONTEND ADMIN — Panel RETURO

| # | Problem | Status |
|---|---------|--------|
| A1 | Nazwa zmieniona: Retino → RETURO w UI | DONE |
| A2 | Fix floating point % (24.299999...) | DONE |
| A3 | Bankovní účet — wyświetlanie + edycja + log zmian | DONE |
| A4 | VIN, warsztat, koszty — wyświetlanie w ReturnDetail | DONE |
| A5 | Etykieta GLS — przycisk "Vygenerovat štítek" w admin | DONE |
| A6 | Depo 4+ dní — nowy tab w Problémové zásilky | DONE |
| A7 | Email z detailu zásilky — ręczna wysyłka | DONE |
| A8 | Import kosztów — dwuetapowy z podglądem + ręczne mapowanie kolumn | DONE |
| A9 | Import příjmů — Nextis CSV z zero-padding matchowaniem | DONE |
| A10 | Filtr po krajach — Čas dodání + Včasnost zásilek | DONE |
| A11 | Panel PL/CZ — przełącznik języka admin panelu | TODO |

---

## 6. BAZA DANYCH

| Migracja | Zawartość | Status |
|----------|-----------|--------|
| 007_retino_init.sql | Tabele: returns, return_items, return_status_log, return_messages, email_templates, email_queue, return_reasons | DONE |
| 008_retino_extensions.sql | Tabele: shipping_costs, edd_config, tt_page_views, email_design, shipment_tags, delivery_note_tags, shipment_notes, email_log, automation_rules, delivery_ratings, return_shipments, payment_log, refund_accounts/batches/items, case_types, custom_fields, webhooks + indeksy | DONE |
| 009_returns_extra_fields.sql | Kolumny: vin, workshop_name, workshop_address, extra_costs_* + tabela bank_account_log | TODO (odpalić) |

### Problemy DB:
| # | Problem | Priorytet | Status |
|---|---------|-----------|--------|
| D1 | `returns.access_token` brak UNIQUE constraint | WARN | TODO |
| D2 | Return number race condition — potrzebny DB sequence | HIGH | TODO |
| D3 | Storage bucket `return-attachments` — ręcznie w Supabase | LOW | TODO |

---

## 7. FLOW PŁATNOŚCI (GoPay)

### Obecny flow:
1. Klient wybiera GLS (99 Kč) / Zásilkovna (89 Kč)
2. Shipment tworzony ze statusem `pending_payment`
3. `gopay_payment_url` z env `GOPAY_LINK_GLS` / `GOPAY_LINK_ZASILKOVNA`
4. Klient klika → GoPay → płaci
5. GoPay redirectuje na `/vraceni/platba/OK` lub `/FAIL`
6. Admin weryfikuje w GoPay Monitor → generuje etykietę ręcznie

### Problemy:
| # | Problem | Status |
|---|---------|--------|
| P1 | GOPAY_LINK_GLS i GOPAY_LINK_ZASILKOVNA muszą być na Render | TODO |
| P2 | Statyczne linki GoPay — brak powiązania z konkretnym shipmentem | WARN (ok na razie) |
| P3 | Po płatności brak automatycznego generowania etykiety — admin ręcznie | OK (design choice) |
| P4 | GoPayService REST API gotowy ale nieużywany | INFO |

---

## 8. ENV ZMIENNE — wymagane na Render

### Krytyczne (bez nich nie działa):
```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
SMTP_FROM_NAME=MROAUTO
APP_URL=https://labelhunter.mroautoapp.cz
FRONTEND_URL=https://returo.mroautoapp.cz
API_PUBLIC_URL=https://labelhunter-server.onrender.com
SYSTEM_USER=
SYSTEM_PASSWORD=
```

### Przewoźnicy:
```
GLS_USERNAME=
GLS_PASSWORD=
GLS_CLIENT_NUMBER=
PPL_CLIENT_ID=
PPL_CLIENT_SECRET=
ZASILKOVNA_API_PASSWORD=
UPS_CLIENT_ID=
UPS_CLIENT_SECRET=
DPD_API_KEY=           # brakuje — potrzebny z DPD portálu
INTIME_USERNAME=       # brakuje
INTIME_PASSWORD=       # brakuje
```

### Płatności:
```
GOPAY_LINK_GLS=https://gate.gopay.com/gw/pay-base-v2?...
GOPAY_LINK_ZASILKOVNA=https://gate.gopay.com/gw/pay-base-v2?...
```

### Kontrola:
```
DISABLE_EMAIL_RETURO=true    # wyłącza wszystkie maile
LP_SYNC_DISABLED=true        # wyłącza sync przez LP API
```

---

## 9. BEZPIECZEŃSTWO

| # | Problem | Priorytet | Status |
|---|---------|-----------|--------|
| SEC1 | Klucze API usunięte z hardcode — tylko env | DONE |
| SEC2 | JWT_SECRET losowy po restarcie — tokeny tracą ważność | WARN | TODO (dodać stały JWT_SECRET do env) |
| SEC3 | CORS — dodany `returo.mroautoapp.cz` | DONE |
| SEC4 | Upload — MIME type whitelist | DONE |
| SEC5 | Search input — ograniczony do 50/100 znaków | DONE |
| SEC6 | Label PDF — publiczny dostęp bez auth (design choice) | OK |

---

## 10. CO ZROBIONE W TEJ SESJI

### Duże funkcjonalności:
- ✅ Formularz zwrotu CZ/EN z przełącznikiem
- ✅ Pola: VIN (wymagane reklamacja), warsztat montażu, dodatkowe koszty, numer konta (wymagany)
- ✅ Opcje wysyłki: GLS + Zásilkovna + Vlastní doprava
- ✅ Etykieta GLS — generowana przez GLS MyGLS API (PrintLabels)
- ✅ Etykieta Zásilkovna — generowana przez Zásilkovna XML API
- ✅ Etykiety serwowane z DB (base64), nie filesystem (Render ephemeral)
- ✅ GoPay płatność — statyczne linki przed generowaniem etykiety
- ✅ Adnotacja przy edycji numeru konta + historia zmian
- ✅ Import kosztów — dwuetapowy z podglądem i ręcznym mapowaniem kolumn
- ✅ Import příjmů Nextis — zero-padding matching
- ✅ XLSX support (pakiet xlsx)
- ✅ Depo 4+ dní — nowy tab problemowych zásilek
- ✅ Email z detailu zásilky (tracking)
- ✅ Filtr po krajach (Čas dodání + Včasnost)
- ✅ Rename Retino → RETURO
- ✅ Fix floating point %
- ✅ DISABLE_EMAIL_RETURO kill switch
- ✅ Klucze API przeniesione do env (usunięte hardcode)
- ✅ UPS API — pełne klucze
- ✅ CORS fix dla returo.mroautoapp.cz
- ✅ isRetinoDomain fix dla returo.*
- ✅ Dark theme fix dla publicznych stron

### Do zrobienia (backlog):
- ❌ Panel admina PL/CZ przełącznik
- ❌ DPD GeoAPI — brakuje API key
- ❌ InTime — brakuje credentials
- ❌ JWT_SECRET stały w env
- ❌ access_token UNIQUE constraint
- ❌ Drukowanie etykiet przez klienta na stronie statusu (automatyczne po GoPay)
- ❌ GoPay REST API (dynamiczne płatności zamiast statycznych linków)
- ❌ W11-W14 z poprzedniego audytu (hardcoded company info, XML parser)

---

## 11. ARCHITEKTURA

```
Frontend (Render Static Site)
├── labelhunter.mroautoapp.cz  → LabelHunter admin
├── returo.mroautoapp.cz       → RETURO admin + publiczny formularz
│   ├── /vraceni               → Formularz zwrotu (CZ/EN)
│   ├── /vraceni/stav/:token   → Status zwrotu klienta
│   ├── /vraceni/platba/:status → Strona po GoPay
│   ├── /sledovani/:token      → Track & Trace
│   └── /retino/*              → Admin panel RETURO
│
Backend (Render Web Service)
├── labelhunter-server.onrender.com
│   ├── /api/retino/public/*   → Publiczne (bez auth)
│   ├── /api/retino/*          → Admin (JWT auth)
│   ├── /api/retino/return-shipments/:id/label.pdf → Etykieta PDF (publiczne)
│   └── Cron: syncTracking (2h), processEmails (1min), automation (4h)
│
Database: Supabase (PostgreSQL)
Storage: Supabase Storage (return-attachments bucket)
Payments: GoPay (platební tlačítko)
Carriers: GLS, PPL, Zásilkovna, ČP, UPS, DPD(TODO), InTime(TODO)
```
