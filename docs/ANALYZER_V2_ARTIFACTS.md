# Analyzer v2 artifacts

> `stage-reports/artifacts/analyzer-v2/` · written by `npm run reconstruct:v2`, `npm run overlays:v2` and `npm run evaluate:v2` · read back by `npm run audit:analyzer-v2` and `tests/architecture/analyzer-v2.test.ts`

Every file under the directory, what writes it and what it holds. `<slug>` is
`marcowki` for the committed reference run. Every JSON file is written with
`stableJson`, so a re-run on the same inputs produces the same bytes; the
files chain by hash (candidate → layout, metrics, observation graph; graph →
package, observation graph, metrics; ledger and quality → graph; residuals →
candidate), and the audit checks every link.

## Written by `packages/analysis-service/scripts/reconstruct-v2.ts`

| file | schema | contents |
| --- | --- | --- |
| `<slug>-auto-v2.json` | `buildapp.reconstruction-candidate` 1.1.0 | the sealed candidate: the Building DSL `program` (209 commands on the reference run), the four input hashes, `structuralLayoutId/Hash`, `solver` `reconstruction.solver.v2@2.0.0`, `modelId` `m-auto-v2-<slug>`, `modelHash`, the solver `steps`, one `PrimitiveTrace` per bound object, the named `unresolved` holes, and `residuals` counts (`hard` = features with `SOURCE_EXACT` provenance, `soft`, `unresolved`, `metricRmsM`, `metricMaxM`) |
| `<slug>-layout.json` | `buildapp.structural-layout-hypothesis-set` 1.0.0 | the 03R composition v2 started from: storeys, footprint regions (BUILT and ZONE), masses, attachments, roof supports, gate; its `contentHash` is the candidate's `structuralLayoutHash` |
| `<slug>-metrics.json` | `buildapp.metric-evidence-set` 1.1.0 | the metric evidence the run read: 142 readings on the reference run (75 `LINEAR_DIMENSION`, 56 `OPENING_CALLOUT` from the ring reader with width and height candidates as `alternatives`, 7 `ANGLE`, 4 `LEVEL_DATUM`), chains, coordinate registrations, 764 OCR tokens |
| `<slug>-building.json` | `BuildingV2` (no schema field) | what the v2 passes solved, in the v2 frame, before emission: levels, masses, `mainRoof`, `attachedRoofs`, `recesses`, `returns`, `balconies`, `railings`, `portalHeads`, `verges`, `chimneys`, `rooflights`, `openings` (each with per-property `provenance` and `unresolved`), `sharedDoors`, `interior` per storey (walls, doors, blocks, rooms, unresolved), `stair`, `assemblies`, `surfaceRegions`, `wallThicknessM`, `slabThicknessM`, `terrainY` when read. Every element carries its `featureId` |
| `<slug>-model.json` | `buildapp.canonical-building-model` 1.5.0 | the candidate's program replayed through the real DSL and serialised; the audit checks it is byte for byte the replayed model |
| `<slug>-hypotheses-v2.json` | `buildapp.primitive-hypothesis-set` 1.0.0 | a shell that gives the candidate its `hypothesisSetId` and `hypothesisSetHash`: the hash is taken over the feature graph's hypotheses, but the file's own `hypotheses` array is empty and its `fusion` counts are zero. The hypotheses themselves are in `feature-lineage.json` |
| `feature-lineage.json` | `buildapp.architectural-evidence-graph` 1.0.0 | the feature identity graph: sightings, measurements, hypotheses, alternatives, solved features, bindings, relations. `docs/FEATURE_IDENTITY_GRAPH.md` |
| `evidence-consumption.json` | `buildapp.evidence-consumption-ledger` 1.0.0 | one disposition per observation, metric reading, page fact and published room, with reason and stage, plus a `summary`. `docs/EVIDENCE_CONSUMPTION.md` |
| `feature-quality.json` | `buildapp.feature-quality-report` 1.0.0 | one record per solved feature with its computed `L0`/`L1`/`L2` level, provenance, coverage, unresolved properties and the model `objectIds` it became; `summary` per family and level |
| `source-view-residuals.json` | `{ candidateHash, residuals[] }` | the model projected into the registered renders: per opening on a facade a render shows, `OPENING_SILL` and `OPENING_HEAD` against the elevation extent; per main-roof sample column, `ROOF_EDGE` against the nearest strong edge; since BUILDAPP-03Y the exterior assemblies — `BAND_TOP` and `BAND_SOFFIT` of every balcony slab and portal head, `RETURN_FACE` of every return, `VERGE_UNDERSIDE` of every verge board and the ground storey's `SILHOUETTE_WIDTH` — each against the nearest tone edge within reach, "not observed" when there is none. Each residual has `modelM`, `observedM`, `residualM`, `toleranceM`, `withinTolerance` and a `why`. 68 on the reference run (Auto v3), 12 outside tolerance |
| `assembly-closure.json` | `buildapp.assembly-closure` 1.0.0 | how the members meet (BUILDAPP-03Y): `candidateHash`, every closure `decision` (subject, what moved, why — return snapping and stacking, balcony ends, railing runs and turns, verge depth, the portal band, terrace edges, tones), the `facadeGraph` (nodes with termination; CONTINUES_TO / TERMINATES_AT / TURNS_AT / MEETS_HOST edges with their gaps), the `terraces`, the bodies' `massTones` and each return's `returnTones` |
| `repair-trace.json` | `RepairTrace` | per repair round, the residual counts before and after, every operation `applied` (kind, feature, before, after, why) and every one `refused` with its reason; `converged`. The reference run: one round, nothing applied, nine refusals |
| `registrations.json` | — | how each drawing maps into the v2 frame: `world` (`WorldFrameV2`), `plans` (frame, storey, `mppX/Y`, `originPx`, `wallPx`, `why`), `elevations` (`ElevationRegistrationV2`: side, one `mpp`, `extent`, `alongAtLeft`, `alongSign`, `zeroRow`, `spanM` and `spanWhy`, `bottomY`, `anisotropyCheck`, `why`), `section` (frame, `mpp`, `originCol`, `zeroRow`) and `cameras` (per perspective: `solved`, `residualPx`, `why`, and the `camera` with its anchors when solved) |

## Written by `packages/reconstruction/scripts/overlays-v2.ts` (`npm run overlays:v2`)

Self-contained SVGs: the publisher's cached bytes embedded once, never
re-encoded, with what the analyzer believes drawn on top in vector. Paths are
relative to the artifacts directory.

| file | contents |
| --- | --- |
| `source-atlas/<frame>.svg` | one per source frame (18 on the reference run): the pixel grid, the research atlas' view for that frame when an atlas is given (`--atlas`, default `research/marcowki-v2/source-atlas.json`, a diagnostic input outside the production boundary), and the analyzer's sightings on it as labelled boxes |
| `plan-overlays/storey-<n>.svg` | one per registered plan: the `BuildingV2` projected back to the sheet's pixels — bodies, returns, partitions, doors, rooms, the stair, the openings' gaps |
| `elevation-overlays/<side>.svg` | one per registered render (`front`, `rear`, `left`, `right`): the metric grid, openings, roof line, members, and the source-view residuals |
| `perspective-overlays/<frame>.svg` | one per perspective the camera solver attempted: the silhouette, the anchors, and the envelope projected through the camera when one was solved |
| `overlays-index.json` | `buildapp.analyzer-v2.overlays-index` 1.0.0: the package and graph ids, the input paths, and every file written with its `kind`, `frameId`, `assetId`, and where relevant `storeyIndex`, `side`, `solved` and a `note` |

## Written by `packages/reconstruction/scripts/evaluate-v2.ts` (`npm run evaluate:v2`)

Only for a project with a sealed truth file; it reads the truth by path and
is outside the production boundary.

| file | contents |
| --- | --- |
| `<slug>-v2-evaluation.json` | `buildapp.analyzer-v2.evaluation` 1: per truth item the matched feature, every compared property with its tolerance rule and verdict (`WITHIN` / `OUTSIDE` / `MISSING` / `UNRESOLVED_IN_AUTO`), the item verdict (`MATCH` / `PARTIAL` / `MISSING`), per-family summary, worst deltas, extras |
| `<slug>-v2-evaluation.md` | the same as a report: frame check, tolerance rules, the per-family table, worst deltas in every unit and in metres alone, one section per family, the truth's `UNRESOLVED` items with what the auto says, the MISSING items and properties, and the auto features no truth item matched |

## Written by `packages/candidates/scripts/exterior-closure.ts` (`npm run audit:exterior`)

| file | what it holds |
| --- | --- |
| `marcowki-exterior-closure-evaluation.json` | `buildapp.exterior-closure-evaluation` 1.0.0: the candidate under review against the one it replaces — per category (MASSING, ROOF, ROOF_EDGE_CLOSURE, WALL_SLAB_JOINTS, GARAGE_JOIN, RECESS_RETURNS, BALCONY, RAILING, TERRACE, FACADE_ASSEMBLY, OPENINGS, CHIMNEYS, ROOFLIGHTS, MATERIAL_READABILITY) the status PASS / PARTIAL / FAIL, expected and emitted features, checks against the sealed truth with tolerances, closure violations and the baseline's count, uncertainty and notes; the §17 `sourceViewAudit` by measured kind; the §20 `cleanliness` metrics of both candidates. No aggregate score |
| `marcowki-exterior-closure-evaluation.md` | the same as tables |
| `../exterior-closure/closure-<candidate>.json` | the full `buildapp.geometry-closure-report` of each candidate: relations, findings, metrics, contacts |

The screenshots for the owner review are written by `npm run review:shots`
(`apps/web/tools/review-shots.ts`) under `stage-reports/artifacts/exterior-closure/review*/`.

## Not written here

`.cache/no-benchmark/` (from `npm run reconstruct:no-benchmark`) and
`.cache/no-reference/` hold the same set of files for the runs made with the
benchmark packages hidden; they are proofs, not artefacts, and are not
committed.
