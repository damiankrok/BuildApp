/**
 * Roof compiler: GABLE and FLAT, with structural roof openings.
 *
 * A gable is built from the eave height, the pitch and the footprint's
 * half-span; the ridge height is a consequence. Both slopes are emitted as one
 * closed solid: the two slabs meet at the ridge, so the internal ridge faces
 * are not emitted and the whole roof is a single manifold prism with a
 * chevron cross-section. Thickness is perpendicular to the slope: a vertical
 * drop of `t / cos(pitch)` is a perpendicular depth of `t`.
 *
 * ## Roof openings
 *
 * A `RoofOpening` removes the vertical prism over its plan rectangle from the
 * roof. Each slope (or the flat plate) is tiled on a grid in plan
 * coordinates — `along` the ridge, `cross` it — whose breaks are the hole
 * edges: bands across the slope at every hole's cross edges, and inside a band
 * that holds holes, cells at their along edges. A band without holes is one
 * cell, so the eave, ridge and gable-end edges stay single segments wherever
 * no hole touches them; the gable end faces are split on the same bands, so
 * every shared edge is computed from identical values and the solid stays
 * watertight. A hole's four reveals are vertical quads between the top
 * surface and the underside; they belong to the opening and close the roof's
 * solid, exactly like wall reveals. Because the prism is vertical, the hole
 * has the same plan outline on the top surface and on the underside, and a
 * chimney whose footprint is the hole passes through without sharing volume.
 *
 * `roofGeometry` also exposes the roof's underside as a function of plan
 * position, which is what lets a wall die into the roof (FOLLOW_ROOF).
 */
import type { Level, PlanRect, Roof, RoofOpening, Vec2 } from '@buildapp/model'
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

export type RoofCompileOutput = {
  /** Faces of the roof itself. */
  triangles: Triangle[]
  /** Reveal faces lining each cut roof opening, by opening id. */
  reveals: Map<string, Triangle[]>
  cutOpeningIds: string[]
  geometry: RoofGeometry
}

const EPS = 1e-9

function uniqueSorted(values: number[]): number[] {
  const all = [...values].sort((a, b) => a - b)
  const out: number[] = []
  for (const x of all) if (out.length === 0 || x - out[out.length - 1] > EPS) out.push(x)
  return out
}

type Hole = { id: string; a0: number; a1: number; c0: number; c1: number }

/**
 * One plate — a slope of a gable or a flat roof — in plan coordinates `along`
 * (with the ridge / any axis) and `cross`, with a top surface `topY(cross)`
 * that is linear in `cross`, a vertical thickness `drop`, and rectangular
 * holes. Emits the top and underside faces, the two end faces at `along0` and
 * `along1`, and the reveals of every hole. The faces across the plate at
 * `cross0` / `cross1` are the caller's (an eave face; nothing at a ridge).
 */
function tilePlate(
  out: Triangle[],
  reveals: Map<string, Triangle[]>,
  p: {
    along0: number
    along1: number
    cross0: number
    cross1: number
    holes: Hole[]
    /** Every along-break of the whole roof (all holes on every slope), so bands, slopes and eave faces split their shared edges identically. */
    alongBreaks: number[]
    topY: (cross: number) => number
    drop: number
    P: (along: number, cross: number, y: number) => Vec3
    outTop: Vec3
    alongDir: Vec3
    crossDir: Vec3
  },
): void {
  const crossBreaks = uniqueSorted([p.cross0, p.cross1, ...p.holes.flatMap((h) => [h.c0, h.c1])])
  const ys = crossBreaks.map((c) => p.topY(c))
  const snap = (v: number, list: number[]): number => list.find((x) => Math.abs(x - v) <= EPS) ?? v
  const alongBreaks = p.alongBreaks
  const holes = p.holes.map((h) => ({ ...h, a0: snap(h.a0, alongBreaks), a1: snap(h.a1, alongBreaks), c0: snap(h.c0, crossBreaks), c1: snap(h.c1, crossBreaks) }))
  const neg = (a: Vec3): Vec3 => v3(-a.x, -a.y, -a.z)
  const outBottom = neg(p.outTop)
  for (let k = 0; k + 1 < crossBreaks.length; k++) {
    const c0 = crossBreaks[k]
    const c1 = crossBreaks[k + 1]
    const y0 = ys[k]
    const y1 = ys[k + 1]
    const inBand = holes.filter((h) => h.c0 <= c0 + EPS && h.c1 >= c1 - EPS)
    for (let i = 0; i + 1 < alongBreaks.length; i++) {
      const a0 = alongBreaks[i]
      const a1 = alongBreaks[i + 1]
      const mid = (a0 + a1) / 2
      if (inBand.some((h) => h.a0 <= mid && mid <= h.a1)) continue
      quadOut(out, p.P(a0, c0, y0), p.P(a1, c0, y0), p.P(a1, c1, y1), p.P(a0, c1, y1), p.outTop)
      quadOut(out, p.P(a0, c0, y0 - p.drop), p.P(a1, c0, y0 - p.drop), p.P(a1, c1, y1 - p.drop), p.P(a0, c1, y1 - p.drop), outBottom)
    }
    // End faces at along0 and along1, one per band so they share the top and underside edges exactly.
    quadOut(out, p.P(p.along0, c0, y0), p.P(p.along0, c1, y1), p.P(p.along0, c1, y1 - p.drop), p.P(p.along0, c0, y0 - p.drop), neg(p.alongDir))
    quadOut(out, p.P(p.along1, c0, y0), p.P(p.along1, c1, y1), p.P(p.along1, c1, y1 - p.drop), p.P(p.along1, c0, y0 - p.drop), p.alongDir)
  }
  // Reveals: vertical faces around each hole, facing into it, split on the same
  // breaks as the cells beside them so that every edge is shared exactly.
  for (const h of holes) {
    const list = reveals.get(h.id) ?? []
    const cs = crossBreaks.filter((c) => c >= h.c0 - EPS && c <= h.c1 + EPS)
    const as = alongBreaks.filter((a) => a >= h.a0 - EPS && a <= h.a1 + EPS)
    for (let k = 0; k + 1 < cs.length; k++) {
      const y0 = ys[crossBreaks.indexOf(cs[k])]
      const y1 = ys[crossBreaks.indexOf(cs[k + 1])]
      quadOut(list, p.P(h.a0, cs[k], y0), p.P(h.a0, cs[k + 1], y1), p.P(h.a0, cs[k + 1], y1 - p.drop), p.P(h.a0, cs[k], y0 - p.drop), p.alongDir)
      quadOut(list, p.P(h.a1, cs[k], y0), p.P(h.a1, cs[k + 1], y1), p.P(h.a1, cs[k + 1], y1 - p.drop), p.P(h.a1, cs[k], y0 - p.drop), neg(p.alongDir))
    }
    const y0 = ys[crossBreaks.indexOf(h.c0)]
    const y1 = ys[crossBreaks.indexOf(h.c1)]
    for (let i = 0; i + 1 < as.length; i++) {
      quadOut(list, p.P(as[i], h.c0, y0), p.P(as[i + 1], h.c0, y0), p.P(as[i + 1], h.c0, y0 - p.drop), p.P(as[i], h.c0, y0 - p.drop), p.crossDir)
      quadOut(list, p.P(as[i], h.c1, y1), p.P(as[i + 1], h.c1, y1), p.P(as[i + 1], h.c1, y1 - p.drop), p.P(as[i], h.c1, y1 - p.drop), neg(p.crossDir))
    }
    reveals.set(h.id, list)
  }
}

/** The roof as one closed solid, with every roof opening cut through it. */
export function compileRoofTriangles(roof: Roof, level: Level, openings: readonly RoofOpening[] = []): RoofCompileOutput {
  const g = roofGeometry(roof, level)
  const out: Triangle[] = []
  const reveals = new Map<string, Triangle[]>()
  const c = g.covered
  const alongX = roof.kind === 'FLAT' ? true : roof.ridgeAxis === 'X'
  const P = (along: number, cross: number, y: number): Vec3 => (alongX ? v3(along, y, cross) : v3(cross, y, along))
  const alongDir = alongX ? v3(1, 0, 0) : v3(0, 0, 1)
  const crossDir = alongX ? v3(0, 0, 1) : v3(1, 0, 0)
  const along0 = alongX ? c.minX : c.minZ
  const along1 = alongX ? c.maxX : c.maxZ
  const cross0 = alongX ? c.minZ : c.minX
  const cross1 = alongX ? c.maxZ : c.maxX
  const holeOf = (o: RoofOpening): Hole => ({
    id: o.id,
    a0: alongX ? o.footprint.minX : o.footprint.minZ,
    a1: alongX ? o.footprint.maxX : o.footprint.maxZ,
    c0: alongX ? o.footprint.minZ : o.footprint.minX,
    c1: alongX ? o.footprint.maxZ : o.footprint.maxX,
  })
  const holes = openings.map(holeOf)
  const drop = g.verticalDrop
  const alongBreaks = uniqueSorted([along0, along1, ...holes.flatMap((h) => [h.a0, h.a1])])
  /** A face across the plate at one cross value, split at every along-break so it shares the plate's edge vertex for vertex. */
  const crossFace = (cross: number, yTop: number, outward: Vec3): void => {
    for (let i = 0; i + 1 < alongBreaks.length; i++) {
      const a0 = alongBreaks[i]
      const a1 = alongBreaks[i + 1]
      quadOut(out, P(a0, cross, yTop - drop), P(a1, cross, yTop - drop), P(a1, cross, yTop), P(a0, cross, yTop), outward)
    }
  }

  if (roof.kind === 'FLAT') {
    const y1 = g.eaveY
    tilePlate(out, reveals, { along0, along1, cross0, cross1, holes, alongBreaks, topY: () => y1, drop, P, outTop: v3(0, 1, 0), alongDir, crossDir })
    // the two faces across the plate
    crossFace(cross0, y1, v3(-crossDir.x, 0, -crossDir.z))
    crossFace(cross1, y1, crossDir)
    return { triangles: out, reveals, cutOpeningIds: openings.map((o) => o.id), geometry: g }
  }

  const mid = (cross0 + cross1) / 2
  const topOf = (cross: number): number => (alongX ? g.topAt(0, cross) : g.topAt(cross, 0))
  const eaveTop = topOf(cross0) // the same at cross1 by symmetry, and used for both so the two eaves share one value
  const ridgeTop = g.ridgeY

  for (const side of [-1, 1] as const) {
    const eaveCross = side < 0 ? cross0 : cross1
    // Top slope surface: outward is up and towards the eave. Underside: down and towards the ridge.
    const outTop = v3(crossDir.x * side, 1, crossDir.z * side)
    const slopeHoles = holes.filter((h) => (side < 0 ? h.c1 <= mid + EPS : h.c0 >= mid - EPS))
    // The eave and ridge values are the shared ones, so the eave face and the other slope compute identical vertices.
    const topY = (cross: number): number => (cross === eaveCross ? eaveTop : cross === mid ? ridgeTop : topOf(cross))
    tilePlate(out, reveals, {
      along0,
      along1,
      cross0: side < 0 ? cross0 : mid,
      cross1: side < 0 ? mid : cross1,
      holes: slopeHoles,
      alongBreaks,
      topY,
      drop,
      P,
      outTop,
      alongDir,
      crossDir,
    })
    // Eave end face: vertical, outward along ±cross.
    crossFace(eaveCross, eaveTop, v3(crossDir.x * side, 0, crossDir.z * side))
  }
  return { triangles: out, reveals, cutOpeningIds: openings.map((o) => o.id), geometry: g }
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

// ---------------------------------------------------------------------------
// Rooflight fills
// ---------------------------------------------------------------------------

export type RooflightPiece = { part: 'ROOFLIGHT_FRAME' | 'ROOFLIGHT_GLASS'; triangles: Triangle[] }

const rectCorners = (r: PlanRect): Vec2[] => [
  { x: r.minX, z: r.minZ },
  { x: r.maxX, z: r.minZ },
  { x: r.maxX, z: r.maxZ },
  { x: r.minX, z: r.maxZ },
]

/** A vertical prism over a plan rectangle, capped by two sloped (or level) planes. One closed solid. */
function prismBetweenPlanes(out: Triangle[], r: PlanRect, yTop: (x: number, z: number) => number, yBot: (x: number, z: number) => number): void {
  const C = rectCorners(r)
  const T = C.map((p) => v3(p.x, yTop(p.x, p.z), p.z))
  const B = C.map((p) => v3(p.x, yBot(p.x, p.z), p.z))
  quadOut(out, T[0], T[1], T[2], T[3], v3(0, 1, 0))
  quadOut(out, B[0], B[1], B[2], B[3], v3(0, -1, 0))
  const cx = (r.minX + r.maxX) / 2
  const cz = (r.minZ + r.maxZ) / 2
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4
    const mx = (C[i].x + C[j].x) / 2 - cx
    const mz = (C[i].z + C[j].z) / 2 - cz
    quadOut(out, B[i], B[j], T[j], T[i], v3(mx, 0, mz))
  }
}

/** A ring between an outer and an inner plan rectangle, vertical sides, capped by two sloped planes. One closed solid. */
function ringBetweenPlanes(out: Triangle[], outer: PlanRect, inner: PlanRect, yTop: (x: number, z: number) => number, yBot: (x: number, z: number) => number): void {
  const O = rectCorners(outer)
  const I = rectCorners(inner)
  const cx = (outer.minX + outer.maxX) / 2
  const cz = (outer.minZ + outer.maxZ) / 2
  const at = (p: Vec2, y: (x: number, z: number) => number): Vec3 => v3(p.x, y(p.x, p.z), p.z)
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4
    quadOut(out, at(O[i], yTop), at(O[j], yTop), at(I[j], yTop), at(I[i], yTop), v3(0, 1, 0))
    quadOut(out, at(O[i], yBot), at(O[j], yBot), at(I[j], yBot), at(I[i], yBot), v3(0, -1, 0))
    const mx = (O[i].x + O[j].x) / 2 - cx
    const mz = (O[i].z + O[j].z) / 2 - cz
    quadOut(out, at(O[i], yBot), at(O[j], yBot), at(O[j], yTop), at(O[i], yTop), v3(mx, 0, mz))
    quadOut(out, at(I[i], yBot), at(I[j], yBot), at(I[j], yTop), at(I[i], yTop), v3(-mx, 0, -mz))
  }
}

/**
 * A rooflight in a cut roof opening: a frame ring filling the hole between
 * the roof's top surface and its underside (its outer sides coincide with the
 * reveals), and a pane at mid-depth inside the frame. Both are separate,
 * non-structural solids.
 */
export function compileRooflightFill(fill: { frameWidth: number; glassThickness: number }, opening: RoofOpening, g: RoofGeometry): RooflightPiece[] {
  const fw = fill.frameWidth
  const outer = opening.footprint
  const inner = { minX: outer.minX + fw, maxX: outer.maxX - fw, minZ: outer.minZ + fw, maxZ: outer.maxZ - fw }
  const top = (x: number, z: number): number => g.topAt(x, z)
  const bottom = (x: number, z: number): number => g.undersideAt(x, z)
  const frame: Triangle[] = []
  ringBetweenPlanes(frame, outer, inner, top, bottom)
  const glass: Triangle[] = []
  const midDepth = g.verticalDrop / 2
  const gt = fill.glassThickness / 2
  prismBetweenPlanes(
    glass,
    inner,
    (x, z) => top(x, z) - midDepth + gt,
    (x, z) => top(x, z) - midDepth - gt,
  )
  return [
    { part: 'ROOFLIGHT_FRAME', triangles: frame },
    { part: 'ROOFLIGHT_GLASS', triangles: glass },
  ]
}
