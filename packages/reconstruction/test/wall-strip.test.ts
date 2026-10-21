/**
 * The wall strip, adversarially (BUILDPLAN-ANALYZER-005Q, N1a): sixteen families of made-up plans, each beside its
 * opposite, compiled end to end through the production solver (`reconstructV2`).
 *
 * The defect the rule exists for: an inner chain that ticks on an exterior wall's inner face as well as its outer one
 * takes the wall's band (`gridLines`: equal chain spans, equal distance from the band's axis, the lower pixel wins),
 * the grid drops the outer face (the 17 px between the faces is less than the 17.3 px cell at 0.026 m/px), and the
 * body is cut on the inner face. The wall is then left outside the body as a zone the chains dimension, and the frozen
 * solver (the 005Q base, 04d5568a) reads that zone as a recess with a paved terrace floor in front of the house — a
 * terrace that is the wall's own poché — and emits the body's ring SOURCE_EXACT. Run outside vitest through the frozen
 * code (`research/analyzer-005q/synth/record.ts` under the config `synth/oracle-config.mjs` writes for a variant.mjs
 * copy of the base; the commands are in that file's header), family 1 gives:
 *
 *   masses [[0, 0.455, 30, 17.605]]; zone-max_z {x0 60, y0 403, x1 660, y1 420.5}; terraces ['terrace-front-0'];
 *   v2 recesses ['FRONT:0']; ring SOURCE_EXACT "30.00 × 17.15 m body from the plan's printed chains and wall bands";
 *   no gap named
 *
 * and the north-wall variant (family 13) does the same on every redraw: terrace-rear-0 (as drawn and mirrored
 * left–right), terrace-front-0 (mirrored top–bottom), terrace-east-0 (turned 90°), terrace-west-0 (turned 270°), each
 * with a SOURCE_EXACT ring. That record is `FROZEN` below, one entry per fixture and redraw, and it is why this file
 * exists: where N1a fires, everything the frame is measured from stays as the frozen solver had it (masses, world
 * frame, zones, walls, the layout's own recesses) and only the fabricated floor, the SOURCE_EXACT ring and the silence
 * go; where it does not fire, the frozen outcome is asserted whole — a hard negative, and for the strips the rule is
 * bounded away from (a thin wall, a pier, a niche under a quarter of the side, a wall thickened past the face window)
 * a record that the frozen terrace is still there, not an endorsement of it.
 *
 * Family 15 holds the four fixes of review round 1, each on a fixture the round-1 rule (N1a as preregistered,
 * `candidates/N1a.patch`) answers wrongly and the frozen base answers as recorded:
 *   (a) a body is open on a strip only along the stretches its wall ink covers: two bodies on a stepped front, the
 *       garage's own outer face on the envelope line beside the house's cut wall — N1a opened the garage as well; and,
 *       at the sheet-cache seam, a piece of the wall reaching 15 px in front of the garage does not open it, 30 px does;
 *   (b) a platform outlined beyond a wall strip is named (an AMBIGUOUS gap), never built — the frozen base builds it as
 *       the terrace's extension, N1a dropped it silently. The family's own scale (0.026 m/px against chains at
 *       5 cm/px) cannot carry it: the v2 plan frame maps world metres to pixels at the registration's scale, so a
 *       30 m facade spans 1154 px of a 760 px sheet and no outline reaches 85 % of it — and an unhatched outline is
 *       blank paper to `readTerraceExtension` (it wants a third of the plan between drawn on). Family 1 with the
 *       outline alone therefore builds no extension even in the frozen base; the fixture is the same face pair on an
 *       8 px wall at the chains' own scale, with a hatched platform;
 *   (c) a band floating clear of both edges of its strip by more than one face window in all is not the wall. On a
 *       raster the strip's inner edge is the walled envelope snapped to a grid line within ONE modal wall of the
 *       outer face (`walledEnvelope`), so a modal-thickness band can never sit clear of it, and a free-standing band
 *       beyond the house is a long band the envelope then takes in; the reachable case is a front wall
 *       thinner than the modal wall (13 px against 18) under a tick pair that ties on it — 6 px clear in all is
 *       recorded as the frozen base had it, 5 px still fires;
 *   (d) the depth the gap states is measured at the scale of the axis across the strip, not the larger of the two.
 * Two bounds the fixes left without a gate are held again at the end: the face distance (the L of family 14 now stands
 * beside the ink, so a body behind the open one, over the ink, takes its place) and the axis test (F2 keeps out every
 * crossing band thinner than the strip is deep, so two blocks as deep as the strip are handed to the pass).
 *
 * Review round 2 strengthens F1's overlap bound (R2A-6: a reach of wallPx ± 2, two pieces overlapping each other whose
 * union stays under a wall while their sum does not, two pieces at a body's two ends whose union passes it, and all of
 * it turned so the strip is the east one) and adds family 16 for the platform probe of F4 (R2A-1, R2A-2): (a) an L whose
 * wing stands nowhere near the cut wall, with a platform outlined in front of the house only — the probe runs across
 * the bodies standing on the strip's back, so the outline is found; across the whole strip it would not be; (b) the
 * platform gap's side word under every redraw that keeps the strip (front, rear, east and west all named); (c) a
 * platform outlined beyond a real terrace zone, where nothing is named. On four of family 16's redraws the frozen solver
 * does not finish (its emitter refuses the terrace polygon it builds out to the outline): `FROZEN_REFUSED` records that,
 * and those runs assert production's own outcome. G10 itself is held at unit level in `wall-strip-unit.test.ts`.
 *
 * Nothing here is a drawing of a real building; every dimension is made up (`wall-strip-plans.ts`).
 */
import { describe, expect, it } from 'vitest'
import { inferStructuralLayout, openFacesOf, planSheet, reconstructV2 } from '../src/index.js'
import { TRANSFORMS, render } from './transforms.js'
import type { Transform } from './transforms.js'
import { FIXTURES, FRAME, OUTER_FACE, compileFixture, fixtureFrame, fixtureOptions, outcomeOf } from './wall-strip-plans.js'
import type { FixtureName, Outcome } from './wall-strip-plans.js'

type Side = 'front' | 'rear' | 'west' | 'east'
type Frozen = {
  masses: number[][]
  world: Outcome['world']
  zones: Array<[string, { x0: number; y0: number; x1: number; y1: number }]>
  walls: number
  layoutRecesses: string[]
  recessRegions: number
  ring: string
  terraces: string[]
  recesses: string[]
  /** Family 15 (`record.ts --extras`): every body's basis, ring and MASS feature, and each terrace's outlined reach. */
  massBasis?: string[]
  rings?: string[]
  massFeatures?: string[]
  terraceReach?: Array<number | null>
}

/** The frozen solver's outcome on every fixture and redraw, recorded by running the fixtures through the 005Q base. */
const FROZEN: Record<string, Frozen> = {
  'facePair:id': { masses: [[0, 0.455, 30, 17.605]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 17.605 }, walled: { x0: 0, z0: 0.455, x1: 30, z1: 17.605 }, zFlip: 17.605 }, zones: [['zone-max_z', { x0: 60, y0: 403, x1: 660, y1: 420.5 }]], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0'], recesses: ['FRONT:0'] },
  'outerOnly:id': { masses: [[0, 0, 30, 18]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 18 }, walled: { x0: 0, z0: 0, x1: 30, z1: 18 }, zFlip: 18 }, zones: [], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: [], recesses: [] },
  'thinWall:id': { masses: [[0, 0.351, 30, 18.351]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 18.351 }, walled: { x0: 0, z0: 0.351, x1: 30, z1: 18.351 }, zFlip: 18.351 }, zones: [['zone-max_z', { x0: 60, y0: 411, x1: 660, y1: 424.5 }]], walls: 6, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0'], recesses: ['FRONT:0'] },
  'thickWalls:id': { masses: [[0, 0.4465, 30, 17.2965]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 17.2965 }, walled: { x0: 0, z0: 0.4465, x1: 30, z1: 17.2965 }, zFlip: 17.2965 }, zones: [['zone-max_z', { x0: 60, y0: 397, x1: 660, y1: 420.5 }]], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0'], recesses: ['FRONT:0'] },
  'shortPier:id': { masses: [[0, 0.442, 30, 17.592]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 17.592 }, walled: { x0: 0, z0: 0.442, x1: 30, z1: 17.592 }, zFlip: 17.592 }, zones: [['zone-max_z', { x0: 60, y0: 403, x1: 660, y1: 420 }]], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0'], recesses: ['FRONT:0'] },
  'longPier:id': { masses: [[0, 0.442, 30, 17.592]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 17.592 }, walled: { x0: 0, z0: 0.442, x1: 30, z1: 17.592 }, zFlip: 17.592 }, zones: [['zone-max_z', { x0: 60, y0: 403, x1: 660, y1: 420 }]], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0'], recesses: ['FRONT:0'] },
  'ticksDown:id': { masses: [[0, 0, 30, 17.99]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 17.99 }, walled: { x0: 0, z0: 0, x1: 30, z1: 17.99 }, zFlip: 17.99 }, zones: [], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: [], recesses: [] },
  'ticksUp:id': { masses: [[0, 0.4498, 30, 17.6098]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 17.6098 }, walled: { x0: 0, z0: 0.4498, x1: 30, z1: 17.6098 }, zFlip: 17.6098 }, zones: [['zone-max_z', { x0: 60, y0: 403.2, x1: 660, y1: 420.5 }]], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0'], recesses: ['FRONT:0'] },
  'inward9:id': { masses: [[0, 0.442, 30, 17.592]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 17.592 }, walled: { x0: 0, z0: 0.442, x1: 30, z1: 17.592 }, zFlip: 17.592 }, zones: [['zone-max_z', { x0: 60, y0: 403, x1: 660, y1: 420 }]], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0'], recesses: ['FRONT:0'] },
  'inward10:id': { masses: [[0, 0.442, 30, 17.592]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 17.592 }, walled: { x0: 0, z0: 0.442, x1: 30, z1: 17.592 }, zFlip: 17.592 }, zones: [['zone-max_z', { x0: 60, y0: 403, x1: 660, y1: 420 }]], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0'], recesses: ['FRONT:0'] },
  'garageDoor:id': { masses: [[0, 0.455, 30, 17.605]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 17.605 }, walled: { x0: 0, z0: 0.455, x1: 30, z1: 17.605 }, zFlip: 17.605 }, zones: [['zone-max_z', { x0: 60, y0: 403, x1: 660, y1: 420.5 }]], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0'], recesses: ['FRONT:0'] },
  'garageDoorOuterOnly:id': { masses: [[0, 0, 30, 18]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 18 }, walled: { x0: 0, z0: 0, x1: 30, z1: 18 }, zFlip: 18 }, zones: [], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: [], recesses: [] },
  'stepAbove:id': { masses: [[0, 0.455, 30, 17.605]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 17.605 }, walled: { x0: 0, z0: 0.455, x1: 30, z1: 17.605 }, zFlip: 17.605 }, zones: [['zone-max_z', { x0: 60, y0: 403, x1: 660, y1: 420.5 }]], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0'], recesses: ['FRONT:0'] },
  'stepBelow:id': { masses: [[0, 0.455, 30, 17.605]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 17.605 }, walled: { x0: 0, z0: 0.455, x1: 30, z1: 17.605 }, zFlip: 17.605 }, zones: [['zone-max_z', { x0: 60, y0: 403, x1: 660, y1: 420.5 }]], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0'], recesses: ['FRONT:0'] },
  'openTerrace:id': { masses: [[0, 4, 30, 22]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 22 }, walled: { x0: 0, z0: 4, x1: 30, z1: 22 }, zFlip: 22 }, zones: [['zone-max_z', { x0: 60, y0: 420, x1: 660, y1: 500 }]], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0'], recesses: ['FRONT:0'] },
  'porchPosts:id': { masses: [[0, 4, 30, 22]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 22 }, walled: { x0: 0, z0: 4, x1: 30, z1: 22 }, zFlip: 22 }, zones: [['zone-max_z', { x0: 60, y0: 420, x1: 660, y1: 500 }]], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0'], recesses: ['FRONT:0'] },
  'postsInStrip:id': { masses: [[0, 0.442, 30, 17.592]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 17.592 }, walled: { x0: 0, z0: 0.442, x1: 30, z1: 17.592 }, zFlip: 17.592 }, zones: [['zone-max_z', { x0: 60, y0: 403, x1: 660, y1: 420 }]], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0'], recesses: ['FRONT:0'] },
  'pergola:id': { masses: [[0, 4, 30, 22]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 22 }, walled: { x0: 0, z0: 4, x1: 30, z1: 22 }, zFlip: 22 }, zones: [['zone-max_z', { x0: 60, y0: 420, x1: 660, y1: 500 }]], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0'], recesses: ['FRONT:0'] },
  'carport:id': { masses: [[0, 5, 30, 23]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 23 }, walled: { x0: 0, z0: 5, x1: 30, z1: 23 }, zFlip: 23 }, zones: [['zone-max_z', { x0: 60, y0: 420, x1: 660, y1: 520 }]], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0'], recesses: ['FRONT:0'] },
  'entrance:id': { masses: [[0, 0, 16, 12]], world: { envelope: { x0: 0, z0: 0, x1: 16, z1: 12 }, walled: { x0: 0, z0: 0, x1: 16, z1: 12 }, zFlip: 12 }, zones: [], walls: 4, layoutRecesses: ['MAX_Z:11'], recessRegions: 1, ring: 'SOURCE_EXACT', terraces: [], recesses: [] },
  'entranceFacePair:id': { masses: [[0, 0.46, 16, 11.86]], world: { envelope: { x0: 0, z0: 0, x1: 16, z1: 11.86 }, walled: { x0: 0, z0: 0.46, x1: 16, z1: 11.86 }, zFlip: 11.86 }, zones: [['zone-max_z', { x0: 40, y0: 268, x1: 360, y1: 279.5 }]], walls: 4, layoutRecesses: ['MAX_Z:11'], recessRegions: 1, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0'], recesses: ['FRONT:0'] },
  'rearFacePair:id': { masses: [[0, 0, 30, 17.2]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 17.629 }, walled: { x0: 0, z0: 0, x1: 30, z1: 17.2 }, zFlip: 17.2 }, zones: [['zone-min_z', { x0: 60, y0: 59.5, x1: 660, y1: 76 }]], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-rear-0'], recesses: ['REAR:0'] },
  'facePair:mirrorX': { masses: [[0, 0.455, 30, 17.605]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 17.605 }, walled: { x0: 0, z0: 0.455, x1: 30, z1: 17.605 }, zFlip: 17.605 }, zones: [['zone-max_z', { x0: 100, y0: 403, x1: 700, y1: 420.5 }]], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0'], recesses: ['FRONT:0'] },
  'facePair:mirrorY': { masses: [[0, 0, 30, 18]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 18 }, walled: { x0: 0, z0: 0, x1: 30, z1: 18 }, zFlip: 18 }, zones: [], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: [], recesses: [] },
  'facePair:turn90': { masses: [[0, 0, 18, 30]], world: { envelope: { x0: 0, z0: 0, x1: 18, z1: 30 }, walled: { x0: 0, z0: 0, x1: 18, z1: 30 }, zFlip: 30 }, zones: [], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: [], recesses: [] },
  'facePair:turn270': { masses: [[0, 0, 17.15, 30]], world: { envelope: { x0: 0, z0: 0, x1: 17.605, z1: 30 }, walled: { x0: 0, z0: 0, x1: 17.15, z1: 30 }, zFlip: 30 }, zones: [['zone-max_x', { x0: 403, y0: 100, x1: 420.5, y1: 700 }]], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-east-0'], recesses: ['EAST:0'] },
  'rearFacePair:mirrorX': { masses: [[0, 0, 30, 17.2]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 17.629 }, walled: { x0: 0, z0: 0, x1: 30, z1: 17.2 }, zFlip: 17.2 }, zones: [['zone-min_z', { x0: 100, y0: 59.5, x1: 700, y1: 76 }]], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-rear-0'], recesses: ['REAR:0'] },
  'rearFacePair:mirrorY': { masses: [[0, 0.416, 30, 17.616]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 17.616 }, walled: { x0: 0, z0: 0.416, x1: 30, z1: 17.616 }, zFlip: 17.616 }, zones: [['zone-max_z', { x0: 60, y0: 524, x1: 660, y1: 540 }]], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0'], recesses: ['FRONT:0'] },
  'rearFacePair:turn90': { masses: [[0, 0, 17.2, 30]], world: { envelope: { x0: 0, z0: 0, x1: 17.616, z1: 30 }, walled: { x0: 0, z0: 0, x1: 17.2, z1: 30 }, zFlip: 30 }, zones: [['zone-max_x', { x0: 524, y0: 60, x1: 540, y1: 660 }]], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-east-0'], recesses: ['EAST:0'] },
  'rearStripFrontTerrace:id': { masses: [[0, 4, 30, 21.2]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 21.629 }, walled: { x0: 0, z0: 4, x1: 30, z1: 21.2 }, zFlip: 21.2 }, zones: [['zone-max_z', { x0: 60, y0: 420, x1: 660, y1: 500 }], ['zone-min_z', { x0: 60, y0: 59.5, x1: 660, y1: 76 }]], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0', 'terrace-rear-0'], recesses: ['FRONT:0', 'REAR:0'] },
  'ell:id': { masses: [[0, 0.455, 17, 17.605], [17, 8.105, 30, 17.605]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 17.605 }, walled: { x0: 0, z0: 0.455, x1: 30, z1: 17.605 }, zFlip: 17.605 }, zones: [['zone-max_z', { x0: 60, y0: 403, x1: 660, y1: 420.5 }]], walls: 9, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0'], recesses: ['FRONT:0'] },
  'stalls:id': { masses: [[0, 5, 30, 23]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 23 }, walled: { x0: 0, z0: 5, x1: 30, z1: 23 }, zFlip: 23 }, zones: [['zone-max_z', { x0: 60, y0: 420, x1: 660, y1: 520 }]], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0'], recesses: ['FRONT:0'] },
  'rearFacePair:turn270': { masses: [[0, 0, 17.2, 30]], world: { envelope: { x0: -0.429, z0: 0, x1: 17.2, z1: 30 }, walled: { x0: 0, z0: 0, x1: 17.2, z1: 30 }, zFlip: 30 }, zones: [['zone-min_x', { x0: 59.5, y0: 100, x1: 76, y1: 700 }]], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-west-0'], recesses: ['WEST:0'] },
  // 15. review round 1 (record.ts --extras)
  'twoBodies:id': { masses: [[0, 0.455, 17, 17.605], [17, 0.455, 30, 8.105]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 17.605 }, walled: { x0: 0, z0: 0.455, x1: 30, z1: 17.605 }, zFlip: 17.605 }, zones: [['zone-max_z', { x0: 60, y0: 403, x1: 660, y1: 420.5 }]], walls: 9, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0'], recesses: ['FRONT:0'], massBasis: ['MEASURED/MEASURED', 'MEASURED/MEASURED'], rings: ['SOURCE_EXACT', 'SOURCE_EXACT'], massFeatures: ['SOURCE_EXACT', 'SOURCE_EXACT'], terraceReach: [null] },
  'bodyBehind:id': { masses: [[0, 0.455, 30, 10.605], [0, 10.605, 17, 17.605]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 17.605 }, walled: { x0: 0, z0: 0.455, x1: 30, z1: 17.605 }, zFlip: 17.605 }, zones: [['zone-max_z', { x0: 60, y0: 403, x1: 660, y1: 420.5 }]], walls: 10, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0'], recesses: ['FRONT:0'], massBasis: ['MEASURED/SCALED', 'MEASURED/MEASURED'], rings: ['SOURCE_EXACT', 'SOURCE_EXACT'], massFeatures: ['SOURCE_EXACT', 'SOURCE_EXACT'], terraceReach: [null] },
  'facePairPlatform:id': { masses: [[0, 0.375, 30, 18.025]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 18.025 }, walled: { x0: 0, z0: 0.375, x1: 30, z1: 18.025 }, zFlip: 18.025 }, zones: [['zone-max_z', { x0: 60, y0: 413, x1: 660, y1: 420.5 }]], walls: 6, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0'], recesses: ['FRONT:0'], massBasis: ['MEASURED/MEASURED'], rings: ['SOURCE_EXACT'], massFeatures: ['SOURCE_EXACT'], terraceReach: [3.95] },
  'thinFrontFloating:id': { masses: [[0, 0.418, 30, 17.718]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 17.718 }, walled: { x0: 0, z0: 0.418, x1: 30, z1: 17.718 }, zFlip: 17.718 }, zones: [['zone-max_z', { x0: 60, y0: 406, x1: 660, y1: 425 }]], walls: 6, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0'], recesses: ['FRONT:0'], massBasis: ['MEASURED/MEASURED'], rings: ['SOURCE_EXACT'], massFeatures: ['SOURCE_EXACT'], terraceReach: [null] },
  'thinFrontFilled:id': { masses: [[0, 0.396, 30, 17.696]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 17.696 }, walled: { x0: 0, z0: 0.396, x1: 30, z1: 17.696 }, zFlip: 17.696 }, zones: [['zone-max_z', { x0: 60, y0: 406, x1: 660, y1: 424 }]], walls: 6, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0'], recesses: ['FRONT:0'], massBasis: ['MEASURED/MEASURED'], rings: ['SOURCE_EXACT'], massFeatures: ['SOURCE_EXACT'], terraceReach: [null] },
  'facePairAniso:id': { masses: [[0, 0.35, 30, 17.5]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 17.5 }, walled: { x0: 0, z0: 0.35, x1: 30, z1: 17.5 }, zFlip: 17.5 }, zones: [['zone-max_z', { x0: 60, y0: 403, x1: 660, y1: 420.5 }]], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0'], recesses: ['FRONT:0'], massBasis: ['MEASURED/MEASURED'], rings: ['SOURCE_EXACT'], massFeatures: ['SOURCE_EXACT'], terraceReach: [null] },
  'facePairAnisoTurned:turn270': { masses: [[0, 0, 17.15, 30]], world: { envelope: { x0: 0, z0: 0, x1: 17.5, z1: 30 }, walled: { x0: 0, z0: 0, x1: 17.15, z1: 30 }, zFlip: 30 }, zones: [['zone-max_x', { x0: 403, y0: 100, x1: 420.5, y1: 700 }]], walls: 5, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-east-0'], recesses: ['EAST:0'], massBasis: ['MEASURED/MEASURED'], rings: ['SOURCE_EXACT'], massFeatures: ['SOURCE_EXACT'], terraceReach: [null] },
  // 16. review round 2 (record.ts --extras)
  'ellPlatform:id': { masses: [[0, 0.375, 17, 18.025], [17, 8.525, 30, 18.025]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 18.025 }, walled: { x0: 0, z0: 0.375, x1: 30, z1: 18.025 }, zFlip: 18.025 }, zones: [['zone-max_z', { x0: 60, y0: 413, x1: 660, y1: 420.5 }]], walls: 10, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0'], recesses: ['FRONT:0'], massBasis: ['MEASURED/MEASURED', 'MEASURED/MEASURED'], rings: ['SOURCE_EXACT', 'SOURCE_EXACT'], massFeatures: ['SOURCE_EXACT', 'SOURCE_EXACT'], terraceReach: [3.95] },
  'ellPlatform:mirrorY': { masses: [[0, 0, 17, 18], [17, 0, 30, 9.5]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 18 }, walled: { x0: 0, z0: 0, x1: 30, z1: 18 }, zFlip: 18 }, zones: [], walls: 10, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: [], recesses: [], massBasis: ['MEASURED/MEASURED', 'MEASURED/MEASURED'], rings: ['SOURCE_EXACT', 'SOURCE_EXACT'], massFeatures: ['SOURCE_EXACT', 'SOURCE_EXACT'], terraceReach: [] },
  'ellPlatform:turn90': { masses: [[0, 13, 18, 30], [8.5, 0, 18, 13]], world: { envelope: { x0: 0, z0: 0, x1: 18, z1: 30 }, walled: { x0: 0, z0: 0, x1: 18, z1: 30 }, zFlip: 30 }, zones: [], walls: 10, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: [], recesses: [], massBasis: ['MEASURED/MEASURED', 'MEASURED/MEASURED'], rings: ['SOURCE_EXACT', 'SOURCE_EXACT'], massFeatures: ['SOURCE_EXACT', 'SOURCE_EXACT'], terraceReach: [] },
  'ellPlatform:turn270': { masses: [[0, 0, 17.65, 17], [0, 17, 9.5, 30]], world: { envelope: { x0: 0, z0: 0, x1: 18.025, z1: 30 }, walled: { x0: 0, z0: 0, x1: 17.65, z1: 30 }, zFlip: 30 }, zones: [['zone-max_x', { x0: 413, y0: 100, x1: 420.5, y1: 700 }]], walls: 10, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-east-0'], recesses: ['EAST:0'], massBasis: ['MEASURED/MEASURED', 'MEASURED/MEASURED'], rings: ['SOURCE_EXACT', 'SOURCE_EXACT'], massFeatures: ['SOURCE_EXACT', 'SOURCE_EXACT'], terraceReach: [3.95] },
  'rearFacePairPlatform:id': { masses: [[0, 0, 30, 17.7]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 18.025 }, walled: { x0: 0, z0: 0, x1: 30, z1: 17.7 }, zFlip: 17.7 }, zones: [['zone-min_z', { x0: 60, y0: 159.5, x1: 660, y1: 166 }]], walls: 6, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-rear-0'], recesses: ['REAR:0'], massBasis: ['MEASURED/MEASURED'], rings: ['SOURCE_EXACT'], massFeatures: ['SOURCE_EXACT'], terraceReach: [4] },
  'rearFacePairPlatform:mirrorY': { masses: [[0, 0.3, 30, 18]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 18 }, walled: { x0: 0, z0: 0.3, x1: 30, z1: 18 }, zFlip: 18 }, zones: [['zone-max_z', { x0: 60, y0: 434, x1: 660, y1: 440 }]], walls: 6, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0'], recesses: ['FRONT:0'], massBasis: ['MEASURED/MEASURED'], rings: ['SOURCE_EXACT'], massFeatures: ['SOURCE_EXACT'], terraceReach: [3.95] },
  'rearFacePairPlatform:turn270': { masses: [[0, 0, 17.7, 30]], world: { envelope: { x0: -0.325, z0: 0, x1: 17.7, z1: 30 }, walled: { x0: 0, z0: 0, x1: 17.7, z1: 30 }, zFlip: 30 }, zones: [['zone-min_x', { x0: 159.5, y0: 100, x1: 166, y1: 700 }]], walls: 6, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-west-0'], recesses: ['WEST:0'], massBasis: ['MEASURED/MEASURED'], rings: ['SOURCE_EXACT'], massFeatures: ['SOURCE_EXACT'], terraceReach: [4] },
  'facePairPlatform:mirrorY': { masses: [[0, 0, 30, 18]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 18 }, walled: { x0: 0, z0: 0, x1: 30, z1: 18 }, zFlip: 18 }, zones: [], walls: 6, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: [], recesses: [], massBasis: ['MEASURED/MEASURED'], rings: ['SOURCE_EXACT'], massFeatures: ['SOURCE_EXACT'], terraceReach: [] },
  'facePairPlatform:turn90': { masses: [[0, 0, 18, 30]], world: { envelope: { x0: 0, z0: 0, x1: 18, z1: 30 }, walled: { x0: 0, z0: 0, x1: 18, z1: 30 }, zFlip: 30 }, zones: [], walls: 6, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: [], recesses: [], massBasis: ['MEASURED/MEASURED'], rings: ['SOURCE_EXACT'], massFeatures: ['SOURCE_EXACT'], terraceReach: [] },
  'facePairPlatform:turn270': { masses: [[0, 0, 17.65, 30]], world: { envelope: { x0: 0, z0: 0, x1: 18.025, z1: 30 }, walled: { x0: 0, z0: 0, x1: 17.65, z1: 30 }, zFlip: 30 }, zones: [['zone-max_x', { x0: 413, y0: 100, x1: 420.5, y1: 700 }]], walls: 6, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-east-0'], recesses: ['EAST:0'], massBasis: ['MEASURED/MEASURED'], rings: ['SOURCE_EXACT'], massFeatures: ['SOURCE_EXACT'], terraceReach: [3.95] },
  'terraceZonePlatform:id': { masses: [[0, 4, 30, 22]], world: { envelope: { x0: 0, z0: 0, x1: 30, z1: 22 }, walled: { x0: 0, z0: 4, x1: 30, z1: 22 }, zFlip: 22 }, zones: [['zone-max_z', { x0: 60, y0: 420, x1: 660, y1: 500 }]], walls: 6, layoutRecesses: [], recessRegions: 0, ring: 'SOURCE_EXACT', terraces: ['terrace-front-0'], recesses: ['FRONT:0'], massBasis: ['MEASURED/MEASURED'], rings: ['SOURCE_EXACT'], massFeatures: ['SOURCE_EXACT'], terraceReach: [4] },
}

/**
 * Review round 2: the redraws on which the frozen solver does not finish. It builds the wall's poché as a recess floor
 * carried out to the outlined platform, and the emitter refuses that terrace's polygon (record.ts exits with this
 * error); production builds no terrace there, so it finishes. Recorded, not asserted against: there is no frozen
 * outcome to hold the frame to, so these runs assert production's own outcome (the faces, the platform, no terrace).
 */
const FROZEN_REFUSED: Record<string, string> = {
  'ellPlatform:mirrorX': 'MODEL_EMISSION_FAILED: terrace terrace-front-1300 polygon is not a simple polygon with area',
  'rearFacePairPlatform:mirrorX': 'MODEL_EMISSION_FAILED: terrace terrace-rear-0 polygon is not a simple polygon with area',
  'rearFacePairPlatform:turn90': 'MODEL_EMISSION_FAILED: terrace terrace-east-0 polygon is not a simple polygon with area',
  'facePairPlatform:mirrorX': 'MODEL_EMISSION_FAILED: terrace terrace-front-0 polygon is not a simple polygon with area',
}

const results = new Map<string, ReturnType<typeof reconstructV2>>()
const compiled = (name: FixtureName, t: Transform = 'id'): ReturnType<typeof reconstructV2> => {
  const key = `${name}:${t}`
  const hit = results.get(key)
  if (hit) return hit
  const r = compileFixture(reconstructV2, FIXTURES[name](), t)
  results.set(key, r)
  return r
}
const run = (name: FixtureName, t: Transform = 'id'): { o: Outcome; f: Frozen } => {
  const f = FROZEN[`${name}:${t}`]
  if (!f) throw new Error(`no frozen record for ${name}:${t}`)
  return { o: outcomeOf(compiled(name, t)), f }
}

/**
 * 005V-N2: versioned semantic deltas over the frozen record, one fixture and one redraw each. `FROZEN` stays the 005Q
 * base's historical outcome, untouched; an entry here says only that the current reader returns another wall count on
 * that exact fixture and redraw, why, and is held by its own structural test (family 12) — never by the count alone.
 *
 * 005U-N3 reads a wall as thick as the outer wall as a partition. On the 005N entrance, correctly registered (every
 * side of its body stands on drawn wall), that adds the five 12 px walls drawn round the recess and the garage, which
 * the frozen reader, capped at 0.72 of the outer wall, never saw: 4 walls then, 9 now.
 */
const N3_THICK_INTERIOR_WALLS_EXPECTED: Readonly<Record<string, { walls: number; why: string }>> = {
  'entrance:id': { walls: 9, why: '005U-N3: the five 12 px walls drawn round the recess and the garage are read as interior walls' },
}
/**
 * 005Y-N2: a recess lying inside the body's rectangle is built as a pocket in its face — a passage through the ring wall,
 * two returns and a back wall of its own. Where the reader built no partitions round it (a body standing off its drawn
 * walls), those three walls are new; where it did (`entrance:id`), they take the place of the partitions it read round
 * the recess, and the two that ran on past the recess stay partitions beyond it.
 */
const N2_POCKET_WALLS_EXPECTED: Readonly<Record<string, { walls: number; why: string }>> = {
  'entrance:id': { walls: 11, why: '005Y-N2: the recess is a pocket: its returns and back wall are its own, and the two partitions on the returns\' lines carry on past it' },
  'entranceFacePair:id': { walls: 7, why: '005Y-N2: the recess inside the body is a pocket: its two returns and its back wall are walls of their own' },
}
const frozenKeyOf = new Map<Frozen, string>(Object.entries(FROZEN).map(([k, v]) => [v, k]))
/** The wall count the current reader is held to: the frozen record's, unless this exact fixture and redraw has a versioned delta. */
const wallsExpected = (f: Frozen): number => {
  const key = frozenKeyOf.get(f)
  const delta = key === undefined ? undefined : (N2_POCKET_WALLS_EXPECTED[key] ?? N3_THICK_INTERIOR_WALLS_EXPECTED[key])
  return delta === undefined ? f.walls : delta.walls
}

/** What the frame is measured from is the frozen solver's, to the digit: the bodies, the world frame, the zones, the walls, the layout's recesses; no return is read. */
function frameAsFrozen(o: Outcome, f: Frozen): void {
  expect(o.masses).toEqual(f.masses)
  expect(o.world).toEqual(f.world)
  expect(o.zones).toEqual(f.zones)
  expect(o.modelWalls).toBe(wallsExpected(f))
  expect(o.layoutRecesses).toEqual(f.layoutRecesses)
  expect(o.recessRegions).toBe(f.recessRegions)
  expect(o.returns).toEqual([])
}

/** N1 fires: the face is named, the ring says the body was cut on a wall's inner face, no floor is read in the strip. */
function fires(o: Outcome, f: Frozen, side: Side): void {
  frameAsFrozen(o, f)
  // the frozen solver read a terrace in this strip and emitted the ring SOURCE_EXACT: that is what is being prevented
  expect(f.terraces).toHaveLength(1)
  expect(f.ring).toBe('SOURCE_EXACT')
  expect(o.outerFaces).toEqual([OUTER_FACE(side)])
  expect(o.ringStatus).toBe('SOURCE_DERIVED')
  const [x0, z0, x1, z1] = o.masses[0]
  expect(o.ringWhy).toBe(`${(x1 - x0).toFixed(2)} × ${(z1 - z0).toFixed(2)} m body cut on a wall's inner face; unresolved: ${OUTER_FACE(side)}`)
  expect(o.terraces).toEqual([])
  expect(o.modelTerraces).toBe(0)
  expect(o.recesses).toEqual([])
  // the span across the strip is not MEASURED: depth for a front or rear wall, width for a west or east one
  expect(o.massBasis).toEqual([side === 'front' || side === 'rear' ? 'MEASURED/DERIVED' : 'DERIVED/MEASURED'])
}

/** N1 does not fire: the outcome is the frozen solver's, whole. */
function holdsFrozen(o: Outcome, f: Frozen): void {
  frameAsFrozen(o, f)
  expect(o.outerFaces).toEqual([])
  expect(o.ringStatus).toBe(f.ring)
  expect(o.ringStatus).toBe('SOURCE_EXACT')
  expect(o.ringWhy).toMatch(/ m body from the plan's printed chains and wall bands$/)
  expect(o.terraces).toEqual(f.terraces)
  expect(o.modelTerraces).toBe(f.terraces.length)
  expect(o.recesses).toEqual(f.recesses)
  expect(o.massBasis).toEqual(['MEASURED/MEASURED'])
}

describe('005Q wall strip — 1. a face pair on the front wall', () => {
  it('the body cut on the front wall’s inner face: the face is named, the ring SOURCE_DERIVED, no terrace, no return (frozen: terrace-front-0, SOURCE_EXACT)', () => {
    const { o, f } = run('facePair')
    fires(o, f, 'front')
    expect(o.zones).toEqual([['zone-max_z', { x0: 60, y0: 403, x1: 660, y1: 420.5 }]])
  })

  it('the layout keeps the strip as its ZONE region, names an AMBIGUOUS gap for it and says so in the body’s why; the MASS feature is SOURCE_DERIVED', () => {
    const r = compiled('facePair')
    const gaps = r.layout.unresolved.filter((g) => g.what === OUTER_FACE('front'))
    expect(gaps).toHaveLength(1)
    expect(gaps[0].status).toBe('AMBIGUOUS')
    expect(gaps[0].id).toMatch(/^gap-outer-face-zone-max-z-/)
    expect(r.layout.footprintRegions.filter((g) => g.kind === 'ZONE').map((g) => g.id)).toEqual(['zone-max_z'])
    const [mass] = r.layout.masses
    expect(mass.why).toContain(gaps[0].id)
    expect(mass.depthM.why).toMatch(/one of them is a wall’s inner face$/)
    expect(r.building.masses[0].outerFacesOpen).toEqual([OUTER_FACE('front')])
    const massFeature = r.featureGraph.solved.find((x) => x.family === 'MASS')
    expect(massFeature?.provenance).toBe('SOURCE_DERIVED')
  })
})

describe('005Q wall strip — 2. the chains tick on the outer face only', () => {
  it('the body reaches the outer face: no zone, no gap, the ring SOURCE_EXACT (as frozen)', () => {
    const { o, f } = run('outerOnly')
    holdsFrozen(o, f)
    expect(o.zones).toEqual([])
    expect(o.masses).toEqual([[0, 0, 30, 18]])
  })
})

describe('005Q wall strip — 3. wall thickness', () => {
  it('a 10 px front wall (under 0.7 of the 18 px walls) cut on its inner face is no wall strip: no gap; the frozen terrace stays (a bound of the rule, recorded)', () => {
    const { o, f } = run('thinWall')
    holdsFrozen(o, f)
    expect(o.zones.map((z) => z[0])).toEqual(['zone-max_z'])
    expect(o.terraces).toEqual(['terrace-front-0'])
  })

  it('24 px walls at 0.019 m/px (a 23.7 px cell) reproduce the defect, and the rule fires on the thick wall', () => {
    const { o, f } = run('thickWalls')
    fires(o, f, 'front')
    expect(o.zones).toEqual([['zone-max_z', { x0: 60, y0: 397, x1: 660, y1: 420.5 }]])
  })
})

describe('005Q wall strip — 4. a pier in the strip', () => {
  it('a 40 px pier (shorter than 2.5 walls) in front of a wall whose outer face is the strip’s back: no gap, as frozen', () => {
    const { o, f } = run('shortPier')
    holdsFrozen(o, f)
    expect(o.zones.map((z) => z[0])).toEqual(['zone-max_z'])
  })

  it('a 120 px pier (long enough, but 20 % of the strip): no gap, as frozen', () => {
    const { o, f } = run('longPier')
    holdsFrozen(o, f)
    expect(o.zones.map((z) => z[0])).toEqual(['zone-max_z'])
  })
})

describe('005Q wall strip — 5. the face window', () => {
  it('every tick 0.2 px down: the band claim no longer ties, the body reaches the outer face, there is no strip to name (as frozen)', () => {
    const { o, f } = run('ticksDown')
    holdsFrozen(o, f)
    expect(o.zones).toEqual([])
  })

  it('every tick 0.2 px up: the strip moves by 0.2 px with them and the band’s faces stay on the same rows, so the decision is the one of family 1', () => {
    const { o, f } = run('ticksUp')
    fires(o, f, 'front')
    expect(o.zones).toEqual([['zone-max_z', { x0: 60, y0: 403.2, x1: 660, y1: 420.5 }]])
  })

  it('the wall thickened 9 px inward past the tick (27 px band, window 9.45 px): its inner face is 9 px off the strip’s edge and it fires', () => {
    const { o, f } = run('inward9')
    fires(o, f, 'front')
  })

  it('thickened 10 px inward (28 px band, window 9.8 px): 10 px off, outside the window, no gap; the frozen terrace stays', () => {
    const { o, f } = run('inward10')
    holdsFrozen(o, f)
    expect(o.terraces).toEqual(['terrace-front-0'])
  })
})

describe('005Q wall strip — 6. a garage door in the wall', () => {
  it('a 3 m door between piers in the strip’s wall: the band still covers the side, the rule fires and no terrace is read in the door’s stretch', () => {
    const { o, f } = run('garageDoor')
    fires(o, f, 'front')
  })

  it('the same door with the chains on the outer face only: no strip, no gap, no terrace, as frozen', () => {
    const { o, f } = run('garageDoorOuterOnly')
    holdsFrozen(o, f)
    expect(o.zones).toEqual([])
    expect(o.terraces).toEqual([])
  })
})

describe('005Q wall strip — 7. a stepped front', () => {
  it('the forward stretch’s band covers 25.7 % of the strip: the rule fires and no terrace is read along the niche', () => {
    const { o, f } = run('stepAbove')
    fires(o, f, 'front')
  })

  it('24 % of the strip: no gap, as frozen (the niche keeps the frozen terrace reading)', () => {
    const { o, f } = run('stepBelow')
    holdsFrozen(o, f)
    expect(o.terraces).toEqual(['terrace-front-0'])
  })
})

describe('005Q wall strip — 8. an open terrace beyond the front wall', () => {
  it('a 4 m outlined terrace: the zone stays a terrace, no gap, the ring SOURCE_EXACT, as frozen', () => {
    const { o, f } = run('openTerrace')
    holdsFrozen(o, f)
    expect(o.zones).toEqual([['zone-max_z', { x0: 60, y0: 420, x1: 660, y1: 500 }]])
    expect(o.terraces).toEqual(['terrace-front-0'])
    expect(o.masses).toEqual([[0, 4, 30, 22]])
  })
})

describe('005Q wall strip — 9. porch posts', () => {
  it('16 px posts on the terrace’s edge: no gap, the terrace stays, as frozen', () => {
    const { o, f } = run('porchPosts')
    holdsFrozen(o, f)
    expect(o.terraces).toEqual(['terrace-front-0'])
  })

  it('16 px posts in a 17 px strip in front of a wall whose outer face is the strip’s back: no gap, as frozen', () => {
    const { o, f } = run('postsInStrip')
    holdsFrozen(o, f)
    expect(o.zones.map((z) => z[0])).toEqual(['zone-max_z'])
  })
})

describe('005Q wall strip — 10. a pergola', () => {
  it('thin lines and two small posts beyond the front wall: no gap, the terrace reading as frozen', () => {
    const { o, f } = run('pergola')
    holdsFrozen(o, f)
    expect(o.terraces).toEqual(['terrace-front-0'])
  })
})

describe('005Q wall strip — 11. a carport', () => {
  it('two wall-thick side walls and an open mouth: no gap (the side walls cross the strip, they do not lie along it), the carport outside every mass, as frozen', () => {
    const { o, f } = run('carport')
    holdsFrozen(o, f)
    // the house's front is 5 m behind the carport's mouth (z = 0); no body reaches into the carport
    expect(o.masses).toEqual([[0, 5, 30, 23]])
    expect(o.masses.every(([, z0]) => z0 >= 5)).toBe(true)
  })
})

describe('005Q wall strip — 12. a recessed entrance with its back wall (005N)', () => {
  it('as 005N dimensions it: the recess stays a recess with both returns, no zone, no gap, as frozen', () => {
    const { o, f } = run('entrance')
    holdsFrozen(o, f)
    expect(o.layoutRecesses).toEqual(['MAX_Z:11'])
    expect(o.recessRegions).toBe(1)
  })

  it('005V-N2 / 005Y-N2: the walls over the frozen record answer exactly the five drawn 12 px walls round the recess and the garage — the recess\'s own three, and the partitions past it — and the body stands on its drawn walls', () => {
    // The fixture as drawn (`entrance()` in wall-strip-plans.ts): 12 px walls at 5 cm/px, the outer ring's west face at
    // column 40 and its front face at row 279, so world x = (column − 40) × 0.05 and z = (280 − row) × 0.05.
    const drawn: Array<{ name: string; axis: 'X' | 'Z'; rect: [number, number, number, number] }> = [
      { name: 'the recess’s west return', axis: 'Z', rect: [108, 150, 119, 279] },
      { name: 'the recess’s east return, between the recess and the garage', axis: 'Z', rect: [180, 150, 191, 279] },
      { name: 'the wall between the garage and the house', axis: 'Z', rect: [252, 150, 263, 279] },
      { name: 'the recess’s back wall (with its door)', axis: 'X', rect: [108, 228, 191, 239] },
      { name: 'the back wall of the garage and vestibule block', axis: 'X', rect: [108, 150, 263, 161] },
    ]
    // the evidence is on the sheet: every pixel of every drawn wall outside its doorways is ink
    const raster = render(FIXTURES.entrance().p, 'id')
    const ink = (x: number, y: number): boolean => raster.data[(y * raster.width + x) * 4] < 100
    const doorways = [[135, 155, 228, 239], [210, 225, 150, 161]]
    for (const d of drawn) {
      const [x0, y0, x1, y1] = d.rect
      for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) if (!doorways.some(([a, b, c, e]) => x >= a && x <= b && y >= c && y <= e)) expect(ink(x, y)).toBe(true)
    }
    const r = compiled('entrance')
    const wx = (c: number): number => (c - 40) * 0.05
    const wz = (row: number): number => (280 - row) * 0.05
    const interior = r.model.walls.filter((w) => w.kind === 'INTERIOR')
    // 005Y-N2: the recess is a pocket in the body's face; its returns and back wall are its own walls, each given by its
    // face towards the pocket
    const pocket = r.model.walls.filter((w) => w.id.includes('pocket-'))
    expect(pocket.map((w) => w.id).sort()).toEqual(['pocket-main-0-0-back', 'pocket-main-0-0-return-high', 'pocket-main-0-0-return-low'])
    const matchedBy = new Map<string, string>()
    for (const d of drawn) {
      const [x0, y0, x1, y1] = d.rect
      // the band the wall's ink occupies across its axis, and its span along it
      const band = d.axis === 'Z' ? [wx(x0), wx(x1 + 1)] : [wz(y1 + 1), wz(y0)]
      const span = d.axis === 'Z' ? [wz(y1 + 1), wz(y0)] : [wx(x0), wx(x1 + 1)]
      // 005Y-N2: a drawn wall on whose line the recess stands is answered by the recess's own wall and the partition that
      // carries on past it: at most two walls on its line, together along most of it
      const matches = [...interior, ...pocket].filter((w) => {
        const vertical = Math.abs(w.start.x - w.end.x) < 1e-6
        if (vertical !== (d.axis === 'Z')) return false
        const at = vertical ? w.start.x : w.start.z
        const [a, b] = vertical ? [Math.min(w.start.z, w.end.z), Math.max(w.start.z, w.end.z)] : [Math.min(w.start.x, w.end.x), Math.max(w.start.x, w.end.x)]
        const inBand = at >= band[0] - 0.05 && at <= band[1] + 0.05
        const withinSpan = a >= span[0] - 0.6 && b <= span[1] + 0.6
        return inBand && withinSpan && Math.min(b, span[1]) - Math.max(a, span[0]) >= 0.3
      })
      const along = (w: (typeof matches)[number]): [number, number] => (Math.abs(w.start.x - w.end.x) < 1e-6 ? [Math.min(w.start.z, w.end.z), Math.max(w.start.z, w.end.z)] : [Math.min(w.start.x, w.end.x), Math.max(w.start.x, w.end.x)])
      const covered = matches.reduce((sum, w) => sum + Math.max(0, Math.min(along(w)[1], span[1]) - Math.max(along(w)[0], span[0])), 0)
      expect(matches.length, d.name).toBeGreaterThanOrEqual(1)
      expect(matches.length, d.name).toBeLessThanOrEqual(2)
      // (a back wall stands between the returns: its drawn rectangle takes in their thickness at both ends)
      expect(covered, d.name).toBeGreaterThanOrEqual(0.7 * (span[1] - span[0]))
      for (const m of matches) {
        expect(matchedBy.has(m.id), `${m.id} answers two drawn walls`).toBe(false)
        matchedBy.set(m.id, d.name)
        expect(m.thickness).toBeCloseTo(0.6, 2)
      }
    }
    // no wall inside the ring that answers no drawn wall
    expect(interior.length + pocket.length).toBe(matchedBy.size)
    expect(r.model.walls.length).toBe(N2_POCKET_WALLS_EXPECTED['entrance:id'].walls)
    // correctly registered: no side of the body stands off its drawn walls (the 39 misregistered redraws all do)
    expect(r.unresolved.filter((u) => u.what.startsWith('wall-thick partitions'))).toEqual([])
    expect(compiled('facePair').unresolved.some((u) => u.what.startsWith('wall-thick partitions'))).toBe(true)
  })

  it('005V-N2: the versioned delta is this one fixture and redraw, and the historical record is untouched', () => {
    expect(Object.keys(N3_THICK_INTERIOR_WALLS_EXPECTED)).toEqual(['entrance:id'])
    expect(FROZEN['entrance:id'].walls).toBe(4)
    for (const t of TRANSFORMS.filter((x) => x !== 'id')) expect(N3_THICK_INTERIOR_WALLS_EXPECTED[`entrance:${t}`]).toBeUndefined()
    expect(N3_THICK_INTERIOR_WALLS_EXPECTED['entranceFacePair:id']).toBeUndefined()
    expect(Object.keys(N2_POCKET_WALLS_EXPECTED)).toEqual(['entrance:id', 'entranceFacePair:id'])
  })

  it('with an inner chain on the front wall’s inner face, cut there: the face is named and the strip carries no terrace, while the entrance stays a recess with both returns', () => {
    const { o, f } = run('entranceFacePair')
    fires(o, f, 'front')
    expect(o.layoutRecesses).toEqual(['MAX_Z:11'])
    expect(o.recessRegions).toBe(1)
  })
})

describe('005Q wall strip — 13. mirrored and turned', () => {
  // the inner tick two pixels short of the north wall's inner face: the cut on the inner face survives every redraw
  const rear: Record<Transform, Side> = { id: 'rear', mirrorX: 'rear', mirrorY: 'front', turn90: 'east', turn270: 'west' }
  for (const t of TRANSFORMS) {
    it(`the north-wall face pair, ${t}: the ${rear[t]} wall’s outer face is named, the ring SOURCE_DERIVED, no terrace (frozen: terrace-${rear[t]}-0)`, () => {
      const { o, f } = run('rearFacePair', t)
      fires(o, f, rear[t])
      expect(f.terraces).toEqual([`terrace-${rear[t]}-0`])
    })
  }

  // family 1 redrawn: the band claim's tie goes to the lower pixel, so mirrored top–bottom or turned 90° the body is
  // cut on the outer face in the first place — no strip, and the outcome is the frozen one
  const front: Record<Transform, Side | undefined> = { id: 'front', mirrorX: 'front', mirrorY: undefined, turn90: undefined, turn270: 'east' }
  for (const t of TRANSFORMS) {
    const side = front[t]
    it(`family 1, ${t}: ${side ? `the ${side} wall’s outer face is named` : 'no strip, as frozen'}`, () => {
      const { o, f } = run('facePair', t)
      if (side) fires(o, f, side)
      else {
        holdsFrozen(o, f)
        expect(o.zones).toEqual([])
      }
    })
  }
})

describe('005Q wall strip — 14. one side, one body, one direction (the mutation gates)', () => {
  it('a rear wall strip beside an open terrace beyond the front wall: the rear face is named and its floor goes, the front terrace stays (frozen: both terraces)', () => {
    const { o, f } = run('rearStripFrontTerrace')
    frameAsFrozen(o, f)
    expect(f.terraces).toEqual(['terrace-front-0', 'terrace-rear-0'])
    expect(o.outerFaces).toEqual([OUTER_FACE('rear')])
    expect(o.ringStatus).toBe('SOURCE_DERIVED')
    // a strip named as a wall on one side says nothing about a zone on another: the front terrace is a terrace
    expect(o.terraces).toEqual(['terrace-front-0'])
    expect(o.modelTerraces).toBe(1)
    expect(o.recesses).toEqual(['FRONT:0'])
    expect(o.massBasis).toEqual(['MEASURED/DERIVED'])
  })

  it('an L: only the body that stands on the strip’s back edge is open; the wing beside it, its south face 7.65 m short of the strip, stays MEASURED and SOURCE_EXACT (frozen: both exact, a terrace)', () => {
    const { o, f } = run('ell')
    frameAsFrozen(o, f)
    expect(f.terraces).toEqual(['terrace-front-0'])
    expect(o.outerFaces).toEqual([OUTER_FACE('front')])
    expect(o.terraces).toEqual([])
    expect(o.massBasis).toEqual(['MEASURED/DERIVED', 'MEASURED/MEASURED'])
    const r = compiled('ell')
    expect(r.building.masses.map((m) => [m.role, m.outerFacesOpen ?? []])).toEqual([
      ['MAIN', [OUTER_FACE('front')]],
      ['ATTACHED', []],
    ])
    expect(r.layout.masses.map((m) => openFacesOf(m, r.layout.unresolved).map((g) => g.what))).toEqual([[OUTER_FACE('front')], []])
    expect(r.featureGraph.solved.filter((x) => x.family === 'MASS').map((x) => x.provenance)).toEqual(['SOURCE_DERIVED', 'SOURCE_EXACT'])
  })

  it('nine wall-thick stall walls crossing a 5 m strip (27 % of its length in their thickness): they cross it, they do not lie along it — no gap, as frozen', () => {
    const { o, f } = run('stalls')
    holdsFrozen(o, f)
    expect(o.terraces).toEqual(['terrace-front-0'])
  })

  it('wall-thick pieces each shorter than 2.5 walls, covering 40 % of the strip, are no wall: handed to the pass through the sheet cache, they name no face', () => {
    // A raster rarely leaves such pieces apart (the band pass bridges an opening up to 90 px, and a pier on the wall's
    // face is no band of its own), so the length bound is held here at the seam a caller can hand the pass bands
    // through: six 40 px pieces on the strip's two edges, cut from the set-back wall's own band, beside the short pier.
    const fx = FIXTURES.shortPier()
    const options = fixtureOptions(fx)
    const sheet = planSheet(fixtureFrame(fx), options)
    if (!sheet) throw new Error('the plan did not decode')
    const wall = sheet.bands.find((b) => b.axis === 'HORIZONTAL' && b.bounds.y0 === 385)
    if (!wall) throw new Error('no set-back wall band')
    const pieces = [60, 160, 260, 380, 480, 580].map((x) => ({ ...wall, bounds: { x0: x, y0: 403, x1: x + 39, y1: 420 }, length: 40 }))
    const layout = (bands: typeof sheet.bands) => inferStructuralLayout({ ...options, sheetCache: new Map([[FRAME, { ...sheet, bands, decompositions: new Map() }]]) })
    const plain = layout(sheet.bands)
    const withPieces = layout([...sheet.bands, ...pieces])
    for (const d of [plain, withPieces]) {
      expect(d.unresolved.filter((g) => g.what.startsWith('the outer face of the building'))).toEqual([])
      expect(d.masses.map((m) => [m.widthM.basis, m.depthM.basis, openFacesOf(m, d.unresolved).length])).toEqual([['MEASURED', 'MEASURED', 0]])
      expect(d.footprintRegions.filter((r) => r.kind === 'ZONE').map((r) => [r.id, r.pixelRect])).toEqual([['zone-max_z', { x0: 60, y0: 403, x1: 660, y1: 420 }]])
    }
    // and the same pieces 45 px long (2.5 walls) are the wall
    const long = layout([...sheet.bands, ...pieces.map((b) => ({ ...b, bounds: { ...b.bounds, x1: b.bounds.x0 + 44 }, length: 45 }))])
    expect(long.unresolved.filter((g) => g.what.startsWith('the outer face of the building')).map((g) => g.what)).toEqual([OUTER_FACE('front')])
    expect(long.masses.map((m) => [m.widthM.basis, m.depthM.basis])).toEqual([['MEASURED', 'DERIVED']])
  })
})

describe('005Q wall strip — 15. review round 1', () => {
  const PLATFORM = 'the platform the plan outlines beyond the front wall'

  it('(a) two bodies on a stepped front: the house cut on its front wall’s inner face is open; the garage beside it, its own outer face on the envelope line and no wall ink in front of it, is not (frozen: both exact, a terrace)', () => {
    const { o, f } = run('twoBodies')
    frameAsFrozen(o, f)
    expect(f.terraces).toEqual(['terrace-front-0'])
    expect(f.rings).toEqual(['SOURCE_EXACT', 'SOURCE_EXACT'])
    expect(o.outerFaces).toEqual([OUTER_FACE('front')])
    expect(o.terraces).toEqual([])
    expect(o.modelTerraces).toBe(0)
    expect(o.recesses).toEqual([])
    const r = compiled('twoBodies')
    // both bodies' front sides lie on the strip's back edge (row 403): only the stretch the wall ink covers tells them apart
    expect(r.layout.footprintRegions.filter((g) => g.kind === 'BUILT').map((g) => g.pixelRect)).toEqual([
      { x0: 60, y0: 60, x1: 400, y1: 403 },
      { x0: 400, y0: 250, x1: 660, y1: 403 },
    ])
    // the house: open, its depth DERIVED, its ring and MASS feature SOURCE_DERIVED
    expect(o.massBasis[0]).toBe('MEASURED/DERIVED')
    expect(o.ringStatuses[0]).toBe('SOURCE_DERIVED')
    expect(o.massFeatures[0]).toBe('SOURCE_DERIVED')
    // the garage: as the frozen solver had it — its depth basis, its ring and its MASS feature
    expect(o.massBasis[1]).toBe(f.massBasis?.[1])
    expect(o.massBasis[1]).toBe('MEASURED/MEASURED')
    expect(o.ringStatuses[1]).toBe(f.rings?.[1])
    expect(o.massFeatures).toEqual(['SOURCE_DERIVED', f.massFeatures?.[1]])
    expect(o.massFeatures[1]).toBe('SOURCE_EXACT')
    expect(r.building.masses.map((m) => [m.role, m.outerFacesOpen ?? []])).toEqual([
      ['MAIN', [OUTER_FACE('front')]],
      ['ATTACHED', []],
    ])
    expect(r.layout.masses.map((m) => openFacesOf(m, r.layout.unresolved).map((g) => g.what))).toEqual([[OUTER_FACE('front')], []])
    expect(r.layout.masses[1].why).not.toMatch(/inner face/)
    expect(r.layout.masses[1].depthM.why).not.toMatch(/inner face/)
  })

  it('(b) a face pair and a platform outlined beyond the same wall: the face is named, the platform is named and not built, the ring SOURCE_DERIVED (frozen: the recess floor continued 3.95 m to the outline, SOURCE_EXACT)', () => {
    const { o, f } = run('facePairPlatform')
    fires(o, f, 'front')
    // the frozen solver built the wall's poché as a recess floor and carried it out to the outline
    expect(f.terraceReach).toEqual([3.95])
    expect(o.terraceReach).toEqual([])
    expect(o.platforms).toEqual([PLATFORM])
    const r = compiled('facePairPlatform')
    const named = r.unresolved.filter((u) => u.what === PLATFORM)
    expect(named).toHaveLength(1)
    expect(named[0].status).toBe('AMBIGUOUS')
    expect(named[0].reason).toMatch(/^an outline 3\.95 m out from the plan's extent \(a thin outline 3\.95 m out from the mouth spans 100 % of the facade \(0\.00\.\.30\.00\); /)
    expect(named[0].reason).toMatch(/lies beyond a wall the body was cut short of; it is not built: the wall's outer face it would start from is unresolved$/)
    // the outer face is named beside it, once
    expect(r.unresolved.filter((u) => u.what === OUTER_FACE('front')).map((u) => u.status)).toEqual(['AMBIGUOUS'])
    expect(r.model.terraces).toEqual([])
  })

  it('(b) no platform is named where nothing is outlined beyond the strip, nor beyond a zone that is no wall strip', () => {
    expect(outcomeOf(compiled('facePair')).platforms).toEqual([])
    expect(outcomeOf(compiled('rearStripFrontTerrace')).platforms).toEqual([])
  })

  it('(c) a 13 px front wall 6 px clear of its strip’s edges in all (19 px strip, window 5): no gap, the outcome is the frozen one, terrace and all', () => {
    const { o, f } = run('thinFrontFloating')
    holdsFrozen(o, f)
    expect(o.zones).toEqual([['zone-max_z', { x0: 60, y0: 406, x1: 660, y1: 425 }]])
    expect(o.terraces).toEqual(['terrace-front-0'])
    expect(o.ringStatuses).toEqual(f.rings)
    expect(o.massFeatures).toEqual(f.massFeatures)
  })

  it('(c) the same wall 5 px clear in all (18 px strip): inside the window, the rule fires', () => {
    const { o, f } = run('thinFrontFilled')
    fires(o, f, 'front')
    expect(o.zones).toEqual([['zone-max_z', { x0: 60, y0: 406, x1: 660, y1: 424 }]])
  })

  it('(d) the depth the gap states is the strip’s at the scale across it: 17.5 px × 0.02 m/px for a front strip under a 0.026 × 0.02 registration (the larger scale would say 0.46 m)', () => {
    const { o, f } = run('facePairAniso')
    fires(o, f, 'front')
    const gap = compiled('facePairAniso').layout.unresolved.find((g) => g.what === OUTER_FACE('front'))
    expect(gap?.reason).toMatch(/^wall-thick ink 0\.35 m deep fills the strip between the body and the plan's extent on its front side, along 94% of that side: the body stops on that wall's inner face \(the body's own wall, or another wall layer\); the wall's outer face is not resolved/)
  })

  it('(d) turned so the strip is the east one, under a 0.02 × 0.026 registration: the depth is at the x scale, 0.35 m', () => {
    const { o, f } = run('facePairAnisoTurned', 'turn270')
    fires(o, f, 'east')
    const gap = compiled('facePairAnisoTurned', 'turn270').layout.unresolved.find((g) => g.what === OUTER_FACE('east'))
    expect(gap?.reason).toMatch(/^wall-thick ink 0\.35 m deep fills the strip between the body and the plan's extent on its east side, along 94% of that side: the body stops on that wall's inner face \(the body's own wall, or another wall layer\); the wall's outer face is not resolved/)
  })
})

describe('005Q wall strip — 15. review round 1, the overlap bound', () => {
  // The garage of (a) is the body beside the cut wall; a raster rarely leaves a wall piece reaching a few pixels in
  // front of the next body, so the bound is held at the seam family 14 uses: 45 px pieces of the front wall's band in
  // the strip, reaching past the garage's side by a given number of pixels, handed to the pass through the sheet cache.
  // The modal wall here is 18 px (the bands are 18 px thick), so a body is open on the strip when the stretches the ink
  // covers run on in front of it for more than 18 px, counted once where pieces overlap (F1, review round 1).
  type Piece = { from: number; to: number }
  /** The layout of (a) drawn as given (`id`, the front strip) or turned (`turn270`, the same strip as the east one), with extra pieces of the strip's band. */
  const overlapScene = (t: 'id' | 'turn270') => {
    const fx = FIXTURES.twoBodies()
    const options = fixtureOptions(fx, t)
    const sheet = planSheet(fixtureFrame(fx, t), options)
    if (!sheet) throw new Error('the plan did not decode')
    const wall = sheet.bands.find((b) => (t === 'id' ? b.axis === 'HORIZONTAL' && b.bounds.y0 === 403 : b.axis === 'VERTICAL' && b.bounds.x0 === 403))
    if (!wall) throw new Error('no front wall band')
    // a piece of the strip's band over [from, to] along the strip (inclusive pixels, as the pass writes bounds)
    const band = ({ from, to }: Piece) => ({ ...wall, bounds: t === 'id' ? { x0: from, y0: 403, x1: to, y1: 420 } : { x0: 403, y0: from, x1: 420, y1: to }, length: to - from + 1 })
    const layout = (pieces: Piece[]) => inferStructuralLayout({ ...options, sheetCache: new Map([[FRAME, { ...sheet, bands: [...sheet.bands, ...pieces.map(band)], decompositions: new Map() }]]) })
    // the garage's side next to the house, and the piece reaching `reach` px past it into the garage's stretch
    const reaching = (reach: number): Piece => (t === 'id' ? { from: 356 + reach, to: 400 + reach } : { from: 360 - reach, to: 404 - reach })
    // a piece at the garage's far end, 14 px of it in front of the garage (the rest beyond the strip's end)
    const farEnd: Piece = t === 'id' ? { from: 646, to: 690 } : { from: 70, to: 114 }
    const face = OUTER_FACE(t === 'id' ? 'front' : 'east')
    const regions = t === 'id' ? [{ x0: 60, y0: 60, x1: 400, y1: 403 }, { x0: 400, y0: 250, x1: 660, y1: 403 }, { x0: 60, y0: 403, x1: 660, y1: 420.5 }] : [{ x0: 60, y0: 360, x1: 403, y1: 700 }, { x0: 250, y0: 100, x1: 403, y1: 360 }, { x0: 403, y0: 100, x1: 420.5, y1: 700 }]
    /** [the basis across the strip, the open faces] of the house and the garage. */
    const openOf = (d: ReturnType<typeof layout>) => d.masses.map((m) => [t === 'id' ? m.depthM.basis : m.widthM.basis, openFacesOf(m, d.unresolved).map((g) => g.what)])
    const expectOpen = (pieces: Piece[], garageOpen: boolean, label: string): void => {
      const d = layout(pieces)
      // the strip, the bodies and the frame are untouched by any piece: only the garage's open face may change
      expect(d.footprintRegions.filter((g) => g.kind !== 'ZONE' || g.id.startsWith('zone-')).map((g) => g.pixelRect), label).toEqual(regions)
      expect(d.unresolved.filter((g) => g.what.startsWith('the outer face of the building')).map((g) => g.what), label).toEqual([face])
      expect(openOf(d), label).toEqual([['DERIVED', [face]], garageOpen ? ['DERIVED', [face]] : ['MEASURED', []]])
    }
    return { reaching, farEnd, expectOpen }
  }

  it('(a) a body beside the covered stretch is open only when the wall ink runs on in front of it for more than a wall: 15 px no, 30 px yes (handed to the pass through the sheet cache)', () => {
    const { reaching, expectOpen } = overlapScene('id')
    expectOpen([], false, 'as drawn')
    expectOpen([reaching(15)], false, '15')
    expectOpen([reaching(30)], true, '30')
  })

  for (const t of ['id', 'turn270'] as const) {
    const where = t === 'id' ? 'the front strip' : 'turned 90° (turn270: the same strip drawn as the east one, the overlap taken along y)'
    it(`(a) review round 2 (R2A-6), ${where}: a reach of wallPx ± 2 — 16 px is not open, 20 px is`, () => {
      const { reaching, expectOpen } = overlapScene(t)
      expectOpen([], false, `${t} as drawn`)
      expectOpen([reaching(16)], false, `${t} 16`)
      expectOpen([reaching(20)], true, `${t} 20`)
    })

    it(`(a) review round 2 (R2A-6), ${where}: two pieces overlapping each other in front of the garage, 14 and 16 px into its stretch — the union is 16 px, the sum 30: not open (the stretches are merged before they are counted)`, () => {
      const { reaching, expectOpen } = overlapScene(t)
      expectOpen([reaching(14), reaching(16)], false, `${t} 14+16`)
      // either one alone, and both in the other order: the same
      expectOpen([reaching(16), reaching(14)], false, `${t} 16+14`)
      expectOpen([reaching(14)], false, `${t} 14`)
    })

    it(`(a) review round 2 (R2A-6), ${where}: two pieces at the garage's two ends, each 14 px into its stretch (less than a wall), together 28 px (more): open`, () => {
      const { reaching, farEnd, expectOpen } = overlapScene(t)
      expectOpen([farEnd], false, `${t} far end alone`)
      expectOpen([reaching(14), farEnd], true, `${t} both ends`)
    })
  }
})

describe('005Q wall strip — 15. review round 1, the bounds the fixes made redundant elsewhere', () => {
  it('(a) the face distance: a body over the covered stretch whose own face is 203 px short of the strip is not open (frozen: both exact, a terrace)', () => {
    // With the overlap now taken against the stretches the wall ink covers (F1), the L of family 14 no longer holds the
    // face-distance term: its wing stands beside the ink, not behind it. Here the body behind the open one stands over it.
    const { o, f } = run('bodyBehind')
    frameAsFrozen(o, f)
    expect(o.outerFaces).toEqual([OUTER_FACE('front')])
    expect(o.terraces).toEqual([])
    const r = compiled('bodyBehind')
    expect(r.layout.footprintRegions.filter((g) => g.kind === 'BUILT').map((g) => g.pixelRect)).toEqual([
      { x0: 60, y0: 60, x1: 400, y1: 200 },
      { x0: 60, y0: 200, x1: 660, y1: 403 },
    ])
    // the front slab (the widest body, its depth SCALED, so only its MASS feature and ring can show it) is open
    expect(r.layout.masses.map((m) => openFacesOf(m, r.layout.unresolved).map((g) => g.what))).toEqual([[OUTER_FACE('front')], []])
    expect(o.massFeatures).toEqual(['SOURCE_DERIVED', f.massFeatures?.[1]])
    expect(o.ringStatuses).toEqual(['SOURCE_DERIVED', f.rings?.[1]])
    // the body behind it, as frozen
    expect(o.massBasis).toEqual(f.massBasis)
    expect(o.massBasis[1]).toBe('MEASURED/MEASURED')
    expect(o.massFeatures[1]).toBe('SOURCE_EXACT')
  })

  it('(c) a block crossing the strip as deep as the strip, wall-thick both ways, is not the wall lying along it: two 96 × 99 px blocks in the carport’s 100 px strip name no face (handed to the pass through the sheet cache)', () => {
    // F2 bounds a band's thickness by the strip's depth, which already keeps out every band that crosses a strip and
    // is thinner than it is deep (family 14's stalls); a crossing band that passes it is a block about as wide as the
    // strip is deep. A raster draws that as a solid it does not split into bands this way, so it is held at the seam.
    const fx = FIXTURES.carport()
    const options = fixtureOptions(fx)
    const sheet = planSheet(fixtureFrame(fx), options)
    if (!sheet) throw new Error('the plan did not decode')
    const side = sheet.bands.find((b) => b.axis === 'VERTICAL' && b.bounds.x0 === 400 && b.bounds.y0 >= 420)
    if (!side) throw new Error('no carport side wall band')
    const block = (x0: number) => ({ ...side, bounds: { x0, y0: 421, x1: x0 + 95, y1: 519 }, thickness: 96, length: 99, axisPx: x0 + 47.5 })
    const layout = (bands: typeof sheet.bands) => inferStructuralLayout({ ...options, sheetCache: new Map([[FRAME, { ...sheet, bands, decompositions: new Map() }]]) })
    for (const d of [layout(sheet.bands), layout([...sheet.bands, block(100), block(220)])]) {
      expect(d.footprintRegions.filter((g) => g.kind === 'ZONE').map((g) => [g.id, g.pixelRect])).toEqual([['zone-max_z', { x0: 60, y0: 420, x1: 660, y1: 520 }]])
      expect(d.unresolved.filter((g) => g.what.startsWith('the outer face of the building'))).toEqual([])
      expect(d.masses.map((m) => [m.widthM.basis, m.depthM.basis])).toEqual([['MEASURED', 'MEASURED']])
    }
  })
})

describe('005Q wall strip — 16. review round 2, the platform probe (F4: R2A-1, R2A-2)', () => {
  const PLATFORM = (side: Side): string => `the platform the plan outlines beyond the ${side} wall`
  const platformGaps = (r: ReturnType<typeof reconstructV2>) => r.unresolved.filter((u) => u.what.startsWith('the platform the plan outlines'))
  /** The stretch of the facade the outline was read across, from the platform gap's reason ("… of the facade (a..b) …"). */
  const facadeSpan = (reason: string): [number, number] => {
    const m = /of the facade \((-?\d+\.\d+)\.\.(-?\d+\.\d+)\)/.exec(reason)
    if (!m) throw new Error(`no facade span in: ${reason}`)
    return [Number(m[1]), Number(m[2])]
  }
  /** The L as the frozen solver had it, where no strip is read: its whole outcome, both bodies. */
  const lAsFrozen = (o: Outcome, f: Frozen): void => {
    frameAsFrozen(o, f)
    expect(o.outerFaces).toEqual([])
    expect(o.platforms).toEqual([])
    expect(o.terraces).toEqual(f.terraces)
    expect(o.terraceReach).toEqual(f.terraceReach)
    expect(o.massBasis).toEqual(f.massBasis)
    expect(o.ringStatuses).toEqual(f.rings)
    expect(o.massFeatures).toEqual(f.massFeatures)
  }
  /** The L where the house is cut on its wall's inner face: the house open, the wing as it was, the platform named. */
  const lOpen = (o: Outcome, side: Side): void => {
    expect(o.outerFaces).toEqual([OUTER_FACE(side)])
    expect(o.terraces).toEqual([])
    expect(o.modelTerraces).toBe(0)
    expect(o.recesses).toEqual([])
    expect(o.returns).toEqual([])
    expect(o.terraceReach).toEqual([])
    expect(o.platforms).toEqual([PLATFORM(side)])
    expect(o.massBasis).toEqual([side === 'front' || side === 'rear' ? 'MEASURED/DERIVED' : 'DERIVED/MEASURED', 'MEASURED/MEASURED'])
    expect(o.ringStatuses).toEqual(['SOURCE_DERIVED', 'SOURCE_EXACT'])
    expect(o.massFeatures).toEqual(['SOURCE_DERIVED', 'SOURCE_EXACT'])
  }

  it('(a) an L whose wing stands nowhere near the cut wall, a platform outlined in front of the house only: the face and the platform are named, nothing is built (frozen: the recess floor carried 3.95 m out, both bodies exact)', () => {
    const { o, f } = run('ellPlatform')
    frameAsFrozen(o, f)
    expect(f.terraces).toEqual(['terrace-front-0'])
    expect(f.terraceReach).toEqual([3.95])
    expect(f.rings).toEqual(['SOURCE_EXACT', 'SOURCE_EXACT'])
    lOpen(o, 'front')
    const r = compiled('ellPlatform')
    expect(r.building.masses.map((m) => [m.role, m.outerFacesOpen ?? []])).toEqual([
      ['MAIN', [OUTER_FACE('front')]],
      ['ATTACHED', []],
    ])
    const [gap] = platformGaps(r)
    expect(gap.status).toBe('AMBIGUOUS')
    expect(gap.reason).toMatch(/^an outline 3\.95 m out from the plan's extent \(a thin outline 3\.95 m out from the mouth spans 100 % of the facade \(0\.00\.\.17\.00\); /)
    // the probe ran across the body standing on the strip's back (the house, x 0..17 m), not across the strip's 30 m:
    // the outline is 17 m long and would span 57 % of the strip, under the 85 % the reading wants
    const [a, b] = facadeSpan(gap.reason)
    expect(b - a).toBeGreaterThan(16.8)
    expect(b - a).toBeLessThan(17.2)
    expect(r.model.terraces).toEqual([])
  })

  it('(a) the L mirrored left–right (frozen: the emitter refuses the terrace it builds there) and turned 270° (the strip is the east one; frozen: terrace-east-0, 3.95 m): the platform is named on the side the wall is drawn on, read across the house', () => {
    expect(FROZEN_REFUSED['ellPlatform:mirrorX']).toMatch(/^MODEL_EMISSION_FAILED/)
    const mirrored = outcomeOf(compiled('ellPlatform', 'mirrorX'))
    lOpen(mirrored, 'front')
    expect(mirrored.masses).toEqual([[13, 0.375, 30, 18.025], [0, 8.525, 13, 18.025]])
    const [mg] = platformGaps(compiled('ellPlatform', 'mirrorX'))
    const [ma, mb] = facadeSpan(mg.reason)
    // the house is x 13..30 m now: the outline is read there
    expect(ma).toBeGreaterThan(12.8)
    expect(mb - ma).toBeLessThan(17.2)

    const { o, f } = run('ellPlatform', 'turn270')
    frameAsFrozen(o, f)
    expect(f.terraces).toEqual(['terrace-east-0'])
    expect(f.terraceReach).toEqual([3.95])
    lOpen(o, 'east')
    const [tg] = platformGaps(compiled('ellPlatform', 'turn270'))
    const [ta, tb] = facadeSpan(tg.reason)
    expect(tb - ta).toBeGreaterThan(16.8)
    expect(tb - ta).toBeLessThan(17.2)
  })

  it('(a) the L mirrored top–bottom and turned 90°: the band claim’s tie cuts the house on its wall’s outer face, so there is no strip and nothing is named — the frozen outcome, whole', () => {
    for (const t of ['mirrorY', 'turn90'] as const) {
      const { o, f } = run('ellPlatform', t)
      lAsFrozen(o, f)
      expect(o.zones).toEqual([])
    }
  })

  // the north wall's face pair under every redraw: the platform gap's side word follows the wall (all four words)
  const rear: Record<Transform, Side> = { id: 'rear', mirrorX: 'rear', mirrorY: 'front', turn90: 'east', turn270: 'west' }
  const words = new Set<string>()
  for (const t of TRANSFORMS) {
    const refused = FROZEN_REFUSED[`rearFacePairPlatform:${t}`]
    it(`(b) the north-wall face pair with a platform outlined beyond it, ${t}: the ${rear[t]} wall’s outer face and “${PLATFORM(rear[t])}” are named, nothing is built (frozen: ${refused ? 'the emitter refuses the terrace it builds' : `terrace-${rear[t]}-0 carried out to the outline`})`, () => {
      const r = compiled('rearFacePairPlatform', t)
      const o = outcomeOf(r)
      if (refused) {
        expect(refused).toMatch(/^MODEL_EMISSION_FAILED: terrace terrace-/)
        expect(o.outerFaces).toEqual([OUTER_FACE(rear[t])])
        expect(o.ringStatus).toBe('SOURCE_DERIVED')
        expect(o.terraces).toEqual([])
        expect(o.modelTerraces).toBe(0)
        expect(o.returns).toEqual([])
        expect(o.massBasis).toEqual([rear[t] === 'front' || rear[t] === 'rear' ? 'MEASURED/DERIVED' : 'DERIVED/MEASURED'])
      } else {
        const f = FROZEN[`rearFacePairPlatform:${t}`]
        if (!f) throw new Error(`no frozen record for rearFacePairPlatform:${t}`)
        fires(o, f, rear[t])
        expect(f.terraces).toEqual([`terrace-${rear[t]}-0`])
        expect(f.terraceReach?.[0]).toBeGreaterThan(3.9)
      }
      expect(o.terraceReach).toEqual([])
      expect(o.platforms).toEqual([PLATFORM(rear[t])])
      expect(platformGaps(r).map((g) => g.status)).toEqual(['AMBIGUOUS'])
      words.add(rear[t])
    })
  }
  it('(b) the five redraws name the platform with all four side words', () => {
    expect([...words].sort()).toEqual(['east', 'front', 'rear', 'west'])
  })

  it('(b) family 15 (b)’s face pair and platform redrawn: mirrored left–right the front platform, turned 270° the east one are named (frozen: the emitter refuses the terrace; terrace-east-0 carried 3.95 m out); mirrored top–bottom and turned 90° no strip, no platform, as frozen', () => {
    expect(FROZEN_REFUSED['facePairPlatform:mirrorX']).toMatch(/^MODEL_EMISSION_FAILED/)
    const mirrored = outcomeOf(compiled('facePairPlatform', 'mirrorX'))
    expect(mirrored.outerFaces).toEqual([OUTER_FACE('front')])
    expect(mirrored.ringStatus).toBe('SOURCE_DERIVED')
    expect(mirrored.terraces).toEqual([])
    expect(mirrored.platforms).toEqual([PLATFORM('front')])
    const { o, f } = run('facePairPlatform', 'turn270')
    fires(o, f, 'east')
    expect(f.terraceReach).toEqual([3.95])
    expect(o.platforms).toEqual([PLATFORM('east')])
    for (const t of ['mirrorY', 'turn90'] as const) {
      const { o: n, f: g } = run('facePairPlatform', t)
      holdsFrozen(n, g)
      expect(n.zones).toEqual([])
      expect(n.platforms).toEqual([])
    }
  })

  it('(c) a hatched platform outlined beyond a real terrace zone (no wall strip anywhere): the terrace carried 4 m out to it, as frozen; no face and no platform is named', () => {
    const { o, f } = run('terraceZonePlatform')
    holdsFrozen(o, f)
    expect(f.terraceReach).toEqual([4])
    expect(o.terraceReach).toEqual(f.terraceReach)
    expect(o.platforms).toEqual([])
    expect(o.zones).toEqual([['zone-max_z', { x0: 60, y0: 420, x1: 660, y1: 500 }]])
  })
})
