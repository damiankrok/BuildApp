# BUILDPLAN-ANALYZER-005I Track B — boundary observation bake-off: methodology

**Research only.** Nothing here changes production behaviour, and nothing here is production architecture. The harness
lives in `research/analyzer-005i-boundary-bakeoff/` (not a workspace, never imported by `packages/` or `apps/`); heavy
material (venv, upstream clones, checkpoints, decoded frames, masks, overlays) lives outside the repository in
`/home/user/work005i/`. Only text facts (ids, hashes, coordinates, numbers, timings) are committed.

This file was written **before any scoring was run** (protocols, selection rules, truth conventions, tolerances,
metrics and the scorecard rules below). Anything changed after scoring started is listed in §11 with the reason.

## 1. Question

Does any of three open-source vision systems give BuildPlan's boundary reasoning **source-supported observations it
does not already have** — exterior wall segments it misses, continuation across openings, attached-body evidence —
at a false-evidence rate and a deployment cost that would justify integrating it? A provider winning nothing is an
acceptable result (`NONE`).

## 2. Candidates and configurations (scored separately, never merged into one score)

| provider | config | what it is |
| --- | --- | --- |
| BuildPlan source-cv (baseline, **not truth**) | `SCV-LINES` | `prepareFromRaster().allSegments`: axis-aligned runs + Hough on the gradient mask (production generic line layer) |
| | `SCV-WALL` | `planSheet` wall bands (adaptive ink mask, two band passes), as axis segments with thickness |
| | `SCV-SOLID` | `solidLayer` WALL parts (the wall-solid layer) |
| | `SCV-BOUNDARY` / `SCV-BOUNDARY-GAP` | `boundaryExtension` wall-line pieces and their classified gaps (DRAWING_BREAK_SUPPORTED / OPENING_SUPPORTED / UNKNOWN_GAP / TRUE_EXTERIOR_GAP) |
| | `SCV-OUTLINE`, `SCV-BUILT` | the opening-aware outline (exclusion policy) and the default reading's BUILT cells |
| | `SCV-UNION` (scoring only) | the union of SCV-LINES, SCV-WALL and SCV-BOUNDARY pieces + bridged gaps: "what source-cv already has" |
| ELSED @ `1878213b` | `ELSED-DEFAULT` | upstream defaults (`PYAPI.cpp`): sigma 1, gradientThreshold 30, minLineLen 15, … |
| DeepLSD @ `f7d9d625` | `DEEPLSD-MD`, `DEEPLSD-WF` | upstream quickstart detection config (`merge False, filtering True, grad_thresh 3, grad_nfa True`), MegaDepth and Wireframe checkpoints |
| | `DEEPLSD-MD-REFINE-SCV` | the upstream line refiner (`line_refinement.py` config: VPs on) applied to BuildPlan's own `SCV-LINES` |
| MobileSAM @ `f706ad9c` | `MSAM-BOX`, `MSAM-SOURCE-PROMPTS`, `MSAM-AUTO` | §5 |

No provider threshold is tuned per provider, per house or after seeing results. Upstream defaults are used throughout.

## 3. Same-input rule

Every provider sees the same decoded pixels per frame. The frame is the variant the production pipeline uses, decoded
by the production `decodeImage` from the sealed offline byte cache (byte SHA-256 checked against the package). The
decoded RGBA is written losslessly (PNG) once; line providers read the production Rec.601 luma (`toGray`, stored
R=G=B, read as channel 0 — no second conversion); MobileSAM reads RGB (alpha dropped; every frame is opaque).
source-cv runs inside the same process on the same `Raster`. Model-internal normalisation is recorded per provider
(`source-manifest.json`). No image is cleaned, cropped, rotated or resized for any provider. No EXIF orientation is
applied by the production decoder; none is applied here.

## 4. Observation schema (research only)

`research/analyzer-005i-boundary-bakeoff/observation.ts`: `BoundaryObservationCandidate { id, provider, configId,
sourceFrameId, kind ∈ LINE_SEGMENT | WALL_CONTINUATION | REGION_MASK | CLOSED_REGION, geometry (SEGMENT | POLYGON |
MASK-by-hash), confidence, provenance, preprocessing, configHash }`, all in frame pixels (origin top-left, y down).
Masks stay outside the repository; only their hash, area, bbox and component count travel.

## 5. MobileSAM prompt protocols and mask selection (fixed before scoring)

All prompts are derived automatically, with no access to truth and no human click:

- **MSAM-BOX** — box = the production plan extent (`planExtent` on the frame: the dimensioned extent its dimension
  chains state, or the wall witness when no chain states it), grown by one wall (`wallPx`, the sheet's wall thickness)
  on every side, clipped to the frame. `multimask_output=True`; **the mask with the highest predicted IoU** is kept.
  On the synthetic corpus the extent comes from the same production function with no chains read
  (`planExtent([], bands, wallPx, witness)`, the wall witness — §7.1); it is never taken from the truth.
- **MSAM-SOURCE-PROMPTS** — points only. Positives: the centres of the **three largest enclosed BUILT cells** of
  BuildPlan's own default decomposition (source-cv + boundary evidence); ties by area, then y, then x. Negatives: the
  four corners of the extent grown by two walls, clipped 2 px inside the frame. `multimask_output=True`; highest
  predicted IoU. **This mode depends on BuildPlan source-cv and is not an independent detector.**
- **MSAM-AUTO** — `SamAutomaticMaskGenerator(points_per_side=16)`, upstream defaults otherwise (16, not 32, to stay
  feasible on CPU; recorded). **Selection: among masks whose bounding box lies inside the extent grown by two walls,
  the largest by area; ties by predicted IoU.** All masks are kept outside the repository so an
  **ORACLE upper bound** (best IoU among all auto masks) can be reported; it is labelled as such and is never a
  selection rule and never enters a recommendation.
- **Prompt sensitivity** (deterministic): BOX with each side moved out / in by one wall (8 variants); SOURCE-PROMPTS
  with all positives moved one wall left / right / up / down (4 variants). Same selection rule for every variant.

MobileSAM emits masks only. Nothing in this study claims it knows what a wall, garage, terrace or room is.

## 6. Ground truth

### 6.1 Synthetic (exact)

`research/analyzer-005i-boundary-bakeoff/synthetic/generate.py` draws 23 plans from metric specifications (fixed
seed per case, 45 px/m, exterior walls 0.40 m = 18 px, partitions 0.12 m) at 2× supersampling, box-averaged to 1×.
Truth is exact in the image's pixel frame after every geometric degradation: exterior polygon (outer faces), inner
face, every wall-face line, attached bodies (MAIN / WING / GARAGE / BAY / CONNECTOR), exclusions (TERRACE / PERGOLA /
RECESS / COURTYARD), opening runs on the outer face (WINDOW / DOOR / GLAZED / GARAGE_DOOR), rooms, and distractors
(dimension lines, text boxes, hatch regions, terrace and pergola lines). Cases: rectangle, L, U, bay window, attached
garage, recessed entrance, terrace adjacent, pergola outside, narrow connector, garage door interruption, glazed
facade, windows breaking a long facade, double-line walls (outline + hatch style), interior partitions near
exterior, dimension lines close to the facade, hatches / floor patterns, text crossing walls, scan blur, JPEG (q30),
low contrast, skew (1.5°), rotated plan (25°), partial crop. Generator hash, per-case seeds and byte hashes are in
`synthetic-results.json`.

### 6.2 Real development set (manual, a limitation)

Seven houses, offline, from sealed packages and byte caches (`houses.json`): `dom-w-helikoniach`, `dom-w-morelach`,
`willa-miranda`, `dom-w-zurawkach`, `dom-w-azaliach` (boundary development), and `dom-pod-jarzabem`, `dom-w-arkadiach`
(blind round 7, now development: metric controls only — included to check that a boundary witness does not confuse a
metric defect with a visual defect). One frame per house: the ground plan the frozen 005H production run based the
building on (`selectedPlanFrameId`); the baseline reproduces that run's gap tallies exactly on all seven.

Truth is **an agent's manual review of the plan pixels** (zoomed crops with a labelled pixel grid, kept outside the
repository), stored in the repository only as coordinates and semantic labels
(`research/analyzer-005i-boundary-bakeoff/truth/real/<house>.json`): the exterior boundary polygon (outer faces,
house + attached enclosed bodies, recess pockets excluded), per-vertex uncertainty, attached bodies (garage, bay,
wing), exclusions (terrace, pergola, porch, paving), and the exterior opening runs. It is **never** derived from a
BuildPlan candidate, outline, mass, or from a published area, and it is not an architect's survey. Where the drawing
does not settle a vertex, the uncertainty says so. Real-plan metrics are therefore indicative, and every real-plan
conclusion must be robust to the stated per-vertex uncertainty.

### 6.3 Tolerances

- Wall thickness `t`: synthetic exact (18 px); real: the exterior wall thickness annotated per house.
- Line support band: a segment supports an exterior edge when its angle to the edge is ≤ 3° and both endpoints lie
  between `−τ` (outside) and `t + τ` (inside) of the outer face, `τ = max(3 px, 0.25 t)`; coverage is the union of the
  supporting segments' projections onto the edge.
- Region boundary tolerance `τ_b = max(3 px, 0.5 t)` (boundary precision / recall, boundary IoU band).
- Real vertices: a region metric is reported with the per-vertex uncertainty; conclusions that flip within it are
  marked fragile.

## 7. Metrics

### 7.1 Synthetic baseline inputs

The metric layer is not under test, and this harness does not run the production chain reader (OCR + metric solve)
on the synthetic sheets. The boundary layer is given:

- the **extent from the production plan-extent path itself** with no chains read — `planExtent([], bands, wallPx,
  witness)`, the wall witness (`WALL_GEOMETRY_EXTENT`) — a pure function of the pixels, nothing from the truth. The
  MobileSAM BOX prompt, the SOURCE-PROMPTS negatives and the AUTO selection window use this same extent, exactly as they
  use the production extent on the real houses. Where `planExtent` returns nothing (the double-line-walls case: no
  wall-thick ink) there is no boundary layer and no MobileSAM prompt, and the row says so;
- an **ORACLE SCALE** (the generator's metres per pixel, registration confidence 1), labelled as such. The scale only
  sets the boundary layer's metric thresholds (gap widths in metres); it is neither a prompt nor a selection.

No chains, callouts, ticks or extent sides are given. Line detectors use none of this.

### 7.2 Line providers (SCV-LINES, ELSED, DeepLSD ×3)

- **exterior-wall coverage** — covered length of the solid (non-opening) parts of the exterior edges / their length.
- **continuity across openings** — covered length of the exterior opening runs (lines inside the wall band across the
  opening: glazing, sill, frame lines) / their length.
- **long-wall recovery** — for exterior edges whose solid length is ≥ 3 m: the longest single supporting segment's
  coverage / the edge's length (mean).
- **endpoint error** — at every exterior corner whose two incident edges are solid there, the along-edge distance
  from the corner to the nearest endpoint of a supporting segment (median, px).
- **angular error** — length-weighted mean |Δθ| of supporting segments against their edge.
- **duplicate / fragmentation** — supporting segments per metre of covered edge; duplicate pairs (same edge, offset
  difference ≤ 2 px, overlap > 50 % of the shorter) / supporting segments.
- **supported line recall** (synthetic, exact) — covered length of every truth wall-face line (exterior and partition
  faces), with the same angle / offset rule against the face line itself (offset ≤ τ).
- **unsupported line rate** — fraction of segments (≥ 10 px) of which fewer than half of the samples have ink within
  2 px in the production adaptive ink mask of the same pixels (a line with no ink under it).
- **false lines from dimensions / text / hatching** — synthetic: segments ≥ 10 px lying on a truth distractor
  (within 2 px of a dimension, terrace or pergola line, angle ≤ 3°, or ≥ 60 % inside a text box or hatch region);
  real: **boundary distractors** — segments ≥ 1 m long, outside the exterior polygon by more than `τ`, parallel
  (≤ 3°) to an exterior edge within 3 m of it (dimension lines, terrace and paving edges): what a boundary reasoner
  could mistake for a facade.
- **additional useful observations not already in source-cv** — exterior solid-wall and opening-run length covered by
  the provider and NOT by `SCV-UNION`, counted only for segments whose ink support passes; plus the matching
  additional distractor length. "10× more lines" is not better: only this delta and its false share count.
- runtime, peak RSS, output count.

### 7.3 Mask provider (MobileSAM per protocol; source-cv CLOSED_REGION configs as comparators)

Region IoU; boundary IoU (band `τ_b`); exterior-boundary precision / recall (contour within `τ_b`); overreach into each
exclusion (|M ∩ E| / |E|); omission of each GARAGE / BAY / WING / CONNECTOR body (1 − |M ∩ B| / |B|); leakage through
openings (area of M outside the exterior whose nearest exterior-boundary point is on an opening run, / |R|); inclusion
of text / dimensions (synthetic: area of M on distractor boxes outside R); disconnected components (all, and those
≥ 0.5 % of |R|); prompt sensitivity (IoU of each variant with the base mask; spread of region IoU); runtime; memory.

**Architectural failure type** (deterministic, evaluated in this order, all that apply are listed):
`PAGE_OR_BACKGROUND` (|M| > 2|R|); `INTERNAL_ROOM_SELECTED` (|M| < 0.5|R| and ≥ 90 % of M inside R);
`TERRACE_INCLUDED` / `PERGOLA_INCLUDED` / `PORCH_INCLUDED` / `RECESS_FILLED` / `COURTYARD_FILLED` (overreach ≥ 0.5);
`GARAGE_EXCLUDED` / `BAY_DROPPED` / `WING_DROPPED` / `CONNECTOR_DROPPED` (body coverage < 0.5);
`LEAK_THROUGH_OPENING` (opening leakage > 2 % of |R|); `TEXT_DIMENSIONS_INCLUDED` (synthetic, > 0.5 % of |R|);
`FRAGMENTED` (≥ 3 components ≥ 0.5 % of |R|); `OK` when none applies and region IoU ≥ 0.9; `IMPRECISE` otherwise.

## 8. Failure-type scorecard rules (fixed before scoring)

For every real house × provider configuration, each class gets HELPED / NEUTRAL / HURT / NOT_APPLICABLE with the
supporting observation ids. Baselines are the same-frame source-cv layers (`SCV-UNION` for lines; `SCV-OUTLINE` for
regions).

- **Long weak exterior wall** — NA unless a truth exterior edge ≥ 3 m has `SCV-UNION` solid coverage < 60 %. Lines:
  HELPED if the provider adds ≥ 0.5 m of ink-supported coverage on such edges and its added boundary-distractor length
  near them is not larger than that; HURT if its added distractor length is ≥ 1 m and > 2× its added coverage;
  otherwise NEUTRAL. Masks: NA.
- **Wall interrupted by windows** — NA without exterior WINDOW / GLAZED / DOOR runs. Lines: HELPED if the provider adds
  ≥ 20 % of the total opening-run length beyond `SCV-UNION`; otherwise NEUTRAL. Masks: HURT if
  `LEAK_THROUGH_OPENING`; HELPED if the mask covers the building across those runs (leakage ≤ 0.5 % of |R| and
  boundary recall on opening runs ≥ 0.8) while `SCV-OUTLINE` does not (its recall there < 0.8); otherwise NEUTRAL.
- **Garage-door facade** — NA without a GARAGE_DOOR run. Lines: HELPED if the provider covers ≥ 50 % of the run beyond
  `SCV-UNION`; else NEUTRAL. Masks: HELPED if the garage body is covered ≥ 0.8 with leakage ≤ 0.5 %, HURT if
  `GARAGE_EXCLUDED` or `LEAK_THROUGH_OPENING`, else NEUTRAL.
- **Attached garage** / **bay** — NA without that body. Lines: HELPED if the provider adds ≥ 0.5 m of supported
  coverage on that body's exterior edges beyond `SCV-UNION`; else NEUTRAL. Masks: HELPED if the body is covered ≥ 0.8
  and `SCV-OUTLINE` covers it < 0.5; HURT if the body is dropped (< 0.5) while `SCV-OUTLINE` covers it ≥ 0.8; else
  NEUTRAL.
- **Exterior-vs-terrace decision** — NA without a TERRACE / PERGOLA / PORCH exclusion. Masks: HURT if any such overreach
  ≥ 0.3; HELPED if every such overreach ≤ 0.05, building coverage ≥ 0.9, and `SCV-OUTLINE` overreaches ≥ 0.3; else
  NEUTRAL. Lines: HURT if the provider adds ≥ 2 m of lines on the exclusion's outline that are not in `SCV-UNION`
  (fresh terrace edges a boundary reasoner could close onto); else NEUTRAL.
- **Main-body mask** — masks only. HELPED if region IoU ≥ 0.85 and ≥ `SCV-OUTLINE` IoU + 0.05; HURT if region IoU
  < 0.7; else NEUTRAL. Lines: NA.
- **Inner-room vs building confusion** — masks only. HURT if `INTERNAL_ROOM_SELECTED`; HELPED if building coverage
  ≥ 0.9 while `SCV-OUTLINE` covers < 0.8; else NEUTRAL. Lines: NA.

## 9. Fusion replay (§9 of the brief)

The current resolver (`decomposePlan` → `boundaryExtension` → `solveOutline` / `classifyBodies` /
`completeBoundary`) accepts **no external observation**: its only image input is the ink `Mask`, plus bands, chains,
registration and extent. There is no seam for a line list or a region mask without modifying production code.
Two research-only replays are therefore made, both offline, with the production functions imported read-only:

1. **Mask-union replay (lines only)** — `mask' = mask ∪ rasterise(provider segments, 1 px)`; the boundary layer is
   re-run with identical bands, chains, registration, extent and options. A 1-px line cannot become wall-thick ink,
   so this asks exactly one question: *would the provider's lines have changed what the resolver reads drawn across
   a gap?* (gap signatures → classes → bridging → outline). It is an out-of-contract input perturbation, labelled as
   such, not a seam. Reported: gap-class tallies, outline / BUILT region IoU against truth, before and after.
2. **Evidence availability (all providers)** — for every baseline gap of class TRUE_EXTERIOR_GAP or UNKNOWN_GAP:
   on a truth exterior edge (within `τ`): would the provider bridge it (lines: a supporting segment covering ≥ 80 % of
   the gap; masks: the mask is inside on ≥ 80 % of the gap's samples one wall inward and the gap line itself) — a
   useful bridge; on a line outside the truth polygon (terrace, pergola, paving edges): a bridge there is **false
   evidence**.

Individual providers first; combinations (`+DEEPLSD+ELSED`, `+ELSED+MOBILESAM`, …) only after the individual results
are recorded. No per-provider threshold, no per-house choice, no oracle selection, no published area.

## 10. Recommendation rule

At most one ADOPT_NEXT, and only for a material, repeatable improvement on source-supported observations (repeated
recovery of exterior-wall segments source-cv misses, correct continuation across openings, meaningful attached-body
evidence, consistent across several difficult houses, low false-evidence rate, feasible deployment on the phone's
nodejs-mobile 18.20.4 with no native addons). Not for raw line count, pretty visuals, one spectacular house, an
oracle-selected SAM mask, published-area agreement or synthetic-only success. A desktop-only winner is at best
`DESKTOP_ORACLE_ONLY`. Zero adoption is valid.

## 11. Changes after scoring started

Timeline (UTC, 2026-10-06): this file written ≈ 05:47, before any scoring; first scoring run 06:01 (one real house),
first full real-set run ≈ 06:04; the additions below 06:05–06:15 (item 4: 07:10); the synthetic-extent correction
06:21; final synthetic scoring 07:03.

**One protocol change (council review E6, 06:21).** The first synthetic extraction gave the boundary layer — and
through it the MobileSAM BOX prompt, the SOURCE-PROMPTS negatives and the AUTO selection window — the bounding box
of the TRUTH outer faces as the "oracle extent". That is a prompt and a selection window taken from the answer, which
the brief forbids, and it favoured box-prompted segmentation over the line detectors. It was replaced by the
production `planExtent` with no chains (§7.1); the synthetic source-cv boundary layer and every synthetic MobileSAM
configuration were re-run on the corrected extent, and every synthetic number in the artifacts comes from the
corrected run. The synthetic line-detector outputs do not depend on the extent and were not re-run (the DeepLSD
refinement reads only SCV-LINES, which the extent does not touch). No real-house input was affected: the real
extent always came from the frozen production metric evidence.

No other protocol, prompt, selection rule, tolerance, truth file or provider configuration was changed after scoring
started. The following were **added** after the first real-set scoring pass (06:05–06:15), each to make an existing
number interpretable; none changes any provider's own score:

1. **Trivial region comparators** `TRIVIAL-EXTENT` (the production plan extent rectangle itself) and `TRIVIAL-BOX`
   (the MSAM-BOX prompt rectangle, extent + one wall), added ≈ 06:07 after the first full real run showed MSAM-BOX
   IoUs of 0.92–0.97 on rectangular houses: without them a box-prompted mask's IoU cannot be separated from the
   information already in the box.
2. **`openingRecall`** (boundary recall sampled on the exterior opening runs) — the quantity the §8 window rule names;
   it was missing from the first scorer implementation.
3. **Fusion diagnostics**: `openingsReadAsWall` (share of the truth exterior opening-run length that the re-run
   boundary layer reads as a wall-thick piece) and a **control row `+SCV-LINES-CONTROL`** (BuildPlan's own SCV-LINES
   rasterised into the mask exactly like an external provider's lines: no external information at all). Added after
   the first mask-union replay showed large, inconsistent outline swings, to tell new evidence from perturbation.
4. A **reference row `TRIVIAL-EXTENT`** in the failure-type scorecard (07:10): the §8 mask rules applied to the
   production extent rectangle itself, so the MobileSAM cells can be read against what the box alone earns. It is
   not a provider and does not change any provider's cells.
5. Implementation choices of §8, made explicit: the long-weak-wall HURT test compares against the provider's
   **frame-level** added boundary-distractor length (conservative: it can only make HURT more likely); "lines on an
   exclusion outline not in SCV-UNION" is computed against SCV-LINES per 1-px sample on each exclusion edge that is
   not shared with the building.
