# STAGE BUILDPLAN-ANALYZER-005Q-CHAIN — integracja dowodu: odczyt → linia wymiarowa → łańcuch → skala → model 3D

**Klasa: RESEARCH. Zero zmian produkcyjnych** (zamrożenie IDENTICAL, §L). Bez APK, bez ślepej rundy, bez 005R/005S.
Etap po zamkniętym 005Q-OCR, który wskazał, że liczby giną **za odczytem** (wiązanie, przepisanie wartości przez łańcuch,
samokotwiczenie rejestracji). **005R (pilotaż wizualny) pozostaje nierozpoczęty; 005S później.**

## Podsumowanie dla OWNER-a

Wszystkie liczby z powtórek na 48 wierszach rozwojowych (45 z pełną ekstrakcją, 3 tylko z solverem na zapieczętowanym
starym dowodzie). PRIMARY = 110 etykiet MAIN z prawdą 005Q-OCR niezależną od kandydatów; SENSITIVITY = 152 (dodatkowo
prawda z PP-OCRv6 medium — ta sama rodzina co czytnik, którego C1 używa; tylko informacyjnie).

| pytanie | odpowiedź z pomiarów |
| --- | --- |
| Gdzie pierwsza zła decyzja dla odczytanej liczby? | **W łańcuchu, nie w OCR.** (1) skala legacy jest głosowana także przez **podstawienia** cyfr (`chains.ts:259-288`) — Muraje 1020→1010 to wartość, która *sama ustawiła* skalę; (2) w obrębie odcinka skala wybiera odczyt **bez kary za podstawienie** (`chains.ts:681-682`) — Goździkowce 1385→1382; (3) wartość `CHAIN_CORRECTED` (dobrana do skali) **kotwiczy rejestrację tej samej skali** (`extract.ts:997`) — 627 takich kotwic na bazie, 42 na etykietach prawdy; (4) poprawny odczyt atramentu nie wraca do łańcucha, bo ponowne rozwiązanie jest zablokowane (`sameEntries`, `rereadable`) — **25 etykiet** przeczytanych dobrze, powiązanych, a bez żadnej wypowiedzi. Szczegóły: `research/analyzer-005q-chain/architecture/causal-map.md`. |
| Czy któryś wariant naprawia to bezpiecznie? | **Nie.** Żaden z sześciu (C1, C2, C3, N1, C4, C1N1) nie przechodzi G1 (zmiana znanego dobrego modelu). Każdy zmienia otwory, ściany albo tarasy na co najmniej 3 znanych dobrych domach. |
| Co daje „najpierw atrament” (C1)? | Na etykietach dużo: poprawnie wydrukowane i powiązane **10 → 41** (C1N1: **47**), wartości zależne od skali 34 → 4, kotwice zależne od skali 42 → 0. Na domach źle: PASS **21 → 17** (kosacce ×2, tymianku, daliach), nowe fałszywie pewne wyniki (kosacce +11,2 %, tymianku −7,8 %), rejestracja S1 o **78 %** od prawdziwej skali, a na znanym dobrym `rarytasy-g2e` X o **+45,5 %** (anizotropia 0,31) przy wciąż „dobrym” polu. Mechanizm: atrament zostaje przeniesiony na **odcinek wybrany przez skalę** — prawdziwa liczba na złym odcinku jest gorsza od dopasowanej liczby na złym odcinku, bo przestaje być widocznie zależna. |
| Wiązanie geometryczne (C2)? | Prawie nic na etykietach (10 → 9; „powiązane bez wypowiedzi” 25 → 39), PASS 21 → 18, G1 14, G2c 3. Kotwice zależne od skali zostają (420). |
| Odcięcie tras skali orientacji (C3)? | Etykiety bez zmian (10), PASS 21, kotwice orientowane skalą 0, ale G1 3 (miniaturka, modrzykach, tymianku — otwory i pole) i G2a 448 (C3 nie usuwa korekt). |
| Odblokowanie ponownego odczytu (N1, mój algorytm, §E.4)? | Najmocniejszy pojedynczy ruch bez zmiany autorytetu: poprawne 10 → **32**, wiązania poprawne 13 → 17, PASS 21 = 21, **zero** nowych fałszywie pewnych skal; ale G1 9 i rejestracja `dom-pod-jarzabem` +55 % (wiersz już poza 6 %). Jego falsyfikator (prerejestracja §5) zadziałał częściowo: „powiązane bez wypowiedzi” spadło tylko 25 → 22. |
| Rekomendacja | **NONE.** Żaden wariant nie jest kwalifikowalny do wdrożenia. Kolejny krok (do decyzji OWNER-a, nie testowany tutaj): atrament może zastąpić korektę **tylko na odcinku, który etykieta mierzy geometrycznie** (C2 jako warunek C1, nie obok), a każda zmiana znanego dobrego modelu ma być rozliczona względem rysunku, nie progu. |

**Werdykt: ⟪VERDICT⟫** — porównanie sześciu wariantów na tych samych dowodach i tej samej prawdzie przebiegło do końca,
z pełnymi powtórkami solvera; żaden wariant nie jest bezpieczny, produkcja niezmieniona.

## A. Baza, gałąź, zamrożenie

- Repozytorium `damiankrok/BuildApp`, baza **`cd0c513bcbbb5a00dc7115c887daada1800f9172`** (zamknięcie 005Q-OCR; `packages/`
  bez zmian od 005Q, `packages/source-metrics/src` bez zmian od 005I `c0ad2e8`).
- Gałąź: `analyzer/ink-first-chain-binding-integration-research-v1` od bazy; każdy push lustrzany do
  `claude/new-session-3kzcgh` (bez force-push).
- Zamrożenie: `research/analyzer-005q-chain/freeze-manifest.mjs` (`packages/`, `apps/`, `.github/`, manifesty, lockfile,
  wagi OCR, słownik, WASM `onnxruntime-web` `ort-wasm-simd-threaded.{wasm,mjs}`, bundle lokalnego analizatora) →
  `stage-reports/artifacts/analyzer-005q-chain/freeze/production-freeze-start.json`; kontrola końcowa §L.
- Dotknięte ścieżki: `research/analyzer-005q-chain/`, `stage-reports/artifacts/analyzer-005q-chain/`, ten raport,
  `PROJECT_STATUS.md`, blok 005Q-CHAIN w `tests/architecture/research-isolation.test.ts`.
- OWNER APK `owner-preview-latest` (versionCode 1212) — **nietknięty**.
- Żadnego obrazu wydawcy, strony, wycinka ani wagi w Git; żadnego obrazu do zdalnego modelu ani chmury. Powtórki, wycinki
  i pamięć podręczna leżą poza repozytorium (`/home/user/work005q-chain`, `/home/user/work005q-ocr`).

## B. Audyt przyczynowy (przed jakimkolwiek kandydatem)

`research/analyzer-005q-chain/architecture/causal-map.md` (commit `66a22ce`, poprawki krytyka `30f8a04`) — dziewięciu
czytelników kodu/przypadków, sześciu weryfikatorów-adwersarzy, krytyk kompletności; surowe mapy w
`stage-reports/artifacts/analyzer-005q-chain/architecture/`. Każda teza oznaczona K (kod), M (zmierzone na zapieczętowanym
dowodzie lub powtórce produkcji) albo H (hipoteza, nieużyta do wniosku).

**Tożsamość dowodu (M).** Powtórka C0 ekstrakcji na bazie daje `metric-evidence.json` **bajt w bajt** równy zapieczętowanemu
na 45/45 wierszach; solver = PROD3 z 005Q bajt w bajt; blind-12 = zapieczętowane przebiegi NEW. Pomiary audytu na
zapieczętowanych zbiorach są więc pomiarami produkcji.

**Wykazane błędy istniejącego kodu (K/M) i sposób testu (zarejestrowany przed kandydatami):**

| # | błąd | miejsce | test |
| --- | --- | --- | --- |
| D1 | podstawienia głosują na skalę legacy | `chains.ts:259-288` | odnotowane (zmienia skalę wszędzie; poza zakresem) |
| D2 | wybór odczytu w odcinku bez kary za podstawienie | `chains.ts:681-682` | Goździkowce 1385 (C1) |
| **D3** | `CHAIN_CORRECTED` / orientacja ze skali kotwiczy rejestrację (i drabinę rzędnych) | `extract.ts:997`, `:757-771` | **C1**; G2a liczy kotwice |
| D4 | atrament nie dociera do wypowiedzi, którą wybrała skala | `extract.ts:938-981` | **C1** |
| **D5** | mierzony odcinek etykiety wybierany skalą, bez centrowania | `chains.ts:643-700` | **C2**; `spec/c2.spec.ts` |
| **D6** | orientacja rozstrzygana skalą innej osi (OTHER_AXIS_SCALE, joinedCm); UNDECIDED kotwiczy | `metric-solution.ts:798-851` | **C3**; G2a′ |
| **D7** | odczyt atramentu odcięty od łańcucha (`sameEntries`, `rereadable`) | `metric-solution.ts:1231`, `:1303` | **N1**; zmierzone 25 etykiet |
| D8 | CC/DERIVED → MEASURED → SOURCE_EXACT bez sprawdzenia pochodzenia | `layout.ts:1139-1147`, `reconstruct-v2.ts:409`, `emit.ts:193` | spis SOURCE_EXACT na wiersz (G2d) |
| D9–D12 | bramka rejestracji liczy wejście, nie zachowane kotwice; jeden atrament jako dwie kotwice; brak = zgoda (udział 0); fragmentacja linii | `extract.ts:793`, `ocr.ts:954`, `plan-resolution.ts:260`, `dimension-lines.ts:116` | odnotowane, poza zakresem |

**Trzy łańcuchy przyczynowe:** Muraje 1020/1010 — pierwszy błąd: fragmentacja linii + głos skali z podstawienia (odmowa
jest poprawnym wynikiem, dopóki zmiana geometrii linii nie da niezależnego świadka); Goździkowce 1385/1382 — wybór w
odcinku bez kary (model i tak pada na kominie, niezwiązane); Głogowniki 541/501 i 870/810 — bramka ponownego odczytu dla
metryki, a **nie OCR** dla pola (−8,04 % to lica wewnętrzne ścian, 005P/005Q).

**FIRST_BAD:** `chain` (D1/D2: wartość wybrana skalą) → `registration` (D3: ta wartość kotwiczy tę skalę) → `consumer`
(D8: staje się SOURCE_EXACT); źródło (OCR) jest pierwszym złym ogniwem tylko w 3 z 110 etykiet PRIMARY.

## C. Prerejestracja

`research/analyzer-005q-chain/preregistration.md` — commit `30f8a04` z hashami łatek i specyfikacji, **przed** pierwszą
powtórką kandydata. Addendum A (`a59330e`, przed kandydatami): G2a′ = kotwice z łańcucha pionowego, którego kierunek
wybrała skala albo głos strony, liczone niezależnie od flag wariantu; evaluator `gates.py`. Addendum B (`19c4bc4`, **po**
pierwszym wyniku C1 — ujawnione): G2a/G2a′ liczone na 45 wierszach EXTRACT; 3 wiersze `SOLVE_ONLY_LEGACY` mają
zapieczętowany stary dowód, którego żaden kandydat source-metrics nie dosięga (57 kotwic, identycznych w każdym wariancie,
raportowane osobno). Progi bez zmian.

## D. Uprząż i determinizm

- `variant.mjs` — kopia bazy poza repo + łatki; `replay.mjs` — ekstrakcja → solver dla 48 wierszy, alias tylko dla procesu
  powtórki; `ACCEL.patch` — pamięć podręczna odczytu pierścieni callout (czysta memoizacja). `score_labels.py`,
  `score_houses.py` (werdykt offline przez zamrożone `holdout/verdict.mjs`), `gates.py`, `explain_g5.py`, `mutations.mjs`,
  `assemble.py`, `spec/{c1,c2}.spec.ts`.
- **S1 HOLDS:** C0 (produkcja, bez aliasu, kolejność podana, 3 procesy) = C0dup (kopia z samym ACCEL, kolejność odwrotna,
  1 proces, pamięć zimna) bajt w bajt na 491 plikach; różnią się wyłącznie pola czasu zegarowego
  (`determinism/S1-C0-vs-C0dup.json`).
- **S2:** ⟪S2⟫

## E. Warianty (łatki na `packages/source-metrics/src`, nigdy na rekonstrukcję)

1. **C0** — produkcja.
2. **C1 ink-first** — segment `CHAIN_CORRECTED`, którego atrament ma zgodny odczyt zespołu (AGREES/LEADS, klasa
   CLEAR/SUPPORTED, `^[1-9]\d{1,4}$`), jest wypowiadany jako READ z wartością atramentu; korekta zostaje alternatywą
   SCALE_DEPENDENT; kotwice tylko z READ, nie z orientacji zależnej od skali; drabina rzędnych bez CC.
3. **C2 geometric span** — etykieta mierzy tylko odcinek, na którym leży wyśrodkowana (`C2_BOUNDS = {centred 0.3,
   maxSkipped 2}` — te same stałe, które produkcja już stosuje: `centredOn` w `axis-topology.ts:203-213` (0,3 długości, ≤ 2 znaczniki), `BINDING_BOUNDS.candidateCentring = 0.3` (`metric-solution.ts:261`) i `METRIC_BOUNDS.skippedTicks = 2` (`:68`); nie dostrajane do wierszy); inaczej odcinek
   nierozwiązany z etykietą, nigdy DERIVED „nic nie wydrukowano”.
4. **C3 orientation** — bez tras OTHER_AXIS_SCALE i joinedCm; pionowe UNDECIDED oznaczone jako zależne od skali; takie
   kotwice wyłączone.
5. **N1 (zaproponowany przeze mnie po wykazaniu D7)** — rozwiązanie ponowne z kratą odczytów nie jest pomijane, gdy wpisy
   tokenów są te same; motywacja: 25 etykiet „powiązane bez wypowiedzi”, każda zdiagnozowana pojedynczo (§7 mapy);
   falsyfikator zarejestrowany: jeśli ta liczba nie spadnie wyraźnie, N1 nie trafia w przyczynę.
6. **C4** = C1+C2+C3; **C1N1** = C1+N1.

## F. Wyniki na etykietach (PRIMARY MAIN, n = 110; SENSITIVITY n = 152 w nawiasie)

| wariant | poprawne wydrukowane i powiązane | fałszywa pewność | zależne od skali (wypowiedź) | kotwice zależne od skali | wiązanie poprawne / złe | powiązane bez wypowiedzi |
| --- | --- | --- | --- | --- | --- | --- |
| C0 | 10 (10) | 4 (4) | 34 | 42 (42) | 13 / 2 | 25 |
| C1 | **41** (40) | 4 (5) | 4 | **0** (0) | 13 / 2 | 25 |
| C2 | 9 (9) | 1 (1) | 23 | 29 (29) | 13 / 2 | 39 |
| C3 | 10 (10) | 4 (4) | 33 | 39 (39) | 13 / 2 | 26 |
| N1 | 32 (32) | 3 (3) | 18 | 24 (24) | **17** / 2 | 22 |
| C4 | 30 (30) | 2 (2) | 2 | 0 (0) | 13 / 2 | 40 |
| C1N1 | **47** (46) | 3 (4) | 4 | 0 (0) | **17** / 2 | 22 |

Fałszywie pewna skala na arkuszu prawdy (rejestracja > 3 % od TRUE_SCALE przy pewności ≥ 0,5): **C1 S1 (77,65 %)**,
**C4 S1 (58,86 %)**; pozostałe warianty — żadna. Przyczyna na S1 (Głogowniki): atrament 224 i 280 przeniesiony na odcinki
47 px i 60,5 px wybrane skalą dla korekt `110→120` i `180→160`.

## G. Wyniki pełnego solvera i bramki (48 wierszy; znane dobre = 21 PASS C0 ∪ kontrolki)

| wariant | PASS | ukończone | G1 (znane dobre zmienione) | G2a | G2a′ | G2c (nowe fałszywie pewne) | G3 (zmiany) | G5 (zmienione odmowy/ścieżki) | kwalifikowalny |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C0 | 21 | 26 | — | 627* | — | — | — | — | — |
| C1 | 17 | 26 | **14** | 0 | 43 | 4 | 36 | 13 | **nie** |
| C2 | 18 | 24 | **14** | 420 | 91 | 3 | 63 | 14 | **nie** |
| C3 | 21 | 26 | **3** | 448 | 0 | 0 | 11 | 4 | **nie** |
| N1 | 21 | 25 | **9** | 468 | 119 | 0 | 26 | 6 | **nie** |
| C4 | 16 | 22 | **17** | 0 | 0 | 4 | 69 | 19 | **nie** |
| C1N1 | 18 | 26 | **15** | 0 | 51 | 3 | 43 | 11 | **nie** |

\* C0: wszystkie wiersze, w tym 57 na 3 wierszach legacy. G2b (atrament ≠ odczyt zespołu) = 0 we wszystkich; G2d (więcej
SOURCE_EXACT) = 0 we wszystkich.

**Werdykty zmienione względem C0:** C1 — `dom-w-daliach`, `dom-w-tymianku`, `kosacce-clean`, `kosacce-tracked` PASS →
ALGORITHMIC_FAIL; C2 — morelach, tymianku, marcowki; C4 — daliach, morelach, tymianku, marcowki, rarytasy-g2e; C1N1 —
jak C1 plus `dom-pod-jarzabem` ALGORITHMIC_FAIL → PASS; C3, N1 — żaden.

**Bezpieczeństwo tarasów, okien, drzwi i kondygnacji (G1/G3):** liczba kondygnacji nie zmienia się w żadnym wariancie na
żadnym znanym dobrym wierszu; zmiany dotyczą otworów (szerokości/rodzaju/ściany), ścian, pomieszczeń, tarasów
(`marcowki`, `rarytasy-g2e`, `dom-pod-jarzabem` pod C1/N1) i pola. Pełne listy: `safety-gates/*-gates.json`.

**Ruchy rejestracji niewidoczne dla G2c** (`paired-matrix.json` → `registrationMovesOver3pct`; opisowe, nie bramka): pole
domu pochodzi z wypowiedzi na drabinie siatki, a nie z rejestracji, więc rejestracja może się rozjechać przy „dobrym” polu.
C1: `rarytasy-g2e` X +45,5 % (anizotropia 0,002 → 0,31; PASS zostaje), `dom-w-cyklamenach` Y +70 % (anizotropia 0,70;
wiersz po raz pierwszy *kończy się* z −0,2 %), `dom-pod-jarzabem` X/Y +51/+55 %. N1: `dom-pod-jarzabem` +55 %. C4:
`rarytasy-g2e` X +182 %, `dom-w-glogownikach` X +59 %. To są fałszywie pewne skale w sensie kontraktu, choć G2c (zdefiniowane
przez pole i arkusze prawdy) ich nie widzi — **wniosek NONE nie zależy od tego**, bo każdy z tych wariantów i tak przegrywa G1.

**G5:** każda zmieniona odmowa/ścieżka decyzji wyjaśniona z pierwszej różniącej się decyzji i z rejestracji
wybranej ramki (`house-semantic-delta/G5-explanations.json`): REGISTRATION_LOST (np. C1 `dom-pod-jarzabem`,
`dom-w-glogownikach` — ramka, której wszystkie kotwice były korektami, traci rejestrację), REGISTRATION_MOVED,
STATEMENTS_ONLY (zmienione wartości wypowiedzi przy tej samej rejestracji — np. C1 `kosacce-clean` +11,2 % przy mpp bez
zmian). Kod rekonstrukcji (w tym 005P N1a) jest bajt w bajt produkcyjny w każdym wariancie (żadna łatka go nie dotyka —
test architektury).

## H. Proweniencja (45 wierszy EXTRACT)

| wariant | kotwice READ | kotwice INK_FIRST | kotwice CC/zależne od skali | dowód LINEAR: READ / INK_FIRST / CC / DERIVED |
| --- | --- | --- | --- | --- |
| C0 | 413 | 0 | 570 | 530 / 0 / 536 / 1108 |
| C1 | 402 | 127 | 0 | 530 / 262 / 274 / 1108 |
| C2 | 342 | 0 | 420 | 457 / 0 / 393 / 702 |
| C3 | 371 | 0 | 448 | 522 / 0 / 539 / 1110 |
| N1 | 402 | 0 | 468 | 662 / 0 / 443 / 1087 |
| C4 | 312 | 93 | 0 | 452 / 173 / 222 / 702 |
| C1N1 | 531 | 51 | 0 | 662 / 182 / 261 / 1087 |

(`source-provenance/provenance.json`; kotwice READ+dependsOnScale liczone jako zależne od skali — suma tej kolumny to G2a; w dowodzie LINEAR kolumna READ obejmuje READ+dependsOnScale.)

## I. Mutacje (G7)

⟪MUT⟫

## J. Koszt (G6)

Pomiary tylko w obciążeniu (3 procesy na 4 vCPU, Node 22.22.2, WASM 1 wątek; warianty z ACCEL): mediana ekstrakcji C0
452,6 s (bez ACCEL), warianty 99,6–181,5 s (z ACCEL — nieporównywalne z C0), solver 16,7–22,1 s; szczyt RSS ekstrakcji
≤ 1,2 GB, solvera ≤ 0,76 GB. Żaden kandydat nie przeszedł G1–G5, więc prerejestrowane nieobciążone A/B/B/A **nie było
uruchamiane**; Node 18 i telefon ARM64 — **UNMEASURED** (`performance/performance.json`).

## K. Recenzje

⟪REVIEWS⟫

## L. Testy, zamrożenie, CI

⟪TESTS⟫

## M. Rekomendacja i ograniczenia

**ADOPTION_RECOMMENDATION: NONE** (`recommendation/recommendation.json`). Zasada §6: wariant przegrywający którąkolwiek z
G1–G5 jest `NOT_ADOPTION_ELIGIBLE`; zysk na etykietach nie uzasadnia wdrożenia, gdy topologia domu się pogarsza.

Czego ten etap uczy:
1. Samokotwiczenie (D3) jest prawdziwe i powszechne, ale **usunięcie go samo nie wystarcza**: wartości dobrane do skali są
   dziś *spójne* z odcinkami dobranymi do skali; atrament jest prawdziwszy, lecz trafia na odcinek, którego nie mierzy.
   Kolejność naprawy musi być: odcinek z geometrii (D5) → wartość z atramentu (D4) → kotwica (D3), nie odwrotnie.
2. C2 w obecnej postaci jest zbyt ostry: odcina wypowiedzi (powiązane bez wypowiedzi 25 → 39) i nic nie daje na
   etykietach; jako warunek dla C1 (C4) nie wystarcza, bo C4 nadal przegrywa G1 i ma fałszywą skalę S1.
3. N1 trafia w realne wąskie gardło (D7) i jako jedyny poza C3 nie zmienia żadnego werdyktu, ale bez zmiany
   autorytetu kotwic zostawia samokotwiczenie (G2a 468).
4. Pole domu nie jest dobrym strażnikiem skali: rejestracja potrafi przesunąć się o +45–182 % przy niezmienionym polu.

Ograniczenia: prawda etykiet nie była przeglądana przez człowieka (§K, LABEL_TRUTH); bliźniaki 9–12 są **rozwojowe**, nie
świeże ślepe; Muraje, Goździkowce i Głogowniki są wierszami rozwojowymi tego samego zestawu; wpływ na Node 18/ARM64 niezmierzony.

## N. Handoff

⟪HANDOFF⟫
