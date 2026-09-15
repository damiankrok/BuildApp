/**
 * Stair layout: a FLIGHTS stair record -> the riser lines, tread polygons
 * and heights of every step, derived in plan arithmetic and nothing else.
 *
 * The path is walked in plan. The state is the current riser line — its
 * left-hand end `p` seen facing the direction of travel `d`, running `width`
 * to the right — and the number of risers climbed so far. A FLIGHT lays
 * `risers` risers `going` apart; a WINDER fans its risers about the newel
 * corner (the end of the current riser line on the turn side) and turns
 * the path; a LANDING is a level platform that may also turn. Heights are
 * the total rise divided equally over every riser. The last riser of the
 * whole stair is the arrival at the destination floor: it has no tread of
 * its own (the floor is its tread), and the compiler emits its riser face
 * as a thin plate so the stair solid reaches the destination level.
 *
 * LEFT / RIGHT are as seen walking up on a plan drawn with x to the right
 * and z up the page: walking +x, LEFT turns towards +z. In the model frame
 * (front at the bottom, z into the building) that is what a plan reader
 * sees.
 */
import type { PlanRect, Vec2 } from './geometry-types.js'
import type { FlightStair, Level, StairDirection } from './schema.js'

export type StairStep = {
  /** 1-based riser number; the tread is the one climbed onto over this riser. */
  riser: number
  /** The riser line, left end to right end (facing the travel direction). */
  line: { from: Vec2; to: Vec2 }
  /** Unit travel direction at this riser. */
  direction: Vec2
  /** Plan polygon of the tread reached over this riser; null for the arrival riser (the destination floor). */
  tread: Vec2[] | null
  /** World y of the tread surface (the top of this riser). */
  top: number
  /** Which segment (index into `segments`) this riser belongs to. */
  segment: number
}

export type StairLandingPlate = { segment: number; polygon: Vec2[]; top: number }

export type StairLayout = {
  ok: boolean
  issues: string[]
  steps: StairStep[]
  landings: StairLandingPlate[]
  risers: number
  rise: number
  riserHeight: number
  baseY: number
  topY: number
  /** Bounding rectangle of every tread, landing and riser line. */
  extent: PlanRect | null
}

export const stairDirectionVector = (d: StairDirection): Vec2 =>
  d === 'PLUS_X' ? { x: 1, z: 0 } : d === 'MINUS_X' ? { x: -1, z: 0 } : d === 'PLUS_Z' ? { x: 0, z: 1 } : { x: 0, z: -1 }

/** Left of `d` on a plan with x right and z up the page. */
export const leftOf = (d: Vec2): Vec2 => ({ x: -d.z, z: d.x })
export const rightOf = (d: Vec2): Vec2 => ({ x: d.z, z: -d.x })

const add = (a: Vec2, b: Vec2, s = 1): Vec2 => ({ x: a.x + b.x * s, z: a.z + b.z * s })
/** Nine decimals, and never a negative zero (a quarter turn onto an axis would otherwise hand back −0). */
const round = (v: number): number => {
  const r = Math.round(v * 1e9) / 1e9
  return r === 0 ? 0 : r
}
const R = (p: Vec2): Vec2 => ({ x: round(p.x), z: round(p.z) })

export function layoutStair(stair: FlightStair, level: Pick<Level, 'elevation'>, toLevel: Pick<Level, 'elevation'>): StairLayout {
  const issues: string[] = []
  const baseY = level.elevation + stair.baseOffset
  const topY = toLevel.elevation + stair.topOffset
  const rise = topY - baseY
  const risers = stair.segments.reduce((n, s) => n + (s.kind === 'LANDING' ? 0 : s.risers), 0)
  if (rise <= 1e-9) issues.push(`the stair must rise: from ${baseY} to ${topY} is ${rise.toFixed(3)} m`)
  if (risers < 1) issues.push('the stair has no risers')
  const last = stair.segments[stair.segments.length - 1]
  if (last.kind !== 'FLIGHT') issues.push('the last segment must be a FLIGHT: the stair arrives at the destination floor over a straight riser')
  stair.segments.forEach((s, i) => {
    if (s.kind === 'LANDING' && s.turn !== 'NONE' && s.length < stair.width - 1e-9) issues.push(`a turning landing must be at least the stair width (${stair.width}) long; this one is ${s.length}`)
    if (s.kind === 'LANDING' && (i === 0 || stair.segments[i - 1].kind !== 'FLIGHT')) issues.push(`segment ${i + 1}: a landing follows a flight`)
  })
  const h = risers > 0 ? rise / risers : 0
  const W = stair.width
  const steps: StairStep[] = []
  const landings: StairLandingPlate[] = []
  let p = { ...stair.start }
  let d = stairDirectionVector(stair.direction)
  let k = 0
  const rl = (): { from: Vec2; to: Vec2 } => ({ from: R(p), to: R(add(p, rightOf(d), W)) })
  const rect = (a: Vec2, along: Vec2, L: number, across: Vec2, Wd: number): Vec2[] => [R(a), R(add(a, across, Wd)), R(add(add(a, across, Wd), along, L)), R(add(a, along, L))]

  stair.segments.forEach((seg, si) => {
    if (seg.kind === 'FLIGHT') {
      for (let i = 0; i < seg.risers; i++) {
        k++
        steps.push({ riser: k, line: rl(), direction: { ...d }, tread: rect(p, d, seg.going, rightOf(d), W), top: round(baseY + k * h), segment: si })
        p = add(p, d, seg.going)
      }
      return
    }
    if (seg.kind === 'LANDING') {
      const poly = rect(p, d, seg.length, rightOf(d), W)
      landings.push({ segment: si, polygon: poly, top: round(baseY + k * h) })
      if (seg.turn === 'NONE') {
        p = add(p, d, seg.length)
      } else if (seg.turn === 'LEFT') {
        // exit along the platform's left edge, from its near-left corner
        d = leftOf(d)
      } else {
        // exit along the platform's right edge, from its far-right corner, travelling back across the platform's width
        p = add(add(p, d, seg.length), rightOf(d), W)
        d = rightOf(d)
      }
      return
    }
    // WINDER: fan about the newel on the turn side
    const left = seg.turn === 'LEFT'
    const N = left ? { ...p } : add(p, rightOf(d), W)
    const e0 = left ? rightOf(d) : leftOf(d)
    const e1 = { ...d }
    const angle = (seg.angleDeg * Math.PI) / 180
    const at = (theta: number): Vec2 => ({ x: e0.x * Math.cos(theta) + e1.x * Math.sin(theta), z: e0.z * Math.cos(theta) + e1.z * Math.sin(theta) })
    // the far boundary chain of the turning region, from the entering line's far end to the exit line's far end
    const c0 = add(N, e0, W)
    const c1 = add(c0, e1, W)
    const chain: Vec2[] = seg.angleDeg === 90 ? [c0, c1, add(N, e1, W)] : [c0, c1, add(add(N, e0, -W), e1, W), add(N, e0, -W)]
    const cornerAngle = (q: Vec2): number => {
      const v = add(q, N, -1)
      return Math.atan2(v.x * e1.x + v.z * e1.z, v.x * e0.x + v.z * e0.z)
    }
    const hit = (theta: number): Vec2 => {
      const dir = at(theta)
      for (let i = 0; i + 1 < chain.length; i++) {
        const a = chain[i]
        const b = chain[i + 1]
        // solve N + t·dir = a + s·(b − a)
        const ex = b.x - a.x
        const ez = b.z - a.z
        const det = dir.x * -ez - dir.z * -ex
        if (Math.abs(det) < 1e-12) continue
        const wx = a.x - N.x
        const wz = a.z - N.z
        const t = (wx * -ez - wz * -ex) / det
        const s = (dir.x * wz - dir.z * wx) / det
        if (t > 0 && s >= -1e-9 && s <= 1 + 1e-9) return add(N, dir, t)
      }
      return add(N, dir, W)
    }
    for (let i = 0; i < seg.risers; i++) {
      const t0 = (i * angle) / seg.risers
      const t1 = ((i + 1) * angle) / seg.risers
      const h0 = hit(t0)
      const h1 = hit(t1)
      const poly: Vec2[] = [R(N), R(h0)]
      for (let c = 1; c + 1 < chain.length; c++) {
        const ca = cornerAngle(chain[c])
        if (ca > t0 + 1e-9 && ca < t1 - 1e-9) poly.push(R(chain[c]))
      }
      poly.push(R(h1))
      // the riser line at angle t0: from its left end to its right end facing the travel direction
      const lineFrom = left ? R(N) : R(h0)
      const lineTo = left ? R(h0) : R(N)
      const dir = left ? leftOf(add(h0, N, -1)) : rightOf(add(h0, N, -1))
      const L = Math.hypot(dir.x, dir.z) || 1
      k++
      steps.push({ riser: k, line: { from: lineFrom, to: lineTo }, direction: { x: dir.x / L, z: dir.z / L }, tread: poly, top: round(baseY + k * h), segment: si })
    }
    // exit state: the newel is the exit line's left end for a left turn, its right end for a right turn
    d = seg.angleDeg === 90 ? (left ? leftOf(d) : rightOf(d)) : { x: -d.x, z: -d.z }
    p = left ? { ...N } : add(N, leftOf(d), W)
    // normalise the direction against floating noise
    const Ld = Math.hypot(d.x, d.z)
    d = { x: round(d.x / Ld), z: round(d.z / Ld) }
  })

  // the arrival riser: its tread is the destination floor
  if (steps.length > 0) steps[steps.length - 1].tread = null

  let extent: PlanRect | null = null
  const grow = (q: Vec2): void => {
    if (!extent) extent = { minX: q.x, maxX: q.x, minZ: q.z, maxZ: q.z }
    else {
      extent.minX = Math.min(extent.minX, q.x)
      extent.maxX = Math.max(extent.maxX, q.x)
      extent.minZ = Math.min(extent.minZ, q.z)
      extent.maxZ = Math.max(extent.maxZ, q.z)
    }
  }
  for (const s of steps) {
    grow(s.line.from)
    grow(s.line.to)
    for (const q of s.tread ?? []) grow(q)
  }
  for (const l of landings) for (const q of l.polygon) grow(q)
  return { ok: issues.length === 0, issues, steps, landings, risers, rise, riserHeight: h, baseY, topY, extent }
}
