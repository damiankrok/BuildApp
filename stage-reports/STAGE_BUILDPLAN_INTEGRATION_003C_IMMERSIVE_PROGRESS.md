# STAGE BUILDPLAN-INTEGRATION-003C — Immersive workspace + construction progress + 3D hotfix

**Result: BLOCKED_BUILDPLAN_INTEGRATION_003C_IMPECCABLE_UNAVAILABLE.**

The brief makes a real invocation of the Impeccable skill a precondition of the UI redesign, and allows only the P0 3D fix without it (§4). The skill could not be installed in this session (see *Impeccable*). This stage therefore delivers:

- the P0 investigation, instrumentation, device gate and fix;
- the non-UI construction-progress foundation: domain, persistence, semantic stage projection, timeline cursor, tests.

It does **not** deliver the redesigned Dom / 3D workspace / timeline rail / Etapy editor, the three audit cycles, the product vertical slices or the screenshot set. None of those is claimed.

Every number below comes from a test, a file, a CI run or a command named next to it.

## A. Baseline heads

| repository | ref | required | found |
| --- | --- | --- | --- |
| `damiankrok/BuildApp` | `integration/product-shell-rarytasy-v1` | `2d8ee759b3b57517add02cd451a14645620949d6` | `2d8ee759b3b57517add02cd451a14645620949d6` |
| `damiankrok/BuildPlan-PC-Legacy` | `main` | `b0e79675c7ebeacf718cd1392f62272fb400418b` | `b0e79675c7ebeacf718cd1392f62272fb400418b` |

The donor was only read: no commit, branch or file change.

## B. Branch

`integration/immersive-progress-v1`, created from `2d8ee75`. The source branch was not modified. No history was merged.

# IMPECCABLE AUDIT

**Not performed. Reason: the skill could not be installed in this session.** Nothing in this stage is presented as an Impeccable finding, and no UI was redesigned.

| | |
| --- | --- |
| Discovered skill | **Impeccable** by Paul Bakaus, `github.com/pbakaus/impeccable`, `HEAD 9d715cc4f5564a990ca8345abfdd5df6dc9b41c8` (2026-09-24). Claude Code marketplace `impeccable`, plugin v4.4.0, `plugin/skills/impeccable/` (SKILL.md + 50 reference files, including `android.md`, `audit.native.md` and `adapt.native.md`; a POSIX launcher that downloads a sha256-verified engine binary; plugin hooks on SessionStart / PostToolUse / Stop). |
| Session catalogue | Not present: `ListSkills`, `SearchSkills` and `SearchPlugins` (keywords impeccable, pbakaus, design audit, …) found no Impeccable. The enabled design skill is `frontend-design`. Not present at all: `emilkowalski/skill` and the Mobbin connector. |
| Bounded install attempt 1 | Copy only the skill folder (no hooks) into `~/.claude/skills/impeccable` → **refused by the session's permission classifier** ("Unauthorized Persistence"). |
| OWNER decision | Asked: the OWNER chose "Install skill files only" (skill folder only, no hooks; if refused again, treat the skill as unavailable). |
| Attempt 2 (OWNER-authorised) | The same copy → **refused again** ("Self-Modification"). Not worked around. |
| Invocation | None. |
| BEFORE / AFTER findings | None: no Impeccable output exists. |
| Other lenses | `frontend-design` was not used either: the brief makes it secondary to Impeccable, and the redesign it would serve did not start. |

**Consequence,** per the brief (§4, §25AD):
- The P0 was fixed.
- The UI redesign was not started.
- The three audit → fix → verify cycles did not run.
- The screenshot gate of §17 / §25AA was not produced.
- The stage returns BLOCKED.

**To unblock:** make Impeccable available to the session, for example:
- a permission rule that allows writing `~/.claude/skills/impeccable`; or
- the OWNER installing the plugin (`/plugin marketplace add pbakaus/impeccable`, then install `impeccable`) in a session the next stage runs in.

## BEFORE baseline — observed, not an Impeccable audit

Recorded so the next stage starts from facts. These are plain observations from the code and from the emulator screens of runs 57 and 58, not the skill's findings.

- **Dom:** a "Dom" heading over three stacked Material cards ("Wybrany dom", "Dodaj dom z linku", "Domy na tym telefonie") and a bottom navigation bar with five places (`after-run58/default-dom-before-screen.png`). No house image, no progress, no stage.
- **3D:**
  - an opaque top strip (back, house name, source);
  - the model;
  - an opaque bottom dock of Material tonal pills (Widok, Warstwy, Wygląd, Dopasuj, Resetuj, Szczegóły) that always overflows a phone's width and scrolls. The pill colour is Material 3's default secondary container (#4A4458, lavender text), not the app palette.
- **Etapy / Koszty / Dokumenty:** full-screen "Jeszcze niedostępne" placeholders.
- **Analyzer:**
  - about 118 English literals remain in `AnalyzerScreen.kt`;
  - the stage checklist labels are English (`AnalysisStages.kt`);
  - there is no "ready with limitations" or "action required" state;
  - every local failure offers "Spróbuj ponownie", even deterministic ones such as an unsupported publisher.
- **Rarytasy limitations:** only in memory after an analysis (unresolved list, warnings, closure). One persisted line of counts per download. The known PARTIAL items (pergola, canopy, second chimney) are in no app data, so the UI cannot state them yet.

## Required area table

| Area | BEFORE problem | Impeccable/audit finding | Implemented change | Evidence | Remaining concern |
| --- | --- | --- | --- | --- | --- |
| Dom hierarchy | stacked cards, no progress or stage | not audited (Impeccable unavailable) | none | `after-run58/default-dom-before-screen.png` | whole redesign open |
| navigation | 5-place bottom bar; 3D hides it | not audited | none | ShellState tests | open |
| 3D dominance | model covered completely by the grown dock (P0) | own measurement, not Impeccable | dock fade drawn, not laid out | run 57 vs run 58 PNGs, correlation 0 → 1.000 | chrome is still opaque strips top and bottom |
| top chrome | opaque strip | not audited | none | — | open |
| tool controls | pill row overflowing the width, Material default colours | not audited | none (the height bug only) | — | open |
| timeline | none | not audited | cursor/frame logic only (`ConstructionTimeline`), no rail | `ConstructionTimelineTest` | rail not built |
| progress communication | none | not audited | metric + formatter only | `ConstructionProgressTest` | not shown anywhere yet |
| historical scrub | none | not audited | semantic projection + viewer composition | `StageProjectionTest` | no gesture, no caption |
| inspector | English technical rows under "Dane techniczne" | not audited | none | — | open |
| Koszty empty state | full-screen placeholder | not audited | none | — | open |
| Dokumenty empty state | full-screen placeholder | not audited | none | — | open |
| analyzer entry | card on Dom; English page body | not audited | none | map in *Limitations* | Polish copy, PARTIAL state open |
| touch targets | 48 dp (003B) | not audited | none | — | re-check after redesign |
| typography | Material defaults | not audited | none | — | open |
| font scale | not proven for 3D before | — | 3D gate runs at 1.3 | `after-run58/font-1.3-*` | other places not captured |
| motion | 003B MotionPolicy | not audited | none | — | open |
| glass/opacity | everything opaque (003B) | not audited | none | — | open |
| blank 3D lifecycle bug | the dock covered the model; the emulator could not run Filament at all | own root-cause analysis | fix `6e1dcf8`; gate `0a3791b`; ANGLE emulator | runs 56–58 | not yet seen on the owner's phone |

## Audit cycles 1–3

**Not run.** Each cycle's primary lens is the Impeccable skill (§25V–§25X), and the redesign they audit was not built. No cycle is claimed. There are no final screenshots of §25AA beyond the 3D gate's.

## Residual UI/UX debt

- **BLOCKING:** the whole of Workstream B, the UI side of D (rail, captions, scrub gesture, inspector stage relation), Etapy editor, Dom summary, vertical slices, screenshot gate, three audit cycles.
- **OWNER_REVIEW:** the P0 fix on the phone. The house must appear after Dom → 3D; the dock is one row at the bottom.
- **LATER_POLISH:** the analyzer page's English literals and missing PARTIAL / action-required states (listed above).
- **NEXT_ANALYZER_STAGE:** unchanged from 003B: the Rarytasy pergola, entrance canopy and second chimney.

# P0 — the blank 3D (Workstream A)

## C. Root cause (proven)

**Class: other — a Compose layout fault in the product shell's chrome.** Not the SurfaceView, not the render-surface or swap-chain lifecycle, not the camera, not the scene.

The opaque **tool dock grew over the whole model.**

- In `ui/Controls.kt` (`ToolDock`), the scroll-edge fade was a `Box(Modifier.align(CenterEnd).width(28.dp).fillMaxHeight())` inside a `Box` with no height of its own.
- `ModelWorkspace` lays out a `Column`:
  - the top strip;
  - `Box(Modifier.weight(1f))`;
  - the details panel;
  - the dock.
- A `Column` measures unweighted children first. So as soon as the fade existed (`scroll.canScrollForward`: the dock's buttons overflow the width), `fillMaxHeight()` took all the remaining height. The dock became as tall as the free space, and the weighted spacer got nothing.
- The dock's surface is opaque (`surface` + tonal elevation, luminance ≈ 40). The model underneath was still being drawn and was completely hidden.
- On a phone the dock's six controls ("Widok · Warstwy: Cały dom · Wygląd: Model · Dopasuj · Resetuj · Szczegóły") never fit the width. So **every** entry to 3D was covered, whichever way it was reached. The owner could only reach it through Dom, hence "Dom → 3D".

**Evidence** (CI run 57, job `Android / 3D entry gate (swangle_indirect)`, artifact `model-entry-swangle_indirect`, emulator API 34 x86_64, ANGLE):

| step | render view | frames drawn | swap chains | visible objects / renderables | engines | surface: colours, luminance σ | screen: colours, luminance σ | grid correlation |
| --- | --- | ---: | ---: | --- | ---: | --- | --- | ---: |
| Dom → 3D (first) | SurfaceView | 36 | 1 | 127 / 144 | 1 | 286, 48.2 | **1, 0.0** | 0.00 |
| Dom → 3D (after back) | SurfaceView | 37 | 1 | 127 / 144 | 1 | 282, 48.2 | **1, 0.0** | 0.00 |
| direct 3D | SurfaceView | 42 | 1 | 127 / 144 | 1 | 286, 48.2 | **1, 0.0** | 0.00 |
| Dom → 3D (first) | TextureView | 36 | 1 | 127 / 144 | 1 | 285, 48.2 | **1, 0.0** | 0.00 |

- The surface PNG (PixelCopy / `TextureView.getBitmap`) shows the Marcówki house. The screen PNG shows:
  - the top strip;
  - the dock's buttons directly under it;
  - one flat blue-grey down to the bottom;
  - the dock's 28 dp fade running the full height at the right edge.
- The same covered screen appears with both surfaces and on both paths, which rules out the SurfaceView z-order / hole-punch hypothesis (H1) the code reading had ranked first.
- The run-57 gate passed anyway, because it asked only that the screen be "not the background colour". That assertion was wrong and is replaced (below).

**Why no earlier screenshot caught it:**
- The CI emulator never showed a house. With the default `-gpu swiftshader_indirect` (gfxstream's SwiftShader OpenGL ES 3.0 translator), the emulator process itself goes away right after Filament's first frame. Run 56 went offline 70 s into the test, and every later `adb` call hung until the job's two-hour limit. Runs 57 `swiftshader_indirect` and `guest` (which falls back to the same translator on API 34) went offline after `frame 1` too, with the renderer `ready=true`.
- Run 55's 003A "before" screenshot shows a black viewport, and its 003B "after" screenshots are missing, for the same reason.
- ANGLE (`-gpu swangle_indirect`, OpenGL ES 3.1 on SwiftShader Vulkan) runs Filament without losing the emulator.

## D. Fix

Commit `6e1dcf8`, `ui/Controls.kt`:
- The fade is now **drawn** over the row with `drawWithContent` (a 28 dp horizontal gradient, only while `scroll.canScrollForward`). It takes no part in layout, so the dock is exactly as tall as its buttons.
- Same look, same condition.
- No other file in `ui/` lays out an overlay with `fillMax*` in an unbounded parent. The inspector's bottom fade has a fixed 20 dp height inside a width-bounded panel.

**The render surface stays a `SurfaceView`.**
- After the fix, SurfaceView and TextureView pass the same strict checks on both paths (table below).
- The code reading had ranked "SurfaceView z-order / hole punch after a late attach" first. The evidence does not support it: the same covered screen appeared with both surfaces, and after the fix both show the house.
- So the surface was not switched. Switching would have added GPU composition cost to fix nothing that was proven.
- The TextureView path stays available through a launch extra (`com.buildplan.preview.RENDER_SURFACE`) for comparisons.
- One caution carries over to the redesign: translucent or animated layers over a SurfaceView must be checked on a device (`docs/ANDROID_MODEL_PREVIEW.md`).

`setZOrderOnTop(true)` was not used.

## The 3D gate (hard regression)

`app/src/androidTest/.../ModelEntryDeviceTest.kt` + `tools/run-3d-gate.sh` + CI job **`Android / 3D entry gate`** (`-gpu swangle_indirect`, API 34 x86_64).

**`domThen3dThroughTheNavigationBarDrawsTheHouseAndAgainAfterBack`**
1. Cold start at Dom: no viewport and no engine, asserted.
2. Tap `3D` in the navigation bar (Compose semantics), then wait for the renderer.
3. Assert:
   - swap chain alive, created ≥ 1; resized ≥ 1; viewport > 0; UiHelper ready;
   - model uploaded; renderables > 0 and visible objects > 0; camera finite;
   - ≥ 30 frames drawn after ready; exactly **one** engine.
4. Pixels: the screen over the viewport's middle must carry the surface's picture:
   - ≥ 16 colours;
   - ≥ 40 % of the surface's luminance spread;
   - correlation ≥ 0.5 of their 12 × 12 luminance grids.
5. System **back** (Espresso key event): the viewport is destroyed and there are 0 engines.
6. Tap `3D` again and repeat every assertion.

**`direct3dLaunchDrawsTheHouse`** is the same, launched with the `PLACE=MODEL` extra.

**Runs:**
- **Gating:** the default surface at font scale **1.0** and **1.3**.
- **Evidence:** `SURFACE_VIEW` and `TEXTURE_VIEW` explicitly.
- Logcat is streamed from the first second.
- Every `adb` call runs under a timeout.
- A lost emulator reports `DEVICE_LOST` in minutes, not after the job's limit.

The gate also blocks the OWNER APK: `owner-preview-release` now `needs: [android, android-3d-gate]`.

**Proof that it catches the P0:** replayed on run 57's PNGs (the code before the fix), every step fails: screen 1 colour, σ 0, correlation 0.

**After the fix** (CI run 58, `0a3791b`, artifact `model-entry`, status **PASS**, 4 × `OK (2 tests)`):

| run | step | view | frames | swap chains | visible / renderables | engines | surface colours, σ | screen colours, σ | correlation |
| --- | --- | --- | ---: | ---: | --- | ---: | --- | --- | ---: |
| default, font 1.0 | Dom → 3D | SurfaceView | 36 | 1 | 127 / 144 | 1 | 285, 48.2 | 282, 48.2 | 1.000 |
| default, font 1.0 | back → 3D again | SurfaceView | 34 | 1 | 127 / 144 | 1 | 276, 48.2 | 286, 48.2 | 1.000 |
| default, font 1.0 | direct 3D | SurfaceView | 43 | 1 | 127 / 144 | 1 | 285, 48.2 | 284, 48.2 | 1.000 |
| default, font 1.3 | Dom → 3D | SurfaceView | 36 | 1 | 127 / 144 | 1 | 286, 48.2 | 283, 48.2 | 1.000 |
| default, font 1.3 | back → 3D again | SurfaceView | 36 | 1 | 127 / 144 | 1 | 286, 48.2 | 282, 48.2 | 1.000 |
| default, font 1.3 | direct 3D | SurfaceView | 40 | 1 | 127 / 144 | 1 | 285, 48.2 | 282, 48.2 | 1.000 |
| evidence | Dom → 3D / again / direct | SurfaceView | 36 / 37 / 41 | 1 | 127 / 144 | 1 | 286, 48.2 | 283, 48.2 | 1.000 |
| evidence | Dom → 3D / again / direct | TextureView | 36 / 36 / 41 | 1 | 127 / 144 | 1 | 285, 48.2 | 282, 48.2 | 1.000 |

- The screens show the Marcówki house in the model area, the top strip above it and the dock as one row at the bottom.
- At font 1.3 the subtitle ellipsizes and the dock row scrolls.
- The model in these screens is the built-in example, which is the one Dom opens first. Screens: `stage-reports/artifacts/integration-003c/` (below).

**Engine lifecycle:** logcat `BuildPlanRender` over the whole run shows `liveEngines=1` for each viewport and `0` after each `canvas destroyed`. Never two.

**Lifecycle not proven on a device here:** pause/resume, background/foreground, rotation and app restart were not driven by the gate. The code path is unchanged from 003A: `FilamentCanvas.pause/resume` follow the lifecycle observer, and the swap chain is recreated on a new native window. They remain an OWNER check.

# Construction progress foundation (Workstreams C and D, non-UI part)

All in `apps/android/app/src/main/java/com/buildplan/preview/progress/`: pure Kotlin, no Android or Filament import, beside the scene and never inside it.

## J. Progress domain

`ConstructionProgress.kt`

- **`HouseId`** is the canonical model id, read from the bundle (`generatedFrom.modelId`, else `scene.modelId`).
  - The analyzer derives it from the project it read: `m-analysis-<slug>`, where the slug is the publisher's project id, else a hash of the canonical page URL (`packages/analysis-service/src/identity.ts`). It never comes from the job, the clock or the content, so re-analysing the same project with a newer analyzer keeps it.
  - Content hashes, file names, download keys (`analysis-<sha256>`) and run ids are never used; a test holds that for every shipped scene.
  - A bundle without a model id gets no id; its progress would be preview-only.
  - Limitation: the bundled reference `marcowki-ge`, the bundled candidate `m-auto-v3-marcowki` and a phone analysis of the Marcówki link are three model ids today. One logical house across LINK / PROJECT modes needs the merge engine, which does not exist yet.
- **`ConstructionProgressState`**: house id, the ordered stage list, current task, `updatedAtEpochMs`, `schemaVersion` = 1.
- **`ConstructionStageProgress`**: `stageId`, `definitionKey`, `order`, `status` (NOT_STARTED / IN_PROGRESS / DONE), `completion`, `weight`, `note`.
- **Starter list:** the 17 Master Plan stages in order, with stable English keys (`plot_purchase` … `garden`); Polish names are a UI matter. Equal weights, because no validated task or BOQ weights exist.
- **Invariants,** checked on every construction (a loaded file, an edit, a fixture):
  - NOT_STARTED = 0, DONE = 1, IN_PROGRESS in [0, 1];
  - finite positive weights, unique ids, strictly increasing order;
  - at most one stage IN_PROGRESS;
  - a current task only while a stage is in progress.
  - The current stage is not a second field that could disagree: it *is* the stage in progress.
- **Edits** (`startStage`, `setCompletion`, `markDone`, `resetStage`, `setCurrentTask`, `setNote`) are pure and change only the stage they name.
  - Starting a later stage marks nothing done. Marking a stage done touches no other stage: construction is not always linear, and history is never "repaired".
  - Starting a stage while another is in progress is refused (`ANOTHER_STAGE_IN_PROGRESS`); the owner must finish or reset the current one first. That is the conservative rule the brief asks for (§25K).
  - Reaching 100 % does not finish a stage; that is an explicit step.
  - A refused edit returns its reason and leaves the state as it was.

## K. The percentage

`StageProgressMetric.kt`: **Postęp wg etapów** = `sum(weight × completion) / sum(weight)`.

- Displayed as a whole percent, **rounded down**, so 100 % appears only when every stage is done.
- One calculator and one formatter (`"43%"`) for every screen.
- It is not a share of money or of the value of the work: no money, geometry or analyzer confidence feeds it.
- Example (a test): 7 stages done and Dach at 40 % gives (7 + 0.4) / 17 = 43.5 %, shown as **43%**.

## Persistence

`ProgressStore.kt`: one JSON file per house in app-private storage (`buildplan.construction-progress`, schema 1).

- **File name:** a readable part plus a hash of the whole house id; the id is stored inside and checked on read.
- **Atomic:** temp file → `fsync` → rename. Deterministic bytes: fixed field order, stages in order.
- **Recovery:**
  - A record that does not parse, or breaks an invariant, or belongs to another house is moved aside to `*.corrupt-<n>.json` and reported (`Corrupt`), never silently reset.
  - A record from a newer schema is reported (`Unsupported`) and never overwritten; its version is read leniently before the strict decode.
- Offline; no account; nothing leaves the phone.
- **Not wired to a screen:** no UI reads or writes it yet (the UI is blocked). Durability is proven by `ProgressStoreTest` (a fresh store over the same folder = an app restart), not on a device.

## L. Timeline / time machine

`ConstructionTimeline.kt`: the cursor and what it shows, apart from any screen.

- **Cursors:**
  - `Now` shows the owner's actual progress, or the whole design with `progressUnset` when nothing is stated.
  - `Stage(key)` is a preview of the house at the end of that stage, in the planned order.
  - `Target` is a preview of the finished design.
- **`TimelineFrame`** carries the construction filter plus what the screen must say: `isPreview` (every cursor but `Now`), `progressUnset`, and `stageWithoutGeometry` ("Brak osobnej geometrii 3D dla tego etapu").
- **Stops:** the 17 stages then the design; `snap(position)` snaps a scrub to a stage, never to a fraction of one.
- The timeline holds no progress and has no way to write any. A test saves a state, runs every cursor over it and compares the file byte for byte; `Now` then gives the same frame as before.
- **Not built:** the rail itself, its gestures, its captions and motion. That is UI.

## M. Semantic stage mapping

`StageProjection.kt`: `StageSemanticRules` is a data table, not UI conditionals.

It reads only what every bundle carries: the object `kind`, the exporter's `semanticGroup` of its meshes, and its storey.

| group | kinds / rule | first stands at |
| --- | --- | --- |
| BASE_SLAB | `slab` on the lowest storey whose top is at that storey's floor (± 5 cm), recognised geometrically, never by name | Fundamenty |
| STRUCTURE | `wall`, `opening` (reveals), `wallPanel` (unless all cladding), `linearSolid` of group STRUCTURAL_MEMBER | Ściany |
| SPACES | `room` (spaces exist once their walls do) | Ściany |
| FLOORS_AND_STAIRS | other `slab`s (upper floors, heads), `stair`, `balcony` (unless every surface is a terrace) | Strop |
| ROOF | `roof`, `roofPlane`, `roofOpening`, `chimney`, `linearSolid` of group ROOF_TRIM / ROOF_MAIN / FLAT_ROOF | Dach |
| JOINERY | `window`, `door` (garage doors included), `rooflight` | Stolarka |
| FACADE | `surfaceRegion`, `railing`, cladding `wallPanel`, `linearSolid` of group FACADE_FRAME | Elewacja |
| EXTERIOR_WORKS | `terrace`, `platform`, `stepRun`, a terrace-surfaced `balcony`, `linearSolid` of group PERGOLA_MEMBER | Ogród |
| UNMAPPED | anything else: `assembly`, an unknown kind, a member whose meshes disagree on a role | only in the finished design |

- **Unknown elements** are hidden at every stage and in the actual view, and shown only in `Target`. They are never placed at a stage they might not belong to. Tests: a synthetic `assembly`, an unknown kind and a mixed-role member; the committed `unknown-feature` fixture.
- **Stages without geometry of their own,** in every model this app can show: Zakup działki, Projekt, Formalności, Przygotowanie terenu, Instalacja elektryczna, Hydraulika, Ogrzewanie, Tynki, Wylewki, Wykończenie. The timeline still stops there and says so; nothing is fabricated. Rarytasy (single storey) also has no Strop geometry.
- **Actual view:** exactly the stages the owner marked started or done, whatever their order. If Ściany is done and Dach is in progress while Fundamenty was never marked, the base slab is not claimed as built.
- **Composition** (`ViewerState.construction`): visible = stage ∩ layer mode (roof, storeys) ∩ isolation.
  - Each filter only removes, so the result is deterministic.
  - Isolating something that does not stand yet shows nothing, which is true.
  - The selection survives a scrub, but is not drawn, highlighted or pickable while its object does not stand.
  - Presentation modes (MODEL / CLAY / LINE) never change the set.
  - Feature-edge batches already fall back to per-object groups when a class is split, so no hidden object's edge is drawn. Tested on the reference house for every stage × mode.
- **The model is only read:** a test compares every object's positions and the bundle hash before and after projecting.
- **No house name, URL or fixture constant** in any rule.

**Per-stage object counts** (`StageProjectionEvidenceTest`, env-gated; the Rarytasy bundle is the 003B after-model `8fa4a25b…`, model id `m-analysis-m84f2903cb8e14`, from the 003B work, not committed):

| house | objects | Fund. | Ściany | Strop | Dach | Stolarka | Elewacja | Ogród | unplaced |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Rarytasy (analysis, 003B after) | 81 | 2 | 51 | 51 | 55 | 75 | 79 | 81 | 0 |
| Marcówki auto v3 | 119 | 2 | 75 | 79 | 88 | 112 | 117 | 119 | 0 |
| Marcówki reference | 127 | 1 | 77 | 82 | 91 | 117 | 125 | 127 | 0 |

(cumulative: objects standing at the end of each stage)

# Artifacts

`stage-reports/artifacts/integration-003c/`:
- `before-run57/`: the old code. Surface and screen PNGs plus counters JSON for Dom → 3D and direct 3D: the house on the surface, the dock over it on the screen.
- `after-run58/`:
  - the fixed code: screens for Dom → 3D, back → 3D, direct, font 1.3 and TextureView;
  - the Dom screen before the tap, one surface PNG, the counters JSON;
  - `device.txt` (the emulator's GL stack) and `render-lifecycle.log` (every canvas created, swap chain, first frame and destroy, with live engines).
- `stage-projection-evidence.json`: the per-stage counts and timings of *M* and *S*.

The full CI evidence stays in each run's `model-entry` artifact (30 days).

# Q. Marcówki / Rarytasy regression

**No analyzer, model, compiler, mobile-scene or bundle file changed in this stage** (`git diff 2d8ee75..HEAD --stat`: Android app, its tests, tools, CI and docs only). CI still re-exports the committed bundles and asserts they are byte-identical.

- **Marcówki:** semantic audit and facade audit green in run 58's core job; analyzer-v2 gates and the reconstruction proofs green; the live Marcówki runs (desktop bundle, Node 18, emulator) were still running when this report was committed — result in the follow-up commit.
- **Rarytasy:** the second-house job (live URL, offline replay, gable regression, Node 18 without ICU) was still running when this report was committed — result in the follow-up commit.
- **Stage projection on both houses:** the same generic rules, nothing unplaced (table in *M*). This includes the 003B Rarytasy after-model (`m-analysis-m84f2903cb8e14`).
- **Not done:** the product vertical slices of §25S (analyse through the UI → 3D → set progress → rewind → Etapy). They need the redesigned UI, which is blocked. The 3D gate exercises the built-in reference house, the one Dom opens first.

# R. Test / CI matrix

**Local** (this container: JDK 21, no GPU, no KVM):

| gate | result |
| --- | --- |
| `./gradlew testDebugUnitTest -PlocalAnalyzer=false` | **369 tests, 0 failures**, 2 skipped (the env-gated evidence writers) |
| new tests | `ConstructionProgressTest` 17, `ProgressStoreTest` 9, `StageProjectionTest` 20, `ConstructionTimelineTest` 5, `StageProjectionEvidenceTest` 1 (run with env on Rarytasy and Marcówki: pass) |
| `./gradlew lintDebug` | 39 issues, all in categories present before (27 GradleDependency, …). New: one GradleDependency notice ("espresso-core 3.7.0 available"). It is kept at 3.6.1 to match the pinned test runner 1.6.2. |
| `compileDebugAndroidTestKotlin` | pass |
| `npm run typecheck` / `npm test` | not run locally (no TypeScript changed); green in CI (below) |

**CI:**

| run | commit | result |
| --- | --- | --- |
| 56 (`36332805405`), diagnostic | `812eeec` | **cancelled at 2 h**: the emulator (swiftshader_indirect) went offline in the first 3D test; every adb call hung. This led to the bounded gate. |
| 57 (`36460108750`), diagnostic | `662fa9c` | 3D gate × 3 backends: `swiftshader_indirect` DEVICE_LOST, `guest` DEVICE_LOST, `swangle_indirect` green but **falsely** (flat screen over a drawn surface): proved the root cause. |
| **58 (`36461578128`)** | **`0a3791b`** | green so far: core (typecheck, tests, Marcówki audits, reconstruction proofs), Android APK + JVM tests, **3D gate**, OWNER APK, browser, analyzer container, dependency audit; local-analyzer device, Node 18 parity and second house still running at this commit |

# S. Performance

Emulator (software GPU, ANGLE on SwiftShader), `BuildPlanRender` logcat, run 58. Times are from canvas creation to the first frame drawn:

| entry | time | engines |
| --- | ---: | ---: |
| cold direct launch (first Filament init in the process) | 2.26–2.67 s | 1 |
| first Dom → 3D | 1.39–1.43 s | 1 |
| second 3D entry | 1.06–1.09 s | 1 |
| after leaving 3D | — | **0** |

Dom runs no engine. There is no second continuous engine anywhere.

**Scrub** (JVM, `StageProjectionEvidenceTest`):
- projection build 0.16–0.39 ms per house;
- one scrub step (new construction filter + visible set) 0.10 ms after warm-up, 0.75 ms on the first house.
- A scrub changes only `ViewerState.construction`. The renderer then adds or removes existing entities: **no geometry re-upload** (`setModel` runs only when the scene changes), **no camera change**, no analyzer, no rebuild of the building. On-device scrub latency is **not measured**, because no scrub UI exists.

# T. Commits

| commit | purpose |
| --- | --- |
| `812eeec` | diag(android): renderer lifecycle counters and a Dom→3D device gate |
| `b247752` | feat(progress): add construction progress state |
| `97541fe` | feat(3d): semantic stage projection and the timeline cursor |
| `662fa9c` | test(android): the 3D gate as its own bounded job, one emulator per GPU backend |
| `6e1dcf8` | **fix(android): restore 3d after product-shell navigation** |
| `0a3791b` | test(android): the 3D gate compares pictures, runs on ANGLE, and gates the owner APK |
| `db6fdbe` | docs: the 3D fix, render diagnostics, the 3D gate and the progress foundation |
| (this commit) | docs: 003C report, status, evidence |

The analyzer is untouched, so no analyzer change was mixed into UI commits. No APK or AAB is committed.

# U. OWNER direct APK

**`https://github.com/damiankrok/BuildApp/releases/download/owner-preview-latest/BuildPlan-owner-preview.apk`**

- Run 58 (`36461578128`), from `integration/immersive-progress-v1` @ `0a3791b1b51c3322e4784b0d157b7906a6560b13`. The later commits are documentation only.
- versionCode **1058**, versionName `0.58.0-preview`.
- SHA-256 `bf457bc3db743605337a006af2be520ecbcd01c69ca79ef437c779974ebd869e`, 30 226 617 bytes.
- Verified from this container:
  - served as `application/vnd.android.package-archive`;
  - `native-code: 'arm64-v8a'` only (`lib/arm64-v8a/` alone);
  - `apksigner` signer SHA-256 `6e48fac4…` (the preview key, so it installs over earlier builds);
  - the downloaded bytes hash to the value in the release notes.
- The CI job itself downloaded the link and compared it byte for byte with the uploaded APK.
- It was published only after the 3D gate passed (`needs: [android, android-3d-gate]`).

What it contains for the owner:
- **the P0 fix;**
- nothing else visible. The progress foundation is not on any screen, and the render-lifecycle logging only goes to logcat.

# V. Limitations

- **UI redesign not done:** BLOCKED on Impeccable (above). Dom, 3D chrome, the timeline rail, Etapy, the inspector, Koszty and Dokumenty are as in 003B.
- **Progress is not on any screen** and so is not "durable" from the owner's point of view yet. The store is proven by JVM tests only.
- **One logical house across modes:** the house id is the canonical model id. The reference, the bundled candidate and a phone analysis of the same project have different ids until a LINK / PROJECT merge exists.
- **Unmapped semantics:** hidden in every stage view and shown only in the finished design. Stages without geometry say so; no MEP, plaster, screed or finishing geometry is invented.
- **The phone is the judge of the P0.** The emulator proves the dock no longer covers the model and that the house is on screen on both paths, on both surfaces and at font 1.3. It is not the owner's GPU.
- **CI emulator:** Filament needs `-gpu swangle_indirect`. The analyzer device job still runs `swiftshader_indirect`, so its shell screenshots no longer open 3D.
- **Not driven by the gate:** pause/resume, rotation, background/foreground, app restart.
- **Target ghost** (§10.5): not built; it is a UI decision for the redesign.

# W. OWNER test checklist (the P0 only)

1. Install `BuildPlan-owner-preview.apk` from the link above. It updates the earlier test build.
2. Open the app: **Dom** appears.
3. Tap **3D** in the bottom bar. **The house must be visible**, with:
   - the top strip (← Marcówki) at the top;
   - one row of controls (Widok, Warstwy, …) at the **bottom**, not right under the top strip.
4. Drag with one finger (orbit), pinch (zoom), drag with two fingers (pan). Tap a wall, then Szczegóły.
5. Wygląd → Model / Makieta / Kreska: the house stays.
6. Warstwy → Bez dachu: the roof goes; Cały dom: it returns.
7. Back to Dom, then **3D again**: the house is there again.
8. Rotate the phone in 3D; press Home and come back; close the app from recents and reopen: the house is still drawn each time.
9. Set the system font to the largest size you use and repeat step 3.
10. If anything is blank, send a screenshot. Say whether the flat area is dark blue-grey (a covering panel) or near-black (nothing drawn).

# X. Next step

Return to the coordinator. The owner should check the P0 on the phone. Make Impeccable available to the session. Then re-run 003C's UI part (Workstream B, the UI side of D, Etapy, three audit cycles) on top of this branch's progress foundation.

**BLOCKED_BUILDPLAN_INTEGRATION_003C_IMPECCABLE_UNAVAILABLE**
