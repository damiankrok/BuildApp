# Hypothesis pipeline demonstrations (synthetic evidence)

observation → hypothesis → fusion → topology → metric solve → Building DSL. The evidence is synthetic; this is not production recognition.

| demo | result | proposals | decisions | added assemblies | DSL commands | conflicts recorded | closure errors | roof graph = truth |
|---|---|---|---|---|---|---|---|---|
| roof-intersecting | PASS | 10 | ACCEPTED ROOF (0.8463) | ROOF×1 | 24 | 4 | 0 | yes (roof-intersecting-gables) |
| roof-hip | PASS | 11 | ACCEPTED ROOF (0.8463) | ROOF×1 | 18 | 4 | 0 | yes (roof-hip) |
| dormer | PASS | 5 | ACCEPTED DORMER (0.816) | ROOF×1, DORMER×1 | 5 | 0 | 0 | — |
| porch-columns-beams | PASS | 8 | ACCEPTED CANOPY (0.876) | ROOF×1, CANOPY×1 | 23 | 1 | 0 | — |
| pergola | PASS | 16 | ACCEPTED PERGOLA (0.7171) | PERGOLA×1 | 35 | 2 | 0 | — |
| pergola-ambiguous | PASS | 13 | UNKNOWN (0.5) | UNKNOWN×1 | 3 | 0 | 0 | — |
| entrance-steps | PASS | 8 | ACCEPTED EXTERIOR_STEPS (0.9125) | EXTERIOR_STAIR×1, ENTRANCE×1 | 10 | 0 | 0 | — |
| unknown | PASS | 3 | UNKNOWN (0.35) | UNKNOWN×1 | 3 | 0 | 0 | — |

## roof-intersecting

Intersecting gables stated from a roof plan, a section and a render

- h1 ACCEPTED ROOF: roof: every required requirement met (roof-planes, roof-lines, roof-pitch); not dormer: missing the host roof surface is interrupted; a vertical facade rises from the roof; the feature seen from two views (seen in 1 frame, needs two)
- conflict h1.plane-1.pitchDeg: kept 35 (PRINTED_DIMENSION, pitch-printed), lost 38 (PERSPECTIVE, pitch-render) — perspective does not override printed_dimension
- conflict h1.plane-2.pitchDeg: kept 35 (PRINTED_DIMENSION, pitch-printed), lost 38 (PERSPECTIVE, pitch-render) — perspective does not override printed_dimension
- conflict h1.plane-3.pitchDeg: kept 35 (PRINTED_DIMENSION, pitch-printed), lost 38 (PERSPECTIVE, pitch-render) — perspective does not override printed_dimension
- conflict h1.plane-4.pitchDeg: kept 35 (PRINTED_DIMENSION, pitch-printed), lost 38 (PERSPECTIVE, pitch-render) — perspective does not override printed_dimension

## roof-hip

Hip roof stated from a roof plan and a section

- h1 ACCEPTED ROOF: roof: every required requirement met (roof-planes, roof-lines, roof-pitch); not dormer: missing the host roof surface is interrupted; a vertical facade rises from the roof; the feature seen from two views (seen in 1 frame, needs two)
- conflict h1.plane-1.pitchDeg: kept 30 (PRINTED_DIMENSION, pitch-printed), lost 33 (PERSPECTIVE, pitch-render) — perspective does not override printed_dimension
- conflict h1.plane-2.pitchDeg: kept 30 (PRINTED_DIMENSION, pitch-printed), lost 33 (PERSPECTIVE, pitch-render) — perspective does not override printed_dimension
- conflict h1.plane-3.pitchDeg: kept 30 (PRINTED_DIMENSION, pitch-printed), lost 33 (PERSPECTIVE, pitch-render) — perspective does not override printed_dimension
- conflict h1.plane-4.pitchDeg: kept 30 (PRINTED_DIMENSION, pitch-printed), lost 33 (PERSPECTIVE, pitch-render) — perspective does not override printed_dimension

## dormer

Gable dormer: an interrupted slope, a front face, a ridge and a window, seen in two elevations and a render

- h1 ACCEPTED DORMER: dormer: every required requirement met (host-interruption, vertical-facade, local-roof-edge, opening, cross-view); not roof: missing planar roof regions (plan outline, pitch and fall from a section or elevation); not canopy: missing a continuous cover surface over the area

## porch-columns-beams

Entrance canopy on two posts and a beam: plan, elevation, a printed canopy height, a render

- h1 ACCEPTED CANOPY: canopy: every required requirement met (cover, supports, beams); not carport: the cover spans 4.8 m², less than a parking bay (12 m²); not pergola: missing repeated horizontal members; the absence of a continuous roof plane, observed; ruled out by cover-elev
- conflict h1.frame.beamTop: kept 2.33 (PRINTED_DIMENSION, cover-top-printed), lost 2.4 (PERSPECTIVE, post-w-render) — perspective does not override printed_dimension

## pergola

Pergola: repeated posts and members, open sky observed, a printed post height beating a render

- h1 ACCEPTED PERGOLA: pergola: every required requirement met (repeated-supports, repeated-members, open-cover); not canopy: missing a continuous cover surface over the area; ruled out by sky-render; not carport: missing a continuous cover over a parking bay; ruled out by sky-render; the cover spans 0.0 m², less than a parking bay (12 m²)
- conflict h1.post-1.top: kept 2.48 (PRINTED_DIMENSION, post-top-printed), lost 2.8 (PERSPECTIVE, pp-1-render) — perspective does not override printed_dimension
- conflict h1.frame.beamTop: kept 2.72 (PRINTED_DIMENSION, post-top-printed), lost 3.04 (PERSPECTIVE, pp-1-render) — perspective does not override printed_dimension

## pergola-ambiguous

The same frame with no observation of whether a cover spans it: kept unknown, not guessed

- h1 UNKNOWN: no family has every required requirement met; kept as an unknown assembly: 13 observations from 2 frames
  - or PERGOLA (0.6): missing the absence of a continuous roof plane, observed
  - or CANOPY (0.45): missing a continuous cover surface over the area
  - or CARPORT (0.3): missing a continuous cover over a parking bay; the cover spans 0.0 m², less than a parking bay (12 m²)

## entrance-steps

Entrance steps: three nosings and a landing in plan and elevation, printed datums

- h1 ACCEPTED EXTERIOR_STEPS: exterior_steps: every required requirement met (nosings, arrival, datums)

## unknown

A raised panel on the front slope seen in two renders: an unknown assembly with its alternatives

- h1 UNKNOWN: no family has every required requirement met; kept as an unknown assembly: 3 observations from 2 frames
  - or ROOF (0.06): missing planar roof regions (plan outline, pitch and fall from a section or elevation)
  - or DORMER (0.03): missing the host roof surface is interrupted; a vertical facade rises from the roof; the feature seen from two views
