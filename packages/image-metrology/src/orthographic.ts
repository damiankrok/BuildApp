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
 *
 * And it only fits what the anchors can actually see. The `b` terms above are
 * unidentifiable when every anchor for an axis was read off the same scanline
 * — which is the normal case, not a corner one, since wall faces are naturally
 * read across a single row. Left to itself the solver happily returns a
 * spurious cross term that explains all of those anchors to the millimetre:
 * on a four-anchor fixture it reported a scale seventeen per cent wrong, an
 * rms of 0.000 m and a VALID frame. Silently wrong geometry with maximum
 * confidence is the one outcome this package must never produce, so a term the
 * anchors cannot resolve is dropped and the fit says so.
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
  /**
   * Refuse a fit whose two scales differ by more than this.
   *
   * Deliberately loose. A published raster is routinely resized
   * anisotropically — §19 requires a 0.7 vertical squash to register, which is
   * a ratio of 1.43 — so this is not a squareness check. It is there for the
   * case a squareness check cannot be replaced by anything better: two anchors
   * per axis leave no residual to inspect, and a ratio of three or four means
   * an anchor is on the wrong feature rather than that the raster was resized.
   */
  maxAnisotropy?: number
}

/**
 * Twelve decimals, not six.
 *
 * `round6` is the repo's determinism helper and it is right for a pixel
 * coordinate, where six decimals is far more than a raster can mean. It is
 * wrong for a metres-per-pixel coefficient: 0.008333… rounds to 0.008333,
 * which is four significant figures, and that is a fifth of a millimetre of
 * error per hundred pixels built into every measurement the frame ever makes.
 * Twelve is still exactly reproducible and costs nothing.
 */
const exact = (v: number): number => {
  const r = Math.round(v * 1e12) / 1e12
  return r === 0 ? 0 : r
}

const DEFAULTS: Required<OrthographicFitOptions> = { toleranceM: 0.25, rounds: 3, holdOut: true, maxAnisotropy: 2.5 }

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
function fitAxis(
  anchors: readonly MetricAnchor[],
  value: (a: MetricAnchor) => number | undefined,
  /** Which pixel coordinate this metric axis mainly runs along. */
  primary: 'u' | 'v',
  rounds: number,
): { a: number; b: number; c: number; residuals: Map<string, number>; used: MetricAnchor[]; flat: boolean } | null {
  const used = anchors.filter((anchor) => value(anchor) !== undefined)
  if (used.length < 2) return null
  const rows = used.map((anchor) => [anchor.pixel.u, anchor.pixel.v, 1])
  const values = used.map((anchor) => value(anchor) as number)
  // A metric sigma of zero means "exact", which as a weight is infinite. The
  // floor is one millimetre: below that the difference between two anchors is
  // not something any drawing can express.
  const base = used.map((anchor) => 1 / Math.max(1e-3, anchor.metricSigma) ** 2)

  // Which columns the anchors can actually resolve.
  //
  // WHICH term to drop depends on the axis. A facade coordinate runs along u
  // and a height runs along v, so dropping v for both would fit height against
  // horizontal position — a number that means nothing, and one that two
  // anchors at different places on the facade will happily produce.
  const keep = primary === 'u' ? 0 : 1
  const cross = 1 - keep
  const spread = (j: number): number => {
    const values = rows.map((row) => row[j])
    return Math.max(...values) - Math.min(...values)
  }
  // The cross term is worth fitting only when the anchors move along it enough
  // to say anything. Below a tenth of their spread along the primary axis it
  // is fitted to rounding, and a rank-deficient system does not announce
  // itself: it returns an exact fit and a wrong scale.
  const crossSpread = spread(cross)
  const flat = used.length < 3 || crossSpread < 0.1 * spread(keep)
  const design = flat ? rows.map((row) => [row[keep], row[2]]) : rows
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
  const coefficients = flat
    ? primary === 'u'
      ? { a: solution[0], b: 0, c: solution[1] }
      : { a: 0, b: solution[0], c: solution[1] }
    : { a: solution[0], b: solution[1], c: solution[2] }
  if (!Number.isFinite(coefficients.a) || !Number.isFinite(coefficients.b) || !Number.isFinite(coefficients.c)) return null
  const residuals = new Map<string, number>()
  used.forEach((anchor, i) => {
    residuals.set(anchor.id, values[i] - (coefficients.a * anchor.pixel.u + coefficients.b * anchor.pixel.v + coefficients.c))
  })
  return { ...coefficients, residuals, used, flat }
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

  const horizontal = fitAxis(fitting, (a) => a.metric.x, 'u', opt.rounds)
  const vertical = fitAxis(fitting, (a) => a.metric.y, 'v', opt.rounds)

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

  if (!horizontal) {
    return failed(
      horizontalAnchors.length < 2
        ? `only ${horizontalAnchors.length} anchor states a horizontal coordinate, and a scale needs two`
        : `${horizontalAnchors.length} anchors state a horizontal coordinate but they do not pin a scale between them`,
    )
  }
  if (!vertical) {
    return failed(
      verticalAnchors.length < 2 ? `only ${verticalAnchors.length} anchor states a height, and a scale needs two` : `${verticalAnchors.length} anchors state a height but they do not pin a scale between them`,
    )
  }

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
    ax: exact(horizontal.a),
    bx: exact(horizontal.b),
    cx: exact(horizontal.c),
    ay: exact(vertical.a),
    by: exact(vertical.b),
    cy: exact(vertical.c),
    metresPerPixelU: exact(metresPerPixelU),
    metresPerPixelV: exact(metresPerPixelV),
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
      (held.length > 0
        ? `; ${held.length} anchor${held.length === 1 ? '' : 's'} held out and missed by ${heldWorst.toFixed(3)} m`
        : '; with no anchor to spare none was held back, so nothing here has been checked against a coordinate the fit did not already see') +
      (outliers > 0 ? `; ${outliers} anchor${outliers === 1 ? '' : 's'} beyond tolerance` : ''),
  }
}

/** The median of a set of residuals, for a caller reporting on a batch of frames. */
export const medianResidual = (frames: readonly MetricImageFrame[]): number => median(frames.map((f) => f.metricResidualM))
