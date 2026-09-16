/**
 * Registering a technical elevation.
 *
 * §4: for an orthographic drawing, do not solve a camera. Fit image
 * coordinates straight onto facade metric coordinates and be done. The model
 * is the general affine
 *
 *     x_m = ax·u + bx·v + cx
 *     y_m = ay·u + by·v + cy
 *
 * which for a clean upright elevation comes out as a scale and an offset per
 * axis, and which can also absorb the anisotropic resize and the half-degree
 * of shear that a published raster occasionally carries.
 *
 * The two axes are fitted SEPARATELY, because the anchors are separate. A wall
 * face pins a horizontal and says nothing about height; a ridge pins a height
 * and says nothing about where along the facade it is. Insisting on anchors
 * that pin both would throw away almost everything a building offers.
 *
 * The fit is robust, and it holds one anchor back where it can afford to. A
 * least-squares fit always explains what it was fitted to; the only honest
 * test of a registration is a coordinate it has never seen.
 */
import { round6 } from '@buildapp/source-common'
import { huberWeights, leastSquares, median } from './linalg.js'
import { METRIC_FRAME_SCHEMA, METRIC_FRAME_SCHEMA_VERSION } from './frame.js'
import type { AnchorResidual, FacadeAxis, MetricAnchor, MetricImageFrame, OrthographicTransform } from './frame.js'

export type OrthographicFitOptions = {
  /** How far an anchor may sit from the fit and still be believed, in metres. */
  toleranceM?: number
  /** Rounds of reweighting. Two is plenty for systems this small. */
  rounds?: number
  /** Hold one anchor per axis out of the fit and report how far the frame misses it. */
  holdOut?: boolean
  /** Refuse a fit whose two scales differ by more than this. A facade is not a funhouse mirror. */
  maxAnisotropy?: number
}

const DEFAULTS: Required<OrthographicFitOptions> = { toleranceM: 0.25, rounds: 3, holdOut: true, maxAnisotropy: 1.35 }

export type OrthographicFitInput = {
  id: string
  assetId: string
  sourceFrameId?: string
  horizontalAxis: FacadeAxis
  region: { x0: number; y0: number; x1: number; y1: number }
  anchors: readonly MetricAnchor[]
}

/**
 * Fit one axis: `value = a·u + b·v + c` over the anchors that state it.
 *
 * Weighted by how sure each anchor is — a printed chain endpoint outranks a
 * derived eaves level — then reweighted twice by Huber so that one anchor
 * placed on the wrong edge bends the line rather than breaking it.
 */
function fitAxis(anchors: readonly MetricAnchor[], value: (a: MetricAnchor) => number | undefined, rounds: number): { a: number; b: number; c: number; residuals: Map<string, number>; used: MetricAnchor[] } | null {
  const used = anchors.filter((anchor) => value(anchor) !== undefined)
  if (used.length < 2) return null
  const rows = used.map((anchor) => [anchor.pixel.u, anchor.pixel.v, 1])
  const values = used.map((anchor) => value(anchor) as number)
  // A metric sigma of zero means "exact", which as a weight is infinite. The
  // floor is one millimetre: below that the difference between two anchors is
  // not something any drawing can express.
  const base = used.map((anchor) => 1 / Math.max(1e-3, anchor.metricSigma) ** 2)

  // With only two anchors the plane is under-determined in v; drop the v term
  // and fit a line, which is exactly what a pair of wall faces supports.
  const flat = used.length < 3
  const design = flat ? rows.map((row) => [row[0], row[2]]) : rows
  let weights = base
  let solution = leastSquares(design, values, weights)
  if (!solution) return null
  for (let round = 1; round < rounds; round += 1) {
    const current = solution
    const residuals = design.map((row, i) => values[i] - row.reduce((sum, x, j) => sum + x * current[j], 0))
    const huber = huberWeights(residuals)
    weights = base.map((w, i) => w * huber[i])
    const next = leastSquares(design, values, weights)
    if (!next) break
    solution = next
  }
  const coefficients = flat ? { a: solution[0], b: 0, c: solution[1] } : { a: solution[0], b: solution[1], c: solution[2] }
  const residuals = new Map<string, number>()
  used.forEach((anchor, i) => {
    residuals.set(anchor.id, values[i] - (coefficients.a * anchor.pixel.u + coefficients.b * anchor.pixel.v + coefficients.c))
  })
  return { ...coefficients, residuals, used }
}

/**
 * Register an orthographic image against known facade coordinates.
 *
 * Returns a frame whatever happens — a refusal is a result, and a caller that
 * gets `METRIC_FRAME_INVALID` has learnt something the absence of a frame
 * would not have told it.
 */
export function registerOrthographic(input: OrthographicFitInput, options: OrthographicFitOptions = {}): MetricImageFrame {
  const opt = { ...DEFAULTS, ...options }
  const anchors = [...input.anchors].sort((a, b) => a.id.localeCompare(b.id))

  const horizontalAnchors = anchors.filter((a) => a.metric.x !== undefined)
  const verticalAnchors = anchors.filter((a) => a.metric.y !== undefined)

  // Hold one anchor per axis out, when there is one to spare. The one held out
  // is the most redundant — never an extreme, because dropping an endpoint
  // turns an interpolation into an extrapolation and tests nothing useful.
  const heldOut = new Set<string>()
  if (opt.holdOut) {
    for (const group of [horizontalAnchors, verticalAnchors]) {
      if (group.length < 4) continue
      const axis = group === horizontalAnchors ? 'x' : 'y'
      const sorted = [...group].sort((a, b) => (a.metric[axis] as number) - (b.metric[axis] as number))
      const middle = sorted[Math.floor(sorted.length / 2)]
      if (middle) heldOut.add(middle.id)
    }
  }
  const fitting = anchors.filter((a) => !heldOut.has(a.id))

  const horizontal = fitAxis(fitting, (a) => a.metric.x, opt.rounds)
  const vertical = fitAxis(fitting, (a) => a.metric.y, opt.rounds)

  const residuals: AnchorResidual[] = []
  const allResidualsM: number[] = []
  const record = (anchor: MetricAnchor): void => {
    const rx = horizontal && anchor.metric.x !== undefined ? anchor.metric.x - (horizontal.a * anchor.pixel.u + horizontal.b * anchor.pixel.v + horizontal.c) : undefined
    const ry = vertical && anchor.metric.y !== undefined ? anchor.metric.y - (vertical.a * anchor.pixel.u + vertical.b * anchor.pixel.v + vertical.c) : undefined
    const worst = Math.max(Math.abs(rx ?? 0), Math.abs(ry ?? 0))
    if (rx !== undefined || ry !== undefined) allResidualsM.push(worst)
    const inlier = worst <= opt.toleranceM
    residuals.push({
      anchorId: anchor.id,
      residualXM: rx === undefined ? undefined : round6(rx),
      residualYM: ry === undefined ? undefined : round6(ry),
      inlier,
      why: heldOut.has(anchor.id)
        ? `held out of the fit and checked against it: ${worst.toFixed(3)} m away`
        : inlier
          ? `${worst.toFixed(3)} m from the fit`
          : `${worst.toFixed(3)} m from the fit, beyond the ${opt.toleranceM} m this drawing is believed to`,
    })
  }
  for (const anchor of anchors) record(anchor)

  const failed = (why: string): MetricImageFrame => ({
    schema: METRIC_FRAME_SCHEMA,
    schemaVersion: METRIC_FRAME_SCHEMA_VERSION,
    id: input.id,
    assetId: input.assetId,
    sourceFrameId: input.sourceFrameId,
    projection: 'ORTHOGRAPHIC_2D',
    horizontalAxis: input.horizontalAxis,
    horizontalReversed: false,
    region: input.region,
    anchors,
    residuals,
    transform: { kind: 'ORTHOGRAPHIC_AFFINE', ax: 1, bx: 0, cx: 0, ay: 1, by: 0, cy: 0, metresPerPixelU: 1, metresPerPixelV: 1, anisotropy: 1, scaleSigmaU: 1, scaleSigmaV: 1 },
    rmsResidualPx: 0,
    maxResidualPx: 0,
    metricResidualM: 0,
    confidence: 0,
    uncertainty: { metrePerPixelU: 0, metrePerPixelV: 0, anchorRmsM: 0, anchorMaxM: 0, systematicM: 0 },
    independentCheckAnchorIds: [...heldOut].sort(),
    status: 'METRIC_FRAME_INVALID',
    why,
  })

  if (!horizontal) return failed(`only ${horizontalAnchors.length} anchor states a horizontal coordinate, and a scale needs two`)
  if (!vertical) return failed(`only ${verticalAnchors.length} anchor states a height, and a scale needs two`)

  const metresPerPixelU = Math.hypot(horizontal.a, vertical.a)
  const metresPerPixelV = Math.hypot(horizontal.b, vertical.b)
  if (!(metresPerPixelU > 0) || !(metresPerPixelV > 0)) return failed('the fit came out degenerate: one of the two axes has no scale')
  const anisotropy = Math.max(metresPerPixelU, metresPerPixelV) / Math.min(metresPerPixelU, metresPerPixelV)
  if (anisotropy > opt.maxAnisotropy) {
    return failed(`the two axes scale by ${metresPerPixelU.toFixed(5)} and ${metresPerPixelV.toFixed(5)} m per pixel, ${anisotropy.toFixed(2)}× apart: the anchors do not describe one orthographic plane`)
  }

  const inliers = residuals.filter((r) => r.inlier)
  const worstResidual = allResidualsM.length === 0 ? 0 : Math.max(...allResidualsM)
  const rmsM = allResidualsM.length === 0 ? 0 : Math.sqrt(allResidualsM.reduce((sum, r) => sum + r * r, 0) / allResidualsM.length)

  // How sure the scale is: spread the residuals over the span the anchors
  // cover. Two anchors a metre apart that disagree by a centimetre say far
  // less about a 12 m facade than two anchors twelve metres apart do.
  const spanOf = (group: readonly MetricAnchor[], axis: 'x' | 'y'): number => {
    const values = group.map((a) => a.metric[axis] as number)
    return values.length < 2 ? 0 : Math.max(...values) - Math.min(...values)
  }
  const spanX = spanOf(horizontalAnchors, 'x')
  const spanY = spanOf(verticalAnchors, 'y')
  const scaleSigmaU = spanX > 0 ? rmsM / spanX : 1
  const scaleSigmaV = spanY > 0 ? rmsM / spanY : 1

  const transform: OrthographicTransform = {
    kind: 'ORTHOGRAPHIC_AFFINE',
    ax: round6(horizontal.a),
    bx: round6(horizontal.b),
    cx: round6(horizontal.c),
    ay: round6(vertical.a),
    by: round6(vertical.b),
    cy: round6(vertical.c),
    metresPerPixelU: round6(metresPerPixelU),
    metresPerPixelV: round6(metresPerPixelV),
    anisotropy: round6(anisotropy),
    scaleSigmaU: round6(scaleSigmaU),
    scaleSigmaV: round6(scaleSigmaV),
  }

  const held = residuals.filter((r) => heldOut.has(r.anchorId))
  const heldWorst = held.length === 0 ? 0 : Math.max(...held.map((r) => Math.max(Math.abs(r.residualXM ?? 0), Math.abs(r.residualYM ?? 0))))
  const outliers = residuals.length - inliers.length
  const status = outliers === 0 && (held.length === 0 || heldWorst <= opt.toleranceM) ? 'METRIC_FRAME_VALID' : outliers > residuals.length / 2 ? 'METRIC_FRAME_INVALID' : 'METRIC_FRAME_PARTIAL'

  // One pixel is the floor under everything measured here.
  const systematicM = Math.max(metresPerPixelU, metresPerPixelV) + rmsM

  return {
    schema: METRIC_FRAME_SCHEMA,
    schemaVersion: METRIC_FRAME_SCHEMA_VERSION,
    id: input.id,
    assetId: input.assetId,
    sourceFrameId: input.sourceFrameId,
    projection: 'ORTHOGRAPHIC_2D',
    horizontalAxis: input.horizontalAxis,
    horizontalReversed: horizontal.a < 0,
    region: input.region,
    anchors,
    residuals,
    transform,
    rmsResidualPx: round6(rmsM / Math.max(1e-9, metresPerPixelU)),
    maxResidualPx: round6(worstResidual / Math.max(1e-9, metresPerPixelU)),
    metricResidualM: round6(rmsM),
    confidence: round6(Math.max(0.05, Math.min(0.95, 0.95 - rmsM * 2 - outliers * 0.1))),
    uncertainty: {
      metrePerPixelU: round6(metresPerPixelU),
      metrePerPixelV: round6(metresPerPixelV),
      anchorRmsM: round6(rmsM),
      anchorMaxM: round6(worstResidual),
      systematicM: round6(systematicM),
    },
    independentCheckAnchorIds: [...heldOut].sort(),
    status,
    why:
      `${horizontal.used.length} horizontal and ${vertical.used.length} vertical anchors over ${spanX.toFixed(2)} × ${spanY.toFixed(2)} m give ` +
      `${(metresPerPixelU * 1000).toFixed(1)} and ${(metresPerPixelV * 1000).toFixed(1)} mm per pixel, ${rmsM.toFixed(3)} m rms` +
      (held.length > 0 ? `; ${held.length} anchor${held.length === 1 ? '' : 's'} held out and missed by ${heldWorst.toFixed(3)} m` : '') +
      (outliers > 0 ? `; ${outliers} anchor${outliers === 1 ? '' : 's'} beyond tolerance` : ''),
  }
}

/** The median of a set of residuals, for a caller reporting on a batch of frames. */
export const medianResidual = (frames: readonly MetricImageFrame[]): number => median(frames.map((f) => f.metricResidualM))
