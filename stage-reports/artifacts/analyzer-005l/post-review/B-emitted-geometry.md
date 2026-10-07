# BUILDPLAN-ANALYZER-005L — Council Reviewer B: per-storey emitted geometry

Code under review: worktree `/home/user/work005l/council-wt`, detached at `4ad69fe` (diff `a70047f..HEAD`).
All coordinates are model/v2 metres (x from the west face, z from the front plane) unless marked "layout".

## Verdict: CHANGES_REQUIRED

There are three P0s and three P1s. Each one is demonstrated, either on a development row's emitted model or on an end-to-end synthetic probe.

- The per-storey path is right for the case the fixtures cover: a rectangular inset on the upper plan's envelope (INSET_REAR, and my INSET_WEST).
- It is wrong in four places:
  - Real plans whose walled region is not the plan's walls. This is Marcówki, the stage's own historical control.
  - Houses with an UPPER plan and an ATTIC plan.
  - L-shaped upper storeys.
  - Attached bodies that are only partly carried up.
- The development matrix calls two of these rows PASS (marcowki PASS→PASS, dom-w-tunbergiach FAIL→PASS). Their emitted upper geometry is wrong.

| id | sev | one line |
|---|---|---|
| B5L-1 | P0 | Marcówki: the attic ring shrinks 0.91 m and 1.05 m inside its gable walls. The printed-callout gable glazing and both attic portal balconies are lost, and a phantom eaves door appears. The attic plan's own outer wall faces match the ground body to 0.3 %. |
| B5L-2 | P0 | v2 indexes plans by a role table (`ATTIC: 1`), while the layout uses compacted ranks (UPPER 1, ATTIC 2). With UPPER+ATTIC, storey 1 is read from the attic plan and storey 2 has no plan (dom-w-tunbergiach; synthetic). |
| B5L-3 | P0 | L-shaped upper storey: the "pieces tile a rectangle" merge budget is 2·(W+D)·tol, about 16 m². It swallows a room-sized notch. The ground ring is copied upstairs, phantom 5.6 m and 2.0 m windows fill the notch, and an upper room sits over the void. |
| B5L-4 | P1 | An attached body carried up over part of its width gets its flat roof over the whole body, at the top storey's height. willa-miranda: a 6.40 m SOURCE_EXACT plate over 6.5 m of body, 0.59 m above the main ridge. The 3.21 m roof over the one-storey part is dropped. |
| B5L-5 | P1 | A storey in several pieces gets three defects: a duplicate full-outline slab per extra piece, a phantom 0.8 m double wall with a "shared door" across an open L junction, and an inset side built beside the drawn wall, which turns into a phantom 5.24 m sill-0 window. |
| B5L-6 | P1 | Storeys below the base have three defects: the lowest storey's own footprint is discarded (partial basement = ground ring), level elevations are index-blind (the ground floor lifted to 2.80 m), and a basement under an attached body only gives MODEL_EMISSION_FAILED (`setEvidence ring-attached-0--1` UNKNOWN_TARGET). |
| B5L-7 | P2 | Interior topology hosts use the body, not `rectAt`. |
| B5L-8 | P2 | Gable hosts take their eaves from the storey rect, so the soffit is too low by inset·tanα near an inset eave side. |
| B5L-9 | P2 | Several choices still read the body or a single piece: the main roof, the plan-frame `covers`, and near-tie storeys emitted with SOURCE_DERIVED rings. |
| B5L-10 | P2 | D00: the misread levels [0, 13.04] now produce a 13 m ground storey. With a one-floor section, the level-1 elevation is a convention. |
| B5L-11 | P2 | Test and matrix gaps that let B5L-1 to B5L-6 through. |

Probes (throwaway, numbers only) are in `/home/user/work005l/council/B-probes/`:
- `council-b-probe.test.ts`: end-to-end synthetic houses through `reconstructV2`.
- `probe-dev.ts`: the v2 solver on a development row's sealed inputs.
- `faces.ts`: the layout plus `outerWallFaces` of each plan.
- One `<probe>.json` per synthetic house.

---

## B5L-1 — P0 — Marcówki: the attic is emitted 0.9–1.05 m short at both gables

**Where.**
- `layout.ts:1235–1274` (`storeySupportOf`): the piece is the decomposition region ∩ mass. Its sides are snapped only to the mass's sides, within `bandM`.
- `v2/reconstruct-v2.ts:387–395`: the piece becomes `storeyRects`.
- `emit.ts:150–157`: the ring is built from `rectAt`.

**Scenario.** A real attic plan in which the decomposition's BUILT region stops short of the plan's own outer walls. Here the cause is the heavily glazed gables.

**Observed.** Numbers are from `/home/user/work005k/dev/OFF/marcowki/model.json` (005K) and `/home/user/work005l/dev/NEW/marcowki/model.json` (005L), re-run with `probe-dev.ts` and `faces.ts`.

| | 005K | 005L |
|---|---|---|
| ring-main-1 | [0, 0.991, 7.9, 13.601] = ground body, 99.6 m² | **[0, 1.897, 7.9, 12.549]**, 84.1 m² |
| attic front gable | opening-1-front-4-0, 2.70 × 3.20 | none |
| attic rear gable | 2 × 2.34 (h 3.04 / 1.07) | 3.50 × 0.76 and 3.41 × 0.80, "no callout read" |
| attic east eaves wall (x = 7.9) | none | **0.62 m DOOR** |
| attic portal balconies | balcony-front-1, balcony-rear-1 | none |
| attic rooms | reach z 1.48..13.13 | clipped to z 2.39..12.04 |

The attic frame's metric evidence still holds the callouts 270, 234 and 234. They are printed as 270/320 and 2 × 234/303, and the new model uses none of them.

Why this is wrong, from the pipeline's own numbers:
- `outerWallFaces(attic raster)`, the same function `planFrameByOuterFaces` uses, returns px x 46..347 × y 194..673. That is an aspect of **1.5914**, against the ground main body's 12.61 / 7.90 = 1.5962 (0.3 %). The attic plan's walls are the body.
- The attic's BUILT region is px y 238..632.5, which is 44 px and 40.5 px inside those faces. That gap is the whole "inset".
- In 005K, v2 framed this plan exactly on its outer faces. In 005L the frame against `rectAt` (10.65/7.90 = 1.35) fails the 3 % check and logs "storey 1 plan registered :: 0.026961 m/px; **no outer faces found**". It then falls back to the alignment.

The layout itself reported `DEGRADING:STOREY_COVERAGE_DISAGREES` (margin 0.039), yet the ring is evidenced SOURCE_DERIVED.

An independent hand trace of the same ARCHON plans in the sibling repo agrees with 005K:
- In `BuildPlan-PC-Legacy/app/src/debug/java/com/buildplan/app/reference/visual/MarcowkiPlanGrid.kt`, both storeys share the same gable walls, and the eaves walls continue 1.0 m past both gable faces "on both storeys".
- The attic gable doors are printed 270/320 and 2 × 234/303, at the gable walls.

**Why P0.** It emits a wrong upper footprint, with confidence, on the stage's named historical control (§27), and the verdict stays PASS. §12 asks for the upper footprint to differ from the ground footprint "when the source says so", and here the source says the opposite.

**Generic fix.**
1. An inset side of a supported piece must be carried by the upper plan's own wall under the placement: a wall band of that plan along that side, or the plan's outer wall face (`outerWallFaces`).
2. Where the upper plan's outer wall faces land on the body's side within `bandM`, those faces bound the storey, whatever the cell region says.
3. In v2, treat "outer faces fit the body within 3 % but not `rectAt`" as a contradiction. Do not emit the inset; keep the body and name the conflict.

Fixture: an upper storey whose end walls are mostly glazing or doors, with portals or returns past them.

## B5L-2 — P0 — UPPER + ATTIC: storey 1 is read from the attic plan, storey 2 from nothing

**Where.**
- `v2/reconstruct-v2.ts:430` maps by role: `storeyIndexOf = ({ BASEMENT: -1, GROUND: 0, UPPER: 1, ATTIC: 1, ROOF: 2 })`.
- `v2/reconstruct-v2.ts:451`: `planByStorey.set(index, …)` overwrites.
- `layout.ts:985–995` (`storeyIndices`) ranks compactly: GROUND 0, UPPER 1, ATTIC 2.

This was latent before 005L. 005L is the first stage that stacks a third storey, which exposes it.

**Dev row dom-w-tunbergiach (005K ALGORITHMIC_FAIL → 005L PASS).** `probe-dev.ts` logs two steps:
1. "storey 1 plan registered :: … its outer wall faces … put on the 11.73 × 10.00 m body" (the UPPER plan).
2. "storey 1 plan registered :: 0.020946 m/px; no outer faces found" (the ATTIC plan, which overwrites the first).

What is emitted:
- **L1 openings**, read from the attic raster on the full ring:
  - front: 2 × 2.64 m MULTI_PANEL_GLAZING;
  - east and west: 5.99 m MULTI_PANEL_GLAZING plus a 0.93 m DOOR each.
- **L1 interior**: one room of 11.15 × 9.45 m and no partitions.
- **L2**: ring [4.645, 0, 7.179, 3.514] with no openings, no rooms and no interior. Its slab is the full 105 m² body.

**Synthetic probe `three-plans`.**
- Input: GROUND, then UPPER (the whole 9.6 × 8.4 box), then ATTIC (set back 2.4 m at front and rear).
  - The upper plan draws FRONT windows at x 1.6 and 5.6 (1.3 m), a WEST window at z 2.0 (1.2 m), and a partition at z = 3.0 with a door.
- Emitted L1:
  - none of the three windows;
  - a FRONT DOOR 0.92 m at x 4.0, which is the attic partition's door;
  - EAST and WEST: a 1.03 m DOOR plus a 3.28 m sill-0 "WINDOW" each;
  - no partition, one room.
- Emitted L2: ring [0, 0, 9.6, 3.17] with nothing on it.
- The attic is also registered at the wrong z (margin 0.012). That is Reviewer A's domain.

**Fix.**
- Take every plan's storey index from the layout: `draft.storeys.find((s) => s.frameIds.includes(plan.frame.id))?.index`.
- Assert one plan per index; on a collision, fail loud instead of overwriting.
- Add a GROUND+UPPER+ATTIC fixture.

## B5L-3 — P0 — an L-shaped upper storey is merged into the body rectangle

**Where.** `layout.ts:1300–1304`. Pieces over one mass merge into their bounding box when `boxArea − sum ≤ 2·(W + D)·tolM`.
- With tolM ≈ the wall (0.40 m), the budget on a 12.4 × 7.6 m house is 16.0 m².
- A whole room-sized notch fits inside that budget, for example a 4 × 4 m corner terrace.

**Probe `l-one-body`.**
- Input: a 12.4 × 7.6 two-storey box. Its upper plan is a closed L, with a front-east notch of 6.0 × 2.6 m = 15.6 m².
- Layout: two regions, [0, 0, 12.4, 5.0] and [0, 5.0, 6.398, 7.6] (layout z). Both SUPPORT mass-0, then they merge into `footprint-1-mass-0` = [0, 0, 12.4, 7.6], the body.
- Emitted:
  - `ring-main-1` [0, 0, 12.4, 7.6], identical to `ring-main-0`;
  - `opening-1-front-4-1`: a 5.64 m WINDOW, sill 0, at x 6.41..12.04 (the notch's open front);
  - `opening-1-east-5-0`: a WINDOW narrowed from 2.04 to 1.92 m, at z 0.47..2.39 (the notch's open side);
  - `main-room-1-0` [0.42, 0.42, 11.97, 7.17], which covers the void.

This reproduces exactly the M6 symptom (§12, §21: "no duplicated ground ring upstairs", "no phantom upper room over terrace/void") by another path. The INSET_REAR fixture cannot see it.

**Fix.**
- Merge only slivers. The uncovered part of the box must contain no rectangle at least `minSpanM` on both axes; check its narrow side, not an area budget that grows with the perimeter.
- Add a notch fixture whose area is below the current budget.

## B5L-4 — P1 — an attached body partly carried up gets its roof over the whole body, one storey up

**Where.** In `v2/reconstruct-v2.ts`:
- line 827: `l = levelOf(max storeys)`;
- line 854: the section window `[l.elevation, l.wallTop + 1.5]`;
- line 882: `footprint = { x0: m.x0, x1: m.x1, … }`, the body.

In `emit.ts:178`, the ring height follows `attached && isTop`.

**willa-miranda.**

| | 005K | 005L |
|---|---|---|
| attached-0 (x 8.00..14.51 × z 0..2.45) storeys | [0] | [0, 1]; storey-1 rect x 9.19..11.79 (2.60 of 6.51 m) |
| roof-attached-0 | FLAT on lvl-0, top **3.21**, SOURCE_EXACT from the section | FLAT on lvl-1, top **6.40**, SOURCE_EXACT, over the whole body |
| ring-attached-0-0 height | 3.56 | 2.80 |
| ring-attached-0-1 | — | 3.60 tall, up to the plate |

- The 005L roof's provenance reads "the section draws a 0.49 m slab with its top at 6.40 over this body on 5 columns".
- The plate is 0.59 m above the main ridge (5.81).
- Over the 3.9 m of the body that remains one storey, the model has a terrace slab and nothing else, and the section's 3.21 m roof is gone.
- The storey was stacked on a near tie (margin 0.002, against a placement standing on mass-1 only).

**dom-w-zurawkach.** The wing's roof moves from 3.35 (lvl-0) to lvl-1 at **5.60**, ASSUMED_FOR_RENDERING, over the whole wing (z 0..9.50). The storey-1 rect starts at z 0.82.

The layout says storey 1 stands on part of the body, and the emitter roofs the whole body as if it all stood there. That is inconsistent with its own layout decision.

**Fix.**
- Roof the top storey over `rectAt(m, top)`.
- Over body − `rectAt(top)`, keep the roof of the storey below, read in that storey's section window.
- Alternatively, split the attached body into pieces.

Synthetic note: my "room over the rear of the garage" probe could not produce an upper region for the room. The generator or decomposition does not emit it, so that probe is inconclusive and the evidence above is the development rows.

## B5L-5 — P1 — multi-piece storeys: duplicate slabs, phantom junction walls, sides beside the drawn wall

**Where.**
- `reconstruct-v2.ts:395–399`: extra pieces become `ATTACHED` with `storeys: [s]`.
- `emit.ts:170–172`: `bearsOnWalls = storey !== min(storeys)`. This is false for a piece, so the piece's slab is the full outline (the plinth rule).
- `layout.ts:1272`: sides are snapped only to the lower mass's sides.

**Probes `l-one-body-big` (a closed L with a 6.0 × 3.6 m notch) and `l-open` (the same L with no wall between the legs).**
- **Duplicate floor.** `slab-main-s1-1-1` [6.398, 3.8, 12.4, 7.6] at lvl-1 lies on top of `slab-main-1` [0.422, 0.422, 11.978, 7.178], also at lvl-1. They overlap by about 19 m², and nothing validates slab overlap.
- **Phantom wall (l-open).** `ring-main-1`'s east wall (x 6.0..6.4) and `ring-main-s1-1-1`'s west wall (x 6.4..6.8) run along z 4.0..7.6, where the plan draws no wall. The result is a 0.8 m wall through an open-plan L. The openings reader then punches `shared-opening-1-east-5-0` through it: a 2.66 m "door", narrowed from 3.19 m.
- **Side beside the drawn wall (l-open).**
  - The leg's front side is taken at z 3.998, which is the region cut on the far face of the drawn notch wall (z 3.6..4.0).
  - The ring's wall therefore stands at z 4.0..4.4, next to the drawn wall.
  - The reader sees an empty band and emits `opening-1-front-8-0`: a **5.24 m WINDOW, sill 0**.

**Fix.**
- Emit a multi-piece storey as one ring/polygon: no wall on a shared piece edge unless that plan draws one there, and no second slab.
- Move non-snapped sides to the drawn wall's outer face, as `toOuterFaces` does for base regions.
- Add an L fixture with an open junction.

## B5L-6 — P1 — storeys below the base

Cross-reference: Reviewer A's A5L-4 covers the gate side. These three emission defects are additional.

1. **The basement's own footprint is discarded.**
   - `reconstruct-v2.ts:391` skips `s === m.storeySpan.fromIndex`. With a basement that is the basement, not the base. The comment "the body's rectangle is its lowest storey's" is false there.
   - Probe `partial-basement`: the layout records `footprint--1-mass-0` (front 5.4 m). The model emits `ring-main--1` [0, 0, 9.6, 8.4], the ground ring, with a full slab and the body's SOURCE_EXACT evidence.
2. **Level elevations are index-blind.**
   - `reconstruct-v2.ts:410–411` gives the i-th of `main.storeys` the value `floors[i]`.
   - In the same probe: index −1 is at 0.00, the **ground floor at 2.80**, the upper floor at 5.60, and the roof's eave (5.40) is below the upper floor.
3. **Basement under an attached body only fails the model.**
   - The garage's span becomes −1..0 while main's is 0..1, so there is no level −1 and the ring is skipped.
   - `emit.ts:187` still sets evidence on `ring-attached-0--1`.
   - Probe `garage-basement`: **MODEL_EMISSION_FAILED** — "the model refused command 22 (setEvidence): UNKNOWN_TARGET", object `ring-attached-0--1`.

**Fix.**
- Build levels over the union of every mass's storeys, with each elevation keyed by storey index. Use a printed datum for index −1, or a convention below 0, never `floors[0]`.
- Set evidence only on rings that were emitted.
- `rectAt` must return the lowest storey's own footprint whenever that storey is not the base storey.

## B5L-7 — P2 — interior topology hosts use the body

`emit.ts:263–270` builds `hosts` (`ring-…-w0..w3` bands) from `m.x0..m.z1` for every storey. On an inset storey the bands sit at the body's faces while the ring's walls are at `rectAt`.
- A partition that meets the inset wall is neither trimmed to it nor recognised as lying inside it.
- No overlap occurred in `inset-rear-partition`, because `readInterior` already clips to `rectAt`. The topology plan's guard is simply off.
- Fix: use `rectAt(m, storey)`.

## B5L-8 — P2 — the gable soffit is computed from the storey rect

`reconstruct-v2.ts:776` sets `eaveAtLow: from, eaveAtHigh: to` from the storey rect. `gableSoffitY` (`openings-v2.ts:157–160`) then treats the inset wall as the eave.
- Near an inset eave side the soffit comes out too low by inset · tanα. For INSET_WEST that is 2.4 × tan 35° = 1.68 m.
- Openings near that corner are wrongly classed RAKED.
- Fix: use the main roof footprint's extent along the facade.

## B5L-9 — P2 — choices that still read the body or a single piece

- **Main roof** (`reconstruct-v2.ts:524–542`). `ridgeAt`, `halfSpan`, the eave and the footprint come from the main body whatever the top storey's rect is. That matches the synthetic sheets, which draw the roof over the body. But nothing decides between "the roof over the body" and "the roof over the top storey plus a terrace" for a real setback.
- **Plan-frame `covers`** (`:441`). It is the largest single rect, not the storey's union. Every multi-piece storey therefore logs "no outer faces found" and falls back.
- **Near ties.** Storeys stacked on a near tie (`STOREY_COVERAGE_DISAGREES`: marcowki 0.039, willa-miranda 0.002, tunbergiach attic 0.018, D00 0.018) still emit their per-storey rings as SOURCE_DERIVED. The conflict should reach the ring's evidence, at least as an unresolved property.

## B5L-10 — P2 — level datums the new storeys stand on

- **D00.** The section is read as floors [0, 13.04]. The new model has a **13.04 m ground storey**, with the attic ring at an elevation of 13.04 m. In 005K it was one level, 17.51 m tall. The level read predates 005L, but the stacked storey is new. The row stays ALGORITHMIC_FAIL.
- **One-floor sections.** willa-miranda, dom-w-zurawkach and A07 print one floor. Their level 1 is set at 2.80 m by `CONVENTIONS.storeyHeight` (`:410`), and the ground storey is trimmed from the printed 3.15 / 3.35 / 2.96 to 2.80. Please check that the level feature is not labelled as a printed datum; that is Reviewer C's domain.

## B5L-11 — P2 — gaps in the tests and the matrix

- **Fixtures.** None of the four emission fixtures has any of these: an L or notch, UPPER+ATTIC, a partial basement, an attached body partly carried up, a multi-piece storey, or a storey whose end walls are glazed.
- **The matrix.** Its `copiesLowest` and verdict checks missed marcowki (PASS→PASS, attic −15 %, printed openings lost) and tunbergiach (FAIL→PASS, L1 read from the attic).
- **Suggested judge.**
  - Check each emitted storey ring against that storey plan's own outer wall faces, under its frame.
  - Require exactly one plan per storey index.
  - Compare upper-storey openings with that plan's opening callouts.

---

## What held

- **Rectangular inset on the plan envelope.** INSET_REAR (stage fixture) and my INSET_WEST probe (`inset-west.json`) are correct:
  - `ring-main-1` is [2.4, 0, 9.6, 8.4].
  - The inset storey's openings are on its own walls at the right offsets. Front x 5.03..6.27 against 5.0..6.3 drawn; west z 3.03..4.17 against 3.0..4.2; rear x 6.01..7.18 against 6.0..7.2.
  - Upper rooms stay inside the ring, and there is no room over the setback.
  - The level-1 slab is the body inset by one wall, which is the ceiling of the storey below.
- **`wallOffset(rectAt(…))`** is used for openings, shared doors and surface regions (`emit.ts:471, 500–502, 541`).
- **Garage safety.** HOUSE_AND_GARAGE (fixture) and my GARAGE probe keep the garage at one storey (`storeys [0]`).
- **No overlaps or crashes elsewhere.** No probe produced WALLS_OVERLAP. Every model validated except B5L-6(3).
- **Piece ids are deterministic and unique.** Examples: `main-s1-1`, `ring-main-s1-1-1`, `slab-main-s1-1-1`. Pieces are ordered by area, then x0, then z0 (`layout.ts:1302`), so `rects[0]` is the largest.
- **Body copies match their support records** (not M6) on A07, A06 (main and porch), tunbergiach L1 and dom-w-morelach: their regions cover the bodies.
- **Stage fixtures.** The 4 emission fixtures pass in this worktree (43.9 s).
- **Inconclusive probes.** `l-two-masses` and `garage-room-rear` gave no upper region for the wing/room. The synthetic upper plan omits the wing's own wall where the main is set back, so these say nothing about emission.
