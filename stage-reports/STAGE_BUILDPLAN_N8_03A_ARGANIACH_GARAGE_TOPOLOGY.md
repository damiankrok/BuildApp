# STAGE BUILDPLAN N8-03A / FIX-06A — Arganiach: topologia garażu i brama garażowa

Projekt: Dom w arganiach (G2E) — https://www.archon.pl/projekty-domow/projekt-dom-w-arganiach-g2e-m32b290f26a4e8
Baza: `b6c4e00` (N8-02B, solver 2.12.0). Wynik: solver **2.13.0**.

## Zgłoszone usterki

1. Granica brył przechodzi przez pomieszczenie garażu. W modelu stały tam dwie ściany zewnętrzne, jedna nad drugą
   przez cały garaż.
2. W miejscu szerokiej bramy model pokazuje pas okien: 4,98 × 1,30 m na parapecie 0,90 m.

Dodatkowo, przy odczycie ściany na styku brył model wyciął przez garaż „drzwi” 5,92 m. Nie było to w zgłoszeniu.

## FIRST_BAD — kolejno po łańcuchu

| # | Etap | Co jest w źródle | Co zrobił solver 2.12.0 | Pierwszy błąd? |
|---|---|---|---|---|
| 1 | Rzut ARCHON i OCR | Parter w kształcie L, 1430 × 870 (łańcuchy).<br>Garaż 10: 595 × 595, w świetle od ściany frontowej (z 0..0,46) do ściany tylnej z≈6,45..6,72.<br>Brama 500/225 z szynami bramy segmentowej: dwie przerywane szare linie ok. 3 m w głąb.<br>Drzwi 90/210 w zachodniej ścianie garażu.<br>Drzwi do holu i do pomieszczenia 9 z zarysowanym skrzydłem. | Wymiary i łańcuchy odczytane.<br>Etykieta bramy „500/225” nieczytelna: OCR dał niestabilne „4/2” i jej nie przyjął. | nie |
| 2 | Dekompozycja / bryły | Piętro i poddasze stoją tylko nad tylnym prostokątem 14,2 × 8,62 m.<br>Na parterze garaż wchodzi pod piętro do z≈6,45.<br>**Na linii z = 3,70 rzut nie rysuje żadnej ściany.** | Podział na `main` (0..14,2 × 3,7..12,32, kondygnacje 0–1) i `attached-0` (7,42..14,2 × 0..3,7, kondygnacja 0, dach płaski).<br>Podział jest poprawny co do kondygnacji: garaż nie jest osobną bryłą na całej głębokości, tylko pomieszczeniem L-kształtnej kondygnacji parteru. | nie |
| 3 | **Styk brył (N8-02B)** | 0 z 215 pozycji z tuszem ściany w oknie styku.<br>Ściany poprzeczne narysowane na obu końcach. | `UNDECIDED` („za mało, żeby powiedzieć”), więc obie bryły budują pełną ścianę zewnętrzną: `ring-main-0-w0` i `ring-attached-0-0-w2`. | **TAK: FIRST_BAD.** Reguła N8-02B nie odróżniała „rysuje za mało” od „nie rysuje nic”. |
| 4 | Granice pomieszczenia | Garaż to jedno pomieszczenie 35,06 m² (lista wydawcy). | Każda bryła czytała wnętrze osobno:<br>• `attached-0-room-0-0` = 16,38 m², numer 10, ale 53 % od 35,06, więc etykietę „Garaż” wstrzymano;<br>• część garażu w `main` wpłynęła do holu (80,86 m²), bo tylna ściana garażu (5,81 m, z 6,52) została odrzucona jako „mebel” — kończy się drzwiami przy ścianie zewnętrznej, a reguła drzwi na końcu ścianki (N8-02B) brała pod uwagę tylko ścianki poprzeczne. | skutek #3, plus druga usterka (drzwi przy ścianie zewnętrznej) |
| 5 | Rozpoznanie bramy | Szyny bramy segmentowej narysowane od obu ościeży. | `overheadDoorTracks`:<br>• lewa szyna 3,01 m;<br>• prawa 3,66 m, bo za końcem szyny leży czerwona liczba „595” wymiaru, liczona jako tusz;<br>• rozbieżność 0,64 m > 10 %, więc szyn nie uznano. | **TAK: drugi niezależny błąd** |
| 6 | Klasyfikacja i przypisanie | Elewacja frontowa pokazuje bramę.<br>Rejestracja „band-only” wymaga co najmniej 2 przerw na ścianie, więc ściana garażu z jedną przerwą elewacji nie dostaje. | Bez szyn, bez nazwanego garażu i z założonymi wysokościami przerwa 4,98 m stała się **WINDOW** (1,30 m, parapet 0,90).<br>Wysokości bramy z elewacji (0 / 2,18) trafiły do przerwy 5,92 m na **nieistniejącej** ścianie `main` z = 3,70 i dały „drzwi” 5,92 m między bryłami.<br>Drzwi 90/210 w zachodniej ścianie: WINDOW (brak pokoju „Garaż”). | skutek #3–#5 |
| 7 | Emisja / BuildWorld | — | 22/22 wyemitowanych otworów fizycznie wyciętych.<br>To była prawda — przy bramie jako oknie, „drzwiach” 5,92 m w nieistniejącej ścianie i cichym pominięciu przerwy 5,92 m w tylnej ścianie garażu (`opening-0-rear-10-0`, brak powodu w biegu). | „wszystkie wycięte” ≠ „wszystkie otwory rzutu są” |

**Czy garaż jest osobną bryłą?** Nie na całej głębokości:
- strop i dach płaski: tak, nad częścią 0..3,7 (`attached-0`, wysokość jak dotąd);
- pomieszczenie: nie, ciągnie się pod piętro do z≈6,45.

Wynika to z rzutów: poddasze pokrywa tylko tylny prostokąt, a parter nie rysuje ściany na z = 3,70. Model nie przesądza tego za źródło: bryły zostają, zmienia się tylko styk.

## Poprawka — reguły ogólne (kod nie zna żadnego domu)

1. **Styk otwarty (`party-wall.ts`, decyzja `OPEN`).**
   - Warunki:
     - na co najmniej 40 próbkach co najwyżej 2 % pozycji ma tusz ściany (`PARTY_OPEN_MAX_SOLID`, `PARTY_OPEN_MIN_SAMPLES`);
     - w kwadracie ±0,6 m na **obu** końcach styku jest ≥ 15 % tuszu ściany (`PARTY_CORNER_WINDOW_M`, `PARTY_CORNER_MIN_INK`), czyli ściany poprzeczne są narysowane.
   - Skutek: żadna bryła nie buduje ściany na styku. Ściana bryły biegnącej dalej przechodzi nad końcem ściany poprzecznej drugiej, jak OTHER_CORNER w N8-02B.
   - Odmowy końców z N8-02B (za krótki odcinek) obowiązują dalej.
   - „Trochę tuszu” (filar, odcinek) zostaje `UNDECIDED`, bez zmian. Styk bez narysowanych narożników (poza rysunkiem) też zostaje `UNDECIDED`.
   - Jedną ścianę wymusza tylko odczytane pasmo, jak w N8-02B. `OPEN` nie buduje niczego.
2. **Pomieszczenia przez styk otwarty (`joinRooms`, `reconstruct-v2.ts`).**
   - Pokoje obu brył stykające się z linią styku na ≥ 0,5 m są jednym pokojem. Pas między licami obu odczytów (tam, gdzie każdy odczyt postawił nieistniejącą ścianę) jest posadzką.
   - Numer pochodzi z części.
   - Gdy części niosą dwa różne numery, odrzucany jest numer, który nosi też inny pokój kondygnacji (zasada „numer drukuje się raz na kondygnacji”, jak dla odczytów odłożonych). W pozostałych przypadkach numer zostaje nierozstrzygnięty i nazwany.
   - Etykieta jest sprawdzana na połączonym polu: powyżej 40 % różnicy zostaje wstrzymana. Pole sprawdza numer, nigdy go nie wybiera.
   - Pokój połączony należy do obu brył, więc obie widzą swój garaż.
3. **Drzwi na końcu ścianki przy ścianie zewnętrznej (`readInterior`).**
   - Warunki:
     - wolny koniec ścianki jest na szerokość drzwi (0,60–1,35 m) od lica wewnętrznego ściany zewnętrznej, bez ścianki pomiędzy;
     - tusz ściany zewnętrznej jest przy dalszym ościeżu;
     - **narysowany jest łuk skrzydła**, sprawdzany od lica ścianki lub ściany zewnętrznej (tam, gdzie leży zawias), z tym samym testem 70 % punktów łuku.
   - Bez łuku nic się nie zmienia.
4. **Szyny bramy tylko z szarego tuszu (`overheadDoorTracks`).** Piksel o nasyceniu > 12 (czerwień wymiaru i jej różowy antyaliasing) nie jest szyną.

`SOLVER_V2_VERSION` 2.12.0 → 2.13.0, z wpisem w changelogu.

## Wynik — Arganiach

| | PRZED (2.12.0) | PO (2.13.0) |
|---|---|---|
| Styk main / attached-0, parter | UNDECIDED, 2 ściany 0,457 m przez garaż | **OPEN**, brak ściany (0/215 tuszu, narożniki 40 % / 38 %) |
| Pomieszczenie garażu | 16,38 m² bez etykiety; reszta w holu (80,86 m²) | **„10 Garaż” 34,53 m²** (opubl. 35,06, −1,5 %), x 7,86..13,76 × z 0,46..6,36 |
| Tylna ściana garażu (z 6,52) | odrzucona jako „mebel” | ścianka, z drzwiami 0,92 m do pom. 9 (łuk narysowany) |
| Drzwi hol → garaż | brak | 0,94 m (łuk narysowany) |
| Brama `opening-0-front-8-0` | WINDOW 4,98 × 1,30, parapet 0,90 | **GARAGE_DOOR**: szyny 3,01 i 3,28 m, kind DOOR 4,98 × 2,20 od posadzki, fizycznie wycięta |
| Drzwi 90/210 zachód `opening-0-west-11-0` | WINDOW | DOOR („bryła ma bramę pojazdową”) |
| „Drzwi” 5,92 m na styku | wycięte w nieistniejącej ścianie | brak; przerwa pominięta z powodem (OMITTED_WITH_REASON) |
| Piętro, poddasze, dach główny, kominy | — | bez zmian (żadnej różnicy w `lvl-1` ani w dachu głównym) |
| Dach płaski garażu | wysokość 2,80, `plateInset.maxZ` 0,23 | wysokość 2,80, `plateInset.maxZ` 0: płyta dochodzi do lica ściany piętra |
| Walidacja / BuildWorld | ok, 0 WALLS_OVERLAP, 22/22 wyciętych | ok, 0 WALLS_OVERLAP, 0 diagnostyk, **23/23 wyciętych** |
| Kompletność | COMPLETE_WITH_OPEN_QUESTIONS (ROOF_EVIDENCE_DISAGREES) | to samo, bez nowych ukrytych problemów |

Model: `cf9b660ca4f3…` → `0770f85430f1…`.

### Otwory w pięciu stanach (`research/analyzer-n8-03a/opening-ledger.ts`)

| | zaobserwowane | wybrane | wyemitowane | wycięte | pominięte z powodem |
|---|---|---|---|---|---|
| PRZED | 23 | 22 | 22 | 22 | 1 **bez podanego powodu** |
| PO | 25 | 23 | 23 | 23 | 2, oba z powodem: przerwy na otwartym styku, czyli brak ściany, a nie otwór |

Pełne tabele są w `stage-reports/artifacts/analyzer-n8-03a/`.

## Co jest nadal niepewne (nie zamknięte za COMPLETE)

- **Brama:**
  - szerokość 4,975 m jest z przerwy w rzucie (SOURCE_DERIVED) i zgadza się z drukowanym 500;
  - wysokość 2,20 m jest **założona**; drukowane 225 nie zostało odczytane przez OCR, więc go nie wpisano;
  - elewacja nie potwierdza tej ściany (rejestracja band-only wymaga ≥ 2 przerw).
- Drzwi garaż → 9 odczytane na 0,92 m, wycięte na 0,84 m: przebieg ścianki jest przycinany na licu ściany wschodniej.
- Ścianka zachodnia garażu w części pod piętrem ma grubość ścianki działowej (0,16 m), a nie ściany zewnętrznej. Tak odczytano tusz.
- Lico wschodnie rysunku stoi ok. 0,12 m za licem modelu. Rejestracja nie jest ruszana.
- W widokach 3/4 krawędź płyty dachu płaskiego miga na koronie ścian (współpłaszczyznowość płyty i korony ściany). Występuje identycznie PRZED, na wspólnym kadrze (`C2`). Nie dotyczy tej zmiany i nie było poprawiane.
- „1 Wiatrołap” nadal przypisany do dużego obszaru holu (open plan). Wcześniejszy stan, poza zakresem.

## Regresja 8 domów

Te same zapieczętowane wejścia, produkcyjny `second-house.ts`. **A01, Goździkowce, Marcówki, Cieszynianka, Rarytasy, Trytomach, Sasanki 3 — `model.json` bajt w bajt identyczny z N8-02B.** W szczególności bez zmian:
- dach krzyżowy Sasanek;
- poddasza Trytomach i Arganiach;
- ściany wspólne Sasanek, Marcówek i Rarytasów;
- bramy i przeszklenia pozostałych domów.

Zmienił się tylko Arganiach. W korpusie tylko ten dom miał styk bez tuszu, a nowe reguły drzwi i szyn nie zadziałały nigdzie indziej.

## Testy (tylko celowane)

- nowy `packages/reconstruction/test/open-contact-n8-03a.test.ts` (16 testów):
  - OPEN, UNDECIDED bez narożników, UNDECIDED przy odrobinie tuszu;
  - segmenty boków;
  - emisja i walidacja;
  - łączenie pokoi z etykietą i konfliktem numerów;
  - drzwi przy ścianie zewnętrznej z łukiem i bez;
  - szyny z czerwonym tekstem;
- `party-wall-n8-02b.test.ts`: test „touching is not enough” dostał filar na styku. Jego dawny rysunek (styk bez żadnego tuszu, narożniki narysowane) jest teraz z definicji stykiem otwartym;
- 22 pliki / 195 testów zielone: garaż, wnętrze, otwory, schody, ściana wspólna, 3 testy analysis-service z N8-02B. Dziennik: `artifacts/analyzer-n8-03a/tests.txt`.
- `tsc -p tsconfig.json` czysto.
- Bez pełnego CI i bez APK, zgodnie ze zleceniem.

## Materiały

- Prywatny ZIP `BuildPlan-N8-03A-Arganiach-Garage-Before-After.zip`. Zawiera:
  - modele przed i po z hashami;
  - dowody źródłowe: obrazy ARCHON, wyłącznie w ZIP-ie;
  - 9 widoków review-shots przed i po;
  - plansze ARCHON / PRZED / PO;
  - zbliżenia garażu i bramy;
  - widok z góry bez dachu;
  - tabelę stanów otworów;
  - porównanie poddasza;
  - FIRST_BAD i regresję.
- W repozytorium: ten raport, `stage-reports/artifacts/analyzer-n8-03a/*.json` (wyłącznie liczby i teksty) oraz narzędzie `research/analyzer-n8-03a/opening-ledger.ts`.

Zielone testy i COMPLETE_WITH_OPEN_QUESTIONS nie oznaczają, że model jest poprawny. Ocena należy do recenzenta.
