# STAGE BUILDPLAN-ANALYZER-005R-ROUTER — router ról źródła i ochrona geometrii przed wnętrzami

**Werdykt: `NO_SAFE_ADOPTION`** · `RESEARCH_RESULT: FIRST_BAD_LOCATED + N1_MEASURED_NOT_ADOPTED` ·
`PRODUCTION_CHANGE: NONE` · `REAL_TRUTH: NOT_RUN` · `MODEL_DIFF: NONE` (produkcja bez zmian; w kontrfakcie N1: 23
modele bajt-w-bajt identyczne + 14 identycznych typowanych odmów na 37 wierszach DEV — porównanie bitowe, nie prawda o
scenie) · `TARGET_CLASS_EXERCISED: tak (381 klatek perspektywicznych w 34 wierszach)` ·
`BLIND_13: NOT_RUN` · `ARM64: PENDING`.

Baza `8d414567e16e9a790bcf56cbebc10d778c6eb268` (sprawdzona: upstream, lustro i lokalny HEAD równe; CI `38681024256`
attempt 2 `success`). Gałąź `analyzer/visual-source-role-guard-v1`. Bez APK, bez 005R-EXTERIOR, bez 005S.

## Podsumowanie dla OWNER-a

| pytanie | odpowiedź z pomiarów |
| --- | --- |
| Dlaczego wnętrza trafiają do analizy elewacji? | **Pierwsza niebezpieczna asercja dowodowa (deterministyczna):** `analyze.ts:164-166` kieruje każdą klatkę `PERSPECTIVE_RENDER` do pięciu ekstraktorów **ortogonalnej** fasady. Rola (`archon.ts:98`, „wizualizacja” → `PERSPECTIVE_RENDER`) nie jest błędna — wnętrze *jest* renderem perspektywicznym; jest niepełna (brak zakresu sceny). Błąd leży w routingu: wszyscy konsumenci obserwacji fasady (metryki `extract.ts:88-89`, tożsamość między widokami `identity.ts:70`, rejestracja `solve.ts:312`) czytają tylko klatki ortogonalne, a sam producent routuje po `document`, nie po `projection`. Ledger potem twierdzi, że obserwacje posłużyły do sprawdzenia głębi (`reconstruct-v2.ts:1177`), czego żaden kod nie robi (kamera czyta raster, `camera.ts:838`). |
| Czy obserwacje z renderów perspektywicznych (w tym wnętrz) zmieniają dziś model 3D? | **Na 37 znanych wierszach DEV, przez kanał deterministyczny — nie.** Usunięcie wszystkich 15 893 obserwacji fasady z 403 klatek perspektywicznych (wnętrz i zewnętrznych razem; N1) daje 23 modele bajt-w-bajt identyczne i 14 identycznych typowanych odmów, te same dowody metryczne (treść porównana na 23 wierszach z modelem; na 14 odmowach `NOT_MEASURED`), te same kamery. Kanał wizji (zdalny; domyślnie wyłączony, włączany jednym udokumentowanym przełącznikiem serwera `ANALYZER_VISION=live`) nie był testowany; nowe domy nie były testowane. Szkoda jest w **dowodach i proweniencji**: obserwacje fasady (kalenice, otwory) zapisane na klatkach perspektywicznych i wpisy „USED_AS_CORROBORATION” o sprawdzeniu, którego żaden kod nie wykonuje (liczby P8 w §F). Ile z tych klatek to wnętrza — `NOT_MEASURED` (tylko struktura wydawcy). |
| Czy da się wiarygodnie rozróżnić wnętrze / zewnętrze? | **Nie na dostępnej prawdzie.** Ludzkich etykiet brak (`NOT_RUN_HUMAN_TRUTH`; przygotowano lokalne zadanie spot-review, 300 pozycji). Struktura strony to jeden kanał wydawcy i ma znane błędy (15 widoków zewnętrznych w karuzeli wnętrz). R1: **0 z 1 352 zasobów** ma dwóch świadków sceny z różnych klas niezależności, więc R2 (bramka sceny) nie bramkuje niczego. |
| Czy wdrożono poprawkę? | **Nie.** Mój wariant N1 (bramka projekcji, bez klasyfikacji sceny) przeszedł P1 (model), P2, P3, P6, P8, P9, P10 i 6/6 mutacji, ale **nie przeszedł P4, P5 i P7 w brzmieniu prerejestracji** (P4: usunięte luki obejmują też własne luki ekstraktora fasady na klatkach perspektywicznych; P5/P7: różni się pole zegarowe `recogniser.ms` — ten sam predykat nie przechodzi też R0 vs R0rev, czyli inkumbent sam ze sobą). Reguła §6.1 ustalona przed wynikami mówi: dowolna porażka → `NO_SAFE_ADOPTION`. Poprawka predykatu po odpieczętowaniu nie może nieść wdrożenia; N1 jest gotowy jako kandydat na osobny etap (`research/analyzer-005r-router/n1-staged/`). |

## A. Baza, zamrożenie, zakres

- Zamrożenie: `research/analyzer-005r-router/freeze-manifest.mjs` (pochodna 005R + `scopeFiles` per plik dla
  `packages/source-package` i `packages/source-analyzer`). Start `67d2cf8`. Koniec: **FREEZE: IDENTICAL** — żaden plik
  produkcyjny, test poza `tests/architecture/research-isolation.test.ts`, asset, WASM ani model nie zmienił się.
- Dotknięte ścieżki: `research/analyzer-005r-router/`, `stage-reports/artifacts/analyzer-005r-router/`, ten raport,
  `PROJECT_STATUS.md` (dopisek na końcu etapu), blok 005R-ROUTER w `tests/architecture/research-isolation.test.ts`.
- Dysk: 593 MB wolnego na starcie; usunięto wyłącznie odtwarzalne `node_modules` starych snapshotów (`work005f/snap-*`).
- **Incydent operatorski (jawnie):** przy liczeniu wierszy zaimportowałem `replay.mjs`, który wykonywał się przy imporcie
  i nadpisał 3 ukończone wiersze R0 (jarzabem, arkadiach, modrzewnicy). Procesy ubite; skrypt zabezpieczony
  (`main()` tylko przy uruchomieniu bezpośrednim); te 3 wiersze (i 3 bez zapisanych dowodów metrycznych) policzono
  ponownie jako **R0fix** przez niezałatany alias bazy. Na tych wierszach R0fix zastępuje R0; R0rev (cała baza przez ten sam alias) jest z nim zgodny 37/37.

## B. Audyt (Faza A)

`stage-reports/artifacts/analyzer-005r-router/architecture/first-bad-and-consumer-map.md` + `source-role-contract-map.json`.
Pełny graf discovery → claims → merge → asset → pakiet → routing → graf → metryki → rejestracja → kamera → ledger →
kandydat → model, z liniami kodu bazy. Najważniejsze:

- **FB-0 (utrata informacji):** `data-fancybox-position` nie jest czytane nigdzie (`archon.ts`, `discovery.ts`: 0 trafień).
- **FB-1:** `archon.ts:98` — rola poprawna na swojej osi, niepełna.
- **FB-2 (pierwsza niebezpieczna asercja *deterministyczna*):** `analyze.ts:164-166`. Routing wizji (`analyze.ts:179` →
  `tasks.ts:38`) ma ten sam defekt, gdy skonfigurowano dostawcę zdalnego — kanał wizji pozostaje otwarty (domyślnie
  wyłączony; włącza go `ANALYZER_VISION=live` w `apps/analyzer-api`, a w aplikacji lokalnej nie ma dostawcy;
  niemierzalny bez wysyłania pikseli).
- **FB-3:** `reconstruct-v2.ts:1177` — fałszywa proweniencja w ledgerze.
- Mapa konsumentów (§4): żaden konsument nie przenosi obserwacji z klatek perspektywicznych do modelu, sceny, poziomów
  jakości ani ostrzeżeń; zmieniają się hashe niosące tożsamość grafu (metryki, układ, graf cech, zbiór hipotez) i to,
  co pokazuje panel Sources (web) i ekran analizatora (Android: liczba obserwacji, prefiksy hashy).
- Promień rażenia zmiany enumu (§5): nowa wartość `DocumentRole` byłaby odrzucana przez starsze APK (`z.enum`) — powód,
  by nie migrować enumu w tym etapie.
- Dwa przeglądy przed implementacją (`reviews/pre-skeptic.md`, `reviews/pre-code-critic.md`): sceptyk (11 ustaleń,
  7× P1) i krytyk kodu (9 ustaleń, 3× P1: hashe niosące tożsamość grafu, kanał wizji, czerwony test). Wszystkie
  rozstrzygnięte w prerejestracji lub addendum A **przed** jakimkolwiek przebiegiem kandydata.

## C. Prerejestracja

`research/analyzer-005r-router/preregistration.md` (`014781c`) i `preregistration-addendum-A.md` (`0992344`), oba przed
pierwszym przebiegiem N1/R1/R2w. Warianty R0, R0copy, R1, R2, R2w, R3 (NOT_RUN), N1; predykaty P1–P10; weta; reguła
decyzji; plan ślepej rundy 13. **Addendum A (przed N1) to re-specyfikacja, nie tylko zaostrzenie:** P3 z równości hasha
na równość treści po wyczyszczeniu pól tożsamości; P5 dopuszcza `metricEvidenceHash`; P6 czyści wszystkie identyfikatory
i hashe `hypothesisSet*`/`featureGraph*`/`structuralLayout*`/`metricEvidence*` zamiast wymagać równego
`hypothesisSetHash` (treść kandydata nadal musi być identyczna). Każda zmiana wynika z odczytu kodu (hashe niosące
tożsamość grafu) i została zapisana przed przebiegiem. **Odstępstwo jawne:** prerejestracja mówi o 38 wierszach DEV; kwalifikujących się
wierszy jest **37** (45 EXTRACT − 8 DobreDomy). Kontrola harnessu R0copy objęła 37 wierszy zamiast 2.

## D. Prawda

`stage-reports/artifacts/analyzer-005r-router/truth-and-leakage-report.md`.

- **Ludzie: `NOT_RUN_HUMAN_TRUTH`.** Nie wymyślono weryfikacji. Przygotowano lokalne, opcjonalne zadanie
  (`truth/owner-spot-review-request.md`, `spot-review-manifest.json`): S1 15 (C1), S2 95 grup linii z 150 `widok-N`
  (C2), S3 34 wnętrza strukturalne, S4 68 elewacji, S5 88 zasobów edycji OWNER `m3ea…` i G2E-5 `m84f…` (tylko DEV).
  Claude nie otworzył żadnego obrazu i nie oznaczył niczego.
- Struktura 005R = `PUBLISHER_STRUCTURE`; każda liczba „wnętrz” w tym raporcie ma tę etykietę i nie jest prawdą.
- Dla N1: twierdzenia są bitowe (`TECHNICALLY_INDEPENDENT`) i dotyczą wyłącznie niezmienniczości.

## E. Porównanie (Faza C)

| wariant | status | wynik |
| --- | --- | --- |
| R0 | RUN, 37 wierszy (+R0fix 6, +R0rev 37) | 14 typowanych odmów (bez zmian), 23 modele; deterministyczny (R0 = R0rev bajt w bajt: model, graf, porażki) |
| R1 META-PROVENANCE | RUN (tylko badanie) | 198 INTERIOR_HINT, 39 EXTERIOR_HINT, **15 CONTESTED** (dokładnie C1), 1 100 UNKNOWN; **0** zasobów z dwiema klasami świadków — to wynika z definicji (jeden akt archiwizacji wydawcy = jedna klasa), nie jest odkryciem: na stronie ARCHON nie ma drugiego, niezależnego kanału sceny; 38 grup linii ze wskazówką sceny przekracza edycję (nie scalane) |
| R2 GATE-ONLY | RUN (z konstrukcji) | bramkuje **0** klatek — R2 ≡ R0 |
| R2w (diagnostyka, jeden świadek) | RUN, 6 wierszy | modele identyczne; bramkuje 0–12 z 18–28 klatek perspektywicznych na wiersz (bez kotwic karuzeli) i zostawia 226–815 obserwacji fasady na wiersz — bramka sceny byłaby niedopuszczalna **i** niekompletna |
| R3 | NOT_RUN | brak nowego mierzonego sygnału treści; V1/V2 wykluczone przez 005R |
| **N1 PROJECTION-CONSUMER GATE** | RUN, 37 wierszy + odwrócone/przetasowane + ledger 7 wierszy | patrz F |

## F. N1 — predykaty jak prerejestrowane

| predykat | wynik |
| --- | --- |
| P1 model | **PASS 37/37** — 23 modele bajt-w-bajt + 14 identycznych typowanych odmów (34 vs R0, 3 vs R0fix; 6 sprawdzone też vs R0fix) — Marcówki (balkon), Jarząb (ganek), G2E-5, e-OZE, Głogowniki, Dalie: bez zmian |
| P2 dowody ortogonalne | PASS (każda klatka ortogonalna: te same obserwacje, ta sama lista klatek) |
| P3 dowody metryczne (treść) | PASS na 23 wierszach z modelem (18 vs R0, 5 vs R0fix); **NOT_MEASURED** na 14 typowanych odmowach (treść nie zachowana, a hash niesie tożsamość grafu; pierwsza wersja porównania błędnie liczyła tu samą obecność hasha — poprawione po recenzji A) |
| **P4 diff grafu = dokładnie bramka** | **FAIL 37/37** — poza przewidzianymi elementami usunięte są też luki `MISSING` „the left/right side wall of the recess …”, które ekstraktor fasady sam emituje na klatkach perspektywicznych; P4 ich nie wyliczył |
| **P5 podsumowanie** | **FAIL** na każdym ukończonym wierszu — `recogniser.ms` (czas zegarowy) |
| P6 kandydat (treść) | PASS |
| **P7 determinizm** | **FAIL w brzmieniu prerejestracji** (podsumowanie bajt w bajt). Model/graf/metryki/kandydat/porażki N1 = N1shuf 37/37 (odwrócona kolejność + tasowanie zasobów w pakiecie); podsumowanie różni się tylko `recogniser.ms`. **Inkumbent też nie przechodzi:** R0 vs R0rev — 0/37 surowych podsumowań identycznych (ten sam powód), co pokazuje, że P5/P7 były wadliwie wyspecyfikowane; to nie zmienia werdyktu. Harness już wcześniej wycinał `startedAt`/`completedAt` (`run-case.ts`), czego P5 nie wymieniał — ujawnione tutaj. |
| P8 ledger | PASS 18/18 (każdy wiersz z rozwiązaną kamerą perspektywiczną; pierwsza wersja liczyła tylko 7 — poprawione po recenzji A) — usunięte tylko rekordy o dowodach perspektywicznych (w tym **2 286** `USED_AS_CORROBORATION`), 0 dodanych, 0 naruszeń ledgera, 67 rozwiązanych kamer identycznych; jedno naruszenie grafu cech na G2E-5 istnieje już w R0 i jest identyczne |
| P9 ryzyko elewacji jako renderu | PASS — 0 ze 198 elewacji strukturalnych ma rolę `PERSPECTIVE_RENDER` |
| P10 pokrycie | spełnione — 37 wierszy z klatkami perspektywicznymi, 18 z rozwiązaną kamerą |

**Wrażliwość post-hoc — NIE jest wynikiem i NIE zmienia werdyktu:** zdefiniowane po odczycie wyników N1
(`52b4884`) P4′ (każda usunięta luka zakotwiczona w zasobie perspektywicznym) i P5′/P7′ (bez pól `ms`) byłyby
spełnione. To wniosek po odpieczętowaniu, dokładnie ten typ korekty, który w 005R (Addendum C) nie mógł zmienić
werdyktu; N1 **nie** „przeszedł co do istoty” — przejdzie albo nie przejdzie dopiero w nowym etapie z predykatami
ustalonymi przed przebiegiem i ze świeżą ślepą rundą.

Testy N1 (przygotowane, niewdrożone): `packages/source-analyzer` 52/52 z łatką; nowy `projection-gate.test.ts`
(7 testów, każdy z kontrolą „te same piksele jako elewacja dają obserwacje”); zmieniona asercja
`mutations-02.test.ts:112` (stary test utrwalał zachowanie, nie wymaganie). Mutacje: **6/6 zabite** (brak bramki,
bramka tylko po dokumencie, bramkowanie elewacji, fałszywe MISSING, cicha odmowa, bramkowanie wszystkiego).

## G. Weta (brief §6)

| weto | stan |
| --- | --- |
| zero nowych fałszywie pewnych roszczeń zewnętrznych | produkcja bez zmian; N1: obserwacje ⊆ R0 |
| zero wzrostu wnętrze→zewnętrze | produkcja bez zmian (`NOT_MEASURED` na niezależnej prawdzie); N1: 0 obserwacji fasady na klatkach perspektywicznych |
| zero strat elewacji technicznych | produkcja bez zmian; N1: P2 + P9 |
| zero regresji modeli/okien/balkonów/ganków | 0 zmienionych modeli (37/37) |
| zero mieszania edycji | brak wejścia między pakietami; R1 liczy grupy przekraczające edycję, nie głosuje |
| 0 nowych SOURCE_EXACT z renderu | model bez zmian |
| 0 użycia SOURCE_NOT_USABLE | wiersze DobreDomy odrzucone przez harness (`USABLE_HOSTS`) |
| 0 naruszeń JSON/proweniencji | brak zmiany produkcyjnej; N1: 0 naruszeń ledgera |
| determinizm | produkcja bez zmian. P7 jak prerejestrowany: FAIL (pole zegarowe, także dla R0 vs R0rev); modele, grafy, metryki i porażki bajt w bajt identyczne w obu parach |

## H. Wydajność (N1, zmierzone, nie wdrożone)

Faza obserwacji średnio 39,6 s → 34,3 s (21 ukończonych wierszy, Node 22, x86, 3 równoległe przebiegi); szczytowy RSS
1 067 → 1 098 MB (szum przebiegów równoległych). Node 18 i ARM64: **NOT_RUN / PENDING** — brak zmiany runtime.

## I. Licencje, prywatność, historia Git

`stage-reports/artifacts/analyzer-005r-router/source-license-history-review.md`. ARCHON `USABLE_FOR_LOCAL_RESEARCH`
(nie sublicencja); DobreDomy/Archipelag/Domy w Stylu `SOURCE_NOT_USABLE`; wcześniejsze użycie DobreDomy:
**OWNER_DECISION_PENDING**. Żaden piksel nie trafił do zdalnego modelu. Historia: 27 cytowanych polskich fragmentów usuniętych w `91b4d61` (6 krótkich fraz wydawcy, notatki recenzentów, które je
zawierają, i jedno zdanie niebędące tekstem wydawcy) wciąż istnieje w historii (`c1ab121`, `20fffbd`, `4980b95`,
`dade188`); w `audit-raw.json` na HEAD 15 linii pasuje do usuniętych prefiksów — **wymaga sprawdzenia linia po linii**
(nie ustalono, że tekst 005R na HEAD jest czysty); **ważniejsze:** 35 śledzonych
`source-package.json` na HEAD (wcześniejsze etapy, 3 z DobreDomy) zawiera podpisy i prozę specyfikacji wydawcy.
Nic nie przepisano, nie usunięto ani nie wypchnięto siłą; decyzja należy do OWNER-a.

## J. Bramki i recenzje

`stage-reports/artifacts/analyzer-005r-router/gates.json`. Node 22.22.2. `npm install` 0; `npm run typecheck` 0;
`npm test`: 2584 zaliczone / 11 pominięte, **2 czerwone** — dwa testy `WorkerExecutor` w `apps/analyzer-api` przekroczyły
120 s, gdy na tych samych 4 rdzeniach szło 11 replayów ledgera; jedno ponowne uruchomienie samego pliku (z blokiem
izolacji): 63/63, exit 0, żaden test nie osłabiony. `npm run build` 0; `npm run e2e` **47/47**. Zamrożenie końcowe:
**IDENTICAL** (po przywróceniu śledzonych zrzutów e2e, które bramka nadpisuje). Pełny przebieg CI na wypchniętym
HEAD jest rozstrzygający — patrz handoff.

Recenzje: dwie przed implementacją (`reviews/pre-skeptic.md`, `reviews/pre-code-critic.md`), trzy po
(`reviews/post-review-dispositions.md`: źródło/semantyka, niezależność prawdy/bezpieczeństwo, runtime/prywatność).
Żadnego P0; wszystkie P1 naprawione w artefaktach; werdykt bez zmian.

## K. Ograniczenia

- Kanał wizji (zdalny, wyłączony) nadal prosi o dekompozycję fasady na renderach perspektywicznych.
- Prawda o scenie nie istnieje; żadna liczba wnętrz nie jest dokładnością.
- DEV to w całości materiał znany (prior exposure); nic tu nie jest ślepą próbą.
- Wersje analizatora służą tylko do wyświetlania; zmiana grafu nie przesunęłaby żadnego klucza pamięci podręcznej.

## L. Rekomendacja następnego kroku (jeden, do zatwierdzenia przez koordynatora; nie uruchomiony)

**005R-ROUTER-N1-ADOPT:** nowa prerejestracja N1 z poprawionymi predykatami P4′ (każda usunięta pozycja grafu
zakotwiczona w zasobie perspektywicznym) i P5′/P7′ (bez pól zegarowych), ustalonymi **przed** nowym przebiegiem; ten sam
zestaw 37 wierszy DEV jako regresja plus świeża ślepa runda 13 (nieużyte rodziny ARCHON, predykaty bitowe i pokrycie),
Node 18, ewentualnie bramka wizji po projekcji jako osobna decyzja. Łatka i testy są w `research/analyzer-005r-router/n1-staged/`.
