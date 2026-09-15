/**
 * Generic (non-Marcówki) proofs of the STAGE BUILDAPP-01 primitives:
 * raked-head openings, multi-leaf passages, roof openings, rooflights and
 * chimney penetrations. Every number is measured from emitted triangles by
 * the independent oracles; nothing is read back from the model.
 */
import { describe, expect, it } from 'vitest'
import { boundsOf, manifoldReport, materialLength, materialRuns, meshVolume, overlapEstimate, upwardPlanes } from '@buildapp/verification'
import { compileBuilding, solidTriangles } from '../src/index.js'
import { V, withGround } from './helpers.js'

const wall = (extra: Record<string, unknown> = {}) => ({ type: 'createWall' as const, id: 'w', levelId: 'ground', start: { x: 0, z: 0 }, end: { x: 8, z: 0 }, thickness: 0.4, height: 6, ...extra })
const through = V(0, 0, 1)

describe('raked-head openings', () => {
  // A 2.7 m opening whose head falls from 3.2 m to 0.9 m across it (a gable window under a 40°-ish roof line).
  const NEAR = 3.2
  const FAR = 0.9
  const OFF = 2
  const W = 2.7
  const headAt = (x: number): number => NEAR + ((x - OFF) / W) * (FAR - NEAR)
  const model = () =>
    withGround(
      wall({ topProfile: { kind: 'POLYLINE', points: [{ u: 0, height: 3.5 }, { u: 2, height: 5.5 }, { u: 8, height: 2.5 }] } }),
      { type: 'cutOpening', id: 'g', wallId: 'w', kind: 'WINDOW', offset: OFF, sill: 0, width: W, height: NEAR, head: { kind: 'RAKED', heightFar: FAR } },
      { type: 'placeWindow', id: 'win', openingId: 'g', frameWidth: 0.07, frameDepth: 0.08, frameInset: 0.12, glassThickness: 0.024, mullions: [0.374] },
    )

  it('is one structural trapezoidal hole: the wall closes, its volume drops by the trapezoid, and rays agree with the source line', () => {
    const scene = compileBuilding(model())
    expect(scene.diagnostics).toEqual([])
    const tris = solidTriangles(scene, 'w')
    expect(manifoldReport(tris)).toMatchObject({ closed: true, boundaryEdges: 0, duplicateEdges: 0 })
    // the wall without the opening: rectangle 8 x 3.5 plus the two roof triangles
    const gross = 8 * 2.5 + (2 * (3.5 - 2.5)) / 1 + ((2 * (5.5 - 3.5)) / 2 + (6 * (5.5 - 2.5)) / 2)
    const trapezoid = ((NEAR + FAR) / 2) * W
    expect(meshVolume(tris)).toBeCloseTo((gross - trapezoid) * 0.4, 9)
    // along the head line: just below it nothing, just above it the full thickness, at 9 stations
    for (let k = 0; k <= 8; k++) {
      const x = OFF + 0.05 + (k / 8) * (W - 0.1)
      const h = headAt(x)
      expect(materialLength(tris, V(x, h - 0.02, -1), through), `below head at ${x}`).toBe(0)
      expect(materialLength(tris, V(x, h + 0.02, -1), through), `above head at ${x}`).toBeCloseTo(0.4, 9)
      expect(materialLength(tris, V(x, 0.3, -1), through), `low in the opening at ${x}`).toBe(0)
    }
    // beside the jambs the wall is there at every height inside the opening
    expect(materialLength(tris, V(OFF - 0.05, 2.0, -1), through)).toBeCloseTo(0.4, 9)
    expect(materialLength(tris, V(OFF + W + 0.05, 0.5, -1), through)).toBeCloseTo(0.4, 9)
    // a vertical ray through the opening meets wall only above the raked head, up to the profiled top
    const runs = materialRuns(tris, V(4, -1, 0.2), V(0, 1, 0))
    expect(runs).toHaveLength(1)
    expect(runs[0].t0 - 1).toBeCloseTo(headAt(4), 9)
    expect(runs[0].t1 - 1).toBeCloseTo(5.5 - (2 / 6) * 3, 9)
    // one opening, one set of reveals, hosted by the wall
    const reveals = scene.meshes.filter((m) => m.part === 'WALL_REVEAL')
    expect(reveals).toHaveLength(1)
    expect(reveals[0]).toMatchObject({ objectId: 'g', hostWallId: 'w', solidId: 'w' })
  })

  it('the fill follows the trapezoid: closed frame, glass panes split at the stated mullion, nothing above the head line', () => {
    const scene = compileBuilding(model())
    const parts = scene.meshes.filter((m) => m.objectId === 'win')
    expect(parts.map((p) => p.part).sort()).toEqual(['WINDOW_FRAME', 'WINDOW_GLASS', 'WINDOW_MULLION'])
    for (const p of parts) {
      expect(manifoldReport(p.triangles), p.part).toMatchObject({ closed: true, boundaryEdges: 0, duplicateEdges: 0 })
      expect(meshVolume(p.triangles), p.part).toBeGreaterThan(0)
      const b = boundsOf(p.triangles)!
      expect(b.min.x).toBeGreaterThanOrEqual(OFF - 1e-9)
      expect(b.max.x).toBeLessThanOrEqual(OFF + W + 1e-9)
      expect(b.min.z).toBeGreaterThanOrEqual(0.12 - 1e-9)
      expect(b.max.z).toBeLessThanOrEqual(0.2 + 1e-9)
    }
    const glass = parts.find((p) => p.part === 'WINDOW_GLASS')!.triangles
    const frame = parts.find((p) => p.part === 'WINDOW_FRAME')!.triangles
    const mullion = parts.find((p) => p.part === 'WINDOW_MULLION')!.triangles
    // no glass or frame above the source head line anywhere across the opening
    for (let k = 0; k <= 10; k++) {
      const x = OFF + 0.01 + (k / 10) * (W - 0.02)
      expect(materialLength(glass, V(x, headAt(x) + 0.01, -1), through), `glass above head at ${x}`).toBe(0)
      expect(materialLength(frame, V(x, headAt(x) + 0.01, -1), through), `frame above head at ${x}`).toBe(0)
    }
    // frame member just under the head, glass further down, on both sides of the mullion
    const mx = OFF + 0.374 * W
    for (const x of [OFF + 0.5, mx + 0.4]) {
      expect(materialLength(frame, V(x, headAt(x) - 0.03, -1), through)).toBeCloseTo(0.08, 9)
      expect(materialLength(glass, V(x, headAt(x) - 0.3, -1), through)).toBeCloseTo(0.024, 9)
    }
    // the mullion stands at the stated fraction, and the glass is split there
    expect(materialLength(mullion, V(mx, 0.4, -1), through)).toBeCloseTo(0.08, 9)
    expect(materialLength(glass, V(mx, 0.4, -1), through)).toBe(0)
    expect(materialLength(mullion, V(mx + 0.2, 0.4, -1), through)).toBe(0)
  })

  it('a raked head that would reach above the wall top is refused by name, not clipped', () => {
    const scene = compileBuilding(
      withGround(
        wall({ height: 3 }),
        { type: 'cutOpening', id: 'g', wallId: 'w', kind: 'WINDOW', offset: 2, sill: 0, width: 2, height: 1.5, head: { kind: 'RAKED', heightFar: 2.95 } },
      ),
    )
    // 2.95 clears a 3 m wall: accepted. 3.05 does not: the model refuses it before the compiler sees it.
    expect(scene.diagnostics).toEqual([])
    expect(() =>
      withGround(wall({ height: 3 }), { type: 'cutOpening', id: 'g', wallId: 'w', kind: 'WINDOW', offset: 2, sill: 0, width: 2, height: 1.5, head: { kind: 'RAKED', heightFar: 3.05 } }),
    ).toThrow(/OPENING_OUTSIDE_HOST/)
  })

  it('is invariant under rigid motion and mirrored by swapping near and far heights', () => {
    const a = solidTriangles(compileBuilding(model()), 'w')
    const b = solidTriangles(
      compileBuilding(
        withGround(
          wall({ start: { x: 10, z: 20 }, end: { x: 10 + 8 * Math.cos(0.7), z: 20 + 8 * Math.sin(0.7) }, topProfile: { kind: 'POLYLINE', points: [{ u: 0, height: 3.5 }, { u: 2, height: 5.5 }, { u: 8, height: 2.5 }] } }),
          { type: 'cutOpening', id: 'g', wallId: 'w', kind: 'WINDOW', offset: OFF, sill: 0, width: W, height: NEAR, head: { kind: 'RAKED', heightFar: FAR } },
        ),
      ),
      'w',
    )
    expect(b.length).toBe(a.length)
    expect(meshVolume(b)).toBeCloseTo(meshVolume(a), 9)
    const swapped = solidTriangles(
      compileBuilding(withGround(wall(), { type: 'cutOpening', id: 'g', wallId: 'w', kind: 'WINDOW', offset: 2, sill: 0, width: 2, height: 1, head: { kind: 'RAKED', heightFar: 3 } })),
      'w',
    )
    expect(manifoldReport(swapped).closed).toBe(true)
    // head 1.5 at x 2.5 and 2.5 at x 3.5: material above the line, none below it
    expect(materialLength(swapped, V(2.5, 1.6, -1), through)).toBeCloseTo(0.4, 9)
    expect(materialLength(swapped, V(2.5, 1.4, -1), through)).toBe(0)
    expect(materialLength(swapped, V(3.5, 2.4, -1), through)).toBe(0)
    expect(materialLength(swapped, V(3.5, 2.6, -1), through)).toBeCloseTo(0.4, 9)
  })
})

describe('multi-leaf passages', () => {
  // Two rings back to back: the main body's right wall and the annex's left wall share the plane x = 8.
  const house = () =>
    withGround(
      { type: 'createWallRing', id: 'main', levelId: 'ground', polygon: [{ x: 0, z: 0 }, { x: 8, z: 0 }, { x: 8, z: 6 }, { x: 0, z: 6 }], thickness: 0.3, height: 3 },
      { type: 'createWallRing', id: 'annex', levelId: 'ground', polygon: [{ x: 8.3, z: 1 }, { x: 12, z: 1 }, { x: 12, z: 5 }, { x: 8.3, z: 5 }], thickness: 0.2, height: 3 },
      // main-w1 runs (8,0)->(8,6); annex-w3 runs (8.3,5)->(8.3,1): the passage is at z 2.5..3.5 on both
      { type: 'cutOpening', id: 'pass', wallId: 'main-w1', kind: 'DOOR', offset: 2.5, sill: 0, width: 1, height: 2.1, leaves: [{ wallId: 'annex-w3', offset: 1.5 }] },
      { type: 'placeDoor', id: 'door', openingId: 'pass' },
    )

  it('one semantic opening cuts every leaf: a ray through the passage crosses no wall at all', () => {
    const scene = compileBuilding(house())
    expect(scene.diagnostics).toEqual([])
    const main = solidTriangles(scene, 'main-w1')
    const annex = solidTriangles(scene, 'annex-w3')
    expect(manifoldReport(main)).toMatchObject({ closed: true })
    expect(manifoldReport(annex)).toMatchObject({ closed: true })
    const ray = { o: V(7, 1, 3), d: V(1, 0, 0) }
    expect(materialLength(main, ray.o, ray.d)).toBe(0)
    expect(materialLength(annex, ray.o, ray.d)).toBe(0)
    // beside the passage both leaves are there: 0.3 + 0.2
    expect(materialLength(main, V(7, 1, 4), V(1, 0, 0))).toBeCloseTo(0.3, 9)
    expect(materialLength(annex, V(7, 1, 4), V(1, 0, 0))).toBeCloseTo(0.2, 9)
    // both leaves lost exactly the passage's material
    expect(meshVolume(main)).toBeCloseTo((6 - 0.6) * 3 * 0.3 - 1 * 2.1 * 0.3, 9)
    expect(meshVolume(annex)).toBeCloseTo((4 - 0.4) * 3 * 0.2 - 1 * 2.1 * 0.2, 9) // trimmed by its two corners
    // one opening: two reveal meshes, each hosted by its own leaf, one door fill in the host leaf
    const reveals = scene.meshes.filter((m) => m.part === 'WALL_REVEAL')
    expect(reveals.map((r) => [r.objectId, r.hostWallId, r.solidId])).toEqual([
      ['pass', 'annex-w3', 'annex-w3'],
      ['pass', 'main-w1', 'main-w1'],
    ])
    const door = scene.meshes.filter((m) => m.objectId === 'door')
    expect(door.length).toBe(3)
    for (const d of door) expect(d).toMatchObject({ hostWallId: 'main-w1', openingId: 'pass' })
    expect(scene.stats.objectCount).toBe(scene.meshes.filter((m) => m.objectKind !== 'opening').map((m) => m.objectId).filter((v, i, a) => a.indexOf(v) === i).length + 1)
  })

  it('MUTATION: the passage cut in one leaf only leaves the far leaf standing in the doorway, which a ray notices', () => {
    const scene = compileBuilding(
      withGround(
        { type: 'createWallRing', id: 'main', levelId: 'ground', polygon: [{ x: 0, z: 0 }, { x: 8, z: 0 }, { x: 8, z: 6 }, { x: 0, z: 6 }], thickness: 0.3, height: 3 },
        { type: 'createWallRing', id: 'annex', levelId: 'ground', polygon: [{ x: 8.3, z: 1 }, { x: 12, z: 1 }, { x: 12, z: 5 }, { x: 8.3, z: 5 }], thickness: 0.2, height: 3 },
        { type: 'cutOpening', id: 'pass', wallId: 'main-w1', kind: 'DOOR', offset: 2.5, sill: 0, width: 1, height: 2.1 },
      ),
    )
    const all = ['main-w1', 'annex-w3'].map((id) => solidTriangles(scene, id))
    const total = all.reduce((s, t) => s + materialLength(t, V(7, 1, 3), V(1, 0, 0)), 0)
    expect(total).toBeCloseTo(0.2, 9) // the annex leaf still blocks the passage
  })
})

describe('roof openings', () => {
  const roof = (extra: Record<string, unknown> = {}) => ({
    type: 'createRoof' as const,
    id: 'r',
    levelId: 'ground',
    kind: 'GABLE' as const,
    footprint: { minX: 0, maxX: 10, minZ: 0, maxZ: 8 },
    eaveOffset: 3,
    pitchDeg: 40,
    ridgeAxis: 'X' as const,
    overhang: 0.4,
    thickness: 0.2,
    ...extra,
  })
  const slope = Math.tan((40 * Math.PI) / 180)
  const drop = 0.2 / Math.cos((40 * Math.PI) / 180)

  it('a rooflight cut is a real hole in one slope: the roof stays one closed solid, its volume drops by the prism, the ridge and eaves are untouched', () => {
    const scene = compileBuilding(
      withGround(
        roof(),
        { type: 'cutRoofOpening', id: 'ro', roofId: 'r', kind: 'ROOFLIGHT', footprint: { minX: 2, maxX: 2.78, minZ: 1, maxZ: 1.9 } },
        { type: 'placeRooflight', id: 'rl', roofOpeningId: 'ro', frameWidth: 0.07, glassThickness: 0.024 },
      ),
    )
    expect(scene.diagnostics).toEqual([])
    const tris = solidTriangles(scene, 'r')
    expect(manifoldReport(tris)).toMatchObject({ closed: true, boundaryEdges: 0, duplicateEdges: 0 })
    expect(meshVolume(tris)).toBeCloseTo(10.8 * 8.8 * drop - 0.78 * 0.9 * drop, 9)
    // through the hole: no roof; 5 cm outside it: the full vertical drop
    expect(materialLength(tris, V(2.4, 0, 1.5), V(0, 1, 0))).toBe(0)
    expect(materialLength(tris, V(2.4, 0, 0.95), V(0, 1, 0))).toBeCloseTo(drop, 9)
    expect(materialLength(tris, V(1.95, 0, 1.5), V(0, 1, 0))).toBeCloseTo(drop, 9)
    expect(materialLength(tris, V(2.83, 0, 1.5), V(0, 1, 0))).toBeCloseTo(drop, 9)
    // pitch, ridge and bounds as without the hole
    const planes = upwardPlanes(tris)
    for (const p of planes) expect(p.pitchDeg).toBeCloseTo(40, 9)
    const b = boundsOf(tris)!
    expect(b.max.y).toBeCloseTo(3 + 4 * slope, 12)
    expect(b.min.x).toBeCloseTo(-0.4, 12)
    expect(b.max.z).toBeCloseTo(8.4, 12)
    // the reveals belong to the opening and close the roof's solid
    const reveals = scene.meshes.filter((m) => m.part === 'ROOF_REVEAL')
    expect(reveals).toHaveLength(1)
    expect(reveals[0]).toMatchObject({ objectId: 'ro', objectKind: 'roofOpening', hostRoofId: 'r', solidId: 'r', openingId: 'ro' })
    expect(manifoldReport(scene.meshes.find((m) => m.objectId === 'r')!.triangles).closed).toBe(false)
    // the rooflight fills the hole: closed frame and glass, inside the hole's plan rectangle and the roof's depth
    const parts = scene.meshes.filter((m) => m.objectId === 'rl')
    expect(parts.map((p) => p.part).sort()).toEqual(['ROOFLIGHT_FRAME', 'ROOFLIGHT_GLASS'])
    for (const p of parts) {
      expect(manifoldReport(p.triangles), p.part).toMatchObject({ closed: true, boundaryEdges: 0, duplicateEdges: 0 })
      expect(p).toMatchObject({ objectKind: 'rooflight', hostRoofId: 'r', openingId: 'ro', structural: false })
      const pb = boundsOf(p.triangles)!
      expect(pb.min.x).toBeGreaterThanOrEqual(2 - 1e-9)
      expect(pb.max.x).toBeLessThanOrEqual(2.78 + 1e-9)
      expect(pb.min.z).toBeGreaterThanOrEqual(1 - 1e-9)
      expect(pb.max.z).toBeLessThanOrEqual(1.9 + 1e-9)
    }
    const frame = parts.find((p) => p.part === 'ROOFLIGHT_FRAME')!.triangles
    const glass = parts.find((p) => p.part === 'ROOFLIGHT_GLASS')!.triangles
    expect(meshVolume(frame)).toBeCloseTo((0.78 * 0.9 - 0.64 * 0.76) * drop, 9)
    // a vertical ray through the pane centre: glass only, no frame, no roof
    expect(materialLength(glass, V(2.39, 0, 1.45), V(0, 1, 0))).toBeCloseTo(0.024, 9)
    expect(materialLength(frame, V(2.39, 0, 1.45), V(0, 1, 0))).toBe(0)
    expect(materialLength(frame, V(2.03, 0, 1.45), V(0, 1, 0))).toBeCloseTo(drop, 9)
    // the pane sits at mid-depth of the roof
    const runs = materialRuns(glass, V(2.39, 0, 1.45), V(0, 1, 0))
    const top = 3 + (4 - Math.abs(1.45 - 4)) * slope
    expect((runs[0].t0 + runs[0].t1) / 2).toBeCloseTo(top - drop / 2, 9)
  })

  it('a chimney passes through a penetration with no shared volume and no daylight around it', () => {
    const scene = compileBuilding(
      withGround(
        roof(),
        { type: 'placeChimney', id: 'ch', levelId: 'ground', footprint: { minX: 6, maxX: 6.6, minZ: 5, maxZ: 5.6 }, height: 8 },
        { type: 'cutRoofOpening', id: 'pen', roofId: 'r', kind: 'PENETRATION', footprint: { minX: 6, maxX: 6.6, minZ: 5, maxZ: 5.6 }, throughId: 'ch' },
      ),
    )
    expect(scene.diagnostics).toEqual([])
    const roofTris = solidTriangles(scene, 'r')
    const chimney = solidTriangles(scene, 'ch')
    expect(manifoldReport(roofTris)).toMatchObject({ closed: true, boundaryEdges: 0, duplicateEdges: 0 })
    const est = overlapEstimate(roofTris, chimney, 0.05)
    expect(est.volume).toBe(0)
    expect(est.worstSharedLength).toBe(0)
    // inside the footprint: chimney only; 1 cm outside it: roof only — no gap ring around the stack
    expect(materialLength(roofTris, V(6.3, 0, 5.3), V(0, 1, 0))).toBe(0)
    expect(materialLength(chimney, V(6.3, 0, 5.3), V(0, 1, 0))).toBeCloseTo(8, 9)
    expect(materialLength(roofTris, V(6.61, 0, 5.3), V(0, 1, 0))).toBeCloseTo(drop, 9)
    expect(materialLength(roofTris, V(6.3, 0, 4.99), V(0, 1, 0))).toBeCloseTo(drop, 9)
  })

  it('MUTATION: the same chimney without its penetration shares volume with the roof, which the overlap oracle finds', () => {
    const scene = compileBuilding(withGround(roof(), { type: 'placeChimney', id: 'ch', levelId: 'ground', footprint: { minX: 6, maxX: 6.6, minZ: 5, maxZ: 5.6 }, height: 8 }))
    const est = overlapEstimate(solidTriangles(scene, 'r'), solidTriangles(scene, 'ch'), 0.05)
    expect(est.worstSharedLength).toBeCloseTo(drop, 6)
    expect(est.volume).toBeGreaterThan(0.3 * 0.36 * drop)
  })

  it('several openings on both slopes and on a flat roof: still one closed solid each, volumes exact', () => {
    const gable = compileBuilding(
      withGround(
        roof(),
        { type: 'cutRoofOpening', id: 'ra', roofId: 'r', kind: 'ROOFLIGHT', footprint: { minX: 1, maxX: 1.8, minZ: 0.5, maxZ: 1.5 } },
        { type: 'cutRoofOpening', id: 'rb', roofId: 'r', kind: 'ROOFLIGHT', footprint: { minX: 4, maxX: 4.8, minZ: 1, maxZ: 2 } },
        { type: 'cutRoofOpening', id: 'rc', roofId: 'r', kind: 'ROOFLIGHT', footprint: { minX: 2, maxX: 3, minZ: 6, maxZ: 7 } },
        { type: 'cutRoofOpening', id: 'rd', roofId: 'r', kind: 'ROOFLIGHT', footprint: { minX: 8, maxX: 9, minZ: 5, maxZ: 7.5 } },
      ),
    )
    expect(gable.diagnostics).toEqual([])
    const g = solidTriangles(gable, 'r')
    expect(manifoldReport(g)).toMatchObject({ closed: true, boundaryEdges: 0, duplicateEdges: 0 })
    expect(meshVolume(g)).toBeCloseTo((10.8 * 8.8 - 0.8 - 0.8 - 1 - 2.5) * drop, 9)
    const flat = compileBuilding(
      withGround(
        { type: 'createRoof', id: 'f', levelId: 'ground', kind: 'FLAT', footprint: { minX: 0, maxX: 5, minZ: 0, maxZ: 6 }, eaveOffset: 2.8, thickness: 0.25 },
        { type: 'cutRoofOpening', id: 'h', roofId: 'f', kind: 'ROOFLIGHT', footprint: { minX: 1, maxX: 2, minZ: 2, maxZ: 3 } },
        { type: 'placeRooflight', id: 'rl', roofOpeningId: 'h' },
      ),
    )
    expect(flat.diagnostics).toEqual([])
    const f = solidTriangles(flat, 'f')
    expect(manifoldReport(f)).toMatchObject({ closed: true, boundaryEdges: 0, duplicateEdges: 0 })
    expect(meshVolume(f)).toBeCloseTo((30 - 1) * 0.25, 9)
    expect(materialLength(f, V(1.5, 0, 2.5), V(0, 1, 0))).toBe(0)
    for (const p of flat.meshes.filter((m) => m.objectId === 'rl')) expect(manifoldReport(p.triangles).closed).toBe(true)
  })

  it('a roof without openings compiles exactly as before (same volume, closed, same pitch)', () => {
    const tris = solidTriangles(compileBuilding(withGround(roof())), 'r')
    expect(manifoldReport(tris)).toMatchObject({ closed: true, boundaryEdges: 0, duplicateEdges: 0 })
    expect(meshVolume(tris)).toBeCloseTo(10.8 * 8.8 * drop, 9)
    expect(upwardPlanes(tris)).toHaveLength(2)
  })
})
