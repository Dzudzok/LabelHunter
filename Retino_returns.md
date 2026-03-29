Retino Returns: Komplexní průvodce
Tato příručka vás provede procesem základního nastavení služby Returns.

M
Autor: Marek z Retino
Aktualizováno před více než měsícem
Retino Returns je nejpoužívanější český nástroj pro automatizaci vratek, reklamací a ponákupní péče.  Používá jej více než 2 000 e-shopů a zpracovává přes milion případů ročně.

Služba spojuje portál (formulář) na vašem webu, správu případů, refundace, dobropisy i zpětnou logistiku do jednoho workflow, které může být z velké části automatizované.

 

Tato příručka vás v několika krocích provede procesem základního nastavení služby Returns. Všechny odkazy vedou přímo na příslušné články dokumentace, ve kterých najdete podrobné informace ke každému kroku nebo tématu.

 

 

Krok 1: Nastavení účtu a uživatelů
Nastavení účtu
Začněte se základním nastavením Retino účtu pro váš obchod. Zde si kromě jiného nastavíte zejména:

název vašeho obchodu a jeho logo;

Jazyky, země a měny dle působnosti vašeho e-shopu;

číslování případů.

 

Nastavení uživatele a týmu
V sekci tým přidejte vaše kolegy nebo externí partnery a udělte jim roli agenta nebo správce. Přidání uživatelů je bezplatné a jejich počet není omezen.

 

V uživatelských nastaveních si pak můžete mimo jiné nastavit váš osobní podpis u zpráv odeslaných přes Retino nebo nastavit různá oznámení a upozornění specifická pro daného uživatele.

 

 

Krok 2: Propojení objednávek
Objednávky
Dalším krokem při implementaci Retino Returns je integrace vašich objednávek. Ta zajišťuje, že zákazníci i agenti mohou vyhledávat objednávky a zakládat případy bez nutnosti ručního zadávání dat nebo jejich manuálního importu.

 

Retino podporuje několik způsobů integrace:

plugin, který aktivujete v administraci vaši e-shop platformy (Shoptet, Prestashop, …);

XML feed pokud si používáte vlastní řešení e-shopu;

API integrace buďto přímo přes naše API nebo za využití námi přednastavených API integrací (např. pro Shopify, Shopware, Byznysweb, …)

Zde naleznete seznam podporovaných platforem a integrací spolu s podrobným návodem na integraci. Pokud v seznamu vaše platforma není, lze Retino integrovat pomocí XML feedu (případně i XML produktového feedu) nebo přes API.

V jednom účtu můžete mít neomezený počet zdrojů objednávek a jejich kombinací.

 

Po propojení se začnou vaše objednávky automaticky synchronizovat z vašeho systému do Retino účtu a zákazníci budou moci vyhledat jejich objednávky spolu s jejich dalšími podrobnostmi.

 

 

Krok 3: Správa případu
Typy případů a jejich procesy a stavy
V tomto kroku si nastavíte vlastní workflow (tzn. jak budete s případy pracovat). Retino definuje pracovní procesy (workflow) pomocí tří komponent, které jsou hierarchicky řazené v tomto pořadí:

Typ případu - na tomto místě si přizpůsobíte, které případy budete vyřizovat - vrácení zboží, reklamace, výměna, servis a pod. Existují dva výchozí typy případů - vratka a reklamace a nelze je odstranit.
​

Procesní krok je hlavní fáze zpracování - existuje těchto 5 kroků: Nový případ → Čekáme na přijetí → Řešíme → Rozhodnutí → Vyřešeno.

 

Stav případu je konkrétní stav v rámci procesního kroku, např. Zboží je na cestě k nám nebo Uznáno - Refundace.

Každý typ případu může mít vlastní sadu kroků a ty rovněž mohou mít vlastní sadu stavů.

V praxi to znamená, že si workflow přizpůsobíte přesně tomu, jak váš tým interně funguje. Pro příklad reklamace typicky prochází jiným procesem než vratka (např. navíc zahrnuje krok posouzení závady), a výměna zboží má zase vlastní logiku. Díky tomu agent v detailu případu vždy vidí jen relevantní stavy pro danou fázi. Zároveň můžete na jednotlivé stavy a kroky navázat automatizace (např. při přechodu případu do vybraného stavu automaticky odeslat e-mail zákazníkovi) a filtrovat případy v seznamu podle stavu, což usnadňuje denní prioritizaci práce a rozdělení úkolů.

 

Seznam případů
Seznam případů je hlavní přehled všech případů. Umožňuje:

vyhledávání případu podle čísla objednávky, jména nebo e-mailu zákazníka, čísla případu, …

filtrování podle stavu případu, typu, štítku, přiřazeného agenta, …

hromadné akce

export případů nebo produktů do CSV

založení nového případu agentem

Pokud potřebujete, můžete si nastavit vlastní pohledy, které často používáte a mít je uložené pro rychlý přístup např. k nevyřízeným případům.

 

Detail případu
V detailu případu agent řeší konkrétní požadavek zákazníka. Naleznete zde zejména:

hlavičku případu obsahující všechny podstatné informace k případu jako je přiřazený agent, stav případu, štítky atd.

komunikaci se zákazníkem

interní poznámky

objednání dopravy

aktivity

refundace a dobropisy

přehled produktů zákaznické objednávky a její další detaily

Je také možnost vytvořit si vlastní pole, které k práci s případy potřebujete.

 

Štítky případu
Velkým pomocníkem udržujícím přehled a operace s jednotlivými případy jsou štítky.

Jsou flexibilní nástroj pro kategorizaci případů nad rámec standardních stavů. Umožňují vizuálně odlišit různé typy případů, rychle je filtrovat a na jejich základě vytvářet vlastní automatizace - přidávat nebo odebírat je na základě událostí a podmínek, nebo na jejich přítomnost navázat další akce.

Například při založení případu s vysokou hodnotou objednávky automaticky přidat štítek „VIP reklamace" a přiřadit specializovaného agenta.

 

Krok 4: Nastavení portálu Retino a jeho integrace na váš web
Zákaznický portál
Zákaznický portál je místo na vašem webu, kde si zákazník založí nový případ.

U jednotlivých typu případů si na začátku stránky můžete nastavit vzhled případu a také maximální stáří objednávek, pro které lze typ případu založit.

 

V nastavení portálu konfigurujete celý proces, kterým zákazník prochází při zakládání případu. Nastavení je rozděleno do sekcí odpovídajících jednotlivým krokům formuláře:

Typy případů - které typy se zákazníkovi nabídnou (vratka, reklamace, vlastní). Můžete upravovat názvy, popisy i pořadí.

Vyhledání objednávky - zákazník zadá číslo objednávky a e-mail. Volitelně lze povolit i vyhledání přes číslo faktury nebo ruční vyplnění formuláře bez znalosti čísla objednávky.

Položky objednávky - zákazník vybere konkrétní produkty, zvolí důvod vrácení a množství. Sem lze přidat vlastní pole pro více detailů nebo informací. U polí lze vybrat, zda má byt jejich vyplnění povinné nebo ne.

Zpětná doprava - nastavení způsobů vrácení zboží: svoz kurýrem, podání na  pobočku, vlastní způsob přepravy nebo doprava placená zákazníkem (platba kartou přímo v portálu).

Možnosti vrácení peněz  - slevový kupón, vrácení na bankovní účet, ...

Informace o zákazníkovi - jaké údaje požadujete (jméno, e-mail, adresa svozu, fakturační adresa). U každého pole můžete nastavit, zda je povinné a také lze přidat vlastní pole.

Potvrzení založení případu  závěrečná obrazovka s potvrzením, instrukcemi pro další kroky, odkazem na sledování stavu a volitelně žádostí o zpětnou vazbu. Zde lze také nastavit remarketing.

Všechny texty v portálu lze upravit ve všech vašich jazycích a také je možné změnit jeho vzhled (barvy, font, zaoblení rohů) tak, aby korespondoval se vzhledem vaší stránky.

 

Integrace portálu
Zákaznický portál se na vaši stránku integruje jako vložený prvek pomocí JavaScript widget kódu. Zákazník tak nemusí u založení případu opouštět váš web.

Alternativně je možno používat přímý odkaz, který zákazníka přesměruje k portálu.


Pokud používáte platformu Shoptet, zde naleznete podrobný návod k integraci portálu.

 

 

Krok 5: Nastavení zpětné dopravy
V Retino Returns existují tyto 4 druhy zpětných doprav:

Doprava placená zákazníkem u které zákazník zaplatí za dopravu kartou během zakládání případu v zákaznickém portálu. Je mu posléze poslán přepravní štítek nebo objednán svoz kurýrem a vystavena faktura od Retino. Vy jako e-shop dopravu nehradíte, ale máte možnost sledovat pohyby zásilky. Je vhodná pro typ případu vratka.
​

Doprava placená e-shopem u které využíváte smluv, které má sjednané Retino s dopravci, není tedy nutné mít vlastní smlouvu s dopravcem. Může si ji objednat zákazník během založení případu, nebo ji lze objednat také v detailu již založeného případu. Je vhodná pro reklamace nebo záruční servis.

U této možnosti lze nastavit cenu dopravného pro zákazníka - v tomto případě ale zákazník za dopravu reálně nic neplatí a poplatek mu zaúčtujete např. během refundace.

 

Dopravu hrazenou a doručovanou přes vaše vlastní smlouvy s dopravci. Pokud již máte vlastní smlouvu s některým z podporovaných dopravců, můžete si ji integrovat přes API s vašim Retino účtem a tato doprava je vám posléze účtována dopravcem tak, jak jste se smluvně domluvili. I u toho typu dopravy si můžete nastavit cenu, kterou vidí zákazník u založení případu. Paušální měsíční poplatek za jednu vlastní smlouvu s dopravcem je 299,- Kč.

 

Vlastní způsob dopravy pokud  chcete zákazníkům nabídnout vlastní přepravu , např. osobní doručení na pobočku, firemní svoz, nebo doprava vyžadující speciální podmínky. Jde ale čistě o evidenční nástroj - negenerují se přepravní štítky, zásilka se nesleduje a doprava se neobjednává automaticky – stavy je nutné aktualizovat ručně.

 

Nastavení možnosti dopravy a trasy
U každé dopravy si lze v jejím detailu přidáte různé možností dopravy. To se hodí, když např. potřebujete konkrétní dopravu nabízet zároveň pro vratky i reklamace. Pro každou možnost dopravy lze upravit e-mail s instrukcemi pro zákazníky, který se odesílá po objednání dopravy, a také lze vytvořit vlastní textaci, kterou vidí zákazníci v portálu - sem můžete psát více podrobností k dané možnosti dopravy.


Pro každou možnost dopravy si nakonec nastavte její konkrétní trasy (ze které země do které země), jejich cenu pro zákazníka, doručovací adresu a případně i omezení váhy. Pro každou možnost dopravy a trasy lze nastavit rozdílnou cenu pro zákazníka a jinou textaci, kterou vidí zákazníci v portálu.
​
Nakonec v nastavení portálu přidejte možnosti dopravy k jednotlivým typům případů. Dopravce a možnosti dopravy lze v rámci jednoho případu libovolně kombinovat.

 

Objednání dopravy a seznam doprav
Objednat dopravu lze ručně hromadně nebo také v detailu případu v záložce Doprava. Údaje o odesílateli, příjemci a balíku se předvyplní automaticky z dat případu.


Doprava se na základě toho, jak je zásilka podána k přepravě, rozděluje na:

 

Podání na podacím místě (pobočce) přepravce​
​

vyzvednutí kurýrem na adrese odesílatele (svoz)​
​

Paletová přeprava pro nadrozměrné nebo těžké zásilky
​

specifikován e-shopem u vlastní možnost přepravy

 

V Seznamu doprav najdete přehled všech objednaných doprav včetně žádostí čekajících na schválení a stavů zásilek v reálném čase. Zde můžete monitorovat i případné problémy zásilek během zpětné přepravy.

 

Pokud nechcete, aby musel zákazník čekat na ruční schválení jeho dopravy agentem, lze si nastavit její automatické objednání.
​

Obecně doporučujeme mít aktivní jak dopravu placenou zákazníkem, tak i dopravu placenou e-shopem. Jak již bylo zmíněno výše, různé druhy a možnosti doprav lze kombinovat u jednotlivých typů případů tak, jak to nejlépe vyhovuje vašim potřebám. Doporučujeme také vytvořit si automatizace, které budou např. objednávat dopravu automaticky po změně stavu případu, měnit stav případu po změně stavu zpětné zásilky, přidávat štítky a pod.

 

 

Krok 6: Zpracování případu
Aktivity
Aktivity slouží k plánování a organizaci zpracování vaši případů napříč týmem a pomáhá vám plánovat práci, sledovat lhůty a udržovat přehled o případech.

Skládají se z jednotlivých úkolů, které si vytvoříte v detailu případu a upravíte na základě různých parametrů jako třeba přiřazený agent, termín splnění a pod.

Nejvíc je oceníte pokud necháte aktivity vytvářet automatizace.

 

Refundace
Refundace najdete jako samostatnou sekci v detailu případu. Existuje několik možností, jak refundovat vaše zákazníky:

bankovním převodem - zde je potřeba mít nastaven refundační účet. Po zpracování požadavku na refundaci je vygenerován soubor ABO nebo PAIN XML, který nahrajete do vašeho internetového bankovnictví.

poukázkou (voucherem) - podporované platformy jsou Shoptet, Shopify a WooCommerce

QR kódem

webhookem v případě, že máte vlastní systém

exportem do CSV pro externí systémy

Nezapomeňte, že po odeslání požadavku k refundaci ještě nedojde, je potřeba jej spolu s ostatními požadavky zpracovat.

 

Dobropisy 
V záložce Dobropisy v detailu případu naleznete možnost jejich vytvoření aniž byste museli opouštět aplikaci Retino Returns.

Vytváření dobropisů lze propojit s platformami Shoptet a Dativery. Pokud používáte vlastní integraci, je možnost vytvořit si nativní Retino dobropis a ten pak posílat do externího systému přes webhook.

 

 

Krok 7: Automatizace
Nyní, když už máte nastaveno vše pro vyřizování vašich případů, přichází na řadu neprůběrné množství konfigurací automatizací, které vám ulehčí spoustu práce.

Automatizace vám umožní výrazně snížit manuální práci při správě reklamací a vratek. Fungují na jednoduchém principu: nastavíte událost, která automatizaci spustí, volitelné podmínky, za kterých se má spustit, a akci, která se má provést. U každé automatizace lze nastavit čas, za který se automatizace spustí po splnění její podmínek. 
​

Co může automatizaci spustit
Automatizaci lze navázat na řadu událostí – například když zákazník nebo agent založí případ, když se změní stav případu nebo stav zásilky, když zákazník pošle novou zprávu, když případ dostane štítek, nebo když vyprší termín aktivity.

 

Co automatizace dokáže udělat
Automatizace může odeslat zákazníkovi e-mail podle šablony, přiřadit případ agentovi, přidat nebo odebrat štítek, objednat dopravu, vygenerovat dokument, nastavit termín, uzavřít nebo znovu otevřít případ či vyplnit vlastní pole.
​

Podmínky automatizace a jejich kombinování
Podmínky lze volně kombinovat – například omezit automatizaci jen na určitý typ případu (reklamace, vrátka), zemi zákazníka, stav nebo dopravy nebo stáří objednávky. Podmínky lze řetězit logikou „všechny musí platit" (AND) nebo „alespoň jedna musí platit" (OR).

 

Přednastavené automatizace
V Retino naleznete několik automatizací připravených k okamžitému použití – například automatické přidání termínu podle typu případu nebo odeslání žádosti o hodnocení po uzavření případu. Ty lze upravit nebo použít jako inspiraci.
​

Zde naleznete několik situací, kde vám automatizace výrazně pomohou usnadnit práci.

 

 

Krok 8: Testování a spuštění
Než Retino Returns zpřístupníte zákazníkům, doporučujeme celý proces důkladně otestovat. Cílem je ověřit technickou funkčnost, ujistit se, že workflow odpovídá vašim interním procesům a že zákaznická zkušenost je plynulá.


Začněte simulací reálného scénáře. Vytvořte testovací případ přes zákaznický portál a ověřte, že se správně propíše do administrace, včetně objednávky a produktů. Následně projděte proces z pohledu agenta — měňte stavy, otestujte komunikaci a zkontrolujte, že se automatizace i e-mailové notifikace spouštějí podle očekávání.

 

Pokud působíte ve více zemích, vyzkoušejte také jazykové verze portálu a šablon.


Díky důkladnému testování zajistíte hladké spuštění a profesionální zákaznickou zkušenost od prvního dne.

 

 

Krok 9: API, webhooky a další rozšíření
Retino Returns lze plně propojit s vašimi dalšími systémy díky API a webhookům. To se hodí zejména tehdy, kdy potřebujete data z Retina automaticky přenášet do vlastního systému (ERP, účetnictví, sklad, BI) nebo naopak z vašeho systému ovládat případy v Retinu.

 

Tickets API
Tickets API je REST API komunikující přes JSON. Autentifikace probíhá pomocí tokenu, který naleznete v nastavení API. Pomocí Tickets API můžete programově přistupovat k datům o případech, produktech, dopravě i přidružených objednávkách — například automaticky stahovat případy do vašeho ERP, synchronizovat stavy s interním systémem nebo hromadně exportovat data pro analytiku.

 

Orders API
Pokud vaše e-shop platforma není mezi podporovanými integracemi a nechcete použít XML feed, můžete objednávky do Retina synchronizovat přímo přes Orders API.

 

Webhooky
Webhooky vám umožňují dostávat upozornění z Retina v reálném čase. Místo opakovaného dotazování API vám Retino samo pošle HTTP POST požadavek ve formátu JSON na vámi zadanou URL adresu, kdykoli dojde k vybrané události (založení případu, změna stavu, objednání dopravy aj.).

V praxi webhooky využijete například k automatické aktualizaci stavu reklamace ve vašem interním systému, ke spuštění procesu refundace v účetním softwaru při uzavření případu nebo k zasílání notifikací do Slacku při založení případu s vysokou hodnotou objednávky.

Každý webhook je zabezpečen hlavičkou X-Retino-Secret. Kromě webhooků pro případy existují také samostatné webhooky dobropisů a webhooky o objednání dopravy.

 

Další integrace a rozšíření
Retino Returns lze dále rozšířit o řadu aplikací a služeb:

Integrace se SupportBoxem — detaily případů přímo v rozhraní SupportBoxu.

Integrace s MessageOk — stav vrácení nebo reklamace v chatovém widgetu na vašem webu.

Dobropisy přes Dativery — propojení s účetním systémem POHODA.

Integrace se Skladonem — automatický přenos dat o vracených produktech do fulfillment systému.

Dodavatelské reklamace — zakládání a sledování reklamací u vašich dodavatelů.

Remarketing a SMS zprávy — rozšíření komunikace se zákazníky.

Kompletní seznam všech integrací a rozšíření naleznete na stránce Integrace a v sekci Marketplace v dokumentaci.

 

 

Závěr
Retino Returns je navržen tak, aby se přizpůsobil vašim procesům - ne naopak. Díky vlastním typům případů, stavům, automatizacím a rozšiřitelnosti přes API a webhooky si systém nastavíte přesně podle toho, jak váš tým interně funguje a jak chcete komunikovat se zákazníky.

 

Ať už provozujete malý e-shop s desítkami vratek měsíčně, nebo velký obchod zpracovávající tisíce případů ve více zemích a jazycích, Returns vám pomůže celý proces zautomatizovat, zpřehlednit a zrychlit — od založení případu zákazníkem, přes zpětnou dopravu a komunikaci, až po refundaci a uzavření.

 

Pokud vám cokoliv není jasné, potřebujete poradit s nastavením nebo si nevíte rady s konkrétním krokem, neváhejte se obrátit na náš tým podpory na support@retino.com nebo přes chat přímo v aplikaci. Rádi vám pomůžeme.