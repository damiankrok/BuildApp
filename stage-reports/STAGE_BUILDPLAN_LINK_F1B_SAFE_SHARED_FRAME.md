# STAGE BUILDPLAN LINK-F1B — bezpieczne domknięcie wspólnej ramy

| pole | wartość |
|---|---|
| gałąź | `claude/new-session-3kzcgh` |
| baza | `514f96a9c0916c0517703ad92b463d3f9005b118` (LINK-F1); zdalny HEAD = baza, drzewo czyste |
| wersje | solver v2 `2.18.0 → 2.19.0`; layout 1.3.0 bez zmian (refaktor bez zmiany odpowiedzi); model 1.7.0, usługa analizy, `assessment` bez zmian |
| zakres kodu | `layout.ts` (`AxisLadder.map`/`.px`, `offPx` kotwicy), `v2/frame.ts`, `v2/openings-v2.ts`, `v2/interior.ts`, `v2/emit.ts`, `v2/party-wall.ts`, `v2/reconstruct-v2.ts`; testy `shared-map-link-f1b.test.ts` (nowy), `wall-strip.test.ts` (wersjonowana delta) |
| harness | `apps/web/tools/review-shots.ts` (referencja kanwy per kandydat) |
| poza zakresem (nietknięte) | F2, nowe rodziny dachów, SAM/OCR, renderer, Android, APK, schemat modelu, tolerancje closure, zależności |
| artefakty tekstowe | `stage-reports/artifacts/analyzer-link-f1b/` |
| sondy (research) | `research/analyzer-link-f1/phase-probe.ts`, `debug-run.ts` (`--dump-program`), `roof-defects.ts`, `research/analyzer-link-f1b/map-export.ts` |
| ZIP prywatny | `BuildPlan-LINK-F1B-Source-Before-After.zip` — poza repozytorium (obrazy ARCHON); 95 895 955 B, SHA-256 `bf11e4e5…ffb237` (§ 9) |
| werdykt | **PARTIAL** |

## 0. Co F1B miało domknąć

F1 zostawił dwie mapy rzutu bazowego na metry: drabinę łańcuchów (bryły) i liniową ramę v2 (ściany, otwory, schody,
bloki, rejestracja kondygnacji). Wariant „jedna mapa” zmierzony w F1 (`variant-shared-frame.diff`) przełączał rodziny
otworów (Sasanki: brama → okno; Jarzmianki: drzwi na poddaszu znikały; Arganie: drzwi/okno) i nie był przyjęty.
Zapisany diff wołał `ladder.px`, którego w kodzie produkcyjnym nie było — `at` drabiny jest schodkowe (linie siatki
przyciągają piksele) i nie ma odwrotności.

F1B: jedna odwracalna mapa dla wszystkiego, co czytane jest z rzutu bazowego, przy czym **ten sam tusz ma znaczyć to
samo** niezależnie od fazy sub-pikselowej mapy i jej lokalnej skali.

## 1. FIRST_BAD — łańcuch źródło → próbkowanie → odczyt → rodzina/host → współrzędne → DSL → model → closure

Sonda fazowa (`research/analyzer-link-f1/phase-probe.ts`) odtwarza zapieczętowany bieg, bierze ramę kondygnacji i woła
wyeksportowane czytniki z ramą przesuniętą o (dx, dy) ∈ {0, ±0,5, ±1, ±2}² px — 49 faz. „Czytnik bazy” to kod
z `514f96a` (worktree, `BASE_TREE=…`), wołany na **wspólnej mapie** — czyli dokładnie to, co robił wariant F1.
Wyniki: `artifacts/analyzer-link-f1b/phase-probes.json`.

### 1a. Sasanki 3 (G) — brama garażu staje się oknem

| ogniwo | stan |
|---|---|
| źródło | rzut parteru `…0e011b73e9-f8d5d43c86`, front `attached-0`, szczelina x 8,137–11,252 m (3,12 m), bez opisu |
| próbkowanie | `overheadDoorTracks` szukał przerywanych prowadnic, krocząc **w metrach** stałym średnim mpp; na nieliniowej mapie zbiór sprawdzanych pikseli zależał od fazy |
| odczyt (FIRST_BAD) | czytnik bazy na wspólnej mapie: prowadnice znalezione tylko w **21/49 faz**; ten sam czytnik na liniowej ramie F1: 49/49 |
| rodzina | bez prowadnic szczelina 3,12 m bez parapetu idzie w regułę okna → WINDOW |
| model / closure | brama znika z frontu garażu; `program.json` inny o rodzinę otworu |

**Poprawka (przyczyna, nie objaw):** `overheadDoorTracks` chodzi po **siatce pikseli rastra** — wiersz lica raz przez
`toPixel`, kolumny całkowite w ±`TRACK_SEARCH_ALONG_M`, głębokość w całkowitych pikselach, metry dopiero z `toWorld`.
Po poprawce: **49/49** faz, długość prowadnic 3,1851–3,1853 m (rozrzut 0,2 mm).

### 1b. Jarzmianki — drzwi na poddaszu potwierdzone łukiem znikają

| ogniwo | stan |
|---|---|
| źródło | rzut poddasza `…9b8cd885e5`, ścianki działowe; skrzydło krótsze niż szczelina, łuk ćwiartki |
| próbkowanie | `doorSwingInGap` iterował zawias, promień i odsunięcie **w metrach** |
| odczyt (FIRST_BAD) | czytnik bazy na wspólnej mapie, 49 faz: `idoor-1-5` (koniec `x-3`, łuk 0,85 m) **6/49**, `idoor-1-2` 42/49, `idoor-1-3` 44/49, `idoor-1-1` 49/49; w biegu bazy `idoor-1-5` trafił akurat na fazę, w której łuk się znajduje |
| rodzina | bez łuku szczelina zostaje przejściem: ścianki nie zamykają pokoju, drzwi znikają z modelu |

To nie jest regresja „jednej mapy”, tylko krucha cecha samego czytnika: w bazie trafiła na szczęśliwą fazę.
**Poprawka:** hipotezy zawiasu, promienia i linii ściany w całkowitych pikselach (`gapOnGrid`); mpp wzdłuż z długości
między dwoma przekształconymi końcami (nie średnie mpp); przy remisie wygrywa hipoteza, której łuk leży na tuszu
dokładnie (nie w ±1 px). Każda granica liczona od piksela, który przewiduje mapa (ościeże, linia ściany), jest niepewna o
`JAMB_PHASE_PX = 2` px — dwie lokalizacje ticka łańcucha (2 × `LADDER_TICK_PX`) — więc zawias, promień i linia mogą
wyjść o tyle poza swoje granice (promień dodatkowo o piksel zaokrąglenia zawiasu), zawsze **po** hipotezach w granicach.
Po poprawce: **49/49** faz na wszystkich czterech drzwiach poddasza (`idoor-1-5`: zawias 4,44–4,53 m, promień
0,849 m; w jednej fazie (2, 2) łuk na całą szczelinę — nadal drzwi).

### 1c. Rarytasy — `opening-0-front-0-1` DOOR → WINDOW na wspólnej mapie (znalezione w trakcie)

| ogniwo | stan |
|---|---|
| źródło | rzut parteru `…59a406b738`; front `main` za garażem, ściana wspólna |
| współrzędne | pasmo przewidywane przez hosta (szew na linii ticka łańcucha 479,5 px) leży ~10 px od pasma narysowanego (py 460–470/477); lokalna skala Y drabiny ściśnięta ~2 % (twierdzenie 850 przy offPx 3,1 przyjęte) |
| odczyt (FIRST_BAD) | czytnik skrzydła/szyby próbkował obok narysowanej ściany → brak skrzydła → okno |

**Poprawka:** symbole czyta się przy **narysowanym** paśmie ściany (`drawnWallBand`: kolumny 5–10 px za ościeżami —
3 px od ramy i skrzydła ościeża plus 2 px niepewności jego położenia na mapie,
tusz luma < 200, bieg między 0,5 a 2 grubości, w promieniu jednej grubości od przewidywania, ≥ połowa kolumn zgodna co do
1 px), w ramie `symbolFrame` (skala arkusza zakotwiczona w punkcie wspólnej mapy). Przewidywanie hosta pozostaje
przewidywaniem; obserwacja rastra, przypisanie hosta i transformacja do metrów są rozdzielone.
Sonda (`--leaf-drawn`, ścieżka produkcyjna): **49/49** faz to samo skrzydło (LOW, OUT); czytnik bazy w przewidywanym
paśmie: 0/49.

### 1d. Ściana wspólna ↔ strop (Sasanki 5,4 mm × 2, Marcówki 44,6 i 21,5 mm)

`emit.ts`: krawędź stropu była `m.x1 − tOf(m)` (lico ściany własnej), a ściana wspólna jest emitowana linią na licu
dalszym i grubością do środka (`inset = tOf(m)` w PARTY). Sasanki: strop 7,3202, lico ściany wspólnej 7,3256 (5,4 mm);
Marcówki: 7,411 vs 7,4555 (44,6 mm) + strop parteru dobudówki na obrysie 7,9 zamiast lica dalszego 7,874 (21,5 mm).
W Marcówkach ściana wspólna istnieje tylko na kondygnacji 0, więc strop nad nią musi czytać odcinki kondygnacji niżej.

**Poprawka:** `supportedSlab` — strop kończy się na licu ściany, która go niesie: przy odcinku PARTY na licu
gospodarza (`partyHostFace`), przy własnym na licu własnym, ze stopniem między nimi; na najniższej kondygnacji dwa stropy
spotykają się na licu dalszym bez nakładania; kontakt OPEN (brak narysowanej ściany) zostawia obrys. Odcinki bierze
z kondygnacji, na której strop się opiera.

| dom | ściana wspólna (linia, t) | lico gospodarza | krawędź stropu nad | stropy parteru |
|---|---|---|---|---|
| Sasanki PRZED | 7,560045, 0,23442 | 7,325625 | 7,32023 (GAP 5,4 mm ×2) | 7,75 / 7,75 |
| Sasanki PO | 7,556958, 0,23165 | **7,325308** | **7,325308** (+ stopień do 7,32023 przy własnej ścianie) | **7,556958 / 7,556958** |
| Marcówki PRZED | 7,878524, 0,423008 | 7,455516 | 7,410897 (GAP 44,6 mm) | 7,9 (GAP 21,5 mm) |
| Marcówki PO | 7,873951, 0,416785 | **7,457166** | **7,457166** | **7,873951 / 7,873951** |

Wartości: `artifacts/analyzer-link-f1b/party-slab-faces.json`.

## 2. Zmiana — jedna mapa

- `axisLadder` zwraca `map` (interpolacja kawałkami liniowa przez linie, poza skrajnymi liniami skala arkusza) i `px`
  (odwrotność) — tylko gdy linie i metry rosną ściśle; inaczej mapy nie ma i rama zostaje liniowa. Kotwica niesie
  `offPx` (chybienie ticka). To refaktor: layout odpowiada bajt w bajt tak samo (commit 1).
- `planFrameV2`: `toWorld`/`toPixel` rzutu bazowego przez `ladders.x/z.map/px`; kondygnacje dopasowane do bazy składają
  swoje przekształcenie z tą samą mapą. `mppX/mppY` zostają skalą arkusza (lico-do-lica) — do grubości i symboli.
  Jedna mapa obsługuje bryły, ściany, otwory, schody, bloki i rejestrację kondygnacji.
- Czytniki symboli (prowadnice, skrzydło, łuk, szyba, linie szyby, liście drzwi) — na siatce pikseli, przy paśmie
  narysowanym (§ 1a–1c).
- `readPartyWalls`: luz kontaktu = `offPx` kotwic PINNED na linii kontaktu × mpp (zamiast samego stałego 0,05 m).
  Rarytasy: pasmo 6,46–6,73 było poza kontaktem 6,20 + T + 0,05 → `UNDECIDED`; teraz `ONE_WALL` na narysowanym paśmie.
- `interiorRect`: wnętrze czytane do dokładnego lica ściany wspólnej — jej tusz nie jest ani ścianką, ani częścią bloku
  (komin Rarytasów zlewał się z nią).
- `axesAlong` (wnętrze): kawałek przy krawędzi okna czytania, którego tusz ciągnie się przez krawędź na ≥ 80 % długości,
  to tusz ściany zewnętrznej za modelowanym licem, nie ścianka (fantomy: Rarytasy `x-9`/`x-12`, Goździkowce `z-13`,
  `z-15`, górne `z-12`, Sasanki `attached z-0`, Larchfield 3 × 0,05 m).
- bloki (kominy) przycięte do lic wewnętrznych (A01: komin wchodził w ścianę o piksel).
- `doorSwingInGap`: hipotezy na siatce pikseli, remis rozstrzyga łuk dokładnie na tuszu, granice od pikseli
  przewidywanych przez mapę poszerzone o `JAMB_PHASE_PX` dopiero po hipotezach w granicach (§ 1b).
- `supportedSlab` (§ 1d).

Nie zmieniono: tolerancji closure, severity, progów `MIN_SCORE`/`MIN_MARGIN`, bramek czytnika wymiarów. Żadnych
wyjątków po nazwie, adresie, hashu ani współrzędnych domu. Żadnych zależności.

## 3. Testy przyczyny

`packages/reconstruction/test/shared-map-link-f1b.test.ts` (16 testów, arkusze wymyślone):

- drabina jako mapa: zgodność z `at` na liniach, interpolacja bez przyciągania, skala arkusza poza liniami;
  px→świat→px na liniach, między nimi i poza nimi; ścisła monotoniczność co 0,5 px; brak mapy, gdy linie nie rosną;
- `planFrameV2`: drukowane 5,03 m trafia na swoją linię, roundtrip w 6 punktach (także poza obwiednią); kondygnacja
  dopasowana składa się z tą samą mapą w obie strony; `symbolFrame`;
- `overheadDoorTracks`: obie prowadnice w 49/49 faz; **negatyw**: linia ciągła od ościeża (ścianka) odrzucona w 49/49;
- `doorSwingInGap`: łuk + skrzydło w 49/49 faz; **negatyw**: szczelina bez łuku i skrzydła (dwa bliskie końce ścianek,
  przejście) nie jest drzwiami;
- `drawnWallBand`: szara ściana 4 px od przewidywania znaleziona, środek na tuszu; **negatywy**: cienka linia mebla
  w miejscu przewidywanej ściany, ściana w poprzek linii obok ościeży;
- `supportedSlab`: stopień przy połowie boku na ścianie wspólnej (krawędzie prostoliniowe); dwa stropy parteru spotykają
  się na licu dalszym bez nakładania, za ścianą wspólną strop zaczyna się na obrysie; **kontakt OPEN bez zmian**.

Kontrole z briefu pokryte istniejącymi testami (zielone): okno przy podłodze bez dowodu drzwi (`elevation-garage-*`,
`openings-*`), mebel vs ściana, kontakt otwarty bez ściany (`party-wall-*`), determinizm i niezależność od kolejności
wejść (`shared-frame-link-f1.test.ts`).

### 3.1 Testy, które zmiana dotyka — wersjonowana delta (nie nowa linia bazowa całego pliku)

`wall-strip.test.ts` (005Q): fikstury drukują łańcuchy w 5 cm/px przy rejestracji 0,026 m/px. Stary solver kładł bryły
łańcuchami, a ściany, szczeliny i strefy czytał skalą rejestracji: ścianka narysowana 40 % szerokości domu wychodziła na
21 % i jej połowa za drzwiami wypadała z bryły; skaner stref patrzył na piksele obok pasa. Przez jedną mapę ścianka stoi,
gdzie jest narysowana, w dwóch kawałkach po obu stronach narysowanego przejścia; fałszywe pasmo w poprzek domu znika;
skaner stref widzi pas, jak jest narysowany, i czyta to, co go przecina (boczne ściany wiaty, ścianki boksów, filar,
słupki), jako zwroty — tak jak stary solver robił już w tych przerysowaniach, w których jego dwie skale przypadkiem się
zgadzały (mirrorY/turn90). `FROZEN` (historyczny zapis) jest nietknięty; delta `LINK_F1B_EXPECTED` (35 wpisów:
liczba ścian, zwroty, a dla filara/słupków/wiaty/boksów — tarasy między zwrotami) jest wygenerowana z bieżącego
czytnika z uzasadnieniem w pliku. Asercja „face pair jest źle zarejestrowany” odwrócona: przez jedną mapę już nie jest.
**Ryzyko nazwane:** odczyt filara i słupków jako „zwrotów” to semantyka istniejącego skanera stref, dotąd zasłonięta
błędną skalą; F1B jej nie zmienia (poza zakresem). Na ośmiu domach liczba zwrotów i tarasów się nie zmieniła.

`attic-rooms-n8-03d2.test.ts`: po przejściu na siatkę pikseli łuk 0,75 m czytany był jako 0,80 m (remis ±1 px);
naprawione regułą remisu „łuk dokładnie na tuszu”, test zielony bez zmiany oczekiwań.

### 3.2 Pełne pakiety

| pakiet | pliki | testy | czerwone | baza `514f96a` |
|---|---|---|---|---|
| `packages/reconstruction` | 100 | 1221 | **0** | 0 |
| `packages/analysis-service` | 16 | 176 | **0** | 0 |
| `tests/architecture` | 24 | 357 | 11 | 11 (te same) |
| `apps/local-analyzer` | 5 | 54 | 2 (Larchfield program, NFD) | 3 (+ self-test) |
| `apps/analyzer-api` | 3 | 48 | 5 | 4 |

`tsc -p tsconfig.json --noEmit` czysty. Jedyny nowy czerwony: `android-contract` „today's answers keep every member the
legacy (solver 2.3.0) answers had” — w odpowiedzi Larchfield znika klucz `quality.byFamily.INTERIOR_WALL`, bo trzy
„ścianki” Larchfield (0,05 m, przyklejone do lica pierścienia; dom syntetyczny nie ma ścianek) były fantomami, które
usuwa reguła z § 2. To klucz mapy, nie pole schematu (Kotlin: `Map<String, Map<String, Int>>`), więc parser telefonu
się nie zmienia; kontraktu API w F1B nie ruszano. Decyzja OWNER-a: czy `byFamily` ma nieść puste rodziny.
Przestarzały snapshot `status-completed.json` był czerwony już w bazie.

## 4. Regresja ośmiu domów (jedno przejście, produkcyjny `runAnalysis`, zapieczętowane wejścia DEV, ten sam cache)

Rarytasy to DEV `m84f2903cb8e14` (nie holdout). PRZED = bieg LINK-F1 na `514f96a`; PO = to drzewo; wejścia i cache
bajtowo te same (`sourcePackageHash` w `regression-8-houses.json`). 8 × exit 0, 312–653 s na dom (trzy domy
równolegle). Bieg PO jest jednym przejściem na końcowym kodzie; `program.json` PO i eksport mapy zrobione
`reconstructV2` na tych samych zapieczętowanych dowodach dają ten sam `modelHash` co `runAnalysis` w 8/8.

| dom | otwory PRZED → PO | ściany | ERROR zewn. | replay | odmowy | residua (poza tol.) | nierozstrzygnięte |
|---|---|---|---|---|---|---|---|
| Jarzmianki (a01) | 10 D / 13 W → **bez zmian** | 27 → 27 | 1 → 1 | BYTE_IDENTICAL | 0 | 6 (3) → 6 (3) | 17 → 17 |
| Goździkowce 3 | 19 D → **15 D** / 12 W / 1 P | 39 → **31** | 0 → 0 | BYTE_IDENTICAL | 0 | 0 → 0 | 22 → 18 |
| Marcówki GE | 13 D / 8 W → bez zmian | 41 → 39 | 4 → **2** | BYTE_IDENTICAL | 0 | 66 (12) → 66 (12) | 7 → 7 |
| Cieszynianki 12 GE | 10 D / 11 W / 3 P → bez zmian | 25 → 25 | 0 → **1** | BYTE_IDENTICAL | 0 | 0 → 0 | 14 → 13 |
| Rarytasy 5 G2E | 14 D / 6 W → bez zmian; **kominy 2 → 1** | 21 → 21 | 2 → **3** | BYTE_IDENTICAL | 0 | 28 (21) → 26 (19) | 14 → 13 |
| Trytomy G | 10 D / 11 W → bez zmian | 36 → 36 | 2 → 2 | BYTE_IDENTICAL | 0 | 9 (6) → 9 (6) | 11 → 11 |
| Arganie G2E | 18 D / 8 W → **19 D / 7 W** | 30 → 30 | 3 → 3 | BYTE_IDENTICAL | 0 | 10 (7) → 12 (9) | 11 → 10 |
| Sasanki 3 G | 15 D / 8 W → bez zmian | 34 → 33 | 3 → **1** | BYTE_IDENTICAL | 0 | 30 (17) → 30 (17) | 18 → 16 |

Zmiany rodzin i hostów (pełna lista z pozycjami: `regression-8-houses.json`, `openingChanges`):

- **Sasanki:** brama `opening-0-front-8-0` zostaje DOOR (3,12 m) — jak w F1; drzwi wewnętrzne `main-idoor-0-1` zmieniają
  tylko id hosta (`x-5` → `x-4`, ta sama pozycja 1,05 m), bo fantom `attached z-0` zniknął i numeracja się przesunęła.
- **Jarzmianki:** wszystkie 10 drzwi, w tym poddasze, są (F1 = F1B co do rodzin).
- **Arganie:** `opening-0-rear-2-2` WINDOW → **DOOR** (2,19 m). Rzut rysuje skrzydło i łuk, opis 220/230 — drzwi
  tarasowe; to korekta, nie przełączenie fazą. `main-iwall-0-z-8-b` → `z-8` (ten sam odcinek, numeracja).
- **Goździkowce:** −4 drzwi, −8 ścian: fantomowe ścianki z tuszu ściany zewnętrznej (`z-13`, `z-15`, górne `z-12`…)
  i drzwi na nich. Usunięte drzwi na `z-13` dublowały zewnętrzne `opening-0-east-1-0` (z 7,122, 1,037 m) — sprawdzone na
  planszy. Pozostałe drzwi przenoszą się na prawdziwe ścianki (przenumerowanie).
- **Rarytasy:** `opening-0-front-0-1` zostaje DOOR; ściana wspólna przechodzi z 6,3577 na narysowane pasmo 6,4558
  (t 0,2758 → 0,2693; raster: wiersze 460–469 px = z 6,47–6,75), decyzja `ONE_WALL`. Podział drzwi tarasowych
  `opening-0-rear-2-2` na skrzydło i doświetle 0,476/0,524 → 0,428/0,572 (czytnik liści na paśmie narysowanym).
- **Rarytasy — komin `chimney-1` nie jest już emitowany (2 → 1 komin, penetracja dachu dobudówki 1 → 0).** Blok
  na rzucie jest (`SOLID_BLOCK`), i to teraz na swoim miejscu: z 6,725–7,129, na narysowanej ścianie wspólnej
  (raster: blok w wierszach 445–459 px = z 6,75–7,14); w F1 stał na z 6,606–7,047, wchodząc w ścianę. Komin wymaga
  potwierdzenia na renderze (słup ciemnych pikseli ≥ 0,4 m nad połacią). Pomiar kolumn na całej szerokości bloku:
  pierwszy komin daje 36 px na prawie każdej kolumnie obu widoków (spójny słup); nad tym blokiem LEWY widok ma długie
  biegi w 3 z 26 kolumn, PRAWY w 3 z 27, reszta 2–4 px. F1 przyjął go na jednej kolumnie 2 px obok złego środka.
  Odrzucenie wynika z istniejącej reguły czytnika (precyzja przed zasięgiem) i nie jest cięciem obiektu dla findings
  (komin nie brał udziału w żadnym finding closure). Nazwane jako zmiana, nie ukryte.
- Marcówki, Cieszynianki, Trytomy: rodziny i hosty bez zmian.

### 4.1 Closure (tolerancje i severity bez zmian)

`artifacts/analyzer-link-f1b/closure-exterior-before-after.txt`. ERROR zewnętrzne: **17 → 13**.

Zamknięte: Sasanki 2 × GAP 5,4 mm (ściana wspólna ↔ `slab-main-1`), Marcówki GAP 44,6 mm i 21,5 mm — bez nowych
nakładań i bez wypełniania kontaktu OPEN (test § 3).

Pary, które były i są (zmienia się tylko miara): Marcówki balkon ↔ pas okapowy (0,0372 → 0,0451 m², 0,0157 → 0,0191 m³),
Sasanki ściana wspólna ↔ połać (0,0042 → 0,0041 m³), Jarzmianki pergola, Trytomy pergola, Arganie ×3, Rarytasy ×2.

**Nowe ERROR (2) — kryterium „bez nowych technicznych ERROR” NIESPEŁNIONE:**

1. **Cieszynianki** `COPLANAR_DUPLICATE pocket-main-0-1-back + pocket-main-0-2-back` 0,579 m² (+ 16 sliverów
   WARNING). Ta sama topologia dwóch kieszeni co w F1; tylna ściana przesunęła się z x 2,648 na 2,593 (mapa) i tylne
   ściany dwóch sąsiednich kieszeni weszły w jedną płaszczyznę. Nierozwiązane.
2. **Rarytasy** `INTERSECTION ring-main-0-w0-party-attached-0 + roof-attached-0-plane-high` 0,0028 m³. Ta sama klasa
   co dwa istniejące błędy na `w0-1` (górą ściany po spodzie połaci); ściana wspólna stoi teraz na narysowanym paśmie,
   pod połacią dobudówki. Nierozwiązane.

### 4.2 Ostrzeżenia dachu Trytomów (i nowe w Jarzmiankach) — wyjaśnienie

`research/analyzer-link-f1/roof-defects.ts` lokalizuje krawędzie nie-dwukrotne i slivery połaci:

- **Trytomy** (76 sliverów, NON_MANIFOLD 40 → 21; przed F1B i po): wszystkie defekty leżą na **jednej linii** z = 5,872,
  y 5,369/5,734 (spód/wierzch połaci). Okna dachowe `rooflight-plan-high-0` i `-1` mają minZ **6,052314** i
  **6,052315** — różnica 1 µm z zaokrąglenia; kompilator dachu tnie połać po obu liniach i zostawia pas 1,31 µm, którego
  krawędzie klucz 1e-5 m liczy sześciokrotnie. Nie ma to związku z ramą; to dwa okna jednego rzędu bez wspólnej linii.
- **Jarzmianki** (nowe: 112 sliverów, NON_MANIFOLD 45; w F1: 0): ten sam mechanizm na z = 1,158 — `rooflight-plan-low-*`
  maxZ **1,157612 / 1,157613** (w F1 wszystkie 1,155871). WARNING, nie ERROR; wynika z tego, że okna jednego rzędu
  liczą krawędź każde osobno. Poprawka (wspólna krawędź rzędu) to zmiana czytnika okien dachowych — poza zakresem.

### 4.3 Wierność źródłu vs sama kompilacja

Replay BYTE_IDENTICAL i 0 odmów w 8/8 to **techniczna** poprawność programu, nie wierność. Wierność (R1–R5,
`sourceFidelity`) i nieporównane źródła (`sourceUnchecked`) zostają osobno:

- liczba nieporównanych pozycji źródła bez zmian w 8/8 (17, 27, 14, 27, 32, 20, 28→27, 22);
- **Arganie:** nowy CONFLICT R5 na elewacji tylnej: `opening-0-rear-2-1` (DOOR w obu biegach, sill 0, głowica 2,18)
  przesunął się o 4 cm i R5 po raz pierwszy sparował go z oknem elewacji (sill −0,73 m, głowica +0,83 m poza 0,16).
  To rozbieżność model ↔ źródło, której F1 nie sprawdzał, a nie przełączona rodzina. Do weryfikacji na elewacji.
- **Rezydua F1 jako DISPUTED (nie defekty):** Trytomy `opening-0-front-0-1` — nadal DISPUTED (ALONG: rejestracja
  sporna, 0,016024 vs 0,014654 m/px); Rarytasy `opening-0-east-5-0` — w F1 DISPUTED (VERTICAL: grunt elewacji
  odrzucony), w F1B bez wykonanego sprawdzenia (nieparowane). Żadne z nich nie jest liczone jako zgodność.
- Rarytasy: dwa CONFLICT R5 jak w F1 (miary zmienione o < 0,1 mm).

## 5. Plansze rzutu i rozbieżność obrysu Marcówek

Plansze `BOARDS/<dom>-PLAN-BEFORE-AFTER.png` (tylko ZIP) rysują ściany i otwory parteru: PRZED przez **produkcyjną** ramę
biegu F1 (eksport `map-export.ts` uruchomiony w checkoucie F1 na biegu F1 — hash modelu zgodny z biegiem), PO przez
wspólną mapę F1B (eksport z tego drzewa — hash modelu zgodny z `runAnalysis`). W nagłówku: rama, hash obrazu, hash modelu,
maksymalny błąd świat→px→świat. Krzyżyki: punkty kontrolne odwrotności (lico × lico brył, między, poza obwiednią).
Teksty: `artifacts/analyzer-link-f1b/map-control-points.json`. Błąd roundtripu ≤ 1 µm we wszystkich 16 ramach.

**Rozbieżność obrysu Marcówek rozstrzygnięta:** plansze F1 rysowały model ramą odtworzoną ręcznie z sondy (początek
w `extent`, odwrócenie z przez `world.envelope.z1`). Koperta Marcówek obejmuje 1 m strefy frontowej, więc tamta rama
przesuwała obrys o ~75 px w dół i plansza wyglądała, jakby model nie trafiał w ściany. Przez produkcyjne `toPixel` obu
biegów obrys PRZED i PO leży na narysowanych licach; różnice między nimi to centymetry ścianek (np. strop/ściana wspólna).
Błąd był w planszy, nie w modelu.

## 6. Zrzuty (9 kamer, wszystkie domy, w tym Sasanki i Cieszynianki)

`apps/web/tools/review-shots.ts`: model, którego pasek stanu zajmuje dodatkową linię, przesuwał kanwę i harness
przerywał bieg („the viewport canvas moved or resized”) — tak odpadła Cieszynianka w F1. Zrzuty to bufor kanwy, więc
jej pozycja na stronie nie wpływa na obraz; kontrola układu obowiązuje teraz w obrębie jednego kandydata (referencja
po załadowaniu). Zrzuty PRZED i PO: `SHOTS/before/<dom>/`, `SHOTS/after/<dom>/` w ZIP; wynik: § 9.

## 7. Zgodność z kryteriami

| kryterium | wynik |
|---|---|
| 1. spójna mapa dla wszystkich zależnych obiektów | **TAK** — bryły, ściany, otwory, schody, bloki, kondygnacje; roundtrip ≤ 1 µm |
| 2. stabilne rodziny/obecność/hosty przy fazach 0, ±0,5, ±1, ±2 | **TAK** dla czytników prowadnic, łuku i skrzydła (sondy 49 faz na danych + testy syntetyczne) |
| 3. brama Sasanek, drzwi poddasza Jarzmianek, Arganie jak w oryginale; kontrole +/− | **TAK** (Arganie `rear-2-2` teraz DOOR — zgodnie z rzutem) |
| 4. 2 × 5,4 mm Sasanek, 44,6 / 21,5 mm Marcówek w tolerancji, bez nakładań, OPEN nietknięty | **TAK** |
| 5. brak nowych technicznych ERROR na 8 domach; wyjaśnić Trytomy | **NIE** — 2 nowe ERROR (Cieszynianki, Rarytasy); Trytomy wyjaśnione |
| 6. wierność ≠ replay | **TAK** — rozdzielone; nowy CONFLICT R5 Arganie nazwany |

## 8. Werdykt

**PARTIAL.** Wspólna mapa jest jedna, odwracalna i monotoniczna; czytniki na granicy piksele → geometria nie zależą już od
fazy; trzy FIRST_BAD z briefu są odtworzone przyczynowo i naprawione u przyczyny; szczeliny ściana wspólna ↔ strop są
zamknięte. Nie ogłaszam PASS: zostają dwa nowe ERROR closure (Cieszynianki, Rarytasy), nowe ostrzeżenia dachu
Jarzmianek, nowy CONFLICT R5 w Arganiach (rozbieżność ujawniona, nie spowodowana), komin Rarytasów bez potwierdzenia
na renderze (blok na rzucie zostaje) i jeden nowy czerwony test kontraktu Androida wymagający decyzji OWNER-a.
Wariant jest w kodzie produkcyjnym tej gałęzi (nie ma osobnej flagi); jeżeli OWNER uzna dwa nowe ERROR za blokujące,
przyjęcie należy wstrzymać — gałąź nie jest scalana w tym etapie.

## 9. Dostawa

| element | wartość |
|---|---|
| baza | `514f96a9c0916c0517703ad92b463d3f9005b118` |
| commit 1 (refaktor, odpowiedź bez zmian) | `3ca5730d51e37e50385981eaf5d7446f70037ca9` — `layout.ts` |
| commit 2 (poprawka + testy) | `2b4be45cf5bbc532b862adf279361f3dfb70efdc` — `v2/*`, testy |
| commit 3 (raport) | commit niosący ten raport, artefakty, sondy research, harness zrzutów i `PROJECT_STATUS.md` (końcowy HEAD; `git log`) |
| push | wyłącznie `claude/new-session-3kzcgh`, każdy commit z `[skip ci]` |
| nie uruchamiano | pełnego CI, APK, buildu Androida, ML, F2, N9-02S |
| ZIP | `/home/user/BuildPlan-LINK-F1B-Source-Before-After.zip` (poza repozytorium) — 95 895 955 B, 885 plików, SHA-256 `bf11e4e589d23fd454328ce7b37109e54afac91d0faeb014950e73b005ffb237` |

ZIP: oryginały ARCHON z adresami i SHA-256, wycinki FIRST_BAD, plansze, modele i `program.json` PRZED (odtworzone
w checkoucie F1, hash modelu zgodny z biegiem F1 w 8/8) i PO, zrzuty 9 kamer PRZED/PO dla 8 domów (144 PNG, wszystkie
niepuste, w tym Sasanki i Cieszynianki), sondy fazowe, kontrole, `MANIFEST.json` (wejścia, hashe, katalogi biegów,
wersje) i `HASHES.txt`. Jego `REPORT.md` to ten raport sprzed wpisania sumy ZIP.
