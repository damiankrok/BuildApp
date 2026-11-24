# BuildPlan v3.54.19 — bryła, otwory i wnętrze z rzutu (po audycie APK 1351)

Etap: 2026-11-24. Gałąź `claude/new-session-3kzcgh`. Baseline zamrożony: kod APK 1351 (`58ff26a`, drzewo `9ac25b6`).
Protokół zapisany przed biegami: `research/source-to-model/v35419/PROTOCOL.md`. Decyzje architektoniczne:
`docs/ADR-V35419-PLAN-SKELETON.md`. Krótko dla OWNER-a: `stage-reports/README_V35419.md`.

Renderów z komputera nie nazywam zrzutami z telefonu. W tej sesji nie było telefonu ani emulatora: APK jest zbudowany
i podpisany, **na urządzeniu niesprawdzony** (`ANDROID_UI_NOT_VERIFIED`).

<!-- VERDICT -->

## 1. Cel i punkt wyjścia

Cel OWNER-a: z linku do projektu ma powstać rozpoznawalna, spójna miniatura — poprawna bryła zewnętrzna, dach, główne
otwory **i ściany wewnętrzne zgodne z rzutem**. Poprawa zewnętrza nie może po cichu kasować wnętrza ani otworów.

Audyt dostawy 1351 wskazał pięć konkretnych strat. Każdą sprawdziłem w kodzie i w danych, zanim cokolwiek zmieniłem:

| Strata z audytu | Co znalazłem w kodzie 1351 | Co zrobiono |
|---|---|---|
| A. `GLAZED_WALL` odczytane przez API nie ma konsumenta | `from-sketch.ts` zamieniał na propozycje tylko `WINDOW`, `DOOR`, `GLAZED_DOOR`, `GATE`; przeszklenie ścienne trafiało do „pominiętych" | konsument: przeszklenie sięgające podłogi (parapet ≤ 0,35 m) to drzwi przeszklone, wyżej — okno; przechodzi tę samą bramkę źródłową co inne otwory |
| B. wybór nowej bryły kasuje ściany wewnętrzne | bryła ze źródeł powstaje od pustego modelu; wnętrze LOCAL jest w innym układzie i świadomie nie było przenoszone (`NOT_CHECKED`) | wnętrze nie jest już własnością budowniczego bryły: **szkielet rzutu** (ściany, drzwi wewnętrzne, przerwy w ścianach zewnętrznych) czytany jest z arkusza rzutu i wbudowywany w tę bryłę, która stoi |
| C. generator brył zna bardzo wąski układ | prostokąt, L (dwa prostokąty), dwa korpusy w linii; każdy inny obrys → `UNSUPPORTED_FORM` | dowolny obrys ortogonalny rozkładany na maks. 4 korpusy (`wingsOf`), każdy z własnym dachem; podział „dom + garaż w linii" stawiany na ścianie z rzutu; zabezpieczenie przed „iglicą" na niższym skrzydle |
| D. pomiar kontrastu odrzuca drzwi mimo informacji z rzutu | bramka kontrastu traktowała „brak dowodu w pikselach elewacji" jak „dowód braku"; świadek z rzutu działał tylko dla wyniku `UNDECIDED` z dodatnim z | drzwi (wejściowe, przeszklone, brama) stojące na przerwie narysowanej przez rzut (pokrycie ≥ 0,7) przechodzą niezależnie od kontrastu; okna nadal wymagają z ≥ 1 |
| E. ślad G6 wskazuje ID nieobecne w modelu | identyfikatory budowane z nazwy propozycji z sufiksem `@…` zmieniały się przy ponownym nałożeniu poprawek; losy obserwacji pisane były na modelu sprzed późniejszych rund | identyfikator wynika z obserwacji (bez sufiksu ponowienia); po zbudowaniu modelu końcowego każdy cel losu „BUILT/AGREES" jest sprawdzany w modelu oddanym (`OBSERVATION_FATE_TARGETS`), brak nazwany razem z tym, co zajęło miejsce elementu |

Strata F z audytu („status jakości nie zastępuje oceny zadania") jest regułą oceny, nie kodu: w tym raporcie wynik domu
to ocena obrazu przez niezależnego oceniającego, a status jakości z recenzji jest podany tylko pomocniczo (§7 pokazuje,
jak bardzo potrafi się zmieniać między dwoma biegami tej samej recenzji).

## 2. Co wdrożono

Jedna zmiana architektury i kilka reguł wokół niej. Nie powstał nowy podsystem „obok": czytnik ścian to ten sam
`readInterior`, którego używa LOCAL, wszystkie zmiany modelu idą przez ten sam wykonawca poprawek i jądro komend.

### 2.1 Szkielet rzutu (`plan-skeleton.ts`, 0 USD)

Deterministyczny odczyt arkusza rzutu parteru wewnątrz obrysu bryły:

1. **Arkusz sam mówi, jak rysuje ścianę.** Najczęstszy niepapierowy kolor w pasie tuż wewnątrz obrysu to kolor ścian tego
   arkusza (szary 152 u Studio Atrium, 120 u Dobrych Domów, czarny u ARCHON-u). Stała reguła „ciemny tusz" widziała
   w szaro wypełnionych ścianach tylko ich 3-pikselowe kontury. Ściany rysowane samym konturem → nazwana odmowa
   `WALL_STYLE`, nic nie jest budowane.
2. **Obrys roboczy dosuwany do pasm ścian** — tylko wewnątrz szkieletu. Sama bryła zachowuje obrys odrysowany
   (pierwsza próba dosunięcia bryły zabrała Ballinie 0,4 m wobec jej własnych wymiarów drukowanych — cofnięte).
3. **Przerwy w ścianach zewnętrznych** (okna z liniami szklenia, drzwi) — w pikselach arkusza, z bokiem obrysu.
4. **Ściany działowe i drzwi wewnętrzne** czytnikiem LOCAL na arkuszu zamalowanym kolorem ścian.
5. **Meble w kolorze ścian nie są ścianami** (1.1.0, znalezione na nakładkach, nie na liczbach): kawałek wzdłuż dłuższej
   ściany bliżej niż 0,3 m (szafka), kawałki zamykające pierścień bez wejścia (łóżko, stół), grupa mniejsza niż 0,9 m,
   kawałek, którego żaden koniec niczego nie dotyka (zderzak samochodu) — odrzucane po nazwie razem z „drzwiami"
   odczytanymi obok nich. Otwarta grupa wielkości pomieszczenia (trzy ściany spiżarni) zostaje.

Szkielet jest przenoszony do układu modelu tą samą transformacją co obrys (z obrotem, gdy bryła stoi w układzie
elewacji) i zapisywany w zdarzeniach (`PLAN_SKELETON`, `PLAN_FRAME_OF_MODEL` — trzy punkty, z których każdy może
odtworzyć nakładkę modelu na rzut).

### 2.2 Konsumenci szkieletu

- **`BUILD_INTERIOR`** (operacja własna analizatora, nie do zamówienia przez recenzenta): ściany `INTERIOR` i drzwi
  wewnętrzne w jednej transakcji; ściany, które zachodziłyby na siebie, są docinane (jądro odmawia ścian dzielących
  rzut). Działa na bryle ze źródeł **i** na bryle LOCAL, która nie ma żadnej ściany wewnętrznej. Wnętrza, które LOCAL
  odczytał, nie rusza.
- **Przerwy rzutu jako świadek otworów** (strata D): patrz tabela w §1.
- **Uzupełnienie przerw rzutu, których model nie pokrywa** (`ADD_PLAN_OPENING`): rozpiętość z rzutu, rodzaj, parapet
  i wysokość z drugiego, typowanego odczytu elewacji — listy otworów **w metrach** wzdłuż elewacji o znanej szerokości
  (`facade-metric.ts`). Otwór stojący tam, gdzie rzut rysuje ścianę, ustępuje; otwór stojący na przerwie rzutu blokuje.

### 2.3 Bryła

- `wingsOf`: dowolny obrys ortogonalny → do 4 korpusów (największy prostokąt wpisany najpierw); używane dopiero, gdy
  zawodzi prostokąt i L. To zamienia `UNSUPPORTED_FORM` w model — często słaby (Willa Eliza), ale nie w brak modelu.
- **Dwa korpusy w linii spotykają się na ścianie z rzutu**: elewacje mówią, *że* dach ma uskok, rzut mówi *gdzie* stoi
  ściana (Aletta: uskok z elewacji 3,02 m, ściana na rzucie 4,1 m).
- **Wysokość budynku ze strony rozstrzyga ćwierć obrotu.** Odczyt „jak w podpisach" i „obrócony o 90°" kładą te same
  narysowane wysokości na różnych szerokościach; gdy strona podaje wysokość i tylko jeden odczyt ją trafia, wygrywa on —
  przed liczeniem zgodnych widoków (dwa widoki mogą zgadzać się na złej szerokości: Jarzębina).
- **Obraz, który nie rejestruje się na żadnej z dwóch brył, nie wybiera żadnej** (arbitraż 1.2.0): jest odkładany po
  obu stronach, po nazwie; bryła zastępująca LOCAL nadal musi być niesprzeczna ze wszystkim innym.
- **Dolna krawędź dachu to wierzch ściany, nie wierzch dachu**, gdy żaden szczyt nie daje uzgodnionego narożnika:
  brana jako wierzch połaci stawiała stromy dach 0,4 m w jego własnych ścianach i żadne drzwi pod nim nie były wycinane.
- **Skala z wymiarów budynku drukowanych na planie sytuacyjnym** (`site-dimensions.ts`): jeden mały typowany odczyt,
  używany tylko jako para zgodna na obu rozpiętościach obrysu (≤ 3 %). Progu nie ruszono dla domu, któremu zabrakło 0,3 %.

### 2.4 Otwory

Konsument `GLAZED_WALL`; drzwi ze świadkiem z rzutu; nadproże drzwi lub bramy wystające ≤ 25 % ponad ścianę jest
docinane do ściany; otwór w ≥ 85 % mieszczący się w ścianie jest docinany do jej końca; stabilne identyfikatory.

## 3. Rysunek kontra JSON z wymiarami — eksperyment na prośbę OWNER-a

Pytanie: czy opis z API jako lista elementów z pozycjami i wymiarami niesie więcej niż „minimalistyczny obraz" (szkic
konturowy w pikselach)? Zmierzone na tych samych elewacjach, wobec tego samego świadka, którego nie czytał żaden model:
przerw narysowanych w ścianie tej strony na rzucie parteru (`read-compare.ts`).

- **SZKIC** — obecny odczyt konturowy (wielokąty w pikselach obrazu),
- **JSON-A** — jedno żądanie: końce ściany w pikselach, każdy otwór jako odcinek 0..1 między nimi,
- **JSON-B** — jedno żądanie, z podaną szerokością elewacji w metrach (z rzutu): każdy otwór w metrach od lewego
  narożnika, z szerokością, parapetem i wysokością.

<!-- READCMP -->

Wniosek, bez upiększania: lista JSON **nie wykrywa więcej** niż szkic na większości elewacji — jest równa, a na jednej
(front Alberto) lepsza. Jej przewaga jest gdzie indziej: pozycja wzdłuż ściany w metrach nie przechodzi przez
rejestrację obrazu (końce ścian, wiersz gruntu, okap) ani przez bramkę kontrastu, więc można ją przyłożyć wprost do
przerwy rzutu; kosztuje ok. 0,02 USD za elewację. Dlatego nie zastąpiła szkicu (szkic niesie dach, kominy, wykończenie
i kształt ścian, których lista nie ma), tylko została **drugim, niezależnym odczytem** używanym do jednej rzeczy:
zapełnienia przerwy rzutu, której model po szkicu nadal nie pokrywa. Kolejność LOCAL/API/szkic nie jest założona
z góry: rzut (deterministycznie) daje rozpiętość, szkic lub lista dają rodzaj i wysokości, a źródłowa bramka rozstrzyga.

<!-- REST -->
