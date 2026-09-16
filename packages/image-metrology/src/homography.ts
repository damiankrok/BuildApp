/**
 * §11A. Registering a facade seen at an angle.
 *
 * An orthographic elevation collapses to a scale and an offset per axis. A
 * photograph of the same wall does not: the far end of it is smaller, and no
 * affine map can express that. What can is a planar homography, because the
 * wall IS a plane and a pinhole camera maps one plane to another by a 3×3
 * projective transform.
 *
 * Four correspondences between points on that wall and their metric positions
 * on it fix the eight degrees of freedom. More than four over-determine it,
 * which is the useful case: the extra ones are what say whether the wall is
 * really a plane, whether the points are really on it, and how far out any one
 * of them is.
 *
 * Two things here are not optional and both are about conditioning.
 *
 * NORMALISATION. Solving the raw system with pixel coordinates in the
 * hundreds and metric coordinates in the units mixes terms that differ by four
 * orders of magnitude, and the answer is dominated by rounding. Both sets of
 * points are moved to their centroid and scaled to an average distance of √2
 * first, and the transform is un-normalised afterwards — Hartley's
 * normalisation, and the difference between a homography that measures and one
 * that looks plausible.
 *
 * RANSAC. A single correspondence on the wrong feature does not bend a
 * homography, it breaks it: eight degrees of freedom will happily contort to
 * pass through a bad point and take the other seven with them. So the fit is
 * made from minimal sets and scored on how many of the rest it explains, and
 * only then refined on the agreed ones.
 */
import { round6 } from '@buildapp/source-common'
import { METRIC_FRAME_SCHEMA, METRIC_FRAME_SCHEMA_VERSION, applyHomography } from './frame.js'
import type { AnchorResidual, FacadeAxis, HomographyTransform, MetricAnchor, MetricImageFrame } from './frame.js'
import { median, smallestSingularVector } from './linalg.js'

export type PlaneCorrespondence = {
  id: string
  /** Where it is in the picture. */
  pixel: { u: number; v: number }
  /** And where it is on the wall, in metres along it and up it. */
  metric: { x: number; y: number }
}

export type HomographyOptions = {
  /** How far a correspondence may be reprojected from where it was seen, in pixels, and still count. */
  tolerancePx?: number
  /** How many minimal sets to try. Deterministic: they are enumerated, not sampled. */
  maxTrials?: number
  /** Refuse a fit that explains fewer than this share of the correspondences. */
  minInlierShare?: number
}

const DEFAULTS: Required<HomographyOptions> = { tolerancePx: 3, maxTrials: 240, minInlierShare: 0.6 }

type Similarity = { scale: number; cx: number; cy: number }

/** Hartley normalisation: centroid to the origin, average distance to √2. */
function normalisation(points: ReadonlyArray<{ x: number; y: number }>): Similarity {
  const cx = points.reduce((a, p) => a + p.x, 0) / points.length
  const cy = points.reduce((a, p) => a + p.y, 0) / points.length
  const mean = points.reduce((a, p) => a + Math.hypot(p.x - cx, p.y - cy), 0) / points.length
  return { scale: mean > 1e-12 ? Math.SQRT2 / mean : 1, cx, cy }
}

const multiply = (a: readonly number[], b: readonly number[]): number[] => {
  const out = new Array<number>(9).fill(0)
  for (let r = 0; r < 3; r += 1) for (let c = 0; c < 3; c += 1) for (let k = 0; k < 3; k += 1) out[r * 3 + c] += a[r * 3 + k] * b[k * 3 + c]
  return out
}

export function invert3(h: readonly number[]): number[] | null {
  const [a, b, c, d, e, f, g, i, j] = h
  const det = a * (e * j - f * i) - b * (d * j - f * g) + c * (d * i - e * g)
  if (!Number.isFinite(det) || Math.abs(det) < 1e-18) return null
  const inv = [e * j - f * i, c * i - b * j, b * f - c * e, f * g - d * j, a * j - c * g, c * d - a * f, d * i - e * g, b * g - a * i, a * e - b * d]
  return inv.map((x) => x / det)
}

/** The direct linear transform on four or more correspondences, normalised both ways. */
export function fitHomography(points: readonly PlaneCorrespondence[]): number[] | null {
  if (points.length < 4) return null
  const from = normalisation(points.map((p) => ({ x: p.pixel.u, y: p.pixel.v })))
  const to = normalisation(points.map((p) => p.metric))
  const rows: number[][] = []
  for (const p of points) {
    const u = (p.pixel.u - from.cx) * from.scale
    const v = (p.pixel.v - from.cy) * from.scale
    const x = (p.metric.x - to.cx) * to.scale
    const y = (p.metric.y - to.cy) * to.scale
    rows.push([-u, -v, -1, 0, 0, 0, x * u, x * v, x])
    rows.push([0, 0, 0, -u, -v, -1, y * u, y * v, y])
  }
  const h = smallestSingularVector(rows)
  if (!h) return null
  // Un-normalise: H = T_to^-1 · Ĥ · T_from
  const tFrom = [from.scale, 0, -from.scale * from.cx, 0, from.scale, -from.scale * from.cy, 0, 0, 1]
  const tToInverse = [1 / to.scale, 0, to.cx, 0, 1 / to.scale, to.cy, 0, 0, 1]
  const full = multiply(tToInverse, multiply(h, tFrom))
  if (!full.every((x) => Number.isFinite(x))) return null
  const scale = full[8]
  return Math.abs(scale) > 1e-12 ? full.map((x) => x / scale) : full
}

/** How far each correspondence lands from where it was seen, in pixels. */
export function reprojectionErrors(h: readonly number[], points: readonly PlaneCorrespondence[]): number[] {
  const inverse = invert3(h)
  if (!inverse) return points.map(() => Number.POSITIVE_INFINITY)
  return points.map((p) => {
    const back = applyHomography(inverse, p.metric.x, p.metric.y)
    return Math.hypot(back.x - p.pixel.u, back.y - p.pixel.v)
  })
}

export type HomographyFit = {
  h: number[]
  inverse: number[]
  inlierIds: string[]
  errorsPx: number[]
  rmsPx: number
  maxPx: number
  why: string
}

/**
 * Fit robustly: minimal sets first, then a refit on everything the best of
 * them explains.
 *
 * The minimal sets are ENUMERATED rather than sampled, in a fixed order, so
 * the same correspondences always give the same homography. With more than a
 * handful of points the enumeration is capped and the first `maxTrials`
 * combinations are used — still a fixed set, still the same answer twice.
 */
export function fitHomographyRobust(points: readonly PlaneCorrespondence[], options: HomographyOptions = {}): HomographyFit | null {
  const opt = { ...DEFAULTS, ...options }
  if (points.length < 4) return null
  const ordered = [...points].sort((a, b) => a.id.localeCompare(b.id))
  let best: { inliers: PlaneCorrespondence[]; h: number[] } | null = null
  let trials = 0
  outer: for (let a = 0; a < ordered.length - 3; a += 1) {
    for (let b = a + 1; b < ordered.length - 2; b += 1) {
      for (let c = b + 1; c < ordered.length - 1; c += 1) {
        for (let d = c + 1; d < ordered.length; d += 1) {
          if (trials >= opt.maxTrials) break outer
          trials += 1
          const h = fitHomography([ordered[a], ordered[b], ordered[c], ordered[d]])
          if (!h) continue
          const errors = reprojectionErrors(h, ordered)
          const inliers = ordered.filter((_, i) => errors[i] <= opt.tolerancePx)
          if (!best || inliers.length > best.inliers.length) best = { inliers, h }
          if (best.inliers.length === ordered.length) break outer
        }
      }
    }
  }
  if (!best || best.inliers.length < Math.max(4, Math.ceil(ordered.length * opt.minInlierShare))) return null
  // Refit on everything the winner explains: a minimal set fits four points
  // exactly and says nothing about the rest.
  const refined = fitHomography(best.inliers) ?? best.h
  const errors = reprojectionErrors(refined, ordered)
  const inlierIds = ordered.filter((_, i) => errors[i] <= opt.tolerancePx).map((p) => p.id)
  const inverse = invert3(refined)
  if (!inverse) return null
  const kept = errors.filter((e) => e <= opt.tolerancePx)
  const rms = kept.length === 0 ? Number.POSITIVE_INFINITY : Math.sqrt(kept.reduce((s, e) => s + e * e, 0) / kept.length)
  return {
    h: refined.map(round6),
    inverse: inverse.map(round6),
    inlierIds,
    errorsPx: errors.map(round6),
    rmsPx: round6(rms),
    maxPx: round6(Math.max(...errors)),
    why:
      `${inlierIds.length} of ${ordered.length} correspondences agree on one plane to within ${opt.tolerancePx} px after ${trials} minimal fits, ` +
      `${rms.toFixed(2)} px rms and ${Math.max(...kept).toFixed(2)} px worst among them`,
  }
}

export type PerspectiveFitInput = {
  id: string
  assetId: string
  sourceFrameId?: string
  horizontalAxis: FacadeAxis
  region: { x0: number; y0: number; x1: number; y1: number }
  correspondences: readonly PlaneCorrespondence[]
}

/**
 * Register a facade plane seen in perspective.
 *
 * The frame that comes back measures the same way an orthographic one does —
 * `toMetric` knows about both — with one difference a caller has to respect:
 * the scale VARIES ACROSS THE PICTURE. `metresPerPixel` on the transform is
 * the scale at the middle of the region and nothing more, so a measurement is
 * taken by mapping both of its ends and subtracting, never by multiplying a
 * pixel length by a number.
 */
export function registerPerspectivePlane(input: PerspectiveFitInput, options: HomographyOptions = {}): MetricImageFrame {
  const opt = { ...DEFAULTS, ...options }
  const anchors: MetricAnchor[] = [...input.correspondences]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((p) => ({
      id: p.id,
      pixel: p.pixel,
      metric: { x: p.metric.x, y: p.metric.y },
      pixelSigma: 1,
      metricSigma: 0.01,
      kind: 'PLANE_POINT',
      evidenceIds: [],
      why: 'a point on the facade plane, with its position on that plane',
    }))
  const fit = fitHomographyRobust(input.correspondences, opt)

  const shell = (transform: MetricImageFrame['transform'], residuals: AnchorResidual[], status: MetricImageFrame['status'], why: string, uncertainty: MetricImageFrame['uncertainty'], rmsPx: number, maxPx: number): MetricImageFrame => ({
    schema: METRIC_FRAME_SCHEMA,
    schemaVersion: METRIC_FRAME_SCHEMA_VERSION,
    id: input.id,
    assetId: input.assetId,
    sourceFrameId: input.sourceFrameId,
    projection: 'PLANAR_PERSPECTIVE',
    horizontalAxis: input.horizontalAxis,
    horizontalReversed: false,
    region: input.region,
    anchors,
    residuals,
    transform,
    rmsResidualPx: round6(rmsPx),
    maxResidualPx: round6(maxPx),
    metricResidualM: round6(uncertainty.anchorRmsM),
    confidence: round6(Math.max(0.05, Math.min(0.9, 0.9 - rmsPx * 0.05))),
    uncertainty,
    independentCheckAnchorIds: [],
    status,
    why,
  })

  if (!fit) {
    return shell(
      { kind: 'ORTHOGRAPHIC_AFFINE', ax: 1, bx: 0, cx: 0, ay: 1, by: 0, cy: 0, metresPerPixelU: 1, metresPerPixelV: 1, anisotropy: 1, scaleSigmaU: 1, scaleSigmaV: 1 },
      anchors.map((a) => ({ anchorId: a.id, inlier: false, why: 'no plane explains these correspondences' })),
      'METRIC_FRAME_INVALID',
      `${input.correspondences.length} correspondences, and no single plane explains enough of them to be called a facade`,
      { metrePerPixelU: 0, metrePerPixelV: 0, anchorRmsM: 0, anchorMaxM: 0, systematicM: 0 },
      0,
      0,
    )
  }

  // The scale at the middle of the region: a reader's number, not a
  // measurement tool.
  const midU = (input.region.x0 + input.region.x1) / 2
  const midV = (input.region.y0 + input.region.y1) / 2
  const centre = applyHomography(fit.h, midU, midV)
  const alongU = applyHomography(fit.h, midU + 1, midV)
  const alongV = applyHomography(fit.h, midU, midV + 1)
  const metresPerPixelU = Math.hypot(alongU.x - centre.x, alongU.y - centre.y)
  const metresPerPixelV = Math.hypot(alongV.x - centre.x, alongV.y - centre.y)
  const transform: HomographyTransform = {
    kind: 'PLANAR_HOMOGRAPHY',
    h: fit.h,
    inverse: fit.inverse,
    metresPerPixelU: metresPerPixelU > 0 ? round6(metresPerPixelU) : 1e-6,
    metresPerPixelV: metresPerPixelV > 0 ? round6(metresPerPixelV) : 1e-6,
  }

  const inliers = new Set(fit.inlierIds)
  const metricErrors: number[] = []
  const residuals: AnchorResidual[] = anchors.map((anchor, i) => {
    const got = applyHomography(fit.h, anchor.pixel.u, anchor.pixel.v)
    const rx = (anchor.metric.x ?? 0) - got.x
    const ry = (anchor.metric.y ?? 0) - got.y
    metricErrors.push(Math.max(Math.abs(rx), Math.abs(ry)))
    return {
      anchorId: anchor.id,
      residualXM: round6(rx),
      residualYM: round6(ry),
      inlier: inliers.has(anchor.id),
      why: `${fit.errorsPx[i].toFixed(2)} px from where the plane puts it, ${Math.max(Math.abs(rx), Math.abs(ry)).toFixed(3)} m on the wall`,
    }
  })
  const kept = metricErrors.filter((_, i) => inliers.has(anchors[i].id))
  const rmsM = kept.length === 0 ? 0 : Math.sqrt(kept.reduce((s, e) => s + e * e, 0) / kept.length)
  const uncertainty = {
    metrePerPixelU: round6(metresPerPixelU),
    metrePerPixelV: round6(metresPerPixelV),
    anchorRmsM: round6(rmsM),
    anchorMaxM: round6(Math.max(0, ...metricErrors)),
    systematicM: round6(Math.max(metresPerPixelU, metresPerPixelV) + rmsM),
  }
  const outliers = anchors.length - inliers.size
  return shell(
    transform,
    residuals,
    outliers === 0 ? 'METRIC_FRAME_VALID' : outliers * 2 > anchors.length ? 'METRIC_FRAME_INVALID' : 'METRIC_FRAME_PARTIAL',
    `${fit.why}; at the centre of the region that is ${(metresPerPixelU * 1000).toFixed(1)} × ${(metresPerPixelV * 1000).toFixed(1)} mm per pixel, which varies across a perspective view and is for reading rather than measuring with`,
    uncertainty,
    fit.rmsPx,
    fit.maxPx,
  )
}

/** The median reprojection error of a fit, for a caller reporting on a batch. */
export const medianReprojection = (fit: HomographyFit): number => median(fit.errorsPx)
