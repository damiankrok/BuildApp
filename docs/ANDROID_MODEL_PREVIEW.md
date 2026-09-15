# Android model preview

`BuildPlan Model Preview` is a small native Android app whose only job is to
let the owner look at the current BuildApp model on a phone: orbit it, take the
roof off, tap a window and read what it is.

It is a **viewer**, not a second BuildApp. It contains no geometry kernel, no
analyzer, no editing and no network access.

```
Building DSL                       packages/commands
        ↓
CanonicalBuildingModel   1.3.0     packages/model          ← the source of truth
        ↓
Geometry compiler                  packages/geometry
        ↓
CompiledScene
        ↓
MobileSceneBundle        1.0.0     packages/mobile-scene   ← derived data
        ↓
scenes/*.scene.json      asset     apps/android/app/src/main/assets
        ↓
Filament renderer                  apps/android
```

## Why a mobile bundle exists, and why it is derived

The Android app cannot run the TypeScript compiler, so something has to cross
the language boundary. The choice is *what*: semantics, or triangles.

Sending semantics would mean teaching Kotlin the CanonicalBuildingModel — wall
topology, roof pitch, opening cutting, stair layout — which is a second
geometry kernel by another name, and the one failure this architecture exists
to prevent. So the boundary is the compiler's own output: the phone receives
triangles that are already tagged with the semantic object they belong to, plus
inspector rows that were already formatted on the TypeScript side.

The consequences are deliberate:

- **The bundle is never authored.** `buildMobileSceneBundle` compiles the model
  with `@buildapp/geometry` and re-encodes the result. It adds no fact the
  model did not already state.
- **It is versioned separately** (`buildapp.mobile-scene-bundle@1.0.0`) so the
  asset layout can change without touching the model schema, and a model schema
  bump cannot silently change what a phone reads.
- **It is content-addressed.** `contentHash` is the sha256 of the bundle's
  canonical JSON. The same model always produces the same bytes, so re-running
  the export is a no-op in git and the hash identifies exactly which model
  state an APK carries. The app shows the first 8 characters in its status
  line.
- **The model stays the only source of truth.** If the bundle and the compiler
  ever disagree, the bundle is wrong. `packages/mobile-scene/test/parity.test.ts`
  compares them triangle by triangle, for every shipped scene, against the
  compiler itself rather than against a stored table of expectations.

### The three scenes

| key | what it is |
| --- | --- |
| `marcowki` | the hand-built Marcówki reference model |
| `marcowki-auto` | the **automatic reconstruction candidate**, replayed from its sealed program |
| `demo` | the BuildApp demo house |

The candidate is built by `modelOf('marcowki-auto')`, which replays the sealed
`ReconstructionCandidate` and checks the model comes back byte for byte. The
exporter does not run a solver, and neither does the phone: what ships in the
APK is the building that was sealed and evaluated, not whatever a solver
running on a laptop produced that afternoon.

It is a candidate and looks like one on screen only if you know: it has 80
meshes to the reference's 178, no staircase at all — the solver refused to
invent one — and a simpler roof. `stage-reports/STAGE_BUILDAPP_03.md` §9 lists
what it does not know.

### What is in a bundle

| Field | What it carries |
| --- | --- |
| `generatedFrom` | model id, name, schema version, and the hash of the canonical model JSON |
| `scene` | the `CompiledScene`: every mesh with its `objectId`, `objectKind`, `part`, `levelId`, `solidId`, host/opening links, structural flag, material id, and its triangles flattened to 9 numbers each |
| `levels` | the storeys, ordered by the model's own index, so "the lowest storey" is generic |
| `objects` | per semantic object: label, kind label, storey, material, relationships and preformatted `label: value` inspector rows, evidence, geometry parts, triangle count, bounds |
| `materials` | the model's materials: id, name, `#rrggbb`, opacity |
| `contentHash` | sha256 of the canonical JSON of everything above |

Triangles are flattened (`positions: number[]`, 9 per triangle) rather than
nested objects purely for size; the flattening is lossless and applies no
transform, which `trianglesOf` and the parity tests both check.

`objects[].facts` is what keeps Kotlin ignorant of the schema: "Sill: 0.9 m" is
computed by `packages/mobile-scene/src/describe.ts` from the model, and the
phone only lays it out.

## Coordinate conversion

There is exactly **one** conversion in the app, in
`scene/ModelFrame.kt`:

```
render.x =  model.x
render.y =  model.y
render.z = -model.z
vertices of each triangle are emitted a, c, b
```

The model frame is `x` right, `y` up, `z` *into* the building — taken literally
a left-handed frame. Filament, like OpenGL, is right-handed, so `z` is
mirrored. Mirroring one axis reverses handedness, which would make every
outward face back-facing, so the two trailing vertices of each triangle are
swapped as part of the same conversion. The web viewer's Three.js adapter does
exactly the same thing for the same reason.

Two consequences worth stating, because both have caught bugs:

- **Bounds do not map componentwise.** Model `z ∈ [2, 9]` becomes render
  `z ∈ [-9, -2]`: the minimum and maximum swap.
- **The front facade ends up at the largest render z.** That is why yaw 0 is
  the front elevation, and why "the entrance is the front-most door" is written
  as a maximum rather than a minimum.

`tests/architecture/android.test.ts` fails the build if any Kotlin file outside
`ModelFrame.kt` negates a z coordinate, because scattered sign flips are how a
viewer quietly starts mirroring a building.

The Kotlin tests check the conversion against the shipped bundles directly:
x passes through untouched (left/right are not swapped), depth order reverses
exactly once (front and rear are not mirrored), y is untouched, every
structural solid still encloses a **positive** volume in the render frame
(winding and back-face culling are correct), the topmost roof face still points
up, and the staircase still rises and turns the same way it does in the model.

## Filament architecture

| Piece | File |
| --- | --- |
| Engine, view, lights, materials, upload, picking | `render/FilamentModelRenderer.kt` |
| SurfaceView, swap chain, frame loop, lifecycle | `render/FilamentCanvas.kt` |
| Part palettes and sRGB → linear | `render/RenderStyle.kt` |

**One entity per semantic object.** A door's frame, leaf, glazing and handle
are four compiled meshes but one thing a person can tap, so they become one
Filament renderable with one primitive per geometry part. Filament's `pick()`
returns an entity, and that entity maps straight back to an `objectId` — no
name parsing. Merging the building into one anonymous mesh would destroy
exactly this, so it is not done.

**Materials are this app's own.** Three `.mat` sources in
`app/src/main/materials` are compiled by `matc` into `.filamat` packages under
`assets/materials`: `technical` (lit, opaque), `translucent` (lit, blended, for
glazing) and `line` (unlit, for the ground grid and the selection box). The
compiled packages are committed so an ordinary `./gradlew assembleDebug` needs
no Filament toolchain and no network; regenerate them with
`apps/android/tools/compile-materials.sh` after changing a `.mat`, using matc
from the **same** Filament version as `gradle/libs.versions.toml`.

**Lighting needs no asset.** A directional sun plus ambient light expressed as
spherical-harmonic irradiance — a few coefficients rather than an IBL cubemap —
so the app ships nothing extra and works offline. Anti-aliasing is 4× MSAA;
screen-space ambient occlusion is on at low quality, which is what makes the
depth of a window reveal readable; the sun casts shadows.

Flat shading is used throughout (no vertex is shared between triangles), which
gives the technical read the web viewer also has and lets each triangle carry
its own tangent frame. Filament wants that frame as a quaternion in the
`TANGENTS` attribute; `TangentFrames.fromNormal` builds it, and a unit test
checks that rotating +Z by the quaternion returns the normal it was built from.

## Gestures

| Input | Effect |
| --- | --- |
| one finger, drag | orbit around the current focus |
| pinch | zoom about the focus |
| two fingers, drag together | pan |
| tap | select the semantic object under the finger |
| double tap on the selected object | isolate it and frame it |

Selection is applied on the **first** tap; it never waits for a double-tap
timeout. A second tap on the same object within 300 ms is then read as
"isolate and frame this", on top of a selection the user already saw happen.

Pitch is clamped to −85°…89°, so a plan view is reachable but the house can
never turn over. Distance is clamped between roughly 8 % and 14× the scene
radius, so the camera can neither end up inside the walls nor lose the building
in the distance. Panning scales with distance, so it feels the same at every
zoom. Any touch immediately interrupts an in-flight preset transition.

Every gesture has a button alternative in the tool row, touch targets are at
least 48 dp, and the active view, style and layer are named in the button
label rather than signalled by colour.

## Visibility

Visibility is renderer state: entities are added to and removed from the
Filament scene. Nothing is recompiled, no semantic object is deleted, and
lifting a filter restores exactly what it hid. Because the pick pass only sees
what the scene contains, **hidden geometry is automatically unpickable**.

| Mode | Shows |
| --- | --- |
| All | everything |
| Roof off | everything but roofs, roof openings and rooflights — the attic becomes inspectable |
| Ground | only the lowest storey the model declares |
| Attic | only storeys above the lowest, roof off |
| Cutaway | roof and every storey above the lowest removed, storey-less geometry kept |
| Isolate selection | only the selected object, whatever the mode |
| Show all | back to All |

"Lowest storey" is resolved from the bundle's `levels` list, so this works for
any building rather than for one particular house.

## Camera presets

Whole house, Axonometric, Front, Rear, Left/West, Right/East, Top, Ground plan,
Attic plan, Stairs, Entrance — plus **Frame selection** and **Reset**.

The elevations and plans are **truly orthographic** (`Camera.Projection.ORTHO`),
not a long-focal-length approximation: an elevation with perspective is not an
elevation. The orthographic extent is defined as the perspective frustum's
height at the focus distance, so one zoom scalar drives both projections and
switching between them does not change how big the building looks.

Every preset is just a pose handed to the same `OrbitCamera` the fingers drive,
so a preset can never reach somewhere manual navigation cannot.

Two presets resolve their target from the scene's structure rather than from an
id, so they work for any model:

- **Stairs** — the `stair` object with the most geometry, so a real flight
  always beats a placeholder footprint.
- **Entrance** — among doors on the lowest storey that have a real `DOOR_LEAF`
  (so a sectional garage panel does not qualify), the one nearest the front
  facade.

A preset that also needs a visibility mode to mean anything carries it: Stairs
turns the roof off, Ground plan shows the lowest storey, Attic plan shows the
storeys above it. A plain view preset changes only the camera — switching style
or layers never resets the camera either.

## Semantic picking and selection

`View.pick()` → Filament entity → `objectId`. The selected object is
highlighted two ways at once, because colour alone is not enough: an emissive
blue on its own surfaces, and a line box drawn around its bounds. The
highlight colour is not reused for any status or error meaning.

A selection survives camera movement and style changes. A visibility change
clears it **only** when the selected object has just been hidden — losing a
selection because the roof went off would make the two controls fight each
other. The ground grid answers a tap as "nothing here" (which deselects); the
selection outline answers as "no change", so tapping near the box does not
throw the selection away.

## Building and installing

From the repository root:

```bash
npm install
npm run mobile:export-scenes     # CanonicalBuildingModel -> scene bundles
npm run android:test             # Kotlin unit tests (no device needed)
npm run android:assembleDebug    # debug APKs, collected under their delivery names
```

`assembleDebug` needs a JDK 17+ and an Android SDK; point at the SDK with
`ANDROID_HOME`, or with `apps/android/local.properties`
(`sdk.dir=/path/to/android-sdk`). The Gradle wrapper is committed, every build
dependency is pinned in `apps/android/gradle/libs.versions.toml`, and no
Android Studio installation is involved.

Gradle refuses to build an APK with no scene bundles in it and tells you to run
the export, rather than shipping an empty viewer.

### Output

```
apps/android/app/build/preview-apks/
  BuildPlan-Model-Preview-arm64-v8a-debug.apk     ← the phone artifact
  BuildPlan-Model-Preview-universal-debug.apk     ← if you do not know the ABI
  BuildPlan-Model-Preview-armeabi-v7a-debug.apk
  BuildPlan-Model-Preview-x86_64-debug.apk
```

Install with `adb install -r <file>.apk`, or copy the APK to the phone and open
it (Android will ask to allow installing from that source).

The application id is **`com.buildplan.preview`**, deliberately not
`com.buildplan.app`: the older BuildPlan prototype can stay installed, and a
different signing key on the same id would be a signature conflict rather than
a second app. The two appear as separate apps, `BuildPlan Model Preview` being
the new one.

The manifest declares **no permissions**: no network, no storage, no location,
no camera. The merged manifest in the built APK carries exactly one entry,
`com.buildplan.preview.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`, which AndroidX
adds automatically for targetSdk 33+; it is signature-level, scoped to the app's
own id, grants nothing external and is never shown to the user. There is
nothing to grant on first launch and the app works in flight mode.

minSdk is 26 (Android 8.0) and targetSdk 35; the app requires OpenGL ES 3.0. It
supports portrait and landscape, and an ordinary rotation keeps the camera,
style, visibility and selection because they live in a `ViewModel`.

## Limitations

- **Line-study style is not implemented.** It needs real feature-edge geometry,
  which this stage did not build. Rather than fake it, the app offers the two
  required styles — Construction and Clay — and says so.
- **The bundle's `contentHash` is not recomputed on the phone.** Verifying it
  there would mean a second canonical-JSON implementation in Kotlin, which is
  the duplicated authority this architecture avoids. The app checks the
  bundle's structural self-consistency (schema, version, mesh data against its
  own counts, finite coordinates) and checks the hash against the shipped
  index; parity with the compiler is proven on the TypeScript side, where the
  compiler is.
- **The app is read-only.** It cannot edit the model, and nothing it does can
  change one. That is the stage's scope, not an oversight.
