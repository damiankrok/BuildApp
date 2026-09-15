# STAGE BUILDAPP-01 — MARCÓWKI REFERENCE MODEL THROUGH THE REAL BUILDING DSL

## 1. Baseline and result

| | |
| --- | --- |
| branch | `claude/buildapp-buildworld-v1-7y6yqh` |
| starting HEAD | `0df518186bb61b8a365cd9fc11d68ad875be88ca` (verified equal to the remote tip before work began) |
| implementation commit | `7a6d6168d44f2c75eb0a6bd0974ed1cda72e4478` — code, tests, fixtures, browser artifacts |
| docs commit | the commit that carries this report (`docs/`, `README.md`, `PROJECT_STATUS.md`); its SHA is the final HEAD recorded in `git log` |
| schema before → after | `buildapp.canonical-building-model` **1.1.0 → 1.2.0** |
| result | **PASS** — every gate green, every required proof measured |

The stage reconstructs *Dom w marcówkach (GE)* from the researched source
truth as Building DSL commands, replays them into a CanonicalBuildingModel,
compiles that model with the ordinary geometry compiler, and shows it in
BuildWorld through the ordinary EditorStore. Nothing in the viewport or in
a generic package knows the house exists. `docs/MARCOWKI_REFERENCE_MODEL.md`
is the standing description; this report records what was done and measured.

## 2. Reference material audited

Reference repository `damiankrok/Web-analizer-builder`, branch
`claude/new-session-pvd4ik` (HEAD `425d7f9`), cloned read-only into the
session scratchpad and never imported by any code. Read:

- `docs/MARCOWKI_STRUCTURAL_SHELL_ROOF_PROOF.md`,
  `MARCOWKI_INTERIOR_ARCHITECTURALSPEC_REPORT.md`,
  `MARCOWKI_CHARACTERISTIC_FACADE_REPORT.md`, the roof-features report, and
  the four gold files `marcowki-exterior-shell-v1.json`,
  `marcowki-interior-v1.json`, `marcowki-facade-v1.json`,
  `marcowki-roof-features-v1.json` with their raster measurements
  (`scripts/source-measure.ts` output).
- The seven published drawings behind them (dimensioned ground and attic
  plans, section, front and rear elevations, two side elevations identified
  by content), two renders and the published facts table.

Sixteen `EvidenceSource` records in the model cite these
(`packages/reference-marcowki/src/sources.ts`); every object and every fact
names the ones it rests on. Where the reference's own reconciliations were
adopted (the upper slab bearing rectangle, the rooflight geometry) they are
cited as `DERIVATION` sources; where they were rejected (the two-leaf
house/garage wall) the ledger says why.

## 3. The one coordinate transform

`packages/reference-marcowki/src/transform.ts`:

```
x_app = x_ref        y_app = y_ref        z_app = 13.60 − z_ref
```

Front outer plane 13.60 → 0, front wall face 12.60 → 1.00, rear wall face
0 → 13.60, rear outer plane −1.00 → 14.60. The reference frame is
right-handed; a single `z` flip yields BuildApp's left-handed frame with `x`
unchanged, so east (the garage, `x 7.90..12.05`) stays on the right of the
front view — asserted in `transform.test.ts` against the plans. Ring wall
directions are the same in both frames, so opening offsets carry over
unchanged. Mutation 10 writes the transform with the wrong sign and is
caught.

## 4. Generic extensions (schema 1.2.0)

| extension | model | commands | compiler | non-reference test |
| --- | --- | --- | --- | --- |
| raked opening heads | `Opening.head: LEVEL \| RAKED { heightFar }`; `FILL_PROFILE_UNSUPPORTED` for doors | `cutOpening.head` | head line on grid diagonals, sloped head reveal, per-edge jambs; trapezoid window frame, panes and mullions | `packages/geometry/test/openings-1.2.0.test.ts` (hole, trapezoid volume, rays, fill under the head, refusal, invariance under rotation) |
| multi-leaf openings | `Opening.leaves: [{ wallId, offset }]`; `OPENING_LEAF_INVALID / _LEVEL_MISMATCH / _NOT_PARALLEL` | `cutOpening.leaves`; `moveFeature` carries leaves; removing a leaf wall strips the leaf | one cut per leaf wall, reveals per leaf, one fill in the host | two-leaf passage, MUTATION one leaf |
| roof openings | `RoofOpening` ROOFLIGHT / PENETRATION (`throughId`); `UNKNOWN_ROOF_OPENING`, `ROOF_OPENING_OUTSIDE_HOST`, `ROOF_OPENING_CROSSES_RIDGE`, `ROOF_OPENINGS_OVERLAP`, `ROOF_PENETRATION_MISMATCH` | `cutRoofOpening`; cascades roof → openings → rooflights, chimney → penetrations | vertical prism cuts on watertight band tiling (global along-breaks, shared eave/ridge doubles, reveals split on breaks) | rooflight cut, chimney penetration with zero shared volume, MUTATION overlap, several openings on both slopes and on a flat roof, roof unchanged without openings |
| rooflights | `Rooflight`; `ROOF_OPENING_FILLED_TWICE` | `placeRooflight` | frame ring and glass between the roof planes | fill closed, glass through the pane only |
| explicit mullions | `Window.mullions` fractions (strictly increasing) | `placeWindow.mullions` | mullions at the fractions | mullion position measured |
| FOLLOW_ROOF crossings | — | — | breaks where the soffit crosses the nominal height on either face | attic corridor partition closed (reference), generic tiling invariant |
| oracles | — | — | — | `depthProbeReport`, `lineCoverage`, `pointInPolygon` (`packages/verification/test/probes.test.ts`) |

Migration: `1.0.0 → 1.1.0 → 1.2.0` as explicit steps, one `SCHEMA_MIGRATED`
warning and one `meta.notes` entry per step; a file stating an older version
but carrying newer collections is refused. The BUILDAPP-00A demo file
(`demo-house-1.1.0.json`) is kept as the migration baseline and compiles to
a scene deep-equal to today's demo (`tests/architecture/reference.test.ts`
test 7); the demo is frozen again as `demo-house-1.2.0.json`.

Not implemented on purpose: slab holes (the stair void is a notch in the
bearing polygon), roof cuts normal to the slope (vertical prisms, stated in
the ledger), stair flights.

## 5. The model

`marcowkiCommands()`: 145 commands — 1 `setModelName`, 16
`addEvidenceSource`, 7 `defineMaterial`, 1 `createBuilding`, 2
`createLevel`, 2 `createWallRing`, 27 `createWall`, 1 `createWallJunction`,
3 `createSlab`, 2 `createRoof`, 2 `createBalcony`, 2 `createRailing`, 2
`placeChimney`, 5 `cutRoofOpening`, 3 `placeRooflight`, 23 `cutOpening`,
8 `placeWindow`, 15 `placeDoor`, 18 `createRoom`, 1
`createStairPlaceholder`, 4 `addConstraint`.

Object counts: 2 levels, 2 wall rings, 35 walls (4 + 4 ring, 3 garage,
5 returns, 19 partitions), 45 junctions (10 CORNER, 22 T, 13 BUTT),
23 openings (12 facade, 11 interior doors; 3 raked), 8 windows, 15 doors,
3 slabs, 2 roofs, 5 roof openings (3 rooflights, 2 penetrations),
3 rooflight units, 2 balconies, 2 railings, 2 chimneys, 1 stair, 18 rooms,
7 materials, 4 constraints, 16 evidence sources. 122 objects carry
evidence: 12 `SOURCE_EXACT`, 41 `SOURCE_CORROBORATED`, 35 `SOURCE_DERIVED`,
14 `VISUAL_INFERRED`, 20 `ASSUMED`. Validation issues: 0. Compile
diagnostics: 0. Scene: 3812 triangles, 169 meshes, 119 objects, 44 closed
structural solids, bounds `x 0..12.05`, `y −0.32..7.95`, `z 0..14.60`.

Source → feature mapping: `docs/MARCOWKI_REFERENCE_MODEL.md` § "Source →
feature mapping" (every feature with its object ids, source and status).

Modelling decisions that shape geometry (all in the ledger): the eave plane
4.63556 derived from span, pitch and ridge against the printed +4,67; one
0.45 m house/garage wall with a T-junction instead of the reference's two
leaves (the published garage area 24.10 m² only closes with one), hence a
single-leaf kotłownia door; the upper slab on the bearing rectangle notched
by the stair void; attic partitions capped at 2.60; balcony, portal,
railing and chimney heights read off elevations as `VISUAL_INFERRED`.

## 6. Measured source parity (`npm run audit:marcowki`, all PASS)

```
characteristic depth (front outer plane to rear outer plane)   14.600 m (source 14.600)
walled envelope (printed 1260)                                 12.600 m
front zone / rear zone                                         1.000 m / 1.000 m
front recess mouth        180 rays, 0 at the plane, 0 nearer than 1.00, shallowest 1.000, 99 at the back wall; returns 12/12 at the plane
rear recess mouth         180 rays, 0 at the plane, 0 nearer than 1.00, shallowest 1.000, 54 at the back wall; returns 12/12 at the plane
ground ring closed        836 probes, 0 gaps, 0 overlaps
attic ring closed         836 probes, 0 gaps, 0 overlaps
garage ring closed        504 probes, 0 gaps, 0 overlaps
every structural solid is a closed manifold                    44 solids
no two structural solids share volume                          none
main roof pitch                                                40.00°, 40.00° (from normals)
ridge height                                                   7.950 m (source 7.950)
roof extent front to rear                                      0.000..14.600
roof closed                                                    volume 31.019 m³, vertical thickness 0.2756
eave walls meet the roof underside                             worst gap 8.88e-16, worst overlap 8.88e-16
rail-front glass over the run   run 3.444..7.153, coverage 92.5 %, longest gap 0.070, top 3.860
rail-rear glass over the run    run 0.689..7.153, coverage 95.7 %, longest gap 0.070, top 3.860
balcony-front / balcony-rear / portal-head                     closed
```

### Opening audit (twelve facade openings)

| id | printed | wall | through | beside | above | fill parts | room (source → model) | raked head error |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| og-front-room-window | 110/230 | g-front | 0.00 | 0.45 | 0.45 | 2 | g-room → g-room | |
| og-front-entrance | 105/210 | g-front | 0.00 | 0.45 | 0.45 | 3 | g-entry → g-entry | |
| og-east-living-window | 300/230 | g-right | 0.00 | 0.45 | 0.45 | 3 | g-salon → g-salon | |
| og-east-garage-door | — (concealed) | g-right | 0.00 | 0.45 | 0.45 | 3 | g-boiler → g-boiler | |
| og-rear-living-glazing | 470/230 | g-rear | 0.00 | 0.45 | 0.45 | 3 | g-salon → g-salon | |
| og-west-living-window | 90/230 | g-left | 0.00 | 0.45 | 0.45 | 2 | g-salon → g-salon | |
| og-west-kitchen-window | 140/140 | g-left | 0.00 | 0.45 | 0.45 | 2 | g-kitchen → g-kitchen | |
| og-garage-door | 275/225 | gar-front | 0.00 | 0.45 | 0.45 | 3 | g-garage → g-garage | |
| og-garage-side-door | 100/210 | gar-rear | 0.00 | 0.45 | 0.45 | 3 | g-garage → g-garage | |
| og-front-gable-glazing | 270/320 | u-front | 0.00 | 0.45 | 0.45 | 3 | u-pokoj-s → u-pokoj-s | 8.9e−16 |
| og-rear-gable-east | 234/303 | u-rear | 0.00 | 0.45 | 0.45 | 3 | u-pokoj-ne → u-pokoj-ne | 1.8e−15 |
| og-rear-gable-west | 234/303 | u-rear | 0.00 | 0.45 | 0.45 | 3 | u-pokoj-nw → u-pokoj-nw | 8.9e−16 |

Per opening (`openings.test.ts`): the reveal meshes belong to the opening and
close the host wall's solid; four rays inside the printed rectangle read 0
and rays 4 cm outside each jamb (and below a raised sill) read 0.45; the
fill is hosted by the wall and lies inside the hole. Raked openings: the
wall loses exactly the callout's trapezoid, the fill stays under the head
line at 11 stations, at least 1.05 m of wall remains between each head and
the soffit. The kotłownia door: a ray from the garage into the boiler room
through every wall in the `x 7.45..7.90` plane meets nothing; 6 cm beside it,
exactly one 0.45 m leaf.

### Roof audit

Two slopes at 40.00°, ridge 7.950, roof `z 0..14.60` (the returns' full
extent), closed, eave walls and returns meeting the underside without
daylight or overlap; two chimney stacks through PENETRATION cuts carrying
their footprints (shared volume 0, roof material right beside each);
three ROOFLIGHT cuts 0.78 × 1.18·cos 40°, lower edge 0.45 in from the eave,
frame and glass closed, glass 0.024 through the pane centre, each over the
attic room the plan places it in (pralnia, łazienka, schody).

### Room / interior audit

18 rooms, every polygon inside its storey envelope, no two rooms on a level
overlapping (144 grid points each); the finished-surface rule reproduces
the published 15.13 m² of the north-west pokój; 19 partitions closed,
inside the shell, touching but never overlapping it or another wall
(`WALLS_OVERLAP` empty; shared-length oracle 0); ground partitions reach the
slab underside, attic partitions the 2.60 cap or the soffit (the corridor
partition measured following the 40° soffit); 11 interior doors are real
cuts with wall beside and above them, between exactly the two rooms the
plans connect (point-in-polygon 0.2 m either side); the upper slab is
closed with a real 2.08 × 1.98 stair void and bears on the wall rectangle;
the ground slab spans −0.32..0.

## 7. Mutation results (`test/mutations.test.ts`, 16 tests)

| # | mutation | checker | reference | mutant |
| --- | --- | --- | --- | --- |
| 1 | front recess flattened (infill wall on the outer plane) | `recessReport(FRONT).atOuterPlane / shallowest` | pass | caught |
| 2 | rear recess halved (rear wall + side walls + returns moved 0.55) | `recessReport(REAR).nearerThanStated`, `depthReport.rearZone` | pass | caught |
| 3 | west kitchen window removed | `openingReport.found`, facade count | pass | caught |
| 4 | fill kept, cut removed | `validateModel` → `UNKNOWN_OPENING`; compiler `MODEL_INVALID` | pass | caught |
| 5 | kitchen window re-hosted on the east wall | `openingReport.through` on the expected wall + host id | pass | caught |
| 6 | front balcony removed | `verticalRuns`, `structuralSolids` | pass | caught |
| 7 | railing infill NONE, height 0.5 | `railingReport` (`lineCoverage`, glass parts, top) | pass | caught |
| 8 | front gable head made LEVEL | `openingReport.headError` | pass | caught |
| 9 | pitch 35° | `roofReport.pitches / ridgeY` (`upwardPlanes`) | pass | caught |
| 10 | every `z` mirrored (transform sign error) | `recessReport(FRONT/REAR).atBackPlane`, `openingReport.through` | pass | caught |
| 11 | salon and kitchen polygons swapped | `roomBehindOpening` | pass | caught |
| 12 | generic two-leaf passage with one leaf cut | material through the passage across both leaves | (generic) | caught |
| 13 | laundry rooflight and its cut removed | roof material through the rooflight centre, rooflight count | pass | caught |

Plus: the unit-kept variant of 13 is refused by the model
(`UNKNOWN_ROOF_OPENING`), and the DSL refuses moving a ring wall on its own
(`JUNCTION_GAP`).

## 8. BuildWorld

- Toolbar **model** select: *Demo house* / *Dom w marcówkach (GE)*
  (`data-testid="model-select"`), replacing the model in the same
  `EditorStore` via `replaceModel(createMarcowkiReferenceBuilding())`; a
  loaded file shows as *(file)*.
- Inspector: kind, id, name, parameters, a generic **host** link (opening →
  wall, fill → opening, roof opening → roof, rooflight → roof opening,
  railing → balcony, wall → level), evidence status, cited sources by label
  and kind, locator, interpretation, note, per-property statuses.
- Store: roof family visibility (`hostRoofId`), roof openings and
  rooflights in the scene tree under their roof, `familyOf` for roofs and
  leaf walls, `describe()` with `host` and `evidenceSources`.
- Save/Load: the reference saves through `serializeModel` byte-equal to the
  frozen fixture and reloads without the reference package.

## 9. Gates

| gate | result |
| --- | --- |
| `npm install` | clean (workspace link of `@buildapp/reference-marcowki`) |
| `npm run typecheck` | clean (packages + web app) |
| `npm test` | **252 passed, 32 files** — model 47 (model 11, topology 19, migration 6, fixtures 2, marcowki-fixture 2, openings-1.2.0 7); commands 30 (11 + topology 14 + openings-1.2.0 5); demo 5; verification 15 (oracles 4, probes 4, ring-oracle 7); geometry 55 (wall 9, fills 4, roof 3, scene 10, topology 15, openings-1.2.0 11, marcowki-fixture 3); editor 6; reference-marcowki 61 (replay 5, transform 4, shell 7, openings 16, features 7, interior 3, persistence 3, mutations 16); architecture 33 (boundaries 13, topology 13, reference 7) |
| `npm run build` | clean; `apps/web/dist`: index 467 KB, three 480 KB, react 12 KB, css 5 KB |
| `npm run e2e` | **12 passed** (Playwright 1.56, Chromium headless, SwiftShader WebGL) against the production build: the 7 BUILDAPP-00/00A checks + 5 Marcówki checks |
| `npm run audit:marcowki` | AUDIT PASS (report in § 6) |

## 10. Screenshots (`stage-reports/artifacts/`)

| file | content |
| --- | --- |
| `marcowki-01-perspective.png` | front perspective: recessed front with the portal, balcony and gable glazing, garage wing, chimneys, rooflight |
| `marcowki-02-front.png` | front elevation: raked 270/320 gable glazing, balustrade, portal head, garage door |
| `marcowki-03-rear.png` | rear elevation: two raked 234/303 windows, loggia glazing, balcony and balustrade |
| `marcowki-04-left.png` | west elevation: 90/230 and 140/140 windows, the 14.60 m silhouette |
| `marcowki-05-right.png` | east elevation: 300/230 window, garage |
| `marcowki-06-top.png` | plan from above: rooflights and chimney penetrations in the roof |
| `marcowki-07-roof-hidden.png` | roof hidden: attic partitions following the soffit, stair void, chimney stacks |
| `marcowki-08-attic-plan-roof-hidden.png` | top view with the roof hidden: the attic plan |
| `marcowki-09-ground-plan-interior.png` | ground storey isolated: rooms, partitions, interior doors |
| `marcowki-10-selected-return-evidence.png` | `ret-west-front` selected: kind, id, parameters, host, evidence status, sources, locator |
| `marcowki-ge.json` | the model as BuildWorld saved it (byte-equal to the fixture) |

## 11. Unresolved source evidence (ledger, 24 entries)

CONTRADICTION: `eave-datum` (+4,67 printed vs 4.63556 derived),
`balcony-west-edge` (plan 3.338 vs elevation 3.19..3.24),
`footprint-area` (published 131.16 m² vs transcribed 130.665 m²),
`side-elevation-labels` (LEFT/RIGHT unlabelled by compass side).
RESOLVED_CONTRADICTION: `house-garage-wall`, `upper-slab-footprint`.
UNRESOLVED: `balcony-thickness`, `railing-height`, `garage-roof-level`
(parapet 2.99..3.14 vs roof 2.88), `kotlownia-door-head`,
`gable-head-clearance`, `attic-140-220`, `verge`, `room-polygon-south`.
SIMPLIFICATION: `railing-posts`, `attic-ceiling`, `interior-door-heads`,
`stair`, `rooflight-cut`, `ground-slab`. NOT_MODELLED: `chimney-shafts`,
`material-bands`, `entrance-sidelight`, `terrace-canopy`.

## 12. Files

New: `packages/reference-marcowki/` (package, `src/{index,transform,sources,facts,commands,model,expected,ledger}.ts`,
`test/{measure.ts,replay,transform,shell,openings,features,interior,persistence,mutations}.test.ts`,
`scripts/audit.ts`), `packages/model/test/{openings-1.2.0,marcowki-fixture}.test.ts`,
`packages/model/test/fixtures/{demo-house-1.2.0,marcowki-ge-1.2.0}.json`,
`packages/commands/test/openings-1.2.0.test.ts`,
`packages/geometry/test/{openings-1.2.0,marcowki-fixture}.test.ts`,
`packages/verification/test/probes.test.ts`, `tests/architecture/reference.test.ts`,
`apps/web/e2e/marcowki.spec.ts`, `docs/MARCOWKI_REFERENCE_MODEL.md`.
Changed: `packages/model/src/{schema,ids,issues,query,migrate,validate}.ts`,
`packages/commands/src/{commands,apply}.ts`,
`packages/geometry/src/{types,wall-compiler,fills,roof-compiler,compile}.ts`,
`packages/verification/src/oracles.ts`, `packages/editor/src/store.ts`,
`apps/web/src/components/{Toolbar,Inspector,Outliner}.tsx`,
`apps/web/src/viewport/scene-adapter.ts`, `apps/web/package.json`,
`tests/architecture/package.json`, `package.json` (`audit:marcowki`),
the docs, `README.md`, `PROJECT_STATUS.md`.

## 13. Recommended next bounded technical step

Roof cuts normal to the slope and slab holes as first-class primitives:
`RoofOpening` gets a `cut: VERTICAL | NORMAL` choice (a rooflight unit sits
in a cut perpendicular to the slope, which the vertical prism only
approximates — ledger `rooflight-cut`), and `Slab.holes` replaces the
polygon notch the stair void uses today. Both are small, generic, and the
oracles (`overlapEstimate`, vertical and slope-normal `materialRuns`) already
measure them. After that, the analyzer-facing step is unchanged from
BUILDAPP-00A: topology-aware plan editing and rooms derived from resolved
wall topology.
