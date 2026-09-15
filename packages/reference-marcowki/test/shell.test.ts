import { describe, expect, it } from 'vitest'
import { boundsOf, manifoldReport, materialLength, meshVolume, unionMaterialRuns, upwardPlanes } from '@buildapp/verification'
import { solidTriangles } from '@buildapp/geometry'
import { EXPECTED_OPENINGS, EXPECTED_SHELL, depthReport, marcowkiScene, pairwiseOverlaps, recessReport, ringReports, roofReport, structuralSolids, V, verticalRuns } from './measure.js'

const E = EXPECTED_SHELL
const s = marcowkiScene()

describe('Marcówki shell: depth, recesses, rings, roof', () => {
  it('compiles with no diagnostics and every structural solid closed', () => {
    expect(s.scene.diagnostics).toEqual([])
    const solids = structuralSolids(s.scene)
    expect(solids.size).toBeGreaterThanOrEqual(19 + 4 + 5 + 3 + 2 + 2)
    for (const [id, tris] of solids) {
      expect(manifoldReport(tris), id).toMatchObject({ closed: true, boundaryEdges: 0, duplicateEdges: 0 })
      expect(meshVolume(tris), id).toBeGreaterThan(0)
    }
  })

  it('the full characteristic extent is 14.60 m; the walled envelope 12.60 m; both zones 1.00 m', () => {
    const d = depthReport(s)
    expect(d.characteristicDepth).toBeCloseTo(E.characteristicDepth, 9)
    expect(d.minZ).toBeCloseTo(E.frontOuterPlaneZ, 9)
    expect(d.maxZ).toBeCloseTo(E.rearOuterPlaneZ, 9)
    expect(d.nominalDepth).toBeCloseTo(E.nominalDepth, 9)
    expect(d.nominalMinZ).toBeCloseTo(E.frontBackPlaneZ, 9)
    expect(d.nominalMaxZ).toBeCloseTo(E.rearBackPlaneZ, 9)
    expect(d.frontZone).toBeCloseTo(E.frontZone, 9)
    expect(d.rearZone).toBeCloseTo(E.rearZone, 9)
    // the west side runs the full 14.60 m at x 0.305, broken only by the two west windows at y 1.2
    const all = [...structuralSolids(s.scene).values()]
    const westRuns = unionMaterialRuns(all, V(0.305, 1.2, -1), V(0, 0, 1)).map((r) => [r.t0 - 1, r.t1 - 1])
    expect(westRuns[0][0]).toBeCloseTo(E.frontOuterPlaneZ, 9)
    expect(westRuns[westRuns.length - 1][1]).toBeCloseTo(E.rearOuterPlaneZ, 9)
    expect(westRuns.reduce((sum, [a, b]) => sum + (b - a), 0)).toBeCloseTo(E.characteristicDepth - 0.9 - 1.4, 9)
    // at the east side the front return exists only above the balcony: at y 1.2 material starts at the front wall, at y 3.5 at the outer plane
    const eastLow = unionMaterialRuns(all, V(7.595, 1.2, -1), V(0, 0, 1))
    const eastHigh = unionMaterialRuns(all, V(7.595, 3.5, -1), V(0, 0, 1))
    expect(eastLow[0].t0 - 1).toBeCloseTo(E.frontBackPlaneZ, 9)
    expect(eastHigh[0].t0 - 1).toBeCloseTo(E.frontOuterPlaneZ, 9)
    // both rows end at the rear outer plane: the east rear return stands at ground level
    expect(eastLow[eastLow.length - 1].t1 - 1).toBeCloseTo(E.rearOuterPlaneZ, 9)
    // nothing stands at ground level in the front zone at x 7.595 (the plan has no ink there): the first material is the balcony soffit
    const column = verticalRuns(s, 7.595, 0.5)
    expect(column[0].y0).toBeCloseTo(E.portalSoffit, 9)
    expect(column.every((r) => r.y0 >= E.portalSoffit - 1e-9)).toBe(true)
  })

  it('both characteristic zones are real 1.00 m recesses: no material at the outer plane across the mouth, first material at the back wall', () => {
    for (const side of ['FRONT', 'REAR'] as const) {
      const r = recessReport(s, side)
      expect(r.statedDepth, side).toBeCloseTo(1.0, 9)
      expect(r.atOuterPlane, side).toBe(0)
      expect(r.nearerThanStated, side).toBe(0)
      expect(r.shallowest, side).toBeCloseTo(1.0, 6)
      // rays meet the back wall exactly one metre in except where the source puts an opening in it
      const [x0, x1] = side === 'FRONT' ? E.frontRecessX : E.rearRecessX
      const openings = EXPECTED_OPENINGS.filter((o) => o.facade === side && o.wallId !== 'u-front' && o.wallId !== 'u-rear')
      const solidFraction = (y: number): number => (x1 - x0 - openings.filter((o) => y > o.sill && y < o.headNear).reduce((w, o) => w + (o.span[1] - o.span[0]), 0)) / (x1 - x0)
      const expected = [0.4, 1.2, 2.0].map(solidFraction).reduce((a, b) => a + b, 0) / 3
      expect(r.atBackPlane / r.rays, side).toBeCloseTo(expected, 1)
      expect(r.returnRaysAtPlane, side).toBe(r.returnRays)
    }
  })

  it('the exterior rings close (ground, attic, garage enclosure) with no gaps and no overlaps', () => {
    const r = ringReports(s)
    for (const [name, report] of Object.entries(r)) {
      expect(report.closed, name).toBe(true)
      expect(report.gaps, name).toEqual([])
      expect(report.overlaps, name).toEqual([])
      expect(report.outsideOnly, name).toEqual([])
    }
    // the house/garage wall is one 0.45 m leaf: a ray across it at the garage meets 0.45, not 0.90
    expect(materialLength(solidTriangles(s.scene, 'g-right'), V(6, 1.2, 5), V(1, 0, 0))).toBeCloseTo(E.wallThickness, 9)
    const total = [...structuralSolids(s.scene).values()].reduce((sum, t) => sum + materialLength(t, V(6, 1.2, 5), V(1, 0, 0)), 0)
    expect(total).toBeCloseTo(E.wallThickness + E.wallThickness, 9) // g-right and then the garage east wall
  })

  it('no two structural solids share volume: the chimneys pass through modelled penetrations', () => {
    expect(pairwiseOverlaps(s)).toEqual([])
  })

  it('the main roof measures 40° from its emitted normals, ridge 7.95, spans 0..14.60 in z and closes onto every wall under it', () => {
    const r = roofReport(s)
    expect(r.closed).toBe(true)
    expect(r.pitches).toHaveLength(2)
    for (const p of r.pitches) expect(p).toBeCloseTo(E.pitchDeg, 4)
    expect(r.ridgeY).toBeCloseTo(E.ridge, 4)
    expect(r.minZ).toBeCloseTo(E.frontOuterPlaneZ, 9)
    expect(r.maxZ).toBeCloseTo(E.rearOuterPlaneZ, 9)
    expect(r.minX).toBeCloseTo(0, 9)
    expect(r.maxX).toBeCloseTo(E.mainWidth, 9)
    expect(r.drop).toBeCloseTo(E.roofVerticalDrop, 4)
    expect(r.worstGap).toBeLessThan(1e-6)
    expect(r.worstOverlap).toBeLessThan(1e-6)
    // the eave walls stop at the knee wall on their outer face and the roof underside sits exactly on them
    const left = verticalRuns(s, 0.001, 7)
    expect(left[0].y0).toBeCloseTo(-0.32, 9) // ground slab
    expect(left[left.length - 1].y1).toBeCloseTo(E.eaveUnderside + E.roofVerticalDrop + 0.001 * Math.tan((40 * Math.PI) / 180), 4)
    const wallTop = verticalRuns(s, 0.001, 7).find((run) => run.y1 > 4 && run.y1 < 5)
    expect(wallTop).toBeDefined()
    // building height above terrain: ridge minus the terrain datum
    expect(r.ridgeY - E.terrain).toBeCloseTo(E.buildingHeightAboveTerrain, 4)
    // the garage roof is flat at 2.88, its underside on the garage walls
    const g = solidTriangles(s.scene, 'roof-garage')
    expect(upwardPlanes(g)[0].pitchDeg).toBeCloseTo(0, 9)
    expect(boundsOf(g)!.max.y).toBeCloseTo(E.garageRoofTop, 9)
    expect(boundsOf(solidTriangles(s.scene, 'gar-right'))!.max.y).toBeCloseTo(E.garageWallTop, 9)
  })

  it('the wall returns are walls: 0.61 m thick, dying into the roof soffit with no daylight, the garage return flat at 3.08', () => {
    for (const id of ['ret-west-front', 'ret-west-rear', 'ret-east-rear']) {
      const t = solidTriangles(s.scene, id)
      const b = boundsOf(t)!
      expect(b.max.x - b.min.x, id).toBeCloseTo(E.returnThickness, 9)
      expect(b.max.z - b.min.z, id).toBeCloseTo(1.0, 9)
      expect(b.min.y, id).toBeCloseTo(0, 9)
    }
    const eastFront = boundsOf(solidTriangles(s.scene, 'ret-east-front'))!
    expect(eastFront.min.y).toBeCloseTo(E.balconyTop, 9)
    expect(eastFront.min.x).toBeCloseTo(E.mainWidth - E.returnThickness, 9)
    const garage = boundsOf(solidTriangles(s.scene, 'ret-garage-front'))!
    expect(garage.max.y).toBeCloseTo(E.portalHeadTop, 9)
    expect(garage.min.x).toBeCloseTo(E.frontRecessX[1], 9)
    // the west return's top follows the soffit: 4.36 at its outer face, higher at its inner face
    const w = solidTriangles(s.scene, 'ret-west-front')
    expect(materialLength(w, V(0.001, -1, 0.5), V(0, 1, 0))).toBeCloseTo(E.eaveUnderside + 0.001 * Math.tan((40 * Math.PI) / 180), 4)
    expect(materialLength(w, V(0.609, -1, 0.5), V(0, 1, 0))).toBeCloseTo(E.eaveUnderside + 0.609 * Math.tan((40 * Math.PI) / 180), 4)
  })
})
