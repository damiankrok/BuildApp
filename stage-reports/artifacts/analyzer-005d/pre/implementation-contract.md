# 005D implementation contract — dimension-chain integrity, label binding, overall consensus, recovery, Evidence Pack

This contract comes from four independent, read-only reviews run on the frozen 005C analyzer code (HEAD `1b66eb9`,
analyzer code `ca97516`). Each reviewer was given only its own question and measured on the development houses' own
bytes (fetched to a cache outside the repository; no drawing is committed):

- `dimension-topology-review.md` (A) — which crossing marks are ticks
- `ocr-binding-review.md` (B) — label-to-span binding, OCR value hypotheses, independence
- `chain-hierarchy-review.md` (C) — totals, segments, roles, relations, consensus
- `resolver-recovery-review.md` (D) — first-success conflict, recovery before the published figure

Where reviewers disagree, the decision and its reason are stated. Every threshold below is either one a reviewer
measured on the development houses (with the margin it measured) or an existing constant of the pipeline.

## 1. What the reviews agree on

1. **Azalia's first wrong decision is a mark, not a number.** The mark at x = 204.5 on the overall line (y = 645.5) is
   the lower vertex of the publisher's light-grey watermark: its darkest pixel is 0.67 of the line's own contrast, it
   is 8 px wide where the end ticks are 1–2 px, and it is ink on one side for only 2 of 5 rows (A §1, §3). It passed
   `crossThickness` + `crosses()` on the adaptive mask alone; nothing compared it with the line it sits on (A P0-1).
2. **Then one ink became three witnesses.** `observationsOf` emits every candidate span of a label as its own
   decisive observation; `1055` (printed `1035`) became the only witness of 2.462 (bound to 204.5–633, 16.4 % off
   centre), of 1.8975 (bound to 77–633, 1.2 % off centre), and of the page vote's support, so `beatsLegacy` needed an
   "outright" win a single ink cannot give: LEGACY_UNCONFIRMED/WEAK at 2.462 (B P0-1, C P0-1, D).
3. **The same failure is latent on the development houses.** Watermark or planter marks sit inside overall lines on
   Marcówki (V547, V568) and G2E (H781); they read today only because their labels are read and skipping ≤ 2 marks
   happens to suffice (A P1-1, C P0-2/P1-1). 263 of 413 counted bindings on 11 houses are not their ink's unambiguous
   best-centred binding (B P0-2).
4. **Fixing binding alone is unsafe.** With the vote's alternative-bound support removed, G2E's correct incumbent
   (2.7497) would be replaced by a misread vertical overall (`1474` read `1170`) at 2.189, 20 % wrong; the e-OZE attic
   copy is already wrongly REPLACED (`1600` read `1011`). A binding fix must ship with a value-neutrality rule (B P0-3).
5. **Topology does not fix OCR.** With the overall label bound to the right span Azalia states 1055/556 = 1.8975 cm/px,
   +1.9 % from the printed truth; nothing on the ground sheet can legitimately turn `1055` into `1035`. Two
   substituted readings that agree are not evidence: unrelated labels agree by chance in 1.55 % of pairs as read but in
   20–34 % of pairs with one substitution each (B P1-1). The second ground copy is the same print (B P1-3).
6. **The resolver lets the published figure speak first.** A first reading that built a body and failed only the
   footprint check goes straight to `resolvePlan`, which marks the figure SPENT; the drawing's own as-read refutation
   (legacy e-OZE: 0.921 at the registration against 0.242 at 2.2236) is weighed only afterwards. Evidence sealed before
   metric schema 1.2.0 has no challenge path at all (D P0-1, P0-2). With the figure unspent, today's resolver already
   finds the right building for legacy e-OZE (D §6).
7. **Even with Azalia's label bound right, its first reading still fails**: the depth is framed by an interior red room
   chain (x = 570, 202.5 px, read) while the exterior vertical overall (x = 24, 359.5 px, its label centred and unread)
   is ignored, and the sheet's wall witness is the logo, so neither 005B's interior refusal nor 005C's outspanned rule
   can engage (D P1-6, C §4.2).
8. **The hierarchy is post hoc and scale-dependent.** 15 of 15 sealed sum checks that "agree" rest on CHAIN_CORRECTED or
   DERIVED values; 0 as read. `chainRelations` is capped at 200 with no baseline bound; nothing downstream reads it
   (C P1-2, P1-3).
9. **A replacement made by the challenge escapes both judges** (`verdict.mjs`, `known-row.mjs` read only the
   `PLAN_RESOLUTION` entry) (D P1-5).

## 2. Decisions

### 2.1 Mark (tick) classification — `dimension-lines.ts`, reader `metrics.dimension-topology@1.0.0`

- The hit detection (`crossThickness`, `crosses`, ≤ 2 px merge) is kept unchanged as the candidate generator.
- Each candidate mark gets features from the grey channel and the mask (A §5): the line reference (paper P, line core
  Gl, contrast Cl = P − Gl, from clean positions ≥ reach from every hit), peak contrast κ, weak-side contrast κw,
  support rows per side, side width ω and whether it narrows (an arrowhead), and the chain's clean end mark.
- Reason codes, all recorded: `LIGHTER_THAN_LINE` (κ < 0.75), `FAINT_SIDE` (κw < 0.5), `ONE_SIDED` (support < n/2 on a
  side), `WEDGE_NOT_STROKE` (ω > 2t + 2 on a side that does not narrow), `DUPLICATE` (two marks ≤ reach + 1 px apart:
  the weaker), `STYLE_MISMATCH` (internal marks: κ < 0.5·κ_end or ω > 2·ω_end + 2), `NO_LINE_REFERENCE` (Cl < 24 grey
  levels or < 8 clean positions: darkness tests skipped).
- Classes: **REJECTED** ⇔ `LIGHTER_THAN_LINE` ∧ (`WEDGE_NOT_STROKE` ∨ `ONE_SIDED`). **QUESTIONABLE** ⇔ not REJECTED ∧
  (`LIGHTER_THAN_LINE` ∨ `ONE_SIDED` ∨ `DUPLICATE` ∨ `STYLE_MISMATCH`). **TICK** otherwise. Width alone, colour alone and
  darkness alone never reject (A §4 sweep: each alone demotes real marks; the conjunction demotes none of 69 real
  exterior marks on 8 houses and catches the Azalia mark).
- **Colour and text-stroke reasons are deferred** (A proposed `COLOUR_MISMATCH`, `TEXT_STROKE`): they annotate only in
  A's own contract and add an RGB path and an OCR dependency to the line reader; B5 below covers the text case
  where it matters (a mark inside the label's own box).
- **Decision (differs from A): `ticksPx` stays every candidate mark; the classes travel beside it** (`marks[]`). A
  proposed dropping REJECTED marks from `ticksPx`. That would move the page vote, the chain ids and the legacy chains on
  Marcówki and G2E (A §7 last bullet), whose models are pinned, for no gain the metric layer cannot make itself: the page
  vote is the incumbent, and the 005B solution already decides whether it is confirmed, kept or replaced. The classes
  are consumed by (i) the binding of every reading (§2.2), (ii) the cutting of chains read again at a replaced scale
  (a REJECTED mark is no cut; a QUESTIONABLE one costs nothing to skip), and (iii) the Evidence Pack. On a frame whose
  scale is CONFIRMED or kept, nothing a class says moves a model — the same rule 005B kept for re-reads.

### 2.2 Label-to-span binding — `metric-solution.ts`, solver `metrics.independent-scale@1.1.0`

- **B1 Candidates** as today (≤ 2 skipped marks, centred within 0.3·L), plus: a span never ends at a REJECTED mark, and a
  REJECTED mark is not counted as skipped (A, C 4.1 "never end at a FOREIGN mark").
- **B5** A mark strictly inside the label's own box is neither a span end nor a skipped mark for that label (B P1-4).
- **B2 One primary binding per ink and orientation**, chosen lexicographically by: (a) eligible (offset share
  s = |label centre − span centre| / L ≤ 0.10); (b) fewer QUESTIONABLE ends; (c) smaller s; (d) fewer skipped TICK marks.
  (b) before (c) is C's rule that a questionable end must not win on centring alone: on G2E the label printed 4.5 % off
  the true centre to clear a planter is otherwise "centred" on a planter-to-planter span (C P0-2).
- **B3 Only the primary binding can be decisive** (span ≥ 25·tol, cap height ≥ 10 px, no leading zero, as 005B).
  Calibration: correct overall bindings measure s ≤ 0.069 on 37 spans; the false ones 0.147–0.165 (A, B).
- **B4 AMBIGUOUS binding**: another eligible candidate with the same QUESTIONABLE-end count, s within 0.05 of the
  primary, and a length differing by ≥ 3 % → the ink is AMBIGUOUS: its candidates are recorded (≤ 3), none counts.
- Every observation records its binding: `bindingRole` (PRIMARY / ALTERNATIVE / AMBIGUOUS), `offsetShare`,
  `skippedMarks`, `questionableEnds`, `spanRole` (§2.4).

### 2.3 Independence and OCR value hypotheses

- **I1** Text regions are built from label-sized tokens only (`dimensionLabels`); a page-sized pseudo-token never merges
  inks (B P1-2: one 683×348 px token merged 193 tokens on Azalia).
- **I2/I3 One ink counts for at most one scale, and one counted set serves everything**: hypotheses, rivals,
  `confidenceOf` and the page vote's support. The vote's support counts an ink only if its PRIMARY binding fits the
  vote's scale (Azalia: 0 groups → the selected 1.8975, an overall reading, replaces it as WEAK).
- **I4** A value proposed because it fits a scale is DERIVED and never a witness: CHAIN_CORRECTED segments, lattice
  fits, agreement between two substituted readings.
- **I5** Copies of one drawing count once (`PARALLEL_COPY_OF`, §2.4).
- **V1 Bounded value hypotheses per ink**: the as-read string; ≤ 4 one-substitution readings whose glyph ratio
  (alternative ÷ winner) ≥ 0.7; the other way up (already decided by orientation). Two substitutions never qualify.
- **V2** Only the as-read value, in the decided orientation, is a witness.
- **V3 Neutrality**: an ink does not decide between the selected scale and the page vote's (REPLACED vs kept) when one of
  its bounded hypotheses, on its primary binding, fits the other side within the pixel tolerance. The deciding evidence
  is rebuilt without such inks before `beatsLegacy`. (B: without V3, G2E's correct incumbent is replaced 20 % wrong.)
- **V4** When the selected scale's deciding ink has bounded alternatives inside the plausible band that move the scale
  by more than the tolerance, the solution records `VALUE_AMBIGUOUS` with the implied interval, and its confidence is
  capped at WEAK. The published figure never chooses among the alternatives.
- **V5 Cross-sheet value selection — phase 2, measured before it is kept.** An as-read value printed on another sheet
  of the same package may select one of an ink's bounded hypotheses, never counted as a witness on the target sheet,
  only when: the selected value is in the ink's bounded set and the as-read value is not; the other sheet prints it
  as read (not chosen by any scale); and a scale-free check holds — the ratio of two such values equals the ratio of
  two outer spans on the target sheet within the summed pixel tolerance. B measured Azalia's site plan (`1035`, `670`
  as read; 1035/670 = 1.5448 against 556/359.5 = 1.5466, 0.12 %; `1055/670` misses by 1.81 %). It is implemented only
  after §2.1–2.6 are measured, and kept only if no development house changes value through it.

### 2.4 Dimension graph, roles and hierarchy — `metric-solution.ts` (recorded in schema 1.3.0)

- **Marks, lines, labels, spans** are recorded per plan frame: every mark with its class and reasons; every bound span
  with its endpoints, axis, skipped marks, role, bound text regions and binding state.
- **Span roles from geometry only, never from the number** (C 4.2): `OUTER_TOTAL` (a span whose ends are the outermost
  TICK marks of a line lying outside every wall-thick run of ink between its ends — the outermost line on its side —
  covering ≥ 0.8 of the union of such lines on its axis), `PARTIAL_TOTAL` (a span over ≥ 2 spans of a parallel line),
  `INTERNAL_SEGMENT` (one interval of a line with ≥ 3 TICK marks, and every span on a line crossing wall ink).
- **Relations** (C 4.4), only between parallel lines on the same side within 4 label heights: `TOTAL_OF` (span ends
  coincide with marks k and l of the other line, ≥ 1 TICK inside), `SEGMENT_OF` (inverse), `NESTED_IN`,
  `PARALLEL_COPY_OF` (the same marks on another line ±2 px, or the corresponding span on another copy of the drawing),
  `CONFLICTS_WITH`. Check states on values **as read**: `AGREES_AS_READ`, `INCOMPLETE`, `CONFLICT_AS_READ`,
  `AGREES_AFTER_CORRECTION` (recorded, never evidence). Nothing is re-read to make a check close. Bounded: ≤ 200
  relations with TOTAL_OF/CONFLICTS_WITH first.
- **Consensus (C 4.5, kept within 005B's tuple)**: the tuple stays [axes measured, corroborated, overall reading,
  groups, weight] — now over primary bindings only, so a partial binding of an ink that measures a total can no longer
  rank. An `AGREES_AS_READ` family counts as one group. Changing the tuple's order further (C proposed OUTER-first keys)
  is not needed by any measured case and would move relations on houses that are right today; it is left as debt.
- **Real segmented chains stay segmented**: a TICK is never skipped by a rule; 17 real internal marks on the exterior
  lines of 8 base frames are TICKs (C §5) and labels centred on their own segments keep them primary.

### 2.5 Overall span frames the axis — `plan-decomposition.ts` (`planExtent`)

- When an axis is framed by a chain whose spans are `INTERNAL_SEGMENT` on an interior line (it crosses wall-thick ink),
  and an `OUTER_TOTAL` span on the same axis — read or not, with its label centred on it (s ≤ 0.10) — contains it and is
  wider by more than a wall, the axis is framed by the outer span's end marks (`OUTER_TOTAL_MARKS`), and the framing
  chain is recorded refused (`INTERIOR_OUTSPANNED`). The 005B guard holds: a refusal only ever widens.
- This is the dimension graph's statement of where the building's faces are; it does not need the wall witness, which
  is a logo on Azalia (D P1-6). Measured on every development house before it is kept: it may move no frame that is
  right today.

### 2.6 First-success conflict challenge and recovery — `plan-resolution.ts` 1.4.0, `reconstruct-v2.ts`

- **R1 Order.** After the first reading is composed, compute `sourceConflict` from the metric evidence, the base sheet
  and the draft only — never `publishedAreas`. If the first reading has a world frame and a body, and its BLOCKING
  reasons other than `FOOTPRINT_AREA_*` are none, and (the existing weak-metric trigger or a source conflict), the
  challenge runs BEFORE the footprint verdict is acted on.
- **R2 Triggers** (any; each records its code, evidence ids and numbers):
  - T1 `AS_READ_REFUTATION` (all schemas): the registration contradicts ≥ 0.5 of the as-read chain length
    (WITNESS_SHARE.major) and an alternative scale contradicts ≤ 0.25 less (WITNESS_SHARE.substantial).
  - T2 `PARTIAL_BINDING` (≥ 1.2.0): the registration rests on an ink whose primary binding is a wider span.
  - T3 `OUTER_TOTALS`: ≥ 2 as-read substantial readings on distinct chains covering both axes agree on a scale more than
    5 % from the registration, with more length than its own as-read support.
  - T4 `HIERARCHY_CONFLICT` (≥ 1.3.0): a `CONFLICT_AS_READ` family where the registration's decisive witness sits on one
    side and the other side, as read, states a plausible different scale.
  - Corrected-anchor share is reported as the why, never a trigger (D P2-8: it misfires on Kosaćce).
- **R3 Alternatives.** ≥ 1.2.0: the metric hypotheses (≤ 2). Pre-1.2.0: `latticeScales` on the base copy — the generator
  `resolvePlan` already uses. Extent and tiling stay the first reading's.
- **R4 Winner by the drawing.** The incumbent is scored with gate refusals excluding `FOOTPRINT_AREA_*`; a challenger
  must be strictly better on the drawing's tuple (hard problems, non-figure refusals, refuted share as read, wall
  coverage, corroborations). The figure is in no comparator.
- **R5 The figure verifies or vetoes.** The winner's gate applies the figure through the existing `acceptable()`:
  AGREES → accept, NEAR → needs ≥ 1 corroboration, none published → ≥ 2, WRONG → veto. The record says
  `publishedFigure: VERIFIED`: it refused nothing, so it is not SPENT.
- **R6 Never silent.** A trigger fired, a challenger strictly better on the drawing, and none acceptable (vetoed or
  unverified) → refuse `PLAN_RESOLUTION_INCONCLUSIVE` with why `SOURCE_CONFLICT`, naming the as-read anchors, both
  scales, both refuted shares and the figure's bucket for each. Not the incumbent the drawing refutes; not
  `resolvePlan` (the figure would choose). No challenger strictly better → today's path; a pass on a scale a trigger
  contested carries a DEGRADING `SCALE_DISAGREEMENT`.
- **R7 Failed first readings.** `resolvePlan` as today, plus: for readings departing in SCALE the refuted share ranks
  before the footprint bucket, and a reading whose refuted share is ≥ 0.5 is acceptable only with ≥ 1 corroboration.
- **R8 Refutation basis for ≥ 1.3.0 evidence**: the metric layer's primary bindings (as read, decided orientation), not
  the legacy chain segments that bound Azalia's label to the watermark span.
- **R9 Records.** The challenge record carries chosen area, bucket, residual, corroborations, figure use, trigger codes
  and evidence ids; `verdict.mjs` and `known-row.mjs` read `PLAN_RESOLUTION` or a `METRIC_CHALLENGE` that replaced the
  first reading, with the same residual and witness rules (a protocol fix made before the freeze and documented).
- **R10 Witness honesty.** A challenge winner is corroborated by ISOTROPY only when the other axis carries its own as-read
  substantial reading; CROSS_COPY only when the other copy's registration rests on different printed text. The
  refutation margin is never a corroboration: legacy e-OZE resolved by challenge is "figure-verified, unwitnessed".

### 2.7 e-OZE gate split

- **CURRENT e-OZE** (`rarytasy-eoze` development row, today's reader): `MUST_COMPLETE` — PASS, model unchanged unless a
  change is explained; no trigger fires on it (D §6).
- **LEGACY e-OZE** (`eoze-every-copy`, `eoze-area-copy-alone`, sealed 005A evidence): `LEGACY_EVIDENCE_COMPATIBILITY`.
  Passes iff (i) completed with one body through a `METRIC_CHALLENGE` that replaced the first reading on trigger
  `AS_READ_REFUTATION`, at a scale not within 3 % of the corrected registration, |residual| ≤ 6 %, figure VERIFIED (never
  SPENT); or (ii) the exact named refusal `PLAN_RESOLUTION_INCONCLUSIVE`. Fails on completion at the corrected scale,
  a residual over 6 %, a completion with the figure SPENT, any other code. It never counts as current development
  acceptance. Decoy rows (the figure ×1.25 and ×0.8) must refuse by name (D P2-7: today ×1.25 passes silently at 2.50).

### 2.8 Analyzer Evidence Pack — `packages/evidence-pack`

- A pure, browser-safe package that builds a pack from what a run already wrote (source package, observation graph,
  metric evidence, plan digest, trace, result or failure, model, performance), so it is observational by
  construction: no analyzer module imports it, and the run's inputs, ordering, timeouts and seeds never see it.
- Evidence mode: `ANALYZER_EVIDENCE=1` (or `--evidence <dir>`) on the run script; OFF by default. A sealed test proves
  the result, model, scene and metric-evidence hashes are identical with the mode ON and OFF.
- Files 00–18, `evidence-summary.svg`, `README.md`, `manifest.json`: SVG primitives in the frame's pixel coordinates
  (wall bands, dimension lines, marks by class, OCR boxes with their raw text, span hypotheses, scale and extent
  hypotheses, envelope candidates, openings, bodies, the selected layout) with JSON sidecars carrying stable ids,
  decision, reason code, confidence, alternatives, support and conflict ids; a decision timeline; a first-divergence
  helper over two packs; a manifest with every version, the git SHA, the package, model and scene hashes, the result,
  the first typed warning or failure, and every emitted file's SHA-256.
- No publisher pixel is ever embedded: SVGs carry no `<image>`, no `data:` URI; the preview PNG is the analyzer's own
  model render, downscaled. Size bounds: SVG elements, JSON size, visualized candidates (top K + rejected summary,
  never omitting the winner or a failure-relevant candidate), preview resolution, packs per stage.

### 2.9 Versions

- Metric evidence schema **1.3.0** (marks, bindings, spans, roles, relations with check states, value hypotheses);
  reader `metrics.numeric-ocr@1.2.0` / `metrics.dimension-topology@1.0.0`; solver `metrics.independent-scale@1.1.0`.
- Plan resolver **1.4.0** (source-conflict challenge, VERIFIED figure use, SOURCE_CONFLICT refusal, R7/R8).
- Boundary evidence 1.0.0 and generic reader 1.2.0 unchanged.

## 3. What must not change (gates)

- Marcówki, Kosaćce clean and tracked: PASS with their pinned models; dom-w-modrzykach and dom-w-jablonkach PASS;
  willa-miranda and dom-w-zurawkach built within 6 % with their bodies; alt-Marcówki and Aster VIII stop by name;
  current e-OZE PASS. Any model hash that moves is explained in the report.
- G2E: its scale must not move to a misread (V3); its warning may change only with its evidence.
- No published figure chooses a scale, a binding or an OCR value. No project-name or benchmark-dimension literal in
  production code (the hard-code guard gains Azalia's identifiers and its printed overall dimensions).

## 4. Order of work

1. Reviews and this contract (this commit).
2. Evidence Pack framework (observational; deterministic; ON/OFF identity test).
3. Mark classification; binding, independence and neutrality; dimension graph, roles and relations; schema 1.3.0.
4. Overall span frames the axis (§2.5), measured.
5. Resolver 1.4.0 (§2.6) and the e-OZE split (§2.7); verdict/known-row records (R9).
6. Synthetic topology, OCR/binding, metamorphic and negative tests; the development matrix with Evidence Packs.
7. V5 (phase 2), only if measured safe.
