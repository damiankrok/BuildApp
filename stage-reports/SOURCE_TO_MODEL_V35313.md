# BuildPlan v3.53.13 — wiązanie wymiarów i rozstrzyganie skali

Baza: APK 1338 z `9d8fbca` (kod `2b67a26`, topologia wymiarów 1.5.0, solver 2.42.0, usługa 1.11.0). Wynik: topologia
**1.6.0**, solver metryczny **1.8.0**, resolver planu **1.6.0**, solver **2.43.0**, kod `5240d7e` (testy i kontrakt `459cc2d`), APK **1339** (§11). Bez
płatnych wywołań (księga 2,72807938 USD, 92 wpisy — bez zmian), bez H2 i prywatnego benchmarku, ForgeShape tylko do
odczytu; eksperyment API B/C osobno, czeka na sekret i rozliczenie. Źródła, plansze i paczka — prywatnie, poza Gitem.
Domy diagnozy **DEV** (poza oceną niezależną): Supertunie 2 E, Stellarie G2E, Wrotycze E, Torenie 3. Interfejs Android:
**NOT_VERIFIED**.

Protokół zapisano prywatnie przed zmianą kodu (`sha256 2ef7ace3…`, 11:17 UTC); regułę świeżej próby przed pobraniem listy
(`sha256 6ba29862…`).

**Werdykt: przyjęte do APK 1339, z ograniczeniami nazwanymi niżej.** Trzy zmiany (V-SEL, V-JOIN, V-TOR) mają test
przyczyny czerwony na 1338 i zielony po zmianie, kontrpróby zielone na obu wersjach. Regresja na tych samych bajtach
(162 domy): topologia bez zmian, 134/161 dowodów bajt w bajt, w produkcji 22/27 zmienionych identycznych, **0 nowych
odmów, 0 nowych błędów**. Jedna odmowa znika (Nolany 2, sprawdzone ze źródłami), Torenie dostaje model przy skali
zmierzonej, cztery skale rzutów przechodzą na zgodne z drukiem. Korpus 80: 66 → **67 modeli**, 14 → **13 odmów**; tabela
pomieszczeń 96 → **99/169**. Supertunie: **skala zostaje nierozstrzygnięta z nazwanym sporem** (odmowa nie znika — za
słaby świadek). V-MARK (kreska w miejscu przecięcia) **odrzucony** — przesuwał 6 879 kresek w 161 domach. Świeża próba:
przeniesienie na Calandivach (kotwica 4,5 % → 0,0 % wobec druku), scena bez zmian w 12/12. Interfejs Android:
NOT_VERIFIED.

---

## 0. Korekty raportu v3.53.12 (ustalone na dowodach 1338)

* **Supertunie: „690 przypisane do połowy linii” — nieprawda.** Obserwacje `640` (baza) i `690` (wariant S) są wiązane
  z **pełną** rozpiętością 305 px (przesunięcie 0,013, PRIMARY); znacznik w x 307 leży wewnątrz pola etykiety i dla
  wiązania jest REJECTED. „Resztka 56 px” to odległość `690` od skali głosu strony 1,91 cm/px, nie od połowy linii.
  Znacznik 307 (`ONE_SIDED`, `WEDGE_NOT_STROKE`, `STYLE_MISMATCH`, `TEXT_INK` → QUESTIONABLE) dzieli tylko segmenty
  łańcucha (bez wartości), nie wiązanie.
* **Wrotycze: „kotwica 980 niezależna od dopasowania” — nieprawda.** `980` (pion, 406,5 px) jest jednym z **dwóch**
  niezależnych świadków skali (obok `1620`) i ustala skalę osi Y (2,4108). Test bez tej kotwicy — §2.
* **Macierz v3.53.12: 2733 + 18 + 7 ≠ 2784.** Surowy JSON: 2733 zielone, 18 czerwonych, 7 pominiętych (`skipIf`
  Node 18) i **26 niewykonanych** (status `pending`, czas 0) w 4 plikach `analysis-service` (`garages-n7-fix03`,
  `setback-n7-fix04`, `wall-recovery-n7-fix01`, `wall-thickness-n7-fix02`): pliki uruchamiają analizy przy imporcie,
  proces roboczy Vitest jest zajęty i wywołanie `resolveSnapshotPath` przekracza 60 s — testy nie startują (tak samo
  osobno przy obciążeniu: „Tests (9), tests 0 ms, Timeout calling resolveSnapshotPath”). Licznik `numPendingTests` = 7
  liczył tylko pominięte; 26 niewykonanych nie było ani zielonych, ani czerwonych. §9.

## 1. Supertunie 2 E — dowód przed arbitrażem

| etap | 1338 | ustalenie |
|---|---|---|
| kreski linii `690` (y 20) | 159,5 / 307 / 464,5 px; lewa `WEDGE_NOT_STROKE` | lewa kreska to ukośnik przecinający linię przy x ≈ 157; bieg trafień 155–164 obejmuje drugą, równoległą linię 5 px niżej (krawędź tarasu) i jego środek wypada na 159,5 |
| rozpiętość `690` | 305 px → 2,2623 cm/px | 307,5 px → **2,2439** cm/px; `1350`/602 px = 2,2425 — zgodność 0,06 % (było 0,9 %) |
| końce `1350` (x 111) | 160 / 762 px, TICK | lica zewnętrzne góra/dół (sprawdzone na pikselach) |
| odczyty | siatka `1150` (AMBIGUOUS) / zewn. `1350` p 0,9999 → LEADS; siatka `640` (SUPPORTED) / zewn. `690` → CONTESTS | oba napisy sporne między czytnikami |
| głos strony | 1,910 (= `1150`/602, 1 odczyt + 8 korekt, 0 niezależnych) | po V-MARK 1,844 (= `1110`/602, 0 odczytów, 7 korekt — `1110` to alternatywa siatki **tego samego** napisu `1350`) |
| neutralizacja `1350` | „neutral”: alternatywa `1150`/`1110` pasuje do głosu | błędne koło: głos rozwiązał rozpiętość `1350` z jego własnego tokenu |

Warianty (rama główna, te same bajty; `metrics.ts` = produkcyjne `extractMetricEvidenceAsync` z czytnikiem zewnętrznym):

| wariant | topologia/wiązanie | OCR | skala ramy głównej | wynik | status |
|---|---|---|---|---|---|
| 1338 | kreska 159,5; `640` na 305 px PRIMARY | `1350` LEADS, `640` CONTESTS | LEGACY_UNCONFIRMED 1,910 INCONCLUSIVE, `1350` neutral | odmowa: skala nieustalona + ściany nie zamykają obrysu | baza |
| V-MARK (kreska w miejscu przecięcia) | kreska 157; `640` na 307,5 px | bez zmian | LEGACY_UNCONFIRMED 1,844 INCONCLUSIVE, `1350` neutral | odmowa (j.w.) | **odrzucony** — §5.1 |
| V-SEL-a (napis nie jest neutralizowany przez głos zbudowany z jego własnej alternatywy) | bez zmian | bez zmian | `1350` nie jest neutralny; jedyny rozstrzygający napis to napis, z którego zbudowano głos → **nierozstrzygnięte, spór nazwany** | odmowa: skala nierozstrzygnięta (spór nazwany), ściany nie zamykają obrysu | **przyjęty** |
| V-SEL-b (wartość drugiego czytnika jako `contestAlts`) | — | `690` nie potwierdzone (warunek `corroborating` nie spełniony na tej ramie) | bez zmian na ramie głównej; zmienia kopię 4307e | — | odrzucony |
| wariant S (v3.53.12) | — | `690` LEADS | `690` REJECTED względem 1,91 | odmowa | — |

Prawdziwy stan Supertunii: jedna ręka (czytnik zewnętrzny) czyta oba napisy `1350` i `690`; druga (siatka) czyta `1150`
i `640`, niezgodne między sobą (9 %). Zgodność geometryczna `1350`/602 px = 2,2425 z `690`/305 px = 2,2623 to 0,9 %;
przy końcu lewej kreski w miejscu przecięcia ukośnika (157 zamiast 159,5 — sprawdzone na pikselach) byłoby to 0,06 %,
ale reguła, która to robi, przesuwa kreski w całym korpusie (§5.1) i nie weszła. Na ramie głównej `690` nie jest
potwierdzone przez czytnik zewnętrzny (warunek stabilności/pewności), więc nie staje się nawet kandydatem;
rozstrzygnięcie skali z jednego spornego napisu byłoby zbyt słabym świadkiem — **zostaje nierozstrzygnięte, z nazwanym
sporem**. Odmowa nie znika; po skali drugą przyczyną jest obrys (jasnoszare ściany nie zamykają ramki).

## 2. Wrotycze E — kontrola i rola `980`

Wpisy na ramie wybranej (1338): **użyte jako niezależne** — `1620`/672,5 px (X) i `980`/406,5 px (Y); **dołączone
nieliczone** — `320`/132, `51`/21, `252`/102,6; **odrzucone** — m.in. `273`/96, `380`/74 (SCALE_RANKED), `88`/73, `51`/71
(ORIENTATION_BY_OTHER_AXIS), `252`/115,5, `65`/100, `12`/79, `11`/72,5. Test bez `980` (diagnostyczny, tylko ten odczyt
usunięty): skala **ta sama** 2,408922 cm/px z samego `1620`, pewność STRONG → WEAK; odłożone `980` na 406,5 px daje
wtedy 979,2 cm — zgodność 0,08 % — prawdziwy sprawdzian osi Y. Po zmianach: `1620` PRIMARY, skala STRONG 2,4093 bez
zmian (V-JOIN nie podważa etykiety wyśrodkowanej na całej rozpiętości); produkcja na kodzie końcowym: model bajt w bajt
(hash `3ca6e769ee`, 150,1/159,28 m², ściany na zewnątrz i otwarty taras bez zmian).

## 3. Stellarie G2E — etykieta po sklejeniu

Na 1338 `1010` na złączonym rzędzie `1010 | 690` (650 px) ma rolę `UNCENTRED` (przesunięcie 0,207) i **już nie jest
liczony**: trafia do hipotezy 1,554 cm/px jako „nieliczony” (0 niezależnych), REJECTED nadaje mu dopiero skala po fakcie.
Fałszywe przypisanie nie tworzy kotwicy przed metryką. V-JOIN dodaje pochodzenie sklejenia (`coveredPx`) i regułę:
etykieta wyśrodkowana na części, którą odcięłaby ukryta pod zakryciem kreska, równie dobrze jak na całości (margines
`ambiguity` wiązania), jest AMBIGUOUS — kandydat, nie kotwica całości. Na Stellariach bez skutku (etykieta i tak
`UNCENTRED`), lico z 1336 zostaje (produkcja na kodzie końcowym: model bajt w bajt, hash `12c706f3f2`).

## 4. Torenie 3 — sprawdzona skala

1338: rama `1e294dfcda` ma skalę **STRONG 3,128** z 4 niezależnych odczytów (`1160`/371, `520`/166, `1250`/399, `308`/99,5);
rywal 3,98 stoi na jednym odczycie `430`/108 px (7 % wsparcia). Pierwszy odczyt planu stanął na
`PLAN_NO_WALLED_ENVELOPE`; resolver (1.5.0) wziął rywala jako alternatywną skalę i przyjął odczyt 105,0 m² (+5,9 %
AGREES) — **skalę wybrała powierzchnia z ogłoszenia**. V-TOR (resolver 1.6.0): skala wybrana STRONG nie jest wymieniana
na rywala z mniej niż połową jej niezależnego wsparcia. Torenie: przy 3,128 odczyt „walled-first” daje 65,0 m² (WRONG —
zgodne z punktem kontrolnym 64,8), odczyt „largest-first” **81,6 / 99,16 m² (NEAR, 82 %), 2 bryły, potwierdzony
izotropią** — model przy skali MEASURED 3,1277 (ratio 0,9998, STRONG), ilości LIMITED (`COVERAGE_NEAR`). Brakuje
pomieszczeń 1 i 7 (wejście, prawy dół, ≈ 18 m²) — pokazane jako otwarte; taras po lewej otwarty prawidłowo.
Produkcja na kodzie końcowym (te same bajty): PRZED `DEPARTS 3,9815`, 105,0/99,16 m², ilości `NOT_USABLE`, hash
`35146797b4` → PO `MEASURED 3,1277`, 81,6/99,16 m² (`NEAR`), ilości `LIMITED`, hash `4ab60f2816`. Rywal `430`/108 px to
wymiar pomieszczenia we wnętrzu rzutu (plansza 02, powiększenie). Kontrola dowodu przypisanego źle: rywal o wsparciu ≥ połowy
nadal jest oferowany, rozwiązanie WEAK/INCONCLUSIVE oferuje rywali jak dotąd, a wybór STRONG niezgodny z rejestracją
arkusza (> 3 %) niczego nie chroni (test `metric-scales-v35313`, 3 kontrprzypadki).


## 5. Regresja na tych samych bajtach (150 + 12 z próby 1338)

Metoda (każdy etap osobno, te same bajty):
* **linie/topologia** — przesiew linii wszystkich ramek wszystkich 162 domów na obu drzewach (`screen.ts`: ta sama maska
  i raster co ekstraktor), porównanie kreska po kresce;
* **dowód metryczny** (wiązanie, OCR, skala) — `metrics.ts` = produkcyjne `extractMetricEvidenceAsync` z czytnikiem
  zewnętrznym; baza = zapisany dowód produkcji 1338 z v3.53.12 (70 domów — bajt w bajt równy przebiegowi `metrics.ts` na
  drzewie bazowym, sprawdzone na a01) albo przebieg `metrics.ts` na drzewie bazowym (pozostałe); porównanie treści
  (łańcuchy, obserwacje, role wiązań, listy neutralnych/spornych, rozwiązania, rejestracje), z `coveredPx` osobno — wykrywa
  zmianę wartości i skali także przy identycznych liniach;
* **resolver** (V-TOR) — sparowane odtworzenia na zapisanym dowodzie każdego pakietu (`second-house --metrics`) na obu
  drzewach;
* **model** — produkcja na obu drzewach dla domów, w których zmienił się dowód.

### 5.1 V-MARK (kreska w miejscu przecięcia) — odrzucony

Na przesiewie linii pierwsza wersja przesuwała każdą szeroką kreskę (także o pół piksela) i tworzyła nowe łańcuchy z
rysunków detalu (a01: 176 różnic łańcuchów). Zawężona do kresek, których środek biegu trafień leży ponad piksel poza
przecięciem, nadal przesuwała **6 879 kresek w 161 ze 162 domów** (151 domów na ramach rzutów), mediana przesunięcia
6 px, 90. percentyl 18 px, maksimum 305 px, 0 ≤ 1 px. To nie jest poprawka jednego ukośnika, tylko nowa reguła położenia
kreski dla całego korpusu — bez dowodu, że jest lepsza poza Supertunią. Nie weszła; topologia końcowa (1.6.0) zmienia
wyłącznie zapis pochodzenia sklejenia: przesiew linii kodu końcowego — **0 różnic** w 162 domach; `coveredPx` na liniach
sklejonych w 62 domach.

### 5.2 V-SEL — szeroki strażnik znaleziony przez regresję i zawężony

Pierwsza wersja uznawała spór „napisu z samym sobą” (bez zastąpienia głosu), gdy każdy rozstrzygający napis miał w głosie
strony segment rozwiązany z jego tokenu. Głos koryguje jednak każdą rozpiętość, której nie przeczytał — więc warunek był
spełniony także dla napisów, które z głosem nie zgadzają się wcale. Regresja: Julia 17 (`REPLACED STRONG 2,109` →
`LEGACY_UNCONFIRMED 0,911`), Aurory 26 (STRONG 1,993 → 2,060), Milorzeb 21 (2,444 → 3,041), We Wrzosach 2 M (3,231 →
4,505) — skala dobrze ustalona zastąpiona głosem bez odczytu. Poprawka: spór z samym sobą tylko wtedy, gdy **każdy**
rozstrzygający napis jest napisem uratowanym przed neutralizacją (jego własna alternatywa pasuje do głosu, z którego
tokenu głos rozwiązał rozpiętość); napis niezgodny z głosem wprost jest świadkiem jak w 1338. Test 005D V3 (całość z
alternatywą pasującą do głosu nie zastępuje go): bramka bez zmian, zmienia się zapis (napis nazwany jako sporny z własnym
odczytem zamiast „neutralny”). 24 przebiegi wariantu sprzed poprawki usunięto i powtórzono (lista prywatnie); przebiegi
identyczne z bazą pozostają identyczne z definicji (bez napisu uratowanego poprawka nie zmienia niczego).

### 5.3 Wynik na kodzie końcowym (te same bajty, każdy etap osobno)

| etap | domy | identyczne | zmienione | szczegóły |
|---|---|---|---|---|
| linie/topologia | 162 | **162** | 0 | `coveredPx` na liniach sklejonych w 62 domach (pochodzenie, nie geometria) |
| dowód metryczny (wiązanie, OCR, skala) | 161¹ | **134** | 27 | 4 — skala i rejestracja; 4 — pewność przy tej samej skali; 19 — tylko listy neutralnych/spornych |
| resolver (V-TOR, zapisany dowód) | 161 | **160** | 1 | Torenie 3 (DEV) |
| model / odmowa (produkcja na zmienionych) | 27 | **22** | 5 | Nolany 2 G2E odmowa → model; 4 × ta sama odmowa (resolver próbuje mniej odczytów) |

¹ `lipinscy-pl-1` (inny wydawca) nie ma grafu obserwacji — wyłączony w obu drzewach.

Zmiany skali (każda: kilka wydrukowanych, wzajemnie zgodnych wymiarów przegrywało w 1338 z głosem strony bez własnego
odczytu, którego wartość pochodziła z alternatywy napisu uratowanego teraz przed neutralizacją):

| dom | rama | 1338 | PO | odczyty niezależne | model |
|---|---|---|---|---|---|
| Lulo 3 G2 | rzut …bae2ec0d48 | LEGACY_UNCONFIRMED 2,947 | REPLACED SUPPORTED 3,045 | 1570/515, 940/310, 630/207 px | ta sama odmowa (`FOOTPRINT_AREA_WRONG`) |
| Nolany 2 G2E | rzut …830ba06b87 (+ kopia …955fe116e9 WEAK → STRONG 2,775) | LEGACY_UNCONFIRMED 2,270 | REPLACED STRONG 2,769 | 1820/659,5, 1470/532,5 px (+3) | **odmowa → model**: MEASURED 2,7737 STRONG, 206,3/215,56 m² MATCHES, `USABLE_IN_SCOPE` |
| Nawłocie 6 G2 | rzut …0bd7ca97f7 | LEGACY_UNCONFIRMED 2,649 | REPLACED STRONG 2,705 | 1680/620, 1140/421,5, 830/306,5 px (+1) | identyczny |
| Surfinie 2 | rzut …325874b981 | LEGACY_UNCONFIRMED 2,241 | REPLACED SUPPORTED 3,446 | 1630/473, 1000/290, 482/139, 454/132, 694/202 px | ta sama odmowa (`FOOTPRINT_AREA_WRONG`) |

Na Surfiniach skala 1338 dawała wymiarowi `1630` długość 1060 cm (−35 %). Pewność przy tej samej skali: a01
(WEAK → STRONG), Bratki 26 (×2), Kruszczyki 20, Gały (SUPPORTED → STRONG) — modele identyczne.

**Odmowa, która znika — Nolany 2 G2E** (porównanie ze źródłami, plansza prywatna): obrys 18,20 × 14,70 m = wydrukowane
1820 i 100 + 900 + 470; bryła główna 18,20 × 9,00 pod dwuspadem, pas 1,00 m od strony sypialni, garaż z bramą od frontu
pod dachem płaskim — tak jak na elewacji; taras z leżakami i ogród po lewej otwarte; 24 otwory (15 drzwi, 9 okien).
Rozbieżność: szerokość garażu 6,49 m wobec ≈ 7,00 m z rzutu (−7 %) — do dalszej pracy, nie wynik tej zmiany (garaż
w 1338 nie powstawał wcale).

Bilans referencyjny: **korpus 80 — 67 modeli / 13 odmów** (było 66/14; Nolany 2 należy do 80, Torenie zostaje modelem —
teraz przy skali zmierzonej); **tabela pomieszczeń 99/169** (było 96/169; Torenie: OK 0 → 1, OPEN_OK 0 → 2, MERGED 2 → 0,
AREA_OFF 1 → 2, MISSING 4 → 2, bez strat). Zachowane: Nigelle 4, Skalnice (×2), Stellarie, Jaskrzyny, Gaury 5 — dowód
bajt w bajt; Wrotycze — zmiana tylko list, model bajt w bajt (`3ca6e769ee`). Liredy nie należą do 162 domów tej
regresji (bez pomiaru w tym etapie). N1a (005Q) — kontrakt pokryty testami macierzy.

## 6. Świeża próba (zapieczętowana przed wynikiem)

Źródło: lista wydawcy pc1073 s. 22–24 (reguła dopisana do protokołu przed pobraniem listy). 16 domów pobranych kodem
bazowym 1338 (akwizycja = wynik bazowy, nieotwierany). Z samych rzutów wybrano 12: 8 z widoczną cechą (logo na wierszu
z kreską pod logo, linie przez rysunek pergoli, segment z etykietą obok kreski, roślinność przy wierszu) i 4 kontrolne
(pierwsze bez cechy w kolejności listy). Oczekiwania i tolerancje zapieczętowane: `expectations.md`
sha256 `a82d58fb…`, 2026-11-14T14:01:19Z. Wariant uruchomiony offline na tych samych bajtach (różnica pakietu: tylko
zapis jednego zgadywanego adresu — online 404, offline brak w pamięci; zasoby identyczne). Pierwszy bieg wariantu
przerwano przed jakimkolwiek wynikiem, gdy regresja odrzuciła V-MARK (§5.1); próba biegła na kodzie końcowym.

| dom | cecha (zapieczętowana) | wykrycie | kotwica (skala ramy rzutu) | scena | T-DIM (model) |
|---|---|---|---|---|---|
| Kliwie 3 G2 | logo na wierszach dolnych | — (dowód bez zmian) | — | ta sama odmowa (`FOOTPRINT_AREA_WRONG`); resolver próbuje 39 odczytów zamiast 71 (V-TOR: rywal słabej skali nie jest oferowany) | — |
| Plumerie 6 E | linie przez pergolę | — | — | ta sama odmowa (skala nieustalona) | — |
| Marzanki G | segment 60, etykieta obok | `710` przestaje być neutralny (V-SEL) na obu kopiach | bez zmian | ta sama odmowa | — |
| Mekintosze 8 | segment 44, etykieta obok | — | — | identyczna (hash) | 21,48 ✓ × 9,24 (−4,5 % wobec 968) ✓ |
| Jagody 2 | linie przez pergolę | — | — | identyczna | 12,50 (−7,4 % wobec 1350; = 1250) × 8,73 ✓ |
| Barbuły 2 G2E | roślinność pod wierszem | — | — | identyczna | 15,96 (−7,2 %) × 9,55 (−25 %) |
| Rumianki 4 | segment 140 | — | — | ta sama odmowa | — |
| Calandivy | żywopłot przy wymiarach | `1160` przestaje być neutralny (V-SEL) | **LEGACY_UNCONFIRMED 2,554 INCONCLUSIVE → REPLACED 2,676 STRONG**; `1160`/433,5 px: 1107,6 cm → **1160,1 cm** (T-SCALE: 4,5 % → 0,0 %) | identyczna (model budowany z drugiej kopii przy 2,6753) | 11,60 ✓ × 15,59 (−7,2 %) |
| Perełkowce 2 E (k) | — | — | — | identyczna | 15,20 ✓ × 15,65 ✓ |
| Kruszczyki 10 R2 (k) | — | — | — | identyczna | 24,06 ✓ × 8,50 ✓ |
| Lonicery 3 G2 (k) | — | — | — | ta sama odmowa | — |
| Cieszynianki 4 G2 (k) | — | `301` przestaje być neutralny (V-SEL) na obu kopiach | bez zmian | ta sama odmowa | — |

Wynik: **wykrycie** zmienione w 3 domach (2 z cechą, 1 kontrolny), **kotwica** w 1 (Calandivy — zgodnie z
zapieczętowaną tolerancją T-SCALE, z 4,5 % na 0,0 %), **scena** w 0 z 12. **Przeniesienie: tak** — Calandivy jest domem
wstrzymanym z aktywacją i efektem zgodnym z oczekiwaniem; mechanizmem jest jednak V-SEL, nie zapieczętowana cecha
(żaden dom próby nie ma linii sklejonej przez zakrycie — V-JOIN nie aktywował się wcale, a logo na Kliwiach nie dało
sklejenia). Niespełnione T-DIM (Jagody, Barbuły, Calandivy) są takie same przed i po — poza zakresem tego etapu.

## 7. Wpływ każdego wariantu osobno

| wariant | topologia / wiązanie | OCR | skala | obrys | model | status |
|---|---|---|---|---|---|---|
| V-MARK — kreska w miejscu przecięcia | 6 879 kresek przesuniętych w 161/162 domach | — | Supertunie: `690` 0,9 % → 0,06 % od `1350` | — | nie mierzono w produkcji | **odrzucony** |
| V-SEL — napis nie jest neutralizowany przez głos zbudowany z niego samego | listy neutralnych w 19 domach (bez zmiany ról wiązań) | bez zmian (te same odczyty) | 4 skale rzutów na zgodne z drukiem; pewność 4 domów; Supertunie: spór nazwany | Nolany 2 zbudowany; Torenie — nie dotyczy | Nolany 2 odmowa → model; reszta identyczna | **przyjęty** (zawężony po regresji, §5.2) |
| V-JOIN — pochodzenie sklejenia, etykieta wyjaśniana ukrytą kreską jest kandydatem | `coveredPx` na liniach 62 domów; żadna rola wiązania się nie zmieniła na 162 domach | bez zmian | bez zmian | bez zmian | bez zmian | **przyjęty** (zabezpieczenie; testy przyczyny syntetyczne) |
| V-TOR — STRONG nie wymieniany na rywala < ½ wsparcia | — | — | Torenie: 3,98 → 3,128 (wybór resolvera) | Torenie: 105,0 → 81,6 m² (82 %), 2 bryły | Torenie; w 5 innych domach mniej prób resolvera przy tej samej odmowie | **przyjęty** |

## 8. Kontrpróby (testy)

* `packages/source-metrics/test/binding-scale-v35313.test.ts` (12): przyczyna V-SEL (napis z drugim, niezależnym
  odczytem zastępuje głos, STRONG 2,2425); napis sam — spór nazwany, nic nie zastąpione; głos z własnym odczytem nadal
  neutralizuje; prawdziwe `1150` zostaje; prawdziwe `640` — dwie skale, nic nie zastąpione; **napis niezgodny z głosem
  wprost nadal zastępuje głos** (dodane po regresji); V-JOIN: etykieta w środku linii sklejonej — cała rozpiętość;
  wyśrodkowana na części odciętej dwiema ukrytymi kreskami / jedną ukrytą kreską — kandydat; dwie kreski pod jednym
  zakryciem — nic; linia narysowana w całości — bez wątpliwości; przez solver: AMBIGUOUS na linii sklejonej, PRIMARY na
  tej samej linii w całości, nigdy świadek.
* `packages/reconstruction/test/metric-scales-v35313.test.ts` (4): przyczyna V-TOR (rywal z 7 % wsparcia nie jest
  oferowany); rywal z ≥ ½ wsparcia — oferowany; rozwiązanie WEAK/INCONCLUSIVE — jak dotąd; STRONG niezgodny z rejestracją
  arkusza — niczego nie chroni.
* `label-binding.test.ts` 005D V3: bramka bez zmian (całość z alternatywą pasującą do głosu nie zastępuje go,
  INCONCLUSIVE); zapis: spór nazwany zamiast listy neutralnych. `statement-contest.test.ts`: wersja resolvera 1.6.0.
* Na drzewie 1338 (te same pliki testów): 9 czerwonych (przyczyny V-SEL i V-TOR, spór nazwany, wszystkie V-JOIN — brak
  funkcji), 7 zielonych (kontrpróby).

## 9. Typecheck i macierz

Typecheck (`npm run typecheck`) na `5240d7e`: zielony. Macierz (`source-metrics`, `reconstruction`, `analysis-service`,
`local-analyzer`, `analyzer-api`, `tests/architecture`) na `5240d7e`, Node 22.22.0, jeden przebieg, CPU bez innych zadań:
**2 735 testów: 2 720 zielonych, 15 czerwonych, 0 pominiętych, 0 niewykonanych**. Czerwone: 13 tych samych co w macierzy
1338 (architektura: `compound-facade` 1, `reference` 2, `research-isolation` 4, `wall-strip` 4; `analyzer-api/worker` 2 —
środowisko, bez związku ze zmianą) i 2 przypięcia wersji naprawione w `459cc2d` (migawka kontraktu, wersja resolvera w
`statement-contest`; oba pliki zielone po poprawce). 4 pliki `analysis-service`, które w v3.53.12 się nie wykonały
(26 testów), tu wykonały się i są zielone (9 + 8 + 6 + 3). Wyjaśnienie licznika v3.53.12 — §0. Przypadki Node 18:
w tej macierzy brak pominięć; Node 18.20.4 (bez ICU) sprawdzony na bundlu z APK (§11).

## 10. Kontrakt Android

`capture-android-contract.ts` na `5240d7e`: zmieniają się tylko `candidateHash`, `metricEvidenceHash` i wersja solvera
(2.42.0 → 2.43.0); `android-contract.test.ts` 4/4 zielone (`459cc2d`).

## 11. APK 1339 i uruchomienie z paczki

Zbudowany z `459cc2d` (`previewApks`, `-PpreviewVersionCode=1339`), arm64-v8a: `versionCode 1339`, `versionName
0.1339.0-owner`, podpis SHA-256 `6e48fac4afaa3d70e70de5bc608aa4c4194206a9e6bc993dab56382b921ca0da` (ten sam), plik
SHA-256 `43829f53b326f49841c063e223f6c0fb94fa7d2d84c2c11700d7c8ba2051303c`; manifest bundla `assets/local-analyzer`
**12/12** (bundel niesie solver 2.43.0, solver metryczny 1.8.0, resolver 1.6.0). Produkcyjny launcher `main.mjs` z bundla
wyjętego z APK, Node 18.20.4 z symulacją braku ICU, strony na żywo:

| dom | wynik | czas | pamięć szczytowa | model (hash) | scena |
|---|---|---|---|---|---|
| Torenie 3 (naprawiony) | `hello` → `done`, exit 0 | 319 s | 929 MB | `4ab60f2816` = produkcja na kodzie końcowym; MEASURED 3,1277 STRONG, 81,6/99,16 m² NEAR, LIMITED | wczytana loaderem aplikacji, 59 siatek |
| Wrotycze E (kontrola) | `hello` → `done`, exit 0 | 333 s | 926 MB | `3ca6e769ee` = 1338 = produkcja na kodzie końcowym | wczytana, 114 siatek |

Interfejs Android: **NOT_VERIFIED** (brak emulatora i urządzenia w tym środowisku).

## 12. Czego ten etap nie robi

Bez płatnych wywołań i bez zmian w księdze (2,72807938 USD, 92 wpisy); eksperyment API B/C osobno. ForgeShape tylko do
odczytu, bez H2 i prywatnego benchmarku. Rysunki, plansze i paczka — prywatnie, poza Gitem (paczka ZIP dla OWNER-a).
Nie naprawiono: Supertunie (skala nierozstrzygnięta, obrys nie zamyka się), szerokość garażu Nolan 2 (−7 %), brakujące
pomieszczenia 1 i 7 Torenii, niespełnione T-DIM próby (Jagody, Barbuły, Calandivy — takie same przed i po). V-MARK
odrzucony; reguła położenia szerokiej kreski wymaga osobnego etapu z własnym dowodem na korpusie.
