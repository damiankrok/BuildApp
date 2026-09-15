# BuildApp — project status

> Operational file. Updated at the end of every stage by the implementation
> agent. The external orchestrator owns long-term direction; this file records
> what actually exists.

## Completed stages

| stage | branch | final commit | result |
| --- | --- | --- | --- |
| STAGE BUILDAPP-00 — BUILDWORLD / SEMANTIC BUILDING EDITOR / BUILDING DSL | `claude/buildapp-buildworld-v1-7y6yqh` | `da01f5d328fc2d4f54aabb6b8fff669508d2d805` | PASS |
| STAGE BUILDAPP-00A — WALL TOPOLOGY / JUNCTIONS / ANALYZER-FRIENDLY WALL RINGS | `claude/buildapp-buildworld-v1-7y6yqh` (same harness-designated branch; no suffix was forced beyond the one recorded in BUILDAPP-00) | implementation `50a46370994e3cad7180857a19b87a9f9979d43f`; docs `a8ac902cc4e74f2102adb5b9e1b56bc341a04cf1`; the final HEAD is the one commit above the docs commit that records these SHAs (see `stage-reports/STAGE_BUILDAPP_00A.md` and `git log`) | PASS |
| STAGE BUILDAPP-01 — MARCÓWKI REFERENCE MODEL THROUGH THE REAL BUILDING DSL | `claude/buildapp-buildworld-v1-7y6yqh` | starting HEAD `0df518186bb61b8a365cd9fc11d68ad875be88ca`; implementation `7a6d6168d44f2c75eb0a6bd0974ed1cda72e4478`; docs: the commit that carries `stage-reports/STAGE_BUILDAPP_01.md` and this row | PASS |
| STAGE BUILDAPP-01A — MARCÓWKI ARCHITECTURAL FIDELITY CLOSURE | `claude/buildapp-buildworld-v1-7y6yqh` | starting HEAD `d40fa39733c80bf0b1e35c2233c8ea8ba0c542b7`; implementation `2de2f26328ec45ad99b47da0d9d956e8bc4d4cf9`; docs: the commit that carries `stage-reports/STAGE_BUILDAPP_01A.md` and this row (the final HEAD, see `git log`) | PASS |

## Current capabilities

- **CanonicalBuildingModel** (`packages/model`): versioned Zod schema
  (`buildapp.canonical-building-model` **1.3.0**), explicit units and world
  frame recorded in every file, stable ids, evidence vocabulary (SOURCE_EXACT …
  UNRESOLVED) per object and per property, referential and geometric
  validation with named codes, deterministic canonical JSON save/load.
  Schema 1.2.0 (BUILDAPP-01) adds raked opening heads (`Opening.head`),
  multi-leaf openings (`Opening.leaves`), explicit window mullions, and the
  `roofOpenings` (ROOFLIGHT / PENETRATION) and `rooflights` collections,
  with codes `FILL_PROFILE_UNSUPPORTED`, `OPENING_LEAF_INVALID`,
  `OPENING_LEAF_LEVEL_MISMATCH`, `OPENING_LEAF_NOT_PARALLEL`,
  `UNKNOWN_ROOF_OPENING`, `ROOF_OPENING_OUTSIDE_HOST`,
  `ROOF_OPENING_CROSSES_RIDGE`, `ROOF_OPENINGS_OVERLAP`,
  `ROOF_OPENING_FILLED_TWICE`, `ROOF_PENETRATION_MISMATCH`.
  Schema 1.3.0 (BUILDAPP-01A) adds real staircases (`Stair` PLACEHOLDER |
  FLIGHTS with FLIGHT / WINDER / LANDING segments and `layoutStair`), slab
  holes (`Slab.holes`, a hole may touch the outline), roof cut modes
  (`RoofOpening.cut` VERTICAL | NORMAL_TO_ROOF), composite doors
  (`Door.assembly` of LEAF / GLAZED / PANEL panels) and the
  `surfaceRegions` collection (a finish band on a wall face with no
  thickness of its own), with codes `SLAB_HOLE_OUTSIDE`,
  `SLAB_HOLES_OVERLAP`, `STAIR_RISE_INVALID`, `STAIR_LAYOUT_INVALID`,
  `STAIR_OUTSIDE_FOOTPRINT`, `DOOR_ASSEMBLY_INVALID`,
  `SURFACE_REGION_HOST_INVALID`, `SURFACE_REGION_OUTSIDE_HOST`.
  **Explicit schema evolution**: 1.0.0, 1.1.0 and 1.2.0 files migrate on load
  through explicit chained steps (empty collections added, one
  `SCHEMA_MIGRATED` warning and one `meta.notes` entry per step, geometry
  unchanged — tested against the frozen 1.0.0/1.1.0/1.2.0 demo files and the
  BUILDAPP-01 Marcówki freeze); a file stating an older version but carrying
  newer collections is refused; other versions are refused
  (`UNSUPPORTED_SCHEMA_VERSION`).
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
- **Building DSL** (`packages/commands`): 27 typed commands — the 25 of
  BUILDAPP-00A plus `cutRoofOpening` and `placeRooflight`; `cutOpening`
  takes `head` (RAKED) and `leaves`, `placeWindow` takes `mullions`.
  `createWallRing` (natural footprint polygon → walls, corner junctions and
  a ring), `createWallJunction`, inline `startJunction` / `endJunction` on
  `createWall`. Removal cascades wall → junctions → rings, roof → roof
  openings → rooflights, chimney → penetrations; a leaf wall's removal
  strips the leaf. `BuildingSession` with undo/redo.
- **Demo building** (`packages/demo`): two storeys, both exterior rings from
  `createWallRing` on the 10 × 8 footprint, interior partition with
  T-junctions, garage wing with corner junctions and a T into the main
  body, gable main roof, flat garage roof, 11 windows, 4 doors, 5 rooms,
  3 slabs, balcony with 3 railings, chimney, stair placeholder — built only
  from commands, no wall endpoint trimmed by a thickness (architecture test).
- **Marcówki reference** (`packages/reference-marcowki`, BUILDAPP-01):
  *Dom w marcówkach (GE)* transcribed from the researched source truth into
  145 Building DSL commands — evidence sources, 58 facts with statuses, the
  one frame transform `z_app = 13.60 − z_ref`, `marcowkiCommands()`,
  `createMarcowkiReferenceBuilding()` (a byte-equal replay), expected
  metrics, a 24-entry unresolved ledger; metric proofs by independent
  oracles (14.60 m depth, 1.00 m recesses, ring closure, twelve real
  facade openings incl. three raked gable windows against the printed
  callouts, 40° roof, rooflights, chimney penetrations, balconies, glass
  balustrades, 18 rooms, 11 interior doors), a 13-item mutation catalogue,
  a frozen fixture the model and geometry packages load and compile
  without the package, and `npm run audit:marcowki`. See
  `docs/MARCOWKI_REFERENCE_MODEL.md`.
- **Geometry compiler** (`packages/geometry`): walls compiled over their
  resolved physical extent (core + skewed end zones on one watertight grid),
  real through-openings including raked heads (head line on grid
  diagonals, sloped reveal) and multi-leaf cuts, flat / polyline /
  roof-following tops evaluated over the physical span (with breaks where
  the soffit crosses the nominal height), gable and flat roofs with
  vertical-prism roof openings (watertight band tiling, reveals) and
  rooflight fills, window (trapezoid under a rake, explicit mullions) and
  door fills, slabs, balconies, railings, chimneys, room markers, stair
  placeholders; every mesh keeps its semantic owner (a corner block belongs
  to exactly one wall; roof reveals carry `hostRoofId`).
- **Verification oracles** (`packages/verification`): volume, manifold, ray
  casting, material runs, `unionMaterialRuns` over several solids,
  shared-volume estimate, plane pitch, the independent storey
  **ring-closure oracle** (`ringClosureReport`: edge and corner probes,
  measured gaps, overlaps, reversed walls), and since BUILDAPP-01
  `depthProbeReport` (recess depth over a grid of rays), `lineCoverage`
  (material along a segment) and `pointInPolygon` (plan adjacency).
- **Editor store** (`packages/editor`): command → model → compile → notify,
  selection, hide/show/isolate (rings and junctions isolate their walls,
  roofs their openings and rooflights), storey isolation, roof toggle
  (hides the roof family), save/load, scene tree with a per-level Topology
  group and roof openings under their roof, `describe()` with a derived
  topology description, a generic `host` and resolved `evidenceSources`.
- **BuildWorld** (`apps/web`): the BUILDAPP-00 editor plus a Topology section
  in the inspector (physical extents, junction resolution, ring closure),
  ring / junction rows in the scene tree, a **model** selector (*Demo
  house* / *Dom w marcówkach (GE)*) that replaces the model in the same
  store, host links and cited evidence sources with locator in the
  inspector. The viewport, adapter, store and generic packages never import
  the reference package (architecture tests).

## Test / build / browser results (STAGE BUILDAPP-01A)

| gate | result |
| --- | --- |
| `npm run typecheck` | clean (packages + web app) |
| `npm test` | 317 passed, 37 files |
| `npm run build` | clean; `apps/web/dist` ≈ 1.0 MB (three 480 KB, app 515 KB, react 12 KB, css 5 KB) |
| `npm run e2e` | 14 passed (Playwright 1.56, Chromium headless, SwiftShader WebGL) against the production build; 13 screenshots in `stage-reports/artifacts/` |
| `npm run audit:marcowki` | AUDIT PASS — 95 checks, every headline metric measured by the oracles |
| `npm run audit:marcowki:facades` | 47 registered elevation features: 36 pass, 9 explained deviations, 2 not modelled, 0 not found, worst 0.185 m |

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
- Roof openings are cut over a plan rectangle on one slope of a gable,
  VERTICAL or NORMAL_TO_ROOF; there is no clearance between a rooflight unit
  and its cut (ledger `rooflight-clearance`). Multi-leaf openings require
  parallel leaves on the same level. Roofs: axis-aligned rectangular gable
  and flat only. Stairs have flights, winders and landings but no
  balustrade, and a slab hole has no upstand along its edge. Surface regions
  are wall-local rectangles on one face (not polygons, not on slabs or
  roofs). Rooms are floor markers. Constraints recorded, not solved.
  Inspector-driven editing only. The model frame is left-handed as specified
  and mirrored by the viewer.
- The Marcówki reference carries its unresolved source evidence in
  `packages/reference-marcowki/src/ledger.ts` (33 entries: the eave datum
  contradiction, the stair's winder count, the entrance panel split, balcony
  and railing heights read off elevations, the garage parapet, the verge
  band and chimney shafts not modelled, and the drift between the two
  published revisions). ARCHON publishes the project in more than one
  revision; `docs/MARCOWKI_SOURCE_REVISION_POLICY.md` states which one the
  reference follows and why, and no published aggregate is allowed to move a
  dimension.

## Recommended technical next step

Guarding: a balustrade that follows a stair's own path (rather than a
straight run) and an upstand along a slab hole's edge. The stair is now a
real staircase and the void a real hole, but neither carries the guarding a
built stair must have, and the attic plan draws a line along the void's north
and west edges. Both are generic capabilities provable on a non-Marcówki
building first. After that, unchanged from BUILDAPP-00A: topology-aware plan
editing (`moveJunction` / `moveWallWithNeighbours`) and rooms derived from
the resolved wall topology, the smallest step between the analyzer-friendly
ring/junction API and an analyzer that emits a full storey plan from a
drawing.
