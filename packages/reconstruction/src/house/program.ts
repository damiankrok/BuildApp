/**
 * v3.54.4 — the deterministic builder of a house document: `geometry` (metres, model frame) → building commands.
 *
 * The same commands the drawings' path and the hand-written reference write, run by the same kernel and compiled by the
 * same compiler. What the solver's intermediate (`BuildingV2`) cannot hold — a body that is not a rectangle, a wall
 * dormer whose front IS the facade — is written here directly in the kernel's own terms, which already take polygons:
 *   - one exterior wall ring per level from that level's outline polygon; edge i is host wall `wall-<level>-<i>`;
 *   - a body's roof as planes over its own (offset) outline: gable, hip, shed or flat; a wall under a roof dies into the
 *     planes over it, so gable ends, knee walls and stepped eaves come from the planes, not from extra rules;
 *   - a wall between two bodies where the taller one's wall stands above the lower one's roof;
 *   - a WALL dormer as what it is: the host plane notched where the dormer's own two planes stand, the facade wall
 *     under it rising into them — one wall, no second wall behind the facade; a ROOF dormer by the kernel's `createDormer`;
 *   - openings cut in their host wall at an offset from its start; balconies, canopies on posts, chimneys.
 * Nothing here reads a picture, knows a publisher or a house, or moves a mesh. Every parameter consumed is recorded with
 * the commands it became (`trace`); what cannot be built is refused by name and the rest is still built.
 */
import type { BuildingCommand } from '@buildapp/commands'
import { MATERIALS_V2 } from '../v2/emit.js'
import type { HouseBody, HouseDocument, HouseGeometry, HouseParameterRecord, Num } from './document.js'
import { TRACE_CODES } from './document.js'
import { bbox, canonical, clipConvex, clipHalfPlane, contains, edgeOf, isSimple, offset, onBoundary, pt, sharedStretches, signedArea } from './poly.js'
import type { P2 } from './poly.js'

export const HOUSE_BUILDER_NAME = 'reconstruction.house-builder' as const
export const HOUSE_BUILDER_VERSION = '0.1.0' as const
export const HOUSE_BUILDER_LABEL = 'MODEL Z UZGODNIONEGO OPISU ŹRÓDEŁ'

type Code = (typeof TRACE_CODES)[number]
export type HouseRefusal = { path: string; code: Code; why: string }
/** How an opening was agreed, for a second fit when the kernel knows its wall's clear stretch better: host coordinates. */
export type OpeningFitInfo = { u: number; printed: boolean; s0: number; from: number; width: number }
export type HouseProgram = { fits: Record<string, OpeningFitInfo>; program: BuildingCommand[]; trace: HouseParameterRecord[]; refusals: HouseRefusal[]; /** Openings cut with a larger change than their reading's uncertainty: drawn, and said. */ approximated: Array<{ id: string; what: string }>; planes: Array<{ id: string; bodyId: string; key: string }>; hostWalls: Array<{ id: string; level: number; bodyId: string; lengthM: number; a: P2; b: P2 }> }

const r6 = (v: number): number => Math.round(v * 1e6) / 1e6
const rad = (deg: number): number => (deg * Math.PI) / 180
const ROOF_RECTANGLE_FILL = 0.8
const ROOF_T = 0.25
/** How far a wall under a roof is drawn past the ridge before the planes cut it (m): any positive value gives the same wall. */
const OVER_RIDGE_M = 0.5
/**
 * How an opening is fitted to the wall that holds it (v3.54.5). `adjustFloorM`: the least a reading from a published
 * raster can be off; an opening's own stated uncertainty replaces it when larger, up to `maxUncertaintyM` (the residual
 * an elevation may have and still register). `approxShare` / `approxM`: the most a width may be trimmed and still be
 * drawn, as an approximation that is said. `pierM`: the wall left between two openings.
 */
/** The wall thickness drawn for a bay (see `thick`). */
export const BAY_WALL_M = 0.25
/**
 * One opening against the clear stretch lo..hi of its wall (v3.54.5). The edge that is not in conflict is never moved to
 * make room. A move or a trim within the reading's own uncertainty `u` is ADJUSTED; a larger trim, up to a bounded share,
 * is APPROXIMATED and said; beyond that the opening is not cut. A printed width is never trimmed.
 */
export function fitOpening(q: { from: number; to: number; lo: number; hi: number; u: number; printed: boolean }): { ok: true; from: number; to: number; fit: 'EXACT' | 'ADJUSTED' | 'APPROXIMATED'; note?: string } | { ok: false; why: string } {
  const stated = q.to - q.from
  const overLo = Math.max(0, q.lo - q.from)
  const overHi = Math.max(0, q.to - q.hi)
  const room = q.hi - q.lo
  if (overLo <= 1e-6 && overHi <= 1e-6) return { ok: true, from: q.from, to: q.to, fit: 'EXACT' }
  const over = overLo + overHi
  const canShift = stated <= room + 1e-6 && !(overLo > 1e-6 && overHi > 1e-6)
  if (canShift && over <= q.u + 1e-6) {
    // within what the reading can tell: the whole opening moves, its width stands
    const from = overLo > 0 ? q.lo : q.hi - stated
    return { ok: true, from, to: from + stated, fit: 'ADJUSTED', note: `moved ${over.toFixed(2)} m along the wall to stand clear of its corner (the reading is good to ±${q.u.toFixed(2)} m)` }
  }
  if (q.printed) {
    if (!canShift) return { ok: false, why: `a printed width of ${stated.toFixed(2)} m in a wall whose clear length is ${room.toFixed(2)} m: a printed width is not trimmed` }
    const from = overLo > 0 ? q.lo : q.hi - stated
    return { ok: true, from, to: from + stated, fit: 'APPROXIMATED', note: `moved ${over.toFixed(2)} m along the wall, more than the reading's ±${q.u.toFixed(2)} m: its printed width stands, its place is approximate` }
  }
  // the edge in the corner is trimmed; the other edge stays where it was read
  const trimmed = Math.min(q.to, q.hi) - Math.max(q.from, q.lo)
  const cut = stated - trimmed
  if (trimmed < OPENING_FIT.minWidthM || (cut > q.u + 1e-6 && (cut > OPENING_FIT.approxShare * stated + 1e-6 || cut > OPENING_FIT.approxM + 1e-6)))
    return { ok: false, why: `${stated.toFixed(2)} m wide at ${q.from.toFixed(2)} m on a wall whose clear stretch is ${q.lo.toFixed(2)}..${q.hi.toFixed(2)} m: it would lose ${cut.toFixed(2)} m, more than the reading's ±${q.u.toFixed(2)} m and more than ${Math.round(OPENING_FIT.approxShare * 100)} % of it — the wall, the side or the place was read wrong, and the opening is not cut narrower to hide that` }
  const fit = cut <= q.u + 1e-6 ? ('ADJUSTED' as const) : ('APPROXIMATED' as const)
  return { ok: true, from: Math.max(q.from, q.lo), to: Math.min(q.to, q.hi), fit, note: `${stated.toFixed(2)} m wide as read; trimmed by ${cut.toFixed(2)} m at the corner of its wall${fit === 'ADJUSTED' ? ` (within the reading's ±${q.u.toFixed(2)} m)` : `: more than the reading's ±${q.u.toFixed(2)} m — an approximate opening`}` }
}
export const OPENING_FIT = { cornerClearM: 0.02, adjustFloorM: 0.1, maxUncertaintyM: 0.45, approxShare: 0.25, approxM: 0.6, pierM: 0.1, minWidthM: 0.3 } as const

type Plane = { id: string; bodyId: string; key: string; boundary: P2[]; datum: { x: number; y: number; z: number }; pitchDeg: number; downslope: P2; thickness: number; levelId: string }
const topAt = (p: Plane, q: P2): number => p.datum.y - ((q.x - p.datum.x) * p.downslope.x + (q.z - p.datum.z) * p.downslope.z) * Math.tan(rad(p.pitchDeg))

export function houseProgram(doc: HouseDocument): HouseProgram {
  const g = doc.geometry
  const program: BuildingCommand[] = []
  const trace: HouseParameterRecord[] = []
  const refusals: HouseRefusal[] = []
  const planesOut: HouseProgram['planes'] = []
  const hostWalls: HouseProgram['hostWalls'] = []
  const approximated: HouseProgram['approximated'] = []
  const fits: HouseProgram['fits'] = {}
  if (!g) return { program, trace, refusals: [{ path: 'geometry', code: 'NOT_CONSUMED', why: 'the document holds observations only: no agreed geometry to build' }], planes: planesOut, hostWalls, approximated, fits }
  const push = (c: Record<string, unknown>): void => void program.push(c as unknown as BuildingCommand)
  const used = (path: string, consumer: string, programIds: string[], n?: Num): void => void trace.push({ path, state: 'ACCEPTED', consumer, programIds, meshIds: [], ...(n && n.value !== null ? { built: n.value } : {}) })
  const refuse = (path: string, code: Code, why: string): void => {
    refusals.push({ path, code, why })
    trace.push({ path, state: 'REJECTED', code, why, programIds: [], meshIds: [] })
  }
  /** A number the builder needs: UNKNOWN stops the object that needs it, by name — it is never read as zero. */
  const need = (n: Num | undefined, path: string): number | undefined => {
    if (!n || n.value === null) {
      refuse(path, 'SOURCE_UNKNOWN', 'the value is UNKNOWN: what depends on it is not built')
      return undefined
    }
    return n.value
  }

  push({ type: 'setModelName', name: HOUSE_BUILDER_LABEL })
  push({ type: 'createBuilding', id: 'bld-house', name: HOUSE_BUILDER_LABEL })
  push({ type: 'defineMaterial', id: MATERIALS_V2.wall, name: 'Rendered wall', color: '#e8e4dc' })
  push({ type: 'defineMaterial', id: MATERIALS_V2.slab, name: 'Concrete slab', color: '#c9c6c0' })
  push({ type: 'defineMaterial', id: MATERIALS_V2.roof, name: 'Roof covering', color: '#5a5550' })
  push({ type: 'defineMaterial', id: MATERIALS_V2.member, name: 'Facade member', color: '#ece9e2' })
  push({ type: 'defineMaterial', id: MATERIALS_V2.glass, name: 'Glazing', color: '#9fc3d8', opacity: 0.35 })
  push({ type: 'defineMaterial', id: MATERIALS_V2.timber, name: 'Timber', color: '#b07a4a' })
  push({ type: 'defineMaterial', id: MATERIALS_V2.chimney, name: 'Chimney', color: '#6d6a66' })
  push({ type: 'defineMaterial', id: MATERIALS_V2.terrace, name: 'Paving', color: '#a49c92' })
  push({ type: 'defineMaterial', id: MATERIALS_V2.gate, name: 'Garage door', color: '#55585c' })

  const T = need(g.wallThicknessM, 'geometry.wallThicknessM') ?? 0.4
  // v3.54.5 — the walls of a bay are the posts between its windows: at the house's (conventional) wall thickness a bay's
  // side 1.3 m long has 0.5 m of clear wall and the 0.8 m window read in it cannot be cut. A convention, said in the trace.
  const thick = (role: string): number => (role === 'BAY' ? Math.min(T, BAY_WALL_M) : T)
  const slabT = need(g.slabThicknessM, 'geometry.slabThicknessM') ?? 0.3

  // --- levels ---
  const levels = [...g.levels].sort((a, b) => a.index - b.index)
  const levelAt = new Map<number, { id: string; elevation: number; height: number }>()
  for (const l of levels) {
    const elevation = need(l.elevation, `geometry.levels[${l.id}].elevation`)
    const height = need(l.height, `geometry.levels[${l.id}].height`)
    if (elevation === undefined || height === undefined) continue
    push({ type: 'createLevel', id: l.id, name: l.index === 0 ? 'Ground' : `Level ${l.index}`, index: l.index, elevation: r6(elevation), height: r6(height) })
    levelAt.set(l.index, { id: l.id, elevation, height })
    used(`geometry.levels[${l.id}].elevation`, 'houseProgram/createLevel', [l.id], l.elevation)
    used(`geometry.levels[${l.id}].height`, 'houseProgram/createLevel', [l.id], l.height)
  }
  const outlineAt = new Map<number, P2[]>()
  for (const o of g.outlines) {
    if (!isSimple(o.polygon) || signedArea(o.polygon) <= 0) {
      refuse(`geometry.outlines[${o.level}]`, 'PARSE_REJECTED', 'the outline is not a simple counter-clockwise polygon: the level is not built')
      continue
    }
    outlineAt.set(o.level, o.polygon.map((p) => pt(p.x, p.z)))
  }

  // --- bodies: their roofs as planes -------------------------------------------------------------------------------
  const bodies = g.bodies.map((b) => ({ ...b, poly: b.outline.map((p) => pt(p.x, p.z)), top: Math.max(...b.storeys) }))
  const ridgeOf = new Map<string, number>()
  for (const b of bodies) if (b.roof.ridgeY.value !== null) ridgeOf.set(b.id, b.roof.ridgeY.value)
  const planes: Plane[] = []
  const planesOf = new Map<string, Plane[]>()
  for (const b of bodies) {
    const path = `geometry.bodies[${b.id}]`
    if (!isSimple(b.poly) || signedArea(b.poly) <= 0) {
      refuse(`${path}.outline`, 'PARSE_REJECTED', 'the body outline is not a simple counter-clockwise polygon')
      continue
    }
    const l = levelAt.get(b.top)
    const ridgeY = need(b.roof.ridgeY, `${path}.roof.ridgeY`)
    const pitch = need(b.roof.pitchDeg, `${path}.roof.pitchDeg`)
    const overhang = need(b.roof.overhangM, `${path}.roof.overhangM`)
    if (!l || ridgeY === undefined || pitch === undefined || overhang === undefined) continue
    const thickness = b.roof.thicknessM?.value ?? ROOF_T
    // an edge that lies along a body at least as tall gets no overhang: the roof stops at that wall
    // A pitched roof covers the body's rectangle when the outline only steps a little inside it: a recess under the eaves
    // (an entrance, a corner terrace) is roofed, as the elevations draw it. An outline that leaves much of its rectangle
    // empty (an L, a U) keeps its own shape.
    const box = bbox(b.poly)
    const fills = Math.abs(signedArea(b.poly)) / Math.max(1e-9, (box.x1 - box.x0) * (box.z1 - box.z0))
    const roofPoly = b.roof.kind !== 'FLAT' && fills >= ROOF_RECTANGLE_FILL && fills < 1 - 1e-6 ? [pt(box.x0, box.z0), pt(box.x1, box.z0), pt(box.x1, box.z1), pt(box.x0, box.z1)] : b.poly
    const dist = roofPoly.map((_, i) => {
      const e = edgeOf(roofPoly, i)
      const mine = ridgeOf.get(b.id) ?? 0
      const along = bodies.filter((o) => o.id !== b.id && (ridgeOf.get(o.id) ?? 0) >= mine - 1e-6).reduce((s, o) => s + sharedStretches(e.a, e.b, o.poly).reduce((q, [lo, hi]) => q + hi - lo, 0), 0)
      return along > e.len * 0.5 ? 0 : overhang
    })
    const O = offset(roofPoly, dist)
    const bb = bbox(b.poly)
    const mid = { x: (bb.x0 + bb.x1) / 2, z: (bb.z0 + bb.z1) / 2 }
    const made: Plane[] = []
    const add = (key: string, boundary: P2[], datum: Plane['datum'], pitchDeg: number, downslope: P2): void => {
      const poly = signedArea(boundary) < 0 ? [...boundary].reverse() : boundary
      if (poly.length < 3 || Math.abs(signedArea(poly)) < 0.01) return
      made.push({ id: `roof-${b.id}-${key}`, bodyId: b.id, key, boundary: poly, datum: { x: r6(datum.x), y: r6(datum.y), z: r6(datum.z) }, pitchDeg: r6(pitchDeg), downslope, thickness, levelId: l.id })
    }
    if (b.roof.kind === 'FLAT') add('flat', O, { x: mid.x, y: ridgeY, z: mid.z }, 0, { x: 0, z: -1 })
    else if (b.roof.kind === 'SHED') {
      const side = b.roof.highSide ?? 'REAR'
      const down: P2 = side === 'FRONT' ? { x: 0, z: 1 } : side === 'REAR' ? { x: 0, z: -1 } : side === 'LEFT' ? { x: 1, z: 0 } : { x: -1, z: 0 }
      const at: P2 = side === 'FRONT' ? { x: mid.x, z: bb.z0 } : side === 'REAR' ? { x: mid.x, z: bb.z1 } : side === 'LEFT' ? { x: bb.x0, z: mid.z } : { x: bb.x1, z: mid.z }
      add('shed', O, { x: at.x, y: ridgeY, z: at.z }, pitch, down)
    } else {
      let axis = b.roof.ridgeAxis ?? (bb.x1 - bb.x0 >= bb.z1 - bb.z0 ? 'X' : 'Z')
      if (b.roof.kind === 'GABLE') {
        const at = b.roof.ridgeAt?.value ?? (axis === 'X' ? mid.z : mid.x)
        if (axis === 'X') {
          add('low', clipHalfPlane(O, { x: 0, z: at }, { x: 0, z: -1 }), { x: mid.x, y: ridgeY, z: at }, pitch, { x: 0, z: -1 })
          add('high', clipHalfPlane(O, { x: 0, z: at }, { x: 0, z: 1 }), { x: mid.x, y: ridgeY, z: at }, pitch, { x: 0, z: 1 })
        } else {
          add('low', clipHalfPlane(O, { x: at, z: 0 }, { x: -1, z: 0 }), { x: at, y: ridgeY, z: mid.z }, pitch, { x: -1, z: 0 })
          add('high', clipHalfPlane(O, { x: at, z: 0 }, { x: 1, z: 0 }), { x: at, y: ridgeY, z: mid.z }, pitch, { x: 1, z: 0 })
        }
        if (b.roof.ridgeAt) used(`${path}.roof.ridgeAt`, 'houseProgram/roofPlanes', made.map((p) => p.id), b.roof.ridgeAt)
      } else {
        // HIP: the ridge along the longer side, four planes of one pitch; the regions are cut from the body's own outline
        const ob = bbox(O)
        if (ob.x1 - ob.x0 < ob.z1 - ob.z0) axis = 'Z'
        else if (ob.x1 - ob.x0 > ob.z1 - ob.z0) axis = 'X'
        if (axis === 'X') {
          const h = (ob.z1 - ob.z0) / 2
          const zr = (ob.z0 + ob.z1) / 2
          const a = { x: ob.x0 + h, z: zr }
          const c = { x: ob.x1 - h, z: zr }
          add('low', clipConvex(O, [pt(ob.x0, ob.z0), pt(ob.x1, ob.z0), c, a]), { x: mid.x, y: ridgeY, z: zr }, pitch, { x: 0, z: -1 })
          add('high', clipConvex(O, [a, c, pt(ob.x1, ob.z1), pt(ob.x0, ob.z1)]), { x: mid.x, y: ridgeY, z: zr }, pitch, { x: 0, z: 1 })
          add('end-min', clipConvex(O, [pt(ob.x0, ob.z0), a, pt(ob.x0, ob.z1)]), { x: a.x, y: ridgeY, z: zr }, pitch, { x: -1, z: 0 })
          add('end-max', clipConvex(O, [pt(ob.x1, ob.z0), pt(ob.x1, ob.z1), c]), { x: c.x, y: ridgeY, z: zr }, pitch, { x: 1, z: 0 })
        } else {
          const h = (ob.x1 - ob.x0) / 2
          const xr = (ob.x0 + ob.x1) / 2
          const a = { x: xr, z: ob.z0 + h }
          const c = { x: xr, z: ob.z1 - h }
          add('low', clipConvex(O, [pt(ob.x0, ob.z0), a, c, pt(ob.x0, ob.z1)]), { x: xr, y: ridgeY, z: mid.z }, pitch, { x: -1, z: 0 })
          add('high', clipConvex(O, [pt(ob.x1, ob.z0), pt(ob.x1, ob.z1), c, a]), { x: xr, y: ridgeY, z: mid.z }, pitch, { x: 1, z: 0 })
          add('end-min', clipConvex(O, [pt(ob.x0, ob.z0), pt(ob.x1, ob.z0), a]), { x: xr, y: ridgeY, z: a.z }, pitch, { x: 0, z: -1 })
          add('end-max', clipConvex(O, [c, pt(ob.x1, ob.z1), pt(ob.x0, ob.z1)]), { x: xr, y: ridgeY, z: c.z }, pitch, { x: 0, z: 1 })
        }
      }
    }
    planesOf.set(b.id, made)
    planes.push(...made)
    const ids = made.map((p) => p.id)
    used(`${path}.outline`, 'houseProgram/roofPlanes+ring', ids)
    used(`${path}.roof.kind`, 'houseProgram/roofPlanes', ids)
    used(`${path}.roof.ridgeY`, 'houseProgram/roofPlanes', ids, b.roof.ridgeY)
    used(`${path}.roof.pitchDeg`, 'houseProgram/roofPlanes', ids, b.roof.pitchDeg)
    used(`${path}.roof.overhangM`, 'houseProgram/roofPlanes', ids, b.roof.overhangM)
  }

  // --- the walls each body builds: the taller body first, whole; a lower one only where no taller one already stands ---
  type Body = (typeof bodies)[number]
  type Phys = { id: string; body: Body; a: P2; b: P2; len: number; u: P2; out: P2; edge: number; atStartVertex: boolean; atEndVertex: boolean }
  const phys: Phys[] = []
  const ringed = new Set<string>()
  const order = [...bodies].filter((b) => planesOf.has(b.id)).sort((p, q) => (ridgeOf.get(q.id) ?? 0) - (ridgeOf.get(p.id) ?? 0) || (p.role === 'MAIN' ? -1 : q.role === 'MAIN' ? 1 : Math.abs(signedArea(q.poly)) - Math.abs(signedArea(p.poly))))
  order.forEach((b, k) => {
    const earlier = order.slice(0, k)
    let whole = true
    const mine: Phys[] = []
    for (let i = 0; i < b.poly.length; i += 1) {
      const e = edgeOf(b.poly, i)
      const shared = earlier.flatMap((o) => sharedStretches(e.a, e.b, o.poly)).sort((p, q) => p[0] - q[0])
      const built: Array<[number, number]> = []
      let at = 0
      for (const [lo, hi] of shared) {
        if (lo - at > 0.05) built.push([at, lo])
        at = Math.max(at, hi)
      }
      if (e.len - at > 0.05) built.push([at, e.len])
      if (!(built.length === 1 && built[0][0] < 1e-6 && built[0][1] > e.len - 1e-6)) whole = false
      built.forEach(([lo, hi], n) => {
        mine.push({ id: built.length === 1 ? `w-${b.id}-${i}` : `w-${b.id}-${i}-${n}`, body: b, a: pt(e.a.x + e.u.x * lo, e.a.z + e.u.z * lo), b: pt(e.a.x + e.u.x * hi, e.a.z + e.u.z * hi), len: hi - lo, u: e.u, out: e.out, edge: i, atStartVertex: lo < 1e-6, atEndVertex: hi > e.len - 1e-6 })
      })
    }
    if (whole) ringed.add(b.id)
    phys.push(...mine)
  })
  // a host wall of the document (an edge of a level's outline) is a stretch of one built wall
  type Host = { id: string; level: number; index: number; body: Body; a: P2; b: P2; len: number; u: P2; out: P2; phys: Phys; shift: number }
  const hosts: Host[] = []
  for (const [level, poly] of [...outlineAt.entries()].sort((p, q) => p[0] - q[0])) {
    poly.forEach((_, i) => {
      const e = edgeOf(poly, i)
      const m = { x: (e.a.x + e.b.x) / 2, z: (e.a.z + e.b.z) / 2 }
      const w = phys.find((x) => x.body.storeys.includes(level) && x.u.x * e.u.x + x.u.z * e.u.z > 0.99 && sharedStretches(x.a, x.b, [e.a, e.b]).length > 0 && Math.abs((m.x - x.a.x) * x.out.x + (m.z - x.a.z) * x.out.z) < 0.03 && (m.x - x.a.x) * x.u.x + (m.z - x.a.z) * x.u.z > -0.03 && (m.x - x.a.x) * x.u.x + (m.z - x.a.z) * x.u.z < x.len + 0.03)
      if (!w) return void refuse(`geometry.outlines[${level}].polygon[${i}]`, 'WRONG_BINDING', 'this edge of the outline lies on no wall of a body that has a storey here')
      hosts.push({ id: `wall-${level}-${i}`, level, index: i, body: w.body, a: e.a, b: e.b, len: e.len, u: e.u, out: e.out, phys: w, shift: (e.a.x - w.a.x) * w.u.x + (e.a.z - w.a.z) * w.u.z })
    })
  }
  // one edge of the outline may run along the walls of two bodies in line; what is cut is the wall under the opening
  const wallUnder = (h: Host, from: number, to: number): { w: Phys; s0: number; s1: number } | undefined => {
    // the wall that holds most of the stretch (v3.54.5: not the one under its middle — a reading a few centimetres off
    // at a step of the outline has its middle on the short return wall and nearly all of itself on the wall beside it)
    let best: { w: Phys; s0: number; s1: number; share: number } | undefined
    for (const w of phys) {
      if (!w.body.storeys.includes(h.level) || w.u.x * h.u.x + w.u.z * h.u.z < 0.99) continue
      if (Math.abs((w.a.x - h.a.x) * h.out.x + (w.a.z - h.a.z) * h.out.z) > 0.03) continue
      const s0 = (w.a.x - h.a.x) * h.u.x + (w.a.z - h.a.z) * h.u.z
      const share = Math.min(to, s0 + w.len) - Math.max(from, s0)
      if (share > 1e-6 && (!best || share > best.share + 1e-9)) best = { w, s0, s1: s0 + w.len, share }
    }
    return best
  }
  for (const h of hosts) hostWalls.push({ id: h.id, level: h.level, bodyId: h.body.id, lengthM: r6(h.len), a: h.a, b: h.b })

  // --- dormers: a wall dormer notches its host plane and brings two planes of its own --------------------------------
  const dormerPlanes = new Map<string, string[]>()
  const cheeks: Array<Record<string, unknown>> = []
  const roofDormers: Array<Record<string, unknown>> = []
  for (const d of g.dormers) {
    const path = `geometry.dormers[${d.id}]`
    const h = hosts.find((x) => x.id === d.hostWall)
    const body = bodies.find((b) => b.id === d.bodyId)
    if (!h || !body) {
      refuse(path, 'WRONG_BINDING', 'its host wall or its body is not part of the built outline')
      continue
    }
    if (h.level !== body.top) {
      refuse(path, 'WRONG_BINDING', `host wall ${h.id} is not on the body's top storey: a dormer stands over the eaves wall of the storey under the roof`)
      continue
    }
    const from = need(d.fromM, `${path}.fromM`)
    const to = need(d.toM, `${path}.toM`)
    const eaveY = need(d.eaveY, `${path}.eaveY`)
    const ridgeY = need(d.ridgeY, `${path}.ridgeY`)
    if (from === undefined || to === undefined || eaveY === undefined || ridgeY === undefined) continue
    // the plane this wall is the eaves of: the one that slopes down across it
    const host = (planesOf.get(body.id) ?? []).find((p) => p.pitchDeg > 0.5 && p.downslope.x * h.out.x + p.downslope.z * h.out.z > 0.99)
    if (!host) {
      refuse(path, 'REPRESENTATION_LIMIT', `no roof plane of body ${body.id} slopes down to wall ${h.id}: a dormer stands on a slope above an eaves wall, not on a gable end or a flat roof`)
      continue
    }
    const u0 = Math.max(0, Math.min(from, to))
    const u1 = Math.min(h.len, Math.max(from, to))
    const world = (u: number, v: number): P2 => pt(h.a.x + h.u.x * u - h.out.x * v, h.a.z + h.u.z * u - h.out.z * v)
    const tanM = Math.tan(rad(host.pitchDeg))
    const yFace = topAt(host, h.a)
    const vOf = (y: number): number => (y - yFace) / tanM
    // the host plane's eaves edge in front of this wall: how far out of the wall face it lies
    const eavesOut = host.boundary
      .map((q, i) => {
        const r = host.boundary[(i + 1) % host.boundary.length]
        const vq = -((q.x - h.a.x) * h.out.x + (q.z - h.a.z) * h.out.z)
        const vr = -((r.x - h.a.x) * h.out.x + (r.z - h.a.z) * h.out.z)
        const uq = (q.x - h.a.x) * h.u.x + (q.z - h.a.z) * h.u.z
        const ur = (r.x - h.a.x) * h.u.x + (r.z - h.a.z) * h.u.z
        return Math.abs(vq - vr) < 0.02 && Math.min(uq, ur) <= u0 + 1e-6 && Math.max(uq, ur) >= u1 - 1e-6 ? -vq : undefined
      })
      .filter((v): v is number => v !== undefined)
      .sort((p, q) => q - p)[0]
    if (eavesOut === undefined) {
      refuse(path, 'COMPILE_CONFLICT', `the host plane ${host.id} has no straight eaves edge under the whole dormer (another dormer or a step of the outline stands there)`)
      continue
    }
    const oh = eavesOut
    const uc = (u0 + u1) / 2
    const vApex = vOf(ridgeY)
    const vMeet = Math.max(-oh, vOf(eaveY))
    const ridgeV = (host.datum.y - yFace) / tanM
    if (u1 - u0 < 0.6 || ridgeY <= eaveY + 0.05 || vApex >= ridgeV - 0.05 || vApex <= vMeet + 0.05) {
      refuse(path, 'REPRESENTATION_LIMIT', `not a dormer on this roof: ${(u1 - u0).toFixed(2)} m wide, its own eaves at ${eaveY.toFixed(2)} and apex at ${ridgeY.toFixed(2)} against the host's wall-face height ${yFace.toFixed(2)} and ridge ${host.datum.y.toFixed(2)}`)
      continue
    }
    if (d.kind !== 'WALL_GABLE') {
      // a dormer set on the slope: the kernel's own dormer, its front set back to where the slope reaches its sill line
      const setback = Math.max(0.5, vOf(eaveY - 1.2))
      roofDormers.push({ type: 'createDormer', id: d.id, hostPlaneId: host.id, dormerType: d.kind === 'ROOF_SHED' ? 'SHED' : 'GABLE', front: { start: world(u0, setback), end: world(u1, setback) }, eaveY: r6(eaveY), ...(d.kind === 'ROOF_SHED' ? { shedPitchDeg: r6(Math.max(5, host.pitchDeg / 3)) } : { ridgeY: r6(ridgeY) }), wallThickness: 0.2, roofThickness: 0.2, frontOverhang: 0.3, wallMaterialId: MATERIALS_V2.wall, roofMaterialId: MATERIALS_V2.roof, window: { width: r6(Math.max(0.5, (u1 - u0) * 0.6)), height: r6(Math.max(0.5, Math.min(1.3, eaveY - (yFace + setback * tanM) - 0.4))), sillAboveRoof: 0.3, frameWidth: 0.07, divisions: 1 } })
      for (const k of ['fromM', 'toM', 'eaveY', 'ridgeY'] as const) used(`${path}.${k}`, 'houseProgram/createDormer', [d.id], d[k])
      continue
    }
    // the notch in the host plane: along its eaves edge, between the dormer's two sides, back to where the two roofs meet
    const j = host.boundary.findIndex((q, i) => {
      const r = host.boundary[(i + 1) % host.boundary.length]
      const vq = -((q.x - h.a.x) * h.out.x + (q.z - h.a.z) * h.out.z)
      const vr = -((r.x - h.a.x) * h.out.x + (r.z - h.a.z) * h.out.z)
      const uq = (q.x - h.a.x) * h.u.x + (q.z - h.a.z) * h.u.z
      const ur = (r.x - h.a.x) * h.u.x + (r.z - h.a.z) * h.u.z
      return Math.abs(vq + oh) < 0.02 && Math.abs(vr + oh) < 0.02 && Math.min(uq, ur) <= u0 + 1e-6 && Math.max(uq, ur) >= u1 - 1e-6
    })
    if (j < 0) {
      refuse(path, 'COMPILE_CONFLICT', `the host plane ${host.id} has no straight eaves edge under the whole dormer (another dormer or a step of the outline stands there)`)
      continue
    }
    const q0 = host.boundary[j]
    const forward = (host.boundary[(j + 1) % host.boundary.length].x - q0.x) * h.u.x + (host.boundary[(j + 1) % host.boundary.length].z - q0.z) * h.u.z > 0
    const flat = vMeet <= -oh + 1e-6
    const chain = flat ? [world(u0, -oh), world(uc, vApex), world(u1, -oh)] : [world(u0, -oh), world(u0, vMeet), world(uc, vApex), world(u1, vMeet), world(u1, -oh)]
    host.boundary.splice(j + 1, 0, ...(forward ? chain : [...chain].reverse()))
    const pitchD = (Math.atan2(ridgeY - eaveY, (u1 - u0) / 2) * 180) / Math.PI
    const ccw = (poly: P2[]): P2[] => (signedArea(poly) < 0 ? [...poly].reverse() : poly)
    const left: Plane = { id: `${d.id}-roof-l`, bodyId: body.id, key: `dormer:${d.id}:l`, boundary: ccw(flat ? [world(u0, -oh), world(uc, -oh), world(uc, vApex)] : [world(u0, -oh), world(uc, -oh), world(uc, vApex), world(u0, vMeet)]), datum: { x: world(uc, 0).x, y: r6(ridgeY), z: world(uc, 0).z }, pitchDeg: r6(pitchD), downslope: { x: -h.u.x, z: -h.u.z }, thickness: host.thickness, levelId: host.levelId }
    const right: Plane = { id: `${d.id}-roof-r`, bodyId: body.id, key: `dormer:${d.id}:r`, boundary: ccw(flat ? [world(uc, -oh), world(u1, -oh), world(uc, vApex)] : [world(uc, -oh), world(u1, -oh), world(u1, vMeet), world(uc, vApex)]), datum: { x: world(uc, 0).x, y: r6(ridgeY), z: world(uc, 0).z }, pitchDeg: r6(pitchD), downslope: { x: h.u.x, z: h.u.z }, thickness: host.thickness, levelId: host.levelId }
    planes.push(left, right)
    dormerPlanes.set(body.id, [...(dormerPlanes.get(body.id) ?? []), left.id, right.id])
    // its cheeks: the upright triangles between the host slope and the dormer's own eaves, on either side
    if (!flat && vMeet > T + 0.05) {
      for (const [side, u] of [['l', u0], ['r', u1]] as const) {
        const s = world(u, T)
        const e = world(u, vMeet)
        const len = Math.hypot(e.x - s.x, e.z - s.z)
        const start = side === 'l' ? e : s
        const end = side === 'l' ? s : e
        const yS = yFace + T * tanM
        const bottom = side === 'l' ? [{ u: 0, y: r6(eaveY - 0.02) }, { u: r6(len), y: r6(yS - 0.02) }] : [{ u: 0, y: r6(yS - 0.02) }, { u: r6(len), y: r6(eaveY - 0.02) }]
        cheeks.push({ type: 'createWallPanel', id: `${d.id}-cheek-${side}`, levelId: host.levelId, role: 'DORMER_CHEEK', start, end, thickness: 0.2, bottom, top: [{ u: 0, y: r6(eaveY) }, { u: r6(len), y: r6(eaveY) }], hostId: host.id, materialId: MATERIALS_V2.wall })
      }
    }
    for (const k of ['fromM', 'toM', 'eaveY', 'ridgeY'] as const) used(`${path}.${k}`, 'houseProgram/wallDormer', [left.id, right.id, host.id, h.phys.id], d[k])
  }

  for (const p of planes) {
    push({ type: 'createRoofPlane', id: p.id, levelId: p.levelId, boundary: p.boundary, datum: p.datum, pitchDeg: p.pitchDeg, downslope: p.downslope, thickness: r6(p.thickness), materialId: MATERIALS_V2.roof })
    planesOut.push({ id: p.id, bodyId: p.bodyId, key: p.key })
  }

  // --- per level: the slab; per body: its walls, from the floor of its lowest storey to its roof --------------------------
  for (const [level, poly] of [...outlineAt.entries()].sort((p, q) => p[0] - q[0])) {
    const l = levelAt.get(level)
    if (!l) continue
    // an upper floor lies inside the walls, which run past it from the ground to the roof
    const inside = level === 0 ? poly : offset(poly, poly.map(() => -(T - 0.02)))
    push({ type: 'createSlab', id: `slab-${level}`, levelId: l.id, polygon: inside.length >= 3 && isSimple(inside) && signedArea(inside) > 1 ? inside : poly, topOffset: 0, thickness: r6(level === 0 ? Math.max(slabT, 0.3) : slabT), materialId: MATERIALS_V2.slab })
    used(`geometry.outlines[${level}]`, 'houseProgram/createSlab', [`slab-${level}`])
  }
  // Where a lower body's wall stops against a taller body's wall, that wall must be whole there: it owns its corner.
  const nearPt = (p: P2, q: P2): boolean => Math.hypot(p.x - q.x, p.z - q.z) < 1e-4
  const joined = (w: Phys, next: Phys): boolean => w.body.id === next.body.id && w.atEndVertex && next.atStartVertex && nearPt(w.b, next.a)
  const joinedBefore = (mine: Phys[], n: number): Phys | undefined => (n > 0 && joined(mine[n - 1], mine[n]) ? mine[n - 1] : undefined)
  const buttAt = new Map<string, Phys>()
  const ownsStart = new Set<string>()
  const ownsEnd = new Set<string>()
  const rank = new Map(order.map((b, k) => [b.id, k]))
  for (const w of phys) {
    for (const [end, at] of [['START', w.a], ['END', w.b]] as const) {
      const hit = phys
        .filter((x) => (rank.get(x.body.id) ?? 0) < (rank.get(w.body.id) ?? 0))
        .map((x) => ({ x, d: Math.abs((at.x - x.a.x) * x.out.x + (at.z - x.a.z) * x.out.z), t: (at.x - x.a.x) * x.u.x + (at.z - x.a.z) * x.u.z, par: Math.abs(x.u.x * w.u.x + x.u.z * w.u.z) }))
        .filter((q) => q.d < 0.05 && q.t > -0.05 && q.t < q.x.len + 0.05 && q.par < 0.9)
        .sort((p, q) => p.par - q.par)[0]
      if (!hit) continue
      buttAt.set(`${w.id}/${end}`, hit.x)
      const reach = Math.min(1.2, hit.x.len / 2)
      if (hit.t < reach) ownsStart.add(hit.x.id)
      else if (hit.t > hit.x.len - reach) ownsEnd.add(hit.x.id)
    }
  }
  const cornerOwner = (before: Phys, after: Phys): Phys => (ownsStart.has(after.id) && !ownsEnd.has(before.id) ? after : ownsEnd.has(before.id) && !ownsStart.has(after.id) ? before : after.edge % 2 === 0 ? after : before)
  const wallIdsOf = new Map<string, string[]>()
  for (const b of order) {
    const base = levelAt.get(Math.min(...b.storeys))
    const own = planesOf.get(b.id) ?? []
    const ridge = ridgeOf.get(b.id)
    if (!base || ridge === undefined || own.length === 0) continue
    const extra = dormerPlanes.get(b.id) ?? []
    const high = Math.max(ridge, ...planes.filter((p) => extra.includes(p.id)).map((p) => p.datum.y))
    const height = r6(high - base.elevation + (b.roof.kind === 'FLAT' ? 0 : OVER_RIDGE_M))
    const topProfile = { kind: 'FOLLOW_ROOF_PLANES' as const, planeIds: [...own.map((p) => p.id), ...extra] }
    const mine = phys.filter((w) => w.body.id === b.id)
    mine.forEach((w, n) => {
      const prev = joinedBefore(mine, n)
      const closes = n === mine.length - 1 && n > 0 && joined(w, mine[0])
      const next = n < mine.length - 1 && joined(w, mine[n + 1])
      const sHost = !prev && !(n === 0 && mine.length > 1 && joined(mine[mine.length - 1], w)) ? buttAt.get(`${w.id}/START`) : undefined
      const eHost = !closes && !next ? buttAt.get(`${w.id}/END`) : undefined
      const startJunction = prev ? { kind: 'CORNER' as const, with: { wallId: prev.id, end: 'END' as const }, owner: cornerOwner(prev, w) === w ? ('SELF' as const) : ('OTHER' as const) } : sHost ? { kind: 'BUTT' as const, againstWallId: sHost.id } : undefined
      const endJunction = closes ? { kind: 'CORNER' as const, with: { wallId: mine[0].id, end: 'START' as const }, owner: cornerOwner(w, mine[0]) === w ? ('SELF' as const) : ('OTHER' as const) } : eHost ? { kind: 'BUTT' as const, againstWallId: eHost.id } : undefined
      push({ type: 'createWall', id: w.id, levelId: base.id, start: w.a, end: w.b, thickness: r6(thick(w.body.role)), height, baseOffset: 0, kind: 'EXTERIOR', topProfile, materialId: MATERIALS_V2.wall, ...(startJunction ? { startJunction } : {}), ...(endJunction ? { endJunction } : {}) })
    })
    wallIdsOf.set(b.id, mine.map((w) => w.id))
    used(`geometry.bodies[${b.id}].storeys`, 'houseProgram/walls', mine.map((w) => w.id))
  }
  used('geometry.wallThicknessM', 'houseProgram/walls', phys.map((w) => w.id), g.wallThicknessM)
  used('geometry.slabThicknessM', 'houseProgram/createSlab', [...outlineAt.keys()].map((k) => `slab-${k}`), g.slabThicknessM)

  for (const c of cheeks) push(c)
  for (const c of roofDormers) push(c)

  // --- openings ------------------------------------------------------------------------------------------------------
  // v3.54.5. An opening is cut where and as wide as it was agreed. What the wall cannot hold is settled in the open:
  //   - a move or a trim no larger than the reading's own uncertainty is an ADJUSTED fit, with its delta recorded;
  //   - a larger trim, up to a bounded share, is built as an APPROXIMATED opening and named as a known defect;
  //   - beyond that the opening is not built and the reason is given. A printed width is never trimmed.
  // The edge that is not in conflict is never moved to make room: moving a whole opening off a corner used to push it
  // onto its neighbour, which then removed one of the two.
  type Placed = { o: (typeof g.openings)[number]; path: string; w: Phys; s0: number; from: number; to: number; y0: number; y1: number; u: number; agreedFrom: number; agreedWidth: number; fit: 'EXACT' | 'ADJUSTED' | 'APPROXIMATED'; notes: string[]; printed: boolean; height: number; sillOnWall: number }
  const placed: Placed[] = []
  for (const o of g.openings) {
    const path = `geometry.openings[${o.id}]`
    const h = hosts.find((x) => x.id === o.hostWall)
    if (!h) {
      refuse(path, 'WRONG_BINDING', `host wall ${o.hostWall} is not a built wall`)
      continue
    }
    const offsetM = need(o.offsetM, `${path}.offsetM`)
    const stated = need(o.widthM, `${path}.widthM`)
    const height = need(o.heightM, `${path}.heightM`)
    const sill = need(o.sillM, `${path}.sillM`)
    if (offsetM === undefined || stated === undefined || height === undefined || sill === undefined) continue
    const under = wallUnder(h, offsetM, offsetM + stated)
    if (!under) {
      refuse(path, 'WRONG_BINDING', `no built wall stands under ${offsetM.toFixed(2)}..${(offsetM + stated).toFixed(2)} m of ${h.id}`)
      continue
    }
    const l = levelAt.get(Math.min(...under.w.body.storeys))
    if (!l) continue
    // a wall's own material stops a wall thickness short of each corner (the kernel's junction zone)
    const lo = under.s0 + thick(under.w.body.role) + OPENING_FIT.cornerClearM
    const hi = under.s1 - thick(under.w.body.role) - OPENING_FIT.cornerClearM
    const u = Math.min(OPENING_FIT.maxUncertaintyM, Math.max(OPENING_FIT.adjustFloorM, o.offsetM.uncertainty ?? 0, o.widthM.uncertainty ?? 0))
    const printed = o.widthM.basis === 'PRINTED'
    const fitted = fitOpening({ from: offsetM, to: offsetM + stated, lo, hi, u, printed })
    if (!fitted.ok) {
      refuse(path, 'COMPILE_CONFLICT', fitted.why)
      continue
    }
    const from = fitted.from
    const to = fitted.to
    const fit: Placed['fit'] = fitted.fit
    const notes: string[] = fitted.note ? [fitted.note] : []
    // the opening's sill is above ITS level's floor; the wall it is cut in starts at its body's lowest floor
    const sillOnWall = Math.max(0, r6(sill + ((levelAt.get(o.level)?.elevation ?? l.elevation) - l.elevation)))
    fits[o.id] = { u, printed, s0: under.s0, from: offsetM, width: stated }
    placed.push({ o, path, w: under.w, s0: under.s0, from, to, y0: sillOnWall, y1: sillOnWall + height, u, agreedFrom: offsetM, agreedWidth: stated, fit, notes, printed, height, sillOnWall })
  }
  // two openings of one wall that touch or overlap: a pier is left between them when that costs no more than the two
  // readings can tell; a larger overlap is two readings of one place, and the smaller one is held as an open conflict
  const dropped = new Set<Placed>()
  const byWall = new Map<string, Placed[]>()
  for (const q of placed) byWall.set(q.w.id, [...(byWall.get(q.w.id) ?? []), q])
  for (const list of byWall.values()) {
    list.sort((p, q) => p.from - q.from)
    for (let i = 0; i < list.length; i += 1) {
      const a = list[i]
      if (dropped.has(a)) continue
      for (let j = i + 1; j < list.length; j += 1) {
        const b = list[j]
        if (dropped.has(b)) continue
        if (Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) <= 0.02) continue
        const lack = OPENING_FIT.pierM - (b.from - a.to)
        if (lack <= 1e-6) continue
        const overlap = a.to - b.from
        const smaller = a.to - a.from <= b.to - b.from ? a : b
        if (overlap > 0.5 * (smaller.to - smaller.from)) {
          const other = smaller === a ? b : a
          dropped.add(smaller)
          refuse(smaller.path, 'CONFLICT_OPEN', `read over the same stretch of wall ${a.w.id} as ${other.o.id} (${overlap.toFixed(2)} m in common): two readings of one place — ${other.o.id} is cut, this one is kept as an observation`)
          if (smaller === a) break
          continue
        }
        const give = (q: Placed): number => (q.printed ? 0 : q.u)
        if (lack <= give(a) + give(b) + 1e-6) {
          const ta = give(a) + give(b) > 0 ? (lack * give(a)) / (give(a) + give(b)) : 0
          a.to -= ta
          b.from += lack - ta
          for (const [q, t] of [[a, ta], [b, lack - ta]] as const) {
            if (t <= 1e-6) continue
            if (q.fit === 'EXACT') q.fit = 'ADJUSTED'
            q.notes.push(`trimmed by ${t.toFixed(2)} m to leave a ${OPENING_FIT.pierM.toFixed(2)} m pier to ${(q === a ? b : a).o.id} (within the reading's ±${q.u.toFixed(2)} m)`)
          }
        } else {
          const other = smaller === a ? b : a
          dropped.add(smaller)
          refuse(smaller.path, 'CONFLICT_OPEN', `overlaps ${other.o.id} on wall ${a.w.id} by ${overlap.toFixed(2)} m, more than the two readings can be off: one of the two was read at the wrong place — ${other.o.id} is cut, this one is kept as an observation`)
          if (smaller === a) break
        }
      }
    }
  }
  for (const q of placed) {
    if (dropped.has(q)) continue
    const { o, path } = q
    const width = q.to - q.from
    if (width < OPENING_FIT.minWidthM) {
      refuse(path, 'COMPILE_CONFLICT', `${width.toFixed(2)} m is left of it between its neighbours: not an opening`)
      continue
    }
    const door = o.kind !== 'WINDOW'
    push({ type: 'cutOpening', id: o.id, wallId: q.w.id, kind: door ? 'DOOR' : 'WINDOW', offset: r6(q.from - q.s0), sill: q.sillOnWall, width: r6(width), height: r6(q.height) })
    const frame = { frameDepth: r6(Math.min(0.12, T * 0.4)), frameInset: r6(Math.min(0.1, T * 0.25)) }
    const panes = Math.max(1, o.panes ?? Math.round(width / 0.9))
    if (o.kind === 'WINDOW') push({ type: 'placeWindow', id: `${o.id}-window`, openingId: o.id, ...frame, divisions: panes, materialId: MATERIALS_V2.glass })
    else if (o.kind === 'GARAGE_DOOR') push({ type: 'placeDoor', id: `${o.id}-leaf`, openingId: o.id, ...frame, assembly: { panels: [{ kind: 'PANEL', fraction: 1 }], mullionWidth: 0.04 }, usage: 'GARAGE', materialId: MATERIALS_V2.gate })
    else if (o.kind === 'GLAZED_DOOR') push({ type: 'placeDoor', id: `${o.id}-leaf`, openingId: o.id, ...frame, assembly: { panels: Array.from({ length: panes }, () => ({ kind: 'GLAZED' as const, fraction: 1 / panes })), mullionWidth: 0.04 }, materialId: MATERIALS_V2.glass })
    else push({ type: 'placeDoor', id: `${o.id}-leaf`, openingId: o.id, ...frame, materialId: MATERIALS_V2.timber })
    const ids = [o.id, door ? `${o.id}-leaf` : `${o.id}-window`]
    const dFrom = q.from - q.agreedFrom
    const dWidth = width - q.agreedWidth
    const why = q.notes.join('; ')
    trace.push({ path: `${path}.offsetM`, state: 'ACCEPTED', consumer: 'houseProgram/cutOpening', programIds: ids, meshIds: [], built: r6(q.from), fit: q.fit, ...(Math.abs(dFrom) > 1e-6 ? { code: 'OVERRIDDEN' as const, delta: r6(dFrom), why } : {}) })
    trace.push({ path: `${path}.widthM`, state: 'ACCEPTED', consumer: 'houseProgram/cutOpening', programIds: ids, meshIds: [], built: r6(width), fit: q.fit, ...(Math.abs(dWidth) > 1e-6 ? { code: 'OVERRIDDEN' as const, delta: r6(dWidth), why } : {}) })
    used(`${path}.heightM`, 'houseProgram/cutOpening', ids, o.heightM)
    used(`${path}.sillM`, 'houseProgram/cutOpening', ids, o.sillM)
    if (q.fit === 'APPROXIMATED') approximated.push({ id: o.id, what: why })
  }

  // --- balconies, canopies, chimneys ---------------------------------------------------------------------------------
  for (const b of g.balconies) {
    const path = `geometry.balconies[${b.id}]`
    const l = levelAt.get(b.level)
    const topY = need(b.topY, `${path}.topY`)
    const thickness = need(b.thicknessM, `${path}.thicknessM`)
    if (!l || topY === undefined || thickness === undefined) continue
    const r = b.rect
    push({ type: 'createBalcony', id: b.id, levelId: l.id, kind: 'BALCONY', footprint: { minX: r6(Math.min(r.x0, r.x1)), maxX: r6(Math.max(r.x0, r.x1)), minZ: r6(Math.min(r.z0, r.z1)), maxZ: r6(Math.max(r.z0, r.z1)) }, topOffset: r6(topY - l.elevation), thickness: r6(thickness), materialId: MATERIALS_V2.slab })
    const ids = [b.id]
    const terrainUnder = g.terrainY.value ?? 0
    const ground = levelAt.get(0)
    b.posts.forEach((q, i) => {
      if (!ground) return
      push({ type: 'createColumn', id: `${b.id}-post-${i}`, levelId: ground.id, role: 'POST', base: pt(q.x, q.z), baseOffset: r6(terrainUnder - ground.elevation), height: r6(topY - thickness - terrainUnder), width: 0.3, depth: 0.3, hostId: b.id, materialId: MATERIALS_V2.member })
      ids.push(`${b.id}-post-${i}`)
    })
    if (b.railing) {
      // the railing runs round the edges that do not lie against the house
      const outer = outlineAt.get(b.level) ?? outlineAt.get(0) ?? []
      const corners = [pt(r.x0, r.z0), pt(r.x1, r.z0), pt(r.x1, r.z1), pt(r.x0, r.z1)]
      const free = corners.map((c, i) => {
        const n = corners[(i + 1) % 4]
        const m = { x: (c.x + n.x) / 2, z: (c.z + n.z) / 2 }
        return !(contains(outer, m) || onBoundary(outer, m, 0.06) >= 0)
      })
      const start = free.findIndex((f, i) => f && !free[(i + 3) % 4])
      if (start >= 0) {
        const pathPts: P2[] = [corners[start]]
        for (let k = 0; k < 4 && free[(start + k) % 4]; k += 1) pathPts.push(corners[(start + k + 1) % 4])
        if (pathPts.length >= 2) {
          push({ type: 'createRailing', id: `${b.id}-railing`, levelId: l.id, start: pathPts[0], end: pathPts[pathPts.length - 1], path: pathPts, baseOffset: r6(topY - l.elevation), height: 1.1, infill: 'BARS', hostId: b.id, materialId: MATERIALS_V2.member })
          ids.push(`${b.id}-railing`)
        }
      }
    }
    used(`${path}.rect`, 'houseProgram/createBalcony', ids)
    used(`${path}.topY`, 'houseProgram/createBalcony', ids, b.topY)
  }
  for (const c of g.canopies) {
    const path = `geometry.canopies[${c.id}]`
    const l = levelAt.get(0)
    const under = need(c.undersideY, `${path}.undersideY`)
    const thickness = need(c.thicknessM, `${path}.thicknessM`)
    if (!l || under === undefined || thickness === undefined) continue
    const r = c.rect
    const terrain = g.terrainY.value ?? 0
    if (under - terrain < 1.8) {
      refuse(path, 'WRONG_READ', `its underside at +${under.toFixed(2)} m is ${(under - terrain).toFixed(2)} m over the terrain: not a roof one walks under`)
      continue
    }
    const plate = [pt(r.x0, r.z0), pt(r.x1, r.z0), pt(r.x1, r.z1), pt(r.x0, r.z1)]
    push({ type: 'createRoofPlane', id: c.id, levelId: l.id, boundary: signedArea(plate) < 0 ? plate.reverse() : plate, datum: { x: r6((r.x0 + r.x1) / 2), y: r6(under + thickness), z: r6((r.z0 + r.z1) / 2) }, pitchDeg: 0, downslope: { x: 0, z: -1 }, thickness: r6(thickness), materialId: MATERIALS_V2.roof })
    const ids = [c.id]
    c.posts.forEach((p, i) => {
      push({ type: 'createColumn', id: `${c.id}-post-${i}`, levelId: l.id, role: 'POST', base: pt(p.x, p.z), baseOffset: r6(terrain - l.elevation), height: r6(under - terrain), width: 0.25, depth: 0.25, hostId: c.id, materialId: MATERIALS_V2.member })
      ids.push(`${c.id}-post-${i}`)
    })
    used(`${path}.rect`, 'houseProgram/canopy', ids)
    used(`${path}.undersideY`, 'houseProgram/canopy', ids, c.undersideY)
  }
  for (const w of g.rooflights) {
    const path = `geometry.rooflights[${w.id}]`
    const r = w.rect
    const m = { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 }
    const corners = [pt(r.x0, r.z0), pt(r.x1, r.z0), pt(r.x1, r.z1), pt(r.x0, r.z1)]
    const plane = planes.find((p) => p.bodyId === w.bodyId && p.pitchDeg > 0.5 && !p.key.startsWith('dormer:') && contains(p.boundary, m) && corners.every((c) => contains(p.boundary, c)))
    if (!plane) {
      refuse(path, 'COMPILE_CONFLICT', 'no single roof plane of its body lies under the whole of it (a dormer or the ridge stands there)')
      continue
    }
    push({ type: 'cutRoofOpening', id: w.id, roofId: plane.id, kind: 'ROOFLIGHT', footprint: { minX: r6(Math.min(r.x0, r.x1)), maxX: r6(Math.max(r.x0, r.x1)), minZ: r6(Math.min(r.z0, r.z1)), maxZ: r6(Math.max(r.z0, r.z1)) }, cut: 'VERTICAL' })
    push({ type: 'placeRooflight', id: `${w.id}-unit`, roofOpeningId: w.id, materialId: MATERIALS_V2.glass })
    used(`${path}.rect`, 'houseProgram/rooflight', [w.id, `${w.id}-unit`, plane.id])
  }
  for (const c of g.chimneys) {
    const path = `geometry.chimneys[${c.id}]`
    const topY = need(c.topY, `${path}.topY`)
    const l = levelAt.get(Math.max(...levels.map((x) => x.index)))
    if (!l || topY === undefined) continue
    const r = c.rect
    const m = { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 }
    const under = planes.filter((p) => contains(p.boundary, m)).map((p) => topAt(p, m))
    const base = under.length > 0 ? Math.max(...under) - 0.4 : l.elevation
    if (topY - base < 0.3) {
      refuse(path, 'COMPILE_CONFLICT', 'its top is not above the roof where it stands')
      continue
    }
    push({ type: 'placeChimney', id: c.id, levelId: l.id, footprint: { minX: r6(Math.min(r.x0, r.x1)), maxX: r6(Math.max(r.x0, r.x1)), minZ: r6(Math.min(r.z0, r.z1)), maxZ: r6(Math.max(r.z0, r.z1)) }, baseOffset: r6(base - l.elevation), height: r6(topY - base), materialId: MATERIALS_V2.chimney })
    used(`${path}.rect`, 'houseProgram/placeChimney', [c.id])
    used(`${path}.topY`, 'houseProgram/placeChimney', [c.id], c.topY)
  }
  return { program, trace, refusals, planes: planesOut, hostWalls, approximated, fits }
}

export type { HouseGeometry, HouseBody }
export { canonical as canonicalOutline }
