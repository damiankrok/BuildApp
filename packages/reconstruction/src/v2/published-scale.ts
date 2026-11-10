/**
 * v3.51 ANY-LINK: a last-resort scale for a plan that states none — from the footprint area the page publishes.
 *
 * A plan sheet without a readable dimension (a publisher that prints none, or a sheet whose labels do not settle one
 * scale) used to end the run: no scale, no house. The page of such a project still publishes the building's footprint
 * area, and the plan still draws the walls. The scale at which the walled outline the plan draws HAS that area is a
 * statement the two sources make together.
 *
 * It is an approximation and is named one everywhere it goes: the registration it yields carries no anchors and a low
 * confidence, the result's scale stays UNVERIFIED (the preview says its lengths are not for costing), and the published
 * figure is spent — having set the scale, it can no longer check the layout. It is asked only when the run would
 * otherwise stop for want of a scale; a plan that states a scale is never touched.
 *
 * Found by iteration, because what the plan's decomposition takes for wall depends on the scale it is read at: read at
 * a trial scale, measure the outline's area, rescale by the square root of the ratio, read again.
 *
 * A page that publishes no footprint area often publishes the building's two plan dimensions instead ("width 13,84 m,
 * length 9,34 m"; "Width 95', Depth 97' 4\""). Those set the scale the same way, and carry a check the area cannot:
 * the walled outline's two sides must BOTH meet their published length at one scale. An outline whose sides ask for
 * two different scales is not what the page measured (a terrace or the eaves were counted, or the sheet is another
 * storey), and no scale is taken from it. Which published figure runs along which side of the sheet is not stated, so
 * the longer is matched to the longer.
 */
import { round6, stableId } from '@buildapp/source-common'
import type { CoordinateRegistration, MetricEvidenceSet } from '@buildapp/source-metrics'
import type { SourceCoordinateFrame } from '@buildapp/source-observations'
import { planSheet } from '../layout.js'
import type { PlanSheet } from '../layout.js'
import { wallCoverageOf, wallThicknessPlausible } from '../plan-resolution.js'
import type { PixelRect } from '@buildapp/source-common'
import { wallClusterExtent } from '../plan-decomposition.js'
import { composeStructuralLayout } from '../structural.js'
import type { StructuralPassOptions, StructuralPassResult } from '../structural.js'
import { ringArea } from '../structural-layout.js'

export const PUBLISHED_SCALE_MAX_ITERATIONS = 5
/** The outline's area is taken to equal the published footprint within this share. */
export const PUBLISHED_SCALE_AREA_TOLERANCE = 0.02
/** A scale outside what a published plan sheet is drawn at (cm per pixel) is no scale. */
export const PUBLISHED_SCALE_MIN_CM_PER_PX = 0.3
export const PUBLISHED_SCALE_MAX_CM_PER_PX = 12
export const PUBLISHED_SCALE_PROVENANCE = 'reconstruction.published-footprint-scale@1.0.0'
export const PUBLISHED_EXTENT_PROVENANCE = 'reconstruction.published-extent-scale@1.0.0'
/** The outline's two sides are taken to meet the published dimensions when the scales they ask for differ by no more than this share. */
export const PUBLISHED_EXTENT_SIDE_AGREEMENT = 0.06
/** Where the footprint area is published too, the outline at the extent's scale has it within this share, or the extent sets no scale. */
export const PUBLISHED_EXTENT_FOOTPRINT_AGREEMENT = 0.08
/** …and each side is within this share of its published length. */
export const PUBLISHED_EXTENT_TOLERANCE = 0.02

export type PublishedScaleOutcome = {
  result: StructuralPassResult
  metrics: MetricEvidenceSet
  frameId: string
  cmPerPx: number
  /** which published statement set the scale */
  basis: 'FOOTPRINT_AREA' | 'PLAN_EXTENT'
  publishedM2: number
  outlineM2: number
  /** PLAN_EXTENT only: the published dimensions and the outline's, longer first, in metres */
  publishedExtentM?: [number, number]
  outlineExtentM?: [number, number]
  iterations: number
  why: string
}

const registrationAt = (frame: SourceCoordinateFrame, cmPerPx: number, publishedM2: number, extent?: readonly [number, number]): CoordinateRegistration => ({
  id: stableId('registration', extent ? 'published-extent' : 'published-footprint', { frameId: frame.id }),
  frameId: frame.id,
  assetId: frame.assetId,
  variantByteHash: frame.variantByteHash,
  plane: 'PLAN_XZ',
  metresPerPixelX: round6(cmPerPx / 100),
  metresPerPixelY: round6(cmPerPx / 100),
  anisotropy: 1,
  originPx: { x: 0, y: frame.size.height },
  flipX: false,
  flipY: true,
  anchors: [],
  rejected: [],
  residual: { rmsM: 0, maxM: 0, rmsPx: 0 },
  confidence: 0.2,
  provenance: extent
    ? { name: PUBLISHED_EXTENT_PROVENANCE, detail: `no dimension on the plan settles a scale; the scale at which the walled outline measures the published ${extent[0]} m by ${extent[1]} m (approximate, unverified)`, extractor: 'DERIVED' }
    : { name: PUBLISHED_SCALE_PROVENANCE, detail: `no dimension on the plan settles a scale; the scale at which the walled outline has the published footprint of ${publishedM2} m² (approximate, unverified)`, extractor: 'DERIVED' },
  note: extent ? 'APPROXIMATE: from the published building dimensions, not from a printed dimension' : 'APPROXIMATE: from the published footprint area, not from a printed dimension',
})

const withRegistration = (metrics: MetricEvidenceSet, reg: CoordinateRegistration): MetricEvidenceSet => ({ ...metrics, coordinateRegistrations: [...metrics.coordinateRegistrations.filter((r) => !(r.frameId === reg.frameId && r.plane === 'PLAN_XZ')), reg] })

const footprintOf = (r: StructuralPassResult): number => r.layout.masses.reduce((a, m) => a + Math.abs(ringArea(m.ring)), 0)

/** The bodies of an approximate reading explain at least this share of the sheet's long walls, or it is not the building. */
export const PUBLISHED_SCALE_MIN_WALL_COVERAGE = 0.5

export type PublishedScaleRefusal =
  /** at this scale the walls the plan draws are not walls (under 15 cm or over 70 cm) */
  | 'WALL_THICKNESS_IMPLAUSIBLE'
  /** the bodies leave most of the sheet's drawn walls outside: the outline is a part of the plan, not the building */
  | 'OUTLINE_DOES_NOT_SPAN_THE_WALLS'
  /** the outline's two sides ask for two different scales */
  | 'SIDES_DISAGREE'
  /** the page's other figure (the footprint, or the two dimensions) is not met at this scale */
  | 'OTHER_PUBLISHED_FIGURE_DISAGREES'
  /** the sheet gives no wall mask or no cluster of walls to measure */
  | 'SHEET_NOT_READ'
  | 'NO_OUTLINE'
  | 'NOT_CONVERGED'
  | 'SCALE_OUT_OF_RANGE'

/**
 * Is the reading the building at all? An area can be met by any outline — a bathroom scaled up has the house's
 * footprint — so before a published figure sets a scale, the reading must be one a plan of a house can give: walls of
 * a wall's thickness, and bodies that account for the walls the sheet draws.
 */
function unsound(result: StructuralPassResult, sheet: PlanSheet, cluster: PixelRect): PublishedScaleRefusal | undefined {
  const base = result.draft.base
  if (!base || result.layout.masses.length === 0) return 'NO_OUTLINE'
  if (!wallThicknessPlausible(base.decomposition.wallThickness.m)) return 'WALL_THICKNESS_IMPLAUSIBLE'
  const bodies = result.draft.footprintRegions.filter((r) => r.kind === 'BUILT').map((r) => r.pixelRect).filter((r): r is PixelRect => r !== undefined)
  if (wallCoverageOf(sheet, cluster, bodies) < PUBLISHED_SCALE_MIN_WALL_COVERAGE) return 'OUTLINE_DOES_NOT_SPAN_THE_WALLS'
  return undefined
}

/** The walled outline's two plan dimensions, longer first, in metres. */
export function extentOf(r: StructuralPassResult): [number, number] | undefined {
  const points = r.layout.masses.flatMap((m) => m.ring.points)
  if (points.length < 3) return undefined
  const dx = Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x))
  const dz = Math.max(...points.map((p) => p.z)) - Math.min(...points.map((p) => p.z))
  return dx >= dz ? [dx, dz] : [dz, dx]
}

export function scaleFromPublishedFootprint(options: StructuralPassOptions, frame: SourceCoordinateFrame, publishedM2: number, check: { extentM?: readonly [number, number]; refusals?: PublishedScaleRefusal[] } = {}): PublishedScaleOutcome | undefined {
  if (!(publishedM2 > 10)) return undefined
  const sheet = planSheet(frame, { ...options, sheetCache: options.sheetCache ?? new Map() })
  if (!sheet) {
    check.refusals?.push('SHEET_NOT_READ')
    return undefined
  }
  const cluster = wallClusterExtent(sheet.mask, sheet.wallPx)?.rect
  if (!cluster) {
    check.refusals?.push('SHEET_NOT_READ')
    return undefined
  }
  const boxPx = Math.max(1, (cluster.x1 - cluster.x0) * (cluster.y1 - cluster.y0))
  // a first guess: the walls' bounding box, most of it building
  let cmPerPx = Math.sqrt(publishedM2 / (0.85 * boxPx)) * 100
  let best: PublishedScaleOutcome | undefined
  // the reading that meets the area must still be the building, and meet the page's other figure where there is one
  const admitted = (outcome: PublishedScaleOutcome): PublishedScaleOutcome | undefined => {
    const why = unsound(outcome.result, sheet, cluster)
    if (why) {
      check.refusals?.push(why)
      return undefined
    }
    const outline = extentOf(outcome.result)
    if (check.extentM && outline) {
      const published = check.extentM[0] >= check.extentM[1] ? check.extentM : ([check.extentM[1], check.extentM[0]] as const)
      if (Math.abs(outline[0] / published[0] - 1) > PUBLISHED_EXTENT_FOOTPRINT_AGREEMENT || Math.abs(outline[1] / published[1] - 1) > PUBLISHED_EXTENT_FOOTPRINT_AGREEMENT) {
        check.refusals?.push('OTHER_PUBLISHED_FIGURE_DISAGREES')
        return undefined
      }
      return { ...outcome, publishedExtentM: [published[0], published[1]], outlineExtentM: [round6(outline[0]), round6(outline[1])] }
    }
    return outcome
  }
  for (let i = 1; i <= PUBLISHED_SCALE_MAX_ITERATIONS; i += 1) {
    // a trial outside what a sheet is drawn at ends the search; what was found so far is judged below like any other
    if (!(cmPerPx >= PUBLISHED_SCALE_MIN_CM_PER_PX && cmPerPx <= PUBLISHED_SCALE_MAX_CM_PER_PX)) {
      if (!best) check.refusals?.push('SCALE_OUT_OF_RANGE')
      break
    }
    const metrics = withRegistration(options.metrics, registrationAt(frame, cmPerPx, publishedM2))
    let result: StructuralPassResult
    try {
      result = composeStructuralLayout({ ...options, metrics, sheetCache: new Map() })
    } catch {
      // at this trial scale the sheet composes no layout at all
      if (!best) check.refusals?.push('NO_OUTLINE')
      break
    }
    const outlineM2 = footprintOf(result)
    if (!(outlineM2 > 0)) {
      if (!best) check.refusals?.push('NO_OUTLINE')
      break
    }
    const off = Math.abs(outlineM2 / publishedM2 - 1)
    const here: PublishedScaleOutcome = { result, metrics, frameId: frame.id, cmPerPx: round6(cmPerPx), basis: 'FOOTPRINT_AREA', publishedM2, outlineM2: round6(outlineM2), iterations: i, why: `no dimension on the plan settles a scale; read at ${cmPerPx.toFixed(3)} cm/px its walled outline is ${outlineM2.toFixed(1)} m² against the published footprint of ${publishedM2} m² (${i} reading${i === 1 ? '' : 's'}): an approximate scale, not a measured one` }
    if (!best || off < Math.abs(best.outlineM2 / publishedM2 - 1)) best = here
    if (off <= PUBLISHED_SCALE_AREA_TOLERANCE) return admitted(here)
    cmPerPx *= Math.sqrt(publishedM2 / outlineM2)
  }
  // close enough to stand as an approximation, or nothing
  if (!best) return undefined
  if (Math.abs(best.outlineM2 / publishedM2 - 1) > 0.1) {
    check.refusals?.push('NOT_CONVERGED')
    return undefined
  }
  return admitted(best)
}

/**
 * The same last resort from the building's two published plan dimensions. `widthM` and `lengthM` are the page's
 * figures in any order; the outline's longer side is held to the longer one.
 */
export function scaleFromPublishedExtent(options: StructuralPassOptions, frame: SourceCoordinateFrame, widthM: number, lengthM: number, check: { footprintM2?: number; refusals?: PublishedScaleRefusal[] } = {}): PublishedScaleOutcome | undefined {
  if (!(widthM > 3) || !(lengthM > 3)) return undefined
  const published: [number, number] = widthM >= lengthM ? [widthM, lengthM] : [lengthM, widthM]
  const sheet = planSheet(frame, { ...options, sheetCache: options.sheetCache ?? new Map() })
  if (!sheet) {
    check.refusals?.push('SHEET_NOT_READ')
    return undefined
  }
  const cluster = wallClusterExtent(sheet.mask, sheet.wallPx)?.rect
  if (!cluster) {
    check.refusals?.push('SHEET_NOT_READ')
    return undefined
  }
  const longPx = Math.max(1, Math.max(cluster.x1 - cluster.x0, cluster.y1 - cluster.y0))
  let cmPerPx = (published[0] / longPx) * 100
  for (let i = 1; i <= PUBLISHED_SCALE_MAX_ITERATIONS; i += 1) {
    if (!(cmPerPx >= PUBLISHED_SCALE_MIN_CM_PER_PX && cmPerPx <= PUBLISHED_SCALE_MAX_CM_PER_PX)) {
      check.refusals?.push('SCALE_OUT_OF_RANGE')
      return undefined
    }
    const metrics = withRegistration(options.metrics, registrationAt(frame, cmPerPx, round6(published[0] * published[1]), published))
    let result: StructuralPassResult
    try {
      result = composeStructuralLayout({ ...options, metrics, sheetCache: new Map() })
    } catch {
      // at this trial scale the sheet composes no layout at all
      check.refusals?.push('NO_OUTLINE')
      return undefined
    }
    const outline = extentOf(result)
    if (!outline || !(outline[0] > 0) || !(outline[1] > 0)) {
      check.refusals?.push('NO_OUTLINE')
      return undefined
    }
    const askLong = published[0] / outline[0]
    const askShort = published[1] / outline[1]
    // the two sides must ask for one scale: otherwise the page measured something this outline is not
    if (Math.abs(askLong / askShort - 1) > PUBLISHED_EXTENT_SIDE_AGREEMENT) {
      check.refusals?.push('SIDES_DISAGREE')
      return undefined
    }
    const factor = Math.sqrt(askLong * askShort)
    if (Math.abs(askLong - 1) <= PUBLISHED_EXTENT_TOLERANCE && Math.abs(askShort - 1) <= PUBLISHED_EXTENT_TOLERANCE) {
      const why = unsound(result, sheet, cluster)
      // where the page also publishes the footprint, the outline at this scale must have it: three figures, one scale
      const other = !why && check.footprintM2 !== undefined && Math.abs(footprintOf(result) / check.footprintM2 - 1) > PUBLISHED_EXTENT_FOOTPRINT_AGREEMENT ? ('OTHER_PUBLISHED_FIGURE_DISAGREES' as const) : undefined
      if (why ?? other) {
        check.refusals?.push((why ?? other) as PublishedScaleRefusal)
        return undefined
      }
      return {
        result,
        metrics,
        frameId: frame.id,
        cmPerPx: round6(cmPerPx),
        basis: 'PLAN_EXTENT',
        publishedM2: round6(published[0] * published[1]),
        outlineM2: round6(footprintOf(result)),
        publishedExtentM: published,
        outlineExtentM: [round6(outline[0]), round6(outline[1])],
        iterations: i,
        why: `no dimension on the plan settles a scale; read at ${cmPerPx.toFixed(3)} cm/px its walled outline measures ${outline[0].toFixed(2)} m by ${outline[1].toFixed(2)} m against the published ${published[0]} m by ${published[1]} m (${i} reading${i === 1 ? '' : 's'}): an approximate scale, not a measured one`,
      }
    }
    cmPerPx *= factor
  }
  check.refusals?.push('NOT_CONVERGED')
  return undefined
}

/**
 * v3.51 ANY-LINK-3: is a reading's size contradicted by the two plan dimensions the page publishes?
 *
 * Asked only of a reading whose scale nothing on the drawing confirmed. It is contradicted when BOTH sides of its
 * walled outline miss the published ones by more than a published figure may differ (`PUBLISHED_EXTENT_FOOTPRINT_
 * AGREEMENT`), in the same direction and by the same factor (`PUBLISHED_EXTENT_SIDE_AGREEMENT`): the outline has the
 * published building's proportions at another size — the mark of a wrong scale, not of a part that was not read (one
 * side short) or of figures that describe something else (two factors).
 */
export function extentContradiction(result: StructuralPassResult, widthM: number, lengthM: number): { outlineM: [number, number]; publishedM: [number, number]; factor: number } | undefined {
  const outline = extentOf(result)
  if (!outline || !(widthM > 3) || !(lengthM > 3)) return undefined
  const published: [number, number] = widthM >= lengthM ? [widthM, lengthM] : [lengthM, widthM]
  const [long, short] = [outline[0] / published[0], outline[1] / published[1]]
  const off = (r: number): boolean => Math.abs(r - 1) > PUBLISHED_EXTENT_FOOTPRINT_AGREEMENT
  if (!off(long) || !off(short) || long > 1 !== short > 1) return undefined
  if (Math.abs(long / short - 1) > PUBLISHED_EXTENT_SIDE_AGREEMENT) return undefined
  return { outlineM: [round6(outline[0]), round6(outline[1])], publishedM: published, factor: round6(Math.sqrt(long * short)) }
}
