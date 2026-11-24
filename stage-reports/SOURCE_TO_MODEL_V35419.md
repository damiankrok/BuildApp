# BuildPlan v3.54.19 — bryła, otwory i wnętrze z rzutu (po audycie APK 1351)

Etap: 2026-11-24. Gałąź `claude/new-session-3kzcgh`. Baseline zamrożony: kod APK 1351 (`58ff26a`, drzewo `9ac25b6`).
Protokół zapisany przed biegami: `research/source-to-model/v35419/PROTOCOL.md`. Decyzje architektoniczne:
`docs/ADR-V35419-PLAN-SKELETON.md`. Krótko dla OWNER-a: `stage-reports/README_V35419.md`.

Renderów z komputera nie nazywam zrzutami z telefonu. W tej sesji nie było telefonu ani emulatora: APK jest zbudowany
i podpisany, **na urządzeniu niesprawdzony** (`ANDROID_UI_NOT_VERIFIED`).

## Werdykt w pięciu zdaniach

1. **Cel zapisany przed biegami nie został osiągnięty.** Na pierwszej próbie odłożonej (NEW-E, kod zamrożony `4c2c73e`)
   liczba całych wyników to **0 → 0**; na drugiej (NEW-F, kod zamrożony `af7db0e`, po rundzie poprawek R2) **0 → 1**
   przy wymaganych +2 — a ten jeden zysk jest kruchy (§6.6).
2. **Na nowe projekty przenosi się wnętrze z rzutu.** Ocena ślepa na NEW-F: wnętrze zgodne z rzutem 1 → 3 z 4 domów
   (Ametyst New 15/18 ścian rzutu, Fabia 18/19, bez ścian zmyślonych ponad próg); na wszystkich 20 domach 6 → 18.
3. **Bryła i dach nadal się nie przenoszą.** Dom piętrowy z garażem powstaje jako parterowy ze stromym dachem (Skagen),
   dach czterospadowy jako dwuspadowy (Fabia), a drzwi wejściowe w ścianie szczytowej giną (Ametyst New); zewnętrze
   użyteczne na NEW-F to 0 → 1.
4. **Na wszystkich 20 domach** (9 znanych, 11 nowych): cały wynik 2 → 9, zewnętrze użyteczne 6 → 9; oceniający, nie
   wiedząc który wariant jest który, uznał końcowy za bliższy źródłu w 15 domach, baseline w 2, remis w 3.
5. **Są straty** (§8): Novara przestała być „użyteczna" (brak wnęki wejściowej, choć jako całość oceniona bliżej źródła),
   Amarylis ma 5 otworów zewnętrznych zamiast 17, Ametyst New i Fabia straciły komin, Medulin i Domek nad jeziorkiem
   oceniono bliżej źródła w wariancie 1351.


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
- **NEW-E** (3 odłożone domy: Amarylis, Oban III, Juliusz Nowy) — nieotwierane do zamrożenia 1 (`4c2c73e`), po jednym
  biegu na baseline i na kodzie zamrożonym. Wynik 0 → 0 (§6.2). Po otwarciu zbiór rozwojowy; na nim powstała runda R2.
- **NEW-F** (4 domy losowane po R2 tą samą regułą, nową etykietą ziarna: Ametyst New, Skagen, Fabia, Dom pod pomarańczą
  2) — reguła zapisana przed losowaniem (§8 protokołu), zamrożenie 2 (`af7db0e`) zapisane przed pierwszym biegiem,
  po jednym biegu na baseline i na kodzie zamrożonym, niczego potem nie strojono.
- **Cały wynik domu** = zewnętrze użyteczne (reguła „użytecznej miniatury" z v3.54.18, bez zmian) **oraz** wnętrze
  zgodne z rzutem (nakładka: ≥ 70 % ścian rysowanych przez rzut obecnych, ≤ 20 % ścian modelu zmyślonych, obrys zgodny
  lub jawnie uproszczony). Brak modelu albo puste wnętrze to porażka, nie „nieoceniane".
- **Kryterium z góry:** na próbie odłożonej liczba całych wyników rośnie o ≥ 2 wobec baseline i żaden dom nie traci cechy formy ani
  dobrego wnętrza. Limit kosztu etapu 14 USD.
- Zamrożenie i dwa odstępstwa kolejności (bez otwierania wyników): §7 protokołu.

## 5. Testy przyczynowe i kontrpróby

Każda reguła ma test, który odtwarza stratę, i próbę, która ma **nie** przejść. Nowe pliki testów (kontrolowane
arkusze, bryły i obrazy — nie domy z benchmarku):

| Plik | Testów | Co sprawdza (z kontrpróbą) |
|---|---|---|
| `plan-skeleton-v35419.test.ts` | 28 | kolor ścian arkusza (kontra: ściany samym konturem → nazwana odmowa); dosuw do pasm; przerwy zewnętrzne; ściana z drzwiami; `BUILD_INTERIOR` w jednej transakcji (kontra: istniejące wnętrze zostaje, recenzent nie może zamówić operacji); bryła obrócona; `ADD_PLAN_OPENING` (kontra: brak przerwy → brak otworu; otwór na przerwie rzutu nie ustępuje); docinanie ścian; meble (kontra: spiżarnia zostaje, ściana o korytarz dalej zostaje, kikut przy drzwiach zostaje); zewnętrzna linia ścian (kontra: krótka kreska to nie linia ściany) |
| `openings-v35419.test.ts` | 9 | drzwi na przerwie rzutu mimo braku kontrastu (kontra: okno nadal wymaga obrazu, drzwi obok przerwy i przerwa innej kondygnacji nie świadczą); nadproże docięte do ściany (kontra: > 25 % ponad ścianę → odmowa); koniec ściany (kontra: połowa otworu poza ścianą → odmowa); konsument `GLAZED_WALL` (kontra: nieznany rodzaj nadal nazwany jako pominięty) |
| `wings-v35419.test.ts` | 18 | T i U jako korpusy (kontra: wykusz nie jest korpusem, obrys ukośny nieczytany); najwyżej 4 korpusy; „iglica" (kontra: stromy, ale możliwy dach 50° zostaje); podział na ścianie z rzutu (kontra: ściana za daleko lub za krótka nic nie przesuwa); wymiary z planu sytuacyjnego (kontra: para niezgodna nie jest skalą) |
| `form-read-v35419.test.ts` | 4 | werdykt formy (kontra: zgłoszony garaż z płaskim dachem nie jest sprzecznością; bryła bez dachu nie jest potwierdzona); odpowiedź sprzeczna wewnętrznie lub nietypowana → odmowa po nazwie |
| `review-applied-v35419.test.ts` | 2 | ponowne pytanie o werdykty (kontra: tylko raz; nie pyta, gdy werdykty są albo nic nie nałożono) |
| `hip-v35418.test.ts` (dopisane) | 3 | wysokość ze strony rozstrzyga ćwierć obrotu (kontra: wysokość niepasująca do żadnego odczytu nie rozstrzyga niczego) |

## 6. Wyniki

Wszystkie „przed" to kod APK 1351 uruchomiony na tych samych bajtach źródeł. Kod końcowy = zamrożenie 2 (`af7db0e`).
DEV i NEW-D: odczyty elewacji, odczyty przerw rzutu i recenzja odtworzone z nagrań biegu końcowego zamrożenia 1 (0 USD).
NEW-E: nagrania biegu zamrożenia 1 + odczyty przerw rzutu i recenzja na żywo. NEW-F: oba warianty na żywo, po jednym biegu.

### 6.1 Co powstało (liczone z modeli)

| Dom | Zbiór | Kod 1351 (baseline) | Kod końcowy | Przerwy rzutu pokryte otworem (1351 → końcowy) |
|---|---|---|---|---|
| Alaska (Studio Atrium) | DEV | ze źródeł; dach: dwusp. 38.2°; ściany wewn. 0 (drzwi 0); otwory zewn. 11; okna poł. 8; kominy 2 | ze źródeł; dach: dwusp. 38.2°; ściany wewn. 11 (drzwi 6); otwory zewn. 11; okna poł. 8; kominy 2 | 8/8 (+1 na pełnej ścianie) → 8/8 (+1 na pełnej ścianie) |
| Aurora maxi II bis sz (Studio Atrium) | DEV | ze źródeł; dach: dwusp. 35°; ściany wewn. 0 (drzwi 0); otwory zewn. 9; okna poł. 1; kominy 3 | ze źródeł; dach: dwusp. 35°; ściany wewn. 15 (drzwi 7); otwory zewn. 10; okna poł. 1; kominy 3 | 7/9 (+2 na pełnej ścianie) → 8/9 (+2 na pełnej ścianie) |
| Ballina (Lipińscy) | DEV | ze źródeł; dach: dwusp. 30.2°; ściany wewn. 0 (drzwi 0); otwory zewn. 10; okna poł. 0; kominy 0 | ze źródeł; dach: dwusp. 30.8°; ściany wewn. 10 (drzwi 7); otwory zewn. 10; okna poł. 0; kominy 0 | 11/11 → 11/11 |
| Alberto (Studio Atrium) | DEV | ze źródeł; dach: dwusp. 25.1°; ściany wewn. 0 (drzwi 0); otwory zewn. 7; okna poł. 0; kominy 2 | ze źródeł; dach: dwusp. 25.2°; ściany wewn. 16 (drzwi 8); otwory zewn. 9; okna poł. 0; kominy 2 | 6/9 (+1 na pełnej ścianie) → 9/9 |
| Medulin (Lipińscy) | DEV | LOCAL; dach: płaski, płaski, płaski, dwusp. 45°; ściany wewn. 25 (drzwi 9); otwory zewn. 24; okna poł. 0; kominy 1 | LOCAL; dach: płaski, płaski, płaski, dwusp. 45°; ściany wewn. 25 (drzwi 9); otwory zewn. 24; okna poł. 0; kominy 2 | — → — |
| Domek letniskowy nad jeziorkiem (ARCHON) | DEV | LOCAL; dach: dwusp. 30°; ściany wewn. 5 (drzwi 2); otwory zewn. 7; okna poł. 0; kominy 1 | LOCAL; dach: dwusp. 30°; ściany wewn. 5 (drzwi 2); otwory zewn. 7; okna poł. 0; kominy 1 | — → — |
| Mindelo (Lipińscy) | DEV | LOCAL; dach: płaski, płaski, płaski, płaski, dwusp. 30°; ściany wewn. 15 (drzwi 11); otwory zewn. 18; okna poł. 0; kominy 2 | LOCAL; dach: płaski, płaski, płaski, płaski, dwusp. 30°; ściany wewn. 15 (drzwi 11); otwory zewn. 19; okna poł. 0; kominy 2 | — → — |
| Dom pod sakurą E (ARCHON) | DEV | ze źródeł; dach: 4 połaci; ściany wewn. 0 (drzwi 0); otwory zewn. 8; okna poł. 0; kominy 3 | ze źródeł; dach: 4 połaci; ściany wewn. 20 (drzwi 11); otwory zewn. 11; okna poł. 0; kominy 3 | — → 7/8 (+4 na pełnej ścianie) |
| G6 (garaż ze strychem — nie dom mieszkalny) (Dobre Domy) | DEV | ze źródeł; dach: 4 połaci; ściany wewn. 0 (drzwi 0); otwory zewn. 3; okna poł. 0; kominy 0 | ze źródeł; dach: 4 połaci; ściany wewn. 0 (drzwi 0); otwory zewn. 5; okna poł. 0; kominy 0 | — → 4/4 (+1 na pełnej ścianie) |
| Aletta New (Studio Atrium) | NEW-D | ze źródeł; dach: dwusp. 43.7°, dwusp. 35°; ściany wewn. 0 (drzwi 0); otwory zewn. 10; okna poł. 8; kominy 2 | ze źródeł; dach: dwusp. 42.7°, dwusp. 35°; ściany wewn. 10 (drzwi 3); otwory zewn. 15; okna poł. 8; kominy 2 | 8/11 (+1 na pełnej ścianie) → 9/11 (+3 na pełnej ścianie) |
| Novara (Lipińscy) | NEW-D | LOCAL; dach: płaski, płaski, dwusp. 30°; ściany wewn. 13 (drzwi 7); otwory zewn. 21; okna poł. 0; kominy 0 | ze źródeł; dach: dwusp. 30°; ściany wewn. 10 (drzwi 8); otwory zewn. 13; okna poł. 0; kominy 0 | — → 11/11 (+2 na pełnej ścianie) |
| Jarzębina (Dobre Domy) | NEW-D | LOCAL; dach: BRAK; ściany wewn. 1 (drzwi 0); otwory zewn. 29; okna poł. 0; kominy 0 | ze źródeł; dach: dwusp. 46.3°; ściany wewn. 15 (drzwi 4); otwory zewn. 12; okna poł. 3; kominy 2 | — → 9/12 (+1 na pełnej ścianie) |
| Willa Eliza 5 G2 (ARCHON) | NEW-D | **BRAK MODELU** | ze źródeł; dach: dwusp. 28.3°, dwusp. 41.7°, dwusp. 28.3°; ściany wewn. 10 (drzwi 4); otwory zewn. 10; okna poł. 0; kominy 4 | — → 5/7 (+2 na pełnej ścianie) |
| Amarylis (Studio Atrium) | NEW-E | LOCAL; dach: płaski; ściany wewn. 8 (drzwi 4); otwory zewn. 17; okna poł. 0; kominy 0 | ze źródeł; dach: dwusp. 33.9°, dwusp. 42°, dwusp. 25°; ściany wewn. 12 (drzwi 8); otwory zewn. 5; okna poł. 1; kominy 0 | — → 1/7 (+2 na pełnej ścianie) |
| Oban III (Lipińscy) | NEW-E | **BRAK MODELU** | ze źródeł; dach: dwusp. 31.5°; ściany wewn. 8 (drzwi 3); otwory zewn. 8; okna poł. 0; kominy 1 | — → 8/8 (+1 na pełnej ścianie) |
| Juliusz Nowy (Dobre Domy) | NEW-E | **BRAK MODELU** | ze źródeł; dach: dwusp. 37.4°; ściany wewn. 11 (drzwi 7); otwory zewn. 4; okna poł. 0; kominy 2 | — → 3/9 |
| Ametyst New (Studio Atrium) | NEW-F | ze źródeł; dach: dwusp. 33.2°; ściany wewn. 0 (drzwi 0); otwory zewn. 8; okna poł. 1; kominy 1 | ze źródeł; dach: dwusp. 32.4°; ściany wewn. 12 (drzwi 6); otwory zewn. 9; okna poł. 1; kominy 0 | — → 9/9 |
| Skagen (Lipińscy) | NEW-F | ze źródeł; dach: dwusp. 48.2°; ściany wewn. 0 (drzwi 0); otwory zewn. 8; okna poł. 1; kominy 0 | ze źródeł; dach: dwusp. 48.2°; ściany wewn. 0 (drzwi 0); otwory zewn. 9; okna poł. 2; kominy 0 | — → 0/0 (+8 na pełnej ścianie) |
| Fabia (Dobre Domy) | NEW-F | ze źródeł; dach: dwusp. 27.5°; ściany wewn. 0 (drzwi 0); otwory zewn. 2; okna poł. 0; kominy 1 | ze źródeł; dach: dwusp. 28.8°; ściany wewn. 18 (drzwi 9); otwory zewn. 4; okna poł. 0; kominy 0 | 0/11 (+2 na pełnej ścianie) → 2/11 (+2 na pełnej ścianie) |
| Dom pod pomarańczą 2 (ARCHON) | NEW-F | LOCAL; dach: dwusp. 30°; ściany wewn. 16 (drzwi 10); otwory zewn. 11; okna poł. 1; kominy 3 | LOCAL; dach: dwusp. 30°; ściany wewn. 16 (drzwi 10); otwory zewn. 11; okna poł. 1; kominy 3 | — → — |

| Zbiór | Domów | Model (1351 → końcowy) | Model ze ścianami wewnętrznymi (1351 → końcowy) |
|---|---|---|---|
| DEV | 9 | 9 → 9 | 3 → 8 |
| NEW-D | 4 | 3 → 4 | 2 → 4 |
| NEW-E | 3 | 1 → 3 | 1 → 3 |
| NEW-F | 4 | 4 → 4 | 1 → 3 |

### 6.2 Pierwszy pomiar odłożony — NEW-E na zamrożeniu 1: 0 → 0

Trzy domy losowane razem z NEW-D i nieotwierane do zamrożenia `4c2c73e`. Wynik: **Amarylis** — w obu wariantach bryła
LOCAL z płaskim dachem (bryła ze źródeł odrzucona jako sprzeczna z wymiarami drukowanymi); **Oban III** i **Juliusz
Nowy** — w obu wariantach **brak modelu**. Żaden cały wynik, przed ani po. Wszystko, co poprawiono w etapie do tego
momentu, nie pomogło żadnemu z trzech nowych domów. Przyczyny i reguły po nich: §2.5. Ten wynik jest w galerii jako
osobny wariant „zamrożenie 1" obok baseline i kodu końcowego.

Po otwarciu NEW-E jest zbiorem rozwojowym: jego wynik na zamrożeniu 2 (Oban III: cały wynik; Juliusz Nowy: wnętrze
tak, zewnętrze nie; Amarylis: bliżej źródła, nadal nie) pokazuje, że przyczyny zostały usunięte, **nie** że kod się
przenosi. Do tego służy NEW-F (§6.6).

### 6.3 Zewnętrze — ocena ślepa

Oceniający: osobna instancja modelu bez dostępu do klucza losowania, z jedną planszą na dom (elewacje wydawcy u góry,
warianty X i Y niżej, przydział losowy osobno dla każdego domu) i cechami spisanymi ze źródeł przed obejrzeniem modeli.
Reguła „użytecznej miniatury" bez zmian od v3.54.18. To nie jest ocena człowieka i nie jest akceptacją produktu.

| Dom | Zbiór | Użyteczna: 1351 | Użyteczna: końcowy | Bliżej źródła | Uwaga oceniającego |
|---|---|---|---|---|---|
| Alaska | DEV | TAK | TAK | REMIS | Oba warianty praktycznie identyczne i zgodne z bryłą oraz otworami źródła; brakuje daszku nad wejściem, a szczyty są szare zamiast ciemnego drewna w białej ramie. |
| Aurora maxi II bis sz | DEV | TAK | TAK | końcowy | Y nie ma dużego przeszklenia tarasowego z lewej strony tyłu (zostają tylko drzwi i dwa okna); X je ma. W obu brak drewnianych pasów między oknami, a na szczycie jest dodatkowy niski brązowy element. |
| Ballina | DEV | TAK | TAK | REMIS | Warianty nierozróżnialne; układ otworów wszystkich czterech stron zgodny ze źródłem, brakuje jedynie strefy cegły na prawej połowie frontu (cegła jest tylko na szczycie i w panelu tyłu). |
| Alberto | DEV | NIE | TAK | końcowy | X nie ma drzwi wejściowych na froncie, Y ma je w prawej połowie i dwa osobne okna z lewej; w obu brak podcienia ze słupami i kamiennych ścian. |
| Medulin | DEV | NIE | NIE | 1351 | Oba warianty mają tę samą błędną bryłę (wąski szczyt plus płaskie bryły boczne zamiast jednego stromego dachu 45° na całej szerokości) i tę samą bramę z prawej. X ma dodatkowo dwa cienkie brązowe słupy sterczące ponad dach przy froncie, których źródło nie ma;  |
| Domek letniskowy nad jeziorkiem | DEV | TAK | TAK | 1351 | Warianty różnią się jednym elementem: X ma na tyle, na lewo od okna, ciemny panel w miejscu szarego panelu betonowego ze źródła (narysowany prawie czarno, więc może być czytany jak brama), Y go nie ma. Reszta — taras pod wspólnym dachem, drzwi, okna, przeszkle |
| Mindelo | DEV | NIE | NIE | REMIS | Warianty różnią się tylko jednym małym oknem na boku (podwójne w X, pojedyncze w Y). W obu brak poprzecznych szczytów nad garażem i tarasem, a w ich miejscu są duże czarne płaszczyzny; boki mają małe okna zamiast wysokich przeszkleń w drewnie. |
| Dom pod sakurą E | DEV | TAK | TAK | końcowy | Oba mają poprawny dach kopertowy i drzwi pośrodku. Y zamiast okna z prawej strony frontu ma brązowy element wyglądający jak drugie drzwi i nie ma dużego przeszklenia z prawej strony tyłu; X ma oba. Y ma za to drzwi na boku „prawie pełnym”, których X nie ma. Ko |
| G6 (garaż ze strychem — nie dom mieszkalny) | DEV | NIE | NIE | końcowy | Oba mają poprawny dach kopertowy i szeroką bramę z lewej, ale żaden nie ma drzwi wejściowych ani słupów podcienia; Y ma podwójne okno na obu bokach (X tylko na jednym) i ceglany ryzalit wokół okna. |
| Aletta New | NEW-D | NIE | TAK | końcowy | Y gubi bramę garażową i wszystkie otwory oraz drewno szczytu tarasowego (ściana ślepa); X ma komplet: bramę, drzwi, przeszklenie tarasu i dwa wysokie okna w drewnianym szczycie. |
| Novara | NEW-D | TAK | NIE | końcowy | X ma bardzo wierny front (wnęka wejściowa, panel drewna między przeszkleniami), ale na tyle dwa niskie pasy okien zamiast wysokich przeszkleń i ślepy lewy szczyt; Y nie ma wnęki ani drewna na froncie, za to wszystkie przeszklenia tyłu i obu szczytów są wysokie |
| Jarzębina | NEW-D | NIE | NIE | końcowy | X to poprawny dom z dachem dwuspadowym, bramą po prawej, drzwiami pośrodku i przeszkleniem tarasu od tyłu, ale bez frontowej lukarny z balkonem i z jednym ślepym szczytem; Y to pudło bez dachu z pasami szkła. |
| Willa Eliza 5 G2 | NEW-D | NIE | NIE | końcowy | Y nie ma modelu. X to zlepek brył pod dachami dwuspadowymi: front pokazuje tylko jedno okno, a duży brązowy otwór i przeszklenia (prawdopodobnie brama/wejście) są na stronie opisanej jako tył. |
| Amarylis | NEW-E | NIE | NIE | końcowy | X ma rozpoznawalny front (skrzydło garażu z bramą, duży szczyt z dwojgiem drzwi balkonowych, wejście z grafitową płytą), ale tył i boki są ślepe, a ściany tylne mają wysokość dwóch kondygnacji; Y to parterowe pudło bez dachu z pasami szkła. |
| Oban III | NEW-E | NIE | TAK | końcowy | Y nie ma modelu. X zgadza się ze źródłem na wszystkich stronach: drzwi pośrodku z oknami po bokach, trzy przeszklenia do podłogi od tyłu, jedno okno w lewym szczycie, komin, cokół; nie widać jedynie płytkiej wnęki wejścia. |
| Juliusz Nowy | NEW-E | NIE | NIE | końcowy | X nie ma modelu. Y to prosty dom ze szczytem od frontu, jednym oknem na parterze i jednym w szczycie, dwoma kominami; nie ma wejścia, bramy, balkonów ani poprzecznych szczytów. |
| Ametyst New | NEW-F | NIE | NIE | końcowy | W obu wariantach front nie ma drzwi wejściowych; X ma duże przeszklenie tarasowe na boku ogrodowym, którego Y nie ma, za to Y ma jeden komin (z trzech) i drewno w jednym szczycie. |
| Skagen | NEW-F | NIE | NIE | końcowy | W obu brak piętra i osobnego skrzydła garażu (parter frontu — przeszklenie, drzwi, wąskie okno, brama — jest poprawny). X ma od tyłu szerokie przeszklenie tarasowe i parę okien połaciowych od frontu; Y ma od tyłu tylko wąskie przeszklenie z drzwiami i jedno sz |
| Fabia | NEW-F | NIE | NIE | końcowy | Oba warianty mają dach dwuspadowy zamiast kopertowego. Y ma poprawny front (okno z lewej, drzwi pośrodku, okno z prawej), ale pozostałe strony ślepe; X nie ma drzwi i ma tylko pojedyncze, niepasujące otwory. |
| Dom pod pomarańczą 2 | NEW-F | NIE | TAK | końcowy | Jedyna istotna różnica to strefa wejścia na szczycie frontowym: X ma tam okno z brązowym podokiennikiem (bez drzwi), Y pełną drewnianą płaszczyznę do ziemi odpowiadającą okładzinie z drzwiami. Przeszklenie tarasu od tyłu jest w obu oknem w brązowej ramie, nie  |
| Dom | Zbiór | 1351: ściany rzutu obecne / rysowane; zmyślone / ścian modelu; obrys | Końcowy: to samo | Wnętrze zgodne (1351 → końcowy) |
|---|---|---|---|---|

Zastrzeżenia oceniającego, które zmieniają werdykt (podaję wszystkie, także te na niekorzyść kodu końcowego):

- **Novara (końcowy: NIE):** zawodzi wyłącznie cecha F4 — brak wnęki wejściowej; warunki 2–5 spełnione, wariant oceniony
  jako bliższy źródłu dzięki otworom. Baseline (bryła LOCAL z trzech pudełek) wnękę ma.
- **Dom pod pomarańczą 2 (końcowy: TAK):** drzwi są w kolorze okładziny, wejście czyta się jako jedna brązowa
  płaszczyzna z progiem; przy surowszym odczycie wariant końcowy też nie jest użyteczny.
- **Cechy F4 oparte na okapie (Alberto, Aletta New, Sakura, G6):** ocenione OK, gdy okap jest, choć podcień, wnęki albo
  naczółek z tej samej cechy nie są odwzorowane (wyjątek „okap nie blokuje"). Surowszy odczyt odebrałby „użyteczność"
  Alberto i Aletcie New w wariancie końcowym oraz Sakurze w obu.
- **Jarzębina (końcowy: NIE):** zawodzi tylko F2 — brak wystawki ze szczytem i balkonem nad wejściem.

### 6.4 Wnętrze na rzucie — ocena ślepa

Drugi niezależny oceniający, ta sama zasada losowania; jedna plansza na dom: rzut wydawcy dwa razy, z nałożonymi
ścianami parteru modelu. Liczone: ściany rysowane przez rzut, ile z nich model ma we właściwym miejscu, ile ścian modelu
jest zmyślonych, zgodność obrysu. `Wnętrze zgodne` = obrys TAK/UPROSZCZONY, obecne/rysowane ≥ 0,7, zmyślone/ścian ≤ 0,2.

| Dom | Zbiór | 1351: ściany rzutu obecne / rysowane; zmyślone / ścian modelu; obrys | Końcowy: to samo | Wnętrze zgodne (1351 → końcowy) |
|---|---|---|---|---|
| Alaska | DEV | 0/12; 0/0; TAK | 12/12; 0/12; TAK | NIE → TAK |
| Aurora maxi II bis sz | DEV | 0/17; 0/0; TAK | 17/17; 0/17; TAK | NIE → TAK |
| Ballina | DEV | 0/14; 0/0; TAK | 13/14; 0/13; TAK | NIE → TAK |
| Alberto | DEV | 0/17; 0/0; TAK | 16/17; 2/18; TAK | NIE → TAK |
| Medulin | DEV | 10/13; 0/11; TAK | 10/13; 0/11; TAK | TAK → TAK |
| Domek letniskowy nad jeziorkiem | DEV | 4/5; 0/5; TAK | 4/5; 0/5; TAK | TAK → TAK |
| Mindelo | DEV | 20/24; 0/20; UPROSZCZONY | 20/24; 0/20; UPROSZCZONY | TAK → TAK |
| Dom pod sakurą E | DEV | 0/21; 0/0; UPROSZCZONY | 20/21; 0/20; UPROSZCZONY | NIE → TAK |
| G6 (garaż ze strychem — nie dom mieszkalny) | DEV | 0/0; 0/0; UPROSZCZONY | 0/0; 0/0; UPROSZCZONY | TAK → TAK |
| Aletta New | NEW-D | 0/10; 0/0; UPROSZCZONY | 8/10; 1/10; UPROSZCZONY | NIE → TAK |
| Novara | NEW-D | 14/18; 2/16; UPROSZCZONY | 16/18; 0/16; UPROSZCZONY | TAK → TAK |
| Jarzębina | NEW-D | 0/12; 0/1; UPROSZCZONY | 11/12; 0/12; UPROSZCZONY | NIE → TAK |
| Willa Eliza 5 G2 | NEW-D | 0/12; 0/0; NIE | 11/12; 0/11; UPROSZCZONY | NIE → TAK |
| Amarylis | NEW-E | 5/12; 2/10; UPROSZCZONY | 10/12; 3/13; UPROSZCZONY | NIE → NIE |
| Oban III | NEW-E | 0/9; 0/0; NIE | 9/9; 0/9; UPROSZCZONY | NIE → TAK |
| Juliusz Nowy | NEW-E | 0/12; 0/0; NIE | 12/12; 1/13; UPROSZCZONY | NIE → TAK |
| Ametyst New | NEW-F | 0/18; 0/0; TAK | 15/18; 0/15; TAK | NIE → TAK |
| Skagen | NEW-F | 0/7; 0/0; UPROSZCZONY | 0/7; 0/0; UPROSZCZONY | NIE → NIE |
| Fabia | NEW-F | 0/19; 0/0; UPROSZCZONY | 18/19; 1/20; UPROSZCZONY | NIE → TAK |
| Dom pod pomarańczą 2 | NEW-F | 19/19; 0/19; TAK | 19/19; 0/19; TAK | TAK → TAK |

Zastrzeżenia oceniającego: **Amarylis (końcowy: NIE)** to jedyny wynik zależny od jednostki liczenia — 10/12 ścian rzutu
jest, ale trzy ściany modelu stoją na masce samochodu, obok samochodu i na szafce RTV (3/13 = 0,23 przy progu 0,2).
W Medulinie i Mindelo rzut rysuje ścianki działowe białymi paskami, niewidocznymi pod nakładką — liczba ścian rysowanych
jest tam częściowo wnioskowana. Kilka modeli ma „niebieskie" ściany zewnętrzne biegnące przez otwarte wnętrze
(wspólna ściana dwóch brył): reguła tego nie karze, a jest to błąd (Eliza, Medulin, Mindelo, Amarylis).

### 6.5 Cały wynik domu

| Dom | Zbiór | 1351: zewnętrze / wnętrze | Końcowy: zewnętrze / wnętrze | Cały wynik (1351 → końcowy) |
|---|---|---|---|---|
| Alaska | DEV | TAK / NIE | TAK / TAK | NIE → **TAK** |
| Aurora maxi II bis sz | DEV | TAK / NIE | TAK / TAK | NIE → **TAK** |
| Ballina | DEV | TAK / NIE | TAK / TAK | NIE → **TAK** |
| Alberto | DEV | NIE / NIE | TAK / TAK | NIE → **TAK** |
| Medulin | DEV | NIE / TAK | NIE / TAK | NIE → **NIE** |
| Domek letniskowy nad jeziorkiem | DEV | TAK / TAK | TAK / TAK | TAK → **TAK** |
| Mindelo | DEV | NIE / TAK | NIE / TAK | NIE → **NIE** |
| Dom pod sakurą E | DEV | TAK / NIE | TAK / TAK | NIE → **TAK** |
| G6 (garaż ze strychem — nie dom mieszkalny) | DEV | NIE / TAK | NIE / TAK | NIE → **NIE** |
| Aletta New | NEW-D | NIE / NIE | TAK / TAK | NIE → **TAK** |
| Novara | NEW-D | TAK / TAK | NIE / TAK | TAK → **NIE** |
| Jarzębina | NEW-D | NIE / NIE | NIE / TAK | NIE → **NIE** |
| Willa Eliza 5 G2 | NEW-D | NIE / NIE | NIE / TAK | NIE → **NIE** |
| Amarylis | NEW-E | NIE / NIE | NIE / NIE | NIE → **NIE** |
| Oban III | NEW-E | NIE / NIE | TAK / TAK | NIE → **TAK** |
| Juliusz Nowy | NEW-E | NIE / NIE | NIE / TAK | NIE → **NIE** |
| Ametyst New | NEW-F | NIE / NIE | NIE / TAK | NIE → **NIE** |
| Skagen | NEW-F | NIE / NIE | NIE / NIE | NIE → **NIE** |
| Fabia | NEW-F | NIE / NIE | NIE / TAK | NIE → **NIE** |
| Dom pod pomarańczą 2 | NEW-F | NIE / TAK | TAK / TAK | NIE → **TAK** |

| Zbiór | Domów | Zewnętrze użyteczne | Wnętrze zgodne z rzutem | **Cały wynik** |
|---|---|---|---|---|
| DEV | 9 | 5 → 6 | 4 → 9 | **1 → 6** |
| NEW-D | 4 | 1 → 1 | 1 → 4 | **1 → 1** |
| NEW-E | 3 | 0 → 1 | 0 → 2 | **0 → 1** |
| NEW-F | 4 | 0 → 1 | 1 → 3 | **0 → 1** |
| razem | 20 | 6 → 9 | 6 → 18 | **2 → 9** |

### 6.6 NEW-F — jedyny dowód transferu po R2

Cztery domy losowane po zamrożeniu zmian R2 (`PROTOCOL.md` §8), baseline i kod zamrożony po jednym biegu, cechy
referencyjne spisane ze źródeł przed otwarciem modeli, **nic nie strojone po wyniku**.

| Dom | Co się zmieniło | Dlaczego nie jest (albo jest) całym wynikiem |
|---|---|---|
| Ametyst New (Studio Atrium) | wnętrze 0/18 → 15/18 ścian rzutu, bez zmyślonych; bryła i dach poprawne w obu | zewnętrze NIE w obu: na froncie szczytowym nie ma drzwi wejściowych (są trzy okna); komin 1 → 0 |
| Skagen (Lipińscy) | nic istotnego | w obu: jedna kondygnacja ze stromym dachem 48° zamiast piętra z osobnym garażem; rzut nieodczytany — kolor ścian trzyma 24 % pasa przy progu 25 % (obrys obejmuje dom i garaż), więc wnętrze puste |
| Fabia (Dobre Domy) | wnętrze 0/19 → 18/19; front z drzwiami i dwoma oknami zamiast frontu bez drzwi | w obu dach dwuspadowy zamiast czterospadowego (opis JSON formy nie został tu w ogóle zadany: dziś pyta się o niego tylko wtedy, gdy bryła LOCAL ma płaskie przybudówki obok dachu spadzistego); boki i tył bez otworów; komin 1 → 0 |
| Dom pod pomarańczą 2 (ARCHON) | bryła LOCAL identyczna w obu, wnętrze 19/19 w obu | cały wynik tylko dlatego, że wejście w okładzinie zostało tym razem narysowane do ziemi; różnica pochodzi z kroku recenzji/wykończeń, **nie** z kodu bryły — tego zysku nie liczę jako dowodu |

Wniosek, którego nie łagodzę: **po dwóch próbach odłożonych kod końcowy nie daje na nowych linkach więcej użytecznych
miniatur zewnętrza niż baseline w sposób, który da się przypisać zmianom tego etapu.** Daje wnętrze. Trzy z czterech
porażek NEW-F mają przyczynę, której ten etap nie dotknął: liczba kondygnacji i osobna bryła garażu (Skagen), rodzaj
dachu budowany z sylwetek (Fabia), drzwi w ścianie szczytowej (Ametyst New).

## 7. Co nadal zawodzi

1. **Rodzaj dachu i liczba kondygnacji są budowane z sylwetek elewacji.** Typowany opis formy (§3.2) czyta rodzaj
   dachu i kierunek kalenicy poprawnie w 13 z 13 sprawdzonych domów, ale dziś tylko rozstrzyga spór dwóch gotowych brył.
   Fabia (kopertowy → dwuspadowy), Skagen (piętro → parter), Willa Eliza (dwie kondygnacje, kopertowy → trzy dachy
   dwuspadowe) to ta sama przyczyna. To jest najbardziej obiecujący następny krok: opis formy jako **wejście budowy**
   (rodzaj dachu, kondygnacje, niższe części), sylwetki tylko jako pomiar wysokości.
2. **Bryła LOCAL z płaskimi przybudówkami wygrywa, gdy bryła ze źródeł też jest sprzeczna** (Medulin, Mindelo — bez
   zmiany wobec 1351).
3. **Okna o słabym kontraście.** Rzut jest świadkiem tylko dla drzwi; okno wymaga z ≥ 2 na elewacji. Juliusz Nowy: 24
   propozycje otworów odrzucone jako „słabe" (z między 1 a 2), w modelu 4 otwory zewnętrzne.
4. **Otwory po zamianie bryły na wielobryłową.** Amarylis: z 7 przerw w ścianach zewnętrznych rzutu 6 zostało bez otworu,
   a odczyt listy otworów nie został w ogóle zadany żadnej elewacji; przyczyny nie ustaliłem (kod był już zamrożony).
5. **Wnęki, podcienie, wykusze i lukarny nie istnieją w bryle** — obrys jest upraszczany do prostokątów (Novara: wnęka
   wejściowa; Jarzębina: wystawka z balkonem; Juliusz Nowy: wykusz zamknięty do narożnika).
6. **Rzut nieczytelny dla szkieletu** tam, gdzie kolor ścian nie dominuje w pasie przy obrysie (Skagen: 24 % przy progu
   25 % — progu nie ruszałem po wyniku) albo ściany są rysowane samym konturem.
7. **Meble w kolorze ścian** nadal bywają ścianami (Amarylis: maska samochodu, szafka RTV).
8. **Recenzja jest zmienna.** Ten sam model w dwóch biegach recenzji dostaje różne werdykty i różne wykończenia
   (Dom pod pomarańczą 2: identyczna bryła, inne wejście; Domek nad jeziorkiem: panel na tylnej ścianie raz jest, raz
   nie ma). Status jakości z recenzji nie jest oceną zadania.

## 8. Co zostało utracone (dom po domu)

| Dom | Zbiór | Strata wobec 1351 | Skąd |
|---|---|---|---|
| Novara | NEW-D | „użyteczna" TAK → NIE: brak wnęki wejściowej; ściany wewnętrzne 13 → 10; otwory zewnętrzne 21 → 13 | bryła LOCAL (trzy pudełka z wnęką między nimi) zastąpiona jedną bryłą ze źródeł pod jednym dachem; oceniający mimo to uznał wariant końcowy za bliższy źródłu (tył i szczyty z poprawnymi przeszkleniami, 16/18 ścian rzutu zamiast 14/18) |
| Amarylis | NEW-E | otwory zewnętrzne 17 → 5 (tył i boki ślepe) | zamiana bryły LOCAL (płaski dach) na trzy bryły ze źródeł; otwory z elewacji i z rzutu nie trafiły na nowe ściany (§7.4) |
| Jarzębina | NEW-D | otwory zewnętrzne 29 → 12 | baseline to bryła bez dachu z otworami na dwóch poziomach; liczba spadła razem z otworami-widmami; oceniający: końcowy bliżej |
| Ametyst New | NEW-F | komin 1 → 0 | w biegu końcowym dwie propozycje komina wycofane (komin styka się współpłaszczyznowo ze ścianą), trzy nie trafiły na żadną stronę (jedna elewacja boczna nie została zarejestrowana); w baseline jedna z nich przeszła. Niczego nie stroiłem po NEW-F |
| Fabia | NEW-F | komin 1 → 0 | obie propozycje wycofane z tego samego powodu (komin współpłaszczyznowy ze ścianą); w baseline druga przeszła |
| Medulin | DEV | oceniony bliżej źródła w 1351 | w wariancie końcowym dwa kominy narysowane jako cienkie słupki ponad dachem (1351: jeden); bryła ta sama |
| Domek nad jeziorkiem | DEV | oceniony bliżej źródła w 1351 | brak panelu na tylnej ścianie (wykończenie z recenzji); geometria identyczna co do piksela nakładki |

Poza tym żaden dom nie stracił ścian wewnętrznych, które miał, ani modelu, który miał. Strat w cechach formy (F) wobec
baseline oceniający nie odnotował poza Novarą.

## 9. Budżet

Jedna księga, ta sama co w R3: `research/ai-assist/spend-ledger-v35417r3.json`, pułap 68,542857 USD, bez nowej puli.

| | USD |
|---|---|
| Stan na początku etapu | 37,778557 |
| Biegi i recenzje na żywo (DEV, NEW-D, NEW-E, NEW-F) | 9,134359 |
| Host (dwa sprawdzenia end-to-end: `3c3f28a` i finalne `01fd2fb`) | 2,394953 |
| Eksperyment szkic / JSON (otwory 0,199988; forma 0,171162) | 0,371150 |
| **Etap razem** (limit własny z protokołu: 14) | **11,900462** |
| **Stan końcowy** | **49,679019** |

W kwocie biegów jest 0,947360 USD dwóch rezerwacji przerwanego procesu, zamkniętych zachowawczo jako wydatek. Otwartych
rezerwacji: 0. Żądań w księdze: 657. Koszt jednego domu na żywo w tym etapie: 0,12–0,53 USD.

## 10. Host na finalnej rewizji

Serwer zbudowany z `01fd2fb` (kod analizy = zamrożenie 2; późniejsze commity zmieniają tylko dokumenty, rejestr scen
i narzędzia dostawy), publiczne wejście `POST /v1/analyses`, pilot z tokenem, strict tools, cache 5 min.
`research/source-to-model/v35419/host-e2e.mjs`: **53 kontrole OK, 0 nieudanych.**

| Zlecenie | Wynik | Czas | Koszt | Żądań |
|---|---|---|---|---|
| Alberto | COMPLETED, poprawki nałożone przez wspólny wykonawca, rewizja oddana = rewizja oceniona | 641 s | 0,737425 USD | 15 |
| Oban III (dom bez modelu w 1351) | COMPLETED | 270 s | 0,275678 USD | 11 |
| Alberto, drugi raz | REUSED — te same bajty modelu i sceny, ten sam stan jakości | 305 s | 0 USD | 0 |
| Alberto bez tokenu | FAILED `RECONSTRUCTION_FAILED` na samej ścieżce rysunków (zamierzone: bez tokenu nie ma konsultacji) | 55 s | 0 USD | 0 |

Oba modele oddane przez host są scenami w APK (`alberto-host-v35419`, `oban-host-v35419`).

## 11. Testy

- `packages/analysis-service`: 58 plików, **786 / 786**.
- `packages/mobile-scene`: 18 plików, **126 / 126** (pozycje starszych scen przesunięte o 22; nowy `owner-v35419.test.ts`:
  kolejność, nazwane porażki, zapieczętowane bajty się kompilują, liczba ścian w podpisie liczona z modelu).
- Pełna macierz na finalnej rewizji: 400 plików, **4622 przeszły, 18 nie przeszło, 11 pominiętych**. Te 18 leży w tych
  samych 9 plikach i w tej samej liczbie na plik co na liście z v3.54.18: 14 testów `tests/architecture/*` i 2
  `apps/local-analyzer/*` (zastane, zależne od historii repozytorium i od zasobów spoza sesji) oraz 2 testy czasowe
  `apps/analyzer-api/test/worker.test.ts`, które uruchomione osobno przechodzą (3 / 3). Żaden nie dotyczy kodu
  zmienionego w tym etapie. Nie naprawiałem ich i nie wyłączałem.
- `tsc -p tsconfig.json --noEmit`: czysto.

Testy R2 są dopisane do istniejących plików (`wings-v35419`, `plan-outline-v35417`, `openings-v35419`): szerokość
w połowie kondygnacji, skośna krawędź, dokładny podział z pierwszeństwem pełnych brył, wierzch ściany pod okapem —
każdy z kontrpróbą.

## 12. APK

`BuildPlan-Model-Preview-1352-arm64-v8a.apk`, 54 009 346 B, SHA-256
`aefd2b7640cbbba2c22c765fcbe64c06418b786633451004d42fd383025a09e0`, `versionCode` 1352, ten sam podpis co 1349–1351
(instaluje się na nich). 70 paczek scen bajt w bajt jak w repozytorium; 22 sceny tego etapu jako pierwsze: NEW-F
(Ametyst New, Skagen, Fabia, Dom pod pomarańczą 2), NEW-E po R2, NEW-D, dziewięć znanych domów, dwa modele z hosta.
Porażki są nazwane w podpisach scen. Klucza dostawcy: 0 wystąpień w pliku i w rozpakowanej zawartości.
**`ANDROID_UI_NOT_VERIFIED`** — w tej sesji nie było telefonu ani emulatora; wszystkie obrazy w raporcie i galerii to
rendery z komputera. Zapis: `stage-reports/artifacts/v35419/VERSION-1352.txt`.

## 13. Dostawa

Prywatna (rysunki wydawców — nie publikować), w niezależnych ZIP-ach poniżej 30 000 000 B; każdy ma własny README
i manifest SHA-256, wszystkie rozpakowują się do jednego folderu `BuildPlan-V35419/`. Lista części, rozmiary i sumy:
`stage-reports/artifacts/v35419/DELIVERY.txt`. W galerii (`gallery.html`) na każdy dom: źródła wydawcy, kolorowe szkice
PNG/SVG i ich zapis JSON, werdykt wykorzystania każdej obserwacji, modele 1351 / (zamrożenie 1) / końcowy obok siebie,
wnętrze bez dachu na rzucie wydawcy. Oceny ślepe, klucze losowania i tabele: `grading/`.

## 14. Rekomendacja następnego kroku

Jedna rzecz, nie lista: **opis formy domu (JSON) ma stać się wejściem budowy bryły, a nie świadkiem.** Dwie próby
odłożone pokazały, że po naprawieniu rejestracji i obrysu pozostała przyczyna porażek zewnętrza jest wspólna — rodzaj
dachu, liczba kondygnacji i niższe części są wyprowadzane z sylwetek, które tę informację gubią, podczas gdy jedno
tanie żądanie (ok. 0,014–0,03 USD) czyta ją poprawnie. Druga w kolejności: rzut jako świadek także dla okien oraz
otwory na ścianach brył wielokorpusowych (Amarylis, Juliusz Nowy). Przed tym krokiem warto wylosować nową próbę
odłożoną — NEW-E i NEW-F są już rozwojowe.

