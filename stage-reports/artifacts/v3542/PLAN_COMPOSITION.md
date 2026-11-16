# v3.54.2: where plan composition loses the house once the scale is right

Read-only diagnosis of the four houses whose plan composition fails or over-extends with the correct, consultant-admitted
scale. Nothing in `/home/user/BuildApp` was edited. All experiments ran in two shadow copies of `packages/` under
`/home/user/rd/v3542/diag/shadow{,2}` (BuildApp's `node_modules` symlinked, workspace packages pointing at the copies).

## Method

- **Solver alone on the sealed evidence.** `second-house.ts --metrics <run>/metric-evidence.json --graph <run>/observation-graph.json --package <run>/source-package.json`
  replays `reconstructV2` on the evidence each run dir already holds (consulted readings and spans included). It takes
  8 to 30 s instead of about 3 min. Each unpatched replay gives the same verdict and model hash as the original run, on
  all 22 run dirs (A, A-confirm, A2, C2-art, D-art; `batch/base/summary.txt`). Examples: sp318422 `8b3fdaa8980e2071`,
  Madera stage A `12c9ace7da67f8d1`, Toreniach C2 `27dc7c8a81243305`.
- **Instrumentation** (shadow 1, behind environment variables): the ladder anchors (`DIAG_LADDER`), the extent decision
  (`DIAG_EXTENT`), a forced extent (`DIAG_FORCE_EXTENT`), and the candidate fixes (`DIAG_FIX1`, `DIAG_FIX_GLAZED`,
  `DIAG_FIX4`).
- **Clean patches** (shadow 2, no environment variables): `fix1-ladder-first-statement.patch`,
  `fix2-glazed-end-closure.patch` and `fix2-layout-gate.patch`. They apply cleanly to the current
  `packages/reconstruction/src`, `tsc` passes on the package, and 126 tests pass: `failure-codes`, `plan-resolution`,
  `shared-frame-link-f1`, `shared-map-link-f1b` and `wall-strip`.
- **Scores** come from `research/source-to-model/v3541/score_outline.py`, the frozen v3.54.1 outline metric. Numbers are
  in `results.json`.

## Summary

| House | First decision that loses it | Mechanism | Caused by the correct scale? |
|---|---|---|---|
| sp318422 | `axisLadder` pins the first chain statement unchecked. `layout.ts:1722-1724` | M1: a chain value solved at the replaced page-vote scale | Yes: the consulted registration replaced the scale, but the chain kept its old value |
| Aksamitki | the same `axisLadder` rule, on both axes | M1 | Yes, same reason |
| Supertunie 2 E | `walledEnvelope` gets one long horizontal band, so the box is degenerate and returns null. `plan-decomposition.ts:1721, 1742` | M2: a facade with no band (fully glazed rear gable) | No: stage A fails the same way at 1.91 cm/px (`firstFailure PLAN_NO_WALLED_ENVELOPE`) |
| Madera | the plan frame comes from the long-band axes (`planExtentOf` `:1549-1552`, then `walledEnvelope`). The garage mouth is undrawn and the glazed living room floods as OUTSIDE | M2 + M3, plus M1 (minor, 6 %) | No: the same decomposition at stage A, where it passed only through a wrong scale (a false positive) |

Shared mechanisms:

- **M1, stale chain values pinned by the world-frame ladder.** Decisive on sp318422 and Aksamitki. Also present on
  Madera, where it adds 6 % and does not decide the outcome.
- **M2, a frame read from wall-band axes misses a facade that has no band.** Fully glazed or undrawn facades: Supertunie
  and Madera. The inverse case, a non-house band taken in, is the porch step on sp318422 (+1.45 m).
- **M3, a glazing-outlined room flooded as OUTSIDE.** Madera only.
- The Supertunie watermark belongs with the inverse of M2 (ink that is not the house widens the extent). It is not the
  cause of the refusal.

---

## 1. sp318422: over-extended in depth (13.88 × 16.03 m against 14.02 × 9.58 m)

**First lost decision**

- Stage: REGISTERING_VIEWS / STRUCTURAL_LAYOUT, while the base plan's world frame is built in `inferStructuralLayout`.
  Call sites are at `packages/reconstruction/src/layout.ts:2475-2476`.
- Function: `axisLadder` (`layout.ts:1560`).
- Condition, at `layout.ts:1717-1724`: claims are applied longest first. For the first claim no line is fixed yet, so
  `pi`/`pj` are `undefined` and the residual gate
  `if (pi !== undefined && pj !== undefined && Math.abs(residualPx) > allowedPx)` is skipped. The comment says why: "the
  sheet's fitted scale is a fit over these same chains". That premise is false once the registration is
  `CONSULTANT_VALIDATED`: that registration was measured on the consulted spans, not fitted on the chains.

**Values**

- Ladder Z, first claim: lines 168.5 → 742.5 px (574 px) = **14.581 m**. The evidence is `metric-dimension-dc0411099c`,
  rawText "14,581", READ on `chain-vertical-965-c224da03e5`. This is the same misreading the page vote's 2.540244 cm/px
  was solved from (1458.1 / 574).
- The consulted registration (1.6654 cm/px) predicts 9.559 m for that span. Residual +300.9 px against 2.3 px allowed;
  the claim is PINNED anyway.
- `atZ` comes out as [0, 3.33, 6.49, 13.27, 14.58, 16.03] instead of [0, 2.18, 4.26, 8.71, 9.57, 11.02]. Every body is
  stretched ×1.52 in depth. X is not affected: no X chain has a printed claim.
- The model's slabs confirm it: z spans 0.13–16.16 m, while the same pixels at 1.667 cm/px give 11.0 m.

**What the drawing shows there**

The right-hand chain prints `31'-5"` and `(9,58)` between the rear wall face and the garage/foyer front. The consultant
read it on the same line: P8, 957.58 cm over 575 px.

**Upstream root, in source-metrics**

- `extract.ts:571` computes `scaleStands` before the consulted admission (`:576-603`).
- The admission replaces only `metricSolutions[i]` (REPLACED, SUPPORTED) and, at `:1335-1365`, the frame's registration.
- The chains are then built (`:607-618`) from the legacy solve, so they keep READ 1458.1, CHAIN_CORRECTED values and
  DERIVED values made at 2.54 cm/px.

**After the ladder fix (Fix 1)**

- 13.88 × 11.02 m; IoU 0.624 → 0.837.
- Two non-scale issues remain:
  - **Entry stoop taken in (+1.45 m).** `planExtentOf` (`plan-decomposition.ts:1549-1552`) finds "no dimension chain on
    this frame read a value" on X, so the frame is the axis box of all 47 long bands. Its y1 = 837.5 includes the porch
    step band, and the stoop cell 255.9–446.4 × 742.5–829.6 becomes BUILT inside the foyer body. The reference excludes
    the stoop.
  - **Bath cell 677–868 × 424–691 classified RECESS.** This is the 13 % missing area. It does not depend on the scale:
    the pixel classification is the same in every run.
- With the consulted spans used as overall dimension chains (Fix 3, by injection), the stoop goes too: exactly
  14.02 × 9.58 m, IoU 0.876.

## 2. Aksamitki: refused, "211.12 m² against 111.76 m²"

**First lost decision**

The same function and condition as sp318422 (`layout.ts:1722-1724`), on both axes. The pixel decomposition is right:

- envelope 202–801 × 93–522 px, which is 12.32 × 8.82 m at 2.0564 cm/px;
- the 0.90 m octagonal bay at 158–202 is OUTSIDE.

**Values**

- **X.** The first printed claim is 202 → 621 px (419 px) = **13.72 m**. It is CHAIN_CORRECTED: the label "1232" was
  OCR'd as "1732", bound to a sub-span because of a spurious tick at 621, and corrected to 1372 to fit 3.274 cm/px. The
  consulted scale predicts 8.616 m; residual +248 px against 2.24 px allowed; PINNED. Result: `atX` 158 → 801 =
  18.33 m (printed 13.22).
- **Z.** 171.5 → 442.5 px (271 px) = **8.87 m**. It is CHAIN_CORRECTED: "882" bound to a sub-span between window-callout
  ticks and corrected to 887. Predicted 5.57 m; PINNED. Result: `atZ` 0 → 12.12 m (printed 8.82).
- 17.42 × 12.12 = 211.12 m² trips `FOOTPRINT_AREA_WRONG` (`layout-gate.ts:165`). The published figure is then SPENT, so
  the resolver's best alternative (3.381 cm/px, 117.6 m²) cannot be chosen by it, and the run ends
  PLAN_RESOLUTION_INCONCLUSIVE.

**What the drawing shows there**

- Bottom chains: 90 + 1232 and the overall 1322.
- Left chain: 882.
- The consultant read all three, twice each (R11–R13, P15–P17), at 2.056 cm/px, snapped on the plan's own strokes:
  1322 cm / 643 px, 1232 cm / 599 px, 882 cm / 429 px.

**After Fix 1**

Completed, 12.32 × 8.82 m. IoU 0.979; coverage MATCHES (97 %); completeness COMPLETE. The model leaves out the 0.9 m
bay, as the decomposition already did.

## 3. Supertunie 2 E: refused PLAN_NO_WALLED_ENVELOPE

**First lost decision**

- Stage: REGISTERING_VIEWS / PLAN_DECOMPOSITION.
- Function: `walledEnvelope` (`plan-decomposition.ts:1709`), through `axisBox(longBands(inside))` at `:1721`.
- Condition: the long bands inside the extent give three vertical axes but only one horizontal axis, the front wall
  255–444 px at y ≈ 752. The box is 20 px tall, so `:1742` (`rect.y1 - rect.y0 < wallPx * 4`) returns null.
- With no envelope, every reading the resolver weighs hits the same null: 31 readings, 8 decompositions, 0
  compositions. `planFailureOf` reports PLAN_NO_WALLED_ENVELOPE (`plan-diagnostics.ts:247`).

**What the drawing shows there**

- The rear (garden) gable is one glazed wall between two small corner piers. There is no wall band along y ≈ 160–172.
- The side walls run from the front wall up to the glazing: left 172–700, which stops at 700 because of the front-left
  corner window; right 37–741, which runs on into the terrace posts.
- The READ 1350 chain (`chain-vertical-111`, ticks 160 … 762) states exactly that span.

**Not caused by the scale**

Stage A (1.91 cm/px) has the same first failure (`firstFailure: PLAN_NO_WALLED_ENVELOPE`). The scale here also came
through the analyzer's own solver, from consulted label readings. The chains were therefore re-solved at the new scale,
and M1 does not occur on this house.

**The watermark suspicion**

- 13 of the 18 bands are the "archon" logo letters (x 496–781, y 765–823).
- They are **not** the cause of the refusal. The `inside` filter (`plan-decomposition.ts:2500`) removes them from the
  envelope, because their axes and runs lie outside the extent's x range (157–464.5).
- They do leak into the extent. `planExtentOf` admits "near" bands by their axis coordinate only (`:1554-1570`), so the
  logo's horizontal strokes push the depth from the chain's 762 to 825.77 and turn its provenance into
  WALL_GEOMETRY_EXTENT.
- Two checks confirm this:
  - Forcing the extent to 157–464.5 × 160–762 still refuses with PLAN_NO_WALLED_ENVELOPE.
  - A run-overlap filter (Fix 4) gives y1 = 762.0 and the same refusal.

**After Fix 2**

Completed, 6.32 × 13.50 m (printed 6.90 × 13.50). IoU 0.897; coverage NEAR (89 %); completeness PARTIAL. Two
shortfalls remain:

- The side faces are read "as gridded", 0.3 m inside the outer faces on each side.
- The front-left corner-window corner is OUTSIDE (about 1.6 m²).

## 4. Madera: refused, "103.78 m² against 202.66 m²"

**First lost decision**

The plan frame is taken from the long-band axes.

- `planExtentOf` (`plan-decomposition.ts:1549-1552`): "no dimension chain on this frame read a value, so the frame is
  the 18 wall bands' own". The result is 116.5–450 × 37–350.
- `walledEnvelope` then gives 122.5–444 × 43–341.75.

Three things the frame misses:

- **The garage.** The drawn house is 102–450 × 37–442 px; the consulted spans measured 1598 cm / 348 px and
  1871 cm / 405 px. The garage (26.24 m², about 318–447 × 342–442) has a mouth with **no door drawn** between its
  piers. `baysOf` (`:2171`, "nothing drawn between their ends … the bay stays ground") rightly cannot shut it, and there
  is no grid line at y ≈ 442.
- **The west wing's faces.** The living room (25.40 m²) is outlined by glazing, thin double lines between piers, on its
  rear face (y ≈ 163) and its left face (x ≈ 160), and the terrace wraps it. No band or chain tick lies on those faces.
  The grid has Y lines only at 43, 302 and 342. Two of its X lines (182, 246.5) come from furniture and from a
  fragment of the 15,98 line.
- **The west cells.** The cells 122.5–266.5 × 43–342 hold both terrace and living room. The flood reaches them from
  outside, so they are OUTSIDE.

The one body left is 266.5–444 × 43–302 px.

**Values**

- 8.69 × 11.95 m = 103.78 m². That includes a 5.11 m ladder pin from the fragment chain `chain-horizontal-22`, where the
  overall label "15,98" was read "511" on 97 px. This is M1, worth 6 %. Without it the body is 97.71 m², against
  202.66 m² published.

**Not caused by the scale**

- Stage A has the identical decomposition: the same extent, envelope, grid and regions in the digest.
- Stage A completed only because the frame scaled that east block to 11.09 × 18.15 m: about 6.25 cm/px in X and 7.0 in Z
  (Z ×1.52). Area MATCHES at 99 %, yet IoU is 0.545 against the stepped reference.
- **The stage-A completion was a false positive. The correct-scale refusal is the right outcome.**

**Tested and not sufficient**

| Experiment | Coverage | Outcome |
|---|---|---|
| Fix 1 (ladder) | 97.71 m² | still refused |
| Extent forced to the consulted ends | 144.08 m² | still refused; the west strip is RECESS and BUILT, the garage stays ground |
| Consulted spans injected as overall chains (Fix 3) | 103.25 m² | still refused; the extent and a grid line at 442 are right, but the envelope is unchanged and the garage stays an open mouth |

---

## 5. Ranked minimal fixes

### Fix 1 (recommended first): check the ladder's first statement against an independent registration

**Change.** `packages/reconstruction/src/layout.ts`, about 12 lines; see `fix1-ladder-first-statement.patch`.

- `axisLadder` takes an optional `independentScale { shareUncertainty }`.
- When nothing is fixed yet, a claim must satisfy
  `|residualPx| ≤ allowedPx + length × 2·LADDER_TICK_PX / longestAnchorPx`. Otherwise it is recorded as
  REJECTED_RESIDUAL, and the axis keeps the registration's scale until a consistent statement pins.
- The call site passes `independentScale` only when `base.registration.provenance.extractor === 'CONSULTANT_VALIDATED'`.

**Why it is principled.** The rule it amends ("the first statement sets the scale") is justified only by "the sheet's
fitted scale is a fit over these same chains". A consulted registration is not fitted on those chains, so the scale is
already fixed before any chain speaks.

**Effect per house**

| House | Before | After |
|---|---|---|
| Aksamitki | refused | completed 12.32 × 8.82 m, IoU 0.979, coverage MATCHES 97 % |
| sp318422 | 13.88 × 16.03 m, IoU 0.624 | 13.88 × 11.02 m, IoU 0.837 |
| Madera | refused, 103.78 m² | refused, 97.71 m² |
| Supertunie | refused | unchanged; it fails before the ladder |

**Regression risk: low.**

- It fires only with a CONSULTANT_VALIDATED registration.
- On such a house, a correct first chain statement is rejected only if the consulted scale itself is off by more than
  2 px plus 2 px per longest anchor. The axis then runs at the consulted scale, whose error is that same amount.
- It could hurt a house where the consultant's two spans agree on a wrong scale. That case is already wrong at the
  registration.
- Kuklikach (C2, a CONSULTANT_VALIDATED registration with consistent chains) is byte-identical.

**Note.** The model changes on pilot runs, so the solver version should be bumped with it.

### Fix 3 (next): admitted consulted spans become the frame's overall dimension chains

**Change.** `packages/source-metrics/src/extract.ts` after `admitSpans` (`:576-603`), plus `schema.ts`.

- Each admitted member's snapped `fromPx`/`toPx`/`atPx` is already in `SnappedSpan` but not recorded. Record each as a
  READ chain with CONSULTANT_VALIDATED provenance.
- A legacy chain on the same line, with end ticks within a wall, is superseded.
- Bump the metric-evidence schema version.

**Effect (tested by injecting such chains into `metric-evidence.json`; `inject.py`)**

| House | Result |
|---|---|
| sp318422 | 14.02 × 9.58 m exactly, IoU 0.876 (the stoop leaves) |
| Aksamitki | identical to Fix 1 |
| Madera | extent right, still refused |
| Supertunie | nothing: its spans were refused, so nothing is admitted |

**Risk: moderate.**

- One evidence change feeds the extent, chain roles, grid, ladder and resolver at once.
- Snapped ends carry ±1 px.
- Superseding a legacy chain can drop real interior ticks. On Aksamitki the 90 | 1232 tick survives only because the
  1322 and 1232 spans carry it.
- Not run on Kuklikach or Toreniach. Kuklikach's overall chains already hold the consulted values (756 and 876 READ), so
  no change is expected there.

**Keep Fix 1 beside it.** The consulted-readings path creates no spans, and Fix 1 guards the consumer.

**Root-cause variant 3b, not tested.** Set `scaleStands = false` after the consulted admission and re-solve the chains at
the admitted scale, as the analyzer does when its own solver REPLACES the page vote.

### Fix 2: close a fully glazed end at a READ dimension tick, behind the pilot

**Change.** `plan-decomposition.ts` (`glazedEndClosure`, called from `walledEnvelope`, option `closeGlazedEnds`) and
`layout.ts`, which sets the option only when `metrics.consultedReadings` or `consultedSpans` is non-empty. See
`fix2-glazed-end-closure.patch` and `fix2-layout-gate.patch`.

The rule fires only where the long-band box is degenerate on an axis. Today that case is a hard null. All of the
following must hold:

- a READ chain on that axis has one end tick at the lone cross wall and the other at least four walls away;
- both outermost side walls each run along at least 75 % of the stated span;
- both side walls reach within 1.5 walls of the far tick.

The far tick then becomes the facade line.

**Effect**

| House | Before | After |
|---|---|---|
| Supertunie | refused | completed 6.32 × 13.50 m, IoU 0.897, coverage NEAR 89 % |
| Other three | — | unchanged |

**Risk: moderate.**

- It could close a box over a loggia or porch whose side walls run on to a dimension tick. The 75 % and 1.5-wall
  conditions and the READ-chain requirement limit this.
- The result still has to pass the footprint gate.

**Could hurt.** Rear-niche or loggia houses whose overall chain is drawn to the niche line rather than to the glazing.

**Ungated, it is not baseline-safe.** It changes stage-A Supertunie's diagnostics. The verdict stays
METRIC_RESOLUTION_INCONCLUSIVE, but `firstFailure` moves from PLAN_NO_WALLED_ENVELOPE to PLAN_RESOLUTION_INCONCLUSIVE.
It needs an S30 + FINAL-12 regression before the gate comes off. A gate on "the frame's metric solution is STRONG or
SUPPORTED" would also leave stage A unchanged, but it was not tested.

### Fix 4 (optional, low value): planExtentOf "near" bands must also overlap in their run

**Change.** `plan-decomposition.ts:1570`.

**Effect.** It removes the watermark from Supertunie's extent (y1 825.77 → 762.0). No outcome changes on any of the 22
runs. It does change stage-A Supertunie's digest, so it would need the pilot gate or a corpus run.

### Madera: no minimal fix

Three changes would be needed, none of them minimal:

- the frame from the overall dimension marks (Fix 3);
- a garage whose mouth is undrawn. This needs evidence beyond the plan's ink, such as the garage label or area, or the
  elevation's door. Otherwise it is a question to the user, not a default;
- glazed faces (double thin lines between piers) used as grid lines and flood barriers.

Recommendation: keep the refusal and record stage A's completion as a false positive.

## 6. Counter-check: stage A with the consultant off

Run on all 22 saved run dirs, solver alone, comparing `failure.json`, `model.json` and `plan-diagnostics/digest.json`
byte for byte (`batch/<tag>/`).

| Run set | Fix 1 | Fix 1 + Fix 2 (pilot-gated, clean patches) | Fix 2 ungated | Fix 4 |
|---|---|---|---|---|
| A (6), A-confirm (4), A2 (6): consultant off | **identical (16/16)** | **identical (16/16)** | Supertunie A and A2 digest and diagnostics change; verdict the same | Supertunie A and A2 digest changes |
| C2 Kuklikach, C2 Toreniach, D Puszek: pilot on, not targets | identical | identical | identical | identical |
| The four targets | Aksamitki, sp318422 and Madera change | plus Supertunie | — | — |

Fix 1 is baseline-safe by construction: no registration is CONSULTANT_VALIDATED unless the pilot runs. The clean Fix 2 is
baseline-safe because it sits behind the pilot evidence.

## 7. Files

All under `/home/user/rd/v3542/diag/`:

- **Patches:** `fix1-ladder-first-statement.patch`, `fix2-glazed-end-closure.patch`, `fix2-layout-gate.patch`. They
  apply with `patch -p1` from the repo root.
- **Numbers:** `results.json`, with per-house outcome, box, coverage and outline score for base, fix1, clean12 and the
  Fix 3 injection.
- **Regression batches:** `batch/{base,fix1,fix12,fix4,clean12}/`, each with `summary.txt` and the replays.
- **Single-house replays and injections:** `solo/`, `inject/`.
- **Scripts:** `solo.sh`, `batch.sh`, `batch2.sh`, `inject.py`, `bounds.py`.
- **Shadow workspaces:** `shadow/` (instrumented) and `shadow2/` (clean patches).
- **Crops:** `crops/` holds publisher plan crops, kept outside the repo, for inspection only.
