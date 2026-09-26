# Geometry compiler

`compileBuilding(model): CompiledScene` in `packages/geometry`. The only path
from semantics to triangles. Pure: no React, no Three.js, no DOM; the same
model always gives the same scene (an architecture test checks the store's
scene is `compileBuilding(model)` exactly).

## Output

```ts
type CompiledMesh = {
  objectId: string        // semantic owner — what a picked mesh resolves to
  objectKind: SemanticKind
  part: GeometryPart      // WALL, WALL_REVEAL, WINDOW_FRAME, WINDOW_GLASS, WINDOW_MULLION, DOOR_FRAME,
                          // DOOR_LEAF, DOOR_HANDLE, SLAB, ROOF, ROOF_REVEAL, ROOFLIGHT_FRAME, ROOFLIGHT_GLASS,
                          // BALCONY, RAILING_POST, RAILING_RAIL, RAILING_INFILL, CHIMNEY, ROOM_FLOOR,
                          // STAIR_PLACEHOLDER
  levelId?: string        // for storey isolation
  solidId: string         // the closed solid these triangles belong to
  hostWallId?: string     // reveals and fills: the wall that hosts the opening
  hostRoofId?: string     // roof reveals and rooflight units: the roof that hosts the roof opening
  openingId?: string      // the wall opening or roof opening
  structural: boolean     // takes part in duplicate-volume checks
  materialId?: string
  triangles: { a, b, c }[]
}
type CompiledScene = { modelId, meshes, diagnostics, bounds, stats }
```

Triangles are in the model frame and wound so that `(b − a) × (c − a)` points
out of the material. Every face is emitted through `quadOut` / `triOut`,
which take the corners plus the direction the face should point and choose
the winding — the caller states a geometric fact rather than counting
corners. An invalid model is not compiled (`MODEL_INVALID` diagnostics, no
meshes).

## Walls (`wall-compiler.ts`)

Adapted from the reference repository's wall-local compiler, with the
Marcówki, gold-file and junction coupling removed and the door and multi-
opening cases generalised.

- **Wall-local frame.** `a` along the wall, `b` up, `c` inward from the outer
  face. Openings are stated in this frame. Nothing reads another wall, a
  bounding box or a facade: a recessed wall compiles like a flush one
  (tested by rotating and translating a wall and measuring the hole).
- **Physical extent.** `compileBuilding` resolves the model's junctions
  (`resolveWallTopology`, in the model package) and hands each wall its
  `WallExtent`: an `EndCut { outer, inner }` per end, the `a` values where the
  material stops on the outer and on the inner face. The *core*
  `[max(start), min(end)]` is tiled as below and is the only place openings
  may be; where one face continues past the other (a cut lying in another
  wall's face plane, i.e. an oblique corner or a reflex-corner extension) an
  *end zone* adds one face strip, a bottom and a top triangle and the skewed
  end face on the same grid. Equal cuts give the plain perpendicular end
  face. A wall consumed by its junctions is `WALL_CONSUMED` and not compiled
  (validation refuses it first). See `docs/WALL_TOPOLOGY.md`.
- **One grid, watertight by construction.** Breaks along `a`: the ends, every
  opening edge, every point where the top changes slope, every crossing of
  the top with a height break. Breaks along `b`: the base and every sill and
  head (snapped to canonical values so `0.8 + 1` and `1.2 + 0.6` are one
  height). Outer and inner faces are tiled cell by cell, skipping cells inside
  holes and clipping cells to the top; bottom, top ribbon and sill/head
  reveals per strip; jambs split on the height breaks; the two end faces
  triangulated between the outer and inner edge chains using grid vertices
  only. Shared edges compute identical doubles, so the manifold oracle
  compares vertices exactly.
- **Top function `top(u, c)`.** FLAT: constant. POLYLINE: piecewise linear in
  `u`. FOLLOW_ROOF: `min(height, roofUnderside(x, z) − baseY)` evaluated at
  the actual face point, so an eave wall stops lower on its outer face than
  on its inner face and the eave wedge closes (the reference's PLANE top,
  derived here from the roof). A gable end wall under a gable roof rises to
  the ridge underside. Break points come from the roof's crease line and
  covered rectangle, plus every point on either face where the soffit
  crosses the wall's nominal height (a capped partition that follows the
  roof only where the roof is lower kinks there, and the kink is a grid
  line).
- **Openings.** Real through-cuts. A sill at the base (door) leaves the bottom
  open across the doorway and the solid still closes. Openings whose head
  would reach above the top are refused by name (`OPENING_ABOVE_WALL_TOP`)
  rather than clipped; a wall whose top falls below its base is not compiled
  (`WALL_TOP_BELOW_BASE`).
- **Raked heads.** An opening with `head: RAKED` has a head line rising
  linearly from `sill + height` at its near jamb to `sill + heightFar` at
  the far jamb. Both heads are `b` breaks; the crossings of the head line
  with every `b` break (and with the top) are `a` breaks, so the head line
  runs along grid diagonals: cells wholly above the line are solid, cells
  wholly below are the hole, a cell the line crosses is one quad from the
  line up to the cell's top. The head reveal is the sloped quad along the
  line; jambs stop at the head height of their own edge. The trapezoid the
  wall loses is exactly `(height + heightFar) / 2 · width · thickness`
  (measured in the generic tests, on a wall that is not the reference).
- **Multi-leaf openings.** `openingLeaves(opening)` turns one semantic
  opening into one cut per wall (the host first, then each leaf at its own
  offset). Every leaf wall tiles its own hole with its own reveals
  (`objectId = opening`, `solidId = that leaf`, `hostWallId = that leaf`);
  the fill is emitted once, in the host wall. A ray through the passage
  meets no material in either leaf; a leaf without its cut is a mutation
  the generic tests catch.
- **Ownership.** Wall faces: `objectId = wall`, `solidId = wall`. Reveals:
  `objectId = opening`, `solidId = wall`, `hostWallId`, `openingId`. The
  wall's closed solid is therefore `meshes.filter(m => m.solidId === wallId)`.
  Junction resolution never merges solids: a corner block is part of exactly
  one wall's solid, the owner's, and a picked corner resolves to that wall.

## Roofs (`roof-compiler.ts`)

GABLE: two slopes from the eave height at the footprint edge, rising at
`pitchDeg` to a ridge along `ridgeAxis` through the footprint's middle;
overhang extends the covered rectangle and follows the slope down; thickness
is perpendicular (vertical drop `t / cos pitch`). Emitted as **one closed
solid** with a chevron cross-section (no internal ridge faces). FLAT: a
plate `thickness` deep below the eave height over the covered rectangle.
`roofGeometry()` exposes `topAt`, `undersideAt`, `covers` and the crease line
for FOLLOW_ROOF walls. Pitch is measured back from the emitted normals in
tests (`upwardPlanes`), never read from the record.

**Roof openings.** Each `RoofOpening` of a roof is a vertical prism cut
through the plate over its plan rectangle. The plate is tiled in *bands*
across the ridge direction, broken at every opening's cross edges; along the
ridge one global set of breaks (every opening's along edges, on every band,
on both slopes and on the eave faces) keeps the tiling watertight: a band
edge on one slope always meets a vertex on its neighbour, the eave and end
faces are split on the same breaks, and the four reveals of a hole are split
wherever a band or an along-break crosses them. The eave and ridge heights
are computed once and shared so every vertex on a shared edge is the same
double. Reveals carry `objectId = roofOpening`, `part = ROOF_REVEAL`,
`solidId = roof`, `hostRoofId`; the roof's closed solid is still
`meshes.filter(m => m.solidId === roofId)`. A PENETRATION carries its
chimney's rectangle, so the chimney stack passes through a real hole and the
overlap oracle reports no shared volume. A ROOFLIGHT opening may be filled by
a `Rooflight`: a frame ring and a glass pane between the roof's top and
underside planes over the rectangle inset by `frameWidth`
(`ROOFLIGHT_FRAME`, `ROOFLIGHT_GLASS`, non-structural, `hostRoofId`,
`openingId`). The cut is a vertical prism rather than a prism normal to the
slope; this is stated in the reference model's ledger, not hidden.

Unlike the reference (which built from eave and ridge datums and ignored
the declared pitch), BuildApp's semantic parameter is the pitch, because it is
what an editor edits; the ridge height is derived.

**Edge members and plate insets (schema 1.5.0).** A roof's `edgeMembers` are
compiled *with* the roof, as the roof's own edge rather than bars laid over
it. A `verge` board runs along each rake of a gable end (per `ends` when the
two gables differ): its top is flush with the slope, it hangs `width` below it
measured vertically, and it is `depth` deep along the ridge axis. The plate is
shortened by the board's strip (`RoofGeometry.memberStrips`), the two halves
of each gable's board meet in one chevron at the ridge (no crossing bars), and
a FOLLOW_ROOF wall under a strip follows the board's underside, with a crease
line at the strip's inner edge. A `fascia` board runs along the named eave or
flat-roof edges, `topOffset` above the plate top and `height` tall, and the
plate stops at its inner face. Each board is emitted as `part = ROOF_TRIM`,
`objectId = roof`, `solidId = <trim id>`, `structural`, in its own material.
`plateInset` stops the plate short of the footprint on each side where it
bears on walls — conventionally at their centreline — so the plate's edge is
never a face in the plane of a wall's outer face; the footprint still says
what the roof covers.

## Closure audit (`closure.ts`)

`geometryClosureAudit(model, scene)` measures how the compiled solids MEET.
For every pair of structural solids whose boxes come within the plane
tolerance it measures the volume they share (ray-parity sampling), the
area they draw in one plane facing the same way (polygon clipping; a piece
lying under a third solid's face is enclosed and not counted), and — for
pairs within 10 cm that the model says meet (a junction, a ring, a wall that
follows a roof, a slab against its wall, a member on its host, a terrace on
its facade) — the gap between them. The model's semantics decide the
intended relation (CONTACT, BEARING, FLUSH, PENETRATION, GUARDS,
SEPARATION): a chimney through its roof is a penetration; a plate may share
at most wall thickness × plate thickness × run with a wall it bears into.
It also checks every railing end (at a wall, on the wall's real inward side,
or at another railing), every terrace against its floor datum, sliver
triangles, non-manifold edges and members that touch nothing. Findings name
the pair, the relation and a measure in m, m² or m³, and are scoped EXTERIOR
or INTERIOR. Nothing is repaired and no tolerance is widened to make a
finding go away: the audit exists so that a joint defect lands in the layer
that owns it. `npm run audit:exterior` runs it on the sealed candidates.

## Terraces

`compileTerrace`: the terrace polygon extruded from `top − thickness` to
`top` as one closed platform (`part = TERRACE`, objectKind `terrace`).

## Fills (`fills.ts`)

- **Window**: a frame **ring** (one closed manifold, not four boxes), glass
  panes and mullions per `divisions` — or at the explicit `mullions`
  fractions when the record states them — all in the wall's frame at
  `frameInset..frameInset+frameDepth`, glass centred in the frame depth.
  Under a raked head the ring is a trapezoid (the inner head line is offset
  from the outer one by `frameWidth · √(1 + rake²)`), the panes are
  trapezoids and the mullions stop at the inner head line; nothing of the
  fill reaches above the head (measured).
- **Door**: a U-shaped frame (jambs + head, one closed solid), a leaf box
  rotated by `openAngle` about a vertical hinge axis on `hingeSide`, towards
  `swing` (IN = into the building), and a handle on the inside face. The
  leaf geometry is a function of the angle — the animation path — and its
  volume is `width × height × thickness` at any angle (tested).

Fill parts are separate meshes with `objectId = window/door`,
`hostWallId`, `openingId`, `structural: false`.

## Regions with holes (`region.ts`)

`tessellateRegion(outer, holes)` turns `outer − holes` into triangles plus a
boundary, in abstract `(u, v)` coordinates: plan `(x, z)` for a slab,
wall-local `(a, b)` for a door frame or a finish skin.

The region is cut into horizontal bands at every vertex. Inside a band no
edge starts or ends, so the edges crossing it, sorted by `u`, pair up
left/right under the even-odd rule into trapezoids — a hole is simply two
more crossings. Every trapezoid corner on a scanline becomes a break on that
line and every trapezoid edge is split on all of its line's breaks, so
triangles either side of a scanline meet vertex for vertex and the boundary
walls, split on the same lines, share those vertices: no T-junctions.

A hole **may share boundary with the outer polygon** — a stair void against a
wall. The two coincident, opposite boundary segments have no material between
them and cancel, which is exactly the region difference. No bridging, no ear
clipping, no repair. `extrudePlanRegion` and `extrudeLocalRegion` extrude the
result into one closed, outward-wound solid.

## Stairs (`stair-compiler.ts`)

`layoutStair` (model package) turns a FLIGHTS stair into risers: each with
its riser line, its travel direction, its tread polygon and its top height,
plus landing plates. A WINDER fans its riser lines from a newel on the turn
side; the arrival riser has no tread of its own, because the destination
floor is its tread.

The compiler treats every tread and landing as a **cell**: a plan polygon
between `max(base, top − riserHeight − waist)` and `top`, so the underside
steps down with the flight as a folded plate. The solid is the union of the
cells, emitted as exposed faces only, from plan adjacency alone: on an edge
two cells share, the riser above the lower cell's tread and the soffit step
below its bottom; on an unshared edge, the cell's side — which is also the
first riser off the floor and the back face on the arrival line. A strip of
40 mm is cut off the back of the last cell and raised to the arrival height,
so the stair's highest emitted point is measured, not assumed.

Every cell vertex is inserted into the other cells' edges it lies on, and
every vertical edge is split at every height another face has a vertex at on
the same plan point, so the surface is edge-manifold everywhere — including
along a winder's newel, where riser and soffit faces fan around one vertical
line. Nothing here reads the slab: the void a stair needs is the slab's own
hole.

## Surface regions (`surface-regions.ts`)

A finish band becomes a 2 mm skin standing 3 mm clear of its wall face (so
the two surfaces never z-fight), clipped to the wall's real material: bounded
above by the wall's own top function (a roof soffit, a gable rake), along by
the face's physical extent, and with every opening the wall carries cut out
of it (Sutherland–Hodgman against the band's rectangle, so an opening
straddling an edge becomes a notch). It is non-structural, changes no wall
volume, and is hidden with its host wall.

## Features (`features.ts`)

Slabs and balconies: polygon extrusion (ear clipping) between `top −
thickness` and `top`; a slab with `holes` goes through the region
tessellator instead. Chimney: a box. Railing: a polyline (its `path`, or
`start`–`end`): one square post centred on every corner, end posts inside the
run so a railing drawn to a wall face meets it without entering it, posts at
every `postSpacing` along each run, a top rail per run stopping at the corner
posts' faces, and BARS / GLASS / NONE infill per bay, all as separate parts. Room: a thin
translucent floor plate so a room is selectable (non-structural). A
PLACEHOLDER stair: a thin plate; a FLIGHTS stair goes to the stair compiler.

## Diagnostics

`MODEL_INVALID`, `UNKNOWN_LEVEL`, `WALL_TOP_BELOW_BASE`, `WALL_CONSUMED`,
`WALL_NOT_UNDER_ROOF` (warning), `OPENING_ABOVE_WALL_TOP`,
`FILL_WITHOUT_OPENING` (warning), `POLYGON_NOT_TRIANGULATED`. The compiler
never repairs. Openings that reach into a cut-away junction zone are refused
by validation (`OPENING_IN_JUNCTION_ZONE`) before the compiler sees them.

## Verification (`packages/verification`)

Independent oracles that share no code with the compiler: `meshVolume`
(divergence theorem, sign-sensitive), `manifoldReport` (directed-edge
pairing, exact vertices), `rayHits` / `materialRuns` / `materialLength`
(Möller–Trumbore, both facings), `unionMaterialRuns` (several solids, runs
unioned — a ray through the concatenated triangles of abutting solids is not
sound), `sharedMaterialLength` and `overlapEstimate` (grid of vertical rays
over two solids' box intersection), `planeClusters` / `upwardPlanes` (pitch
from normals), `boundsOf`, `ringClosureReport` (storey envelope probes,
`docs/WALL_TOPOLOGY.md`), and since BUILDAPP-01 `depthProbeReport` (a grid
of parallel rays across a rectangle: first-hit depth per ray, how many stop
at a stated plane — the recess oracle), `lineCoverage` (what fraction of a
segment lies inside material, and the longest gap — the balustrade-glass
oracle) and `pointInPolygon` (plan adjacency of rooms and openings).

The geometry tests measure, they do not read back: wall volume `L·H·T`,
`(L·H − w·h)·T` with a window, rays through opening centres meeting 0 wall
material and the full thickness 50 mm past the jamb, roof pitch from normals,
eave-wall top meeting the roof underside with no daylight and no overlap on
both faces, every demo solid closed with zero boundary and duplicate edges,
and pairwise overlap between all structural solids equal to exactly the one
stated penetration (the chimney through the roof).

## Reused ideas from the reference repository

- Wall-local coordinates with the origin on the outer face; openings stated
  in the host frame only.
- Single-grid tiling with ends/top/bottom split on the same breaks; per-vertex
  bit-identical computation for exact manifold checks.
- Roof slabs with vertical end cuts and perpendicular thickness; pitch
  measured from emitted normals.
- Sloped wall tops that vary across the thickness (PLANE / soffit contact),
  here derived from the roof instead of stated.
- Provenance vocabulary; refusing rather than repairing; oracles independent
  of the compiler; ray-based shared-material detection.

Not carried over: gold fixtures, facade recess/portal specs, interior room
solver, and every analyzer component. Junction and ring records exist since
STAGE BUILDAPP-00A, designed for this model (owner-through corners with cuts
in the other wall's face planes, BUTT/T against physical faces) rather than
copied.
