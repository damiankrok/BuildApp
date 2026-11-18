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
import { bbox, canonical, clipConvex, clipHalfPlane, contains, edgeOf, isSimple, offset, onBoundary, pt, sharedStretches, signedArea, toSegment } from './poly.js'
import type { P2 } from './poly.js'
import { outlineSteps } from './steps.js'
import type { OutlineStep } from './steps.js'

export const HOUSE_BUILDER_NAME = 'reconstruction.house-builder' as const
export const HOUSE_BUILDER_VERSION = '0.7.0' as const
export const HOUSE_BUILDER_LABEL = 'MODEL Z UZGODNIONEGO OPISU ŹRÓDEŁ'

type Code = (typeof TRACE_CODES)[number]
export type HouseRefusal = { path: string; code: Code; why: string }
/** How an opening was agreed, for a second fit when the kernel knows its wall's clear stretch better: host coordinates. */
export type OpeningFitInfo = { u: number; printed: boolean; s0: number; from: number; width: number }
export type HouseProgram = { fits: Record<string, OpeningFitInfo>; program: BuildingCommand[]; trace: HouseParameterRecord[]; refusals: HouseRefusal[]; /** Openings cut with a larger change than their reading's uncertainty: drawn, and said. */ approximated: Array<{ id: string; what: string }>; /** v3.54.8: decisions by a relation of the plan, said. */ builderNotes: Array<{ code: string; what: string }>; planes: Array<{ id: string; bodyId: string; key: string }>; hostWalls: Array<{ id: string; level: number; bodyId: string; lengthM: number; a: P2; b: P2 }> }

const r6 = (v: number): number => Math.round(v * 1e6) / 1e6
const rad = (deg: number): number => (deg * Math.PI) / 180
const ROOF_RECTANGLE_FILL = 0.8
const ROOF_T = 0.25
/** How far a wall under a roof is drawn past the ridge before the planes cut it (m): any positive value gives the same wall. */
const OVER_RIDGE_M = 0.5
/** v3.54.8: where a roof stops behind a gable frame's plate: this much in front of the plate's back, the plate as much thinner. */
const FRAME_ROOF_SEAM_M = 0.01
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
  /** v3.54.8: what the builder decided by a relation of the plan, said (a leg on a slab, a slab carried under a leg). */
  const builderNotes: HouseProgram['builderNotes'] = []
  /** v3.54.8: a balcony slab carried on under a frame leg that stands on it. */
  const balconyRect = new Map<string, { x0: number; z0: number; x1: number; z1: number }>()
  const balconyRail = new Map<string, { x0: number; z0: number; x1: number; z1: number }>()
  /** v3.54.8: returns a frame plate stands in (the plate is the leg there): not built as walls. */
  const framedPiers = new Set<string>()
  const fits: HouseProgram['fits'] = {}
  if (!g) return { program, trace, refusals: [{ path: 'geometry', code: 'NOT_CONSUMED', why: 'the document holds observations only: no agreed geometry to build' }], planes: planesOut, hostWalls, approximated, builderNotes, fits }
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
    // v3.54.7: a gable end with a frame has no verge overhang — the frame is the roof's edge, in the outer plane
    const framedSides = new Set<string>((g.frames ?? []).filter((f) => f.bodyId === b.id).map((f) => f.side))
    const sideOfEdge = (e: { a: P2; b: P2; u: P2 }): string | undefined => {
      const m = { x: (e.a.x + e.b.x) / 2, z: (e.a.z + e.b.z) / 2 }
      if (Math.abs(e.u.x) > 0.99) return Math.abs(m.z - box.z0) < 0.05 ? 'FRONT' : Math.abs(m.z - box.z1) < 0.05 ? 'REAR' : undefined
      if (Math.abs(e.u.z) > 0.99) return Math.abs(m.x - box.x0) < 0.05 ? 'LEFT' : Math.abs(m.x - box.x1) < 0.05 ? 'RIGHT' : undefined
      return undefined
    }
    const dist = roofPoly.map((_, i) => {
      const e = edgeOf(roofPoly, i)
      const s0 = sideOfEdge(e)
      // v3.54.8: a frame standing in the returns IS the roof's edge over its depth: the roof stops behind it (no two
      // surfaces in one place); a frame in front of a plain gable leaves the roof at the wall's face
      const fr = s0 && framedSides.has(s0) ? (g.frames ?? []).find((f) => f.bodyId === b.id && f.side === s0) : undefined
      // (it stops FRAME_ROOF_SEAM_M short of the frame's back, so that the walls behind it stay under it; the plate is as
      // much thinner: they touch, they do not overlap)
      if (fr) return fr.depthM.basis === 'DEFAULT' || fr.depthM.value === null ? 0 : -(fr.depthM.value - FRAME_ROOF_SEAM_M)
      const mine = ridgeOf.get(b.id) ?? 0
      const along = bodies.filter((o) => o.id !== b.id && (ridgeOf.get(o.id) ?? 0) >= mine - 1e-6).reduce((s, o) => s + sharedStretches(e.a, e.b, o.poly).reduce((q, [lo, hi]) => q + hi - lo, 0), 0)
      if (along > e.len * 0.5) return 0
      // v3.54.8: with a frame on its gable, the frame's outer corner is the roof's lowest outer point on the elevation:
      // an eaves overhang that was not read (a DEFAULT) would stand out past that corner — the roof stays flush
      if (framedSides.size > 0 && b.roof.overhangM.basis === 'DEFAULT') return 0
      return overhang
    })
    if (framedSides.size > 0 && b.roof.overhangM.basis === 'DEFAULT' && overhang > 0) builderNotes.push({ code: 'EAVES_FLUSH_WITH_FRAME', what: `${b.id}: its eaves overhang is not read (${overhang} m a default); a frame edges its ${[...framedSides].join(' and ').toLowerCase()} gable, so the eaves stop flush with the frame's corner instead of standing out past it` })
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
  type Phys = { id: string; body: Body; a: P2; b: P2; len: number; u: P2; out: P2; edge: number; atStartVertex: boolean; atEndVertex: boolean; /** v3.54.7: a solid return (a step of the outline), as thick as the step is deep */ pierM?: number }
  const phys: Phys[] = []
  // v3.54.7 — the steps of a body's outline narrower than two walls are its returns: the ring runs along the recessed
  // line (`core`) and each step is one solid wall as thick as it is deep (`steps.ts`)
  const coreOf = new Map<string, P2[]>()
  const stepsOf = new Map<string, OutlineStep[]>()
  for (const b of bodies) {
    if (b.role === 'BAY') {
      coreOf.set(b.id, b.poly)
      continue
    }
    const r = outlineSteps(b.poly, thick(b.role))
    coreOf.set(b.id, r.core)
    stepsOf.set(b.id, r.steps)
  }
  const ringed = new Set<string>()
  const order = [...bodies].filter((b) => planesOf.has(b.id)).sort((p, q) => (ridgeOf.get(q.id) ?? 0) - (ridgeOf.get(p.id) ?? 0) || (p.role === 'MAIN' ? -1 : q.role === 'MAIN' ? 1 : Math.abs(signedArea(q.poly)) - Math.abs(signedArea(p.poly))))
  order.forEach((b, k) => {
    const earlier = order.slice(0, k)
    let whole = true
    const mine: Phys[] = []
    const ring = coreOf.get(b.id) ?? b.poly
    for (let i = 0; i < ring.length; i += 1) {
      const e = edgeOf(ring, i)
      const shared = earlier.flatMap((o) => sharedStretches(e.a, e.b, coreOf.get(o.id) ?? o.poly)).sort((p, q) => p[0] - q[0])
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
    ;(stepsOf.get(b.id) ?? []).forEach((st, k) => {
      // the step's face is an edge of the body's own outline: its direction and outward normal are that edge's
      const at = b.poly.findIndex((q, n) => Math.hypot(q.x - st.a.x, q.z - st.a.z) < 1e-6 && Math.hypot(b.poly[(n + 1) % b.poly.length].x - st.b.x, b.poly[(n + 1) % b.poly.length].z - st.b.z) < 1e-6)
      if (at < 0) return
      const e = edgeOf(b.poly, at)
      phys.push({ id: `w-${b.id}-ret-${k}`, body: b, a: e.a, b: e.b, len: e.len, u: e.u, out: e.out, edge: -1 - k, atStartVertex: false, atEndVertex: false, pierM: r6(st.depthM) })
    })
  })
  // a host wall of the document (an edge of a level's outline) is a stretch of one built wall
  type Host = { id: string; level: number; index: number; body: Body; a: P2; b: P2; len: number; u: P2; out: P2; phys: Phys; shift: number }
  const hosts: Host[] = []
  for (const [level, poly] of [...outlineAt.entries()].sort((p, q) => p[0] - q[0])) {
    poly.forEach((_, i) => {
      const e = edgeOf(poly, i)
      const m = { x: (e.a.x + e.b.x) / 2, z: (e.a.z + e.b.z) / 2 }
      const w = phys.find((x) => x.body.storeys.includes(level) && x.u.x * e.u.x + x.u.z * e.u.z > 0.99 && sharedStretches(x.a, x.b, [e.a, e.b]).length > 0 && Math.abs((m.x - x.a.x) * x.out.x + (m.z - x.a.z) * x.out.z) < 0.03 && (m.x - x.a.x) * x.u.x + (m.z - x.a.z) * x.u.z > -0.03 && (m.x - x.a.x) * x.u.x + (m.z - x.a.z) * x.u.z < x.len + 0.03)
      // v3.54.7: the sides of a step are inside its return: they are built, as the return's ends
      const onReturn = !w && phys.some((x) => {
        if (!x.pierM || !x.body.storeys.includes(level)) return false
        const v = (m.x - x.a.x) * -x.out.x + (m.z - x.a.z) * -x.out.z
        const t = (m.x - x.a.x) * x.u.x + (m.z - x.a.z) * x.u.z
        return v > -0.03 && v < x.pierM + 0.03 && t > -0.03 && t < x.len + 0.03
      })
      if (onReturn) return void used(`geometry.outlines[${level}].polygon[${i}]`, 'houseProgram/returns', [])
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

  // --- v3.54.8: gable frames — ONE plate in the gable's face plane (createWallPanel, role GABLE_FRAME): its top is the
  // roof's top line in that plane (the outer contour), its bottom the band's lower edge (top − the band, measured
  // vertically as read) between the legs, and each leg's own base under its leg — so the two rakes meet at the ridge in
  // one solid (no crossing members, no step), and each leg stands where the source puts it. With returns on the plan the
  // plate stands in them (from the outer plane back over their depth) and replaces them; without, in front of the wall.
  const SIDE_N: Record<string, P2> = { FRONT: { x: 0, z: -1 }, REAR: { x: 0, z: 1 }, LEFT: { x: -1, z: 0 }, RIGHT: { x: 1, z: 0 } }
  for (const f of g.frames ?? []) {
    const path = `geometry.frames[${f.id}]`
    const band = need(f.bandM, `${path}.bandM`)
    const depth = need(f.depthM, `${path}.depthM`)
    const own = planes.filter((q) => q.bodyId === f.bodyId)
    const body = bodies.find((x) => x.id === f.bodyId)
    if (band === undefined || depth === undefined) continue
    if (own.length === 0 || !body) {
      refuse(path, 'WRONG_BINDING', `body ${f.bodyId} has no roof planes to edge`)
      continue
    }
    const bb = bbox(body.poly)
    const side = f.side
    const L = side === 'FRONT' || side === 'REAR' ? bb.x1 - bb.x0 : bb.z1 - bb.z0
    // u: along the side from its left end as a viewer outside sees it; P(u, v): v metres in from the outer plane
    const P = (u: number, v = 0): P2 => (side === 'FRONT' ? pt(bb.x0 + u, bb.z0 + v) : side === 'REAR' ? pt(bb.x1 - u, bb.z1 - v) : side === 'LEFT' ? pt(bb.x0 + v, bb.z1 - u) : pt(bb.x1 - v, bb.z0 + u))
    const uOf = (q: P2): number => (side === 'FRONT' ? q.x - bb.x0 : side === 'REAR' ? bb.x1 - q.x : side === 'LEFT' ? bb.z1 - q.z : q.z - bb.z0)
    const vOf = (q: P2): number => (side === 'FRONT' ? q.z - bb.z0 : side === 'REAR' ? bb.z1 - q.z : side === 'LEFT' ? q.x - bb.x0 : bb.x1 - q.x)
    const piersHere = phys.filter((w) => w.body.id === body.id && w.pierM && Math.abs(vOf(w.a)) < 0.05 && Math.abs(vOf(w.b)) < 0.05)
    const proud = piersHere.length === 0 && f.depthM.basis === 'DEFAULT'
    // the roof's top line in the plate's outer plane: the lowest plane over each point (a gable's two slopes), exact at
    // the ends and where two planes cross
    const planeTop = (u: number): number => Math.min(...own.map((pl) => topAt(pl, P(u, proud ? -depth : 0))))
    const lines = own.map((pl) => ({ a: topAt(pl, P(0, proud ? -depth : 0)), b: topAt(pl, P(L, proud ? -depth : 0)) }))
    const us = new Set<number>([0, L])
    for (let i = 0; i < lines.length; i += 1)
      for (let j = i + 1; j < lines.length; j += 1) {
        const d = lines[i].b - lines[i].a - (lines[j].b - lines[j].a)
        if (Math.abs(d) < 1e-9) continue
        const t = (lines[j].a - lines[i].a) / d
        if (t > 1e-6 && t < 1 - 1e-6) us.add(r6(t * L))
      }
    if (Math.max(...[...us].map(planeTop)) - Math.min(planeTop(0), planeTop(L)) < 0.3) {
      refuse(path, 'REPRESENTATION_LIMIT', `body ${f.bodyId}'s roof does not rise to a gable on its ${side.toLowerCase()} side`)
      continue
    }
    // legs: over the returns the plan shows (their width), else as wide as read
    const legRead = f.legM?.value ?? undefined
    const leftPier = piersHere.find((w) => Math.min(uOf(w.a), uOf(w.b)) < 0.05)
    const rightPier = piersHere.find((w) => Math.max(uOf(w.a), uOf(w.b)) > L - 0.05)
    const wL = leftPier ? Math.max(uOf(leftPier.a), uOf(leftPier.b)) : legRead
    const wR = rightPier ? L - Math.min(uOf(rightPier.a), uOf(rightPier.b)) : legRead
    // each leg's base: on the ground where a return stands under it; a base read for that leg alone is taken; a base read
    // once for both, or none, under a leg with no ground under it (the plan's outline is open there) is decided by what
    // the leg stands on: a slab that reaches its inner face (the slab is carried on under the leg) or a lower body's roof
    // a slab the leg can stand on: its near edge within the plate's depth (or touching its back face)
    const plateFront = proud ? -depth : 0
    const plateBack = proud ? 0 : depth
    const balconyHere = g.balconies.filter((b) => {
      const v0 = Math.min(vOf(pt(b.rect.x0, b.rect.z0)), vOf(pt(b.rect.x1, b.rect.z1)))
      return v0 > plateFront - 0.05 && v0 < plateBack + 0.1
    })
    const legBase = (which: 'LEFT' | 'RIGHT', pier: Phys | undefined, w: number | undefined, read: Num | undefined): { base: number; how: string } | undefined => {
      if (w === undefined) return undefined
      if (pier) return { base: 0, how: `on the ground: the plan's return ${pier.id} stands under it` }
      const own = read && read.value !== null && read.basis !== 'ESTIMATED' && read.basis !== 'DEFAULT' ? read.value : null
      const u0 = which === 'LEFT' ? 0 : L - w
      const u1 = which === 'LEFT' ? w : L
      // a leg read for itself ends where it was read; when that is the top of a slab that reaches it, it stands on that
      // slab (carried on under it) — the row and the plan agree
      for (const b of balconyHere) {
        const a = [uOf(pt(b.rect.x0, b.rect.z0)), uOf(pt(b.rect.x1, b.rect.z1))].sort((p, q) => p - q)
        const touches = which === 'LEFT' ? Math.abs(a[0] - u1) < 0.25 || (a[0] < u1 && a[1] > u0) : Math.abs(a[1] - u0) < 0.25 || (a[1] > u0 && a[0] < u1)
        const top = b.topY.value
        if (!touches || top === null || (own !== null && Math.abs(own - top) > 0.2)) continue
        // the slab is carried on under the leg, to the outer edge of the frame
        const ext = which === 'LEFT' ? Math.min(a[0], u0) : Math.max(a[1], u1)
        const q0 = P(which === 'LEFT' ? ext : a[0], Math.min(vOf(pt(b.rect.x0, b.rect.z0)), vOf(pt(b.rect.x1, b.rect.z1))))
        const q1 = P(which === 'LEFT' ? a[1] : ext, Math.max(vOf(pt(b.rect.x0, b.rect.z0)), vOf(pt(b.rect.x1, b.rect.z1))))
        balconyRect.set(b.id, { x0: r6(Math.min(q0.x, q1.x)), z0: r6(Math.min(q0.z, q1.z)), x1: r6(Math.max(q0.x, q1.x)), z1: r6(Math.max(q0.z, q1.z)) })
        // the railing guards the slab up to the leg's inner face, not through the leg
        const vr = [vOf(pt(b.rect.x0, b.rect.z0)), vOf(pt(b.rect.x1, b.rect.z1))].sort((p, q) => p - q)
        const r0 = P(which === 'LEFT' ? Math.max(a[0], u1) : a[0], vr[0])
        const r1 = P(which === 'LEFT' ? a[1] : Math.min(a[1], u0), vr[1])
        if ((which === 'LEFT' ? a[1] - Math.max(a[0], u1) : Math.min(a[1], u0) - a[0]) > 0.3) balconyRail.set(b.id, { x0: r6(Math.min(r0.x, r1.x)), z0: r6(Math.min(r0.z, r1.z)), x1: r6(Math.max(r0.x, r1.x)), z1: r6(Math.max(r0.z, r1.z)) })
        builderNotes.push({ code: 'FRAME_LEG_ON_SLAB', what: `${f.id}: its ${which.toLowerCase()} leg has no ground under it on the plan; it stands on ${b.id} at +${top.toFixed(2)} m${own !== null ? ` (its own row, ${own.toFixed(2)} m, agrees)` : read && read.value !== null ? ` (the one row read for both legs, ${read.value.toFixed(2)} m, is not this leg's)` : ''}, and the slab is carried on under the leg to the frame's outer edge` })
        return { base: top, how: `on ${b.id}'s slab${own !== null ? ' (its own row read agrees)' : ''}` }
      }
      if (own !== null) return { base: own, how: `the row its ${which.toLowerCase()} leg ends at, read` }
      const c = P((u0 + u1) / 2, depth / 2)
      const lower = bodies.filter((o) => o.id !== body.id && contains(o.poly, c)).map((o) => ({ o, top: o.roof.ridgeY.value })).filter((x): x is { o: Body; top: number } => x.top !== null)[0]
      if (lower) {
        builderNotes.push({ code: 'FRAME_LEG_ON_ROOF', what: `${f.id}: its ${which.toLowerCase()} leg has no ground under it on the plan; it stands on ${lower.o.id}'s roof at +${lower.top.toFixed(2)} m` })
        return { base: lower.top, how: `on ${lower.o.id}'s roof` }
      }
      if (read && read.value !== null && contains(body.poly, c)) return { base: read.value, how: 'the one row read for both legs; the plan has ground under it' }
      refuse(`${path}.leg${which === 'LEFT' ? 'Left' : 'Right'}BottomY`, 'SOURCE_UNKNOWN', `its ${which.toLowerCase()} leg has no ground under it on the plan and nothing it could stand on: not built`)
      return undefined
    }
    const inner = (u: number): number => planeTop(u) - band
    // a leg whose base is read at or above the band's inner contour over it is no leg: the row contradicts the band
    const below = (which: 'LEFT' | 'RIGHT', w: number | undefined, r: { base: number; how: string } | undefined): { base: number; how: string } | undefined => {
      if (!r || w === undefined) return r
      const at = inner(which === 'LEFT' ? w : L - w)
      if (r.base < at - 0.05) return r
      refuse(`${path}.leg${which === 'LEFT' ? 'Left' : 'Right'}BottomY`, 'WRONG_READ', `its ${which.toLowerCase()} leg is read to end at +${r.base.toFixed(2)} m (${r.how}), at or above the band's inner edge over it (+${at.toFixed(2)} m): no leg below the band is drawn`)
      return undefined
    }
    const left = below('LEFT', wL, legBase('LEFT', leftPier, wL, f.legLeftBottomY))
    const right = below('RIGHT', wR, legBase('RIGHT', rightPier, wR, f.legRightBottomY))
    const eps = 1e-4
    const top: Array<{ u: number; y: number }> = [...us].sort((p, q) => p - q).map((u) => ({ u: r6(u), y: r6(planeTop(u)) }))
    const bu = new Set<number>([...us])
    if (left && wL) [wL, wL + eps].forEach((u) => bu.add(u))
    if (right && wR) [L - wR - eps, L - wR].forEach((u) => bu.add(u))
    const bottom = [...bu].filter((u) => u >= 0 && u <= L).sort((p, q) => p - q).map((u) => {
      const inLeft = left && wL !== undefined && u <= wL + eps / 2
      const inRight = right && wR !== undefined && u >= L - wR - eps / 2
      const y = inLeft ? Math.min(left.base, inner(u)) : inRight ? Math.min((right as { base: number }).base, inner(u)) : inner(u)
      return { u: r6(u), y: r6(y) }
    })
    const id = `${f.id}-plate`
    const level = levelAt.get(Math.min(...body.storeys)) ?? [...levelAt.values()][0]
    // the plate's outer face line, left to right as seen from outside; its material lies behind it, `depth` deep
    const start = proud ? P(0, -depth) : P(0)
    const end = proud ? P(L, -depth) : P(L)
    push({ type: 'createWallPanel', id, levelId: level.id, role: 'GABLE_FRAME', start, end, thickness: r6(proud ? depth : depth - FRAME_ROOF_SEAM_M), bottom, top, materialId: MATERIALS_V2.member })
    for (const pr of [leftPier, rightPier]) if (pr) framedPiers.add(pr.id)
    used(`${path}.bandM`, 'houseProgram/gableFrame(createWallPanel)', [id], f.bandM)
    used(`${path}.depthM`, 'houseProgram/gableFrame(createWallPanel)', [id], f.depthM)
    if (left) used(`${path}.legLeftBottomY`, `houseProgram/gableFrame(leg: ${left.how})`, [id], { value: left.base, basis: 'DERIVED', how: left.how })
    if (right) used(`${path}.legRightBottomY`, `houseProgram/gableFrame(leg: ${right.how})`, [id], { value: right.base, basis: 'DERIVED', how: right.how })
  }

  // --- per level: the slab; per body: its walls, from the floor of its lowest storey to its roof --------------------------
  for (const [level, poly] of [...outlineAt.entries()].sort((p, q) => p[0] - q[0])) {
    const l = levelAt.get(level)
    if (!l) continue
    // an upper floor lies inside the walls, which run past it from the ground to the roof
    const inside = level === 0 ? poly : offset(poly, poly.map(() => -(T - 0.02)))
    // v3.54.9: the openings in this floor the interior names (a stair well, a void): no floor is laid over them
    const holes = level === 0 ? [] : (g.interior?.levels ?? []).filter((x) => x.level === level).flatMap((x) => x.voids).map((v) => (signedArea(v.map((q) => pt(q.x, q.z))) < 0 ? [...v].reverse() : v).map((q) => pt(r6(q.x), r6(q.z))))
    push({ type: 'createSlab', id: `slab-${level}`, levelId: l.id, polygon: inside.length >= 3 && isSimple(inside) && signedArea(inside) > 1 ? inside : poly, ...(holes.length ? { holes } : {}), topOffset: 0, thickness: r6(level === 0 ? Math.max(slabT, 0.3) : slabT), materialId: MATERIALS_V2.slab })
    if (holes.length) used('geometry.interior.voids', 'houseProgram/createSlab(holes)', [`slab-${level}`])
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
  for (const w of phys.filter((x) => !x.pierM)) {
    for (const [end, at] of [['START', w.a], ['END', w.b]] as const) {
      const hit = phys
        .filter((x) => !x.pierM)
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
    const mine = phys.filter((w) => w.body.id === b.id && !w.pierM)
    const piers = phys.filter((w) => w.body.id === b.id && w.pierM)
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
    // the returns: solid, as thick as their step is deep, under the same roof; they meet the ring at its outer face
    for (const w of piers) {
      // v3.54.8: a return a gable frame's plate stands in is the frame's leg: one solid there, not a wall inside a plate
      if (framedPiers.has(w.id)) {
        used(`geometry.bodies[${b.id}].outline`, 'houseProgram/returns(the frame plate is the leg)', [w.id])
        continue
      }
      push({ type: 'createWall', id: w.id, levelId: base.id, start: w.a, end: w.b, thickness: w.pierM as number, height, baseOffset: 0, kind: 'EXTERIOR', topProfile, materialId: MATERIALS_V2.wall })
      used(`geometry.bodies[${b.id}].outline`, 'houseProgram/returns', [w.id])
    }
    wallIdsOf.set(b.id, [...mine, ...piers.filter((w) => !framedPiers.has(w.id))].map((w) => w.id))
    used(`geometry.bodies[${b.id}].storeys`, 'houseProgram/walls', mine.map((w) => w.id))
  }
  // --- v3.54.9: the interior, as the resolver placed it (partitions per level, their doors, rooms, stairs) -----------
  const interior = g.interior
  if (interior && (interior.status === 'BUILT' || interior.status === 'PARTIAL')) {
    push({ type: 'defineMaterial', id: MATERIALS_V2.partition, name: 'Partition', color: '#d9d5cc' })
    for (const lv of interior.levels) {
      const l = levelAt.get(lv.level)
      if (!l) continue
      const above = [...levelAt.entries()].filter(([k]) => k > lv.level).sort((p, q) => p[0] - q[0])[0]?.[1]
      for (const w of lv.walls) {
        const mid = pt((w.a.x + w.b.x) / 2, (w.a.z + w.b.z) / 2)
        // under the floor above where there is one over it; on a top storey, up to its body's roof planes
        const body = bodies.find((b) => b.storeys.includes(lv.level) && contains(b.poly, mid))
        const topHere = !body || Math.max(...body.storeys) === lv.level
        const own = body ? planesOf.get(body.id) ?? [] : []
        const ridge = body ? ridgeOf.get(body.id) : undefined
        const underRoof = topHere && own.length > 0 && ridge !== undefined && body?.roof.kind !== 'FLAT'
        const height = underRoof ? r6((ridge as number) - l.elevation + OVER_RIDGE_M) : above ? r6(above.elevation - l.elevation - slabT) : r6(l.height)
        if (height < 1) {
          refuse(`geometry.interior.levels[${lv.level}].walls[${w.id}]`, 'REPRESENTATION_LIMIT', `${height.toFixed(2)} m of room under the floor above: not a partition`)
          continue
        }
        push({ type: 'createWall', id: w.id, levelId: l.id, start: pt(w.a.x, w.a.z), end: pt(w.b.x, w.b.z), thickness: r6(w.thickness), height, baseOffset: 0, kind: 'INTERIOR', ...(underRoof ? { topProfile: { kind: 'FOLLOW_ROOF_PLANES' as const, planeIds: own.map((p) => p.id) } } : {}), materialId: MATERIALS_V2.partition })
        for (const d of lv.doors.filter((x) => x.wallId === w.id)) {
          const dh = Math.min(d.height, r6(height - 0.1))
          push({ type: 'cutOpening', id: d.id, wallId: w.id, kind: 'DOOR', offset: r6(d.offset), sill: 0, width: r6(d.width), height: r6(dh) })
          push({ type: 'placeDoor', id: `${d.id}-leaf`, openingId: d.id, frameDepth: r6(Math.min(0.1, w.thickness * 0.6)), frameInset: 0.01, leafThickness: r6(Math.min(0.045, w.thickness * 0.3)), materialId: MATERIALS_V2.timber })
        }
      }
      used(`geometry.interior.levels[${lv.level}].walls`, 'houseProgram/interior(createWall INTERIOR)', lv.walls.map((w) => w.id))
      if (lv.doors.length) used(`geometry.interior.levels[${lv.level}].doors`, 'houseProgram/interior(cutOpening DOOR)', lv.doors.map((d) => d.id))
      for (const r of lv.rooms) push({ type: 'createRoom', id: r.id, levelId: l.id, polygon: r.polygon.map((q) => pt(r6(q.x), r6(q.z))), ...(r.holes && r.holes.length ? { holes: r.holes.map((h) => h.map((q) => pt(r6(q.x), r6(q.z)))) } : {}), ...(r.usage ? { usage: r.usage } : {}) })
      if (lv.rooms.length) used(`geometry.interior.levels[${lv.level}].rooms`, 'houseProgram/interior(createRoom)', lv.rooms.map((r) => r.id))
      for (const st of lv.stairs) {
        const top = levelAt.get(st.toLevel)
        if (!top) continue
        push({ type: 'createStair', id: st.id, levelId: l.id, toLevelId: top.id, start: pt(r6(st.start.x), r6(st.start.z)), direction: st.direction, width: r6(st.width), ...(st.waist ? { waist: st.waist } : {}), ...(st.footprint ? { footprint: st.footprint } : {}), segments: st.segments })
        used(`geometry.interior.levels[${lv.level}].stairs`, 'houseProgram/interior(createStair)', [st.id])
      }
    }
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
    // v3.54.7: under a raked or pointed head a door is cut and filled as fixed glazing (a leaf takes a level head only)
    const glazedHead = !!o.head && o.kind !== 'GARAGE_DOOR'
    const frame = { frameDepth: r6(Math.min(0.12, T * 0.4)), frameInset: r6(Math.min(0.1, T * 0.25)) }
    // v3.54.10 — the divisions READ on the elevation (profiles between panes) when the reading gives them; else the
    // sashes the reading boxed as one hole; only with neither, a convention (one pane per 0.9 m), said as one
    const readDiv = o.divisions?.basis === 'READ' ? o.divisions : undefined
    const panes = readDiv ? readDiv.mullions.length + 1 : Math.max(1, o.panes ?? Math.round(width / 0.9))
    const fractions = readDiv && readDiv.mullions.length > 0 ? [0, ...readDiv.mullions, 1].slice(1).map((f, i, all) => r6(f - (i === 0 ? 0 : all[i - 1]))) : undefined
    if (!readDiv && o.panes === undefined && o.kind !== 'DOOR' && o.kind !== 'GARAGE_DOOR') used(`${path}.divisions`, `${panes} pane(s) by convention (one per 0.9 m of width): the reading gives no divisions`, [o.id])
    else if (readDiv) used(`${path}.divisions`, `${panes} pane(s) as read (${readDiv.how})${fractions && o.kind === 'WINDOW' && fractions.some((f) => Math.abs(f - 1 / panes) > 0.1) ? '; the kernel spaces window panes evenly: the read positions are an approximation in a window' : ''}`, [o.id])
    // v3.54.7 — the head as the elevation draws it: RAKED is one trapezoid; POINTED is two raked halves beside a mullion
    // (the kernel's head is one straight line): the halves are `<id>` and `<id>--b`, one opening in the record
    const fill = (id: string, w: number): void => {
      const pn = Math.max(1, Math.round((panes * w) / Math.max(width, 0.01)))
      // v3.54.7: a door leaf takes a level head only — under a raked or pointed head the hole is filled with fixed
      // glazing (the opening's kind is kept; how it opens is not modelled)
      if (o.kind === 'WINDOW' || glazedHead) push({ type: 'placeWindow', id: `${id}-window`, openingId: id, ...frame, divisions: pn, materialId: MATERIALS_V2.glass })
      else if (o.kind === 'GARAGE_DOOR') push({ type: 'placeDoor', id: `${id}-leaf`, openingId: id, ...frame, assembly: { panels: [{ kind: 'PANEL', fraction: 1 }], mullionWidth: 0.04 }, usage: 'GARAGE', materialId: MATERIALS_V2.gate })
      else if (o.kind === 'GLAZED_DOOR') push({ type: 'placeDoor', id: `${id}-leaf`, openingId: id, ...frame, assembly: { panels: fractions && w === width ? fractions.map((f) => ({ kind: 'GLAZED' as const, fraction: f })) : Array.from({ length: pn }, () => ({ kind: 'GLAZED' as const, fraction: 1 / pn })), mullionWidth: 0.04 }, materialId: MATERIALS_V2.glass })
      else push({ type: 'placeDoor', id: `${id}-leaf`, openingId: id, ...frame, materialId: MATERIALS_V2.timber })
    }
    const off = r6(q.from - q.s0)
    const hd = o.head
    const far = hd?.kind === 'RAKED' ? need(hd.heightFarM, `${path}.head.heightFarM`) : undefined
    const apexAt = hd?.kind === 'POINTED' ? need(hd.apexAtM, `${path}.head.apexAtM`) : undefined
    const apex = hd?.kind === 'POINTED' ? need(hd.apexM, `${path}.head.apexM`) : undefined
    const ids = [o.id, door && !glazedHead ? `${o.id}-leaf` : `${o.id}-window`]
    // the head's shape over what was cut (a trim at a corner keeps its slope: heights at the cut ends are on the read line)
    const hAt = (along: number): number => (hd?.kind === 'RAKED' && far !== undefined ? q.height + ((far - q.height) * (along - (q.agreedFrom - q.s0))) / q.agreedWidth : q.height)
    const m = OPENING_FIT.pierM
    if (hd?.kind === 'POINTED' && apexAt !== undefined && apex !== undefined && apexAt - m / 2 > 0.3 && q.agreedWidth - apexAt - m / 2 > 0.3 && Math.abs(width - q.agreedWidth) < 1e-6) {
      const w1 = r6(apexAt - m / 2)
      const w2 = r6(q.agreedWidth - apexAt - m / 2)
      const at1 = q.height + ((apex - q.height) * w1) / apexAt
      const at2 = q.height + ((apex - q.height) * w2) / (q.agreedWidth - apexAt)
      push({ type: 'cutOpening', id: o.id, wallId: q.w.id, kind: door && !glazedHead ? 'DOOR' : 'WINDOW', offset: off, sill: q.sillOnWall, width: w1, height: r6(q.height), head: { kind: 'RAKED', heightFar: r6(at1) } })
      fill(o.id, w1)
      push({ type: 'cutOpening', id: `${o.id}--b`, wallId: q.w.id, kind: door && !glazedHead ? 'DOOR' : 'WINDOW', offset: r6(off + w1 + m), sill: q.sillOnWall, width: w2, height: r6(at2), head: { kind: 'RAKED', heightFar: r6(q.height) } })
      fill(`${o.id}--b`, w2)
      ids.push(`${o.id}--b`)
      approximated.push({ id: o.id, what: `a pointed head drawn as two raked halves beside a ${m.toFixed(2)} m mullion (the kernel's head is one straight line); the apex ${apex.toFixed(2)} m above the sill is not cut: the halves rise to ${at1.toFixed(2)} and ${at2.toFixed(2)} m` })
      used(`${path}.head`, 'houseProgram/cutOpening(POINTED as two RAKED)', [o.id, `${o.id}--b`])
    } else {
      const head = hd?.kind === 'RAKED' && far !== undefined ? { kind: 'RAKED' as const, heightFar: r6(hAt(off + width)) } : undefined
      push({ type: 'cutOpening', id: o.id, wallId: q.w.id, kind: door && !glazedHead ? 'DOOR' : 'WINDOW', offset: off, sill: q.sillOnWall, width: r6(width), height: r6(head ? hAt(off) : q.height), ...(head ? { head } : {}) })
      fill(o.id, width)
      if (hd?.kind === 'RAKED') used(`${path}.head`, 'houseProgram/cutOpening(RAKED)', [o.id])
      if (hd?.kind === 'POINTED') refuse(`${path}.head`, 'REPRESENTATION_LIMIT', 'a pointed head too narrow for two halves and a mullion, or trimmed at a corner: cut with a level head at its sides\' height')
    }
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
    const r = balconyRect.get(b.id) ?? b.rect
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
      // (v3.54.8: the railing guards the slab as read — a slab carried on under a frame leg is not guarded through the leg)
      const rr = balconyRail.get(b.id) ?? b.rect
      const corners = [pt(rr.x0, rr.z0), pt(rr.x1, rr.z0), pt(rr.x1, rr.z1), pt(rr.x0, rr.z1)]
      const mids = corners.map((c, i) => ({ x: (c.x + corners[(i + 1) % 4].x) / 2, z: (c.z + corners[(i + 1) % 4].z) / 2 }))
      const free = mids.map((m) => !(contains(outer, m) || onBoundary(outer, m, 0.06) >= 0))
      if (free.every(Boolean) && outer.length >= 3) {
        // v3.54.8: no edge lies on the house (the slab was read clear of the wall): the edge nearest the wall is the
        // house side — a railing all round would be a cage, none at all loses the railing the source shows. Said.
        const gap = mids.map((m) => Math.min(...outer.map((a, i) => toSegment(m, a, outer[(i + 1) % outer.length]).d)))
        const near = gap.indexOf(Math.min(...gap))
        free[near] = false
        builderNotes.push({ code: 'BALCONY_OFF_THE_WALL', what: `${b.id}: no edge of its slab lies on the house — ${gap[near].toFixed(2)} m from the wall at the nearest; that edge is taken as the house side and the railing runs round the other three` })
      }
      const start = free.findIndex((f, i) => f && !free[(i + 3) % 4])
      if (start >= 0) {
        const pathPts: P2[] = [corners[start]]
        for (let k = 0; k < 4 && free[(start + k) % 4]; k += 1) pathPts.push(corners[(start + k + 1) % 4])
        if (pathPts.length >= 2) {
          // v3.54.8 — the infill the source shows (GLASS stays glass); a SOLID parapet is drawn without infill and said;
          // not known: the kernel's convention (bars), said, never written back as if read
          const kind = b.railingInfill?.value ?? null
          const infill = kind === 'GLASS' ? 'GLASS' : kind === 'BARS' ? 'BARS' : kind === 'NONE' || kind === 'SOLID' ? 'NONE' : 'BARS'
          if (kind === null) builderNotes.push({ code: 'RAILING_INFILL_ASSUMED', what: `${b.id}: its railing's infill is not read; drawn as bars (a convention, not the source)` })
          if (kind === 'SOLID') builderNotes.push({ code: 'RAILING_SOLID_AS_OPEN', what: `${b.id}: a solid parapet is read; the kernel's railing has no solid infill — drawn as rails without infill` })
          const railH = b.railingHeightM?.value ?? 1.1
          push({ type: 'createRailing', id: `${b.id}-railing`, levelId: l.id, start: pathPts[0], end: pathPts[pathPts.length - 1], path: pathPts, baseOffset: r6(topY - l.elevation), height: r6(railH), infill, hostId: b.id, materialId: infill === 'GLASS' ? MATERIALS_V2.glass : MATERIALS_V2.member })
          ids.push(`${b.id}-railing`)
          used(`${path}.railingInfill`, `houseProgram/createRailing(infill ${infill})`, [`${b.id}-railing`])
          if (b.railingHeightM) used(`${path}.railingHeightM`, 'houseProgram/createRailing', [`${b.id}-railing`], b.railingHeightM)
        }
      }
    }
    used(`${path}.rect`, 'houseProgram/createBalcony', ids)
    used(`${path}.topY`, 'houseProgram/createBalcony', ids, b.topY)
  }
  // --- v3.54.8: portal bands — one head over an open front, along the outer plane from its soffit to its top and back
  // over the recess it heads. Where a balcony slab already stands in the band's height the band stops under it (one
  // solid in one place): the slab's own edge is the band there.
  // v3.54.10/11: the style-profile materials defined so far (a finish zone's, an element finish's), each defined once
  const zoneMats = new Set<string>()
  for (const pb of g.portals ?? []) {
    const path = `geometry.portals[${pb.id}]`
    const top = need(pb.topY, `${path}.topY`)
    const soffit = need(pb.soffitY, `${path}.soffitY`)
    const depth = need(pb.depthM, `${path}.depthM`)
    const l0 = levelAt.get(0)
    if (top === undefined || soffit === undefined || depth === undefined || !l0) continue
    const n = SIDE_N[pb.side]
    const len = Math.hypot(pb.end.x - pb.start.x, pb.end.z - pb.start.z)
    if (len < 0.3 || !n) {
      refuse(path, 'PARSE_REJECTED', 'a portal band shorter than 0.3 m')
      continue
    }
    const u = { x: (pb.end.x - pb.start.x) / len, z: (pb.end.z - pb.start.z) / len }
    const alongOf = (q: P2): number => (q.x - pb.start.x) * u.x + (q.z - pb.start.z) * u.z
    // stretches under a balcony slab whose underside is inside the band: the band's top there is the slab's underside
    const cuts: Array<{ a: number; b: number; top: number }> = []
    for (const b of g.balconies) {
      const r = balconyRect.get(b.id) ?? b.rect
      const ty = b.topY.value
      const th = b.thicknessM.value ?? 0.2
      if (ty === null || ty - th > top || ty < soffit) continue
      const a = [alongOf(pt(r.x0, r.z0)), alongOf(pt(r.x1, r.z1)), alongOf(pt(r.x0, r.z1)), alongOf(pt(r.x1, r.z0))]
      const v = Math.min(...[pt(r.x0, r.z0), pt(r.x1, r.z1)].map((q) => -((q.x - pb.start.x) * n.x + (q.z - pb.start.z) * n.z)))
      if (v > depth + 0.05) continue
      cuts.push({ a: Math.max(0, Math.min(...a)), b: Math.min(len, Math.max(...a)), top: ty - th })
    }
    // (v3.54.8: likewise under a flat roof whose underside is inside the band — a garage's roof slab edge is the band's
    // upper part there, not a second surface in the same place)
    for (const pl of planes) {
      if (Math.abs(pl.pitchDeg) > 1e-6) continue
      const under = pl.datum.y - pl.thickness
      if (under >= top || under <= soffit) continue
      const vs = pl.boundary.map((q) => -((q.x - pb.start.x) * n.x + (q.z - pb.start.z) * n.z))
      // (a roof that only touches the band's back face is beside it, not in it)
      if (Math.min(...vs) > depth - 0.05 || Math.max(...vs) < 0.05) continue
      // only where the roof covers the band's own footprint (its middle line): a roof that reaches the plane over a
      // return and steps back elsewhere covers the band over the return alone
      const at = (s0: number): P2 => pt(pb.start.x + u.x * s0 - n.x * (depth / 2), pb.start.z + u.z * s0 - n.z * (depth / 2))
      let run: number | null = null
      for (let s0 = 0; s0 <= len + 1e-9; s0 += 0.05) {
        const inside = contains(pl.boundary, at(Math.min(s0, len)))
        if (inside && run === null) run = s0
        if ((!inside || s0 + 0.05 > len + 1e-9) && run !== null) {
          const end = inside ? len : s0
          if (end - run >= 0.05) cuts.push({ a: Math.max(0, run - 0.025), b: Math.min(len, end), top: under })
          run = null
        }
      }
    }
    // (and none where the ground plan's outline stands under its footprint: there a wall (a return) is the head's face)
    {
      const ground = outlineAt.get(0) ?? []
      const mid = (s0: number): P2 => pt(pb.start.x + u.x * s0 - n.x * (depth / 2), pb.start.z + u.z * s0 - n.z * (depth / 2))
      let run: number | null = null
      for (let s0 = 0; s0 <= len + 1e-9; s0 += 0.05) {
        const inside = ground.length >= 3 && contains(ground, mid(Math.min(s0, len)))
        if (inside && run === null) run = s0
        if ((!inside || s0 + 0.05 > len + 1e-9) && run !== null) {
          const end = inside ? len : s0
          if (end - run >= 0.05) cuts.push({ a: Math.max(0, run - 0.025), b: Math.min(len, end), top: soffit })
          run = null
        }
      }
    }
    const marks = [...new Set([0, len, ...cuts.flatMap((c) => [c.a, c.b])])].filter((x) => x >= 0 && x <= len).sort((p, q) => p - q)
    const ids: string[] = []
    // v3.54.11 — the band's own finish where a source zone gives it one; otherwise the light member it was
    let bandMat: string = MATERIALS_V2.member
    if (pb.finish) {
      const fm = styleMaterial(pb.finish.material, pb.finish.tone)
      if (!zoneMats.has(fm.id)) {
        push({ type: 'defineMaterial', id: fm.id, name: fm.name, color: fm.color })
        zoneMats.add(fm.id)
      }
      bandMat = fm.id
    }
    for (let i = 0; i + 1 < marks.length; i += 1) {
      const a = marks[i]
      const b2 = marks[i + 1]
      if (b2 - a < 0.05) continue
      const mid = (a + b2) / 2
      const under = cuts.filter((c) => mid > c.a && mid < c.b).map((c) => c.top)
      const t = under.length ? Math.min(top, ...under) : top
      if (t - soffit < 0.05) continue
      const yc = (t + soffit) / 2
      const at = (s0: number): { x: number; y: number; z: number } => ({ x: r6(pb.start.x + u.x * s0 - n.x * (depth / 2)), y: r6(yc), z: r6(pb.start.z + u.z * s0 - n.z * (depth / 2)) })
      const id = `${pb.id}-${ids.length + 1}`
      push({ type: 'createLinearSolid', id, levelId: l0.id, start: at(a), end: at(b2), width: r6(t - soffit), depth: r6(depth), role: 'FASCIA', materialId: bandMat })
      ids.push(id)
    }
    if (ids.length === 0) {
      refuse(path, 'REPRESENTATION_LIMIT', 'nothing of the band is left outside the slabs that stand in it')
      continue
    }
    used(`${path}.topY`, 'houseProgram/portalBand', ids, pb.topY)
    used(`${path}.soffitY`, 'houseProgram/portalBand', ids, pb.soffitY)
    used(`${path}.depthM`, 'houseProgram/portalBand', ids, pb.depthM)
    if (pb.finish) used(`${path}.finish`, `houseProgram/portalBand material ${bandMat} (${STYLE_PROFILE.id}) on the whole member`, ids)
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
  // v3.54.10 — finish zones: surface regions on the walls' outer faces in the style profile's colours. A surface only:
  // no wall, body or room is added, and the openings stay cut through it.
  for (const z of g.zones ?? []) {
    const path = `geometry.zones[${z.id}]`
    const h = hosts.find((x) => x.id === z.hostWall)
    if (!h) {
      refuse(path, 'WRONG_BINDING', `host wall ${z.hostWall} is not a built wall`)
      continue
    }
    const a0 = Math.max(0, Math.min(z.a0, z.a1))
    const a1 = Math.min(h.len, Math.max(z.a0, z.a1))
    // a zone along a host may run over more than one built wall (a front over the house and the garage): one region per
    // wall, each cut to that wall's extent and to its height (a zone never reaches above the wall it is on)
    const mat = styleMaterial(z.material, z.tone)
    let start = a0
    let k = 0
    const made: string[] = []
    let steps = 0
    while (a1 - start > 0.1 && k < 6 && steps < 2000) {
      steps += 1
      const under = wallUnder(h, start, Math.min(a1, start + 0.2))
      // a stretch of the host edge with no wall built under it (a return, a recess behind a portal) is passed over
      if (!under) {
        start += 0.05
        continue
      }
      const s0 = Math.max(start, under.s0)
      const s1 = Math.min(a1, under.s1)
      start = under.s1 + 1e-3
      k += 1
      const l = levelAt.get(Math.min(...under.w.body.storeys))
      const wc = program.find((c) => c.type === 'createWall' && c.id === under.w.id) as { height?: number; topProfile?: unknown } | undefined
      const profileTop = Array.isArray((wc?.topProfile as { points?: unknown })?.points) ? Math.max(...((wc?.topProfile as { points: Array<{ y?: number }> }).points.map((p) => p.y ?? 0))) : undefined
      const top = Math.max(wc?.height ?? Number.POSITIVE_INFINITY, profileTop ?? 0)
      if (!l || s1 - s0 < 0.1) continue
      const b0 = Math.max(0, z.b0 - l.elevation)
      const b1 = Math.min(top, z.b1 - l.elevation)
      if (b1 - b0 < 0.1) continue
      if (!zoneMats.has(mat.id)) {
        push({ type: 'defineMaterial', id: mat.id, name: mat.name, color: mat.color })
        zoneMats.add(mat.id)
      }
      const id = k === 1 ? z.id : `${z.id}-${k}`
      push({ type: 'createSurfaceRegion', id, hostId: under.w.id, face: 'OUTER', rect: { a0: r6(s0 - under.s0), a1: r6(s1 - under.s0), b0: r6(b0), b1: r6(b1) }, materialId: mat.id })
      made.push(`${id} on ${under.w.id}`)
    }
    if (made.length === 0) refuse(path, 'WRONG_BINDING', `no built wall stands under ${a0.toFixed(2)}..${a1.toFixed(2)} m of ${h.id} with height for the zone`)
    else used(path, `createSurfaceRegion ${made.join(', ')} in ${mat.name} (${STYLE_PROFILE.id})`, made.map((m) => m.split(' ')[0]))
  }
  return { program, trace, refusals, planes: planesOut, hostWalls, approximated, builderNotes, fits }
}

/**
 * v3.54.10 — the presentation style a finish zone's material and tone map to: a small fixed palette, one colour per
 * role, the same on every side (never the colour of a photograph's light). A tone not read is a named neutral.
 */
export const STYLE_PROFILE = { id: 'low-poly@1', neutral: '#cfcac1' } as const
export function styleMaterial(material: string, tone: string): { id: string; name: string; color: string } {
  const id = `mat-zone-${material.toLowerCase()}-${tone.toLowerCase()}`
  const wood = material === 'WOOD' || tone === 'WARM'
  const color = wood
    ? '#b07a4a'
    : tone === 'DARK'
      ? material === 'METAL' || material === 'BOARD_CLADDING' ? '#3b3d40' : '#3a3a3c'
      : material === 'STONE' ? '#a39d92' : material === 'BRICK' ? '#9c5a43' : tone === 'MID' ? '#8e8983' : tone === 'LIGHT' ? '#ece9e2' : STYLE_PROFILE.neutral
  const name = wood ? 'Timber cladding' : `${tone === 'UNKNOWN' ? 'Neutral (tone not read)' : tone.charAt(0) + tone.slice(1).toLowerCase()} ${material.toLowerCase().replace('_', ' ')}`
  return { id, name, color }
}

export type { HouseGeometry, HouseBody }
export { canonical as canonicalOutline }
