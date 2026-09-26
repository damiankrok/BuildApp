# CanonicalBuildingModel

The versioned, validated source of truth of BuildApp. Everything BuildWorld
draws is derived from it by the geometry compiler; nothing is ever stored in
Three.js objects. Implemented in `packages/model`.

## Identity and versioning

```json
{
  "schema": "buildapp.canonical-building-model",
  "schemaVersion": "1.5.0",
  "id": "demo-house",
  "name": "BuildApp demo house",
  "units": { "length": "m", "angle": "deg" },
  "frame": { ... },
  "building": { "id": "house", "name": "Demo house" },
  "levels": [...], "rooms": [...], "walls": [...], "wallJunctions": [...], "wallRings": [...],
  "openings": [...], "windows": [...], "doors": [...],
  "slabs": [...], "roofs": [...], "roofOpenings": [...], "rooflights": [...],
  "balconies": [...], "railings": [...], "chimneys": [...], "stairs": [...],
  "materials": [...], "constraints": [...], "evidenceSources": [...],
  "meta": { "createdWith": "buildapp-demo", "notes": [] }
}
```

`schema` is a literal in the Zod schema. `schemaVersion` is the current
version `1.2.0`; older supported versions (`1.0.0`, `1.1.0`) are migrated
explicitly (below) and anything else is refused. Every semantic object has a stable `id`
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

Walls are stated on the natural footprint: an exterior ring's walls run
corner to corner along the outer footprint polygon, a partition runs from
footprint line to footprint line. Where walls meet, a `WallJunction` record
(CORNER with an owner, BUTT, T) says so, and the model resolves the physical
extent of each wall end — see `docs/WALL_TOPOLOGY.md`. A wall without
junctions keeps its nominal extent, so a hand-trimmed BUILDAPP-00 file still
means what it meant. Two walls whose physical footprints overlap in plan over
a common height range are an error (`WALLS_OVERLAP`) unless a junction
resolves them.

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
| `WallJunction` | `kind` CORNER (`a`, `b` wall ends, `owner`) / BUTT / T (`wall` end, `againstWallId`), `tolerance` | wall ends `{ wallId, end: START/END }` |
| `WallRing` | `wallIds` in traversal order, `junctionIds` one per vertex | `levelId`, walls, junctions |
| `Opening` | `kind` WINDOW/DOOR/PASSAGE, `offset` (along the wall), `sill`, `width`, `height` — wall-local; `head` LEVEL (default) or RAKED `{ heightFar }` (the head rises linearly from `height` at the near jamb to `heightFar` at the far jamb — a gable window under a rake); `leaves` `[{ wallId, offset }]` — further parallel walls on the same level the same hole passes through (a passage through two abutting leaves) | `wallId`, `leaves[].wallId` |
| `Window` | `frameWidth`, `frameDepth`, `frameInset`, `glassThickness`, `divisions`, `mullions` (explicit fractions 0..1 of the width, overriding equal `divisions`) | `openingId` |
| `Door` | `hingeSide` LEFT/RIGHT, `swing` IN/OUT, `openAngle` 0..180°, `leafThickness`, `frameWidth`, `frameDepth`, `frameInset`; `assembly?` `{ panels, mullionWidth }` — panels side by side across the opening, each a `fraction` of the width: `LEAF` (own `hinge`, `glazing` NONE/FULL), `GLAZED` (a fixed pane), `PANEL` (a fixed solid) | `openingId` |
| `Slab` | `polygon`, `holes?` (plan polygons removed through the full thickness; a hole may share boundary with the outer polygon), `topOffset`, `thickness` | `levelId` |
| `Roof` | `kind` GABLE/FLAT, `footprint` (plan rect), `eaveOffset`, `pitchDeg`, `ridgeAxis` X/Z, `overhang`, `thickness`; `edgeMembers?` — `verge` `{ width, depth, ends? [{ side, width, depth }] }` (a board along each rake of a gable end, its top flush with the slope, `width` measured vertically) and `fascia` `{ sides, topOffset, height, depth }` (a board along named eave or flat-roof edges), both compiled **with** the roof; `plateInset?` `{ minX, maxX, minZ, maxZ }` — how far the plate stops short of the footprint where it bears on walls | `levelId`, members' `materialId` |
| `RoofOpening` | `kind` ROOFLIGHT/PENETRATION, `footprint` (plan rect inside the covered rectangle, on one slope), `cut?` VERTICAL (default) / NORMAL_TO_ROOF, `throughId` (a PENETRATION names the chimney whose footprint it carries) | `roofId`, `throughId` |
| `Rooflight` | `frameWidth`, `glassThickness`, `materialId` — the unit filling a ROOFLIGHT opening | `roofOpeningId` |
| `Balcony` | `kind` BALCONY/TERRACE/LOGGIA, `footprint`, `topOffset`, `thickness` | `levelId` |
| `Railing` | `start`, `end`, `baseOffset`, `height`, `postSpacing`, `infill` GLASS/BARS/NONE; `path?` — a railing that turns: its plan polyline from `start` to `end` (the ends are the railing's extent; one post at every corner) | `levelId`, `hostId` |
| `Terrace` | `polygon` (plan, simple), `topOffset`, `thickness`, `surface` PAVED/DECK/UNKNOWN, `edge` PLINTH/FLUSH — an exterior floor on the ground against a facade, not carried by the building | `levelId`, `hostWallIds`, `materialId` |
| `Chimney` | `footprint`, `baseOffset`, `height` | `levelId` |
| `Stair` | `footprint`; `kind` PLACEHOLDER (a footprint only) or FLIGHTS (`start` — the left end of the first riser line facing `direction` — `direction` PLUS_X/MINUS_X/PLUS_Z/MINUS_Z, `width`, `baseOffset`, `topOffset`, `waist`, `segments`) | `levelId`, `toLevelId` |
| `StairSegment` | `FLIGHT { risers, going }`, `WINDER { risers, turn LEFT/RIGHT, angleDeg 90/180 }` (riser lines fan from a newel on the turn side), `LANDING { length, turn NONE/LEFT/RIGHT }` | in walking order |
| `LinearSolid` | `start`, `end` (3-D centreline), `width`, `depth`, `roll?` — a closed member of rectangular section: a portal head, a fascia, a free board | `levelId`, `hostId`, `materialId` |
| `SurfaceRegion` | `hostId` (a wall), `face` OUTER/INNER, `rect` `{ a0, a1, b0, b1 }` wall-local, `materialId` — a finish band with **no thickness of its own** | `hostId`, `materialId` |
| `Material` | `name`, `color` `#rrggbb`, `opacity` | referenced by `materialId` |
| `Constraint` | `kind` FIXED_VALUE/EQUAL/ALIGN/NOTE, `targetIds`, `property`, `value`, `tolerance` | any object |
| `EvidenceSource` | `kind` DRAWING/PHOTO/RENDER/PUBLISHED_FACT/MANUAL/DERIVATION/OTHER, `label`, `uri` | referenced by `evidence.sourceIds` |

`Wall.topProfile` is `FLAT` (default), `FOLLOW_ROOF { roofId }` (the wall
stops at `min(height, roof underside)` — gable ends rise into the gable, eave
walls die into the soffit) or `POLYLINE { points: [{u, height}] }`.

A raked head is a property of the hole, not of the fill: the window in it
gets a trapezoid frame from the compiler. A door refuses a raked opening
(`FILL_PROFILE_UNSUPPORTED`). Leaves make one semantic opening span several
walls; the host wall's leaf comes first, each leaf states the opening's
offset along its own wall, and every leaf must be a distinct wall on the
same level, parallel to the host (`OPENING_LEAF_INVALID`,
`OPENING_LEAF_LEVEL_MISMATCH`, `OPENING_LEAF_NOT_PARALLEL`). A roof opening is cut through the roof plate over its plan rectangle. With
`cut: VERTICAL` (the default) it is a vertical prism: the same outline on
both surfaces. With `cut: NORMAL_TO_ROOF` the sides are perpendicular to the
roof plane, so the underside outline is the footprint shifted
`thickness · sin(pitch)` towards the ridge and the reveals are tilted — the
physically right cut for a roof window, and the one a stack must *not* use
(a PENETRATION is refused unless it is VERTICAL). The opening's hull over
both outlines must lie strictly inside the roof's covered rectangle
(`ROOF_OPENING_OUTSIDE_HOST`), on one side of a gable's ridge
(`ROOF_OPENING_CROSSES_RIDGE`), and clear of the roof's other openings
(`ROOF_OPENINGS_OVERLAP`); a penetration's rectangle equals its chimney's
(`ROOF_PENETRATION_MISMATCH`); a rooflight fills a ROOFLIGHT opening once
(`ROOF_OPENING_FILLED_TWICE`, `UNKNOWN_ROOF_OPENING`).

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
enums, a wrong frame, window mullions not strictly increasing). Schema 1.2.0
adds `FILL_PROFILE_UNSUPPORTED`, `OPENING_LEAF_INVALID`,
`OPENING_LEAF_LEVEL_MISMATCH`, `OPENING_LEAF_NOT_PARALLEL`,
`UNKNOWN_ROOF_OPENING`, `ROOF_OPENING_OUTSIDE_HOST`,
`ROOF_OPENING_CROSSES_RIDGE`, `ROOF_OPENINGS_OVERLAP`,
`ROOF_OPENING_FILLED_TWICE` and `ROOF_PENETRATION_MISMATCH`; every leaf of a
multi-leaf opening is validated against its own wall with the opening codes
above. Wall topology adds `JUNCTION_GAP`,
`JUNCTION_OVERSHOOT`, `JUNCTION_PARALLEL_WALLS`, `JUNCTION_SELF_REFERENCE`,
`JUNCTION_OWNER_NOT_PARTICIPANT`, `JUNCTION_LEVEL_MISMATCH`,
`ENDPOINT_JUNCTION_CONFLICT`, `BUTT_OFF_HOST`, `T_JUNCTION_POSITION`,
`WALL_CONSUMED`, `OPENING_IN_JUNCTION_ZONE`, `WALLS_OVERLAP`,
`RING_DEGENERATE`, `RING_NOT_CLOSED`, `RING_LEVEL_MISMATCH`, `UNKNOWN_JUNCTION`
and the warning `JUNCTION_KIND_MIX` (all in `docs/WALL_TOPOLOGY.md`); issues
that come from a measurement carry it in `measured`. Every command
re-validates the whole model and is rejected with these codes if it would
break it.

## Schema evolution

| version | stage | content |
| --- | --- | --- |
| `1.0.0` | BUILDAPP-00 | no topology; corner ownership expressed by hand-trimmed wall extents |
| `1.1.0` | BUILDAPP-00A | `wallJunctions` and `wallRings` collections; walls on the natural footprint |
| `1.2.0` | BUILDAPP-01 | `roofOpenings` and `rooflights` collections; optional `Opening.head`, `Opening.leaves`, `Window.mullions` |
| `1.3.0` | BUILDAPP-01A | `surfaceRegions` collection; `Stair` becomes PLACEHOLDER \| FLIGHTS; optional `Slab.holes`, `RoofOpening.cut`, `Door.assembly` |
| `1.4.0` | BUILDAPP-03 | `linearSolids` collection |
| `1.5.0` | BUILDAPP-03Y | `terraces` collection; optional `Roof.edgeMembers`, `Roof.plateInset`, `Railing.path` |

Policy (`packages/model/src/migrate.ts`, run by `validateModel` and therefore
by `loadModel`, `compileBuilding` and the editor's Load):

- a `1.5.0` file loads as is;
- a `1.4.0` file is migrated explicitly: an empty `terraces` is added,
  `schemaVersion` becomes `1.5.0`, a note is appended and the load reports
  `SCHEMA_MIGRATED`. Its roofs carry no edge members or plate insets and its
  railings no paths, so it compiles to exactly the geometry it compiled to
  under 1.4.0 (tested: the frozen 1.1.0–1.4.0 demo files compile to the
  current demo scene). Every older version walks the same chain one step at a
  time, one warning and one note per step;
- a `1.3.0` file gains the `linearSolids` collection (1.3.0 → 1.4.0) and then
  `terraces`;
- a `1.2.0` file is migrated **explicitly**: an empty `surfaceRegions` is
  added, `schemaVersion` becomes `1.3.0`, a note is appended and the load
  reports `SCHEMA_MIGRATED`. Every new field is optional and every old stair
  stays a PLACEHOLDER, so it compiles to exactly the geometry it compiled to
  under 1.2.0 (tested against the BUILDAPP-01 Marcówki file kept as a
  fixture: a placeholder stair, a notched slab, vertical roof cuts);
- a `1.1.0` file is migrated through the chain: empty `roofOpenings` and
  `rooflights` are added (1.1.0 → 1.2.0), then `surfaceRegions` (1.2.0 →
  1.3.0), one `SCHEMA_MIGRATED` warning and one note per step. The
  optional opening and window fields are absent, so it compiles to exactly
  the geometry it compiled to under 1.1.0 (tested against the BUILDAPP-00A
  demo file kept as a fixture: the migrated scene deep-equals the current
  demo's). Re-saving writes a 1.2.0 file;
- a `1.0.0` file is migrated through the whole chain: empty `wallJunctions`
  and `wallRings` (1.0.0 → 1.1.0), the roof-opening collections (1.1.0 →
  1.2.0), then `surfaceRegions` (1.2.0 → 1.3.0). Its walls
  keep their stated extents, so it compiles to exactly the geometry it
  compiled to under 1.0.0 (same per-wall bounds and volumes, same triangle
  count);
- a file stating an older version but already carrying a newer version's
  collections is refused (`SCHEMA`, naming the collection), because it would
  be a mislabelled file;
- any other version is refused with `UNSUPPORTED_SCHEMA_VERSION`, naming the
  supported versions. Nothing is ever reinterpreted silently.

## Persistence

`serializeModel(model)` writes canonical JSON: every collection sorted by id,
keys sorted recursively, numbers in JavaScript's shortest round-trip form, two
space indentation, trailing newline. Two models with the same content produce
identical bytes whatever order they were built in. `loadModel(text)` parses,
validates and canonicalizes; `parseModel` throws with the issues listed.
Round-trip tests live in `packages/model/test`, `packages/demo/test`,
`packages/reference-marcowki/test` and `tests/architecture`. Two models are
frozen as fixtures under `packages/model/test/fixtures`: the demo house at
every schema version (`demo-house-1.0.0/1.1.0/1.2.0/1.3.0/1.4.0/1.5.0.json`) and
the Marcówki reference at the current version (`marcowki-ge-1.5.0.json`,
`docs/MARCOWKI_REFERENCE_MODEL.md`) with its earlier freezes
(`marcowki-ge-1.2.0.json`, `-1.3.0.json`, `-1.4.0.json`) kept as migration baselines;
the model and geometry packages load and compile the reference from that
file alone, without the reference package.

## Ids

`nextId(model, kind, requested?)` returns the requested id or
`<prefix>-<n>` with the smallest unused `n` (`wall-1`, `opening-3`, …). No
clock, no randomness: replaying a command list yields the same ids.
