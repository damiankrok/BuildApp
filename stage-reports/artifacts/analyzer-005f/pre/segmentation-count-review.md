# 005F pre-review A — condensed numeric segmentation: bounded glyph-count hypotheses

Reviewer A (read-only). Scratch: `/home/user/BuildApp/.cache/pre-a5f/` (gitignored) — probes, and `lattice5f.ts`, a copy
of `numeric-lattice.ts` with the proposal behind env switches (drivers `dev5f.ts`, `corpus5f.ts`, `plan5f.ts`).
**Replication check:** with every 5F switch off, `lattice5f.ts` reproduces 005E exactly on the 81 development labels
(FIT asRead 21 / top 18 / inSet 43, CLEAR 3/3, SUPPORTED 17/11, AMBIGUOUS 27/7, LQ 1/0; HELD_BACK 14/11/19; TARGET 7/7/10).
Every number below comes from the cached bytes. Truth is used only to score results, never to place a cut or pick a count.

## Verdict

- A count fix is **necessary but not sufficient** for `2590`. Width against the local style decides 4 glyphs without
  ambiguity, and the four-cell lattice reads `1140 / 2140 / 1540 / 2540 / 1340 …`. Its `9` cell scores `4` at 0.50
  and `9` at 0.25, so `2590` is not reachable under any valley-based 4-cut. Of 360 exhaustive 4-cuts it is reachable
  in 9 and the top reading in none.
- The image score cannot choose a count. Splitting a glyph into slivers that read `1` scores as well as the truth.
  The count has to come from **run width against the page's own glyph width** plus **topology gates**. Scale must
  never choose it.
- Counter safety is cheap and generic. A counter is a hole that **persists across the three ink masks**. Valley depth
  cannot tell a counter from a junction.

## Findings

**P0-1. `E = 0.55·h` undercounts long merged runs. This is the root cause of `2590` → 3 cells.**
`round(w/E)` returns k only when the per-glyph width w/(k·cap) lies in [0.55(k−½)/k, 0.55(k+½)/k] (h = cap). That
window is [0.41, 0.69] for k=2, [0.46, 0.64] for k=3, [0.48, 0.62] for k=4 and [0.50, 0.61] for k=5. ARCHON per-glyph
widths in merged runs measure 0.405–0.538 (DEFAULT, median 0.49; 66 runs on 81 labels). So k=4 is a coin toss and
k=5 is almost always undercounted. `2590` measures 21/11/4 = 0.477 < 0.481, so it is cut into 3. The development set
never exposed this: its merged runs hold at most 3 glyphs in every mask. Modrzewnicy is the first plan with a 4-glyph
run, because at cap 10–11 px (development caps 12–21) adjacent anti-aliased glyphs touch. Three development
undercounts at k=3 have the same cause: kosacce `665` and `205` in STRICT, and jablonkach `505` in SAUVOLA
(19 px / 13–14 cap). Tunbergiach `274` (DEFAULT) is undercounted at k=2.

**P0-2. The `9` → `4` confusion at about 5 px glyph width blocks `2590`, `1950` and kosacce/modrzykach.**
The `9` cell of `2590` (SAUVOLA 14–18, 5×11 px, 1 px counter) scores `4` 0.498, `9` 0.260 (ratio 0.52 < `glyphRatio`
0.6). In `1950` the `9` reads `4` (ratio 0.66) and the `5` reads `1`; kosacce `890` → `840`, modrzykach `689` → `684`
(P1-4). A classifier defect outside A's scope — flag it; without that fix 005F will not reach `2590`.

**P0-3. The image score cannot reject an (n+1) hallucination.** I forced an n+1 split (valley cuts, no gates) of
every run ≥ 0.6 cap on the true-count anchors of the 81 labels: 165 splits.
- 117 of them (71 %) read as a valid 2–4-digit dimension.
- Their geometric-mean glyph score is ≥ the true n-reading's in 64 cases and ≥ 0.9 of it in 96. The median ratio is
  1.00 (q90 1.12, max 1.79).
- On `2590` the 4-cut scores 0.517 and the 5-cut 0.510 (DEFAULT). A width that has been split is still read as `1`s.
- Gates that block these splits: the width band blocks 159 of 165. Of the 117 valid readings, the counter gate
  stops 59 and the depth gate stops 45. With all gates on, 0 of the 117 survive (see the Q4 section).

**P1-1. The face is not condensed: the local style does not separate modrzewnicy.** Isolated-glyph ink width / cap
(p̂, median, tokens within cap ×/÷1.25):

| | p̂ |
|---|---|
| modrzewnicy (48 samples at cap 11) | 0.455 |
| development houses | marcowki .500, kosacce .462, g2e .500, e-OZE .478, jablonkach .500, miranda .500, zurawkach .471, modrzykach .462, azaliach .500, dabecjach .571, tunbergiach .474 |

Token pitch/cap (ink extent / n / cap):
- 81 development labels: min 0.397, q05 0.452, median 0.49, q95 0.513, max 0.667. Per-house medians 0.48–0.51.
- Modrzewnicy CLEAR/SUPPORTED tokens at cap 10–15: 0.467–0.615, median 0.50.
- Modrzewnicy inks: `2590` 0.477, `1950` 0.45, `640` 0.48, `1000` 0.50.

What differs is the cap size, not the pitch. The synthetic stroke face is the wide one: per-glyph widths in merged
runs are 0.45–0.67, median 0.56–0.59. The working-tree `condense` comment in `digit-corpus.ts` ("the ordinary face
sets them near 0.7") describes the synthetic face, not ARCHON. Do not cite it as evidence about the plans.

**P1-2. Counter cuts are real, depth-invisible and topology-visible.**
- Dev anchors with a counter-breaking cut: 20 of 243 (variant level, final rule). 16 of these 20 read wrong (80 %),
  against 130 of 223 (58 %) of the other anchors.
- Depth of counter-breaking cuts: 0.30–0.82, median 0.67. Depth of other anchor cuts: 0.125–1.0, median 0.75.
- Of the 005E re-cut hypotheses, 650 of 1330 (49 %) contain a counter-breaking cut.

**P1-3. Count ambiguity already reaches the class today and is not modelled.**
- 005E lattices already merge readings of different digit counts across ink variants. This happens on 4 development
  labels (all AMBIGUOUS) and on 13 and 10 corpus labels.
- On the corpus, 2 + 2 of these are CLEAR or SUPPORTED. Example: `small-5001-18` 926 → `925` SUPPORTED while
  4-digit rivals hold p 0.12.

**P1-4. Pruning sharpens confidence, so the class bounds need refitting.**
- Removing segmentation noise concentrates probability on the as-read value. When the glyph classifier is wrong,
  the class rises anyway.
- Development: wrong SUPPORTED 9 → 12. The new ones are kosacce `890` (840), modrzykach `689` (684) and jablonkach
  `380` (580).
- Corpus wrong witnesses: 33 → 40 (seed 5001) and 27 → 31 (seed 9017).
- Corpus wrong-count CLEAR/SUPPORTED: 0 → 4 and 1 → 2, e.g. `touching-9017-3` 185 → `85` CLEAR. The width-ambiguity
  cap (C6) removes these (0 and 1 left).

**P2-1. A tight style band hallucinates on the same plan.**
- With p̂·(1±0.15), the `000` run of `1000` (r = 0.533/p̂ = 1.17) falls out of band. It then switches decisively to 4
  glyphs and reads `10111`.
- Three development 3-glyph SAUVOLA runs sit at r = 1.166 (kosacce `226`, `890`; modrzykach `285`). They would become
  `2116`, `8110` and `2115`.
- The measured true-count range of r = per-glyph / p̂ over all three masks is 0.81–1.17. Use [0.75, 1.30] (C2).

**P2-2. Without page style no count can be decided.** Each synthetic corpus page holds one label. Count alternatives
there stay non-decisive (22 and 19 inks), and TOUCHING undercounts persist (wrong-count as-read 15 → 15 and 15 → 14).
This is honest, not a bug. The cost lands as count-ambiguous classes (C6).

## Measurements

**Q1 — modrzewnicy inks** (pass frame ROTATED_CW unless noted; sheared DEFAULT bitmap; cap = tallest cell)

| ink | DEFAULT runs (w/cap) | components D/S/Sv | profile (DEFAULT, ink columns) | anchor | 4-cell valley cuts |
|---|---|---|---|---|---|
| `2590` x105–115 y427–447 | 3–23 (21 = 1.91 cap; w/E 3.47) cap 11, slope −0.18 | 1 / 2 (`2` separates) / 1 | 2,8,7,8,7,**4**,8,8,7,9,**3**,8,9,7,10,**5**,7,10,5,7,7 | 8,18 → `100` (cells 5/10/6 px) | windows at pitch 5.25: x8 (ink 4, depth .50), x13 (3, .67), x18 (5, .50) |
| `1950` x127–137 y347–366 | 3–5 (`1`) + 7–22 (16 = 1.45 cap; 2.64 → 3) | 2 / 3 / 3 | …,4,11,7,0,5,9,6,8,7,**2**,7,8,8,9,**1**,8,8,4,10,7 | 4 cells → `1410`: count already right | n/a |
| `640` x127–137 y673–688 | 3–12 (`64`, 0.91 cap) + 14–18 | 2 / 2 / 2 | 7,10,7,9,7,**2**,4,5,11,8,0,8,8,4,10,7 | 3 cells → `600`/`610`: count already right | n/a |

The 3-cut and 4-cut fall at x8/x18 (3 cells) against x8/x13/x18 (4 cells). The extra boundary is x13, the deepest
column in the run, in the `5|9` junction.

Per-cell scores of the 4-cell cuts (valley columns to either side), best first:
- DEFAULT 8,14,19, gm 0.517: [3–7] 1 .543 / 3 .469 / 2 .396 · [8–13] 3 .526 / 5 .500 · [14–18] 4 .504 / 9 .246 ·
  [19–23] 0 .497.
- DEFAULT 9,14,19, gm 0.511, reads `2540`: 2 .493 · 5 .552 · 4 .504 / 9 .246 · 0 .497.
- SAUVOLA 9,14,19, gm 0.542, reads `2540`: 2 .507 · 5 .589 · 4 .498 / 9 .260 · 0 .582.
- STRICT 14,19, gm 0.498, reads `1540`.
- For comparison, the best 3-cell gm is 0.359 / 0.368 / 0.364 (D/S/Sv) and the best 5-cell gm is 0.510 / 0.448 / 0.488.
  The 5-cuts pass through the `9` and `0` counters and give 0.38 cap per glyph.

Does any 4-cell cut give `2590`? Not as the top reading under any of 3 × 120 exhaustive cuts (every cut ±2 px of the
uniform pitch). It is reachable within the candidate ratio in 2 (D), 0 (S) and 7 (Sv) of them, none valley-based.
Through the full prototype lattice, `2590` reads as-read `1140` AMBIGUOUS (DEFAULT), with
`1140 .25 / 2140 .16 / 1540 .12 / 2540 .12 / 1340 .11 / 3140 / 7140 / 2440`.
- `1950` stays `1410` SUPPORTED. The truth is the top reading only under STRICT cuts 5,12,18 (gm 0.341 against best 0.495).
- `640` stays `600` AMBIGUOUS, with `640` in the set at p 0.11. Its `4` has a closed counter and reads `0` (.254 against `4` .172).
- `1000` (HORIZONTAL): `1000` SUPPORTED → CLEAR p 0.89. The `000` 4-split is blocked by the counter rule.

**Q2 — style.** See P1-1. The modrzewnicy plan-wide CLEAR/SUPPORTED list (20 of 173 raw tokens) includes caps from
10 to 44. A local profile must filter by cap (×/÷1.25), or it averages room-label and title text into the estimate.

**Q3 — cost** (dev = 81 labels × 3 masks; corpus = 240 labels per seed)

| config | dev paths / cells / expansions | dev max per label (cells, paths) | corpus 5001 paths / cells | corpus 9017 paths / cells |
|---|---|---|---|---|
| 005E (off) | 1118 / 2479 / 8145 | 72, 44 | 4446 / 9077 | 4607 / 9277 |
| count only | 1166 / 2564 / 8356 (+4 %/+3 %); 7 decisive, 2 alternatives, 85 segmentations | 85, 59 | 5283 / 10494 (82 alternative inks, 1107 segmentations) | 5526 / 10827 (97, 1227) |
| counters (prune) + count — **proposed** | 673 / 1580 / 6754 (−40 %/−36 %); 7 decisive, 32 segmentations | 42, 18 | 2162 / 5266 (22 alternative inks, 236 segmentations) | 2249 / 5325 (19, 227) |
| counters as a penalty + count (as accurate as prune, twice the cost) | 1139 / 2506 | — | 4652 / 9414 | — |

**Q4 — hallucination, final rule.**
- Development: 0 of 243 true-count variant anchors receive any count alternative. All 7 decisive switches move to
  the true count: kosacce `665`/`205` STRICT, jablonkach `505` SAUVOLA, tunbergiach `274` DEFAULT, and 3 on e-OZE
  `472`, whose token box includes a degree mark and whose `47` run is really 2 glyphs.
- Residual margin on development: 3 of the 165 forced splits pass the width test by "fit". The depth gate (1) or the
  counter gate (2) stops them.
- Corpus, 3–4-digit truths, 160 per seed: emitted sets holding a valid value of another digit count grow from 7 → 10
  and 7 → 9. Such a value outranks a present truth in 1 → 2 and 0 → 0 cases. Wrong-count as-read does not grow
  (15 → 15, 15 → 14). Under the C6 cap no wrong-count reading is CLEAR or SUPPORTED except `touching-9017-15` (`54`).

**Q5 — counter cuts.**
- e-OZE `1600` (HORIZONTAL x416–447 y678–693, cap 16). DEFAULT run 19–34 (`00`). The anchor cuts at x30 (ink 4,
  depth .71) through the second `0`'s counter: hole x29–32 y2–13, 34 px, 0.75 cap, present in STRICT (37 px) and
  SAUVOLA (35 px). The true junction is x26 (ink 5). Its pocket (x26 y8–11, 4 px) exists in DEFAULT only.
  Re-anchoring reads `1600`, gm .551 against .467. The lattice moves from AMBIGUOUS p .52 (`1601` .42) to CLEAR p .94.
- dabecjach `1580` (x419–442 y722–733, cap 12). The run 9–27 cuts at x15 (`5|8`, depth .78) and x24 (ink 4, depth .60)
  through the `0` counter: x23–25 y2–9, 16 px, 0.67 cap, persistent (STRICT 19 px, SAUVOLA 16 px). The true `8|0`
  junction is x21. Its pocket (3–4 px) is absent in STRICT, where the glyphs separate. Re-anchoring reads `1580`
  (gm .474 against .408). The lattice moves from SUPPORTED .40 to CLEAR .64.
- `2590`: the true `2|5` cut passes through a large pocket (DEFAULT x6–11 15 px, SAUVOLA x5–11 21 px, 0.64 cap). It is
  open in STRICT, so it is not persistent and not penalised. A size-only hole rule would have blocked the true cut.
- Development, final rule: anchors breaking a counter are re-anchored, giving 3 wrong → right and 1 right → wrong at
  variant level, and no as-read change across variants. Pruning loses the truth's top or reachability in 2 + 2
  variants and in 0 labels across all variants.
  - Ablation (counters only): as-read 42 → 42, CLEAR 9 → 18 (18/18 right), SUPPORTED 29/20 → 25/13.
  - Full proposal: as-read 42 → 44, top 36 → 39, inSet 72 → 74, CLEAR 18/18, SUPPORTED 27/15 (26/15 with C6),
    AMBIGUOUS 35/11.
  - Corpus full proposal: as-read 128 → 135 and 121 → 128, inSet 189 → 193 and 187 → 188.
  - Witness precision: with C6, 75.2 % / 82.9 % against 74.4 % / 78.2 % for 005E. Without C6, 72.4 % / 77.2 %.

## Root cause

1. A single expected width (0.55·h) is used as a pitch estimate for merged runs. It overestimates the touching
   per-glyph width by about 12 % and decides the count by `round`. The error grows linearly with the glyph count.
2. 005E freezes the count: re-cuts move boundaries but never add or remove one.
3. Valleys inside a `0` are as deep as junctions, and nothing in the cut rule knows about topology.

## Proposed contract (image only; every bound measured above)

- **C1 Style.** For each frame and pass:
  - p̂ = median of isolated DEFAULT-mask run widths / cap, over runs with 0.35 ≤ w/cap ≤ 0.80 in all raw tokens whose
    cap is within ×/÷1.25 of the label's.
  - At least 8 samples are required; otherwise the label has *no style*.
  - The style sees no values, chains or scale.
- **C2 Admission.** Per ink run, with anchor count a and r_k = w/(k·cap), a count k is admitted if:
  - with a style: 0.75 ≤ r_k/p̂ ≤ 1.30 (development true counts 0.81–1.17; blind `000` 1.17; `2590` at k=3 is 1.40);
  - without a style: 0.40 ≤ r_k ≤ 0.70 (development 0.405–0.576, corpus 0.446–0.667).
- **C3 Alternatives.** Only k ∈ {a−1, a+1}, never ±2. A k is a candidate if all of these hold:
  - it is admitted;
  - |ln(r_k/c)| < |ln(r_a/c)|, with c = p̂, or 0.49 when there is no style;
  - every boundary has a non-counter-breaking valley option;
  - for k > a, the shallowest boundary valley has depth ≥ 0.35. Depth is 1 − ink / min(peak left, peak right) within
    half a pitch.

  Keep at most one candidate per direction per mask: the run that fits best. That gives **≤ 3 counts per mask**.
- **C4 Decisive vs ambiguous.**
  - **Decisive** — a style exists, a is not admitted and k is: k replaces the anchor's count for that mask, and the
    old count's segmentations are dropped. This is the only way a count changes, and it is pure width plus topology.
  - **Otherwise** — the alternative enters as RECUT paths flagged `countAlt`. It pays the re-cut penalty and adds
    **≤ 2 new texts per ink**, outside 005E's 4/6.
  - Scale, chains and published figures never enter C1–C4.
- **C5 Segmentation per count.** Use the 005E machinery at the count's own pitch w/k: windows ±0.3 pitch, the 2
  deepest valleys, each column to either side, so **≤ 4 options per boundary** minus counter-breaking ones; ≤ 2
  boundaries moved; cells 0.2–0.95 cap; **≤ 16 per count per mask**.
  - Hard caps: ≤ 48 segmentations per mask and ≤ 144 per ink.
  - Cells are memoised. Measured maximum: 42 cells and 18 paths per label.
  - Recommended guard: a hard cap of 96 scored cells per ink.
- **C6 Count ambiguity in the class.** Let d be the as-read's digit count.
  - If any emitted valued sequence with ≠ d digits has p ≥ 0.10, the class is **AMBIGUOUS**.
  - If such a sequence is emitted below 0.10, the class is at most SUPPORTED.
  - If the as-read mask's anchor has a run where k = a±1 is admitted and fits at least as well (*width-ambiguous*),
    the class is AMBIGUOUS.
  - **A 3-vs-4 ambiguity is therefore never CLEAR.**
  - Development cost: 0 right witnesses lost, 1 wrong SUPPORTED removed. Corpus with no style: 66 and 70 labels
    width-ambiguous; right witnesses 105 → 82 and 105 → 87; wrong-count witnesses 4 → 0 and 2 → 1.
- **C7 Metric boundary.** A sequence whose digit count differs from the as-read is never eligible for SCALE_RANKED
  selection, and no other scale-driven choice may pick it. Whether chain arithmetic (STRUCTURAL) may confirm it is for
  the metric reviewer to decide.
- **C8 Counter safety.**
  - Counters of mask V are enclosed background components (4-connected, not touching the bitmap border) that are
    ≥ max(2, 0.2·cap) px tall, and whose pixels are ≥ 50 % hole pixels in **each** other mask re-sheared at V's slope.
  - A boundary at b (a cell starts at b) breaks counter H when:
    - H.x0 < b ≤ H.x1; or
    - b = H.x1+1 and no counter starts at b+1; or
    - b = H.x0 and no counter ends at b−2.
  - The second and third conditions catch walls. Two touching counters that share a wall may be split.
  - A breaking anchor boundary moves to the deepest non-breaking valley in its window, with the count unchanged.
    Breaking re-cuts are pruned.
  - The interior-only rule let the `000` → 4 split through via the wall column, so the wall conditions are needed.
- **C9 Recalibration.** After C1–C8, refit `OCR_CLASS_BOUNDS.supportedMargin`/`supportedP` on FIT and the 5001 corpus.
  The lattice is about 40 % sparser. Report the refit per split.

## Negatives and risks

- `2590` is still not read: P0-2 needs a classifier change, for example the `9` against closed-`4` hole position at
  aspect ≤ 0.5. Expect modrzewnicy to stay unresolved but with honest classes: `1140` AMBIGUOUS instead of `140`
  LOW_QUALITY.
- The style is a page statistic. A plan with two dimension faces of the same cap, or mostly non-dimension text at that
  cap, can bias p̂. The ×/÷1.25 cap filter and the [0.75, 1.30] band are the guard; the band leaves about 11 % margin
  above the development maximum.
- The decisive margin on `2590` is thin: r = 1.40 against an upper bound of 1.30. A slightly wider glyph would leave
  it count-ambiguous (AMBIGUOUS), which is the safe failure.
- Pruning raises wrong SUPPORTED readings (P1-4) until C9 is done. C6 removes the wrong-count part but not the 9→4
  confusion part.
- Counter persistence is wrong where all three masks close a pocket: 2 + 2 variants on development, 0 labels lost.

## Tests a coder must add

- A 4-touching-glyph synthetic label (cap 10–11, 0.47 cap per glyph) counts 4 with a style; `000`/`0000` runs are
  never split by count; a true 3-digit label never emits a 4-digit value at p ≥ 0.10 without C6 firing.
- e-OZE `1600` and dabecjach `1580` re-anchor; with the switches off the lattice is 005E byte for byte; no
  scale-driven selection crosses digit counts.
