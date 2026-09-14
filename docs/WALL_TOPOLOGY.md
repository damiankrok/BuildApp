# Wall topology: rings and junctions

STAGE BUILDAPP-00A. Implemented in `packages/model/src/topology.ts`
(resolution and validation), `packages/commands` (`createWallRing`,
`createWallJunction`, inline junctions on `createWall`) and
`packages/geometry/src/wall-compiler.ts` (per-face end cuts). Independent
check: `ringClosureReport` in `packages/verification`.

## The invariant

**Callers state intended topology; the model resolves physical wall
ownership.**

A wall's `start` and `end` are its outer-face line in natural footprint
coordinates. A caller that knows a rectangle `(0,0) (10,0) (10,8) (0,8)` states
exactly those four points. It never moves a side wall to `z = 0.3` to keep it
out of the front wall's corner. Instead it states how the walls meet —
`CORNER`, `BUTT`, `T` — and the model derives where each wall's material
physically stops, so that every corner block exists exactly once, with no gap
and no overlapping volume.

## Records (schema 1.1.0)

```ts
type WallEndRef = { wallId: string; end: 'START' | 'END' }

type WallJunction =
  | { id, kind: 'CORNER', a: WallEndRef, b: WallEndRef, owner: string, tolerance: number }
  | { id, kind: 'BUTT',   wall: WallEndRef, againstWallId: string, tolerance: number }
  | { id, kind: 'T',      wall: WallEndRef, againstWallId: string, tolerance: number }

type WallRing = { id, levelId, wallIds: string[], junctionIds: string[] }
```

Both are ordinary semantic objects (`model.wallJunctions`, `model.wallRings`)
with ids, names, evidence and tags; they survive save/load byte for byte.
`tolerance` (default 1 mm) bounds how far a stated endpoint may miss the other
wall's thickness band.

A `WallRing` is a *grouping*: `wallIds` in traversal order and, at each vertex
`i`, `junctionIds[i]`, the CORNER joining wall `i−1`'s END to wall `i`'s START.
The ring's polygon is its walls' start points (`ringPolygon`). The walls stay
ordinary walls — thickness, height, openings, material, top profile are all
edited on the wall.

## Resolution: from junctions to end cuts

Every wall end gets an `EndCut { outer, inner }`: the `a`-parameter (distance
along the wall from `start`) at which the wall's material stops, on its outer
face (`c = 0`) and on its inner face (`c = thickness`). A wall without
junctions has the nominal cuts `0` and `L`. Equal values give the usual end
face perpendicular to the wall; different values give an end cut lying in
another wall's face plane, which is what closes oblique corners exactly.

All of it is line arithmetic in the plan. A wall has an outer line and a
parallel inner line; the *cut of wall A against a face of wall B* is where A's
outer and inner lines cross that face line.

For an end of wall A against wall B: B's **near face** is the face of B first
reached from A's body, its **far face** the other one. A's body lies on B's
inner side when moving from A's endpoint into A's body goes inward relative to
B; otherwise on its outer side.

### CORNER

Participants: the ends `a` and `b` of two walls; `owner` is one of them.

- The **owner** cut lies in the other wall's *far* face plane: the owner
  covers the whole corner block.
- The **other** wall's cut lies in the owner's *near* face plane: it stops
  where the owner's material begins.

Convex corner (front `(0,0)→(10,0)` T = 0.3, right `(10,0)→(10,8)` T = 0.25,
owner front):

```
        z            right wall material x ∈ [9.75, 10], z ≥ 0.3
        ^            ┌──────┐
  0.3   |  front ····│░░░░░░│   ← right starts at z = 0.3 (front's inner face)
        |  ░░░░░░░░░░│██████│   ← corner block 0.25 × 0.3: front's, once
   0    +────────────┴──────┴──> x
                    9.75    10
```

front: end cut `{ outer: 10, inner: 10 }`; right: start cut `{ 0.3, 0.3 }`.
With `owner: right` instead: front ends at `9.75`, right starts at `0`.

Reflex corner (an L: `a (10,4)→(6,4)`, `b (6,4)→(6,8)`, owner a): the outer
faces meet at `(6,4)` but the inner faces leave a notch `[5.7,6]×[3.7,4]`
that belongs to neither nominal strip. The owner's cut against b's far face
(b's *inner* face, `x = 5.7`) extends a by 0.3 m into the notch; b is
untouched. Same rule, no special case.

Oblique corner (60°, 120°, a hexagon): the owner's outer face ends at the
outer corner, its inner face where the inner lines cross; the other wall's
outer and inner faces end where they meet the owner's near face. The end
faces are planar quads in those face planes; the ring's volume equals the
exact ring area × height (tested on a regular hexagon to 1e-9).

### BUTT

`wall` (one end) terminates against `againstWallId`. The host is **not
modified** and owns the contact material; the terminating wall's cut lies in
the host's near face plane. The contact span (the terminating wall's full
thickness projected on that face) must lie within the host's *physical* face
extent — i.e. after the host's own junctions — otherwise `BUTT_OFF_HOST`
with the measured overhang. A contact at the host's very end is fine.

### T

A BUTT whose contact lies **strictly inside** the host's physical length on
that face (host continues on both sides, by more than `tolerance`); otherwise
`T_JUNCTION_POSITION` with the measured distance. The interior partition of
the demo T-junctions into the inner faces of the front and rear walls; the
garage rear wall T-junctions from outside into the outer face of the main
body's right wall.

### Where the endpoint may be

An endpoint may sit anywhere within the other wall's thickness band, on its
outer line (the natural footprint statement) or on its inner face (the
BUILDAPP-00 hand-trimmed statement) or between, and always resolves to the
same physical cut. Beyond the band on the arriving side: `JUNCTION_GAP`
(measured). Past the far face: `JUNCTION_OVERSHOOT` (measured). Nothing is
moved.

### Thickness differences and wall kinds

Thickness enters only through the face lines, so a thin partition against a
thick wall, a thick owner against a thin other wall, or four different
thicknesses around one ring all resolve exactly (tested: 0.5 / 0.25 / 0.3 /
0.4 ring, volume = outer area − inner area). An INTERIOR wall owning a corner
with an EXTERIOR wall, or an EXTERIOR wall terminating against an INTERIOR
host, is allowed and reported as the warning `JUNCTION_KIND_MIX` (the
exterior skin will show an interior wall's end).

## Validation (model level, named codes)

| code | when |
| --- | --- |
| `UNKNOWN_WALL`, `UNKNOWN_JUNCTION` | a junction or ring refers to something that does not exist |
| `JUNCTION_SELF_REFERENCE` | a wall joined to itself |
| `JUNCTION_OWNER_NOT_PARTICIPANT` | corner `owner` is neither `a` nor `b` |
| `JUNCTION_LEVEL_MISMATCH` | participants on different levels |
| `JUNCTION_PARALLEL_WALLS` | the walls' lines do not cross |
| `JUNCTION_GAP` / `JUNCTION_OVERSHOOT` | endpoint short of / past the other wall's band (`measured`) |
| `ENDPOINT_JUNCTION_CONFLICT` | one wall end claimed by two junctions |
| `BUTT_OFF_HOST` / `T_JUNCTION_POSITION` | contact outside the host's physical face / not strictly inside it |
| `WALL_CONSUMED` | junctions leave a wall no material |
| `OPENING_IN_JUNCTION_ZONE` | an opening reaches into a cut-away end (`measured`); the opening is not shrunk |
| `WALLS_OVERLAP` | two walls with a common height range share > 1e-6 m² of physical plan area (`measured`) and no junction justifies it |
| `RING_DEGENERATE` / `RING_NOT_CLOSED` / `RING_LEVEL_MISMATCH` | fewer than three members, a wall listed twice, a non-simple polygon / a vertex junction that is not the CORNER of consecutive walls or is unresolved / a member on another level |
| `JUNCTION_KIND_MIX` | warning, interior/exterior mix as above |

Resolution happens in `semanticIssues`, so every command that would break a
junction is refused with these codes and the model is unchanged. Two
consequences worth knowing:

- Moving or lengthening one ring wall on its own is refused (`JUNCTION_GAP` /
  `JUNCTION_OVERSHOOT`): its corners would no longer meet. Change thickness,
  height, openings or the corner `owner` freely; they re-resolve.
- Removing a corner junction alone is refused (`WALLS_OVERLAP`): the two walls
  would fall back to their nominal, overlapping extents. Remove or move a wall
  instead; removing a wall cascades to its junctions and its ring record.

## Commands

```ts
{ type: 'createWallRing', id: 'ring-ground', levelId: 'ground',
  polygon: [{x:0,z:0},{x:10,z:0},{x:10,z:8},{x:0,z:8}], thickness: 0.3, height: 3,
  walls: [{ id: 'g-front', name: 'Front wall' }, { id: 'g-right' }, { id: 'g-rear' }, { id: 'g-left', height: 6 }],
  cornerOwnership: 'ALTERNATE' }   // ALTERNATE (default) | PRECEDING | FOLLOWING
```

creates walls `<ring>-w<i>` (or the override ids), corners `<ring>-j<i>` and
the ring — deterministic ids from a stable ring id. A clockwise polygon is
traversed the other way round (material must lie inside); per-edge overrides
follow their edges. `ALTERNATE` gives even-numbered edges their corners (front
and rear on a rectangle).

```ts
{ type: 'createWall', id: 'g-partition', levelId: 'ground', start: {x:6,z:8}, end: {x:6,z:0}, thickness: 0.12, height: 2.75, kind: 'INTERIOR',
  startJunction: { kind: 'T', againstWallId: 'g-rear' },
  endJunction:   { kind: 'T', againstWallId: 'g-front' } }
{ type: 'createWall', id: 'gar-rear', ..., startJunction: { kind: 'CORNER', with: { wallId: 'gar-right', end: 'END' }, owner: 'SELF' } }
```

A wall stated from footprint line to footprint line overlaps its neighbours
until its junctions exist, and every command must leave the model valid, so
the junctions are stated inline (`<wall>-j-start` / `<wall>-j-end`).
`createWallJunction` is the standalone form for walls that are already
consistent (pre-trimmed, or in contact) and for tests.

## Geometry compiler

`compileWall` takes the resolved `extent`. The **core** `[max(start cuts),
min(end cuts)]` is tiled exactly as before (openings live only there —
validation guarantees it); each **end zone** where one face continues alone
adds a face strip, a bottom and a top triangle and the skewed end face, all
on the same grid so the solid stays watertight (manifold oracle: 0 boundary,
0 duplicate edges on every ring tested). Roof-following tops evaluate the roof
underside at the actual face points, so a corner block owned by an eave wall
dies into the soffit like the rest of that wall. Each wall's triangles carry
that wall's `objectId`: identity survives; nothing is unioned.

## Storey ring closure oracle

`ringClosureReport(polygon, solids, { heights, step, endInset, tolerance, minThickness })`
in `packages/verification` takes the declared outer footprint and the compiled
wall solids and nothing else. It walks every edge and fires rays from 1 cm
outside the outer line inward at each probe height (through each solid
separately, runs unioned): material must begin at the outer line within
`tolerance` (1 mm) and run at least `minThickness`. At every vertex two rays
parallel to the interior bisector, nudged 20 mm along each edge, must find the
corner block filled. Contiguous failing probes are reported as measured gaps
(`edge, from, to, length, worstStart`); per-vertex probes as `corners`;
pairwise `overlapEstimate` of the solids as `overlaps`; edges with material
only outside the envelope as `outsideOnly` (a reversed wall). Tested against a
missing wall, a shifted endpoint, an empty corner, a reversed wall, a
duplicated wall, an L-shaped ring and a clockwise envelope.

## Schema evolution

See `CANONICAL_BUILDING_MODEL.md` — 1.0.0 files migrate explicitly to 1.1.0
with empty topology collections and keep their hand-trimmed extents; the
BUILDAPP-00 demo file is a test fixture and compiles to the same solids as the
new topology demo (bounds and volumes to 1e-9, identical triangle count).

## Limitations

- Junction resolution is per wall end and per pair. Three walls meeting at
  one point are expressed as one CORNER plus one BUTT/T (each end belongs to
  one junction).
- Junction endpoints must be within `tolerance` of the other wall's band;
  moving a ring wall means moving its neighbours in the same command list is
  not possible yet (each command is validated alone), so plan edits are done
  by removing and re-creating, or through a future topology-aware move.
- Corner ownership is per corner; there is no mitre (`owner` is always one
  wall). Oblique corners are exact with owner-through cuts.
- Overlap detection uses each wall's nominal height range; walls that overlap
  in plan but not in height are fine (stacked storeys).
