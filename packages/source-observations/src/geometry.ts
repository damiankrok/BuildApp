/**
 * Geometry utilities over the observation shapes.
 *
 * The one rule worth stating: normalized geometry is DERIVED from pixel
 * geometry and a frame's decoded size, never supplied independently. An
 * extractor that could hand in both could hand in two that disagree, and a
 * later stage comparing two views would then be comparing one drawing against
 * a lie about another.
 */
import { round6, toNorm } from '@buildapp/source-common'
import type { NormPoint, PixelPoint, PixelRect, PixelSize } from '@buildapp/source-common'
import type { NormGeometry, PixelGeometry } from './schema.js'

/** Every pixel point a shape is made of, in the order the shape stores them. */
export function pixelPoints(g: PixelGeometry): PixelPoint[] {
  switch (g.type) {
    case 'POINT':
      return [g.point]
    case 'SEGMENT':
      return [g.a, g.b]
    case 'POLYLINE':
    case 'POLYGON':
      return [...g.points]
    case 'RECT':
      return [
        { x: g.rect.x0, y: g.rect.y0 },
        { x: g.rect.x1, y: g.rect.y0 },
        { x: g.rect.x1, y: g.rect.y1 },
        { x: g.rect.x0, y: g.rect.y1 },
      ]
    case 'LINE_FAMILY':
      return g.lines.flatMap((l) => [l.a, l.b])
  }
}

export function normPoints(g: NormGeometry): NormPoint[] {
  switch (g.type) {
    case 'POINT':
      return [g.point]
    case 'SEGMENT':
      return [g.a, g.b]
    case 'POLYLINE':
    case 'POLYGON':
      return [...g.points]
    case 'RECT':
      return [
        { x: g.rect.x0, y: g.rect.y0 },
        { x: g.rect.x1, y: g.rect.y0 },
        { x: g.rect.x1, y: g.rect.y1 },
        { x: g.rect.x0, y: g.rect.y1 },
      ]
    case 'LINE_FAMILY':
      return g.lines.flatMap((l) => [l.a, l.b])
  }
}

/** The normalized shape of a pixel shape on a frame of the given decoded size. */
export function normalizeGeometry(g: PixelGeometry, size: PixelSize): NormGeometry {
  const n = (p: PixelPoint): NormPoint => toNorm(p, size)
  switch (g.type) {
    case 'POINT':
      return { type: 'POINT', point: n(g.point) }
    case 'SEGMENT':
      return { type: 'SEGMENT', a: n(g.a), b: n(g.b) }
    case 'POLYLINE':
      return { type: 'POLYLINE', points: g.points.map(n) }
    case 'POLYGON':
      return { type: 'POLYGON', points: g.points.map(n) }
    case 'RECT':
      return { type: 'RECT', rect: { x0: round6(g.rect.x0 / size.width), y0: round6(g.rect.y0 / size.height), x1: round6(g.rect.x1 / size.width), y1: round6(g.rect.y1 / size.height) } }
    case 'LINE_FAMILY':
      return { type: 'LINE_FAMILY', lines: g.lines.map((l) => ({ a: n(l.a), b: n(l.b) })) }
  }
}

/** The bounding box of a pixel shape. */
export function pixelBounds(g: PixelGeometry): PixelRect {
  const pts = pixelPoints(g)
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const p of pts) {
    x0 = Math.min(x0, p.x)
    y0 = Math.min(y0, p.y)
    x1 = Math.max(x1, p.x)
    y1 = Math.max(y1, p.y)
  }
  return { x0: round6(x0), y0: round6(y0), x1: round6(x1), y1: round6(y1) }
}

/** The mean of a shape's points. Good enough to say which of two things is above the other; not a centre of area. */
export function pixelCentroid(g: PixelGeometry): PixelPoint {
  const pts = pixelPoints(g)
  const sx = pts.reduce((a, p) => a + p.x, 0)
  const sy = pts.reduce((a, p) => a + p.y, 0)
  return { x: round6(sx / pts.length), y: round6(sy / pts.length) }
}

/** True when a shape has a direction worth stating an angular tolerance about. */
export const isOriented = (g: PixelGeometry): boolean => g.type === 'SEGMENT' || g.type === 'LINE_FAMILY' || g.type === 'POLYLINE'

/** Area of a polygon by the shoelace formula, unsigned. Zero for anything that is not a closed shape. */
export function polygonArea(g: PixelGeometry): number {
  if (g.type === 'RECT') return Math.max(0, g.rect.x1 - g.rect.x0) * Math.max(0, g.rect.y1 - g.rect.y0)
  if (g.type !== 'POLYGON') return 0
  const p = g.points
  let two = 0
  for (let i = 0; i < p.length; i += 1) {
    const q = p[(i + 1) % p.length]
    two += p[i].x * q.y - q.x * p[i].y
  }
  return round6(Math.abs(two) / 2)
}
