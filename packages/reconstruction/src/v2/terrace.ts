/**
 * Terraces: the exterior floors a building stands beside.
 *
 * A recess at the ground storey has a floor — the covered part of a terrace,
 * or of an entrance — and the plan often goes on to draw the rest of the
 * platform outside the building's outer plane: a hatched area bounded by a
 * thin outline, with the furniture a publisher puts on it. That platform is
 * part of how the house is read (the living room opens onto it) and it is
 * not landscaping, so it is modelled; the lawn, the planting and the paths
 * beyond its outline are, and are not.
 *
 * The reader walks out from the recess mouth across the plan, row by row,
 * and takes the first thin line that spans the facade's width as the
 * platform's far edge — provided the plan between the mouth and that line is
 * drawn on (hatch, furniture) rather than blank paper. A second outline
 * further out bounds a further area (a garden terrace, a bed) and is not
 * taken: the platform the building stands on ends at the first.
 */
import { round6 } from '@buildapp/source-common'
import type { Raster } from '@buildapp/source-cv'
import type { PlanFrameV2 } from './frame.js'
import { lumaAt } from './scan.js'

export type TerraceSide = 'FRONT' | 'REAR' | 'WEST' | 'EAST'

export type TerraceExtension = {
  /** Distance from the mouth to the outline, metres. */
  reach: number
  /** The outline's extent along the facade. */
  from: number
  to: number
  /** Share of the plan between mouth and outline that is drawn on (hatched or furnished). */
  drawnShare: number
  why: string
}

const LINE_LUMA = 200
const DRAWN_LUMA = 243

/**
 * The outlined platform beyond a mouth, or undefined when the plan draws no
 * outline spanning the facade within `maxReachM`.
 */
export function readTerraceExtension(raster: Raster, frame: PlanFrameV2, side: TerraceSide, mouthAt: number, span: [number, number], options: { maxReachM?: number; minReachM?: number; spanCoverage?: number } = {}): TerraceExtension | undefined {
  const maxReach = options.maxReachM ?? 5
  const minReach = options.minReachM ?? 0.3
  const needed = options.spanCoverage ?? 0.85
  const alongX = side === 'FRONT' || side === 'REAR'
  // Outward: away from the building. The front's outer plane is the low z; the rear's the high z; west low x; east high x.
  const out = side === 'FRONT' || side === 'WEST' ? -1 : 1
  const mpp = (frame.mppX + frame.mppY) / 2
  const a0 = span[0] + 0.1
  const a1 = span[1] - 0.1
  if (a1 - a0 < 1) return undefined
  const pixelOf = (a: number, c: number): { x: number; y: number } => (alongX ? frame.toPixel(a, c) : frame.toPixel(c, a))
  const rowStats = (c: number): { line: number; drawn: number } => {
    let line = 0
    let drawn = 0
    let n = 0
    for (let a = a0; a <= a1; a += mpp) {
      const p = pixelOf(a, c)
      const l = lumaAt(raster, Math.round(p.x), Math.round(p.y))
      n += 1
      if (l < LINE_LUMA) line += 1
      if (l < DRAWN_LUMA) drawn += 1
    }
    return { line: n > 0 ? line / n : 0, drawn: n > 0 ? drawn / n : 0 }
  }
  let drawnSum = 0
  let rows = 0
  for (let d = 0.15; d <= maxReach; d += mpp) {
    const c = mouthAt + out * d
    const p = pixelOf((a0 + a1) / 2, c)
    if (p.x < 0 || p.y < 0 || p.x >= raster.width || p.y >= raster.height) break
    const s = rowStats(c)
    if (d >= minReach && s.line >= needed) {
      const drawnShare = rows > 0 ? drawnSum / rows : 0
      if (drawnShare < 0.3) return undefined
      // The outline's own extent along the facade: the contiguous run of line pixels through the span's middle.
      const extentOf = (dir: 1 | -1): number => {
        let a = (a0 + a1) / 2
        let misses = 0
        let last = a
        for (let k = 0; k < 4000; k += 1) {
          a += dir * mpp
          const q = pixelOf(a, c)
          if (q.x < 0 || q.y < 0 || q.x >= raster.width || q.y >= raster.height) break
          const hit = Math.min(lumaAt(raster, Math.round(q.x), Math.round(q.y)), lumaAt(raster, Math.round(q.x), Math.round(q.y) - 1), lumaAt(raster, Math.round(q.x), Math.round(q.y) + 1)) < LINE_LUMA
          if (hit) {
            last = a
            misses = 0
          } else if (++misses > 3) break
        }
        return last
      }
      const from = round6(extentOf(-1))
      const to = round6(extentOf(1))
      return { reach: round6(d), from, to, drawnShare: round6(drawnShare), why: `a thin outline ${d.toFixed(2)} m out from the mouth spans ${Math.round(s.line * 100)} % of the facade (${from.toFixed(2)}..${to.toFixed(2)}); the plan between is drawn on over ${Math.round(drawnShare * 100)} % of it` }
    }
    drawnSum += s.drawn
    rows += 1
  }
  return undefined
}

/** Share of a rectangle of the plan (in world coordinates) that is drawn on: hatch, furniture, lines. */
export function drawnShareOf(raster: Raster, frame: PlanFrameV2, rect: { x0: number; z0: number; x1: number; z1: number }): number {
  const mpp = (frame.mppX + frame.mppY) / 2
  let drawn = 0
  let n = 0
  for (let x = rect.x0 + 0.05; x <= rect.x1 - 0.05; x += mpp * 2) {
    for (let z = rect.z0 + 0.05; z <= rect.z1 - 0.05; z += mpp * 2) {
      const p = frame.toPixel(x, z)
      n += 1
      if (lumaAt(raster, Math.round(p.x), Math.round(p.y)) < DRAWN_LUMA) drawn += 1
    }
  }
  return n > 0 ? drawn / n : 0
}

/**
 * The terrace polygon: the recess floor (along `floor`, across mouth..back)
 * and, when there is one, the platform beyond the mouth (along `ext`, across
 * mouth..mouth+reach outward). Counter-clockwise in plan, collinear
 * vertices removed.
 */
export function terracePolygon(side: TerraceSide, mouthAt: number, backAt: number, floor: [number, number], ext?: { from: number; to: number; reach: number }): Array<{ x: number; z: number }> {
  const alongX = side === 'FRONT' || side === 'REAR'
  const out = side === 'FRONT' || side === 'WEST' ? -1 : 1
  const pts: Array<[number, number]> = []
  if (!ext) {
    pts.push([floor[0], backAt], [floor[1], backAt], [floor[1], mouthAt], [floor[0], mouthAt])
  } else {
    const e0 = Math.min(ext.from, floor[0])
    const e1 = Math.max(ext.to, floor[1])
    const far = mouthAt + out * ext.reach
    pts.push([floor[0], backAt], [floor[1], backAt], [floor[1], mouthAt], [e1, mouthAt], [e1, far], [e0, far], [e0, mouthAt], [floor[0], mouthAt])
  }
  // Drop repeated and collinear vertices.
  const clean: Array<[number, number]> = []
  for (const p of pts) {
    const prev = clean[clean.length - 1]
    if (prev && Math.abs(prev[0] - p[0]) < 1e-6 && Math.abs(prev[1] - p[1]) < 1e-6) continue
    clean.push(p)
  }
  if (clean.length > 1 && Math.abs(clean[0][0] - clean[clean.length - 1][0]) < 1e-6 && Math.abs(clean[0][1] - clean[clean.length - 1][1]) < 1e-6) clean.pop()
  const reduced: Array<[number, number]> = []
  for (let i = 0; i < clean.length; i += 1) {
    const a = clean[(i + clean.length - 1) % clean.length]
    const b = clean[i]
    const c = clean[(i + 1) % clean.length]
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
    if (Math.abs(cross) > 1e-9) reduced.push(b)
  }
  let poly = reduced.map(([a, c]) => (alongX ? { x: round6(a), z: round6(c) } : { x: round6(c), z: round6(a) }))
  // Counter-clockwise in the x–z plane.
  let area = 0
  for (let i = 0; i < poly.length; i += 1) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    area += p.x * q.z - q.x * p.z
  }
  if (area < 0) poly = poly.reverse()
  return poly
}
