/**
 * A metric image frame: the thing that turns pixels into metres.
 *
 * The whole package exists because of one arithmetic fact. If a facade whose
 * real width is W occupies P pixels, then one pixel is W/P metres, and EVERY
 * interval on that axis can be read off in metres — not guessed, not matched
 * against typical sizes, read off. A 1280 px render of a 12 m house resolves
 * to about 17 mm per pixel; an edge found to within five pixels is an edge
 * found to within nine centimetres.
 *
 * What makes that legitimate rather than circular is the separation this
 * module enforces. An anchor is a coordinate the registration is FITTED to; a
 * measurement is a coordinate the registration is USED on. A window whose
 * width was fitted cannot then be reported as a measurement of that width,
 * and the contract records which each quantity was, so a benchmark can insist
 * on independent ones.
 */
import { z } from 'zod'

export const METRIC_FRAME_SCHEMA = 'buildapp.metric-image-frame'
export const METRIC_FRAME_SCHEMA_VERSION = '1.0.0'
export const SUPPORTED_METRIC_FRAME_VERSIONS = ['1.0.0'] as const

/** Which plane of the building an image is a picture of, and which way its axes run. */
export const FacadeAxisSchema = z.enum(['X', 'Z'])
export type FacadeAxis = z.infer<typeof FacadeAxisSchema>

export const ProjectionKindSchema = z.enum(['ORTHOGRAPHIC_2D', 'PLANAR_PERSPECTIVE', 'CAMERA_PERSPECTIVE'])
export type ProjectionKind = z.infer<typeof ProjectionKindSchema>

/**
 * How a coordinate was used. The distinction §5 turns on.
 *
 * - `REGISTRATION_ANCHOR` — the fit was made to this. Reporting it back as a
 *   measurement measures the fit, not the building.
 * - `INDEPENDENT_MEASUREMENT` — read off a registration that never saw it.
 * - `CORROBORATING_MEASUREMENT` — read off independently and found to agree
 *   with something another source already stated.
 */
export const MeasurementRoleSchema = z.enum(['REGISTRATION_ANCHOR', 'INDEPENDENT_MEASUREMENT', 'CORROBORATING_MEASUREMENT'])
export type MeasurementRole = z.infer<typeof MeasurementRoleSchema>

/**
 * A point or line in the image whose metric coordinate is known from elsewhere.
 *
 * `metric` may fix one axis and leave the other free: the ridge of a gable
 * fixes a height and says nothing about where along the facade it is, and a
 * wall face fixes a horizontal and says nothing about height. Anchors that fix
 * one axis are the common case on a building, and refusing them would leave
 * almost nothing to register with.
 */
export const MetricAnchorSchema = z
  .object({
    id: z.string().min(1),
    /** In image pixels. A line anchor still carries the point it was sampled at. */
    pixel: z.object({ u: z.number().finite(), v: z.number().finite() }).strict(),
    /** The metric coordinate this pixel is known to be at, per axis. */
    metric: z.object({ x: z.number().finite().optional(), y: z.number().finite().optional() }).strict(),
    /** How sure the PIXEL location is, in pixels. A crisp wall edge is sub-pixel; a rendered shadow is not. */
    pixelSigma: z.number().positive(),
    /** How sure the METRIC value is, in metres. A printed chain is exact; a derived eaves level is not. */
    metricSigma: z.number().nonnegative(),
    /** What in the building this is: a wall face, a ridge, a datum, a breakpoint. */
    kind: z.string().min(1),
    /** Where the metric value came from, so an anchor can be traced like anything else. */
    evidenceIds: z.array(z.string().min(1)),
    why: z.string().min(1),
  })
  .strict()
export type MetricAnchor = z.infer<typeof MetricAnchorSchema>

/**
 * The general affine image-to-facade map.
 *
 * `x_m = ax·u + bx·v + cx`, `y_m = ay·u + by·v + cy`.
 *
 * The `b` terms are kept even though a clean upright elevation collapses to
 * `x_m = sx·(u − u0)`, `y_m = sy·(v0 − v)`, because a published raster is
 * routinely resized anisotropically and occasionally sheared by a degree, and
 * a fit that cannot express that reports the shear as noise on every anchor.
 */
export const OrthographicTransformSchema = z
  .object({
    kind: z.literal('ORTHOGRAPHIC_AFFINE'),
    ax: z.number().finite(),
    bx: z.number().finite(),
    cx: z.number().finite(),
    ay: z.number().finite(),
    by: z.number().finite(),
    cy: z.number().finite(),
    /** Metres per pixel along each axis, for a reader: the norm of each row. */
    metresPerPixelU: z.number().positive(),
    metresPerPixelV: z.number().positive(),
    /** How far from square the two scales are. 1 is isotropic. */
    anisotropy: z.number().positive(),
    /** Fractional uncertainty on each scale, from the anchor residuals. */
    scaleSigmaU: z.number().nonnegative(),
    scaleSigmaV: z.number().nonnegative(),
  })
  .strict()
export type OrthographicTransform = z.infer<typeof OrthographicTransformSchema>

/** A 3×3 plane-to-plane map, row major, normalised so `h[8] === 1` where it can be. */
export const HomographyTransformSchema = z
  .object({
    kind: z.literal('PLANAR_HOMOGRAPHY'),
    h: z.array(z.number().finite()).length(9),
    /** The inverse, kept rather than recomputed so a measurement is never a matrix inversion away from a number. */
    inverse: z.array(z.number().finite()).length(9),
    /** Metres per pixel at the centre of the rectified region: a scale that varies across a perspective image. */
    metresPerPixelU: z.number().positive(),
    metresPerPixelV: z.number().positive(),
  })
  .strict()
export type HomographyTransform = z.infer<typeof HomographyTransformSchema>

/** A pinhole camera: intrinsics, rotation as a 3×3 row-major matrix, and a translation. */
export const CameraTransformSchema = z
  .object({
    kind: z.literal('CAMERA_PROJECTION'),
    focalPx: z.number().positive(),
    principal: z.object({ u: z.number().finite(), v: z.number().finite() }).strict(),
    rotation: z.array(z.number().finite()).length(9),
    translation: z.array(z.number().finite()).length(3),
    /** How many of the correspondences the pose actually explains. */
    inliers: z.number().int().nonnegative(),
  })
  .strict()
export type CameraTransform = z.infer<typeof CameraTransformSchema>

export const MetricTransformSchema = z.discriminatedUnion('kind', [OrthographicTransformSchema, HomographyTransformSchema, CameraTransformSchema])
export type MetricTransform = z.infer<typeof MetricTransformSchema>

export const FrameUncertaintySchema = z
  .object({
    /** One pixel, in metres, on each axis: the floor under every measurement from this frame. */
    metrePerPixelU: z.number().nonnegative(),
    metrePerPixelV: z.number().nonnegative(),
    /** What the anchors disagreed by, after the fit. */
    anchorRmsM: z.number().nonnegative(),
    anchorMaxM: z.number().nonnegative(),
    /** What an interval measured on this frame carries before its own edges are considered. */
    systematicM: z.number().nonnegative(),
  })
  .strict()
export type FrameUncertainty = z.infer<typeof FrameUncertaintySchema>

export const FrameStatusSchema = z.enum(['METRIC_FRAME_VALID', 'METRIC_FRAME_PARTIAL', 'METRIC_FRAME_INVALID'])
export type FrameStatus = z.infer<typeof FrameStatusSchema>

export const AnchorResidualSchema = z
  .object({
    anchorId: z.string().min(1),
    /** Signed residual on each axis the anchor constrains, in metres. */
    residualXM: z.number().finite().optional(),
    residualYM: z.number().finite().optional(),
    /** Whether the robust fit kept it. */
    inlier: z.boolean(),
    why: z.string().min(1),
  })
  .strict()
export type AnchorResidual = z.infer<typeof AnchorResidualSchema>

export const MetricImageFrameSchema = z
  .object({
    schema: z.literal(METRIC_FRAME_SCHEMA),
    schemaVersion: z.enum(SUPPORTED_METRIC_FRAME_VERSIONS),
    id: z.string().min(1),
    assetId: z.string().min(1),
    /** The observation frame this was registered from, when there is one. */
    sourceFrameId: z.string().min(1).optional(),
    projection: ProjectionKindSchema,
    /** Which world axis runs across the image, and which way round. */
    horizontalAxis: FacadeAxisSchema,
    /** True when world coordinate increases to the LEFT in the image: a facade seen from its far side. */
    horizontalReversed: z.boolean(),
    /** The part of the image the registration speaks for. Outside it, nothing. */
    region: z.object({ x0: z.number(), y0: z.number(), x1: z.number(), y1: z.number() }).strict(),
    anchors: z.array(MetricAnchorSchema),
    residuals: z.array(AnchorResidualSchema),
    transform: MetricTransformSchema,
    rmsResidualPx: z.number().nonnegative(),
    maxResidualPx: z.number().nonnegative(),
    metricResidualM: z.number().nonnegative(),
    confidence: z.number().min(0).max(1),
    uncertainty: FrameUncertaintySchema,
    /**
     * Anchors deliberately HELD OUT of the fit and then checked against it.
     *
     * A fit always explains what it was fitted to. The only honest test of a
     * registration is a coordinate it has never seen, so where there are
     * enough anchors one is kept back, and how far the frame missed it is the
     * number a reader should look at first.
     */
    independentCheckAnchorIds: z.array(z.string().min(1)),
    status: FrameStatusSchema,
    why: z.string().min(1),
  })
  .strict()
export type MetricImageFrame = z.infer<typeof MetricImageFrameSchema>

// ---------------------------------------------------------------------------
// Measurements
// ---------------------------------------------------------------------------

export const PixelIntervalSchema = z.object({ from: z.number().finite(), to: z.number().finite() }).strict()

export const ImageMetricMeasurementSchema = z
  .object({
    id: z.string().min(1),
    frameId: z.string().min(1),
    sourceAssetId: z.string().min(1),
    /** What was measured: an opening's width, a member's height, a facade's extent. */
    quantity: z.string().min(1),
    /** The pixels it was read from, so the number can always be checked against the picture. */
    pixel: z.object({ u: PixelIntervalSchema.optional(), v: PixelIntervalSchema.optional() }).strict(),
    /** And the metres they came to. */
    metric: z.object({ x: PixelIntervalSchema.optional(), y: PixelIntervalSchema.optional() }).strict(),
    valueM: z.number().finite(),
    uncertaintyM: z.number().nonnegative(),
    /** The pieces the uncertainty is made of, because a total nobody can decompose is a total nobody can argue with. */
    uncertaintyParts: z
      .object({ edgesM: z.number().nonnegative(), scaleM: z.number().nonnegative(), registrationM: z.number().nonnegative() })
      .strict(),
    role: MeasurementRoleSchema,
    /** How sure the two pixel edges were, in pixels. */
    edgeSigmaPx: z.object({ from: z.number().nonnegative(), to: z.number().nonnegative() }).strict(),
    extractor: z.string().min(1),
    confidence: z.number().min(0).max(1),
    why: z.string().min(1),
  })
  .strict()
export type ImageMetricMeasurement = z.infer<typeof ImageMetricMeasurementSchema>

// ---------------------------------------------------------------------------
// Using a frame
// ---------------------------------------------------------------------------

/** Map an image point to facade metres. */
export function toMetric(frame: MetricImageFrame, u: number, v: number): { x: number; y: number } {
  const t = frame.transform
  if (t.kind === 'ORTHOGRAPHIC_AFFINE') return { x: t.ax * u + t.bx * v + t.cx, y: t.ay * u + t.by * v + t.cy }
  if (t.kind === 'PLANAR_HOMOGRAPHY') return applyHomography(t.h, u, v)
  // A camera frame measures nothing on its own: a pixel is a ray, and a ray
  // needs a plane before it is a point. The caller rectifies first.
  return { x: Number.NaN, y: Number.NaN }
}

/** And back again, for drawing a known metre coordinate onto the picture. */
export function toPixel(frame: MetricImageFrame, x: number, y: number): { u: number; v: number } {
  const t = frame.transform
  if (t.kind === 'ORTHOGRAPHIC_AFFINE') {
    const det = t.ax * t.by - t.bx * t.ay
    if (Math.abs(det) < 1e-12) return { u: Number.NaN, v: Number.NaN }
    const dx = x - t.cx
    const dy = y - t.cy
    return { u: (dx * t.by - t.bx * dy) / det, v: (t.ax * dy - dx * t.ay) / det }
  }
  if (t.kind === 'PLANAR_HOMOGRAPHY') {
    const p = applyHomography(t.inverse, x, y)
    return { u: p.x, v: p.y }
  }
  return { u: Number.NaN, v: Number.NaN }
}

export function applyHomography(h: readonly number[], u: number, v: number): { x: number; y: number } {
  const w = h[6] * u + h[7] * v + h[8]
  if (Math.abs(w) < 1e-12) return { x: Number.NaN, y: Number.NaN }
  return { x: (h[0] * u + h[1] * v + h[2]) / w, y: (h[3] * u + h[4] * v + h[5]) / w }
}
