# 005E implementation contract — synthesis of the four pre-implementation reviews

Sources: `segmentation-review.md` (A), `classifier-review.md` (B), `decoder-review.md` (C),
`false-consensus-review.md` (D), plus the coordinator's baseline (005E-0) and the development ground truth
`../calibration/development-labels.json` (81 labels, 11 houses, transcribed by eye from local crops; FIT 48 /
HELD_BACK 21 / TARGET 12). Every rule below is generic: no house, no printed value, no published fact.

## 0. What the reviews established (measured, not assumed)

- The frozen reader is right on **24/81 (30 %)** development labels (B: 39/124 = 31 %; C: 20/73 = 27 %), and on
  **32–34 %** of an independent two-face stroke-font corpus (240 labels × 2 seeds). Two or more wrong glyphs are
  common (B 35/85, C 24/53 wrong labels). The blind failures are typical, not outliers.
- The truth leaves the candidate set through rules, not scores: an absolute 0.2 floor (hides `1501`'s 0.946 runner-up;
  a correct `4` scores a median 0.20), sign characters taking alternative slots, and the one-substitution `boundedValues`
  (0 of 15 two-substitution truths, C).
- `1580` (dabecjach) and `1600` (e-OZE, recorded as `1601` since 005A — corrected) are **segmentation** failures:
  touching `80`/`00` cut through the second glyph's counter. A stricter ink mask (adaptive delta 48, absolute 60)
  separates them and reads `1580` top-1 (B); same-count re-cuts find the 8|0 junction (A, C).
- `850→810` and `1173→1117` are **classifier** coin tosses (ratios 0.98; 0.93/0.93); `1173` needs two substitutions.
- Dev houses are right today despite this because the chain DP and the vote tolerate misreads; STRONG on dabecjach came
  from confidence ignoring the neutrality V3 had just found (D P0-1) and from glyph evidence never being consulted (D P0-2).
- Wider candidate sets agree by chance (C: (K,K) 1.6 % at K 1 → 37.8 % at K 8; B: 13.8 % of labels per wrong scale):
  alternatives must **never** witness, seed, corroborate or count.
- Dimension OCR is not the metric phase's cost: on tunbergiach `readNumbers` is 5 s of 156 s; the opening-callout ring
  reader is 134 s (86 %). The lattice budget is relative to the 5 s.

## R. The numeric reader's candidate layer (image only)

New module `packages/source-metrics/src/numeric-lattice.ts`, `NUMERIC_LATTICE_VERSION = '1.0.0'`.

- **R0 Non-circularity.** `labelLattice(inkField, token, bounds)` takes the page's ink field and one raw token (its box,
  orientation and the default read's cells). It takes no scale, span, chain, tick, other ink, published fact, house or
  orientation decision. Architecture test: the module imports only reader modules (`ocr.ts`, `font.ts`, `parse.ts`),
  `source-cv` and `source-common`. Property test: an injected oracle scale cannot change any lattice (hash-identical
  solved or unsolved); a value outside an ink's lattice never appears in any record.
- **R1 Legacy path untouched.** `readNumbers`, the page vote, the legacy chain DP, datums, angles and callouts keep the
  005D reader byte for byte (every CONFIRMED house keeps its model). The lattice is computed for the raw tokens of plan
  frames that lie on a dimension line (the same geometric test as `dimensionLabels`/`assignTokens`, before any scale),
  and is consumed by `solveFrameMetric` and the metric re-solve only.
- **R2 Preprocessing variants** (bounded: 2). `DEFAULT` = the legacy adaptive mask (delta 8, absolute 110, page
  radius); `STRICT` = delta 48, absolute 60 (B: dev token inclusion .871 → .992 in union; reads the touching pairs
  apart). Computed on a padded crop with the page's radius, so the DEFAULT crop mask equals the page mask. Variants
  of one ink are **one ink**: a string's probability is the **max** over variants, never a sum or product; agreement
  between variants is not corroboration (B: P(wrong | wrong) 0.53–0.81).
- **R3 Segmentation hypotheses** (A; bounded): see §S.
- **R4 Matcher.** `classifyCell` returns the full score vector (one score per character, the best of its forms).
  - **Grammar alphabet** (B P0-2): a cell competes only among characters the number grammar admits at its position —
    digits in a whole-number token; a sign only at position 0; a separator only between digits. Signs never take a
    digit's candidate slot.
  - **Small-counter tolerance** `hfill` (B, generic, +3 pp dev and synthetic, no house's top-1 drops): a cell with
    fewer holes than a prototype whose counter area is < 0.15 of its box is penalised ×0.85, not ×0.5.
  - **Two-hole comparison** (A P0-2): for a two-hole cell against a two-hole prototype the position term compares
    both holes (sorted by height), not the largest of each — today the 8 is the only digit the term can demote, and it
    floors at 0.35 when the two counters are similar (A: +4 true 8s, 2 new 0→8 on 143 labels; `1580` unreachable
    without it).
  - Each change ships only through the gate of B §6: no dev house's top-1 or top-3 drops on FIT ∪ HELD_BACK, and the
    synthetic corpus does not lose inclusion, on both faces (leave-one-face-out).
  - Applied in the lattice only (R1); the as-read value of an ink is its DEFAULT anchor's top sequence under the 005E
    matcher, and the 005D text is kept beside it as the raw top read.
- **R5 Per-glyph candidates.** Keep `c` when `s(c) ≥ ρ·s(top)`, ρ = 0.6, at most m = 4 per cell, **no absolute floor**
  (B: dev inclusion .976 at 3.05 per glyph; C: the 0.2 floor hid 15/233 alternatives). Glyph probability
  `p(c) = softmax(s/T)` over the admitted candidates' full alphabet, T = 0.05 (B: NLL-optimal 0.06 dev, 0.04 synthetic).
  Glyph margin = 1 − s₂/s₁ with s₂ the unfiltered runner-up (D P1-1: never from `alternatives`).
- **R6 Sequence beam** (C D2–D4, with B's calibration): cells left to right; at most N = 2 non-top choices; beam width
  W = 16 partial sequences; sequence log-probability Σ ln p(cᵢ); hard floor p_seq ≥ 0.01 of the path's top; emitted in
  order until the cumulative normalised mass ≥ 0.95 or K = 8. Order `(−logp, nonTop, pathRank, text)` with values
  rounded to 1e-6; no Map order, no randomness, no locale. Grammar applied at completion (`parseNumber`
  LINEAR_DIMENSION, no leading zero) — strings that are not dimensions stay on the record, never as values. Recorded:
  `expansions`, `truncatedBy ∈ {MASS, K, FLOOR, BEAM}`.
- **R7 Merging paths.** Every (variant, segmentation) path yields its own top sequences; they merge by text, p = max.
  The **as-read value** (the witness value) is the top sequence of the DEFAULT variant's primary segmentation unless
  the coordinator's measurement (§C below) shows the union argmax over **preprocessing variants** is better on FIT and
  not worse on HELD_BACK; a **segmentation re-cut** never supplies the as-read value (C P1-3: 18 wrong→wrong, 1
  right→wrong against 2 wrong→right).
- **R8 Per-ink record.** raw top read (the 005D token text), as-read value, top-K sequences (text, value, log-prob,
  normalised p, image score Π s, non-top positions with chosen char and ratio, min/avg glyph margin, segmentation id
  and quality, variant support), per-glyph candidates (char, score, p), cap height, entropy, sequence margin,
  expansions, truncation. Never a pixel.

## S. Segmentation hypotheses (A; C D5)

- **S1 Anchor.** The reader's own cells (005D `segment()`) are hypothesis 0 of each ink variant. The as-read value is
  read on the DEFAULT anchor; a re-cut never supplies it (A: the argmax would flip 1/40 correct real reads and 12/78 and
  11/82 synthetic; C: 18 wrong→wrong, 1 right→wrong, 2 wrong→right).
- **S2 Expected width** E = 0.55·H_glyph with H_glyph the tallest glyph-sized blob of the token (A P2-1: a joined mark
  inflates the box height; `274` → `50`).
- **S3 Boundary candidates.** For each internal boundary of a run with n0 = round(W/E) ≥ 2 (n0 is not varied —
  count-changing alternatives cost 5 345 hypotheses for 14/38 synthetic truths and flip correct readings, A P1-5): the
  window of today's rule (centre x0 + W·k/n0, half-width 0.3·E); valleys = local column-ink minima, a plateau is one
  valley; the 2 best valleys by (ink, |m − centre|, m); each valley column m gives the cuts m and m+1 (the tie column
  to either side — 8 of 13 true boundaries move +1, A P1-2); plus the anchor's cut. ≤ 5 cut positions per boundary.
- **S4 Combination.** At most 2 changed boundaries; every cell 0.2·H_glyph ≤ width ≤ 0.95·H_glyph; ≤ 16 hypotheses per
  token and variant, generated in the order (changed boundaries, boundary index, cut x); an anchor of more than 7 cells
  (not a dimension) keeps the anchor only.
- **S5 Score without scale.** segScore = geometric mean of the cells' top glyph scores; keep the anchor and hypotheses
  with segScore ≥ 0.7 × the token's best; ≤ 4 distinct texts per variant, ≤ 6 per token. A hypothesis contributes its
  top sequence to the merged lattice with a cost penalty σ (C D5), never as rank 1 over the anchor's as-read value.
  Hole destruction and width regularity are recorded, never multiplied in (A P2-3).
- **S6 One ink.** Every hypothesis carries {variant, cuts, cells, segScore, ratioToBest, changedBoundaries}; a cell is
  classified once per (variant, x0, x1) (memoised); a value reached by several hypotheses is one candidate with the
  best score and a provenance list; nothing corroborates anything.
- **S7 Second ink hypothesis.** Reviewers measured two different second binarisations: B a stricter adaptive mask
  (δ 48, absolute 60; dev union inclusion .992, reads `1580` top-1) and A a local mean–σ (Sauvola, k 0.2; union 69/143
  vs 52, `850`/`1580` as read, `1173` rank 1). Both are generic; the coordinator measures DEFAULT ∪ STRICT, DEFAULT ∪
  SAUVOLA and all three on FIT, checks on HELD_BACK and the synthetic held-back corpus, and keeps the smallest set that
  is not dominated (cost: +0.3–0.9 s per plan frame per variant; ≤ 3 variants in any case).

## Q. OCR confidence classes (D C1, computed by the reader only)

Per ink, on the as-read path P (min glyph score sᵢ, worst runner ratio ρᵢ = s₂/s₁, topology-aware: a runner-up whose
prototype hole count contradicts the cell's is ignored only when that hole count is the same under both variants and
every hole is ≥ 2 px²), and `m_seq` = image-score ratio (Π s, length-normalised) of the best lattice sequence with a
**different value** to P:

- **LOW_QUALITY**: min sᵢ < 0.25, or cap height < 10 px. Never counts, never decides, never carries a hypothesis.
- **AMBIGUOUS**: not LOW, and max ρᵢ ≥ 0.90 or m_seq ≥ 0.90.
- **SUPPORTED**: max ρᵢ ∈ [0.70, 0.90) and m_seq < 0.90.
- **CLEAR**: max ρᵢ < 0.70 and m_seq < 0.70.

0.70 is 005D's V1 glyph ratio, 0.90 the coin-toss bar; the floor 0.25 sits under the lowest correct counted witness
(0.278, D). All four are re-measured on the 005E matcher on FIT and checked on HELD_BACK before the freeze (§C). Classes
never change a value.

## M. Metric layer (D C2–C5, C M1–M6)

- **M1 Witness.** Only the as-read value of a non-LOW ink is a witness; alternatives never witness, seed a cluster,
  weigh in legacy support, corroborate or count as overall evidence.
- **M2 Neutrality, symmetric.** An ink is *contested* between scales H and R when a lattice value fits R on its primary
  binding within `tol·(1+min(1, px/widest(R)))`, and R has *standing* (a counted, non-LOW, as-read witness with share
  ≥ 0.25 and no lattice value fitting H). The same test, with the same tolerance, applies to the selection, every
  rival and the page vote; contested inks leave both the ranking and `confidenceOf`/legacy statistics (fixes the
  discarded neutrality of 005D, D P0-1, and the one-directional/two-tolerance V3, D P1-2).
- **M3 Corroboration needs reading quality.** STRONG = axesMeasured ∧ corroborated on the deciding set; SUPPORTED =
  corroborated; the corroborating major+substantial pair must contain a CLEAR or SUPPORTED witness — two AMBIGUOUS
  witnesses make at most WEAK. The 005D rival rules then apply deciding set against deciding set; a rival is never
  promoted above class-blind evidence of higher standing (INCONCLUSIVE instead).
- **M4 False consensus.** When the class-blind tier is ≥ SUPPORTED, the class-aware tier is not, and either a rival with
  standing has a witness of strictly better class than a demoted witness, or two AMBIGUOUS witnesses on different
  chains have lattice values agreeing on one distinct plausible scale: `topology.falseConsensus` is recorded (selected,
  challenger, demoted witnesses, reason) and confidence is INCONCLUSIVE, so the first-success challenge runs. The
  challenger is never selected by this rule; a candidate-consensus scale is never a hypothesis.
- **M5 Structural support of a total.** For a TOTAL_OF whose total and children are distinct inks (not one footprint,
  not variants of one ink, not twin copies), joint assignments of lattice values (children of class ≥ SUPPORTED as
  read) are checked with the hierarchy's agreement tolerance. If the as-read assignment conflicts and exactly one
  assignment with the fewest non-top choices (≤ 2) agrees, it is STRUCTURAL: its non-top values are DERIVED, the
  refuted as-read values stop being witnesses. Ties or no agreement leave the conflict a record. It only removes
  witnesses; the total and its children are one statement.
- **M6 Value selection, never a witness.** Each candidate carries IMAGE_SCORE (rank, log-prob), STRUCTURAL_SUPPORT and,
  after the scale is chosen, METRIC_SUPPORT (residual px on the primary binding) — recorded separately, never
  multiplied. Span value: AS_READ (non-LOW, not refuted) → STRUCTURAL → SCALE_RANKED (best image score fitting the
  chosen scale; DERIVED like CHAIN_CORRECTED) → UNRESOLVED (two fitting candidates within an image ratio of 0.90).
  DERIVED values never enter `bounded`, `counted`, clusters, legacy support or a contest. Metamorphic check: deleting
  every DERIVED value leaves the FrameMetricSolution byte-identical.
- **M7** V4 `valueAmbiguity` and the REPLACED re-solve read the lattice, not `readingLattice`; what they choose stays DERIVED.
- **M8 Versions.** `METRIC_SOLVER_VERSION 1.2.0`, `METRIC_EVIDENCE_SCHEMA_VERSION 1.4.0` (additive optional fields),
  `METRIC_READER_VERSION 1.3.0`; dimension topology 1.0.0, boundary evidence 1.0.0, generic reader 1.2.0 and resolver
  1.4.0 unchanged unless a change is forced and recorded.

## E. Evidence Pack

- Layer 07 (`07-ocr-labels.json`) gains per label: raw top read, as-read, top-K sequences with image score, per-glyph
  candidates and margins, segmentation and variant, class, selected value with IMAGE_SCORE / METRIC_SUPPORT apart,
  rejection reasons. No pixel. Bounded (top 200 labels, K ≤ 8, ≤ 4 candidates per glyph).
- New timeline stage `OCR_SEQUENCE_CANDIDATES` before `OCR_READING`, keyed by ink (frame, pass, rounded box — not by
  text), decision = as-read plus the sorted candidate set. Packs of evidence before schema 1.4.0 derive the 005D set
  (raw text plus `valueAlternatives`), so before/after divergence is meaningful.
- ON == OFF, byte determinism and manifest verification stay green.

## T. Tests and gates (see the CI list in §42 of the brief)

Synthetic corpus (`synthetic-drawings/digit-corpus.ts`: two stroke faces, 10 strata, seeds 5001 calibration / 9017
held back) — top-1, top-3/5 recall, confusion matrix, per-stratum; the two-substitution adversary; the false-consensus
adversary (D: `1230→1150`, `770→720`, children `530`+`700`; old STRONG, new not); scale cannot create OCR; beam
determinism and bounds; the `it.fails` blur cases re-classified; dabecjach/tunbergiach development rows; e-OZE `1600`
segmentation fixture; Azalia/e-OZE/005D topology/005C regressions; Evidence Pack OCR determinism.

## C. Calibration policy

Thresholds (ρ, m, T, N, W, mass, K, class bars, floor, variant masks, segmentation bounds) are chosen on the synthetic
calibration corpus and the FIT development labels, and checked on the held-back corpus and HELD_BACK labels; TARGET
labels (the round-4 houses) never choose a number. Documented in `calibration/README.md` with the measured tables.
Future blind houses may not change them in this stage.
