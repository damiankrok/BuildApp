# Council Reviewer A: storey registration topology (BUILDPLAN-ANALYZER-005L)

Reviewed: `/home/user/work005l/council-wt` at 4ad69fe, diff `a70047f..HEAD`. Main file: `packages/reconstruction/src/layout.ts`. The line numbers below are at 4ad69fe.
Probes: `packages/reconstruction/test/probe-a5l-*.test.ts` in the council worktree, with copies in `/home/user/work005l/council/A-probes/`. Every probe uses the corpus drawing helpers (`plan.ts`: `sheet/walls/partition/chain`, `registration()` = 5 cm/px) and the same layout pass as `layoutOf`. Run any of them with `npx vitest run packages/reconstruction/test/probe-a5l-<n>.test.ts`.
The existing `storey-support.test.ts` passes (18/18) on this tree.

## Verdict: **CHANGES_REQUIRED**

The support relation fixes the case it was built for: a whole-building stated placement with walls drawn at full thickness. Outside that case I demonstrated several plausible failures:

* An inset upper storey is emitted as an exact copy of the ground ring. Mutation M6's failure mode still happens, with high confidence and no conflict. This happens whenever the upper plan's chains measure only its own walls.
* Real setbacks of up to two wall thicknesses are snapped away.
* A 2–3 m cantilever along a short side is classed as "within tolerance" and clipped without any record.
* A partial basement, once stacked, becomes the "ground" for the gate and the v2 frame. This blocks the layout or reframes the model.
* A legitimately larger basement is refused, with a false MISSING reason.
* An AMBIGUOUS upper storey is filled with a copy of the ground ring as soon as an attic plan exists.
* Exact-tie ambiguity is pixel-fragile: a 1 px change stacks a storey onto other bodies.
* A thin parapet round a terrace over the garage gives the garage an upper storey, with no conflict.

| id | sev | one line |
|---|---|---|
| A5L-1 | **P0** | A fitted or wall-pair scale silently overrides the scale both plans print. An inset upper storey whose chains measure its own walls is stretched over the whole ground, and the ground ring is copied upstairs with no conflict. |
| A5L-2 | P1 | The snap band `bandM` = tolM + upper wall (about 2 walls, inclusive) swallows real setbacks. A 1.0 m or 1.2 m inset all round gives an upper footprint 36 % or 46 % too large, with overhang `NONE`. |
| A5L-3 | P1 | The overhang tolerance is area-based, `(w+d)·bandM`, so it depends on orientation. A 2.0–3.0 m cantilever along the 12 m side is `WITHIN_TOLERANCE` and silently clipped. The same rule clips a basement that extends 3 m. |
| A5L-4 | P1 | A stacked partial basement now has BUILT regions, so `groundStoreyOf` returns it. The gate then gives FOOTPRINT_AREA_WRONG (BLOCKING), `worldFrameFrom` frames the model off the basement, and v2 builds the basement at the full ground rectangle. |
| A5L-5 | P1 | The lower-exceeds guard refuses a basement that is larger than the ground (5 m under a terrace). It reports NO_SUPPORT and a false MISSING "base plan does not hold the whole building". Before 005L this basement stacked. |
| A5L-6 | P1 | AMBIGUOUS "stacks nothing" is undone by a higher storey. When the attic stacks, the mass span jumps 0..2 with a gap at storey 1, and v2 fills storey 1 with the body, a copy of the ground ring. |
| A5L-7 | P1 | `STOREY_TIE = 1e-6` is far below the score's resolution. A 1 px (5 cm) change turns an AMBIGUOUS case into STACKED on other bodies, and a stretched wall-pair hypothesis systematically breaks symmetric ties. |
| A5L-8 | P1 | A thin (half-wall) parapet enclosing a roof terrace over a one-storey garage becomes a walled upper body. The garage gains an 8×9 m upper storey, with no conflict. |
| A5L-9 | P2 | A heavy title-block or legend frame beside an unscaled upper plan becomes an upper region that stands on the garage. The garage gains a storey, and the house is registered at k = 1.0 instead of 1.25. Conflicts are raised, but the storey is still stacked. |
| A5L-10 | P2 | Fixture 7 never exercises "two equal lower bodies": the ground reads as one mass. The "different bodies" wording appears even when the bodies are the same. There is no two-mass tie or near-tie fixture. |
| A5L-11 | P2 | A stated placement held against a better fit records no conflict at all. A misread chain zero (a balcony edge) shifts the storey by 1.5 m, with margin −0.142 and nothing reported. |
| A5L-12 | P2 | The development matrix shows unexplained tiny upper storeys: willa-miranda L1 12.09 m² over 167 m², tunbergiach L2 8.92 m². No test covers basements or the lower-exceeds guard. The bound in architecture.md §7 is understated. |

---

## A5L-1 — P0 — the printed scale is overridden by fit; an inset upper storey becomes a copy of the ground

**Where.** `layout.ts:819–878`: for every target both a stated scale and a fitted scale are pushed (824–825), with no consistency check between them. `layout.ts:888–947` adds wall-pair hypotheses at any k in [1/3, 3]. The score is `shares + 0.15·coverage (+0.03 stated)` (814). The stated offsets exist only when the chains are "whole" (862–868), so an upper plan whose chains measure its own walls has no stated placement.

The code's own comment (760–765) says: "either the two plans state their own scales, in which case the ratio of those is the scale and there is nothing to search". The code searches anyway.

**Scenario.** An upper storey is inset on two sides, or on all sides, with an aspect ratio within 15 % of the ground's. Both plans print chains, and the upper's chains dimension its own walls, which is common on a "rzut piętra". The envelope fit stretches the upper plan until its outer walls land on the ground's outer walls. Dice rewards that (shares ≈ 0.8–0.97) far above the correct placement at the printed scale.

**Probe P1d** (`probe-a5l-12`): ground 12×10 m; upper 10×8 m, flush north-west, set back 2 m east and south. A bearing wall at x = 5 m carries on up. Upper chains are `ux [40,240]` and `uy [40,200]`.
```
reg u decision=STACKED margin=0 chosen={"targetId":"envelope","scale":1.225,...,"score":0.94815,"stated":false} rival=undefined
fp footprint-1-mass-0 storey-1 [0,0,12,10]          <- the upper's own chains say 10 x 8
0.9482 sh=0.798 k=1.225 ... the scale that makes this plan the size of envelope
0.6139 sh=0.514 k=1.000 o=(0.0,0.0) ... the scale both plans print, flush min x / min z   <- the truth
```
**Probe P1a** (`probe-a5l-2`): an 8×11.35 m upper, inset all round on a 12×17 m house. Chosen k = 1.499; `footprint-1-mass-0 [0,0,12,17]`; no conflict or unresolved.

**Probe P1b**: fixture 3 exactly, but the upper chains measure only its walls (`[80,240]`, `[80,340]`). Chosen k = 1.404; upper footprint `[0,0,12,17]`.

In all three the result is STACKED with storey confidence 0.35 + 0.6·agreement ≈ 0.84–0.92 and no conflict. In v2, `storeyRects` gets nothing (the footprint equals the body), so `rectAt` returns the body and the upper ring is the ground ring. That is the M6 failure. The behaviour predates 005L, but it lies squarely inside the 005L contract (§4, §12). The Dice score makes the wrong fit more confident, not less.

**Counter-evidence to respect.** In dom-w-arkadiach (baseline JSON) the attic registration (2 anchors, mpp 0.0095) gives k_stated ≈ 0.52. The fitted k = 1.06 is chosen, and that is plausibly right. So "always trust the printed scale" is not the fix either.

**Generic fix.** Never let a scale that contradicts a stated scale win silently. When both registrations exist (anisotropy ≤ max) and the chosen k differs from `stated.k` by more than a registration tolerance:
- (a) record a DEGRADING conflict, e.g. `STOREY_SCALE_CONTRADICTS_CHAINS`, with both readings; and
- (b) treat the best stated-scale placement as a rival regardless of `STOREY_RIVAL_WINDOW`. If its footprint differs (IoU < 0.7), the storey is AMBIGUOUS.

Optionally prefer the stated scale when the other plan's registration is strong (≥ 3 anchors, low residual, chain spans agree with its own wall spans), and fall back to fit only for weak registrations. Regress on arkadiach and on every development row. Add P1a/P1b/P1d as fixtures.

## A5L-2 — P1 — the snap band erases real setbacks (and adds area)

**Where.** `layout.ts:1240` sets `bandM = tolM + other.wallPx·scale·mpp`, with `tolM = max(wallM, tolerancePx·mpp)` (1670). The snap at 1272–1273 is inclusive (`<=`). That makes the band a full base wall plus a full upper wall. In the fixtures this is 0.6 + 0.6 = 1.2 m; on real sheets about 0.75–0.9 m (arkadiach: 0.31 + 0.45). The comment justifies at most one wall of axis-versus-face discrepancy.

**Probes** (`probe-a5l-3`; every placement is stated by whole-building chains and is correct):
```
P2a set back 1.0 m from the south:  region [0,0,12,16]        -> fp footprint-1-mass-0 [0,0,12,17]   overhang=NONE
P2b inset 1.0 m on every side:      region [1,1,11,16] 150 m² -> fp [0,0,12,17] 204 m² (+36 %)       overhang=NONE
P2c inset 1.2 m on every side:      region [1.2,1.2,10.8,15.8] 140 m² -> fp [0,0,12,17] (+46 %)       overhang=NONE
```
None of these produces a conflict or unresolved. The region bounds are right; the snap alone destroys them.

**Generic fix.**
- Limit the band to the discrepancy that can really occur: half the upper wall placed, plus half the base wall, plus the registration jitter (`tolerancePx·mpp`).
- Make the snap strict.
- Never snap a side that lies on a chain-supported grid line of the other plan. A tick is a face, not an axis.

Add fixtures for a 0.8 m single-side setback and a 1.0 m inset all round.

## A5L-3 — P1 — area-based overhang tolerance silently clips structural cantilevers

**Where.** `layout.ts:1279`: `unsupported <= (w + d)·bandM` → `WITHIN_TOLERANCE`. The same shape is used in `wallsBeyond` (1323: `2·(w+d)·tolM`). An area allowance of half-perimeter × band permits a protrusion of depth `bandM·(w+d)/w` along one side: 2.9 m on a 12 m side of a 12×17 m house.

**Probe P8** (`probe-a5l-7`): fixture 13 turned 90°. The upper reaches past the ground's south wall, and its chain `[40,380,380+over]` states it:
```
2.0 m: region [0,-2,12,17]   overhang=WITHIN_TOLERANCE unsup=24   fp [0,0,12,17]   (no gap, no conflict)
2.5 m: region [0,-2.5,12,17] overhang=WITHIN_TOLERANCE unsup=30   fp [0,0,12,17]   (no gap, no conflict)
3.0 m: region [0,-3,12,17]   overhang=WITHIN_TOLERANCE unsup=36   fp [0,0,12,17]   (no gap, no conflict)
```
Fixture 13's 2.5 m along the 17 m side gives 42.5 m², which is over 37.8, so it is named. The same overhang along the other axis is not. This breaks §18 ("do not silently clip it and call the result exact"). P6c (`probe-a5l-6`) is the same thing for a basement extending 3 m (36 m² ≤ 38.4): clipped silently.

**Generic fix.** Measure overhang per side, as a linear protrusion. For each of the four sides, take the region's reach past the union of the masses that carry it. Allow `WITHIN_TOLERANCE` only if every side protrudes ≤ `bandM`; otherwise `BEYOND_TOLERANCE`. Apply the same rule in `wallsBeyond`. Add the turned fixture 13.

## A5L-4 — P1 — a stacked partial basement becomes "the ground" for the gate, the v2 frame and emission

**Where.** `structural-layout.ts:472–476`: `groundStoreyOf` returns the lowest storey with `index >= 0` OR with BUILT regions. 005L now gives every stacked lower storey BUILT regions (`footprint--1-${mass}`, `layout.ts:1763`).

Before 005L only a basement covering ≥ 50 % of a body got them. 005L's purpose is to stack partial storeys, so every partial basement now hits this. The consumers are:
- the layout gate's footprint check (`layout-gate.ts:144–151`);
- the v2 world frame (`v2/frame.ts:55–57`);
- the resolver's area score (`plan-resolution.ts:376`).

Separately, `v2/reconstruct-v2.ts:391` skips `s === m.storeySpan.fromIndex`. That is the basement, so it is built at the body, the ground rectangle.

**Probe P9** (`probe-a5l-9`): a 12×17 m house, alone and then with a stated basement under its rear 8.3 m. Published footprint = 204 m².
```
alone:          groundStoreyOf -> storey-0 ;  worldFrame walled z1=17, zFlip=17 ; gate FOOTPRINT_AREA_AGREES NOTED 204 m²
with basement:  reg b STACKED fp footprint--1-mass-0 [0,0,12,8.3]
                groundStoreyOf -> storey--1 ; worldFrame walled {0,0,12,8.3} zFlip=8.3
                gate STRUCTURAL_LAYOUT_REJECTED  FOOTPRINT_AREA_WRONG BLOCKING: the lowest storey covers 99.60 m² against the 204 m²
```
With no published figure the gate does not block. v2 then registers elevations against `world.walled` depth 8.3 m instead of 17 m (`reconstruct-v2.ts:459`). Roof verges and section registration use the basement's faces (542, 820, 958). The basement ring is emitted at the ground rectangle (391, trace: `fromIndex = −1` → continue → `rectAt(m,−1)` = body).

**Generic fix.**
- Make the base storey an explicit field of the draft. The gate, frame and resolver should use the base (or GROUND-index-0) storey, not "lowest with BUILT".
- In v2, skip only the storey the mass ring was measured on (the base storey), not `fromIndex`, so a lower storey keeps its own footprint.
- Add a partial-basement fixture through the gate and v2.

## A5L-5 — P1 — the lower-exceeds guard refuses a legitimate basement larger than the ground

**Where.** `layout.ts:1743–1751`. For any storey below the base, a body `BEYOND_TOLERANCE`/`UNSUPPORTED`, or `wallsBeyond > 0`, gives NO_SUPPORT plus a MISSING gap: "the base plan does not hold the whole building". It was designed for "an upper plan read as base". For a BASEMENT below a GROUND base it fires on ordinary buildings.

**Probe P6d** (`probe-a5l-10`): basement 12×22 m, extending 5 m beyond a 12×17 m ground (under a terrace). Its chain `[40,380,480]` states where the ground ends.
```
reg b decision=NO_SUPPORT ... why: this lower storey reaches past every body of the plan the building is measured from: region-built-0-0 by 60.0 m², its walls by 60.0 m²
mass mass-0 [0,0,12,17] storeys 0..0          <- the basement storey disappears
unres MISSING: the bodies of the basement storey that the ground plan does not draw
```
Before 005L, the 50 % rule stacked this basement (clipped to the body). The registration also placed it 5 m north (offset −100 px), against its own chain break at 380.

**Generic fix.** Refuse only when the base is not the GROUND-role plan and the lower plan is GROUND: the "upper read as base" case the guard was written for. For BASEMENT below GROUND, stack the supported part and name the excess as an overhang-style DEGRADING relation. Add fixtures for both cases.

## A5L-6 — P1 — an AMBIGUOUS storey is filled with the ground ring when a higher storey stacks

**Where.** `layout.ts:1785–1789` widens `storeySpan` to `[min, max]` of the stacked storey indices, with no contiguity check. Storeys are decided independently, each against the base. `v2/reconstruct-v2.ts:380` iterates the integer range `fromIndex..toIndex`. A storey with no own footprint gets `rectAt` = body (391).

**Probe P10** (`probe-a5l-11`): fixture 2b's ambiguous upper storey plus fixture 15's stated attic.
```
reg u decision=AMBIGUOUS ...                  (nothing stacked, as designed)
reg a decision=STACKED  fp footprint-2-mass-0 [2,4,10,13]
mass storeySpan {"fromIndex":0,"toIndex":2,"storeyIds":["storey-0","storey-2"]}
```
v2 then emits storey 1 with the body rectangle `[0,0,12,17]` (204 m²). The upper plan's own region is 12×11 m, and its position was declared unknown. `NO_MASS_REACHES_UP` cannot fire, so the ambiguity survives only as a conflict.

**Generic fix.**
- Process storeys in index order. A mass reaches storey k only if it reaches k−1, or the gap storey is an explicit unresolved and is not built.
- In v2, iterate `storeySpan.storeyIds`, never the integer range.

## A5L-7 — P1 — exact-tie ambiguity is pixel-fragile; garage/wing safety rests on it

**Where.** `layout.ts:1196` sets `STOREY_TIE = 1e-6`, and 1719 compares against it. The score's resolution is about `tolerance / total major wall` ≈ 1e-3. The wall-pair hypotheses (933–946) fit the exact span of one body, so a 1 px difference between two otherwise equal bodies always produces a stretched placement that out-scores the same-scale twin by about 0.002.

**Probe P4c** (`probe-a5l-5`): two equal, distinct bodies, offset 3 m. The upper plan has no chains and draws one body that size. The east wall of body B is moved ±1 px.
```
+0px: AMBIGUOUS margin=0                                  (masses all 0..0)
+1px: STACKED margin=0.001925 chosen walls k=1.003378 -> mass-0 0..1, mass-2 0..1 ; near-tie conflict only
-1px: AMBIGUOUS margin=0
```
P4b (`probe-a5l-4`, two bodies cut as one mass) behaves the same way: +1 px or +2 px flips AMBIGUOUS to STACKED at the east position.

A 5 cm drawing difference decides which bodies get an upper storey, so on real rasters AMBIGUOUS is effectively unreachable. Fixtures 2b and 7 pass only because they are perfectly symmetric.

**Generic fix.** Derive the tie threshold from the score's resolution. For example, use the Dice change from moving one paired wall by `tolerance`: τ ≈ 2·tolerance·n_major / (k·L_other + L_base). Alternatively, re-score the top placements under ±tolerance jitter and call them tied when the order flips. When |margin| ≤ τ and the supports differ, the decision is AMBIGUOUS. Also do not let a stretched wall-pair placement beat its same-scale twin by less than the stretch it applies. Add ±1 px variants of 2b and 7 (with two real masses) as fixtures.

## A5L-8 — P1 — a parapet-enclosed roof terrace over a one-storey garage gives the garage an upper storey

**Where.** `upperBodiesOf` and `storeySupportOf` (1205, 1236). "Body" means wall fraction ≥ 0.35 and a room's span. The wall fraction counts any band of at least `minThickness` (6 px), whatever its thickness compared with the plan's exterior walls.

**Probe P3b** (`probe-a5l-3`): fixture 5's house and garage. The upper plan draws the house at full wall thickness (12 px) and a 6 px parapet round the garage roof. The upper chains span the terrace.
```
mass mass-1 [12,8,20,17] storeys 0..1 role ATTACHED
region region-built-1-1 [12,8,20,17] body=true wf=0.988 ; rel region-built-1-1->mass-1 SUPPORTS ov=8x9
fp footprint-1-mass-1 storey-1 [12,8,20,17]      (no conflict, no unresolved)
```
P3c, with the balustrade drawn as 2 px lines, holds: the garage stays 0..0. Fixture 9 avoids this only because its terrace is open on one side. A "taras nad garażem" with a masonry parapet is a routine design. This breaks §13 and §21 ("no phantom upper room over terrace/void").

**Generic fix.** For a region to SUPPORT a body, its perimeter walls must be of storey-wall thickness: band thickness ≥ about 0.75 × the plan's own exterior `wallPx`, or the decomposition's exterior-wall classification. A thin-walled enclosure becomes a typed TERRACE/PARAPET candidate: unresolved, never SUPPORTS. Add P3b as a fixture.

## A5L-9 — P2 — a heavy title-block frame beside an unscaled upper plan lifts the garage

**Probes P5 and P5b** (`probe-a5l-6`, `probe-a5l-7`): fixture 8 (no chains, 0.8 scale) plus a frame drawn to the right of the plan.
```
12px frame: one region 28.25 m wide; chosen k=1.264; mass-1 (garage) 0..1; overhang BEYOND 201.7 m² (conflict)
 6px frame: separate region-built-2-0 [11.68..22.43] SUPPORTS mass-1 (uss 0.49, BEYOND 68.5 m²); chosen k=1.000 (truth 1.25),
            house upper footprint [0,3.45,8.93,17]; garage 0..1; near-tie + overhang conflicts
 2px frame: correct (k=1.264, garage 0..0)
```
The cause is upstream: the chainless extent takes in the frame. But the support relation lets a region that mostly stands on nothing lift a second body.

**Fix.** A region whose supported share is below its unsupported share (Σ `upperSupportedShare` < 0.5, i.e. mostly overhang) should not lift any body it touches. Mark it UNSUPPORTED or uncertain.

## A5L-10 — P2 — fixture 7 does not test what it says; misleading wording

`probe-a5l-4` dumps fixture 7. The ground is read as one mass, `mass-0 [0,0,19,13]`. The AMBIGUOUS comes from footprint IoU < 0.7 on that one mass, so the different-mass-set branch of `sameSupport` (1332) is never exercised by the corpus. The registration and the unresolved then say "two placements stand it on different bodies (mass-0 against mass-0)" (1721); fixture 2b says the same.

**Fix.** Word it as "on the same body over different footprints". Add a true two-mass tie fixture (the P4c layout) and a ±1 px near-tie fixture.

## A5L-11 — P2 — a stated placement held against a better fit records nothing

**Where.** `layout.ts:974` promotes the stated placement when `shares ≥ 0.5×best` OR `insideBelow`. Then 1719 and 1726 suppress both the AMBIGUOUS decision and the near-tie conflict whenever `alignment.stated && !rival.stated`. `sameSupport` IoU ≥ 0.7 also hides 1–2 m shifts.

**Probe P7** (`probe-a5l-8`): the upper storey is flush north and set back 1.5 m south. Its longest depth chain starts at a 1.5 m balcony edge (`originPx.y = 10`). Spans are equal, so `whole()` passes.
```
chosen stated o=(0,30) sh=0.628 score 0.7948 ; better fit o=(0,0) sh=0.800 score 0.9368 (lands the bearing wall on the bearing wall)
reg u STACKED margin=-0.142 rival=undefined ; fp [0,1.5,12,17] (truth [0,0,12,15.5]) ; no conflict
```
The input class is narrow, but the rule hides every disagreement between a statement and the walls.

**Fix.** Record a DEGRADING conflict whenever a stated placement is kept with a margin below −`STOREY_RIVAL_WINDOW`, or with shares below the best fit's. Do this independently of `sameSupport`.

## A5L-12 — P2 — evidence and documentation gaps

* **Development matrix.** willa-miranda goes from 1 to 2 storeys with L1 = two rings totalling 12.09 m², over a 167 m² ground; one of those rings stands on a 2.45 m strip mass. dom-w-tunbergiach L2 is 8.92 m² (2.5 × 3.5 m). Both match the "small region stands on a body over ≥ minSpan" pattern. The stage report should explain them (I could not, without the sources).
* **D00.** Levels read `floors [0, 13.04]`. That is for another reviewer, but the row is being counted as a two-storey stack.
* **Missing tests.** There is no basement fixture and no test of the lower-exceeds guard or `wallsBeyond` anywhere in `packages/reconstruction/test` or `tests/`.
* **Understated bound.** architecture.md §7 says "wall pairs ≤ (4·4)² per axis". `outerWallAxes` adds up to 4 decomposition lines to lows/highs, so it is up to (6·6)² per axis and about 1.7 M crossing iterations in the worst case. That is still bounded and cheap, but the documentation should state the real bound.

---

## What I attacked that held

* **Order invariance.** Permuting frames reproduces the same registrations, decisions and footprint order: fixture 16 for ground + upper, P10 for three plans. The sort at 951 is a total order on each placement's own numbers, and the dedupe/rival choice is deterministic.
* **Exact ties.** Fixtures 2b, 7, and P4b/P4c at 0 px stay AMBIGUOUS and stack nothing on their own; P10 is the exception.
* **Incidental sliver over the garage** (5b, 0.6 m): INCIDENTAL, carries nothing.
* **Thin 2 px balustrade lines over the garage** (P3c): not a body, garage stays one storey.
* **Title block drawn in thin lines** (P5b, 2 px): excluded; registration k = 1.264 against a true 1.25.
* **Upper chains only of the house** (P3d): the extent excludes the terrace, garage 0..0.
* **Light wells drawn outside a basement plan** (P6a/b): not in the decomposition; basement stacked correctly.
* **Hypothesis set is bounded**: targets ≤ regions + 2, fixed offsets, a wall-pair agreement filter, ≤ 24 rivals. Probes produced 9–53 distinct candidates.
* **Stated-vs-unstated tie-break** is deterministic.
* **AMBIGUOUS writes no footprint for its own storey** (but see A5L-6).
* **Fixtures 3, 4, 10, 11, 13 and 15** behave as claimed when the chains are whole and the walls are at full thickness.
