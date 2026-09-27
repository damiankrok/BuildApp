/**
 * Dormer layout: from a dormer's few semantic parameters to the primitives
 * that make it, in world coordinates.
 *
 * A dormer is not a type of roof. It is a small roof — two planes for a
 * GABLE dormer, one for a SHED or a FLAT one — standing on a front wall and
 * two cheeks inside a hole cut in a host roof plane, its planes dying into
 * the host along the lines where the two surfaces meet. Those lines are
 * computed, not stated: they are where a dormer plane's height equals the
 * host's, which for planes is a straight line in plan. The hole the dormer
 * cuts in the host is exactly the region its roof covers behind the front
 * wall, so the host's top surface meets the dormer's along the valleys with
 * no gap and no overlap.
 *
 * The frame: the front wall's outer face runs across the host slope from
 * `front.start` to `front.end`, level on the host plane (perpendicular to its
 * downslope). A point is `P(a, w) = start + u·a − d·w`: `a` across, `w` up
 * the slope from the front face (`d` the host's downslope, `u = (−d.z, d.x)`
 * so that the front wall's outward normal is `d`).
 *
 * Deliberately limited, and said so: the dormer's front is level on the
 * host (across the slope), its roof ends flush with its cheeks (no side
 * overhang; a front overhang only), and the host is one plane. A request
 * outside that is refused with a reason, never approximated.
 */
import type { PlanPolygon, Vec2, Vec3 } from './geometry-types.js'
import { roofPlaneDrop, roofPlaneSlope, roofPlaneTopAt } from './roof-plane.js'
import type { RoofEdgeKind, RoofPlane, WallPanelProfilePoint } from './schema.js'

export type DormerType = 'GABLE' | 'SHED' | 'FLAT'

export type DormerSpec = {
  type: DormerType
  host: Pick<RoofPlane, 'datum' | 'pitchDeg' | 'downslope' | 'thickness'>
  /** The front wall's outer face in plan, across the host slope. Either direction; it is oriented here. */
  front: { start: Vec2; end: Vec2 }
  /** World y of the dormer roof's top surface at its eaves (GABLE: over the cheeks; SHED and FLAT: over the front face). */
  eaveY: number
  /** GABLE: world y of the ridge. */
  ridgeY?: number
  /** SHED: pitch of the shed roof, degrees, less than the host's. */
  shedPitchDeg?: number
  wallThickness: number
  roofThickness: number
  /** How far the dormer roof runs past the front face, down the slope. */
  frontOverhang: number
}

/** A dormer plane: L / R for a gable dormer, S for a shed, F for a flat one. */
export type DormerPlaneKey = 'L' | 'R' | 'S' | 'F'

export type DormerLayout = {
  /** Unit vector across the slope (front start → end) and the host downslope. */
  u: Vec2
  d: Vec2
  width: number
  /** The oriented front line. */
  front: { start: Vec2; end: Vec2 }
  /** Host top surface along the front face. */
  frontY: number
  /** The hole the dormer body cuts in the host, in plan. */
  cutOutline: PlanPolygon
  planes: Array<{ key: DormerPlaneKey; boundary: PlanPolygon; datum: Vec3; pitchDeg: number; downslope: Vec2; thickness: number }>
  /** Edges of the dormer roof; `HOST` stands for the host plane. */
  edges: Array<{ key: string; kind: RoofEdgeKind; planes: Array<DormerPlaneKey | 'HOST'>; start: Vec3; end: Vec3 }>
  /** The front wall: outer face line, base and the height its top may reach (it follows the dormer planes). */
  frontWall: { start: Vec2; end: Vec2; baseY: number; height: number; thickness: number }
  cheeks: Array<{ key: 'L' | 'R'; start: Vec2; end: Vec2; bottom: WallPanelProfilePoint[]; top: WallPanelProfilePoint[]; thickness: number }>
  /** Where the host is free along the front face (its underside under the front wall), for placing a window. */
  hostDropAtFront: number
  /** The dormer roof's underside above the front face at `a` across, world y. */
  frontUndersideAt: (a: number) => number
}

export type DormerLayoutResult = { ok: true; layout: DormerLayout } | { ok: false; reason: string }

const EPS = 1e-9

export function layoutDormer(spec: DormerSpec): DormerLayoutResult {
  const host = spec.host
  if (host.pitchDeg <= 0) return { ok: false, reason: 'a dormer stands in a pitched host plane; this one is flat' }
  const d = host.downslope
  let start = spec.front.start
  let end = spec.front.end
  const W = Math.hypot(end.x - start.x, end.z - start.z)
  if (W <= 1e-6) return { ok: false, reason: 'the dormer front has no width' }
  let v = { x: (end.x - start.x) / W, z: (end.z - start.z) / W }
  if (Math.abs(v.x * d.x + v.z * d.z) > 1e-6) return { ok: false, reason: 'the dormer front must run level across the host slope (perpendicular to its downslope)' }
  const u = { x: -d.z, z: d.x }
  if (v.x * u.x + v.z * u.z < 0) {
    ;[start, end] = [end, start]
    v = { x: -v.x, z: -v.z }
  }
  const P = (a: number, w: number): Vec2 => ({ x: start.x + u.x * a - d.x * w, z: start.z + u.z * a - d.z * w })
  const P3 = (a: number, w: number, y: number): Vec3 => {
    const p = P(a, w)
    return { x: p.x, y, z: p.z }
  }
  const tanH = roofPlaneSlope(host)
  const dropH = roofPlaneDrop(host)
  const frontY = roofPlaneTopAt(host, start.x, start.z)
  const hostTopAtW = (w: number): number => frontY + w * tanH
  const t = spec.wallThickness
  const o = spec.frontOverhang
  if (o < 0) return { ok: false, reason: 'the front overhang cannot be negative' }
  const tr = spec.roofThickness
  const eaveY = spec.eaveY

  const planes: DormerLayout['planes'] = []
  const edges: DormerLayout['edges'] = []
  let cutOutline: PlanPolygon
  let frontUndersideAt: (a: number) => number
  /** The dormer roof's underside at (a, w): what the cheeks and the front wall rise to. */
  let undersideAt: (a: number, w: number) => number
  /** Where along w the dormer roof dies into the host, at a = 0 (and a = W, by symmetry). */
  let wSide: number
  let wallTopMax: number

  if (spec.type === 'GABLE') {
    const ridgeY = spec.ridgeY
    if (ridgeY === undefined || ridgeY <= eaveY + 1e-6) return { ok: false, reason: 'a gable dormer needs a ridge above its eaves' }
    const half = W / 2
    const tanD = (ridgeY - eaveY) / half
    const pitchD = (Math.atan(tanD) * 180) / Math.PI
    const dropD = tr / Math.cos(Math.atan(tanD))
    if (eaveY - dropD <= frontY + 1e-3) return { ok: false, reason: 'the dormer eave (its roof underside) does not clear the host roof at the front face' }
    const wc = (eaveY - frontY) / tanH
    const wr = (ridgeY - frontY) / tanH
    planes.push({ key: 'L', boundary: [P(0, -o), P(half, -o), P(half, wr), P(0, wc)], datum: P3(0, 0, eaveY), pitchDeg: pitchD, downslope: { x: -u.x, z: -u.z }, thickness: tr })
    planes.push({ key: 'R', boundary: [P(half, -o), P(W, -o), P(W, wc), P(half, wr)], datum: P3(W, 0, eaveY), pitchDeg: pitchD, downslope: { x: u.x, z: u.z }, thickness: tr })
    edges.push({ key: 'ridge', kind: 'RIDGE', planes: ['L', 'R'], start: P3(half, -o, ridgeY), end: P3(half, wr, ridgeY) })
    edges.push({ key: 'eave-l', kind: 'EAVE', planes: ['L'], start: P3(0, -o, eaveY), end: P3(0, wc, eaveY) })
    edges.push({ key: 'eave-r', kind: 'EAVE', planes: ['R'], start: P3(W, -o, eaveY), end: P3(W, wc, eaveY) })
    if (o > 0) {
      edges.push({ key: 'verge-l', kind: 'VERGE', planes: ['L'], start: P3(0, -o, eaveY), end: P3(half, -o, ridgeY) })
      edges.push({ key: 'verge-r', kind: 'VERGE', planes: ['R'], start: P3(half, -o, ridgeY), end: P3(W, -o, eaveY) })
    }
    edges.push({ key: 'valley-l', kind: 'VALLEY', planes: ['L', 'HOST'], start: P3(0, wc, eaveY), end: P3(half, wr, ridgeY) })
    edges.push({ key: 'valley-r', kind: 'VALLEY', planes: ['R', 'HOST'], start: P3(half, wr, ridgeY), end: P3(W, wc, eaveY) })
    cutOutline = [P(0, 0), P(W, 0), P(W, wc), P(half, wr), P(0, wc)]
    undersideAt = (a) => eaveY + Math.min(a, W - a) * tanD - dropD
    frontUndersideAt = (a) => undersideAt(a, 0)
    wSide = wc
    wallTopMax = ridgeY - dropD
    // cheeks rise to the plane's underside over their outer face
    return finish(Math.min(wSide, wSide + (dropH - dropD) / tanH), () => eaveY - dropD)
  }

  if (spec.type === 'SHED') {
    const pitchS = spec.shedPitchDeg
    if (pitchS === undefined || pitchS <= 0) return { ok: false, reason: 'a shed dormer needs a pitch' }
    if (pitchS >= host.pitchDeg) return { ok: false, reason: 'a shed dormer roof must be flatter than its host, or it never meets it' }
    const tanS = Math.tan((pitchS * Math.PI) / 180)
    const dropS = tr / Math.cos((pitchS * Math.PI) / 180)
    if (eaveY - dropS <= frontY + 1e-3) return { ok: false, reason: 'the dormer eave (its roof underside) does not clear the host roof at the front face' }
    const wb = (eaveY - frontY) / (tanH - tanS)
    const topAt = (w: number): number => eaveY + w * tanS
    planes.push({ key: 'S', boundary: [P(0, -o), P(W, -o), P(W, wb), P(0, wb)], datum: P3(0, 0, eaveY), pitchDeg: pitchS, downslope: { x: d.x, z: d.z }, thickness: tr })
    edges.push({ key: 'eave', kind: 'EAVE', planes: ['S'], start: P3(0, -o, topAt(-o)), end: P3(W, -o, topAt(-o)) })
    edges.push({ key: 'verge-l', kind: 'VERGE', planes: ['S'], start: P3(0, -o, topAt(-o)), end: P3(0, wb, topAt(wb)) })
    edges.push({ key: 'verge-r', kind: 'VERGE', planes: ['S'], start: P3(W, -o, topAt(-o)), end: P3(W, wb, topAt(wb)) })
    edges.push({ key: 'valley', kind: 'VALLEY', planes: ['S', 'HOST'], start: P3(0, wb, topAt(wb)), end: P3(W, wb, topAt(wb)) })
    cutOutline = [P(0, 0), P(W, 0), P(W, wb), P(0, wb)]
    undersideAt = (_a, w) => topAt(w) - dropS
    frontUndersideAt = (a) => undersideAt(a, 0)
    wSide = wb
    wallTopMax = topAt(t) - dropS
    const wx = wb + (dropH - dropS) / (tanH - tanS)
    return finish(Math.min(wb, wx), (w) => topAt(w) - dropS)
  }

  // FLAT
  const dropF = tr
  if (eaveY - dropF <= frontY + 1e-3) return { ok: false, reason: 'the dormer roof underside does not clear the host roof at the front face' }
  const wc = (eaveY - frontY) / tanH
  planes.push({ key: 'F', boundary: [P(0, -o), P(W, -o), P(W, wc), P(0, wc)], datum: P3(0, 0, eaveY), pitchDeg: 0, downslope: { x: d.x, z: d.z }, thickness: tr })
  edges.push({ key: 'eave', kind: 'EAVE', planes: ['F'], start: P3(0, -o, eaveY), end: P3(W, -o, eaveY) })
  edges.push({ key: 'edge-l', kind: 'BOUNDARY', planes: ['F'], start: P3(0, -o, eaveY), end: P3(0, wc, eaveY) })
  edges.push({ key: 'edge-r', kind: 'BOUNDARY', planes: ['F'], start: P3(W, -o, eaveY), end: P3(W, wc, eaveY) })
  edges.push({ key: 'valley', kind: 'VALLEY', planes: ['F', 'HOST'], start: P3(0, wc, eaveY), end: P3(W, wc, eaveY) })
  cutOutline = [P(0, 0), P(W, 0), P(W, wc), P(0, wc)]
  undersideAt = () => eaveY - dropF
  frontUndersideAt = () => eaveY - dropF
  wSide = wc
  wallTopMax = eaveY - dropF
  return finish(Math.min(wc, wc + (dropH - dropF) / tanH), () => eaveY - dropF)

  /** Cheeks from behind the front wall to where they vanish or reach the dormer roof's host line, and the front wall. */
  function finish(wEnd: number, cheekTopAt: (w: number) => number): DormerLayoutResult {
    if (wEnd <= t + 1e-3) return { ok: false, reason: 'the dormer is too shallow on its host for cheeks behind its front wall' }
    if (t >= wSide - 1e-3) return { ok: false, reason: 'the front wall is thicker than the dormer is deep' }
    const baseY = frontY - dropH
    const frontWall = { start, end, baseY, height: wallTopMax - baseY, thickness: t }
    if (frontWall.height <= 1e-3) return { ok: false, reason: 'the dormer front wall has no height' }
    const L = wEnd - t
    const profile = (fn: (w: number) => number, ws: number[]): WallPanelProfilePoint[] => ws.map((w, i) => ({ u: i === 0 ? 0 : Math.abs(w - ws[0]), y: fn(w) }))
    const bottomAt = (w: number): number => hostTopAtW(w) - dropH
    // Left cheek at a = 0 runs downslope (w from wEnd to t) so that its outward normal is −u; the right one runs upslope.
    const leftWs = [wEnd, t]
    const rightWs = [t, wEnd]
    const cheeks: DormerLayout['cheeks'] = [
      { key: 'L', start: P(0, wEnd), end: P(0, t), bottom: fixEnd(profile(bottomAt, leftWs), L), top: fixEnd(profile(cheekTopAt, leftWs), L), thickness: t },
      { key: 'R', start: P(W, t), end: P(W, wEnd), bottom: fixEnd(profile(bottomAt, rightWs), L), top: fixEnd(profile(cheekTopAt, rightWs), L), thickness: t },
    ]
    for (const c of cheeks) {
      for (let i = 0; i < c.top.length; i++) if (c.top[i].y < c.bottom[i].y - EPS) return { ok: false, reason: 'a dormer cheek would stand below the host roof' }
    }
    return { ok: true, layout: { u, d, width: W, front: { start, end }, frontY, cutOutline, planes, edges, frontWall, cheeks, hostDropAtFront: dropH, frontUndersideAt } }
  }
}

/** The last profile point sits exactly at the panel's length (its `u` is computed, and must not drift by a rounding). */
function fixEnd(points: WallPanelProfilePoint[], length: number): WallPanelProfilePoint[] {
  return points.map((p, i) => (i === points.length - 1 ? { u: length, y: p.y } : p))
}
