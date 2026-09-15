# SourceObservationGraph — what was SEEN in the sources

> `buildapp.source-observation-graph` **1.0.0** · `packages/source-observations`
> Introduced in STAGE BUILDAPP-02.

A **SourceObservationGraph** is the sealed, content-addressed record of what
extractors saw in a sealed SourcePackage's images. It sits between acquisition
and reconstruction:

```text
URL → SourcePackage → SourceObservationGraph → hypotheses → solver → Building DSL → model
                                               └── BUILDAPP-03 onwards ──┘
```

Everything in it is **source-native**: 2D shapes in one image's own pixels, with
a confidence, a tolerance, an extractor and a sentence of evidence. There is no
z coordinate, no metre, no mesh and no command anywhere in the schema, and
`tests/architecture/analyzer.test.ts` fails by name if one appears.

## The rule this exists to enforce

**A vision model never produces geometry.** It produces observations, which are
claims about a picture. The only way one becomes a wall is through a solver that
weighs it against every other observation, and that solver is a later stage.

This is not stylistic. A model asked to "build this house" will return a house —
plausible, confident, and unfalsifiable. A model asked "where are the roof edges
in this image, and what did you use to decide" returns something a person can
check by looking, and a solver can weigh against a second view.

## Shape

```text
SourceObservationGraph
├── schema / schemaVersion / id
├── sourcePackageId + sourcePackageHash        the bytes this was read from
├── extractors[] { name, version, kind }       every contributor, versioned
├── coordinateFrames[]                         one per asset VARIANT
│   └── id, assetId, variantByteHash, size, roles
├── observations[]
│   ├── assetId + variantByteHash + frameId    which bytes, which grid
│   ├── kind + semanticHints[]
│   ├── pixelGeometry + normGeometry           the same shape, twice
│   ├── value? { unit: px|deg|count|ratio|text }
│   ├── depthLayer                             qualitative only
│   ├── confidence                             is it THERE
│   ├── uncertainty { positionPx, angleDeg? }  is it HERE
│   ├── provenance { extractor, name, region?, detail }
│   └── alternatives[]                         readings that also fit
├── relations[]                                how two observations stand
├── conflicts[]                                readings that cannot both be right
├── unresolved[]                               what was looked for and not found
└── contentHash
```

### Coordinate frames

Pixel coordinates mean nothing without the picture they are in, so every
observation names a **frame**: one asset variant's decoded pixel grid. The same
drawing at two resolutions is two frames, deliberately. Mixing them is the
acquisition bug — believing a size that is not the bytes' size — moved one layer
up, and the validator refuses a graph that does it.

### Two geometries, one of them derived

`pixelGeometry` is the reading in the frame's own pixels; `normGeometry` is the
same shape divided by the decoded size, so two variants of one drawing can be
compared. The normalized copy is always DERIVED by the builder — an extractor
never supplies it — because an extractor that could supply both could supply two
that disagree.

### Confidence and uncertainty are different questions

`confidence` is how sure the extractor is that the feature EXISTS.
`uncertainty.positionPx` is how wrong its coordinates might be. A model can be
certain a beam is there and quite unsure where its edge falls; a solver needs
both numbers and they are not the same number. A vision model may never claim
zero positional uncertainty: its coordinates are an estimate, and the graph
refuses to let one be weighted like a measurement.

### Ambiguity is represented, never resolved

Where two readings both fit, the better one is the observation and the other is
an `alternative` with its own confidence. Where two readings cannot both be
right, a `conflict` records them — both survive, unchanged, and nothing is
averaged. An average of two incompatible readings is a third reading that no
source supports.

### Gaps are named

`unresolved` carries what was looked for and not found: `MISSING` (looked,
absent), `AMBIGUOUS` (found, could not be pinned down), `NOT_ATTEMPTED` (out of
scope for this extractor). A named hole can be filled by a better source or a
later pass. Silence cannot be told apart from "there is nothing there".

## The observation vocabulary

Three families, in `ObservationKind`:

**Metric and drawing evidence** — `PRINTED_DIMENSION`, `LEVEL_DATUM`, `ANGLE`,
`SCALE_ANCHOR`, `ROOM_LABEL`, `ROOM_AREA`, `WALL_AXIS`, `WALL_BAND`,
`OPENING_INTERVAL`, `STAIR_SYMBOL`.

**2D geometric primitives** — `POINT`, `LINE`, `POLYLINE`, `POLYGON`,
`RECTANGLE`, `PROFILE`, `SILHOUETTE`, `PARALLEL_LINE_FAMILY`.

**Architectural candidates** — `MASS_REGION`, `WALL_REGION`, `ROOF_REGION`,
`ROOF_EDGE`, `RIDGE`, `EAVE`, `OPENING`, `WINDOW`, `DOOR`, `BALCONY`, `LOGGIA`,
`RAILING`, `CHIMNEY`, `STAIR`, `SURFACE_REGION`, **`LINEAR_VOLUME_CANDIDATE`**.

### LINEAR_VOLUME_CANDIDATE

The kind this stage exists for. A long, straight, THICK member that reads as a
solid body — a frame, a beam, a portal, a fin, a deep reveal, a parapet upstand
— whose actual primitive is not yet known. It is the honest answer to "there is
clearly a 300 mm deep concrete frame here and I do not yet know whether it is a
beam, a wall or a column", and without it that observation has nowhere to go
except into a flat `SURFACE_REGION`, which is how a facade full of solids
reconstructs as a facade full of paint.

The promotion rule is DEPTH, never colour. `packages/source-analyzer/src/depth.ts`
promotes a band only on a cue that implies a third dimension:

| cue | what it is |
| --- | --- |
| `SHADOW` | the strip beyond one long side is darker than the wall further out AND than the same strip on the other side |
| `END_FACE` | a strip at one END reads differently from both the band's face and the wall beyond it: the member's end is visible |
| `OCCLUSION_BREAK` | a line crossing the band stops at one long edge and resumes collinear at the other: it passed behind |
| `RETURN_FACE` | the interior is split lengthwise into two tones: a front face and a side or soffit seen at an angle |
| `TONE_STEP` | the band differs in tone from the wall on both sides — true of a proud beam and equally true of paint, so it corroborates and never decides |

A band with no depth cue is still recorded, as a `SURFACE_REGION`, which is
exactly what it looks like. Nothing is discarded; the two are distinguished.
One cue was tried and REMOVED: "the band is closed by a stroke at its end". A
painted band's colour also stops, and stopping draws the same line.

### Semantic hints

An observation's `semanticHints` say what it might MEAN without committing:
`beam`, `facade-frame`, `portal`, `fin`, `parapet`, `reveal`, `lintel`,
`column`, `pilaster`, `cladding`, `glazing`, `railing`, `balcony-slab`,
**`side-return`**, `recess-mouth`, `recess-back`, `gable`, `eave`, `ridge`,
`chimney`, `rooflight`, `stair-flight`, `stair-winder`, `stair-direction`,
`tread-line`, `dimension-chain`, `level-datum`, `wall-band`, `unknown`.

## Depth and layering

`DepthLayer` is qualitative and stays that way: `FRONT`, `PROUD_OF_WALL`,
`HOST_PLANE`, `RECESSED`, `BACK`, `UNKNOWN`. A published elevation carries no
depth measurement and inventing one would be the flattest kind of fabrication.
What it does carry is ORDER, and order is what a multi-view solver can use.

Relations say the same thing between two observations: `PROUD_OF`,
`RECESSED_BEHIND`, `COPLANAR_WITH`, `OCCLUDES`, `INSIDE_RECESS`.

## Relations

**Within a view** — `PROUD_OF`, `RECESSED_BEHIND`, `COPLANAR_WITH`, `OCCLUDES`,
`INSIDE_RECESS`, `SPANS_BETWEEN`, `CONTINUES_ACROSS`, `ALIGNS_WITH`, `SUPPORTS`,
`CONTAINS`, `ABOVE`, `BELOW`, `LEFT_OF`, `RIGHT_OF`. Both ends must be on the
same frame: pixel coordinates in two views are not comparable.

**Across views** — `POSSIBLY_SAME_FEATURE`, `SAME_FEATURE`, `CORROBORATES`,
`CONTRADICTS`. The asymmetry here is deliberate: a false merge destroys evidence
that nothing downstream can recover, while a missed merge only leaves work
undone. So `POSSIBLY_SAME_FEATURE` is the default and `SAME_FEATURE` is refused
below 0.9 confidence.

`CONTINUES_ACROSS` is what lets a later solver recover ONE member running from a
garage opening along a facade and under a balcony, rather than three unrelated
lumps — the owner's third Android finding, in one relation.

## Validation

`validateObservationGraph` checks internal consistency and nothing else: whether
a roof edge is in the RIGHT place is the benchmark's question. It reports:

- every observation is on a frame the graph defines, with that frame's asset and
  bytes;
- the normalized geometry agrees with the pixel geometry on that frame's size;
- no coordinate lies outside the image it claims to be on (margin 2 %);
- positional tolerance is finite, non-negative, and smaller than half the image
  diagonal; a VISION_MODEL observation may not claim zero;
- relations point at observations that exist, are not self-referential, and
  respect the within-view / cross-view split;
- direction relations agree with the pixels (an `ABOVE` whose source centroid is
  lower is an error, not a nuance);
- every extractor that produced anything is declared, so its version is hashed;
- every id is the deterministic id of its own content.

`npm run observations:audit -- <graph.json>` runs it and exits non-zero on any
error.

## Determinism and the content hash

Ids are content addresses: an observation's id is a function of the bytes it was
seen on, what it is, where it is (normalized), what it measures, and which
extractor saw it. Re-running the same extractors over the same bytes produces
the same ids, so two graphs are diffable and a graph is replayable.

`observationGraphContentHash` hashes the package identity, every extractor's
name/version/kind, the frames, and every observation, relation, conflict and
gap — as SETS, so extraction order is invisible. It excludes `provenance.detail`
and `note` (prose), every id (already derived), and anything wall-clock. Nothing
carries a timestamp, a latency or a token count into the graph in the first
place; those live in the vision trace beside it.

The provider rule that follows, tested both ways: changing a provider's VERSION
changes the hash (a different reader is a different reading); changing how long
its call took, or how it worded its answer, does not.

## The BuildWorld surface

BuildWorld's **Sources** panel shows a sealed graph: frames, observations by
kind with their evidence, tolerances and alternatives, the conflicts and the
named gaps. It is read-only structurally — the component is handed no store and
imports no command — and it does not fetch: a graph arrives either as the sample
built into the bundle or from a file the viewer opens, the same artefact the CLI
writes, validated by the same schema and the same rules.
