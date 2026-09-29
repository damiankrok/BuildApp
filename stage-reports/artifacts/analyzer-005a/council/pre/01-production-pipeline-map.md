# 01 — Production pipeline map (BUILDPLAN-ANALYZER-005A, Council pre-audit)

Read-only audit of `analyzer/generalization-council-v1` @ `7cd8e0c` (the 004A
final code `f6b8a92` plus docs). Every path is verified in code, not taken from
a stage report. The map is organised by the strategic target the brief names
and says, for each target responsibility, which production code performs it
today, where observation and decision are mixed, where a heuristic becomes
truth too early, and where a hard gate fires before any alternative is tried.

## 0. The one pipeline and its three doors

`packages/analysis-service/src/run.ts` — `runAnalysis(input, options)` is the
only analyzer. Three callers: the phone's embedded program
(`apps/local-analyzer/src/{program,local}.ts`, Node 18.20.4 without ICU, one
process per job), the HTTP API worker (`apps/analyzer-api/src/{executor,
runner,job}.ts`, Node 22), and the CLI / CI scripts
(`packages/analysis-service/scripts/{reconstruct-v2,second-house,cross-source}.ts`).
Nine stages (`stages.ts`), weighted 0.10 / 0.01 / 0.80 / 0.01 / 0.01 / 0.02 /
0.01 / 0.01 / 0.03; the overall percent is `progressAt(stage, fraction)`.
Only one stage has countable units (`EXTRACTING_OBSERVATIONS`, per asset,
scaled to 0.65 of the stage); everything after the last drawing is read runs
with no event until the next stage boundary. `0.10 + 0.01 + 0.80 × 0.65 =
0.63` — the OWNER's frozen `63 % · etap 3 z 9 · Czytam rysunki` is the metric
pass (`extractMetricEvidence`) and it is silent by construction.

```
URL ──validateAnalysisUrl──► acquireSourcePackage ──► SourcePackage (sealed, hashed)
      security.ts (no network)   router.ts → archon.ts | generic/*   acquire.ts, hash.ts
  ──► CLASSIFYING_SOURCES (roles counted; NO_DRAWINGS / SOURCE_INCOMPLETE thrown)
  ──► analyzeSourcePackage ──► SourceObservationGraph          source-analyzer/analyze.ts
  ──► decodeImage × every asset → rasterCache (kept until the run ends)   run.ts
  ──► extractMetricEvidence ──► MetricEvidenceSet (OCR, chains, callouts, registrations)
  ──► reconstructV2 ──► composeStructuralLayout ──► inferStructuralLayout ──► readPlans
        └ decomposePlan (grid/cells/flood) → masses → roofs → §21 audit → evaluateLayoutGate
        └ layoutRefused? → PLAN_LAYOUT_REJECTED  (terminal)
        └ registration, topology, metrics, emission (wall-topology planner) → sealCandidate
  ──► compileBuilding → MobileSceneBundle → verifyReplay / round trip / closure audit
```

## 1. Target responsibility → today's code

| Target responsibility | Today's code | Verdict |
| --- | --- | --- |
| **SourcePackage** (sealed evidence of one logical project) | `source-package/src/acquire.ts` (discover → fetch+decode → group → select → roles → seal), `hash.ts` (`sourcePackageContentHash`), `cache.ts` (`cacheKeyFor = sha256(url)`), adapters `archon.ts` / `generic/*`, router `router.ts`, fence `security.ts`, `net.ts` (`safeFetch`, manual redirects, SSRF checks, 20 s timeout, 24 MB, 120 assets, UA header) | Sound acquisition. **Identity is not logical**: `canonicalUrl = page.url` (the fetched URL after redirects, query included), `pageHash` (changes on every fetch of the same page), and both are inside `pkg.id` and `contentHash`. The page's own `<link rel="canonical">` and the publisher's project code are read (`archon.ts` `projectCode`) but only the code reaches `identityOf` (`analysis-service/src/identity.ts`). Two fetches of one page never seal the same package; a tracking query changes `canonicalUrl` and the package id though the assets are byte-identical. |
| **Observations / Claims / Conflicts** | `source-analyzer/src/analyze.ts` (routing by role), `extractors/{plan,elevation,section}.ts`, `source-cv/*` (ink mask, run-length bands, straight runs, shapes), `source-observations` (graph builder, validation, hashes) | Observation-only, no metres, deterministic. Role claims come from the adapter (`archonRoleClaims`: URL slug, caption, channel, floor-fragment index `1→GROUND, 3→ATTIC`). One frame per asset; four copies of the same ground plan are four frames. |
| **Evidence graph (what the drawing STATES)** | `source-metrics/src/extract.ts` (`extractMetricEvidence`): per orthographic frame `readNumbers` (template OCR, `ocr.ts`), `findDimensionLines`, `chainsFromLines`, `solveFrameChains` (`chains.ts`: reading lattice, scale vote, `planScalePlausibility` 0.15–0.8 m), level datums, angles, callouts, `registerFrame` (`registration.ts`, seeded least squares, 3 px outlier tolerance) | Observation and DECISION are mixed here: the scale vote picks ONE `cmPerPixel` per frame (a second vote is only recorded as a gap `gap-scale-implausible`), READ vs DERIVED is decided per segment, and a plan whose vertical chains are rotated text mostly gets DERIVED segments. No progress events; 164–193 s of the 250–320 s run. |
| **Bounded candidate generation** | Not present as a layer. The nearest things: `decomposePlan` keeps exactly two enclosure hypotheses H0/H1 (`plan-decomposition.ts` ~1420–1460) and picks by `differs`; `alignPlans` scores a small target set for storey alignment (`layout.ts`); `collinearWideGaps` / `baysOf` decide each gap OPEN vs OPENING_IN_WALL; the ridge axis is a vote of apex readings (`reconstruct-v2.ts`). Everything else is single-path. | **The core gap.** Plan copy, extent, wall thickness, grid, envelope, region merge and masses are each computed once and passed on. |
| **Constraint resolver** | `layout-gate.ts` (`evaluateLayoutGate`: mass overlap, corroboration by another frame's chain, published footprint 6 % / 20 % bands, storeys, roofs) + `structural-audit.ts` (§21 projection against elevations) + `plan-diagnostics.ts` (`LAYOUT_REFUSAL_CODES = FOOTPRINT_AREA_WRONG, MASS_OVERLAP, NO_MASS, NO_STOREY`) | A **gate after a single candidate**, not a resolver over several. The independent constraints exist (footprint, second-frame spans, elevation projection) but they only accept, degrade or kill the one layout that was made. |
| **ArchitecturalSpecCandidate** | `structural-layout.ts` (`StructuralLayoutHypothesisSet`: storeys, masses, regions, recesses, attachments, roofs, facades, alternatives, conflicts, unresolved, gate) sealed by `sealStructuralLayout`; then `v2/building.ts` (`BuildingV2`) | Good data shape; only ever one instance. `alternatives` exist for storey alignment only. |
| **Semantic CanonicalBuildingModel** | `v2/emit.ts` (`emitBuilding` → DSL program), `v2/wall-topology.ts` (planner, 004A), `packages/commands` `applyCommand`, `packages/model` validators (`WALLS_OVERLAP`, junction/ring codes, hosts) | Hard validators are hard and stay so; the emitter orders commands so every prefix validates; `MODEL_EMISSION_FAILED` names the refused command. |
| **Deterministic compiler / geometry gate / renderer** | `packages/geometry` (`compileBuilding`, `geometryClosureAudit`), `packages/mobile-scene`, the Android viewer | Out of scope for 005A except as the last hard gate; unchanged. |
| **Progress / telemetry** | `stages.ts` (`AnalysisProgress`: stage, index, count, stageFraction, progress, detail), `run.ts` `report()` (monotone, drops regressions), `program.ts` (`progress` event + `elapsedMs` + `rssBytes`), `LocalAnalysis.kt` → `statusOf` → `JobStatus`, `AnalyzerScreen.kt` `JobProgress` (percent, "etap i z n", checklist) | No sub-phase, no counters other than "drawing i of n", no heartbeat, no activity time; `elapsedMs`/`rssBytes` reach the phone's `LocalRunReport` but the screen prints neither during a run. |

## 2. Where observation and decision are mixed

1. `chains.ts` `solveFrameChains`: the OCR lattice (observation) and the
   scale vote (decision) are one function; the runner-up scale is recorded
   only as prose in `unresolved`.
2. `plan-decomposition.ts` `dimensionedExtent`/`planExtent`: the longest READ
   chain per axis (observation) becomes "the plan's extent" (decision) with a
   walls vote whose search window scales with that same chain rectangle —
   a 68 px vertical chain cannot be out-voted by 300 px walls (e-OZE, §4).
3. `layout.ts` `readPlans`: the first decodable plan copy per storey
   (ordered DIMENSIONED first, then pixels) is decomposed and the loop
   `break`s; the other copies are never read, so they cannot compete.
4. `layout.ts` `chooseBasePlan`: a fixed additive score picks one base plan.
5. `decomposePlan` `mergeRegions`: largest rectangle first is a decision
   with no alternative retained.
6. `v2/frame.ts` `worldFrameFrom`: "front is the bottom of the sheet" is
   asserted, and the elevation labels are consulted only later for sides.
7. `reconstruct-v2.ts` ridge-axis vote and `roof-systems.ts` roof kind:
   a vote becomes the roof with the runner-up discarded.

## 3. Where a heuristic becomes truth too early

| Point | File | Consequence |
| --- | --- | --- |
| extent = longest READ chain per axis | `plan-decomposition.ts` `dimensionedExtent` | e-OZE: extent 720 × 68 px strip; every horizontal wall outside it; `walledEnvelope` null; run ends |
| one scale per plan from the chain vote | `chains.ts` / `registration.ts` | e-OZE: 2.50 cm/px from 9 anchors while the printed 1600 total spans 720 px (2.22 cm/px); no second scale hypothesis survives |
| one plan copy per storey | `layout.ts` `readPlans` | phone tracked Kosaćce (`planFrames 1`): the only surviving copy was decomposed as if it were the dimensioned sheet |
| the published footprint as a kill switch at 20 % | `layout-gate.ts` → `LAYOUT_REFUSAL_CODES` | a tiny layout from a bad extent is refused as "not this building" instead of ranking below the alternative that fits |
| wall thickness from the dominant band | `bandWallThickness` | every later threshold (2.5×, ×4, tolerances) inherits one estimate |

## 4. Where a hard gate fires before an alternative is attempted

- `planFailureOf` (`plan-diagnostics.ts`): `PLAN_NOT_FOUND → PLAN_NOT_DECODABLE
  → PLAN_NO_DIMENSION_FRAME → PLAN_NO_WALL_BANDS → PLAN_NO_WALLED_ENVELOPE →
  PLAN_GRID_EMPTY → PLAN_NO_ENCLOSED_CELLS → PLAN_NO_BUILT_REGIONS →
  PLAN_NO_MASSES` — a ladder of single-hypothesis failures; every rung is
  terminal, none retries with a different extent, plan copy, scale or
  decomposition family.
- `layoutRefused` → `PLAN_LAYOUT_REJECTED` (`FOOTPRINT_AREA_WRONG`,
  `MASS_OVERLAP`, `NO_MASS`, `NO_STOREY`): terminal on the one layout.
- `CLASSIFYING_SOURCES` in `run.ts`: `NO_DRAWINGS` / `SOURCE_INCOMPLETE`
  before any pixel is read — correct as a hard gate (no plan and no
  elevation means nothing to reconstruct).
- Hard gates that are right to be hard: `WALLS_OVERLAP` and every model
  validator (`packages/model`), `MODEL_EMISSION_FAILED`, `SCENE_COMPILE_FAILED`,
  `VERIFY_*`, the URL fence (`SOURCE_UNSAFE`).

## 5. Measured shape of a run (desktop, Node 22, 4 cores, 15 GB; see 07)

| case | outcome | wall | fetch | observations | metric pass (silent) | plan read | topology | metric solve | model | peak RSS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Marcówki | COMPLETED, 2 unresolved | 249 s | 2.4 s | 33 s | 193 s | 0.8 s | 1.2 s | 4.9 s | 1.0 s | 1 890 MB |
| Kosaćce clean | COMPLETED, 13 unresolved | 315 s | 3.2 s | 122 s | 164 s | 0.6 s | 1.0 s | 5.8 s | 0.6 s | 2 159 MB |
| Kosaćce tracked | COMPLETED, same model `5b5ffcf1…` | 317 s | 3.0 s | 123 s | 166 s | 0.7 s | 1.0 s | 5.6 s | 0.4 s | 2 120 MB |
| Rarytasy e-OZE | `PLAN_NO_WALLED_ENVELOPE` | 307 s | 2.6 s | 133 s | 165 s | 0.3 s | — | — | — | 2 034 MB |

The solver proper (plan read to sealed model) is 3–8 s of a 250–320 s run:
a bounded search over dozens of layout candidates is affordable; the cost
lives in reading the drawings, and that cost is reported to nobody.
