/**
 * The transcribed source truth of Dom w marcówkach (GE), in the REFERENCE
 * frame (+X east, +Z south; see transform.ts), each figure with the status
 * the reference research established for it and the drawing it was read
 * from. Nothing here is a coordinate BuildApp invented: every value traces to
 * a printed dimension, a raster measurement of a plan or section, or a
 * registered elevation render — and the status says which.
 *
 * `fact(key)` is the only way a number leaves this table, and a missing key
 * throws: a gold value can never silently become a default.
 */
import type { EvidenceStatus } from '@buildapp/model'
import { SRC, type SourceId } from './sources.js'

export type Fact = {
  value: number
  unit: 'm' | 'deg' | 'm2'
  status: EvidenceStatus
  sourceIds: readonly SourceId[]
  locator: string
  note?: string
}

const m = (value: number, status: EvidenceStatus, sourceIds: readonly SourceId[], locator: string, note?: string): Fact => ({ value, unit: 'm', status, sourceIds, locator, ...(note ? { note } : {}) })

export const FACTS = {
  // --- plan chains (ground plan) ---
  'plan.overallWidth': m(12.05, 'SOURCE_EXACT', [SRC.groundPlan, SRC.goldShell], 'top chain, printed 1205, outer wall faces', 'measured 457 px / 37.93 px/m = 12.05'),
  'plan.mainBodyWidth': m(7.9, 'SOURCE_EXACT', [SRC.groundPlan, SRC.goldShell], 'top chain, printed 790', '790 + 415 = 1205 closes the chain'),
  'plan.garageWidth': m(4.15, 'SOURCE_EXACT', [SRC.groundPlan, SRC.goldShell], 'top chain, printed 415'),
  'plan.overallDepth': m(12.6, 'SOURCE_EXACT', [SRC.groundPlan, SRC.goldShell], 'right chain, printed 1260 (510 + 750), rear wall face to front wall face', 'the walled envelope; the two printed 100 segments beyond it are the characteristic zones'),
  'plan.garageDepth': m(7.5, 'SOURCE_EXACT', [SRC.groundPlan, SRC.goldShell], 'right chain, printed 750'),
  'plan.rearZoneToGarage': m(5.1, 'SOURCE_EXACT', [SRC.groundPlan, SRC.goldShell], 'right chain, printed 510: rear wall face to the garage rear wall'),
  'wall.externalThickness': m(0.45, 'SOURCE_CORROBORATED', [SRC.section, SRC.groundPlan, SRC.goldShell], 'section fill 33 px = 0.455 m; plan fill 18 px = 0.475 m; 25 + 20 build-up', 'not printed as a figure anywhere'),
  'wall.partitionThickness': m(0.12, 'SOURCE_CORROBORATED', [SRC.groundPlan, SRC.atticPlan, SRC.goldInterior], 'every partition measures 0.106..0.132 m of ink on both plans; the printed chains close with 12 cm crossings'),
  'wall.boilerNorthThickness': m(0.26, 'SOURCE_CORROBORATED', [SRC.groundPlan, SRC.goldInterior], 'raster z 8.788..9.026 at three columns; the printed 312 closes on its south face'),
  'wall.returnThickness': m(0.61, 'SOURCE_DERIVED', [SRC.groundPlan, SRC.atticPlan, SRC.goldFacade], 'row scans past the walled envelope find 0.61 m of solid ink: x 0.000..0.636 and 11.441..12.050 (ground), 0.000..0.609 and 7.259..7.895 (attic)'),

  // --- levels (section) ---
  'level.terrain': m(-0.32, 'SOURCE_EXACT', [SRC.section, SRC.goldShell], 'datum marker −0,32, row 665'),
  'level.groundFfl': m(0, 'SOURCE_EXACT', [SRC.section, SRC.goldShell], 'datum marker ±0,00, row 642'),
  'level.upperFfl': m(3.06, 'SOURCE_EXACT', [SRC.section, SRC.goldShell], 'datum marker +3,06, row 420; the slab top'),
  'level.groundClearHeight': m(2.72, 'SOURCE_EXACT', [SRC.section, SRC.goldShell], 'vertical dimension 272'),
  'level.atticClearHeight': m(2.66, 'SOURCE_EXACT', [SRC.section, SRC.goldShell], 'vertical dimension 266 at the tall part of the room', 'recorded; not used as geometry'),
  'level.printedEave': m(4.67, 'SOURCE_EXACT', [SRC.section, SRC.goldShell], 'datum marker +4,67, row 303', 'the roof surface measured off the ink crosses the outer wall face at +4.64; the structural plane the model uses is level.eave'),
  'level.ridge': m(7.95, 'SOURCE_EXACT', [SRC.section, SRC.goldShell], 'datum marker +7,95, row 65'),
  'level.eave': m(4.63556, 'SOURCE_DERIVED', [SRC.section, SRC.goldShell], 'ridge 7.95 − half the 7.90 span × tan 40° = 4.63556', 'the value for which the printed span, pitch and ridge are simultaneously true; the printed +4,67 is 0.034 m higher'),
  'slab.upperThickness': m(0.33, 'SOURCE_DERIVED', [SRC.section, SRC.goldShell, SRC.goldRoof], 'upper slab fill rows 420..444 = 0.331 m; 3.06 − 2.72 = 0.34'),
  'wall.kneeWall': m(1.3, 'SOURCE_EXACT', [SRC.section, SRC.goldShell], 'vertical dimension 130, ticks at rows 325 and 420', 'top of the attic masonry at +4.36, the roof underside at the eave'),
  'building.height': m(8.27, 'SOURCE_EXACT', [SRC.facts, SRC.goldShell], 'published facts table, wysokość budynku', '7.95 + 0.32 = 8.27 exactly'),
  'footprint.area': { value: 131.16, unit: 'm2', status: 'SOURCE_EXACT', sourceIds: [SRC.facts, SRC.goldShell], locator: 'published facts table, powierzchnia zabudowy', note: 'the transcribed L is 7.90 × 12.60 + 4.15 × 7.50 = 130.665 m², 0.38 % below' },

  // --- roof (section, elevations) ---
  'roof.pitch': { value: 40, unit: 'deg', status: 'SOURCE_EXACT', sourceIds: [SRC.section, SRC.goldShell], locator: 'annotation 40° with a leader to the roof plane; least-squares fit of the right roof edge 40.014°' },
  'roof.buildUp': m(0.21109, 'SOURCE_DERIVED', [SRC.section, SRC.goldShell], 'the 0.27556 m between the derived eave plane 4.63556 and the printed knee-wall top 4.36, measured perpendicular to a 40° plane', 'makes the roof underside land exactly on the knee wall'),
  'roof.overhang': m(0, 'SOURCE_DERIVED', [SRC.section, SRC.atticPlan, SRC.goldShell], 'the section roof edge lands on the outer wall face at x = 128..129 px; the attic plan shows no verge'),
  'roof.extentFront': m(13.6, 'SOURCE_CORROBORATED', [SRC.elevEast, SRC.elevWest, SRC.goldFacade], 'roof and wall end together at both ends of the 14.60 m side silhouette; reference z 13.60'),
  'roof.extentRear': m(-1.0, 'SOURCE_CORROBORATED', [SRC.elevEast, SRC.elevWest, SRC.goldFacade], 'reference z −1.00'),
  'garage.clearHeight': m(2.52, 'SOURCE_EXACT', [SRC.section, SRC.goldShell], 'vertical dimension 252 in the garage'),
  'garage.roofTop': m(2.88, 'SOURCE_DERIVED', [SRC.section, SRC.goldShell], 'garage roof fill rows 433..458; row 433 = 2.879 m', 'the elevations measure the band top at 2.99..3.14: an unresolved ~0.2 m parapet'),
  'garage.roofThickness': m(0.34, 'SOURCE_DERIVED', [SRC.section, SRC.goldShell], '26 px = 0.358 m measured; 0.34 puts the soffit on the printed 252 clear height'),

  // --- recesses / returns / slabs / railings / portal (facade gold) ---
  'recess.frontOuterPlane': m(13.6, 'SOURCE_CORROBORATED', [SRC.groundPlan, SRC.elevEast, SRC.goldFacade], 'the printed 100 at the foot of the 100|510|750|100 column; row scans at z 12.8/13.1/13.4; the east silhouette 14.60 m'),
  'recess.frontBackPlane': m(12.6, 'SOURCE_EXACT', [SRC.groundPlan, SRC.goldFacade], 'the front wall face, end of the printed 1260'),
  'recess.frontFromX': m(0.61, 'SOURCE_DERIVED', [SRC.groundPlan, SRC.goldFacade], 'ink x 0.000..0.636 at z 12.8/13.1/13.4'),
  'recess.frontToX': m(11.44, 'SOURCE_DERIVED', [SRC.groundPlan, SRC.goldFacade], 'ink x 11.441..12.050'),
  'recess.rearOuterPlane': m(-1.0, 'SOURCE_CORROBORATED', [SRC.groundPlan, SRC.atticPlan, SRC.goldFacade], 'the printed 100 at the head of the same column; ink only at x 0.000..0.636 and 7.259..7.895 at z −0.3/−0.6/−0.9 on both plans'),
  'recess.rearBackPlane': m(0, 'SOURCE_EXACT', [SRC.groundPlan, SRC.goldFacade], 'the rear wall face, start of the printed 1260'),
  'recess.rearFromX': m(0.61, 'SOURCE_DERIVED', [SRC.groundPlan, SRC.atticPlan, SRC.goldFacade], 'ink x 0.000..0.636'),
  'recess.rearToX': m(7.29, 'SOURCE_DERIVED', [SRC.groundPlan, SRC.atticPlan, SRC.goldFacade], 'ink x 7.283..7.892 (ground) / 7.259..7.895 (attic)'),
  'return.eastFrontBase': m(2.96, 'SOURCE_DERIVED', [SRC.groundPlan, SRC.atticPlan, SRC.elevFront, SRC.goldFacade], 'the ground plan has no ink at x 7.283..7.892 in the front zone while the attic plan does: the east front return exists only above the balcony slab; the front elevation reads dark to 3.030 then white to 4.631 at x 7.60'),
  'return.garageTop': m(3.08, 'VISUAL_INFERRED', [SRC.elevFront, SRC.goldFacade], 'the dark band top 3.081 at x 9.50 and 3.097 at x 11.80'),
  'balcony.frontFromX': m(3.338, 'SOURCE_DERIVED', [SRC.atticPlan, SRC.goldFacade], 'the 0.026 m edge line at x 3.338 found at z 12.8, 13.1, 13.4 and 13.5', 'the front elevation puts it at 3.19; the plan is taken and the 0.15 m is left standing'),
  'balcony.frontToX': m(7.9, 'SOURCE_DERIVED', [SRC.atticPlan, SRC.goldFacade], 'the slab reaches the east return it carries'),
  'balcony.top': m(2.96, 'VISUAL_INFERRED', [SRC.elevRear, SRC.goldFacade], 'rear elevation at x 1.5..2.5: fascia 2.41..2.96, balustrade base rail 2.96..3.02'),
  'balcony.thickness': m(0.55, 'VISUAL_INFERRED', [SRC.elevRear, SRC.goldFacade], 'fascia 2.41..2.96 on the rear elevation; the plans dimension neither'),
  'portal.headTop': m(3.08, 'VISUAL_INFERRED', [SRC.elevFront, SRC.elevEast, SRC.elevRear, SRC.goldFacade], 'front 3.081 / 3.097, east 3.06..3.14, rear 2.99; 3.08 taken'),
  'portal.headThickness': m(0.67, 'VISUAL_INFERRED', [SRC.elevFront, SRC.goldFacade], 'soffit at the balcony soffit 2.41, top 3.08'),
  'railing.height': m(0.9, 'VISUAL_INFERRED', [SRC.elevFront, SRC.elevRear, SRC.goldFacade], 'glass 3.13..3.89 (front) and top 3.85 (rear) over a 2.96 slab', 'below what a balustrade is normally built to; unresolved'),
  'railing.frontLine': m(13.575, 'SOURCE_DERIVED', [SRC.atticPlan, SRC.goldFacade], 'the balustrade line at z 13.55 on the attic plan'),
  'railing.frontFromX': m(3.444, 'SOURCE_DERIVED', [SRC.atticPlan, SRC.goldFacade], 'first post mark x 3.444..3.497'),
  'railing.frontToX': m(7.153, 'SOURCE_DERIVED', [SRC.atticPlan, SRC.goldFacade], 'last post mark x 7.126..7.153; four equal 0.821 m panels'),
  'railing.rearLine': m(-0.88, 'SOURCE_DERIVED', [SRC.atticPlan, SRC.goldFacade], 'the balustrade line at z −0.88'),
  'railing.rearFromX': m(0.689, 'SOURCE_DERIVED', [SRC.atticPlan, SRC.goldFacade], 'first post mark x 0.689..0.768'),
  'railing.rearToX': m(7.153, 'SOURCE_DERIVED', [SRC.atticPlan, SRC.goldFacade], 'last post mark x 7.126..7.153; four 1.48..1.51 m panels'),

  // --- chimneys and rooflights (roof-features gold) ---
  'chimney.top': m(7.88, 'VISUAL_INFERRED', [SRC.elevFront, SRC.elevRear, SRC.goldRoof], 'cap at y 7.883 (front) and 7.882 (rear) against a ridge measured 7.951 / 7.950'),
  'chimney.base': m(3.06, 'SOURCE_DERIVED', [SRC.atticPlan, SRC.goldRoof], 'both blocks drawn standing on the attic floor'),
  'rooflight.width': m(0.78, 'SOURCE_EXACT', [SRC.atticPlan, SRC.goldRoof], 'printed 78/118: 78 across the slope'),
  'rooflight.slopeLength': m(1.18, 'SOURCE_EXACT', [SRC.atticPlan, SRC.goldRoof], 'printed 78/118: 118 up the slope'),
  'rooflight.lowerEdgeFromEave': m(0.45, 'SOURCE_CORROBORATED', [SRC.atticPlan, SRC.elevWest, SRC.goldRoof], 'each dashed symbol begins at the external wall inner face (px 64..65 west, 328 east); the west elevation frame lower edge at y 4.81..5.03 against 5.013 predicted'),
} as const satisfies Record<string, Fact>

export type FactKey = keyof typeof FACTS

/** The value of one transcribed fact; a missing key throws rather than defaulting. */
export function fact(key: FactKey): number {
  const f = (FACTS as Record<string, Fact>)[key]
  if (!f) throw new Error(`no transcribed fact "${key}"`)
  return f.value
}

export const factRecord = (key: FactKey): Fact => (FACTS as Record<string, Fact>)[key]

/** Statuses of the facts a value depends on, reduced to the weakest (for derived values). */
const RANK: EvidenceStatus[] = ['SOURCE_EXACT', 'SOURCE_CORROBORATED', 'SOURCE_DERIVED', 'GEOMETRIC_INFERRED', 'VISUAL_INFERRED', 'ASSUMED', 'UNRESOLVED']
export const weakest = (...statuses: EvidenceStatus[]): EvidenceStatus => statuses.reduce((a, b) => (RANK.indexOf(b) > RANK.indexOf(a) ? b : a), 'SOURCE_EXACT')
