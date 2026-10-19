# STAGE BUILDPLAN-ANALYZER-005U-N2-PLAN-MASS-FIRST-BAD

**Werdykt: `SAFE_MASS_TOPOLOGY_FIX_WITH_MEASURED_3D_CHANGE`.** A01 Jarzmianki (`m60124f28f071a`) to teraz jedna bryła
pod jednym dachem dwuspadowym. Wcześniej był bryłą główną i dwoma „przybudówkami” z płaskimi dachami, które stały
wewnątrz obrysu dachu głównego. Pierwszy zły krok leży w `planBodies`, w teście prostokątności grupy. Poprawka jest
jedna i generyczna. Cztery kontrole dają bajt w bajt te same modele. OWNER nie oglądał wyniku (**OWNER_VISUAL_NOT_RETESTED**).

| | |
| --- | --- |
| Repozytorium / gałąź | `damiankrok/BuildApp`, `analyzer/005u-n2-plan-mass-first-bad-v1` |
| Baza | `074c956bf5951c8b78bbbcafa33e0a4279a11c7e` (gałąź `analyzer/005u-owner-visual-first-bad-fix-v1`) |
| HEAD | commit z tym raportem: <https://github.com/damiankrok/BuildApp/commits/analyzer/005u-n2-plan-mass-first-bad-v1> |
| Mirror `claude/new-session-3kzcgh` | `bfaf286e95105c2cdb32df2d298d3cd93bd43449`, nietknięty; `main`, wydania i link APK OWNER-a nietknięte |
| CI / APK / emulator / pełne `npm test` | **NOT_RUN** |
| SCREENSHOTS_RECEIVED | **NO**. ZIP ze zrzutami OWNER-a nie dotarł do tej sesji: nie ma go w załącznikach ani na dysku. Nie oglądałem żadnego zrzutu |
| Piksele z cache | **YES**. Rzut parteru A01 obejrzany lokalnie z cache bajtów, w prywatnym katalogu poza repozytorium. Nic z tego nie trafiło do Gita |

## 1. Reprodukcja

Wejście to zapieczętowany graf N1v i dowody metryczne z 005T. Replay jest offline: sam solver, bez OCR i bez sieci
(`research/analyzer-005t-n2/replay-solver.ts`). Ślad bryły daje nowy harness `research/analyzer-005u-n2-mass/trace-mass.ts`,
który zapisuje wyłącznie liczby i identyfikatory, poza repozytorium. Model „przed” jest odtworzony bit w bit:
`3a2566047b6f95cc4491e8261b3eaa1658c36b4f4689701c228c54ed4e481a28` (głowa 005U-V1).

Rzut parteru: ramka `frame-asset-rzut-3db285e128-e3f3f41d03`, 853 × 853 px, 0,02031 / 0,020108 m/px. Dekompozycja czyta
ścianę jako 7,5 px = 0,152 m. Na rzucie widać **jeden** obrys ścian zewnętrznych, a pomieszczenia 4 (kuchnia) i 6 leżą
w jego wnętrzu, przy górnej ścianie. Nie ma ściany oddzielającej „przybudówkę” od reszty domu.

## 2. FIRST_BAD

**Funkcja:** `planBodies` w `packages/reconstruction/src/plan-decomposition.ts`. Przed zmianą był to test
`rectangular` w liniach 2696–2700, a po zmianie jest w liniach 2696–2711.

Łańcuch (pełny w `research/analyzer-005u-n2-mass/first-bad.ndjson`):

1. **Unia regionów działa.** Pięć regionów BUILT ma między sobą udział ściany poniżej 0,5, więc trafia do jednej grupy:
   - `region-built-0-26`, `region-built-0-8`, `region-built-0-2`, `region-built-0-1`, `region-built-11-2`;
   - udziały: `0-8|11-2` = 0,000, `0-8|0-2` = 0,093, `0-8|0-26` = 0,215, `0-2|0-1` = 0,120.
2. **Test prostokątności odrzuca grupę.** Grupa zajmuje ramkę {x 228–745, y 163,5–557} px. Każda komórka w tej ramce
   musi być częścią bryły albo kieszenią, a trzy rodzaje komórek nie są ani jednym, ani drugim:
   - **wiersz iy = 1** (y 163,5–171 px, 0,15 m), OUTSIDE: wewnętrzna połowa górnej ściany zewnętrznej, którą siatka
     wycięła jako osobny wiersz;
   - **kolumna ix = 10** (x 533,25–545 px, 0,24 m), OUTSIDE: rdzeń ścianki działowej między pokojami;
   - **`region-built-10-3`** {533,25; 183; 545; 200} px: ten sam rdzeń, czytany jako „pokój” o szerokości 0,24 m,
     ze ścianą 1,0 po obu stronach.
   - Komórki `[12,1]` i `[13,1]` mają na dolnej krawędzi wall = 0,19 i 0,45, bo w górnej ścianie są okna. Sama ściana
     nie przekracza tam 0,5; ściana razem z otworem już tak.
3. **Grupa rozpada się na części**, a `recutSlivers` składa z nich trzy bryły (współrzędne modelu, z = 0 od frontu):
   - `main` (`mass-0`, MAIN) [0; 10,5] × [0; 6,406], kondygnacje 0 i 1;
   - `attached-0` (`mass-1`, ATTACHED) [0; 6,196] × [6,406; 8,008], kondygnacja 0;
   - `attached-1` (`mass-2`, ATTACHED) [6,436; 10,5] × [6,406; 7,858], kondygnacja 0.
4. **Emiter buduje dla nich osobne dachy:**
   - `roof-attached-0` FLAT i `roof-attached-1` FLAT, oba wewnątrz footprintu `roof-main` GABLE 40° [0; 10,5] × [0; 8,3];
   - pierścienie `ring-attached-0-0` i `ring-attached-1-0`.
   - To są „białe zęby” pod połacią.

Dwa rzeczywiste identyfikatory z danymi: `region-built-10-3` (rdzeń ścianki 0,24 m czytany jako pokój, ściana 1,0 po obu
stronach) i `region-built-11-2` → `mass-2` → `attached-1` (udział ściany 0,000 do `region-built-0-8`, czyli brak ściany
między „przybudówką” a domem).

### Mapa obrysu (wektorowo, z liczb modelu; bez pikseli wydawcy)

```
z (m)          PRZED                                        PO
 0,00 +-----------------------------------+      +-----------------------------------+
      |                                   |      |                                   |
      |  main  (MAIN, kond. 0+1)          |      |  main  (MAIN, kond. 0+1)          |
      |  [0;10,5] x [0;6,406]             |      |  [0;10,5] x [0;8,008]             |
      |                                   |      |                                   |
 6,41 +-------------------+-+-------------+      |                                   |
      | attached-0  FLAT  |#| attached-1  |      |                                   |
      | [0;6,196]         |#| [6,436;10,5]|      |                                   |
 7,86 |                   |#+-------------+      |                                   |
 8,01 +-------------------+                      +-----------------------------------+
 8,30 . . . . . . . . . . . . . . . . . . .      . . . . . . . . . . . . . . . . . . .
      x = 0                          x = 10,5    (kropki: footprint dachu GABLE, z do 8,3)
      # = rdzeń ścianki 0,24 m (region-built-10-3 / kolumna ix=10)
```

## 3. Poprawka (jedna, generyczna)

W `planBodies`, wewnątrz ramki grupy, komórka jest **materiałem ściany** (nie należy do bryły i nie robi w niej dziury),
gdy spełnia oba warunki:
- jej węższy wymiar ≤ max(0,5 m; 1,5 × grubość ściany z rzutu), dla A01 0,5 m;
- co najmniej jedna jej krawędź ma `wall + opening ≥ 0,5`, czyli okno lub drzwi w ścianie liczą się jako ta ściana.

Granice reguły:
- Reguła **nie łączy** regionów rozdzielonych ścianą. Pozwala tylko domknąć do jednej bryły grupę, którą unia już
  utworzyła.
- Grunt, który bryła może otaczać (dziedziniec, ganek, wcięcie L), ma zawsze ≥ 1 m szerokości.
- Pas bez narysowanej ściany pozostaje gruntem.
- Bez znanej grubości ściany reguła milczy.
- Stałe `WALL_SLIVER_MIN_M = 0,5` i `WALL_SLIVER_FACTOR = 1,5` są nazwane przy `POCKET_FLOOR_M2`.
- Nie ma tu nazwy domu, slugu, edycji ani postprocessingu renderera.

## 4. Przed → po

| | A01 przed (`074c956`) | A01 po |
| --- | --- | --- |
| model SHA-256 | `3a256604…1a28` | `5ea8bbca53f566ecd573413f7b0ac61231a70a4e8d9f809837693c84ec0082e9` |
| bryły | 3 (MAIN + 2 ATTACHED) | **1** (MAIN [0; 10,5] × [0; 8,008], kond. 0+1) |
| dachy | GABLE 40° + 2 × FLAT pod połacią | **GABLE 40°** (footprint bez zmian [0; 10,5] × [0; 8,3]) |
| pierścienie ścian | 4 | 2 (`ring-main-0`, `ring-main-1`) |
| ściany (w tym zewnętrzne) | 32 (16) | 25 (8) |
| otwory / drzwi / okna | 24 / 7 / 17 | 16 / 5 / 11 |
| otwory zewnętrzne: parter O / D | 7 / 2 | 5 / 0 |
| otwory zewnętrzne: poddasze O / D | 10 / 1 | 6 / 1 |
| nieodczytane przerwy zewnętrzne ≥ 3 m | 6 | **1** |
| pomieszczenia (m², z poligonów) | parter 62,03 + 7,67 + 3,97; poddasze 50,71 + 6,07 | parter 78,35; poddasze 59,78 + 11,17 |
| drzwi wewnętrzne poddasza | 4 | 4 (te same) |

Co znaczy spadek liczby otworów:
- Zniknęło 8 otworów zewnętrznych, wszystkie z linii, które **nie są** ścianą zewnętrzną:
  - z linii z = 6,41 (dawna „tylna ściana” bryły głównej) na parterze: 2,32 m, 3,68 m i drzwi 0,71 m;
  - z tej samej linii na poddaszu: 3,17, 1,97 i 3,21 m oraz drzwi 0,72 m;
  - drzwi 1,05 m w ściance między dwoma pasami;
  - „brama” 3,05 m z tyłu `attached-1`.
- Okna z prawdziwej tylnej ściany z = 8,01 zostały: 2,26 m z odczytanym calloutem 226/170 oraz 1,81 m.
- Parter nie ma teraz żadnych drzwi zewnętrznych. „Przed” były dwoje, ale oba stały na liniach wewnętrznych, czyli to
  nie były wejścia. Wejścia nie odczytano w żadnym wariancie; to brak, a nie regresja tej poprawki.
- Tylna ściana szczytowa poddasza ma teraz 1 otwór, a „przed” miała 4 na linii z = 6,41. Rzutu poddasza w pikselach nie
  oglądałem, więc to, czy szczyt ma tam więcej okien, pozostaje **niezweryfikowane**.

Scen „po” nie kompilowałem i do żadnego APK nic nie trafiło.

### Kontrole (ten sam replay, przed = zapis z 005U-V1)

| kontrola | przed | po |
| --- | --- | --- |
| Rarytasy G2E `m84f2903cb8e14` | `9f5fd342…21e7` | `9f5fd342…21e7` = |
| Marcówki | `6152770f…d64f` | `6152770f…d64f` = |
| Cieszynianki (HIP) | `5ca09ead…edfc` | `5ca09ead…edfc` = |
| Goździkowce 3 `m79923e950094d` | `faf56de0…b80a` | `faf56de0…b80a` = |

Zmian w kontrolach nie ma, więc nie ma czego tłumaczyć. Garaż: Goździkowce nadal nie mają garażu na odczycie rzutu
(znany brak z 005U-V1). Prawdziwe przybudówki i garaże pokrywają testy syntetyczne (§5): `fixtures-v2` 3 / 3a Coldharbour
(niższa bryła ATTACHED z płaskim dachem) oraz `attached-bodies` (garaż o otwartym wjeździe). Wszystkie przechodzą bez zmian.

## 5. Testy (zmierzone)

- Nowy test `packages/reconstruction/test/plan-bodies-wall-sliver.test.ts` (7 przypadków).
  - **Pozytywne:**
    - dom rozcięty rdzeniem ścianki i wewnętrzną połową ściany zewnętrznej daje jedną bryłę 10 × 8 m;
    - to samo z oknem lub drzwiami w ścianie, przy której stoi pasek.
  - **Negatywne:**
    - bez grubości ściany reguła milczy;
    - pasek bez narysowanej ściany jest gruntem;
    - przybudówka za narysowaną ścianą nie jest łączona;
    - wcięcie L 4,8 × 2 m nie jest wypełniane;
    - uskok 0,6 m (ponad próg) nie jest wchłaniany.
  - **Na starym kodzie:** oba pozytywne testy failują, 5 negatywnych przechodzi. **Na nowym:** 7/7.
- Rodziny celowane, 23 pliki, **291/291**:
  - `plan-decomposition`, `plan-extent`, `plan-resolution`, `layout`, `walled-off`;
  - `boundary-envelope`, `boundary-post-review`, `attached-bodies`, `attached-roof-form`;
  - `fixtures-v2` (15), `storey-emission`, `compound-facade` (+ `-emission`, `-order`, architektura);
  - `wide-openings`, `openings` (oba), `fit-and-levels`, `assumed-sill-family`, `roof-datum`, `vehicle-door-depth`.
- `npx tsc -p tsconfig.json`: zielono.
- Architektura (`generalization`, `analyzer-v2`, `research-isolation`): 90/91. Jedyny fail to znana bramka z §6.
- Nie uruchamiano: pełnego `npm test`, e2e, Androida, JVM, emulatora, CI ani APK.

## 6. BASELINE_KNOWN_APK_SIZE_FAILURE

Test `tests/architecture/research-isolation.test.ts` › „no tracked file anywhere is the size of a model” failuje już na
bazie (od `074d6ae`):
- limit wynosi 32 MB;
- plik `stage-reports/artifacts/owner-005t/BuildPlan-005T-two-houses-arm64.apk` ma 39,6 MB.

Tego nie naprawiam:
- nie obniżam ani nie podnoszę limitu;
- nie usuwam APK, bo link OWNER-a od niego zależy;
- nie oznaczam tej bramki jako PASS.

Naprawa do decyzji koordynatora: wydanie GitHub zamiast pliku w gałęzi.

## 7. Ograniczenia

- **OWNER_VISUAL_NOT_RETESTED.** Rozpoznawalność A01 po zmianie ocenia OWNER, nie zieleń testów.
- Rzut poddasza A01 nie był oglądany w pikselach, więc zmiana otworów szczytu poddasza (4 → 1) jest niezweryfikowana.
- Parter A01 jest jednym pomieszczeniem 78,35 m². Ścianki parteru nie są emitowane ani przed, ani po zmianie; to
  istniejący brak, poza zakresem.
- Wejście do domu nie jest odczytane.

## Pliki

- `packages/reconstruction/src/plan-decomposition.ts`: poprawka w `planBodies` plus dwie stałe.
- `packages/reconstruction/test/plan-bodies-wall-sliver.test.ts`: testy.
- `research/analyzer-005u-n2-mass/`:
  - `trace-mass.ts`: harness z wyjściem poza repozytorium;
  - `first-bad.ndjson`, `before-after.json`: liczby i identyfikatory, bez źródeł i bez pikseli.

`BUILDPLAN_ANALYZER_005U_N2_PLAN_MASS_FIRST_BAD_SAFE_MASS_TOPOLOGY_FIX_WITH_MEASURED_3D_CHANGE`
