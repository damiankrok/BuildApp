import { describe, expect, it } from 'vitest'
import { boundsOf, manifoldReport, materialLength, materialRuns, meshVolume } from '@buildapp/verification'
import { compileBuilding, objectTriangles, solidTriangles } from '../src/index.js'
import { V, withGround } from './helpers.js'

const wall = { type: 'createWall' as const, id: 'w', levelId: 'ground', start: { x: 0, z: 0 }, end: { x: 8, z: 0 }, thickness: 0.4, height: 3 }

describe('window fill', () => {
  it('occupies the opening: frame around, glass inside, all inside the wall thickness', () => {
    const scene = compileBuilding(
      withGround(
        wall,
        { type: 'cutOpening', id: 'o', wallId: 'w', kind: 'WINDOW', offset: 2, sill: 0.9, width: 1.5, height: 1.4 },
        { type: 'placeWindow', id: 'win', openingId: 'o', frameWidth: 0.07, frameDepth: 0.08, frameInset: 0.12, glassThickness: 0.024, divisions: 2 },
      ),
    )
    expect(scene.diagnostics).toEqual([])
    const parts = scene.meshes.filter((m) => m.objectId === 'win')
    expect(parts.map((p) => p.part).sort()).toEqual(['WINDOW_FRAME', 'WINDOW_GLASS', 'WINDOW_MULLION'])
    for (const p of parts) {
      expect(p).toMatchObject({ objectKind: 'window', hostWallId: 'w', openingId: 'o', structural: false })
      expect(manifoldReport(p.triangles), p.part).toMatchObject({ closed: true, boundaryEdges: 0, duplicateEdges: 0 })
      const b = boundsOf(p.triangles)!
      // inside the opening rectangle and inside the wall's thickness
      expect(b.min.x).toBeGreaterThanOrEqual(2 - 1e-9)
      expect(b.max.x).toBeLessThanOrEqual(3.5 + 1e-9)
      expect(b.min.y).toBeGreaterThanOrEqual(0.9 - 1e-9)
      expect(b.max.y).toBeLessThanOrEqual(2.3 + 1e-9)
      expect(b.min.z).toBeGreaterThanOrEqual(0.12 - 1e-9)
      expect(b.max.z).toBeLessThanOrEqual(0.2 + 1e-9)
    }
    const frame = parts.find((p) => p.part === 'WINDOW_FRAME')!.triangles
    expect(boundsOf(frame)).toEqual({ min: V(2, 0.9, 0.12), max: V(3.5, 2.3, 0.2) })
    expect(meshVolume(frame)).toBeCloseTo((1.5 * 1.4 - (1.5 - 0.14) * (1.4 - 0.14)) * 0.08, 9)
    // through the pane centre: no wall, the glass thickness of glazing, the opening otherwise empty
    const wallTris = solidTriangles(scene, 'w')
    const glass = parts.find((p) => p.part === 'WINDOW_GLASS')!.triangles
    const ray = { o: V(2.4, 1.6, -1), d: V(0, 0, 1) }
    expect(materialLength(wallTris, ray.o, ray.d)).toBe(0)
    expect(materialLength(glass, ray.o, ray.d)).toBeCloseTo(0.024, 9)
    expect(materialLength(frame, ray.o, ray.d)).toBe(0)
    // through the mullion: mullion material, no glass
    const mullion = parts.find((p) => p.part === 'WINDOW_MULLION')!.triangles
    expect(materialLength(mullion, V(2.75, 1.6, -1), ray.d)).toBeCloseTo(0.08, 9)
    expect(materialLength(glass, V(2.75, 1.6, -1), ray.d)).toBe(0)
  })
})

describe('door fill', () => {
  const door = (openAngle: number, hingeSide: 'LEFT' | 'RIGHT' = 'LEFT', swing: 'IN' | 'OUT' = 'IN') =>
    compileBuilding(
      withGround(
        wall,
        { type: 'cutOpening', id: 'o', wallId: 'w', kind: 'DOOR', offset: 3, sill: 0, width: 1, height: 2.1 },
        { type: 'placeDoor', id: 'd', openingId: 'o', hingeSide, swing, openAngle, leafThickness: 0.045, frameWidth: 0.06, frameDepth: 0.12, frameInset: 0.1 },
      ),
    )

  it('closed: frame, leaf and handle sit inside the opening; the opening is otherwise empty', () => {
    const scene = door(0)
    expect(scene.diagnostics).toEqual([])
    const parts = scene.meshes.filter((m) => m.objectId === 'd')
    expect(parts.map((p) => p.part).sort()).toEqual(['DOOR_FRAME', 'DOOR_HANDLE', 'DOOR_LEAF'])
    for (const p of parts) {
      expect(p).toMatchObject({ objectKind: 'door', hostWallId: 'w', openingId: 'o' })
      expect(manifoldReport(p.triangles), p.part).toMatchObject({ closed: true, boundaryEdges: 0, duplicateEdges: 0 })
    }
    const leaf = parts.find((p) => p.part === 'DOOR_LEAF')!.triangles
    const lb = boundsOf(leaf)!
    expect(lb.min.x).toBeGreaterThan(3.06)
    expect(lb.max.x).toBeLessThan(3.94)
    expect(lb.max.y).toBeLessThan(2.1 - 0.06)
    expect(lb.min.y).toBeGreaterThan(0)
    expect(lb.max.z - lb.min.z).toBeCloseTo(0.045, 9)
    expect(lb.min.z).toBeGreaterThan(0.1)
    expect(lb.max.z).toBeLessThan(0.22)
    // a ray through the leaf: no wall, exactly one leaf thickness, nothing else
    const wallTris = solidTriangles(scene, 'w')
    const frame = parts.find((p) => p.part === 'DOOR_FRAME')!.triangles
    expect(materialLength(wallTris, V(3.5, 1.0, -1), V(0, 0, 1))).toBe(0)
    expect(materialLength(leaf, V(3.5, 1.5, -1), V(0, 0, 1))).toBeCloseTo(0.045, 9)
    expect(materialLength(frame, V(3.5, 1.5, -1), V(0, 0, 1))).toBe(0)
    // the frame is a U: jamb material at the sides, head material above, none below the leaf
    expect(materialLength(frame, V(3.03, 1.0, -1), V(0, 0, 1))).toBeCloseTo(0.12, 9)
    expect(materialLength(frame, V(3.5, 2.07, -1), V(0, 0, 1))).toBeCloseTo(0.12, 9)
    expect(materialRuns(frame, V(3.5, -1, 0.16), V(0, 1, 0))).toEqual([{ t0: 1 + 2.04, t1: 1 + 2.1 }])
  })

  it('open: the leaf pivots about its hinge and swings out of the wall plane', () => {
    const scene = door(90)
    const leaf = objectTriangles(scene, 'd').length
    expect(leaf).toBeGreaterThan(0)
    const leafTris = scene.meshes.find((m) => m.objectId === 'd' && m.part === 'DOOR_LEAF')!.triangles
    const lb = boundsOf(leafTris)!
    // hinge on the left at x ~ 3.068; at 90 degrees the leaf runs along +z (into the building)
    expect(lb.min.x).toBeCloseTo(3.068 - 0.0225, 6)
    expect(lb.max.x - lb.min.x).toBeCloseTo(0.045, 9)
    expect(lb.max.z - lb.min.z).toBeCloseTo(1 - 0.12 - 0.016, 9)
    expect(lb.min.z).toBeGreaterThan(0.1)
    // the doorway itself is now empty of leaf material along its centre
    expect(materialLength(leafTris, V(3.5, 1.0, -1), V(0, 0, 1))).toBe(0)
    // swinging OUT goes the other way
    const outTris = door(90, 'LEFT', 'OUT').meshes.find((m) => m.objectId === 'd' && m.part === 'DOOR_LEAF')!.triangles
    expect(boundsOf(outTris)!.max.z).toBeLessThan(0.2)
    expect(boundsOf(outTris)!.min.z).toBeLessThan(-0.5)
    // a right-hand hinge pivots at the other jamb
    const rightTris = door(90, 'RIGHT').meshes.find((m) => m.objectId === 'd' && m.part === 'DOOR_LEAF')!.triangles
    expect(boundsOf(rightTris)!.max.x).toBeCloseTo(3.932 + 0.0225, 6)
  })

  it('leaf volume is width x height x thickness at any angle', () => {
    for (const angle of [0, 35, 90, 150]) {
      const leafTris = door(angle).meshes.find((m) => m.objectId === 'd' && m.part === 'DOOR_LEAF')!.triangles
      const lw = 1 - 0.12 - 0.016
      const lh = 2.1 - 0.06 - 0.008 - 0.01
      expect(meshVolume(leafTris), `angle ${angle}`).toBeCloseTo(lw * lh * 0.045, 9)
      expect(manifoldReport(leafTris).closed).toBe(true)
    }
  })
})
