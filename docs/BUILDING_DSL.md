# Building DSL

The typed command layer that constructs and edits a CanonicalBuildingModel.
Implemented in `packages/commands`. It is what future reconstruction
algorithms, tests, scripts and BuildWorld's editor tools all use; it speaks
only about semantic objects. There is no `addMesh`.

## Using it

```ts
import { createEmptyModel } from '@buildapp/model'
import { applyCommand, runCommands, BuildingSession } from '@buildapp/commands'

let model = createEmptyModel('house-1', 'My house')
model = runCommands(model, [
  { type: 'createBuilding', id: 'b' },
  { type: 'createLevel', id: 'ground', index: 0, elevation: 0, height: 3 },
  { type: 'createWall', id: 'front', levelId: 'ground', start: { x: 0, z: 0 }, end: { x: 10, z: 0 }, thickness: 0.3, height: 3 },
  { type: 'cutOpening', id: 'op-1', wallId: 'front', kind: 'DOOR', offset: 1, sill: 0, width: 1, height: 2.1 },
  { type: 'placeDoor', id: 'door-1', openingId: 'op-1', hingeSide: 'LEFT', swing: 'IN', openAngle: 0 },
])

const r = applyCommand(model, { type: 'placeWindow', openingId: 'nope' })
// r.ok === false, r.errors[0].code === 'UNKNOWN_OPENING'

const session = new BuildingSession(model)
session.execute({ type: 'setProperty', targetId: 'front', property: 'height', value: 3.2 })
session.undo(); session.redo()
```

`applyCommand` never mutates its input; it returns a new model or a list of
`{ code, message, objectId? }` errors. `runCommands` throws on the first
failure (for fixtures); `applyCommands` reports `failedAt`. Commands are Zod
schemas (`BuildingCommandSchema`), so a command arriving as JSON is validated
and defaulted before it touches the model.

## Commands

| command | creates / changes | notes |
| --- | --- | --- |
| `createBuilding` | the model's single building | refused if one exists |
| `createLevel` | a level (`index`, `elevation`, `height`) | needs a building |
| `createRoom` | a room polygon on a level | polygon must be simple |
| `createWall` | a wall from `start` to `end` (outer face), `thickness`, `height`, `baseOffset` = 0, `kind` = EXTERIOR, `topProfile?`; `startJunction?` / `endJunction?` create the junctions at its ends in the same step (`{ kind: 'CORNER', with: { wallId, end }, owner: SELF/OTHER }` or `{ kind: 'BUTT' \| 'T', againstWallId }`) | see the wall convention in `CANONICAL_BUILDING_MODEL.md` and `WALL_TOPOLOGY.md` |
| `createWallRing` | a closed ring from a natural footprint `polygon`: one wall per edge, one CORNER per vertex, a `WallRing` record; `thickness`, `height`, `baseOffset`, `kind`, `topProfile`, `materialId` as ring defaults, `walls[]` per-edge overrides (`id`, `name`, `height`, `thickness`, `materialId`, `topProfile`, `evidence`, `tags`), `cornerOwnership` ALTERNATE/PRECEDING/FOLLOWING, `tolerance` | ids `<ring>-w<i>` / `<ring>-j<i>`; a clockwise polygon is reversed |
| `createWallJunction` | a CORNER (`a`, `b`, `owner` = `a`'s wall), BUTT or T (`wall`, `againstWallId`) between existing walls | refused if the endpoints gap or overshoot, if an end is already claimed, or if the walls overlap without it |
| `createSlab` | a slab from a polygon, `holes?` (plan polygons removed through the thickness), `topOffset` = 0, `thickness` | a hole must be simple, lie inside the outer polygon and not cross another hole; it **may** touch the outline |
| `createRoof` | GABLE or FLAT over a footprint: `eaveOffset`, `pitchDeg`, `ridgeAxis` = X, `overhang` = 0, `thickness` = 0.25; `capWallIds` sets those walls' `topProfile` to `FOLLOW_ROOF` | a FLAT roof gets pitch 0 |
| `cutOpening` | a structural opening in a wall: `kind`, `offset`, `sill`, `width`, `height`; `head?` `{ kind: 'RAKED', heightFar }` for a head that rises from `height` at the near jamb to `heightFar` at the far jamb; `leaves?` `[{ wallId, offset }]` for further parallel walls the same hole passes through | validated inside the host (and inside every leaf), not touching side/top edges, not overlapping |
| `cutRoofOpening` | a ROOFLIGHT or PENETRATION cut through a roof over a plan `footprint`; `cut?` VERTICAL (default) / NORMAL_TO_ROOF; a penetration names its chimney in `throughId` | strictly inside the covered rectangle over **both** outlines, on one slope, clear of other roof openings; a PENETRATION must be VERTICAL |
| `placeWindow` | a window in a WINDOW opening; defaults `frameWidth` 0.07, `frameDepth` 0.08, `frameInset` 0.12, `glassThickness` 0.024, `divisions` 1; `mullions?` explicit fractions of the width | one fill per opening; a raked opening gets a trapezoid frame |
| `placeRooflight` | a rooflight unit in a ROOFLIGHT roof opening; defaults `frameWidth` 0.07, `glassThickness` 0.024 | one unit per roof opening |
| `placeDoor` | a door in a DOOR opening; defaults `hingeSide` LEFT, `swing` IN, `openAngle` 0, `leafThickness` 0.045, `frameWidth` 0.06, `frameDepth` 0.12, `frameInset` 0.1; `assembly?` `{ panels, mullionWidth }` for a composite door (a leaf with a glazed sidelight, a sectional panel, a glazed leaf) | the panel fractions must sum to 1 and each must leave a positive clear width |
| `createBalcony` | BALCONY/TERRACE/LOGGIA plate over a footprint | |
| `createRailing` | posts, top rail and infill from `start` to `end`; `height` 1.1, `postSpacing` 1.2, `infill` BARS, `hostId?` | |
| `placeChimney` | a box over a footprint, `baseOffset`, `height` | |
| `createStairPlaceholder` | a footprint linking two levels | no flights: a footprint is all it claims |
| `createStair` | a real staircase between two levels: `start` (the left end of the first riser line, facing `direction`), `direction`, `width`, `segments` (FLIGHT / WINDER / LANDING in walking order), `baseOffset` = 0, `topOffset` = 0, `waist` = 0.18, `materialId?`; `footprint?` is derived from the layout when omitted | the last segment must be a FLIGHT (its last riser arrives at the destination floor); a LANDING must follow a FLIGHT and, when it turns, be at least the stair width long |
| `createSurfaceRegion` | a finish band on one face of a wall: `hostId`, `face` = OUTER, `rect` `{ a0, a1, b0, b1 }` wall-local, `materialId` | appearance only: no thickness, no wall volume changed; clipped by the compiler to the wall's real material |
| `defineMaterial` / `assignMaterial` | materials and their assignment (`materialId: null` clears) | walls, windows, doors, slabs, roofs, balconies, railings, chimneys |
| `moveFeature` | `dx`, `dy`, `dz`, `dAlong` — walls/railings/rooms/slabs/rect features (roof openings included) move in plan, openings along their wall (their leaves follow, signed by each leaf wall's direction), levels vertically | windows/doors move with their opening |
| `resizeFeature` | `width`, `height`, `thickness`, `length`, `footprint` (rect features and roof openings) — accepted per kind, the rest rejected by name | |
| `setProperty` | one property (`"height"`, `"start.x"`, …); the object is re-validated against its schema | `id` is immutable |
| `addConstraint` | FIXED_VALUE / EQUAL / ALIGN / NOTE over target ids | recorded, not yet solved |
| `removeFeature` | removes the object and, with `cascade` (default), its dependants: a wall's openings and their fills, a level's features, an opening's fill, a roof's openings and their rooflights, a chimney's penetrations; removing a leaf wall strips that leaf from its opening; clears dangling material/host/roof references; reports every removed id | `cascade: false` refuses when dependants exist |
| `setEvidence` / `addEvidenceSource` | provenance | |
| `setModelName` | | |

After every command the whole model is re-validated; a command that would
leave it invalid is rejected with the validation codes
(`OPENING_OUTSIDE_HOST`, `UNKNOWN_WALL`, `WALLS_OVERLAP`, `JUNCTION_GAP`, …)
and the model is unchanged. That is why a wall drawn from footprint line to
footprint line states its junctions inline: without them it overlaps its
neighbours and is refused. `removeFeature` on a wall cascades to its
junctions and rings; on a corner junction alone it is refused, because the
two walls would overlap again.

## Building a house the analyzer way

```ts
runCommands(createEmptyModel('house', 'house'), [
  { type: 'createBuilding', id: 'b' },
  { type: 'createLevel', id: 'ground', index: 0, elevation: 0, height: 3 },
  { type: 'createWallRing', id: 'house', levelId: 'ground', polygon: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 8 }, { x: 0, z: 8 }], thickness: 0.3, height: 3 },
  { type: 'createWall', id: 'partition', levelId: 'ground', start: { x: 6, z: 8 }, end: { x: 6, z: 0 }, thickness: 0.12, height: 2.75, kind: 'INTERIOR',
    startJunction: { kind: 'T', againstWallId: 'house-w2' }, endJunction: { kind: 'T', againstWallId: 'house-w0' } },
  { type: 'cutOpening', id: 'door-op', wallId: 'house-w0', kind: 'DOOR', offset: 1, sill: 0, width: 1, height: 2.1 },
  { type: 'placeDoor', id: 'door', openingId: 'door-op' },
  ...
])
```

No coordinate above is a thickness offset; `tests/architecture/topology.test.ts`
builds exactly this house and proves the ring closes, the corner volumes are
counted once and the openings are real holes.

## Session, undo/redo, history

`BuildingSession` keeps the current model, a past/future stack of models
(snapshot-based undo — cheap because commands never mutate) and `log`, the
ordered list of executed commands with the ids they created, changed and
removed. The log is the replayable record a later animation or
reconstruction stage can read back; `demoBuildingCommands()` is the same idea
written by hand.

## Ids

State an `id` to choose it; omit it to get a deterministic `<kind>-<n>`
(`roof-opening-<n>`, `rooflight-<n>` for the 1.2.0 kinds).

## The demo building

`packages/demo` builds the demonstration house with 70-odd commands and no
geometry: two levels, an exterior ring per level (`createWallRing` on the
10 × 8 footprint), an interior partition with T-junctions, a garage wing
with corner junctions and a T into the main body, three slabs, a 35° gable roof and a flat garage roof (both
capping their walls), eleven windows, four doors (entrance, kitchen, garage,
balcony — the kitchen door stands 35° open), five rooms, a rear balcony with
three railings, a chimney, a stair placeholder, materials, constraints and
evidence. `createDemoBuilding()` is `runCommands(createEmptyModel(...), demoBuildingCommands())`,
which an architecture test asserts.

## The Marcówki reference

`packages/reference-marcowki` transcribes a real catalogue house, *Dom w
marcówkach (GE)*, into 145 commands of this vocabulary and nothing else —
no new command was added for it. `marcowkiCommands()` is the stream,
`createMarcowkiReferenceBuilding()` its replay from an empty model (byte
equivalence asserted). It exercises everything above including
`createWallRing` on both storeys, a garage wing joined by a T into the ring,
five returns butted against ring walls, `FOLLOW_ROOF` partitions, three
raked gable windows with explicit mullions, three rooflights and two chimney
penetrations. See `docs/MARCOWKI_REFERENCE_MODEL.md`.
