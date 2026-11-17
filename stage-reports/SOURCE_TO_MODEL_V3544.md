# SOURCE → MODEL v3.54.4 — wspólny opis domu

Kampania: v3.54.4, 2026-11-17. Gałąź `claude/new-session-3kzcgh`. Baza: `0d4a057ff1ffe5dec07dd04e543ed39a308c4ee1`
(dostawa v3.54.3; kandydat zamrożony v3.54.3: `aabc044`). Dokument jest jednym raportem końcowym; punkty kontrolne
i pierwszy wynik próby potwierdzającej są w nim oznaczone jawnie.

## 1. Werdykt i co OWNER może rzeczywiście uruchomić

**Werdykt.** Poprawna specyfikacja całego domu daje teraz poprawną geometrię zewnętrza, a API potrafi taką
specyfikację w dużej części odczytać ze źródeł. W jednorazowej, zamrożonej próbie na 8 nowych rodzinach (5 wydawców,
6 domów spoza ARCHON) **całe zewnętrze zostało poprawione na 5 z 8 domów u 4 wydawców (4 spoza ARCHON), bez żadnej
regresji krytycznej** — próg OWNER-a (≥ 3 z 8, ≥ 2 wydawców, ≥ 1 spoza ARCHON) jest spełniony. **Wierne zewnętrze
(wszystkie grupy kryteriów) ma 1 dom z 8.** To dwie różne liczby i obie są wynikiem: bryły, wymiary, wysokości i dachy
przenoszą się na nowe domy (po 6/8), rozmieszczenie otworów (3/8) i lukarny (2/8) — jeszcze nie.

| status | wynik |
|---|---|
| IMPLEMENTATION_COMPLETE | **tak** — dokument, uzgadniacz, budowniczy, odczyt w krokach, kontrola końcowej sceny, decyzja względem LOCAL, host |
| BUILDER_VERIFIED_IN_SCOPE | **tak, w nazwanym zakresie** — dwa domy z ręcznych specyfikacji zbudowane bez odmów, z wymiarami i rzędnymi zmierzonymi w skompilowanej scenie; ograniczenia w rozdziale 8 |
| HOST_INTEGRATION_VERIFIED | **tak, lokalnie** — prawdziwy punkt wejścia, 3 zadania z żetonem + 1 bez, 42 kontrole; nie na wdrożonym hoście |
| QUALITY_GAIN | **tak na DEV** — opis przyjęty na 7 z 9 domów (w tym 4, dla których LOCAL nie buduje modelu), LOCAL utrzymany na 2 |
| TRANSFER_EVIDENCE | **potwierdzony według zamrożonego kryterium** — 5/8 poprawionych, 0 regresji krytycznych; **wierne zewnętrze 1/8** |
| ANDROID_VERIFIED | **nie** — aplikacja bez zmian, bez nowego APK |

**Co OWNER może uruchomić:**

1. Zbudować dom z dokumentu (bez sieci, bez kosztu):
   `npx vite-node research/source-to-model/v3544/build-house.ts -- --doc research/source-to-model/v3544/manual/gracja.house.json --out <katalog>`
   → `house.json`, `model.json`, `scene.json`, `measured.json`, widoki PNG.
2. Odczyt całego domu dla listy pakietów źródeł (płatny, z księgą):
   `BUILDPLAN_ANTHROPIC_API_KEY=… npx vite-node research/source-to-model/v3544/house-run.ts -- --list <lista> --out <katalog> --phase <nazwa> --max-usd <pułap> --local <katalog przebiegów LOCAL>`;
   z `--replay <katalog>` to samo bez sieci i bez kosztu, z tymi samymi skrótami.
3. Host: `ANALYZER_HOUSE_DESCRIPTION=pilot` (+ pułap, żeton i klucz po stronie serwera) → `POST /v1/analyses` z żetonem;
   wynik, scena, model i `GET /v1/analyses/:id/house`. Bez żetonu lub flagi: ścieżka rysunków, zero kosztu.
4. Ocenić dowolny model względem referencji: `research/source-to-model/v3544/score.ts`.

Aplikacja na telefonie nie pokazuje jeszcze dokumentu domu ani decyzji; modele z opisu są dostępne przez hosta
i skrypty, nie w interfejsie.

**Odpowiedzi wprost:**

- **Czy API opisało cały dom?** Na DEV tak (9/9 rzutów z obrysem i bryłami; 29 elewacji na 8 domach). W potwierdzeniu
  rzut i bryły — 8/8; elewacje — w 3 domach z 8 API opisało tylko jedną z czterech wysłanych (Lubczyk, Pallas, Wena),
  a w jednym domu (51853hz) rzut nie miał żadnego wymiaru i opis nie dał metryki.
- **Czy cały opis był konsumowany?** Każde pole jest konsumowane albo nazwane z kodem (test). Zbudowane zostało nie
  wszystko: na DEV 68 z 82 uzgodnionych otworów, 129 pozycji wstrzymanych z kodami; w potwierdzeniu 54 okna i drzwi zbudowane, 41 pozycji wstrzymanych z kodami.
- **Czy poprawny JSON wystarczył builderowi?** Tak po zmianach (Gracja i Aksamitki z ręcznych specyfikacji: 0 odmów,
  wymiary i rzędne co do centymetra); nie w dotychczasowej ścieżce (wykusz, lukarny ścienne i drzwi balkonowe ginęły
  w reprezentacji prostokątnych brył).
- **Co powodowało wysokość Gracji?** Znak poziomu +8,13 odczytany jako +18,11 (kreska znacznika wzięta za cyfrę 1),
  przyjęty za wysokość kondygnacji, bo kontrola opublikowanej wysokości działała tylko w dół. Naprawione w LOCAL.
- **Czy garaż i wykusz istnieją w finalnej scenie?** Tak: w Gracji oba, mierzone w scenie po identyfikatorach
  (test); w potwierdzeniu garaż ze znaną bramą na właściwym miejscu w Lubczyku i Dublinie; brama nie powstała w Pallas
  (opisana jedna elewacja, boczna) i w modelu z opisu Frizei (elewacja frontowa niezarejestrowana — tam został LOCAL).
- **Czy otwory i lukarny mają właściwy host i rzędne?** Otwory są cięte w ścianie, która pod nimi stoi, z parapetem
  od podłogi swojej kondygnacji; lukarna ścienna dzieli topologię z połacią. Zgodność liczby otworów ze źródłem:
  3/8 domów w potwierdzeniu; liczba lukarn: 2/8. To najsłabsza część wyniku.
- **Czy nowe domy są lepsze jako całość?** 5 z 8 — tak, według zamrożonego oceniacza; 3 bez zmiany (LOCAL utrzymany).
- **Czy dobra baza została gdzieś pogorszona?** Nie: 0 regresji krytycznych. W domu, w którym opis byłby gorszy od
  LOCAL (Frizea: brak bramy garażowej), decyzja zostawiła LOCAL. Odwrotny błąd wystąpił raz: w Oslo LOCAL ma
  17 m wysokości, a został utrzymany, bo strona nie publikuje wysokości i decyzja nie miała faktu, którym mogłaby go
  podważyć (opis miał tam 5/6 grup wobec 4/6).

---

## 2. Baza, konfiguracja i związek z v3.54.3; korekta wcześniejszych deklaracji

**Baza.** Praca zaczęła się na czystym drzewie roboczym commita `0d4a057` (solver 2.44.0, APK versionCode 1339).
Niczego nie resetowano. Master Plan v3.54.4 zastąpił `docs/MASTER_PLAN.md`; konflikt z wcześniejszą decyzją D20
(API tylko jako konsultant pojedynczych korekt) rozstrzyga `docs/adr/ADR-V3544-WHOLE-HOUSE-DESCRIPTION.md`: nowsza
decyzja OWNER-a (D29) pozwala API opisać cały dom, a analizator nadal uzgadnia, przelicza, buduje i kompiluje.

**Punkty kontrolne (wszystkie `[skip ci]`, bez merge i PR):** `9cd5568` (dokument, uzgadniacz, budowniczy, Gracja
z opisu ręcznego), `ec8aa25` (odczyt całego domu, eksperyment M na dwóch domach, poprawka LOCAL), `738771e` (decyzja
względem LOCAL, kontrola końcowej sceny, host, oceniacz, testy negatywne), `a6ac849` → `3c531ae` (kod zamrożony), `d8bcb2b` (pieczęć protokołu), `ee89085` (pierwszy wynik potwierdzenia) (zamrożenie przed
potwierdzeniem), oraz commit z tym raportem (raport).

**Konfiguracja.** Model odczytu `claude-sonnet-5-5` (2 / 10 USD za MTok), narzędzia w trybie ścisłej gramatyki.
Solver LOCAL 2.45.0. Uzgadniacz dokumentu 0.1.0, budowniczy 0.1.0, kontrakt odczytu `buildapp.house-reading` 0.1.0,
dokument `buildapp.house-document` 0.1.0.

**Związek z v3.54.3.** Ścieżka konsultanta z v3.54.3 (pojedyncze korekty skali i cech dachu na modelu LOCAL) została
w kodzie bez zmian i nadal działa za swoją flagą. v3.54.4 dodaje obok niej osobną ścieżkę: opis całego domu →
dokument → deterministyczna budowa → decyzja względem LOCAL.

**Korekty wcześniejszych deklaracji (v3.54.3), sprawdzone na zapisanych bajtach:**

| deklaracja v3.54.3 | stan faktyczny |
|---|---|
| „skala Gracji o 36 % za krótka" | Liczba pochodziła z pola `metric.cmPerPixel` (1,649), które nigdy nie było skalą budowy. Model zbudowano w skali z dopasowania fragmentarycznego obrysu do opublikowanej powierzchni zabudowy (`PUBLISHED_FOOTPRINT_SCALE`): 12,06 × 13,43 m zamiast 16,82 × 10,12 m. |
| przyczyna nadmiernej wysokości Gracji | Nie była zmierzona. Zmierzona teraz — rozdział 3. |
| „potwierdzenie: transfer jakości NOT_CONFIRMED" | Podtrzymane. Dodatkowo zmierzono na zapisanych modelach v3.54.3: Lille — jedna kondygnacja 15,71 m (ten sam rodzaj błędu wysokości); Haga — bez dachów; Majeranek — garaż po lewej (lustro względem źródła); Zagliki — jedna kondygnacja 7,05 m; 22192sl — brak bryły garażu. |

Historia nie jest przepisywana: raport v3.54.3 pozostaje w repozytorium bez zmian, a powyższe korekty obowiązują od v3.54.4.

---

## 3. Gracja: dokładna przyczyna szerokości, głębokości i wysokości

Dom: Gracja Mała II (dobredomy.pl). Źródło: rzut parteru z wymiarami 16,82 × 10,12 m, przekrój ze znakami
±0,00, +3,04, +6,49, +8,13, −0,45 i wymiarem 858, strona publikuje wysokość budynku 8,60 m i powierzchnię
zabudowy 144,50 m². Pomiary na zapisanym przebiegu LOCAL bazy (`0d4a057`, solver 2.44.0).

**Wysokość (przyczyna zmierzona).** Rozpoznawanie liczb na przekroju odczytało znaki poziomów +8,13, +6,49 i +3,04
jako +18,11, +16,49 i +12,04: kreska znacznika poziomu przed cyframi została wzięta za cyfrę „1". Najwyższy znak
(+18,11) stał się wysokością ostatniej kondygnacji (`reconstruct-v2.ts`: wysokość górnej kondygnacji = kalenica −
rzędna podłogi), więc powstała jedna kondygnacja „Ground" o wysokości 18,11 m ze ścianami 18,61 m. Istniejąca kontrola
`topDatumBelowPublishedHeight` odrzucała tylko znak *poniżej* opublikowanej wysokości; znak *powyżej* 8,60 m
przechodził. Nie było to złe przeliczenie jednostek ani mnożnik skali.

**Szerokość i głębokość (osobna przyczyna).** Plan LOCAL nie odczytał wymiarów 16,82 i 10,12 jako łańcucha
wymiarowego; obrys ze ścian był fragmentaryczny (3 regiony, bez garażu). Skalę wyznaczono przez dopasowanie pola tego
fragmentu do opublikowanych 144,5 m² (`PUBLISHED_FOOTPRINT_SCALE`), co dało 12,06 × 13,43 m. Zbudowano jedną
kondygnację (`NO_MASS_REACHES_UP`), bez dachu; rejestracja elewacji nie powiodła się.

**Ślad parametrów (Gracja).** „LOCAL" = baza A0; „API" = odczyt H; „finalna scena" = pomiar skompilowanej sceny H.

| parametr | źródło | LOCAL (A0) | API (odczyt) | uzgodnione | builder | finalna scena | pochodzenie | błąd |
|---|---|---|---|---|---|---|---|---|
| szerokość | wymiar „16,82" nad rzutem | 12,06 m (skala z pola zabudowy na fragmencie obrysu) | „16,82" m, końce (278;68)–(1476;68) px | 16,82 m | obrys brył `main`+`garage`+`main-bay` | 16,82 m | DERIVED (wymiar drukowany stoi na końcach obrysu) | LOCAL −4,76 m; H 0,00 m |
| głębokość | wymiar „10,12" z lewej | 13,43 m | „10,12" m, końce (68;438)–(68;1158) px | 10,12 m | jw. | 10,12 m | DERIVED | LOCAL +3,31 m; H 0,00 m |
| skala rzutu | dwa wymiary | 4,196 cm/px roboczego rastra (nieprawdziwa) | — | 1,1747 i 1,1710 cm/px (stosunek 1,003) | `toModel` | — | DERIVED | — |
| podłoga poddasza | znak „+3,04" | odczyt „+12,04" | „+3,04" UPPER_FLOOR | +3,04 m | poziom L1 | strop +2,74…+3,04 | PRINTED | LOCAL +9,00 m |
| kalenica bryły głównej | znak „+8,13" | odczyt „+18,11" → kondygnacja 18,11 m | „+8,13" RIDGE main | +8,13 m | płaszczyzny `roof-main-low/high`, datum 8,13 | 8,13 m | PRINTED | LOCAL +9,98 m; H 0,00 m |
| kalenica garażu | znak „+6,49" | odczyt „+16,49" (dach płaski na 12,04) | „+6,49" (bez przypisania do bryły) | +6,17 m z trzech zarejestrowanych elewacji | `roof-garage-low/high` | 6,17 m | DERIVED (z elewacji) | H −0,32 m |
| teren | znak „−0,45" | nie użyty | „−0,45" TERRAIN | −0,45 m | — | wysokość nad terenem 8,58 m | PRINTED | H −0,02 m wobec 8,60 |
| kąt dachu | „40°" na przekroju | 40° (strona) | „40°" | 40° | spadek płaszczyzn | — | PRINTED | — |
| wysokość całkowita | wymiar „858", strona 8,60 m | ściany 18,61 m | „858" TOTAL_HEIGHT | kontrola: kalenica − teren = 8,58 m | — | 8,58 m | PRINTED (kontrola) | LOCAL +10 m |
| garaż | rzut: prawa strona, brama od frontu | brak bryły | bryła `garage`, wielokąt 4 naroża | x 10,70…16,82; z 1,55…8,62 m | ściany `w-garage-*` na styk do `main` | ściany i dach garażu w scenie | DERIVED | LOCAL: brak |
| wykusz | rzut: lewa ściana, skośne ścianki | brak | w obrysie bryły głównej (15 naroży) | wydzielony jako `main-bay`, x 0…0,99; z 3,91…7,14 m | 3 ściany + dach płaski +3,34 | w scenie | DERIVED; wysokość DEFAULT | wysokość wykusza przyjęta umownie |
| lukarna frontowa | elewacja frontowa | brak | CROSS_GABLE, szczyt w wierszu 163 px | ścienna, 2,95…6,14 m wzdłuż ściany, okap +5,36, szczyt +6,70 | wycięcie połaci + dwie połacie lukarny + policzki | w scenie | DERIVED; okap ESTIMATED (podniesiony pod drzwi balkonowe) | okap lukarny nieodczytany |
| lukarna tylna | elewacja tylna | brak | CROSS_GABLE | ścienna, 3,67…6,69 m, okap +5,27, szczyt +6,53 | jw. | w scenie | DERIVED / ESTIMATED | jw. |

**Poprawka w LOCAL (przyczynowa).** `levelDatumsAbovePublishedHeight` (`packages/reconstruction/src/v2/roof-datum.ts`):
opublikowana wysokość budynku liczy się od terenu, który leży na ±0,00 albo niżej, więc żaden znak poziomu budynku nie
może stać wyżej nad ±0,00 niż ta wysokość (tolerancja 0,30 m). Znak powyżej nie jest używany i trafia do luk jako
odrzucony. Solver 2.45.0. Bez opublikowanej wysokości nic się nie zmienia. Test przyczyny
(`packages/analysis-service/test/house-v3544.test.ts`, pierwsza grupa) nie przechodzi na bazie (funkcja nie istnieje)
i przechodzi po zmianie. Na zapisanych bajtach Gracji: kondygnacja 18,11 m → 2,80 m. Poprawka usuwa absurdalną
wysokość, ale nie naprawia LOCAL-owej Gracji jako całości: nadal jedna kondygnacja, zły obrys, brak dachu — to robi
dopiero ścieżka opisu (rozdziały 4–8). Nie zastosowano żadnego globalnego mnożnika.

Plansza z linijką wysokości (prywatna): `boards/dev-gracja.png` — LOCAL sięga +18,11 m przy kalenicy źródła +8,13 m;
model z opisu kończy się na +8,13 m.

---

## 4. Eksperyment M: poprawny opis → builder

**Pytanie:** czy poprawna specyfikacja daje poprawny dom? **Odpowiedź: w dotychczasowej ścieżce nie; po zmianach tak.**

**Zakres ręcznej pracy.** Dwie specyfikacje `MANUAL_DIAGNOSTIC`
(`research/source-to-model/v3544/manual/gracja.house.json`, `aksamitki.house.json`): piksele odczytane okiem na
rysunkach wydawcy (obrys, bryły, wymiary z końcami, znaki poziomów, na dwóch elewacjach końce ścian, okap i kalenica
każdej bryły, otwory, lukarna, balkon). Nie zawierają metrów poza liczbami drukowanymi i nie zawierają gotowej
geometrii — przechodzą przez ten sam walidator, uzgadniacz, budowniczego i kompilator co odczyt API. Są ścieżką testową:
kod wykonawczy ich nie czyta, nie są wynikiem AI i nie są rezerwą produkcyjną. Elewacje boczne nie były czytane.

**Trzy wyniki tych samych danych:**

| dom | (1) zapisany LOCAL | (2) poprawne dane w dotychczasowej ścieżce (opis v3.54.1 → BuildingV2 prostokątne bryły) | (3) te same dane w nowym adapterze |
|---|---|---|---|
| Gracja | 12,06 × 13,43 m, jedna kondygnacja 18,11 m, bez dachu, bez garażu | 15,80 × 10,10 m; wykusz odrzucony (`BODY_DROPPED`: za mały po ułożeniu); obie lukarny ścienne zamienione na lukarny na połaci; drzwi balkonowe poddasza odrzucone („ściana pod dachem ma 0,40 m"); obrys 8-narożny zastąpiony prostokątem 99,4 m² zamiast 89,1 m² | 16,82 × 10,12 m; kalenica +8,13, garaż +6,49; garaż, wykusz, obie lukarny ścienne z drzwiami balkonowymi i balkonami; 0 odmów jądra, 0 błędów kompilacji; 11/11 kontroli źródłowych |
| Aksamitki | brak modelu (LOCAL nie ustala skali rzutu) | 12,30 × 8,80 m; wykusz odrzucony; lukarna ścienna → lukarna na połaci; oboje drzwi balkonowych odrzucone; słupy portyku bez pola w kontrakcie | 13,22 × 8,82 m; kalenica +8,37, wysokość nad terenem 8,84 m; wykusz, lukarna ścienna nad wejściem z dwojgiem drzwi balkonowych, balkon na dwóch słupach portyku; 0 odmów, 0 błędów; 9/9 kontroli |

**Pierwsza zła decyzja w dotychczasowej ścieżce** nie leży w odczycie, tylko w reprezentacji: `BuildingV2` zna
wyłącznie prostokątne bryły (`x0,x1,z0,z1`), lukarna ma tam typ, środek i szerokość bez wysokości i bez relacji do
ściany, a balkon nie ma podpór. Poprawny opis traci więc wykusz, lukarny ścienne i drzwi w nich już na wejściu do
budowniczego. Naprawa w tej kampanii: dokument z wielokątami i budowniczy emitujący polecenia jądra bezpośrednio
(jądro wielokąty przyjmowało od dawna), z konsumentami wymienionymi w rozdziale 8.

**Pierwsze straty znalezione i naprawione w nowym adapterze podczas M** (każda powtarzalna, nie dla jednego domu):
ściany piętra nakładające się na ściany parteru (ściany buduje teraz bryła, od swojej najniższej kondygnacji do
dachu); styk niższej bryły z wyższą w narożniku (właścicielem narożnika zostaje ściana przyjmująca styk); otwór
przypisany do krawędzi obrysu biegnącej wzdłuż dwóch brył (cięty jest w ścianie, która pod nim stoi); dach bryły
z wnęką wejścia (dach skośny przykrywa prostokąt bryły, gdy obrys wypełnia go w ≥ 80 %); okap lukarny odczytany na
końcu wystającej połaci zamiast na ścianie bocznej (lukarna jest podnoszona tak, by otwór w niej mieścił się pod
jej dachem, z zapisem `DORMER_EAVES_RAISED`); balkon nad portykiem (głębokość i słupy z rzutu, nie z umownej stałej).

---

## 5. Schemat wspólnego dokumentu

`packages/reconstruction/src/house/document.ts` — jeden wersjonowany dokument `buildapp.house-document` 0.1.0
o trzech warstwach:

1. **Źródła, obserwacje, ograniczenia** (piksele opublikowanych rysunków): krawędź frontu na rzucie; wymiary drukowane
   z dwoma końcami, dosłownym napisem, jednostką i tym, co obejmują; znaki poziomów ze znaczeniem; obrysy (CAŁOŚĆ,
   BRYŁA, STREFA OTWARTA); dla każdej elewacji strona, alternatywy, lustro, linia terenu, końce ścian / okap / kalenica
   każdej bryły, otwory, cechy dachu; dachy brył; fakty strony; relacje, konflikty, niewiadome. Każda obserwacja ma
   pochodzenie (`API`, `LOCAL`, `MANUAL`).
2. **Uzgodniona geometria semantyczna** (metry, układ modelu): poziomy, bryły z wielokątnym obrysem i dachem, obrysy
   kondygnacji, otwory na ścianach-gospodarzach, lukarny, balkony, daszki, kominy, okna dachowe. Każda liczba to
   `Num {value, basis, refs, how, uncertainty}` z podstawą `PRINTED | DERIVED | ESTIMATED | DEFAULT | UNKNOWN`.
   `UNKNOWN` ma zawsze wartość `null` — nigdy ukryte zero; walidator to wymusza.
3. **Weryfikacja i stan użycia**: rekord na parametr (`ACCEPTED / REJECTED / PENDING / HELD`, kod, konsument,
   identyfikatory poleceń programu i siatek sceny), kontrole (`PASS / FAIL / NOT_CHECKED / UNKNOWN`, zakres, co
   blokują), wstrzymania z kodem i powodem, znane wady, pokrycie, użyteczność przedmiaru, skróty modelu i sceny.

**Powiązanie element → program → siatka.** Rekord parametru nazywa polecenia (`programIds`), a siatki sceny noszą
`objectId` tego samego polecenia; `measureScene` mierzy scenę po tych identyfikatorach. Identyfikatory są
semantyczne i stabilne (`w-main-3`, `roof-garage-low`, `dormer-front-1-roof-l`), nie indeksy trójkątów.

**Niepewność i zależności.** Kolejność przyjmowania: tożsamość → orientacja i metryka → bryły i poziomy → dachy →
otwory → cechy zależne. Niezarejestrowana elewacja wstrzymuje wszystko, co z niej odczytano (`HELD_BY_DEPENDENCY`);
niepokrycie obrysu przez bryły wstrzymuje dachy, otwory i cechy; sprzeczność wysokości wstrzymuje cechy dachu.

**Migracja.** Dotychczasowe typy (`BuildingV2`, opis v3.54.1, kontrakt konsultanta v3.54.3) zostają bez zmian i
nie są migrowane. Wynik hosta zachowuje kontrakt `buildapp.link-analysis-result` 1.0.0; dokument domu jest piątym,
opcjonalnym plikiem zadania (`house.json`, trasa `/v1/analyses/:id/house`). Zmiana wersji dokumentu będzie wymagała
jawnego konwertera — nie ma jeszcze drugiej wersji.

---

## 6. Odczyt całego domu przez API

`packages/analysis-service/src/house/read.ts`, `pictures.ts`, `review.ts`. Odczyt jest podzielony na kontrolowane
kroki; każdy to najwyżej jedno płatne zapytanie (i jedno ponowienie transportu), odpowiedź tylko przez jedno narzędzie.

| krok | co jest wysyłane | o co pyta narzędzie | limit wyjścia |
|---|---|---|---|
| INVENTORY | wszystkie obrazy pakietu nadające się na rysunek (≤ 24), pomniejszone do 512 px | rodzaj, kondygnacja, strona, czy to ten dom | 3000 |
| PLAN | rzut parteru w pełnej rozdzielczości (≤ 1568 px), rzuty wyższych kondygnacji pomocniczo (800 px), fakty strony jako dane | krawędź frontu; wymiary drukowane z końcami i tym, co obejmują; obrys ścian naroże po narożu; bryły; zadaszone strefy otwarte | 6000 |
| FACADES | rzut (800 px), przekrój i elewacje w pełnej rozdzielczości (małe powiększone ×2), do 2 widoków perspektywicznych (tylko obecność i topologia), bryły z rzutu z ich położeniem w metrach | znaki poziomów ze znaczeniem; dach każdej bryły; dla każdej elewacji: strona, alternatywy, lustro, linia terenu, końce ścian / okap / kalenica brył, otwory, cechy | 12000 |
| REVIEW (≤ 2 rundy) | elewacje ponownie + dwa obrazy ZBUDOWANEGO modelu (cztery strony; z góry i dookoła) + ustalenia programu (kontrole, wstrzymania) | różnice w kolejności orientacja → bryły → wysokości → dachy → otwory → cechy; typowane korekty OBSERWACJI | 8000 |

**Zasady.** Współrzędne są w pikselach obrazu, tak jak go wysłano (rozmiar podany); program przelicza je na piksele
opublikowanego obrazu. Liczby drukowane są kopiowane dosłownie; ich przeliczenie na metry robi program
(`literalToMetres`, `levelLiteralToMetres`) i porównuje z przeliczeniem czytelnika — rozbieżność jest zapisywana
(`WRONG_READ`), wygrywa odczyt programu. Pierwszej interpretacji nie pokazuje się wyniku LOCAL. Referencje ocen nie
są wysyłane. Tekst na obrazach, podpisy i fakty strony są danymi: prompt systemowy zabrania traktować je jak
polecenia, a odpowiedź niebędąca wywołaniem narzędzia jest odrzucana (`PARSE_REJECTED`). API nie wykonuje poleceń
powłoki i nie edytuje kodu, referencji, księgi ani testów — jedyne, co może zrobić, to zwrócić dane do narzędzia.

**Ścisła gramatyka.** Pierwsze płatne uruchomienie (Gracja, 0,17 USD) zwróciło przez narzędzie nieścisłe długą
odpowiedź z tablicami zapisanymi jako tekst i utraconymi wpisami. Od tego czasu narzędzia PLAN, FACADES i INVENTORY
idą w trybie ścisłym (`strict: true`); ograniczenia, których gramatyka nie niesie (zakresy, długości), sprawdza
konwerter. Identyfikatory brył na elewacjach są w gramatyce ograniczone do brył z rzutu. Narzędzie REVIEW (płaskie,
z wieloma polami opcjonalnymi) dostawca odrzucił w trybie ścisłym („Schema is too complex"), więc jest nieścisłe
i w całości walidowane przez `applyCorrection`.

**Przykład faktycznie wysłanych obrazów (Gracja):** INVENTORY 19 miniatur; PLAN 2 obrazy (1568 × 1333 i 800 × 680);
FACADES 8 obrazów (rzut 800 × 680, przekrój 1568 × 823, cztery elewacje 1400 × 610, dwa widoki ~800 px); REVIEW
4 elewacje + 2 obrazy modelu. Zapis każdego kroku (obrazy z rozmiarem i skrótem, skrót promptu, surowa odpowiedź,
zużycie, identyfikator zapytania) leży w `answers/<KROK>.json` — z niego działa odtwarzanie bez sieci.

---

## 7. Rejestracja rzutu, przekroju i elewacji; wariant i lustro

`packages/reconstruction/src/house/resolve.ts`.

- **Tożsamość / wariant.** Obrazy oznaczone przez inwentarz jako „nie ten dom" (inny projekt, wariant lustrzany
  sprzedawany osobno) nie mogą nieść obserwacji; obserwacja na takim obrazie to niezaliczona kontrola IDENTITY.
- **Metryka rzutu.** Dla każdej osi arkusza: wymiar całkowity, którego końce stoją na końcach odrysowanego obrysu,
  daje skalę = wartość / rozpiętość obrysu; inaczej skala z własnej długości linii. Dwie osie muszą dać jedną skalę
  (≤ 3 %). Bez wymiaru drukowanego skala z opublikowanej powierzchni jest oznaczona `ESTIMATED`
  (`SCALE_FROM_PUBLISHED_AREA`), a przedmiar `NOT_USABLE`. Wymiar całkowity, którego linia wybiega poza ściany
  (obejmuje ganek, taras), nie jest sprzecznością; obrys dłuższy niż wymiar całkowity — jest.
- **Bryły.** Wielokąty są prostowane (≤ 6°), linie ścian bliższe niż 0,2 m scalane, bryły muszą razem pokryć obrys
  całości bez nakładania (≤ 4 % pola). Skośny wykusz odrysowany wewnątrz bryły jest wydzielany jako osobna bryła.
- **Przekrój.** Znaki poziomów stają się poziomami i kalenicami tylko z nadanym znaczeniem; kalenica − teren jest
  sprawdzana z wymiarem wysokości całkowitej i z opublikowaną wysokością.
- **Elewacje.** Każda elewacja jest wiązana z konkretnymi bryłami: dopasowanie liniowe piksel → położenie wzdłuż
  strony po końcach ścian brył (jedna skala, bez niezależnego rozciągania X i Y), próbowane dla strony podanej i dla
  alternatyw; wymagana dodatnia skala (lustro daje ujemną i nie przechodzi, chyba że obraz jawnie oznaczono jako
  lustrzany) i reszta ≤ 0,45 m. Niezależna kontrola: wiersz kalenicy przeliczony tą samą skalą musi zgodzić się
  z kalenicą z przekroju lub opublikowaną wysokością w 12 % — to kotwica nieużyta w dopasowaniu. Elewacja, która
  nie przechodzi, wstrzymuje swoje otwory i cechy; widoki perspektywiczne nie niosą żadnego wymiaru.
- **Strona i lustro** są rozstrzygane po garażu, wejściu, wykuszu i asymetrii brył: to one wyznaczają końce ścian
  wchodzące do dopasowania.

Wynik na DEV (9 domów, 29 odczytanych elewacji): 23 zarejestrowane, 6 nie (22192sl 3, Supertunie 2, Madera 1). W potwierdzeniu: 23 elewacje opisane (z 32 wysłanych), 19 sprawdzonych (4 należą do domu bez metryki), 17 zarejestrowanych, 2 nie (Frizea — frontowa, Abakus — lewa).

---

## 8. Zmiany buildera i pierwsze miejsca utraty danych

Łańcuch pola: **schemat → czytnik → uzgadniacz → budowniczy → polecenie jądra → kompilator → mapa geometrii**.
`packages/reconstruction/src/house/program.ts` (budowniczy), `build.ts` (uruchomienie w jądrze z nazwanymi odmowami),
`poly.ts` (wielokąty), `packages/analysis-service/src/house/measure.ts` (pomiar sceny po kompilacji).

| obszar | co jest budowane | jak |
|---|---|---|
| bryły | każda bryła ma własne ściany od podłogi swojej najniższej kondygnacji do swojego dachu | wyższa bryła buduje cały obwód; niższa tylko tam, gdzie nie stoi już ściana wyższej, i dochodzi do niej stykiem `BUTT`; narożnik ściany przyjmującej styk należy do niej |
| wielokąty | obrysy z uskokami i skośnymi ściankami wykuszy | `createWall` po krawędziach wielokąta z narożnikami `CORNER`; płyta po wielokącie |
| poziomy | poziomy z rzędnych drukowanych; strop piętra wewnątrz ścian | `createLevel`, `createSlab` |
| dachy | dwuspadowy, czterospadowy, pulpitowy, płaski; każda bryła osobno | `createRoofPlane` z datum na kalenicy i spadkiem; okap zerowy wzdłuż wyższej bryły; ściany `FOLLOW_ROOF_PLANES` |
| lukarna ścienna | ściana lukarny jest ścianą elewacji; połać gospodarza ma wycięcie do linii zejścia dachów | wycięcie w obrysie połaci + dwie połacie lukarny + policzki `createWallPanel` — wspólna topologia, nie cofnięcie |
| lukarna na połaci | lukarna jądra | `createDormer` |
| otwory | okna, drzwi, drzwi balkonowe, brama garażowa | `cutOpening` w ścianie, która stoi pod otworem, + `placeWindow` / `placeDoor`; parapet liczony od podłogi kondygnacji otworu |
| okna dachowe | wycięcie w połaci | `cutRoofOpening` + `placeRooflight` |
| balkon / portyk | płyta, balustrada na wolnych krawędziach, słupy z rzutu | `createBalcony`, `createRailing`, `createColumn` |
| daszek nad strefą otwartą | płyta na słupach | `createRoofPlane` (płaska) + `createColumn` |
| komin | trzon ponad dach | `placeChimney` |

**Odmowy są nazwane, nie ciche.** Budowniczy odmawia z kodem (`WRONG_BINDING`, `COMPILE_CONFLICT`,
`REPRESENTATION_LIMIT`, `WRONG_READ`); jądro odmawia swoim kodem, a pętla budowy zdejmuje odrzucone polecenie wraz
z tym, co na nim stało (otwór → okno), zostawiając ściany sąsiednie bez utraconego styku. Wszystko trafia do
`verification.held`.

**Pierwsze miejsca utraty danych, zmierzone:**

| miejsce | co ginęło | stan |
|---|---|---|
| `BuildingV2` (bryły prostokątne) | wykusz, uskoki obrysu | ominięte: budowniczy dokumentu emituje polecenia jądra z wielokątów |
| opis v3.54.1 → lukarna bez wysokości i relacji do ściany | lukarna ścienna, drzwi balkonowe | naprawione: `dormers[].kind = WALL_GABLE` z okapem i szczytem |
| balkon bez podpór | portyk | naprawione: `balconies[].posts` |
| LOCAL: znak poziomu ponad wysokość budynku | cała wysokość | naprawione w LOCAL (solver 2.45.0) |
| LOCAL: skala z pola zabudowy na fragmencie obrysu | szerokość, głębokość | nie naprawiane w LOCAL; zastępowane przez opis, gdy LOCAL przeczy wymiarom drukowanym |
| narzędzie nieścisłe | tablice elewacji | naprawione: ścisła gramatyka |
| elewacja boczna widziana od szczytu | położenie komina wzdłuż budynku | nazwane `SOURCE_UNKNOWN` (nie zgadywane) |
| ściana krótsza niż otwór (lico wykusza) | okna wykusza | częściowo: otwór zwężany do rdzenia ściany, gdy mieści się ≥ 50 %; inaczej `COMPILE_CONFLICT` |

**Czego budowniczy nie robi (nazwane ograniczenia, nie pełny silnik BIM):** wnętrze; dachy wielopołaciowe o
nieregularnym obrysie (L, T z koszami), mansardowe; daszki skośne nad gankiem; okna w ścianach szczytowych powyżej
okapu inne niż mieszczące się pod połacią; teren; słupy i łuki podcieni pod dachem głównym.

---

## 9. Konsumowane parametry, odrzucone propozycje i późniejsze nadpisania

**Każde aktywne pole jest konsumowane albo zgłasza konkretny błąd.** Test
„with every parameter of the agreed geometry consumed or named as not built" sprawdza to na pełnym dokumencie:
rekord `ACCEPTED` musi nazwać konsumenta i polecenia programu (albo krok uzgadniacza), każdy inny — kod.

| rodzina danych | schemat | czytnik | uzgadniacz | konsument | ćwiczone (DEV, 9 domów) | sprawdzone w scenie |
|---|---|---|---|---|---|---|
| krawędź frontu rzutu | `observations.front` | PLAN | `toModel` | cały układ | 9 domów | kontrola ORIENTATION + rejestracja elewacji |
| wymiary drukowane | `dimensions[]` | PLAN | metryka, kontrola rozpiętości | skala wszystkich brył | 26 wymiarów / 9 domów | szerokość i głębokość sceny (test M) |
| obrys całości | `outlines[WHOLE]` | PLAN | pokrycie przez bryły | kontrola BODIES | 9 domów | pole i rozpiętość |
| bryły (wielokąty) | `outlines[BODY]` | PLAN | prostowanie, scalanie linii, kafelkowanie | ściany, płyty, dachy | 14 odczytanych → 17 brył | ściany garażu i wykusza po `objectId` (test M) |
| wykusz skośny | — (wydzielany) | — | `splitBays` | osobne ściany + dach płaski | 3 domy | tak (test M) |
| strefa otwarta (ganek, portyk) | `outlines[OPEN]` | PLAN | `zoneAt` | balkon na słupach / daszek | 12 stref / 7 domów → 1 balkon na słupach, 2 daszki | wizualnie (Aksamitki) |
| znaki poziomów | `levels[]` | FACADES | poziomy, kalenice, teren | `createLevel`, datum dachu | 49 znaków / 7 domów | wysokość nad terenem (test M) |
| dach bryły | `roofs[]` | FACADES | rodzaj, oś kalenicy, wysokość | `createRoofPlane` | 12 / 8 domów → 43 połacie | szczyt dachu każdej bryły |
| strona / lustro elewacji | `elevations[].side, mirrored, alternatives` | FACADES | rejestracja | warunek dla otworów i cech | 29 elewacji / 8 domów | test lustra |
| końce ścian, okap, kalenica brył | `elevations[].bodies` | FACADES | rejestracja, wysokości | wysokość dachu, gdy brak znaku | 8 domów | kontrola wiersza kalenicy |
| otwory w ścianach | `elevations[].openings` | FACADES | ściana-gospodarz, poziom, parapet | `cutOpening` + okno/drzwi | 82 uzgodnione → 68 wyciętych | liczba okien i drzwi sceny; test dodania/usunięcia |
| okna dachowe | `openings[ROOF_WINDOW]` | FACADES | położenie na połaci | `cutRoofOpening` | 6 / 1 dom | wizualnie |
| lukarna ścienna / szczyt poprzeczny | `features[WALL_DORMER_GABLE, CROSS_GABLE]` | FACADES | gospodarz, okap, szczyt | wycięcie połaci + połacie + policzki | 5 / 3 domy | tak (test M) |
| lukarna na połaci | `features[ROOF_DORMER_*]` | FACADES | jw. | `createDormer` | 1 odczytana, 0 zbudowanych (odmowa jądra `DORMER_LAYOUT_INVALID`) | nie |
| balkon | `features[BALCONY]` | FACADES | poziom, ściana, głębokość | `createBalcony` + balustrada | 6 / 3 domy | wizualnie |
| daszek | `features[CANOPY]` | FACADES | strefa otwarta pod nim | płyta + słupy | 2 / 2 domy | wizualnie |
| komin | `features[CHIMNEY]` | FACADES | położenie wzdłuż kalenicy | `placeChimney` | 10 uzgodnionych → 9 zbudowanych / 6 domów | wizualnie |
| fakty strony | `published[]` | pakiet źródeł | kontrole wysokości i pola; skala szacowana | decyzja względem LOCAL | 9 domów | test decyzji |
| wnętrze | `geometry.interior` | — | — | brak (`NOT_BUILT`) | — | — |

**Wstrzymania na DEV (9 domów, 129 pozycji):** `HELD_BY_DEPENDENCY` 38 (elewacja niezarejestrowana), `SOURCE_UNKNOWN`
32 (komin widziany od szczytu, daszek bez strefy na rzucie), `COMPILE_CONFLICT` 28 (otwór nie mieści się w ścianie,
nachodzi na inny, sięga ponad ścianę), `CAPABILITY_MISSING` 13, `WRONG_READ` 10, `WRONG_BINDING` 8.

**Propozycje korekt po budowie (REVIEW).** Każda korekta jest stosowana osobno na kopii obserwacji; cały dom jest
uzgadniany i budowany od nowa; korekta zostaje tylko wtedy, gdy nie przestaje przechodzić żadna kontrola źródłowa,
nie przybywa odmów i model się zmienia. Odpowiedź o nieaktualnej rewizji jest odrzucana w całości (`STALE_DEPENDENCY`).

Na DEV (12 propozycji, 9 domów; pełna lista w `stage-reports/artifacts/v3544/dev-proposals.md`):

| dom | runda | propozycja | stan | kod | funkcja (konsument) | skutek |
|---|---|---|---|---|---|---|
| -archon-dom-w-majeranku-2-g2 | 1 | SET_FEATURE balcony_right | REJECTED | PARSE_REJECTED | resolveHouse/features → houseProgram/wallDormer|balcony|canopy | a feature needs an id, a kind this builder has and a box |
| architecturaldesigns-22192sl | 1 | ADD_OPENING el-p6/o10 | REJECTED | COMPILE_CONFLICT | resolveHouse/openings → houseProgram/cutOpening | not built: opening-rear-10: OPENINGS_OVERLAP: openings opening-rear-10 and opening-rear-5 overlap on wall w-main-4 |
| architecturaldesigns-22192sl | 1 | ADD_OPENING el-p6/o10 | REJECTED | COMPILE_CONFLICT | resolveHouse/openings → houseProgram/cutOpening | not built: opening-rear-10: OPENINGS_OVERLAP: openings opening-rear-10 and opening-rear-6 overlap on wall w-main-6 |
| architecturaldesigns-22192sl | 1 | ADD_OPENING el-p6/o10 | REJECTED | COMPILE_CONFLICT | resolveHouse/openings → houseProgram/cutOpening | not built: opening-rear-10: OPENINGS_OVERLAP: openings opening-rear-10 and opening-rear-7 overlap on wall w-main-8 |
| ertuniach-2-e-m9022920a5fcb6 | 1 | SET_ROOF roof of main | REJECTED | NOT_CONSUMED | resolveHouse/roofs → houseProgram/roofPlanes | the built model is the same with it: the correction reached no geometry |
| ertuniach-2-e-m9022920a5fcb6 | 1 | SET_ROOF roof of main | REJECTED | NOT_CONSUMED | resolveHouse/roofs → houseProgram/roofPlanes | the built model is the same with it: the correction reached no geometry |
| toreniach-3-e-me822857280738 | 1 | ADD_OPENING el-p6/o1 (corrected) | APPLIED | — | resolveHouse/openings → houseProgram/cutOpening | model adb5e0bf9e → f22c13e79e; failing checks 0 → 0; held or refused 10 → 10; meshes 30 → 30 |
| toreniach-3-e-me822857280738 | 2 | REVIEW the whole round | REJECTED | NOT_SENT | reviewHouse | the house stands as built |
| final-domywstylu-madera | 1 | SET_ELEVATION_BODY el-p2 body main | REJECTED | COMPILE_CONFLICT | resolveHouse/registration+heights | with it 1 more object(s) are held or refused by the builder than before |
| final-domywstylu-madera | 1 | SET_ELEVATION_BODY el-p2 body garage | REJECTED | NOT_CONSUMED | resolveHouse/registration+heights | the built model is the same with it: the correction reached no geometry |
| final-domywstylu-madera | 1 | SET_FEATURE el-p2/f1 | REJECTED | NOT_CONSUMED | resolveHouse/features → houseProgram/wallDormer|balcony|canopy | the built model is the same with it: the correction reached no geometry |
| nal-archon-dom-w-aksamitkach | 1 | SET_FEATURE el-p11/f1 | REJECTED | COMPILE_CONFLICT | resolveHouse/features → houseProgram/wallDormer|balcony|canopy | with it 6 more object(s) are held or refused by the builder than before |

Razem: APPLIED : 1; REJECTED COMPILE_CONFLICT: 5; REJECTED NOT_CONSUMED: 4; REJECTED NOT_SENT: 1; REJECTED PARSE_REJECTED: 1

**Późniejsze nadpisania.** Odczyt API nie ma bezwarunkowego pierwszeństwa nad liczbą drukowaną (wygrywa przeliczenie
programu) ani nad LOCAL (rozdział 10: decyzja po faktach źródłowych). LOCAL nie ma bezwarunkowego pierwszeństwa nad
lepiej udokumentowanym opisem. Jedyne automatyczne zmiany odczytu to: wydzielenie wykusza (`BAY_SPLIT_FROM_BODY`),
podniesienie okapu lukarny pod otwór (`DORMER_EAVES_RAISED`), okap lukarny z kąta dachu, gdy nieodczytany
(`DORMER_EAVES_ASSUMED`), zwężenie otworu do rdzenia krótkiej ściany — każda zapisana w dokumencie jako znana wada
lub rekord parametru.

---

## 10. DEV, ablacja, regresja, pierwszy wynik 8 nowych domów

### 10.1 DEV (9 domów)

Warianty: **A0** — LOCAL na bazie `0d4a057` (solver 2.44.0); **A1** — LOCAL po poprawce wysokości (2.45.0);
**M** — ręczna specyfikacja (2 domy); **H** — odczyt całego domu przez API; **odtworzenie H** — te same zapisane
odpowiedzi bez sieci. A0 różni się od A1 tylko tam, gdzie zadziałała poprawka wysokości (Gracja: 18,11 m → 2,80 m);
w pozostałych domach geometria A0 = A1. Dla 4 z 9 domów LOCAL (A0 i A1) nie buduje modelu
(`METRIC_RESOLUTION_INCONCLUSIVE`: nie ustala skali rzutu) — w v3.54.3 te domy powstawały dopiero ze skalą od konsultanta.

| dom | LOCAL (A1) | H: wymiary × wys. | obrys i metryka | wysokości | dach | otwory zbudowane / odczytane | brakujące (kody) | przyjęty | koszt USD |
|---|---|---|---|---|---|---|---|---|---|
| confirm-archon-dom-w-majeranku-2-g2 | 19.51 × 8.57 m, szczyt +8.20 | 19.50 × 9.32 m, 8.52 m n.t. | 5/0 | 1/0 | main:GABLE, garage:GABLE, main-bay:FLAT | 12 / 16 | COMPILE_CONFLICT 10, WRONG_READ 7, SOURCE_UNKNOWN 5, WRONG_BINDING 2, CAPABILITY_MISSING 2 | DESCRIBED | 0.208 |
| confirm-dobredomy-gracja-i-mala-ii | 12.06 × 13.43 m, szczyt +2.80 | 16.82 × 10.12 m, 8.58 m n.t. | 6/0 | 2/0 | main:GABLE, garage:GABLE, main-bay:FLAT | 16 / 21 | COMPILE_CONFLICT 6, WRONG_BINDING 2, SOURCE_UNKNOWN 1 | DESCRIBED | 0.311 |
| confirm-architecturaldesigns-22192sl | brak modelu (METRIC_RESOLUTION_INCONCLUSIVE) | 19.91 × 12.80 m, 8.995 m n.t. | 5/0 | 0/0 | garage:GABLE, main:GABLE | 6 / 16 | HELD_BY_DEPENDENCY 16, COMPILE_CONFLICT 6, SOURCE_UNKNOWN 2, CAPABILITY_MISSING 1, WRONG_READ 1 | DESCRIBED | 0.201 |
| projekt-dom-w-supertuniach-2-e-m9022920a5fcb6 | brak modelu (METRIC_RESOLUTION_INCONCLUSIVE) | 6.90 × 13.50 m, 5.29 m n.t. | 5/0 | 1/0 | main:GABLE | 6 / 13 | HELD_BY_DEPENDENCY 15, SOURCE_UNKNOWN 5, CAPABILITY_MISSING 1, WRONG_BINDING 1 | DESCRIBED | 0.179 |
| projekt-dom-w-toreniach-3-e-me822857280738 | 7.39 × 12.50 m, szczyt +5.72 | 7.90 × 12.50 m, 6.04 m n.t. | 6/0 | 1/0 | main:GABLE | 5 / 8 | SOURCE_UNKNOWN 4, CAPABILITY_MISSING 4, COMPILE_CONFLICT 1 | DESCRIBED | 0.162 |
| final-archon-dom-w-kuklikach | 7.56 × 8.76 m, szczyt +4.98 | 7.56 × 8.76 m, 5.85 m n.t. | 5/0 | 1/0 | main:HIP | 6 / 6 | SOURCE_UNKNOWN 6, CAPABILITY_MISSING 2 | LOCAL | 0.154 |
| final-domywstylu-madera | 11.09 × 18.57 m, szczyt +6.00 | 15.57 × 19.01 m, 6.69 m n.t. | 4/0 | 2/0 | main:GABLE, garage:FLAT | 0 / 4 | HELD_BY_DEPENDENCY 7, COMPILE_CONFLICT 2 | LOCAL | 0.147 |
| final-archon-dom-w-aksamitkach | brak modelu (METRIC_RESOLUTION_INCONCLUSIVE) | 13.22 × 8.82 m, 8.84 m n.t. | 6/0 | 1/0 | MAIN:GABLE, MAIN-bay:FLAT | 14 / 19 | SOURCE_UNKNOWN 8, CAPABILITY_MISSING 3, WRONG_BINDING 3, COMPILE_CONFLICT 3, WRONG_READ 2 | DESCRIBED | 0.349 |
| final-houseplans-sp318422 | brak modelu (METRIC_RESOLUTION_INCONCLUSIVE) | 14.02 × 9.58 m, 7.671 m n.t. | 5/0 | 1/0 | main:GABLE, garage:GABLE | 0 / 0 | SOURCE_UNKNOWN 1 | DESCRIBED | 0.108 |

Kolumny „obrys i metryka" i „wysokości" podają zaliczone/niezaliczone kontrole źródłowe dokumentu. Koszt to wszystkie
płatne zapytania danego domu w tej kampanii (z próbami wstępnymi i powtórzeniami).

- **Opis przyjęty na 7 z 9 domów**; LOCAL utrzymany na 2: Kukliki (LOCAL spełnia wszystkie fakty źródłowe, a jego obrys
  pokrywa się z odrysowanym w 100 %) i Madera (jedyna elewacja 310 × 233 px nie rejestruje się do rzutu — opis nie
  przechodzi własnych kontroli).
- **Majeranek**: LOCAL ma zgodne wymiary i wysokość, ale garaż po złej stronie; obrysy pokrywają się w 80 %
  (próg 85 %) i opis zastępuje LOCAL.
- **Odtworzenie**: dwa niezależne odtworzenia z zapisanych odpowiedzi dały te same skróty modelu i te same bajty sceny
  na 9/9 domów.
- **Rejestracja elewacji**: 23 z 29 odczytanych elewacji zarejestrowane do rzutu; 6 nie (22192sl 3, Supertunie 2,
  Madera 1) — ich otwory i cechy są wstrzymane.

### 10.2 Ablacja na dwóch z góry wybranych domach DEV (Gracja, Aksamitki)

Ten sam oceniacz co w potwierdzeniu, wobec ręcznych referencji DEV (grupy zaliczone z 6):

| wariant | co dostaje budowa | Gracja | Aksamitki |
|---|---|---|---|
| A0 — LOCAL, baza | — | 0/6 | brak modelu (0/6) |
| A1 — LOCAL po poprawce wysokości | — | 0/6 | brak modelu (0/6) |
| D — tylko wymiary (model v3.54.3: LOCAL + skala od konsultanta) | korekta skali | 1/6 | 5/6 (bez formy dachu) |
| H-rzut — opis bez przekroju i elewacji | wymiary, obrys, bryły | 2/6 (metryka, wysokość) | 3/6 (metryka, wysokość, dach) |
| H — pełny opis | + poziomy, dachy, elewacje, otwory, cechy | **6/6** | **6/6** |
| M — ręczna specyfikacja | pełny opis, piksele czytane okiem | 6/6 | 6/6 |

Sama korekta wymiarów pomaga tam, gdzie LOCAL ma dobrą topologię (Aksamitki), i nie pomaga tam, gdzie jej nie ma
(Gracja). Pełny opis dochodzi do wyniku ręcznej specyfikacji na obu domach. Referencje DEV dla tych dwóch domów
powstały ręcznie po obejrzeniu wyników, więc ta tabela jest diagnostyką, nie dowodem transferu.

### 10.3 Regresja

- Zestaw testów repozytorium: te same niepowodzenia co na bazie, żadnego nowego (rozdział 13).
- Bez żetonu lub flagi host i skrypty idą wyłącznie ścieżką LOCAL; jedyna zmiana w LOCAL to odrzucenie znaku poziomu
  ponad opublikowaną wysokość budynku. Na 9 domach DEV zmienia ona wyłącznie Grację.
- Ścieżka konsultanta v3.54.3 nie została zmieniona.

### 10.4 Pierwszy wynik zamrożonego potwierdzenia (8 nowych rodzin) — zachowany, jaki jest

Zbiór, referencje, kod, prompt, schemat, model, limity, kryteria i oceniacz zapieczętowane przed uruchomieniem
(`stage-reports/artifacts/v3544/PROTOCOL_V3544.md`, `PROTOCOL.seal`; commit kodu `3c531aee`, pieczęć `d8bcb2b`).
Jeden przebieg, 34 zapytania, 1,563904 USD. Oceniacz uruchomiony raz.

| dom | LOCAL (A1) | H: wymiary × wys. | obrys i metryka | wysokości | dach | otwory zbudowane / odczytane | brakujące (kody) | przyjęty | koszt USD |
|---|---|---|---|---|---|---|---|---|---|
| c4-archon-lubczyku-2 | 15.93 × 8.68 m, szczyt +8.40 | 15.92 × 10.02 m, 8.87 m n.t. | 5/0 | 1/0 | main:GABLE, garage:GABLE, main-bay:FLAT | 5 / 6 | COMPILE_CONFLICT 2, SOURCE_UNKNOWN 1 | DESCRIBED · ocena LOCAL 2/6 → H 4/6 | 0.254 |
| c4-archon-frizeach-g2e | 19.49 × 13.50 m, szczyt +6.78 | 19.50 × 13.50 m, 7.1 m n.t. | 6/0 | 1/0 | main:GABLE, garage:FLAT | 10 / 15 | HELD_BY_DEPENDENCY 8, SOURCE_UNKNOWN 5, CAPABILITY_MISSING 3 | LOCAL · ocena LOCAL 5/6 → H 4/6 | 0.183 |
| c4-dobredomy-abakus | brak modelu (METRIC_RESOLUTION_INCONCLUSIVE) | 11.47 × 10.84 m, 6.81 m n.t. | 2/0 | 2/0 | main:GABLE | 9 / 14 | HELD_BY_DEPENDENCY 5, SOURCE_UNKNOWN 2, CAPABILITY_MISSING 1, PARSE_REJECTED 1, COMPILE_CONFLICT 1 | DESCRIBED · ocena LOCAL 0/6 → H 3/6 | 0.190 |
| c4-dobredomy-pallas | 16.54 × 10.41 m, szczyt +5.60 | 16.48 × 10.43 m, 8.42 m n.t. | 2/0 | 2/0 | main:GABLE, garage:GABLE | 3 / 3 | COMPILE_CONFLICT 1 | DESCRIBED · ocena LOCAL 0/6 → H 2/6 | 0.217 |
| c4-lipinscy-oslo | 8.55 × 7.05 m, szczyt +16.79 | 8.55 × 7.05 m, 7.09 m n.t. | 6/0 | 0/0 | main:GABLE | 8 / 9 | SOURCE_UNKNOWN 5, COMPILE_CONFLICT 3 | LOCAL · ocena LOCAL 4/6 → H 5/6 | 0.171 |
| c4-lipinscy-dublin | brak modelu (PLAN_LAYOUT_REJECTED) | 13.00 × 10.04 m, 9.21 m n.t. | 6/0 | 0/0 | main:GABLE, garage:GABLE | 15 / 16 | COMPILE_CONFLICT 1 | DESCRIBED · ocena LOCAL 0/6 → H 6/6 | 0.188 |
| c4-architecturaldesigns-51853hz | 22.47 × 19.43 m, szczyt +2.80 | NOT_RESOLVED | 1/1 | 0/0 | — | 0 / 22 | — | LOCAL · ocena LOCAL 1/6 → H 0/6 | 0.143 |
| c4-studioatrium-wena | 6.49 × 15.20 m, szczyt +5.60 | 8.80 × 11.20 m, 8.391 m n.t. | 6/0 | 2/0 | main:GABLE | 4 / 4 | SOURCE_UNKNOWN 2 | DESCRIBED · ocena LOCAL 1/6 → H 4/6 | 0.217 |

Oceniacz — grupy zaliczone (M = metryka, W = wysokość, D = dach, G = garaż, O = otwory, L = lukarny):

| dom | wydawca | LOCAL | opis (H) | przyjęty | model przyjęty | poprawiony | wierne zewnętrze |
|---|---|---|---|---|---|---|---|
| c4-archon-lubczyku-2 | archon.pl | 2/6 (W G) | 4/6 (M W D G) | opis | 4/6 | **tak** | nie |
| c4-archon-frizeach-g2e | archon.pl | 5/6 (M W G O L) | 4/6 (M W D L) | LOCAL | 5/6 | nie | nie |
| c4-dobredomy-abakus | dobredomy.pl | brak modelu | 3/6 (W D G) | opis | 3/6 | **tak** | nie |
| c4-dobredomy-pallas | dobredomy.pl | 0/6 | 2/6 (W D) | opis | 2/6 | **tak** | nie |
| c4-lipinscy-oslo | lipinscy.pl | 4/6 (M D G O) | 5/6 (M W D G O) | LOCAL | 4/6 | nie | nie |
| c4-lipinscy-dublin | lipinscy.pl | brak modelu | 6/6 | opis | 6/6 | **tak** | **tak** |
| c4-architecturaldesigns-51853hz | architecturaldesigns.com | 1/6 (M) | brak geometrii | LOCAL | 1/6 | nie | nie |
| c4-studioatrium-wena | studioatrium.pl | 1/6 (G) | 4/6 (M W D G) | opis | 4/6 | **tak** | nie |

**Transfer per wydawca (model przyjęty; mianownik = domy, dla których grupa ma odniesienie w referencji):**

| wydawca | domy | LOCAL bez modelu | przyjęty opis | poprawione | wierne zewnętrze | regresje krytyczne | METRIC | HEIGHT | ROOF | GARAGE | OPENINGS | DORMERS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| lipinscy.pl | 2 | 1 | 1 | 1 | 1 | 0 | 2/2 | 1/2 | 2/2 | 2/2 | 2/2 | 1/2 |
| www.architecturaldesigns.com | 1 | 0 | 0 | 0 | 0 | 0 | 1/1 | 0/1 | 0/1 | 0/1 | 0/1 | 0/1 |
| www.archon.pl | 2 | 0 | 1 | 1 | 0 | 0 | 2/2 | 2/2 | 1/2 | 2/2 | 1/2 | 1/2 |
| www.dobredomy.pl | 2 | 1 | 2 | 2 | 0 | 0 | 0/2 | 2/2 | 2/2 | 1/2 | 0/2 | 0/2 |
| www.studioatrium.pl | 1 | 0 | 1 | 1 | 0 | 0 | 1/1 | 1/1 | 1/1 | 1/1 | 0/1 | 0/1 |
| RAZEM | 8 | 2 | 5 | 5 | 1 | 0 | 6/8 | 6/8 | 6/8 | 6/8 | 3/8 | 2/8 |

**Wynik: poprawione 5 z 8 domów, u 4 wydawców, w tym 4 domy spoza ARCHON; regresji krytycznych 0; wierne
zewnętrze 1 z 8.** Próg OWNER-a jest spełniony. Kategorie: domy z garażem dobudowanym (Lubczyk, Pallas, Dublin,
Frizea, 51853hz) — poprawione 3 z 5; domy z lukarnami lub poddaszem (Lubczyk, Pallas, Oslo, Wena, 51853hz) —
poprawione 3 z 5; pojedyncza bryła (Oslo, Wena, Abakus) — poprawione 2 z 3; wykusz lub obrys L/T (Lubczyk, Frizea,
Abakus) — poprawione 2 z 3.

**Co się nie przeniosło i dlaczego (zmierzone na zapisanych odpowiedziach):**

1. **Niepełny odczyt elewacji — 3 domy z 8** (Lubczyk, Pallas, Wena): API opisało jedną z czterech wysłanych
   elewacji (odpowiedzi 2,6–5,1 tys. tokenów przy limicie 12 tys.; gramatyka ścisła nie wymusza liczby wpisów). Na DEV
   to się nie zdarzyło ani razu. Skutek: brak otworów na trzech stronach, 42 z 58 korekt z kontroli końcowej
   odrzucone jako `WRONG_BINDING` („elewacja, której nie odczytano").
2. **Rzut bez wymiarów — 3 domy**: Abakus i Pallas (skala szacowana z opublikowanej powierzchni; wymiary poza
   tolerancją) oraz 51853hz (bez wymiarów i bez powierzchni zabudowy — brak geometrii, zostaje LOCAL). W Pallas
   referencyjna głębokość 11,53 m obejmuje otwarty ganek (zapisane w referencji); LOCAL i opis zgodnie dają ok. 10,4 m.
3. **Lukarny — 2/8**: lukarna pulpitowa i „pudełkowa" (Oslo, Wena, 51853hz) nie mają budowniczego w tej kampanii;
   w Lubczyku zbudowana jedna z dwóch.
4. **Oslo**: LOCAL utrzymany mimo wysokości 17 m (ten sam błąd odczytu znaku poziomu co w Gracji; strona nie publikuje
   wysokości, więc ani poprawka LOCAL, ani decyzja nie miały faktu). Opis miał tu 5/6.
5. **Frizea**: elewacja frontowa nie zarejestrowała się (1,44 m rozrzutu końców ścian), brama garażowa wstrzymana;
   decyzja słusznie zostawiła LOCAL.

### 10.5 Po potwierdzeniu: jedna poprawka i jej pomiar (nie jest częścią potwierdzenia)

Po zapisaniu pierwszego wyniku dodano jedno uzupełnienie: elewacja wysłana i nieopisana jest dopytywana jeden raz,
sama z rzutem (`readFacades`, najwyżej jedno dodatkowe zapytanie). Uruchomione na trzech dotkniętych domach
z zachowanymi pierwszymi odpowiedziami (INVENTORY, PLAN, FACADES), 8 zapytań, 0,43392 USD:

| dom | pierwszy wynik (potwierdzenie) | po uzupełnieniu | otwory |
|---|---|---|---|
| c4-archon-lubczyku-2 | 4/6 | 5/6 | różnica 12 z 17 → 3 z 17 |
| c4-studioatrium-wena | 4/6 | 5/6 | różnica 11 z 15 → 0 z 15 |
| c4-dobredomy-pallas | 2/6 | 2/6 | bez zmiany (12 z 15) |

Te trzy domy przestały być nowe z chwilą obejrzenia wyniku, więc to pomiar DEV. Liczby potwierdzenia (5/8, 1/8)
pozostają pierwszym wynikiem; poprawka wymaga potwierdzenia na kolejnych nowych rodzinach.

## 11. Niezależna ocena sceny, błędne dodatki i niewspierane cechy

**Trzy niezależne spojrzenia na zbudowaną scenę:**

1. **Pomiar skompilowanej sceny** (`measureScene`): rozpiętość ścian zewnętrznych, szczyt dachu każdej bryły, wysokość
   nad terenem, liczby okien, drzwi i połaci, pudełka obiektów po identyfikatorach. Kontrole źródłowe dokumentu
   i testy porównują ze źródłem te pomiary, a nie pola wejściowe.
2. **Oceniacz względem referencji pisanych tylko ze źródeł** (`score.ts`) — rozdział 10.4. Nie wie, która ścieżka
   zbudowała model.
3. **Kontrola końcowej sceny przez API** (REVIEW): werdykt i różnice w ustalonej kolejności. W potwierdzeniu werdykt
   `DIFFERS` we wszystkich 7 domach z geometrią (na DEV `MATCHES` w jednym: Kukliki). Werdykt ten nie jest kryterium
   — służy do korekt i do listy braków.

**Korekty po budowie w potwierdzeniu (58 propozycji):**

| stan | kod | liczba |
|---|---|---|
| zastosowane | — | 6 |
| odrzucone | WRONG_BINDING (elewacja, której nie odczytano: 41; nieznany otwór: 1) | 42 |
| odrzucone | COMPILE_CONFLICT (przebudowany dom miałby więcej odmów lub otwór nachodzi na inny) | 6 |
| odrzucone | HELD_BY_DEPENDENCY | 2 |
| odrzucone | PARSE_REJECTED (cecha bez rodzaju, który ma budowniczego) | 2 |

Zastosowane:

| dom | runda | propozycja | stan | kod | funkcja (konsument) | skutek |
|---|---|---|---|---|---|---|
| c4-archon-lubczyku-2 | 1 | SET_FEATURE el-p11/front-balcony | APPLIED | — | resolveHouse/features → houseProgram/wallDormer|balcony|canopy | model 59373d0b38 → 2a7bd18ba6; failing checks 0 → 0; held or refused 7 → 7; meshes 40 → 44 |
| c4-archon-lubczyku-2 | 2 | SET_FEATURE el-p11/front-dormer | APPLIED | — | resolveHouse/features → houseProgram/wallDormer|balcony|canopy | model 2a7bd18ba6 → 2756aa0ec3; failing checks 0 → 0; held or refused 7 → 5; meshes 44 → 51 |
| c4-dobredomy-pallas | 1 | SET_FEATURE el-p3/balcony1 | APPLIED | — | resolveHouse/features → houseProgram/wallDormer|balcony|canopy | model cc72448b52 → b775baef01; failing checks 0 → 0; held or refused 2 → 2; meshes 26 → 30 |
| c4-dobredomy-pallas | 1 | SET_ROOF roof of garage | APPLIED | — | resolveHouse/roofs → houseProgram/roofPlanes | model b775baef01 → e302aefc24; failing checks 0 → 0; held or refused 2 → 2; meshes 30 → 30 |
| c4-studioatrium-wena | 1 | SET_FEATURE el-p3/bal1 | APPLIED | — | resolveHouse/features → houseProgram/wallDormer|balcony|canopy | model 8c89a3a1db → 767389a1c8; failing checks 0 → 0; held or refused 2 → 2; meshes 25 → 29 |
| c4-studioatrium-wena | 1 | SET_FEATURE el-p3/bal2 | APPLIED | — | resolveHouse/features → houseProgram/wallDormer|balcony|canopy | model 767389a1c8 → 95914623a9; failing checks 0 → 0; held or refused 2 → 2; meshes 29 → 33 |

Pełna lista: `stage-reports/artifacts/v3544/confirm-proposals.md`.

Zastosowane korekty to balkony, lukarna frontowa (Lubczyk) i forma dachu garażu (Pallas). Żadna zastosowana korekta
nie pogorszyła kontroli źródłowych ani nie zwiększyła liczby odmów — to warunek przyjęcia.

**Błędne dodatki** (obiekt w modelu, którego nie ma w referencji; model przyjęty, strony z opublikowaną elewacją):

| dom | nadmiarowe otwory | brakujące otwory | nadmiarowe / brakujące lukarny |
|---|---|---|---|
| Lubczyk (opis) | 0 | 12 | 0 / 1 |
| Frizea (LOCAL) | 0 | 1 | 0 / 0 |
| Abakus (opis) | 0 | 4 | 1 / 0 (szczyt poprzeczny wykusza zbudowany jako lukarna) |
| Pallas (opis) | 0 | 12 | 0 / 2 |
| Oslo (LOCAL) | 0 | 0 | 0 / 1 |
| Dublin (opis) | 0 | 0 | 0 / 0 |
| 51853hz (LOCAL) | 8 | 7 | 0 / 1 |
| Wena (opis) | 0 | 11 | 0 / 1 |

Modele z opisu nie dodały w potwierdzeniu żadnego otworu ponad referencję; ich błąd to braki, nie zmyślenia. Jedyny
błędny dodatek z opisu to lukarna w Abakusie. Nadmiarowe otwory ma model LOCAL (51853hz).

**Niewspierane cechy (nazwane w dokumencie, nie zbudowane):** lukarna pulpitowa i pudełkowa nadwieszona poza ścianę;
komin widziany tylko od strony szczytu; daszek nad wejściem bez strefy odrysowanej na rzucie; okno dachowe poza połacią
wyznaczoną przez odczytane rzędne; łuki i słupy podcienia pod dachem głównym; garaż płaski z attyką jako osobna forma;
wnętrze. W potwierdzeniu: 41 pozycji wstrzymanych — `SOURCE_UNKNOWN` 15, `HELD_BY_DEPENDENCY` 13, `COMPILE_CONFLICT` 8,
`CAPABILITY_MISSING` 4, `PARSE_REJECTED` 1; zbudowano łącznie 54 okna i drzwi.

## 12. Koszt, czas, pamięć, powtarzalność odtworzenia i wariancja odczytu na żywo

**Księga.** Stan na początku 9,963222 USD (134 zapytania); pułap 24,11036 USD narastająco. Stan na końcu
**14,453496 USD**; kampania v3.54.4: **4,490274 USD, 95 zapytań** (`research/ai-assist/spend-ledger-v3544.json`).
Księgi nie resetowano; historycznych szacunków S53 nie doliczano. Rezerwa 6 USD na potwierdzenie nie została
przekroczona (potwierdzenie 1,56 USD). Do pułapu pozostaje 9,656864 USD.

| faza | zapytania | tokeny wejścia | tokeny wyjścia | USD |
|---|---|---|---|---|
| próba wstępna (Gracja; pierwsze uruchomienie ≤ 2 USD) | 5 | 47 831 | 21 555 | 0,311212 |
| DEV (9 domów, w tym powtórzenia kroków po zmianach) | 36 | 276 068 | 95 605 | 1,508186 |
| host E2E (3 zadania z żetonem) | 12 | 107 651 | 45 775 | 0,673052 |
| potwierdzenie (8 domów, jeden przebieg) | 34 | 297 317 | 96 927 | 1,563904 |
| po potwierdzeniu (3 domy, uzupełnienie elewacji) | 8 | 74 605 | 28 471 | 0,433920 |
| **razem** | **95** | **803 472** | **288 333** | **4,490274** |

**Koszt i czas na dom** (pełny odczyt 4 kroki: inwentarz, rzut, elewacje, kontrola): 0,14–0,25 USD, 65–141 s odczytu
i budowy; dom bez elewacji (2 kroki): 0,05 USD, ok. 27 s. Na hoście razem z LOCAL: 150–315 s na zadanie. LOCAL sam:
85–206 s. Uzgodnienie, budowa, kompilacja i pomiar jednego domu: ok. 0,5 s.

**Pamięć.** Nie mierzono szczytu pamięci osobno; ścieżka opisu nie trzyma w pamięci nic poza zdekodowanymi obrazami
jednego domu (≤ 24) i jedną sceną. Host uruchamia zadanie w wątku roboczym jak dotąd.

**Powtarzalność odtworzenia.** Te same zapisane odpowiedzi → ten sam skrót modelu i te same bajty sceny: 9/9 domów
DEV w dwóch niezależnych odtworzeniach oraz 9/9 po przeniesieniu pętli budowy między pakietami. Odtworzenie odmawia
użycia odpowiedzi nagranej dla innych obrazów niż te z bieżącego zapytania.

**Wariancja odczytu na żywo** (niezależne płatne odczyty tych samych domów: przebieg DEV i zadanie hosta):

| dom | wymiary, bryły, kalenica | otwory uzgodnione | różnice |
|---|---|---|---|
| Gracja | identyczne (16,82 × 10,12; 3 bryły; +8,13) | 21 i 21 | balkony 3 i 2; wstrzymane 20 i 9 |
| Aksamitki | identyczne (13,22 × 8,82; 2 bryły; +8,37) | 17 i 17 | lukarna raz ścienna, raz na połaci (przed doprecyzowaniem opisu narzędzia) |
| Kukliki | identyczne (7,56 × 8,76; dach czterospadowy; +5,53) | 6 i 6 | wstrzymane 7 i 8 |

Metryka, bryły i wysokości są między odczytami stałe, bo pochodzą z liczb drukowanych i są sprawdzane; zmienność
dotyczy cech dachu i drobnych elementów. Wariancja w potwierdzeniu nie była mierzona (jeden przebieg z założenia);
niepełny odczyt elewacji w 3 z 8 domów pokazuje, że kompletność odpowiedzi też jest zmienna.

## 13. Testy na rewizjach, host, serializacja, APK/Android

**Testy nowe** — `packages/analysis-service/test/house-v3544.test.ts`, 25 testów, wszystkie przechodzą; żaden nie woła dostawcy (transporty są atrapami):

| grupa | co ustala |
|---|---|
| przyczyna (2) | znak poziomu ponad opublikowaną wysokość budynku nie jest wysokością budynku; bez dokładnie jednej opublikowanej wysokości nic nie jest odrzucane. Nie przechodzi na bazie `0d4a057` (funkcji nie ma), przechodzi po zmianie |
| poprawny opis buduje dom (6) | wymiary i wysokości w SKOMPILOWANEJ scenie; garaż, wykusz i obie lukarny w scenie po identyfikatorach; ten sam opis → ten sam skrót modelu; każdy parametr skonsumowany albo nazwany; decyzja względem LOCAL w obie strony; LOCAL o zgodnym prostokącie, ale bez bryły, jest zastępowany |
| negatywy (9) | opis innego domu; elewacja lustrzana (wstrzymane tylko to, co od niej zależy); brak metryki (brak geometrii); skala tylko z pola strony (oznaczona, przedmiar `NOT_USABLE`); fałszywy garaż na ganku; brak bryły mimo zgodnego prostokąta; wymiar bryły wzięty za wymiar całości; etykieta wymiaru w innym miejscu; niewspierany detal (nazwany, reszta zbudowana). W każdym z tych przypadków poprawny LOCAL zostaje |
| odczyt jest danymi (5) | przeliczenia liczb drukowanych; zła jednostka od czytelnika zapisana i nieprzyjęta; narzędzie ścisłe bez ograniczeń, których gramatyka nie niesie; błąd sieci ponawiany raz, potem nazwany (rezerwacja zostaje); bez klucza nic nie jest wysyłane i rezerwacja wraca — zero kosztu; odpowiedź ucięta lub niebędąca wywołaniem narzędzia (w tym tekst-polecenie) odrzucona |
| korekty po budowie (3) | korekta zostaje tylko, gdy przebudowany dom nie jest gorszy; zła strona odrzucona z kodem; dodany otwór wycięty i policzony w scenie; odpowiedź o nieaktualnej rewizji nie zmienia niczego (`STALE_DEPENDENCY`) |

**Pełny zestaw testów repozytorium** na commicie zamrożonym: 4058 testów przechodzi, 16 nie przechodzi, 11 pominiętych (349 plików). Niepowodzenia istniejące już na bazie
(te same pliki i testy co w v3.54.3: testy architektury wymagające historii spoza płytkiego klonu, kontrakty plików
referencyjnych, zrzut sceny starego solvera) pozostają; żadne nowe niepowodzenie nie pochodzi z tej kampanii. Dwa
testy architektury wykryły w trakcie pracy rzeczywiste naruszenia i zostały one naprawione w kodzie, nie w testach:
liczby domu DEV w komentarzach kodu produkcyjnego (usunięte) i budowanie modelu w pakiecie rekonstrukcji (pętla
budowy przeniesiona do `analysis-service`; pakiet rekonstrukcji nadal tylko emituje polecenia). Dwa testy workera
hosta przekroczyły limit czasu pod obciążeniem równoległymi przebiegami; uruchomione osobno przechodzą (3/3, 19 s).

**Testy, referencje i oceniacze zmienione w tej kampanii:**

| plik | zmiana | powód |
|---|---|---|
| `packages/analysis-service/test/house-v3544.test.ts` | nowy | testy tej kampanii |
| `research/source-to-model/v3544/score.ts` | nowy oceniacz | całe zewnętrze zamiast pojedynczej cechy; ta sama miara dla LOCAL i opisu; zamrożony przed potwierdzeniem |
| `research/source-to-model/v3544/refs-confirm/*` | nowe referencje (8) | zbiór potwierdzający; pisane przez osobnego agenta tylko ze źródeł, zapieczętowane przed uruchomieniem |
| referencje DEV dla Gracji i Aksamitek (prywatne, `refs-dev/`) | nowe, ręczne | tylko do ablacji na DEV; powstały po obejrzeniu wyników DEV i nie służą potwierdzeniu |
| testy, referencje i oceniacze v3.54.3 i wcześniejsze | bez zmian | historia nie jest przepisywana |

**Host (prawdziwy punkt wejścia).** Serwer zbudowany z `apps/analyzer-api` (`dist/server.mjs`), flaga
`ANALYZER_HOUSE_DESCRIPTION=pilot` z tym samym pułapem, księgą i żetonem dostępu co dotychczasowy czytnik.
Skrypt `research/source-to-model/v3544/host-e2e.mjs`: `POST /v1/analyses` → odpytywanie stanu → `GET` wyniku, sceny,
modelu i dokumentu domu. 42 kontrole, wszystkie zaliczone:

| zadanie | dom | wynik | czas | koszt | co sprawdzono |
|---|---|---|---|---|---|
| job-1 (z żetonem) | Gracja | opis zastąpił LOCAL (`ACCEPTED_DESCRIBED`) | 255 s | 0,269 USD, 4 zapytania | skrót sceny = skrót w podsumowaniu i w nagłówku; skrót modelu; scena wczytuje się ponownie; `house.json` podany, wczytany ponownie (13 kontroli zaliczonych, 0 nie), dwukrotny odczyt daje te same bajty; wynik mówi, że to model z opisu i dlaczego stoi |
| job-2 (z żetonem) | Aksamitki | LOCAL bez modelu → opis (`ACCEPTED_DESCRIBED`) | 315 s | 0,260 USD, 4 zapytania | jw. (12/0) |
| job-3 (z żetonem) | Kukliki | LOCAL utrzymany (`ACCEPTED_LOCAL`) | 150 s | 0,144 USD, 4 zapytania | podany model jest modelem LOCAL; `house.json` zapisany z decyzją |
| bez żetonu | Kukliki | ścieżka rysunków, bez opisu | 85 s | 0 USD, 0 zapytań | brak `house.json` (404), brak rezerwacji w księdze; ten sam skrót modelu co job-3 |

Serwer E2E zbudowano przed dwiema późniejszymi zmianami (korekta może zastąpić istniejący otwór; identyfikatory brył
ograniczone w gramatyce) — E2E potwierdza integrację, zapis i odczyt, nie jakość odczytu z tych zmian.

**Serializacja.** Dokument domu jest zapisywany i wczytywany przez ten sam walidator (`parseHouseDocument`); model
przechodzi `serializeModel` → `parseModel` → `compileBuilding` przed pomiarem; scena to `serializeBundle`. Skróty:
model (sha256 tekstu modelu) w dokumencie i w `summary.json`, scena w wyniku hosta. Odtworzenie z zapisanych odpowiedzi
daje te same skróty modelu i te same bajty sceny (9/9 domów DEV, dwa niezależne odtworzenia; ponownie 9/9 po
przeniesieniu pętli budowy między pakietami).

**APK / Android.** Aplikacja Android nie została zmieniona: nie pokazuje dokumentu domu ani decyzji. Nowego APK nie
budowano (numer wersji nadaje CI, a commity są `[skip ci]`; ostatni to 1339). **Android UI: NOT_VERIFIED.**

## 14. Ograniczenia i następne decyzje

**Ograniczenia tego wyniku:**

- Potwierdzenie to jeden przebieg na 8 domach; przedziały są szerokie. „Poprawione 5/8" opiera się na sześciu grupach
  kryteriów liczonych z modelu; oceniacz nie mierzy położenia każdego otworu ani wnętrza (lista ograniczeń zapisana
  w protokole przed wynikiem).
- Wierne zewnętrze: 1/8. Otwory (3/8) i lukarny (2/8) nie przenoszą się jeszcze na nowe domy.
- Rzuty bez wymiarów drukowanych: skala z opublikowanej powierzchni jest szacunkiem, a bez powierzchni opis nie daje
  geometrii.
- Decyzja względem LOCAL jest na poziomie całego domu (dwie różne reprezentacje), nie pojedynczego fragmentu, i zna
  tylko fakty: wymiary całkowite, opublikowaną wysokość, pole i położenie obrysu.
- Model z opisu to zewnętrze: bez wnętrza, bez materiałów; przedmiar z niego jest oznaczony `LIMITED` albo `NOT_USABLE`.
- Uzupełnienie brakujących elewacji (10.5) działa na DEV, nie jest potwierdzone na nowych domach.
- Host sprawdzony lokalnie; Android bez zmian.

**Najwyżej trzy następne decyzje:**

1. **Czy potwierdzić uzupełnienie elewacji na kolejnych 8 nowych rodzinach** (koszt ok. 1,6–2 USD z pozostałej puli
   9,66 USD) i przy okazji dodać do decyzji względem LOCAL znaki poziomów odczytane jako drukowane (przypadek Oslo)?
2. **Czy rozszerzyć budowniczego o lukarny pulpitowe i pudełkowe oraz daszki skośne** — to one odpowiadają za
   wynik 2/8 w lukarnach; wymaga to pracy w budowniczym, nie w odczycie.
3. **Czy pokazać dokument domu i decyzję w aplikacji** (nowy APK): dziś są dostępne tylko przez hosta i skrypty.
