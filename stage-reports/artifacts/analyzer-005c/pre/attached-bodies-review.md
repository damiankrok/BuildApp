# Reviewer C — attached bodies and bays (BUILDPLAN-ANALYZER-005C pre-implementation review)

- **Repository:** `/home/user/BuildApp`, branch `analyzer/opening-aware-envelope-v1` at `d3235bf`, which is the frozen 005B analyzer. Read-only: the tree is clean and nothing was edited.
- **Line numbers:** every `file:line` is at `d3235bf` and under `packages/reconstruction/src/`.
- **Probes:** all under `/home/user/BuildApp/.cache/review-C/`, which is git-ignored.
  - `bays.ts` traces `baysOf` on a real plan.
  - `variants.ts` and `pd.ts` run a parameterised copy of `plan-decomposition.ts` whose only changes are in `baysOf`.
  - `mouth.ts` measures piers, infill and junction coverage at a given line.
  - `unexplained.ts` finds wall-thick ink outside the envelope.
  - `synth.ts` holds the synthetic cases.
- **Outputs:** `ev/review-C/{variants-all.txt, synth.txt}`.
- **Inputs:** the frozen "before" runs in `ev/before/<house>/` (all 11 finished; the model hashes equal the CI pins: Marcówki `6152770f`, Kosaćce `5b5ffcf1` on both links, G2E `8fa4a25b`) and the byte cache `ev/devcache`. The drawings were looked at locally only, as overlays in `ev/review-C/*.png`.
- **Sanity check:** the probe copy with the default variant reproduces the frozen decomposition exactly on every read plan (`copy(default)`: 0 cells changed on all 9 houses).

## 0. Verdict in ten lines

1. **All three failures are the same relation, missed.** Each failing house has a projecting body with two wall-thick side walls, corner piers and a drawn door or glazing line. `baysOf` misses it for three independent reasons:
   - (a) one side wall is the building's own side wall and runs **through** the edge;
   - (b) the reach is measured to the band's end against a threshold that the re-measured wall pushes to 1.86 m;
   - (c) the mouth needs a grid line that does not exist.
2. **dom-w-zurawkach:** with (a) and (b) relaxed, the frozen code builds the wing. The ground decomposition goes from **69.05 → 100.82 m²** against a published 101.7 m².
   - A "1.5 m to the outer face" rule rejects this 1.50 m wing by **0.1 px**: 67.5 px against 67.62 px.
3. **willa-miranda:** it has **two** projecting bodies, not one: the garage (south) and the living-room wing (north).
   - With a correct extent, (a) and (c) reject both. Fixing them moves the decomposition from **74.65 → 161.19 m²** against 169.9.
   - Most of the rest belongs to the extent reviewer, not to this one.
4. **dom-w-modrzykach:** the "bay" is the building's own two outer walls, spanning **97.6 %** of the envelope width, with a mouth placed at the end of a window-broken wall piece.
   - It changes no cell, but it spends resolver budget on "pocket mouths shut" readings.
   - It is an envelope failure and must be refused as a body.
5. **The frozen mouth rule already builds a covered terrace.** Two wall-thick side walls in front of a continuous facade, plus a 1-px step line inside the mouth band, gives `OPENING_IN_WALL` and BUILT (synthetic H2). No test covers it.
6. **The discriminating relation is the junction**, measured here as the wall-thick coverage of the main boundary line between the candidate's inner faces:

   | house | body | junction coverage |
   |---|---|---|
   | dom-w-zurawkach | garage | 8 % |
   | willa-miranda | garage | 12–16 % |
   | willa-miranda | north wing | 6 % |
   | G2E | garage | 85 % |
   | synthetic | terrace | 100 % |

   A low value means the room continues into the body; a high value means a separate space behind a facade, which needs stronger distal evidence. G2E has that evidence: piers, a line and the callout `500`.
7. **Relaxing the tests alone does not move the passing houses.** Relaxing start-at-edge, reach-to-face, 1.0 m / 2 walls and any-pair, alone or together, changes **0 cells** on Marcówki (ground and attic), Kosaćce (both links), G2E, e-OZE and jablonkach (measured).
8. **What does move a pinned model:** taking the far face from the **longer** side wall or the band end. G2E's right garage wall runs on past the mouth to the gate posts, so doing this loses the garage: 12 cells, **185.74 → 147.55 m²**. The far face must come from the distal closure, never from band ends.
9. **Gating on unexplained ink protects nothing.** "Act only where wall-thick ink outside the envelope is unexplained" does not separate the houses: Marcówki has 4.02 m of such ink, Kosaćce 1.73 m, G2E 2.12 m and jablonkach 1.67 m. The guard has to be the relation (pair, distal closure, junction), not the presence of ink.
10. **Design:** relational body candidates (§3), a junction taxonomy, a union of bodies with the envelope for seeding, and far faces from distal evidence snapped to existing lines. G2E's bay rect must stay byte-identical: `[178,479.5..427,702]`.

## 1. Mechanism, measured

### 1.1 Why the thresholds are not what the report says

Two wall thicknesses exist in one plan read:

- the sheet's, from `planSheet` (`layout.ts:341-349`);
- the decomposition's, re-measured from only the bands inside the extent (`plan-decomposition.ts:1390-1399`).

`baysOf` uses the second. So `minOut = max(4 walls, 1.5 m)` (`:1242`) is not 1.5 m on any ARCHON sheet:

| plan | wall px, sheet → decomposition | mpp | effective `minOut` |
|---|---|---|---|
| Kosaćce GROUND | 14 → 12.3 | 0.02407 | 1.50 m (the 1.5 m term) |
| G2E GROUND | 14 → 16 | 0.02758 | 1.77 m |
| e-OZE GROUND | 15.5 → 20 | 0.02224 | 1.78 m |
| jablonkach GROUND | 20 → 21 | 0.02119 | 1.78 m |
| willa GROUND, with the correct extent | 12 → 17 | 0.02681 | 1.82 m |
| willa GROUND, frozen strip extent | 12 → **7** | 0.02681 | 1.50 m |
| **zurawkach GROUND** | **14 → 21** | 0.02218 | **1.86 m (84 px)** |
| modrzykach GROUND | 16 → 17 | 0.02749 | 1.87 m |
| Marcówki GROUND | 17.1 → 18.5 | 0.02647 | 1.96 m |
| Marcówki ATTIC | 11 → 18 | 0.0370 | 2.66 m |

The 005B report (§AE, holdout README) states `minOut = 67.6 px` for zurawkach. The code applies **84 px**, so the wing misses by 37 px, not by 20.

### 1.2 dom-w-zurawkach — GROUND `0dfaf7d6ba`

- **Plan read:** 853 px, 2.218 cm/px, decomposition wall 21 px (0.47 m).
- **Extent:** 257–796.5 × 95–523.5, right, because the chain `800 + 150` includes the wing.
- **Envelope:** 260–792 × 95–456, i.e. the house front. Grid rows 95 / 233.5 / 456 / 523.5.
- **Garage:** room 8, x 599.5–792 over its full depth, projecting 1.50 m past the house front.

| member | band | run (px) | thickness | start vs edge 456 | reach to band end | to outer face 523.5 | `baysOf` test (`:1257`) |
|---|---|---|---|---|---|---|---|
| garage W side wall | V@609 | 456–503 | 23 | 0 | 47 px = 1.04 m | 67.5 px = 1.50 m | start OK, **REACH_FAIL** (47 < 84) |
| garage E side wall, which is the building's E wall | V@782 | 116–503 (pieces 116–190, 192–298, 388–503) | 21 | **−340** | 47 px | 1.50 m | **START_FAIL** (runs through) |
| W wall inside the envelope (partition) | V@613.5 | 238–435 | 14 | — | — | — | not considered |
| house front (junction) | H@445.5 | 359–**597** | 20.4 | stops at the garage's W wall | — | — | junction coverage **8 %** across the garage |

- **The mouth at 523.5** (`mouth.ts`), which no band sees:
  - piers at 620–636 (17 px) and 754–772 (19 px);
  - door line: infill 0.87 of the inner width;
  - the 260/229 callout was **not read**: 5 callouts on this sheet, none at the garage.
- **Why the piers are invisible:**
  - The 37 × 22 px corner blocks fail the band reader, whose run across must stay ≤ 1.9 walls (27 px, `layout.ts:344-348`).
  - The side-wall bands therefore end at the mouth's **inner** face. The reach is systematically one wall short, by construction.
- **Flood:**
  - Row 456–523.5 lies outside the envelope and is seeded as ground (`:1525-1526`).
  - The garage cells at 233.5–456 are reached through the open junction.
  - Built cells 69.05 m², 17 of 33 (`BBBBBBBBBB.` / `BBBBBBBR...` / `...........`).
- **What relaxing does:**
  - Crossing, reach to the face and 1.0 m / 2 walls: bay `MAX_Z [598,456..792,523.5]`, mouth 2.60 m, `OPENING_IN_WALL` on the drawn line → 9 cells change, **100.82 m²**.
  - A 1.5 m to-the-face rule rejects it at `:1272`, because |far − edge| = 67.5 < 67.62 px. A 1.497 m rule accepts it. The printed projection is exactly 1.50 m.
- **Resolver:** no bay existed, so `mouthsLeftOpen` (`plan-resolution.ts:606-607`) never fired and no "mouths shut" reading was even tried. That explains why all 8 readings sat at 40–43 m².

### 1.3 willa-miranda — GROUND `7102a805c6`, 2.681 cm/px

**Frozen first reading:**
- The strip extent (355–449.5; the extent reviewer's P0) gives a decomposition wall of 7 px — a partition.
- Envelope 234.5–549 × 385–429, 0 bays, 0.55 m² built.
- No bay test is even meaningful here.

**With the area-table copy's correct chain extent (234.5–794 × 84.5–610.5):**
- decomposition wall 17 px;
- envelope 234.5–794 × **184.4–519.3**;
- **grid rows stop at 501**: no row at 519.3, 610.5 or 84.5, because both wing fronts are openings between piers and their chain ticks are unread.

| body | side walls (band, run, start vs edge, reach) | why rejected | mouth (at the outer face) | junction |
|---|---|---|---|---|
| **garage** (room 9), south, edge 519.3 | V@541.5, 520–593, +0.8, 1.98 m (start and reach OK). V@785.5 = the building's E wall, 193–593, **−326**, 1.98 m | START_FAIL (`:1257`); also no grid line near 610 (`:1271`) | piers 550–570 and 757–777 (21 px each); infill 1.0; 500/238 not read | **12–16 %** (the house-front band H@510.8 ends at x 532) |
| **living-room wing**, north, edge 184.4 | V@376 and V@575, 102–175, −9.4, 2.21 m (**both OK**), 5.33 m apart | **only** the far line: target ≈ 85, no line (`:1271`) | piers 385–410 and 541–566 (26 px); glazing infill 1.0; 350/230 not read | **6 %** |

Built area of the decomposition under each rule:

| rules | built | cells |
|---|---|---|
| frozen rules | 74.65 m² | 77 (H1) |
| far-face lines injected (84.5, 610.5), frozen tests | 110.01 m² | north wing only |
| far-face lines + crossing + reach to face + 1.0 m / 2 walls | **161.19 m²** | 116 (H1) |

Published: 169.9 m². The rest is the extent and any other outline gaps, which were not measured here.

### 1.4 dom-w-modrzykach — GROUND `fb7476d8f1`, 2.749 cm/px, wall 17

- **Envelope:** 46–719 × 113–186.5 (2.02 m deep; the envelope reviewer's problem).
- **Candidates:** six bands leave the `MAX_Z` edge. Only V@54 (the piece 188–300: start +1.5, reach 3.12 m) and V@711 (201–418: +14.5, 6.36 m) pass. They are adjacent in the sorted list, so they are paired (`:1259`) with no upper bound:
  - axes 657 px apart = **97.6 % of the envelope's 673 px width**, 18.06 m;
  - widest gap between pier runs 12.76 m.
- **Far line:** `min(reach) = 113.5` (`:1268`), the end of the W wall's **first piece**. The W wall is broken by the 3.00 m side window and continues at 410–467. Target 317 snaps to the chain line **324**, through rooms 5, 6 and 9.
- **Corners test (`:1278`):** passes by **3.2 px** (113.5 ≥ 137.5 − 27.2).
- **Mouth:** infill 0.43, no callout, so `OPEN_SIDE`.
- **Effect on cells:** none; everything below 186.5 is already seeded.
- **Effect on the resolver:** `corners && OPEN_SIDE` triggers `withShutMouths` (`plan-resolution.ts:653-654`). The holdout's reading2 and reading3 are "pocket mouths shut" (22.7 and 23.9 m²), spent on a non-body.
- **The 7.51 m `COLLINEAR_GAP` at y = 186.5:** its pocket test can see no interior, because the cells behind it are pre-seeded as ground. This is the envelope/seeding circularity.

### 1.5 The passing houses — what exists today and what keeps it right

| house | bays today | recesses / loggias | wall-thick ink outside the envelope, unexplained | why no false body today |
|---|---|---|---|---|
| **G2E** GROUND | **1, shut:** `MAX_Z [178,479.5..427,702]`, axes 185.5/420, mouth 4.96 m (piers 19/21 px, line 100 % of the gap, callout `500/238` at 0.61). H1 builds 126 cells against H0's 114; 2 masses | entrance porch at x 427–487 stays OUTSIDE | 2.12 m: V@420 runs on **702 → 760** (gate posts); H@496.5 stub | both walls start within 2.5 walls (−2.5 and −12.5 px, because the house front breaks the bands at the corner). The far line is the **shorter** wall's reach + 1 wall = 702, a chain line. Junction **85 %** walled |
| **Marcówki** GROUND / ATTIC | 0 / 0 | garage inside the envelope; 2 terraces and 2 balconies come from the v2 readers | 4.02 m: V@70 stub 736–772 (0.97 m), V@501 garden wall 469–**826** (runs through the front, 2.40 m past it), H@754.5 | start rejects V@501, reach rejects V@70. Paired under looser rules (0.8 m / 1.5 walls) it becomes `MAX_Z [58,735.5..514,773]`, mouth 8.03 m, `OPEN_SIDE`. There: infill 0.09, no right-corner pier (scattered 1–16 px posts and plants), junction 56 % (a facade with a door and a window) |
| **Kosaćce** (clean = tracked) | 0 | 3 RECESS cells inside the envelope (the rear loggia beside the bedroom wing, glazing 300/230) | 1.73 m: V@718.4, a planter row 102–316 crossing the rear edge | a single band with no partner |
| **e-OZE** | 0 | — | 0 | nothing outside the envelope |
| **jablonkach** (not pinned) | 0 | — | 1.67 m of stubs (0.76 and 0.91 m) | the envelope reaches the front through `sideWallReach` (§O, `:1003-1043`) |

**The reverted "generalised bay rule" of 005B is not recoverable.**
- There is no diff, commit or run of it.
- In 005B's scratch runs a1–a11, every Marcówki and G2E digest has identical envelope, bays and built-cell counts. The hash changes in a7–a9 were metric.

**What moves the pinned houses, measured on all 9 houses × all read plans × 8 variants** (`variants-all.txt`):
- `crossEdge`, `reachToFace`, `minOut 1.0 m / 2 walls` and `anyPair`, each alone or combined: **0 cells** on Marcówki, Kosaćce, G2E, e-OZE, jablonkach, modrzykach and willa. Only zurawkach changes (+9 cells).
- `farFromLongerWall` (far face from `max` reach): G2E loses its bay, **−12 cells, 185.74 → 147.55 m²**. This is a measured way to move a pinned hash.
- `loose 0.8 m / 1.5 walls`: Marcówki gains an **open** front-strip bay. It is harmless only because the mouth is 8.03 m against `maxWideOpeningM = 8` and the infill is 0.09. A shut-on-piers rule, a paving-line infill or a larger maximum width would build the 1.0 m strip (about 11 m²). That last effect is an **assumption**; it was not run.
- Also an **assumption**, not measured: adding grid lines or re-measuring the wall moves region merges. 005B §V saw a −0.08 % scale nudge merge a room.

## 2. Why each threshold is brittle, with counter-examples

The synthetic cases are in `synth.ts`: 5 or 2.5 cm/px, walls 12 px. "Frozen" is the result measured on `d3235bf`.

| test (`file:line`) | how it fails | counter-example | frozen result | naive relaxation* |
|---|---|---|---|---|
| **Starts at the edge**, ±2.5 walls (`:1257`) | A wing's side wall is often the building's own side wall (flush) or a partition that continues. The band reader merges collinear pieces, so the band starts deep inside | **C:** the W wall of a 3.0 m wing continues an interior wall-thick partition from the rear wall. **D:** zurawkach-shaped flush garage | C OUTSIDE, D OUTSIDE (no bay) | both BUILT |
| **Reach ≥ `minOut`**, measured to the band end (`:1242`, `:1257`, `:1272`) | The band ends at the pier's inner face (the corner block fails the thickness test). The wall term scales with a wall re-measured from the extent. One number at the target value flips on 0.1 px | **A:** a 4.0 m wing projecting 1.0 m (2.5 cm/px, walls 0.30 m), piers and a door line. Real: zurawkach 1.50 m | A OUTSIDE | **A still OUTSIDE:** a 1.0 m threshold measured to the face misses by 1 px (39 < 40) |
| **Separation ≥ 2 m**, consecutive pairs only (`:1259-1263`) | No upper bound against the main side. A partition inside a wing splits it into sub-bays that each need a mouth. A narrow vestibule is refused | modrzykach: 97.6 % of the side. Vestibule: a 1.8 m wind lobby | modrzykach false bay; vestibule refused | — |
| **Far line snapped** to an existing line within 1.5 walls (`:1266-1271`) | An opening-fronted body has no long band on its front, and its chain ticks are unread, so there is no line. When a line does exist, the snap takes whatever is nearest | willa garage and north wing (no line). modrzykach snaps to 324 through rooms | rejected / mis-placed | unchanged |
| **Far line from `min(reach)`** (`:1268`) | A window-broken side wall's first piece sets the body's depth | modrzykach (piece 188–300) | mouth through rooms | `max` loses G2E |
| **Corners** (`:1278`) | Circular: the far line comes from the shorter wall, so the shorter wall "reaches" it by construction. It fails only if the snap lands more than 0.6 walls past the target | modrzykach passes by 3.2 px | cannot detect a wall stopping short | — |
| **Mouth shut** = corners ∧ (line ≥ 0.7 ∨ callout) (`:1335`) | No junction test, and no requirement for piers at the distal corners. A step or paving line inside the 1.6-wall band counts as a door | **H2:** a 5.1 m walled terrace in front of a continuous facade, with a 1-px step line. **H:** the same line touching the walls splits the band, so the frozen code rejects it by luck | **H2 BUILT** (defect today) | H BUILT too |

\* "Naive relaxation" = `crossEdge + reachToFace + minOut 1.0 m / 2 walls + anyPair`. It fixes C, D and zurawkach, but it misses A, builds H and I (terraces), and proposes an open "bay" on J (Dunmore-like returns) and on F and G (covered terraces). **Relaxation is not a design.**

## 3. Proposed relational design

**Where.** Replace `baysOf` (`:1232-1374`) with `attachedBodiesOf(ctx)`.
- It keeps `baysOf`'s output type (`PlanBay`, extended with `junction`, `type` and `evidence`), so the digest, the overlay and `mouthsLeftOpen` keep working.
- `sideWallReach` (`:1003`) is the same relation at full width: two walls past the box, a partition at the junction (`endsOnPartition`), a pier on the distal line (`pierOn`). It should become the ≥ 0.8-width branch of the same classifier. Its outputs must stay identical on jablonkach.

### 3.1 Candidates (bounded)

1. **Side members.** For each envelope side S, take bands perpendicular to S with:
   - thickness ≥ 0.6 w, using the decomposition's `w` so that G2E stays identical;
   - axis within [S.lo − w, S.hi + w];
   - a run that **overlaps** [edge − 2.5 w, edge + w] — it starts at the edge *or crosses it*;
   - at least 1 w of run beyond the edge.

   Before measuring, join collinear pieces on one axis (±0.5 w) across gaps ≤ `maxOpeningM`. A window-broken wall is one wall.

   Keep ≤ 8 per side, longest first. Measured maximum today: 6, on modrzykach `MAX_Z`.
2. **Pairs (i < j).** A pair qualifies when:
   - inner separation s satisfies max(3 w, 1.2 m) ≤ s ≤ 0.8 · |S|. Above that, the pair is not a wing: emit `ENVELOPE_SHORT_SUSPECTED` for the outline stage, create no bay and trigger no SHUT reading;
   - the two runs beyond the edge overlap along ≥ 0.6 of the shorter;
   - no third wall-thick parallel band between them runs past both. If one does, take sub-pairs with the partition as a shared wall.

   At most 28 pairs per side; accept at most 4 bodies per plan.
3. **Distal closure D, found from ink, not from a grid line.** Walk outward along both side walls. D is the first line where both walls end within 1.5 w of each other AND either:
   - each end turns inward as a corner block (solid ink ≥ 0.6 of a wall-deep zone for ≥ 0.5 w: the frozen pier test `:1289-1310`, reused), or
   - a cross band spans ≥ 0.6 of s.

   D's outer face is the far edge of that ink.
   - If an existing grid line lies within 0.5 w, **snap** to it. This keeps G2E at 702.
   - Otherwise add one line, only for an accepted body.
   - Never take D from band ends or from `max(reach)` (G2E, measured).
4. **Relations measured per candidate** (ratios of w or s; the only metric numbers are plausibility bounds):
   - **Junction J:** wall-thick coverage of the main boundary line between the inner faces, sampled at the boundary's wall axis (the frozen `wallIntervals`). OPEN < 0.3 ≤ PARTIAL < 0.62 (the closure threshold) ≤ CLOSED. Measured: 8 % / 12–16 % / 6 % / 85 % / 100 % (§0).
   - **Mouth M at D:** `CROSS_WALL` | `PIERS_LINE` (both corner piers ≥ 0.5 w, one line ≥ 0.7 inside the wall band) | `PIERS_CALLOUT` | `PIERS_ONLY` | `LINE_ONLY` | `NOTHING`. Also the gap width ≤ `maxWideOpeningM`.
   - **Flush side:** is a side wall collinear (±0.5 w) with the main body's own side wall? This is a *label*, not a penalty.
   - **Dimension support:** a chain tick, *read or unread*, within 0.5 w of D or of a side wall's outer face, or the plan extent reaching D ± 0.5 w. This corroborates but never decides: Marcówki's front strip has it too, because the extent includes the `100` zone.
   - **Occupancy** (optional): interior ink inside (`interiorInk`, `:614`), drawn-share or hatch (`v2/terrace.ts drawnShareOf`), and room numbers once the interior reader runs. Published `garage_area` verifies only (005A rule).

### 3.2 Junction taxonomy, and the evidence each type needs

| type | evidence required | first reading | measured instances |
|---|---|---|---|
| **PROJECTING_WING** | two side members (one may be flush) + D, and one of: (J OPEN or PARTIAL ∧ M ∈ {CROSS_WALL, PIERS_LINE, PIERS_CALLOUT}), or (J CLOSED ∧ (M = CROSS_WALL ∨ M = PIERS_LINE ∧ callout ∨ M = PIERS_LINE ∧ occupancy)) | BUILT: union with the envelope, mouth shut as an opening | zurawkach garage (OPEN, PIERS_LINE); willa garage and north wing (OPEN, PIERS_LINE); G2E garage (CLOSED, PIERS_LINE + callout) |
| **FLUSH_ATTACHED** | a body inside the envelope sharing a boundary line (no projection) | unchanged; record the relation | Marcówki garage, Holloway-like L |
| **RECESSED_ATTACHED** | D lies inside the envelope (front set back) | unchanged here; the pocket in front stays RECESS or OUTSIDE (envelope stage) | modrzykach garage front (printed 195/80) — envelope reviewer |
| **OPEN_MOUTH_GARAGE** (candidate) | two side members + corner piers + M = PIERS_ONLY, gap ≤ 8 m, and (J OPEN ∨ occupancy) | OUTSIDE, recorded; **feeds `mouthsLeftOpen`** so the resolver's SHUT reading exists (today it never does without a bay) | synthetic E |
| **COVERED_TERRACE / CANOPY / PERGOLA** | J CLOSED ∧ M ∈ {NOTHING, LINE_ONLY, one pier}; or side members shorter than 2 w (posts); or hatch or drawn-share with no piers | OUTSIDE, handed to the v2 terrace/recess readers; **never BUILT** | synthetic F, G, H, H2, I, J (Dunmore), K; Marcówki front strip |
| **SEPARATE_BODY** | a closed wall ring whose nearest face is > 1.5 w from the main boundary | not attached; left to the cluster stage | — |
| **UNKNOWN** | s > 0.8 · |S| (→ `ENVELOPE_SHORT_SUSPECTED`), no D, or conflicting relations | no change; stated | modrzykach 97.6 % pair |

**What separates an OPEN_MOUTH_GARAGE from a carport, a covered terrace and a pergola.** The garage has:
- wall-thick side walls over most of the projection (a carport or pergola has posts);
- corner piers at the distal line, which are door jambs (a terrace has none, or a single pier);
- most often an OPEN junction, since the garage is continuous with or opens into the house (a terrace lies in front of a CLOSED facade);
- no hatch or decking.

Even so it stays OUTSIDE in the first reading. It is only offered as the resolver's SHUT reading, so the published figure can arbitrate the way it does for pocket mouths now.

### 3.3 Becoming part of the exterior boundary without flooding through the opening

- **Seeding.** Outside = not in (envelope ∪ accepted bodies). This is the frozen `!inEnvelope && !inBay` (`:1525-1526`) with bays replaced by bodies.
- **Mouth.** Shut the edges on D between the side walls' axes with `closure = 1` and `opening = 1 − wall`, as `:1475-1490` does today. The exterior is topologically closed across the door, while physical occupancy stays empty: the openings stage builds a door, not a wall.
- **Junction.** Leave the junction edges alone and let the flood decide:
  - OPEN → the body's cells join the house's room;
  - CLOSED → a separate region, which `planBodies` splits by wall share into two masses, as on G2E.
- **RECESS.** The RECESS test (`:1665`) stays on the **envelope**, not the union, so no existing pocket is reclassified.
- **Hypotheses.** H1 counts accepted bodies like `shutBays` (`:1607`).
- **Grid.** Add D's line, and side-face lines only if none lies within 0.5 w, and **only for accepted bodies**. Frozen houses keep their grid.
- **Downstream.** `PROJECTS_FROM` / `RECESSED_WITHIN` (`structural-layout.ts:196`) and the role `PROJECTION` (`:166`) exist but are never emitted: `attachmentsBetween` at `layout.ts:1350` and `assignRoles` at `:1311` produce only SHARES_WALL_WITH / ATTACHED_TO and MAIN / ATTACHED / UNKNOWN. In the first increment put the type in the digest only. Changing roles changes roofs (an **assumption**), so it needs an explicit re-pin.

### 3.4 Bounds

| quantity | bound |
|---|---|
| side members | ≤ 8 per side |
| pairs | ≤ 28 per side, ≤ 112 per plan |
| accepted bodies | ≤ 4 per plan |
| cost per pair | O(s × w) mask reads for piers and infill, plus O(s × w) for the junction |
| D search | ≤ the extent's far edge + 0.5 w; nothing past the printed extent |

Today's measured candidate load is at most 6 bands and 15 pairs (modrzykach), and everything else is ≤ 2 bands. There is no new pass over the whole sheet.

## 4. Regression risk and how to hold it

| risk | where | evidence | guard |
|---|---|---|---|
| G2E's bay rect or mouth moves | far face | `farFromLongerWall`: −12 cells, 185.74 → 147.55 m² | D from the distal corner piers and line, snapped to the existing line at 702. Test the rect `[178,479.5..427,702]`, 126 built cells, the 4.96 m mouth, H1 chosen |
| G2E reclassified as a terrace | junction CLOSED (85 %) | a callout exists (`500`, 0.61), and piers 19/21 with a line | the CLOSED branch accepts PIERS_LINE + callout. Pin it; an unread callout would drop it, so a real-house test with the callout masked should expect OPEN_MOUTH_GARAGE, not TERRACE |
| G2E's challenged readings change | `challengeFirstReading` (`plan-resolution.ts:837-842`) weighs metric alternatives (2.19 and 3.46 cm/px) with mouths "as decided" | the relational tests are ratio-based, so at other scales only the plausibility bounds shift | run the challenge and compare the considered readings' areas before and after, not only the hash |
| Marcówki's front strip becomes a body | V@70 + V@501 (a garden wall running through) | open today only because 8.03 m > 8 m and infill 0.09 | require corner piers at **both** ends of D. Marcówki has none at the right end: V@501 runs on to 826, and the pier runs there are 1 px. With J 56 %, the strip classifies as a terrace |
| Kosaćce: planter pairs with something | V@718.4 crosses the rear edge 1.73 m | single member | members < 2 w of free run or with no partner → nothing. Keep the RECESS test on the envelope so the 3 R cells do not move |
| New grid lines or wall re-measure move merges on any house | `thinLines`, `mergeRegions` | 005B §V (**assumption** for this change) | no new line unless a body is accepted; do not touch `wallPx`, `inside`, `thinLines` |
| A new shut body flips another gap's pocket decision | the pocket test floods with bodies (`:1557-1590`) | inferred from the code | accepted bodies appear only on houses that fail today; diff every `wideOpenings[].decision` on the pinned houses (must be byte-identical) |
| OPEN_MOUTH_GARAGE widens SHUT readings | `mouthsLeftOpen` | modrzykach already wastes 2 readings | the fast path (Marcówki, Kosaćce) never reaches the resolver; the UNKNOWN (≥ 0.8 width) type must not trigger it |
| Gating on "unexplained ink" | — | fires on 4 of 5 passing houses | do not use it as the guard; use the relation |

**Acceptance.**
- The digests of Marcówki (ground and attic), Kosaćce (both links), G2E, e-OZE and jablonkach are **byte-identical** in envelope, lines, cells, `wideOpenings` and bays.
- Then the three model pins.
- Then zurawkach ≥ 100 m² on the ground decomposition. This is a check, not a target: it is not to be tuned to.
- willa is judged only together with the extent reviewer's fix.

## 5. Tests

Synthetic cases A–L already exist as a probe (`synth.ts`). Each should become a vitest in `wide-openings.test.ts` style.

1. **Adversary to the 1.5 m rule (A):**
   - Setup: 4.0 m wing, 1.0 m beyond the main boundary, 0.30 m walls at 2.5 cm/px, two clean side walls, piers and a door line, OPEN junction.
   - Old: no bay, probe OUTSIDE (measured). New: PROJECTING_WING, BUILT.
   - Repeat at 2.2 and 2.75 cm/px with 20/17 px walls. There the free side-wall run (≈ 20–25 px) is near the band reader's `minLength` (22–26 px), so side members must also be found from the corner-block profile. That part is an **assumption**; the arithmetic is from `layout.ts:344-348`.
2. **Decorative 2.0 m extension (B):** one garden wall continuing a side wall 2.0 m, plus kerb lines. Expect no candidate, OUTSIDE. Variant: two garden walls, no piers, a line only → COVERED_TERRACE, OUTSIDE.
3. **Side walls starting inside the main body (C):** a partition runs from the rear wall through to the wing front. Old OUTSIDE (measured); new BUILT.
4. **Flush garage (D, zurawkach shape):** old OUTSIDE; new BUILT, with the area equal to the printed box. Add a variant whose W wall is broken by a window, checking that D is the distal closure, not a piece end (modrzykach).
5. **Open-mouth garage (E):**
   - First reading: OUTSIDE, with the candidate OPEN_MOUTH_GARAGE recorded.
   - `mouthsLeftOpen` is true.
   - The SHUT reading builds it.
6. **Covered terraces:**
   - F and G (the 005B post-review fixture, plus a step line) stay OUTSIDE.
   - **H2:** a walled terrace in front of a continuous facade with a 1-px step line. Today BUILT; new OUTSIDE. This is the regression test for P1-3.
   - I: a corner terrace (building wall running on, a terrace wall, a step line) stays OUTSIDE.
7. **Pergola (K):** four posts and thin beams → OUTSIDE, no candidate.
8. **L-shape (L, Holloway-like closed wing):** unchanged, BUILT, no candidate.
9. **U-shaped recess and loggia:** `wide-openings` test 6 and Dunmore (J, full-width returns running through the edge, nothing across) → RECESS or terrace, never BUILT, and no body.
10. **G2E shape:** CLOSED junction + piers + line + callout → BUILT, with D snapped to the existing line. Also: the same without the callout → OPEN_MOUTH_GARAGE (not BUILT, not TERRACE).
11. **Full-width pair (modrzykach shape):** the two outer walls past a short envelope → UNKNOWN / `ENVELOPE_SHORT_SUSPECTED`, no bay, `mouthsLeftOpen` false.
12. **Metamorphic:** scale each fixture by 0.8× and 1.25× in px, and switch walls between 0.30 and 0.50 m → the same classification. No metric threshold may decide.
13. **Real-house pins:**
    - digest byte-identity on the five passing plans (listed in §4);
    - the G2E bay rect;
    - zurawkach: exactly one accepted body (`MAX_Z`, 598–792 × 456–523.5), with the mouth recorded as an opening.

## 6. Findings

| # | Sev | Where | Finding | Evidence |
|---|---|---|---|---|
| F1 | **P0** | `plan-decomposition.ts:1257` | **Start-at-edge refuses every flush wing.** A side wall that is the building's own side wall, or a continued partition, runs through the edge | zurawkach V@782 starts −340 px; willa V@785.5 starts −326 px. Synthetic C and D: OUTSIDE |
| F2 | **P0** | `:1242`, `:1257`, `:1272`, with `:1399` | **`minOut` is measured to the band end** (one wall short, because corner blocks are not bands), with a wall term taken from the extent-filtered re-measure | Effective 1.50–2.66 m across the plans (§1.1). zurawkach needs 84 px and has 47 to the band end and 67.5 to the face. A 1.5 m-to-the-face rule rejects the printed 1.50 m wing by 0.1 px. Synthetic A (1.0 m) is refused even at 1.0 m |
| F3 | **P0** | `:1266-1271` | **The mouth must be an existing grid line.** Opening-fronted bodies have none (unread ticks, no front band), so both willa bodies are refused and their front cells do not exist (the grid ends at 501) | Corrected extent: 74.65 m² → 110.01 m² (lines injected) → 161.19 m² (with F1 and F2 fixed); published 169.9 |
| F4 | P1 | `:1259-1263` | **Pairing without coherence:** consecutive pairs only, a 2 m minimum, no maximum against the main side | modrzykach: outer walls 97.6 % of the width become a "bay" whose OPEN mouth triggers 2 SHUT readings (`plan-resolution.ts:653-654`) |
| F5 | P1 | `:1268`, `:1278` | **The far line comes from `min(reach)` and the corners test is circular.** A window-broken piece sets the depth, and the test passes by construction | modrzykach far line 324 through rooms; corners passes by 3.2 px |
| F6 | P1 | `:1335` | **Mouth shut without a junction test and without distal piers:** a step or paving line counts as a door | Synthetic H2 (walled terrace in front of a continuous facade) is BUILT today. Junction coverage separates the cases: 8 / 12–16 / 6 % (open) against 85 / 100 % (closed) |
| F7 | P1 | `plan-resolution.ts:606-607`, `:653-654` | **The SHUT alternative exists only for bays the first reading proposed** | zurawkach had no bay, so none of its 8 readings could shut the garage (40–43 m²) |
| F8 | P1 | (design) | **Generalising in the obvious directions moves pins or builds terraces.** Far face from the longer wall costs G2E its garage (−12 cells, measured). The naive relaxation builds synthetic H and I and proposes bays on F, G and J. "Unexplained ink" gating fires on 4 of 5 passing houses | `variants-all.txt`, `synth.txt`, `unexplained.ts` output |
| F9 | P2 | `layout.ts:344-348`, band reader | **Corner blocks and piers are never bands** (the run across exceeds 1.9 walls), so reach is always one wall short and piers are invisible to `sideWallReach`'s `pierOn` on thick-walled sheets | zurawkach piers 37 × 22 px against a maximum of 27 px |
| F10 | P2 | metric evidence | **Callouts at garage mouths go unread.** zurawkach `260/229` and willa `500/238` / `350/230` were not read; only G2E's `500/238` (0.61) was. Infill carried every real case | `metric-evidence.json` callout inventory |
| F11 | P2 | `structural-layout.ts:166`, `:196`; `layout.ts:1311`, `:1350` | **`PROJECTION`, `PROJECTS_FROM` and `RECESSED_WITHIN` exist but are never emitted:** the taxonomy has a destination. Emitting them changes roles and roofs (**assumption**), so it needs its own re-pin | code read |
| F12 | P2 | `:1003-1043` against `:1232` | **`sideWallReach` and `baysOf` encode the same relation with different constants** (2 walls against 4 walls or 1.5 m; pier on the line against infill or callout; `endsOnPartition` against nothing) | code read. Unify them as the full-width and wing branches of one classifier |
| F13 | P2 | 005B report §AE and holdout README | **Wrong `minOut` stated:** they state 67.6 px for zurawkach; the code applies 84 px (decomposition wall 21, not the sheet's 14) | `bays.ts` trace |
