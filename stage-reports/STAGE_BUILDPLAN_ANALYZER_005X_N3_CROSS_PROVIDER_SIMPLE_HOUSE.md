# BUILDPLAN-ANALYZER-005X-N3 — nowy prosty projekt (TeA AR-18 TREND P) + uogólnianie zdjęć + przyspieszenie OCR calloutów

Data: 2026-10-20. Repo `damiankrok/BuildApp`, gałąź robocza `analyzer/005x-n3-cross-provider-simple-house-v1`
(utworzona z HEAD kandydata). Status: **OWNER_VISUAL_PENDING**, STOP po raporcie.

## 0. Start i granice

| element | stan |
|---|---|
| baza przyjęta | 005X-N2 `586fa40859e6811cf44db4e76797324f84122fe2` |
| kandydat | `analyzer/005x-n3-tinted-callout-bar-gate-candidate-v1` @ `629a11d5f875ac0602ee1fd402a022f646dc774f` — sprawdzony: dokładnie 3 commity ponad N2, 3 pliki (`callouts.ts`, `reconstruct-v2.ts`, test), **brak dryfu** |
| mirror `claude/new-session-3kzcgh` @ `bfaf286e…`, domyślny branch zdalny, APK, releases, limit 32 MB | nietknięte |
| 41-job CI, budowa APK, emulator | nie uruchamiane |
| FAZA 0 (niezmieniony N2) | osobny worktree poza repo z `586fa40`, pakiety `@buildapp/*` wskazujące na kod N2 |

Commity (kolejno): `2669fbf` preregistration (przed jakimkolwiek biegiem) → `ba5163e` bramka OCR dokładna z konstrukcji →
`577b317` dekoder WebP → `e63d7ae` skrypty badawcze → `71c1458` zamrożenie BLIND-N3 przed biegiem → raport/ledger/status.

## 1. Trzy werdykty (osobno)

| obszar | werdykt |
|---|---|
| **Optymalizacja kodu (bramka `requireBar`)** | **ADOPT — `OCR_BAR_GATE_EXACT_ADOPTED`**. Patch kandydata był **niedokładny** (wykazane testem, §4.2) — poprawiony tak, że odczyty z kreską są identyczne z konstrukcji. OCR −72 %, czytnik −49…−73 %, cała analiza −39 % (5 domów), 5/5 modeli bajt w bajt, A01 6/7. Android nadal **NOT_READY** (17–27 s na desktopie). |
| **Nowy projekt TeA AR-18 TREND P** | **`NEW_PROVIDER_FAIL_NAMED`**. N2: odmowa (FIRST_BAD: brak dekodera WebP → „strona nie ma rzutu”). N3 po dodaniu WebP: rzut czytany, ściany widziane, **nazwana odmowa na skali** (cyfry wymiarów 7–9 px, poniżej czytelności). Nie powstał model z trasy URL. `Photo…`: odmowa na obu wizualizacjach (FIRST_BAD: chmury i drzewa poza modelem nieba). Brak strojenia pod TeA. |
| **Segmentacja / zdjęcia** | **`SEGMENTATION_NOT_ADOPTED_RESEARCH_ONLY`**. Jedyny znaleziony gotowy model zgodny licencyjnie i z właściwymi klasami (DETR-R50 panoptic, Apache-2.0, ONNX) daje w dostępnym eksporcie **pomieszane przestrzennie maski** i kosztuje 8,5–11,6 s + 1,1–1,4 GB na desktopie. BLIND-N3: **0/4 poprawnych modeli, 1 fałszywy** (tryb domyślny, kod niezmieniony od N2). Postęp maskowy: brak; postęp modelu 3D: brak. |

Brak `ALL_PASSED` / `ALL_GREEN`.

## 2. FAZA 0 — rzeczywisty test na niezmienionym 005X-N2

### 2.1 Co było dostępne w źródle i jak trafiło do analizatora

Preregistration: `research/analyzer-005x-n3-cross-provider/preregistration.md` (commit `2669fbf`, przed biegiem).
Strona publiczna, HTTP 200, bez logowania; robots.txt nie wyklucza strony ani `/wp-content/uploads/`.

| wejście w źródle | format | jak podane analizatorowi |
|---|---|---|
| rzut parteru 800×800 (z wymiarami całkowitymi 1460 / 745 i łańcuchami w cm z przecinkiem) | **WebP** (wszystkie warianty srcset) | trasa URL (`reconstruct-v2 --url`, akwizycja `generic.project-page@1.2.0`) — sklasyfikowany jako `FLOOR_PLAN GROUND` |
| 2 wizualizacje zewnętrzne (front, ogród 2), 1200×675 | JPEG progresywny | trasa URL (jako `PERSPECTIVE_RENDER FRONT/REAR`) oraz osobno `Photo…` (CLI tej samej ścieżki) |
| 5 wizualizacji wnętrz, plan działki, 3 diagramy orientacji, ikony opcji | WebP/PNG | trasa URL (role `UNKNOWN`/`SITE_PLAN`, nieczytane jako rysunki budynku) |
| elewacje, przekrój | **brak na stronie** | — |
| tekst: 11 parametrów (14,6 / 7,45 m, 6,16 m, 35°, 170 m² dachu, 109,79 m² zabudowy…), 9 pomieszczeń | HTML | odczytane przez adapter jako fakty publikowane (agregaty) — żaden nie wpisany ręcznie |

Nie użyto `building-model.json`, ręcznej bryły ani parametrów. Obrazy wydawcy są wyłącznie poza repo (`/home/user/work005xn3/tea/`).

### 2.2 Wyniki

| tryb | kod | wynik | FIRST_BAD |
|---|---|---|---|
| URL | N2 `586fa40` | **REFUSAL** po 26 s: „the project page exposes no floor plan” | `decode failed: no decoder for webp` dla rzutu → brak ramki rzutu w grafie; komunikat błędny (rzut jest, nie da się go zdekodować) |
| URL | N3 (z WebP) | **REFUSAL** po 37–42 s: „the floor plan's scale cannot be established: the page vote's 1.833613 cm/px is kept, but no reading that owes nothing to it supports it…” | rzut zdekodowany (8 pasm ścian, 39 linii wymiarowych), ale z 181 tokenów OCR tylko „745” jest odczytem poprawnym wymiaru całkowitego; „1460” ma ~7 px wysokości i wychodzi „1080”/„0001”, „369,5” → „400,5”, „254,5” → „25435”. Skala 1,83 cm/px pochodzi z 3 kotwic na błędnych odczytach, oznaczona `LEGACY_UNCONFIRMED / INCONCLUSIVE`; rzeczywista ≈ 2,4–2,5 cm/px. Solver **słusznie odmawia** zamiast budować zły dom. |
| `Photo…` front | N2 = N3 | REFUSAL: „the eaves read (833..1098) cover too little of the house's outline (0..1199)” | model nieba nie obejmuje białych chmur kłębiastych ani koron drzew po bokach → „obrys domu” = cała szerokość (wierzchołki kolumn y≈0–4); tryb NEUTRAL_BAND: brak prostej linii okapu (ściana z odcieniem renderu 210,205,234) |
| `Photo…` ogród 2 | N2 = N3 | REFUSAL: „no straight eave line could be fitted” | jw. |
| `Photo…` ogród 2, **niedomyślny** `outlineFallback` (jawnie nazwany, tylko informacyjnie) | N3 | model `05d6d022` SILHOUETTE / COARSE | patrz §2.3 |

Ścieżka `Photo…` nie była w N3 zmieniana; wyniki N2 i N3 są identyczne.

### 2.3 Porównanie ze źródłem (prywatne; parametry strony to referencja oceny, nie wejście)

| cecha | źródło (strona/rzut) | URL N2 | URL N3 | Photo (domyślnie) | Photo SILHOUETTE (opt-in) |
|---|---|---|---|---|---|
| model | — | brak | brak | brak | 05d6d022 |
| kondygnacje | 1, bez garażu | — | — | — | 1 ✓ |
| dach / obrót | dwuspadowy 35°, kalenica wzdłuż dłuższego boku, bez okapów | — | — | — | dwuspadowy, kalenica wzdłuż dłuższego boku ✓, okap ≈ 0 ✓, **20° ✗** |
| obrys / proporcja | 14,60 × 7,45 m (1,96) | — | ściany widziane, skala nieustalona | — | proporcja ≈ 2 (wymiary założone) ~ |
| okna / drzwi | wejście od frontu, większość okien od ogrodu (rzut) | — | — | — | 0 otworów ✗ |
| wysokość | 6,16 m | — | — | — | niższa (20° zamiast 35°) ✗ |

Wynik TeA: **FAIL** w obu trybach domyślnych (nazwane odmowy, 0 fałszywych modeli). Kryteria U2–U6 preregistration niespełnione; U1
(akwizycja) i U7 (proweniencja) spełnione.

## 3. Zmiana uniwersalna wynikająca z FIRST_BAD: dekoder WebP

- `packages/source-package/src/image.ts`: `decodeImage` dekoduje WebP przez **dekoder samego libwebp** (`@jsquash/webp@1.5.0`,
  Apache-2.0, WASM 138 kB, wersja z maja 2025), kompilowany i instancjonowany synchronicznie w Node, więc funkcja
  pozostaje synchroniczna. `decodeImage` jest wołane tylko po stronie Node (analysis-service, analyzer-api,
  local-analyzer, CLI) — web i Android go nie importują.
- Odrzucona alternatywa: czysto-TS `@stacksjs/ts-webp@0.1.6` — porównanie z libwebp (PIL) na 33 plikach: bit-exact tylko dla
  obrazów stratnych o parzystej wysokości; przy nieparzystej **gubi 2 ostatnie wiersze (zera)**, a VP8L dekoduje błędnie.
  `@jsquash/webp`: **33/33 bit-exact**, 5–10× szybciej (rzut 800×800: 12 ms).
- Testy: bezstratny 17×9 z alfą (piksel w piksel), stratny 33×21 o nieparzystym rozmiarze (SHA-256 wyjścia libwebp), obcięty
  bitstream → `CORRUPT`. Pliki testowe zakodowane z syntetycznych pikseli, nie od wydawcy.
- Nic w kodzie nie zna TeA ani domeny. Uwaga metodyczna: zmiana jest motywowana tym testem, więc bieg N3 na TeA **nie jest już
  ślepy** — dlatego dalszego FIRST_BAD (OCR małych cyfr) nie poprawiałem: progi czytelności i bramki odczytu zostały nietknięte.
- Nienaprawione, zgłoszone: komunikat `PLAN_NOT_FOUND` przy rzucie, którego nie da się zdekodować (inny format), powinien brzmieć
  jak `PLAN_NOT_DECODABLE`.

## 4. FAZA A — optymalizacja calloutów

### 4.1 Testy

| test | 586fa40 (N2) | N3 końcowy |
|---|---|---|
| `generic-openings-005x.test.ts` | 7/7 | 8/8 (nowy: pierścień z kreską + bez kreski) |
| `plan-first-rooflights-005x-n2.test.ts` (plan bez renderu → 2 okna `SOURCE_DERIVED`; brak symboli → 0) | 3/3 | 3/3 |
| `packages/source-package` (z nowymi testami WebP), `source-metrics`, `photo-generalization-005x-n2`, `tests/architecture` | — | 870/871; jedyna porażka: śledzony APK > 32 MB (KNOWN_BASELINE_FAIL) |
| `tsc -p tsconfig.json` | czysty | czysty |

### 4.2 Patch kandydata był niedokładny — poprawiony

Komentarz kandydata twierdził: „OCR pierścienia bez kreski nie może zmienić ich odpowiedzi”. Test z dwoma symbolami (z kreską i bez)
to obalił: w pełnym czytniku spójny odczyt pierścienia bez kreski **zajmuje** okręgi wokół siebie, więc pominięcie go pozwala
odczytać okrąg, którego pełny czytnik nie czyta (4 zamiast 2 zbadanych okręgów na symbolu bez kreski). Bezpośrednio albo
łańcuchowo (A bez kreski zajmuje B bez kreski, który zająłby C z kreską) mogłoby to **dodać** okno połaciowe, którego N2 nie miał.
Na 5 realnych rzutach nie wystąpiło, ale dowód „z konstrukcji” nie istniał.

Poprawka (`callouts.ts`): część tania (tusz, margines, kreska) jako `inspect`; dla `requireBar` liczony od końca zasięg `matters`
— pierścień bez kreski jest czytany (OCR) tylko, gdy jego odczyt mógłby zająć, bezpośrednio lub łańcuchowo, okrąg z kreską; taki
odczyt zajmuje miejsce jak w N2, ale nie jest zwracany. Pozostałe pierścienie bez kreski nie mogą wpłynąć na żaden okrąg z kreską,
więc ich OCR jest pomijany. Wynik: odczyty z kreską **identyczne z pełnym czytnikiem z konstrukcji** (w tej samej kolejności, pole
w pole). Dodano opcjonalny licznik `stats { rings, ocr }`. Bez `requireBar` zachowanie = N2.

### 4.3 Benchmark czytnika (te same rzuty, region i promienie co `reconstruct-v2`; mediana z 5, naprzemiennie, jeden proces)

`research/analyzer-005x-n3-cross-provider/callout-bench.ts`; rzuty z cache (4 rzuty poddasza + rzut parteru Rarytasów, bo to
kondygnacja pod dachem).

| dom | okręgi | OCR bez bramki | OCR z bramką | czas bez → z bramką | oszczędność | odczyty z kreską identyczne |
|---|---|---|---|---|---|---|
| A01 | 61 | 61 | 26 | 15,2 → 7,8 s | 49 % | ✓ (17; 6 spójnych par) |
| Cieszynianki | 127 | 127 | 20 | 19,2 → 5,9 s | 69 % | ✓ (11; 1 odczyt bez kreski pominięty — `readPlanRooflights` i tak go odrzuca) |
| Goździkowce | 79 | 79 | 16 | 12,9 → 4,7 s | 64 % | ✓ (16) |
| Marcówki | 94 | 94 | 40 | 13,5 → 4,6 s | 66 % | ✓ (25) |
| Rarytasy G2E | 175 | 175 | 46 | 26,2 → 7,1 s | 73 % | ✓ (19) |
| **suma** | 536 | **536** | **148 (−72 %)** | 87,0 → 30,1 s | **65 %** | 5/5 |

(Niedokładna wersja kandydata: OCR 536 → 88, oszczędność 56–83 %; różnica to cena dokładności.)

Pozostały koszt: ~130–200 ms na jeden OCR okręgu i ~3–4 s samego szukania pierścieni na rzut 853 px.

### 4.4 Cała analiza (replay offline 5 domów, sekwencyjnie, 2 rundy, czysty pomiar)

| dom | N2 (586fa40) | N3 końcowy | zmiana | maxRSS N2 → N3 |
|---|---|---|---|---|
| A01 | 25,7 / 24,2 s | 17,6 / 17,5 s | −30 % | 677 → 662 MB |
| Goździkowce | 25,2 / 23,6 s | 17,3 / 16,2 s | −31 % | 768 → 572 MB |
| Marcówki | 27,8 / 26,3 s | 16,9 / 17,0 s | −37 % | 742 → 640 MB |
| Cieszynianki | 33,5 / 32,3 s | 17,9 / 18,7 s | −44 % | 727 → 685 MB |
| Rarytasy G2E | 47,2 / 49,8 s | 26,4 / 27,0 s | −45 % | 840 → 788 MB |
| **suma** | 159,4 / 156,2 s | 96,1 / 96,4 s | **−39 %** | brak narzutu pamięci |

Czasy obejmują start vite-node (~3–4 s). Pięć równolegle (4 rdzenie): 40 s (N2: 79 s wg raportu N2).
**Android: NOT_READY** — 17–27 s na desktopie to przy 4–6× wolniejszym telefonie nadal ponad minutę.

### 4.5 Kontrole pięciu modeli (wszystkie 20+ przebiegów N3)

| dom | model | oczekiwany |
|---|---|---|
| A01 multi-source | 1661d4bf | 1661d4bf (= N2: 6/7 okien połaciowych, 7. UNRESOLVED, 3 kominy) |
| Goździkowce | 911456a8 | 911456a8 (nr 8, brama 3,22 m bez zmian) |
| Marcówki | cf797743 | cf797743 |
| Cieszynianki | e4e56292 | e4e56292 |
| Rarytasy DEV G2E | 9f5fd342 | 9f5fd342 |
| Rarytasy OWNER m3ea | NOT_RUN | brak wejścia; G2E nie podstawiony |

`Photo…`: zdjęcie OWNER-a a478b5ff, A01 a32163dc — jak w N2. NON_MANIFOLD w wykuszu OWNER-a (`ring-wing-1-0-w0`, otwór
w ścianie pod piramidą) — bez zmian, nienaprawiony, brak `VISUAL_VERIFIED`.

Pełnych testów nie powtarzano w pętli; na końcu wąski zestaw (§4.1) + tsc. Znany fail śledzonego APK > 32 MB pozostaje
odrębny i niedotknięty (`KNOWN_BASELINE_FAIL`).

## 5. FAZA B — segmentacja i zdjęcia

### 5.1 Audyt gotowych modeli (stan Hugging Face 2026-10-20)

| model | klasy | licencja | ONNX / rozmiar | ocena |
|---|---|---|---|---|
| SegFormer B0–B5 ADE20K (nvidia; też ONNX Xenova/optimum) | wall, building, sky, tree, grass, window, door, mountain — **bez dachu** | NVIDIA Source Code License (**niekomercyjna**) | 4,4–15 MB | **niedozwolony** w produkcie |
| MaskFormer R50 ADE20K-full (onnx-community) | 847 klas | brak licencji na karcie | 43–166 MB | niejasna licencja — odrzucony |
| Mask2Former / MaskFormer COCO, Swin | — | „other” | brak ONNX | odrzucony |
| UperNet-ConvNeXt-S, OneFormer Swin-T, DPT-large ADE | ADE20K | MIT / MIT / Apache-2.0 | brak ONNX; 200 MB – 1,3 GB | eksport wymaga PyTorcha (brak; ~1,7 GB wolnego dysku), rozmiar nieakceptowalny |
| **DETR-R50 panoptic** (facebook, eksport Xenova) | COCO things+stuff: **roof**, house, wall-*, window-*, door-stuff, sky, clouds, tree, bush, grass, mountain… | **Apache-2.0** | int8 44,5 MB | **przetestowany** |

### 5.2 Test masek DETR (rozwojowe: b1 domki w lesie, b4 dom z darnią na tle gór — oba znane od N2)

Skrypt `segment-probe.ts` (research, nie produkcja; wagi spoza repo przypięte SHA-256 `93abfec8…`; ORT-web z repo, 1 wątek).

- Zestaw wykrytych klas trafny (b1: rock / roof / house / tree / grass / sky; b4: mountain / sky / house / river / grass).
- **Maski przestrzennie bezużyteczne**: b1 — dom i drzewa jako „grass”, b4 — szum. Eksport ma zapieczone kształty z trasowania
  (`pixel_mask` 64×64, `pred_masks` 16×16; ORT ostrzega o niezgodności). Na 64 px nie wykrywa niczego.
- Koszt na desktopie: wczytanie 1,0–1,2 s, wnioskowanie **8,5–11,6 s** (640×480), **+1,1–1,4 GB RSS**. Na telefonie nie do przyjęcia,
  nawet przy poprawnym eksporcie.
- Wniosek: brak bezpiecznego postępu w budżecie; ciężkiej zależności nie wymuszam. Eksperyment zostaje w `research/`.
  Realna ścieżka na później: mały segmentator z permisywną licencją wyeksportowany samodzielnie z dynamicznymi wymiarami
  (wymaga środowiska z PyTorchem) albo deterministyczny model nieba obejmujący chmury (FIRST_BAD TeA).

### 5.3 BLIND-N3 (zamrożony przed biegiem, `71c1458`; kod ścieżki zdjęcia = N2)

Reguła i hashe: `research/analyzer-005x-n3-cross-provider/blind-manifest.md` (Commons, `Category:Houses_in_Poland`, 4 pierwsze
JPEG z „dom/house” w tytule; CC BY-SA 3.0/4.0). Jeden bieg.

| id | wynik | ocena po obejrzeniu | dach vs tło | ściany | okna/wejście | typ dachu | fałszywy model | odmowa poprawna |
|---|---|---|---|---|---|---|---|---|
| n1 dom piętrowy na zboczu | model 6b351f43 (GENERAL, COARSE) | **BŁĘDNY** — okap w pasie okien piętra, wieżyczka 1,5 m szerokości | ✗ | ✗ | 0 | ✗ | **tak** | — |
| n2 dom w budowie, szczyt frontowy | odmowa (okap pokrywa za mało obrysu) | dom wyraźny — odmowa = brak zasięgu | — | — | — | — | nie | niepotrzebna |
| n3 dom wśród drzew | odmowa (brak nieba nad domem) | dom zasłonięty lasem | — | — | — | — | nie | **tak** |
| n4 dom z klinkieru za ogrodzeniem | model 07fab7f7 (NEUTRAL_BAND, DETAILS) | **częściowy** — okap skrzydeł bocznych w dobrym miejscu, środkowy szczyt pominięty, stopa na ogrodzeniu, 1 z ≥ 8 okien; `DETAILS_SUPPORTED` przy jednym oknie jest na wyrost | ~ | ~ | 1/≥8 | ✗ (szczyt frontowy pominięty) | częściowo | — |

**0/4 poprawnych modeli, 1 fałszywy model.** Czysto maskowego postępu brak (segmentator niewpięty); postępu modelu 3D brak.
TeA (`Photo…`): 2 nazwane odmowy, 0 fałszywych.

### 5.4 Rendery (BuildWorld web, Three.js, te same presety kamer, commit 71c1458)

ZIP poza repo `005x-n3-renders.zip` (SHA-256 `3fb11a7c453a7027d730b1c8c0e6a7ec99793d41050f1b8a6afa5f7cff5d2239`): tylko widoki modeli BuildWorld (przód, tył, boki, góra bez dachu,
¾, parter z góry) dla: TeA ogród w trybie SILHOUETTE (opt-in), BLIND-N3 n1, BLIND-N3 n4, plus tabela sum kontrolnych i ten
raport. TeA w trybach domyślnych i URL nie ma modelu — nie ma czego renderować (odmowy są w tabelach, bez obrazka). Żadnych
grafik wydawcy ani zdjęć Commons w ZIP-ie i w repo. Wszystkie modele: `geometry ok`, 0 błędów strony.

## 6. Pliki

- `packages/source-metrics/src/callouts.ts` — bramka `requireBar` dokładna z konstrukcji, `stats`.
- `packages/reconstruction/test/generic-openings-005x.test.ts` — test z pierścieniem bez kreski.
- `packages/source-package/src/image.ts`, `src/webp-dec.d.ts`, `package.json`, `package-lock.json` — WebP.
- `packages/source-package/test/image.test.ts` — 3 testy WebP.
- `research/analyzer-005x-n3-cross-provider/` — `preregistration.md`, `blind-manifest.md`, `run-url.ts`, `callout-bench.ts`,
  `segment-probe.ts`, `ledger.json`.

## 7. Ograniczenia i następny krok

- TeA nadal bez modelu: cyfry wymiarów 7–9 px na rzucie 800 px są poniżej progu czytelności; poprawne zachowanie to odmowa.
  Następny ograniczony krok (bez TeA jako zbioru strojenia): pytanie do użytkownika o jeden wymiar całkowity, gdy rzut ma
  pasma ścian, ale skala jest nieustalona — kontrakt „brak danych kończy się pytaniem”.
- Komunikat „brak rzutu” przy rzucie niedekodowalnym — do poprawy na `PLAN_NOT_DECODABLE`.
- Zdjęcia: model nieba bez chmur i drzew jest FIRST_BAD zarówno TeA, jak i BLIND; segmentator wymaga własnego eksportu.
- `DETAILS_SUPPORTED` przy jednym odczytanym oknie (n4) — próg poziomu jakości do przeglądu.
