# STAGE BUILDPLAN LINK-F1 — wspólna rama i tolerancje dla rzeczywistego domu

| pole | wartość |
|---|---|
| gałąź | `claude/new-session-3kzcgh` |
| baza | `ed4008c268c897e79f1edb51420a94a9bfb7c30e` (N9-02R); zdalny HEAD = baza, drzewo czyste, F1 niewykonany |
| wersje | layout `1.2.0 → 1.3.0`, solver v2 `2.17.0 → 2.18.0`; model 1.7.0, czytnik wymiarów 1.5.0, usługa analizy 1.5.0, `assessment` 1.2.0 bez zmian |
| zakres kodu | `packages/reconstruction/src/layout.ts` (`axisLadder`, `sheetScale`, rama layoutu), `v2/reconstruct-v2.ts` (wersja + krok rejestracji z kotwicami); test architektury 005Q: tylko przypięty numer wersji layoutu |
| poza zakresem (nietknięte) | source-metrics, analysis-service, renderer, Android, wagi OCR, schemat modelu, workflow, APK, zależności |
| artefakty tekstowe | `stage-reports/artifacts/analyzer-link-f1/` |
| sondy (research) | `research/analyzer-link-f1/` (`probe-frame.ts`, `debug-run.ts`, `closure-findings.ts`) |
| ZIP prywatny | `BuildPlan-LINK-F1-Source-Before-After.zip`, 34 689 251 B, 338 plików, SHA-256 `2057c8fd2992b4a552201d352ecf283957fac2066af70a04d6ba2255f8a92a9d` — poza repozytorium (obrazy ARCHON); jego `REPORT.md` to ten raport sprzed wpisania tego wiersza |
| werdykt | **PARTIAL** |

## 0. Rodzina błędów i co znaczy „dwie ramy”

Rzut bazowy jest dziś mapowany na metry dwiema drogami:

- **drabina łańcuchów** (`layout.ts` `axisLadder`) — linie siatki przypięte do wydrukowanych wymiarów, kawałkami liniowa;
  przez nią layout kładzie **bryły** (masy, regiony, strefy);
- **liniowa rama v2** (`v2/frame.ts` `planFrameV2`, skala arkusza z poprawką lico-do-lica) — przez nią solver czyta
  **ściany wewnętrzne, szczeliny/otwory, schody, bloki, pomieszczenia** i rejestruje kondygnacje.

Gdzie drabina odchodzi od pikseli, bryła stoi obok wszystkiego, co z niej przeczytano. Sonda
(`research/analyzer-link-f1/probe-frame.ts`) zmierzyła to na wszystkich ośmiu domach (`maxAbsDcm*` w
`source-anchors-and-residuals.json`): do **16,6 cm** (Rarytasy X), 12,1 (Goździkowce X), 11,1 (Cieszynianki X),
10,3 (Jarzmianki Y), 8,6 (Rarytasy Y), 5,8 (Arganie Y).

## 1. FIRST_BAD (na obecnych wejściach, nie z historii)

Wszystkie trzy przypadki to ta sama rodzina: **drabina przypina linie twierdzeniami, które nie są wydrukowanym
wymiarem albo przeczą dłuższemu, mocniejszemu wymiarowi ponad niepewność pikselową**, a rama v2 tego nie widzi.

### F1-a — Rarytasy 5 (G2E), rzut parteru `…e8520c3ad3-59a406b738`, oś X

**Źródło i odczyt:**
- Łańcuch detalu `chain-horizontal-208-afad7a6a99` (linia bazowa y = 208 px) ma 17 segmentów:
  - **13 `DERIVED`**: „nothing is printed on this span”, wartość to piksele × skala łańcucha 2,749693 cm/px;
  - 3 `CHAIN_CORRECTED` o pewności 0,21–0,36: czytnik odczytał „154”, „715”, „515”, a łańcuch poprawił na 174 / 215 / 111.
- Wymiar całkowity 1721 cm (`READ`, ticki na liniach 106,5 i 730,5 px, 624 px → 0,027580 m/px) zgadza się z
  rejestracją 0,027579.

**Pierwszy błędny parametr:**
- Tick 141 px łańcucha przypisano do linii 146,5 px (5,5 px obok, tolerancja 7 px).
- Sumy wartości pochodnych przypięły linię 175,5 px do **2,0518 m**; piksele i 1721 cm dają **1,903 m** (+14,9 cm).
- Linie 240,5–594,5 px przesunęły się o 7–15 cm.

**Wpływ na model:**
- Ściana zachodnia garażu (`attached-0`) stała na x = 2,052 m, wschodnia na 8,909 m. Garaż był przesunięty o 5 px
  w głąb narysowanego pasma ściany z obu stron (plansza `BOARDS/rary-PLAN-BEFORE-AFTER.png`).
- Ściana wspólna i otwory frontowe garażu przesunęły się razem z nim.

### F1-b — Goździkowce 3, rzut parteru `…01d4b6474c-64bd1e0f2f`, oś X

**Źródło i odczyt:**
- Wymiar całkowity 1382 cm (`fcc98a90c7`, pewność 0,245, ticki 96 → 641 px = 545 px) stoi na linii obwiedni 639 px.
- Łańcuch `686523194d` ma dwie słabe korekty: 311 cm (pewność 0,24) i 514 cm (pewność 0,22).

**Pierwszy błędny parametr:**
- Twierdzenie 311→639 px = 8,25 m przeczy całkowitemu o **−3,87 px**, a 434→639 px = 5,14 m o **−3,06 px**.
- Mimo to przypięło linie 311 / 345 / 434 px o **9,8 cm** na wschód od pikseli (5,570 zamiast 5,472 m).
- Wpływ na model: wnęka frontowa (pocket: ściana tylna, policzek, wylot) przesunięta o 2,2 cm względem ścian
  czytanych z pikseli. Bryły nie mają krawędzi na tych liniach.

### F1-c — Jarzmianki, rzut parteru `…3db285e128-e3f3f41d03`, oś Y

**Źródło i odczyt:**
- Łańcuch `chain-vertical-304-c389e11be5` ma 12 segmentów: 11 `DERIVED` i 1 `CHAIN_CORRECTED` (77 cm, pewność 0,24).
- Skala łańcucha 2,030947 cm/px to w rzeczywistości **skala osi X** (10,5 m na 517 px), bo na osi Y odczytano tylko
  ten jeden segment.

**Pierwszy błędny parametr — dwie rzeczy w jednym miejscu:**
- **Zapadnięta ściana.** Jeden tick przy ~446 px leży w tolerancji (5,5 px) linii 441,5 i 451 px. Obie linie dostały
  6,0359 m, więc pasmo 9,5 px (0,19 m) miało w drabinie zerową szerokość (−10,3 / +9,0 cm wobec ramy liniowej).
- **Fałszywa anizotropia.** Rejestracja osi Y stoi na dwóch krótkich kotwicach (0,55 m / 28,5 px, 0,77 m / 38 px):
  0,020108 m/px wobec 0,020310 na osi X, czyli „anizotropia” 1,00 %. Dwa ticki na 28–38 px lokalizują skalę
  z dokładnością ±5–7 %, więc to zaokrąglenie pikseli, a nie dowód deformacji arkusza.
  - Do tej pory ukrywały to wartości `DERIVED` (niosły skalę X), a w v2 poprawka lico-do-lica.
  - Samo odpięcie `DERIVED` (krok pośredni, bieg `head3`) odsłoniło ten błąd. Głębokość domu spadła 7,834 → 7,768 m,
    poddasze przesunęło się o ~0,6 px i czytnik ścianek zgubił prawdziwe drzwi przy `main-iwall-1-x-3`. Łuk skrzydła
    jest narysowany, co sprawdziłem na wycinku rzutu poddasza.

### Przypadek sprawdzony i niezmieniony — Cieszynianki 12 (GE), oś X

- Twierdzenie 231→321,5 px = 2,40 m (pewność 0,47) nie trafia tickiem w linię (o 4 px) i przeczy liniom o −4,05 px.
- Mieści się jednak we własnej niepewności: 2 + 4 + 0,2 = 6,2 px.
- Zostaje przypięte. Nie mam z rysunku dowodu, że jest złe.

## 2. Jedna zmiana systemowa (w istniejącej drabinie, bez drugiego solvera)

**Bramka niepewności w `axisLadder`** (layout 1.3.0). Twierdzenia nadal są stosowane od najdłuższego, jak dotąd. Każde
dostaje jednak dyspozycję i jest zapisane z rezyduum (`LadderAnchor`, `WorldFrame.ladders`, krok rejestracji
„the base plan’s shared frame”):

- `NOT_PRINTED`: suma zawiera segment `DERIVED`, czyli nie jest wydrukowanym wymiarem tego odcinka. Nie przypina nic.
  Rejestracja i tak nie bierze `DERIVED` za kotwicę; teraz drabina i rejestracja mówią to samo.
- `REJECTED_RESIDUAL`: twierdzenie przeczy temu, co już przypięły dłuższe twierdzenia, o więcej niż jego niepewność
  w pikselach. Niepewność to `2·LADDER_TICK_PX` (tick i linia, po pół piksela na każdym końcu) + chybienie ticka
  względem linii + `LADDER_PRINT_ROUNDING_M` = 0,5 cm na każdą wydrukowaną liczbę. Linia zostaje tam, gdzie ją
  narysowano.
- `PINNED`: w pozostałych przypadkach liczba wydrukowana wygrywa dokładnie, jak dotąd.
- Bez globalnego „±10 cm” i bez progu pod konkretny dom. Pierwsze, najdłuższe twierdzenie ustala skalę bez warunku,
  jak dotąd.

**Jedna skala arkusza** (`sheetScale`):
- Osie zachowują własne skale tylko wtedy, gdy różnią się bardziej, niż obie razem potrafią zlokalizować:
  2 px na najdłuższej kotwicy każdej osi, sumowane w kwadratach.
- W przeciwnym razie arkusz ma jedną skalę, średnią ważoną 1/σ².
- Na ośmiu domach żadna rejestracja bazowa nie dowodzi deformacji. Zmiana skali wynosi ≤ 0,4 % (Jarzmianki: oś Y
  +1,00 %, powrót do skali X).
- Tę samą skalę bierze rama v2 przez `draft.frame`, więc layout i v2 mówią jednym głosem.

**Rozdzielenie konfliktu miary od topologii:**
- Odrzucone twierdzenie nie usuwa żadnej linii, ściany ani strefy.
- Monotoniczność jest zachowana: jeden tick nie przypina już dwóch linii, a wydrukowana wartość wewnątrz linii
  uzgodnionych w granicach niepewności nie wywraca kolejności.

**Wszystkie zależne współrzędne idą za ramą.** Bryły, regiony, strefy, a przez nie pierścienie, ściany wspólne, otwory
w pierścieniach, wnęki i dachy dobudówek są liczone z poprawionej drabiny. Ścianki, szczeliny, schody i bloki — z ramy
v2 w tej samej skali arkusza.

### Wariant sprawdzony i NIEPRZYJĘTY — „jedna mapa” dosłownie

Rama v2 bazowego rzutu mapowana przez te same drabiny, z odwrotnością i ze złożeniem dla kondygnacji
(`artifacts/analyzer-link-f1/variant-shared-frame.diff`, regresja `variant-shared-frame-regression.json`).

**Co dało:**
- usunęło dwie ścianki-widma Goździkowców na licu ściany wschodniej (`main-iwall-0-z-13/15`, 0,076 m) i drzwi na jednej z nich;
- spięło bryły z otworami Rarytasów.

**Co zepsuło** (przesunięcie próbkowania o 1–2 px wywraca czytniki progowe na fazie pół piksela):
- Sasanki: brama garażowa → okno (parapet 0,9), dwie szczeliny `GAP` 5 mm;
- Arganie: zamiana drzwi i okna;
- Trytomy: ostrzeżenia siatki dachu;
- Jarzmianki: zgubione drzwi poddasza;
- w wersji z ostrą bramką dodatkowo Rarytasy: odmowa koszy dachu (`ROOF_PLANES_NOT_ADJACENT`, PARTIAL_3D_PREVIEW).

Wariant pozostał w diffie i nie wszedł do produkcji. To jest rekomendacja na osobny etap, po utwardzeniu tych czytników.

### Testy celowane (`packages/reconstruction/test/shared-frame-link-f1.test.ts`, 13/13)

1. Długi pewny wymiar kontra krótki zaszumiony: krótki odrzucony, linia na pikselach.
2. Niewielki błąd zamknięcia (1,2 px): liczba wydrukowana honorowana dokładnie.
3. Tick obok linii poszerza dopuszczalne rezyduum tylko o własne chybienie; ten sam wymiar trafiony w linię zostaje odrzucony.
4. Błędna cyfra / tick na złej linii: odrzucenie z rezyduum.
5. Pierwsze twierdzenie ustala skalę także przy rozbieżnej rejestracji (fikstury 005Q).
6. `DERIVED` nie przypina; wydrukowane kawałki tak.
7. Brak łańcuchów (zła edycja, łańcuchy innego arkusza): skala arkusza, nic nie przypięte.
8. Topologia: jeden tick między dwiema liniami ściany nie zapada ściany; metry rosną z pikselami.
9. Linie spoza przypiętych zachowują skalę arkusza (pas za ścianą nie jest przeskalowany).
10. Deterministyczność i niezależność od kolejności łańcuchów i dowodów.
11. `sheetScale`: dwie krótkie kotwice nie dowodzą 1 % (skala osi długiej).
12. `sheetScale`: długie kotwice różniące się ponad niepewność zachowują dwie skale.
13. `sheetScale`: jedna oś zmierzona zostaje jak w rejestracji.

## 3. Rezydua PRZED / PO względem niezmienionych kotwic

Maksymalna rozbieżność drabina (bryły) ↔ rama liniowa v2 (ściany, otwory) na liniach siatki rzutu bazowego, w cm.
Szczegóły w `source-anchors-and-residuals.json`: każda linia, każde twierdzenie, rezyduum w px, dopuszczalne px i dyspozycja.

| dom | X przed → po | Y przed → po | odrzucone (rezyduum / dopuszczalne) | niewydrukowane (`DERIVED`) |
|---|---|---|---|---|
| Jarzmianki | 4,1 → 4,1 | **10,3 → 0,2** | — | Y: 89 |
| Goździkowce | 12,1 → 8,4 | 3,3 → 3,7 | X 8,25 m (−3,87 / 2,39 px), X 5,14 m (−3,06 / 2,20 px) | — |
| Marcówki | 4,4 → 3,8 | 0,8 → 1,3 | — | X 9, Y 4 |
| Cieszynianki | 11,1 → 9,6 | 0,4 → 0,7 | X 2,45 m (−3,24 / 2,18 px) | X 5 |
| Rarytasy | **16,6 → 8,7** | 8,6 → 12,0 | — | X 112, Y 2 |
| Trytomy | 1,3 → 0,2 | 2,9 → 1,1 | — | X 27, Y 2 |
| Arganie | 5,6 → 5,3 | 5,8 → 4,2 | — | Y 2 |
| Sasanki | 4,2 → 3,6 | 0,4 → 0,2 | — | X 2, Y 1 |

To, co zostaje, to **jawny kompromis**, a nie dokładny obmiar:

- **Wydrukowane wymiary przypięte w granicach niepewności.** Rarytasy Y: para 850 / 620 cm (tick 3 px od linii
  szwu garażu, rezyduum 2,94 px przy dopuszczalnych 5,68 px) zostaje przypięta. Garaż ma wydrukowane 6,20 m.
- **Wymiar całkowity nietrafiony o 2 px w linię obwiedni.** Goździkowce X: 1382 cm przypięte, do wschodniej ściany
  zostaje 8,4 cm. Ścianki-widma `z-13/15` zostają; usuwał je tylko nieprzyjęty wariant.
- Zmniejszenie rozbieżności nie dowodzi całej wierności. Rozstrzygają plansze na rzucie i elewacje.

## 4. Regresja ośmiu domów (jedno przejście, produkcyjny `runAnalysis`, zapieczętowane wejścia DEV)

Wejścia: `second-house.ts` na `source-package.json` + `observation-graph.json` + cache bajtów każdego domu, w edycjach
zapisanych w manifestach (`canonicalUrl`, `contentHash`, `pageHash` w `regression-8-houses.json`). PRZED to bieg N9-02R
na `ed4008c` na tych samych wejściach. To regresja DEV, nie holdout.

| dom | model PRZED → PO | ściany | otwory (D/W) | pomieszcz. | złącza zewn. błędy (znaleziska) | rezydua poza tol. | co się zmieniło i dlaczego |
|---|---|---|---|---|---|---|---|
| Jarzmianki | `ab0c4f1e8d48` → `7c0d73554357` | 27 → 27 | 10/13 → 10/13 | 11 → 11 | 1 (3) → 1 (1) | 3 → 3 | rama Y bez zapadniętej ściany; ściany ≤ 5 mm; zniknęły 2 ostrzeżenia siatki dachu |
| Goździkowce | `58a284c35d51` → `058d8348e371` | 39 → 39 | 19/12 → 19/12 | 13 → 13 | 0 (0) → 0 (0) | 0 → 0 | wnęka frontowa spójna (2,2 cm); ścianki ≤ 3,5 cm (skala X −0,19 %); znaleziska wewn. 73 → 72 |
| Marcówki | `8cbab3cbc15f` → `e14fcc394459` | 41 → 41 | 13/8 → 13/8 | 12 → 12 | 4 (4) → 4 (4) | 12 → 12 | ≤ 1 cm (skala ≤ 0,11 %); znaleziska wewn. 40 → 43 |
| Cieszynianki | `bb05006787f8` → `d29bb7ea5908` | 25 → 25 | 10/11 (+3 P) → bez zmian | 8 → 8 | 0 (0) → 0 (0) | 0 → 0 | skala X +0,22 %: ścianki/otwory ≤ 4 cm; wewn. 26 → 25 |
| **Rarytasy** | `565dcd94be7b` → `4e323c07b9a3` | 21 → 21 | 14/6 → 14/6 | 9 → 9 | 2 (2) → 2 (2) | 19 → 21 | **garaż na narysowanych licach: zachód −14,9 cm, wschód −8,7 cm; ściana wspólna i otwory frontowe garażu razem z nim; 0 odmów** |
| Trytomy | `c639b29d69e4` → `82a44fe82ffc` | 36 → 36 | 10/11 → 10/11 | 11 → 11 | 2 (2) → 2 (4) | 4 → 6 | szerokość 12,989 → 12,97 m (12,99 była pochodną skali łańcucha, nie wydrukiem); +2 OSTRZEŻENIA siatki dachu; +2 nowe porównania elewacji |
| Arganie | `d0b13ea16f77` → `7b501aa5f768` | 29 → 30 | 18/8 → 18/8 | 14 → 15 | 3 (3) → 3 (3) | 7 → 7 | **odzyskana ścianka `z-6`** (x = 8,51 m, ~1 m, prawdziwy tusz przy biegu schodów — wycinek rzutu); ≤ 1,8 cm |
| Sasanki | `3a3465ec2dd9` → `3aa678d8a59f` | 34 → 34 | 15/8 → 15/8 | 11 → 11 | **1 (1) → 3 (3)** | 17 → 17 | skala ±0,04 %: ściana wspólna +2,7 mm; **2 nowe błędy `GAP` 5,4 mm ściana wspólna ↔ strop** (patrz niżej) |

Wspólne dla wszystkich:
- replay `BYTE_IDENTICAL` w 8/8;
- 0 odmów modelu w 8/8;
- liczby drzwi i okien bez zmian w 8/8;
- wszyscy gospodarze otworów bez zmian (bez przepinania i zmiany rodzaju).

Szczegóły: `regression-8-houses.json` oraz `closure-exterior-before-after.txt`.

**Nowe błędy złączy:**
- **Sasanki**, 2 × `GAP` 5,4 mm między ścianą wspólną `ring-main-*-w1-party-attached-0` a `slab-main-1`.
  - To ta sama klasa defektu co w Marcówkach już PRZED (`GAP` 4,2 cm i 2,5 cm): wsparcie stropu liczone z grubości
    pierścienia T kontra lico ściany wspólnej z pikseli.
  - W Sasankach rozjazd wynosił ok. 2,5 mm, tuż pod tolerancją 3 mm audytu. Zmiana skali o 0,04 % dodała 2,7 mm.
  - Nie naprawiam tego tutaj (kompilator i ściana wspólna są poza zakresem), ale to jest **nowy błąd złącza
    wywołany tą zmianą**.
- **Trytomy**: +2 ostrzeżenia (`SLIVER_TRIANGLES`, `NON_MANIFOLD` na `roof-main`), bez nowych błędów.

**Rezydua elewacji +2** (Trytomy, Rarytasy):
- W Trytomach przyrost to otwór, którego elewacja wcześniej nie sprawdzała. Po przesunięciu o 1–2 cm jest porównany
  (drzwi frontowe `opening-0-front-0-1`, widok FRONT o spornej osi ALONG z N9-02R) i wychodzi poza tolerancję.
- Ten sam mechanizm widziałem w biegu pośrednim w Marcówkach.
- W Rarytasach nie analizowałem ich pojedynczo.

## 5. Obserwacje: dopasowanie kontra kontrola

- **Do ramy (fit):**
  - wydrukowane segmenty łańcuchów rzutu bazowego i ich ticki (`metric-evidence.json` → `chains`, `evidence`);
  - kotwice rejestracji (`coordinateRegistrations`: skala, najdłuższa kotwica osi).
- **Tylko kontrola, nie wchodzi do dopasowania:**
  - elewacje (rezydua R5 i `verification.residuals`);
  - audyt złączy (`geometryClosureAudit`);
  - tusz rzutu pod bryłami (plansze);
  - wizualizacje ARCHON (przegląd wzrokowy);
  - powierzchnie z tabeli (nieużyte; brak skali z pola pokoju).

## 6. Testy i CI (celowane; pełnego CI nie uruchamiano)

| polecenie | wynik |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | czysto |
| `npx vitest run packages/reconstruction` | **1205 / 1205** (99 plików), w tym nowy plik 13/13 |
| `npx vitest run packages/analysis-service` | 199 / 199 |
| `npx vitest run apps/local-analyzer apps/analyzer-api` | 91 PASS, 4 FAIL, 7 skip — te same 4 co na bazie (`/health`, kontrakt Android, Larchfield hash, NFD) |
| `npx vitest run tests/architecture` | 11 FAIL / 346 PASS — ten sam zestaw 11 co na bazie (005Q wymaga `04d5568`, IU-01/02/03A, 005M, 005N §30, reference 4/7) |
| `wall-strip.test.ts` (architektura) | przypięta wersja layoutu podniesiona `1.2.0 → 1.3.0` razem ze zmianą; reszta asercji nietknięta |
| regresja 8 domów (`/home/user/link-f1/regress.sh`) | 8 × exit 0, 137–264 s na dom |

Porażki bazowe zreprodukowano na worktree `ed4008c`. Te same pliki wewnątrz pakietu `reconstruction` przechodzą na
bazie (sprawdzone: `wall-strip`, `wall-strip-invariance`, `mutations` — 103/103) i przechodzą po zmianie.

## 7. Ograniczenia

- **Rama nie jest jedną mapą** (wariant §2 nieprzyjęty). Bryły i ściany zgadzają się w granicach niepewności
  wydrukowanych wymiarów, a nie co do piksela. W Rarytasach Y zostaje do 12 cm, w Goździkowcach X do 8,4 cm.
- Nowe 2 × `GAP` 5,4 mm w Sasankach (§4).
- Wartości `DERIVED` nie przypinają już niczego. Gdzie były jedynym nośnikiem skali (Jarzmianki Y), zastępuje je
  jedna skala arkusza. Arkusz, który naprawdę jest rozciągnięty, a ma tylko krótkie kotwice na jednej osi,
  zostanie przeskalowany izotropowo. Dowodu przeciwnego nie ma.
- Cieszynianki: twierdzenie 2,40 m (tick 4 px obok linii) zostaje przypięte w granicach własnej niepewności.
- Rendery Cieszynianek nie powstały (baner ostrzeżeń przesuwa płótno w `review-shots`). Geometria Cieszynianek
  zmieniła się o ≤ 4 cm.
- Programy (`program.json`) nie są w ZIP-ie. Jest model, `result-summary` i `candidateHash`.
- Brak niezależnej prawdy metrycznej ARCHON: poprawność oceniam względem tuszu rzutu, nie obmiaru.

## 8. Dostawa

- Commity na `claude/new-session-3kzcgh`: zmiana zachowania (layout / solver / testy) oraz osobno raport, artefakty,
  sondy i `PROJECT_STATUS.md`. Oba z markerem `[skip ci]`.
- ZIP `BuildPlan-LINK-F1-Source-Before-After.zip` (poza repozytorium). Zawartość:
  - `SOURCE-REFERENCE/`: rzuty, elewacje, przekrój i 3 wizualizacje na dom, oryginały z cache z URL-ami;
  - `BOARDS/*-PLAN-BEFORE-AFTER.png`: ściany i otwory modeli PRZED i PO na rzucie ARCHON;
  - `RENDERS/`: 9 kamer PRZED i PO, arkusze porównań;
  - `MODELS/`, `HASHES.txt`, artefakty tekstowe.

**Werdykt: PARTIAL.**
- Zmiana systemowa usuwa FIRST_BAD w trzech realnych przypadkach jednej rodziny:
  - Rarytasy: garaż na narysowanych licach, −14,9 / −8,7 cm;
  - Goździkowce: wnęka spójna z ramą, 5,14 i 8,25 m odrzucone z rezyduum;
  - Jarzmianki: ściana nie zapada się w ramie, a jedna skala arkusza zastępuje fałszywą anizotropię.
- Dodatkowo odzyskana jest prawdziwa ścianka w Arganiach.
- Nie jest to jednak „jedna rama” w sensie dosłownym, a w Sasankach pojawiły się dwa nowe błędy złącza (5,4 mm).

STOP. F2 ani N9-02S nie były zaczynane. MASTER PLAN nie był zmieniany.
