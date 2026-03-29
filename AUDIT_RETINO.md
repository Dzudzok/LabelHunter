# AUDYT RETINO — Tracking & Returns

Data audytu: 2026-03-29
Ostatnia aktualizacja: 2026-03-29

---

## 1. BACKEND — Bugi i problemy

### CRITICAL / BUG

| # | Plik | Problem | Status |
|---|------|---------|--------|
| B1 | `server/routes/retino/tracking.js` | N+1 queries w sync JJD — batch update | DONE |
| B2 | `server/routes/retino/tracking.js` | Brak walidacji `dateFrom/dateTo` + search limit | DONE |
| B3 | `server/services/retino/ReturnEmailService.js` | Retry logic bug — ternary zawsze `'failed'` | DONE |
| B4 | `server/routes/retino/returnsPublic.js` | Upload plików bez walidacji MIME type | DONE |
| B5 | `server/routes/retino/returnsPublic.js` | `Math.random()` → `crypto.randomBytes()` | DONE |

### WARN

| # | Plik | Problem | Status |
|---|------|---------|--------|
| W1 | `server/services/retino/WebhookService.js` | `sendWebhook()` bez .catch() — błędy cicho giną | DONE |
| W2 | `server/cron/processReturnEmails.js` | Brak locka isRunning | DONE |
| W3 | `server/routes/retino/refunds.js` | Batch number collision `Date.now()` → `crypto.randomBytes` | DONE |
| W4 | `server/routes/retino/refunds.js` | Brak walidacji enum statusu — już jest (linia 162) | OK (było) |
| W5 | `server/routes/retino/webhooks.js` | URL endpointu nie walidowany | DONE |
| W6 | `server/routes/retino/analytics.js` | Cache bez limitu rozmiaru + stable key | DONE |
| W7 | `server/routes/retino/costs.js` | Brak try/catch → next(err) | DONE |
| W8 | `server/server.js` | `express.json()` bez limitu + duplikat route | DONE |
| W9 | `server/routes/retino/returnsPublic.js` | Verify search limit 50 chars | DONE |
| W10 | `server/routes/retino/returnsAdmin.js` | Search limit + date validation | DONE |
| W11 | `server/routes/retino/creditNotes.js` | Dane firmy hardcoded | LOW — backlog |
| W12 | `server/services/retino/ReturnShippingService.js` | XML parsing regexem | LOW — backlog |
| W13 | `server/routes/retino/returnShipments.js` | GET /costs/config publicznie | LOW — za auth middleware |
| W14 | `server/services/retino/ReturnShippingService.js` | Ceny wysyłki hardcoded | LOW — backlog |

---

## 2. FRONTEND — Bugi i problemy

### CRITICAL / BUG

| # | Plik | Problem | Status |
|---|------|---------|--------|
| F1 | `StepTransport.jsx` | `process.env` → `import.meta.env.VITE_ZASILKOVNA_KEY` | DONE |
| F2 | `Step3Details.jsx` | Object URL → base64 FileReader | DONE |
| F3 | `ReturnAdminCreate.jsx` | Brak walidacji wyników search + setItems([]) | DONE |
| F4 | `RefundQueue.jsx` | Walidacja default account — już jest | OK (było) |
| F5 | `TagsManagement.jsx` | tag.color bezpośrednio — OK | OK (było) |

### WARN

| # | Plik | Problem | Status |
|---|------|---------|--------|
| F6 | Większość komponentów admin | Ciche `catch {}` — brak info o błędach | DONE |
| F7 | Wiele komponentów | Brak stanów loading podczas save/delete | LOW — backlog |
| F8 | `ReturnForm.jsx` | Brak persystencji formularza po odświeżeniu | DONE (sessionStorage) |
| F9 | `ReturnStatus.jsx` | Messages loading vs empty state | SKIP (OK — dane z jednego fetcha) |
| F10 | `ReturnDetail.jsx` | Hardcoded `prompt()` → modal | LOW — backlog |
| F11 | `RefundAccounts.jsx` | Brak walidacji IBAN/BIC | DONE |
| F12 | `AutomationRules.jsx` | Brak walidacji URL webhooków | DONE |
| F13 | `TrackAndTrace.jsx` | Rating double-click | DONE |
| F14 | `AnalyticsOverview.jsx` | Filtry nie persystują w URL | DONE (useSearchParams) |

---

## 3. BAZA DANYCH — Problemy strukturalne

### CRITICAL — Tabele poza migracjami

17 tabel istnieje tylko w luźnych plikach `sql/` — skonsolidowane do `008_retino_extensions.sql`:

| Plik SQL | Tabele | Status |
|----------|--------|--------|
| `sql/return_shipments.sql` | `return_shipments` | DONE → 008 |
| `sql/case_types.sql` | `case_types` | DONE → 008 |
| `sql/custom_fields_webhooks.sql` | `custom_field_definitions`, `custom_field_values` | DONE → 008 |
| `sql/refunds.sql` | `refund_accounts`, `refund_batches`, `refund_batch_items` | DONE → 008 |
| `sql/gopay_payments.sql` | `payment_log` + ALTER return_shipments | DONE → 008 |
| `sql/edd.sql` | `edd_config`, `tt_page_views` + ALTER delivery_notes | DONE → 008 |
| `sql/shipping_costs.sql` | `shipping_costs` | DONE → 008 |
| `sql/email_templates.sql` | `email_design` + ALTER email_templates | DONE → 008 |
| `sql/retino_missing_tables.sql` | `automation_rules`, `delivery_ratings`, `shipment_tags`, `delivery_note_tags`, `shipment_notes`, `email_log` + ALTER delivery_notes | DONE → 008 |

### BUG — Niezgodności schema vs kod

| # | Problem | Status |
|---|---------|--------|
| D1 | `returns.status` DEFAULT `'requested'` w 001, ale kod używa `'new'` | DONE → 008 |
| D2 | Brak storage bucket `return-attachments` w Supabase | DONE (komentarz w 008, ręcznie w dashboardzie) |
| D3 | `email_design` tabela brakuje w 007_retino_init.sql | DONE → 008 |
| D4 | Brak stored procedure `nextval(seq_name)` | DONE → 008 (`nextval_text()`) |

### WARN — Brakujące indeksy

Wszystkie 12 indeksów dodane w `008_retino_extensions.sql`: **DONE**

---

## 4. PODSUMOWANIE NAPRAW

### Zrobione
- **B1-B5**: 5/5 backend bugów
- **W1-W10**: 10/10 ważnych warnings
- **F1-F3**: 3/3 frontend bugów (F4, F5 już OK)
- **F6, F8, F11-F14**: 6/6 frontend UX warnings
- **D1-D4**: 4/4 DB niezgodności
- **Indeksy**: 12/12
- **SQL konsolidacja**: `008_retino_extensions.sql` gotowa

### Backlog (niski priorytet)
- **W11-W14**: Hardcoded values, XML parser — do konfiguracji w przyszłości
- **F7**: Loading states przy save/delete
- **F10**: prompt() → modal w ReturnDetail

### Testy
- Client build: PASS
- Server syntax check: PASS (all modified files)
