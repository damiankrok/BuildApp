# 005Q Phase A: dom-w-krasnokwiatach forensics (agent key `krasno`)

> Phase A working draft by an independent read-only agent, committed as written (scratch paths shown as `$W`, a directory outside the repository; publisher rasters were read there and are not committed). Where it disagrees with `first-bad-boundary.md`, the disagreement is stated there.

Base: the repository at 04d5568 (read-only). All line numbers are at 04d5568. Scratch: `$W/agents/krasno/`.
The variant copy `v1/` is v-probe plus env-gated probes and counterfactual switches. With no `CF_*` set it is byte-identical to B0:
`runs/D1`, `D2`, `D3` and `CFa0` have `failure.json` and `plan-diagnostics/digest.json` identical (cmp) to `runs/B0`.

Labels used throughout:
- **KNOWN**: reproduced from code or data, with a file:line or a run.
- **INFERRED**: reasoned, not reproduced.
- **UNAVAILABLE**: cannot be determined from what is here.

Selected frame: `frame-asset-rzut-071d5075ee-723651b1ff`, 853×853 px, mpp 0.02511 × 0.025114 (2.511 cm/px, correct).
- wallPx 18.03125
- extent 154.5..535 × 77..718 (DIMENSION_CHAIN_EXTENT on both axes; 950 × 1610 cm)
- chain Y ticks 77 | 248 | 559 | 718 (430 | 780 | 400)

## 0. What the drawing shows (KNOWN from the decoded plan in scratch; pixel coordinates of the plan)

| piece | px rect | m² at 2.511 cm/px | what is drawn |
| --- | --- | --- | --- |
| N wing: living room 4 | 262..535 × 77..248 | 29.44 | N face: wall 259..317 + 400/170 window (317..476, 3.99 m) + wall 476..534. W face: wall 77..183, a 180/230 double terrace door 183..245, and the dining room's corner pier 245..267. E face: continuous wall |
| NW covered terrace | 155..262 × 77..248 | 11.54 | a post at 155..177 × 77..98; N open (177..259); W open (99..248); paving runs on W of x=155, outside the extent. The roof covers it (site-plan roof outline spans the full N width; view 1 shows the roof and a column). Roof coverage is INFERRED |
| middle strip (the box) | 155..535 × 248..559 | 74.53 | dining/kitchen (W), hall, stair, bath, boiler, pantry, garage N part. Dining N face at y 248..265: piers 155..183 and 254..278 with the 180/230 glazing between. Kitchen S wall 203..306 at y 542..559 |
| S: garage 8 (part S of 559) | 365..535 × 559..718 | 17.05 | W wall piers 365..393 (to 593) and 664..719 with a 180/90 window; E wall continuous with a 90/120 window; S: 285/229 garage door between piers 365..393 and 504..534 |
| S: entrance porch | 262..365 × 559..718 | 10.33 | entrance door 150/210 at y 559 (x 306..365); post at 263..284 × 697..718; open S (285..365) and W. The roof covers it (view 1 shows the porch roof and a column; the site-plan roof notch is only W of about x 238). Roof coverage is INFERRED |
| S: planting strip | about 226..262 × 559..760 | about 2.7 | shrub symbols in dark ink. The band extractor reads them as wall-thick bands (KNOWN: bands at x 229..261, y 622/662/700, thickness 19; vertical band 233..238 × 624..752, thickness 19.75, length 129, "long") |

Area check:
- walled 29.44 + 74.53 + 17.05 = **121.02 m²**;
- plus terrace 11.54 and porch 10.33 = **142.89 m²**, against the published 143.18 m² (−0.2 %).

The KNOWN part is the arithmetic. INFERRED: the publisher's "powierzchnia zabudowy" includes both roofed open areas. A correct reconstruction that keeps them open therefore lands near −15.5 % (NEAR, DEGRADING), not AGREES.

## (1) Readings tried and why each failed

Sources: KNOWN from the trace, the digest, and the probe `READING` records (`runs/D2`, `plan-resolution.ts` after :702).

- Resolver 1.5.0 counts: copies 4, decompositions 12, readings 47, distinct outlines 28, compositions 0, publishedFigure SPENT.
- Decompositions:
  - area-table copy 1811c28eab: {chain, wall-ink, wall-witness} × REG = 3;
  - dimensioned 723651b1ff: {chain, wall-ink, wall-witness} × {REG, METRIC_HYPOTHESIS 2.750413 cm/px} = 6;
  - dimensioned 098585a6fe (400 px copy): 3.

  That is 12 × 4 tilings/faces = 48, less the incumbent = 47.
- Every reading is footprint-WRONG, so the stage-2 shortlist (`plan-resolution.ts:706`: bucket ≠ WRONG) is empty: compositions 0, INCONCLUSIVE. Ranges:
  - 1811c28eab: chain/wall-ink 46.6–47.2 m² (walled-first) or 33.0 (largest-first); wall-witness 7.1–8.3;
  - 723651b1ff: REG 9.1–26.8; 2.750 cm/px 11.6–31.8;
  - 098585a6fe: 3.2–15.1.
- **The cause is invariant across all 47.** The CORE probe shows the same envelope 155..535 × 248..559 on both 853 px copies (records 0, 5, 8, 12, 31, 34), whatever the extent, scale, tiling or faces. The resolver's axes do not include the envelope, so no reading could escape the 780 strip.
- The incumbent: core regions BUILT 155..262 × 248..559 (20.97 m²) and 364.5..535 × 248..358 (11.82 m²).
- The 11.67 m² (KNOWN, `runs/D3` probe `ADMIT`): `layout.ts:1794` drops the W wing at wall fraction 0.245 < `MIN_MASS_WALL_FRACTION` 0.35 (`layout.ts:321`). Its E side, open into unbuilt hall cells, counts as unwalled perimeter in `perimeterWallEvidence` (`layout.ts:1565-1602`, `builtElsewhere` is set only on outline-cut plans). Only mass-0 (0.704) survives, at 11.67 m² against 143.18 → FOOTPRINT_AREA_WRONG (`layout-gate.ts:151`).

## (2) Why the long-band box is only the 780 strip

KNOWN, `plan-decomposition.ts`:
- `longBands` :876 is length ≥ 2.5 · wallPx = 45.08 px;
- `axisBox` :879;
- `walledEnvelope` :1227, with :1238-1241 then snap :1244-1256 (tolerance = wallPx);
- `sideWallReach` :1302-1350.

**Long horizontal bands (all of them):**

| axis y | x range | thickness | what it is |
| --- | --- | --- | --- |
| 252 | 373..423 | 28 | fireplace + living/stair partition, merged |
| 261 | 425..515 | 11 | partition |
| 358 | 438..515 | 11 | partition |
| 550.5 | 203..302 | 18 | kitchen S wall |

**Bands that are not long:**
- The N facade has only 85.5 (476..515, length 40 < 45.08). The W pier 259..317 yields no horizontal band; its ink sits inside the vertical band 267.75 (260..277 × 61..177). That last part is INFERRED.
- The S facade has none: the garage piers are vertical stubs (373.5: 552..592 and 664..700, lengths 41/37), and the shrubs give 33 px bands.

**Building the box:**
- `axisBox` gives y0 = 252 − 9.016 = 242.98 and y1 = 550.5 + 9.016 = 559.52.
- Vertical long axes are 163.5, 235.5 (the shrub column), 267.75, 377.5, 433 and 524.5, so x0 = 154.48 and x1 = 533.52.
- `sideWallReach` changes nothing:
  - Vertical pass: the W side band 163.5 runs only y 362..491, while the E side band 524.5 runs 95..700.
    - far: farEnd = 491 < e1, and |endA − endB| = 209 > 2W, so it fails (:1336).
    - near: e0 − nearEnd = 242.98 − 362 < 0, so it fails (:1337) before `endsOnPartition` (:1328) matters.
  - Horizontal pass: endA 515 / endB 302, start 373 / 203, so it fails.
- Snap: 242.98 → 248 (5.02 px), 559.52 → 559, 154.48 → 155, 533.52 → 535.

**The plan is stepped**, so no pair of side walls spans both projections:
- the N projection's W face is x 262;
- the S projection's W face is x 365;
- only the E wall runs through.

**What is drawn on the N face (y about 77):**
- wall 259..317;
- the 400/170 window 317..476: Y=77 line gap 3.99 m, UNKNOWN_GAP WEAK LEAF_AXIS, callout 400;
- wall 476..534;
- a post 155..177 (terrace);
- an open gap 177..259 (terrace mouth, TRUE_EXTERIOR, DASHED, POST jamb).

**What is drawn on the S face (y about 700..718):**
- piers 365..393 and 504..534;
- the garage door 393..506: 2.84 m, read **STRONG LEAF_FACE vehicle door**, bridged;
- the porch mouth 285..365: 2.01 m TRUE_EXTERIOR BLANK beside POST 226..285 (porch post merged with shrubs);
- no long band.

## (3) The opening-aware outline, and why the N body is not a completion

**What the outline encloses (KNOWN, `runs/D1` BDETAIL):**
- The EXCLUSION outline is identical to STRICT and encloses 109 shadow-grid cells, 17.74 m². These are essentially wall-thickness strips: E wall, garage walls, shrub strip.
- Of the living room's about 29 m² it encloses 2.84 m² (strips), none of the terrace, and 7.38 m² of the box interior.

**It leaks at six facade gaps.** All are KNOWN gap reads (`boundary-evidence.ts` :571-621; posts are parts ≤ 2.5 walls both ways, :123):

| gap id | what it is | read as | rule |
| --- | --- | --- | --- |
| gap-X-262-183-245 (and X-272-183-243) | 180/230 terrace door, living room W | TRUE_EXTERIOR NONE, DASHED, jambs WALL/POST | `FREE_STANDING_BLOCK` :621. The S jamb is the dining corner pier, read as a POST |
| gap-Y-248-183-254 | dining N 180/230 glazing | TRUE_EXTERIOR NONE, GLAZING, jambs POST/POST | glazing between piers is bridged only if posts < 2 (:614) |
| gap-X-155-307-362 and gap-X-155-277-293 | dining W window | TRUE_EXTERIOR DASHED POST/WALL, and WEAK pocket | |
| gap-Y-559-306-365 | entrance door 150/210 | WEAK DASHED | left as a pocket mouth: exposed 0 ≤ limit 6, because the hall behind was already flooded |
| gap-X-535-587-622 | garage E window 90/120 | WEAK LEAF_FACE | pocket, exposed 0 |

Leak path into the living room (KNOWN, `leak.py`): outside → Y=77 at x 252.5..262 → down the column → X=262 at y 168..201.5 (the terrace door) → X=272 → living room.

**Why the N body is in no completion record (KNOWN):**
- `completeBoundary` judges only components with `outline.inside === 1` (`boundary-completion.ts:639`). The living room's cells are outside the outline, so it never becomes a part. No guard is reached.
- The N-side parts that were judged:
  - E-wall sliver 514..535 × 77..248 (2.26 m²): WALL_SLIVER (:553);
  - 262..272 × 77..168 (0.57 m²): WALL_SLIVER.
- The first sliver "reaches" N, so the conflict flips ZONE → INCONCLUSIVE (:588-591) with the text "something enclosed reaches the N side … fails the attached-room guards". That text is misleading: the something is a wall's thickness.
- S:
  - garage S part 364.5..535 × 559..718 (5.48 m² clipped): WALLED_OFF, because house = builtA and the garage N half is not built;
  - shrub strip 235.5..272 × 628..718: WALLED_OFF.

**Where the UNKNOWN 38.1 m² body comes from (KNOWN):**
- It is `classifyBodies` (`boundary-bodies.ts:142`) over the relaxed enclosure (:97-140, every gap ≤ 8 m bridged).
- Grouping by `inPart` ignores edges (:150, :175), so the living room and the NW terrace merge into one body:
  - 155..514 × 77..248;
  - junction 9.01 m, 29 % wall;
  - sides 22.17 m, 51 % wall, 5 % posts;
  - mouth gap-Y-77-317-476 (the 400 window, LEAF_AXIS).
- None of these names applies, so UNKNOWN, not built.

**If the living room were a part.** The counterfactual guard values are measured: `runs/CFa6`, with the six leaks force-bridged and 005C adoption disabled so that 005F judges it. The part is 262..504 × 77..248, 26.10 m².

| guard | measured | result |
| --- | --- | --- |
| way in | open 2.32 m ≥ 0.7 | ✓ |
| side wall share | 0.524 ≥ 0.5 | ✓ |
| posts | 0.028 < 0.1 | ✓ |
| room evidence | glazing 0, chains 1 | ✓ |
| returns | W lines 252.5 / 262 / 272 cover 0.608 / 0.620 / 0.620 < 0.75 (the terrace door takes 62 px of 171); only the E return counts | **NO_RETURNS** (:571) |
| size cap (`CF_RETURN_COVER=0.6`, CFa7) | 26.10 > 0.5 × builtM2 32.81 = 16.41 | **QUESTION TOO_LARGE** (:577) |
| policies (`CF_CAP=EXTENT`, CFa8) | strictEncloses false; the 400 window is WEAK, so STRICT does not close it | **QUESTION POLICIES_DISAGREE** (:580) |

Three successive guards would hold it, and all are moot in production because of the leaks.

## (4) What is genuinely open on the S side (and N)

All three of these must stay open:

1. **Entrance porch 262..365 × 559..718 (10.33 m²).**
   - Evidence: post 263..284 × 697..718; S mouth 2.01 m blank; W side open/posts; entrance door 150/210 on its N side; roof in view 1.
   - Production names it COVERED_TERRACE (235.5..364.5 × 559..718, posts 32 %, wall 20 %).
2. **Planting strip about 226..262.** Shrub symbols, not built. Production: SEPARATE_BODY 1.6 m², posts 100 %.
3. **NW covered terrace 155..262 × 77..248.** Production merges it into the UNKNOWN body. With the terrace door bridged (CFa1, CFa5) it becomes its own COVERED_TERRACE, 11.54 m², not built.

These are walled and must be built:
- garage S part (365..535 × 559..718: piers, windows, vehicle door read STRONG);
- living room.

## (5) Counterfactuals (own variant, one replay at a time, all on the identical sealed inputs)

| run | change | outcome |
| --- | --- | --- |
| CFa0 | `CF_CAP=EXTENT`: size cap relative to the chain-extent area, 153.8 m² | **byte-identical to B0** (failure and digest). Predicted: the cap is never reached because no N room part exists |
| CFa1 | bridge the terrace door only | the terrace splits off as COVERED_TERRACE 11.54 m² (correct name); the living room is still not enclosed (now leaks via the dining-hall interior, which floods from Y=248 183..254); outcome unchanged, 11.67 m² |
| CFa5 | bridge all 6 facade leaks | outline 109.5 m². 005C adoption builds the living room (PROJECTING_WING 26.10) and the garage S (PROJECTING_WING 15.36); the NW terrace and the porch stay COVERED_TERRACE (unbuilt). But STRICT stays 32.8 m² → BOUNDARY_RESOLUTION_INCONCLUSIVE. First reading 104.03 m² (−27.3 %); best resolver reading 120.2 m² (−16.0 %). A **false-scale** reading (2.750 cm/px, +9.5 %) reaches 145.4 m² (+1.6 %): 121.02 × (2.7504 / 2.511)² = 145.2 |
| CFa6–CFa8 | as (3): leaks bridged, adoption off, then returns 0.6, then cap EXTENT | NO_RETURNS → TOO_LARGE → POLICIES_DISAGREE |
| CFb | `CF_EXTENT_FACE`: lead (b). A box edge on a printed tick of a chain that STRONGLY states the side ≥ 2 walls beyond moves to that side (248 → 77, 559 → 718; also on 1811c28eab) | details below |
| CFb6 | CFb + the 6 bridges | identical to CFb (the box already covers the outline) |

CFb in detail:
- Core BUILT:
  - 262..535 × 77..559 (82.97);
  - 155..262 × 248..559;
  - garage 364.5..535 × 559..718;
  - shrub strip 235.5..262 × 559..718.
- RECESS: 262..295 × 559..718 and 235.5..262 × 77..248. The terrace (155..235.5) and the porch E part are outside. **The terrace and the porch stay unbuilt.**
- Admission:
  - drops the dining/kitchen wing (0.245) and garage S (0.319);
  - **admits the shrub strip as a mass (0.658): a fabricated 4.2 m² body**.
- Result 85.08 m², still FOOTPRINT_AREA_WRONG (−40.6 %).

Not run: a fix that combines a correct envelope with the pier/door gap reads. The CF set above brackets it.

## Verdict on 005P's statement

- **"780/1610": correct (KNOWN).** The box spans 311 px = 781 cm; the extent spans 641 px = 1610 cm.
- **"box snapped to an interior partition merged with the fireplace symbol": partly correct, not causal.**
  - Correct part: the governing band is the 28 px fireplace + partition (axis 252).
  - But the line it snaps to (248) is the printed chain tick 430|780, the dining wing's real exterior N face.
  - Removing that band gives the same box: band 261 → 251.98 → snaps to 248 (arithmetic).
  - The causes are:
    - no long band on the N and S facades (pier and opening facades);
    - a stepped plan, which defeats `sideWallReach` (the W side band starts at 362, inside the box).
- **"makes sideWallReach read the box as ending on a facade": true but not decisive.** `endsOnPartition` returns false because 28 ≥ 12.6, but the `near` condition fails first.
- **"The garage door, outside the envelope, was never read as a wide opening, so the flood leaked into the hall": incorrect as to mechanism.**
  - The outline reads the garage door as a STRONG vehicle door.
  - The core floods the hall and the garage N part because every cell outside the envelope is seeded as outside (`plan-decomposition.ts:2021-2031`), and the box edges cut through the living room (Y=248 open 278..373) and the garage (Y=559 open 383..516).
  - CFb confirms it: with the box on the extent, the hall is built.
- **"the N strip merged with the covered terrace, the window an open mouth; garage WALLED_OFF": true of the bodies.** But it does not explain INCONCLUSIVE (a wall sliver did), and the living room was never judged.

## Design implications (evidence-backed)

1. **Enlarging the box to the STRONG extent alone is unsafe.**
   - It fabricates the shrub-strip body.
   - It leaves admission dropping the walled wings at per-rectangle wall fractions (0.245, 0.319).
   - Any envelope fix must not let dark landscape ink count as wall.
2. **Relaxing the size cap alone does nothing (CFa0 byte-identical).** The binding defect upstream is the outline leak.
3. **The leaks are pier and door reads.**
   - Isolated corner piers become POST jambs, so glazing between two piers and a door beside one pier read as "not a wall" (`boundary-evidence.ts:614`, :621).
   - Pocket mouths are judged after the interior is already flooded (exposed 0).
   - A fix there must keep the NW post (155..177) and the porch post (263..284) as posts. In CFa5 both terraces still came out COVERED_TERRACE.
4. **Do not let the published footprint choose.**
   - The correct walled answer is about 121 m², −15.5 %; covered terrace and porch are excluded by the house rules.
   - A +9.5 % false scale fits 143.18 to 1.6 %.
5. **The conflict "why" text should name what reached the side**, here a wall sliver, so INCONCLUSIVE is not mistaken for a judged room.
