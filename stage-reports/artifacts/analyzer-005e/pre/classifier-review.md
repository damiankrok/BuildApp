# 005E pre-review B (rev-b5e): digit classifier / template matcher and its candidate lattice

**Question.** Does the reader need a calibrated per-glyph candidate lattice, and how should it be built and calibrated?
**Answer.** Yes. The current matcher is weak and systematically biased on the *development* set too, not only on the
blind houses. Its candidate set is cut off by the wrong rules: an absolute 0.2 floor, a rank-4 limit that counts
sign characters, and one substitution. That cut-off, not the matcher alone, is what loses the printed value.

**Method (read-only, numbers only).**
- An instrumented copy of `ocr.ts`/`font.ts` in `/home/user/BuildApp/.cache/rev-b5e/lib/` runs the identical
  pipeline. It also exports the full 17-character score vector and the factor breakdown per glyph (shape, hole,
  aspect, size, slant). `VARIANT=` and `MASK=` switches serve the experiments.
- Development truth: 125 dimension labels from 8 houses' selected ground copies (marcowki, zurawkach, modrzykach,
  rarytasy-eoze, kosacce-clean, willa-miranda, azaliach, jablonkach), found through `digest.json`.
- I read every label **by eye** from local upscaled crops in `/home/user/work005e/views-rev-b5e/`, upright per pass.
  Room numbers, callouts and labels cut by the token box were skipped. The truths are in `.cache/rev-b5e/truth.txt`.
- Cross-check: 38 of the 71 labels with a PRIMARY binding fit the sealed frame scale within 1.5 % using the
  eye-read value. The other 33 are bound to a different span, which is a binding problem, not a truth problem.
- Synthetic check (`synth.ts`): an independent **vector stroke font**, ISO/DIN-like (arc skeletons, closed
  triangular 4, curved 6/9 tails, flagged 1 without a foot). It is neither `font.ts` nor the synthetic-drawings
  bitmap font.
  - 4×4 supersampled anti-aliasing; cap height 12–17 px; slant 0–0.3; stroke 1–2.5 px.
  - Blur: none, light ([1 6 1]/8), or the 3×3 binomial of the `it.fails` cases. ±3 grey noise, ink 70 on 236.
  - 853² pages (same adaptive-mask radius as real sheets), read by the reader's own `readNumbers`.
  - 480 four-digit tokens (1920 glyphs). Wide gaps (0.3·h + stroke) hold segmentation correct (0 miscounts), so the
    numbers measure classification.

## Findings

**P0-1. The matcher fails on the development set at a rate that hides only because of redundancy.**
- Of 124 correctly segmented dev labels, only **39 (31 %)** are read as printed. Glyph accuracy is 253/377 (67 %).
- Per digit (right/total): 0 69/72, 1 50/50, 2 29/48, **3 7/31**, **4 1/32**, 5 32/39, 6 29/38, 7 14/22, 8 22/26,
  **9 0/19**.
- **35 of the 85 misread labels have ≥ 2 wrong glyphs.** The 005D one-substitution `boundedValues` covers the truth
  for 76/124 (**61 %**) dev labels and 58 % of synthetic ones.
- The blind failures are typical, not outliers: `850→810` is 5→1, `1173→1117` is 7→1 plus 3→7. Dev confusions:
  9→4 19, 4→0 19, 2→1 16, 3→5 10, 6→0 9, 4→1 8, 7→1 7, 3→1 7, 3→7 7.
- `1` and `0` attract errors: 46 of the 124 wrong dev glyphs were read as `1`, 29 as `0`.

**P0-2. The candidate set is truncated by rules that drop the truth more often than the scores do.**
- `alternatives` (ranks 2–4 over all 17 characters, absolute score > 0.2) keeps the truth for only 106/124 wrong dev
  glyphs and **268/507** wrong synthetic glyphs.
- The absolute floor is digit-biased: a *correct* synthetic `4` has a median score of **0.20**, a correct `7` 0.58.
- Signs take slots in whole-number tokens. Top-1 was a sign for 4 dev and 58 synthetic glyphs (`4→/`). Signs pushed
  the truth past rank 4 in 3 dev and 7 synthetic glyphs.
- `readingLattice` inherits the same `alternatives`, so it cannot reach the truth either.

**P0-3. A reading's quality never reaches the decisive gate.**
- `decisive` = PRIMARY ∧ span ∧ cap height ∧ no leading zero. Weight = `confidence × px/50` with `confidence` in
  [0.5, 1], so a coin toss weighs at least half as much as a certain read.
- The blind misreads have calibrated token probabilities (defined below) of **0.17 (`1501`), 0.32 (`810`), 0.19
  (`1117`)**. On dev, reads in the 0–0.4 bin are right 13–23 % of the time.
- The correct `1000` has 0.97, and bin 0.8–1.0 is right 30/30 across dev, synthetic and the stricter-mask run. The
  measure exists; the gate does not use it.

**P1-1. The topology prior causes the 4/9 failures. It is generic, not typeface-specific.**
- When the truth was the best *shape* but lost, the hole factor flipped it in 25/27 dev and 169/171 synthetic cases.
- Thick or anti-aliased strokes fill the 4's small counter: synthetic 4s at 2.5 px have 0 holes in 46/46, dev 4s in
  12/32. The ×0.5 count penalty then hands the glyph to `1` or `/`. When the counter survives, its position/area term
  scores 0.50–0.54 against 0.75 for `0`.
- The template 9's hole (cy 0.23, area 0.22 of the box) is far larger than a printed 9's. A real 9 gets a hole factor
  of 0.62–0.73 while `4` gets 0.86–0.94, so 9→4.

**P1-2. The aspect prior flipped two blind glyphs but helps overall. Do not remove it.**
- It flipped `850` glyph 2 (shape: 5 .469 > 1 .396; aspect factor 0.83 vs 1.00) and `1173` glyph 3 (shape: 7 .554
  best; aspect 0.82 vs 0.99). The `1` template is 0.42 wide because of its flag and foot.
- Removing it costs dev −1.3 pp and synthetic −3.4 pp top-1; synthetic 4→1 rises from 59 to 110 (digit alphabet).
  The case for removal is blind-only, so do not act on it.

**P1-3. Segmentation creates the same failure on dev, and this corrects a coordinator fact.**
- By eye the e-OZE overall is printed **`1600`**, not `1601`. The ASCII cells are [10–17]=6, [19–29]=the 0 plus the
  next 0's left stroke, and [30–34]=that 0's right stroke read as `1`: the blind-1 "hollow-0 cut".
- The scale is unaffected (0.06 %), but it is a non-blind regression fixture for the mechanism. The stricter-mask
  variant below reads the blind `1580` correctly, top-1 on every glyph.

**P1-4. Preprocessing is a large, generic lever, and the default mask is part of the defect.**
- The mask (`adaptiveInkMask`, delta 8, absolute 110) thickens anti-aliased strokes and fills counters.
- On synthetic, heavy strokes collapse token inclusion (ratio ≥ 0.6, cap 4) to 0.47–0.60; the stricter variant
  (delta 48, absolute 60) restores 0.93–1.00.

**P2-1. Margins.**
- `confidence` = 1/(1+r2), where r2 = runner-up / top.
- Below r2 0.5 a glyph is right 98 % of the time on dev (99 glyphs) and 96 % on synthetic (260). Below 0.6: 96 % and
  91 %. From 0.6 to 1.0 it is 30–62 % right on dev, with no usable ordering.
- Only 3 of 124 dev tokens have every glyph below r2 0.6, so decisiveness cannot come from the matcher alone.

**P2-2. Raw scores are comparable across sizes but not across characters.**
- Median correct score: dev 0.46–0.55 by cap height; synthetic 0.43–0.49 by stroke, 0.46–0.48 by height.
- By character (synthetic): 4 0.20, 6 0.31, 9 0.33, against 1 0.53 and 7 0.58.

**P2-3. The declared `it.fails` blur cases are not below a quality threshold.**
- In `glyph-ambiguity.test.ts`, `1200`→`1300` has the true 2 at rank 4 (ratio 0.74). `760`→`/00`: on digits, 7 is
  top-1 and 6 is at 0.98 of the 0. Both are inside the proposed lattice (r ≥ 0.6, cap 4, digit alphabet).
- `dimension-topology` anti-aliasing is the same mechanism: blur thickens strokes and drives the 2→1 attraction.

## Root cause
- `classifyCell` returns one score per character: a shape similarity times three hand-set priors whose ranges depend
  on the prototype (hole statistics measured on 12-row bitmaps at the template's own stroke weight). The scores are
  neither probabilities nor comparable across characters.
- The candidate set is cut by an absolute floor (0.2) and a rank cap over an alphabet that includes signs. The
  decoder (`boundedValues`) then allows one substitution at ratio ≥ 0.7.
- On these sheets the matcher is right first time 31 % of the time and has ≥ 2 errors 28 % of the time, so the truth
  leaves the set before metric reasoning. Two such weak reads can then agree, because nothing carries their
  probability forward.

## Measurements

**Blind (reported only; nothing below is tuned to it).** Default mask, digit alphabet, ratio ≥ 0.6, cap 4, T = 0.05.

| Printed | Read | Default: truth in lattice? | Mask 48/60 |
|---|---|---|---|
| `1580` | `1501` | **No.** Cell 3 is a mis-segment (top 0 .164; true 8 .111 at digit rank 7); 8 strings | Reads `1580` (r 0.77/0.83), p 0.58 |
| `850` | `810` | Yes, rank 2 of 12 strings (p 0.27) | Reads `850`, p 0.64 |
| `1173` | `1117` | Yes, rank 7 of 16 strings (p 0.05), 2 substitutions | `1171`; truth rank 4 of 12 |
| `1000` | `1000` | Decided, p 0.97 | Decided |

**Development (8 houses, 377 glyphs).**
- Top-1 score p10/p50/p90: correct .36/.50/.68, wrong .26/.43/.53. r2: correct .34/.61/.94, wrong .68/.85/.97.
- Truth score / top score when wrong: p10 .62, p50 .83, p90 .95.
- Digit rank of the truth when top-1 is wrong: 2: 80, 3: 26, 4: 8, 5: 6, 6: 3, 7: 1.
- Top-K digit inclusion: K = 1 .671, 2 .883, 3 .952, 4 .973, 5 .989.
- Ratio rule "keep digits with score ≥ t·top": t = 0.7/0.6/0.5 keeps the truth .936/.976/.989 at 2.27/3.05/3.94
  candidates per glyph.
- Token level (124 tokens): one substitution .613; multi-substitution r ≥ 0.7 cap 4 .798; r ≥ 0.6 cap 4 **.871**
  (p50 12, p90 48 strings); r ≥ 0.5 cap 4 .904.
- Rank of the truth by joint p in the r ≥ 0.6 cap 4 lattice: N = 1 .31, 4 .63, 8 .77, 16 .85, 32 .87.

**Synthetic (vector font, 1920 glyphs).**
- Top-1 .744; top-2/3/4 inclusion .923/.980/.992. Ratio ≥ 0.6 keeps .955 (2.65 candidates); ≥ 0.5 keeps .977.
- Confusions (truth→read): 9→4 150, 4→0 80, 4→/ 55, 6→0 53, 2→7 43, 8→0 36, 4→1 32, 7→3 18, 3→5 7, 3→7 5. Correct 4s:
  22/192. 0, 1 and 5 are ≥ 99 % correct.
- Accuracy by stroke 1/1.5/2/2.5 px: .83/.83/.79/**.50**. By blur none/light/3×3: .75/.75/.71. Slant 0–0.3:
  .76–.72. Height 12–17: .70–.81.
- Token inclusion (r ≥ 0.6, cap 4) by stroke/blur: ≥ .93 except 2 px/3×3 (.82) and 2.5 px (.47–.60).

**Calibration.** Softmax over digit scores, p(c) = exp(s_c/T)/Σ. NLL-optimal T: 0.06 dev, 0.04 synthetic; I use 0.05.
- Glyph reliability (dev): predicted 0.2/0.4/0.6/0.9 → observed 0.23/0.50/0.48/0.97.
- Token p(read) bins 0–.2/.2–.4/.4–.6/.6–.8/.8–1 → observed dev .13/.23/.37/.35/**8/8**, synthetic
  .10/.31/.49/.87/**9/9**.
- p is monotone and usable as a weight; it cannot remove the systematic 4/9 bias.

**Template and feature variants** (top-1 digit accuracy):

| Variant | Dev | Synthetic | Notes |
|---|---|---|---|
| Today | .671 | .744 | |
| `hfill` | **.698** | **.776** | 4s 1→11 and 36→100; top-1 drops on no house; azaliach top-3 .93→.90 (one glyph) |
| `hskel` | .679 | .797 | 9s 0→6 and 40→98; dev 6s 29→23; marcowki −6 pp vs `hfill` |
| `hfill+hskel` | .698 | .822 | |
| Drop hole position term | .639 | .767 | |
| Soften count penalty to ×0.75 | .597 | .736 | |
| Drop aspect prior | .658 | .710 | |
| Drop hole prior | .533 | .693 | |

`hfill`: a cell with *fewer* holes than a prototype whose counter is < 0.15 of its box (the two 4 forms) gets ×0.85
instead of ×0.5. `hskel`: hole statistics on the normalised skeleton.

**Preprocessing variants of the same ink** (dev, glyphs present in both reads):
- Mask 24/90 (359 glyphs): P(variant wrong | default wrong) **0.81**. They agree on 83 %; accuracy .72 when they
  agree, .42 when not.
- Mask 48/60 (322 glyphs): P(wrong | wrong) **0.53**; accuracy .86 when agreeing, .24 when not. Alone it gives top-1
  .755 dev and .835 synthetic.
- As a replacement, 48/60 loses tokens to segmentation (SEG 1→19) and lowers top-3 on marcowki (.94→.83) and
  zurawkach (.97→.89). It must be **added**, not substituted.
- Union lattice (default ∪ 48/60, r ≥ 0.6, cap 4 per variant): dev token inclusion **.992** (124/125), lattice p50
  16, p90 69. Synthetic: .979 for the variant alone against .858 for default. The single dev miss is marcowki `750`
  (read `151` by default, `751` by the variant).

**What a wide lattice costs** (38 correctly bound dev labels, tolerance ±1.2 %):
- Share of labels with a candidate fitting a wrong scale (k in [0.80, 1.25], |k − 1| > 3 %), mean/worst: as read
  0.5 %/5 %, one substitution 4 %/16 %, union lattice **13.8 %/34 %**. The true scale is fitted by 53 %, 74 % and
  100 % of those labels respectively.
- Weighted by p, the fitting candidate's mean mass is **0.50 at the true scale against 0.009 at a wrong one**
  (worst 0.058).

## Proposed contract (all thresholds from dev + synthetic; none uses a blind value)

1. **Alphabet by grammar.** Score candidates only over characters the parse grammar admits at that position: digits
   in a whole-number token, signs only at position 0, separators only between digits. This removes `/` and the other
   signs from slot competition (P0-2).
2. **Per-glyph candidates.** Keep `c` if `s(c) ≥ 0.6 · s(top)`, at most **4** per glyph, with **no absolute score
   floor**. Dev inclusion .976 at 3.05 candidates, synthetic .955 at 2.65. 0.6 is where dev inclusion passes 97 %
   while the set stays near 3; 0.5 reaches .989 but needs 3.94.
3. **Glyph quality.** Export per glyph `p(c)` (softmax of `s/T` over the admitted alphabet, **T = 0.05** from the NLL
   fit), margin `1 − r2`, and entropy.
   - `decided` = margin ≥ 0.5 (r2 < 0.5): 98 % correct on dev, 96 % on synthetic.
   - `weak` = top score < 0.2. A weak glyph never pins a value and triggers the segmentation and preprocessing
     variants. No correctly segmented dev glyph scored below 0.2; the blind mis-cut cell scored 0.164.
4. **Token lattice.** Cartesian product of the per-glyph sets, scored by `p_token = Π p_i`. Keep strings with
   `p_token ≥ 0.01`, at most **32** by p, then parse.
   - Dev union: inclusion .976, p50 10, p90 20 strings. With no p floor it is .992, but p90 is 69.
   - **The number of substitutions is not a criterion.**
   - A reading is a *decided* witness only if `p_token ≥ 0.8` (30/30 correct measured). Otherwise its metric weight
     is its p.
   - Two undecided readings may not make a STRONG scale on their own; their combined likelihood ratio must beat the
     runner-up scale's.
5. **Preprocessing variants are one witness.** Run the default mask and one stricter mask (delta 48, absolute 60);
   optionally add a segmentation variant that forbids a cut inside an enclosed counter.
   - Candidate set = union over variants. Per-string p = **max** over variants, never a sum or product.
   - Agreement between variants is not corroboration (P(wrong | wrong) 0.53–0.81).
   - A token from any variant keeps the same text region and ink id.
6. **Matcher changes, in this order.**
   - **(a) `hfill`** (small-counter fill tolerance): generic, +3 pp on both sets, top-1 drops on no house. It dips
     azaliach top-3 by one glyph, so the gate below holds it until (b) shows no dip.
   - **(b)** Take each prototype's hole statistics from the forward model: render the template at strokes 1–2.5 px
     and blurs 0–3×3 and score against that range, not the 12-row bitmap's single value. `hskel` is a crude proxy;
     adopt it only with a per-house non-regression table.
   - **(c)** Normalise scores per prototype (z-scores against that prototype's own distribution on correct synthetic
     matches), so that a 4 is not under-scored by construction.
   - **(d)** Add a slanted-7 or other new form only if it comes from a rendered standard lettering family.
   - **Never** derive templates or priors from development crops.
   - **Anti-overfitting gate:** a change ships only if it lowers neither top-1 nor top-3 on any dev house, does not
     lower synthetic inclusion, and holds under leave-one-font-out across ≥ 2 vector fonts.
   - A grey-level feature is plausible but unmeasured here; the 48/60 variant already captures most of its benefit.
7. **Tests to add.** The vector-font synthetic corpus as a unit test: per-glyph inclusion ≥ .95 and token inclusion
   ≥ .85 today (≥ .97 with the variant). Assert the two `it.fails` cases as *in lattice*. Add e-OZE `1600` as a
   development segmentation fixture.

## Risks and negatives
- **A wider lattice makes coincidental scales likely**: 13.8 % of labels fit any given wrong scale, worst 34 %. The
  decoder must weigh candidates by p and compare scale likelihoods. Counting lattice membership would recreate the
  005D failure at a larger scale.
- The stricter mask must not replace the default (segmentation regressions on 2 houses). Running it doubles the OCR
  cost on plan frames, about 0.4–1.3 s per 853² page.
- Still unrecoverable after the contract: glyphs whose truth is at digit rank > 4 (dev 2.7 %, synthetic 0.8 %);
  mis-cuts that no segmentation variant fixes; synthetic heavy strokes under 3×3 blur (the variant alone gives .93).
- Limits of my measurements:
  - Eye-read truth may itself contain errors; I skipped every label I was unsure of.
  - The synthetic set uses one font and wide spacing; it measures the classifier, not segmentation.
  - The dev set is a single publisher's typeface, so dev gains alone prove nothing generic. Here they agree in
    direction with the independent font for every change I recommend.
