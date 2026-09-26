# Marcówki Auto v2 — exterior forensic audit

Stage BUILDAPP-03Y, §3. The owner reviewed *Marcówki (auto v2)* on Android and
judged the composition better than Auto v1 but the exterior unfinished: joints
that are not clean, a balcony whose short side does not end at the building, a
railing that should turn, a weak terrace, incomplete facade bands and frames, a
jagged roof edge, and elements that merge into one another. This document
traces each observation to the object that shows it, the first pipeline stage
that got it wrong, the cause, and the layer the fix belongs in.

The measurements come from the geometry closure audit
(`packages/geometry/src/closure.ts`) run on the sealed Auto v2 candidate as it
compiles today (`stage-reports/artifacts/exterior-closure/closure-marcowki-auto-v2.json`),
from the sealed candidate's own model, and from the sealed truth set
`research/marcowki-v2/marcowki-source-truth-v2.json`. The truth set is
benchmark data: it is read here and by `npm run audit:exterior` to judge a
candidate after sealing, never by the analyzer.

Two rules held throughout (§3): a compiler defect is not fixed with a
heuristic in the analyzer, and a reconstruction error is not fixed with a
renderer trick. No depth offset, no epsilon expansion, no outline hides a joint.

## Summary

| # | Owner observation | Auto v2 measure (exterior) | First bad stage | Fix layer | After (Auto v3) |
|---|---|---|---|---|---|
| D1 | wall / slab / roof penetrations | 8 coplanar duplicates, 9.96 m² slab edges + 4.76 m² flat-roof edges in facade planes | DSL emission | DSL command + geometry compiler (plate bearing) | 0 duplicates, 0 intersections |
| D2 | jagged roof edge, verge | 4 verge bars: 2.04 m³ shared with the roof, 10.1 m² faces drawn twice, crossing at the ridge | model (no roof-edge semantics) | model schema + geometry compiler + topology solver | verge boards compiled with the roof; 0 findings |
| D3 | fascia / portal head | portal head bar through the garage roof (1.47 m³) and return (0.44 m³) | model + DSL emission | model schema (roof fascia) + topology solver | one band, one top line |
| D4 | balcony short side does not end at the building | front slab 0.67 m short of the portal head, 3.1 cm off the attic return; rear slab 9 cm off one return, 1.1 cm into the other; both tops 3 cm under the floor | topology solver | topology solver (end conditions) + metric solver (floor datum) | every end terminates: WALL / CARRIES / FREE-at-drawn-line / MEETS |
| D5 | railing should turn and return | front railing free end 0.94 m from any wall; rear end 9 cm off | model (straight railings only) + topology solver | model schema (railing path) + geometry compiler + topology solver | 2 runs 1 turn; 0 free ends |
| D6 | terrace weak | terraces as balcony slabs, floor only, no platform, 1.5 cm off the returns | model (no terrace) + analyzer | model schema + DSL + compiler + analyzer | two first-class terraces, rear platform read off the plan |
| D7 | facade bands and frames incomplete | band broken at x 7.23..7.90; stacked returns step 3.1 cm between storeys; verges 0.3 m deep before 0.99 m returns | topology solver | topology solver (assembly closure, facade graph) | band 3.31..12.05 continuous; frames one member |
| D8 | elements merge visually | parts coloured by part; garage in the house's wall material; one averaged finish region | material / styling system + analyzer | styling system + analyzer (tones) + viewer | semantic groups, palette with luminance gaps, source tones |

Out of scope and recorded for BUILDAPP-03Z: the stair shares 0.44 m³ with the
ground ring wall and smaller volumes with three partitions and both chimneys,
and partitions stop 15 mm short of what they meet (the emitter trims them
because interior junctions are not declared). These are INTERIOR findings; the
exterior review does not see them.

---

## D1 — wall / slab / roof penetrations

- **OWNER_OBSERVATION.** Joints are not clean: walls, slabs and the roof pass
  into one another; faces flicker where two elements meet.
- **SOURCE_SUPPORT.** The source never shows a floor plate at the facade:
  T2-MASS-MAIN and T2-MASS-GARAGE give walled envelopes whose outer faces are
  render, and T2-ROOF-BUILDUP puts the roof build-up on the knee-wall top.
  A floor plate bears into the walls; it does not reach their outer face.
- **CURRENT_MODEL_OBJECTS.** `slab-main-1` (upper floor) was the walled
  footprint's outer rectangle, x 0..7.90, z 0.99..13.60. Each of its four
  edge faces lay in the plane of a ring wall's outer face
  (`ring-main-0-w0..w3`): four faces drawn twice, 3.95 + 2.33 + 2.10 + 1.58 m².
  `roof-attached-0`, the garage's flat roof, was a plate over the full
  footprint: its edges lay in the planes of the garage walls and the garage
  return (`ring-attached-0-0-w0..w2`, `return-front-0-1`), four more
  duplicates, 4.76 m².
- **FIRST_BAD_PIPELINE_STAGE.** DSL emission (`emit.ts`): the upper slab was
  emitted with the mass rectangle as its polygon, and the flat roof with its
  footprint as its plate.
- **ROOT_CAUSE.** The model could state where a plate is, not how it meets the
  walls that carry it. With no way to say "this plate bears into its walls",
  the emitter stated the outer line, and the compiler — correctly — drew every
  solid to its stated extent.
- **FIX_LAYER.** DSL command and geometry compiler. Upper slabs are emitted
  inset by the wall thickness with their holes clipped to the slab
  (`emit.ts`). Roofs gain `plateInset` (schema 1.5.0, `createRoof`): the plate
  stops inside the walls it bears on while the footprint still says what the
  roof covers (`roof-compiler.ts`). The closure audit states the rule: a plate
  may share with a wall at most wall thickness × plate thickness × run
  (`BEARING`), and may show no face in the wall's outer plane.
- **QUALITY_AFTER_FIX.** Auto v3: 0 coplanar duplicates, 0 exterior
  intersections; every wall–slab and parapet–plate contact is a bearing within
  its allowance. §5 tests: a ring, a T joint, a butt joint, a bearing slab, a
  slab run to the outer face (flagged), a balcony against and into its wall, a
  member on, off and into its host.

## D2 — the jagged roof edge: verge members

- **OWNER_OBSERVATION.** The roof edge is jagged; the verge does not close the
  roof.
- **SOURCE_SUPPORT.** T2-ROOF-VERGE-MEMBER: a white verge band along both
  rakes of both gables, 0.83 m vertical, 0.64 m across the rake, in the outer
  planes z = 0 and z = 14.60, *continuous with the returns*. Its depth along z
  is T2-UNRES-VERGE-DEPTH (unresolved).
- **CURRENT_MODEL_OBJECTS.** `verge-front-w`, `verge-front-e`, `verge-rear-w`,
  `verge-rear-e`: four free linear solids, 0.61 m × 0.30 m, laid along the
  rakes at z = 0.15 and 14.45. Each shared 0.509 m³ with `roof-main` and drew
  2.53 m² of face twice with it; each met its return with 0.07 m³ shared and
  0.24 m² drawn twice; the two halves of each gable crossed at the ridge
  (0.023 m³, 0.15 m²). 22 findings in all.
- **FIRST_BAD_PIPELINE_STAGE.** The model: a verge could only be stated as a
  free bar beside the roof, not as the roof's own edge.
- **ROOT_CAUSE.** A verge board is part of the roof's edge — the plate stops
  where it begins, the wall under it follows its underside — but the schema had
  no roof-edge semantics, so the emitter laid bars over a plate that ran on
  underneath them. The bar's 0.30 m depth was a default, not a reading: the
  frame's returns stand 0.99 m deep.
- **FIX_LAYER.** Model schema, geometry compiler, topology solver.
  `Roof.edgeMembers.verge` (schema 1.5.0) with per-end width and depth; the
  roof compiler shortens the plate by the board's strip, compiles the board as
  one closed chevron per gable, and makes walls under a strip follow the
  strip's underside (`roof-compiler.ts`, `compileRoofTrims`, `vergeEnds`).
  `closeVerges` sets the depth to that of the zone the frame's returns stand
  in, and records why.
- **QUALITY_AFTER_FIX.** Verge boards 0.79 m vertical (T2: 0.83), 0.61 m across
  the rake (T2: 0.64), 0.99 m and 1.00 m deep; 0 trim findings. Fixture 6
  (gable with verge boards) holds the joint generically.

## D3 — the garage roof edge over the portal

- **OWNER_OBSERVATION.** Part of "the fascia does not close"; the portal head
  reads as a block pushed into the garage.
- **SOURCE_SUPPORT.** T2-PORTAL-HEAD: the portal head over the garage door *is
  the garage roof's edge* over the recess, fascia 2.28..3.07;
  T2-FACADE-FRONT-BAND: one dark band with the balcony fascia, x 3.25..12.05.
- **CURRENT_MODEL_OBJECTS.** `portal-head-attached-0`, a linear solid x
  7.90..12.05 through `roof-attached-0` (1.47 m³, 2.20 m² drawn twice) and
  `return-front-0-1` (0.44 m³, 1.15 m²).
- **FIRST_BAD_PIPELINE_STAGE.** Model and DSL emission: a roof had no fascia,
  so the head was a second solid occupying the plate's edge.
- **ROOT_CAUSE.** Same as D2 for the flat roof: its edge member could not be
  said to be its edge.
- **FIX_LAYER.** Model schema (`Roof.edgeMembers.fascia`: sides, top offset,
  height, depth), geometry compiler (fascia compiled with the plate), topology
  solver (`closePortalHeads`: the head shares the balcony's top and soffit
  when it continues the balcony's band).
- **QUALITY_AFTER_FIX.** One band: the balcony slab ends at x 7.90 where the
  fascia begins, both tops at 3.06, soffit 2.32 (T2: 2.28). 0 findings.

## D4 — the balcony's short side does not end at the building

- **OWNER_OBSERVATION.** The balcony is wrong: its short side does not
  terminate at the building.
- **SOURCE_SUPPORT.** T2-BALCONY-FRONT: x 3.25..7.90, top 3.06 — the slab runs
  on under the attic's east return to meet the portal head. T2-BALCONY-REAR:
  x 0.61..7.29 between the loggia returns, top 3.06. The upper plan draws the
  front balustrade turning across the zone at the slab's west (free) end.
- **CURRENT_MODEL_OBJECTS.** `balcony-front-1` x 3.135..7.230, top 3.029:
  3.1 cm short of the attic return's face and 0.67 m short of the portal head,
  3 cm under the floor it opens from. `balcony-rear-1` x 0.639..7.176: 9 cm
  short of `return-rear-0-1`, 1.1 cm into `return-rear-0-0`, 3.4 cm low.
  Six exposed gaps and one intersection in all.
- **FIRST_BAD_PIPELINE_STAGE.** Topology solver: the slab's extent was the
  readable extent of its fascia band, and nothing decided what each end meets.
- **ROOT_CAUSE.** A band is readable only where it is visible: at the attic's
  east return it disappears behind the return, and at the west it ends where
  its drawing ends. The solver emitted the reading as the slab. There was no
  notion of an end condition.
- **FIX_LAYER.** Topology solver and metric solver (`closeBalconies` in
  `assembly-closure.ts`). Each end resolves to one of: **WALL** — a return of
  a lower storey stands beside it; **CARRIES** — a return of its own storey
  stands on it *and* stands over an open recess of the storey below *and* the
  elevation draws the fascia band running on under it (without that drawn
  band the slab stops at the return's face: `bandContinues`); **FREE** — the
  plan is read for the balustrade line across the zone; **MEETS** — the next
  member of the band (a portal head) starts there. The top snaps to the
  storey floor within 0.1 m. Stacked returns first share one face (D7).
- **QUALITY_AFTER_FIX.** Front x 3.310..7.900 (FREE at the plan's line at
  3.31, CARRIES under `return-front-1-1`, MEETS the portal head), rear
  0.645..7.255 (WALL at both ends), tops 3.06. Kelsall (returns standing on a
  closed storey) now stops at the return faces instead of running under them;
  Lindale shows a free end found from the plan alone.

## D5 — the railing should turn and return

- **OWNER_OBSERVATION.** The railing should turn at the balcony's short side
  and return to the building.
- **SOURCE_SUPPORT.** The upper plan draws the balustrade across the zone at
  x ≈ 3.31 over 100 % of its depth; T2-RAILING-FRONT: glass, x 3.30..7.26,
  0.87 m.
- **CURRENT_MODEL_OBJECTS.** `railing-front-1`, straight x 3.185..7.180 at
  z 0.05: its west end stood 0.94 m from any wall — a free end in mid-air.
  `railing-rear-1` stopped 9 cm off the loggia return.
- **FIRST_BAD_PIPELINE_STAGE.** The model: a railing was one straight segment.
  Then the topology solver: with no end conditions (D4) it had nothing to run
  a railing to.
- **ROOT_CAUSE.** Railings could not turn, so the only railing the model could
  hold was the straight run along the mouth.
- **FIX_LAYER.** Model schema (`Railing.path`, schema 1.5.0), DSL
  (`createRailing.path`), geometry compiler (a polyline railing: one square
  post at each corner, end posts inside the run so a railing drawn to a wall
  meets it, rails stopping at the corner post), topology solver (`railingPath`,
  `closeRailings`: along the mouth, turning back to the wall at a FREE end the
  plan draws the turn at, stopping at a WALL end). Nothing names the project:
  the Lindale fixture draws the turn at one free end and gets it; its control,
  without the line, does not.
- **QUALITY_AFTER_FIX.** Front railing 2 runs, 1 turn; rear 1 run between the
  returns; 0 free ends; the largest end-to-wall distance is 0.025 m, half a
  post.

## D6 — the terrace is weak

- **OWNER_OBSERVATION.** The terrace is weak.
- **SOURCE_SUPPORT.** T2-RECESS-FRONT-GROUND: the portal recess floor, x
  0.61..11.42, z 0..1.00, at ±0.00. The rear loggia's floor, and a hatched,
  furnished platform the ground plan outlines 2.1 m beyond the rear plane (no
  truth item: reported as read).
- **CURRENT_MODEL_OBJECTS.** `terrace-front-66`, `terrace-rear-66`: balcony
  records of kind TERRACE, 0.20 m slabs in the slab material, drawn as balcony
  slabs, covering the recess floors only, starting 1.5 cm off the returns. No
  platform, no host facade, no surface.
- **FIRST_BAD_PIPELINE_STAGE.** The model (no terrace object) and the analyzer
  (no reader for a platform beyond the mouth).
- **ROOT_CAUSE.** A terrace lies on the ground against a facade; a balcony is
  carried by the building. Modelled as a balcony it had the wrong semantics,
  the wrong material and no extent beyond the recess.
- **FIX_LAYER.** Model schema (`terraces`: polygon, level, top offset,
  thickness, surface, edge, host walls), DSL (`createTerrace`), compiler
  (`compileTerrace`), analyzer (`readTerraceExtension`: the first thin outline
  spanning the facade beyond the mouth, with the plan between drawn on;
  `closeTerraces`: floor edges meet the returns, platform sides meet the
  building's corners), styling (TERRACE_SURFACE). Landscaping stays out: the
  lawn and planting beyond the outline are not modelled.
- **QUALITY_AFTER_FIX.** Front terrace x 0.645..11.416 × z 0..0.991; rear an
  8-gon covering the loggia floor and a 7.90 × 2.11 m platform; both PAVED
  with a plinth, on the floor datum (residual 0), against their facades
  (0 gaps). Web and Android draw them.

## D7 — facade bands and frames are incomplete

- **OWNER_OBSERVATION.** Facade bands and frames are incomplete; the frame
  reads as pieces.
- **SOURCE_SUPPORT.** T2-FACADE-FRONT-BAND (one band 3.25..12.05);
  T2-ASSEMBLY-FRONT-GABLE-FRAME and T2-ASSEMBLY-REAR-GABLE-FRAME (returns and
  verge members as one frame); T2-RECESS-* (the west returns 0..0.61 on both
  storeys).
- **CURRENT_MODEL_OBJECTS.** The front band broken between x 7.23 and 7.90
  (D4); the ground and attic returns at each west corner read 3.1 cm apart
  (0.661 and 0.630), so the frame stepped between storeys; 0.30 m verge bars in
  front of 0.99 m returns (D2); one exposed gap between the attic return and
  the garage wall (2.6 cm).
- **FIRST_BAD_PIPELINE_STAGE.** Topology solver: members were solved one by
  one; nothing stated how they continue one another.
- **ROOT_CAUSE.** An assembly is a graph of members that continue, turn and
  terminate; the solver held a list.
- **FIX_LAYER.** Topology solver (`assembly-closure.ts`):
  `snapReturnsToBodyFaces` (a return within 6 cm of its body's face is in it),
  `alignStackedReturns` (one member read on two plans within 6 cm is one face,
  at the mean), `closeVerges`, `closePortalHeads`, and `buildFacadeGraph`
  (nodes with start, end and termination; edges CONTINUES_TO, TERMINATES_AT,
  TURNS_AT, MEETS_HOST with the gap measured). The 100-stripe stress test
  still holds: noise does not become members.
- **QUALITY_AFTER_FIX.** Band x 3.31..12.05 with one top line (3.06) and one
  soffit (2.32); every return continues into its verge; 0 facade-graph gaps.

## D8 — elements merge visually; the style

- **OWNER_OBSERVATION.** Elements merge visually. The wanted look is a clean,
  minimal, stylised architectural graphic — not photoreal.
- **SOURCE_SUPPORT.** T2-MAT-WHITE-SHELL (white body and frame),
  T2-MAT-DARK-FRONT and T2-ASSEMBLY-GARAGE-BOX (anthracite garage and portal
  band), T2-MAT-TIMBER-FRONT and -REAR (timber in the recesses), T2-MAT-ROOF.
- **CURRENT_MODEL_OBJECTS.** The garage walls in the house's wall material
  (the garage's tone was not read); one surface region on the front recessed
  wall, a single averaged MID tone emitted in the wall material; the viewers
  coloured by part.
- **FIRST_BAD_PIPELINE_STAGE.** The material / styling system (no semantic
  groups, no palette), and the analyzer's tone reading (an absolute luma
  threshold called the flat-lit anthracite — luma 84 of a 250 white — "mid").
- **ROOT_CAUSE.** Colour came from parts and raw materials, so neighbours of
  similar value merged; the renders' tones were not carried into the model.
- **FIX_LAYER.** Styling system, analyzer, viewer. Semantic groups with one
  controlled palette whose adjacent pairs differ by at least 0.06 in relative
  luminance (`packages/mobile-scene/src/semantics.ts`, mirrored by the web
  adapter and the Kotlin fallback); facade roles from the model (walls outside
  every ring are frame members; ring walls in a non-dominant finish are a
  secondary body); tone hints from the model's own finishes that move a group
  only to another rung of the palette and never into a neighbour's luminance;
  WALL_CLADDING for timber regions. The analyzer reads tones relative to each
  render's white point by robust median, and finish regions as runs along the
  recessed walls. Architectural style on web and Android beside Construction
  and Clay.
- **QUALITY_AFTER_FIX.** Main body LIGHT, garage DARK (34 % of white), frames
  LIGHT; front recess timber 0.65..3.19 then anthracite 3.19..7.90 (T2: 3.25);
  rear recess timber. Still not read: the ground-storey side bands, the rear
  gable's dark panel and the attic's timber panel (MATERIAL_READABILITY
  PARTIAL).

## What the audit found beyond the owner's list

- **Exposed gaps.** The closure audit's gap check (two solids the model says
  meet, 3 mm to 10 cm apart) found 7 exterior cracks on Auto v2, all at slab
  ends and returns (D4, D7). Auto v3 has none.
- **Railing ends.** The audit's own wall distance treated a wall's thickness
  as possibly lying on either side, which under-reported free ends by the wall
  thickness. It now uses the model's inward side; the Auto v2 front railing's
  free end measures 0.94 m.
- **Opening sills and heads.** Seven sill and head readings on the renders
  disagree with the model where glazing stands behind a balustrade or under a
  balcony. They are identical on Auto v2 and Auto v3 (OPENINGS PARTIAL) and
  were not in this stage's scope.
