# SOURCE → MODEL v3.54.6 — debug od źródła do oddanego modelu, powtarzalność na Marcówkach GE

Kampania v3.54.6, 2026-11-17. Gałąź `claude/new-session-3kzcgh`. Master Plan v3.54.6: `docs/MASTER_PLAN.md`
(sha256 `e3ac67b3ce699f79…`, plik zastąpiony w całości; nowe D38, D39, §7.8). Start: HEAD `14f236b` (v3.54.5),
zamrożony kandydat v3.54.5 `627e4f1`, baza H `3c531aee`. Rewizje tej kampanii: `54d31f6` (poprawki przepływu —
na niej przeszły trzy świeże odczyty Marcówek), `f9cb3ef` (D39, skala zbioru; z niej zbudowany finalny host),
oraz commit raportu. Raport jest jednym dokumentem końcowym.

## 1. Werdykt

**Pierwsza strata każdego defektu wskazanego w briefie jest znaleziona na zapisanych odpowiedziach, nazwana z plikiem
i funkcją, i — tam, gdzie da się to obronić — naprawiona w zwykłym przepływie.** Na tych samych zapisanych odpowiedziach
(bez API) nowy konsument daje:

- **Pliszka**: dom oddany ma 4/4 zbudowane strony, 10/11 otworów na swoim miejscu (7 w tolerancji), **0 fałszywych**;
  v3.54.5 oddawała LOCAL z 11/11 dopasowanymi i **17 fałszywymi** otworami i złym dachem. Wysokość przechodzi według
  jednej definicji (rozdz. 3.1);
- **Mirabelka 4**: po zmianie wyboru obrazów (nowy odczyt, 0,168 USD) wszystkie 4 elewacje wysłane, opisane
  i zarejestrowane, **9/9 otworów poprawnych, 0 fałszywych**, oddany opis (było 0/9; LOCAL 3 poprawne, 5 fałszywych);
- **Alaska**: przeszklenie szczytu zbudowane (jeden otwór z naświetlem, głowica obniżona o 0,40 m pod linię szczytu,
  `APPROXIMATED`, sprawdzone po kompilacji); 4 fałszywe otwory mają jedną przyczynę — kolumny ścian elewacji czytane
  z ramą tarasu (rozdz. 3.2) — **nienaprawione, nazwane**;
- **Kardamon / 550029LAN**: `NOT_CONSUMED` miał trzy różne przyczyny i każda ma teraz własny kod
  (`HELD_BY_DEPENDENCY` — ściana-gospodarz odrzucona przez jądro; `CAPABILITY_MISSING` — wiersze okapu/kalenicy bez
  konsumenta; `NO_CHANGE`);
- **wybór LOCAL/opis** trzyma oba skompilowane modele przy tych samych zarejestrowanych elewacjach (otwory na każdej
  stronie), przy jednej definicji wysokości i oznacza niezweryfikowaną metrykę jako podgląd częściowy; oddana rewizja
  jest mierzona ponownie (D38).

**Marcówki GE**: trzy niezależne świeże odczyty z tymi samymi bajtami i ustawieniami dały **trzy różne modele**;
pierwsza różnica jest **już w pierwszym etapie** (ten sam ładunek INVENTORY — inna odpowiedź). Każdy odczyt odtworzony
dwa razy bez API daje **bit w bit ten sam** model, scenę i decyzję (6/6). Wierność: odczyty 4/7, 3/4, 3/4 otworów
poprawnych/dopasowanych z 11 w prawdzie źródłowej, 0 fałszywych; LOCAL 11/11, 1 fałszywy — i to LOCAL został oddany
we wszystkich trzech (wybór poprawny). **Powtarzalność odczytu: NIE. Powtarzalność budowy z odczytu: TAK.**
Stąd D39: **przyjęta rewizja jest odtwarzana** — drugie niezależne zadanie na hoście dostało ten sam model bez żadnego
żądania (0 USD).

**Host z `f9cb3ef` przeszedł E2E** (wszystkie kontrole): Marcówki z tokenem (4 żądania, 0,209558 USD, rewizja
przyjęta), drugie zadanie na ten sam adres (0 żądań, `REVISION_REUSED`, ten sam `modelHash` i scena), zadanie bez tokena
(0 USD, bez dokumentu domu). Android: kod nie zmieniany; odświeżony tylko snapshot kontraktu (rozdz. 9); APK nie budowany.

| status | wynik |
|---|---|
| DIAGNOSIS_COMPLETE | **tak** — Pliszka (wysokość, rejestracja, przegląd, wybór), Alaska (szczyt, 4 fałszywe), Mirabelka (wybór obrazów), Kardamon/550029LAN (statusy przeglądu), Marcówki (pierwszy punkt różnicy) |
| FIX_IN_FLOW | **tak** dla wysokości, rejestracji, szczytu, wyboru obrazów, statusów przeglądu, wyboru modelu, D39; **nie** dla Alaski (fałszywe otwory) i wnęki 0,65 m Marcówek (brak zdolności buildera) |
| REGRESSION | **bez strat** na 8 domach potwierdzenia × 2 zestawy odpowiedzi i 6 domach DEV; jeden dodatkowy fałszywy otwór na Kardamonie przy +5 dopasowanych (oddany jako podgląd częściowy) |
| MARCOWKI_REPEATABILITY | odczyt **NIE** (3 różne modele); budowa z odczytu **TAK** (6/6 odtworzeń identycznych) |
| ACCEPTED_REVISION_REUSE (D39) | **tak** — w `describeLink` i na hoście (drugie zadanie: 0 żądań, ten sam model) |
| HOST_INTEGRATION_VERIFIED | **tak** — build `f9cb3ef` |
| ANDROID | **NOT_VERIFIED** (bez APK; zmiana tylko w zasobie testowym kontraktu) |

## 2. Księgi i koszty

| | USD | żądania |
|---|---|---|
| księgi na starcie (`/home/user/rd/v3542/books`, nigdy nie resetowane) | 19,27633 | 356 |
| Marcówki — odczyt 1 / 2 / 3 | 0,22054 / 0,303464 / 0,340136 | 4 / 5 / 5 |
| Mirabelka 4 — nowy odczyt | 0,168 | 4 |
| Tracja 2 — nowy odczyt (kontrola po zmianie wyboru obrazów) | 0,137836 | 4 |
| finalny host (Marcówki, zadanie 1) | 0,209558 | 4 |
| **razem v3.54.6** | **1,379534** | **26** |
| księgi po kampanii | **20,655864** z 24,11036 | 382 |

Pozostało 3,454496 USD. Wszystkie odtworzenia (ok. 120 przebiegów domów) i cztery zadania D39 poza hostem: 0 USD.
Szacunek Marcówek z briefu (~0,52 USD) był na odczyt; rzeczywiście 0,22–0,34. Rezerwacje sprawdzone przed pierwszym
żądaniem: w dzienniku ksiąg jest **jedna** rezerwacja bez rozliczenia (`b3b6fe35421e89d5`, 2026-11-16, 0,146096 USD,
pierwszy wpis po otwarciu ksiąg v3.54.4). Jest wliczona w saldo 19,27633 (saldo się zgadza z ledgerami v3.54.4+v3.54.5),
więc pozostała pula jest zaniżona, nie zawyżona; nie zwalniałem jej, bo nie wiadomo, czy żądanie poszło.
Ledger: `research/ai-assist/spend-ledger-v3546.json` (26 wpisów). Klucz: z pliku poza repo, podawany jednemu
poleceniu jako zmienna środowiska; przed każdym commitem skan diffu na jego wartość (czysto).

## 3. Diagnozy na zapisanych odpowiedziach

Dane: odpowiedzi kampanii v3.54.5 (`/home/user/rd/v3545/CBASE`, `CNEW`, `LIVE`), bajty w ich cache, LOCAL z `CLOCAL`/`LOC`.
Każdy łańcuch: źródło → wysłane → surowa odpowiedź → obserwacje → przypisanie → wartość przyjęta → komenda → siatka →
wybór → scena oddana. „Stary konsument" = kod v3.54.5; „nowy" = ten.

### 3.1 Pliszka V plus — wysokość (sprostowanie uzasadnienia raportu v3.54.5)

Raport v3.54.5 napisał, że całkowita wysokość 6,71 m jest „wydrukowana na przekroju". **To było nieprawdą.** Paczka nie
ma przekroju (0 przekrojów w selekcji). 6,71 m to metadana strony (`published.building_height = 6,71 m`, „6,71 m");
czytnik powtórzył ją jako poziom `TOTAL_HEIGHT` na obrazie **p1, który jest rzutem**. Kontrola `height-printed`
w `packages/reconstruction/src/house/resolve.ts` (`resolveHouse`, sekcja 4) brała `lv('TOTAL_HEIGHT')[0]` bez względu na
obraz i porównywała ją z tolerancją przekroju 0,35 m, a teren był konwencją `DEFAULT −0,30`.

| wejście | kalenica nad ±0,00 | teren | „wysokość" | `height-printed` | `height-published` |
|---|---|---|---|---|---|
| stary konsument + stara odpowiedź (CBASE) | +6,08 | −0,30 (konwencja) | 6,38 | PASS (|6,38−6,71| = 0,33 ≤ 0,35) | PASS |
| nowy konsument v3.54.5 + ta sama odpowiedź (CREPLAY) | +6,01 | −0,30 | 6,31 | **FAIL** (0,40) | PASS |
| nowy konsument v3.54.5 + nowa odpowiedź (CNEW) | +5,95 | −0,30 | 6,25 | **FAIL** (0,46) | PASS |
| **v3.54.6 + CBASE / CNEW** | +6,04 / +6,05 | brak znaku: pasmo 0–1,2 m | — | **nie dotyczy** (brak druku na przekroju/elewacji) | **PASS**: teren wynikający 0,66–0,67 m pod ±0,00 |

Referencja (`refs-confirm/c5-studioatrium-pliszka-v-plus.json`, elewacja frontowa): kalenica w wierszu 298, ±0,00
w 512, linia gruntu 529, 2,82 cm/px → kalenica ≈ +6,03 m nad ±0,00, teren ≈ 0,48 m niżej → 6,51 m; strona podaje 6,71.
Zgodność 6,71 wymaga terenu ok. 0,66 m pod posadzką — prawdopodobne, ale niewydrukowane. Pierwsza funkcja, która
zmieniła wynik: `resolveHouse` (kontrola wysokości). Naprawa: (1) `TOTAL_HEIGHT` liczy się tylko z obrazu
`SECTION`/`ELEVATION`; (2) jedna definicja `heightAgainstFigure(top, terrain, figure, tol)`: liczba ze źródła to
wierzch dachu nad **terenem**; bez znaku terenu liczba jest spełniona, gdy teren, który z niej wynika, leży 0–1,2 m pod
±0,00 (± tolerancja) — i kontrola mówi, że teren jest nieznany. Ta sama funkcja trzyma opis i LOCAL (rozdz. 5).
Rzeczywisty konflikt nie jest wchłaniany: wierzch 6,3 m przy liczbie 8,8 m albo 7,4 m przy 6,71 m — FAIL (testy).

### 3.2 Pliszka — rejestracja elewacji

Stan v3.54.5: 4 opisane, 1 zarejestrowana; front 5,61 m od końców brył, boki 1,05 m. Łańcuch po poprawce wysokości:

| elewacja | kolumny czytnika (px) | rzut (m) | co jest źle | pierwsza strata |
|---|---|---|---|---|
| LEWA p5 | dom 185–688, garaż 688–860 | garaż widoczny z lewej tylko na 5,06 m (stoi za lewym skrzydłem) | czytnik podał **widoczne** końce, rejestracja porównywała z **całymi** bryłami | `resolveHouse` → `fit` (porównanie końców) |
| FRONT p6 | dom 313–423, garaż 423–722 | dom 0–4,78 m, garaż 4,78–11,45 m | dach garażu nakrywa wnękę wejścia (referencja: „its gable roof also covers the entrance recess to its left"); czytnik i recenzent wzięli krawędź dachu za ścianę → wewnętrzny koniec 1,7–1,8 m od rzutu | odczyt (`FACADES`), potem `fit` |
| PRAWA p4 | garaż 170–342, dom 342–845 | podział dom/garaż w rzucie na 6,39 m od frontu; wymiar `5.00` i referencja: garaż 5,00 m głęboki | śledzony podział brył w rzucie jest zły (notatka czytnika: „division line approximate") | odczyt (`PLAN`) |
| TYŁ p7 | dom 303–712 | 11,45 m | rejestruje się (2 końce) | — |

Skala zbioru: LEWA 2,807 cm/px; FRONT na końcach zewnętrznych 2,793–2,800; PRAWA 2,807 — zgodne co do 0,5 %.
Naprawa (dwa kroki, każdy zmierzony osobno na odtworzeniu):
1. `visibleExtent` — końce części bryły najbliższej widzowi są drugą hipotezą; rejestracja próbuje obu
   (`ELEVATION_ENDS_VISIBLE`). Wynik: LEWA rejestruje się (najgorsza reszta 0,12–0,15 m).
2. `fitOuter` — elewacja w kolejności rzutu, której wewnętrzne końce chybiają, rejestruje się **tylko na dwóch
   zewnętrznych końcach**, gdy skala, którą one dają, zgadza się ze skalą najlepiej zarejestrowanej elewacji zbioru
   (≥3 końce) w 3 % **i** zgadza się kalenica. Wewnętrzne końce są mierzone i **nazwane, nieużyte**
   (`ELEVATION_INNER_ENDS_OFF`: „garage left −1,78 m"), bo obraz nie mówi, który z dwóch odczytów (kolumna elewacji czy
   podział w rzucie) jest zły. Wynik: FRONT i PRAWA rejestrują się; 4/4.

Tolerancja 3 %: front i tył ręcznie sprawdzonej Gracji (6 końców każda) różnią się o 2,5 %; błąd kolumny przez okap
(Alaska) daje 9–10 %. Gdy obie hipotezy (całe/widoczne) pasują przy różnych skalach, decyduje skala zbioru, nie reszta
— bez tego Lubczyk (DEV) tracił jedno poprawne okno i zyskiwał fałszywe (wykryte w regresji, poprawione, rozdz. 7).

Zależne otwory przeliczone: po rejestracji FRONT/PRAWA otwory z tych elewacji przechodzą do budowy; 10 z 11 dopasowanych.
Brakujące B2 (tył): czytnik obrysował szklenie salonu za otwartym tarasem do wiersza 330 (5,11 m) zamiast 438 (≈2,1 m) —
wziął dach tarasu za szkło; jądro odmówiło (`OPENING_ABOVE_WALL_TOP`, ściana 2,84 m) i obniżenie o 2,3 m nie jest
przybliżeniem — zostaje obserwacją z miarą.

**Przegląd** (stare operacje, jawnie przepięte): `SET_ELEVATION_BODY ×2` z v3.54.5 (`WRONG_BINDING`) były poprawne co do
celu (`el-p6`, bryły `main`/`garage`), tylko podane jako `box` zamiast `leftX/rightX`; `applyCorrection` je odrzucał.
Teraz `box` jest przyjmowany; na tych samych odpowiedziach obie operacje są `APPLIED` i zmieniają model
(`f3eb35f33b → bb05d0eb0d → dc13c1f582`). Na CBASE jedna z czterech to `NO_CHANGE` (powtarza odczyt), jedna
`NOT_CONSUMED` (garaż prawej elewacji: model ten sam).

**Wybór**: v3.54.5 oddała LOCAL z 17 fałszywymi otworami i złym dachem. Teraz oba skompilowane modele są trzymane przy
tych samych 4 zarejestrowanych elewacjach: LOCAL na froncie 2/3 + 1 obcy, prawa 2/4 + 8 obcych, tył 2/2 + 3, lewa 2/2 + 4,
obrys 194,6 m² wobec 171,5 m² śledzonego i 81 % pokrycia; opis: 1 sprzeczność (tył 1/2 — brak B2). Oddany: opis jako
**podgląd częściowy** (`BOTH_CONTRADICT`, mniej sprzeczności). Uwaga: obrys 171,5 m² z rzutu jest mniejszy niż
opublikowane 201,5 m² zabudowy (zabudowa zawiera zadaszenia) — nie jest użyty jako kotwica.

### 3.3 Alaska — przeszklenie szczytu i 4 fałszywe otwory

Źródło (referencja `L1`): jedno wysokie przeszklenie salonu: cztery pola do wysokości drzwi, naświetle w wierszach
248–258, nad nim dwudzielne szklenie, którego góra idzie po połaci (pionowe boki do wiersza 138, wierzchołek x 280).
Czytnik: `o1` drzwi 260–414 i `o2` okno 67,5–250 (próg 2,325 m, góra 4,912 m). Ściana szczytowa nad szerokością
otworu ma najniżej 4,561–4,605 m. Jądro (`packages/geometry/src/wall-compiler.ts`, akceptacja otworu) odmawia
prostokąta ponad funkcją wierzchu — poprawnie; reprezentacja głowicy zna tylko `LEVEL` i `RAKED` (jedna pochyłość), nie
dwuspadową. Test jądra z poprawnym wejściem (głowica pod linią szczytu) — wycina.
Naprawa w przepływie: (1) **naświetle** — dwa prostokąty jednej szerokości jeden nad drugim, z przerwą mniejszą niż
nadproże (0,2 m), są jednym otworem (`OPENING_TRANSOM`); (2) **głowica nad wierzchem ściany** po kompilacji: miara
jądra („whose top is only X m there") → wysokość obniżona do X − 0,05 m, **tylko** w granicy reguły otworów (0,6 m
i 25 % wysokości), budowa i kompilacja jeszcze raz, `APPROXIMATED` z powodem; poza granicą otwór zostaje poza modelem
z miarą (Pliszka B2: 2,3 m). Wynik: `opening-left-1` 2,778 × 4,511 m, wycięty, kontrola `openings-cut` 11/11 zgodnych.
Kształt pod szczytem nie jest rysowany — nazwane.

Cztery fałszywe otwory (3 front, 1 tył) — każdy osobno: żaden nie jest dodanym obiektem, złym gospodarzem ani złym
typem; **wszystkie są przesunięte** (wrong offset) jedną mapą długości. Pierwsza strata: kolumny ściany na długich
elewacjach: front 222–1571 px (referencja 362–1567), tył 10–1341 (referencja 2–1200) — czytnik wliczył ramę zadaszonego
tarasu/okap. Skala wzdłuż: 1,278 i 1,295 cm/px wobec 1,417–1,423 na szczytach (9–10 %). Przy jednej bryle na stronie
dopasowanie dwóch końców jest dokładnie wyznaczone, więc reszta jest zerowa; pionowe kotwice (okap +2,67, posadzka)
nie zgadzają się między sobą lepiej niż ~6 %, więc nie mogą rozstrzygnąć 9–10 %. **Nienaprawione** — progu, który
by tu zadziałał, nie umiem uzasadnić bez ryzyka gdzie indziej; granica nazwana (rozdz. 10).

### 3.4 Mirabelka 4 — wybór obrazów

Paczka: 102 zasoby, 99 `UNKNOWN`, wszystkie bez podpisu roli. Odtworzenie wyboru na pełnej liście
(`research/source-to-model/v3546/pictures-probe.ts`): każde z ~22 różnych zdjęć wydawca serwuje w 3–4 rozmiarach
(`…/1272x715/…/<nazwa>.jpg`, `…/736x425/…/<nazwa>.jpg`, `…/c/2048x1280/…`) z **różnymi bajtami**, więc
deduplikacja po `byteHash` ich nie łączyła; ranking `UNKNOWN` po polu wstawiał duże kopie renderów na przód; limit 24
odciął wszystkie cztery elewacje bez etykiety. Rejestr pisał `NO_SOURCE`, bo liczył tylko obrazy z rolą ze strony.
Ta sama budowa paczek dotyczy 51853HZ (21 kopii), 550029LAN (10), Tracji 2 (3).
Naprawa (`pictures.ts`, `housePictures`), **tylko gdy limit wybiera** (≤24 kandydatów — kolejność bez zmian, odtworzenia
ważne): jedna nazwa pliku (≥20 znaków) w kilku rozmiarach = jeden obraz, zostaje największa kopia (`SAME_PICTURE`);
kolejność: rysunki nazwane przez stronę → nieklasyfikowane wyglądające na rysunek (udział pikseli szarych ≥ 0,55,
od najbardziej szarych) → najwyżej 4 rendery/zdjęcia nazwane → reszta. Każdy pominięty obraz ma kod
(`TOO_SMALL / NO_BYTES / NOT_DECODED / SAME_PICTURE / LIMIT`). Rejestr: elewacja nazwana ucięta limitem = `NOT_SENT`;
obrazy nieznanej roli ucięte limitem są policzone i `NO_SOURCE` mówi, jak daleko szukano („searched: N sent; M of
unresolved role not sent — uncertain"). Testy: paczka bez elewacji i z samymi renderami wnętrz, oraz paczka pod limitem.
Wynik: 23 obrazy wysłane (79 pominiętych: 47 za małe, 32 kopie), wszystkie 4 elewacje referencji wysłane; świeży odczyt
(0,168 USD): 4/4 opisane i zarejestrowane, **9/9 poprawnych, 0 fałszywych**, oddany opis
(`DESCRIBED_MEETS_SOURCE_LOCAL_CONTRADICTS`). Tracja 2 po tej samej zmianie: 10/10 jak wcześniej, LOCAL zostaje
(`LOCAL_MEETS_SOURCE`).

### 3.5 Kardamon i 550029LAN — `NOT_CONSUMED`

Zapisany przegląd v3.54.5: 7 propozycji, 5 `NOT_CONSUMED`, 2 `WRONG_BINDING` (Pliszka), 0 zastosowanych.
Wspólna przyczyna: `acceptCorrection` (`packages/analysis-service/src/house/review.ts`) dawał `NOT_CONSUMED` każdej
operacji, po której hash modelu się nie zmienił — bez szukania pierwszej straty. Trzy różne straty:

| dom | operacje | pierwsza strata (wynik hosta) | kod teraz |
|---|---|---|---|
| Kardamon | `ADD_OPENING el-p3/o1…o4` (cztery małe okna lewej elewacji) | okna są uzgodnione, ale ich ściany-gospodarze `w-main-5`, `w-garage-5` jądro odrzuciło (`WALLS_OVERLAP` ze ścianami tej samej obwiedni) i okna poszły z nimi; rekord otworu nie miał powodu | `HELD_BY_DEPENDENCY` z nazwą ściany; rekord otworu mówi to samo |
| 550029LAN | `SET_ROOF HIP` z `eavesY/ridgeY` (recenzent: niższy spadek) | rodzaj i kierunek kalenicy już takie same; wiersze okapu/kalenicy nie mają konsumenta w `SET_ROOF` | `CAPABILITY_MISSING` |
| (Pliszka CBASE) | `SET_ELEVATION_BODY main` | powtarza odczyt | `NO_CHANGE` |

Pozostały kod `NOT_CONSUMED` zostaje dla operacji, która niczego nie dosięgła bez nazwanego powodu.

## 4. Tabela domów

| dom | defekt | źródło / region | stan wejścia | pierwsza rozbieżność (plik / funkcja) | interwencja pojedyncza → wynik | zmiana produkcyjna | kontrola po kompilacji | kandydat → oddany |
|---|---|---|---|---|---|---|---|---|
| Pliszka | wysokość FAIL | strona: 6,71 m; p1 = rzut | CBASE, CNEW, CREPLAY | `resolve.ts` / `resolveHouse` (TOTAL_HEIGHT bez roli obrazu, teren-konwencja) | filtr roli + `heightAgainstFigure` → PASS (teren 0,66 m) | tak | `height-published` PASS | — |
| Pliszka | front/prawa nie rejestrują | p6, p4; dach garażu nad wnęką; podział brył w rzucie | CBASE, CNEW | `resolve.ts` / `fit` | `visibleExtent` → LEWA; `fitOuter` → FRONT, PRAWA; 4/4 | tak | 10/11 otworów, `openings-cut` PASS | opis (podgląd częściowy) / v3.54.5: LOCAL z 17 fałszywymi |
| Pliszka | przegląd `WRONG_BINDING ×2` | `SET_ELEVATION_BODY` z `box` | CNEW (stare operacje) | `review.ts` / `applyCorrection` | `box` przyjęty → 2× `APPLIED` | tak | model zmieniony, kontrole bez nowych błędów | — |
| Pliszka | B2 nie wycięty | p7, szklenie za tarasem | CNEW | odczyt (`FACADES`): góra w wierszu 330 zamiast 438 | obniżenie 2,3 m > granica | nie (granica) | `OPENING_ABOVE_WALL_TOP`, z miarą | — |
| Alaska | przeszklenie szczytu nie wycięte | p6 (LEWA), szczyt tarasu | CNEW | `wall-compiler.ts` (poprawna odmowa); reprezentacja głowicy | naświetle + obniżenie 0,40 m → wycięte | tak | hole 2,778 × 4,511 m = program | opis / opis |
| Alaska | 4 fałszywe otwory | p3, p4 — kolumny z ramą tarasu | CNEW | odczyt (`FACADES`) → `fit` (1 bryła = dokładnie wyznaczone) | — | nie | — | — |
| Mirabelka 4 | 4 elewacje niewysłane | 102 zasoby, kopie w 3–4 rozmiarach | pełna lista | `pictures.ts` / `housePictures` | deduplikacja + ranking → 4/4 wysłane | tak | 9/9 otworów | opis / opis (było LOCAL) |
| Kardamon | `NOT_CONSUMED ×4` | lewa elewacja p3 | CNEW | jądro (`WALLS_OVERLAP`) → zrzut zależnych | — | tak (kod i powód) | — | opis (podgląd częściowy: metryka nieweryfikowana) |
| 550029LAN | `NOT_CONSUMED` | `SET_ROOF` | CNEW | `review.ts` / brak konsumenta | — | tak (kod) | — | opis / opis |
| Marcówki | ściany zdjęte z otworami | obwiednia: wnęka 0,65 m (szerokość < 2 × 0,45 m ściany) | odczyty 1–3 | `build.ts` / jądro `WALLS_OVERLAP` | próba „krótsza ściana ustępuje" — nie zadziałała na żadnym realnym przypadku, **wycofana** | nie (brak zdolności) | — | LOCAL / LOCAL |

Odtworzenia w łańcuchu: zawsze najpierw bez API; interwencje to zmiany kodu konsumenta mierzone na tych samych
zapisanych odpowiedziach — żadnej ręcznej podmiany wartości w obserwacjach nie było, więc nic nie trzeba było
usuwać przed biegami automatycznymi.

## 5. Wybór modelu (D38)

`arbitrate` (`packages/analysis-service/src/house/describe.ts`):
- **jedna definicja wysokości** dla obu modeli (`heightAgainstFigure`, ta sama tolerancja 0,45 m); LOCAL nie dostaje już
  +0,3 m terenu i +0,3 m tolerancji, których opis nie dostawał. LOCAL znający swój teren (`heightAboveTerrainM`) jest
  porównany wprost;
- **otwory na każdej zarejestrowanej elewacji** (`openingsAgainstElevation`): pozycje z transformacji rejestracji,
  otwór modelu jest tym otworem, gdy jego środek leży w 0,5 m (lub ćwierci szerokości); strona spełniona przy ≥70 %
  obecnych i ≤30 % (min. 1) obcych. Te same dowody dla obu modeli. Elewacja niezarejestrowana nie daje pozycji —
  „nieoceniane", powiedziane. LOCAL bez zmierzonych otworów nie jest liczony jako zero — powiedziane;
- **metryka nieweryfikowana** (skala z opublikowanej zabudowy, bez wydrukowanego wymiaru) → oddany opis jest
  podglądem częściowym (Kardamon: 19,58 × 19,27 m wobec 18,02 × 17,80 m w referencji);
- **kontrola oddanej rewizji**: model oddany (opis albo LOCAL po wycofaniu) jest serializowany i mierzony jeszcze raz;
  hash porównany z hashem modelu, który wybór mierzył (`decision.delivered`, `DELIVERED_DIFFERS` gdy różny).
  Na hoście: `job-1/2` oddały LOCAL, `same: true`.

Kontrprzykłady w testach: poprawny LOCAL przeciw opisowi z tego samego odczytu zostaje (`LOCAL`); LOCAL z otworami
przesuniętymi o 2,5 m przegrywa; LOCAL bez pomiaru otworów nie jest karany; elewacja niezarejestrowana — brak
porównania. Testy v3.54.4/v3.54.5 (65) przechodzą bez zmian oczekiwań.

## 6. Marcówki GE — trzy niezależne odczyty

Wariant: https://www.archon.pl/projekty-domow/projekt-dom-w-marcowkach-ge-m2fa281446a8ca, pobrany 2026-11-17
(`research/source-to-model/v3546/sources/marcowki-ge.source-package.json`, `contentHash 9f8cdc5a…`).
**Wszystkie 26 wariantów obrazów są bajt w bajt te same** co w paczce zapieczętowanej 2026-09-24, na której zbudowano
`research/marcowki-v2` (prawda źródłowa v2, 138 pozycji); fakty strony identyczne; różni się tylko `pageHash`
(znaczniki strony: tytuł „Opis projektu" zamiast „Dane projektu"). Wariant GE i referencja pasują. Referencja służyła
wyłącznie ocenie — nie trafiła do żadnego zapytania.
Wejście przypięte: 19 obrazów wysłanych (1 pominięty), kolejność z `housePictures`, przekształcenia z `sentPicture`,
kontrakt `buildapp.house-reading@0.2.0`, model `claude-sonnet-5-5`, przegląd włączony, kod `54d31f6`, środowisko:
kontener sesji, Node 22. LOCAL raz: `second-house.ts --recogniser` (5 min 31 s, 2 bryły, 12 otworów, `modelHash 2bf77328…`).

| | odczyt 1 | odczyt 2 | odczyt 3 |
|---|---|---|---|
| ładunek INVENTORY / PLAN | `5b555d0b` / `86c88c7e` | **te same** | **te same** |
| odpowiedź INVENTORY | `55c3a760` | `adbb9239` | `a934eb1b` |
| ładunek FACADES (zależy od odpowiedzi PLAN) | `34df36e0` | `b515c06f` | `396aa739` |
| pierwsza różnica | — | INVENTORY: ten sam ładunek, inna odpowiedź | to samo |
| żądania / USD / s | 4 / 0,22054 / 115 | 5 / 0,303464 / 166 | 5 / 0,340136 / 198 |
| obserwacje / model / scena | `5a6b5696` / `ed17123f` / `519685fa` | `a4de4d79` / `c34b9216` / `e796d15c` | `1b22936d` / `582b9266` / `b8e310f1` |
| 2 odtworzenia bez API (osobne katalogi stanu) | identyczne 2/2 (wszystkie hashe) | 2/2 | 2/2 |
| bryły | dom 0–7,91 × 0–14,49, dwuspad 40°, kalenica +7,95; garaż płaski +3,04 | dom 0–**8,53** × 0–14,41; garaż +3,03 | dom 0–7,91 × 0–14,44; garaż z **1,03**–8,40, +3,00 |
| orientacja (front) / garaż / dach | BOTTOM / tak / jak źródło | to samo | to samo |
| otwory zbudowane (front/prawa/tył/lewa) | 3 / 1 / 3 / 0 | 0 / 1 / 3 / 0 | 1 / 1 / 3 / 0 (konsument końcowy) |
| wobec prawdy źródłowej (11 zewn.) poprawne / dopasowane / fałszywe | 4 / 7 / 0 | 3 / 4 / 0 | 3 / 4 / 0 (konsument końcowy: 4 / 5 / 0) |
| decyzja / oddany | `BOTH_CONTRADICT` → LOCAL (podgląd częściowy) | to samo | to samo |

Różnice otworów między odczytami (sparowane po środku na tej samej stronie): odczyt 1 ma 3 otwory frontu, których
odczyt 2 nie ma; środki sparowanych różnią się o 7–238 mm, szerokości do 549 mm, góry do 291 mm; 1–2 zmiany typu
(okno/drzwi) na parę odczytów. Niepewność źródła tych otworów: ±40 mm (prawda v2). Różnice są więc odczytem, nie
pomiarem.
Dlaczego otwory odpadają (pierwsza strata, każdy odczyt): **lewa** — ściana `w-main-9` odrzucona przez jądro
(`WALLS_OVERLAP` ze ścianami wnęki 0,65 m przy narożu; obwiednia ma uskoki portalu szersze niż 0 i węższe niż dwie
grubości ściany), otwory poszły z nią; **front** (odczyty 2–3) — elewacja frontowa z kolumnami garażu 567–1090 px
nakładającymi się na dom 375–840 (płaski dach garażu nad wnęką portalu): odczyt 1 i 2 rejestrują się na końcach
zewnętrznych, odczyt 3 po zmianie skali zbioru na „najlepiej zarejestrowaną elewację" (w `54d31f6` mediana wybierała
skalę elewacji z resztą 0,54 m); w odczycie 2 ściany frontu też odrzucone (`WALL_CONSUMED`). LOCAL tych wnęk nie ma
w tej postaci — stąd 11/11.
Werdykt: **wierność** odczytu na Marcówkach poniżej LOCAL (LOCAL był rozwijany na tym domu we wcześniejszych etapach —
to nie jest dom nowy dla LOCAL); **powtarzalność odczytu: NIE**, **powtarzalność budowy z odczytu: TAK**; wybór we
wszystkich trzech poprawnie zostawił LOCAL. Czwarty niezależny odczyt (host, zadanie 1) dał jeszcze inną decyzję
(`DESCRIBED_REJECTED_LOCAL_KEPT`). Wejście aplikacji sprawdzone: `describeLink` (skrypt biegów) i publiczne
`POST /v1/analyses` (host).

## 7. Regresja na zapisanych odpowiedziach (konsument końcowy, bez API)

Oceniacz szczegółowy `v3545-detail/1` (bez zmian), referencje v3.54.5.

| dom | stary konsument (CNEW / LIVE) | nowy konsument, te same odpowiedzi | LOCAL |
|---|---|---|---|
| Malaxisach 2 | 2/4 stron, 4 popr., 9/12, 0 fałsz. | bez zmian | — |
| Anodach 3 | 4/4, 11, 11/13, 0 | bez zmian | — |
| Kardamon | 0/4, 1, 4/23, 1 | 1/4, 1, **9/23, 2** | — |
| Alaska | 4/4, 1, 7/11, 4 | 4/4, 1, 7/11, 4 (szczyt wycięty) | 1/4, 0, 1/11, 11 |
| Pliszka | 1/4, 1, 1/11, 0 | **4/4, 7, 10/11, 0** | 4/4, 0, 11/11, 17 |
| Tracja 2 | 4/4, 10, 10/10, 0 | świeży odczyt: bez zmian | 4/4, 8, 10/10, 0 |
| Mirabelka 4 | 0/4, 0, 0/9, 0 | świeży odczyt: **4/4, 9, 9/9, 0** | 4/4, 3, 7/9, 5 |
| 550029LAN | 0/4, 0, 10/47, 10 | bez zmian | — |
| Lubczyk 2 (DEV) | 4/4, 4, 13/17, 1 | bez zmian (po poprawce skali zbioru; wcześniej 3 / 2 fałsz.) | 4/4, 2, 11/17, 3 |
| Frizea (DEV) | 3/4, 8, 10/15, 0 | **4/4, 12, 14/15, 0** | 4/4, 8, 14/15, 0 |
| Pallas (DEV) | 4/4, 3, 12/15, 0 | 4/4, 3, 13/15, 0 | 3/4, 1, 14/15, 12 |
| Oslo, Dublin, Wena (DEV) | bez zmian | bez zmian | — |

Na zestawie CBASE (odpowiedzi ścieżki bazowej) — te same wnioski (Pliszka 4/4, 10/11, 0 fałsz.).
Mirabelka i Tracja nie mogą być odtworzone ze starych odpowiedzi: zmiana wyboru obrazów zmienia listę obrazów
żądania i odtworzenie poprawnie odmawia (`STALE_DEPENDENCY`) — stąd dwa świeże odczyty.

## 8. Przyjęta rewizja (D39)

`packages/analysis-service/src/house/accepted.ts`, użycie w `describeLink` i na hoście (`wiring.ts`, magazyn
w prywatnym katalogu danych hosta `accepted-house-revisions/`, pliki nazwane hashami).
- **Wiązanie**: wariant źródła (adapter, id projektu, plan jak opublikowany), hash obrazów (bajty każdego wysłanego obrazu
  i role, jakie nadaje mu paczka) razem z faktami strony, wersja kontraktu czytania, wersje resolvera i buildera,
  ustawienia zmieniające geometrię (model czytnika, przegląd).
- **Rewizja przyjęta** = zapisane odpowiedzi czytania, którego dom został oddany (opis albo LOCAL, także podgląd częściowy
  — z tą informacją), z hashem oddanego modelu. Nigdy nie jest nadpisywana.
- **Ponowne użycie**: następne zadanie z tym samym wiązaniem odtwarza te odpowiedzi (`replayOnly`) → ten sam model,
  zero żądań; zgodność hasha oddanego modelu jest sprawdzana (`REVISION_REUSED … the same model`).
- **Inaczej** (brak rewizji, inne źródło/wariant/wersja/ustawienie, albo `reanalyse: true` w żądaniu — tylko z tokenem)
  → **osobny kandydat**, z nazwanymi polami wiązania, które się różnią; wcześniejsza rewizja zostaje.
- **Dostęp**: magazyn jest czytany i pisany tylko przy zgłoszeniu z tokenem pilota (to samo uprawnienie co płatny
  odczyt); bez tokena — ścieżka rysunków, bez magazynu.

Dowody: cztery niezależne procesy na Marcówkach (`accepted-reuse.ts`; transport zadania A **odtwarza** zapisane
odpowiedzi odczytu 1 zamiast dostawcy — oznaczone): A `ACCEPTED_NOW`; B (transport odmawia każdego wywołania)
`REUSED`, 0 wywołań, ten sam model; C (przegląd wyłączony) osobny klucz, `differs: settings`; D (`reanalyse`)
`NEW_CANDIDATE / REANALYSIS_ASKED`, obie wcześniejsze rewizje nietknięte (wyniki na kodzie końcowym:
`research/source-to-model/v3546/results/accepted-reuse-jobs.jsonl`). Host (`f9cb3ef`, publiczne
`POST /v1/analyses`): zadanie 1 na żywo → `REVISION_ACCEPTED_NOW`; zadanie 2 → `REVISION_REUSED`, 0 USD, 0 żądań,
`modelHash 07b91e89…` i scena `3fab3a08…` identyczne. Testy: klucz niezależny od kolejności obrazów, każde pole wiązania
zmienia klucz i jest nazwane, rewizja nie jest zastępowana, nazwy plików bez adresów, odporność na `../`.
Granica: magazyn jest per host (nie per konto — host nie ma kont); prywatność jak dla odpowiedzi czytnika.

## 9. Testy i kontrole

- typecheck całego repo: czysto;
- `packages/analysis-service`, `packages/reconstruction`, `apps/analyzer-api` na drzewie końcowym: **182 pliki,
  2109 testów; 2107 zielonych w pełnym biegu, 2 testy `worker.test.ts` przekroczyły czas pod obciążeniem** (równolegle
  szły cztery zadania D39 z LOCAL) — ten sam plik uruchomiony sam: 3/3 zielone (to samo zachowanie co w v3.54.5);
- nowe: `packages/analysis-service/test/house-v3546.test.ts` — 32 testy (wszystkie zielone) przyczyn i kontrprzykładów: echo strony na rzucie,
  niepewny teren, prawdziwy konflikt wysokości, rejestracja na końcach zewnętrznych i jej trzy kontrprzykłady (zła skala,
  brak skali zbioru, elewacja rejestrująca się sama), szczyt w granicy i poza nią, naświetle i jego kontrprzykład,
  wybór obrazów (kopie, ranking, pod limitem bez zmian, paczka bez elewacji/same wnętrza), `NO_SOURCE` z zakresem
  i `NOT_SENT`, statusy przeglądu, wybór (poprawny LOCAL kontra zły opis, zły LOCAL, LOCAL bez pomiaru, elewacja
  niezarejestrowana), D39;
- **snapshot kontraktu Android** (`apps/android/app/src/test/resources/analyzer-contract-current`): test porównujący
  go z odpowiedziami API failował już na `54d31f6`; snapshot nie był odświeżony od solvera 2.44.0 (v3.54.3).
  Odświeżony narzędziem repo (`capture-android-contract.ts`): zmienia się tylko `candidateHash` i `solver: 2.45.0`;
  bajty sceny i modelu identyczne. Testy Kotlin nie odwołują się do tego hasha.
- Wersje podniesione: `HOUSE_RESOLVER_VERSION 0.3.0`, `HOUSE_BUILDER_VERSION 0.2.0`.

Zapisane API (odtworzenia, bez sieci) vs na żywo: wszystkie liczby rozdz. 3–5 i 7 są z odtworzeń; na żywo w tej
kampanii: trzy odczyty Marcówek, Mirabelka, Tracja, zadanie 1 hosta. Pilot domyślnie wyłączony; ścieżka bez tokena
sprawdzona na hoście (0 USD).

## 10. Granice

- **Odczyt nie jest powtarzalny** (Marcówki: 4 odczyty, 4 różne wyniki). D39 zamraża przyjęty, nie poprawia
  pojedynczego odczytu.
- **Kolumny ściany z okapem/ramą** na elewacji z jedną bryłą (Alaska) — niewykrywalne geometrią, którą mamy; poprawka
  musi przyjść z czytnika (osobne pytanie o lica ścian) albo z drugiego niezależnego źródła skali.
- **Uskok obwiedni węższy niż dwie grubości ściany** (wnęki portalu Marcówek 0,65 m) — builder nie umie filara/zwrotu;
  jądro odrzuca ścianę i jej otwory idą z nią. Próba obejścia wycofana (nie działała na realnym przypadku).
- **Podział brył w rzucie rysowany na oko** (Pliszka: garaż 6,39 zamiast 5,00 m) — nazwany przez
  `ELEVATION_INNER_ENDS_OFF`, nie poprawiany z elewacji.
- **Pochyła głowica dwuspadowa** — jądro nie ma; przeszklenie szczytu jest prostokątem pod najniższym punktem szczytu.
- **Rozszerzony wybór obrazów** działa tylko, gdy limit wybiera; pod limitem kolejność celowo bez zmian.
- **Metryka bez wydrukowanego wymiaru** (Kardamon) — oddawana tylko jako podgląd częściowy.

## 11. Pakiet prywatny

`/home/user/BuildPlan-V3546-Private.zip` (poza Git): tablice ŹRÓDŁO | PRZED oddany | PRZED opis | PO oddany
(Pliszka, Alaska, Mirabelka, Kardamon) i Marcówki (LOCAL + trzy odczyty, wspólna kamera i skala), odczytane źródła,
ślady, odpowiedzi, hashe, koszty, porównania (`compare*.json`), wyniki oceniacza, dziennik hosta, rekordy D39.
`MANIFEST.txt` z sha256 każdego pliku; rozpakowanie i manifest sprawdzone.
Odczyty Marcówek nazwane „Marcówki — odczyt 1/2/3".
