# SOURCE-TO-MODEL — kampania po audycie v3.51.0 (raport roboczy)

Gałąź `claude/new-session-3kzcgh`, baza audytu `14ecb73` (produkcja jak `572b875`, APK 1322).
Zasady: `CLAUDE.md`, `AGENT_PROTOCOL.md`, `APP_SPEC.md`, `docs/ANALYZER_CONTRACT.md` (przyjęte z paczki audytu, `c0a35d3`).

| | stan |
|---|---|
| **SLICE C1a** (pochodzenie per właściwość) | **PASS** |
| **SLICE C1b** (konsument pionowej relacji przekroju) | **PASS** w zadeklarowanym zakresie (jedna rodzina: wysokość parteru w świetle); jeden wpis kontrolny zamrożony błędnie — patrz niżej |
| **SLICE C2** (jedna polityka korekt, typowane znaczenie, finalny ślad) | **PASS** dla polityki, typów i śladu; relacja balkon/podest bez płyty — **PARTIAL** (typ i zapis są, brak przypadku w korpusie i testu kompozycji z odmową płyty) |
| **SLICE ANY-LINK** (zlecenie OWNER-a z 2026-11-09: dowolny link → model) | **PARTIAL** — na stronach nieoglądanych wcześniej model powstaje w **6 z 18** przypadków (ślepe przebiegi: CONTROL 3/6, w tym 1 w złej skali; CONTROL-2 3/12). Na stronach znanych: DEV 3/6 (z 0/6 na kodzie 1322), CONTROL 5/6. Korpus ARCHON 27 → 28 z 33. Nowe modele to przybliżone lub częściowe bryły parteru. „Dowolny link z dowolnej strony” **niespełnione** |
| **CAMPAIGN** | **WORK_IN_PROGRESS** |
| **VERIFICATION** | host: pełna macierz testów na `101f9d7` i na `0fe410a` (padają wyłącznie testy sprzed kampanii), świeża pełna ścieżka 33 projektów na `101f9d7`, trzy domy korpusu i trzy próbki stron na `0fe410a` — tak; bundle: pakiety wyjęte z APK 1326 i 1327 uruchomione na hoście na żywych adresach, model i scena równe kodowi źródłowemu (Node 22, nie środowisko telefonu); Android UI — **NOT_VERIFIED** (brak urządzenia); live API — nie uruchamiane (0 płatnych wywołań) |
| **NEXT** | jedna czynność: czytnik rzutu wektorowego z nazwanymi warstwami — ściany i linie wymiarowe wprost z grup SVG (rodzina 1 z §5.5), z zamrożonym zestawem: cztery znane strony extradom.pl jako DEV, nowe strony tego wydawcy i rzuty SVG innego wydawcy jako CONTROL, rzuty rastrowe korpusu jako kontrprzypadki |

## 1. Baseline i sposób porównania

- Ekstrakcja zamrożona: pełna ścieżka `572b875` na 33 projektach (ta sama, co dostawa 1322). C1a/C1b/C2 zmieniają tylko
  reguły solvera, więc baza i kandydaci to **replay solvera na tych samych zamrożonych dowodach**; baza odtwarza modele
  1322 bajt w bajt (27/27). Zmiana formatu czytnika (typowane role alternatyw, czytnik 1.13.0) jest sprawdzona osobno
  świeżą pełną ścieżką kandydata (§5).
- **Błąd metody, wykryty i naprawiony w trakcie:** pierwsze „zamrożone drzewa” dzieliły `node_modules` z głównym
  checkoutem, więc wykonywały kod roboczy. Oba dotknięte przebiegi unieważniono i powtórzono na drzewach z własnymi
  dowiązaniami pakietów (`mk-nm.sh`); wszystkie liczby poniżej pochodzą z powtórzonych przebiegów.
- Zestawy zamrożone przed wynikami kandydata: `research/source-to-model/FROZEN-C1.json`, `FROZEN-C2.json`,
  `ANYLINK-SET.json`. Wszystkie domy są znane z wcześniejszych etapów (nie-ślepe); Balsamowce to CONTROL z otwartego EVAL.
  H2 nieużyte.

## 2. C1a — pochodzenie każdej właściwości poziomu

Przyczyna (potwierdzona): `levelsFrom` zwracał dla całej drabiny jedno `measured: true`, a konsument nadawał z niego
`SOURCE_EXACT`/L2 każdej elewacji i każdej wysokości — także konwencjonalnym 2,80 m między ±0,00 a kalenicą, powtórzonej
wysokości kondygnacji i podłodze dopisanej z konwencji. Druga przyczyna, znaleziona przez miernik: `amend()` zmieniał
wartość parametru, zostawiając stare pochodzenie.

Zmiana: `levelsFrom` podaje podstawę każdej podłogi i każdej wysokości; cecha LEVEL ma pochodzenie per parametr
(wydrukowana rzędna = `SOURCE_EXACT`, różnica dwóch wydrukowanych = `SOURCE_DERIVED`, konwencja/powtórzenie =
`ASSUMED_FOR_RENDERING` i nazwane nierozstrzygnięte); cecha z parametrem przyjętym nie dostaje L2; poprawiana wartość
podaje własne pochodzenie; `heights.measured` w wyniku produktu liczy się z każdej kondygnacji osobno.

Miernik niezależny od czytnika (`scoring/score_c1a.py`: znaki naniesione z oryginalnych przekrojów), 47 cech poziomów
w 27 modelach (6 projektów bez modelu policzone osobno, 2 cechy bez referencji):

| | baza 1322 | kandydat |
|---|---|---|
| wysokość: autorytet źródłowy bez pokrycia w źródle | 45 / 45 (wszystkie przy L2) | **0 / 45** |
| rzędna: autorytet źródłowy bez pokrycia | 2 / 45 | **0 / 45** |

Geometria: C1a nie zmienia żadnego modelu (27/27 bajt w bajt). Testy: 9 (7 padają na starym kodzie, 2 przypadki
przeciwne przechodzą na obu).

## 3. C1b — wysokość parteru w świetle z przekroju dochodzi do modelu

Przyczyna: pionowe wymiary przekroju (czytnik 1.12.0) trafiały do księgi jako `IGNORED_WITH_REASON`; pas stropu liczono
z **ukrytej stałej 2,72 m** (wartość pierwszego domu referencyjnego).

Zmiana (`v2/section-clear-height.ts`): wymiar jest wiązany **geometrią**, nie nazwą czytnika ani prozą — dolny koniec na
wierszu wydrukowanej podłogi (host), rozpiętość w skali drabiny równa wartości (zła linia odpada), pas do wydrukowanej
podłogi wyżej fizycznie możliwy (0,15–0,50 m). Skutek w finalnym modelu: wysokość ścianek pod stropem = wydruk, grubość
stropu = wydrukowana podłoga − wydruk; na cesze parteru `clearHeight: SOURCE_EXACT`, `slabBand: SOURCE_DERIVED`, wymiar
w księdze `USED_IN_MODEL`. Bez odczytu 2,72 m zostaje — nazwane jako `ASSUMED`. Dwa niezgodne odczyty: oba nazwane,
żaden niezastosowany. Bez wydrukowanej podłogi wyżej (parterówka, znak okapu) pasa nie ma.

Zamrożony zestaw (`scoring/score_c1b.py`, sprawdza końce/hosta/efekt w modelu osobno od równości liczby):

| rola | projekt | oczekiwane | baza | kandydat | ablacja (bez wymiarów przekroju) |
|---|---|---|---|---|---|
| DEV | Marcówki 272 | skonsumowane | FAIL | **PASS** (2,72; 0,34) | FAIL |
| DEV | Arletach 264 | skonsumowane | FAIL | **PASS** (2,72 → 2,64; strop 0,24 → 0,32) | FAIL |
| DEV | Dalie 273 | skonsumowane | FAIL | **PASS** (2,72 → 2,73; 0,34 → 0,33) | FAIL |
| DEV | a01 274 | jeśli odczytane | NOT_READ | NOT_READ | NOT_READ |
| CONTROL | Bratki 260 | jeśli odczytane | FAIL | **PASS** (2,72 → 2,60; 0,24 → 0,36) | NOT_READ |
| CONTROL | Balsamowce 263 | jeśli odczytane | NOT_READ | NOT_READ | NOT_READ |
| NEGATIVE | Renklody, Kostrzewy, Ciesz | nieskonsumowane | PASS | PASS | PASS |
| DEV-COUNTER | Sasanki | nieskonsumowane | PASS | **FAIL (jak zamrożono)** | PASS |

- **Sasanki — wpis zamrożony błędnie, niezmieniony:** przekrój drukuje dwie wysokości parteru: 273 (przy znakach ±0,00
  i +3,06 — pominięte we wpisie) i 278. Kandydat odrzuca odczyt łańcuchowy 278 (zła linia — zamierzony kontrprzypadek
  działa) i konsumuje 273 odczytane na własnej linii. Ograniczenie nazwane: solver nie widzi niezgodności 273/278
  w samym źródle, bo 278 nie jest związane z linią. Sprostowanie zapisane jako `amendments`, werdykt zostaje FAIL.
- Poza zestawem konsument zadziałał też w Aurorach, Jabłonkach i Murajach (zgodnie ze znakami 264/265/261).
- Pełny zakres skutku (regress element po elemencie, baza → kandydat): zmieniają się wyłącznie stropy, ścianki pod
  stropem i otwory sięgające stropu w tych domach; żaden otwór ani bryła nie znika.
- Testy: 10 (przyjęcie + zła linia, zły host, brak podłogi wyżej, podłoga z konwencji, znak okapu, konflikt, duplikat).

## 4. C2 — jedna polityka korekt, typowane znaczenie, finalny ślad

Przyczyny (potwierdzone w kodzie): repair miał ochronę „drzwi sięgają podłogi”, alignment nie; repair przycinał próg do
globalnego 0, alignment do podłogi kondygnacji; `FRENCH_WINDOW_NOTE` w `unresolved` oraz prefiksy `why` („width
candidate…”) sterowały rodziną i kandydatami wymiaru; cecha OPENING powstawała przed alignment/repair/fit i nie była
aktualizowana.

Zmiana:
- `v2/opening-correction.ts`: jedna funkcja dopuszczenia dla obu ścieżek, odmowy kodem (m.in. `DOOR_OFF_ITS_ACCESS`,
  `BELOW_ITS_FLOOR`); próg drzwi odnosi się do **własnej powierzchni dostępu** (podłoga kondygnacji albo typowane
  `access`: podest / stopień / podłoga split-level), nigdy do globalnego 0.
- Typy zamiast prozy: `glazingToFloor: 'FRENCH_WINDOW'` na otworze; `role`/`gate` na alternatywach opisu (czytnik
  1.13.0); `stepsOnto` — relacja otworu z balkonem/tarasem zapisana osobno od tego, czy płyta powstała.
- `v2/opening-final.ts`: po ostatniej korekcie i emisji cecha otworu niesie decyzję **przyjętą** (parametry
  z własnym pochodzeniem) i osobno **zastosowaną** (`application`: `AS_ACCEPTED` / `FITTED` z wartościami i kodem /
  `NOT_BUILT`). Źródłowy wymiar nie jest nadpisywany tym, co zmieścił model.

Miary zamrożone (`FROZEN-C2.json`, `scoring/score_c2.py`), 354 cechy otworów w 27 modelach:

| | baza 1322 | kandydat |
|---|---|---|
| ślad: wartość w grafie, której model nie ma, bez informacji (STALE) | 41 | **0** |
| ślad zgodny / jawna różnica przyjęte–zastosowane / bez stanu | 0 / 0 / 313 | **326 / 28 / 0** |
| rodzaj przyjęty = zbudowany | brak zapisu | 351 / 351 |
| drzwi zewnętrzne nad własną podłogą | 0 / 130 | 0 / 130 |

- Uczciwie: **luka w alignment nie dawała błędu w tym korpusie** (0/130 przed i po) — zysk tej części to spójność
  uprawnień i testy, nie zmiana modeli. C2 nie zmienia geometrii żadnego domu.
- Ślad ujawnia znane wady geometrii, których nie naprawia (np. Dalie: przeszklenie poddasza „drzwi” o wysokości 0,30 m
  po dopasowaniu do ścianki kolankowej — teraz jawnie `FITTED`, nie ukryte).
- Testy: 15 nowych (własny poziom, kondygnacja wyżej, stopień, split-level, zwykłe okno, wydruk, dopasowanie do
  ściany; ten sam kandydat w alignment i repair = ten sam kod; zmiana tekstu notatki nie zmienia modelu; kompozycja
  przyjęcie → korekta → emit/fit/odmowa → finalny zapis) + 2 w teście okna francuskiego. Siedem testów dawnej formy
  zastąpiono niezmiennikiem, który chroniły (kod odmowy zamiast zdania, typowane role w fiksturach, polecenie po id).

## 5. ANY-LINK — dowolny link → model (zlecenie z 2026-11-09)

Miara: pełna ścieżka od samego adresu (pobranie → role → odczyt → solver → kompilator), bez podpowiedzi po stronie,
hoście ani domu. Dwie próbki zamrożone przed uruchomieniem kandydata, obie małe i **nie-statystyczne**:

- **DEV** (`ANYLINK-SET.json`): pierwszy link projektu z listingu sześciu wydawców. Po pomiarze bazowym strony są znane
  i na nich powstawały reguły.
- **CONTROL** (`ANYLINK-CONTROL.json`): kolejny projekt tych samych sześciu wydawców, wybrany z zapisanego listingu po
  samym wzorcu adresu. Mierzy „inna strona znanego wydawcy”, nie „nieznany wydawca”.

### 5.1 Wynik

| próbka | kod 1322 (baza) | rewizja końcowa `101f9d7` |
|---|---|---|
| DEV, 6 stron innych wydawców | 0 modeli | **3 modele** (wszystkie oznaczone jako przybliżone lub częściowe) |
| CONTROL, 6 stron — **pierwszy, ślepy przebieg** na `f73c1cf` | nie mierzono | **3 modele, w tym 1 w złej skali**; 1 awaria programu |
| CONTROL — rewizja końcowa (dla 2 stron już nie-ślepa, patrz 5.3) | — | 4 modele, 0 awarii |
| korpus ARCHON, 33 projekty, świeża pełna ścieżka | 27 modeli | **28 modeli** (zyskane Bukszpany); 5 odmów bez zmian |

DEV, strona po stronie (baza → końcowa):

| wydawca | baza 1322 | `101f9d7` |
|---|---|---|
| extradom.pl | brak modelu (nie znaleziono rzutu) | **model**: skala z opublikowanej szerokości i długości (2,54 cm/px; obrys 129,27 m² = wymiary strony), 18 ścian, 18 otworów, 9 pomieszczeń, dach dwuspadowy z opublikowanego kąta, kalenica przybliżona 5,47 m sprawdzona z opublikowaną wysokością 6,40 m |
| dobredomy.pl | brak modelu (skala rzutu) | **podgląd częściowy**: obrys 93,2 m² = opublikowana zabudowa (11,18 × 8,34 m), 6 ścian, 15 otworów; **bez dachu i bez poddasza**; elewacje odstają od bryły do 2,7 m (`STRUCTURE_SILHOUETTE_DISAGREES`) |
| lipinscy.pl | brak modelu (skala rzutu) | **podgląd częściowy części budynku**: korpus 23,75 × 9,37 m w skali z własnych wymiarów rysunku, 33 ściany, 41 otworów, 13 pomieszczeń; **bez garażu i bez dachu głównego**; wynik mówi wprost `FOOTPRINT_AREA_SHORT`: 206,91 z 267,63 m² opublikowanej zabudowy |
| domoweklimaty.pl | brak modelu (nie znaleziono rzutu) | brak modelu — rzut jest już znajdowany (rola z pikseli), ale nie daje obrysu (`NO_OUTLINE`): rysunek ma wypełnione tło na zewnątrz i nie rysuje ścian zewnętrznych jako pasów |
| houseplans.com | brak modelu (skala rzutu) | brak modelu — boki obrysu dają dwie różne skale (`SIDES_DISAGREE`): ściany to cienka podwójna linia 3–4 px, dom z dziedzińcem |
| architecturaldesigns.com | brak modelu | brak modelu — brak obrysu na obu rzutach (`NO_OUTLINE`) |

CONTROL, strona po stronie (pierwszy ślepy przebieg → końcowa):

| wydawca | `f73c1cf`, ślepo | `101f9d7` |
|---|---|---|
| dobredomy.pl | podgląd częściowy: obrys 215,9 m² = opublikowana zabudowa (22,46 × 13,73 m), 2 bryły, dach dwuspadowy, 20 otworów | bez zmian |
| houseplans.com | podgląd częściowy: 14,46 × 12,92 m przy opublikowanych 14,63 × 13,11 m, 67 ścian, 31 otworów, 11 pomieszczeń; rodzaj dachu nieustalony | bez zmian |
| architecturaldesigns.com | model w **złej skali**: 30,0 × 24,4 m przy opublikowanych 24,8 × 20,0 m | model 24,70 × 20,32 m, 4 bryły, 49 ścian, 55 otworów; rodzaj dachu korpusu nieustalony (reguła 8) |
| lipinscy.pl | **awaria** (`INTERNAL_ERROR`) | model: 18,66 × 8,10 m, 12 ścian, 19 otworów, zabudowa 151,21 wobec opublikowanych 140,47 m² (+7,6 %, `FOOTPRINT_AREA_NEAR`); bez dachu (reguła 7) |
| domoweklimaty.pl | brak modelu (`NO_OUTLINE`) | bez zmian |
| extradom.pl | brak modelu (`PLAN_NO_WALLED_ENVELOPE`) | bez zmian |

**Czym te modele są, a czym nie.** Rendery czterech z siedmiu końcowych modeli obejrzano (extradom i lipinscy DEV,
architecturaldesigns i houseplans CONTROL), pozostałe trzy opisano z danych wyniku: to parterowe bryły ze ścianami,
ściankami i otworami w proporcjach rzutu. Najbliżej domu jest extradom DEV (prosta bryła z dachem dwuspadowym, oknami
i drzwiami); pozostałe obejrzane wyglądają jak makieta parteru bez dachu. Dach istnieje tylko tam, gdzie strona podaje kąt i wysokość budynku (extradom DEV,
dobredomy CONTROL); pozostałe mają dach płaski z konwencji albo są otwarte od góry. Poddaszy nie ma. Wysokości są
przyjęte (2,80 m „do oglądania”), skala pięciu z siedmiu pochodzi z liczby ze strony, a nie z wymiaru potwierdzonego
na rysunku. Każdy wynik niesie te zastrzeżenia w polach `provisional` / `layoutBlocking`. To jest „rozpoznawalny
zarys domu zamiast odmowy”, a **nie** „należycie odtworzony dom”. Zlecenie „dowolny link z dowolnej strony” jest
**niespełnione**: 5 z 12 zmierzonych stron innych wydawców nadal nie daje modelu, a 2 wydawców (z500.pl,
mgprojekt.com.pl) odmawia klientowi (HTTP 403).

### 5.2 Reguły (wszystkie ogólne; żadnej po hoście, adresie, nazwie ani hashu)

Runda 1 (`fc2404c`, `68f2ead`, `6ce867c`):
1. **Skala z opublikowanej zabudowy** (`v2/published-scale.ts`): gdy żadna wydrukowana miara nie ustala skali, a bieg
   i tak by stanął — skala, przy której obrys ścian ma opublikowaną powierzchnię zabudowy. Jawnie przybliżona
   (rejestracja bez kotwic, luka `AMBIGUOUS`, „proporcje, nie obmiar”); liczba jest tym samym zużyta i nie weryfikuje
   już układu.
2. **Rola z pikseli**, gdy żaden obraz nie jest podpisany jako rzut (pewność ≥ 0,9, ta sama co weto treści).
3. **Relacja do niezbudowanego otworu** znika razem z otworem, zamiast odmawiać całego domu.

Runda 2 (`1b4926e`, `b208b39`, `f73c1cf`):
4. **Rysunki, które inni wydawcy naprawdę serwują**: obrazy pod adresami bez rozszerzenia, galerie w danych
   strukturalnych strony, rzuty SVG, WebP (dekoder dołączony do pakietu w APK), fakty w stopach i calach.
5. **Skala z opublikowanej szerokości i długości** (pierwszeństwo przed zabudową), z bezpiecznikami: grubość ściany
   fizycznie możliwa, bryły pokrywają narysowane ściany, oba boki dają tę samą skalę; nigdy, gdy wymiary samego rysunku
   sobie przeczą; **liczba ze strony nigdy nie wybiera między skalami, które podaje rysunek** (`f73c1cf`).
6. **Rozmiar odczytu arkusza** (`source-cv/reading-size.ts`): arkusz większy niż zmierzony zakres (> 853 px) i o ścianach
   grubszych niż 30 px jest czytany w rozmiarze, w którym typowa ściana ma 16 px. Żaden arkusz korpusu nie jest
   zmniejszany (sprawdzone w końcowym przebiegu: 0 z 33).
7. **Dach z opublikowanego kąta** tylko razem z opublikowaną wysokością budynku jako sprawdzeniem; bez niej dachu nie ma
   (świadoma odmowa, nie brak funkcji).

Runda 3 (`3772e63`, `101f9d7`):
8. **Poprawny odczyt części budynku zostaje jako podgląd częściowy** (`v2/partial-footprint.ts`), dopiero po tym, jak
   resolver nie znalazł odczytu całości, i tylko gdy: zabudowa odczytana jest mniejsza od opublikowanej i stanowi co
   najmniej 2/3; skalę podaje sam rysunek (≥ 2 kotwice, nigdy skala dopasowana do liczby); bryły pokrywają narysowane
   ściany; rysunek sam pokazuje, czego brakuje (otwarte części obok brył, razem ≥ 80 % liczby). Wynik niesie
   `FOOTPRINT_AREA_SHORT` (nadal `BLOCKING`) i polskie objaśnienie na ekranie.
9. **Otwarty pierścień ścian korpusu liczy się jako ściany korpusu** przy dopasowaniu podglądu (wcześniej dom z otwartą
   stroną był odmawiany jako „bez ścian”).
10. **Miniatura przekroju nie wywraca biegu**: punkt odczytany poza kadrem ponad tolerancję wraca na brzeg kadru
    (`ontoFrame`); punkty w tolerancji są nietknięte, więc działające biegi są bajt w bajt takie same.
11. **Niepotwierdzona skala, której przeczą opublikowana szerokość i długość** (oba boki, ten sam kierunek, ten sam
    współczynnik), ustępuje skali z tych liczb; gdy ta nie przechodzi bezpieczników, model zostaje z nazwaną
    sprzecznością (`PUBLISHED_EXTENT_CONTRADICTION`). Skala potwierdzona wymiarem rysunku jest nietykalna.

### 5.3 Ujawnienia

- **CONTROL przestał być ślepy dla dwóch stron.** Plik zapowiadał jeden przebieg bez zmiany reguł. Pierwszy przebieg
  (`f73c1cf`) dał 3/6 i odsłonił awarię oraz złą skalę; obie naprawiono regułami 10 i 11 i przebieg powtórzono.
  Liczbą ślepą tej próbki jest **3 z 6, w tym 1 w złej skali**; 4/6 jest dla stron lipinscy.pl i architecturaldesigns.com
  wynikiem DEV. Sprostowanie zapisane w pliku jako `amendments`. Pozostałe cztery strony nie były oglądane między
  przebiegami.
- **Próg 2/3 w regule 8** ustalono, znając dwie liczby: udział strony DEV lipinscy.pl (0,77) i to, że żadna odmowa
  korpusu nie spełnia pozostałych warunków. Uzasadnienie jest rzeczowe (garaż, wejście, taras to mniejsza część
  zabudowy), ale próg nie jest potwierdzony na niezależnych danych. W korpusie reguła nie zmieniła żadnego wyniku
  (33/33 identyczne w replayu).
- **Własna regresja, wykryta i cofnięta w tej samej dostawie.** Reguła 6 w pierwszej postaci zmniejszała też arkusz
  853 px o grubych ścianach: w Azaliach zginęły wydruki „110/220” i „160/220”, trzy drzwi balkonowe stały się oknami
  (2,20/0 → 1,30/0,90). Źródło obejrzane: stary odczyt był poprawny. Reguła dostała dolną granicę rozmiaru arkusza;
  końcowy przebieg przywraca Azalie element po elemencie.
- Odrzucone pomiarem, niewdrożone: filtr tonu pasów (w korpusie 20–28 % długości pasów to jaśniejsze, prawdziwe warstwy
  ścian — filtr psułby działające domy).

### 5.4 Pierwsze błędne decyzje, które zostają

- **Czytnik rzutu wymaga ścian narysowanych jako lite pasy 6–40 px.** To wspólna przyczyna 4 z 5 stron bez modelu
  (tło wypełnione zamiast ścian; cienka podwójna linia; brak obrysu) i `PLAN_NO_WALLED_ENVELOPE` na piątej.
- lipinscy.pl DEV: garaż ginie, bo cienie i obrysy narysowanych samochodów są czytane jako pasy ścian (obwiednia kończy
  się na zderzakach).
- Dach i poddasze bez przekroju: tylko z opublikowanego kąta **i** wysokości; bez wysokości — brak dachu.
- W dwóch modelach CONTROL kontrola grafu cech zgłasza naruszenia niezmienników (2 i 1) oraz znaleziska w audycie
  styków zewnętrznych (15 i 2) — są w ostrzeżeniach wyniku, nie zostały zbadane.

### 5.5 Runda 4 po punkcie kontrolnym 1326 (`cda0590`, `0fe410a`) — drugi rozmiar odczytu i ślepy CONTROL-2

**Pierwsza błędna decyzja** na klasycznym rzucie odrzuconym w CONTROL (extradom.pl, ściany jako lite szare pasy,
wydrukowane wymiary całkowite): arkusz 1600 px ma ściany zewnętrzne 46–49 px, ale miara „typowej ściany” (mediana po
wszystkich pasach) wypada 28 px, bo przeważają cienkie ścianki i meble. Arkusz nie jest zmniejszany i żadne okno
czytnika nie sięga ścian zewnętrznych (`PLAN_NO_WALLED_ENVELOPE`).

**Co zmierzono, zanim cokolwiek zostało:**
- Zamiana miary na medianę po pasach „długości ściany” (`cda0590`) naprawia tę stronę i **psuje stronę DEV tego samego
  wydawcy** (jej arkusz jest wtedy czytany w 628 zamiast 709 px i skala z opublikowanych wymiarów przestaje spełniać
  oba boki). Zamiana jednego domu na drugi — odrzucona.
- Skan trzech innych celów zmniejszenia (20, 25, 30 px) na obu stronach: przy 20 działa tylko DEV, przy 25 żadna, przy
  30 tylko CONTROL. **Nie ma rozmiaru, przy którym czytają się obie**; wynik zależy od rozmiaru odczytu chaotycznie.
- Korpus: mediana po wszystkich pasach 7–25 px (p5–p95), po pasach długości ściany 8–25 px — korpus nie uzasadnia
  innego celu niż 16 px dla żadnej z miar.

**Reguła 12 (`0fe410a`):** arkusz większy niż zmierzony zakres nie ma jednego właściwego rozmiaru odczytu. Bieg czyta
arkusze pierwszą miarą, jak dotąd. Tylko gdy solver odrzuci ten odczyt **i** druga miara daje arkuszowi inny rozmiar,
zapieczętowana paczka jest czytana jeszcze raz w tym rozmiarze; drugi odczyt przechodzi przez wszystkie te same
bramki, ślad mówi wprost, że to drugi odczyt (`PLAN_SHEETS_REREAD`), a gdy i on zostanie odrzucony, odpowiedzią biegu
jest pierwsza odmowa. Arkusze nie większe niż 853 px (wszystkie 232 arkusze rzutów korpusu) mają jeden rozmiar i nigdy
tu nie trafiają. Usługa 1.10.0; solver i czytniki bez zmian wersji.

| pomiar na `0fe410a` | wynik |
|---|---|
| DEV, 6 stron | 3 modele — **bez zmiany** element po elemencie |
| CONTROL, 6 stron (już nie-ślepy) | **5 modeli** — extradom.pl zyskuje model (11,90 × 8,60 m przy opublikowanych 11,9 × 8,65 m, dach dwuspadowy; wejście odczytane jako wnęka, której na rzucie nie ma; 11 naruszeń niezmienników grafu cech w ostrzeżeniach) |
| **CONTROL-2, 12 stron, ślepo, jeden przebieg** | **3 modele z 12** (lipinscy.pl ×2, dobredomy.pl ×1) |
| CONTROL-2 na dostarczonej rewizji `101f9d7` (te same bajty) | 3 modele z 12, te same; **0 zmian** |
| korpus, 3 domy pełną ścieżką (Azalie, Bukszpany, Julia) | hashe paczki, grafu, dowodów, modelu i sceny równe `101f9d7`; odmowa Julii ta sama, bez drugiego odczytu |

**Uczciwie o tej rundzie:** reguła 12 dała jeden model na stronie, na której ją rozwijano, i **nic na dwunastu
nieoglądanych stronach**. Jej koszt jest realny: bieg odrzucony w obu rozmiarach trwa około dwa razy dłużej (najdłuższy
zmierzony: 965 s zamiast 476 s na hoście; w CONTROL-2, sądząc po czasie biegu, drugi odczyt uruchomił się na co najmniej dwóch z dziewięciu odmów). Zostaje w kodzie, bo
niczego, co dziś działa, nie zmienia — ale nie jest postępem na danych ślepych.

**Liczba, która opisuje stan:** na stronach, których nikt wcześniej nie oglądał, model powstaje w **6 z 18**
przypadków (pierwszy przebieg CONTROL 3/6, w tym jeden w złej skali; CONTROL-2 3/12). Wyniki 3/6 i 5/6 na DEV
i CONTROL są wynikami na stronach znanych. Po wydawcach, wszystkie 24 zmierzone strony na `0fe410a`: lipinscy.pl 4/4,
dobredomy.pl 3/4, extradom.pl 2/4, houseplans.com 1/4, architecturaldesigns.com 1/4, domoweklimaty.pl 0/4.

**Trzy rodziny rysunku, których obecny czytnik rzutu nie czyta** (9 odmów CONTROL-2 i 3 odmowy DEV się w nich mieszczą):
1. *Rzut wektorowy z nazwanymi warstwami* (extradom.pl: SVG z grupami `extWall`, `intWall`, `extDim`, `furniture`;
   tekst wymiarów jako krzywe). Ściany i linie wymiarowe są w pliku dokładnie, a czytane są z rastra — stąd
   niestabilność od rozmiaru. To najmocniejsze dostępne źródło i największy wydawca w próbce.
2. *Ściany jako cienka podwójna linia* (houseplans.com, architecturaldesigns.com): przy 850–1024 px ściana ma 4–6 px
   razem z obiema liniami — poniżej okna czytnika (od 6 px). Sonda par linii potwierdza: samo wypełnianie par nie
   wystarczy, arkusz trzeba by czytać powiększony.
3. *Wypełnione tło zamiast ścian zewnętrznych* (domoweklimaty.pl): tło i ściany mają jeden ton; grubość ściany
   zewnętrznej widać tylko we wnękach okien.

## 6. Końcowy przebieg, testy, dostawa

Wszystko poniżej dotyczy rewizji **`101f9d7`** (solver 2.34.0, czytnik miar 1.13.0, adapter ogólny 1.3.0), z zamrożonego
drzewa z własnymi dowiązaniami pakietów. Commit z tym raportem jest późniejszy i zmienia wyłącznie dokumenty oraz
sprostowanie w `ANYLINK-CONTROL.json`.

**Korpus, świeża pełna ścieżka 33 projektów:** 28 modeli, 5 odmów — Modrzewnica (`METRIC_RESOLUTION_INCONCLUSIVE`),
Santany i Eliza (`PLAN_RESOLUTION_INCONCLUSIVE`), Julia (`PLAN_NO_WALLED_ENVELOPE`), Ofelia (`PLAN_LAYOUT_REJECTED`);
te same pięć co na `f73c1cf`. Błędy kompilatora: 8 (`OPENING_ABOVE_WALL_TOP` w Balsamowcach ×2, Jabłonkach ×1,
Zefirantach ×5) — identyczne jak na kodzie 1322, nietknięte.

Porównanie element po elemencie (`regress.py`):
- wobec zamrożonej ekstrakcji 1322 (`572b875`): 27 projektów bez zmian; Bukszpany — model zyskany; 5 projektów ze
  zmianą stropu i ścianek pod nim (Arlety, Aurory, Bratki, Jabłonki, Muraje) — to skutek C1b opisany w §3;
- wobec punktu kontrolnego C2 (replay solvera na końcowej ekstrakcji): jedyną zmianą są zyskane Bukszpany. **Żaden otwór, bryła
  ani dach w działającym domu nie zmienił się przez ANY-LINK.**

Mierniki na końcowych replayach: C1a — rzędne 47 OK, wysokości 47 OK, po 2 bez referencji, **0 autorytetu bez pokrycia**;
C1b — jak w §3 (3 DEV PASS, Bratki CONTROL PASS, a01 i Balsamowce nieodczytane, negatywy PASS, Sasanki = wpis zamrożony
błędnie); C2 — rodzaj przyjęty = zbudowany 361/361, ślad zgodny 335 + jawna różnica 29, **0 nieaktualnych**, drzwi
zewnętrzne na własnym dostępie 133/133.

**Testy** (pełna macierz na spokojnej maszynie, `101f9d7`): 3680 testów — **3654 przechodzą, 15 pada, 11 pominiętych**; typecheck 0 błędów. Zestaw 15 padających jest co do nazwy identyczny z zestawem na `f73c1cf` i żaden nie pochodzi z tej kampanii (przeterminowany snapshot kontraktu Android, `/health` oczekujące starej wersji solvera, cztery strażniki izolacji badań, dwa testy modelu referencyjnego, cztery testy `wall-strip` wymagające dawnej bazy w klonie, jeden `compound-facade`, NFD bez ICU, scena fikstury Larchfield). Nie zostały naprawione w tym etapie. Nowe testy tej rundy: 8 (część budynku), 5 (sprzeczność skali), 1 (otwarty pierścień), testy `ontoFrame` i rozmiaru odczytu — wszystkie przechodzą.

**APK 1326**: `BuildPlan-owner-preview-1326.apk`, versionName `0.1326.0-owner`, z rewizji `101f9d72cd42…`, ten sam podpis
(`6e48fac4…1ca0da`), 72 668 361 B, SHA-256 `2f9c4c5df63657beffa37588ce5763e7611df3772c0bd14191d1e5d5b872f7eb`,
`zipalign -c -P 16 4` poprawny, manifest analizatora: 12 plików, wszystkie hashe zgodne. Pliki 1323–1325 nie zostały
dostarczone (rewizja zmieniała się przed końcem pomiarów) i są porzucone.

**Pakiet z APK uruchomiony na hoście:** pliki analizatora wyjęte z `BuildPlan-owner-preview-1326.apk` do pustego katalogu i uruchomione tym samym launcherem i protokołem co na telefonie (`run-host.mjs`), z żywych adresów, na trzech stronach: Bukszpany (ARCHON, 364 s), dobredomy.pl DEV (99 s), lipinscy.pl DEV (182 s, podgląd częściowy z `FOOTPRINT_AREA_SHORT`). We wszystkich trzech hash paczki źródeł, grafu obserwacji, dowodów metrycznych, modelu i sceny jest **równy** wynikowi kodu źródłowego. Ograniczenie: host to Node 22, nie środowisko telefonu (nodejs-mobile 18 bez ICU); test zgodności bez ICU przechodzi w macierzy tylko na fiksturze.

**Prywatna paczka dowodów (poza Git):** `BuildPlan-SOURCE-TO-MODEL-Private-1326.zip`, 41 556 589 B, SHA-256 `173ab544bd504eccf1e0a40d22dd7d1abc40f1257855c6986af2a857d5f2d338`, 1889 plików: replaye baza/C1a/C1b/ablacja/C2, końcowa pełna ścieżka 33 projektów i replaye z grafami cech, próbka DEV (kod 1322, `f73c1cf`, końcowa), próbka CONTROL (pierwszy ślepy przebieg, końcowa), wyniki mierników i porównań, zamrożone zestawy, dzienniki testów i budowy, zapisy uruchomienia pakietu z APK. Bez obrazów wydawców (sprawdzone: 0 plików graficznych poza renderami modeli, 0 osadzonych danych obrazów).

**Po punkcie kontrolnym — rewizja `0fe410a`, APK 1327.** Testy: pełna macierz 3690 testów — 3664 przechodzą, 15 pada (zestaw co do nazwy identyczny z `101f9d7`, żaden z tej kampanii), 11 pominiętych; typecheck 0 błędów; nowe testy rundy: 4 (miary rozmiaru odczytu), 4 (analizator: która miara, które arkusze mają drugi rozmiar), 2 (kolejność zdarzeń drugiego odczytu; sukces drugiego odczytu zmierzony tylko na prawdziwej stronie). APK `BuildPlan-owner-preview-1327.apk`,
versionName `0.1327.0-owner`, z rewizji `0fe410ae4a2e…`, ten sam podpis, 72 669 141 B, SHA-256
`e7df048d75777ef31e5c22b84cd2bb36a8de9fd96fa63e0734d9da9b6625ac60`, `zipalign -c -P 16 4` poprawny, manifest analizatora
12 plików zgodnych; w pakiecie usługa 1.10.0 i solver 2.34.0. Pakiet wyjęty z APK uruchomiony na hoście na żywym
adresie strony CONTROL extradom.pl: pierwszy odczyt odrzucony po 89 s, drugi odczyt z zapieczętowanej paczki daje model
po 144 s; hash modelu i sceny równy wynikowi kodu źródłowego (paczka źródeł pobrana na żywo różni się od tej z pamięci
podręcznej pomiaru). Znane ograniczenie: przy drugim odczycie postęp wraca do początku — na ekranie telefonu
niesprawdzone. Paczka dowodów 1326 nie została przebudowana; wyniki tej rundy (CONTROL-2 na obu rewizjach, skan,
sondy) leżą poza Git w katalogu roboczym sesji.

## 7. Nierozwiązane, nazwane

- ANY-LINK: patrz 5.4. Dodatkowo: strony bez opublikowanej powierzchni zabudowy ani wymiarów nie mają skali awaryjnej;
  wydawcy odmawiający klientowi (HTTP 403) są poza zasięgiem; obie próbki razem to 12 stron sześciu wydawców.
- Decyzja produktowa dla OWNER-a, niewdrożona: czy strona, z której nie da się odczytać rzutu, ma dostać **bryłę
  z samych opublikowanych danych** (szerokość, długość, wysokość, kąt dachu) oznaczoną jako „bryła z danych, nie
  z rysunków”. Dałoby to model dla większości stron bez modelu, ale byłby to prostopadłościan z dachem, bez otworów.
- Sasanki: źródło drukuje dwie wysokości parteru (273/278); zastosowano jedną, konflikt niewidoczny dla solvera.
- C1b obejmuje jedną rodzinę (wysokość w świetle parteru); ścianki kolankowe, wysokości wyższych kondygnacji i stropy
  nad nimi nadal nie mają konsumenta. a01 i Balsamowce: wymiar nieodczytany przez czytnik.
- C2: relacja balkonu obserwowanego bez płyty ma typ i zapis, bez przypadku w korpusie; `access` (podest/stopień) nie
  ma jeszcze czytnika — politykę sprawdzają testy.
- Znane z 1322 i nietknięte: poziom poddasza Ciesz (+2,93 zamiast +3,34), wysokości dwóch okien Ciesz, lewe okno tylne
  Bakop z konwencji; 8 błędów `OPENING_ABOVE_WALL_TOP`; bramki przypisania opisów, kątów i pokrycia wymiarów pionowych
  niespełnione.
- Android UI: **NOT_VERIFIED** (brak urządzenia) — w tym nowy tekst `partial_footprint_short`.
- 0 płatnych wywołań; księga bez zmian (0,60838938 USD z 5 USD, estymata, rozliczenie niepotwierdzone). H2 nieużyte.
