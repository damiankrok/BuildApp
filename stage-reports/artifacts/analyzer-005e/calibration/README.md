# 005E numeric-reader calibration

Text facts only: counts, rates and bounds. No glyph, crop or raster from any publisher is in this directory or
anywhere in the repository; the development labels (`development-labels.json`) are figures transcribed by eye from
local crops kept outside the worktree.

## Policy (brief §32)

- Every bound in `numeric-lattice.ts` (`LATTICE_BOUNDS`, `OCR_CLASS_BOUNDS`, the ink variants, the matcher options)
  and the metric layer's `VALUE_BOUNDS.contestRatio` was chosen on the **synthetic calibration corpus** (seed 5001)
  and the **FIT** development labels (48 labels, 6 houses), and checked on the **held-back corpus** (seed 9017) and
  the **HELD_BACK** labels (21 labels, 3 houses).
- **TARGET** labels (12, the two round-4 blind houses whose misreads motivated the stage) never chose a number; they
  are reported as a check only.
- The corpus is drawn in two stroke faces (`synthetic-drawings/digit-corpus.ts`) that are neither the reader's
  templates nor any publisher's font, in ten strata, from two disjoint seeds.
- No bound names a house, a printed value or a published figure; the production hard-code guard
  (`tests/architecture/generalization.test.ts`) scans for them.
- Future blind houses may not change any of these bounds in this stage. A blind failure is reported, not patched.

## What each bound was chosen on

| bound | value | chosen on | checked on | note |
| --- | --- | --- | --- | --- |
| ink variants | DEFAULT, STRICT (δ 48 / abs 60), SAUVOLA (k 0.2, R 128, abs ≤ 110) | FIT, calibration corpus | HELD_BACK, held-back corpus | the smallest non-dominated set; re-readings of one ink, never independent witnesses |
| segmentation | ≤ 2 valleys per boundary, ≤ 2 moved boundaries, ≤ 16 hypotheses, cells 0.2–0.95 H, keep ≥ 0.7 of the variant's best | FIT | HELD_BACK | a re-cut never supplies the as-read string |
| glyph candidates | ratio ≥ 0.6 of the cell's best, ≤ 4 per cell, softmax T = 0.05 | calibration corpus, FIT | held-back corpus, HELD_BACK | grammar alphabet: digits for full-height cells, `, . - °` for short ones |
| beam | ≤ 2 non-top glyphs, width 16, floor 0.01, mass 0.95, ≤ 8 sequences, re-cut penalty 1.0 | calibration corpus, FIT | held-back corpus, HELD_BACK | replaces 005D's one-substitution rule |
| as-read rule | the anchor of the ink variant whose cells match best (segScore) | FIT, both corpora | HELD_BACK | development labels: 13 wrong→right, 1 right→wrong against the DEFAULT anchor |
| classes | LOW_QUALITY min glyph < 0.2 or cap < 10 px; CLEAR p ≥ 0.6 and margin ≥ 0.3; SUPPORTED p ≥ 0.35; else AMBIGUOUS | FIT, calibration corpus | HELD_BACK, held-back corpus | the reading's calibrated probability among the ink's values |
| contest | an alternative contests a scale at ≥ 0.5 of the reading's probability (any, when AMBIGUOUS), or one glyph away at glyph ratio ≥ 0.7 | FIT houses' plan frames | HELD_BACK houses' plan frames | 0.7 is 005D's substitution bound, so the lattice never makes an ink more decisive than 005D left it |

### The class rule

The contract's first proposal ranked inks by their worst glyph runner ratio. Measured on the FIT labels with the
005E matcher, the probability of the as-read string among the ink's emitted values separates right from wrong
readings better: AUC 0.746 against 0.646 for the worst runner ratio (0.729 when a runner-up whose hole count
contradicts the cell is ignored), 0.723 for the minimum glyph score. The shipped bars give:

| set | CLEAR right | SUPPORTED right | AMBIGUOUS right | LOW_QUALITY right |
| --- | --- | --- | --- | --- |
| FIT (48) | 3/3 | 11/20 | 6/23 | 0/2 |
| HELD_BACK (21) | 6/6 | 3/5 | 5/10 | 0/0 |
| TARGET (12, check only) | 0/0 | 7/8 | 0/4 | 0/0 |
| calibration corpus (240) | 39/43 | 69/103 | — | — |
| held-back corpus (240) | 43/45 | 59/93 | — | — |

CLEAR is right on every development label it marks and on 82 of 88 corpus labels. The six corpus misses are
confident single-glyph misreads (an `8` a stroke break turns into a `6`, a `9` read `4`): the class cannot see a
misread the matcher is sure of, and that is a declared limit of the class, not a reason to move its bars. A
re-grid of the bars on today's FIT labels would move CLEAR's probability bar from 0.60 to 0.55; it was not applied,
because the shipped bars were fixed before these tables and the change is inside the noise of 48 labels.

## Measured tables (brief §26–28)

Recall is "the printed figure is among the lattice's sequences" — the quantity that matters downstream: a truth
that leaves the candidate set can never be weighed. "005D one-sub" is the 005D bounded set (as read, or one glyph away
at a runner ratio ≥ 0.7). Times are per label on one core, the lattice only.
### Seed 5001 (calibration): 240 labels

| stratum | n | 005D top-1 | 005D one-sub | as read | top-1 | top-3 | top-5 | top-8 | CLEAR right | SUPPORTED right | mean K | ms/label |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CLEAN | 24 | 10 | 16 | 19 | 18 | 21 | 24 | 24 | 9/9 | 7/11 | 6.1 | 6.2 |
| ITALIC | 24 | 11 | 16 | 17 | 18 | 21 | 24 | 24 | 1/2 | 14/15 | 7.1 | 11.7 |
| SMALL | 24 | 13 | 17 | 16 | 17 | 21 | 23 | 23 | 7/7 | 8/11 | 7.0 | 11.6 |
| ANTIALIASED_THIN | 24 | 12 | 17 | 17 | 17 | 23 | 24 | 24 | 6/6 | 10/14 | 6.4 | 7.0 |
| BLURRED | 24 | 6 | 14 | 20 | 19 | 24 | 24 | 24 | 3/3 | 11/12 | 7.5 | 7.9 |
| BROKEN | 24 | 2 | 6 | 4 | 4 | 8 | 8 | 8 | 0/3 | 4/12 | 7.2 | 9.1 |
| TOUCHING | 24 | 0 | 0 | 1 | 1 | 1 | 1 | 1 | 0/0 | 0/0 | 8.0 | 17.8 |
| TIGHT | 24 | 2 | 5 | 6 | 4 | 12 | 16 | 16 | 0/0 | 2/5 | 8.0 | 18.4 |
| HEAVY | 24 | 9 | 15 | 15 | 14 | 16 | 17 | 21 | 5/5 | 8/11 | 7.2 | 10.4 |
| LIGHT_INK | 24 | 12 | 20 | 13 | 16 | 22 | 23 | 24 | 8/8 | 5/12 | 6.7 | 6.7 |
| ALL | 240 | 77 | 126 | 128 | 128 | 169 | 184 | 189 | 39/43 | 69/103 | 7.1 | 10.7 |

### Seed 9017 (held back): 240 labels

| stratum | n | 005D top-1 | 005D one-sub | as read | top-1 | top-3 | top-5 | top-8 | CLEAR right | SUPPORTED right | mean K | ms/label |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CLEAN | 24 | 19 | 22 | 21 | 22 | 24 | 24 | 24 | 12/12 | 8/9 | 5.2 | 4.2 |
| ITALIC | 24 | 12 | 20 | 18 | 17 | 23 | 24 | 24 | 5/5 | 7/9 | 7.5 | 13.1 |
| SMALL | 24 | 6 | 11 | 14 | 15 | 20 | 22 | 22 | 6/6 | 5/9 | 6.8 | 10.6 |
| ANTIALIASED_THIN | 24 | 12 | 18 | 18 | 20 | 22 | 23 | 23 | 8/8 | 8/10 | 6.3 | 8.0 |
| BLURRED | 24 | 6 | 10 | 12 | 15 | 20 | 23 | 23 | 1/1 | 9/13 | 7.6 | 9.3 |
| BROKEN | 24 | 4 | 10 | 4 | 4 | 5 | 7 | 10 | 3/4 | 1/10 | 7.1 | 9.4 |
| TOUCHING | 24 | 0 | 3 | 0 | 0 | 3 | 3 | 3 | 0/0 | 0/2 | 8.0 | 16.7 |
| TIGHT | 24 | 3 | 4 | 5 | 5 | 10 | 11 | 12 | 0/0 | 3/4 | 8.0 | 18.4 |
| HEAVY | 24 | 1 | 10 | 8 | 9 | 20 | 22 | 22 | 1/2 | 4/11 | 7.4 | 11.5 |
| LIGHT_INK | 24 | 18 | 20 | 21 | 21 | 24 | 24 | 24 | 7/7 | 14/16 | 6.7 | 7.6 |
| ALL | 240 | 81 | 128 | 121 | 128 | 171 | 183 | 187 | 43/45 | 59/93 | 7.1 | 10.9 |

### Per-digit confusion (both corpora; 1787 glyphs at aligned positions of 450 labels)

| true digit | glyphs | read right | in the cell’s top-K | most frequent misread | mean runner ratio |
| --- | --- | --- | --- | --- | --- |
| 0 | 121 | 91/121 (75 %) | 99/121 (82 %) | 1 ×10, 5 ×9 | 0.60 |
| 1 | 180 | 175/180 (97 %) | 178/180 (99 %) | 7 ×2, 5 ×2 | 0.51 |
| 2 | 183 | 153/183 (84 %) | 182/183 (99 %) | 7 ×22, 1 ×3 | 0.79 |
| 3 | 188 | 174/188 (93 %) | 188/188 (100 %) | 5 ×8, 7 ×3 | 0.82 |
| 4 | 188 | 125/188 (66 %) | 188/188 (100 %) | 0 ×61, 3 ×1 | 0.72 |
| 5 | 178 | 165/178 (93 %) | 174/178 (98 %) | 1 ×8, 9 ×2 | 0.61 |
| 6 | 185 | 155/185 (84 %) | 164/185 (89 %) | 5 ×15, 1 ×11 | 0.61 |
| 7 | 201 | 188/201 (94 %) | 199/201 (99 %) | 1 ×8, 3 ×3 | 0.69 |
| 8 | 187 | 156/187 (83 %) | 165/187 (88 %) | 6 ×10, 1 ×7 | 0.59 |
| 9 | 176 | 110/176 (63 %) | 140/176 (80 %) | 4 ×34, 5 ×13 | 0.79 |

#### By size bucket and by the as-read ink variant

| bucket | glyphs | read right | in top-K |
| --- | --- | --- | --- |
| cap 12–13 px | 427 | 363/427 (85 %) | 398/427 (93 %) |
| cap 14–15 px | 808 | 674/808 (83 %) | 753/808 (93 %) |
| cap 16–17 px | 552 | 455/552 (82 %) | 526/552 (95 %) |
| variant DEFAULT | 266 | 182/266 (68 %) | 231/266 (87 %) |
| variant STRICT | 1088 | 954/1088 (88 %) | 1047/1088 (96 %) |
| variant SAUVOLA | 433 | 356/433 (82 %) | 399/433 (92 %) |

Beam: ≤8 sequences, width 16, ≤2 non-top glyphs; mean expansions 173, max 591.

### Development labels (81; transcribed by eye, text facts only)

| split | n | 005D read | as read | top-3 | top-8 | CLEAR right | SUPPORTED right | AMBIGUOUS | LOW_QUALITY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FIT | 48 | 12 | 20 | 33 | 42 | 3/3 | 11/20 | 6/23 | 0/2 |
| HELD_BACK | 21 | 9 | 14 | 18 | 19 | 6/6 | 3/5 | 5/10 | 0/0 |
| TARGET | 12 | 3 | 7 | 7 | 10 | 0/0 | 7/8 | 0/4 | 0/0 |
| ALL | 81 | 24 | 41 | 58 | 71 | 9/9 | 21/33 | 11/37 | 0/2 |

## Declared limits

- **Fused glyphs.** In the TOUCHING stratum (gap −0.04…0.02 of the cap height) the lattice keeps the printed figure
  in 1 and 3 of 24; with no column valley between two glyphs there is nothing to re-cut. Never CLEAR there.
- **Tight hollow pairs.** At gap ≤ 0.08 a `0` next to another hollow glyph (`80`, `00`, `60`, `90`) is still mostly
  lost; at ordinary spacing (0.12) the lattice holds all 18 tested pairs where the 005D bounded set holds a few.
- **Broken strokes.** 8 and 10 of 24; three corpus CLEARs in this stratum are wrong.
- **Anti-aliasing on the §41 sheet.** The overall reads `1700` (AMBIGUOUS, `1200` its best alternative) while its
  part labels are lost to the blur, so a single overall reading still decides, at WEAK; declared in
  `dimension-topology.test.ts` as before.
- **SUPPORTED corroborates.** About two thirds of SUPPORTED readings are right on the corpora and on the development
  labels. Two SUPPORTED inks that agree are still two witnesses; the false-consensus check covers only coin tosses
  (AMBIGUOUS) and better-read rivals.
