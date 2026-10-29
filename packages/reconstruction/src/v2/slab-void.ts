/**
 * BUILDPLAN N8-03D1: a void in the floor of an upper storey — a double-height space over a room below — as the upper
 * storey's plan draws it.
 *
 * A plan draws a void as a region of its own fill: one flat, uniform, achromatic tone, distinctly darker than the
 * storey's floor fill and lighter than wall ink, solid over the whole region but for the words printed in it, as large
 * as a room. That is what is read here, and nothing else: a furnished floor is not uniform, a hatched or striped zone is
 * not solid, a tiled bathroom or the strip under a slope is within a few grey levels of the floor, a flue or a shaft is
 * smaller than a person can stand in, and wall ink is dark. The words in the region ("void over the living room") are
 * not read — the recogniser reads digits only — so the reading rests on the drawing's fill alone, and says so.
 *
 * The region's outline is traced on the plan's pixels (its own shape — a rectangle where the drawing is one, an L where
 * it is an L), the pixel staircase of its edges dropped, and taken to the world through the storey's registered frame.
 * A void that runs into the storey's stair hole, leaves the storey's walled region, or stands over no storey below is
 * not read.
 */
import { round6 } from '@buildapp/source-common'
import type { Raster } from '@buildapp/source-cv'
import type { PlanFrameV2 } from './frame.js'

export type PlanRect = { x0: number; z0: number; x1: number; z1: number }
export type Vec2 = { x: number; z: number }

export type SlabVoid = {
  storeyIndex: number
  /** The outline in world plan coordinates, as the fill is drawn (rectilinear where the drawing is). */
  polygon: Vec2[]
  areaM2: number
  /** How far an edge may lie from the drawn one: a pixel of the sheet either side, and the frame's own registration. */
  uncertaintyM: number
  /** The fill read: its tone, the floor's, how uniform and how solid. */
  fill: { luma: number; floorLuma: number; lumaStd: number; solidity: number; pixels: number }
  why: string
}

export type SlabVoidRefusal = { storeyIndex: number; bboxM: PlanRect; why: string }

/** A void's fill is this much darker than the storey's floor fill (grey levels), at least. */
export const VOID_FLOOR_CONTRAST = 25
/** ... and no darker than this luma: below it is wall ink. */
export const VOID_MIN_LUMA = 140
/** One tone: the luma spread over the region (grey levels, standard deviation). */
export const VOID_MAX_LUMA_STD = 4
/** Achromatic: the channels of a fill pixel within this of each other. */
export const VOID_MAX_CHROMA = 8
/** Solid: the share of the region (its holes filled) the fill itself covers; the rest is the words printed in it. */
export const VOID_MIN_SOLIDITY = 0.85
/** A void a person could stand in: this area at least (m²) ... */
export const VOID_MIN_AREA_M2 = 1.5
/** ... and this wide everywhere it counts (m): narrower is a shaft, a flue, a strip. */
export const VOID_MIN_WIDTH_M = 0.9

const lumaAt = (r: Raster, x: number, y: number): number => {
  const o = (y * r.width + x) * 4
  return 0.299 * r.data[o] + 0.587 * r.data[o + 1] + 0.114 * r.data[o + 2]
}
const chromaAt = (r: Raster, x: number, y: number): number => {
  const o = (y * r.width + x) * 4
  return Math.max(r.data[o], r.data[o + 1], r.data[o + 2]) - Math.min(r.data[o], r.data[o + 1], r.data[o + 2])
}

/**
 * The voids the upper storey's plan draws inside `rects` (the storey's walled interior, world plan coordinates), apart
 * from the stair's own hole; and the tinted regions looked at and refused, each with why.
 */
export function readSlabVoids(raster: Raster, frame: PlanFrameV2, storeyIndex: number, rects: readonly PlanRect[], options: { stairHole?: PlanRect; below?: readonly PlanRect[] } = {}): { voids: SlabVoid[]; refused: SlabVoidRefusal[] } {
  const voids: SlabVoid[] = []
  const refused: SlabVoidRefusal[] = []
  if (rects.length === 0) return { voids, refused }
  // the storey's interior in pixels
  const pxRects = rects.map((r) => {
    const a = frame.toPixel(r.x0, r.z0)
    const b = frame.toPixel(r.x1, r.z1)
    return { x0: Math.max(0, Math.ceil(Math.min(a.x, b.x))), x1: Math.min(raster.width - 1, Math.floor(Math.max(a.x, b.x))), y0: Math.max(0, Math.ceil(Math.min(a.y, b.y))), y1: Math.min(raster.height - 1, Math.floor(Math.max(a.y, b.y))) }
  })
  const X0 = Math.min(...pxRects.map((r) => r.x0))
  const Y0 = Math.min(...pxRects.map((r) => r.y0))
  const X1 = Math.max(...pxRects.map((r) => r.x1))
  const Y1 = Math.max(...pxRects.map((r) => r.y1))
  const W = X1 - X0 + 1
  const H = Y1 - Y0 + 1
  if (W <= 2 || H <= 2) return { voids, refused }
  const inside = new Uint8Array(W * H)
  for (const r of pxRects) for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) inside[(y - Y0) * W + (x - X0)] = 1
  // the floor fill: the commonest light achromatic tone inside the storey
  const hist = new Array<number>(256).fill(0)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inside[y * W + x] && chromaAt(raster, x + X0, y + Y0) <= VOID_MAX_CHROMA) hist[Math.round(lumaAt(raster, x + X0, y + Y0))] += 1
  let floorLuma = 200
  for (let l = 200; l < 256; l++) if (hist[l] > hist[floorLuma]) floorLuma = l
  // candidate fill pixels: achromatic, between ink and the floor, well below the floor; grouped by tone so that two
  // abutting fills of different tones stay apart
  const toneOf = new Int16Array(W * H).fill(-1)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!inside[y * W + x]) continue
      const l = lumaAt(raster, x + X0, y + Y0)
      if (l >= VOID_MIN_LUMA && l <= floorLuma - VOID_FLOOR_CONTRAST && chromaAt(raster, x + X0, y + Y0) <= VOID_MAX_CHROMA) toneOf[y * W + x] = Math.round(l)
    }
  }
  const seen = new Uint8Array(W * H)
  const mpp = (frame.mppX + frame.mppY) / 2
  for (let s = 0; s < W * H; s++) {
    if (toneOf[s] < 0 || seen[s]) continue
    // a 4-connected component of one tone (within 2 grey levels of its seed)
    const tone = toneOf[s]
    const comp: number[] = []
    const stack = [s]
    seen[s] = 1
    while (stack.length > 0) {
      const p = stack.pop() as number
      comp.push(p)
      const x = p % W
      const y = (p - x) / W
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
        const q = ny * W + nx
        if (seen[q] || toneOf[q] < 0 || Math.abs(toneOf[q] - tone) > 2) continue
        seen[q] = 1
        stack.push(q)
      }
    }
    if (comp.length * mpp * mpp < VOID_MIN_AREA_M2 * 0.8) continue
    // the region: the component with its enclosed holes (the printed words) filled
    let bx0 = W
    let by0 = H
    let bx1 = 0
    let by1 = 0
    for (const p of comp) {
      const x = p % W
      const y = (p - x) / W
      bx0 = Math.min(bx0, x)
      by0 = Math.min(by0, y)
      bx1 = Math.max(bx1, x)
      by1 = Math.max(by1, y)
    }
    const bw = bx1 - bx0 + 3
    const bh = by1 - by0 + 3
    const mask = new Uint8Array(bw * bh)
    for (const p of comp) {
      const x = p % W
      const y = (p - x) / W
      mask[(y - by0 + 1) * bw + (x - bx0 + 1)] = 1
    }
    const outside = new Uint8Array(bw * bh)
    const flood = [0]
    outside[0] = 1
    while (flood.length > 0) {
      const p = flood.pop() as number
      const x = p % bw
      const y = (p - x) / bw
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue
        const q = ny * bw + nx
        if (outside[q] || mask[q]) continue
        outside[q] = 1
        flood.push(q)
      }
    }
    let region = 0
    for (let i = 0; i < bw * bh; i++) if (!outside[i]) region += 1
    const solidity = comp.length / region
    let sum = 0
    let sum2 = 0
    for (const p of comp) {
      const x = p % W
      const y = (p - x) / W
      const l = lumaAt(raster, x + X0, y + Y0)
      sum += l
      sum2 += l * l
    }
    const mean = sum / comp.length
    const std = Math.sqrt(Math.max(0, sum2 / comp.length - mean * mean))
    const areaM2 = region * mpp * mpp
    const a = frame.toWorld(bx0 + X0, by0 + Y0)
    const b = frame.toWorld(bx1 + X0 + 1, by1 + Y0 + 1)
    const bboxM = { x0: round6(Math.min(a.x, b.x)), z0: round6(Math.min(a.z, b.z)), x1: round6(Math.max(a.x, b.x)), z1: round6(Math.max(a.z, b.z)) }
    const refuse = (why: string): void => {
      refused.push({ storeyIndex, bboxM, why: `a ${tone}-grey fill of ${areaM2.toFixed(2)} m² at x ${bboxM.x0.toFixed(2)}..${bboxM.x1.toFixed(2)}, z ${bboxM.z0.toFixed(2)}..${bboxM.z1.toFixed(2)}: ${why}` })
    }
    if (areaM2 < VOID_MIN_AREA_M2) {
      refuse(`smaller than ${VOID_MIN_AREA_M2} m²: a flue or a shaft, not a void`)
      continue
    }
    if (std > VOID_MAX_LUMA_STD) {
      refuse(`not one tone (σ ${std.toFixed(1)} grey levels)`)
      continue
    }
    if (solidity < VOID_MIN_SOLIDITY) {
      refuse(`not solid (${Math.round(solidity * 100)} % of its region): line work or hatching`)
      continue
    }
    // wide enough everywhere it counts: the region eroded by half the least width keeps most of it
    const r = Math.max(1, Math.round(VOID_MIN_WIDTH_M / 2 / mpp))
    const filled = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < bw && y < bh && !outside[y * bw + x]
    let core = 0
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        if (!filled(x, y)) continue
        if (filled(x - r, y) && filled(x + r, y) && filled(x, y - r) && filled(x, y + r) && filled(x - r, y - r) && filled(x + r, y + r) && filled(x - r, y + r) && filled(x + r, y - r)) core += 1
      }
    }
    if (core * mpp * mpp < 0.25 * VOID_MIN_WIDTH_M * VOID_MIN_WIDTH_M) {
      refuse(`narrower than ${VOID_MIN_WIDTH_M} m: a strip, not a void`)
      continue
    }
    // the outline: the region's boundary traced on pixel corners, its staircase dropped
    const pixelOutline = traceOutline(filled, bw, bh)
    if (!pixelOutline) {
      refuse('its outline could not be traced as one ring')
      continue
    }
    const polygon = simplifyRectilinear(pixelOutline, 2).map((p) => {
      const w = frame.toWorld(p.x + bx0 - 1 + X0, p.y + by0 - 1 + Y0)
      return { x: round6(w.x), z: round6(w.z) }
    })
    const hole = options.stairHole
    if (hole && Math.min(hole.x1, bboxM.x1) - Math.max(hole.x0, bboxM.x0) > 0.05 && Math.min(hole.z1, bboxM.z1) - Math.max(hole.z0, bboxM.z0) > 0.05) {
      refuse('it runs into the stair hole: read as one with it, the stair hole stands')
      continue
    }
    const centre = { x: (bboxM.x0 + bboxM.x1) / 2, z: (bboxM.z0 + bboxM.z1) / 2 }
    if (options.below && !options.below.some((q) => centre.x >= q.x0 && centre.x <= q.x1 && centre.z >= q.z0 && centre.z <= q.z1)) {
      refuse('no storey stands below it: not a void in a floor')
      continue
    }
    voids.push({
      storeyIndex,
      polygon,
      areaM2: round6(polygonArea(polygon)),
      uncertaintyM: round6(mpp),
      fill: { luma: round6(mean), floorLuma, lumaStd: round6(std), solidity: round6(solidity), pixels: comp.length },
      why: `the storey ${storeyIndex} plan fills a ${polygonArea(polygon).toFixed(2)} m² region (${polygon.length} corners, x ${bboxM.x0.toFixed(2)}..${bboxM.x1.toFixed(2)}, z ${bboxM.z0.toFixed(2)}..${bboxM.z1.toFixed(2)}) with one flat tone (${mean.toFixed(0)}, σ ${std.toFixed(1)}), ${(floorLuma - mean).toFixed(0)} grey levels below its floor fill, solid but for the words printed in it (${Math.round(solidity * 100)} %): a void over the storey below, open to it; its edges a pixel (${mpp.toFixed(3)} m) either side of the drawn ones; the words themselves are not read`,
    })
  }
  return { voids, refused }
}

/** The boundary of a 4-connected filled region on a pixel grid, as a ring of pixel corners (one ring, or nothing). */
function traceOutline(filled: (x: number, y: number) => boolean, w: number, h: number): Vec2[] | undefined {
  // directed boundary edges with the region on their left, from pixel corner to pixel corner
  const next = new Map<string, Array<[number, number]>>()
  const add = (ax: number, ay: number, bx: number, by: number): void => {
    const k = `${ax},${ay}`
    next.set(k, [...(next.get(k) ?? []), [bx, by]])
  }
  let count = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!filled(x, y)) continue
      if (!filled(x, y - 1)) (add(x + 1, y, x, y), count++)
      if (!filled(x, y + 1)) (add(x, y + 1, x + 1, y + 1), count++)
      if (!filled(x - 1, y)) (add(x, y, x, y + 1), count++)
      if (!filled(x + 1, y)) (add(x + 1, y + 1, x + 1, y), count++)
    }
  }
  const startKey = [...next.keys()][0]
  if (!startKey) return undefined
  const ring: Vec2[] = []
  let [cx, cy] = startKey.split(',').map(Number)
  let used = 0
  for (let guard = 0; guard <= count; guard++) {
    ring.push({ x: cx, z: cy })
    const outs = next.get(`${cx},${cy}`)
    if (!outs || outs.length === 0) break
    const [nx, ny] = outs.shift() as [number, number]
    used += 1
    cx = nx
    cy = ny
    if (`${cx},${cy}` === startKey && (next.get(startKey)?.length ?? 0) === 0) break
  }
  // one ring that uses every boundary edge, or the region is not one simple outline
  return used === count ? ring : undefined
}

/**
 * A pixel ring (x, z = pixel column, row) simplified to its corners: runs along one axis merged, and steps no longer
 * than `steps` pixels (an anti-aliased edge's staircase) folded into the run they interrupt. Returns pixel coordinates
 * as { x, y }.
 */
function simplifyRectilinear(ring: Vec2[], steps: number): Array<{ x: number; y: number }> {
  let pts = ring.map((p) => ({ x: p.x, y: p.z }))
  const collinear = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }): boolean => (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)
  const dropCollinear = (ps: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> => {
    let out = ps
    let changed = true
    while (changed && out.length > 4) {
      changed = false
      for (let i = 0; i < out.length; i++) {
        const a = out[(i + out.length - 1) % out.length]
        const b = out[i]
        const c = out[(i + 1) % out.length]
        if (collinear(a, b, c)) {
          out = out.filter((_, k) => k !== i)
          changed = true
          break
        }
      }
    }
    return out
  }
  pts = dropCollinear(pts)
  // fold short steps: a segment no longer than `steps` between two longer parallel ones is removed by moving its
  // following corner onto the line of its preceding one
  let changed = true
  while (changed && pts.length > 4) {
    changed = false
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      const len = Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
      if (len > steps) continue
      const c = pts[(i + 2) % pts.length]
      // the step a→b joins the segment into a and the segment b→c, both perpendicular to it: b moves onto a's line
      const horizontal = a.y === b.y
      const moved = horizontal ? { x: a.x, y: c.y } : { x: c.x, y: a.y }
      const nextPts = pts.slice()
      nextPts[(i + 1) % pts.length] = moved
      pts = dropCollinear(nextPts.filter((p, k, arr) => k === 0 || p.x !== arr[k - 1].x || p.y !== arr[k - 1].y))
      changed = true
      break
    }
  }
  return pts
}

function polygonArea(p: readonly Vec2[]): number {
  let s = 0
  for (let i = 0; i < p.length; i++) {
    const a = p[i]
    const b = p[(i + 1) % p.length]
    s += a.x * b.z - b.x * a.z
  }
  return Math.abs(s) / 2
}

/** N8-03D1: an edge within this of the slab's edge (m) is that edge: the fill stops at the wall's drawn line. */
export const VOID_SNAP_M = 0.1

/**
 * N8-03D1/N8-03D2: a void's outline as it is cut from a slab spanning `edge` (the walls' inner faces): a coordinate
 * within {@link VOID_SNAP_M} of an edge is taken to it, anything else is kept inside. The slab's hole and the rooms
 * around it use this one polygon. Undefined when the void does not lie on the slab (beyond the snap).
 */
export function voidOnSlab(polygon: readonly Vec2[], edge: PlanRect): Vec2[] | undefined {
  if (!polygon.every((p) => p.x >= edge.x0 - VOID_SNAP_M && p.x <= edge.x1 + VOID_SNAP_M && p.z >= edge.z0 - VOID_SNAP_M && p.z <= edge.z1 + VOID_SNAP_M)) return undefined
  const snap = (value: number, lo: number, hi: number): number => round6(Math.abs(value - lo) <= VOID_SNAP_M ? lo : Math.abs(value - hi) <= VOID_SNAP_M ? hi : Math.min(Math.max(value, lo), hi))
  return polygon.map((p) => ({ x: snap(p.x, edge.x0, edge.x1), z: snap(p.z, edge.z0, edge.z1) }))
}
