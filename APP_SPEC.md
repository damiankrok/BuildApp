# BuildApp — application specification

> Operational file. Created at the start of STAGE BUILDAPP-00 from the stage
> brief supplied by the external orchestrator. It states what BuildApp is and
> the design rules every stage must respect. It is not a roadmap; the external
> orchestrator owns the roadmap and stage ordering.

## 1. What BuildApp is

BuildApp is a semantic 3D building environment. Its core concept:

```
Building DSL / semantic commands
            ↓
CanonicalBuildingModel
            ↓
Geometry Compiler
            ↓
BuildWorld (3D editor / viewer)
```

Future image/web analyzers reconstruct a house by issuing high-level building
operations (`createLevel`, `createWall`, `cutOpening`, `placeWindow`,
`placeDoor`, `createRoof`, `createRoom`, `createBalcony`, `placeChimney`, …)
instead of generating triangle meshes. BuildApp is the hands and the world
those analyzers will use.

## 2. Design principles

1. **The CanonicalBuildingModel is the source of truth.** Three.js objects are
   never the record. Every rendered triangle is derived from validated model
   data by the geometry compiler, and can be traced back to a semantic object
   id.
2. **Callers of the DSL never see rendering internals.** No Three.js buffer
   geometry, triangle indices, boolean mesh details, React components or
   renderer state leak into the command API.
3. **One production path.** The viewer renders only what the compiler produces
   from the model. No UI component invents walls, windows or roofs on its own.
   Architecture tests enforce this so that good geometry can never again live
   outside the real path (the failure the reference research repository
   suffered).
4. **Real openings.** A structural opening removes wall material. A window or
   door painted on an intact wall is a defect. Window and door fills occupy
   the opening as separate semantic objects.
5. **Semantic ownership.** Window → Opening → Wall, Door → Opening → Wall,
   Room → Level, Wall → Level, Roof → Level/Building. Every object has a stable
   id that survives save/load.
6. **Uncertainty survives.** Every object can carry evidence / provenance
   metadata with the vocabulary `SOURCE_EXACT`, `SOURCE_CORROBORATED`,
   `SOURCE_DERIVED`, `GEOMETRIC_INFERRED`, `VISUAL_INFERRED`, `ASSUMED`,
   `UNRESOLVED`. Future inference systems must never be forced to throw
   uncertainty away.
7. **Validation, not silent repair.** Invalid references and impossible
   geometry produce useful errors. Nothing is repaired silently.
8. **Deterministic persistence.** Saving the same model twice produces
   byte-identical JSON; loading it compiles to the same building.

## 3. Coordinate system and units

- `x` = right when looking at the front facade
- `z` = away from the front facade, into the building
- `y` = vertical (up)
- finished ground-floor level: `y = 0`
- canonical length unit: metres; persisted angles: degrees

The frame and units are recorded explicitly inside every persisted model.
Taken literally this triple is a left-handed frame; the model keeps it exactly
as specified and the viewer adapter mirrors `z` when building the Three.js
scene (see `docs/CANONICAL_BUILDING_MODEL.md`).

## 4. Technical stack

- TypeScript-first npm-workspaces monorepo
- `packages/model` — CanonicalBuildingModel, Zod schemas, validation,
  canonical serialization (no React, no Three.js)
- `packages/commands` — Building DSL / typed command layer, session with
  undo/redo (no React, no Three.js)
- `packages/demo` — the demonstration building, built only through commands
- `packages/geometry` — geometry compiler: model → tagged triangle meshes
  (no React, no Three.js)
- `packages/verification` — independent geometry oracles used by tests
- `packages/editor` — framework-agnostic editor store (session + selection +
  visibility + recompile pipeline)
- `apps/web` — BuildWorld: React + Three.js editor/viewer
- Vitest for domain/geometry/architecture tests, Playwright for browser
  verification

## 5. Minimum semantic vocabulary

Building, Level/Storey, Room, Wall, Slab, Roof (gable, flat), Opening, Window,
Door, Stair placeholder, Chimney, Balcony/Loggia/Terrace, Railing, Material
assignment, Constraint, Evidence/provenance metadata.

Doors are semantic objects with a frame, a leaf, a handle, a hinge side and an
open angle so that future animation does not require a new representation.
Windows are semantic objects with a frame and glazing and remain capable of
future sash/pivot behaviour.

## 6. BuildWorld interface

A focused architectural editor with a restrained dark technical UI:

```
+------------------------------------------------------+
| toolbar / view controls                              |
+----------------+-------------------------+-----------+
| scene tree     |                         | inspector |
| / outliner     |       3D viewport       |           |
+----------------+-------------------------+-----------+
| status / model information                           |
+------------------------------------------------------+
```

Camera presets (perspective, front, rear, left, right, top), orbit/pan/zoom,
semantic selection, scene hierarchy, property inspector, hide/show, isolate,
reset visibility, grid, axes, hide/show roof, isolate storey, show all. Edits
made in the inspector update the model first, then recompile geometry, then
update the viewport.

## 7. Out of scope for the foundation

Website scraping, OCR, image segmentation, computer-vision reconstruction,
camera solving, LLM/VLM integrations, photogrammetry, Marcówki reconstruction,
databases/user accounts, cloud infrastructure, photorealistic rendering and
BIM/IFC compatibility belong to later orchestrated stages.
