# STAGE BUILDPLAN N7-COUNCIL-FIX-02 — grubość ścian i ochrona pierścieni

Baza `2dadeae`, gałąź `claude/new-session-3kzcgh`, kod `f013cfc`. Solver **2.7.0**. APK **1308**.

Naprawiono potwierdzone defekty Council B-1, B-2, D-1 oraz lukę kontroli przed emisją (D-2/C-4/B-3).

Czego nie robiono:

- Walidatora `WALLS_OVERLAP` nie rozluźniono.
- Żadnego statusu nie ustawiono na siłę na COMPLETE.
- Grubości ścian nie zmniejszano, a brył nie rozciągano, żeby ominąć kolizję.
- Do produkcji nie trafia nic z badań IU (klasyfikator, CLIP, segmentatory, czyszczenie elewacji).

**Prywatnego benchmarku OWNER-a nie odtwarzałem i nie deklaruję jego naprawy.** Domu nie identyfikowałem.

## Wynik w skrócie

| Defekt | Stan po FIX-02 |
|---|---|
| B-1 — T domu jako mediana wszystkich pasm (także działowych) | naprawiony: T z pasm leżących na licach zewnętrznych, z proweniencją; brak odczytu = jawne oszacowanie |
| B-2 — layout bramkuje inną grubością (`wallM`) niż emisja (T) | naprawiony: bramka „bryła ≥ 2 ściany + pokój” i emisja używają tej samej grubości, także per bryła |
| grubość per bryła (dobudówki) | nowe: bryła, której własne lica zgodnie mówią inną grubość, jest budowana z nią |
| D-1 — rekoncyliacja zwęża pierścień poniżej 2t (0,62 → 0,57 m) | naprawiony: przesunięcie odrzucone, kolizja nazwana z liczbami; reszta modelu zachowana |
| D-2/C-4/B-3 — emisja buduje `storeyRects`, pieces i MAIN bez kontroli | naprawiony: kontrola każdego prostokąta przed emisją; odrzucona kondygnacja nie zabiera zdrowej kondygnacji pod nią |
| C-1/C-2 (dekompozycja) | **poza zakresem** (następny etap) |

## 1. Grubość ścian (B-1, B-2)

### FIRST_BAD → PRZED → POPRAWKA → PO

**FIRST_BAD.** `reconstruct-v2.ts` brał `T = decomposition.wallThickness.m`. To ważona długością mediana **wszystkich** pasm w obrysie rzutu (`bandWallThickness`). Dom, który ma więcej ścianek działowych niż elewacji, dostaje T ścianki. Layout bramkował bryły jeszcze inną wartością: `base.wallPx × max(mpp)` z całego arkusza.

**PRZED.**

| przypadek | grubość muru | wynik |
|---|---|---|
| Goździkowce | lica 0,431 m | T = 0,304 m |
| syntetyczny THICK43: mur 0,43 m i ścianki 0,20 m (więcej ścianek niż elewacji) | rysunek 0,43 m | T = 0,238 m |

**POPRAWKA.** Nowy moduł `exterior-walls.ts`:

- `exteriorFaceThickness` głosuje tylko pasmami, które:
  - biegną wzdłuż lica bryły;
  - mają linię lica w swoim zasięgu (dotyczy to zarówno lica zewnętrznego, jak i osi muru);
  - leżą większością długości na tym licu;
  - są murem, a nie kreską (długość ≥ 2,5 grubości).
- Lico, przy którym stoi inna bryła, nie głosuje.
- Wynik to ważona mediana z proweniencją, w trzech wariantach:
  - `EXTERIOR_FACE_BANDS` wraz z listą lic;
  - `ALL_BANDS_ESTIMATE`: stara mediana, oznaczona w treści jako **ESTIMATE** i zapisana jako nierozstrzygnięta;
  - `CONVENTION`: 0,38 m.
- Grubość pasma jest przeliczana większą z dwóch skal (`× max(mppX, mppY)`), tak jak dotąd przeliczano rysowany mur. Przy rejestracji anizotropowej mniejsza skala zostawiłaby wewnątrz pierścienia pasek muru, który czytnik wnętrza wziąłby za ściankę. Wyłapał to test 005Q `wall-strip (d)`.

**Jedno T w layoucie i w emisji.** `layout.ts` liczy odczyt domu i każdej bryły bazowej kondygnacji i bramkuje nim:

- `minBodySpanM`;
- `recutSlivers`;
- `bayStripsOf`;
- bramkę wąskiego paska;
- relację nośności kondygnacji.

Mediana pasm rysunku (`wallM`) zostaje wyłącznie miarą tolerancji samego rysunku: odstępów linii, kroków i dopasowania przyległości. `reconstruct-v2` bierze T z tego samego odczytu (`draft.wallThickness`). `building.wallThicknessM`, bramka layoutu i pierścienie mają więc tę samą liczbę.

**Wnętrze.** `readInterior` miało jedną liczbę na dwie rzeczy: wcięcie od lica muru zewnętrznego oraz okno grubości ścianek i tolerancje rysunku. Teraz:

- wcięcie liczone jest od muru zewnętrznego;
- ścianki i tolerancje czyta się w skali pasm rysunku (`drawnWallM`), jak dotąd.

### Grubość per bryła

`bodyWallThickness` daje bryle własny mur tylko wtedy, gdy:

- jej odsłonięte lica niosą wystarczająco pasma (dwa pasma albo jedno pokrywające co najmniej połowę odsłoniętego obwodu);
- każde lico dłuższe niż 1 m zgadza się z wynikiem z dokładnością do 1/5;
- wynik różni się od muru domu o więcej niż max(4 cm, 15 %).

| przypadek | odczyt | decyzja |
|---|---|---|
| syntetyczny STORE25: magazyn 1,05 m z murem 0,25 m przy domu 0,44 m | lico 0,264 m | pierścień magazynu 0,264 m (wcześniej 0,475 m), COMPLETE |
| Marcówki, garaż | lico wsch. 0,63 m na 7,1 m, płn. 0,45 m na 2,0 m | **sprzeczne** → mur domu, model bajt w bajt jak w bazie |

Bryła węższa niż dwa mury domu nadal trafia do adjudykatora cienkiej bryły (N7-P2R). Odczyt jej lic jest zapisany, ale niezastosowany (`applied: false`), bo samo lico nie omija sprawdzenia elewacji, słupów i konfliktu wymiarów. THINWALL z FIX-01 daje tę samą geometrię co wcześniej (0,158 m, te same okna).

### PO — osiem znanych domów

`regression-8-houses.json`. Każdy dom przeliczono produkcyjnym `second-house` z recogniserem na `2dadeae`. Wynik: **8/8 hashy identycznych z FIX-01**, czyli źródła się nie zmieniły. Potem ta sama zapieczętowana ewidencja przeszła przez `f013cfc`. Odtworzenie na bazie daje te same hashe, więc porównanie jest wierne.

| dom | mur przed → po | odczyt lic | inne zmiany | model |
|---|---|---|---|---|
| A01 | 0,427 → **0,447** | W 0,43 / E 0,45 / N 0,45 / S 0,43 | brak; lico wewnętrzne 2 cm głębiej | zmieniony |
| Goździkowce | 0,304 → **0,431** | wszystkie cztery lica 0,431 (= pomiar Council B-1) | ścianki 36 → 32, drzwi 20 → 19 (niżej) | zmieniony |
| Marcówki | 0,49 | W 0,49 / E 0,63 / N 0,48 / S 0,45 → 0,49 | — | bajt w bajt |
| Cieszynianki | 0,459 | 0,459 | — | bajt w bajt |
| Rarytasy | 0,441 | 0,441 | — | bajt w bajt |
| Trytomach | 0,448 | 0,448 | — | bajt w bajt |
| Arganiach | 0,457 | 0,457 | — | bajt w bajt |
| Sasankach 3 | 0,43 | 0,430 | — | bajt w bajt |

We wszystkich ośmiu domach bez zmian pozostały:

- liczba brył i wymiary zewnętrzne pierścieni;
- dachy, okna, pokoje, schody i kominy;
- stan PARTIAL.

**Uzasadnienie zmian wnętrza Goździkowców.** Przy T = 0,304 m czytnik wnętrza zaczynał 0,304 m od lica, czyli w środku muru 0,43 m. Wewnętrzną warstwę muru brał za ściankę działową. W debugu `readInterior` przed zmianą widać „ściankę” przy z ≈ 9,1 m. Ciągnie się ona przez całą długość domu z przerwami dokładnie w miejscach okien tylnej elewacji. Podobne ciągi leżały przy z = 0,32 m i x = 13,5 m.

Po zmianie wcięcie wynosi 0,431 m i te kawałki zniknęły. Zniknęły też jedne drzwi, które stały w tej pseudościance (z = 9,06 m), czyli przerwa okienna w murze, a nie drzwi wewnętrzne. Prawdziwe ścianki działowe zostały, na przykład pasmo przy x ≈ 8,9 m. Pokoje: 9 → 9.

## 2. Ochrona pierścieni (D-1)

**FIRST_BAD.** `candidate.ts` `repairRing`: krawędź równoległa w obrębie tolerancji rzutu (`toleranceM`) była przesuwana na lico sąsiada bez względu na to, ile szerokości zostawało pierścieniowi.

**PRZED (harness Council `D/h2`).**

1. Bryła szerokości 0,62 m wchodzi 5 cm w mur bryły głównej.
2. Krawędź jest przesuwana: EDGE_MOVED 0,05 m, szerokość 0,57 m.
3. Model odrzuca pierścień za nakładanie **własnych** ścian w1/w3, choć plan nigdy tego nie narysował.

**POPRAWKA.**

- `ringAcrossEdge` (`wall-reconciliation.ts`) mierzy, jak daleko pierścień sięga w poprzek przesuwanej krawędzi: przed ruchem i po nim.
- Przesunięcie jest odrzucane, gdy po nim szerokość byłaby mniejsza niż `2 × command.thickness`, czyli grubość tego pierścienia (także własna grubość bryły).
- Rekord `REFUSED` niesie `narrowing: { beforeM, afterM, minM }`.
- `ringCollisions` (FIX-01) ma nowy rodzaj `BETWEEN_BODIES`. Mówi, że pierścień musiałby się zwęzić z X do Y m, poniżej Z, czego nie zrobiono i kolizja pozostaje nierozwiązana.
- Telefon pokazuje ten wiersz oraz werdykt kontroli przed emisją.

**PO.**

| przypadek | wynik |
|---|---|
| 0,62 m, ruch 0,05 m, mur 0,30 m | **odmowa przesunięcia**: 0,62 → 0,57 < 0,60. Brak fałszywego w1/w3. Bryła usunięta z podglądu jako jedyna, model główny i druga dobudowa zostają. Rekord BETWEEN_BODIES z liczbami |
| 0,70 m, ruch 0,05 m | 0,65 ≥ 0,60: przesunięcie jak dotąd, bryła zbudowana |
| 0,62 m przy własnych ścianach 0,25 m | 0,57 ≥ 0,50: przesunięcie dozwolone, zbudowana |
| 0,92 m przy własnych ścianach 0,45 m | 0,87 < 0,90: odmowa |

Test FIX-01, który utrwalał stare zachowanie (EDGE_MOVED, a potem odmowa w1/w3), został świadomie zmieniony na nowy kontrakt.

## 3. Kontrola wszystkich brył przed emisją (D-2/C-4/B-3)

`v2/pre-emit.ts` `preEmitRingChecks` sprawdza każdy prostokąt, który emisja zbuduje przez `rectAt`:

- bryłę główną;
- bryły dołączone;
- prostokąty kondygnacji;
- kawałki kondygnacji (pieces).

Liczy z tą grubością, jaką będzie miał pierścień (`tOf`), i wydaje jeden werdykt:

| werdykt | znaczenie |
|---|---|
| `HOLDS_TWO_WALLS` | bryła z pełnymi ścianami |
| `SHARED_WALL` | jedna ściana wspólna, mieści się ta, która zostaje |
| `THIN_WALLS` | rzeczywista cienka ściana albo jedna lita ściana |
| `PORTICO` | podcień albo słupy |
| `SOURCE_CONFLICT` | wymiar drukowany przeczy rysunkowi |
| `INSUFFICIENT_EVIDENCE` | brak dowodu |

Prostokąt kondygnacji, kawałek albo MAIN, którego nie da się zbudować, jest nazwany jeszcze przed emisją (nierozstrzygnięty z powodem). Lista trafia do wyniku jako `preEmitRings`, a do `ringCollisions` jako `preEmit`.

`cutFailedObject` (P1): gdy podgląd odrzuca kondygnację dobudowy stojącą nad zdrową kondygnacją tej samej bryły, odpadają ta kondygnacja, kondygnacje nad nią i dach bryły. Niższe kondygnacje zostają, a to, co od nich zależy, odpada jako DEPENDENT.

| przypadek (harness Council `D/h1`) | przed | po |
|---|---|---|
| prostokąt kondygnacji 1 o szerokości 0,45 m < 0,60 | podgląd tnie także zdrową kondygnację 0 tej bryły (SAME_BODY) | kondygnacja 0 zostaje (`ring-attached-0-0` w modelu), werdykt `STOREY_RECT / INSUFFICIENT_EVIDENCE` |
| kawałek 0,40 m | wycięty bez nazwy | wycięty, nazwany (`PIECE`) |
| MAIN węższy niż 2t | odrzucenie bez adjudykacji | nazwany (`MAIN`); podgląd minimalny jak dotąd |

Diagnostyka `ringCollisions` z FIX-01 jest zachowana i rozszerzona (`kind`, `narrowing`, `preEmit`).

## 4. Kontekst testu OWNER-a — przypadki odtwarzalne

Sygnatura z telefonu to: `ring-attached-1-0`, `WALLS_OVERLAP` w1/w3, szerokość około 0,48 m, podobna grubość ściany i `SOURCE_CONFLICT`. Traktuję ją jako wskazówkę, nie jako przyczynę. Przygotowałem syntetyczne przypadki dla różnych możliwych przyczyn (`research/analyzer-n7-fix02/houses.ts`, testy):

| przyczyna | przypadek | wynik po FIX-02 |
|---|---|---|
| bryła ≈ grubości muru, wymiar drukowany przeczy rysunkowi | SLIVER48 (0,48 m przy murze 0,44 m) | PARTIAL, dom zachowany, `ringCollisions` OWN_WALLS + `preEmit: BODY / SOURCE_CONFLICT` + `firstBad: SOURCE_CONFLICT` |
| rekoncyliacja zwęża pierścień (D-1) | 0,62 m, 5 cm w głąb domu | przesunięcie odrzucone, BETWEEN_BODIES z liczbami 0,62 / 0,57 / 0,60 |
| T domu za niskie przez ścianki (B-1) | THICK43 | T 0,238 → 0,450 m z lic |
| bryła z własnymi, cieńszymi ścianami | STORE25 / THINWALL | 0,264 m / 0,158 m, COMPLETE |
| wąska kondygnacja nad zdrową | Council `D/h1` | kondygnacja 0 zostaje |

Na telefonie wiersze „Kontrola przed emisją: …” i „Uzgadnianie nie zwęziło pierścienia …” w szczegółach modelu częściowego rozstrzygają, która z tych dróg dotyczy domu OWNER-a. Rekord pochodzenia pokaże solver 2.7.0.

## 5. Testy (celowane) i odbiór

Pełnego CI nie uruchamiałem.

| zakres | wynik |
|---|---|
| `reconstruction/test/wall-thickness-ring-guard-n7-fix02.test.ts` (D-1: 4 przypadki, `storeyRect`, piece, MAIN, wspólna ściana, różne grubości dobudówek, odczyt lic, oszacowanie, sprzeczne lica) | 11/11 |
| `analysis-service/test/wall-thickness-n7-fix02.test.ts` (THICK43, STORE25, SLIVER48 przez `runAnalysis`: model, replay bajt w bajt, scena się wczytuje) | 3/3 |
| `ring-collision-n7-fix01` (zmieniony test D-1), `wall-recovery-n7-fix01`, `thin-body-n7-p2r`, `wall-strip` | zielone |
| pakiety `reconstruction`, `analysis-service`, `synthetic-drawings`, `apps/local-analyzer` | 1248 przeszło, 7 pominiętych, **2 nie przeszły — zastane** i czerwone także na `2dadeae`: Larchfield `program.test` (jak w FIX-01) i `text.test` NFD (środowisko bez ICU) |
| `tests/architecture` | `storey-support` zaktualizowany świadomie: nowy import `exterior-walls.js` w layoucie, `minBodySpanM` przeniesione, oraz nowy warunek, że `exterior-walls.ts` importuje tylko `source-common` i `source-cv` i nie zna żadnego domu ani liczby publikowanej (9/9). Czerwone zastane, także na bazie: `wall-strip` ×2 (wymaga bazy 005Q w klonie), `research-isolation` 005M (rozmiar śledzonego pliku), pisarze IU-01/02/03A (systemowy `python3` bez numpy w tym kontenerze) |
| Android JVM: `LocalAnalysisTest`, `AnalysisTrackerTest`, `RunProvenanceTest` | 27 + 13 + 4, zielone |
| sceny w APK (`mobile:export-scenes`) | bez zmian |
| osiem domów | 6/8 bajt w bajt, 2 zmienione ze źródłowym uzasadnieniem (tabela wyżej) |
| urządzenie / emulator | brak w sesji; nowego ekranu nie oglądałem na telefonie |

Artefakty są w `stage-reports/artifacts/analyzer-n7-fix02/`:

- `regression-8-houses.json`;
- `synthetic-cases.json` (przed i po);
- `council-d-h1-*.txt` i `council-d-h2-*.txt` (harnessy Council przed i po). W `h1` jedno twierdzenie Council „zdrowa kondygnacja 0 jest wycinana” przestało być prawdą, i to jest zamierzona zmiana.

## 6. APK 1308

| pole | wartość |
|---|---|
| plik | `BuildPlan-owner-preview-1308.apk` (= `BuildPlan-Model-Preview-arm64-v8a-debug.apk`), 39 785 846 B |
| SHA-256 | `4322d42c09877e5283eaf6a28f2b33ecdaffdacf7e1eba5b4d9c1bac020f3176` |
| applicationId / versionCode / versionName | `com.buildplan.preview` / **1308** / `0.1308.0-owner` |
| commit | `f013cfc695265ba6c140d4e518aab13b9f3b4516` |
| podpis | dotychczasowy klucz podglądu, cert `6e48fac4…a0da`; `verify-preview-signature.sh`: ok dla wszystkich 4 APK. Instaluje się na 1307 jako aktualizacja |
| analizator w APK | `assets/local-analyzer/analyzer.mjs` SHA-256 `5a00aab413aa099122ab5ad2528e509d15b9888c668ad9b5c44c6a6c39e26272` (= `manifest.json`, 2 768 000 B), `SOLVER_V2_VERSION = "2.7.0"` |
| uprawnienia | tylko `INTERNET` (+ wewnętrzne uprawnienie odbiornika AndroidX) |

**Publikacja:** próba utworzenia wersjonowanego wydania GitHub `owner-preview-1308` została odrzucona przez środowisko sesji (HTTP 403: „Creating, editing, or deleting releases is not permitted for this session type”). APK jest przekazany bezpośrednio jako plik. Link do wydania nie istnieje, więc nie mogłem go sprawdzić.

## Czego FIX-02 nie robi

- Nie zmienia dekompozycji rzutu (C-1/C-2). Garaż WING25 (HOLLOWAY z murem 0,44 m) znika w dekompozycji tak samo przed zmianą, jak po niej. To zadanie następnego etapu.
- Nie domyka kolizji między bryłami przez przesuwanie całej bryły ani zmianę jej grubości. Kolizję, której nie da się bezpiecznie uzgodnić, nazywa.
- Nie twierdzi, że naprawił benchmark OWNER-a.
- Nie rozpoczyna Council FIX-03 ani innych etapów.
