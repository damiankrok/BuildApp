/**
 * N7-P2 (E): the model projected onto each registered elevation, on the elevation's own pixels — before and after the
 * corrections, at the same scale and in the same frame, so the two can be laid over each other.
 *
 *   A (`<facade>-A-before.png`): the facade's walls (cyan), the eaves and the ridge (yellow), the model's openings as
 *     they were before any correction (red), the openings the view draws (green) and the rectangles rejected as not
 *     openings (grey).
 *   B (`<facade>-B-after.png`): the same, with the model's openings after the corrections (red), the corrected ones
 *     over-drawn in magenta, the view's openings no model opening pairs with (MISSING_IN_MODEL, orange) and the model's
 *     openings no reading pairs with (EXTRA_IN_MODEL, blue).
 *
 * The projection is the one the solver used (`facadeAlignment.views[].projection`). Written outside the repository
 * only: the background is the publisher's raster. RESEARCH ONLY.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import type { ReconstructionV2Result } from '@buildapp/reconstruction'

type Raster = { width: number; height: number; data: Uint8ClampedArray }
type Rgb = [number, number, number]
const CYAN: Rgb = [0, 190, 220]
const YELLOW: Rgb = [235, 200, 0]
const RED: Rgb = [230, 30, 30]
const GREEN: Rgb = [20, 170, 40]
const GREY: Rgb = [140, 140, 140]
const MAGENTA: Rgb = [220, 0, 200]
const ORANGE: Rgb = [255, 140, 0]
const BLUE: Rgb = [30, 80, 255]

function canvas(raster: Raster): PNG {
  const png = new PNG({ width: raster.width, height: raster.height })
  // the elevation, washed out so the contours read
  for (let i = 0; i < raster.data.length; i += 4) {
    png.data[i] = 255 - Math.round((255 - raster.data[i]) * 0.55)
    png.data[i + 1] = 255 - Math.round((255 - raster.data[i + 1]) * 0.55)
    png.data[i + 2] = 255 - Math.round((255 - raster.data[i + 2]) * 0.55)
    png.data[i + 3] = 255
  }
  return png
}
function dot(png: PNG, x: number, y: number, c: Rgb): void {
  const xi = Math.round(x)
  const yi = Math.round(y)
  if (xi < 0 || yi < 0 || xi >= png.width || yi >= png.height) return
  const o = (yi * png.width + xi) * 4
  png.data[o] = c[0]
  png.data[o + 1] = c[1]
  png.data[o + 2] = c[2]
}
function line(png: PNG, x0: number, y0: number, x1: number, y1: number, c: Rgb, w = 1, dash = 0): void {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)))
  for (let k = 0; k <= n; k += 1) {
    if (dash > 0 && Math.floor(k / dash) % 2 === 1) continue
    const x = x0 + ((x1 - x0) * k) / n
    const y = y0 + ((y1 - y0) * k) / n
    for (let dx = -Math.floor(w / 2); dx <= Math.floor(w / 2); dx += 1) for (let dy = -Math.floor(w / 2); dy <= Math.floor(w / 2); dy += 1) dot(png, x + dx, y + dy, c)
  }
}
function rect(png: PNG, b: { x0: number; y0: number; x1: number; y1: number }, c: Rgb, w = 1, dash = 0): void {
  line(png, b.x0, b.y0, b.x1, b.y0, c, w, dash)
  line(png, b.x1, b.y0, b.x1, b.y1, c, w, dash)
  line(png, b.x1, b.y1, b.x0, b.y1, c, w, dash)
  line(png, b.x0, b.y1, b.x0, b.y0, c, w, dash)
}

export function writeOverlays(r: ReconstructionV2Result, rasterOf: (frameId: string) => Raster | undefined, dir: string, masks?: Map<string, Array<{ mask: Uint8Array; closed: Uint8Array; box: { c0: number; r0: number; W: number; H: number } }>>): string[] {
  mkdirSync(dir, { recursive: true })
  const written: string[] = []
  const fa = r.facadeAlignment
  const b = r.building
  for (const v of fa.views) {
    const raster = rasterOf(v.frameId)
    if (!raster) continue
    const p = v.projection
    const px = (along: number): number => (along - p.alongAtPx0) / (p.alongSign * p.mpp)
    const py = (y: number): number => p.zeroRow - y / p.mpp
    const box = (a0: number, a1: number, y0: number, y1: number) => ({ x0: Math.min(px(a0), px(a1)), x1: Math.max(px(a0), px(a1)), y0: py(y1), y1: py(y0) })
    const frontRear = v.facade === 'FRONT' || v.facade === 'REAR'
    const draw = (after: boolean): PNG => {
      const png = canvas(raster)
      // walls: each body's face on this side, from the ground to the top of its walls
      for (const m of b.masses) {
        const top = Math.max(...m.storeys.map((s) => b.levels.find((l) => l.index === s)?.wallTop ?? 0))
        const bottom = Math.min(...m.storeys.map((s) => b.levels.find((l) => l.index === s)?.elevation ?? 0))
        rect(png, frontRear ? box(m.x0, m.x1, bottom, top) : box(m.z0, m.z1, bottom, top), CYAN, 1)
      }
      if (b.mainRoof) {
        const fp = b.mainRoof.footprint
        const [a0, a1] = frontRear ? [fp.x0, fp.x1] : [fp.z0, fp.z1]
        line(png, px(a0), py(b.mainRoof.eaveY), px(a1), py(b.mainRoof.eaveY), YELLOW, 1, 6)
        line(png, px(a0), py(b.mainRoof.ridgeY), px(a1), py(b.mainRoof.ridgeY), YELLOW, 1, 6)
      }
      for (const j of fa.rejected.filter((x) => x.frameId === v.frameId)) rect(png, j.box, GREY, 1, 3)
      const pairedR = new Set(fa.comparisons.filter((c) => c.facade === v.facade && c.openingId && c.readingId).map((c) => c.readingId))
      for (const rd of fa.readings.filter((x) => x.frameId === v.frameId)) rect(png, box(rd.from, rd.to, rd.sillY, rd.headY), after && !pairedR.has(rd.id) ? ORANGE : GREEN, 2)
      for (const o of b.openings.filter((x) => x.facade === v.facade)) {
        const corr = fa.corrections.filter((c) => c.openingId === o.id)
        const sill = after ? o.sillY : corr.find((c) => c.property === 'sill')?.before ?? o.sillY
        const head = after ? o.headY : corr.find((c) => c.property === 'head')?.before ?? o.headY
        const extra = fa.comparisons.some((c) => c.openingId === o.id && c.codes.includes('EXTRA_IN_MODEL'))
        rect(png, box(o.interval[0], o.interval[1], sill, head), after && corr.length > 0 ? MAGENTA : after && extra ? BLUE : RED, after && corr.length > 0 ? 3 : 1)
      }
      return png
    }
    const bands = masks?.get(v.frameId)
    if (bands) {
      const png = canvas(raster)
      for (const bd of bands) {
        for (let y = 0; y < bd.box.H; y += 1) for (let x = 0; x < bd.box.W; x += 1) {
          const gx = bd.box.c0 + x
          const gy = bd.box.r0 + y
          if (bd.mask[gy * raster.width + gx]) dot(png, gx, gy, RED)
          else if (bd.closed[y * bd.box.W + x]) dot(png, gx, gy, YELLOW)
        }
      }
      const file = join(dir, `${v.facade.toLowerCase()}-M-mask.png`)
      writeFileSync(file, PNG.sync.write(png))
      written.push(file)
    }
    for (const [tag, after] of [['A-before', false], ['B-after', true]] as const) {
      const file = join(dir, `${v.facade.toLowerCase()}-${tag}.png`)
      writeFileSync(file, PNG.sync.write(draw(after)))
      written.push(file)
    }
  }
  return written
}
