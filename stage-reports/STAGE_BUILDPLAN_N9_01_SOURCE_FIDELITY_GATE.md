# STAGE BUILDPLAN N9-01 — systemowy werdykt jakości modelu (source fidelity gate)

## Podstawowe dane

**Wersje i baza:**
- Gałąź: `claude/new-session-3kzcgh`.
- Baza: `3a625f1` (N9-00).
- Solver 2.17.0, model CanonicalBuildingModel 1.7.0 i czytnik metryk 1.5.0 pozostały **bez zmian**.
- Usługa analizy: 1.2.0 → **1.3.0** (odpowiedź addytywna).

**Artefakty i ZIP:**
- Artefakty tekstowe: `stage-reports/artifacts/analyzer-n9-01/`.
- ZIP dla OWNER-a (plansze z rysunkami ARCHON, tylko poza repozytorium): `BuildPlan-N9-01-Source-Fidelity-Before-After.zip`.

## 1. Co się zmieniło

Jeden przebieg `runAnalysis` zwraca teraz pole `assessment`. Liczy je produkcyjny kod (`packages/analysis-service/src/assessment/`), wywoływany w `run.ts` w etapie VERIFYING. Działa na **wyemitowanym modelu i skompilowanej scenie**, po replay i audycie złączy. Pole składa się z trzech osobnych osi i budżetu:

| oś | co mówi | czego nie mówi |
|---|---|---|
| `technicalValidity` | Odmowy programu, ponowna walidacja dostarczonego modelu, diagnostyka kompilatora (dotąd pomijana w `run.ts`), audyt złączy, replay. Audyt złączy jest stopniowany tak, jak run go zawsze bramkował: ERROR zewnętrzny to błąd; wewnętrzne szczeliny to ostrzeżenia z zachowaną oryginalną etykietą (`auditSeverity`). | 0 ERROR ≠ zgodność z projektem |
| `decompositionCompleteness` | Dotychczasowy werdykt `modelCompleteness` bez zmiany algorytmu (COMPLETE / COMPLETE_WITH_OPEN_QUESTIONS / PARTIAL). | W UI podpisany „kompletność odczytu (dekompozycji)”, nie „zgodność architektury” |
| `sourceFidelity` | Relacje R1, R3, R4, R5. Każdy element ma status PASS / CONFLICT / UNCHECKED, obiekt, źródło (frame, arkusz, kondygnacja), pomiar, tolerancję, zasięg, kod i uzasadnienie. | UNCHECKED ≠ PASS; CONFLICT nie wycofuje modelu |
| `sourceUnchecked` | Każda elewacja, przekrój, rzut, kondygnacja i oś rejestracji, której żadna relacja nie porównała, z powodem i tym, co mogłaby sprawdzić. | — |

`previewAvailable: true` zawsze: model 3D jest dostarczany i otwierany niezależnie od ocen. `WALLS_OVERLAP`, walidator, solver, odczyty źródłowe i kontrakt modelu są nietknięte.

## 2. Relacje (szczegóły i przykłady: `RELATIONS-R1-R3-R4-R5.md`)

**R1 — dach w dachu (skompilowana geometria).**
- Promienie pionowe na siatce 0,1 m.
- CONFLICT tylko wtedy, gdy wszystkie warunki są spełnione:
  - niższa połać leży w całości pod wyższą;
  - wewnątrz obrysu ścian/stropów kondygnacji, którą wyższa przykrywa;
  - powyżej jej podłogi;
  - także w pierścieniu 0,2 m wokół (wspólna krawędź, kosz, uskok nie są nakładaniem).
- Dach nad podcieniem lub garażem pod okapem, poza ścianami, to LAYERED (legalny).
- Przypadek nierozstrzygalny to UNCHECKED, nie CONFLICT.

**R3 — ściana modelu na tuszu rzutu (MODEL→SOURCE).**
- Stacje wzdłuż ściany, profil w poprzek pasma, czytany tą samą definicją tuszu co czytnik rzutu.
- Klasy stacji: BAND / THIN / BLANK. Otwory modelu są wyłączone.
- CONFLICT `WALL_ON_BLANK_PAPER`: odcinek dochodzący do końca ściany (lub cała ściana) na papierze bez tuszu, dłuższy niż 2 grubości + 2 tolerancje.
- Luka z rysowaną ścianą w linii po obu stronach to `DRAWN_GAP_NOT_MODELLED`, czyli pytanie o otwór, nie konflikt ściany.
- Same cienkie kreski (szkło, krawędź płyty, wymiar) to UNCHECKED.
- Rejestracja jest sprawdzana samym modelem: gdy < 50 % stacji ścian zewnętrznych trafia w rysowaną ścianę, cała kondygnacja jest UNCHECKED (`REGISTRATION_NOT_CORROBORATED`). Zła skala, lustro lub zła kondygnacja nie dają więc twardego alarmu.
- Tolerancje wynikają z arkusza: piksel, mediana grubości prawdziwych ścian, pasmo zmierzone przez czytnik. Nie ma progu „X % ciemnych pikseli”.

**R4 — obrys każdej kondygnacji (SOURCE→MODEL).**
- Gruby tusz arkusza danej kondygnacji (otwarcie maski o pół pasma ściany: znikają tekst, wymiary i meble) połączony z modelowaną kondygnacją.
- Część dalej niż 2 ściany + tolerancja od obrysu, z ≥ 4 grubościami pasma, to CONFLICT `DRAWN_WALLS_BEYOND_STOREY`.
- Zarejestrowany arkusz kondygnacji, której model nie buduje, z zamkniętym obrysem nad kondygnacją niżej, to CONFLICT `STOREY_DRAWN_NOT_MODELLED`. W innym przypadku UNCHECKED, nigdy PASS.

**R5 — zarejestrowane elewacje.**
- Rezydua `verifyAgainstViews` są rozdzielone na: odczytane w tolerancji, odczytane poza tolerancją, „nie zaobserwowane” (dotąd liczone jako niezgodność) oraz sprawdzenia otworów, których dostarczony model nie zawiera.
- CONFLICT: ≥ 2 cechy poza tolerancją i ≥ 1/3 odczytów (dotychczasowy próg DISAGREES, nie stroiłem go).
- PASS z adnotacją `MODEL_ANCHORED`: każde sprawdzenie szuka krawędzi przy przewidywaniu modelu, więc zgodność nie jest niezależnym potwierdzeniem.
- Widok niezarejestrowany lub częściowo zarejestrowany to UNCHECKED, z zasięgiem osi.
- Facade alignment jest dołączony tylko jako dowód.

## 3. Wynik 8 domów (produkcyjny `runAnalysis`, zapieczętowane wejścia)

Te same zapieczętowane wejścia (pakiet + graf obserwacji) przeszły przez `runAnalysis` dwa razy: na bazie `3a625f1` i na N9-01. **Hash kandydata, modelu, sceny (content i sha256) i dowodów metrycznych jest identyczny w 8/8 domach** (`model-hashes.json`).

| dom | stary werdykt (= kompletność odczytu) | techniczna | zgodność ze źródłem | R1 | R3 | R4 | R5 | niesprawdzone |
|---|---|---|---|---|---|---|---|---|
| Jarzmianki A01 | COMPLETE_WITH_OPEN_QUESTIONS | ERRORS (1 złącze zewn.) | UNCHECKED | PASS | UNCHECKED | PASS | UNCHECKED | 17 |
| Goździkowce 3 | COMPLETE_WITH_OPEN_QUESTIONS | VALID | UNCHECKED | PASS | UNCHECKED | PASS | UNCHECKED (4/4 niezarejestr.) | 27 |
| Marcówki GE | COMPLETE_WITH_OPEN_QUESTIONS | ERRORS (4) | UNCHECKED | PASS | UNCHECKED | PASS | UNCHECKED | 15 |
| Cieszynianki 12 | COMPLETE_WITH_OPEN_QUESTIONS | VALID | UNCHECKED | PASS | UNCHECKED | PASS | UNCHECKED | 27 |
| **Rarytasy 5** | **COMPLETE** | ERRORS (2) | **CONFLICT** | PASS | PASS | PASS | **CONFLICT ×3** | 30 |
| Trytomach | COMPLETE_WITH_OPEN_QUESTIONS | ERRORS (2) | **CONFLICT** | PASS | UNCHECKED | PASS | CONFLICT ×1 | 19 |
| Arganiach | COMPLETE_WITH_OPEN_QUESTIONS | ERRORS (3) | UNCHECKED | PASS | PASS | PASS | UNCHECKED | 28 |
| Sasanki 3 | COMPLETE_WITH_OPEN_QUESTIONS | ERRORS (1) | **CONFLICT** | PASS | UNCHECKED | PASS | CONFLICT ×2 | 20 |

Pełne powody per dom: `BEFORE-AFTER-VERDICT.md`. Budżet niesprawdzonego: `UNCHECKED-BUDGET.md`.

**Rarytasy** (dotąd COMPLETE) mają 3 konflikty elewacji:
- LEFT: parapet −0,68 m i szerokość sylwetki.
- FRONT: krawędź dachu i otwór front-4-0.
- REAR: krawędź dachu i otwór rear-2-3.
- Czwarty widok (RIGHT) to PASS model-anchored na 2 odczytach. N9-00 liczył go jako DISAGREES tylko z powodu wiersza „nie zaobserwowano”.

**Pozostałe obserwacje:**
- Błędy techniczne to **zewnętrzne błędy złączy**, już wcześniej zgłaszane jako LIMITING `EXTERIOR_JOINTS` (np. pergola–ściana A01, połać–ściana Rarytasy). Teraz trafiają do osi technicznej. Szczeliny wewnętrzne (1,5–4 cm) są ostrzeżeniami.
- R3 UNCHECKED w 5 domach to krótkie odcinki (`NOTHING_TO_READ`) i jedna ściana kolankowa poddasza A01 rysowana cienko. **0 konfliktów R3 i R4 na dzisiejszych modelach.** Klasy N8 #3, #4, #6 zostały naprawione w N8, więc to oczekiwany wynik. Nie mierzyłem, czy R3/R4 wykryłyby je na starych modelach: ich ramek rejestracji nie da się odtworzyć bez starego solvera (`NOT_MEASURED`).
- Goździkowce: 4/4 elewacje niezarejestrowane, więc UNCHECKED i w budżecie, nigdy PASS.

## 4. Kontrast historyczny R1 (produkcyjna funkcja na plikach modeli)

| model | R1 | podwójny dach (surowo / poza tolerancją) |
|---|---|---|
| Sasanki 3 przed N8-03C (2.14.0) | **CONFLICT** ×2 | 7,80 + 7,80 = **15,60 m²** / 4,35 + 4,06 m² |
| Rarytasy 5 przed N8-03C (2.14.0) | **CONFLICT** ×2 | 5,95 + 5,50 = **11,45 m²** / 2,53 + 1,35 m² |
| Sasanki 3, Rarytasy 5 dziś | PASS | 0 |

Pole surowe zgadza się co do m² z sondą N8-03C. Plansza `boards/roof/roof-layers.png` jest w ZIP-ie. Progów nie strojono do tych domów: tolerancje to 2 kroki siatki i 5 cm.

## 5. Testy

**Testy syntetyczne** (`packages/analysis-service/test/assessment-n9-01.test.ts`, 24/24 PASS). Każdy przypadek łamie jedną relację:
- model poprawny: PASS;
- brakujące piętro: R4 CONFLICT;
- ściana na białym papierze (otwarty styk z garażem): R3 CONFLICT tylko dla tej ściany;
- prawdziwe drzwi lub brakujące drzwi w modelu: PASS z nazwaną luką;
- ściana szklana cienką kreską: UNCHECKED;
- rama przesunięta o 1,5 m: UNCHECKED, 0 CONFLICT;
- dorysowane skrzydło: R4 CONFLICT z odległością;
- podwójna połać: R1 CONFLICT;
- legalny dach nad podcieniem pod okapem: LAYERED/PASS;
- niższe skrzydło: brak konfliktu;
- niezgodna elewacja: R5 CONFLICT;
- „nie zaobserwowano”: nie jest niezgodnością;
- elewacja bez rejestracji: UNCHECKED i w budżecie;
- ERROR kompilatora: ERRORS;
- dwie sceny 005T OWNER-a: 1 i 8 × `OPENING_ABOVE_WALL_TOP` w osi technicznej, bez zmiany ich geometrii.

**Fałszywe alarmy:** na syntetycznych negatywach 0 twardych alarmów. Odsetka fałszywych alarmów na niezależnie oznaczonym realnym holdoucie nie mierzyłem (**NOT_MEASURED**). Nie deklaruję też liczby wykrytych klas N8 na danych realnych.

**Kontrakt i UI:**

| test | wynik |
|---|---|
| `apps/analyzer-api/test/android-contract.test.ts` (nowy, przejrzany snapshot `analyzer-contract-current/` + test, że żadna ścieżka starego snapshotu 2.3.0 nie zniknęła + trzy osie w wyniku) | 3/3 PASS |
| Kotlin `:app:testDebugUnitTest`: `CurrentServerContractTest` (cały job na dzisiejszych bajtach, assessment sparsowany, scena zapisana i otwarta) | 1/1 |
| Kotlin: `RealServerContractTest` (stare bajty) | 2/2 |
| Kotlin: `AnalyzerContractTest` | 12/12 |
| Kotlin: `ResultHeadlineTest` (+3 przypadki N9-01) | 10/10 |
| Web: `apps/web/src/analyzer` | 18/18 |
| Web e2e `analyzer.spec.ts` (prawdziwy serwer API, panel pokazuje trzy osie, „Open model” działa) | 4/4; zrzut `stage-reports/artifacts/analyzer-api/web-analyzer-assessment-n9-01.png` (syntetyczny dom) |
| APK, testy instrumentalne, lint Androida, urządzenie | **NOT_RUN** |

Telefon nie był testowany na urządzeniu.

**Typecheck i zestaw celowany:**
- Typecheck (root + web): czysty.
- Zestaw celowany TS: 497 PASS, 12 FAIL.
- **Te same 12 porażek występuje na bazie `3a625f1`**, więc nie są nowe:
  - `/health` przypina solver 2.5.0;
  - testy 005Q wymagają w klonie commitu bazowego `04d5568`;
  - testy izolacji badań.
- Pełnego CI nie uruchamiałem.

## 6. Ograniczenia (powiedziane wprost)

- R3/R4 porównują model z arkuszem, z którego go odczytano. Widzą błędy emisji i pominięte ściany, nie są niezależnym pomiarem.
- R3 nie wykrywa podwojonej ściany w jednym paśmie (klasa N8 #5).
- R4 nie widzi ścian rysowanych cienko ani tuszu niepołączonego z kondygnacją.
- R5 nie rejestruje nowych widoków (to N9-02) i nie rozstrzyga MISSING_IN_MODEL (to R6).
- Przekrój jest zawsze UNCHECKED dla geometrii stropu, nawet gdy jego rzędne posłużyły do wysokości.

## 7. Zmienione pliki

**Usługa analizy:**
- Nowe: `packages/analysis-service/src/assessment/` (`types`, `technical`, `roof-layers`, `plan-ink`, `plan-geometry`, `elevations`, `unchecked`, `index`).
- Zmienione: `run.ts` (wpięcie + wersja 1.3.0), `result.ts` (pole `assessment`).

**Web:**
- Nowe: `apps/web/src/analyzer/assessment.ts` (+ test).
- Zmienione: `Analyzer.tsx`, `client.ts`, `e2e/analyzer.spec.ts`.

**Android:**
- Nowe: DTO `analyzer/ModelAssessment.kt`, `CurrentServerContractTest.kt`.
- Zmienione: `AnalyzerDtos.kt`, `AnalyzerScreen.kt` (`AssessmentDetails`, nagłówek), `strings.xml` (polskie etykiety; „Kompletność odczytu (dekompozycji)”), `ResultHeadlineTest.kt`.

**Kontrakt:**
- Nowe: `apps/analyzer-api/test/support/contract-shape.ts`, katalog `apps/android/app/src/test/resources/analyzer-contract-current/`.
- Zmienione: `android-contract.test.ts`, `scripts/capture-android-contract.ts`.
- Stare fixture'y `analyzer-contract/` są nietknięte.

**Sondy (tylko do odczytu):** `research/analyzer-n9-01/` (`aggregate.ts`, `boards.ts`, `r1-history.ts`, `synthetic-board.ts`).

**STOP.** Etapu N9-02 nie rozpoczynałem.

Status: **PASS_N9_01**
