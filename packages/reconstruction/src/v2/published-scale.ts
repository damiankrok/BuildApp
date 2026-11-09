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
 */
import { round6, stableId } from '@buildapp/source-common'
import type { CoordinateRegistration, MetricEvidenceSet } from '@buildapp/source-metrics'
import type { SourceCoordinateFrame } from '@buildapp/source-observations'
import { planSheet } from '../layout.js'
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

export type PublishedScaleOutcome = {
  result: StructuralPassResult
  metrics: MetricEvidenceSet
  frameId: string
  cmPerPx: number
  publishedM2: number
  outlineM2: number
  iterations: number
  why: string
}

const registrationAt = (frame: SourceCoordinateFrame, cmPerPx: number, publishedM2: number): CoordinateRegistration => ({
  id: stableId('registration', 'published-footprint', { frameId: frame.id }),
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
  provenance: { name: PUBLISHED_SCALE_PROVENANCE, detail: `no dimension on the plan settles a scale; the scale at which the walled outline has the published footprint of ${publishedM2} m² (approximate, unverified)`, extractor: 'DERIVED' },
  note: 'APPROXIMATE: from the published footprint area, not from a printed dimension',
})

const withRegistration = (metrics: MetricEvidenceSet, reg: CoordinateRegistration): MetricEvidenceSet => ({ ...metrics, coordinateRegistrations: [...metrics.coordinateRegistrations.filter((r) => !(r.frameId === reg.frameId && r.plane === 'PLAN_XZ')), reg] })

const footprintOf = (r: StructuralPassResult): number => r.layout.masses.reduce((a, m) => a + Math.abs(ringArea(m.ring)), 0)

export function scaleFromPublishedFootprint(options: StructuralPassOptions, frame: SourceCoordinateFrame, publishedM2: number): PublishedScaleOutcome | undefined {
  if (!(publishedM2 > 10)) return undefined
  const sheet = planSheet(frame, { ...options, sheetCache: options.sheetCache ?? new Map() })
  if (!sheet) return undefined
  const cluster = wallClusterExtent(sheet.mask, sheet.wallPx)?.rect
  if (!cluster) return undefined
  const boxPx = Math.max(1, (cluster.x1 - cluster.x0) * (cluster.y1 - cluster.y0))
  // a first guess: the walls' bounding box, most of it building
  let cmPerPx = Math.sqrt(publishedM2 / (0.85 * boxPx)) * 100
  let best: PublishedScaleOutcome | undefined
  for (let i = 1; i <= PUBLISHED_SCALE_MAX_ITERATIONS; i += 1) {
    if (!(cmPerPx >= PUBLISHED_SCALE_MIN_CM_PER_PX && cmPerPx <= PUBLISHED_SCALE_MAX_CM_PER_PX)) return best
    const metrics = withRegistration(options.metrics, registrationAt(frame, cmPerPx, publishedM2))
    let result: StructuralPassResult
    try {
      result = composeStructuralLayout({ ...options, metrics, sheetCache: new Map() })
    } catch {
      return best
    }
    const outlineM2 = footprintOf(result)
    if (!(outlineM2 > 0)) return best
    const off = Math.abs(outlineM2 / publishedM2 - 1)
    const here: PublishedScaleOutcome = { result, metrics, frameId: frame.id, cmPerPx: round6(cmPerPx), publishedM2, outlineM2: round6(outlineM2), iterations: i, why: `no dimension on the plan settles a scale; read at ${cmPerPx.toFixed(3)} cm/px its walled outline is ${outlineM2.toFixed(1)} m² against the published footprint of ${publishedM2} m² (${i} reading${i === 1 ? '' : 's'}): an approximate scale, not a measured one` }
    if (!best || off < Math.abs(best.outlineM2 / publishedM2 - 1)) best = here
    if (off <= PUBLISHED_SCALE_AREA_TOLERANCE) return here
    cmPerPx *= Math.sqrt(publishedM2 / outlineM2)
  }
  // close enough to stand as an approximation, or nothing
  return best && Math.abs(best.outlineM2 / publishedM2 - 1) <= 0.1 ? best : undefined
}
