/**
 * BUILDPLAN N8-03C: the main gable, cut where a wing's roof runs over it.
 *
 * A wing whose gable runs into the main roof along two valleys (`attachedGableLayout`, join VALLEY) lays its two planes
 * over the main slope up to the line where the two top surfaces meet. Between those valleys the main slope is not the
 * roof: it lies wholly under the wing's planes, inside the wing's attic. Built whole it is a second roof standing in
 * the attic — and every wall under it is cut down to it, the wall the two bodies share among them, whatever door the
 * plan draws there. The model's legacy roof takes rectangles only, so the main gable is stated here as its planes (the
 * unit a roof is composed of): two slopes meeting at the ridge, the slope a wing stands on cut back to the wing's
 * valleys, each valley a crease between the main plane and the wing's plane on either side of it.
 *
 * Nothing new is measured. The valleys are the wing's own (the line its planes already stop on); the slopes are the
 * legacy gable's (`topAt = eaveY + (halfSpan − |cross − ridge|) · tan`), so outside the cut every point of the roof is
 * where it was. Where the valleys meet on the main ridge the cut slope falls apart in two pieces, one either side of
 * the apex; where they meet below the ridge it is one plane with a notch.
 *
 * The cut is refused — and the caller keeps the legacy gable — where the plane statement could not hold the legacy
 * roof exactly or the valleys do not sit on it: eaves projecting past the walls, edge members on the gable, a valley
 * that does not start on the main eave or end inside the slope, or two cuts that overlap.
 */
import { round6 } from '@buildapp/source-common'
import type { AttachedGableLayout, AttachedGablePlane, Vec2 } from './attached-roof-form.js'

export type ValleyCutMain = { ridgeAxis: 'X' | 'Z'; ridgeAt: number; eaveY: number; pitchDeg: number; thicknessM: number; footprint: { x0: number; z0: number; x1: number; z1: number }; overhangM: number; hasEdgeMembers: boolean }
export type ValleyCutWing = { massId: string; pitchDeg: number; thicknessM: number; layout: AttachedGableLayout; planeIds: { LOW: string; HIGH: string } }

export type ValleyCutPlane = { id: string; side: 'LOW' | 'HIGH'; boundary: Vec2[]; downslope: Vec2; datum: { x: number; y: number; z: number }; pitchDeg: number; thicknessM: number }

export type ValleyCut = {
  /** The main gable's planes: one per slope, the cut slope one or two. */
  planes: ValleyCutPlane[]
  /** The ridge between each pair of pieces either side of it that share a stretch of it. */
  ridges: Array<{ id: string; low: string; high: string; start: Vec2; end: Vec2 }>
  /** Each valley: the main plane on one side, the wing's plane on the other, along the wing's valley line. */
  valleys: Array<{ id: string; mainPlaneId: string; wingPlaneId: string; massId: string; start: Vec2; end: Vec2 }>
  eaves: Array<{ id: string; planeId: string; start: Vec2; end: Vec2 }>
  verges: Array<{ id: string; planeId: string; start: Vec2; end: Vec2 }>
  /** The plan polygon each wing takes out of the main slope. */
  notches: Array<{ massId: string; polygon: Vec2[] }>
  why: string
}

export type ValleyCutRefusal = { refused: string }

/** A valley starts on the main eave within this of it (m); the wing's party line is matched to the main footprint as closely. */
const ON_EAVE_M = 0.05
/** An apex this close to the main ridge (m) is on it. */
const ON_RIDGE_M = 0.02
/** The two top surfaces meet at a valley's ends within this (m). */
const CREASE_M = 0.01

/** The main gable as planes cut back to the valleys of the wings that run into it, or why it cannot be. */
export function valleyCutMainRoof(main: ValleyCutMain, wings: readonly ValleyCutWing[]): ValleyCut | ValleyCutRefusal {
  const joined = wings.filter((w) => w.layout.join.kind === 'VALLEY')
  if (joined.length === 0) return { refused: 'no wing runs into the main roof along valleys' }
  if (main.overhangM > 1e-9) return { refused: `the main roof's eaves project ${main.overhangM.toFixed(2)} m past the walls, where no valley read stops: the gable is kept whole` }
  if (main.hasEdgeMembers) return { refused: 'the main gable carries edge members its planes would not: the gable is kept whole' }
  const f = main.footprint
  // Local frame: `u` across the ridge, `t` along it.
  const [u0, u1] = main.ridgeAxis === 'Z' ? [f.x0, f.x1] : [f.z0, f.z1]
  const [t0, t1] = main.ridgeAxis === 'Z' ? [f.z0, f.z1] : [f.x0, f.x1]
  const uR = main.ridgeAt
  const L = (p: Vec2): { u: number; t: number } => (main.ridgeAxis === 'Z' ? { u: p.x, t: p.z } : { u: p.z, t: p.x })
  const P = (u: number, t: number): Vec2 => (main.ridgeAxis === 'Z' ? { x: round6(u), z: round6(t) } : { x: round6(t), z: round6(u) })
  const D = (du: number): Vec2 => (main.ridgeAxis === 'Z' ? { x: du, z: 0 } : { x: 0, z: du })
  type Notch = { massId: string; side: 'LOW' | 'HIGH'; lo: Vec2; hi: Vec2; apex: Vec2; tLo: number; tHi: number; tApex: number; onRidge: boolean; keyLo: 'LOW' | 'HIGH'; keyHi: 'LOW' | 'HIGH'; wing: ValleyCutWing }
  const notches: Notch[] = []
  for (const w of joined) {
    const join = w.layout.join as Extract<AttachedGableLayout['join'], { kind: 'VALLEY' }>
    if (join.valleys.length !== 2) return { refused: `the roof over ${w.massId} states ${join.valleys.length} valleys, not two` }
    const [a, b] = join.valleys
    if (Math.abs(a.end.x - b.end.x) > 1e-6 || Math.abs(a.end.z - b.end.z) > 1e-6) return { refused: `the two valleys of the roof over ${w.massId} do not meet` }
    const sa = L(a.start)
    const sb = L(b.start)
    const ap = L(a.end)
    const side: 'LOW' | 'HIGH' = ap.u < uR ? 'LOW' : 'HIGH'
    const uE = side === 'LOW' ? u0 : u1
    // the wing's plane between the two valleys must lie on the slope it is cut from
    if (Math.abs(sa.u - uE) > ON_EAVE_M || Math.abs(sb.u - uE) > ON_EAVE_M) return { refused: `the valleys of the roof over ${w.massId} do not start on the main eave` }
    const onRidge = Math.abs(ap.u - uR) <= ON_RIDGE_M
    if (!onRidge && !(side === 'LOW' ? ap.u > u0 && ap.u < uR : ap.u < u1 && ap.u > uR)) return { refused: `the valleys of the roof over ${w.massId} do not meet on the main slope` }
    // a valley is a crease only where both top surfaces pass through it: at both its ends the wing's plane and the
    // main slope must stand at one height (a wing whose eaves sit a little off the main eaves lays its valley where
    // the two do not meet, and is no valley to cut along)
    const mainTop = (p: Vec2): number => main.eaveY + (side === 'LOW' ? L(p).u - u0 : u1 - L(p).u) * Math.tan((main.pitchDeg * Math.PI) / 180)
    for (const v of [a, b]) {
      const pl = w.layout.planes.find((x) => x.key === v.key) as AttachedGablePlane
      for (const p of [v.start, v.end]) {
        const gap = Math.abs(planeTopAt({ datum: pl.datum, downslope: pl.downslope, pitchDeg: w.pitchDeg }, p.x, p.z) - mainTop(p))
        if (gap > CREASE_M) return { refused: `the roof over ${w.massId} and the main slope stand ${gap.toFixed(2)} m apart at the end of a valley (${p.x.toFixed(2)}, ${p.z.toFixed(2)}): no crease to cut along, the gable is kept whole` }
      }
    }
    const [lo, hi, keyLo, keyHi] = sa.t <= sb.t ? [a.start, b.start, a.key, b.key] : [b.start, a.start, b.key, a.key]
    const tLo = L(lo).t
    const tHi = L(hi).t
    if (tLo < t0 - 1e-6 || tHi > t1 + 1e-6 || !(ap.t > tLo && ap.t < tHi)) return { refused: `the valleys of the roof over ${w.massId} leave the main slope along the ridge` }
    // the cut's corners as the wing states them (so the shared edges match vertex for vertex), the eave ones snapped onto the eave line
    notches.push({ massId: w.massId, side, lo: P(uE, tLo), hi: P(uE, tHi), apex: onRidge ? P(uR, ap.t) : a.end, tLo, tHi, tApex: ap.t, onRidge, keyLo, keyHi, wing: w })
  }
  const planes: ValleyCutPlane[] = []
  const eaves: ValleyCut['eaves'] = []
  const verges: ValleyCut['verges'] = []
  const valleys: ValleyCut['valleys'] = []
  const pieceSpans = new Map<string, [number, number]>()
  for (const side of ['LOW', 'HIGH'] as const) {
    const uE = side === 'LOW' ? u0 : u1
    const here = notches.filter((n) => n.side === side).sort((x, y) => x.tLo - y.tLo)
    for (let i = 1; i < here.length; i++) if (here[i].tLo < here[i - 1].tHi - 1e-6) return { refused: `the cuts of the roofs over ${here[i - 1].massId} and ${here[i].massId} overlap on the main slope` }
    const base = side === 'LOW' ? 'roof-main-plane-low' : 'roof-main-plane-high'
    // the eave chain from one gable end to the other, the notches let into it; a notch whose apex is on the ridge splits it
    type Node = { p: Vec2; t: number; ridge: boolean; notch?: Notch; role?: 'lo' | 'apex' | 'hi' }
    const chain: Node[] = [{ p: P(uE, t0), t: t0, ridge: false }]
    for (const n of here) {
      if (n.tLo > chain[chain.length - 1].t + 1e-6) chain.push({ p: n.lo, t: n.tLo, ridge: false, notch: n, role: 'lo' })
      else chain[chain.length - 1] = { ...chain[chain.length - 1], notch: n, role: 'lo' }
      chain.push({ p: n.apex, t: n.tApex, ridge: n.onRidge, notch: n, role: 'apex' })
      chain.push({ p: n.hi, t: n.tHi, ridge: false, notch: n, role: 'hi' })
    }
    if (t1 > chain[chain.length - 1].t + 1e-6) chain.push({ p: P(uE, t1), t: t1, ridge: false })
    const splits = [0, ...chain.flatMap((c, i) => (c.ridge ? [i] : [])), chain.length - 1]
    const count = splits.length - 1
    for (let k = 0; k < count; k++) {
      const a = splits[k]
      const b = splits[k + 1]
      const part = chain.slice(a, b + 1)
      const id = count === 1 ? base : `${base}-${k}`
      const first = part[0]
      const last = part[part.length - 1]
      // back along the ridge: a node on the ridge is its own ridge point
      const back = [...(last.ridge ? [] : [P(uR, last.t)]), ...(first.ridge ? [] : [P(uR, first.t)])]
      planes.push({ id, side, boundary: [...part.map((n) => n.p), ...back], downslope: D(side === 'LOW' ? -1 : 1), datum: { ...P(uE, t0), y: round6(main.eaveY) } as { x: number; y: number; z: number }, pitchDeg: main.pitchDeg, thicknessM: main.thicknessM })
      pieceSpans.set(id, [first.t, last.t])
      for (let i = 0; i + 1 < part.length; i++) {
        const p = part[i]
        const q = part[i + 1]
        if (p.role !== 'apex' && q.role !== 'apex') eaves.push({ id: `${id}-eave-${eaves.filter((e) => e.planeId === id).length}`, planeId: id, start: p.p, end: q.p })
        else if (p.role === 'lo' && q.role === 'apex' && p.notch) valleys.push({ id: `roof-main-valley-${p.notch.massId}-${p.notch.keyLo.toLowerCase()}`, mainPlaneId: id, wingPlaneId: p.notch.wing.planeIds[p.notch.keyLo], massId: p.notch.massId, start: p.p, end: q.p })
        else if (p.role === 'apex' && q.role === 'hi' && q.notch) valleys.push({ id: `roof-main-valley-${q.notch.massId}-${q.notch.keyHi.toLowerCase()}`, mainPlaneId: id, wingPlaneId: q.notch.wing.planeIds[q.notch.keyHi], massId: q.notch.massId, start: p.p, end: q.p })
      }
      if (Math.abs(first.t - t0) <= 1e-6) verges.push({ id: `${id}-verge-min`, planeId: id, start: first.p, end: P(uR, t0) })
      if (Math.abs(last.t - t1) <= 1e-6) verges.push({ id: `${id}-verge-max`, planeId: id, start: P(uR, t1), end: last.p })
    }
  }
  const ridges: ValleyCut['ridges'] = []
  for (const lo of planes.filter((p) => p.side === 'LOW')) {
    for (const hi of planes.filter((p) => p.side === 'HIGH')) {
      const [a0, a1] = pieceSpans.get(lo.id) as [number, number]
      const [b0, b1] = pieceSpans.get(hi.id) as [number, number]
      const s0 = Math.max(a0, b0)
      const s1 = Math.min(a1, b1)
      if (s1 - s0 > 1e-6) ridges.push({ id: `roof-main-ridge${ridges.length === 0 ? '' : `-${ridges.length}`}`, low: lo.id, high: hi.id, start: P(uR, s0), end: P(uR, s1) })
    }
  }
  const why = notches
    .map((n) => `the roof over ${n.massId} runs over the main ${n.side === 'LOW' ? 'low' : 'high'} slope from the eave at ${(main.ridgeAxis === 'Z' ? 'z' : 'x')} ${n.tLo.toFixed(2)}..${n.tHi.toFixed(2)} to its valleys' apex ${n.onRidge ? 'on the main ridge' : `${Math.abs(L(n.apex).u - (n.side === 'LOW' ? u0 : u1)).toFixed(2)} m up the slope`}: that part of the slope lies under it and is not built`)
    .join('; ')
  return { planes, ridges, valleys, eaves, verges, notches: notches.map((n) => ({ massId: n.massId, polygon: [n.lo, n.apex, n.hi] })), why }
}

export const isValleyCut = (c: ValleyCut | ValleyCutRefusal): c is ValleyCut => !('refused' in c)

/** A plane's top surface at a plan point: `datum.y − tan(pitch) · ((p − datum) · downslope)`. */
export function planeTopAt(p: { datum: { x: number; y: number; z: number }; downslope: Vec2; pitchDeg: number }, x: number, z: number): number {
  return p.datum.y - Math.tan((p.pitchDeg * Math.PI) / 180) * ((x - p.datum.x) * p.downslope.x + (z - p.datum.z) * p.downslope.z)
}

const insideOrOn = (q: Vec2, poly: readonly Vec2[]): boolean => {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    // on an edge
    const cross = (b.x - a.x) * (q.z - a.z) - (b.z - a.z) * (q.x - a.x)
    if (Math.abs(cross) <= 1e-9 && q.x >= Math.min(a.x, b.x) - 1e-9 && q.x <= Math.max(a.x, b.x) + 1e-9 && q.z >= Math.min(a.z, b.z) - 1e-9 && q.z <= Math.max(a.z, b.z) + 1e-9) return true
    if (a.z > q.z !== b.z > q.z && q.x < ((b.x - a.x) * (q.z - a.z)) / (b.z - a.z) + a.x) inside = !inside
  }
  return inside
}
const strictlyInside = (q: Vec2, poly: readonly Vec2[]): boolean => {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    const cross = (b.x - a.x) * (q.z - a.z) - (b.z - a.z) * (q.x - a.x)
    if (Math.abs(cross) <= 1e-9 && q.x >= Math.min(a.x, b.x) - 1e-9 && q.x <= Math.max(a.x, b.x) + 1e-9 && q.z >= Math.min(a.z, b.z) - 1e-9 && q.z <= Math.max(a.z, b.z) + 1e-9) return false
    if (a.z > q.z !== b.z > q.z && q.x < ((b.x - a.x) * (q.z - a.z)) / (b.z - a.z) + a.x) inside = !inside
  }
  return inside
}

/** Does the plan segment a→b pass through the inside of a wing's cut (not merely along its edge)? */
export function segmentCrossesNotch(a: Vec2, b: Vec2, cut: ValleyCut, samples = 24): boolean {
  for (let i = 0; i <= samples; i++) {
    const q = { x: a.x + ((b.x - a.x) * i) / samples, z: a.z + ((b.z - a.z) * i) / samples }
    if (cut.notches.some((n) => strictlyInside(q, n.polygon))) return true
  }
  return false
}

/**
 * The underside of the roof as it will be built over a plan point, from the main planes of the cut and the wings'
 * planes: the lowest underside of every plane that covers the point (as the compiler caps a wall under planes), or
 * undefined where none does.
 */
export function builtRoofUndersideAt(cut: ValleyCut, wings: readonly ValleyCutWing[], x: number, z: number): number | undefined {
  const q = { x, z }
  const under: number[] = []
  for (const p of cut.planes) if (insideOrOn(q, p.boundary)) under.push(planeTopAt(p, x, z) - p.thicknessM / Math.cos((p.pitchDeg * Math.PI) / 180))
  for (const w of wings) {
    if (w.layout.join.kind !== 'VALLEY') continue
    for (const pl of w.layout.planes as readonly AttachedGablePlane[]) if (insideOrOn(q, pl.boundary)) under.push(planeTopAt({ datum: pl.datum, downslope: pl.downslope, pitchDeg: w.pitchDeg }, x, z) - w.thicknessM / Math.cos((w.pitchDeg * Math.PI) / 180))
  }
  return under.length === 0 ? undefined : Math.min(...under)
}

/**
 * The cut for a building's main gable and the pitched roofs attached to it that run into it (`joinRoofId` unset: the
 * main roof is `roof-main`), or the refusal; undefined where there is no main gable. One function for the solver (which
 * asks it before it cuts a door under the roof) and the emitter (which builds it), so the two cannot disagree.
 */
export function mainRoofValleyCut(
  mainRoof: { ridgeAxis: 'X' | 'Z'; ridgeAt: number; eaveY: number; pitchDeg: number; thicknessM: number; footprint: { x0: number; z0: number; x1: number; z1: number }; eaves?: { overhangM: number } } | undefined,
  pitched: ReadonlyArray<{ massId: string; pitchDeg: number; thicknessM: number; layout: AttachedGableLayout; joinRoofId?: string }>,
  vergeCount: number,
  planeIdsOf: (massId: string) => [string, string],
): ValleyCut | ValleyCutRefusal | undefined {
  if (!mainRoof) return undefined
  const wings = valleyCutWings(pitched, planeIdsOf)
  return valleyCutMainRoof({ ridgeAxis: mainRoof.ridgeAxis, ridgeAt: mainRoof.ridgeAt, eaveY: mainRoof.eaveY, pitchDeg: mainRoof.pitchDeg, thicknessM: mainRoof.thicknessM, footprint: mainRoof.footprint, overhangM: mainRoof.eaves?.overhangM ?? 0, hasEdgeMembers: vergeCount > 0 }, wings)
}

/** The wings of `mainRoofValleyCut`, for `builtRoofUndersideAt`. */
export function valleyCutWings(pitched: ReadonlyArray<{ massId: string; pitchDeg: number; thicknessM: number; layout: AttachedGableLayout; joinRoofId?: string }>, planeIdsOf: (massId: string) => [string, string]): ValleyCutWing[] {
  return pitched.filter((r) => !r.joinRoofId).map((r) => {
    const [low, high] = planeIdsOf(r.massId)
    return { massId: r.massId, pitchDeg: r.pitchDeg, thicknessM: r.thicknessM, layout: r.layout, planeIds: { LOW: low, HIGH: high } }
  })
}
