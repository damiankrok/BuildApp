/**
 * BUILDPLAN-ANALYZER-005X-N1: a pitched roof over one body, composed of its own planes.
 *
 * The model's `createRoof` knows a GABLE and a FLAT roof; a hipped or a half-hipped body is neither. It is, though, a
 * set of planes and the creases between them, which the model has carried since 1.6.0 (`createRoofPlane`,
 * `connectRoofPlanes`) and under which walls die (`FOLLOW_ROOF_PLANES`). This lays such a roof out for one rectangular
 * body: two slopes along the ridge and, at each end of the ridge, either a GABLE (the slopes stop at a verge over a
 * wall that rises to the ridge) or a HIP (a third plane falls from the ridge's end to an eave along that end, the end
 * wall stopping at the eaves). Both ends hipped is a hipped roof; one is a half-hipped body against a gable; neither is
 * the familiar gable.
 *
 * Every plane falls at the body's pitch from eaves at one height. A body too short for two full hips under one pitch
 * (shorter than it is deep) keeps its eaves level and lets the end planes fall more steeply over a shorter run: the
 * ridge shrinks to a point, a pyramid. Nothing here knows a source: the caller states the ends.
 */
import { round6 } from '@buildapp/source-common'
import type { PlanBox, Vec2 } from './attached-roof-form.js'

export type RoofEnd = 'GABLE' | 'HIP'

export type PlaneRoofKey = 'LOW' | 'HIGH' | 'END_MIN' | 'END_MAX'

export type PlaneRoofPlane = { key: PlaneRoofKey; boundary: Vec2[]; downslope: Vec2; datum: { x: number; y: number; z: number }; pitchDeg: number }

export type PlaneRoofLayout = {
  ridgeAt: number
  ridgeY: number
  /** The ridge in plan, from its end at the MIN end to its end at the MAX end; one point under a pyramid. */
  ridge: [Vec2, Vec2]
  planes: PlaneRoofPlane[]
  /** The creases: the ridge between the two slopes (when it has length) and a hip between each end plane and each slope. */
  joins: Array<{ kind: 'RIDGE' | 'HIP'; keys: [PlaneRoofKey, PlaneRoofKey] }>
  eaves: Array<{ key: PlaneRoofKey; start: Vec2; end: Vec2 }>
  verges: Array<{ key: PlaneRoofKey; start: Vec2; end: Vec2 }>
}

/** Consecutive repeats dropped: a slope whose ridge is a point is a triangle. */
const distinct = (ps: Vec2[]): Vec2[] => ps.filter((p, i) => {
  const q = ps[(i + ps.length - 1) % ps.length]
  return Math.abs(p.x - q.x) > 1e-9 || Math.abs(p.z - q.z) > 1e-9
})

/**
 * The planes of a pitched roof over `body`, its ridge along `ridgeAxis`, the top surface at `eaveY` along every eave,
 * each end of the ridge a gable or a hip.
 */
export function planeRoofLayout(body: PlanBox, ridgeAxis: 'X' | 'Z', pitchDeg: number, eaveY: number, ends: { min: RoofEnd; max: RoofEnd }): PlaneRoofLayout {
  const tan = Math.tan((pitchDeg * Math.PI) / 180)
  // Local frame: `u` across the ridge, `t` along it.
  const [u0, u1] = ridgeAxis === 'Z' ? [body.x0, body.x1] : [body.z0, body.z1]
  const [t0, t1] = ridgeAxis === 'Z' ? [body.z0, body.z1] : [body.x0, body.x1]
  const half = (u1 - u0) / 2
  const uR = round6(u0 + half)
  const ridgeY = round6(eaveY + half * tan)
  const P = (u: number, t: number): Vec2 => (ridgeAxis === 'Z' ? { x: round6(u), z: round6(t) } : { x: round6(t), z: round6(u) })
  const D = (du: number, dt: number): Vec2 => (ridgeAxis === 'Z' ? { x: du, z: dt } : { x: dt, z: du })
  const W = (u: number, y: number, t: number) => (ridgeAxis === 'Z' ? { x: round6(u), y: round6(y), z: round6(t) } : { x: round6(t), y: round6(y), z: round6(u) })
  const hips = (ends.min === 'HIP' ? 1 : 0) + (ends.max === 'HIP' ? 1 : 0)
  // A hip runs in by the half-span at the body's pitch; on a body too short for that, by the share of its length it has.
  const inset = hips === 0 ? 0 : Math.min(half, (t1 - t0) / hips)
  const tA = ends.min === 'HIP' ? round6(t0 + inset) : t0
  const tB = ends.max === 'HIP' ? round6(t1 - inset) : t1
  const endPitch = inset > 0 ? round6((Math.atan((ridgeY - eaveY) / inset) * 180) / Math.PI) : pitchDeg
  const planes: PlaneRoofPlane[] = [
    { key: 'LOW', boundary: distinct([P(u0, t0), P(uR, tA), P(uR, tB), P(u0, t1)]), downslope: D(-1, 0), datum: W(u0, eaveY, t0), pitchDeg },
    { key: 'HIGH', boundary: distinct([P(uR, tA), P(u1, t0), P(u1, t1), P(uR, tB)]), downslope: D(1, 0), datum: W(u1, eaveY, t0), pitchDeg },
  ]
  const joins: PlaneRoofLayout['joins'] = tB - tA > 1e-6 ? [{ kind: 'RIDGE', keys: ['LOW', 'HIGH'] }] : []
  const eaves: PlaneRoofLayout['eaves'] = [
    { key: 'LOW', start: P(u0, t0), end: P(u0, t1) },
    { key: 'HIGH', start: P(u1, t0), end: P(u1, t1) },
  ]
  const verges: PlaneRoofLayout['verges'] = []
  if (ends.min === 'HIP') {
    planes.push({ key: 'END_MIN', boundary: [P(u0, t0), P(u1, t0), P(uR, tA)], downslope: D(0, -1), datum: W(u0, eaveY, t0), pitchDeg: endPitch })
    joins.push({ kind: 'HIP', keys: ['END_MIN', 'LOW'] }, { kind: 'HIP', keys: ['END_MIN', 'HIGH'] })
    eaves.push({ key: 'END_MIN', start: P(u0, t0), end: P(u1, t0) })
  } else verges.push({ key: 'LOW', start: P(u0, t0), end: P(uR, t0) }, { key: 'HIGH', start: P(uR, t0), end: P(u1, t0) })
  if (ends.max === 'HIP') {
    planes.push({ key: 'END_MAX', boundary: [P(u0, t1), P(uR, tB), P(u1, t1)], downslope: D(0, 1), datum: W(u0, eaveY, t1), pitchDeg: endPitch })
    joins.push({ kind: 'HIP', keys: ['END_MAX', 'LOW'] }, { kind: 'HIP', keys: ['END_MAX', 'HIGH'] })
    eaves.push({ key: 'END_MAX', start: P(u0, t1), end: P(u1, t1) })
  } else verges.push({ key: 'LOW', start: P(uR, t1), end: P(u0, t1) }, { key: 'HIGH', start: P(u1, t1), end: P(uR, t1) })
  return { ridgeAt: uR, ridgeY, ridge: [P(uR, tA), P(uR, tB)], planes, joins, eaves, verges }
}

/** Which plane of a layout holds a plan point strictly inside it, if any. */
export function planeAt(layout: PlaneRoofLayout, p: Vec2): PlaneRoofPlane | undefined {
  return layout.planes.find((pl) => {
    let inside = false
    const b = pl.boundary
    for (let i = 0, j = b.length - 1; i < b.length; j = i++) {
      if (b[i].z > p.z !== b[j].z > p.z && p.x < ((b[j].x - b[i].x) * (p.z - b[i].z)) / (b[j].z - b[i].z) + b[i].x) inside = !inside
    }
    return inside
  })
}
