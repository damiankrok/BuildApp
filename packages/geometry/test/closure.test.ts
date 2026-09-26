/**
 * The geometry closure audit, on generic buildings.
 *
 * Each case is a joint a building makes (§5) or an assembly a reconstruction
 * emits (§21): stated in the DSL, compiled on the production path, audited.
 * Every clean case has a mutated twin that breaks the joint the way the owner
 * review saw it break — a board pushed into a wall, a slab edge in the plane
 * of a facade, a railing stopping short, a terrace standing off its facade —
 * and the audit must name that joint with a measure. Nothing here is about a
 * particular house.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyModel, type CanonicalBuildingModel } from '@buildapp/model'
import { runCommands, type BuildingCommand } from '@buildapp/commands'
import { compileBuilding, geometryClosureAudit, type ClosureReport } from '../src/index.js'

const T = 0.3

const BASE: BuildingCommand[] = [
  { type: 'createBuilding', id: 'b', name: 'closure' },
  { type: 'createLevel', id: 'l0', index: 0, elevation: 0, height: 3 },
  { type: 'createLevel', id: 'l1', index: 1, elevation: 3, height: 2.6 },
  { type: 'defineMaterial', id: 'm-wall', name: 'render', color: '#e8e4dc' },
  { type: 'defineMaterial', id: 'm-member', name: 'member', color: '#ece9e2' },
]

const ring = (id = 'ring', levelId = 'l0', x0 = 0, x1 = 8, z0 = 0, z1 = 6, height = 3): BuildingCommand => ({
  type: 'createWallRing',
  id,
  levelId,
  polygon: [
    { x: x0, z: z0 },
    { x: x1, z: z0 },
    { x: x1, z: z1 },
    { x: x0, z: z1 },
  ],
  thickness: T,
  height,
  materialId: 'm-wall',
})

const build = (...cmds: BuildingCommand[]): CanonicalBuildingModel => runCommands(createEmptyModel('c', 'closure'), [...BASE, ...cmds])
const audit = (m: CanonicalBuildingModel): ClosureReport => geometryClosureAudit(m, compileBuilding(m))
const exterior = (r: ClosureReport) => r.findings.filter((f) => f.scope === 'EXTERIOR')
const between = (r: ClosureReport, a: string, b: string) => r.findings.filter((f) => f.objects.includes(a) && f.objects.includes(b))
const ringWall = (m: CanonicalBuildingModel, ringId: string, k: number): string => m.wallRings.find((r) => r.id === ringId)?.wallIds[k] as string

describe('§5 wall, floor and slab joints', () => {
  it('a ring of walls meeting at corners is clean: no shared volume, no face drawn twice, no crack', () => {
    const r = audit(build(ring()))
    expect(r.findings).toEqual([])
    expect(r.metrics.intersectionCount).toBe(0)
    expect(r.metrics.coplanarDuplicateCount).toBe(0)
    expect(r.metrics.gapCount).toBe(0)
  })

  it('a T joint: a partition declared against a wall meets its inner face exactly', () => {
    const m = build(ring(), { type: 'createWall', id: 'p', levelId: 'l0', start: { x: 4, z: T }, end: { x: 4, z: 6 - T }, thickness: 0.12, height: 3, kind: 'INTERIOR', startJunction: { kind: 'T', againstWallId: 'ring-w0' }, endJunction: { kind: 'T', againstWallId: 'ring-w2' } })
    const r = audit(m)
    expect(r.findings).toEqual([])
    // A partition run into the wall with no junction to say how they meet never reaches the compiler: the DSL refuses it.
    expect(() => build(ring(), { type: 'createWall', id: 'p', levelId: 'l0', start: { x: 4, z: 0.1 }, end: { x: 4, z: 6 - T }, thickness: 0.12, height: 3, kind: 'INTERIOR' })).toThrow(/WALLS_OVERLAP/)
    // And one stopping 3 cm short of the face it should meet is a crack.
    const short = audit(build(ring(), { type: 'createWall', id: 'p', levelId: 'l0', start: { x: 4, z: T + 0.03 }, end: { x: 4, z: 6 - T }, thickness: 0.12, height: 3, kind: 'INTERIOR' }))
    const gap = between(short, 'p', ringWall(m, 'ring', 0)).find((f) => f.code === 'GAP')
    expect(gap?.measure).toBeCloseTo(0.03, 3)
  })

  it('a butt joint: a wall ending against another wall’s face meets it and does not enter it', () => {
    const m = build(
      { type: 'createWall', id: 'long', levelId: 'l0', start: { x: 0, z: 0 }, end: { x: 8, z: 0 }, thickness: T, height: 3, materialId: 'm-wall' },
      { type: 'createWall', id: 'stub', levelId: 'l0', start: { x: 4, z: 3 }, end: { x: 4, z: T }, thickness: T, height: 3, materialId: 'm-wall', endJunction: { kind: 'BUTT', againstWallId: 'long' } },
    )
    const r = audit(m)
    expect(between(r, 'long', 'stub')).toEqual([])
  })

  it('a slab bearing into the walls under it: shared volume within the bearing, no edge in the plane of a facade', () => {
    // The upper floor plate bears to the walls' centrelines: it shares T/2 of each wall's thickness, nothing more.
    const m = build(ring(), ring('up', 'l1', 0, 8, 0, 6, 2.6), { type: 'createSlab', id: 'floor', levelId: 'l1', polygon: [{ x: T / 2, z: T / 2 }, { x: 8 - T / 2, z: T / 2 }, { x: 8 - T / 2, z: 6 - T / 2 }, { x: T / 2, z: 6 - T / 2 }], topOffset: 0, thickness: 0.2 })
    const r = audit(m)
    expect(exterior(r)).toEqual([])
    expect(r.contacts.some((c) => c.relation === 'WALL<->SLAB' && c.volumeM3 > 0)).toBe(true)
  })

  it('a slab run out to the outer face draws its edge in the plane of the facade: flagged, not hidden', () => {
    const m = build(ring(), ring('up', 'l1', 0, 8, 0, 6, 2.6), { type: 'createSlab', id: 'floor', levelId: 'l1', polygon: [{ x: 0, z: 0 }, { x: 8, z: 0 }, { x: 8, z: 6 }, { x: 0, z: 6 }], topOffset: 0, thickness: 0.2 })
    const r = audit(m)
    const f = r.findings.filter((x) => x.relation === 'WALL<->SLAB')
    expect(f.length).toBeGreaterThan(0)
    expect(f.every((x) => x.severity === 'ERROR')).toBe(true)
  })

  it('a balcony slab against its host wall meets the face; pushed 10 cm into the wall it is an intersection', () => {
    const clean = audit(build(ring(), { type: 'createBalcony', id: 'bal', levelId: 'l1', footprint: { minX: 2, maxX: 6, minZ: -1.2, maxZ: 0 }, topOffset: 0, thickness: 0.2 }))
    expect(between(clean, 'bal', 'ring-w0')).toEqual([])
    const m = build(ring(), { type: 'createBalcony', id: 'bal', levelId: 'l1', footprint: { minX: 2, maxX: 6, minZ: -1.2, maxZ: 0.1 }, topOffset: -0.1, thickness: 0.2 })
    const into = between(audit(m), 'bal', ringWall(m, 'ring', 0))
    expect(into.map((f) => f.code)).toContain('INTERSECTION')
    expect(into.find((f) => f.code === 'INTERSECTION')?.relation).toBe('BALCONY_SLAB<->WALL')
  })

  it('a facade member on its host: touching is clean, standing off is a crack, pushed in is an intersection', () => {
    const member = (z: number): BuildingCommand => ({ type: 'createLinearSolid', id: 'band', levelId: 'l0', start: { x: 1, y: 2.4, z }, end: { x: 7, y: 2.4, z }, width: 0.3, depth: 0.2, hostId: 'ring-w0', materialId: 'm-member' })
    const on = audit(build(ring(), member(-0.1)))
    expect(between(on, 'band', 'ring-w0')).toEqual([])
    const off = between(audit(build(ring(), member(-0.15))), 'band', 'ring-w0')
    expect(off.find((f) => f.code === 'GAP')?.measure).toBeCloseTo(0.05, 3)
    const into = between(audit(build(ring(), member(0))), 'band', 'ring-w0')
    expect(into.map((f) => f.code)).toContain('INTERSECTION')
  })
})

describe('§21 closure fixtures', () => {
  // A loggia: a front zone 1.2 m deep between two returns on the upper storey.
  const loggia = (railing: BuildingCommand, returns: 'BOTH' | 'HIGH' = 'BOTH'): CanonicalBuildingModel =>
    build(
      ring('body', 'l0', 0, 8, 1.2, 7.2),
      ring('up', 'l1', 0, 8, 1.2, 7.2, 2.6),
      { type: 'createBalcony', id: 'bal', levelId: 'l1', footprint: { minX: returns === 'BOTH' ? 0.5 : 2, maxX: 7.5, minZ: 0, maxZ: 1.2 }, topOffset: 0, thickness: 0.3 },
      ...(returns === 'BOTH' ? [{ type: 'createWall', id: 'ret-w', levelId: 'l1', start: { x: 0, z: 1.2 }, end: { x: 0, z: 0 }, thickness: 0.5, height: 2.6, materialId: 'm-member' } as BuildingCommand] : []),
      { type: 'createWall', id: 'ret-e', levelId: 'l1', start: { x: 8, z: 0 }, end: { x: 8, z: 1.2 }, thickness: 0.5, height: 2.6, materialId: 'm-member' },
      railing,
    )

  it('1 a front railing only, between two returns: both ends at a wall, no free end', () => {
    const r = audit(loggia({ type: 'createRailing', id: 'rail', levelId: 'l1', start: { x: 0.5, z: 0.05 }, end: { x: 7.5, z: 0.05 }, height: 1, infill: 'GLASS', hostId: 'bal' }))
    expect(r.findings.filter((f) => f.objects.includes('rail'))).toEqual([])
    expect(r.metrics.railingFreeEndCount).toBe(0)
  })

  it('2 a front railing with one side return: it turns at the free end and runs back to the wall', () => {
    const turning = loggia({ type: 'createRailing', id: 'rail', levelId: 'l1', start: { x: 2.025, z: 1.2 }, end: { x: 7.5, z: 0.05 }, path: [{ x: 2.025, z: 1.2 }, { x: 2.025, z: 0.05 }, { x: 7.5, z: 0.05 }], height: 1, infill: 'GLASS', hostId: 'bal' }, 'HIGH')
    const r = audit(turning)
    expect(r.metrics.railingFreeEndCount).toBe(0)
    expect(r.findings.filter((f) => f.objects.includes('rail'))).toEqual([])
    // The same railing without its return stops in mid-air at the slab's free end.
    const straight = audit(loggia({ type: 'createRailing', id: 'rail', levelId: 'l1', start: { x: 2.025, z: 0.05 }, end: { x: 7.5, z: 0.05 }, height: 1, infill: 'GLASS', hostId: 'bal' }, 'HIGH'))
    const free = straight.findings.find((f) => f.code === 'RAILING_END_FREE')
    expect(free?.measure).toBeCloseTo(1.15, 2)
  })

  it('3 a U-shaped railing round a free-standing slab: two corners, one post each, both ends at the wall', () => {
    const m = build(ring('body', 'l0', 0, 8, 1.2, 7.2), ring('up', 'l1', 0, 8, 1.2, 7.2, 2.6), { type: 'createBalcony', id: 'bal', levelId: 'l1', footprint: { minX: 2, maxX: 6, minZ: 0, maxZ: 1.2 }, topOffset: 0, thickness: 0.3 }, { type: 'createRailing', id: 'rail', levelId: 'l1', start: { x: 2.025, z: 1.2 }, end: { x: 5.975, z: 1.2 }, path: [{ x: 2.025, z: 1.2 }, { x: 2.025, z: 0.025 }, { x: 5.975, z: 0.025 }, { x: 5.975, z: 1.2 }], height: 1, infill: 'BARS', hostId: 'bal' })
    const r = audit(m)
    expect(r.metrics.railingFreeEndCount).toBe(0)
    const posts = compileBuilding(m).meshes.filter((x) => x.objectId === 'rail' && x.part === 'RAILING_POST')
    // Each corner post is one square box at its vertex: count the boxes whose plan centre is a corner.
    const tris = posts.flatMap((p) => p.triangles)
    const atCorner = (x: number, z: number): boolean => tris.some((t) => [t.a, t.b, t.c].some((v) => Math.abs(v.x - x) < 0.03 && Math.abs(v.z - z) < 0.03))
    expect(atCorner(2.025, 0.025)).toBe(true)
    expect(atCorner(5.975, 0.025)).toBe(true)
  })

  it('4 an attached garage with a parapet: the flat plate bears into its walls, the parapet rises past it, nothing drawn twice', () => {
    const cmds = (inset: boolean): BuildingCommand[] => [
      ring('main', 'l0', 0, 8, 0, 8),
      { type: 'createWallRing', id: 'gar', levelId: 'l0', polygon: [{ x: 8, z: 0 }, { x: 12, z: 0 }, { x: 12, z: 6 }, { x: 8, z: 6 }], thickness: T, height: 3.1, materialId: 'm-wall', walls: [{ id: 'gar-front' }, { id: 'gar-east' }, { id: 'gar-rear' }, { id: 'gar-party' }] },
      { type: 'createRoof', id: 'flat', levelId: 'l0', kind: 'FLAT', footprint: { minX: 8, maxX: 12, minZ: 0, maxZ: 6 }, eaveOffset: 2.9, thickness: 0.25, ...(inset ? { plateInset: { minX: T / 2, maxX: T / 2, minZ: T / 2, maxZ: T / 2 } } : {}) },
    ]
    const clean = audit(build(...cmds(true)))
    expect(exterior(clean).filter((f) => f.relation === 'PARAPET<->FLAT_ROOF' || f.relation === 'MAIN_MASS<->ATTACHED_MASS')).toEqual([])
    const flush = audit(build(...cmds(false)))
    expect(flush.findings.some((f) => f.relation === 'PARAPET<->FLAT_ROOF' && f.code === 'COPLANAR_DUPLICATE')).toBe(true)
  })

  it('5 a terrace to a large glazed opening: on the floor datum, against the facade; 5 cm off it is a crack', () => {
    const terrace = (z1: number): BuildingCommand => ({ type: 'createTerrace', id: 'ter', levelId: 'l0', polygon: [{ x: 1, z: -2.5 }, { x: 7, z: -2.5 }, { x: 7, z: z1 }, { x: 1, z: z1 }], thickness: 0.15, surface: 'PAVED', edge: 'PLINTH', hostWallIds: ['ring-w0'] })
    const glazing: BuildingCommand = { type: 'cutOpening', id: 'o', wallId: 'ring-w0', kind: 'DOOR', offset: 2, sill: 0, width: 4, height: 2.4 }
    const on = audit(build(ring(), glazing, terrace(0)))
    expect(on.findings.filter((f) => f.objects.includes('ter'))).toEqual([])
    expect(on.metrics.terraceAlignmentResidualM).toBe(0)
    const off = audit(build(ring(), glazing, terrace(-0.05)))
    expect(off.findings.find((f) => f.objects.includes('ter') && f.code === 'GAP')?.measure).toBeCloseTo(0.05, 3)
  })

  it('6 a gable with verge boards: the boards are compiled with the roof and the gable walls die into their undersides', () => {
    const m = build(
      ring('body', 'l0', 0, 8, 0, 10),
      { type: 'createRoof', id: 'roof', levelId: 'l0', kind: 'GABLE', footprint: { minX: 0, maxX: 8, minZ: 0, maxZ: 10 }, eaveOffset: 3, pitchDeg: 40, ridgeAxis: 'Z', thickness: 0.25, edgeMembers: { verge: { width: 0.5, depth: 0.3, materialId: 'm-member' } }, capWallIds: ['body-w0', 'body-w1', 'body-w2', 'body-w3'] },
    )
    const scene = compileBuilding(m)
    expect(scene.meshes.filter((x) => x.part === 'ROOF_TRIM').length).toBeGreaterThan(0)
    const r = geometryClosureAudit(m, scene)
    expect(exterior(r).map((f) => f.message)).toEqual([])
  })

  it('7 a head band spanning two bodies: the slab and the member continuing it meet end to end, one band', () => {
    const m = build(
      ring('main', 'l0', 0, 8, 1, 8),
      { type: 'createWallRing', id: 'gar', levelId: 'l0', polygon: [{ x: 8, z: 1 }, { x: 12, z: 1 }, { x: 12, z: 6 }, { x: 8, z: 6 }], thickness: T, height: 3, materialId: 'm-wall' },
      { type: 'createBalcony', id: 'bal', levelId: 'l1', footprint: { minX: 3, maxX: 8, minZ: 0, maxZ: 1 }, topOffset: 0, thickness: 0.6 },
      { type: 'createLinearSolid', id: 'head', levelId: 'l0', start: { x: 8, y: 2.7, z: 0.5 }, end: { x: 12, y: 2.7, z: 0.5 }, width: 0.6, depth: 1, materialId: 'm-member' },
    )
    const r = audit(m)
    expect(between(r, 'bal', 'head')).toEqual([])
    expect(r.metrics.coplanarDuplicateCount).toBe(0)
  })

  it('9 a trim deliberately pushed through a return is named, with the volume it shares', () => {
    const m = build(ring(), { type: 'createWall', id: 'ret', levelId: 'l0', start: { x: 0, z: 0 }, end: { x: 0, z: -1 }, thickness: 0.5, height: 3, materialId: 'm-member' }, { type: 'createLinearSolid', id: 'trim', levelId: 'l0', start: { x: -0.2, y: 2.8, z: -0.5 }, end: { x: 3, y: 2.8, z: -0.5 }, width: 0.2, depth: 0.2, hostId: 'ret', materialId: 'm-member' })
    const hit = between(audit(m), 'trim', 'ret').find((f) => f.code === 'INTERSECTION')
    expect(hit).toBeDefined()
    expect(hit?.measure).toBeGreaterThan(0.005)
    expect(hit?.severity).toBe('ERROR')
  })
})
