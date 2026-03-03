# LabelHunter — Postęp pracy

## Status: ✅ FAZY 1-3 GOTOWE — Wymaga: migracji SQL na Supabase + start serwerów

Ostatnia aktualizacja: 2026-03-03

---

## FAZA 1 — Fundament ✅ GOTOWE

### Co zostało zrobione:
- [x] Struktura katalogów projektu (server/ + client/)
- [x] server/package.json — zależności Express, Supabase, node-cron, nodemailer, axios
- [x] client/package.json — React, Vite, TailwindCSS, zustand, react-router-dom
- [x] .env.example — szablon zmiennych środowiskowych
- [x] render.yaml — konfiguracja deploymentu na Render.com
- [x] server/db/migrations/001_initial.sql — wszystkie tabele
- [x] npm install w server/ i client/ — zależności zainstalowane
- [x] client/dist — production build przechodzi bez błędów
- [ ] WYMAGA: Uruchomienie SQL z 001_initial.sql na Supabase SQL Editor

---

## FAZA 2 — Backend core ✅ GOTOWE

### Gotowe pliki:
- [x] server/server.js — Express + CORS + routes + cron startup
- [x] server/db/supabase.js — klient Supabase (service role key)
- [x] server/services/LabelPrinterService.js — OAuth2 z auto-refresh tokena, GET/POST/DELETE
- [x] server/services/NextisService.js — import delivery notes + trimowanie stringów
- [x] server/services/EmailService.js — HTML email po wysyłce + email o problemie
- [x] server/services/TrackingSyncService.js — sync statusów z LP API
- [x] server/middleware/errorHandler.js
- [x] server/routes/workers.js — CRUD + weryfikacja PIN
- [x] server/routes/packages.js — lista, wyszukiwanie po FV, skanowanie, generowanie etykiety
- [x] server/routes/nextis.js — ręczny import z TRANSPORT_MAP
- [x] server/routes/tracking.js — publiczne endpointy po tracking_token
- [x] server/routes/returns.js — generowanie zwrotów
- [x] server/routes/email.js — ponowne wysyłanie emaili
- [x] server/routes/labelprinter.js — proxy do LP API
- [x] server/cron/importDeliveryNotes.js — co 30 minut
- [x] server/cron/syncTrackingStatus.js — co 2 godziny

### Weryfikacja: serwer startuje bez błędów na porcie 3001

---

## FAZA 3 — Frontend ✅ GOTOWE

### Gotowe pliki:
- [x] client/vite.config.js — proxy /api → localhost:3001
- [x] client/tailwind.config.js + postcss.config.js
- [x] client/index.html
- [x] client/src/main.jsx + App.jsx + index.css
- [x] client/src/store/authStore.js — Zustand + persist
- [x] client/src/store/packageStore.js — Zustand packages state
- [x] client/src/services/api.js — Axios instance
- [x] client/src/hooks/useScanner.js — globalny listener kodu kreskowego
- [x] client/src/utils/barcode.js — klasyfikacja kodów (invoice/product/action)
- [x] client/src/components/Auth/AuthPage.jsx — wybór pracownika + PIN
- [x] client/src/components/Dashboard/Dashboard.jsx + PackageCard.jsx + StatsBar.jsx
- [x] client/src/components/PackageView/PackageView.jsx + ItemList.jsx
- [x] client/src/components/BarcodeAction/BarcodeAction.jsx — wielki kod kreskowy SVG
- [x] client/src/components/Scanner/ScannerInput.jsx
- [x] client/src/components/Workers/WorkersPanel.jsx
- [x] client/src/components/Search/SearchPanel.jsx
- [x] client/src/components/SentPackages/SentPackages.jsx
- [x] client/src/pages/TrackingPage/TrackingPage.jsx — mobile-first, MROAUTO branding
- [x] client/src/pages/ReturnPage/ReturnPage.jsx

### Weryfikacja: `npm run build` przechodzi bez błędów (309 KB JS, 16 KB CSS)

---

## FAZA 4 — Publiczna strona śledzenia + email ⏳ Planowane

---

## FAZA 5 — Sekcja wysłanych paczek ⏳ Planowane

---

## FAZA 6 — Deploy ⏳ Planowane

---

## Znane problemy / Uwagi techniczne

1. **Supabase migracje** — SQL należy uruchomić ręcznie w Supabase SQL Editor: https://supabase.com/dashboard
2. **APP_URL** — Po deploymencie na Render.com uzupełnić w .env
3. **SMTP_PASSWORD** — Hasło aplikacji Gmail: `xwtb crzs hijt sldg`
4. **Trimowanie danych Nextis** — Wszystkie stringi z Nextis API mają trailing spaces — trimować przy imporcie!
5. **LP Token** — Wygasa po 30 min — auto-refresh zaimplementowany w LabelPrinterService.js
6. **Etykiety PDF** — Zapisywane w server/labels/{shipmentId}.pdf (base64 decode z LP response)
7. **Osobní odběr** — Paczki z tym transportem NIE generują etykiet kurierskich

---

## Mapowanie przewoźników Nextis → Label Printer

| Nextis transportName | LP shipperCode | LP serviceCode |
|---------------------|----------------|----------------|
| 1. GLS Kurýrní Služba | GLS | AH |
| 2. Zásilkovna | ZASILKOVNA | ZASILKOVNA |
| 3. We\|Do Kurýrní Služba | WEDO | WEDO |
| 4. GLS Výdejní místo | GLS | SM |
| 6. PPL Kurýrní Služba | PPL | PPL |
| 7. Česká Pošta | CP | DR |
| 8. PPL Parcelbox | PPL | PPL |
| 9. DPD Kurýrní Služba | DPD | CL |
| UPS | UPS | UPS |
| Osobní odběr | null | null |
| Shipping to Europe | DPD | CL |

---

## Dane firmy (MROAUTO AUTODÍLY s.r.o.)

```
Adres wysyłkowy:
MROAUTO AUTODÍLY s.r.o.
Čs. armády 360, Pudlov
735 51 Bohumín
CZ

Email: info@mroauto.cz
Logistika: +420 774 917 859
IČO: 06630405
Web: www.mroauto.cz
```
