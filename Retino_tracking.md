Retino Tracking: Komplexní Průvodce

Autor: Jana Karolova
Aktualizováno před více než 2 měsíci
Retino Tracking je navrženo tak, aby transformovalo vaši logistiku z pouhého procesu doručování na silnou konkurenční výhodu. Cílem je poskytnout vám jednotný přehled o všech zásilkách na jednom místě a automatizovat komunikaci se zákazníky, čímž zásadně snížíte počet dotazů na podporu.

 

Krok 1: Nastartování a propojení se světem E-commerce
Než se Retino stane vaším logistickým mozkem, je třeba ho propojit s vaším e-shopem a dopravci.


A. Aktivace účtu

Pokud již používáte Retino Returns, stačí aktivovat modul Tracking z aplikace, přičemž musíte mít v účtu roli manažera. Pro nové uživatele je možné zvolit buď samostatný Tracking, nebo balíček Returns + Tracking hned při registraci.


B. Import objednávek a dat

Na to, aby jste viděli zásilky v systému, je potřebné dostat do systému objednávky. Máte dvě hlavní možnosti:

1. Přímá integrace (doporučeno): Pro populární platformy (jako Shoptet, Prestashop) je k dispozici nativní doplněk, který zajistí automatickou synchronizaci. Uživatelé PrestaShopu musí zajistit, aby při zadání sledovacího čísla došlo i ke změně stavu objednávky pro správnou synchronizaci. 

2. XML Feed: Pro vlastní řešení stačí vygenerovat XML feed podle specifikace a umístit ho na veřejnou HTTPS adresu. Retino si poté automaticky stahuje aktualizace dat přibližně každých 6 hodin.

Úspěšné propojení ověříte v sekci Nastavení > Objednávky.

3. API integrace: Nově můžete taky váš eshop propojit integrací přes API.


C. Připojení vašich dopravců

Retino Tracking podporuje více než 24 dopravců, a to buď automaticky, nebo s nutností zadání přihlašovacích údajů.

• Automatické napojení funguje pro ty dopravce (např. DHL, Toptrans, Česká pošta, Balíkobot), kde systém využívá veřejné sledování, veřejné API, nebo má vlastní systémový API klíč.

• Manuální napojení (API klíče/přihlašovací údaje): Pro některé dopravce (např. GLS, PPL, Zásilkovna/Packeta, DPD Meta) musíte zadat specifické údaje (jako API klíč, heslo, nebo zákaznické číslo), které si vyžádejte od svého obchodního zástupce.


Krok 2: Branding a Automatická komunikace (E-maily a Track & Trace)
Klíčem k profesionalitě je sjednotit komunikaci a umožnit zákazníkům sledovat zásilky přímo u vás.


A. Track & Trace Stránka na vašem webu

Track & Trace je widget, který integrujete přímo na libovolnou stránku vašeho e-shopu (např. /sledovani-zasilky). Tím zajistíte, že zákazníci zůstanou na vaší doméně, což posiluje vaši značku a snižuje odchozí prokliky na stránky dopravců. Integrace je jednoduchá: zkopírujete integrační kód z nastavení a vložíte jej do HTML kódu stránky. Widget se automaticky přizpůsobí šířce kontejneru. Můžete si přizpůsobit barvy, nahrát logo a banner, a dokonce upravit texty pro více než 20 podporovaných jazyků. Data na této stránce se aktualizují přibližně každých 60–72 minut. Chcete taky vědět, jak tuto vaši stránku zákazníci využívají? Analyzujte to díky Track & Trace Analytice.


B. Profesionální e-mailová komunikace

V Retinu můžete nastavit automatické e-maily, které jsou rozděleny na dva typy, jež se vzájemně doplňují:

1. Transakční e-maily: Reagují na události objednávky (např. "Potvrzení objednávky", "Objednávka byla odeslána").

2. E-maily o zásilkách: Reagují na události doručování (např. "Zásilka je na cestě", "K vyzdvihnutí").

Vzhled všech e-mailů definujete centrálně pomocí E-mailového designeru, kde nastavíte logo, barvy, patičku, a můžete přidávat sekce s produktovými údaji nebo doručovací adresou. Emailový designér obsahuje taky AI Email Editor, který vám umožní vytvářet profesionální e-mailové šablony pomocí umělé inteligence. Nově můžete všechny emaily posílat z vlastní e-mailové domény, co zvyšuje nejen důvěryhodnost a reputaci značky, ale taky doručitelnost emailů. 

Pro nastavení obsahu zpráv a podmínek odesílání slouží sekce Automatické odesílání e-mailů. Zde využijete dynamické tagy (např. [[order.code]], [[shipping.tracking_number]]) pro personalizaci.

Klíčové upozornění: Pokud se rozhodnete využívat transakční e-maily v Retinu, je nezbytné vypnout duplicitní e-maily ve vašem e-shopovém řešení (např. v Shoptetu), abyste zákazníkům nezasílali dvě stejné zprávy. Retino e-maily nabízejí lepší personalizaci, jednotný design a detailnější statistiky doručení.

 


Krok 3: Aktivní správa zásilek a řešení problémů
V rozhraní Retino Tracking najdete čtyři hlavní sekce: Nástěnku, Seznam zásilek, Problémové zásilky a Analytiku.


A. Identifikace problémů

Sekce Problémové zásilky je klíčová pro proaktivní péči o zákazníky, protože vám pomáhá včas identifikovat komplikace a předcházet nespokojenosti. Záložka "Brzy se bude vracet" zobrazuje zásilky, kterým se blíží konec úložní doby.

Proaktivní kroky:

• Prodloužení úložní doby: U podporovaných dopravců, jako je Česká pošta nebo Zásilkovna/Packeta, můžete úložní dobu manuálně prodloužit přímo z detailu zásilky, nebo nastavit automatické prodloužení pomocí pravidel v Automatizaci.

• Záznam komunikace: Pro evidenci a sledování kroků, které jste podnikli (např. telefonát zákazníkovi), můžete k zásilce přidat poznámky a štítky (např. "Zákazník kontaktován").

• Automatické štítky: Systém vám umožňuje automaticky označovat zásilky štítky na základě událostí. Například pokud zásilka nemá 5 dní žádnou aktualizaci stavu, můžete jí automaticky přidat štítek "Neaktivní zásilka", což usnadní filtrování a řešení.


B. Přehled a filtrace zásilek

V sekci Doprava (Seznam zásilek) máte kompletní tabulkový přehled. Můžete využít přednastavené záložky, jako jsou "Na cestě" nebo "Připraveno k vyzvednutí", které vám pomohou sledovat aktivní doručování a včas vyzývat zákazníky k vyzvednutí. Detail každé zásilky obsahuje kompletní časovou osu s historií stavů a odeslané komunikace.


Krok 4: Analytika pro strategické rozhodování
Analytické nástroje vám poskytnou hluboká data nezbytná pro optimalizaci nákladů, rychlosti a zákaznické spokojenosti.


A. Analýza nákladů: Ziskovost pod kontrolou

Tato sekce je klíčová pro finanční řízení logistiky. Poskytuje komplexní přehled o nákladech na dopravu a dosahovaných maržích, což vám umožní optimalizovat cenovou strategii. Sledujte čtyři hlavní metriky: Celkové příjmy (co platí zákazník), Celkové náklady (co účtuje dopravce), Celkovou marži a Marži v %.

• Kontrola faktur: Klíčovým ukazatelem je "Fakturované bez zásilky". Tato metrika ukazuje počet položek na fakturách od dopravců, které se nepodařilo spárovat s žádnou existující zásilkou ve vašem systému. Kliknutím na tuto hodnotu získáte seznam položek, což je ideální nástroj pro odhalení nesrovnalostí v účtování dopravců nebo chybějících zásilek.

• Import dat: Nákladová data můžete získat automatickým zpracováním e-mailových faktur (pro podporované dopravce jako GLS, PPL, DPD) nebo manuálním CSV importem pro ostatní dopravce.

• Optimalizace: Díky analýze můžete porovnávat nákladovou efektivitu jednotlivých dopravců, analyzovat marže podle cílové země nebo hmotnostní kategorie a zvážit přesun většího objemu zásilek k těm nejvýhodnějším.


B. Hodnocení dopravy: Měření spokojenosti zákazníků

Zde získáte přímou zpětnou vazbu od zákazníků. Po doručení se na Track & Trace stránce zobrazí možnost ohodnotit doručení hvězdičkami (1–5). Při nízkém hodnocení (1–4 hvězdičky) mohou zákazníci označit konkrétní problém (např. Pozdní doručení, Poškozená zásilka).

• Metriky: Sledujte Průměrné hodnocení, Celkový počet hodnocení a procento Spokojených zákazníků (4 nebo 5 hvězdiček).

• Identifikace slabých míst: Radarový graf "Oblasti pro zlepšení" vám ukáže nejčastější stížnosti (např. rychlost doručení, kvalita balení). Tato data jsou neocenitelná pro strategické rozhodování, vyjednávání s dopravci a zlepšování kvality služeb.


C. Čas dodání: Rychlost doručení

Tato sekce se zaměřuje na rychlost celého procesu, přičemž do výpočtu se nezapočítávají víkendy. Klíčové metriky zahrnují:

• Průměrná doba doručení: Celkový čas od vytvoření objednávky po doručení.

• P95 dnů doručení: Říká vám, do kolika dní je doručeno 95 % zásilek, což je důležité pro nastavení realistických očekávání zákazníků.

• Porovnání: Analýza porovnává Průměrnou dobu přepravy (čas strávený u dopravce) s Průměrnou dobou od objednávky po doručení (celý proces, včetně zpracování objednávky ve vašem skladu). Tímto způsobem můžete identifikovat, zda je úzké hrdlo u dopravce, nebo ve vašich interních procesech.

• Distribuce: Sekce také sleduje Průměrnou dobu na pobočce, což je doba, po kterou zásilka čeká na vyzvednutí zákazníkem po doručení do výdejního místa.

 

D. Včasnost zásilek

Nyní již v Retinu můžete taky sledovat, jestli jsou vaše zásilky doručovány včas. Tato funkce automaticky vypočítává očekávané datum doručení a přiřazuje každé zásilce stav včasnosti. Více najdete zde. 


​

