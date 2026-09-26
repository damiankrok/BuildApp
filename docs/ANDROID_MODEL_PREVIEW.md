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

### The scenes

| key | what it is |
| --- | --- |
| `marcowki` | the hand-built Marcówki reference model |
| `marcowki-auto-v3` | the automatic candidate under review: analyzer v2 after the exterior closure of BUILDAPP-03Y (terraces, a turning railing, roof edge members, one fascia band), replayed from its sealed program |
| `marcowki-auto` | the first automatic candidate (BUILDAPP-03) |
| `marcowki-auto-v2` | the analyzer-v2 candidate the owner reviewed (BUILDAPP-03X), kept as the baseline |
| `demo` | the BuildApp demo house |

Each candidate is built by `modelOf(<key>)`, which replays the sealed
`ReconstructionCandidate` and checks the model comes back byte for byte. The
exporter does not run a solver, and neither does the phone: what ships in the
APK is the building that was sealed and evaluated, not whatever a solver
running on a laptop produced that afternoon. The two earlier candidates were
restated under model schema 1.5.0 without changing a byte of the building
(`packages/candidates/src/reseal-log.json`).

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
screen-space ambient occlusion runs at low quality in every style (at half
intensity in Architectural), which is what makes the depth of a window reveal
readable; the sun casts shadows.

Flat shading is used throughout (no vertex is shared between triangles), which
gives the technical read the web viewer also has and lets each triangle carry
its own tangent frame. Filament wants that frame as a quaternion in the
`TANGENTS` attribute; `TangentFrames.fromNormal` builds it, and a unit test
checks that rotating +Z by the quaternion returns the normal it was built from.

## Styles

The **Style** menu offers three. A style only rewrites material parameters on
primitives uploaded once: it never changes, hides or re-uploads geometry, so
no style can hide a geometry defect. The chosen style is kept across a model
switch.

| Style | For | How it draws |
| --- | --- | --- |
| Construction (default) | diagnosis | part colours; the model's own material on walls, roof, trim, slab, terrace, chimney, doors; SSAO on |
| Clay | diagnosis of massing and openings | one neutral on every opaque surface; glazing still translucent; SSAO on |
| Architectural | owner review | one colour per semantic group from the architectural palette; subtle SSAO (half intensity) |

**Architectural** looks up each mesh's `semanticGroup` in the bundle's
`styling.groups` (palette `architectural-v1`). A bundle exported before that
block existed falls back to `ArchitecturalPalette.BUILT_IN` in
`render/RenderStyle.kt`, a copy of `packages/mobile-scene/src/semantics.ts`
that tests on both sides hold equal. The bundle's palette may differ from
the built-in one by tone hints only: a group moved to another rung of the same
palette because the model's own finishes say so (a garage in dark render). A
mesh with no group is placed by its part and material name. The groups are
`WALL_MAIN`, `WALL_SECONDARY`, `WALL_INTERIOR`, `WALL_CLADDING`, `ROOF_MAIN`,
`FLAT_ROOF`, `ROOF_TRIM`, `WINDOW_GLASS`,
`WINDOW_FRAME`, `DOOR`, `GARAGE_DOOR`, `SLAB`, `BALCONY_SLAB`, `RAILING`,
`FACADE_FRAME`, `TERRACE_SURFACE`, `CHIMNEY`, `ROOFLIGHT`, `STAIR`, `ROOM` and
`OTHER`.

The palette is a luminance ladder: off-white main walls with lighter trims, a
mid-grey secondary body, a deep warm-grey roof, near-black frames, cool glass,
timber doors, light concrete slabs and a darker stone terrace. Adjacent groups
therefore never blend, and edges read from that value contrast, each
group's roughness and a subtle screen-space AO at half the diagnostic
styles' intensity. There are no outlines and no per-object colours. The
joints the AO darkens are ones the geometry closure audit holds clean, so it
reads a corner rather than painting over a crack.
Translucency is still chosen per part at upload, so glass stays on the
existing translucent path at alpha 0.35 in every style and a stair placeholder
stays a marker. The palette's `SOFT` edge, a thin line in the web viewer, is
not drawn here because this renderer builds no feature-edge geometry.

## Gestures

| Input | Effect |
| --- | --- |
| one finger, drag | orbit around the current target |
| pinch | zoom toward the target |
| two fingers, drag together | pan: the building follows the fingers |
| tap | select the semantic object under the finger |
| double tap on the selected object | isolate it and frame it |

The touch model is a pure state machine, `CameraGestureTracker` in
`camera/CameraGesture.kt`, with JVM tests in `CameraGestureTest`. `Viewport`
only translates each Compose pointer event into a sample (pointer ids,
positions, pressed state, uptime and viewport size) and hands the resulting
actions (`Orbit`, `Pan`, `Zoom`, `Tap`, `DoubleTap`) to the view model and the
picker.

**Changing the fingers never moves the camera.** Whenever the set of pressed
pointer ids changes (a finger lands or lifts, one pointer replaces another, or
the event lists the ids in a different order), the tracker rebases. It re-reads
the orbit anchor, the pair centroid and the pair distance from the new set, and
it emits no orbit, pan or zoom for that frame. Movement is always measured per
pointer id, never by list position, so only fingers that actually move after
the rebase turn, pan or zoom the camera. Before this rule, a second finger
landing compared the new pair's centroid and spread with the single finger's
position. That produced a sudden pan plus a bogus pinch, and the building
jumped.

- **One finger: orbit.** The gain is 300° per short side of the viewport
  (the width, in portrait), for yaw and pitch alike. A drag across 3/5 of the
  width is a half turn. The gain is relative to the viewport rather than per
  pixel, so the same physical drag turns the model equally at any pixel density
  and in either orientation. The orbit starts only once the finger is 8 dp from
  where it landed, measured as displacement rather than path length, and only
  the travel beyond those 8 dp turns the camera. Jitter therefore never orbits,
  and a drag does not lurch as it starts. Every one-finger phase starts behind
  the slop again, including the finger left behind when a pinch ends.
- **Two fingers: pan and pinch together.** The pan is the movement of the
  pair's centroid, in viewport heights. The camera turns that into world units
  from its distance and field of view, so the point at the target stays under
  the fingers 1:1 at any zoom. The zoom is the ratio of the pair's current
  distance to its previous distance. It is clamped to 0.8–1.25 per frame, and
  no zoom is read while the pair is closer than 16 dp, so crossing fingers or
  one malformed sample can move the camera by one ordinary step at most. A pure
  pinch does not pan, and a pure drag does not zoom. Panning moves the target
  deliberately, and nothing else does: orbit changes only yaw and pitch, and
  zoom changes only distance.
- **Three or more fingers:** the first two fingers to land steer. A third
  finger landing or lifting is a pointer-set change like any other.
- **Tap:** one finger, pressed and released within 500 ms, never more than
  8 dp from where it landed, and with no orbit, pan or pinch in between. It
  selects at the landing point. A second finger at any time rules out a tap.
- **Double tap:** a second tap released within 300 ms of the first one's
  release and within 48 dp of it. A third tap starts a new pair. A drag between
  two taps breaks the pair.
- **Cancel:** when the system takes the touch stream away, all gesture state is
  cleared, including a pending double tap, and nothing is emitted. A cancelled
  touch never ends in a tap.

Selection is applied on the **first** tap; it never waits for a double-tap
timeout. Both taps of a double tap go through the same pick. The view model
reads a second pick of the same object within 300 ms as "isolate and frame
this", on top of a selection the user already saw happen.

Pitch is clamped to −85°…89°, so a plan view is reachable but the house can
never turn over. Distance is clamped between roughly 8 % and 14× the scene
radius, so the camera can neither end up inside the walls nor lose the building
in the distance. Any touch immediately interrupts an in-flight preset
transition. The viewport consumes a touch's pointer events once it has become
a camera move (a drag past the slop, or a second finger). A touch that may
still be a tap is left unconsumed.

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
  VERSION.txt                                     ← versionCode, versionName, commit, signing key
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

### Installing and updating the preview

Android installs an APK as an **update** of the app already on the phone only
when two things hold: the new APK is signed by the **same certificate** as the
installed one, and its **`versionCode` is not lower**. Otherwise the installer
stops with "App not installed" (or, over `adb`, `INSTALL_FAILED_UPDATE_INCOMPATIBLE`
/ `INSTALL_FAILED_VERSION_DOWNGRADE`), and the only way forward is to uninstall.

Both conditions used to fail for CI builds: every runner signed with its own
freshly generated `~/.android/debug.keystore`, and `versionCode` was a constant
`1`. So the installed preview could never be updated from a new CI artifact.
Now:

- **One key, every build.** Every APK — from CI or from
  `npm run android:assembleDebug` on any machine — is signed with the committed
  preview key `apps/android/keystore/preview.keystore` (alias and password in
  `apps/android/keystore/README.md`). It is a deliberately public *preview*
  identity, not a production secret: it signs only this sideloaded viewer and
  grants nothing. Its certificate fingerprint is

  ```
  SHA-256 6E:48:FA:C4:AF:AA:3D:70:E7:0D:E5:BC:60:8A:A4:C4:19:42:06:A9:E6:BC:99:3D:AB:56:38:2B:92:1C:A0:DA
  ```

  The debug build type uses this key instead of the machine's debug keystore,
  so two `assembleDebug` runs on two laptops also update each other.
- **`versionCode` rises on every CI run.** It is derived, never typed in:

  | where | `versionCode` | `versionName` |
  | --- | --- | --- |
  | CI | `1000 + GITHUB_RUN_NUMBER` | `0.<run>.0-preview` |
  | local, in a git checkout | `git rev-list --count HEAD` (number of commits) | `0.<count>.0-local` |
  | local, no git history | `1` | `0.0.1-local` |

  The workflow run number only ever goes up, so each CI artifact installs over
  the previous one. CI starts at 1001 and gains one per run (at least one per
  push), while the commit count gains one per commit, so a CI APK also
  outranks a local build. `VERSION.txt` next to the APKs, and the Android job's
  summary on the run page, state the numbers and the signer of that build.
  The run number belongs to the workflow *file*: if `buildapp-ci.yml` is ever
  renamed, its counter restarts at 1 and `PREVIEW_VERSION_CODE_BASE` in
  `app/build.gradle.kts` must be raised above the last published code.

**One-time step, now.** The preview currently on the phone is signed with an
old ephemeral runner key that no longer exists, so no APK can update it.
Uninstall it **once** — Settings → Apps → *BuildPlan Model Preview* →
Uninstall, or `adb uninstall com.buildplan.preview` — then install the next
CI APK. From then on every later CI APK installs in place over the previous
one; nothing is lost, because the viewer keeps no data. The older
`com.buildplan.app` prototype is a different app id and is not affected.

**Getting the APK.** Actions → *BuildApp CI* → the run → artifact
`buildplan-model-preview-apks`: a zip with the four APKs and `VERSION.txt`.
Copy `BuildPlan-Model-Preview-arm64-v8a-debug.apk` (or the universal one) to
the phone and open it, or `adb install -r <file>.apk`. Android reports the
installed build under Settings → Apps → *BuildPlan Model Preview* (the version
name), or `adb shell dumpsys package com.buildplan.preview | grep -E "versionCode|versionName"`.

**If "App not installed" appears**, one of these is true:

1. *The installed copy was signed with a different key* — the old ephemeral
   key from before this fix, or a build made with a private override key (see
   below). Uninstall once, then install the new APK. To see which key signed an
   APK: `apksigner verify --print-certs <file>.apk` (from the SDK build-tools;
   compare the SHA-256 with the fingerprint above), or
   `apps/android/tools/verify-preview-signature.sh <file>.apk`, which does the
   comparison for you. `keytool -printcert -jarfile` shows nothing, because the
   APKs carry only a v2 signature.
2. *The APK's `versionCode` is lower than the installed one* — an artifact from
   an older run, or a CI APK over a locally built one whose commit count got
   ahead. Take the newest run's artifact. For a deliberate downgrade use
   `adb install -r -d <file>.apk`, which Android allows because the preview is
   debuggable.
3. *Wrong ABI* — `x86_64` or `armeabi-v7a` on an arm64 phone. Use the
   `arm64-v8a` or the `universal` APK.
4. Play Protect may warn about an unknown developer; that is expected for a
   self-signed sideloaded app and is not this error.

**Overriding the key with secrets.** `app/build.gradle.kts` reads four
environment variables and falls back to the committed key when they are blank:
`BUILDPLAN_PREVIEW_KEYSTORE` (path), `BUILDPLAN_PREVIEW_KEYSTORE_PASSWORD`,
`BUILDPLAN_PREVIEW_KEY_ALIAS`, `BUILDPLAN_PREVIEW_KEY_PASSWORD` (defaults to
the store password). The Android job already maps repository secrets of those
names, plus `BUILDPLAN_PREVIEW_KEYSTORE_BASE64` (`base64 -w0 my.keystore`) for
the file itself, so switching CI to a private key is: define the secrets, push.
No workflow or Gradle change. Locally, export the same variables before
`npm run android:assembleDebug`. Changing the key means one more uninstall on
every phone that has the preview; the CI step *Verify the signer* fails the job
if an APK was not signed by the key in force.

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
