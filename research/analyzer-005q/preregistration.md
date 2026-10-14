# BUILDPLAN-ANALYZER-005Q — preregistration (committed before any challenger runs on the corpus)

Base `04d5568a4a36d2b850998f2848d06e2179218872` (005P, plan resolver 1.5.0). Phase A evidence:
`stage-reports/artifacts/analyzer-005q/architecture/` and `baseline-44.json`. Every later change to a candidate, a
gate or a prediction is an **addendum** at the end of this file, committed **before** the changed candidate runs.

## 1. Corpus, runner, outputs

- **Corpus.** `research/analyzer-005q/cases.json` (sha256 `d8f1b242ac8de1b40c9ce609731448608022200f048c66c146a1f20b76fed319`):
  the 44 development rows of `research/analyzer-005o/cases.json`, unchanged and in order, plus blind round 11's two
  houses (`dom-miniaturka`, `dom-w-krasnokwiatach`), revealed and now development (never eligible for blind 12).
  Gates quoted "on the 44" use the 44; every gate is also evaluated on all 46.
- **Baseline.** `stage-reports/artifacts/analyzer-005q/baseline-44.json` (sha256
  `a3f4a1e87c674583c0af158e294ab2e88ee6e5ab6a2320d2652738edd9f747c3`), label S0: production at the base, replayed by
  `research/analyzer-005q/solve.ts` (byte-identical to `second-house.ts`'s solver path on 46/46). 19 PASS (18 on the 44
  + `dom-miniaturka`), 24 completed.
- **Runner.** `node research/analyzer-005q/variant.mjs setup --work <dir> --patch research/analyzer-005q/candidates/<X>.patch [...]`
  (the base's `packages/reconstruction/src` + patches, aliased), then
  `node research/analyzer-005q/replay.mjs --work /home/user/work005q --label <X> --config <dir>/vite.config.mjs --solve --par 2`.
  Sealed package, observation graph and metric evidence are held fixed: scale, OCR, binding, registration cannot move.
- **Scoring.** `research/analyzer-005q/score_005q.py --baseline baseline-44.json`: outcome, refusal, frozen
  `holdout/verdict.mjs` verdict and footprint residual (the only place the published figure meets a candidate),
  model/program/failure sha256, storeys, every wall ring's evidence status, every terrace, wide-opening decisions,
  boundary bodies, extent conflicts, completions, typed unresolved gaps, MASS provenance; per row what changed.
- **Instrumentation.** The candidates record every decision they make in existing records: C1 in the grid line's
  `why`; C2 as completion parts (`CHAIN_STRIP*` reasons) in `decomposition.boundary.completions`; N1 as a layout gap
  (`gap-outer-face-*`) in `result.unresolved` and in the ring's evidence. No new schema field in the canonical model.

## 2. Candidates (patches in `research/analyzer-005q/candidates/`, sha256 at commit)

All tolerances are in the plan's own units — the wall thickness `wallPx` the decomposition measures on the frame's
bands, a band's own thickness, and `snapPx` (5 px, the existing grid snap) — never in slugs, never in house numbers.

| id | patch (sha256) | files | rule |
| --- | --- | --- | --- |
| **C1** wall-face preserving | `C1.patch` `c9a59683…` | `plan-decomposition.ts` | Before thinning, on each axis side: if the outermost raw grid line carries a chain tick, and one long (≥ 2.5 `wallPx`) wall-thick (≥ 0.7 `wallPx`) band has its outer face within `max(snapPx, 0.35·thickness)` of that line and its inner face within the same of another raw line inward, and wall-thick bands with their outer face on that line cover ≥ `OUTER_FACE_BOUNDS.sideCover` = 0.75 of the extent's span across the side, and thinning would not already keep the outer line (it would drop it, or keep both), the two lines become ONE line on the outer face carrying both lines' probes and support. The result does not depend on the cell size (no dependence on the 0.136 px near-tie); a stepped side is left as it is. |
| **C2** chain-constrained candidate extent | `C2.patch` `1b074abd…` | `boundary-completion.ts` | For each STRONG extent conflict whose stating chain ticks within one `wallPx` of the box edge: the far-face grid line (within `wallPx/2` of the stated side) is split into RUNS from a WALL piece to a WALL piece across host openings only — jambs not POST, and either a printed callout of the gap's width (up to 8 m) or, up to the lintel convention (3.2 m, the existing vehicle-door bound), an OPENING_SUPPORTED class, a STRONG bridge or a GLAZING / LEAF signature (a single line across a wider mouth is a paving or slab edge as often as a door: Phase A found one on jarzabem's 6.22 m porch mouth); a run ≥ 4 `wallPx` is built only when a wall line within 1.5 `wallPx` of each of its ends returns across the strip's depth (WALL pieces plus door-sized ≤ 3.2 m openings with a WALL jamb, ≥ 0.75 cover, the existing `returnCover`). Its cells (grid cells inside the run's returns and the strip's depth, not already built) are an accepted ATTACHED_ROOM completion (`CHAIN_STRIP`). Every other candidate is recorded with a typed reason (`CHAIN_STRIP_NO_TICK`, `_NO_FACE_LINE`, `_NO_HOST`, `_NO_RETURNS`). No size cap relative to the box: the strip's size is the printed chain's. |
| **N1** fail-closed wall strip (own third approach) | `N1.patch` `bc501f38…` | `layout.ts`, `v2/reconstruct-v2.ts`, `v2/building.ts`, `v2/emit.ts` | A strip between the walled envelope and the stated extent in which a long wall-thick band has its two faces on the strip's two edges over ≥ `WALL_STRIP_BOUNDS.cover` = 0.25 of the strip's length is the building's own wall: it yields no zone (no recess, no return, no terrace floor); the layout raises an AMBIGUOUS gap "the outer face of the building's <side> wall"; a body standing on the strip's back edge loses MEASURED on that axis, its MASS feature is SOURCE_DERIVED and its ring evidence SOURCE_DERIVED naming the open face. Geometry does not move. |
| **C1N1** | C1 + N1 | | combination, eligible only if C1 and N1 are each admissible and their changed rows are the union of theirs |
| **C1C2N1** | C1 + C2 + N1 | | combination, same condition |
| P0 | none | | the frozen incumbent (S0) |
| N2 *(informational, not adoptable)* | `N2-informational.patch` `99c39365…` | `layout.ts` | a zone strip no deeper than 1.25 walls yields no zone (no recess, return or terrace). Run only to measure the sliver-terrace class Phase A found (17 of 29 production terraces ≤ 0.48 m deep, three on known-good rows); it changes known-good models by construction, so G1 cannot hold and it is never selected. Its changed-row list goes to the coordinator as evidence for an OWNER decision. |

Phase A measured where each rule's trigger holds on the frozen evidence (`research/analyzer-005q/trigger_census.py`
on the PROBE replays, before any candidate ran; `architecture/trigger-census.json`): C1 acts on the selected frame of
`dom-w-glogownikach` (E, cover 0.90), `dom-w-helikoniach` (W, 0.82), `A04` (W, 0.97), `willa-miranda` (E, 0.76) and on
one reading of the known-good `dom-miniaturka` (N, 0.85 — a reading whose inner line is absent from the final grid);
every other known-good face pair has cover ≤ 0.55 or is one thinning already resolves. N1's band-faced strip holds
only on `dom-w-glogownikach` (E 0.94, S 0.45); every other zone strip on the 24 completed rows has 0.00. C2's trigger
was not censused (it reads the outline's wall lines).

## 3. Predictions (written before any run)

- **C1.** Decision paths change only on glogownikach, helikoniach, A04, willa-miranda and possibly one reading of
  miniaturka (model predicted unchanged: its final grid has no inner line there; if it changes, G1 decides). glogownikach: the E side moves to the outer face (width ≈ 19.21 m), the E zone and its
  terrace vanish, the S side (stepped, cover 0.44) is untouched: footprint ≈ −6 %, still ALGORITHMIC_FAIL, the two
  front "terraces" stay. helikoniach: W moves out (toward truth, ≈ −12 %), still ALGORITHMIC_FAIL. A04 stays FAILED; willa-miranda's E side moves out (direction toward its drawn wall), still ALGORITHMIC_FAIL.
  0 known-good model change.
- **C2.** Accepts strips only where a STRONG conflict's far face carries host wall between returns. Predicted
  ACCEPTED: krasnokwiatach N (living room 4, run ≈ 259..534, returns at ≈ 262 and 535) and S (garage, ≈ 365..535);
  NO_HOST for its NW covered terrace, the entrance porch and the planting strip. Outcome for krasnokwiatach uncertain
  (the walled answer is ≈ 121 m², −15.5 % of the published figure, which includes roofed open areas): it may complete
  DEGRADED or stay refused; either is acceptable only if no terrace, porch or planting is built. Negative controls
  predicted unchanged: rarytasy-g2e (S ground), zurawkach (S porch), willa-miranda (N/S), jablonkach, dabecjach's
  terraces, jarzabem's porch. 0 known-good model change.
- **N1.** Fires only on glogownikach (E and S): zones 2 → 0, recesses/returns 2 → 0, PAVED terraces 3 → 0, two typed
  gaps, MASS and ring SOURCE_DERIVED, footprint unchanged (−8.04 %), still ALGORITHMIC_FAIL. Nothing else changes.
- **N2 (informational).** Changes glogownikach, eoze-legacy-area, eoze-legacy-every, cieszyniankach, D00 and jarzabem
  (every row with a zone strip ≤ 1.25 walls) — known-good models change, G1 fails by construction.
- **C1N1.** glogownikach: C1 fixes E, N1 names S: width ≈ 19.21, 0 terraces, 1 typed gap (rear/front S), ring
  SOURCE_DERIVED, ≈ −6 %, ALGORITHMIC_FAIL; helikoniach/A04 as C1. **C1C2N1.** the union of C1N1 and C2.

## 4. Gates (all mandatory; a candidate failing one is not admissible)

| gate | requirement |
| --- | --- |
| G1 known-good | the 19 baseline PASS rows: model.json byte-identical, verdict PASS |
| G2 scale | `frame` and `scaleCmPerPx` identical on every row (no new false-confident scale) |
| G3 negative open sides | on every row, no new BUILT area over an open terrace, porch/portico, carport, pergola, loggia, covered terrace, planting, courtyard or ground; no wide opening changes class; every changed row is listed with the source evidence for each changed feature (`negative-controls.json`); any C2 ACCEPTED strip is checked against the drawing (raster read in scratch) |
| G4 no fabrication | no new terrace, room, roof or slab without source support; no new SOURCE_EXACT ring on a body side that lies on a wall's inner face |
| G5 glogownikach | the shipped model carries no terrace made of wall poché, no SOURCE_EXACT ring on an inner face, and a typed unresolved gap for every side still cut on an inner face (or it refuses) |
| G6 krasnokwiatach | if it changes: the covered terrace, the porch and the planting strip stay unbuilt; else its candidates are on the record |
| G7 akebiach | no false closure: it stays refused, or completes only with no unsupported built area (courtyard, porch, E yard) |
| G8 storeys and earlier stages | storeys (005L), 005N recess / back wall / garage semantics and 005P's statement contest unchanged on every row the candidate does not name |
| G9 determinism | a repeat replay byte-identical on 46/46 (model, program, failure, trace, digest, unresolved) |
| G10 invariance | unit level: band order, chain order, mirrored and rotated plans and ±0.2 px perturbations at the face-pair tolerances give the same decision |
| G11 performance | interleaved ABBA solver-only on the 46 rows: median per-case ratio ≤ 1.15, no unexplained case > 1.15 |

Disqualification: any gate failing; a crash; a prediction failing in the direction of a fabricated feature.

## 5. Selection rule

Among admissible candidates: (1) the fewest fabricated features and false exact labels on the 46 rows; (2) then the
most evidence-backed geometry recovered (rows moved toward their drawn walls, verified on the raster); (3) then the
smallest change. A combination is chosen only if each component is admissible on its own and the combination's
changed rows are exactly the union of its components' (no interaction). If no candidate is admissible the stage ends
`NO_SAFE_ADOPTION` and production is unchanged.

## 6. Adoption, tests, mutations, reviews

The chosen candidate is re-implemented in production (`packages/reconstruction` only) and must equal the research
replay byte for byte on 46/46. Each adopted rule gets a test that fails on the frozen code and passes after, plus hard
negatives; at least 12 adversarial synthetic families with opposite truth (outer/inner face, wall thickness,
return/pier, ±0.2 px, garage door beside a wall, stepped building, open terrace, porch posts, pergola, carport, loggia,
mirror/rotation), end-to-end `reconstructV2` where the rule's effect is downstream; at least 10 meaningful mutations
killed by named assertions; two independent review rounds (topology and negative controls, metric source authority,
scene/surface provenance, performance, research leakage and reproducibility), every P0/P1 reproduced or refuted.

## 7. Blind round 12 (only if production changed)

Protocol of round 11 (holdout/README.md § Round 11) with: seed `SHA256(PRE_HOLDOUT_12_SHA + "BUILDPLAN-005Q-EXTERIOR-BOUNDARY-HOLDOUT")`;
exclusions = round 11's list + both round 11 draws and every family their cached pages link to + every family a
005Q research or artifact text names (built by a committed script before the freeze, manifest hashed); both picks
unstratified (the target class — a face pair on an exterior wall, a band-faced strip, a stated strip beyond the box —
cannot be read from a page's markup without its drawings); NEW (frozen code, live, `--recogniser`) then OLD (the
base's reconstruction aliased, solver only on NEW's sealed inputs); verdicts sealed before diagnosis;
`TARGET_CLASS_EXERCISED = YES` when the NEW digest/trace records a C1 merge, a C2 strip record or an N1 gap (for the
adopted rule), or OLD and NEW differ. A fresh ALGORITHMIC_FAIL makes the stage at most PARTIAL.

## Addenda

### Addendum A (after N1's first run; committed before N1a runs)

**Observed (N1, run as preregistered).** N1 changed exactly one row, `dom-w-glogownikach`, as predicted: terraces 3 → 0,
two typed gaps (east and front outer faces), MASS and ring SOURCE_DERIVED, footprint unchanged −8.04 %, all mechanical
gates held (G1, G2, G4, G5). Not predicted: removing the strip's ZONE region also removed it from the v2 world frame,
whose front plane is the max-z of every base-storey region including zones (`v2/frame.ts:55-80`). The whole model moved
0.4455 m and two readings anchored to that frame drifted: one interior partition and its door were lost (rooms 8 → 7)
and the west opening flipped from a window read as "110/230" to a door read as "110/290" — with no new evidence. A guard
that changes an opening's kind as a side effect is not fail-closed; N1 as run is therefore **not admissible** (G3/G4:
an unsupported semantic change).

**N1a** (`N1a.patch` sha256 `ef5c7686ce41b61aee272c5ea0a1814e10ddf33b3c48a2f3c4a7f8dbc9c3a5c3`): N1 with one change — the wall strip **stays a ZONE region** in the
layout (so the world frame, the front plane and every reading anchored to them are unchanged), and the v2 recess /
return / terrace reading skips a zone whose side the layout names in an unresolved outer face (`gap-outer-face-zone-<side>`).
The gap, the MASS/ring provenance and the trigger are N1's.

**Prediction (N1a).** Only `dom-w-glogownikach` changes: terraces 3 → 0, recesses/returns 2 → 0 (their two return
walls removed), two typed gaps, MASS and ring SOURCE_DERIVED; rooms, interior doors and every opening (kind, offset,
width, sill, height) identical to the baseline; footprint −8.04 %. Combinations re-run with N1a as **C1N1a** and
**C1C2N1a** (C1N1 and C1C2N1 with N1 are run as preregistered and reported, but inherit N1's inadmissibility).

### Addendum B (review round 1 of the production change; written before PROD2's outputs are read)

Review round 1 (five static lenses, `post-review/round-1.md`) found 0 P0 and 0 P1. The production change was amended for
four P2/P3 findings, each narrowing N1a or only naming what it would otherwise drop silently:

- **F1 (METRIC-1, TOPOLOGY-3, PERFORMANCE-1).** A body is "cut on the wall's inner face" only where its side overlaps the
  stretches the wall ink covers by more than one wall, not anywhere along the strip.
- **F2 (TOPOLOGY-4, METRIC-4).** A band counts only if the strip is no deeper than the band by more than its face window
  (a band floating clear of both edges is not the wall). One-sided: a band thicker than the strip still counts.
- **F3 (METRIC-3, PERFORMANCE-2).** The gap reason's depth uses the axis's own scale, and says "the plan's extent".
- **F4 (TOPOLOGY-1).** A platform the plan outlines beyond a wall strip is named as an AMBIGUOUS gap ("the platform the
  plan outlines beyond the … wall"); nothing is built.
- Text only: `openFacesOf` matches through `outerFaceSlug`; an open body's ledger reason names the open face.

**Prediction (PROD2 = production after F1–F4, solver-only on the 46 rows).** 45 rows byte-identical to N1a/PROD1 in
every output file. `dom-w-glogownikach`: geometry, statuses, terraces (0), returns (0), rooms, doors, openings, MASS and
ring provenance identical to N1a; both outer-face gaps still named (the main body overlaps the covered stretches on
both sides; both strips are as deep as their bands); only text may differ (the gap reason's wording and depth, the
ledger reason). No platform gap on glogownikach (the base's terraces there carried no extension). If any geometry,
status or count differs from N1a, PROD2 is not adopted without a further addendum.

### Addendum C (review round 2; written and committed before the PROD3 replay starts)

**Disclosed ordering (R2B-04).** The PROD2 replay was started at about 00:12:30, before Addendum B was committed
(00:14:13); nine rows had finished by 00:14:06. `dom-w-glogownikach`, the only row the prediction concerned, finished at
00:18:20, after the commit. PROD3 below is started strictly after this addendum's commit and is the production replay
of record.

**G10 (R2B-02).** G10 is a *unit-level* gate ("band order, chain order, mirrored and rotated plans and ±0.2 px
perturbations … give the same decision"). The tests up to round 2 checked band and chain order and translation at unit
level, but mirror, rotation and ±0.2 px only **end to end**, where the decision depends on orientation because the
upstream band claim (`plan-decomposition.ts:509`, unchanged, identical in the base) breaks a face tie toward the lower
pixel: the base then cuts the body on the inner face in some orientations and not in others, and N1a names the strip
exactly where the base reads one. That end-to-end dependence is a property of the base, not of the rule, and is disclosed
as such. G10 is evaluated as written, at unit level: `wallStripsOf` (exported for the test) on a reading, its mirror
images and quarter turns, and ±0.2 px perturbations of bands, extent and envelope away from the bounds, must give the
same (transformed) decision. If it does not, N1a is not admissible.

**Changes (no geometry):** `wallStripsOf` and its type are exported for the unit test; the platform probe of F4 runs
across the ground-storey bodies standing on the strip's back (the span the recess reading probes) and skips a strip no
body stands on (R2A-1); the gap reason states the observation ("wall-thick ink … fills the strip … the body's own wall,
or another wall layer; the wall's outer face is not resolved", R2C-02); docstring corrections (R2A-3, R2C-04).

**Prediction (PROD3).** 45 rows byte-identical to PROD2; `dom-w-glogownikach` differs from PROD2 only in the two
outer-face gap reasons in `unresolved.json`; no platform gap.

**C1 (R2B-01, recorded, nothing changes for the selection).** Besides failing G5, C1 and C1N1a change openings without
new evidence (helikoniach: a door read as a window and a window as a door, one window lost; glogownikach: the garage
door re-bound from "300/225" to "360/225") and raise helikoniach's MASS to SOURCE_EXACT. Under §4 that is also a
disqualifying prediction failure.
