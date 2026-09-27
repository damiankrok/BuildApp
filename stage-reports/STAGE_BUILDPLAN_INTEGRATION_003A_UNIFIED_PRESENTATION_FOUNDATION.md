# STAGE BUILDPLAN-INTEGRATION-003A — Unified presentation foundation

BuildApp analyzer and canonical model, with the generic presentation work of
BuildPlan-PC-Legacy, in one Android viewer. Every number below comes from a
test, a file or a command named next to it. The visual evidence is in
`stage-reports/artifacts/integration-003a/` (its `README.md` names every
file).

## Verdict

The BuildApp Android viewer now shows the same BuildApp-produced scene bundle
in three presentations — **MODEL** (unchanged), **CLAY** and **LINE** — with
feature edges, a presentation-only roof covering and neutral, non-shadowing
glass taken from the donor viewer and adapted to BuildApp's compiled scenes.
Nothing upstream of the renderer changed: no model, command, compiler,
mobile-scene or analyzer file was touched, and the shipped bundles are
byte-identical.

**Not claimed:** OWNER visual acceptance. The build environment has no GPU and
no `/dev/kvm`, so the Filament path of CLAY and LINE (their light, shadows,
SSAO and FXAA) has not been seen on a screen. What was verified is everything
up to the GPU, plus a software raster of the exact uploaded buffers.

## A. Source heads verified

| repository | ref | required | found |
| --- | --- | --- | --- |
| `damiankrok/BuildApp` | `claude/buildapp-buildworld-v1-7y6yqh` (local and `origin`, fetched) | `c399a299a9a5034eb0242e51292eb3f7326fb17b` | `c399a299a9a5034eb0242e51292eb3f7326fb17b` |
| `damiankrok/BuildPlan-PC-Legacy` | `main` (local and `origin`, fetched) | `b0e79675c7ebeacf718cd1392f62272fb400418b` | `b0e79675c7ebeacf718cd1392f62272fb400418b` |

The donor was read only: no commit, no branch, no file change; its checkout
was returned to the branch it was on.

## B. Branch

`integration/unified-buildplan-presentation-v1`, created in BuildApp from
`c399a29`. The source branch was not modified and nothing was merged into it.
No donor Git history entered BuildApp.

## The truth boundary this stage kept

```
Source / Evidence ─► CanonicalBuildingModel ─► compiler ─► mobile-scene bundle ─► Android renderer
   (unchanged)            (unchanged)          (unchanged)   (unchanged, byte-identical)   │
                                                                                          ├─ MODEL: as before
                                                     ScenePresentation.of(scene) ◄────────┤
                                                     (derived once per upload, disposable)├─ CLAY: + structural edges, tiles
                                                                                          └─ LINE: + all edges
```

Presentation is derived from the scene's own triangles on the phone and
thrown away with the model. It is not transported (the bundle schema has no
field for it), not written anywhere, and every overlay renderable resolves to
the BuildApp object id whose geometry it was derived from.

## C. Donor feature matrix

Donor paths are under `app/src/debug/java/com/buildplan/app/` of
BuildPlan-PC-Legacy @ `b0e79675`; the commit is the one that last touched the
file (the brief's commits `85ecfa0`, `cc7400a`, `11605f3`, `1cca0d1`,
`6480057`, `0983a71` were each read in `git show`, and the classes were found
and read in full rather than trusted from the messages).

| # | Legacy capability | Exact donor files / classes | Generic? | Depends on Marcówki? | BuildApp equivalent before | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Roof covering / tiles | `presentation/RoofCover.kt` (`RoofCoverStyle`, `RoofCoverSpec`, `RoofCoverBlocker`, `RoofCoverProfile`); `render/filament/RoofCoverMesh.kt` (`RoofCoverGenerator`, `FacetFrame`, `CoverBatch`, `phaseOf`); `FilamentModelRenderer.uploadRoofCover`; values in `reference/visual/MarcowkiVisualPresentation.roofCoverSpec` (`1cca0d1`) | Generator yes (facet-generic); profile no | Profile, module values and blockers are keyed by the reference house's element ids | none (roof = compiled slab) | **ADAPT** — algorithm ported; planes, holes and blockers derived generically; own module values |
| 2 | Feature edges | `render/filament/BuildingRenderMesh.kt` (`MeshAccumulator.featureEdges`, `edgeFaces`, `canonicalVertex`, `positionKey`, `COPLANAR_DOT`, `COLLINEAR_TOLERANCE_METERS`); `FilamentModelRenderer.uploadOutline`, `SURFACE_DEPTH_OFFSET`; `TechnicalMaterial.buildLine` (`cc7400a`, `11605f3`, `6d5d7b2`) | yes | no | web viewer only (`THREE.EdgesGeometry`, angle threshold); Android none | **ADAPT** — same rule on the bundle's triangle soup, plus cross-object shared seams |
| 3 | CLAY | `render/filament/RenderStyle.CLAY`, `FilamentModelRenderer.applyStyle` and its light constants (`11605f3`, `1cca0d1`) | yes | no | a flat-neutral "Clay" style with SSAO, no edges | **ADAPT** — backdrop, sun/ambient balance, SSAO radius/intensity/power, dark ink; a monochrome ladder over BuildApp's semantic groups instead of one colour |
| 4 | LINE / line study | `render/filament/RenderStyle.LINE_STUDY` (`11605f3`) | yes | no | none ("not implemented" in the doc) | **ADAPT** — edges carry the form, no shadows/SSAO; light paper ground with dark ink instead of the donor's dark ground |
| 5 | Glass | `render/filament/GlassPresentation.kt` (`ALPHA` 0.38, `COLOR`, `SELECTED_ALPHA`, `surfaceRoleOf`); `TechnicalMaterial.buildGlass` (premultiplied in shader, no depth write); `uploadMesh` `castShadows(!glass)`; role map `VisualSurfaceRole` by id (`11605f3`) | behaviour yes; role map no | role map is the reference house's | `translucent.mat` (blended, no depth write); glazing a primitive of the object's renderable, which casts shadows; not premultiplied | **PORT** non-shadowing, premultiplied, neutral behaviour; **REJECT** the id-keyed role map and the donor's tint values |
| 6 | SSAO | `FilamentModelRenderer.applyStyle` (`AO_RADIUS_METERS` 0.45, `AO_INTENSITY` 0.9, `AO_POWER` 1.2, quality/lowPass/upsampling HIGH) | yes | no | LOW, radius 0.35, intensity 0.7 / 0.35 (Architectural) | **ADAPT** — radius/intensity/power in CLAY; quality stays LOW (mobile) |
| 7 | FXAA / AA | `FilamentModelRenderer` init (`FXAA` + MSAA 4×) | yes | no | MSAA 4×, AA NONE | **PORT** FXAA in CLAY and LINE (one-pixel lines); MODEL unchanged |
| 8 | Lighting / tone mapping | `FilamentModelRenderer` (`SUN_LUX` 90 000, band-0 SH `AMBIENT_LUX` 28 000, `SHADOW_MAP_SIZE` 2048, 1 cascade, exposure f/16 1/125 ISO 100; Filament default tone mapper) | yes | no | SUN 72 000 lx, 3-band SH at 26 000, default shadow options, same exposure, default tone mapper | **ADAPT** sun and ambient balance in CLAY; **REJECT** the 2048 shadow map (memory and fill cost on a phone; the tile skirt does its job); tone mapping: both use Filament's default — nothing to port |
| 9 | Camera presets | `render/filament/ModelViewPreset.kt` (`FULL_AXON`, `FRONT_SIGNATURE` yaw 335°, `SIGNATURE_FACADE`, `GARAGE_RELATION`, `GLASS_RAILING_CLOSEUP`, focus `NORTH_BALUSTRADE`/`NORTH_FRAME` by id); `OrbitCamera` (field of view on the shorter side; minimum pitch +2°) (`0983a71`, `78777a5`) | concepts partly | the presets are the reference house's views and ids | bounds-based: Whole house, Axonometric, Front/Rear/Left/Right, Top, plans, Stairs, Entrance | **REJECT** the project presets and coordinates; **ADAPT** the generic "fit the narrower side" as *Fit model*, add a true *Isometric*; **REJECT** the +2° pitch floor (changes existing gestures) |
| 10 | Grid / context | `render/filament/PresentationGrid.kt` (1 m minor, 5 m major, margin 0.55, 2 cm drop) (`9c2374d`) | yes | no | a bounds-derived 1 m grid | **REJECT** the port (the existing grid is equivalent); grid ink now follows the mode |
| 11 | Selection highlight | `FilamentModelRenderer.setSelectedElement` (base colour replaced, glass at 0.55), `pick` through glass | yes | no | emissive blue + outline box, glazing not in the pick pass | **KEEP** BuildApp's; the selected object's edges take the highlight; every overlay maps to the object id |
| 12 | Window frame / mullion | `presentation/OpeningFrame.kt` (`OpeningFrameSpec`, `OpeningFrameProfile` by id), `render/filament/OpeningFrameMesh.kt` (bars; mullions every `maxLeafWidth`) (`6480057`) | bars yes; mullions no | profile keyed by the reference house's ids | canonical `WINDOW_FRAME`, `WINDOW_MULLION` (explicit, schema 1.2.0), `DOOR_FRAME` compiled from the model | **REJECT** — BuildApp already draws canonical frames; mullions from a leaf-width rule would invent a sash division no model stated |
| — | Decomposition profile | `presentation/DecompositionProfile.kt` (`11605f3`) | no | keyed by the reference house's ids | semantic layer modes over storeys and roof kinds | **REJECT** |
| — | Runtime material compiler | `render/filament/TechnicalMaterial.kt` via `filamat-android` | — | no | committed `.filamat` compiled by `matc` 1.75.1 | **REJECT** — no new material was needed: premultiplication and depth offset are parameters |

## D. Files ported / adapted

New, pure JVM (no Filament, no Android; `tests/architecture/presentation.test.ts` enforces it):

- `apps/android/app/src/main/java/com/buildplan/preview/presentation/FeatureEdges.kt` — edge classification (`EdgeClass` BOUNDARY / CREASE / INTERNAL_SEAM / SHARED_SEAM), tiers, per-object groups, per-class batches, the drawn-set rule.
- `.../presentation/RoofCover.kt` — `RoofCoverSpec` (display assumptions, validated), `CoverPlane` (planes found in the compiled triangles, coverage read off them), `RoofCover` (the adapted generator), `RoofCoverBatch`, `TileDrop`.
- `.../presentation/PresentationMode.kt` — `PresentationMode` (MODEL / CLAY / LINE), `PresentationLook` (per-mode backdrop, light, shadows, SSAO, FXAA, ink, grid, depth offset, glazing shadows), `StudyPalette` (monochrome ladder, neutral premultiplied glass, tiles).
- `.../presentation/ScenePresentation.kt` — the per-upload overlay set and `PresentationStats`.

Changed:

- `render/FilamentModelRenderer.kt` — per object: opaque and translucent renderables over one buffer pair; one covering renderable per roof; edge line renderables (class batches and per-object groups); `setState` applies the mode (parameters and entity add/remove only); `applyLook`.
- `render/RenderStyle.kt` — comment only.
- `scene/ViewerState.kt` — `presentation` + `withPresentation`; `scene/Visibility.kt` — `classOf`.
- `ui/Controls.kt`, `ui/PreviewScreen.kt`, `ui/PreviewViewModel.kt`, `ui/Viewport.kt` — the **Mode** menu in the existing tool row; Style marked MODEL-only; mode kept across a model switch; viewport width for *Fit model*.
- `camera/ViewPresets.kt`, `camera/OrbitCamera.kt` — *Fit model*, *Isometric*, an optional aspect for fitting (every older preset unchanged; tested).
- `docs/ANDROID_MODEL_PREVIEW.md` — presentation modes, settings table, presets, limitations.

Tests: `FeatureEdgesTest`, `RoofCoverTest`, `PresentationModeTest`, `PresentationTruthBoundaryTest`, `PresentationFixtures`, `evidence/PresentationRaster` + `evidence/PresentationEvidenceTest` (opt-in), `TestScenes.fixture`; `tests/architecture/presentation.test.ts`.

Nothing in `packages/`, `apps/web`, `apps/analyzer-api`, `apps/local-analyzer`, the assets, the materials, the manifest or Gradle changed.

## E. Semantic-truth invariants

| invariant | held by |
| --- | --- |
| The asset bytes, the parsed bundle (re-encoded), every uploaded position and tangent and the scene bounds are identical before and after deriving every presentation and applying every mode × style × layer, for all five shipped scenes; `contentHash` unchanged | `PresentationTruthBoundaryTest` |
| The presentation is a function of the bundle alone (two loads → identical edges and tiles) | `PresentationTruthBoundaryTest`, `FeatureEdgesTest`, `RoofCoverTest` (determinism) |
| One derivation serves every mode; CLAY's lines ⊆ LINE's; MODEL draws none | `PresentationTruthBoundaryTest` |
| Every overlay answers with an object id of the scene it came from; a covering batch belongs to an object with roof parts, one per roof | `PresentationTruthBoundaryTest`, `RoofCoverTest` |
| The bundle schema carries no presentation field; the exporter and `Bundle.kt` know none | `PresentationTruthBoundaryTest`, `tests/architecture/presentation.test.ts` |
| Every inked segment lies on a side of its own object's triangles (no invented line) | `FeatureEdgesTest` |
| Tiles stand 6–54 mm above their own plane, project onto its real surface, never over a cut hole or a chimney footprint | `RoofCoverTest` |
| A mode switch changes no selection, isolation, layer or style; visibility is identical in every mode | `PresentationModeTest` |
| Derived once in `setModel`; `setState` only toggles and re-parameterises | `tests/architecture/presentation.test.ts` |
| No project name, donor reference coordinate, benchmark dimension, donor class, donor package or runtime material compiler in the ported code | `tests/architecture/presentation.test.ts` (mutation-checked: injecting `7.45` and `rarytas` fails it) |
| No legacy analyzer or domain in production | same test; the app's dependencies are unchanged |

Out of scope and untouched, as the brief requires: Money, Cost, Budget,
Stage, documents, photos, Room persistence, legacy navigation, legacy
analyzer, human verification, room matching, quantity takeoff, checklists,
AS-BUILT.

## F. Renderer modes implemented

| setting | MODEL (before = after) | CLAY | LINE |
| --- | --- | --- | --- |
| Surfaces | the Style menu (Construction / Clay / Architectural) | monochrome warm-neutral ladder by semantic group | near-white, a whisper of the ladder |
| Backdrop | sRGB `#12151a` | linear 0.58 grey | sRGB 0.86 paper |
| Sun / ambient intensity | 72 000 lx / 26 000 | 90 000 lx / 48 000 | 30 000 lx / 60 000 |
| Shadows | on (default map) | on (default map) | off |
| SSAO | LOW, r 0.35, i 0.7 (0.35 Architectural), p 1.0 | LOW, r 0.45, i 0.9, p 1.2 | off |
| Anti-aliasing | MSAA 4× | MSAA 4× + FXAA | MSAA 4× + FXAA |
| Feature edges | none | STRUCTURAL (palette `SOFT` groups), ink `0.05/0.055/0.06 @ 0.70` premultiplied | STRUCTURAL + DETAIL, ink `0.02/0.022/0.026 @ 0.88` |
| Roof covering | no | yes | no |
| Glazing | as before (casts and receives shadows, not premultiplied) | neutral grey, α 0.40, premultiplied, no shadows | α 0.22, premultiplied, no shadows |
| Surface depth offset | 0 | 1 (edges win the depth test) | 1 |

The mode is state (`ViewerState.presentation`), survives rotation and model
switches, and is chosen from **Mode: …** in the existing tool row.

## G. Roof-cover result

Generator adapted from the donor's `RoofCoverGenerator`: per plane, a frame
from the normal (steepest ascent = world up projected on the plane), courses
on a gauge dividing the slope exactly, aligned columns, a 5 × 2-vertex curved
tile with a rounded tail and a tilt, trimming to the surface, a minimum
width, separating-axis blockers, one batch per roof. Adapted:

- **Planes are found, not stated.** Upward faces of `ROOF` / `ROOF_PLANE`
  parts, pitched 12°–75°, not `FLAT_ROOF`, grouped by plane.
- **The surface is the triangles.** Coverage on a course line is the union of
  the plane's triangles' crossings, so holes the compiler cut (rooflights, a
  penetration, a dormer) are respected exactly; a tile is proved on the
  surface at its ends, every outline bend and midpoints, or left out
  (`OFF_SURFACE`) — never clipped.
- **Blockers by part type**, not by id: `CHIMNEY`, `ROOFLIGHT_FRAME`,
  `ROOFLIGHT_GLASS`, grown by a 3 cm flashing gap. An opening's reveal is not a
  blocker (a dormer's reveal would strip the dormer's own roof — found on the
  03G dormer fixture and fixed).
- **A tail skirt** (8 triangles) so courses read without the donor's 2048
  shadow map; trimmed slivers that would stand as fins are skipped.
- **Module**: 0.30 × 0.42 m, exposure 0.33, tail round 0.045, camber 0.022,
  lift 0.012, step 0.02 (max relief 54 mm) — a generic display assumption,
  deliberately not the donor's module for its reference house.

| scene | roof batches | planes | tiles | triangles | left out (narrow / off surface / blocked) |
| --- | --- | --- | --- | --- | --- |
| marcowki-auto-v3 | 1 | 2 | 1 266 | 20 256 | 35 / 47 / 28 |
| second-house | 1 | 2 | 1 728 | 27 528 | 0 / 12 / 0 |
| demo | 1 | 2 | 1 212 | 19 392 | 0 / 0 / 12 |
| fixture-roof-dormer-gable | 4 (main front, main rear, two dormer planes) | 4 | 1 338 | 21 281 | 0 / 74 / 0 |

The flat garage roofs of both houses stay plain. Selecting a tile selects the
roof; *Roof off* removes every tile with the roof (layers sheets).

## H. Edge / glass / Filament result

**Edges.** Per object, every side of every opaque triangle, split at every
scene vertex lying on it, is classified. On auto-v3: 672 boundary, 2 249
crease, 3 485 internal seams (not drawn), 859 shared seams (drawn only while
the continuing neighbour is hidden) → 3 780 segments. Class batching
(`Visibility.classOf`) means a whole-model view draws at most 28 line
renderables for auto-v3, and `FeatureEdgesTest` proves the batched draw
equals the per-object rule in every layer mode, under isolation and with a
selection. Visual continuity across layers: `*-layers.png`.

**Glass.** Glazing now has its own renderable per object (14 on auto-v3) so a
mode can stop it casting and receiving shadows without affecting the frame;
in CLAY and LINE it is premultiplied neutral grey. MODEL keeps the old
behaviour as the baseline. Glazing is not in Filament's pick pass, so a tap
goes through to the frame or the wall.

**Filament settings, before → after.** "Before" is the MODEL column of the
table in F, and MODEL still applies exactly those values
(`PresentationModeTest`); "after" is CLAY and LINE. No setting changes while
MODEL is active.

## I. Same-model evidence

`stage-reports/artifacts/integration-003a/`:

- `marcowki-auto-v3-{modes,layers,close-clay,close-line}.png` — the BuildApp
  analyzer's Marcówki output (bundle `5567f325…`).
- `second-house-{modes,layers,close-clay,close-line}.png` — the second
  regression house, run live for this stage through
  `npm run analysis:second-house` (model `88c514f5af227d2e…`, identical to the
  03G regression record; bundle `029f181e…`, identical to the analyzer's own
  `sceneContentHash`). Rendered through the same parser, scene, presentation
  and camera path as the shipped scenes; the bundle stays outside the
  repository.
- `demo-*`, `fixture-roof-dormer-gable-*` — synthetic.
- `presentation-evidence.json` — the numbers.

Each `*-modes.png`: rows three-quarter / rear three-quarter / front
elevation; columns MODEL / CLAY / LINE. Drawn by `PresentationRaster`, a JVM
raster of the exact uploaded buffers — geometry and ink, **not** Filament's
light, shadows or SSAO.

## J. Test / build matrix

Run in this container (Node 22.22, JDK 21 running Gradle 8.14.3, Android
SDK 35 / build-tools 35.0.0 / NDK 27.3.13750724 / CMake 3.22.1 installed for
the stage; no GPU, no `/dev/kvm`).

| gate | command | result |
| --- | --- | --- |
| TypeScript typecheck | `npm run typecheck` | **pass** |
| Schema / model, compiler, architectural assemblies, mobile-scene (incl. bundle ↔ compiler parity), analyzer, reconstruction, architecture tests | `npm test` | **1 458 passed, 5 skipped, 1 failed** of 1 464 — the failure is `apps/analyzer-api/test/worker.test.ts › runs the job in its own thread…` (`fetch failed` / `ECONNRESET`), which **fails identically on the untouched base commit `c399a29`** in this container (full-suite run in a separate worktree), passes 3/3 when run alone on this branch, and is in the analyzer HTTP API that this stage does not touch. CI run 49 had it green on GitHub runners. |
| New generalization guard + existing Android / second-house boundaries | `npx vitest run tests/architecture/presentation.test.ts tests/architecture/android.test.ts tests/architecture/second-house.test.ts` | **34 / 34 pass** (the new guard mutation-checked) |
| Web build | `npm run build` | **pass** |
| Android unit tests | `npm run android:test` (`./gradlew testDebugUnitTest`) | **309 test cases, 0 failures, 1 skipped** (the opt-in evidence renderer); 285 `@Test` methods, 241 before this stage. New: `FeatureEdgesTest` 12, `RoofCoverTest` 14, `PresentationModeTest` 12, `PresentationTruthBoundaryTest` 5 |
| Android build | `npm run android:assembleDebug` | **pass** — four APKs + `VERSION.txt` in `apps/android/app/build/preview-apks/`, signed with the preview key (`6e48fac4…`); permissions unchanged (`INTERNET` + AndroidX's own signature-level receiver permission, checked with `aapt dump permissions`); the same three `.filamat` materials; no fixture or evidence file shipped |
| Analyzer fixtures, Marcówki | the sealed candidates replay inside `npm test` (candidates, mobile-scene parity, styling parity) | pass |
| Analyzer, second house | `npm run analysis:second-house -- --url <second-house URL> --out <scratch> --expect COMPLETED` | **COMPLETED** in 318 s; model `88c514f5af227d2e11adcd8b41e12281e052ee8b925f6459ee53b1c9447017e0` (= the 03G regression record), scene `029f181e…` |
| Device / emulator smoke test | — | **not run**: no `/dev/kvm` (an x86_64 emulator needs hardware acceleration) and no arm64 host |

New tests by requirement:

| brief requirement | test |
| --- | --- |
| roof-cover generic fixture test | `RoofCoverTest` — synthetic gable at four yaws, flat vs pitched, a cut hole, a chimney through an uncut roof, a triangular hip facet, the 03G dormer fixture, winding, relief, budget, determinism |
| no-canonical-mutation test | `PresentationTruthBoundaryTest` — asset bytes, re-encoded bundle, uploaded buffers and `contentHash` unchanged across every mode × style × layer |
| edge-classification test | `FeatureEdgesTest` — box, free panel, split wall, T-junction, shared seam across objects and layers, overlapping band, tiers, lines lie on own triangles, batching exact in every state |
| presentation-mode state test | `PresentationModeTest` |
| no-project-hardcode guard | `tests/architecture/presentation.test.ts` |
| serialization / input equality | `PresentationTruthBoundaryTest` (bundle JSON and schema field list), plus the existing mobile-scene determinism and parity tests |

## K. Performance evidence

From `presentation-evidence.json` (`ScenePresentation.stats` and the drawn
set of each mode with every layer on and nothing selected). "Renderables" are
Filament entities in the scene, i.e. draw batches before per-primitive
splitting.

| scene | renderables before this stage | MODEL now | CLAY | LINE | triangles MODEL / LINE | triangles CLAY | line segments CLAY / LINE |
| --- | --- | --- | --- | --- | --- | --- | --- |
| marcowki-auto-v3 | 119 | 133 | 138 | 140 | 5 110 | 25 366 | 1 703 / 2 921 |
| second-house | 78 | 89 | 92 | 92 | 2 672 | 30 200 | 1 049 / 1 793 |
| demo | 58 | 72 | 77 | 78 | 2 332 | 21 724 | 686 / 1 384 |
| fixture-roof-dormer-gable | 26 | 29 | 35 | 32 | 744 | 22 025 | 423 / 565 |

- **MODEL** gains one renderable per object that has both glazing and opaque
  parts (the glazing split, +11 to +14); nothing else changes in MODEL — no
  overlay is in the scene.
- **Roof covering**: +19 392 to +27 528 triangles, only in CLAY, in ONE
  renderable per roof (four on the dormer fixture, one per roof object). The
  donor's own budget for its reference house was ≤ 25 000 triangles; the
  second house's larger roof exceeds that at 27 528 (1 728 tiles over two
  30° planes of 83.8 and 84.2 m²). A phone GPU draws tens of thousands of triangles per frame
  trivially; the shadow pass draws them a second time in CLAY.
- **Feature edges**: in a layer mode at most 7 line renderables are drawn
  (class batches); the 99–217 per-object groups are uploaded but only enter
  the scene for isolation or a selection.
- **GPU memory** (vertex + index bytes): auto-v3 model 490 560 B; covering
  +774 792 B; edges +241 920 B (both the batches and the per-object copies).
  Second house: 256 512 / +1 056 096 / +137 024 B. About 1 MB per model.
- **Load time**: deriving edges and covering on the JVM took 57–427 ms per
  scene over several runs (the upper figures while other builds ran in
  parallel); it runs once, at model upload, on the main thread. Not measured
  on a phone.
- **Frame time**: not measurable here (no GPU). A mode switch writes material
  and view parameters and adds or removes at most a few dozen entities; it
  never uploads a buffer (`tests/architecture/presentation.test.ts`).
- **APK**: arm64 30 058 346 B; the stage adds Kotlin only (no asset, no
  material, no dependency).

## Known limitations

- **No GPU run.** CLAY and LINE were never rendered by Filament here. Light
  values (sun/ambient per mode), SSAO, FXAA over lines, the depth offset of
  the surfaces under the ink, and shadowing of the tiles are chosen from the
  donor's device-proven values and BuildApp's own, but are unverified on a
  screen. A follow-up FIX stage after the owner's phone check is likely, as
  it was after 01M.
- **Premultiplied glass is an assumption about Filament's transparent
  blending** (documented as premultiplied); if the phone shows CLAY glass too
  dark or too light, the two alpha values in `StudyPalette` are the lever.
- **Shared seams are decided per scene, not per view**: a crease against an
  exposed face beside a flush neighbour (a zero-thickness panel on a wall
  top) is suppressed while the neighbour is shown.
- **Tiles do not follow valleys or hips of intersecting roofs** beyond what
  the plane's own triangles say; where a dormer roof meets the main roof the
  courses of the two meet in a sawtooth (dormer fixture close-up).
- **The skirt and module are display assumptions**, the same on every roof.
- The derivation runs on the main thread at model upload (JVM: 57–254 ms for
  the scenes above; a phone may take a few times that).
- The existing fixture's front wall pokes through its roof near the eave; LINE
  inks that line because the geometry is there (MODEL shows it too). Not a
  presentation defect, and not changed here.

## M. OWNER visual-check instructions

### Get the APK

Pushing `integration/unified-buildplan-presentation-v1` does not start CI by
itself (the workflow runs on pushes to `main`, `claude/**` and
`orchestrator/**`), and this branch never replaces the `preview-latest`
download (that job publishes only from `main` and the source branch). So:

1. GitHub → `damiankrok/BuildApp` → **Actions** → **BuildApp CI** →
   **Run workflow** → branch `integration/unified-buildplan-presentation-v1`
   → Run. (A run was started this way for this stage; see L.)
2. When the **Android / APK** job is green, open the run → **Artifacts** →
   `buildplan-model-preview-apks` (a zip): take
   `BuildPlan-Model-Preview-arm64-v8a-debug.apk` (or the universal one).
3. Install over the current preview: copy it to the phone and open it, or
   `adb install -r BuildPlan-Model-Preview-arm64-v8a-debug.apk`. Same preview
   key, `versionCode` 1000 + run number, so it updates in place. To go back to
   `preview-latest` afterwards, install it with `adb install -r -d` (a
   downgrade), or wait for the next source-branch build.

Local alternative: `npm ci && npm run android:assembleDebug` on this branch
(JDK 17+, Android SDK 35, NDK 27.3.13750724, CMake 3.22.1) →
`apps/android/app/build/preview-apks/`.

### Compare

In the app: **Model** (top strip) chooses the building, **Mode** (tool row)
chooses MODEL / CLAY / LINE, **Views** and **Layers** work in every mode.

1. **Marcówki** — Model → *Marcówki (auto v3)* (the BuildApp analyzer's
   candidate). Views → *Whole house*; switch Mode MODEL → CLAY → LINE. Repeat
   with Views → *Front*, *Rear*, *Isometric*, *Fit model* (portrait and
   landscape).
2. **Second house** — Analyze link → Analyzer: Local → the second house's
   project link (the 03Y2G one) → Open model; then the same four views in
   MODEL / CLAY / LINE. (Its bundle is the one this stage rendered: scene
   `029f181e…`, if the page has not changed.)
3. **Roof tiles** — CLAY, zoom onto the roof: courses, the gaps around
   chimneys and rooflights, the verge and ridge. Tap a tile: the inspector must
   say *roof*. Layers → *Roof off*: no tile may remain.
4. **Glass** — CLAY and LINE, look through windows and the glass railing at
   the sun side: no dark pane-shaped shadow on floors or walls behind glass;
   tap a window pane: the window (via its frame) or what is behind it is
   selected, never nothing.
5. **Edges** — LINE and CLAY: no line across a flat facade where two walls
   meet flush, no triangle diagonals; Layers → *Ground* / *Attic*: the
   remaining storey keeps its outline; tap a wall: its lines turn blue.
6. **Camera** — orbit, pinch, two-finger pan in every mode; a mode switch
   never moves the camera or drops the selection.

### Questions for the OWNER

1. Is CLAY materially better than current MODEL?
2. Are roof tiles useful or visually too noisy?
3. Are technical edges too strong / too weak (in CLAY; in LINE)?
4. Does glass read correctly (CLAY, LINE; and is MODEL's shadowing glass
   acceptable as the baseline)?
5. Should LINE remain a product mode or only a development / verification mode?
6. Is the BuildApp viewer now visually strong enough to become the permanent
   renderer host?

Also worth a sentence each: any frame stutter when switching to CLAY on a
large roof, and how long the model takes to open (the overlays are derived
at load).

## L. Commits pushed

COMMITS_PLACEHOLDER

## N. Recommended next stage (not implemented)

**BUILDPLAN-INTEGRATION-003B — owner phone gate and presentation FIX.**
Install this branch's arm64 APK, answer the six questions above on the owner's
phone for Marcówki and the second house, and correct only what the phone
shows (light and ink values, glass alpha, tile module or skirt, edge tiers,
whether LINE stays a product mode), with the same tests and guards. Everything
else in the merge — product shell, costs, stages, documents, verification —
waits until the renderer host is accepted.
