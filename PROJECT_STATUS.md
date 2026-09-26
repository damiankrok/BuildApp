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
| STAGE BUILDAPP-01M — ANDROID BUILDWORLD MODEL PREVIEW APK | `claude/buildapp-buildworld-v1-7y6yqh` | starting HEAD `2949580af66f4d7ec848793a9469763afc4209f5`; implementation and docs: the commit that carries `stage-reports/STAGE_BUILDAPP_01M.md` and this row | PASS |
| STAGE BUILDAPP-02 — SOURCEPACKAGE + VISUAL SOURCE OBSERVATION GRAPH | `claude/buildapp-buildworld-v1-7y6yqh` | starting HEAD `dc6407e95f308fedfef064f09582ffa4df230810`; implementation `2b92d1f`; docs `ced70f0` | PASS |
| STAGE BUILDAPP-03 — PRIMITIVE RECONSTRUCTION + METRIC SOLVER | `claude/buildapp-buildworld-v1-7y6yqh` | starting HEAD `ced70f0dba7d32caa32ef726a5118643796a80fe`; implementation `361e466`, `5ab618b`, `fad9f39`, `8524a89`; docs `c1a9872` and the commit that carries this row (the final HEAD, see `git log`) | PASS |
| STAGE BUILDAPP-03M-FIX — ANDROID AUTO CANDIDATE RENDERING | `claude/buildapp-buildworld-v1-7y6yqh` | starting HEAD `f3766237840514fc60178ca6c9bf4f3c9e13ebbd`; CI micro-task `781d6d6`, `13108e5`; implementation and docs: the commit that carries `stage-reports/STAGE_BUILDAPP_03M_FIX.md` and this row | PASS |
| STAGE BUILDAPP-03R1 — IMAGE METROLOGY + PROPORTIONAL FACADE FITTING | `claude/buildapp-buildworld-v1-7y6yqh` | starting HEAD `4505e148cf03197b899d49c5335ed893e013ab1d`; implementation `c4c8816`, `ed83d0d`, `c315a35`, `0ec3291`, `067fd41`, `3ee3277`; docs: the commit that carries `stage-reports/STAGE_BUILDAPP_03R1_IMAGE_METROLOGY.md` and this row | PASS |
| STAGE BUILDAPP-03X — ANALYZER REFOUNDATION AUDIT + MARCÓWKI AUTO V2 | `claude/buildapp-buildworld-v1-7y6yqh` | starting HEAD `d5d6375d8675143730307d71f45c0d940fcd134b`; research `9363d6b`; audit and v2 schemas `13896a1`; pipeline `59d5676`; callouts, gates, apps and CI `7e01828`; fixtures, ridge axis and docs `606c829`; test runner `9f67eb9` (CI run 36057369183 green); docs: the commit that carries this row (the final HEAD, see `git log`) | PASS (owner review is the final gate) |
| STAGE BUILDAPP-03Y — EXTERIOR CLOSURE AND SEMANTIC STYLING | `claude/buildapp-buildworld-v1-7y6yqh` | starting HEAD `31dced4a42a92ad18f446d8dfe870e0c59b95a98`; implementation `1a9f514`, `ba71193`, `1437954`, `74d4646`, `603eb2e` (CI run 36240702093 green; APK artifact 10905870947, versionCode 1029); docs `9de7979` | **PASS — owner-accepted** (Auto v3 reviewed and accepted on the owner's phone) |
| STAGE BUILDAPP-03Y1 — IN-APP LINK ANALYZER + STABLE MOBILE CAMERA | `claude/buildapp-buildworld-v1-7y6yqh` | starting HEAD `9de7979c78468e91ce2ba29438258b527de5ffac`; see `stage-reports/STAGE_BUILDAPP_03Y1_IN_APP_ANALYZER_AND_GESTURES.md` for the commits and CI runs | __03Y1_RESULT__ |

## Current capabilities

- **CanonicalBuildingModel** (`packages/model`): versioned Zod schema
  (`buildapp.canonical-building-model` **1.4.0**), explicit units and world
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
  Schema 1.4.0 (BUILDAPP-03) adds the `linearSolids` collection: a generic
  `LinearSolid` is a rectangular bar between two 3D points with its own
  cross-section basis (`width` seen in elevation, `depth` proud of the host,
  an optional `rollDeg`), hosted on a wall, roof or slab — the primitive a
  facade band, a beam, a portal reveal, a fin or a parapet compiles to, with
  codes `LINEAR_SOLID_DEGENERATE` and `LINEAR_SOLID_HOST_INVALID`.
  **Explicit schema evolution**: 1.0.0, 1.1.0, 1.2.0 and 1.3.0 files migrate on
  load through explicit chained steps (empty collections added, one
  `SCHEMA_MIGRATED` warning and one `meta.notes` entry per step, geometry
  unchanged — tested against the frozen demo files at every version and the
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

- **Mobile scene bundle** (`packages/mobile-scene`, BUILDAPP-01M): a
  separately versioned derived format,
  `buildapp.mobile-scene-bundle` **1.0.0** — the compiler's `CompiledScene`
  re-encoded (triangles flattened losslessly, every mesh keeping its
  `objectId` / `objectKind` / `part` / `levelId` / `solidId` / host / opening /
  structural / material tags) plus the storey list, per-object inspector
  metadata already formatted as `label: value` rows, relationships, evidence
  and materials. Deterministic and content-addressed (sha256 of canonical
  JSON): the same model always writes the same bytes, and collection or export
  order cannot reach the hash. `npm run mobile:export-scenes` writes the
  Marcówki and demo bundles into the Android app's assets. It is DERIVED data
  — the CanonicalBuildingModel remains the source of truth, and
  `packages/mobile-scene/test/parity.test.ts` holds the bundle to the
  compiler's output triangle by triangle for both scenes.
- **Android model preview** (`apps/android`, BUILDAPP-01M):
  `BuildPlan Model Preview`, application id `com.buildplan.preview` (distinct
  from the owner's older `com.buildplan.app`), Kotlin + Jetpack Compose +
  Material 3 + Google Filament 1.75.1, minSdk 26 / targetSdk 35, no
  permissions, fully offline, no account, no database. It renders the exported
  bundle natively: one Filament entity per semantic object (so `View.pick()`
  resolves straight to an `objectId`), Construction and Clay styles with the
  same palette the web viewer uses, translucent glazing, a technical grid, sun
  and spherical-harmonic ambient light, SSAO and shadows. Orbit / pinch-zoom /
  two-finger pan / tap-to-select / double-tap-to-isolate, all with button
  alternatives; visibility modes All, Roof off, Ground, Attic, Cutaway,
  Isolate, Show all, implemented by adding and removing entities (hidden
  geometry is therefore unpickable, and nothing is recompiled); 11 camera
  presets with truly orthographic elevations and plans, Frame selection and
  Reset; a bottom-sheet inspector. Exactly one coordinate conversion
  (`scene/ModelFrame.kt`: mirror z, re-wind each triangle a, c, b), guarded by
  an architecture test. 89 Kotlin unit tests run on the JVM against the real
  shipped bundles, with no GPU. `docs/ANDROID_MODEL_PREVIEW.md`.

- **Source analyzer, layers 1 and 2** (STAGE BUILDAPP-02): six new packages
  that read a project's published sources and record what was SEEN in them.
  Nothing in them produces a Building DSL command, a mesh or a metre.
  - **`packages/source-common`** — canonical JSON, a pure SHA-256, deterministic
    content-addressed ids, normalized 2D geometry. No Node, no DOM.
  - **`packages/source-cv`** — deterministic computer vision over decoded
    rasters: ink and gradient masks, connected components, runs, axis-aligned
    and Hough segments with total-least-squares angle refinement, parallel
    families, rectangles, profiles, silhouettes, slope histograms. 57 tests on
    synthetic pictures with exact expected answers.
  - **`packages/source-package`** — `buildapp.source-package` **1.0.0**: the one
    authoritative acquisition path. Safe fetching (HTTPS only, every resolved
    address classified, redirects re-validated per hop, bounded and anonymous),
    publisher adapters, decoding FROM THE BYTES, variant grouping and selection
    on measured pixels, five independent role dimensions each separately
    UNKNOWN-able, published figures, recorded failures, content hash, offline
    replay from a byte cache. `docs/SOURCE_PACKAGE.md`.
  - **`packages/source-observations`** — `buildapp.source-observation-graph`
    **1.0.0**: coordinate frames per asset variant, observations with pixel and
    derived normalized geometry, separate confidence and positional uncertainty,
    alternatives, relations (depth, topology, direction, cross-view identity),
    conflicts that are never averaged, named gaps, order-independent content
    hash, and a validator that refuses a graph whose coordinates, frames,
    relations, tolerances or ids do not hold together.
    `docs/SOURCE_OBSERVATION_GRAPH.md`.
  - **`packages/source-vision`** — a provider-neutral `VisionReasoner`, narrow
    schema-constrained tasks whose JSON Schema is generated from the observation
    vocabulary, twelve named rejection codes, and three providers: a live
    Anthropic adapter (forced tool use, temperature 0, no prose fallback), a
    recorded-fixture replayer keyed by the bytes it describes, and a null
    provider that admits there is none. No secret in the repository.
    `docs/VISION_REASONER.md`.
  - **`packages/source-analyzer`** — extractors for elevations, plans, sections
    and renders; **depth reasoning** that promotes a band to a
    `LINEAR_VOLUME_CANDIDATE` only on a cue implying a third dimension
    (shadow, visible end face, occlusion break, return face) and records a band
    with only a change of tone as a `SURFACE_REGION`; a **stair reader** that
    reads a run of tread lines, its flights, its winders and its direction mark
    and never infers a staircase from the size of a shaft; cross-view relations;
    and self-contained SVG debug overlays.
- **CLI**: `source:acquire`, `observations:extract`, `observations:audit`,
  `observations:marcowki`. The audit exits non-zero on any validation error.
- **BuildWorld Sources / Observations panel**: a read-only surface showing a
  sealed graph — frames, observations with evidence, tolerance and alternatives,
  conflicts and named gaps. Structurally read-only (no store, no command
  imported) and it does not fetch: a graph arrives as the built-in sample or
  from a file the viewer opens.

## Test / build / browser results (STAGE BUILDAPP-01A)

| gate | result |
| --- | --- |
| `npm run typecheck` | clean (packages + web app) |
| `npm test` | 317 passed, 37 files |
| `npm run build` | clean; `apps/web/dist` ≈ 1.0 MB (three 480 KB, app 515 KB, react 12 KB, css 5 KB) |
| `npm run e2e` | 14 passed (Playwright 1.56, Chromium headless, SwiftShader WebGL) against the production build; 13 screenshots in `stage-reports/artifacts/` |
| `npm run audit:marcowki` | AUDIT PASS — 95 checks, every headline metric measured by the oracles |
| `npm run audit:marcowki:facades` | 47 registered elevation features: 36 pass, 9 explained deviations, 2 not modelled, 0 not found, worst 0.185 m |

## Test / build / browser results (STAGE BUILDAPP-01M)

Run on the final HEAD of this stage:

| gate | result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm test` | 379 passed, 40 files (317 at the stage's starting HEAD) |
| `npm run build` | PASS |
| `npm run e2e` | 14 passed (Playwright) |
| `npm run audit:marcowki` | AUDIT PASS |
| `npm run audit:marcowki:facades` | 47 features: 36 pass, 9 deviation, 2 not modelled, 0 not found; worst delta 0.185 m — unchanged from BUILDAPP-01A |
| `npm run mobile:export-scenes` | PASS; Marcówki 178 meshes / 4480 triangles / 127 objects, bundle `3998e33c…`; demo 88 / 2332 / 58, bundle `1427a5d8…` |
| `npm run android:test` | 89 Kotlin unit tests passed (JVM, no device) |
| `npm run android:assembleDebug` | PASS — arm64-v8a 12.7 MiB, universal 18.3 MiB |

APK verified with `aapt2` and `apksigner`: `com.buildplan.preview`
`0.1.0-preview` (versionCode 1), minSdk 26 / targetSdk 35, OpenGL ES 3.0,
arm64-v8a, debug-signed, scene and material assets bundled, no INTERNET
permission. arm64 SHA-256
`8bc00dcc54684373e2499378c8368adbbd089cbcbcb395667715e06a01e8bc31`.

No emulator or device was available (no `/dev/kvm`, no nested virtualisation),
so there are no Android screenshots and the GPU render path is unverified by
execution. See `stage-reports/STAGE_BUILDAPP_01M.md`.

- **Metric evidence and the reconstruction solver** (STAGE BUILDAPP-03): four
  new packages that turn what was SEEN into a building candidate, and one that
  renders the fixtures they are held to.
  - **`packages/source-metrics`** — `buildapp.metric-evidence-set` **1.0.0**: a
    real numeric OCR (skeleton matching after Zhang–Suen thinning,
    aspect-preserving resampling, gap-maximising de-skew, three page
    orientations with a page-wide vote, per-glyph runners-up and a separate
    *decidedness*), dimension chains solved as a discrete partition by dynamic
    programming against one sheet-wide scale voted in pixels, a ladder of level
    datums fitted as one straight line, and axis-aligned affine registration
    with robust seeded fitting and reported outliers. Sealed against the source
    package's bytes AND the observation graph's content.
  - **`packages/reconstruction`** — `buildapp.structural-layout-hypothesis-set`
    **1.0.0** (BUILDAPP-03R): what the building is MADE OF — storeys, footprint
    regions, masses, attachments, recesses, one roof system per mass, facade
    planes, alternatives, conflicts, named holes and a gate — settled and sealed
    before a wall exists, from a plan decomposition that reads wall bands,
    strikes grid lines on chains and band axes, floods CELLS rather than pixels,
    and treats a hole between two pieces of one wall as the door it is. Then
    `buildapp.primitive-hypothesis-set` **1.0.0**
    and `buildapp.reconstruction-candidate` **1.1.0**: hypotheses with an
    explicit basis per parameter (MEASURED / DERIVED / SCALED / CROSS_VIEW /
    ASSUMED), five-stage fusion that accounts for every sighting it drops,
    HARD / SOFT / UNRESOLVED constraint classes that are never mixed,
    contradictions reported rather than averaged, a deterministic solver with a
    per-step trace, a sealed candidate carrying four input hashes and a
    Building DSL program that replays to its model byte for byte, a
    non-iterative projection audit, and post-seal evaluation reporting
    geometric accuracy and evidence-supported completeness separately.
  - **`packages/synthetic-drawings`** — complete synthetic sheets (plan, four
    elevations, section) for a house that exists only in the fixture, in its
    own typeface, encoded to real PNG bytes by a dependency-free encoder.
  - **`packages/candidates`** — sealed candidates as data; BuildWorld and the
    mobile exporter both load by replaying the program, never by re-solving.
  - `docs/METRIC_EVIDENCE.md`, `docs/PRIMITIVE_RECONSTRUCTION.md`,
    `docs/RECONSTRUCTION_SOLVER.md`, `docs/STRUCTURAL_LAYOUT.md`,
    `docs/OPENINGS_AND_SOLIDS.md`.
  - **`tests/benchmark`** (BUILDAPP-03R) — evaluation as its own workspace. It
    may know which building the sealed candidate is of, because it runs only on
    sealed artefacts and nothing in the production path may import it.

## Where the reconstruction stands (STAGE BUILDAPP-03R)

BUILDAPP-03 produced one slab 12.05 × 14.905 m, one wall ring reused on both
levels, one gable over the whole rectangle at 28.563799°, eight openings and
twenty-four facade strips. BUILDAPP-03R rebuilt structural inference from the
source evidence rather than repairing that box, and the Marcówki candidate is
now:

| | BUILDAPP-03 | BUILDAPP-03R |
| --- | --- | --- |
| bodies | one 12.05 × 14.91 m slab | **two**: 7.90 × 12.61 m main body, 4.15 × 7.51 m attached garage |
| storeys | one ring on both levels | storey 0 over both bodies, storey 1 over the house alone |
| roofs | one gable over the bounding box at 28.563799° | **two**: a 40° gable over the house on the publisher's own specification, a flat roof over the garage as a stated convention |
| openings | 8 | 13, with **12 of the 12** major facade openings recovered (median centre error 0.161 m, height 0.100 m) |
| facade solids | 24 | **2** |
| gate | — | `STRUCTURAL_LAYOUT_ACCEPTED` |

`stage-reports/STAGE_BUILDAPP_03R.md` carries the full report, the §22
benchmark table, the fourteen mutations and the known limitations.

## Where the measuring stands (STAGE BUILDAPP-03R1)

03R left a 0.329 m median error on the reference project's opening widths
that it could not account for. 03R1 built `packages/image-metrology` and
found it: the ink-silhouette extractor had traced all four of that project's
elevations as the ENTIRE IMAGE, 1279 × 596 px, because on a photo-realistic
render it traces the lawn, the trees and the sky along with the house. The
ridge is 485 px tall in a 596 px image, so every height read off those
drawings came out 23% short — invisible, because a silhouette that is wrong
is still a silhouette.

| | 03R | 03R1 |
| --- | --- | --- |
| elevation outline surplus over the bodies beneath it | 4.98, 5.01, 4.45, 4.42 m | **0.00, 0.00, 1.91, 1.53 m** |
| major facade openings recovered | 12 / 12 | 12 / 12 |
| median centre error | 0.161 m | **0.133 m** |
| median width error | 0.329 m | **0.066 m** |
| median height error | 0.100 m | 0.100 m |

Three things it now measures rather than assumes: where a wall actually
stops, by finding the reveal in the drawing instead of where a thickness
test gave up; which way round an elevation reads, from the drawing's own top
edge rather than from a traversal convention that is the wrong way round for
this project; and whether an "elevation" is a line drawing or a render,
which decides how much a single reading of it is worth. On a render a height
is taken only where two independent readings agree, and otherwise the
opening's height is declared unmeasured and named as a hole.

`stage-reports/STAGE_BUILDAPP_03R1_IMAGE_METROLOGY.md` carries the full
report, the per-opening table, the four registered elevations proved from
content, §21's twelve wrong-boundary mutations, three approaches that look
right and are wrong, and what the stage did not do.

## Where the analyzer stands (STAGE BUILDAPP-03X)

03R1 measured the facades and still shipped a candidate with no recesses, no
interior, a roof stopping short of the zones, no stair and heights from
conventions. 03X sealed a source truth v2 first (`research/marcowki-v2/`,
138 items, never imported by production code), audited where each family's
evidence was lost (`docs/ANALYZER_FORENSIC_AUDIT.md`, eleven facts with
file and line), and refounded the analyzer as `packages/reconstruction/src/v2/`
(`npm run reconstruct:v2:marcowki`). Both candidates stay sealed side by side
in `packages/candidates` (`marcowki-auto`, `marcowki-auto-v2`) and both are
selectable on the web and on Android.

| | 03R1 Auto | 03X Auto v2 |
| --- | --- | --- |
| frame | z mirrored against the sheet (z = 0 at the rear wall) | z from the front outer plane, the mirror against 03R stated once |
| roof | over the walled body (12.61 m) | over the zones (z 0..14.60), `coversZones` with its reason |
| recesses / returns | none | four recess readings, eight return walls, terraces on the recess floors |
| interior | none | 31 partitions, 9 doors, 12 rooms, chimney blocks |
| stair | none | U-stair 5+7+5 = 17 risers over 3.06 m, two quarter landings, emitted as FLIGHTS |
| opening heights | conventions | printed callouts on all eleven facade openings (a ring reader with candidate readings resolved by plan gaps and elevations); two heights flagged ambiguous |
| raked heads | none | the three gable windows, from the printed height and the roof soffit |
| roof details | flat garage roof by convention | garage slab and parapet from the section, two chimneys, three rooflights |
| facade | 2 solids | verges, fascias, railings, the portal head, three assemblies |
| cameras | none | three of four perspectives solved and sealed |
| verification | NOT_CHECKED on every silhouette | 28 source-view residuals; a bounded repair that applied nothing and refused nine changes with reasons |
| evidence accounting | none | a ledger over every observation, metric reading, page fact and room; a feature graph with quality L0/L1/L2 |

Evaluated per item against the sealed truth with the truth's own tolerances
and no aggregate score (`stage-reports/artifacts/analyzer-v2/marcowki-v2-evaluation.md`):
masses, recesses, roof, verge, portal and the stair match; openings match in
interval and width everywhere and in height wherever a callout was read
unambiguously; what is PARTIAL is named per property (opening families from
visual cues, open-plan rooms merged, room numbers mostly unread, chimney and
rooflight extents 0.1–0.2 m off, fascia ends short). Gates:
`npm run audit:analyzer-v2` (22 checks), `npm run reconstruct:no-benchmark`
(reference, truth and research physically absent), `tests/architecture/analyzer-v2.test.ts`,
the 100-stripe facade stress test, synthetic fixtures through v2. Overlays,
evaluation, lineage, ledger, quality, residuals and the repair trace are
under `stage-reports/artifacts/analyzer-v2/` and uploaded by CI.
`docs/ANALYZER_V2_ARCHITECTURE.md`, `docs/EVIDENCE_CONSUMPTION.md` and
`docs/FEATURE_IDENTITY_GRAPH.md` describe the design.

## Where the exterior stands (STAGE BUILDAPP-03Y)

The owner's review of Auto v2 named unclean joints, a balcony whose short
side did not end at the building, a railing that should turn, a weak
terrace, incomplete bands and frames, a jagged roof edge and merging
elements. 03Y traced each to its first bad stage
(`docs/MARCOWKI_AUTO_V2_EXTERIOR_FORENSIC_AUDIT.md`) and fixed it in the layer
that owns it; the result is sealed as **Marcówki (auto v3)** beside the
Auto v2 baseline, on the web and on Android.

- **Model schema 1.5.0**: `terraces`; roof `edgeMembers` (verge and fascia
  boards compiled with the roof) and `plateInset` (plates bear into their
  walls); `Railing.path` (railings that turn). The frozen candidates were
  restated without a byte of building changing (`candidates:reseal`).
- **Geometry closure audit** (`packages/geometry/src/closure.ts`): shared
  volume, faces drawn twice, cracks between members that meet, free railing
  ends, terraces off their datum — per pair, with the model's intended
  relation. `npm run audit:exterior` gates Core CI.
- **Assembly closure** in the analyzer (`packages/reconstruction/src/v2/assembly-closure.ts`):
  return snapping and stacking, balcony end conditions (WALL / CARRIES only
  where the elevation draws the band on / FREE at the plan's line / MEETS),
  turning railings, verge depth from the frame, one portal band, terraces
  with the plan's platform, and a facade graph (CONTINUES_TO, TERMINATES_AT,
  TURNS_AT, MEETS_HOST).
- **Semantic styling**: semantic groups and one controlled palette on web and
  Android, tone families read against each render's white point and carried
  through the model's materials, finish runs along the recessed walls,
  Architectural style beside Construction and Clay.

| exterior, closure audit | Auto v2 | Auto v3 |
| --- | --- | --- |
| intersections | 13 (4.30 m³) | 0 |
| exposed gaps | 7 | 0 |
| faces drawn twice | 21 (29.5 m²) | 0 |
| free railing ends | 2 (0.94 m) | 0 |

Per category against the truth set: twelve PASS, OPENINGS and
MATERIAL_READABILITY PARTIAL, none FAIL
(`stage-reports/artifacts/analyzer-v2/marcowki-exterior-closure-evaluation.md`).
The interior findings (the stair against its walls, partitions trimmed short
of undeclared junctions) are left for BUILDAPP-03Z.

## Where the in-app analyzer stands (STAGE BUILDAPP-03Y1)

There is ONE analyzer, and it now runs as a service a phone can call:

- **`@buildapp/analysis-service`** — `runAnalysis` / `runLinkAnalysis`: URL →
  SourcePackage → analyzer v2 → model → compiled scene → MobileSceneBundle,
  verified (replay, bundle round trip, closure audit) and hashed, with real
  stage progress and cancellation. The `reconstruct:v2` CLI is a thin adapter
  over it and still reproduces sealed Auto v3 byte for byte.
- **`apps/analyzer-api`** — the HTTP API of `docs/ANALYZER_API.md`: submit a
  URL, poll nine stages and a real progress value, download the result, the
  scene bytes (sha256-checked), the model and the candidate; cancel. A worker
  thread per job, a bounded queue, a time limit, a filesystem job store that
  survives restarts, rate limits, CORS, HTTPS behind a proxy, no secrets and no
  paths in any response. One container (`apps/analyzer-api/Dockerfile`), a
  Fly.io config and a CI deploy job that runs when the repository has a
  `FLY_API_TOKEN` secret.
- **Web** — the Analyze panel in BuildWorld (same contract).
- **Android** — the Analyzer screen and a verified, persistent cache of
  downloaded scenes beside the bundled ones; `INTERNET` is the one permission
  added (see the 03Y1 report).
- **Camera** — a pure gesture reducer with a pointer-set rebase: a finger
  landing or lifting moves nothing; orbit gain per viewport, not per pixel;
  clamped pinch; 1:1 pan.

The real Marcówki URL completes through the API (177 s locally, 131 s in the
CI container) and yields the sealed Auto v3 building: under the sealed label
and model id the live sources give model `894e50ba…` and the APK's exact
scene. Candidate hashes differ from the sealed one because the publisher's
page HTML changes between fetches (the drawings are byte-identical).

**Deployment is the open item**: no hosting credential exists in this
environment, so no public HTTPS analyzer service is running, and the phone
flow cannot be exercised end to end until one is (steps in
`docs/ANALYZER_API.md` → Deployment).

## Test / build / browser results (STAGE BUILDAPP-03)

Run on the final HEAD of this stage:

| gate | result |
| --- | --- |
| `npm run typecheck` | PASS (packages + web app) |
| `npm test` | **790 passed, 68 files** (737 at the stage's starting HEAD) |
| `npm run build` | PASS |
| `npm run e2e` | **21 passed** — 18 existing plus 3 for the reconstruction candidate |
| `npm run android:test` | PASS |
| `npm run android:assembleDebug` | BUILD SUCCESSFUL; preview APK refreshed |
| `npm run reconstruct:no-reference` | candidate produced with `packages/reference-marcowki` absent from the tree |

Marcówki observation benchmark (`npm run observations:marcowki`): package
`src-m2fa281446a8ca-c0499d9df3` (20 assets, 10 published figures, 18 rooms),
graph `obsgraph-src-m2fa281446a8ca-c0499d9df3-0dff45f229` — 18 frames, 888
observations, 461 relations, 81 named gaps, **138 LINEAR_VOLUME_CANDIDATEs**
carrying a depth cue against 67 bands that carry none. Artifacts, overlays and
the finding-by-finding comparison with the reference model are in
`stage-reports/artifacts/source-observations/`. **LIVE_PROVIDER_NOT_RUN** — no
`ANTHROPIC_API_KEY` in this environment, and `--live` refuses rather than
pretending.

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
- The Android preview (BUILDAPP-01M) was **never executed on a device or an
  emulator**: the build container has no `/dev/kvm` and no nested
  virtualisation, so no Android screenshots exist and the GPU path — shader
  compilation, the Filament render loop on a real surface, the on-screen
  result — is unverified by execution. Everything not requiring a GPU was
  tested (89 Kotlin unit tests over the real bundles, plus structural
  verification of the built APK with `aapt2` and `apksigner`). The owner's
  first launch is the first real test of the render path. The preview is also
  read-only, has no line-study style, and does not recompute the bundle hash
  on the phone (that would be a second canonical-JSON implementation in
  Kotlin); it validates structural self-consistency and the shipped index
  instead.
- The Marcówki reference carries its unresolved source evidence in
  `packages/reference-marcowki/src/ledger.ts` (33 entries: the eave datum
  contradiction, the stair's winder count, the entrance panel split, balcony
  and railing heights read off elevations, the garage parapet, the verge
  band and chimney shafts not modelled, and the drift between the two
  published revisions). ARCHON publishes the project in more than one
  revision; `docs/MARCOWKI_SOURCE_REVISION_POLICY.md` states which one the
  reference follows and why, and no published aggregate is allowed to move a
  dimension.
- **Source analyzer (BUILDAPP-02).** No live vision call has been made (no
  credentials). The published Marcówki plans are 853 px for a 12 m house, so a
  0.27 m stair going is about 9 px while terrain hatch and paving sit at 4 px;
  at that separation a flight cannot be told from a fill pattern, so no
  staircase is read from them and the candidates are recorded with the reason
  each was rejected. No side returns were found on the real loggia (18 named
  gaps say which sides). *(BUILDAPP-03 added the OCR: dimension chains and
  level datums are now valued, and the stair is still refused — see below.)* Openings over-detect on rendered elevations, where
  vertical cladding produces real closed rectangles. The site plan has no
  extractor. Renders are analysed with elevation extractors and their
  measurements corroborate rather than measure. The byte cache is not committed,
  so re-running the benchmark needs one `source:acquire` first.


## Android viewer (STAGE BUILDAPP-03M-FIX)

The phone viewer showed the automatic candidate as a bare roof: the viewport's
frame callback captured the scene open when it was installed, so after
switching models it resolved viewer state against the PREVIOUS building.
Visibility answers with object ids, and the two buildings share exactly one
name (`roof-main`), so one entity reached the Filament scene and no layer mode
could reveal the rest. The renderer now owns the scene it uploaded —
`setState` takes only viewer state — and the visible set is intersected with
the objects that actually carry geometry. Nothing in the reconstruction, the
bundles or the compiled geometry was changed: the candidate's geometry was
verified correct at every step before the GPU, including its winding. Twelve
regression assertions run against the real committed candidate bundle, and an
architecture test fails if the per-frame scene argument ever comes back.

## Known gaps and honest limits (STAGE BUILDAPP-03)

- **The automatic candidate is not final and is not claimed to be.** It gets
  the footprint width and the ridge height exactly, the depth to 2.1 %, and 3
  of the reference's 23 openings. Geometric accuracy 56.3 %,
  evidence-supported completeness 54.3 % — reported separately, never combined.
- **The stair is REFUSED.** One stair symbol was observed and nothing fixes a
  going, a rise, a width or a landing. There is no stair in the candidate and
  the refusal is in the artefact with its reason. The hand-built reference
  stair was not consulted and not copied.
- **The roof is one gable over the whole footprint.** The sources show a more
  complex roof; the derived 28.6° is the pitch that puts the ridge at the
  height the section states, over the span the solver assumed.
- **Facade members have no measured depth.** A view that can see depth says
  they stand proud; nothing says how far. Each is built square in section and
  named as a hole.
- **63 observed openings are unexplained** by the candidate, and 8 detections
  that did not fit the wall they were measured against were refused rather than
  forced.
- **No live vision call has been made** in this stage either: `LIVE_PROVIDER_NOT_RUN`.

## Recommended technical next step

**Now: BUILDAPP-03Y1 — deploy the analyzer service** (owner action: a
hosting account; then the phone gate of §28 of its brief). **Then**, in the
orchestrator's sequence:
**BUILDAPP-03Z — Interior Topology + Semantic Completion** — declared
interior junctions instead of partitions trimmed 15 mm short (the 35
INTERIOR gaps the closure audit reports), the stair against its walls and
its void (0.44 m³ shared with the ground ring wall today), guarding along
the stair and the void, and the finish regions the analyzer does not read
yet (the ground-storey side bands, the rear gable panel, the attic timber
panel). Then **BUILDAPP-04**. The five 03X reader items (door symbols,
rooflight callouts, terrain datum and roof build-up from the section, room
numbers, elevation extents on more than one view) remain open and feed the
same ledger.

The earlier recommendation stands behind those, now largely built:

**BUILDAPP-04 — Camera-aware Source-View Verification + Semantic Repair Loop.**
The three things BUILDAPP-03 leaves on the table want the same tool. The roof
is one gable because nothing decomposed the massing into wings; 63 observed
openings are unexplained because nothing looked back at the drawing to ask what
they were; the facade members have no depth because no view was ever solved for
a camera. A verification pass that renders the candidate into a source view and
reasons about the DIFFERENCE — rather than measuring the agreement once, as the
current projection audit does — turns each of those from a hole into a repair.

Two things would make that loop's job materially easier and can be done
alongside it: a **live vision pass** (the provider path is complete and a key is
all it needs), and **multi-wing massing** in the solver, which is the single
largest source of the completeness gap above.

### Standing engineering items, unchanged by this stage

Owner visual review of the preview APK — committed at
`stage-reports/artifacts/android-preview/BuildPlan-Model-Preview-arm64-v8a-debug.apk`,
now the BUILDAPP-03M-FIX build — remains outstanding; because no GPU path can be
executed in the build environment, a further FIX stage should be assumed likely
rather than exceptional. That assumption has already paid once: BUILDAPP-03M-FIX
exists because the owner's review found the automatic candidate drawing nothing
but its roof.

Guarding: a balustrade that follows a stair's own path (rather than a straight
run) and an upstand along a slab hole's edge. The stair is a real staircase and
the void a real hole, but neither carries the guarding a built stair must have,
and the attic plan draws a line along the void's north and west edges. Both are
generic capabilities provable on a non-Marcówki building first. After that,
unchanged from BUILDAPP-00A: topology-aware plan editing (`moveJunction` /
`moveWallWithNeighbours`) and rooms derived from the resolved wall topology.
