# BuildApp — project status

> Operational file. Updated at the end of every stage by the implementation
> agent. The external orchestrator owns long-term direction; this file records
> what actually exists.

## Completed stages

| stage | branch | final commit | result |
| --- | --- | --- | --- |
| STAGE BUILDAPP-00 — BUILDWORLD / SEMANTIC BUILDING EDITOR / BUILDING DSL | `claude/buildapp-buildworld-v1-7y6yqh` (the execution harness's designated branch; the brief named `claude/buildapp-buildworld-v1`) | implementation `8a1406e19433dc752202641356fbca50df858f3c`; docs `bd035ebce5c17f25098228b56493ce0bdae0614b`; final HEAD is the one commit above it that records these SHAs (see `git log`) | PASS |

## Current capabilities

- **CanonicalBuildingModel** (`packages/model`): versioned Zod schema
  (`buildapp.canonical-building-model` 1.0.0), explicit units and world frame
  recorded in every file, stable ids, evidence vocabulary (SOURCE_EXACT …
  UNRESOLVED) per object and per property, referential and geometric
  validation with named codes, deterministic canonical JSON save/load.
- **Building DSL** (`packages/commands`): 23 typed commands
  (`createBuilding`, `createLevel`, `createRoom`, `createWall`, `createSlab`,
  `createRoof`, `cutOpening`, `placeWindow`, `placeDoor`, `createBalcony`,
  `createRailing`, `placeChimney`, `createStairPlaceholder`,
  `defineMaterial`, `assignMaterial`, `moveFeature`, `resizeFeature`,
  `setProperty`, `addConstraint`, `removeFeature`, `setEvidence`,
  `addEvidenceSource`, `setModelName`), full re-validation per command,
  `BuildingSession` with undo/redo and a replayable log.
- **Demo building** (`packages/demo`): two storeys, gable main body,
  flat-roofed garage, 11 windows, 4 doors, 5 rooms, 3 slabs, balcony with 3
  railings, chimney, stair placeholder — built only from commands.
- **Geometry compiler** (`packages/geometry`): watertight wall solids with
  real through-openings (windows, floor-level doors, stacked and side-by-side
  openings), flat / polyline / roof-following wall tops (gable ends rise into
  the gable, eave walls die into the soffit on both faces), gable and flat
  roofs as closed solids, window fills (frame ring, glazing, mullions), door
  fills (U-frame, pivoting leaf with hinge side / swing / open angle,
  handle), slabs from polygons, balconies, railings, chimneys, room floor
  markers, stair placeholders; every mesh carries its semantic owner id,
  host wall and opening.
- **Verification oracles** (`packages/verification`): volume, manifold,
  ray casting, material runs, shared-volume estimate, plane pitch.
- **Editor store** (`packages/editor`): command → model → compile → notify,
  selection, hide/show/isolate, storey isolation, roof toggle, save/load,
  scene tree, per-kind editable property specs.
- **BuildWorld** (`apps/web`): dark technical editor with toolbar (six camera
  presets, undo/redo, save/load JSON, demo reload, roofs toggle, storey
  select, show all, grid, axes), scene tree, Three.js viewport with orbit /
  pan / zoom and click picking that resolves meshes to semantic objects,
  property inspector (wall height/thickness/base, opening geometry, window
  and door parameters including open angle, roof pitch/eave/overhang, …),
  status bar.

## Test / build / browser results (STAGE BUILDAPP-00)

| gate | result |
| --- | --- |
| `npm run typecheck` | clean (packages + web app) |
| `npm test` | 75 passed, 10 files (model 11, commands 11, demo 4, verification 4, geometry 26, editor 6, architecture 13) |
| `npm run build` | clean; `apps/web/dist` 872 KB (three 480 KB, app 374 KB, react 12 KB, css 5 KB) |
| `npm run e2e` | 6 passed (Playwright 1.56, Chromium 1194 headless, SwiftShader WebGL) against the production build |

## Known limitations

- No explicit wall-junction records: corner ownership is expressed by wall
  extents (the abutting wall stops at the owner's inner face). Overlapping
  walls are not a validation error; they are caught only by the geometry
  overlap test on the demo.
- The chimney passes through the roof without a roof cut (stated penetration).
- Roofs: axis-aligned rectangular gable and flat only; no hip, mono-pitch,
  roof openings or rooflights. A wall following a roof it is not fully under
  keeps its nominal height outside the roof (warning).
- Slabs have no holes (no stair void); stairs are placeholders; rooms are
  floor markers without adjacency or volume.
- Constraints are recorded and shown, not solved.
- Viewport editing is inspector-driven; there are no drag gizmos.
- The model frame is left-handed as specified and mirrored by the viewer.

## Recommended technical next step

Explicit wall-junction semantics: a `WallJunction` record (BUTT ownership, T
and shared walls) validated at model level with an exactly-once corner
material guarantee and a storey-ring closure check, plus a validation-level
wall-overlap error. This is what lets an analyzer describe walls independently
without hand-trimming their extents, and it is the smallest gap between the
current foundation and a source-driven reconstruction.
