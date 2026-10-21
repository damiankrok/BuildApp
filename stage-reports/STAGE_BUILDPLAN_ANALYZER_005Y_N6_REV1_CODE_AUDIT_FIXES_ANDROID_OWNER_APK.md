# STAGE BUILDPLAN-ANALYZER-005Y-N6 REV1 — audyt kodu, poprawki ze źródła, APK dla OWNER-a

Status: **OWNER_VISUAL_PENDING** · APK: **APK_BUILT_AND_ATTACHED** (plik w sesji; publikacja na
`owner-preview-latest` zablokowana przez proxy sesji, komenda zastępcza niżej) · **ANDROID_3D_NOT_DEVICE_VERIFIED**
· **APK_SIZE_GATE_BASELINE_FAIL**. To jest OWNER TEST PREVIEW, nie OWNER_ACCEPTED.

Gałąź `analyzer/005y-n4-general-architectural-understanding-v1`, start `27d4ba5`; bez rebase, merge, nowej gałęzi
i force-push. `claude/new-session-3kzcgh` (`bfaf286e…`), gałąź domyślna, tagi i `preview-latest` nietknięte.

## A — punkt wyjścia

Produkcja N5 zamrożona (5 domów + 3 analogi, `ledger.json` → `models.*.n5`). Czerwone na starcie i co z nimi:

| Czerwone | Teraz |
|---|---|
| mobile-scene parity (2) | **naprawione** — eksport scen (`468bdf8`); model ten sam, kompilator geometrii dał 4978 zamiast 5110 trójkątów |
| architektura: ścieżka `research/` w komentarzu recognisera | **naprawione** (`054dc35`) |
| architektura: `stair-fit.ts` buduje model poza replayem | **naprawione** (`5749ec1`, refaktor bajt w bajt) |
| architektura: APK 39 556 682 B > 32 MB | zostaje — **APK_SIZE_GATE_BASELINE_FAIL**, nowy APK 39 638 490 B; bramka nie ruszona |
| architektura: wall-strip, bajt w bajt względem bazy 005Q (2) | zostaje — bramka historyczna, nie osłabiona |
| local-analyzer: scena Larchfield ≠ migawka kontraktu 03Y1 | zostaje — pada identycznie na `27d4ba5`; parzystość hashy desktop/bundle/Node 18 przechodzi |

## B — audyt i refaktory (każdy osobnym commitem, każdy z dowodem parzystości)

Inwentarz funkcji: `research/analyzer-005y-n6/function-map.ts` (AST). Mapa: **`docs/analyzer/CODE_MAP.md`**
(ścieżka, gdzie mieszka które zachowanie, jak dowodzić zmiany, dwa przykłady debugowania).

| Domena | Commit | Zmiana | Dowód |
|---|---|---|---|
| rekonstrukcja | `d789e7a` | `readWallOpenings` 342 linii / zagnieżdżenie 13 → 184 / 4: `matchOpeningCallout`, `resolveSillAndHead`, `classifyOpeningFamily` czyste, progi nazwane w metrach | replay 8/8 bajt w bajt |
| rekonstrukcja | `1040673` | rejestrator solvera i schody poza `reconstructV2` (1929 → 1842 linii) | replay 8/8 |
| rekonstrukcja | `3917149` | `wallBandWindow` — okno grubości ścian, nazwane progi | replay 8/8 |
| źródło/obraz/metryki | `054dc35` | `inspectTintedRing`, `tintedRingHalves` poza `readTintedCallouts` (221 → 155) | **produkcja** 8/8: `metric-evidence.json` i `model.json` bajt w bajt |
| model/scena | `f46a2e2` | `describeStair`, `stairSegmentSummary`, `phraseOf` (`describeObject` 287 → 256) | paczki scen bajt w bajt: 7 wysyłanych + 8 modeli produkcji |
| rekonstrukcja | `5749ec1` | `stair-fit` uruchamia program tylko przez `candidate.ts` | replay 8/8 |

Nowe granice z testami: (i) pasma rzutu vs grubość/głębokość — `wall-band-window`, `face-to-face-scale`;
(ii) rodzaj otworu / drzwi / garaż / narożnik z negatywami — `opening-reading` (17 przypadków);
(iii) schody — `house-stair` (otwór w stropie), `splitAtBreaks`.

## C — poprawki ze źródła

| # | Ustalenie (FIRST_BAD) | Zmiana | Wynik |
|---|---|---|---|
| R1 | 0,427 m **zgadza się ze źródłem**: ściana rysowana 21–22 px × 0,0203 m/px, opis „bloczek 24 cm + styropian 20 cm”; głębokość 8,30 = druk 830. Wadą była fikcyjna ścianka 0,10 m przy z = 0,427 z 3 drzwiami skopiowanymi z frontu: rejestracja wzięła mppY = 0,020108 z dwóch krótkich kotwic (0,55 i 0,77 m), a łańcuch 830 stoi na licach 149…557 px | rama rzutu: wymiar podany przez łańcuch kładziony od lica do lica (`faceToFaceMetresPerPixel`), gdy skala arkusza mija lica o ≥ 2 px | **FIXED_AND_VERIFIED** — ścianka i 3 drzwi znikają; Rarytasy (0,9 px), Cieszynianki (0,7 px) bez zmian |
| R2 | tabela niżej | — | zmiany N5 zgodne ze źródłem; kółka 100/120 i 150/210 na ścianach szczytowych nie są znajdowane |
| R3 | mapowanie niżej | — | 7/7 Goździkowce i 7/7 A01 przypisane do kółek źródła |
| F1 | Goździkowce 70/210 w wnęce: poniżej 0,75 m klasyfikator nie pytał o skrzydło | wąska szczelina do podłogi ze skrzydłem lub łukiem = DOOR; bez nich nadal WINDOW; próg 0,75 m nietknięty | **FIXED_AND_VERIFIED** — DOOR 0,70 × 2,10, skrzydło LEFT/IN |
| F2 | Rarytasy: łańcuch 196·688·836 niewykryty (roślinność narysowana na obu znacznikach garażu); bryła cięta na liniach 175,5/420 px (420 = oś ściany 412–428) | bryła poza obwiednią mierzoną łańcuchami sięga zewnętrznych lic ścian (jak odczyt OUTER_FACE) | garaż 6,665 → **6,857 m** (druk 6,88); wejście (słup, daszek, doświetle) — bez zmian, FIRST_BAD z N4 |
| F3 | A01 narożnik: kółka 118/220 i 250/220 znajdowane jako podkręgi 9–11 px; nadproża z elewacji 2,04 vs 1,99 m | — (tolerancji narożnika nie luzuję) | **NAMED** — źródło/metryki |
| F4 | Cieszynianki: 2 przecięcia zewnętrzne = komin-2 nad kalenicą dachu kopertowego; audyt miał regułę „komin przebija dach” dla dachu jednoczęściowego, nie dla połaci | ta sama reguła dla połaci | błędy zewnętrzne **2 → 0**; model bez zmian; konflikt gruntu elewacji wschodniej — **otwarty** |
| F5 | Trytomy, Sasanki 3: drabinki stopni znalezione, ale scalanie doklejało sąsiedni bieg — pas 1,83–1,89 m > 1,5 m i drabinka odrzucana | grupa szersza niż bieg dzielona na przerwach ≤ 12 px; grupy już przyjmowane bez zmian | Sasanki 3 dostaje schody (placeholder), Trytomy przestawione; **cel 3 prawdziwych biegów niespełniony** (nadal 1: Marcówki 17 × 0,180 m) |

Marcówki: 17 podstopnic po 0,180 m, onRiser i 1,9 cm komin↔ściana — bez zmian (model bajt w bajt). OWNER Rarytasy
m3ea — NOT_RUN.

### TRYTOMY_OPENING_DIFF (N4 → N5 = N6, wobec rzutu źródła)

| Ściana | N4 | N5/N6 | Źródło | Ocena |
|---|---|---|---|---|
| L0 zachód | okno 3,68 m | okno 1,02 (0,90/1,30 zał.) | 100/120 | szerokość poprawna; wysokość założona — kółko nieznalezione |
| L0 zachód | okno 1,24 | okno 1,00 (zał.) | 100/120 | j.w. |
| L0 zachód | drzwi 0,51 | — | brak | usunięcie poprawne |
| L0 front | okno 2,75 | GARAGE_DOOR 2,75 × 2,25 | 275/225 | poprawne |
| L0 wschód | okno 2,47 | okno 2,58 (zał.) | 277/230 | kółko nieznalezione; rodzaj niepewny |
| L1 zachód | drzwi 0,78 h 1,40 | — | brak | usunięcie poprawne |
| L1 zachód | okno 1,58 / 2,39 h 0,30 | okna 1,54 (0,90/1,30 zał.) ×2 | 150/210 ×2 (drzwi balkonowe) | szerokość poprawna; rodzaj i wysokość błędne — kółka nieznalezione |
| L1 zachód | okno 0,68 h 0,73 | — | brak | usunięcie poprawne |

### Mapowanie okien połaciowych (numer → kółko źródła → wiązanie → niepewność)

- **Goździkowce** (78/140): #1–3 połać niższa (kółka x 330/457/576 px), #4–7 wyższa (330/422/510/576). #3, #6, #7 —
  własny symbol (±0,05 m); #1, #2, #4, #5 — linia okapu rzędu (±0,15 m wzdłuż spadku).
- **A01** (78/118): #2–3 niższa (kółka 560/605 px), #4–7 wyższa (319/405/561/605); #1 — kółko 78/118 przy
  x ≈ 320 px na niższej połaci jest w źródle, ale nieodczytane: okno stoi na samym symbolu (±0,3 m). Pełna tabela:
  `ledger.json` → `fixes.R3.mapping`.

## D — weryfikacja

- `tsc` czysty; rekonstrukcja 77 plików / 970 testów; source-metrics 20 / 318; geometria + model 21 / 161;
  mobile-scene 81/81; architektura 339/343 (4 bazowe czerwone wyżej).
- Produkcja 5 + 3 (offline, recogniser) na `f74cfb5`: każdy model = replay bajt w bajt, `metric-evidence.json`
  = N5 bajt w bajt, błędy zewnętrzne 0 (Arganie 5 — wcześniejsze, attyka/dach płaski i styk dachów). Późniejsze
  commity to refaktor bajt w bajt i dokumentacja.
- Lokalny analizator w APK: `analyzer.mjs` sha256 `6ba2e270…`, ONNX `9ef676d6…`, słownik `9a8199f8…`, WASM
  `3398c10d…`; zawiera poprawki tej sesji. Node 18.20.4 (także bez ICU): Larchfield i Holloway — hashe równe
  desktopowi.
- Ścieżka model → scena → Kotlin/Filament: 8 paczek scen w APK = zasoby w repozytorium bajt w bajt. Emulatora
  ani urządzenia w tej sesji nie ma — **ANDROID_3D_NOT_DEVICE_VERIFIED**.

## E — APK dla OWNER-a

| | |
|---|---|
| plik | `BuildPlan-Model-Preview-arm64-v8a-debug.apk`, 39 638 490 B |
| SHA-256 | `02d79d613f160d7067380c1b234436b4e4544eb9a11f71103ff5b5e6ad4268e8` |
| commit | `ffa07daddd34ed1fdb00e8c863669a06b16a0c53` |
| applicationId / versionCode / versionName | `com.buildplan.preview` / **1302** / `0.1302.0-owner` (`-PpreviewVersionCode`, ostatni CI = 1301) |
| ABI | arm64-v8a (`lib/arm64-v8a` tylko) |
| podpis | v2, jeden podpisujący, cert SHA-256 `6e48fac4afaa3d70e70de5bc608aa4c4194206a9e6bc993dab56382b921ca0da` (ten sam co dotychczasowe podglądy); `verify-preview-signature.sh`: ok |

Publikacja: proxy GitHuba w tej sesji przyjmuje tylko ciała JSON (`415` dla binarnego uploadu) — bez ponawiania.
APK przekazany plikiem. Zastępczo, z repozytorium z zalogowanym `gh`:

```
gh release upload owner-preview-latest BuildPlan-Model-Preview-arm64-v8a-debug.apk#BuildPlan-owner-preview.apk --repo damiankrok/BuildApp --clobber
```

Instalacja: nadpisuje dotychczasowy podgląd (ten sam podpis, wyższy versionCode); bez odinstalowania.

## Czego nie zweryfikowano / co zostaje otwarte

F3 (narożnik A01: kółka na liniach szkła), F4 (grunt prawej elewacji Cieszynianek), F5 (prawdziwe biegi na
analogach: drugi bieg i zabiegi), F2 wejście Rarytasów, R2 (kółka na ścianach szczytowych Trytomów), łańcuch
196·688·836 Rarytasów (metryki), Arganie 5 ustaleń zewnętrznych, migawka kontraktu Larchfield. AI: nie uruchamiano.
