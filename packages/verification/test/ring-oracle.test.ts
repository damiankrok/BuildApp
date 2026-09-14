import { describe, expect, it } from 'vitest'
import { createEmptyModel, type CanonicalBuildingModel } from '@buildapp/model'
import { runCommands, type BuildingCommand } from '@buildapp/commands'
import { compileBuilding, solidTriangles, type CompiledScene } from '@buildapp/geometry'
import { ringClosureReport, type OTri } from '../src/index.js'

const RECT = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 8 }, { x: 0, z: 8 }]
const T = 0.3

const build = (...cmds: BuildingCommand[]): CanonicalBuildingModel =>
  runCommands(createEmptyModel('t', 't'), [{ type: 'createBuilding', id: 'b' }, { type: 'createLevel', id: 'ground', index: 0, elevation: 0, height: 3 }, ...cmds])

const solidsOf = (scene: CompiledScene, ids: string[]): Array<{ id: string; triangles: OTri[] }> => ids.map((id) => ({ id, triangles: solidTriangles(scene, id) }))

/** The BUILDAPP-00 way: four walls whose side walls were trimmed by hand. Used to build broken variants without junction records. */
const handTrimmed = (rightStartZ = T, frontEndX = 10): CanonicalBuildingModel =>
  build(
    { type: 'createWall', id: 'front', levelId: 'ground', start: { x: 0, z: 0 }, end: { x: frontEndX, z: 0 }, thickness: T, height: 3 },
    { type: 'createWall', id: 'right', levelId: 'ground', start: { x: 10, z: rightStartZ }, end: { x: 10, z: 8 - T }, thickness: T, height: 3 },
    { type: 'createWall', id: 'rear', levelId: 'ground', start: { x: 10, z: 8 }, end: { x: 0, z: 8 }, thickness: T, height: 3 },
    { type: 'createWall', id: 'left', levelId: 'ground', start: { x: 0, z: 8 - T }, end: { x: 0, z: T }, thickness: T, height: 3 },
  )

const OPTS = { heights: [0.5, 2.4], step: 0.1, endInset: 0.05 }
const IDS = ['front', 'right', 'rear', 'left']

describe('ring closure oracle', () => {
  it('a ring from natural corners with a door and windows is closed, with no overlaps', () => {
    const m = build(
      { type: 'createWallRing', id: 'r', levelId: 'ground', polygon: RECT, thickness: T, height: 3, walls: [{ id: 'front' }, { id: 'right' }, { id: 'rear' }, { id: 'left' }] },
      { type: 'cutOpening', id: 'door', wallId: 'front', kind: 'DOOR', offset: 1, sill: 0, width: 1, height: 2.1 },
      { type: 'cutOpening', id: 'win', wallId: 'rear', kind: 'WINDOW', offset: 2, sill: 0.9, width: 1.5, height: 1.4 },
    )
    const r = ringClosureReport(RECT, solidsOf(compileBuilding(m), IDS), OPTS)
    expect(r.closed).toBe(true)
    expect(r.gaps).toEqual([])
    expect(r.overlaps).toEqual([])
    expect(r.outsideOnly).toEqual([])
    expect(r.corners.map((c) => c.ok)).toEqual([true, true, true, true])
    for (const c of r.corners) expect(c.materialLength).toBeCloseTo(T * Math.SQRT2, 6)
    expect(r.probes).toBeGreaterThan(300)
  })

  it('a missing wall is a gap of the full side', () => {
    const scene = compileBuilding(handTrimmed())
    const r = ringClosureReport(RECT, solidsOf(scene, ['front', 'right', 'left']), OPTS)
    expect(r.closed).toBe(false)
    const rear = r.gaps.find((g) => g.edge === 2)!
    expect(rear.length).toBeCloseTo(10, 1)
    expect(rear.probes).toBe(100)
    // the rear wall also owned its two corner blocks, so the side walls end 0.3 m short of the rear corners
    for (const g of r.gaps.filter((x) => x.edge !== 2)) {
      expect([1, 3]).toContain(g.edge)
      expect(g.length).toBeLessThanOrEqual(0.4)
    }
    expect(r.corners.filter((c) => !c.ok).map((c) => c.vertex)).toEqual([2, 3])
  })

  it('a shifted endpoint is a measured gap next to the corner', () => {
    const r = ringClosureReport(RECT, solidsOf(compileBuilding(handTrimmed(0.6)), IDS), OPTS)
    expect(r.closed).toBe(false)
    expect(r.gaps).toHaveLength(1)
    expect(r.gaps[0]).toMatchObject({ edge: 1 })
    expect(r.gaps[0].from).toBeGreaterThanOrEqual(T)
    expect(r.gaps[0].to).toBeLessThanOrEqual(0.6)
    expect(r.corners.every((c) => c.ok)).toBe(true)
  })

  it('a corner left empty by two short walls is caught by the corner probe and the edge probes beside it', () => {
    const r = ringClosureReport(RECT, solidsOf(compileBuilding(handTrimmed(T, 10 - T)), IDS), OPTS)
    expect(r.closed).toBe(false)
    const corner = r.corners.find((c) => c.vertex === 1)!
    expect(corner.ok).toBe(false)
    expect(corner.materialStart).toBeCloseTo((T - 0.02) * Math.SQRT2, 6)
    expect(r.gaps.map((g) => g.edge).sort()).toEqual([0, 1])
  })

  it('a reversed wall puts its material outside the envelope', () => {
    const m = build(
      { type: 'createWall', id: 'front', levelId: 'ground', start: { x: 10, z: 0 }, end: { x: 0, z: 0 }, thickness: T, height: 3 },
      { type: 'createWall', id: 'right', levelId: 'ground', start: { x: 10, z: T }, end: { x: 10, z: 8 - T }, thickness: T, height: 3 },
      { type: 'createWall', id: 'rear', levelId: 'ground', start: { x: 10, z: 8 }, end: { x: 0, z: 8 }, thickness: T, height: 3 },
      { type: 'createWall', id: 'left', levelId: 'ground', start: { x: 0, z: 8 - T }, end: { x: 0, z: T }, thickness: T, height: 3 },
    )
    const r = ringClosureReport(RECT, solidsOf(compileBuilding(m), IDS), OPTS)
    expect(r.closed).toBe(false)
    expect(r.gaps.find((g) => g.edge === 0)!.length).toBeCloseTo(10, 1)
    expect(r.outsideOnly).toEqual([0])
    expect(r.corners.filter((c) => !c.ok).map((c) => c.vertex)).toEqual([0, 1])
  })

  it('a duplicated wall is reported as shared volume', () => {
    const scene = compileBuilding(handTrimmed())
    const solids = solidsOf(scene, IDS)
    solids.push({ id: 'front-dup', triangles: solidTriangles(scene, 'front') })
    const r = ringClosureReport(RECT, solids, OPTS)
    expect(r.gaps).toEqual([])
    expect(r.overlaps).toHaveLength(1)
    expect(r.overlaps[0]).toMatchObject({ a: 'front', b: 'front-dup' })
    expect(r.overlaps[0].volume).toBeCloseTo(10 * T * 3, 1)
    expect(r.overlaps[0].worstSharedLength).toBeCloseTo(3, 9)
  })

  it('works on rings of any orientation and with reflex corners', () => {
    const L = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 4 }, { x: 6, z: 4 }, { x: 6, z: 8 }, { x: 0, z: 8 }]
    const m = build({ type: 'createWallRing', id: 'r', levelId: 'ground', polygon: L, thickness: T, height: 3 })
    const scene = compileBuilding(m)
    const solids = solidsOf(scene, m.walls.map((w) => w.id))
    const r = ringClosureReport(L, solids, OPTS)
    expect(r.closed).toBe(true)
    expect(r.corners.find((c) => c.vertex === 3)!.reflex).toBe(true)
    // the same envelope given clockwise
    const cw = ringClosureReport([...L].reverse(), solids, OPTS)
    expect(cw.closed).toBe(true)
    expect(cw.overlaps).toEqual([])
  })
})
