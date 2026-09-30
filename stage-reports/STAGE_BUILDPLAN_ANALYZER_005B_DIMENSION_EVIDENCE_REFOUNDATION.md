# STAGE BUILDPLAN-ANALYZER-005B — dimension evidence refoundation, scale/extent decoupling, blind holdout round 2

| component | verdict | in one line |
|---|---|---|
| DIMENSION ORIENTATION | **PASS** | every label is read every way up and kept; a chain decides its own orientation from evidence; the page vote can no longer delete the right reading |
| SCALE EVIDENCE INDEPENDENCE | **PASS** | an independent metric solution per plan frame; a correction made under a scale never witnesses it; confirmation never moves a model; right and independent on both new blind houses. Residual (P2): on REPLACED frames the registration's fit still anchors on corrections made at the chosen scale — the choice is independent, its residual flattered (§AJ) |
| PLAN EXTENT CLASSIFICATION | **PARTIAL** | a chain's role is decided from geometry before it may frame the building; the refusal only ever widens; the former blind house willa-miranda still fails (a partial wall witness); on both new blind houses the printed extent is right |
| OWNER DEVELOPMENT SET | **PARTIAL** | no development house regresses; Marcówki and both Kosaćce links are byte-identical; e-OZE now PASSES; dom-w-jablonkach now completes within 6 % but misses one opening; willa-miranda still fails |
| PROGRESS TELEMETRY | **PASS** | the new loops tick (orientation per chain, scale per hypothesis, extent per variant); longest silence ≤ 2.4 s one house at a time (≤ 4.9 s with eight houses on four cores; 1.9 and 2.1 s on the blind runs) |
| BLIND HOLDOUT ROUND 2 | **ALGORITHMIC_FAIL × 2** | `dom-w-zurawkach` (`PLAN_NO_MASSES`) and `dom-w-modrzykach` (`PLAN_LAYOUT_REJECTED`); on both the orientation, the scale and the printed extent are right and independently witnessed; both fail at the walled outline on a side of openings (willa-miranda's class); not patched |

**Stage verdict: PARTIAL** (`PARTIAL_BUILDPLAN_ANALYZER_005B_BLIND_WALL_OUTLINE_FAIL`). §52's rule is not met: both
new blind houses are ALGORITHMIC_FAIL (in the walled outline, not in the refactored metric layer), and of the
round-1 blind houses dom-w-jablonkach now completes but misses one opening, and willa-miranda still fails. CI is
green; that is not the verdict.

Branch `analyzer/dimension-evidence-refoundation-v1` (also pushed to `claude/new-session-3kzcgh`), from
`analyzer/generalization-council-v1` @ `bdacd42`. Legacy (`BuildPlan-PC-Legacy`) was not touched.

---

## A. Baseline — 005A PARTIAL accepted

- **Start.** `analyzer/generalization-council-v1` @ `bdacd42fa773b4d7803f334c19469e1a8a7b52b7`, verified before any
  change; the new branch was created from it.
- **005A's verdict is kept as it was:** generalization architecture PARTIAL, development cases PARTIAL, progress
  telemetry PASS, both blind holdouts ALGORITHMIC_FAIL. Its three root assumptions became this stage's input:
  1. rotated overall labels are read upside down and the right reading is deleted by a page-wide vote;
  2. a chain correction witnesses the scale that created it;
  3. the widest read chain is the building's extent.
- **Baseline measured, not assumed.** All eight development houses were run live at `bdacd42` into a scratch
  directory outside the repository (cache and output); they reproduced 005A's hashes (Marcówki `6152770f…`,
  Kosaćce `5b5ffcf1…`, G2E `8fa4a25b…`). Every "after" number in this report is an offline replay of those same
  sealed packages through today's code, with observations, metric evidence and model re-extracted.

## B. Three targeted reviews (before any code)

Three independent read-only reviewers, each told only its own question; their reports are committed in
`stage-reports/artifacts/analyzer-005b/pre/` (commit `c105add`), with the implementation contract written from them.

- **A — dimension graphics and OCR orientation** (`orientation-review.md`). P0: `dedupeOrientations` keeps one
  reading per ink by glyph merit alone, and its page-wide vote deletes every token of the losing vertical pass.
  On willa-miranda's selected plan 0 of 39 rotated survivors were the right way up. 13 of 14 leading-zero tokens
  are trailing zeros read upside down. The `1100` of dom-w-jablonkach's only overall chain was pushed off it by a
  32 px logo glyph sitting nearer the line.
- **B — scale and evidence independence** (`scale-independence-review.md`). The frame scale is a vote over readings
  the substitution lattice inflates; the chain solver then rewrites numbers to fit it and those rewrites anchor the
  registration: **0 of 120 anchors ever rejected** across four sealed sets. dom-w-jablonkach's 1.892 cm/px rested on
  6 of 6 rewritten anchors. On the houses that work, raw readings alone give the same scale within 0.03 %.
- **C — plan extent and chain role** (`extent-role-review.md`). Nothing but width among READ chains makes a chain
  "outer"; an unread overall chain is invisible; everything downstream is filtered by the chosen extent, so no later
  stage can witness against it. e-OZE, a development house, had the same defect as willa-miranda (a 68.5 px interior
  depth chain), routed around by 005A's resolver.

## C. The old dimension evidence pipeline

`readNumbers` ran three passes (0°, 90° CW, 270° CCW) and `dedupeOrientations` returned one token per ink: per clash
the higher glyph merit, and before that a page-wide vote between the two vertical passes that discarded the losing
pass outright. `solveFrameChains` assigned tokens to chains, generated reading-lattice substitutions, voted a pooled
scale across all chains (substituted readings voting nearly at full weight), then solved every chain at that scale,
rewriting readings that did not fit (`CHAIN_CORRECTED`). Every READ and CHAIN_CORRECTED segment became a
registration anchor. `planExtent` framed the plan with the widest chain carrying a READ or CHAIN_CORRECTED segment on
each axis, and the grid, wall thickness, envelope and bands were all filtered by that frame.

## D. The orientation failure mechanism

- A vertical dimension on these sheets is set bottom-to-top. The CW pass reads it; the CCW pass reads the same ink
  half a turn round: `900→006`, `1410→0111`, `920→036`, `245→5/5`.
- The page-wide vote compares the passes' summed merit and deletes the loser. A half-turn digit is often a better
  template match than the right one (`0`, `1`, `8` are symmetric; `6/9` swap), so the wrong pass can win a page.
- Nothing downstream could recover: the right readings were gone before any chain saw them, and the wrong ones
  (leading zeros, a digit too many) were "corrected" by the pooled scale into numbers that fit it.

## E. The scale self-anchoring mechanism

A misread label is rewritten to the value the pooled scale predicts for its span; that rewritten value then anchors
the registration and counts as agreement with the same scale. The support looks broad (every chain "agrees") while
resting on zero independent readings. On dom-w-jablonkach the pooled 1.892 cm/px (a 380/900 chain read upside down,
then rewritten) had 6 corrected anchors and 0 read ones; the only right-way overall reading, `1100`, had been pushed
off its chain.

## F. The extent misclassification mechanism

"Widest READ chain = building" never asked where a chain lies. When the margin's overall chain is unread (its labels
read upside down, §D), the widest chain left can be an interior one between two rooms. willa-miranda's depth came
from a 2.5 m interior chain (`114`, 355–450 px): the building was framed as a strip one room deep and 2 of 52 cells
enclosed. e-OZE's depth came from a 68.5 px interior chain, behind its 005A `PLAN_NO_WALLED_ENVELOPE`.


## G. The new DimensionObservation model (metric evidence schema 1.2.0)

- **`OcrToken.orientation`** — which pass read it (`HORIZONTAL` 0°, `ROTATED_CW` 90° set bottom-to-top,
  `INVERTED` 180°, `ROTATED_CCW` 270°); **`OcrToken.pageVote`** — `KEPT` or `DISCARDED` by the legacy page vote.
  Floor-plan frames keep every pass's readings; nothing is rewritten in place.
- **`MetricEvidence.rawText`** is now what the reader saw (it held the corrected text before, against the schema's
  own doc); **`MetricEvidence.derivation`** `{ rawText, orientation, valueText, substitutions, dependsOnScale, why }`
  whenever the value is not the raw reading, or its way up was chosen by a scale.
- **`DimensionObservation`** — one per (reading as read, span it could measure, orientation): value, endpoints, span,
  implied cm/px, OCR score and confidence, leading-zero flag, `textRegionId` (one per piece of ink, shared by its
  readings in every pass), `independence` (`INDEPENDENT | ORIENTATION_BY_OTHER_AXIS | ORIENTATION_BY_SCALE |
  ORIENTATION_UNDECIDED` — `ORIENTATION_BY_SCALE` is a reading whose way up was chosen because it fits a scale other
  labels state, and it never witnesses that scale), `status` (`RAW | ACCEPTED | REJECTED`).
- **`FrameMetricSolution`** per floor-plan frame — `relation` to the vote's scale (`CONFIRMED | REPLACED |
  LEGACY_UNCONFIRMED | ADDED | NO_SCALE`), `confidence` (`STRONG | SUPPORTED | WEAK | INCONCLUSIVE`), per-axis
  scale, anisotropy, `isotropy` (`MEASURED | ASSUMED | NONE`), ≤ 6 scale hypotheses with their witnesses, the legacy
  scale's own independent support, supporting and conflicting observation ids, per-chain orientation decisions, the
  chains re-read, counts and why.
- **`ChainRelation`** — `TOTAL_OF` (a chain spanning exactly what a finer chain divides; the value sum is recorded,
  never forced) and `NESTED_IN`.
- All of it enters the metric evidence hash; the reader is `metrics.chain-solver@1.1.0`, the solver
  `metrics.independent-scale@1.0.0`.

## H. Orientation hypotheses

- `readNumbers(raster, { hypotheses: true })` adds a fourth pass (the page turned half a turn, `INVERTED`) and
  returns `raw`, every pass's readings, beside `tokens`, the legacy vote's — which it leaves byte for byte as it was
  (metamorphic test: same tokens with and without hypotheses, on the page at 0/90/180/270°).
- Each chain decides its own orientation from the readings bound to it, strongest evidence first, and records
  how: `SINGLE_READING` (only one way up reads any dimension on it), `CHAIN_SELF_CONSISTENCY` (two of its own labels
  agree one way up and not the other), `AXIS_SELF_CONSISTENCY` (read that way, a label joins a cluster of labels
  on OTHER chains of the axis that agree — the cluster is built without this chain's inks, and the joining reading
  is `ORIENTATION_BY_SCALE`), `TYPOGRAPHY` (read the other way up, its labels start with a zero, which no dimension
  is printed with), `AXIS_MAJORITY` (the chains of the sheet that decided on their own evidence), `PAGE_UPRIGHT`,
  and `OTHER_AXIS_SCALE` (chosen by the other axis's scale — recorded as **not** independent, so it witnesses
  nothing about isotropy), else `UNDECIDED`. At most 2 orientations per label per chain (the two on its axis).
  Horizontal text is read upside down only when the inverted readings agree and the upright ones do not.
- A leading zero (`/^0\d/`) is a trailing zero read upside down and is never decisive; the resolver's lattice
  excludes it too.
- A label the span is centred on claims its interval first, so a stray glyph beside the line (a logo's "14") can
  no longer push the real overall label off its chain.

## I. Raw and derived evidence, separated

- Raw: `OcrToken` (every pass, with `pageVote`), `DimensionObservation` (every reading bound to every span it could
  measure).
- Derived: chain segments (`READ` / `CHAIN_CORRECTED` / `DERIVED`), with `derivation` on every corrected value and
  on every value whose way up a scale chose (`dependsOnScale: true`).
- Legacy readers (room labels, level datums, callouts, angles) still see only the vote's tokens (`pageVote !==
  'DISCARDED'`): the raw readings are evidence for the metric solver, not new input to readers that were never
  designed for them. (Without this, Kosaćce's room labels picked up duplicate and wrong numbers from the other
  passes — measured, and the reason for the flag.)

## J. The new scale solver (`metric-solution.ts`)

1. **Text regions** — overlapping readings from any pass are one ink, one witness.
2. **Observations** — each reading bound to the tick pair it can measure (≤ 2 skipped ticks, weight 0.7 per skip).
3. **Decisive** — span ≥ 25 × the pixel tolerance (the stated scale good to 4 %), cap height ≥ 10 px (the
   legibility the holdout protocol already holds an overall dimension to), no leading zero.
4. **Orientation per chain** (§H), then witnesses in the chosen orientation only.
5. **Hypotheses** — the counted witnesses (independent and decisive) clustered within the tolerance, the other
   readings attached to the scale they agree with (they can never merge a counted scale away), ≤ 6 kept, each with
   its independent groups, weight,
   the share of its axis its longest witness spans, corroboration (a major reading, ≥ 50 % of the axis, agreed by a
   second substantial one, ≥ 25 %, on another chain and ink), and both axes measured.
6. **Ranking** — a lexicographic evidence tuple, never a sum: `[both axes measured, corroborated, an overall
   reading (≥ 80 %), independent groups, independent weight]`.
7. **Confidence** — `STRONG` both axes and corroborated; `SUPPORTED` corroborated; `WEAK` one independent reading;
   `INCONCLUSIVE` none, or a rival of equal standing with ≥ 80 % of the weight (≥ 50 % demotes one class); a rival of
   higher standing caps it at `WEAK`. `isotropy: MEASURED` uses the same both-axes test as the ranking.
8. **Relation to the vote's scale** — `CONFIRMED` when the selected scale agrees within its own precision;
   `REPLACED` only when the vote had no independent reading and this one is SUPPORTED or an overall reading, or when
   it beats the vote outright on axes, agreement and count and is at least SUPPORTED; otherwise
   `LEGACY_UNCONFIRMED` (with the vote's own independent support as its confidence), `ADDED`, `NO_SCALE`.
9. **Chains** — where the vote's scale is CONFIRMED, a chain is read again the right way up only when that reads
   more of it (more READ segments) at that scale, from labels no other chain already reads; at an unconfirmed scale
   nothing is re-read (a re-read there only reads more agreement with an unsupported scale); it never re-fits the
   registration (only segments identical to the vote's anchor it). Where the scale is replaced, every chain is
   re-solved at the new per-axis scales, refit on independent decisive witnesses within ±5 %.

## K. The evidence independence graph

```
ink (text region) ──► readings in ≤ 4 orientations (raw, all kept)
                      │
                      ▼  bound to spans (ticks), ≤ 2 skipped
                observations ──► decisive? (span, cap height, no leading zero)
                      │
      orientation decided per chain ──► INDEPENDENT unless decided by the other axis's scale
                      │
                      ▼
      independent decisive witnesses, one per ink ──► scale hypotheses ──► selected scale, confidence
                                                                              │
      vote's pooled scale (incumbent) ◄── its own independent support ────────┤
                                                                              ▼
                                       relation (CONFIRMED / REPLACED / …) ──► chains read at that scale
                                                                              │
                         CHAIN_CORRECTED values, derivation.dependsOnScale ◄──┘  (downstream only, never a witness)
```

The only arrows into a scale come from independent decisive readings; nothing a scale produces (a correction, an
orientation chosen by it, a rewritten anchor) flows back into its support. The negative tests (§Z) fail on the old
logic: a misread made to fit the wrong 1.79 cm/px scale raises the old support and leaves the new one unchanged.

## L. The dimension chain graph

`chainRelations` records `TOTAL_OF` — a two-tick chain whose span equals what a finer chain divides — with the
printed total, the segment sum and whether they agree, and `NESTED_IN` for chains inside another's span. A
disagreeing sum is recorded as disagreeing, never forced to agree (tests: a total over exactly what a finer chain
divides; a total that disagrees with its parts).

## M. Role classification

A chain's role is decided from geometry alone, never from its number (test: the same chain with every value
tripled has the same role):
- a **wall witness** from the sheet's own long wall bands, grouped where they come within two walls, the largest
  group kept — a logo, a title block, a north arrow is a detached group and loses;
- **EXTERIOR** — witness walls met along the chain's span lie on one side of its line;
- **INTERIOR** — walls on both sides (each ≥ 1/6 of the span) or the line runs through a wall;
- an interior chain that does not span the witness on its axis is refused as the building's extent
  (`INTERIOR_BASELINE`).

## N. Extent hypotheses

- The legacy frame stands **byte for byte** unless a chain it was taken from — the widest read chain on an axis —
  is refused as interior.
- Then the frame is taken again without it; an axis left without a read chain comes from the widest exterior
  chain's ticks spanning ≥ half the witness (`EXTERIOR_CHAIN_TICKS`), else the witness (`WALL_GEOMETRY_EXTENT`),
  and the frame is weak.
- **The replacement is taken only if it is wider on a refused axis**: refusing a room's width can only ever widen
  the building. (Measured necessity: without this guard, Marcówki's attic, whose legacy frame came from its walls,
  shrank to one room when six interior chains were refused.)
- Provenance is recorded per axis (`DIMENSION_CHAIN_EXTENT | EXTERIOR_CHAIN_TICKS | WALL_GEOMETRY_EXTENT`) with the
  refused chains, in the diagnostics and the trace.

## O. Wall geometry and cross-view witnesses

- **Wall witness** (§M) — pixels only; no chain and no extent enters it.
- **Side-wall reach** (walled envelope): when the building's two outermost side walls both run on past the last
  long cross wall and stop at the same line, **the box stopped at a partition** (a cross wall thinner than 0.7 of a
  wall, never a wall-thick facade), **and a wall-thick pier lies on that line between them** (within half a wall),
  the envelope follows them to it. A front that is all openings (a garage door, a recessed entrance, a wide window) leaves only
  piers and no long band; without this the rooms behind it were outside by construction (dom-w-jablonkach: 5.34 m²
  first reading). The pier condition keeps a loggia's returns a recess (the synthetic Dunmore fixture caught the
  first version); a lone wall running on (a garden wall) is left to the bays.
- **Cross-view** — no new cross-view witness was added in 005B; the section/elevation registration is 005A's.

## P. Resolver integration (1.3.0)

- Metric hypotheses are readings: the independent solution's scales (≤ 2, plausible, ≥ 1 independent reading,
  > 3 % from the registration) replace the lattice scales on frames that have a solution (the lattice stays for
  evidence sealed before 1.2.0).
- Isotropy is measured from the solution (both axes stated independently) rather than assumed.
- The wall witness is an extent reading (`WALL_WITNESS`).
- The published footprint verifies and vetoes; it never chooses between readings the drawing supports equally
  (005A's rule kept).
- **`METRIC_RESOLUTION_INCONCLUSIVE`** — when a plan cannot be read and its base metric confidence is
  INCONCLUSIVE, the run stops with this typed reason and names the relation, confidence, hypotheses, independent
  witnesses, conflicting readings and the scales it weighed (the alternate Marcówki page stops this way: "no
  reading that owes nothing to it supports it … What is missing: an overall dimension read the right way up, or two
  readings on different chains that agree").

## Q. The confidence-aware first-success path

- A first reading that completes keeps the fast path only when its base plan's scale was chosen or confirmed by
  independent readings (**≥ SUPPORTED**) and its frame came from its dimension chains.
- Otherwise its metric alternatives are weighed against it: the other scales its readings support, and — only when
  it was the frame that was weak — the walls' framing. One replaces it only when it is acceptable, strictly better
  on the drawing's own evidence (hard problems, refusals, refuted chain share, wall coverage, corroborations) and no
  worse against the figure.
- Whatever the outcome, a WEAK or unsupported base scale is never silent: `METRIC_SCALE_WEAK` /
  `METRIC_SCALE_UNSUPPORTED` are LIMITING warnings on the result.
- Measured: G2E's first reading (LEGACY_UNCONFIRMED/WEAK) is challenged; its metric alternatives (2.19 and
  3.46 cm/px) build 115.8 and 291.0 m² against 189.77 and are WRONG, so it is KEPT with its LIMITING warning.
  dom-w-jablonkach (REPLACED/WEAK) is challenged; its alternative (0.94 cm/px) builds 19.5 m² and it is kept the
  same way. Marcówki (CONFIRMED/STRONG) and Kosaćce (CONFIRMED/SUPPORTED) keep the fast path.


## R. dom-w-jablonkach (round-1 blind house, now development) — before / after

| | before (`bdacd42`) | after |
|---|---|---|
| outcome | FAILED `PLAN_LAYOUT_REJECTED` | **COMPLETED**, 1 body, 2 storeys |
| base-plan scale | 1.892 cm/px (6 of 6 anchors rewritten, 0 independent) | **2.1195 cm/px**, `REPLACED`, WEAK — stated by the right-way `1100` overall |
| depth chain | `380/900` read upside down, rewritten to fit 1.892 | `380/900` corrected at 2.1195 (`derivation.dependsOnScale`), never a witness |
| first reading | — | challenged (WEAK); alternative 0.94 cm/px builds 19.5 m² → KEPT |
| footprint | — | **94.18 m² vs 99.4 published (−5.25 %)** |
| verdict | ALGORITHMIC_FAIL | **ALGORITHMIC_FAIL** — one printed opening not built (`opening-0-front-0-3`); LIMITING `METRIC_SCALE_WEAK`, `EXTERIOR_JOINTS`, `INVARIANT_VIOLATIONS` |

- **Target (§46): "no upside-down overall label driving wrong scale"** — met: the scale is the one the only
  right-way overall reading states; the upside-down readings no longer vote.
- **"Metric solution supported by physical endpoints and independent scale evidence"** — partly: one independent
  reading (WEAK), because the sheet has one legible overall label; both axes are not independently measured.
- **Why it completes now:** the scale (above), and the walled envelope's side-wall reach (§O). With the right scale
  the first reading still covered 5.34 m², because the front wall — a garage door, a recessed entrance and a kitchen
  window — leaves only piers and no long band; the envelope stopped at an interior wall and everything in front of it
  was outside. Both outermost side walls run to the front and a pier lies on that line, so the envelope now reaches it.
- **What still fails:** one front opening is not built. That is the openings stage, outside 005B's metric scope; it
  is residual debt, not patched here.

## S. willa-miranda (round-1 blind house, now development) — before / after

| | before | after |
|---|---|---|
| outcome | FAILED `PLAN_LAYOUT_REJECTED` (strip frame, 2 of 52 cells) | FAILED `PLAN_LAYOUT_REJECTED` |
| base-plan scale | 2.681 cm/px | 2.681 cm/px, `CONFIRMED`, SUPPORTED (3 independent readings) |
| depth chain (left margin) | labels read upside down, unread | the right way up it reads `205`/`420` for 245/920 — misread glyphs in every orientation; correction-only re-reads are not accepted on a confirmed frame |
| frame depth | the interior `114` chain (355–450 px) | the same: the wall witness is partial (it groups only the right half of the building, 473–794 px, because window openings split the outer walls into separate groups), so the interior chain reads EXTERIOR and is not refused |

- **Target (§46): "interior 2.5 m chain must not become plan depth"** — **not met on this house.** The mechanism is in
  place and tested (§M, §N, §Z) but its witness is too partial here. An experiment joining collinear wall pieces
  across an opening's width made the witness larger (331–794 px) but still not the whole building, and pulled a
  planter into dom-w-jablonkach's witness; it was reverted.
- **A second defect behind it:** with the depth fixed by hand in an experiment (the ungated re-read), the building
  came out 100.38 m² vs 169.9 — the garage (room 9) and the room next to it flood through the garage mouth: its
  side walls run through the envelope edge rather than starting at it, so the bay rule never sees a bay. A
  generalised bay rule changed Marcówki's and G2E's models and was reverted.
- **Classification:** ALGORITHMIC_FAIL, not source-limited. Recorded as debt (§AJ).

## T. Kosaćce, clean and tracked

- Both links: COMPLETED, **PASS**, 3 bodies, 162.28 m² vs 164.47, model **`5b5ffcf1…` = before**, scene
  `50217b85…` = before; `CONFIRMED`, SUPPORTED at 2.4058 cm/px. Tracked equals clean, byte for byte.
- Two effects had to be removed to get here, both measured: re-read chains that merely traded one correction for
  another (they moved grid lines and lost a body), and room labels picking up the other passes' readings (duplicate
  and wrong room numbers). §J step 9 and §I are those two rules.

## U. Rarytasy e-OZE

- Before: COMPLETED but ALGORITHMIC_FAIL — resolved by hypothesis on the published figure alone, 116.74 m².
- After: **PASS on the first reading**, 1 body, **123.99 m² vs 122.07 (+1.57 %)**, no resolver needed. The base
  plan's scale is `REPLACED`, STRONG: 2.2236 cm/px from `1601/720` and `760/342` read as printed, where the vote had
  2.501 (a substitution `1601→1801` outvoting its own raw reading through the cross-chain bonus).
  Model `b4e76f04…` (was `b50b6e59…`): a genuine correction.

## V. Marcówki

- COMPLETED, **PASS**, 2 bodies, 130.79 m² vs 131.16; model **`6152770f…` = before**, scene **`8c7d4395…` = before**;
  `CONFIRMED`, STRONG, isotropy measured, 3 independent readings.
- **Why the hashes did not move, and what they would have been:** the right-way re-read reads the ground plan's
  vertical overall `1260` (it was read `0431` upside down). As a registration anchor it moved mpp-Y by −0.08 %, and
  that tipped an interior room-flood threshold: the 3.43 m² vestibule merged into the kitchen (12 rooms → 11). The
  rule "a confirmed scale is not re-fitted" (§J step 9) keeps the reading as evidence and the registration as it
  was. The attic's legacy frame (from its walls) would have shrunk to one room when six interior chains were
  refused; the "only ever widen" guard (§N) keeps it.

## W. Source-copy parity (Kosaćce phone copy loss)

Full note: `stage-reports/artifacts/analyzer-005b/kosacce-copy-loss.md`.
- The same page and drawings, acquired offline under three runtimes: the desktop (ICU), the phone's (no ICU) with
  its text adapter, and the bare phone runtime. With the adapter the package is **byte-identical** to the desktop's
  (`9cb4f520…`, 31 assets, 4 floor-plan copies, the same 12 failures — 7 guessed larger copies refused, 5
  byte-identical duplicates); without it the hash differs but no copy is lost; the clean link gives the same.
- **Conclusion:** the phone's loss is not in text handling or the tracked query; it is its network. No fix invented.
- **Added:** a sealed parity test on a page in the publisher's shape (four copies of one plan, diacritic captions),
  with a control showing the parity is the adapter's; and diagnostics that name each lost floor-plan copy's file,
  stage and failure message.
- **Found on the way:** the acquisition CLI knew only the ARCHON adapter, so the alternate-publisher development
  house could not be fetched for its CI replay; it now registers the service's publishers.


## X. Progress telemetry — regression check

- 005A's telemetry is unchanged in design (checkpoint, heartbeat, phase records, cancellation at loop boundaries).
  The new loops call the same checkpoint: `ORIENTATION` (chain i of n, while each chain's way up is decided),
  `SCALE` (hypothesis i of n), `EXTENT` (variant i of n in the challenge). The phone maps them to Polish
  (`orientacja etykiet: łańcuch 8 z 14`, `porównuję skale: wariant 2 z 3`, `sprawdzam obrys: wariant 1 z 2`).
- **Honest observation:** those loops finish in milliseconds per frame, so the heartbeat-throttled telemetry stream
  of a real run shows the enclosing subphases (reading printed numbers, dimension chains, opening callouts) and
  almost never the new ones; they matter as cancellation points, not as visible progress. The OCR pass and the
  callout search remain the long, visible steps.
- **Longest silence** (final replay of the eight houses, 8 in parallel on 4 cores): tick gap 1.35–3.99 s,
  telemetry gap 1.38–4.91 s; sequentially, one house at a time: 1.5–2.4 s (005A: 2.1–3.7 s). No multi-minute
  silent 63 %.
- **Blind round 2** (single live runs): longest telemetry gap 1.9 s and 2.1 s; longest tick gap 4.8 s and 1.3 s,
  both in acquisition (network).
- The `Analyzer / progress` CI job (telemetry, warnings, service, the phone's program, the Android contract) is
  green unchanged.

## Y. Performance and bounds

**Bounds (explicit, from evidence):** ≤ 2 orientations per label per chain (4 passes read, the two on the chain's
axis bound); ≤ 6 scale hypotheses per frame (reached on every house — the rest are recorded as not kept);
≤ 400 observations per frame (maximum met: 118, Kosaćce); ≤ 2 lattice substitutions; ≤ 200 chain relations;
≤ 2 skipped ticks; ≤ 2 metric scales and ≤ 2 wall extents in the challenge (maximum met: 2 readings). No combination
is enumerated: orientation is decided per chain, then scales per frame, then at most four challenge readings.

**Cost (sequential, one house at a time, same sealed package and observation graph, 4-core container, before =
`bdacd42`, after = this stage):**

| house | total before → after | metric + solve phase before → after | peak RSS before → after | longest telemetry gap |
|---|---|---|---|---|
| Marcówki | 126.4 s → 120.8 s | 114.0 s → 112.1 s | 799 → 809 MB | 2.43 → 2.24 s |
| dom-w-jablonkach | 147.0 s → 151.7 s | 140.8 s → 140.9 s | 786 → 767 MB | 1.91 → 1.53 s |

- The fourth OCR pass and the second binding of readings to chains cost within run-to-run noise (−4 % to +3 %);
  memory is unchanged. (A first measurement with eight houses in parallel on four cores suggested a doubling; that
  was contention, not cost.)
- Final replay, eight in parallel: 129–356 s per house, 617–812 MB peak RSS.
- Blind round 2, live, one at a time: 212.5 s / 810 MB (`dom-w-zurawkach`), 133.8 s / 764 MB (`dom-w-modrzykach`).

## Z. Metamorphic and adversarial tests

- **Orientation** (`orientation-metamorphic.test.ts`, 10): the same page at 0°, 90°, 180°, 270° keeps the printed
  `1260` among the raw readings, read the right way up and labelled so; the upside-down page's upright pass does not
  claim it; the vote's tokens are identical with and without hypotheses on every rotation, and are a subset of the
  raw readings; orientation algebra (opposites share an axis, 180° apart).
- **Scale independence / self-anchoring** (`metric-solution.test.ts`, 19): the legacy vote as the adversary (its
  substitutions agree on a wrong 1.79 cm/px and rewrite the overall); the independent solver takes 2.00 from the
  reading as printed and names it WEAK; no rewritten reading is among the witnesses and a correction at the chosen
  scale is marked as depending on it; **adding a misread that a substitution makes fit the wrong scale does not
  raise that scale's support by one witness** (fails on the old logic); the right-way reading of the same ink makes
  both axes state 2.00 (STRONG, isotropy measured); weight first, count second; stripping every glyph alternative
  changes nothing; a leading-zero reading never witnesses; the overall `1100` keeps its chain beside a stray `14`;
  CHAIN_SELF_CONSISTENCY; an inverted sheet read upside down only when its inverted readings agree; mirrored values
  decide nothing; TOTAL_OF recorded, a disagreeing total recorded as disagreeing; the same readings in another order
  give the same solution byte for byte; a reading turned to join a cluster never witnesses it (the shadow `600`);
  illegible labels cannot merge a corroborated scale away; a stronger rival caps confidence at WEAK.
- **Interior-as-extent** (`plan-extent.test.ts`, 14): the witness is the building's walls and leaves a logo out; a
  chain beside the building is EXTERIOR; a chain across a room is INTERIOR and refused; its role does not depend on
  its printed values; the legacy frame takes the room for the building; with an exterior chain whose labels are
  unread, the depth comes from its ticks; with none, from the walls, weak; the legacy frame is byte-identical when
  nothing that framed it is refused; a front of piers keeps its rooms; a lone garden wall does not; a refused axis is never
  re-framed by a short read chain; a parapet-inflated witness does not overrule a read chain; a covered terrace
  with a pier and a planter is not built.
- **First success and warnings** (`first-success.test.ts`, 5; `warnings.test.ts`, 11): STRONG keeps the fast path;
  WEAK is challenged and named; sealed pre-1.2.0 evidence is unchanged; an unreadable plan on an INCONCLUSIVE scale
  stops with `METRIC_RESOLUTION_INCONCLUSIVE` and a SUPPORTED control does not; every LIMITING metric and extent
  warning is emitted where it applies.
- **Source parity** (`source-parity.test.ts`, 2) and the **hard-code guard** with printed dimensions
  (`generalization.test.ts`, planted cheats for id, word, figure and dimension).
- **The whole suite:** 133 files, 1696 tests passed, 9 skipped; typecheck clean (at `27274ab`).

## AA. Development matrix (`stage-reports/artifacts/analyzer-005b/development-matrix.json`)

Offline replays of the same sealed packages, every stage after acquisition re-run; "before" is `bdacd42`.

| house | before | after | model | base-plan metric |
|---|---|---|---|---|
| Marcówki | PASS | **PASS** | `6152770f…` **unchanged** | CONFIRMED / STRONG |
| Kosaćce (clean) | PASS | **PASS** | `5b5ffcf1…` **unchanged** | CONFIRMED / SUPPORTED |
| Kosaćce (tracked) | PASS | **PASS** | `5b5ffcf1…` **= clean** | CONFIRMED / SUPPORTED |
| Rarytasy G2E | ALGORITHMIC_FAIL (1 opening) | ALGORITHMIC_FAIL (1 opening), 184.22 m² (−2.9 %) | `8fa4a25b…` **unchanged** | LEGACY_UNCONFIRMED / WEAK (challenged, kept, warned) |
| Rarytasy e-OZE | ALGORITHMIC_FAIL (figure alone) | **PASS**, 123.99 m² (+1.6 %) | `b50b6e59…` → `b4e76f04…` | REPLACED / STRONG |
| alternate Marcówki page | FAILED `PLAN_LAYOUT_REJECTED` | FAILED `METRIC_RESOLUTION_INCONCLUSIVE` (typed, named) | — | LEGACY_UNCONFIRMED / INCONCLUSIVE |
| dom-w-jablonkach | FAILED `PLAN_LAYOUT_REJECTED` | COMPLETED, 94.18 m² (−5.3 %), 1 opening not built | `0f3ea2bb…` | REPLACED / WEAK |
| willa-miranda | FAILED `PLAN_LAYOUT_REJECTED` | FAILED `PLAN_LAYOUT_REJECTED` | — | CONFIRMED / SUPPORTED |

- **No regression.** Every house is the same or better. Four models are byte-identical to baseline (Marcówki, both
  Kosaćce links, G2E); the one that moved is a genuine metric correction (e-OZE, §U); two houses that did not
  complete now complete or stop by a typed metric reason.
  - **G2E, for the record:** before the post-review fixes its model moved by 2.3 cm in depth, because a chain on a
    LEGACY_UNCONFIRMED frame was re-read the right way up (`850` for `010`). Reviewer A showed that re-reading at a
    scale nothing independent confirms only reads "more agreement" with it; re-reads are now limited to CONFIRMED
    frames and G2E is back to its baseline model, challenged and carrying `METRIC_SCALE_WEAK`.
- **Metric relations on base plans:** 3 CONFIRMED, 2 REPLACED, 3 LEGACY_UNCONFIRMED — the solver replaces the vote
  only where the vote had no independent reading, and says WEAK or INCONCLUSIVE where it cannot do better.


## AB. Post-implementation review (three reviewers, before the freeze)

Three independent read-only reviewers, each told to falsify one claim, on `9c9bfc1` (`bdacd42..HEAD`). Their
probes ran on synthetic plans and on the offline development evidence; none opened a candidate house.

| reviewer | claim attacked | severity found | outcome |
|---|---|---|---|
| A — evidence independence | "scale evidence is independent" | 1 P0, 3 P1, 3 P2 | P0 and all P1 fixed with tests; P2 recorded |
| B — geometry / extent | "interior chains cannot masquerade as extent" | 0 P0, 3 P1, 2 P2 | 2 P1 fixed with tests; 1 P1 is willa-miranda's class, recorded; P2 recorded |
| C — overfit / verification | "first success cannot silently accept weak metric truth" | 0 P0, 4 P1, P2s | 3 P1 fixed with tests; 1 P1 is a design decision, answered; guard and CI P2s fixed |

**Fixed (generic, before the freeze):**
- **A-P0 — the resolver still scored refutation on rewritten values.** Refuted share (the resolver's and the
  challenge's third key) was measured on CHAIN_CORRECTED values, which were rewritten to fit the registration: the
  incumbent was refuted by nothing and every rival by all of them. Refutation is now scored on values **as read**,
  the same at every scale — a READ value whose way up another axis's scale chose is left out, a corrected value
  counts by what the reader first saw. The same finding showed step 7 re-reading chains on LEGACY_UNCONFIRMED frames
  (where "reads more at the scale" means "agrees more with an unsupported scale"): re-reads now happen only where
  the vote's scale is CONFIRMED.
- **A-P1a — a reading turned to fit a scale was counted as its witness.** A chain decided by joining a cluster of
  the axis's labels now joins a cluster built **without its own inks**, and the reading that joins it is recorded
  `ORIENTATION_BY_SCALE` and never counted for that scale. The reviewer's repro (a shadow `600` confirming the vote's
  wrong 1.5 cm/px as SUPPORTED) is now LEGACY_UNCONFIRMED / WEAK — challenged and warned; test added.
- **A-P1b — the figure could choose between two challengers.** Challengers better than the incumbent are ranked
  by the drawing's own evidence, then the metric evidence's order; the figure only vetoes.
- **A-P1c — uncounted readings could merge a counted scale away.** Hypotheses are now clustered on counted
  (independent, decisive) witnesses; other readings attach to them and cannot erase them. The repro (three
  illegible 9 px labels erasing a corroborated 2.00) now keeps 2.00; test added.
- **A-P2 / isotropy — one definition.** `isotropy: MEASURED` now uses the ranking's own test (substantial
  readings on both axes and a major one), not "one decisive reading per axis".
- **B-P1a — a refusal undone by a short read chain.** A refused axis is now framed by the widest statement
  (another read chain, an exterior chain's ticks), or by the wall witness where no statement covers half of it;
  refused chains and per-axis provenance are always recorded. Repro: a corner-to-window chain no longer keeps a
  9 m frame for a 14 m house; test added. (A first version let a witness inflated by an attached parapet overrule a
  read chain; the "half the witness" rule was added and tested.)
- **B-P1b — side-wall reach built a covered terrace.** The reach now applies only where the box stopped at a
  partition (the cross wall it ends on is thinner than 0.7 of a wall), never at a wall-thick facade, and the pier
  must lie on the side walls' own end line within half a wall. The reviewer's terrace with a pier, a planter and a
  slab edge is not built; test added. dom-w-jablonkach still reaches its front (it ends on a 9 px partition).
- **C-P1-1 — a frame the walls supplied was labelled chain-framed.** A weak legacy frame now records
  `WALL_GEOMETRY_EXTENT`, takes the challenge path, and carries a LIMITING `PLAN_EXTENT_FROM_WALLS`.
- **C-P1-2 — a stronger rival never lowered confidence.** Confidence is now monotone in the rival's standing: a
  rival with more axes, agreement or an overall reading caps it at WEAK.
- **C-P1-3 — no tests for the machinery.** Added `first-success.test.ts` (STRONG keeps the fast path; WEAK is
  challenged and named; sealed pre-1.2.0 evidence unchanged; an unreadable plan on an INCONCLUSIVE scale stops with
  `METRIC_RESOLUTION_INCONCLUSIVE`, a SUPPORTED control does not) and warning tests; the CI rows now require
  `METRIC_SCALE_WEAK` on G2E and dom-w-jablonkach (deleting the warning fails CI), and the alternate page may only
  stop with the typed metric reason.
- **C-P2 — guard gaps.** The dimension fingerprints now also match list items (`[1000,1205]`) and metres
  (`12.05`, `12,05`); planted cheats prove each form.

**Answered, not changed:**
- **C-P1-4 — one uncorroborated overall reading replaces a scale with zero independent support.** By design: a
  scale nothing independent supports is the one in doubt (§E), and the one reading printed as an overall dimension
  is the only evidence on dom-w-jablonkach's sheet. It is named WEAK, carries a LIMITING warning and is challenged;
  the vote's scale is not offered back as an alternative because its only support is its own corrections.

**Recorded as residual debt (§AJ):**
- **B-P1c — a partial wall witness lets an interior chain read EXTERIOR** (outer walls split by openings wider than
  the join). Identical to legacy (not a regression) and willa-miranda's failure class.
- **B-P2a/b** — `coversWitness` allows two walls at each end (an interior chain ending one corridor short is not
  refused); an exterior chain beside a wall-thick parapet can read INTERIOR (the envelope still builds the right
  house in the probes; the extent and its provenance are wrong).
- **A-P2** — on REPLACED frames the registration still anchors on corrections made at the new scale (the scale
  itself is chosen independently; its residual is flattered); SINGLE_READING is decided per chain, not per ink.
- **C-P2** — after a challenge replaces a scale, the metric warning describes the first scale; CONFIRMED +
  SUPPORTED with isotropy ASSUMED is not warned; several thresholds are conventions rather than derivations (the
  reviewer's list is reproduced in §AJ).

**What the reviewers could not falsify** (quoted from their reports): substitutions never count as support;
OTHER_AXIS_SCALE readings are left out of the independent counts; one ink is one witness and corroboration needs
distinct inks; results do not depend on input order; a leading-zero reading is never decisive; frames whose scale
stands do not re-anchor the registration; the legacy frame stands byte for byte when nothing that framed it is
refused; accepting a refusal never narrows the frame; a WEAK or INCONCLUSIVE base solution that completes always
carries a LIMITING warning; an INCONCLUSIVE stop becomes METRIC_RESOLUTION_INCONCLUSIVE on every throw path.


## AC. PRE_HOLDOUT_2_SHA

- **`PRE_HOLDOUT_2_SHA = 27274ab8c24a17c484158f5e3a0bf091ce85e961`** — pushed to `analyzer/dimension-evidence-refoundation-v1` and
  `claude/new-session-3kzcgh`; full CI run 101 (`36730839835`) green on it (25 jobs succeeded, 1 skipped by design; §AG).
- Everything in 005B's analyzer is at or before it. After it, and until both blind houses had run once, nothing
  was committed (the ledger line and the evidence are committed after the runs, as in round 1).

## AD. Holdout round 2 — pool and seed

- **Pool:** round 1's committed `holdout/pool.txt` (the publisher's sitemap, 2026-09-30T00:32Z), 3085 addresses,
  `POOL_SHA256 = 800c2a1ed9daee9efd2654c64b061e430094dc38fc459b805af27ff9fad2ed41`.
- **Excluded:** `holdout/excluded-families-round-2.txt`, 38 families, 551 addresses —
  `EXCLUDED_FAMILIES_ROUND_2_SHA256 = 7b36740a85f41b2c766d306eacfb377c471592f7a945f09345efbe45c798ce13`:
  round 1's 25; the development families (Marcówki, Rarytasy, Kosaćce); the two round-1 draws
  (`dom-w-jablonkach`, `willa-miranda`); every family any development page links to (13 new, from the cached HTML,
  addresses only). Families over-merge by name stem, the safe direction for an exclusion.
- **Drawable:** 2534 addresses.
- **Seed:** `SHA256(PRE_HOLDOUT_2_SHA + "BUILDPLAN-005B-BLIND-HOLDOUT-ROUND-2")` = `1216338c1fddccbdfe3c2c274528cdd6e1ded928620893d6e19e48761800cfd0`.
- **Picks:** `i1 = seed mod n = 2394` → `https://www.archon.pl/projekty-domow/projekt-dom-w-zurawkach-3-p-md4e2138a2d1a5` (`dom-w-zurawkach`); `i2 = SHA256(seed + ":second") mod m = 1480` over the other
  families → `https://www.archon.pl/projekty-domow/projekt-dom-w-modrzykach-3-g2-mdf423d61e7247` (`dom-w-modrzykach`).
- **Ledger:** the draw's line in `holdout/LEDGER.ndjson` (label, exclusion file, SHA, pool and exclusion hashes,
  seed, n, indices, URLs), committed with the run evidence.
- Neither selected page was opened before the draw; each ran once, live, with the frozen code; cache and output
  outside the repository.

## AE. Blind project 1 — `dom-w-zurawkach` — **ALGORITHMIC_FAIL**

`https://www.archon.pl/projekty-domow/projekt-dom-w-zurawkach-3-p-md4e2138a2d1a5`, run once at 15:37:16Z. Evidence:
`stage-reports/artifacts/analyzer-005b/holdout/h1-dom-w-zurawkach/` (text facts; `facts.json` is §43).

| §43 check | fact |
|---|---|
| source coverage | 29 assets: 12 floor-plan copies (GROUND, BASEMENT, ATTIC; dimensioned and area-table), 4 elevations, 1 section, 1 site plan, 10 renders; no floor-plan asset lost (11 guessed addresses 404, 5 byte-identical duplicates) |
| image resolution | base plan: the 853 × 853 px dimensioned GROUND copy; walls 14 px; OCR tokens up to 48 px tall |
| orientation decisions | 13 chains: 7 `AXIS_SELF_CONSISTENCY`, 2 `SINGLE_READING`, 1 `CHAIN_SELF_CONSISTENCY`, 1 `TYPOGRAPHY`, 2 `UNDECIDED` |
| observations | 70 on the base plan: 5 ACCEPTED, 35 REJECTED, 30 RAW; 39 independent, 31 orientation undecided |
| independent scale witnesses | **5, all read as printed**: `1180`/532 px, `750`/338 px, `155`/71 px and the rotated vertical `800`/361 px + `150`/67.5 px, read the right way up |
| metric | **CONFIRMED / STRONG**, 2.2182 × 2.2166 cm/px, isotropy MEASURED; the vote's 2.2176 agrees; the best rival has 35 % of its support; nothing re-read |
| extent witnesses | both axes `DIMENSION_CHAIN_EXTENT`, not weak, nothing refused: **11.80 × 9.50 m**, the printed `1180` and `800 + 150` |
| candidate scores | first reading `PLAN_NO_MASSES`; the resolver weighed 8 readings (4 copies, 2 decompositions, 4 outlines, 0 compositions): 40.1–43.1 m², all `WRONG`; outcome INCONCLUSIVE, figure SCORED |
| published-fact residuals | footprint 101.7 m²: best reading −58 to −61 %; the printed box less the unbuilt 7.50 × 1.50 m porch strip is 100.85 m² (−0.8 %), so the metric and extent agree with the publisher |
| model / scene / unresolveds | none (typed stop) |
| runtime / RSS / heartbeat | 212.5 s wall, 810 MB peak (process tree); longest telemetry gap 1.9 s; longest tick gap 4.8 s in `ACQUIRE_ASSETS` (network) |
| visual plausibility | not assessed: no model |

- **Verdict.** `RECONSTRUCTION_FAILED / PLAN_NO_MASSES`; no source-checklist item holds; **ALGORITHMIC_FAIL**.
- **First bad decision (after the verdict, nothing patched): the garage bay.** The house is 7.50 × 8.00 m with a
  garage wing 4.30 m wide that runs 1.50 m further forward, fronted by two piers and a door (`260/229`). The walled
  envelope stops, as designed, at the house's front wall and leaves the wing to the bays, and `baysOf` finds no two
  walls leaving the envelope: the left garage wall's band ends at the mouth's inner face 1.04 m out, short of the
  1.5 m minimum (measured to the band's end, not the outer face), and the right garage wall is one band that runs
  **through** the envelope edge instead of starting at it. With no bay the wing is ground by construction and the
  whole garage (≈ 40 m²) floods from it.
- **Not in the refactored metric layer:** orientation, scale and printed extent are right and independently
  witnessed.

## AF. Blind project 2 — `dom-w-modrzykach` — **ALGORITHMIC_FAIL**

`https://www.archon.pl/projekty-domow/projekt-dom-w-modrzykach-3-g2-mdf423d61e7247`, run once at 15:40:49Z. Evidence:
`stage-reports/artifacts/analyzer-005b/holdout/h2-dom-w-modrzykach/`.

| §43 check | fact |
|---|---|
| source coverage | 16 assets: 4 floor-plan copies (GROUND; single storey), 4 elevations, 1 section, 1 site plan, 5 renders; no floor-plan asset lost (7 guessed addresses 404, 5 duplicates) |
| image resolution | base plan: the 853 × 853 px dimensioned copy; walls 16 px; OCR tokens up to 75 px tall |
| orientation decisions | 18 chains: 8 `AXIS_SELF_CONSISTENCY`, 4 `SINGLE_READING`, 1 `CHAIN_SELF_CONSISTENCY`, 1 `TYPOGRAPHY`, 1 `OTHER_AXIS_SCALE` (not counted as independent), 3 `UNDECIDED` |
| observations | 91: 3 ACCEPTED, 44 REJECTED, 44 RAW; 33 independent, 57 orientation undecided, 1 by the other axis |
| independent scale witnesses | **4**, including the overall `1850`/673 px and the rotated overall `1160`/422 px, read the right way up; two misreadings of printed spans (`621` for `624`, `684` for `689`) stayed RAW and witnessed nothing |
| metric | **REPLACED / STRONG**, 2.7484 × 2.7455 cm/px, isotropy MEASURED; the vote's 2.6892 cm/px rested on 0 independent readings (−2.2 %); the best rival has 10 % of the support |
| extent witnesses | both axes `DIMENSION_CHAIN_EXTENT`, not weak, nothing refused: **18.50 × 11.59 m**, the printed `1850` and `1160` |
| candidate scores | first reading `PLAN_LAYOUT_REJECTED` (14.72 m²); 63 readings weighed (4 copies, 16 decompositions, 12 outlines, 0 compositions): 14.7–23.9 m², all `WRONG`; outcome INCONCLUSIVE, figure SPENT |
| published-fact residuals | footprint 181.98 m²: −87 to −92 %; the printed box (214.6 m²) is larger, as the outline steps back (the garage front is set back, printed `195`, `80`) |
| model / scene / unresolveds | none (typed stop) |
| runtime / RSS / heartbeat | 133.8 s wall, 764 MB peak; longest telemetry gap 2.1 s; longest tick gap 1.3 s (`ACQUIRE_PAGE`) |
| visual plausibility | not assessed: no model |

- **Verdict.** `RECONSTRUCTION_FAILED / PLAN_LAYOUT_REJECTED`; no checklist item holds; **ALGORITHMIC_FAIL**.
- **First bad decision (after the verdict, nothing patched): the walled envelope's depth** — y 113–186.5 px,
  **2.02 m of the printed 11.60 m**. The front is almost all openings (four windows and the entrance, a 5.00 m garage
  door `500/225`, a 3.00 m window `300/230` in the left side wall; on the raw copy the front lines are thin glazing
  and door lines, not wall ink), so no long horizontal band exists below y = 200 and the side walls come as pieces.
  The envelope, the box of the long bands' axes, stops at the garage's back wall, the one long horizontal band;
  the side-wall reach does not fire (the two side walls do not end together). The bay rule then opens a 12.76 m
  "mouth" through the middle of the house and a 7.51 m gap on an interior wall; 5 of 99 cells stay built.
- **Not in the refactored metric layer** either.

### The common defect (both blind houses and willa-miranda)

Round 1's defects were metric: an upside-down overall label driving a wrong scale, and an interior chain taken
for the depth. **Both are gone on the new houses**: the rotated overall labels are read the right way up, the scale
is stated by readings as printed, and the printed extent frames the building. Round 2 fails one step later: the
**walled outline is taken from long wall bands**, and a side that is mostly openings (a garage door between piers,
a glazed front) has none. The envelope then stops inside the building (#2), or leaves a wing to a bay rule that
finds no two walls starting at its edge (#1). That is willa-miranda's second defect and round 1's envelope miss on
dom-w-jablonkach. Per the protocol it is **not patched in 005B**; both families join the development set.

## AG. CI

- **Run 100** (`9c9bfc1`) — **failed**, one job: the alternate Marcówki development row could not acquire its page
  ("no adapter understands"). The acquisition CLI knew only the ARCHON adapter. Fixed in `598c1f0` for the
  architectural reason, not by a hostname: the CLI now builds the same `SourceAcquisitionRouter` the service uses,
  `[archonAdapter, genericProjectPageAdapter]`, and the router picks the generic adapter because no specialist claims
  the host (the fetch logs `adapter generic.project-page@1.0.0`).
- **Run 101** (`27274ab`, the freeze) — **green**: 25 jobs succeeded, 1 skipped by design (the preview-APK publish,
  push-skipped on every run). Among them: `Core / Analyzer / Reconstruction` (typecheck, 133 files / 1696 tests),
  `Analyzer / dimension evidence`, `Analyzer / development house (…)` × 8 (Marcówki and both Kosaćce links pinned to
  their models; G2E pinned with `METRIC_SCALE_WEAK` required; e-OZE PASS; dom-w-jablonkach footprint with
  `METRIC_SCALE_WEAK` required; alt-Marcówki only `METRIC_RESOLUTION_INCONCLUSIVE`; willa-miranda its typed refusal),
  `Analyzer / progress`, `Analyzer / plan resolver`, `Analyzer / generalization`, second and third house, Node 18
  parity, APK size + emulator, `Android / APK`, `Android / 3D entry gate`, the UI evidence gate (54 min on the
  emulator), Playwright, the API container, architecture/assemblies.
- **Runs 102 and 103** (pushes of `fb5b4af` and `2e5a5bb`) — **cancelled by the workflow's own concurrency group**
  (`buildapp-ci-<workflow>-<ref>`, `cancel-in-progress: true`), each superseded within minutes by the next run on the
  same branch; neither reported a failure.
- **Run 104** (`workflow_dispatch`, `owner_apk: true`, on `2e5a5bb`, which contains `fb5b4af`) — **the final CI, green**:
  26 jobs succeeded, 1 skipped by design (the `preview-latest` publish, which an OWNER dispatch leaves alone); the
  same job set as run 101, including the eight development-house rows and the UI evidence gate, plus
  `Android / OWNER direct APK (owner-preview-latest)`, which published the APK in §AI. The analyzer code at
  `2e5a5bb` is the frozen code: `git diff 27274ab 2e5a5bb -- packages apps .github holdout/*.mjs` is empty.

## AH. Commits

Bounded commits on `analyzer/dimension-evidence-refoundation-v1` (also on `claude/new-session-3kzcgh`), from `bdacd42`:

| commit | what |
|---|---|
| `c105add` | docs(analyzer): record 005B targeted metric reviews |
| `8d1204f` | feat(source-metrics): read every dimension label every way up and keep the raw readings |
| `5896eb8` | feat(source-metrics): an independent metric solution per plan frame |
| `6401087` | feat(reconstruction): take a plan's extent from physical evidence |
| `5f88060` | feat(reconstruction): resolver 1.3.0 — a confidence-aware first success and an honest metric stop |
| `bdbf033` | feat(analysis-service, android): say what the metric evidence supports, while it works and after |
| `daab627` | test: desktop/phone SourcePackage parity, and printed dimensions in the hard-code guard |
| `9c9bfc1` | ci: dimension-evidence gates and all eight development houses re-extracted |
| `8da1ee7` | holdout: the round-2 protocol, fixed before the freeze |
| `598c1f0` | fix(source-package): the acquisition CLI registers the service's publishers |
| `625b149` | fix(source-metrics): post-review — no reading witnesses the scale it was turned to fit |
| `4a58bce` | fix(reconstruction): post-review — refutation as read, refusals only widen, no terrace as rooms |
| `f57b2ad` | feat(analysis-service): a plan framed by its walls limits the result |
| `27274ab` | ci: development rows require their limiting warnings; guard sees lists and metres — **PRE_HOLDOUT_2_SHA** |
| `fb5b4af` | docs(analyzer): blind holdout round 2 — draw, runs and verdicts (ledger line + sealed text evidence) |
| `2e5a5bb` | docs: stage 005B final report and project status — the final build (run 104, OWNER APK) |
| the next commit | docs: record the 005B final CI and the OWNER APK (this section and §AI) |

No commit touches `BuildPlan-PC-Legacy`, no history was rewritten, no APK binary and no third-party drawing is
committed.

## AI. OWNER APK

`https://github.com/damiankrok/BuildApp/releases/download/owner-preview-latest/BuildPlan-owner-preview.apk`,
from `workflow_dispatch` run 104 (`36740115586`).

Verified from the downloaded file, not from the notes:

| check | result |
| --- | --- |
| direct link | serves the APK itself: 30 697 367 bytes, `application/vnd.android.package-archive`; the release is a prerelease |
| SHA-256 | `9997ee732f6de1c0b57ec99e9dbee61e7faa1196c7c71c561f423e36f49f18dc`, equal to the release notes and to GitHub's asset digest |
| ABI | `aapt dump badging`: `native-code: 'arm64-v8a'`; 5 libraries under `lib/arm64-v8a/` (`libnode`, the node bridge, Filament, `libc++_shared`, the graphics path) and no other ABI |
| version | `com.buildplan.preview`, **versionCode 1104**, versionName `0.104.0-preview`, minSdk 26, targetSdk 35 |
| commit / run | the notes: run 104 from `claude/new-session-3kzcgh` @ `2e5a5bb2da3eee500aae926aae2f5635903de428`; its analyzer code is the frozen code (`27274ab`) |
| analyzer / resolver | the embedded bundle (`assets/local-analyzer/analyzer.mjs`, sha256 `d02b03ec…3386`, equal to its manifest; Node 18.20.4) declares `METRIC_EVIDENCE_SCHEMA_VERSION = "1.2.0"`, `PLAN_RESOLVER_VERSION = "1.3.0"`, `SOLVER_V2_VERSION = "2.3.0"`, and carries `metrics.independent-scale` and `ORIENTATION_BY_SCALE` |
| signer | `apksigner verify --print-certs`: "BuildPlan Model Preview, Preview builds (not a production key)", certificate SHA-256 `6e48fac4…a0da`, equal to the notes; it installs over any preview build with a lower run number |

No APK binary is committed.

### OWNER phone checklist

Install `BuildPlan-owner-preview.apk` over the previous build (1098), then check each item.

1. **Progress still never looks frozen.** Analyse any link and watch "Odczytuję wymiary i opisy otworów": besides
   the 005A steps, "orientacja etykiet: łańcuch N z M" and "porównuję skale: wariant N z M" may flash by (they take
   milliseconds, §X); "Ostatnia aktywność N s temu" keeps moving. "Przerwij" still stops within seconds.
2. **Marcówki and Kosaćce** (clean and tracked). Expected: the same houses as build 1098, byte for byte on the
   desktop. If the phone again keeps one Kosaćce plan copy of four, "Szczegóły analizy" now name each dropped copy,
   its stage and its error: send them.
3. **Rarytasy e-OZE.** Expected: it now completes on its first reading, 123.99 m² against 122.07, without "resolved
   by hypothesis". Question for the OWNER: does the house look like the page?
4. **Rarytasy G2E and dom-w-jablonkach.** Expected: models, each with a LIMITING warning that the plan's scale rests
   on printed dimensions nothing independent confirms (`METRIC_SCALE_WEAK`); dom-w-jablonkach at 94.18 m² (−5.3 %),
   one front opening missing.
5. **The alternate Marcówki page.** Expected: no model, and "Nie udało się ustalić skali rzutu: wymiary odczytane
   z rysunku nie potwierdzają jednej skali, więc modelu nie zbudowano." — not a wrong house.
6. **Optional: a round-2 blind house** (`dom-w-zurawkach`, `dom-w-modrzykach`). Expected: a typed stop and no wrong
   house. This is the next stage's defect.

## AJ. Residual debt

1. **willa-miranda still fails (ALGORITHMIC_FAIL).** Its wall witness is partial (window openings split the outer
   walls into separate groups; the largest group is only the right half), so its interior `114` chain reads
   EXTERIOR and is not refused; behind that, its garage floods through the garage mouth because the garage's side
   walls run through the envelope edge instead of starting at it (bay detection). Both are generic defects of the
   witness and of the bay rule (Reviewer B P1-c).
2. **dom-w-jablonkach misses one printed opening** (`opening-0-front-0-3`): the openings stage, out of 005B's scope.
3. **G2E misses one printed opening** (pre-existing, 005A).
4. **The alternate Marcówki page** stops with `METRIC_RESOLUTION_INCONCLUSIVE`: its copies carry no overall
   dimension read the right way up (a source that may be legitimately source-limited; not measured on the raw
   copies in this stage).
5. **Extent roles, P2:** `coversWitness` tolerates two walls at each end; an exterior chain beside a wall-thick
   parapet can read INTERIOR (Reviewer B).
6. **Metric, P2:** on REPLACED frames the registration anchors on corrections made at the new scale; SINGLE_READING
   is decided per chain, not per ink; after a challenge replaces a scale the metric warning still describes the
   first scale; CONFIRMED + SUPPORTED with isotropy ASSUMED is not warned (Reviewers A and C).
7. **Thresholds that are conventions, not derivations** (Reviewer C): `WITNESS_SHARE` 0.8/0.5/0.25, the rival
   ratios 0.8/0.5, `LEGIBLE_CAP_HEIGHT_PX` 10 (resolution-dependent, borrowed from the holdout protocol),
   `DISTINCT_RATIO` 0.03, the weight `px/50·0.7^skipped`, the orientation factors 2×/3× and `lz ≥ 3`, the role
   fractions `span/6` and 5 %, the partition ratio 0.7 and the pier 0.6 wall. Only `DECISIVE_SPAN_TOLERANCES = 25`
   is derived (4 %). None was tuned to a house after being measured on it, but none has been validated on a
   population either.
8. **The phone's copy loss** (§W): not reproducible from the bytes; the next phone run's diagnostics name the
   dropped copy.
9. **Blind round 2 (both ALGORITHMIC_FAIL, not patched): the walled outline from long wall bands.** A side of the
   building that is mostly openings leaves no long band. On `dom-w-modrzykach` the envelope stops at the garage's
   back wall (2.02 m of 11.60 m); on `dom-w-zurawkach` the garage wing is never proposed as a bay (its right wall
   runs through the envelope edge; its left wall's reach, 1.04 m to the band's end, is below the 1.5 m minimum
   measured to the outer face). Same class as item 1. The two families join the development set.

## AK. Exact next step

Return to the coordinator. The evidence points the next stage at one place: the **walled outline** (envelope and
bays), which fails on `willa-miranda`, `dom-w-zurawkach` and `dom-w-modrzykach` with the scale and the printed extent
right and independently witnessed — an outline the printed extent and the side walls' own reach can contradict,
instead of one taken from long bands alone, held to all ten development rows (005B's eight and the two round-2 families).
