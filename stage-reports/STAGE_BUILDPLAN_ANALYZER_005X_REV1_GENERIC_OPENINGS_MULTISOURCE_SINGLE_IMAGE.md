# STAGE BUILDPLAN-ANALYZER-005X-REV1 — UNIVERSAL OPENINGS + DOCUMENTATION OR ONE PICTURE

**Werdykt: faza A `PARTIAL_GENERIC_OPENINGS_ADOPTED`; faza B `ENGINE_ONLY`.** To nie jest akceptacja OWNER-a.
Bramka rozmiaru APK pozostaje czerwona.

| | |
| --- | --- |
| Baza | `e9b9e3ef3945c5d740eb7536a04b756146e32786` (005W-N1). HEAD potwierdzony, worktree czysty, brak dryfu. |
| Gałąź | `analyzer/005x-generic-openings-multisource-single-image-v1` (nowa; nie istniała gałąź ze starego 005X) |
| Nietknięte | `main`, mirror `claude/new-session-3kzcgh` (`bfaf286e…`), tagi, wydania, APK |
| Decyzja | DEC-UNIVERSAL-OPENING-CORE-003 v3.15.1: najpierw otwory, jedna reprezentacja, jedno zdjęcie na tych samych pojęciach |
| Ledger | `research/analyzer-005x-generic-openings/ledger.json` |
| Prywatne wejścia | zdjęcie OWNER-a (SHA-256 `11697dc9…`) i rastry wydawcy z cache, oglądane lokalnie. Nic z nich nie trafiło do repo. |

## Audyt trasy (z kodu)

`SourcePackage` → role dokumentów (`FLOOR_PLAN` / `ELEVATION` / `PERSPECTIVE_RENDER`). Perspektywa jest odrzucana po
nazwie przez czytniki fasad w `source-analyzer/analyze.ts` (bez zmian).

Dalej: metryka (pierścienie calloutów w `source-metrics`) → `reconstruct-v2` (`OpeningV2` na przerwę w ścianie,
`RooflightReading` na połać) → `BuildingV2` → `emitBuilding` (`cutOpening` / `cutRoofOpening` +
`placeWindow`/`placeDoor`/`placeRooflight`) → `fitOpeningsToHosts` → model → BuildWorld.

**Gdzie gubiliśmy okna dachowe.** Do tej pory okno dachowe istniało tylko wtedy, gdy render zarejestrowanego widoku
pokazał jasną łatę w płaszczyźnie dachu. Calloutów z rzutu w ogóle nie czytano. Czytnik pierścieni potrzebuje tuszu,
a te pierścienie to jasnoszara linia (~170) wokół papierowego dysku (~231) na tonowanym pasie ścianki kolankowej
(~210).

Skutek w A01:
- z 7 pierścieni rzutu nie odczytano żadnego;
- render frontu dał 2 okna;
- widok tyłu nie przechodzi kontroli ściany, więc z tyłu nie było żadnego;
- trzecie przednie okno leży pod znakiem wodnym.

## Faza A — wspólny odczyt otworów, okna dachowe najpierw z rzutu

**Zmiany:**
1. `source-metrics/callouts.ts: readTintedCallouts`. Znajduje callout narysowany jako blady pierścień na tonowanym
   polu i czyta go tym samym `readHalf`, co każdy callout. Kryteria:
   - okrąg ciemniejszy od dysku na ≥75% promieni i od pola na ≥40%;
   - cyfry nie dotykają okręgu;
   - jeśli odczyt kandydata się nie udaje, jego miejsce przechodzi na następnego.
2. `reconstruction/roof-details.ts: readPlanRooflights`. Spójny callout z belką, wewnątrz kondygnacji pod dachem
   dwuspadowym, o rozmiarze okna dachowego, staje się oknem dachowym:
   - leży na połaci, pod którą stoi;
   - wzdłuż kalenicy jest wyśrodkowany na calloucie;
   - długość z wydruku jest skrócona o kąt spadku;
   - położenie wzdłuż spadku pozostaje niepewnością.
3. `reconstruct-v2`: okna z rzutu mają pierwszeństwo.
   - Łata renderu na tej samej połaci, w tym samym odcinku kalenicy → `SOURCE_CORROBORATED`.
   - Bez potwierdzenia → `SOURCE_DERIVED`.
   - Łata, której rzut nie tłumaczy, zostaje jak dotąd (`IMAGE_METRIC_REGISTERED`).
   - Nigdzie nie ma `SOURCE_EXACT`.

**Iteracje czytnika pierścieni (7):**

| # | wynik | czas |
| --- | --- | --- |
| 1 | 1 z 7 | |
| 2 | 5 z 7 | 34 s |
| 4 | 7 z 7 | 458 s |
| 5 | 7 z 7 | 152 s |
| 6 (przyjęta) | 6 z 7, wszystkie odczytane `78/118` | 15 s |

Pierścień pod znakiem wodnym odpada na teście marginesu. Brak fałszywych odczytów spójnych.

**A01 (przed `fe1a61b6…` → po `1661d4bfad926948042cdab8997beafb741f7ebf2014c0f9132b5e75dc8448c9`):**

| okno dachowe | x [m] | z [m] | status | rzut | elewacja |
| --- | --- | --- | --- | --- | --- |
| przód 1 | 7,33–8,11 | 0,47–1,37 | `SOURCE_CORROBORATED` | 7,8 | 7,7 |
| przód 2 | 8,24–9,02 | 0,47–1,37 | `SOURCE_CORROBORATED` | 8,6 | 8,6 |
| tył 1 | 2,43–3,21 | 7,05–7,96 | `SOURCE_DERIVED` | 2,8 | 2,6–2,8 |
| tył 2 | 4,24–5,02 | 7,05–7,96 | `SOURCE_DERIVED` | 4,6 | 4,6 |
| tył 3 | 7,35–8,13 | 7,05–7,96 | `SOURCE_DERIVED` | 7,8 | 7,7 |
| tył 4 | 8,24–9,02 | 7,05–7,96 | `SOURCE_DERIVED` | 8,6 | 8,6 |

- **Liczba okien dachowych:** 2 → **6 z 7**. Brakujące to przednie przy x≈2,8: jego pierścień przecina znak wodny, a
  łata renderu zlewa się ze znakiem. Nie zostało dopisane.
- **Położenie wzdłuż spadku:** przednie okna przesunęły się z 0,27–0,92 (łata renderu, ~0,3 m za nisko) na
  0,47–1,37 (wyśrodkowane na calloucie).
- **Tylne okna** opierają się o okap, bo głębokość modelu to 8,008 m, a wydruk podaje 8,30. Tego tu nie zmieniałem.
- **Bez zmian:** front, 4 okna szczytowe, 3 kominy, kalenica X, 40°, jedna bryła. Różnią się wyłącznie
  `roofOpenings`/`rooflights` i ich dowody.

**Kontrole (offline replay, SHA-256):**

| dom | wynik |
| --- | --- |
| Goździkowce | `911456a8…` **identyczny**; garaż nr 8, ściana 0,303 i brama 3,22 bez zmian |
| Marcówki | `cf797743…` identyczny |
| Cieszynianki | `e4e56292…` identyczny |
| Rarytasy G2E | `9f5fd342…` identyczny |
| Rarytasy OWNER `m3ea…` | `NOT_RUN` (brak wejścia, bez podmiany na G2E) |

**Uniwersalność:**
- Na trzech pozostałych domach z poddaszem nic się nie zmieniło: brak pierścieni tego stylu albo brak spójnych
  odczytów. To kontrola fałszywych trafień, a nie dowód zasięgu.
- Testy syntetyczne:
  - pierścień na tonowanym pasie i arkusz bez pierścieni;
  - okna dachowe na obu połaciach;
  - odrzucenie calloutu ściennego poza kondygnacją, odczytu niespójnego, calloutu bez belki i rozmiaru nie-okna.
- **Nieprzetestowane:** dach wielospadowy, obrócony arkusz.

## Faza B — jedno zdjęcie, te same pojęcia (`ENGINE_ONLY`)

**Silnik:** `packages/reconstruction/src/single-image/single-image.ts`, w całości deterministyczne CV w pakietach
aplikacji. Bez modelu wizyjnego i bez sieci; zdalnego „vision runtime" w tym przepływie nie ma.

`readSingleImage`:
1. maska nieba;
2. kolor dachu z pasa pod niebem, odcień dachu również pod drzewami;
3. dach trwa od nieba do pierwszego ciągu jasnych neutralnych pikseli (podbitka);
4. kolejne linie okapu (RANSAC) → segmenty frontu (skrzydło, korpus, wykusz);
5. podstawa ściany jako linia przez najniższe punkty w odcinkach — rośliny tylko podnoszą widoczny dół;
6. płaszczyzna ściany z kamerą otworkową: X = c·H/h, Z = f·H/h, z założoną ogniskową i wysokością kondygnacji;
7. otwory: piksele wyraźnie ciemniejsze od lokalnej jasności ściany (2D) albo „ruchliwe" (szprosy, odbicia), dalej
   otwarcie morfologiczne, łączenie szyb i łączenie kawałków jeden nad drugim. Typ: do podłogi → drzwi lub brama,
   wyżej → okno;
8. okna dachowe: jasne łaty otoczone pokryciem.

`buildingFromSingleImage` buduje **ten sam `BuildingV2`**:
- bryła na segment;
- dach główny i dachy dobudów przez `attachedGableLayout`;
- `OpeningV2` na ścianach frontowych, `RooflightReading` na połaci przedniej.

Dalej `emitBuilding` → `fitOpeningsToHosts` → `buildCandidateModel`. Model nazywa się
**`MODEL ORIENTACYJNY Z 1 ZDJĘCIA`**.
- Otwory mają status `ASSUMED_FOR_RENDERING` (skala założona), a typ `VISUAL_SEMANTIC`.
- Dach, głębokość, boki i tył to hipoteza bez otworów i bez pomieszczeń. Nic nie trafia do przedmiaru.

Uruchomienie end-to-end poza UI: `research/analyzer-005x-generic-openings/single-image.ts` (plik → analiza → model →
render BuildWorld). Aplikacja nie ma jeszcze wejścia „jedno zdjęcie", stąd `ENGINE_ONLY`, a nie `APP_READY`.

**Zdjęcie OWNER-a** (wejście `11697dc9…`, model `8b42664fbce47de0c72171c50ac95d3a318671a83fc9f9f69a477977ff094a77`):
- 3 segmenty: skrzydło nad garażem, korpus, wykusz. Zamknięta, obracalna bryła; `geometry ok`.
- Otwory:
  - okno korpusu — trafione;
  - okno wykusza — trafione;
  - wejście — odczytane jako wysokie przeszklenie 0,5–2,3 m; szklane części są połączone, prawdziwe drzwi sięgają
    posadzki za schodami;
  - **1 fałszywy** wąski otwór przy zacienionej krawędzi bramy.
- Pominięte:
  - brama garażowa (jasnoszara, tylko ~20% ciemniejsza od ściany);
  - łukowe okno lukarny (nad okapem);
  - okna lewego skrzydła za kolumnami i autem.
- Okna dachowe: 2 z 3 widocznych. Trzecie stoi nad wykuszem, poza dachem głównym.
- Dach jest uproszczony do dwuspadowych wzdłuż frontu (w rzeczywistości kopertowy z lukarną).

**Drugi, inny dom:** prywatna wizualizacja wydawcy A01, model `d72986f8…`. Wynik **słaby**: okap dopasowany do białego
pasa tynku pod prawdziwym okapem, 2 małe otwory z ~6 widocznych, brak okien dachowych (białe ramki na szarym dachu).
Drugiego legalnego zdjęcia realnego domu nie było: `SECOND_REAL_PHOTO_NOT_TESTED`. Zamiast niego jest syntetyczny dom
w teście (3 otwory w kolejności, drzwi do posadzki, okna podobnej szerokości mimo perspektywy, odmowa przy obrazie bez
domu).

Iteracje fazy B: 7, w tym odrzucone:
- dach wyznaczany odległością koloru;
- otwory jako ciemniejsze od całej kolumny (zacieniona ściana stawała się jednym otworem);
- próg 0,8.

## Rendery (BuildWorld web, Three.js, SwiftShader)

Paczka leży poza repo: `/home/user/work005x/005x-renders.zip` (47 plików, SHA-256
`9f9c95c41421588e6d3611415309693fa61c5ac5bf1dba5876421d1afcd7d9e5`). Zawiera:
- A01 przed/po: przód (niezmiennik), tył, lewy i prawy szczyt, z góry z dachem (obie połacie), ¾;
- Goździkowce (kontrola);
- modele z dwóch zdjęć: ¾, przód, bok, góra, plus zestawienia.

Zdjęć ani rysunków wydawcy w paczce nie ma. Porównanie źródło/model zostało tylko prywatnie.

## Testy

| bramka | wynik |
| --- | --- |
| `packages/reconstruction` + `packages/source-metrics/test` | 72 pliki, 1194/1195. Jedyny fail to znana bramka APK (39 556 682 B > 32 MB). |
| nowy `generic-openings-005x.test.ts` | 7/7 |
| `tests/architecture` | 341/343: bramka APK oraz test DSL (naprawiony — model ze zdjęcia przez `buildCandidateModel`), po poprawce 31/31 w `reconstruction.test.ts` |
| `tsc -p tsconfig.json` | czysto |
| CI 41 jobów, APK, emulator, e2e | `NOT_RUN` |

## Zmienione ścieżki

- `packages/source-metrics/src/callouts.ts` (`readTintedCallouts`)
- `packages/reconstruction/src/v2/roof-details.ts` (`readPlanRooflights`)
- `packages/reconstruction/src/v2/reconstruct-v2.ts` (okna dachowe z rzutu, potwierdzenie renderem)
- `packages/reconstruction/src/single-image/single-image.ts` (nowy), `packages/reconstruction/src/index.ts`
- `packages/reconstruction/test/generic-openings-005x.test.ts` (nowy)
- `research/analyzer-005x-generic-openings/single-image.ts` (CLI, wyjście poza repo), ledger, ten raport,
  `PROJECT_STATUS.md`

## Otwarte

- A01: przednie okno dachowe przy x≈2,8 (znak wodny).
- Faza B:
  - brama garażowa i jasne drzwi;
  - lukarny i okna nad okapem;
  - dach kopertowy;
  - wejście w aplikacji (dziś `ENGINE_ONLY`);
  - fałszywe otwory przy zacienionych krawędziach;
  - słaby wynik na wizualizacji z białym pasem pod okapem.
- Głębokość A01 (8,008 wobec 8,30) — osobna decyzja.

Nie uruchamiam kolejnego zlecenia bez oceny OWNER-a. STOP.
