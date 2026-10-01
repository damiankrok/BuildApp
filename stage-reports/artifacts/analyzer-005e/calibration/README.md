# 005E numeric-reader calibration

Text facts only: counts, rates and bounds. No glyph, crop or raster from any publisher is in this directory or
anywhere in the repository; the development labels (`development-labels.json`) are figures transcribed by eye from
local crops kept outside the worktree.

## Policy (brief §32)

- Every bound in `numeric-lattice.ts` (`LATTICE_BOUNDS`, `OCR_CLASS_BOUNDS`, `STABILITY_BRACKET`, the ink variants, the
  matcher options) and the metric layer's `VALUE_BOUNDS.contestRatio` was chosen on the **synthetic calibration
  corpus** (seed 5001) and the **FIT** development labels (48 labels, 6 houses), and checked on the **held-back corpus**
  (seed 9017) and the **HELD_BACK** labels (21 labels, 3 houses). `STABILITY_BRACKET` (±10 %) was fixed a priori, not
  fitted.
- **TARGET** labels (12, the two round-4 blind houses whose misreads motivated the stage) never chose a number in the
  coordinator's calibration; they are reported as a check only.
- **Provenance, stated plainly (post-review D P2):** the four pre-implementation reviews that *proposed* the second and
  third ink variants (STRICT δ 48 / abs 60, SAUVOLA), the softmax temperature, the glyph ratio and the small-counter fill
  measured over label sets that included the HELD_BACK houses and the TARGET labels. Those proposals were then checked
  here split by split, but the HELD_BACK and TARGET rows are not clean held-out evidence for them. Blind round 5 is the
  only clean check of this stage.
- The corpus is drawn in two stroke faces (`synthetic-drawings/digit-corpus.ts`) that are neither the reader's
  templates nor any publisher's font, in ten strata, from two disjoint seeds.
- No bound names a house, a printed value or a published figure; the production hard-code guard
  (`tests/architecture/generalization.test.ts`) scans for them.
- Future blind houses may not change any of these bounds in this stage. A blind failure is reported, not patched.

## What each bound was chosen on, and how much it matters

Sensitivity is post-review D's: each constant moved ±20 % alone, scored on both corpora, the 81 development labels by
split and a replay of 14 development rows' selected plan frames (`../post/performance-overfit-review.md` §D5E-1/3).
"Inert" means no outcome moved on any of the three sets — those constants are bounds on work, not tested choices.

| bound | value | chosen on | ±20 % (post-review D) | note |
| --- | --- | --- | --- | --- |
| ink variants | DEFAULT; STRICT δ 48 / abs 60; SAUVOLA k 0.2, R 128, abs ≤ 110 | FIT, calibration corpus (proposed by pre-reviews A, B) | **STRICT δ moved readings and frame outcomes** (D5E-1); SAUVOLA k/R moved one CONFIRMED confidence; dropping SAUVOLA cost one STRONG; abs bars inert | re-readings of one ink, never independent witnesses; the stability bracket below answers D5E-1 |
| stability bracket | STRICT δ and SAUVOLA k × 0.9 and × 1.1 | a priori | — | an as-read value that moves under it is AMBIGUOUS |
| segmentation | ≤ 2 valleys per boundary, ≤ 2 moved boundaries, ≤ 16 hypotheses, cells 0.2–0.95 H, keep ≥ 0.7 of the variant's best, window 0.55/0.3 E | FIT | classes move, no frame outcome; segmentations, moved boundaries inert | a re-cut never supplies the as-read string |
| glyph candidates | ratio ≥ 0.6, ≤ 4 per cell, softmax T = 0.05, alphabet bar 0.6 H | calibration corpus, FIT | T 0.04 cost a TARGET STRONG; ratio, per-cell, alphabet bar: classes only or inert | grammar alphabet: digits for full-height cells, `, . - °` for short ones |
| matcher | small-counter fill 0.15 / 0.85; paired holes 1.1 / floor 0.35 | FIT | fill 0.68 cost two STRONGs, 1.02 gained one; paired-hole floor inert | `classifyCell` (the 005D reader) keeps its defaults |
| beam | ≤ 2 non-top glyphs, width 16, floor 0.01, mass 0.95, ≤ 8 sequences (the as-read one among them), re-cut penalty 1.0, ≤ 4 / 6 re-cut texts | calibration corpus, FIT | width, floor, text caps inert; mass and count move the classes (the class is normalised over the emitted set — one calibration with the class bars) | `mergedCount` / `emittedMass` record what the cut left out |
| labels latticed | 2–6 glyphs on a dimension line (`LATTICE_LABEL_GLYPHS`); a stricter anchor over 7 cells gives no paths | — | inert | geometric selection, before any scale |
| as-read rule | the anchor of the variant whose cells match best (segScore) | FIT, both corpora | — | development labels: FIT 6 wrong→right / 1 right→wrong against the DEFAULT anchor, HELD_BACK 4/0, TARGET 3/0 |
| classes | LOW_QUALITY min glyph < 0.2 or cap < 10 px; CLEAR p ≥ 0.6 (margin ≥ 0.3, implied: at p ≥ 0.6 the margin is ≥ ⅓); SUPPORTED p ≥ 0.35 **and margin ≥ 0.3**; else AMBIGUOUS; AMBIGUOUS whenever the bracket moves the value | FIT, calibration corpus | the bars move class counts a lot and no frame outcome; `clearMargin` inert | the margin bar on SUPPORTED is post-review C's P0 fix |
| contest | an alternative contests a scale at ≥ 0.5 of the reading's probability (any, when AMBIGUOUS), or one glyph away at the 005E matcher's glyph ratio ≥ 0.7 | FIT houses' plan frames | 0.4 cost two STRONGs; 0.6 inert | 0.7 is 005D's substitution bound, measured on the 005E matcher's glyphs (not literally 005D's runner ratios) |
| re-solve corrections | the as-read value; corrections at ≥ 0.5 of its probability or one glyph at ≥ 0.7; on spans ≥ 25 tolerances | FIT houses' plan frames | — | the same bounds limit SCALE_RANKED and structural options |
| UNRESOLVED | two different fitting values within 0.9 of image score | contract M6 | not observable in D's replay | |

### The class rule

The class is the probability of the as-read string among the ink's emitted values and its margin over the next value,
capped by the stability bracket. As a separator of right from wrong readings it is a near-tie with the worst glyph runner
ratio: AUC 0.76 against 0.74 (topology-aware; 0.65 raw) on FIT, 0.81 against 0.83 on HELD_BACK (TARGET, check only:
0.97 against 0.91). It is kept because it is defined over the ink's values — what the metric weighs — not over one glyph.

The margin bar on SUPPORTED (post-review C P0): before it, a two-value coin toss holding 0.53 of the ink's mass with the
next value at 0.47 was SUPPORTED, so two of them corroborated a wrong scale at STRONG. Now it is AMBIGUOUS.

The stability bracket (post-review D P1): STRICT's δ and SAUVOLA's k moved a tenth either way changed the as-read string
of 10–15 of 75–92 label inks per development frame. Measured after the fix (both corpora, 480 labels): readings stable
under the bracket are right 58 % of the time, those that move 25 %; none of the moving ones is CLEAR or SUPPORTED.

| set | CLEAR right | SUPPORTED right | AMBIGUOUS right | LOW_QUALITY right | moved by the bracket |
| --- | --- | --- | --- | --- | --- |
| FIT (48) | 3/3 | 11/17 | 7/27 | 0/1 | 7 |
| HELD_BACK (21) | 6/6 | 3/5 | 5/10 | 0/0 | 2 |
| TARGET (12, check only) | 0/0 | 6/7 | 1/5 | 0/0 | 3 |
| calibration corpus (240) | 38/42 | 58/87 | — | — | — |
| held-back corpus (240) | 42/44 | 55/80 | — | — | — |

CLEAR is right on every development label it marks and on 80 of 86 corpus labels. The corpus misses are confident
single-glyph misreads (an `8` a stroke break turns into a `6`, a `9` read `4`): the class cannot see a misread the matcher
is sure of — a declared limit of the class, not a reason to move its bars. About two thirds of SUPPORTED readings are
right; two SUPPORTED inks that agree still corroborate.

**What the bracket does not do** (measured after the fix, the four frames post-review D found sensitive, STRICT δ moved
alone; the bracket moves with it). The bracket makes a reading that flips around the shipped threshold a coin toss; it
does not make the outcome independent of where the threshold is. Moved by a fifth, the frames still move — but no wrong
scale reaches SUPPORTED or STRONG at any δ:

| frame (split) | truth cm/px | δ 38 | δ 43 | **δ 48 (shipped)** | δ 53 | δ 58 |
| --- | --- | --- | --- | --- | --- | --- |
| rarytasy-g2e (FIT) | 2.755–2.761 | LEGACY_UNCONFIRMED/WEAK 2.7497 | LEGACY_UNCONFIRMED/WEAK 2.7497 | **CONFIRMED/STRONG 2.7497** | LEGACY_UNCONFIRMED/WEAK 2.7497 | LEGACY_UNCONFIRMED/WEAK 2.7497 |
| dom-w-modrzykach (HELD_BACK) | 2.749 | REPLACED/WEAK 2.7489 | REPLACED/STRONG | **REPLACED/STRONG 2.7489** | REPLACED/STRONG | REPLACED/STRONG |
| dom-w-azaliach (HELD_BACK) | 1.861–1.864 | REPLACED/WEAK **1.8975** | REPLACED/WEAK 1.8615 | **REPLACED/WEAK 1.8615** | REPLACED/WEAK 1.8615 | REPLACED/WEAK **1.8975** |
| dom-w-dabecjach (TARGET) | 2.802–2.816 | LEGACY_UNCONFIRMED/INCONCLUSIVE **2.672** | LEGACY_UNCONFIRMED/INCONCLUSIVE **2.672** | **REPLACED/STRONG 2.8113** | REPLACED/SUPPORTED 2.8113 | REPLACED/SUPPORTED 2.8113 |

G2E keeps its scale at every δ and only its confidence falls. Azaliach takes a scale 1.9 % large at WEAK — the first
reading the challenge tests — a fifth either way. The TARGET house is right at the shipped δ and above it; below it the
frame stays on the page vote's wrong scale, INCONCLUSIVE (the challenge runs; 005D called that scale STRONG). δ 48 was
proposed by a pre-review that measured over these houses (above); it is not moved now, because moving it to win a row
back would be the tuning this policy forbids. Round 5 is the clean check.

## Measured tables (brief §26–28)

Recall is "the printed figure is among the lattice's sequences" — the quantity that matters downstream: a truth that
leaves the candidate set can never be weighed. "005D one-sub" is the 005D bounded set (as read, or one glyph away at a
runner ratio ≥ 0.7). Development labels are read on the tokens production latticed (2–6 glyphs, its own pass). Times are
per label, the lattice only, measured while a development matrix ran on the other cores.


### Seed 5001 (calibration): 240 labels

| stratum | n | 005D top-1 | 005D one-sub | as read | top-1 | top-3 | top-5 | top-8 | CLEAR right | SUPPORTED right | mean K | ms/label |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CLEAN | 24 | 10 | 14 | 19 | 18 | 21 | 24 | 24 | 9/9 | 6/9 | 6.1 | 12.6 |
| ITALIC | 24 | 11 | 15 | 17 | 18 | 21 | 24 | 24 | 1/2 | 12/13 | 7.1 | 17.9 |
| SMALL | 24 | 13 | 14 | 16 | 17 | 21 | 23 | 23 | 7/7 | 8/11 | 7.0 | 14.9 |
| ANTIALIASED_THIN | 24 | 12 | 15 | 17 | 17 | 23 | 24 | 24 | 6/6 | 8/12 | 6.4 | 11.9 |
| BLURRED | 24 | 6 | 11 | 20 | 19 | 24 | 24 | 24 | 3/3 | 7/7 | 7.5 | 14.9 |
| BROKEN | 24 | 2 | 4 | 4 | 4 | 8 | 8 | 8 | 0/3 | 2/9 | 7.2 | 13.0 |
| TOUCHING | 24 | 0 | 0 | 1 | 1 | 1 | 1 | 1 | 0/0 | 0/0 | 8.0 | 27.5 |
| TIGHT | 24 | 2 | 4 | 6 | 4 | 12 | 16 | 16 | 0/0 | 2/4 | 8.0 | 23.8 |
| HEAVY | 24 | 9 | 13 | 15 | 14 | 16 | 17 | 21 | 5/5 | 8/11 | 7.2 | 18.0 |
| LIGHT_INK | 24 | 12 | 18 | 13 | 16 | 22 | 23 | 24 | 7/7 | 5/11 | 6.7 | 13.3 |
| ALL | 240 | 77 | 108 | 128 | 128 | 169 | 184 | 189 | 38/42 | 58/87 | 7.1 | 16.8 |

### Seed 9017 (held back): 240 labels

| stratum | n | 005D top-1 | 005D one-sub | as read | top-1 | top-3 | top-5 | top-8 | CLEAR right | SUPPORTED right | mean K | ms/label |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CLEAN | 24 | 19 | 20 | 21 | 22 | 24 | 24 | 24 | 12/12 | 8/9 | 5.2 | 10.1 |
| ITALIC | 24 | 12 | 15 | 18 | 17 | 23 | 24 | 24 | 5/5 | 6/8 | 7.5 | 16.8 |
| SMALL | 24 | 6 | 11 | 14 | 15 | 20 | 22 | 22 | 5/5 | 5/8 | 6.8 | 15.0 |
| ANTIALIASED_THIN | 24 | 12 | 15 | 18 | 20 | 22 | 23 | 23 | 8/8 | 7/9 | 6.3 | 12.1 |
| BLURRED | 24 | 6 | 10 | 12 | 15 | 20 | 23 | 23 | 1/1 | 9/12 | 7.6 | 14.2 |
| BROKEN | 24 | 4 | 5 | 4 | 4 | 5 | 7 | 10 | 3/4 | 1/8 | 7.1 | 14.1 |
| TOUCHING | 24 | 0 | 3 | 0 | 0 | 3 | 3 | 3 | 0/0 | 0/1 | 8.0 | 19.9 |
| TIGHT | 24 | 3 | 4 | 5 | 5 | 10 | 11 | 12 | 0/0 | 2/3 | 8.0 | 23.8 |
| HEAVY | 24 | 1 | 7 | 8 | 9 | 20 | 22 | 22 | 1/2 | 4/7 | 7.4 | 17.5 |
| LIGHT_INK | 24 | 18 | 20 | 21 | 21 | 24 | 24 | 24 | 7/7 | 13/15 | 6.7 | 12.1 |
| ALL | 240 | 81 | 110 | 121 | 128 | 171 | 183 | 187 | 42/44 | 55/80 | 7.1 | 15.6 |

### The stability bracket (both corpora)

| as-read value under the bracket | labels | read right | CLEAR + SUPPORTED | of those right |
| --- | --- | --- | --- | --- |
| stable | 387 | 226/387 (58 %) | 253 | 193/253 (76 %) |
| moves (capped at AMBIGUOUS) | 93 | 23/93 (25 %) | 0 | – |

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

| split | n | 005D read | 005D one-sub | as read | top-3 | top-8 | CLEAR right | SUPPORTED right | AMBIGUOUS | LOW_QUALITY | unstable |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FIT | 48 | 12 | 26 | 21 | 34 | 43 | 3/3 | 11/17 | 7/27 | 0/1 | 7 |
| HELD_BACK | 21 | 9 | 15 | 14 | 18 | 19 | 6/6 | 3/5 | 5/10 | 0/0 | 2 |
| TARGET | 12 | 3 | 6 | 7 | 7 | 10 | 0/0 | 6/7 | 1/5 | 0/0 | 3 |
| ALL | 81 | 24 | 47 | 42 | 59 | 72 | 9/9 | 20/29 | 13/42 | 0/1 | 12 |

## Declared limits

- **The count bound is where development truths are lost.** Of the development truths absent from their lattice, most
  were generated and cut by the eight-sequence bound on AMBIGUOUS inks (post-review A: 7 of 9). A larger count is not
  confirmed on the check sets and widens contests; it is not moved. `mergedCount` and `emittedMass` show the cut.
- **Fused glyphs.** In the TOUCHING stratum (gap −0.04…0.02 of the cap height) the lattice keeps the printed figure
  in 1 and 3 of 24; with no column valley between two glyphs there is nothing to re-cut. Never CLEAR there.
- **Tight hollow pairs.** At gap ≤ 0.08 a `0` next to another hollow glyph (`80`, `00`, `60`, `90`) is still mostly
  lost; at ordinary spacing (0.12) the lattice holds all 18 tested pairs where the 005D bounded set holds a few.
- **Broken strokes.** 8 and 10 of 24; three corpus CLEARs in this stratum are wrong.
- **Confident misreads.** A misread the matcher is sure of is CLEAR or SUPPORTED, and two of them can still make a
  wrong scale STRONG (post-review C, C5E-7). The class reduces false consensus; it does not detect misreads.
- **The kept 005D chains.** Where the page vote's scale is confirmed and its chains are kept, their values come from
  005D's substitution list, not from the lattice (post-review B, B5E-2) — the legacy exemption.
