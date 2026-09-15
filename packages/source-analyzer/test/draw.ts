/**
 * Synthetic drawings for the analyzer's tests.
 *
 * Every picture here is built from primitives with known geometry, so the
 * assertions are equalities rather than hopes, and — more importantly — the
 * pictures are built to be MINIMAL PAIRS. The facade with a shadow under its
 * beam differs from the facade with a painted stripe in exactly one respect:
 * the shadow. That is what makes "the extractor reads depth, not colour" a
 * testable claim rather than a stated intention.
 */
import { inkChannel, toGray } from '@buildapp/source-cv'
import type { Gray, Mask, Raster } from '@buildapp/source-cv'
import { adaptiveInkMask } from '@buildapp/source-cv'

export type Rgb = readonly [number, number, number]
export const BLACK: Rgb = [0, 0, 0]
export const WALL: Rgb = [232, 228, 220]
export const SKY: Rgb = [255, 255, 255]

export function sheet(width: number, height: number, colour: Rgb = SKY): Raster {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = colour[0]
    data[i * 4 + 1] = colour[1]
    data[i * 4 + 2] = colour[2]
    data[i * 4 + 3] = 255
  }
  return { width, height, data }
}

export function fill(r: Raster, x0: number, y0: number, x1: number, y1: number, c: Rgb): void {
  for (let y = Math.max(0, y0); y <= Math.min(r.height - 1, y1); y += 1) {
    for (let x = Math.max(0, x0); x <= Math.min(r.width - 1, x1); x += 1) {
      const o = (y * r.width + x) * 4
      r.data[o] = c[0]
      r.data[o + 1] = c[1]
      r.data[o + 2] = c[2]
      r.data[o + 3] = 255
    }
  }
}

export function line(r: Raster, x0: number, y0: number, x1: number, y1: number, c: Rgb, thickness = 1): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
  const half = Math.floor(thickness / 2)
  for (let i = 0; i <= steps; i += 1) {
    const x = Math.round(x0 + ((x1 - x0) * i) / Math.max(1, steps))
    const y = Math.round(y0 + ((y1 - y0) * i) / Math.max(1, steps))
    fill(r, x - half, y - half, x - half + thickness - 1, y - half + thickness - 1, c)
  }
}

export function rectOutline(r: Raster, x0: number, y0: number, x1: number, y1: number, c: Rgb, thickness = 1): void {
  line(r, x0, y0, x1, y0, c, thickness)
  line(r, x0, y1, x1, y1, c, thickness)
  line(r, x0, y0, x0, y1, c, thickness)
  line(r, x1, y0, x1, y1, c, thickness)
}

export const grayOf = (r: Raster): Gray => toGray(r)
export const inkOf = (r: Raster): Gray => inkChannel(r)
export const maskOf = (r: Raster, delta = 8): Mask => adaptiveInkMask(inkChannel(r), { delta })

/**
 * A wall with one long horizontal member on it.
 *
 * `depth` decides what the member IS, and it is the only thing that changes:
 *   'shadow'    — a dark strip below it, as a solid standing proud would cast
 *   'ends'      — short strokes closing both ends, as a solid that stops has
 *   'flat'      — nothing but a change of tone: a painted band
 */
export function facadeWithMember(depth: 'shadow' | 'ends' | 'flat', options: { width?: number; height?: number; y?: number; thickness?: number; x0?: number; x1?: number } = {}): Raster {
  const width = options.width ?? 600
  const height = options.height ?? 300
  const y = options.y ?? 120
  const t = options.thickness ?? 18
  const x0 = options.x0 ?? 60
  const x1 = options.x1 ?? 540
  const r = sheet(width, height)
  fill(r, 30, 40, width - 30, height - 40, WALL)
  // the member: a band of its own tone between two drawn edges
  fill(r, x0, y, x1, y + t, [198, 192, 182])
  line(r, x0, y, x1, y, BLACK)
  line(r, x0, y + t, x1, y + t, BLACK)
  if (depth === 'shadow') fill(r, x0, y + t + 1, x1, y + t + 7, [150, 146, 138])
  if (depth === 'ends') {
    // The member's own end faces, seen as strips of their own tone. This is
    // what a solid that stops looks like; a painted stripe that stops does not
    // acquire one.
    fill(r, x0, y + 1, x0 + 7, y + t - 1, [162, 156, 148])
    fill(r, x1 - 7, y + 1, x1, y + t - 1, [162, 156, 148])
  }
  return r
}

/**
 * A plan staircase: a run of tread strokes between two stringers, with an
 * arrow up the flight. `turn` adds a winder; `arrow` can be withheld.
 */
export function planStair(options: { treads?: number; going?: number; treadLength?: number; arrow?: boolean; turn?: number; x?: number; y?: number; size?: number } = {}): Raster {
  const size = options.size ?? 400
  const treads = options.treads ?? 9
  const going = options.going ?? 14
  const len = options.treadLength ?? 70
  const x = options.x ?? 120
  const y = options.y ?? 90
  const r = sheet(size, size)
  const ys: number[] = []
  for (let i = 0; i < treads; i += 1) {
    const yy = y + i * going
    ys.push(yy)
    line(r, x, yy, x + len, yy, BLACK)
  }
  // the stringers: the ends of the treads, closed along the flight
  line(r, x, ys[0], x, ys[ys.length - 1], BLACK)
  line(r, x + len, ys[0], x + len, ys[ys.length - 1], BLACK)
  if (options.turn && options.turn > 0) {
    // A winder fans about a newel at one end of the run: the treads share that
    // corner and swing round it, which is what makes the walking line turn
    // while the treads stay one continuous run.
    const newelX = x
    const newelY = ys[ys.length - 1] + going
    const steps = 3
    for (let k = 1; k <= steps; k += 1) {
      const rad = ((k * options.turn) / steps / 180) * Math.PI
      line(r, newelX, newelY, Math.round(newelX + len * Math.cos(rad)), Math.round(newelY + len * Math.sin(rad)), BLACK)
    }
    // the outer stringer sweeps round with them
    for (let k = 0; k < steps; k += 1) {
      const a = ((k * options.turn) / steps / 180) * Math.PI
      const b = (((k + 1) * options.turn) / steps / 180) * Math.PI
      line(r, Math.round(newelX + len * Math.cos(a)), Math.round(newelY + len * Math.sin(a)), Math.round(newelX + len * Math.cos(b)), Math.round(newelY + len * Math.sin(b)), BLACK)
    }
  }
  if (options.arrow !== false) {
    const cx = x + Math.round(len / 2)
    const top = ys[0]
    const bottom = ys[ys.length - 1]
    line(r, cx, bottom, cx, top, BLACK)
    line(r, cx, top, cx - 7, top + 10, BLACK)
    line(r, cx, top, cx + 7, top + 10, BLACK)
  }
  return r
}

/** A planting symbol: a regular row of parallel strokes with nothing a stair has. */
export function hatchSymbol(options: { strokes?: number; spacing?: number; length?: number; x?: number; y?: number; size?: number } = {}): Raster {
  const size = options.size ?? 400
  const r = sheet(size, size)
  const n = options.strokes ?? 14
  const spacing = options.spacing ?? 6
  const len = options.length ?? 60
  const x = options.x ?? 100
  const y = options.y ?? 100
  for (let i = 0; i < n; i += 1) line(r, x, y + i * spacing, x + len, y + i * spacing, BLACK)
  return r
}
