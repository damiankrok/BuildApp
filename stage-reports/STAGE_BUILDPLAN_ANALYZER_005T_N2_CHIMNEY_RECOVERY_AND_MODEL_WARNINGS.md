# STAGE BUILDPLAN-ANALYZER-005T-N2-CHIMNEY-RECOVERY-AND-MODEL-WARNINGS

**Werdykt: `NO_SAFE_CHIMNEY_RECOVERY`.** Komin jest tylko pierwszym objawem; za nim dom nie ma żadnego dachu.
Odzyskanie komina dałoby dwukondygnacyjne pudło bez dachu w miejscu domu, który wydawca drukuje z dachem dwuspadowym
40° i ścianką kolankową 1,15 m. Odmowa zostaje. **Zero zmian w kodzie produkcyjnym.** Ostrzeżenia A01 są w produkcie
poprawne; błędny był tylko zapis w raporcie i JSON etapu V1 i ten zapis poprawiono.

| | |
| --- | --- |
| Repozytorium / gałąź | `damiankrok/BuildApp`, `analyzer/005t-n2-chimney-recovery-warnings-v1` |
| Baza | `987a354f5adcae2130fc2adc268f92305ab204ff` (lokalny HEAD = zdalny, czysty worktree) |
| Mirror | `claude/new-session-3kzcgh` = `bfaf286e95105c2cdb32df2d298d3cd93bd43449`, nietknięty |
| CI / APK / emulator / holdout | **NOT_RUN** |
| Bramka wizualna OWNER-a na telefonie | **OTWARTA** (A01 nie jest odebrany wizualnie; Goździkowce nie ma sceny) |

## 1. Goździkowce: pierwszy zły krok

Wejście to wiersz `dom-w-gozdzikowcach` (`m79923e950094d`). Graf obserwacji N1v został odtworzony, a dowody metryczne
wyekstrahowano raz, OFFLINE, z istniejącego cache, przez PP-OCRv6 (`research/analyzer-005t-preview-first/seal-case.ts`).
Hash metryk zgadza się z odmową N1v: `f747d8a4…4aaf`. Nic nie pobierano z sieci.

**Przed:** `BUILDING_MODEL` / `MODEL_EMISSION_FAILED` na poleceniu 135 `placeChimney`, id `chimney-0`, kod
`INVALID_COMMAND` (*Number must be greater than 0*: wysokość).

Pomiar (debug solvera, `research/analyzer-005t-n2/replay-solver.ts`; linia debug była tymczasowa i została cofnięta):

| fakt | wartość |
| --- | --- |
| komin | rzut 4,258–5,202 × 2,784–3,652 m (0,94 × 0,87 m), `SOURCE_DERIVED`: *solid block drawn on storeys 0, 1, not seen above the roof on any render* |
| `topY` komina | brak (żaden render go nie pokazuje) |
| `mainRoof` | **brak**; dachów przy bryłach 0 |
| bryła | `main` 0–13,82 × 0–9,50 m, kondygnacje 0 i 1, ściana 0,304 m |
| przyczyna braku dachu | nie odczytano rzędnej kalenicy z przekroju (`ridgeY = levels.topDatum` = undefined, `reconstruct-v2.ts:456`), więc dach główny nie powstaje (`:561`), a elewacje nie są rejestrowane (`VIEW_REGISTRATION_NO_ANCHORS`) |
| wydawca | „dwuspadowy, nachylenie 40 st.”, wysokość budynku 8,68 m, ścianka kolankowa 115 cm |

Mechanizm: emiter liczy `top = c.topY ?? (mainRoof ? ridgeY − 0,1 : 0)`. Bez dachu i bez zmierzonego wierzchołka
wynik to 0, a więc wysokość 0. Sam solver w `roofTopY()` przyjmuje w takim przypadku `wallTop` najwyższej kondygnacji.
To jest niespójność emitera, ale nie jest to ten sam przypadek co rama okna w V1, bo za nią stoi prawdziwa luka w źródle.

**Wariant diagnostyczny (NIE zacommitowany):** przyjąłem `top = wallTop` najwyższej kondygnacji, tak jak w solverze.
Bieg kończy się wtedy modelem `9ab62e9e…2039`, ale ten model ma **0 dachów**, poddasze jako pełne pudło 2,80 m
(parter 0–2,80, poddasze 2,80–5,60), 5 okien i komin 5,60 m schowany w bryle. Każdy z 23 zbudowanych wierszy N1v ma co
najmniej jeden dach. To byłby pierwszy model bez dachu i fałszywa sylwetka dokładnie w cesze, po której dom się
rozpoznaje. Brief nazywa to wprost: sprzeczność ze źródłem, odmowa zamiast fałszywego 3D. Jedyną drogą do sceny byłby
typowany wynik „model orientacyjny bez dachu”. To wymaga nowej klasy wyniku w protokole i na Androidzie, czyli
szerokiego przeprojektowania, którego ten etap zabrania.

**Po:** bez zmian. Kod produkcyjny jest identyczny z `987a354`, odmowa `MODEL_EMISSION_FAILED` zostaje. Osobnego biegu
„po” nie robiłem, bo diff jest pusty.

**Precyzyjny szew blokujący:** brak rzędnej kalenicy (`levels.topDatum`) przy znanym kącie dachu z danych wydawcy.
Opublikowana wysokość budynku 8,68 m mogłaby być kandydatem na kotwicę kalenicy, ale to decyzja o solverze dachu
i o proweniencji (jeden fakt wydawcy jako rzędna), a nie poprawka komina. Poza zakresem tego etapu.

## 2. Ostrzeżenia A01: rzeczywisty wynik

Sprawdziłem rzeczywisty `summary.json` pełnego biegu V1 na zapieczętowanym wejściu (poza Gitem), a nie `cases.json`:

| pole | wartość |
| --- | --- |
| `verification.closure.exteriorErrors` | 14 |
| `residualsOutsideTolerance` / `residuals` | 2 / 6 |
| `OPENINGS_NOT_BUILT` (z `openingFits` DROPPED) | 1: `shared-opening-0-rear-2-1` |
| `warningDetails` | INFO: `GRAPH_REPLAYED`, `SOURCE_BYTE_IDENTICAL`, `GUESSED_ADDRESS_HTTP_STATUS`; **LIMITING**: `LAYOUT_STOREY_COVERAGE_DISAGREES` ×2, `OPENINGS_NOT_BUILT`, `RESIDUALS_OUTSIDE_TOLERANCE`, `EXTERIOR_JOINTS`, `INVARIANT_VIOLATIONS` |
| Android `limitingWarnings` | 6. Reguła `AnalyzerDtos.kt` `AnalysisSummary.limitingWarnings` = `warningDetails` o `severity != INFO` (sprawdzone w kodzie, test JVM nie uruchomiony) |
| stan widoczny dla użytkownika | `AnalyzerScreen.kt` `Result`: ikona ostrzeżenia, „Model gotowy z ograniczeniami”, liczba ostrzeżeń, „Części elementów analiza nie rozstrzygnęła albo zgłosiła ostrzeżenia…” |

**Wniosek: w produkcji nie ma błędu.** Mapowanie (`warnings.ts`), serializacja i prezentacja na Androidzie są poprawne.
Błąd był w zapisie V1: skrypt czytał nieistniejące pole `limiting` zamiast `severity`. Poprawione:
`research/analyzer-005t-preview-first/cases.json` (`limitingWarnings` = 6 kodów, z adnotacją korekty) oraz wiersz
„ostrzeżenia” w raporcie V1. A01 **nie jest** czystym wynikiem jakościowym: ma 6 ograniczających ostrzeżeń, grubość
ściany 0,152 m nie jest niezależnie potwierdzona i nikt nie ocenił go wizualnie.

## 3. Testy (zmierzone)

| co | wynik |
| --- | --- |
| (a) Goździkowce przed, prawdziwe wejście z cache | odmowa odtworzona bit w bit (hash metryk = N1v); „po” = przed, bo diff produkcji jest pusty |
| (b) A01: rzeczywista projekcja ostrzeżeń | §2 |
| (c) kontrola `rarytasy-g2e` (`m84f2903cb8e14`) | model `9f5fd342…21e7` = zapieczętowany |
| (d) negatyw syntetyczny | `chimney-height-refusal.test.ts`: komin o wysokości 0 nadal `INVALID_COMMAND` |
| (e) round-trip sceny | ten sam plik: komin z podaną wysokością, deterministyczna serializacja, `loadBundle` OK, `chimney-0` i `ring-w0` pod własnymi `objectId` |
| vitest, celowane | `chimney-height-refusal` (2) + `exterior-frame-fit` (5) + `warnings` (11) = **18/18**; `tests/architecture` research-isolation + generalization = **77/77** |
| typecheck | nieuruchomiony: zmieniony TypeScript to tylko test i skrypt research; vitest go transpiluje |

Zliczenia tylko w sprawdzonych przypadkach: Goździkowce dalej odrzucony. Licznik N1v po V1 (24/37 zbudowanych,
13 odmów) jest oczekiwaniem, nie wynikiem: pełnego biegu 37 wierszy nie wykonano.

## 4. Pliki

- `packages/analysis-service/test/chimney-height-refusal.test.ts`: negatyw i round-trip.
- `research/analyzer-005t-n2/replay-solver.ts`: harness (tylko solver, filtr linii debug, wyjście poza repo).
- `research/analyzer-005t-n2/diagnosis.json`: przypadek, hasze, wariant diagnostyczny, ostrzeżenia A01, kontrola
  (bez źródeł).
- `research/analyzer-005t-preview-first/cases.json`, `stage-reports/STAGE_BUILDPLAN_ANALYZER_005T_PREVIEW_FIRST_V1.md`:
  korekta zapisu ostrzeżeń A01.

## 5. Następny krok (decyzja koordynatora)

Scena A01 istnieje i ma uczciwe ostrzeżenia, więc mały APK dla OWNER-a do obejrzenia domu jest możliwy. Decyzję
podejmuje koordynator. Dla Goździkowców jedyny sensowny ruch to etap solvera dachu: kotwica kalenicy z wydrukowanego
kąta i opublikowanej wysokości budynku, z jawną proweniencją. To nie jest poprawka komina.
