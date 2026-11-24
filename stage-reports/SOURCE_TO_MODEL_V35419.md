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
- **Typowany opis formy domu jako świadek arbitrażu** (`form-read.ts`, jedno żądanie, wszystkie podpisane elewacje):
  pytany tylko wtedy, gdy bryła LOCAL to dom ze spadzistym dachem i płaskimi „pudełkami" obok (LOCAL buduje cofnięty
  front jako osobną bryłę pod płaskim dachem; rejestracja elewacji po końcach ścian i wymiary drukowane zgadzają się
  z taką bryłą równie dobrze). Pomiar, który do tego doprowadził: §3.2.
- **Obrys na zewnętrznej linii ścian tam, gdzie mówią to wymiary drukowane** (`outerFaceOutline`): arkusz rysujący ścianę
  warstwami (ciemny rdzeń, jaśniejsza warstwa zewnętrzna zamknięta cienką linią) ma wymiary całkowite na tej cienkiej
  linii, a odrys API szedł raz po rdzeniu, raz po linii. Gdy dwa wymiary drukowane nie zgadzają się na obrysie
  odrysowanym (> 3 %), a zgadzają na obrysie dosuniętym do zewnętrznej linii — bryła staje na tej linii, w skali z pary
  wymiarów (Novara: 4,0 % → 0,1 %). Szkielet nadal czyta po rdzeniu.
- **Dwa korpusy w linii są czytane tam, gdzie elewacje rysują uskok, a budowane na ścianie z rzutu** (okap wyższego dachu
  nachodzi na niższy korpus; czytany po rozpiętości z rzutu, niższy korpus brał cudzy dach za własny).
- **Skala z wymiarów budynku drukowanych na planie sytuacyjnym** (`site-dimensions.ts`): jeden mały typowany odczyt,
  używany tylko jako para zgodna na obu rozpiętościach obrysu (≤ 3 %). Progu nie ruszono dla domu, któremu zabrakło 0,3 %.

### 2.4 Otwory

Konsument `GLAZED_WALL`; drzwi ze świadkiem z rzutu; nadproże drzwi lub bramy wystające ≤ 25 % ponad ścianę jest
docinane do ściany; otwór w ≥ 85 % mieszczący się w ścianie jest docinany do jej końca; stabilne identyfikatory.

### 2.5 Runda R2 — po pierwszym pomiarze odłożonym (NEW-E: 0 → 0)

Pierwszy pomiar transferu wypadł źle (§6.2) i wskazał trzy przyczyny w budowie bryły z obrysu. Każda została naprawiona
ogólnie (bez nazw domów, bez współrzędnych), z testem i kontrpróbą; dwie dalsze znalazłem na powtórkach tych samych nagrań.

| Przyczyna (dom, na którym wyszła) | Reguła po R2 | Kontrpróba w teście |
|---|---|---|
| Szerokość budynku na elewacji brana z rozpiętości **wszystkich** wielokątów ścian — cokół z kamienia i murek tarasu wybiegające poza dom dawały 825 px zamiast 548, skalę 2/3 prawdziwej i „okap na 1,59 m: to nie kondygnacja" (Oban III) | `wallEndsPx`: szerokość w wierszu w połowie wysokości kondygnacji (między gruntem a najniższą krawędzią dachu); ta sama funkcja we wszystkich rejestracjach, także w `orientationOf`, które przekazywało pustą listę dachów i przez to zostawało przy starej szerokości (znalezione na powtórce) | wiersz przecinający < 40 % starej rozpiętości niczego nie zmienia; elewacja bez dachu zostaje przy pełnej rozpiętości |
| Obrys ze skośnym wykuszem (33°) odrzucany jako „poza obsługiwaną formą" (Juliusz Nowy) | `squareOblique`: skośna krawędź zastępowana narożnikiem **na zewnątrz** obrysu; granica 2 % prostokąta opisanego na krawędź i 5 % łącznie; zapis `squared {edges, addedPx2}` | ściana skośna przez pół domu (ponad granicę) nadal jest odmową po nazwie |
| Obrys z wieloma uskokami cięty „największym prostokątem" tracił skrzydło: bryła 14,70 × 6,08 m przy drukowanych 15,60 × 9,65 (Amarylis) | częściowe uproszczenie małych uskoków, potem **dokładny podział** na ≤ 4 prostokąty bez reszty (`partitionOf`); pierwszeństwo ma podział, w którym każdy prostokąt jest pełnoprawną bryłą | obrys bez takiego podziału dostaje podział z paskiem, a wywołujący go odrzuca i wraca do `wingsOf` |
| Okno narysowane pod sam okap odrzucane w całości (`OPENING_NOT_CUT`): ściana „niosła" wysokość kalenicy, a kompilator kończy ją na spodzie dachu (Oban III — trzy okna frontu) | `cuttableTopM`: pod okapem dachu dwuspadowego ściana kończy się na spodzie połaci; nadproże wystające najwyżej o ¼ wysokości otworu jest przycinane (okna i drzwi), z zapisem `headCut` | ściana szczytowa i ściana bez dachu zachowują własną wysokość; > 25 % ponad ścianę → odmowa jak dotąd |
| Wymiar drukowany porównywany z bryłą, w której konwencja świadomie pominęła małe uskoki (9,16 m wobec 9,65 m) — bryła „sprzeczna ze źródłem" (Amarylis) | arbitraż 1.3.0: wymiar porównywany z obrysem odrysowanym, gdy prostokąt bryły zachowuje wszystko poza `totalShare` (12 %) prostokąta obrysu; zapis `outlineM` obok `modelM` | bryła, która zgubiła skrzydło, nadal jest sprzeczna |

## 3. Rysunek kontra JSON z wymiarami — eksperyment na prośbę OWNER-a

Pytanie: czy opis z API jako lista elementów z pozycjami i wymiarami niesie więcej niż „minimalistyczny obraz" (szkic
konturowy w pikselach)? Zmierzone na tych samych elewacjach, wobec tego samego świadka, którego nie czytał żaden model:
przerw narysowanych w ścianie tej strony na rzucie parteru (`read-compare.ts`).

- **SZKIC** — obecny odczyt konturowy (wielokąty w pikselach obrazu),
- **JSON-A** — jedno żądanie: końce ściany w pikselach, każdy otwór jako odcinek 0..1 między nimi,
- **JSON-B** — jedno żądanie, z podaną szerokością elewacji w metrach (z rzutu): każdy otwór w metrach od lewego
  narożnika, z szerokością, parapetem i wysokością.

### 3.1 Otwory: szkic kontra lista JSON

| Dom | Elewacja | Przerwy rzutu | SZKIC: trafione | JSON-A: trafione | JSON-B: trafione |
|---|---|---|---|---|---|
| alaska | REAR | 1 | 1/1 | 1/1 | 1/1 |
| alberto | FRONT | 4 | 2/4 (+1 poza przerwami) | 4/4 (+1 poza przerwami) | 4/4 (+1 poza przerwami) |
| alberto | REAR | 4 | 4/4 | 4/4 | 4/4 |
| aletta | FRONT | 4 | 4/4 (+1 poza przerwami) | 4/4 (+1 poza przerwami) | 4/4 (+1 poza przerwami) |
| aletta | REAR | 4 | 3/4 (+1 poza przerwami) | 3/4 (+1 poza przerwami) | 3/4 (+1 poza przerwami) |
| aurora | FRONT | 4 | 4/4 (+1 poza przerwami) | 4/4 (+1 poza przerwami) | 4/4 (+1 poza przerwami) |
| aurora | REAR | 3 | 3/3 (+1 poza przerwami) | 3/3 (+1 poza przerwami) | 3/3 (+1 poza przerwami) |
| ballina | REAR | 4 | 3/4 | 3/4 | 3/4 |
| ballina | FRONT | 5 | 5/5 | 5/5 | 5/5 |
| sakura | FRONT | 5 | 5/5 | 5/5 | 5/5 |
| sakura | REAR | 4 | 4/4 | 4/4 | 4/4 |
| **razem** | 11 elewacji | 42 | 38/42 | 40/42 | 40/42 |

Koszt eksperymentu: 0.2000 USD (11 elewacji × 2 żądania, Sonnet 5.5).


Wniosek, bez upiększania: lista JSON **nie wykrywa więcej** niż szkic na większości elewacji — jest równa, a na jednej
(front Alberto) lepsza. Jej przewaga jest gdzie indziej: pozycja wzdłuż ściany w metrach nie przechodzi przez
rejestrację obrazu (końce ścian, wiersz gruntu, okap) ani przez bramkę kontrastu, więc można ją przyłożyć wprost do
przerwy rzutu; kosztuje ok. 0,02 USD za elewację. Dlatego nie zastąpiła szkicu (szkic niesie dach, kominy, wykończenie
i kształt ścian, których lista nie ma), tylko została **drugim, niezależnym odczytem** używanym do jednej rzeczy:
zapełnienia przerwy rzutu, której model po szkicu nadal nie pokrywa. Kolejność LOCAL/API/szkic nie jest założona
z góry: rzut (deterministycznie) daje rozpiętość, szkic lub lista dają rodzaj i wysokości, a źródłowa bramka rozstrzyga.

### 3.2 Forma domu: sylwetki ze szkiców kontra jeden typowany opis JSON

Drugie pytanie z tej samej wskazówki: czy **forma** domu — ile brył, jaki dach, w którą stronę kalenica, ile kondygnacji —
nie ginie na drodze „szkic konturowy → sylwetka każdej elewacji osobno → solver bryły"? Jedno żądanie ze wszystkimi
podpisanymi elewacjami i typowaną odpowiedzią (`research/source-to-model/v35419/form-read.ts`), obok tego, co z tych
samych obrazów zbudował potok:

| Dom | Opis JSON formy (jedno żądanie, wszystkie elewacje) | Co zbudował potok ze szkiców (partia a4) |
|---|---|---|
| alaska | parter + poddasze; brył 1; dach dwuspadowy 42°, kalenica prostopadle do frontu; części niższe: —; lukarny 0, kominy 2, okna poł. 8 | brył 1; dwuspadowy 38.2°; kominy 2, okna poł. 8 |
| aurora | parter; brył 1; dach dwuspadowy 35°, kalenica równolegle do frontu; części niższe: —; lukarny 0, kominy 3, okna poł. 1 | brył 1; dwuspadowy 35°; kominy 3, okna poł. 1 |
| ballina | parter; brył 1; dach dwuspadowy 30°, kalenica równolegle do frontu; części niższe: —; lukarny 0, kominy 0, okna poł. 0 | brył 1; dwuspadowy 30.8°; kominy 0, okna poł. 0 |
| alberto | parter; brył 1; dach dwuspadowy 30°, kalenica równolegle do frontu; części niższe: —; lukarny 0, kominy 2, okna poł. 1 | brył 1; dwuspadowy 25.2°; kominy 2, okna poł. 0 |
| medulin | parter + poddasze; brył 1; dach dwuspadowy 45°, kalenica prostopadle do frontu; części niższe: —; lukarny 0, kominy 1, okna poł. 0 | brył 3; płaski, płaski, płaski, dwuspadowy 45°; kominy 0, okna poł. 0 |
| jeziorko | parter; brył 1; dach dwuspadowy 30°, kalenica równolegle do frontu; części niższe: —; lukarny 0, kominy 1, okna poł. 0 | brył 1; dwuspadowy 30°; kominy 1, okna poł. 0 |
| mindelo | parter; brył 1; dach dwuspadowy 40°, kalenica równolegle do frontu; części niższe: —; lukarny 0, kominy 2, okna poł. 0 | brył 2; płaski, płaski, płaski, płaski, dwuspadowy 30°; kominy 2, okna poł. 0 |
| sakura | parter; brył 1; dach czterospadowy 30°, kalenica równolegle do frontu; części niższe: —; lukarny 0, kominy 2, okna poł. 0 | brył 1; 4 połacie (czterospadowy); kominy 2, okna poł. 0 |
| g6 | parter; brył 1; dach czterospadowy 35°, kalenica równolegle do frontu; części niższe: —; lukarny 0, kominy 0, okna poł. 0 | brył 1; 4 połacie (czterospadowy); kominy 0, okna poł. 0 |
| aletta | parter + poddasze; brył 2; dach dwuspadowy 40°, kalenica równolegle do frontu; części niższe: garage (dwuspadowy, left); lukarny 0, kominy 2, okna poł. 5 | brył 2; dwuspadowy 43.7°, dwuspadowy 35°; kominy 2, okna poł. 8 |
| novara | parter; brył 1; dach dwuspadowy 35°, kalenica równolegle do frontu; części niższe: —; lukarny 0, kominy 0, okna poł. 0 | brył 1; płaski, płaski, dwuspadowy 30°; kominy 0, okna poł. 0 |
| jarzebina | parter + poddasze; brył 2; dach dwuspadowy 40°, kalenica równolegle do frontu; części niższe: garage (dwuspadowy, right); lukarny 1, kominy 2, okna poł. 3 | brył 2; BRAK DACHU; kominy 0, okna poł. 0 |
| eliza | dwie kondygnacje; brył 2; dach czterospadowy 22°, kalenica równolegle do frontu; części niższe: garage (czterospadowy, right); lukarny 0, kominy 3, okna poł. 0 | brył 2; dwuspadowy 28.8°, dwuspadowy 66.3°; kominy 6, okna poł. 0 |

Koszt: 0.1712 USD za 13 domów (Sonnet 5.5).

Sprawdzone z cechami referencyjnymi spisanymi ze źródeł (`references/`): rodzaj dachu głównego i kierunek kalenicy są
w opisie JSON zgodne ze źródłem **na 13 z 13 domów**. Potok ze szkiców mylił formę na czterech: Novara, Medulin
i Mindelo dostały płaskie „pudełka" obok dachu dwuspadowego (rysunki ich nie pokazują), Willa Eliza — dwa strome dachy
dwuspadowe zamiast niskiego czterospadowego nad dwiema kondygnacjami; Jarzębina w kodzie 1351 nie miała dachu wcale.
Liczba brył w opisie JSON jest mniej pewna (Mindelo: poprzeczny szczyt garażu policzony jako ta sama bryła) i nie jest
używana.

**To jest ta informacja, którą obrazy-szkice gubiły, i tu OWNER miał rację.** Wdrożone od razu, w najwęższej bezpiecznej
roli: opis formy jest **świadkiem w arbitrażu brył** (§2.3) — bryła LOCAL z płaskimi „pudełkami", których opis nie
zgłasza, jest przez niego podważona; bryłę zastępczą nadal buduje ten sam solver z obrysu i sylwetek, a żaden wymiar nie
pochodzi z opisu. Skutek zmierzony na Novarze (§6). Niewdrożone w tej rundzie i nazwane jako następny krok: opis formy
jako **założenie wstępne solvera** (czterospad kontra dwuspad, dwie kondygnacje) — to by naprawiło Willę Elizę.

## 4. Protokół próby (zapisany przed biegami)

`research/source-to-model/v35419/PROTOCOL.md`. Skrót:

- **Baseline** = kod APK 1351 uruchomiony na tych samych bajtach źródeł (nie wspomnienie o nim).
- **DEV** (9 znanych domów: Alaska, Aurora, Ballina, Alberto, Medulin, Domek nad jeziorkiem, Mindelo, Dom pod sakurą,
  G6) — jawnie nie-ślepe, tu wolno było stroić.
- **NEW-D** (4 nowe domy, losowane z pul czterech wydawców: Aletta New, Novara, Jarzębina, Willa Eliza 5 G2) —
  najpierw sam baseline i zapis pierwszych wyników (`FIRST_LOOK_NEW-D.md`: **0 z 4** całych wyników), dopiero potem
  stały się rozwojowe.
- **NEW-E** (3 odłożone domy: Amarylis, Oban III, Juliusz Nowy) — nieotwierane do zamrożenia kodu, po jednym biegu na
  baseline i na kodzie zamrożonym, niczego potem nie strojono. Pula ARCHON nie dała drugiego domu (§6 protokołu).
- **Cały wynik domu** = zewnętrze użyteczne (reguła „użytecznej miniatury" z v3.54.18, bez zmian) **oraz** wnętrze
  zgodne z rzutem (nakładka: ≥ 70 % ścian rysowanych przez rzut obecnych, ≤ 20 % ścian modelu zmyślonych, obrys zgodny
  lub jawnie uproszczony). Brak modelu albo puste wnętrze to porażka, nie „nieoceniane".
- **Kryterium z góry:** na NEW-E liczba całych wyników rośnie o ≥ 2 wobec baseline i żaden dom nie traci cechy formy ani
  dobrego wnętrza. Limit kosztu etapu 14 USD.
- Zamrożenie i dwa odstępstwa kolejności (bez otwierania wyników): §7 protokołu.

## 5. Testy przyczynowe i kontrpróby

Każda reguła ma test, który odtwarza stratę, i próbę, która ma **nie** przejść. Nowe pliki testów (kontrolowane
arkusze, bryły i obrazy — nie domy z benchmarku):

| Plik | Testów | Co sprawdza (z kontrpróbą) |
|---|---|---|
| `plan-skeleton-v35419.test.ts` | 28 | kolor ścian arkusza (kontra: ściany samym konturem → nazwana odmowa); dosuw do pasm; przerwy zewnętrzne; ściana z drzwiami; `BUILD_INTERIOR` w jednej transakcji (kontra: istniejące wnętrze zostaje, recenzent nie może zamówić operacji); bryła obrócona; `ADD_PLAN_OPENING` (kontra: brak przerwy → brak otworu; otwór na przerwie rzutu nie ustępuje); docinanie ścian; meble (kontra: spiżarnia zostaje, ściana o korytarz dalej zostaje, kikut przy drzwiach zostaje); zewnętrzna linia ścian (kontra: krótka kreska to nie linia ściany) |
| `openings-v35419.test.ts` | 7 | drzwi na przerwie rzutu mimo braku kontrastu (kontra: okno nadal wymaga obrazu, drzwi obok przerwy i przerwa innej kondygnacji nie świadczą); nadproże docięte do ściany (kontra: > 25 % ponad ścianę → odmowa); koniec ściany (kontra: połowa otworu poza ścianą → odmowa); konsument `GLAZED_WALL` (kontra: nieznany rodzaj nadal nazwany jako pominięty) |
| `wings-v35419.test.ts` | 9 | T i U jako korpusy (kontra: wykusz nie jest korpusem, obrys ukośny nieczytany); najwyżej 4 korpusy; „iglica" (kontra: stromy, ale możliwy dach 50° zostaje); podział na ścianie z rzutu (kontra: ściana za daleko lub za krótka nic nie przesuwa); wymiary z planu sytuacyjnego (kontra: para niezgodna nie jest skalą) |
| `form-read-v35419.test.ts` | 4 | werdykt formy (kontra: zgłoszony garaż z płaskim dachem nie jest sprzecznością; bryła bez dachu nie jest potwierdzona); odpowiedź sprzeczna wewnętrznie lub nietypowana → odmowa po nazwie |
| `review-applied-v35419.test.ts` | 2 | ponowne pytanie o werdykty (kontra: tylko raz; nie pyta, gdy werdykty są albo nic nie nałożono) |
| `hip-v35418.test.ts` (dopisane) | 3 | wysokość ze strony rozstrzyga ćwierć obrotu (kontra: wysokość niepasująca do żadnego odczytu nie rozstrzyga niczego) |

<!-- REST -->
