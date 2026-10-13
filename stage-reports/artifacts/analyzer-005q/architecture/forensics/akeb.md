# 005Q Phase A — house forensics: dom-w-akebiach (+ dom-w-helikoniach) — key `akeb`

> Phase A working draft by an independent read-only agent, committed as written (scratch paths shown as `$W`, a directory outside the repository; publisher rasters were read there and are not committed). Where it disagrees with `first-bad-boundary.md`, the disagreement is stated there.

Base: the repository HEAD 04d5568 (read-only; nothing under it was touched). Line numbers are at 04d5568,
`packages/reconstruction/src/*` unless stated. Scratch: `$W/agents/akeb/` (variants `vp` = copy of
`v-probe` + env-gated band injection `AKEB_INJECT` in `layout.ts` planSheet and an admission log `AKEB_ADMIT`; `vA`/`vB`/`vAB`
= `vp` + glog's `patch_a.py` (restore outer-face line) / `patch_b.py` (snap ≤ half a wall); `vL` = `vp` + env-gated grid
line drop/move `AKEB_LINES`). Runs: `agents/akeb/runs/<label>/<case>`, all `--par 1`, one at a time. Rasters decoded in
scratch only (`img/`, `imgh/`; publisher pixels, never copied into the repo). Production mask replicated in
`pmask.py` (inkChannel = min(R,G,B); `adaptiveInkMask` radius 21, delta 8, absolute 110; source-cv/src/mask.ts:366,
raster.ts:78).

Labels: **KNOWN** = reproduced here from code/data/run output; **INFERRED** = reasoned, not reproduced;
**UNAVAILABLE** = cannot be determined from what is here.

Controls (KNOWN): `vp` with no env reproduces B0 byte for byte on akebiach (`failure.json`, `analysis-trace.json`,
`digest.json`, and `probe.ndjson` identical to `runs/PROBE`) and on helikoniach (`model.json` identical, sha 27642deb…).

---

## 1. dom-w-akebiach — re-verification of the S-face ink claim and the pier counterfactual

Selected frame `frame-asset-rzut-8984f3a30b-4d37f1b2ba` (853×853 GIF sha256 4180d9fb…, cache
`work005n/blind10/cache/96e49a2c….bin`), extent 65.5..750.5 × 194..759, mpp 0.029086/0.029036, wallPx 16,
minCellPx 15.47. Exterior V chain at baseline x=809: ticks **194 | 227 | 611 | 656 | 759** (97 | 1115 | 132 | 301 cm);
overall chain x=838: 194 | 759.

### 1.1 What the drawing shows on the south (KNOWN, raster + production mask)

The core column x 389.5..592 (living 10 / kitchen 15) does **not** end at y≈595–629. Its south facade is a stepped,
wall-inked line:

| piece | box (px) | production-mask dark share |
|---|---|---|
| porch W wall (vertical) | x 370–388, y 611–656 | 0.969 |
| entrance door wall, W piece | x 370–406, y 620–635 | 0.986 |
| entrance door wall, E piece | x 453–502, y 620–635 | 1.000 |
| door gap (door 140/220, 1.34 m) | x 407–452, y 621–634 | 0.141 (leaf arc) |
| bay W return | x 487–502, y 636–656 | 1.000 |
| bay S wall, W piece | x 487–511, y 641–656 | 1.000 |
| bay S wall, E piece / E return | x 580–604, y 641–656 (V band 580–604 × 611–656 exists) | 1.000 |
| window gap (200/130, 1.97 m) | x 512–579, y 642–655 | 0.145 (glazing lines at y 641/647/649/658) |
| garage S wall, W pier | x 66–102, y 745–759 | 0.973 |
| garage S wall, E pier | x 268–303, y 745–759 | 1.000 |
| garage door gap (485/229, 4.82 m) | x 103–267, y 746–758 | 0.006 |
| 005P's injected "S band" | x 389–604, y 595–610 | **0.189** |

Row ink over x 389..592 with the production mask (KNOWN): y 576–619 = 0.078–0.270 (runs only at x 477–481 = a
counter edge, 589–592 = the thin E partition, and furniture/stools 438–448, 495–568); **y 620–635 = 0.35–0.66** (runs
389–406 and 453–502); y 636–640 = 0.11–0.14 (487–502); **y 641–656 = 0.18–0.60** (487–511, 580–592, glazing lines);
y ≥ 657 ≈ 0.

**005P's measurement window (y 580–629, and the `scratch-patch.diff` INK_DIAG loop `for y = 580..630` over x 389..592)
lies inside the kitchen.** Its numbers reproduce exactly (0.08–0.27, then 0.37–0.66 at y 620–629), but the rows it calls
"a partial line" are the top of the door wall, and it never reached the bay wall at y 641–656. The S face carries
wall-thick ink; the claim "the core's south face carries no wall-thick ink" is **FALSIFIED** (KNOWN).

### 1.2 Why none of it is a band (KNOWN, band-pixel replica of `runLengthBands`)

`planSheet` (layout.ts:462–478) runs `runLengthBands` with minThickness 7, maxThickness round(16·1.9)=30 (`:473`),
minLength round(16·1.6)=26 (`:474`). A pixel is a band pixel only if its across-run is 7–30 and its along-run ≥ 12
(source-cv/src/bands.ts:116–120); a piece survives only if length ≥ 26 (bands.ts:228). At junctions the across-run is the
other wall's length, so the corner pixels fail and each stub is cut short:

- door wall row y=627: band-pixel runs x 389–405 (17 px) and 453–476 (24 px) — at x 477–481 the vertical run is 110 px
  (wall + counter line), at x 487–502 it is 37 px (door wall + bay return) → both > 30 → stub < 26 → dropped;
- bay wall row y=648: runs 496–504 (9) and 584–592 (9) → dropped;
- bay W return column x=495: run y 636–656 (21) → dropped; porch W wall column x=378: 600–619 and 636–656 (20/21) → dropped;
- garage S row y=752: runs 82–101 (20) and 268–287 (20) → dropped.

So the operative primitive miss is the **same mechanism 005O/005P named for the N piers (junction stubs below
minLength), but on the S facade**. The probe `CORE` record confirms the B0 band set has no H band anywhere in
y 611–759 and only V 592 (580–604 × 611–656), V 73.5 (66–81 × 502–744), V 306.5 (288–325 × 581–687) there.

### 1.3 How the leak happens (KNOWN from digest cells)

B0 final grid (digest `linesX`/`linesY`): there is no X line between 389.5 and 592, and the Y lines around the facade are
611, 625.5, 656. The cell row 625.5..656 of column ix20 (389.5..592) contains both the open porch (x 406–487, y 636–656)
and the kitchen bay interior (x 511–580, y 636–641); the edge y=625.5 across it is wall only on 389–406 and 453–502 (31 %);
the bay interior continues through it. The cell is outside (open to the porch), and the flood goes up through the
uninterrupted column: ix20 is `O` from iy0 to iy34. The decisive missing grid feature is the **bay's west face (x≈487–502)
and the door-wall line (y≈620–635)**, both absent because their only witnesses are dropped stubs.

### 1.4 Counterfactuals (each one replay; injected bands are rectangles over the measured ink above)

| label | injected (source-backed unless noted) | result |
|---|---|---|
| ctl | none | = B0: refused, 96.93 m², 344/770 enclosed |
| cfN | N piers 370–385 & 589–604 × 194–243 (= 005P) | refused, **95.60 m², 347 enclosed** — reproduces 005P exactly |
| cfS | S facade: porch W wall, door wall (segments 370–406, 453–502), bay W return, bay wall (segments 487–511, 580–604) | refused, **181.04 m² (−27.4 %)**, grid 6×11, 35/50 enclosed |
| cfNS | cfN + cfS | identical to cfS (181.04) — piers add nothing |
| cfSG | cfS + garage S wall (segments 66–102, 268–303 × 745–759) | **COMPLETED**, gate DEGRADED (FOOTPRINT_AREA_NEAR …), verdict ALGORITHMIC_FAIL **219.03 m², −12.18 %**, model a8d5b432… |
| cfNSG | cfN + cfSG | **byte-identical model** to cfSG (a8d5b432…) |
| cfNSGD | cfNSG + an H band over the N 4.01 m sliding door (194–209 × 370–604) — **NOT source-backed** (it is a door) | COMPLETED, **verdict PASS +1.67 % (253.59 m²)**, model 8e4dd761… |

Readings (KNOWN from the digests):
- In cfSG the masses are 66–750×396–611, 66–389.5×611–759, 223–389.5×227–396, 592–750×227–396, 389.5–592×611–656.
  The second mass includes x 303–389.5 × 611–759: the planted courtyard between the garage and the porch (two 120/60
  windows face it; trees drawn) — **≈ 8.4 m² + 1.7 m² false built** — and mass-4 includes the porch
  x 389.5–487 × 636–656 (≈ 1.7 m² false). Missing: the living room's N half 389.5–592 × 227–396 classed **RECESS**
  ("behind it lies only a 28.9 m² pocket", wide opening Y-227 OPEN_SIDE 6.86 m), the N projection 194–227 (UNKNOWN body,
  5.1 m², mouth 3.98 m) and the W wing strip 66–223 × 374–396 (≈ 3 m²).
- The grid in the completing reading is the coarse first decomposition (X 66|223|316.75|389.5|592|750): the garage E
  face (≈303) and porch W wall (≈370) are not lines, so the courtyard cannot be separated.
- cfNSGD's PASS is **compensation**: +≈10 m² false (courtyard, porch) against −≈6 m² still missing. A footprint-total
  verdict accepts it. It is not a true model (INFERRED from the region list vs raster; per-region truth is not in the
  labels → partly UNAVAILABLE).

Falsifiable statement: "akebiach is refused because the S-facade wall stubs (and the garage S piers) are dropped by the
band reader, which leaves the core column open to the porch". Flip: inject only the S-facade stubs → enclosure goes
344→35/50 cells and 96.93→181.04 m² (ran). Pier necessity: cfS vs cfNS identical (ran) → the N piers are not needed.

## 2. A chain-constrained candidate-extent rule on akebiach — must it refuse?

Rule as posed: a STRONG printed chain proposes a stretch; the stretch is accepted only with wall solids, jambs and
returns. The S conflict in B0 is STRONG, extent 759 vs box 611 (4.30 m), `stretches: [{65.5, 750.5}]` — i.e. the chain
says *somewhere* on the S the building reaches 759 (and 656), not where.

Evidence on the S strip y 611→759 (KNOWN; "solid" = 5×5-eroded ink ≥ 60 % of the face rows, **neutral ink only**):

| x range | at tick 656 (rows 641–656) | at tick 759 (rows 745–759) | returns reaching the face | verdict under the rule |
|---|---|---|---|---|
| 66–303 (garage) | — | piers 68–99, 270–301 + 4.82 m door (485/229) | W 66–81 solid 654–757; E 288–303 solid 600–685, 731–757 (window 120/60 between) | supported to 759 |
| 303–370 (courtyard) | none (tree ink only) | none | none | **must stay outside** |
| 370–487 (porch) | none at 656; door wall at 620–635 | none | porch W wall 370–388 (to 656) | face is the door wall (≈627), porch outside |
| 487–605 (bay) | pieces 489–509, 582–602 + 1.97 m glazed window | — | bay W 487–502 (620–656), bay E 580–604 (611–656) | supported to 656 |
| 605–750 | none | none | none | **must stay outside** |

Answers:
1. **On the production band set it must refuse** (KNOWN): no band lies on either tick's face anywhere on the S stretch;
   the only S-strip bands are the three V bands in §1.2. A rule that requires band-backed wall solids cannot accept
   anything there, so the S conflict stays INCONCLUSIVE and the core leak remains → refused (96.93 m²).
2. With a junction-aware solid reader the rule could accept exactly two sub-stretches (garage → 759, bay → 656) and must
   reject 303–487 and 605–750. Production already has such a primitive: `solidLayer` (boundary-evidence.ts:84, opening
   by round(0.3·wallPx)=5 px; used only for gap evidence, plan-decomposition.ts:2982) — INFERRED that it sees the stubs
   (they are 16 px thick, 5×5 erosion keeps ≥ 6 px; not run through `solidLayer` itself).
3. Two traps the evidence shows (KNOWN): (a) the production ink mask includes the green tree drawings
   (x 316–322, 349–364 survive 5×5 erosion on both tick rows); without a neutrality test they read as "wall solids"
   exactly in the courtyard that must stay outside; (b) accepting the chain's whole-width stretch would build the
   courtyard (≈8.4 m²), the porch and the E yard 605–750 × 611–759 (≈19.7 m²) — walls and rooms that do not exist.
4. Even with both sub-stretches accepted (= cfSG), akebiach does **not** become correct: 219.03 m² (−12.18 %) with a
   false courtyard, the living room's N half as RECESS and the projection unbuilt. So the S rule alone **must still end
   in a refusal**; what it would actually do in production code (cfSG) is turn a correct refusal into a **COMPLETED,
   DEGRADED, wrong model** (layout gate classes −12 % as FOOTPRINT_AREA_NEAR, not blocking). That is a safety
   regression unless the N side and the face-accurate grid come with it, or the rule's acceptance is per-sub-stretch and
   the remaining unexplained deficit keeps the refusal.

## 3. dom-w-helikoniach — per-axis earliest bad operation and the face-selection family question

Ground frame `frame-asset-rzut-d5842da623-4c943a2b00` (cache `work005f/blind6/cache/fe83ef6e….bin`), extent
158..463.5 × 162..752, mpp 0.023052/0.023071, wallPx 19.875, minCellPx 19.505. B0 model: one mass 181..459 × 189.125..710
(77.56 m², −18.88 %, 1 of 2 storeys).

Drawn faces (KNOWN, mask): W wall x 162–181 (y 162–328, 406–665; windows 180/140 at 329–405 and a **corner window**
666–747 → no wall ink at the SW corner); E wall x 447–466 (outer face **466**); N wall y 162–180 as two piers 162–218 and
409/410–466 around a 4.4 m glazed opening (440/230, frame lines at y 165/169/174); S: room 7 to y 752 (window 150/140 at
x 167–235, pier 236–303), entrance porch recessed x 303–438 behind the door wall y 691–710 (door 150/210), E pier
438–466 × 711–752. Chain ticks X 158 | 300 | 459 (326 | 374 cm; 374 cm implies 462.2, so the 459 tick is ≈3 px short
of its own metric and 7 px inside the drawn face).

Per axis (probe `CORE` → `BOUNDARY` → override `REGIONS` → `AKEB_ADMIT`):

- **W (final x0 181 vs face 162)** — KNOWN. `CORE` is fine (axes 161.56 → envelope 158, chain line). The bad op is
  `gridLines` (:441, filter :525) admitting an X line at **181 = the W wall's inner face** from a split-off 1-px-wide
  band of the same wall (bounds x 181..181, y 222–328, thickness 20, length 107 → coverage 107/590 = **0.1814 ≥
  minBandCoverage 0.18**, :364); `thinLines` (:564) keeps it because 181−158 = 23 ≥ minCellPx 19.5. Largest-first tiling
  then makes 181..459 the body and the wall 158..181 its own region, which layout admission drops as a sliver
  (layout.ts:1807: narrow 0.53 m < minBodySpan 1.00 m; `AKEB_ADMIT` log). The `boundary-completion.ts:553`
  WALL_SLIVER rejections 005P cites are of other rects (158–181 × 162–330 and × 404–478.5, outside the box).
  Counterfactual L1 (drop line 181 only): region 158..459, model db0b17ca…, **−18.88 % → −12.23 %** (ran).
- **E (grid 459 vs face 466)** — KNOWN, **inert**. `gridLines` puts the line on the chain tick 459 (chain-first, the E
  band axis 456.5 joins it); `walledEnvelope` snaps axes 466.44 → 459 (7.44 px < wallPx, :1246). But the body width
  comes from the chain statement: moving 459→466 (L2) changes the admitted rect to 181..466 and leaves the model
  **byte-identical** (27642deb…); L3 (L1+L2) = L1 (db0b17ca…). 005P's "east ≈1.4 m²" loss does not exist in the model.
- **N (final y0 189.125 vs face 162)** — `CORE` envelope y0 = 478.5 (KNOWN): the N wall is two junction-cut stubs
  (H 171: 181–218 len 38, 420–446 len 27, `long: false`), so the long-band box stops at an interior 6-px line band
  (H 478.5) — same junction-stub family as akebiach. The boundary step recovers most of it (PROJECTING_WING
  158..459 × 162..478.5 built, 45.9 m²), but the top grid row 162..189.125 stays `O` and the body starts on a shadow line
  189.125 that has no ink (row ink at y 181–196 is walls only). Dropping 189.125 (L4) moves N to 204.5 (worse) → the top
  row is outside whatever its lower line is. INFERRED mechanism: the NW/NE corner squares (162–181, 447–466 × 162–181)
  are inked but in no band (junction), so the edge x=158 at y 162–181 is open and the flood enters the top row;
  UNAVAILABLE without edge-level instrumentation.
- **S (final y1 710 vs 752 for x 158–303 and 438–466)** — KNOWN: regions 181..300 × 710..726.5 (0.38 m) and the W strip
  are dropped as slivers; the porch 300..428.5 × 710..752 (0.97 m, correctly outside but dropped for being narrow, not for
  being open). The S conflict (stretches 158–300, 428.5–463.5) stays INCONCLUSIVE; the SW corner is a corner window
  (glazing, no wall solid) and the W return stops at 665.

**Family verdict: several.** W is the **same face-selection family as glogownikach** (an exterior wall's two faces both
compete as grid lines; in glog the outer one is thinned away — 17 px < minCell 17.1; in helikoniach both survive —
23 px ≥ 19.5 — and the wall becomes a sliver region that is dropped). E is the same snap op as glog but has no effect
(chain-stated width). N and S are a **different family**: junction stubs / glazed corner / projection shallower than the
1.00 m body span — the akebiach family.

Rules asked about (KNOWN, ran on both houses):
- "keep the outer face line" (glog patch A): helikoniach model identical (no raw line within 5 px of the long-band outer
  faces was dropped: 158 is already kept, 466 never was a candidate); akebiach still refused 96.93 m² (3 lines restored on
  other frames, distinctOutlines 43→44).
- "snap no further than half a wall" (glog patch B): helikoniach model identical (`CORE` y0 478.5 → 468.56 because 9.9375
  is not < 9.9375, interior either way; x1 still 459 since 7.44 < 9.94); akebiach failure byte-identical.
- Direction: neither moves either house. The rule that does move helikoniach is the inverse of A — *suppress the inner
  face as a body edge when the outer face of the same wall is a line* (L1: +6.65 points, toward truth). Blind line
  deletion is not safe: L4 also built the porch (region 158..459 × 204.5..752, −7.73 %).

## 4. Disagreements with 005P

1. Akebiach "S face carries no wall-thick ink (row ink 0.08–0.27)": falsified — rows 580–629 are the kitchen; the face is
   at 620–635/641–656 with 0.97–1.00 dark pieces. The 005P S counterfactual sat on 0.189 ink: source-unbacked because
   mis-placed, not because the facade is uninked.
2. "No closure rule … can shut a face the drawing does not ink as wall" / "Akebiach's uninked S face is out of reach of
   any such rule": wrong premise — the face is inked; it is out of reach of the band reader (junction stubs < 26 px).
3. "The S 4.30 m projection is never a completion candidate": with the stubs present the garage S is built (cfSG mass-1).
4. Root: the miss is a primitive (junction stub) miss on the S facade and garage, not "absence of ink taken as exterior";
   the 005N/005O "missing piers" was the right mechanism at the wrong place (N piers irrelevant: cfS ≡ cfNS, cfSG ≡ cfNSG).
5. Helikoniach W strip: dropped at layout.ts:1807 (sliver), not by boundary-completion.ts WALL_SLIVER; and the E
   "≈1.4 m²" loss is inert in the model.
6. 005P's falsifier for helikoniach ("OUTER_FACE plus strips → within 1 %") is unlikely to hold: removing the W inner
   line gives −12.23 %; N and S losses are separate mechanisms (INFERRED; not run as 005P specified).

## 5. Design implications (evidence-backed)

- Wall solids for any chain-proposed stretch must come from a junction-aware primitive (e.g. `solidLayer`), not from
  `runLengthBands` bands, and must exclude saturated (vegetation) ink.
- A chain stretch must be split by x/y range into sub-stretches each closed by solids + returns; the whole-width stretch
  is never evidence for the parts between (akebiach courtyard, porch, E yard).
- A rule that recovers part of a facade must not convert a refusal into a COMPLETED DEGRADED model with false built
  area (cfSG: −12.18 %, courtyard built) — refusal must persist while an unexplained chain deficit remains.
- A footprint-only verdict can PASS a compensated model (cfNSGD +1.67 % with ≈10 m² false); gates for 005Q need
  per-region evidence, not total area.
- Exterior-face rules must be face-semantic (one wall = one body edge on its outer face), not line deletion or tighter
  snapping; glog's A/B are inert on akebiach/helikoniach (safe but insufficient).
- Body widths are chain-statement driven; face fixes matter only where an edge is band-only.

## KNOWN / INFERRED / UNAVAILABLE

KNOWN: all mask numbers, band-pixel runs, digests, admission logs and every run in §1.4 and §3 (hashes above).
INFERRED: `solidLayer` would see the stubs; the helikoniach top-row leak via inked-but-unbanded corners; per-region
truth of cfNSGD (courtyard/porch outside) from the drawing. UNAVAILABLE: the publisher's footprint definition (whether
the helikoniach porch / akebiach terrace overhangs count), edge-level flood traces (not instrumented), blind-safe effect of
any rule on the other 44 rows (not run here).
