# BUILDPLAN-ANALYZER-005Y-N3 — wspólne prymitywy: narożniki, otwory, dach/ściana, schody, kominy, rejestracja elewacji

**Status: PARTIAL_SOURCE_GROUNDED · OWNER_VISUAL_PENDING · STOP.**
Nie deklaruję ALL_GREEN ani OWNER_ACCEPTED — ocena zrzutów należy do OWNER-a. Bez APK, bez wydania, bez CI 41 zadań,
bez emulatora, bez scalania. Projekt OWNER m3ea: **NOT_RUN** (brak wejścia; nie podstawiany pod Rarytasy DEV m84f).

| | |
|---|---|
| Repozytorium | `damiankrok/BuildApp` |
| BASE | `e1806e014eff62fcf80b6199cb1ff1bce89cd2db` (005Y-N2) |
| Gałąź | `analyzer/005y-n3-cross-house-architectural-primitives-v1` |
| HEAD kodu | `3c20c5c` (+ `86ee908` aktualizacja testu 005W); HEAD gałęzi — commit z tym raportem |
| Lustro `claude/new-session-3kzcgh` | nietknięte: `bfaf286e95105c2cdb32df2d298d3cd93bd43449` |
| Domy | A01 (jarzmianki), Goździkowce 3, Marcówki (GE), Cieszynianki 12 (GE), Rarytasy 5 (G2E) DEV m84f |
| Analogi ARCHON | Dom w trytomach (G), Dom w melisie ver. 2, Dom w arganiach (G2E), Dom w sasankach 3 (G) — pełna ścieżka produkcyjna, źródła prywatnie |

Wszystkie zmiany są ogólne: bez nazw projektów, identyfikatorów `m…`, współrzędnych czy liczb okien w kodzie. Każda
reguła była najpierw sprawdzona na co najmniej jednym innym domu niż ten, na którym OWNER zauważył objaw, i odtworzona
na pięciu domach + trzech analogach przed przyjęciem. Dwie hipotezy odrzucono (rozdz. 4).

## 1. Co zmieniono

1. **H2 — trójkąt pod okapem przy ramie szczytowej.** `packages/geometry/src/compile.ts` (`wallTopFunction`,
   `FOLLOW_ROOF`), `wall-compiler.ts`. Lico ściany stojącej za ramą szczytową (członek `verge` o głębokości podcienia)
   leżało dokładnie na wewnętrznej krawędzi pasa ramy; `inStrip` (`roof-compiler.ts:135`) ma granice domknięte, więc
   lico zewnętrzne brało spód ramy (3,843 m), a wewnętrzne spód połaci (4,270 m): wierzch ściany opadał w poprzek jej
   grubości i z boku otwierała się trójkątna dziura między stopką ramy a okapem. Teraz wierzch czyta się mikrometr
   w głąb materiału ściany tam, gdzie spód skacze; gdzie indziej bez zmian (liczba trójkątów identyczna w A01,
   Goździkowcach, Cieszyniankach, Rarytasach). Złamania ściany bliższe niż 1 µm to jedno złamanie, a wierzch w obrębie
   1 µm od poziomu nadproża to ten poziom (bez tego nadproże okna szczytowego dotykające wierzchu dawało drzazgi).
   Test `frame-boundary-wall-005y-n3` (pada bez poprawki).
2. **H1 — konwencja drzwi parteru tylko dla pustej szczeliny.** `openings-v2.ts`. Szczelina bez odczytanej wysokości,
   na szerokość drzwi, na parterze, była drzwiami „z konwencji”, gdy nie było ciemnego symbolu szkła — jasnych linii
   ramy i szyby (`glazingLinesDrawn`) nie sprawdzano. Teraz oba symbole wykluczają drzwi z konwencji. Świadoma zmiana
   decyzji 005W (test `elevation-opening-extent` zaktualizowany z uzasadnieniem).
3. **H1 — zespół narożny.** `cornerAssemblies` (`openings-v2.ts`), `OpeningV2.cornerWith`, `emit.ts`. Dwa otwory
   w prostopadłych ścianach tej samej bryły i kondygnacji, kończące się przy wspólnym narożniku (≤ grubość ściany +
   rama), gdy rzut nie rysuje w kwadracie narożnika filaru (< 35 % atramentu ściany), to jedno przeszklenie narożne:
   relacja `ALIGNS_WITH` z notą `CORNER_GLAZING`, trace `CORNER_ASSEMBLY`. Geometria bez zmian — model wymaga
   materiału ściany przy krawędzi otworu (`OPENING_TOUCHES_WALL_EDGE`), więc kwadrat narożnika zostaje słupkiem;
   nazwane jako luka. Rodzaj i wysokości każdego kawałka zostają z jego własnych dowodów.
4. **H4 — dach, przez który przechodzi komin.** `hostRoofTopAt` (`roof-details.ts`) w `reconstruct-v2.ts`. Odczyt
   komina zaczynał skan renderu od profilu dachu głównego; blok pod połacią garażu (dolina, gdzie dach garażu wchodzi
   na połać główną) był skanowany od złej wysokości i odrzucany. Teraz od najwyższej połaci pokrywającej blok (dach
   główny w obrysie, połacie dachów brył dołączonych w obrysach, płaskie dachy), a bez pokrycia — jak dawniej.
   `emit.ts`: komin przecina pionowo połać dołączoną, która go zawiera; komin, który rzut rysuje w głąb ściany
   zewnętrznej, dostaje relację `OVERLAPS_INTENTIONALLY` z tą ścianą (z głębokością w nocie).
5. **H5 — wspólne nadproże przy słabym odczycie.** `commonHeadReading` (`openings-v2.ts`). Wysokość z kratownicy
   (recogniser nie potwierdził: pewność < 0,9), której pierwszy odczyt nie jest żadną wysokością odczytaną pewnie na
   tej kondygnacji, a drugi lub trzeci jest — przyjmuje tę wspólną wysokość (`SOURCE_DERIVED`, oba odczyty nazwane).
6. **H5 — widok zawieszony od złego wiersza.** `viewGroundRefusals` (`openings-v2.ts`). Widok zarejestrowany po
   sylwetce od datum kalenicy, którego grunt odbiega > 0,3 m od terenu z przekroju (bez terenu: od skupiska widoków,
   które przewyższa liczebnie; remis nie rozstrzyga), nie jest czytany dla wysokości otworów. Obrys dachu i kominy —
   blisko datum — nadal z niego są.

Narzędzia badawcze (bez wpływu na produkt): `research/analyzer-005y-n3-architectural-primitives/isolate.ts`
(dowolna kamera, izolacja po `objectId`/części, przekrój, sonda trójkątów), `closure-detail.ts`, `mesh-counts.ts`.

## 2. Macierz

Hash: pierwsze 16 znaków SHA-256 `model.json`. „Przed” = finał 005Y-N2 (zgodny z hashami ze zlecenia), „po” =
przebieg produkcyjny na HEAD kodu (źródło → graf → metryki + PaddleOCR → model → scena), identyczny z replayem.

| Dom | przed | po | czas | maks. przerwa heartbeat | okna dach. | kominy | domknięcie przed → po |
|---|---|---|---|---|---|---|---|
| A01 | `2ebcf05b9bdb3120` | `d67a026f8cf93dff` | 374 s | 2,27 s | 6 → 6 | 3 → 3 | GAP 50, INTERSECTION 2 → **0**, COPLANAR 4 |
| Goździkowce 3 | `869774d095b76fcb` | `b0eb6d82ae56b327` | 326 s | 1,89 s | 7 → 7 | 1 → 1 | GAP 66 → 66 |
| Marcówki | `124e5abc5e6959d8` | `124e5abc5e6959d8` | 306 s | 2,93 s | 3 → 3 | 2 → 2 | GAP 35, INTERSECTION 7 (bez zmian; scena zmieniona przez H2) |
| Cieszynianki 12 | `2ac1ed37c1af60c0` | `4de216ed46550423` | 201 s | 2,19 s | 0 → 0 | 2 → 2 | GAP 24, INTERSECTION 2, COPLANAR 2 (bez zmian) |
| Rarytasy 5 DEV | `3f0f71833f035914` | `f6886fd278755ee5` | 274 s | 1,97 s | 0 → 0 | 1 → **2** | GAP 19 → 19 |

NON_MANIFOLD 0 i diagnostyki kompilacji 0 we wszystkich pięciu domach przed i po. Żadnej nowej luki ani przecięcia;
dachy (rodzaje, połacie) bez zmian. Analogi (replay solvera na zapieczętowanych dowodach): Arganie bez zmiany
(`34a95a766d169f39`), Trytomy `a7e7a410…` → `65fa9c73…` (H1), Sasanki 3 `bad67c17…` → `b75c613a…` (tylko zapis
odmowy widoku — otwory identyczne). Melisa 2: odmowa rzutu `PLAN_NO_WALLED_ENVELOPE` (NOT_RUN dla klasy H3).

## 3. Objawy

Format: dom / widok / obiekt · dowód źródła · analog · FIRST_BAD · kontrfakt · poprawka · wpływ · regresje · luka.

**H2 — Marcówki, 5-34 / 6-34 / 3-lewa / 4-prawa, `ring-main-1-w0`, `ring-main-1-w2` przy `verge-min-z/max-z`.**
Źródło: oba szczyty mają ramę podcienia; ściana szczytowa stoi za ramą, pod połacią. Analog: każdy szczyt z ramą
głęboką jak strefa przed ścianą (test syntetyczny). FIRST_BAD: `roof-compiler.ts:135` (granice `inStrip`) czytane
w `compile.ts:91`. Kontrfakt: ten sam `model.json`, poprawiony kompilator — wierzch lica 3,843 → 4,270 m przy x 7,9,
dziura się zamyka, 132 trójkąty mniej tylko na dwóch ścianach szczytowych. Wpływ: brak trójkąta na obu szczytach
(`_zblizenia/H2-*`). Regresje: brak (liczby trójkątów per siatka identyczne w pozostałych domach). Luka: jasna linia
spodu ramy wzdłuż połaci istniała wcześniej. **FIXED_SOURCE_GROUNDED.**

**H1 — Goździkowce, 3-lewa / 5-34, `opening-0-west-3-1`.** Źródło: narożne okno kuchni 260/140 + 110/140 na cienkich
liniach, bez filaru. Analog: Trytomy (narożne 157/230 + 277/230 — kawałek frontowy był DOOR), Cieszynianki (ściana
wschodnia, łazienka i kotłownia 90/150 jako DOOR). FIRST_BAD: `openings-v2.ts:527` (baza). Kontrfakt: Goździkowce
west-3-1 DOOR→WINDOW; Cieszynianki east-1-1, east-1-2 DOOR→WINDOW; Trytomy front-0-3 DOOR→WINDOW; reszta bez zmian.
Regresje: fragment 0,68 m francuskiego okna 150/210 na poddaszu Trytomów DOOR→WINDOW — błędny przed i po (szczeliny
pocięte, callouty nieodczytane), neutralne. Luka: wysokości kawałków narożnych zostają założone (callouty 260/140,
110/140, 200/150, 120/150 nieodczytane). **FIXED_SOURCE_GROUNDED.**

**H1 — zespół narożny: A01, Goździkowce, Cieszynianki (+ Trytomy).** Źródło: A01 250/220 + 118/220, Goździkowce
260/140 + 110/140, Cieszynianki 200/150 + 120/150 — wszystkie wokół narożnika na liniach, bez filaru. FIRST_BAD: brak
reprezentacji „jedno szkło w dwóch ścianach”. Kontrfakt: 4 zespoły, wszystkie potwierdzone na rzutach; żaden przy
narożniku z filarem. Luka: słupek kwadratu narożnika zostaje (niezmiennik modelu); decyzja schematu potrzebna, by go
nie było. Goździkowce: 70/210 na boku wnęki i 105/210 na jej ścianie tylnej to nadal dwa byty — 70/210 niezbudowane
(bez zmian od N2). **PARTIAL_SOURCE_GROUNDED.**

**H4 — Rarytasy, 1-przod / 3-lewa / 5-34 / 7-gora, `chimney-1`.** Źródło: elewacja frontowa i boczna rysują dwa
kominy — kominkowy (~3,8 m od tyłu) i drugi przy ścianie frontowej przy styku z garażem (~6,2 m od lewej, ~7,9 m od
tyłu); rzut ma oba bloki. Analog: Arganie i Trytomy też tracą kominy, ale z innej przyczyny (żaden widok boczny nie
jest zarejestrowany: `viewsTried []`); Sasanki 3 — komin stoi przy wierzchołku szczytu głównego, **nie** nad garażem
(hipoteza zlecenia się nie potwierdza). FIRST_BAD: `reconstruct-v2.ts:1424` (baza) — `roofTopY` znał tylko dach
główny. Kontrfakt: blok (5,75–6,66; 6,62–7,06) READ na lewym widoku, wierzch 5,67 m (frontowa elewacja w swojej skali:
5,55 m). Wpływ: kominy 1 → 2, przecięty pionowo w połaci garażu, relacja ze ścianą frontową (blok rysowany 0,07 m
w ścianę). Przy okazji A01: 2 dawne przecięcia komin–ściana to blok rysowany równo z licem (1 cm) — stwierdzone
relacją, INTERSECTION 2 → 0. Luka: kominy odrzucane z braku zarejestrowanego widoku (Arganie 2, Trytomy 2).
**FIXED_SOURCE_GROUNDED.**

**H5 — Rarytasy, 2-tyl / 6-34, `opening-0-rear-2-0` (przeszklenie „do dachu”).** Źródło: rzut drukuje 230/230.
Odczyt: 290 (0,68) przed 230 (0,65), sama kratownica. FIRST_BAD: `openings-v2.ts:421` (baza). Kontrfakt:
`commonHeadReading` 290 → 230 (wysokość, którą recogniser odczytał pewnie na oknach 120/230 ściany wschodniej);
nic innego w pięciu domach ani analogach się nie zmienia. Wpływ: nadproże 2,90 → 2,30 m. Luka: brama garażu
Marcówek 275/275 (źródło 275/225) — 225 nie jest pewnym nadprożem tej kondygnacji, zostaje.
**FIXED_SOURCE_GROUNDED.**

**H5 — Rarytasy, 3-lewa / 4-prawa, `opening-0-west-7-0` (okno „za wysoko”).** Źródło: elewacja boczna — parapety okna
garażu i okna szczytu ~1,0 m nad terenem; model 1,48 m. FIRST_BAD: `reconstruct-v2.ts:592` (baza) — rejestracja
sylwetki od datum kalenicy zawieszona na wierszu, który nie jest kalenicą (wąski wierzchołek szczytu): grunt +0,46 /
+0,20 m przy terenie −0,32 m; test gruntu z N2 (`:627`) obejmował tylko widoki pasmowe. Analog: Sasanki 3 (czapa
komina nad kalenicą = wierzch sylwetki) — odmowa tak samo, otwory bez zmian; A01 widok lewy — odmowa bez skutku.
Kontrfakt: parapet 1,48 → 0,80 m (drukowane 100/140, konwencja 2,2). Regresja: fantomowy pas 421/71 przesuwa się
w górę (0,59 → 1,49) — fantom przed i po. Luka: sam widok boczny nadal źle zarejestrowany dla otworów; fantom 421/71.
**PARTIAL_SOURCE_GROUNDED.**

**H5/H1 — Rarytasy, 1-przod, `opening-0-front-0-1` („wąskie okno zamiast drzwi”).** Źródło: drzwi wejściowe 105/210,
skrzydło i łuk otwierane na zewnątrz. FIRST_BAD: `openings-v2.ts:609` (baza) — `doorSwingDrawn` patrzy tylko do
wnętrza, `doorLeafDrawn` nie rozpoznaje tego symbolu. Próba: łuk od zewnątrz — Rarytasy bez zmian, a kawałek narożny
A01 118/220 stał się DOOR → **odrzucona**. **UNRESOLVED.**

**H3 — Marcówki, 8-gora-bez-dachu / przekrój x 6,9, schody.** Źródło: pokój 5 i schowek „**” leżą pod górnymi
biegami (linie przerywane nad płaszczyzną cięcia); otwór w stropie istnieje — źródło **nie** wymaga pustki
dwukondygnacyjnej. Wszystkie 7 przecięć Marcówek to te schody: (1) spocznik po pierwszym biegu ułożony jako kwadrat
szerokości biegu wchodzi 0,30 m w ścianę wschodnią (0,436 m³) — `stair-topology.ts`; (2) ścianki pod biegiem
emitowane na pełną wysokość kondygnacji — model nie ma profilu wierzchu podążającego za podniebieniem schodów; też
oba kominy i strop. Analog Melisa 2 — odmowa rzutu, NOT_RUN. Bez poprawki: wymaga układu biegów po stronie
rekonstrukcji albo nowego profilu w kontrakcie modelu. **UNRESOLVED (nazwane, nie zakryte).**

## 4. Odrzucone eksperymenty

- Łuk drzwi od zewnętrznej strony ściany — patrz wyżej (fałszywie pozytywny na A01).
- Mediana gruntu dla widoków z sylwetki — remis 2:2 na Rarytasach odrzucił też poprawne widoki front/tył; zastąpione
  terenem z przekroju i skupiskiem, które musi przewyższać liczebnie.
- Wydłużenie kawałków narożnych do lica narożnika — model odrzuca (`OPENING_TOUCHES_WALL_EDGE`); nie obchodzę
  niezmiennika.

## 5. Analogi ARCHON

| Analog | Klasa | Tożsamość (ręcznie, ze źródła) | FIRST_BAD obecnego algorytmu | Bramka |
|---|---|---|---|---|
| Trytomy (G) | CORNER_GLAZING | 157/230 + 277/230 wokół narożnika, skrzydło drzwi na końcu boku | kawałek frontowy DOOR z konwencji; oba kończą się 0,38 m przed narożnikiem; callouty nieodczytane | DOOR→WINDOW, relacja znaleziona |
| Melisa 2 | STAIR_VOID | — | odmowa rzutu (`PLAN_NO_WALLED_ENVELOPE`) | NOT_RUN |
| Arganie (G2E) | CHIMNEY / SIDELIGHT | 2 kominy na połaci głównej; drzwi z naświetlem | bloki odrzucone bez widoku (`viewsTried []`) | kontrola regresji: bez zmian |
| Sasanki 3 (G) | CHIMNEY / VIEW REG. | komin przy wierzchołku szczytu, nie nad garażem; czapa nad kalenicą | sylwetka od czapy komina, grunt +0,24/+0,27 vs −0,57 | odmowa widoku dla otworów, otwory bez zmian |

Źródła analogów pobrane wyłącznie do katalogu poza repozytorium; wycinki tylko w prywatnym ZIP.

## 6. Testy i bramki

- `vitest run packages/reconstruction packages/geometry packages/model packages/source-metrics`: przed aktualizacją
  testu 005W 98/99 plików, 1343/1345 testów (dwa oczekiwania 005W, świadomie zmienione); po aktualizacji
  `elevation-opening-extent` 11/11, nowe: `cross-house-primitives-005y-n3` 13/13, `frame-boundary-wall-005y-n3` 3/3,
  pakiet geometry 103/103; `tsc -p tsconfig.json` czysto.
- Replay = produkcja co do hasha we wszystkich pięciu domach; debug (FEATURE_DEBUG) nie zmienia hashy.
- Bez 41 zadań CI, APK, wydania i emulatora.

## 7. Dostarczone

- `renders-005y-n3.zip` — 5 domów × 8 widoków (`1-przod` … `8-gora-bez-dachu`) przed/po/porównanie, plus
  `_zblizenia/` (H1–H5: narożniki, szczyt bez dachu, schody z góry/izometria/przekrój, kominy w dolinie, okna).
- `models-005y-n3.zip` — `model.json` przed/po dla pięciu domów + analogi (przed/po replay) + odmowa Melisy 2.
- `debug-005y-n3-PRIVATE.zip` — wycinki rzutów i elewacji ARCHON, izolacje, featureTrace (prywatne, nie publikować).
- `research/analyzer-005y-n3-architectural-primitives/ledger.json` (generowany skryptem).

STOP. OWNER_VISUAL_PENDING.
