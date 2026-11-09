/**
 * v3.51 ANY-LINK-3: a sound reading of PART of the building, when no reading of the whole was found.
 *
 * The gate refuses a lowest storey more than a fifth away from the footprint the page publishes
 * (`FOOTPRINT_AREA_WRONG`), and the plan resolver then weighs the plan's other readings. When none of them holds, the
 * run used to stop with no model — also where the first reading was right as far as it went: a house read at the
 * scale its own dimensions state, wall for wall, whose published footprint counts parts the reading left open (a
 * garage behind a gate it could not close, a roofed entrance, a covered terrace).
 *
 * Such a reading is kept, and said to be what it is. Only as a last resort — after the resolver, never instead of it —
 * and only when everything but the figure speaks for it:
 *
 *   - the lowest storey is SMALLER than the published footprint (a larger one is never excused), and holds at least
 *     two thirds of it (`PARTIAL_FOOTPRINT_MIN_SHARE`): what a published footprint counts beyond the walled house —
 *     a garage, a roofed entrance, a covered terrace — is a minor part of it, so a larger shortfall is a missing part
 *     of the house itself;
 *   - the drawing itself states the scale: an independent metric solution from its printed dimensions, on a
 *     registration with at least two anchors — never a scale that was itself fitted to a published figure;
 *   - the bodies are the sheet's walls: walls of a wall's thickness, and bodies that account for the walls it draws
 *     (the same two tests a published figure must pass before it may set a scale);
 *   - the drawing shows what is missing: open parts beside the bodies (a wide mouth with a pocket behind it, a part
 *     the boundary considered and did not accept) whose areas, with the bodies, come within the gate's own tolerance
 *     of the figure.
 *
 * The layout is then composed again with the shortfall named (`FOOTPRINT_AREA_SHORT`, still BLOCKING): the model is
 * delivered as a partial preview with that reason on it, never as a complete reconstruction.
 */
import { round6 } from '@buildapp/source-common'
import type { PixelRect } from '@buildapp/source-common'
import { planSheet } from '../layout.js'
import { builtFootprintM2 } from '../layout-gate.js'
import { LAYOUT_REFUSAL_CODES, layoutRefused } from '../plan-diagnostics.js'
import { wallClusterExtent } from '../plan-decomposition.js'
import { wallCoverageOf, wallThicknessPlausible } from '../plan-resolution.js'
import { composeStructuralLayout } from '../structural.js'
import type { StructuralPassOptions, StructuralPassResult } from '../structural.js'
import { worldFrameFrom } from './frame.js'
import { PUBLISHED_SCALE_MIN_WALL_COVERAGE } from './published-scale.js'

/** The share of the published footprint the lowest storey must hold: the house, short of its minor attached parts. */
export const PARTIAL_FOOTPRINT_MIN_SHARE = 2 / 3
/** With the open parts the drawing shows, the figure must be met as nearly as the gate asks of any layout it degrades. */
export const PARTIAL_FOOTPRINT_EXPLAINED_WITHIN = 0.2
/** A registration that states a scale ties at least two points of the sheet to metres. */
export const PARTIAL_FOOTPRINT_MIN_ANCHORS = 2

export type PartialFootprintRefusal =
  /** the page publishes no footprint, or the reading was refused for something else as well */
  | 'NOT_A_FOOTPRINT_REFUSAL'
  /** the lowest storey is larger than the figure: nothing left open explains that */
  | 'LARGER_THAN_PUBLISHED'
  /** under two thirds of the published footprint was read: part of the house itself is missing */
  | 'TOO_LITTLE_OF_THE_FOOTPRINT'
  /** the plan's scale is not a statement of its own printed dimensions */
  | 'SCALE_NOT_STATED_BY_THE_DRAWING'
  | 'WALL_THICKNESS_IMPLAUSIBLE'
  | 'BODIES_DO_NOT_SPAN_THE_WALLS'
  /** the drawing shows no open part beside the bodies that could be the rest of the footprint */
  | 'SHORTFALL_NOT_SHOWN_BY_THE_DRAWING'
  | 'SHEET_NOT_READ'
  /** composed again with the shortfall named, the layout is refused for another reason */
  | 'STILL_REFUSED'

export type OpenPart = { kind: 'POCKET_BEHIND_A_WIDE_MOUTH' | 'PART_THE_BOUNDARY_DID_NOT_ACCEPT'; areaM2: number; why: string }

export type PartialFootprintOutcome = {
  result: StructuralPassResult
  builtM2: number
  publishedM2: number
  shortfallM2: number
  /** How much of the published footprint is not in the model, 0..1. */
  shortfallShare: number
  openParts: OpenPart[]
  why: string
}

/** The open parts the reading itself recorded beside its bodies. Areas may overlap: they are evidence, not a sum. */
export function openPartsOf(result: StructuralPassResult): OpenPart[] {
  const d = result.draft.base?.decomposition
  if (!d) return []
  const pockets: OpenPart[] = d.wideOpenings
    .filter((w) => w.decision === 'OPEN_SIDE' && (w.evidence.pocketM2 ?? 0) > 0)
    .map((w) => ({ kind: 'POCKET_BEHIND_A_WIDE_MOUTH' as const, areaM2: round6(w.evidence.pocketM2 ?? 0), why: `a ${w.widthM.toFixed(2)} m mouth left open` }))
  const parts: OpenPart[] = (d.boundary?.completions ?? [])
    .filter((p) => p.decision !== 'ACCEPTED' && p.areaM2 > 0)
    .map((p) => ({ kind: 'PART_THE_BOUNDARY_DID_NOT_ACCEPT' as const, areaM2: round6(p.areaM2), why: p.reason.split(':')[0] }))
  return [...pockets, ...parts]
}

/**
 * The first reading, kept as a reading of part of the building — or undefined, with the reason pushed to `refusals`.
 * `incumbent` must be the result of `composeStructuralLayout(options)`.
 */
export function partialFootprint(options: StructuralPassOptions, incumbent: StructuralPassResult, refusals: PartialFootprintRefusal[] = []): PartialFootprintOutcome | undefined {
  const no = (why: PartialFootprintRefusal): undefined => {
    refusals.push(why)
    return undefined
  }
  const publishedM2 = options.publishedAreas?.find((a) => a.key === 'footprint_area' && a.unit === 'm2')?.value
  const { draft, layout } = incumbent
  const base = draft.base
  const refusing = layout.gate.reasons.filter((r) => r.severity === 'BLOCKING' && LAYOUT_REFUSAL_CODES.has(r.code))
  if (publishedM2 === undefined || !base || !worldFrameFrom(draft) || layout.masses.length === 0 || refusing.length === 0 || !refusing.every((r) => r.code === 'FOOTPRINT_AREA_WRONG')) return no('NOT_A_FOOTPRINT_REFUSAL')
  const builtM2 = builtFootprintM2(layout.storeys, layout.footprintRegions)
  if (!(builtM2 < publishedM2)) return no('LARGER_THAN_PUBLISHED')
  if (builtM2 < PARTIAL_FOOTPRINT_MIN_SHARE * publishedM2) return no('TOO_LITTLE_OF_THE_FOOTPRINT')
  // the scale is the drawing's own statement
  const solution = options.metrics.metricSolutions?.find((m) => m.frameId === base.frame.id)
  const stated = solution !== undefined && (solution.relation === 'CONFIRMED' || solution.relation === 'REPLACED' || solution.relation === 'ADDED')
  if (!stated || !base.registration || base.registration.anchors.length < PARTIAL_FOOTPRINT_MIN_ANCHORS) return no('SCALE_NOT_STATED_BY_THE_DRAWING')
  // the bodies are the sheet's walls
  if (!wallThicknessPlausible(base.decomposition.wallThickness.m)) return no('WALL_THICKNESS_IMPLAUSIBLE')
  const sheet = planSheet(base.frame, { ...options, sheetCache: options.sheetCache ?? new Map() })
  const cluster = sheet ? wallClusterExtent(sheet.mask, sheet.wallPx)?.rect : undefined
  if (!sheet || !cluster) return no('SHEET_NOT_READ')
  const bodies = draft.footprintRegions.filter((r) => r.kind === 'BUILT').map((r) => r.pixelRect).filter((r): r is PixelRect => r !== undefined)
  if (wallCoverageOf(sheet, cluster, bodies) < PUBLISHED_SCALE_MIN_WALL_COVERAGE) return no('BODIES_DO_NOT_SPAN_THE_WALLS')
  // the drawing shows what is missing
  const openParts = openPartsOf(incumbent)
  const shownM2 = openParts.reduce((a, p) => a + p.areaM2, 0)
  if (openParts.length === 0 || builtM2 + shownM2 < (1 - PARTIAL_FOOTPRINT_EXPLAINED_WITHIN) * publishedM2) return no('SHORTFALL_NOT_SHOWN_BY_THE_DRAWING')
  const shortfallM2 = round6(publishedM2 - builtM2)
  const why = `the plan is read at the scale its own printed dimensions state, its bodies account for the walls it draws, and it shows ${openParts.length} open part${openParts.length === 1 ? '' : 's'} beside them (${openParts.map((p) => `${p.areaM2.toFixed(1)} m²`).join(', ')}) that this reading does not build`
  const result = composeStructuralLayout({ ...options, footprintShortfall: { why } })
  if (layoutRefused(result.layout) || result.layout.masses.length === 0 || !worldFrameFrom(result.draft)) return no('STILL_REFUSED')
  return { result, builtM2, publishedM2, shortfallM2, shortfallShare: round6(shortfallM2 / publishedM2), openParts, why }
}
