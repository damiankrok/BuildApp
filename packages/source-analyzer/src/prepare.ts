/**
 * Getting from sealed bytes to something the CV layer can read.
 *
 * Two things happen here and both matter to the record.
 *
 * **Decoding is from the bytes.** The size a raster has is the size its
 * pixels have, never a number the publisher printed in an attribute. That is
 * already enforced at acquisition; it is re-derived here so that an extractor
 * physically cannot be handed a size that disagrees with the pixels it is
 * looking at.
 *
 * **Downscaling is recorded and undone.** A 4000px sheet is analysed at a
 * bounded working size, because the line detector is O(ink x angles) and a
 * full-resolution sheet costs seconds. But every coordinate that leaves this
 * package is in the FRAME's own pixels, so the working scale is carried
 * alongside and applied on the way out. An observation must never be at
 * working-resolution coordinates: the frame it names has the decoded size, and
 * a mismatch there is the acquisition bug moved one layer up.
 */
import { round6 } from '@buildapp/source-common'
import type { PixelPoint, PixelRect } from '@buildapp/source-common'
import { adaptiveInkMask, axisAlignedSegments, downscaleGray, gradientMask, houghSegments, inkChannel, inkMask, toGray } from '@buildapp/source-cv'
import type { Gray, Mask, Raster, Segment } from '@buildapp/source-cv'
import { decodeImage } from '@buildapp/source-package'
import { thinStrokes } from './strokes.js'

/** Longest working edge. Above this the drawing is analysed downscaled and the coordinates scaled back. */
export const MAX_WORKING_EDGE = 2200

export type Prepared = {
  /** The decoded size, in the frame's own pixels. */
  size: { width: number; height: number }
  /** Working size, after any downscale. */
  workingSize: { width: number; height: number }
  /** Multiply a working coordinate by this to get a frame coordinate. */
  scale: number
  raster: Raster
  /** Luma, at working size. Tone questions ("is this darker?") are asked of this. */
  luma: Gray
  /** Ink field, at working size: how much this pixel reads as drafting ink rather than as colour. */
  ink: Gray
  mask: Mask
  /**
   * Where the picture changes, at working size. Lines are extracted from THIS
   * and regions from `mask`: a mid-tone band is one solid region of ink but two
   * distinct edges, and a member is recognised by its edges.
   */
  edges: Mask
  /** Axis-aligned strokes, in FRAME coordinates. */
  axisSegments: Segment[]
  /** All straight strokes including sloped ones, in FRAME coordinates. */
  allSegments: Segment[]
  /** Thin axis-aligned strokes found under the strict merge rule, in FRAME coordinates. Treads, ticks, louvres. */
  thinSegments: Segment[]
}

const scalePoint = (p: PixelPoint, k: number): PixelPoint => ({ x: round6(p.x * k), y: round6(p.y * k) })

const scaleSegment = (s: Segment, k: number): Segment => (k === 1 ? s : { a: scalePoint(s.a, k), b: scalePoint(s.b, k), angleDeg: s.angleDeg, length: round6(s.length * k), support: s.support })

/** Scale a working-resolution rectangle into frame coordinates. */
export const scaleRect = (r: PixelRect, k: number): PixelRect => (k === 1 ? r : { x0: round6(r.x0 * k), y0: round6(r.y0 * k), x1: round6(r.x1 * k), y1: round6(r.y1 * k) })

export const scaleToFrame = scalePoint

export type PrepareOptions = {
  maxWorkingEdge?: number
  /** Force a global ink threshold instead of the local-contrast mask. */
  inkThreshold?: number
  /** How much darker than its own neighbourhood a pixel must be to count as ink. */
  inkDelta?: number
  /** How large a tone step counts as an edge. */
  edgeThreshold?: number
}

export function prepareRaster(bytes: Uint8Array, options: PrepareOptions = {}): Prepared {
  return prepareFromRaster(decodeImage(bytes), options)
}

/**
 * The same preparation, for a caller that already has pixels — a test, or a
 * stage that decoded once and wants to analyse twice. The decode boundary sits
 * one function up precisely so this one never has to know an image format.
 */
export function prepareFromRaster(raster: Raster, options: PrepareOptions = {}): Prepared {
  const size = { width: raster.width, height: raster.height }
  const fullInk = inkChannel(raster)
  const fullLuma = toGray(raster)
  const maxEdge = options.maxWorkingEdge ?? MAX_WORKING_EDGE
  const ink = downscaleGray(fullInk, maxEdge)
  const luma = downscaleGray(fullLuma, maxEdge)
  const workingSize = { width: ink.width, height: ink.height }
  const scale = round6(size.width / workingSize.width)
  // Local contrast, not a global level: a published plan's fine lines are a
  // light grey on a light grey page, and a threshold low enough to catch them
  // swallows the publisher's page-wide watermark along with them.
  const mask = options.inkThreshold !== undefined ? inkMask(ink, { threshold: options.inkThreshold }) : adaptiveInkMask(ink, { delta: options.inkDelta })

  const edges = gradientMask(luma, { threshold: options.edgeThreshold })
  const larger = Math.max(workingSize.width, workingSize.height)
  const axis = axisAlignedSegments(edges, { minLength: Math.max(6, Math.round(larger * 0.012)), maxThickness: 4, maxGap: 2 })
  const hough = houghSegments(edges, { minLength: Math.max(8, Math.round(larger * 0.015)), minSupport: Math.max(10, Math.round(larger * 0.012)), maxGap: 3, maxSegments: 400 })
  // Axis-aligned detection is exact where it applies and Hough covers
  // everything else; merging them and letting the caller filter by angle is
  // better than choosing one and losing either the precision or the slopes.
  const merged = [...axis, ...hough]
  // Strict thin strokes as well: the general detector chains a tread into the
  // planting symbol beside it, and the stair reader needs the tread.
  // Thin strokes come from the INK mask, not the edge mask: on an edge mask a
  // single drawn line is two parallel edges two pixels apart, and a reader
  // looking for evenly spaced strokes would find a flight in every line.
  const thin = [
    ...thinStrokes(mask, { minLength: Math.max(6, Math.round(larger * 0.012)), maxLength: larger * 0.3, maxThickness: 4, maxGap: 2 }),
    // Hough on the INK mask as well, so a winder's fanning treads — which are
    // neither horizontal nor vertical — are candidates too.
    ...houghSegments(mask, { minLength: Math.max(8, Math.round(larger * 0.015)), minSupport: Math.max(8, Math.round(larger * 0.01)), maxGap: 3, maxSegments: 300 }).filter((s) => s.length <= larger * 0.3),
  ]

  return {
    size,
    workingSize,
    scale,
    raster,
    luma,
    ink,
    mask,
    edges,
    axisSegments: axis.map((s) => scaleSegment(s, scale)),
    allSegments: merged.map((s) => scaleSegment(s, scale)),
    thinSegments: thin.map((s) => scaleSegment(s, scale)),
  }
}

/** The working-resolution twins of `axisSegments` / `allSegments`, for code that must index back into the mask. */
export function workingSegments(prepared: Prepared): { axis: Segment[]; all: Segment[]; thin: Segment[] } {
  const k = 1 / prepared.scale
  return { axis: prepared.axisSegments.map((s) => scaleSegment(s, k)), all: prepared.allSegments.map((s) => scaleSegment(s, k)), thin: prepared.thinSegments.map((s) => scaleSegment(s, k)) }
}
