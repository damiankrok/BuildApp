# Analyzer v2 architecture

> `packages/reconstruction/src/v2` · solver `reconstruction.solver.v2` **2.0.0** · production entry `packages/reconstruction/scripts/reconstruct-v2.ts`
> Introduced in STAGE BUILDAPP-03X. Companions: `docs/EVIDENCE_CONSUMPTION.md`, `docs/FEATURE_IDENTITY_GRAPH.md`, `docs/ANALYZER_V2_ARTIFACTS.md`. The failures it was built to answer are itemised, family by family, in `docs/ANALYZER_FORENSIC_AUDIT.md`.

The v2 analyzer is the refounded path from a sealed SourcePackage, its
observation graph and its metric evidence set to a sealed building candidate.
It keeps exactly one pass of the 03R solver — the plan composition,
`composeStructuralLayout` — and re-reads everything after it from the drawings'
own pixels, through frames it registers itself, in one orchestrator
(`reconstructV2` in `reconstruct-v2.ts`) whose passes run in a fixed order.
Every reading it makes carries a `ProvenanceStatus` and a sentence of `why`;
every command it emits is bound to the solved feature it came from; every
observation, metric reading, page fact and published room receives a
disposition in a ledger; and the whole is sealed by hash and written under
`stage-reports/artifacts/analyzer-v2/`. It knows drawings and buildings and no
project, and the architecture tests plus two run-time proofs hold it to that.
Its known limitations are listed at the end, from the artefacts rather than
from memory.

## 1. Where 03R ends and v2 begins

`reconstructV2(options)` takes a `ReconstructionV2Options`: the `graph`
(`SourceObservationGraph`), the `metrics` (`MetricEvidenceSet`), a `raster`
function that decodes a frame's variant bytes on demand, the package's
`publishedAreas` and `publishedRooms`, a `label`, a `slug`, the package id and
hash, an optional `frameFilter` and an optional `debug` sink for a developer
watching a run. It returns a `ReconstructionV2Result` with the 03R `layout`,
the solved `building` (`BuildingV2`), the sealed `candidate` and its replayed
`model`, a `hypotheses` shell, the `featureGraph`, the `ledger`, the `quality`
report, the source-view `residuals` and `repair` trace, every `registrations`
entry, the `world` frame, the solver `steps`, the named `unresolved` holes and
the `violations` of the graph and ledger invariants.

From the 03R solver it takes, by name, `composeStructuralLayout` (plans →
sealed `StructuralLayoutHypothesisSet` with its gate), `levelsFrom` (the
section's ladder of level datums), `registerElevationFrames` (used only for
each render's silhouette extent and side assignment), `sealCandidate`,
`ringBounds`, `CONVENTIONS` and `SOLVER_NAME`. Nothing else of v1 is on the
path, and `tests/architecture/analyzer-v2.test.ts` checks that the names taken
from `../solve.js` and `../fusion.js` are conventions and readers, never a
constant that names an answer.

## 2. The pass order

The header of `reconstruct-v2.ts` lists the brief's passes A–N. What each one
consumes and produces, and where it lives:

| pass | what | module | consumes | produces |
| --- | --- | --- | --- | --- |
| A | acquisition | upstream: `@buildapp/source-package` in the entry script | a URL, or a replayed package | the SourcePackage and its byte cache |
| B | atlas | the graph's `coordinateFrames` | — | frames with roles (plan / elevation / section / perspective / page) |
| C | registration | `frame.ts`, `registerSection` in `roof-details.ts` | the 03R draft, plan rasters, silhouette extents, the ridge datum | `WorldFrameV2`, `PlanFrameV2` per storey, `ElevationRegistrationV2` per render, a `SectionFrame` |
| D | observations | the graph, plus the raster readers in `scan.ts` | — | ink runs, band pieces, thin strokes, tones |
| E | metric evidence | the metric set, plus v2 measurements | callouts, chains, datums; elevation extents | figures with candidates |
| F | cross-view identity | `graph.ts` | sightings | typed relations between features |
| G1 | main roof | orchestrator | roof support, ridge datum, side silhouettes | `MainRoofV2`, whether it covers the zones |
| G2 | recesses and returns | `recesses.ts` | ZONE regions, plan rasters | `RecessTopology` per zone per storey, `ReturnWallV2` |
| G3 | stair | `stair-topology.ts` | plan rasters, storey rise | `StairTopologyHypothesis`, a slab hole |
| G4 | interior | `interior.ts` | plan rasters, OCR tokens, published rooms, the stair as a barrier | partitions, door gaps, blocks, room polygons |
| G5 / H | openings | `openings-v2.ts` | plan gaps, ring callouts, registered renders | `OpeningV2` with per-property provenance; doorways between bodies |
| G6 | roof details | `roof-details.ts` | the section, interior blocks, side renders | attached roofs with parapets, chimneys, rooflights |
| I | assemblies | `facade.ts` | registered renders, recesses, returns | verge members, balconies, railings, portal heads, assemblies |
| §17 | cameras | `camera.ts` | perspective rasters, the envelope | a solved camera per render, or a stated refusal |
| — | finish regions | `dominantTone` in `scan.ts` | the recessed walls on the renders | `SurfaceRegionV2` (colour, never geometry) |
| J | DSL emission | `emit.ts` | `BuildingV2` | the program, bindings, dropped features |
| K | geometry | `sealCandidate` | the program | a candidate that replays byte for byte to its model |
| L | verification | `verifyAgainstViews` in `verify.ts` | `BuildingV2`, registered renders | per-feature residuals in metres |
| M | repair | `repairFromResiduals` in `verify.ts` | residuals | applied and refused operations |
| N | quality | `quality.ts`, `graph.ts`, `ledger.ts` | everything above | the feature graph, the ledger, the quality report |

Two things about the order are worth stating because the letters do not show
them. Verification and repair run on the `BuildingV2` **before** the program is
emitted — `verifyAgainstViews`, `repairFromResiduals`, `verifyAgainstViews`
again, then `emitBuilding` — so the emitted program already carries whatever
the repair applied. And K is the replay inside `sealCandidate`: the candidate
is proved to replay to the model it was sealed with, but no compiled geometry
is compared with a view; the residuals are computed from the solved features.

Each pass records a `SolverStep` (`stage`, `what`, `method`, `detail`,
`inputs`, `outputs`); the Marcówki run has fifteen, from `massing` to
`quality`, and they are in the candidate's `steps`.

## 3. Frames

### MODEL_FRAME

`packages/model/src/schema.ts` states the model frame: x right when looking at
the front facade, y up, z away from the front facade into the building, the
finished ground floor at y = 0, the front facade's outer face at z = 0, and
exterior rings traversed anticlockwise on a plan drawn with the front at the
bottom. The 03R solver did not obey it (`docs/ANALYZER_FORENSIC_AUDIT.md`,
F8); v2 does.

### WorldFrameV2 and the mirror to 03R

`worldFrameFrom(draft)` in `frame.ts` fixes the frame once, from the base
storey of the 03R draft. In the 03R layout z = 0 is the rear wall's outer face
and z grows towards the sheet's bottom. v2 takes the max-z extent of
everything dimensioned on the base storey — the front zone's mouth when a
zone exists, else the front wall face — as its z = 0, and records `zFlip` so
that `z_v2 = zFlip − z_03R` (`flipZ`). The frame carries the `envelope` (outer
planes included), the `walled` rectangle (wall face to wall face),
`frontSide: 'SHEET_BOTTOM'` and a `why`. On the reference run: envelope
x 0..12.05, z 0..14.601; walled z 0.991..13.601; `zFlip` 13.601283; and the
`why` reads "the front is the bottom of the plan sheet; the front outer plane
(a 0.99 m zone in front of the front wall) is z = 0 and the 03R layout's z is
mirrored about 13.601". The choice of front is evidence-backed by the sheet
convention and the elevation labels, and it is recorded rather than assumed
silently.

One nuance of vocabulary: `MODEL_FRAME` says "the front facade outer face is
z = 0"; v2 and the sealed truth both put z = 0 at the outermost front plane
(the returns' outer face), so the main body's front wall face sits at z 0.991.

### Plan registration

Two ways, both in `frame.ts`:

- `planFrameV2` — the base plan, through the chain-registered 03R world frame
  (`metresPerPixelX/Y`, `originPx`), converted by `flipZ`. A non-base plan can
  also go this way through the draft's shape alignment onto the base plan.
- `planFrameByOuterFaces` — a storey plan whose own chains fail (03R
  mis-registered the attic plan at 0.04694 m/px, F11 of the forensic audit)
  is registered by `outerWallFaces`: the leftmost and rightmost columns and the
  topmost and bottommost rows on which wall-thick ink covers at least 15 % of
  the extent. The four faces land on the walled body the storey covers; one
  scale per axis, and the two must agree to within 3 % or the frame is
  refused.

On the reference run the ground plan registers at 0.026426 m/px through its
chains and the attic plan at 0.026246 m/px by its outer faces (`px 46..347 ×
194..673 put on the 7.90 × 12.61 m body this storey covers; the two axes agree
to 0.3 %`). A `PlanFrameV2` carries `toWorld`, `toPixel`, its `originPx`
(where world x = 0 and z = 0 fall on the sheet) and `wallPx`, the sheet's own
wall thickness in pixels, which every later threshold on that sheet is stated
in.

### Render registration

`registerElevationV2` registers a rendered elevation with **one** scale. The
03R registration fitted the vertical scale from the silhouette's height with
the silhouette's bottom as y = 0, and on a render the bottom is the terrain
line, so every height came out a plinth too high. v2 instead takes the
silhouette's width from the 03R extent, matches it to the span it can show —
for a front or rear view the envelope width (plus any eaves overhang), for a
side view either the walled depth or the characteristic depth (the roof over
the recess zones) — and puts the apex on the ridge datum. The bottom then
falls out in metres and is checked against the terrain datum where the section
prints one (else against 0); a candidate whose bottom lands more than 0.9 m
off is refused, and the winning span is evidence for the roof's extent. On
the reference run the left and right renders chose "the 14.60 m characteristic
depth (the roof over the zones) (beats 12.61 m, which would put the ground
1.04 m)", and that vote is what makes `mainRoof.coversZones` true.

`elevationFrameFromV2` turns a registration into an `ElevationFrameV2` with
`alongOf` / `pxOf` / `yOf` / `pyOf` closures and the plane the view looks at.
The direction along the facade seen from outside is FRONT west→east, REAR
east→west, LEFT (the west wall) rear→front and RIGHT (the east wall)
front→rear, which is why `elevationFrameV2`'s comment warns that the 03R
LEFT/RIGHT assignments, made with the front at max z, swap under the v2 frame.

### Section registration

`registerSection` in `roof-details.ts` finds the outermost long vertical
wall-thick bands on the section sheet, matches the distance between them to
the envelope span they fit (x or z), and takes that span over those pixels as
the scale; the metric layer's own `SECTION_HY` scale is kept only as the hint
that chose the span, and its zero row is the y = 0 row. On the reference run:
0.013787 m/px, a cross-section along x, origin column 128.

### Perspective cameras

`solvePerspectiveCamera` in `camera.ts` resects a camera from a render's
silhouette: the convex hull of the not-sky, not-vegetation block is aligned in
cyclic order against the corner sequences a handful of canonical viewpoints
predict from the envelope, each hypothesis is resected through the
image-metrology `solveCamera`, refined by the further corners the first camera
says must lie on the outline, and the hypothesis whose rendered silhouette best
covers the detected one wins. Three of the four Marcówki perspectives solve
(1.3, 0.9 and 3.6 px rms); the fourth is refused with "no camera hypothesis
aligned enough silhouette corners with a plausible residual". A solved camera
becomes a `CAMERA` feature and decides the ledger disposition of that render's
observations; nothing is yet placed from a perspective.

## 4. The passes, module by module

**Masses and levels.** The 03R masses are converted by `flipZ` into `MassV2`
(`main`, `attached-0`, …), each a `MASS` feature whose chain segments are
`USED_IN_MODEL`. Levels come from `levelsFrom`: floors, stated heights, the
eaves and the ridge (`topDatum`). The top storey of a pitched body is given
`ridgeY − elevation` as its height so that the gable ends can be cut, while
`wallTop` keeps the printed eaves datum. The wall thickness `T` is the
decomposition's own when it lies in 0.15..0.7 m (0.49 m on the reference run),
else the convention; the slab thickness is derived from the storey gap when
the levels are measured.

**recesses.ts.** A zone the plan dimensions beyond its walls (`100 | 510 | 750
| 100`) is scanned on each storey's plan for return walls: five scan lines
laid across the zone at 20..80 % of its depth, a return being a piece of ink
at least half a wall thick that appears on at least 60 % of the lines. The
result is topology — a mouth on the outer plane, a back plane, a depth, the
returns found and the open intervals between them — and its `why` says
either "no wall-thick ink stands in the … zone … : a zone, not a recess" or
how many returns stood on how many lines. Each return becomes a `RETURN_WALL`
feature, `PART_OF` its `RECESS`, which is `HOSTED_BY` the body whose face it
opens through.

**interior.ts.** Inside a body, inset by its external wall, a partition is
neutral dark ink (low chroma, so coloured annotations do not qualify) between
0.2 and 0.72 of the external thickness across and at least 0.55 m along, with
an end that meets another wall; a free-standing piece is dropped as fitted
furniture and named unresolved. Solid blocks thicker than a partition in both
directions are chimneys or columns. Door gaps are 0.6..1.35 m breaks between
two collinear pieces. Rooms are the cells of a flood fill over a 0.05 m grid
with walls, gaps, blocks and the stair's flights as barriers; a polygon of
more than four faces above 20 m² is marked `openPlan`. Room numbers are OCR
digit tokens taller than 1.15× the sheet's median token inside a polygon,
matched to the published room table; a number whose polygon area is more than
40 % off the published area has its label withheld and the mismatch named.

**stair-topology.ts.** `findTreadLadders` looks for runs of thin strokes at an
even going (0.21..0.34 m) seen on several scan lines across the same band
(0.75..1.5 m); `poolLadders` merges the storeys' readings; `assembleStair`
chains ladders by adjacency, reads the landings as the corner squares between
perpendicular flights, fixes the direction from the arrowhead on the walking
line, and checks the riser count against the storey rise. Direction evidence
is `ARROW`, `SECTION` or `ASSUMED`; the stair is emitted as `FLIGHTS` only when
nothing is unresolved and the arrow was found, else as a placeholder over the
shaft. Nothing infers a stair from a rectangle.

**openings-v2.ts.** Every exterior wall of every body on every storey is a
`WallHost`. `planGaps` reads the gaps in the wall band along its centre line,
with the stubs drawn inside a gap kept as mullions. For each gap the nearest
ring callout within 2 m whose width candidates agree with the gap's width
(within 12 %) supplies the printed width and a list of height candidates; the
gap's own width is what picks among the reader's width readings. The
registered renders of that facade give the gap's vertical extent
(`elevationExtent`, through the image-metrology `verticalOpeningExtent`). The
sill and head then follow stated rules: callout and elevation agreeing within
0.2 m → both `SOURCE_CORROBORATED`; disagreeing → the printed height stands
(`SOURCE_EXACT` head), the sill is derived or image-registered or assumed, and
the disagreement is named in `unresolved`; a callout alone → a door-height
opening reaches the floor, a shorter one takes a common 2.2 m head with the
sill named unresolved, and two height readings the matcher cannot tell apart
leave the head `UNRESOLVED`; an elevation alone → both `IMAGE_METRIC_REGISTERED`;
neither → floor to 2.1 m, both `ASSUMED_FOR_RENDERING`. On a gable end
(`host.gable`) a head above the roof soffit at the far jamb becomes
`RAKED_SINGLE` with `headFarY` along the pitch. The family is read from the
plan symbol and the proportions (`glazingDrawn`, `doorSwingDrawn`, the width
and whether the sill reaches the floor) and is always `VISUAL_SEMANTIC`. A gap
on a face another body stands against is a doorway between the two bodies,
not a facade opening.

**roof-details.ts.** `readAttachedRoof` finds, on the registered section, the
topmost slab-thick horizontal band across an attached body's span and the wall
that continues above it at the outer end (the parapet). `readChimneys` takes
the interior blocks that stand on the same plan position on every storey and
looks for them above the roof line on the renders whose columns cover them.
`readRooflights` looks in the roof plane of a side render for patches lighter
than the covering's median luma, at three brightness steps (30, 50, 70 luma),
taking the lowest step at which a patch comes out as a filled rectangle of a
rooflight's size (0.45..1.8 by 0.35..1.8 m, at least 80 % filled, not touching
the region's edges); a patch overlapping a chimney's run is discarded.

**facade.ts.** `readVergeMember` measures, at six columns across a gable, the
band of wall tone that runs just under the roof line; `readFasciaBand` the
dark or mid band at a slab level across a recess mouth; `readRailing` the
first thin dark line above at least half a metre of panel standing on the
slab. A member exists only with depth evidence — a return the plan draws, a
recess behind a verge, a slab level behind a fascia — and `stripesToMembers`
is the §15 test that a field of tone stripes with none of that is a surface,
never a hundred members. The orchestrator assembles them: returns
`CONTINUES_AS` the verge member into a `GABLE_FRAME`; a fascia that runs on
across an attached body's zone at the same level, where that body's roof
projects over the zone, is the portal head (`FACADE_MEMBER`, `SUPPORTS` by the
body, `CONTINUES_AS` from the balcony) in a `PORTAL_FRAME`; every
`LINEAR_VOLUME_CANDIDATE` no member accounts for is dispositioned as a stripe.

**Finish regions.** The dominant tone of each recessed ground-storey wall on
its render becomes a `SURFACE_REGION` feature with `VISUAL_SEMANTIC`
provenance and a `createSurfaceRegion` command: colour, never geometry.

**emit.ts.** The program is written in this order: model name, building, nine
materials, levels; per mass and storey a slab (with the stair's hole in the
upper slab of the main body) and an `EXTERIOR` ring, the ring of a
single-storey attached body rising to its parapet; return walls; interior
partitions, each a run of the pieces a door gap joins, its ends trimmed 15 mm
short of the ring's inner face and of any perpendicular partition so that no
two walls share plan area without a declared junction, then each door as a
`cutOpening` plus `placeDoor`; rooms; the main gable `createRoof` with
`capWallIds` naming the top storey's ring walls, returns and partitions so that
they follow the roof; flat roofs over attached bodies; portal heads and verge
members as `createLinearSolid`; balconies and terraces; railings (glass, 1 m
post spacing); chimneys with a `PENETRATION` roof opening; rooflights as
`NORMAL_TO_ROOF` roof openings with a unit; exterior openings as `cutOpening`
(with `head: { kind: 'RAKED', heightFar }` for a raked profile) plus
`placeWindow` (with mullions) or `placeDoor` (a `PANEL` assembly for a garage
door, a fully glazed `LEAF` for a glazed door); the shared doorway with its
`leaves` in the other body's wall; the stair; the finish regions. A
`setEvidence` command follows each object, carrying the provenance mapped to
the model's vocabulary and the reading's `why`. Every `push` with a feature id
records a `Binding` (feature, object id, collection, command index); a
partition too short once trimmed is `dropped` with a reason, and the
orchestrator then marks its feature `L0` / `UNRESOLVED` with `not built: …`.

**verify.ts.** `verifyAgainstViews` projects the solved building into each
registered render and measures, in metres: for every opening on a facade the
render shows, the sill and head against the elevation extent read at the
opening's interval (tolerance: the opening's uncertainty plus 0.1 m); for the
main roof, at sample columns, the first strong horizontal edge from the sky
down within 0.6 m of the model's roof line — a render has trees and a sky
gradient above the building, so the topmost non-sky pixel is the tree line as
often as the roof — with "no edge within reach" recorded as a failed residual,
not as agreement. `repairFromResiduals` may move only an opening's sill or
head whose provenance is `ASSUMED_FOR_RENDERING` or `UNRESOLVED`, only towards
the view's reading, never by more than 1.2 m, for at most two rounds, and it
writes down every operation applied and every one refused with its reason.

## 5. Provenance and `why`

`ProvenanceStatus` (`graph.ts`) is the vocabulary the source truth, the
feature graph and the building share: `SOURCE_EXACT`, `SOURCE_CORROBORATED`,
`SOURCE_DERIVED`, `IMAGE_METRIC_REGISTERED`, `VISUAL_SEMANTIC`,
`ASSUMED_FOR_RENDERING`, `UNRESOLVED`. The orchestrator's `feature()` helper
requires a provenance and a `why` for every hypothesis it solves, and accepts
a `parameterProvenance` map where one parameter differs from the feature (a
verge member's `depth` is `ASSUMED_FOR_RENDERING`; an opening's `family` is
`VISUAL_SEMANTIC` beside a `SOURCE_EXACT` width). `OpeningV2` carries a
provenance per property — `interval`, `width`, `sill`, `head`, `profile`,
`family`. Every `BuildingV2` element carries a `featureId`, a `provenance` and
a `why`; every `RecessTopology`, `InteriorWallPiece`, `RoomPolygon`,
`StairTopologyHypothesis`, `FacadeMember` and reading in `roof-details.ts` has
a `why` written in the reader's own terms ("2 return walls of 0.66 / 0.63 m
stand in the 0.99 m zone on 5/5, 5/5 scan lines"). In the model, `modelStatus`
in `emit.ts` maps the vocabulary onto `EvidenceStatus`:
`IMAGE_METRIC_REGISTERED` and `VISUAL_SEMANTIC` become `VISUAL_INFERRED`,
`ASSUMED_FOR_RENDERING` becomes `ASSUMED`, the rest keep their names.

## 6. Generic versus stated convention

Everything in `v2/` is generic in the sense of §26: thresholds are stated in
pixels of the sheet's own wall thickness or in metres through a registered
frame, and the readers know what a wall, a callout or a tread ladder is, not
which building this is. Where a value cannot be read, a **convention** is
used and named. The shared table is `CONVENTIONS` in
`packages/reconstruction/src/solve.ts`: `wallThickness` 0.38, `slabThickness`
0.28, `roofThickness` 0.28, `roofOverhang` 0.6, `storeyHeight` 2.8,
`openingHead` 2.2, `windowSill` 0.9, `doorHeight` 2.1, `transomM` 0.16. v2
uses five of them: `wallThickness` only when the decomposition's measured
thickness lies outside 0.15..0.7 m; `slabThickness` when the levels are not
measured; `storeyHeight` when the section prints no datums; `roofThickness`
for the main roof and for an attached roof's soffit when no section draws it;
`doorHeight` for a doorway between bodies and as the cap on an interior
door's height. It does not use `roofOverhang`, `openingHead`, `windowSill` or
`transomM`.

Conventions stated inline in the v2 modules, each with an `unresolvedProperties`
or `ASSUMED_FOR_RENDERING` mark where it reaches the model: the 2.2 m common
head and the 1.95 m door-height threshold in `openings-v2.ts` (and the 2.1 m
head with a floor sill when neither callout nor elevation speaks); the 0.3 m
verge depth; the 0.2 m terrace plinth when no terrain datum is read; the
0.15 m minimum roof build-up; a chimney top 0.1 m below the ridge when no
render shows it; a railing's 1.0 m post spacing and glass infill in `emit.ts`.
The reader ranges are conventions of the drawing kind, not of a building:
callout widths 40..700 cm and heights 40..400 cm (`callouts.ts`), partition
thickness 0.2..0.72 of the external wall, door gaps 0.6..1.35 m, goings
0.21..0.34 m, treads 0.75..1.5 m, rooflight patches 0.45..1.8 by 0.35..1.8 m,
fascia bands 0.25..1.2 m, railings 0.5..1.4 m, verge bands 0.25..1.5 m.

## 7. The anti-cheating boundary (§26)

`tests/architecture/analyzer-v2.test.ts` reads the tree and the sealed
artefacts and holds three boundaries:

1. **No production source knows the benchmark.** Over
   `packages/reconstruction/src/v2`, `packages/source-metrics/src`,
   `packages/image-metrology/src` and `packages/source-analyzer/src`: no file
   matches `/marc[oó]wk/i`; none contains the sealed package's id, content
   hash, page hash, external id or any asset or variant id or byte hash (read
   from `stage-reports/artifacts/source-observations/marcowki-source-package.json`);
   none mentions `@buildapp/reference-`, `source-truth` or `research/`, in an
   import or in prose. A self-check proves the scan would catch a cheat.
2. **The v2 modules take nothing from the reference side of v1.** No import of
   `../reference*`, the evaluator, `@buildapp/reference-*`,
   `@buildapp/candidates`, `@buildapp/synthetic-drawings` or a test; no name
   taken from `../solve.js` or `../fusion.js` matching
   `EXPECTED | FACTS | MARCOWKI | REFERENCE | GOLD | BENCHMARK | TRUTH | KNOWN_`;
   none of the benchmark's figures (`12.05`, `14.60`, `7.90`, `4.15`, `12.61`,
   `7.51`, `131.16`, `28.563799`, …) as a literal; no `gold`, `benchmark`,
   `stage-reports`, `.cache/`, `fixtures/`, `node:fs`, `fetch(` or network.
3. **The committed artefacts are consistent**: the ledger dispositions every
   observation and metric reading, the hashes chain, the graph and ledger
   invariants hold, the quality report grades exactly the solved features.

Two proofs run rather than argue. `npm run reconstruct:no-reference`
(`scripts/no-reference.ts`) hides `packages/reference-marcowki`, runs the v1
path and holds the layout to a decomposition (two bodies, distinct storey
spans, a roof per body). `npm run reconstruct:no-benchmark`
(`scripts/no-benchmark.ts`) hides the reference package, every package named
`source-truth` or `reference-` and the whole `research/` tree, runs
`scripts/reconstruct-v2.ts` into `.cache/no-benchmark`, restores the tree in a
`finally`, and then holds the building to structure: at least two bodies, a
recess with a return, a storey with partitions, a door and two rooms, a stair,
an opening with a callout, a main roof, and a candidate that replays. Finally
`npm run audit:analyzer-v2` scans every `provenance` and `parameterProvenance`
value in the graph and the building for the vocabulary and for
`/REFERENCE|BENCHMARK|GOLD|TRUTH|MARC/i`.

The entry script may name a URL because somebody has to; the diagnostics that
compare against the benchmark (`evaluate:v2`, and `overlays:v2`'s atlas
overlay) read `research/marcowki-v2/…` by path and are outside the production
boundary by construction.

## 8. Artifacts

`scripts/reconstruct-v2.ts` writes, under `stage-reports/artifacts/analyzer-v2/`
(or `--out`): `<slug>-auto-v2.json` (the sealed candidate, 209 commands on the
reference run), `<slug>-layout.json`, `<slug>-metrics.json`,
`<slug>-building.json` (the `BuildingV2`), `<slug>-model.json`,
`<slug>-hypotheses-v2.json`, `feature-lineage.json`, `evidence-consumption.json`,
`feature-quality.json`, `source-view-residuals.json`, `repair-trace.json` and
`registrations.json`. `overlays:v2` adds four directories of SVG overlays and
`overlays-index.json`; `evaluate:v2` adds `<slug>-v2-evaluation.json` and `.md`.
Each file is described in `docs/ANALYZER_V2_ARTIFACTS.md`.

## 9. Diagnostic scripts

| script | what it does |
| --- | --- |
| `npm run reconstruct:v2 -- --url <url>` (or `--package … --graph …`) | the production run; `--slug`, `--label`, `--out`, `--cache`; `V2_DEBUG=1` streams the readers' diagnostics to stderr |
| `npm run reconstruct:v2:marcowki` | the reference run from the sealed package and graph under `stage-reports/artifacts/source-observations/` |
| `npm run audit:analyzer-v2 [-- --artifacts <dir> --slug <slug>]` | reads the artefacts back and checks: every required file present; the candidate validates and replays byte-identical; the committed model is the replayed model; every hash names its input; graph and ledger invariants; a quality entry per solved feature; no benchmark provenance; the §29 block conditions stated structurally (a roof reaching the zones it has recesses at, returns on every ground-storey recess, an interior with partitions and rooms, assumptions named, members sighted, a repair loop that moved no `SOURCE_EXACT` property, a non-empty residuals file); then per-family quality, ledger and residual tables. Any failure exits non-zero. |
| `npm run overlays:v2` | self-contained SVG overlays: `source-atlas/`, `plan-overlays/`, `elevation-overlays/`, `perspective-overlays/`, plus `overlays-index.json`; the drawing is embedded once as the publisher's cached bytes, never re-encoded |
| `npm run evaluate:v2` | the reference building against the sealed truth v2, per truth item, by family and position, with a stated tolerance rule per property; no aggregate score, only per-family MATCH / PARTIAL / MISSING counts and the worst deltas |
| `npm run reconstruct:no-benchmark` | §26's run-time proof (section 7) |

## 10. Known limitations

Read off `marcowki-building.json`, `marcowki-v2-evaluation.md` and the code,
in that order of authority.

- **Open-plan rooms are merged.** The ground storey's hall, kitchen, living
  room and stair shaft come out as one 47.59 m² polygon (`main-room-0-3`,
  `openPlan: true`); the attic corridor, stair and north-east wardrobe as one
  20.90 m² polygon. The flood fill invents no boundary that is not drawn, so
  18 of the 19 truth rooms are PARTIAL, and the worst deltas of the evaluation
  are all room bounds and areas.
- **Room numbers are mostly unread.** Only two rooms carry a number (3
  `Kuchnia`, on the merged polygon, and 5 `Pralnia`); `room-0-2` was read as
  `9` and its label withheld because 5.56 m² is 77 % off the published 24.1 m²
  (`unresolved`: "by area it would be 8 Kotłownia 5.8"). The general OCR's
  tokens are what the interior pass gets, and 16 published rooms are
  `UNRESOLVED` in the ledger with "no room polygon carries this number".
- **Opening families come from visual cues** and are `VISUAL_SEMANTIC`: the
  105/210 entrance reads as `WINDOW`, the 90/230 west window as `DOOR`, the
  gable windows as `MULTI_PANEL_GLAZING`; 3 of 12 openings MATCH outright, 9
  are PARTIAL, mostly on family.
- **The terrain datum is not read.** The section's `−0,32` never becomes a
  `LEVEL_DATUM`, so `terrainY` is absent, both terraces assume a 0.2 m plinth
  (`L0`, `ASSUMED_FOR_RENDERING`) and the render registrations are checked
  against y = 0 rather than the terrain.
- **Some elevation extents are wrong on renders**, so the printed height
  stands with an unresolved note: the 470/230 rear glazing reads 1.57 m tall,
  the 270/320 front gable glazing 0.54 m, the two rear gable windows 1.16 and
  0.76 m, the garage side door 0.99 m. These are the nine residuals outside
  tolerance, and every one was refused by the repair loop because a printed
  height is `SOURCE_EXACT`.
- **Roof-edge verification is bounded by the renders.** The roof's edge is
  sought only within 0.6 m of the model, because above the roof a render has
  trees and sky; the 14 roof residuals on the reference run are all within
  0.25 m, which confirms the model where it is nearly right and could not
  find it where it was far wrong.
- **Two callout readings are ambiguous** and left `UNRESOLVED` on the head:
  the west door "reads 230 or 290 alike" and the garage door "275 or 225
  alike", with no elevation of those walls to decide.
- **Chimneys and rooflights are PARTIAL**: the chimney blocks' plan
  dimensions are off by up to 0.17 m, and the rooflights come out 0.15 m
  short in both dimensions with their position up the slope named unresolved.
- **Facade members are read to about 0.1 m along the facade** (the front
  balcony ends 0.67 m short of the truth on the east) and the balcony's slab
  section is unresolved ("fascia only").
- **Things `BuildingV2` has no field for**: a knee-wall top or attic ceiling
  (the attic partitions follow the roof), a per-wall thickness (one `T` for
  every wall), a return wall's top (the emitter runs it to the roof), a
  `FASCIA` assembly for the garage parapet, a stair well distinct from the
  slab hole.
- **In the graph**: `measurements` and `alternatives` are never populated;
  only five of the twelve relation kinds are emitted; the mass and level
  features carry no plan sighting (their coverage is `printed: true` from the
  chain basis); the two chimneys share the same plan sightings because
  chimney sightings carry no `pixelRect`, and their `SAME_FEATURE_AS`
  relation is duplicated with one id. See `docs/FEATURE_IDENTITY_GRAPH.md`.
- **Verification covers openings and the main roof only**; `RECESS_PLANE`,
  `MEMBER_EDGE` and `SILHOUETTE_WIDTH` residual kinds exist in the type and
  are never produced, and the only repair operation implemented is
  `RESIZE_OPENING`. Perspective cameras are solved and used to disposition
  observations, not to place anything.

## 11. A second project

Nothing in `v2/` is keyed to a project, so a second one flows through the same
entry: `npm run reconstruct:v2 -- --url <project url> --slug <slug> --label
"<label>"` acquires the package through the publisher adapters
(`archonAdapter` is the one that exists), extracts the observation graph with
the null vision provider, reads the metric evidence and runs `reconstructV2`.
For the passes to have something to read, the package must carry:

- **Plans**: one `ORTHOGRAPHIC_PLAN` per storey. The base plan must register
  through its printed chains (the metric layer's `PLAN_XZ` registration) so
  that `composeStructuralLayout` can decompose walled bodies — with no walled
  body the orchestrator throws. Upper plans register by their outer wall
  faces onto the body they cover. Zones beyond the walls need a dimensioned
  depth chain to become ZONE regions and then recesses; callouts need the
  ring symbol.
- **Elevations**: rendered or drawn, with a silhouette the 03R extractor can
  bound and a side it can assign. They are registered only when a ridge
  datum exists, so without a section they contribute nothing.
- **A section** with at least two attached `LEVEL_DATUM` readings (floor,
  eaves, ridge): it fixes the storeys, the ridge the renders are scaled by,
  the main roof, and the attached roof's slab and parapet. Without it the
  storeys fall to the 2.8 m convention, no render registers, and no roof,
  opening height, rooflight, chimney height or facade member can be read.
- **A roof pitch**: a published specification line or a printed angle
  (`PUBLISHED_SPECIFICATION` / `PRINTED_ANGLE` on the roof support); the main
  roof is otherwise a named `MISSING` hole.
- **Published figures**: `publishedFacts` (a footprint area is checked by the
  layout gate; every other aggregate is `IGNORED_WITH_REASON`) and
  `publishedRooms` (storey, index, label, area) for the room labels.
  Perspectives are optional and only ever corroborate.

Then `npm run audit:analyzer-v2 -- --slug <slug>` on the output directory,
`npm run overlays:v2 -- --package … --graph … --artifacts … --slug <slug>` to
look at it, and `evaluate:v2` only if a sealed truth exists for that project.
