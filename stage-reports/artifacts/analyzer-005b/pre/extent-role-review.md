# Reviewer C — plan extent and dimension-chain role (BUILDPLAN-ANALYZER-005B targeted precheck)

- **Repository:** `/home/user/BuildApp`, branch `analyzer/dimension-evidence-refoundation-v1`, HEAD `bdacd42`. Read-only review.
- **Line numbers:** every `file:line` below is at HEAD and under `packages/reconstruction/src/`, unless it names another package.
  - `packages/reconstruction` has no uncommitted changes.
  - The working tree does have uncommitted edits in `packages/source-metrics/src/chains.ts` and `ocr.ts`. They belong to other work and were not reviewed.
- **Evidence used:**
  - the sealed holdout digests and metric evidence (`stage-reports/artifacts/analyzer-005a/holdout/h{1,2}-*/`);
  - the development digests (`.../analyzer-005a/before/*/plan-diagnostics/digest.json`);
  - the metric evidence for e-OZE and Kosaćce.
- **How the extent was reproduced.** The production `dimensionedExtent`, `planExtent` and `bandWallThickness` were imported through `vite-node` and run on the sealed `DimensionChain`s and the digest bands. The digest does not seal band length or axis, so they were rebuilt from the bounds:
  - `length` is the run plus 1;
  - `axisPx` is the midpoint across the band.

  That matches the sealed extent, `weak` flag and envelope on all four plans (h1 GROUND/ATTIC, h2 GROUND/UPPER). The one exception is h1's `y1`, which comes out 795 against the sealed 794.75, because a merged band's axis is a running average.
- **What is only a proxy.** No raster is sealed, so `wallClusterExtent` (which works on the ink mask) cannot be re-run. The "wall-only" extents below come from a **band proxy**:
  - wall-thick bands, meaning a thickness of at least 0.6 walls (the mask opening in `wallClusterExtent` removes anything thinner);
  - joined when within 8 walls, the same join as `wallClusterExtent`;
  - the largest cluster by ink.

  Numbers from it are marked **PROXY**. The pipeline was not run.

---

## Verdict in five lines

1. Today nothing makes a chain "outer" except **width among the chains that carry a READ or CHAIN_CORRECTED segment**. Position, nesting, stacking, wall faces and coverage are never tested.
   - An unread overall chain is invisible, both to the extent and to the grid.
2. The `weak` vote cannot see a wrong depth when the width is right, for three reasons:
   - vertical walls vote only on X, and horizontal walls only on Y;
   - the two axes are pooled into one number;
   - walls outside a window sized by the chain under test are thrown away rather than counted against it.
3. Everything downstream is filtered by the chosen extent: the band set, the wall thickness, the grid lines and the envelope. So no later stage can witness against it. The resolver's two "extent" readings are one `planExtent` rectangle and one whole-sheet wall rectangle; neither is per axis or role-aware.
4. The defect is not new. The development house **e-OZE has the same shape**: a 68.5 px interior Y chain, with the overall chain unread, and `weak: false`. 005A routed around it through the resolver rather than fixing it.
5. The fix should classify every chain's **role geometrically, independent of the printed value**:
   - refuse interior and partial chains as width or depth;
   - generate **per-axis** extent hypotheses with typed provenance, ranked by role first;
   - keep the first reading byte-identical whenever its extent chains pass the role tests. They do on all four accepted runs (measured by PROXY on the sealed digests).

---

## Findings

| # | Sev | Where | Finding | Sealed evidence |
|---|---|---|---|---|
| F1 | **P0** | `plan-decomposition.ts:706-736` (`:711-712` filter, `:728` "widest wins", `:732-733` X from HORIZONTAL and Y from VERTICAL) | `dimensionedExtent` has **no notion of an outer chain**. For each axis it takes the widest chain that has at least one `READ` or `CHAIN_CORRECTED` segment. It never tests where the chain's baseline sits relative to the walls, whether its ticks land on the outermost wall faces, whether another chain encloses it, or what its role is. A chain whose segments are all unread is skipped (`read.length === 0 → continue`), however well it fits the walls. | **h2 Y** takes V@x=375: 94.5 px, interior, ticks 355/385/407/449.5. It skips V@x=35 and V@x=69.5 (526 px, 84.5–610.5, outside the left wall, with all four ticks on horizontal wall faces).<br>**h1 X** takes H@y=568 (297–593, interior) and skips H@y=828 (83.5–602.5, below the building, ending on the wing's outer face at 84 and the right wall's outer face at 605).<br>**e-OZE (development) Y** takes V@x=485 (68.5 px) and skips V@x=24 (230–578.5). |
| F2 | **P0** | `plan-decomposition.ts:790-793` (`within`), `:806-813` (pooled vote) | **The `weak` vote does not look along each axis, and it pools the axes.**<br>– `within` tests only the band's position across its own run: x for a vertical band, y for a horizontal one. It never asks where the band **runs**, so a vertical wall votes only on X and a horizontal wall only on Y.<br>– `held` and `loose` are then summed over both axes, so an axis that is right outvotes one that is wrong. | **h2:** the vertical walls give held 1479 px against loose 36 px, while the horizontal walls on Y actually vote **against** the chain (held 67, loose 223). The pooled totals are held 1546 and loose 259, so `weak: false`.<br>The right exterior wall V@785.5 is 401 px long, of which only 24 % runs inside the 94.5 px strip, yet its full length counts as held. |
| F3 | **P0** | `plan-decomposition.ts:799-806` (`margin = 0.35`, `near`) | **The window in which walls may contradict a chain rectangle is sized by that rectangle.** Bands outside it are neither held nor loose; they are dropped as "title block".<br>– A short wrong chain gives a tiny window, which drops the building's own walls.<br>– A wide one admits sheet furniture.<br>This is ASSUMP-WALL-001 in its true form. | **h2:** the window is ±33 px, and 7 long horizontal bands (702 px) fall outside it. Of those, 459 px are the house's own walls: y=184.5 (184 px), 510.5 (202), 270 (43) and 84 (30).<br>**e-OZE:** all 12 long horizontal bands (1504 px) are dropped, leaving held 1033 against loose 0.<br>**h1:** the window runs from x=193.4 to 696.6. It drops the wing's walls at x=94 (3 bands, 256 px, 21 px thick) and admits the bottom-right corner cluster (V@694, H@785). |
| F4 | P1 | `plan-decomposition.ts:711`, and the origin at `source-metrics/src/chains.ts:781` | **`CHAIN_CORRECTED` counts as "read".** A value the chain solver rewrote to fit its own scale qualifies a chain to set the building's extent. | **h2 Y** stands on OCR "510" rewritten to 114 cm (confidence 0.19). **h1 GROUND** has **no READ segment at all**: all 6 are rewrites ("513→313", "170→120", "46→96", "25→83", "501→107", "006→806", confidence 0.12–0.30). Its X comes from "46→96" and its Y from "006→806". |
| F5 | P1 | `plan-decomposition.ts:719-727` | **The end-trim rule is a length-ratio stand-in for a face test**, and it runs the wrong way. The cut-off is half of the chain's **own shortest read segment**, so:<br>– a chain whose only read span is long gets trimmed down to it;<br>– a short interior chain survives whole. | **h1 H@302:** the ticks span 95–590.3 (495 px, wall axis to wall axis, wing included) and it is trimmed to 329.5–496 (166.5 px) because its only read span is 166.5 px.<br>**h2 V@375:** the cut-off is 21 px, so it is kept whole.<br>The h1 Y trim (56.5–237 removed from V@780.5) was right, but for the wrong reason: that span runs beyond the top wall face (an OFFSET), which the rule never checks. |
| F6 | P1 | `plan-decomposition.ts:814,817` (`widen`); `layout.ts:264,291,392`; `plan-diagnostics.ts:44-46` | **The provenance of an extent is untyped, and `weak` has almost no effect.**<br>– `widen()` merges the chain rectangle and a wall box into one rectangle, so the source of each side is lost.<br>– `weak` only adds 1 to `chooseBasePlan` (`layout.ts:392`) and appears in the digest. It refuses nothing, generates nothing and lowers no provenance.<br>– The resolver's wall-ink extent is hard-set to `weak: false` (`layout.ts:264`).<br>– The only record of where an extent came from is the free-text `extentWhy`. | Kosaćce X (accepted run) is 46–742.5: the chain gives 46–736 and the wall box widens it by 6.5 px. The provenance is mixed and not recorded.<br>h2 and e-OZE both have `extentWeak: false`, though the chain extent covers **0.22** and **0.09** of the wall witness on Y (PROXY). |
| F7 | P1 | `plan-decomposition.ts:1222-1230` (60 % band filter), `:1231` (wall thickness re-measured), `:1241` with `:835-888` (`walledEnvelope`) | **The walled envelope is a function of the extent it ought to check.**<br>– `decomposePlan` keeps only bands whose axis lies inside the extent and 60 % of whose run does.<br>– It re-measures the wall thickness from those bands alone.<br>– `walledEnvelope` then boxes the survivors and snaps them to chain lines. | **h2:** 9 of 46 bands survive, and the wall thickness falls from **12 px to 7 px**. The right exterior wall (401 px) is dropped. The envelope is 234.5–549 × 385–429, reproduced exactly.<br>**h1:** the corner-cluster stroke H@785 (10 px thick) survives, so the envelope reaches `y1 = 784.75`. The wing is dropped. |
| F8 | P1 | `plan-decomposition.ts:398` (`valueCm === undefined → continue`), `:374-375,401,418` (clip to the extent) | **Ticks of an unread chain never become grid lines**, although they are drawn geometry sitting on wall faces. Grid lines are also clipped to the extent. So a correct wall-only rectangle still has no lines on its outer faces unless a wall band there reaches `minBandCoverage` 0.18 or runs wall to wall. | On h2 the unread V@69.5 ticks (84.5/176/519/610.5) sit on the outer faces of the 2.45 m front and back bays, and none becomes a line. The top and bottom walls of those bays survive only as 26 px and 21 px pieces.<br>This is how the resolver's wall-ink reading also missed the depth: 4 bodies, 71.3 m², `DEGENERATE_GEOMETRY`. That mechanism is **inferred**, because the reading's decomposition is not sealed. |
| F9 | P1 | `plan-resolution.ts:505-509` (extent axis), `:491-497` and `:353` (CROSS_COPY) | **The resolver's extent axis is one of two whole rectangles.**<br>– `CHAIN_RECT` *is* the first reading's `planExtent` rectangle, identical by construction.<br>– `WALL_MASS_CLUSTER` is the wall-ink box.<br>There is no mixing per axis: h2 needs the chain's X with another source's Y, and h1 the reverse. There is no role-based chain alternative. A sibling copy's reading of the same chain is never offered as an extent: CROSS_COPY only corroborates finished bodies, through that copy's **wall cluster**. | h2's area-table copy `c2d04897b9` has the same 853 px geometry and the same registration origin (89, 84.5). It read V@69.5 as 245 and 920 (CHAIN_CORRECTED, from OCR "205" and "420"), and its `dimensionedExtent` is **234.5–794 × 84.5–610.5 = 15.00 × 14.10 m**, the correct building. That rectangle never reached the dimensioned copy. |
| F10 | P1 | `plan-decomposition.ts:749-765,785` (`axisBox` over all long bands); `:1781-1813` (`wallClusterExtent`) | **Wall-only witnesses are not filtered for publisher sheet furniture.** Every 853 px ARCHON plan in the sealed digests (9 of 9, across 6 houses) carries strokes in the bottom-right corner, at roughly x 572–832, y 753–832: 3 strokes on the Marcówki attic, 9–14 on the others. They are 9–12 px thick (plus 33–36 px blobs on h1). Their thickness is fixed in pixels while the walls range from 10 to 21 px, so on sheets with thin walls they pass for walls. | `axisBox` over all long bands on h2 gives **15.67 × 19.96 m**. On h1 the extent's `x1 = 704` and `y1 = 795` come from V 689–699 × 765–822 and H 583–771 × 778–792. Both lie inside that corner cluster.<br>**Correction to section Z and the holdout README** ("runs onto the terrace, to 704 px"): the band that sets 704 is in the corner cluster, not the terrace band H@474. This comes from the band data only; no image was viewed. |
| F11 | P2 | `plan-decomposition.ts:734`, `:786-788` | **One missing axis throws away both.** `dimensionedExtent` returns null if either axis lacks a read chain, and `planExtent` then falls back to the box of every long band on the sheet, sheet furniture included. | On h2, had the two CHAIN_CORRECTED V chains stayed unread, the extent would have been 237–821.5 × 78–828.5. |
| F12 | P2 | `v2/frame.ts:186-236`, `:244` | `outerWallFaces` is a pixel-only face scanner, which makes it a good witness. But its one caller passes `plan.extent` ± 3 walls as the search region, which carries the same circularity as F7. | — |
| F13 | P2 | `plan-resolution.ts:338` | The resolver's wall-coverage score is measured within `cluster ?? base.extent`, so with no cluster a reading is scored inside its own extent. This only affects ranking. | — |
| F14 | P2 | `council/pre/03-assumption-register.md` rows 19, 20 and 23 | The register's line numbers have drifted: ASSUMP-DIMENSION-002 is now `:706-736`, ASSUMP-WALL-001 `:1222-1230`, and ASSUMP-ENVELOPE-001 `:835-888`. | — |
| F15 | P2 | (scope note) | **The right extent is necessary but not sufficient on h2.** The only reading that already had the correct Y extent (`c2d04897b9`, chain extent) still came out at 101.3–103.8 m², WRONG at −39 to −40 %. Why cannot be told from what is sealed. The extent fix must be judged end to end on the dimensioned copy, not by the extent alone. | resolver `reading1`–`reading3` |

---

## Reproduction from sealed evidence

### R1. willa-miranda GROUND `7102a805c6` (853 px, sheet wall 12 px, registered scale 2.6808 / 2.659 cm/px)

**Vertical chains (the Y axis).** Segment origins are from `metric-evidence.json`.

| chain (baseline x) | ticks | segments (px): origin → value | outside the walls? | used by `dimensionedExtent`? |
|---|---|---|---|---|
| V@35 | 84.5, 610.5 | 526: unread | yes, 200 px left of the wall face at x=235 | no (nothing read) |
| V@69.5 | 84.5, 176, 519, 610.5 | 91.5 / 343 / 91.5: all unread | yes, 165.5 px left | no (nothing read) |
| V@273.5 | 460, 480.5, 501 | 20.5 unread; 20.5 CHAIN_CORRECTED "50" (conf 0.18) | inside | candidate, 41 px |
| **V@375** | 355, 385, 407, 449.5 | 30 DERIVED 80.4; 22 DERIVED 59.0; **42.5 CHAIN_CORRECTED 114 (OCR "510", conf 0.19)** | **inside**: wall ink on both sides, minority share 0.28 | **chosen, 94.5 px** |

Each tick of V@69.5 lies within 1 px of a horizontal wall-thick face:

| tick | wall face |
|---|---|
| 84.5 | top wall of the front bay (band 385–410 × 85–101, 17 px thick) |
| 176 | H@184.5 (`y0` = 176) |
| 519 | H@510.5 (`y1` = 519) |
| 610.5 | H@602 (`y1` = 610) |

What each chain is in metres:

| span | px | at the X scale | at the Y scale | printed |
|---|---|---|---|---|
| V@69.5 bay | 91.5 | **2.45 m** | — | 245 |
| V@69.5 middle | 343 | **9.195 m** | — | 920 |
| V@35 total | 526 | **14.10 m** | 13.99 m | 1410 |
| V@375 (chosen) | 94.5 | 2.53 m | 2.51 m | — |

1. **`dimensionedExtent`.** For the X axis, H@745 (89–794) is trimmed at its left end: the segment 89–234.5 (145.5 px) is DERIVED and shorter than the cut-off of 279.75 px, which leaves 234.5–794 and ties with H@711. For the Y axis, V@375 wins: its cut-off is 21.25 px and nothing is trimmed. **The chain rectangle is 234.5–794 × 355–449.5.**
2. **`planExtent`.**
   - The long bands (28, at least 30 px) are filtered through `near` = x 38.7–989.8, y 321.9–482.6, which leaves 21 candidates. Of those, 18 lie `within` the chain rectangle.
   - The vote comes out held 1546 against loose 259, split by axis as follows.

     | walls | held | loose | dropped by `near` |
     |---|---|---|---|
     | vertical (vote on X only) | 1479 | 36 | 0 |
     | horizontal (vote on Y only) | 67 | 223 | 702 (459 of it the house's own walls) |

   - `held >= loose`, so the result is `weak: false`. Widening by `axisBox(inside)`, which reaches 237–793.5 × 423–435, changes nothing.
   - The run-aware and per-axis count the code does not make would be very different. Over all long bands, run inside the rectangle is **449.5 px against 2029.5 px** outside.
3. **`decomposePlan`.**
   - The 60 % filter keeps 9 of 46 bands: H@391, H@429, V@243 (369–459), V@338.5, V@339, V@400 ×2, V@469.5 and V@545.5.
   - The wall thickness is re-measured at **7 px**.
   - The grid has `linesY = [355, 385, 407, 429, 449.5]` and 14 lines in X, which gives 13 × 4 = **52 cells**.
   - The envelope is 234.5–549 × 385–429, **2 cells enclose**, and the area is **0.55 m²**.

   Every one of these numbers matches the sealed digest.

### R2. dom-w-jablonkach GROUND `d80b709d74` (853 px, sheet wall 20 px, registered scale 1.8817 / 1.892 cm/px; the true scale is ≈ 2.11)

- **`dimensionedExtent`.**
  - For the X axis, H@302 (95–590.3) is trimmed to its CHAIN_CORRECTED span 329.5–496, so H@568 (297–593) wins.
  - For the Y axis, V@780.5 (56.5–237–663) loses its DERIVED 180.5 px segment, leaving 237–663.
  - The chain rectangle is **297–593 × 237–663**.
- **`planExtent`.**
  - The vote is held 529 against loose 867, so `weak: true`.
  - `near` runs from x 193.4 to 696.6, so the wing at x≈94 is dropped and V@694 in the corner cluster is admitted.
  - The widened rectangle is x0 = V@206 (a 9 px line) − 10 = **196**, x1 = V@694 + 10 = **704**, y0 = 237 and y1 = H@785 + 10 = **795**. The sealed value of `y1` is 794.75.
- **`decomposePlan`.** The 60 % filter drops V@94 ×3 and V@694 but keeps H@785 from the corner cluster. The envelope is **206–590.3 × 237–784.75**, which matches the digest.
- **With the right pixels, the scale still fails.** The printed outer faces are 83.5–602.5 × 237–663 (519 × 426 px). At the registered scale that is 9.77 × 8.06 m = **78.7 m², −20.8 % of 99.4**, which is still `WRONG`. At 2.11 cm/px it is about 98.5 m². **On h1, fixing the extent alone cannot flip the verdict.** The scale defect (`006→806`) has to be fixed as well.

### R3. The role of the extent chains across the whole set (band PROXY, one-sided test)

The **one-sided test**: a chain is EXTERIOR when all the ink of the main wall component that overlaps its span lies on one side of its baseline. Components joined within 8 walls; thickness 0.6–1.6 walls; length at least 1.5 walls.

| run | X extent from | Y extent from | longest EXTERIOR chain on the failing axis |
|---|---|---|---|
| Marcówki (accepted) | chain@26: EXTERIOR | chain@547: EXTERIOR | — |
| G2E (accepted) | chain@781: EXTERIOR | chain@70: EXTERIOR, same span as the unread @49 | — |
| Kosaćce clean and tracked (accepted) | widened from chain@34.5: EXTERIOR | chain@803.5: EXTERIOR | — |
| **e-OZE** (resolved in 005A by the wall-ink extent and the lattice scale) | chain@698.5 (see note) | **chain@485: INTERIOR, 68.5 px** | V@24, 230–578.5, unread |
| **h1** | weak widening (the chain is @568, INTERIOR) | chain@780.5: EXTERIOR | H@828, 83.5–602.5, unread |
| **h2** | chain@745/711: EXTERIOR | **chain@375: INTERIOR** | V@35 / V@69.5, 84.5–610.5, unread |

Note on e-OZE X: this is the overall chain, which sits below the house. The proxy calls it INTERIOR only because the corner cluster joins the main component through terrace bands. That is a known limit of the proxy; it is why the tests below require **several** checks and exclude detached components.

**Coverage per axis of the chain extent against the wall witness (PROXY):**

| runs | X coverage | Y coverage |
|---|---|---|
| accepted runs | ≥ 0.89 | 0.71–0.95 |
| e-OZE | — | **0.09** |
| h2 | — | **0.22** |
| h1 | 0.79 | — |

h1's X extent has the right *width* (span ratio 0.98), but it covers the corner cluster instead of the wing. **Coverage alone does not catch h1; the role tests do.**

### R4. What a wall-only extent would have been (band PROXY)

| witness | h2: truth 234.5–794 × 84.5–610.5 (15.00 × 14.10 m) | h1: truth 83.5–602.5 × 237–663 (11.0 × 9.0 m) |
|---|---|---|
| sealed chain extent | 234.5–794 × 355–449.5 → 15.00 × **2.51** m | 196–704 × 237–794.75 → 9.56 × 10.55 m at the registered scale |
| A: `axisBox(longBands(all))` (`planExtent`'s `fromBands`) | 237–821.5 × 78–828.5 → 15.67 × **19.96** m (corner cluster) | 84–704 × 237.5–826 → 11.67 × 11.13 m |
| B: `axisBox` of long, wall-thick bands | 237–821.5 × 78–828.5 | **84–604.5** × 237.5–484 |
| C: 8-wall band cluster (≈ `wallClusterExtent`) | **235–794 × 102–610** → 14.99 × 13.51 m | **84**–713 × 181–823 → 11.84 × 12.15 m |
| D: faces of the main wall component (thickness 0.6–1.6 walls, length ≥ 1.5 walls) | **235–794** × 176–610 → 14.99 × 11.54 m | **84–605** × 237–823 |

**What these show.**
- **X is right to within 0.5–2.5 px on both houses**, provided the witness is built from clusters and faces.
- **Y is wrong on both, by one feature:**
  - on h2 the witness loses the 2.45 m front bay, whose walls reach the proxy only as short pieces;
  - on h1 it takes in the corner cluster.
- A wall-only witness is therefore good enough to **classify** chains and to confirm or refute one side. It is not good enough to *be* the extent on its own. When it does, it must say so, at LOW confidence.

---

## Answers

### 1. How exactly does a 2.5 m interior chain become the full plan depth?

These four steps multiply; no single one is enough.

1. **Selection by width among "read" chains** (F1 and F4, `:711-712,728`).
   - The only Y chains with a READ or CHAIN_CORRECTED segment were two short interior chains.
   - V@375 qualified solely through the rewrite "510" → 114 cm, at confidence 0.19.
   - The two 526 px left-margin chains had no read segment, so they were not candidates at all.
2. **A vote that cannot see depth** (F2, `:790-793,808-813`).
   - The X axis was right, so all 17 vertical walls (1479 px) voted "held", whatever their Y run.
   - The only Y votes came from horizontal walls whose axis falls within `near`: held 67 against loose 223.
   - Pooled, the totals were held 1546 against loose 259, so `weak: false`.
3. **A window sized by the chain under test** (F3, `:799-806`). ±35 % of 94.5 px is ±33 px, so the house's top and bottom walls (y = 184.5, 510.5, 270 and 84; 459 px) were not even counted as loose.
4. **Downstream filtering by the same extent** (F7 and F8, `:1222-1231,398,374-375`).
   - Bands running 60 % outside the strip were removed, the right exterior wall among them.
   - The wall thickness was re-measured at 7 px.
   - Grid lines were clipped to the strip, and the unread chain's face ticks were ignored.

   The result was 5 Y lines, 52 cells, 2 enclosed, 0.55 m².

**Why the resolver's two extent readings did not recover it** (F9, F8).
- `CHAIN_RECT` is the same `planExtent` call (`plan-resolution.ts:505`), so it gives the same 355–449.5.
- `WALL_MASS_CLUSTER` changes only the rectangle handed to `decomposePlan`. Y grid lines still come only from chains that carry values (V@375, V@273.5) and from bands reaching 18 % coverage or running wall to wall. The unread V@69.5 ticks, which are the outer faces of both bays, give no line (`:398`). So the wall-ink reading lost the bays for a different reason, but it rests on the same unread chain: 4 bodies, 71.3 m². This is **inferred**; that reading's decomposition is not sealed.
- The only reading with the correct Y extent was the area-table sibling (84.5–610.5), and it failed at −40 % for reasons outside the extent (F15).

### 2. How can OUTER_TOTAL be told from the other roles?

Each test below is geometric and ignores the printed value. Tolerances are in walls, reusing existing constants: the grid's `faceWindow = max(snapPx, 0.35·thickness)` (`:422`), `snapPx = 5`, and `minBandCoverage = 0.18`. There are no new absolute pixel counts.

| test | definition (chain C on axis A; its baseline lies across A) | measured on the sealed data |
|---|---|---|
| **T1 baseline position** | Consider the ink of the building's **main wall component** that overlaps C's span. If it all lies on one side of the baseline, C is **EXTERIOR**, on side MIN or MAX. If it lies on both sides, C is **INSIDE**. If the baseline runs within a wall, C is **ON_WALL**.<br>Detached components (the corner cluster, a north arrow, a second drawing) are excluded first, by connectivity **and** by stroke thickness relative to the sheet's wall. | Correctly EXTERIOR: h2 V@35, V@69.5, H@711, H@745; h1 H@828, H@721, V@780.5.<br>Correctly INSIDE: h2 V@375 (0.28), H@460 (0.34); h1 H@568 (0.43), H@302 (0.29); e-OZE V@485.<br>Wrong, with the corner cluster joined: e-OZE H@698.5. |
| **T2 end ticks on the outermost faces** | Both end ticks lie within `faceWindow` of the **outermost wall faces on axis A** of the wall witness: `bounds.x0`/`x1` of vertical walls for X, `y0`/`y1` of horizontal walls for Y. Faces, not axes: a chain is struck to faces. | h1 H@828: 83.5 against 84 and 602.5 against 605. h2 H@711: 234.5 against 235 and 794 against 794. h2 V@35: 610.5 against 610; its 84.5 end sits on the top wall of the front bay, which the proxy's main component misses (a limit of the proxy). h1 H@302 ends on wall *axes* (95 against 94), not faces. |
| **T3 nesting and stacking** | A **encloses** B when both are on axis A and the same side, A is stacked farther from the building, and B's span lies within A's, within tolerance.<br>C is **outermost in its stack** when no exterior chain on its side encloses it and extends by a wall or more. | h2 left: V@35 (d = 200) encloses V@69.5 (d = 165.5), which encloses V@107.5 and V@120.5.<br>h2 bottom: H@745 (d = 135) encloses H@711 (d = 101). |
| **T4 hull of the nested chain** (value-free "sum") | A's end ticks equal the first and last ticks of a nested chain B. That is the pixel form of "total = Σ segments". | V@35 {84.5, 610.5} equals V@69.5's first and last ticks. H@745's span 234.5–794 equals H@711's hull. |
| **T5 value sum** (corroboration only, never a gate) | When both are read, the total's value equals the sum of the nested chain's values, within the chain solver's tolerance. | h2 X: 1500 = 800 + 700. On h2 Y it cannot be tested (unread), so T4 carries it. |
| **T6 coverage of wall components** | The span covers every connected wall component of the building on axis A, attached wings included. | h1 H@828 covers the wing's component at x≈84–104. H@568 does not. |
| **T7 ticks on opening jambs** | At least half of C's interior ticks fall within `faceWindow` of the ends of pieces of the nearest parallel wall band, i.e. the jambs (`Band.segments`), and C is stacked closest to that wall. | h2 V@107.5 / V@120.5 are candidates. Not validated: the digest does not seal `Band.segments`. |
| **T8 span beyond a face** | A span with one end on an outermost face and the other end beyond the wall witness by more than one wall. | h2 H@745 89–234.5 (145.5 px left of x=235); h1 V@780.5 56.5–237 (180.5 px above y=237). |

**Role table.** Each role is a combination of the tests.

| role | rule |
|---|---|
| **OUTER_TOTAL** | T1 EXTERIOR, **and** T2 at both ends, **and** T3 outermost in its stack (or it has a nested chain it is the hull of, T4), **and** T6. |
| **OUTER_SEGMENT** (a bay span or chained partials) | T1 EXTERIOR, nested in an OUTER_TOTAL on the same side (T3), or with T2 at one end at most. Its interior ticks usually fall on non-outermost faces: the 245 bay spans of V@69.5. |
| **OFFSET** (per span) | T8. The rest of the chain keeps its own role. H@745 is OUTER_TOTAL on 234.5–794 and OFFSET on 89–234.5. |
| **OPENING** | T7. |
| **INTERNAL_TOTAL** (room span) | T1 INSIDE, with both ends on the faces of two parallel walls bounding one region. |
| **INTERNAL_SEGMENT** | T1 INSIDE, anything else. |
| **UNKNOWN** | The witness is missing, or the tests conflict (for example T1 against T2). |

- **The role is assessed per span as well as per chain.** A chain's role is the role of its main span.
- **Read status never enters the role.** READ can never promote an interior chain, and CHAIN_CORRECTED can never qualify one.

### 3. When must a chain be refused as the building's width or depth, and what happens when nothing survives?

A chain must be refused as the extent on axis A if **any** of the following holds. Each refusal is typed and recorded.

| # | refusal | condition |
|---|---|---|
| 1 | `INTERIOR_BASELINE` | T1 is INSIDE or ON_WALL. |
| 2 | `NOT_ON_OUTER_FACES` | Neither end passes T2. With one end it can be at most OUTER_SEGMENT. |
| 3 | `ENCLOSED_BY_OUTER` | An exterior chain on A (either side) encloses it and extends at least one wall beyond one of its ends. |
| 4 | `NESTED_PARTIAL` | It is nested under an OUTER_TOTAL on its own side (T3/T4) with a strictly smaller hull. |
| 5 | `PARTIAL_COVERAGE` | A wall component of the building lies entirely outside its span (T6). |
| 6 | `ROLE_OPENING`, `ROLE_OFFSET`, `ROLE_INTERNAL` | Its role is one of these. |

**The incumbent's extent is refused per axis, not per rectangle.** On h2 X stays and Y is refused. On h1 X is refused and Y stays in pixels.

**When no exterior extent can be proven on an axis:**
- **Candidates.** Generate the axis from WALL_GEOMETRY_EXTENT at confidence LOW, plus any CROSS_COPY transfer. Mark the axis `weak` and give its length `DERIVED` provenance.
- **Gap.** Emit a typed gap, `MISSING` with the reason "no exterior dimension states the building's {width|depth}", listing the refused chains with their refusal codes and the alternates generated.
- **Model.** A model built on it is PARTIAL, and its rings on that axis are not `SOURCE_EXACT` (this also closes AD item 9 for this path). The resolver's existing acceptance rule applies unchanged: a wall-geometry extent is never its own corroboration.
- **No witness at all.** If there is no wall witness either, the run makes a typed stop naming the axis. It never invents a rectangle.
- **Never interior.** An exterior extent is never taken from an interior chain. `widen(interiorChain, walls)` does exactly that today (`:814,817`: when no wall lies beyond one side, that side of the interior chain *is* the extent side), so it must go for any side that rests on a refused chain.

### 4. Wall geometry as an independent witness

**Existing functions that can provide WALL_GEOMETRY_EXTENT:**

| function | independent of chains? | risk measured |
|---|---|---|
| `axisBox(longBands(bands))` (`plan-decomposition.ts:749-765`, used as `fromBands` at `:785`) | Yes: bands only | The sheet's furniture and a long stroke anywhere widen it (h2: 15.67 × 19.96 m). It works on axes, so an outer wall broken into short pieces is lost. Use it **only** after a component filter. |
| `wallClusterExtent(mask, wallPx)` (`:1781-1813`) | Yes: mask and sheet wall thickness only | The 8-wall join by bounding-box proximity can pull in the corner cluster (h1 PROXY: 84–713 × 181–823). The largest cluster by ink loses to a site plan (documented). Returns a whole rectangle, with no per-side faces. |
| `outerWallFaces(raster, wallPx, region?)` (`v2/frame.ts:186-236`) | Yes, **but only when `region` is undefined or the wall cluster**. Today it is `plan.extent` (`:244`). | Coverage of 15 % of the region, per column or row, is a real *face* scan. It is the best base for per-side faces. |
| `walledEnvelope` (`:835-888`) | **No.** It uses `inside` (filtered by the extent), a wall thickness re-measured inside the extent, and snaps to chain-derived lines. | h2 234.5–549 × 385–429; h1 y1 = 784.75 from the corner cluster. It must never serve as a witness to the extent. |

**Every point where the chain extent feeds its own check:**

| # | location | what it does |
|---|---|---|
| C1 | `planExtent` `near` (`:799-806`) | ASSUMP-WALL-001's real mechanism |
| C2 | `decomposePlan` 60 % filter (`:1222-1230`) | drops walls by the extent |
| C3 | wall thickness re-measured from `inside` (`:1231`) | h2: 12 → 7 px |
| C4 | `gridLines` clip (`:374-375,401,418`) | cuts lines at the extent |
| C5 | `walledEnvelope` input and snapping (`:1241,851-866`) | envelope built from the filtered set |
| C6 | `outerWallFaces` region (`v2/frame.ts:244`) | search region is the extent |
| C7 | `alignPlans` band filter by `base.extent` / `other.extent` (`layout.ts:441-446`) | storey alignment sees only walls in the extent |
| C8 | resolver wall coverage `cluster ?? base.extent` (`plan-resolution.ts:338`) | a reading scored inside its own extent |

**Rules that keep the witness independent:**
- **One witness per sheet, from pixels only.** Compute it once per sheet, in `planSheet` beside `wallPx`, e.g. `wallWitness(sheet: PlanSheet): WallWitness`. Its **signature takes no chains and no extent**, and it is cached with the sheet. Its wall thickness is the **sheet's** (`layout.ts:326`), never the one re-measured inside the extent.
- **What counts as a wall.** Wall-thickness bands, of at least 0.6 of the sheet wall (the same cut-off the mask opening implies), grouped into components.
- **What is excluded.** Components that are detached and made of thin strokes of uniform length, the corner cluster's text-like pattern. Every exclusion is recorded.
- **Faces.** Taken per side: vertical bands' outer bounds give the X faces and horizontal bands' give the Y faces. Short wall-thick pieces are allowed, so the front bay's 26 px top wall counts.
- **The test.** A unit test proves the witness is identical with `chains = []` and with the real chains (negative test N6).
- **Provenance per side.** Each of `x0`, `x1`, `y0` and `y1` carries `{ px, provenance, sourceIds }`.
  - Agreement between provenances is recorded as a **witness entry**, never as a `widen`.
  - Disagreement of more than one wall is a typed `EXTENT_DISAGREEMENT` conflict on that axis and side.
  - A rectangle whose sides come from two provenances says so.
- **Downstream.** `decomposePlan` should take the **witness's** walls for the envelope and the band set, and use the chosen extent only as the frame for grid lines. That removes C2, C3 and C5.
  - This does change a first reading that holds, so gate it behind the refusal. Only an axis whose incumbent chain was refused switches to the witness's walls, so the four accepted runs stay byte-identical.

**What a wall-only extent would have been.** See R4.
- On h2 it is correct in X (235–794) and 102–610 or 176–610 in Y. It misses the front bay, but already by −5 to −10 %, against −82 % today.
- On h1 it is correct in X (84–605, the wing included) and over-reaches in Y to the corner cluster.

In both houses it would have **refuted** the chain axis that was wrong. That is exactly its job.

### 5. Bounded extent hypotheses

**Candidates per axis.** At most **3**, one per generating provenance:

| # | candidate | provenance and confidence |
|---|---|---|
| a | the best role-qualified span on this copy: an OUTER_TOTAL, or the hull of OUTER_SEGMENT chains that reach both outermost faces | `DIMENSION_CHAIN_EXTENT` |
| b | the best role-qualified OUTER span transferred from a **sibling copy of the same storey** | `CROSS_COPY` |
| c | the wall witness | `WALL_GEOMETRY_EXTENT`, confidence LOW when alone |

- **How a sibling's span is transferred (b).**
  - Directly, when the two copies are pixel-identical: same size and the same registration origin, as with h2's `7102a805c6` and `c2d04897b9`.
  - Otherwise through a correspondence of wall faces that does **not** use the chain being transferred.
- **PUBLISHED and ELEVATION never generate a pixel extent.** They have no plan pixels.
  - PUBLISHED keeps its 1.2.0 role: it refuses or scores, and is spent once it has refused.
  - ELEVATION may witness the *length in metres* of one axis, as `SOURCE_DERIVED` proportions.
- **Duplicates.** Candidates within one wall of each other on both sides merge into one, and each becomes a witness of the other.
- **Per copy.** The rectangles are the product of the top 2 per axis. Only the **top 2 rectangles** enter decomposition, so the 005A budget holds: 4 copies × 2 rectangles × (1 + 2 lattice scales) = 24.
- **The incumbent.** Its rectangle is always member #0 when both of its axes pass the refusal rules. Then the resolver never runs, as today.

**Ranking per axis.** Lexicographic, never a weighted sum. Refused candidates are excluded, not ranked.

| step | criterion | order |
|---|---|---|
| 1 | **role tier** | an OUTER_TOTAL or outer hull on this copy, then a CROSS_COPY OUTER span, then WALL_GEOMETRY alone |
| 2 | **independent witnesses**: distinct provenances within one wall on both sides | more first |
| 3 | **outermost faces matched**: 0–2 ends passing T2 | more first |
| 4 | **provenance of the length in metres** | READ, then CHAIN_CORRECTED (lineage kept, and never an anchor of the scale it was corrected to), then a CROSS_COPY read, then DERIVED at the registration, then none |
| 5 | **stacking** | outermost in its stack first |
| 6 | **departures from the incumbent** | fewer first |
| 7 | **id** | — |

**Two rules for the rectangle as a whole:**
- A rectangle is `weak` unless both of its axes are role tier 1 **and** each has at least one independent witness.
- `weak` is carried into the plan diagnostics and lowers the provenance of the rings. It is not just a hint for `chooseBasePlan`.

**What this ranking gives on the sealed data** (PROXY for the witness):

| house | X | Y |
|---|---|---|
| **h2** | chain H@711/745 234.5–794 (tier 1, READ 1500 = 800 + 700, witnessed by the wall witness) | **chain V@35 over V@69.5: 84.5–610.5** (tier 1, value-free; length DERIVED 14.10 m, witnessed by CROSS_COPY from `c2d04897b9`'s 245/920) |
| **h1** | chain H@828: **83.5–602.5**, the wing included (tier 1, unread, witnessed by the wall witness's 84–605) | V@780.5 237–663 (tier 1; the length's CHAIN_CORRECTED "006→806" is flagged as self-anchoring) |

**What remains after that.**
- On h1 the scale is still wrong (R2).
- On h2 there is F15.

### 6. Holdout 1's attached wing

**Would a wall-cluster extent have included it? Yes, on the left.**
- The wing's walls (V@94 ×3, x 84–104, 21 px thick) survive the mask opening, which has a radius of 6 px.
- The gap to the house's top wall (H@247.5 starts at x = 169) is 65 px, well inside the 8-wall join of 160 px.
- The band PROXY cluster runs 84–713 × 181–823. Every face-based witness gives **x0 = 84**, against the outer face at 83.5 stated by H@828.
- **But** the same cluster reaches the corner cluster (x1 713, y1 823). A raw cluster rectangle is right on one side and wrong on two.
- On h1 the resolver weighed 71 readings over 18 decompositions. It generates a wall-ink reading whenever the cluster differs from the chain rectangle by more than a wall; the PROXY cluster differs from d80b709d74's `planExtent` rectangle by 112 px on the left. The sealed record lists only the top four readings: the f96f526406 copy with the wall-ink extent, and the d80b709d74 copy with the chain extent. So whether d80b709d74 got a wall-ink reading is not sealed. **Any reading on the registered scale was capped anyway**: the correct pixels give −20.8 % (R2).

**What in the current code excludes it:**
1. **`dimensionedExtent` (`:711-712,719-728`).**
   - The only chains reaching the wing are H@828 and H@721, which are unread, so skipped.
   - H@302 (95–590.3) is trimmed to 329.5–496 by the cut-off rule.
   - H@568 (297–593) wins.
2. **`planExtent` `near` (`:799-806`).** x0 = 297 − 0.35 × 296 = **193.4**, so the wing's 256 px of wall is neither held nor loose. The weak widening takes x0 from V@206 (a 9 px line) and x1 from V@694 in the corner cluster.
3. **`decomposePlan`'s 60 % filter (`:1222-1230`).** It drops V@94 ×3, whose axis 94 lies below 196.
4. **`gridLines` clip (`:374-375,401,418`).** H@302's ticks at 95, 121 and 188.8 lie outside [191, 709].
5. **`walledEnvelope` over `inside` (`:1241`).** x0 = 206.
6. **Resolver (`plan-resolution.ts:505-509`).** CHAIN_RECT is the same rectangle, and WALL_MASS_CLUSTER is whole-rectangle only. It cannot take the wall's X with the chain's Y.

---

## Recommended contract

```ts
/** What a dimension chain (or one span of it) states about the building; decided by geometry, never by the printed value. */
export type DimensionRole =
  | 'OUTER_TOTAL'      // exterior, outermost in its stack, both ends on the outermost wall faces, covers every wall component
  | 'OUTER_SEGMENT'    // exterior and nested under an OUTER_TOTAL, or reaching at most one outermost face (bay spans, chained partials)
  | 'INTERNAL_TOTAL'   // inside the walls, ends on the faces of two parallel walls bounding one region (a room span)
  | 'INTERNAL_SEGMENT' // inside the walls, anything else
  | 'OPENING'          // interior ticks on opening jambs of the nearest parallel wall
  | 'OFFSET'           // a span running beyond the outermost face (a terrace, a site feature, a stray tick)
  | 'UNKNOWN'          // no wall witness, or the tests disagree

export type RoleTest =
  | 'BASELINE_EXTERIOR' | 'BASELINE_INSIDE' | 'BASELINE_ON_WALL'
  | 'ENDS_ON_OUTER_FACES' | 'ONE_END_ON_OUTER_FACE' | 'ENDS_ON_FACES'
  | 'OUTERMOST_IN_STACK' | 'HULL_OF_NESTED' | 'SUM_OF_NESTED' /* value check: corroboration only */
  | 'COVERS_WALL_COMPONENTS' | 'TICKS_ON_OPENING_JAMBS' | 'SPAN_BEYOND_FACE'

export type ExtentRefusal = 'INTERIOR_BASELINE' | 'NOT_ON_OUTER_FACES' | 'ENCLOSED_BY_OUTER' | 'NESTED_PARTIAL' | 'PARTIAL_COVERAGE' | 'ROLE_OPENING' | 'ROLE_OFFSET' | 'ROLE_INTERNAL'

export type ChainRoleAssessment = {
  chainId: string
  frameId: string
  axis: 'X' | 'Y'
  side: 'MIN' | 'MAX' | 'INSIDE' | 'ON_WALL' | 'UNDETERMINED'
  /** Baseline distance from the nearest outermost face, in px; null when not exterior. */
  stackingPx: number | null
  role: DimensionRole
  spans: Array<{ fromPx: number; toPx: number; role: DimensionRole; valueOrigin: 'READ' | 'CHAIN_CORRECTED' | 'DERIVED' | 'UNREAD'; evidenceId?: string }>
  passed: RoleTest[]
  failed: RoleTest[]
  refusedAsExtent: ExtentRefusal[]
  /** The wall witness the tests were made against: its id, never the extent being chosen. */
  witnessId: string
  why: string
}

export type WallWitness = {
  id: string
  frameId: string
  method: 'WALL_COMPONENT_FACES' | 'WALL_INK_CLUSTER' | 'OUTER_WALL_FACE_SCAN'
  /** The sheet's own wall thickness (planSheet), never one re-measured inside an extent. */
  wallPx: number
  faces: { x0: number; x1: number; y0: number; y1: number }
  components: Array<{ id: string; rect: PixelRect; wallLengthPx: number }>
  excluded: Array<{ rect: PixelRect; reason: 'DETACHED' | 'THIN_STROKES' | 'TEXT_LIKE' }>
  why: string
}

export type ExtentProvenance = 'DIMENSION_CHAIN_EXTENT' | 'WALL_GEOMETRY_EXTENT' | 'CROSS_COPY' | 'PUBLISHED' | 'ELEVATION'

export type ExtentSide = { px: number; provenance: ExtentProvenance; sourceIds: string[] }

export type AxisExtentHypothesis = {
  id: string
  frameId: string
  axis: 'X' | 'Y'
  lo: ExtentSide
  hi: ExtentSide
  /** Exactly one provenance GENERATES a hypothesis; PUBLISHED and ELEVATION never do. */
  provenance: Exclude<ExtentProvenance, 'PUBLISHED' | 'ELEVATION'>
  /** The role of the span it came from (for chain and cross-copy hypotheses); null for wall geometry. */
  role: DimensionRole | null
  lengthM?: { value: number; origin: 'READ' | 'CHAIN_CORRECTED' | 'CROSS_COPY_READ' | 'DERIVED_AT_REGISTRATION'; evidenceIds: string[] }
  /** Other provenances agreeing within one wall on both sides; never the hypothesis's own source. */
  witnesses: Array<{ provenance: ExtentProvenance; id: string; maxSideGapPx: number }>
  conflicts: Array<{ provenance: ExtentProvenance; id: string; side: 'lo' | 'hi'; gapPx: number }>
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  /** The lexicographic key, recorded so a gate can hold a rule instead of a hash. */
  rank: number[]
  why: string
}

export type ExtentHypothesis = {
  id: string
  frameId: string
  x: AxisExtentHypothesis
  y: AxisExtentHypothesis
  rect: PixelRect
  /** True unless both axes are role tier 1 with at least one independent witness each. */
  weak: boolean
  /** Axis hypotheses refused on this copy, with their reasons: they appear in the digest, never in the rect. */
  refused: Array<{ axis: 'X' | 'Y'; chainId: string; reasons: ExtentRefusal[] }>
}
```

**Invariants.** Each one has a test (see below).

- **I1.** A chain whose assessment carries any `ExtentRefusal` never sets an extent side, directly or through `widen`.
- **I2.** `WallWitness` is a function of the sheet alone: no chains and no extent in its inputs. It is identical with and without chains.
- **I3.** There is no `widen` across provenances. Agreement becomes `witnesses[]`, disagreement becomes `conflicts[]` and a typed `EXTENT_DISAGREEMENT`.
- **I4.** `PlanReading`, the digest (`plan-diagnostics.ts:44-46`) and the trace record the provenance of every side and the refused chains.
- **I5.** Role is independent of value. `lengthM.origin` is carried separately. A `CHAIN_CORRECTED` length is never also an anchor of the scale it was corrected to (the h1 "006→806" loop).
- **I6.** When the incumbent's extent chains pass every refusal rule on both axes, the first reading is unchanged byte for byte. This must be re-measured on the six known runs; e-OZE is expected to move and must be recorded.
- **I7.** No new absolute pixel constants. Tolerances are in walls, from existing constants (`snapPx`, `faceWindow`, `minBandCoverage`).
- **I8.** Unread ticks of a span classified OUTER_* become grid lines of a new kind, "drawn tick, no statement", ranked below printed ticks and carrying no metre (F8).

---

## Proposed negative tests

These use the style of `packages/reconstruction/test/plan.ts` (`sheet`, `walls`, `partition`, `chain`, `WALL = 12`, 5 cm/px). `chain()` needs one addition: a `read: 'NONE'` option that emits segments with no `origin` and no `valueCm`, as sealed h1/h2 chains have.

- **N1 — the longest read chain is interior (the willa-miranda shape).**
  - **Setup.** A house of 18 × 20 m with partitions:
    - an exterior X chain, READ, below the house;
    - an exterior Y chain in the left margin, **unread**, with its ticks on the outer faces and on two bay faces;
    - one interior Y chain at x = mid-house, READ, spanning 2.5 m between two partitions.
  - **Expect.**
    - The Y extent is the exterior span (`DIMENSION_CHAIN_EXTENT`, role `OUTER_TOTAL`, `lengthM.origin = 'DERIVED_AT_REGISTRATION'`).
    - The interior chain is `INTERNAL_*` with `INTERIOR_BASELINE`.
    - The full-height exterior walls survive the band filter.
    - The bays' face ticks are grid lines.
    - The area is within one wall of the drawn house.
  - **N1b.** The interior X chain is READ and runs past the right wall to a terrace post, so it is *longer* than the outer total. The outer total still wins, and the extra span is `OFFSET`.
  - **N1c.** The interior chain's only non-derived segment is `CHAIN_CORRECTED`. The outcome is identical: read status never promotes.
- **N2 — the outer chain is noisier.**
  - **Setup.** The exterior Y chain has ticks jittered by ±2 px, one stray unread tick 1 px outside the face, and `CHAIN_CORRECTED` values at confidence 0.15. The interior chain is cleanly READ and covers 60 % of the depth.
  - **Expect.** The exterior chain wins on role, with `lengthM.origin = 'CHAIN_CORRECTED'` and no promotion to READ. The interior chain never contributes a side, and no `widen` is applied.
  - **N2b.** The exterior chain's last tick lies 2 walls beyond the face. That span is `OFFSET`; it is not trimmed by the length-ratio rule, and the extent ends on the face.
- **N3 — no outer chain, so the wall geometry is used at lower confidence.**
  - **Setup.** Only interior chains on Y. The X chain is exterior.
  - **Expect.**
    - Y comes from `WALL_GEOMETRY_EXTENT` with confidence `LOW` and `weak: true`.
    - A `MISSING` gap reads "no exterior dimension states the building's depth" and lists the refused chains.
    - The Y rings are not `SOURCE_EXACT`.
    - With no published figure, the result is `PLAN_RESOLUTION_INCONCLUSIVE`, named rather than built, as in the existing "with nothing published" test.
    - With a matching figure, the result is PARTIAL.
  - **N3b.** With no exterior chain and no wall witness on an axis, the run makes a typed stop naming the axis. No rectangle is produced.
- **N4 — sheet furniture.**
  - **Setup.** A detached block of 10–14 thin parallel strokes of equal length, as long as the house's walls are thick, placed within 0.35 × span of the house and within 8 walls of one corner.
  - **Expect.** No extent side, envelope side or wall-witness face comes from it; it is listed in `WallWitness.excluded`. This reproduces h1's 704 and 795.
- **N5 — an attached wing outside the chain window.**
  - **Setup.** A wing at the house's wall thickness, 5 walls outside the only exterior X chain, which is a partial chain ending at the house's own left face.
  - **Expect.**
    - The wall witness includes the wing.
    - The chain is refused with `PARTIAL_COVERAGE`, or an `EXTENT_DISAGREEMENT` is named.
    - The wing's walls are never dropped silently: the h1 shape.
- **N6 — independence.**
  - `wallWitness(sheet)` is deep-equal with `chains = []` and with the fixture's chains.
  - Adding an unrelated interior chain changes no extent side.
- **N7 — a vote per axis.** X is correct and Y is an interior strip, while the vertical walls outweigh the horizontal ones more than 10 to 1. The Y axis must still be refused or flagged. This is the direct regression for F2.
- **N8 — controls.**
  - Marcówki, G2E, Kosaćce clean and Kosaćce tracked keep their model and scene hashes.
  - e-OZE's change is recorded, not hidden.
  - Two metamorphic checks: rotating the fixture by 90° swaps the roles X↔Y consistently, and mirroring it (chains on the opposite margin) gives the same extent.

---

## Not measured, and why

- The real `wallClusterExtent` rectangles on h1 and h2 are not sealed, and no raster is sealed. R4 is a band proxy; its X agrees with the printed outer faces to within 2.5 px on both houses, but it is not the function.
- The resolver's per-reading decompositions are not sealed: the wall-ink reading on h2 and the area-table reading on h2. The mechanism in F8 and Answer 1 is therefore inferred from the sealed chains and bands.
- T7 (opening jambs) could not be validated, because the digest does not seal `Band.segments`.
- The claim that the corner cluster is a publisher mark rests on band data. It appears on 9 of 9 plans of 853 px across 6 houses, at a thickness fixed in pixels. No image was viewed.
