/**
 * BUILDPLAN-ANALYZER-005T-N3: a ridge height for a gable the publisher specifies, when no section prints one.
 *
 * The roof is built from a ridge datum the section prints (`levelsFrom` → `topDatum`); without it a house the page
 * specifies as a gable has no roof at all, and the model either refuses or would be a roofless box. A page often
 * prints, besides the pitch, the knee wall of the top storey and the building's overall height. With the top storey's
 * floor and the span across the ridge the layout already chose, those give the ridge:
 *
 *   R = F + K + h · tan(pitch)      (F the top storey's floor, K the knee wall, h half the span across the ridge)
 *
 * and the overall height checks it: the building is H tall above the terrain, so H − (R + B) must be a plausible
 * terrain depth below ±0.00, for some roof build-up B between nothing and a conventional roof. A height that does
 * not fit refuses the datum. The datum is never a printed one: the storey floor may itself be a convention, the
 * build-up is assumed, the terrain is not read, so the result says ASSUMED_FOR_RENDERING and the run warns. It feeds
 * the roof and nothing else — no render is measured on it.
 *
 * Precedence: a section's ridge datum wins; this rule only runs without one. A GABLE and (EXTERIOR-COMPLETE,
 * Zefiranty) a HIP are answered; a flat or unknown roof is never routed through it. A gable's span across the ridge is
 * the layout's ridge axis, never changed to make numbers fit; a hip pitched alike on every side rises over its body's
 * shorter span, which is geometry, not a choice:
 *
 *   R = F + K + min(w, d) / 2 · tan(pitch)
 *
 * v3.51 (ANY-LINK): a single-storey house has no knee wall to print — its roof sits on the walls of its only storey.
 * There the storey's own wall height stands where the knee wall does (K = the storey's height as the solver has it,
 * printed or the named convention), and the same published building height checks the result the same way. A house
 * with a storey above the ground one, or an attic, is never answered this way: its eaves are a knee wall the page did
 * not print.
 */
import { round6 } from '@buildapp/source-common'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import { CONVENTIONS } from '../solve.js'

/** The terrain depths below ±0.00 the solver already accepts as a terrain datum (`reconstruct-v2.ts`). */
export const ROOF_DATUM_TERRAIN_DEPTH_M = { min: 0.05, max: 1.5 } as const
/** How far a printed terrain datum may sit from the one the building height implies. */
const PRINTED_TERRAIN_TOLERANCE_M = 0.05

export type ApproximateRidgeInput = {
  /** The section's printed ridge; when present the rule does nothing. */
  printedRidgeY: number | undefined
  roof: { kind: string; pitchDeg?: number; pitchAuthority?: string; ridgeAxis?: 'X' | 'Z' } | undefined
  /** The main body's plan rectangle. */
  body: { x0: number; x1: number; z0: number; z1: number }
  /** The top storey's floor, as the solver already has it, and whether a section printed it. */
  topFloorY: number
  topFloorPrinted: boolean
  metrics: Pick<MetricEvidenceSet, 'evidence'>
  publishedFacts: ReadonlyArray<{ key: string; value: number; unit: string }>
  /** A terrain datum the drawings print (negative, metres), when one was read. */
  printedTerrainY?: number
  /**
   * v3.51: the wall height of the top storey when it is the house's ONLY storey (no storey above the ground one, no
   * attic plan), and whether the sources print it. Absent for every other house.
   */
  singleStoreyWalls?: { heightM: number; printed: boolean }
}

export type ApproximateRidge = {
  ridgeY: number
  eaveY: number
  /** What the eaves stand on above the top storey's floor: a printed knee wall, or (v3.51) a single storey's own walls. */
  eavesBasis: 'PRINTED_KNEE_WALL' | 'SINGLE_STOREY_WALLS'
  kneeWallM: number
  buildingHeightM: number
  halfSpanM: number
  /** H − R: the terrain depth plus roof build-up the published height leaves. */
  heightMarginM: number
  evidenceIds: string[]
  why: string
}

export type ApproximateRidgeResult = { ok: true; datum: ApproximateRidge } | { ok: false; reason: string }

const PITCH_AUTHORITIES = new Set(['PUBLISHED_SPECIFICATION', 'PRINTED_ANGLE'])

const NO_KNEE_WALL = 'the page prints no knee wall'

/** The one knee-wall height the page's specification prints, in metres; several different ones are no answer. */
function kneeWallOf(metrics: Pick<MetricEvidenceSet, 'evidence'>): { m: number; id: string } | { error: string } {
  const read = metrics.evidence.filter((e) => e.kind === 'LINEAR_DIMENSION' && e.association.kind === 'PUBLISHED_SPECIFICATION' && e.id.startsWith('metric-spec-knee-wall-'))
  const values = [...new Set(read.map((e) => round6(e.unit === 'cm' ? e.value / 100 : e.unit === 'mm' ? e.value / 1000 : e.value)))]
  if (values.length === 0) return { error: NO_KNEE_WALL }
  if (values.length > 1) return { error: `the page prints ${values.length} different knee walls (${values.join(', ')} m)` }
  if (values[0] < 0.3 || values[0] > 2) return { error: `a knee wall of ${values[0]} m is not one` }
  return { m: values[0], id: read[0].id }
}

export function approximateRidgeDatum(input: ApproximateRidgeInput): ApproximateRidgeResult {
  if (input.printedRidgeY !== undefined) return { ok: false, reason: 'the section prints a ridge datum, which stands' }
  const roof = input.roof
  if (!roof || (roof.kind !== 'GABLE' && roof.kind !== 'HIP')) return { ok: false, reason: `the main roof is ${roof?.kind ?? 'not known'}; only a gable or a hip is answered here` }
  if (roof.pitchDeg === undefined || !PITCH_AUTHORITIES.has(roof.pitchAuthority ?? '')) return { ok: false, reason: 'no pitch the publisher or a drawing prints' }
  if (roof.pitchDeg < 15 || roof.pitchDeg > 60) return { ok: false, reason: `a pitch of ${roof.pitchDeg}° is outside what this rule answers` }
  if (roof.kind === 'GABLE' && !roof.ridgeAxis) return { ok: false, reason: 'the layout chose no ridge axis' }
  const printedKnee = kneeWallOf(input.metrics)
  const walls = input.singleStoreyWalls
  // a single storey's roof sits on that storey's walls: they stand where a knee wall would, when the page prints none
  const storeyWalls = 'error' in printedKnee && printedKnee.error === NO_KNEE_WALL && walls && walls.heightM >= 2.2 && walls.heightM <= 4 ? walls : undefined
  if ('error' in printedKnee && !storeyWalls) return { ok: false, reason: printedKnee.error }
  const knee = 'error' in printedKnee ? { m: round6((storeyWalls as NonNullable<typeof storeyWalls>).heightM), id: undefined } : printedKnee
  const eavesBasis: ApproximateRidge['eavesBasis'] = storeyWalls ? 'SINGLE_STOREY_WALLS' : 'PRINTED_KNEE_WALL'
  const heights = input.publishedFacts.filter((f) => f.key === 'building_height' && f.unit === 'm')
  if (heights.length !== 1) return { ok: false, reason: heights.length === 0 ? 'the page prints no building height' : 'the page prints more than one building height' }
  const H = heights[0].value
  if (!(H >= 3 && H <= 20)) return { ok: false, reason: `a building height of ${H} m is not plausible` }
  const [w, d] = [input.body.x1 - input.body.x0, input.body.z1 - input.body.z0]
  const half = round6((roof.kind === 'HIP' ? Math.min(w, d) : roof.ridgeAxis === 'X' ? d : w) / 2)
  if (!(half > 0)) return { ok: false, reason: 'no span across the ridge' }
  const rise = half * Math.tan((roof.pitchDeg * Math.PI) / 180)
  const eaveY = round6(input.topFloorY + knee.m)
  const ridgeY = round6(eaveY + rise)
  const margin = round6(H - ridgeY)
  // H − (R + B) = d for some build-up B ∈ [0, roof] and a terrain depth d.
  const buildUp = CONVENTIONS.roofThickness
  if (input.printedTerrainY !== undefined) {
    const d = -input.printedTerrainY
    if (margin < d - PRINTED_TERRAIN_TOLERANCE_M || margin > d + buildUp + PRINTED_TERRAIN_TOLERANCE_M) {
      return { ok: false, reason: `the published height ${H} m over the printed terrain ${input.printedTerrainY} m leaves ${round6(margin - d)} m for the roof above a ridge at ${ridgeY} m, outside 0–${buildUp} m` }
    }
  } else if (margin < ROOF_DATUM_TERRAIN_DEPTH_M.min || margin > ROOF_DATUM_TERRAIN_DEPTH_M.max + buildUp) {
    return { ok: false, reason: `the published height ${H} m contradicts a ridge at ${ridgeY} m (it leaves ${margin} m, outside ${ROOF_DATUM_TERRAIN_DEPTH_M.min}–${round6(ROOF_DATUM_TERRAIN_DEPTH_M.max + buildUp)} m for terrain and roof build-up)` }
  }
  const pitchId = input.metrics.evidence.find((e) => e.kind === 'ANGLE' && e.association.kind === 'PUBLISHED_SPECIFICATION')?.id
  const why =
    `no section prints a ridge: taken at ${ridgeY} m from the top storey's floor ${input.topFloorY} m${input.topFloorPrinted ? '' : ' (a conventional storey height, not printed)'} + ${storeyWalls ? `the walls of its only storey ${knee.m} m${storeyWalls.printed ? '' : ' (a conventional storey height, not printed)'}` : `the printed knee wall ${knee.m} m`} + ${half} m × tan ${roof.pitchDeg}°${roof.kind === 'HIP' ? ' (a hip rises over half its shorter span)' : ''}; ` +
    `the published building height ${H} m leaves ${margin} m for terrain${input.printedTerrainY === undefined ? ' (not read)' : ''} and roof build-up (assumed nil at the eaves), which is consistent — an approximate datum for rendering, not a printed one`
  return { ok: true, datum: { ridgeY, eaveY, eavesBasis, kneeWallM: knee.m, buildingHeightM: H, halfSpanM: half, heightMarginM: margin, evidenceIds: [...(knee.id ? [knee.id] : []), ...(pitchId ? [pitchId] : [])], why } }
}

/**
 * EXTERIOR-COMPLETE: whether the published building height says the highest datum a section reader managed to read is
 * NOT the ridge. A building H tall above the terrain has its ridge at about H − d (d the terrain depth below ±0.00,
 * printed or within ROOF_DATUM_TERRAIN_DEPTH_M) less the roof's build-up over the ridge datum. A top datum lower than
 * that by more than the build-up is an eave or a slab mark whose ridge label went unread — taking it for the ridge sinks
 * the roof to the eaves.
 *
 * The height alone does not refuse it: some pages measure to a chimney's top. The section must agree — its drawing has
 * to carry ink across part of the building's width (`riseAtShare`, `section-datums.ts`) at least half as high above the
 * datum as the height leaves — so a narrow chimney over a true ridge mark never refuses it. Returns the reason, or
 * undefined when the height and the drawing do not both say so.
 */
export function topDatumBelowPublishedHeight(input: {
  topDatum: number
  /** The drawing's rise above the top datum across part of the building's width (m), when the sheet gives a scale. */
  drawnRise: number | undefined
  publishedFacts: ReadonlyArray<{ key: string; value: number; unit: string }>
  printedTerrainY?: number
}): string | undefined {
  const heights = input.publishedFacts.filter((f) => f.key === 'building_height' && f.unit === 'm')
  if (heights.length !== 1 || input.drawnRise === undefined) return undefined
  const H = heights[0].value
  if (!(H >= 3 && H <= 20)) return undefined
  const depth = input.printedTerrainY !== undefined ? -input.printedTerrainY : ROOF_DATUM_TERRAIN_DEPTH_M.max
  const left = round6(H - depth - input.topDatum)
  if (!(left > CONVENTIONS.roofThickness + PRINTED_TERRAIN_TOLERANCE_M)) return undefined
  if (!(input.drawnRise >= left / 2)) return undefined
  const terrain = input.printedTerrainY !== undefined ? `the printed terrain ${input.printedTerrainY} m` : `a terrain at most ${ROOF_DATUM_TERRAIN_DEPTH_M.max} m below ±0.00`
  return `the published building height ${H} m over ${terrain} leaves ${left} m above the highest datum read (+${input.topDatum.toFixed(2)}), more than a roof build-up of ${CONVENTIONS.roofThickness} m, and the section draws ink ${input.drawnRise.toFixed(2)} m above that datum across part of the building's width: a roof stands above it, so it is not the ridge`
}

/** E13: how far the published building height may differ from the ridge over a ground mark for that mark to be its base. */
export const PUBLISHED_HEIGHT_BASE_TOLERANCE_M = 0.05

/**
 * E13 (a development section printing a floor sunk under the stair and the ground outside, both below ±0,00): the
 * printed terrain. A section may print more than one mark a little below
 * ±0,00 — the ground outside and a floor sunk inside — and nothing in the value says which is the ground. Where the page
 * publishes the building height and the section prints the ridge, the ground is the mark that height is measured from:
 * the one whose distance to the highest mark is the published height. Otherwise (one mark, no published height, no
 * single mark meeting it) the most confident mark stands, as before.
 */
export function printedTerrainOf(levels: ReadonlyArray<{ value: number; confidence: number }>, publishedFacts: ReadonlyArray<{ key: string; value: number; unit: string }>): { value: number; why: string } | undefined {
  const grounds = levels.filter((e) => e.value < 0 && e.value > -1.5)
  if (grounds.length === 0) return undefined
  const fallback = [...grounds].sort((a, b) => b.confidence - a.confidence)[0]
  const distinct = [...new Set(grounds.map((g) => g.value))]
  const heights = publishedFacts.filter((f) => f.key === 'building_height' && f.unit === 'm')
  if (distinct.length < 2 || heights.length !== 1 || levels.length === 0) return { value: fallback.value, why: 'the most confident level mark printed below ±0,00' }
  const top = Math.max(...levels.map((e) => e.value))
  const H = heights[0].value
  const meeting = distinct.filter((g) => Math.abs(top - g - H) <= PUBLISHED_HEIGHT_BASE_TOLERANCE_M)
  if (meeting.length !== 1) return { value: fallback.value, why: `the most confident level mark printed below ±0,00 (${meeting.length === 0 ? 'none' : 'more than one'} of ${distinct.map((g) => g.toFixed(2)).join(', ')} is the base of the published ${H} m height under +${top.toFixed(2)})` }
  return { value: meeting[0], why: `the published building height ${H} m is +${top.toFixed(2)} over ${meeting[0].toFixed(2)}, of the marks ${distinct.map((g) => g.toFixed(2)).join(', ')} printed below ±0,00` }
}
