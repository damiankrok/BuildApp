# STAGE BUILDPLAN SHAPE-LIVE-01 — poprawne bryły i dach, widoczny odczyt podczas analizy

Baza `c6b9a60` (SOURCE-01, usługa 1.6.0, solver 2.20.0) → kod `80d5612` (usługa **1.7.0**, solver **2.21.0**).
Gałąź `claude/new-session-3kzcgh`. Dane liczbowe: `stage-reports/artifacts/analyzer-shape-live-01/`. Prywatny
benchmark OWNER-a nie był znany, nie był szukany ani zgadywany; nic tu nie twierdzi, że prywatny dom jest naprawiony.

## 1. Zbiór, PRZED, pierwsza błędna decyzja

Domy DEV wybrano przed implementacją z jawnych domów ARCHON SOURCE-01 (pliki `test-pkgs`), na których model istotnie
myli bryłę lub dach. Opis PRZED ze źródłami: `przed-descriptions.md`.

| dom (DEV) | co mówi źródło | PRZED (c6b9a60) | pierwsza błędna decyzja |
|---|---|---|---|
| Arlety 3 (E) OZE | przekrój: ±0,00 / +2,96 / okap +3,34 / kalenica +8,29 | dach zatopiony: okap −0,48, kalenica 3,34; poddasze jako skrzynka | `levelsFrom`: najwyższa ODCZYTANA rzędna = kalenica; +8,29 i +2,96 odrzucone przez bramki OCR (słusznie: „±8,24”, „+2146”) |
| Jabłonki 22 | ±0,00 / +2,96 / okap +3,27 / kalenica +8,26; tylny skrzydłowy szczyt | okap −0,51, kalenica 3,27 | jw. |
| Miniaturka 2 v3 | ±0,00 / poddasze +2,85 / okap +2,68 / kalenica +7,33 | okap −0,81, kalenica 2,85 (= podłoga poddasza) | jw. |
| Willa Maja R2 | dwie pełne kondygnacje, dach kopertowy 22°, kalenica +7,98 (odczytana) | piramida: kalenica wzdłuż krótszego boku 7,8 m, okap 4,50 przy ścianach do 7,98 | oś kalenicy: brak głosu widoków i brak osi z układu → domyślne `'Z'` |
| Dalie 5 (GE) — garaż/brama/zadaszenie | ciemna rama wejścia, drzwi, okno, brama garażu | tylko brama (otwór 3,52 m jako DOOR); brak drzwi i okna; rama jako dwie ściany 0,85 m („słupy”) | zdiagnozowane, NIE naprawione (§5) |

Odłożone do oceny końcowej (nieużyte do diagnozy, pobrane świeżo z publicznego katalogu): **Lipienniki 5**, **Aurory 26 (G)**,
**Kostrzewy 4**. Bazowe PRZED odpalono kodem `c6b9a60` (osobny worktree), PO — bieżącym kodem na tym samym zapieczętowanym
pakiecie.

## 2. Co zmieniono (reguły ogólne, bez wyjątków po nazwie/URL/hashu/współrzędnych)

1. **Rzędna najwyższa ≠ kalenica, gdy nad nią narysowano dach** (`v2/section-datums.ts`, `solve.ts`). Dwie wydrukowane
   rzędne dają pionową skalę arkusza; jeśli tusz stoi ≥ 1,5 m nad najwyższą odczytaną rzędną na ≥ 30 % szerokości budynku,
   ta rzędna nie jest kalenicą (komin jest wąski i się nie liczy). Taka rzędna nigdy nie tworzy kondygnacji (o kondygnacjach
   mówią rzuty) — jest górą ścian poniżej. Nic nie jest doczytywane: reguła tylko ODMAWIA.
2. **Kalenica zmierzona na rysunku** (`readDrawnApex`): dwie połacie górnej linii dachu przy podanym kącie, każda kolumna
   głosuje na swój przecięty wyraz wolny, komin/etykieta są przegłosowane; przecięcie na skali z wydrukowanych rzędnych.
   `SOURCE_DERIVED` (niepewność 0,1 m), przed przybliżeniem ze ścianki kolankowej (`ASSUMED_FOR_RENDERING`). Na DEV:
   8,23 / 8,25 / 7,30 m wobec nieodczytanych wydruków 8,29 / 8,26 / 7,33.
3. **Oś kalenicy z wyniesienia widoków**: gdy żaden widok nie pokazuje szczytu i układ nie podaje osi, każda oś przewiduje
   wzrost obrysu 15→50 % rozpiętości (przy podanym kącie); bierze się oś, której predykcję spełniają wszystkie widoki,
   a drugiej żaden. Willa Maja: zmierzone 0,55/0,58 m, X przewiduje 0,53, Z 2,43.
4. **Brak kolców**: zwrot ściany na najwyższej kondygnacji poza obrysem każdego dachu nie jest przycinany płaszczyznami
   dachu głównego (które za okapem/kalenicą rosną) — kończy się na głowicy ściany kondygnacji, z zapisem w ewidencji.
5. Wersje: usługa 1.7.0, solver 2.21.0 (klucz cache).

## 3. Dowody PRZED/PO (te same kamery `scene-views`, ten sam pakiet)

`przed-po-test-and-holdout.json` (metryki z `model.json`; „dach pod podłogą” = okap połaci poniżej podłogi najwyższej
kondygnacji; „przycięte poza dachem” = ściana przycinana dachem, który jej nie przykrywa).

| dom | okap PRZED→PO | kalenica PRZED→PO | dach pod podłogą | kolce | inne |
|---|---|---|---|---|---|
| Arlety (DEV) | −0,48 → **4,41** | 3,34 → **8,23** | tak → nie | 0 → 0 | okna/drzwi bez zmian |
| Jabłonki (DEV) | −0,51 → **4,47** | 3,27 → **8,25** | tak → nie | 2 → **0** (w biegu pośrednim) | COMPLETE → PARTIAL (§5) |
| Miniaturka (DEV) | −0,81 → **3,64** | 2,85 → **7,30** | tak → nie | 0 → 0 | COMPLETE → PARTIAL (§5) |
| Willa Maja (DEV) | 4,50 → **6,40** | 7,98 → 7,98 | — | — | piramida → koperta (2 trapezy + 2 trójkąty); okna 17 → 19 |
| **Lipienniki (HOLDOUT)** | **−2,05 → 3,22** | 2,85 → **6,54** | — | — | okna 8 → 9; ta sama klasa błędu naprawiona na domu niewidzianym |
| Aurory (HOLDOUT) | bez zmian (model bajt w bajt) | | | | błędy zostają (§5) |
| Kostrzewy (HOLDOUT) | RECONSTRUCTION_FAILED → to samo | | | | |
| Azalie, Bratki, Dalie | bez zmian (bajt w bajt) | | | | kontrola |
| Pod Miłorzębem, Modrzewnica, Muraje | RECONSTRUCTION_FAILED → to samo | | | | |

**Regresja 8 domów DEV** (`regression-8-dev-houses.json`, produkcyjny `runAnalysis`, świeża ekstrakcja, `--content`, porównanie
z przebiegiem AFTER z SOURCE-01 na tym samym kodzie co c6b9a60): **8/8 modeli i scen bajt w bajt identycznych** (a01, arganiach,
ciesz, gozd, marcowki, rary, sasankach3, trytomach). Żadna nowa reguła nie odpaliła tam, gdzie kalenica była odczytana.

Tablice PRZED/PO (oryginały wydawcy + rzuty modelu z tych samych kamer) i nakładki są w prywatnym ZIP-ie (§8), nie w Git.

## 4. Podgląd na żywo (Cel B)

- Zdarzenia `source` (protokół 3 + capability `source.v1`): krok, arkusz po SHA-256 dokładnych bajtów biegu, znaczniki
  `CANDIDATE / READ / ACCEPTED / REJECTED` (pole tekstu, linia wymiaru, otwór, rzędna), identyfikator **elementu modelu**
  z powiązań emitera (nie nazwa cechy), liczniki: obrazy / odczytane / odrzucone po treści / kandydaci OCR / odczyty wymiarów /
  użyte / **różne elementy** / hipotezy / otwory zbudowane (kilka odczytów jednego otworu = jeden otwór).
- Lokalny runtime kopiuje bajty arkusza raz do `<work>/live/<sha256>` z własnego cache biegu (nic nie jest pobierane ponownie)
  i usuwa kopie razem z bajtami przed zdarzeniem końcowym.
- Android: stały panel źródła od pierwszego zdarzenia (stan oczekiwania przed obrazem, nazwany krok w fazach bez obrazu
  z ostatnim arkuszem przygaszonym i podpisanym „ostatni arkusz”, jawny powód odmowy: brak pliku / inny SHA / nie da się
  zdekodować). Obraz pokazywany tylko, gdy SHA-256 kopii = hash wskazany przez analizator.
- Inspekcja źródeł po biegu: lista odczytów stronicowana (każdy odczyt wybieralny, bez „więcej”), powiększony wycinek
  wybranego odczytu, **„Pokaż w modelu”** otwiera dom i zaznacza element (albo jawnie: „nie trafił do żadnego elementu”),
  pobrany arkusz pokazywany tylko przy zgodnym SHA-256, rekonsyliacja otworów: z rzutów / odczyty na elewacjach / w modelu.

**Dowód protokołu na prawdziwej stronie** (zasoby `assets/local-analyzer` z APK 1314, `run-host` na Node hosta — nie
na telefonie; żywa strona Arlety; `live-run-summary.json`, `live-run-transcript.jsonl`): pierwszy arkusz po **13,4 s**,
koniec (`done`) po **282,1 s**; 137 zdarzeń `source` we wszystkich 11 krokach; 35 różnych arkuszy; **129 kopii
zweryfikowanych SHA-256 w trakcie biegu, 0 niezgodnych**; po biegu katalog `live/` nie istnieje. Liczniki końcowe:
35 obrazów, 19 odczytanych, 14 odrzuconych po treści, 2680 kandydatów OCR, 154 odczyty wymiarów, 29 użytych,
12 różnych elementów, 65 hipotez, 10 otworów. Model z tej ścieżki (z zewnętrznym rozpoznawaniem OCR telefonu) ma ten sam
kształt co desktop PO: okap 4,41, kalenica 8,23, 0 kolców (hash inny — inne odczyty etykiet przy recogniserze).

**Część wizualna na Androidzie: NOT_VERIFIED** — w sesji nie ma urządzenia ani emulatora (brak KVM). Nie ma nagrania ani
zrzutów prawdziwego UI. Dostarczony jest APK (§7) i 32 nakładki znaczników na dokładnych kopiach arkuszy z tego biegu (ZIP).

## 5. Błędy, które zostają (nazwane)

1. **Dalie — relacja garaż–brama–zadaszenie**: brama obecna (otwór 3,52 m), ale emitowana jako DOOR; drzwi wejściowe
   i okno frontowe brak; ciemna rama/zadaszenie zbudowana jako dwie ściany zwrotne 0,85 m („słupy”), nie jako zadaszenie
   z wolną przestrzenią. Nie naprawione.
2. **Jabłonki — tylne skrzydło szczytowe** nie jest bryłą (jest tarasem); dwa zwroty kondygnacji poddasza z tej strefy
   nie strzelają już do kalenicy, ale wiszą (2,80–5,60 m) nad tarasem. Lukarna frontowa nadal brak.
3. **Okna połaciowe**: z poprawnym dachem są teraz odczytywane; kilka odczytów jednego okna nakłada się → model odmawia
   (`ROOF_OPENINGS_OVERLAP`) i bieg jest uczciwie `PARTIAL_3D_PREVIEW` (Miniaturka 1, Jabłonki 2). Brak deduplikacji —
   do zrobienia, nie obejście.
4. Miniaturka: nowe ostrzeżenie degradujące `STRUCTURE_READS_AS_ONE_BLOCK` (dwie bryły tej samej wysokości na elewacjach).
5. **Aurory (holdout)**: oś kalenicy prostopadła do źródła (front jest okapowy, model pokazuje szczyt); brak bramy
   garażu i drzwi frontowych. Nie strojone na holdoucie.
6. Kostrzewy (holdout), Pod Miłorzębem, Modrzewnica (garaż z płaskim dachem i otwarte zadaszenie na słupach), Muraje:
   brak modelu (skala/rozdzielczość rzutu) — relacji garaż/zadaszenie nie dało się na nich sprawdzić.
7. Kalenica zmierzona na rysunku nie jest jeszcze znacznikiem na arkuszu przekroju w podglądzie (jest w krokach solvera).
8. Przy rzędnej najwyższej odrzuconej jako kalenica podłoga poddasza bierze konwencję 2,80 m, gdy jej etykieta też
   nie została odczytana (Arlety 2,96, Jabłonki 2,96: −0,16 m).

## 6. Testy (oddzielone od bazy)

| zestaw | wynik | baza c6b9a60 |
|---|---|---|
| `tsc -p tsconfig.json` | czysto | czysto |
| pakiety (reconstruction, analysis-service, source-metrics, source-analyzer) | 1819 ok, 17 pominiętych, **0 błędów** | 0 |
| architecture + local-analyzer + analyzer-api | 17 błędów = **dokładnie bazowe** 11 (compound-facade 1, reference 2, research-isolation 4, wall-strip 4) + 6 (snapshot, /health, worker ×2, Larchfield, NFD); 1 nowy (`generalization`: przykładowa liczba w komentarzu) naprawiony | 11 + 6 |
| Android `testDebugUnitTest` | 447, **4 błędy = bazowe** (AutoCandidateRendering ×2, DownloadedScenes ×2) | 4 |

Nowe testy przyczyn: `reconstruction/test/section-top-datum-shape-live-01.test.ts` (9: rzędna pod dachem, płyta nie tworzy
kondygnacji, kalenica odczytana stoi, komin to nie dach, brak skali = brak werdyktu, wierzchołek z połaci, zły kąt = brak),
`analysis-service/test/live-shape-live-01.test.ts` (2: strumień na całym biegu — arkusz = obraz biegu po hashu, arkusz
przed solverem, fazy bez obrazu, element istnieje w modelu, liczniki nie maleją; słuchacz rzucający nie psuje biegu),
`local-analyzer/test/program.test.ts` (kopia = dokładne bajty, weryfikacja SHA w trakcie, kopie usunięte po biegu),
Android `LiveSourceTest` (6). Nie uruchamiano pełnego CI ani masowej podmiany golden.

## 7. APK

| pole | wartość |
|---|---|
| plik | `BuildPlan-owner-preview-1314.apk`, 49 413 691 B |
| SHA-256 | `87eb5225d8faaf3bd0ca08e1cc565abd9c2bb757d18b0d53e5086ab461b27bc1` |
| applicationId / versionCode / versionName | `com.buildplan.preview` / **1314** / `0.1314.0-owner`, commit `80d5612` |
| ABI / podpis | arm64-v8a; cert SHA-256 `6e48fac4…ca0da` (ten sam co 1313; aktualizacja nad 1313 możliwa po kluczu i wersji) |
| analizator w APK | 10/10 plików zgodnych z manifestem, protokół 3, `source.v1`; usługa 1.7.0, solver 2.21.0; `analyzer.mjs` SHA-256 `289e765b12b5a93ea0141b0c0d494dce59dca89842645b1521b5c41a8ec2e3e0` |
| smoke | zasoby z APK, `run-host` na żywej stronie Arlety: `done` po 282 s, nowa reguła dachu działa (§4) |
| instalacja jako aktualizacja | **NIE testowana** — brak urządzenia/emulatora w sesji |

## 8. Dostawa prywatna

ZIP poza repo: `BuildPlan-SHAPE-LIVE-01-Private.zip` (73 525 232 B, SHA-256 `09742f5721809b90c99e5ddf508b62f428ad0ad7ff945b39f1ca5ef266c2b77d`, 445 plików) — oryginały arkuszy DEV i holdoutu z hashami, `model.json` PRZED/PO, tablice PRZED/PO,
8 domów DEV PRZED/PO, nakładki podglądu (32) na kopiach arkuszy z biegu APK, transkrypt, manifest z hashami. Nie trafia do Git ani publicznego CI.
