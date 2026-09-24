# The Feature Identity Graph

> `buildapp.architectural-evidence-graph` **1.0.0** · `packages/reconstruction/src/v2/graph.ts`, with `quality.ts` for the levels
> Written by `reconstructV2` as `stage-reports/artifacts/analyzer-v2/feature-lineage.json`, graded in `feature-quality.json`. Introduced in STAGE BUILDAPP-03X.

The observation graph says what was SEEN on each drawing and the metric
evidence set says what was PRINTED. Neither says which sightings are the same
architectural feature, which hypotheses compete for the same ink, which of
them was solved, or which model objects the solution became — the questions a
reviewer asks first, and the ones the previous analyzer could not answer. The
`ArchitecturalEvidenceGraph` holds every feature the v2 analyzer works on as a
chain, `SourceSighting → MetricMeasurement → FeatureHypothesis →
SolvedFeature → SemanticObjectBinding`, with typed relations between features,
a computed quality level per solved feature, and a set of structural
invariants (`featureGraphViolations`) that the architecture tests and the
audit run on every sealed candidate. It knows no project; it is the
bookkeeping the solver fills in as it works.

## 1. Feature families and view families

`FeatureFamilySchema` names the twenty-one families the analyzer solves:
`LEVEL`, `MASS`, `EXTERIOR_WALL`, `RECESS`, `RETURN_WALL`, `INTERIOR_WALL`,
`ROOM`, `INTERIOR_DOOR`, `OPENING`, `ROOF`, `ATTACHED_ROOF`, `ROOF_MEMBER`,
`CHIMNEY`, `ROOFLIGHT`, `STAIR`, `BALCONY`, `RAILING`, `FACADE_MEMBER`,
`FACADE_ASSEMBLY`, `SURFACE_REGION`, `CAMERA`. `EXTERIOR_WALL` is defined and
not produced: the exterior walls are emitted from the `MASS` feature's ring.
`ViewFamilySchema` names where a sighting can come from: `PLAN`, `ELEVATION`,
`SECTION`, `PERSPECTIVE`, `SITE`, `PAGE`.

## 2. The chain

### Sightings

A `SourceSighting` is one place a feature was seen: `frameId`, `assetId`,
`viewFamily`, the observation-graph `observationIds` it rests on (empty when
the v2 pass read the raster itself, which is most of them), an optional
`pixelRect`, a `what` and a `confidence`. The orchestrator's `sighting()`
helper builds the id as `stableId('sight', <what[0..24]>-<frame[-8..]>,
{ frame, what, pixelRect })` and de-duplicates on it, so two readings of the
same thing on the same frame are one sighting.

### Measurements

A `MetricMeasurement` is one metric statement about a feature — `quantity`,
`value`, `low`, `high`, `unit`, a `method` from `PRINTED`, `CHAIN`,
`REGISTERED_PIXEL`, `CROSS_VIEW`, `DERIVED`, `CONVENTION`, and the sightings
and metric-evidence ids it rests on. The schema and the invariants support
them; the orchestrator does not yet write any (`measurements: []` on the
reference run). The figures travel on the hypotheses' parameters instead.

### Hypotheses

A `FeatureHypothesis` (`hyp-<key>`) claims that a feature of a `family` exists
with `parameters`, each `{ value, low, high, unit }` with the unit in `m`,
`deg`, `count` or `none`; it names its `sightingIds`, `measurementIds`, an
optional `storeyIndex` and `hostId`, an optional `alternativeGroupId`, a
`confidence` and a `why`. On the reference run there are 103.

### Alternative groups

A `FeatureAlternativeGroup` is a `question`, the rival `hypothesisIds`, the
`chosenId` and a `why`. Defined and invariant-checked; the orchestrator writes
none. Rival readings of one thing are carried today inside a reading — an
opening's callout `heightCandidates`, a stair's `riserCountInterval` — not as
competing hypotheses.

### Solved features

A `SolvedFeature` (`feat-<key>`, the same key as its hypothesis) is the
hypothesis the solver settled: `family`, `hypothesisId`, `storeyIndex`,
`hostId`, a `quality` level, a `provenance`, a `parameterProvenance` map
where a parameter's provenance differs from the feature's, a
`sourceCoverage` (`viewFamilies`, `sightings`, `independentAssets` — distinct
assets, not variants of one drawing — and `printed`), an `uncertainty` in
metres or degrees, its `parameters`, the `unresolvedProperties` it names, and
a `why`. The orchestrator's `feature()` helper writes the hypothesis and the
solved feature together and computes the quality level at once.

### Bindings

A `SemanticObjectBinding` (`bind-<objectId>`) says which model object a solved
feature became: `solvedFeatureId`, `objectId`, `objectKind` (the model
collection: `walls`, `openings`, `rooms`, `slabs`, `wallRings`, `roofs`,
`linearSolids`, `balconies`, `railings`, `chimneys`, `roofOpenings`,
`rooflights`, `windows`, `doors`, `stairs`, `levels`, `surfaceRegions`) and the
`commandIndex` in the program. The emitter records a binding on every command
it pushes with a feature id; the orchestrator normalises the emitter's bare ids
(`main-iwall-0-z-2`, `main-room-0-3`) to the `feat-` form when it drafts the
graph. One feature may bind several objects (`feat-main` binds `slab-main-0`,
`ring-main-0`, `slab-main-1`, `ring-main-1`; an interior door binds its
`cutOpening` and its `placeDoor`), and several features may bind one object:
the pieces of a partition that a door gap joins are merged into one wall run,
so `main-iwall-1-z-2` is bound by four `INTERIOR_WALL` features.

### Relations

`FeatureRelationKindSchema` names twelve kinds: `SAME_FEATURE_AS`,
`HOSTED_BY`, `PART_OF`, `ALIGNED_WITH`, `CONTINUES_AS`, `ABOVE`, `BELOW`,
`PROJECTS_FROM`, `RECESSED_FROM`, `SUPPORTS`, `CONTRADICTS`, `CORROBORATES`.
A relation has `fromId` and `toId` (ids of sightings, hypotheses or solved
features, as the kind requires), a `confidence` and a `why`. The reference
run emits five kinds:

| kind | from → to | meaning, as the orchestrator uses it |
| --- | --- | --- |
| `HOSTED_BY` | feature → feature (16) | the feature opens through or sits in the host: an opening in a body's wall, a recess through a body's face |
| `PART_OF` | feature → feature (18) | a member of a whole: a return of a recess, a member of a gable frame |
| `CONTINUES_AS` | feature → feature (9) | one member runs on as another in the same plane: a return into the verge band, the balcony fascia into the portal head |
| `SUPPORTS` | feature → feature (4) | the first carries the second: a body its roof or the portal head, a balcony its balustrade |
| `SAME_FEATURE_AS` | sighting → sighting (2) | the same thing seen twice: a chimney block on both storeys' plans |

`ALIGNED_WITH`, `ABOVE`, `BELOW`, `PROJECTS_FROM`, `RECESSED_FROM`,
`CONTRADICTS` and `CORROBORATES` are defined and not yet emitted.

## 3. Quality levels

`QualityLevelSchema`: `L0` topology only — the feature exists here, with
placeholder metrics; `L1` metric, from one view family or derived, not
corroborated; `L2` metric and corroborated across independent views, or
printed. The level is **computed** by `qualityLevelOf` from the solved
feature's provenance and coverage, so a solver cannot award itself a level it
did not earn:

1. `UNRESOLVED` or `ASSUMED_FOR_RENDERING` provenance → `L0`.
2. No metric parameters at all (an assembly, a finish region) → `L1` if
   `SOURCE_CORROBORATED`, else `L0`.
3. `printed`, or at least two independent assets → `L2`, except a
   `VISUAL_SEMANTIC` feature, which stops at `L1`.
4. Otherwise `L1`.

`sealQualityReport` in `quality.ts` writes one `FeatureQualityRecord` per
solved feature — `featureId`, `family`, `level`, `provenance`,
`sourceCoverage`, `uncertainty`, `unresolvedProperties`, the `objectIds` its
bindings gave it, `why` — sorted by id, with a `summary` of counts per family
and level, sealed against the feature graph's hash. On the reference run: 103
records, `L2` 31, `L1` 67, `L0` 5.

## 4. Provenance statuses

`ProvenanceStatusSchema` is the vocabulary the source truth, the graph, the
building and (through `emit.ts`) the model share: `SOURCE_EXACT` (a printed
figure), `SOURCE_CORROBORATED` (two sources agree), `SOURCE_DERIVED` (computed
from source figures or read from a plan's ink), `IMAGE_METRIC_REGISTERED`
(measured on a registered render), `VISUAL_SEMANTIC` (a reading of what
something looks like — an opening's family, a finish tone),
`ASSUMED_FOR_RENDERING` (a convention, which must be named in
`unresolvedProperties`), `UNRESOLVED`. On the reference run the 103 solved
features are `SOURCE_DERIVED` 57, `SOURCE_CORROBORATED` 16, `SOURCE_EXACT`
15, `IMAGE_METRIC_REGISTERED` 10, `UNRESOLVED` 2, `ASSUMED_FOR_RENDERING` 2,
`VISUAL_SEMANTIC` 1.

## 5. Sealing and the invariants

`sealFeatureGraph(draft)` hashes the inputs (`sourcePackageHash`,
`observationGraphHash`, `metricEvidenceHash`) in order and the seven
collections as unordered sets through `hashArtifact`, so element order cannot
reach the `contentHash`; the ledger and the quality report are then sealed
against that hash. `featureGraphViolations(graph)` returns the violations;
empty means sound:

- a measurement or hypothesis cites an unknown sighting or measurement; a
  hypothesis names an unknown alternative group;
- an alternative group names an unknown hypothesis, or chose one that is not a
  member;
- a solved feature names an unknown hypothesis, or one of another family;
- a solved feature assumes a value (its provenance, or any parameter's, is
  `ASSUMED_FOR_RENDERING`) and names nothing unresolved;
- a solved feature claims `L2` with fewer than two independent assets and
  nothing printed;
- a solved feature is `L0` with parameters yet claims `SOURCE_EXACT` or
  `SOURCE_CORROBORATED`;
- a binding names an unknown solved feature; a relation starts or ends at an
  unknown id;
- **a solved feature above `L0` became no model object**, unless its family
  is expressed through its members: `CAMERA` (a camera is nothing in a
  building), `FACADE_ASSEMBLY` (its members are the objects) and `RECESS`
  (its returns and floor are the objects).

On the reference run the unbound features are exactly the four recesses, the
two gable-frame assemblies, the three cameras, and two `INTERIOR_WALL`
features the emitter dropped — which is the other half of the rule: when
`emitBuilding` drops a feature, the orchestrator sets it to `L0` and
`UNRESOLVED` and appends `not built: <why>` to its unresolved properties
(`feat-main-iwall-0-z-7`: "not built: the partition is −0.35 m long once
trimmed to the walls it meets"), so that a feature that vanished on the way
to the model says so rather than passing as a topology-only reading.

## 6. How the files relate

- `feature-lineage.json` is the sealed graph. Ids: sightings `sight-…`,
  hypotheses `hyp-<key>`, solved features `feat-<key>`, relations
  `rel-<kind>-<from>-<to>-<hash>`, bindings `bind-<objectId>`. The key is the
  reading's own id in `marcowki-building.json`: `opening-1-front-4-0`,
  `recess-front-0`, `return-front-0-0`, `main-room-0-3`, `stair-main`,
  `portal-head-attached-0`.
- `marcowki-building.json` (`BuildingV2`) carries a `featureId` on every
  element — mass, level, roof, recess, return, opening, balcony, railing,
  portal head, verge, chimney, rooflight, stair, surface region — pointing at
  the solved feature.
- `feature-quality.json` has one record per solved feature and lists the
  `objectIds` its bindings gave it; its `summary` is the per-family table the
  audit prints.
- `marcowki-model.json` holds the objects by the ids the bindings name;
  `marcowki-auto-v2.json`'s `traces` carry one `PrimitiveTrace` per bound
  object with the hypothesis id and the feature's `why`.
- `evidence-consumption.json`'s `USED_IN_MODEL` records name solved features
  by `featureId`, which closes the loop from a printed figure to an object.

Reference-run counts: 55 sightings (33 on plans, 14 on elevations, 5 on the
section, 3 on perspectives), 0 measurements, 103 hypotheses, 0 alternatives,
103 solved (`INTERIOR_WALL` 31, `ROOM` 12, `OPENING` 12, `INTERIOR_DOOR` 9,
`RETURN_WALL` 8, `RECESS` 4, `BALCONY` 4, `ROOFLIGHT` 3, `CAMERA` 3, and two
each of `MASS`, `LEVEL`, `CHIMNEY`, `ROOF_MEMBER`, `FACADE_ASSEMBLY`,
`RAILING`, one each of `ROOF`, `STAIR`, `ATTACHED_ROOF`, `FACADE_MEMBER`,
`SURFACE_REGION`), 124 bindings, 49 relations.

## 7. Worked example: the front balcony fascia and the portal head

On the front render the fascia reader finds a dark band across the front
recess mouth at the first-storey level; the same recess is a zone on the
attic plan. Two sightings, quoted from `feature-lineage.json`:

```json
{"id": "sight-balcony-fascia-band-462d58b4-2a91b2396e", "frameId": "frame-asset-gotowy-projekt-dom-w-marcowkach-ge-elewacj-f8462d58b4", "assetId": "asset-gotowy-projekt-dom-w-marcowkach-ge-elewacja-fron-ee81d52db6", "viewFamily": "ELEVATION", "observationIds": [], "what": "balcony fascia band", "confidence": 0.7}
{"id": "sight-balcony-floor-in-the-zon-d2722c38-a69e06dfc3", "frameId": "frame-asset-rzut-117027f690-fed2722c38", "assetId": "asset-rzut-117027f690", "viewFamily": "PLAN", "observationIds": [], "what": "balcony floor in the zone", "confidence": 0.6}
```

The balcony hypothesis and its solved feature (`hyp-balcony-front-1` /
`feat-balcony-front-1`) carry the band's extent along the mouth, its top and
its thickness; the feature is `IMAGE_METRIC_REGISTERED`, `L2` because two
independent assets saw it, with the slab section named unresolved:

```json
{"id": "feat-balcony-front-1", "family": "BALCONY", "hypothesisId": "hyp-balcony-front-1", "storeyIndex": 1, "quality": "L2", "provenance": "IMAGE_METRIC_REGISTERED", "parameterProvenance": {}, "sourceCoverage": {"viewFamilies": ["ELEVATION", "PLAN"], "sightings": 2, "independentAssets": 2, "printed": false}, "uncertainty": {"m": 0.05}, "parameters": {"from": {"value": 3.134658, "low": 3.034658, "high": 3.234658, "unit": "m"}, "to": {"value": 7.229937, "low": 7.129937, "high": 7.329937, "unit": "m"}, "topY": {"value": 3.028855, "low": 2.978855, "high": 3.078855, "unit": "m"}, "thickness": {"value": 0.707826, "low": 0.627826, "high": 0.787826, "unit": "m"}}, "unresolvedProperties": ["slab section (fascia only)"], "why": "a 0.71 m band of dark tone at 2.32..3.03 across 5 columns of the recess mouth (spread 0.08 m); the slab top is the storey floor"}
```

The same band runs on across the attached body's zone, whose flat roof the
attic plan draws projecting over that zone; so the orchestrator solves a
`FACADE_MEMBER` from the same two sightings, `SOURCE_CORROBORATED`, and
relates the two:

```json
{"id": "feat-portal-head-attached-0", "family": "FACADE_MEMBER", "hypothesisId": "hyp-portal-head-attached-0", "quality": "L2", "provenance": "SOURCE_CORROBORATED", "parameterProvenance": {}, "sourceCoverage": {"viewFamilies": ["ELEVATION", "PLAN"], "sightings": 2, "independentAssets": 2, "printed": false}, "uncertainty": {"m": 0.05}, "parameters": {"y0": {"value": 2.321029, "low": 2.271029, "high": 2.371029, "unit": "m"}, "y1": {"value": 3.028855, "low": 2.978855, "high": 3.078855, "unit": "m"}}, "unresolvedProperties": [], "why": "the fascia band continues across attached-0’s zone at the same level: the projecting roof’s edge"}
{"id": "rel-continues-as-ny-front-1-attached-0-956c9afdca", "kind": "CONTINUES_AS", "fromId": "feat-balcony-front-1", "toId": "feat-portal-head-attached-0", "confidence": 0.8, "why": "the balcony fascia continues as the portal head"}
{"id": "rel-supports-attached-0-attached-0-c2ec42c022", "kind": "SUPPORTS", "fromId": "feat-attached-0", "toId": "feat-portal-head-attached-0", "confidence": 0.8, "why": "the attached body carries the head"}
{"id": "rel-supports-ny-front-1-ng-front-1-b28d516b71", "kind": "SUPPORTS", "fromId": "feat-balcony-front-1", "toId": "feat-railing-front-1", "confidence": 0.8, "why": "the balustrade stands on the slab"}
```

The emitter then binds each to its object — `createLinearSolid`,
`createBalcony`, `createRailing`:

```json
{"id": "bind-portal-head-attached-0", "solvedFeatureId": "feat-portal-head-attached-0", "objectId": "portal-head-attached-0", "objectKind": "linearSolids", "commandIndex": 132}
{"id": "bind-balcony-front-1", "solvedFeatureId": "feat-balcony-front-1", "objectId": "balcony-front-1", "objectKind": "balconies", "commandIndex": 134}
{"id": "bind-railing-front-1", "solvedFeatureId": "feat-railing-front-1", "objectId": "railing-front-1", "objectKind": "railings", "commandIndex": 142}
```

and `feature-quality.json` grades the head `L2` with `objectIds:
["portal-head-attached-0"]`. The evaluation finds the portal head a MATCH
(x 7.9..12.05, z 0..0.991, fascia 2.321..3.029 against the truth's
2.28..3.07) and the balcony PARTIAL, 0.67 m short on the east — the same band,
read to the same height, cut at different columns.

## 8. Worked example: a raked gable window

The 270/320 front gable glazing is a gap in the attic plan's front wall and
a contrast band on the front render:

```json
{"id": "sight-wall-gap-3-93-6-63-on-t-d2722c38-12b8d89723", "frameId": "frame-asset-rzut-117027f690-fed2722c38", "assetId": "asset-rzut-117027f690", "viewFamily": "PLAN", "observationIds": [], "pixelRect": {"x0": 196, "y0": 654.3859475004945, "x1": 297, "y1": 673.0140384995054}, "what": "wall gap 3.93..6.63 on the front wall", "confidence": 0.7}
{"id": "sight-opening-extent-on-the-fr-462d58b4-00bbabfb15", "frameId": "frame-asset-gotowy-projekt-dom-w-marcowkach-ge-elewacj-f8462d58b4", "assetId": "asset-gotowy-projekt-dom-w-marcowkach-ge-elewacja-fron-ee81d52db6", "viewFamily": "ELEVATION", "observationIds": [], "what": "opening extent on the front render", "confidence": 0.85}
```

The solved feature is `SOURCE_EXACT` and `L2` (a printed callout, two
assets), with per-parameter provenance, and it names the disagreement it did
not resolve:

```json
{"id": "feat-opening-1-front-4-0", "family": "OPENING", "hypothesisId": "hyp-opening-1-front-4-0", "storeyIndex": 1, "hostId": "feat-main", "quality": "L2", "provenance": "SOURCE_EXACT", "parameterProvenance": {"family": "VISUAL_SEMANTIC", "headY": "SOURCE_EXACT", "profile": "SOURCE_DERIVED", "sillY": "SOURCE_DERIVED", "width": "SOURCE_EXACT"}, "sourceCoverage": {"viewFamilies": ["PLAN", "ELEVATION"], "sightings": 2, "independentAssets": 2, "printed": true}, "uncertainty": {"m": 0.03}, "parameters": {"from": {"value": 3.925415, "low": 3.895415, "high": 3.955415, "unit": "m"}, "width": {"value": 2.7, "low": 2.67, "high": 2.73, "unit": "m"}, "sillY": {"value": 3.06, "low": 2.96, "high": 3.16, "unit": "m"}, "headY": {"value": 6.26, "low": 6.16, "high": 6.36, "unit": "m"}}, "unresolvedProperties": ["the elevation reads 0.54 m tall (4.82..5.35) against the printed 3.20; the printed height stands"], "why": "a 2.68 m gap in the front wall of main on storey 1, printed 270/320, 0.54 m tall on the elevation; on a gable end its head rakes from 6.26 to 3.99"}
{"id": "rel-hosted-by-front-4-0-feat-main-f17a4cf7a9", "kind": "HOSTED_BY", "fromId": "feat-opening-1-front-4-0", "toId": "feat-main", "confidence": 0.8, "why": "an opening in the front wall"}
```

In `marcowki-building.json` the opening is `profile: "RAKED_SINGLE"`, `headY`
6.26, `headFarY` 3.99, family `MULTI_PANEL_GLAZING`; the emitter writes
`cutOpening` with `head: { kind: 'RAKED', heightFar }` and a `placeWindow`,
and binds both:

```json
{"id": "bind-opening-1-front-4-0", "solvedFeatureId": "feat-opening-1-front-4-0", "objectId": "opening-1-front-4-0", "objectKind": "openings", "commandIndex": 187}
{"id": "bind-opening-1-front-4-0-unit", "solvedFeatureId": "feat-opening-1-front-4-0", "objectId": "opening-1-front-4-0-unit", "objectKind": "windows", "commandIndex": 188}
```

The ledger closes the loop: `metric-callout-ring-…` `callout 270/320` is
`USED_IN_MODEL` for `feat-opening-1-front-4-0`. The repair trace shows why
the 0.54 m elevation reading did not move it: "opening_head is source exact
and a view reading 0.91 m away does not overrule it".

## 9. What the graph does not yet hold

- No measurements and no alternative groups are written, so the
  `MetricMeasurement` layer of the chain is empty and rival readings are not
  visible as competing hypotheses.
- Only five of the twelve relation kinds are emitted; `CONTRADICTS` and
  `CORROBORATES` in particular are carried as prose in `unresolvedProperties`
  and the ledger rather than as edges.
- The `MASS` and `LEVEL` features carry no plan sighting (`sightings: 0` on
  the masses; their coverage is `printed: true` from the chain basis), so
  their `L2` rests on the 03R layout's evidence rather than on a sighting in
  this graph.
- Chimney sightings are made without a `pixelRect`, so both chimneys share
  one sighting per plan and their `SAME_FEATURE_AS` relation is written twice
  with one id; `featureGraphViolations` does not check relation ids for
  uniqueness.
- A relation's `confidence` is the constant 0.8 the `relate()` helper
  defaults to.
