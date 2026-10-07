# BUILDPLAN-ANALYZER-005L — storey registration and per-storey footprint stacking: architecture

Code lives in two places:
- `packages/reconstruction/src/layout.ts`: registration, the support relation and the per-storey footprints.
- `packages/reconstruction/src/v2/{building,reconstruct-v2,emit}.ts`: per-storey rectangles in the emitted model.

`LAYOUT_INFERENCE_VERSION` is 1.1.0 and is carried in the run's `ANALYZER_VERSIONS`. The layout set schema is unchanged.
The support relation lives in two places:
- the draft, as `StructuralLayoutDraft.storeyRegistrations`;
- the footprint regions it creates.

It is shown in the Evidence Pack 1.3.0 as `14b-storey-support.json` and the STOREY_SUPPORT timeline stage.

This text describes the code **after** the council (`post-review/resolution.md`).

## 1. Two questions, kept apart

| Question | Answered by | Never answered by |
|---|---|---|
| **Where does the other storey's plan sit on the plan below?** (scale, offset) | `alignPlans`: wall-on-wall correspondence over bounded hypotheses | the storey count, the published areas, or whichever answer removes a refusal |
| **Which body below carries each of its walled regions, and over what rectangle?** | `storeySupportOf`: every walled body of that plan, placed, tested against every mass | the plan's envelope, a 50 % coverage share, or "every mass gets every storey" |

Before 005L the two questions were one test. The upper plan's *envelope* was placed, and a mass reached the storey if
that rectangle covered at least 50 % of it. Every first bad decision in `baseline-storey-registration.json` is one way
that conflation fails:
- the envelope takes in a roof outline or an eave line;
- there is no candidate at the scale the envelope implies;
- an inset storey over a large body covers less than half of it;
- the emitter then copies the ground ring upstairs.

## 2. Registration (`alignPlans`)

A discrete, bounded search. Every hypothesis is a named statement about the two drawings, and each placement records
it as its `basis`.

1. **FITTED / PRINTED_SCALE.** The plan's envelope is scaled to one alignment target, with 3×3 face/centre offsets.
   - Targets: every BUILT region below, the envelope, and the envelope without attached rooms.
   - Scale: the scale both plans' registrations print, or the one fitting that target.
2. **STATED.** Offsets where the plans' own chains put the storey. This applies only on an axis where *both* chains
   measure the whole building: |span(other) − span(base)| ≤ max(wall, 1 %). A placement is `stated` only when its scale
   AND both offsets come from the chains.
3. **WALL_PAIRS.** The outermost facade-length walls at each end of each axis: bands ≥ 25 % of the longest
   (`FACADE_WALL_SHARE`), plus the decomposition's envelope and largest-region sides.
   - A pair along x and a pair along z each fix a scale.
   - The placement is kept where the two agree within 2 % (`WALL_PAIR_SCALE_AGREEMENT`) and lie in [1/3, 3].
4. **SAME_PIXEL_SCALE.** k = 1, crossed with the 6 offsets per axis that land the most wall
   (`SAME_SCALE_OFFSETS_PER_AXIS`). This is the hypothesis that the two sheets share one pixel scale, which holds for
   the supported publisher's exports. A registration that rests on it alone says so (§4, `scaleBasis`). It is not
   assumed of any other source (council D5L-1).

**Score** = `shares` + 0.15 · coverage + 0.03 · stated.
- `shares` = 2·(long wall landed on long wall) / (placed long wall of this plan + long wall below). This is Dice over
  the major walls. It is symmetric, so neither shrinking (precision rises) nor stretching (recall rises) can choose a
  scale.
- Matching is exclusive (a base wall stretch counts once) and nearest-band. The tolerance decides which base band a
  wall is on; the length counted is what lies on that band itself, never past its ends. Counted out to the ends plus
  the tolerance, a stretched plan gained up to two tolerances per wall it overran, and `shares` exceeded 1.
  `agreement` (precision) is reported only.
- Coverage uses the rectangle the hypothesis claims (for a wall-pair placement, the four paired walls), not the
  envelope.

**Order.** The order is total on the placement's own numbers: score, target, scale, offsets, stated, why. Enumeration
order cannot pick a leader. Duplicates (same scale and offset within tolerance) collapse.

**Resolution** (council A5L-7). Wall ends are read to a pixel. A pixel at each end of every long wall of this plan moves
`shares` by 2·n / (k·L_other + L_base), and a pixel on two sides of the claimed rectangle moves coverage by
0.15·(1/w + 1/h). Two placements nearer than this sum are not told apart by the walls. The sum is the tie threshold,
recorded as `resolution`; `STOREY_TIE` = 1e-6 is only its floor.

**What holds against the best fit.** Both rules below exist so a fit at another reading cannot silently override the
drawings' own statements.
- **A stated placement** holds when it shares ≥ 0.5× the best fit's wall, or when the plan's largest walled body lies
  inside the building below. An inset-all-round storey shares no wall and is still right.
- **The printed scale** (council A5L-1) applies where both plans print a scale and the best fit sits at another scale
  (beyond 2 %). The fit then claims that a printed scale is misread, and the walls must show it.
  - The best placement at the printed scale is held (`printedScale.outcome = HELD`, `held.by = PRINTED_SCALE`) when it
    shares ≥ 0.5× the fit's wall AND its largest body lies inside the building below.
  - Otherwise the fit stands, and the printed scale is on the record as `REFUTED`.

## 3. Upper bodies and support (`upperBodiesOf`, `storeySupportOf`)

**Upper bodies.** The other plan's walled bodies come from `planBodies(decomposition)`, the same body test the base
uses: perimeter wall fraction ≥ 0.35, and a narrow side of at least two walls and a room. Two further rules apply.
- **Storey walls** (council A5L-8). The perimeter must carry walls of at least `STOREY_WALL_SHARE` = 0.75 of the plan's
  wall thickness (`storeyWallFraction`). A half-wall parapet around a roof terrace is not a storey.
- **Reach** (council B5L-1). A region is cut on the plan's inner lines. Where an unshared side lies inside both
  perpendicular facade storey walls, and both walls run on past it, the side is moved to where the nearer of the two
  walls stops (`reached`). The storey's outline is where its outer walls run, not where a chain line cuts its room.
- **Outer faces.** A set-back side records the outer face of the wall drawn along it (`faces`). It is applied only
  where the side is a set-back over a body (council B5L-5), so that the opening reader does not see the drawn wall as
  a window.

**Support.** Each body is placed into the building frame and tested against each mass.
- **NOT_A_BODY.** Too little wall or too narrow: it carries no storey (line work, strips, piers).
- **SUPPORTS** when the overlap is ≥ `minSpanM` on BOTH axes, i.e. a room's span. Otherwise the overlap is
  **INCIDENTAL** (a wall's thickness, registration jitter, an eave) and carries nothing.
  - `carried` counts SUPPORTS overlaps only.
  - A body less than half carried (`mostlyUnsupported`) gives no pieces, and its relations become INCIDENTAL.
- **The supported piece** is region ∩ mass. Each side within `bandM` of the mass's side is snapped to it, and the snap
  is strict. Regions are cut on inner lines and axes; masses are measured to outer faces.
  - `bandM` = jitter (half a base wall) + the other plan's wall, as placed.
- **Merging.** Pieces over one mass merge only when what lies between them is seams (`onlySeams`), never by an area
  budget (council B5L-3).
- **Overhang** is computed by erosion (council A5L-3 / D5L-2), so it does not depend on orientation.
  - `NONE`: fully carried.
  - `WITHIN_TOLERANCE`: the region shrunk by `bandM` all round is fully carried.
  - `BEYOND_TOLERANCE`: a named unresolved overhang. The supported part is built and nothing is invented to carry the
    rest.
  - `UNSUPPORTED`: it stands on nothing.

Each relation records:
- intersection m², `upperSupportedShare`, `lowerCoveredShare`, overlaps and wall agreement;
- a status and a sentence.

`lowerCoveredShare` is a diagnostic only; nothing thresholds it. Mutation M1 restores the old rule and is killed.

## 4. The storey decision (per non-base plan)

Storeys are processed outward from the base. `StoreyRegistration` records the following:
- the chosen placement and its rival;
- `resolution`;
- `scaleBasis`: the basis, whether another basis agrees with it within 2 %, and why;
- `printedScale` where it applied;
- regions, relations and a sentence.

`decision` takes one of four values.
- `NOT_REGISTERED`: there is no placement.
- `STACKED`: the chosen placement's support is applied.
  - Per-mass footprint regions `footprint-${storey}-${mass}` (and `-k`) are created.
  - Storey spans are extended only for supported masses.
- `AMBIGUOUS` covers two cases:
  - The best rival that stands the storey differently (`sameSupport` false, compared side by side within twice the
    snap band) is within the resolution. Nothing is stacked; a `STOREY_COVERAGE_DISAGREES` conflict and an AMBIGUOUS
    gap are recorded.
  - Every body it would stand on is disputed or cut (below).
- `NO_SUPPORT` covers two cases:
  - No region supports any mass.
  - For a storey **below** a base that is not the ground plan, a body or its walls reach past every base mass
    (`wallsBeyond`). That base plan does not hold the whole building. The guard does not apply to a basement under the
    ground plan, whose excess is a named overhang (council A5L-5).

The rules around the decision:
- **Near ties.** A rival within `STOREY_RIVAL_WINDOW` (0.1) that stands the storey differently is a conflict, unless it
  only *adds* bodies to the chosen ones. The bodies only the chosen placement stands on are **disputed**: named
  AMBIGUOUS gaps, not stacked. Up to 24 rivals are weighed.
- **Contiguity** (council A5L-6). A body reaches storey k only through k ± 1. A body the storey between does not reach is
  **cut**: a named gap, not built.
- **Held readings** (council A5L-11). A stated placement or printed scale held against a better fit is recorded as
  `held`: what held it, the fit, and whether the fit stands the storey elsewhere (a side moves by more than half the
  same-support tolerance). It is a record, not a conflict. Every correctly stated set-back is held against a
  better-fitting flush shift (§25 fixture C), and the walls do not tell a misread statement from a true one.
- **Roles** (`assignRoles`) are unchanged and read the storey spans. A mass no storey reaches stays one storey: garage
  safety, and mutations M2 and M7 are killed.
- **The ground storey** (`groundStoreyOf`) is the lowest storey of index ≥ 0. A stacked basement never becomes the
  ground (council A5L-4).

## 5. Emission (v2)

`MassV2.storeyRects` comes from the footprint regions. `rectAt(mass, storey)` gives the body rectangle where a storey has
none of its own.
- **Which storey is skipped.** The storey a body was measured on is skipped by its own id, not by `fromIndex`, so a
  basement below it keeps its own rectangle.
- **Levels.** Levels stand on `datumOf(index)` from the ground datum, over every mass's storeys.
- **Plan storey index.** Each plan's storey index comes from the layout's own ranks (`draft.storeys`), not a role
  table (council B5L-2).
- **What uses `rectAt`.** Rings, opening hosts, returns, interior hosts, shared doors, surface regions and attached
  roofs (`rectAt(top)`).
- **Plan frame.** Where the registration's scale is stated (STATED or PRINTED_SCALE), an outer-face correction is
  accepted only within 3 % of it (`PLAN_FRAME_SCALE_AGREEMENT`): an L outline's faces put on one leg agree with
  themselves and are wrong by the L. A registration fitted from the walls alone yields to the faces, as before 005L.
- **Slabs.** A slab stays the body (the ceiling of the storey below), except the lowest storey, whose slab is its own
  footprint.
- **Extra pieces** (`pieceOf`) get no slab.
- **Pieces that meet** (`PIECES_MEET_M` = 1 m; an L or a T) are not built as two rectangles with a wall between them.
  The largest is built and the meeting piece is a named AMBIGUOUS gap.

Copying the ground ring upstairs (mutation M6) is killed by the end-to-end fixtures.

## 6. Non-circularity

- **Inputs.** `inferStructuralLayout` reads its options only through `layoutOptionsOnly`, an explicit list
  (`LAYOUT_OPTION_KEYS`). An executed Proxy test shows that no other key is read.
- **Structural pass.** `structural.ts` names the published areas in exactly three lines (type import, option, hand-on
  to the gate). The gate pins that.
- **Vocabulary.** The registration and support code names no published value, storey count, expected value, verdict or
  house. Neither does the v2 `storeyRects` block. Their literals are frozen.
- **Decoys.** Executed decoys give byte-identical decisions and rings: a published footprint ×1.25 or absent, a room
  list claiming a third storey, and areas against the room list.
- **Mutations.** M4 and M8–M10 are the published-fact choosers council C5L-1 named; each is killed.

**The boundary that remains** (council C5L-7). The 005A plan resolver, which predates 005L, may let a published
footprint figure *veto* a base reading (`FOOTPRINT_AREA_WRONG` → PLAN_LAYOUT_REJECTED). When it does, the resolver picks
another base reading, and every upper storey is re-derived from that reading's plans. The storey code never reads the
figure. What it decides is a function of the base reading it is given. A veto can therefore change which upper storey
is built, but only by changing the base reading, never by choosing a storey.

The holdout verdict gains `upperStoreysHoldTheirRooms`: Σ wall-ring area of levels with v2 index > 0 must be ≥ 0.9 × Σ
published non-ground, non-basement room areas. It is a *judge* of the emitted model, never an input of it, and nothing in
`packages/` or `apps/` imports `holdout/`.

## 7. Bounds

- **Targets:** every BUILT region below + 2. Fitted scales ≤ 2 per target, × 3×3 offsets.
- **Wall pairs:** up to 6 candidate walls per end per axis (4 outermost bands plus the envelope and largest-region
  sides). That is ≤ (6·6)² pairs per axis, crossed with the 2 % scale-agreement filter, so up to about 1.7 M crossing
  iterations in the worst case.
- **Same scale:** 6 × 6 offsets. **Rivals weighed:** ≤ 24.
- There is no continuous optimisation, no iteration to convergence and no hard cap on distinct candidates.
- Measured cost:
  - Council D: a 20×20 wall grid gave 5361 candidates and `alignPlans` took 0.2–0.3 s.
  - Development rows: see `performance.json`.

## 8. Stated assumptions and limits

- **Orientation.** Every storey's sheet has the ground plan's orientation. There is no rotation or mirror hypothesis
  (council D5L-9).
- **Labels.** A plan labelled ROOF would be read as a storey. This is latent: no adapter emits it (council D5L-12).
- **Wall style.** Outline-only or hatched walls give no bands, so the result is `NOT_REGISTERED` with a typed gap, a
  refusal (council D5L-13).
- **L-shaped storeys.** An L-shaped storey is emitted as its largest rectangle, and the rest is a named gap.
- **Parapets.** A parapet drawn collinear with a full wall merges into that wall's band.
- **Gable soffit.** The soffit is still taken from the storey rectangle (council B5L-8).
- **Statement spans.** `whole()` accepts equal spans without tick correspondence (council D5L-10).

## 9. Not in 005L

- The 005K drawn-gap rule stays OFF.
- Chain-order sensitivity of the decomposition grid (the 005K debt) is measured, not repaired.
- Untouched: A01's FILL_TOO_LARGE, REC-17/TOO_LARGE, the recessed-entrance relation and the A00/A04/A05
  plan-resolution families.
