# STAGE BUILDAPP-03Y2G: Generic plan decomposition, failure diagnostics and the Rarytasy generalization gate

Branch `claude/buildapp-buildworld-v1-7y6yqh`. Every number below comes from a
file, a test or a CI run named next to it. Nothing is estimated. Evidence is in
`stage-reports/artifacts/rarytasy-generalization/` (its `README.md` lists what
each folder is and the command that made it).

## Verdict

**PARTIAL_STAGE_BUILDAPP_03Y2G_OWNER_PHONE_RECHECK_PENDING**

Everything this stage can prove off the owner's phone is proven.

- **The second house** now goes all the way through the same production
  pipeline, in every runtime except the owner's phone. Each run gives the same
  building: model `b1d6d7b7…`, scene `454af53f…` / `6fe9c096…`.
  - Desktop, Node 22: live, and replayed offline from its sealed evidence.
  - A fresh CI runner.
  - The APK's own bundle on Node 18 without ICU.
  - **Android 14 (x86_64 emulator)** via the production launcher:
    `LIVE_ANDROID_ANALYSIS_PASS`, 186.1 s, peak 2 096 MiB.
  - The building: a house with a gable and a chimney, and an attached double
    garage.
- **The first bad inference** was a sheet scale that OCR misreadings agreed on.
  It and the other failures behind it were fixed by rules about classes of
  drawings, not about this project: an architecture test forbids the project's
  name, id and dimensions in production code.
- **Every expected failure now has its own code.** It has a stage, counts, a
  trace and a shareable bundle on the phone.
- **Marcówki's model is unchanged**, both sealed and live, on Node 18 and on
  the emulator.
- **CI:** run 45 is green on all 10 jobs, including the new
  `second-house-generalization`.
- **Direct link:** `BuildPlan-Preview-arm64.apk` is a direct GitHub release
  asset, not a zip.

It is PARTIAL, not PASS, for one reason. **The owner's phone failed
differently from every machine here:**

- It stopped at REGISTERING_VIEWS after 20 s with 248 MB, where the pre-fix
  desktop, Node 18 and emulator runs all went on to BUILDING_MODEL. The
  leading explanation is that the phone did not get the two 853 px plans.
  That is a hypothesis this environment cannot test.
- This build either completes on the phone (hashes above) or fails there with
  a named code and a bundle that settles it.
- The owner's run of the checklist below decides the gate: a completed run
  with the hashes above makes this stage PASS.

## START / FINAL HEAD

- Start: `87c05889ade457fc3e6c5055ccff4589bff5c1e5` (the last 03Y2 report commit).
- `a69af63`: generic plan fixes for a second house; typed reconstruction
  failures and a pipeline trace.
- `55f2c1c`: a failure says why, on the phone too; diagnostics outlive the
  job (Android failure card, protocol 2, DiagnosticsStore, FileProvider).
- `7cfc534`: tests for the generic fixes and the failure codes; the pocket
  test.
- `4bc8178`: the second-house CLI, the scene sheet, and the sealed
  pre-fix / post-fix / phone-like artifacts.
- `b89928c`: the CI job `second-house-generalization`, the
  `preview-latest` direct APK, a second live URL on the emulator, the replay
  gates, and docs.
- Final: the commit that carries this report and the PROJECT_STATUS rows (see
  `git log`).

## OWNER SECOND-PROJECT FAILURE

What the owner reported, from the phone (arm64, nodejs-mobile v18.20.4, the
03Y2 build):

- Project: *Dom w rarytasach 5 (G2E)*,
  `https://www.archon.pl/projekty-domow/projekt-dom-w-rarytasach-5-g2e-m84f2903cb8e14`.
- **ANALYSIS_FAILED** during **REGISTERING_VIEWS** after about 20.1 s, peak
  about 248 MB.
- Marcówki works on the same phone.

The public code said nothing about why: `ANALYSIS_FAILED` was the mapping for
every unexpected exception, so the phone showed "the analyzer could not
reconstruct a building from this page" whatever broke.

## RARYTASY SOURCE PACKAGE

Post-fix live acquisition (`post-fix/source-package.json`, `source-hashes.json`):

| | |
|---|---|
| package | `src-m84f2903cb8e14-bd72938d69`, content hash `82a5490b763e…` |
| assets | 37 (43 variants). 7 publisher links answer HTTP 404 on every machine; 5 are byte-identical copies |
| roles | FLOOR_PLAN 4 · ELEVATION 4 · SECTION 1 · SITE_PLAN 1 · PERSPECTIVE_RENDER 25 · UNKNOWN 2 (35 drawings) |
| floor plans | two 853×853 GIFs (one dimensioned, one with the area table), a 550×550 and a 400×400 rendering |
| published facts | built area 189.77 m², 13 rooms including *Garaż* 35.52 m² |

The pre-fix package (`pre-fix/source-package.json`, `d72b70233def…`) is an
earlier fetch of the same page. It has the same 37 assets and the same plan
frame (`frame-asset-rzut-e8520c3ad3-59a406b738`).

## PRE-FIX PIPELINE TRACE

Desktop, Node 22, the pre-fix code (reconstructed from the session's run and
`pre-fix/`):

| stage | result |
|---|---|
| ACQUIRING_SOURCE → EXTRACTING_OBSERVATIONS | passed: 35 drawings, 1 183 observations |
| METRIC_EVIDENCE | passed, but the base plan's scale was **8.5125 cm/px** (true ≈ 2.75) |
| REGISTERING_VIEWS: plan decomposition | passed: a **53 × 45 m** building. The gate computed FOOTPRINT_AREA_WRONG (417 m² against 189.77) and nothing enforced it |
| SOLVING_TOPOLOGY / SOLVING_METRICS | passed, on the wrong scale |
| BUILDING_MODEL | **threw** `[OPENING_IN_JUNCTION_ZONE] opening opening-0-east-1-0 spans 22.743..28.149 m along wall ring-main-0-w1, but junctions leave that wall material only between 0.380 and 28.111 m` (a 28 m wall) |
| public error | `ANALYSIS_FAILED`: "the analyzer could not reconstruct a building from this page" |

Node 18.20.4 without ICU, through the esbuild bundle the APK ships
(`pre-fix/node18-local-analyzer-events.jsonl`): the same `ANALYSIS_FAILED`
after **279.7 s**, peak RSS **1 992 491 008 B**, last progress BUILDING_MODEL.

That is not the phone's symptom. The phone stopped at REGISTERING_VIEWS after
20 s with 248 MB. The desktop needs 86 s for observations alone, so the phone
cannot have read the same drawings. Replaying the pre-fix code on the full
package with drawings withheld (`.cache` probe, summarised here) showed:

- Without the two 853 px plans, the old code stops at REGISTRATION with
  "no walled body could be decomposed from the plans", which maps to
  ANALYSIS_FAILED at REGISTERING_VIEWS: the phone's symptom.
- With only the 400 px or the 550 px plan, it stops the same way.

So the **leading hypothesis** for the phone is that it did not receive, or
could not use, the 853 px plans. It is a hypothesis, not a finding. The phone
build this stage ships keeps the trace (its FETCH step counts every failed
fetch by code) and a shareable bundle, and one failed run will settle it
(OWNER PHONE CHECKLIST).

## PRE-FIX FAILURE CODE

- Before: `ANALYSIS_FAILED`, with no stage, no reason and no counts (desktop,
  Node 18 and phone alike).
- Today's solver on the pre-fix evidence (`pre-fix/failure.json`, gated in CI):

```
RECONSTRUCTION_FAILED / PLAN_LAYOUT_REJECTED — REGISTERING_VIEWS / STRUCTURAL_LAYOUT
"the lowest storey covers 417.13 m² against the 189.77 m² the publisher prints — 119.8% apart:
 the decomposition is not of this building"
counts: 4 plan frames, 853×853 px, 7 of 80 chains read, scale 8.5125 cm/px, 41 wall bands (14 px),
        28 × 11 grid lines, 270 cells, 68 enclosed, 5 built regions, 2 masses, gate FOOTPRINT_AREA_WRONG
```

- The phone-like replay (`phone-like-no-853-plans/failure.json`):
  `RECONSTRUCTION_FAILED / PLAN_NO_WALLED_ENVELOPE — REGISTERING_VIEWS / PLAN_DECOMPOSITION`
  on the 550×550 px plan: 30 wall bands, 6 of 38 chains read, 7 × 4 grid
  lines, 18 cells, 0 enclosed.

## FIRST BAD INFERENCE

**The base plan's sheet scale.** The dimension-chain vote pools every chain on
the sheet and tolerates a miss in pixels. The plan's italic numerals were
misread in a consistent way on four chains ("4 numbers on 4 chains"), and
those misreadings agreed on 8.51 cm/px. The true scale, 2.748 cm/px, was the
vote's **8th** candidate. Everything downstream was consistent with the wrong
scale:

- The solver marked chain readings `CHAIN_CORRECTED` to fit it.
- The walls became 1.49 m thick.
- The building became 53 × 45 m.
- The layout gate said FOOTPRINT_AREA_WRONG, but only as a reason on a
  report.

The first place the error was **detectable from the drawing itself** was the
scale, and it was detectable without any published fact: at 8.51 cm/px the
plan's heavier walls are 1.49 m thick, and no house wall is.

## PLAN SELECTION

`PLAN_READ` trace step, post-fix:

- 4 plan frames. 1 is read as the base plan: the 853 px dimensioned plan
  `frame-asset-rzut-e8520c3ad3-59a406b738`. 0 are skipped.
- The area-table copy and the two small renderings still get a scale
  decision, but only the base plan builds the storey.
- Frames that cannot be decoded, or that have no extent, are now listed as
  `skippedPlans` with a code, `NOT_DECODABLE` or `NO_EXTENT`.

## DIMENSION CHAINS

Post-fix metric evidence (`post-fix/metric-evidence.json`): 123 chains in the
package, 80 on the base plan, of which 9 were read. The METRIC_EVIDENCE step
counts 4 scales refused, one per plan copy:

| plan | vote winner | decision |
|---|---|---|
| 853 px dimensioned | 8.514546 cm/px (4 numbers, 4 chains). Its 17.5 px walls would be 1.49 m | **replaced** by 2.747825 cm/px: 4 numbers on ≥ 2 chains, walls 0.48 m |
| 853 px area table | 0.245091 cm/px (walls 0.04 m) | refused; nothing else is stated three times, so **no scale** |
| 550 px rendering | 0.201982 cm/px (walls 0.02 m) | replaced by 3.701917 cm/px (walls 0.41 m) |
| 400 px rendering | 0.009259 cm/px | refused; **no scale** |

Each decision is recorded as `scaleDecision` on the frame, with an unresolved
`gap-scale-implausible-*` that names the refused scale and the replacement
(`docs/METRIC_EVIDENCE.md`). The base plan's registration then solves at
**2.7579 cm/px**.

## WALL BANDS

Base plan, post-fix: the bands are unchanged from pre-fix, because detection
is in pixels. What changed is the thickness they are judged by:

- `bandWallThickness` now uses `dominantBandThickness`, the median.
- The scale test uses `bandThicknessQuantile(…, 0.75)`, the upper quartile.
  This keeps the thin partitions that make up most band length from voting an
  outer wall thin.
- Overlay: `post-fix/plan-diagnostics/*-bands.png`.

## GRID

- Post-fix: 20 × 9 grid lines. Pre-fix: 28 × 11. The wrong scale let
  `thinLines` keep lines closer than a real cell.
- Lines come from chain boundaries, which are metric, and band axes and faces,
  which are drawn. `*-grid.png` draws both, with the dimension chains read.

## EDGE CLOSURE

Each grid edge is shut by wall, by continuous line work, or by a hole in a
wall that carries on. New in this stage: holes wider than 3.2 m are weighed on
evidence (WIDE OPENING LOGIC). On the base plan, 2 wide openings were weighed
and 2 were closed:

- The rear wall, `COLLINEAR_GAP`, 4.00 m: "100 % of it spanned by one drawn
  line and a callout of 410 cm beside it: an opening in a wall that carries
  on". This is the terrace glazing.
- The garage front, `BAY_MOUTH`, 4.96 m: "both side walls reach it, 100 % of
  the gap is one drawn line, a callout of 500 cm is printed at it". This is
  the double garage door.

## FLOOD FILL

- **H0_STRICT_ENCLOSURE**: 114 built cells.
- **H1_WIDE_OPENING_CONTINUITY**: 126 built cells, 2 openings closed, each on
  its own evidence (weakest score 1.00). **Chosen.**
- H0 is kept in `hypotheses` with "it leaves open gaps the drawing itself draws
  shut".
- `*-flood.png` colours OUTSIDE red, RECESS amber and BUILT green. Pre-fix, the
  same overlay shows the house mostly red with a green island. That is the
  wrong scale's grid leaking through.

## BUILT REGIONS

Post-fix: 152 cells, 126 enclosed, **2 built regions**, 0 recess regions.
Pre-fix: 270 cells, 68 enclosed, 5 built regions, 2 recesses.

## MASS GRAPH

| body | extent (drawing) | model |
|---|---|---|
| `mass-0` house | 17.20 × 8.50 m | 17.21 × 8.48 m, gable, 30° from the section (ridge +5.70, eaves +3.24), chimney |
| `mass-1` garage | 6.88 × 6.24 m | ≈ 6.2 × 6.2 m, **ATTACHED** to the house's front, flat roof |

The layout gate says `STRUCTURAL_LAYOUT_ACCEPTED`: FOOTPRINT_AREA_AGREES,
184.22 against 189.77 m². All 4 elevations registered (`ridgeDatum: true`).
The front is SHEET_BOTTOM (see WHY THE FIX IS NOT RARYTASY-SPECIFIC).
`*-masses.png` draws both bodies.

## ROOT CAUSE

There were two failures, in series, and a reporting failure over both:

1. **Metric:** a pixel-tolerance scale vote with no physical check accepted a
   scale that several consistent OCR misreadings agreed on.
2. **Structural:** a building at the wrong scale went on through topology and
   metrics. The layout gate's FOOTPRINT_AREA_WRONG was computed and ignored.
   The model then refused an opening in a 28 m wall. The first place anything
   stopped was the model's validator, three stages later.
3. **Reporting:** that refusal, and every other expected failure, reached
   users as `ANALYSIS_FAILED` with no stage and no reason. The phone, which
   failed differently (hypothesis above), said the same thing.

Correcting the scale alone was not enough. At the right scale, the plan has a
5 m double garage door and a 4 m terrace glazing, and the 3.2 m width cap
opened both: the garage became ground and the house flooded at the rear. It
also has level symbols with no rule, so the ridge and the eaves came out
unmeasured. And the section's terrain datum, −0.32, was taken as the floor.

## GENERIC FIX

| area | change | where |
|---|---|---|
| scale | physical plausibility of a plan scale: upper-quartile wall thickness 0.15–0.8 m. A replacement needs ≥ 3 numbers on ≥ 2 chains and ≥ 3 % difference, otherwise **no scale** | `source-metrics/src/chains.ts` (`decideScale`, `scaleCandidates`), `extract.ts` (`planScalePlausibility`) |
| wide openings | a gap from 3.2 to 8 m is weighed on infill, callout, corners and what lies behind it (pocket test); a callout alone never shuts it | `reconstruction/src/plan-decomposition.ts` |
| bays | walls leaving the envelope side by side (garage, carport): the mouth is shut only by drawn infill or a matching callout, with piers at both corners | same |
| hypotheses | H0 strict and H1 continuity are both computed and recorded; H1 is chosen when they differ; no rectangle fallback | same |
| the gate | FOOTPRINT_AREA_WRONG, overlap and no-mass verdicts now **stop** the run: `PLAN_LAYOUT_REJECTED` | `reconstruction/src/plan-diagnostics.ts`, `v2/reconstruct-v2.ts` |
| levels | a level symbol with no rule: its ▽ apex is found on the raster. A terrain datum is never the floor. An implicit ±0.00 is added when positive datums exist | `source-metrics/src/extract.ts` (`markerApexBelow`), `reconstruction/src/solve.ts` |
| zones | recess and return zones skip stretches another body stands in; the main roof covers zones only past the depth all bodies explain | `v2/recesses.ts`, `v2/reconstruct-v2.ts` |
| emission | an opening the model refuses as not fitting its host is fitted by the model's own validator (shrunk, lowered or dropped, and named), and any other refusal is `MODEL_EMISSION_FAILED` | `reconstruction/src/candidate.ts` (`fitOpeningsToHosts`) |
| failures | `ReconstructionFailure` with stable codes, phase, substage, flat counts and the plan digest; service `RECONSTRUCTION_FAILED` with `reasonCode`, `stage`, `substage`, `title` and `diagnostics` | `reconstruction/src/failure.ts`, `analysis-service/src/errors.ts` |

## WHY THE FIX IS NOT RARYTASY-SPECIFIC

- Every rule is stated about a class of drawing, not a project:
  - a scale that makes walls impossibly thick is wrong
  - a gap with a door drawn across it is a door
  - a callout alone never shuts a gap
  - piers alone never shut a mouth
  - a pocket about as deep as its mouth is a loggia
  - a terrain datum is not a floor
- Every rule has a synthetic test that draws no real building
  (`wide-openings.test.ts`, 15; `scale-plausibility.test.ts`, 9;
  `fit-and-levels.test.ts`, 9; `failure-codes.test.ts`, 8).
- `tests/architecture/second-house.test.ts` fails the build if:
  - any production file (code or comment, including the Android app) names
    the project or carries its publisher id `m84f2903cb8e14`;
  - any production file reads `rarytasy-generalization`, `stage-reports/artifacts`,
    `research/`, `tests/benchmark` or `reference-marcowki`;
  - the changed solver and readers carry any of the project's dimensions
    (17.2, 14.74, 6.88, 6.24, 189.77 and their cm forms).
- The constants are generic: 0.15–0.8 m wall, 3.2 m lintel convention, 8 m
  widest opening weighed, 0.7 infill, a pocket at 2.5 × width².
- **Marcówki**, the other house, gives the same model (MARCÓWKI
  NON-REGRESSION).
- `frontSide: SHEET_BOTTOM` was audited and is not the cause:
  - The publisher places the garage at the front.
  - The garage protrudes at the sheet's bottom.
  - The FRONT elevation registers against that side.
  - Nothing was changed.

## FAILURE CODE TAXONOMY

- `AnalysisErrorCode`, the public codes:
  - `SOURCE_REFUSED`, `SOURCE_UNREACHABLE`, `UNSUPPORTED_PUBLISHER`, `NO_DRAWINGS`
  - **`RECONSTRUCTION_FAILED`** (new)
  - `ANALYSIS_FAILED`: only for the unexpected, now with `stage` and `reasonCode: INTERNAL_ERROR`
  - `TIMEOUT`, `CANCELLED`, and the service's own codes
- `reasonCode` (`packages/reconstruction/src/failure.ts`, each with a title):
  - **Plan:** `PLAN_NOT_FOUND`, `PLAN_NOT_DECODABLE`, `PLAN_NO_DIMENSION_FRAME`,
    `PLAN_NO_WALL_BANDS`, `PLAN_NO_WALLED_ENVELOPE`, `PLAN_GRID_EMPTY`,
    `PLAN_NO_ENCLOSED_CELLS`, `PLAN_NO_BUILT_REGIONS`, `PLAN_NO_MASSES`,
    `PLAN_LAYOUT_REJECTED`, `PLAN_STOREY_ALIGNMENT_FAILED`,
    `PLAN_STOREY_ALIGNMENT_AMBIGUOUS`
  - **Views:** `VIEW_REGISTRATION_NO_ANCHORS`, `VIEW_REGISTRATION_AMBIGUOUS`,
    `ELEVATION_REGISTRATION_FAILED`, `SECTION_REGISTRATION_FAILED`
  - **Solving and emission:** `TOPOLOGY_NO_VALID_HYPOTHESIS`,
    `METRIC_SOLVE_FAILED`, `MODEL_EMISSION_FAILED`
  - **Scene and verification:** `SCENE_COMPILE_FAILED`,
    `VERIFY_REPLAY_FAILED`, `VERIFY_CLOSURE_FAILED`
  - **Unexpected:** `INTERNAL_ERROR`
- Each failure carries:
  - `stage`, which is one of the nine, and `substage`, for example
    `PLAN_DECOMPOSITION`
  - `title` and `message`, both about the drawing and never the machine
  - `diagnostics`: flat counts (plan frames, size, chains read, scale, wall
    bands, wall px, envelope, grid lines, cells, enclosed, built, recesses,
    wide openings weighed and closed, masses, gate verdict)
  - no path, no stack trace, no source bytes
- The plan codes are decided by `planFailureOf`, which checks the chain
  in order: NOT_FOUND → NOT_DECODABLE → NO_WALL_BANDS / NO_WALLED_ENVELOPE (no
  extent) → NO_DIMENSION_FRAME → NO_WALL_BANDS → NO_WALLED_ENVELOPE →
  GRID_EMPTY → NO_ENCLOSED_CELLS → NO_BUILT_REGIONS → NO_MASSES.
- Exact-code tests (`packages/reconstruction/test/failure-codes.test.ts`): one
  synthetic plan per link fails with exactly that code, with the trace's last
  step FAILED under the same code and a message free of paths.
- The service maps and records failures:
  - `ROLES` fails `NO_DRAWINGS`.
  - `COMPILE` fails `SCENE_COMPILE_FAILED`.
  - `REPLAY` / `ROUND_TRIP` fail `VERIFY_REPLAY_FAILED`.
  - `CLOSURE` fails `VERIFY_CLOSURE_FAILED`.
  - Source errors carry `stage: ACQUIRING_SOURCE` and the last fetch failure's
    code (`packages/analysis-service/test/trace.test.ts`,
    `apps/analyzer-api/test`).

## ANALYSIS TRACE

`AnalysisTrace` (`buildapp.analysis-trace` 1.0.0) is written on every
outcome: COMPLETED, FAILED and CANCELLED. Each entry has `stage`, `substage`,
`status` (PASSED / DEGRADED / FAILED / CANCELLED), duration, `counts`, and
`reasonCode` on failure. `deterministicTrace` drops the timings so two runs
can be compared.

Post-fix Rarytasy (`post-fix/analysis-trace.json`):

```
ACQUIRING_SOURCE        FETCH                  PASSED    17.5 s  37 assets, 43 variants, 7 HTTP_STATUS, 5 BYTE_IDENTICAL
CLASSIFYING_SOURCES     ROLES                  PASSED            35 drawings
EXTRACTING_OBSERVATIONS OBSERVATIONS           PASSED    86.4 s  35 frames, 1183 observations, 726 relations
EXTRACTING_OBSERVATIONS METRIC_EVIDENCE        PASSED   112.4 s  123 chains, 83 callouts, 147 evidence, 3 datums, 4 scales refused
REGISTERING_VIEWS       PLAN_READ              PASSED            4 plan frames, 1 read, 0 skipped
REGISTERING_VIEWS       PLAN_DECOMPOSITION     PASSED            9/80 chains, 2.7579 cm/px, 20×9 grid, 152 cells, 126 enclosed, 2 built, 2 masses
REGISTERING_VIEWS       STRUCTURAL_LAYOUT      PASSED            STRUCTURAL_LAYOUT_ACCEPTED, 2 roofs
REGISTERING_VIEWS       PLAN_REGISTRATION      PASSED            1/1
REGISTERING_VIEWS       ELEVATION_REGISTRATION PASSED            4/4, ridge datum
SOLVING_TOPOLOGY        TOPOLOGY               PASSED            2 masses, 20 partitions, 9 rooms, 1 recess
SOLVING_METRICS         METRICS                PASSED     7.5 s  14 openings, 2 terraces, 1 chimney
BUILDING_MODEL          EMISSION               DEGRADED          135 commands; 1 opening fitted, 1 dropped (named)
BUILDING_MODEL          SEAL                   PASSED            10 unresolved
COMPILING_SCENE         COMPILE                PASSED            110 meshes, 316 230 B
VERIFYING               REPLAY                 PASSED            135 commands
VERIFYING               CLOSURE                DEGRADED          5 exterior findings, 19 interior
```

The local program writes the trace to `<out>/diagnostics/trace.json` on every
run, cancelled runs included (`apps/local-analyzer/test/program.test.ts`).

## DEBUG OVERLAYS

`renderPlanOverlay(raster, plan, layer)` (`reconstruction/src/plan-overlay.ts`)
draws the plan digest over the plan itself. One PNG per layer:

- `source`: frame, size and scale
- `bands`: wall bands
- `grid`: dimension chains and grid lines
- `cells`: cells, enclosed or not
- `flood`: OUTSIDE red, RECESS amber, BUILT green
- `masses`: the bodies
- `all`: every layer together

`digest.json` holds the numbers the pictures are drawn from. Written:

- by `npm run analysis:second-house` for success and failure
  (`pre-fix/`, `post-fix/`, `phone-like-no-853-plans/` under `plan-diagnostics/`);
- as the phone bundle's `plan-overlay.png` (layer `all`, at most 1000 px) on
  every failure that got as far as a plan.

`post-fix/scene-views.png` is the compiled scene drawn by a small software
renderer from four cameras (front, right, top, axonometric): the house with
its gable and chimney, the garage protruding at the front with its door, the
two terraces.

## ANDROID FAILURE UX

The failure card (`ui/AnalyzerScreen.kt`, `analyzer/FailureDetails.kt`) shows:

- the **title** ("The floor-plan walls do not enclose a building", …) instead
  of "No model this time";
- **Stopped at**: the stage, or "Structural layout" for the plan steps;
- **Code**: the `reasonCode`, falling back to the public code;
- the counts in words, e.g. "4 floor plans found", "6 of 38 dimension chains
  read", "30 wall bands found", "no walled envelope", "7 × 4 structural grid
  lines", "0 of 18 grid cells enclosed";
- the message.

Actions:

- **Copy code** and **Show details**, which lists every diagnostic as
  `key: value`.
- **Share diagnostics**: zips the kept bundle into
  `cache/shared-diagnostics` and shares it through a non-exported
  FileProvider (`${applicationId}.diagnostics`).
- **Retry** and **Dismiss**.

Retention (`local/DiagnosticsStore.kt`):

- Before a failed job's folder is removed, only `diagnostics.json`,
  `trace.json` and `plan-overlay.png` are copied to
  `files/analyzer-diagnostics/<job>`.
- A file over 2 MB is not kept, and at most 5 bundles are.
- The bundle has no source images: sources are named by hash.

The program side bounds each file at 1.5 MB, and trims the digest first.

Local protocol **2**: `failed` carries `failure`, and terminal events name their
diagnostics files. An architecture test holds the program, the bundle and the
app to the same number. JVM tests cover the store's allow-list, the pruning,
zip, and a failed event carrying details (`LocalAnalysisTest`).

## WIDE OPENING LOGIC

The width does not decide. A gap between 3.2 and 8 m becomes a
`WideOpeningDecision` with its evidence (`infill`, `callout`, `corners`,
`pocketM2`), a score and a sentence:

- `OPENING_IN_WALL` when the wall carries on at both ends **and** either:
  - drawn line work covers ≥ 70 % of the gap, or
  - with nothing drawn, the area behind is a room: > max(6 m², 2.5 × width²).
- `OPEN_SIDE` otherwise.

A callout never shuts a gap alone. There is no global change to 3.2 m: below
it the convention stands; above it evidence decides.

## GARAGE DOOR TEST

In `wide-openings.test.ts`:

- *3. a 5.0 m double garage door*: one leaf line drawn off the grid line.
  Result: BUILT, `OPENING_IN_WALL`, infill ≥ 0.7.
- *a double garage*: piers and the door leaf across a bay mouth. Result: the
  bay is built, a second body.
- *a double garage whose door is not drawn but whose callout prints the
  mouth's width*: BUILT.
- *piers alone*: `OPEN_SIDE`.

On Rarytasy the 4.96 m garage mouth closes on drawn infill and a 500 cm
callout.

## WIDE GLAZING TEST

- *2. a 3.5 m opening with glazing drawn across*: BUILT.
- *4. a 6.0 m glazed opening*: BUILT.
- *a 7 m gap with nothing drawn across it, into the interior*:
  `OPENING_IN_WALL` by the pocket test (> 100 m² behind). H1 is chosen, and H0,
  recorded, would have built 0 cells.
- *8. two openings separated by a narrow pier* and *9. an opening near a
  corner*: BUILT.

On Rarytasy the rear 4.00 m terrace glazing closes on infill and a 410 cm
callout.

## OPEN-SIDE / CARPORT TEST

- *5. a truly open carport*: side walls with nothing across the mouth. Result:
  the bay is OUTSIDE, `OPEN_SIDE`, and the house is one body.
- *6. a loggia mouth*: returns and a back wall, nothing across. Result: a
  pocket (< 20 m²), not built, `OPEN_SIDE`. The same holds with a matching
  back-glazing callout.
- *7. a terrace recess at a corner*, shut on two sides: ground.
- *10. hatching and a leader line outside the walls*: the house stays one
  16 × 12 m body.

A wide opening alone never makes an interior OUTSIDE, and a true open side
stays open.

## RARYTASY POST-FIX RESULT

`npm run analysis:second-house -- --url <project> --out post-fix` on desktop
Node 22: **COMPLETED**.

- The first live run took **225.9 s**, of which acquisition was 17.5 s.
- The committed run took 196.0 s. It is the same pipeline with the page and
  drawings served from that run's byte cache (acquisition 2.3 s), so the
  sealed package is identical.
- 2 masses, 14 openings, 135 commands, 110 meshes, 2 672 triangles.
- Scene 316 230 B.
- Quality levels: L0 3 · L1 44 · L2 25.
- The model is named from its package, as the phone and the service name it:
  `m-analysis-m84f2903cb8e14`, "Dom w rarytasach 5 (G2E) (analysis)". An
  earlier run of the script used a name of its own (model `3b397be1…`); it
  was replaced so that these hashes are the phone's.

| hash | value |
|---|---|
| source package | `82a5490b763ee05244ffcf019db40276451f0a44f896a7d7ae6d365b605f19eb` |
| observation graph | `35d038fc7a4b3ea494276f1d82d7901b397b0fe4deab7047d80ae50550c19742` |
| metric evidence | `271e77c45f4197e12b81352503b1f1e7b69bc6e092b1b27c6443ecf639de6d3d` |
| candidate | `a3a220f43c7cbfec99df70b94583f0a165abd79b3718f006244134627612d14a` |
| model | `b1d6d7b7d0b7dfcd0ea57ff241b3db3289b9b1096a6200ef5848e0c291828eb3` |
| scene content | `454af53f563de5ce3342e6ad55f242df99d10e04d71b1ce4b9aa940259dd08a3` |
| scene file sha256 | `6fe9c09631eaf71e716976588f956c8c1654ea1434f12475050feef184e7fc4b` |

**Replay:** the sealed package and graph, replayed offline
(`OFFLINE=1 … --package post-fix/source-package.json --graph post-fix/observation-graph.json
--same-as post-fix/result-summary.json`), gave the same candidate, model,
scene-content and scene-file hashes in 110.0 s. The CI job runs the same check
on each fresh live run.

## POST-FIX MODEL / SCENE

- **House:** 17.21 × 8.48 m, one storey, gable roof at 30°, a chimney, 9 rooms
  (20 interior walls), 2 terraces. The section gives ridge +5.70 and eaves
  +3.24, both read through the ▽-apex reader because neither has a rule. It
  also gives the terrain −0.32, on a rule, which is no longer the floor.
- **Garage:** about 6.2 × 6.2 m, attached at the front, flat roof, a 5 m
  door.
- **Openings:** 14.
  - One was shrunk to fit its host.
  - One was dropped: it did not fit its host after shrinking. It is named in
    the emission trace and in `unresolved`.
- **Closure:** DEGRADED, with 5 exterior findings (the 03Y closure audit's
  kinds), reported and not hidden.
- **Unresolved (10):**
  - The garage's roof kind: no angle or view describes it separately.
  - Two garage rooms both read as "13": a car outline splits the garage into
    two 11.4 m² rooms, against the published 35.52 m².

## MARCÓWKI NON-REGRESSION

| check | before this stage | after | |
|---|---|---|---|
| sealed Auto v3 (`npm run reconstruct:v2:marcowki`) model | `894e50ba340990f4…` | `894e50ba340990f423d0aa09cabb98a886ff1b4f06f4f191c24e98a1712ee2b1`, 205 commands, replay byte-identical | equal |
| live URL, bundle on Node 18 no ICU vs ICU (CI run 43, the fixes included) | model `4a8e8ddca8beec99…`, scene `44cc19be80abeb23…` / `348273e191572951…` | the same | equal |
| live URL on the Android 14 emulator (CI run 43) | the same three hashes, 142–215 s | **140.6 s**, peak **1 796 MiB**, the same three hashes | equal |
| sealed Auto v3 metric evidence hash | `5f12247b…` | `5918e661c7ef…` | the only difference |

The metric evidence hash is expected to change. Two small attic copies of
Marcówki's plans had scale votes of 16.7 and 12.1 cm/px, which would make
their walls 1–3 m thick. Both are now refused ("no scale"). Neither plan was
ever the base plan, so the layout, the candidate and the model are unchanged:
the layout content differs only in the metric hash it cites. The owner's
Marcówki phone result stands.

## DESKTOP / NODE18 / ANDROID PARITY

| run | Rarytasy | Marcówki |
|---|---|---|
| desktop Node 22, sources | COMPLETED, model `b1d6d7b7…`, scene `454af53f…` / `6fe9c096…` | model unchanged (above) |
| offline replay of the sealed package | the same four hashes | (03Y2 parity gates, green) |
| bundle on Node 18.20.4, no ICU (as Android), its own live fetch | **COMPLETED: model `b1d6d7b7…`, scene `454af53f…` / `6fe9c096…` = desktop**. All 37 drawings byte-identical; only the page HTML differed (`d2f011d0…` vs `0a2f96a3…`), hence a different package and candidate (`48fee50f…`) | `4a8e8ddc…` = desktop (CI run 43) |
| Android 14 emulator, x86_64 | **`LIVE_ANDROID_ANALYSIS_PASS`** (CI run 45, production launcher, its own live fetch, package `7f7272f6…`): 186.1 s, peak 2 197 610 496 B (VmHWM). Model `b1d6d7b7…`, scene `454af53f…` / `6fe9c096…` = desktop (`post-fix/android-emulator-live.json`) | `4a8e8ddc…` = desktop (CI run 43) |
| owner's arm64 phone | **not run on this build**: the owner's check | confirmed (owner, 03Y2) |

## PERFORMANCE

| run | time | notes |
|---|---|---|
| Rarytasy desktop, Node 22, live | 225.9 s | acquisition 17.5, observations 86.4, printed numbers 112.4, reconstruction 9.2, compile 0.06, verification 0.28 s |
| Rarytasy desktop, Node 22, bytes cached | 196.0 s | acquisition 2.3, observations 83.4, printed numbers 101.4, reconstruction 8.6 s |
| Rarytasy desktop, offline replay | 110.0 s | no fetch; observations and numbers re-read |
| Rarytasy bundle, Node 18 no ICU, pre-fix | 279.7 s | failed at BUILDING_MODEL |
| Rarytasy bundle, Node 18 no ICU, post-fix, live | **284.0 s** | acquisition 14.8, observations 72.7, printed numbers 188.2, reconstruction 8.0, compile 0.06, verification 0.26 s |
| Rarytasy desktop, CI runner, live (run 45) | 175.1 s | the sealed evidence replayed in 79.9 s |
| Rarytasy bundle, Node 18 no ICU, CI (run 45) | 234.6 s | |
| **Rarytasy on the Android 14 emulator** (run 45) | **186.1 s** | fetch 15.8, drawings 49.3, printed numbers 115.5, solve 5.2, compile 0.1, verify 0.2 s |
| Marcówki emulator (CI run 43 / run 45) | 140.6 s / 157.0 s | printed numbers 108.8 / 126.4 s |
| owner phone, Rarytasy, 03Y2 build | 20.1 s | failed at REGISTERING_VIEWS |

Reading printed dimensions and callouts is still the largest cost, as 03Y2
found. This stage added the plausibility test (one band survey per plan) and
the apex search (only where a level symbol has no rule). Neither is visible in
the totals.

## MEMORY

| run | peak RSS |
|---|---|
| Rarytasy bundle, Node 18 no ICU, pre-fix | 1 992 491 008 B (VmHWM) |
| Rarytasy bundle, Node 18 no ICU, post-fix | **2 085 548 032 B** (VmHWM). The heap is 120 MB and the array buffers 435 MB, mostly the callout reader's render cache, as in 03Y2 |
| Rarytasy bundle, Node 18 no ICU, CI (run 45) | 2 031 616 000 B |
| **Rarytasy on the Android 14 emulator** (run 45) | **2 197 610 496 B** (2 096 MiB) |
| Marcówki emulator (CI run 43 / run 45) | 1 796 / 1 789 MiB |
| owner phone, Rarytasy, 03Y2 build | about 248 MB (it stopped early) |

The diagnostics add at most 3 × 1.5 MB on disk per failed run on the program
side, and 5 bundles of at most 3 × 2 MB on the app side.

## CI

`.github/workflows/buildapp-ci.yml`:

- **Core / Analyzer / Reconstruction:** typecheck, the full test suite
  (108 files, 1 380 tests, 5 skipped), architecture tests (including
  `second-house.test.ts` and the protocol equality test), the service bundle
  and HTTP smoke, the web build, the Marcówki audits, no-reference,
  analyzer-v2 gates, no-benchmark, v2 evaluation, and exterior closure.
- **Local analyzer / Node 18 parity** and **APK size + emulator**:
  - unchanged gates;
  - the emulator now also runs the second project live (`SECOND_LIVE_URL`,
    report `live-second-house`, advisory like Marcówki's).
- **Android / APK:** JVM tests, the preview APKs, and signer and permission
  checks.
- **Second house / generalization** (new, artifact
  `second-house-generalization`):
  1. The live URL through the production pipeline must **complete**. A
     publisher outage is a warning, not a pass.
  2. The run's own sealed evidence must replay offline to the same four
     hashes.
  3. The pre-fix evidence through today's solver must fail as
     `RECONSTRUCTION_FAILED / PLAN_LAYOUT_REJECTED`.
  4. The committed post-fix evidence replays to the committed hashes. This
     check is advisory: the images are not committed.
  5. The APK's bundle on Node 18 without ICU must reach the desktop's hashes.
- **Android / direct APK (preview-latest)** (new).

Runs:

- Run 42 (`a69af63`): all green.
- Run 43 (`7cfc534`): red on one step, Typecheck. A test fixture passed a
  `raw` field that `PublishedArea` does not have. Fixed in `4bc8178`. Every
  other job in run 43 was green, including the live Marcówki runs above.
- Run 44 (`4bc8178`): all 8 jobs green.
- **Run 45** (`b89928c`, id 36274668305): **all 10 jobs green.**
  - **Second house / generalization** (all five checks required, and all five
    passed):
    1. Live on the runner: COMPLETED in 175.1 s with a fresh package
       `81945f2a…`, model `b1d6d7b7…`, scene `454af53f…` / `6fe9c096…`.
    2. The offline replay gave the same four hashes (79.9 s).
    3. The pre-fix evidence gave `RECONSTRUCTION_FAILED / PLAN_LAYOUT_REJECTED`
       in REGISTERING_VIEWS / STRUCTURAL_LAYOUT.
    4. The committed evidence replayed to the committed hashes, candidate
       `a3a220f4…` (79.4 s).
    5. The bundle on Node 18 without ICU matched the desktop's model and
       scene: 234.6 s, peak 2 031 616 000 B.

    Artifact `second-house-generalization` (id 10916477182).
  - **APK size + emulator:**
    - fixture: every desktop hash;
    - cancel during download and during compute;
    - live Marcówki: 157.0 s, 1 789 MiB, model `4a8e8ddc…` = desktop;
    - live Rarytasy: 186.1 s, 2 096 MiB, `LIVE_ANDROID_ANALYSIS_PASS`, model
      `b1d6d7b7…` = desktop.
  - **Node 18 parity:** fixture parity; Marcówki live on Node 18 with and
    without ICU gives the same model and scene.
  - **Core / Analyzer / Reconstruction**, **Android / APK**,
    **Browser / Playwright**, **Analyzer API / container** and **deploy**
    (skipped without credentials, as before), **Dependency security**: green.
  - **Android / direct APK (preview-latest)**: green (below).

## APK

The Android job builds the preview APKs with the embedded analyzer. They are
signed with the committed preview key (so they install over earlier previews),
with versionCode = 1000 + run number, which only goes up. At run 45:

- The arm64-v8a APK with the embedded analyzer is 29 957 746 B. The same
  commit without it is 11 935 293 B, so the analyzer adds 18 022 453 B:
  - `libnode.so`: 17 077 722 B compressed;
  - `analyzer.mjs`: 462 638 B compressed (1 520 921 B).
- versionCode **1045** (versionName `0.45.0-preview`).
- Signer certificate SHA-256 `6e48fac4afaa3d70e70de5bc608aa4c4194206a9e6bc993dab56382b921ca0da`,
  the committed preview key.
- Permissions: INTERNET only, plus AndroidX's own not-exported receiver
  permission, checked in CI.
- JVM tests green. The FileProvider is not exported.

## DIRECT APK ASSET

**Published.** GitHub prerelease **`preview-latest`**
(https://github.com/damiankrok/BuildApp/releases/tag/preview-latest), asset
**`BuildPlan-Preview-arm64.apk`**:

https://github.com/damiankrok/BuildApp/releases/download/preview-latest/BuildPlan-Preview-arm64.apk

- It is the APK itself, `application/vnd.android.package-archive`, not a zip.
- At run 45 it was 29 957 746 B, SHA-256
  `9531790183f3731510262bc3dc6e692261f2d9d96bfedd89ff1d628dd15809fd`,
  versionCode 1045, from `b89928c`. `VERSION.txt` sits beside it.
- The `preview-release` job re-creates it on every push to this branch or
  `main`:
  - from the APK the Android job built and verified;
  - with `permissions: contents: write` for that job only;
  - with the same key, so a later build installs over an earlier one.
- The link never changes. The commit carrying this report publishes the same
  code with the next versionCode.
- `DIRECT_APK_ASSET_BLOCKED_BY_GITHUB_PERMISSION` did **not** occur.

## KNOWN LIMITATIONS

- **Two houses are not generality.** The analyzer is now proven on two
  single-family houses from one publisher. That is all this stage claims.
- **The phone's own failure is explained by a hypothesis**, which has not
  been observed: missing 853 px plans. If the phone again receives only the
  small renderings, this build fails with a **named** code
  (`PLAN_NO_WALLED_ENVELOPE`) and a shareable bundle, **not** with a model.
  - On the 550 px rendering, the chains that are read are one room's, and the
    far walls are drawn with window gaps. A generic "walls connected to the
    framed ones" extent rule was tried in this stage. It did not reach the far
    walls, so it was reverted rather than kept as a speculative change.
- **Garage width:** it reads 0.5–0.7 m short of 6.88 m on its right side. A
  thin chain line at px 402 beats the wall band's line at about 420 in
  `thinLines`.
- **Garage rooms:** the garage splits into two "13" rooms along a car outline.
- **The garage roof kind** is unresolved: flat by default, and reported.
- **Wide-opening constants:** 8 m, 0.7 infill and the 2.5 × width² pocket
  test are conventions, named and tested, not measured laws.
- **Closure findings:** 5 exterior findings remain on the second house.
  03Z's interior work is deferred.
- **Memory:** Rarytasy peaks at about 2.1 GB on Android against Marcówki's
  1.8 GB, the callout reader's render cache again. A phone that runs Marcówki
  with little to spare may run short on Rarytasy. The bundle would then show
  the process stopping, not an analyzer code.

## NEXT STEP

1. **Owner:** the phone checklist below. Install from the direct link and run
   Rarytasy, then Marcówki. A completed Rarytasy run with the hashes above
   makes this stage PASS. A failed one returns a shareable bundle that names
   the missing link.
2. If the phone confirms the missing-plans hypothesis: a source stage for what
   the phone downloads, and a small-rendering plan reader held to both houses'
   gates.
3. **03Z** stays deferred until this gate closes. It is **not** started
   here.

## OWNER PHONE CHECKLIST

1. Install **BuildPlan-Preview-arm64.apk** from https://github.com/damiankrok/BuildApp/releases/download/preview-latest/BuildPlan-Preview-arm64.apk. It installs over
   the current preview (same signing key, a higher versionCode).
2. Analyzer → **Local**. Paste
   `https://www.archon.pl/projekty-domow/projekt-dom-w-rarytasach-5-g2e-m84f2903cb8e14`
   and start.
3. **If it completes:** the model opens by itself. Check two bodies (house
   with a gable and chimney, a flat-roofed garage in front with a wide door).
   Send **Diagnostics → Hashes**:
   - Model `b1d6d7b7d0b7…`
   - Scene content `454af53f563d…`
   - Scene file `6fe9c09631ea…`

   Also send the time and the peak memory from **Local runs on this phone**.
   These are the hashes the APK's own bundle produced on Node 18 without ICU.
   They can differ only if the publisher changed a drawing.
4. **If it fails:** the card now shows a title, **Stopped at**, **Code** and
   counts. Tap **Copy code** and send it. Then tap **Share diagnostics** and
   send the zip: trace, diagnostics and plan overlay, with no source images.
5. Run **Marcówki** once more. Expected model `4a8e8ddca8be…`, scene
   `44cc19be80ab…` / `348273e19157…`. This build must not change it.
6. Optional: the phone model and its RAM.
