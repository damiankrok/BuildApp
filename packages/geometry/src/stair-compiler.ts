/**
 * Stair compiler: a FLIGHTS stair -> one closed solid.
 *
 * The layout (model package, `layoutStair`) gives every riser its line, its
 * tread polygon and its top height, and every landing its plate. Each of
 * those is a CELL: a plan polygon between a solid `bottom` and its `top`
 * (`bottom = max(base, top − riserHeight − waist)`, so the underside steps
 * down with the flight as a folded plate). The solid is the union of the
 * cells, emitted as its exposed faces only, from the plan adjacency of the
 * cells and nothing else:
 *
 *   - every cell's tread (top) and soffit (bottom) face;
 *   - on an edge two cells share: the riser, from the lower tread up to the
 *     higher one, emitted by the higher cell; and, underneath, the step of
 *     the soffit between the two bottoms, emitted by the lower-hanging cell;
 *   - on an edge no other cell shares: the cell's side face, which is also
 *     the first riser from the floor and the back face on the arrival line.
 *
 * Every cell vertex is inserted into the other cells' edges it lies on, and
 * every vertical edge is split at every height another face has a vertex
 * at on the same plan point, so the surface is edge-manifold everywhere (no
 * T-junctions), including along the newel of a winder where riser and
 * soffit faces fan around one vertical line. `manifoldReport` on the result
 * finds every directed edge exactly once, from bit-identical vertices.
 *
 * The arrival riser has no tread of its own (the destination floor is its
 * tread); a strip of `ARRIVAL_PLATE_DEPTH` is cut off the back of the last
 * cell and raised to the arrival height, so the highest emitted point of the
 * stair is the arrival, measured, not assumed. Nothing here reads the slab:
 * the void it needs is the slab's own hole.
 */
import { layoutStair, polygonSignedArea, type FlightStair, type Level, type StairStep, type Vec2 } from '@buildapp/model'
import { triOut, triangulatePolygon } from './primitives.js'
import { v3, type Triangle, type Vec3 } from './types.js'

export const ARRIVAL_PLATE_DEPTH = 0.04

export type StairCompileOutput = { triangles: Triangle[]; steps: number; riserHeight: number; ok: boolean; issues: string[] }

type Cell = { kind: 'TREAD' | 'LANDING' | 'PLATE'; poly: Vec2[]; top: number; bottom: number }

const round9 = (v: number): number => Math.round(v * 1e9) / 1e9
const R = (p: Vec2): Vec2 => ({ x: round9(p.x), z: round9(p.z) })
const keyOf = (p: Vec2): string => `${p.x},${p.z}`
const samePt = (a: Vec2, b: Vec2): boolean => a.x === b.x && a.z === b.z

/** Consecutive duplicate vertices removed (a fan tread whose newel repeats, a rounded coincidence), counter-clockwise. */
function clean(poly: readonly Vec2[]): Vec2[] {
  const out: Vec2[] = []
  for (const p of poly) if (out.length === 0 || !samePt(out[out.length - 1], p)) out.push(p)
  if (out.length > 1 && samePt(out[0], out[out.length - 1])) out.pop()
  return polygonSignedArea(out) < 0 ? out.reverse() : out
}

/** `p` strictly inside the segment a→b (collinear, between the ends). */
function onOpenSegment(p: Vec2, a: Vec2, b: Vec2): boolean {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const L2 = dx * dx + dz * dz
  if (L2 <= 1e-18) return false
  const cross = dx * (p.z - a.z) - dz * (p.x - a.x)
  if (Math.abs(cross) > 1e-9 * Math.sqrt(L2)) return false
  const t = ((p.x - a.x) * dx + (p.z - a.z) * dz) / L2
  return t > 1e-9 && t < 1 - 1e-9
}

/** The polygon with every given point that lies on one of its edges inserted into that edge. */
function insertPoints(poly: Vec2[], points: readonly Vec2[]): Vec2[] {
  let out = poly
  for (const p of points) {
    if (out.some((q) => samePt(q, p))) continue
    for (let i = 0; i < out.length; i++) {
      if (onOpenSegment(p, out[i], out[(i + 1) % out.length])) {
        out = [...out.slice(0, i + 1), p, ...out.slice(i + 1)]
        break
      }
    }
  }
  return out
}

/**
 * Split a convex polygon by the line at distance `depth` from the line
 * through `from` along `u` (unit, pointing into the polygon): the strip
 * within `depth` of that line, and the rest. Crossing points are computed
 * once and shared by both halves.
 */
function splitStrip(poly: readonly Vec2[], from: Vec2, u: Vec2, depth: number): { strip: Vec2[]; rest: Vec2[] } | null {
  const f = (p: Vec2): number => (p.x - from.x) * u.x + (p.z - from.z) * u.z - depth
  const strip: Vec2[] = []
  const rest: Vec2[] = []
  const n = poly.length
  for (let i = 0; i < n; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % n]
    const fa = f(a)
    const fb = f(b)
    if (fa <= 1e-12) strip.push(a)
    if (fa >= -1e-12) rest.push(a)
    if ((fa < -1e-12 && fb > 1e-12) || (fa > 1e-12 && fb < -1e-12)) {
      const t = fa / (fa - fb)
      const x = R({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })
      strip.push(x)
      rest.push(x)
    }
  }
  const s = clean(strip)
  const r = clean(rest)
  if (s.length < 3 || r.length < 3 || Math.abs(polygonSignedArea(s)) < 1e-9 || Math.abs(polygonSignedArea(r)) < 1e-9) return null
  return { strip: s, rest: r }
}

export function compileStair(stair: FlightStair, level: Level, toLevel: Level): StairCompileOutput {
  const layout = layoutStair(stair, level, toLevel)
  const out: Triangle[] = []
  if (!layout.ok) return { triangles: out, steps: 0, riserHeight: layout.riserHeight, ok: false, issues: layout.issues }
  const h = layout.riserHeight
  const base = layout.baseY
  const issues: string[] = []
  // heights are rounded like the layout's plan points, so a soffit that meets a tread at the same height shares its vertices bit for bit
  const bottomOf = (top: number): number => round9(Math.max(base, top - h - stair.waist))

  // --- the cells in walking order: treads and landings ---
  const cells: Cell[] = []
  stair.segments.forEach((seg, si) => {
    if (seg.kind === 'LANDING') {
      const plate = layout.landings.find((l) => l.segment === si)
      if (plate) cells.push({ kind: 'LANDING', poly: clean(plate.polygon), top: plate.top, bottom: bottomOf(plate.top) })
      return
    }
    for (const s of layout.steps.filter((x) => x.segment === si)) if (s.tread) cells.push({ kind: 'TREAD', poly: clean(s.tread), top: s.top, bottom: bottomOf(s.top) })
  })
  if (cells.length === 0) return { triangles: out, steps: 0, riserHeight: h, ok: false, issues: ['the stair has no tread'] }

  // --- the arrival plate: the back strip of the last cell, raised to the arrival height ---
  const arrival: StairStep = layout.steps[layout.steps.length - 1]
  const last = cells[cells.length - 1]
  const into = { x: -arrival.direction.x, z: -arrival.direction.z } // from the arrival line back into the last cell
  const split = splitStrip(last.poly, arrival.line.from, into, ARRIVAL_PLATE_DEPTH)
  if (split) {
    last.poly = split.rest
    cells.push({ kind: 'PLATE', poly: split.strip, top: arrival.top, bottom: last.bottom })
  } else {
    issues.push('the last tread is too shallow for the arrival plate')
  }

  // --- plan T-junctions: every vertex of every cell is a vertex of each edge it lies on ---
  const allVerts: Vec2[] = []
  const seen = new Set<string>()
  for (const c of cells) {
    for (const p of c.poly) {
      if (seen.has(keyOf(p))) continue
      seen.add(keyOf(p))
      allVerts.push(p)
    }
  }
  for (const c of cells) c.poly = insertPoints(c.poly, allVerts)

  // --- every vertex height per plan point, so vertical edges can be split at their neighbours' vertices ---
  const heights = new Map<string, number[]>()
  const reg = (p: Vec2, y: number): void => {
    const k = keyOf(p)
    const list = heights.get(k)
    if (!list) heights.set(k, [y])
    else if (!list.includes(y)) list.push(y)
  }
  for (const c of cells) {
    for (const p of c.poly) {
      reg(p, c.top)
      reg(p, c.bottom)
    }
  }
  for (const list of heights.values()) list.sort((a, b) => a - b)

  // --- adjacency: the cells across a directed edge own the reverse edge (every polygon is counter-clockwise); a
  // dog-leg's two flights, or a spiral's turns, can stack several cells over one plan edge at different heights ---
  const owners = new Map<string, number[]>()
  cells.forEach((c, ci) => {
    const n = c.poly.length
    for (let i = 0; i < n; i++) {
      const k = `${keyOf(c.poly[i])}|${keyOf(c.poly[(i + 1) % n])}`
      owners.set(k, [...(owners.get(k) ?? []), ci])
    }
  })
  /** The parts of [lo, hi] no cell across the edge occupies: those faces of this cell are exposed. */
  const exposed = (lo: number, hi: number, across: readonly number[]): Array<[number, number]> => {
    let parts: Array<[number, number]> = [[lo, hi]]
    for (const ci of across) {
      const o = cells[ci]
      parts = parts.flatMap(([a, b]) => {
        if (o.top <= a || o.bottom >= b) return [[a, b]]
        const keep: Array<[number, number]> = []
        if (o.bottom > a) keep.push([a, o.bottom])
        if (o.top < b) keep.push([o.top, b])
        return keep
      })
    }
    return parts
  }

  const P = (p: Vec2, y: number): Vec3 => v3(p.x, y, p.z)
  /** A vertical face over the plan segment a→b between `lo` and `hi`, its two vertical edges split at every registered height. */
  const vertical = (a: Vec2, b: Vec2, lo: number, hi: number, outward: Vec3): void => {
    if (hi - lo <= 1e-12) return
    const between = (k: string): number[] => (heights.get(k) ?? []).filter((y) => y > lo && y < hi)
    const A = [lo, ...between(keyOf(a)), hi].map((y) => P(a, y))
    const B = [lo, ...between(keyOf(b)), hi].map((y) => P(b, y))
    let i = 0
    let j = 0
    while (i < A.length - 1 || j < B.length - 1) {
      if (j === B.length - 1 || (i < A.length - 1 && A[i + 1].y <= B[j + 1].y)) {
        triOut(out, A[i], B[j], A[i + 1], outward)
        i++
      } else {
        triOut(out, A[i], B[j], B[j + 1], outward)
        j++
      }
    }
  }
  const horizontal = (poly: readonly Vec2[], y: number, up: boolean): boolean => {
    const tri = triangulatePolygon(poly)
    if (!tri) return false
    for (const [i, j, k] of tri) triOut(out, P(poly[i], y), P(poly[j], y), P(poly[k], y), v3(0, up ? 1 : -1, 0))
    return true
  }

  // --- emit ---
  cells.forEach((c, ci) => {
    if (!horizontal(c.poly, c.top, true) || !horizontal(c.poly, c.bottom, false)) {
      issues.push(`step ${ci + 1}: its plan polygon cannot be triangulated`)
      return
    }
    const n = c.poly.length
    for (let i = 0; i < n; i++) {
      const a = c.poly[i]
      const b = c.poly[(i + 1) % n]
      const outward = v3(b.z - a.z, 0, -(b.x - a.x)) // counter-clockwise polygon: the interior is on the left of a→b
      // A side where no cell is across; against a neighbour, the riser above its tread and the soffit step below its
      // bottom; the whole face where the neighbour is a flight passing above or below (a dog-leg).
      for (const [lo, hi] of exposed(c.bottom, c.top, owners.get(`${keyOf(b)}|${keyOf(a)}`) ?? [])) vertical(a, b, lo, hi, outward)
    }
  })

  return { triangles: out, steps: cells.length, riserHeight: h, ok: issues.length === 0, issues }
}
