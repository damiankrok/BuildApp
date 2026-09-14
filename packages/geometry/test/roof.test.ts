import { describe, expect, it } from 'vitest'
import { boundsOf, manifoldReport, materialLength, meshVolume, upwardPlanes } from '@buildapp/verification'
import { compileBuilding, roofGeometry, solidTriangles } from '../src/index.js'
import { V, withGround } from './helpers.js'

describe('roof compiler', () => {
  it('gable: measured pitch, ridge, bounds and volume agree with the semantic roof', () => {
    const m = withGround({
      type: 'createRoof',
      id: 'r',
      levelId: 'ground',
      kind: 'GABLE',
      footprint: { minX: 0, maxX: 10, minZ: 0, maxZ: 8 },
      eaveOffset: 3,
      pitchDeg: 35,
      ridgeAxis: 'X',
      overhang: 0.4,
      thickness: 0.25,
    })
    const scene = compileBuilding(m)
    expect(scene.diagnostics).toEqual([])
    const tris = solidTriangles(scene, 'r')
    expect(manifoldReport(tris)).toMatchObject({ closed: true, boundaryEdges: 0, duplicateEdges: 0 })
    const planes = upwardPlanes(tris)
    expect(planes).toHaveLength(2)
    for (const p of planes) expect(p.pitchDeg).toBeCloseTo(35, 9)
    // the two slopes mirror across a ridge along x
    expect(planes[0].normal.x).toBeCloseTo(0, 12)
    expect(planes[0].normal.z).toBeCloseTo(-planes[1].normal.z, 12)
    const slope = Math.tan((35 * Math.PI) / 180)
    const b = boundsOf(tris)!
    expect(b.min.x).toBeCloseTo(-0.4, 12)
    expect(b.max.x).toBeCloseTo(10.4, 12)
    expect(b.min.z).toBeCloseTo(-0.4, 12)
    expect(b.max.z).toBeCloseTo(8.4, 12)
    expect(b.max.y).toBeCloseTo(3 + 4 * slope, 12)
    const drop = 0.25 / Math.cos((35 * Math.PI) / 180)
    // the overhang follows the slope down and the underside is the top dropped perpendicular thickness
    expect(b.min.y).toBeCloseTo(3 - 0.4 * slope - drop, 12)
    expect(meshVolume(tris)).toBeCloseTo(10.8 * 8.8 * drop, 9)
    // a vertical ray meets exactly the vertical drop, anywhere under the roof
    expect(materialLength(tris, V(5, 0, 2), V(0, 1, 0))).toBeCloseTo(drop, 9)
    expect(materialLength(tris, V(-0.2, 0, 7), V(0, 1, 0))).toBeCloseTo(drop, 9)
    // the eave top is exactly at the footprint edge
    const g = roofGeometry(m.roofs[0], m.levels[0])
    expect(g.topAt(3, 0)).toBeCloseTo(3, 12)
    expect(g.topAt(3, 4)).toBeCloseTo(3 + 4 * slope, 12)
    expect(g.ridgeY).toBeCloseTo(3 + 4 * slope, 12)
  })

  it('changing the pitch moves the geometry; the declared pitch is what is built', () => {
    const build = (pitchDeg: number) =>
      solidTriangles(
        compileBuilding(
          withGround({ type: 'createRoof', id: 'r', levelId: 'ground', kind: 'GABLE', footprint: { minX: 0, maxX: 6, minZ: 0, maxZ: 6 }, eaveOffset: 3, pitchDeg, ridgeAxis: 'Z', overhang: 0, thickness: 0.2 }),
        ),
        'r',
      )
    expect(upwardPlanes(build(30))[0].pitchDeg).toBeCloseTo(30, 9)
    expect(upwardPlanes(build(48))[0].pitchDeg).toBeCloseTo(48, 9)
    expect(boundsOf(build(48))!.max.y).toBeCloseTo(3 + 3 * Math.tan((48 * Math.PI) / 180), 12)
  })

  it('flat: a plate at the eave with pitch 0', () => {
    const scene = compileBuilding(
      withGround({ type: 'createRoof', id: 'f', levelId: 'ground', kind: 'FLAT', footprint: { minX: 10, maxX: 15, minZ: 0, maxZ: 6 }, eaveOffset: 2.85, thickness: 0.25 }),
    )
    const tris = solidTriangles(scene, 'f')
    expect(manifoldReport(tris).closed).toBe(true)
    expect(upwardPlanes(tris)).toHaveLength(1)
    expect(upwardPlanes(tris)[0].pitchDeg).toBeCloseTo(0, 12)
    expect(boundsOf(tris)).toEqual({ min: V(10, 2.6, 0), max: V(15, 2.85, 6) })
    expect(meshVolume(tris)).toBeCloseTo(5 * 6 * 0.25, 9)
  })
})
