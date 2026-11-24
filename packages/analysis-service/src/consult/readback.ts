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

export const READBACK_VERSION = '1.0.0' as const
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

/** The hand the wall's START corner is on for someone outside looking at the wall: the model's centroid tells inside from outside. */
function startHand(m: CanonicalBuildingModel, w: CanonicalBuildingModel['walls'][number]): 'LEFT' | 'RIGHT' | 'UNKNOWN' {
  const ext = m.walls.filter((q) => q.kind === 'EXTERIOR')
  if (ext.length < 3) return 'UNKNOWN'
  const cx = ext.reduce((t, q) => t + (q.start.x + q.end.x) / 2, 0) / ext.length
  const cz = ext.reduce((t, q) => t + (q.start.z + q.end.z) / 2, 0) / ext.length
  const [dx, dz] = [w.end.x - w.start.x, w.end.z - w.start.z]
  // z of the cross product of the wall's direction and the vector from its middle to the centroid: the side the inside is on
  const cross = dx * (cz - (w.start.z + w.end.z) / 2) - dz * (cx - (w.start.x + w.end.x) / 2)
  if (Math.abs(cross) < 1e-9) return 'UNKNOWN'
  // the body's frame: x grows to the right of a person outside looking at the FRONT (z = 0), z away from them. The front
  // wall from (0,0) to (10,0) has the inside at z > 0: cross > 0, and its START (x = 0) is on that person's LEFT.
  return cross > 0 ? 'LEFT' : 'RIGHT'
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

export type StructureReadback = {
  version: string
  bodies: Array<{ id: string; widthM: number; depthM: number; roof: 'GABLE' | 'HIP' | 'FLAT' | 'NONE'; ridgeAxis?: 'X' | 'Z'; pitchDeg?: number; wallTopM?: number; ridgeM?: number }>
  /** what the agreed structure asked for, beside what the delivered model has */
  checks: Array<{ property: string; taken: string; built: string; agrees: boolean }>
}

/**
 * The delivered model's bodies as they stand — a ring of exterior walls with the roof over it (a parametric gable or flat
 * roof, or four hip planes) — beside what the agreed structure asked for.
 */
export function readbackStructure(m: CanonicalBuildingModel, taken: { fullStoreys?: 1 | 2; mainRoof?: string; mainRidge?: 'X' | 'Z'; parts: ReadonlyArray<{ what: string; where: string }> } | undefined, storeyWalls: { twoMinM: number; oneMaxM: number }): StructureReadback {
  const bodies: StructureReadback['bodies'] = []
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
    const roof = m.roofs.find((r) => r.id === ring.id.replace(/^ring-/, 'roof-')) ?? m.roofs.find((r) => over(r.footprint)) ?? m.roofs.find((r) => holds(r.footprint))
    const planes = m.roofPlanes.filter((p) => p.id.includes(ring.id.replace(/^ring-/, '')))
    const levelOf = (id: string): number => m.levels.find((l) => l.id === id)?.elevation ?? 0
    if (roof) {
      const half = (roof.ridgeAxis === 'X' ? rect.maxZ - rect.minZ : rect.maxX - rect.minX) / 2
      const eaves = levelOf(roof.levelId) + roof.eaveOffset
      const pitched = roof.kind !== 'FLAT' && roof.pitchDeg > 0
      bodies.push({ id: ring.id, widthM: r3(rect.maxX - rect.minX), depthM: r3(rect.maxZ - rect.minZ), roof: roof.kind === 'FLAT' ? 'FLAT' : 'GABLE', ...(pitched ? { ridgeAxis: roof.ridgeAxis as 'X' | 'Z', pitchDeg: roof.pitchDeg, wallTopM: r3(eaves - (roof.thickness ?? 0) / Math.cos((roof.pitchDeg * Math.PI) / 180)), ridgeM: r3(eaves + half * Math.tan((roof.pitchDeg * Math.PI) / 180)) } : { wallTopM: r3(eaves) }) })
    } else if (planes.length >= 4) {
      const top = Math.max(...walls.map((w) => levelOf(w.levelId) + w.baseOffset + w.height))
      bodies.push({ id: ring.id, widthM: r3(rect.maxX - rect.minX), depthM: r3(rect.maxZ - rect.minZ), roof: 'HIP', ridgeAxis: rect.maxX - rect.minX >= rect.maxZ - rect.minZ ? 'X' : 'Z', wallTopM: r3(top) })
    } else bodies.push({ id: ring.id, widthM: r3(rect.maxX - rect.minX), depthM: r3(rect.maxZ - rect.minZ), roof: 'NONE' })
  }
  const checks: StructureReadback['checks'] = []
  const main = [...bodies].sort((a, b) => b.widthM * b.depthM - a.widthM * a.depthM)[0]
  if (taken && main) {
    if (taken.mainRoof) checks.push({ property: 'mainRoof.kind', taken: taken.mainRoof, built: main.roof, agrees: taken.mainRoof === main.roof })
    if (taken.mainRidge && taken.mainRoof === 'GABLE') checks.push({ property: 'mainRoof.ridge', taken: taken.mainRidge, built: main.ridgeAxis ?? '—', agrees: taken.mainRidge === main.ridgeAxis })
    if (taken.fullStoreys && main.wallTopM !== undefined) checks.push({ property: 'storeys', taken: `${taken.fullStoreys} full`, built: `walls to ${main.wallTopM.toFixed(2)} m`, agrees: taken.fullStoreys === 2 ? main.wallTopM >= storeyWalls.twoMinM : main.wallTopM <= storeyWalls.oneMaxM })
    checks.push({ property: 'bodies', taken: `main + ${taken.parts.length} part(s)${taken.parts.length > 0 ? ` (${taken.parts.map((p) => `${p.what}@${p.where}`).join(', ')})` : ''}`, built: `${bodies.length} body/bodies`, agrees: bodies.length === 1 + taken.parts.length })
  }
  return { version: READBACK_VERSION, bodies, checks }
}
