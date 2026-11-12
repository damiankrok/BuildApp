# SOURCE-TO-MODEL v3.53.5 — wspólny dach obok osobnego dachu (raport etapu)

Zlecenie OWNER-a v3.53.5 (2026-11-12). Gałąź `claude/new-session-3kzcgh`, bez merge i PR, commity `[skip ci]`.
Baza porównania: APK 1331 z `3ea0b18` (solver 2.36.0), raport `SOURCE_TO_MODEL_V3534.md` na `76ad387`.
**Kod etapu: `6ee8dee` (solver 2.37.0, czytnik okapu 1.2.0). APK 1332 zbudowany z `6ee8dee`.**
Żadnego płatnego wywołania; księga bez zmian (2,72807938 USD z 5 USD, 92 wpisy). Bez H2 / prywatnego benchmarku,
bez zmian w ForgeShape, bez obrazów wydawców w repozytorium (plansze dowodowe są prywatne, poza Gitem).

| | stan |
|---|---|
| **Baza 1331 na zapisanych źródłach** | **ODTWORZONA** — Macierzanki 4 G2 na kodzie `76ad387` (osobny checkout), w powtórce na zapieczętowanej ekstrakcji, dają model `71d567be6766` — ten sam co w próbie 1331; skróty pakietu 30/30 zgodne (§1) |
| **Diagnoza z §12 raportu 1331** | **POTWIERDZONA CZĘŚCIOWO** — `NOT_AROUND_THE_BODIES` jest stanem końcowym na tym arkuszu, ale nie pierwszą złą decyzją: przed nim czytnik trzykrotnie źle odczytał samą linię okapu (§3) |
| **Poprawka** | **PASS w zakresie** — ogólna, bez wyjątków po nazwie/adresie/arkuszu; test przyczyny zawodzi na kodzie 1331 w 10 z 16 przypadków, na nowym przechodzi 16/16; kontrpróby: osobny dach płaski, obrys niepewny, fałszywa linia przerywana, styk z otwartym podcieniem (§5) |
| **DEV Macierzanki 4 G2 po kompilacji** | **zgodne ze źródłem w zasięgu, typie i liczbie dachów, kalenicach i połączeniach** — jeden dach kopertowy w kształcie L nad bryłą główną i skrzydłem (kosz), osobny dach płaski nad blokiem garażu; otwory zewnętrzne 16 → 16, żaden nie ubył; podwójny mur przez dwie sypialnie zniknął (§6) |
| **Ściany na granicy dachu** | **NAPRAWIONE U PRZYCZYNY** w dwóch miejscach wspólnej ścieżki: brak domyślnej podwójnej ściany między bryłami pod jednym dachem; niewyrysowany odcinek ścianki szerszy niż drzwi nie jest „drzwiami z nadprożem" (Przebiśniegi 27 — salon, Bakopy 5 — pokój 10) (§4, §7) |
| **Regresja: korpus 33** | **33/33 identyczne** co do skrótu modelu (§8) |
| **Regresja: przypadki 1331 (9 + 10 + 8)** | 23 identyczne; 4 zmienione zgodnie ze źródłem: Macierzanki (DEV), Przebiśniegi 27, Bakopy 5 (przejście zamiast „drzwi"), Lipienniki 18 E (odmowa → model zgodny ze źródłem); 0 nowych błędów kompilacji (§8) |
| **Świeża próba (zamrożona przed oceną): 20 domów z 20 nowych rodzin** | 19 identycznych, **1 poprawa** (Bengali G2E: odzyskany wspólny dach nad skrzydłem — przez poprawkę czytnika, nie przez regułę częściowego obrysu), 0 pogorszeń, 7 odmów (bez zmian). Reguła częściowego obrysu uruchomiła się na 1 świeżym domu (Karmazyny 2 G2) i przypisała bryły do dachów zgodnie ze źródłem, **ale scena pozostała identyczna i błędna w kształcie dachu** (§9) |
| **Inny wydawca** | 12 zapieczętowanych pakietów 5 wydawców: 12/12 identyczne; czytnik okapu nie znalazł linii na żadnym z 6 rzutów parterowych — reguła nie uruchomiona, wynik to wyłącznie stabilność (§9.4) |
| **Zakres potwierdzenia** | odzyskanie wspólnego dachu **obok osobnego dachu** w scenie jest udokumentowane **tylko w DEV (Macierzanki) i tylko na arkuszach jednego wydawcy**; czego brakuje do szerszego wniosku — §11 |
| **APK 1332** | podpis, wersja, manifest 12/12 **PASS**; HOST — §10 |
| **Android UI** | **NOT_VERIFIED** — brak emulatora (brak `/dev/kvm`) i urządzenia w tym środowisku |
| **CAMPAIGN** | WORK_IN_PROGRESS — największy pozostały problem nazwany w §11 |

## 1. Stan wyjściowy i odtworzenie 1331

HEAD przed etapem `76ad387`. Kod 1331 trzymany w osobnym checkoucie (`76ad387`), nowy kod w drzewie roboczym — obie
rewizje liczą na tych samych bajtach (te same `source-package.json`, `observation-graph.json`, `metric-evidence.json`
i bajty wydawcy z pamięci podręcznej; skróty zapieczętowanego pakietu próby 1331 sprawdzone: 30/30).

Macierzanki 4 G2 na kodzie 1331: model `71d567be6766` (równy wynikowi próby 1331). Scena: dach kopertowy nad bryłą
główną 15,65 × 9,20 m i **cztery płyty**: nad skrzydłem z pokojami 7 i 8 (8,65 × 3,48 m) oraz trzy nad blokiem garażu
(5,97 × 3,43, 6,30 × 1,39, 1,59 × 4,57 m). Stan czytnika okapu w układzie: `NOT_AROUND_THE_BODIES`.

## 2. Co mówią źródła (sprawdzone na arkuszach przed zmianą)

Arkusz sytuacji (rzut dachu wydawcy), cztery elewacje, przekrój i rzut parteru Macierzanek 4 G2:

- **jeden dach kopertowy w kształcie L** nad bryłą główną (15,7 × 9,2 m) i skrzydłem z tyłu po lewej (pokoje 7 i 8;
  8,7 × 3,48 m), połączone koszem; kalenica główna wzdłuż długości bryły, kalenica skrzydła w poprzek;
- **osobny dach płaski** nad blokiem garażu z przodu po lewej (8,7 × 4,82 m, z wnęką wejścia) — niższy niż okap dachu
  kopertowego (elewacje boczne); pokój garażu sięga 1,8 m pod dach kopertowy, a jego przednie 4,82 m stoi poza nim;
- pergola nad tarasem w narożniku między skrzydłem a bryłą główną (nie jest dachem domu);
- wymiary rzutu: 348 / 920 / 482 = 1750 i 870 + 700 = 1570;
- na linii między bryłą główną a skrzydłem rzut **nie rysuje ściany**: pokoje 7 i 8 biegną przez nią.

Linia okapu wspólnego dachu jest na rzucie narysowana linią przerywaną dookoła bryły głównej i skrzydła. Ponieważ okap
wisi nad niższym blokiem garażu, **frontowy odcinek tej linii biegnie przerywaną przez pomieszczenia garażu**.

## 3. Pierwsza zła decyzja (od obserwacji na arkuszu do sceny)

Hipoteza z §12 raportu 1331: „czytnik wymaga okapu wokół wszystkich obmurowanych brył, więc osobna bryła unieważnia
poprawny obrys nad resztą". Pomiar pokazał, że to czwarta decyzja z kolei, nie pierwsza — obrys nad resztą nie był
jeszcze poprawny. Kolejno, każda zmierzona na pikselach arkusza:

1. **Tylny okap nad tarasem wyrzucony jako „kreskowanie".** Linia ma 7,6 m (263 px, 51 kresek w jednym wierszu).
   Test grubości liczył, w ilu sąsiednich wierszach powtarza się „ten sam" ciąg, a nakładanie mierzył względem
   krótszego z dwóch ciągów — osiem wierszy z 51-pikselowym kawałkiem drobnego rysunku obok linii wystarczyło, żeby
   uznać ją za kreskowanie i odrzucić. Bez tej strony obrys nie mógł się zamknąć.
2. **Krokiew pergoli wzięta za okap.** Krokwie są rysowane przerywaną, w równych odstępach (0,6 m), wszystkie tej samej
   długości. Najbliższa stoi 0,46 m od ściany skrzydła, prawdziwy okap 0,81 m — reguła „z dwóch równoległych bliższa
   jest okapem" wybrała krokiew.
3. **Okap narysowany przez blok garażu odrzucony jako „wewnątrz bryły".** Dwa z trzech odcinków frontowej linii okapu
   leżą w pomieszczeniach garażu; czytnik przyjmował tylko linie poza wszystkimi bryłami.
4. **Bryła poza obrysem unieważniała cały odczyt** (`NOT_AROUND_THE_BODIES`) — także wtedy, gdy stoi cała obok dachu.
5. (po usunięciu 1–4) **Lico filarka wzięte za lico domu.** Ściany tną rzut także na drobne „bryły" (filar 0,3 × 0,3 m
   w narożniku tarasu); stopa dachu była dociągana do najbliższego lica dowolnej bryły, więc tylna ściana bryły głównej
   przesunęła się o 0,32 m (9,52 zamiast 9,20 m ze źródła).
6. (po 5) **Filarek stojący w pasie okapu blokował podział** („obmurowana komórka poza prostokątami dachu").

W scenie skutkiem było to, co w §1: skrzydło jako przybudówka pod płytą. Osobno od dachu, na tej samej linii:

7. **Podwójny mur między bryłą główną a skrzydłem.** Rzut rysuje ścianę na 51 z 265 pozycji tej linii (krótka
   ścianka działowa obok). Dla każdej pary stykających się brył, przy „za mało, żeby rozstrzygnąć", budowane były dwie
   pełne ściany zewnętrzne (2 × 0,46 m) — tu w poprzek sypialni 7 i 8. Tak samo było na 1331.

### Hipotezy sprawdzone i odrzucone w tym etapie

- „Wystarczy pozwolić na bryły poza obrysem" — nie: bez (1)–(3) obrys się nie zamyka wcale (stan `NOT_CLOSED`).
- „Po zamknięciu obrysu stopa dachu jest dobra" — nie: (5) dawał 0,32 m błędu głębokości bryły głównej.
- (Karmazyny 2 G2, świeża próba) „dać skrzydłu spod okapu pierwszeństwo przed odczytem `UNDER_MAIN` z elewacji" —
  sprawdzone w osobnym checkoucie i **odrzucone**: okap bryły głównej spada do 1,41 m i pięć otworów nie kompiluje się;
  pierwszą złą decyzją jest tam oś kalenicy bryły głównej (§9.3).

## 4. Zmiana (`6ee8dee`)

Reguły działają na obserwacjach i relacjach geometrii; żadna nie zna nazwy, adresu, wydawcy, skrótu ani współrzędnych
arkusza. Progi wynikają z rodzaju obserwacji (podane przy każdym).

**Czytnik okapu `eave-outline.ts` 1.1.0 → 1.2.0**

- *Grubość linii*: kreskowanie powtarza ciąg w sąsiednich wierszach na większości **jego własnej** długości (było:
  krótszego z dwóch). Bez nowego progu.
- *Rodzina równych linii* (`slats`): co najmniej 3 równoległe linie przerywane o tych samych końcach (±0,3 m),
  w równych odstępach (±25 % mediany) nie większych niż 1,5 m — krokwie, deski, stopnie — żadna z nich nie jest okapem.
  Okap to jedna linia (dwie z rynną); 1,5 m to więcej niż rozstaw krokwi czy desek, mniej niż rozpiętość płatwi.
- *Okap narysowany przez bryłę*: odcinek leżący w innej bryle jest okapem **tylko jako przedłużenie linii odczytanej
  na wolnym odcinku wzdłuż lica** (ta sama linia ±2 px; wolny odcinek co najmniej 1 m). Sama przerywana w pokoju
  (belka, szafki, pustka) nadal nie jest okapem — osobna kontrpróba.
- *Stopa dachu* dociągana jest do lica bryły, która biegnie **wzdłuż** danego boku co najmniej 1 m (ta sama miara,
  którą linia jest czytana względem lica).
- *Obrys może opisywać część domu.* Obrys obejmuje największą bryłę; każda inna bryła leży albo pod nim, albo **cała
  poza stopą dachu** (żaden z 25 punktów jej siatki pod dachem — najwyżej styk). Taka bryła trafia do `beyond`,
  z informacją, czy okap jest narysowany przez nią (`eavesDrawnThrough`). Bryła, przez którą przechodzi krawędź
  obrysu, nie jest ani pod dachem, ani obok — wtedy czytnik odmawia jak dotąd (`NOT_AROUND_THE_BODIES`).
  Samo położenie poza obrysem **nie rozstrzyga** dachu tej bryły.

**Podział na bryły `layout.ts` (`bodiesUnderTheEaves`)** — bryły z `beyond` zostają dokładnie tak, jak wycięły je
ściany, i nie biorą udziału w podziale brył pod dachem. `RoofExtent.beyond` zapisuje je także wtedy, gdy podział się
nie zmienia (jedna bryła pod dachem i blok obok).

**Dach bryły obok (`reconstruct-v2.ts`)** — o jej dachu decydują dotychczasowe czytniki (elewacje, przekrój), a gdy
nic nie czytają — dotychczasowa konwencja, oznaczona jak dotąd. Obserwacja z rzutu jest dopisywana do uzasadnienia:
okap narysowany przez bryłę znaczy, że jej dach leży poniżej tego okapu (dach niski — zgodne z płaskim); bryła poza
obrysem bez tej linii — „nic nie mówi o jej dachu".

**Granica dachu a ściana (`party-wall.ts`, `reconstruct-v2.ts`, `emit.ts`)**

- Między dwiema bryłami, które linia okapu stawia pod jednym dachem, „za mało ściany, żeby rozstrzygnąć" znaczy **brak
  ściany** (zapis `OPEN`, z uzasadnieniem), a nie dwie pełne ściany. Pas ściany, który rzut rysuje (≥ 40 % pozycji,
  spójny), jest czytany i budowany jak dotąd — kontrpróba.
- Odcinek ścianki między bryłami, którego rzut nie rysuje, **szerszy niż dwa skrzydła drzwi** (`2 × DOOR_MAX_WIDTH_M`
  = 2,6 m) i bez narysowanego skrzydła, nie jest przejściem pod nadprożem 2,1 m, tylko brakiem ściany: otwór bez
  wypełnienia do poziomu okapu (wysokość jak ujście wnęki; oznaczona jako przyjęta — rzut nie mówi, czy wisi tam belka).

Solver 2.36.0 → 2.37.0.

## 5. Testy przyczyny i kontrpróby

`packages/reconstruction/test/common-roof-beside-v3535.test.ts` — 16 testów na rzutach rysowanych w kodzie
(5 cm/px; wymiary wymyślone). Dom: bryła główna 20 × 10 m, skrzydło 10 × 4 m pod tym samym dachem, blok 12 × 5 m
z własnym dachem, okap rysowany przez blok, pergola, drobny rysunek przy linii.

| | kod 1331 (`76ad387`) | kod etapu |
|---|---|---|
| przyczyna: obrys L odczytany, blok poza nim z okapem narysowanym przez niego (czytnik) | **FAIL** | PASS |
| pierwsza zła decyzja 1 — drobny rysunek obok długiej linii nie robi z niej kreskowania | **FAIL** | PASS |
| pierwsza zła decyzja 2 — krokwie pergoli nie są okapem, choćby bliżej ściany | **FAIL** | PASS |
| pierwsza zła decyzja 3 — okap narysowany przez bryłę obok jest okapem, a bryła stoi obok dachu | **FAIL** | PASS |
| przyczyna w układzie: bryła główna i skrzydło cięte po okapie, blok obok zachowuje podział ścian | **FAIL** | PASS |
| kontrpróba — osobny dach zostaje osobny (prostokąt pod okapem + blok; nic nie scalone, zapis `beyond`) | **FAIL** (brak zapisu) | PASS |
| kontrpróba — obrys niepewny: okap ukryty nad blokiem i nienarysowany → `NOT_CLOSED`, nic o dachu | PASS | PASS |
| kontrpróba — obrys niepewny: brak jednej strony okapu | PASS | PASS |
| kontrpróba — obrys niepewny w układzie: podział ścian stoi, brak zapisu o dachu | PASS | PASS |
| kontrpróba — fałszywa linia przerywana: sama pergola, bez okapu → żadna linia nie jest okapem | **FAIL** | PASS |
| kontrpróba — przerywana w pokoju, na żadnej linii okapu widzianej na zewnątrz, nie jest okapem | PASS | PASS |
| kontrpróba — bryła, przez którą biegnie krawędź obrysu: odmowa | **FAIL** (inny powód odmowy) | PASS |
| kontrpróba — obrys, który zostawia największą bryłę na zewnątrz: odmowa | PASS | PASS |
| filarek w pasie okapu nie jest licem domu | **FAIL** | PASS |
| styk z otwartym podcieniem: skrzydło zachowuje otwarty koniec i słup, obok stoi bryła innego dachu | **FAIL** | PASS |
| powtarzalność (ten sam rzut → te same bryły) | PASS | PASS |

Razem na kodzie 1331: **10 FAIL / 6 PASS**; na kodzie etapu **16/16 PASS**.

Dodatkowo, przy istniejących testach ścian między bryłami: `open-contact-n8-03a.test.ts` (+4: przyczyna — dwie ściany
przy „za mało"; pod jednym dachem → `OPEN`; narysowana ściana zostaje; bryły nie pod jednym dachem — bez zmiany)
i `party-wall-n8-02b.test.ts` (+2: jako „drzwi" odcinek miał 2,1 m i skrzydło; jako przejście — otwór bez wypełnienia,
model się waliduje). Jedno oczekiwanie w `roof-extent-v3534.test.ts` zmienione świadomie: garaż obok domu nadal
zachowuje podział ścian, ale zapis mówi teraz, że okap domu jest narysowany przez garaż (było: brak zapisu).

**Po kompilacji** (obok testów obliczeń) — sceny z zapieczętowanych źródeł, §6–§9: osobny prawdziwy dach płaski
(Macierzanki — blok garażu; Mennice 2, Wasabi, Karmazyny 2 — świeże), obrys niepewny (Chelone, Dzwonki 3, Nigelle 4,
Azolle 7 — `NOT_CLOSED`, sceny bez zmian), styk z otwartym podcieniem (Przebiśniegi 27 — podcień na słupie bez zmian;
Bengali — narożnik wejścia otwarty pod dachem na słupie).

## 6. DEV: Macierzanki 4 G2 — PRZED i PO na tych samych bajtach (po kompilacji)

Plansze (prywatne): `macierzanki4g2-evidence-eaves-line.png` (rzut z zaznaczonym dowodem: odczytane linie okapu,
odcinek narysowany przez bryłę, stopa dachu, bryły pod dachem i poza nim, trzy miejsca pierwszych złych decyzji),
`macierzanki4g2-source-before-after.jpg` (arkusz sytuacji, cztery elewacje i przekrój wydawcy nad widokami modelu
PRZED i PO: front, wschód, tył, zachód, z góry i cztery naroża), `macierzanki4g2-plan-main-wing-line.png`.
Arkusz sytuacji **nie był użyty do dopasowania** (dowodem jest linia okapu na rzucie parteru) — służy do oceny.

| | PRZED (`71d567be6766`, 1331) | PO (`3b8ce6653524`) | źródło |
|---|---|---|---|
| zasięg dachu kopertowego | bryła główna 15,65 × 9,20 | bryła główna 15,65 × 9,20 **i skrzydło 8,65 × 3,48** | bryła główna i skrzydło |
| liczba i typ dachów | 1 kopertowy + **4 płaskie** | 1 kopertowy w L + 3 płaskie nad blokiem garażu | 1 kopertowy w L + 1 płaski nad blokiem garażu |
| kalenice | główna wzdłuż x | główna wzdłuż x, skrzydła wzdłuż z (w poprzek) | jak PO |
| połączenia | — (płyta dochodzi do okapu) | kosz między połaciami skrzydła i bryły głównej; 8 połaci | kosz |
| blok garażu | 3 płyty | 3 płyty, bez zmian; zapis: okap dachu głównego narysowany przez blok | 1 dach płaski |
| otwory zewnętrzne | 16 | 16 — te same | — |
| przegrody | podwójny mur 2 × 0,46 m przez pokoje 7 i 8 | brak ściany na tej linii; ścianka między 7 i 8 zostaje | brak ściany na tej linii |
| pomieszczenia | 11 | 9 | — |
| błędy kompilacji | 0 | 0 | — |

Czego PO nie naprawia (uczciwie): blok garażu jest nadal trzema płytami na jednej wysokości zamiast jednej (podział
ścian z 1331, bez zmian); „drzwi" 5,17 × 2,10 m w ścianie między przednią częścią garażu a jego częścią pod dachem
głównym (bez zmian z 1331 — inna ścieżka niż naprawiona w §4); dwa fragmenty sypialni 7 i 8, które 1331 zapisywał
jako osobne pomieszczenia (ucięte na fałszywym murze, 9,2 i 10,1 m² zamiast 14,1 i 15,7 m²), są teraz częścią
dużego niedomkniętego pomieszczenia bryły głównej — ściany są zgodne z rzutem, domknięcie pomieszczeń nie (pozycja
backlogu „scalone małe pomieszczenia").

## 7. Ściany i otwory poparte źródłem — sprawdzenia zlecone

- **Ścianka w salonie Przebiśniegów 27 E.** Rzut rysuje cienką ściankę (0,125 m) tylko na 2,7 m z 6,55 m linii między
  bryłą główną a skrzydłem (między pokojem nad nią a pokojem 8); przez pokój 7 ściany nie ma. 1331 budował ściankę na
  całej linii z „drzwiami" 3,68 × 2,10 m, czyli ze ścianą wiszącą nad pokojem 7. Teraz: ścianka stoi tam, gdzie jest
  narysowana, a 3,68 m to otwór bez wypełnienia do 3,43 m (poziom okapu, jak ujścia podcieni tego domu). Model
  `3579d45da273` → `456d3628585f`; poza tym otworem geometria bez zmian; 0 błędów kompilacji.
- **Wejście w Lipiennikach 6.** Model `1dc748b8e195` — identyczny z 1331 (wnęka wejścia i drzwi bez zmian).
- **Bakopy 5 E** — ta sama ścieżka co w Przebiśniegach: 2,91 m linii, przez którą biegnie pokój 10 (rzut bez ściany),
  było „drzwiami" 2,10 m; teraz otwór do 2,75 m. `3ca47126caf0` → `abdb3c48ab90`; reszta bez zmian.

Błąd wspólnej ścieżki emisji był jeden w dwóch postaciach (§3 pkt 7 i „drzwi" szersze niż drzwi) — naprawiony u
przyczyny, z testami (§5).

## 8. Regresja (rewizja `6ee8dee`, te same zapieczętowane wejścia co baza 1331)

Porównanie skrótu modelu i — osobno — skrótu geometrii programu (polecenia bez tekstów uzasadnień).

| zbiór | identyczne | zmienione | odmowy |
|---|---|---|---|
| korpus 33 | **33** (29 modeli + 4 odmowy) | 0 | 4 (bez zmian) |
| próba niezależna 1330/1331 (9) | 7 | 2: Przebiśniegi 27, Bakopy 5 (§7) | 0 |
| świeża próba 1331 (10) | 9 | 1: Macierzanki 4 G2 (DEV, §6) | 4 (bez zmian) |
| rozszerzenie 1331 (8) | 7 | 1: **Lipienniki 18 E — odmowa → model** | 0 nowych |

Lipienniki 18 E: na 1331 `RECONSTRUCTION_FAILED` (układ rzutu odrzucony: ściany cięły dom na 4 bryły). Teraz linia
okapu zamyka się wokół całości (poprawka grubości linii), rzut jest cięty na jedną bryłę 15 × 10 m pod jednym dachem
dwuspadowym, kalenica wzdłuż 15 m — tak jak pokazują arkusz sytuacji, elewacje i przekrój; 0 błędów kompilacji
(`f517b339ff71`). Rodzina Lipienników była w DEV etapu 1331, więc to nie jest potwierdzenie niezależne.

Różnice w geometrii po kompilacji, zbadane dla każdego zmienionego domu: żadnej utraconej cechy, żadnej dodatkowej
ściany, żadnego nieuzasadnionego dachu, 0 nowych błędów kompilacji. Otwory: Macierzanki 23 → 23, Przebiśniegi 24 → 24
(jeden zmienił rodzaj: drzwi → przejście), Bakopy 5 26 → 26 (jw.).

## 9. Świeża próba (lista, kryteria i oczekiwania zamrożone przed oceną)

Zapis w `FRESH_TRIAL_FROZEN_V3535.md` (prywatnie): reguła wyboru, kryteria K1–K6 (jak w 1331), oczekiwania dla
każdego domu spisane z arkuszy wydawcy **przed** otwarciem jakiegokolwiek wyniku analizatora, pierwsze wyniki zachowane.
Obie rewizje (`76ad387` i `6ee8dee`) na tych samych zapieczętowanych bajtach (`fresh-trial-sealed.sha256`, 60 plików).

### 9.1 Wybór

Lista domów parterowych wydawcy, strony 2–12; tylko rodziny nieużyte nigdzie wcześniej (65 rodzin).
- Pierwsze 12 domów — wybrane **po relacji dachów widocznej na zdjęciu z listy**: 8 „dach spadzisty + płaski blok obok",
  4 „inna relacja". Po acquisition okazało się, że zdjęcie z listy myli: 4 z 8 to jeden złożony dach spadzisty bez
  żadnego dachu płaskiego. Wszystkie 12 zostają w próbie i są raportowane.
- Rozszerzenie o 8 domów — wybrane **po rzucie dachu wydawcy** (sam arkusz sytuacji, bez wyniku analizatora): dach
  spadzisty z więcej niż jednej części albo z płaską częścią obok.

### 9.2 Wyniki (scena po kompilacji)

13 modeli i 7 odmów — tak samo na obu rewizjach. **19 identycznych, 1 zmieniony.**

| | liczba |
|---|---|
| uruchomienia reguły (odczyt okapu inny niż na 1331) | **2**: Bengali G2E (czytnik), Karmazyny 2 G2 (częściowy obrys) |
| poprawy | **1** (Bengali G2E) |
| pogorszenia | 0 |
| odmowy | 7 (bez zmian) |
| identyczne | 19 |

**Bengali G2E (nowa rodzina) — rzeczywiste odzyskanie wspólnego dachu.** 1331: okap `NOT_CLOSED`, skrzydło dzienne pod
płytą (5,0 × 6,4 m, ucięte w poprzek salonu) i druga płyta z przodu (6,5 × 3,0 m). Teraz: okap się zamyka, bryła
główna 10,1 × 15,75 m i skrzydło 5,0 × 10,1 m pod jednym dachem kopertowym połączonym koszami, narożnik wejścia
otwarty pod dachem na słupie; żadnej płyty; kompilacja czysta. Zgodne z oczekiwaniem zamrożonym („cały dom pod jednym
złożonym dachem kopertowym, nic pod płytą") w K1–K4 i K6. Przyczyna wyizolowana: kod 1331 **z samą poprawką testu
grubości** daje dokładnie ten model (ten sam skrót). K5: drzwi boczne garażu są teraz drzwiami (były oknem); fałszywa
ściana przez salon z „oknem" 4,18 m zniknęła; prawdziwe przeszklenie tarasowe (rzut: 360/230) jest teraz obecne, 3,58 m
szerokie, ale **0,58 m wysokie od 1,49 m** (wysokość z elewacji, odwołanie nieodczytane) — zła wysokość na nowym
otworze, zapisana jako taka (backlog: odczyt wysokości). Szczyt zamiast kopertowego końca dachu głównego z tyłu — na
obu rewizjach, bez zmian. Plansze: `bengali-g2e-evidence-eaves-line.png`, `bengali-g2e-source-before-after.jpg`.

**Karmazyny 2 G2 (nowa rodzina) — reguła częściowego obrysu działa na arkuszu, scena bez zmian.** Dom ma dokładnie
relację z tytułu etapu: dwa dachy dwuspadowe pod kątem prostym nad dwiema bryłami (wspólny dach) i płaski dach nad
wysuniętą o 3 m przednią częścią garażu. Czytnik zamyka okap wokół bryły sypialnej i skrzydła dziennego (2 z 8
obmurowanych regionów, największy wśród nich), blok garażu kładzie poza dachem z okapem narysowanym przez niego —
zgodnie z arkuszami. Blok zostaje płaski 6,4 × 3,0 m (jak na 1331 — **osobny dach zachowany przy aktywnej regule**).
Dach nad dwiema bryłami jest na obu rewizjach ten sam i błędny: jeden dach dwuspadowy nad prostokątem 15,3 × 15,7 m,
bo ścieżka elewacji czyta skrzydło jako `UNDER_MAIN`, a oś kalenicy bryły głównej jest dopasowana wzdłuż x. Plansze:
`karmazyny2g2-evidence-eaves-line.png`, `karmazyny2g2-source-before-after-identical.jpg`.

**Rzeczywisty osobny dach, który ma pozostać** (kontrpróba na świeżych): Mennice 2 (dwuspadowy + płaski 6,8 × 7,2),
Wasabi (kopertowy + płaski 4,4 × 2,7 nad wysuniętym blokiem), Karmazyny 2 (płaski 6,4 × 3,0 przy aktywnej regule) —
wszystkie jak na arkuszach, identyczne na obu rewizjach.

**Wspólny dach nadal utracony na obu rewizjach** (okap `NOT_CLOSED`): Chelone (skrzydło pod płytą 10 × 5,3),
Azolle 7 (skrzydło pod płytą 4,9 × 11,3), Dzwonki 3 i Nigelle 4 (pasy pod płytami). Przyczyny zmierzone na dwóch:
strona okapu zakryta inną linią rysunku (krawędź podjazdu) i narysowana 1,42 m od ściany (Chelone); strony zakryte
symbolami zieleni i krawędzią tarasu (Dzwonki 3).

### 9.3 Dom do DEV

Żaden z 20 domów nie posłużył do zmiany reguły ani progu. Eksperyment na Karmazynach (§3) został odrzucony i nie
wszedł do kodu.

### 9.4 Inny wydawca

Porównywalne arkusze innych wydawców wzięte z zapieczętowanej próby kontrolnej ANY-LINK (12 pakietów: extradom,
lipinscy, dobredomy, domoweklimaty, houseplans, architecturaldesigns). Obie rewizje na tych samych bajtach:
**12/12 identyczne** (3 modele, 9 odmów — bez zmian). Czytnik okapu uruchomił się na 6 rzutach parterowych i na
żadnym nie znalazł linii okapu (`NO_EAVES_LINE`). **Wynik dla tego formatu: reguła nie uruchomiona; to pomiar
stabilności, nie skuteczności.**

## 10. Weryfikacja i APK 1332

**Testy** — rewizja testów `6ee8dee`; `npx tsc --noEmit` czysto. Macierz dotkniętych pakietów (`packages/reconstruction`,
`packages/analysis-service`, `apps/local-analyzer`, `tests/architecture`, z `LOCAL_ANALYZER_NODE18`):
**185 plików, 2186 testów: 2173 PASS, 13 FAIL; 0 błędów nieobsłużonych.** Baza (`76ad387`): 184 pliki, 2164 testy,
2151 PASS, 13 FAIL. Przybyły 22 testy tego etapu (16 + 4 + 2), wszystkie PASS. **13 nazw błędów jest identycznych
z bazą** (porównanie list nazw `FAIL` z obu przebiegów: bez różnic): 4 × `research-isolation` (brak `numpy`/PIL
w środowisku), 2 × `reference` (zamrożone pliki demo), 1 × `compound-facade` (zamrożony zbiór liczb), 4 × `wall-strip`
(porównanie z bazą 005Q), 1 × `local-analyzer/program` (Larchfield: skrót bundla wobec potoku biurkowego),
1 × `local-analyzer/text` (NFD). Żaden nie dotyczy kodu tego etapu; żaden próg ani stopień ważności nie został zmieniony.
Strażnicy architektury (`tests/architecture`, w tym lista importów `layout.ts` i `eave-outline.ts` — tylko piksele):
bez nowych błędów.

**APK 1332**

| | |
|---|---|
| plik | `BuildPlan-Model-Preview-1332-arm64-v8a-debug.apk`, 50 666 436 B (prywatnie, poza Gitem) |
| SHA-256 | `92aaf06fafee7a6542c3433c6ef111d91d10f4b09f584d0d2c2e86c7c9f45bee` |
| podpis | ten sam certyfikat co 1324–1331: SHA-256 `6e48fac4afaa3d70e70de5bc608aa4c4194206a9e6bc993dab56382b921ca0da` — **PASS** |
| wersja | `versionCode 1332`, `versionName 0.1332.0-owner`, pakiet `com.buildplan.preview`, minSdk 26 — **PASS** |
| analizator | solver 2.37.0, czytnik okapu 1.2.0 (odczytane z `analyzer.mjs` w pliku APK) |
| manifest analizatora | protokół 3, `nodejs-mobile` 18.20.4; **12/12** plików zgodnych co do SHA-256 i rozmiaru; `analyzer.mjs` `18808a8224afb5cb…` (3 500 818 B) — **PASS** |
| rewizja | `6ee8dee` (drzewo czyste w chwili budowania) |

**HOST (bundle wyjęty z ostatecznego pliku APK, produkcyjny `main.mjs`, Node 18.20.4 z symulacją braku ICU, żywe strony
wydawcy, od `hello` do zapisanej i wczytanej sceny; trzy przebiegi równolegle):**

| dom | wynik | zdarzenia | model | zgodność z przebiegiem referencyjnym | scena (wczytana `loadBundle`) | czas | pamięć szczytowa |
|---|---|---|---|---|---|---|---|
| **Macierzanki 4 G2** (dom z uaktywnioną poprawką) | `done`, exit 0 | 586 (`hello` … `done`), 0 `error` | `3b8ce6653524` | **równy** powtórce na zapieczętowanych źródłach | `4e745ecf38d3`, 148 siatek — **wczytana** | 453 s | 1,10 GB |
| Bengali G2E (świeży, odzyskany wspólny dach) | `done`, exit 0 | 542, 0 `error` | `6f0c2232df5b` | **równy** | `6fd317353de6`, 154 siatki — **wczytana** | 429 s | 0,97 GB |
| Przebiśniegi 27 E (przejście w salonie) | `done`, exit 0 | 534, 0 `error` | `456d3628585f` | **równy** | `e6e7de16b416`, 129 siatek — **wczytana** | 405 s | 1,05 GB |

Wynik zapisany przez launcher (`result.json`) niesie solver 2.37.0. Strony wydawcy nie zmieniły się od zapieczętowania
(modele z żywych stron są równe modelom z zapieczętowanych bajtów), więc osobne porównanie „po zmianie u wydawcy" nie
było potrzebne.

**Node 18 bez ICU:** trzy przebiegi powyżej idą pod `--require no-icu.cjs` (ścisły `TextDecoder` i `normalize` jak
w nodejs-mobile bez ICU); `hello` raportuje `text: embedded-tables`. Testy `apps/local-analyzer` i `tests/architecture`
z `LOCAL_ANALYZER_NODE18` — w macierzy powyżej.

**ANDROID:** nie uruchomiono. W tym środowisku nie ma emulatora (brak `/dev/kvm`) ani urządzenia. Analiza i otwarcie
sceny w aplikacji: **NOT_VERIFIED**. Wyniki HOST nie są wynikami z telefonu.

## 11. Największy pozostały problem i czego brakuje do szerszego wniosku

**Zakres tego, co jest pokazane.** Odzyskanie wspólnego dachu obok osobnego dachu **w scenie** jest pokazane na jednym
domu — Macierzankach 4 G2, czyli w DEV. Na świeżym domu z innej rodziny pokazane jest (a) odzyskanie wspólnego dachu
bez osobnego dachu obok (Bengali — przez poprawkę czytnika) i (b) poprawne przypisanie brył do dachów przy osobnym
dachu obok, bez zmiany sceny (Karmazyny 2). Wszystko na arkuszach jednego wydawcy. To nie spełnia warunku „rzeczywiste
odzyskanie wspólnego dachu obok osobnego dachu na świeżym projekcie z innej rodziny".

**Czego brakuje:**
1. *Karmazyny 2 G2* — dwie decyzje za czytnikiem okapu: oś kalenicy bryły głównej (dopasowana wzdłuż x na bryle
   8,3 × 15,7 m, wbrew układowi) i pierwszeństwo odczytu `UNDER_MAIN` z elewacji przed skrzydłem z linii okapu.
   Dopiero po pierwszej druga daje dobry dach (sprawdzone: sama druga psuje). Po naprawie dom przechodzi do DEV.
2. *Świeży dom, na którym reguła zmienia scenę.* W katalogu parterowym wydawcy relacja „spadzisty nad bryłą i
   skrzydłem + płaski obok" jest rzadka: w 20 wybranych po obrazie dachu wystąpiła raz. Następna próba powinna brać
   domy po rzucie dachu z całej oferty (nie tylko parterowej — po etapie wielokondygnacyjnym).
3. *Inny format arkusza.* Na rzutach pięciu innych wydawców czytnik nie znajduje linii okapu wcale; potwierdzenie na
   innym formacie wymaga wydawcy, który rysuje okap na rzucie, albo innego dowodu zasięgu dachu (rzut dachu).

**Największy pozostały problem (zmierzony w świeżej próbie): obrys okapu, który się nie zamyka.** Na 4 z 13 świeżych
modeli wspólny dach jest utracony, bo jedna strona okapu jest zakryta inną linią lub symbolem (krawędź podjazdu,
taras, zieleń) albo narysowana dalej niż 1,2 m od ściany. Reguły łączenia (most 2 m, naroże 3 m) tego nie spinają
i — zgodnie z kontrpróbą „obrys niepewny" — nie powinny zgadywać. Potrzebny jest dowód strony zakrytej (tusz na
prostej między dwoma współliniowymi końcami) albo drugi dowód zasięgu dachu.

**Pozostałe, bez zmian w tym etapie (osobne punkty backlogu):** wysokości otworów z elewacji i nieodczytane odwołania
(Bengali: przeszklenie 0,58 m; Przebiśniegi z 1331), okap budowany 0,60 m zamiast ≈ 0,9 m, blok garażu Macierzanek
jako trzy płyty, „drzwi" 5,17 m w ścianie między częściami garażu (ścieżka bez pasa wspólnej ściany), szczyt zamiast
kopertowego końca (Bengali), scalone małe pomieszczenia, 7 odmów układu rzutu w świeżej próbie.

**Telimy 4 G2E OZE** (baza następnego etapu wielokondygnacyjnego): model `39922e264d67` — identyczny na obu rewizjach
(te same zapieczętowane bajty). Czytnik okapu działa tylko na rzutach jednokondygnacyjnych, a reguły ścian z §4
dotyczą brył pod jednym odczytanym dachem i pasa wspólnej ściany — zmierzony wpływ tego etapu na Telimy: żaden.

## 12. Dostawa

- kod i testy: `6ee8dee`; raport i status: commit niosący ten plik;
- prywatnie, poza Gitem: APK 1332, plansze dowodowe i zapis świeżej próby (lista w §6, §9), log testu przyczyny na
  kodzie 1331 (`cause-test-on-1331.log`).
