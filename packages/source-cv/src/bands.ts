/**
 * Bands: thick, straight runs of ink.
 *
 * A technical floor plan draws almost everything as thin line work — furniture,
 * hatching, dimension lines, annotation, the outline of a car — and draws the
 * one thing that is structure, the walls, as SOLID BANDS several pixels thick.
 * That difference is the most reliable signal on the sheet, and it is what this
 * module extracts.
 *
 * The test is a run length, not a filter response. A pixel belongs to a
 * horizontal band when the vertical run of ink through it is between a wall's
 * minimum and maximum thickness AND the horizontal run through it is long. A
 * 1-pixel furniture outline fails the first test; a large filled blob — a
 * shrub, a logo, a solid arrow — fails it too, because its vertical run is far
 * thicker than a wall. Only a band passes both.
 *
 * Nothing here knows what a wall is. `runLengthBands` finds bands; deciding
 * which of them bound a building is architecture, and belongs upstairs.
 */
import { round6 } from '@buildapp/source-common'
import type { PixelRect } from '@buildapp/source-common'
import type { Mask } from './mask.js'

export type BandAxis = 'HORIZONTAL' | 'VERTICAL'

export type Band = {
  axis: BandAxis
  /** The band's footprint in the image. */
  bounds: PixelRect
  /** Across the band: the median ink thickness, in pixels. */
  thickness: number
  /** Along the band, in pixels. */
  length: number
  /** How much of the bounding box is band pixels: a clean band is near 1. */
  fill: number
  /** Centre of the band across its own axis — the wall's axis line. */
  axisPx: number
  /** How many separate pieces were merged to make it: a wall interrupted by openings. */
  pieces: number
}

export type BandOptions = {
  /** Thinnest band that can be structural, in pixels. */
  minThickness?: number
  /** Thickest. Above this the ink is a filled region, not a band. */
  maxThickness?: number
  /** Shortest band worth reporting, in pixels. */
  minLength?: number
  /** Gap along a band that may be bridged, as a fraction of the merged length. An opening in a wall. */
  maxGapFraction?: number
  /** And an absolute ceiling on that gap, in pixels. */
  maxGapPx?: number
  /** How far two pieces' axes may differ and still be the same band, in pixels. */
  axisTolerancePx?: number
}

const DEFAULTS: Required<BandOptions> = { minThickness: 5, maxThickness: 40, minLength: 24, maxGapFraction: 0.45, maxGapPx: 90, axisTolerancePx: 3 }

const at = (m: Mask, x: number, y: number): number => (x < 0 || y < 0 || x >= m.width || y >= m.height ? 0 : m.data[y * m.width + x])

/** Run length through every pixel, along one axis. Zero where there is no ink. */
function runLengths(m: Mask, axis: BandAxis): Int32Array {
  const out = new Int32Array(m.width * m.height)
  const outer = axis === 'HORIZONTAL' ? m.height : m.width
  const inner = axis === 'HORIZONTAL' ? m.width : m.height
  const index = (a: number, b: number): number => (axis === 'HORIZONTAL' ? b * m.width + a : a * m.width + b)
  for (let b = 0; b < outer; b += 1) {
    let start = -1
    for (let a = 0; a <= inner; a += 1) {
      const ink = a < inner && (axis === 'HORIZONTAL' ? at(m, a, b) : at(m, b, a)) === 1
      if (ink && start < 0) start = a
      if (!ink && start >= 0) {
        const length = a - start
        for (let k = start; k < a; k += 1) out[index(k, b)] = length
        start = -1
      }
    }
  }
  return out
}

const median = (values: readonly number[]): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((x, y) => x - y)
  return sorted[Math.floor(sorted.length / 2)]
}

/**
 * Every band in a mask, merged along its own axis.
 *
 * Merging is what makes the result usable: an exterior wall with three windows
 * in it is drawn as four separate stretches of black, and four wall fragments
 * are not a wall. Two pieces merge when they lie on the same axis line, have
 * comparable thickness, and the gap between them is small against the length
 * they would make together — which is exactly the shape of a window in a wall
 * and not the shape of two different walls that happen to line up.
 */
export function runLengthBands(m: Mask, options: BandOptions = {}): Band[] {
  const opt = { ...DEFAULTS, ...options }
  const across = { HORIZONTAL: runLengths(m, 'VERTICAL'), VERTICAL: runLengths(m, 'HORIZONTAL') } as const
  const along = { HORIZONTAL: runLengths(m, 'HORIZONTAL'), VERTICAL: runLengths(m, 'VERTICAL') } as const

  const bands: Band[] = []
  for (const axis of ['HORIZONTAL', 'VERTICAL'] as const) {
    // A pixel of a band: thick enough across, long enough along.
    const isBand = (x: number, y: number): boolean => {
      const i = y * m.width + x
      if (m.data[i] !== 1) return false
      const thickness = across[axis][i]
      if (thickness < opt.minThickness || thickness > opt.maxThickness) return false
      return along[axis][i] >= Math.min(opt.minLength, 12)
    }

    // Group band pixels into pieces: one maximal run per line, then pieces are
    // runs on adjacent lines with overlapping extent.
    type Piece = { a0: number; a1: number; b0: number; b1: number; thicknesses: number[] }
    const pieces: Piece[] = []
    const outer = axis === 'HORIZONTAL' ? m.height : m.width
    const inner = axis === 'HORIZONTAL' ? m.width : m.height
    let open: Piece[] = []
    for (let b = 0; b < outer; b += 1) {
      const runs: Array<{ a0: number; a1: number; thickness: number }> = []
      let start = -1
      for (let a = 0; a <= inner; a += 1) {
        const ink = a < inner && (axis === 'HORIZONTAL' ? isBand(a, b) : isBand(b, a))
        if (ink && start < 0) start = a
        if (!ink && start >= 0) {
          if (a - start >= Math.min(opt.minLength, 12)) {
            const mid = Math.floor((start + a) / 2)
            const i = axis === 'HORIZONTAL' ? b * m.width + mid : mid * m.width + b
            runs.push({ a0: start, a1: a - 1, thickness: across[axis][i] })
          }
          start = -1
        }
      }
      const next: Piece[] = []
      for (const run of runs) {
        const host = open.find((p) => p.b1 === b - 1 && Math.min(p.a1, run.a1) - Math.max(p.a0, run.a0) > (Math.min(p.a1 - p.a0, run.a1 - run.a0) + 1) * 0.5)
        if (host) {
          host.a0 = Math.min(host.a0, run.a0)
          host.a1 = Math.max(host.a1, run.a1)
          host.b1 = b
          host.thicknesses.push(run.thickness)
          next.push(host)
          continue
        }
        const piece: Piece = { a0: run.a0, a1: run.a1, b0: b, b1: b, thicknesses: [run.thickness] }
        pieces.push(piece)
        next.push(piece)
      }
      open = next
    }

    const toBand = (p: Piece, count: number): Band => {
      const bounds: PixelRect =
        axis === 'HORIZONTAL' ? { x0: p.a0, y0: p.b0, x1: p.a1, y1: p.b1 } : { x0: p.b0, y0: p.a0, x1: p.b1, y1: p.a1 }
      const length = p.a1 - p.a0 + 1
      const thickness = median(p.thicknesses)
      return {
        axis,
        bounds,
        thickness: round6(thickness),
        length,
        fill: 1,
        axisPx: round6((p.b0 + p.b1) / 2),
        pieces: count,
      }
    }

    // Merge pieces that are the same wall, interrupted.
    const candidates = pieces
      .filter((p) => p.a1 - p.a0 + 1 >= Math.min(opt.minLength, 12))
      .map((p) => toBand(p, 1))
      .sort((x, y) => x.axisPx - y.axisPx || (axis === 'HORIZONTAL' ? x.bounds.x0 - y.bounds.x0 : x.bounds.y0 - y.bounds.y0))

    const merged: Band[] = []
    for (const band of candidates) {
      const startOf = (b: Band): number => (axis === 'HORIZONTAL' ? b.bounds.x0 : b.bounds.y0)
      const endOf = (b: Band): number => (axis === 'HORIZONTAL' ? b.bounds.x1 : b.bounds.y1)
      const host = merged.find((h) => {
        if (Math.abs(h.axisPx - band.axisPx) > opt.axisTolerancePx) return false
        if (Math.abs(h.thickness - band.thickness) > Math.max(3, h.thickness * 0.5)) return false
        const gap = startOf(band) - endOf(h) - 1
        if (gap < -Math.max(2, band.length * 0.5)) return false
        const together = endOf(band) - startOf(h) + 1
        return gap <= Math.min(opt.maxGapPx, together * opt.maxGapFraction)
      })
      if (!host) {
        merged.push({ ...band })
        continue
      }
      host.bounds = {
        x0: Math.min(host.bounds.x0, band.bounds.x0),
        y0: Math.min(host.bounds.y0, band.bounds.y0),
        x1: Math.max(host.bounds.x1, band.bounds.x1),
        y1: Math.max(host.bounds.y1, band.bounds.y1),
      }
      host.length = endOf(host) - startOf(host) + 1
      host.thickness = round6((host.thickness + band.thickness) / 2)
      host.axisPx = round6((host.axisPx + band.axisPx) / 2)
      host.pieces += 1
    }

    // Fill: how much of the merged span is really inked, so a band held
    // together across a large opening can be told from a solid one.
    for (const band of merged) {
      let ink = 0
      let total = 0
      for (let y = Math.round(band.bounds.y0); y <= Math.round(band.bounds.y1); y += 1) {
        for (let x = Math.round(band.bounds.x0); x <= Math.round(band.bounds.x1); x += 1) {
          total += 1
          ink += at(m, x, y)
        }
      }
      band.fill = round6(total === 0 ? 0 : ink / total)
    }

    bands.push(...merged.filter((b) => b.length >= opt.minLength))
  }

  return bands.sort((a, b) => a.axis.localeCompare(b.axis) || a.axisPx - b.axisPx || a.bounds.x0 - b.bounds.x0)
}
