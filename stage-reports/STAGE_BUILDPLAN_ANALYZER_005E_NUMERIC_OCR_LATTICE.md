# STAGE BUILDPLAN-ANALYZER-005E — numeric OCR candidate lattice, glyph confidence, non-circular sequence decoding

| verdict | result |
| --- | --- |
| NUMERIC OCR CANDIDATE RECALL | **PARTIAL**. **Development:** the printed figure is in the lattice for 72 of 81 labels (005D's bounded set: 47) and for 189 and 187 of 240 corpus labels (005D: 108 and 110). The round-4 overalls are now read (`1580`, `850`) or held (`1173` at 0.10). **Blind round 5:** every overall of house 2 is in its lattice. House 1's condensed `2590` is cut into three cells and is unreachable, and `1950` falls under the beam's floor (§Z, §AA) |
| MULTI-GLYPH SEQUENCE DECODING | **PARTIAL**. The beam keeps two-substitution truths the glyph scores support (§30 adversary, `1173`, the corpus: top-8 against 005D's one-substitution set). It cannot change a label's glyph count, and it drops a truth whose two alternatives are both weak (blind 1: `1950` → `1410`, `9` at p 0.04 and `5` at p 0.08; the joint path is under the 0.01 floor) |
| OCR CONFIDENCE CALIBRATION | **PARTIAL**. CLEAR is right on 9 of 9 development labels and 80 of 86 corpus labels. SUPPORTED needs a margin. A reading the stability bracket moves is never CLEAR or SUPPORTED (stable readings are right 58 % of the time, moving ones 25 %). As a right/wrong separator the class is a near-tie with the worst glyph ratio. A confident two-glyph misread stays SUPPORTED (blind 1 `1410`), a declared limit (§J) |
| METRIC EVIDENCE INDEPENDENCE | **PASS**, with one declared exemption. Only the as-read value witnesses. Alternatives never witness, seed, corroborate or count. Values are selected only from the ink's own lattice (§31 negative, `expectNonCircular`). The re-solve reads only the lattice. Metric support and image score are recorded apart. **Exemption:** the kept 005D chains of a CONFIRMED / LEGACY_UNCONFIRMED frame stay byte for byte 005D's (contract R1, B5E-2; §L, §AG) |
| FALSE CONSENSUS PROTECTION | **PASS**. dabecjach's false STRONG is gone (REPLACED/STRONG at the printed scale), and §29 and its variants hold. Under a ±20 % STRICT sweep no wrong scale reaches SUPPORTED or STRONG on any development frame. On both blind houses no wrong scale was adopted: house 1 refused, and house 2 confirmed the right scale at WEAK on three AMBIGUOUS readings. Confident misreads remain a declared limit (C5E-7) |
| CURRENT e-OZE | **PASS**. MUST_COMPLETE: REPLACED/STRONG on an overall reading, 123.91 m² (+1.51 %) (§Q) |
| 005D CHAIN TOPOLOGY REGRESSION | **PASS**. Every mark on every chain both runs record has the same class (489 + 231 chains on the round-4 houses). Azalia's spurious tick is still rejected, with the overall bound across it. No development PASS became a FAIL and no refusal changed its reason (§N, §P, §S) |
| ANALYZER EVIDENCE PACK | **PASS**. The OCR layer (lattice records, `OCR_SEQUENCE_CANDIDATES`), ON == OFF, byte determinism and manifests hold; 6 packs are committed and verified. The first divergence is now honest about record scope, and on both round-4 houses it is `OCR_SEQUENCE_CANDIDATES` (§M, §N) |
| BLIND ROUND 5 / PROJECT 1 (`dom-w-modrzewnicy`) | **ALGORITHMIC_FAIL** (numeric reader). Refused `METRIC_RESOLUTION_INCONCLUSIVE`, with no scale adopted. First bad decision: `OCR_SEQUENCE_CANDIDATES` `e00013`, where the condensed overall `2590` is cut into three cells and no four-glyph value can enter its lattice (§Z, §AA) |
| BLIND ROUND 5 / PROJECT 2 (`dom-w-morelach`) | **ALGORITHMIC_FAIL** (envelope, downstream of a right scale). Completed at −11.54 %; storeys 2 of 2 and openings hold. The scale is CONFIRMED/WEAK 1.9956 against the printed 1.996. First bad decision: `ENVELOPE` `e00427`, where the box stops short of the chain extent, so the east bay is not built and the garage stops short (§AB, §AC) |
| **Stage** | **PARTIAL**: `PARTIAL_BUILDPLAN_ANALYZER_005E_BLIND_CONDENSED_LABEL_AND_ENVELOPE_FAILS`. Both blind houses fail algorithmically; not patched (protocol) |

Branch `analyzer/numeric-ocr-lattice-v1` (every push also to `claude/new-session-3kzcgh`), from
`analyzer/dimension-chain-integrity-v1` @ `d8ba4e831affb9d727696a1705c930ee5c29d0d4`. Legacy (`BuildPlan-PC-Legacy`)
was not touched. No drawing, PDF page, crop, glyph bitmap or overlay of any publisher is committed. The repository
holds only text facts, hashes, numbers, and the analyzer's own SVG primitives and model renders in the Evidence Packs.
No cloud OCR, remote model or project-specific substitution was used or added.

---

## A. Baseline — 005D PARTIAL accepted

005D ended `PARTIAL_BUILDPLAN_ANALYZER_005D_BLIND_ARCHON_OVERALL_LABEL_MISREAD`: both round-4 blind houses failed in the
numeric reader, before any topology decision went wrong. This branch, `analyzer/numeric-ocr-lattice-v1`, starts from
`analyzer/dimension-chain-integrity-v1` @ `d8ba4e8` (005D's last record). Every push also went to
`claude/new-session-3kzcgh`. Legacy (`BuildPlan-PC-Legacy`) was read as a donor only and is untouched.

The baseline (005E-0) rebuilt the publisher caches outside the worktree (`/home/user/work005d/cache`, `blind-cache`) and
reproduced both defects at `d8ba4e8` on the sealed round-4 packages:

- dabecjach: overall `1580` read `1501`, overall `850` read `810`, CONFIRMED/STRONG at 2.672 cm/px where the printed
  overalls state 2.81;
- tunbergiach: overall `1173` read `1117`, a tie with `1000`, LEGACY_UNCONFIRMED/INCONCLUSIVE at 1.995 cm/px, completed
  at −12.47 %.

The 005D packs re-run offline on the sealed packages have no divergence from the committed blind packs
(`firstDivergence: NONE`), so every before/after below compares code with code on the same bytes.

## B. Focused pre-implementation reviews

Four read-only reviewers, each given one question and the shared context (`artifacts/analyzer-005e/pre/CONTEXT.md`).
The coordinator merged their findings into one implementation contract (`pre/implementation-contract.md`).

| review | question | its P0s |
| --- | --- | --- |
| A segmentation | where the cells are cut | `1580` is lost both by a cut through the `0`'s counter and by the classifier, so fixing one alone does not bring it back; the hole-position prior demotes every `8` whose two counters are alike; `850` is a segmentation tie-break as well as a coin toss; e-OZE's overall prints `1600`, not `1601` (the same counter cut, already in the development set) |
| B classifier | how good the glyph scores are | the matcher is right on about 30 % of development labels and is hidden only by redundancy; rules (the absolute 0.2 floor, sign characters taking candidate slots, one substitution) drop the truth more often than the scores do; reading quality never reaches the decisive gate |
| C decoder | how to turn glyph scores into values | the top read is wrong on most decisive inks, and two or more substitutions are common; alternatives agree by chance, more often as the set grows (1.6 % at K 1, 37.8 % at K 8); no decoder over today's scores can produce `1580` |
| D false consensus | how two misreads became STRONG | confidence ignored the rival neutrality the solver had just found; glyph evidence was never consulted |

What the contract settled, measured rather than assumed:

- The frozen reader is right on 24 of 81 development labels (30 %).
- The truth leaves the candidate set through rules, not scores.
- `1580` and `1600` are segmentation failures; `850→810` and `1173→1117` are classifier coin tosses (glyph ratios
  0.98 and 0.93/0.93); `1173` needs two substitutions.
- Alternatives must never witness, seed, corroborate or count.
- Dimension OCR is not the metric phase's cost: about 5 s of 156 s on tunbergiach.

## C. The old numeric reader

`packages/source-metrics/src/ocr.ts` (005D, unchanged by this stage):

1. an adaptive ink mask (local mean, δ 8, absolute 110);
2. glyph-sized components grouped into tokens;
3. shear from 13 slopes;
4. projection-valley segmentation at a uniform pitch of 0.55 × height, the deepest column within ±0.3 pitch;
5. `classifyCell`: thinning onto a 12×16 cell and a chamfer match to prototypes at five slants, times hole, aspect and
   size priors.

The result is one reading per ink, with runners-up above an absolute 0.2. 005D's `boundedValues` added at most one
substitution, at a glyph ratio of 0.7 or more. The metric layer counted every PRIMARY reading on a span of at least
25 tolerances with a cap height of at least 10 px, whatever its quality.

**Contract R1:** the legacy path stays byte for byte as 005D left it (`readNumbers`, the page vote, the legacy chain DP,
datums, angles, callouts), so every CONFIRMED house keeps its model. The lattice is computed beside it, for the plan
frames' label inks that lie on a dimension line, and the metric solver and its re-solve consume it.

## D. dabecjach — root cause

- **Overall width**, box 419,722–442,733, 12 px italic. `5`, `8` and `0` touch. The deepest projection valley in the
  window is the `0`'s counter, not the `8|0` junction. The segmenter cut there: cells `1` .565, `5` .420, `0` .164
  (the `8` plus the `0`'s left side, two holes), `1` .426 (the `0`'s right side). No runner-up passed 0.2. The printed
  figure was two substitutions and a re-cut away, outside every bounded reading.
- **Vertical overall**: `850` read `810` at a glyph ratio of 0.98, a coin toss. It was kept as a bounded alternative
  but still counted as a witness.
- **The metric**: two misreads on two chains agreed within 0.4 % (2.671 and 2.682). Confidence ignored that `810`'s
  runner-up fits the rival 2.81, so the result was CONFIRMED/STRONG on a wrong scale (−4.9 % linear).

## E. tunbergiach — root cause

The overall `1173` (box 393,736–423,752, 17 px) was read `1117`: glyph 3 `1` .485 vs `7` .452, glyph 4 `7` .436 vs `3`
.405 (both ratios 0.93). Segmentation was right to a column. The truth was two substitutions away; 005D's legacy
`readingLattice` held it, but the one-substitution `boundedValues` did not. The correctly read `1000` on the other axis
supported 2.092 cm/px and `1117` supported 1.995. One reading against one gave a tie, the page vote's scale was kept
INCONCLUSIVE, and the house completed 12.47 % small.

## F. Glyph segmentation

`numeric-lattice.ts` (`metrics.numeric-lattice` 1.0.0):

- **Anchor.** The reader's own cuts are hypothesis 0 of each ink variant.
- **Expected glyph width.** E = 0.55 × the tallest glyph-sized blob, not the box: a joined mark inflates the box.
- **Re-cuts.** For each internal boundary, the two best column valleys in today's window. Each valley column is given to
  either side (8 of 13 true boundaries sit one column right), plus the anchor's cut, so at most 5 positions per boundary.
- **Bounds.** At most 2 moved boundaries; cells 0.2–0.95 of the glyph height; at most 16 hypotheses per variant; keep
  those at 0.7 or more of the variant's best segScore (geometric mean of the cells' top scores); at most 4 texts per
  variant and 6 per token. An anchor of more than 7 cells is not a dimension and keeps only itself.
- **A re-cut never supplies the as-read string** (pre-reviews A and C: 18 wrong→wrong and 1 right→wrong against 2
  wrong→right). It only contributes alternatives, with a cost penalty.

## G. Preprocessing

Three ink variants of one ink:

| variant | rule | purpose |
| --- | --- | --- |
| DEFAULT | the reader's mask | unchanged reading |
| STRICT | δ 48, absolute 60 | touching strokes come apart |
| SAUVOLA | local mean − k·σ, k 0.2 | faint strokes survive |

All three are computed on a padded crop with the page's radius, so the DEFAULT crop equals the page mask. **Variants of
one ink are one ink:** a value's probability is the maximum over variants, never a sum, and agreement between variants
is not corroboration (§18 test: three variants reading alike are one witness).

**The stability bracket** (post-review D5E-1) re-reads the STRICT δ and SAUVOLA k at ×0.9 and ×1.1. A reading whose
value moves is never CLEAR or SUPPORTED (§J).

## H. Glyph lattice

- `scoreCell` returns every admitted character's score (the best of its forms).
- **The grammar alphabet**: digits in a full-height cell; `, . - °` only in short cells. A sign never takes a digit's
  candidate slot.
- **Two matcher corrections**, inside the lattice only (R1): a small-counter tolerance (a counter under 0.15 of the box
  is penalised ×0.85, not ×0.5), and a two-hole position term that compares both holes. Before it, every `8` with similar
  counters was floored.
- **Candidates**: within 0.6 of the cell's best, at most 4 per cell, **no absolute floor**. Probabilities come from a
  softmax at T 0.05, and the glyph margin is taken against the unfiltered runner-up.

## I. Sequence beam

Cells are decoded left to right:

- at most 2 non-top choices per sequence;
- beam width 16;
- floor 0.01 of the path's best;
- emitted best first until a cumulative mass of 0.95 or 8 sequences, the as-read string always among them;
- order `(−logp, nonTop, pathRank, text)` on values rounded to 1e-6: no Map order, no randomness, no locale.

Every (variant, segmentation) path yields sequences, and they merge by text (p = max). The grammar is applied at
completion: a string that is not a dimension stays on the record as `NOT_A_DIMENSION`, never as a value. Recorded per
ink:

- expansions and floor drops;
- the truncation reason;
- `mergedCount` and `emittedMass` (what the count bound cut);
- the paths, with the deciding path first.

**The as-read string** is the top reading of the anchor of the ink variant whose cells match best (`pickAsRead`). On
the development labels against the DEFAULT anchor: FIT 6 wrong→right / 1 right→wrong, HELD_BACK 4/0, TARGET 3/0.

## J. OCR confidence calibration

`ocrClassOf`, from the reader's evidence only:

| class | rule |
| --- | --- |
| LOW_QUALITY | min glyph score < 0.2, or cap height < 10 px; never counts or decides |
| AMBIGUOUS | the value moves under the stability bracket, or neither bar below is met |
| CLEAR | p ≥ 0.6 and margin ≥ 0.3 |
| SUPPORTED | p ≥ 0.35 and margin ≥ 0.3 (the margin is post-review C's P0 fix: a two-value coin toss is not SUPPORTED) |

Classes never change a value.

**Policy (`artifacts/analyzer-005e/calibration/README.md`)**:

- Every bound was chosen on the synthetic calibration corpus (seed 5001) and the FIT labels (48), and checked on the
  held-back corpus (seed 9017) and HELD_BACK (21).
- TARGET (12, the round-4 houses) never chose a number.
- The bracket width was fixed a priori.
- Provenance is stated plainly: the pre-reviews that proposed the second and third ink variants measured over label
  sets that included HELD_BACK and TARGET. Round 5 is the only clean check.
- Future blind houses may not move any bound in this stage.

| set | CLEAR right | SUPPORTED right | AMBIGUOUS right |
| --- | --- | --- | --- |
| FIT (48) | 3/3 | 11/17 | 7/27 |
| HELD_BACK (21) | 6/6 | 3/5 | 5/10 |
| TARGET (12, check only) | 0/0 | 6/7 | 1/5 |
| calibration corpus (240) | 38/42 | 58/87 | — |
| held-back corpus (240) | 42/44 | 55/80 | — |

- **Stability**: readings stable under the bracket are right 58 % of the time (226/387); those that move, 25 % (23/93).
  None of the moving ones is CLEAR or SUPPORTED.
- **As a right/wrong separator** the class is a near-tie with the worst glyph runner ratio: AUC 0.76 against 0.74 on
  FIT, 0.81 against 0.83 on HELD_BACK. It is kept because it is defined over the ink's values, which are what the
  metric weighs.
- **Declared limit**: a misread the matcher is sure of is CLEAR or SUPPORTED. The class reduces false consensus; it
  does not detect misreads.

## K. False-consensus protection

`metric-solution.ts` (`metrics.independent-scale` 1.2.0):

- **M1 Witness.** Only the as-read value of a non-LOW ink is a witness. Alternatives never witness, seed a cluster,
  weigh in legacy support, corroborate or count.
- **M2 Contest.** An ink is contested between two scales when its lattice holds a value fitting the other scale at 0.5
  or more of the reading's probability (any value when AMBIGUOUS), or one glyph away at the 005E matcher's ratio of 0.7
  or more. Contested inks leave the ranking and the confidence statistics.
- **M3 Corroboration needs reading quality.** STRONG and SUPPORTED need a CLEAR or SUPPORTED witness in the
  corroborating pair; two AMBIGUOUS witnesses make at most WEAK. A WEAK deciding set made only of AMBIGUOUS inks
  replaces nothing when one of its inks and another counted AMBIGUOUS ink hold alternatives agreeing on another
  plausible scale (post-review C5E-3).
- **M4 False consensus** (`topology.falseConsensus`, recorded with every candidate scale, its pair, and the contested
  and demoted inks). It applies when the class-blind tier is at least SUPPORTED and the class-aware tier is not, and
  either:
  - **BETTER_CLASS_RIVAL**: a rival ink of strictly better class stands against the selection on a substantial share of
    its axis. This is extended to a ≥ SUPPORTED selection with no CLEAR deciding ink (C5E-7).
  - **CANDIDATE_CONSENSUS**: two AMBIGUOUS witnesses on different chains hold alternatives, at 0.5 or more of their
    readings, that agree on one other plausible scale.

  Confidence becomes INCONCLUSIVE, so the first-success challenge runs. The challenger is never selected by this rule,
  and a REPLACE is never handed to a vote with no reading of its own (C5E-2).

## L. Metric integration and non-circularity

- **The lattice takes no scale.** `labelLattice` takes the ink field and one raw token; it has no scale, span, chain,
  tick, other label or published figure. Its module imports only the reader, the parser and pixels (architecture test
  in `numeric-lattice.test.ts`).
- **Values selected only from the ink's own lattice** (M6). A span's value is chosen in this order:
  1. AS_READ (non-LOW, not refuted);
  2. STRUCTURAL (a joint assignment that makes a total agree with its children, with at most 2 non-top choices,
     unique);
  3. SCALE_RANKED (the best image score that fits the chosen scale, among plausible values, on spans long enough to
     measure);
  4. UNRESOLVED.

  Only AS_READ is a witness; STRUCTURAL and SCALE_RANKED are DERIVED.
- **IMAGE_SCORE, STRUCTURAL_SUPPORT and METRIC_SUPPORT are recorded apart**, never multiplied.
- **The re-solve** (a chain read again under a REPLACED or ADDED scale) chooses only among the ink's own
  `correctionReadings`: the as-read value, plus corrections at 0.5 or more of its probability or one glyph away at 0.7
  or more, on spans of at least 25 tolerances. An ink with a lattice never falls back to the 005D substitution list
  (A5E-1, B5E-1).
- **§31 negative.** A value that would fit the scale perfectly but that the image never offered stays missing. The
  selected value of every observation is a sequence of its own lattice. `expectNonCircular` also checks the sealed
  chains of a re-solve.
- **Legacy exemption (B5E-2, contract R1).** Where the page vote's scale is CONFIRMED or LEGACY_UNCONFIRMED and its
  chains are kept, their values come from 005D's substitution list, not from the lattice. Making them obey the lattice
  would move every CONFIRMED model (G2E's X registration would lose all 7 anchors). This is stated in
  `docs/METRIC_EVIDENCE.md` and is residual debt (§AG).

## M. Evidence Pack OCR extension

- **`07-ocr-labels.json`** gains, per label ink, the lattice record:
  - the 005D reading and the as-read string;
  - the class, p and margins;
  - the sequences with image score, probability and rejection reason;
  - the per-glyph candidates and segmentations;
  - the stability bracket's readings, `mergedCount` and `emittedMass`;
  - the selection, with image rank and metric residual apart.

  Numbers and boxes only: no glyph pixel (test: no `base64`, `data:image`, pixel or bitmap key).
- **The timeline** gains `OCR_SEQUENCE_CANDIDATES` (keyed by ink, not by text), before `OCR_READING`.
- **Divergence scoping.** `firstDivergence` compares the tick stage only on marks both runs recorded and lists one-sided
  marks apart (§N).
- **Invariants.** ON == OFF, byte determinism and manifest verification hold
  (`packages/analysis-service/test/evidence-pack.test.ts`, 15 tests).
- **Committed packs.** Four 005E packs are in `artifacts/analyzer-005e/evidence/`, with their first divergences and the
  OCR tables.

## N. dabecjach — before / after

| | 005D (`d8ba4e8`) | 005E (`ebd64eb`, m3) |
| --- | --- | --- |
| overall width | `1501` | `1580`, SUPPORTED p 0.40 |
| vertical overall | `810` | `850`, SUPPORTED p 0.43 (`810` at 0.22) |
| overall `692` | `643` | `692`, AMBIGUOUS p 0.40 |
| overall `1340` | `1700` | `1300`, AMBIGUOUS, `1340` in the lattice at 0.07 — not a witness of the selection |
| overall `490` | `141` | `420`, AMBIGUOUS — not a witness |
| scale | CONFIRMED/STRONG 2.672 on `1501` + `810` | **REPLACED/STRONG 2.8116** on `1580`, `888`, `850`, `692`, `304` (5 readings, 3 chains, both axes); printed overalls state 2.81 |
| outcome | `BOUNDARY_RESOLUTION_INCONCLUSIVE` on a plan 4.9 % small | `BOUNDARY_RESOLUTION_INCONCLUSIVE` at the right scale (the boundary layer, out of scope; §AG) |

**First divergence** (`evidence/first-divergence-dom-w-dabecjach-005d-to-005e.json`): `OCR_SEQUENCE_CANDIDATES`.

The first computation gave `DIMENSION_TICK_CLASSIFICATION` and was investigated before anything was claimed (§24):

- every mark of every chain both runs record has the same class (489 chains, compared in `metric-evidence.json`);
- the 5 differing marks lie on chains a later stage kept only in 005E, once a label there read.

The tool now separates the two (`recordedByOneRunOnly`, test added). Azalia's 005C→005D divergence is unchanged by this:
same stage, same object, the real ACCEPTED→REJECTED flip; its count drops from 28 to 2 because 26 were one-sided.

## O. tunbergiach — before / after

| | 005D | 005E (m3) |
| --- | --- | --- |
| overall `1173` | `1117`, no `1173` among the bounded values | `1171`, AMBIGUOUS p 0.20; `1173` in the lattice at 0.10 |
| overall `1000` | `1000` | `1000`, SUPPORTED p 0.58 |
| scale | LEGACY_UNCONFIRMED/INCONCLUSIVE 1.995 (a 1 : 1 tie) | **REPLACED/WEAK 2.0915** on `1000` + `1171` + `226` (2 groups, both axes); `1117`'s ink contested and demoted |
| model | 1 body, 103.06 m², −12.47 % | 1 body, 117.1 m², **−0.54 %**; storeys still 1 of 3 (registration, out of scope) |

The as-read string is still not the printed figure: the class says so (AMBIGUOUS), the truth is in the lattice, and the
scale `1171` states is within 0.2 % of `1173`'s. The confidence is WEAK and the house carries `METRIC_SCALE_WEAK`. First
divergence: `OCR_SEQUENCE_CANDIDATES` (22 one-sided tick records listed apart).

## P. Azalia regression

| | 005D | 005E |
| --- | --- | --- |
| scale | REPLACED/WEAK 1.8975 (1.9 % large) | REPLACED/WEAK **1.8615** (the hand-measured truth is 1.861–1.864) |
| overall gate | holds | holds (`--metric REPLACED,CONFIRMED --metric-overall`) |
| outcome | `PLAN_RESOLUTION_INCONCLUSIVE` | `PLAN_RESOLUTION_INCONCLUSIVE` (the piers-and-glazing envelope, 005D §Q; unchanged) |

## Q. Current e-OZE — MUST_COMPLETE: PASS

REPLACED/STRONG 2.2222 on an overall reading. 123.91 m² against 122.07, +1.51 % (005D +1.57 %). The model moved (new
hash `75c4ea22…`, not pinned), because the overall the 005D reader recorded as `1601` is now read `1600` as printed (AMBIGUOUS)
(pre-reviews A and C).

## R. Legacy e-OZE — LEGACY_EVIDENCE_COMPATIBILITY

The sealed 005A evidence through the 005E solver, in its own lane and printed "not current acceptance", gives the same
result as 005D, with the same model hashes:

- every copy: COMPLETED −4.20 % (`0a0e019d…`);
- the area copy alone: COMPLETED −4.37 % (`a27f3a5e…`);
- both decoys: refused `PLAN_RESOLUTION_INCONCLUSIVE`;
- the Kosaćce area copy alone: refused `PLAN_RESOLUTION_INCONCLUSIVE`.

## S. Development matrix

`artifacts/analyzer-005e/development-matrix.json`. The 16 rows of §25 are the 15 main rows below plus legacy e-OZE (§R).
Offline from the sealed packages, Evidence Pack on; verdicts by `holdout/verdict.mjs`.

| row | 005D | 005E | model |
| --- | --- | --- | --- |
| Marcówki | PASS −0.28, CONFIRMED/STRONG | PASS −0.28, CONFIRMED/STRONG | unchanged (pinned) |
| Rarytasy G2E | FAIL −2.92, LEGACY_UNCONFIRMED/INCONCLUSIVE | FAIL −2.75, **CONFIRMED/STRONG** | `9f5fd342…` (re-pinned) |
| Kosaćce clean | PASS −1.33, CONFIRMED/SUPPORTED | PASS −1.33, CONFIRMED/STRONG | unchanged (pinned) |
| Kosaćce tracked | PASS −1.33 | PASS −1.33 | unchanged, = clean |
| current e-OZE | PASS +1.57, REPLACED/STRONG | PASS +1.51, REPLACED/STRONG | `75c4ea22…` |
| alternate Marcówki | refused METRIC_RESOLUTION_INCONCLUSIVE | the same | — |
| dom-w-jablonkach | PASS −0.40, REPLACED/WEAK | PASS −0.40, REPLACED/WEAK | `6c8cf347…` |
| willa-miranda | FAIL −5.07 | FAIL −5.07 | unchanged |
| dom-w-zurawkach | FAIL −0.81 | FAIL −0.81 | unchanged |
| dom-w-modrzykach | PASS −0.14, REPLACED/STRONG | PASS −0.54, REPLACED/STRONG | `77b4be1b…` |
| dom-w-azaliach | refused PLAN_RESOLUTION_INCONCLUSIVE, 1.8975 | the same, 1.8615 | — |
| dom-w-dabecjach | refused BOUNDARY, CONFIRMED/STRONG 2.672 (wrong) | refused BOUNDARY, REPLACED/STRONG 2.8116 (right) | — |
| dom-w-tunbergiach | FAIL −12.47, INCONCLUSIVE 1.995 | FAIL −0.54 (storeys), REPLACED/WEAK 2.0915 | `86580d74…` |
| Aster VIII | refused METRIC (no scale) | the same | — |
| galaktyka | refused METRIC (no scale) | the same | — |

- **No PASS became a FAIL**, and no refusal changed its reason.
- **Moved models.** Five models moved:
  - G2E, e-OZE and tunbergiach move with a better-evidenced scale;
  - modrzykach (−0.14 → −0.54 %) and jablonkach (footprint unchanged) move because their re-solved chains now read from
    the lattice.

  All five stay within their verdicts. Every unmoved model is byte-identical.
- **CI** judges each row by its rule (`dev-row.mjs`): G2E is re-pinned with `OPENINGS_NOT_BUILT` and
  `--metric CONFIRMED`, and the two round-4 houses' scales are gated against their printed overalls (`--metric-scale
  2.81` and `2.092`, ±1.5 % on both axes).

## T. Synthetic recall and confusion

The corpus is `synthetic-drawings/digit-corpus.ts`: two stroke faces that are neither the reader's templates nor a
publisher's font, ten strata, 240 labels per seed. Recall means "the printed figure is among the lattice's values".

| seed | 005D top-1 | 005D one-sub | as read | top-3 | top-5 | top-8 | CLEAR right | SUPPORTED right |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 5001 (calibration) | 77 | 108 | 128 | 169 | 184 | 189 | 38/42 | 58/87 |
| 9017 (held back) | 81 | 110 | 121 | 171 | 183 | 187 | 42/44 | 55/80 |

- **Per stratum**, the lattice keeps the truth in 21–24 of 24 for CLEAN, ITALIC, SMALL, ANTIALIASED_THIN, BLURRED and
  LIGHT_INK.
- **Hard strata**: BROKEN 8–10, TIGHT 12–16, TOUCHING 1–3. Fused glyphs have no valley to re-cut; this is declared.
- **The confusion matrix** (1787 glyphs) and the size and variant tables are in the calibration README. The worst
  digits are `9` (63 % right, read `4` ×34) and `4` (66 %, read `0` ×61); both are 100 % / 80 % in the cell's top-K.
- **Development labels (81)**: top-8 72 against 005D's one-substitution 47; as-read 42 against 005D's 24.
- **Gates** (`numeric-lattice.test.ts`):
  - §30 two-substitution adversary: the old generator misses the truth and the beam keeps it;
  - §28 blur and broken strokes: never a CLEAR different dimension;
  - touching hollow pairs: ordinary spacing is held, and tight spacing is never CLEAR wrong;
  - the corpus gate: recall, as-read and CLEAR precision on both seeds, never below 005D;
  - determinism and bounds; grammar; image-only imports.
- **Adversaries** (`ocr-metric-adversaries.test.ts`, 21 tests): §29 false consensus (with children on their own line,
  framed, and without them; one-glyph coin tosses on each axis); §15 confidence semantics; §18 variants and twin lines;
  §31 negatives; §17 plausible corrections; §16 the vote never handed a REPLACE.
- **The §41 anti-aliasing scale clause** now passes: its `it.fails` is now `it`.

## U. Performance and cache

Development matrix m3 against 005D, 15 rows, matrices run four at a time on shared cores (row times vary ±20 % run to
run):

| | 005D | 005E |
| --- | --- | --- |
| total analysis, sum of 15 rows | 2371 s | 2454 s (+3.5 %) |
| metric phase, sum | 1918 s | 2004 s |
| of which the lattice (`OCR_LATTICE` subphase) | — | 70.6 s (3.5 % of the metric phase; 0.6–7.6 s per row) |
| peak RSS | 666–905 MB | 678–926 MB |
| longest tick gap | — | 1.1–3.2 s |

The metric phase is still dominated by the opening-callout ring reader (dabecjach: 149.5 s of 169.1 s; the lattice
6.4 s).

**Cache:**

- per run, a crop-keyed lattice cache, verified byte for byte (a different ink under the same box is read afresh);
- cells memoised per (variant, x0, x1).

The cross-label cache rarely hits on real plans (D5E-6) and serves identical crops within a run. There is no cross-run
result cache in this service. Each result and pack carries every component's version (`metrics.numeric-lattice`
1.0.0, `metrics.numeric-ocr` 1.3.0, `metrics.independent-scale` 1.2.0, metric-evidence schema 1.4.0), so a result from
another reader is identifiable.

## V. Progress

The lattice reports `OCR_LATTICE` ticks per label (`counters.label` / `labelsTotal`). The run record carries
per-subphase milliseconds (`PhaseStats.subphaseMs`). The phone shows the step as "odczyt wymiarów: etykieta n z m"
(`AnalyzerScreen.kt`, `strings.xml`). The longest tick gap across the matrix is 3.2 s (galaktyka, in `OBSERVE_ASSETS`, outside the metric phase);
inside the lattice a tick lands every label.

## W. Post-implementation review

Four read-only reviewers on `8b8bd39` (`artifacts/analyzer-005e/post/`): A OCR candidate recall, B non-circularity, C
false-consensus red team, D performance and overfit. Every P0 and P1 is fixed in `ebd64eb` except B5E-2, which is
recorded with its exemption (`post/resolution.md`):

- **C5E-1 (P0)**: the class rule ignored the margin. A coin toss was SUPPORTED, and §29 without its children came out
  STRONG at −6.5 %. Fixed with the margin bar.
- **C5E-2 (P1)**: false consensus pushed true scales aside and could hand a REPLACE to a vote with no reading. Fixed:
  the rival must stand, and the vote never gets a REPLACE.
- **C5E-3 (P1)**: one AMBIGUOUS overall replaced the vote at +42 % on the anti-aliasing sheet. Fixed: the doubted rule.
- **A5E-1 and B5E-1 (P1)**: a leading-zero as-read dropped the ink, the re-solve fell back to the 005D list, and a
  LOW_QUALITY blob was sealed `251`. Fixed: lattice-only readings.
- **D5E-1 (P1)**: the as-read string sat on a knife edge of STRICT's threshold. Fixed: the stability bracket.
- **B5E-2 (P1)**: the kept 005D chains. Recorded, not changed (R1).

After the fixes, the selected plan frames of all 15 development rows replay with the same relation, confidence and scale
as before them.

The P2s are fixed or documented:

- count-bound telemetry;
- the as-read emitted under K;
- deciding path first;
- twin key by mark indices;
- SCALE_RANKED and STRUCTURAL bounded;
- the false-consensus record;
- calibration text, provenance and sensitivity.

**What the bracket does not do** (D's ±20 % sweep of STRICT δ, documented, δ not moved): G2E keeps its scale at every
δ and only its confidence falls; Azalia takes a scale 1.9 % large at WEAK a fifth either way. dabecjach is right at the
shipped δ and above it; below it, it stays on the vote's wrong scale INCONCLUSIVE (005D called that scale STRONG). No
wrong scale reaches SUPPORTED or STRONG at any δ.

## X. PRE_HOLDOUT_5_SHA

**`9f7423d90b84fc7ff3d6bb976332539390d25879`**: the CI rows and the round-4 before/after evidence on the post-review code
(`ebd64eb`) with the record-scoped divergence. Before it:

- the development matrix (§S) with no PASS lost;
- current e-OZE green and legacy e-OZE in its own lane (§Q, §R);
- the four reviews closed (§W);
- every suite green locally: typecheck, and vitest 145 files / 1924 tests, 9 skipped.

It was pushed to both branches. CI run 131 (`36912397814`, push): 35 jobs, 34 green and `preview-latest` skipped by
design, completed 20:00:48Z. Nothing production changed after it. The commits since are the ledger line (`0afd751`),
the sealed blind evidence (`18295c2`) and documents.

## Y. Blind pool and seed

The protocol is `holdout/README.md` § Round 5, fixed before the freeze:

- two ARCHON families, one pick each, from the round-1 pool (sha256 `800c2a1e…2ed41`);
- 43 excluded families (`excluded-families-round-5.txt`, sha256 `d33caf40…94340`): round 4's 41 plus the two round-4
  draws, now development houses;
- 2480 drawable addresses.

`seed = SHA256(PRE_HOLDOUT_5_SHA + "BUILDPLAN-005E-NUMERIC-OCR-HOLDOUT")` = `c5fecae1…64a1`, recomputed independently.
`i1 = seed mod 2480 = 1457` and `i2 = 1476` (round 1's second-pick rule). The ledger line is
`BUILDPLAN-005E-NUMERIC-OCR-HOLDOUT`, 20:05:23Z, commit `0afd751`.

| # | family | address |
| --- | --- | --- |
| 1 | `dom-w-modrzewnicy` | `https://www.archon.pl/projekty-domow/projekt-dom-w-modrzewnicy-10-g2e-oze-m8a12761847734` |
| 2 | `dom-w-morelach` | `https://www.archon.pl/projekty-domow/projekt-dom-w-morelach-n-ver-2-m95a1f6e528ef4` |

Neither family appears in any exclusion file of any round or anywhere under `stage-reports/`. Each ran **once**, live,
one after the other, with the frozen code and `ANALYZER_EVIDENCE=1`:

| # | wall | analysis | metric phase | lattice | peak RSS |
| --- | --- | --- | --- | --- | --- |
| 1 | 204 s | 198.0 s | 165.0 s | 4.3 s | 757 MB |
| 2 | 161 s | 154.1 s | 122.9 s | 5.9 s | 789 MB |

Longest tick gap: 3.4 s on #1 (`OBSERVE_ASSETS`) and 2.4 s on #2 (`ACQUIRE_ASSETS`). Verdicts are by
`holdout/verdict.mjs`, as frozen. Sealed in `artifacts/analyzer-005e/holdout/` and `evidence/blind-*` (`18295c2`). The
raw plans were looked at locally for the diagnosis and are not committed.

## Z. Blind 1 — `dom-w-modrzewnicy`: ALGORITHMIC_FAIL

Refused by name: `RECONSTRUCTION_FAILED / METRIC_RESOLUTION_INCONCLUSIVE`. No scale was adopted, so no wrong building
was built, but the source checklist finds nothing source-limiting: the overall dimensions are printed legibly and the
walls are 12 px. A refusal on a legible plan is an algorithmic fail.

- **The printed overalls**: `2590` (= 1950 + 640) and `1000` (= 210 + 730 + 60), about 4.0 cm/px.
- **The face is condensed**: four glyphs in about 20 px along the line at a cap height of 11 px, a glyph pitch near
  0.45 of the height.
- **The reader**:
  - `2590` → `140` (LOW_QUALITY), no four-glyph value in its lattice;
  - `1950` → `1410` (**SUPPORTED**, p 0.47, stable);
  - `640` → `600` (AMBIGUOUS, truth in its lattice);
  - `1417` → `1117` (AMBIGUOUS, truth first in its lattice);
  - `730` → `150` (truth absent);
  - `1000` → `1000` (SUPPORTED), but bound UNCENTRED to a 28 px span, not to the overall.
- **The metric**: the as-read total `1410` (2.895 cm/px) and its as-read child `600` (3.75) disagree, and no reading
  outside them decides, so NO_SCALE/INCONCLUSIVE.

The refusal is honest about the scale, but its "what is missing" text says the plan prints no dimension, which is
wrong (§AG).

**What 005E did right here**: a SUPPORTED misread did not carry a scale on its own. **What it did not do**: read the
overalls of a condensed face.

## AA. Blind 1 — first divergence (first bad decision)

**`e00013`, `OCR_SEQUENCE_CANDIDATES`, `ink:text-region-105-426-e60ff2d1a1:ROTATED_CW`**: `CANDIDATES:140|100,200,220,
230,240,540,740`, LOW_QUALITY (p 0.124), read `100` by the 005D reader.

The overall `2590`'s ink, 21 px along the line, is cut into three cells. The expected glyph width, 0.55 × the cap
height (≈ 6 px), fits three. By contract the cell count is never varied (pre-review A P1-5: varying it cost 5 345
hypotheses for 14 of 38 synthetic truths and flipped correct readings), so no four-glyph value can enter the lattice.
The truth was unreachable before any decoding.

Next, **`e00015`**: `1950` → `CANDIDATES:1410|1010,1430,1440,1450,1451,1470,1910`, SUPPORTED.

- Both true glyphs are cell candidates (`9` p 0.04 at score ratio 0.66; `5` p 0.08 at 0.71).
- Their joint path, about 0.005 of the best, is under the beam's 0.01 floor. Emission ends on the count bound
  (18 merged, mass 0.86).

Then `e00209` `METRIC_RELATION` NO_SCALE/INCONCLUSIVE, and the refusal.

**The defect class for the next stage**: the glyph count of a condensed face (the expected-width rule), and a confident
two-glyph misread that the class calls SUPPORTED. Both are numeric-reader failures on unseen bytes. They are declared
limits of this stage's reader (calibration README: fused and tight glyphs; confident misreads) that the blind round
found on a real plan.

## AB. Blind 2 — `dom-w-morelach`: ALGORITHMIC_FAIL

Completed with 2 bodies, 101.31 m² against the published 114.53 (**−11.54 %**, which fails the 10 % footprint
condition). Storeys are 2 of 2 and every printed opening is built (both hold). The challenge KEPT the first reading.
Limits: `LAYOUT_STRUCTURE_READS_AS_ONE_BLOCK`, `LAYOUT_FOOTPRINT_AREA_NEAR`, `METRIC_SCALE_WEAK`, `EXTERIOR_JOINTS`.

**The scale is right**: CONFIRMED/WEAK 1.9956 cm/px on `1062`, `380` and `350`. The printed `1062` over 532 px states
1.9962, and `1212` (= 380 + 732 + 100) agrees. The confidence is WEAK because all three witnesses are AMBIGUOUS.

How the lattice served this unseen plan:

| label | 005D read | 005E | class | how it entered |
| --- | --- | --- | --- | --- |
| `350` | `750` | `350` (right) | — | as read |
| `1212` | — | `1212` (right) | SUPPORTED | as read |
| `415` | `015` | — | — | SCALE_RANKED from its own lattice (derived, never a witness) |
| `297` | — | — | — | SCALE_RANKED from its own lattice (derived, never a witness) |
| `732` | — | `737` | — | truth in the lattice |
| `642` | — | `602` | — | truth in the lattice |

No numeric-reader or metric decision on this house is wrong.

## AC. Blind 2 — first divergence (first bad decision)

**`e00427`, `ENVELOPE`, `envelope:frame-asset-rzut-63ae7d4e86-027bb2e82d`**: `BOX:61,208.5,609.5,739`, 33 of 49
cells enclosed, inside a chain extent (`e00426`) that reaches 670. Two pieces of the building are left out:

- **The east kitchen bay** (about 1.1 × 3.5 m). `e00429` classes it `NOT_BUILT`: 4.2 m², `FLUSH_ATTACHED`, junction
  wall 0.55, its candidate drawn 609.5–670 × 323–716, taller than the bay.
- **The garage's south end**, with the garage door. The garage mass stops at y 590 (`e00431`).

The opening-aware outline was not adopted ("adds nothing the box leaves open"). The first bad decision is in the 005C
boundary layer, downstream of a right scale. Boundary refoundation is outside this stage (§48).

## AD. CI

| Run | Commit | Result |
| --- | --- | --- |
| 125 | `d8ba4e8` | green (005D's last record; the base of this branch) |
| 126 | `39db89c` | cancelled by the next push (concurrency group) |
| 127 | `af9f2ca` | **failed**, on code since fixed: G2E's pin (its model moved with its evidence; re-pinned in `9f7423d`); `dom-w-jablonkach` at −16.89 % (the implausible-correction defect fixed in `8b8bd39`, §S); and the UI gate, whose log tail names no error |
| 128 | `8b8bd39` | **failed**: G2E's pin only (re-pinned in `9f7423d`) |
| 129, 130 | `5d1b7bd`, `85b226b` | cancelled by the next push; 130 had 29 green when cancelled and failed only G2E's old pin |
| **131** | `9f7423d` | **green at the first attempt**: 35 jobs, 34 green and `preview-latest` skipped by design (push). This covers every 005E gate (dimension evidence with the lattice and the adversaries, the Evidence Pack and its committed packs, the 15 development houses with the round-4 houses' scale gates, generalization, plan resolver, envelope, known rows), Android with the UI evidence gate, browser and container. **`PRE_HOLDOUT_5_SHA`** |
| 132, 133 | `0afd751`, `18295c2` (push) | superseded by the next push and by the dispatch below |
| final | this report's commit | `workflow_dispatch` with the OWNER APK; recorded in §AF once it completes |

## AE. Commits

| commit | what |
| --- | --- |
| `39db89c` | docs: the four numeric-reader pre-reviews and the implementation contract |
| `0427773` | feat(ocr): per-glyph candidate lattice and a bounded sequence beam |
| `af9f2ca` | feat(metric): OCR quality in metric confidence, false-consensus protection |
| `d4bf229` | fix(metric): a lattice never makes an ink more decisive than a 005D runner-up |
| `a8ba3db` | test(ocr): multi-glyph, false-consensus and non-circularity adversaries |
| `45cdaa9` | docs: the numeric lattice, OCR classes and calibration tables |
| `8b8bd39` | fix(metric): a chain read again chooses only among plausible values, on spans that measure |
| `ebd64eb` | fix(ocr,metric): post-review P0/P1 (class margin, stability bracket, lattice-only readings, bounded doubt) |
| `5d1b7bd` | docs: the four post-implementation reviews, their resolution, the re-run calibration |
| `85b226b` | ci: the development-row judge can gate the selected copy's scale |
| `9f7423d` | ci, evidence: the 005E development rows, the round-4 before/after packs, the record-scoped tick divergence (**PRE_HOLDOUT_5_SHA**) |
| `0afd751` | holdout: the round-5 draw (ledger line) |
| `18295c2` | docs(holdout): the sealed blind round 5 |
| this report's commit | docs: this report and `PROJECT_STATUS.md` (the final build) |

No model identifier appears in any commit. Git identity is unchanged, and nothing was force-pushed, reset or stashed.

## AF. OWNER APK

Built by the final `workflow_dispatch` run on this report's commit (arm64, preview signer) and verified from the downloaded file. The record follows in the next commit; the APK itself is not committed.

## AG. Residual debt

### The numeric reader (blind round 5, §AA)

- **Glyph count on condensed faces.** The expected glyph width (0.55 × the cap height) cuts a condensed four-glyph
  label into three cells. The count is never varied, by contract. The next stage's input.
- **Two weak alternatives.** A two-substitution truth whose glyphs sit at p 0.04 and 0.08 falls under the beam's
  0.01 floor and the count bound (`1950` → `1410`).
- **Confident misreads.** A reading the matcher is sure of is CLEAR or SUPPORTED (C5E-7; `1410` SUPPORTED on blind 1;
  the corpus: 6 wrong of 86 CLEAR). The class reduces false consensus; it does not detect misreads.
- **The count bound** is where development truths are lost (A5E-2: 7 of 9); not moved.

### The metric layer

- **The kept 005D chains (B5E-2, contract R1).** Where the page vote's scale is confirmed or kept, its chains hold
  005D's substitutions, which can lie outside the ink's lattice. Changing that moves every CONFIRMED model; it needs
  its own decision.
- **Pre-existing records (B5E-4, B5E-6).** A printed span whose label misses the scale is sealed DERIVED;
  CHAIN_CORRECTED values anchor registrations.
- **Stability is bracketed, not removed.** STRICT δ moved by a fifth still moves four development frames' outcomes, none
  to a confident wrong scale (§W).

### Downstream and records

- **Blind 1's refusal text** says the plan "prints no dimension". It prints several; they were misread. The "what is
  missing" sentence comes from the resolver's first reading on another copy, and the message should name the misread
  overalls instead.
- **Label binding**: blind 1's correctly read `1000` bound UNCENTRED to a 28 px span of its overall line (one rejected
  mark skipped).
- **The envelope (blind 2, §AC)**: the box stops inside the chain extent, an attached bay's candidate is drawn taller
  than the bay, and a garage with its door on the outline stops short. This is the 005C boundary layer, outside this
  stage.
- **Storeys** (tunbergiach, willa-miranda, dom-w-zurawkach): upper plans register onto no body. Storey registration is
  outside this stage.
- **dabecjach** stops at the boundary layer (`BOUNDARY_RESOLUTION_INCONCLUSIVE`) at the right scale.
- **The Evidence Pack format version** stays 1.0.0 for the additive OCR layer. Each manifest carries the reader,
  lattice and schema versions that mark it.
- **The calibration's provenance**: the second and third ink variants were proposed by pre-reviews that measured over
  HELD_BACK and TARGET labels. Round 5 is the only clean check of this stage, and it is reported above.

## AH. Next step

**Return to the coordinator** with the round-5 defects as the next stage's input. These are the numeric reader's
glyph count on a condensed overall label (`dom-w-modrzewnicy`: `2590` cut into three cells, `1950` read `1410`
SUPPORTED; `artifacts/analyzer-005e/holdout/`, `evidence/blind-h1-*`) and the envelope's box and attached-bay decisions
on a right scale (`dom-w-morelach`, `evidence/blind-h2-*`). Both families join the development set, and a further
claim needs a new blind draw on a new frozen SHA.
