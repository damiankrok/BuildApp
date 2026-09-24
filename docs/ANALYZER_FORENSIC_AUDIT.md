# ANALYZER FORENSIC AUDIT (BUILDAPP-03X §7)

The analyzer as it stood at the start of this stage (HEAD `d5d6375d…`, the 03R1 Marcówki Auto: model hash `5f57e568c0fed565`, 44 commands, 2 masses, 13 openings, 1 linear solid, 0 rooms/doors/stairs/balconies/chimneys/rooflights/railings), traced feature family by feature family through

`SOURCEPACKAGE → OBSERVATION → METRIC EVIDENCE → FEATURE HYPOTHESIS → STRUCTURAL LAYOUT → PRIMITIVE HYPOTHESIS → DSL → CANONICAL MODEL → COMPILED GEOMETRY → SOURCE-VIEW VERIFICATION`

with, for each stage, PRESENT / LOST / CONFLICTED / NOT_ATTEMPTED / UNSUPPORTED and the **exact first loss point**. File references are `package/src/file.ts:line` at the start HEAD. The ground truth the families are held to is `research/marcowki-v2/MARCOWKI_SOURCE_TRUTH_V2.md`.

## 0. Facts that apply to every family

| # | fact | where |
| --- | --- | --- |
| F1 | The observation-graph RELATIONS (PROUD_OF, CONTINUES_ACROSS, POSSIBLY_SAME_FEATURE, CORROBORATES…) and CONFLICTS are read by nothing in `packages/reconstruction/src`. Cross-view identity therefore never reaches the solver. | no `graph.relations` / `graph.conflicts` reader |
| F2 | Of the 33 observation kinds, the solver reads six: OPENING / WINDOW / DOOR (`reconstruct.ts:233`, `audit.ts:110`), LINEAR_VOLUME_CANDIDATE (`reconstruct.ts:235`), SILHOUETTE and MASS_REGION (`views.ts:67,90,95`), STAIR / STAIR_SYMBOL as a count (`reconstruct.ts:1255`). WALL_BAND (401 on this package), OPENING_INTERVAL (33), LOGGIA (18), SURFACE_REGION (67), ROOF_EDGE (36), RIDGE (9), PARALLEL_LINE_FAMILY (17) are never read. | agent inventory |
| F3 | The PrimitiveHypothesisSet is an OUTPUT record: `reconstruct.ts` pushes a hypothesis beside each DSL command it has already decided to emit; nothing reads the set back. Only 6 of its 18 kinds are ever emitted (BUILDING_MASS, WALL_RING, ROOF_SYSTEM, DOOR, WINDOW, LINEAR_SOLID). | `reconstruct.ts:350,386,473,1070,1231` |
| F4 | The solver reads only part of the sealed StructuralLayout: masses, storeys, roofSupports, unresolved, gate, the exterior facade pieces, and footprintRegions only to find a pixelRect (`reconstruct.ts:630`). `attachments`, `recesses`, `alternatives`, `conflicts`, `traces` and every ZONE/RECESS region are sealed and never consumed. | `reconstruct.ts` |
| F5 | The vision pass is the null provider (`scripts/reconstruct.ts:61`), so every vision-only kind (WINDOW, DOOR, ROOM_LABEL, ROOM_AREA, CHIMNEY, BALCONY, RAILING, EAVE, …) is absent from the production graph by construction. | `source-vision/src/providers/null.ts:20` |
| F6 | The metric layer reads ORTHOGRAPHIC_PLAN / ELEVATION / SECTION frames only (`source-metrics/src/extract.ts:72-73`); perspectives yield observations but never metrics. `solveCamera` / `registerPerspectivePlane` have no production caller. | `image-metrology/src/camera.ts:141` |
| F7 | The DSL is used at a fraction of its vocabulary: setModelName, createBuilding, defineMaterial, createLevel, createSlab (never with `holes`), createWallRing (always EXTERIOR), createRoof, cutOpening (never with `head` or `leaves`), placeWindow (no mullions), placeDoor (no assembly), createLinearSolid. Never: createRoom, createWall INTERIOR, createWallJunction, cutRoofOpening, placeRooflight, createBalcony, createRailing, placeChimney, createStair(Placeholder), createSurfaceRegion, setEvidence. | `commands.ts` vs `reconstruct.ts` |
| F8 | **The world frame is mirrored in z.** The plan frame puts z = 0 at the REAR wall outer face (`layout.ts` WorldFrame originPx = the envelope's top row, flipY) and z grows towards the sheet's bottom; the solver names the max-z ring wall FRONT (`reconstruct.ts:84`, `WALL_INDEX.FRONT = 2`). `MODEL_FRAME` says the front facade outer face is z = 0. The reference model obeys MODEL_FRAME; the Auto does not, so the two show their fronts on opposite sides of the same viewer. | `reconstruct.ts:84`, `model/src/schema.ts:MODEL_FRAME` |
| F9 | The source-view "verification" never checks this package: the four rendered elevations' traced SILHOUETTEs cover 100 % of the sheet, so `auditStructuralProjection` reports every view NOT_CHECKED and `worstResidualM` = 0 means unchecked, not perfect (`structural-audit.ts:163-169`). The post-emission `auditProjection` compares openings only, uses `opening.offset` as u without the mass offset (`audit.ts:121-122`), and matched 5 of 13. | |
| F10 | OCR: the callout reader exists (`extract.ts:290-319`, regex `^\d{2,4}/\d{2,4}$` in `parse.ts:67-72`) but the OCR never produces a clean `110/230` token on this package (tokens read: `13/`, `11/`, `1/`, …), so the metric set carries **0 OPENING_CALLOUT** readings. The digits sit inside a circle split by a bar; the ring merges with the glyphs in the ink mask and the component is dropped or fragmented. | `source-metrics/src/ocr.ts` |
| F11 | The attic plan is mis-registered: PLAN_XZ for `frame-asset-rzut-117027f690` fits 0.04694 m/px (6 anchors) where the sheet is 0.0265 m/px like the ground plan (its outer faces are px 47..345 for 7.90 m). The layout then aligns the attic by shape onto the ground plan (`alignPlans`) and produces an upper footprint 7.71 m wide. | `extract.ts:598-654`, `layout.ts:290-420` |

## 1. Frame, main structure, storeys

| stage | status | detail |
| --- | --- | --- |
| SourcePackage | PRESENT | 20 assets / 26 variants; plans, section, 4 elevations, 3 perspectives, site plan, page facts, room tables, spec. |
| Observation | PRESENT | WALL_BAND ×64 on the ground plan, ×52 on the attic; SILHOUETTE/MASS_REGION per render. |
| Metric | PRESENT / CONFLICTED | 75 LINEAR_DIMENSION, 4 LEVEL_DATUM (−0,32 missed), spec ANGLE 40; ground PLAN_XZ correct (0.026426), attic PLAN_XZ wrong ×1.78 (F11). |
| Structural layout | PRESENT | 2 masses 7.90 × 12.61 and 4.15 × 7.51, storeys 0..1 and 0, SHARES_WALL_WITH / ATTACHED_TO at x 7.9; gate ACCEPTED. Attic footprint 7.71 wide (F11). |
| Primitive / DSL / model | PRESENT (mirrored) | rings + slabs per mass and storey; frame mirrored in z (F8). |
| Verification | NOT_ATTEMPTED | F9. |

First loss: **F8** (frame) at `reconstruct.ts:84`; **F11** (attic scale) at `extract.ts:598-654`.

## 2. The 14.60 topology: zones, recesses, returns

| stage | status | detail |
| --- | --- | --- |
| Source | PRESENT | 100 / 510 / 750 / 100 chain; return stubs drawn in both zones on both plans; side silhouettes 14.5..14.6 m; 18 LOGGIA observations (`recess-mouth`) on renders. |
| Observation | PARTIAL | WALL_BAND covers the return stubs only if they pass the band length threshold (5 % of the edge: 43 px; the stubs are 38 px long) — mostly LOST; LOGGIA present on renders. |
| Metric | PRESENT | the 100 segments are LINEAR_DIMENSION readings and chain segments. |
| Structural layout | **LOST** | `zonesOutsideEnvelope` (`layout.ts:1073-1104`) turns the dimensioned strips beyond the walled envelope into ZONE regions with `wallEvidence 0`, no return check, spanning the whole envelope width (x 0..12.05 for both). `decomposePlan` can classify RECESS only for cells **inside the walled envelope** with ≥ 3 shut edges (`plan-decomposition.ts:913-915`), so a 1.00 m zone can never be a RECESS; `recessesOf` (`layout.ts:1262`) reads only RECESS regions → `recesses: []`. |
| Primitive / DSL | **LOST** | `reconstruct.ts` never reads `layout.recesses` or a ZONE region (F4): no return walls, no recess floor, no roof over the zone. The attached roof's `overhang` even absorbs the zones: the side elevations' surplus width (≈ 0.95 and 0.77 m, `views.ts:205-206`) becomes SOFT constraints on the FLAT garage roof (`reconstruct.ts:432-437`) → overhang 0.838 on the garage. |
| Verification | NOT_ATTEMPTED | F9; the registration ADDS the zones to "overhang" instead of testing them. |

First loss: **`layout.ts:1073` / `plan-decomposition.ts:913`** — the zone is evidence, the stubs in it are never scanned, and nothing downstream reads a ZONE.

## 3. Roofs: main, attached, chimneys, rooflights

| stage | status | detail |
| --- | --- | --- |
| Source | PRESENT | spec 40° gable "bez okapów"; section datums, 252 garage height, parapet upstand; chimney blocks on both plans; 78/118 callouts + dashed symbols; renders. |
| Observation | PARTIAL | ROOF_EDGE (verge/gable, with image-space angles) and RIDGE points on every render and the section; NO chimney, rooflight, eave or garage-roof observation (F5; the `rooflight`, `chimney`, `eave` hints are never emitted). |
| Metric | PRESENT | ANGLE 40 (PUBLISHED_SPECIFICATION), LEVEL_DATUM 0 / 3.06 / 4.67 / 7.95; 78/118 would parse as an OPENING_CALLOUT (78 cm wide) if the OCR read it (F10). |
| Structural layout | PRESENT / PARTIAL | main roof GABLE 40° ridge Z on PUBLISHED_SPECIFICATION (`roof-systems.ts:78-93, 205-215`); attached roof FLAT on CONVENTION with `eaveLevelM` = storey top and `overhangM` 0 ASSUMED (`roof-systems.ts:173-199`). |
| Primitive / DSL | PARTIAL / **LOST** | main roof footprint = `ringBounds(mass.ring)` (`reconstruct.ts:422,462`) 0..12.61, overhang HARD 0 from "bez okapów" (`roof-systems.ts:289`): the roof does not reach the outer planes (truth: z 0..14.60). Garage roof `eaveOffset` = 3.06 (the storey height, `reconstruct.ts:423`; the section's 252 clear height and the slab rows are never consumed), overhang 0.838 (family 2). No chimney, rooflight or roof opening code exists. |
| Verification | NOT_ATTEMPTED | ROOF_EDGE / RIDGE observations are never compared with the model. |

First loss: main roof extent at **`reconstruct.ts:462`** (footprint by construction = walled mass); garage roof height at **`reconstruct.ts:423`**; chimneys/rooflights **UNSUPPORTED** (no observation, no hypothesis, no command).

## 4. Exterior openings

| stage | status | detail |
| --- | --- | --- |
| Source | PRESENT | 12 major openings, each with a printed `w/h` callout on the plan; reveals on 4 renders. |
| Observation | PARTIAL | plan OPENING_INTERVAL ×2 on the ground plan (gap detector needs both band edges absent and drops gaps touching a band end, `extractors/plan.ts:104,154`); OPENING rectangles ×13..22 per render (`extractors/elevation.ts:245-271`), no reveal/sill/head/family kinds, no raked shapes (axis-aligned only). |
| Metric | **LOST** | 0 OPENING_CALLOUT (F10). |
| Structural layout | n/a | |
| Primitive | PARTIAL | `planOpenings` (`plan-openings.ts:157-272`) re-detects gaps on the 4 sides of each mass rect from the raster: 15 gaps; callout match impossible (0 callouts); heights: elevation readings accepted only if two readings agree or a LINE_DRAWING single source (`reconstruct.ts:982-987`) → none settled on rendered elevations → every height is the CONVENTION 2.2 / sill 0.9-or-0 (`reconstruct.ts:999-1018`). Gable-end openings are cut down to the MINIMUM roof rise over their span (`reconstruct.ts:562-563, 1036-1051`) → 1.68 tall rectangles instead of raked heads. |
| DSL | PARTIAL | `cutOpening` never with `head` (RAKED) or `leaves`; `placeWindow` without mullions; `placeDoor` without assembly (`reconstruct.ts:1063-1065`). Result on Marcówki: 10 of 12 openings placed within 0.2 m, every height/sill/profile wrong (see `MARCOWKI_REFERENCE_AUDIT.md` §5). |
| Verification | PARTIAL | `auditProjection` 5/13 matched, 66 observed rectangles unexplained (mostly cladding/reflections); its u ignores the mass offset (`audit.ts:121`). |

First loss: **the OCR on callout circles** (`source-metrics/src/ocr.ts`, F10); second: **`reconstruct.ts:982-1018`** (heights refused → conventions) and **`reconstruct.ts:1063`** (no RAKED head).

## 5. Interior: partitions, doors, rooms

| stage | status | detail |
| --- | --- | --- |
| Source | PRESENT | 0.12 m partitions, door gaps with swings, room numbers, published room table with areas. |
| Observation | PARTIAL | thin partitions appear as WALL_BAND only if they pass the same 0.4 % thickness floor (they are 4–5 px at 853 px: mostly LOST); OPENING_INTERVAL never for interior gaps; ROOM_LABEL / ROOM_AREA vision-only (F5); `pkg.publishedRooms` is read by nothing. |
| Metric | NOT_ATTEMPTED | no ROOM_AREA evidence is produced (`schema.ts` kind exists). |
| Structural layout | PARTIAL | interior bands feed the grid lines and edge closures (`plan-decomposition.ts:265-377, 837-858`) and the "one body or two" test (`:1096-1124`), then are discarded. |
| Primitive / DSL | **NOT_ATTEMPTED** | no createRoom, no INTERIOR createWall (`reconstruct.ts:380` is always EXTERIOR), no interior doors; `planOpenings` scans only the four outer sides of a mass. No unresolved entry even names the interior. |

First loss: **`plan-decomposition.ts:837-858`** (interior ink consumed as closure only) and the absence of any interior pass.

## 6. Stairs

| stage | status | detail |
| --- | --- | --- |
| Source | PRESENT | tread ladders in three bands on both plans, walking line with arrow, section step profile with five risers and a landing. |
| Observation | **LOST** on plans / PARTIAL on section | `readStair` (`source-analyzer/src/stair.ts:464`) emits only the single best run and refuses a run that is bounded on both sides with no arrow and no turn, or outside the wall-band extent, or with < 2 stringers (`stair.ts:474-487`); runs with < 4 treads, spacing < 1.8 % of the edge, spacing CV > 0.42 or short treads are dropped silently (`:238,321,337-343`). On the 853 px plans no stair is read (the file says so, `stair.ts:102-110`). The section yields one STAIR polyline with count 4 (`extractors/section.ts:136-150`). Landings, rise, going, width: never produced. |
| Metric | NOT_ATTEMPTED | no stair quantity is a metric kind. |
| Primitive / DSL | **REFUSED** | `reconstruct.ts:1253-1268` counts STAIR observations and records REFUSED; no createStair / createStairPlaceholder; no slab hole. |

First loss: **`source-analyzer/src/stair.ts:474-487`** (the plan ladders are refused) and **`reconstruct.ts:1255`** (no consumer beyond a count).

## 7. Characteristic facade: returns, verge members, fascias, portal

| stage | status | detail |
| --- | --- | --- |
| Source | PRESENT | white returns and verge band continuous around the timber gable; dark band 2.28..3.07 from the balcony to the garage; garage box with parapet. |
| Observation | PARTIAL | LINEAR_VOLUME_CANDIDATE only when a strong depth cue exists (`depth.ts:51,348`), hint only `beam`/`column`; `side-return` hint at recess edges (`elevation.ts:218-227`); no verge/fascia/portal/parapet kinds; CONTINUES_ACROSS / SUPPORTS relations emitted (`elevation.ts:317-327`) and never read (F1). |
| Metric | NOT_ATTEMPTED | perspectives carry no metrics (F6). |
| Primitive | **LOST** | `fuseCandidates` keys "independent views" on the SIDE string, not the asset (`solve.ts:354`), then merges candidates from DIFFERENT facades at IoU ≥ 0.35 (`fusion.ts:246-266`); the qualifier is "≥ 2 assets AND proud" or "proud AND side-return" (`reconstruct.ts:1152-1177`). On this package one fused member qualifies: the plinth line of the REAR render (u −0.1..9.9, v ≈ 0) merged with a RIGHT-facade band → `solid-0` 0.31 × 0.31 at y 0.04, z −0.23, x 0..9.93: a strip on the ground that is not on the building. 44 real members refused (19 with a gap entry, the rest silent past the 24-gap cap, `reconstruct.ts:1180`). |
| DSL | **LOST** | one `createLinearSolid`; no assembly, no continuity, no return wall, no fascia. |

First loss: **`solve.ts:354`** (asset key = side) and **`fusion.ts:246-266`** (cross-facade merge), then **`reconstruct.ts:1152-1177`** (qualifier).

## 8. Balconies, loggia, railings, portal floor

| stage | status | detail |
| --- | --- | --- |
| Source | PRESENT | balcony slabs and fascias on both zones; glass balustrades; plinth. |
| Observation | PARTIAL | LOGGIA (recess-mouth) ×18 on renders; BALCONY / RAILING vision-only (F5). |
| Everything downstream | **UNSUPPORTED** | LOGGIA never read; BALCONY / RAILING / LOGGIA hypothesis kinds never emitted; createBalcony / createRailing never emitted; upper-storey regions are clipped to the base mass (`layout.ts:952-957`). |

## 9. Perspective views

| stage | status | detail |
| --- | --- | --- |
| Observation | PRESENT | the elevation extractor runs on renders (`analyze.ts:142`): SILHOUETTE, ROOF_EDGE, LOGGIA, OPENING, LINEAR_VOLUME_CANDIDATE with depth cues. |
| Metric / identity / registration | **NOT_ATTEMPTED** | identity relates ORTHOGRAPHIC frames only (`identity.ts:70`); the metric layer excludes perspectives (F6); `candidatesFrom` requires a registration and hard-codes ORTHOGRAPHIC_ELEVATION (`solve.ts:343-360`); no camera is ever solved. The PERSPECTIVE weights in `fusion.ts:101,109` and `roof-systems.ts:100` are unreachable. |

## 10. Materials / surface regions

SURFACE_REGION (`cladding`) ×67 observed, never read; `createSurfaceRegion` never emitted; the current Auto has no material regions. Correctly, colour creates no geometry; incorrectly, nothing records the finish either.

## 11. Evidence accounting and quality

There is no ledger. A high-authority reading can vanish at any of the points above with no record: the 100-zone chain segments (USED for the extent, then dropped), the 18 LOGGIA observations (never read), the section's 252 garage height (never read), the ROOF_EDGE/RIDGE observations (never read), the STAIR polyline (counted, refused). Per-object evidence is not written into the model (`setEvidence` never emitted), so a viewer cannot tell an ASSUMED head from a printed one.

## 12. Summary: first loss points, by family

| family | first loss point | class |
| --- | --- | --- |
| frame | `reconstruct.ts:84` (FRONT = max-z wall) | CONFLICTED with MODEL_FRAME |
| attic registration | `extract.ts:598-654` (chain anchors fit 0.04694 m/px) | CONFLICTED |
| 14.60 topology / recesses | `layout.ts:1073` + `plan-decomposition.ts:913` (zone never a recess; stubs never scanned) → F4 (never read) | LOST |
| roof extent over zones | `reconstruct.ts:462` (footprint = walled mass) | LOST |
| garage roof height / parapet | `reconstruct.ts:423` (storey height; section 252 unread) | LOST |
| chimneys, rooflights | no observation, hypothesis or command | UNSUPPORTED |
| opening heights / sills | OCR on callout circles (F10) → `reconstruct.ts:982-1018` conventions | LOST |
| raked gable openings | `reconstruct.ts:562-563, 1036-1051, 1063` | LOST |
| interior walls / rooms / doors | `plan-decomposition.ts:837-858` (closure only); no pass | NOT_ATTEMPTED |
| stairs | `stair.ts:474-487` (ladders refused) → `reconstruct.ts:1255` | LOST / REFUSED |
| facade members / assemblies | `solve.ts:354` + `fusion.ts:246-266` → `reconstruct.ts:1152-1177` | LOST (one random strip) |
| balconies, railings | no consumer of LOGGIA; no command emitted | UNSUPPORTED |
| perspective camera | `solve.ts:343-360`; no caller of `solveCamera` | NOT_ATTEMPTED |
| source-view verification | `structural-audit.ts:163-169` (NOT_CHECKED on 100 % silhouettes) | NOT_ATTEMPTED |
| evidence ledger / quality | none | UNSUPPORTED |

Every item in this table is addressed by the v2 architecture in `docs/ANALYZER_V2_ARCHITECTURE.md`; the v2 candidate's `evidence-consumption.json` and `feature-lineage.json` are the artifacts that make a future loss of this kind visible at the point it happens.
