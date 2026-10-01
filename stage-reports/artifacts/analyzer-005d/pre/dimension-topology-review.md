# 005D pre-review A — dimension graphics topology: which crossing marks are ticks

Reviewer A, read-only. Question: why a spurious mark became a tick and split the Azalia overall chain, and
which generic, measurable rule classifies crossing marks as TICK / QUESTIONABLE / REJECTED without demoting
real ticks. Every number below was measured on the decoded publisher raster (inkChannel + adaptiveInkMask,
exactly as `extract.ts`), on the base plan frame of each house. Scratch probes: `.cache/rev-a/` (gitignored);
feature dumps `/home/user/work005d/rev-a/feat/*.jsonl`. No drawing, crop or overlay left the work dir.

## 1. Findings

**P0-1 — The Azalia mark at x=204.5 is a watermark edge, and it passed both mark tests on binary ink alone.**
Frame `…86bef468f3-19006df9bc`, line H@645.5, t=2 px, from 66 to 641, fill 1.0. Line core grey 189 on paper
255 (line contrast Cl = 66). The 204.5 hit run is x=202…207 (6 positions):
- `crossThickness(reach 7, spread 2)` ≥ t + markExcess = 4 at every position 193…213 (8…11 rows at 202…207).
- `crosses()` needs one ink pixel on each side at d ≥ clear+1 = 3. Above: d=3…7, the diamond's left edge band,
  grey 211…231, run width 8–9 px. Below: only d=3…4 (y=649–650), grey 231…239, i.e. contrast 16–24
  (0.24–0.36·Cl). Those pixels are "ink" only because the adaptive mask flags anything ≥ 8 levels under its
  43×43 local mean (local mean there ≈ 248). Positions 193–201 fail (nothing below), 208–213 fail (nothing above);
  the six positions where both faint wings overlap form the "tick".
- Nothing compares the crossing ink with the line's own ink, its width with a stroke, or its support with the
  other side: one faint pixel per side and four mask rows are the whole contract.

**P0-2 — An unclassified mark is a mandatory boundary, so it outweighs the true span.** `chainsFromLines`
copies every mark into `ticks`; the solver discounts a span that skips a tick by 0.7. The label (box x 333–364,
centre 348.5) binds to B = [204.5, 633] (428.5 px, weight conf·8.57) and to A = [77, 633] (556 px, conf·11.12·0.7
= conf·7.78): B wins, a phantom DERIVED segment [77, 204.5] = 313.9 cm appears, and 1055/428.5 = 2.462 cm/px is
born. Centring says the opposite: the label sits 0.012·L from A's centre and 0.164·L from B's. On the 37
READ/CHAIN_CORRECTED spans of overall (exterior, neutral-ink) chains of the 8 dev houses the offset is
0.004–0.069; `spansFor` only requires ≤ 0.30, so B is admitted.

**P1-1 — The same failure exists on the dev houses; it is masked only because their labels are read.**
Marcówki V547 (the 100/510/750/100 chain, READ + CHAIN_CORRECTED): marks 290 (watermark band, peak contrast
0.37·Cl, width 8/7 px at t=1) and 784.5 (the line running into a grey fill; it is the chain's *end* mark;
the real end is 773). V568 (READ 1260): watermark marks 278.5 and 300.5 (0.18 and 0.25·Cl). Rarytasy G2E
H781 (overall, CC 1721 across three skipped marks): two dark-green plant symbols (186.5, 419.6; width 8–13 px,
chroma 44–50 on a neutral line) and a grey fill at 692 (0.64·Cl, width 11). These chains still read only
because their labels were read correctly and the binding/legacy correction skipped the marks (H781's single
reading spans all three); one more spurious mark, or a misread, and they split like Azalia.

**P1-2 — Near-duplicate marks 6.5–7.5 px from a real tick.** The hit merge joins positions ≤ 2 px apart, so
"duplicates 1–2 px apart" cannot exist as two marks; what exists are tails of a 45° slash plus adjacent text
or watermark, one reach away: Marcówki V547 221/228.5 and 735.5/742, e-OZE V24 230/236.5 (230 became the
chain's *end*). In every pair the extra mark is one-sided (support rows 1–2 of 6 on one side). Over the 9
frames: 3 such pairs on exterior reading chains (exactly those), 10 on interior reading chains, 57 on other lines.

**P2-1 — Extension support cannot be a gate at this resolution.** On the dev overall chains the slash ticks'
perpendicular stubs end inside or just past the mark reach (median continuation 7 px, p10 6 px; Azalia ends
9/8 px). Only 3 of 63 genuine exterior R/C marks continue straight > 9 px; 10 of 64 rejected marks do. A
wall-band edge within ±2 px along the line: 54/63 genuine exterior marks vs 24/64 rejected: corroboration, not
a gate (a dimension may end at an axis or an opening).

**P2-2 — Interior chromatic room-dimension chains are not tick chains.** Their arrowheads merge into the wall
they touch (Azalia V570 "582": the marks are walls 24 px wide, a crossing red chain, four black furniture
lines and three watermark edges; the arrowheads are never separate marks). Colour/shape reasons fire on most of
their marks, so on those chains such reasons must annotate, not reject. Positioning a wall stop at the wall
face instead of the band centre is outside this question.

**P2-3 — The line reference can degenerate** (Kosaćce H331: paper and line grey too close, contrast ratio
negative). Darkness tests need a floor and a NO_LINE_REFERENCE fallback.

## 2. Root cause and the first wrong decision

Root cause: the mark detector is a pure *topology-of-ink* test on a mask built to catch faint ink (`delta 8`
local contrast). A watermark, a grey fill and a plant symbol are ink in that sense. The detector was written
to be shape-agnostic (slash, tick, arrow) and that part is right; what it lacks is any comparison with the
line it sits on.

First wrong decision: `findStraightRuns`, mark loop — accepting x=202…207 as a mark because
`crossThickness ≥ t+2 && crosses()` on the mask, with a crossing ink whose darkest pixel is 0.67·Cl (grey 211
vs line 189), whose weaker side is 0.30·Cl over 2 of 5 rows, and whose run width is 8 px (4·t) where the
chain's own end marks are 1–2 px. The second (amplifying) decision is that `ticksPx` carries no class, so the
chain model and both scale solvers must treat the watermark exactly like a drawn tick.

## 3. Azalia base frame — measured marks

| mark | hit run | peak / weak-side contrast (·Cl) | side width (px) | support rows (of n) | perp. continuation | component (px) | wall edge ±2 |
|---|---|---|---|---|---|---|---|
| H645.5 @77 (end) | 75–79 | 1.98 / 1.94 | 2 / 1 | 5 / 5 | 9 / 8 | 15 / 12 | yes |
| H645.5 @204.5 | 202–207 | **0.67 / 0.30** | **8 / 6.5** | 5 / **2** | 4 / 3 | **868** / 13 | no |
| H645.5 @633 (end) | 631–635 | 2.12 / 1.98 | 2 / 1 | 5 / 5 | 9 / 8 | 15 / 12 | yes |
| V24 @159.5 (end) | 157–162 | 1.09 / 0.80 | 2 / 2 | 6 / 6 | 9 / 9 | 25 / 25 | yes |
| V24 @519 (end) | 517–521 | 1.02 / 1.01 | 2 / 1.5 | 6 / 6 | 9 / 9 | 17 / 17 | yes |

Raw greys: end slashes 115–162, stubs 124–127, line 189; watermark band 211–231 above, 231–239 below. The
watermark is the only crossing on the frame's two overall chains that is lighter than the line. Over the whole
frame (60 lines, 201 marks) the proposed rule rejects 4 marks: 204.5, H246@578 and H616@175.5 (watermark
edges), V371@468.5 (a faint dashed line, one-sided). Duplicates on Azalia are the "80/140" window-callout
circles (H253.5/H339.5 at 65.5/73), which also produced junk READ "80" spans; the stair line H395 carries a
junk READ "71". These are not dimension chains; they only show that "bounds a READ" is not proof of a tick.

## 4. Development houses — what each rule would demote

Base (selected) plan frame of each house, fresh offline runs at HEAD (`/home/user/work005d/rev-a/<house>`),
Azalia from the sealed 005C round-3 evidence. "Reading chain" = a detected chain with ≥ 1 READ or
CHAIN_CORRECTED segment; "ext" = its baseline lies outside the plan extent (overall chains). Real marks
(conservative, automatic): R = bounds a READ segment, C = bounds a CHAIN_CORRECTED segment, E = end of a
reading chain. Every REJECTED mark (64 over 9 frames) was looked at in a local crop: all are watermark
edges, grey fills, JPEG paper specks beside light lines, or faint dashed/furniture lines — none is a tick.

| house | lines | marks | reading chains ext/int | real marks (ext R/C/E) | REJECTED: real / unlab. on reading chains / other lines | QUESTIONABLE real: ext / int | QUESTIONABLE unlab. |
|---|---|---|---|---|---|---|---|
| Azalia (blind) | 60 | 201 | 1/5 | 17 (2/0/1) | **1** (204.5) / 0 / 3 | 0 / 4 | 6 |
| Marcówki | 57 | 190 | 4/3 | 23 (7/4/1) | 1* / 2 / 2 | 0 / 4 | 4 |
| Kosaćce clean | 80 | 305 | 4/7 | 37 (6/5/1) | 0 / 0 / 3 | 0 / 10 | 13 |
| Rarytasy G2E | 80 | 277 | 2/7 | 30 (0/4/1) | 0 / 1 / 4 | 0 / 7 | 10 |
| Rarytasy e-OZE (current) | 81 | 275 | 3/5 | 21 (4/2/1) | 0 / 0 / 2 | 3** / 4 | 3 |
| Dom w jabłonkach | 71 | 246 | 2/2 | 10 (2/3/0) | 0 / 0 / 6 | 0 / 0 | 1 |
| Willa Miranda | 72 | 234 | 2/3 | 16 (5/0/1) | 0 / 1 / 2 | 0 / 3 | 8 |
| Dom w żurawkach | 47 | 189 | 4/3 | 22 (7/2/1) | 0 / 0 / 30 | 0 / 7 | 3 |
| Dom w modrzykach | 72 | 255 | 4/6 | 30 (6/5/1) | 0 / 1 / 5 | 0 / 8 | 11 |

\* Marcówki V547@784.5 is auto-labelled "E" but is the line entering a grey fill; the real end is 773.
\*\* e-OZE H582 369.5/417.5 are plant symbols on a line that carries a junk "CC 105" (the 100/140 window
callout); V24@230 is a slash tail 6.5 px from the real end 236.5. None is a real tick.

Exterior reading chains (26 chains, 84 marks): TICK 71, QUESTIONABLE 8, REJECTED 5; 21 of 26 chains have no
QUESTIONABLE mark, none has more than 2. Interior reading chains (292 marks): TICK 189, QUESTIONABLE 101
(83 carry COLOUR_MISMATCH, 70 WEDGE_NOT_STROKE: walls at red arrows), REJECTED 2 (watermark edges, Miranda
H460@336.5, Modrzykach H232@563.5). Other lines (1796 marks): REJECTED 57, 30 of them Żurawkach paper specks.

Feature ranges, genuine real marks on exterior neutral chains (n = 67 after removing the three junk marks):
peak contrast κ 0.77…3.19·Cl (median 1.30; the two lowest are anti-aliased slashes, Jabłonkach H828@83.5 and
G2E V70@167.5); side width ≤ 2.5 px (t = 1) and ≤ 2 px (t = 2); support rows ≥ 0.67·n on both sides; none of
the 67 is REJECTED or QUESTIONABLE under the proposed contract. All 64 rejected marks: κ ≤ 0.74.

Rule sweep (as a hard rejection) over the 8 development frames — real marks demoted, Azalia caught:

| rule | real demoted, exterior (of 69) | real demoted, all reading chains (of 189) | unlabelled demoted | Azalia 204.5 |
|---|---|---|---|---|
| LIGHTER κ < 0.75 alone | 1* | 2 (+ Kosaćce V154@683.5, a real arrow at a light wall face, κ 0.45) | 14 | caught |
| WEDGE (width > 2t+2) alone | 4 | 53 (walls/arrowheads on interior chains) | 46 | caught |
| ONE_SIDED (rows < n/2) alone | 1** | 10 | 16 | caught |
| FAINT_SIDE κw < 0.5 alone | 0 | 2 | 13 | caught |
| LIGHTER ∧ WEDGE | 1* | 1* | 3 | caught |
| **LIGHTER ∧ (WEDGE ∨ ONE_SIDED), κ < 0.75 (proposed)** | **1*** | **1*** | **5** | **caught** |
| same, κ < 0.80 | 1* | 1* | 6 (+6 on other lines at κ 0.75–0.79, unverified) | caught |
| same, κ < 0.60 | 0 | 0 | 4 | **missed** (κ 0.67) |
| same, reference = min(line, end-tick) | 1* | 1* | 5 | caught |

(\* = the grey-fill "end" above; \*\* = the slash-tail "end" above.) The five unlabelled marks the proposed
rule rejects on reading chains are Marcówki 290 and 278.5, G2E 692, Miranda H460@336.5, Modrzykach H232@563.5
— watermark edges and a grey fill. STYLE_MISMATCH against the chain's clean end mark flags 3 genuine internal
marks (Marcówki V128.5@523.5, G2E H454@187.5, V163.5@270.5): QUESTIONABLE-only, never a rejection.

Label centring on the 37 READ/CHAIN_CORRECTED spans of exterior neutral chains (8 houses): offset
|label centre − span centre| / span = 0.004 … 0.069. Azalia: A [77, 633] 0.012, B [204.5, 633] 0.164.

## 5. Proposed contract (generic; no project constants)

Inputs per line L: grey G (= inkChannel), the existing mask M, axis, baseline b, thickness t, reach R (=
markReachPx, 7), spread s (2), clear c = ⌊t/2⌋+1; side rows d ∈ [c+1, R], n = R−c rows per side. The hit
detection (`crossThickness`, `crosses`, ≤2-px merge) is kept unchanged as the *candidate* generator.

Line reference. Clean positions = along-positions ≥ R from every hit run. Paper P = 90th percentile of G at
offsets ±10…14 px across the line at clean positions. Line core Gl = median over clean positions of the
darkest G on the line's own rows. Cl = P − Gl. If Cl < 24 grey levels or fewer than 8 clean positions →
reason NO_LINE_REFERENCE, darkness tests are skipped (the mark can then be at most QUESTIONABLE).

Features per candidate mark (hit run [h0, h1]); for each side σ and row d, window [h0−s, h1+s]:
- support ρσ = rows with mask ink in the window; gσ(d) = darkest G among those ink pixels;
- peak contrast κ = (P − min gσ(d))/Cl; weak-side contrast κw = min over σ of (P − median_d gσ(d))/Cl;
- width ωσ = median over rows of the longest mask run (along L) that intersects the window; the side
  "narrows" when its outermost width < innermost − 2 (an arrowhead), else it is a band;
- chroma vector (RGB minus its mean) of the line core vs the darkest mark pixels;
- end style: the chain's reason-free end mark with the larger κ (κe, ωe).

Reason codes (all recorded on every mark, with the features):
- LIGHTER_THAN_LINE: κ < 0.75 (the darkest crossing pixel is lighter than ¾ of the line's own ink).
- FAINT_SIDE: κw < 0.5.
- ONE_SIDED: min σ ρσ < n/2.
- WEDGE_NOT_STROKE: max σ ωσ > 2t + 2 on a side that does not narrow.
- COLOUR_MISMATCH: max chroma ≥ 20 and |Δchroma| ≥ 0.5·max chroma.
- TEXT_STROKE: the mark zone overlaps a numeric OCR box and the mark is ONE_SIDED or FAINT_SIDE.
- DUPLICATE: two marks ≤ R+1 px apart (centres), both non-band → the weaker (more reasons, then fewer support
  rows, then lower κ) is DUPLICATE.
- STYLE_MISMATCH (internal marks only): κ < 0.5·κe or max ωσ > 2·ωe + 2.
- NO_LINE_REFERENCE (see above).

Classes:
- **REJECTED** ⇔ LIGHTER_THAN_LINE ∧ (WEDGE_NOT_STROKE ∨ ONE_SIDED): ink lighter than the line that is either
  a band or touches the line from one side. Not a boundary. Kept in `marks[]` with reasons and features.
- **QUESTIONABLE** ⇔ not REJECTED ∧ (LIGHTER_THAN_LINE ∨ ONE_SIDED ∨ DUPLICATE ∨ STYLE_MISMATCH ∨ TEXT_STROKE ∨
  (WEDGE_NOT_STROKE ∧ COLOUR_MISMATCH)). Never deleted.
- **TICK** otherwise. WEDGE_NOT_STROKE alone (walls, fills darker than the line, arrowheads) and
  COLOUR_MISMATCH alone (crossing chromatic chains, black wall faces at red arrows) stay TICK, annotated.

Topology. A QUESTIONABLE mark yields two topologies of its chain, A (span ignores it) and B (chain segments
at it); both are offered to every consumer, neither is dropped:
- label binding (`spansFor`, legacy `maxSkip = 0` vote): skipping a QUESTIONABLE mark costs nothing; skipping a
  TICK keeps the 0.7 discount; a REJECTED mark is not a span end. One label bound to A and to B is one witness.
- A vs B is decided by evidence that does not depend on the scale being solved: label centring (prefer the
  topology whose span centre is within 0.08·L of the label centre when the other is beyond 0.12·L; measured
  0.004–0.069 on 37 real overall spans, Azalia A 0.012 / B 0.164) and chain closure (an overall label equal to
  the sum of the sub-chain). With neither, both stay, the chain is reported AMBIGUOUS, and no DERIVED segment
  is produced across a QUESTIONABLE boundary.
- Real internal ticks survive: a TICK can only be demoted by the conjunction above, which no real tick on
  the dev houses meets (section 4); a QUESTIONABLE real tick still bounds topology B.

Interface: `DimensionLine.marks: { atPx, hitFromPx, hitToPx, class, reasons[], features }[]`; keep
`ticksPx` = TICK ∪ QUESTIONABLE positions so chain ids of unaffected chains do not move; add
`questionablePx`, `rejectedPx`. Bump the extractor version: chains that lose a REJECTED mark change id.

## 6. Case coverage

- Watermark / grey fill / soft shadow: LIGHTER + band (Azalia 204.5, Marcówki 290, 784.5, G2E 692) or LIGHTER
  + one-sided (Marcówki V568 278.5) → REJECTED. A watermark crossing that is two-sided and stroke-thin (V568
  300.5, 0.25·Cl) stays QUESTIONABLE (A/B), by design.
- Text strokes: label digits are removed by `crosses()`; a digit beside a slash tail produces TEXT_STROKE +
  ONE_SIDED + DUPLICATE (Marcówki 228.5, 742) → QUESTIONABLE.
- Scan noise / single pixels: one-sided or ≤ 2 rows → ONE_SIDED; if also light → REJECTED (Żurawkach: 30
  JPEG paper specks beside light-grey lines, κ 0.13–0.26, rejected; those lines then hold < 2 marks).
- Hatching / cabinet crosses: dark thin diagonals → TICK by darkness and width; they are a STYLE question
  (no case on an overall chain of the dev base frames). A periodic run of ≥ 3 equally spaced marks of one
  diagonal angle, none wall-aligned, is a candidate QUESTIONABLE rule — untested, do not ship blind.
- Crossing wall / furniture / another chain: dark and thin (TICK) or band (wall, TICK annotated). On a chromatic
  chain, a neutral crossing gets COLOUR_MISMATCH (Azalia V570 375/383/442/485.5) — annotation only, because the
  real ends of those chains are neutral wall faces too.
- Plant/symbol on an overall chain (G2E H781 186.5, 419.6): band + colour mismatch → QUESTIONABLE.
- Broken end tick (one wing missing, still dark): ONE_SIDED → QUESTIONABLE, never REJECTED.
- Offset extension line: the 2-px spread keeps it a candidate; no reason fires (perpendicular continuation is
  not a gate).
- Duplicate ticks: 1–2 px duplicates are already one mark; 3–8 px pairs → DUPLICATE on the weaker →
  QUESTIONABLE.

## 7. Negatives and risks

- Thin margin on darkness alone: real overall ticks reach κ = 0.77 (G2E V70@167.5, an anti-aliased slash with a
  light stub), the Azalia watermark is 0.67. LIGHTER at 0.6 misses Azalia; at 0.8 it still demotes no real
  tick on the dev houses but only because the band/one-sided conjunct is also required. Never ship LIGHTER
  alone as a rejection (it would reject Kosaćce V154@683.5, a real arrow end at a light wall face, κ 0.45).
- Width alone (WEDGE) as a rejection demotes 1–11 real marks per house (walls/arrowheads on interior chains);
  ONE_SIDED alone demotes 0–4. Neither may reject on its own.
- A drawing whose dimension lines are lighter than its watermark defeats LIGHTER (then only QUESTIONABLE).
- QUESTIONABLE is cheap but not free: interior reading chains carry 0–10 QUESTIONABLE real marks and 1–13
  unlabelled ones per house (2172 marks over 9 frames: 1438 TICK, 670 QUESTIONABLE, 64 REJECTED, most
  QUESTIONABLE on lines that are not dimension chains). If skipping them is free, a label may bind across
  several walls: keep the ≤ 2 skip bound for QUESTIONABLE skips too and keep centring as the tie-breaker.
- "Bounds a READ segment" is not ground truth (Azalia 204.5 itself, the callouts, the stair line); counts in
  section 4 treat it as real and were checked by eye where a rule demoted something.
- Chain ids change wherever a mark is REJECTED (Azalia overall, Marcówki V547/V568, G2E H781): sealed replays
  move; that is intended but must be versioned.
