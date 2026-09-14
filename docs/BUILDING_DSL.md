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
| `createWall` | a wall from `start` to `end` (outer face), `thickness`, `height`, `baseOffset` = 0, `kind` = EXTERIOR, `topProfile?` | see the wall convention in `CANONICAL_BUILDING_MODEL.md` |
| `createSlab` | a slab from a polygon, `topOffset` = 0, `thickness` | |
| `createRoof` | GABLE or FLAT over a footprint: `eaveOffset`, `pitchDeg`, `ridgeAxis` = X, `overhang` = 0, `thickness` = 0.25; `capWallIds` sets those walls' `topProfile` to `FOLLOW_ROOF` | a FLAT roof gets pitch 0 |
| `cutOpening` | a structural opening in a wall: `kind`, `offset`, `sill`, `width`, `height` | validated inside the host, not touching side/top edges, not overlapping |
| `placeWindow` | a window in a WINDOW opening; defaults `frameWidth` 0.07, `frameDepth` 0.08, `frameInset` 0.12, `glassThickness` 0.024, `divisions` 1 | one fill per opening |
| `placeDoor` | a door in a DOOR opening; defaults `hingeSide` LEFT, `swing` IN, `openAngle` 0, `leafThickness` 0.045, `frameWidth` 0.06, `frameDepth` 0.12, `frameInset` 0.1 | |
| `createBalcony` | BALCONY/TERRACE/LOGGIA plate over a footprint | |
| `createRailing` | posts, top rail and infill from `start` to `end`; `height` 1.1, `postSpacing` 1.2, `infill` BARS, `hostId?` | |
| `placeChimney` | a box over a footprint, `baseOffset`, `height` | |
| `createStairPlaceholder` | a footprint linking two levels | geometry is a later stage |
| `defineMaterial` / `assignMaterial` | materials and their assignment (`materialId: null` clears) | walls, windows, doors, slabs, roofs, balconies, railings, chimneys |
| `moveFeature` | `dx`, `dy`, `dz`, `dAlong` — walls/railings/rooms/slabs/rect features move in plan, openings along their wall, levels vertically | windows/doors move with their opening |
| `resizeFeature` | `width`, `height`, `thickness`, `length`, `footprint` — accepted per kind, the rest rejected by name | |
| `setProperty` | one property (`"height"`, `"start.x"`, …); the object is re-validated against its schema | `id` is immutable |
| `addConstraint` | FIXED_VALUE / EQUAL / ALIGN / NOTE over target ids | recorded, not yet solved |
| `removeFeature` | removes the object and, with `cascade` (default), its dependants: a wall's openings and their fills, a level's features, an opening's fill; clears dangling material/host/roof references; reports every removed id | `cascade: false` refuses when dependants exist |
| `setEvidence` / `addEvidenceSource` | provenance | |
| `setModelName` | | |

After every command the whole model is re-validated; a command that would
leave it invalid is rejected with the validation codes
(`OPENING_OUTSIDE_HOST`, `UNKNOWN_WALL`, …) and the model is unchanged.

## Session, undo/redo, history

`BuildingSession` keeps the current model, a past/future stack of models
(snapshot-based undo — cheap because commands never mutate) and `log`, the
ordered list of executed commands with the ids they created, changed and
removed. The log is the replayable record a later animation or
reconstruction stage can read back; `demoBuildingCommands()` is the same idea
written by hand.

## Ids

State an `id` to choose it; omit it to get a deterministic `<kind>-<n>`.

## The demo building

`packages/demo` builds the demonstration house with 70-odd commands and no
geometry: two levels, an exterior ring per level, an interior partition, a
garage wing, three slabs, a 35° gable roof and a flat garage roof (both
capping their walls), eleven windows, four doors (entrance, kitchen, garage,
balcony — the kitchen door stands 35° open), five rooms, a rear balcony with
three railings, a chimney, a stair placeholder, materials, constraints and
evidence. `createDemoBuilding()` is `runCommands(createEmptyModel(...), demoBuildingCommands())`,
which an architecture test asserts.
