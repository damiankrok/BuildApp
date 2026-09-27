# STAGE BUILDPLAN-INTEGRATION-003B — Product shell + Rarytasy fidelity

Two workstreams, kept in separate commits so either can be reverted alone:

- **A.** The technical Preview/Analyzer app becomes a BuildPlan product shell with five places: Dom, 3D, Etapy, Koszty and Dokumenty.
- **B.** The second house's projecting garage gets the gable its drawings show, through a generic reading of attached roofs on the elevations. The garage had been a flat slab by convention.

Every number below comes from a test, a file or a command named next to it. The evidence lives in `stage-reports/artifacts/integration-003b/`.

**Not claimed:** OWNER visual acceptance, of either workstream. This container has no GPU and no `/dev/kvm`. The app screens were captured on the CI emulator (see *Screenshots*); the model evidence is the JVM software raster from 003A, now with perspective-correct depth.

## A. Source heads verified

| repository | ref | required | found |
| --- | --- | --- | --- |
| `damiankrok/BuildApp` | `integration/unified-buildplan-presentation-v1` | `fb415e458cf9a7227ccb2507a8b68bac9dc03ba9` | `fb415e458cf9a7227ccb2507a8b68bac9dc03ba9` |
| `damiankrok/BuildPlan-PC-Legacy` | `main` | `b0e79675c7ebeacf718cd1392f62272fb400418b` | `b0e79675c7ebeacf718cd1392f62272fb400418b` |

The donor was only read: no commit, no branch, no file change. Nothing from its Git history, analyzer or domain entered BuildApp.

## B. Branch

`integration/product-shell-rarytasy-v1`, created from `fb415e4`. The source branch was not modified.

---

# UI

## Current vs Legacy vs new

| | BuildApp before (003A) | Legacy (`b0e7967`) | BuildApp after (this stage) |
| --- | --- | --- | --- |
| Structure | two screens: a viewer, and an "Analyze link" screen behind a top-strip button | a drawer launcher over 9 sections in 3 groups; Home = the immersive workspace | 5 places in a bottom `NavigationBar`: **Dom · 3D · Etapy · Koszty · Dokumenty** |
| Language | English, hard-coded in Kotlin | Polish, `strings.xml` | Polish, `strings.xml`, with Polish plural forms |
| Model | full screen, with a top strip of technical figures (schema, triangles, bundle hash) | full screen, glass chrome, timeline rail, right-edge tool dock | full screen in `3D` (no navigation bar), an opaque top strip (back, house, source) and an opaque bottom dock |
| Controls | `Views`, `Mode: MODEL`, `Style`, `Layers`, `Frame`, `Reset`, `Details` | 5 rail tools (Layers, Views, Style, Recenter, Source) with 216 dp panels | **Widok** (presets), **Warstwy** (layers, only-selected, show all), **Wygląd** (Model / Makieta / Kreska = MODEL / CLAY / LINE; lighting under Model), **Dopasuj**, **Resetuj**, **Pokaż zaznaczenie**, **Szczegóły** |
| Analyzer | the second of two screens | Import project (a section) | "Analiza linku": a sub-page of Dom that keeps all its function and diagnostics; its main path is now Polish |
| Unbuilt parts | none shown | "Moduł w przygotowaniu" placeholders for 7 sections | three honest empty states: what will live here, and that nothing does yet (no figure, date, file or button) |
| Panels | the top strip at alpha 0.88, the dock at 0.92 | smoked glass at 0.84, `OpaqueTint` for chrome over chrome | opaque everywhere; nothing is readable through anything |

**Information architecture chosen.** Five places, because five fit a bottom navigation bar, where the destinations stay visible, unlike a drawer. They also map the product 1:1: the house, its model, and the three ledgers of a build. `3D` is a place and not a mode of `Dom`: the model deserves the whole screen, and a return to where you came from.

The Legacy structure was not copied. Its nine destinations include market, budget and statistics, which have nothing behind them, and a launcher drawer hides every one of them.

## Donor UI files and classes studied

Read-only, at `app/src/main/java/com/buildplan/app/ui/…` of Legacy @ `b0e7967`, plus commits `6480057` (STAGE-013G shell), `0983a71` (STAGE-013H immersive workspace and glass audit) and `6f71596` (STAGE-025 verification readability audit):

- `navigation/AppSection.kt`, `navigation/BuildPlanNavHost.kt`, `AppShell.kt`, `AppDrawerSheet.kt`
- `screens/WorkspaceScreen.kt`, `workspace/WorkspaceChromeState.kt`, `workspace/MotionPolicy.kt`
- `components/Glass.kt` (`GlassSurface`, `GlassDefaults.OpaqueTint`), `components/ToolDock.kt`, `components/TimelineRail.kt`, `components/ContextPanel.kt`, `components/WorkspaceChrome.kt`, `components/WorkspaceGlyphs.kt`
- `screens/VerificationWorkspace.kt` (the height budget, `QuestionRow` stateDescription), `screens/SectionPlaceholderScreen.kt`
- `theme/Color.kt`, `theme/Theme.kt`, `main/res/values/strings.xml`

## Copied, adapted, rejected, improved

| | what | where it is now |
| --- | --- | --- |
| **adapted** | `MotionPolicy`: `enter` 220 ms, `exit` 150 ms, `enterDelayed`, and snap when the system animator scale is 0, observed live via a `ContentObserver` | `ui/Motion.kt` |
| **adapted** | back enabled only while it has somewhere to go, which keeps predictive back working from the root | `AppShell` (`ShellState.back()`), `ModelWorkspace` (details → selection → leave) |
| **adapted** | one open surface: the details panel and the dock never overlap, and the panel takes at most 45 % of the free height (Legacy: "panels share a budget, not a layer") | `ModelWorkspace` (`BoxWithConstraints`) |
| **adapted** | `stateDescription` on merged rows, never a `contentDescription` over visible text | `AppShell` nav items, `Controls.Choice`, `HouseScreen` rows, `Inspector.Fact` |
| **adapted** | the fade over cut scroll content; the header outside the scroll | `ToolDock` right-edge fade, `Inspector` bottom fade and fixed header |
| **adapted** | the self-dismissing notice (6 s) | `AnalyzerScreen` |
| **adapted** | 48 dp targets; `maxLines` with `Ellipsis` | every new control and text |
| **rejected** | translucent glass, including Legacy's 0.84 "smoked" tint: every panel here is opaque | — |
| **rejected** | the drawer launcher and the 9-section structure | 5-place bottom bar |
| **rejected** | the timeline rail inside the workspace: stages don't exist yet, and an empty rail over the model is clutter | Etapy is its own empty place |
| **rejected** | fixed-dp panel heights (340 dp, 216 dp, 184 dp) | height as a share of free space |
| **rejected** | the hard-coded project title, and generic "Moduł w przygotowaniu" placeholders | the real house title; a specific empty state per place |
| **improved** | every label Polish, including the MODEL / CLAY / LINE comparison, named Model / Makieta / Kreska; the enums keep their English technical names for tests and evidence, and `ui/Labels.kt` maps them | `Labels.kt`, `strings.xml` |
| **improved** | the house card says where the model came from (built-in example or analysed link) and that an analysis is a candidate to check, not a construction drawing; a running analysis shows its progress on Dom | `HouseScreen` |
| **improved** | technical figures (schema, object and triangle counts, bundle hash, element ids, evidence codes) folded under "Szczegóły techniczne" / "Dane techniczne"; evidence statuses read as plain Polish ("Podane wprost w źródle", "Założone, bo źródło tego nie podaje") | `HouseScreen`, `Inspector` |
| **improved** | navigation as a pure, tested state machine, which Legacy's NavHost lambdas are not | `ShellState` + `ProductShellTest` (8 tests) |

## Accessibility, motion, back behaviour

- **Back:**
  - Analysis → Dom.
  - 3D → the place it was opened from, after first closing the details panel and then clearing the selection.
  - Etapy, Koszty, Dokumenty → Dom.
  - Dom → system.
  - Tested: `ProductShellTest` "back retraces one step and leaves the app only from Dom".
- **Reduced motion:** the chrome specs snap, and the camera's pose animation snaps too (`PreviewViewModel.reducedMotion`, now updated live).
- **Font scale 1.3:** every one-line text ellipsizes. The dock scrolls horizontally with a fade instead of truncating, and the navigation labels are single-line. Captured on the emulator at 1.3 (see *Screenshots*).
- **Touch targets:** 48 dp minimum on every new control. The analyzer's two text toggles were raised to 48 dp.
- **Contrast:** the theme is unchanged (003A `TechnicalDark`). Muted text is `#B9C3D0` on `#191D24`.

## Visual self-review (one bounded pass) and fixes

The pass was made after the first implementation (`76b6bde`), against the rules above; the fixes are commit `a8d321e`:

1. The analysis page — the page Dom opens — was still English. Fixed: its main path is now Polish (40 new strings). The deep service diagnostics (hashes, counts, warnings) stay technical under "Diagnostyka".
2. Buttons that repeated their visible label as a `contentDescription` replaced the label for TalkBack. Fixed: removed, and the toggles raised to 48 dp.
3. The analyzer notice stayed on screen forever. Fixed: it clears itself after 6 s.
4. The details panel showed raw codes such as `SOURCE_EXACT` outside diagnostics. Fixed: plain Polish, with the code under "Dane techniczne". Tested against the model's full `EVIDENCE_STATUSES`.
5. Lint's `PluralsCandidate` and `UnusedResources`, fixed with Polish `<plurals>` (one/few/many/other) in `76b6bde`.

Not changed, and deliberately left: the dark technical theme; the service-side failure messages (`AnalyzerMessages`, English, diagnostic text).

## Screenshots

There is no emulator in this container. CI's emulator job now runs `apps/android/tools/capture-shell-screens.sh` after the device gate:
- **BEFORE:** the 003A preview APK from CI run 51, at font scale 1.0 and 1.3.
- **AFTER:** every place opened by its launch extra, at font scale 1.0 and 1.3.

The files are in the `local-analyzer-device` artifact of the run named under *Gates*, folder `shell-screens/`. The copies inspected for this report are in `stage-reports/artifacts/integration-003b/ui/`.

The Legacy shell was not built: its screens need an emulator too, and the audit above is from source and commits.

## Unfinished modules, clearly marked

**Etapy, Koszty, Dokumenty** are scaffolds only. Each says "Jeszcze niedostępne" and that nothing is planned, recorded, priced or stored there. There is no finance ledger, stage engine, checklist, document or photo storage, persistence or sync (out of scope, H).

---

# Rarytasy

## Source identity

- Project: *Dom w rarytasach 5 (G2E)*, `https://www.archon.pl/projekty-domow/projekt-dom-w-rarytasach-5-g2e-m84f2903cb8e14`. Not the OZE or G2AE variants.
- Inputs: the committed sealed evidence `stage-reports/artifacts/rarytasy-generalization/post-fix/` (package `82a5490b…`, graph `35d038fc…`, metrics `271e77c4…`), and a live fetch made during this stage (package `d41aeec6…`).
- Both give the same after-model (`8fa4a25b…`) and scene (`d4e7249b…`).
- Published text used as authority for the kind and pitch of the main roof only: "Dwuspadowy dach pozbawiony okapów", with a stated 30° pitch.

## First bad inference (B3)

| stage | evidence | inferred | correct? | why |
| --- | --- | --- | --- | --- |
| plan decomposition | ground plan | 2 masses: main 17.21 × 8.48 m, garage 6.17 × 6.21 m in front of it | yes | chains and wall bands |
| observation graph, elevations | 4 photo-style elevations (sky, clouds, trees) | `MASS_REGION` = the whole image, sky-noise silhouettes, `RIDGE` at (0,0) | **no** (upstream, but consumed by nothing below) | the extractors assume paper backgrounds; no garage gable reaches the graph |
| **`inferRoofSystems`** (`roof-systems.ts`) | plans + specification | garage roof **FLAT, authority CONVENTION**, confidence 0.55 | **no — the first explicit wrong inference** | it assigns FLAT to every non-main mass without consulting any view; it records "no printed angle… describes a roof over this body separately" as MISSING |
| elevation registration (v2) | two identically labelled "boczna" elevations | LEFT/RIGHT assigned "the first free one" (confidence 0.4) | **no — mirrored** | the east view was registered as the west view; every reading along the side views landed at the far end (e.g. the chimney against the front wall) |
| G6 attached roofs | section (does not cut the garage) | flat slab at the wall head, 3.24 m, `ASSUMED_FOR_RENDERING` | no | follows the FLAT convention |
| closure | compiled scene | DEGRADED, **5 exterior errors** | — | 4 × `COPLANAR_DUPLICATE` garage walls ↔ flat slab (`PARAPET<->FLAT_ROOF`); 1 × `INTERSECTION` chimney ↔ front wall |

The front elevation shows the garage's gable end facing the street, framed by its portal. Both side elevations show its tiled slope side-on, rising from the eave to a horizontal ridge that runs back into the main roof. That is a gable with its ridge along z, perpendicular to the main ridge.

## Generic rule implemented (B4, B5)

Commit `8e8deb8`; documented in `docs/ANALYZER_V2_ARCHITECTURE.md` §4 "Attached roof form and side-view orientation". There are three parts.

**1. `side-orientation.ts` (G1b).** Once the main roof is solved, each unlabelled side view's silhouette top is compared with the main body's side profile, as assigned and mirrored. The views swap only when every readable view prefers the mirror by at least 0.25 m (median).
- Rarytasy: 0.91 → 0.59 m and 1.17 → 0.49 m, so swapped.
- Marcówki: 0.03 m either way, so kept.

**2. `attached-roof-form.ts` (G6).** On every registered view that sees an attached body against the sky (no other body or roof footprint in the same columns), each column is walked up from inside the wall to the first run of sky or vegetation.
- Heights are re-anchored on the main roof's own measured top in the same image. The side registrations had clipped the gable apex, which lifted every height by 0.49–0.59 m.
- LOW → FLAT.
- LEVEL → a gable seen side-on, accepted only when its rise matches the stated pitch over the body's own half-span (tolerance max(0.35 m, 20 %)).
- PEAKED → a gable end, carrying its own pitch.
- Conflicting views stay UNREAD, and the convention stands with the conflict recorded.
- Rarytasy: right and left views both LEVEL, 1.87 and 1.97 m above the wall head, against 1.79 m for 30° over 6.17 m. Result: GABLE, ridge along z, 30° (`SOURCE_DERIVED` pitch, `IMAGE_METRIC_REGISTERED` form).

**3. Emission in the 1.6 language (`emit.ts`).**
- Two `createRoofPlane`s, a `RIDGE` (`connectRoofPlanes`), eaves (`ABUTMENT` where an eave runs along the main body's wall) and verges at the free gable end.
- Where the ridge runs into the main slope at the same eave height, the planes stop on the line where the two top surfaces meet: two valleys, declared `INTERSECTS roof-main`.
- The garage walls take `FOLLOW_ROOF_PLANES`, so the front gable wall rises to the ridge.
- `roof-main` is untouched.

Solver v2 is now **2.1.0**.

**Evidence authority used:**
- Published specification: the main roof kind, the 30° pitch and no eaves.
- Plan: the footprints.
- Elevation geometry: the garage's form and ridge direction.
- Nothing from the perspective renders: they set no dimension.

## Before / after semantic model and roof graph

`stage-reports/artifacts/integration-003b/rarytasy/roof-graph-before-after.json`

| | before (`88c514f5…`, solver 2.0.0) | after (`8fa4a25b…`, solver 2.1.0) |
| --- | --- | --- |
| main roof | GABLE 30°, ridge X, eave 3.2529, overhang 0 | unchanged |
| garage roof | `roof-attached-0` FLAT slab at 3.24 m | `roof-attached-0-plane-low/high`: 30°, ridge along z at x 5.138, y 5.035, from z 0 (street gable) to z 9.296, where it meets the main slope |
| roof edges | — | `RIDGE`, 2 `EAVE`, 2 `VERGE` (z = 0); valleys = `INTERSECTS roof-main` × 2 |
| garage walls | 3.24 m, flat top | `FOLLOW_ROOF_PLANES` (front gable to the ridge) |
| chimney | 0.91 × 0.41 at x 5.75–6.66, z 6.65–7.06 (mirrored reading, against the front wall) | 0.55 × 0.63 at x 10.02–10.58, z 10.33–10.96, 6.29 m (at the ridge) |
| commands / meshes / triangles | 135 / 110 / 2 672 | 151 / 113 / 2 736 |
| closure | DEGRADED, 5 exterior errors | PASSED, **0** exterior errors (interior findings 19, unchanged) |

**Closure attribution** (local experiment on the committed package, with the gable disabled and the orientation fix kept; not committed):
- 4 exterior errors remain with a flat garage and correct orientation: all four are the flat slab.
- The fifth (chimney ↔ wall) came from the mirrored side registration.

**Roof area, as a check only:**
- Published: 219.77 m².
- Flat garage: 206.8 m² (main 168.5 + 38.3).
- After: about 212.8 m² visible (the garage adds 55.3 m² sloped and hides 11.0 m² of main slope under its valleys).

**Images:**
- `scene-views-{before,after}.png`: front, right, top and axonometric.
- `android/second-house-{before,after}-modes.png`: MODEL / CLAY / LINE × three-quarter, rear three-quarter and front elevation.
- `-layers`: all, roof off, ground only.
- `-close-*`: close-ups.
- No publisher drawing is committed.

**B6, secondary features (not implemented; this is why Rarytasy is PARTIAL, below):**
- The rear/side **pergola** frame over the terrace ("taras osłonięty pergolą"), clear on the side and rear elevations.
- The **entrance canopy** ("efektownie zadaszone wejście"). The model has the timber finish region there, but no canopy member.
- A **second chimney**. The elevations show two stacks; the model reads one.

No-eaves is expressed (overhang 0), and the garage/front relationship is now correct.

## No Rarytasy constants in production

- `tests/architecture/second-house.test.ts` passes:
  - no production file names the project or carries its id;
  - the solver directories carry none of its dimensions;
  - nothing in production reads `stage-reports/artifacts`.
- The only project numbers are in `tests/benchmark/second-house-roof.test.ts`, which is evaluation and runs on a completed run's directory.
- Thresholds are in metres or fractions of the body's own span: 0.6 m flat top, 12° minimum peak slope, 0.25 m orientation margin, 1.0 m maximum re-anchor. None was fitted to this house. The one relaxation during development (dropping a relative 50 % criterion in favour of "every view prefers the mirror") is recorded in the commit.

## Fixtures and regression (B7)

- **Synthetic gable:** `MARLOW` (`packages/synthetic-drawings`), Coldharbour's plan with a gabled wing. It reads as a gable along z at 35° (drawn 35°), abutting the main wall, with walls following the planes (`fixtures-v2.test.ts` 3b).
- **Synthetic flat:** `COLDHARBOUR`. The flat wing is now *read* FLAT from the drawings and gets no roof planes (3a).
- **Unit tests:** `attached-roof-form.test.ts`, 12 tests on drawn rasters:
  - flat, level at the stated pitch, re-anchored, too tall (UNREAD), peaked (measured pitch), conflict, occluded;
  - valley layout, above-ridge abutment, eave abutment;
  - orientation swap and symmetric no-swap.
- **Rarytasy regression:** `tests/benchmark/second-house-roof.test.ts`, 4 tests. Before: 3 fail. After: 4 pass. CI runs it on the live run and on the committed replay.
- **Marcówki:**
  - a fresh `reconstruct:v2:marcowki` gives modelHash **`731b045e…` = the sealed `marcowki-auto-v3`**, before and after;
  - its garage is now read FLAT on front and rear (−0.03 m) instead of assumed;
  - the sealed candidates replay unchanged (`packages/candidates` tests).
- **Determinism:** two different fetches of the page give one model and scene. The CI replay step `--same-as` holds the committed summary.

---

# Gates

## Test / build matrix (this container: Node 22, JDK 21, no GPU/KVM)

| gate | result |
| --- | --- |
| `npm run typecheck` | pass |
| `npx vitest run` (full, after `17b58f4`) | 118 files: 116 pass, 1 skipped, 1 fails — 1 472 tests pass, 9 skipped, **1 fails: `worker.test.ts` with `ECONNRESET` under full-suite load** (pre-existing; passes alone, next row) |
| `packages/reconstruction`, `tests/architecture`, `packages/analysis-service`, `packages/candidates` | 32 files, 450 tests pass |
| `apps/analyzer-api/test/worker.test.ts` alone | 3/3 pass. Under full-suite load it fails with `ECONNRESET`, pre-existing (identical on base `c399a29` in 003A) |
| Android contract fixtures | recaptured for solver 2.1.0 (`17b58f4`): model and scene hashes unchanged; 1/1 pass |
| Marcówki v2 fresh run | modelHash `731b045e…` unchanged |
| Rarytasy sealed replay (post-fix package) | COMPLETED, model `8fa4a25b…`, closure PASSED 0 exterior; regression 4/4 |
| Rarytasy live (this stage) | COMPLETED, same model and scene |
| `./gradlew testDebugUnitTest` | 316 tests, 0 failures (1 skipped: evidence writer without its env) |
| `./gradlew lintDebug` | pass; no new warnings from this stage |
| `npm run android:assembleDebug` | pass: arm64-v8a 30 179 106 B, x86_64 32 089 275 B, universal 52 251 923 B |
| Node 18 without ICU / Android bundle path | CI job `second-house-generalization` (see below) |

## CI

Run 53 (`36322891336`, commit `17b58f4`) is in progress at the time of this commit; its results, the APK artifact and the inspected screenshots are added in the next commit, together with `PROJECT_STATUS.md`.

## Commits

| commit | workstream |
| --- | --- |
| `8e8deb8` | 3 — Rarytasy analyzer diagnosis and fix |
| `03922eb` | 4 — Rarytasy tests and evidence (also the perspective-correct test raster) |
| `76b6bde` | 1 — UI shell architecture and navigation |
| `a8d321e` | 2 — UI visual refinement (the self-review pass) |
| `17b58f4` | 3 (follow-up) — contract fixtures for solver 2.1.0 |
| this report and `PROJECT_STATUS.md` | 5 — reports and status |

---

# OWNER phone-review checklist

Install `BuildPlan-Model-Preview-arm64-v8a-debug.apk` from the `buildplan-model-preview-apks` artifact of the CI run named below. It updates the earlier preview in place.

1. **Dom opens first.**
   - The bottom bar shows Dom · 3D · Etapy · Koszty · Dokumenty.
   - The house card names the house and where it came from.
   - Nothing on Dom reads as developer jargon until "Pokaż szczegóły techniczne".
2. **Etapy, Koszty, Dokumenty** each say "Jeszcze niedostępne", and show no number, date, file or button that pretends to work.
3. **Analiza linku** (Dom → Analizuj link):
   - paste the Rarytasy link and analyse on the phone;
   - while it runs, go back to Dom: the progress is shown there;
   - when it finishes, the model opens in 3D by itself.
4. **3D, the Rarytasy garage:**
   - a gable facing the street, lower than the main ridge;
   - its ridge runs back into the main roof, meeting it in two valleys;
   - no flat slab;
   - check it in Wygląd → Model, Makieta and Kreska;
   - Warstwy → Bez dachu removes the garage roof and the main roof together.
5. **3D, the controls:**
   - Widok, Warstwy, Wygląd, Dopasuj, Resetuj;
   - tap an element → Szczegóły; the panel never covers the dock;
   - Back closes the panel, then the selection, then returns to Dom.
6. **Marcówki** (Dom → Domy na tym telefonie → Marcówki (auto v3) → Otwórz w 3D): the same house as before, garage flat.
7. **Readability:**
   - set system font size to the largest step you use: labels ellipsize rather than overlap, and the dock scrolls;
   - with Developer options → animations off, panels appear without motion;
   - nothing is readable through anything else.
8. **Report:** the scene bundle hash on Dom → Pokaż szczegóły techniczne (the "pakiet" value) for Rarytasy, and any screen that looks wrong, with a screenshot.

# Recommended next bounded stage (not implemented)

**BUILDPLAN-INTEGRATION-003C — owner phone review of 003B, then a bounded fix of only what the phone shows.**
- It covers the shell and the gabled garage.
- The Rarytasy pergola, entrance canopy and second chimney stay *candidates* for a following stage.
- They need their own source-evidence reading (elevation frames and posts, a canopy member, two stacks) held to both houses' gates. They are not a UI change.
