/**
 * Reading a length off a registered image, with the error bar it has earned.
 *
 * §9 is the point of this module. A measurement with no uncertainty is a claim
 * nobody can argue with, and on a 1280 px render of a 12 m house the arithmetic
 * is not intimidating: one pixel is about 17 mm, so an edge found to within
 * five pixels is an edge found to within nine centimetres. Numbers like that
 * are worth stating; a half-metre error on the same drawing is a bug, not a
 * limit, and this module exists partly so that the difference is visible.
 *
 * Three things go into the bar:
 *
 *  - the two EDGES, each with its own pixel sigma, converted at the frame's
 *    scale and added in quadrature;
 *  - the SCALE itself, which is only as good as the anchors that fixed it, and
 *    whose fractional error multiplies the length being measured;
 *  - the REGISTRATION, the residual the anchors left behind, which shifts both
 *    ends together and so enters once rather than twice.
 */
import { round6 } from '@buildapp/source-common'
import { toMetric } from './frame.js'
import type { ImageMetricMeasurement, MeasurementRole, MetricImageFrame } from './frame.js'

export type IntervalInput = {
  id: string
  quantity: string
  /** The two pixel coordinates bounding the interval, on one axis. */
  from: number
  to: number
  /** How sure each of them is, in pixels. */
  fromSigmaPx?: number
  toSigmaPx?: number
  /** Where on the other axis the interval was taken, so the affine `b` terms apply. */
  at?: number
  role?: MeasurementRole
  extractor?: string
  why?: string
}

const DEFAULT_SIGMA_PX = 1.5

/** Measure a horizontal interval — a width, an offset along a facade. */
export function measureHorizontal(frame: MetricImageFrame, input: IntervalInput): ImageMetricMeasurement {
  return measureInterval(frame, input, 'u')
}

/** Measure a vertical interval — a height, a sill, a head. */
export function measureVertical(frame: MetricImageFrame, input: IntervalInput): ImageMetricMeasurement {
  return measureInterval(frame, input, 'v')
}

function measureInterval(frame: MetricImageFrame, input: IntervalInput, axis: 'u' | 'v'): ImageMetricMeasurement {
  const at = input.at ?? (axis === 'u' ? (frame.region.y0 + frame.region.y1) / 2 : (frame.region.x0 + frame.region.x1) / 2)
  const point = (t: number): { x: number; y: number } => (axis === 'u' ? toMetric(frame, t, at) : toMetric(frame, at, t))
  const a = point(input.from)
  const b = point(input.to)
  const metricAxis = axis === 'u' ? 'x' : 'y'
  const valueM = Math.abs((metricAxis === 'x' ? b.x : b.y) - (metricAxis === 'x' ? a.x : a.y))

  const scaleM = axis === 'u' ? frame.uncertainty.metrePerPixelU : frame.uncertainty.metrePerPixelV
  const fromSigma = input.fromSigmaPx ?? DEFAULT_SIGMA_PX
  const toSigma = input.toSigmaPx ?? DEFAULT_SIGMA_PX
  const edgesM = Math.hypot(fromSigma * scaleM, toSigma * scaleM)
  const fractional = axis === 'u' ? (frame.transform.kind === 'ORTHOGRAPHIC_AFFINE' ? frame.transform.scaleSigmaU : 0.02) : frame.transform.kind === 'ORTHOGRAPHIC_AFFINE' ? frame.transform.scaleSigmaV : 0.02
  const scaleUncertaintyM = valueM * fractional
  // The anchor residual moves both ends of an interval the same way, so it
  // largely cancels out of a WIDTH and does not cancel out of a POSITION. Half
  // of it is the honest allowance for what does not cancel.
  const registrationM = frame.uncertainty.anchorRmsM / 2

  const uncertaintyM = Math.hypot(edgesM, scaleUncertaintyM, registrationM)
  const interval = { from: round6(Math.min(input.from, input.to)), to: round6(Math.max(input.from, input.to)) }
  const metricInterval = {
    from: round6(Math.min(metricAxis === 'x' ? a.x : a.y, metricAxis === 'x' ? b.x : b.y)),
    to: round6(Math.max(metricAxis === 'x' ? a.x : a.y, metricAxis === 'x' ? b.x : b.y)),
  }

  return {
    id: input.id,
    frameId: frame.id,
    sourceAssetId: frame.assetId,
    quantity: input.quantity,
    pixel: axis === 'u' ? { u: interval } : { v: interval },
    metric: metricAxis === 'x' ? { x: metricInterval } : { y: metricInterval },
    valueM: round6(valueM),
    uncertaintyM: round6(uncertaintyM),
    uncertaintyParts: { edgesM: round6(edgesM), scaleM: round6(scaleUncertaintyM), registrationM: round6(registrationM) },
    role: input.role ?? 'INDEPENDENT_MEASUREMENT',
    edgeSigmaPx: { from: round6(fromSigma), to: round6(toSigma) },
    extractor: input.extractor ?? 'image-metrology.interval',
    confidence: round6(Math.max(0.05, Math.min(0.95, frame.confidence * (1 - Math.min(0.8, uncertaintyM / Math.max(0.05, valueM)))))),
    why:
      `${Math.abs(input.to - input.from).toFixed(1)} px at ${(scaleM * 1000).toFixed(1)} mm per pixel is ${valueM.toFixed(3)} m, ` +
      `± ${uncertaintyM.toFixed(3)} (edges ${edgesM.toFixed(3)}, scale ${scaleUncertaintyM.toFixed(3)}, registration ${registrationM.toFixed(3)})` +
      (input.why ? `; ${input.why}` : ''),
  }
}

/** Whether a measurement is tight enough to be worth treating as a statement rather than an impression. */
export const isTight = (m: ImageMetricMeasurement, limitM = 0.15): boolean => m.uncertaintyM <= limitM
