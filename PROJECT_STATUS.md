# BuildApp — project status

> Operational file. Updated at the end of every stage by the implementation
> agent. The external orchestrator owns long-term direction; this file records
> what actually exists.

## Completed stages

| stage | branch | final commit | result |
| --- | --- | --- | --- |
| STAGE BUILDAPP-00 — BUILDWORLD / SEMANTIC BUILDING EDITOR / BUILDING DSL | `claude/buildapp-buildworld-v1-7y6yqh` | `da01f5d328fc2d4f54aabb6b8fff669508d2d805` | PASS |
| STAGE BUILDAPP-00A — WALL TOPOLOGY / JUNCTIONS / ANALYZER-FRIENDLY WALL RINGS | `claude/buildapp-buildworld-v1-7y6yqh` (same harness-designated branch; no suffix was forced beyond the one recorded in BUILDAPP-00) | implementation `50a4637`; docs and this report in the next commit; the final HEAD is the one commit above the docs commit that records these SHAs (see `stage-reports/STAGE_BUILDAPP_00A.md` and `git log`) | PASS |

## Current capabilities

- **CanonicalBuildingModel** (`packages/model`): versioned Zod schema
  (`buildapp.canonical-building-model` **1.1.0**), explicit units and world
  frame recorded in every file, stable ids, evidence vocabulary (SOURCE_EXACT …
  UNRESOLVED) per object and per property, referential and geometric
  validation with named codes, deterministic canonical JSON save/load.
  **Explicit schema evolution**: 1.0.0 files migrate on load (empty topology
  collections, `SCHEMA_MIGRATED` warning, note in `meta.notes`); other
  versions are refused (`UNSUPPORTED_SCHEMA_VERSION`).
- **Wall topology** (`packages/model/src/topology.ts`): `WallJunction`
  records (CORNER with an owner, BUTT, T) and `WallRing` records; a
  line-arithmetic resolver derives every wall end's physical cut on its outer
  and inner face (owner-through corners exact at any angle, reflex corners
  extended into the notch, butt/T against the host's physical face). Named
  validation: `JUNCTION_GAP` / `JUNCTION_OVERSHOOT` (measured),
  `JUNCTION_PARALLEL_WALLS`, `JUNCTION_SELF_REFERENCE`,
  `JUNCTION_OWNER_NOT_PARTICIPANT`, `JUNCTION_LEVEL_MISMATCH`,
  `ENDPOINT_JUNCTION_CONFLICT`, `BUTT_OFF_HOST`, `T_JUNCTION_POSITION`,
  `WALL_CONSUMED`, `OPENING_IN_JUNCTION_ZONE`, `WALLS_OVERLAP` (undeclared
  plan overlap between walls is now a model error), `RING_DEGENERATE`,
  `RING_NOT_CLOSED`, `RING_LEVEL_MISMATCH`, `UNKNOWN_JUNCTION`, warning
  `JUNCTION_KIND_MIX`. Nothing is repaired.
- **Building DSL** (`packages/commands`): 25 typed commands — the 23 of
  BUILDAPP-00 plus `createWallRing` (natural footprint polygon → walls,
  corner junctions and a ring, deterministic ids, per-edge overrides,
  ownership policy) and `createWallJunction`; `createWall` takes inline
  `startJunction` / `endJunction` so a wall stated from footprint line to
  footprint line enters with its junctions in one validated step. Removal
  cascades wall → junctions → rings. `BuildingSession` with undo/redo.
- **Demo building** (`packages/demo`): two storeys, both exterior rings from
  `createWallRing` on the 10 × 8 footprint, interior partition with
  T-junctions, garage wing with corner junctions and a T into the main
  body, gable main roof, flat garage roof, 11 windows, 4 doors, 5 rooms,
  3 slabs, balcony with 3 railings, chimney, stair placeholder — built only
  from commands, no wall endpoint trimmed by a thickness (architecture test).
- **Geometry compiler** (`packages/geometry`): walls compiled over their
  resolved physical extent (core + skewed end zones on one watertight grid),
  real through-openings, flat / polyline / roof-following tops evaluated over
  the physical span, gable and flat roofs, window and door fills, slabs,
  balconies, railings, chimneys, room markers, stair placeholders; every mesh
  keeps its semantic owner (a corner block belongs to exactly one wall).
- **Verification oracles** (`packages/verification`): volume, manifold, ray
  casting, material runs, `unionMaterialRuns` over several solids,
  shared-volume estimate, plane pitch, and the independent storey
  **ring-closure oracle** (`ringClosureReport`: edge and corner probes,
  measured gaps, overlaps, reversed walls).
- **Editor store** (`packages/editor`): command → model → compile → notify,
  selection, hide/show/isolate (rings and junctions isolate their walls),
  storey isolation, roof toggle, save/load, scene tree with a per-level
  Topology group, `describe()` with a derived topology description.
- **BuildWorld** (`apps/web`): the BUILDAPP-00 editor plus a Topology section
  in the inspector (physical extents, junction resolution, ring closure) and
  ring / junction rows in the scene tree.

## Test / build / browser results (STAGE BUILDAPP-00A)

| gate | result |
| --- | --- |
| `npm run typecheck` | clean (packages + web app) |
| `npm test` | 148 passed, 16 files (model 35: model 11 + topology 19 + migration 5; commands 25; demo 4; verification 11; geometry 41; editor 6; architecture 26) |
| `npm run build` | clean; `apps/web/dist` 892 KB (three 480 KB, app 396 KB, react 12 KB, css 5 KB) |
| `npm run e2e` | 7 passed (Playwright 1.56, Chromium 1194 headless, SwiftShader WebGL) against the production build |

## Known limitations

- Each wall end belongs to at most one junction; three walls meeting at a
  point are a CORNER plus a BUTT/T. Corner ownership is always one wall (no
  mitre record).
- Moving or lengthening a ring wall on its own is refused (its corners would
  gap) and removing a corner junction alone is refused (the walls would
  overlap): topology-aware plan editing (move a corner, move a wall with its
  neighbours) is not implemented; edits are re-creation or thickness /
  height / opening / owner changes, which re-resolve.
- Undeclared overlap detection uses each wall's nominal height range and
  physical plan footprint; roofs, slabs and other elements are not part of it
  (the demo's chimney/roof penetration remains the stated exception in the
  geometry overlap test).
- The chimney passes through the roof without a roof cut. Roofs: axis-aligned
  rectangular gable and flat only. Slabs without holes; stairs placeholders;
  rooms are floor markers. Constraints recorded, not solved. Inspector-driven
  editing only. The model frame is left-handed as specified and mirrored by
  the viewer.

## Recommended technical next step

Topology-aware plan editing: a `moveJunction` / `moveWallWithNeighbours`
command that keeps declared corners and T-junctions satisfied while a wall or
corner moves, plus rooms derived from the resolved wall topology (a T-split
host, a ring's inner polygon) so that room polygons no longer need to be
stated by hand. This is the smallest step between the current
analyzer-friendly ring/junction API and an analyzer that emits a full storey
plan from a drawing.
