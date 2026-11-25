/**
 * v3.54.20 — what was BUILT, read back from the delivered model and held against what was agreed.
 *
 * Every property the pipeline takes has a road: observation → agreed value and host → command → element of the delivered
 * model. The executor records the middle of it (the proposal, the bound values, the commands). This module walks the end:
 * it reads the element's real position and size out of the delivered model, in a frame it states, and compares it with
 * the values the executor bound — so "the opening was built" is a measurement of the model, not the record of a command.
 *
 * The opening's frame (stated once, used for every opening):
 *  - the HOST is a real wall segment of the delivered model (`wallId`), its length the distance of its two ends;
 *  - `fromStartM` is measured along the wall's outer-face line from the wall's START corner to the opening's nearer edge,
 *    `toEndM` from its farther edge to the wall's END corner — so fromStartM + widthM + toEndM = wallLengthM, checked;
 *  - `startIs` says which hand the START corner is on for a person standing OUTSIDE looking at that wall (LEFT or
 *    RIGHT), so two opposite elevations cannot swap an offset silently;
 *  - `sillM` is above the FLOOR of the wall's own level (not above the ground, not an absolute level); `sillAboveZeroM`
 *    is the same edge above the model's ±0.00; `headM` = sillM + heightM;
 *  - the size is the STRUCTURAL opening the wall is cut with (the kernel's `cutOpening`), not a frame or a pane.
 * Nothing here estimates: a value the executor did not bind is absent, never filled in.
 */
import type { CanonicalBuildingModel } from '@buildapp/model'

export const READBACK_VERSION = '1.1.0' as const
/** A built value agrees with the bound one within this (metres): the executor rounds to a micrometre, the kernel does not move an opening. */
export const READBACK_TOLERANCE_M = 0.005

export type BoundOpening = { ids: readonly string[]; hostId?: string; side?: string; frameId?: string; values?: Record<string, number>; operation?: string; origin?: string; proposalId?: string }
export type OpeningReadback = {
  id: string
  kind: string
  wallId: string
  wallLengthM: number
  levelId: string
  fromStartM: number
  widthM: number
  toEndM: number
  /** fromStartM + widthM + toEndM − wallLengthM (0 within the tolerance, by construction of the frame — a check of the model, not of the source) */
  sumErrorM: number
  startIs: 'LEFT' | 'RIGHT' | 'UNKNOWN'
  sillM: number
  heightM: number
  headM: number
  sillAboveZeroM: number
  /** the proposal that built it, where a committed record names this element */
  bound?: { operation?: string; origin?: string; proposalId?: string; side?: string; frameId?: string; offset?: number; width?: number; sill?: number; height?: number }
  /** built minus bound, per property the record bound (absent where it bound none) */
  delta?: { offset?: number; width?: number; sill?: number; height?: number }
  agrees: boolean | null
}
export type OpeningsReadback = { version: string; frame: string; openings: OpeningReadback[]; counts: { built: number; bound: number; agree: number; differ: number; unbound: number; sumFailures: number; outsideWall: number } }

const r3 = (v: number): number => Math.round(v * 1000) / 1000

/**
 * The hand the wall's START corner is on for someone outside looking at the wall.
 * readback 1.1.0: inside and outside are told by the wall's OWN ring — a point a hair off the wall's middle, on one side
 * of it, is inside the ring's polygon or it is not. (1.0.0 asked the centroid of all exterior walls: on an L-shaped ring
 * the two walls of the notch have that centroid on their OUTER side, and their start was named on the wrong hand.) A wall
 * that belongs to no ring falls back to the centroid of the exterior walls of its level, named UNKNOWN when that is on the line.
 */
function startHand(m: CanonicalBuildingModel, w: CanonicalBuildingModel['walls'][number]): 'LEFT' | 'RIGHT' | 'UNKNOWN' {
  const [dx, dz] = [w.end.x - w.start.x, w.end.z - w.start.z]
  const len = Math.hypot(dx, dz)
  if (!(len > 0)) return 'UNKNOWN'
  const mid = { x: (w.start.x + w.end.x) / 2, z: (w.start.z + w.end.z) / 2 }
  // the body's frame: x grows to the right of a person outside looking at the FRONT (z = 0), z away from them. The front
  // wall from (0,0) to (10,0) has the inside at z > 0, on the side of n = (−dz, dx): its START (x = 0) is on that person's LEFT.
  const n = { x: -dz / len, z: dx / len }
  const ring = m.wallRings.find((r) => r.wallIds.includes(w.id))
  const byId = new Map(m.walls.map((q) => [q.id, q]))
  const poly = ring ? ring.wallIds.map((id) => byId.get(id)?.start).filter((q): q is { x: number; z: number } => !!q) : []
  if (poly.length >= 3) {
    const inside = (q: { x: number; z: number }): boolean => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) if (poly[i].z > q.z !== poly[j].z > q.z && q.x < ((poly[j].x - poly[i].x) * (q.z - poly[i].z)) / (poly[j].z - poly[i].z) + poly[i].x) c = !c; return c }
    const eps = Math.min(0.05, len / 4)
    const [a, b] = [inside({ x: mid.x + n.x * eps, z: mid.z + n.z * eps }), inside({ x: mid.x - n.x * eps, z: mid.z - n.z * eps })]
    if (a !== b) return a ? 'LEFT' : 'RIGHT'
  }
  const ext = m.walls.filter((q) => q.kind === 'EXTERIOR' && q.levelId === w.levelId)
  if (ext.length < 3) return 'UNKNOWN'
  const cx = ext.reduce((t, q) => t + (q.start.x + q.end.x) / 2, 0) / ext.length
  const cz = ext.reduce((t, q) => t + (q.start.z + q.end.z) / 2, 0) / ext.length
  const side = n.x * (cx - mid.x) + n.z * (cz - mid.z)
  if (Math.abs(side) < 1e-9) return 'UNKNOWN'
  return side > 0 ? 'LEFT' : 'RIGHT'
}

export function readbackOpenings(m: CanonicalBuildingModel, records: ReadonlyArray<{ status?: string; operation?: string; origin?: string; proposalId?: string; bound?: BoundOpening }>): OpeningsReadback {
  const exterior = new Map(m.walls.filter((w) => w.kind === 'EXTERIOR').map((w) => [w.id, w]))
  const byId = new Map<string, { operation?: string; origin?: string; proposalId?: string; bound: BoundOpening }>()
  // the LAST committed record that names an element is the one whose values it carries
  for (const r of records) if (r.status === 'COMMITTED' && r.bound?.values) for (const id of r.bound.ids) byId.set(id, { ...(r.operation ? { operation: r.operation } : {}), ...(r.origin ? { origin: r.origin } : {}), ...(r.proposalId ? { proposalId: r.proposalId } : {}), bound: r.bound })
  const openings: OpeningReadback[] = []
  for (const o of m.openings) {
    const w = exterior.get(o.wallId)
    if (!w) continue
    const len = Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z)
    const level = m.levels.find((l) => l.id === w.levelId)
    const toEnd = len - o.offset - o.width
    const rec = byId.get(o.id)
    const v = rec?.bound.values
    const bound = rec ? { ...(rec.operation ? { operation: rec.operation } : {}), ...(rec.origin ? { origin: rec.origin } : {}), ...(rec.proposalId ? { proposalId: rec.proposalId } : {}), ...(rec.bound.side ? { side: rec.bound.side } : {}), ...(rec.bound.frameId ? { frameId: rec.bound.frameId } : {}), ...(v?.offset !== undefined ? { offset: v.offset } : {}), ...(v?.width !== undefined ? { width: v.width } : {}), ...(v?.sill !== undefined ? { sill: v.sill } : {}), ...(v?.height !== undefined ? { height: v.height } : {}) } : undefined
    const delta = v ? { ...(v.offset !== undefined ? { offset: r3(o.offset - v.offset) } : {}), ...(v.width !== undefined ? { width: r3(o.width - v.width) } : {}), ...(v.sill !== undefined ? { sill: r3(o.sill - v.sill) } : {}), ...(v.height !== undefined ? { height: r3(o.height - v.height) } : {}) } : undefined
    const agrees = delta ? Object.values(delta).every((d) => Math.abs(d) <= READBACK_TOLERANCE_M) : null
    openings.push({ id: o.id, kind: o.kind, wallId: w.id, wallLengthM: r3(len), levelId: w.levelId, fromStartM: r3(o.offset), widthM: r3(o.width), toEndM: r3(toEnd), sumErrorM: r3(o.offset + o.width + toEnd - len), startIs: startHand(m, w), sillM: r3(o.sill), heightM: r3(o.height), headM: r3(o.sill + o.height), sillAboveZeroM: r3((level?.elevation ?? 0) + w.baseOffset + o.sill), ...(bound ? { bound } : {}), ...(delta ? { delta } : {}), agrees })
  }
  const counts = { built: openings.length, bound: openings.filter((q) => q.bound).length, agree: openings.filter((q) => q.agrees === true).length, differ: openings.filter((q) => q.agrees === false).length, unbound: openings.filter((q) => !q.bound).length, sumFailures: openings.filter((q) => Math.abs(q.sumErrorM) > READBACK_TOLERANCE_M).length, outsideWall: openings.filter((q) => q.fromStartM < -READBACK_TOLERANCE_M || q.toEndM < -READBACK_TOLERANCE_M).length }
  return { version: READBACK_VERSION, frame: 'fromStartM along the host wall\'s outer-face line from its START corner; startIs = the hand that corner is on seen from OUTSIDE; sillM above the floor of the wall\'s level; sizes are the structural opening (metres)', openings, counts }
}

export type RoofReadback = {
  /** the roof region's identity: `roof-<body>` over a ring, `roof-<body>-cross-<side>` for a cross gable on its walls */
  id: string
  hostId: string
  stated: 'ROOF' | 'PLANES'
  roof: 'GABLE' | 'HIP' | 'FLAT'
  ridgeAxis?: 'X' | 'Z'
  /** measured on the element: a parametric roof's own pitch, or the pitch of the planes along the ridge */
  pitchDeg?: number
  /** the roof's top surface at the wall face along its eaves, and the wall top under it (metres above ±0.00) */
  eavesM?: number
  wallTopM?: number
  /** the highest point of the roof's top surface (metres above ±0.00) */
  ridgeM?: number
  planeIds: string[]
}
export type JoinReadback = { kind: string; edgeId: string; roofs: [string, string] | [string]; startM: number; endM: number; lengthM: number }
export type StructureReadback = {
  version: string
  bodies: Array<{ id: string; widthM: number; depthM: number; roof: 'GABLE' | 'HIP' | 'FLAT' | 'NONE'; ridgeAxis?: 'X' | 'Z'; pitchDeg?: number; wallTopM?: number; ridgeM?: number }>
  /** readback 1.1.0: every roof region of the delivered model, measured — not only the roof of the largest rectangle */
  roofs: RoofReadback[]
  /** readback 1.1.0: the creases and abutments between the roofs of a roof system, read off the model's roof edges */
  joins: JoinReadback[]
  /** what the agreed structure asked for, beside what the delivered model has */
  checks: Array<{ property: string; taken: string; built: string; agrees: boolean; residual?: number }>
}
/** A built number is the taken one within these (readback 1.1.0): the tolerances the body builder itself agrees heights and pitches by. */
export const STRUCTURE_READBACK_TOLERANCES = { pitchDeg: 3, heightM: 0.35, heightShare: 0.08 } as const
export type BoundRoofs = {
  /** each body the builder solved, with what it took for its roof and what became of each taken property */
  bodies: ReadonlyArray<{ id: string; describes?: string; roof: { kind: string; ridgeAxis?: 'X' | 'Z'; pitchDeg?: number; eavesM: number; ridgeM?: number }; fates?: ReadonlyArray<{ property: string; fate: string; taken?: string; built?: string; residual?: number; why: string }> }>
  crossRoofs?: ReadonlyArray<{ id: string; over: string; ridgeAxis: 'X' | 'Z'; eavesM: number; ridgeM: number; pitchDeg: number }>
  /** how the solver said the roofs meet (`roofSystemOf`): the relations the delivered model must show */
  relations?: ReadonlyArray<{ a: string; b: string; kind: string }>
}

const planeTop = (p: CanonicalBuildingModel['roofPlanes'][number], q: { x: number; z: number }): number => p.datum.y - Math.tan((p.pitchDeg * Math.PI) / 180) * ((q.x - p.datum.x) * p.downslope.x + (q.z - p.datum.z) * p.downslope.z)
/** The roof region a plane belongs to, by its stable name: `<region>-<side it drains to>[-<piece>]`. */
export const regionOfPlane = (planeId: string): string => planeId.replace(/-(minX|maxX|minZ|maxZ)(-\d+)?$/, '')

/**
 * The body the MAIN roof's description is of: the one the builder bound it to (its record of fates), else the largest.
 * One rule for the readback and for the arbitration — a description held against the largest rectangle where the builder
 * bound it to another body by that body's own views would contradict a body for doing what the sources say.
 */
export function mainBodyOf<B extends { id: string; widthM: number; depthM: number }>(bodies: readonly B[], bound?: BoundRoofs): B | undefined {
  const largest = [...bodies].sort((a, b) => b.widthM * b.depthM - a.widthM * a.depthM)[0]
  if (!bound || bound.bodies.length < 2) return largest
  const stated = bound.bodies.find((b) => b.describes === 'MAIN')
  if (stated) return bodies.find((q) => q.id === `ring-${stated.id}`) ?? largest
  const isPart = (b: BoundRoofs['bodies'][number]): boolean => (b.fates ?? []).some((f) => f.property === 'part' && f.fate === 'APPLIED' && /^mass-|^ring-/.test(f.built ?? ''))
  if (!bound.bodies.some((b) => (b.fates ?? []).some((f) => f.property === 'part'))) return largest
  const rest = bound.bodies.filter((b) => !isPart(b)).map((b) => bodies.find((q) => q.id === `ring-${b.id}`)).filter((q): q is B => q !== undefined)
  return [...rest].sort((a, b) => b.widthM * b.depthM - a.widthM * a.depthM)[0] ?? largest
}

/**
 * The delivered model's roofs as they stand — each ring of exterior walls with the roof over it (a parametric gable or
 * flat roof, or the planes named under it) and each cross gable on a body's walls — MEASURED: kind and ridge direction
 * from the planes' own fall, pitch, eaves, wall top and ridge height from their geometry. Held against what was taken:
 * the categorical facts of the agreed structure, every NUMBER the builder bound to a roof, and every relation the roof
 * system solved (a valley is two VALLEY edges of the model between the two roofs; an abutment is none).
 */
export function readbackStructure(m: CanonicalBuildingModel, taken: { fullStoreys?: 1 | 2; mainRoof?: string; mainRidge?: 'X' | 'Z'; pitchDeg?: number; eavesM?: { m: number; status: string }; ridgeM?: { m: number; status: string }; parts: ReadonlyArray<{ what: string; where: string }> } | undefined, storeyWalls: { twoMinM: number; oneMaxM: number }, bound?: BoundRoofs): StructureReadback {
  const bodies: StructureReadback['bodies'] = []
  const roofs: RoofReadback[] = []
  const levelOf = (id: string): number => m.levels.find((l) => l.id === id)?.elevation ?? 0
  const byRegion = new Map<string, CanonicalBuildingModel['roofPlanes']>()
  for (const p of m.roofPlanes) byRegion.set(regionOfPlane(p.id), [...(byRegion.get(regionOfPlane(p.id)) ?? []), p])
  const measured = (id: string, hostId: string, planes: CanonicalBuildingModel['roofPlanes']): RoofReadback => {
    // the planes along the ridge fall across it: the two directions most of the area drains to
    const fall = (p: CanonicalBuildingModel['roofPlanes'][number]): 'X' | 'Z' => (Math.abs(p.downslope.x) >= Math.abs(p.downslope.z) ? 'X' : 'Z')
    const areaOf = (p: CanonicalBuildingModel['roofPlanes'][number]): number => Math.abs(p.boundary.reduce((t, a, i) => { const b = p.boundary[(i + 1) % p.boundary.length]; return t + a.x * b.z - b.x * a.z }, 0)) / 2
    const dirs = new Set(planes.map((p) => `${Math.round(p.downslope.x)}:${Math.round(p.downslope.z)}`))
    const aX = planes.filter((p) => fall(p) === 'X').reduce((t, p) => t + areaOf(p), 0)
    const aZ = planes.filter((p) => fall(p) === 'Z').reduce((t, p) => t + areaOf(p), 0)
    const ridgeAxis: 'X' | 'Z' = aZ >= aX ? 'X' : 'Z'
    const main = planes.filter((p) => fall(p) !== ridgeAxis)
    const pitch = main.length > 0 ? main.reduce((t, p) => t + p.pitchDeg * areaOf(p), 0) / main.reduce((t, p) => t + areaOf(p), 0) : undefined
    const eaves = main.length > 0 ? Math.min(...main.map((p) => p.datum.y)) : undefined
    const ridge = Math.max(...planes.flatMap((p) => p.boundary.map((q) => planeTop(p, q))))
    const drop = main[0] ? main[0].thickness / Math.cos((main[0].pitchDeg * Math.PI) / 180) : 0
    return { id, hostId, stated: 'PLANES', roof: planes.every((p) => p.pitchDeg === 0) ? 'FLAT' : dirs.size >= 3 ? 'HIP' : 'GABLE', ridgeAxis, ...(pitch !== undefined ? { pitchDeg: r3(pitch) } : {}), ...(eaves !== undefined ? { eavesM: r3(eaves), wallTopM: r3(eaves - drop) } : {}), ridgeM: r3(ridge), planeIds: planes.map((p) => p.id).sort() }
  }
  for (const ring of m.wallRings) {
    const walls = m.walls.filter((w) => ring.wallIds.includes(w.id))
    if (walls.length === 0) continue
    const xs = walls.flatMap((w) => [w.start.x, w.end.x])
    const zs = walls.flatMap((w) => [w.start.z, w.end.z])
    const rect = { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }
    const over = (f: { minX: number; maxX: number; minZ: number; maxZ: number }): boolean => Math.abs(f.minX - rect.minX) < 0.6 && Math.abs(f.maxX - rect.maxX) < 0.6 && Math.abs(f.minZ - rect.minZ) < 0.6 && Math.abs(f.maxZ - rect.maxZ) < 0.6
    // the roof built over this ring carries the ring's name (`roof-<body>`); else the one whose footprint is the ring's
    // rectangle, or holds it within an overhang (a roof whose eaves were set out past the walls)
    const holds = (f: { minX: number; maxX: number; minZ: number; maxZ: number }): boolean => f.minX <= rect.minX + 0.05 && f.maxX >= rect.maxX - 0.05 && f.minZ <= rect.minZ + 0.05 && f.maxZ >= rect.maxZ - 0.05 && f.maxX - f.minX <= rect.maxX - rect.minX + 3 && f.maxZ - f.minZ <= rect.maxZ - rect.minZ + 3
    const name = ring.id.replace(/^ring-/, 'roof-')
    const roof = m.roofs.find((r) => r.id === name) ?? m.roofs.find((r) => over(r.footprint)) ?? m.roofs.find((r) => holds(r.footprint))
    const planes = byRegion.get(name) ?? []
    const size = { id: ring.id, widthM: r3(rect.maxX - rect.minX), depthM: r3(rect.maxZ - rect.minZ) }
    if (roof) {
      const half = (roof.ridgeAxis === 'X' ? rect.maxZ - rect.minZ : rect.maxX - rect.minX) / 2
      const eaves = levelOf(roof.levelId) + roof.eaveOffset
      const pitched = roof.kind !== 'FLAT' && roof.pitchDeg > 0
      const body: StructureReadback['bodies'][number] = { ...size, roof: (roof.kind === 'FLAT' ? 'FLAT' : 'GABLE') as 'FLAT' | 'GABLE', ...(pitched ? { ridgeAxis: roof.ridgeAxis as 'X' | 'Z', pitchDeg: roof.pitchDeg, wallTopM: r3(eaves - (roof.thickness ?? 0) / Math.cos((roof.pitchDeg * Math.PI) / 180)), ridgeM: r3(eaves + half * Math.tan((roof.pitchDeg * Math.PI) / 180)) } : { wallTopM: r3(eaves) }) }
      bodies.push(body)
      roofs.push({ id: roof.id, hostId: ring.id, stated: 'ROOF', roof: body.roof as 'FLAT' | 'GABLE', ...(pitched ? { ...(body.ridgeAxis ? { ridgeAxis: body.ridgeAxis } : {}), ...(body.pitchDeg !== undefined ? { pitchDeg: body.pitchDeg } : {}), eavesM: r3(eaves), ...(body.wallTopM !== undefined ? { wallTopM: body.wallTopM } : {}), ...(body.ridgeM !== undefined ? { ridgeM: body.ridgeM } : {}) } : { eavesM: r3(eaves), wallTopM: r3(eaves) }), planeIds: [] })
    } else if (planes.length >= 2) {
      const q = measured(name, ring.id, planes)
      bodies.push({ ...size, roof: q.roof, ...(q.ridgeAxis ? { ridgeAxis: q.ridgeAxis } : {}), ...(q.pitchDeg !== undefined ? { pitchDeg: q.pitchDeg } : {}), ...(q.wallTopM !== undefined ? { wallTopM: q.wallTopM } : {}), ...(q.ridgeM !== undefined ? { ridgeM: q.ridgeM } : {}) })
      roofs.push(q)
    } else bodies.push({ ...size, roof: 'NONE' })
    for (const [region, ps] of byRegion) if (region.startsWith(`${name}-cross-`)) roofs.push(measured(region, ring.id, ps))
  }
  const regionOf = new Map(m.roofPlanes.map((p) => [p.id, regionOfPlane(p.id)]))
  const joins: JoinReadback[] = m.roofEdges.filter((e) => e.kind === 'VALLEY' || e.kind === 'ABUTMENT' || ((e.kind === 'RIDGE' || e.kind === 'HIP') && e.planeIds.length === 2 && regionOf.get(e.planeIds[0]) !== regionOf.get(e.planeIds[1]))).map((e) => ({ kind: e.kind, edgeId: e.id, roofs: (e.planeIds.length === 2 ? [regionOf.get(e.planeIds[0]) ?? e.planeIds[0], regionOf.get(e.planeIds[1]) ?? e.planeIds[1]] : [regionOf.get(e.planeIds[0]) ?? e.planeIds[0]]) as JoinReadback['roofs'], startM: r3(e.start.y), endM: r3(e.end.y), lengthM: r3(Math.hypot(e.end.x - e.start.x, e.end.z - e.start.z)) }))
  const checks: StructureReadback['checks'] = []
  const main = [...bodies].sort((a, b) => b.widthM * b.depthM - a.widthM * a.depthM)[0]
  const T = STRUCTURE_READBACK_TOLERANCES
  const near = (a: number, b: number): boolean => Math.abs(a - b) <= Math.max(T.heightM, T.heightShare * Math.max(a, b))
  if (taken && main) {
    // the body the main roof's description was bound to (the builder's record), else the largest
    const mainBody = mainBodyOf(bodies, bound) ?? main
    if (taken.mainRoof) checks.push({ property: 'mainRoof.kind', taken: taken.mainRoof, built: mainBody.roof, agrees: taken.mainRoof === mainBody.roof })
    if (taken.mainRidge && (taken.mainRoof === 'GABLE' || taken.mainRoof === 'HIP')) checks.push({ property: 'mainRoof.ridge', taken: taken.mainRidge, built: mainBody.ridgeAxis ?? '—', agrees: taken.mainRidge === mainBody.ridgeAxis })
    if (taken.fullStoreys && mainBody.wallTopM !== undefined) checks.push({ property: 'storeys', taken: `${taken.fullStoreys} full`, built: `walls to ${mainBody.wallTopM.toFixed(2)} m`, agrees: taken.fullStoreys === 2 ? mainBody.wallTopM >= storeyWalls.twoMinM : mainBody.wallTopM <= storeyWalls.oneMaxM })
    const cross = roofs.filter((r) => /-cross-/.test(r.id)).length
    checks.push({ property: 'bodies', taken: `main + ${taken.parts.length} part(s)${taken.parts.length > 0 ? ` (${taken.parts.map((p) => `${p.what}@${p.where}`).join(', ')})` : ''}`, built: `${bodies.length} body/bodies${cross > 0 ? ` + ${cross} cross gable(s) on their walls` : ''}`, agrees: bodies.length + cross === 1 + taken.parts.length })
    // readback 1.1.0: the NUMBERS taken for the main roof, each against the element
    if (taken.pitchDeg !== undefined && mainBody.pitchDeg !== undefined) checks.push({ property: 'mainRoof.pitchDeg', taken: `${taken.pitchDeg}°`, built: `${mainBody.pitchDeg}°`, agrees: Math.abs(mainBody.pitchDeg - taken.pitchDeg) <= T.pitchDeg, residual: r3(mainBody.pitchDeg - taken.pitchDeg) })
    if (taken.ridgeM && mainBody.ridgeM !== undefined) checks.push({ property: 'mainRoof.ridgeM', taken: `${taken.ridgeM.m} m (${taken.ridgeM.status})`, built: `${mainBody.ridgeM} m`, agrees: near(mainBody.ridgeM, taken.ridgeM.m), residual: r3(mainBody.ridgeM - taken.ridgeM.m) })
    if (taken.eavesM && mainBody.wallTopM !== undefined) checks.push({ property: 'mainRoof.eavesM', taken: `${taken.eavesM.m} m (${taken.eavesM.status})`, built: `${mainBody.wallTopM} m`, agrees: near(mainBody.wallTopM, taken.eavesM.m), residual: r3(mainBody.wallTopM - taken.eavesM.m) })
  }
  if (bound) {
    // every roof the builder solved is in the model as it was solved: its kind, ridge, pitch, eaves and ridge height
    const specs = [...bound.bodies.filter((b) => b.roof.kind !== 'FLAT' && b.roof.ridgeM !== undefined).map((b) => ({ id: `roof-${b.id}`, kind: b.roof.kind, ridgeAxis: b.roof.ridgeAxis, pitchDeg: b.roof.pitchDeg, eavesM: b.roof.eavesM, ridgeM: b.roof.ridgeM as number })), ...(bound.crossRoofs ?? []).map((c) => ({ id: c.id, kind: 'GABLE', ridgeAxis: c.ridgeAxis, pitchDeg: c.pitchDeg, eavesM: c.eavesM, ridgeM: c.ridgeM }))]
    for (const sp of specs) {
      const r = roofs.find((q) => q.id === sp.id)
      if (!r) { checks.push({ property: `${sp.id}`, taken: `${sp.kind}${sp.ridgeAxis ? ` along ${sp.ridgeAxis}` : ''}`, built: 'not in the model', agrees: false }); continue }
      checks.push({ property: `${sp.id}.form`, taken: `${sp.kind}${sp.ridgeAxis ? ` along ${sp.ridgeAxis}` : ''}`, built: `${r.roof}${r.ridgeAxis ? ` along ${r.ridgeAxis}` : ''}`, agrees: r.roof === sp.kind && (!sp.ridgeAxis || r.ridgeAxis === sp.ridgeAxis) })
      if (sp.pitchDeg !== undefined && r.pitchDeg !== undefined) checks.push({ property: `${sp.id}.pitchDeg`, taken: `${sp.pitchDeg}°`, built: `${r.pitchDeg}°`, agrees: Math.abs(r.pitchDeg - sp.pitchDeg) <= 0.5, residual: r3(r.pitchDeg - sp.pitchDeg) })
      // a roof run into a higher one has its ridge and eaves held to that roof's within the solver's stated tolerance
      if (r.eavesM !== undefined) checks.push({ property: `${sp.id}.eavesM`, taken: `${r3(sp.eavesM)} m`, built: `${r.eavesM} m`, agrees: Math.abs(r.eavesM - sp.eavesM) <= 0.26, residual: r3(r.eavesM - sp.eavesM) })
      if (r.ridgeM !== undefined) checks.push({ property: `${sp.id}.ridgeM`, taken: `${r3(sp.ridgeM)} m`, built: `${r.ridgeM} m`, agrees: Math.abs(r.ridgeM - sp.ridgeM) <= 0.26, residual: r3(r.ridgeM - sp.ridgeM) })
    }
    for (const rel of bound.relations ?? []) {
      const between = joins.filter((j) => j.roofs.length === 2 && j.roofs.includes(rel.a) && j.roofs.includes(rel.b))
      const valleys = between.filter((j) => j.kind === 'VALLEY')
      if (rel.kind === 'VALLEY' || rel.kind === 'CROSS_GABLE') checks.push({ property: `join ${rel.a} → ${rel.b}`, taken: `${rel.kind}: two valleys`, built: `${valleys.length} VALLEY edge(s)${valleys.length > 0 ? ` (${valleys.map((v) => `${Math.min(v.startM, v.endM).toFixed(2)}→${Math.max(v.startM, v.endM).toFixed(2)} m`).join(', ')})` : ''}`, agrees: valleys.length === 2 })
      else checks.push({ property: `join ${rel.a} → ${rel.b}`, taken: `${rel.kind}: no valley`, built: `${valleys.length} VALLEY edge(s)`, agrees: valleys.length === 0 })
    }
  }
  return { version: READBACK_VERSION, bodies, roofs, joins, checks }
}
