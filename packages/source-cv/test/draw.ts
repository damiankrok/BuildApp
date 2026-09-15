/**
 * Synthetic rasters for the CV tests.
 *
 * The tests here never load a file. Every picture is constructed in code from
 * primitives whose exact geometry is known, so an assertion can be an equality
 * rather than a hope: if the apex of a drawn gable is at (100, 30), the test
 * says 30, not "roughly the top". That is only possible because this package
 * takes decoded pixels rather than an image, and it is the main reason the
 * decode boundary sits where it does.
 *
 * This file is not a test file (the vitest glob is `*.test.ts`), it is a
 * fixture builder, and it deliberately contains no assertions.
 */
import type { Raster } from '../src/index.js'

export type Rgb = readonly [number, number, number]

export const BLACK: Rgb = [0, 0, 0]
export const RED: Rgb = [255, 0, 0]
export const CYAN: Rgb = [0, 255, 255]
export const GREY30: Rgb = [76, 76, 76]

/** An opaque white sheet: what an unmarked drawing looks like. */
export function whiteRaster(width: number, height: number): Raster {
  const data = new Uint8ClampedArray(width * height * 4)
  data.fill(255)
  return { width, height, data }
}

export function setPixel(r: Raster, x: number, y: number, c: Rgb): void {
  if (x < 0 || y < 0 || x >= r.width || y >= r.height) return
  const o = (y * r.width + x) * 4
  r.data[o] = c[0]
  r.data[o + 1] = c[1]
  r.data[o + 2] = c[2]
  r.data[o + 3] = 255
}

/** Filled rectangle, INCLUSIVE of both corners, matching this package's rect convention. */
export function fillRect(r: Raster, x0: number, y0: number, x1: number, y1: number, c: Rgb): void {
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) setPixel(r, x, y, c)
}

/** Rectangle outline whose stroke is drawn INSIDE the bounds, so the bounds stay exactly as given whatever the thickness. */
export function drawRectOutline(r: Raster, x0: number, y0: number, x1: number, y1: number, c: Rgb, thickness = 1): void {
  const t = Math.max(1, Math.floor(thickness))
  fillRect(r, x0, y0, x1, y0 + t - 1, c)
  fillRect(r, x0, y1 - t + 1, x1, y1, c)
  fillRect(r, x0, y0, x0 + t - 1, y1, c)
  fillRect(r, x1 - t + 1, y0, x1, y1, c)
}

/** Bresenham, so a "40 degree" line in a test is the same set of pixels a rasteriser would really produce. */
export function drawLine(r: Raster, x0: number, y0: number, x1: number, y1: number, c: Rgb, thickness = 1): void {
  const t = Math.max(1, Math.floor(thickness))
  const back = Math.floor((t - 1) / 2)
  const fwd = t - 1 - back
  const dx = Math.abs(x1 - x0)
  const sx = x0 < x1 ? 1 : -1
  const dy = -Math.abs(y1 - y0)
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  let x = x0
  let y = y0
  for (;;) {
    if (t === 1) setPixel(r, x, y, c)
    else fillRect(r, x - back, y - back, x + fwd, y + fwd, c)
    if (x === x1 && y === y1) break
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x += sx
    }
    if (e2 <= dx) {
      err += dx
      y += sy
    }
  }
}

/** Filled triangle by half-plane test, inclusive of its edges so a vertex is a pixel. */
export function fillTriangle(r: Raster, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, c: Rgb): void {
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
  const s = area >= 0 ? 1 : -1
  const x0 = Math.min(ax, bx, cx)
  const x1 = Math.max(ax, bx, cx)
  const y0 = Math.min(ay, by, cy)
  const y1 = Math.max(ay, by, cy)
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const w0 = ((bx - ax) * (y - ay) - (by - ay) * (x - ax)) * s
      const w1 = ((cx - bx) * (y - by) - (cy - by) * (x - bx)) * s
      const w2 = ((ax - cx) * (y - cy) - (ay - cy) * (x - cx)) * s
      if (w0 >= 0 && w1 >= 0 && w2 >= 0) setPixel(r, x, y, c)
    }
  }
}
