# Retino Tracking Module — Dokumentacja

## Przegladowa

Modul Retino Tracking to kompletny system sledowania zasilek dla MROAUTO, zintegrowany z LabelHunterem. Obsluguje tracking zasilek od nadania do doreczenia, automatyczne powiadomienia e-mail, analityka i publiczna strona Track & Trace.

---

## Funkcje

### 1. Tracking Dashboard
**Route:** `/retino/tracking`
**Pliki:** `client/src/components/retino/tracking/TrackingDashboard.jsx`, `server/routes/retino/tracking.js`

- Karty statystyk (30 dni): celkem, doruceno, v preprave, k vyzvednutí, nedoruceno
- Tabela zasilek z filtrami: status, dopravce, daty, wyszukiwanie
- **Stítky (tagi)** widoczne na liscie przy kazdej zasilce
- Klikniecie na wiersz otwiera detail zasilki
- Statistiky dopravcu na dole strony
- Cache dashboardu (2 min TTL)

### 2. Detail zasilki
**Route:** `/retino/tracking/:id`
**Pliki:** `client/src/components/retino/tracking/ShipmentDetail.jsx`, `server/routes/retino/tracking.js`

- Pelne informacje o zasilce (doklad, zakaznik, dopravce, tracking)
- **Timeline trackingu** — chronologicka historie stavov z API dopravce
- **Stítky** — dodawanie/usuwanie tagov, kolorowe badge
- **Poznamky** — wewnetrzne notatki z autorem i timestampem
- **E-mail log** — historia wyslanych maili (typ, odbiorca, status sent/failed)
- **Prodlouzit ulozni dobu** — przycisk dla zasilek Zasilkovna/CP w statusie "k vyzvednutí"
- Zobrazenie `stored_until` daty

### 3. Sledovani problemov
**Route:** `/retino/tracking/problems`
**Pliki:** `client/src/components/retino/tracking/TrackingProblems.jsx`

Trzy zakladki:
- **Nedoruceno** — zasilki failed_delivery / returned_to_sender
- **Dlouho v preprave** — zasilki in_transit > X dni bez aktualizace
- **Brzy se bude vracet** — zasilki available_for_pickup blizko expirace ulozni doby
  - ExpiryBadge z kolorowym kodem (cervena=expirowano, zluta=1 den, fialova=2+ dni)
  - Filtr po dniach (1d, 2d, 3d, 5d, 7d)

### 4. Automatyzace
**Route:** `/retino/settings/automation`
**Pliki:** `client/src/components/retino/settings/AutomationRules.jsx`, `server/services/AutomationEngine.js`, `server/routes/retino/automation.js`

- CRUD pravidel automatizace
- **Triggery:** status_change, days_no_update, days_on_branch, days_until_expiry
- **Akce:** send_email, add_tag, remove_tag, webhook
- **Dwa tryby wykonania:**
  - Real-time: `processStatusChange()` — uruchamiany przy zmianie statusu w TrackingSyncService
  - Scheduled: `runScheduledChecks()` — cron co 4 godziny dla triggerow czasowych
- Webhook wysyla HTTP POST z 10s timeout + opcjonalny header `X-Retino-Secret`
- Karty regul z toggle enabled/disabled

### 5. E-mailowe powiadomienia
**Pliki:** `server/services/TrackingEmailService.js`

**Tracking e-maile (automatyczne przy zmianie statusu):**
- `in_transit` — Zasilka na ceste
- `available_for_pickup` — Pripraveno k vyzvednutí
- `delivered` — Doruceno
- `failed_delivery` — Doruceni se nezdarilo

**Transakcni e-maile:**
- `order_confirmed` — Potvrzeni objednavky
- `order_shipped` — Objednavka odeslana

**Funkcje:**
- Dynamicke tagy: `[[order.code]]`, `[[shipping.tracking_number]]`, `[[customer.name]]` itd.
- Duplikat guard — flagi `email_*_sent` na delivery_notes
- **SMTP_TEST_RECIPIENT** — gdy ustawiony, wszystkie maile ida na testowy adres
- Log kazdego mailu do tabeli `email_log`
- HTML szablon z brandingem MROAUTO (konfigurowalny przez Email Designer)

### 6. E-mail Designer
**Route:** `/retino/settings/email-designer`
**Pliki:** `client/src/components/retino/settings/EmailDesigner.jsx`, `server/routes/retino/emailSettings.js`

- Lista szablonov z lewej strony
- Edytor: przedmiot, nadpis, body HTML, toggle aktywny
- Podglad na zywo (iframe) po prawej stronie
- **Globalny design:** kolory (zahlavi, tlacitko, zapati), texty firmy, kontakt
- Test e-mail — wyslij testowy mail na dowolny adres
- Referencia dynamickych tagov

### 7. Stítky (Tagi)
**Route:** `/retino/settings/tags`
**Pliki:** `client/src/components/retino/settings/TagsManagement.jsx`, `server/routes/retino/tags.js`

- CRUD tagov z 7 presetami kolorov
- Live preview badge
- Usuwanie z potwierdzeniem
- Tagi widoczne na liscie zasilek i w detailu

### 8. Public Track & Trace
**Route:** `/sledovani/:trackingToken`
**Pliki:** `client/src/components/public/TrackAndTrace.jsx`, `server/routes/retino/returnsPublic.js`

- Publiczna strona sledowania zasilki (bez logowania)
- Timeline z historii trackingu
- **Rating widget** — gwiazdki 1-5 po doreczeniu
  - Wybor problemov (late_delivery, damaged_package itd.) dla ocen 1-4
  - Opcjonalny komentarz
  - Jednorazowe (duplicate check)
- **T&T page view tracking** — loguje kazde zobrazeni do `tt_page_views` (fire-and-forget)

### 9. Prodlouzeni ulozni doby
**Pliki:** `server/services/StorageExtensionService.js`, `server/routes/retino/tracking.js`

- Podpora dopravcu:
  - **Zasilkovna** — XML API `packetAttributeChange` (zmena `storedUntil`)
  - **Ceska Posta** — JSON POST `b2c.cpost.cz/services/ParcelService/v1/extendDeposit`
- Aktualizuje `stored_until` w bazie po uspechu
- Przycisk widoczny w detailu zasilki (tylko status `available_for_pickup`)

### 10. Analytika

#### Hodnoceni dopravy (Ratings)
**Route:** `/retino/analytics/ratings`
- Rozdeleni hodnoceni (1-5 hvezd)
- Breakdown problemov
- Tabulka dle dopravce

#### Analyza nakladu (Costs)
**Route:** `/retino/analytics/costs`
- Import CSV faktur dopravcu (auto-detekce delimiteru)
- Statistiky: trzby, naklady, marze, marze%
- Tabulka dle dopravce
- Mesicni trend
- Manual entry + delete

#### Vcasnost zasilek (Timeliness / EDD)
**Route:** `/retino/analytics/timeliness`
- Statistiky: on_time, late, early
- CSS proportion bar
- Tabulka dle dopravce
- **EDD config editor** — nastaveni business_days per dopravce+zeme

#### Track & Trace Analytics
**Route:** `/retino/analytics/tt`
- Celkove zobrazeni, unikatni navstevnici
- Bar chart zobrazeni za den
- Top zasilky dle zobrazeni

---

## Architektura backendu

### Cron joby
| Job | Soubor | Interval | Co dela |
|-----|--------|----------|---------|
| syncTrackingStatus | `server/cron/syncTrackingStatus.js` | Co 2 hodiny | Sync stavu z API dopravcu + EDD batch update |
| runAutomation | `server/cron/runAutomation.js` | Co 4 hodiny | Casove triggery automatizace |

### Klicove servisy
| Servis | Soubor | Ucel |
|--------|--------|------|
| TrackingSyncService | `server/services/TrackingSyncService.js` | Sync stavu z dopravcu (direct API + LP API fallback) |
| TrackingEmailService | `server/services/TrackingEmailService.js` | Odesilani trackingových emailu |
| AutomationEngine | `server/services/AutomationEngine.js` | Provadeni pravidel automatizace |
| EDDService | `server/services/EDDService.js` | Vypocet EDD a vcasnosti |
| StorageExtensionService | `server/services/StorageExtensionService.js` | Prodlouzeni ulozni doby u dopravce |
| CarrierRouter | `server/services/carriers/CarrierRouter.js` | Routovani na spravny carrier API |

### Carrier API integrace
- **GLS** — GLS WebAPI (direct)
- **PPL** — PPL CPL API + JJD sync
- **DPD** — DPD API
- **UPS** — UPS Tracking API
- **Ceska Posta** — CP B2C API
- **Zasilkovna** — Zasilkovna API
- **Fallback** — LP (LabelPrinter) API pro dopravce bez prime integrace

### API Routes
| Route | Soubor |
|-------|--------|
| `/api/retino/tracking` | `server/routes/retino/tracking.js` |
| `/api/retino/analytics` | `server/routes/retino/analytics.js` |
| `/api/retino/tags` | `server/routes/retino/tags.js` |
| `/api/retino/automation` | `server/routes/retino/automation.js` |
| `/api/retino/costs` | `server/routes/retino/costs.js` |
| `/api/retino/email-settings` | `server/routes/retino/emailSettings.js` |
| `/api/retino/ratings` | `server/routes/retino/ratings.js` |
| `/api/retino/public/returns` | `server/routes/retino/returnsPublic.js` |

---

## Databaze (Supabase)

### Hlavni tabulky
| Tabulka | Ucel |
|---------|------|
| `delivery_notes` | Hlavni tabulka zasilek |
| `delivery_note_items` | Polozky zasilky |
| `tracking_sync_log` | Log synchronizaci trackingu |
| `shipment_tags` | Definice stitku |
| `delivery_note_tags` | Prirazeni stitku k zasilkam (M:N) |
| `shipment_notes` | Poznamky k zasilkam |
| `email_log` | Log odeslanych emailu |
| `email_templates` | Sablony emailu (sloupec `code`, ne `email_type`) |
| `email_design` | Globalni design emailu |
| `automation_rules` | Pravidla automatizace |
| `delivery_ratings` | Hodnoceni doruceni (1-5) |
| `shipping_costs` | Naklady na dopravu |
| `edd_config` | Konfigurace EDD per dopravce+zeme |
| `tt_page_views` | Zobrazeni Track & Trace stranky |

### Dulezite sloupce v delivery_notes
| Sloupec | Typ | Ucel |
|---------|-----|------|
| `unified_status` | text | Unifikovany stav zasilky |
| `sub_status` | text | Podstav z popisu dopravce |
| `pickup_at` | timestamptz | Cas doruceni na vydejni misto |
| `delivered_at` | timestamptz | Cas doruceni |
| `stored_until` | timestamptz | Ulozeno do (datum expirace) |
| `expected_delivery_date` | date | Ocekavane datum doruceni (EDD) |
| `timeliness` | text | on_time/late/early |
| `email_in_transit_sent` | boolean | Flag duplikat guard |
| `email_pickup_sent` | boolean | Flag duplikat guard |
| `email_delivered_sent` | boolean | Flag duplikat guard |
| `email_failed_delivery_sent` | boolean | Flag duplikat guard |
| `tracking_token` | text | Token pro verejnou T&T stranku |

---

## ENV promenné

```env
# SMTP (tracking emaily)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@mroauto.cz
SMTP_FROM_NAME=MROAUTO
SMTP_TEST_RECIPIENT=       # Kdyz vyplneno, vsechny emaily jdou sem (testovaci mod)

# App URL (pro tracking linky v emailech)
APP_URL=https://labelhunter.mroautoapp.cz

# Zasilkovna (prodlouzeni ulozni doby)
ZASILKOVNA_API_KEY=
ZASILKOVNA_API_URL=https://www.zasilkovna.cz/api/rest

# Ceska Posta (prodlouzeni ulozni doby)
CP_API_USER=
CP_API_PASSWORD=
CP_API_URL=https://b2c.cpost.cz/services/ParcelService/v1
```

---

## SQL migrace

Pred prvnim spustenim odpal v Supabase SQL Editor v tomto poradi:

1. `sql/retino_missing_tables.sql` — shipment_tags, delivery_note_tags, shipment_notes, email_log, automation_rules, delivery_ratings + delivery_notes sloupce
2. `sql/edd.sql` — edd_config, tt_page_views, delivery_notes EDD sloupce
3. `sql/shipping_costs.sql` — shipping_costs tabulka
4. `sql/email_templates.sql` — email_templates sloupce + email_design tabulka
