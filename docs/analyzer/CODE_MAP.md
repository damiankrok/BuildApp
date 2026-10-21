# Analyzer code map — where each behaviour lives

> Stage 005Y-N6 REV1. A map for an engineer who has to find, change and test one behaviour of the source → model →
> phone path. Every file named here is real; every function named here can be called from a test on its own.
> Line counts are from `research/analyzer-005y-n6/function-map.ts` (TypeScript compiler API inventory).

## The path, in order

```
source-package ─► source-analyzer ─► source-metrics ─► reconstruction (layout ─► v2 solver ─► emit)
      ─► model (commands ─► CanonicalBuildingModel) ─► geometry (compile, closure) ─► mobile-scene ─► Android
                                     └─ analysis-service (runAnalysis) drives it; apps/local-analyzer ships it
```

| Stage | Entry point | What it decides |
|---|---|---|
| Acquire | `packages/source-package` | which assets of a publisher page are read; sealed, hashed |
| Observe | `packages/source-analyzer` | frames: which image is a plan / elevation / section, its storey |
| Measure | `packages/source-metrics/src/extract.ts` `metricEvidenceSteps` | dimension chains, callout rings, scales (`coordinateRegistrations`), level datums |
| Lay out | `packages/reconstruction/src/layout.ts` `inferStructuralLayout`, `planSheet` | wall bands, the plan's extent and per-axis ladder, bodies (masses), storeys |
| Solve | `packages/reconstruction/src/v2/reconstruct-v2.ts` `reconstructV2` | the BuildingV2: frames per storey, levels, walls, openings, roof, stair, chimneys |
| Emit | `packages/reconstruction/src/v2/emit.ts` `emitBuilding` | the Building DSL command program |
| Model | `packages/reconstruction/src/candidate.ts` `buildCandidateModel` | the ONLY place a program is run into a model |
| Geometry | `packages/geometry/src/compile.ts` `compileBuilding`; `closure.ts` `geometryClosureAudit` | meshes; the joint audit (exterior errors) |
| Phone | `packages/mobile-scene/src/bundle.ts` `buildMobileSceneBundle`; `npm run mobile:export-scenes` | the scene bundles the APK ships |
| Run | `packages/analysis-service/src/run.ts` `runAnalysis` | the one pipeline the CLI, the API and the phone all call |

## Where a behaviour lives (the small functions)

### Source, image and metrics
- **Callout rings on a tinted field** — `source-metrics/src/callouts.ts`: `readTintedCallouts` finds circles;
  `inspectTintedRing` (digits inside, clear margin, the bar) and `tintedRingHalves` (crop, split at the bar) are pure
  and tested in `test/tinted-ring-inspection.test.ts`. Gates are named constants (`TINT_DIGIT_INK_MIN/MAX`,
  `TINT_BAR_MIN_RUN_SHARE`, …).
- **The external recogniser's acceptance** — `source-metrics/src/callout-recogniser.ts` (header says why each gate).
- **Plan scale** — `source-metrics/src/registration.ts` fits `metresPerPixelX/Y` from chain anchors. An axis with only
  short anchors carries their pixel rounding; see example 1.

### Reconstruction
- **Wall bands and their thickness window** — `layout.ts` `wallBandWindow` (pure; `test/wall-band-window.test.ts`):
  the second band pass is centred on the measured wall thickness and widened only by walls that run the building's
  length (`RUNNING_WALL_SHARE`).
- **A plan's per-axis ladder** — `layout.ts` `axisLadder`: printed chain values pinned on the grid lines.
- **A body beyond the measured envelope** — `layout.ts` `reachesBeyond` + `toOuterFaces`: its band-only sides go to
  the band's outer face (an attached garage no chain dimensions).
- **The v2 plan frame** — `v2/frame.ts` `planFrameV2`; `outerFacesAlong` + `faceToFaceMetresPerPixel` (pure;
  `test/face-to-face-scale.test.ts`) lay the stated span between the drawn outer faces.
- **One opening, from a gap** — `v2/openings-v2.ts` `readWallOpenings` calls, in order: `matchOpeningCallout` →
  `readOpeningOnViews` → `resolveSillAndHead` → `rakedHead` → `classifyOpeningFamily`. All but the view reader are pure,
  in `v2/opening-reading.ts`, and tested in `test/opening-reading.test.ts` (door / window / garage / glazed door, with
  negatives). Thresholds are named with units (`DOOR_HEIGHT_MIN_M`, `GLAZED_DOOR_MIN_WIDTH_M`, …).
- **Corner glazing** — `v2/openings-v2.ts` `cornerAssemblies` (pair) and `openCornerBand` (open the block or not).
- **Rooflights** — `v2/roof-details.ts` (symbol → row line → ring, in that order of trust).
- **Stairs** — `v2/stair-topology.ts`: `findTreadLadders` (strokes → sequences → groups; `splitAtBreaks` takes apart a
  group too wide for one flight), `assembleStair`, `winderTreadLines`; `v2/house-stair.ts` `readHouseStair` and the
  pure `stairSlabHole`; `v2/stair-fit.ts` fits the laid-out stair between its bounding walls.
- **The solver's bookkeeping** — `v2/solver-recorder.ts` `createSolverRecorder`: `step`, `gap`, `record`, `sighting`,
  `feature`, `relate`. Every decision the solver makes goes through one of these, so it shows in the analysis trace.

### Model, scene, phone
- **Joint audit semantics** — `geometry/src/closure.ts` `relationOf`: which meetings are intended (a stack pierces a roof
  or roof plane; walls meet at their ends; …). `test/plane-chimney-closure-005y-n6.test.ts`.
- **Object facts on the phone** — `mobile-scene/src/describe.ts` `describeObject`, with `describeStair` and the pure
  `stairSegmentSummary` (`test/stair-summary.test.ts`).
- **Android versionCode** — `apps/android/app/build.gradle.kts` `previewVersion` (CI, local, or `-PpreviewVersionCode`).

## How to prove a change

| Change | Proof |
|---|---|
| structural only (refactor) | replay on sealed evidence, `model.json` byte-identical for 5 houses + 3 analogs; for source-metrics a production run, `metric-evidence.json` byte-identical; for mobile-scene the serialized bundles byte-identical |
| behaviour | the same replay, every differing house explained by evidence; a focused test with a positive and a negative case |

Replays reuse the sealed metric evidence of a run; a source-metrics change needs a production run (`second-house.ts`).
Architecture gates: `tests/architecture/*.test.ts` (no model built outside `candidate.ts`, no research path in
production, no project knowledge in the core).

## Worked debugging example 1 — "a 0.10 m wall stands against A01's front wall"

1. **See it.** `model.json`: an INTERIOR wall `main-iwall-0-x-6` at z = 0.427, exactly the exterior thickness, with three
   doors whose positions copy the front openings.
2. **Find who made it.** Interior walls come from plan ink the ring walls do not cover (`v2/interior.ts`). So the ring
   wall and the drawn wall disagree: the model's front face is at z = 0, the drawing's 5 px inside it.
3. **Measure the source.** On the plan the 830 cm chain ticks y = 149 and 557 (408 px) — the drawn outer faces. The
   registration says 0.020108 m/px, so 8.30 m ends at 561.8 px.
4. **Find the first bad number.** `metric-evidence.json` → `coordinateRegistrations` for the frame: Y is anchored by
   0.55 m over 28.5 px and 0.77 m over 38 px only. The layout's ladder (`axisLadder`) knew 830 cm spans 149..557, but
   `planFrameV2` mapped pixels with the registration's scale.
5. **Fix at that boundary, with a pure function and a test.** `faceToFaceMetresPerPixel`: lay the stated span between
   the drawn faces when the sheet's scale misses them by ≥ 2 px (A01 4.8 px; Rarytasy 0.9 px and Cieszynianki 0.7 px
   stay). Replay: A01 changes (phantom wall and its doors gone), 7 other models byte-identical.

## Worked debugging example 2 — "Goździkowce's 70/210 recess opening is a window"

1. **See it.** The opening carries `printed 70/210`, sill 0, height 2.10, kind WINDOW.
2. **Which step decides the kind?** `readWallOpenings` → `classifyOpeningFamily(facts)`. Reproduce in a unit test with
   `facts({ widthM: 0.7, symbols: symbols({ glazed: true }) })` → WINDOW.
3. **Read the rule chain.** Below `GLAZED_DOOR_MIN_WIDTH_M` (0.75 m) a glazed gap to the floor never reached a rule
   that asks for a leaf; it fell through to WINDOW. The plan draws the swing into the room behind.
4. **Fix without moving the 0.75 m cut.** Below it, `symbols.leaf()` or `symbols.swingDrawn()` makes a DOOR; with
   neither it stays a WINDOW (negative test). Replay: that one opening changes, 7 other models byte-identical.
