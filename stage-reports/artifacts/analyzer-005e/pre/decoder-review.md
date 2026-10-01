# 005E pre-review C (rev-c5e): sequence decoder

**Question.** How can we keep plausible 2-glyph alternatives (and more, where the image supports them) for a numeric
label, without a combinatorial explosion and without chance agreement turning alternatives into witnesses?

**Method (read-only).**
- `.cache/rev-c5e/ocrfull.ts` is a copy of `ocr.ts` that keeps all 17 per-glyph scores and exposes a cell classifier;
  the reader logic is unchanged. Every plan frame of 12 development runs (`/home/user/work005d/m4/*`) and of the 2
  sealed 005D blind runs was re-read with it; every re-read token matched the sealed token on box and text.
- I joined these tokens to every PRIMARY ∧ INDEPENDENT ∧ decisive observation (span ≥ 55 px, cap ≥ 10 px, no leading
  zero): 105 unique inks, 87 development (9 houses; aster-viii and galaktyka have none) and 18 blind.
- **Ground truth was read by eye** from upright 6–10× crops (`/home/user/work005e/views-rev-c5e/sheet-*.png`).
  Development: 73 numeric inks, 8 junk (symbols or room text), 6 orientation errors. Blind: 16 numeric, 2 junk.
- Decoders were simulated in `.cache/rev-c5e/{lib,recall,chance,samesheet,mass,final}.py`; segmentation alternatives
  in `seglat.ts` and `segall.ts`. Only numbers leave the machine. No tracked file was touched.

## 1. Findings

**P0-1. The top-1 reading is wrong on most decisive inks, and two or more substitutions are common.**
- Of the 73 hand-read development inks, 20 (27 %) read right; 25 need one substitution, 15 two, 9 three or more, and
  4 have the wrong glyph count. Blind: 3/16 right; 4 / 6 / 2 / 1 in the same classes.
- At glyph level, top-1 is right on 63 % of 223 glyphs. In 34 of the 82 wrong glyphs the wrong winner is `1`.
- `boundedValues` (V1) recovers 39/73 inks (53 %) and **0 of the 15 two-substitution truths**, by construction. It
  drops Kosaćce's overall `1660` read `1000` (`0`→`6` twice, ratios .941 and .987), Dąbecja's vertical overall `1340`
  read `1700` (.993, .904), and Tunbergia's `1173` read `1117` (.931, .929).

**P0-2. Alternatives agree by chance, and more often the bigger the set.**
- Chance agreement on 3,332 cross-house pairs of unrelated inks, (K,K), keeping the K best sequences by image score:
  K = 1: 1.6 % (005D measured 1.55 %); K = 2: 6.5 %; K = 4: 17.3 %; K = 8: 37.8 %; K = 12: 52.9 %.
- On one sheet (291 pairs on 18 frames with a hand-truth scale), pairs agree at a wrong scale (> 3 % off) in 0.7 % of
  as-read pairs, 23 % with the bounded beam at K = 8, and 56 % with `readingLattice`. The last is more often than at
  the true scale (49 %).
- Therefore no rule may ever count agreement between alternatives.

**P0-3. No decoder over today's glyph scores can produce `1580` (Dąbecja).**
- The image-only cut lattice does find the 8|0 junction (cut at column 21, where today's cut is at 24); the image-best
  same-count path becomes `1500` (Σ ln s −3.308 against −4.096 for `1501`).
- But in that path the 8-cell (two holes) scores `8` at 0.163, only 0.56 of its winner `0` (0.290, rank 9).
- The segmentation alternative (reviewer A) is necessary but not enough: the glyph lattice (reviewer B) must make that
  `8` image-supported. Until then the honest decoder output does not contain the truth.

**P1-1. Ordering by sequence cost beats V1 at the same set size.** Beam (ρ 0.7, ≤ 2 non-top choices, K 4) against V1,
on one sheet: 39.2 % agreement at the true scale against 34.4 %, and 7.6 % at a wrong scale against 10.0 %. Recall is
40/73 against 39/73, at 3.4 against 3.5 values. A two-substitution reading at ratios 0.93/0.93 is likelier than a
one-substitution reading at 0.70.

**P1-2. e-OZE's overall is printed `1600`, not `1601`.** I hand-read it at 10× on its selected ground copy. It is the
same failure as Dąbecja: a merged `00` run cut down the last 0's counter, so the third cell carries two holes and the
last reads `1`. Cut alternatives make `1600` the image-best path (−2.387 against −3.046).
`development-dimensions-005d.json` lists `1601` as printed; a human should re-check it. The scale effect is 0.06 %.

**P1-3. Making a cut alternative the witness is not justified.**
- On 88 numeric inks the best same-count cut path differs from today's in 21. 2 become right (e-OZE `1600`, and the
  Tunbergia twin `1010`→`1000`); 18 trade one wrong value for another (`810`→`150`, `1117`→`1175` at Δ 0.095); and
  1 breaks a right read (Dąbecja `888`→`631`, Δ 0.12).
- With a margin of Δ ≥ 0.3 it is still 2 right against 10 wrong→wrong. Cut alternatives may enter the set, but never
  as the as-read value.

**P1-4. Changing the glyph count cannot be ranked by raw image score.** Narrow slivers read `1` at 0.4–0.7, so the
5-cell `15110` (Σ ln −3.16) beats the 4-cell `1500` (−3.31) on Dąbecja. A merged pair or split cell needs reviewer A's
pitch evidence, not glyph scores.

**P1-5. The absolute floor `score > 0.2` in `classifyCell` hides alternatives of the weakest glyphs.** 15 of 233
development glyphs have a digit at ratio ≥ 0.7 with score ≤ 0.2, and so do 5 of the 82 wrong glyphs' truths.
Dąbecja's `1501` therefore has no V1 alternative at all, although its third cell has `9` at 0.95 of `0`.

**P2-1. Cap per cell.** Keeping 4 candidates per cell loses one truth at rank 5 (Azalia `717`→`337`, `3` at 0.83).
m = 5 leaves the default's recall at 46/73.

**P2-2. Neutrality by chance.** V3's widened rival tolerance (up to 2·tol) raises chance neutrality (K,1): V1 16.3 %
against 9.1 % at tol; K 8: 20.7 % against 12.4 %.

**P2-3. A calibrated sequence posterior is informative but too flat to gate witnesses today.** The fitted temperature
is β = 3.5 (maximum likelihood on 223 glyphs); mean P(as-read) is 0.20 against an accuracy of 0.27. P(as-read)
separates right from wrong reads with AUC 0.74; at P ≥ 0.3 it keeps 11 of 20 right reads and 5 of 53 wrong ones.

**P2-4. `readingLattice` is still used after a scale exists** (`latticeFits` and the chain DP). It picks pairs by glyph
confidence, not by ratio, and fills 24 slots. Its consumers should read the decoder's set instead; what they choose
remains DERIVED.

## 2. Root cause

**Generation is shaped by substitution count, not by image likelihood.** V1 caps at one substitution, so a likely
two-substitution reading is impossible while an unlikely single is kept. `readingLattice` enumerates by glyph position
and fills 24 slots whatever the evidence. Neither has a sequence score, a per-ink stopping rule, a record of how far
each value is from the top, or a segmentation axis.

**The metric layer has no typed boundary between "read" and "could be".** `alts` feed V3/V4 correctly, but nothing
structural stops a future rule from seeding or corroborating with them. That is exactly where 25–38 % chance agreement
would become STRONG.

## 3. Measurements

**Recall and size: is the printed value in the set?** Development has 73 numeric inks; blind has 16.

| generator | dev recall | blind | mean / max set | expansions per label, mean / max |
|---|---|---|---|---|
| as read | 20 (27 %) | 3 | 1 / 1 | – |
| `boundedValues` (V1) | 39 (53 %) | 5 | 3.6 / 5 | – |
| `readingLattice` (≤ 24) | 49 (67 %) | 8 | 14.7 / 22 | – |
| beam ρ .7, N 2, K 4 | 40 (55 %) | 6 | 3.4 / 4 | 22 / 84 |
| beam ρ .7, N 2, K 8 | 46 (63 %) | 8 | 5.4 / 8 | 22 / 84 |
| beam ρ .6, N 2, K 12 | 52 (71 %) | 8 | 8.7 / 12 | 32 / 106 |
| top-K, no image bound (K 8 / 12) | 48 / 52 | 8 / 9 | 8 / 12 | 497 / 1023 |
| **proposed default** (§4) | **46 (63 %)** | **8** | **5.3 / 8** (5 singletons) | **22 / 84** |

- N = 3 adds nothing at K ≤ 12. Ceiling for any decoder over today's scores (≤ 2 substitutions, each at ratio ≥ ρ,
  unlimited K): 51/73 at ρ 0.7, 56/73 at ρ 0.6.
- The default's recall by class: 0 substitutions 20/20; 1 substitution 20/25; 2 substitutions 6/15 against V1's
  0/15 (kept: Kosaćce `1660` at rank 5, p .091, plus `322`, `380`, `521`, `270`, `324`); 3+ substitutions 0/9; wrong
  glyph count 0/4.
- When a glyph is wrong (82 glyphs), the truth is at ratio ≥ 0.7 in 73 % and ≥ 0.6 in 80 %. It is at rank 2 in 43
  cases, rank 3 in 16, rank 4–7 in 19, and absent from the top 8 in 4.
- When the top is right, the runner-up still sits at ratio ≥ 0.7 in 43 % of glyphs. That is the price of ρ 0.7.

**The blind labels: rank of the printed value / set size.**

| ink (as read → printed) | V1 | lattice | beam K 4 | default |
|---|---|---|---|---|
| Tunbergia `1117`→`1173` (positions 3, 4 at .93) | –/5 | 7/16 | –/4 | 7/8 (p .066) |
| Dąbecja `810`→`850` (position 2 at .98) | 2/3 | 2/17 | 2/3 | 2/3 (p .38; as read .50) |
| Dąbecja `1700`→`1340` (vertical overall) | –/5 | 5/9 | 4/4 | 4/8 (p .114) |
| Dąbecja `1501`→`1580` | – | – | – | – (P0-3) |
| Tunbergia twin `1119`→`1173` (11 px) | – | – | – | – (`3` at .585 < ρ) |

**What the sets mean for the two blind failures** (the metric layer's response, not the decoder's):
- **Tunbergia.** `1173` is in the `1117` ink's set and fits 1000/478 = 2.0921 to 0.69 px. Under V3 that ink becomes
  neutral between 1.995 and 2.092, so the tie no longer stands on it. `1175` (rank 8) also fits, to 1.65 px: a value
  a scale selects may have the wrong digits at the right scale, so it stays DERIVED.
- **Dąbecja.** `850` is in the `810` ink's set and fits the sealed rival 2.810127 (as-read witness `888`) to 0.48 px,
  so `810` is neutral and the STRONG at 2.672 loses its corroboration. `1591` fits 2.81 only at 4.17 px, inside V3's
  widened tolerance and by chance.

**Chance agreement, cross-house.** 87 decisive development inks, 3,332 pairs. A pair agrees when one scale in
1–5 cm/px fits both within 2.2 px. (K,K) gives both inks their K-set. (K,1) is one ink's set against the other's
as-read value: the chance that a true witness is neutralised by an unrelated rival that a single ink supports.

| set | mean size | (K,K) | (K,1) |
|---|---|---|---|
| top-K by image, K 1 / 2 / 4 / 8 / 12 | 1 / 2 / 4 / 8 / 12 | 1.6 / 6.5 / 17.3 / 37.8 / 52.9 % | 1.6 / 5.0 / 9.5 / 16.8 / 23.0 % |
| bounded beam, K 2 / 4 / 8 / 12 | 1.9 / 3.4 / 5.4 / 6.7 | 6.3 / 13.7 / 25.0 / 29.8 % | 4.9 / 8.1 / 12.6 / 15.0 % |
| V1 / `readingLattice` | 3.5 / 12.6 | 15.8 / 43.6 % | 9.1 / 21.4 % |
| proposed default | 5.3 | 24.5 % | 12.4 % (20.7 % at 2·tol) |

On the 73 numeric inks alone the figures are 0.3–9 points higher (top-K, K = 8: 45.8 % (K,K)).

**Segmentation alternatives** (same glyph count; every local minimum within ±0.45 of the expected width of the uniform
pitch, ≤ 3 per window). On 88 inks: 21.8 paths per token on average (max 60, with ±1 count), 17 cells classified
(max 28), 3.7 ms of classification on average (max 7.8 ms). 50–70 % of a page's tokens contain a merged run (161 of
225 on Marcówki, 129 of 260 on Dąbecja). That adds about 0.5–0.6 s per frame, against a whole 4-pass read today of
0.1–0.4 s.

## 4. Proposed contract with bounds (generic; no project values)

**D0. Inputs (the non-circularity guarantee).**
- `decodeInk(lattice, DECODER_BOUNDS) → SequenceSet` takes only the ink's segmentation hypotheses (reviewer A), each
  with its cells, and each cell's candidate list `(char, imageScore, preprocessingSupport)` (reviewer B).
- It takes no scale, span, chain, tick, other ink, published value, house or orientation decision. It runs inside
  `readNumbers`, which already comes before `findDimensionLines`/`chainsFromLines` (extract.ts:305 vs 322).
- **T1, architecture test:** the decoder module imports only reader types, `font.ts`, `parse.ts` grammar and
  `source-common`; never `chains`, `metric-solution`, `dimension-lines`, `specifications` or `reconstruction`.
- **T2, property test:** run `solveFrameMetric` with an injected oracle scale. Every `valueCm` and every
  `valueAlternatives` entry must belong to the ink's `SequenceSet`; a value outside it fails the test.
- **T3, fixture:** a synthetic chain where two inks fix a scale at which a third ink's absent value would fit to 0 px.
  Assert that the value appears in no record and that the third ink is at most NEUTRAL. Measured analogue: at 2.810,
  `1580` fits Dąbecja's 562 px to 0.6 px, and it is in no decoder set.
- **T4:** the `SequenceSet` hash is byte-identical whether the frame is solved or not.

**D1. Per-cell admissibility.**
- A non-top character c at a cell may be chosen only when `s(c) ≥ ρ·s(top)`, with ρ = 0.7. On 82 wrong glyphs this
  keeps 73 % of the truths. ρ 0.6 keeps 80 %, but grows the K 8 set from 5.4 to 6.5 values for 3 more hits (49/73).
- At most m = 4 candidates per cell, the top included. Drop the absolute `score > 0.2` floor (P1-5).
- The alphabet comes from the grammar of the token's form: digits for a cm/m length, plus the separator or sign at
  positions where the top glyph is one.

**D2. Sequence cost (image-only).**
- `d = round6(β·Σ ln(s_top/s_choice) + λ·n_nonTop)`, with β = 3.5 and λ = 0.2. β is fitted by maximum likelihood on
  development glyphs; the order it gives equals the sum of log ratios, so β only sets the scale of D_max and of the
  mass rule.
- **Hard bounds:** `n_nonTop ≤ N_max = 2`; `d ≤ D_max = ln 100` (no sequence below 1 % of the top's odds); no
  position non-top unless D1 holds. A 4-position alternative cannot exist; a 3-position one is excluded (N = 3 gained
  nothing at K ≤ 12).

**D3. Beam.** Cells are expanded left to right, keeping at most W = 16 partial sequences per step. Expansions
≤ cells · W · m (≤ 320 for 5 cells); measured 22 on average, 84 at most. Order by `(d, n_nonTop, segmentationRank,
text)` ascending; round costs to 1e-6 before comparing; text compares by code unit. No Map iteration order, no
`Math.random`, no locale.

**D4. Output.**
- Grammar is applied when a sequence completes: `parseNumber`, LINEAR_DIMENSION, no leading zero.
- Posterior `p_i = e^{−d_i}/Σ e^{−d_j}` over every completed sequence. Emit in order until the cumulative p reaches
  M = 0.95 or K_max = 8, whichever comes first; a decisive image gives one sequence (5 of 73 today).
- Record `massCovered` and `truncatedBy ∈ {MASS, K_MAX, D_MAX, BEAM}`.

**D5. Segmentation alternatives in the same beam.**
- Each hypothesis from reviewer A is a separate path with an id, a `primary` flag, a glyph count and a quality (cut
  ink/cap height, pitch deviation, whether a cut crosses a counter).
- **Same-count paths:** at most 3 besides the primary, ≤ 27 per token. Each contributes only its top sequence, at
  `d = β·(ImageLog(primaryTop) − ImageLog(pathTop)) + σ` with σ = 1.0, and never ranks above the primary's rank 1.
  No glyph substitution is stacked on a non-primary path.
- **Count-changing paths** (merged pair, split cell): only when reviewer A declares the pitch ambiguous. Each
  contributes its top sequence as `COUNT_ALTERNATIVE`, ranked after every same-count sequence (P1-4).
- A segmentation alternative is never rank 1 (P1-3).

**D6. Per-sequence record.** `text`, `valueCm`, `kind`; `segmentationId`, `primarySegmentation`, `cellCount`,
`segQuality`; `imageLogScore` (Σ ln s), cost `d`, posterior `p`; `nonTop` as `[{index, top, chosen, ratio}]`;
`minRatio`; `minGlyphMargin` and `avgGlyphMargin` (each cell's (s1−s2)/s1); `preprocessingSupport` (how many of
reviewer B's variants keep each chosen glyph within ρ of its top); `marginToNext` (d_{i+1} − d_i). Per ink: `entropy`
over the emitted p, `massCovered`, `truncatedBy`, `expansions`.

**M. How the metric layer uses a set (one ink = one witness).**
- **M1.** The witness value is rank 1 of the primary segmentation, the as-read value. Only it may count, seed a cluster
  (`clustersOf` seeds), weigh in the legacy support, or be "overall" evidence.
- **M2.** Alternatives (rank 2 and up, and every segmentation alternative) never witness, seed, corroborate or raise
  group counts. Two inks whose alternatives agree prove nothing: 24.5 % (K,K) by chance.
- **M3. Neutrality.** An alternative may make its ink NEUTRAL between two scales (V3) on the primary binding. The
  tolerance is the coordinator's call, at this cost: 12.4 % at tol, 20.7 % at 2·tol per (witness, single-ink rival).
- **M4. Selection.** A scale established without this ink, whose counted witnesses exclude the ink and which is at
  least SUPPORTED, may select one of the ink's alternatives as the reported value. Record it as DERIVED_BY_SCALE with
  `selectedBy`. It never adds a witness and never counts on the scale that selected it. Selection by another ink's
  alternative is forbidden.
- **M5.** V4 VALUE_AMBIGUOUS spans the emitted set; `p` is reported, never used to pick a value. `CHAIN_CORRECTED` and
  `latticeFits` read the same set (not `readingLattice`), and their output stays DERIVED.
- **M6.** Readings of one ink in two orientations, or on twin copies of one drawing, are one ink. Their sets are
  hypotheses of one ink, never two witnesses.

## 5. Risks / negatives

- **Neutrality cost.** Wider sets neutralise true witnesses more often: (K,1) goes from 9.1 % with V1 to 12.4 % with
  the default (20.7 % at 2·tol). Expect more INCONCLUSIVE on frames that stand on a single ink. Run the development
  matrix before choosing V3's tolerance; I simulated label sets only, not whole houses.
- **Recall ceiling.** 27/73 development truths stay out of the default set: 9 need three substitutions, 9 have a
  position below ρ, 5 fall past K/mass or the cell cap, and 4 have the wrong count. Light-grey 13–14 px italics are
  the worst: several `0`s read `1` with no `0` support at all, mask or cut failures no decoder fixes. Raising K to
  chase them costs chance agreement almost linearly.
- **The real fix is upstream.** P0-3 and the `1` bias (34/82 wrong winners) belong to reviewers A and B. The decoder
  only stops the truth from being thrown away when the image half-sees it.
- **Calibration drift.** β, ρ and the mass threshold were fitted on 9 houses with one reader. If reviewer B changes the
  score function, refit β by maximum likelihood on the same hand-read glyph set and keep ρ as a ratio. This is a
  per-reader constant, not per house.
- **Value correct, digits wrong.** Selection can choose the wrong digits at the right scale: Tunbergia's `1175` fits
  2.092 as well as `1173`. That is why a selected value is DERIVED, and why the published or quantity layer must not
  treat it as read.
- **Runtime.** The beam is negligible. Classifying segmentation alternatives roughly doubles the reader's time if
  applied to every merged run; bound it with D5's caps and measure on the house matrix.
- **The truth set is my own reading:** 105 crops at 6–10×, the uncertain ones re-checked at 10×. A human double-check
  is advisable for e-OZE `1600` (P1-2), Marcówki `290`/`344` (light grey) and Azalia `232`.
