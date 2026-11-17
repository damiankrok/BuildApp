# SOURCE → MODEL v3.54.8 — zgodność parametrów API z finalną geometrią

Zlecenie: `BuildPlan_Prompt_Fable_v3.54.8_Parametry_API_Do_Geometrii.md`. Master Plan v3.54.8 nie został dołączony;
`docs/MASTER_PLAN.md` zaktualizowano do v3.54.8 z treści promptu i to zaznaczono w jego nagłówku.
Gałąź `claude/new-session-3kzcgh`. Rewizje:

| rewizja | co |
|---|---|
| `65d8a06` | baza: ostatnia dostawa v3.54.7 (raport); finalny host v3.54.7 zbudowany z `59d115e` |
| `86fd69f` | v3.54.8: kontrakt 0.4.0, konsumenci (balustrada, nogi, płyta ramy, pas portalu, okap), granica danych, recenzja per własność, dziennik rund, miary, tablice; pierwszy host E2E |
| `05faa4e` | v3.54.8: pas portalu tylko nad otwartym frontem, poprawny hash wejścia rundy, prawdziwy komunikat jakości przy odrzuconym opisie; **finalny host E2E** |
| (ten commit) | raport, indeks, status, ADR, hand-off, wyniki |

Wersje: dokument domu 0.4.0 (czyta 0.1.0–0.3.0), kontrakt odczytu `reading-0.4.0`, resolver 0.5.0, builder 0.4.0,
ścieżka domu 0.4.0, schemat modelu 1.7.0 (addytywna rola `WallPanel.GABLE_FRAME`, patrz rozdz. 10).

## 1. Odpowiedzi wprost (Marcówki GE)

| pytanie | odpowiedź | dowód |
|---|---|---|
| Czy szkło dotarło do modelu jako szkło? | **Tak** — na odczycie live (`READ`), na odtworzeniach L1 i hosta (`NOTE` z notatki odpowiedzi), w obu hostach v3.54.8. Baza `65d8a06`: BARS (twardy `infill: 'BARS'` w programie). | szczegółowa miara: `front/rear railing infill` GLASS; kontrola `facade-values-built` PASS |
| Czy końce nóg mają właściwe wysokości? | **Tak na L1 i live**: lewa 0,00 (zwrot do gruntu), prawa +3,06 (na płycie loggii; własny wiersz odczytu 392 px się zgadza), tył 0/0. Baza: obie 4,85 (nóg nie było). Odtworzenie hosta v3.54.7 (H2): prawa noga **zatrzymana** `SOURCE_UNKNOWN` — tamten odczyt kładzie balkon w x 3,35–5,22, pod nogą nie ma podparcia. | rozdz. 3, tabela A |
| Czy rama jest ciągła? | **Tak**: jedna płyta w płaszczyźnie czoła (`createWallPanel` rola `GABLE_FRAME`), styk w kalenicy ciągły, 0,00 m ponad dach, wierzchołek w osi (3,95 / 8,10 m). Baza: dwa elementy okapowe krzyżujące się w kalenicy, wierzchołek przesunięty o 0,48 m. | `frame joint at the ridge`; tablica zbliżeń |
| Czy pas portalu jest zbudowany? | **Tak, gdy odczyt go podaje** (od kontraktu 0.4.0 pole `PORTAL_BAND`): live L1 — pas 3,24–11,31 m, podsufitka 2,27, góra pod płytą 2,86 / nad bramą 3,05, przy wypuście garażu lico ściany; ciągłość 31/33 próbek. Odtworzenia starych odpowiedzi go nie mają (pola nie było w kontrakcie). | `front band continuity` |
| Czy loggia ma pełny zasięg? | **Tak**: płyta 3,24–7,91 m (źródło 3,25–7,90), przedłużona pod prawą nogę ramy, balustrada kończy się na licu nogi. Baza: 3,25–7,22 m. | `front slab full extent` |
| Czy głowice odpowiadają źródłu? | **Częściowo**. Builder buduje dokładnie odczytane wiersze; odczyt jest za nisko: front 6,08→4,22 (źródło 6,26→4,02), tył po recenzji 5,85→4,18 (6,09→4,13). Pierwsza strata: **odczyt** (wiersz 212 zamiast ~206 px, recenzja 227 zamiast ~216 px). Tylna szyba salonu 2,37 (2,30) w tolerancji. | rozdz. 3, tabela A |
| Czy recenzja usunęła zgłoszoną usterkę? | **Tak, dla zgłoszonej**: live runda 1 — „brak skośnych przeszkleń z tyłu” → dwie poprawki głowic `APPLIED` i `IMPROVED` w każdej własności (lewy/prawy koniec), sąsiedzi zachowani, runda 2 `MATCHES`. Głowice nadal 0,24 m niżej niż źródło: recenzent podał swoje wiersze, poprawka zrealizowała dokładnie je. | rozdz. 4, tabela B |

Model oddany użytkownikowi na Marcówkach to nadal **LOCAL** (27/27 szczegółowo, 16/16 historycznie): H po recenzji
ma 21/27, więc wybór słusznie trzyma LOCAL. Naprawa H **nie** jest tym samym co utrzymanie LOCAL i jest raportowana osobno.

## 2. Start i stan bazowy (§1)

Przeczytano: CLAUDE.md, AGENT_PROTOCOL.md, PROJECT_STATUS.md, SOURCE_TO_MODEL_V3547.md, README_V3547.md, HANDOFF v3547.
Dane: zapisane odpowiedzi L1 (`v3547/mk/L1`, odczyt v3.54.7 na `c973a6a`), finalny host v3.54.7 (zadanie hosta z
`59d115e`, jego zaakceptowane rekordy jako odpowiedzi „H2”), LOCAL (`v3546/marcowki/LOCAL`), prawda źródłowa
`research/marcowki-v2/marcowki-source-truth-v2.json` (zapieczętowana, ta sama co w v3.54.7). Wyniki v3.54.7 są
historyczne: LOCAL 16/16, H L1 13/16, finalny host 11/16. **Ograniczenie starej miary**: rama była oceniana tylko
zasięgiem i głębokością; wypełnienie balustrady, końce nóg, szerokość pasa, styk w kalenicy, pas portalu (podsufitka
liczona na krawędzi płaskiego dachu garażu) nie wchodziły do wyniku — model z prętami zamiast szkła i nogami w
powietrzu miał 13/16.

Każdy przebieg poniżej nazywa rewizję kodu i zestaw odpowiedzi: L1/H2 = zapisane odpowiedzi, `@65d8a06` = baza,
`@05faa4e` = kod finalny, LIVE1 = świeży odczyt v3.54.8 (FACADES i REVIEW na żywo; INVENTORY i PLAN z L1).

## 3. Ślad parametrów (§2) — pierwsza strata

Odtworzenie bez kosztu na `65d8a06` (B-L1, B-H2) i na kodzie finalnym; każda wartość prześledzona od odpowiedzi do
pomiaru skompilowanej sceny tą samą linijką (`measureScene` → `sides`). Skala elewacji frontu ≈ 0,0169 m/px.

**Tabela A — element / parametr → pierwsza strata (L1 i LIVE1, przód chyba że zaznaczono)**

| element / parametr | źródło / region | surowa odpowiedź | pole typowane | wartość uzgodniona | wartość programu | pomiar geometrii | decyzja | pierwsza strata (baza) |
|---|---|---|---|---|---|---|---|---|
| wypełnienie balustrady | el-p12 balkon 567–802 × 342–392 | L1: tylko notatka „glass railing”; LIVE1: `railing: GLASS` | `railing` + `railingFrom` READ/NOTE | `railingInfill` GLASS (READ / NOTE) | `createRailing infill GLASS`, materiał szkło | GLASS przód i tył | przyjęte | `houseProgram` — stałe `infill: 'BARS'`; notatka nie miała pola |
| wysokość balustrady | ten sam | LIVE1 `railingTopY` 342 | `railingTopY` | 0,831 m DERIVED | 0,831 | góra +3,89 (źródło 3,93; wysokość w źródle UNRESOLVED) | przyjęte, nieoceniane | domyślne 1,10 bez nazwy |
| lewa noga ramy | el-p12 375–841 × 101–577 | L1: `legBottomY` 575 (jeden wiersz dla obu); LIVE1: `legLeftBottomY` 577 | `legLeftBottomY` | −0,07 DERIVED | 0,00 (zwrot `w-main-ret-0` pod nią) | 0,00 | przyjęte | resolver — jeden `legBottomY`; program nie budował nóg (zwroty jako ściany do dachu) |
| prawa noga ramy | ten sam | LIVE1: `legRightBottomY` 392 | `legRightBottomY` | +3,048 DERIVED | +3,06 (na płycie `balcony-front-2`, własny wiersz zgodny) + `FRAME_LEG_ON_SLAB` | +3,06 | przyjęte | j.w.; H2: `SOURCE_UNKNOWN` (balkon odczytany poza nogą) |
| pas ramy (pion) | ten sam | L1 58 px, LIVE1 55 px (tył 57) | `bandPx` + `bandMPerPx` | 0,927 m (55 × 0,01685) | 0,927 | 0,927 pion / 0,71 prostopadle | przyjęte; **za szeroki o 0,11** | **odczyt** (źródło 48–49 px); podstawienie 49 px → 0,828 / 0,634 |
| styk w kalenicy | ten sam | — | płyta z punktami załamania na przecięciach połaci | — | jedna płyta, dach cofnięty o głębokość ramy − 0,01 | ciągły, 0,00 ponad dach, w osi | — | program — dwa `VERGE_BOARD` krzyżujące się |
| pas portalu | el-p12 567–1090 × 392–438 | LIVE1 `PORTAL_BAND` | `portals[]` top/soffit/depth | 3,048 / 2,273 / 0,961 (głębokość zwrotów) | `createLinearSolid FASCIA` ×2 (pod płytą 2,27–2,86; nad bramą 2,27–3,05; brak w ścianie wypustu) | ciągły 31/33 | przyjęte | **kontrakt** — pola nie było (odczyt nie miał gdzie go podać) |
| zasięg płyty loggii | el-p12 + rzut | L1 box 567–802 | `balconies[].rect` | 3,236–7,196 | przedłużona pod nogę do 7,908 | 3,24–7,91 | przyjęte | program — płyta przycięta do pudełka, noga na niej nie istniała |
| głowica front (2 końce) | el-p12 o4 | 212 / 340 | `headLeftY/RightY` | RAKED, 6,08 / 4,22 | `cutOpening head RAKED` | 6,08 / 4,22 | przyjęte; źródło 6,26 / 4,02 | **odczyt** (~6 px) |
| głowice tył | el-p10 o2/o3 | FACADES 200/340 → nad ścianą, niewycięte; recenzja 227/337 | j.w. | 5,85 / 4,18 | wycięte po recenzji | 5,85 / 4,18 | przyjęte po recenzji | **odczyt** FACADES (za wysoko → `HELD_BY_DEPENDENCY`), potem recenzja ~11 px za nisko |
| okap boczny | rzut/elewacja | brak | `overhangM` DEFAULT 0,5 | 0,5 DEFAULT | 0 przy ramie na szczycie + `EAVES_FLUSH_WITH_FRAME` | brak „skrzydeł” poza ramą | — | program — domyślny okap wystawał poza narożnik ramy (widoczne tylko na tablicy) |

**Podstawienia diagnostyczne (MANUAL_DIAGNOSTIC)** — `research/source-to-model/v3548/diag-substitute.ts` przez
publiczne `compileHouse`, każda zmienia jeden parametr obserwacji L1 wartością z zapieczętowanej prawdy (piksele
elewacji); `results/diag-patch-*.json`. Wynik szczegółowy (27 wierszy): bez podstawienia 16; nogi 16; pas 49 px 22;
pas portalu 17; wiersz balustrady 16; wszystko 23. Automatyczny wynik przechodzi przez ten sam adapter z prawdziwych
odpowiedzi (LIVE1: 21/27) — podstawienie dowodzi konsumenta, nie zastępuje odczytu.

**Determinizm**: każda para odtworzeń tej samej odpowiedzi na kodzie finalnym daje ten sam `modelHash`
(L1 `7742e7bc…`, H2 `8b2c307e…`, LIVE1 `1e20fb73…`).

## 4. Kontrakt i konsumenci (§3)

- **Balustrada**: `railing` (GLASS/BARS/SOLID/NONE, pole nieobowiązkowe — nieznane zostaje nieznane), `railingTopY`;
  notatki odpowiedzi przechodzą jawnie (`railingFrom: NOTE`, wzorce `RAILING_NOTE_PATTERNS`; „szkło za balustradą”
  nic nie mówi); w geometrii `railingInfill` {value, basis READ/NOTE/DEFAULT/UNKNOWN} i `railingHeightM`. Nieznane →
  pręty jako konwencja kernela **nazwana** (`RAILING_INFILL_ASSUMED`), nigdy zapisana jako odczyt. SOLID → bez
  wypełnienia i nazwane. Kontrprzykład z prętami zostaje prętami (test).
- **Rama**: jedna płyta w płaszczyźnie czoła — górny kontur po połaciach (punkty na przecięciach), dolny = kontur
  wewnętrzny (góra − pas pionowy) albo noga do swojej podstawy; nogi niezależne: zwrot pod nogą → grunt; własny wiersz
  odczytu; płyta sięgająca nogi → jej góra (płyta przedłużona, balustrada do lica nogi); dach niższej bryły; inaczej
  `SOURCE_UNKNOWN`. Wiersz na lub nad konturem wewnętrznym → `WRONG_READ`, nogi nie ma. Pas: `bandPx` × m/px pionowo,
  linijka mierzy też prostopadle (× cos spadku). Dach kończy się 1 cm przed tyłem ramy (brak dwóch powierzchni w
  jednym miejscu). Okap domyślny przy ramie = 0, nazwane.
- **Portal**: `PORTAL_BAND` (top, soffit, głębokość ze zwrotów albo 0,30 DEFAULT); odrzucony, gdy płytszy niż 0,1 m
  lub podsufitka < 1,8 m; pas tylko nad otwartym frontem — pod płytą balkonu i pod płaskim dachem kończy się na ich
  spodzie tylko tam, gdzie przykrywają jego ślad; w ścianie rzutu (wypust) nie ma pasa.
- **Granica danych** (§3.4): kontrola `facade-values-built` — każda przyjęta wartość wypełnienia, końca nogi i pasa
  portalu jest w scenie jak uzgodniono albo zatrzymana z powodem; inaczej FAIL i blokada ilości. Wykryła w trakcie
  prac dwa realne rozjazdy (noga mierzona na pasie portalu pod nią; wiersz nogi ponad pasem deklarowany jako nogą).
  Na finalnym hoście: PASS (7 i 8 wartości).
- **Gramatyka narzędzia**: zapis odpowiedzi ma teraz `toolVariant`. FACADES i REVIEW odpowiedziały jako
  `FULL_NON_STRICT` (pełny schemat odrzucany jako zbyt duży w trybie strict — obejście z v3.54.7; odpowiedź trzyma
  konwerter). Pierwsza próba live została odrzucona przez dostawcę **przed rozliczeniem** (0 USD): `enum` z `null` przy
  typie `['string','null']`; poprawione, plus test-strażnik wszystkich schematów. Schemat dopytania używa tych samych pól
  co FACADES (spójność schematu i wykonawcy). Format nie ograniczał zdolności odczytu nowych pól: live podał je wszystkie.

## 5. Recenzja (§4)

- Widoki: para źródło/render dla każdej strony w ramie elewacji, cztery strony, widok z góry z czterema ukośnymi,
  a od v3.54.8 w pierwszej rundzie **zbliżenie ramy** każdej elewacji, która ją czyta (źródło i model w tej samej ramie).
  Tekst dla recenzenta podaje zbudowane własności fasady (pas, końce nóg, styk, balustrady, pasy portalu).
- **APPLIED vs IMPROVED**: `checkProperties` mierzy każdą własność, którą poprawka ustawia (pas, każda noga, obecność
  ramy, wypełnienie i góra balustrady, oba końce głowicy) przed i po; poprawka bez poprawy żadnej mierzalnej własności →
  `NO_IMPROVEMENT`. Ochrona sąsiadów: poprawka cechy lub głowicy nie może zgubić ani przesunąć otworu innej strony
  (`NEIGHBOUR_CHANGED`); zysk otworów (np. po przypisaniu strony elewacji) nie jest stratą — pierwsza wersja reguły
  błędnie odrzuciła `SET_ELEVATION_SIDE` na Wenie, wykryte regresją i poprawione.
- `MEASURED_PRESENT` liczy się teraz jako otwarte w statusie jakości (potwierdza tylko istnienie).
- **Dziennik rund**: model wejściowy (sprzed poprawek), rewizja bazowa, hashe źródeł i renderów, werdykt, rewizja z
  odpowiedzi, zastosowane, rewizja i model wyjściowe.

**Tabela B — uwagi recenzji LIVE1 (przegląd na `05faa4e`, odtworzenie odpowiedzi live)**

| runda | uwaga | operacja | baseRevision | efekt geometryczny | ponowny pomiar | stan w modelu |
|---|---|---|---|---|---|---|
| 1 | REAR GLAZING_SHAPE MISSING (KEY) | SET_OPENING_HEAD el-p10/o3 | bd4f08fc1080 | wycięte skośne przeszklenie | lewy 4,18 / prawy 5,85 vs cel recenzenta 4,00 / 5,87 → IMPROVED | APPLIED, IMPROVED |
| 1 | j.w. | SET_OPENING_HEAD el-p10/o4 | bd4f08fc1080 | j.w. (lustrzane) | 5,85 / 4,18 → IMPROVED | APPLIED, IMPROVED |
| 1 | LEFT OTHER (ciemny panel) | — | — | — | — | UNRESOLVED (kolor, nie geometria) |
| 1 | RIGHT ROOF (dwa ciemne pudełka na połaci) | — | — | — | — | UNRESOLVED |
| 2 | — | MATCHES | f03f8b06a682 | — | — | — |

Dziennik (na `05faa4e`): runda 1 model `5113e7ca` → `1e20fb73`, rewizja `bd4f08fc1080` → `f03f8b06a682`; runda 2
model `1e20fb73`, odpowiedź o tej samej rewizji, `stale: false`, nic nie zastosowano.

**STALE_DEPENDENCY — zbadane**. W świeżym przebiegu (LIVE1) obie rundy odpowiadają o rewizji, którą wysłano — brak
błędu zarządzania rewizją. Wszystkie `STALE_DEPENDENCY` w tym etapie to **stare odpowiedzi**: (a) odtworzenie L1 na
`65d8a06` — runda 2 nagrana na innym kodzie (`c973a6a`), więc runda 1 dała inną rewizję; (b) od kontraktu 0.4.0
obserwacje tych samych odpowiedzi zyskują pole balustrady z notatki, rewizja jest inna i zapisane odpowiedzi recenzji
(L1, H2, Pallas, Kardamon) są odrzucane jako starsze od domu. Dziennik mówi to wprost
(„a recorded answer about revision … replayed against …: the answer is older than this house”).

## 6. Miary (§5)

Tolerancje ustalone w `marcowki-detail.py` przed porównaniem: pas 0,10 m, wysokości 0,15 m, wzdłuż 0,15 m, styk
0,05 m, portal ≥ 90 % próbek. Wysokość balustrady jest w prawdzie `UNRESOLVED` → wiersz raportowany z błędem surowym,
nieoceniany. **Dowód na usterkach** (`--faults`, na LOCAL): pręty zamiast szkła, rama z dobrym zasięgiem i złym pasem,
narożnik ponad kalenicą, brak pasa nad portalem — każdy wiersz zmienia OK → NO.

**Tabela C — wzorzec źródła vs LOCAL / H PRZED / H PO / decyzja hosta** (szczegółowo z 27; historycznie z 16, bez przepisywania historii)

| model | rewizja kodu | szczegółowo | historycznie 16 |
|---|---|---|---|
| LOCAL | — | 27/27 | 16/16 |
| H L1 (baza) | 65d8a06 | 8/27 | 13/16 |
| H L1 | 05faa4e | 16/27 | 14/16 |
| H host v3.54.7 (H2, baza) | 65d8a06 | 5/27 | 11/16 |
| H H2 | 05faa4e | 17/27 | 11/16 |
| H LIVE1 przed recenzją | 05faa4e | 19/27 | 13/16 |
| **H LIVE1 po recenzji** | 05faa4e | **21/27** | **15/16** |
| podstawienie diagnostyczne (wszystkie) | 05faa4e | 23/27 | 14/16 |
| H host (świeży odczyt) | 86fd69f | 18/27 | 4/16 |
| H host (świeży odczyt) | 05faa4e | 17/27 | 11/16 |
| oddany na hoście (LOCAL) | 86fd69f / 05faa4e | 27/27 | 16/16 |

Historycznie H LIVE1 traci tylko „podsufitkę portalu” — stara definicja mierzy ją na krawędzi płaskiego dachu
garażu, nie na pasie; szczegółowo pas jest ciągły (31/33). Na H2 rama ma 1,40 m głębokości (zwrot z rzutu hosta),
loggia wystaje 0,68 m — to odczyt hosta, nie builder. Kryteria są te same dla kandydatów i dla modelu oddanego.

## 7. Próby i testy (§6)

- `packages/analysis-service/test/house-v3548.test.ts` (23): utrata GLASS, notatka NOTE, kontrprzykład BARS, nieznane
  jako konwencja, wzorce notatek, wysokość z wiersza vs DEFAULT, niezależne nogi vs jeden wiersz ESTIMATED, pas pion ×
  cos, jedna płyta i styk w kalenicy, noga bez podparcia zatrzymana, wiersz nogi nad pasem `WRONG_READ`, noga na płycie
  (przedłużenie, balustrada do lica), pas portalu, pas nie wchodzi w ścianę rzutu, pas odrzucony przy niskiej
  podsufitce, balkon odsunięty od ściany, własności poprawki (dobra rama vs dobry zasięg/zły pas), balustrada IMPROVED
  tylko przy szkle, sąsiedzi (strata vs zysk), odrzucenie starej odpowiedzi z dziennikiem, dziennik rundy z dwoma
  hashami, strażnik schematów narzędzi, status jakości przy odrzuconym opisie. Testy v3.54.7 (36) zaktualizowane
  świadomie (płyta zamiast dwóch `VERGE_BOARD`, części nieodczytane nie liczą się jako konflikt).
- Typecheck zielony. Pełna macierz (`vitest run`, na kodzie z trakcie zmian): 15 niepowodzeń w 8 plikach — wszystkie z
  listy znanych środowiskowych v3.54.7 (tam 17/9); dotknięte pakiety na kodzie finalnym `05faa4e`: wszystkie testy
  pakietów zielone, 13 niepowodzeń wyłącznie w tych samych testach architektury zależnych od środowiska (brak bazy
  005Q w klonie, rozmiary plików, sekret w środowisku).
- **Regresja** (15 przypadków na zapisanych odpowiedziach, `results/regression-v3547-vs-v3548.txt`): żadna decyzja
  się nie zmieniła; 14 identycznych w liczbach; Pallas — zapisana recenzja odrzucona jako stara (bez poprawki dachu
  garażu z v3.54.7, +2 zatrzymane okna połaciowe); Kardamon i Alaska — inny hash przy tych samych liczbach (stara
  recenzja; okap równo z ramą na Alasce). Alaska: ostre przeszklenie zachowane. Pliszka: obie szerokości garażu jak w
  v3.54.7 (bez zmian w decyzji i liczbach). Lubczyk: bez zmian. Anodach, Oslo, Tracja: bez zmian.
- Świeża próba poza znanymi domami **nie** została wykonana — znane domy są DEV; to ograniczenie dowodu.

## 8. Host (normalna ścieżka)

Finalny host zbudowany z `05faa4e`, `research/source-to-model/v3548/host-e2e.mjs`: **ALL CHECKS PASSED**.
Zadanie 1 (z tokenem): 8 żądań, 0,39478 USD, 355 s; opis odrzucony przez własną kontrolę („głębokość obrysu wobec
drukowanego 1260: 13,52 m”) → `DESCRIBED_REJECTED_LOCAL_KEPT`, oddany LOCAL, `QUALITY_FEATURES_NOT_CHECKED` z prawdziwym
powodem; granica danych PASS (7 wartości); dokument 0.4.0, analizator 2.45.0. Zadanie 2: ponowne użycie zaakceptowanej
rewizji, 0 żądań, ten sam model i status. Bez tokenu: ścieżka rysunków, 0 żądań, brak dokumentu domu. Zapis/odczyt
sceny i modelu sprawdzony hashami. Pierwszy host (`86fd69f`) też przeszedł (PLAN odczytał dwie skale osi → LOCAL);
różnica komunikatu jakości była powodem poprawki w `05faa4e`. Świeży odczyt PLAN na hoście jest dziś głównym źródłem
odrzucenia opisu — poza zakresem tego etapu, nazwane.

## 9. Koszt (§7)

Księgi przed etapem 22,047354 z 24,11036 USD (rezerwacje sprawdzone: żadna otwarta). Etap: **0,890574 USD, 15 żądań**
(`research/ai-assist/spend-ledger-v3548.json`): nowy odczyt Marcówek LIVE1 0,212382 (FACADES + 2 × REVIEW), kontrola
host `86fd69f` 0,283412, kontrola host `05faa4e` 0,39478; rozwój 0 (wszystko offline na zapisanych odpowiedziach);
odrzucona przez dostawcę próba 0 USD. Księgi po etapie **22,937928 USD**; nominalnie zostaje 1,172432 USD (w rezerwie).
Projektowe 100 USD nie zmieniło pułapu. Klucz: istniejący sekret, nie w rozmowie, Gicie ani paczce (skan przed każdym commitem).

## 10. Granice nazwane

- Pas ramy odczytany 55–57 px przy źródle 48–49 px; głowice 6–11 px za nisko — granica **odczytu**; podstawienie
  dowodzi, że konsumenci są gotowi.
- Komin: odczytany, `SOURCE_UNKNOWN` (położenie wzdłuż budynku nieznane z widoku szczytowego) — bez zmian.
- Zapisane odpowiedzi recenzji sprzed kontraktu 0.4.0 są stare; odtworzenia nie pokazują już efektu tamtych poprawek.
- Rola `GABLE_FRAME` w `WallPanel` jest addytywna przy schemacie 1.7.0 (precedens: pole `onRiser` bez podbicia);
  starszy czytnik nie wczyta modelu z ramą — scena mobilna mapuje ją na `FACADE_FRAME` i Androida nie dotyczy.
- Okap równo z ramą obowiązuje tylko, gdy okap nie jest odczytany (DEFAULT); odczytany okap zostaje.
- Prywatny benchmark H2 i zbiór OWNER-a poza zakresem; ForgeShape tylko do odczytu; pilot domyślnie wyłączony;
  Android/APK — własna weryfikacja, nie budowane w tym etapie.

## 11. Artefakty

- Kod: `packages/reconstruction/src/house/{document,resolve,program}.ts`, `packages/analysis-service/src/house/{read,describe,measure,review,link}.ts`, `packages/model/src/schema.ts`, `packages/mobile-scene/src/semantics.ts`.
- Narzędzia: `research/source-to-model/v3548/` (`house-run.ts`, `diag-substitute.ts`, `measure-features.ts`,
  `marcowki-detail.py`, `marcowki-features.py`, `board-frames.ts`, `make-board.py`, `make-closeups.py`,
  `board-oblique.ts`, `host-e2e.mjs`, `book-host.ts`), wyniki w `results/`.
- Prywatna paczka `BuildPlan-V3548-Private.zip` (poza Gitem): odpowiedzi surowe i sparsowane, obserwacje, modele,
  sceny, ślady parametrów i operacji, tablice (cztery strony; zbliżenia ramy, styku, obu nóg, balustrady, portalu,
  tylnych przeszkleń; widok ukośny), księga, manifest z hashami.
