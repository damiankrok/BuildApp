# N7-COUNCIL-001 — inwentarz funkcji

## Jak powstał inwentarz

Mapę wygenerowano TypeScript Compiler API (`research/analyzer-n7-council/inventory/reach.ts`): to graf wywołań
osiągalnych z `runAnalysis` (`packages/analysis-service/src/run.ts`).

- Funkcji produkcyjnych osiągalnych: **1332**.
- Na ścieżce krytycznej geometrii: **426**.

Część 1 zawiera rekordy w formacie wymaganym przez zadanie, dla funkcji, w których recenzenci A–F znaleźli albo
wykluczyli błąd. Klasy są po rundzie obalania F. Część 2 to pełna wygenerowana tabela. Jej flagi (`gives up`, `??`,
`skips`, `throws`) to heurystyka leksykalna, a nie werdykt.

Pełne uzasadnienia są w `reviews/council-<X>.md`. Reprodukcje opisuje `COUNCIL_MINIMAL_REPRODUCTIONS.md`.

## Część 1 — rekordy krytyczne

Kolumny: PLIK → FUNKCJA → WEJŚCIE → ZAŁOŻENIA → MOŻLIWY BŁĄD → SKUTEK → ISTNIEJĄCY TEST → WERDYKT.

| PLIK | FUNKCJA | WEJŚCIE | ZAŁOŻENIA | MOŻLIWY BŁĄD | SKUTEK | ISTNIEJĄCY TEST | WERDYKT |
|---|---|---|---|---|---|---|---|
| source-package/src/acquire.ts | `buildAssets` | strona projektu, obrazy galerii | każdy obraz to osobny rysunek | 3–4 kopie jednego rzutu jako niezależne zasoby | różne skale jednej kondygnacji; utrata poddasza (arganiach) | brak | CONFIRMED (A-1) |
| source-package (role) | słownik ról ARCHON | podpisy i nazwy plików | słowa ze słownika jednoznaczne | „plan-sytuacyjny” jako rzut, „parterowy” na rzucie poddasza | zła kondygnacja | brak | CONFIRMED funkcja czysta (A-6) |
| reconstruction layout | etykiety FRONT/REAR | role elewacji | etykieta prawdziwa | brak kontroli przez geometrię | zamiana stron bez sygnału | brak | CONFIRMED mutacją (A-5) |
| reconstruction layout | wybór kopii bazowej | kopie rzutu | „dimensioned” = najlepsza | słaba etykieta decyduje | METRIC_RESOLUTION_INCONCLUSIVE | brak | HIGH_RISK (A-3) |
| reconstruction layout | `relateAcrossViews` | pary widoków | pary plan–plan zbędne | brak porównania skal kopii | jw. A-1 | brak | CONFIRMED (część A-1) |
| reconstruction layout.ts:839 | klasyfikacja skali | rozwiązanie metryczne | INCONCLUSIVE ≠ drukowana | INCONCLUSIVE traktowane jako PRINTED_SCALE | poddasze w skali 1/3 (maskowane NO_SUPPORT) | brak | CONFIRMED (B-4) |
| reconstruction layout.ts:2105 | `scaleBasis.corroborated` | podstawa skali | liczone z dowodów | stałe `true` poza SAME_PIXEL_SCALE | fałszywa pewność w raporcie | brak | CONFIRMED (A-8) |
| reconstruction plan-decomposition.ts | `decomposePlan` / `bandWallThickness` | pasma ścian rzutu | mediana = ściana zewnętrzna | mediana obejmuje działowe; jedna T dla domu | gozd T 0,304 vs lica 0,431; dobudowy 0,15 → 0,44 | brak | CONFIRMED (B-1) |
| reconstruction layout | bramka wąskiej bryły | `wallM`, obrys | `wallM` = T emisji | `wallM` 0,22–0,29 vs T 0,43–0,46 | dziś maskowane podłogą 1,0 m | brak | DESIGN_LIMITATION; HIGH_RISK jako przyczyna (B-2) |
| reconstruction plan-decomposition.ts | `mergeRegions` | regiony rzutu | kafel prostokątny nie przecina ścian | kafel przechodzi przez pasmo ściany | garaż wcielony, fantomowa bryła | brak | CONFIRMED (C-1) |
| reconstruction plan-decomposition.ts | `decomposeCore` | tusz, otwory | flood fill zamknięty ścianami | wycieka przez szeroką bramę | garaż utracony bez wpisu | brak | CONFIRMED (C-2) |
| reconstruction layout.ts:1925 | cięcie regionu bazowego | region, lico | lica wspólne | cofnięcie przyciągane do lica | +0,30 m głębokości | brak | CONFIRMED drobny (C-3) |
| reconstruction layout | bramka layoutu | wynik layoutu | BLOCKING kończy przebieg | REJECTED → COMPLETE | model mimo odmowy | brak | CONFIRMED (część C-1) |
| reconstruction v2/thin-body.ts | `thinBodies` | bryły v2 | tylko ATTACHED `rect` może być cienki | pomija `storeyRects`, pieces, MAIN | pierścień < 2T bez adjudykacji | P2R testy (tylko rect) | COVERAGE_GAP (D-2/C-4/B-3) |
| reconstruction v2/thin-body.ts | `adjudicateThinBody` (pasmo) | profil tuszu | ściana ≥ 60 % tuszu | otwory łamią pasmo → CANOPY_ON_POSTS | KEEP_PARTIAL → WALLS_OVERLAP przy 21; przy 4 oknach bryła znika | brak (fiksury bez otworów) | CONFIRMED e2e (F-R1) |
| reconstruction v2/thin-body.ts | `adjudicateThinBody` (SHARED_WALL) | pokrycie przez sąsiada | > 50 % = cała strona | częściowe pokrycie usuwa całą stronę | 2,5 m otwartej obwiedni | P2R (pełne pokrycie) | CONFIRMED (D-4) |
| reconstruction v2/thin-body.ts | `elevationOver` | `skyMask` elewacji | nie-niebo = zabudowa | drzewa, bryła z tyłu | fałszywe WIDEN 8,45 → 11,99 | brak | CONFIRMED funkcja / HIGH_RISK prod (E-1) |
| reconstruction v2/thin-body.ts | decyzja WIDEN/DRAWN_THIN_WALLS | hipotezy | decyzja końcowa | brak ponownej kontroli < 2t, brak wpisu | — | brak | HIGH_RISK (F-3) |
| reconstruction v2/emit.ts | `emitBuilding` / `tOf` | MassV2 | `tOf(m)` wszędzie | ramy od `b.wallThicknessM` | FILL_TOO_LARGE, otwór wycięty | brak | CONFIRMED (D-3) |
| reconstruction v2/emit.ts | `openSide` | MassV2.openSide | 3 ściany + CORNER | — | poprawne 8/8 | P2R | NOT_A_DEFECT |
| reconstruction candidate.ts | `repairRing` (+ `parallelConflict`/`moveRingEdge`) | konflikt równoległy | przesunięcie bezpieczne | zwęża 0,62 → 0,57 < 2T | WALLS_OVERLAP w1/w3 przy 21 | brak | CONFIRMED funkcja / HIGH_RISK owner (D-1) |
| reconstruction candidate.ts | `fitPreviewProgram` | próby naprawy | ostatnia próba wystarcza | gubi `reconciled` pierwszej | przyczyna niewidoczna | brak | CONFIRMED (D-1) |
| reconstruction candidate.ts | `cutFailedObject` / `bodyOf` | błąd walidatora | ściany bryły w grupie | bryła SHARED_WALL nie zgrupowana | płyta + jedna ściana | brak | COVERAGE_GAP (D-5) |
| reconstruction candidate.ts | `previewCheckpoint` | program | hash = cały model | hash tylko prefiksu MAIN | „ten sam hash” nie dowodzi niczego | — | NOT_A_DEFECT (interpretacja) |
| model (validator) | WALLS_OVERLAP | pierścień | nakładanie = (2T−W)(L−2T) | — | zgodne 6/6 | B ring-overlap | NOT_A_DEFECT |
| reconstruction v2/verify.ts | SILHOUETTE_WIDTH | widok, model | krawędź niezależna | bierze krawędź najbliższą modelowi | zwężona bryła „zgodna” | brak | CONFIRMED (E-2) |
| reconstruction reconstruct-v2.ts | wysokości otworów | widoki | `viewGroundRefusals` obejmuje wszystko | tylko rejestracja sylwetką | sill/head 0,4–0,7 m źle | brak | CONFIRMED (E-3) |
| reconstruction views.ts | `chooseSide` | elewacje boczne | jedna oś na stronę | odrzuca, gdy oś zajęta | utrata obu bocznych | brak | CONFIRMED (E-4) |
| reconstruction raport elewacji | rezydua / opening report | program sprzed cięcia | = scena | liczone przed `fitPreviewProgram` | raport opisuje inny model | brak | COVERAGE_GAP (E-7) |
| reconstruction facade-alignment.ts | CONFIRMED_MATCH | dopasowanie | wymaga wysokości | zgodność bez wysokości | fałszywa zgodność | P2 testy | CONFIRMED semantyka (E-9) |
| android `recordOf` | wynik analizy | zapis karty | wersja zbędna | gubi `summary.analyzer` | nie da się odróżnić przebiegów | brak | CONFIRMED (F-2) |
| android `LocalRuntimeFiles.install` | bundle | sha folderu | — | — | stary bundel nie przetrwa aktualizacji | — | NOT_A_DEFECT |

## Część 2 — wygenerowana tabela (osiągalne z `runAnalysis`)

Reachable from `runAnalysis`: **1332** production functions (TypeScript Compiler API, `research/analyzer-n7-council/inventory/reach.ts`); **426** in the critical geometry path (files matching the critical-path pattern).

| package | reachable |
|---|---|
| packages/analysis-service | 40 |
| packages/commands | 20 |
| packages/geometry | 108 |
| packages/image-metrology | 22 |
| packages/mobile-scene | 44 |
| packages/model | 118 |
| packages/reconstruction | 541 |
| packages/source-analyzer | 55 |
| packages/source-common | 19 |
| packages/source-cv | 40 |
| packages/source-metrics | 217 |
| packages/source-observations | 36 |
| packages/source-package | 63 |
| packages/source-vision | 9 |

## Critical path (all functions, heuristic flags)

| file:line | function | lines | callers | callees | flags |
|---|---|---|---|---|---|
| packages/analysis-service/src/run.ts:160 | `cancellableDeps` | 9 | 1 | 1 | ?? ×1 |
| packages/analysis-service/src/run.ts:170 | `runAnalysis` | 435 | 1 | 37 | gives up ×1; ?? ×11; skips ×1; throws ×8 |
| packages/analysis-service/src/run.ts:610 | `recogniserSummaryOf` | 23 | 2 | 1 | ?? ×3 |
| packages/commands/src/apply-architecture.ts:61 | `isArchitectureCommand` | 1 | 1 | 0 | — |
| packages/commands/src/apply-architecture.ts:63 | `normalize2` | 4 | 1 | 0 | — |
| packages/commands/src/apply-architecture.ts:68 | `on` | 1 | 1 | 1 | — |
| packages/commands/src/apply-architecture.ts:70 | `executeArchitecture` | 101 | 2 | 13 | gives up ×10; ?? ×3 |
| packages/commands/src/apply-architecture.ts:173 | `relationshipId` | 4 | 1 | 2 | — |
| packages/commands/src/apply-architecture.ts:178 | `intoOuter` | 19 | 3 | 1 | gives up ×2 |
| packages/commands/src/apply-architecture.ts:206 | `plumbCutAtApex` | 37 | 2 | 2 | gives up ×1; skips ×5 |
| packages/commands/src/apply-architecture.ts:250 | `edgeBoard` | 11 | 2 | 4 | gives up ×1 |
| packages/commands/src/apply-architecture.ts:262 | `createDormer` | 91 | 2 | 3 | ?? ×1 |
| packages/commands/src/apply.ts:125 | `stripUndefined` | 5 | 3 | 0 | — |
| packages/commands/src/apply.ts:131 | `applyCommand` | 36 | 3 | 2 | — |
| packages/commands/src/apply.ts:169 | `applyCommands` | 14 | 3 | 1 | — |
| packages/commands/src/apply.ts:185 | `runCommands` | 11 | 1 | 1 | throws ×1 |
| packages/commands/src/apply.ts:199 | `execute` | 340 | 2 | 13 | gives up ×31; ?? ×16; skips ×1; throws ×1 |
| packages/commands/src/apply.ts:540 | `setPath` | 16 | 2 | 1 | — |
| packages/commands/src/apply.ts:557 | `shift` | 1 | 1 | 0 | — |
| packages/commands/src/apply.ts:558 | `shiftRect` | 1 | 1 | 0 | — |
| packages/commands/src/apply.ts:560 | `move` | 72 | 2 | 6 | — |
| packages/commands/src/apply.ts:633 | `resize` | 44 | 1 | 2 | gives up ×1 |
| packages/commands/src/apply.ts:683 | `remove` | 231 | 2 | 5 | skips ×1 |
| packages/mobile-scene/src/bundle.ts:27 | `byId` | 1 | 2 | 0 | — |
| packages/mobile-scene/src/bundle.ts:30 | `flattenMesh` | 30 | 1 | 0 | — |
| packages/mobile-scene/src/bundle.ts:78 | `wallFinishes` | 27 | 2 | 0 | ?? ×1; skips ×1 |
| packages/mobile-scene/src/bundle.ts:112 | `secondaryFinishes` | 5 | 1 | 1 | — |
| packages/mobile-scene/src/bundle.ts:126 | `objectFactsOf` | 33 | 1 | 1 | gives up ×2; ?? ×1 |
| packages/mobile-scene/src/bundle.ts:161 | `flattenScene` | 29 | 2 | 6 | — |
| packages/mobile-scene/src/bundle.ts:198 | `objectMetadata` | 55 | 1 | 9 | ?? ×2; skips ×1 |
| packages/mobile-scene/src/bundle.ts:259 | `meshLevelOf` | 4 | 1 | 0 | gives up ×1 |
| packages/mobile-scene/src/bundle.ts:265 | `levelMetadata` | 4 | 1 | 1 | — |
| packages/mobile-scene/src/bundle.ts:270 | `materialMetadata` | 2 | 1 | 1 | — |
| packages/mobile-scene/src/bundle.ts:291 | `toneHintsOf` | 18 | 1 | 1 | ?? ×2; skips ×2 |
| packages/mobile-scene/src/bundle.ts:315 | `buildMobileSceneBundle` | 23 | 1 | 10 | ?? ×2 |
| packages/mobile-scene/src/describe.ts:61 | `kindLabel` | 1 | 1 | 0 | — |
| packages/mobile-scene/src/describe.ts:63 | `words` | 1 | 2 | 1 | — |
| packages/mobile-scene/src/describe.ts:72 | `kindLabelOf` | 8 | 1 | 1 | — |
| packages/mobile-scene/src/describe.ts:82 | `len` | 4 | 4 | 0 | — |
| packages/mobile-scene/src/describe.ts:87 | `area` | 1 | 1 | 0 | — |
| packages/mobile-scene/src/describe.ts:88 | `deg` | 1 | 1 | 0 | — |
| packages/mobile-scene/src/describe.ts:89 | `rectSize` | 1 | 2 | 3 | — |
| packages/mobile-scene/src/describe.ts:91 | `titleCase` | 3 | 2 | 0 | — |
| packages/mobile-scene/src/describe.ts:100 | `labelOf` | 11 | 3 | 2 | — |
| packages/mobile-scene/src/describe.ts:113 | `levelIdOf` | 4 | 3 | 0 | — |
| packages/mobile-scene/src/describe.ts:118 | `materialIdOf` | 4 | 1 | 0 | — |
| packages/mobile-scene/src/describe.ts:125 | `relate` | 4 | 2 | 1 | gives up ×1 |
| packages/mobile-scene/src/describe.ts:130 | `fact` | 3 | 2 | 0 | — |
| packages/mobile-scene/src/describe.ts:135 | `phraseOf` | 1 | 1 | 0 | — |
| packages/mobile-scene/src/describe.ts:140 | `stairSegmentSummary` | 11 | 1 | 1 | ?? ×1 |
| packages/mobile-scene/src/describe.ts:156 | `describeStair` | 20 | 1 | 6 | gives up ×1; ?? ×1 |
| packages/mobile-scene/src/describe.ts:184 | `describeObject` | 256 | 1 | 14 | ?? ×8 |
| packages/mobile-scene/src/semantics.ts:131 | `upper` | 1 | 1 | 0 | ?? ×1 |
| packages/mobile-scene/src/semantics.ts:147 | `semanticGroupOf` | 90 | 1 | 1 | ?? ×1 |
| packages/mobile-scene/src/semantics.ts:398 | `parseHex` | 6 | 2 | 0 | throws ×1 |
| packages/mobile-scene/src/semantics.ts:405 | `srgbToLinear` | 4 | 1 | 0 | — |
| packages/mobile-scene/src/semantics.ts:411 | `relativeLuminance` | 4 | 2 | 2 | — |
| packages/mobile-scene/src/semantics.ts:416 | `colorDistance` | 5 | 1 | 1 | — |
| packages/mobile-scene/src/semantics.ts:451 | `applyToneHints` | 19 | 1 | 2 | skips ×2 |
| packages/mobile-scene/src/semantics.ts:475 | `toneOfColor` | 4 | 1 | 1 | — |
| packages/mobile-scene/src/semantics.ts:494 | `bundleStyling` | 8 | 1 | 1 | — |
| packages/mobile-scene/src/serialize.ts:18 | `sortKeysDeep` | 13 | 3 | 1 | skips ×1 |
| packages/mobile-scene/src/serialize.ts:32 | `sha256` | 1 | 3 | 0 | — |
| packages/mobile-scene/src/serialize.ts:35 | `hashableText` | 4 | 1 | 1 | — |
| packages/mobile-scene/src/serialize.ts:40 | `bundleContentHash` | 1 | 2 | 2 | — |
| packages/mobile-scene/src/serialize.ts:48 | `serializeBundle` | 1 | 1 | 1 | — |
| packages/mobile-scene/src/serialize.ts:56 | `loadBundle` | 16 | 1 | 1 | — |
| packages/model/src/topology.ts:71 | `endKey` | 1 | 1 | 0 | — |
| packages/model/src/topology.ts:90 | `lineOf` | 6 | 2 | 1 | — |
| packages/model/src/topology.ts:97 | `dot2` | 1 | 2 | 0 | — |
| packages/model/src/topology.ts:98 | `noNegativeZero` | 1 | 1 | 0 | — |
| packages/model/src/topology.ts:101 | `wallPlanPointOf` | 4 | 2 | 1 | — |
| packages/model/src/topology.ts:107 | `depthInto` | 1 | 1 | 0 | — |
| packages/model/src/topology.ts:110 | `alongOf` | 1 | 1 | 0 | — |
| packages/model/src/topology.ts:116 | `crossing` | 6 | 2 | 1 | gives up ×1 |
| packages/model/src/topology.ts:123 | `endPoint` | 1 | 2 | 0 | — |
| packages/model/src/topology.ts:135 | `endAgainst` | 38 | 1 | 6 | — |
| packages/model/src/topology.ts:178 | `nominalExtent` | 4 | 4 | 1 | — |
| packages/model/src/topology.ts:184 | `physicalCore` | 4 | 4 | 0 | — |
| packages/model/src/topology.ts:190 | `physicalSpan` | 4 | 2 | 0 | — |
| packages/model/src/topology.ts:195 | `junctionEndRefs` | 1 | 1 | 0 | — |
| packages/model/src/topology.ts:197 | `junctionWallIds` | 1 | 2 | 0 | — |
| packages/model/src/topology.ts:199 | `resolveWallTopology` | 220 | 6 | 15 | skips ×14 |
| packages/model/src/topology.ts:432 | `wallPhysicalFootprint` | 8 | 3 | 1 | — |
| packages/model/src/topology.ts:445 | `ccw` | 3 | 1 | 1 | — |
| packages/model/src/topology.ts:450 | `clipConvex` | 23 | 2 | 2 | — |
| packages/model/src/topology.ts:474 | `intersect` | 4 | 1 | 0 | — |
| packages/model/src/topology.ts:480 | `convexOverlapArea` | 4 | 1 | 3 | — |
| packages/model/src/topology.ts:494 | `wallOverlapIssues` | 40 | 1 | 2 | skips ×3 |
| packages/model/src/validate-architecture.ts:46 | `inPlaneMaterial` | 5 | 1 | 1 | — |
| packages/model/src/validate-architecture.ts:53 | `intoPlane` | 10 | 1 | 1 | gives up ×2 |
| packages/model/src/validate-architecture.ts:65 | `profileAt` | 9 | 1 | 0 | — |
| packages/model/src/validate-architecture.ts:83 | `readPlatformSemantics` | 23 | 1 | 2 | ?? ×1 |
| packages/model/src/validate-architecture.ts:107 | `architectureIssues` | 404 | 2 | 17 | gives up ×5; ?? ×11; skips ×17 |
| packages/model/src/validate-architecture.ts:513 | `onOrIn` | 10 | 1 | 1 | — |
| packages/model/src/validate-architecture.ts:525 | `planarOutline` | 14 | 1 | 0 | — |
| packages/model/src/validate.ts:37 | `validateModel` | 16 | 2 | 2 | — |
| packages/model/src/validate.ts:55 | `semanticIssues` | 476 | 3 | 25 | gives up ×3; ?? ×8; skips ×23 |
| packages/model/src/validate.ts:536 | `onSegment` | 5 | 2 | 0 | — |
| packages/model/src/validate.ts:543 | `pointInOrOnPolygon` | 5 | 1 | 2 | — |
| packages/model/src/validate.ts:550 | `pointStrictlyInPolygon` | 11 | 2 | 1 | — |
| packages/model/src/validate.ts:562 | `orient` | 1 | 1 | 0 | — |
| packages/model/src/validate.ts:565 | `polygonsEdgesCross` | 17 | 1 | 1 | — |
| packages/reconstruction/src/boundary-bodies.ts:77 | `cover` | 14 | 2 | 0 | — |
| packages/reconstruction/src/boundary-bodies.ts:97 | `relaxedInside` | 36 | 2 | 2 | gives up ×1 |
| packages/reconstruction/src/boundary-bodies.ts:142 | `classifyBodies` | 108 | 2 | 4 | writes geometry ×7; skips ×3 |
| packages/reconstruction/src/boundary-completion.ts:149 | `coverOf` | 14 | 1 | 0 | — |
| packages/reconstruction/src/boundary-completion.ts:167 | `completeBoundary` | 499 | 2 | 3 | gives up ×2; writes geometry ×15; skips ×16 |
| packages/reconstruction/src/boundary-evidence.ts:84 | `solidLayer` | 44 | 1 | 2 | writes geometry ×4; skips ×3 |
| packages/reconstruction/src/boundary-evidence.ts:293 | `inkAt` | 1 | 4 | 0 | — |
| packages/reconstruction/src/boundary-evidence.ts:304 | `readWallLine` | 82 | 4 | 3 | ?? ×2; skips ×1 |
| packages/reconstruction/src/boundary-evidence.ts:388 | `gapStrokes` | 93 | 6 | 3 | gives up ×1; ?? ×2; skips ×2 |
| packages/reconstruction/src/boundary-evidence.ts:487 | `patternAcross` | 23 | 4 | 2 | — |
| packages/reconstruction/src/boundary-evidence.ts:516 | `gapSignature` | 6 | 5 | 0 | — |
| packages/reconstruction/src/boundary-evidence.ts:530 | `solidShare` | 13 | 1 | 1 | — |
| packages/reconstruction/src/boundary-evidence.ts:545 | `inkShare` | 11 | 1 | 2 | — |
| packages/reconstruction/src/boundary-evidence.ts:557 | `drawnSignature` | 1 | 1 | 0 | — |
| packages/reconstruction/src/boundary-evidence.ts:560 | `drawnGapCheck` | 10 | 1 | 1 | — |
| packages/reconstruction/src/boundary-evidence.ts:571 | `classifyGap` | 85 | 2 | 8 | writes geometry ×1 |
| packages/reconstruction/src/boundary-evidence.ts:664 | `assignCallouts` | 35 | 1 | 1 | skips ×4 |
| packages/reconstruction/src/boundary-evidence.ts:706 | `withCallout` | 8 | 1 | 1 | — |
| packages/reconstruction/src/boundary-evidence.ts:716 | `because` | 3 | 2 | 0 | — |
| packages/reconstruction/src/boundary-evidence.ts:733 | `cornerLegs` | 65 | 2 | 4 | ?? ×1; writes geometry ×1; skips ×4 |
| packages/reconstruction/src/boundary-outline.ts:71 | `coverOf` | 14 | 1 | 0 | — |
| packages/reconstruction/src/boundary-outline.ts:94 | `solveOutline` | 136 | 2 | 3 | gives up ×1; ?? ×4; skips ×4 |
| packages/reconstruction/src/boundary-outline.ts:244 | `outlineSupport` | 52 | 2 | 2 | writes geometry ×4; skips ×1 |
| packages/reconstruction/src/candidate.ts:200 | `buildCandidateModel` | 3 | 4 | 2 | — |
| packages/reconstruction/src/candidate.ts:205 | `programApplies` | 3 | 2 | 2 | — |
| packages/reconstruction/src/candidate.ts:210 | `sealCandidate` | 7 | 1 | 4 | — |
| packages/reconstruction/src/candidate.ts:230 | `candidateContentHash` | 19 | 1 | 1 | ?? ×1 |
| packages/reconstruction/src/candidate.ts:258 | `verifyReplay` | 11 | 1 | 3 | — |
| packages/reconstruction/src/candidate.ts:327 | `fitted` | 49 | 1 | 5 | gives up ×1; ?? ×2 |
| packages/reconstruction/src/candidate.ts:383 | `fitOpeningsToHosts` | 52 | 1 | 3 | ?? ×1; skips ×5 |
| packages/reconstruction/src/candidate.ts:476 | `overlapPairsOf` | 10 | 1 | 0 | gives up ×2 |
| packages/reconstruction/src/candidate.ts:487 | `wallLineIn` | 4 | 2 | 0 | — |
| packages/reconstruction/src/candidate.ts:503 | `baseRecord` | 11 | 2 | 0 | — |
| packages/reconstruction/src/candidate.ts:516 | `repairWall` | 15 | 1 | 7 | gives up ×1; ?? ×1 |
| packages/reconstruction/src/candidate.ts:537 | `repairRing` | 35 | 2 | 10 | gives up ×2; ?? ×3 |
| packages/reconstruction/src/candidate.ts:579 | `reconcileWallOverlaps` | 48 | 1 | 8 | ?? ×1; skips ×3 |
| packages/reconstruction/src/candidate.ts:679 | `bodyOf` | 5 | 4 | 1 | gives up ×1; ?? ×1 |
| packages/reconstruction/src/candidate.ts:686 | `createdIdsOf` | 5 | 1 | 1 | gives up ×1 |
| packages/reconstruction/src/candidate.ts:693 | `isPreviewBase` | 4 | 1 | 1 | — |
| packages/reconstruction/src/candidate.ts:699 | `lowestMainStorey` | 4 | 1 | 0 | — |
| packages/reconstruction/src/candidate.ts:709 | `cutFailedObject` | 57 | 2 | 7 | gives up ×6 |
| packages/reconstruction/src/candidate.ts:768 | `distanceToSegment` | 7 | 1 | 0 | — |
| packages/reconstruction/src/candidate.ts:780 | `freeStandingExteriorWalls` | 22 | 2 | 4 | gives up ×1; ?? ×1 |
| packages/reconstruction/src/candidate.ts:808 | `minimalPreviewProgram` | 21 | 1 | 3 | gives up ×2; ?? ×1 |
| packages/reconstruction/src/candidate.ts:831 | `previewCheckpoint` | 11 | 1 | 5 | gives up ×2 |
| packages/reconstruction/src/candidate.ts:859 | `fitPreviewProgram` | 64 | 2 | 6 | ?? ×5 |
| packages/reconstruction/src/layout-gate.ts:80 | `statedSpans` | 12 | 2 | 1 | ?? ×1; skips ×3 |
| packages/reconstruction/src/layout-gate.ts:94 | `corroborates` | 2 | 1 | 1 | — |
| packages/reconstruction/src/layout-gate.ts:104 | `evaluateLayoutGate` | 93 | 2 | 7 | ?? ×2; skips ×1 |
| packages/reconstruction/src/layout-gate.ts:231 | `structuralLayoutContentHash` | 24 | 1 | 1 | ?? ×5 |
| packages/reconstruction/src/layout-gate.ts:257 | `sealStructuralLayout` | 27 | 1 | 1 | — |
| packages/reconstruction/src/layout.ts:83 | `planStoreyOf` | 2 | 2 | 0 | — |
| packages/reconstruction/src/layout.ts:87 | `groundLabelledAmong` | 1 | 2 | 0 | — |
| packages/reconstruction/src/layout.ts:200 | `layoutOptionsOnly` | 5 | 1 | 0 | — |
| packages/reconstruction/src/layout.ts:334 | `minBodySpanM` | 1 | 1 | 0 | — |
| packages/reconstruction/src/layout.ts:336 | `quantity` | 9 | 3 | 1 | — |
| packages/reconstruction/src/layout.ts:360 | `readPlans` | 96 | 2 | 12 | ?? ×3; skips ×4 |
| packages/reconstruction/src/layout.ts:491 | `wallBandWindow` | 9 | 1 | 0 | — |
| packages/reconstruction/src/layout.ts:501 | `planSheet` | 13 | 4 | 6 | gives up ×1 |
| packages/reconstruction/src/layout.ts:519 | `exteriorTicksOf` | 10 | 1 | 0 | ?? ×1; skips ×1 |
| packages/reconstruction/src/layout.ts:537 | `extentSidesOf` | 31 | 2 | 2 | ?? ×1; skips ×2 |
| packages/reconstruction/src/layout.ts:570 | `planCallouts` | 15 | 1 | 1 | — |
| packages/reconstruction/src/layout.ts:587 | `placeholderRegistration` | 20 | 1 | 0 | — |
| packages/reconstruction/src/layout.ts:617 | `chooseBasePlan` | 10 | 2 | 1 | — |
| packages/reconstruction/src/layout.ts:632 | `centre` | 1 | 1 | 0 | — |
| packages/reconstruction/src/layout.ts:633 | `width` | 1 | 2 | 0 | — |
| packages/reconstruction/src/layout.ts:634 | `height` | 1 | 2 | 0 | — |
| packages/reconstruction/src/layout.ts:642 | `stripsOf` | 4 | 2 | 0 | — |
| packages/reconstruction/src/layout.ts:648 | `alignmentTargets` | 21 | 2 | 2 | ?? ×3; writes geometry ×2 |
| packages/reconstruction/src/layout.ts:707 | `matchedLength` | 39 | 1 | 0 | gives up ×2; ?? ×1; skips ×1 |
| packages/reconstruction/src/layout.ts:753 | `outerWallAxes` | 19 | 1 | 0 | — |
| packages/reconstruction/src/layout.ts:774 | `axisMatch` | 5 | 1 | 0 | — |
| packages/reconstruction/src/layout.ts:781 | `largestBuilt` | 2 | 1 | 2 | — |
| packages/reconstruction/src/layout.ts:794 | `alignPlans` | 282 | 2 | 10 | ?? ×5; writes geometry ×9; skips ×9 |
| packages/reconstruction/src/layout.ts:1093 | `storeyIndices` | 12 | 1 | 0 | — |
| packages/reconstruction/src/layout.ts:1106 | `overlap1d` | 1 | 6 | 0 | — |
| packages/reconstruction/src/layout.ts:1117 | `rectOverlapArea` | 5 | 1 | 2 | — |
| packages/reconstruction/src/layout.ts:1123 | `ringBoundsOf` | 5 | 10 | 0 | writes geometry ×8 |
| packages/reconstruction/src/layout.ts:1155 | `axisLadder` | 139 | 2 | 2 | skips ×4; throws ×1 |
| packages/reconstruction/src/layout.ts:1328 | `upperBodiesOf` | 78 | 2 | 5 | gives up ×2; writes geometry ×8; skips ×1 |
| packages/reconstruction/src/layout.ts:1418 | `storeySupportOf` | 114 | 2 | 7 | ?? ×5; writes geometry ×24; skips ×2 |
| packages/reconstruction/src/layout.ts:1537 | `onlySeams` | 13 | 1 | 0 | writes geometry ×8; skips ×1 |
| packages/reconstruction/src/layout.ts:1555 | `wallsBeyond` | 14 | 2 | 5 | writes geometry ×10 |
| packages/reconstruction/src/layout.ts:1575 | `sameSupport` | 11 | 2 | 1 | — |
| packages/reconstruction/src/layout.ts:1588 | `ringOfRect` | 9 | 6 | 2 | ?? ×2; writes geometry ×4 |
| packages/reconstruction/src/layout.ts:1616 | `bayStripsOf` | 77 | 2 | 3 | ?? ×2; writes geometry ×14; skips ×4 |
| packages/reconstruction/src/layout.ts:1695 | `perimeterWallEvidence` | 39 | 4 | 1 | skips ×3 |
| packages/reconstruction/src/layout.ts:1747 | `reachesBeyond` | 3 | 1 | 0 | — |
| packages/reconstruction/src/layout.ts:1751 | `toOuterFaces` | 40 | 2 | 1 | writes geometry ×2 |
| packages/reconstruction/src/layout.ts:1804 | `inferStructuralLayout` | 489 | 4 | 34 | ?? ×14; writes geometry ×1; skips ×11 |
| packages/reconstruction/src/layout.ts:2306 | `chainEvidenceFor` | 22 | 4 | 1 | gives up ×1; skips ×3 |
| packages/reconstruction/src/layout.ts:2330 | `envelopeStrips` | 10 | 2 | 0 | writes geometry ×8 |
| packages/reconstruction/src/layout.ts:2341 | `zoneIdOf` | 1 | 2 | 0 | — |
| packages/reconstruction/src/layout.ts:2342 | `outerFaceSlug` | 1 | 3 | 0 | — |
| packages/reconstruction/src/layout.ts:2364 | `wallStripsOf` | 55 | 1 | 5 | writes geometry ×4; skips ×3 |
| packages/reconstruction/src/layout.ts:2421 | `isWallStripZone` | 4 | 1 | 2 | — |
| packages/reconstruction/src/layout.ts:2427 | `openFacesOf` | 3 | 1 | 2 | — |
| packages/reconstruction/src/layout.ts:2440 | `zonesOutsideEnvelope` | 22 | 1 | 5 | — |
| packages/reconstruction/src/layout.ts:2471 | `assignRoles` | 14 | 2 | 5 | gives up ×1; skips ×1 |
| packages/reconstruction/src/layout.ts:2487 | `touching` | 7 | 1 | 2 | — |
| packages/reconstruction/src/layout.ts:2496 | `contactOf` | 15 | 1 | 3 | gives up ×1 |
| packages/reconstruction/src/layout.ts:2512 | `attachmentsBetween` | 36 | 1 | 4 | skips ×1 |
| packages/reconstruction/src/layout.ts:2556 | `facadesOf` | 55 | 1 | 3 | writes geometry ×2; skips ×3 |
| packages/reconstruction/src/layout.ts:2616 | `pocketRecesses` | 39 | 1 | 6 | writes geometry ×4; skips ×1 |
| packages/reconstruction/src/layout.ts:2665 | `recessesOf` | 73 | 1 | 8 | ?? ×1; writes geometry ×4; skips ×2 |
| packages/reconstruction/src/plan-decomposition.ts:385 | `at` | 1 | 4 | 0 | — |
| packages/reconstruction/src/plan-decomposition.ts:396 | `bandWallThickness` | 3 | 3 | 1 | — |
| packages/reconstruction/src/plan-decomposition.ts:412 | `spansWallToWall` | 19 | 1 | 0 | writes geometry ×4 |
| packages/reconstruction/src/plan-decomposition.ts:441 | `gridLines` | 116 | 2 | 3 | ?? ×3; writes geometry ×2; skips ×5 |
| packages/reconstruction/src/plan-decomposition.ts:567 | `thinLines` | 18 | 2 | 2 | skips ×1 |
| packages/reconstruction/src/plan-decomposition.ts:587 | `wallIntervals` | 31 | 1 | 0 | writes geometry ×2; skips ×3 |
| packages/reconstruction/src/plan-decomposition.ts:620 | `mergeWindows` | 10 | 1 | 0 | — |
| packages/reconstruction/src/plan-decomposition.ts:632 | `unionLength` | 11 | 1 | 0 | — |
| packages/reconstruction/src/plan-decomposition.ts:663 | `lineIntervals` | 29 | 1 | 2 | — |
| packages/reconstruction/src/plan-decomposition.ts:694 | `interiorInk` | 21 | 2 | 3 | writes geometry ×2 |
| packages/reconstruction/src/plan-decomposition.ts:733 | `closureOf` | 45 | 2 | 3 | — |
| packages/reconstruction/src/plan-decomposition.ts:788 | `dimensionedExtent` | 6 | 1 | 2 | gives up ×1; writes geometry ×2 |
| packages/reconstruction/src/plan-decomposition.ts:804 | `dimensionedAxis` | 40 | 5 | 3 | ?? ×1; skips ×3 |
| packages/reconstruction/src/plan-decomposition.ts:852 | `endSpanSupport` | 15 | 2 | 1 | gives up ×2; ?? ×1 |
| packages/reconstruction/src/plan-decomposition.ts:879 | `longBands` | 1 | 4 | 0 | — |
| packages/reconstruction/src/plan-decomposition.ts:882 | `axisBox` | 12 | 3 | 1 | gives up ×1; writes geometry ×2 |
| packages/reconstruction/src/plan-decomposition.ts:965 | `planExtent` | 9 | 2 | 4 | ?? ×1 |
| packages/reconstruction/src/plan-decomposition.ts:979 | `refuteByWalls` | 51 | 2 | 2 | ?? ×1; writes geometry ×3; skips ×2 |
| packages/reconstruction/src/plan-decomposition.ts:1040 | `outspannedByOuterTotal` | 29 | 1 | 3 | ?? ×2; writes geometry ×2; skips ×3 |
| packages/reconstruction/src/plan-decomposition.ts:1070 | `planExtentByWalls` | 73 | 2 | 8 | writes geometry ×5 |
| packages/reconstruction/src/plan-decomposition.ts:1144 | `planExtentOf` | 44 | 2 | 5 | gives up ×1; ?? ×1; writes geometry ×5 |
| packages/reconstruction/src/plan-decomposition.ts:1200 | `cornerJoined` | 18 | 2 | 1 | — |
| packages/reconstruction/src/plan-decomposition.ts:1230 | `walledEnvelope` | 45 | 2 | 5 | gives up ×2; writes geometry ×6 |
| packages/reconstruction/src/plan-decomposition.ts:1305 | `sideWallReach` | 46 | 2 | 2 | writes geometry ×2; skips ×1 |
| packages/reconstruction/src/plan-decomposition.ts:1362 | `infillAcross` | 26 | 3 | 2 | — |
| packages/reconstruction/src/plan-decomposition.ts:1390 | `calloutAt` | 26 | 2 | 1 | skips ×3 |
| packages/reconstruction/src/plan-decomposition.ts:1422 | `alongWallPieces` | 22 | 1 | 0 | writes geometry ×2; skips ×2 |
| packages/reconstruction/src/plan-decomposition.ts:1482 | `collinearWideGaps` | 52 | 1 | 5 | writes geometry ×1; skips ×4 |
| packages/reconstruction/src/plan-decomposition.ts:1536 | `intervalDecision` | 16 | 1 | 1 | writes geometry ×2 |
| packages/reconstruction/src/plan-decomposition.ts:1558 | `facadeCompoundReader` | 27 | 2 | 4 | gives up ×3; ?? ×1 |
| packages/reconstruction/src/plan-decomposition.ts:1587 | `backWallLineOf` | 4 | 3 | 0 | — |
| packages/reconstruction/src/plan-decomposition.ts:1593 | `backWallLines` | 22 | 1 | 2 | skips ×2 |
| packages/reconstruction/src/plan-decomposition.ts:1621 | `structuralEvidence` | 14 | 1 | 1 | skips ×1 |
| packages/reconstruction/src/plan-decomposition.ts:1650 | `baysOf` | 137 | 2 | 5 | gives up ×1; ?? ×1; writes geometry ×13; skips ×5 |
| packages/reconstruction/src/plan-decomposition.ts:1799 | `decomposePlan` | 17 | 1 | 2 | — |
| packages/reconstruction/src/plan-decomposition.ts:1835 | `decomposeCore` | 454 | 2 | 19 | gives up ×2; ?? ×11; writes geometry ×4; skips ×15 |
| packages/reconstruction/src/plan-decomposition.ts:2301 | `mergeRegions` | 70 | 3 | 2 | ?? ×1; writes geometry ×6; skips ×1 |
| packages/reconstruction/src/plan-decomposition.ts:2384 | `stableRegions` | 92 | 2 | 3 | ?? ×4; writes geometry ×12; skips ×2 |
| packages/reconstruction/src/plan-decomposition.ts:2513 | `recutSlivers` | 97 | 2 | 2 | gives up ×2; writes geometry ×6; skips ×6 |
| packages/reconstruction/src/plan-decomposition.ts:2611 | `planBodies` | 129 | 3 | 2 | ?? ×3; writes geometry ×7; skips ×5 |
| packages/reconstruction/src/plan-decomposition.ts:2759 | `wallClusterExtent` | 33 | 5 | 4 | gives up ×2; ?? ×1; writes geometry ×2 |
| packages/reconstruction/src/plan-decomposition.ts:2814 | `walledFirstRegions` | 101 | 2 | 2 | gives up ×1; ?? ×1; writes geometry ×6; skips ×3 |
| packages/reconstruction/src/plan-decomposition.ts:2984 | `policiesDisagree` | 3 | 1 | 0 | — |
| packages/reconstruction/src/plan-decomposition.ts:2991 | `solidOf` | 14 | 2 | 1 | — |
| packages/reconstruction/src/plan-decomposition.ts:3006 | `shadowLine` | 10 | 1 | 1 | — |
| packages/reconstruction/src/plan-decomposition.ts:3017 | `outlineEnvelope` | 31 | 1 | 2 | writes geometry ×10; skips ×1 |
| packages/reconstruction/src/plan-decomposition.ts:3058 | `boundaryExtension` | 340 | 2 | 17 | ?? ×7; skips ×14 |
| packages/reconstruction/src/plan-extent.ts:61 | `wallBands` | 1 | 1 | 0 | — |
| packages/reconstruction/src/plan-extent.ts:67 | `wallWitness` | 70 | 2 | 6 | gives up ×3; ?? ×1; writes geometry ×2; skips ×3 |
| packages/reconstruction/src/plan-extent.ts:146 | `chainRole` | 36 | 1 | 1 | writes geometry ×2; skips ×1 |
| packages/reconstruction/src/plan-extent.ts:184 | `framingChains` | 6 | 1 | 1 | — |
| packages/reconstruction/src/plan-extent.ts:200 | `exteriorSpan` | 15 | 1 | 0 | skips ×3 |
| packages/reconstruction/src/plan-extent.ts:225 | `outerTotalSpans` | 16 | 1 | 0 | skips ×5 |
| packages/reconstruction/src/plan-resolution.ts:192 | `statementsOn` | 20 | 6 | 1 | skips ×3 |
| packages/reconstruction/src/plan-resolution.ts:214 | `agrees` | 2 | 5 | 0 | — |
| packages/reconstruction/src/plan-resolution.ts:218 | `zeroSubstitution` | 1 | 4 | 0 | — |
| packages/reconstruction/src/plan-resolution.ts:228 | `asRead` | 1 | 3 | 1 | — |
| packages/reconstruction/src/plan-resolution.ts:246 | `readingsUnder` | 5 | 1 | 1 | — |
| packages/reconstruction/src/plan-resolution.ts:253 | `fitsUnder` | 5 | 3 | 2 | — |
| packages/reconstruction/src/plan-resolution.ts:260 | `refutedShareAsRead` | 10 | 3 | 3 | skips ×1 |
| packages/reconstruction/src/plan-resolution.ts:283 | `latticeScales` | 27 | 4 | 5 | writes geometry ×1; skips ×1 |
| packages/reconstruction/src/plan-resolution.ts:317 | `metricScales` | 14 | 3 | 2 | — |
| packages/reconstruction/src/plan-resolution.ts:333 | `registrationMeasuredOnBothAxes` | 2 | 2 | 0 | — |
| packages/reconstruction/src/plan-resolution.ts:351 | `metricsAtScale` | 30 | 2 | 4 | skips ×1 |
| packages/reconstruction/src/plan-resolution.ts:383 | `refutedShareAtRegistration` | 3 | 2 | 2 | — |
| packages/reconstruction/src/plan-resolution.ts:392 | `bucketOf` | 6 | 1 | 1 | — |
| packages/reconstruction/src/plan-resolution.ts:402 | `scoreReading` | 79 | 3 | 7 | ?? ×3; writes geometry ×6 |
| packages/reconstruction/src/plan-resolution.ts:488 | `sameBuilding` | 8 | 1 | 0 | — |
| packages/reconstruction/src/plan-resolution.ts:513 | `evidenceTuple` | 4 | 2 | 1 | — |
| packages/reconstruction/src/plan-resolution.ts:519 | `acceptable` | 14 | 2 | 0 | — |
| packages/reconstruction/src/plan-resolution.ts:534 | `describe` | 9 | 3 | 0 | — |
| packages/reconstruction/src/plan-resolution.ts:544 | `summaryOf` | 7 | 4 | 1 | — |
| packages/reconstruction/src/plan-resolution.ts:564 | `resolvePlan` | 249 | 2 | 26 | ?? ×7; writes geometry ×4; skips ×3 |
| packages/reconstruction/src/plan-resolution.ts:814 | `choiceOf` | 3 | 2 | 0 | — |
| packages/reconstruction/src/plan-resolution.ts:819 | `resolutionRecord` | 17 | 1 | 2 | — |
| packages/reconstruction/src/plan-resolution.ts:895 | `sourceConflictReview` | 23 | 2 | 6 | — |
| packages/reconstruction/src/plan-resolution.ts:920 | `doubtedAmong` | 11 | 2 | 0 | skips ×1 |
| packages/reconstruction/src/plan-resolution.ts:933 | `citedAmong` | 11 | 2 | 0 | skips ×1 |
| packages/reconstruction/src/plan-resolution.ts:958 | `setAsideCited` | 18 | 2 | 2 | ?? ×4 |
| packages/reconstruction/src/plan-resolution.ts:978 | `conflictOf` | 7 | 1 | 2 | gives up ×1 |
| packages/reconstruction/src/plan-resolution.ts:994 | `chargesUnder` | 62 | 2 | 10 | ?? ×2; writes geometry ×2; skips ×3 |
| packages/reconstruction/src/plan-resolution.ts:1063 | `sourceConflictReviewFor` | 9 | 1 | 3 | ?? ×2 |
| packages/reconstruction/src/plan-resolution.ts:1074 | `withdrawnRecord` | 17 | 1 | 1 | — |
| packages/reconstruction/src/plan-resolution.ts:1093 | `doubtedText` | 5 | 2 | 0 | — |
| packages/reconstruction/src/plan-resolution.ts:1117 | `framedByItsChains` | 2 | 2 | 0 | — |
| packages/reconstruction/src/plan-resolution.ts:1120 | `firstReadingNeedsChallenge` | 14 | 1 | 2 | — |
| packages/reconstruction/src/plan-resolution.ts:1159 | `challengeFirstReading` | 162 | 2 | 22 | gives up ×1; ?? ×4; writes geometry ×3; skips ×2 |
| packages/reconstruction/src/plan-resolution.ts:1323 | `challengeRecord` | 30 | 1 | 3 | — |
| packages/reconstruction/src/structural-audit.ts:104 | `topOf` | 17 | 2 | 0 | ?? ×3 |
| packages/reconstruction/src/structural-audit.ts:122 | `observationsOf` | 1 | 1 | 0 | — |
| packages/reconstruction/src/structural-audit.ts:125 | `auditStructuralProjection` | 106 | 1 | 8 | ?? ×3; writes geometry ×2; skips ×5 |
| packages/reconstruction/src/structural-audit.ts:232 | `auditOneView` | 60 | 1 | 4 | ?? ×1; writes geometry ×7 |
| packages/reconstruction/src/structural-audit.ts:302 | `compareProfiles` | 95 | 2 | 2 | gives up ×3; skips ×4 |
| packages/reconstruction/src/structural-layout.ts:475 | `groundStoreyOf` | 5 | 3 | 0 | ?? ×2 |
| packages/reconstruction/src/structural-layout.ts:481 | `ringBounds` | 5 | 7 | 0 | writes geometry ×8 |
| packages/reconstruction/src/structural-layout.ts:488 | `ringArea` | 9 | 10 | 0 | — |
| packages/reconstruction/src/structural-layout.ts:499 | `rectangleRing` | 3 | 2 | 0 | writes geometry ×4 |
| packages/reconstruction/src/structural.ts:48 | `quantity` | 9 | 1 | 1 | — |
| packages/reconstruction/src/structural.ts:59 | `composeStructuralLayout` | 125 | 3 | 7 | gives up ×1; ?? ×5; skips ×2 |
| packages/reconstruction/src/v2/building.ts:54 | `rectAt` | 4 | 2 | 0 | writes geometry ×12 |
| packages/reconstruction/src/v2/corner-pockets.ts:26 | `pt` | 1 | 1 | 1 | — |
| packages/reconstruction/src/v2/corner-pockets.ts:29 | `cornerPocketSpecs` | 23 | 1 | 2 | writes geometry ×4 |
| packages/reconstruction/src/v2/corner-recess.ts:60 | `samplerOf` | 9 | 1 | 1 | — |
| packages/reconstruction/src/v2/corner-recess.ts:75 | `depthShare` | 10 | 2 | 0 | — |
| packages/reconstruction/src/v2/corner-recess.ts:87 | `bandShare` | 9 | 1 | 1 | — |
| packages/reconstruction/src/v2/corner-recess.ts:101 | `openStretch` | 21 | 1 | 2 | gives up ×2; skips ×2 |
| packages/reconstruction/src/v2/corner-recess.ts:127 | `readCornerNotch` | 49 | 2 | 5 | gives up ×1; writes geometry ×10 |
| packages/reconstruction/src/v2/emit.ts:62 | `frameWithinWall` | 7 | 1 | 1 | — |
| packages/reconstruction/src/v2/emit.ts:70 | `materialForTone` | 1 | 1 | 0 | — |
| packages/reconstruction/src/v2/emit.ts:72 | `modelStatus` | 18 | 1 | 0 | assumed/unresolved ×3 |
| packages/reconstruction/src/v2/emit.ts:91 | `ringWallId` | 1 | 1 | 0 | — |
| packages/reconstruction/src/v2/emit.ts:95 | `openIndex` | 1 | 1 | 0 | — |
| packages/reconstruction/src/v2/emit.ts:98 | `wallOffset` | 12 | 1 | 1 | writes geometry ×1 |
| packages/reconstruction/src/v2/emit.ts:112 | `pitchedPlaneIds` | 1 | 1 | 0 | — |
| packages/reconstruction/src/v2/emit.ts:114 | `planeRoofPlaneId` | 1 | 1 | 0 | — |
| packages/reconstruction/src/v2/emit.ts:116 | `emitBuilding` | 656 | 2 | 14 | gives up ×1; ?? ×41; CONVENTIONS ×1; assumed/unresolved ×11; writes geometry ×22; skips ×25 |
| packages/reconstruction/src/v2/emit.ts:774 | `insidePolygon` | 12 | 1 | 0 | — |
| packages/reconstruction/src/v2/facade-alignment.ts:105 | `overlap` | 1 | 1 | 0 | — |
| packages/reconstruction/src/v2/facade-alignment.ts:107 | `conventionSource` | 1 | 1 | 0 | assumed/unresolved ×2 |
| packages/reconstruction/src/v2/facade-alignment.ts:112 | `alignFacades` | 119 | 2 | 4 | ?? ×4; assumed/unresolved ×1; writes geometry ×7; skips ×7 |
| packages/reconstruction/src/v2/facade-alignment.ts:233 | `applyOpeningCorrections` | 17 | 1 | 0 | writes geometry ×2 |
| packages/reconstruction/src/v2/frame.ts:53 | `flipZ` | 1 | 1 | 1 | — |
| packages/reconstruction/src/v2/frame.ts:55 | `worldFrameFrom` | 26 | 3 | 4 | gives up ×2; writes geometry ×16 |
| packages/reconstruction/src/v2/frame.ts:98 | `outerFacesAlong` | 13 | 2 | 1 | writes geometry ×2 |
| packages/reconstruction/src/v2/frame.ts:124 | `faceToFaceMetresPerPixel` | 8 | 1 | 0 | — |
| packages/reconstruction/src/v2/frame.ts:134 | `planFrameV2` | 31 | 2 | 4 | gives up ×2 |
| packages/reconstruction/src/v2/frame.ts:243 | `outerWallFaces` | 51 | 4 | 1 | gives up ×1; ?? ×4; writes geometry ×7 |
| packages/reconstruction/src/v2/frame.ts:300 | `planFrameByOuterFaces` | 24 | 2 | 3 | gives up ×2; writes geometry ×4 |
| packages/reconstruction/src/v2/frame.ts:336 | `planFrameBySameSheet` | 25 | 2 | 3 | gives up ×2 |
| packages/reconstruction/src/v2/frame.ts:412 | `registerElevationV2` | 81 | 1 | 1 | gives up ×3; ?? ×1; skips ×1 |
| packages/reconstruction/src/v2/frame.ts:495 | `elevationFrameFromV2` | 26 | 1 | 1 | writes geometry ×3 |
| packages/reconstruction/src/v2/interior.ts:138 | `wallInk` | 5 | 1 | 1 | — |
| packages/reconstruction/src/v2/interior.ts:146 | `medianOf` | 6 | 1 | 0 | — |
| packages/reconstruction/src/v2/interior.ts:169 | `readInterior` | 554 | 2 | 7 | ?? ×3; writes geometry ×28; skips ×18 |
| packages/reconstruction/src/v2/interior.ts:725 | `tracePolygon` | 42 | 2 | 2 | gives up ×1; writes geometry ×2 |
| packages/reconstruction/src/v2/interior.ts:768 | `pointInPolygon` | 9 | 1 | 0 | — |
| packages/reconstruction/src/v2/interior.ts:783 | `coreOfRegion` | 35 | 2 | 1 | skips ×2 |
| packages/reconstruction/src/v2/opening-reading.ts:38 | `matchOpeningCallout` | 37 | 2 | 2 | writes geometry ×1; skips ×4 |
| packages/reconstruction/src/v2/opening-reading.ts:90 | `preferredElevationExtent` | 5 | 1 | 0 | gives up ×1 |
| packages/reconstruction/src/v2/opening-reading.ts:97 | `elevationConfidence` | 1 | 1 | 1 | — |
| packages/reconstruction/src/v2/opening-reading.ts:133 | `resolveSillAndHead` | 54 | 1 | 1 | gives up ×1; ?? ×2; assumed/unresolved ×3; writes geometry ×10 |
| packages/reconstruction/src/v2/opening-reading.ts:258 | `classifyOpeningFamily` | 36 | 1 | 0 | ?? ×1; CONVENTIONS ×1; assumed/unresolved ×1 |
| packages/reconstruction/src/v2/openings-v2.ts:126 | `weakPrintedHeight` | 5 | 1 | 0 | ?? ×1 |
| packages/reconstruction/src/v2/openings-v2.ts:132 | `calloutCandidates` | 10 | 1 | 1 | gives up ×1 |
| packages/reconstruction/src/v2/openings-v2.ts:144 | `calloutPair` | 9 | 1 | 0 | gives up ×2 |
| packages/reconstruction/src/v2/openings-v2.ts:155 | `planGaps` | 63 | 3 | 6 | writes geometry ×8; skips ×1 |
| packages/reconstruction/src/v2/openings-v2.ts:223 | `elevationExtent` | 14 | 4 | 2 | gives up ×2; writes geometry ×5 |
| packages/reconstruction/src/v2/openings-v2.ts:268 | `wallAppearanceExtent` | 98 | 5 | 2 | gives up ×7; writes geometry ×6; skips ×4 |
| packages/reconstruction/src/v2/openings-v2.ts:368 | `gableSoffitY` | 5 | 2 | 1 | — |
| packages/reconstruction/src/v2/openings-v2.ts:415 | `readOpeningOnViews` | 13 | 1 | 4 | writes geometry ×3; skips ×1 |
| packages/reconstruction/src/v2/openings-v2.ts:430 | `rakedHead` | 10 | 1 | 2 | gives up ×2; writes geometry ×4 |
| packages/reconstruction/src/v2/openings-v2.ts:442 | `garageRoomHolds` | 5 | 1 | 0 | writes geometry ×8 |
| packages/reconstruction/src/v2/openings-v2.ts:449 | `readWallOpenings` | 184 | 2 | 18 | gives up ×2; ?? ×4; CONVENTIONS ×3; assumed/unresolved ×7; writes geometry ×27; skips ×5 |
| packages/reconstruction/src/v2/openings-v2.ts:659 | `doorLeafFound` | 90 | 2 | 3 | writes geometry ×2; skips ×6 |
| packages/reconstruction/src/v2/openings-v2.ts:751 | `glazingDrawn` | 22 | 1 | 1 | writes geometry ×2 |
| packages/reconstruction/src/v2/openings-v2.ts:788 | `glazingLinesDrawn` | 24 | 1 | 1 | writes geometry ×2 |
| packages/reconstruction/src/v2/openings-v2.ts:813 | `lumaOf` | 7 | 5 | 0 | — |
| packages/reconstruction/src/v2/openings-v2.ts:822 | `doorSwingDrawn` | 12 | 1 | 1 | writes geometry ×2 |
| packages/reconstruction/src/v2/openings-v2.ts:859 | `overheadDoorTracks` | 54 | 2 | 3 | gives up ×5; writes geometry ×2; skips ×1 |
| packages/reconstruction/src/v2/openings-v2.ts:925 | `garageMouth` | 28 | 1 | 1 | gives up ×1; ?? ×1; writes geometry ×14; skips ×4 |
| packages/reconstruction/src/v2/openings-v2.ts:971 | `openCornerBand` | 8 | 2 | 1 | — |
| packages/reconstruction/src/v2/openings-v2.ts:989 | `cornerAssemblies` | 27 | 1 | 2 | writes geometry ×7; skips ×3 |
| packages/reconstruction/src/v2/openings-v2.ts:1026 | `commonHeadReading` | 5 | 1 | 0 | gives up ×2 |
| packages/reconstruction/src/v2/openings-v2.ts:1040 | `viewGroundRefusals` | 18 | 2 | 1 | skips ×1 |
| packages/reconstruction/src/v2/recesses.ts:76 | `scanZoneForReturns` | 101 | 1 | 3 | ?? ×1; writes geometry ×4; skips ×2 |
| packages/reconstruction/src/v2/reconstruct-v2.ts:239 | `reconstructV2` | 2165 | 2 | 126 | gives up ×6; ?? ×69; CONVENTIONS ×11; assumed/unresolved ×26; writes geometry ×234; skips ×88; throws ×7 |
| packages/reconstruction/src/v2/reconstruct-v2.ts:2406 | `fasciaExtent` | 37 | 1 | 1 | gives up ×2; skips ×1 |
| packages/reconstruction/src/v2/thin-body.ts:79 | `facadeOfFace` | 1 | 1 | 0 | — |
| packages/reconstruction/src/v2/thin-body.ts:94 | `overlap1` | 1 | 1 | 0 | — |
| packages/reconstruction/src/v2/thin-body.ts:97 | `thinBodies` | 11 | 1 | 0 | skips ×2 |
| packages/reconstruction/src/v2/thin-body.ts:110 | `adjudicateThinBody` | 281 | 2 | 4 | ?? ×3; writes geometry ×28; skips ×8 |
| packages/reconstruction/src/v2/wall-reconciliation-report.ts:23 | `planReconcileTolerance` | 4 | 1 | 1 | — |
| packages/reconstruction/src/v2/wall-reconciliation-report.ts:30 | `modeOf` | 5 | 1 | 0 | — |
| packages/reconstruction/src/v2/wall-reconciliation-report.ts:36 | `cm` | 1 | 1 | 0 | — |
| packages/reconstruction/src/v2/wall-reconciliation-report.ts:43 | `reportWallReconciliation` | 13 | 1 | 2 | ?? ×2 |
| packages/reconstruction/src/v2/wall-reconciliation-report.ts:58 | `refusalDiagnostics` | 12 | 2 | 1 | — |
| packages/reconstruction/src/v2/wall-reconciliation.ts:37 | `reconcileToleranceM` | 1 | 1 | 1 | — |
| packages/reconstruction/src/v2/wall-reconciliation.ts:41 | `dot` | 1 | 6 | 0 | — |
| packages/reconstruction/src/v2/wall-reconciliation.ts:42 | `sub` | 1 | 3 | 0 | — |
| packages/reconstruction/src/v2/wall-reconciliation.ts:43 | `at` | 1 | 5 | 0 | — |
| packages/reconstruction/src/v2/wall-reconciliation.ts:44 | `r6` | 1 | 3 | 1 | — |
| packages/reconstruction/src/v2/wall-reconciliation.ts:47 | `frameOf` | 6 | 9 | 1 | — |
| packages/reconstruction/src/v2/wall-reconciliation.ts:55 | `depthInto` | 1 | 3 | 2 | — |
| packages/reconstruction/src/v2/wall-reconciliation.ts:57 | `alongOf` | 1 | 3 | 2 | — |
| packages/reconstruction/src/v2/wall-reconciliation.ts:86 | `fmt` | 1 | 4 | 0 | — |
| packages/reconstruction/src/v2/wall-reconciliation.ts:89 | `parallelConflict` | 20 | 1 | 6 | — |
| packages/reconstruction/src/v2/wall-reconciliation.ts:114 | `faceInterval` | 8 | 1 | 3 | — |
| packages/reconstruction/src/v2/wall-reconciliation.ts:124 | `angledConflict` | 19 | 2 | 4 | — |
| packages/reconstruction/src/v2/wall-reconciliation.ts:145 | `hostEndConflict` | 15 | 1 | 6 | gives up ×1 |
| packages/reconstruction/src/v2/wall-reconciliation.ts:162 | `classifyWallConflict` | 9 | 2 | 4 | ?? ×1 |
| packages/reconstruction/src/v2/wall-reconciliation.ts:179 | `trimWallEnd` | 4 | 1 | 3 | — |
| packages/reconstruction/src/v2/wall-reconciliation.ts:185 | `shiftWall` | 3 | 1 | 2 | — |
| packages/reconstruction/src/v2/wall-reconciliation.ts:189 | `length` | 1 | 1 | 0 | — |
| packages/reconstruction/src/v2/wall-reconciliation.ts:196 | `proposeWallRepair` | 27 | 1 | 7 | ?? ×1 |
| packages/reconstruction/src/v2/wall-reconciliation.ts:225 | `refuseOrOmit` | 5 | 1 | 0 | — |
| packages/reconstruction/src/v2/wall-reconciliation.ts:232 | `ringWallLines` | 21 | 3 | 0 | ?? ×3 |
| packages/reconstruction/src/v2/wall-reconciliation.ts:258 | `moveRingEdge` | 7 | 2 | 3 | — |
| packages/reconstruction/src/v2/wall-reconciliation.ts:267 | `startShiftAlong` | 3 | 2 | 3 | — |
| packages/reconstruction/src/v2/wall-reconciliation.ts:279 | `wallLineOf` | 1 | 2 | 0 | ?? ×2 |
| packages/reconstruction/src/v2/wall-reconciliation.ts:286 | `openRingWithout` | 32 | 2 | 2 | ?? ×16 |
| packages/reconstruction/src/v2/wall-reconciliation.ts:337 | `withoutOmitted` | 25 | 2 | 1 | skips ×1 |
| packages/reconstruction/src/v2/wall-reconciliation.ts:367 | `rewriteReferences` | 33 | 2 | 3 | gives up ×2; ?? ×3 |
| packages/reconstruction/src/v2/wall-reconciliation.ts:402 | `createdIdOf` | 1 | 5 | 0 | — |
| packages/reconstruction/src/v2/wall-reconciliation.ts:408 | `retargetOpening` | 12 | 1 | 5 | gives up ×1 |
| packages/reconstruction/src/v2/wall-topology.ts:86 | `rectOfRun` | 1 | 1 | 0 | writes geometry ×8 |
| packages/reconstruction/src/v2/wall-topology.ts:87 | `rectOfHost` | 1 | 1 | 0 | writes geometry ×8 |
| packages/reconstruction/src/v2/wall-topology.ts:88 | `overlapArea` | 1 | 1 | 0 | — |
| packages/reconstruction/src/v2/wall-topology.ts:92 | `acrossOf` | 1 | 1 | 0 | — |
| packages/reconstruction/src/v2/wall-topology.ts:95 | `coversAt` | 1 | 1 | 0 | — |
| packages/reconstruction/src/v2/wall-topology.ts:97 | `length` | 1 | 1 | 0 | — |
| packages/reconstruction/src/v2/wall-topology.ts:99 | `byId` | 1 | 1 | 0 | — |
| packages/reconstruction/src/v2/wall-topology.ts:101 | `planWallTopology` | 259 | 2 | 9 | gives up ×2; assumed/unresolved ×1; skips ×15 |
| packages/reconstruction/src/views.ts:66 | `silhouettePolygon` | 8 | 1 | 0 | gives up ×1 |
| packages/reconstruction/src/views.ts:76 | `silhouetteExtent` | 26 | 2 | 2 | gives up ×2; writes geometry ×2 |
| packages/reconstruction/src/views.ts:138 | `buildingExtent` | 18 | 2 | 2 | gives up ×1 |
| packages/reconstruction/src/views.ts:182 | `registerElevations` | 50 | 2 | 3 | gives up ×1; ?? ×1; writes geometry ×1; skips ×1 |
| packages/reconstruction/src/views.ts:233 | `labelled` | 1 | 1 | 0 | — |
| packages/reconstruction/src/views.ts:243 | `chooseSide` | 24 | 1 | 1 | writes geometry ×1 |

## Supporting functions (short classification)

| file:line | function | class |
|---|---|---|
| packages/analysis-service/src/checkpoint.ts:123 | `abortError` | helper |
| packages/analysis-service/src/checkpoint.ts:129 | `createCheckpoint` | fallback-bearing |
| packages/analysis-service/src/checkpoint.ts:261 | `phase` | fallback-bearing |
| packages/analysis-service/src/checkpoint.ts:283 | `tick` | fallback-bearing |
| packages/analysis-service/src/checkpoint.ts:296 | `idle` | helper |
| packages/analysis-service/src/checkpoint.ts:300 | `end` | helper |
| packages/analysis-service/src/checkpoint.ts:303 | `stats` | helper |
| packages/analysis-service/src/diagnostics.ts:58 | `units` | helper |
| packages/analysis-service/src/diagnostics.ts:68 | `fileOf` | fallback-bearing |
| packages/analysis-service/src/diagnostics.ts:77 | `lostPlanAddresses` | fallback-bearing |
| packages/analysis-service/src/diagnostics.ts:94 | `sourceSummaryOf` | fallback-bearing |
| packages/analysis-service/src/diagnostics.ts:113 | `encodePng` | helper |
| packages/analysis-service/src/diagnostics.ts:120 | `planOverlayPng` | fallback-bearing |
| packages/analysis-service/src/diagnostics.ts:126 | `diagnosticsBundle` | fallback-bearing |
| packages/analysis-service/src/errors.ts:87 | `failure` | helper |
| packages/analysis-service/src/errors.ts:114 | `recogniserFailureKind` | fallback-bearing |
| packages/analysis-service/src/errors.ts:157 | `reconstructionError` | helper |
| packages/analysis-service/src/errors.ts:169 | `toAnalysisError` | fallback-bearing |
| packages/analysis-service/src/errors.ts:222 | `classificationDiagnostics` | helper |
| packages/analysis-service/src/errors.ts:241 | `throwIfAborted` | helper |
| packages/analysis-service/src/identity.ts:25 | `safeSlug` | helper |
| packages/analysis-service/src/identity.ts:34 | `identityOf` | fallback-bearing |
| packages/analysis-service/src/identity.ts:60 | `validateAnalysisUrl` | helper |
| packages/analysis-service/src/preview.ts:73 | `sourceBasisOf` | fallback-bearing |
| packages/analysis-service/src/preview.ts:104 | `previewOf` | fallback-bearing |
| packages/analysis-service/src/signals.ts:13 | `anySignal` | helper |
| packages/analysis-service/src/stages.ts:69 | `progressAt` | helper |
| packages/analysis-service/src/stages.ts:96 | `progressEvent` | helper |
| packages/analysis-service/src/trace.ts:63 | `since` | helper |
| packages/analysis-service/src/trace.ts:71 | `record` | helper |
| packages/analysis-service/src/trace.ts:80 | `hasFailure` | helper |
| packages/analysis-service/src/trace.ts:84 | `finish` | helper |
| packages/analysis-service/src/warnings.ts:52 | `definitelyAbsent` | helper |
| packages/analysis-service/src/warnings.ts:80 | `plural` | helper |
| packages/analysis-service/src/warnings.ts:81 | `words` | helper |
| packages/analysis-service/src/warnings.ts:84 | `warningsOf` | fallback-bearing |
| packages/analysis-service/src/warnings.ts:141 | `wallReconciliationWarnings` | helper |
| packages/geometry/src/architecture-compiler.ts:42 | `v3` | helper |
| packages/geometry/src/architecture-compiler.ts:62 | `compileRoofPlane` | fallback-bearing |
| packages/geometry/src/architecture-compiler.ts:98 | `planeSurface` | helper |
| packages/geometry/src/architecture-compiler.ts:112 | `surfaceBreaksAlong` | helper |
| packages/geometry/src/architecture-compiler.ts:134 | `wallTopUnderPlanes` | helper |
| packages/geometry/src/architecture-compiler.ts:173 | `profileAt` | helper |
| packages/geometry/src/architecture-compiler.ts:184 | `compileWallPanel` | helper |
| packages/geometry/src/architecture-compiler.ts:219 | `compilePlatform` | fallback-bearing |
| packages/geometry/src/architecture-compiler.ts:242 | `signed` | helper |
| packages/geometry/src/architecture-compiler.ts:261 | `compileStepRun` | fallback-bearing |
| packages/geometry/src/architecture-compiler.ts:318 | `compileUnknownAssembly` | helper |
| packages/geometry/src/architecture-compiler.ts:364 | `cross3` | helper |
| packages/geometry/src/architecture-compiler.ts:365 | `normalize3` | helper |
| packages/geometry/src/closure.ts:199 | `boundsOf` | helper |
| packages/geometry/src/closure.ts:215 | `overlap1` | helper |
| packages/geometry/src/closure.ts:217 | `normalOf` | helper |
| packages/geometry/src/closure.ts:227 | `dot` | helper |
| packages/geometry/src/closure.ts:232 | `planeOf` | fallback-bearing |
| packages/geometry/src/closure.ts:246 | `chart` | helper |
| packages/geometry/src/closure.ts:255 | `polyArea` | helper |
| packages/geometry/src/closure.ts:266 | `clipPolygon` | helper |
| packages/geometry/src/closure.ts:302 | `signedArea` | helper |
| packages/geometry/src/closure.ts:320 | `coplanarSameFacingPieces` | fallback-bearing |
| packages/geometry/src/closure.ts:370 | `rayHitsTriangle` | fallback-bearing |
| packages/geometry/src/closure.ts:387 | `containsPoint` | helper |
| packages/geometry/src/closure.ts:396 | `sharedVolume` | geometry/metric |
| packages/geometry/src/closure.ts:424 | `manifoldDefects` | fallback-bearing |
| packages/geometry/src/closure.ts:440 | `sliverCount` | helper |
| packages/geometry/src/closure.ts:461 | `solidsOf` | fallback-bearing |
| packages/geometry/src/closure.ts:485 | `semanticsOf` | fallback-bearing |
| packages/geometry/src/closure.ts:520 | `relationOf` | fallback-bearing |
| packages/geometry/src/closure.ts:620 | `geometryClosureAudit` | fallback-bearing |
| packages/geometry/src/closure.ts:847 | `bearingAllowance` | fallback-bearing |
| packages/geometry/src/closure.ts:860 | `solidScope` | helper |
| packages/geometry/src/closure.ts:871 | `scopeOf` | helper |
| packages/geometry/src/closure.ts:888 | `sub` | helper |
| packages/geometry/src/closure.ts:891 | `pointTriangleDistance` | helper |
| packages/geometry/src/closure.ts:930 | `segmentDistance` | helper |
| packages/geometry/src/closure.ts:964 | `edgeDistance` | helper |
| packages/geometry/src/closure.ts:973 | `meshDistance` | helper |
| packages/geometry/src/closure.ts:979 | `severityRank` | helper |
| packages/geometry/src/closure.ts:980 | `round4` | helper |
| packages/geometry/src/compile.ts:41 | `byId` | helper |
| packages/geometry/src/compile.ts:56 | `wallTopFunction` | helper |
| packages/geometry/src/compile.ts:148 | `compileBuilding` | fallback-bearing |
| packages/geometry/src/compile.ts:514 | `planeAsRoofGeometry` | helper |
| packages/geometry/src/features.ts:18 | `compileSlab` | helper |
| packages/geometry/src/features.ts:28 | `compileBalcony` | helper |
| packages/geometry/src/features.ts:35 | `compileChimney` | helper |
| packages/geometry/src/features.ts:43 | `compileRoomFloor` | helper |
| packages/geometry/src/features.ts:48 | `compileStairPlaceholder` | helper |
| packages/geometry/src/features.ts:67 | `compileRailing` | helper |
| packages/geometry/src/features.ts:139 | `compileTerrace` | helper |
| packages/geometry/src/fills.ts:23 | `localBox` | helper |
| packages/geometry/src/fills.ts:36 | `localRing` | helper |
| packages/geometry/src/fills.ts:63 | `extrudeLocalPolygon` | fallback-bearing |
| packages/geometry/src/fills.ts:93 | `localRingPolygon` | helper |
| packages/geometry/src/fills.ts:118 | `affineRing` | helper |
| packages/geometry/src/fills.ts:151 | `compileWindowFill` | helper |
| packages/geometry/src/fills.ts:262 | `compileDoorFill` | fallback-bearing |
| packages/geometry/src/linear-solids.ts:22 | `scale` | helper |
| packages/geometry/src/linear-solids.ts:23 | `add` | helper |
| packages/geometry/src/linear-solids.ts:30 | `compileLinearSolid` | helper |
| packages/geometry/src/primitives.ts:14 | `same` | helper |
| packages/geometry/src/primitives.ts:17 | `triOut` | fallback-bearing |
| packages/geometry/src/primitives.ts:31 | `quadOut` | helper |
| packages/geometry/src/primitives.ts:43 | `worldBox` | helper |
| packages/geometry/src/primitives.ts:58 | `frameBox` | helper |
| packages/geometry/src/primitives.ts:84 | `triangulatePolygon` | fallback-bearing |
| packages/geometry/src/primitives.ts:129 | `extrudePolygon` | helper |
| packages/geometry/src/region.ts:33 | `signedArea` | helper |
| packages/geometry/src/region.ts:42 | `key` | helper |
| packages/geometry/src/region.ts:45 | `uAt` | helper |
| packages/geometry/src/region.ts:51 | `tessellateRegion` | fallback-bearing |
| packages/geometry/src/region.ts:158 | `extrudePlanRegion` | helper |
| packages/geometry/src/region.ts:183 | `extrudeLocalRegion` | helper |
| packages/geometry/src/roof-compiler.ts:75 | `roofGeometry` | helper |
| packages/geometry/src/roof-compiler.ts:173 | `uniqueSorted` | helper |
| packages/geometry/src/roof-compiler.ts:191 | `tilePlate` | fallback-bearing |
| packages/geometry/src/roof-compiler.ts:283 | `compileRoofTriangles` | helper |
| packages/geometry/src/roof-compiler.ts:372 | `compileRoofTrims` | helper |
| packages/geometry/src/roof-compiler.ts:435 | `roofBreaksAlong` | helper |
| packages/geometry/src/roof-compiler.ts:460 | `rectCorners` | helper |
| packages/geometry/src/roof-compiler.ts:468 | `prismBetweenPlanes` | helper |
| packages/geometry/src/roof-compiler.ts:485 | `ringBetweenPlanes` | helper |
| packages/geometry/src/roof-compiler.ts:510 | `compileRooflightFill` | helper |
| packages/geometry/src/roof-compiler.ts:538 | `vergeEnds` | helper |
| packages/geometry/src/stair-compiler.ts:42 | `round9` | helper |
| packages/geometry/src/stair-compiler.ts:43 | `R` | helper |
| packages/geometry/src/stair-compiler.ts:44 | `keyOf` | helper |
| packages/geometry/src/stair-compiler.ts:45 | `samePt` | helper |
| packages/geometry/src/stair-compiler.ts:48 | `clean` | helper |
| packages/geometry/src/stair-compiler.ts:56 | `onOpenSegment` | helper |
| packages/geometry/src/stair-compiler.ts:68 | `insertPoints` | helper |
| packages/geometry/src/stair-compiler.ts:88 | `splitStrip` | fallback-bearing |
| packages/geometry/src/stair-compiler.ts:113 | `compileStair` | fallback-bearing |
| packages/geometry/src/surface-regions.ts:31 | `clipToRect` | helper |
| packages/geometry/src/surface-regions.ts:60 | `area` | helper |
| packages/geometry/src/surface-regions.ts:70 | `compileSurfaceRegion` | helper |
| packages/geometry/src/types.ts:120 | `v3` | helper |
| packages/geometry/src/types.ts:121 | `sub` | helper |
| packages/geometry/src/types.ts:122 | `add` | helper |
| packages/geometry/src/types.ts:123 | `scale` | helper |
| packages/geometry/src/types.ts:124 | `dot` | helper |
| packages/geometry/src/types.ts:125 | `cross` | helper |
| packages/geometry/src/types.ts:135 | `boundsOfTriangles` | fallback-bearing |
| packages/geometry/src/wall-compiler.ts:92 | `uniqueSorted` | helper |
| packages/geometry/src/wall-compiler.ts:103 | `compileWall` | fallback-bearing |
| packages/image-metrology/src/bounds.ts:144 | `grayOf` | helper |
| packages/image-metrology/src/bounds.ts:154 | `peel` | helper |
| packages/image-metrology/src/bounds.ts:179 | `gradientThreshold` | helper |
| packages/image-metrology/src/bounds.ts:217 | `longestRuns` | helper |
| packages/image-metrology/src/bounds.ts:256 | `verticalEdges` | helper |
| packages/image-metrology/src/bounds.ts:263 | `horizontalEdges` | helper |
| packages/image-metrology/src/bounds.ts:270 | `architecturalBounds` | geometry/metric |
| packages/image-metrology/src/bounds.ts:365 | `refineEdge` | fallback-bearing |
| packages/image-metrology/src/camera.ts:65 | `project` | fallback-bearing |
| packages/image-metrology/src/camera.ts:78 | `planarity` | helper |
| packages/image-metrology/src/camera.ts:102 | `rq3` | helper |
| packages/image-metrology/src/camera.ts:132 | `transpose3` | helper |
| packages/image-metrology/src/camera.ts:141 | `solveCamera` | fallback-bearing |
| packages/image-metrology/src/linalg.ts:12 | `solveLinear` | fallback-bearing |
| packages/image-metrology/src/linalg.ts:43 | `leastSquares` | fallback-bearing |
| packages/image-metrology/src/linalg.ts:70 | `smallestSingularVector` | fallback-bearing |
| packages/image-metrology/src/linalg.ts:98 | `normalise` | helper |
| packages/image-metrology/src/linalg.ts:104 | `median` | helper |
| packages/image-metrology/src/linalg.ts:125 | `robustSigma` | helper |
| packages/image-metrology/src/opening.ts:110 | `otsu` | helper |
| packages/image-metrology/src/opening.ts:137 | `grayOf` | helper |
| packages/image-metrology/src/opening.ts:146 | `verticalOpeningExtent` | fallback-bearing |
| packages/model/src/assembly.ts:20 | `many` | fallback-bearing |
| packages/model/src/assembly.ts:21 | `one` | helper |
| packages/model/src/assembly.ts:24 | `assemblyReferences` | helper |
| packages/model/src/assembly.ts:62 | `assemblyComponents` | helper |
| packages/model/src/assembly.ts:65 | `assembliesContaining` | helper |
| packages/model/src/assembly.ts:75 | `withoutReferences` | helper |
| packages/model/src/dormer.ts:79 | `layoutDormer` | helper |
| packages/model/src/dormer.ts:213 | `fixEnd` | helper |
| packages/model/src/geometry-types.ts:29 | `rectWidth` | helper |
| packages/model/src/geometry-types.ts:30 | `rectDepth` | helper |
| packages/model/src/geometry-types.ts:31 | `rectIsValid` | helper |
| packages/model/src/geometry-types.ts:34 | `polygonSignedArea` | helper |
| packages/model/src/geometry-types.ts:44 | `polygonArea` | helper |
| packages/model/src/geometry-types.ts:46 | `rectToPolygon` | helper |
| packages/model/src/geometry-types.ts:57 | `polygonIsSimple` | helper |
| packages/model/src/geometry-types.ts:75 | `orient` | helper |
| packages/model/src/geometry-types.ts:79 | `segmentsCross` | helper |
| packages/model/src/ids.ts:46 | `nextId` | helper |
| packages/model/src/issues.ts:110 | `fmtNumber` | helper |
| packages/model/src/linear-solid.ts:29 | `sub` | helper |
| packages/model/src/linear-solid.ts:30 | `cross` | helper |
| packages/model/src/linear-solid.ts:31 | `length` | helper |
| packages/model/src/linear-solid.ts:33 | `normalize` | helper |
| packages/model/src/linear-solid.ts:38 | `scale` | helper |
| packages/model/src/linear-solid.ts:39 | `add` | helper |
| packages/model/src/linear-solid.ts:53 | `linearSolidIsDegenerate` | helper |
| packages/model/src/linear-solid.ts:55 | `linearSolidBasis` | fallback-bearing |
| packages/model/src/linear-solid.ts:85 | `linearSolidArrisSpans` | fallback-bearing |
| packages/model/src/linear-solid.ts:123 | `linearSolidCutIssue` | fallback-bearing |
| packages/model/src/linear-solid.ts:143 | `linearSolidCorners` | helper |
| packages/model/src/migrate.ts:140 | `migrateModelInput` | helper |
| packages/model/src/open-end.ts:30 | `isLevel` | helper |
| packages/model/src/open-end.ts:33 | `openEndJoin` | fallback-bearing |
| packages/model/src/open-end.ts:70 | `openEndSpan` | helper |
| packages/model/src/query.ts:29 | `findObject` | fallback-bearing |
| packages/model/src/query.ts:41 | `kindOfCollection` | helper |
| packages/model/src/query.ts:48 | `hasObject` | helper |
| packages/model/src/query.ts:50 | `allObjectIds` | helper |
| packages/model/src/query.ts:80 | `openingHeadAt` | helper |
| packages/model/src/query.ts:87 | `openingHeadRange` | helper |
| packages/model/src/query.ts:93 | `openingIsRaked` | helper |
| packages/model/src/query.ts:96 | `openingLeaves` | fallback-bearing |
| packages/model/src/query.ts:99 | `roofCoveredRect` | helper |
| packages/model/src/query.ts:107 | `roofCreaseLine` | fallback-bearing |
| packages/model/src/query.ts:174 | `wallLength` | helper |
| packages/model/src/query.ts:181 | `wallFrame` | helper |
| packages/model/src/query.ts:194 | `wallPoint` | helper |
| packages/model/src/query.ts:203 | `wallPlanPoint` | helper |
| packages/model/src/roof-cut.ts:16 | `roofCutMode` | fallback-bearing |
| packages/model/src/roof-cut.ts:19 | `roofOpeningUndersideShift` | helper |
| packages/model/src/roof-cut.ts:30 | `roofOpeningUndersideRect` | helper |
| packages/model/src/roof-plane.ts:25 | `roofPlaneSlope` | helper |
| packages/model/src/roof-plane.ts:28 | `roofPlaneTopAt` | helper |
| packages/model/src/roof-plane.ts:34 | `roofPlaneDrop` | helper |
| packages/model/src/roof-plane.ts:52 | `polygonEdges` | helper |
| packages/model/src/roof-plane.ts:55 | `pointSegmentDistance` | helper |
| packages/model/src/roof-plane.ts:64 | `pointOnPolygonBoundary` | helper |
| packages/model/src/roof-plane.ts:70 | `collinearOverlap` | fallback-bearing |
| packages/model/src/roof-plane.ts:85 | `segmentOnBoundaries` | helper |
| packages/model/src/roof-plane.ts:108 | `sharedBoundarySegments` | helper |
| packages/model/src/roof-plane.ts:144 | `touchesCollinear` | helper |
| packages/model/src/roof-plane.ts:154 | `hull` | helper |
| packages/model/src/roof-plane.ts:167 | `roofOpeningOutline` | fallback-bearing |
| packages/model/src/roof-plane.ts:170 | `polygonBounds` | helper |
| packages/model/src/roof-plane.ts:184 | `roofOpeningsOfPlane` | helper |
| packages/model/src/roof-plane.ts:187 | `roofPlaneBoundaries` | helper |
| packages/model/src/roof-plane.ts:200 | `roofJoinShape` | helper |
| packages/model/src/roof-plane.ts:226 | `pointInPolygonStrict` | helper |
| packages/model/src/roof-plane.ts:237 | `vec2Length` | helper |
| packages/model/src/schema.ts:1387 | `createEmptyModel` | helper |
| packages/model/src/serialize.ts:13 | `byId` | helper |
| packages/model/src/serialize.ts:16 | `canonicalizeModel` | helper |
| packages/model/src/serialize.ts:24 | `sortKeysDeep` | helper |
| packages/model/src/serialize.ts:39 | `serializeModel` | helper |
| packages/model/src/serialize.ts:67 | `describe` | helper |
| packages/model/src/stair-layout.ts:55 | `stairDirectionVector` | helper |
| packages/model/src/stair-layout.ts:59 | `leftOf` | helper |
| packages/model/src/stair-layout.ts:60 | `rightOf` | helper |
| packages/model/src/stair-layout.ts:62 | `add` | helper |
| packages/model/src/stair-layout.ts:64 | `round` | helper |
| packages/model/src/stair-layout.ts:68 | `R` | helper |
| packages/model/src/stair-layout.ts:70 | `layoutStair` | fallback-bearing |
| packages/reconstruction/src/compound-facade.ts:148 | `runsPast` | helper |
| packages/reconstruction/src/compound-facade.ts:187 | `lineOptions` | helper |
| packages/reconstruction/src/compound-facade.ts:190 | `across` | helper |
| packages/reconstruction/src/compound-facade.ts:196 | `returnRun` | fallback-bearing |
| packages/reconstruction/src/compound-facade.ts:211 | `inwardOf` | helper |
| packages/reconstruction/src/compound-facade.ts:213 | `separatorOf` | helper |
| packages/reconstruction/src/compound-facade.ts:251 | `backWallOf` | fallback-bearing |
| packages/reconstruction/src/compound-facade.ts:297 | `drawnAcross` | helper |
| packages/reconstruction/src/compound-facade.ts:319 | `coverOf` | helper |
| packages/reconstruction/src/compound-facade.ts:339 | `calloutsOf` | helper |
| packages/reconstruction/src/compound-facade.ts:362 | `compoundSpanOf` | geometry/metric |
| packages/reconstruction/src/failure.ts:143 | `isReconstructionFailure` | helper |
| packages/reconstruction/src/failure.ts:284 | `planCounts` | fallback-bearing |
| packages/reconstruction/src/gap-evidence.ts:75 | `decompositionIdOf` | helper |
| packages/reconstruction/src/gap-evidence.ts:80 | `gapCrop` | geometry/metric |
| packages/reconstruction/src/gap-evidence.ts:92 | `inkCropHash` | helper |
| packages/reconstruction/src/gap-evidence.ts:111 | `gapEvidenceRecords` | geometry/metric |
| packages/reconstruction/src/plan-diagnostics.ts:23 | `rect` | geometry/metric |
| packages/reconstruction/src/plan-diagnostics.ts:26 | `planDiagnosticsOf` | geometry/metric |
| packages/reconstruction/src/plan-diagnostics.ts:95 | `compoundFacadesOf` | fallback-bearing |
| packages/reconstruction/src/plan-diagnostics.ts:103 | `compoundOf` | geometry/metric |
| packages/reconstruction/src/plan-diagnostics.ts:151 | `boundaryOf` | helper |
| packages/reconstruction/src/plan-diagnostics.ts:187 | `dimensionEvidenceOf` | fallback-bearing |
| packages/reconstruction/src/plan-diagnostics.ts:197 | `metricOf` | helper |
| packages/reconstruction/src/plan-diagnostics.ts:219 | `planFailureOf` | fallback-bearing |
| packages/reconstruction/src/plan-diagnostics.ts:267 | `layoutRefused` | helper |
| packages/reconstruction/src/plan-diagnostics.ts:270 | `layoutRejectionOf` | helper |
| packages/reconstruction/src/plan-overlay.ts:31 | `renderPlanOverlay` | geometry/metric |
| packages/reconstruction/src/roof-systems.ts:60 | `quantity` | helper |
| packages/reconstruction/src/roof-systems.ts:78 | `statedPitch` | helper |
| packages/reconstruction/src/roof-systems.ts:104 | `rankOfAuthority` | helper |
| packages/reconstruction/src/roof-systems.ts:107 | `statedKind` | fallback-bearing |
| packages/reconstruction/src/roof-systems.ts:124 | `ridgeAxisFromRise` | geometry/metric |
| packages/reconstruction/src/roof-systems.ts:152 | `inferRoofSystems` | geometry/metric |
| packages/reconstruction/src/solve.ts:252 | `levelsFrom` | helper |
| packages/reconstruction/src/solve.ts:302 | `registerElevationFrames` | helper |
| packages/reconstruction/src/statement-contest.ts:51 | `dimensionOf` | helper |
| packages/reconstruction/src/statement-contest.ts:52 | `keyOf` | geometry/metric |
| packages/reconstruction/src/statement-contest.ts:58 | `latticeKey` | helper |
| packages/reconstruction/src/statement-contest.ts:61 | `latticeValue` | fallback-bearing |
| packages/reconstruction/src/statement-contest.ts:67 | `externalValue` | fallback-bearing |
| packages/reconstruction/src/statement-contest.ts:77 | `statementContests` | fallback-bearing |
| packages/reconstruction/src/v2/assembly-closure.ts:48 | `alongIsX` | helper |
| packages/reconstruction/src/v2/assembly-closure.ts:66 | `snapReturnsToBodyFaces` | geometry/metric |
| packages/reconstruction/src/v2/assembly-closure.ts:96 | `alignStackedReturns` | helper |
| packages/reconstruction/src/v2/assembly-closure.ts:131 | `closeTerraces` | helper |
| packages/reconstruction/src/v2/assembly-closure.ts:172 | `drawnLineAcrossZone` | helper |
| packages/reconstruction/src/v2/assembly-closure.ts:239 | `bandContinues` | fallback-bearing |
| packages/reconstruction/src/v2/assembly-closure.ts:267 | `closeBalconies` | geometry/metric |
| packages/reconstruction/src/v2/assembly-closure.ts:377 | `railingPath` | helper |
| packages/reconstruction/src/v2/assembly-closure.ts:397 | `closeRailings` | helper |
| packages/reconstruction/src/v2/assembly-closure.ts:417 | `closeVerges` | helper |
| packages/reconstruction/src/v2/assembly-closure.ts:431 | `closePortalHeads` | helper |
| packages/reconstruction/src/v2/assembly-closure.ts:449 | `buildFacadeGraph` | geometry/metric |
| packages/reconstruction/src/v2/attached-roof-form.ts:96 | `isGreen` | helper |
| packages/reconstruction/src/v2/attached-roof-form.ts:99 | `readBodyTop` | fallback-bearing |
| packages/reconstruction/src/v2/attached-roof-form.ts:192 | `readAttachedRoofForm` | geometry/metric |
| packages/reconstruction/src/v2/attached-roof-form.ts:267 | `attachedGableLayout` | helper |
| packages/reconstruction/src/v2/camera.ts:102 | `sub` | helper |
| packages/reconstruction/src/v2/camera.ts:103 | `cross` | helper |
| packages/reconstruction/src/v2/camera.ts:104 | `dot` | helper |
| packages/reconstruction/src/v2/camera.ts:105 | `normalize` | helper |
| packages/reconstruction/src/v2/camera.ts:109 | `dist2` | helper |
| packages/reconstruction/src/v2/camera.ts:112 | `through` | fallback-bearing |
| packages/reconstruction/src/v2/camera.ts:123 | `lookAtProjection` | helper |
| packages/reconstruction/src/v2/camera.ts:132 | `fitLine` | fallback-bearing |
| packages/reconstruction/src/v2/camera.ts:155 | `lineThrough` | helper |
| packages/reconstruction/src/v2/camera.ts:160 | `lineAngleDeg` | helper |
| packages/reconstruction/src/v2/camera.ts:165 | `intersectLines` | fallback-bearing |
| packages/reconstruction/src/v2/camera.ts:174 | `perpendicular` | helper |
| packages/reconstruction/src/v2/camera.ts:185 | `convexHull` | helper |
| packages/reconstruction/src/v2/camera.ts:206 | `simplifyClosed` | helper |
| packages/reconstruction/src/v2/camera.ts:225 | `fillPolygon` | fallback-bearing |
| packages/reconstruction/src/v2/camera.ts:261 | `bodyOf` | geometry/metric |
| packages/reconstruction/src/v2/camera.ts:270 | `modelOf` | fallback-bearing |
| packages/reconstruction/src/v2/camera.ts:333 | `hullHypotheses` | helper |
| packages/reconstruction/src/v2/camera.ts:370 | `luma` | helper |
| packages/reconstruction/src/v2/camera.ts:378 | `skyMask` | helper |
| packages/reconstruction/src/v2/camera.ts:426 | `largestComponent` | geometry/metric |
| packages/reconstruction/src/v2/camera.ts:479 | `chainEdgeLine` | fallback-bearing |
| packages/reconstruction/src/v2/camera.ts:491 | `chainKinks` | helper |
| packages/reconstruction/src/v2/camera.ts:508 | `detectSilhouette` | fallback-bearing |
| packages/reconstruction/src/v2/camera.ts:602 | `unitBox` | geometry/metric |
| packages/reconstruction/src/v2/camera.ts:618 | `alignHulls` | helper |
| packages/reconstruction/src/v2/camera.ts:684 | `correspondences` | helper |
| packages/reconstruction/src/v2/camera.ts:687 | `errorsById` | fallback-bearing |
| packages/reconstruction/src/v2/camera.ts:694 | `depthSign` | helper |
| packages/reconstruction/src/v2/camera.ts:700 | `predictedMask` | helper |
| packages/reconstruction/src/v2/camera.ts:718 | `maskIoU` | helper |
| packages/reconstruction/src/v2/camera.ts:735 | `onBoundary` | helper |
| packages/reconstruction/src/v2/camera.ts:758 | `refine` | fallback-bearing |
| packages/reconstruction/src/v2/camera.ts:811 | `sidesSeenFrom` | helper |
| packages/reconstruction/src/v2/camera.ts:821 | `kindSeen` | helper |
| packages/reconstruction/src/v2/camera.ts:835 | `solvePerspectiveCamera` | fallback-bearing |
| packages/reconstruction/src/v2/cross-view.ts:48 | `median` | helper |
| packages/reconstruction/src/v2/cross-view.ts:55 | `summariseKind` | helper |
| packages/reconstruction/src/v2/cross-view.ts:66 | `verdictOf` | helper |
| packages/reconstruction/src/v2/cross-view.ts:76 | `crossViewResiduals` | fallback-bearing |
| packages/reconstruction/src/v2/facade-openings.ts:75 | `rgb` | helper |
| packages/reconstruction/src/v2/facade-openings.ts:81 | `luma` | helper |
| packages/reconstruction/src/v2/facade-openings.ts:84 | `insideEvidence` | fallback-bearing |
| packages/reconstruction/src/v2/facade-openings.ts:200 | `foreignMask` | fallback-bearing |
| packages/reconstruction/src/v2/facade-openings.ts:324 | `scanFacadeOpenings` | geometry/metric |
| packages/reconstruction/src/v2/facade-openings.ts:516 | `measureOpeningOnView` | geometry/metric |
| packages/reconstruction/src/v2/facade.ts:59 | `toneBandsAlongColumn` | helper |
| packages/reconstruction/src/v2/facade.ts:80 | `readVergeMember` | geometry/metric |
| packages/reconstruction/src/v2/facade.ts:126 | `readFasciaBand` | fallback-bearing |
| packages/reconstruction/src/v2/facade.ts:166 | `readRailing` | fallback-bearing |
| packages/reconstruction/src/v2/graph.ts:229 | `sealFeatureGraph` | helper |
| packages/reconstruction/src/v2/graph.ts:248 | `featureGraphViolations` | helper |
| packages/reconstruction/src/v2/house-stair.ts:26 | `stairSlabHole` | geometry/metric |
| packages/reconstruction/src/v2/house-stair.ts:55 | `readHouseStair` | fallback-bearing |
| packages/reconstruction/src/v2/ledger.ts:59 | `sealLedger` | fallback-bearing |
| packages/reconstruction/src/v2/ledger.ts:76 | `ledgerViolations` | fallback-bearing |
| packages/reconstruction/src/v2/pergola.ts:53 | `inside` | helper |
| packages/reconstruction/src/v2/pergola.ts:56 | `findPosts` | geometry/metric |
| packages/reconstruction/src/v2/pergola.ts:115 | `lines` | helper |
| packages/reconstruction/src/v2/pergola.ts:131 | `faceAgainst` | fallback-bearing |
| packages/reconstruction/src/v2/pergola.ts:145 | `pergolaFromPosts` | geometry/metric |
| packages/reconstruction/src/v2/pergola.ts:183 | `pergolaBeams` | helper |
| packages/reconstruction/src/v2/plane-roof.ts:38 | `distinct` | helper |
| packages/reconstruction/src/v2/plane-roof.ts:47 | `planeRoofLayout` | helper |
| packages/reconstruction/src/v2/projecting-balcony.ts:60 | `outward` | helper |
| packages/reconstruction/src/v2/projecting-balcony.ts:61 | `alongX` | helper |
| packages/reconstruction/src/v2/projecting-balcony.ts:66 | `probeOf` | helper |
| packages/reconstruction/src/v2/projecting-balcony.ts:84 | `rowCoverage` | helper |
| packages/reconstruction/src/v2/projecting-balcony.ts:95 | `returnCoverage` | helper |
| packages/reconstruction/src/v2/projecting-balcony.ts:115 | `edgeCandidates` | fallback-bearing |
| packages/reconstruction/src/v2/projecting-balcony.ts:131 | `returnAt` | helper |
| packages/reconstruction/src/v2/projecting-balcony.ts:148 | `readBalconyOutline` | fallback-bearing |
| packages/reconstruction/src/v2/projecting-balcony.ts:189 | `outlineOf` | helper |
| packages/reconstruction/src/v2/projecting-balcony.ts:200 | `balconyRect` | geometry/metric |
| packages/reconstruction/src/v2/projecting-balcony.ts:210 | `balustradePath` | helper |
| packages/reconstruction/src/v2/projecting-balcony.ts:236 | `floorLevelDoorGroups` | geometry/metric |
| packages/reconstruction/src/v2/projecting-balcony.ts:261 | `doorSpanCandidates` | geometry/metric |
| packages/reconstruction/src/v2/quality.ts:50 | `qualityLevelOf` | helper |
| packages/reconstruction/src/v2/quality.ts:59 | `sealQualityReport` | fallback-bearing |
| packages/reconstruction/src/v2/roof-datum.ts:61 | `kneeWallOf` | helper |
| packages/reconstruction/src/v2/roof-datum.ts:70 | `approximateRidgeDatum` | geometry/metric |
| packages/reconstruction/src/v2/roof-details.ts:38 | `registerSection` | geometry/metric |
| packages/reconstruction/src/v2/roof-details.ts:91 | `registerSectionByTwoAnchors` | fallback-bearing |
| packages/reconstruction/src/v2/roof-details.ts:117 | `registerSectionBySlab` | geometry/metric |
| packages/reconstruction/src/v2/roof-details.ts:193 | `sectionStackOver` | fallback-bearing |
| packages/reconstruction/src/v2/roof-details.ts:264 | `readAttachedRoof` | fallback-bearing |
| packages/reconstruction/src/v2/roof-details.ts:344 | `topInk` | fallback-bearing |
| packages/reconstruction/src/v2/roof-details.ts:359 | `slopeLine` | geometry/metric |
| packages/reconstruction/src/v2/roof-details.ts:402 | `readEavesOverhang` | fallback-bearing |
| packages/reconstruction/src/v2/roof-details.ts:529 | `readChimneys` | geometry/metric |
| packages/reconstruction/src/v2/roof-details.ts:603 | `readRooflights` | geometry/metric |
| packages/reconstruction/src/v2/roof-details.ts:692 | `median` | helper |
| packages/reconstruction/src/v2/roof-details.ts:714 | `withRecognisedHalves` | fallback-bearing |
| packages/reconstruction/src/v2/roof-details.ts:736 | `readPlanRooflights` | geometry/metric |
| packages/reconstruction/src/v2/roof-details.ts:892 | `hostRoofTopAt` | geometry/metric |
| packages/reconstruction/src/v2/roof-details.ts:913 | `insidePlanPolygon` | helper |
| packages/reconstruction/src/v2/roof-details.ts:967 | `drawnRooflightSymbol` | geometry/metric |
| packages/reconstruction/src/v2/roof-details.ts:1152 | `rowSymbolsWithoutRing` | geometry/metric |
| packages/reconstruction/src/v2/scan.ts:15 | `lumaAt` | helper |
| packages/reconstruction/src/v2/scan.ts:36 | `neutralBands` | geometry/metric |
| packages/reconstruction/src/v2/scan.ts:61 | `topNeutralInkRow` | fallback-bearing |
| packages/reconstruction/src/v2/scan.ts:70 | `rgbAt` | helper |
| packages/reconstruction/src/v2/scan.ts:79 | `inkRuns` | helper |
| packages/reconstruction/src/v2/scan.ts:100 | `bandPieces` | helper |
| packages/reconstruction/src/v2/scan.ts:127 | `mergeRuns` | helper |
| packages/reconstruction/src/v2/scan.ts:139 | `gapsBetween` | helper |
| packages/reconstruction/src/v2/scan.ts:157 | `thinStrokesAlong` | fallback-bearing |
| packages/reconstruction/src/v2/scan.ts:208 | `inkFraction` | geometry/metric |
| packages/reconstruction/src/v2/scan.ts:228 | `toneClass` | helper |
| packages/reconstruction/src/v2/scan.ts:280 | `median` | helper |
| packages/reconstruction/src/v2/scan.ts:288 | `cluster1d` | helper |
| packages/reconstruction/src/v2/scan.ts:315 | `wallBodyPieces` | helper |
| packages/reconstruction/src/v2/side-orientation.ts:36 | `isGreen` | helper |
| packages/reconstruction/src/v2/side-orientation.ts:43 | `mainTopProfile` | geometry/metric |
| packages/reconstruction/src/v2/side-orientation.ts:51 | `topResiduals` | helper |
| packages/reconstruction/src/v2/side-orientation.ts:74 | `medianOf` | helper |
| packages/reconstruction/src/v2/side-orientation.ts:80 | `scoreOrientation` | helper |
| packages/reconstruction/src/v2/side-orientation.ts:92 | `topOffset` | fallback-bearing |
| packages/reconstruction/src/v2/side-orientation.ts:109 | `decideSideOrientation` | helper |
| packages/reconstruction/src/v2/side-orientation.ts:151 | `decideSidesByOpenings` | helper |
| packages/reconstruction/src/v2/side-orientation.ts:203 | `gableOutline` | geometry/metric |
| packages/reconstruction/src/v2/side-orientation.ts:233 | `sameSheetSideRegistration` | geometry/metric |
| packages/reconstruction/src/v2/side-orientation.ts:275 | `gableApexRow` | fallback-bearing |
| packages/reconstruction/src/v2/side-orientation.ts:305 | `roofTopOverBand` | geometry/metric |
| packages/reconstruction/src/v2/solver-recorder.ts:27 | `emptySolverRecord` | helper |
| packages/reconstruction/src/v2/solver-recorder.ts:29 | `viewFamilyOf` | helper |
| packages/reconstruction/src/v2/solver-recorder.ts:37 | `createSolverRecorder` | fallback-bearing |
| packages/reconstruction/src/v2/stair-fit.ts:47 | `stairSnap` | fallback-bearing |
| packages/reconstruction/src/v2/stair-fit.ts:102 | `obstaclesOn` | helper |
| packages/reconstruction/src/v2/stair-fit.ts:121 | `fitStairToBoundingWalls` | fallback-bearing |
| packages/reconstruction/src/v2/stair-fit.ts:170 | `underStairProfile` | fallback-bearing |
| packages/reconstruction/src/v2/stair-fit.ts:213 | `followStairSoffits` | fallback-bearing |
| packages/reconstruction/src/v2/stair-topology.ts:103 | `splitAtBreaks` | helper |
| packages/reconstruction/src/v2/stair-topology.ts:124 | `findTreadLadders` | geometry/metric |
| packages/reconstruction/src/v2/stair-topology.ts:249 | `poolLadders` | helper |
| packages/reconstruction/src/v2/stair-topology.ts:263 | `arrowheadNear` | helper |
| packages/reconstruction/src/v2/stair-topology.ts:301 | `assembleStair` | geometry/metric |
| packages/reconstruction/src/v2/stair-topology.ts:508 | `winderTreadLines` | geometry/metric |
| packages/reconstruction/src/v2/stair-topology.ts:559 | `lumaAtPx` | helper |
| packages/reconstruction/src/v2/stair-topology.ts:564 | `roundRect` | geometry/metric |
| packages/reconstruction/src/v2/stair-topology.ts:567 | `turnOf` | helper |
| packages/reconstruction/src/v2/terrace.ts:44 | `readTerraceExtension` | fallback-bearing |
| packages/reconstruction/src/v2/terrace.ts:107 | `drawnShareOf` | geometry/metric |
| packages/reconstruction/src/v2/terrace.ts:127 | `terracePolygon` | helper |
| packages/reconstruction/src/v2/tones.ts:47 | `toneFamilyOf` | helper |
| packages/reconstruction/src/v2/tones.ts:54 | `whitePointOf` | fallback-bearing |
| packages/reconstruction/src/v2/tones.ts:68 | `relativeSample` | fallback-bearing |
| packages/reconstruction/src/v2/tones.ts:75 | `median` | helper |
| packages/reconstruction/src/v2/tones.ts:81 | `familyOf` | helper |
| packages/reconstruction/src/v2/tones.ts:88 | `readMassTones` | geometry/metric |
| packages/reconstruction/src/v2/tones.ts:149 | `readReturnTones` | helper |
| packages/reconstruction/src/v2/tones.ts:187 | `readFinishRuns` | fallback-bearing |
| packages/reconstruction/src/v2/verify.ts:42 | `verifyAgainstViews` | helper |
| packages/reconstruction/src/v2/verify.ts:130 | `horizontalEdgeNear` | fallback-bearing |
| packages/reconstruction/src/v2/verify.ts:155 | `verticalEdgeNear` | geometry/metric |
| packages/reconstruction/src/v2/verify.ts:179 | `verifyExteriorAssemblies` | geometry/metric |
| packages/reconstruction/src/v2/verify.ts:258 | `roofTopAt` | helper |
| packages/reconstruction/src/v2/verify.ts:270 | `repairFromResiduals` | geometry/metric |
| packages/reconstruction/src/v2/view-audit.ts:61 | `isSide` | helper |
| packages/reconstruction/src/v2/view-audit.ts:63 | `viewAudit` | fallback-bearing |
| packages/source-analyzer/src/analyze.ts:97 | `contextFactsFor` | helper |
| packages/source-analyzer/src/analyze.ts:99 | `analyzeSourcePackage` | fallback-bearing |
| packages/source-analyzer/src/depth.ts:103 | `isHorizontal` | helper |
| packages/source-analyzer/src/depth.ts:104 | `isVertical` | helper |
| packages/source-analyzer/src/depth.ts:109 | `medianTone` | geometry/metric |
| packages/source-analyzer/src/depth.ts:124 | `interiorStrip` | geometry/metric |
| packages/source-analyzer/src/depth.ts:129 | `insetStrip` | geometry/metric |
| packages/source-analyzer/src/depth.ts:132 | `outsideStrip` | geometry/metric |
| packages/source-analyzer/src/depth.ts:141 | `tone` | helper |
| packages/source-analyzer/src/depth.ts:144 | `texture` | geometry/metric |
| packages/source-analyzer/src/depth.ts:164 | `endFaceCue` | geometry/metric |
| packages/source-analyzer/src/depth.ts:207 | `shadowCue` | helper |
| packages/source-analyzer/src/depth.ts:227 | `returnFaceCue` | geometry/metric |
| packages/source-analyzer/src/depth.ts:240 | `occlusionCue` | geometry/metric |
| packages/source-analyzer/src/depth.ts:277 | `linearBands` | geometry/metric |
| packages/source-analyzer/src/depth.ts:374 | `bandConfidence` | helper |
| packages/source-analyzer/src/extractors/elevation.ts:53 | `isAxis` | helper |
| packages/source-analyzer/src/extractors/elevation.ts:62 | `rectArea` | helper |
| packages/source-analyzer/src/extractors/elevation.ts:64 | `contains` | helper |
| packages/source-analyzer/src/extractors/elevation.ts:75 | `touchesEdge` | fallback-bearing |
| packages/source-analyzer/src/extractors/elevation.ts:84 | `extractElevation` | geometry/metric |
| packages/source-analyzer/src/extractors/elevation.ts:332 | `medianRegionTone` | geometry/metric |
| packages/source-analyzer/src/extractors/plan.ts:53 | `crossFill` | helper |
| packages/source-analyzer/src/extractors/plan.ts:67 | `edgeFill` | helper |
| packages/source-analyzer/src/extractors/plan.ts:87 | `gapsAlong` | geometry/metric |
| packages/source-analyzer/src/extractors/plan.ts:107 | `bandCentreLine` | helper |
| packages/source-analyzer/src/extractors/plan.ts:113 | `extractPlan` | geometry/metric |
| packages/source-analyzer/src/extractors/section.ts:31 | `isHorizontal` | helper |
| packages/source-analyzer/src/extractors/section.ts:32 | `isVertical` | helper |
| packages/source-analyzer/src/extractors/section.ts:39 | `stepChain` | helper |
| packages/source-analyzer/src/extractors/section.ts:70 | `extractSection` | geometry/metric |
| packages/source-analyzer/src/identity.ts:24 | `centroidNorm` | helper |
| packages/source-analyzer/src/identity.ts:42 | `heightBand` | helper |
| packages/source-analyzer/src/identity.ts:49 | `overlaps` | helper |
| packages/source-analyzer/src/identity.ts:67 | `relateAcrossViews` | fallback-bearing |
| packages/source-analyzer/src/prepare.ts:58 | `scalePoint` | helper |
| packages/source-analyzer/src/prepare.ts:60 | `scaleSegment` | helper |
| packages/source-analyzer/src/prepare.ts:63 | `scaleRect` | geometry/metric |
| packages/source-analyzer/src/prepare.ts:79 | `prepareRaster` | helper |
| packages/source-analyzer/src/prepare.ts:88 | `prepareFromRaster` | fallback-bearing |
| packages/source-analyzer/src/prepare.ts:151 | `workingSegments` | fallback-bearing |
| packages/source-analyzer/src/stair.ts:124 | `midpoint` | helper |
| packages/source-analyzer/src/stair.ts:126 | `median` | helper |
| packages/source-analyzer/src/stair.ts:133 | `boundsOf` | geometry/metric |
| packages/source-analyzer/src/stair.ts:165 | `sideOf` | helper |
| packages/source-analyzer/src/stair.ts:170 | `chainTreads` | fallback-bearing |
| packages/source-analyzer/src/stair.ts:252 | `dedupe` | helper |
| packages/source-analyzer/src/stair.ts:273 | `countStringers` | helper |
| packages/source-analyzer/src/stair.ts:303 | `distanceToSegment` | helper |
| packages/source-analyzer/src/stair.ts:318 | `treadRuns` | helper |
| packages/source-analyzer/src/stair.ts:396 | `stairDirection` | fallback-bearing |
| packages/source-analyzer/src/stair.ts:464 | `readStair` | helper |
| packages/source-analyzer/src/strokes.ts:42 | `runsInLine` | helper |
| packages/source-analyzer/src/strokes.ts:65 | `strokesInDirection` | fallback-bearing |
| packages/source-analyzer/src/strokes.ts:123 | `thinStrokes` | helper |
| packages/source-common/src/canonical.ts:15 | `write` | fallback-bearing |
| packages/source-common/src/canonical.ts:56 | `canonicalJson` | helper |
| packages/source-common/src/canonical.ts:63 | `stableJson` | helper |
| packages/source-common/src/geometry.ts:39 | `toNorm` | helper |
| packages/source-common/src/geometry.ts:43 | `round6` | helper |
| packages/source-common/src/geometry.ts:63 | `rectArea` | helper |
| packages/source-common/src/geometry.ts:65 | `rectIntersection` | geometry/metric |
| packages/source-common/src/geometry.ts:74 | `rectIoU` | helper |
| packages/source-common/src/geometry.ts:83 | `segmentAngleDeg` | helper |
| packages/source-common/src/geometry.ts:89 | `segmentLength` | helper |
| packages/source-common/src/geometry.ts:92 | `angleDeltaDeg` | helper |
| packages/source-common/src/hashing.ts:14 | `hashOrdered` | helper |
| packages/source-common/src/hashing.ts:16 | `hashUnordered` | helper |
| packages/source-common/src/hashing.ts:28 | `hashArtifact` | helper |
| packages/source-common/src/ids.ts:13 | `slugify` | helper |
| packages/source-common/src/ids.ts:29 | `stableId` | helper |
| packages/source-common/src/sha256.ts:21 | `ROTR` | helper |
| packages/source-common/src/sha256.ts:24 | `sha256Bytes` | helper |
| packages/source-common/src/sha256.ts:78 | `sha256Hex` | helper |
| packages/source-cv/src/bands.ts:67 | `at` | helper |
| packages/source-cv/src/bands.ts:70 | `runLengths` | helper |
| packages/source-cv/src/bands.ts:90 | `median` | helper |
| packages/source-cv/src/bands.ts:106 | `runLengthBands` | geometry/metric |
| packages/source-cv/src/bands.ts:242 | `dominantBandThickness` | helper |
| packages/source-cv/src/bands.ts:253 | `bandThicknessQuantile` | helper |
| packages/source-cv/src/lines.ts:50 | `segmentOf` | helper |
| packages/source-cv/src/lines.ts:68 | `runsAlongRow` | geometry/metric |
| packages/source-cv/src/lines.ts:94 | `runsAlongCol` | fallback-bearing |
| packages/source-cv/src/lines.ts:134 | `medianThickness` | helper |
| packages/source-cv/src/lines.ts:166 | `axisSegments` | helper |
| packages/source-cv/src/lines.ts:245 | `axisAlignedSegments` | fallback-bearing |
| packages/source-cv/src/lines.ts:257 | `fitSegment` | fallback-bearing |
| packages/source-cv/src/lines.ts:296 | `duplicateOf` | helper |
| packages/source-cv/src/lines.ts:351 | `houghSegments` | fallback-bearing |
| packages/source-cv/src/lines.ts:504 | `parallelFamilies` | fallback-bearing |
| packages/source-cv/src/mask.ts:32 | `maskAt` | helper |
| packages/source-cv/src/mask.ts:41 | `threshold` | helper |
| packages/source-cv/src/mask.ts:72 | `inkMask` | fallback-bearing |
| packages/source-cv/src/mask.ts:86 | `morph` | helper |
| packages/source-cv/src/mask.ts:135 | `dilate` | helper |
| packages/source-cv/src/mask.ts:138 | `erode` | helper |
| packages/source-cv/src/mask.ts:170 | `connectedComponents` | geometry/metric |
| packages/source-cv/src/mask.ts:318 | `localMean` | geometry/metric |
| packages/source-cv/src/mask.ts:366 | `adaptiveInkMask` | fallback-bearing |
| packages/source-cv/src/mask.ts:390 | `gradientMask` | fallback-bearing |
| packages/source-cv/src/raster.ts:52 | `toGray` | helper |
| packages/source-cv/src/raster.ts:78 | `inkChannel` | helper |
| packages/source-cv/src/raster.ts:101 | `saturationField` | helper |
| packages/source-cv/src/raster.ts:126 | `percentile` | helper |
| packages/source-cv/src/raster.ts:156 | `downscaleGray` | helper |
| packages/source-cv/src/shapes.ts:56 | `snap` | helper |
| packages/source-cv/src/shapes.ts:73 | `countBox` | geometry/metric |
| packages/source-cv/src/shapes.ts:86 | `backed` | helper |
| packages/source-cv/src/shapes.ts:91 | `scoreRect` | helper |
| packages/source-cv/src/shapes.ts:145 | `rectangleCandidates` | geometry/metric |
| packages/source-cv/src/shapes.ts:213 | `profileTop` | helper |
| packages/source-cv/src/shapes.ts:223 | `profileBottom` | helper |
| packages/source-cv/src/shapes.ts:266 | `simplifyPolyline` | helper |
| packages/source-cv/src/shapes.ts:321 | `dominantSlopes` | fallback-bearing |
| packages/source-metrics/src/axis-topology.ts:83 | `isLabelInkMark` | fallback-bearing |
| packages/source-metrics/src/axis-topology.ts:89 | `measurementChain` | helper |
| packages/source-metrics/src/axis-topology.ts:102 | `labelSide` | helper |
| packages/source-metrics/src/axis-topology.ts:135 | `sideConventionOf` | helper |
| packages/source-metrics/src/axis-topology.ts:196 | `tokenKey` | helper |
| packages/source-metrics/src/axis-topology.ts:197 | `chainKey` | helper |
| packages/source-metrics/src/axis-topology.ts:198 | `compareKeys` | helper |
| packages/source-metrics/src/axis-topology.ts:200 | `tokenDetail` | helper |
| packages/source-metrics/src/axis-topology.ts:203 | `centredOn` | helper |
| packages/source-metrics/src/axis-topology.ts:216 | `labelCandidates` | geometry/metric |
| packages/source-metrics/src/axis-topology.ts:252 | `hungarian` | helper |
| packages/source-metrics/src/axis-topology.ts:311 | `solveNeighbourhood` | helper |
| packages/source-metrics/src/axis-topology.ts:336 | `assignLabels` | geometry/metric |
| packages/source-metrics/src/axis-topology.ts:481 | `sideConventionsOf` | helper |
| packages/source-metrics/src/axis-topology.ts:502 | `solveNeighbourhoodBound` | fallback-bearing |
| packages/source-metrics/src/axis-topology.ts:541 | `dimensionAxisGroups` | fallback-bearing |
| packages/source-metrics/src/callout-recogniser.ts:44 | `ringHalfCrops` | fallback-bearing |
| packages/source-metrics/src/callout-recogniser.ts:97 | `glyphCount` | geometry/metric |
| packages/source-metrics/src/callout-recogniser.ts:151 | `corroborateBySibling` | helper |
| packages/source-metrics/src/callout-recogniser.ts:177 | `planCorroborableWidth` | fallback-bearing |
| packages/source-metrics/src/callout-recogniser.ts:189 | `judgeCalloutHalf` | fallback-bearing |
| packages/source-metrics/src/callouts.ts:119 | `maskOf` | helper |
| packages/source-metrics/src/callouts.ts:125 | `at` | helper |
| packages/source-metrics/src/callouts.ts:128 | `darkAt` | helper |
| packages/source-metrics/src/callouts.ts:139 | `stripLongRuns` | helper |
| packages/source-metrics/src/callouts.ts:175 | `thinInk` | helper |
| packages/source-metrics/src/callouts.ts:200 | `annulusHits` | helper |
| packages/source-metrics/src/callouts.ts:215 | `annulusDarkness` | helper |
| packages/source-metrics/src/callouts.ts:222 | `diskFill` | helper |
| packages/source-metrics/src/callouts.ts:244 | `cardinalHits` | helper |
| packages/source-metrics/src/callouts.ts:263 | `findBar` | fallback-bearing |
| packages/source-metrics/src/callouts.ts:296 | `ringScore` | helper |
| packages/source-metrics/src/callouts.ts:307 | `scoreRing` | fallback-bearing |
| packages/source-metrics/src/callouts.ts:329 | `findRings` | geometry/metric |
| packages/source-metrics/src/callouts.ts:405 | `innerEdge` | helper |
| packages/source-metrics/src/callouts.ts:466 | `protoInk` | helper |
| packages/source-metrics/src/callouts.ts:480 | `renderPrototype` | helper |
| packages/source-metrics/src/callouts.ts:540 | `normalised` | helper |
| packages/source-metrics/src/callouts.ts:558 | `correlation` | helper |
| packages/source-metrics/src/callouts.ts:575 | `classifyDigit` | fallback-bearing |
| packages/source-metrics/src/callouts.ts:629 | `darknessAt` | geometry/metric |
| packages/source-metrics/src/callouts.ts:652 | `upright` | helper |
| packages/source-metrics/src/callouts.ts:707 | `readHalf` | geometry/metric |
| packages/source-metrics/src/callouts.ts:892 | `coherent` | helper |
| packages/source-metrics/src/callouts.ts:932 | `boundedRenderCache` | helper |
| packages/source-metrics/src/callouts.ts:985 | `readOpeningCallouts` | geometry/metric |
| packages/source-metrics/src/callouts.ts:1138 | `poolGrey` | helper |
| packages/source-metrics/src/callouts.ts:1183 | `inspectTintedRing` | fallback-bearing |
| packages/source-metrics/src/callouts.ts:1227 | `tintedRingHalves` | geometry/metric |
| packages/source-metrics/src/callouts.ts:1260 | `readTintedCallouts` | geometry/metric |
| packages/source-metrics/src/chains.ts:59 | `chainsFromLines` | helper |
| packages/source-metrics/src/chains.ts:74 | `observationTouchesLine` | helper |
| packages/source-metrics/src/chains.ts:200 | `assignTokens` | helper |
| packages/source-metrics/src/chains.ts:259 | `proposalsOf` | helper |
| packages/source-metrics/src/chains.ts:305 | `spansFor` | fallback-bearing |
| packages/source-metrics/src/chains.ts:328 | `gatherAround` | helper |
| packages/source-metrics/src/chains.ts:342 | `supportFor` | helper |
| packages/source-metrics/src/chains.ts:352 | `refineScale` | helper |
| packages/source-metrics/src/chains.ts:378 | `scaleCandidates` | fallback-bearing |
| packages/source-metrics/src/chains.ts:433 | `voteScale` | fallback-bearing |
| packages/source-metrics/src/chains.ts:454 | `inlierCount` | helper |
| packages/source-metrics/src/chains.ts:469 | `refineAxis` | helper |
| packages/source-metrics/src/chains.ts:526 | `decideScale` | helper |
| packages/source-metrics/src/chains.ts:567 | `solveFrameChains` | fallback-bearing |
| packages/source-metrics/src/chains.ts:621 | `solveChain` | fallback-bearing |
| packages/source-metrics/src/chains.ts:802 | `chainId` | helper |
| packages/source-metrics/src/dimension-lines.ts:129 | `crossThickness` | helper |
| packages/source-metrics/src/dimension-lines.ts:153 | `crosses` | helper |
| packages/source-metrics/src/dimension-lines.ts:177 | `findDimensionLines` | helper |
| packages/source-metrics/src/dimension-lines.ts:192 | `findStraightRuns` | fallback-bearing |
| packages/source-metrics/src/dimension-lines.ts:294 | `inkChannelOf` | helper |
| packages/source-metrics/src/dimension-lines.ts:301 | `medianOf` | helper |
| packages/source-metrics/src/dimension-lines.ts:307 | `quantileOf` | helper |
| packages/source-metrics/src/dimension-lines.ts:355 | `classifyMarks` | fallback-bearing |
| packages/source-metrics/src/dimension-lines.ts:596 | `markLabelInk` | fallback-bearing |
| packages/source-metrics/src/ensemble.ts:84 | `digitsOf` | helper |
| packages/source-metrics/src/ensemble.ts:85 | `digitCount` | helper |
| packages/source-metrics/src/ensemble.ts:86 | `hasSeparator` | helper |
| packages/source-metrics/src/ensemble.ts:88 | `formOf` | helper |
| packages/source-metrics/src/ensemble.ts:91 | `ensembleOf` | fallback-bearing |
| packages/source-metrics/src/ensemble.ts:159 | `readingOf` | helper |
| packages/source-metrics/src/extract.ts:93 | `DEFAULT_FRAME_FILTER` | helper |
| packages/source-metrics/src/extract.ts:96 | `planeOf` | fallback-bearing |
| packages/source-metrics/src/extract.ts:103 | `rectCentre` | helper |
| packages/source-metrics/src/extract.ts:122 | `planScalePlausibility` | fallback-bearing |
| packages/source-metrics/src/extract.ts:139 | `distance` | helper |
| packages/source-metrics/src/extract.ts:142 | `pointsOf` | helper |
| packages/source-metrics/src/extract.ts:152 | `nearest` | helper |
| packages/source-metrics/src/extract.ts:170 | `tokenId` | helper |
| packages/source-metrics/src/extract.ts:172 | `toOcrToken` | helper |
| packages/source-metrics/src/extract.ts:197 | `nearestRule` | helper |
| packages/source-metrics/src/extract.ts:224 | `markerApexBelow` | geometry/metric |
| packages/source-metrics/src/extract.ts:294 | `extractMetricEvidence` | helper |
| packages/source-metrics/src/extract.ts:319 | `extractMetricEvidenceAsync` | helper |
| packages/source-metrics/src/extract.ts:344 | `storeyBelowAnother` | fallback-bearing |
| packages/source-metrics/src/extract.ts:350 | `metricEvidenceSteps` | geometry/metric |
| packages/source-metrics/src/extract.ts:1024 | `parseAlternatives` | helper |
| packages/source-metrics/src/extract.ts:1041 | `buildChain` | fallback-bearing |
| packages/source-metrics/src/extract.ts:1182 | `dimensionChainsOf` | helper |
| packages/source-metrics/src/extract.ts:1196 | `labelInkOf` | helper |
| packages/source-metrics/src/extract.ts:1212 | `originFor` | fallback-bearing |
| packages/source-metrics/src/extract.ts:1234 | `scaleConflicts` | fallback-bearing |
| packages/source-metrics/src/extract.ts:1276 | `dimensionLabelLattices` | helper |
| packages/source-metrics/src/extract.ts:1298 | `onDimensionLine` | helper |
| packages/source-metrics/src/extract.ts:1308 | `latticeRecord` | fallback-bearing |
| packages/source-metrics/src/extract.ts:1347 | `externalRecord` | helper |
| packages/source-metrics/src/hash.ts:75 | `chainMember` | fallback-bearing |
| packages/source-metrics/src/hash.ts:90 | `atLeast` | fallback-bearing |
| packages/source-metrics/src/hash.ts:139 | `metricEvidenceContentHash` | fallback-bearing |
| packages/source-metrics/src/hash.ts:167 | `sealMetricEvidence` | helper |
| packages/source-metrics/src/metric-solution.ts:142 | `area` | helper |
| packages/source-metrics/src/metric-solution.ts:143 | `covered` | helper |
| packages/source-metrics/src/metric-solution.ts:150 | `sameInk` | helper |
| packages/source-metrics/src/metric-solution.ts:152 | `textRegions` | geometry/metric |
| packages/source-metrics/src/metric-solution.ts:197 | `dimensionLabels` | helper |
| packages/source-metrics/src/metric-solution.ts:250 | `hasLeadingZero` | helper |
| packages/source-metrics/src/metric-solution.ts:289 | `bindingsFor` | fallback-bearing |
| packages/source-metrics/src/metric-solution.ts:333 | `primaryBinding` | fallback-bearing |
| packages/source-metrics/src/metric-solution.ts:353 | `boundedValues` | fallback-bearing |
| packages/source-metrics/src/metric-solution.ts:379 | `contestValues` | helper |
| packages/source-metrics/src/metric-solution.ts:391 | `isReading` | helper |
| packages/source-metrics/src/metric-solution.ts:404 | `correctionReadings` | fallback-bearing |
| packages/source-metrics/src/metric-solution.ts:444 | `externalOnly` | helper |
| packages/source-metrics/src/metric-solution.ts:455 | `leadingZeroValue` | fallback-bearing |
| packages/source-metrics/src/metric-solution.ts:466 | `latticeAlternatives` | fallback-bearing |
| packages/source-metrics/src/metric-solution.ts:484 | `observationsOf` | fallback-bearing |
| packages/source-metrics/src/metric-solution.ts:591 | `gather` | helper |
| packages/source-metrics/src/metric-solution.ts:603 | `clustersOf` | helper |
| packages/source-metrics/src/metric-solution.ts:633 | `consistentCluster` | helper |
| packages/source-metrics/src/metric-solution.ts:644 | `independenceOf` | helper |
| packages/source-metrics/src/metric-solution.ts:648 | `latticeFits` | helper |
| packages/source-metrics/src/metric-solution.ts:695 | `evidenceTuple` | helper |
| packages/source-metrics/src/metric-solution.ts:698 | `compareEvidence` | helper |
| packages/source-metrics/src/metric-solution.ts:713 | `confidenceOf` | helper |
| packages/source-metrics/src/metric-solution.ts:730 | `shareEvidence` | helper |
| packages/source-metrics/src/metric-solution.ts:741 | `sameEntries` | helper |
| packages/source-metrics/src/metric-solution.ts:744 | `solveFrameMetric` | fallback-bearing |
| packages/source-metrics/src/metric-solution.ts:1490 | `whyOf` | helper |
| packages/source-metrics/src/metric-solution.ts:1553 | `parallelCopiesOf` | helper |
| packages/source-metrics/src/metric-solution.ts:1576 | `labelHeightOf` | helper |
| packages/source-metrics/src/metric-solution.ts:1578 | `medianLabelHeight` | helper |
| packages/source-metrics/src/metric-solution.ts:1604 | `dimensionHierarchy` | fallback-bearing |
| packages/source-metrics/src/metric-solution.ts:1692 | `structuralSupport` | fallback-bearing |
| packages/source-metrics/src/numeric-lattice.ts:155 | `ocrClassOf` | helper |
| packages/source-metrics/src/numeric-lattice.ts:315 | `pageMaskRadius` | helper |
| packages/source-metrics/src/numeric-lattice.ts:319 | `cropGray` | geometry/metric |
| packages/source-metrics/src/numeric-lattice.ts:335 | `variantMask` | geometry/metric |
| packages/source-metrics/src/numeric-lattice.ts:384 | `runsOf` | geometry/metric |
| packages/source-metrics/src/numeric-lattice.ts:404 | `segmentationHypotheses` | geometry/metric |
| packages/source-metrics/src/numeric-lattice.ts:504 | `dimensionStyleOf` | geometry/metric |
| packages/source-metrics/src/numeric-lattice.ts:528 | `styleFor` | fallback-bearing |
| packages/source-metrics/src/numeric-lattice.ts:537 | `holesOf` | geometry/metric |
| packages/source-metrics/src/numeric-lattice.ts:587 | `persistentCounters` | geometry/metric |
| packages/source-metrics/src/numeric-lattice.ts:600 | `cutsCounter` | helper |
| packages/source-metrics/src/numeric-lattice.ts:603 | `breaksCounter` | helper |
| packages/source-metrics/src/numeric-lattice.ts:606 | `valleyDepth` | helper |
| packages/source-metrics/src/numeric-lattice.ts:616 | `boundaryOptions` | helper |
| packages/source-metrics/src/numeric-lattice.ts:652 | `splitRun` | geometry/metric |
| packages/source-metrics/src/numeric-lattice.ts:696 | `countHypotheses` | geometry/metric |
| packages/source-metrics/src/numeric-lattice.ts:794 | `alphabetOf` | helper |
| packages/source-metrics/src/numeric-lattice.ts:797 | `pieces` | helper |
| packages/source-metrics/src/numeric-lattice.ts:826 | `glyphOf` | geometry/metric |
| packages/source-metrics/src/numeric-lattice.ts:856 | `beam` | fallback-bearing |
| packages/source-metrics/src/numeric-lattice.ts:879 | `dimensionValueOf` | fallback-bearing |
| packages/source-metrics/src/numeric-lattice.ts:885 | `geoMean` | helper |
| packages/source-metrics/src/numeric-lattice.ts:893 | `hashBytes` | helper |
| packages/source-metrics/src/numeric-lattice.ts:908 | `labelLattice` | geometry/metric |
| packages/source-metrics/src/numeric-lattice.ts:929 | `computeLattice` | geometry/metric |
| packages/source-metrics/src/numeric-lattice.ts:1296 | `anchorText` | fallback-bearing |
| packages/source-metrics/src/numeric-lattice.ts:1302 | `pickAsRead` | helper |
| packages/source-metrics/src/numeric-lattice.ts:1312 | `anchorReading` | fallback-bearing |
| packages/source-metrics/src/numeric-lattice.ts:1332 | `columnInk` | helper |
| packages/source-metrics/src/ocr.ts:120 | `textAxisOf` | helper |
| packages/source-metrics/src/ocr.ts:196 | `resample` | geometry/metric |
| packages/source-metrics/src/ocr.ts:253 | `holeStats` | fallback-bearing |
| packages/source-metrics/src/ocr.ts:402 | `distanceField` | fallback-bearing |
| packages/source-metrics/src/ocr.ts:449 | `thin` | helper |
| packages/source-metrics/src/ocr.ts:506 | `directedChamfer` | helper |
| packages/source-metrics/src/ocr.ts:529 | `shapeScore` | helper |
| packages/source-metrics/src/ocr.ts:546 | `sizePrior` | helper |
| packages/source-metrics/src/ocr.ts:563 | `aspectPrior` | helper |
| packages/source-metrics/src/ocr.ts:584 | `scoreCell` | fallback-bearing |
| packages/source-metrics/src/ocr.ts:627 | `classifyCell` | fallback-bearing |
| packages/source-metrics/src/ocr.ts:645 | `boxHeight` | helper |
| packages/source-metrics/src/ocr.ts:646 | `boxWidth` | helper |
| packages/source-metrics/src/ocr.ts:649 | `merge` | geometry/metric |
| packages/source-metrics/src/ocr.ts:656 | `groupTokens` | helper |
| packages/source-metrics/src/ocr.ts:718 | `cropToken` | helper |
| packages/source-metrics/src/ocr.ts:733 | `shear` | helper |
| packages/source-metrics/src/ocr.ts:750 | `columnProfile` | helper |
| packages/source-metrics/src/ocr.ts:765 | `estimateShear` | helper |
| packages/source-metrics/src/ocr.ts:820 | `segment` | geometry/metric |
| packages/source-metrics/src/ocr.ts:911 | `tokenMerit` | helper |
| packages/source-metrics/src/ocr.ts:914 | `orientationVoteOf` | helper |
| packages/source-metrics/src/ocr.ts:921 | `dedupeOrientations` | helper |
| packages/source-metrics/src/ocr.ts:961 | `rotateGray` | helper |
| packages/source-metrics/src/ocr.ts:977 | `invertGray` | helper |
| packages/source-metrics/src/ocr.ts:985 | `uninvertRect` | geometry/metric |
| packages/source-metrics/src/ocr.ts:990 | `unrotateRect` | geometry/metric |
| packages/source-metrics/src/ocr.ts:1017 | `readNumbers` | fallback-bearing |
| packages/source-metrics/src/ocr.ts:1070 | `compareTokens` | helper |
| packages/source-metrics/src/ocr.ts:1085 | `cellSources` | geometry/metric |
| packages/source-metrics/src/ocr.ts:1134 | `pageRectOfPass` | helper |
| packages/source-metrics/src/ocr.ts:1141 | `readNumbersFromInk` | geometry/metric |
| packages/source-metrics/src/parse.ts:46 | `normalizeSeparator` | helper |
| packages/source-metrics/src/parse.ts:53 | `parseNumber` | fallback-bearing |
| packages/source-metrics/src/parse.ts:130 | `readingLattice` | helper |
| packages/source-metrics/src/recogniser.ts:83 | `cropForToken` | geometry/metric |
| packages/source-metrics/src/recogniser.ts:103 | `labelCrop` | helper |
| packages/source-metrics/src/registration.ts:74 | `fitAxis` | helper |
| packages/source-metrics/src/registration.ts:127 | `registerFrame` | fallback-bearing |
| packages/source-metrics/src/registration.ts:295 | `solveLevelLadder` | fallback-bearing |
| packages/source-metrics/src/schema.ts:1120 | `toCentimetres` | helper |
| packages/source-metrics/src/schema.ts:1133 | `metricSolutionFor` | fallback-bearing |
| packages/source-metrics/src/specifications.ts:53 | `deaccent` | fallback-bearing |
| packages/source-metrics/src/specifications.ts:78 | `number` | helper |
| packages/source-metrics/src/specifications.ts:93 | `readSpecifications` | helper |
| packages/source-observations/src/builder.ts:87 | `idOf` | helper |
| packages/source-observations/src/builder.ts:89 | `uniqueSortedHints` | fallback-bearing |
| packages/source-observations/src/builder.ts:110 | `declareExtractor` | helper |
| packages/source-observations/src/builder.ts:122 | `declareFrame` | helper |
| packages/source-observations/src/builder.ts:140 | `observe` | fallback-bearing |
| packages/source-observations/src/builder.ts:170 | `relate` | fallback-bearing |
| packages/source-observations/src/builder.ts:184 | `conflict` | helper |
| packages/source-observations/src/builder.ts:203 | `unresolved` | helper |
| packages/source-observations/src/builder.ts:217 | `snapshot` | helper |
| packages/source-observations/src/builder.ts:225 | `seal` | helper |
| packages/source-observations/src/builder.ts:245 | `requireExtractor` | helper |
| packages/source-observations/src/builder.ts:250 | `requireFrame` | helper |
| packages/source-observations/src/geometry.ts:15 | `pixelPoints` | helper |
| packages/source-observations/src/geometry.ts:36 | `normPoints` | helper |
| packages/source-observations/src/geometry.ts:58 | `normalizeGeometry` | geometry/metric |
| packages/source-observations/src/geometry.ts:93 | `pixelCentroid` | helper |
| packages/source-observations/src/geometry.ts:101 | `isOriented` | helper |
| packages/source-observations/src/hash.ts:70 | `observationGraphContentHash` | helper |
| packages/source-observations/src/hash.ts:83 | `graphHashIsIntact` | helper |
| packages/source-observations/src/hash.ts:85 | `stripSeal` | helper |
| packages/source-observations/src/ids.ts:17 | `provenanceKey` | fallback-bearing |
| packages/source-observations/src/ids.ts:23 | `frameId` | helper |
| packages/source-observations/src/ids.ts:48 | `observationId` | fallback-bearing |
| packages/source-observations/src/ids.ts:63 | `relationId` | helper |
| packages/source-observations/src/ids.ts:67 | `conflictId` | helper |
| packages/source-observations/src/ids.ts:71 | `unresolvedId` | fallback-bearing |
| packages/source-observations/src/ids.ts:74 | `graphId` | helper |
| packages/source-observations/src/ids.ts:77 | `recomputeObservationId` | helper |
| packages/source-observations/src/ids.ts:80 | `recomputeRelationId` | helper |
| packages/source-observations/src/validate.ts:53 | `geometryKind` | helper |
| packages/source-observations/src/validate.ts:55 | `checkGeometryAgreement` | fallback-bearing |
| packages/source-observations/src/validate.ts:82 | `checkBounds` | fallback-bearing |
| packages/source-observations/src/validate.ts:104 | `checkUncertainty` | fallback-bearing |
| packages/source-observations/src/validate.ts:134 | `checkRelation` | fallback-bearing |
| packages/source-observations/src/validate.ts:190 | `validateObservationGraph` | fallback-bearing |
| packages/source-observations/src/validate.ts:264 | `errorsOnly` | helper |
| packages/source-package/src/acquire.ts:68 | `acquireSourcePackage` | fallback-bearing |
| packages/source-package/src/acquire.ts:213 | `buildAssets` | fallback-bearing |
| packages/source-package/src/acquire.ts:320 | `byUrlOf` | fallback-bearing |
| packages/source-package/src/acquire.ts:321 | `trustOf` | helper |
| packages/source-package/src/acquire.ts:326 | `makeAsset` | helper |
| packages/source-package/src/acquire.ts:342 | `captionSlugOf` | fallback-bearing |
| packages/source-package/src/acquire.ts:371 | `claimOf` | helper |
| packages/source-package/src/acquire.ts:381 | `pause` | helper |
| packages/source-package/src/acquire.ts:427 | `documentSignatureMatches` | helper |
| packages/source-package/src/acquire.ts:443 | `acquireDocuments` | fallback-bearing |
| packages/source-package/src/acquire.ts:488 | `fetchBytes` | fallback-bearing |
| packages/source-package/src/acquire.ts:528 | `safely` | helper |
| packages/source-package/src/discovery.ts:76 | `decodeEntities` | helper |
| packages/source-package/src/hash.ts:49 | `sourcePackageContentHash` | fallback-bearing |
| packages/source-package/src/hash.ts:70 | `publishedSpecificationsHash` | helper |
| packages/source-package/src/image.ts:29 | `ascii` | helper |
| packages/source-package/src/image.ts:33 | `be16` | helper |
| packages/source-package/src/image.ts:34 | `be32` | helper |
| packages/source-package/src/image.ts:35 | `le16` | helper |
| packages/source-package/src/image.ts:36 | `le32` | helper |
| packages/source-package/src/image.ts:39 | `probeImage` | fallback-bearing |
| packages/source-package/src/image.ts:138 | `decodeImage` | helper |
| packages/source-package/src/image.ts:148 | `decodeByFormat` | helper |
| packages/source-package/src/image.ts:184 | `webpDecoder` | helper |
| packages/source-package/src/logical-url.ts:63 | `isAttributionParameter` | helper |
| packages/source-package/src/logical-url.ts:75 | `normaliseSourceUrl` | helper |
| packages/source-package/src/logical-url.ts:95 | `registrableDomain` | helper |
| packages/source-package/src/logical-url.ts:103 | `attribute` | fallback-bearing |
| packages/source-package/src/logical-url.ts:114 | `declaredCanonicalUrl` | fallback-bearing |
| packages/source-package/src/logical-url.ts:136 | `logicalSourceUrl` | helper |
| packages/source-package/src/net.ts:107 | `parseIPv4` | fallback-bearing |
| packages/source-package/src/net.ts:113 | `isBlockedIPv4` | helper |
| packages/source-package/src/net.ts:144 | `expandIPv6` | fallback-bearing |
| packages/source-package/src/net.ts:181 | `embeddedIPv4` | helper |
| packages/source-package/src/net.ts:191 | `isBlockedIPv6` | helper |
| packages/source-package/src/net.ts:209 | `isBlockedHostLiteral` | helper |
| packages/source-package/src/net.ts:222 | `defaultResolver` | helper |
| packages/source-package/src/net.ts:228 | `assertFetchable` | helper |
| packages/source-package/src/net.ts:271 | `mediaTypeOf` | fallback-bearing |
| packages/source-package/src/net.ts:280 | `safeFetch` | fallback-bearing |
| packages/source-package/src/net.ts:338 | `idleDeadline` | fallback-bearing |
| packages/source-package/src/net.ts:365 | `isTransientFetchFailure` | helper |
| packages/source-package/src/net.ts:371 | `readCapped` | helper |
| packages/source-package/src/roles.ts:43 | `mergeRoleClaims` | helper |
| packages/source-package/src/roles.ts:69 | `projectionForDocument` | helper |
| packages/source-package/src/roles.ts:86 | `storeyApplies` | helper |
| packages/source-package/src/roles.ts:89 | `viewApplies` | helper |
| packages/source-package/src/roles.ts:92 | `normalizeRoles` | helper |
| packages/source-package/src/router.ts:28 | `isSpecialist` | fallback-bearing |
| packages/source-package/src/router.ts:29 | `isGeneric` | helper |
| packages/source-package/src/router.ts:32 | `specialistFor` | helper |
| packages/source-package/src/router.ts:37 | `hasGenericStrategy` | helper |
| packages/source-package/src/router.ts:46 | `routableBeforeFetch` | helper |
| packages/source-package/src/router.ts:57 | `routeSourceAcquisition` | helper |
| packages/source-package/src/schema.ts:322 | `selectedVariant` | helper |
| packages/source-package/src/security.ts:66 | `validatePublicSourceUrlSecurity` | fallback-bearing |
| packages/source-package/src/text.ts:68 | `compareCodeUnits` | helper |
| packages/source-package/src/types/omggif.d.ts:8 | `decodeAndBlitFrameRGBA` | helper |
| packages/source-package/src/variants.ts:32 | `aspectOf` | helper |
| packages/source-package/src/variants.ts:35 | `sameShape` | helper |
| packages/source-package/src/variants.ts:78 | `pixelArea` | helper |
| packages/source-package/src/variants.ts:81 | `selectionOrder` | helper |
| packages/source-package/src/variants.ts:86 | `selectionReason` | helper |
| packages/source-vision/src/apply.ts:28 | `px` | helper |
| packages/source-vision/src/apply.ts:31 | `toPixelGeometry` | geometry/metric |
| packages/source-vision/src/apply.ts:63 | `applyVisionResponse` | fallback-bearing |
| packages/source-vision/src/providers/null.ts:14 | `nullVisionReasoner` | helper |
| packages/source-vision/src/schema.ts:140 | `extractorNameFor` | helper |
| packages/source-vision/src/schema.ts:143 | `extractorVersionFor` | helper |
| packages/source-vision/src/tasks.ts:91 | `tasksForDocument` | helper |
| packages/source-vision/src/tasks.ts:101 | `readsAsFacade` | helper |
| packages/source-vision/src/tasks.ts:105 | `tasksForRoles` | helper |
