# N9-00 — module map of the one production path

`runAnalysis` → SourcePackage → source-analyzer → source-metrics → reconstruction v2 → command DSL → CanonicalBuildingModel → geometry → web BuildWorld / Android MobileSceneBundle.

Base `0d03d60`; paths are under `/home/user/BuildApp/`.
- **CV** = CODE_VERIFIED: the line was read, by the audit or by the read-only code sub-audit, and the key lines were re-read by the audit.
- **NV** = NOT_VERIFIED: internals not read.
- "Not consumed" is checked by grep over `packages/*/src` and `apps/*/src`, excluding tests and `research/`.

The view-registration states are `REGISTERED | OPENINGS_ONLY | POSITIONS_ONLY | NOT_REGISTERED | DUPLICATE | PERSPECTIVE_CHECK_ONLY | PERSPECTIVE_UNUSED` (`v2/view-audit.ts:17-29`). There is no FULL/PARTIAL/UNREGISTERED enum. This audit maps:
- REGISTERED → FULL;
- OPENINGS_ONLY and POSITIONS_ONLY → PARTIAL;
- NOT_REGISTERED → UNREGISTERED.

## Stage table

| # | stage | entry | creates | filters or drops (recorded where) | consumed by | reaches the verdict? |
|---|---|---|---|---|---|---|
| 0 | orchestrator | `packages/analysis-service/src/run.ts:170` `runAnalysis` | `AnalysisRun {result, pkg, graph, metrics, reconstruction, sceneText, closure, trace}` | Throws `NO_DRAWINGS` / `SOURCE_INCOMPLETE` without plan and elevation (`:256-267`). A raster decode failure is stored as `undefined` (`:319-323`) and surfaces only as a metric gap. | — | Job status is `COMPLETED` for every non-throwing run (`run.ts:578`, `apps/analyzer-api/src/job.ts:126-130`) **CV** |
| 1 | source package | `packages/source-package/src/acquire.ts:68` | Assets with roles {document, storey, view, projection}. Role claims merged by highest confidence; ties → UNKNOWN (`roles.ts:43-57`). | `pkg.failures`: budget, format, byte-identical, different crop, fetch. Technical PDFs are listed in `documents[]` and never parsed. **CV** | warnings (LIMITING/INFO) | No **CV** |
| 2 | observation graph | `packages/source-analyzer/src/analyze.ts:99` | Elevation observations: SILHOUETTE, MASS_REGION, ROOF_EDGE, RIDGE, OPENING… Section: LEVEL_DATUM, ROOF_EDGE, RIDGE, STAIR. Cross-view relations. | `graph.unresolved`: missing bytes, decode, no observations. A perspective is refused as a facade (`:170-173`). Site plan has no extractor. **CV** | `graph.unresolved` has **no reader** in reconstruction or analysis-service (grep **CV**). `graph.relations` is used only as a trace count. | No |
| 3 | metric evidence | `packages/source-metrics/src/extract.ts:320` (reader 1.5.0, `:65`) | OCR tokens KEPT/DISCARDED; OPENING_CALLOUT, LINEAR_DIMENSION, LEVEL_DATUM, ANGLE; chains; frame registrations (≥ 2 anchors) | `metrics.unresolved` (scale implausible, datum row, unattached…). A ring with no width or height candidate is dropped by `continue` with **no record** (`:776-789`). **CV** | `metrics.unresolved`: trace counts only (`run.ts:396`). **`ELEVATION_HY` registrations: no reader in the solver** (grep **CV**). | Metric confidence WEAK or INCONCLUSIVE → LIMITING warnings; INCONCLUSIVE may throw **CV** |
| 4a | layout and gate | `packages/reconstruction/src/structural.ts:59`, `layout-gate.ts:104`, `structural-audit.ts:125` | Masses, gate reasons, roof systems (`roof-systems.ts:152`, pitch authority PUBLISHED 5 … CONVENTION 0) | Layout refused only for FOOTPRINT_AREA_WRONG, MASS_OVERLAP, NO_MASS, NO_STOREY (`plan-diagnostics.ts:264-267`). **No registered elevation → NOTED.** **CV** | modelCompleteness (BLOCKING / DEGRADING) | **Yes**: the only source-side input besides bodies |
| 4b | frames and registration | `v2/frame.ts:134` planFrameV2, `:412` registerElevationV2 | Plan frames per storey. Elevation registration by span vs silhouette, apex on the ridge datum; wall-band fallback → OPENINGS_ONLY; corners → POSITIONS_ONLY | Refusals into `viewRefusals` and gaps (MISSING / AMBIGUOUS / REFUSED). No ridge datum → every elevation refused (`reconstruct-v2.ts:731-733`). **CV** | `viewAudit` (`:2812`): **no production reader** (grep **CV**) | No |
| 4c | masses, main roof, thin bodies | `reconstruct-v2.ts:533-1252` | Mass features, main roof from section datums and elevation apex votes, hip ends from elevations | AMBIGUOUS / MISSING gaps **CV** | building | Through bodies only |
| 4d | party walls | `v2/party-wall.ts:254` | ONE_WALL / TWO_WALLS / UNDECIDED / OPEN per contact | UNDECIDED → gap. Gaps on an open contact are dropped as a REFUSED step, no gap (`reconstruct-v2.ts:1573-1576`). **CV** | emit, joinRooms | No |
| 4e | slab voids | `v2/slab-void.ts:66` | SlabVoid (traced outline) | Refusals go to `featureTrace` (not passed in production) and a step: **not in `unresolved`** (`reconstruct-v2.ts:1433-1436`). **CV** | emit (slab holes), interior (room holes) | No |
| 4f | interior | `v2/interior.ts:187` readInterior | Partitions, door gaps, blocks, rooms, room numbers | Thin free bands dropped as furniture (unresolved). A number naming no published room is dropped **silently**. A stair `assembleStair → undefined` is silent (`house-stair.ts:70`). **CV** | emit; ROOM features | No |
| 4g | wall openings | `v2/openings-v2.ts:451` readWallOpenings | Plan gaps × callouts (`opening-reading.ts:38`, conf ≥ 0.2) × view extents | Band views accepted per wall only with ≥ 2 gaps (to `featureTrace`). Assumed heights recorded as unresolved notes. Pocket mouths REFUSED. Unmatched callouts → ledger only, not a gap. **CV** | emit | No |
| 4h | roof details | `reconstruct-v2.ts:1808-2131` | Section registration, eaves, attached roofs, chimneys, rooflights, verges | A chimney with no section stack is dropped to `featureTrace` only. Rooflight patches over a chimney are skipped silently. **CV** | emit | No |
| 4i | valley cut | `v2/valley-cut.ts:221` | Main gable as planes cut back to wing valleys | Refusal in emit becomes `notes.push(...)` (`emit.ts:647`). **`emitted.notes` is never read** by the solver (grep **CV**: only `program`, `bindings`, `topology`, `dropped` are used). | emit | No |
| 4j | facade alignment | `v2/facade-alignment.ts:112` | Plan-opening ↔ elevation-reading comparisons; MISSING_IN_MODEL "reported, not built" | Conflicts go only to `facadeAlignment.comparisons` plus one step; no gaps **CV** | sill/head corrections only (`reconstruct-v2.ts:2531`); **no production reader** of the record | No |
| 4k | verify, repair, cross-view | `v2/verify.ts:42`, `:270`; `v2/cross-view.ts:76` | Residuals on silhouette-registered views; AGREES / MIXED / DISAGREES per view | "Not observed" = outside tolerance **CV** | `residuals` count → `verification` and the LIMITING warning `RESIDUALS_OUTSIDE_TOLERANCE`; `crossViewResiduals` **not consumed** | No |
| 4l | emit, fit, completeness | `v2/emit.ts:150`; `candidate.ts:895` fitPreviewProgram; `body-completeness.ts:92,248` | Command program; preview fit; bodyCompleteness; **modelCompleteness** (`reconstruct-v2.ts:2700`) | Interior door gap < 0.5 m or not fitting the run: **silently skipped** (`emit.ts:592`). A void off the slab is dropped silently (`emit.ts:366-372`). Openings shrunk, lowered or dropped by the fitter (DROPPED → gap + warning). WALLS_OVERLAP refusals reconciled. **CV** | result `preview.completeness` | **This is the verdict** |
| 4m | ledger, graph, quality | `v2/ledger.ts:59,76`, `v2/quality.ts:50-59`, `v2/graph.ts:248` | Evidence dispositions (USED / IGNORED / REJECTED_WITH_REASON / UNRESOLVED); quality L0/L1/L2 | Unconsumed evidence gets a disposition (`reconstruct-v2.ts:2761-2802`). E.g. a LINEAR_DIMENSION on an unregistered frame → IGNORED; OPENING on a non-elevation → IGNORED. **CV** | `quality` levels in the result; violations → warning | No |
| 5 | commands → model | `packages/commands/src/apply.ts:131`; `packages/model/src/validate.ts:37,55` | CanonicalBuildingModel 1.7.0 | Any semantic ERROR rejects the command. WARNINGs are returned and ignored by `runCommands`. **CV** | candidate, scene | ERROR → refusal → PARTIAL (if not fitted away) |
| 6 | geometry | `packages/geometry/src/compile.ts:148`; `closure.ts:620` | Meshes, diagnostics; closure findings | `run.ts:440-454` does **not** inspect `scene.diagnostics` (only throws on exception); closure ERRORs → the warning `EXTERIOR_JOINTS` **CV** | bundle, web status bar ("geometry ok" = 0 diagnostics) | No |
| 7a | Android | `packages/mobile-scene/src/bundle.ts:322`; `apps/android/app/src/main/java/com/buildplan/preview/ui/AnalyzerScreen.kt:680-696` | Scene bundle 1.0.0 (meshes, diagnostics, per-object evidence) | The bundle carries **no completeness and no warnings**. The phone headline comes from the API summary: partial → PARTIAL; **any unresolved or LIMITING warning → LIMITED**; else completeness. **CV** | owner | All 8 corpus houses have unresolved gaps, so every one would head **LIMITED** (RV: `source-coverage-8.json` `unresolvedByStatus`) |
| 7b | web | `apps/web/src/analyzer/client.ts:47-67`; `packages/editor/src/store.ts:159` | Recompiles the model JSON locally | The web summary type has no `preview`, `completeness` or `warningDetails` fields **CV** | owner | — |

## Where the drawings other than the plan are used

**ELEVATION** (CV call sites in `reconstruct-v2.ts`):
- gate shape audit (`structural.ts:143`);
- registration (`:700-836`);
- ridge axis and hip ends (`:860-977`);
- side orientation (`:985-1159`);
- thin-body adjudication (`:1168-1188`);
- opening sill and head (`:1567`);
- attached roof form (`:1843`);
- chimney heights (`:1909-1934`);
- rooflights (`:1955-1972`);
- verges, fascias, balconies, railings (`:2056-2131`);
- wall tones (`:2268-2362`);
- facade scan and alignment (`:2433-2531`);
- residuals (`:2535-2537`).

The metric reader's `ELEVATION_HY` registrations are never read.

**SECTION:**
- storey levels and ridge datum (`levelsFrom`, `solve.ts:252-295`);
- roof kind and rise (`roof-systems.ts:202-224`);
- eaves overhang;
- flat attached roof;
- chimney stack;
- stair corroboration;
- terrain datum.

The section is **never registered as a view or checked** against the model (`registrations.section` absent in 8/8 houses, RV).

**PERSPECTIVE:**
- never a facade (`analyze.ts:170-173`);
- skipped by metrics (`extract.ts:94-95`);
- a camera is solved when a main roof exists (`reconstruct-v2.ts:2249-2261`) and creates a CAMERA feature and a ledger disposition only. **No geometry changes from it.**
- RV: 30 of 101 renders CHECK_ONLY, 71 UNUSED.

## Computed but never consumed by production

These live only on `AnalysisRun.reconstruction` (grep **CV**):
- `viewAudit`;
- `crossViewResiduals`;
- `facadeAlignment`;
- `thinBodies`;
- `partyWalls`;
- `zoneBodies`;
- `openingCounts`;
- `bodyCompleteness.areas`;
- `registrations`;
- emitter `notes`;
- `graph.unresolved`;
- `metrics.unresolved`;
- `ELEVATION_HY` registrations.

The richest source-fidelity signals the system computes are on this list.
