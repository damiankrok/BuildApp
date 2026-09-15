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
CompiledScene
            ↓                ↘
BuildWorld                    MobileSceneBundle      packages/mobile-scene
packages/editor + apps/web          ↓
                              Android model preview   apps/android
```

The Android preview is a **viewer** over derived data: it renders the
compiler's own output and contains no geometry kernel of its own
(`docs/ANDROID_MODEL_PREVIEW.md`).

Upstream of the model there is now a **source analyzer**, which reads a
project's published drawings and records what was seen in them:

```text
URL → SourcePackage → SourceObservationGraph → hypotheses → solver → Building DSL
      └─────────── observation only, no geometry ────────┘   └─ future stage ─┘
```

An observation is a 2D reading on one image, with a confidence, a tolerance, an
extractor and a sentence of evidence. Nothing in the analyzer produces a mesh, a
metre or a DSL command, and a vision model can only answer in that vocabulary —
`docs/SOURCE_PACKAGE.md`, `docs/SOURCE_OBSERVATION_GRAPH.md`,
`docs/VISION_REASONER.md`.

## Layout

| Path | Role | May import |
| --- | --- | --- |
| `packages/model` | versioned schema (Zod), evidence vocabulary, ids, validation, canonical JSON | zod |
| `packages/commands` | Building DSL, `applyCommand`, `BuildingSession` (undo/redo) | model |
| `packages/demo` | the demo house, as a command list | model, commands |
| `packages/reference-marcowki` | the Marcówki reference specimen: evidence sources, facts, command generation, expected metrics, unresolved ledger (`docs/MARCOWKI_REFERENCE_MODEL.md`) | model, commands |
| `packages/geometry` | model → `CompiledScene` (walls with real openings, roofs, fills, slabs, …) | model |
| `packages/verification` | independent oracles: volume, manifold, rays, overlap, plane pitch, storey ring closure | nothing |
| `packages/editor` | framework-agnostic `EditorStore`: command → model → compile → notify | model, commands, geometry, demo |
| `apps/web` | BuildWorld UI (React, Three.js) | editor, model types, geometry types, the demo and reference factories (toolbar only) |
| `packages/mobile-scene` | `CompiledScene` → deterministic `MobileSceneBundle` JSON asset for the native mobile viewer (derived data only) | model, geometry |
| `apps/android` | `BuildPlan Model Preview`: native Android viewer (Kotlin, Compose, Filament) over the exported bundles | nothing in this table — it reads the asset |
| `packages/source-common` | canonical JSON, pure SHA-256, deterministic ids, normalized 2D geometry | zod |
| `packages/source-cv` | deterministic computer vision over decoded rasters; knows nothing about buildings | source-common |
| `packages/source-package` | the one acquisition path: safe fetching, adapters, decoding from bytes, variants, roles, sealing (`docs/SOURCE_PACKAGE.md`) | source-common, image decoders |
| `packages/source-observations` | the SourceObservationGraph: what was SEEN, in source-native 2D (`docs/SOURCE_OBSERVATION_GRAPH.md`) | source-common, zod |
| `packages/source-vision` | provider-neutral `VisionReasoner` and schema-constrained visual tasks (`docs/VISION_REASONER.md`) | source-observations |
| `packages/source-analyzer` | extractors, depth reasoning, stair reading, cross-view relations, debug overlays | every source-* package |
| `packages/source-metrics` | what a drawing STATES: numeric OCR, dimension chains, the level ladder, frame registration, the sealed `MetricEvidenceSet` (`docs/METRIC_EVIDENCE.md`) | source-common, source-cv, source-observations |
| `packages/reconstruction` | hypotheses, fusion, constraint classes, the solver, the sealed `ReconstructionCandidate`, the projection audit, evaluation (`docs/PRIMITIVE_RECONSTRUCTION.md`, `docs/RECONSTRUCTION_SOLVER.md`) | model, commands, source-* |
| `packages/synthetic-drawings` | complete synthetic sheets for a house that exists only in the fixture, rendered to real PNG bytes | source-common, source-cv |
| `packages/candidates` | sealed candidates as data; every viewer replays the program rather than re-solving | model, reconstruction |
| `tests/architecture` | boundary tests that enforce the table above | everything |
| `docs/` | `CANONICAL_BUILDING_MODEL.md`, `BUILDING_DSL.md`, `WALL_TOPOLOGY.md`, `GEOMETRY_COMPILER.md`, `BUILDWORLD.md`, `MARCOWKI_REFERENCE_MODEL.md`, `ANDROID_MODEL_PREVIEW.md`, `SOURCE_PACKAGE.md`, `SOURCE_OBSERVATION_GRAPH.md`, `VISION_REASONER.md`, `METRIC_EVIDENCE.md`, `PRIMITIVE_RECONSTRUCTION.md`, `RECONSTRUCTION_SOLVER.md` | |
| `stage-reports/` | per-stage measured results and browser screenshots | |

## Commands

```
npm install
npm run typecheck        # tsc over packages and the web app
npm test                 # vitest: domain, geometry, editor and architecture tests
npm run build            # typecheck + production build of BuildWorld into apps/web/dist
npm run e2e              # build + Playwright browser verification of the production build
npm run audit:marcowki   # measured source parity of the Marcówki reference model (independent oracles)
npm run audit:marcowki:facades  # four-facade orthographic comparison against the registered elevation readings
npm run dev              # BuildWorld dev server, http://localhost:5173
npm run preview          # serve the production build, http://localhost:4173
npm run verify           # typecheck + test + build + e2e
```

### Source analyzer

```
npm run source:acquire        -- <url> --out pkg.json --cache .cache      # seal a project's public sources
npm run source:acquire        -- <url> --cache .cache --offline           # replay the same package with no network
npm run observations:extract  -- pkg.json --cache .cache --out graph.json --overlays out/
npm run observations:audit    -- graph.json                               # non-zero exit on any validation error
npm run observations:marcowki                                             # the benchmark, against the reference model
```

A live vision pass needs a key and nothing else:
`ANTHROPIC_API_KEY=… npm run observations:extract -- pkg.json --cache .cache --live --record fixtures/`.
Without one the extractors still run and the run reports that no provider
answered, rather than pretending one did.

### Reconstruction

```
npm run reconstruct -- --url <project url> --slug <name> --label "<name>"   # acquire, analyse, read, solve, seal
npm run reconstruct -- --package pkg.json --graph graph.json --slug <name>  # the same from sealed inputs
npm run reconstruct:marcowki                                                # evaluation, on the sealed artefact
npm run reconstruct:no-reference                                            # the anti-cheating boundary, proved by execution
```

`reconstruct` writes the metric evidence, the hypothesis set, the candidate,
the DSL program, the model and the projection audit as JSON. The candidate is
sealed against four input hashes and replays to its model byte for byte;
BuildWorld and the mobile exporter both load it by replaying that program,
never by running a solver of their own.

### Android model preview

```
npm run mobile:export-scenes     # CanonicalBuildingModel -> apps/android/.../assets/scenes
npm run android:test             # Kotlin unit tests (no device or emulator needed)
npm run android:assembleDebug    # debug APKs in apps/android/app/build/preview-apks/
```

Needs a JDK 17+ and an Android SDK (`ANDROID_HOME`, or
`apps/android/local.properties` with `sdk.dir=…`); the Gradle wrapper is
committed and no Android Studio installation is involved. Install the result
with `adb install -r BuildPlan-Model-Preview-arm64-v8a-debug.apk`, or copy it
to the phone and open it. The app is `com.buildplan.preview`, declares no
permissions, works offline, and coexists with an older `com.buildplan.app`
build. See `docs/ANDROID_MODEL_PREVIEW.md`.

## Coordinate system

`x` right when looking at the front facade, `y` up, `z` from the front facade
into the building; finished ground floor at `y = 0`; metres and degrees. The
frame is recorded inside every model file. See `docs/CANONICAL_BUILDING_MODEL.md`.

## Operational documents

`APP_SPEC.md` (what BuildApp is and its design rules), `AGENT_PROTOCOL.md`
(how stages are executed) and `PROJECT_STATUS.md` (what exists now).
