/**
 * The plan decomposition drawn over the plan it was read from.
 *
 * One picture per question a developer asks of a failed reading: where are
 * the walls (BANDS), what did the dimensions and the walls make of the grid
 * (GRID), which cells did the flood fill reach (CELLS), what is each cell
 * (FLOOD: OUTSIDE red, RECESS amber, BUILT green), and what bodies came of
 * them (MASSES, with every wide gap weighed: green shut, red open). ALL puts
 * the ones a phone's diagnostics bundle needs on one sheet.
 *
 * Pure: pixels in, pixels out. Encoding is the caller's business.
 */
import type { Raster } from '@buildapp/source-cv'
import type { PlanDiagnostics } from './failure.js'

export type PlanOverlayLayer = 'SOURCE' | 'BANDS' | 'GRID' | 'CELLS' | 'FLOOD' | 'MASSES' | 'ALL'

export const PLAN_OVERLAY_LAYERS: readonly PlanOverlayLayer[] = ['SOURCE', 'BANDS', 'GRID', 'CELLS', 'FLOOD', 'MASSES', 'ALL']

type RGB = readonly [number, number, number]
const RED: RGB = [214, 40, 40]
const AMBER: RGB = [235, 160, 20]
const GREEN: RGB = [30, 150, 60]
const BLUE: RGB = [30, 80, 220]
const MAGENTA: RGB = [200, 30, 200]
const ORANGE: RGB = [240, 110, 0]
const CYAN: RGB = [0, 170, 200]
const DARK: RGB = [20, 60, 30]

/** Draw a layer over the plan. `maxSide` bounds the picture by an integer downscale, so a bundle stays small. */
export function renderPlanOverlay(source: Raster, plan: PlanDiagnostics, layer: PlanOverlayLayer, maxSide = 1400): Raster {
  const k = Math.max(1, Math.ceil(Math.max(source.width, source.height) / maxSide))
  const width = Math.floor(source.width / k)
  const height = Math.floor(source.height / k)
  const data = new Uint8ClampedArray(width * height * 4)
  // The drawing, dimmed to a pale grey so every mark over it reads.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = ((y * k) * source.width + x * k) * 4
      const luma = 0.299 * source.data[i] + 0.587 * source.data[i + 1] + 0.114 * source.data[i + 2]
      const v = 150 + (luma / 255) * 105
      const o = (y * width + x) * 4
      data[o] = v
      data[o + 1] = v
      data[o + 2] = v
      data[o + 3] = 255
    }
  }
  const out: Raster = { width, height, data }
  const put = (x: number, y: number, c: RGB, a: number): void => {
    const px = Math.round(x / k)
    const py = Math.round(y / k)
    if (px < 0 || py < 0 || px >= width || py >= height) return
    const o = (py * width + px) * 4
    data[o] = data[o] * (1 - a) + c[0] * a
    data[o + 1] = data[o + 1] * (1 - a) + c[1] * a
    data[o + 2] = data[o + 2] * (1 - a) + c[2] * a
  }
  const fill = (r: { x0: number; y0: number; x1: number; y1: number }, c: RGB, a: number): void => {
    for (let y = Math.ceil(r.y0 / k) * k; y < r.y1; y += k) for (let x = Math.ceil(r.x0 / k) * k; x < r.x1; x += k) put(x, y, c, a)
  }
  const hline = (y: number, x0: number, x1: number, c: RGB, a = 1, thick = 1): void => {
    for (let t = 0; t < thick; t += 1) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += k) put(x, y + t * k - Math.floor(thick / 2) * k, c, a)
  }
  const vline = (x: number, y0: number, y1: number, c: RGB, a = 1, thick = 1): void => {
    for (let t = 0; t < thick; t += 1) for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y += k) put(x + t * k - Math.floor(thick / 2) * k, y, c, a)
  }
  const outline = (r: { x0: number; y0: number; x1: number; y1: number }, c: RGB, thick = 1, a = 1): void => {
    hline(r.y0, r.x0, r.x1, c, a, thick)
    hline(r.y1, r.x0, r.x1, c, a, thick)
    vline(r.x0, r.y0, r.y1, c, a, thick)
    vline(r.x1, r.y0, r.y1, c, a, thick)
  }
  const all = layer === 'ALL'
  const flood = (a: number): void => {
    for (const cell of plan.cells) fill(cell.rect, cell.cls === 'B' ? GREEN : cell.cls === 'R' ? AMBER : RED, a)
  }
  if (layer === 'FLOOD' || all) flood(all ? 0.22 : 0.32)
  if (layer === 'CELLS') {
    for (const cell of plan.cells) {
      fill(cell.rect, cell.enclosed ? GREEN : RED, 0.18)
      outline(cell.rect, [90, 90, 90], 1, 0.6)
    }
  }
  if (layer === 'BANDS' || all) for (const b of plan.bands) fill(b.bounds, BLUE, all ? 0.45 : 0.6)
  if (layer === 'GRID' || all) {
    const top = plan.extent.y0
    const bottom = plan.extent.y1
    const left = plan.extent.x0
    const right = plan.extent.x1
    for (const x of plan.linesX) vline(x, top, bottom, MAGENTA, 0.7)
    for (const y of plan.linesY) hline(y, left, right, MAGENTA, 0.7)
    if (!all) {
      for (const c of plan.chains) {
        const strong = c.read > 0
        const lo = Math.min(...c.ticksPx)
        const hi = Math.max(...c.ticksPx)
        if (c.axis === 'H') {
          hline(c.baselinePx, lo, hi, ORANGE, strong ? 1 : 0.4, strong ? 2 : 1)
          for (const t of c.ticksPx) vline(t, c.baselinePx - 5, c.baselinePx + 5, ORANGE, strong ? 1 : 0.4)
        } else {
          vline(c.baselinePx, lo, hi, ORANGE, strong ? 1 : 0.4, strong ? 2 : 1)
          for (const t of c.ticksPx) hline(t, c.baselinePx - 5, c.baselinePx + 5, ORANGE, strong ? 1 : 0.4)
        }
      }
      outline(plan.extent, ORANGE, 1, 0.8)
    }
    if (plan.envelope) outline(plan.envelope, CYAN, 2)
  }
  if (layer === 'MASSES' || all) {
    if (!all) flood(0.12)
    for (const b of plan.bays) outline(b.rect, b.mouth === 'OPENING_IN_WALL' ? GREEN : RED, 1, 0.8)
    for (const m of plan.masses) outline(m.rect, DARK, 3)
    for (const w of plan.wideOpenings) {
      const c = w.decision === 'OPENING_IN_WALL' ? GREEN : RED
      if (w.axis === 'Y') hline(w.linePx, w.fromPx, w.toPx, c, 1, 4)
      else vline(w.linePx, w.fromPx, w.toPx, c, 1, 4)
    }
  }
  return out
}
