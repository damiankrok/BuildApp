# Council B — Plan / CV / OCR Specialist — pre-audit report (BUILDPLAN-ANALYZER-005A)

Repo `/home/user/BuildApp` @ `7cd8e0c` (read-only). All line numbers refer to that tree.
Method: code reading plus **replays of the production functions on the sealed bytes** (scratch harness in
`/tmp/claude-0/-home-user/5eccf0e3-4ef3-5405-aafb-08cd5094f39b/scratchpad/council/B-work/`, Node 22 desktop, vite-node importing the repo sources by
absolute path; `chains_x.ts` there is a *copy* of `chains.ts` with private functions exported and a mode switch for prototypes — the repo file is untouched).
Plan copies replayed: e-OZE / Kosaćce / Marcówki, every ground-plan copy (853 DIM, 853 AREA, 550, 400) plus perturbations.

Disclosure: one of my scratch scripts wrote `e-oze-tokens.json` into the repo root by a relative-path mistake; I deleted it immediately
(`git status` afterwards shows only the orchestrator's untracked `stage-reports/artifacts/analyzer-005a/`). vite-node also touches the gitignored
`node_modules/.vite` cache. No tracked file was modified.

---------------------------------------------------------------------------------------------------------------------------------------------

## 0. The answer in one paragraph (and a correction to the working hypothesis)

The premise "short interior segments outvote one long overall segment" is **not what the code does and not what happened**. The frame vote already
weights by pixel span (`chains.ts:326`, `/50`, linear) and the interior segments never enter the frame vote at all (they are produced *after* it, by
`solveChain` with `fixedScale`). On the e-OZE 853 DIMENSIONED plan the wrong scale (2.5014 vs the published 2.2222) and the strip extent (720×69) and
the missing envelope come from a **chain of four independent weaknesses**, in this causal order:

1. **`dedupeOrientations` throws away the correctly read vertical text** (`ocr.ts:829–834`). The correct turn (CW pass) reads the rotated "760"
   *correctly* (`760`, conf 0.55) plus `112`, `200`, … but the page-level "which turn wins" vote sums `score × confidence × glyphCount` over **all**
   tokens, and one 19-glyph junk token (`1±±±±±±±±±±±±±±±±±±` at 721,131, merit 2.84) tips CCW/CW = 26.7/22.1 over the ×1.1 band → the CW pass is
   discarded wholesale, the mirrored CCW readings (`041`, `711`, `007`) are kept. No vertical overall chain, no isotropy check.
2. **The frame vote then has a razor-thin margin decided by a multiplicative bonus** (`chains.ts:395`): candidates 2.5014 (w 8.94) / 2.2236 (8.41) /
   0.2718 (7.22) / 14.27 (6.89) / 4.217 (6.82). 2.5014 = the *substituted* reading `1801` of the very token whose exact reading `1601` seeds 2.2236,
   plus a **0.45-weight** vertical `100` (38.5 px) that earns the whole ×1.5 "second chain" bonus.
3. **`solveChain` "corrects" numbers, never spans or scale** (`chains.ts:690–723`): with the scale frozen at 2.5014, a token whose ink says `320`
   (read `720`) is rewritten to `150`, `276` (read `516`) to `136`, `276` (read `176`) to `126`, a correctly read `180` to `104`. These invented
   values become 7 of the 9 registration anchors — agreement by construction, not corroboration.
4. **`planExtent`'s wall vote cannot see the walls that contradict the chain frame** (`plan-decomposition.ts:791–805`): the only READ vertical chain is
   an interior 68-px detail chain, its ±35 % window (y 262–379) never contains the 12 of 20 long bands (1504 of 2537 px = 59 %) that lie outside it, so the
   vote reports "1033 px of the 1033 px of wall found lying inside it", `weak:false`, and the 60 % filter in `decomposePlan:1213` then keeps **0 of 45**
   bands → `walledEnvelope = null` → `PLAN_NO_WALLED_ENVELOPE`.

**Counterfactual proving (1) is the root**: same bytes, same code, OCR restricted to the CW turn → frame scale **2.2235** (X 2.2236, Y 2.2220;
candidate 2.5014 falls to w 16.0 vs 39.9), `dimensionedExtent` = 720×342 (x 75–795, y 236.5–578.5, 4/4 sides wall-supported), `planExtent` `weak:false`.
Independent of that, prototype change "V1: additive corroboration" fixes the vote by itself (e-OZE 7/7 perturbations correct vs 4/7 today) without changing
Kosaćce or Marcówki. Both are generic, one-line-class changes; neither mentions a project.

**The same bytes give three different scales** under harmless perturbations (Section 5): e-OZE 853 DIM → 2.501 (identity), 2.221/2.222/2.220 (0.75×, 1.25×,
JPEG q75), **1.390** (contrast ±15 %), 2.224 (grayscale, but a 720×51 strip). Kosaćce and Marcówki lose the scale entirely at 0.75×. A 1–2 px crop/pad
changes nothing (all thresholds are translation invariant). This is the direct quantitative evidence for "the analyzer is tuned, not general".

---------------------------------------------------------------------------------------------------------------------------------------------

## 1. Q1 — why the frame vote picks 2.50 on e-OZE; how a reading gets CHAIN_CORRECTED

### 1.1 What `solveFrameChains` does (chains.ts:611–642)
1. `assignTokens` (`chains.ts:195–252`): each OCR token goes to the nearest chain (≤ 2.2 text heights across, inside the tick span, orientation must match axis),
   one number per interval; each token brings its **reading lattice** (`parse.ts:130`, ≤24 strings, single substitutions from each glyph's top-3
   alternatives with score > 0.2, pairs on the two least-decided glyphs).
2. `proposalsOf` (`chains.ts:307`): one proposal per (token, admissible span, reading). Span = adjacent tick pair **only** (`maxSkip = 0` for the vote), the
   token must sit within 0.3×length of the span centre (`:368`). `weight = readingConf × tokenConf × pixelLength / 50` (`:326`).
3. `voteScale`/`supportFor` (`:390–397`, `:481`): seed on every proposal's own ratio, gather proposals within **±2.2 px** of the seed scale
   (`gatherAround`, `:376`: best proposal per token), `weight = Σ member weights × (1 + 0.5 × (chains − 1))` (`:395`). Winner = max weight.
4. `decideScale` (`:570`) only overrides the winner when `planScalePlausibility` (wall thickness 0.15–0.8 m, `extract.ts:101–120`) rules it out. On e-OZE
   both 2.50 and 2.22 give plausible walls (measured `outerPx = 20`: 0.500 m at 2.5014, 0.444 m at 2.2222), so it never fires.
5. `refineAxis` (`:517–541`) refits each axis inside ±5 % of the pooled scale.

### 1.2 The actual e-OZE numbers (replayed, 141 proposals from 19 token-carrying chains out of 81)
| candidate cm/px | members | weight | note |
| --- | --- | --- | --- |
| 2.5014 | `1801` (H chain y 698.5, 720 px, **1 substitution**, lattice conf 0.66, w 5.51) + `100` (V chain x 485, 38.5 px, w **0.45**, miss 1.48 px) | 8.94 = (5.51+0.45)×1.5 | winner |
| 2.2236 | `1601` (same token, 0 substitutions, conf 1.00, w 8.41) | 8.41 (×1: one chain) | the published scale (16.00 m / 720 px = 2.2222) |
| 0.2718 | 3 numbers on 3 chains | 7.22 | junk |
| 14.27 / 4.217 | 6 numbers on 6 chains each | 6.89 / 6.82 | junk |
The other lattice readings of the same 720-px token: `1001` → 1.3903 (w 5.99), `1501` → 2.0847 (4.80), `1603`, `1607`.

**Short interior segments do not vote for 2.50.** At 2.5014 only two proposals are inliers (above). The interior segments are 42–191 px and their
chain spans are adjacent-tick pairs (`maxSkip = 0`), so e.g. the printed `480` (ticks 556.5→747.5 with three spurious ticks between) has no proposal
in the vote at all. What the interior segments do is appear **afterwards** as registration anchors — see 1.3.

### 1.3 How a reading gets CHAIN_CORRECTED "to fit the vote" (chains.ts:662–815, called at `:630` with `fixedScale = scaleX/scaleY`)
- `spanOf` (`:679–727`): for a span carrying exactly one token it scans **all lattice readings** and accepts any whose `|valueCm/scale − pixelLength| ≤ 2.2 px`
  (`:703`). On a 42-px span that window is ±5.2 % (≈ ±11 cm wide at 2.5 cm/px), and the lattice offers single-digit variants ±1…±9 in tens/units, so some reading
  almost always lands inside. Merit `(1+m)·0.7^skipped·0.45^subs` (`:722`) is **positive** for a forced substitution (≥ 0.46) while "token present but
  unreconcilable" is **−0.5** (`:723`); the DP over ticks (`:729–747`) therefore always prefers force-fitting to admitting that the span or scale is wrong.
  There is no null hypothesis ("this token is not a dimension of this span").
- Origin label: `substitutions === 0 ? READ : CHAIN_CORRECTED` (`:780`).
- Replay of the e-OZE default run (9 anchors, `metric-evidence.json` + my replay): the printed sheet numbers were **rewritten**:
  `720→150` (printed 320 at 188,297), `516→136` and `176→126` (printed 276 at 421,297 / 292,297), `180→104` (printed 180 at 454,511, read correctly!),
  `155→125` (an 8-px-high opening-callout digit at 385,592), `1601→1801`. Confidences 0.12–0.32. Even in the *correct-turn* run the same mechanism rewrites
  `176→116`, `516→116`, `108→100`, `155→105` (5 CHAIN_CORRECTED vs 4 READ) — but there the frame scale is right, so the damage is confined to low-weight anchors.
- `buildChain` (`extract.ts:765`) turns every non-DERIVED segment with confidence > 0 into a registration anchor, including CHAIN_CORRECTED. So the anchor set for
  registration is **fitted to the vote's scale first and then used to confirm it**: X 2.5016 vs vote 2.5014; Y is a **single** anchor (`100`, 38.5 px → 2.5974) accepted
  as "measured both axes" with anisotropy 1.038 and confidence 0.83 (`registration.ts:166`). `fitAxis` picks the largest *count* of inliers first
  (`registration.ts:102`, tolerance 3 px `:124`), so N mutually-consistent forced fits beat one exact long span — this is the only place where "many short vs one long"
  is literally true, and it is a consequence, not the cause.

### 1.4 Proposed generic, bounded change (evaluated on a scratch copy, not in the repo)
Facts first: pixel-span weighting **already exists** (linear). Making it quadratic is not needed and would let one misread long token dominate.
The defects are (a) the corroboration bonus is multiplicative and independent of the corroborator's weight, (b) a hypothesis can be seeded by a substituted
reading of a token whose exact reading seeds the rival, (c) CHAIN_CORRECTED values act as evidence, (d) only the winner is emitted.

| change | definition | effect on 3 sheets × 7 perturbations (id, 0.75×, 1.25×, JPEG q75, contrast .85/1.15, gray) | verdict |
| --- | --- | --- | --- |
| V1 additive corroboration | `weight = Σw + 0.5·(Σw − heaviest chain's Σw)` instead of `Σw·(1+0.5(chains−1))` (`chains.ts:395`) | e-OZE **7/7** (baseline 4/7); Kosaćce 6/7 (= baseline, 0.75× fails in both); Marcówki 6/7 (= baseline). With the CW turn prior: Kosaćce **7/7** (baseline+CW fails 1.25× with 3.36) | **take** |
| V2 = V1 + `0.45^subs` in vote weight | | e-OZE 7/7, but Kosaćce **1.25× regresses** (5/7) | reject as a vote change |
| V3 = V2 + drop spans < 18 px from the vote | | same as V2 | not needed |
On the 14 plan copies V1 changes only: e-OZE 853 DIM and AREA (2.501 → 2.224, both now right), e-OZE 550 (2.222 → 2.179, both wrong for that copy), Marcówki attic-853
(3.698 → 3.060, unverifiable; both differ from the ground plan's 2.643). Kosaćce/Marcówki ground plans unchanged.

Additional generic changes, not prototyped:
1. **Anchors for registration = `origin === 'READ'` only**, weight 0 for CHAIN_CORRECTED (`extract.ts:765`). A value the scale produced may not confirm the scale.
2. **`ScaleHypothesis[]` instead of prose**: emit up to 3 ratio-distinct (≥ 3 % apart, the existing `scaleCandidates` at `chains.ts:426`, 13 ms) hypotheses:
   `{cmPerPixel, scaleX, scaleY, score, marginToNext, members[{chain, tokenId, text, substitutions, pixelLength, weight}], overallChainRead:{x,y}, isotropy=|sX/sY−1| of the overall chains,
   wallThicknessM, falsifiers[]}`. Downstream gates that are *independent of the digits* then decide: published footprint (e-OZE: 2.2236 → 16.00×7.63 m = 122.1 m² ✔;
   2.5014 → 18.01×8.58 m = **154.5 m²**, 26.6 % off ✘), room areas, cross-copy pixel ratio (a 550-px copy of a 853-px drawing must give 853/550 × the scale).
3. **OVERALL-chain authority without walls**: per axis, the READ chain whose tick span is ≥ 0.6 × the heavy-ink body extent gets its hypotheses flagged `overall`; if both axes have an overall chain
   their scales must agree within ~2 % (e-OZE correct turn: 2.2236 vs 2.2220 = 0.07 %). Authority = a required corroboration, not a bigger multiplier.
4. **Registration guard**: anisotropy > 2 % on a raster that came from a vector export ⇒ refit isotropic from the overall chains and flag; a single-anchor axis must be labelled "assumed", not "measured"
   (`registration.ts:150–164`).

---------------------------------------------------------------------------------------------------------------------------------------------

## 2. Q2 — why the e-OZE extent is a 720×68 strip

### 2.1 Chains READ per axis (default run; `chains with READ/CHAIN_CORRECTED 9`)
- Horizontal: 8 (widest 75→795 = the misread `1601→1801` overall; 508→765; 116→220; …).
- Vertical: **1** — baseline x=485, ticks 286.5/316.5/355 (the interior detail chain around the read `100`). `dimensionedExtent` (`plan-decomposition.ts:698–735`) picks "the widest chain that
  READ something" per axis: y = 286.5→355 (68.5 px; the first 30-px segment is UNRESOLVED but ≥ 0.5×the shortest read segment, so it is kept, `:711–716`).
  Result 720×68.5 (`planExtent` → `weak:false`).
- The overall depth chain exists as a raw chain (baseline x=24, ticks 230…578.5, 3 ticks) and its token exists — see 2.2.

### 2.2 Why "760" was not read
Not for a glyph-height or cell reason. Replay: HORIZONTAL/CW/CCW passes are all run (`ocr.ts:895–925`); the **CW pass reads `760` at (3,398)-(19,422), cap height 17, token conf 0.55**
(glyphs `7`: 0.49/0.55 alt 3,2,1; `6`: 0.35/0.56 alt 0,8; `0`: 0.61/0.73 alt 4). Height gates (`minGlyphHeight 6`, `maxGlyphHeightFrac 0.06×853 = 51`, `ocr.ts:114/931`) pass; `assignTokens` would attach it
(offset 0.7 heights, along-span inside 230…578.5). It is discarded by `dedupeOrientations` (`ocr.ts:829–834`):
- CW pass total merit 22.1, CCW 26.7 → ratio 0.83 < 1/1.1 → `losing = ROTATED_CW`.
- The merit statistic `score·confidence·glyphs.length` (`ocr.ts:813`) rewards **long junk**: the single token `1±±±±±±±±±±±±±±±±±±` (19 glyphs, box 721,131 — a foliage/edge blob) contributes 2.84 to CCW vs 0.72 for
  the equivalent CW junk. Tokens that actually parse as numbers total 8.6 (CW) vs 9.2 (CCW): a tie.
- The kept CCW readings of the same ink are the 180° mirrors: `041` for 760, `711` for 112, `007` for 200, `053` for 324.
- **The turn cannot be decided by OCR merit at all** on these sheets: pairwise clashes of numeric tokens are ~50/50 (e-OZE 853 DIM 10 CW / 11 CCW of 21; e-OZE AREA 11/11 of 22; Kosaćce DIM 9/13 of 23; Kosaćce AREA 16/11 of 28),
  i.e. the template classifier scores a digit and its 180° rotation almost equally. Whole-page ratios over all 11 plan copies range 0.83–1.09 around the ±10 % switch (`kos-853DIM 0.92`, `eoze 0.83`, `eoze-853AREA 0.88`,
  `eoze-550 0.90`, `marc-853 1.09`): the switch is a coin toss that happens to land wrongly on e-OZE, and where it does not switch (Kosaćce, 0.92–1.02) about half of the vertical numbers are read mirrored and lost per-token.
- The `1601` itself is a separate reader defect: glyph segmentation (`ocr.ts:736–790`) cuts the touching italic `0 0` run (16 px wide, `expected = 0.55·h = 8.8`, `count = round(16/8.8) = 2`) at the **deepest column inside the
  window around the even-pitch centre** (`:765–776`), which is the hollow centre of the second `0`, not the gap; the last cell is a 4.6-px sliver read as `1` (score 0.55, alternatives `3`,`7`, no `0`) → the lattice has no `1600`
  (only 1601, 1001, 1801, 1501, 1603, 1607). Column-ink valleys cannot tell a hollow glyph centre from an inter-glyph gap.
- CELL_W/CELL_H (12×16, `ocr.ts:43–44`): not implicated at 853 px (cap 16–17 px); implicated at 400/550 px (Section 4, T23).

### 2.3 Why `planExtent`'s wall vote could not overrule the strip (plan-decomposition.ts:774–820)
Replay with the sealed chains: 45 bands, `wallPx 15.5`, 20 long bands (`≥ 2.5×wallPx`, 8 V / 12 H). `near` = chainRect ± 35 % of the chain span **per axis**:
x −177…1047, **y 262.5…379.0** (the strip is 68 px tall). Long H walls at y 246.5 (328 px) and 568.5 (505 px), plus the logo/terrace bands (12 bands, **1504 px = 59 % of the 2537 px long-band length**)
are outside `near` and are **never counted** — neither as `held` nor as `loose` (`:797–804`). Inside: 8 bands, 1033 px, all "held" → `why: "…1033 px of the 1033 px of wall found lying inside it"`, `weak:false`.
Consequences: (i) the vote is unanimous by construction because the window is derived from the frame it is meant to test; (ii) the wall-derived frame `fromBands` (75…795 × 237…578) is computed (`:776`) but used only when there is no chain frame or `held < loose`;
(iii) in `decomposePlan:1207–1214` the 60 % rule keeps a vertical wall only if ≥ 60 % of its run lies within the extent (walls are 302 px long, the strip overlaps 68 px = 23 %) → `inside = 0 of 45` → `walledEnvelope` needs both axes (`axisBox`,
`:744`) → `null` → the terminal `PLAN_NO_WALLED_ENVELOPE`. The failure is manufactured by a degenerate frame that nothing challenges (aspect 10.5:1; minor side 4.4 × wallPx; every other read plan has minor/wallPx ≥ 21).
Generic changes (bounded): (a) size `near` from `max(chainSpan, wallFrameSpan)` and count everything the window excludes as `loose` evidence — or drop the window and test the chain frame against the long-wall frame of the *connected heavy body*;
(b) reject a chain frame whose minor side is below a physical floor (a house is ≥ ~3 m wide and walls ≤ ~0.5 m ⇒ minor ≥ ~8×wallPx; measured cases: 4.4 and 6.3 vs ≥ 21) and fall back to the existing `weak:true` wall-frame branch instead of a terminal failure;
(c) keep the failed frame as a hypothesis (Section 6).
Prototype note: "all four sides supported by a long wall" was tested as a discriminator and is **not** clean (Kosaćce 3/4, Marcówki 2/4, e-OZE strip 2/4, e-OZE correct 4/4) — do not use it as a gate.

---------------------------------------------------------------------------------------------------------------------------------------------

## 3. Q3 — the AREA_TABLE copy

What it carries (viewed): **e-OZE**: only the two outer chains, `1600` (bottom, H) and `760` (left, rotated, V); room labels `Pokój 10,34 m²` etc. replace the interior red dimension arrows (no interior chains at all);
opening callouts `230/230`, `110/230`, `100/140`… in circles. **Kosaćce**: three nested chains — top `1660` over `269 | 665 | 521 | 205` (Σ = 1660) and right `1260` over `370 | 890` (Σ = 1260) — plus room areas; the same callouts.
Replays (`t8`, `t10`): Kosaćce AREA scale **2.4061** (identical to the DIM copy 2.4061), 4 READ chains (2H/2V; DIM copy has 11: 6H/5V), `dimensionedExtent` 46–736 × 179.5–703 → `planExtent` 46–742.5 × 179.5–703 (`weak:false`, 3361 of 4838 px of wall inside)
— **the reading side is correct** and identical to the DIM copy's extent. What the reading side contributes to the downstream failure: only 4 READ chains ⇒ chain-derived grid lines exist only where the outer nested chains break (top and right side), so
the grid is 8×6 (DIM copy 18×13) and the interior is cut by band axes alone; that is an input-poverty fact, not an error. The room-area labels are read as tokens but `parseNumber` turns `10,34` into a **metre length** (`parse.ts:94–100`, LINEAR_DIMENSION 10.34 m) —
harmless only because they are rarely on a chain; the *area* is never parsed (no `m²` kind), so the printed areas (12–13 independent scale/identity constraints) are not consumed by the reading side.
**e-OZE AREA copy**: scale 2.5014 (same wrong vote, same lost `760`), `dimensionedExtent` 75–795 × 298–392 (a 720×94 strip from a 3-READ-chain set) — same failure as the DIM copy, with less interior detail.
Usable as a base plan? Yes where its outer chains are read (Kosaćce): it is the same drawing at the same pixel coordinates (registration origin (75,230) on both e-OZE copies), so extent and scale are equal; it is *weaker* for grid because interior chains are absent.
It should be a scored candidate, not a fallback taken only when the DIM copy is missing (`layout.ts:198–247` orders DIMENSIONED first and stops at the first frame with any extent).

---------------------------------------------------------------------------------------------------------------------------------------------

## 4. Q4 — threshold register (every numeric threshold in scope)

Legend for breakage: **TW** thin timber walls, **TM** thick masonry, **HW** hatched/poché walls, **SP** 400–550 px plans, **AT** area-table copies, **FH** furniture-heavy, **FT** front-at-top plans, **2D** two drawings on one sheet,
**RT** rotated text, **GF** green/coloured vegetation, **MM** millimetre/other-unit sheets. `[M]` = measured here, `[C]` = derived from the code path (no fixture ran it).

| id | file:line | value | justification | families that break it |
| --- | --- | --- | --- | --- |
| T01 | prepare.ts:28 | `MAX_WORKING_EDGE` 2200 | comment: line detector O(ink×angles) | large scans: analyzer works downscaled, metrics (extract.ts) read full-res — two resolutions for one frame `[C]` |
| T02 | prepare.ts:101–116 | strokes: `minLength = max(6, 0.012·L)`, hough `0.015·L`, `minSupport 0.012·L / 0.01·L`, **`maxThickness 4`, `maxGap 2/3` px**, `maxSegments 400/300`, `maxLength 0.3·L` | comments in lines.ts; none for constants | relative lengths but absolute thickness/gap in px → SP, resize `[C]`; FH (segment cap) |
| T03 | plan.ts:119 | body component `minPixels max(40, 0.04 % area)` | none | 2D (largest component chosen) `[C]` |
| T04 | plan.ts:124 | `linearBands` fracs 0.004 / 0.045 / 0.05, aspect 2.5, **`maxBands 64`** | none | FH (cap truncates), TW at low res (0.4 %·L ≈ 3.4 px), HW `[C]` |
| T05 | plan.ts:154 | opening gap ≥ `max(6, 0.02·W)` px (≈ 41 cm at 853/2.4) | none | narrow windows on SP `[C]` |
| T06 | plan.ts:178–182 | outline inset `max(4, 0.02·W)`; tick length ≤ 0.05·W; angle tol 3°; `minMembers 4`; spacing > 1 | none | AT (few ticks), 2D `[C]` |
| T07 | plan.ts:214–219 | `wallRects ≥ 4`, margin 1.5×median thickness | none | plans with < 4 bands `[C]` |
| T08 | raster.ts:78–91 | ink = **min(R,G,B)** | long comment | GF: green foliage is "ink" → junk tokens (`1±±±…`) `[M]` |
| T09 | mask.ts:366–372 | adaptive mask: **radius = max(4, round(max(W,H)/40))** (21 px at 853), `delta 8`, `absolute 110` | comment (watermark, poché) | SP: radius shrinks with the raster but `delta` does not; JPEG ringing (166 tokens vs 105 at q75) `[M]` |
| T10 | mask.ts:73 | `inkMask`: 8th percentile clamped 90–170 | long comment | not on the production plan path (only when `inkThreshold` is passed) |
| T11 | bands.ts:65,119,136,146,181,191,193,195 | minThickness 5, maxThickness 40, minLength 24 (`min(…,12)` for pieces), maxGapFraction 0.45, maxGapPx 90, axisTol 3, merge thickness tol `max(3, 0.5h)`, overlap ≥ 50 % | comments | TW (< 5 px), TM (> 40 px), HW, SP; gap 90 px absolute `[C]` |
| T12 | extract.ts:101,104–107 | survey 6/40/24; upper-quartile thickness; `outerPx < 3 ⇒ undefined`; **`PLAN_OUTER_WALL_M` 0.15–0.8 m** | comment (15 cm timber … 75 cm rubble) + `scale-plausibility.test.ts` (synthetic) | TW (10–12 cm), stone > 0.8 m; cannot discriminate ±12 % (e-OZE 0.44 vs 0.50 m both pass) `[M]` |
| T13 | layout.ts:142,213,215–217 | survey 6/40/24; fallback 12 px; second pass min `max(3, 0.45·wallPx)`, max `max(6, 1.9·wallPx)`, minLength `max(8, 1.6·wallPx)` | comment ("two passes") | two thickness classes (outer 20 px, partitions 7 px on e-OZE sit at the 0.45× edge `[M]`), HW, TM+TW mixes `[C]` |
| T14 | plan-decomposition.ts:741 (also layout.ts:222) | long band ≥ **2.5×wallPx** | comment | exterior wall broken by wide glazing (pieces < 2.5 t), SP `[C]` |
| T15 | plan-decomposition.ts:791,805 | `near` margin **0.35** of chain span; `held ≥ loose` | comment (title block/logo) | degenerate chain frame `[M]` (e-OZE), 2D `[C]` |
| T16 | plan-decomposition.ts:859 | envelope ≥ 4×wallPx per axis; snap gap = wallPx (`:845`) | comment | none observed; TM (large wallPx) `[C]` |
| T17 | plan-decomposition.ts:711–716 | end-segment floor 0.5× shortest read segment | comment | frames starting with a longer unresolved gap `[M]` (kept the 30-px UNRESOLVED end on e-OZE) |
| T18 | plan-decomposition.ts:1213 | band counts only if ≥ **60 %** of its run is inside the extent | comment (north arrow, title block) | any wrong/narrow extent ⇒ all walls dropped `[M]`; 2D `[C]` |
| T19 | plan-decomposition.ts:277–283 (grid) | `snapPx 5`, `minBandCoverage 0.18`, `minCellM 0.45` (cells), `fallbackWallPx 12`, `minLinePx 18`; `:419–420` window `max(5, 0.75t)`, faces `max(5, 0.35t)`; `:326–327` 2.5t, gap `max(3, 1.2t)` | comments | absolute `snapPx 5` on SP/TM `[C]` |
| T20 | layout.ts:309–318 | `chooseBasePlan` weights +2 registration, +2 envelope, +1 non-weak, `min(1.5, Σbandlength/2000)`, +0.75 GROUND, −2·rmsM; ties by frame id | none | SP (2000 px absolute), attic-only dimensioned; near-vacuous for one plan/storey `[C]` |
| T21 | layout.ts:198–247 | one copy per storey, first with a non-null extent wins (`break`) | comment ("largest dimensioned copy") | AT/SP/DIM ordering; failed decomposition never tries the next copy `[M]` |
| T22 | ocr.ts:114 | `minGlyphHeight 6`, `maxGlyphHeightFrac 0.06`, `inkDelta 8`, **`minGlyphScore 0.55` — declared, defaulted, never read** | comment says "token is not trusted" | SP (cap 8–13 px `[M]`); dead gate `[M]` |
| T23 | ocr.ts:43–44 | cell 12×16 | none | glyphs < ~8 px cap (400-px copies: median H token height 8–12 px) `[M]` |
| T24 | ocr.ts:934–958 | components `minPixels 3`; marks: h < 6 and ≥ 2, w ≤ 2.5h, fill ≥ 0.35; glyph: w ≤ 4h, fill ≥ 0.18 | comments | SP, HW |
| T25 | ocr.ts:587–590,613 | token grouping gap ≤ 0.9h, ≥ −0.6h, y-overlap ≥ 0.35, mark gap ≤ 0.55h | comments | wide-tracked sheet type `[C]` |
| T26 | ocr.ts:717–718 | shear −0.36…+0.36 step 0.06 (±20°) | comment | back-slanted or > 20° italics `[C]` |
| T27 | ocr.ts:751–766 | `expected = max(3, 0.55h)`, cut if width ≥ 1.45·expected, `count = round(w/expected)`, window ±0.3·expected, deepest column | long comment | round adjacent digits (`00`, `88`, `60`): `1600→1601` `[M]`; narrow `1` before round glyphs |
| T28 | ocr.ts:499,513–514,527–530,549,551 | size prior 1.6/1.2 (floor 0.05), aspect prior 0.95 (floor 0.2), hole penalty ×0.5, hole position 2.2/1.2 (floor 0.35), alternatives top 3 with score > 0.2, `confidence = best/(best+runnerUp)` | comments | other typefaces (prototypes are plain 6×12 bitmaps `font.ts:20–33`), MM `[C]` |
| T29 | ocr.ts:813,833,845 | merit = score·conf·glyphs; **turn switch ×1.1**; clash IoU > 0.4 or containment > 0.6 | comments; `ocr.test.ts:42` (synthetic) | RT, GF `[M]` (root cause of Section 2.2) |
| T30 | parse.ts (decimal/whole/callout regexes) | whole number **2–4 digits = cm**; decimal ≤ 3+3 digits = m; level ±(1–2).(2); angle ≤ 3 digits < 180; callout 2–4/2–4 | header comment | MM (`16000`), feet-inches, `m²` room areas parsed as lengths `[M]` |
| T31 | parse.ts:130–172 | lattice limit 24; single substitutions from top-3 alts; pairs on two least-decided glyphs ×0.9 | comment | reads whose true digit is not among the top-3 (`1600` absent) `[M]` |
| T32 | dimension-lines.ts:55,68,92,119,148,163,165,190 | minLength 40, maxThickness 3, markReach 7, markExcess 2, maxGap 2, spread 2, **fill > 0.9**, ≥ 2 ticks, row merge adjacency 1 / overlap 0.6, tick merge 2 px | long comment | dashed/dotted dimension lines (fill), TM at high res (thick rules), SP (40 px = 10 % of a 400 px plan), arrowhead-only ticks `[C]` |
| T33 | chains.ts:99–100,111,127 | `chainsFromObservations` tolerances 6 px, `minTicks 3`, tick aspect 1.5 — **dead code** (no caller) | comment | n/a |
| T34 | chains.ts:196,218 | token↔chain offset ≤ **2.2 text heights**; lattice per token | comment | tightly stacked chains, callout digits near chains (an 8-px callout digit `155` became an anchor `[M]`) |
| T35 | chains.ts:326 | vote weight `conf·conf·px/50` | comment | linear-in-px OK; substitution not priced `[M]` |
| T36 | chains.ts:368 | span must be centred within 0.3·length | comment | numbers printed against one end `[C]` |
| T37 | chains.ts:395 | **corroboration ×(1 + 0.5(chains−1))**, weight-blind | comment ("two chains that agree…") | shared house style, same-token substitutions; flips e-OZE `[M]` |
| T38 | chains.ts:427,497,588 | distinct ratio 3 %; top-8 kept | comment | winner only reaches downstream |
| T39 | chains.ts:538 | per-axis refit within ±5 % (log) | comment | genuine anisotropy > 5 % (crop) |
| T40 | chains.ts:580 | replacement scale needs ≥ 3 numbers on ≥ 2 chains and ≥ 3 % apart | comment | SP (Kosaćce 550 took 2.5285 for a copy whose true scale is ≈ 3.7 `[M]`) |
| T41 | chains.ts:616–617 | **tolerance 2.2 px**, `minPixelLength 6` | comment (pixel not percent) | ±5 % on 42 px ⇒ lattice fits anything `[M]` |
| T42 | chains.ts:690,697,722,723 | skip ≤ 3 ticks; empty span 0.02; `0.7^skipped · 0.45^subs`; unreconcilable **−0.5** | long comment | forced correction of printed values `[M]` |
| T43 | chains.ts:787,800,806 | confidence 0.85^subs·(1−miss/2tol) (floor 0.3); derive blanks if `residual ≤ tol/2`; derived confidence 0.4 | comment | n/a |
| T44 | registration.ts:102,124,166 | count-first inlier set, **tolerance 3 px**, confidence 0.5 (+0.35 one axis) + 0.08·min(5,n) − min(0.3, 2·rms) capped 0.95 | comment | many correlated forced anchors ⇒ 0.83 on a wrong scale `[M]` |
| T45 | extract.ts:272,579,596,607 | tolerance 2.2; orphan tokens score ≥ 0.25; **anchors ≥ 2** (any axis mix); `flipY: true` constant; origin = first tick of the longest chain (`originFor`, `:814`) | comments | one-anchor axis accepted `[M]`; FT (flip/origin are conventions, not detected) `[C]` |
| T46 | extract.ts (datum/callout attach) | distances `max(10, 1.6h)`, `max(14, 2.5h)`, `3h`; unattached confidence ×0.35/0.3 | comments | absolute-px floors on SP `[C]` |

Dead/unenforced: `minGlyphScore` (T22), `chainsFromObservations` and `chainTokens` (T33; `grep` shows no callers outside `chains.ts`).

---------------------------------------------------------------------------------------------------------------------------------------------

## 5. Q5 — metamorphic image test: measured

Harness `B-work/meta.ts`: per perturbation, on the 853 DIMENSIONED copy. Scale is normalised by the resize factor (a correct answer prints the same number; truth: e-OZE 2.222, Kosaćce 2.406, Marcówki 2.643).
Extent is divided by the factor (truth: e-OZE 720×342, Kosaćce ≈ 697×524, Marcówki 456×552).

| perturbation | e-OZE scale / extent | Kosaćce scale / extent | Marcówki scale / extent |
| --- | --- | --- | --- |
| identity | **2.501** / 720×69 | 2.406 / 697×524 | 2.642 / 456×552 |
| resize 0.75× | 2.221 / 720×343 | **1.449** / 690×256 | **1.955–2.033** / 653×575 weak |
| resize 1.25× | 2.222 / 720×342 | 2.406 / 696×524 | 2.635 / 456×552 |
| JPEG q75 | 2.220 / 721×343 (tokens 105 → 166) | 2.408 / 696×527 | 2.646 / 458×544 |
| contrast ×0.85 | **1.390** / 716×730 weak | 2.406 / 697×524 | 2.642 / 456×552 |
| contrast ×1.15 | **1.389** / 720×393 weak | 2.406 / 697×524 | 2.643 / 457×552 |
| grayscale | 2.224 / **720×51** | 2.406 / 690×524 (bands 84 → 43) | 2.642 / 456×552 |
| pad +2,+2 / crop −2,−1 | identical to identity | identical | identical |

Stage-by-stage behaviour:
- **mask/bands**: band count moves −40 %/+10 % with harmless changes (e-OZE 45 → 26 at 0.75×, 32 at contrast 1.15; Kosaćce 84 → 43 on grayscale, because `min(R,G,B)` no longer promotes coloured pixels); `wallPx` 15.5 / 15.1 / 20 / 15 / 15.5 / 17 (should be 11.6 / 19.4 at 0.75× / 1.25×: at 0.75× it did not scale). Absolute-px constants (T02, T11, T13) mean the *same wall* changes class with resolution.
- **OCR**: 0.75× → 169 tokens, 1.25× → 143 (identity 105); JPEG q75 → 166 (ringing tokens). The turn ratio moves 0.83 → 0.94 / 1.13 / 0.99 / 0.80 / 0.82 / 0.86 around the 0.909/1.1 switch, so the *retained set* of vertical numbers changes with every perturbation. At natural resolutions 550/400 px (median token height 11/8 px vs 14–17 at 853) the overall label is not read at all and the pooled scale is wrong on 6 of 6 sub-853 copies of e-OZE/Kosaćce/Marcówki when the copy is taken to be the same crop as the 853 copy (visibly true for e-OZE and Kosaćce; assumed for Marcówki) (e.g. Kosaćce 550: 2.529 vs 3.73 expected from the 853 copy; Kosaćce 400: 1.678 vs 5.13; e-OZE 550: 2.222 vs 3.45; e-OZE 400: 1.525 vs 4.74).
- **chains/vote**: pure vote flips (contrast: `1001` seeded 1.390 with a 0.12-weight `21` over a 14-px span; margin 9.16 / 8.94 / 8.41 across three candidates). This stage needs a margin, not a winner.
- **registration/extent**: follow the vote (grayscale keeps the scale but loses the vertical chains ⇒ 720×51 strip).
- **grid**: not run in isolation; qualitatively inherits chain segment ends and band axes (`gridLines`, T19) so it moves with both.
- **pad/crop 1–2 px**: identical everywhere — no translation dependence (good, keep as a regression test).
Where confidence should degrade rather than flip: (1) the turn decision — a continuous log-ratio kept as per-token prior, both readings retained; (2) the scale — margin to runner-up (`score/next`) as the frame's confidence, and a "hypotheses" flag when margin < 1.25; (3) the extent — chain-frame vs wall-frame containment/IoU; (4) registration confidence must depend on the share of READ vs CHAIN_CORRECTED anchors and on the margin above; (5) token confidence is a `min` over glyphs (`ocr.ts:1036`) — a blunt but graded quantity; keep.
Proposed permanent test (fast, ~1 s per case): the seven perturbations above on every plan fixture; assertions: normalised scale within 1.5 %, extent within 5 %, `weak` flag never flipping from false to true, `top-1 hypothesis stable OR margin < 1.25`. Today it would fail 5 of 21 cells on scale (e-OZE identity, contrast ±15 %; Kosaćce and Marcówki at 0.75×) and 6 of 21 once extent is asserted (e-OZE grayscale = 720×51 strip).

---------------------------------------------------------------------------------------------------------------------------------------------

## 6. Function capability inventory

Table A (what it is) / Table B (how it fails). Row ids R01–R35. Deterministic: all rows YES (pure functions of bytes; sorting is explicit). Performance measured on 853 px, Node 22 desktop
(`t15`): `inkChannel` 11 ms, `adaptiveInkMask` 30 ms, `readNumbers` 3 turns 544 ms (H only 132 ms), `findDimensionLines` 146 ms, `runLengthBands` survey 114 ms, `solveFrameChains` 13 ms — the whole reading of one plan frame is ≈ 1 s, so reading all 4 plan copies or retaining K hypotheses is cheap next to the 164–193 s metric pass; the phone (Node 18, arm64) is slower by an unmeasured factor.

### Table A
| id | file:line | symbol | input → output | assumptions | thresholds |
| --- | --- | --- | --- | --- | --- |
| R01 | source-analyzer/src/prepare.ts:85 | `prepareFromRaster` | Raster → Prepared (ink, luma, mask, edges, axis/hough/thin segments in frame px) | ink = min(R,G,B); local-contrast mask; downscale ≤ 2200 | T01, T02, T09 |
| R02 | source-analyzer/src/analyze.ts:88 | `analyzeSourcePackage` | SourcePackage + bytes → ObservationGraph | routes by roles only; one extractor per role; throws if decoded size ≠ sealed size (`:136`) | none |
| R03 | source-analyzer/src/extractors/plan.ts:113 | `extractPlan` | Prepared → WALL_BAND / OPENING_INTERVAL / chain families / stair | walls = axis bands with edges; chains = ticks outside the outline; no OCR | T03–T07 |
| R04 | source-cv/src/raster.ts:78 | `inkChannel`, `toGray`, `downscaleGray` | Raster → Gray | min(R,G,B) is ink | T08 |
| R05 | source-cv/src/mask.ts:366 | `adaptiveInkMask` (+`localMean`) | Gray → Mask | darker than neighbourhood by 8 or ≤ 110 | T09 |
| R06 | source-cv/src/bands.ts:106 | `runLengthBands` | Mask → Band[] (axis, thickness, segments) | walls are solid runs within [min,max] thickness, long | T11 |
| R07 | source-cv/src/bands.ts:242 | `dominantBandThickness` / `bandThicknessQuantile` | Band[] → wall px | length-weighted median (or quantile) | none |
| R08 | source-cv/src/lines.ts:245,351,504 | `axisAlignedSegments`, `houghSegments`, `parallelFamilies` | Mask → Segment[] / families | straight strokes; families seeded on first member | T02 |
| R09 | source-metrics/src/ocr.ts:895 | `readNumbers` | Raster → tokens ×3 turns, deduped | digits from plain 6×12 bitmaps; cap ≥ 6 px | T22–T24 |
| R10 | source-metrics/src/ocr.ts:812 | `dedupeOrientations` | tokens ×3 → tokens | **one turn per sheet, by summed merit** | T29 |
| R11 | source-metrics/src/ocr.ts:927 | `readNumbersFromInk` (+`groupTokens`) | ink → tokens (H) | italic ≤ 20°, glyphs touch | T24–T26 |
| R12 | source-metrics/src/ocr.ts:681,736 | `estimateShear`, `segment` | token bitmap → cells | even pitch, deepest column | T26, T27 |
| R13 | source-metrics/src/ocr.ts:518 | `classifyCell` | cell → char + 3 alternatives | prototypes plain sans; topology | T28 |
| R14 | source-metrics/src/parse.ts:53 | `parseNumber` | string → kinds | 2–4 digit int = cm, decimal = m | T30 |
| R15 | source-metrics/src/parse.ts:130 | `readingLattice` | token → ≤ 24 readings | true digit within top-3 alternatives | T31 |
| R16 | source-metrics/src/dimension-lines.ts:131,116 | `findStraightRuns`, `findDimensionLines` | Mask → lines with ticks | thin (≤ 3 px), solid (fill > 0.9), ticks straddle | T32 |
| R17 | source-metrics/src/chains.ts:56 | `chainsFromLines` | lines → RawChain[] (≥ 2 ticks) | tick = measurement point | T32 |
| R18 | source-metrics/src/chains.ts:195 | `assignTokens` | chains + tokens → ChainToken[][] | nearest chain, one number per interval | T34 |
| R19 | source-metrics/src/chains.ts:307,353 | `proposalsOf`, `spansFor` | chain tokens → (span, reading, scale) proposals | adjacent ticks only in the vote; centred number | T35, T36 |
| R20 | source-metrics/src/chains.ts:390,481,426 | `supportFor`, `voteScale`, `scaleCandidates` | proposals → scale votes | ±2.2 px; one per token; chains corroborate | T37, T38, T41 |
| R21 | source-metrics/src/chains.ts:570 + extract.ts:103 | `decideScale`, `planScalePlausibility` | winner + walls → scale or none | outer wall 0.15–0.8 m | T12, T40 |
| R22 | source-metrics/src/chains.ts:611 | `solveFrameChains` (+`refineAxis`) | chains + tokens → scaleX/Y, solved chains | one scale per frame | T39, T41 |
| R23 | source-metrics/src/chains.ts:662 | `solveChain` | chain + tokens + scale → segments (READ/CHAIN_CORRECTED/DERIVED) | numbers are malleable, spans and scale fixed | T42, T43 |
| R24 | source-metrics/src/extract.ts:269 | `extractMetricEvidence`, `buildChain`, `originFor`, `scaleConflicts` | graph + rasters → MetricEvidenceSet | frame-local; conflicts only within one asset | T45, T46 |
| R25 | source-metrics/src/registration.ts:74,123 | `fitAxis`, `registerFrame` | anchors → affine per axis | axis-aligned; axes fitted separately | T44 |
| R26 | reconstruction/src/layout.ts:177 | `readPlans` | graph + metrics → one PlanReading per storey | largest DIMENSIONED copy, first success | T13, T21 |
| R27 | reconstruction/src/layout.ts:309 | `chooseBasePlan` | plans → one | additive score | T20 |
| R28 | reconstruction/src/plan-decomposition.ts:698 | `dimensionedExtent` | chains → rect or null | widest READ chain per axis is the building | T17 |
| R29 | reconstruction/src/plan-decomposition.ts:774 | `planExtent` | chains + bands → rect, weak | walls vote inside a window scaled from the chain frame | T15 |
| R30 | reconstruction/src/plan-decomposition.ts:741,744 | `longBands`, `axisBox` | bands → long bands / box from axes | ≥ 2.5×wallPx is a wall; both orientations needed | T14 |
| R31 | reconstruction/src/plan-decomposition.ts:827 | `walledEnvelope` | bands + grid → envelope or null | outer axes ± half wall, snapped | T16 |
| R32 | reconstruction/src/plan-decomposition.ts:354,477 | `gridLines`, `thinLines` | chains + bands → grid | chain breaks + band axes, snap 5 px | T19 |
| R33 | reconstruction/src/plan-decomposition.ts:1204–1214 | 60 % filter in `decomposePlan` | bands + extent → inside bands | walls lie inside the extent | T18 |
| R34 | reconstruction/src/plan-decomposition.ts:309 | `bandWallThickness` | bands → wall px | one wall class | T13 |
| R35 | source-metrics/src/extract.ts:597 | registration call site | anchors → registration | ≥ 2 anchors of any axis mix | T45 |

### Table B
| id | evidence consumed | evidence ignored | alternatives (approaches) | failure codes / gaps it can trigger | alternate hypotheses kept? | cost | genericity risk | rec |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R01 | pixels, tone steps | colour role (text vs foliage), scan skew | per-channel ink; ink+chroma split | undecodable/size mismatch throw | no | ~1 s/frame | MEDIUM | KEEP, INSTRUMENT |
| R02 | asset roles, cached bytes | filename by design | — | `NOT_ATTEMPTED`, `MISSING` unresolved | no | dominates observation stage (33–122 s) | LOW | KEEP |
| R03 | strokes, mask | printed numbers (none read here), body vs sheet | reuse `runLengthBands` (second wall definition exists downstream) | none terminal | no | low | MEDIUM (two wall detectors with different threshold families) | REFACTOR (unify or drop) |
| R04 | RGB | hue | keep `min` for lines, add saturation-aware OCR ink | — | no | 11 ms | MEDIUM (GF) | KEEP |
| R05 | local mean | — | multi-scale radius | — | no | 30 ms | MEDIUM | KEEP |
| R06 | mask runs | hatch/outline walls | outline-pair detection; hatch-fill morphology | `PLAN_NO_WALLED_ENVELOPE`, `NO_EXTENT` | no | 114 ms | HIGH (TW/HW/TM) | INSTRUMENT (report thickness histogram), then REFACTOR |
| R07 | thickness×length | class structure | 2-cluster split (outer vs partition) | — | no | ~0 | MEDIUM | KEEP |
| R08 | edges/ink | — | — | — | no | ~0.3 s | LOW | KEEP |
| R09 | 3 rotations | colour, chain agreement | keep both readings per ink | none | **no** (drops one turn) | 544 ms | **HIGH** | REFACTOR |
| R10 | all-token merit sum | number parseability, chain agreement, mirror pairs | per-token lattice with turn as substitution; convention prior | silent loss of all vertical numbers (e-OZE) | no | ~0 | **HIGH** | REPLACE |
| R11 | ink components | — | — | none | n/a | 132 ms/turn | MEDIUM | KEEP |
| R12 | column profiles | shape (hollow centres) | try count ±1 cut sets scored by classifier | mis-read `1600→1601` | no | small | HIGH | REFACTOR |
| R13 | bitmap overlap+holes | other typefaces | more prototypes; learned per-sheet font | low confidence tokens | top-3 alternatives yes | small | MEDIUM | KEEP |
| R14 | grammar | units (mm, ft), `m²` | add AREA kind, mm rule | drops unknown strings | n/a | ~0 | MEDIUM (MM) | REFACTOR (add kinds) |
| R15 | glyph alternatives | segmentation alternatives | segmentation × substitution lattice | true digit absent | yes (24) | ~0 | MEDIUM | KEEP, extend |
| R16 | thin solid runs | dashed leaders | run merging with gap fill | zero chains ⇒ no scale | no | 146 ms | MEDIUM | KEEP |
| R17 | ticks | — | — | — | no | ~0 | LOW | KEEP |
| R18 | position + orientation | text height class (callout digits 8 px vs 17 px) | height-class filter | callout digits become dimensions `[M]` | no | ~0 | MEDIUM | REFACTOR |
| R19 | span geometry | spurious ticks (door leaf/wall edge crossing an arrow) | `maxSkip>0` with a price in the vote | wrong sub-span adopted | no | ~0 | MEDIUM | INSTRUMENT |
| R20 | proposals | independence, substitution cost | additive corroboration; emit K hypotheses | scale flip; `scale-implausible` gap | **top-8 computed, 1 emitted** | ≤ 13 ms | **HIGH** | REFACTOR (V1 + ScaleHypothesis[]) |
| R21 | wall thickness | published areas/footprint | use as scores over hypotheses | `AMBIGUOUS` gap, no scale | 1 replacement max | ~0 | MEDIUM | REFACTOR (hard → score) |
| R22 | all chains | cross-copy, X/Y isotropy check | per-axis overall chain check | no scale ⇒ chains unread | no | 13 ms | HIGH | REFACTOR |
| R23 | scale + lattice | printed value that does not fit (no null hypothesis) | leave UNRESOLVED with rejected list; correct spans/ticks instead of digits | inflated READ/CHAIN_CORRECTED counts | DP optimum only | ~0 | **HIGH** | REFACTOR |
| R24 | frames | cross-copy consistency, published facts | add `SCALE_DISAGREEMENT` across assets of one plan | conflicts empty on e-OZE (`conflicts: 0`) although four copies exist | no | — | MEDIUM | INSTRUMENT |
| R25 | anchors (incl. CHAIN_CORRECTED) | anchor independence, single-anchor axes | READ-only anchors; isotropy prior | `NO registration` only when no scale | no | ~0 | **HIGH** | REFACTOR |
| R26 | first copy with extent | other copies | evaluate all copies, score by envelope/area/agreement | `NO_EXTENT`, `PLAN_NO_WALLED_ENVELOPE`, `PLAN_LAYOUT_REJECTED` | **no** | 1 frame | **HIGH** | REFACTOR |
| R27 | additive score | published footprint | area-consistency term | wrong base among storeys | no | ~0 | MEDIUM | REFACTOR |
| R28 | READ chains only | walls | union with wall frame as hypothesis | `NO_EXTENT` | no | ~0 | HIGH | REFACTOR |
| R29 | bands in `near` | bands outside `near` | count all, measure overlap with wall body | strip frames accepted | no | ~0 | **HIGH** | REFACTOR |
| R30 | length/orientation | connectivity | connected heavy body | none | no | ~0 | MEDIUM | KEEP |
| R31 | outer axes | — | — | `PLAN_NO_WALLED_ENVELOPE` (null) | no | ~0 | MEDIUM | KEEP, downgrade to weak |
| R32 | chains, bands | — | — | grid poverty on AT copies | no | ~0 | MEDIUM | KEEP |
| R33 | extent | band connectivity | soft weight instead of discard | drops all walls on wrong extent | no | ~0 | HIGH | REFACTOR |
| R34 | bands | — | — | — | no | ~0 | MEDIUM | KEEP |
| R35 | anchors | — | — | one-axis registration flagged only in a note | no | ~0 | MEDIUM | REFACTOR |

---------------------------------------------------------------------------------------------------------------------------------------------

## 7. Assumption register entries

**ASSUMP-IMAGE-001 — ink is `min(R,G,B)`.** Behaviour: any saturated colour is ink (`raster.ts:78–91`). Why: keeps red annotation and blue hatch visible. Evidence: header comment; measured downside: green vegetation makes long junk
OCR tokens (`1±±±…`, 19 glyphs) that decide the turn vote (Section 2.2); grayscale changes band counts 84 → 43 on Kosaćce. Violated by: GF, coloured poché. Soft. Decision: soften — separate OCR ink (exclude large low-fill chromatic blobs) from line ink.

**ASSUMP-IMAGE-002 — contrast mask radius = max/40, `delta 8`, `absolute 110`** (`mask.ts:366–372`). Evidence: comment. Violated by: SP (radius scales, delta does not), low-contrast scans. Soft. Keep, instrument (log mask ink fraction).

**ASSUMP-IMAGE-003 — plan rasters are large enough for numeric OCR (cap ≥ ~12 px).** Behaviour: OCR runs regardless (`ocr.ts:114`, `minGlyphHeight 6`). Evidence `[M]`: median token height 17/13/12 px at 853/550/400 (e-OZE) and 14/11/8 (Kosaćce);
the overall label is not read at 550/400 and the scale is wrong on 6/6 small copies. Soft. Decision: branch — refuse numeric readings below a legibility floor and say so (`MISSING`), rather than emit chain-fitted garbage; prefer the largest copy but never only one.

**ASSUMP-IMAGE-004 — the sheet is an unrotated, unskewed orthographic raster.** Behaviour: ticks perpendicular, registration axis-aligned (`registration.ts:1–10`). Violated by: scans/photos, slanted PDFs. Hard for registration by design. Keep, add a skew estimate (Hough angle already exists, `lines.ts:351`) and refuse instead of fitting.

**ASSUMP-ORIENTATION-001 — a sheet turns its vertical text one way, decided by summed OCR merit** (`ocr.ts:829–834`). Evidence: comment; test is synthetic (`ocr.test.ts:42`). Measured: wrong on e-OZE, coin-toss on the other sheets (numeric-pair wins 9–16 of 21–28). Violates: RT, GF. Soft. Decision: **remove the page-level merit vote**; keep both readings of each ink as alternatives (turn is one more lattice axis) with a convention prior (text reads bottom-to-top ⇒ CW pass) and let chain arithmetic decide.

**ASSUMP-ORIENTATION-002 — plan y grows downward, `flipY = true`, origin = first tick of the longest chain per axis** (`extract.ts:607,814`). Evidence: comment. Violates: FT (front-at-top is a property of the building, not detected here), sheets whose longest chain is not the overall chain (e-OZE origin (75,230) is right only because the overall V chain is the longest raw chain, though unread). Hard convention. Keep; carry the origin as a hypothesis with the frame.

**ASSUMP-SCALE-001 — one scale per frame, chosen by a single vote** (`chains.ts:611`). Measured: e-OZE 2.501/2.222/1.390 across perturbations of the same bytes. Soft. Decision: branch — emit top-3 `ScaleHypothesis` with margin.

**ASSUMP-SCALE-002 — agreement of different chains is independent corroboration** (`chains.ts:395`). Violated by: a weightless second member (0.12–0.45) earning ×1.5; same-token substitution lattices; correlated house style. Soft. Decision: additive, weight-proportional corroboration (V1); count tokens, not chains.

**ASSUMP-SCALE-003 — a fixed 2.2 px tolerance is right for every span** (`chains.ts:616`). Long spans: excellent (720 px ⇒ ±0.3 %); short spans: ±5 % lets the lattice fit any scale `[M]`. Soft. Decision: keep tolerance for voting, but forbid CHAIN_CORRECTED evidence from being used as evidence for the scale that produced it.

**ASSUMP-SCALE-004 — wall thickness 0.15–0.8 m discriminates scales** (`extract.ts:101`). Evidence: comment + synthetic test. Measured: cannot separate 2.22/2.50 (0.44/0.50 m) or any two scales within a factor ~5. Soft. Decision: keep as a coarse prior; add published footprint/room areas as the discriminating gates (Section 1.4).

**ASSUMP-SCALE-005 — two axes are fitted independently and a single anchor suffices per axis** (`registration.ts:73–166`, `extract.ts:596`). Measured: e-OZE Y = one anchor (`100`, 38.5 px), anisotropy 1.038 accepted, confidence 0.83. Violated by: any sheet whose Y overall chain is unread. Soft. Decision: anisotropy > 2 % ⇒ isotropic refit + flag; a single-anchor axis is "assumed".

**ASSUMP-SCALE-006 — each plan copy is self-sufficient; no cross-copy scale check** (`extract.ts:836`, only variants of one asset are compared). Measured: four copies of one ground plan give 2.2235 / 2.501 (853 DIM/AREA) and 2.222 / 1.525 (550/400) where the pixel ratios require 3.45/4.74 for the smaller copies; `conflicts: 0`. Soft. Decision: add a cross-asset ratio check (pixel-size ratio × scale) and use it as a score.

**ASSUMP-DIMENSION-001 — a tick pair is what a number measures; the vote only uses adjacent ticks, the DP allows ≤ 3 skipped** (`chains.ts:353,690`). Violated by: interior arrows crossed by door leaves/wall edges (e-OZE: a 276-cm arrow split into 52-px sub-spans). Soft. Decision: price `maxSkip>0` in the vote; leave un-fitted tokens UNRESOLVED.

**ASSUMP-DIMENSION-002 — a number near a chain belongs to it** (`chains.ts:196`, 2.2 text heights). Violated by: opening-callout digits (8-px `155` next to a chain became anchor `125`). Soft. Decision: text-height class filter (chain numbers are the sheet's dominant height class; measured 16–17 px vs callout 8 px).

**ASSUMP-DIMENSION-003 — a printed number may be replaced by the lattice reading that fits** (CHAIN_CORRECTED, `chains.ts:722–723,780`). Measured: printed `320/276/276/180` became `150/136/126/104`. The module header says "never invent a value to make a chain close"; the DP's −0.5 vs +0.46 pricing invents. Soft. Decision: an unresolved span is better than a corrected one below a confidence floor; CHAIN_CORRECTED never anchors registration.

**ASSUMP-DIMENSION-004 — 2–4 digit integers are cm, decimals are m** (`parse.ts`). Violated by: MM sheets (`16000`), `m²` labels parsed as metres. Soft. Decision: add units/kinds.

**ASSUMP-DIMENSION-005 — the widest READ chain per axis is the building's extent** (`plan-decomposition.ts:698`). Violated by: an axis whose overall chain is unread (e-OZE) or a detail chain being the only read one. Soft. Decision: branch — chain frame is one hypothesis, wall frame another.

**ASSUMP-WALL-001 — walls are solid ink runs 6–40 px thick, refined to 0.45–1.9× the dominant thickness** (`layout.ts:142,213–217`, `bands.ts:65`). Violated by: HW, TW, TM, mixed classes (e-OZE partitions at 7 px vs outer 20 px sit exactly at the 0.45×15.5 = 7 px lower edge `[M]`). Soft. Decision: report the thickness histogram (INSTRUMENT), then two-class wall model.

**ASSUMP-WALL-002 — one dominant wall thickness** (`bandWallThickness`, `plan-decomposition.ts:309`). Soft, keep with the class split above.

**ASSUMP-WALL-003 — the chain frame is the building; walls may only object inside a window scaled from it** (`plan-decomposition.ts:791–805`). Measured: window blind to 59 % of the long-wall length; unanimity reported. Soft. Decision: refactor per Section 2.3.

**ASSUMP-WALL-004 — a band belongs to the building only if its axis is inside the extent and ≥ 60 % of its run** (`plan-decomposition.ts:1204–1214`). Violated by any wrong or narrow extent (drops all walls: 0/45). Soft. Decision: weight, don't discard.

**ASSUMP-WALL-005 — one plan copy per storey suffices, the first that yields an extent** (`layout.ts:198–247`). Measured: four copies give four different outcomes (Section 5 + orchestrator replay). Soft. Decision: read all, score, retain runner-up.

**ASSUMP-TEST-001 — synthetic fixtures stand for real sheets.** `ocr.test.ts:42` and `scale-plausibility.test.ts` use drawn rasters; none contains foliage, callout circles, a 4-digit label of two round glyphs, or a perturbation suite. Soft; add the metamorphic suite (Section 5).

---------------------------------------------------------------------------------------------------------------------------------------------

## 8. Single-hypothesis lock-in points (and whether top-N is cheap)

| lock-in | where | measured consequence | keep top-N cheaply? |
| --- | --- | --- | --- |
| Plan copy per storey | `layout.ts:198–247` (`break`) | 853 DIM read ⇒ strip; 853 AREA/550/400 never tried | **Yes**: ≈ 1 s/frame; score each by envelope present, chain-vs-wall frame agreement, footprint vs published, cross-copy ratio |
| OCR turn | `ocr.ts:829–834` | loses every vertical number on e-OZE | **Yes**: keep both readings as alternatives (already computed) |
| Segmentation of a token | `ocr.ts:736–790` | `1600 → 1601`, `1600` not in lattice | Yes: cut sets for `count−1, count, count+1`, scored by the classifier |
| Scale | `chains.ts:611`, `extract.ts:305` | 3 answers for identical bytes | **Yes**: `scaleCandidates` already exists (13 ms) |
| Span of a number | `chains.ts:353` | 52-px sub-span for a 276-cm arrow | Yes: bounded (`maxSkip ≤ 3`) |
| Dimension interpretation (printed vs corrected) | `chains.ts:722` | printed values overwritten | Yes: keep rejected list as alternatives (already in `SolvedSegment.rejected`) |
| Extent/frame | `plan-decomposition.ts:774` | 720×68 strip | **Yes**: chain frame and wall frame as two hypotheses, ~0 cost |
| Origin/flip | `extract.ts:607,814` | convention only | Yes, but downstream (orientation) |
| Wall thickness | `layout.ts:213` | one dominant value | Yes: two-class |
| Grid | `gridLines`/`thinLines` | inherits the above | Recomputed per hypothesis (cheap) |

---------------------------------------------------------------------------------------------------------------------------------------------

## 9. Hard versus soft (terminal gates I audited)

Should become **scores / late validation**: `decideScale` plausibility veto (`chains.ts:570`); `anchors.length >= 2` registration refusal (`extract.ts:596`) → emit low-confidence hypothesis; `readPlans` `NO_EXTENT` skip and first-success `break` (`layout.ts:222–247`); `walledEnvelope == null` as a terminal `PLAN_NO_WALLED_ENVELOPE` (fall back to the weak wall frame); the 60 % band filter (`plan-decomposition.ts:1213`); the dimensioned-extent floor (`:711`); `MIN_MASS_WALL_FRACTION`-like fractions (layout.ts:151) once hypotheses exist.
Must **stay hard**: decoded size equals sealed size (`analyze.ts:136` throw); byte-hash/version keys; determinism (sorting, `round6`, `stableId`); a READ label must mean substitutions = 0 (keep the label honest); "CHAIN_CORRECTED never anchors"; registration provenance fields; canonical-model invariants (out of scope).

---------------------------------------------------------------------------------------------------------------------------------------------

## 10. Failure taxonomy contributions

| code | class | evidence |
| --- | --- | --- |
| `PLAN_NO_WALLED_ENVELOPE` (e-OZE) | **algorithm assumption** (frame from chains is authoritative; window scaled from it; 60 % filter) triggered by an OCR turn decision | 0/45 bands inside; counterfactual OCR ⇒ 720×342 frame |
| `NO_EXTENT` skip (`layout.ts:222`) | algorithm assumption (needs a READ chain or two wall orientations) | not hit here; reachable on SP copies |
| `PLAN_LAYOUT_REJECTED / FOOTPRINT_AREA_WRONG` (Kosaćce AREA copy) | reading side: **source poverty** (4 READ chains, 8×6 grid) not error; the cause is downstream region merge | extent and scale identical to the DIM copy |
| `PLAN_LAYOUT_REJECTED` (e-OZE 550, Kosaćce 550/400) | **source limitation × algorithm assumption**: glyph cap 8–13 px, overall label unread, scale copied from an unrelated vote | Section 5 |
| `scale-implausible` unresolved (AMBIGUOUS) | algorithm assumption (single fixed plausibility window) | Kosaćce 550 took 2.5285 |
| `SCALE_DISAGREEMENT` (never fired on e-OZE) | **unimplemented semantic** across assets | four copies, `conflicts: 0` |
| `NOT_DECODABLE` | source/environment | — |
| unread `760`, mirrored vertical numbers | **algorithm defect** (not a source limitation: the CW pass read it) | Section 2.2 |
| `1601` vs printed `1600` | algorithm defect (segmentation), plus source (italic touching glyphs) | Section 2.2 |

---------------------------------------------------------------------------------------------------------------------------------------------

## 11. Top 5 findings

**F1 (critical) — page-level OCR turn vote discards correctly read vertical text (`ocr.ts:829–834`).**
Evidence: Section 2.2; e-OZE CW pass reads `760`/`112`/`200`, vote loses them (22.1 vs 26.7, one 19-glyph junk token = 2.84); across 11 plan copies whole-page ratios 0.83–1.09 straddle the ×1.1 switch; per-token numeric clashes are ~50/50 (10/11, 11/11, 9/13, 16/11), so OCR merit cannot decide a turn; counterfactual (H+CW only): scale 2.2235, extent 720×342, all four sides wall-supported.
Smallest generic change: delete the merit-sum vote; keep both readings of each ink as lattice alternatives (turn = one more substitution axis with a convention prior bottom-to-top) and let chain arithmetic and the overall-chain isotropy check pick; at most, apply a page-level decision when ≥ 8 numeric clashes agree ≥ 70 % (never on summed junk).

**F2 (high) — frame scale vote has no margin and a weight-blind corroboration bonus (`chains.ts:395`).**
Evidence: Section 1.2 — 8.94/8.41/7.22/6.89/6.82; winner = substituted reading of the same token + a 0.45-weight `100`; contrast ±15 % flips the same sheet to 1.39 through a 0.12-weight `21` on a 14-px span; V1 prototype (additive corroboration) makes e-OZE 7/7 across perturbations, Kosaćce/Marcówki unchanged.
Smallest generic change: `weight = Σw + 0.5·(Σw − leadChainΣw)`; emit `ScaleHypothesis[≤3]` with `marginToNext` (Section 1.4); treat margin < 1.25 as "hypotheses", not a fact; downstream independent gates (published footprint, cross-copy ratio, isotropy) select.

**F3 (high) — CHAIN_CORRECTED is manufactured agreement, and it anchors the registration (`chains.ts:690–723,780`; `extract.ts:765`; `registration.ts:102`).**
Evidence: printed `320/276/276/180` rewritten to `150/136/126/104`; 7 of 9 e-OZE anchors are CHAIN_CORRECTED with confidence 0.12–0.32; Y registered from a single anchor; anisotropy 1.038; confidence 0.83; window ±2.2 px = ±5 % on 42 px; +0.46 for a forced substitution vs −0.5 for an honest miss.
Smallest generic change: registration anchors = READ only; CHAIN_CORRECTED and DERIVED never contribute to a scale they were fitted to; add a null hypothesis to `spanOf` (merit 0 for "token not on this span"); anisotropy > 2 % ⇒ isotropic refit + flag.

**F4 (high) — `planExtent` accepts a degenerate strip and cannot see the walls that contradict it; the 60 % filter then deletes all walls (`plan-decomposition.ts:791–805,1213`).**
Evidence: Section 2.3 — `near` y 262–379; 59 % of long-wall length outside the window and uncounted; "1033 of 1033 px"; 0/45 bands inside; minor side 4.4×wallPx (other plans ≥ 21).
Smallest generic change: build the window from the union of the chain frame and the long-wall frame of the connected heavy body and count excluded walls as `loose`; reject frames with minor side < ~8×wallPx; on rejection use the existing `weak:true` wall-frame branch; turn the 60 % discard into a weight.

**F5 (high) — one plan copy per storey, first success wins, and small copies are read as if legible (`layout.ts:198–247`, `ocr.ts:114`).**
Evidence: e-OZE has four copies with four outcomes; 6 of 6 sub-853 copies give a wrong scale (cap 8–13 px, overall label unread); `readPlans` breaks as soon as any extent exists, even when `decomposePlan` later finds no envelope; `extract.ts:836` compares only variants of one asset (`conflicts: 0`).
Smallest generic change: read all copies (≈ 1 s each), keep the results as hypotheses ranked by self-consistency (envelope present, chain-vs-wall frame agreement, footprint vs published, cross-copy ratio scale×width), refuse OCR below a legibility floor and record `MISSING` with the floor value.

Additional (ranked lower, all measured):
- **F6** segmentation by column-ink valleys cannot separate hollow glyph centres from gaps (`ocr.ts:736–790`): `1600 → 1601`, no `1600` in the lattice; use a bounded cut-set search scored by the classifier.
- **F7** opening-callout digits (8-px text) are attached to chains and become anchors (`chains.ts:196`); filter by dominant text-height class.
- **F8** dead/unenforced controls: `minGlyphScore` (never read), `chainsFromObservations`/`chainTokens` (no callers); `PLAN_OUTER_WALL_M` cannot discriminate scales within ×5.
- **F9** absolute-px constants (T02, T09 `delta`, T11, T13, T19 `snapPx`) make the same wall change class with resolution (wallPx did not scale at 0.75×: 15.1 vs 11.6 expected).
- **F10** `parseNumber` reads `10,34` (an area in `m²`) as a 10.34-m length and never parses areas; the printed room areas (a strong, digit-independent scale constraint) are unused by the reading side.

---------------------------------------------------------------------------------------------------------------------------------------------

## 12. What would falsify "the analyzer is becoming generic"

The claim is falsified if, on plan rasters the code has never seen (a fresh third-party project, not Kosaćce/Marcówki/e-OZE/G2E), any of the following holds after the 005A changes:
(a) the normalised frame scale changes by > 1.5 % or the extent by > 5 % under **contrast ±15 %, JPEG q75, grayscale, 0.75×/1.25× resize** (today: 5 of 21 cells on three sheets fail on scale, 6 with extent; e-OZE alone yields 2.50, 2.22 and 1.39 for identical content);
(b) the answer differs between the copies of one drawing after scaling by their pixel ratio (today: e-OZE 853 vs 550/400 copies, Kosaćce 550/400);
(c) any threshold in T01–T46 must be changed to make the new sheet pass, or the "fix" for e-OZE (turn prior + additive corroboration) alters Kosaćce, Marcówki or G2E outputs (today V1 does not: 14 plan copies compared);
(d) `Partial`/hypothesis output shows a top-1 with margin < 1.25 that is nevertheless consumed as a fact by `readPlans`/`decomposePlan`.
Conversely the generic property to demonstrate: a sheet with the vertical overall chain unread, a colour-vegetation plan, and a 550-px copy each end in a *ranked hypothesis list with an explicit margin and a named falsifier*, never in a silent single answer or a terminal `PLAN_NO_WALLED_ENVELOPE` produced by a frame that nothing challenged.

---------------------------------------------------------------------------------------------------------------------------------------------

## Reproduction notes
Scripts (all read-only against the repo): `B-work/t2.ts` (OCR + dimension lines), `t3.ts`/`t4.ts` (per-turn passes and turn ratios on 11 copies), `t5.ts`/`t7.ts` (vote + counterfactual turns), `t9.ts`/`t10.ts` (extent, near-window, 60 % filter, counterfactual extent), `t8.ts`/`t12.ts` (all plan copies, baseline vs V1),
`meta.ts` (perturbations), `meta2.ts` (V1/V2/V3 × turn prior), `t13.ts` (segmentation of the `1600` label), `t16.ts` (edge-support test), `t17.ts`/`t18.ts` (turn-vote merit anatomy, pairwise clashes), `t19.ts` (CHAIN_CORRECTED anatomy), `t15.ts` (timings). Run as
`cd /home/user/BuildApp && node_modules/.bin/vite-node <script> [args]`; scratch copy `chains_x.ts` carries the `MODE` switch (`bonus: 'mult'|'add'`, `subPenalty`, `minSpan`). Limits of this audit: three sheets for the perturbation suite, no hatched-wall/timber fixtures were available (HW/TW rows are code-derived),
no phone runs (Node 22 desktop), the 3-of-4 "why the phone had one plan frame" question is outside my scope.
