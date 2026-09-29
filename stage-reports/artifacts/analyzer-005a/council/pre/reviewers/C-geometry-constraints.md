# Council C — Geometry / Constraint Solver Architect — pre-audit report (BUILDPLAN-ANALYZER-005A)

Repo `/home/user/BuildApp` @ `7cd8e0c` (read-only). All `path:line` are under `packages/reconstruction/src/` unless stated.
Evidence used: the sealed artifacts under `scratchpad/before/*` and `stage-reports/artifacts/analyzer-005a/before/*` (digests, metric evidence, traces), the brief's replay facts, and two throw-away scripts of mine in `scratchpad/council/c-work/` (digest-only arithmetic; nothing from the repo was imported or executed). Everything marked **PREDICTION** was not run through the production harness.

---------------------------------------------------------------------------------------------------

## 0. Role answer (short)

1. **The pipeline decides five things exactly once and never re-opens them**: which plan copy (`layout.ts:246` `break`), which extent (`plan-decomposition.ts:699-815`), which scale (one pooled vote per frame, `source-metrics/src/chains.ts:620-630`, with OCR *rewritten* toward the winner at `chains.ts:780`), which tiling of BUILT cells (`mergeRegions`, `:1543`), and which bodies survive (`MIN_MASS_WALL_FRACTION`, `layout.ts:151,895`). Then one terminal gate converts any disagreement between that single chain and one published number into "the decomposition is not of this building" (`layout-gate.ts:150`, `plan-diagnostics.ts:106-109`).
2. **The brief's hypothesis is only half right.** "One copy + one extent + one scale + one merge + a terminal footprint gate" *is* the architecture, but the two OWNER failures do **not** share a cause. Kosaćce (phone) has the *correct* extent and *correct* scale; it dies on **merge + wall-fraction cliff + terminal gate** (149.4 m² body at 30 % walled is dropped wholesale, 33.15 m² remain). e-OZE dies on the **extent** in all three copies that exist (chain strip 68 px / 94 px / 220 px against a 341 px wall box), and the very next lock-in behind it is the **scale** (+23 %). Fix one and the next serial lock-in surfaces: that is the whack-a-mole the OWNER describes, and it is predictable from the code.
3. **The cheapest generic remedy is not "tune"; it is a bounded resolver** that keeps the incumbent path bit-for-bit, and only when today's pipeline would have stopped generates ≤ 24 evidence-motivated decompositions (copy × extent × scale; merge/face variants are post-processes of one decomposition), scores them cheaply, fully composes the top 4, and accepts only with a bucketed footprint agreement **plus** independent corroboration, otherwise `PLAN_RESOLUTION_INCONCLUSIVE` with attempted / best / hard violations / conflicts / missing evidence. Measured layout-stage cost today: 269–784 ms per full `composeStructuralLayout` on desktop (`analysis-trace.json`, `PLAN_READ` durations: e-OZE 269, Kosaćce 629, G2E 730, Marcówki 784), i.e. < 0.3 % of the 250–340 s run; the resolver is affordable even at 5–8× phone slowdown provided masks/bands are cached per copy.
4. **Biggest danger of the resolver itself**: selecting among 24 candidates on *one* published number. With w = ±6 % windows the chance that some candidate lands in "AGREES" by luck is 1−(1−w)^n (illustratively 70–98 % for n = 8–24 distinct outlines). Acceptance therefore has to demand independent corroboration and a bucket margin; candidates must be *generated from drawing evidence only* (never solved for P); only integer budgets, no clock.

---------------------------------------------------------------------------------------------------

## 1. Q1 — Terminal gates: audit and verdict on the brief's hypothesis

### 1.1 Terminal points, in pipeline order

| # | Terminal point | Where | What it destroys | Should become |
|---|---|---|---|---|
| T1 | first copy with an extent wins, no fallback after `decomposePlan` | `layout.ts:194-246` (`ordered` DIMENSIONED-first, then pixel area, then id; `read = true; break`) | every other copy (4 exist for Kosaćce, e-OZE; 8 frames for Marcówki) | candidate axis; `NOT_DECODABLE` stays a skip |
| T2 | `planExtent` → per-axis widest READ chain; wall "vote" clipped by `margin = 0.35` and blind to a band's own extent | `plan-decomposition.ts:699-727, 774-815` (`near` at :791-798, `held >= loose` at :805) | the true wall box when the only READ chain on an axis is a detail chain | candidate axis (`CHAIN_RECT` vs `WALL_MASS_CLUSTER`) |
| T3 | `inside` band filter + `walledEnvelope` null + early return | `plan-decomposition.ts:1206-1230` (axis inside extent **and** ≥ 60 % of run inside), `:859`; `layout.ts:775` `if (!envelope || !base.registration) return {...empty, base}` | all long walls outside the extent; no grid, no cells, no masses | candidate-invalid (next candidate), never terminal |
| T4 | one pooled scale, OCR corrected toward it | `source-metrics/chains.ts:620-630, 780`; `registration.ts:70-115` (seed-by-inlier-COUNT, per-axis fits) | the minority readings that carry the true scale (kept only as `alternatives`) | scale hypotheses from sealed `alternatives` |
| T5 | `mergeRegions` largest-first, one tiling | `plan-decomposition.ts:1543-1607` | a house whose largest rectangle swallows a line-closed terrace | merge axis (`WALLED_FIRST`) |
| T6 | `MIN_MASS_WALL_FRACTION = 0.35` per merged body, no re-tiling, no remainder classification | `layout.ts:151, 888-905` (after `planBodies` at :801) | whole 149 m² bodies; the drop becomes only an `AMBIGUOUS` gap | score + demote to RECESS/ZONE with the existing wrap tests |
| T7 | `FOOTPRINT_AREA_WRONG` BLOCKING at > 20 %, `layoutRefused` | `layout-gate.ts:145-150`; `plan-diagnostics.ts:106-109`; wired at `v2/reconstruct-v2.ts:221` | the whole run, on a single aggregate; **skipped entirely when the publisher prints no footprint** (`published && builtArea > 0`) | candidate score bucket; refusal only when *every* candidate is refused |
| T8 | `STRUCTURE_SILHOUETTE_DISAGREES` BLOCKING but not in the refusal set | `structural-audit.ts:201-204`; `plan-diagnostics.ts:106` | nothing: layout is sealed `STRUCTURAL_LAYOUT_REJECTED` yet the run continues as `DEGRADED` (two truths for "rejected") | DEGRADING + score term |
| T9 | `planFailureOf` ladder | `plan-diagnostics.ts:70-104` | reports only the FIRST missing link of the ONE candidate | diagnostic of the best candidate inside `INCONCLUSIVE` |
| T10 | `worldFrameFrom` / `masses.length === 0` | `v2/reconstruct-v2.ts:210-215`; `v2/frame.ts:55` | — | stays hard per candidate |

### 1.2 `planFailureOf` ladder audit (what each rung really tests)

Order: `PLAN_NOT_FOUND` (planFrames = 0) → `PLAN_NOT_DECODABLE` → [all skipped] `PLAN_NO_WALLED_ENVELOPE` if any skipped plan had long bands else `PLAN_NO_WALL_BANDS` → `PLAN_NO_MASSES` (no base) → `PLAN_NO_DIMENSION_FRAME` (`!base.registration`) → `PLAN_NO_WALL_BANDS` → `PLAN_NO_WALLED_ENVELOPE` (`!decomposition.envelope`) → `PLAN_GRID_EMPTY` (<2 lines/axis) → `PLAN_NO_ENCLOSED_CELLS` → `PLAN_NO_BUILT_REGIONS` (all regions < 0.35 walled) → `PLAN_NO_MASSES`.
Problem: the rung `PLAN_NO_WALLED_ENVELOPE` for e-OZE says "the long ones inside the frame … do not span a box on both axes" while the digest's own band list contains the four outer walls (V at x = 84.5 and 785, H at y = 246.5 and 568.5). The *cause* is the extent, not the walls: an algorithm artifact reported as a property of the source.

### 1.3 Confirm / refute from code and sealed artifacts

| Link in the brief's chain | Kosaćce AREA_TABLE-only (phone) | e-OZE (all 853 copies; 550 copy) |
|---|---|---|
| one copy per storey | **Contributory**: phone had 1 of 4 copies (why: upstream, not established). With 853 DIMENSIONED alone → COMPLETED (`only-dim853`). | **Contributory**: phone had only AREA_TABLE; on desktop the DIM copy fails identically. |
| one extent | **Refuted as cause**: extent 46–742.5 × 179.5–703 px is right (brief (a)). | **Confirmed, decisive** on 3/3 copies: DIM 853 extent y 286.5–355 (68.5 px; the only READ V chain has ticks 286.5/316.5/355, 100 cm); AREA 853 extent y 298–392 (94 px); 550 copy extent y 154.6–374.9 with envelope y 161–368 while long H axes run to y = 523. Walls at y = 246.5/568.5 (bounds 237–256, 559–578) fail `inside` because their axis is outside the extent; V walls at x = 84.5/785 (y 257–558, 301 px) fail the 60 % run test (68.5/301 = 23 %). `planExtent`'s vote cannot rescue it: `near` y-range is ±24 px, so the H walls never become candidates, and V bands are tested by their x-axis only (`within`, :785) although they run 4.4× beyond the chain box. |
| one scale | **Refuted as cause**: 2.4057 cm/px (AREA) vs 2.4058 (DIM). | **Confirmed, next in line**: 2.5016 cm/px is a pooled vote (by my count of the sealed segments and their alternatives: 8 spans land near 2.4–2.6 cm/px, 4 near 2.19–2.22; the vote itself is not sealed in the evidence); **7 of the 9 READ/CORRECTED segments on the DIM copy are `CHAIN_CORRECTED`** (`metric-evidence.json`); the outer 720 px chain's reader first read "1601" (implies 2.2236) and the solver "endorsed" "1801" (2.5014). Sealed alternatives keep it: `1601→2.224, 1603→2.226`. With the wall-mask extent, 720 × 322 px at 2.5016/2.5974 gives 150.6 m² (+23 %) → `FOOTPRINT_AREA_WRONG`. |
| one region merge | **Confirmed, decisive** (see 1.4). | not reached (single body). |
| terminal footprint gate | **Confirmed**: converts a fixable tiling into "not of this building" (79.8 % off). | would refuse at +23 %; at the right scale but axis-snapped edges it is −6.1 % → only `FOOTPRINT_AREA_NEAR` (DEGRADING), i.e. the gate would *not* refuse. |

**Verdict**: PARTIALLY CONFIRMED. The architectural diagnosis (single answer per stage + terminal aggregate gate) holds; the *same-cause* claim is refuted. Kosaćce = merge/wall-cliff; e-OZE = extent then scale then axis-vs-face. Neither is a "gate too strict" problem in isolation: raising the 20 % refusal to 25 % would let e-OZE at +23 % through as PARTIAL with a wrong building.

### 1.4 Evidence for the merge lock-in (my digest arithmetic; wall-only coverage recomputed from digest bands)

Script `scratchpad/council/c-work/walledfirst.js` recomputes wall-only edge coverage from the digest's bands and grid (no crossing-wall segments, no thin-line closure), then enumerates all BUILT-cell rectangles. My coverage differs from the production values by ~5–10 pp (Kosaćce: mine 30/45/40 % vs 29/40/36 %; G2E garage: mine 25 % vs production ≥ 35 % — production accepts it), so treat results as *feasibility*, not as a result.

| Case | Incumbent tiling (largest-first) → kept after the 0.35 filter | Walled-first greedy (largest-area rectangle whose own perimeter is ≥ 0.35 walled; remainder demoted) | Published |
|---|---|---|---|
| Kosaćce AREA 853 (phone case) | 149.4 m² @30 % **dropped**, 23.9 + 9.4 = **33.3 m²** (−79.8 %) | 129.4 (46–650.5×333–703) + 32.2 (157.5–520.5×179.5–333) + 9.4 = **171.0 m²** (+4.0 %) — the 32.2 over-reaches the true 24.6 by one terrace column | 164.47 |
| Kosaćce DIM 853 (accepted) | 129.5 + 24.6 + 8.9 (+3.2 sliver @18 %) | **identical** 129.5 + 24.6 + 8.9 = 163.0 (the sliver is refused by both) | 164.47 |
| Marcówki (accepted) | 99.5 + 31.1 | identical | 131.16 |
| Rarytasy 5 G2E (accepted) | 148.1 + 38.3 | 148.1 + 16.2 (my coverage of the garage 25 % < production's) — moot, incumbent runs first, but shows a real risk for small attached bodies near the cliff | — |

Sensitivity of the one free parameter on the phone case (τ): 0.25 → 182.7 (+11 %, same as incumbent tiling), **0.30–0.35 → 171.0 (+4.0 %)**, 0.40 → 161.6 (−1.7 %), 0.45 → 150.5 (−8.5 %). Two elaborations I tried — per-side wall floors (0.15/0.25/0.35) and greedy "peel un-walled fringe" — produced worse tilings (125.3 / 110 / 66.9 m², i.e. −24 % to −59 %, cutting the main body) → **do not add sub-heuristics**; keep τ = the incumbent's 0.35 (not tuned) and let the candidate score decide.

---------------------------------------------------------------------------------------------------

## 2. Q2 — The smallest bounded multi-hypothesis resolver

### 2.1 Design constraints derived from the code

* `composeStructuralLayout` is called **once** in `v2/reconstruct-v2.ts:205`; everything after (`worldFrameFrom`, `planFrameV2`, `T`, interior, openings) consumes only `draft` + `layout`. So the resolver can wrap exactly that call and hand back a `(draft, layout)` pair; downstream stays unchanged.
* `StructuralLayoutOptions.frameFilter` already restricts frames (`layout.ts:117`); *plan-copy candidates need no new option*.
* The scale enters not only metres but **thresholds**: `maxOpeningPx = 3.2 m / mpp`, `maxWidePx = 8 m / mpp`, `minCellPx = 0.45 m / mpp` (`plan-decomposition.ts:1223,1244-1248`), `wallM`. A scale hypothesis therefore needs a *re-decomposition*, not a re-scaling of rings.
* `axisLadder` (`layout.ts:558-697`) pins spans **longest-first from chain statements regardless of `mpp`**, resolving conflicting statements by `evidenceIds.length` then `chainId.localeCompare` (`:615`), and `CHAIN_CORRECTED` values are read from evidence. A scale hypothesis that does not also filter/replace those statements is overridden by the ladder (the outer 1801 would keep 720 px = 18.01 m).
* Existing precedent for this style: `alignPlans` (`layout.ts:346`) is already "a discrete search over a handful of named hypotheses … scored", emitting `considered[]`, `margin` and an `AlternativeGroup`. The schema already carries unused slots for exactly the conflicts we need: `LayoutConflict.kind ∈ {CHAIN_DISAGREES_WITH_CONTOUR, SCALE_DISAGREEMENT, VIEW_DISAGREEMENT}` (`structural-layout.ts:346-351`) — **never emitted anywhere in `packages/reconstruction/src`** (grep).

### 2.2 Types (new file `plan-resolution.ts`; pure, deterministic, no I/O, no clock)

```ts
export const RESOLVER_BUDGET = { copies: 4, decompositions: 24, stage2: 4 } as const   // integers only — never wall-clock

export type CopyRef = { frameId: string; annotation: string; sizePx: { width: number; height: number } }

export type ExtentHypothesis =
  | { kind: 'CHAIN_RECT' }                                              // planExtent(): the incumbent
  | { kind: 'WALL_MASS_CLUSTER'; openPx: number; joinPx: number }        // open ink mask at round(0.3·wallPx); 8-conn components;
                                                                        // join comps with bbox gap ≤ 8·wallPx; largest ink-area cluster's box

export type LatticeAnchor = {
  evidenceId: string; chainId: string; axis: 'X' | 'Y'; pixelSpan: number
  firstReadCm: number        // the reader's FIRST reading, recovered from evidence.alternatives / provenance.detail
  usedCm: number             // what the pooled-scale solver put on the segment
  substitutions: number      // characters changed by the correction
}
export type ScaleHypothesis =
  | { kind: 'REGISTRATION' }                                            // metrics.coordinateRegistrations, as today
  | { kind: 'LATTICE'; cmPerPx: number; isotropic: true;                // one scale for both axes (a sheet is scaled uniformly)
      anchors: LatticeAnchor[]; refuted: string[] }                     // evidenceIds of statements it contradicts by > 3 % (+tolerancePx/pixelSpan)

export type MergeHypothesis =
  | { kind: 'LARGEST_FIRST' }                                           // mergeRegions today
  | { kind: 'WALLED_FIRST'; minWallFraction: number }                   // = MIN_MASS_WALL_FRACTION (0.35), not tuned
export type FaceHypothesis = 'AS_GRIDDED' | 'OUTER_FACE_FOR_BAND_ONLY_SIDES'

export type PlanHypothesis = {
  id: string                    // stableId('plan-hyp', { frameId, extent.kind, scale key (cm/px to 1e-4 | 'REG'), merge.kind, faces })
  copy: CopyRef; extent: ExtentHypothesis; scale: ScaleHypothesis; merge: MergeHypothesis; faces: FaceHypothesis
  departures: number            // number of non-incumbent axes; the incumbent is 0
}

export type HardViolation =
  | 'NO_ENVELOPE' | 'GRID_EMPTY' | 'NO_WORLD_FRAME' | 'NO_BODY'
  | 'DEGENERATE_GEOMETRY'        // NaN/∞, area ≤ 0, a side < 4·wallPx or < 1 m
  | 'MASS_OVERLAP'               // > 0.5 m²  (layout-gate.ts:124)
  | 'OUTSIDE_SHEET'              // ring beyond raster bounds by > 2·wallPx
  | 'ANISOTROPY'                 // > 1.15 (alignPlans maxAnisotropy, layout.ts:346)
  | 'WALL_THICKNESS_IMPLAUSIBLE' // outside 0.15–0.7 m — today silently replaced by CONVENTIONS at v2/reconstruct-v2.ts:230

export type FootprintBucket = 'AGREES' | 'NEAR' | 'WRONG' | 'UNKNOWN'   // ≤ 6 % | ≤ 20 % | > 20 % | no published figure (layout-gate.ts:148-150)
export type Corroboration = 'CROSS_COPY' | 'ELEVATION_ASPECT' | 'WALL_COVERAGE' | 'ISOTROPY' | 'CALLOUT_WIDTHS' | 'PROJECTION_AUDIT'
export type Score = {
  hard: HardViolation[]
  gateRefusals: string[]                  // stage 2: LAYOUT_REFUSAL_CODES minus FOOTPRINT_AREA_WRONG
  footprint: { areaM2: number; publishedM2?: number; residual?: number; bucket: FootprintBucket }
  refutedShare: number                    // Σ pixelSpan of chain statements the hypothesis contradicts ÷ Σ pixelSpan of all stated spans
  wallCoverage: number                    // Σ long-band length on/inside the accepted outline ÷ Σ long-band length inside the wall cluster
  droppedM2: number                       // demoted area (RECESS / ZONE / named gap) — never counted as built
  isotropy: number                        // min(mppX, mppY) / max(mppX, mppY)
  corroboration: Corroboration[]
  outlineKey: string                      // union of accepted rings rounded to 0.1 m: dedupe key
}
export type PlanResolution =
  | { kind: 'INCUMBENT'; draft: StructuralLayoutDraft; layout: StructuralLayoutHypothesisSet }   // untouched objects
  | { kind: 'RESOLVED'; draft: StructuralLayoutDraft; layout: StructuralLayoutHypothesisSet; chosen: Ranked; considered: RankedSummary[]; departures: string[] }
  | { kind: 'INCONCLUSIVE'; failure: ReconstructionFailure; considered: RankedSummary[] }        // code PLAN_RESOLUTION_INCONCLUSIVE
```

Consumption points (all optional, `undefined` ≡ today): `StructuralLayoutOptions.plan?: PlanHypothesis` read in `readPlans` (extent + registration override; frame restriction via existing `frameFilter`), `decomposePlan` option `merge`, `axisLadder` option `statementFilter/override` (replace `valueOf` for re-read ids, drop refuted statements), and ring construction in `inferStructuralLayout` (`:888-905`) for `OUTER_FACE_FOR_BAND_ONLY_SIDES`.

### 2.3 Control flow

```ts
// v2/reconstruct-v2.ts:205 (replaces the single compose call; everything after it is unchanged)
const first = composeStructuralLayout(structuralOptions)                 // today's call, byte-identical
const resolved = resolvePlan(structuralOptions, first)
if (resolved.kind === 'INCONCLUSIVE') { trace({ substage: 'PLAN_RESOLUTION', status: 'FAILED', … }); throw resolved.failure }
const { draft, layout } = resolved                                        // INCUMBENT: the same objects as `first`

export function resolvePlan(o, first): PlanResolution {
  // 0. incumbent gate — exactly today's continue condition
  if (worldFrameFrom(first.draft) && first.layout.masses.length > 0 && !layoutRefused(first.layout)) return { kind: 'INCUMBENT', ...first }
  // 1. sheets: ≤ 4 decodable ground copies (frameFilter), mask+bands+wallPx computed ONCE per copy and cached
  // 2. enumerate ≤ 24 DECOMPOSITIONS = copy × extent × scale, fixed order, dominance-pruned:
  //      copy   : DIMENSIONED first, then pixel area desc, then id (today's order)
  //      extent : CHAIN_RECT, then WALL_MASS_CLUSTER (only if its box differs from the chain box by > 1 wall thickness on some side)
  //      scale  : REGISTRATION, then ≤ 2 LATTICE (only when ≥ 1 long stated span was CHAIN_CORRECTED or the registration's anisotropy > 1.03;
  //               candidates = implied cm/px of first-reads and sealed alternatives of spans ≥ 15 % of the extent, clustered ±3 %, ranked by
  //               zero-substitution support then span-weighted support)
  //    merge (2) × faces (2) are POST-PROCESSES of one decomposition (cell classes + ring arithmetic): ≤ 96 scored outlines, 0 extra flood fills
  // 3. stage 1 per decomposition: readPlans(h) + planBodies + perimeterWallEvidence + ring/area/footprint bucket + wall coverage + refutedShare
  //    (NO roofs, NO alignment, NO audit)
  // 4. rank; dedupe by outlineKey; keep top K = 4 distinct outlines
  // 5. stage 2: composeStructuralLayout({...o, plan: h}) — the unchanged production code — then add gateRefusals, projection audit, corroborations
  // 6. accept or INCONCLUSIVE (2.5)
}
```

### 2.4 Ordering / tie-break (lexicographic on buckets — no weighted sum)

1. `hard.length` ascending.
2. `gateRefusals.length` ascending (stage 2; everything in `LAYOUT_REFUSAL_CODES` except the footprint code).
3. `footprint.bucket`: AGREES < UNKNOWN < NEAR < WRONG. **Within a bucket the residual decides nothing** (0.5 % and 4 % are both "AGREES") — this is what stops decimal-chasing of the published figure.
4. `refutedShare` bucketed to 0.05, ascending.
5. `wallCoverage` bucketed to 0.05, descending; then `corroboration.length` descending.
6. `departures` ascending (Occam: the incumbent and single-axis flips beat multi-axis flips on equal evidence).
7. `id` lexicographic (deterministic).
No float compare crosses a bucket boundary that is not already a constant in today's code (0.06, 0.20, 0.35, 0.62, 1.15).

### 2.5 Acceptance / `PLAN_RESOLUTION_INCONCLUSIVE`

Accept the best candidate `B` iff **all**: (a) `hard = ∅`, `gateRefusals = ∅` after stage 2; (b) `bucket = AGREES`, or `NEAR` with ≥ 1 corroboration, or `UNKNOWN` (no published figure) with ≥ 2; **never `WRONG`**; (c) the best *distinct-outline* runner-up is strictly worse on tuple steps 1–5, or its outline agrees within 3 % area (same building read twice). Corroborations (independent of the published figure): `CROSS_COPY` (another copy of the same storey, compared in normalised sheet coordinates, agrees within 5 % on W and D), `WALL_COVERAGE ≥ 0.8`, `ISOTROPY ≥ 0.97`, `CALLOUT_WIDTHS` (confident OPENING_CALLOUT widths matching wall gaps under the hypothesised scale; today 3/6/11/7 confident callouts on e-OZE/Kosaćce/G2E/Marcówki base frames), `ELEVATION_ASPECT` (`registerElevationV2` `anisotropyCheck` ≤ 0.45 m on a *traced* silhouette only — see M7), `PROJECTION_AUDIT` (`STRUCTURE_PROJECTS`).
A RESOLVED result is never silent: gate reasons `NOTED PLAN_RESOLVED_BY_HYPOTHESIS` (departure list), `DEGRADING PLAN_RESOLUTION_SINGLE_CORROBORATION` when only one corroboration or when the plan role that normally carries dimensions was absent, a `SCALE_DISAGREEMENT` conflict (magnitude = ratio of the two scales, `evidenceIds` = refuted statements) and an `AlternativeGroup` ("which reading of the plan") with the top-4 and `margin`. All of these exist in the schema; no version bump.
`INCONCLUSIVE` carries flat diagnostics: `attempted` (decompositions / distinct outlines), `bestId`, `bestBucket`, `bestResidualPct`, `hardViolations` (codes), `strongestConflicts` (top 3, e.g. `SCALE 2.5016 vs 2.2236 (+12.5 %)`, `FOOTPRINT +23 % at chain scale / −6 % at lattice scale`, `COPY 550 vs 853 disagree 2×`), `missingEvidence` (e.g. `no DIMENSIONED plan copy (roles present: AREA_TABLE)`, `no READ dimension on the depth axis`, `no published footprint`), plus the best candidate's `plans` digest so the overlay can be drawn. First-link codes (`PLAN_NOT_FOUND`, `PLAN_NOT_DECODABLE`, `PLAN_NO_WALL_BANDS`, `PLAN_NO_DIMENSION_FRAME` when *no* copy yields any scale) remain for cases where no candidate can be generated at all.

### 2.6 K, N and cost

* **N = 24 decompositions, K = 4 full compositions.** 4 = the maximum copies observed per storey and = once-per-axis flips; stage-2 cost is one `composeStructuralLayout` (269–784 ms desktop, measured incl. mask+bands+decompose+roofs+audit+gate). Worst-case bound (no caching) = 24 × 0.63 s ≈ 15 s desktop; realistic 3–6 s with per-copy caching and no roofs/audit in stage 1. At 3–8× phone slowdown that is ≤ 25–120 s **worst case** — the resolver must record its own counters (`decompositions`, `outlines`, `stage2`, ms) as a trace substage so the UI never shows a silent phase. Memory: 4 copies × (raster 2.9 MB + mask 0.7 MB + bands) ≪ the 1.2–2.2 GB peak of the observation stage.
* Predicted candidate counts (PREDICTION): e-OZE ≈ 4 copies × 2 extents × 2–3 scales = 16–24 decompositions → ≤ 96 outlines; Kosaćce area-only ≈ 1 copy × 1 extent × 1 scale → 1 decomposition × 2 merges.

### 2.7 Byte-identity of the three accepted houses (Marcówki, Rarytasy 5 G2E, clean Kosaćce)

1. The incumbent runs first through **unchanged code** (`options.plan === undefined`); every new parameter defaults to today's behaviour and no default value is materialised into hashed structures.
2. `resolvePlan` returns the *same objects* when today's continue condition holds. All three have `gate = STRUCTURAL_LAYOUT_ACCEPTED` with **no** non-NOTED reasons (`analysis-trace.json` `STRUCTURAL_LAYOUT` events), so even a "resolve on DEGRADING footprint" extension would not fire.
3. Resolver output enters the sealed layout only on the resolved path (`alternatives`, `conflicts`, `gate.reasons` are hashed by `structuralLayoutContentHash`, `layout-gate.ts:230-254`; an *empty* group must not be added). `PlanDiagnosticsReport.resolution?` is an optional additive field, emitted only when the resolver ran.
4. Test: golden `layout.contentHash`, model hash and scene hash of the three houses (model `6152770f…`, `5b5ffcf1…`, scene `d4e7249b…`) before/after; `resolvePlan(...).kind === 'INCUMBENT'` with `===` identity; mutation test that flipping any resolver constant leaves these hashes unchanged. Caveat: if `SOLVER_VERSION`/analyzer version participates in the model hash, bump it only if the OWNER accepts a hash change (I did not verify where the version enters the hash).

### 2.8 PREDICTION table for the two OWNER failures (unverified by the harness; numbers are the brief's replay figures or my digest arithmetic)

| Case | Candidates that matter | Footprint / bucket | Outcome |
|---|---|---|---|
| Kosaćce AREA-only (phone) | incumbent (largest-first) | 33.3 m² −79.8 % WRONG | rejected |
| | walled-first (τ 0.35), extent/scale unchanged | ≈171 m² +4.0 % AGREES (digest approximation) | accepted only with ≥ 2 corroborations (WALL_COVERAGE, ISOTROPY 2.4057/2.4067 hold); RESOLVED with DEGRADING "limited copies" (DIMENSIONED role absent, 4 chains read) → "Model gotowy z ograniczeniami", not silent |
| e-OZE 853 DIM or AREA | chain rect | no envelope | invalid |
| | cluster @ registration 2.5016 | 150.6 m² +23 % WRONG | rejected |
| | cluster @ lattice 2.2236, axes | 114.6 m² −6.1 % NEAR | runner-up |
| | cluster @ lattice, outer faces (16.0 × 7.58) | 121.4 m² −0.6 % AGREES | chosen if a 2nd corroboration exists (the brief measures the cluster body's perimeter as 77 % walled; my `WALL_COVERAGE` ≥ 0.8 and `ISOTROPY` — which needs the lattice applied to both axes — are unmeasured here) else PARTIAL with DEGRADING `PLAN_RESOLUTION_SINGLE_CORROBORATION` |
| Marcówki / G2E / Kosaćce DIM | incumbent | ACCEPTED | resolver never runs |

### 2.9 Critique of the design as posed

**Missing (each named with evidence)**
* **M1 — copies are witnesses, not only alternatives.** Normalised-sheet agreement across copies is an independent check. e-OZE implied cm per *sheet width*: 400 px copy 1.5252×400 = 610; 550 px 2.222×550 = 1222; 853 pair 2.5016×853 = 2134 (lattice 1896). The two small copies read garbage ("1011" for the outer 464 px chain; `metric-evidence.json`), so they refute nothing about 853 — but they must be *down-weighted by reading quality* (text height), or they will vote. Kosaćce 853 pair agrees to 0.004 %.
* **M2 — printed opening-callout widths are an unused, independent scale family** (counts above). They live in `planCallouts` (`layout.ts:262`) and are used only for wide-gap weighing.
* **M3 — published room areas** (the AREA_TABLE copy prints them; `publishedRooms` reach `reconstruct-v2.ts:544` but only as post-hoc QUALITY) are the strongest late check on scale + tiling; needs room polygons, so a **stage-3 / post-interior** demotion signal, not a stage-1 term.
* **M4 — upper-storey coupling.** `alignPlans` builds `stated.k` from the *two registrations' mpp ratio* (`layout.ts:~383`); if only the base gets a hypothesised scale the ratio is off by exactly the hypothesis ratio and still passes the isotropy guard. The scale override must apply to the whole sheet family or `stated` must be dropped for resolved runs (the `fitted` scale candidate would remain).
* **M5 — no published footprint** (`layout-gate.ts:145`): the incumbent gate has *no* independent check then; e-OZE-like wrong-scale plans would be ACCEPTED silently on a non-ARCHON page. The resolved path needs a NOTED `NO_INDEPENDENT_FOOTPRINT_CHECK` and the ≥ 2-corroboration rule.
* **M6 — provenance laundering.** `masses[].widthM.basis = 'MEASURED'` and `evidenceIds` come from `axisLadder` stated spans (`layout.ts:943-957`). A statement re-read under a hypothesis must become `DERIVED` with the alternative reading's evidence id, or the ledger claims a printed number the sheet does not print.
* **M7 — elevation aspect is not always usable.** For e-OZE the four sealed elevation SILHOUETTE polygons all span 1279×630 px of a 1280×631 image (aspect 2.03 for all four), i.e. they trace the render's whole canvas; count `ELEVATION_ASPECT` only when `buildingExtent(...).traced` is true.
* **M8 — progress/observability**: emit a `PLAN_RESOLUTION` substage with counts; digest must draw all K candidates and mark bands excluded by `inside` (today a band outside the extent is silently absent from the decomposition, though listed in the digest).
* **M9 — face/axis basis is mixed in the incumbent** (see F5); the resolver should offer the correction as a hypothesis (hash-preserving), and the OWNER should decide separately whether to fix it in the incumbent.

**Dangerous**
* **D1 — selection on the answer.** Candidates must be generated from drawing evidence only. Forbidden generators: solving scale/extent so that area = P; "calibrate to room areas" (the analogue of the repo's own rule against fitting to areas). Record `selectedBy: 'PUBLISHED_FOOTPRINT_BUCKET'` in the trace when no corroboration separates candidates.
* **D2 — chance agreement grows with n.** P(at least one of n independent outlines in ±6 %) = 1−(1−w)^n; with w ≈ 0.15 (12 % window over an 80 % spread): n = 8 → 73 %, n = 24 → 98 % (illustrative). Hence: evidence-motivated generation only (lattice scales only when a contradiction exists; wall cluster only when its box differs), dedupe by outline, bucket-level ordering, corroboration + margin required.
* **D3 — five distinct projects cannot calibrate anything.** (Marcówki, Kosaćce, e-OZE, G2E, alt-Marcówki, all ARCHON but one.) Every threshold in the design is inherited from today's constants (0.06/0.20/0.35/0.62/1.15/0.5 m²); none is fitted. Any new constant needs a structural justification, not a benchmark.
* **D4 — nondeterminism across devices.** No wall-clock budgets (a slower phone would return a different answer), no `Map`-order-dependent ties, ids from `stableId`, floats through `round6` as today; results must be identical on Node 18 arm64 and Node 22 x64.
* **D5 — a wrong RESOLVED looks as good as a right one.** Hence DEGRADING when corroboration = 1, the labelled hypothesis in the UI, and INCONCLUSIVE rather than "best guess" when margins are absent.
* **D6 — later stages can still kill the winner** (interior, openings, `WALLS_OVERLAP` at `model/src/topology.ts:523`, wall-topology). Keep runners-up alive: a stage-3 preflight of the winner through `v2/wall-topology.ts` (dry-run) and fall through to the next of K; otherwise a wrong layout merely moves the failure downstream where it is harder to read.
* **D7 — more knobs, worse tilings.** The two walled-first elaborations I tried degraded results by 24–59 % (1.4). Keep the merge axis to two members.
* **D8 — mixing hypotheses per storey** (e.g. base by lattice scale, upper by registration) yields a building that exists on no sheet; the hypothesis is per *sheet family*.

---------------------------------------------------------------------------------------------------

## 3. Q3 — Hard vs soft; honest partial

### 3.1 Must stay hard (per candidate; and re-checked at acceptance)

| Validator | Where | Why hard |
|---|---|---|
| no world frame / no envelope / no base storey / `masses = 0` | `v2/frame.ts:55`, `layout.ts:775`, `layout-gate.ts:113` (`NO_MASS`, `NO_STOREY`) | nothing to register against; the candidate does not exist |
| degenerate / negative geometry (NaN, area ≤ 0, inverted min/max, side < 4·wallPx) | `plan-decomposition.ts:859`; `model/src/validate*.ts` (`DEGENERATE_WALL`, `MALFORMED_POLYGON`) | canonical invariants; never trade for a score |
| `MASS_OVERLAP` > 0.5 m² | `layout-gate.ts:124` | two bodies cannot occupy one plan; evaluate at *acceptance* on the chosen candidate, and as a hard flag in stage 1 |
| `WALLS_OVERLAP` | `model/src/topology.ts:523` (`WALL_OVERLAP_AREA_LIMIT`) | canonical model law; a stage-3 dry-run through `v2/wall-topology.ts` keeps it from becoming a *late* failure |
| anisotropy > 1.15, non-positive scale | `layout.ts:346` | uniformly scaled sheet |
| wall thickness outside 0.15–0.7 m | `v2/reconstruct-v2.ts:230` | **today soft-masked** (silently substituted by `CONVENTIONS.wallThickness`): make it a hard violation for a candidate |
| ring outside the sheet | new | geometry from no pixels |

### 3.2 Should become score / late validation

`FOOTPRINT_AREA_WRONG` (bucket; refuses a *candidate*, refuses the *run* only if every candidate is refused), `MIN_MASS_WALL_FRACTION` (score `wallCoverage` + demotion instead of a per-body cliff), `PLAN_NO_WALLED_ENVELOPE` / `PLAN_GRID_EMPTY` / `PLAN_NO_ENCLOSED_CELLS` (candidate-invalid), `STRUCTURE_SILHOUETTE_DISAGREES` (DEGRADING + score; today BLOCKING-but-ignored), `planFailureOf` ladder (diagnostic of the best candidate).

### 3.3 How an honest partial is represented (no schema bump)

* Accepted bodies → `FootprintRegionHypothesis kind BUILT`. Demoted cells of a rejected rectangle are **re-classified by the existing wrap tests** in `decomposePlan` (≥ 2 non-opposite built sides → `RECESS`, whose own docstring lists "a covered terrace", `structural-layout.ts:116-120`; else `ZONE`/`OUTSIDE`) rather than left as a bare `AMBIGUOUS` gap. Clean Kosaćce already carries 3 RECESS regions, so the downstream machinery exists.
* `unresolved` gaps `AMBIGUOUS` for what neither classification explains; recommended: an *area-explained* soft rule — if `built + Σ area(demoted) ∈ ±6 %` of the published figure, the layout is PARTIAL with an explicit open question, not refused.
* `alternatives`: "which reading of the plan" (top-4, chosen, margin). `conflicts`: `SCALE_DISAGREEMENT`, `CHAIN_DISAGREES_WITH_CONTOUR` (both declared, never emitted today).
* Gate: `STRUCTURAL_LAYOUT_PARTIAL` via DEGRADING `PLAN_RESOLUTION_SINGLE_CORROBORATION` / `FOOTPRINT_AREA_NEAR`. Mass quantities `basis = 'DERIVED'` (not `MEASURED`) for re-read statements.
* **A partial omits, it never invents**: a candidate with a hard violation or bucket `WRONG` is not a partial — it is `PLAN_RESOLUTION_INCONCLUSIVE` with the candidate drawn in diagnostics only.

---------------------------------------------------------------------------------------------------

## 4. Q4 — Single-hypothesis lock-in points and cheap top-N options

| # | Lock-in | Where | Evidence dropped | Families that break | Cheap top-N? |
|---|---|---|---|---|---|
| L1 | plan copy | `layout.ts:194-246` | 3 of 4 copies (Kosaćce, e-OZE), 6 of 8 frames (Marcówki) | any project whose first-ranked copy is the poorer sheet, or where role bytes are missing on the device | **Yes**: `frameFilter` per copy; cache mask/bands; ≤ 4 |
| L2 | ink mask threshold | `layout.ts:205` `adaptiveInkMask(inkChannel(raster), {})` | faint / low-contrast plans | scans, low-res copies (550/400 px) | Later: 2 thresholds, cost ×2 mask; not evidenced in the 6 cases → INSTRUMENT |
| L3 | wall thickness | `bandWallThickness` (median, two-pass: survey 6–40 px, then 0.45–1.9 wallPx) | plans mixing 0.2 m and 0.4 m walls | thin/thick mixes | No (derived once; keep) |
| L4 | orientation | bands are VERTICAL/HORIZONTAL only | angled / bay walls | any non-rectilinear plan | Out of scope; name it (ASSUMP-ORIENTATION-001) |
| L5 | extent | `plan-decomposition.ts:699-815` | wall box beyond a detail chain | e-OZE (3/3 copies) | **Yes**: `CHAIN_RECT` vs `WALL_MASS_CLUSTER` (one mask opening + CC; sub-100 ms) |
| L6 | scale | pooled vote `chains.ts:620-630`, `CHAIN_CORRECTED` `:780`; per-axis fits `registration.ts:70-115` | minority readings (sealed as `alternatives`) | e-OZE (+12.5 % scale), alt-Marcówki 550 px (registered 1.5915 cm/px gives 19.56 m² against 131.16 published, a 2.6× linear discrepancy; the same house's ARCHON 853 px sheet registers at 2.6426 cm/px ≈ 4.1 cm/px at 550 px — same-crop assumption, not verified) | **Yes** from sealed evidence (no re-OCR): ≤ 2 lattice scales |
| L7 | X/Y scale independence | `registration.ts:123-160` (anisotropy 1.038 e-OZE 853, 1.064 e-OZE 550) | isotropy prior (three different tolerances exist: none / 1.15 `alignPlans` / 1.03 `planFrameByOuterFaces`) | one-anchor axes | Yes: isotropic variant of each scale |
| L8 | grid lines | `gridLines` :354-475 + `thinLines` :477 (min gap 0.45 m) | lines outside extent ± 5 px are dropped (:393,:410); lines closer than 0.45 m collapse | narrow piers/recesses; wrong extent | No |
| L9 | dimension interpretation | `axisLadder`: longest statement first; conflicts by evidence count then chainId string (`layout.ts:615,649`) | contradicting statements are only mentioned in `why`; no conflict emitted | any plan with a misread outer chain | **Yes**: statement filter by scale hypothesis |
| L10 | enclosure closure | `closureThreshold` 0.62; H0/H1 only | wall-only reading (covered terraces drawn by a thin outline) | Kosaćce (terrace closed by a 18 px+ thin line ⇒ BUILT) | Yes: third reading "H2 wall-only" or the post-hoc demotion of 3.3 |
| L11 | wide-opening closure | `collinearWideGaps` (3.2 m / 8 m, infill 0.7, pocket limit max(6, 2.5w²)); `baysOf` | per-gap binary decision | garages, loggias, glazed walls | Partially: already H0/H1 |
| L12 | envelope pre-seed | `walledEnvelope` (:827-880) + flood pre-seed (:1290-1310) | everything outside long-band axes is "outside by construction" | wings faced by piers, conservatories | Follows L5 |
| L13 | region merge | `mergeRegions` largest-first | alternative tilings | Kosaćce AREA | **Yes**: walled-first post-process |
| L14 | body union | `planBodies` wallShare 0.5, rectangular test | L-shapes stay separate | — | No |
| L15 | body admission | `MIN_MASS_WALL_FRACTION` 0.35 cliff | 149 m² dropped at 29 % | glazed/open houses | Yes: score + demotion |
| L16 | face vs axis | `walledEnvelope.snap` :843-855 and grid at band axes | half a wall per band-only outer side | e-OZE: 114.6 vs 121.4 m² at the right scale | **Yes**: face hypothesis (ring arithmetic only) |
| L17 | base plan / storey alignment | `chooseBasePlan` :309; `alignPlans` 9 offsets × ≤ 2 scales → best only | runners-up beyond `considered[]`; conflict only if margin < 0.1 **and** different coverage | multi-storey with ambiguous stacking | No (already discrete, reported) |
| L18 | elevation side | `views.ts:264` "takes the first free one" when both walls of an axis are free | arbitrary tie | symmetric plans | Instrument; not in scope |
| L19 | datum-only storeys | `structural.ts:76-100`: only `tallest` gains the storey | which body reaches it | multi-body houses with a section-only upper floor | Named conflict exists; keep |
| L20 | front = sheet bottom | `v2/frame.ts:55-80` `frontSide: 'SHEET_BOTTOM'` | orientation of the sheet | plans drawn with the entrance elsewhere | Instrument (corroborated only by elevation labels) |
| L21 | roof kind per mass | `roof-systems.ts` via `structural.ts:122` (not audited in depth) | alternative roof forms | hipped/complex roofs | out of my scope |

---------------------------------------------------------------------------------------------------

## 5. Function capability inventory

Cost column: measured whole-`composeStructuralLayout` wall time on desktop Node 22 (269 / 629 / 730 / 784 ms for e-OZE / Kosaćce / G2E / Marcówki from `PLAN_READ` trace durations; not separately profiled per function).

**`plan-decomposition.ts`**

| Field | `gridLines` (:354) | `thinLines` (:477) | `wallIntervals`/`lineIntervals`/`closureOf` (:497,:573,:643) |
|---|---|---|---|
| in → out | chains, inside-bands, extent → `linesX/linesY` with support | lines → lines | mask, bands, line → per-edge `EdgeClosure{wall,line,opening,closure}` |
| det. | yes | yes | yes |
| assumptions | witness lines on wall faces, band axes at centres; chain of larger span wins a band | a line within 0.45 m of a better one is the same line | a thin continuous line ≥ 18 px is a closure; a hole ≤ 3.2 m between two pieces of one wall (jambs ≥ 0.5 wallPx) is shut |
| thresholds | snapPx 5; minBandCoverage 0.18; claim windows max(5,0.75t)/max(5,0.35t); confidence 0.95/0.8/0.75/0.5/0.6; drops lines outside extent ± 5 | minCellM 0.45; probeGap wallPx | tol max(4,0.6wallPx); lineTol max(3,0.35wallPx); minLinePx 18; maxOpeningM 3.2 |
| consumed / ignored | chain ticks with `valueCm`, band axes+bounds / anything outside extent, chains with no value | support, probes / — | bands, mask ink / band crossing segments only via `segments` |
| alternatives | none | none | none |
| failure codes | `PLAN_GRID_EMPTY` (via size) | same | — |
| alt hyp? | no | no | no |
| cost | small | small | scans mask per grid line; recomputed per undecided wide gap (`edgesFor`) |
| genericity risk | MEDIUM (extent-dependent; mixed face/axis basis) | LOW | MEDIUM (thin outline = wall for a terrace) |
| rec | INSTRUMENT (emit per-line support type) | KEEP | INSTRUMENT + wall-only reading (H2) |

| Field | `dimensionedExtent` (:699) / `planExtent` (:774) | `walledEnvelope` (:827) | `decomposePlan` flood/H0/H1/pocket (:1193-1530) |
|---|---|---|---|
| in → out | chains, bands, wallPx → one `PixelRect` + `weak` | long bands + lines → box snapped to grid | mask, chains, bands, registration, extent → cells, regions, hypotheses |
| det. | yes | yes | yes |
| assumptions | widest READ/CORRECTED chain per axis is the building; walls within ±35 % of it vote | box = long-band axes ± wallPx/2, snapped to nearest grid line within wallPx (undoes the half-wall for band-only lines) | outside = beyond envelope or reachable through open edges; H1 adds drawn wide openings |
| thresholds | floor 0.5·min read span; margin 0.35; long ≥ 2.5 wallPx; `held ≥ loose` | min box 4 wallPx; snap radius wallPx | closureThreshold 0.62; `inside`: axis in extent and ≥ 60 % of run in extent (:1206-1214); RECESS needs ≥ 2 non-opposite built sides; pocket limit max(6, 2.5w²) |
| consumed / ignored | chain READ segments, band axes / band extent along its own axis; text; other chains | band axes / ink | chains, bands, ink, callouts / room text, published areas |
| alternatives | none | none | H0/H1 only |
| failure codes | `NO_EXTENT` skip → `PLAN_NO_WALLED_ENVELOPE` | null → `PLAN_NO_WALLED_ENVELOPE` | `PLAN_NO_ENCLOSED_CELLS`, `PLAN_NO_BUILT_REGIONS` |
| alt hyp? | no | no | yes (H0/H1, within-plan) |
| cost | trivial | trivial | dominant part of the ~0.3 s |
| risk | **HIGH** (e-OZE 3/3 copies) | **HIGH** (e-OZE −6.1 %) | MEDIUM |
| rec | REPLACE with hypotheses (CHAIN_RECT + WALL_MASS_CLUSTER) | REFACTOR (face hypothesis) | KEEP + INSTRUMENT (excluded bands) |

| Field | `collinearWideGaps`/`baysOf` (:995,:1054) | `mergeRegions` (:1543) | `planBodies` (:1636) |
|---|---|---|---|
| in → out | mask, bands, lines, callouts → wide-gap decisions / bays | cells → maximal rectangles per class | regions → bodies (union when < 0.5 wall between and rectangular) |
| det. | yes | yes (ties by position/id) | yes |
| assumptions | > 3.2 m gap is an opening only with drawn infill ≥ 70 % (callout recorded, not decisive) | biggest rectangle first is right | no wall drawn between = one body |
| thresholds | maxOpeningM 3.2; maxWideOpeningM 8; minInfill 0.7 | area-by-sheet order | wallShare 0.5 |
| ignored | callout as sole evidence | wall fraction of the rectangle | walls inside a body |
| alt hyp? | no | no | no |
| risk | MEDIUM | **HIGH** (Kosaćce AREA) | MEDIUM |
| rec | KEEP | REFACTOR (add `WALLED_FIRST`) | KEEP |

**`layout.ts`**

| Field | `readPlans` (:177) | `chooseBasePlan` (:309) | `axisLadder` (:558) |
|---|---|---|---|
| in → out | graph, metrics, rasters → 1 `PlanReading` per storey | plans → one base | lines, chains, evidence → metres per line, `span()` |
| det. | yes | yes | yes |
| assumptions | DIMENSIONED first, then bigger; first with an extent wins | registration 2, envelope 2, extent not weak 1, band length/2000 ≤ 1.5, GROUND 0.75, −2·rmsM | stated spans longest-first fix lines; the rest interpolate at `mpp` |
| thresholds | survey bands 6–40 px, len ≥ 24; second pass thickness 0.45–1.9 wallPx, len ≥ max(8, 1.6 wallPx) | as listed | tolerance max(2, wallPx/2); agreed ±2 cm |
| ignored | other copies; roles' bytes missing on device are not surfaced | — | contradicting statements (only in `why`); alternatives |
| failure codes | `NOT_DECODABLE`, `NO_EXTENT` skips → `PLAN_NOT_DECODABLE`/`PLAN_NO_WALLED_ENVELOPE`/`PLAN_NO_WALL_BANDS` | `PLAN_NO_MASSES` | — |
| alt hyp? | no | no | no |
| risk | **HIGH** | MEDIUM | **HIGH** (conflict resolution by evidence count then hash string) |
| rec | REPLACE by candidate enumeration | KEEP (per candidate) | REFACTOR (statement filter/override) |

| Field | `perimeterWallEvidence` (:710) | `inferStructuralLayout` (:755) | `zonesOutsideEnvelope`, `recessesOf`, `assignRoles`, `attachmentsBetween`, `facadesOf` |
|---|---|---|---|
| in → out | region, decomposition → walled fraction | options → draft (storeys, masses, regions, alignments, conflicts) | bodies → zones, recesses, roles, contacts, facades |
| det. | yes | yes | yes |
| assumptions | wall counts only where the *edge's total closure* ≥ 0.62 (discontinuity: wall 0.6 / closure 0.6 counts 0) | one base, one tiling, rectangular masses | MAIN = highest storey span then area; ATTACHED iff touching (tol 0.5 m); contact tol max(0.05, wallM) |
| thresholds | 0.62 | `MIN_MASS_WALL_FRACTION` 0.35 (:151,:895); upper coverage share ≥ 0.5 (:~975) | — |
| alt hyp? | no | no (alignment considered[] reported) | no |
| failure | — | `PLAN_NO_MASSES`, gaps | — |
| risk | MEDIUM | **HIGH** (cliff without fallback) | LOW/MEDIUM |
| rec | INSTRUMENT | REFACTOR (score + demotion) | KEEP |

**Other files**

| File:symbol | in → out | thresholds / assumptions | ignored | alt hyp? | failure codes | risk | rec |
|---|---|---|---|---|---|---|---|
| `structural.ts:53` `composeStructuralLayout` | options → `{draft, layout, projection}` | datum-only storeys go to `tallest` (:76-100) with a conflict if > 1 mass; roofs after masses | published areas except footprint; rooms | no | via gate | MEDIUM | KEEP as stage 2 |
| `layout-gate.ts:104` `evaluateLayoutGate` | masses, regions, published → gate | overlap > 0.5 m²; footprint 6 % / 20 %; second view max(0.25 m, 2 %) | roof area, floor area, volume, height, rooms | no | `FOOTPRINT_AREA_WRONG`, `MASS_OVERLAP`, `NO_MASS`, `NO_STOREY` | **HIGH** (single aggregate; skipped if absent) | REFACTOR: bucket + candidate-level |
| `layout-gate.ts:230` `structuralLayoutContentHash` | draft → hash | hashes alternatives/conflicts/gate codes | prose | — | — | LOW | KEEP (constrains byte-identity) |
| `structural-audit.ts:126` `auditStructuralProjection` | masses, roofs → per-view residuals | tolerance 0.6 m; BLOCKING > 2.4 m; elevation scale fitted to the massing so extents agree by construction | overall extents | no | `STRUCTURE_*` | MEDIUM | KEEP; DEGRADING + score |
| `plan-diagnostics.ts:23,70,106-124` | draft → digest / first-failed-link / refusal | refusal set = {FOOTPRINT_AREA_WRONG, MASS_OVERLAP, NO_MASS, NO_STOREY} | excluded bands; other copies | no | 11 plan codes | MEDIUM | REFACTOR (candidate diagnostics) |
| `failure.ts` | codes, `planCounts` | `PLAN_NO_WALLED_ENVELOPE` conflates two causes | — | — | all | MEDIUM | add `PLAN_RESOLUTION_INCONCLUSIVE`; split envelope code |
| `v2/frame.ts:55,83` `worldFrameFrom`, `planFrameV2` | draft → world frame | front = sheet bottom; z mirrored about `zFlip` | orientation evidence beyond labels | no | — | MEDIUM | KEEP; instrument |
| `v2/frame.ts:186,243` `outerWallFaces`, `planFrameByOuterFaces` | raster → outer faces → storey frame | luma < 90; coverage 0.15; anisotropy ≤ 1.03 | — | no | — | MEDIUM | reuse idea for face correction |
| `v2/frame.ts:313` `registerElevationV2` | silhouette, world, ridge datum → registration | `err ≤ 0.9 m` | — | 2 span candidates (side views) | undefined → gap | MEDIUM | expose `err` as score |
| `v2/reconstruct-v2.ts:205-226` registration phase | options → throw or continue | `T` 0.15–0.7 m else CONVENTIONS (:230) | — | no | codes above | HIGH (single compose) | REFACTOR (resolver call) |

---------------------------------------------------------------------------------------------------

## 6. Assumption register

Format: current behaviour · why · evidence basis · families that violate it · hard/soft · decision.

* **ASSUMP-SOURCE-001** One plan copy per storey; DIMENSIONED first, then pixel area. · avoid double counting · `layout.ts:194-246` · e-OZE/Kosaćce when the first copy is poor or only the AREA copy survives (phone) · soft · **branch candidate**.
* **ASSUMP-IMAGE-001** A single adaptive ink mask; walls are the runs of thickness 0.45–1.9× the survey median. · determinism · `layout.ts:205-219` · faint scans, 550/400 px copies · soft · keep, INSTRUMENT.
* **ASSUMP-ORIENTATION-001** All walls are axis-aligned bands. · simplicity · `Band.axis` VERTICAL/HORIZONTAL only · angled/bay/curved plans · hard today · keep, name it (unimplemented semantic).
* **ASSUMP-SCALE-001** One pooled scale per frame; OCR rewritten toward it (substitution price 0.45, tick swallowing 0.7). · a drawing has one scale · `chains.ts:620-630, 662-780` · e-OZE: 7/9 segments corrected; the alternative 2.2236 kept only as `alternatives` · soft · **branch candidate**.
* **ASSUMP-SCALE-002** X and Y are fitted independently and anisotropy is tolerated (no gate). · one measured axis suffices · `registration.ts:123-160` · e-OZE 1.038 (853), 1.064 (550) from a single Y anchor · soft · branch (isotropic variant); unify the three tolerances (none / 1.15 / 1.03).
* **ASSUMP-SCALE-003** A scale is plausible if walls come out 0.15–0.7 m thick. · cheap · `v2/reconstruct-v2.ts:230`, `PLAN_NO_DIMENSION_FRAME` text · alt-Marcówki 550: 11 px × 1.5915 cm = 0.175 m passes the 0.15–0.7 m test although the footprint it yields is 6.7× too small in area (19.56 vs 131.16 m², i.e. ≈ 2.6× in linear scale) · hard→soft score.
* **ASSUMP-DIMENSION-001** The extent is the widest READ chain on each axis independently. · overall dimension = building · `plan-decomposition.ts:699-727` · e-OZE (720 × 68.5 px strip, aspect 10.5:1) · soft · **branch candidate**; add an aspect sanity vs the wall box.
* **ASSUMP-DIMENSION-002** Chain statements pin the ladder longest-first; conflicts resolved by evidence count then `chainId` string; no `LayoutConflict` emitted. · exactness beats scale · `layout.ts:615,649` · any plan with a misread outer chain (e-OZE: 18.01 m pinned regardless of `mpp`) · soft · refactor (statement filter/override, emit `CHAIN_DISAGREES_WITH_CONTOUR`).
* **ASSUMP-GRID-001** Grid lines exist only where a chain tick or a long band axis is within extent ± 5 px. · avoid noise · `gridLines` :393,:410 · wrong extent (e-OZE: 15×2 grid) · soft · follows extent.
* **ASSUMP-GRID-002** Lines closer than 0.45 m collapse onto the better-supported one. · thin features are noise · `thinLines` · 0.3 m piers, recess returns · soft · keep.
* **ASSUMP-GRID-003** Chain lines sit on wall faces, band-only lines on wall axes (mixed basis). · witness lines are struck on faces (comment :404-408) · `gridLines` · e-OZE: band-only outer lines under-measure by one wall thickness in total · soft · **branch candidate** (face hypothesis).
* **ASSUMP-ENVELOPE-001** Envelope = long-band axes ± wallPx/2, snapped to the nearest grid line within wallPx; both orientations must exist in `inside`. · dimension states the face to the cm · `walledEnvelope` :827-880 · band-only outer sides (snap undoes the half wall), e-OZE (no long band inside the strip) · soft · branch/refactor.
* **ASSUMP-ENVELOPE-002** Everything beyond the envelope is outside by construction (bays excepted). · stop front zones reading as rooms · flood pre-seed :1290-1310 · wings faced by piers/conservatories not seen as long bands · soft · follows the extent hypothesis.
* **ASSUMP-BODY-001** Bodies = largest-area rectangles first; merged when < 50 % wall between and the union is rectangular. · avoid slivers · `mergeRegions`, `planBodies` · Kosaćce AREA (149.4 m² incl. line-closed terrace) · soft · **branch candidate** (walled-first).
* **ASSUMP-BODY-002** A body needs ≥ 35 % of its perimeter drawn as wall (counted where the edge closure ≥ 0.62). · a kerb-ringed paving is not a house · `layout.ts:151,888-905` · glazed/open houses; 29 % dropped a 149 m² body · soft · score + demotion.
* **ASSUMP-BODY-003** Footprint kinds are BUILT / RECESS / ZONE; masses are rectangles. · schema · `structural-layout.ts:116-131` · L/T houses read as several rectangles; covered terrace on posts has no kind · soft · keep.
* **ASSUMP-ROOM-001** Rooms do not exist at layout stage; published room areas and the areas printed on the AREA_TABLE copy are not consumed by the layout gate (ledger: `IGNORED_WITH_REASON` for non-footprint aggregates, `reconstruct-v2.ts:1173`); rooms compare only post-hoc (`:544-548`). · aggregates must not derive geometry · ledger · every project (unused independent constraint) · soft · branch as stage-3 signal.
* **ASSUMP-ROOM-002** An enclosed cell is interior irrespective of content; ink density adds ≤ 0.05 confidence. · flood fill · `decomposePlan` classify · furniture-only cells indistinguishable · soft · keep.
* **ASSUMP-OPENING-001** A gap 3.2–8 m in one wall is an opening only with ≥ 70 % drawn infill, else "where the wall stops" unless the pocket test finds > max(6, 2.5w²) m² of interior behind it. · convention · `:995-1050, :1373-1405` · loggias, 6 m sliding walls without drawn leaf (Kosaćce phone: 7 wide gaps, 0 closed, all `OPEN_SIDE`, scores 0.40–0.74) · soft · keep; thresholds scale with the scale hypothesis.
* **ASSUMP-OPENING-002** A hole between two pieces of the same wall ≤ 3.2 m counts as shut. · doors/windows · `closureOf` :643 · — · soft · keep.
* **ASSUMP-OPENING-003** Any continuous thin line ≥ 18 px closes an edge. · glazed walls · `lineIntervals` :573 · terraces drawn by an outline (Kosaćce: makes the terrace BUILT) · soft · add wall-only reading.
* **ASSUMP-ROOF-001** Roofs are derived per mass after the composition; published `roof_area` (140.41 / 216.91 m²) is never used to rank layouts; `ROOF_KIND_UNKNOWN` is DEGRADING. · a roof belongs to a mass · `structural.ts:122`, `layout-gate.ts` · a wrong footprint produces a wrong roof silently · soft · branch: roof area as a stage-2 corroboration only with a roof model (not in scope).
* **ASSUMP-ELEVATION-001** The elevation scale is fitted to the massing, so extents agree by construction; only the profile shape is judged; side chosen by label or width surplus > −max(0.25 m, 4 %), else "first free one". · avoid circularity · `structural-audit.ts:80-93`, `views.ts:243-266` · symmetric plans; renders whose silhouette traces the whole canvas (e-OZE, 4/4 polygons 1279×630) · soft · keep; gate `traced`.
* **ASSUMP-ELEVATION-002** `registerElevationV2` accepts the plinth error up to 0.9 m. · loose · `v2/frame.ts:345` · — · soft · expose `err` as a score.
* **ASSUMP-TOPOLOGY-001** Exactly one MAIN mass (highest storey span, then area); others ATTACHED iff touching within 0.5 m else UNKNOWN; datum-only storeys attach to `tallest`. · deterministic roles · `layout.ts:1144-1156`, `structural.ts:76-100` · two-storey wing + one-storey main · soft · keep; conflicts exist.
* **ASSUMP-TOPOLOGY-002** Storey alignment picks one of ≤ 9 offsets × ≤ 2 scales; conflict only if margin < 0.1 and coverage differs. · discrete · `layout.ts:346-495` · look-alike bodies · soft · keep.
* **ASSUMP-TOPOLOGY-003** Front = sheet bottom (`SHEET_BOTTOM`). · published plans are drawn that way · `v2/frame.ts:55-80` · other conventions · soft · instrument.

---------------------------------------------------------------------------------------------------

## 7. Failure taxonomy contributions

| Code / gate | Class | Evidence (cases) |
|---|---|---|
| `PLAN_NOT_FOUND` | source limitation (or upstream classification) | none met |
| `PLAN_NOT_DECODABLE` | runtime / source | none met; the phone's *missing copies* are a **runtime/acquisition limitation that no code surfaces** (`run.ts`/`acquire.ts` do not say which role lost its bytes) |
| `PLAN_NO_DIMENSION_FRAME` | algorithm assumption (scale only via chain vote + wall-thickness plausibility) | risk: alt-Marcówki-type plans register at a *plausible wrong* scale instead of failing here |
| `PLAN_NO_WALL_BANDS` | source/algorithm (mask threshold) | none met |
| `PLAN_NO_WALLED_ENVELOPE` | **algorithm assumption** reported as source property | e-OZE 853 DIM / AREA / (550: different symptom); 550 & 400 copies of Kosaćce likewise (grid 5×3 / 6×3, `only-550`/`only-400`) — the code cannot distinguish "walls absent on one axis" from "extent excluded the walls" |
| `PLAN_GRID_EMPTY` | algorithm assumption (extent) | none met |
| `PLAN_NO_ENCLOSED_CELLS` | algorithm assumption (closure 0.62 / thin-line closure) or open plan | none met |
| `PLAN_NO_BUILT_REGIONS` | algorithm assumption (wall cliff) | none met (Kosaćce kept 2 of 3 regions) |
| `PLAN_NO_MASSES` | mixed | none met |
| `PLAN_LAYOUT_REJECTED / FOOTPRINT_AREA_WRONG` | **algorithm assumption** (merge + cliff) for Kosaćce; **unimplemented semantic** risk in the comparand ("powierzchnia zabudowy" definition: 163.0 m² dimensioned decomposition vs 164.47 published = −0.9 % suggests outline-of-walls, but the definition is never encoded); source limitation for alt-Marcówki (only 550 px copies; 19.56 vs 131.16 m², registered 1.5915 cm/px) | Kosaćce phone, alt-Marcówki |
| `MASS_OVERLAP`, `NO_MASS`, `NO_STOREY` | algorithm invariants (correct as hard) | none met |
| `STRUCTURE_SILHOUETTE_DISAGREES` | algorithm/source (traced polygon quality) | none met; BLOCKING yet not refusing |
| `FOOTPRINT_AREA_NEAR` (DEGRADING) | soft signal, currently unused as a search signal | e-OZE would land here at −6.1 % |
| `PLAN_STOREY_ALIGNMENT_FAILED` (trace reason, `reconstruct-v2.ts`) | algorithm | none met |
| proposed `PLAN_RESOLUTION_INCONCLUSIVE` | source limitation (evidence insufficient/contradictory) — the honest outcome for alt-Marcówki-type inputs | — |
| proposed split of `PLAN_NO_WALLED_ENVELOPE` | `PLAN_EXTENT_EXCLUDES_WALLS` (algorithm) vs `PLAN_NO_WALLS_ON_BOTH_AXES` (source) | e-OZE |

---------------------------------------------------------------------------------------------------

## 8. Top 5 findings

1. **[CRITICAL] The plan extent is a single per-axis choice that a detail chain can hijack, and three downstream filters make the mistake unrecoverable.** Evidence: e-OZE extent 720 × 68.5 px (aspect 10.5:1) on the DIM copy, 94 px on AREA, and 550-px envelope stopping at y = 368 while long H axes reach 523; `planExtent` vote clipped by `margin 0.35` and testing V bands by x-axis only (`plan-decomposition.ts:791-805, :785`); `inside` drops the H walls (axis outside) and the V walls (23 % of run inside) at `:1206-1214`; `walledEnvelope` null → `layout.ts:775` return → `PLAN_NO_WALLED_ENVELOPE`. Families: any plan whose only READ chain on an axis is interior (rotated total not read). *Smallest generic change*: an `ExtentHypothesis` `WALL_MASS_CLUSTER` beside `CHAIN_RECT` (open mask at 0.3·wallPx, cluster within 8·wallPx, largest cluster's box), consumed as a candidate; optionally make the incumbent vote use each band's own extent.
2. **[CRITICAL] One pooled scale per frame with OCR rewritten toward the winner; alternatives are sealed but never used.** Evidence: `chains.ts:620-630, 780`; e-OZE 7 of 9 read segments `CHAIN_CORRECTED`; outer chain first read "1601" (2.2236) corrected to "1801" (2.5014); +23 % footprint after the extent is fixed; `registration.ts` seeds by inlier *count*; `axisLadder` keeps pinning 18.01 m regardless of `mpp` (`layout.ts:558-649`). Families: any sheet with a misread overall dimension plus several interior dimensions that agree with the misread (alt-Marcówki 550 px: the registered scale yields a footprint 6.7× too small in area, yet the 0.175 m wall thickness passes the plausibility test). *Smallest generic change*: `ScaleHypothesis` from first-reads/sealed alternatives of long spans (≤ 2), isotropic, with a statement filter/override in `axisLadder` and provenance `DERIVED`; ranked by independent constraints, never by solving for P.
3. **[HIGH] Region merge + per-body wall-fraction cliff turns a fixable tiling into a refusal.** Evidence: Kosaćce AREA-only: 149.4 m² at 30 % dropped, 33.3 m² kept, −79.8 %; walled-first on the same digest gives ≈ 171 m² (+4.0 %), identical to the incumbent on the DIM copy and Marcówki (my approximation, PREDICTION). `layout.ts:151,888-905`; `plan-decomposition.ts:1543`. Families: houses with a covered terrace/porch/carport drawn by a thin outline; glazed houses. *Smallest generic change*: `MergeHypothesis WALLED_FIRST` (τ = today's 0.35) as a post-process of the same decomposition plus demotion through the existing RECESS/ZONE wrap tests; keep the merge axis to two members (elaborations degraded results).
4. **[HIGH] The terminal footprint gate is the only independent check, is skipped when no footprint is printed, and cannot distinguish "wrong building" from "wrong reading of this sheet".** Evidence: `layout-gate.ts:145-150`, `plan-diagnostics.ts:106-109`; `readPlans` one-copy break (`layout.ts:246`) while 4 copies exist and the phone had 1; no code surfaces which plan role lost its bytes. *Smallest generic change*: wrap the single compose call in the bounded resolver of §2 (incumbent-first, byte-identical when it continues), make the footprint a bucketed candidate score, require independent corroboration, and add `PLAN_RESOLUTION_INCONCLUSIVE` with `missingEvidence` naming absent plan roles.
5. **[MEDIUM-HIGH] Mixed face/axis basis under-measures band-only outer sides by one wall thickness in total, and the schema's conflict slots for exactly these disagreements are dead.** Evidence: e-OZE at the correct scale: 114.6 m² (−6.1 %, axes 247/569) vs 121.4 m² (−0.6 %, faces 237/578) — the difference decides AGREES vs NEAR; `walledEnvelope.snap` (:843-855) and `gridLines` (band-only lines at band axis); `SCALE_DISAGREEMENT`, `CHAIN_DISAGREES_WITH_CONTOUR`, `VIEW_DISAGREEMENT` (`structural-layout.ts:346-351`) are never emitted; `STRUCTURE_SILHOUETTE_DISAGREES` BLOCKING is ignored by `layoutRefused`. *Smallest generic change*: `FaceHypothesis OUTER_FACE_FOR_BAND_ONLY_SIDES` (outward shift by `thickness/2` of the supporting band on outer perimeter sides whose grid line has no chain support — pure geometry), and emit the two conflict kinds from the resolver.

### What would falsify the claim that the analyzer is becoming generic
The claim is falsified if **any** of the following is observed: (a) for a project with ≥ 2 plan copies, the accepted outline changes by > 3 % when copy priority is permuted or one copy is withheld (today: Kosaćce fails this — AREA-only → −79.8 %, DIM-only → accepted); (b) a fix for one project's terminal code is followed, on the *same source*, by a different terminal code (today: e-OZE `PLAN_NO_WALLED_ENVELOPE` → `FOOTPRINT_AREA_WRONG` +23 % → `FOOTPRINT_AREA_NEAR` −6.1 %, three serial lock-ins); (c) any resolver-accepted layout is separated from its runner-up **only** by the published footprint bucket (corroboration count 0) and later proves wrong; (d) the three accepted houses' layout/model/scene hashes change when the resolver is enabled; (e) results depend on device speed or enumeration order; (f) on a held-out set of ≥ 6 unseen projects, a constant introduced by this stage (rather than inherited) is needed to keep them passing — with five distinct projects in evidence, such a constant cannot be validated and must not be added.

---------------------------------------------------------------------------------------------------

## Appendix — method notes and limits

* Digest arithmetic: `scratchpad/council/c-work/walledfirst.js` (reads a sealed `digest.json`; recomputes wall-only edge coverage from bands+grid; enumerates BUILT rectangles; runs largest-first, walled-first, per-side-floor and peel variants). It omits band `segments` (crossing walls) and thin-line closure; production coverage differs by ≈ 5–10 pp in both directions (G2E garage: mine 25 % vs production ≥ 35 %).
* Not verified: (i) that the phone lost copies for acquisition reasons (out of my scope); (ii) the elevation-aspect and callout-width corroborations on e-OZE (silhouette polygons unusable; callout–gap matching not run); (iii) where the solver version enters the model hash; (iv) production costs of `decomposePlan` alone (only whole-compose durations were available).
* Sealed evidence used for the scale claims: `before/rarytasy-eoze/metric-evidence.json` (chain `chain-horizontal-699-a3d8696b1d`, evidence `metric-dimension-55ef3f8509`: `rawText "1801"`, `provenance.detail "the reader first read \"1601\"; the chain's scale endorses \"1801\""`, alternatives `1601 → 2.223611`, `1603 → 2.226389`) and the four plan copies' registrations (853 DIM 0.025016/0.025974, 853 AREA 0.025014/0.025362, 550 0.02222/0.023653, 400 0.015252/0.015266 m/px).
