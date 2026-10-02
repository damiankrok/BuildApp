# 005F post-implementation review C: envelope and body false positives

Reviewer C (finding IDs `C5F-n`). Read-only review of `packages/reconstruction/src/boundary-completion.ts`, the
completion wiring in `plan-decomposition.ts` (`boundaryExtension`, `decided`, `stableRegions`,
`OutlineOverride.completions/seeds`), `layout.ts` (`extentSidesOf`, `alignmentTargets` /
`envelope-without-attached`), `test/extent-envelope.test.ts` and `test/boundary-plan.ts`, at HEAD d910212. The
completion code did not change after 177dfca.

**Method.** I wrote a scratch harness in temporary `packages/reconstruction/test/zz-review-c-*.ts` files, now deleted. It
draws a synthetic plan in canonical coordinates using the `boundary-plan.ts` conventions (5 cm/px, 12 px walls,
`run()` with the extent sides live). It then renders the plan pixel-exactly under five transforms: `id`, mirror X
(`mx`), mirror Y (`my`), rotate 90° (`r90`) and rotate 270° (`r270`). The chain ticks are transformed with the drawing,
and each probe point reports built or not built. In canonical coordinates the part sits on the house's E side. Under
`mx` it moves to W, under `r90` to S and under `r270` to N. Copies of the harness and its raw outputs are in
`/home/user/work005f/post/scratch-c/` (`run1.txt`, `run2.txt`, `run3*.txt`; the `.ts` files there are copies only).
Development evidence is read from `/home/user/work005f/m-final/*` (e6fe6bc) and `m-c/*` (d910212, matrix partly
complete when this was written).

## Summary

| ID | Sev | One line |
|---|---|---|
| C5F-1 | **P0** | Glazing room evidence depends on orientation. The suite's own accepted bay is not built on the W and N sides, and on those sides a yard is built because of the house's own window. |
| C5F-2 | **P0** | A part is a wall-blind component of cells. A walled yard beside an attached room is built with it (16 m² instead of 10). |
| C5F-3 | P1 | The "chain measuring it" evidence has no ≥ 50 % coverage check and accepts any chain whose baseline crosses the part. A facade chain over a walled yard builds the yard in every orientation. |
| C5F-4 | P1 | The vehicle-door depth grows through walls (into any built cell in the band), not through the part and the cells it continues. A side gap 2.5 m wide in a 4 m garage end becomes a "vehicle door". |
| C5F-5 | P1 | A DASHED vehicle door is enough room evidence on its own. A carport with short piers, a dashed roof line and a house door is built as a 30 m² attached room in all orientations. |
| C5F-6 | P2 | Missing adversarial and orientation tests: the glazed walled yard that pre-review C asked for, and mirrored or rotated attached rooms. A parapet as thick as a wall with a glazed balustrade is the same drawing as a bay. |
| C5F-7 | P2 | `stableRegions` does not tell completion kinds apart: an ATTACHED_ROOM sharing a whole side would extend that body (B6 says own mass). I could not reach this in a fixture. |
| C5F-8 | P2 | Records go stale after a completion: BODIES `NOT_BUILT` for the built bay, `ENVELOPE outline NOT_ADOPTED`, and pack 11 `longBandBox` is the outline envelope. |
| C5F-9 | P2 | `extentSidesOf` STRONG (two lines) does not check that the chain ends agree within one wall (B1). |
| C5F-10 | P2 | An ATTACHED_ROOM's "house" includes in-box enclosed cells the reading did not build. Not reproduced. |

Counts: **P0 2, P1 3, P2 5.**

What holds (verified):
- The conflict on its own fills nothing. A pergola on posts with beams, an entrance canopy over steps with cheek walls,
  a terrace drawn in thin lines or with a 7 px parapet, a carport with two walls and a dashed roof line (no piers), and
  a balcony with an open rail are all `ZONE`. None is built in any of the five orientations. The `ZONE` comes from the
  outline: posts, beams, dashed lines and treads enclose nothing.
- The garage end with a DASHED door on its end wall (the suite's §19) is completed identically in all five
  orientations: 14.20 m², vehicle door, every one ACCEPTED.
- Mass stability on Morelach:
  - `mass-0` 253–609.5 × 208.5–739 is identical to 005E `base`.
  - `mass-1` grows 590 → 667 along its whole side.
  - The bay is its own `mass-2`.
  - Storeys are 2/2, and m-c (d910212) is identical.
- `envelope-without-attached` is sound in the probes (§ below).

## P0

### C5F-1: room evidence from glazing depends on which way up the plan is drawn

**Where:** `boundary-completion.ts:377-387`:
```ts
g.axis === 'X' ? g.linePx > rect.x0 + 0.5 * W && g.linePx <= rect.x1 + 0.5 * W && …
               : g.linePx > rect.y0 + 0.5 * W && g.linePx <= rect.y1 + 0.5 * W && …
```

**What is wrong.** The window is half-open and asymmetric. A gap on the part's high edge (x1 or y1) counts and a gap
on its low edge (x0 or y0) does not. The part's outer face and its junction with the house both lie on edge lines, so
the result depends on orientation:
- **Part on E or S.** The outer glazing counts. The house's window on the junction does not.
- **Part on W or N.** It is the reverse.

**Reproduction 1** (scratch `run1.txt`, the suite's own `bay({ junction: 'FACE_LINE', outer: 'GLAZED' })`, X
[40,360,400]):
- `id`, `my` and `r90` are ACCEPTED, 202 m².
- `mx` and `r270` are REJECTED with `NO_ROOM_EVIDENCE`, `glazing: 0`, 192 m².
- `bay DOOR/GLAZED` and `balcony piers-glass` show the same split.

A direct probe (`zz-review-c-6`) prints the outer glazing gap at `X@400` with part rect x0=360, x1=400 under `id`. Under
`mx` it is at `X@160` with x0=160 (excluded, because 160 ≤ 160 + 6).

**Reproduction 2** (false positive, `run3b.txt`). A walled yard: garden walls, a house door into it, a 2.4 m gate drawn
as one line on the wall's axis, and only the **house's** window (two lines in the house wall) looking into it. It has
no glazing of its own.
- `id`, `my` and `r90` are REJECTED with `NO_ROOM_EVIDENCE`.
- `mx` and `r270` are **ACCEPTED** as an ATTACHED_ROOM, 10 m², with `glazing: 1`.

So the yard is built when it lies W or N of the house.

**Impact.** Morelach's bay is on E and also carries `chains: 4`, so the development matrix cannot see this. Every
ATTACHED_ROOM acceptance test in `extent-envelope.test.ts` (§29 bays, the L-shaped wing) is on the E side. Only the §19
BOX_COMPLETION garage, which reads no glazing, is also drawn flipped.

**Smallest generic fix:**
- Count a STRONG GLAZING gap (no POST jamb) whose line lies within the part's span ± ½ W **symmetrically**, and which
  is not on (within one wall of) an edge the part shares with the house. In code: collect the junction edge lines in
  the `shared` loop and exclude gaps on them.
- Morelach keeps its evidence: its glazing at x 646 is 2.2 walls from the junction at 609.5.
- Add the five-transform variants of §29 to `extent-envelope.test.ts`.

### C5F-2: a part is a connected component of cells regardless of walls, so a walled yard rides in with the room beside it

**Where:**
- `boundary-completion.ts:204-224` (`components` steps to every neighbour, ignoring the edge between them).
- `:350` (`kept` = core cells plus cells within a wall of a core cell, with no connectivity test).
- Call sites `:520` and `:522`.

**What is wrong.** Two enclosed regions separated by a solid wall become one part. The two are then judged together:
- One perimeter, one way in, one piece of evidence.
- One area cap.
- One `ACCEPTED`.

The clip removes only wall slivers. The 005C post-review fixed exactly this in `adopt`, where `kept` propagates only
through open edges and openings ("a yard behind a solid wall does not ride in with the wing beside it"). The completion
path bypasses it.

**Reproduction** (`run3b.txt`, "bay + walled yard beside it"):
- The suite's glazed bay with a door junction (E, y 120–220).
- Against its solid south wall, a walled yard (y 220–280) with its own gate drawn as one line.
- The yard is enclosed and has no window.

Results:
- `id`, `my` and `r90`: **one** ATTACHED_ROOM, `a=16.00` (bay 10 + yard 6), ACCEPTED. Region `[360,120,400,280]`;
  both probes are built.
- `mx` and `r270`: neither is built (C5F-1).

Control (`zz-review-c-9`): the same yard without the bay (only the bay's south wall kept) is REJECTED with `NO_WAY_IN`,
`a=6.00`, in all five orientations. So the yard is built only because it rides in with the bay. This breaks the stage
rule that a yard is not closed into a room. The same code path serves BOX_COMPLETION. I did not get a separate BOX_COMPLETION
reproduction, because the incumbent builds every enclosed in-box forecourt I drew first.

**Smallest generic fix.** Inside `judge`, after the clip, keep only the cells reachable from the junction through
edges that are open or carry a bridged opening (the `adopt` propagation; BOX_COMPLETION seeds from the open junction).
Judge each remaining connected piece as its own part. The yard then fails `NO_WAY_IN`. Morelach's bay is reached
through its bridged junction (doorM 2.64), and its garage end through the 3.80 m open edge.

## P1

### C5F-3: "a chain measuring it" is any chain whose baseline crosses the part, with 2 ticks anywhere inside

**Where:** `boundary-completion.ts:388-392`, which tests `inside >= 2 && across`. Contract B3 asks for a chain with
≥ 2 ticks **covering ≥ 50 % of its free floor** along that axis. Coverage is not checked, and neither the chain's role
nor what it measures is checked.

**Reproduction** (`zz-review-c-8`, five transforms). A walled yard: house door, a 2.4 m gate drawn as one line, no
glazing anywhere.
- Without extra chains it is REJECTED (`NO_ROOM_EVIDENCE`) in all five orientations.
- Adding the facade's window chain (vertical, baseline x 380 inside the yard, ticks [40,150,165,280], so 0.75 m of the
  yard's 5 m) makes it ACCEPTED in **all five** orientations, with `chains: 1`.

With ticks [40,130,160,190,280] (60 % coverage) it is also accepted. So even the contract's rule admits a facade chain
drawn over a terrace or yard, which is where the first chain row of a plan usually runs.

**Development.** Morelach's `chains: 4` include `chain-horizontal-538` with ticks 606 and 615 only: a wall thickness,
span 0.15 of the bay. Morelach still passes on glazing alone.

**Smallest generic fix:**
- Implement the coverage rule: the span between the first and last inside tick is ≥ 0.5 of the part's free-floor
  extent on that axis.
- Count only chains whose extent role is not EXTERIOR. An exterior chain's baseline lies outside the walls by
  definition, so one crossing a part is drawn over ground.

### C5F-4: vehicle-door depth is measured through walls

**Where:** `boundary-completion.ts:403-427` (`houseDepth`). The loop grows `reach` through every `house(k)` cell that
overlaps the part's extent across the door and touches the current reach. It never checks the edge between them. B4
says "depth behind it, through the part and the built cells it **continues**".

**Reproduction** (`zz-review-c-4`, a direct `completeBoundary` call on a hand-built 3×3 grid at 5 cm/px):
- A garage 4 m wide. Its end (y 200–260) is the BOX_COMPLETION part, open to the built garage cell.
- A WEAK DASHED 2.5 m gap with WALL/WALL jambs sits in the end's **west side** wall.
- The house lies behind the garage's **solid** east wall.

Results:
- House cells beside the end built: depth = 15 m, `vehicleDoors=1`, policies agree, **ACCEPTED**.
- The same cells unbuilt: depth = 4 m, `vehicleDoors=0`, `QUESTION / POLICIES_DISAGREE`.

The vehicle has 4 m in both cases.

**Orientation is fine.** The fixpoint is symmetric. The §19 garage with its door on the end wall gives the same answer
in all five transforms (`run2.txt`, 14.20 m² ACCEPTED). The end-wall case is also right whenever the garage itself is
deep enough, as it is on Morelach (garage 263 → 667, about 8 m).

**Smallest generic fix.** Grow `reach` only across edges that are open in the outline (`!edge.closed`), starting from
the part and staying in the door's perpendicular band. That is a BFS over `house` cells through open edges, not
positional adjacency.

### C5F-5: a DASHED "vehicle door" alone makes a carport an attached room

**Where:**
- `boundary-completion.ts:394-396` (the vehicle filter admits DASHED; the contract's B4 list includes it).
- `:463` (`vehicleDoors.length > 0` is sufficient room evidence for an ATTACHED_ROOM).

**Reproduction** (`run1.txt`, "carport piers dashed 2.3m"):
- A carport east of the house, 6 m deep. N and S walls, front piers of 15 px each (each under 1.5 m, so not long
  bands), a 2.3 m mouth with a dashed roof line, and a door from the house.
- It is **ACCEPTED in all five orientations**, `a=30.00`, `vehicleDoors: 1`, weak gap
  `["DASHED","2.30","WALL/WALL",true]`, with the conflict ACCEPTED.

Variants:
- Without piers (two walls only): `ZONE`, not built.
- Without the house door: `NO_WAY_IN`.

So a small drawing change (piers about 0.75 m long) defeats the enclosure guard, and from then on DASHED is
indistinguishable from Morelach's garage door, which is also DASHED (`weakGaps` in Morelach's BOX_COMPLETION).

**Smallest generic fix.** For an **ATTACHED_ROOM**, do not let a DASHED vehicle door be the only room evidence: a
dashed line across a mouth is just as much a roof edge. Require LEAF_FACE or LEAF_AXIS, or a second kind of evidence
(glazing, or a chain per C5F-3). Keep DASHED for BOX_COMPLETION, where continuing a built room is the evidence.
Morelach is unaffected: its bay is glazed and its garage end is a BOX_COMPLETION.

## P2

**C5F-6: missing adversarial and orientation tests, and the inherent ambiguity.** Pre-review C (`envelope-extent-review.md`
§6) asked to "keep [a glazed walled yard with a door from the house] as an adversarial test". It is not in
`extent-envelope.test.ts`, whose yard has a BLANK gate. Two drawings are pixel-identical to the suite's accepted
`bay DOOR/GLAZED` and are ACCEPTED on E/S:
- a yard with a window-like gate (two lines in the wall thickness);
- a terrace whose parapet is as thick as a wall (12 px), with a glazed balustrade between stubs.

The only guard is parapet thickness. At 9 px it is `NOT_WALLED`, and at 7 px it is not enclosed (`ZONE`). No generic
rule can separate these from a bay without room semantics. Two actions follow:
- Record them as known ambiguity.
- Add the adversarial cases (expected: QUESTION or documented) and the mirrored and rotated cases.

**C5F-7: `stableRegions` ignores the completion's kind.** `plan-decomposition.ts:2040-2057` extends any base region by
any rectangular completion that shares one whole side with exactly one seed. B6 says an ATTACHED_ROOM "becomes its own
mass". Extending would also suppress `envelope-without-attached` (`layout.ts:504`, `house.length < built.length`).

I could not reach this. An attached room flush with a whole side has walls collinear with that body's walls, and the box
or bay logic built it before the completion ran (scratch `zz-review-c-7`, 1.4 m and 2 m bays: "the box stands"). The
fix is to pass the kind with `completions` and extend only for BOX_COMPLETION.

**C5F-8: records go stale after a completion.** On Morelach (m-final pack, timeline):
- `e00435 body:…:0:FLUSH_ATTACHED NOT_BUILT 4.2 m²` reports the bay as not built. `classifyBodies` runs at `:2846`,
  before `completeBoundary` (`:2868`), and its `built` flags are never refreshed.
- `e00431 outline … NOT_ADOPTED` is emitted while "the plan is cut on the outline". `pack.ts:501` keys it on
  `boundary.accepted` (005C adoption only).
- `11-envelope-candidates.json` `longBandBox` is the outline envelope (61–670), not the box (61–609.5).

Fix: refresh `bodies[].built` from the final cells, and emit `COMPLETED` when `completions` were accepted.

**C5F-9: `extentSidesOf` (`layout.ts:406`).** For STRONG it is enough that two chains each end within one wall of the
side with baselines more than a wall apart. B1 also requires "ends agree within one wall", so this admits two chains up
to two walls apart. Fix: check `max(end) − min(end) ≤ wallPx` over the stating chains.

**C5F-10: an ATTACHED_ROOM's house includes unbuilt cells.** At `boundary-completion.ts:520` the predicate
`house = builtA || accepted || (inA && outline.inside)` lets the junction be an in-box enclosed area the box reading
did *not* build. That area may itself be rejected as a BOX_COMPLETION, so a part could attach to nothing that is built.
Read only, not reproduced. Fix: `builtA || accepted`.

**Not verified:** with any completion, `decided` (`plan-decomposition.ts:1619`) shuts every edge of `final`, not only
the edges the outline closed. When 005C also adopted something (`anyAccepted`), cells of the 005C reading may then be
kept that the plain 005C re-cut would have lost. I did not build a fixture.

## `envelope-without-attached` (layout.ts:498-512)

A mock probe (`zz-review-c-5`) used a base house of 200×150 px with an accepted attached bay of 40 or 20 px, two
upper plans, and stated or fitted scale:

| Upper plan | Result |
|---|---|
| Covers the bay | `envelope` wins at identity, agreement 1.0, score 1.18 (stated) or 1.15 (fitted). The new target appears only as a lower, scaled candidate (k 0.955, score 0.91). |
| House only | Identity wins: `envelope` flush-min (stated), or `envelope-without-attached` (fitted, where `envelope` alone would stretch k = 1.05). |

So it does not register a covering storey onto the wrong body in these cases. It is redundant with the house region
target when masses are stable, and adds information only when the house has several bodies.

Caveat: the `house` filter uses the clipped completion rect ± `wallPx`, so a house region lying within a wall of the
bay rect is dropped from the target. With C5F-2 unfixed, the yard that rides in is also excluded from the target,
which hides the mistake from storey registration rather than exposing it.

## Development evidence (m-final at e6fe6bc; m-c at d910212 where present)

**m-c (d910212).** `m-c.alldone` was not yet written when I finished, and 15 houses had run: alt-marcowki, azaliach,
dabecjach, jablonkach, modrzewnicy, modrzykach, morelach, zurawkach, eoze-legacy-every, kosacce-clean, kosacce-tracked,
marcowki, rarytasy-eoze, rarytasy-g2e and willa-miranda. Each digest's completions, extent conflicts and masses are
**identical** to m-final. Modrzykach also keeps model hash 86ed8afd. The SUPPORTED 0.4 → 0.35 revert moves nothing on
the envelope side.

**ACCEPTED completions.** Only Morelach has any, two of them, and both are right:
- **ATTACHED_ROOM**, 609.5–670 × 415–590, 3.46 m²:
  - It is the kitchen bay with the counter and the 180/140 window. Its walls are inside the rect, and it was clipped
    from 323–716.
  - Glazing 1, returns 3, way in 2.64 m (the counter line read as LEAF_FACE, debt C P1-1), wall 0.75.
- **BOX_COMPLETION**, 61–253 × 590–667, 5.93 m², garage end: open 3.80 m, DASHED door 2.38 m WALL/WALL.
  - It stops at the door line, y 667, not at the wall's outer face (about 680). That is a slight under-reach, not a
    false positive.

I checked both by eye against the local masses and source overlays. No image was copied anywhere.

**Every other completion is REJECTED**, mostly as `WALL_SLIVER`:
- `SEPARATE`: dabecjach, azaliach, zurawkach, willa.
- `NO_CONTINUATION`: marcowki upper, rarytasy-g2e.
- `NO_STRONG_EXTENT`: alt-marcowki, rarytasy.
- `NO_WAY_IN`: dabecjach S.

**Conflicts:**
- willa N INCONCLUSIVE and S ZONE.
- dabecjach W/S INCONCLUSIVE and N ZONE (the pergola).
- modrzykach S INCONCLUSIVE.
- zurawkach S INCONCLUSIVE.
- rarytasy-g2e S ZONE.
- jablonkach N SUPPORTED, `RECORDED`. It is not raised as STRONG; the terrace is safe.

Every STRONG side here rests on two chains, except dabecjach N and willa UPPER S (one closing read chain).

**Known boundary regressions** (005E matrix → 005F `development-matrix.json`):
- **willa-miranda.** −5.07 %, storeys 1/2, bodies 4: identical, same model hash 1ce47cfb.
- **dom-w-zurawkach.** −0.81 %, storeys 1/3: identical, same hash 31ba5eea.
- **dom-w-azaliach.** Still FAILED, unchanged.
- **dom-w-morelach.** −11.54 % → **−3.12 % PASS**, storeys 2/2, bodies 2 → 3.
- **dom-w-modrzykach.** −0.54 % → +0.16 %, still PASS, new hash 86ed8afd. Not envelope:
  - Its completions are all `WALL_SLIVER`, and its decomposition `masses`, `linesX` and `linesY` are identical to 005E.
  - The model's `ring-attached-1-0` is 7.25 × 1.48 m in 005E and 7.27 × 1.66 m now ("from the plan's printed
    chains"), with registration anchors 10 → 12.
  - That is an OCR or chain-value change. I am passing it to reviewers A and B and did not verify further.

## Scratch hygiene

The temporary `packages/reconstruction/test/zz-review-c-*.ts` files (nine tests and one helper) are deleted, and
`git -C /home/user/BuildApp status --short` is empty. Copies of the harness and its outputs are kept outside the repo in
`/home/user/work005f/post/scratch-c/`.
