/**
 * Synthetic floor plans for the decomposition tests.
 *
 * Built in code, so every wall face, every chain tick and every opening has a
 * known position and an assertion can say what the answer must be rather than
 * what it hopes for. Nothing here reads a file and nothing here is a drawing
 * of any real building.
 */
import { inkMask, toGray } from '@buildapp/source-cv'
import type { Mask } from '@buildapp/source-cv'
import type { CoordinateRegistration, DimensionChain, MetricProvenance } from '@buildapp/source-metrics'
import { BLACK, drawLine, fillRect, whiteRaster } from '../../source-cv/test/draw.js'
import type { Raster } from '@buildapp/source-cv'

export const WALL = 12
/** Centimetres per pixel: a round number so a test's arithmetic is checkable by eye. */
export const CM_PER_PX = 5

const PROVENANCE: MetricProvenance = { name: 'test', detail: 'a fixture, not a reading', extractor: 'DERIVED' }

export const sheet = (width: number, height: number): Raster => whiteRaster(width, height)

/** A wall ring drawn between the OUTER faces given, so `x0`/`x1` are what a dimension chain would measure to. */
export function walls(r: Raster, x0: number, y0: number, x1: number, y1: number, openings: ReadonlyArray<{ side: 'N' | 'S' | 'E' | 'W'; from: number; to: number }> = []): void {
  fillRect(r, x0, y0, x1, y0 + WALL - 1, BLACK)
  fillRect(r, x0, y1 - WALL + 1, x1, y1, BLACK)
  fillRect(r, x0, y0, x0 + WALL - 1, y1, BLACK)
  fillRect(r, x1 - WALL + 1, y0, x1, y1, BLACK)
  for (const o of openings) {
    if (o.side === 'N') fillRect(r, o.from, y0, o.to, y0 + WALL - 1, [255, 255, 255])
    if (o.side === 'S') fillRect(r, o.from, y1 - WALL + 1, o.to, y1, [255, 255, 255])
    if (o.side === 'W') fillRect(r, x0, o.from, x0 + WALL - 1, o.to, [255, 255, 255])
    if (o.side === 'E') fillRect(r, x1 - WALL + 1, o.from, x1, o.to, [255, 255, 255])
  }
}

/** An internal partition, half the thickness of an exterior wall — which is what they are. */
export function partition(r: Raster, x0: number, y0: number, x1: number, y1: number): void {
  fillRect(r, x0, y0, x1, y1, BLACK)
}

/** A glazed wall: two thin lines, which is how a drawing says "this is still the outside of the building". */
export function glazing(r: Raster, axis: 'H' | 'V', at: number, from: number, to: number): void {
  if (axis === 'H') {
    drawLine(r, from, at, to, at, BLACK)
    drawLine(r, from, at + WALL - 1, to, at + WALL - 1, BLACK)
  } else {
    drawLine(r, at, from, at, to, BLACK)
    drawLine(r, at + WALL - 1, from, at + WALL - 1, to, BLACK)
  }
}

export const mask = (r: Raster): Mask => inkMask(toGray(r))

/**
 * A dimension chain along an axis, with every segment read.
 *
 * `ticks` are pixel positions; the values are whatever the pixel spans come to
 * at the fixture's scale, so the chain agrees with the drawing by construction
 * and a test that wants them to disagree has to say so.
 */
export function chain(id: string, axis: 'HORIZONTAL' | 'VERTICAL', ticks: readonly number[], options: { read?: boolean; baselinePx?: number } = {}): DimensionChain {
  const read = options.read ?? true
  return {
    id,
    frameId: 'frame-test',
    assetId: 'asset-test',
    axis,
    baselinePx: options.baselinePx ?? 0,
    ticksPx: [...ticks],
    segments: ticks.slice(0, -1).map((from, i) => ({
      index: i,
      fromPx: from,
      toPx: ticks[i + 1],
      pixelLength: ticks[i + 1] - from,
      valueCm: (ticks[i + 1] - from) * CM_PER_PX,
      origin: read ? ('READ' as const) : ('DERIVED' as const),
      confidence: read ? 0.9 : 0.4,
    })),
    closes: true,
    observationIds: [],
    ocrTokenIds: [],
  }
}

export function registration(): CoordinateRegistration {
  return {
    id: 'reg-test',
    frameId: 'frame-test',
    assetId: 'asset-test',
    variantByteHash: 'b'.repeat(64),
    plane: 'PLAN_XZ',
    metresPerPixelX: CM_PER_PX / 100,
    metresPerPixelY: CM_PER_PX / 100,
    anisotropy: 1,
    originPx: { x: 0, y: 0 },
    flipX: false,
    flipY: false,
    anchors: [],
    rejected: [],
    residual: { rmsM: 0, maxM: 0, rmsPx: 0 },
    confidence: 0.9,
    provenance: PROVENANCE,
  }
}
