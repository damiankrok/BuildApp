/**
 * Registered elevation readings for the facade comparison harness.
 *
 * The four published elevations are renders. The reference research
 * registered each by two anchors per axis (`method.elevationCalibration` of
 * the facade gold) and read feature edges off them by material class at
 * stated rows and columns; the same registration reproduces on the 1280 px
 * renders the current page serves (re-read in this stage with the same
 * procedure: `scripts/elevation-measure.ts` of the reference repository).
 * Every reading is a VISUAL_INFERRED figure in the reference frame (x east,
 * y up, z south); the harness projects the compiled model orthographically
 * into the same view and reports the difference per feature.
 *
 * Nothing here is a pixel: the readings are metres, and the calibration is
 * recorded so that a reader can go back to the asset and check.
 */
export type Facade = 'FRONT' | 'REAR' | 'EAST' | 'WEST'

export type ElevationCalibration = {
  facade: Facade
  assetId: string
  /** Pixel of across = 0 and signed px/m (negative when the axis runs leftwards in the image). */
  acrossZeroPx: number
  acrossPxPerM: number
  /** Pixel of y = 0 and px/m upwards. */
  upZeroPx: number
  upPxPerM: number
  /** Which model axis runs across the image, and its sense (+1: increases to the right). */
  acrossAxis: 'x' | 'z'
  acrossSense: 1 | -1
  width: number
  height: number
}

export const ELEVATION_CALIBRATIONS: readonly ElevationCalibration[] = [
  { facade: 'FRONT', assetId: 'asset_3c991e46a7e7 (page: elewacja-frontowa …__11264)', acrossZeroPx: 376, acrossPxPerM: 59.34, upZeroPx: 572.8, upPxPerM: 59.34, acrossAxis: 'x', acrossSense: 1, width: 1280, height: 597 },
  { facade: 'REAR', assetId: 'asset_863c2909651e (page: elewacja-ogrodowa …__11267)', acrossZeroPx: 970, acrossPxPerM: -58.73, upZeroPx: 568.9, upPxPerM: 58.73, acrossAxis: 'x', acrossSense: -1, width: 1280, height: 598 },
  { facade: 'EAST', assetId: 'asset_fcb1602240db (page: elewacja-boczna …__11265)', acrossZeroPx: 212 + 13.6 * 58.9, acrossPxPerM: -58.9, upZeroPx: 577, upPxPerM: 58.9, acrossAxis: 'z', acrossSense: -1, width: 1280, height: 597 },
  { facade: 'WEST', assetId: 'asset_3915ee416ac4 (page: elewacja-boczna …__11266)', acrossZeroPx: 217 + 58.9, acrossPxPerM: 58.9, upZeroPx: 575, upPxPerM: 58.9, acrossAxis: 'z', acrossSense: 1, width: 1280, height: 598 },
]

/**
 * One feature read off an elevation. `across` / `up` are the coordinate(s)
 * the reading fixes, in the reference frame (z is reference z, south
 * positive; the harness transforms it). `kind` names what the model side
 * measures against it; `tolerance` is the reading's own uncertainty (about
 * five pixels at 59 px/m for an edge in a render, more where a shadow or a
 * frame blurs it).
 */
export type ElevationFeature = {
  id: string
  facade: Facade
  group: 'SILHOUETTE' | 'ROOF' | 'RECESS' | 'OPENING' | 'RAKED_OPENING' | 'BALCONY' | 'PORTAL' | 'RAILING' | 'SURFACE_REGION' | 'RETURN' | 'CHIMNEY' | 'ROOFLIGHT'
  what: string
  /** Where on the render the reading was taken. */
  at: string
  across?: [number, number]
  up?: [number, number]
  /** A single vertex reading: across and up together. */
  point?: { across: number; up: number }
  tolerance: number
  /** Which authority the model follows for this feature. */
  authority: 'PRINTED_DIMENSION' | 'PLAN_RASTER' | 'SECTION_DATUM' | 'ELEVATION_READING' | 'NOT_MODELLED'
  /** The model feature the harness measures: an object id plus what to take from it. */
  model: { objectId: string; measure: 'OPENING_SPAN' | 'OPENING_HEIGHTS' | 'GLASS_SPAN' | 'BOUNDS_ACROSS' | 'BOUNDS_UP' | 'WALL_TOP_AT' | 'ROOF_TOP_AT' | 'REGION_ACROSS' | 'REGION_TOP' | 'RIDGE' | 'NONE'; at?: number }
  note?: string
}

export const ELEVATION_FEATURES: readonly ElevationFeature[] = [
  // ---- FRONT --------------------------------------------------------------
  { id: 'front-silhouette-across', facade: 'FRONT', group: 'SILHOUETTE', what: 'building silhouette across, west return to garage return', at: 'row y 1.2: white from x 0.000, dark to 12.066', across: [0, 12.05], tolerance: 0.08, authority: 'PRINTED_DIMENSION', model: { objectId: '*', measure: 'BOUNDS_ACROSS' } },
  { id: 'front-ridge', facade: 'FRONT', group: 'ROOF', what: 'ridge height', at: 'chimney caps read against a ridge at 7.951', up: [7.951, 7.951], tolerance: 0.05, authority: 'SECTION_DATUM', model: { objectId: 'roof-main', measure: 'RIDGE' } },
  { id: 'front-eave-corner', facade: 'FRONT', group: 'ROOF', what: 'roof corner at the west eave (top of the roof edge at x 0)', at: 'the roof corner at px 292 (4.732 m); the printed +4,67 predicts px 295.7', up: [4.732, 4.732], tolerance: 0.1, authority: 'SECTION_DATUM', model: { objectId: 'roof-main', measure: 'ROOF_TOP_AT', at: 0.0 }, note: 'the model uses the derived eave plane 4.63556; the printed +4,67 and the render’s 4.73 are recorded contradictions (ledger eave-datum)' },
  { id: 'front-west-return-top', facade: 'FRONT', group: 'RETURN', what: 'west return, white face top at x 0.30', at: 'column x 0.30: white −0.003..4.783', up: [4.783, 4.783], tolerance: 0.1, authority: 'SECTION_DATUM', model: { objectId: 'ret-west-front', measure: 'WALL_TOP_AT', at: 0.3 }, note: 'the render’s white includes the roof edge band above the soffit' },
  { id: 'front-east-return-top', facade: 'FRONT', group: 'RETURN', what: 'east return above the balcony: its top at x 7.60 (its base 3.047 is hidden by the balustrade base rail over the 2.96 slab)', at: 'column x 7.60: dark to 3.030, white 3.047..4.648', up: [4.648, 4.648], tolerance: 0.08, authority: 'SECTION_DATUM', model: { objectId: 'ret-east-front', measure: 'WALL_TOP_AT', at: 7.6 } },
  { id: 'front-room-window', facade: 'FRONT', group: 'OPENING', what: 'front room window 110/230: the glass inside the frame', at: 'row y 1.2: dark glass x 1.500..2.326; column x 1.9: glass head 2.29', across: [1.5, 2.326], up: [2.29, 2.29], tolerance: 0.1, authority: 'PRINTED_DIMENSION', model: { objectId: 'og-front-room-window-glazing', measure: 'GLASS_SPAN' }, note: 'the render shows the glass inside the frame; the model’s pane is the printed 110 opening less its 0.07 frame' },
  { id: 'front-entrance', facade: 'FRONT', group: 'OPENING', what: 'entrance leaf + sidelight 105/210', at: 'row y 0.5: leaf x 4.196..4.735, glass 4.853..5.174', across: [4.196, 5.174], up: [0, 2.1], tolerance: 0.08, authority: 'PRINTED_DIMENSION', model: { objectId: 'og-front-entrance', measure: 'OPENING_SPAN' } },
  { id: 'front-entrance-sidelight', facade: 'FRONT', group: 'OPENING', what: 'entrance sidelight glass, east side of the leaf', at: 'row y 0.5: glass x 4.853..5.174 (0.645..0.95 of the width); the facade gold reads 0.76..1.00', across: [4.853, 5.174], tolerance: 0.12, authority: 'ELEVATION_READING', model: { objectId: 'og-front-entrance-leaf', measure: 'REGION_ACROSS' } },
  { id: 'front-garage-door', facade: 'FRONT', group: 'OPENING', what: 'garage door reveal 275/225', at: 'row y 0.5: reveal x 8.460..11.274; head 2.270', across: [8.46, 11.274], up: [0, 2.27], tolerance: 0.08, authority: 'PRINTED_DIMENSION', model: { objectId: 'og-garage-door', measure: 'OPENING_SPAN' }, note: 'the render’s reveal sits 0.10 m west of the plan’s measured gap 8.554..11.308 (printed 275, chain-consistent); the plan is taken (ledger garage-door-position)' },
  { id: 'front-gable-glazing-mullion', facade: 'FRONT', group: 'RAKED_OPENING', what: 'front gable glazing, mullion break', at: 'rows y 4.30 and 5.00: break at x 4.95', across: [4.95, 4.95], tolerance: 0.08, authority: 'ELEVATION_READING', model: { objectId: 'og-front-gable-glazing-glazing', measure: 'REGION_ACROSS' } },
  { id: 'front-gable-glazing-head', facade: 'FRONT', group: 'RAKED_OPENING', what: 'front gable glazing, glass top at x 5.3', at: 'column x 5.3: glass 3.923..4.934, timber above from 5.05', up: [4.934, 4.934], tolerance: 0.1, authority: 'PRINTED_DIMENSION', model: { objectId: 'og-front-gable-glazing', measure: 'OPENING_HEIGHTS', at: 5.3 }, note: 'the printed 270/320 callout puts the head at x 5.3 at 3.06 + 3.20 − 1.36 × tan 40° = 5.12; the render reads 0.19 lower (ledger gable-head-clearance)' },
  { id: 'front-balcony-west-edge', facade: 'FRONT', group: 'BALCONY', what: 'front balcony, west edge (dark band begins)', at: 'row y 2.7: dark from x 3.236', across: [3.236, 3.236], tolerance: 0.08, authority: 'PLAN_RASTER', model: { objectId: 'balcony-front', measure: 'BOUNDS_ACROSS' }, note: 'the attic plan’s edge line at 3.338 is taken; the 0.10..0.15 m difference is a recorded contradiction (ledger balcony-west-edge)' },
  { id: 'front-balcony-fascia', facade: 'FRONT', group: 'BALCONY', what: 'front balcony fascia top / balustrade base', at: 'column x 5.3: dark to 3.013, glass from 3.131', up: [2.41, 3.013], tolerance: 0.08, authority: 'ELEVATION_READING', model: { objectId: 'balcony-front', measure: 'BOUNDS_UP' } },
  { id: 'front-portal-head', facade: 'FRONT', group: 'PORTAL', what: 'portal head, top of the dark band over the garage door', at: 'columns x 9.5 / 11.8: dark to 3.081 / 3.097', up: [2.41, 3.081], tolerance: 0.06, authority: 'ELEVATION_READING', model: { objectId: 'portal-head', measure: 'BOUNDS_UP' } },
  { id: 'front-railing-glass', facade: 'FRONT', group: 'RAILING', what: 'front balustrade glass', at: 'columns x 4.7 / 5.3: glass 3.097..3.889 / 3.131..3.889', up: [3.13, 3.889], tolerance: 0.08, authority: 'ELEVATION_READING', model: { objectId: 'rail-front', measure: 'BOUNDS_UP' } },
  { id: 'front-timber-band', facade: 'FRONT', group: 'SURFACE_REGION', what: 'timber band on the recessed front wall', at: 'rows y 0.5 / 1.2 / 2.7: timber x 0.657..3.185', across: [0.657, 3.185], tolerance: 0.06, authority: 'ELEVATION_READING', model: { objectId: 'sr-front-timber-ground', measure: 'REGION_ACROSS' } },
  { id: 'front-timber-gable', facade: 'FRONT', group: 'SURFACE_REGION', what: 'timber band up the front gable, to the glazing', at: 'rows y 4.0 / 4.5 / 5.0 / 5.5 / 6.0: timber to x 3.927, glass from 4.061; the west edge 0.657 is read at y 3.2 / 3.6 (the roof edge band hides it higher up)', across: [0.657, 3.927], tolerance: 0.08, authority: 'ELEVATION_READING', model: { objectId: 'sr-front-timber-gable', measure: 'REGION_ACROSS' }, note: 'the band is modelled to the printed jamb 3.94; the render’s timber stops 0.013 short of it at the frame' },
  // ---- REAR ---------------------------------------------------------------
  { id: 'rear-silhouette-across', facade: 'REAR', group: 'SILHOUETTE', what: 'silhouette across, west return to garage east wall', at: 'row y 1.2: white from x 0.630, dark to 12.089', across: [0, 12.05], tolerance: 0.08, authority: 'PRINTED_DIMENSION', model: { objectId: '*', measure: 'BOUNDS_ACROSS' } },
  { id: 'rear-ridge', facade: 'REAR', group: 'ROOF', what: 'ridge height', at: 'chimney caps against a ridge at 7.950', up: [7.95, 7.95], tolerance: 0.05, authority: 'SECTION_DATUM', model: { objectId: 'roof-main', measure: 'RIDGE' } },
  { id: 'rear-west-return-top', facade: 'REAR', group: 'RETURN', what: 'west rear return, white face top at x 0.30', at: 'column x 0.30: white −0.087..4.749', up: [4.749, 4.749], tolerance: 0.1, authority: 'SECTION_DATUM', model: { objectId: 'ret-west-rear', measure: 'WALL_TOP_AT', at: 0.3 }, note: 'as on the front: the render’s white includes the roof edge band' },
  { id: 'rear-east-return-top', facade: 'REAR', group: 'RETURN', what: 'east rear return, white face top at x 7.60', at: 'column x 7.60: white to 4.715', up: [4.715, 4.715], tolerance: 0.1, authority: 'SECTION_DATUM', model: { objectId: 'ret-east-rear', measure: 'WALL_TOP_AT', at: 7.6 } },
  { id: 'rear-living-glazing', facade: 'REAR', group: 'OPENING', what: 'rear living glazing 470/230', at: 'row y 1.2: glass x 2.12..6.90 (frame to 2.258 / 6.958); head 2.285', across: [2.258, 6.958], up: [0, 2.285], tolerance: 0.08, authority: 'PRINTED_DIMENSION', model: { objectId: 'og-rear-living-glazing', measure: 'OPENING_SPAN' } },
  { id: 'rear-living-mullion', facade: 'REAR', group: 'OPENING', what: 'rear glazing central mullion', at: 'row y 1.2: break at x 4.63', across: [4.63, 4.63], tolerance: 0.08, authority: 'ELEVATION_READING', model: { objectId: 'og-rear-living-glazing-glazing', measure: 'REGION_ACROSS' } },
  { id: 'rear-gable-east-rake', facade: 'REAR', group: 'RAKED_OPENING', what: 'rear gable east window, glass edge along the rake', at: 'rows y 4.30 / 5.00 / 5.70: glass reaches x 6.538 / 5.72 / 4.887', point: { across: 5.72, up: 5.0 }, tolerance: 0.2, authority: 'PRINTED_DIMENSION', model: { objectId: 'og-rear-gable-east', measure: 'OPENING_HEIGHTS', at: 5.72 }, note: 'the printed 234/303 head line predicts 5.887 at y 5.00; the glass sits a frame width inside the structural head' },
  { id: 'rear-gable-west-mullion', facade: 'REAR', group: 'RAKED_OPENING', what: 'rear gable west window, mullion', at: 'row y 4.30: break at x 2.33', across: [2.33, 2.33], tolerance: 0.08, authority: 'ELEVATION_READING', model: { objectId: 'og-rear-gable-west-glazing', measure: 'REGION_ACROSS' } },
  { id: 'rear-balcony-fascia', facade: 'REAR', group: 'BALCONY', what: 'rear balcony fascia', at: 'column x 2.0: dark 2.433..2.910; rail base to 3.097', up: [2.41, 2.96], tolerance: 0.06, authority: 'ELEVATION_READING', model: { objectId: 'balcony-rear', measure: 'BOUNDS_UP' } },
  { id: 'rear-balcony-across', facade: 'REAR', group: 'BALCONY', what: 'rear balcony fascia, continuous between the returns', at: 'row y 2.6: dark x 0.647..7.254', across: [0.647, 7.254], tolerance: 0.06, authority: 'PLAN_RASTER', model: { objectId: 'balcony-rear', measure: 'BOUNDS_ACROSS' } },
  { id: 'rear-railing-glass', facade: 'REAR', group: 'RAILING', what: 'rear balustrade glass top', at: 'column x 2.0: glass 3.199..3.846', up: [3.13, 3.85], tolerance: 0.08, authority: 'ELEVATION_READING', model: { objectId: 'rail-rear', measure: 'BOUNDS_UP' } },
  { id: 'rear-timber-west', facade: 'REAR', group: 'SURFACE_REGION', what: 'rear timber band, west of the glazing', at: 'row y 1.2: timber x 0.681..2.214', across: [0.61, 2.258], tolerance: 0.1, authority: 'ELEVATION_READING', model: { objectId: 'sr-rear-timber-west', measure: 'REGION_ACROSS' } },
  { id: 'rear-timber-east', facade: 'REAR', group: 'SURFACE_REGION', what: 'rear timber band, east of the glazing', at: 'row y 1.2: timber x 6.964..7.202', across: [6.958, 7.29], tolerance: 0.1, authority: 'ELEVATION_READING', model: { objectId: 'sr-rear-timber-east', measure: 'REGION_ACROSS' } },
  { id: 'rear-timber-top', facade: 'REAR', group: 'SURFACE_REGION', what: 'rear timber band top', at: 'column x 2.0: timber to 2.263', up: [2.263, 2.263], tolerance: 0.2, authority: 'ELEVATION_READING', model: { objectId: 'sr-rear-timber-west', measure: 'REGION_TOP' }, note: 'the band is modelled to the balcony soffit 2.41; the render reads timber to 2.26 with 0.15 m of shadow under the fascia' },
  { id: 'rear-garage-side-door', facade: 'REAR', group: 'OPENING', what: 'garage side door 100/210, glazed leaf', at: 'row y 1.2: x 9.893..10.914 (leaf reads dark); head 2.05', across: [9.893, 10.914], up: [0, 2.05], tolerance: 0.1, authority: 'PRINTED_DIMENSION', model: { objectId: 'og-garage-side-door', measure: 'OPENING_SPAN' } },
  { id: 'rear-garage-band', facade: 'REAR', group: 'PORTAL', what: 'garage north wall, dark band top (parapet)', at: 'column x 9.0: dark to 3.029', up: [3.029, 3.029], tolerance: 0.1, authority: 'NOT_MODELLED', model: { objectId: 'roof-garage', measure: 'NONE' }, note: 'the ~0.2 m parapet upstand over the 2.88 roof is not modelled (ledger garage-roof-level)' },
  // ---- EAST ---------------------------------------------------------------
  { id: 'east-silhouette-across', facade: 'EAST', group: 'SILHOUETTE', what: '14.60 m silhouette, front return to rear return', at: 'row y 3.5: white x 13.6..−1.001 (px 212..1072)', across: [-1.0, 13.6], tolerance: 0.08, authority: 'PLAN_RASTER', model: { objectId: '*', measure: 'BOUNDS_ACROSS' } },
  { id: 'east-living-window', facade: 'EAST', group: 'OPENING', what: 'east living window 300/230', at: 'row y 1.2: white from z 0.884, dark to 3.906', across: [0.884, 3.906], up: [0, 2.3], tolerance: 0.08, authority: 'PRINTED_DIMENSION', model: { objectId: 'og-east-living-window', measure: 'OPENING_SPAN' } },
  { id: 'east-chimney-salon', facade: 'EAST', group: 'CHIMNEY', what: 'salon stack', at: 'row y 7.0: dark z 4.228..5.076', across: [4.415, 5.043], tolerance: 0.1, authority: 'PLAN_RASTER', model: { objectId: 'chimney-salon', measure: 'BOUNDS_ACROSS' } },
  { id: 'east-chimney-boiler', facade: 'EAST', group: 'CHIMNEY', what: 'kotłownia stack', at: 'row y 7.0: dark z 8.948..9.627', across: [8.931, 9.508], tolerance: 0.15, authority: 'PLAN_RASTER', model: { objectId: 'chimney-boiler', measure: 'BOUNDS_ACROSS' } },
  { id: 'east-garage-band', facade: 'EAST', group: 'PORTAL', what: 'garage east face, dark to 3.12 (parapet band)', at: 'columns z 6.0 / 12.0: dark to 3.124', up: [3.12, 3.12], tolerance: 0.1, authority: 'NOT_MODELLED', model: { objectId: 'roof-garage', measure: 'NONE' }, note: 'roof top 2.88 modelled; the parapet is not (ledger garage-roof-level)' },
  { id: 'east-dark-band', facade: 'EAST', group: 'SURFACE_REGION', what: 'dark render band north of the garage up to the living window', at: 'row y 1.2: dark to z 3.906; columns z 4.2 / 4.5: dark to 2.343', across: [3.906, 5.1], up: [0, 2.36], tolerance: 0.08, authority: 'ELEVATION_READING', model: { objectId: 'sr-east-dark', measure: 'REGION_ACROSS' } },
  { id: 'east-return-front', facade: 'EAST', group: 'RECESS', what: 'front recess depth: garage return face at z 13.6 versus the garage front', at: 'row y 2.6: dark from z 13.685', across: [13.6, 13.6], tolerance: 0.1, authority: 'PRINTED_DIMENSION', model: { objectId: 'ret-garage-front', measure: 'BOUNDS_ACROSS' } },
  // ---- WEST ---------------------------------------------------------------
  { id: 'west-silhouette-across', facade: 'WEST', group: 'SILHOUETTE', what: '14.60 m silhouette', at: 'row y 1.2: white from z −1.000 to 13.601 with the dark band between', across: [-1.0, 13.6], tolerance: 0.08, authority: 'PLAN_RASTER', model: { objectId: '*', measure: 'BOUNDS_ACROSS' } },
  { id: 'west-living-window', facade: 'WEST', group: 'OPENING', what: 'west living window 90/230', at: 'row y 2.0: z 3.635..4.568 (re-read 3.652..4.535); head 2.38', across: [3.635, 4.568], up: [0, 2.38], tolerance: 0.1, authority: 'PRINTED_DIMENSION', model: { objectId: 'og-west-living-window', measure: 'OPENING_SPAN' } },
  { id: 'west-kitchen-window', facade: 'WEST', group: 'OPENING', what: 'west kitchen window 140/140', at: 'row y 2.0: z 5.332..6.810 (re-read 5.401..6.759); column z 6.0: sill 0.93, head 2.29', across: [5.332, 6.81], up: [0.93, 2.29], tolerance: 0.1, authority: 'PRINTED_DIMENSION', model: { objectId: 'og-west-kitchen-window', measure: 'OPENING_SPAN' } },
  { id: 'west-dark-band', facade: 'WEST', group: 'SURFACE_REGION', what: 'dark render band across the ground storey', at: 'rows y 1.2 / 2.0: dark z 4.535..9.917; columns z 5.0 / 8.0 / 9.5: dark to 2.309, white from 2.343', across: [4.568, 9.909], up: [0, 2.377], tolerance: 0.08, authority: 'ELEVATION_READING', model: { objectId: 'sr-west-dark', measure: 'REGION_ACROSS' } },
  { id: 'west-rooflight-pralnia', facade: 'WEST', group: 'ROOFLIGHT', what: 'laundry rooflight unit', at: 'row y 5.2: glazed patch z 5.52..6.436 (centre 5.978); lower frame edge y 4.81..5.03; the attic plan symbol z 5.610..6.405 is the authority', across: [5.61, 6.405], tolerance: 0.1, authority: 'PRINTED_DIMENSION', model: { objectId: 'rl-pralnia-w-unit', measure: 'BOUNDS_ACROSS' } },
  { id: 'west-rooflight-lazienka', facade: 'WEST', group: 'ROOFLIGHT', what: 'bathroom rooflight unit', at: 'row y 5.2: glazed patch z 7.744..8.660 (centre 8.185); the attic plan symbol z 7.777..8.556 is the authority', across: [7.777, 8.556], tolerance: 0.1, authority: 'PRINTED_DIMENSION', model: { objectId: 'rl-lazienka-w-unit', measure: 'BOUNDS_ACROSS' } },
  { id: 'west-eave-line', facade: 'WEST', group: 'ROOF', what: 'roof edge over the west wall (dark roof band base at z 5.0)', at: 'column z 5.0: white wall to 4.38, dark from 4.414', up: [4.38, 4.414], tolerance: 0.1, authority: 'SECTION_DATUM', model: { objectId: 'u-left', measure: 'WALL_TOP_AT', at: 5.0 }, note: 'the knee wall top at +4,36; the render’s white ends 0.02..0.05 higher' },
]
