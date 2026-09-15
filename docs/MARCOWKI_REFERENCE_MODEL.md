# Marcówki reference model

*Dom w marcówkach (GE)*, a real catalogue house, transcribed from researched
source truth into the Building DSL and driven through BuildApp's ordinary
pipeline:

```
packages/reference-marcowki   marcowkiCommands(): BuildingCommand[]
            ↓ runCommands
CanonicalBuildingModel        id marcowki-ge, schema 1.2.0 (an ordinary model file)
            ↓ compileBuilding
CompiledScene                 3812 triangles, 169 meshes, 119 objects
            ↓ EditorStore.replaceModel
BuildWorld                    toolbar model select → Dom w marcówkach (GE)
```

It is the first specimen with a source to be wrong against. Every metric the
stage report quotes is measured off the compiled triangles by the
independent oracles in `packages/verification`, never read back from the
records that produced them.

## What the reference is not allowed to be

- No hand-authored scene, no imported mesh, no GLB: the package contains
  evidence, facts, commands, expected metrics and a ledger. An architecture
  test greps it for renderer and triangle vocabulary and checks that its
  only dependencies are `@buildapp/model` and `@buildapp/commands`.
- No gold file in the viewport: the web app imports the package in exactly
  one place, the toolbar's model selector, and calls
  `createMarcowkiReferenceBuilding()`; the viewport, adapter, store and
  inspector never import it, and the generic packages (`model`, `commands`,
  `geometry`, `editor`, `verification`) neither import it nor mention the
  project name (`tests/architecture/reference.test.ts`).
- No project branches: nothing in a generic package tests a model id. The
  three capabilities the house needed — raked opening heads, multi-leaf
  openings, roof openings with rooflights and penetrations — are generic
  schema, command and compiler features with their own tests on buildings
  that are not this one.
- No facade features as textures: every one of the twelve facade openings
  is a through-cut in wall material with its own reveals; the recesses,
  returns, balconies, portal head and railings are solids with measured
  volumes.
- Nothing claimed that the sources do not support: evidence statuses go
  from `SOURCE_EXACT` down to `ASSUMED`, contradictions between drawings are
  recorded rather than averaged away, and what is not modelled is listed.

## Sources audited

Sixteen `EvidenceSource` records (`packages/reference-marcowki/src/sources.ts`),
each cited by id from the objects and facts it supports:

| id | kind | what it is | what was taken from it |
| --- | --- | --- | --- |
| `src-ground-plan` | DRAWING | dimensioned ground floor plan, 853×853 px, 37.76 px/m | the 1205 / 1260 chains, the 100 \| 510 \| 750 \| 100 depth column, every ground wall, room and opening gap, the returns' ink beyond the walled envelope |
| `src-attic-plan` | DRAWING | dimensioned attic plan, 37.74 px/m | attic partitions and rooms, the 270/320 and 234/303 gable-window callouts, three 78/118 rooflight callouts, balustrade post marks, two chimney blocks |
| `src-section` | DRAWING | building section, 72.59 px/m | datums +7,95 / +4,67 / +3,06 / ±0,00 / −0,32, the printed 40°, the 130 knee wall, 272 / 266 / 252 clear heights, slab and roof build-ups |
| `src-elev-front` | DRAWING | front elevation (published render) | sill and head heights, the portal band, the balustrade glass — heights read from it are `VISUAL_INFERRED` |
| `src-elev-rear` | DRAWING | rear elevation | the balcony fascia 2.41..2.96, the rear gable rake, the garage north wall |
| `src-elev-east` | DRAWING | side elevation identified by content | the 14.60 m silhouette, the 300/230 window |
| `src-elev-west` | DRAWING | side elevation identified by content | the 90/230 and 140/140 windows, two rooflights in the slope |
| `src-render-hero`, `src-render-garden` | RENDER | perspective renders | depth ordering and appearance only, never a metric |
| `src-published-facts` | PUBLISHED_FACT | the published facts table | building height 8.27 m, footprint 131.16 m², room areas |
| `src-gold-shell`, `src-gold-interior`, `src-gold-facade`, `src-gold-roof-features` | DERIVATION | the reference repository's four gold files and their proof reports | transcribed observations, raster measurements, the reconciliations recorded there |
| `src-frame-transform` | DERIVATION | the one coordinate transform below | |
| `src-stage-author` | MANUAL | the stage's own modelling decisions | each listed in the ledger |

The reference repository (`Web-analizer-builder`, branch
`claude/new-session-pvd4ik`) was read only. Its gold files are evidence, not
input: nothing is imported from them at run time.

## The one coordinate transform

The reference frame is right-handed with the front outer plane at
`z_ref = 13.60` and the rear outer plane at `z_ref = −1.00`. BuildApp's frame
(`x` right, `y` up, `z` away from the front) is authoritative, so
(`packages/reference-marcowki/src/transform.ts`):

```
x_app = x_ref        y_app = y_ref        z_app = 13.60 − z_ref
```

Depth planes: front outer plane 13.60 → 0, front wall face 12.60 → 1.00,
rear wall face 0 → 13.60, rear outer plane −1.00 → 14.60. A single sign flip
of `z` turns the right-handed reference frame into BuildApp's left-handed
one, so `x` keeps its direction: east stays on the right of the front view,
which `transform.test.ts` checks against the plans (the garage is on the
east, at `x 7.90..12.05`). Because the ring walls run in the same direction
in both frames, opening offsets along walls are unchanged by the transform.
Mutation 10 of the catalogue mirrors every `z` of the model (the transform
written with the wrong sign) and the recess and opening oracles catch it.

## Facts

Fifty-eight facts (`src/facts.ts`), each a value with a status, cited
sources, a locator and, where needed, a note — 22 `SOURCE_EXACT`,
8 `SOURCE_CORROBORATED`, 21 `SOURCE_DERIVED`, 7 `VISUAL_INFERRED`. The
command generator reads them by key; a missing key throws, so no number in
the model is typed twice. The headline facts:

| fact | value | status | from |
| --- | --- | --- | --- |
| main body 7.90 × 12.60, garage 4.15 wide × 7.50 deep, overall 12.05 | printed chains 790 + 415 = 1205, 510 + 750 = 1260 | SOURCE_EXACT | ground plan |
| characteristic zones 1.00 front and 1.00 rear | the two printed 100 segments beyond the 1260 | SOURCE_CORROBORATED | ground plan, east elevation silhouette 14.60 |
| external wall 0.45, partition 0.12, boiler-room north wall 0.26, returns 0.61 | ink widths on both plans, the chains closing | SOURCE_CORROBORATED / DERIVED | plans, section |
| levels −0.32 / 0 / +3.06 / +7.95, knee wall 1.30, pitch 40° | datum markers and printed dimensions | SOURCE_EXACT | section |
| eave plane 4.63556 | ridge − half span × tan 40° | SOURCE_DERIVED | section (the printed +4,67 is a recorded contradiction) |
| roof build-up 0.21109 (vertical 0.27556) | eave plane to knee-wall top | SOURCE_DERIVED | section |
| upper slab 0.33, garage roof top 2.88 thick 0.34 | fills in the section | SOURCE_DERIVED | section |
| recesses x 0.61..11.44 (front), 0.61..7.29 (rear) | ink beyond the walled envelope | SOURCE_DERIVED | both plans |
| balcony top 2.96, thickness 0.55; portal head top 3.08, thickness 0.67; railing 0.90 glass | fascia and band edges on the elevations | VISUAL_INFERRED | elevations |
| rooflights 78 × 118, lower edge 0.45 from the eave | printed callouts, dashed symbols | SOURCE_EXACT / CORROBORATED | attic plan, west elevation |
| chimney tops 7.88 | caps against the ridge | VISUAL_INFERRED | elevations |

## Source → feature mapping

| feature | model objects | source | status |
| --- | --- | --- | --- |
| building, two levels | `building`, `ground` (0, h 3.06), `upper` (3.06, h 4.89) | section datums | SOURCE_EXACT |
| ground ring 7.90 × 12.60, wall 0.45, at `z 1.00..13.60` | `ring-ground`: `g-front`, `g-right`, `g-rear`, `g-left` (`createWallRing`) | ground plan chains | SOURCE_EXACT |
| garage wing 4.15 × 7.50 at `x 7.90..12.05`, `z 1.00..8.50`, walls 2.54 high | `gar-front` (continues the front line), `gar-right`, `gar-rear` (T into `g-right`) | ground plan 415 / 750 / 510 | SOURCE_EXACT |
| house/garage wall: ONE 0.45 m leaf | `g-right` hosts the garage side | ground plan ink; published garage area 24.10 m² | ledger `house-garage-wall` |
| attic ring, walls 4.71 nominal, `FOLLOW_ROOF` | `ring-upper`: `u-front`, `u-right`, `u-rear`, `u-left` | attic plan, section | SOURCE_EXACT |
| front recess 1.00 deep, `x 0.61..11.44`; rear loggia 1.00 deep, `x 0.61..7.29` | the ring stops at `z 1.00` / `13.60`; returns below | plans, east silhouette | SOURCE_CORROBORATED |
| five returns 0.61 thick, into the roof soffit | `ret-west-front` (BUTT `g-front`), `ret-east-front` (on `upper`, base 2.96 on the balcony, BUTT `u-front`), `ret-garage-front` (h 3.08, BUTT `gar-front`), `ret-west-rear`, `ret-east-rear` (BUTT `g-rear`) | ink beyond the envelope on both plans; the east front return absent from the ground plan | SOURCE_DERIVED |
| slabs | `slab-ground` (L-shaped, −0.32..0), `slab-upper` (bearing rect `x 0.45..7.45`, `z 1.45..13.15`, notched by the stair void, 0.33), `portal-head` (2.41..3.08 over `x 7.90..11.44`) | section, plans | SOURCE_DERIVED / VISUAL_INFERRED |
| gable roof 40°, ridge along `z`, extent `z 0..14.60`, thickness 0.21109, no overhang | `roof-main` capping the attic ring and the four tall returns | section, side elevations | SOURCE_EXACT (pitch) / DERIVED (eave) |
| garage flat roof top 2.88 thick 0.34 | `roof-garage` capping the garage walls | section | SOURCE_DERIVED |
| balconies | `balcony-front` (`x 3.338..7.90`, `z 0..1`), `balcony-rear` (`x 0.61..7.29`, `z 13.60..14.60`), top 2.96, 0.55 | attic plan edge line, rear elevation fascia | VISUAL_INFERRED |
| glass balustrades 0.90, four panels each | `rail-front` (`x 3.444..7.153`), `rail-rear` (`x 0.689..7.153`) | attic plan post marks, elevations | VISUAL_INFERRED |
| two chimney stacks through modelled penetrations | `chimney-salon` + `pen-salon`, `chimney-boiler` + `pen-boiler` | attic plan blocks, elevation caps | SOURCE_DERIVED |
| three rooflights 78/118 | `rl-pralnia-w`, `rl-lazienka-w` (west slope), `rl-schody-e` (east slope) + `-unit` fills | attic plan callouts, west elevation | SOURCE_CORROBORATED |
| twelve facade openings, all real cuts | `og-front-room-window` 110/230, `og-front-entrance` 105/210, `og-east-living-window` 300/230, `og-east-garage-door` (concealed, kotłownia), `og-rear-living-glazing` 470/230, `og-west-living-window` 90/230, `og-west-kitchen-window` 140/140, `og-garage-door` 275/225, `og-garage-side-door` 100/210, `og-front-gable-glazing` 270/320 raked, `og-rear-gable-east` and `-west` 234/303 raked | plan gaps, callouts, elevations | SOURCE_EXACT / CORROBORATED |
| 18 rooms | `g-salon`, `g-kitchen`, `g-hall`, `g-pantry`, `g-bathroom`, `g-room`, `g-entry`, `g-boiler`, `g-garage`; `u-pokoj-nw`, `u-pokoj-ne`, `u-garderoba-ne`, `u-pralnia`, `u-bathroom`, `u-garderoba-sw`, `u-pokoj-s`, `u-corridor`, `u-stairs` | both plans, published room table | SOURCE_CORROBORATED |
| 19 partitions (10 ground, 9 attic) with T/BUTT junctions, 11 interior doors | `gw-*`, `uw-*` (attic ones `FOLLOW_ROOF`, capped at 2.60), `gd-*`, `ud-*` | plan ink and door gaps | SOURCE_CORROBORATED / DERIVED |
| stair | `stair-main` placeholder over the void `x 5.37..7.45`, `z 4.83..6.81` | both plans | SIMPLIFICATION |

> **STAGE BUILDAPP-01A** closed the architectural gaps this stage recorded as
> simplifications: the stair, the slab void, the rooflight cut mode, the
> entrance assembly, the cladding bands and the recess floors.
> See **`docs/MARCOWKI_ARCHITECTURAL_FIDELITY.md`** for what changed and
> **`docs/MARCOWKI_SOURCE_REVISION_POLICY.md`** for which published revision
> the reference follows. The sections below describe the model as it stands.

## Generic capabilities added for it

Each is a schema primitive with commands, validation, compiler support
and tests on buildings that are not the reference
(`packages/{model,commands,geometry}/test/openings-1.2.0.test.ts` for 1.2.0,
`.../fidelity-1.3.0.test.ts` for 1.3.0):

- **Raked opening heads** — `Opening.head: { kind: 'RAKED', heightFar }`;
  the three gable windows under the 40° rake. A window in a raked opening
  gets a trapezoid frame and panes; a door refuses one.
- **Multi-leaf openings** — `Opening.leaves: [{ wallId, offset }]`; one
  passage through parallel abutting leaves. Implemented and proven generic
  (a two-leaf wall in the geometry tests, mutation 12) but not used by the
  reference: the house/garage wall is one leaf (ledger).
- **Roof openings and rooflights** — `RoofOpening` (ROOFLIGHT / PENETRATION
  with `throughId`) and `Rooflight`; `cutRoofOpening`, `placeRooflight`;
  cuts through the roof plate with reveals, watertight band tiling, chimney
  penetrations without shared volume.
- **Explicit window mullions** — `Window.mullions` fractions, for the
  divided gable glazing and the living-room glazing.
- **FOLLOW_ROOF crossing breaks** — a capped partition that follows the roof
  only where the soffit is lower than its cap now kinks on a grid line
  (found by the attic corridor partition; a generic compiler fix).
- **Oracles** — `depthProbeReport`, `lineCoverage`, `pointInPolygon`.

Added in schema 1.3.0 (STAGE BUILDAPP-01A):

- **Regions with holes** — `tessellateRegion`: `outer − holes` as one closed
  extrusion, holes allowed to share boundary with the outline. Used by
  `Slab.holes`, by composite door frames and by finish skins.
- **Real staircases** — `Stair` FLIGHTS with FLIGHT / WINDER / LANDING
  segments, `layoutStair` in the model package and a stair compiler that
  emits one edge-manifold solid of treads.
- **Roof cut modes** — `RoofOpening.cut` VERTICAL / NORMAL_TO_ROOF.
- **Composite openings** — `Door.assembly` of LEAF / GLAZED / PANEL panels
  with mullions.
- **Surface regions** — `SurfaceRegion`, a finish band on a wall face with no
  thickness of its own, clipped to the wall's real material.

## Decisions no source settles

The ledger (`src/ledger.ts`, 33 entries, printed by `npm run audit:marcowki`)
records every contradiction, simplification and omission with the reason and
the handling. The ones that shape geometry:

- **Eave datum** — the section prints +4,67; span, pitch and ridge give
  4.63556. The derived plane is used; the printed datum is kept as constraint
  `c-eave-datum`. Taking +4,67 would make the built pitch 39.71°.
- **House/garage wall** — the reference modelled two abutting 0.45 leaves
  because its compiler had no T-junctions; the drawings show one wall and the
  published garage area only closes with one. One leaf, T-junctioned; the
  kotłownia door is therefore a single-leaf opening.
- **Upper slab** — bearing rectangle `x 0.45..7.45` with the stair void as a
  real L-shaped hole (4.158 m²) touching the east inner face.
- **Stair winders** — thirteen straight risers are counted on the plans; the
  four winders in the corner are inferred from the printed 3.06 m rise
  (0.18 m risers). Three and five winders are admissible and recorded.
- **Balcony thickness, railing height, portal head, garage parapet,
  chimney tops** — read off elevations, `VISUAL_INFERRED`, listed.
- **Attic ceiling** — partitions capped at 2.60 above the attic floor where
  the roof is higher.

## The model in numbers

159 commands: 19 evidence sources, 9 materials, 1 building, 2 levels,
2 rings, 27 walls (3 garage, 5 returns, 19 partitions), 1 loose junction,
3 slabs, 2 roofs, 4 balcony/terrace plates, 2 railings, 2 chimneys,
5 roof openings, 3 rooflights, 23 openings, 8 windows, 15 doors, 18 rooms,
1 stair, 6 surface regions, 5 constraints. Result: 35 walls, 45 junctions
(10 CORNER, 22 T, 13 BUTT), 130 objects carrying evidence
(12 `SOURCE_EXACT`, 41 `SOURCE_CORROBORATED`, 34 `SOURCE_DERIVED`,
3 `GEOMETRIC_INFERRED`, 23 `VISUAL_INFERRED`, 17 `ASSUMED`), zero validation
issues, zero compile diagnostics, 47 closed structural solids, 4480
triangles in 178 meshes, bounds `x 0..12.05` (the finish skins stand 5 mm
proud of the west face), `y −0.32..7.95`, `z 0..14.60`.

## Measured source parity

From `npm run audit:marcowki` and `packages/reference-marcowki/test`
(104 tests across nine files: metrics, the 01A fidelity suite, two mutation
catalogues and persistence). Every number is
an oracle reading of the compiled scene.

| claim | measured |
| --- | --- |
| characteristic depth front outer plane → rear outer plane | 14.600 m (structural solids' `z` extent) |
| walled envelope | 12.600 m (ring walls' `z` extent); front zone 1.000, rear zone 1.000 |
| front recess mouth | 180 rays at 0.4 / 1.2 / 2.0 m: 0 at the outer plane, 0 nearer than 1.00, shallowest 1.000; 12/12 rays on the returns beside it stop at the plane |
| rear loggia mouth | the same, 180 rays |
| portal mouth | 0 of 64 rays blocked at the outer plane; 1.00 m jambs either side; head = portal head 2.41..3.08 over the garage part, balcony slab 2.41..2.96 over the rest |
| ring closure | ground 836 probes, attic 836, garage 504: 0 gaps, 0 overlaps, 0 reversed walls |
| solids | 47 structural solids closed; pairwise overlap between all of them: none |
| roof | both slopes 40.00° from normals; ridge 7.950; extent `z 0..14.6`; closed; eave walls meet the underside with worst gap and overlap 9e−16 |
| twelve openings | each: 0 material through the centre, 0.45 beside the jamb and above the head, fill hosted inside the hole, reveals closing the wall solid, 4 rays inside the printed rectangle read 0 and 4 cm outside read 0.45; the room behind each by point-in-polygon equals the room the plan names |
| raked heads | worst error between the printed callout line and where material begins: 1.8e−15 over 11 stations per window; the wall loses exactly the trapezoid; fills stay under the head; ≥ 1.05 m of wall above each head to the soffit |
| kotłownia door | one 0.45 m leaf cut through: a ray from the garage into the boiler room meets nothing, 6 cm beside it exactly 0.45 |
| balconies / portal | closed solids of the stated volumes and bounds; the whole front zone is open below 2.41 |
| balustrades | glass over 92.5 % (front) / 95.7 % (rear) of the run, longest gap 0.070 (a post), tops at 3.860, four panels each |
| chimneys | two stacks through penetrations, no shared volume with the roof, roof material right beside each |
| rooflights | three 0.78 × 1.18·cos 40° cuts, lower edge 0.45 in from the eave, frame and glass closed, glass 0.024 through the pane, each over the attic room the plan places it in; all three cut **normal to the roof** — 96/96 rays along the roof normal pass clean, underside outline 0.135686 m uphill against 0.21109 × sin 40° predicted |
| upper slab | closed, volume `(inner − void) × 0.33`, the void a real **L-shaped hole** of 4.158 m² touching the east inner face: 1680 rays inside it meet no slab, 924 outside it meet 0.33 |
| stair | one closed solid; 17 risers of 0.180 m measured by rays up the walking line; arrives exactly on +3,06; first riser on the plan's nosing line x 5.370; inside the shaft `x 5.37..7.45 z 4.83..7.94`; no volume shared with the slab or any wall |
| finish regions | six bands, each a 2 mm skin 5 mm clear of its wall face, changing no wall volume; the front gable band's top follows the 40° rake to within 1 mm; no band covers an opening |
| door assemblies | entrance `LEAF 0.72 │ mullion 0.04 │ GLAZED 0.28` with the pane on the east side, garage one flush `PANEL`, garage side door one fully glazed `LEAF`; the concealed kotłownia door stays a plain leaf |
| four facades | 47 registered elevation readings compared orthographically: 36 pass, 9 deviate (each a recorded source conflict), 2 not modelled, 0 not found; worst deviation 0.185 m |
| interior | 18 rooms, no two overlapping (grid points); 19 partitions closed, inside the shell, touching without overlapping it; 11 interior doors real cuts between exactly the two rooms the plans connect; the corridor partition follows the soffit where the roof is lower |

## Mutation catalogue

Two catalogues apply mutations to the real model and prove a named checker
passes the reference and catches each. `test/mutations.test.ts` covers the
shell and the openings (below); `test/mutations-01a.test.ts` covers the
architectural fidelity this stage added — the stair back to a placeholder,
the wrong rise, the footprint shifted, the void filled, a rooflight cut
vertically, the sidelight removed, the sidelight on the wrong side, a region
omitted, a region on the wrong wall, the balcony edge moved, the balustrade
shortened, a door re-dimensioned and a raked head squared off.

`test/mutations.test.ts`:

| # | mutation | caught by |
| --- | --- | --- |
| 1 | front recess flattened (infill wall on the outer plane) | `recessReport(FRONT)` |
| 2 | rear recess halved (rear wall moved out, side walls and returns following) | `recessReport(REAR)`, `depthReport` |
| 3 | a facade opening removed | `openingReport.found`, facade count |
| 4 | fill kept, cut removed | `validateModel` → `UNKNOWN_OPENING`, compiler refuses |
| 5 | an opening moved to the wrong facade | `openingReport.through` on the expected wall |
| 6 | the front balcony removed | `verticalRuns`, `structuralSolids` |
| 7 | the railing made opaque and short | `railingReport` (`lineCoverage`) |
| 8 | a raked head made rectangular | `openingReport.headError` |
| 9 | pitch changed to 35° | `roofReport` (`upwardPlanes`) |
| 10 | depth relation reversed (every `z` mirrored) | `recessReport`, `openingReport` |
| 11 | wrong room behind an opening (polygons swapped) | `roomBehindOpening` |
| 12 | a multi-leaf passage with one leaf cut (generic two-leaf wall) | material through the passage across both leaves |
| 13 | a roof opening filled | roof material through the rooflight centre; the unit-kept variant → `UNKNOWN_ROOF_OPENING` |

## Using it

- **BuildWorld**: toolbar → model → *Dom w marcówkach (GE)*. Same store,
  same compiler, same inspector; every object shows its kind, id, name,
  parameters, host, evidence status, cited sources and locator. Save JSON
  writes the model through the normal serializer; the file reloads without
  the reference package.
- **Fixture**: `packages/model/test/fixtures/marcowki-ge-1.2.0.json` is the
  frozen file; the model and geometry packages load and compile it alone,
  the reference package asserts it equals today's replay byte for byte.
- **Audit**: `npm run audit:marcowki` prints the metric report above and
  the ledger, exit 1 on any miss.
- **Files**: `packages/reference-marcowki/src/{transform,sources,facts,commands,model,expected,ledger}.ts`,
  `test/{measure,replay,transform,shell,openings,features,interior,persistence,mutations}.test.ts`,
  `scripts/audit.ts`; `apps/web/e2e/marcowki.spec.ts`;
  `tests/architecture/reference.test.ts`.
