# STAGE BUILDAPP-01M — ANDROID BUILDWORLD MODEL PREVIEW APK

Bounded mobile-viewer stage: an installable Android APK that shows the CURRENT
Marcówki model natively, with the interaction quality of the owner's earlier
BuildPlan prototype. Not the Android product; not BUILDAPP-02.

## Identity

| | |
| --- | --- |
| branch | `claude/buildapp-buildworld-v1-7y6yqh` |
| starting HEAD | `2949580af66f4d7ec848793a9469763afc4209f5` (matched the orchestrator's expected HEAD) |
| implementation commit | see `git log`; this report's commit is the final HEAD |
| model schema | `buildapp.canonical-building-model` **1.3.0**, unchanged by this stage |
| mobile bundle schema | `buildapp.mobile-scene-bundle` **1.0.0** (new, versioned separately) |

## Architecture

```
Building DSL                      packages/commands
        ↓
CanonicalBuildingModel  1.3.0     packages/model            ← source of truth
        ↓
Geometry compiler                 packages/geometry         ← the only geometry kernel
        ↓
CompiledScene
        ↓                    ↘
BuildWorld (web)              MobileSceneBundle 1.0.0       packages/mobile-scene   ← derived
apps/web                            ↓
                              scenes/*.scene.json  (APK asset)
                                    ↓
                              Filament renderer               apps/android
```

No geometry is authored on the mobile path. `buildMobileSceneBundle` calls
`compileBuilding` and re-encodes the result; the Android app renders that and
nothing else. There is no second CanonicalBuildingModel and no second compiler
in Kotlin.

### New / changed

| Path | Role |
| --- | --- |
| `packages/mobile-scene/src/types.ts` | `MobileSceneBundle` 1.0.0, flattened meshes, object/material/level metadata |
| `packages/mobile-scene/src/bundle.ts` | model + `compileBuilding` → bundle |
| `packages/mobile-scene/src/describe.ts` | semantic object → preformatted inspector rows (keeps the schema out of Kotlin) |
| `packages/mobile-scene/src/serialize.ts` | canonical JSON, sha256 content hash, loader that refuses a corrupt asset |
| `packages/mobile-scene/scripts/{scenes,export-scenes}.ts` | the scene registry and `npm run mobile:export-scenes` |
| `apps/android/**` | the Gradle build, Kotlin sources, Filament materials, Kotlin tests |
| `tests/architecture/android.test.ts` | the guards below |
| `docs/ANDROID_MODEL_PREVIEW.md` | full documentation |

## Android application

| | |
| --- | --- |
| application id | **`com.buildplan.preview`** — deliberately not `com.buildplan.app` |
| namespace | `com.buildplan.preview` |
| label | `BuildPlan Model Preview` |
| versionName / versionCode | `0.1.0-preview` / `1` |
| minSdk / targetSdk / compileSdk | **26** / **35** / **35** |
| required feature | OpenGL ES 3.0 |
| permissions | none declared; the merged manifest carries only the signature-level `com.buildplan.preview.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` that AndroidX adds for targetSdk 33+. No INTERNET, storage, location or camera. |
| orientation | portrait and landscape (`fullUser`) |
| AGP / Gradle / Kotlin | 8.7.3 / 8.14.3 (wrapper committed) / 2.0.21 |
| Compose | BOM 2024.12.01, Material 3 |
| Filament | **1.75.1** (`filament-android` only; no gltfio, no filament-utils) |
| kotlinx-serialization | 1.7.3 |

Filament 1.76.x was the newest release but requires `compileSdk 37`, which AGP
8.7.3 does not support; 1.75.1 is the newest that builds against compileSdk 35
and is what is pinned. The `.filamat` packages were recompiled to match, and an
architecture test now checks that correspondence (see below).

## Mobile scene bundle

`npm run mobile:export-scenes`:

| scene | model | meshes | triangles | objects | asset | content hash |
| --- | --- | --- | --- | --- | --- | --- |
| **marcowki** | `marcowki-ge` 1.3.0 | **178** | **4480** | **127** | 452 kB | `3998e33c218ec889bc085953920d5f4545b9ad072c342d0b89a4dde334daa4e3` |
| demo | `demo-house` 1.3.0 | 88 | 2332 | 58 | 174 kB | `1427a5d897859302d1e947461c86c115f3bfd952f6630e828fdf0608a401f31f` |

Marcówki model content hash: `a983f6cad2c00ef04d80ab23a30c2baf865efd59c015be086c9f63a352c9b82a`.
Scene bounds (model frame): x −0.005…12.05, y −0.32…7.950003543150256, z 0…14.6.
Compiler diagnostics: **none** for either scene.

The hash is deterministic and content-addressed: rebuilding from an unchanged
model rewrites identical bytes, collection order does not reach it, and the
order scenes are exported in does not either. The exporter proves determinism
on every run before it exits.

## Coordinate transform

One conversion, in `scene/ModelFrame.kt`:

```
render.x =  model.x
render.y =  model.y
render.z = -model.z
each triangle's vertices emitted a, c, b
```

The model frame (x right, y up, z into the building) is left-handed; Filament
is right-handed, so z is mirrored and the winding swapped in the same step —
without the swap every outward face would be back-facing. Bounds do not map
componentwise: mirroring z exchanges min and max on that axis. The front facade
therefore ends up at the largest render z, which is why yaw 0 is the front
elevation.

Proven by test against the shipped bundles, not against stored numbers:

- x passes through untouched, vertex for vertex — left/right are not swapped
- per-object depth reverses exactly once, and the front-most object ends up
  nearest a yaw-0 camera — front/rear are not mirrored
- y passes through untouched
- **all structural solids enclose a positive volume in the render frame**
  (47 in Marcówki, all positive) — winding and back-face culling are correct
- the topmost roof face's outward normal points up (exactly cos 40° on the
  pitched roof, 1.0 on the flat garage roof)
- the staircase still rises, and its travel is the model's travel with z
  mirrored once and nothing else
- a mirror without the re-wind is shown to invert a face, so the test is not
  vacuous

## Rendering

Filament, one **entity per semantic object**, one primitive per geometry part.
`View.pick()` returns an entity which maps directly to `objectId` — no name
parsing. The building is never merged into one anonymous mesh.

Three purpose-written materials (`app/src/main/materials/*.mat`, compiled to
`.filamat` and committed): `technical` (lit opaque), `translucent` (lit blended,
glazing) and `line` (unlit, grid and selection box). Lighting is a directional
sun with shadows plus spherical-harmonic ambient irradiance — no IBL asset, so
the app stays offline and small. 4× MSAA; SSAO at LOW quality, which is what
makes the depth of a window reveal readable. Flat shading throughout, with a
per-triangle tangent frame packed as the quaternion Filament's `TANGENTS`
attribute wants.

### Styles

**Construction** (default) keeps every distinction the model makes — wall,
wall reveal, roof, roof reveal, glazing, mullions, frames, door leaf/panel/
handle, slab, stair, railing post/rail/infill, chimney, balcony, room floor,
surface region — and prefers the model's own material colour where the model
states one. **Clay** flattens all opaque surfaces to one neutral while glazing
stays readable.

The palette is checked by test against `apps/web/src/viewport/scene-adapter.ts`,
colour and opacity, so the same building reads the same way on phone and
desktop. Line-study is **not** implemented (it needs real feature-edge
geometry); it was optional and is reported missing rather than faked.

## Gestures

| Input | Effect |
| --- | --- |
| one finger drag | orbit |
| pinch | zoom about the focus |
| two fingers dragged together | pan |
| tap | select the semantic object, immediately |
| double tap on the selected object | isolate + frame |

Selection never waits for a double-tap timeout. Pitch clamps to −85°…89° (a
plan view is reachable, the house can never turn over); distance clamps to
roughly 8 %…14× the scene radius. Panning scales with distance. Any touch
interrupts an in-flight preset transition. Every gesture has a button
alternative; touch targets ≥ 48 dp; state is named in labels, not colour-coded;
Reset and Details are always visible; the system's reduced-motion setting turns
camera transitions into jumps.

## Visibility

All · Roof off · Ground · Attic · Cutaway · Isolate selection · Show all.

Implemented by adding and removing entities from the Filament scene — no
recompilation, no model mutation, fully reversible. Because Filament's pick
pass only sees what the scene contains, **hidden geometry is unpickable**.
"Lowest storey" comes from the bundle's `levels` list, so the filters are
generic rather than Marcówki-specific.

## Camera presets

Whole house · Axonometric · Front · Rear · Left/West · Right/East · Top ·
Ground plan · Attic plan · Stairs · Entrance, plus **Frame selection** and
**Reset**.

Elevations and plans use Filament's **true orthographic projection**, not a
narrow-FOV approximation. One zoom scalar drives both projections (the ortho
extent is the perspective frustum height at the focus distance), so switching
does not change apparent size. Every preset goes through the same
`OrbitCamera.frame` manual navigation uses.

Stairs and Entrance resolve generically: the stair with the most geometry, and
— among lowest-storey doors that have a real `DOOR_LEAF` — the one nearest the
front facade. On Marcówki that selects `stair-main` and `og-front-entrance-leaf`
and correctly rejects the sectional garage door, which has `DOOR_PANEL` and no
leaf. Changing style or visibility never resets the camera; only Reset does.

## Selection and inspector

Emissive highlight on the object's own surfaces **plus** a line box around its
bounds (two channels, not colour alone); the highlight colour is not reused for
any status meaning. Selection survives camera movement and style changes and is
cleared only when the selected object becomes hidden. The bottom-sheet
inspector shows label, kind, id, storey, material, the preformatted facts from
the bundle, extent, geometry parts, triangle count, relationships and
evidence/provenance — all produced on the TypeScript side, so Kotlin never
parses the model schema.

## Tests and gates

All run on this commit.

| gate | result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm test` | **379 passed** (40 files) — was 317 at the starting HEAD |
| `npm run build` | PASS |
| `npm run e2e` | **14 passed** (Playwright) |
| `npm run audit:marcowki` | **AUDIT PASS** |
| `npm run audit:marcowki:facades` | 47 features: 36 pass, 9 deviation, 2 not modelled, 0 not found; worst delta 0.185 m (unchanged from BUILDAPP-01A) |
| `npm run mobile:export-scenes` | PASS, deterministic |
| `npm run android:test` | **89 Kotlin unit tests passed** |
| `npm run android:assembleDebug` | PASS |

New TypeScript tests (62): 20 bundle determinism/metadata, 23 compiler parity,
19 architecture guards (+ the material-version guard).

New Kotlin tests (89): bundle parsing and six corrupt-asset modes; the
coordinate conversion, winding and tangent frames; the geometry contract above;
visibility modes and reversibility; selection survival, isolation and
pickability; orbit/zoom/pan/reset/frame and their clamps; preset resolution and
orthographic projection; both render styles and sRGB; and scene upload shape.

### Parity proof

`packages/mobile-scene/test/parity.test.ts` compares the bundle against
`compileBuilding` output for both scenes on modelId, mesh count, triangle
count, object count, bounds, semantic object ids, per-object geometry parts,
per-level ownership, diagnostics, every mesh tag, and **every triangle
coordinate** — before and after passing through the asset text. The oracle is
the compiler; no Android or TypeScript test contains a second set of expected
Marcówki coordinates. The exported assets on disk are checked to be today's
models, so a stale export cannot ship.

### Architecture guards (§24)

All present and passing, and each was checked to be non-vacuous:

1. no wall geometry reimplemented in Kotlin ✓
2. no roof geometry reimplemented ✓
3. no opening cutting reimplemented ✓ (also: no stair layout)
4. no Marcówki-specific constants — the app names no building, and its
   dimensions, taken from the model at test time, appear in no Kotlin literal ✓
5. the export uses `@buildapp/geometry` and `compileBuilding`; `packages/mobile-scene`
   depends on exactly `@buildapp/model` and `@buildapp/geometry` ✓
6. the export preserves every semantic object id, mesh for mesh ✓
7. the Android app loads the derived bundle, and no mesh file (glb/obj/fbx/…)
   ships in the APK ✓
8. no scraping/OCR/analyzer/network/database dependency in Gradle or Kotlin ✓
9. no network permission ✓
10. application id is not `com.buildplan.app` ✓
11. web BuildWorld untouched: `apps/web` imports nothing mobile, has no
    uncommitted change from this stage, and still renders the same compiled
    scene ✓

Plus two guards this stage's own near-misses motivated: only `ModelFrame.kt`
may negate a z coordinate, and the committed `.filamat` packages must match the
pinned Filament version (this one caught a real mismatch when Filament was
moved from 1.76.1 to 1.75.1).

## APK

Built by `npm run android:assembleDebug` → `apps/android/app/build/preview-apks/`:

| file | size | SHA-256 |
| --- | --- | --- |
| **BuildPlan-Model-Preview-arm64-v8a-debug.apk** | 13 290 256 B (12.7 MiB) | `8bc00dcc54684373e2499378c8368adbbd089cbcbcb395667715e06a01e8bc31` |
| BuildPlan-Model-Preview-universal-debug.apk | 19 171 746 B (18.3 MiB) | `ab5767fb0f51146337a123e3b40092e817847c058497bb38d28d36884649e0ad` |
| BuildPlan-Model-Preview-armeabi-v7a-debug.apk | 12 514 804 B | `8533d5dafd631cc4a0263b331e0dd0178e9091be94821074b7168f82ddfa852c` |
| BuildPlan-Model-Preview-x86_64-debug.apk | 13 584 466 B | `dad4d006c4c0d671759b8df208584d27d3991be4b01740033aa3c06da4d1705e` |

Verified with `aapt2` and `apksigner` on the arm64 artifact:

- package `com.buildplan.preview`, versionName `0.1.0-preview`, versionCode 1
- minSdk 26, targetSdk 35, compileSdk 35, `uses-gl-es 0x30000`
- native code: `arm64-v8a`, `libfilament-jni.so` present
- signed, Signer #1 `CN=Android Debug, O=Android, C=US`,
  certificate SHA-256 `eeefd0a4933f54aca629de9d0e39a82d6cf2198e7034dc5f65bcc3f540892621`
- bundled assets: `assets/scenes/{index.json,marcowki.scene.json,demo.scene.json}`
  and `assets/materials/{technical,translucent,line}.filamat`
- merged manifest permissions: only the signature-level
  `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`; no INTERNET

### Delivery

**GitHub Release publishing was not available in this environment.** The
session has no `gh` CLI, and the GitHub MCP server exposes only read
operations for releases and tags (`list_releases`, `get_latest_release`,
`get_release_by_tag`, `get_tag`) — there is no create-release or upload-asset
tool. The documented fallback was therefore used:

**`stage-reports/artifacts/android-preview/BuildPlan-Model-Preview-arm64-v8a-debug.apk`**
is committed to this branch (13 290 256 B, SHA-256
`8bc00dcc54684373e2499378c8368adbbd089cbcbcb395667715e06a01e8bc31`), well under
GitHub's 100 MB file limit. Download it from the branch and install with
`adb install -r`, or open it on the phone.

This committed binary is a **temporary owner-preview artifact, not normal
source-control policy**. It should be deleted once a release channel exists, or
once the owner has installed it.

Only the arm64 APK is committed; the universal build (18.3 MiB) can be produced
from the same commit with `npm run android:assembleDebug`.

## Performance notes

Geometry is uploaded once per model load: 127 vertex/index buffer pairs for
Marcówki (one per semantic object, fewer than its 178 compiled meshes), 376 kB
of vertex data in total. Visibility toggles scene membership; style changes
rewrite material parameters; selection touches two objects' emissive and one
line box. No interaction rebuilds geometry, and `setState` returns immediately
when nothing changed, so the per-frame cost on the gesture path is a camera
matrix. The renderer pauses and resumes with the activity, survives surface
loss and recreation (the swap chain is disposable, the uploaded model is not),
and dynamic resolution is enabled. Marcówki is the acceptance model; the tests
assert the buffer shape and size rather than a wall-clock number, since no
device was available to measure on.

## Known limitations

1. **No emulator or device verification, and therefore no Android
   screenshots.** This container has no `/dev/kvm` and no nested virtualisation
   (`vmx`/`svm` absent from `/proc/cpuinfo`), so the Android emulator cannot
   run. The required visual acceptance captures of §18 were **not** produced.
   Web screenshots were deliberately not substituted. Everything verifiable
   without a GPU was verified instead: 89 Kotlin unit tests over the real
   shipped bundles, and structural verification of the built APK. What remains
   unverified by execution is specifically the GPU path — shader compilation,
   the Filament render loop on a real surface, and the on-screen result. **The
   owner's first launch is the first real test of that path.**
2. **Line-study render style not implemented** (optional in the brief); it needs
   feature-edge geometry this stage did not build.
3. **The bundle content hash is not recomputed on the phone** — doing so would
   mean a second canonical-JSON implementation in Kotlin. The app validates
   structural self-consistency and checks the hash against the shipped index;
   compiler parity is proven on the TypeScript side.
4. **AO and shadows are enabled but unmeasured** on real hardware. If they
   prove costly on the owner's phone, both are single-line changes in
   `configureView()`; the interactive model does not depend on them.
5. Filament is pinned to 1.75.1 rather than the newest 1.76.1, because 1.76
   requires compileSdk 37.
6. The preview is read-only: no editing, no persistence, no scene authoring.

## Recommended next bounded step

**Owner visual review of the APK → a targeted FIX stage if the model or the
navigation reads wrong → then resume BUILDAPP-02.**

The specific question the owner should answer on the phone: does the Marcówki
massing look right, are the elevations square, do the roof-off and storey
filters reveal what they should, and does orbit/pinch/pan feel right? Because
no GPU path could be executed here, a FIX stage should be assumed likely rather
than exceptional, and the first thing to check on launch is that the model
appears at all (material loading and the Filament surface) before judging how
it looks.
