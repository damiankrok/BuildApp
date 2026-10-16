# STAGE BUILDPLAN-ANALYZER-005R-ROUTER-N1-ADOPT — bramka adopcji routingu po projekcji (FAST CI)

**Werdykt etapu (przed CI): wszystkie prerejestrowane bramki DEV, bramka wizji V i BLIND_13 — PASS.**
`CODE_CHANGED: tak (jedna łatka routingu)` · `PREREG: dc9f735 (+ addenda A, B, C)` · `PRE_HOLDOUT_13_SHA: d069fa6` ·
`BLIND_13: PASS (2/2, oba wykonane)` · `HUMAN_TRUTH: NOT_RUN` · `EXTERIOR_DETECTOR: NOT_ADOPTED` · `ARM64: PENDING` ·
`OWNER_ACCEPTANCE: PENDING`. Ostateczny token (`ADOPTED_SAFE_ROUTING` albo `PARTIAL`) zależy od **jednego** pełnego
przebiegu CI po jednym fast-forwardzie lustra `claude/new-session-3kzcgh`; jego wynik jest w wiadomości końcowej
(reguła 7.4: zielony ⇒ ADOPTED_SAFE_ROUTING, dowolny czerwony job ⇒ PARTIAL, bez ponawiania).

Baza `0f2c347c0be03a32510f1e54460eab6fdf1b65a5` (lokalnie = origin `analyzer/visual-source-role-guard-v1` = lustro;
czyste drzewo). Gałąź etapu `analyzer/visual-source-projection-guard-adoption-v1`. Bez APK, bez 005R-EXTERIOR, bez 005S.

## Podsumowanie dla OWNER-a

| pytanie | odpowiedź z pomiarów |
| --- | --- |
| Co zmieniono w produkcji? | **Jedna reguła** `readsAsFacade(roles)` (`source-vision/src/tasks.ts`): czytnikami fasady ortogonalnej jest elewacja albo render, któremu adapter jawnie nadał projekcję `ORTHOGRAPHIC_ELEVATION`. Ta sama reguła steruje (1) deterministycznymi ekstraktorami fasady w `analyze.ts`, (2) zadaniem wizji `FACADE_DECOMPOSITION` (`tasksForRoles`) i (3) granicą `applyVisionResponse`. Render perspektywiczny (wnętrze czy zewnętrze — bez różnicy) jest dalej deklarowany jako klatka (kamera nadal liczy się z jego rastra), ale nie niesie żadnej obserwacji fasady, tylko jedną nazwaną odmowę `NOT_ATTEMPTED`. Elewacja nie jest nigdy odmawiana. +2 544 B źródła w trzech plikach. Bez enumów, schematów, ról, geometrii, OCR, UI. |
| Czy model 3D się zmienił? | **Nie.** 37/37 wierszy DEV: 23 modele bajt-w-bajt + 14 identycznych typowanych odmów; ślepa runda 2/2 tak samo. |
| Co znika? | Na DEV: 15 893 obserwacje fasady na 403 klatkach perspektywicznych (OPENING 7 326, LVC 2 894, SURFACE 1 741, ROOF_EDGE 1 612, LOGGIA 1 068, …), 5 924 relacje między nimi, 1 887 luk `MISSING` „ściana boczna wnęki”, które ekstraktor wystawiał sam o tych klatkach, 403 luki „vision pass” o zadaniu, którego już nie zlecamy, oraz **2 286 fałszywych wpisów `USED_AS_CORROBORATION`** w ledgerze („depth order was checked” — kod tego nie robi). Przybywa: 403 nazwane odmowy. Nic poza tym (P4′: 0 nieoczekiwanych zmian). |
| A kanał wizji (`ANALYZER_VISION=live`)? | Zamknięty tą samą regułą: perspektywa nie jest nigdy oferowana dostawcy jako fasada, a granica `apply` odmawia takiej odpowiedzi. Sprawdzone lokalnym, syntetycznym dostawcą-atrapą (bez sieci, bez pikseli wydawcy) + 2 mutanty wizji zabite. Nie wysłano żadnego obrazu do żadnego modelu. |
| Czy to klasyfikator wnętrz/zewnętrza? | **Nie.** Żadna scena nie jest klasyfikowana; ludzkiej prawdy brak (`NOT_RUN_HUMAN_TRUTH`). Render zewnętrzny traci te same nigdy niekonsumowane obserwacje co wnętrze i zostaje śledzalnym zasobem obrazu dla przyszłego 005R-EXTERIOR. |

## A. Przebieg i incydenty (pełny log: `research/analyzer-005r-router-n1/audit.md` §5)

1. Audyt źródła (plik:linia) i korekta kandydata **przed** prerejestracją: zaplanowany N1 z 005R-ROUTER nie zamykał
   kanału wizji — produkt zawsze przekazuje `nullVisionReasoner` (`run.ts:288`), więc zadanie fasady było zlecane na
   każdej klatce perspektywicznej, a z dostawcą live odpowiedź lądowałaby jako fakt fasady i ledger nazwałby ją
   potwierdzeniem. N1v = staged N1 + ta sama reguła na trasie wizji i na granicy `apply`.
2. Kontrole R0/R0rev: 3 świeże wiersze (marcowki, rarytasy-g2e, dom-pod-jarzabem) bajt-w-bajt równe zapieczętowanym
   R0/R0fix/R0rev z 005R-ROUTER; w surowych podsumowaniach różni się tylko `recogniser.ms`. Szum inkumbenta na 37
   wierszach: jedyne różniące się pole to `recogniser.ms` (23/23) ⇒ biała lista zegarowa `{recogniser.ms}` ustalona z
   samego inkumbenta, przed jakimkolwiek przebiegiem kandydata.
3. **INC-1:** pierwsze uruchomienie kontroli rozwiązywało pakiety z drzewa roboczego, w którym w tym czasie
   edytowałem kandydata — przebiegi przerwane, odrzucone nieprzeczytane; harness od tej pory odmawia R0 na brudnym
   `packages/` i zapisuje hash źródeł przed/po każdym wierszu (wszystkie 37+37+5 wierszy: `moved: false`).
   **INC-3:** restart kontenera w trakcie N1vshuf — 7 ukończonych wierszy zachowane, 30 pozostałych (w tym 3 bez
   wyjścia) przeliczone raz z tym samym seedem (dozwolone przez §3). **INC-4:** błąd parsowania w kontroli czystości
   `blind.mjs` zablokował start ślepej rundy przed jakimkolwiek pobraniem; uruchomiono raz kopię różniącą się dwiema
   liniami (opis i hash w audycie), losowania nie powtórzono.
4. Odchylenie procesowe (jawne): dwie recenzje wystartowały w trakcie ostatniej nogi Tier C (N1vshuf), nie po niej.

## B. Prerejestracja

`research/analyzer-005r-router-n1/preregistration.md` @ `dc9f735` (przed jakimkolwiek przebiegiem kandydata na danych
rzeczywistych). Addendum A (`5840531`): tylko harness (`zod` w kopii wariantu), przed pierwszym N1v. Addendum B
(`e214aa4`): diagnostyka zawartości grafu cech, tylko raportowana. Addendum C (`d069fa6`): poprawki z recenzji —
harness ślepej rundy, selektor, jedna asercja testu; bajty `src` łatki identyczne z mierzonymi. Żaden predykat nie
został zmieniony po danych kandydata (potwierdził recenzent R-B przez `git diff dc9f735 HEAD`).

## C. Macierz bramek (DEV: 37 wierszy ARCHON, 18 wierszy z kamerą)

| bramka | wynik | dowód (`stage-reports/artifacts/analyzer-005r-router-n1/`) |
| --- | --- | --- |
| P1 model / odmowa | **PASS 37/37** (23 modele bajt-w-bajt, 14 odmów: ten sam kod, reason, komunikat) | `dev/compare-R0-N1v.json` |
| P2 dowody ortogonalne | **PASS 37/37** (lista klatek z rolami i `variantByteHash` identyczna; każda klatka nieodmówiona identyczna) + testy syntetyczne (te same piksele jako elewacja; elewacja zapieczętowana `PERSPECTIVE`; render ortogonalny) | j.w., `tier-a2/` |
| P3 dowody metryczne (treść) | **PASS 23/23**; 14 odmów **NOT_MEASURED** (treść nie jest zachowywana) | j.w. |
| P4′ pełne rozliczenie diffu grafu | **PASS 37/37, 0 nieoczekiwanych zmian**; T1 15 893, T2 5 924, T3 1 887 + 403, T4 403 = liczba zasobów perspektywicznych, T5 0, T6 0 | j.w. |
| P5′ podsumowanie semantyczne | **PASS 23/23** (po usunięciu tylko `recogniser.ms`; `counts.observations` = R0 − T1) | j.w. |
| P6 kandydat (treść) | **PASS 23/23** | j.w. |
| P7′ determinizm | **PASS**: R0 = R0rev 37/37 i N1v = N1vshuf 37/37 (odwrócona kolejność + tasowanie zasobów w pakiecie), ta sama normalizacja | `dev/p7-*.json` |
| P8 ledger + kamery | **PASS 18/18**; kamery 67 = 67; 0 dodanych rekordów; każdy usunięty dotyczy dowodu perspektywicznego; 0 `USED_AS_CORROBORATION` na perspektywie po zmianie; naruszenia identyczne (jedno pre-existing G2E-5 bez zmian); usunięto 2 286 `USED_AS_CORROBORATION` (raportowane, nie cel). Addendum B: zawartość grafu cech równa 18/18 (hash różni się wyłącznie przez wejścia `observationGraphHash`/`metricEvidenceHash`, `graph.ts:228-229`) | `dev/p8-ledger.json`, `dev/feature-graph-content-addendumB.json` |
| P9 elewacje / edycje | **PASS**: 0/198 elewacji strukturalnych korpusu 005R jako perspektywa; DEV 146/146 elewacji nieodmówionych, odmówione dokładnie 403 `PERSPECTIVE_RENDER`, 0 zmian ról, 0 zmian `variantByteHash` | `dev/p9a-*.json`, `dev/p9bc-dev-frames.json` |
| P10 pokrycie / runtime | **PASS**: 37 wierszy z odmówioną perspektywą, 18 z kamerą; Node 22 i Node 18.20.4 — fokusowe zestawy 91/91; mediana czasu fazy obserwacji N1v/R0 0,84 (≤ 1,10), szczyt RSS 1 152 vs 1 067 MB = 1,08× (≤ 1,15; par 3); +2 544 B (≤ 4 KiB); `typecheck` 0; jeden `build` 0. ARM64 fizyczne: **PENDING** | `dev/p10-runtime.json`, `tier-a2/` |
| V kanał wizji | **PASS**: atrapa dostawcy live — perspektywa nigdy nie jest oferowana ani nie dostaje odpowiedzi; elewacja i render ortogonalny tak; z `nullVisionReasoner` jedyna luka zasobu to odmowa; `apply` odmawia na perspektywie i przyjmuje te same bajty jako elewację (także elewację zapieczętowaną `PERSPECTIVE`). Jedyne miejsce wywołania `VisionReasoner.analyze`/`applyVisionResponse`: `analyze.ts:198/200` | `tier-a2/` |
| Mutacje | **9/9 zabite asercjami** (6 dawnych przekotwiczonych + M7 obejście wizji + M8 brak strażnika `apply` + M9 strażnik tylko po projekcji, z recenzji) | `tier-a2/mutations.json` |

Twarde negatywy: balkon Marcówek, ganek Jarzębu, G2E-5, e-OZE, Głogowniki, Dalie — P1 (bajt-w-bajt); edycje nie
scalane — P9c; kąt widoku nie jest zgadywany — reguła czyta tylko zadeklarowaną rolę; żaden `SOURCE_EXACT` z renderu —
nic nie zostało dodane nigdzie (P4′).

## D. BLIND_13 (raz, po zamrożeniu)

Pula `holdout/pool.txt` (`800c2a1e…`), wykluczenia `excluded-families-round-13.txt` (149 rodzin, `2bd5fe03…`),
etykieta `BUILDPLAN-005R-ROUTER-N1-ADOPT-HOLDOUT`, seed `SHA256(d069fa6… + etykieta)`, n = 1 454, i1 = 547, i2 = 113.

| dom | wynik R0/N1v | odmówione klatki perspektywiczne | predykaty | werdykt |
| --- | --- | --- | --- | --- |
| h1 `dom-w-jasminowcach` (2 E) | typowana odmowa `RECONSTRUCTION_FAILED / MODEL_EMISSION_FAILED` po obu stronach (ograniczenie inkumbenta, nie tego etapu) | 6 | P1, P2, P4′ PASS (0 nieoczekiwanych; −251 obs., +6 odmów); P3/P5′/P6 NOT_MEASURED; P8 NOT_EXERCISED | **PASS** |
| h2 `dom-przy-skwerze` (E ver. 2) | model | 9 | P1–P6 PASS, P4′ 0 nieoczekiwanych (−376 obs., +9 odmów); P8 PASS (kamery 4 = 4, −133 `USED_AS_CORROBORATION`, 0 dodanych) | **PASS** |

`BLIND_13: PASS` (obie rodziny niewidziane, obie z wykonanym celem). Werdykty: `blind13/verdict-h{1,2}.json`
(tylko identyfikatory, liczby i hashe; żadne piksele ani podpisy wydawcy).

## E. Recenzje (jedna runda, dwie, równolegle)

`reviews/dispositions.md`. R-A (źródło/semantyka/proweniencja): brak P0/P1. R-B (bramki/harness/wizja): brak P0;
**P1** — harness ślepej rundy nie wymuszał jednokrotności ani hashy (naprawione przed zamrożeniem); P2 — selektor
przyjąłby drugie losowanie (naprawione), mutant strażnika `apply` przeżywał (test + M9). **Ujawnione, niezmienione:**
te same etykiety wersji (`ANALYSIS_SERVICE_VERSION 1.1.0`, `cv.*`) dają teraz inny graf/hashe na stronach z renderami
(żaden cache ani akceptacja nie kluczuje po nich — decyzja o podbiciu wersji do koordynatora); próbka
`apps/web/src/sample-observations.json` ma klatkę perspektywiczną z 49 obserwacjami fasady (nieaktualna względem
analizatora; UI zamrożone); dev-skrypt `source-analyzer/scripts/marcowki.ts` zliczy 0 LVC na renderach; tryb
`REPLAYED_GRAPH` (tylko skrypty dev) przenosi stary graf bez bramki.

## F. FAST CI — dobór i budżet

| warstwa | co uruchomiono | czas |
| --- | --- | --- |
| Tier 1 / A | vitest `source-analyzer` + `source-vision` (Node 22 i Node 18), 9 mutantów, self-test komparatora | ~10 min łącznie |
| Tier B | 5 kotwic (marcowki, dom-pod-jarzabem, rarytasy-g2e, kosacce-clean, A00) | ~12 min |
| Tier 2 / C | 32 + 37 przebiegów DEV (N1v, N1vshuf), 18 ledgerów, `typecheck`, jeden `build` | ~2,5 h (z restartem kontenera) |
| Tier 3 | BLIND_13 raz; jeden fast-forward lustra, jeden pełny CI | ~45 min + CI |
| **NOT_RUN** | pełne `npm test`, `npm run e2e` (Playwright), emulator / testy UI Android lokalnie — brak zmiany zależności, UI ani buildu; pokryje je jedyny przebieg CI | — |

## G. Granice źródeł i prywatności

Publiczne strony wolno zwyczajnie czytać i streszczać fakty; to nie jest licencja na masowe pobieranie, redystrybucję
ani wysyłanie rysunków do modeli. W tym etapie: tylko kwalifikujące się, już zbuforowane dane ARCHON DEV + dwie strony
ślepej rundy pobrane raz kodem produkcyjnym (cache poza Git); 0 pikseli do zdalnych modeli; w Git tylko identyfikatory,
liczby i hashe. Historyczne oznaczenia `SOURCE_NOT_USABLE` (DobreDomy itd.) zostają jako klasyfikacja ryzyka; 35
zapieczętowanych `source-package.json` i historia Git — bez zmian, decyzja OWNER-a.

## H. Odtworzenie

```
node research/analyzer-005r-router-n1/variant.mjs setup --work $W/variant-N1v --rev 0f2c347 --patch research/analyzer-005r-router-n1/candidate/n1v-production.patch
node research/analyzer-005r-router-n1/replay.mjs --work $W --label N1v --config $W/variant-N1v/vite.config.mjs --par 3
node research/analyzer-005r-router-n1/replay.mjs --work $W --label N1vshuf --config $W/variant-N1v/vite.config.mjs --order reverse --shuffle N1-ADOPT --par 3
python3 -I research/analyzer-005r-router-n1/compare_n1.py predicates $W/runs-prior/R0 $W/runs/N1v out.json A-override:$W/runs-prior/R0fix
python3 -I research/analyzer-005r-router-n1/compare_n1.py determinism $W/runs/N1v $W/runs/N1vshuf out.json
sh research/analyzer-005r-router-n1/ledger-run.sh $W N1v <18 rows>; python3 -I research/analyzer-005r-router-n1/p8_n1.py $W/ledger-prior $W/ledger-N1v out.json
node research/analyzer-005r-router-n1/mutations.mjs out.json      # on a tree carrying the patch
```

## I. Ograniczenia i rekomendacja (jedna, nieuruchomiona)

Brak ludzkiej prawdy o scenie; P3/P5′/P6 nie mierzone na odmowach; ARM64 fizyczne PENDING; kanał wizji sprawdzony
tylko atrapą. Rekomendacja dla koordynatora: decyzja o podbiciu etykiety wersji analizatora (R-A F1) i odświeżeniu
próbki web (R-A F2) jako osobny, mały krok — nie część tego etapu.
