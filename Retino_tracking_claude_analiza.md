Przeczytałem całą dokumentację Retino Tracking (79 artykułów). Oto kompletny dokument, który możesz przekazać do Claude Code jako specyfikację projektu:

RETINO TRACKING — Kompletna Specyfikacja Systemu
1. CZYM JEST RETINO TRACKING
System do śledzenia przesyłek e-commerce, który łączy w jednym miejscu dane od wielu przewoźników, automatyzuje komunikację z klientami i dostarcza analityki logistycznej. Główny cel: zamienić logistykę z procesu dostarczania w przewagę konkurencyjną.
Kluczowe wartości:

Jednolity przegląd wszystkich przesyłek w jednym miejscu
Automatyczna komunikacja z klientami (e-maile transakcyjne + statusy przesyłek)
Zmniejszenie zapytań do supportu
Analityka kosztów, czasu dostawy, satysfakcji klientów


2. ARCHITEKTURA DANYCH — IMPORT ZAMÓWIEŃ
2.1 Trzy sposoby importu zamówień:
A) Plugin/wtyczka (Shoptet, Shopify, WooCommerce, PrestaShop, etc.)

Automatyczna synchronizacja po instalacji pluginu
Dla PrestaShop: zmiana statusu zamówienia musi towarzyszyć dodaniu numeru śledzenia

B) XML Feed

Struktura: <ORDERS> → <ORDER> z elementami
Wymagane elementy: ORDER_ID, CODE, DATE, CURRENCY/CODE, CUSTOMER (EMAIL, BILLING_ADDRESS, SHIPPING_ADDRESS), TOTAL_PRICE (WITH_VAT, WITHOUT_VAT), ORDER_ITEMS
ORDER_ITEMS ma typy: product, billing (np. COD/dobírka), shipping
PACKAGE_NUMBER — opcjonalny ale zalecany dla trackingu
Feed na publicznym HTTPS URL, Retino pobiera co ~6h
Zabezpieczenie: HTTP Basic Auth lub losowy URL
Kodowanie: UTF-8
Walidacja: XSD schema dostępna

C) Orders API (REST, JSON)

Nowoczesna alternatywa dla XML, synchronizacja w real-time
Workflow:

POST /api/v2/orders — tworzenie zamówienia (zwraca UUID)
POST /api/v2/files — upload faktury PDF
POST /api/v2/orders/{id}/documents — powiązanie faktury z zamówieniem
POST /api/v2/tracking-shipping — utworzenie śledzonej przesyłki (tracking_number, carrier_hint, order UUID, delivery_type)


Bulk import: POST /api/v2/orders/bulk (max 100 na batch)
Aktualizacja statusu: PATCH /api/v2/orders/{id}/status?status_value=PICKING|PACKED|DISPATCHED
Wymaga: API token (z ustawień) + Store ID


3. ŚLEDZENIE PRZESYŁEK — SYNCHRONIZACJA STATUSÓW
3.1 Interwały synchronizacji

Pierwsza synchronizacja: natychmiast po dodaniu przesyłki
Standardowo: co 60 minut ±20% (48-72 min) z losowym rozrzutem
Przy błędzie: ponowna próba następnego dnia
Przesyłka przestaje być synchronizowana po 120 dniach lub po osiągnięciu końcowego statusu
Specjalne interwały: DHL = co 24h, Austrian Post = co 4h

3.2 Statusy przesyłek (hierarchia status → sub-status)
Główne statusy:
StatusOpisPENDINGCzeka na przetworzenieINFORMATION_RECEIVEDPrzewoźnik otrzymał daneIN_TRANSITW drodzeOUT_FOR_DELIVERYKurier doręczaFAILED_ATTEMPTNieudana próba doręczeniaAVAILABLE_FOR_PICKUPDo odbioruDELIVEREDDoręczonoHANDED_TO_CARRIERPrzekazano innemu przewoźnikowiRETURNED_TO_SENDERZwrócono nadawcyEXPIREDWygasłoCANCELLEDAnulowanoEXCEPTIONWyjątek/problem
Sub-statusy (wybrane):

PENDING: NEW_SHIPMENT, CANNOT_TRACK, CARRIER_NOT_DETECTED, CREDENTIALS_REQUIRED
IN_TRANSIT: ACCEPTED_BY_CARRIER, DISTRIBUTION_CENTER, DEPOT, CUSTOMS_CLEARANCE, CUSTOMS_CLEARED
FAILED_ATTEMPT: RECIPIENT_NOT_HOME, CLOSED_BUSINESS
AVAILABLE_FOR_PICKUP: STANDARD_STORAGE, EXTENDED_STORAGE
DELIVERED: STANDARD_DELIVERY, PICKED_UP
EXCEPTION: RETURNING_TO_SENDER, DAMAGED, LOST, REJECTED_BY_RECIPIENT, CUSTOMS_DELAY, DELAYED_EXTERNAL_FACTORS, AWAITING_PAYMENT, INCORRECT_ADDRESS, NOT_PICKED_UP, REJECTED_BY_CARRIER

3.3 Timestamps przesyłki

ordered_at — data zamówienia
pickup_at — kiedy przewoźnik odebrał
delivered_at — kiedy dostarczono
picked_from_branch_at — kiedy klient odebrał z punktu
stored_until — data końca przechowywania
System liczy weekendowe dni między datami dla analiz


4. OBSŁUGIWANI PRZEWOŹNICY (24+ bezpośrednio, 25+ pośrednio)
Automatyczne napojenie (bez konfiguracji):
Austrian Post, Balíkobot, Česká pošta, DHL, Elta Courier, Gebrüder Weiss, Geis, GLS CZ/SK/HU, InPost Paczkomat, Poczta Polska, Pošta bez hranic, Slovak Parcel Service, Slovenská pošta, Toptrans, WE|DO
Wymagające API klucz/dane logowania:
ACS Courier, DPD (GeoAPI), DPD Meta, Foxpost, GLS HR/RO/SI (MyGLS), PPL (Client ID + Secret), PPL (MyPPL), QDL, Raben, Speedy, UPS, Zásilkovna/Packeta
Tylko detekcja przewoźnika:
Magyar Posta, Slovinská pošta, In-Store Pickup
Tylko pośrednio (przez innego przewoźnika):
Bartolini, Box Now, Cargus, Colissimo, Correos, Croatian Post, eCont, Express One, FAN Courier, GLS IT, Hermes, InPost Courier, Landmark Global, Meest, Mondial Relay, MRW, Omniva, Overseas Express, PostNL, Postnord, Sameday, Speedex, Taxydromiki, Trans-o-flex, Venipak

5. TRACK & TRACE — WIDGET DLA KLIENTÓW
5.1 Co to jest
Widget embeddowany na stronie e-shopu (np. /sledovani-zasilky), gdzie klienci wpisują email + numer zamówienia/tracking i widzą status przesyłki. Klient zostaje na Twojej domenie zamiast iść na stronę przewoźnika.
5.2 Co wyświetla

Aktualny status przesyłki
Historia ruchu z datami
Przewidywany czas dostawy (jeśli dostępny)
Mapa z lokalizacją (opcjonalnie)
Link do szczegółowego śledzenia u przewoźnika
Po dostarczeniu: możliwość oceny dostawy (1-5 gwiazdek)

5.3 Integracja
Trzy sposoby:

Kod do wklejenia na stronę (widget dopasowuje się do szerokości kontenera)
Bezpośredni link na hostowaną wersję (np. do e-maili)
Parametry URL do pre-fill: ?email=...&order-code=... lub ?email=...&tracking-number=... lub ?retino-tracked-shipping-id=uuid

5.4 Personalizacja

Kolory: primary, tło, tekst przycisków
Logo + banner (różne dla różnych języków)
Własny font
Zaokrąglenie rogów (none/mild/medium/strong)
Mapa (on/off)
Teksty dla każdego statusu i języka osobno
20+ obsługiwanych języków
Automatyczna detekcja języka wg ustawień przeglądarki

5.5 Odświeżanie danych
Co 60-72 minut (jak główny system)

6. SYSTEM E-MAILI
6.1 Dwa typy e-maili
Transakční e-maile (zdarzenia zamówienia):

Potwierdzenie zamówienia
Zamówienie wysłane
Etc. — reagują na zmianę statusu zamówienia

E-maile o zásilkách (zdarzenia dostawy):

Zásilka jest na drodze
Do odebrania
Doręczono
Etc. — reagują na zmianę statusu przesyłki

6.2 E-mailový Designer (kreator szablonów)
Sekcje szablonu:

Nagłówek — logo + banner opcjonalny
Treść główna — nagłówek + body z edytorem tekstu
Przycisk śledzenia — przekierowanie na Track & Trace, konfigurowalne kolory i tekst
Info box — wyróżnione ważne info (termin dostawy, instrukcje odbioru), konfigurowalny globalnie lub per e-mail
Sekcja produktowa — nazwy produktów, ilości, ceny
Dane dostawy — adres dostawy lub info o punkcie odbioru (godziny otwarcia etc.)
Stopka — kontakty, social media (FB, IG, Twitter, LinkedIn, YouTube), linki do dokumentów

Globalne ustawienia:

Nazwa szablonu (wewnętrzna)
Kolor tła
Zaokrąglenie elementów (brak/lekkie/średnie/mocne)
Załączniki (domyślne, np. regulamin)
Bannery z linkami (per język)

System konceptów:

Edycja = praca na kopii (koncepty)
Publikacja = wdrożenie
Automatyczne usuwanie niezapisanych konceptów po 30 dniach

Wersje językowe:
Priorytet: 1) Język ustawiony w zamówieniu → 2) Kraj dostawy → 3) Domyślny język e-shopu
AI Email Editor — tworzenie szablonów przy pomocy AI
Podgląd na żywo: desktop/tablet/mobile + testowe e-maile
6.3 Automatyczne e-maile — konfiguracja
Każdy automatyczny e-mail ma:

Szablon (z designera)
Przedmiot (z dynamic tags)
Nagłówek główny
Treść
Ustawienia sekcji (które wyświetlać)
Załączniki

Dynamiczne tagi:
TagOpis[[order.code]]Numer zamówienia[[shipping.tracking_number]]Numer śledzenia[[shipping.tracking_url]]Link śledzenia[[shipping.carrier]]Przewoźnik[[shipping.stored_until]]Data przechowywania[[shipping.status]]Status[[customer.name]]Imię klienta[[customer.email]]Email klienta[[customer.phone]]Telefon klienta[[company.name]]Nazwa firmy
Statystyki e-maili: ilość wysłanych, dostarczalność, open rate, click rate
6.4 Własna domena e-mailowa

Zamiast @retino.com wysyłka z tracking.twoja-firma.pl
Setup: subdomena → DNS records (CNAME, opcjonalnie MX + TXT dla SPF) → weryfikacja → zatwierdzenie przez zespół Retino (do 24h) → przypisanie szablonów
Lepszy deliverability, brand, wiarygodność


7. SYSTEM AUTOMATYZACJI
7.1 Trzy filary: Triggery → Warunki → Akcje
7.2 Triggery (Spouštěče):
TriggerOpisZmiana statusu przesyłkiPrzejście do konkretnego statusuZmiana grupy statusówZmiana głównej grupyN dni na oddzialeX dni po złożeniu na oddzialeN dni do końca przechowywaniaX dni przed wygaśnięciemPrzesyłka nieaktywna N dniX dni bez zmiany statusu
7.3 Warunki:
WarunekWartościStatus przesyłkiDoręczono, W drodze, Do odbioru...PrzewoźnikPPL, DPD, Česká pošta...Kraj dostawyCZ, SK, PL...COD (pobranie)Tak/NieEtykieta/TagDowolna istniejąca
7.4 Akcje:
AkcjaOpisWysłanie e-mailaPersonalizowany e-mail wg szablonuWebhookHTTP POST z danymi przesyłki na endpointDodanie etykietyDodaje tag do przesyłkiUsunięcie etykietyUsuwa tag z przesyłkiPrzedłużenie czasu przechowywaniaAuto-przedłużenie u Česká pošta / Zásilkovna
7.5 Timing:

Natychmiastowe lub opóźnione uruchomienie
Godziny pracy (domyślnie 8:00-18:00, konfigurowalne)
Akcje poza godzinami pracy odkładane do następnego dnia roboczego


8. PRZEDŁUŻANIE PRZECHOWYWANIA PRZESYŁEK
Obsługiwani przewoźnicy: Česká pošta, Zásilkovna/Packeta
Warunki:

Przesyłka w statusie AVAILABLE_FOR_PICKUP
Nie było wcześniej nieudanej próby przedłużenia
Česká pošta: wymagany e-mail klienta
Zásilkovna: zależy od typu punktu (kamenné = 7 dni bazowo, Z-Boxy = 2 dni bazowo)

Limity:

Česká pošta: jednorazowe przedłużenie o max. możliwy czas
Zásilkovna standardowe punkty: do 14 dni dodatkowych (łącznie 21)
Z-Boxy: +1 dzień

Sposoby: manualne (przycisk w detalu) lub automatyczne (przez automatyzację z triggerem "N dni do końca przechowywania")

9. ETYKIETY/TAGI

Dowolne tagi z ustawialnym kolorem (bgcolor, fgcolor)
UUID identyfikator
Automatyczne dodawanie/usuwanie przez automatyzację
Użycie: filtrowanie, kategoryzacja, analityka
Przykłady: "Neaktivní zásilka", "Zákazník kontaktován", "Blízko expirace", "Prodlouženo automaticky"


10. ANALITYKA
10.1 Dashboard Przegląd
Metryki: łączna liczba przesyłek, śledzone przesyłki, % nieśledzonych, wskaźnik dostarczenia
Wykresy: liczba przesyłek w czasie, wolumen wg przewoźnika, przesyłki wg statusu
Tabela przewoźników: liczba przesyłek, % w drodze, % doręczono, % niedoręczono, % na adres/oddział/box, średni czas dostawy, średni czas odbioru
Filtry: okres, przewoźnik, kraj, źródło zamówień, tagi, typ dostawy
10.2 Analiza kosztów
4 główne metryki: Całkowite przychody, Całkowite koszty, Całkowita marża, Marża %
Dodatkowe metryki: Analizowane przesyłki, Brakujące opłaty, Fakturowane bez przesyłki, Pokrycie przesyłek
Wykresy: trend kosztów w czasie, trend marż w czasie, koszty/marże wg przewoźnika, wg typu dostawy, wg kraju, wg kategorii wagowej
Import danych kosztowych: automatycznie z faktur e-mailowych (GLS, PPL, DPD) lub ręczny CSV import
10.3 Czas dostawy

Średni czas dostawy
P95 dni dostawy (95% przesyłek dostarczonych w X dni)
Porównanie: czas transportu vs. czas od zamówienia do dostawy
Średni czas na oddziale (czekanie na odbiór)
Weekendy nie liczone

10.4 Terminowość przesyłek

Expected Delivery Date (EDD) — z API przewoźnika lub z ustawionych czasów transportu
Statusy: doręczono przed terminem / doręczono na czas / doręczono z opóźnieniem / doręcza się na czas / będzie opóźniona
Automatyczne ustawienie czasów na bazie historycznych danych (40. i 60. percentyl, min 10 przesyłek)
Ręczne ustawienie: przewoźnik + kraj + D+X dni roboczych (opcja: liczyć weekendy)

10.5 Ocena dostawy

Gwiazdki 1-5 na stronie Track & Trace po dostarczeniu
Przy 1-4: klient może zaznaczyć problem (późna dostawa, uszkodzona przesyłka, jakość pakowania, etc.)
Metryki: średnia ocena, łączna liczba ocen, % zadowolonych (4-5★), najlepszy przewoźnik
Wykresy: ocena w czasie, dystrybucja, wg przewoźnika, wg kraju
Radar: obszary do poprawy (szybkość, uszkodzenia, pakowanie, aktualizacja śledzenia, punkt odbioru)
Tabela komentarzy klientów

10.6 Track & Trace Analytika

Analiza wykorzystania strony T&T przez klientów

10.7 Problémové zásilky

Sekcja z przesyłkami z problemami
Zakładka "Brzy se bude vracet" — przesyłki z kończącym się czasem przechowywania
Identyfikacja: wyjątki, niedostarczenia, opóźnienia


11. REST API (Tracking API)
11.1 Autentykacja

Token w nagłówku: Authorization: Token [token]
Każdy użytkownik ma własny token, różny per konto
Odnowienie tokenu w ustawieniach (stary natychmiast nieważny)

11.2 Base URL
https://app.retino.com/api/v2/tracking
11.3 Endpointy
EndpointMetodaOpis/shippingGETLista przesyłek (filtrowanie, sortowanie, paginacja)/shipping/search?search=...GETWyszukiwanie wg numeru zamówienia lub śledzenia/shipping/{id}GETSzczegóły jednej przesyłki/issuesGETLista problemowych przesyłek/tagsGETLista tagów
11.4 Model danych przesyłki (Shipping)
json{
  "id": "uuid",
  "carrier": "TOPTRANS",
  "carrier_estimated_delivery": null,
  "delivered_at": "ISO datetime",
  "delivery_type": "TO_ADDRESS | TO_BRANCH",
  "destination_country": "CZ",
  "issues": [{ "created_at", "is_resolved", "note", "shipping_id", "status", "sub_status", "type" }],
  "last_sync_at": "ISO datetime",
  "order_code": "string",
  "ordered_at": "ISO datetime",
  "original_tracking_number": "string",
  "picked_from_branch_at": null,
  "pickup_at": "ISO datetime",
  "source": null,
  "status": "DELIVERED",
  "stored_until": null,
  "sub_status": "DELIVERED",
  "tags": ["uuid-tagu"],
  "tracking": [
    {
      "carrier_description": "text od przewoźnika",
      "created_at": "ISO datetime",
      "location": "string",
      "status": "STATUS",
      "sub_status": "SUB_STATUS"
    }
  ],
  "tracking_number": "string",
  "tracking_url": "URL"
}
11.5 Paginacja

Query params: page, page_size
Response: count, current_page, total_pages, results


12. WEBHOOKI
12.1 Setup

URL na Twoim serwerze (np. /webhook-retino)
Metoda POST, format JSON
Ustawienie w Automatyzacji (trigger + akcja Webhook)
Zabezpieczenie: nagłówek X-Retino-Secret: <token>
Zalecenie: HTTPS

12.2 Typy zdarzeń

Przesyłka utworzona
Status przesyłki zmieniony
Status nie zmieniony przez N dni
Przesyłka czeka na oddziale N dni
Pozostało N dni przechowywania

12.3 Format danych
Identyczny z modelem Shipping z Tracking API (pełna instancja z historią statusów, issues, tags)
12.4 Dostarczanie

Twój serwer musi odpowiedzieć w 10 sekund kodem 2xx
Przy błędzie: retry przez 72h z exponential backoff
Jeśli przez 72h nie uda się dostarczyć: e-mail z powiadomieniem
Jeśli wszystkie webhooki na endpoint failują przez 72h: endpoint dezaktywowany


13. INTERFEJS UŻYTKOWNIKA
Główne sekcje:

Nástěnka (Dashboard) — szybki przegląd
Seznam zásilek (Lista przesyłek) — tabelaryczny przegląd z zakładkami (Na cestě, Připraveno k vyzvednutí, etc.), szczegóły z timeline statusów i wysłanej komunikacji
Problémové zásilky — filtrowane problematyczne przesyłki
Analytika — wszystkie dashboardy analityczne

Filtrowanie:

Predefiniowane zakładki statusów
Filtry: przewoźnik, kraj, źródło, tagi, typ dostawy, okres
Wyszukiwanie po numerze zamówienia/śledzenia


14. OBSŁUGA WIELU SKLEPÓW

Wiele źródeł zamówień w jednym koncie (Store IDs)
Różne szablony e-mailowe per sklep
Różne teksty i wersje językowe
Filtrowanie analityki per źródło


15. DODATKOWE FUNKCJE

Własne oddziały (pobočky) — konfiguracja własnych punktów odbioru
CSV import danych kosztowych — dla przewoźników bez automatycznego importu
Notatki i komentarze do przesyłek — zapis komunikacji z klientem
Referral program — zniżki za polecenie

