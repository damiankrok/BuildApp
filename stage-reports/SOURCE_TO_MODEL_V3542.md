# SOURCE_TO_MODEL v3.54.2: API jako konsultant i kontroler analizatora

**Kontekst etapu**
- Brief OWNER-a v3.54.2 i Master Plan v3.54.2 (`docs/MASTER_PLAN.md`).
- Gałąź `claude/new-session-3kzcgh`.
- Protokół zapieczętowany przed pierwszym wywołaniem API: `stage-reports/artifacts/v3542/PROTOCOL_V3542.md` + `PROTOCOL.seal`.
- Kandydat zamrożony przed próbą potwierdzającą na `d427df8` (aneks 1).
- Kolejność etapów: A (baza) → B (3 domy, luki) → C (6 DEV, kandydat) → D (4 CONFIRM_KNOWN).

**Statusy**

| Status | Wartość | Uzasadnienie |
|---|---|---|
| PILOT_EXECUTED | **TAK** | 10 domów; 50 płatnych odpowiedzi API na żywo (+1 przerwane); rzeczywisty konsument w analizatorze |
| INTEGRATION_VERIFIED | **TAK, w ścieżce usługi** | Korekty prześledzone od pytania do rozwiązania metrycznego, planu i modelu/odmowy. Odtworzenie zapisanych odczytów daje ten sam hash modelu co pętla. Host jest okablowany za flagą (test), ale **nie** uruchomiony end-to-end z HTTP i pobraniem strony |
| QUALITY_GAIN | **NIE** na ocenianej geometrii | 0 domów z lepszym rozmiarem/IoU/kalenicą (DEV 6, CONFIRM 4). Jest zysk weryfikacji: Kukliki — ten sam poprawny model, skala INCONCLUSIVE → SUPPORTED |
| TRANSFER_EVIDENCE | **CZĘŚCIOWE** | Mechanizm przenosi się na rodziny spoza strojenia: poprawne odczyty i ustalona skala na 2 z 4 domów CONFIRM (Aksamitki, sp318422 — w tym jeden spoza ARCHON); przy Puszku odczyty poprawne, ale skala odrzucona — końce przyciągnięte różnią się o 3,9 %. Zysk jakości się **nie** przenosi, a jedno przyjęcie było **fałszywe** (sp318422: odmowa → model ze złą głębokością) |
| ANDROID_VERIFIED | **NOT_VERIFIED** | Brak urządzenia; bez APK — aplikacja się nie zmieniła |

Statusy opisują zamrożonego kandydata `d427df8`. Rozwój po potwierdzeniu (kontrola zasięgu, poprawka składania planu, Aksamitki → model) i równoległe wyglądy aplikacji są w **Dodatku** na końcu raportu i tych statusów nie zmieniają.

## 1. Werdykt

**Co konsultant poprawia.** Ustala skalę rzutu tam, gdzie analizator jej nie ustalił. Dokładnie odczytuje wydrukowane etykiety i wymiary całkowite, łącznie z ft-in i metrami z przecinkiem.
- **Poprawne skale (z dwóch zgodnych wymiarów lub etykiet):**
  - Supertunie: INCONCLUSIVE → STRONG 2,2425 cm/px;
  - Kukliki: INCONCLUSIVE → SUPPORTED 1,562 cm/px, potwierdza skalę, której LOCAL użył bez potwierdzenia;
  - Madera: skala dopasowana do pola (≈7,0) → prawdziwa 4,59–4,62 cm/px;
  - Aksamitki: INCONCLUSIVE → SUPPORTED;
  - sp318422: odmowa → SUPPORTED 1,666 cm/px.
- **Potwierdzenia ustalonej skali LOCAL:** Torenie (4 wymiary) i Supertunie (2 wymiary), wszystkie AGREES_ONLY.

**Co tylko wykrywa.** Kontrola po budowie (4B) znalazła rzeczywiste wady na 5 z 6 kontrolowanych modeli. Na kontroli (Kukliki) nie zgłosiła żadnego fałszywego alarmu: VERIFIED_IN_SCOPE z listą sprawdzonych i niesprawdzonych cech. Znalezione wady:
- Madera: brak garażu, dach z poprzecznym szczytem.
- Torenie: taras/pergola zbudowane jako zamknięta bryła (to przypadek „fałszywego domknięcia podcienia” z briefu, wykryty bez podpowiedzi), zamiana elewacji L/P, brak drzwi wejściowych.
- plan23-504: brak garażu i ganku, płaskie dachy.
- sp318422: brak bramy garażowej, dach.

Żadna z tych rodzin (ASSIGN_VIEW, ROOF_FORM, OUTLINE_REGION, OPENING, MISSING_ELEMENT) nie ma konsumenta, więc wszystkie zapisano jako CAPABILITY_MISSING.

**Co pogarsza.** W wyniku DEV — nic: transakcja nie wpuściła żadnej regresji. W CONFIRM — jedno **fałszywe przyjęcie**:
- sp318422: odmowa zamieniła się w model na poprawnie ustalonej skali (46'-0" = 14,02 m i 31'-5" = 9,58 m, dokładnie jak w referencji);
- ale kompozycja planu analizatora wyszła na 13,88 × 16,03 m (głębokość +67 %, IoU 0,39);
- reguła przyjęcia sprawdza tylko ustalenie skali, nie zgodność zbudowanego zasięgu z tymi samymi wymiarami.

Zgodnie z protokołem kandydata nie zmieniono po zobaczeniu wyniku. To pierwsza rekomendacja (§13, §14).

**Czy analizator nadal sam buduje model?** Tak:
- każdy model w pilocie zbudował analizator;
- konsultant zmienia tylko to, jak odczytano wskazaną etykietę, i dostarcza zmierzone przez analizator rozpiętości wymiarów;
- gałąź globalnego opisu jest wyłączona konstrukcyjnie i w hoście; ślad: pierwsze zdarzenie każdego przebiegu `globalDescription DISABLED`.

**Gdzie ginie poprawka.** Odczyty API są poprawne; poprawka ginie za skalą:
- wykrycie struktury wymiarów: brak etykiety, fragment linii, brak linii;
- kompozycja planu przy prawdziwej skali: Supertunie i Aksamitki odmawiają przy envelope/grid; Madera pokrywa 104 z 203 m², więc ROLLBACK; sp318422 przeszacowuje głębokość;
- brak konsumentów dla poprawek po budowie.

## Weryfikacja faktów v3.54.1 (brief §1)

- **FINAL 5/12 vs 12/12.** Potwierdzone: LOCAL 5 modeli z 12; ścieżka opisu 12 z 12. „9 popraw” to poprawy per dom, nie 9 poprawnych domów: w 9 są poprawy, ale część domów nadal ma WRONG.
- **H1 bez aktywacji na FINAL.** Potwierdzone z zapisów v3.54.1 (0 aktywacji). Wynik FINAL nie dowodzi skuteczności lokalnej korekty.
- **Kukliki: rozmiar odczytany, utracony w bryle.** Potwierdzone:
  - czytnik podał 756×876;
  - builder narysował bryły 6,2×7,6, bo przeskalowanie wymaga zgodności współczynnika ≤ 5 % na osi;
  - poprawny obrys LOCAL (IoU 1,00) zastąpiono mniejszym.
- **Madera i plan5-737: przycięcia brył i zwężenia otworów w builderze opisu.** Potwierdzone:
  - Madera: garaż BODY_CLIPPED, brama 2,80 → 1,80;
  - plan5-737: 2 × BODY_CLIPPED, brama 2,70 → 1,60, OPENING_DROPPED.
- **Kukliki: REAR/RIGHT.** Zamiana dotyczyła opisu B: obraz „elewacja-boczna” oznaczony jako REAR. Referencja jest zgodna z rzutem: tył = okno 240/140, prawa = dwoje drzwi 160/220. Kontrola 4B v3.54.2 na modelu LOCAL przypisała elewacje poprawnie i potwierdziła ten układ.
- **Punktacja kalenicy Kuklików była artefaktem scorera v3.54.** Dach kopertowy dawał „MIXED/NA”, liczone jako zła kalenica. W modelach A i B obecna jest krawędź RIDGE przód–tył zgodna z referencją.
  - Nowy `roof_axis.py` (kalenica najpierw z krawędzi RIDGE; 9 syntetycznych przypadków) zmienia przeliczenia:

    | Zbiór / wariant | Kalenice poprawne przed → po |
    |---|---|
    | S30, B | 16 → 19 |
    | S30, H1 | 16 → 19 |
    | FINAL, H1 | 4 → 7 |
    | FINAL, A | 1 → 2 |

  - Zła kalenica Madery w B jest prawdziwa.
- **IoU na wspólnej grupie.** Odtworzone **0,682 → 0,784** (A → H1) scorerem v3.54.1, który wybiera najlepszy z 4 obrotów i szuka przesunięcia ±1,5 m.
  - N = 4: Kukliki, Madera, Miodowy, plan23-504 — jedyne domy FINAL z modelem LOCAL i obrysem w referencji.
  - W stałej ramie v3.54.2 (bez obrotu i bez szukania przesunięcia) te same 4 domy: 0,615 → 0,708 (mediany 0,539 → 0,702).
  - „0,68 (n = 4) → 0,86 (n = 11)” z raportu v3.54.1 miało różne mianowniki.

## 2. Stan i reprodukcja

**Wersje i pliki**

| Element | Wartość |
|---|---|
| Gałąź | `claude/new-session-3kzcgh` |
| Baza | `b740118` (v3.54.1 + scorer v3.54.2) |
| Protokół | zapieczętowany `53eec3a` (`stage-reports/artifacts/v3542/PROTOCOL_V3542.md`, `PROTOCOL.seal` = `9dff43f6…`) |
| Kandydat | zamrożony `d427df8` (aneks 1 protokołu) |
| Raport | końcowy HEAD gałęzi |
| Master Plan | v3.54.2 w `docs/MASTER_PLAN.md` (`02951ed`, sha256 `7ebdcd4e…`) |
| Analizator | service 1.11.0, solver 2.43.0 |
| Kontrakt konsultanta | 0.1.0 |
| Prompt | 0.1.0 (etap B), 0.2.0 (etap C/D: + READ_DIMENSION) |
| Konsumenci | `metrics.consulted-reading` 0.1.0, `metrics.consulted-spans` 0.1.0 |
| Model API | `claude-sonnet-5-5` (ten sam co czytnik v3.54.1; cennik 2/10 USD za MTok sprawdzony w referencji claude-api 2026-11-16) |

**Flagi i entrypointy**
- Pakiet: `consultAnalysis(input, options, wiring)` (`packages/analysis-service/src/consult/consult-analysis.ts`) — ścieżka usługi pilota.
- Host: `executeJob` w `apps/analyzer-api/src/executor.ts`.
  - Z `wiring.consultant` i zgłoszeniem z tokenem pilota → `consultAnalysis` zamiast `analyseLink`.
  - `productionWiring`: `ANALYZER_CONSULTANT=pilot` + `ANALYZER_HOUSE_READER_MAX_USD` + `ANALYZER_HOUSE_READER_TOKEN` (≥ 24 znaki).
  - Konsultant zastępuje czytnik domu; obu razem nie ma. Domyślnie wyłączone (test `consultant-wiring-v3542.test.ts`).
- Opcje analizatora (domyślnie nieobecne = bajt w bajt jak przed etapem):
  - `AnalysisOptions.consulted`
  - `AnalysisOptions.consultedSpans`
  - `AnalysisOptions.crossAxisWitness`
- Sprawdzone, że domyślna ścieżka daje te same hashe modelu i dowodów metrycznych:
  - `12c9ace7…` Madera i `contentHash` metric evidence identyczny;
  - A = A′ na sześciu DEV.

**Polecenia** (klucz tylko w środowisku procesu, nigdy w argumentach)

```
# LOCAL (A) i A′
OFFLINE=1 npx vite-node packages/analysis-service/scripts/second-house.ts -- --package <pkg> --cache <cache> --out <dir> --content --recogniser --views [--cross-axis]
# konsultacja na żywo (C; R = te same odpowiedzi bez konsumpcji)
BUILDPLAN_ANTHROPIC_API_KEY=… npx vite-node research/source-to-model/v3542/consult-run.ts -- --list <lista> --out <dir> --variant C --books <księgi> --max-usd 24.11036 --phase <etykieta>
# odtworzenie zapisanych odpowiedzi przez zamrożony kod (bez sieci, bez kosztu)
npx vite-node research/source-to-model/v3542/consult-run.ts -- --list <lista> --out <dir> --replay <dir z events.jsonl> --max-rounds 1 --no-model-check
# standardowe artefakty (model, widoki, nakładki) z odczytów skonsumowanych
/home/user/rd/v3542/replay-c.sh <lista> <dir konsultacji> <dir wyjścia>   (second-house --consulted … --consulted-spans … --cross-axis)
# ocena
/usr/bin/python3 -I research/source-to-model/v3542/score.py --selftest
/usr/bin/python3 -I research/source-to-model/v3542/score.py --dir <wariant> research/source-to-model/v3541/refs-final research/source-to-model/v3541/refs-s30
```

**Źródła**
- Zapieczętowane pakiety v3.54.1 (`research/source-to-model/v3541/sources/`, `INDEX.json`).
- Bajty w prywatnych cache'ach (`/home/user/rd/v35310/trial/cache`, `/home/user/rd/v3535/trial/cache`, `/home/user/rd/v3541/final/cache`).
- Nic nie pobierano od nowa.
- Odtworzenie bajtów w nowej sesji: `research/source-to-model/v3541/restore.py` (hash każdego obrazu).

## 3. Mapa współpracy

```
źródło (zamrożone bajty) ──► LOCAL: runAnalysis ──► graf obserwacji ──► dowody metryczne ──► plan ──► model ──► scena
                                                             │ (odmowa albo skala niepotwierdzona)
                                                             ▼
                                  problems.ts: etykiety wybranego rzutu bez odczytu CLEAR / nazwane przez rozwiązanie metryczne
                                                             ▼
             loop.ts krok 1: przegląd + kadry etykiet ──► API (get_source_region ≤ 4/runda) ──► submit_review
             loop.ts krok 2: odczyty czytników, rozpiętości, skale ──► API ──► submit_review (końcowe propozycje)
                                                             ▼
              validateProposals: składnia, id, rewizja, jednostka, dowód, kierunek odczytu, niepewność, limity
                                                             ▼
             READ_LABEL ──► consulted.ts: trzeci świadek etykiety (asRead, klasa, rywal)   ─┐
             READ_DIMENSION ──► consulted-spans.ts: końce przyciągnięte do kresek rzutu,    ├─► metric solver (bez zmian
                                wartość parsowana przez analizator, skala tylko z 2 zgodnych ┘    reguł) ──► plan ──► model
                                                             ▼
             compareRuns: ACCEPT / ROLLBACK / PARTIAL / NO_CHANGE  ──► wynik (zaakceptowany albo LOCAL)
                                                             ▼
             checkModel (4B): rzut + elewacje wydawcy + 9 widoków modelu ──► obserwacje i propozycje
                              (ASSIGN_VIEW / ROOF_FORM / OUTLINE_REGION / OPENING / MISSING_ELEMENT → CAPABILITY_MISSING)
```

**Gałąź globalnego opisu (B/H1).** W ścieżce konsultanta jest wyłączona konstrukcyjnie:
- `consultAnalysis` nie przyjmuje `houseReader`;
- każdy przebieg zapisuje jako pierwsze zdarzenie `PATH … globalDescription DISABLED`;
- host: `consultant` zastępuje `houseReader` (test).

**Odmowy.** Pierwsza odmowa LOCAL idzie do konsultacji tak samo jak model z niepotwierdzoną skalą. Po korekcie analizator wznawia cały potok na tych samych bajtach i grafie.

## 4. Dane potrzebne API

**Wysyłane od razu (krok 1, odczyt dosłowny)**
- przegląd rzutu w jego pikselach (≤ 1400 px), z czerwonymi ramkami pytanych etykiet;
- kadr każdej etykiety: powiększenie całkowite najbliższym sąsiadem, bez wymyślonych pikseli; margines wzdłuż tekstu 2× wysokość + 0,6× długość;
- tekst bez żadnego odczytu, rozpiętości ani skali.

**Krok 2 (kontekst)**
- odczyty obu czytników, rozpiętości w px, skale, które dany odczyt by dał;
- inne etykiety tych samych linii;
- skale rozważane przez analizator i jego własne uzasadnienie.

**O co API prosiło: `get_source_region`, 17 razy.**
- Zawsze o powiększenie fragmentu przeglądu: druga cyfra 690, końce linii wymiarowej, nieczytelne kadry.
- Limit 4 na rundę nie został przekroczony.
- O narzędzie spoza listy nie poprosiło ani razu.

**Co było zbędne**
- Kadry etykiet, które nie są etykietami: meble, armatura, kontur planu, ramka obejmująca cały rzut. API rozpoznało je bezbłędnie jako „bez cyfr” — to koszt wyboru problemu, nie błąd API.
- Krok 2 rzadko zmieniał odczyt:
  - w 10 domach tylko kilka zmian: Supertunie L7 305 MEDIUM → LOW; Torenie L4 368 utrzymane przeciw lattice 308;
  - **nie zaobserwowano zakotwiczenia na odczycie lokalnym**: API pisało wprost „nie czytam tego jako 640, zostaję przy 690”.

**Utrata kontekstu lub rozdzielczości**
- Madera, Puszek, plan5-737: rzuty małe (450–600 px), linie wymiarowe jasnoszare, końce jako kropki lub strzałki.
- Przyciąganie końców musiało dostać fallback „koniec samej linii” i próg tuszu 200/235.
- Puszek odpadł przy zgodności 3,9 % — granica precyzji końców, nie odczytu.

**Kontrola 4B**
- Kontrola wykorzystała to, co jest na stronie: rzut, elewacje wydawcy (ARCHON: 4; Madera: 1; monsterhouseplans: brak) i 9 widoków modelu.
- Bez elewacji API wprost oznacza strony i otwory jako niesprawdzone (`notChecked`).

## 5. Narzędzia

| Narzędzie / operacja | Przypadki | Argumenty → wynik | Konsument | Efekt | Kontrpróba | Koszt | Status |
|---|---|---|---|---|---|---|---|
| przegląd + kadry etykiet (pakiet problemu) | wszystkie 10 domów | ramki z `problems.ts` → odczyty dosłowne | — | wejście dla API | test transportu | w cenie tury | REQUIRED |
| `get_source_region` | 17 użyć (Torenie, Supertunie, sp318422, Aksamitki, …) | region przeglądu → kadr ×k z transformacją | — | dokładniejsze odczyty (690, 368) | limit 4/rundę, limit pola, region spoza → odmowa | ~0,02 USD/tura | USEFUL |
| `get_measurement_context` (krok 2) | wysyłany bez prośby we wszystkich rundach | odczyty czytników, rozpiętości, skale | — | uzasadnienia; mało zmian odczytu | — | ~0,03–0,08 USD/krok (cała historia) | USEFUL — kandydat do skrócenia |
| `propose_correction` READ_LABEL | werdykty łącznie z READ_DIMENSION: 74 ACCEPTED, 28 REJECTED (w tym 12 duplikatów id), 2 HELD, 6 CAPABILITY_MISSING | literał + kierunek → `ConsultedReading` | `consulted.ts` → ensemble → solver | skala STRONG (Supertunie); bez wpływu tam, gdzie etykieta nie ma linii | 6 testów konsumenta, 8 walidatora | — | REQUIRED, ale niewystarczające |
| `propose_correction` READ_DIMENSION | Kukliki, Madera, Supertunie, Torenie, Aksamitki, Puszek, sp318422; HELD na plan5-737 | literał (cm/m/ft-in) + końce → `ConsultedSpan` | `consulted-spans.ts`: przyciąganie, parser, zgodność 2 linii | skala ustalona: Kukliki, Madera, Aksamitki, sp318422; 6 potwierdzeń | 5 testów + walidator | — | REQUIRED |
| `inspect_analysis_element` | nie zaimplementowano osobno (uzasadnienie analizatora idzie w kroku 2) | — | — | — | — | — | UNUSED |
| `get_model_views` (kontrola 4B) | 6 modeli w C1/C2/D | rzut + elewacje + 9 widoków → obserwacje | brak | wykrycie wad | — | 0,03–0,05 USD | USEFUL (tylko wykrywa) |
| ASSIGN_VIEW / ROOF_FORM / OUTLINE_REGION / OPENING / MISSING_ELEMENT | 7 propozycji (Madera, Torenie, sp318422) | opis lokalny → — | brak | — | — | — | MISSING |
| `evaluate_candidate` | wykonywane przez pętlę, nie przez API | kandydat → `compareRuns` | transakcja | ACCEPT / ROLLBACK | 5 testów reguł | 0 | REQUIRED (po stronie programu) |

## 6. Dossier domów

Wynik A to stan LOCAL. C to wynik transakcji zamrożonego kandydata: dla DEV z odpowiedzi C2 skonsumowanych zamrożonym kodem, tylko runda 1; dla CONFIRM — na żywo. R to te same odpowiedzi bez konsumpcji, więc jego model to zawsze A.

**DEV 1 — Supertunie 2 E (archon; przypadek liczbowy, odmowa).**

| | |
|---|---|
| LOCAL | odmowa METRIC_RESOLUTION_INCONCLUSIVE (głos strony 1,910 cm/px; 640 i 1350 sporne) |
| Referencja | 690 × 1350 |
| API | 1350, 690 („zamknięta 9”), 600, 327, 123, 305, 201, 104, 321; wymiary 690 i 1350 |
| Przyjęte | 10 etykiet + 2 wymiary |
| Pierwsza zmieniona decyzja | rozwiązanie metryczne → REPLACED/STRONG 2,2425; oba wymiary przyciągnięte (307 i 602 px), AGREES_ONLY |
| Wynik | dalej odmowa, PLAN_NO_WALLED_ENVELOPE (PARTIAL); wynik LOCAL |
| Pozostała wada | znak wodny „archon” czytany jako pasy ścian; brak operacji na obrysie |
| Uwaga | sonda syntetyczna wykryła tu stratę świadka osi X (cross-axis), §7.2 |

**DEV 2 — Torenie 3 E (archon; obrys).**

| | |
|---|---|
| LOCAL | model NEAR (szerokość −6,5 %), IoU 0,85, skala STRONG 3,128 |
| API | 1250, 520, 430, 368 (wbrew lattice 308), 355, 320; wymiary 790/1250/1160/520 — wszystkie AGREES_ONLY |
| Kandydat | skala 3,1325 (+0,14 %), inny hash, ta sama geometria oceny → ROLLBACK |
| 4B | taras jako zamknięta bryła (pergola w źródle); zamiana L/P; brak drzwi z przodu → CAPABILITY_MISSING |
| Pozostałe | obrys (brakuje 15 % pola) |

**DEV 3 — Kukliki (archon; kontrola).**

| | |
|---|---|
| LOCAL | model OK, IoU 1,00; skala = głos strony 1,5634, niepotwierdzona |
| API | 257, 362, tagi okien 120 i 140 (API samo zaznaczyło, że to tagi), 402 i 200 (odrzucone: brak odczytu w tym kierunku); wymiary 756 i 876 |
| Konsumpcja | 756/484 px i 876/560 px zgodne co do 0,15 % → SUPPORTED |
| Wynik | ten sam model bajt w bajt → **ACCEPT (weryfikacja)** |
| 4B | VERIFIED_IN_SCOPE (zero fałszywych alarmów) |

**DEV 4 — Madera (domywstylu; liczby i obrys).**

| | |
|---|---|
| LOCAL | prostokąt dopasowany do pola publikowanego (7,0 cm/px) → szerokość −31 %, IoU 0,38 |
| API | 15,98 i 18,71 (m), przyciągnięte 348 i 405 px → 4,592 / 4,620 (zgodność 0,6 %) → SUPPORTED |
| Kandydat | odmowa PLAN_RESOLUTION_INCONCLUSIVE: rzut pokrywa 104 z 203 m², bo skrzydło zachodnie nie zostało złożone → **ROLLBACK** (zostaje zły model A) |
| 4B | brak garażu, dach |
| Etap B | ten sam odczyt 15,98 jako READ_LABEL zginął w WRONG_BINDING (fragment linii 97 px) |

**DEV 5 — plan23-504 (monsterhouseplans; imperialne, dach).**

| | |
|---|---|
| LOCAL | model OK rozmiaru (fallback z wymiarów publikowanych), brak dachu głównego, IoU 0,65 |
| API | „na rzucie nie ma linii wymiarów całkowitych, tylko notki pokoi 8'-1" x 12'-3"” — prawdziwe (referencja odrysowana ze skali notek) |
| Propozycje | notka ft-in → CAPABILITY_MISSING; NO_CHANGE |
| 4B | brak garażu i ganku, płaskie dachy; brak elewacji na stronie (`notChecked`) |

**DEV 6 — plan5-737 (monsterhouseplans; ft-in, odmowa).**

| | |
|---|---|
| LOCAL | odmowa, 0 etykiet na 21 liniach |
| API | 28'-0" (8,4 m) i 40'-0" (12,0 m), ale „strzałki obejmują ~102 px, nie budynek” → samo oznaczyło HIGH → **HELD**; notki pokoi ft-in → CAPABILITY_MISSING |
| Wynik | NO_CHANGE |

**CONFIRM 1 — Aksamitki (archon).** Odmowa. API: 1322, 1232, 882, zgodne z referencją co do cm. Skala SUPPORTED → odmowa PLAN_RESOLUTION_INCONCLUSIVE (PARTIAL ×2) → wynik LOCAL.

**CONFIRM 2 — Puszek (domywstylu).** Odmowa PLAN_NO_DIMENSION_FRAME. API: 11,52 i 8,52, zgodne z referencją. Przyciągnięcie dało 3,329 i 3,203 cm/px (3,9 %) → NO_AGREEMENT → bez zmiany. Pola pokoi „6,89 m²” odrzucone jako nie-długość.

**CONFIRM 3 — plan63-411 (monsterhouseplans).** Odmowa. API: „brak wymiarów całkowitych, tylko notki pokoi” — zgodne z referencją. CAPABILITY_MISSING; NO_CHANGE.

**CONFIRM 4 — sp318422 (houseplans).**

| | |
|---|---|
| LOCAL | odmowa |
| API | 46'-0" (14,02) i 31'-5" (9,58), przyciągnięte 841 i 575 px → 1,6672 / 1,6654 → SUPPORTED |
| Kandydat | **model** → ACCEPT |
| Ocena | 13,88 × 16,03 m wobec 14,02 × 9,58 — **głębokość +67 %, IoU 0,386, rozmiar WRONG** |
| Replay | odtworzenie z zapisu: ten sam hash `8b3fdaa8` |
| 4B | brak bramy garażowej, dach (bez konsumenta) |
| Kontekst | v3.54.1 B (opis globalny) dał tu OK/0,90 — tamtej ścieżki ten etap nie używa |

## 7. Szczegółowe przebiegi

**7.1 Skuteczna korekta skali (Kukliki, DEV, kontrola).** Ślad: `C2/final-archon-dom-w-kuklikach/events.jsonl` → odtworzenie zamrożonym kodem w `C2-final`.
1. LOCAL: model OK, ale `metricSolution` = LEGACY_UNCONFIRMED/INCONCLUSIVE 1,5634 cm/px; wymiary 756 i 876 nie mają etykiet w analizatorze.
2. Krok 1: API zwraca READ_DIMENSION „756” (LEFT_TO_RIGHT) i „876” (BOTTOM_TO_TOP) z końcami w px przeglądu.
3. Walidator: ACCEPTED (jednostka cm, literał parsowalny, rozpiętość podana).
4. `consulted-spans.ts`: końce przyciągnięte do kresek (484 i 560 px); 756/484 = 1,561983 i 876/560 = 1,564286, zgodność 0,15 % < 3 %; wiarygodność ścian OK.
5. `extract.ts`: `metricSolutions` → REPLACED/SUPPORTED; rejestracja PLAN_XZ → `CONSULTANT_VALIDATED`.
6. Rekonstrukcja: ten sam model (hash `2d6e919f…`, różnica skali < 0,1 %).
7. `compareRuns`: ACCEPT „ten sam model, teraz na skali ustalonej odczytami”.
8. 4B: VERIFIED_IN_SCOPE.

Wynik: model niezmieniony, skala zweryfikowana dwoma wydrukowanymi wymiarami.

**7.2 Poprawna propozycja zablokowana (Supertunie i Madera).**
- **Supertunie, przed pierwszym wywołaniem.** Sonda SYNTETYCZNA: Claude Code skopiował własny odczyt recognisera „690” — nie odpowiedź API.
  - Konsument zastosował odczyt, ale solver go zgubił: 690/305 px = 2,2623 leży w DISTINCT_RATIO (3 %) od 1350/602 = 2,2425, a 2,7 px poza tolerancją zbierania 2,2 px.
  - Klaster X nie zostaje osobną skalą (jest cięższy sąsiad) i nie zostaje zebrany → NOT_CONSUMED (`metric-solution.ts`, `clustersOf` + `attach`).
  - Naprawa: reguła `crossAxisWitness` (tylko w kandydatach; A′ = A bajt w bajt).
  - Potem ta sama odpowiedź API na żywo dała STRONG, a dom zatrzymał się na PLAN_NO_WALLED_ENVELOPE.
- **Madera.** Poprawna skala z API (4,59) → analizator odmawia przy pokryciu 49 % → transakcja ROLLBACK (OVERRIDDEN przez regułę model → odmowa). Zostaje zły model LOCAL.

**7.3 Ochrona poprawnego modelu i fałszywa propozycja.**
- **Ochrona.** Kukliki: odczyty etykiet (etap B) i wymiarów (C) nie zmieniły poprawnego modelu ani o bajt. Torenie: kandydat z mikroróżnicą skali odrzucony.
- **Odrzucone samym protokołem:**
  - 402 i 200 (brak odczytu w tym kierunku);
  - pola pokoi „2,56 m²”, „6,89 m²” (nie-długości);
  - (14,02) i (9,58) z nawiasami (nie-parsowalne);
  - 28'-0"/40'-0" (HELD — niepewność API);
  - 12 duplikatów id w rundzie 2 Supertunie — naturalna kontrpróba; potem zakres id per runda.
- **Fałszywe przyjęcie (sp318422).** Opis w §1 i §6: poprawna skala, zły model, przyjęty, bo reguła nie porównuje zasięgu z wymiarami konsultanta.
- **Kontrpróby syntetyczne** (wszystkie w testach, oznaczone SYNTHETIC): błędna cyfra, jednostka, stara rewizja, powtórzony id, obcy dowód, zły kierunek, brak dowodu (NO_SPAN), timeout + retry, brak sieci, brak klucza, brak odpowiedzi.
- **Nie do sprawdzenia bez konsumenta:** fałszywe domknięcie podcienia, zamiana L/P, inna kondygnacja. API jednak samo wykryło dwa pierwsze w 4B (Torenie).

## 8. Wyniki A/R/C

Rozmiar: OK ≤ 3 % < NEAR ≤ 10 % < WRONG, gorsza oś. IoU w stałej ramie.

| Zbiór | Dom | Wydawca | A | R | C (zamrożony) | Transakcja |
|---|---|---|---|---|---|---|
| DEV | Supertunie 2 E | archon | odmowa | = A | odmowa (skala STRONG) | PARTIAL |
| DEV | Torenie 3 E | archon | NEAR 0,065 · IoU 0,846 · kal. ✓ | = A | = A | ROLLBACK |
| DEV | Kukliki | archon | OK 0,000 · IoU 1,000 · kal. ✓ | = A | = A, skala SUPPORTED | ACCEPT (weryfikacja) |
| DEV | Madera | domywstylu | WRONG 0,306 · IoU 0,382 · kal. ✓ | = A | = A | ROLLBACK (kandydat: odmowa przy poprawnej skali) |
| DEV | plan23-504 | monsterhouseplans | OK 0,028 · IoU 0,647 · bez dachu | = A | = A | NO_CHANGE |
| DEV | plan5-737 | monsterhouseplans | odmowa | = A | odmowa | NO_CHANGE |
| CONFIRM | Aksamitki | archon | odmowa | = A | odmowa (skala SUPPORTED) | PARTIAL ×2 |
| CONFIRM | Puszek | domywstylu | odmowa | = A | odmowa | NO_CHANGE |
| CONFIRM | plan63-411 | monsterhouseplans | odmowa | = A | odmowa | NO_CHANGE |
| CONFIRM | sp318422 | houseplans | odmowa | = A | **WRONG 0,674 · IoU 0,386** | ACCEPT (fałszywe) |

**DEV** (N = 6, 3 wydawców, 3 domy spoza ARCHON)
- Modele: A 4 → C 4.
- Ten sam rozmiar, IoU i kalenica w każdym domu (wspólna grupa N = 4: mediana IoU 0,747 → 0,747).
- Skala zweryfikowana: A 1 (Torenie) → C 2 (+Kukliki).
- Poprawna skala znaleziona tam, gdzie LOCAL jej nie miał: Supertunie, Madera (bez modelu).

**CONFIRM** (N = 4, 4 wydawców, 3 spoza ARCHON)
- Modele: A 0 → C 1, ale model WRONG.
- Poprawna skala: 2 z 4 (Aksamitki, sp318422); u Puszka odczyty poprawne, skala odrzucona (3,9 %).

**Krytyczne regresje:** DEV 0; CONFIRM 0 wobec A — A był odmową, ale jest jedno fałszywe przyjęcie.

**Mierniki poprawione w tym etapie (wszystkie testowane)**
- scorer kalenicy: krawędzie RIDGE;
- IoU w stałej ramie z diagnostyką lustra;
- konwersja ft-in w referencjach i konsumencie.

**Poprawność odczytów API wobec źródła.** Każdy sprawdzony przez Claude Code odczyt wymiaru był poprawny:
- Supertunie: 10 etykiet + 2 wymiary;
- Kukliki: 6 + 2;
- Madera: 2;
- Torenie: 4 wymiary zgodne co do < 0,3 % z łańcuchami analizatora;
- Aksamitki: 3 = referencja;
- Puszek: 2 = referencja;
- sp318422: 2 = referencja;
- plan5-737: 28'-0" i 40'-0" = referencja (strzałki bez linii pomocniczych — dokładnie to, co API zgłosiło jako powód HIGH).

Fałszywe odczyty: 0 znalezionych. Fałszywe alarmy na kontroli: 0. Niepewności API były trafne: plan5-737 HELD, tagi okien nazwane jako tagi.

## 9. Autonomia

**Zwykły program**
- wybór problemu, kadry, wywołania narzędzi, walidacja, konsumpcja, przeliczenie, decyzja transakcji, księga i ślad.

**API**
- odczyt dosłowny etykiet i wymiarów całkowitych, wskazanie końców linii wymiarowej, ocena modelu wobec elewacji;
- prośby o dodatkowe kadry (`get_source_region`: 7 razy w C2, z własnej inicjatywy).

**Claude Code (między wersjami, nie w runtime)**
- kod konsumentów;
- poprawki wykryte na DEV:
  - przyciąganie końców: próg tuszu i fallback na koniec linii;
  - reguła weryfikacji;
  - zakres id;
  - wybór problemu w rundzie 2;
- zatrzymania przebiegów — patrz `INTERVENTIONS.md`.

**Ręczne podpowiedzi do API:** żadnych. Treść promptu jest stała i wersjonowana (0.1.0, 0.2.0); API nie dostało referencji ani wartości oczekiwanej.

**Ręczne interwencje w przebiegi (wszystkie w `INTERVENTIONS.md`)**
1. Zatrzymanie C1 po teście walidatora. Jedno żądanie w locie; rezerwacja 0,146096 USD zostaje w księgach jako koszt nieznany; zapis zdarzeń skasowany — błąd operatora.
2. Syntetyczna sonda konsumenta przed pierwszym wywołaniem (nie liczona).
3. Zatrzymanie C2 przed Toreniami (bez żądania w locie).

**Czy pętla zadziała bez operatora?**
- Tak: C2b i D przebiegły bez żadnej ręcznej podpowiedzi.
- Zmiany kodu między etapami są rozwojem, nie sterowaniem wynikiem.
- Odpowiedzi C2 zostały skonsumowane przez zamrożony kod offline, tylko runda 1 (pytanie identyczne).

## 10. Koszt i wydajność

- 50 odpowiedzi płatnych, 1,987078 USD (wycena z usage, nie faktura), 816 tys. tokenów wejścia, 135 tys. wyjścia.
- Do tego 1 żądanie przerwane przez operatora: rezerwacja 0,146096 USD stoi jako koszt nieznany.
- Księgi: 4,11036 (v3.54.1, przeniesione) → **6,243534 USD** narastająco.
- Pułapy nieprzekroczone:

  | Pułap | Wartość | Wykorzystanie |
  |---|---|---|
  | rozpoznanie (etap B) | 9,11036 | rozpoznanie 0,584 |
  | cały etap | 24,11036 | 2,133 |
  | projekt | 100 | — |

- S53 CLI 2,72807938 USD pozostaje osobnym szacunkiem.

| Etap | Żądania | USD |
|---|---|---|
| B | 10 (+1 przerwane) | 0,4383 |
| C | 24 | 0,9140 |
| D | 16 | 0,6348 |

**Wydajność**
- Koszt na dom: 0,075–0,299 USD (mediana ≈ 0,15).
- Latencja tury: mediana 13,5 s, maks. 27,9 s.
- Pełny przebieg domu: 3–9 min, w tym LOCAL 0,5–4 min i kandydat.
- Koszt na zaakceptowaną poprawę jakości geometrii: brak takiej poprawy w tym etapie. Na ustaloną skalę: ≈ 0,17 USD (6 skal ustalonych lub potwierdzonych w DEV+CONFIRM przy ≈ 1,0 USD tur).
- Cache promptów nie był używany (każda runda to nowa rozmowa).

**Wariancja.** Dwa problemy zadane dwukrotnie realnie (etap B prompt 0.1.0 i etap C prompt 0.2.0, te same obrazy):
- Supertunie L2 690 i L1 1350 — identyczne;
- Madera L1 15,98 — identyczne.

Odtworzenie zapisanych odpowiedzi przez ten sam kod daje ten sam model (hash) — 6 porównań w `C1-art`, `C2-art`, `D-art`.

## 11. Ochrona poprawnych danych

**Transakcja**
- Kandydat liczy się na tych samych zamrożonych bajtach i grafie.
- `compareRuns`:
  - model → odmowa = ROLLBACK;
  - przesunięcie ustalonej skali > 3 % = ROLLBACK;
  - inny model bez lepiej ustalonej skali = ROLLBACK.
- Odczyt konsultanta nigdy nie usuwa rywala: poprzedni odczyt zostaje kandydatem pełnej mocy.
- Wymiar konsultanta nigdy nie przebija skali STRONG/SUPPORTED analizatora — może ją tylko potwierdzić (AGREES_ONLY) albo zostać odrzucony (CONTRADICTS_SETTLED).

**Kolizje.** Jedna wartość konsultanta na etykietę w przebiegu (DUPLICATE_TARGET). Id propozycji jest zakresowane per runda; powtórzenie w jednej odpowiedzi jest odrzucane.

**Bez sieci**
- Błąd transportu: jedna ponowna próba, rezerwacja zostaje.
- Drugi błąd: `CONSULTANT_FAILED`, wynik LOCAL bez zmian (test `consult-v3542`).
- Brak klucza: `NO_CREDENTIALS`, rezerwacja zwolniona (test).

**Wyciek modelu do generatora B.** API nie dostaje modelu jako opisu do odtworzenia. W kontroli 4B widzi rendery modelu, ale jego odpowiedzi trafiają tylko do zapisu (brak konsumenta), a ścieżka opisu jest wyłączona.

**Klucz**
- Tylko `/root/.config/buildplan/campaign-key` (poza repo) → zmienna środowiska procesu.
- Każdy zapis przechodzi przez `scrub`.
- Przed każdym commitem: `git grep -F <klucz>` = pusto.

## 12. Testy i produkt

**Testy nowe (wszystkie zielone, 28)**
- `packages/source-metrics/test/consulted-v3542.test.ts` — 6: konsument etykiety, kontrpróby cyfry/jednostki/celu.
- `packages/source-metrics/test/consulted-spans-v3542.test.ts` — 5: parser ft-in, przyciąganie, brak kreski, skos, za krótki, jeden świadek, zła cyfra, ta sama linia dwa razy, niewiarygodna skala, koniec linii z kropkami.
- `packages/analysis-service/test/consult-v3542.test.ts` — 14: walidator — rewizja, cel, jednostka, literał, dowód obcy, kierunek, duplikat id/celu, ft-in, operacja nieznana, HIGH, READ_DIMENSION; transakcja; transport — retry, brak sieci, brak klucza, brak odpowiedzi.
- `apps/analyzer-api/test/consultant-wiring-v3542.test.ts` — 3: flaga, zastąpienie czytnika.

**Typecheck całego monorepo:** czysty. Istniejące testy dotkniętych pakietów zielone na końcowym kodzie: `packages/source-metrics` + `apps/analyzer-api` — 45 plików, 533 testy; `packages/analysis-service` — 24 pliki, 242 testy.

**Regresja**
- A′ = A bajt w bajt na sześciu DEV.
- Domyślna ścieżka bajt w bajt na Maderze (model + dowody metryczne).
- Kandydaci odtworzeni z zapisanych odczytów dają ten sam hash co pętla (Kukliki, Madera, Supertunie w C1; patrz §10).

**Nie sprawdzono**
- pełnego `npm test` monorepo — 11 znanych porażek architektury z v3.54.1 bez zmian, nieuruchamiane ponownie w całości;
- pełnej macierzy S30/FINAL z regułą cross-axis: reguła działa tylko w kandydatach konsultacji, domyślnie wyłączona;
- hosta HTTP end-to-end z prawdziwym zadaniem: `executeJob` okablowany i przetestowany na poziomie wiringu, nie uruchomiony z sieciowym pobraniem strony;
- Androida: NOT_VERIFIED (brak urządzenia), bez APK, bo nie zmieniono aplikacji.

**Ścieżka produktu na przyszłość:** Android wysyła link + token pilota → host/broker (`apps/analyzer-api`, klucz tylko na hoście) → `executeJob` → `consultAnalysis` (LOCAL → konsultacja → przeliczenie) → pliki sceny jak dziś → Android pobiera scenę.

## 13. Rekomendacja

**Minimalny zestaw narzędzi produkcyjnych:**
1. Pakiet problemu (przegląd + kadry etykiet).
2. `get_source_region` (limit 4).
3. READ_DIMENSION — końce przyciągane przez analizator, parser analizatora, zgodność dwóch linii ≤ 3 %, nigdy ponad ustaloną skalę. Daje 5 z 6 ustalonych lub zweryfikowanych skal.
4. READ_LABEL — tylko dla etykiet związanych z linią.

**Moment konsultacji.** Przed budową, gdy skala wybranego rzutu nie jest STRONG/SUPPORTED (odmowa metryczna albo model na głosie strony lub polu publikowanym). Krok 2 (kontekst lokalny) można skrócić: rzadko zmieniał odczyt, a kosztuje 60 % tokenów rundy.

**Reguła przyjęcia — do zmiany przed kolejnym użyciem.** Odmowa → model wolno przyjąć tylko wtedy, gdy zbudowany zasięg zgadza się z wymiarami całkowitymi, które ustaliły skalę (np. ≤ 3–5 % na osi). To wykluczyłoby fałszywe przyjęcie sp318422 (+67 %), a nie zablokowało żadnego przyjęcia DEV.

**Kontrola 4B.** Zostawić jako diagnostykę tylko do odczytu. Wykrywa trafnie (0 fałszywych alarmów na kontroli), ale bez konsumentów niczego nie zmienia.

**Koszt.** Ok. 0,08–0,30 USD na dom (mediana 0,15) przy Sonnet 5.5.

**Alternatywy odrzucone na wyniku**

| Alternatywa | Powód odrzucenia (wynik) |
|---|---|
| Sam READ_LABEL | etap B: 0 zmian modelu na 3 domach; poprawka ginie, gdy etykieta nie ma linii lub wiąże fragment |
| Pewność AI jako dowód | zamiast tego zgodność geometryczna dwóch linii (Puszek 3,9 % słusznie odrzucony) |
| Globalny opis | poza zakresem briefu; jego wynik v3.54.1 pozostaje kontekstem |

## 14. Następna decyzja dla koordynatora

1. **Dodać do transakcji kontrolę zasięgu przed przyjęciem odmowa → model** (jeden warunek w `compareRuns`, test, powtórka D z zapisu bez kosztu).
   - Za: sp318422 fałszywie przyjęte; reguła nie dotyka 5 wyników DEV.
   - Przeciw: dodatkowy warunek może odrzucić model poprawny w środku, a krzywy na brzegu — jak dziś tego nie wiemy, bo N = 1.
2. **Polityka dla „poprawnej skali, która ujawnia odmowę” (Madera).** Dostarczać zły model z dopasowanej skali (dzisiaj) czy uczciwą odmowę z pytaniem?
   - Za odmową: model A ma −31 % szerokości.
   - Za modelem: użytkownik coś widzi.
   - Decyzja OWNER-a, bo zmienia produktowe zachowanie.
3. **Następna praca analizatora: kompozycja planu przy zweryfikowanej skali**, a nie kolejne narzędzia API.
   - Cztery domy mają teraz poprawną skalę i stoją na planie:
     - Supertunie — envelope;
     - Aksamitki — resolution;
     - Madera — pokrycie 49 %;
     - sp318422 — przeszacowana głębokość.
   - Alternatywa: konsumenci 4B (garaż, dach, taras) — 5 modeli z wykrytymi wadami, ale każda rodzina to osobna zmiana składania.

## Tabela śladu (obowiązkowa)

| Dom / problem | Odczyt LOCAL | Obserwacja API | Narzędzie | Propozycja | Walidacja / powód | Funkcja konsumenta | Wartość w modelu | Skutek w scenie | Koszt |
|---|---|---|---|---|---|---|---|---|---|
| Supertunie / skala | 640 (lattice) vs 690 (Paddle) CONTESTS; 1350 vs 1150 | „690, zamknięta 9”; „1350” | przegląd + kadry, region ×2 | READ_LABEL 690, 1350 (+8); READ_DIMENSION 690, 1350 | ACCEPTED | `consultedOf` → `solveFrameMetric` (+ `crossAxisWitness`); `admitSpans` | skala 1,910 → 2,2425 STRONG; wymiary AGREES_ONLY | brak modelu: odmowa przesunięta na PLAN_NO_WALLED_ENVELOPE (PARTIAL) | 0,299 (C) |
| Kukliki / skala niepotwierdzona | głos 1,5634, brak etykiet 756/876 | 756, 876 (+257, 362, tagi okien) | przegląd + kadry | READ_DIMENSION 756, 876 | ACCEPTED; 402, 200 → NO_READING_THAT_WAY | `snapSpan` (484, 560 px) → `admitSpans` → rejestracja CONSULTANT_VALIDATED | skala SUPPORTED 1,562; model bez zmian | ten sam model, skala zweryfikowana (ACCEPT) | 0,173 |
| Madera / skala z pola | prostokąt dopasowany, 7,0 cm/px | 15,98 i 18,71 (m) | przegląd + kadry | READ_DIMENSION 15,98, 18,71 | ACCEPTED | `snapSpan` (fallback końca linii) → `admitSpans` | skala 4,59/4,62 SUPPORTED | kandydat: odmowa (pokrycie 49 %) → ROLLBACK | 0,104 |
| Madera / etykieta (etap B) | „413”/„86” na fragmencie linii 97 px | 15,98 | kadr | READ_LABEL 15,98 | ACCEPTED | `consultedOf` | 1598 cm na 97 px — zły span | bez zmian (WRONG_BINDING) | 0,075 |
| Torenie / etykiety | skala STRONG; 308 (lattice) | 368 (wbrew 308), 1250/520/790/1160 | region ×2 | READ_LABEL ×6, READ_DIMENSION ×4 | ACCEPTED | ensemble + `admitSpans` | skala +0,14 %, inny hash | ROLLBACK (ta sama geometria) | 0,175 |
| Torenie / 4B | model z zamkniętą bryłą tarasu | pergola otwarta; zamiana L/P; brak drzwi | widoki modelu + 4 elewacje | ASSIGN_VIEW | CAPABILITY_MISSING | — | — | brak | w cenie |
| plan5-737 / ft-in | 0 etykiet | 28'-0" (8,4 m), 40'-0" (12,0 m), „strzałki ~102 px” | kadry | READ_DIMENSION HIGH | HELD | — | — | odmowa bez zmian | 0,083 |
| plan23-504 / brak wymiarów | fallback z wymiarów publikowanych | „brak linii wymiarów całkowitych, notki pokoi ft-in” | kadry | READ_LABEL 8'-1" x 12'-3" | CAPABILITY_MISSING | — | — | NO_CHANGE | 0,079 |
| Aksamitki / skala (CONFIRM) | głos niepotwierdzony | 1322, 1232, 882 | przegląd + kadry | READ_LABEL + READ_DIMENSION | ACCEPTED | ensemble + `admitSpans` | skala SUPPORTED | odmowa przesunięta: PLAN_RESOLUTION (PARTIAL ×2) | 0,266 |
| Puszek / skala (CONFIRM) | WEAK | 11,52, 8,52 | kadry | READ_DIMENSION ×2 | ACCEPTED | `admitSpans` | NO_AGREEMENT 3,9 % | odmowa bez zmian | 0,088 |
| sp318422 / skala (CONFIRM) | odmowa | 46'-0" (14,02), 31'-5" (9,58) | region | READ_DIMENSION ft-in ×2 | ACCEPTED; (14,02) z nawiasem odrzucone | `lengthCmOf` ft-in → `snapSpan` (841, 575 px) → `admitSpans` | skala 1,667 SUPPORTED | **model 13,88 × 16,03 m (głębokość +67 %) — ACCEPT fałszywy** | 0,206 |

## Tabela możliwości (obowiązkowa)

| Zadanie API | Potrzebne dane | Potrzebna operacja | Zaimplementowana? | Użyta? | Poprawiła wynik? | Ograniczenie |
|---|---|---|---|---|---|---|
| Odczyt sporej etykiety | kadr + przegląd | READ_LABEL | tak | tak (10 domów) | skala Supertunie: tak; model: nie | etykieta musi mieć lattice w tym kierunku i właściwą linię |
| Wymiar, którego analizator nie znalazł | przegląd, końce linii | READ_DIMENSION | tak (po etapie B) | tak (7 domów) | skala: 5 ustalonych, 6 potwierdzeń; model: nie | precyzja końców na małych rzutach (Puszek 3,9 %); strzałki bez linii |
| Wymiar w ft-in | jw. | parser ft-in | tak (READ_DIMENSION) | tak (sp318422) | skala tak; model zły (kompozycja) | etykieta ft-in pojedyncza: CAPABILITY_MISSING |
| Notka pokoju „A x B” | obrys pokoju | ROOM_SIZE | nie | proponowana (plan23, plan63) | — | wymaga geometrii pokoju |
| Przypisanie elewacji | elewacje + widoki | ASSIGN_VIEW | nie | proponowana (Torenie, sp318422) | — | brak nadpisania ról widoków w ścieżce kandydata |
| Dach bryły | elewacje | ROOF_FORM | nie | proponowana (Madera) | — | dach domu ustalany globalnie |
| Brakujący element | rzut + elewacja | MISSING_ELEMENT | nie | proponowana (Madera, sp318422) | — | wymaga konsumenta w kompozycji |
| Obrys / znak wodny | rzut | OUTLINE_REGION | nie | nie (brak operacji przy odmowie planu) | — | dotyka wspólnego czytnika granic |
| Kontrola modelu | rzut + elewacje + 9 widoków | `checkModel` (4B) | tak, tylko do odczytu | tak (6 modeli) | wykrycie: tak; zmiana: nie | brak konsumentów |

## Odpowiedzi wprost

**Przed budową, po niej, czy w obu miejscach?** W obu, w tej kolejności:
- przed budową, gdy skala jest nieustalona — tylko tam korekty mają dziś konsumenta i zmieniały stan analizatora;
- po budowie jako kontrola — trafna, ale bez konsumenta niczego nie zmienia.

**Czy cztery elewacje wystarczają?**
- Do przypisania stron, wejścia, dachu i otworów — tak, gdy są (ARCHON).
- Domywstylu ma jedną, monsterhouseplans żadnej: API wtedy uczciwie oznacza strony jako niesprawdzone.
- Do skali i obrysu elewacje nie wystarczają.

**Kiedy potrzebny rzut/przekrój?**
- Rzut: zawsze, dla skali, obrysu, wejścia i garażu.
- Przekrój: dla kondygnacji i wysokości — nieużywany w tym pilocie.

**Co wymaga zmiany analizatora zamiast promptu?**
- wykrycie struktury wymiarów (linie, końce, etykiety w każdym kierunku);
- kompozycja planu przy zweryfikowanej skali;
- konsumenci dla poprawek po budowie;
- warunek zasięgu w transakcji.

API widzi i czyta poprawnie; brakujące elementy są po stronie analizatora.

## Dodatek: rozwój po potwierdzeniu (oznaczony osobno)

**Status tego rozdziału.**
- Wszystko poniżej powstało **po** obejrzeniu wyniku próby potwierdzającej.
- Statusy, tabele i werdykt §1–§14 opisują zamrożonego kandydata `d427df8` i się nie zmieniają.
- Cztery domy CONFIRM_KNOWN są od tej chwili **danymi rozwojowymi**. Zmiany z tego rozdziału nie mają żadnej próby potwierdzającej.
- Zero nowych wywołań API. Każda liczba pochodzi z powtórki zapisanych odpowiedzi przez bieżący kod (`consult-run.ts --replay`), czyli z tych samych odczytów co §6–§8.

### Kandydat 2: kontrola zasięgu w transakcji (`6bd8870`)

- **Reguła.** ACCEPT staje się ROLLBACK z powodem `EXTENT_CONTRADICTS`, gdy zbudowany zasięg przekracza tolerancję względem konsultowanego wymiaru całkowitego.
  - Zasięg zbudowany: prostokąt płyty najniższej kondygnacji.
  - Odniesienie: największy przyjęty (ADMITTED/AGREES_ONLY) wymiar konsultowany na danej osi.
  - Działa tylko po przebiegu z konsultacją; ścieżka domyślna jest nietknięta.
- **Tolerancja: 5 %.** Wartość z rekomendacji §13 („≤ 3–5 %”), ustalona przed powtórką.
- **Wyniki (powtórka D i DEV).**
  - sp318422: ACCEPT → **ROLLBACK** (16,03 m wobec 9,58 m, 67 %). Fałszywe przyjęcie z §1 znika.
  - Aksamitki: nadal odmowa.
  - DEV: 6/6 tych samych rozstrzygnięć; reguła nie zadziałała ani razu.
- **Testy:** analysis-service `consult-v3542` (17).

### Kandydat 3: poprawka 1 z diagnozy kompozycji planu (`e88686b`)

**Diagnoza** (`stage-reports/artifacts/v3542/PLAN_COMPOSITION.md`, tylko do odczytu, kopie cieniowe poza repo) wskazała pierwszą utraconą decyzję w każdym z czterech domów. Wspólne mechanizmy:

| Mechanizm | Co się dzieje | Domy |
|---|---|---|
| **M1** | `axisLadder` przypina pierwsze stwierdzenie łańcucha wymiarowego bez sprawdzenia; jego wartość rozwiązano przy starej skali z głosu strony | sp318422, Aksamitki (rozstrzyga); Madera (6 %, nie rozstrzyga) |
| **M2** | Rama z osi pasm ścian nie widzi elewacji bez pasma (przeszklony szczyt, niedorysowana brama) | Supertunie, Madera |
| **M3** | Pomieszczenie obrysowane przeszkleniem zalane jako OUTSIDE | Madera |

**Zmiana.**
- Przy rejestracji `CONSULTANT_VALIDATED` pierwsze stwierdzenie łańcucha musi zgadzać się z niezależną skalą: tolerancja to `allowedPx` + długość × 2 · tick / najdłuższa kotwica.
- Bramka na proweniencji: bez pilota żadna rejestracja nie jest `CONSULTANT_VALIDATED`, więc ścieżka domyślna jest bajt w bajt ta sama (diagnoza §6: 16/16 przebiegów bez konsultanta identycznych).
- Wersji solvera celowo nie podniesiono, żeby nie zmienić bajtów ścieżki domyślnej. Skutek: na ścieżce pilota model zmienia się przy tej samej wersji. Przed włączeniem pilota w hoście z pamięcią podręczną wynik trzeba kluczować także rewizją kandydata (otwarte).
- Testy reconstruction: 1638 zielonych.

**Wynik (powtórka D).**
- Aksamitki: kompozycja po raz pierwszy wychodzi, **12,32 × 8,82 m**. Kandydat 2 ją jednak odrzuca (szerokość 7 % poniżej 13,22 przy tolerancji 5 %) → ROLLBACK.
- sp318422: 13,88 × 11,02 m (głębokość +15 % zamiast +67 %), nadal ROLLBACK.

### Kandydat 4: tolerancja zasięgu 10 % (`505cb7d`), **wybrana po obejrzeniu Aksamitek**

- **Zmiana.** `EXTENT_TOLERANCE` 5 % → 10 %, czyli granica WRONG z klas rozmiaru protokołu (OK ≤ 3 % < NEAR ≤ 10 % < WRONG).
- **To jest strojenie na widzianym wyniku.** Uzasadnienie (spójność z klasami protokołu) jest prawdziwe, ale liczbę wybrano po zobaczeniu Aksamitek przy 7 %. Ten zysk **nie jest dowodem przenoszenia**.

**Wyniki.**

| Dom | Zamrożony (`d427df8`) | Kandydat 4 |
|---|---|---|
| Aksamitki | odmowa (PARTIAL ×2) | **ACCEPT → model 12,32 × 8,82 m**: NEAR (szerokość −6,8 %, głębokość dokładna), IoU 0,881 (stała rama protokołu), kalenica ✓ |
| sp318422 | ACCEPT fałszywy (13,88 × 16,03 m) | ROLLBACK (11,02 wobec 9,58 m, 15 %) |
| Puszek, plan63-411 | odmowa | odmowa (bez zmian) |
| DEV ×6 | 4 modele, 2 odmowy | **bez zmian**: te same rozstrzygnięcia i te same hashe modeli 6/6; reguła zasięgu ani razu nie zadziałała |

- **Odtwarzalność Aksamitek:** pętla i niezależne odtworzenie (`replay-c.sh`) dają ten sam hash modelu `e86a24b88b54b3fe`.
- **Porównanie z v3.54.1.** Model Aksamitek ma tę samą jakość co wynik B v3.54.1 (NEAR, kalenica ✓). Tym razem jednak zbudował go analizator na skali z dwóch wymiarów odczytanych przez konsultanta (1322 i 882), a nie czytnik opisujący dom.
- **Inna metryka w diagnozie.** `PLAN_COMPOSITION.md` podaje dla Aksamitek IoU 0,979, bo używa metryki v3.54.1 (najlepszy z 4 obrotów + przesunięcie ±1,5 m). W tym raporcie obowiązuje stała rama protokołu (0,881).
- **Brakujące 0,9 m szerokości** to wykusz, który pomija już dekompozycja rzutu (diagnoza §2), a nie błąd skali.
- **Plansze (prywatne):** `boards/final-archon-dom-w-aksamitkach-c4-{plan,views}.png` (źródło | PRZED | PO, te same kamery).

### Poprawki z diagnozy niewdrożone

| Poprawka | Efekt w kopii cieniowej | Dlaczego nie wdrożona |
|---|---|---|
| **Fix 3**: przyjęte wymiary konsultowane jako łańcuchy całkowite ramy | sp318422: dokładnie 14,02 × 9,58 m, IoU 0,876 (ganek odpada); Madera: zasięg dobry, nadal odmowa | jedna zmiana dowodu karmi naraz zasięg, role łańcuchów, siatkę, drabinę i resolver; wymaga podniesienia wersji schematu dowodu metrycznego; sprawdzona tylko wstrzyknięciem, nie na Kuklikach ani Toreniach |
| **Fix 2**: domknięcie w pełni przeszklonego końca na odczytanym ticku wymiaru | Supertunie: odmowa → 6,32 × 13,50 m, IoU 0,897, pokrycie 89 % | czysta łatka za bramką pilota (`diag/fix2-*.patch`) zostawia ścieżkę domyślną bez zmian (16/16), ale reguła wynika z jednego domu i może zamknąć bryłę nad loggią lub podcieniem; bez bramki zmienia diagnostykę etapu A Supertunii |
| Madera | brak minimalnej poprawki | M2 + M3 razem: niedorysowana brama garażu i przeszklony salon jako OUTSIDE |

Łatka Fix 2 i skrypt wstrzyknięcia Fix 3 leżą w `/home/user/rd/v3542/diag/` (prywatnie, także w paczce ZIP). Nie wdrożyłem ich, bo po potwierdzeniu nie ma już żadnych niewidzianych domów: każda kolejna reguła wyprowadzona z jednego z tych czterech byłaby dopasowaniem do benchmarku. Kolejność, którą rekomenduję: Fix 3 → Fix 2, każda za flagą pilota, z regresją S30 + FINAL na ścieżce domyślnej (bajt w bajt) przed jakimkolwiek przebiegiem na nowych domach. Bez nowej próby potwierdzającej (nowe rodziny, odczyty na żywo) żadna z nich nie może zmienić statusu QUALITY_GAIN.

### Równolegle: wyglądy domu 3D w aplikacji Android (`7f9b566`)

Na prośbę OWNER-a drugi agent pracował równolegle nad wyglądem aplikacji, tylko w `apps/android`. Ze zmianami analizatora się nie przecina.

- **Sześć nowych wyglądów** obok istniejących Modelu, Makiety i Kreski:
  - Przytulny (ciepłe słońce, tynk, terakota, drewno);
  - Wieczór (ta sama paleta o zmierzchu, ciepło świecące szyby);
  - W słońcu (drabina wartości do pracy na działce w pełnym słońcu);
  - Techniczny (ciemny widok z MASTER_PLAN §3.2);
  - Prześwietlenie (przezroczysta bryła: pokoje, schody i kondygnacje widać przez powłokę);
  - Światłokopia (granat i cyjanowe linie jak rysunek z budowy).
- **Zasada:** wygląd zmienia tylko światło, materiały, alfę, kontury, tło, siatkę i arkusz gruntu. Nigdy nie zmienia geometrii, zbioru obiektów, widoczności ani semantyki. Geometria jest wgrywana raz.
- **Panel Wygląd** jest pogrupowany: Dom / Studium bryły / Rysunek techniczny. Listwa podaje wygląd jednym słowem; pełna nazwa jest w `stateDescription`.
- **Propozycje (niewdrożone)** są w `apps/android/LOOKS_PROPOSAL.md`: miniatury, wygląd zapamiętany per dom, podpowiedź „W słońcu”, przejście 180 ms, fokus w Prześwietleniu. Odrzucony: „duch” przyszłych etapów.
- **Testy.**
  - `HouseLooksTest` (14): determinizm, przezroczystość, kontrast stykających się grup, szkło w Prześwietleniu, kontrast chromu.
  - `testDebugUnitTest`: 476 testów, **4 błędy**, niezależne od wyglądów (sprawdzone ponownie). Wszystkie pochodzą z dwóch scen 005T (`jarzmianki-005t-visual`, `gozdzikowce-005t-visual`) dołączonych w `074d6ae`, których `DownloadedScenesTest` (2) i `AutoCandidateRenderingTest` (2) nie przewidują. Żaden plik zmieniony przez `7f9b566` nie leży na ich ścieżce.
  - `lintDebug`: 1 błąd w nietkniętym `DescribingPanel.kt:88` (zgłoszony przez agenta, niezweryfikowany ponownie).
- **Status: NOT_VERIFIED na urządzeniu.** Podglądy z rasteryzatora dowodowego (bez cieni, AO i odblasków) leżą poza repo w `/home/user/rd/ui-previews/`. Nowego APK nie ma: zabrakło miejsca na dysku sesji.

## Paczka prywatna, plansze i ciągłość

- **Plansze** (prywatne, 20 PNG: po 2 na dom; plus 2 z Dodatku: `final-archon-dom-w-aksamitkach-c4-{plan,views}.png`): `boards/<dom>-plan.png` (ŹRÓDŁO | PRZED | PO) i `boards/<dom>-views.png` (elewacje | 9 widoków PRZED | PO, te same kamery).
- **Paczka prywatna `/home/user/BuildPlan-V3542-Private.zip`** (poza Gitem), z `INDEX.md` i `MANIFEST.sha256`; zawiera:
  - raport, tabele, protokół, referencje (hash);
  - zdarzenia (pytania, odpowiedzi, narzędzia, werdykty, decyzje, rewizje; obrazy przez hash i transformację, bez bajtów);
  - odczyty skonsumowane;
  - modele A/C, księgę, plansze.
- **Git:** kod, testy, raport, `stage-reports/artifacts/v3542/CAPABILITY_GAPS.md`, `INTERVENTIONS.md`, protokół, księga `research/ai-assist/spend-ledger-v3542.json`, `research/source-to-model/v3542/HANDOFF.md`.
