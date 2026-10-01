# 005E pre-review — glyph segmentation (reviewer A, `rev-a5e`)

Read-only on the repo. Probes: `/home/user/BuildApp/.cache/rev-a5e/` (a replica of `readNumbersFromInk` up to the cells,
checked identical to the sealed `rawText` on all 175 PRIMARY-bound readings of the 11 selected frames; plus alternative
generators). Crops (publisher pixels) only in `/home/user/work005e/views-rev-a5e/`. **Truth** for 143 labels was
transcribed by eye from 6× crops of every region bound to a dimension observation on the 9 selected development ground
copies (120 labels; symbols/fragments excluded) and the 2 blind ones (23 labels). The verified scale was never used by a
generator. Synthetic: `digitCorpus` (stroke-font third typeface), seeds 5001 (calibration) and 9017 (held back), 240 each.
`skip2` = the classifier with the two-hole position factor removed (P0-2); stated where used.

## Findings

**P0-1 — `1580` is lost by a counter cut AND by the classifier; fixing either alone does not bring it back.**
Run 9–27 holds `5 8 0` (W 19, E = 0.55·12 = 6.6, n 3, window 2 = cols 20–24). Column ink there: 21 = **5** (the 8|0
junction), 24 = **4** (the 0's hollow middle: top + bottom stroke only) → cut at 24. Chosen cells `[9–14][15–23][24–27]`,
true `[9–15][16–21][22–27]` (two boundaries move: +1 and −2 columns). The cut destroys a counter (holes in the union 3 →
2). The true segmentation is in a 6-hypothesis bounded set — but on the true cells the 8 reads `0` .335 with **no `8` among
alternatives**, so 1580 is absent everywhere under today's classifier (exhaustive 119 segmentations: none reads 1580).

**P0-2 — the hole-position prior demotes every 8 whose two counters are similar (classifier, but it gates P0-1).**
`holeStats` keeps only the LARGEST hole; the 12-px 8 has two 5-px counters, the tie keeps the first found (upper, cy .29)
against the prototype's largest (lower, cy .73) → factor floors at 0.35, while a 0 pays only ×0.5 for the count mismatch.
8 is the only 2-hole digit, so this factor can only demote it. With it skipped for count ≥ 2: the true cells read
**1580 at the top of the bounded set** (geo-mean glyph score .499 vs the as-read cut .423). On 143 real labels: +4 true 8s
(518, 381→181, 418→018, 1580), 2 new 0→8 errors (205→284, 604→181). A pairwise (both-holes) comparison is the principled form.

**P0-3 — `850` is a segmentation tie-break failure, not only a classifier coin toss.** Run 3–20 (W 18, n 3), window
13–17: cols 14 and 15 both carry 5 px; the leftmost wins, the junction column goes to the 0 and the 5 loses its bowl's
right column → `1` .3956 vs `5` .3878. Cutting at 15 (`[9–14][15–20]`) reads **850 with geo .519 vs .446: rank 0 of the
bounded set even with today's classifier.**

**P0-4 — the same counter cut is already in the development set: e-OZE's overall prints `1600`, read `1601`.** Crop is
an unambiguous 0; the other axis states 2.222222 cm/px = 1600/720 px (`1601` gives 2.223611). Run 19–34: cut at col 30
(second 0's counter, 4 px) instead of the junction col 26 (5 px); its right stroke reads `1`. 005D's "1601 read as
printed" is a 1-cm misread hidden by its size; the bounded set reads 1600 at rank 0.

**P1-1 — `1173`: segmentation right to ±1 column; classifier-limited.** Run 19–34 (W 16, E 9.35, n 2): cols 26/27 tie
(1 px each), leftmost 26 puts the 7's bar end in the 3's cell. Cutting at 27: `7` top-1 (.522 vs `3` .505), `3` reads `5`
.446 vs `3` .443 (ratio .993) → truth one substitution from that hypothesis instead of two. No re-cut reads 1173 top-1
(exhaustive set, 32 hypotheses). Segmentation alternatives reduce the decoder's burden; they do not solve it.

**P1-2 — the defect is cut PLACEMENT, not count.** Cell count ≠ printed digits on 2/143 real labels, both upstream of
`segment()` (P2-1, P2-2). Of the 15 boundaries the true segmentations move (12 labels): 10 move **+1 column** (the
junction/tie column belongs to the left glyph; today it always goes right, ties to the leftmost), 4 move **2–3 columns
left** (the deepest column was a 0/8 counter, the junction is the next valley: 1580, 1600, 1720, 700), 1 moves +2 (367).
9 of 12 need one boundary changed, 3 need two (380, 355, 1580), none needs three.

**P1-3 — the cut is decided by a handful of anti-aliasing pixels.** `adaptiveInkMask` δ 8 (local mean, radius max-side/40 = 21 px
here, minus 8 grey levels) makes ≥ ~5 %-coverage halo pixels ink, widening 1-px strokes to 2–3 px and closing 1-px gaps. Sweeping
δ on the labels themselves: 1580 reads right from δ ≥ 10 (ink 155 → 149 px), 850 from δ ≥ 12 (131 → 127 px), 1600 from
δ ≥ 20; 1173 and Azalia's 1035 never. Sweeping `estimateShear`'s 13 slopes: 850 is right at −0.30/−0.18 (chosen −0.12),
1600 at −0.30…−0.18 (chosen −0.12), 1580/1173 at none. A counter (2 strokes ≈ 4 px with halo) is deeper than a junction
whenever residual lean or halo leaves > 2 strokes' worth in the junction column — a 1-px difference.

**P1-4 — light preprocessing changes outcomes, as a shuffle unless used as a second ink hypothesis** (table below).
Local mean–σ thresholding (Sauvola, k 0.2, same window) is the one variant with a large net gain (real 40 → 49 as-read,
synthetic 78 → 101 and 82 → 100) yet still loses 8/11/15 correct reads; δ 5/12 are ±1 net; 2×2 opening and 2× upscale are
destructive. As a **second ink hypothesis of the same token** (union) the truth enters the candidate set on 69/143 real
labels (vs 52 with one ink, 40 as-read) and 125/240, 135/240 synthetic (vs 88, 111).

**P1-5 — count alternatives (merge/split, n0±1) are not worth their cost here.** Applied to every run they keep the
correct reading on top in only 13–14 of 36 correct dev labels (`1260`→`121111`, `1850`→`11150`: '1'-shaped fragments
score high) and raise distinct texts to 13.4/label (max 35). On the synthetic count-failures (38: TOUCHING under-count 18,
wide-font over-count 18 where W/E ≈ 3.5) an exhaustive n0±1 set contains the truth 14/38 at 5 345 hypotheses/label.
Synthetic TIGHT miscounts 1/48, BROKEN 0/48; real `11`s (1100, 1160, 1173, 1180) are separate runs and segment right.

**P2-1** `segment()` takes E from the token box height, which includes joined marks: 2/143 inflated (17 → 21 px); on
tunbergiach `274` the run `27` becomes one cell (`50`). Use the tallest glyph-sized blob of the group. **P2-2** A digit
whose component merges with drawing ink is not a glyph blob (e-OZE `240` → `24`); `groupTokens`' 0.9·h gap joins symbols
to labels (kosacce `8 21`). **P2-3** "Cut destroys a hole" is not discriminative: 28/143 as-read cuts destroy a hole, 8 of
those read correctly; as a ×0.85/×0.7 penalty it lowers ranking (truth rank ≤ 1: 12 → 11). A width-regularity prior is
neutral (+1/−1). **P2-4** `segment()` drops 1-column pieces at cuts (`cut - from >= 2`) and keeps 1-column runs as cells.
**P2-5** Context: the reader reads 35/120 dev labels exactly (29 %; mostly the red secondary labels fail — classifier).

## Root cause

`segment()` makes ONE irrevocable decision per boundary from a single column-sum minimum inside a ±0.3·E window: leftmost
on ties, valley column always to the right cell, counter and junction indistinguishable by ink count. With 12–17 px
italic text, δ-8 halo and a de-skew picked from 13 slopes by a packing heuristic, the minimum is decided by 1 px, and the
classifier then sees a cell with a missing column or half a 0. Downstream, `alternatives` exist only per cell of that
one segmentation, so a wrong cut removes the true digit from every lattice (1580, 1600) or costs an extra substitution
(1173, 850). The classifier's largest-hole prior then removes the 8 that a right cut would expose.

## Measurements

**Blind labels** (columns in the de-skewed token):

| label | h, slope | run (W, n) | as-read cut → text | true cut | in bounded set (v2w3) |
|---|---|---|---|---|---|
| 1580 | 12, −.18 | 9–27 (19, 3) | 15, 24 (2 px, 4 px) → 1501 (`skip2`: 1581) | 16, 22 | needs P0-2; then rank 0 of 6 |
| 850 CW | 12, −.12 | 3–20 (18, 3) | 9, 14 (tie 14/15 = 5 px) → 810 | 9, 15 | rank 0 of 6 (today's classifier) |
| 1173 | 17, −.12 | 19–34 (16, 2) | 26 (tie 26/27 = 1 px) → 1117 | 26 or 27 | 1175 rank 0; truth 1 substitution (.993) |

Other blind labels: 355 (`190`) is segmentation-fixable (two boundaries +1); 127, 1340, 490 get one substitution closer.

**Development (120 eye-transcribed labels, 9 houses)** — categories with `skip2` (legacy in brackets):
as-read right 36 (35); **SEG** — a re-cut alone reads the truth top-1 (exhaustive fixed-count oracle) 9 (9);
**SEG+CLS** — a re-cut needs fewer substitutions 19 (18); CLS — cut fine, truth among per-cell alternatives 45 (47);
none 11. So the current cut is wrong on **9/120 (7.5 %) decisively and 28/120 (23 %) in part**; 11 %/33 % of misreads.
Blind (23): as-read 4, SEG 3 (850, 355, 1580), SEG+CLS 4. Recovered by the bounded scheme: dev 790←740, 700←701,
176←116, 342←302, 1600←1601, 627←027, 1720←1751, 380←590, 367←767; blind 850, 355, 1580.

**Generator variants** (D ≤ 2 changed boundaries, cap 16, cells 0.2–0.95·H; `vKwX` = K valleys within ±X·E):

| scheme | real SEG-fixable generated (12) | synth SEG-fixable 5001 / 9017 | hyps/label real (max) / synth | kept texts real / synth |
|---|---|---|---|---|
| v1w3 | 12 | 9/24, 29/35 | 2.7 (8) / 5.4–5.6 | 1.65 / 1.9–2.1 |
| **v2w3** | **12** | **18/24, 33/35** | **2.8 (8) / 7.1–7.5** | **1.69 / 2.4–2.6** |
| v1w5 | 7 | 7/24, 22/35 | 2.7 / 5.6–5.7 | 1.61 / 1.9–2.0 |
| v2w5 | 12 | 16/24, 31/35 | 6.5 (16) / 9.4–9.9 | 2.48 / 2.8–3.0 |

Ranking by geo-mean glyph score: real truths at rank 0 in 5/12, rank ≤ 1 in 12/12; needed ratio to the best ≥ 0.808
(all 12). Taking the argmax instead of pinning the as-read reading would flip 1/40 correct real readings (602→603) and
12/78, 11/82 synthetic → **the anchor must stay the as-read text**.

**Preprocessing** (143 real labels, `skip2`, v1w3 set; synthetic 5001 as-read):

| variant | as-read (+/−) | truth in set | count wrong | named blind | synthetic as-read |
|---|---|---|---|---|---|
| δ 8 (today) | 40 | 52 | 2 | 810, 1581, 1117 | 78 |
| δ 5 | 41 (+4/−3) | 51 | 4 | unchanged | — |
| δ 12 | 41 (+6/−5) | 53 | 2 | 1580 as-read; 1173 enters set | 79 (+10/−9) |
| open 2×2 | 25 | 32 | 31 | worse | — |
| Sauvola k .2 | 49 (+17/−8) | 56 | 7 | 850, 1580 as-read; 1173 rank 1 | 101 (+34/−11); 9017: 100 (+33/−15) |
| 2× bilinear | 18 | 30 | 11 | worse | 62 (+14/−30) |
| δ 8 ∪ Sauvola | either 57 | **69** | — | all three in set | union sets 125 / 135 |

**Cost** (all tokens of the 9 selected frames, 4 passes, before the cap): today 0.54k–0.99k cells/frame; v1w3 D ≤ 2
mean 4.6–6.3 hypotheses/token (p95 14–22, max 235), 1.9k–3.4k distinct cells; v2w3 7.3–9.8 (p95 18–40, max 624),
2.5k–4.3k cells. `classifyCell` 0.28 ms/cell → +0.6–0.9 s per frame for v2w3, ×2 with a second ink; the cap and the
≤ 7-cell gate below cut the tail (long non-numeric tokens). True cell widths (166 cells): `1` 0.29–0.43·H, other digits
0.41–0.86·H.

## Proposed contract (generic; no scale, no published fact, no house)

1. **Anchor.** Today's cells are hypothesis 0; its text stays `TextToken.text`, so the page vote, legacy chains and
   every as-read field are unchanged. E = 0.55·H_glyph with H_glyph = tallest glyph-sized blob of the group (P2-1).
2. **Boundary candidates.** For each internal boundary of a run with n0 = round(W/E) ≥ 2 (n0 is NOT varied):
   window centre x0 + W·k/n0, half-width 0.3·E (unchanged). Valleys = local column-ink minima in the window; a plateau
   (adjacent equal minima) is one valley. Take the 2 best valleys by (ink asc, |m − centre| asc, m asc). Each valley
   column m yields two cuts, m (column to the right cell) and m+1 (to the left cell); plus the anchor's cut.
   **≤ 5 cut positions per boundary.**
3. **Combination.** Hypotheses differ from the anchor in **≤ 2 boundaries**; every cell 0.2·H_glyph ≤ width ≤
   0.95·H_glyph; **≤ 16 hypotheses per token and ink**, generated in the order (changed boundaries asc, boundary index
   asc, cut x asc); tokens whose anchor has > 7 cells (not a dimension) get the anchor only.
4. **Ink hypotheses.** At most 2 binarisations of the token's own pixels: today's δ 8 mask and a local mean–σ threshold
   (Sauvola, k = 0.2, same window radius, same absolute ≤ 110 branch) recomputed inside the token box (+2 px). Each
   gets steps 2–3 with its own anchor. (Measured page-wide here; crop-only must be re-measured before adoption.)
5. **Score, without scale.** segScore = exp(mean ln max(glyph score, 10⁻³)) over the cells (the classifier's own
   evidence, `round6`). Keep the anchor plus hypotheses with segScore ≥ 0.7 × the token's best (measured need ≥ 0.808),
   **≤ 4 distinct texts per ink, ≤ 6 per token**. Hole-destruction and width regularity are recorded as diagnostics,
   never multiplied in (P2-3).
6. **One ink, one identity.** Every hypothesis carries `{tokenId, inkVariant, cuts[], cells[x0,x1], segScore,
   ratioToBest, changedBoundaries}`; a cell is classified once per `(tokenId, inkVariant, x0, x1)`. The text region
   stays ONE witness: a value reached by several hypotheses is one candidate with the best ratio and a provenance list;
   no hypothesis corroborates another, adds weight, or counts as a second reading in a cluster/`evidenceTuple`.
7. **Deterministic order.** Anchor first; then segScore desc, changedBoundaries asc, inkVariant (δ 8 before σ), cells
   lexicographic by x0, text asc. Integer columns only; no Map/Set iteration order reaches the output.
8. **Classifier dependency (P0-2).** The two-hole case must compare both holes (or skip position) — without it the
   1580 class of failure is unrecoverable by any segmentation.
9. **Tests (generic).** Synthetic hollow pairs (`80`, `00`, `60`, `90`, `08`) italic 12–14 px touching, where the counter
   is deeper than the junction: truth ∈ hypotheses, anchor text unchanged; profile-tie cases; cost bounds asserted
   (≤ 5 cuts/boundary, ≤ 16 hypotheses, ≤ 6 texts); determinism (same bytes → identical hypothesis list).

## Risks / negatives

- **More candidates feed the round-4 second defect.** Two weak wrong alternatives can agree on a wrong scale; hypotheses
  must only rank (metric layer), never raise confidence or count as independent witnesses (rule 6).
- The 0.7 keep ratio and window 0.3·E rest on 12 real fixable labels; held-back synthetic confirms 33/35 generated, but
  6/24 calibration cases still need wider windows (v2w5 cost ×2.3 for no real gain).
- Not solved: 1173 (classifier; still one substitution), touching under-count and wide-font over-count (P1-5: declare as
  a reader limit, `it.fails`), components merged with drawing ink (P2-2), 11/120 labels with the truth unreachable.
- The two-hole fix introduces 0→8 errors (2/143); Sauvola as a replacement loses 8–15 correct reads per corpus — only
  as an added hypothesis; page-wide vs crop-only behaviour differs and is unmeasured.
- e-OZE's sealed `1601` will change to `1600` (or gain it as an alternative) — a 0.06 % scale change on a PASS house,
  correct but visible in diffs.
- Cost: ×4–5 cells classified (×8–10 with two inks) before caps; +0.6–0.9 s/frame per ink measured.
- Truth is eye-read from 6× crops (≈ 30 regions excluded as symbols/fragments); scales were used only to cross-check.
