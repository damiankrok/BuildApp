# BuildApp

BuildApp is a semantic 3D building environment. A **Building DSL** of typed
commands constructs a **CanonicalBuildingModel** (the single source of truth);
a **geometry compiler** turns validated model data into tagged triangle meshes;
**BuildWorld** is the React + Three.js editor/viewer that renders and edits
that model. Future reconstruction analyzers issue commands like
`createWallRing`, `createWall`, `cutOpening`, `placeWindow` — never triangles,
and never corner arithmetic: walls are stated on the natural footprint and
junction records let the model resolve exactly-once corner material
(`docs/WALL_TOPOLOGY.md`).

```
Building DSL / semantic commands   packages/commands
            ↓
CanonicalBuildingModel             packages/model
            ↓
Geometry Compiler                  packages/geometry
            ↓
BuildWorld                         packages/editor + apps/web
```

## Layout

| Path | Role | May import |
| --- | --- | --- |
| `packages/model` | versioned schema (Zod), evidence vocabulary, ids, validation, canonical JSON | zod |
| `packages/commands` | Building DSL, `applyCommand`, `BuildingSession` (undo/redo) | model |
| `packages/demo` | the demo house, as a command list | model, commands |
| `packages/geometry` | model → `CompiledScene` (walls with real openings, roofs, fills, slabs, …) | model |
| `packages/verification` | independent oracles: volume, manifold, rays, overlap, plane pitch, storey ring closure | nothing |
| `packages/editor` | framework-agnostic `EditorStore`: command → model → compile → notify | model, commands, geometry, demo |
| `apps/web` | BuildWorld UI (React, Three.js) | editor, model types, geometry types |
| `tests/architecture` | boundary tests that enforce the table above | everything |
| `docs/` | `CANONICAL_BUILDING_MODEL.md`, `BUILDING_DSL.md`, `WALL_TOPOLOGY.md`, `GEOMETRY_COMPILER.md`, `BUILDWORLD.md` | |
| `stage-reports/` | per-stage measured results and browser screenshots | |

## Commands

```
npm install
npm run typecheck        # tsc over packages and the web app
npm test                 # vitest: domain, geometry, editor and architecture tests
npm run build            # typecheck + production build of BuildWorld into apps/web/dist
npm run e2e              # build + Playwright browser verification of the production build
npm run dev              # BuildWorld dev server, http://localhost:5173
npm run preview          # serve the production build, http://localhost:4173
npm run verify           # typecheck + test + build + e2e
```

## Coordinate system

`x` right when looking at the front facade, `y` up, `z` from the front facade
into the building; finished ground floor at `y = 0`; metres and degrees. The
frame is recorded inside every model file. See `docs/CANONICAL_BUILDING_MODEL.md`.

## Operational documents

`APP_SPEC.md` (what BuildApp is and its design rules), `AGENT_PROTOCOL.md`
(how stages are executed) and `PROJECT_STATUS.md` (what exists now).
