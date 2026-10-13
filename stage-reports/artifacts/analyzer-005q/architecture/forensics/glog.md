# 005Q Phase A — house forensics: dom-w-glogownikach (key `glog`)

> Phase A working draft by an independent read-only agent, committed as written (scratch paths shown as `$W`, a directory outside the repository; publisher rasters were read there and are not committed). Where it disagrees with `first-bad-boundary.md`, the disagreement is stated there.

Base: the repository HEAD 04d5568 (read-only). Selected frame `frame-asset-rzut-70b6aa153a-0cb0a5c1d9`
(853×853 GIF, sha256 e4e5edc4…, cache `ece4e6b4f430e4b9ffb2e678f85b5097.bin`). Baseline B0 = model
`b7c86aac…` (163.81 m², verdict ALGORITHMIC_FAIL, footprint −8.04 % vs published 178.13 m², scale 2.6234 cm/px).
All line numbers are `packages/reconstruction/src/*` at 04d5568. Scratch: `$W/agents/glog/`
(variants `v0 va vb vc vd ve vf`, runs `runs/<label>/dom-w-glogownikach`, raster crops `img/` — publisher pixels,
never copied into the repo). Control `v0` (v-probe copy + one extra MASS_SPAN probe line in `layout.ts`) reproduces
B0 byte for byte (model `b7c86aac…`, program `16f455c1…`).

Labels: **KNOWN** = reproduced from code/data/run output here; **INFERRED** = reasoned, not reproduced;
**UNAVAILABLE** = cannot be determined from what is here.

---

## 0. What the drawing actually shows (KNOWN, read from raster crops in scratch)

| side | outer face (px) | inner face | ink |
|---|---|---|---|
| N | y≈203–204 | y≈220 | band H 203–220 (two long pieces 96–421, 638–794; 5.70 m glazed gap 421–638) |
| W | x≈78 | x≈95 | band V 78–95, len 315 |
| E | **x≈812.5** | x≈795–796 | band V 795–812, y 221–535, t 18, len 315 (garage east wall, continues to y≈553 at the SE pier) |
| S, x 78–438 | **y≈553–554** | y≈536 | band H 536–553, x 96–421, t 18, len 326 |
| S, x 438–645 | **y≈535** (set back ≈18 px ≈ 0.47 m) | y≈517 | short bands H 517–534 (x 440–465, 553–575); a dashed overhead line runs on at y≈553 |
| S, x 645–812 | y≈553 | — | garage piers 645–672 and 785–812 down to y≈553; garage door "300/225" between them |

Printed chains (left): outer chain x≈17 prints **920** over 203→553; inner chain x≈41 prints **870** over 203→536 and
**50** over 536→553. Bottom: chain y≈622 prints **949 | 541 | 440** (ticks 78, 439, 645, 812); chain y≈647 prints
**1930** over 78→812. Garage interior chain y≈481 prints **350** (≈662/666→795).

So: the dimensioned extent 78..812 × 203..553 is right; 8.70 m is north-outer to **south-inner** face of the west
part; the outside is 19.30 × 9.20 m with a ≈5.4 × 0.47 m set-back niche at the entrance (x 438–645).

## 1. Earliest incorrect operation, per axis

### Chain segments at the two contested lines (KNOWN, `metric-evidence.json`)

| line | chain / segment | origin | value | what is printed there |
|---|---|---|---|---|
| Y 536 | chain-vertical-41 seg0 203→536 `f810c24db9` | CHAIN_CORRECTED (raw "810" → "870", substitution, dependsOnScale) | 870 | "870" |
| Y 536→553 | chain-vertical-41 seg1 `1e7b2a907f` | DERIVED ("nothing is printed on this 17 px span") | 44.554 | **"50"** (OCR saw only "0" fragments at box 24–38 × 535–542, unbound) |
| Y 553 | chain-vertical-17 seg0 203→553 `2bbe2a8971` | CHAIN_CORRECTED (raw "420" → "920") | 920 | "920" |
| X 797.69 | chain-horizontal-481-b5c seg4 701.944→797.689655 `ccbfbc1f91` | CHAIN_CORRECTED (raw "150" → "250"; fractional, solver-placed tick) | 250 | nothing at those ticks; the "350" garage dimension ends at ≈795 |
| X 797.69 (merged) | chain-622 tick 795 (seg7 761.5→795 `f342b2e01b`, seg8 start) | DERIVED | 87.97 / — | 795 is not a tick of 949/541/440 |
| X 812 | chain-622 seg8 795→812 `001387e710` | DERIVED ("nothing is printed on this 17 px span") | 44.643 | end of "440" (645→812) — 440 not bound |
| X 812 | chain-horizontal-647 (78..812) | no segment values ("no number on this chain could be reconciled") | — | "1930" (OCR token "0161" at 430–454 × 630–643) |

Upstream of reconstruction every statement on these four lines is a CHAIN_CORRECTED substitution or DERIVED; none is
READ. The outer X face carries no printed statement at all after binding.

### Y axis (KNOWN; probe `CORE` record + code)
1. `gridLines` chain pass (`plan-decomposition.ts:470-490`): line 536 ← chain-41 (printed), 553 ← chain-17 (printed) and
   chain-41 (DERIVED tick). Both get `chainSpanPx` 350 because `:473` takes the **whole chain's** tick span (chain-41's
   203..553 includes its unread "50" segment), not the span of the statement that ends at the line (333 vs 350).
2. **Band claim (`:508-509`) — earliest incorrect operation on Y.** South band axis 544.5, faces 536/553, window 13.5:
   claimants 536 and 553 tie on chainSpanPx (350/350) and on axis distance (8.5/8.5) and fall to the positional key
   `a.px - b.px` → 536 takes the 326 px band → conf 0.95 (`:535`); 553 stays 0.80. The comment's own intent ("the one
   that measures more of the building takes the band") would have chosen 553 (920 > 870), but the span key cannot see it.
3. `thinLines` (`:564-583`): gap 17.000 < minCellPx 17.136 (`:1861`, minCellM 0.45 `:369`) → 553 thinned; its probes
   within 18 px merge into 536 → 536 probes `[517, 525.5, 534, 536, 544.5, 553]` (KNOWN, v0 probe).
4. `walledEnvelope` snap (`:1244-1256`, tolerance `let gap = wallPx` = 18 at `:1246`): axis box y1 553.5 → 536
   (17.5 < 18, margin 0.5 px).

### X axis (KNOWN for 1–4; upstream cause INFERRED as "misbinding")
1. Chain pass: chain-622's DERIVED tick 795 merges into the b5c tick 797.69 (`:481`, snapPx 5, gap 2.69) → line 797.69
   gets chains {b5c, 622}, chainSpanPx 734, **printed** via b5c's CHAIN_CORRECTED substitution (`:478` counts
   CHAIN_CORRECTED as printed). Line 812: chain-622 only, DERIVED → not printed.
2. Band claim (`:509`): east band axis 803.5, both lines span 734; 797.69 wins on the **second** key, axis distance
   5.81 < 8.5 (not a tie-break) → 797.69 conf 0.95; 812 conf 0.50.
3. `thinLines`: 14.31 < 17.136 → 812 thinned.
4. Snap: axis box x1 812.5 → 797.69 (14.81 < 18).

Earliest incorrect *operation* on X is upstream of reconstruction: the overall statements on the outer face (440, 1930)
are not bound and b5c's "150→250" substitution plants a solver-placed tick at 797.689655. Inside reconstruction the first
wrong decision is the confidence assignment at `:535` (via `:478`) together with the distance claim at `:509`; even
without the substitution (INFERRED by arithmetic, 005P's cf1): 797.69 = chain + band = 0.75 > 812 = 0.50, so X stays.
The extent (78..812 × 203..553, DIMENSION_CHAIN_EXTENT both axes) is **correct**; nothing earlier than the grid is wrong
on Y.

## 2. Is the outer face wall-thick ink? (KNOWN)
- East: yes, along its whole length — band V 795–812 (t 18, len 315, y 221–535) plus the SE pier to ≈553; raster outer
  face at x≈812.5.
- South: **partly**. West part x 96–421(438): band H 536–553 (t 18, len 326), outer face ≈553.5. Garage part x 645–812:
  piers to ≈553. Middle x 438–645: the facade is at y 517–535 (short bands, t 18); 536–553 there is open (light fill +
  dashed overhead line). So the south facade is **stepped**; no single horizontal line is its outer face.
- Measured `drawnShareOf`-like share at DRAWN_LUMA 243 (my Python mimic, INFERRED approximation): east strip 0.96,
  front strip x 78–645 0.67 (west wall part 0.80, niche 0.44), garage strip 672–784 0.40.

## 3. Where the three PAVED "recess" terraces come from (KNOWN)
1. `layout.ts:1846` → `zonesOutsideEnvelope` (`:2182-2215`): strips between the snapped envelope (78..797.69 × 203..536)
   and the extent. minCell = max(2, wallPx/2) = 9 px (`:2184`): MAX_Z strip 536..553 (17 px) and MAX_X strip
   797.69..812 (14.31 px) become ZONE regions `zone-max_z`, `zone-max_x`; MIN sides are 0 px.
2. `v2/reconstruct-v2.ts:649-720` (G2): `sideOfZone` maps max_z → FRONT, max_x → EAST; masses whose face lies on the
   zone's back plane (< 0.15 m) host them; `scanZoneForReturns` (`v2/recesses.ts:76`) finds wall-thick ink across the
   front strip — the garage pier 645–672 (return-front-0-0, 0.709 m at x 14.89–15.60) and the east wall's foot
   784–797.69 (return-front-0-1, 0.289 m) — and leaves open intervals 0..14.89 and 15.60..18.54. Trace: recesses 2,
   returns 2.
3. `v2/reconstruct-v2.ts:1093-1121`: one terrace per open interval of each storey-0 recess:
   `terrace-front-0` (x 0..14.89, z 0..0.4455 = y 536..553 x 78..645), `terrace-front-1560` (x 15.60..18.54 =
   garage-door strip 672..784), `terrace-east-45` (x 18.829..19.205 = the east wall itself, z 0.4455..9.1455).
   `surface` = PAVED because `drawnShareOf ≥ 0.3` (`:1111`, `:1118`; `v2/terrace.ts:107-119`) — the "floor" reads as
   drawn **because it is wall poché** (east 0.96) or the garage-door/niche fill. Thickness 0.32 (SOURCE_DERIVED),
   edge PLINTH, interpretation "the floor of the east/front recess".
4. In parallel `boundary` records the same strips as 9 unbuilt bodies (FLUSH_ATTACHED ×5, UNKNOWN ×2, COVERED_TERRACE
   ×2 — the latter on the niche 439–646 and the **garage door** 668–782) and 5 rejected ATTACHED_ROOM completions; it does
   not feed the terraces.

Net: 2 of 3 terraces are walls (east wall, west part of the south wall), and the third is a garage door. Only the
niche x 438–645 (≈2.4 m²) is a real open recess, and it is depth 0.47 m under a roof line, not a paved terrace (INFERRED).

## 4. How the ring becomes SOURCE_EXACT and 8.70 m MEASURED (KNOWN, MASS_SPAN probe in v0)
- `layout.ts:1853-1855`: `spanX = ladderX.span(78, 797.69)`, `spanZ = ladderZ.span(203, 536)` (ladder built at
  `:1704-1705`, tolerancePx = max(2, wallPx/2) = 9, `:1703`).
- `statements()` (`:1148-1170`): Z — chain-41 seg0 starts at 203, `valueOf` (`:1137-1145`) returns the cited evidence
  value 870 (`f810c24db9`, the CHAIN_CORRECTED substitution), ends at 536 → `stated: true, agreed 1`, 8.70 m. chain-17's
  920 ends at 553 (> 536 + 9) and is not a statement of this span. X — chain-622 from 78, summing **8 segments of which
  7 are DERIVED from the scale** and 1 is the "501→541" substitution, stopping at tick 795 (|795−797.69| ≤ 9) →
  1882.9156 cm, `stated: true`. DERIVED segments count as statements because `valueOf` returns any segment value.
- `basisOf` (`:1859`): `stated` and `rereadEvidenceIds` empty (probe: `reread: []`) → **MEASURED** for both axes.
- `v2/reconstruct-v2.ts:406`: MASS feature provenance = SOURCE_EXACT iff `widthM.basis === 'MEASURED'` (depth basis not
  consulted).
- `v2/emit.ts:191`: the ring evidence is `'SOURCE_EXACT'` **unconditionally** ("… m body from the plan's printed chains
  and wall bands"); it would say SOURCE_EXACT even for a SCALED body. So the label "18.83 × 8.70 m SOURCE_EXACT" is the
  product of three independent laundering steps: DERIVED-as-stated (ladder), substitution-as-printed (`:478`, `:1859`),
  and an unconditional emit label.
- A further ranking hazard seen in `vd`: for span(203, 553) the ladder picks chain-41's 870 + DERIVED 44.55 = 914.55 over
  chain-17's printed 920 because `:1178` ranks by **number of evidence ids** (a DERIVED segment adds an id).

## 5. Counterfactuals (each one replay, `--par 1`, same sealed inputs; scored by `score_005q.row`)

| label | change (scratch copy) | grid end lines X / Y | envelope | outcome | footprint m² | residual | terraces | model sha256 | steps that change vs B0 |
|---|---|---|---|---|---|---|---|---|---|
| v0 | none (probe only) | 797.69 / 536 | 78..797.69 × 203..536 | COMPLETED, ALG_FAIL | 163.81 | −8.04 % | 3 PAVED | b7c86aac… | — (byte-identical) |
| va | (a) re-add thinned raw lines within snapPx of the long-band outer face | 797.69, 812 / 536, 553 | 78..812 × 203..553 | **FAILED** MODEL_EMISSION_FAILED (WALL_CONSUMED, ring-attached-0-0) | — | — | — | failure f6706aae… | DECOMPOSITION builtRegions 1→4 (78–439, 646–668, 797.69–812 × 536–553 slivers), masses 1→2, gate ACCEPTED, emission refuses |
| vb | (b) snap tolerance wallPx/2 (`:1246`) | 797.69 / 536 | 78..812.5 × 203..553.5 (off-grid) | COMPLETED, ALG_FAIL | 163.81 | −8.04 % | 0 | ae057866… | zones/recesses 2→0, returns 2→0, terraces 3→0, rooms 8→7, west window→door, bodies 9→0, completions relabelled BOX_COMPLETION, commands 133→118 |
| vc | (a)+(b) | as va | as va | **FAILED** (failure byte-identical to va) | — | — | — | f6706aae… | as va |
| vd | (a) but the outer line **replaces** the inner one and inherits all its probes | 812 / 553 | 78..812 × 203..553 | COMPLETED, PASS | 176.29 | −1.04 % | 0 | 0c9d58d5… | layout gate PARTIAL→ACCEPTED, recesses/returns 2→0, rooms 8→7, openings 13→12: the three 100/140 west-part south windows now read at 1.0 m each (B0: 2.78/2.23/1.4-ish widths and a 1.71 m "door"), the niche mouth x 438–645 becomes one 5.38 m WINDOW (swallowing kitchen window 230/120 and entrance door 170/210), the garage door stays a 3.0 m WINDOW as in B0, the east window 100/230 is gained, commands 133→115; ring "19.28 × 9.15 m" still SOURCE_EXACT |
| ve | only the band-claim tie-break: outer face first (`:509` third key) | 797.69 / 553 (536 thinned, probes 517–534 lost) | 78..797.69 × 203..553 | COMPLETED, ALG_FAIL | 146.07 | −18.0 % | 1 PAVED (east) | e1c4265b… | builtCells 128→114; 3 masses (12.36×8.12, 3.94×9.15, 9.48×1.03); entrance niche read as RECESS and the hall/kitchen leak |
| vf | 005P falsifier minCellM 0.44 | 797.69 / 536, 553 | 78..797.69 × 203..553 | **FAILED** (failure byte-identical to va) | — | — | — | f6706aae… | builtRegions 3, masses 2, emission refuses |

Readings:
- (a)/(c)/(f): keeping the outer-face line *in addition to* the inner one makes the wall's own 17 px row a cell row the
  fill treats as enclosed → sliver BUILT regions → a 0.45 m mass → emission refusal. Not a fix. (KNOWN)
- (b): the snap is what turns the strips into zones; capping it removes all three false terraces and the two false
  returns, but the BUILT region is still cut on 797.69/536 (cells), so the footprint is unchanged, one room merges and one
  west window becomes a door (cause of the last two UNAVAILABLE without further probing). (KNOWN)
- (e): flips exactly the earliest Y decision and Y thinning follows (553 0.95 kept, 536 0.80 dropped) — but 536 was the
  line that carried the set-back wall's probes (517/525.5/534); without them the line at 553 sees no wall across the
  niche, the fill leaks through the entrance and the body fragments. The earliest operation is not separable from facade
  topology. (KNOWN numbers; leak path INFERRED from probe lists.)
- (d): one rectangle 19.2756 × 9.1455 m. Its residual looks good partly by compensating errors (INFERRED): X is the
  DERIVED sum 1927.56 (printed 1930 unread), Z is 870 + DERIVED 44.55 (printed 920 out-ranked), and the ≈2.4–2.6 m²
  entrance niche is now inside the building and its mouth is one 5.38 m "window". The published footprint is reported only as the
  scorer does; nothing here was tuned to it.

## 6. Disagreements with 005P
1. 005P Q2 falsifier "minCellM 0.44 keeps line 553 and restores Y (≈172–173 m²) while X stays" — **refuted end-to-end**
   (vf): line 553 is kept, but the row 536..553 becomes sliver regions and the run fails at emission (WALL_CONSUMED).
   005P's figure was an INFERRED area, not a run.
2. 005P calls 78..812 × 203..553 "the correct extent" and the strips "≈11.8 m² lost". The extent is correct as a
   *dimension* extent, but the south facade is stepped: ≈2.4–2.6 m² of it (niche x 438–645, y 535–553) is a genuine
   open recess and the strip 672–784 is a garage door, not a covered terrace (boundary labels it COVERED_TERRACE).
3. 005P says 8.70 "is the inner-face 870". Agreed, and refined: "870" is printed (OCR read "810", substitution restored
   the right digits) and the chain prints "50" for the wall below it, which OCR did not bind (DERIVED 44.55). The
   18.83 m width is mostly DERIVED (7 of 8 segments), which 005P did not mention; and `emit.ts:191` labels every ring
   SOURCE_EXACT regardless of basis.
4. 005P's X story (distance claim, CHAIN_CORRECTED as printed, cf1 0.75 vs 0.5) — agreed, not re-run.

## 7. Design implications (evidence-backed)
- Must not add outer-face grid lines next to the inner-face line (va/vc/vf fail at emission).
- Must not move the facade line to the outer face without keeping the closure evidence (probes) of a set-back facade
  piece (ve: −18 %, 3 masses). A stepped facade needs per-interval outer faces, not one line per side.
- The snap must not move an outer face across a wall-thick band whose own outer face the long-band axis box already
  located; but capping the snap alone does not change the footprint (vb).
- A strip that is wall poché (share ≈ 0.96) or a door opening must never become a PAVED terrace; `drawnShareOf ≥ 0.3`
  cannot distinguish wall ink from paving.
- Depth/width provenance: DERIVED segment sums and scale-substituted CHAIN_CORRECTED values must not yield MEASURED /
  SOURCE_EXACT; `emit.ts:191` must take the body's basis; the ladder must not rank by evidence-id count.
- Any fix must be checked against the other rows; this house alone says nothing about regressions (not run here).

## KNOWN / INFERRED / UNAVAILABLE summary
- UNAVAILABLE: why OCR left "50", "440", "949", "1930" unbound beyond the token list; why vb merges a room and turns the
  west window into a door; how the publisher computes 178.13 m²; effect of any variant on the other 45 rows (not run).
