# STAGE BUILDPLAN-ANALYZER-005I — parallel dimension topology, boundary observation bake-off, blind round 8

| verdict | result |
| --- | --- |
| **DIMENSION TOPOLOGY (production)** | **PARTIAL**. The blind-7 defect is fixed generically. On the same bytes, the label-ink marks are rejected, `1100` binds to the overall line and `900` to its own, and the scale is REPLACED / STRONG at the drawing's 2.80 cm/px. `dom-pod-jarzabem` now completes (191.0 m²) where it refused. Every production item of the pass rule (§56) holds except the last: distinct parallel axes, fake text ticks controlled, multi-hypothesis bindings, global deterministic assignment, supported short end spans kept, ambiguity refused, walls only refute, OCR byte-identical, no unexplained regression, bounded runtime, CI green. **But both fresh blind houses are ALGORITHMIC_FAIL** — on boundary interpretation downstream of a correct metric — so the production verdict is PARTIAL (brief §48) (§B–§J, §N–§P) |
| OLD BLIND-7 FIX | **PASS**. The old FIRST_BAD_DECISION (label ink as ticks → greedy binding → end-stub trim, class DIMENSION_TOPOLOGY) is gone. The house still misses the footprint by −11.88 %; its new first bad decision is BODY_RELATION (§B, §H) |
| OCR REGRESSION | **PASS**. Every OCR token and numeric lattice on all 24 development rows is byte-identical to 005H (§I) |
| DEVELOPMENT MATRIX | **PASS**. 24 rows, no verdict and no verdict condition changed; 20 models byte-identical; four movements explained, one of them the target fix; e-OZE PASS (§H, §I) |
| SYNTHETIC CORPUS / MUTATIONS / ORDER | **PASS**. 116 / 116 cases, every family of §18; M1–M5 caught at the frozen code; 135 sealed frames × 24 shuffles, nothing moved (§E–§G) |
| PERFORMANCE | **PASS**. Largest neighbourhood met: 7 labels; 143 ms of assignment over all 135 frames; work-bounded with a recorded gap and a heartbeat (§J) |
| RESEARCH / PRODUCTION ISOLATION | **PASS**. Gate green; production hashes unchanged with the harness present; the APK carries no research asset (§K, §T) |
| **BOUNDARY OBSERVATION BAKE-OFF (research)** | **PASS_RESEARCH**. ELSED, DeepLSD (two checkpoints and refine) and MobileSAM (three prompt modes) against source-cv. Same inputs, hash-checked; 23 synthetic cases with exact truth and 7 hard real houses; licensing split into code / weights / data; runtime and deployment measured; per-provider failure analysis; zero production dependency (§L) |
| BEST_BOUNDARY_CANDIDATE | **NONE**. ADOPT_NEXT: none. ELSED **DEFER**; DeepLSD **REJECT**; MobileSAM **REJECT**. PRODUCTION_INTEGRATION: NONE_IN_005I |
| POST-IMPLEMENTATION COUNCIL | **PASS after fixes**. Five reviewers, no P0; six P1 fixed and held by tests (§M) |
| BLIND ROUND 8 / PROJECT 1 (`dom-w-gozdzikowcach`) | **ALGORITHMIC_FAIL**. `PLAN_RESOLUTION_INCONCLUSIVE`: 105.47 m² against 132.52 m². Metric CONFIRMED and extent right. FIRST_BAD_DECISION **BODY_RELATION**: a recessed entrance porch between two wings, merged with the garage door into one 7.76 m OPEN_SIDE, leaves the hall and stair column out (§O, §P) |
| BLIND ROUND 8 / PROJECT 2 (`dom-w-cyklamenach`) | **ALGORITHMIC_FAIL**. `PLAN_RESOLUTION_INCONCLUSIVE`: 49.20 m² against 92.48 m². Metric CONFIRMED and extent right. FIRST_BAD_DECISION **BOUNDARY**: window glazing against a textured terrace read as a pattern, and the 40 m² living-room block's completion rejected as NO_CONTINUATION (§O, §P) |
| INHERITED ARM64 DEVICE PARITY (005H) | **PENDING**. No physical phone result was supplied during 005I; not faked (§Q) |
| **Stage** | **PARTIAL**: `PARTIAL_BUILDPLAN_ANALYZER_005I_BLIND_8_BOUNDARY_INTERPRETATION_FAIL`. Not patched after the draw (protocol) |


- **Branch:** `analyzer/dimension-topology-boundary-bakeoff-v1` (every push also to `claude/new-session-3kzcgh`), from
  `analyzer/external-numeric-recogniser-v1` @ `29ab643a6e1b8e9e9f07bbdecd8cc12e63860c0e`.
- **Legacy:** `BuildPlan-PC-Legacy` was not touched.
- **What the repository holds:** no publisher drawing, page, crop, glyph bitmap, overlay, provider output image or model
  file. It holds text facts, hashes, numbers, the analyzer's own SVG primitives and the research harness's source. The
  boundary bake-off's checkpoints, virtual environment, frames and outputs stay outside the repository, pinned by
  SHA-256.
- **Two tracks, two verdicts.** Track A changed production: dimension topology. Track B is research only: no production
  file imports, packages or names any of it (§K).

---

## A. Single-repository audit — PASS

- **Canonical repository.** `damiankrok/BuildApp` is canonical, and every 005I commit is in it.
- **Legacy, untouched.** The Legacy checkout (`damiankrok/BuildPlan-PC-Legacy`) stays at
  `b0e79675c7ebeacf718cd1392f62272fb400418b` with no local change, at the start and at the end of the stage. Nothing in
  005I reads it, depends on it, branches it or pushes to it.
- **Git hygiene.** No history was merged, force-pushed, reset or rewritten.

## B. The defect (blind round 7 #1, `dom-pod-jarzabem`)

`artifacts/analyzer-005i/baseline.md` reproduces it from the sealed 005H run. A left margin carries two parallel vertical
dimension lines 23.5 px apart: the overall `1100` and, nearer the building, the parts `250 / 100 / 900 / 100`. Each
number is printed left of its own line (ISO 129), so the parts' numbers sit **between** the two lines. Three decisions
went wrong, in order:

1. **Label ink as ticks** (`DIMENSION_TICK_CLASSIFICATION`, `e00038` / `e00039`). The `1100` left of the overall line
   and the `900` right of it put ink on both sides of the line, which is what a crossing mark is to the hit test.
2. **Greedy binding** (`LABEL_BINDING`, `e00276`). Labels were handed out nearest first. The `900` and both `100`s were
   a fraction of a pixel nearer the overall line and took its intervals; the `1100` was left with nothing.
3. **End-stub trim** (`EXTENT`, `e00398`). With the depth read from the inner chain alone, its unread `100` end segment
   was trimmed; the frame stopped 0.9 m inside the house and the run refused `BOUNDARY_RESOLUTION_INCONCLUSIVE`.

**FIRST_BAD_DECISION (old):** decision 1, class **DIMENSION_TOPOLOGY**. Not OCR: the external reader read the
overalls right and the OFF replay fails at the same place.

## C. What was built (Track A, production)

`artifacts/analyzer-005i/architecture.md` is the map. The contract is the brief's §7 chain, unchanged: pixels →
observations → dimension topology candidates → metric evidence → deterministic resolver → model → geometry. Nothing
emits a building dimension, bypasses the resolver or lets reconstruction repair metric evidence. OCR is frozen.

| layer | where | what |
| --- | --- | --- |
| text vs ticks (§11) | `source-metrics/src/dimension-lines.ts` `markLabelInk` | a crossing mark's ink on each side of its line is traced to the glyph boxes of printed labels. Both sides label ink → REJECTED `TEXT_INK`; one side → at most QUESTIONABLE (a label may hide a real tick). A stroke reaching the line between labels keeps its class (contact test). Only labels printed **along** the line, and only **numerals**, count. Boxes, text axes and digit-or-not only — never a value |
| measurement chains | `source-metrics/src/extract.ts` | every line as found (what OCR reads, unchanged); the record of every mark; the measurement chains the solvers read, label-ink marks removed |
| global binding (§12–§13) | `source-metrics/src/axis-topology.ts` `assignLabels` | every label gets every line it could be printed on, with its offset in label heights, the **page** side of its ink (BEFORE / ACROSS / AFTER) and whether that side is against the **sheet's** convention; labels competing for an interval form a neighbourhood solved **exactly** (Hungarian, canonical order); a label an alternative within 0.1 text height would move is **AMBIGUOUS and bound to nothing**. Replaces the greedy binding everywhere: the page vote, the per-orientation bindings and the final re-read. Work-bounded (§I) |
| axis groups (§10, §14) | `axis-topology.ts` `dimensionAxisGroups` | parallel lines overlapping by half and within 4 label heights are one group, members distinct; `SUBDIVIDES` / `CONTAINS` / `OVERLAPS` from marks alone, in canonical order; roles OVERALL / SUBDIVISION / PARTIAL / INDEPENDENT; whether a neighbour **ends** where the line ends |
| side convention | `axis-topology.ts` `sideConventionsOf` | per axis, from the sheet's uncontested labels: STATED (≥ 4, 4:1), CONTRADICTED (≥ 2 against, no side preferred), or the ISO side |
| short end spans (§15) | `reconstruction/src/plan-decomposition.ts` | an unread short end segment is kept when the drawing states it: ticks at both ends **and** a number bound to it, or a neighbouring line ending at the same tick. Every keep / trim is recorded |
| wall refutation (§16) | `plan-decomposition.ts` `refuteByWalls` | two or more walls running past a dimension-framed side contradict it; the side moves only to where a dimension line out there **ends**, and only if no two walls still run past; otherwise DOWNGRADED. Either way the frame is **weak**: the resolver weighs it. A side the drawing's own overall frames is never asked. Walls never state a metric value |
| record | metric evidence 1.7.0 (no recogniser) / 1.8.0 | `TEXT_INK`, `segments[].labelled`, `chains[].topology`, `dimensionTopology[]` per plan frame; all of it in the set's content hash (post-review D1) |
| evidence (§51) | evidence pack 1.1.0 | `DIMENSION_AXIS_GROUPS` and `LABEL_ASSIGNMENT` stages, `07b-dimension-topology.{svg,json}`, end spans and refutations in the extent record and its events |
| versions | — | `metrics.dimension-topology` 1.2.0, `metrics.axis-topology` 1.1.0, reader 1.4.0, independent solver 1.4.0, `plan-extent` 1.0.0 |

**On the blind-7 plan, offline, same bytes** (`baseline.md`): the marks at 396 / 411 px are REJECTED `TEXT_INK`;
`1100` is bound to the overall line over 204–596 px and `900` to the parts line; the scale is REPLACED / STRONG at
2.797 × 2.806 cm/px (005H: 2.716, LEGACY_UNCONFIRMED); the south side is the drawn south wall. **The old first bad
decision is gone.**

## D. Non-circularity (§8) — PASS

`tests/architecture/dimension-topology.test.ts` (10 cases):

- the topology module imports pixel types, the reader's token and grammar, and the chain types only;
- no topology function names a published figure, an area, a reconstruction, a house, an answer, a truth, an oracle, a
  benchmark, a specification or a target;
- the import closure of everything that decides what binding sees holds no specification reader, source package,
  reconstruction or model;
- extraction calls every chain, solver and grouping step before it first reads the published specifications;
- the production entry, run on a synthetic sheet with no published facts and with two different sets, seals
  byte-identical `dimensionTopology` and `chains`;
- relabelling every label with other digits moves no binding; a candidate's cost reads no value.

A frame the walls question is weak and goes to the resolver's challenge, where the published figure may **veto** a
replacement reading but never selects one.

## E. Synthetic corpus (§18) — PASS

`artifacts/analyzer-005i/dimension-topology-synthetic.json`, at the frozen production code `c0ad2e8`: **116 cases, 116
passed**, in five suites. Pixel cases run the production path (line finding, the reader, the lattices, the page vote,
the independent solver) on drawings made in the test; token cases hold the assignment contract.

- Every one of the brief's 17 families is covered: (1) overall + inner 4, (2) midway 1, (3) nearer the wrong line 4,
  (4) / (5) nested spans 2 / 2, (6) text stroke as tick 7, (7) label on a real tick 3, (8) / (9) missing / spurious
  tick 2 / 2, (10) short terminal span 1, (11) / (12) neighbouring / overall over two 2 / 2, (13) contradictory
  arithmetic 1, (14) / (15) rotated / horizontal 2 / 2, (16) enumeration order 8, (17) refusal 2.
- The council added 12 more:
  - a grid of lettering 13 / 16 / 22 px × line separations 1.5 / 2.5 / 3.8 label heights × scales 2.0 / 2.5 / 3.2
    cm/px, with values unrelated to any house (9);
  - the other side convention, stated by the sheet (1);
  - an ISO right-hand margin (1);
  - a sparse sheet in the other convention (1).

## F. Mutations (§19) — PASS

`artifacts/analyzer-005i/mutation-results.md`. Each mutation is a temporary patch in a separate worktree; nothing is
committed. Run at `c150896`, at `5b6d14c` and at the frozen `c0ad2e8` (74 tests):

| # | mutation | at `c0ad2e8` |
| --- | --- | --- |
| M1 | greedy nearest-line assignment restored | caught: 22 of 74 fail |
| M2 | label ink becomes ordinary ticks | caught: 10 |
| M3 | short end spans trimmed again | caught: 2 |
| M4 | input order as the tie breaker, no ambiguity margin | caught: 4 |
| M5 | the published area chooses the binding | caught by the architecture test: 2 |

## G. Order invariance — PASS

`artifacts/analyzer-005i/order-invariance.json`. The topology probe replays every sealed plan frame of the final
development matrix: **135 frames, 24 seeded shuffles of labels and lines each — no decision moved, and no axis-group
relation, role or aligned end moved** (post-review D4 made the groups canonical; before it, two lines with equal ranges
could swap which CONTAINS the other). Synthetic: §16 (24 shuffles), D4 (all 24 orders of four lines), §17 (ties are
refused, never handed out by list order), and the production extraction and solver's own order tests.

## H. Development matrix (§41) — no verdict changed, every movement explained

`artifacts/analyzer-005i/development-matrix.json`. All 24 rows of the 005A–005H set plus the two round-7 houses, at the
frozen production code `c0ad2e8`: recogniser ON, Evidence Pack ON, offline from the same source packages and byte
caches, in a separate worktree with the research harness present and not invoked. Before = 005H ON (and the sealed
blind-7 runs). Columns: outcome / verdict / footprint residual.

| row | 005H | 005I | model | first divergence |
| --- | --- | --- | --- | --- |
| `alt-marcowki` | failed METRIC_RESOLUTION_INCONCLUSIVE / ALGORITHMIC_FAIL / — | failed METRIC_RESOLUTION_INCONCLUSIVE / ALGORITHMIC_FAIL / — | same | DIMENSION_AXIS_GROUPS |
| `aster-viii` | failed METRIC_RESOLUTION_INCONCLUSIVE / ALGORITHMIC_FAIL / — | failed METRIC_RESOLUTION_INCONCLUSIVE / ALGORITHMIC_FAIL / — | same | DIMENSION_AXIS_GROUPS |
| `dom-pod-jarzabem` | failed BOUNDARY_RESOLUTION_INCONCLUSIVE / ALGORITHMIC_FAIL / — | completed / ALGORITHMIC_FAIL / -11.88 % | **moved** | DIMENSION_TICK_CLASSIFICATION |
| `dom-pod-milorzebem` | failed METRIC_RESOLUTION_INCONCLUSIVE / ALGORITHMIC_FAIL / — | failed METRIC_RESOLUTION_INCONCLUSIVE / ALGORITHMIC_FAIL / — | same | DIMENSION_AXIS_GROUPS |
| `dom-w-arkadiach` | completed / PASS / -0.49 % | completed / PASS / -0.49 % | same | DIMENSION_AXIS_GROUPS |
| `dom-w-azaliach` | failed PLAN_RESOLUTION_INCONCLUSIVE / ALGORITHMIC_FAIL / — | failed PLAN_RESOLUTION_INCONCLUSIVE / ALGORITHMIC_FAIL / — | same | DIMENSION_AXIS_GROUPS |
| `dom-w-dabecjach` | failed BOUNDARY_RESOLUTION_INCONCLUSIVE / ALGORITHMIC_FAIL / — | failed BOUNDARY_RESOLUTION_INCONCLUSIVE / ALGORITHMIC_FAIL / — | same | DIMENSION_TICK_CLASSIFICATION |
| `dom-w-helikoniach` | completed / ALGORITHMIC_FAIL / -18.88 % | completed / ALGORITHMIC_FAIL / -18.88 % | **moved** | DIMENSION_TICK_CLASSIFICATION |
| `dom-w-jablonkach` | completed / PASS / -0.40 % | completed / PASS / -0.40 % | same | DIMENSION_AXIS_GROUPS |
| `dom-w-modrzewnicy` | failed METRIC_RESOLUTION_INCONCLUSIVE / ALGORITHMIC_FAIL / — | failed METRIC_RESOLUTION_INCONCLUSIVE / ALGORITHMIC_FAIL / — | same | DIMENSION_AXIS_GROUPS |
| `dom-w-modrzykach` | completed / PASS / +2.03 % | completed / PASS / +2.03 % | same | DIMENSION_TICK_CLASSIFICATION |
| `dom-w-morelach` | completed / PASS / -3.12 % | completed / PASS / -2.17 % | **moved** | DIMENSION_TICK_CLASSIFICATION |
| `dom-w-tunbergiach` | completed / ALGORITHMIC_FAIL / -0.37 % | completed / ALGORITHMIC_FAIL / -0.37 % | same | DIMENSION_AXIS_GROUPS |
| `dom-w-zurawkach` | completed / ALGORITHMIC_FAIL / -0.81 % | completed / ALGORITHMIC_FAIL / -0.81 % | same | DIMENSION_AXIS_GROUPS |
| `eoze-legacy-area` | completed / PASS / -4.37 % | completed / PASS / -4.37 % | same | NONE |
| `eoze-legacy-every` | completed / PASS / -4.21 % | completed / PASS / -4.21 % | same | NONE |
| `galaktyka` | failed METRIC_RESOLUTION_INCONCLUSIVE / ALGORITHMIC_FAIL / — | failed METRIC_RESOLUTION_INCONCLUSIVE / ALGORITHMIC_FAIL / — | same | DIMENSION_AXIS_GROUPS |
| `kosacce-area-alone` | failed PLAN_RESOLUTION_INCONCLUSIVE / PENDING_RAW_LEGIBILITY_MEASUREMENT / — | failed PLAN_RESOLUTION_INCONCLUSIVE / PENDING_RAW_LEGIBILITY_MEASUREMENT / — | same | NONE |
| `kosacce-clean` | completed / PASS / -1.33 % | completed / PASS / -1.33 % | same | DIMENSION_AXIS_GROUPS |
| `kosacce-tracked` | completed / PASS / -1.33 % | completed / PASS / -1.33 % | same | DIMENSION_AXIS_GROUPS |
| `marcowki` | completed / PASS / -0.29 % | completed / PASS / -0.29 % | same | DIMENSION_AXIS_GROUPS |
| `rarytasy-eoze` | completed / PASS / +1.51 % | completed / PASS / +1.57 % | **moved** | DIMENSION_TICK_CLASSIFICATION |
| `rarytasy-g2e` | completed / ALGORITHMIC_FAIL / -2.75 % | completed / ALGORITHMIC_FAIL / -2.75 % | same | DIMENSION_TICK_CLASSIFICATION |
| `willa-miranda` | completed / ALGORITHMIC_FAIL / -1.49 % | completed / ALGORITHMIC_FAIL / -1.49 % | same | DIMENSION_AXIS_GROUPS |

**No verdict and no verdict condition changed.** The first divergence is a topology stage on every row whose plan has
dimension lines (axis groups are new records); 20 of 24 models are byte-identical. The four that moved:

| row | movement | why |
| --- | --- | --- |
| `dom-pod-jarzabem` | refused → **completes**, 1 body, 14 openings, 191.0 m² (−11.88 %) | **the target fix.** The overall line's marks at 396 / 411 px are REJECTED `TEXT_INK`; `1100` binds to the overall line and `900` to the parts line; the scale is REPLACED / STRONG at 2.797 × 2.806 cm/px; the south side is the drawn wall. Still ALGORITHMIC_FAIL on the footprint: new first bad decision **BODY_RELATION** (the 1 m strip holding the study, a recessed entrance porch and the kitchen is decomposed as one body with a 5.3 m mouth and left unbuilt). The publisher's 216.76 m² exceeds the plan's own 19.60 × 11.00 m outline, so the 6 % bound may not be reachable from walls alone |
| `rarytasy-e-OZE` | PASS → PASS, +1.51 % → +1.57 % | a label-ink mark at 661 px on one copy's horizontal chain is rejected; that copy's page vote now reads 2.2236 cm/px and the independent solver **CONFIRMS** it, where in 005H it REPLACED a wrong vote with 2.2222. Every structure count identical |
| `dom-w-morelach` | PASS → PASS, −3.12 % → −2.17 % | the CONFIRMED copy is unchanged to 0.03 % (1.98903 → 1.98964 cm/px). Label-ink marks and the exact assignment change the INCONCLUSIVE page votes of three other copies (5.18 → 2.92, 6.49 → 4.02, 1.10 → none); registrations 5 → 4. Openings 33 → 28, doors 23 → 19, rooms 7 → 6; every opening found is still built |
| `dom-w-helikoniach` | ALGORITHMIC_FAIL → ALGORITHMIC_FAIL, footprint unchanged (77.56 m², −18.88 %) | a mark at 290 px is REJECTED `TEXT_INK` — checked on the pixels: the line is clean there, the ink is the neighbouring line's label. On a 400-px copy an INCONCLUSIVE page vote (4.474 cm/px from readings such as `/71`, `13`, `11`, `44`) no longer forms: NO_SCALE, the copy leaves registration. Dimensions move 0.05 %; openings 11 → 10, rooms 4 → 3 |

On morelach and helikoniach the opening and room counts fell, because copies whose scale came from unconfirmed votes
of misread labels no longer register. Which count is right is not established here (residual debt, §S).

## I. OCR regression — PASS; e-OZE — PASS

- **OCR** (`ocr-regression.json`): on all 24 rows every OCR token and every numeric lattice is **byte-identical** to
  005H. That covers the custom reading, the external reading and the ensemble decision. The packs' OCR stages differ
  only where they list candidates per dimension line or binding, which changed by design.
- **e-OZE**: `rarytasy-eoze` (MUST_COMPLETE) PASS at +1.57 %; `eoze-legacy-area` and `eoze-legacy-every` identical,
  with no divergence.
- **The other blind-7 house, `dom-w-arkadiach`**: PASS, −0.49 %, model identical to the blind run (not regressed).
- **CI** also runs both blind-7 houses as development rows, recogniser OFF:
  - jarzabem `complete:1`, the solver REPLACED, with overall and scale 2.80 asserted;
  - arkadiach `refuse:METRIC_RESOLUTION_INCONCLUSIVE`, as in 005H OFF.

## J. Performance (§43) — PASS

`artifacts/analyzer-005i/performance.json`. On a shared four-core container, not a phone:

| measure | value |
| --- | --- |
| sealed plan frames replayed | 135 (24 runs) |
| neighbourhoods | 733, **largest 7 labels**, every one solved exactly; none bounded, none unsolved |
| axis grouping / candidates / assignment, all frames | 74 / 19 / 143 ms; the slowest frame's assignment 14 ms |
| metric topology per run (chains, marks, assignment, page vote, solver, re-read; from the run's own telemetry) | 0.75–4.46 s of a 26–261 s metric phase |
| stress: 40 lines × 12 intervals, 480 labels | all bound, identical twice, < 2 s |
| bounds | exact up to 96 labels per neighbourhood; one solve above; **unsolved above 6·10⁸ steps** (labels left UNASSIGNED, a recorded gap), with a checkpoint heartbeat per neighbourhood (post-review D2) |
| longest telemetry gap | 3.9 s |


## K. Research / production isolation (§42) — PASS

`tests/architecture/research-isolation.test.ts` (5 cases):

- no production source names or imports anything under `research/`, and none names DeepLSD, ELSED, MobileSAM / Segment
  Anything, PyTorch, OpenCV-for-Python or a Python runtime in code. Production sources here are packages' and apps'
  `src` and `scripts`, the apps' bundler configs, `build.*` scripts, the Android app's Kotlin and Gradle, and the
  version catalog;
- `research/` is no workspace, and neither the type check nor the test runner collects it; no root, package or app
  manifest declares a research package, PyTorch, OpenCV or a Python bridge;
- no model checkpoint (`.pt .pth .ckpt .safetensors .onnx .ort .npz .npy .tflite .tar .pkl .h5 .pb .gguf`) is tracked
  anywhere; `.bin` only in the BUILDAPP-03R byte cache; the harness tracks text files only;
- the Android build declares no Python, PyTorch or OpenCV dependency and packages no research asset.

Track B's commits touch only `research/` and `stage-reports/`. With the harness present and not invoked, the
development matrix ran in a worktree of the full repository: 20 of 24 models are byte-identical to 005H, and the four
that moved are Track A's (§H). The APK carries no research asset (§T).

## L. Track B — boundary observation bake-off (research)

`artifacts/analyzer-005i/boundary-bakeoff/` (all twelve files the brief names). Methodology, providers and manifests
pinned by SHA-256. Nothing in production changed.

**What ran.** Every provider was run on the same frames, with each output recording its input PNG's SHA-256:
BuildPlan's `source-cv` (lines, wall bands, boundary pieces, bridged gaps) against ELSED, DeepLSD (MegaDepth and
Wireframe checkpoints, and its refiner on source-cv's lines) and MobileSAM (box-prompted from the production extent,
source-prompted, automatic).

- **Real set:** 7 development plans, manual truth annotated by the study agent, a stated limitation.
  - The seven: `dom-pod-jarzabem`, `dom-w-arkadiach`, `dom-w-azaliach`, `dom-w-helikoniach`, `dom-w-morelach`,
    `dom-w-zurawkach` and `willa-miranda`.
  - Every number was re-scored with the truth displaced by ±u.
- **Synthetic set:** 23 cases with exact truth.
- **Runtime:** CPU and WASM (onnxruntime-web, Node 18, one thread).

**What it found.**

- **Line providers add nothing real.**
  - `SCV-UNION` already covers ≥ 99.8 % of exterior solid wall and ≥ 97.9 % of opening runs on every real house.
    Every external line configuration adds **0.00 m** of ink-supported exterior solid wall on all 7. Their only
    synthetic gain is the 45° bay (+0.69 to +1.00 m).
  - They add terrace and paving outlines and boundary distractors: DeepLSD up to 27.8 m per house, ELSED up to 17.9 m.
- **MobileSAM's box mask is the box.**
  - Against the production extent rectangle it is prompted with, it adds +0.005 mean region IoU. The sign is fragile
    under ±u; per house the difference is −0.05 … +0.08.
  - It brings false evidence: 15 gap bridges outside the building against 7 for source-cv's lines, and terrace,
    porch and leakage failures on 3 of 7 houses.
  - It inherits the metric defect of the box it is given.
  - Source-prompted is unstable and leaks; automatic picks a room on every house.
- **Fusion has no seam.** The only probe, a mask-union replay, moves outlines by −0.74 … +0.81. A no-external-information
  control (BuildPlan's own lines rasterised the same way) moves them by comparable amounts on different houses. It
  measures ink-density sensitivity, not evidence.
- **The documented boundary failures are interpretation**, not missing perception: which gap is an opening, which part
  is a body, which outline to adopt.
- **Deployment** (against 005H's 39 419 927 B APK):
  - MobileSAM +93 %, DeepLSD ≥ +81 %, OpenCV +25 %.
  - WASM: DeepLSD fields 59.6 s and ≥ 1.2 GB; MobileSAM encoder 7.7 s and ≥ 0.64 GB. Both memory figures are RSS
    after inference, a lower bound on the peak.

| provider | licence (code / weights / data) | verdict |
| --- | --- | --- |
| ELSED | Apache-2.0 / none / none | **DEFER**: revisit only if oblique facades enter the development set; route = port the algorithm, never package OpenCV |
| DeepLSD-MD / -WF | MIT + **AGPL-3.0+** (pytlsd LSD) / MIT stated, unofficial mirror (official server 403) / MegaDepth, Wireframe | **REJECT** |
| DeepLSD refine on source-cv | + gco-v3.0 (research-only, patent notice); distro Ceres → GPL-2+ SuiteSparse | **REJECT** (also not reproducible: GC-RANSAC seeds from `std::random_device`) |
| MobileSAM BOX / SOURCE-PROMPTS / AUTO | Apache-2.0 / Apache-2.0 / SAM teacher + SA-1B images (research licence) | **REJECT** |

**BEST_BOUNDARY_CANDIDATE: NONE. ADOPT_NEXT: none.** No configuration shows a material, repeatable improvement on
source-supported observations (brief §58). Side findings, not acted on:

- On `azaliach` the production extent alone scores IoU 0.992 while the resolver's outline selects an internal region:
  a resolver decision with all its evidence present.
- `sidesOf` throws on a sheet with an extent and no wall-thick ink (`boundary-bodies.ts:157`). It is reproduced with a
  retained log, and is not reached on any scored or development run.

## M. Post-implementation council (§44) — PASS after fixes

Five independent reviewers. Every P0 / P1 is fixed and held by a test that fails when the fix is removed
(`artifacts/analyzer-005i/post-review/resolution.md`):

| reviewer | scope | verdict | P0 / P1 | fixed in |
| --- | --- | --- | --- | --- |
| A | topology | CHANGES REQUESTED | 0 / 2: wall refutation at a jamb tick, refuting outer-total sides (A1); a real tick under labels rejected (A2) | `bc22547` |
| B | boundary / CV | CONDITIONAL PASS | 0 / 1: MobileSAM's headline against a truth-selected comparator (B1) | `bfcfb1f` |
| C | licensing | CONDITIONAL PASS | 0 / 0 (refine-path and tooling licences corrected, isolation gate widened) | `7615d32` |
| D | deployment / determinism | no P0 | 0 / 1: the metric-evidence hash did not cover the 005I fields (D1); the bounded path not bounded (D2) | `c0ad2e8` |
| E | generalization / non-circularity | CONDITIONAL PASS | 0 / 2: the side cost in the reading frame, ISO hard-coded (E1); synthetic MobileSAM prompts from the truth extent (E6) | `bc22547`, Track B |

Stated, not changed: A7 (an unread, unlabelled end segment shorter than two walls is trimmed even where walls reach
into it). Changing it would be a new wall-to-dimension rule with model effects on every sheet, decided without a
development measurement. Every trim is on the record. D6: metric-evidence sets written at `c150896` are **void** —
none is committed and no figure here comes from one.

## N. Freeze — PRE_HOLDOUT_8_SHA

`869cb018cf9debe2e6b1f137a5b3d887d33aa1ee`, CI run 169 (`37464801271`, push) green: 39 jobs, 2 skipped by design
(preview and OWNER APK on push). Its production code is `c0ad2e8`'s; `c0ad2e8..869cb01` touches only `research/` and
`stage-reports/`. Every precondition of §47 held (`artifacts/analyzer-005i/blind-round/README.md` lists them). Nothing
was committed between the freeze and the draw. **No production file changed after the freeze**: everything after
`869cb01` is the ledger line, blind evidence, this report and PROJECT_STATUS.

## O. Blind round 8

`artifacts/analyzer-005i/blind-round/README.md` is the full record.

- **Draw.** Ledger line `0c67728`, 13:34:30Z.
  - **Seed:** `SHA256(869cb01… + "BUILDPLAN-005I-DIMENSION-TOPOLOGY-BOUNDARY-BAKEOFF-HOLDOUT")` = `e0ea9a35…02e4`,
    recomputed independently.
  - **Pool:** 2137 drawable, 948 excluded; 68 excluded families, the round-7 houses, their linked families and every
    bake-off house among them.
  - **Draws:** i1 609 → `dom-w-gozdzikowcach` (`…projekt-dom-w-gozdzikowcach-3-m79923e950094d`); i2 444 →
    `dom-w-cyklamenach` (`…projekt-dom-w-cyklamenach-3-s-ver-3-m1b323a6595d29`).
- **Disclosed: an exclusion gap.** Other variants of both families appear as "similar projects" links on a round-4 and
  a round-6 blind page, now development houses. Round 8 swept only round 7's links. Neither drawn page or drawing was
  ever fetched before the draw. The draw stands, and the next round should sweep every development page's links.
- **Runs.** Each address ran once, live, with the production analyzer only: recogniser ON, Evidence Pack ON, frozen
  code, no patch. One earlier launch never started the analyzer (`/usr/bin/time` absent, exit 127, nothing fetched),
  and the README records it.

| # | wall | metric phase | external OCR | peak RSS | longest telemetry gap | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 279 s | 219 s | 283 labels, all read | 949 MB | 2.0 s | **ALGORITHMIC_FAIL** — `PLAN_RESOLUTION_INCONCLUSIVE`, 105.47 vs 132.52 m² |
| 2 | 244 s | 202 s | 238 labels, all read | 928 MB | 2.5 s | **ALGORITHMIC_FAIL** — `PLAN_RESOLUTION_INCONCLUSIVE`, 49.20 vs 92.48 m² |

Both refusals are typed and build nothing. In both, the resolver found the right reading — 131.3 m² (−0.9 %) and
92.3 m² (−0.2 %) — and was not allowed to choose it, because the published figure had already refused the first
reading and so cannot also choose its replacement (non-circularity, by design).

## P. Blind diagnosis (§49)

**Dimension topology and metric were right on both blind houses.** On the selected copies, the scale was CONFIRMED by
independent readings (2.54 and 2.03 cm/px); the dimension-chain extent is within 1 % of the published footprint; the
topology layer rejected 31 and 18 label-ink marks and refused 2 and 0 labels. The failures are downstream:

| # | FIRST_BAD_DECISION | class | what |
| --- | --- | --- | --- |
| 1 `gozdzikowcach` | wide opening `opening-1` on the front line, OPEN_SIDE | **BODY_RELATION** | the recessed entrance porch's mouth and the garage door are read as one 7.76 m place where the wall stops, and the hall and stair column behind the porch — closed by an inner front wall with the 105/210 entrance door — as a 71 m² pocket; the bodies leave it out. **The same class blind-7 #1 was left with after this stage's fix** |
| 2 `cyklamenach` | the living room's window gap read as a pattern (`DASHED`) against the textured terrace fill; its double door `LEAF_FACE`; both weak | **BOUNDARY** | the envelope leaves the 40 m² living-room block open, and its box completion is REJECTED NO_CONTINUATION although its outer sides are 75 % wall: an interior junction (the room opens to the hall and kitchen) is read as a separating wall |

The opening-callout reader returned no usable value on either sheet: `180/230` was read as `416/42` on one and
`100/230` on the other, and the hall's callouts were not found. This is wrong but was not decisive, since gap
classification reads the drawing, not the callouts. It is recorded as debt.

**Research providers** (recorded after the verdicts were sealed): none would have helped. On both houses the walls,
openings and extent are already in BuildPlan's observations, and the extent rectangle a MobileSAM box would be prompted
with already gives the right footprint. These are interpretation failures — the class the bake-off names as the
remaining boundary work. Production was not re-run with any provider.

## Q. Inherited ARM64 device parity (§50) — PENDING

No physical arm64 phone result was supplied during 005I, and none was obtained here. `INHERITED_005H_ARM64_DEVICE_PARITY
= PENDING`. "Test zgodności odczytu wymiarów" is unchanged in the app (§T) and stays the OWNER's first checklist item.
005H is not retroactively a full PASS.

## R. CI

| run | event | commit | result |
| --- | --- | --- | --- |
| 161 | push | `29ab643` (start) | green |
| 162 | push | `c150896` (the topology) | cancelled by the next push |
| 163 | push | `45dd8ba` | **red**: `Analyzer / development house (rarytasy-g2e)` and `Second house / generalization` ("the garage is a gable"). A junk perpendicular `03` token and horizontal junk tokens had rejected a real tick at the garage's face as label ink → fixed in `bc22547` (label ink only from numerals printed along the line) |
| 164, 165 | push | `bc22547`, `5b6d14c` | cancelled by the next push |
| 166 | push | `16bcd73` | green |
| 167, 168 | push | `c0ad2e8`, `d59a3e8` | cancelled by the next push (same production code) |
| **169** | push | **`869cb01`** = PRE_HOLDOUT_8_SHA | **green**: 39 jobs, 2 skipped by design |
| next | `workflow_dispatch` (`owner_apk`) | the report commit | the final CI and the OWNER APK: §T |

The development rows CI runs include both blind-7 houses, with the recogniser off (`.github/workflows/buildapp-ci.yml`):

- `dom-pod-jarzabem` asserts `complete:1`, the independent solver REPLACED, the overall read and a scale of 2.80;
- `dom-w-arkadiach` asserts `refuse:METRIC_RESOLUTION_INCONCLUSIVE` with typed dimension evidence, as in 005H OFF.

## S. Commits

On `analyzer/dimension-topology-boundary-bakeoff-v1` from `29ab643`, each pushed to the branch and to
`claude/new-session-3kzcgh`:

- `c150896` — dimension topology: label-ink marks, global assignment, axis groups, supported end spans, wall
  refutation (sets written at this commit are void, D6);
- `45dd8ba` — the per-version evidence pack, the research isolation gate, the round-8 protocol;
- `bc22547` — council A / E fixes: sheet side convention, label-ink contact / axis / numeral rules, wall refutation at
  line ends;
- `c90ffd9`, `7615d32`, `6b6d147`, `bfcfb1f` — Track B: the bake-off, then the council C and B fixes (research and
  its artifacts only);
- `5b6d14c` — CI: both round-7 houses become development rows;
- `52717db`, `5f5ec4a` — mutation results; reviewer B's review;
- `16bcd73` — the verdict reads the resolved reading's witness from the step that chose it (development matrix, the
  e-OZE row);
- `c0ad2e8` — council D fixes: the hash covers topology, work-bounded assignment, canonical groups, numeric version
  compare, `plan-extent` version (**the production code that is frozen**);
- `d59a3e8`, `869cb01` — the synthetic record, mutations, development matrix, OCR regression, order invariance and
  performance at the frozen code (**PRE_HOLDOUT_8_SHA**);
- `0c67728` — the round-8 ledger line;
- the report commit — blind round 8, this report and PROJECT_STATUS; then the OWNER APK record.

## T. OWNER APK

The `workflow_dispatch` (`owner_apk`) on the report commit builds and publishes the APK. Its verification from the
downloaded file is recorded here in the commit after it.

### OWNER phone checklist (po polsku)

Zainstaluj `BuildPlan-owner-preview.apk` (numer wersji w tabeli wyżej) na poprzednią wersję, potem:

1. **Test zgodności odczytu wymiarów** (z 005H, wciąż otwarty). „Dodaj dom z linku” → „Test zgodności odczytu
   wymiarów” → „Uruchom test”, potem „Kopiuj wynik”.
   - **Zaliczony:** „Zgodny z komputerem”, korpus `734300d2…`, wynik `396c9f54…`, 92 z 96, model `9ef676d6…`.
   - **Odeślij też:** czas na etykietę, model telefonu i ilość RAM.
2. **`dom-pod-jarzabem`** (link z rundy 7). Dom ma się teraz zbudować: 1 bryła, około 191 m². Wcześniej analiza
   zatrzymywała się bez domu. Wiadomo, że wynik jest o około 12 % za mały (wąski pas z gankiem wejściowym na południu
   nie jest zbudowany). To znany błąd, nie nowy.
3. **`dom-w-arkadiach`** buduje się jak wcześniej: 2 kondygnacje, około 69,6 m².
4. **Jeden zwykły znany dom** (np. Marcówki albo Kosaćce) buduje się jak wcześniej.
5. **Postęp i przerwanie.** Podczas kroku wymiarów widać postęp i licznik etykiet. „Przerwij” zatrzymuje analizę
   w ciągu kilku sekund.
6. **Odmowa zamiast zgadywania.** Dom, którego odczyt nie jest pewny, kończy się nazwaną odmową po polsku (np. „obrys
   niejednoznaczny”). Nie ma domu o nieprawdziwym rozmiarze.

DeepLSD, ELSED i MobileSAM nie są w aplikacji i nie trzeba ich testować.

## U. Residual debt

| item | detail |
| --- | --- |
| recessed entrance between wings | blind-8 #1 and blind-7 #1 (`jarzabem`): a porch recess in a facade strip read as an open pocket or one wide body; BODY_RELATION |
| glazing against textured fill; interior junction read as separating | blind-8 #2: a window between walls read as a pattern next to a hatched terrace; a 75 %-walled block's completion rejected as NO_CONTINUATION; BOUNDARY |
| opening-callout reader on current ARCHON sheets | blind-8: no usable callout value on either sheet; not decisive this round |
| exclusion sweep | round 8 swept only round 7's links; the next round should sweep every development page's links |
| opening and room counts on morelach / helikoniach | fell when copies with unconfirmed scales left registration; which count is right is not established |
| A7 | an unread, unlabelled end segment shorter than two walls is trimmed even where walls reach into it (recorded, not changed) |
| arm64 phone parity (005H) | pending (OWNER) |
| `sidesOf` throws with an extent and no wall-thick ink | `boundary-bodies.ts:157`, reproduced in Track B; not reached on any scored or development run |
| tracked publisher bytes | `.cache/source-bytes/*.bin`, tracked since BUILDAPP-03R; none added in 005I; removal is an OWNER decision (it would not remove them from history) |

## V. Next step

Return to the coordinator. Do not self-start another stage.

- **Boundary bake-off:** no candidate earned ADOPT_NEXT, so by §59 the route is **PATH B — the PDF.js vector-document
  evidence pilot**. ELSED stays DEFER: revisit it only if oblique facades enter the development set, by porting the
  algorithm, never by packaging OpenCV.
- **The analyzer's measured failures** after this stage are boundary interpretation, not perception and not dimension
  topology. The cases:
  - recessed entrances between wings (blind-7 #1, blind-8 #1);
  - glazing against textured fill, and an interior junction read as separating (blind-8 #2).

  Whichever path the coordinator chooses, these are the resolver's next inputs. All of their evidence is already in
  BuildPlan's own observations.
- **OWNER:** run the 005H phone self-test (checklist §T, item 1).
