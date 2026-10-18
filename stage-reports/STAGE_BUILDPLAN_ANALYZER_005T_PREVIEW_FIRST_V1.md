# STAGE BUILDPLAN-ANALYZER-005T-PREVIEW-FIRST-V1

**Werdykt: `PARTIAL_PREVIEW_FIRST`** — świadomie zachowawczy. Jeden wcześniej odrzucony dom deweloperski (A01,
`m60124f28f071a`) przechodzi teraz przez **kanoniczną** ścieżkę do prawdziwej sceny 3D, ale klasa
`APPROXIMATE_PREVIEW` **nie została zbudowana**: diagnoza pokazała, że pierwszym zatrzymaniem A01 był błąd emitera,
a nie brak informacji, więc zgodnie z §4 („jeżeli kanoniczna ścieżka miała dość zweryfikowanej informacji — napraw
konkretny błąd”) naprawiono ten błąd zamiast budować drugą ścieżkę. Drugi realny przypadek (A00) nie kwalifikuje się
do podglądu. `PASS_PREVIEW_FIRST_REAL_3D` wymagałby jawnego statusu podglądu — tego nie ma, więc go nie zgłaszam.

| | |
| --- | --- |
| Repozytorium / gałąź | `damiankrok/BuildApp`, `analyzer/005t-preview-first-paddle-binding-v1` |
| Baza | `f055528351fd13a8ca748f4f073a391927a358e0` (zweryfikowana z `origin`, czysty worktree, raport 005S-N2 obecny) |
| Mirror CI | `claude/new-session-3kzcgh` = `bfaf286e95105c2cdb32df2d298d3cd93bd43449` — nietknięty |
| CI / workflowy / holdout / APK | **NOT_RUN** (zgodnie z briefem) |
| Android wizualnie | **`ANDROID_VISUAL_NOT_RUN`** — kod Androida bez zmian |

## 1. Audyt: gdzie naprawdę zatrzymują się domy

`runAnalysis` (`packages/analysis-service/src/run.ts`) woła `reconstructV2`; każde `ReconstructionFailure` kończy bieg
przed modelem, sceną i bundlem — telefon dostaje wtedy `failed` i nie ma czego otworzyć. Na 37 wierszach N1v (23 modele,
14 odmów) kody odmów to: 7× `PLAN_RESOLUTION_INCONCLUSIVE` / pokrycie kondygnacji, 4× skala nieustalona, 1× obrys
nieustalony i **2× `MODEL_EMISSION_FAILED` — po rozstrzygniętym rzucie i ustalonej skali** (A01: `placeWindow`,
`dom-w-gozdzikowcach`: `placeChimney`). To te dwa są „drobnymi” zatrzymaniami w sensie briefu: geometria jest już
policzona, a bieg ginie na jednym poleceniu.

Wybrane przypadki (limit 2 + kontrole + negatyw):

| przypadek | pierwsze zatrzymanie (przed) | co da się pokazać | co musi zostać nieznane |
| --- | --- | --- | --- |
| **A01** (Jarzmianki, `m60124f28f071a`) | `BUILDING_MODEL` / `MODEL_EMISSION_FAILED`: polecenie 89 `placeWindow opening-0-east-1-0-unit` — *frame reaches 0.2 m into a 0.152325 m wall* | cały model kanoniczny: rzut rozstrzygnięty, skala ustalona | grubość ściany 0,152 m jest odczytem z rzutu (bramka przyjmuje 0,15–0,7 m) — nie jest weryfikowana inaczej; 27 nierozstrzygnięć jak w każdym modelu |
| **A00** | `REGISTRATION` / `PLAN_RESOLUTION_INCONCLUSIVE`: pierwsze odczytanie 30,34 m² wobec 147,01 m²; najlepsze z 95 innych: 1 bryła, 145,7 m² (−0,9 %), ale wybrane wyłącznie przez tę samą powierzchnię wydawcy, która odrzuciła pierwsze | **nic** | obrys — jedynym arbitrem jest opublikowana powierzchnia (samopotwierdzenie) |
| kontrole | Marcówki, Cieszynianki (dach kopertowy), Rarytasy G2E, Jabłonki (jedyny zbudowany wiersz ze ścianami zewn. < 0,22 m) | — | — |
| negatyw | A00 pod poprawką; test jednostkowy: otwór za wąski na jakąkolwiek ramę | odmowa zostaje | — |

Wejścia: graf obserwacji N1v **odtworzony** (rysunki nie są czytane ponownie); dowody metryczne wyekstrahowano raz,
OFFLINE, z istniejącego cache bajtów, z PP-OCRv6 w workerze (`research/analyzer-005t-preview-first/seal-case.ts`), bo
wiersze odmów N1v nie zapieczętowały metryk. Oba hasze zgadzają się bit w bit z haszami odmów N1v
(A01 `58951b02…1502`, A00 `8770229f…20b5`). Żaden piksel ani HTML nie trafił do repozytorium; wyniki leżą w
`/home/user/work005t` poza worktree.

## 2. Pierwszy zły krok A01 i poprawka

Solver przyjmuje grubość ściany zewnętrznej odczytaną z rzutu od 0,15 m (`reconstruct-v2.ts:394`). Emiter stawiał
okna i drzwi zewnętrzne z **domyślnymi** ramami modelu: okno `frameInset 0.12 + frameDepth 0.08 = 0,20 m`, drzwi
`0.10 + 0.12 = 0,22 m`. Walidator modelu słusznie odmawia ramy głębszej niż ściana — więc każdy dom odczytany ze ścianą
< 0,20 m ginął na pierwszym oknie. Rama jest założeniem renderingu, nie faktem ze źródła: cały model był tracony przez
wartość domyślną. Ścianki działowe miały już tę regułę (`emit.ts`, drzwi wewnętrzne: rama ≤ 60 % ściany).

Poprawka (`packages/reconstruction/src/v2/emit.ts`, `frameWithinWall`): dla okien i drzwi zewnętrznych (w tym drzwi
między bryłami) — **tylko gdy domyślna rama się nie mieści** — rama dostaje głębokość ≤ 60 % ściany i wsunięcie
w pozostałą grubość (skrzydło drzwi ≤ 30 %). Gdy domyślna się mieści, nie jest emitowane nic, więc polecenie jest
bajt w bajt takie jak przedtem. **Nie zmieniono żadnej bramki**: walidatora modelu, bramki grubości ściany, rozstrzygania
rzutu, skali ani OCR. A01: okno 1,06 × 1,42 m dostaje ramę 0,08 m wsuniętą 0,062 m.

## 3. Przed / po — to samo źródło

| | przed | po |
| --- | --- | --- |
| A01 wynik | `RECONSTRUCTION_FAILED` / `MODEL_EMISSION_FAILED`, **brak sceny** | `COMPLETED`, scena kanoniczna |
| model sha256 | — | `4ced0179…6b54` (identyczny z samego solvera i z pełnego biegu) |
| scena | — | `22871168…87fd`, 315 414 B, 107 siatek, 2 524 trójkąty, round-trip zweryfikowany przez bieg |
| bryły / kondygnacje | — | 3 bryły; parter 2,80 m + poddasze 2,80→5,36 m |
| dach | — | główny dwuspadowy 40°, dwa płaskie nad przybudówkami |
| otwory | — | 21 w obwiedni (otwory zewn. + drzwi między bryłami); w modelu 10 okien i 14 skrzydeł drzwi (z wewnętrznymi); 1 nie zbudowany i nazwany (`OPENINGS_NOT_BUILT`) |
| obrys zewn. (bbox) | — | 10,50 × 8,01 m; wydawca: powierzchnia zabudowy 87,53 m² (porównanie opisowe, nie miara trafności) |
| jakość cech | — | L1 49, L2 15, L0 0 |
| weryfikacja | — | replay BYTE_IDENTICAL; 6 rezyduów, 2 poza tolerancją; zamknięcie DEGRADED: 14 uwag na złączach zewn. (ostrzeżenie w wyniku) |
| ostrzeżenia | — | m.in. `LAYOUT_STOREY_COVERAGE_DISAGREES` (poddasze wystaje 14,2 m² poza bryły), `EXTERIOR_JOINTS`, `RESIDUALS_OUTSIDE_TOLERANCE`; **6 z 9 ma `severity: LIMITING`** (korekta 005T-N2: pierwotny zapis odczytał nieistniejące pole i błędnie podał „żadne”) |

Opisowo (bez obrazu, bez oceny procentowej): bryła dwukondygnacyjna z dwuspadowym dachem 40° i dwiema niskimi
przybudówkami z płaskim dachem. Czy OWNER rozpozna w tym dom ze strony — **niezmierzone**; nie twierdzę żadnego „90 %”.

**A00 pod poprawką:** nadal `PLAN_RESOLUTION_INCONCLUSIVE` (poprawka działa dopiero w emisji). Podgląd **nie
kwalifikuje się**: jedyną rzeczą, która wybiera najlepsze odczytanie, jest opublikowana powierzchnia, która już odrzuciła
pierwsze — podgląd z niej byłby obrysem wybranym przez własną powierzchnię.

**Kontrole (solver na zapieczętowanym grafie i metrykach N1v):** Marcówki `6152770f…d64f`, Cieszynianki `a96afbb1…1ad3`,
Rarytasy G2E `9f5fd342…21e7`, Jabłonki `a81652d0…a4bb` — **4/4 identyczne** z haszami zapieczętowanymi. Dla wszystkich
23 zbudowanych wierszy: reguła z definicji nie emituje nic tam, gdzie domyślna rama mieści się w ścianie, a każdy z nich
został przyjęty z ramami domyślnymi — więc żaden nie może się zmienić. Zliczenie w próbce 37 wierszy: modele 23 → 24,
odmowy 14 → 13 (zmienił się tylko A01; pozostałe 12 odmów zatrzymuje się przed emisją, a `dom-w-gozdzikowcach` na
kominie, przed oknami — nie uruchamiane ponownie).

Koszt: zero dodatkowej pracy dla domów ze ścianą ≥ 0,22 m; pełny bieg A01 ~298 s (z czego OCR 52 s), solver ~4,7 s.

## 4. PaddleOCR i wiązanie z linią (§3 briefu)

Żaden z dwóch realnych przypadków nie zatrzymuje się w OCR ani w wiązaniu etykiet, więc podzadanie §3 **nie zostało
otwarte** i nie zmieniono nic w `source-metrics` / `numeric-recogniser-ort`. PP-OCRv6 czytał jak dotąd: w A01 294 wycinki,
156 stabilnych, 65 potwierdzających, 17 zgodnych, 25 `LEADS`, 3 sprzeczności z kratą. Wpływ wiązania na wynik 3D: **zero**.
Wyzwań z 005Q-CHAIN nie wskrzeszano.

## 5. Testy (celowane)

- nowy `packages/analysis-service/test/exterior-frame-fit.test.ts` (5): przed — domyślne ramy odrzucone w ścianie
  0,152 m dokładnie komunikatem A01; po — przyjęte przez niezmieniony walidator; tożsamość bajtowa dla ścian ≥ 0,20/0,22 m;
  negatyw — otwór 0,12 m nadal `FILL_TOO_LARGE`; deterministyczna serializacja i round-trip bundla sceny z okiem, drzwiami
  i ścianą pod własnymi `objectId`.
- `npx tsc -p tsconfig.json` — zielono.
- `vitest`: reconstruction (fit-and-levels, storey-emission, compound-facade-emission, fixtures-v2, vehicle-door-depth,
  openings), cały `analysis-service/test`, cały `tests/architecture` (czystość, brak domów deweloperskich w produkcji,
  izolacja research) — **38 plików, 492 testy, wszystkie zielone**.
- Replay realnego przypadku (A01 przed/po), 4 kontrole, negatyw A00 — jak wyżej.
- **Nie uruchamiane:** pełne `npm test`, e2e, CI, emulator, testy JVM Androida, APK.

## 6. Ograniczenia i rzeczy nieznane

- Klasa `APPROXIMATE_PREVIEW` / `EDIT_REQUIRED` nie istnieje; kontrakt wyniku, protokół lokalnego analizatora i Android
  bez zmian. Nie ma wyniku, który byłby „podglądem”.
- Etykieta wersji solvera nie podniesiona: zmienia się odpowiedź tylko dla domów, które dotąd były odrzucane (nic z nich
  nie mogło trafić do cache jako sukces); podniesienie zmieniłoby hasze wszystkich 23 kontroli.
- Grubość 0,152 m w A01 to odczyt rzutu przyjęty przez istniejącą bramkę; nie weryfikowałem go niezależnie (typowe ściany
  ARCHON ~0,44 m — możliwe, że odczytano tylko warstwę konstrukcyjną). Model mówi to, co bramka przepuściła.
- Zamknięcie A01 ma 14 uwag na złączach zewnętrznych i 2 rezydua poza tolerancją — scena jest, ale nie jest „czysta”.
- Ślepy holdout, porównanie wizualne z kamerą, ocena OWNER-a — nie wykonane.

## 7. Następny wąski krok (rekomendacja, nie wykonany)

`dom-w-gozdzikowcach`: `placeChimney INVALID_COMMAND` — ta sama klasa (emisja po rozstrzygniętym rzucie). Zdiagnozować
dokładny powód na zapieczętowanym grafie (jak tu: jeden bieg metryk OFFLINE), naprawić w emiterze bez ruszania bramek;
dopiero gdy zostaną odmowy z prawdziwym brakiem informacji, budować `APPROXIMATE_PREVIEW` z dodatnimi, nazwanymi
przesłankami.

## Pliki

- `packages/reconstruction/src/v2/emit.ts` — `frameWithinWall`, `EXTERIOR_FRAME_DEFAULTS`, użyte przy oknach, drzwiach
  zewnętrznych, bramach garażowych, drzwiach przeszklonych i drzwiach między bryłami.
- `packages/analysis-service/test/exterior-frame-fit.test.ts` — testy.
- `research/analyzer-005t-preview-first/seal-case.ts` — harness (research only, wyjście poza repo).
- `research/analyzer-005t-preview-first/cases.json` — przypadki, hasze przed/po, kontrole (bez źródeł).
