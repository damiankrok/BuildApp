# STAGE BUILDPLAN-ANALYZER-005X-N1 — jedno zdjęcie: dachy, bryły i otwory

Data: 2026-10-20. Prompt: `PROMPT_CLAUDE_BUILDPLAN_ANALYZER_005X_N1_UNIVERSAL_PHOTO_ROOF_OPENINGS_VISUAL_ISSUED_v3.16.0`.
Ledger: `research/analyzer-005x-n1-photo/ledger.json`.

## Werdykty (osobno)

| Werdykt | Wynik |
|---|---|
| Otwory ogólne (faza A 005X) | **GENERAL_OPENINGS_PRESERVED** — A01: 6/7 okien dachowych, 7. `UNRESOLVED`; wszystkie pięć kontroli bajt w bajt jak w 005X |
| Zdjęcie | **PHOTO_VISUAL_IMPROVED** na obu obrazach rozwojowych. Uogólnienie na nieznane domy **nie zostało wykazane**: hold-out 0/4 użytecznych modeli. |
| Aplikacja | **APP_READY dla BuildWorld web**: przycisk „Photo…”, ten sam runtime, dekodowanie w przeglądarce. Aplikacja Android nie jest podłączona: tam **ENGINE_ONLY**. |
| OWNER | **OWNER_VISUAL_PENDING** — brak akceptacji OWNER-a |

## Gałąź, baza i mirror

- **Gałąź:** `analyzer/005x-n1-universal-photo-roof-openings-v1`.
- **Baza:** `7626403c5fe288ce8a2b4d28015aa93fbc10a982`. Przed zmianami HEAD potwierdzony, drzewo czyste.
- **Mirror:** `claude/new-session-3kzcgh` @ `bfaf286e95105c2cdb32df2d298d3cd93bd43449` — nieprzełączany i niezmieniony.
- Nie było pushy na `main`, mirror ani do release'ów.

## Co zmieniono

### 1. Dach z własnych połaci: krok uogólnialny

Nowy moduł `v2/plane-roof.ts`, funkcja `planeRoofLayout`.

- Dach nad jedną bryłą składa się z dwóch połaci wzdłuż kalenicy.
- Każdy koniec kalenicy to `GABLE` albo `HIP`. Daje to dach dwuspadowy, półszczytowy albo kopertowy.
- Gdy bryła jest krótsza niż głęboka, powstaje piramida.
- `BuildingV2.planeRoofs` (opcjonalne) emituje dach przez istniejące `createRoofPlane`, `connectRoofPlanes` (RIDGE/HIP) i `createRoofEdge` (EAVE/VERGE).
- Ściany schodzą pod połacie przez `FOLLOW_ROOF_PLANES`.
- Okna dachowe mogą być cięte w dowolnej połaci przez `planeId`.
- `PitchedAttachedRoofV2.joinRoofId` pozwala, by kosze dachu dołączonego wchodziły w połać dachu z połaci, a nie tylko w `roof-main`.
- Ścieżka rysunkowa niczego z tego nie używa, więc kontrole są bajt w bajt.

### 2. Czytnik jednego zdjęcia (`single-image.ts`)

Wszystko jest deterministyczne. Nie ma modelu zdalnego, nazw domów, URL-i ani haszy.

#### Pokrycie i okap

- **Kolor pokrycia:** wybierany jako najliczniejsze sąsiedztwo przedziałów kolorów. W 005X na A01 odczytano chmurę jako dach.
- **Koniec szarego pokrycia:** wyznacza go zmiana odcienia na kilka wierszy (ściana w cieniu okapu). Okap A01 jest teraz przy rynnie, a nie pod białym pasem.
- **Odcinki okapu:**
  - współliniowe odcinki łączone są w jedną ścianę: jedna prosta przez punkty obu musi trzymać co najmniej 70 % każdego;
  - odcinek bez neutralnej ściany pod spodem jest odrzucany (pergola, chmura);
  - przerwa w odcinku może mieć do 2,5 % szerokości obrazu.

#### Typ dachu

- Każdy koniec każdej bryły dostaje jedno z rozstrzygnięć: `PLATEAU`, `RAMP`, `GABLE_FACE`, `PARTY` lub `SYMMETRY`.
- **Symetria:** sama rampa przy drugim końcu pokazującym szczyt rozstrzyga na szczyt. Daleki wiatrownicowy szczyt widziany ukośnie wygląda jak koperta.
- **Głębokość:** przy kopercie liczona z przebiegu narożnika (pół głębokości przy jednym spadku).

#### Szczyty

- Ściana wznosząca się nad okap w odwróconym V to szczyt.
- Szczyt wewnątrz frontu to `CROSS` (lukarna lub wystawka). Szczyt poza końcem frontu to `END`.
- Szczyt `CROSS` staje się płytką bryłą przed korpusem, z własnym dachem dwuspadowym. Jej kalenica wchodzi w połać korpusu dwoma koszami.

#### Otwory

- **Rozpoznawanie po teksturze**, a nie tylko po ciemności. Tynk jest gładki w każdym kolorze, a szkło, szprosy, drzwi i panele bramy nie są. Dzięki temu widoczna jest jasna brama na jasnej ścianie i szkło przy ciemnym tynku.
- **Roślinność:** wykluczana jest tylko żywa zieleń. Odbita w szybie zieleń jest matowa.
- **Podział i łączenie:**
  - komponenty dzielone są na cienkich kolumnach;
  - drzwi z naświetlem łączone są w jedno wejście.
- **Skala:** drzwi lub brama na stopie ściany mają przyjęte 2,2 m. Ściana A01 z pasem nad parterem ma przez to 3,65 m zamiast 2,9 m.
- **Brama czy przeszklenie:** brama jest nieprzezierna i co najmniej 0,75 jasności ściany. Szkło jest ciemniejsze.
- **Odrzucane jako nie-otwory:**
  - niskie plamy na stopie (stopień, cokół);
  - pasy pod okapem;
  - plamy przekraczające linię okapu w polu wystawki (kolumna lub cień).
- **Łukowe nadproże:** oznaczane `ARCHED`. Model buduje nadproża poziome, więc łuk jest tylko zapisany jako fakt nierozwiązany.
- **Okno w polu szczytu:** zawęża się pod połaciami, zamiast znikać. Okno przy osi szczytu jest na nią centrowane, co jest zapisane jako założenie.

#### Okna dachowe

- Szukane na całym dachu, po kontraście z pokryciem (jaśniejszym lub ciemniejszym). Wcześniej szukano tylko jasnych plam nad główną bryłą.
- Fragmenty jednej szyby są łączone.
- Sąsiednie okna dachowe są skracane do minimalnej przerwy między wycięciami w modelu.
- Okno dachowe może leżeć na połaci narożnej koperty.

#### Proweniencja

- Wszystko z jednego zdjęcia ma status `ASSUMED_FOR_RENDERING` albo `VISUAL_SEMANTIC`/`VISUAL_INFERRED`. Nigdy `SOURCE_EXACT`.
- Model nazywa się `MODEL ORIENTACYJNY Z 1 ZDJĘCIA`, nie ma pomieszczeń i nie trafia do przedmiaru ani kosztorysu.

### 3. Odporność na dekoder

- Przeglądarka (i PIL) dekoduje JPEG inaczej niż dekoder CLI, o 0–4 poziomy na piksel.
- W wersji pośredniej zmieniło to cały wynik dla zdjęcia OWNER-a: odczytano inny kolor dachu, inne odcinki i stopę 523→284 px.
- Poprawki z sekcji 2 sprawiają, że zdjęcie OWNER-a daje teraz tę samą strukturę w obu dekoderach:
  - modele `a478b5ff` (CLI) i `2a2f6255` (dekoder standardowy);
  - 2 bryły z kopertami, wystawka, 5 otworów, 3 okna dachowe.

### 4. Wydajność `readTintedCallouts`

- W 005X czytnik kółek z planu działał na **każdym** domu z dachem dwuspadowym:
  - 23–34 s na dom przy pięciu replayach równolegle (ok. 15 s samodzielnie);
  - ani na Goździkowcach, ani na Cieszyniankach, ani na Rarytasach nie dawał nic.
- Teraz działa tylko, gdy zarejestrowany render pokazuje choć jedną plamę okna dachowego (A01, Marcówki). Wyniki pozostają bajt w bajt.
- Czas pięciu replayów równolegle spadł z 80 s do 38 s.
- **Blocker:** tam, gdzie czytnik nadal działa, na telefonie to wciąż ~45–75 s. Potrzebna optymalizacja (zgrubny przebieg na zmniejszonym rastrze), której nie zrobiono.
- OCR i czytnik kółek nie działają na ścieżce zdjęcia.

### 5. Wejście w aplikacji (P2)

- BuildWorld (`apps/web`) ma przycisk **Photo…**:
  - wybór pliku;
  - `createImageBitmap` → canvas → `reconstructFromSingleImage` (ten sam pakiet `@buildapp/reconstruction`);
  - otwarcie modelu w obracalnym widoku.
- Zdjęcie nie opuszcza strony. Nie ma ścieżek `/home/user`, CLI ani próbki statycznej.
- Sprawdzone w Chromium:
  - zdjęcie OWNER-a: 5 otworów, 3 okna dachowe, 2,6 s;
  - A01: 4 + 3, 3,0 s;
  - 0 błędów strony.
- Aplikacja Android (osobne repo) nie jest podłączona.

## Wyniki na obu zdjęciach (przed = 005X @ 7626403, po = 005X-N1)

### Zdjęcie OWNER-a (`11697dc9…`)

| Cecha | Przed (8b42664f) | Po (a478b5ff) |
|---|---|---|
| Dach | dwuspadowy na każdym segmencie | korpus kopertowy na obu końcach (RAMP), wykusz kopertowy, wystawka z koszami w połać korpusu |
| Bryły | 3 segmenty | korpus (garaż + część główna: jedna linia okapu), wykusz, wystawka |
| Brama garażowa | brak | `GARAGE_DOOR` |
| Wejście | przeszklenie jak okno | `GLAZED_DOOR` do posadzki (drzwi + naświetle) |
| Lukarna/wystawka z łukowym oknem | brak | okno w polu szczytu, `ARCHED` (budowane prostokątne) |
| Okna fasady | okno główne, okno wykuszu | okno główne, okno wykuszu |
| Okna dachowe | 2/3 | 3/3 (jedno na połaci narożnej) |
| Fałszywe otwory | 1 | 0 |
| Zamknięcie geometrii | 0 błędów | 0 błędów (1 ostrzeżenie NON_MANIFOLD) |

### Wizualizacja A01 (`d92ae9f8…`)

| Cecha | Przed (2b85d3e7) | Po (a32163dc) |
|---|---|---|
| Kolor pokrycia | (190,204,216) — chmura | (123,128,130) — dach |
| Okap | biały pas, 4 segmenty | rynna (253→293 px), jeden korpus |
| Dach | dwuspadowy na segmentach | jeden dwuspadowy korpus (lewy koniec PLATEAU, prawy SYMMETRY) |
| Otwory (widocznych ok. 6) | 1 (okno na pasie) | 4: przeszklenie tarasowe do posadzki, wysokie okno, przeszklenie przy wejściu, okno z prawej |
| Okna dachowe | 0 | 3 (pozycja pary z prawej przybliżona) |
| Wysokość ściany | 2,9 m | 3,65 m (pas nad parterem) |

Brakuje na A01 m.in. drzwi wejściowych jako osobnego otworu, ścianki szczytowej z lewej i drewnianej okładziny jako cechy.

## Hold-out: nieużywany do strojenia

Cztery frontowe wizualizacje innych domów z legalnych cache'y: Goździkowce 3, Cieszynianki 12 GE, Marcówki GE, Rarytasy 5 G2E.

| Silnik | Goździkowce | Cieszynianki | Marcówki | Rarytasy |
|---|---|---|---|---|
| 005X | odmowa | odmowa | model bez otworów | odmowa |
| 005X-N1, pierwszy ślepy przebieg | **zły** (okap na kalenicy, 1 fałszywe okno) | odmowa | odmowa | odmowa |
| 005X-N1 końcowy (po kolejnych zmianach odporności, już nie ślepo) | odmowa | odmowa | odmowa | odmowa |

**Wniosek:** silnik deterministyczny nie radzi sobie z wizualizacjami o zmierzchu, ciemnymi elewacjami, szczytami frontowymi i okładziną drewnianą.

- Odmawia z nazwanym powodem, zamiast tworzyć zmyślony model.
- Uogólnienie nie jest wykazane i to jest główny blocker.
- Jedna próba poprawy po spojrzeniu na hold-out (12 wierszy pokrycia przed zmianą odcienia) została odrzucona, bo zepsuła A01.

## Kontrole i replay offline (pięć domów)

| Dom | Model | Wynik |
|---|---|---|
| A01 Jarzmianki multi-source | 1661d4bf | = 005X; 6/7 okien dachowych, 7. UNRESOLVED; 4 okna szczytowe; 3 kominy; jedna bryła; kalenica X; 40°; głębokość 8,008 nieprzestawiana |
| Goździkowce 3 | 911456a8 | = 005X; garaż nr 8 = 26,09 m²; ściana 0,303 m; brama 3,22 m |
| Marcówki | cf797743 | = 005X |
| Cieszynianki | e4e56292 | = 005X |
| Rarytasy G2E | 9f5fd342 | = 005X |
| Rarytasy OWNER `m3ea…` | — | NOT_RUN; nie podstawiano `m84f…` |

## Wydajność i pamięć

| Pomiar | Wynik |
|---|---|
| Jedno zdjęcie 800×600, Node (mediana z 5) | OWNER 1,29 s, A01 1,36 s; RSS procesu 375–412 MB (z vite-node) |
| Jedno zdjęcie, przeglądarka (wybór pliku → model na ekranie) | 2,6–3,0 s |
| `readTintedCallouts` | patrz punkt 4 |

## Testy

- `@buildapp/reconstruction`: nowy plik `photo-roof-openings-005x-n1.test.ts` (9 testów) obejmuje:
  - połacie: dwuspadowy, półszczytowy, kopertowy, piramida;
  - dach kopertowy z obrazu → płaszczyzny HIP;
  - dach dwuspadowy z obrazu;
  - jasną bramę na jasnej ścianie z miękkim cieniem obok;
  - ciemne gładkie szkło;
  - wystawkę z łukowym oknem nad okapem;
  - szary dach z białym pasem niżej (okap nie pod pasem);
  - obraz bez domu.
- `generic-openings-005x.test.ts`: 7 testów. Jedna asercja zmieniona strukturalnie, bo dach jest teraz z połaci (`roofs + roofPlanes ≥ 2`).
- Pełne pakiety zmienione (`reconstruction`), testy architektury i `apps/web/src`: **1190/1191**. Jedyny fail to znana bramka rozmiaru śledzonego APK (`research-isolation.test.ts`, `KNOWN_BASELINE_FAIL`, jak w 005X).
- `tsc` (root i `apps/web`) czysty.
- Nie uruchamiano 41-job CI, APK, emulatora ani e2e. Bramka APK 39 556 682 B > 32 MB to znany `KNOWN_BASELINE_FAIL`, nieruszany.

## Odrzucone próby

Szczegóły w ledgerze, iteracje 5, 9, 12, 13.

- **Stopa jako prosta przez wszystkie kolumny:** łapała krawędzie bruku.
- **Rozstrzyganie koperta/szczyt przez rzut końców kalenicy kamerą otworkową:** render A01 ma przesunięty obiektyw, więc kierunek głębi wychodzi odwrotnie.
- **Domknięcie maski otworów (2D i pionowe):** zlewało sąsiednie otwory i dawało 2 kondygnacje.
- **Minimalny bieg pokrycia po hold-oucie:** regres A01.

## Czego nie zrobiono / blockery

- Łuk nadproża nie jest budowany; model ma tylko nadproża poziome.
- Garaż i korpus OWNER-a mają wspólną linię okapu, więc dostają jeden dach. Na zdjęciu dach garażu jest niższy.
- Nie ma wysunięcia wykuszu, kolumn ganku ani komina ze zdjęcia.
- Ściany boczne i tylne nie są widoczne: zamknięte, bez otworów. Głębokość i spadek to założenia, opisane w `assumptions`.
- Hold-out 0/4. Potrzebne:
  - obsługa szczytów frontowych jako głównej bryły;
  - ciemne i drewniane elewacje;
  - oświetlenie o zmierzchu.
- Wejście w aplikacji Android.
- Optymalizacja `readTintedCallouts` dla telefonu.

## Rendery i pliki

Wszystkie rendery są w prawdziwym BuildWorld, ze stałą kamerą (presety aplikacji):

- przód ¾, lewy bok, prawy bok, dach z góry;
- oba zdjęcia przed i po;
- A01 multi-source (= 005X);
- Goździkowce jako kontrola.

ZIP `005x-n1-renders.zip` (SHA-256 `e50ea930f043c08ae14e380dab6bbce58414f16ba9d851a895f743aea5285a42`, 2,48 MB) leży poza repo i jest dołączony do sesji. Rendery nie zawierają pikseli źródłowych. Zdjęcia OWNER-a i wizualizacje wydawcy nie są commitowane.
