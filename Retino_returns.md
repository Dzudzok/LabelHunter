RETINO RETURNS — Kompletna Specyfikacja Systemu
1. CZYM JEST RETINO RETURNS
System do automatyzacji zwrotów, reklamacji i opieki posprzedażowej dla e-commerce. Używany przez 2000+ e-shopów, przetwarza ponad milion przypadków rocznie. Łączy portal klienta (formularz na stronie sklepu), zarządzanie przypadkami, refundacje, korekty faktur i logistykę zwrotną w jeden workflow, który może być w dużej mierze zautomatyzowany.

2. ARCHITEKTURA — TYPY PRZYPADKÓW, PROCESY, STANY
2.1 Hierarchia workflow (3 poziomy)
Typ przypadku (Case Type) → Procesní krok (Process Step) → Stav przypadku (Case State)
2.2 Typy przypadków
Dwa domyślne (nie można usunąć, można edytować): Vratka (zwrot) i Reklamace (reklamacja).
Można tworzyć własne, np.: Wymiana, Serwis gwarancyjny, Serwis pogwarancyjny, Niedostarczone, Uszkodzona przesyłka, Reklamacja dostawcy.
Każdy typ ma: nazwę (wielojęzyczną), kolor, własny zestaw procesnych kroków i stanów.
2.3 Procesní kroky (5 domyślnych)

Nový případ (Nowy przypadek)
Čekáme na přijetí (Czekamy na odbiór)
Řešíme (Rozwiązujemy)
Rozhodnutí (Decyzja)
Vyřešeno (Rozwiązano)

Każdy krok może mieć wiele stanów. Kroki wyświetlane w UI jak kolumny Kanban. Drag & drop do zmiany kolejności.
2.4 Stany przypadku (przykłady)
KrokPrzykładowe stanyNový případNový případČekáme na přijetíČekáme na přijetí zbožíŘešímeZboží dorazilo k námRozhodnutíUznáno - Doposíláme zboží, Uznáno - Refundace, Neuznáno - Vracíme zbožíVyřešenoZboží zasláno zákazníkovi, Refundováno, Zboží připraveno k vyzvednutí
Stany mają własne kolory. Zmiana stanu logowana w historii. Zmiana stanu na stan z innego typu → automatyczna zmiana typu.
2.5 Weryfikacja przypadku
Pola: verification_state — np. VERIFIED_AUTOMATICALLY

3. PORTAL KLIENTA (Zákaznický portál)
3.1 Co to jest
Interaktywny formularz embeddowany na stronie e-shopu (JavaScript widget) lub dostępny przez bezpośredni link. Klient sam tworzy przypadek (zwrot/reklamację) bez opuszczania strony sklepu.
3.2 Kroki formularza portalu (konfigurowalne)
Krok 1: Typy případů — klient wybiera typ (Vratka, Reklamace, własne). Konfigurowalne: nazwy, opisy, kolejność, przycisk akcji.
Krok 2: Vyhledání objednávky — klient podaje numer zamówienia + e-mail. Opcjonalnie: wyszukiwanie po numerze faktury, ręczne wypełnienie bez numeru zamówienia.
Krok 3: Položky objednávky — klient wybiera konkretne produkty do zwrotu/reklamacji, ilość, powód. Można dodać własne pola (custom fields) produktowe.
Krok 4: Zpětná doprava — wybór sposobu zwrotu:

Svoz kurýrem (odbiór kurierem na adresie klienta)
Doručení na pobočku (klient zanosi na punkt)
Vlastní způsob přepravy (niestandardowy)
Doprava placená zákazníkem (klient płaci kartą w portalu)

Krok 5: Možnosti vrácení peněz — metody refundacji:

Slevový kupón (voucher)
Bankovní účet (klient podaje numer konta, IBAN, etc.)

Krok 6: Informace o zákazníkovi — dane: imię, e-mail, adres odbioru, adres fakturowy. Każde pole: wymagane/opcjonalne. Można dodać własne pola.
Krok 7: Potvrzení — ekran potwierdzenia: wiadomość, instrukcje, link do śledzenia statusu, możliwość feedbacku, remarketing.
3.3 Personalizacja portalu

Kolory, font, zaokrąglenie rogów
Wszystkie teksty edytowalne per język
Integracja: JavaScript widget na stronie lub bezpośredni link


4. ZARZĄDZANIE PRZYPADKAMI (Správa případu)
4.1 Lista przypadków (Seznam případů)

Wyszukiwanie: po numerze zamówienia, imieniu, e-mailu, numerze przypadku
Filtrowanie: status, typ, tag, przypisany agent, etc.
Akcje masowe (zmiana statusu, etc.)
Export do CSV (przypadki lub produkty)
Tworzenie nowych przypadków przez agenta
Własne widoki (zapisane filtry) do szybkiego dostępu

4.2 Detail przypadku
Zawiera:

Nagłówek — przypisany agent, status, tagi, informacje o kliencie
Komunikacja z klientem — wiadomości e-mail
Interní poznámky — wewnętrzne notatki (niewidoczne dla klienta)
Doprava — zamówienie transportu zwrotnego
Aktivity — zadania/TODO
Refundace a dobropisy — refundacje i korekty
Produkty — lista produktów z zamówienia z detalami
Własne pola — dodatkowe informacje

4.3 Komunikacja z klientem (Zprávy)

Wiadomości e-mail wysyłane bezpośrednio z Retina
Formatowanie (bold, italic, nagłówki, listy, linki)
Załączniki (drag & drop, clipboard)
CC / BCC
Uložené odpovědi (zapisane szablony odpowiedzi)
AI Odpověď — AI generuje odpowiedź na podstawie kontekstu przypadku, historii komunikacji, produktów i kwot. Działa w języku przypadku. Umie liczyć kwoty (np. % refundacji)
Odpowiedzi klienta automatycznie trafiają do historii przypadku
Podpis użytkownika konfigurowalny w ustawieniach
Ctrl+Enter = wyślij

4.4 Interní poznámky

Widoczne tylko dla agentów
API: POST /internal-note

4.5 Tagi/Etykiety (Štítky)

Flexibilny system kategoryzacji
Kolorowe
Automatyczne dodawanie/usuwanie przez automatyzację
Filtrowanie po tagach
Przykład: "VIP reklamace" automatycznie dodany przy wysokiej wartości zamówienia

4.6 Własne pola (Vlastní pole)
Pola przypadku:
TypOpisČíslo bankovního účtuWalidowane pole kontaČeské číslo účtuWalidowane czeskie kontoIBANWalidowane IBANTextové poleJednowierszoweDatumWybór datyVíceřádkové textové poleWielowierszoweČíselné poleNumeryczneZaškrtávací poleCheckbox (Tak/Nie)Výběr z možnostíDropdown (jednokrotny)Vícenásobný výběrDropdown (wielokrotny)URL adresaWalidowane URLSouborUpload pliku
Pola produktowe:
Textové pole, Víceřádkové, Datum, Výběr z možností, Soubor, Odkaz
Ważne: typ pola nie może być zmieniony po utworzeniu. Pola mogą mieć różne nazwy w portalu i administracji.

5. TRANSPORT ZWROTNY (Zpětná doprava)
5.1 Cztery rodzaje transportu
A) Doprava placená zákazníkem

Klient płaci kartą w portalu
Generowany etykieta przewozowa lub zamawiany odbiór kurierem
Faktura od Retino
E-shop nie ponosi kosztów, ale widzi status przesyłki
Idealna dla zwrotów

B) Doprava placená e-shopem

Wykorzystuje umowy Retina z przewoźnikami (nie potrzeba własnej umowy)
Klient lub agent może zamówić
Można ustawić cenę widoczną dla klienta (ale klient realnie nie płaci — potrącane np. z refundacji)
Fakturowane e-shopowi na koniec okresu rozliczeniowego
Idealna dla reklamacji

C) Własna umowa z przewoźnikiem

Integracja API z własną umową
Fakturowanie przez przewoźnika wg warunków umowy
Opłata: 299 CZK/mies. za jedną umowę

D) Własní způsob dopravy (Custom)

Np. osobisty odbiór na sklepie
Tylko ewidencja — brak etykiet, śledzenia, automatycznego zamawiania
Statusy aktualizowane ręcznie

5.2 Typy podania (sposób nadania)
TypOpisDrop-off (na pobočku)Klient zanosi na punkt, drukuje etykietęPickup (svoz kurýrem)Kurier odbiera pod adresem, klient wybiera terminPaletová přepravaDuże/ciężkie, tylko z administracjiWłasný způsobCustom, bez automatyzacji
5.3 Obsługiwani przewoźnicy (Returns)
PrzewoźnikTypy transportuGłówne krajePacketa (Zásilkovna)Drop-offCZ, SK, PL, HU, EUDHLDrop-off, Pickup, Freight, InternationalWiększość EUPPLPickupCZGLSDrop-off, PickupCZ, SK, HU, SI, HR, PLDPDDrop-off, PickupCZ, SK, EUInPostDrop-off, PickupPLUPSPickupWiększość EUGeis——DHL FreightPaletowa—
5.4 Konfiguracja tras
Każdy transport ma możliwości dopravy (shipping options) z trasami:

Kraj nadania → Kraj odbioru
Cena dla klienta
Adres dostawy
Limit wagi
Własne teksty per język
E-mail z instrukcjami dla klienta

5.5 Zamawianie transportu

Ręcznie: z detalu przypadku (zakładka Doprava) lub masowo z listy
Automatycznie: przez automatyzację (trigger + akcja "Objednat vyžádanou dopravu")
Dane odbioru/nadania automatycznie wypełniane z danych przypadku

5.6 Lista transportów (Seznam doprav)

Przegląd wszystkich zamówionych transportów
Statusy w real-time
Oczekujące na zatwierdzenie
Problemy z przesyłkami


6. REFUNDACJE
6.1 Metody refundacji
A) Bankovní účet — najczęstsza. Agent wybiera konto, kwotę, konto odbiorcy (IBAN/CZ/PL format). Auto-prefill jeśli klient podał konto w portalu.
B) Voucher — slevový kupón w e-shopie. Wspierane: Shoptet, Shopify, WooCommerce. Opcjonalna data ważności. Automatyczne tworzenie kuponu w platformie.
C) QR kód — generuje QR do zeskanowania w aplikacji bankowej. Idealne dla szybkich jednorazowych refundacji.
D) Webhook — dane refundacji wysłane na endpoint. Dla własnych systemów płatności.
E) CSV (Custom) — export do zewnętrznych systemów.
6.2 Przetwarzanie refundacji

Agent tworzy "požadavek na refundaci" w detalu przypadku
Požadavek trafia do kolejki "Nezpracované refundace"
Masowe przetwarzanie: zaznacz → generuj plik (PAIN XML / ABO) lub wyślij do Fio banky
Import pliku do bankowości internetowej → autoryzacja
Po przetworzeniu → refundacja w "Zpracované refundační dávky"
Możliwość cofnięcia (revertování) przetworzonej partii

6.3 Konta refundacyjne

Konfiguracja w ustawieniach
System automatycznie dobiera konto wg waluty
Integracja z Fio bankou (bezpośrednie wysłanie)


7. DOBROPISY (KOREKTY FAKTUR)
7.1 Obsługiwane systemy

Shoptet — pełna integracja, auto-tworzenie w administracji Shoptetu
Dativery — przez Dativery API (integracja z POHODA)
Retino natywne — wewnętrzne korekty + webhook na endpoint

7.2 Tworzeniekomplet?18 steps18 stepsDobra, sprawdziłem jeszcze raz i znalazłem istotne brakujące szczegóły. Oto uzupełnienie do specyfikacji Retino Returns, które powinieneś dodać do dokumentu:

RETINO RETURNS — UZUPEŁNIENIE (brakujące sekcje)
A. REMARKETING (Doplněk z Marketplace)
Trzy narzędzia remarketingu:
1. Slevový kupón (Voucher)

Automatycznie generowany po założeniu przypadku w portalu
Klient klika → generuje się unikalny kupon w e-shopie → klient kopiuje kod
Konfiguracja: wysokość zniżki, minimalna wartość zamówienia, ważność (dni), różne kwoty per waluta
Wspierane platformy: Shoptet, Shopify, WooCommerce

2. Banner reklamowy

Upload obrazu + URL docelowy
System automatycznie śledzi kliknięcia (analiza skuteczności)
Konfiguracja: gdzie wyświetlać (portal, detail przypadku, e-maile)

3. Żádost o telefonát (Prośba o kontakt tel.)

Klient żąda oddzwonienia
W administracji tworzy się aktywność "Zavolat zákazníkovi" z terminem 2 dni
Numer tel. zapisywany do przypadku

Gdzie się wyświetla:

Ostatni krok portalu (po założeniu przypadku)
Klientský detail případu
E-maile
Kolejność: Kupón → Telefon → Banner
Wygląd dziedziczy schemat kolorów portalu
Różne narzędzia per typ przypadku


B. SMS ZPRÁVY (Doplněk z Marketplace)

Ręczne wysyłanie z detalu przypadku (zakładka SMS — widoczna tylko gdy klient ma telefon)
Automatyczne wysyłanie przez automatyzację (akcja "Odeslat šablonu zprávy jako SMS")
Max 160 znaków (wliczając link do detalu przypadku, dołączany automatycznie)
Diakrityka i znaki specjalne usuwane
Zmienne: [[code]], [[customer.name]], [[customer.email]], [[customer.phone]], [[order.code]]
Dostępność: CZ i SK
Cena: 2,40 CZK / 0,11 EUR za SMS (doliczane do faktury Retino)


C. WŁASNE UMOWY Z PRZEWOŹNIKAMI — szczegóły
Obsługiwani przewoźnicy dla własnych umów:
DPD (Drop-off, Pickup), PPL (Pickup), GLS (Drop-off, Pickup), Packeta/Zásilkovna (Drop-off), DHL (Drop-off, Pickup, Freight), InPost (Drop-off, Pickup), UPS (Pickup)
Setup:

Ustawienia > Doprava > Přidat novou smlouvu
Wybór przewoźnika → podanie API klucza/credentials
Konfiguracja tras: kraj nadania → kraj dostawy, adres, cena, limity wagi
Testowanie: testowa przesyłka, weryfikacja etykiet i śledzenia

Koszt: 299 CZK/mies. za każdą aktywną umowę

D. WEBHOOK SHIPPING.ORDERED — szczegóły
Event: shipping.ordered — wywoływany przy zamówieniu transportu.
Payload:
json{
  "event_type": "shipping.ordered",
  "created_at": "ISO datetime",
  "shipping": {
    "id": "uuid",
    "client_reference": "kod-przypadku",
    "option_name": "Zásilkovna - Na výdejní místo",
    "tracking_number": "Z3824826667",
    "tracking_url": "URL śledzenia",
    "customer_payment_details": [{
      "amount": "99.00",
      "currency": "CZK",
      "invoice_url": "URL faktury"
    }]
  }
}
Retry: 72h z exponential backoff (2min → 4min → 8min → ... max 1h). Po 72h endpoint dezaktywowany + e-mail do adminów.

E. REFUNDACJE — rozszerzone szczegóły
Konta refundacyjne (Refundační účty):

Nazwa, numer konta (CZ format), IBAN, przesunięcie terminu płatności (dni), waluta, źródło VS (kod ticketu/zamówienia/ostatnia korekta)
Osobne konto per waluta (system auto-dobiera)

Integracja z Fio bankou:

API token z Fio → wklejenie do Retina
Bezpośrednie wysyłanie poleceń przelewu do Fio
Nadal wymagana autoryzacja w bankowości internetowej

Formaty plików bankowych:
WalutaFormatZastosowanieCZKABOStandardowe przelewy CZEURPAIN XMLSEPAUSD, GBP, CHF, etc.Foreign XMLZagraniczne (tylko z Fio API)
Webhook refundacji — format:
json{
  "event_type": "retino_refund.created",
  "note": "Refundace za vrácené zboží",
  "amount": "1500.00",
  "currency": "CZK",
  "ticket_id": "uuid",
  "approver_id": "uuid",
  "valid_until": "2025-04-29",
  "recipient_name": "Jan Novák"
}
CSV refundace:

Konfigurowalne pola do exportu
Ustawienia > Refundace > Vlastní refundace
Ważność w dniach


F. ULOŽENÉ ODPOVĚDI (Szablony odpowiedzi) — szczegóły

Nazwa + Przedmiot (opcjonalny) + Treść + Soukromé (prywatne)
Wielojęzyczność (ikona języka przy polach)
Prywatne: widoczne tylko dla twórcy; Sdílené: dla wszystkich agentów
W edytorze wiadomości: ikona błyskawicy → lista szablonów
Filtrowanie wg języka przypadku (szablony bez tłumaczenia = nieaktywne)
Przedmiot szablonu auto-wypełnia przedmiot wiadomości


G. ORDERS API (Returns) — szczegóły
Stavy zamówień (dwa typy):
TypWartośćZnaczeniePrzetwarzanieNEWNowe zamówieniePrzetwarzaniePICKINGKompletacjaPrzetwarzaniePACKEDZapakowanePrzetwarzanieDISPATCHEDWysłanePrzetwarzanieON_HOLDWstrzymanePrzetwarzanieREADY_FOR_PICKUPGotowe do odbioruPrzetwarzaniePICKED_UPOdebranePłatnośćAWAITING_PAYMENTOczekiwanie na płatnośćPłatnośćPAIDZapłaconePłatnośćPARTIALLY_REFUNDEDCzęściowo zwróconePłatnośćREFUNDEDZwróconePłatnośćFAILEDPłatność nieudana
Typy pozycji zamówienia (item_type):

PRODUCT — produkt
SHIPPING — opłata za dostawę
BILLING — opłata za płatność (COD)
DISCOUNT — rabaty/kupony

Auto upsert:
code + store_id = unikalny klucz. Pierwsze wysłanie = CREATE (201), kolejne = UPDATE (200). Nie trzeba sprawdzać istnienia.
Historia statusów (bulk import):
json"statuses": [
  {"name": "PAID", "date": "2025-10-23T10:00:00Z"},
  {"name": "PICKING", "date": "2025-10-23T12:00:00Z"},
  {"name": "DISPATCHED", "date": "2025-10-23T15:00:00Z"}
]
Kiedy Orders API vs XML Feed:

Orders API: potrzeba natychmiastowych notyfikacji (transakční e-maily), real-time tracking, instant aktualizacje
XML Feed: prostsze, wystarczy dla Returns (klient nie zwraca w 6h), sync co 6h

