# STAGE BUILDPLAN-ANALYZER-005Q-CHAIN — integracja dowodu: odczyt → linia wymiarowa → łańcuch → skala → model 3D

**Klasa: RESEARCH. Zero zmian produkcyjnych** (zamrożenie IDENTICAL, §L). Bez APK, bez ślepej rundy, bez 005R/005S.
Etap po zamkniętym 005Q-OCR, który wskazał, że liczby giną **za odczytem** (wiązanie, przepisanie wartości przez łańcuch,
samokotwiczenie rejestracji). **005R (pilotaż wizualny) pozostaje nierozpoczęty; 005S później.**

## Podsumowanie dla OWNER-a

Wszystkie liczby pochodzą z pełnych powtórek (ekstrakcja → solver) na 48 wierszach rozwojowych: 45 z pełną ekstrakcją,
3 tylko z solverem na zapieczętowanym starym dowodzie. Liczby są **po poprawkach recenzji** (addendum C, §K); wartości
z pierwszego liczenia zostają w artefaktach obok. PRIMARY = 110 etykiet MAIN z prawdą 005Q-OCR; SENSITIVITY = 152.
Cała prawda jest maszynowa, bez przeglądu człowieka (§F).

| pytanie | odpowiedź z pomiarów |
| --- | --- |
| Gdzie jest pierwsza zła decyzja dla odczytanej liczby? | **W łańcuchu, nie w OCR.** (1) Skalę legacy głosują także **podstawienia** cyfr (`chains.ts:259-288`): w Murajach 1020→1010 wartość 1010 *sama ustawiła* skalę, którą potem „potwierdza”. (2) W obrębie odcinka skala wybiera odczyt **bez kary za podstawienie** (`chains.ts:681-682`); tak Goździkowce 1385 stały się 1382. (3) Wartość `CHAIN_CORRECTED` kotwiczy rejestrację tej samej skali (`extract.ts:997`): 627 takich kotwic na bazie, 42 na etykietach prawdy. (4) Poprawny odczyt atramentu nie wraca do łańcucha, bo ponowne rozwiązanie jest zablokowane (`sameEntries`, `rereadable`): **25 etykiet** jest przeczytanych dobrze i powiązanych, a nie ma żadnej wypowiedzi. Pełna mapa: `research/analyzer-005q-chain/architecture/causal-map.md`. |
| Czy któryś wariant naprawia to bezpiecznie? | **Nie.** Żaden z sześciu (C1, C2, C3, N1, C4, C1N1) nie przechodzi G1 (zmiana znanego dobrego modelu) i każdy ma **materialne** zmiany znanych dobrych modeli (C3: 2, N1: 5, C1: 11, C1N1: 11, C2: 12, C4: 14). Żaden nie przechodzi też G2 ani G3. |
| Co daje „najpierw atrament” (C1)? | Na etykietach: wypowiedzi z poprawną wartością wydrukowaną rosną z 10 do 41 (C1N1: 47), ale **wiązanie zweryfikowane jest tylko 5 → 10**. Z 31 przyrostów 31 ma niezweryfikowane wiązanie, a 12 stoi na odcinku sprzecznym ze skalą o >3 %. Fałszywa pewność z audytem odcinka: 4 → **16**. Na domach: PASS **21 → 17** (kosacce ×2, tymianku, daliach); nowe fałszywie pewne wyniki (kosacce +11,2 %, tymianku −7,8 %); rejestracja S1 przesunięta o **+78 %**, S3 z anizotropią 0,14. Na znanym dobrym `rarytasy-g2e` X przesuwa się o +45,5 %, a PASS zostaje. Jeden atrament (370) zostaje dwa razy „wydrukowany” na dwóch odcinkach. Mechanizm: atrament trafia na **odcinek wybrany przez skalę**. |
| Wiązanie geometryczne (C2)? | Na etykietach nic: poprawne 10 → 9, przy 60 jawnych wstrzymaniach (17 zastępuje wypowiedź C0, 15 z nich była korektą). PASS 21 → 18; G1 materialnie 12; G2c 4. Kotwice zależne od skali zostają (420). |
| Odcięcie tras skali orientacji (C3)? | Etykiety bez zmian, PASS 21, zero kotwic orientowanych skalą i zero nowych fałszywie pewnych skal. Mimo to G1 3 (materialnie modrzykach i tymianku: otwory i pole), G2a 448 (C3 nie usuwa korekt), G2d 2. |
| Odblokowanie ponownego odczytu (N1, mój algorytm, §E.5)? | Najmocniejszy pojedynczy ruch bez zmiany autorytetu: wiązanie zweryfikowane 5 → **15**, wiązania poprawne 13 → 17, PASS 21 = 21, audyt odcinka 4. Ale G1 materialnie 5 (marcowki traci balkon, jarzabem traci ganek), G2c 1 (S4: Y o +4,96 % na jednej korekcie „135”→55) i rejestracja `dom-pod-jarzabem` o +55 %. Falsyfikator z prerejestracji zadziałał częściowo: „powiązane bez wypowiedzi” spadło tylko z 25 do 22. |
| Rekomendacja | **NONE.** Żaden wariant nie kwalifikuje się do wdrożenia. Kierunek na przyszłość, do decyzji OWNER-a i **nietestowany tutaj**: atrament może zastąpić korektę **tylko na odcinku, który etykieta mierzy geometrycznie, i tylko raz**. Wymaga to C2 jako warunku C1, a nie obok niego. Każdą zmianę znanego dobrego modelu trzeba rozliczyć względem rysunku, nie względem progu. |

**Werdykt: `PASS_RESEARCH_BUILDPLAN_ANALYZER_005Q_CHAIN_NO_SAFE_ADOPTION`.** Porównanie sześciu wariantów przebiegło do
końca na tych samych dowodach i tej samej prawdzie, z pełnymi powtórkami solvera, trzema recenzjami i poprawkami P0/P1.
Żaden wariant nie jest bezpieczny, a produkcja jest niezmieniona.

## A. Baza, gałąź, zamrożenie

- Repozytorium `damiankrok/BuildApp`, baza **`cd0c513bcbbb5a00dc7115c887daada1800f9172`** (zamknięcie 005Q-OCR).
  `packages/` jest bez zmian od 005Q, a `packages/source-metrics/src` bez zmian od 005I `c0ad2e8`.
- Gałąź: `analyzer/ink-first-chain-binding-integration-research-v1` od bazy; każdy push lustrzany do
  `claude/new-session-3kzcgh`, bez force-push.
- Zamrożenie: `research/analyzer-005q-chain/freeze-manifest.mjs` obejmuje `packages/`, `apps/`, `.github/`, manifesty,
  lockfile, wagi OCR, słownik, WASM `onnxruntime-web` i bundle lokalnego analizatora. Stan na starcie i na końcu:
  `freeze/production-freeze-{start,end}.json`, **FREEZE: IDENTICAL**; różni się wyłącznie `head`.
- Dotknięte ścieżki: `research/analyzer-005q-chain/`, `stage-reports/artifacts/analyzer-005q-chain/`, ten raport,
  `PROJECT_STATUS.md` i blok 005Q-CHAIN w `tests/architecture/research-isolation.test.ts`. Pliki ze zrzutami ekranu
  z wcześniejszych etapów, nadpisywane przez e2e, przywrócono przed każdym commitem.
- OWNER APK `owner-preview-latest` (versionCode 1212) pozostał **nietknięty**.
- W Git nie ma żadnego obrazu wydawcy, strony, wycinka ani wagi. Żaden obraz nie trafił do zdalnego modelu ani do chmury.
  Powtórki, wycinki i pamięć podręczna leżą poza repozytorium (`/home/user/work005q-chain`, `/home/user/work005q-ocr`).

## B. Audyt przyczynowy (przed jakimkolwiek kandydatem)

`research/analyzer-005q-chain/architecture/causal-map.md` (commit `66a22ce`, poprawki krytyka `30f8a04`). Audyt
przeprowadziło dziewięciu czytelników kodu i przypadków, sześciu weryfikatorów-adwersarzy i krytyk kompletności; surowe
mapy są w `stage-reports/artifacts/analyzer-005q-chain/architecture/`. Każda teza ma znacznik: K (kod), M (zmierzone na
zapieczętowanym dowodzie albo powtórce produkcji) albo H (hipoteza, nieużyta do żadnego wniosku).

**Tożsamość dowodu (M).** Powtórka C0 daje `metric-evidence.json` **bajt w bajt** równy zapieczętowanemu na 45/45
wierszach. Solver jest bajt w bajt równy PROD3 z 005Q, a blind-12 zapieczętowanym przebiegom NEW. Pomiary audytu na
zapieczętowanych zbiorach są więc pomiarami produkcji.

**Wykazane błędy istniejącego kodu (K/M) i sposób testu, zarejestrowany przed kandydatami:**

| # | błąd | miejsce | test |
| --- | --- | --- | --- |
| D1 | podstawienia głosują na skalę legacy | `chains.ts:259-288` | odnotowane; zmienia skalę wszędzie, więc poza zakresem |
| D2 | wybór odczytu w odcinku bez kary za podstawienie | `chains.ts:681-682` | Goździkowce 1385 (C1) |
| **D3** | `CHAIN_CORRECTED` i orientacja ze skali kotwiczą rejestrację (i drabinę rzędnych) | `extract.ts:997`, `:757-771` | **C1**; G2a liczy kotwice |
| D4 | atrament nie dociera do wypowiedzi, którą wybrała skala | `extract.ts:938-981` | **C1** |
| **D5** | mierzony odcinek etykiety wybierany skalą, bez centrowania | `chains.ts:643-700` | **C2**; `spec/c2.spec.ts` |
| **D6** | orientację rozstrzyga skala innej osi (OTHER_AXIS_SCALE, joinedCm); UNDECIDED kotwiczy | `metric-solution.ts:798-851` | **C3**; G2a′ |
| **D7** | odczyt atramentu odcięty od łańcucha (`sameEntries`, `rereadable`) | `metric-solution.ts:1231`, `:1303` | **N1**; zmierzone 25 etykiet |
| D8 | CC/DERIVED → MEASURED → SOURCE_EXACT bez sprawdzenia pochodzenia | `layout.ts:1139-1147`, `reconstruct-v2.ts:409`, `emit.ts:193` | G2d **per element** (addendum C) |
| D9–D12 | bramka rejestracji liczy kotwice wejściowe, nie zachowane; jeden atrament jako dwie kotwice; brak traktowany jak zgoda (udział 0); fragmentacja linii | `extract.ts:793`, `ocr.ts:954`, `plan-resolution.ts:260`, `dimension-lines.ts:116` | odnotowane, poza zakresem |

**Trzy łańcuchy przyczynowe:**

- **Muraje 1020/1010.** Pierwszy błąd to fragmentacja linii i głos skali z podstawienia. Odmowa jest poprawnym wynikiem,
  dopóki zmiana geometrii linii nie da niezależnego świadka.
- **Goździkowce 1385/1382.** Pierwszy błąd to wybór w odcinku bez kary za podstawienie. Model i tak pada na kominie, co
  jest niezwiązane z tym błędem.
- **Głogowniki 541/501 i 870/810.** Dla metryki pierwszym błędem jest bramka ponownego odczytu. Dla pola **nie jest nim
  OCR**: −8,04 % pochodzi z lic wewnętrznych ścian (005P/005Q).

**Errata do mapy** (mapa powstała przed kandydatami i pozostaje niezmieniona):

- §6.5 zurawkach: „`212` bound wrong” opiera się na wątpliwej prawdzie wiązania. Wypowiedź READ 212 na 95,5 px ma
  stosunek 1,000 do TRUE_SCALE, a odcinek prawdy (32,5 px) 2,94 — to artefakt prawdy (B-03).
- §7: „12 of them equal the ink by accident” porównuje z **prawdą**, nie z atramentem (B-12; pole ma teraz nazwę
  `scaleDependentValueEqualsTruth`).

**FIRST_BAD:** `chain` (D1/D2: wartość wybrana skalą) → `registration` (D3: ta wartość kotwiczy tę samą skalę) →
`consumer` (D8: wartość staje się SOURCE_EXACT). Źródło (OCR) jest pierwszym złym ogniwem tylko w 3 ze 110 etykiet
PRIMARY (`PRINTED_VALUE_WRONG`).

## C. Prerejestracja i addenda

`research/analyzer-005q-chain/preregistration.md`: commit `30f8a04`, z hashami łatek i specyfikacji, **przed** pierwszą
powtórką kandydata.

- **Addendum A** (`a59330e`, przed kandydatami). G2a′ to kotwice z łańcucha pionowego, którego kierunek wybrała skala albo
  głos strony, liczone niezależnie od flag wariantu. Dochodzi evaluator `gates.py`.
- **Addendum B** (`19c4bc4`, **po** pierwszym wyniku C1, ujawnione). G2a/G2a′ liczone są na 45 wierszach EXTRACT.
  Trzy wiersze `SOLVE_ONLY_LEGACY` mają zapieczętowany dowód, którego żaden kandydat nie dosięga (57 kotwic, identycznych
  we wszystkich wariantach). Recenzja A uznała tę zmianę za uczciwą korektę zakresu: nie zmienia żadnego werdyktu.
- **Addendum C** (`a329a39`, po recenzjach, ujawnione). Poprawki scorerów i evaluatora, bez zmiany progów i bez ponownych
  powtórek, opisane w §K.

## D. Uprząż i determinizm

- **Uprząż:**
  - `variant.mjs` tworzy kopię bazy poza repozytorium i nakłada łatki;
  - `replay.mjs` wykonuje ekstrakcję i solver dla 48 wierszy, z aliasem tylko dla procesu powtórki;
  - `ACCEL.patch` to pamięć podręczna odczytu pierścieni callout (czysta memoizacja);
  - scorery i bramki: `score_labels.py`, `score_houses.py` (werdykt offline przez zamrożone `holdout/verdict.mjs`),
    `gates.py`, `explain_g5.py`;
  - pozostałe narzędzia: `compare_runs.py`, `mutations.mjs`, `assemble.py`, `spec/{c1,c2}.spec.ts`,
    `test_review_fixes.py`.
- **S1 HOLDS.** C0 (produkcja, bez aliasu, kolejność podana, 3 procesy) jest równe C0dup (kopia z samym ACCEL, kolejność
  odwrotna, 1 proces) na 401 plikach bajt w bajt i na 90 plikach z dokładnością do pól czasu zegarowego.
  `performance.json` różni się tylko pomiarami i licznikami czytnika pierścieni przy trafieniach w pamięć
  (`determinism/S1-C0-vs-C0dup.json`). Korekta (C-6): C0dup był częściowo „ciepły”, bo C1 ruszył o 16:10Z na wspólnej
  pamięci. Kandydaci ruszyli więc, zanim S1 zostało stwierdzone.
- **S2 HOLDS.** C0warm (kolejność obrócona o 17, pamięć ciepła) jest równe C0 na wszystkich 48 wierszach tak samo jak
  wyżej (`determinism/S2-C0-vs-C0warm.json`). Użycie pamięci przez kandydatów jest tym samym potwierdzone po fakcie, jak
  wymaga §2.

## E. Warianty (łatki wyłącznie na `packages/source-metrics/src`, nigdy na rekonstrukcję)

1. **C0** — produkcja.
2. **C1 ink-first.** Segment `CHAIN_CORRECTED`, którego atrament ma zgodny odczyt zespołu (AGREES/LEADS,
   `^[1-9]\d{1,4}$`), jest wypowiadany jako READ z wartością atramentu, a korekta zostaje alternatywą SCALE_DEPENDENT.
   Kotwice pochodzą tylko z READ, bez orientacji OTHER_AXIS_SCALE; drabina rzędnych jest bez CC. Korekta po recenzji
   (A4, A5):
   - „atrament” to w 176 z 262 przypadków **jeden pewny czytnik zewnętrzny** (LEADS), a w 86 przypadkach czytnik
     zewnętrzny zgodny z kratą (AGREES); filtr klasy CLEAR/SUPPORTED jest redundantny wobec decyzji;
   - orientacja UNDECIDED/joinedCm **nie** jest wyłączona (G2a′ 43).
3. **C2 geometric span.** Etykieta mierzy tylko odcinek, na którym leży wyśrodkowana (`C2_BOUNDS = {centred 0.3,
   maxSkipped 2}`). To te same stałe, które produkcja już stosuje: `centredOn` (`axis-topology.ts:203-213`),
   `BINDING_BOUNDS.candidateCentring` (`metric-solution.ts:261`) i `METRIC_BOUNDS.skippedTicks` (`:68`); nie są
   dostrajane do wierszy. Gdy etykieta nie jest wyśrodkowana, odcinek zostaje nierozwiązany z etykietą, nigdy DERIVED
   „nic nie wydrukowano”. Recenzja B-04: reguła „najmniej znaczników” potrafi przewiązać etykietę, którą produkcja
   wiązała dobrze (S1 `190`: 71 px → 45,5 px).
4. **C3 orientation.** Bez tras OTHER_AXIS_SCALE i joinedCm; pionowe UNDECIDED są oznaczone jako zależne od skali
   i wyłączone z kotwic. Recenzja B-09: część tych UNDECIDED to głos strony, nie skala, więc trafniejsza nazwa to
   „orientacja bez świadka”.
5. **N1, mój algorytm po wykazaniu D7.** Ponowne rozwiązanie z kratą odczytów nie jest pomijane, gdy wpisy tokenów są te
   same. Motywacja: 25 etykiet „powiązane bez wypowiedzi”, zdiagnozowanych pojedynczo (§7 mapy). Zarejestrowany
   falsyfikator: jeśli ta liczba nie spadnie wyraźnie, N1 nie trafia w przyczynę. Spadła tylko do 22.
6. **C4** = C1+C2+C3; **C1N1** = C1+N1.

## F. Wyniki na etykietach (PRIMARY MAIN, n = 110)

| wariant | poprawna wartość, powiązana | — w tym wiązanie zweryfikowane / niezweryfikowane | — na odcinku sprzecznym ze skalą (audyt) | fałszywa pewność (prereg.) / z audytem odcinka | wypowiedź zależna od skali | kotwice zależne od skali | jawne wstrzymanie | powiązane bez wypowiedzi |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C0 | 10 | 5 / 5 | 0 | 4 / 4 | 34 | 42 | 0 | 25 |
| C1 | 41 | 10 / 31 | **12** | 4 / **16** | 4 | 0 | 0 | 25 |
| C2 | 9 | 5 / 4 | 0 | 1 / 1 | 23 | 29 | 60 | 39 |
| C3 | 10 | 5 / 5 | 0 | 4 / 4 | 33 | 39 | 0 | 26 |
| N1 | 32 | **15** / 17 | 1 | 3 / 4 | 18 | 24 | 0 | 22 |
| C4 | 30 | 10 / 20 | 6 | 2 / 8 | 2 | 0 | 61 | 40 |
| C1N1 | 47 | **15** / 32 | 11 | 3 / 14 | 4 | 0 | 0 | 22 |

SENSITIVITY (n = 152) daje te same proporcje: C0 10, C1 40, C1N1 46, N1 32 poprawnych.

**Wiązanie:** poprawne C0 13, C1 13, C2 13, C3 13, N1 17, C4 13, C1N1 17. Jedyne dwa „złe” wiązania w każdym wariancie to
dwie wątpliwe prawdy wiązania z §1 prerejestracji; bez nich złych wiązań jest **0** w każdym wariancie, czyli kontrola
wiązania nie złapała żadnego błędu wariantu. Prawda wiązania istnieje tylko dla 19 ze 110 etykiet, stąd audyt odcinka
(stosunek wartość/px/TRUE_SCALE) jako druga, wyłącznie audytowa miara.

**Fałszywie pewna skala na arkuszu prawdy** (obie osie po poprawce B-01; nowa względem C0):

| wariant | arkusz i błąd | przyczyna |
| --- | --- | --- |
| C1 | S1 X **+77,65 %** | atrament 224 i 280 przeniesiony na odcinki 47 px i 60,5 px, wybrane skalą dla korekt `110→120` i `180→160` |
| C1, C1N1 | S3 anizotropia 0,138 (S3 nie ma TRUE_SCALE) | READ 298/98,5 px, 298/98 px, 288/108 px |
| C4 | S1 X **+58,86 %** | wynika z **wiązania geometrycznego C2** (`190` na 45,5 px zamiast 71 px) plus promocji C1, nie z atramentu 224/280, które C2 zostawia nierozwiązane (B-04) |
| C2 | S2 anizotropia −0,037 | — |
| N1 | S4 Y **+4,96 %** przy pewności 0,66 | cała oś Y stoi na jednej korekcie „135”→55 na 20,5 px |

**Prawda (LABEL_TRUTH).**

- Prawda jest w całości maszynowa:
  - poziom A to dwie transkrypcje modelem chmurowym z 005O tego samego wycinka, który czyta rozpoznawacz;
  - poziom B to lokalny podwójny odczyt (PP-OCRv6 medium + Tesseract);
  - poziom C, R1_CONFIDENT, wchodzi tylko do SENSITIVITY.
- Przegląd człowieka nie został wykonany (`NOT_RUN` od 005Q-OCR).
- Wszystkie 31 przyrostów wartości C1 to poziom A. Przyrost C1 oznacza więc zgodność atramentu z transkrypcją tego samego
  wycinka, a nie niezależną poprawność (B-07; recenzenci ocenili to jako P2, bo oba odczyty pochodzą od różnych rodzin
  czytników).
- Żaden plik prawdy ani opublikowana liczba nie jest osiągalna dla kandydata (test architektury + M8).

## G. Wyniki pełnego solvera i bramki (48 wierszy; znane dobre = 21 PASS C0 ∪ kontrolki)

| wariant | PASS | ukończone | G1 (materialnie / drobne) | G2a | G2a′ | G2b′ | G2c (nowe fałszywie pewne) | G2d (zmienione SOURCE_EXACT, wiersze) | G3 | G5 | kwalifikowalny |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C0 | 21 | 26 | — | 570 (+57 legacy) | 132 | — | — | — | — | — | — |
| C1 | 17 | 26 | 14 (**11** / 3) | 0 | 43 | **2** | 5 | 10 | 36 | 13 | **nie** |
| C2 | 18 | 24 | 14 (**12** / 2) | 420 | 91 | 0 | 4 | 15 | 63 | 14 | **nie** |
| C3 | 21 | 26 | 3 (**2** / 1) | 448 | 0 | 0 | 0 | 2 | 11 | 4 | **nie** |
| N1 | 21 | 25 | 9 (**5** / 4) | 468 | 119 | 0 | 1 | 8 | 26 | 6 | **nie** |
| C4 | 16 | 22 | 17 (**14** / 3) | 0 | 0 | 0 | 4 | 14 | 69 | 19 | **nie** |
| C1N1 | 18 | 26 | 15 (**11** / 4) | 0 | 51 | **2** | 4 | 12 | 43 | 11 | **nie** |

- **Drobne** zmiany G1 to wyłącznie pole ≤ 0,1 m² i szerokości otworów ≤ 1 cm, przy tych samych rodzajach, ścianach
  i liczbie otworów. Bramka liczy je tak samo jak materialne; podział jest opisowy.
- G2b (atrament ≠ odczyt zespołu) wynosi 0 we wszystkich wariantach; mutacja M2 dowodzi, że bramka działa.
- **G2b′:** C1 i C1N1 wypowiadają atrament `370` na kosacce jako READ 370 na dwóch odcinkach (73 px i 47 px). To defekt
  C1: jeden atrament może wypowiedzieć co najwyżej jeden odcinek.
- **G2d per element** (poprawka A1). Pierwsze liczenie było sumą na wiersz i nie widziało zmian. Przykłady: C1 kosacce
  `ring-attached-0-0` SOURCE_EXACT 6,48 × 3,70 → **12,04** × 3,70 m; tymianku 10,62 × 10,68 → 10,62 × 11,68; C1N1
  jarzabem 19,10 × 10,00 → 19,10 × 10,74. INK_FIRST READ **dociera** do SOURCE_EXACT (D8).

**Werdykty zmienione względem C0:**

| wariant | zmiany |
| --- | --- |
| C1 | `dom-w-daliach`, `dom-w-tymianku`, `kosacce-clean`, `kosacce-tracked`: PASS → ALGORITHMIC_FAIL |
| C2 | morelach, tymianku, marcowki: PASS → ALGORITHMIC_FAIL |
| C4 | daliach, morelach, tymianku, marcowki, rarytasy-g2e: PASS → ALGORITHMIC_FAIL |
| C1N1 | jak C1, plus `dom-pod-jarzabem` ALGORITHMIC_FAIL → PASS |
| C3, N1 | żadnej |

Przejście `dom-pod-jarzabem` → PASS w C1N1 jest ruchem **od** poprawnego modelu (C-2). Kontrolka otwartego ganku traci
dwa otwarte boki, które stają się ścianami z otworami; tarasy wnęki znikają; liczba ścian EXTERIOR spada z 10 do 6.
Wybrany zostaje odczyt planu zgodny z opublikowanym polem (C-1). Nie liczę tego jako poprawy.

**Bezpieczeństwo tarasów, okien, drzwi, balkonów, brył i kondygnacji (G1/G3):**

- Liczba kondygnacji i wysokości poziomów nie zmieniają się w żadnym wariancie na żadnym znanym dobrym wierszu.
- Zmieniają się:
  - otwory: szerokość, rodzaj (np. C3 modrzykach `[DOOR 1,98, WINDOW 1,46]` → `[DOOR 1,46, WINDOW 5,91]`) i ściana;
  - ściany, pomieszczenia i pole;
  - tarasy: marcowki, rarytasy-g2e, jarzabem (C1: z 65,6 do 101,6 m²);
  - **balkony**: N1 marcowki traci `balcony-front-1` (2 → 1) i jedną balustradę, a PASS zostaje;
  - **bryły ganku**: jarzabem pod C1 i N1 traci `COVERED_TERRACE 12,6`.
- G1 nie widzi obrysów pomieszczeń, końców ścian ani przesunięć otworów poniżej rozdzielczości podsumowania (C-4). Takie
  wiersze są w `changesBelowSummaryResolution` (np. A06: obrys pomieszczenia przesunięty o 5 cm). Recenzent C sprawdził,
  że żadna zmiana kategorii (rodzaj, drzwi/okno, krawędź tarasu, ściana nośna otworu, poziom) nie jest tam ukryta.
- Pełne listy: `safety-gates/*-gates.json`.

**Ruchy rejestracji niewidoczne dla pola** (`paired-matrix.json` → `registrationMovesOver3pct`; opisowe). Pole domu
pochodzi z wypowiedzi na drabinie siatki, a nie z rejestracji, więc rejestracja może się rozjechać przy „dobrym” polu.

| wariant | wiersz | ruch rejestracji | skutek |
| --- | --- | --- | --- |
| C1 | `rarytasy-g2e` (znany dobry) | X +45,5 %, anizotropia 0,002 → 0,31 | PASS zostaje |
| C1 | `dom-w-cyklamenach` | Y +70 %, anizotropia 0,70 | wiersz po raz pierwszy się *kończy*, z −0,2 % |
| C1 | `dom-pod-jarzabem` | X/Y +51/+55 % | — |
| C1 | `rarytasy-eoze` | anizotropia 0,062 → 0,0006 | jedyny ruch w stronę izotropii |
| N1 | `dom-pod-jarzabem` | +55 % | — |
| C4 | `rarytasy-g2e` | X +182 % | — |
| C4 | `dom-w-glogownikach` | X +59 % | — |

**Opublikowane pole jest wejściem produkcyjnego solvera** w każdym wariancie (C-1, korekta §2 prerejestracji):

- bramka układu odrzuca kondygnację odbiegającą o > 20 % (FOOTPRINT_AREA_WRONG, BLOCKING);
- rozstrzyganie planu porządkuje odczyty według koszyka pola.

Żaden kandydat tego nie czyta: ścieżka jest produkcyjna i identyczna wszędzie. Część szkody wariantu ujawnia się więc jako
odmowa, zanim zobaczy ją G2c. Odmowy z tego powodu (`G5-explanations.json`, klasa PUBLISHED_AREA_REFUSAL):

| wariant | wiersze |
| --- | --- |
| C1 | dabecjach |
| C1N1 | dabecjach, D00 |
| C3 | azaliach, dabecjach |
| C4 | azaliach, dabecjach |
| N1 | D00 (C0 kończyło z −18,71 %) |

G2c liczy więc tylko fałszywie pewne skale, które przeszły tę kontrolę.

**G5:** każda zmieniona odmowa i ścieżka decyzji jest wyjaśniona pierwszą różniącą się decyzją, rejestracją wybranej ramki,
`publishedFigure` i `gateBlocking`. Klasy: PUBLISHED_AREA_REFUSAL, REGISTRATION_LOST (np. C1 jarzabem i glogownikach:
ramka, której wszystkie kotwice były korektami, traci rejestrację), REGISTRATION_MOVED i STATEMENTS_ONLY. kosacce nie ma na
tej liście, bo zmienił się tylko werdykt, nie wynik ani ścieżka. Jego mechanizm (wypowiedzi przy niezmienionej
rejestracji 0,024058 → 0,024057) widać w G2d. Kod rekonstrukcji, w tym 005P N1a, jest bajt w bajt produkcyjny w każdym
wariancie; pilnuje tego test architektury.

## H. Proweniencja (45 wierszy EXTRACT)

| wariant | kotwice READ | kotwice INK_FIRST | kotwice CC lub zależne od skali | dowód LINEAR: READ / INK_FIRST / CC / DERIVED |
| --- | --- | --- | --- | --- |
| C0 | 413 | 0 | 570 | 530 / 0 / 536 / 1108 |
| C1 | 402 | 127 | 0 | 530 / 262 / 274 / 1108 |
| C2 | 342 | 0 | 420 | 457 / 0 / 393 / 702 |
| C3 | 371 | 0 | 448 | 522 / 0 / 539 / 1110 |
| N1 | 402 | 0 | 468 | 662 / 0 / 443 / 1087 |
| C4 | 312 | 93 | 0 | 452 / 173 / 222 / 702 |
| C1N1 | 531 | 51 | 0 | 662 / 182 / 261 / 1087 |

Kotwice READ+dependsOnScale są liczone jako zależne od skali; suma tej kolumny to G2a. Recenzja A2: 31 kotwic C1N1
pochodzi z łańcuchów, które N1 przeczytał ponownie na ramkach LEGACY_UNCONFIRMED, czyli przy skali bez wsparcia. Ich
wartości to atrament (29/31 dosłownie), ale łańcuch wybrał je dopasowaniem do tej skali (np. Muraje S2 Y 240/98 px).
C1N1 to więc „zero kotwic CC”, a nie „zero kotwic zależnych od skali”.

## I. Mutacje (G7) — 8/8 zabitych

| mutacja | zepsuta reguła | zabita przez | wynik |
| --- | --- | --- | --- |
| M1 | samoświadek: C1 przyjmuje kotwice CC | G2a | 19 kotwic na 2 wierszach |
| M2 | zmieniona liczba wydrukowana: atrament + 10 | G2b | 18 niezgodności |
| M3 | duplikat czytnika: NOT_CORROBORATING jako atrament | `c1.spec` | exit 1 |
| M4 | rotacja max-p: C3 przestaje flagować UNDECIDED | G2a′ | 3 kotwice na jarzabem |
| M5 | brak jako zgoda: CONTESTS jako atrament | `c1.spec` | exit 1 |
| M6 | promocja złego odcinka: centrowanie 0,3 → 1,0 | `c2.spec` | exit 1 |
| M7 | okno zmienione w drzwi na znanym dobrym modelu | G1 | wiersz `dom-w-arkadiach` |
| M8 | łatka nazywa wiersz | `research-isolation.test.ts` | exit 1 |

Kontrole pozytywne: `c1.spec` na niezmutowanym C1 przechodzi (5/5), `c2.spec` na C2 (9/9).
Artefakt: `mutations/mutations.json`.

## J. Koszt (G6)

Pomiary tylko w obciążeniu (3 procesy na 4 vCPU, Node 22.22.2, WASM 1 wątek; warianty z ACCEL):

| miara | wartość |
| --- | --- |
| mediana ekstrakcji C0 (bez ACCEL) | 452,6 s |
| mediana ekstrakcji wariantów (z ACCEL, nieporównywalna z C0) | 99,6–181,5 s |
| mediana solvera | 16,7–22,1 s |
| szczyt RSS ekstrakcji / solvera | ≤ 1,2 GB / ≤ 0,76 GB |

Żaden kandydat nie przeszedł G1–G5, więc prerejestrowanego nieobciążonego porównania A/B/B/A **nie uruchamiano**.
Node 18 i telefon ARM64: **UNMEASURED** (`performance/performance.json`).

## K. Recenzje (trzy niezależne, każde P0/P1 sprawdzone przez dwóch sceptyków)

Pełny zapis: `post-review/reviews.json`; w nim dla każdej uwagi dowód, reprodukcja, głosy i decyzja. Poprawki opisuje
addendum C. Każdą naprawioną uwagę P0/P1 pokrywa test negatywny w `test_review_fixes.py`: 11 testów, wszystkie padają na
kodzie z pierwszego liczenia, wszystkie przechodzą teraz. Uruchamia je też blok 005Q-CHAIN testu architektury.

| uwaga | dotyczy | ocena po weryfikacji | decyzja |
| --- | --- | --- | --- |
| B-01 | G2c sprawdzał tylko oś X | **P0** (2/2) | NAPRAWIONE: obie osie + anizotropia; dochodzą N1 S4, C1/C1N1 S3, C2 S2 |
| B-02 | etykieta bez prawdy wiązania liczona jako dobrze powiązana | **P0** (2/2) | NAPRAWIONE: podział zweryfikowane/niezweryfikowane, audyt odcinka; C1 41 = 10 + 31, z audytem 16 fałszywych pewności |
| A1 | G2d było sumą na wiersz | P1 (2/2) | NAPRAWIONE: per element; każdy wariant przegrywa G2d |
| B-03 | brak wariantu „bez 2 wątpliwych prawd wiązania” | P1 (2/2) | NAPRAWIONE: złe wiązania = 0 bez nich; errata §6.5 mapy |
| B-04 | błąd S1 w C4 przypisany C1 zamiast C2 | P1 (2/2) | NAPRAWIONE (tekst §E, §F) |
| B-05 | jeden atrament wypowiedziany na dwóch odcinkach | P1/P2 | NAPRAWIONE: G2b′; defekt C1 |
| B-08 | wstrzymanie C2 nigdy niezliczone | P1 (2/2) | NAPRAWIONE: jawne wstrzymanie (C2 60, C4 61) |
| C-1 | opublikowane pole wchodzi do solvera | P1 (2/2) | NAPRAWIONE: korekta tekstu i docstringów, `publishedFigure`/`gateBlocking`, klasa PUBLISHED_AREA_REFUSAL |
| A2, A3, A4, B-06, B-07 | odpowiednio: kotwice N1 przy skali bez wsparcia; powrót alternatywy SCALE_DEPENDENT w rozstrzyganiu planu; „atrament” jako jeden czytnik; przyrosty etykiet na regresujących wierszach; prawda maszynowa | P2 (sceptycy obniżyli) | UJAWNIONE w §E, §F, §G, §H, §M |
| P2 (14) | m.in. A5 G2a′ wymuszone dla C3/C4; A8; A9 (S2 zamknięte); B-09; B-10 (pełne wyniki mutacji i kontrole); B-11; B-12; C-2…C-6 | P2 | naprawione w kodzie (A5, B-10, B-12, C-4, C-5) albo w tekście |

B-11: etykiety zbiorów `BLIND_9`, `BLIND_10_REVEALED`, `FRESH_005K` itd. w `cases.json` i artefaktach to dziedziczone
identyfikatory pochodzenia. **Wszystkie 48 wierszy jest rozwojowych**; blind 9–12 nie są świeżą ślepą próbą.

Żadna uwaga nie zmienia werdyktu: każdy wariant przegrywa G1 przed poprawkami i po nich.

## L. Testy, zamrożenie, CI

| kontrola | wynik |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm test` (vitest) | **182 pliki zaliczone, 1 pominięty; 2576 testów zaliczonych, 11 pominiętych** (612 s); `worker.test.ts` bez przekroczenia czasu |
| `npm run build` | exit 0 |
| `npm run e2e` (Playwright) | **47 zaliczonych** (7,1 min); zrzuty wcześniejszych etapów nadpisane przez e2e przywrócono |
| `tests/architecture/research-isolation.test.ts` | 51/51, w tym 6 testów bloku 005Q-CHAIN (z testami negatywnymi addendum C) |
| `spec/c1.spec.ts`, `spec/c2.spec.ts` na kopiach wariantów | 5/5, 9/9 |
| `test_review_fixes.py` | 11/11 (na kodzie z pierwszego liczenia: 11/11 padają) |
| zamrożenie | **FREEZE: IDENTICAL** (start i koniec) |
| CI | `BuildApp CI` run **38636571399** (push, attempt 1) na `eaeb6df13cd2a3a51b1f9b5e1e496bafb41d9824` — **success**: 39 zadań zielonych, 2 pominięte zgodnie z projektem (publikacja `preview-latest` i `owner-preview-latest` — OWNER APK nietknięty), w tym Android UI evidence gate, Playwright, Node 18 parity i wszystkie domy rozwojowe. Commit zamykający zmienia wyłącznie ten raport; jego przebieg CI podaje handoff. |

## M. Rekomendacja i ograniczenia

**ADOPTION_RECOMMENDATION: NONE** (`recommendation/recommendation.json`). Zasada §6: wariant, który przegrywa
którąkolwiek z bramek G1–G5, jest `NOT_ADOPTION_ELIGIBLE`. Zysk na etykietach nie uzasadnia wdrożenia, gdy topologia domu
się pogarsza.

Czego ten etap uczy:

1. **Samo usunięcie samokotwiczenia nie wystarcza.** Samokotwiczenie (D3) jest prawdziwe i powszechne. Ale wartości
   dobrane do skali są dziś *spójne* z odcinkami dobranymi do skali. Atrament jest prawdziwszy, lecz trafia na odcinek,
   którego nie mierzy, czasem na dwa naraz. W zamrożonym rozstrzyganiu planu alternatywa SCALE_DEPENDENT może wręcz
   wrócić na miejsce atramentu przy skali wyzwania (A3, zasymulowane na rarytasy-g2e). Kolejność naprawy musi być taka:
   odcinek z geometrii (D5) → wartość z atramentu, raz (D4) → kotwica (D3), nigdy odwrotnie.
2. **C2 w obecnej postaci jest zbyt ostry i nie zawsze trafny.** Wstrzymuje 60 etykiet, nic nie daje na wartościach
   i przewiązuje dobrze powiązaną etykietę S1 `190`. Jako warunek C1 (C4) nie wystarcza.
3. **N1 trafia w realne wąskie gardło (D7).** To jedyny wariant, który przy PASS 21 podwaja zweryfikowane poprawne
   wiązania (5 → 15). Zostawia jednak samokotwiczenie (G2a 468) i zmienia 5 znanych dobrych modeli materialnie, w tym
   balkon marcowek.
4. **Pole domu słabo pilnuje skali.** Rejestracja przesuwa się o +45 % do +182 % przy niezmienionym polu. Co więcej, samo
   pole ze strony jest wejściem solvera, więc wynik „zgodny z polem” nie jest niezależnym świadkiem (C-1).

**Ograniczenia:**

- Prawda etykiet jest maszynowa, bez przeglądu człowieka; prawda wiązania obejmuje 19 ze 110 etykiet.
- Blind 9–12 są **rozwojowe**, nie świeże ślepe.
- Muraje, Goździkowce i Głogowniki to wiersze rozwojowe tego samego zestawu.
- Wpływ na Node 18 i ARM64 jest niezmierzony.
- Kandydaci ruszyli przed stwierdzeniem S1/S2; oba warunki potwierdzono po fakcie.

## N. Handoff

```
STAGE: BUILDPLAN-ANALYZER-005Q-CHAIN
VERDICT: PASS_RESEARCH — porównanie C0–C4 + N1 + C1N1 na tych samych 48 wierszach rozwojowych, pełne powtórki solvera, 3 recenzje (2 P0 + 6 P1 naprawione w scorerach/bramkach, 11 testów negatywnych); żaden wariant niekwalifikowalny
BRANCH: analyzer/ink-first-chain-binding-integration-research-v1 (+ lustro claude/new-session-3kzcgh)
BASE: cd0c513bcbbb5a00dc7115c887daada1800f9172
HEAD: commit zamykający z tym raportem (pełny SHA w handoffie czatu)
CI: BuildApp CI 38636571399, attempt 1, success na eaeb6df13cd2a3a51b1f9b5e1e496bafb41d9824 (przebieg commitu zamykającego w handoffie czatu)
FULL_REPORT: stage-reports/STAGE_BUILDPLAN_ANALYZER_005Q_CHAIN_EVIDENCE_INTEGRATION.md
FIRST_BAD: chain (podstawienia głosują skalę + wybór w odcinku bez kary) → registration (CHAIN_CORRECTED kotwiczy swoją skalę) → consumer (SOURCE_EXACT bez pochodzenia); OCR pierwszy zły tylko w 3/110
COMPARED: C0, C1, C2, C3, C4, N1 (umotywowany D7: 25 etykiet powiązanych bez wypowiedzi), C1N1
LABEL_TRUTH: PRIMARY 110 MAIN (poziom A transkrypcje modelem z 005O + poziom B lokalny podwójny odczyt), SENSITIVITY 152 (+R1_CONFIDENT); całość maszynowa, przegląd człowieka NIE wykonany; prawda wiązania 19/110
END_TO_END: 6 wariantów × 48 pełnych powtórek (+ C0, C0dup, C0warm); względem C0: PASS C1 21→17, C2 18, C3 21, N1 21, C4 16, C1N1 18 (jarzabem FAIL→PASS przez zamknięcie otwartego ganku — od poprawnego); G1 materialnie 11/12/2/5/14/11
PRODUCTION_FREEZE: IDENTICAL
ADOPTION_RECOMMENDATION: NONE
VISUAL_ROADMAP: 005R still pending; 005S later
ARM64_005H: PENDING
FINAL_TOKEN: PASS_RESEARCH_BUILDPLAN_ANALYZER_005Q_CHAIN_NO_SAFE_ADOPTION
```
