# STAGE BUILDPLAN-ANALYZER-005T-N3-ROOF-DATUM-RECOVERY

**Werdykt: `SAFE_ROOF_DATUM_RECOVERY_REAL_3D`.** Odebrany wcześniej `dom-w-gozdzikowcach` (`m79923e950094d`) daje teraz
prawdziwą scenę `COMPLETED` z dachem dwuspadowym 40°. To jest **przybliżony podgląd wizualny**. Kalenica nie została
wydrukowana: wyprowadzono ją ze ścianki kolankowej i kąta, sprawdzono z opublikowaną wysokością budynku i oznaczono
`ASSUMED_FOR_RENDERING`. Wynik niesie ostrzeżenie LIMITING `APPROXIMATE_ROOF_DATUM`. OWNER nie oglądał sceny
(**NOT_RUN**).

| | |
| --- | --- |
| Repozytorium / gałąź | `damiankrok/BuildApp`, `analyzer/005t-n3-roof-datum-recovery-v1` |
| Baza | `ae63f12599fb2bc7c95bc591775e3fa20c3c7756` (HEAD = origin, czysto) |
| Mirror | `claude/new-session-3kzcgh` = `bfaf286e…3d43449`, nietknięty |
| CI / APK / emulator / testy JVM Androida / holdout | **NOT_RUN** |
| Prerejestracja | `research/analyzer-005t-n3-roof/preregistration.md`: napisana przed pierwszą zmianą w produkcji |

## 1. Fakty źródłowe i ich odniesienie

Fakty pochodzą z jednej paczki, czyli z tej samej edycji. Wydawca jest jedynym źródłem: kąt, ścianka i wysokość to
jego deklaracje, a nie trzy niezależne potwierdzenia.

| fakt | wartość | proweniencja |
| --- | --- | --- |
| rodzaj dachu | GABLE | `PUBLISHED_SPECIFICATION` („dwuspadowy”) |
| kąt | 40° | `PUBLISHED_SPECIFICATION` (`metric-spec-roof-angle-…`) |
| oś kalenicy | X | domyślna oś layoutu („the long way”); osobno zapisane jako `AMBIGUOUS` |
| bryła / rozpiętość w poprzek kalenicy | 13,82 × 9,50 m → h = 4,75 m | rzut, `SOURCE_DERIVED` |
| podłoga poddasza F | 2,80 m | **konwencja** (`ASSUMED_FOR_RENDERING`): przekrój ma jeden znacznik poziomu (2,46 m), a drabina potrzebuje ≥ 2 |
| ścianka kolankowa K | 1,15 m | `PUBLISHED_SPECIFICATION` (`metric-spec-knee-wall-…`) |
| wysokość budynku H | 8,68 m nad terenem | `publishedFacts.building_height`; **nie** jest rzędną od ±0,00 |
| rzędna terenu | nieodczytana | nieznana |
| kalenica z przekroju | brak | to był pierwszy zły krok |

## 2. Pierwszy zły krok i równanie

Przed: `ridgeY = levels.topDatum` = undefined (`reconstruct-v2.ts:456`). Bez tej wartości gałąź dachu głównego się nie
wykonuje, budynek nie ma dachu, wysokość komina wychodzi 0 i model kończy się `MODEL_EMISSION_FAILED`.

Reguła (`packages/reconstruction/src/v2/roof-datum.ts`, generyczna, uruchamiana **tylko bez wydrukowanej kalenicy**):

```
R = F + K + h · tan(pitch) = 2,80 + 1,15 + 4,75 · tan 40° = 7,936 m        (eave = F + K = 3,95 m)
H − R = 8,68 − 7,936 = 0,744 m  ∈ [0,05; 1,78]   (teren 0,05–1,5 m, zakres już używany przez solver, + pokrycie 0–0,28 m)
```

Zakres jest spójny, więc reguła przyjmuje datum. Dla osi Z wyszłoby R = 9,748 m i H − R < 0, czyli sprzeczność. Ten
wynik jest zapisany, ale nie służył do wyboru osi: oś pozostała ta, którą layout wybrał wcześniej.

Kolejność: kalenica z przekroju ma pierwszeństwo przed tym przybliżeniem, a przybliżenie przed brakiem dachu. Datum
zasila **wyłącznie** dach i wysokość najwyższej kondygnacji. Rejestracja elewacji zostaje na wydrukowanych rzędnych,
więc żaden render nie jest mierzony w przybliżonej skali.

Etykiety:
- cecha dachu: `SOURCE_DERIVED` zamiast `SOURCE_EXACT`;
- `ridgeY` i `eaveY`: `ASSUMED_FOR_RENDERING`;
- `printed: false`;
- w kandydacie dochodzi wpis `AMBIGUOUS` „the ridge height of the main roof” z pełnym uzasadnieniem i krok solvera;
- wynik niesie nowe pole `roofDatum`;
- warning LIMITING `APPROXIMATE_ROOF_DATUM` („…its heights, and the chimney's, are for viewing only”). Android liczy
  go już istniejącą regułą `severity != INFO`, bez zmiany protokołu.

Nie zmieniono: bramek rzutu, topologii ścian, OCR, łańcuchów, walidatora komina ani routera fasad. Fakt
`building_height` wchodzi wyłącznie do tego sprawdzenia; nie trafia do wyboru obrysu.

## 3. Przed / po: to samo źródło

Wejście w obu biegach to zapieczętowany graf N1v i metryki `f747d8a4…4aaf`. Pełny bieg był offline, z PP-OCRv6 w
workerze, bez dostępu do sieci.

| | przed (`ae63f12`) | po |
| --- | --- | --- |
| wynik | `MODEL_EMISSION_FAILED` (`placeChimney chimney-0`, wysokość 0) | **`COMPLETED`** |
| model sha256 | — | `a612a399…d33f` (solver i pełny bieg: identyczny) |
| scena | — | `50002e00…989c`, 423 540 B, **162 siatki**, 3 736 trójkątów, 109 obiektów pod własnymi id; round-trip OK, replay BYTE_IDENTICAL |
| dach | 0 | **1 × GABLE 40°**, oś X, kalenica 7,936 m, `eaveOffset` 1,15 m (= ścianka), 1 siatka `roof-main` (obie połacie, jedno id) |
| poddasze | — | ściany `FOLLOW_ROOF` przycięte do połaci; nie ma pudła pełnej wysokości |
| komin | refusal | `chimney-0` stoi, wysokość 7,836 m = istniejąca konwencja (0,10 m pod kalenicą). Wysokość `ASSUMED`; wierzchołek nie jest widoczny na żadnym renderze, więc nie ma wymyślonego czubka |
| bryły / otwory / pokoje | — | 1 / 17 / 6 |
| jakość cech | — | L0 11, L1 80, L2 7 |
| zamknięcie | — | 0 błędów złączy zewnętrznych, 60 uwag wewnętrznych |
| rezydua widoków | — | 0 z 0. **To nie jest sygnał jakości**: bez wydrukowanej kalenicy żadna elewacja nie jest rejestrowana, więc nie ma czego sprawdzać |
| ostrzeżenia | — | INFO ×3; **LIMITING**: `APPROXIMATE_ROOF_DATUM`, `LAYOUT_STOREY_COVERAGE_DISAGREES` (obszar poddasza wystaje 33,0 m² poza bryłę), `INVARIANT_VIOLATIONS` (1) |

Opisowo: dwukondygnacyjna bryła 13,8 × 9,5 m z dachem dwuspadowym 40° i kominem. Okien jest tylko 5, bo przy braku
zarejestrowanych elewacji wysokości otworów pochodzą wyłącznie z rzutu i konwencji. Rozpoznawalności nikt nie ocenił.

## 4. Kontrole i negatywy

Kontrole na zapieczętowanych N1v (solver):

| kontrola | wynik |
| --- | --- |
| `rarytasy-g2e` (`m84f2903cb8e14`) | `9f5fd342…21e7` = |
| `dom-w-cieszyniankach` (HIP) | `a96afbb1…1ad3` = |
| `marcowki` | `6152770f…d64f` = |
| A01 (`m60124f28f071a`) | `4ced0179…6b54` = |

Wszystkie 4 bajt w bajt. Reguła działa tylko wtedy, gdy nie ma wydrukowanej kalenicy, a każda z kontroli taką ma.

Syntetyczne negatywy (`packages/reconstruction/test/roof-datum.test.ts`, 8 testów) — reguła odmawia, gdy:
- wydrukowana kalenica istnieje (pierwszeństwo przekroju);
- brak wysokości budynku, są dwie różne albo wartość jest niewiarygodna (86,8 m);
- wysokość przeczy geometrii (7,5 m albo 10,5 m);
- wydrukowany teren nie pasuje (−0,2 m odmowa, −0,6 m akceptacja);
- oś odwrócona na Z (sprzeczność, odmowa);
- brak ścianki kolankowej, ścianka 0,15 m albo dwie różne ścianki;
- kąt bez autorytetu źródła albo brak kąta;
- dach HIP, FLAT, UNKNOWN, MONO albo brak dachu — żaden nie jest kierowany przez regułę dla dwuspadowego.

Krzyżowej edycji nie da się zasymulować w tej funkcji, bo czyta ona fakty wyłącznie z jednej paczki run'a. Zapisuję to
jako ograniczenie, nie jako test.

Kontrakt ostrzeżenia (`warnings.test.ts`, +1): `APPROXIMATE_ROOF_DATUM` jest LIMITING i wchodzi do zbioru, który Android
liczy jako ograniczający. Bez datum ostrzeżenie się nie pojawia.

## 5. Testy (zmierzone)

- `npx tsc -p tsconfig.json`: zielono.
- vitest celowane: `roof-datum` (8), `warnings` (12), `chimney-height-refusal` (2), `exterior-frame-fit` (5),
  `fit-and-levels` (12) = **39/39**.
- Architektura: `generalization`, `analyzer-v2`, `analyzer`, `research-isolation` = **111/111**.
- Pełnego `npm test`, e2e, 37 wierszy, CI, emulatora ani APK nie uruchamiano.

## 6. Co zostaje nieznane i ograniczenia

- Podłoga poddasza (2,80 m) jest konwencją. Przy niej kalenica jest spójna z 8,68 m, ale nie jest zmierzona; inna
  rzeczywista podłoga przesunęłaby cały dach.
- Rzędna terenu i grubość pokrycia przy okapie są nieznane (B przyjęte jako 0).
- Oś kalenicy to domyślna oś layoutu. Sprzeczność osi Z z wysokością ją wspiera, ale tego nie użyłem do wyboru.
- Wierzchołek komina nie jest widoczny w żadnym widoku; jego wysokość to istniejąca konwencja. Osobnego typu
  `UNKNOWN_CHIMNEY_TOP` nie ma. Brak jest nazwany w ostrzeżeniu i we właściwości `height: ASSUMED`.
- Model nie nadaje się do przedmiaru ani wyceny: dach i wysokości są wyłącznie do oglądania.
- 33 m² obszaru poddasza wystaje poza bryłę; to osobne, już istniejące ostrzeżenie layoutu.
- Etykieta wersji solvera nie została podniesiona: zmienia się wyłącznie wynik domów dotąd odrzucanych.

## 7. Pliki

- `packages/reconstruction/src/v2/roof-datum.ts` (nowy), `reconstruct-v2.ts` (wpięcie, etykiety, `roofDatum`),
  `v2/index.ts` (eksport);
- `packages/analysis-service/src/warnings.ts`, `run.ts` (ostrzeżenie);
- testy: `packages/reconstruction/test/roof-datum.test.ts`, `packages/analysis-service/test/warnings.test.ts`;
- `research/analyzer-005t-n3-roof/preregistration.md`, `results.json` (bez źródeł).

Następna decyzja należy do koordynatora: szybki APK dla OWNER-a z A01 i Goździkowcami do oceny wizualnej.
