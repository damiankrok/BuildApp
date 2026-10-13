# 005Q Phase A — EXTERIOR-FEATURE INTERFACE (design only, for 005R / 005S) — key `interface`

> Phase A design draft by an independent read-only agent (design only: nothing here is implemented in 005Q, no schema field is proposed for shipping). Scratch paths are shown as `$W`, a directory outside the repository.

> Read-only Phase A draft. Nothing under the repository was written. Base `04d5568` (HEAD `d28b755` adds only
> `research/` and artifacts; `git diff 04d5568 HEAD -- packages` is empty, checked). Line numbers are at 04d5568.
> Scratch: `$W/agents/interface/` (variant `v1/`, run `runs/cf1/`, raster crops `img/` — publisher
> pixels, outside the repository, never to be copied in). One replay, `--par 1`.
>
> Labels: **KNOWN** = reproduced here from code, sealed data, B0 outputs or a replay, with file:line and numbers;
> **INFERRED** = reasoned, or read by eye from a raster, not reproduced by a run; **UNAVAILABLE** = cannot be settled
> from what is here. Nothing in this document is implemented in 005Q, and no section proposes a shipping schema field:
> every mapping names an existing type/field, or says "no home — needs an authorised schema stage".

---

## 0. Summary

1. **The canonical language can already hold almost everything 005R/005S will need** (KNOWN, `packages/model/src/schema.ts`):
   `Opening`/`Window`/`Door.usage`, `Terrace`, `Balcony`, `Railing.role/path/hostId`, `Platform`, `StepRun`,
   `LinearSolid.role` (COLUMN, POST, BEAM, PERGOLA_*), `Assembly` (CANOPY/CARPORT/PERGOLA/ENTRANCE/TERRACE/…/UNKNOWN with
   `alternatives`, `missing`, `quality`, `edgeConditions`, `openSides`), `Relationship`, `Evidence.properties` (per-field
   status) and `Evidence.sourceIds` → `evidenceSources`. The v2 feature graph (`v2/graph.ts`) already has sightings with
   `viewFamily`/`assetId`/`pixelRect`, measurements with `method`, `FeatureAlternativeGroup`, `SourceCoverage.independentAssets`
   and the L0/L1/L2 rule. The architecture package has `SemanticProposal` + `featureKey` + `SOURCE_AUTHORITIES`.
2. **What is missing is not vocabulary but plumbing and three semantic gaps** (KNOWN):
   - production never writes `evidenceSources` or `Evidence.sourceIds` (0 of 0 / 0 objects on the 24 completed B0 models),
     never emits an `Assembly`, a `LinearSolid`, a `Platform` or a `StepRun` (0 commands in 24 programs), and the feature
     graph (the only place sightings live) is written only by a research script (`analysis-service/scripts/reconstruct-v2.ts:82`),
     never by `analysis-service/src`, `evidence-pack/src` or `mobile-scene/src`;
   - `emit.ts:53-69` collapses `IMAGE_METRIC_REGISTERED` and `VISUAL_SEMANTIC` into one model status `VISUAL_INFERRED`
     (`:61-64`), so "registered image measurement" vs "existence seen in a picture" survives only in the feature graph;
   - **host side** exists on exactly one plan-boundary type (`CompoundFacadeSpan.inward`, `compound-facade.ts:106-123`);
     `BoundaryGap`, `AttachedBody`, `WideOpeningDecision` carry none, and the diagnostic projections drop the evidence ids a
     later stage would join on (`plan-diagnostics.ts:160` drops `mouth.gapId`, `sides.postShare`, `why`).
3. **New KNOWN finding (exterior-feature fabrication today).** Of the **29 terraces** production emits on the 24 completed
   B0 rows, **17 are no deeper than one wall thickness (0.17–0.48 m)**; on 4 rows checked on the raster they are wall
   poché or blank paper, not floors: glogownikach (3: the S and E wall bodies), eoze-legacy-area (3: the outer half of the
   S wall), D00 (W/E strips 73 % dark ink, half a 25.5 px wall), cieszyniankach (1: a 0.22 m strip of blank paper, 1 %
   ink). Two of these rows are **known-good PASS rows** (eoze-legacy-area, cieszyniankach; eoze-legacy-every by the same
   mechanism, INFERRED same drawing). Mechanism: `layout.ts:2182-2212` `zonesOutsideEnvelope` turns any strip ≥ max(2,
   wallPx/2) px between the walled envelope and the extent into a ZONE → `reconstruct-v2.ts:651-685` a recess → `:1093-1118`
   a TERRACE per open interval, SOURCE_DERIVED, PAVED when ≥ 30 % of it is "drawn" (`terrace.ts:107-118` counts wall ink as
   drawn). The same path emits **10 "return" walls ≤ 0.5 m long** inside such strips (B0, 25 returns in all). The capability
   registry states `TERRACE: SUPPORTED, ANALYZER_V2, knownGaps: []` — an overstatement. Counterfactual CF-IFACE-1 (§7)
   removes all three glogownikach terraces and both returns.
4. **Boundary-body relations are not admissible as exterior-feature evidence as they stand** (KNOWN): glogownikach's two
   `COVERED_TERRACE` bodies (439..646 and 668..782 × 536..553 px) are 17 px slices of its own south wall band; 12
   COVERED_TERRACE and 8 RECESSED_ATTACHED bodies exist on B0 digests and none reaches the model (only consumers:
   `plan-resolution.ts:489-492,647`, `plan-decomposition.ts:3270`).
5. **Design rule for 005Q's output** (§6): every exterior stretch must leave 005Q with (frame, axis, line, interval, inward
   sign, face type, evidence state, the gap/part/chain ids it rests on) and every open-side part with its geometric
   reading and **semantic alternatives unranked**; 005Q may not name a part TERRACE/CANOPY/CARPORT/PERGOLA/ENTRANCE, and
   may not emit a terrace or return in a strip no deeper than the host wall.

---

## 1. Existing homes (KNOWN inventory, file:line at 04d5568)

### 1.1 Canonical model (`packages/model/src`)

| home | where | what it can say today |
|---|---|---|
| `Evidence` {status, source, locator, interpretation, confidence, note, **properties** (per-field status), **sourceIds**} | `evidence.ts:42-59` | object status, per-property status with free-string keys (production already uses dotted keys, `emit.ts:365` `'edgeMembers.verge'`) |
| `EvidenceSource` {id, kind DRAWING/PHOTO/RENDER/PUBLISHED_FACT/MANUAL/DERIVATION/OTHER, label, uri, note} | `evidence.ts:64-72`; DSL `addEvidenceSource` (`commands/src/apply.ts:480`) | a named source several objects cite; validator checks every `sourceIds` entry exists (`validate.ts:123`) |
| `EvidenceStatus` SOURCE_EXACT, SOURCE_CORROBORATED, SOURCE_DERIVED, GEOMETRIC_INFERRED, VISUAL_INFERRED, ASSUMED, UNRESOLVED | `evidence.ts:15-23`; hard = first two (`:30`) | |
| `base.tags` (free strings, "e.g. front-facade") | `schema.ts:66-72` | stringly; no validation |
| `Wall` {start,end = outer-face line, kind EXTERIOR/INTERIOR} | `schema.ts:133-149` | material **left of travel**; a ring is made CCW (`commands/src/apply.ts:290-296`), so the exterior side of every ring wall is the right of start→end — the host side of a wall is derivable, not stored |
| `Opening` {wallId, kind WINDOW/DOOR/PASSAGE, offset, sill, width, height, head, leaves} | `schema.ts:241-253` | host wall, position in the host's frame; no side, no view |
| `Door.usage` ENTRANCE/GARAGE/TERRACE/SERVICE/INTERIOR | `schema.ts:333` | never set by production (emit sets `usage` only on rooms, `emit.ts:321`) |
| `Terrace` {polygon, topOffset, thickness, surface PAVED/DECK/UNKNOWN, edge PLINTH/FLUSH, **hostWallIds**} | `schema.ts:546-562` | |
| `Balcony` {kind BALCONY/TERRACE/LOGGIA, footprint rect} | `schema.ts:495-505` | |
| `Railing` {start,end,path, role GUARD/HANDRAIL/BALUSTRADE, hostId, infill} | `schema.ts:508-536` | the RailingRun primitive |
| `Platform` {role LANDING/PORCH/RAMP/PLINTH/UNKNOWN_PLATFORM, polygon, hostWallIds} | `schema.ts:861-875` | porch / landing floors |
| `StepRun` {role ENTRANCE_STEPS/…/UNKNOWN_STEPS} | `schema.ts:891-908` | exterior steps |
| `LinearSolid.role` COLUMN, POST, BEAM, LINTEL, RAFTER, PERGOLA_POST, PERGOLA_BEAM, FASCIA, VERGE_BOARD, FACADE_MEMBER, DECORATIVE, UNKNOWN_MEMBER; `hostId` | `schema.ts:700-737` | columns, posts, beams |
| `assemblyBase` {hostIds, quality COMPLETE/PARTIAL/FRAGMENTARY, missing[], alternatives[{kind, confidence, why}]} | `schema.ts:940-947`, alternatives `:925-927` | |
| platform assemblies (BALCONY/TERRACE/LOGGIA) {platformId, railingIds, supportIds, **edgeConditions[{edgeIndex, condition WALL/GUARDED/FREE/STEPS/OPEN, targetId}]**} | `schema.ts:949-957`, `:935-937` | per-edge host side and open sides of a platform |
| cover assemblies (CANOPY usage ENTRANCE/TERRACE_COVER/SHELTER/UNKNOWN, CARPORT bays) {supportIds, beamIds, roofAssemblyId, slabId, **openSides: RoofEdgeSide[]**} | `schema.ts:958-970`, `:1017-1018` | open sides as MIN_X/MAX_X/MIN_Z/MAX_Z — axis-aligned only |
| PERGOLA {postIds, primaryBeamIds, secondaryBeamIds, coverage 'OPEN'} | `schema.ts:1019-1030` | a roof over it is refused (`PERGOLA_HAS_ROOF`) |
| ENTRANCE {doorId, landingId, stepRunIds, canopyId, supportIds, railingIds} | `schema.ts:1031-1042` | |
| FACADE {side FRONT/REAR/LEFT/RIGHT/OTHER, wallIds, openingIds, memberIds, regionIds} | `schema.ts:1043-1053` | the only side enum in the model |
| UNKNOWN {sourceEvidenceIds ≥1 → evidenceSources, metricExtent {min,max Vec3}, approximateTopology, observedPlanesOrSegments, unresolvedReason} | `schema.ts:1066-1083`; validator `validate-architecture.ts:474-485` (sources exist; extent spans ≥ 2 axes, min before max; observed pieces inside extent; never COMPLETE) | a plan-only footprint is admissible (x and z span, y degenerate) |
| `Relationship` HOSTED_BY, SUPPORTED_BY, CONNECTED_TO, CONTINUES_TO, TERMINATES_AT, MEETS, INTERSECTS, OVERLAPS_INTENTIONALLY, COVERS, GUARDS, OPENS_INTO, ATTACHED_TO, ALIGNS_WITH, ABOVE, BELOW | `schema.ts:1097-1113` | |
| DSL commands `createAssembly`, `createRelationship`, `createColumn`, `createBeam`, `createLinearSolid`, `createPlatform`, `createStepRun`, `createRailing`, `createTerrace`, `addEvidenceSource`, `setEvidence` | `commands/src/commands.ts` | all exist |

### 1.2 v2 feature graph (`packages/reconstruction/src/v2/graph.ts`)

| home | line | notes |
|---|---|---|
| `FeatureFamily` LEVEL … OPENING, ROOF, ATTACHED_ROOF, ROOF_MEMBER, CHIMNEY, ROOFLIGHT, STAIR, BALCONY, RAILING, FACADE_MEMBER, FACADE_ASSEMBLY, SURFACE_REGION, CAMERA, TERRACE | `:29-52` | **no** CANOPY, CARPORT, PERGOLA, ENTRANCE, COLUMN/POST, BEAM, PLATFORM, STEP_RUN, UNKNOWN |
| `ViewFamily` PLAN, ELEVATION, SECTION, PERSPECTIVE, SITE, PAGE | `:54-55` | no PHOTO (a real photograph) distinct from PERSPECTIVE (render) |
| `SourceSighting` {id, frameId, assetId, viewFamily, observationIds, pixelRect?, what, confidence} | `:59-71` | |
| `MeasurementMethod` PRINTED, CHAIN, REGISTERED_PIXEL, CROSS_VIEW, DERIVED, CONVENTION | `:74` | |
| `MetricMeasurement` {sightingIds, evidenceIds, quantity, value, low, high, unit, method, why} | `:78-91` | |
| `FeatureHypothesis` {family, hostId?, sightingIds, measurementIds, parameters, alternativeGroupId?} | `:97-111` | |
| `FeatureAlternativeGroup` {question, hypothesisIds, chosenId?, why} | `:117-125` | chosenId optional = an unresolved choice is representable |
| `QualityLevel` L0 topology only / L1 metric one family / L2 corroborated or printed | `:128-136` | violation rule `:270-272` |
| `ProvenanceStatus` SOURCE_EXACT, SOURCE_CORROBORATED, SOURCE_DERIVED, IMAGE_METRIC_REGISTERED, VISUAL_SEMANTIC, ASSUMED_FOR_RENDERING, UNRESOLVED | `:140` | |
| `SourceCoverage` {viewFamilies, sightings, **independentAssets** ("distinct assets, not variants of one drawing"), printed} | `:143-152`; computed as the count of distinct `assetId` (`reconstruct-v2.ts:200,212`) | |
| `SolvedFeature` {quality, provenance, parameterProvenance, sourceCoverage, unresolvedProperties} | `:155-175` | |
| `SemanticObjectBinding` {solvedFeatureId, objectId, objectKind, commandIndex} | `:177-186` | the only link model object → sightings |
| `FeatureRelationKind` SAME_FEATURE_AS, HOSTED_BY, PART_OF, ALIGNED_WITH, CONTINUES_AS, ABOVE, BELOW, PROJECTS_FROM, RECESSED_FROM, SUPPORTS, CONTRADICTS, CORROBORATES, TERMINATES_AT, TURNS_AT, MEETS_HOST | `:189` | |

### 1.3 Proposals and authority (`packages/architecture/src`)

- `SemanticProposal` {id, kind, geometry (POLYGON/SEGMENT/VALUE in **world** coordinates), confidence, sourceFrameId,
  detector DETERMINISTIC_CV/OCR/ML_FLOORPLAN/VLM/OWNER/SYNTHETIC, authority, featureKey?} (`proposals.ts:16,23-49,61-82`).
  Kinds: ROOF_PLANE_REGION, ROOF_LINE, ROOF_INTERRUPTION, VERTICAL_FACADE, OPENING, VERTICAL_MEMBER, HORIZONTAL_MEMBER,
  COVER_SURFACE, **NO_COVER_OBSERVED**, STEP_EDGE, LEVEL_SURFACE, PRINTED_DIMENSION, UNCLASSIFIED_GEOMETRY. **No** railing /
  guard kind.
- `SOURCE_AUTHORITIES` PRINTED_DIMENSION > TECHNICAL_GEOMETRY > CROSS_VIEW > PERSPECTIVE > VISUAL_INFERENCE > CONVENTION,
  `evidenceStatusOf` (`authority.ts:19-39`): CROSS_VIEW → GEOMETRIC_INFERRED; PERSPECTIVE/VISUAL_INFERENCE → VISUAL_INFERRED.
- Hypothesis pipeline families DORMER, PERGOLA, CANOPY, CARPORT, EXTERIOR_STEPS, ROOF (`hypotheses/types.ts:12`); cross-view
  is counted by **distinct `sourceFrameId`** (`hypotheses/fuse.ts:54-55`); UNKNOWN fallback (`fuse.ts:147`), UNKNOWN assembly
  emission with `src-frame-<frame>` evidence sources (`hypotheses/emit.ts:79-99,654-674`). Synthetic only.

### 1.4 Plan boundary layer (`packages/reconstruction/src`)

| home | line | host side? | ids |
|---|---|---|---|
| `SolidPart` {id, bounds, kind WALL/POST} | `boundary-evidence.ts:63` | — | `id` (per layer) |
| `LinePiece` {from,to, axisPx, kind WALL/POST, partId, along} | `:130-142` | — | `partId` |
| `BoundaryGap` {id, axis, linePx, from/toPx, jambs WALL/POST/CORNER, signature, cls, boundary, occupancy, trace} | `:244-266` | **no** | `id` |
| `AttachedBody` {relation, enclosed, built, rect, junction, sides{wallShare, postShare}, mouth{gapId, signature, jambs}, why} | `boundary-bodies.ts:44-60` | no (junction only, no side) | **none of its own**; `mouth.gapId` |
| `CompoundFacadeSpan` {id, axis, linePx, **inward 1/−1**, separators, intervals} / `FacadeInterval` {id, role OPENING_IN_WALL/RECESS_MOUTH/OPEN_SIDE/UNRESOLVED, recess, jambInk, signature} | `compound-facade.ts:71-123` | **yes, only here**; computed against the walled envelope within 1.5 wallPx (`plan-decomposition.ts:1574-1578`) | `id` |
| `WideOpeningDecision` {kind, axis, linePx, from/toPx, decision OPENING_IN_WALL/OPEN_SIDE, compound?{spanId, intervalId, role}} | `plan-decomposition.ts:213-231` | no | via `compound` |
| `ExtentConflict` {side W/E/N/S, chainIds, extentPx, boxPx, stretches, decision} | `boundary-completion.ts:104-121` | side only | `chainIds` |

### 1.5 v2 readers that already produce exterior observations

- `OpeningV2` {facade FRONT/REAR/WEST/EAST, massId, interval, family WINDOW/DOOR/GARAGE_DOOR/GLAZED_DOOR/MULTI_PANEL_GLAZING/UNKNOWN,
  callout{evidenceId, heightCandidates, resolvedBy}, elevation{frameId, sillY, headY, contrast, confidence},
  planGap{frameId, pixelRect}, **provenance per property** (interval/width/sill/head/profile/family), unresolved[]}
  (`openings-v2.ts:42-68`, provenance defaults `:225`, family always `VISUAL_SEMANTIC`).
- `FacadeMember` (RETURN_WALL, VERGE_MEMBER, FASCIA_BAND, PARAPET, BALCONY_SLAB, RAILING; `evidence` PLAN_INK/RENDER_BAND/
  PLAN_AND_RENDER; `frameIds`) and `FacadeAssemblyHypothesis` (PORTAL_FRAME, GABLE_FRAME, BALCONY_FRAME, FASCIA, CUSTOM_FRAME)
  (`facade.ts:21-52`). `BuildingV2.assemblies` (`v2/building.ts:244`) is **never read by `emit.ts`** (no match) — KNOWN.
- `RecessTopology` (`recesses.ts:33-50`), `TerraceExtension` (`terrace.ts:25-34`).
- Elevations are registered on the **main body's rectangle** plus an eaves overhang (`v2/frame.ts:109-157`; overhang is
  `ASSUMED` 0 m when nothing states it, `roof-systems.ts:184`): an elevation's along-axis anchor is a body face.

---

## 2. Side vocabularies and the host side (KNOWN)

Six side vocabularies coexist:

| vocabulary | where | convention |
|---|---|---|
| `FRONT/REAR/WEST/EAST` | `OpeningV2.facade`, `ZoneSide`, `TerraceSide` | v2 world; z = 0 at the front outer plane |
| `FRONT/REAR/LEFT/RIGHT` | `ElevationFrameV2.side` (`frame.ts:112`) | LEFT = WEST, RIGHT = EAST (`facade.ts:106,153`) |
| `FRONT/REAR/LEFT/RIGHT/OTHER` | model `FACADE` assembly `side` | the only canonical one |
| `MIN_X/MAX_X/MIN_Z/MAX_Z` | `PlanSide` (`structural-layout.ts:90`), `RoofEdgeSide` (`schema.ts:370`), `coverAssembly.openSides` | layout/world axes; zone `min_z` = REAR, `max_z` = FRONT (`reconstruct-v2.ts:654`), i.e. image top = rear |
| `W/E/N/S` | `ExtentSide` (`boundary-completion.ts:44`) | image axes (N = small y) |
| `inward ±1` | `CompoundFacadeSpan.inward` | pixel axis sign toward the building |

**Host side today.** In the model it is implicit and total for ring walls (outer-face line, material left of travel,
CCW ring). In the plan boundary layer it exists only for compound spans; a `BoundaryGap` on a line with building on both
sides (an interior line) and one on the envelope look the same. An `AttachedBody` knows its junction length and wall share
but not which side of which line the house is on.

**Consequence for 005R/005S (INFERRED).** A visual observation that says "terrace in front of the living-room glazing"
needs (a) the facade it is seen on (elevation/render side, with mirror risk — `side-orientation.ts` swaps unlabelled
views), (b) the plan stretch that facade is, and (c) on which side of that stretch the building is. (a)→(b) needs one
mapping table between the vocabularies above (no schema change: it is a pure function of `zFlip`, `MODEL_FRAME` and the
ring orientation); (b)→(c) needs 005Q's per-stretch inward sign and face type (§6).

---

## 3. Mapping the requested concepts onto existing homes

| concept (005Q prompt) | existing home(s) — exact type/field | fits | has no home (must wait for an authorised schema stage) |
|---|---|---|---|
| **OpeningObservation** (one sighting of one opening in one view) | **Graph**: `SourceSighting` (frameId, assetId, viewFamily ELEVATION/PERSPECTIVE/PLAN, pixelRect, confidence, what) + `MetricMeasurement` (quantity `sill`/`head`/`width`/`centre`, method REGISTERED_PIXEL or CROSS_VIEW, low/high) + `FeatureHypothesis` family OPENING with `hostId` = the wall feature, `FeatureRelation` SAME_FEATURE_AS between two sightings' hypotheses, CONTRADICTS when they disagree. **Reader record**: `OpeningV2.elevation{frameId,…}`, `planGap{frameId,pixelRect}`, `provenance[...]`. **Model**: `Opening` + `Evidence.properties` {offset,width,sill,height,head,kind} (already emitted, `emit.ts:498`); `Door.usage` for ENTRANCE/GARAGE/TERRACE. **Proposal**: `SemanticProposal` kind OPENING with `featureKey` | a sighting, a registered measurement, a cross-view identity, per-property status | (1) a per-view **mirror/side confidence** on the sighting (only `ElevationRegistration.sideWhy/sideConfidence` exists, outside the graph); (2) a sighting that is a **photo** vs a **render** (`ViewFamily` has PERSPECTIVE only); (3) in the model, which elevation/render a property came from — `Evidence.sourceIds` can carry it only if `evidenceSources` are written (§4.1) |
| **facade host side** | Model: implicit in `Wall` orientation (+ `Terrace.hostWallIds`, `Platform.hostWallIds`, `assemblyBase.hostIds`, `Railing.hostId`, `LinearSolid.hostId`, `EdgeCondition{condition, targetId}`, `coverAssembly.openSides`, `FACADE.side`). Graph: `FeatureRelation` HOSTED_BY / MEETS_HOST / PROJECTS_FROM / RECESSED_FROM. Plan: `CompoundFacadeSpan.inward` | complete for ring walls and for anything hosted by a ring wall | (1) host side of a **plan stretch** that is not a compound span (BoundaryGap, AttachedBody junction) — no field; 005Q can carry it in its existing decision records' `why`/trace (diagnostic, not schema) but a typed field is a schema change of the digest / evidence pack (`failure.ts:232`, `evidence-pack/src/types.ts:221`); (2) `openSides` cannot state a non-axis-aligned side |
| **EXTERIOR_FEATURE_PROPOSAL** | `SemanticProposal` (`proposals.ts:61-82`) with kinds VERTICAL_MEMBER (post/column), HORIZONTAL_MEMBER (beam), COVER_SURFACE / NO_COVER_OBSERVED (roof cover vs OPEN), LEVEL_SURFACE (terrace/landing), STEP_EDGE, OPENING, UNCLASSIFIED_GEOMETRY; `detector` (VLM/ML/OWNER already named), `authority` PERSPECTIVE/VISUAL_INFERENCE for images, `featureKey`; consumed by `runPipeline` → UNKNOWN/ACCEPTED/REJECTED → DSL. Graph equivalent: `FeatureHypothesis` + `FeatureAlternativeGroup` without `chosenId` | proposals are evidence, never objects; invalid ones refused (`parseProposals`) | (1) **plan-pixel proposals**: geometry must be world coordinates, so a proposal needs a registered frame first; (2) **railing/balustrade** kind; (3) feature-graph **families** CANOPY/CARPORT/PERGOLA/ENTRANCE/COLUMN/BEAM/PLATFORM/UNKNOWN (`graph.ts:29-52`); (4) pipeline families TERRACE/BALCONY/ENTRANCE/RAILING (`hypotheses/types.ts:12`; ENTRANCE today only via EXTERIOR_STEPS) |
| **independent cross-view source ids** | Model: `Evidence.sourceIds` → `EvidenceSource{kind DRAWING/PHOTO/RENDER,…, uri}`; Graph: `SourceSighting.assetId`, `SourceCoverage.independentAssets`, L2 rule (`graph.ts:270-272`); source package: per-variant `byteHash`, asset ids | asset-level identity exists; variants of one asset already collapse | (1) independence is counted by **asset** in v2 and by **frame** in the pipeline (`fuse.ts:54`) — two frames cut from one sheet count twice there; (2) **no near-duplicate lineage**: discovery dedupes by url+channel only (`source-package/src/discovery.ts:256-266`); byte-identical images across assets: **0 of 45 packages** (KNOWN, census here), near-identical (resized/re-encoded) **UNAVAILABLE** — 005R must add content lineage before "two renders agree" can count as two; (3) no field says two assets are the *same view* rendered twice (005P map: "no cross-asset lineage") |
| **UNKNOWN_ASSEMBLY** | `Assembly` kind UNKNOWN (`schema.ts:1066-1083`) with `alternatives`, `missing`, `quality` PARTIAL/FRAGMENTARY, `hostIds`, base `evidence.properties` for per-field status (e.g. `'metricExtent.max.y': 'UNRESOLVED'`); validator `validate-architecture.ts:474-485`; graph: `FeatureAlternativeGroup` with no `chosenId` | a plan-only part (x,z extent, y degenerate) validates; an image-only part needs a metric extent → only after registration | (1) it **requires ≥ 1 `evidenceSources` entry** — production writes none today; (2) its `metricExtent` is world metres: a part known only in plan pixels must be registered first; (3) no feature-graph family UNKNOWN to bind it (`featureGraphViolations` would flag an L1 feature with no binding, `graph.ts:281-282`, unless it stays L0) |
| **metricAccuracy MEASURED / DERIVED / VISUAL_APPROX / UNRESOLVED** | not a field anywhere (grep: no `metricAccuracy`, no `VISUAL_APPROX`). Derivable view over existing labels: **MEASURED** = model SOURCE_EXACT/SOURCE_CORROBORATED = graph same = layout `MEASURED` = method PRINTED/CHAIN with READ statements only (see `wall-face-and-evidence-contract.md` §5.2); **DERIVED** = SOURCE_DERIVED (graph) / SOURCE_DERIVED or GEOMETRIC_INFERRED (model) = method DERIVED/CROSS_VIEW; **VISUAL_APPROX** = graph IMAGE_METRIC_REGISTERED (metric from a registered image) or VISUAL_SEMANTIC (existence/kind only) = model VISUAL_INFERRED = method REGISTERED_PIXEL; **UNRESOLVED** = UNRESOLVED + `unresolvedProperties` | as a **computed reading**, never stored | (1) **ASSUMED / ASSUMED_FOR_RENDERING has no slot** in the 4-value scale; it must not fold into DERIVED or VISUAL_APPROX — fold into UNRESOLVED with the assumption named, or keep a fifth value; (2) the model cannot tell VISUAL_APPROX-metric from VISUAL_APPROX-semantic (`emit.ts:61-64`); fixing that is a schema stage (`EvidenceStatus` enum) — or the graph must ship; (3) a stored field would be a new shipping field — not authorised |

Rules that follow (design, not code):

- **A visual approximation is never a hard constraint.** `isHardEvidence` (`evidence.ts:32`) is SOURCE_EXACT/CORROBORATED;
  `v2/verify.ts:280` refuses view corrections of those. Any 005R/005S value from an image enters as
  IMAGE_METRIC_REGISTERED / VISUAL_SEMANTIC → VISUAL_INFERRED, never SOURCE_*.
- **One picture is one source.** L2 needs printed or `independentAssets ≥ 2`; independence must be by content lineage,
  not by asset id alone (above).
- **Alternatives are kept, not ranked away.** A part that plan evidence cannot classify carries every admissible kind in
  `alternatives` (model) / an unresolved `FeatureAlternativeGroup` (graph).

---

## 4. Production recognition gaps (representable, not recognised on real inputs)

### 4.1 Census over the 24 completed B0 models (KNOWN, `runs/B0/*/model.json`, `program.json`)

| capability | registry claim (`architecture/src/registry/capabilities.ts`) | B0 production reality |
|---|---|---|
| TERRACE | SUPPORTED, **ANALYZER_V2**, knownGaps [] | 29 terraces on 10 rows, all recess floors (`reconstruct-v2.ts:1093-1118`); **17 ≤ 0.48 m deep** (§4.2); none from a COVERED_TERRACE body or an outlined platform without a recess; no TERRACE assembly |
| BALCONY | SUPPORTED, ANALYZER_V2 | 2 balconies + 2 railings, **marcowki only**, VISUAL_INFERRED; no BALCONY assembly |
| LOGGIA | PARTIAL, NONE | 0; 8 RECESSED_ATTACHED bodies (akebiach 3, azaliach 1, dabecjach 1, zurawkach 3) never emitted |
| CANOPY / ENTRANCE | SYNTHETIC_PIPELINE | 0 assemblies, 0 platforms, 0 step runs; `Door.usage` never set |
| CARPORT | NONE | 0; `OPEN_MOUTH_GARAGE` bodies: 0 on B0 digests |
| PERGOLA | SYNTHETIC_PIPELINE | 0 (jarzabem's pergola post line ends a chain, `wall-face-and-evidence-contract.md` §4.2; not recognised) |
| COLUMN / POST / BEAM | SYNTHETIC_PIPELINE | 0 `linearSolids`; POST parts exist in the solid layer (`boundary-evidence.ts:63`) and only feed `sides.postShare` |
| RailingRun / HANDRAIL | BALCONY via facade reader; HANDRAIL NONE | 2 (marcowki), glass guard from render bands (`facade.ts` `readRailing`) |
| roof covers (canopy/carport roof) | — | 0 cover roof assemblies; 1 model with roof planes |
| UNKNOWN_ASSEMBLY | SYNTHETIC_PIPELINE | 0; the 32 UNKNOWN boundary bodies never reach the model |
| v2 facade assemblies | — | `FacadeAssemblyHypothesis` built (`reconstruct-v2.ts:1028,1084`) but never emitted |
| evidence lineage | — | `evidenceSources` 0, objects with `sourceIds` 0; status GEOMETRIC_INFERRED never emitted |

Commands across the 24 programs: setEvidence 1392, cutOpening 565, createWall 469, placeDoor 360, placeWindow 205,
createRoom 196, createTerrace 29, createBalcony 2, createRailing 2, createRelationship 4; **createAssembly,
createLinearSolid, createColumn, createBeam, createPlatform, createStepRun, addEvidenceSource: 0**.

Boundary-body census on B0 digests (selected frames): FLUSH_ATTACHED 33, UNKNOWN 32 (+1 built), SEPARATE_BODY 21,
COVERED_TERRACE 12 (jarzabem 1, dabecjach 2, glogownikach 2, jablonkach 1, krasnokwiatach 1, eoze-every 1, marcowki 2,
willa-miranda 2), RECESSED_ATTACHED 8, PROJECTING_WING 8 (built). Wide-opening roles on final decompositions:
OPENING_IN_WALL 172 + 6 compound, OPEN_SIDE 44 + 8 compound; RECESS_MOUTH 0; UNRESOLVED 0 (declared at
`compound-facade.ts:71`, never returned — returns at `:452,459,473,475`).

Elevation registration (trace `ELEVATION_REGISTRATION`): of 24 completed rows, 13 register ≥ 1 elevation, 11 register
none — an opening/feature cross-view stage has no metric elevation on almost half the completed rows.

### 4.2 The sliver terraces (KNOWN where stated)

Mechanism (KNOWN, code): `zonesOutsideEnvelope` (`layout.ts:2182-2212`, `minCell = max(2, wallPx/2)` at `:2184`) emits a
ZONE for every strip between the walled envelope and the extent; `reconstruct-v2.ts:651-685` turns each zone touching a
body face into a `RecessTopology` and scans it for "returns" (`recesses.ts` `scanZoneForReturns`: wall-thick ink on most
scan lines); `:1093-1118` emits one TERRACE per open interval at storey 0 (`provenance = 'SOURCE_DERIVED'` hard-coded at
`:1116`), surface PAVED when `drawnShareOf` ≥ 0.3 (`terrace.ts:107-118`, test at `:115`: any pixel < luma 243 is "drawn", so wall
poché counts). A zone is the envelope–extent difference; when the envelope stands on an inner face or an axis, the zone is
the wall itself.

| row (B0 verdict) | terraces (min dimension) | strip | raster check (scratch) |
|---|---|---|---|
| dom-w-glogownikach (ALG_FAIL) | front-0 14.89×0.45, front-1560 2.94×0.45, east-45 0.38×8.70; PAVED | S 536..553, E 797.69..812 (wallPx 18) | **KNOWN**: strip ink 66 % (S, windows break it) and 97 % (E); the crop shows both strips are the S and E wall poché |
| eoze-legacy-area (**PASS**) | front-0 5.65×0.22, front-656 1.00×0.22, front-843 7.58×0.22; PAVED | S 568.5..578.5, wall band ≈ 560..579 (wallPx 15) | **KNOWN**: 61 % dark; envelope y1 568.5 is the band's axis, the strip is the **outer half of the S wall**; the "returns" (0.87–0.91 m) are the piers between windows |
| eoze-legacy-every (**PASS**) | same 3 front + rear-91 15.10×0.37 | — | front INFERRED (same drawing, same numbers); rear unverified |
| D00 (ALG_FAIL; synthetic gap-set) | east-124 0.18×11.51, rear-675 7.84×0.17, west-124 0.17×9.49 | W/E strips 12.75 px of a 25.5 px wall | **KNOWN**: W 74 %, E 73 % dark (wall half); S strip 32 % |
| dom-w-cieszyniankach (**PASS**) | west-80 0.22×15.80, UNKNOWN surface | W 185..193 | **KNOWN**: 1 % dark — blank paper between a chain tick and the wall; not wall, not a floor anyone drew |
| dom-pod-jarzabem (ALG_FAIL) | east-100/419/750 0.48 deep (wall 0.449 m) | E strip | INFERRED wall-depth; not checked on raster |

Returns in the same strips (KNOWN, B0): 10 of 25 emitted `return-*` walls are ≤ 0.5 m long, with "thickness" (their
along-facade extent) up to 0.91 m — glogownikach `return-front-0-0` 0.446 × 0.709 m, eoze 0.222 × 0.912 m, jarzabem
0.476 × 0.701 m. They are EXTERIOR walls in the model (`createWall`, material `mat-member`).

Interaction with the 005Q gates (KNOWN from `research/analyzer-005q/preregistration.md` §2-§4): the N1 trigger census
finds a band-faced strip only on glogownikach ("every other zone strip on the 24 completed rows has 0.00"), so N1 as
preregistered would leave the eoze/D00/cieszyniankach slivers in place; and G1 (19 PASS rows byte-identical) would block
removing them on eoze-legacy-area / eoze-legacy-every / cieszyniankach unless the stronger-source-proof exception of the
stage contract is invoked with the raster evidence above.

---

## 5. The two key houses through the interface

### 5.1 dom-w-glogownikach (frame `…0cb0a5c1d9`)

KNOWN today: body 18.83 × 8.70 m on the S/E inner faces (see `wall-face-and-evidence-contract.md` §0); 3 PAVED terraces
and 2 returns inside the S/E wall bands; bodies: 6 FLUSH_ATTACHED/UNKNOWN wall slices and 2 COVERED_TERRACE slices of the
S band (439..646, 668..782 × 536..553) — the entrance niche and the garage-door stretch read as "posts".

What the drawing shows outside the walls (INFERRED, raster read): a dashed overhead line across the S entrance niche
(x ≈ 438..645), a thin-line platform/steps outline below the S facade (y ≈ 553..600, outside the extent), the garage door
"300/225", and on the N side a glazed living-room front (270/230 ×2) under dashed overhead lines (outside the extent
y < 203). None of this is in the model, and none of it should be added by 005Q.

What 005Q must leave for 005R/005S: S stretch 78..438 and 645..812 as outer face of a WALL host (inward −1 in y, i.e.
toward smaller y), the niche stretch as RECESS/setback with its back face and its open front, the dashed line as
an observation (overhead, TRUE_EXTERIOR_GAP class) with its id; no TERRACE, no return, no COVERED_TERRACE semantics.
005S may then attach "entrance canopy?" (UNKNOWN with alternatives CANOPY/ENTRANCE) to the niche stretch using an
elevation/render sighting.

### 5.2 dom-w-krasnokwiatach (frame `…723651b1ff`)

KNOWN today: refused (ALG_FAIL); box 155..535 × 248..559; bodies UNKNOWN 38.1 m² (155..514 × 77..248), SEPARATE_BODY
0.57 m² (262..272 × 77..168, a wall piece), FLUSH_ATTACHED 2.26 m² (514..535 × 77..248, the E wall), COVERED_TERRACE
11.3 m² (235.5..364.5 × 559..718), FLUSH_ATTACHED 5.48 m² (364.5..535 × 559..718, the garage), UNKNOWN 11.2 m², 0.42,
1.62 m² slivers.

INFERRED (raster read, consistent with `wall-face-and-evidence-contract.md` §0): the 38.1 m² UNKNOWN body **conflates**
a walled living room (≈ 262..535 × 77..248, built) with a NW open terrace with a round table and a corner post
(≈ 155..262 × 77..248). The 11.3 m² COVERED_TERRACE is the entrance porch (post near 263..284 × 697..718) plus the
planting strip. The body classifier cannot separate them because a body is a connected set of cells off the house
(`boundary-bodies.ts:164-180`) and nothing splits it by host stretch.

Interface consequence: a body record is the wrong unit for 005R/005S joins. The unit is the **stretch** (one line, one
interval, one inward sign, one face type, one evidence state) and the **part** bounded by evidenced stretches. For the NW
terrace the correct canonical end state (005S, not 005Q) is an UNKNOWN assembly (FRAGMENTARY, `hostIds` = living-room W
wall, `approximateTopology` PLANAR, `observedPlanesOrSegments` = its plan outline and post, alternatives TERRACE /
PERGOLA / CANOPY, `unresolvedReason` "plan shows posts and a thin outline; cover not observed") until an elevation or
render gives COVER_SURFACE or NO_COVER_OBSERVED.

---

## 6. What the 005Q boundary output must preserve (design contract for 005R/005S)

Must (all expressible in existing in-memory types; see "schema" column):

| item | existing carrier | schema status |
|---|---|---|
| per exterior stretch: frame id, axis, line px, interval, **inward sign**, face type (outer/inner/axis/not-a-face), evidence state (EVIDENCED_BY_TICK / _BY_INK / CANDIDATE / NO_HOST) | `CompoundFacadeSpan` has inward; face type/evidence state proposed by `wall-face-and-evidence-contract.md` §3 | in-memory/trace only in 005Q; a typed digest/evidence-pack field needs an authorised (versioned) change |
| the ids each stretch rests on: `BoundaryGap.id`, `SolidPart.id`/`LinePiece.partId` (WALL vs POST), chain ids, decomposition id | exist (`boundary-evidence.ts:63,130-142,244`; `ExtentConflict.chainIds`; `BoundaryRecord.decompositionId`) | keep stable and deterministic |
| per open part: geometric reading (OPEN_SIDE / RECESS_MOUTH / NO_HOST / UNRESOLVED), its stretches, its posts, its mouth gap id, `postShare`, `why`, `built=false` | `AttachedBody`, `FacadeInterval` | the digest projection drops `mouth.gapId`, `signature`, `jambs`, `sides.postShare`, `sides.lengthM`, `junction.lengthM`, `why` (`plan-diagnostics.ts:160`, mirrored in `failure.ts:232`, `evidence-pack/src/types.ts:221`); the evidence pack names bodies by **index** `body:<frame>:<i>` (`evidence-pack/src/pack.ts:721`), which renumbers whenever an earlier body changes |
| semantic alternatives of an open part, **unranked** | model `alternatives`; graph `FeatureAlternativeGroup` without `chosenId` | 005Q should not populate them in the model; it must not collapse them into a relation name |
| the host wall for every part (which built stretch it touches) | `Terrace.hostWallIds`, `assemblyBase.hostIds` (model), `MEETS_HOST` (graph) | exists |

Must not:

1. Name a plan part TERRACE / CANOPY / CARPORT / PERGOLA / ENTRANCE / COVERED_TERRACE as a decision; plan evidence
   (posts, thin lines, dashed lines) does not fix cover or use. `COVERED_TERRACE` today is a relation label on wall slices
   (glogownikach) — at most a hint for 005R. (Refines 005P `target-contracts.md` §5 `BoundaryDecision`, §8.)
2. Emit a terrace, platform, return wall or room in a strip no deeper than the host wall, or in a strip whose ink is the
   host wall (§4.2), whatever its `drawnShare`.
3. Promote any image value to SOURCE_*; or count two frames of one asset, or two near-identical assets, as independent.
4. Let elevation-anchored quantities (sill, head, opening centre) outlive a change of the body face they were anchored on
   without being re-read: KNOWN in CF-IFACE-1 that moving the glogownikach faces changed the W opening from "printed
   110/230, 2.30 m tall on the elevation" (sill 0.232) to "printed 110/290, 1.30 m tall" (sill 0, height 2.265) —
   elevations are registered on body faces (`v2/frame.ts:131-157`); the specific cause of this flip is INFERRED.
5. Drop or renumber the ids above between B0 and the adopted candidate without a mapping.

---

## 7. Counterfactual register

| claim | minimal change | predicted | ran | result |
|---|---|---|---|---|
| glogownikach's 3 terraces and 2 returns are produced by the S/E zone strips (wall bodies), not by any exterior evidence | CF-IFACE-1: `layout.ts:2184` `minCell = max(2, wallPx*1.25)` (strips ≤ 1.25 walls yield no zone) | terraces 3 → 0, returns 2 → 0, recesses 2 → 0; ring otherwise unchanged in size | yes (`agents/interface/runs/cf1/dom-w-glogownikach`) | **matched**: terraces 3→0, `return-front-0-0/-1` removed, recesses 2→0. Collateral (KNOWN): the whole model shifts −0.4455 m in z (ring 0..8.70 instead of 0.4455..9.1455: the zone participates in the world origin), 1 surface region and 1 room/1 interior door fewer, interior walls re-cut, one opening's elevation reading changes (§6 must-not 4). Ring width/depth unchanged (18.83 × 8.70). Not a proposed fix: it also removes any real zone ≤ 1.25 walls deep |
| the PAVED label comes from wall ink | `terrace.ts:115` drawn threshold → count only non-solid pixels | glogownikach/eoze surfaces PAVED → UNKNOWN | no | — (falsifier: if PAVED stays, the label comes from elsewhere) |
| COVERED_TERRACE bodies never reach the model | code: consumers of `.bodies` are `plan-resolution.ts:489-492,647`, `plan-decomposition.ts:3270` only | — | census | KNOWN: 12 such bodies, 0 terraces/canopies sourced from them |
| eoze-legacy-area front terraces are the outer half of the S wall | raster ink in 568.5..578.5 | high dark share, band ≈ 560..579 | yes (scratch Python) | 61 % dark; band rows 560..579 printed (`img/eoze.png`) |
| cieszyniankach W terrace is not wall ink | raster ink in 185..193 | low | yes | 1 % |
| registry TERRACE "ANALYZER_V2, no gaps" is overstated | B0 census | — | census | 17/29 terraces ≤ 0.48 m |
| independence by asset is not fooled by byte-identical copies on this corpus | variant byteHash shared across asset ids | 0 | yes | 0 of 45 packages; near-duplicates UNAVAILABLE |

---

## 8. Disagreements and refinements

With 005P:
1. `target-contracts.md` §5 `BoundaryDecision = OPEN_SIDE | OPENING_IN_WALL | RECESS_MOUTH | CARPORT | COVERED_TERRACE | UNRESOLVED`
   mixes geometric decisions with semantic classes. On plan evidence alone CARPORT vs COVERED_TERRACE vs PERGOLA vs open
   terrace is not decidable (cover is not on the plan, except as dashed overhead lines), and the current COVERED_TERRACE
   label is produced on wall slices (glogownikach, KNOWN). Recommend: geometric decisions only (+ NO_HOST); semantic kinds
   as alternatives for 005R/005S.
2. `first-bad-summary.md` (glogownikach) treats the 3 PAVED terraces as a glogownikach symptom. They are a **class**:
   17 of 29 production terraces, including three known-good PASS rows (§4.2).
3. The capability registry (not a 005P artifact, but cited as truth by 03G) states TERRACE recognition with no gaps.

With sibling 005Q artifacts (for the lead): the preregistered N1 trigger is narrower than the sliver population (eoze's
strip is a half band, not a band with both faces on the strip edges; cieszyniankach's is blank paper), and G1 freezes
sliver terraces on PASS rows.

---

## 9. Design implications (constraints)

Must:
1. Treat `metricAccuracy` as a derived reading of existing labels (§3), never a stored field in 005Q; keep ASSUMED out of
   DERIVED/VISUAL_APPROX.
2. Carry host side per stretch (inward sign + face type) and the ids of gaps, parts and chains through every decision
   record; keep body/stretch ids stable (not list indices).
3. Keep open parts unbuilt and semantically unnamed; carry alternatives, not a winner.
4. Before 005S emits anything visual into the model, production must write `evidenceSources` and `Evidence.sourceIds`
   (existing fields, 0 today), or ship the feature graph; otherwise a VISUAL_INFERRED object cannot say which picture it
   came from, and an UNKNOWN assembly cannot validate.
5. Count independence by content lineage (asset, then near-duplicate check), not by frame or asset id alone.
6. Re-anchor or re-read elevation-derived opening values whenever a body face moves.

Must not:
1. Add a shipping schema field in 005Q (FeatureFamily/ViewFamily/EvidenceStatus/proposal kinds additions are schema
   stages).
2. Turn a boundary-body relation into a canonical exterior feature.
3. Emit a terrace/return/platform in a strip no deeper than its host wall, or label one PAVED from wall ink.
4. Let a rendered image or a VLM answer set a dimension, a face, or a SOURCE_* status (005M: 30.9 % confident-wrong for the
   best small VLM, `STAGE_BUILDPLAN_ANALYZER_005M_VISUAL_REFEREE_V2.md:102,368`).

UNAVAILABLE here: whether ARCHON republishes near-identical renders under different URLs (no perceptual hash run);
whether the publisher's footprint counts roofed porches/terraces; the cover status (roofed or open) of krasnokwiatach's
NW terrace and porch and of glogownikach's S niche from plan alone; jarzabem's 0.48 m east strips and eoze-legacy-every's
rear 0.37 m strip (not checked on raster); the exact cause of the elevation-reading flip in CF-IFACE-1.
