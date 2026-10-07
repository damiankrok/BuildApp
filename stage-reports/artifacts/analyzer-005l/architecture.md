# BUILDPLAN-ANALYZER-005L — storey registration and per-storey footprint stacking: architecture

Code: `packages/reconstruction/src/layout.ts` (registration, support relation, per-storey footprints),
`packages/reconstruction/src/v2/{building,reconstruct-v2,emit}.ts` (per-storey rectangles in the emitted model).
The layout set schema is unchanged; the support relation lives in the draft (`StructuralLayoutDraft.storeyRegistrations`)
and in the footprint regions it creates.

## 1. Two questions, kept apart

| Question | Answered by | Never answered by |
|---|---|---|
| **Where does the other storey's plan sit on the plan below?** (scale, offset) | `alignPlans` — wall-on-wall correspondence, bounded hypotheses | the storey count, the published areas, which answer removes a refusal |
| **Which body below carries each of its walled regions, and over what rectangle?** | `storeySupportOf` — every walled body of that plan, placed, against every mass | the plan's envelope; a 50 % coverage share; "every mass gets every storey" |

Before 005L the two were one test: the upper plan's *envelope* was placed and a mass reached the storey if that
rectangle covered ≥ 50 % of it. Every first bad decision in `baseline-storey-registration.json` is one of the ways that
conflation fails (the envelope taking in a roof outline or an eave line; no candidate at the scale the envelope implies;
an inset storey over a large body covering less than half of it; the emitter then copying the ground ring upstairs).

## 2. Registration (`alignPlans`)

A discrete, bounded search. Every hypothesis is a named statement about the two drawings; none is a free parameter.

1. **Fitted** (pre-005L): the plan's envelope scaled to one alignment target (each base mass, the envelope, the
   envelope without attached rooms), at the scale both plans' registrations state and/or the one fitting that target,
   with 3×3 face/centre offsets.
2. **Stated** (005L narrowed): offsets where the plans' own chains put the storey — only on an axis where *both*
   chains measure the whole building (|span(other) − span(base)| ≤ max(wall, 1 %)). A placement is `stated` only when
   its scale AND both offsets come from the chains.
3. **Facade wall pairs** (005L): the few outermost facade-length walls at each end of each axis (bands ≥ 25 % of the
   longest; the decomposition's envelope and largest-region sides added); a pair along x and a pair along z fix one
   scale each; kept where they agree within 2 % and lie in [1/3, 3]. Bounded: ≤ 4 walls per end per axis.
4. **The plan below's own scale** (005L): k = 1, the 6 offsets per axis that land the most wall (cheap axis match),
   crossed.

**Score** = `shares` + 0.15 · coverage + 0.03 · stated.
`shares` = 2·(long wall landed on long wall) / (placed long wall of this plan + long wall below): Dice over the major
walls, symmetric so that neither shrinking (precision rises) nor stretching (recall rises) can choose a scale.
Matching is exclusive (a base wall stretch counts once) and nearest-band. `agreement` (precision) is reported only.
Coverage uses the rectangle the hypothesis claims (the four paired walls for a wall-pair placement), not the envelope.

**Order**: a total order on the placement's own numbers (score, target, scale, offsets, stated, why) — enumeration
order cannot pick a leader. Duplicates (same scale/offset within tolerance) collapse.

**Stated placements hold** unless refuted twice over: they stand when they share ≥ 0.5× the best fit's wall, or when
the plan's largest walled body lies inside the building below (an inset-all-round storey shares no wall and is still
right).

## 3. Support (`storeySupportOf`)

Inputs: the other plan's walled bodies (`planBodies(decomposition)`, the same body test the base uses: perimeter wall
fraction ≥ 0.35 and narrow side ≥ two walls and a room), one placement, the base masses.

For each region, placed into the building frame:

* **NOT_A_BODY** — too little wall or too narrow; carries no storey (line work, strips, piers).
* For each mass: overlap `ox × oz`. **SUPPORTS** when ox ≥ `minSpanM` AND oz ≥ `minSpanM` (a room's span on both
  axes); otherwise **INCIDENTAL** (a wall's thickness, registration jitter, an eave) and carries nothing.
* The supported piece = region ∩ mass, each side within `bandM` = tol + the other plan's wall (placed) snapped to
  the mass's side (regions are cut on inner lines/axes; masses are measured to outer faces).
* Pieces over one mass that tile a rectangle merge; pieces that do not stay separate (extra ATTACHED masses
  `${mass}-s${storey}-${k}` in v2).
* **Overhang**: `NONE` / `WITHIN_TOLERANCE` (unsupported ≤ (w + d)·bandM) / `BEYOND_TOLERANCE` (named unresolved
  overhang; the supported part is built, nothing invented to carry the rest) / `UNSUPPORTED` (stands on nothing).

Each relation records intersection m², `upperSupportedShare`, `lowerCoveredShare`, overlaps, wall agreement, status and
a sentence. `lowerCoveredShare` is a diagnostic only; nothing thresholds it (mutation M1 restores the old rule and is
killed).

## 4. The storey decision (per non-base plan)

`StoreyRegistration.decision`:

* `NOT_REGISTERED` — no placement.
* `STACKED` — the chosen placement's support is applied: per-mass footprint regions `footprint-${storey}-${mass}`
  (and `-k`), storey spans extended only for supported masses.
* `AMBIGUOUS` — a rival placement within 1e-6 of the score stands the storey on different bodies (or on the same
  bodies with footprint IoU < 0.7) and is not out-stated: nothing stacked, a `STOREY_COVERAGE_DISAGREES` conflict and
  an AMBIGUOUS unresolved. Rivals: placements within 0.1 of the best, ≤ 24 weighed. A near tie (< 0.1) stacks the
  better and reports the conflict.
* `NO_SUPPORT` — no region supports any mass; or, for a storey **below** the base, a body or its walls reach past every
  base mass (`wallsBeyond`): the base plan does not hold the whole building and the storey is not stacked under part
  of it (restores the PLAN_NO_MASSES refusal for an upper plan read as base).

Roles (`assignRoles`) are unchanged and read the storey spans: a mass no storey reaches stays one storey (garage
safety; mutations M2 and M7 are killed).

## 5. Emission (v2)

`MassV2.storeyRects` (from the footprint regions) and `rectAt(mass, storey)` — the body rectangle where a storey has
none. Rings, openings hosts, returns, interior rooms, shared doors and the plan frame covers use `rectAt`; slabs stay the
body (the storey below's ceiling). Copying the ground ring upstairs (mutation M6) is killed by the end-to-end fixture.

## 6. Non-circularity

The layout options carry no published figure (architecture gate). The registration and support code names no
published value, storey count, expected value, verdict or house; its literals are frozen; executed decoys
(published footprint ×1.25 or absent; a room list claiming a third storey) give byte-identical decisions and rings
(`tests/architecture/storey-support.test.ts`).

The holdout verdict gains `upperStoreysHoldTheirRooms` (Σ upper-level wall-ring area ≥ 0.9 × Σ published non-ground
room areas) — a *judge* of the emitted model, never an input of it.

## 7. Bounds

Targets ≤ masses + 2; fitted scales ≤ 2 per target × ≤ 4×4 offsets; wall pairs ≤ (4·4)² per axis, crossed with the
scale-agreement filter; same-scale ≤ 6 × 6; rivals ≤ 24. No continuous optimisation, no iteration to convergence.

## 8. Not in 005L

The 005K drawn-gap rule stays OFF. Chain-order sensitivity of the decomposition grid (the 005K debt) is measured, not
repaired. A01's FILL_TOO_LARGE, REC-17/TOO_LARGE, the recessed-entrance relation and the A00/A04/A05 plan-resolution
families are untouched.
