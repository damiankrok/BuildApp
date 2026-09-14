# CanonicalBuildingModel

The versioned, validated source of truth of BuildApp. Everything BuildWorld
draws is derived from it by the geometry compiler; nothing is ever stored in
Three.js objects. Implemented in `packages/model`.

## Identity and versioning

```json
{
  "schema": "buildapp.canonical-building-model",
  "schemaVersion": "1.0.0",
  "id": "demo-house",
  "name": "BuildApp demo house",
  "units": { "length": "m", "angle": "deg" },
  "frame": { ... },
  "building": { "id": "house", "name": "Demo house" },
  "levels": [...], "rooms": [...], "walls": [...], "openings": [...], "windows": [...], "doors": [...],
  "slabs": [...], "roofs": [...], "balconies": [...], "railings": [...], "chimneys": [...], "stairs": [...],
  "materials": [...], "constraints": [...], "evidenceSources": [...],
  "meta": { "createdWith": "buildapp-demo", "notes": [] }
}
```

`schema` and `schemaVersion` are literals in the Zod schema; a file that
states anything else is refused. Every semantic object has a stable `id`
(`[A-Za-z0-9_.:-]+`), unique across all collections including the building.
Ids are never renamed (`setProperty` refuses `id`) and survive save/load
byte for byte.

## Coordinate frame and units

Recorded verbatim in every file as `frame` (`MODEL_FRAME` in
`packages/model/src/schema.ts`), and validated as literals:

| axis | meaning |
| --- | --- |
| `x` | right when looking at the front facade |
| `y` | up (vertical) |
| `z` | away from the front facade, into the building |

Finished ground-floor level is `y = 0`; the front facade's outer face is
`z = 0`. Lengths are metres, persisted angles degrees.

Taken literally, `x` right / `y` up / `z` away from the viewer is a
**left-handed** triple. The model keeps exactly the frame the specification
asks for; all geometry, tests and oracles work in it (the cross-product
algebra does not care about handedness as long as every face is wound the
same way — see `docs/GEOMETRY_COMPILER.md`). Renderers working in a
right-handed frame mirror `z` and swap two triangle vertices when they build
their scene; BuildWorld's adapter does exactly that (`apps/web/src/viewport/scene-adapter.ts`).

### Wall convention

A wall runs from `start` to `end` along its **outer face** at its base. Its
frame is `u` (along), `up` (vertical) and the outward normal
`n = up × u`; material lies along `−n`, i.e. `thickness` inward from the outer
face. Consequently an exterior ring is traversed **counter-clockwise on a plan
drawn with the front facade at the bottom**: front wall left→right (+x),
right wall front→back (+z), rear wall right→left (−x), left wall back→front
(−z). Material is on the left of the direction of travel.

Corners are owned by whichever wall runs through them; the abutting wall
starts/ends at the owner's inner face (the demo's side walls run from
`z = thickness` to `z = depth − thickness`). This is how duplicate corner
volume is avoided without a junction record in this stage.

## Vertical positions

Inside a level everything is stated as an **offset above that level's finished
floor**: `wall.baseOffset`, `slab.topOffset`, `roof.eaveOffset`,
`balcony.topOffset`, `railing.baseOffset`, `chimney.baseOffset`. Moving a
level moves what stands on it. Opening `sill` is above the wall base.

## Semantic objects

| object | key fields | references |
| --- | --- | --- |
| `Building` | `id`, `name` | — |
| `Level` | `index`, `elevation`, `height` | `buildingId` |
| `Room` | `polygon` (plan, simple), `usage` | `levelId` |
| `Wall` | `start`, `end`, `thickness`, `height`, `baseOffset`, `kind` EXTERIOR/INTERIOR, `topProfile`, `materialId` | `levelId`, `topProfile.roofId` |
| `Opening` | `kind` WINDOW/DOOR/PASSAGE, `offset` (along the wall), `sill`, `width`, `height` — wall-local | `wallId` |
| `Window` | `frameWidth`, `frameDepth`, `frameInset`, `glassThickness`, `divisions` | `openingId` |
| `Door` | `hingeSide` LEFT/RIGHT, `swing` IN/OUT, `openAngle` 0..180°, `leafThickness`, `frameWidth`, `frameDepth`, `frameInset` | `openingId` |
| `Slab` | `polygon`, `topOffset`, `thickness` | `levelId` |
| `Roof` | `kind` GABLE/FLAT, `footprint` (plan rect), `eaveOffset`, `pitchDeg`, `ridgeAxis` X/Z, `overhang`, `thickness` | `levelId` |
| `Balcony` | `kind` BALCONY/TERRACE/LOGGIA, `footprint`, `topOffset`, `thickness` | `levelId` |
| `Railing` | `start`, `end`, `baseOffset`, `height`, `postSpacing`, `infill` GLASS/BARS/NONE | `levelId`, `hostId` |
| `Chimney` | `footprint`, `baseOffset`, `height` | `levelId` |
| `Stair` | `footprint`, `kind` PLACEHOLDER | `levelId`, `toLevelId` |
| `Material` | `name`, `color` `#rrggbb`, `opacity` | referenced by `materialId` |
| `Constraint` | `kind` FIXED_VALUE/EQUAL/ALIGN/NOTE, `targetIds`, `property`, `value`, `tolerance` | any object |
| `EvidenceSource` | `kind` DRAWING/PHOTO/RENDER/PUBLISHED_FACT/MANUAL/DERIVATION/OTHER, `label`, `uri` | referenced by `evidence.sourceIds` |

`Wall.topProfile` is `FLAT` (default), `FOLLOW_ROOF { roofId }` (the wall
stops at `min(height, roof underside)` — gable ends rise into the gable, eave
walls die into the soffit) or `POLYLINE { points: [{u, height}] }`.

Doors are not flattened into geometry: the model holds a hinge side, a swing
direction and an open angle; the compiler derives frame, leaf and handle from
them on every compile, which is the future animation path. Windows hold frame
and glazing parameters and a `divisions` count where sash/pivot behaviour
attaches later.

## Evidence / provenance

Every semantic object may carry `evidence`:

```ts
{ status, source?, locator?, interpretation?, confidence?, note?, properties?: Record<string, status>, sourceIds?: string[] }
```

with `status` ∈ `SOURCE_EXACT`, `SOURCE_CORROBORATED`, `SOURCE_DERIVED`,
`GEOMETRIC_INFERRED`, `VISUAL_INFERRED`, `ASSUMED`, `UNRESOLVED`.
`properties` refines the status per field (a wall whose plan position is
exact but whose height is assumed). `sourceIds` reference shared
`EvidenceSource` records. `isHardEvidence()` names the two statuses a later
stage may use as hard metric constraints. Nothing in the model forces an
analyzer to discard uncertainty.

## Validation

`validateModel(input)` runs the Zod schema and then the semantic checks in
`packages/model/src/validate.ts`. Nothing is repaired. Codes include
`DUPLICATE_ID`, `UNKNOWN_LEVEL`, `UNKNOWN_WALL` (opening on a nonexistent
wall), `UNKNOWN_OPENING` (window/door on a nonexistent opening),
`UNKNOWN_ROOF`, `UNKNOWN_MATERIAL`, `UNKNOWN_TARGET`, `OPENING_OUTSIDE_HOST`
(also a door taller or wider than its wall), `OPENING_TOUCHES_WALL_EDGE` (a
sill at the base is allowed; side and top edges are not), `OPENINGS_OVERLAP`,
`FILL_KIND_MISMATCH`, `OPENING_FILLED_TWICE`, `FILL_TOO_LARGE`,
`MALFORMED_POLYGON`, `INVALID_RECT`, `INVALID_ROOF`, `DEGENERATE_WALL`,
`DEGENERATE_RAILING`, and `SCHEMA` for shape errors (negative heights, bad
enums, a wrong frame). Every command re-validates the whole model and is
rejected with these codes if it would break it.

## Persistence

`serializeModel(model)` writes canonical JSON: every collection sorted by id,
keys sorted recursively, numbers in JavaScript's shortest round-trip form, two
space indentation, trailing newline. Two models with the same content produce
identical bytes whatever order they were built in. `loadModel(text)` parses,
validates and canonicalizes; `parseModel` throws with the issues listed.
Round-trip tests live in `packages/model/test`, `packages/demo/test` and
`tests/architecture`.

## Ids

`nextId(model, kind, requested?)` returns the requested id or
`<prefix>-<n>` with the smallest unused `n` (`wall-1`, `opening-3`, …). No
clock, no randomness: replaying a command list yields the same ids.
