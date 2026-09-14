/**
 * Roof compiler: GABLE and FLAT.
 *
 * A gable is built from the eave height, the pitch and the footprint's
 * half-span; the ridge height is a consequence. Both slopes are emitted as one
 * closed solid: the two slabs meet at the ridge, so the internal ridge faces
 * are not emitted and the whole roof is a single manifold prism with a
 * chevron cross-section. Thickness is perpendicular to the slope: a vertical
 * drop of `t / cos(pitch)` is a perpendicular depth of `t`.
 *
 * `roofGeometry` also exposes the roof's underside as a function of plan
 * position, which is what lets a wall die into the roof (FOLLOW_ROOF).
 */
import type { Level, Roof, Vec2 } from '@buildapp/model'
import { quadOut } from './primitives.js'
import { v3, type Triangle, type Vec3 } from './types.js'

export type RoofGeometry = {
  kind: Roof['kind']
  /** World y of the top surface at the footprint edge. */
  eaveY: number
  /** World y of the ridge (== eaveY for a flat roof). */
  ridgeY: number
  slope: number
  pitchDeg: number
  /** Vertical distance between the top surface and the underside. */
  verticalDrop: number
  /** Plan rectangle actually covered, overhang included. */
  covered: { minX: number; maxX: number; minZ: number; maxZ: number }
  covers(x: number, z: number): boolean
  /** World y of the top surface; only meaningful where `covers`. */
  topAt(x: number, z: number): number
  /** World y of the underside; only meaningful where `covers`. */
  undersideAt(x: number, z: number): number
  /**
   * Plan lines across which the underside changes slope (the ridge), as
   * `{ axis, value }`: the line `z = value` when axis is 'Z', `x = value`
   * when axis is 'X'.
   */
  creaseLines: Array<{ axis: 'X' | 'Z'; value: number }>
}

export function roofGeometry(roof: Roof, level: Level): RoofGeometry {
  const f = roof.footprint
  const oh = roof.overhang
  const eaveY = level.elevation + roof.eaveOffset
  const covered = { minX: f.minX - oh, maxX: f.maxX + oh, minZ: f.minZ - oh, maxZ: f.maxZ + oh }
  const covers = (x: number, z: number): boolean => x >= covered.minX - 1e-9 && x <= covered.maxX + 1e-9 && z >= covered.minZ - 1e-9 && z <= covered.maxZ + 1e-9
  if (roof.kind === 'FLAT') {
    return {
      kind: 'FLAT',
      eaveY,
      ridgeY: eaveY,
      slope: 0,
      pitchDeg: 0,
      verticalDrop: roof.thickness,
      covered,
      covers,
      topAt: () => eaveY,
      undersideAt: () => eaveY - roof.thickness,
      creaseLines: [],
    }
  }
  const slope = Math.tan((roof.pitchDeg * Math.PI) / 180)
  const alongX = roof.ridgeAxis === 'X'
  const crossMin = alongX ? f.minZ : f.minX
  const crossMax = alongX ? f.maxZ : f.maxX
  const mid = (crossMin + crossMax) / 2
  const halfSpan = (crossMax - crossMin) / 2
  const ridgeY = eaveY + halfSpan * slope
  const verticalDrop = roof.thickness / Math.cos((roof.pitchDeg * Math.PI) / 180)
  const topAt = (x: number, z: number): number => {
    const cross = alongX ? z : x
    return eaveY + (halfSpan - Math.abs(cross - mid)) * slope
  }
  return {
    kind: 'GABLE',
    eaveY,
    ridgeY,
    slope,
    pitchDeg: roof.pitchDeg,
    verticalDrop,
    covered,
    covers,
    topAt,
    undersideAt: (x, z) => topAt(x, z) - verticalDrop,
    // The ridge runs along the ridge axis at the middle of the cross axis.
    creaseLines: [{ axis: alongX ? 'Z' : 'X', value: mid }],
  }
}

/** The roof as one closed solid. */
export function compileRoofTriangles(roof: Roof, level: Level): { triangles: Triangle[]; geometry: RoofGeometry } {
  const g = roofGeometry(roof, level)
  const out: Triangle[] = []
  const c = g.covered
  if (roof.kind === 'FLAT') {
    const y1 = g.eaveY
    const y0 = y1 - roof.thickness
    const P = (x: number, y: number, z: number): Vec3 => v3(x, y, z)
    quadOut(out, P(c.minX, y1, c.minZ), P(c.maxX, y1, c.minZ), P(c.maxX, y1, c.maxZ), P(c.minX, y1, c.maxZ), v3(0, 1, 0))
    quadOut(out, P(c.minX, y0, c.minZ), P(c.maxX, y0, c.minZ), P(c.maxX, y0, c.maxZ), P(c.minX, y0, c.maxZ), v3(0, -1, 0))
    quadOut(out, P(c.maxX, y0, c.minZ), P(c.maxX, y1, c.minZ), P(c.maxX, y1, c.maxZ), P(c.maxX, y0, c.maxZ), v3(1, 0, 0))
    quadOut(out, P(c.minX, y0, c.minZ), P(c.minX, y1, c.minZ), P(c.minX, y1, c.maxZ), P(c.minX, y0, c.maxZ), v3(-1, 0, 0))
    quadOut(out, P(c.minX, y0, c.maxZ), P(c.maxX, y0, c.maxZ), P(c.maxX, y1, c.maxZ), P(c.minX, y1, c.maxZ), v3(0, 0, 1))
    quadOut(out, P(c.minX, y0, c.minZ), P(c.maxX, y0, c.minZ), P(c.maxX, y1, c.minZ), P(c.minX, y1, c.minZ), v3(0, 0, -1))
    return { triangles: out, geometry: g }
  }

  const alongX = roof.ridgeAxis === 'X'
  // `along` runs with the ridge, `cross` across it.
  const along0 = alongX ? c.minX : c.minZ
  const along1 = alongX ? c.maxX : c.maxZ
  const cross0 = alongX ? c.minZ : c.minX
  const cross1 = alongX ? c.maxZ : c.maxX
  const mid = (cross0 + cross1) / 2
  const P = (along: number, cross: number, y: number): Vec3 => (alongX ? v3(along, y, cross) : v3(cross, y, along))
  const topOf = (cross: number): number => (alongX ? g.topAt(0, cross) : g.topAt(cross, 0))
  const eaveTop = topOf(cross0) // same at cross1 by symmetry
  const ridgeTop = g.ridgeY
  const drop = g.verticalDrop
  // Direction of "cross increasing" in world, for outward vectors.
  const crossDir = alongX ? v3(0, 0, 1) : v3(1, 0, 0)
  const alongDir = alongX ? v3(1, 0, 0) : v3(0, 0, 1)
  const neg = (a: Vec3): Vec3 => v3(-a.x, -a.y, -a.z)

  for (const side of [-1, 1] as const) {
    const eaveCross = side < 0 ? cross0 : cross1
    // Top slope surface: outward is up and towards the eave.
    const outTop = v3(crossDir.x * side, 1, crossDir.z * side)
    quadOut(out, P(along0, eaveCross, eaveTop), P(along1, eaveCross, eaveTop), P(along1, mid, ridgeTop), P(along0, mid, ridgeTop), outTop)
    // Underside: outward is down and towards the ridge.
    quadOut(out, P(along0, eaveCross, eaveTop - drop), P(along1, eaveCross, eaveTop - drop), P(along1, mid, ridgeTop - drop), P(along0, mid, ridgeTop - drop), neg(outTop))
    // Eave end face: vertical, outward along ±cross.
    quadOut(out, P(along0, eaveCross, eaveTop - drop), P(along1, eaveCross, eaveTop - drop), P(along1, eaveCross, eaveTop), P(along0, eaveCross, eaveTop), v3(crossDir.x * side, 0, crossDir.z * side))
    // Gable end faces at along0 and along1: vertical trapezoids, one per slope.
    quadOut(out, P(along0, eaveCross, eaveTop - drop), P(along0, mid, ridgeTop - drop), P(along0, mid, ridgeTop), P(along0, eaveCross, eaveTop), neg(alongDir))
    quadOut(out, P(along1, eaveCross, eaveTop - drop), P(along1, mid, ridgeTop - drop), P(along1, mid, ridgeTop), P(along1, eaveCross, eaveTop), alongDir)
  }
  return { triangles: out, geometry: g }
}

/**
 * Parameter values along a plan segment (from `p` in direction `d`, length
 * `L`) where it crosses a roof's crease lines or the edges of the covered
 * rectangle. These are the places a wall under this roof changes top slope.
 */
export function roofBreaksAlong(g: RoofGeometry, p: Vec2, d: Vec2, L: number): number[] {
  const out: number[] = []
  const lines: Array<{ axis: 'X' | 'Z'; value: number }> = [
    ...g.creaseLines,
    { axis: 'X', value: g.covered.minX },
    { axis: 'X', value: g.covered.maxX },
    { axis: 'Z', value: g.covered.minZ },
    { axis: 'Z', value: g.covered.maxZ },
  ]
  for (const ln of lines) {
    const p0 = ln.axis === 'X' ? p.x : p.z
    const dd = ln.axis === 'X' ? d.x : d.z
    if (Math.abs(dd) < 1e-12) continue
    const t = (ln.value - p0) / dd
    if (t > 1e-9 && t < L - 1e-9) out.push(t)
  }
  return out
}
