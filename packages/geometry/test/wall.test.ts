import { describe, expect, it } from 'vitest'
import { manifoldReport, materialLength, materialRuns, meshVolume, boundsOf } from '@buildapp/verification'
import { compileBuilding, solidTriangles, objectTriangles } from '../src/index.js'
import { V, withGround } from './helpers.js'

const wall = (extra: Record<string, unknown> = {}) => ({
  type: 'createWall' as const,
  id: 'w',
  levelId: 'ground',
  start: { x: 0, z: 0 },
  end: { x: 8, z: 0 },
  thickness: 0.4,
  height: 3,
  ...extra,
})

describe('wall compiler', () => {
  it('a plain wall compiles to a closed solid with the model dimensions', () => {
    const scene = compileBuilding(withGround(wall()))
    expect(scene.diagnostics).toEqual([])
    const tris = solidTriangles(scene, 'w')
    expect(manifoldReport(tris)).toMatchObject({ closed: true, boundaryEdges: 0, duplicateEdges: 0 })
    expect(meshVolume(tris)).toBeCloseTo(8 * 3 * 0.4, 9)
    // The outer face is z = 0 and material lies inward (+z) for a wall running +x.
    expect(boundsOf(tris)).toEqual({ min: V(0, 0, 0), max: V(8, 3, 0.4) })
    // Measured, not read back: a ray across the wall meets exactly the thickness.
    expect(materialLength(tris, V(4, 1.5, -1), V(0, 0, 1))).toBeCloseTo(0.4, 9)
    expect(materialLength(tris, V(-1, 1.5, 0.2), V(1, 0, 0))).toBeCloseTo(8, 9)
    expect(materialLength(tris, V(4, -1, 0.2), V(0, 1, 0))).toBeCloseTo(3, 9)
  })

  it('a structural opening really removes wall material', () => {
    const scene = compileBuilding(
      withGround(wall(), { type: 'cutOpening', id: 'o', wallId: 'w', kind: 'WINDOW', offset: 2, sill: 0.9, width: 1.5, height: 1.4 }),
    )
    expect(scene.diagnostics).toEqual([])
    const tris = solidTriangles(scene, 'w')
    expect(manifoldReport(tris)).toMatchObject({ closed: true, boundaryEdges: 0, duplicateEdges: 0 })
    expect(meshVolume(tris)).toBeCloseTo((8 * 3 - 1.5 * 1.4) * 0.4, 9)
    const through = V(0, 0, 1)
    // through the opening centre: no wall material
    expect(materialLength(tris, V(2.75, 1.6, -1), through)).toBe(0)
    // 50 mm inside the jambs, still nothing; 50 mm outside, the full thickness
    expect(materialLength(tris, V(2.05, 1.6, -1), through)).toBe(0)
    expect(materialLength(tris, V(3.45, 1.6, -1), through)).toBe(0)
    expect(materialLength(tris, V(1.95, 1.6, -1), through)).toBeCloseTo(0.4, 9)
    expect(materialLength(tris, V(3.55, 1.6, -1), through)).toBeCloseTo(0.4, 9)
    // below the sill and above the head
    expect(materialLength(tris, V(2.75, 0.85, -1), through)).toBeCloseTo(0.4, 9)
    expect(materialLength(tris, V(2.75, 2.35, -1), through)).toBeCloseTo(0.4, 9)
    // a horizontal sweep at mid-height finds the gap exactly where the model says
    const runs = materialRuns(tris, V(-1, 1.6, 0.2), V(1, 0, 0))
    expect(runs).toHaveLength(2)
    expect(runs[0].t0 - 1).toBeCloseTo(0, 9)
    expect(runs[0].t1 - 1).toBeCloseTo(2, 9)
    expect(runs[1].t0 - 1).toBeCloseTo(3.5, 9)
    expect(runs[1].t1 - 1).toBeCloseTo(8, 9)
    // the reveals belong to the opening but close the wall's solid
    const reveal = scene.meshes.find((m) => m.part === 'WALL_REVEAL')!
    expect(reveal).toMatchObject({ objectId: 'o', solidId: 'w', hostWallId: 'w', openingId: 'o' })
    expect(manifoldReport(scene.meshes.find((m) => m.objectId === 'w')!.triangles).closed).toBe(false)
  })

  it('a door opening at the base leaves the wall closed and the doorway empty to the floor', () => {
    const scene = compileBuilding(
      withGround(wall(), { type: 'cutOpening', id: 'd', wallId: 'w', kind: 'DOOR', offset: 3, sill: 0, width: 1, height: 2.1 }),
    )
    expect(scene.diagnostics).toEqual([])
    const tris = solidTriangles(scene, 'w')
    expect(manifoldReport(tris)).toMatchObject({ closed: true, boundaryEdges: 0, duplicateEdges: 0 })
    expect(meshVolume(tris)).toBeCloseTo((8 * 3 - 1 * 2.1) * 0.4, 9)
    expect(materialLength(tris, V(3.5, 0.05, -1), V(0, 0, 1))).toBe(0)
    expect(materialLength(tris, V(3.5, 2.05, -1), V(0, 0, 1))).toBe(0)
    expect(materialLength(tris, V(3.5, 2.15, -1), V(0, 0, 1))).toBeCloseTo(0.4, 9)
    // a vertical ray inside the doorway meets nothing until the lintel
    const runs = materialRuns(tris, V(3.5, -1, 0.2), V(0, 1, 0))
    expect(runs).toHaveLength(1)
    expect(runs[0].t0).toBeCloseTo(3.1, 9)
    expect(runs[0].t1).toBeCloseTo(4, 9)
  })

  it('several openings on one wall, stacked and side by side, all cut', () => {
    const scene = compileBuilding(
      withGround(
        wall({ height: 5 }),
        { type: 'cutOpening', id: 'oa', wallId: 'w', kind: 'WINDOW', offset: 1, sill: 0.8, width: 1, height: 1 },
        { type: 'cutOpening', id: 'ob', wallId: 'w', kind: 'WINDOW', offset: 1, sill: 3, width: 1, height: 1 },
        { type: 'cutOpening', id: 'oc', wallId: 'w', kind: 'DOOR', offset: 4, sill: 0, width: 1.2, height: 2.2 },
        { type: 'cutOpening', id: 'od', wallId: 'w', kind: 'WINDOW', offset: 6, sill: 1.2, width: 1, height: 0.6 },
      ),
    )
    expect(scene.diagnostics).toEqual([])
    const tris = solidTriangles(scene, 'w')
    expect(manifoldReport(tris)).toMatchObject({ closed: true, boundaryEdges: 0, duplicateEdges: 0 })
    expect(meshVolume(tris)).toBeCloseTo((8 * 5 - 1 - 1 - 1.2 * 2.2 - 0.6) * 0.4, 9)
    for (const [x, y] of [
      [1.5, 1.3],
      [1.5, 3.5],
      [4.6, 1.1],
      [6.5, 1.5],
    ]) {
      expect(materialLength(tris, V(x, y, -1), V(0, 0, 1))).toBe(0)
    }
    expect(materialLength(tris, V(1.5, 2.4, -1), V(0, 0, 1))).toBeCloseTo(0.4, 9)
  })

  it('a gable end wall with a polyline top is one piece of wall material', () => {
    const scene = compileBuilding(
      withGround(
        wall({ height: 5, topProfile: { kind: 'POLYLINE', points: [{ u: 0, height: 3 }, { u: 4, height: 5 }, { u: 8, height: 3 }] } }),
        { type: 'cutOpening', id: 'o', wallId: 'w', kind: 'WINDOW', offset: 3.4, sill: 3.2, width: 1.2, height: 1 },
      ),
    )
    expect(scene.diagnostics).toEqual([])
    const tris = solidTriangles(scene, 'w')
    expect(manifoldReport(tris)).toMatchObject({ closed: true, boundaryEdges: 0, duplicateEdges: 0 })
    // rectangle 8 x 3 plus the triangle 8 x 2 / 2, minus the gable window
    expect(meshVolume(tris)).toBeCloseTo((8 * 3 + 8 - 1.2 * 1) * 0.4, 9)
    // vertical rays measure the profile
    expect(materialLength(tris, V(0.5, -1, 0.2), V(0, 1, 0))).toBeCloseTo(3.25, 9)
    expect(materialLength(tris, V(2, -1, 0.2), V(0, 1, 0))).toBeCloseTo(4, 9)
    // the gable window is a hole: through it nothing, beside it the thickness
    expect(materialLength(tris, V(4, 3.7, -1), V(0, 0, 1))).toBe(0)
    expect(materialLength(tris, V(4, 4.5, -1), V(0, 0, 1))).toBeCloseTo(0.4, 9)
  })

  it('refuses an opening that would reach above a profiled top instead of clipping it', () => {
    const scene = compileBuilding(
      withGround(
        wall({ height: 5, topProfile: { kind: 'POLYLINE', points: [{ u: 0, height: 3 }, { u: 4, height: 5 }, { u: 8, height: 3 }] } }),
        { type: 'cutOpening', id: 'o', wallId: 'w', kind: 'WINDOW', offset: 0.5, sill: 2, width: 1, height: 1.5 },
      ),
    )
    expect(scene.diagnostics.map((d) => d.code)).toEqual(['OPENING_ABOVE_WALL_TOP'])
    const tris = solidTriangles(scene, 'w')
    expect(manifoldReport(tris).closed).toBe(true)
    expect(meshVolume(tris)).toBeCloseTo((8 * 3 + 8) * 0.4, 9)
    expect(scene.meshes.some((m) => m.part === 'WALL_REVEAL')).toBe(false)
  })

  it('walls under a gable roof die into its underside on both faces, gable ends rise into the gable', () => {
    const m = withGround(
      { type: 'createWall', id: 'front', levelId: 'ground', start: { x: 0, z: 0 }, end: { x: 8, z: 0 }, thickness: 0.4, height: 6 },
      { type: 'createWall', id: 'right', levelId: 'ground', start: { x: 8, z: 0.4 }, end: { x: 8, z: 5.6 }, thickness: 0.4, height: 6 },
      { type: 'createWall', id: 'rear', levelId: 'ground', start: { x: 8, z: 6 }, end: { x: 0, z: 6 }, thickness: 0.4, height: 6 },
      { type: 'createWall', id: 'left', levelId: 'ground', start: { x: 0, z: 5.6 }, end: { x: 0, z: 0.4 }, thickness: 0.4, height: 6 },
      {
        type: 'createRoof',
        id: 'roof',
        levelId: 'ground',
        kind: 'GABLE',
        footprint: { minX: 0, maxX: 8, minZ: 0, maxZ: 6 },
        eaveOffset: 3,
        pitchDeg: 40,
        ridgeAxis: 'X',
        overhang: 0.5,
        thickness: 0.2,
        capWallIds: ['front', 'right', 'rear', 'left'],
      },
    )
    const scene = compileBuilding(m)
    expect(scene.diagnostics).toEqual([])
    const drop = 0.2 / Math.cos((40 * Math.PI) / 180)
    const slope = Math.tan((40 * Math.PI) / 180)
    for (const id of ['front', 'right', 'rear', 'left']) {
      const tris = solidTriangles(scene, id)
      expect(manifoldReport(tris), id).toMatchObject({ closed: true, boundaryEdges: 0, duplicateEdges: 0 })
      expect(meshVolume(tris)).toBeGreaterThan(0)
    }
    const front = solidTriangles(scene, 'front')
    // eave wall: outer face stops at the underside at the eave, inner face 0.4 m further up the slope
    expect(materialLength(front, V(4, -1, 0.001), V(0, 1, 0))).toBeCloseTo(3 - drop + 0.001 * slope, 6)
    expect(materialLength(front, V(4, -1, 0.399), V(0, 1, 0))).toBeCloseTo(3 - drop + 0.399 * slope, 6)
    // no daylight and no shared solid between the wall top and the roof underside, on both faces
    const roof = solidTriangles(scene, 'roof')
    for (const z of [0.05, 0.2, 0.35]) {
      const w = materialRuns(front, V(4, -1, z), V(0, 1, 0))
      const r = materialRuns(roof, V(4, -1, z), V(0, 1, 0))
      expect(w).toHaveLength(1)
      expect(r).toHaveLength(1)
      expect(r[0].t0 - w[0].t1).toBeCloseTo(0, 9)
    }
    // gable end: rises to the ridge underside at the middle
    const left = solidTriangles(scene, 'left')
    expect(materialLength(left, V(0.2, -1, 3), V(0, 1, 0))).toBeCloseTo(3 + 3 * slope - drop, 9)
    expect(materialLength(left, V(0.2, -1, 1), V(0, 1, 0))).toBeCloseTo(3 + 1 * slope - drop, 9)
  })

  it('compiles the same local geometry wherever the wall stands (no global frame)', () => {
    const a = compileBuilding(withGround(wall(), { type: 'cutOpening', id: 'o', wallId: 'w', kind: 'WINDOW', offset: 2, sill: 0.9, width: 1.5, height: 1.4 }))
    const b = compileBuilding(
      withGround(
        { ...wall(), start: { x: 10, z: 20 }, end: { x: 10 + 8 * Math.cos(0.7), z: 20 + 8 * Math.sin(0.7) } },
        { type: 'cutOpening', id: 'o', wallId: 'w', kind: 'WINDOW', offset: 2, sill: 0.9, width: 1.5, height: 1.4 },
      ),
    )
    const ta = solidTriangles(a, 'w')
    const tb = solidTriangles(b, 'w')
    expect(tb.length).toBe(ta.length)
    expect(meshVolume(tb)).toBeCloseTo(meshVolume(ta), 9)
    expect(manifoldReport(tb).closed).toBe(true)
    // the opening is where the wall's own frame says it is
    const u = { x: Math.cos(0.7), y: 0, z: Math.sin(0.7) }
    const n = { x: -u.z, y: 0, z: u.x }
    const centre = V(10 + u.x * 2.75 + n.x * 2, 1.6, 20 + u.z * 2.75 + n.z * 2)
    expect(materialLength(tb, centre, { x: -n.x, y: 0, z: -n.z })).toBe(0)
    const beside = V(10 + u.x * 1.5 + n.x * 2, 1.6, 20 + u.z * 1.5 + n.z * 2)
    expect(materialLength(tb, beside, { x: -n.x, y: 0, z: -n.z })).toBeCloseTo(0.4, 9)
  })

  it('is deterministic and does not mutate its input', () => {
    const m = withGround(wall(), { type: 'cutOpening', id: 'o', wallId: 'w', kind: 'WINDOW', offset: 2, sill: 0.9, width: 1.5, height: 1.4 })
    const frozen = JSON.stringify(m)
    const a = compileBuilding(m)
    const b = compileBuilding(m)
    expect(JSON.stringify(m)).toBe(frozen)
    expect(a).toEqual(b)
    expect(objectTriangles(a, 'w').length).toBeGreaterThan(0)
  })
})
