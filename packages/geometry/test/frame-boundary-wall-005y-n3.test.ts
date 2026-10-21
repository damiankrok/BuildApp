/**
 * BUILDPLAN-ANALYZER-005Y-N3 (H2): a wall standing behind a gable frame, its outer face against the frame's back.
 * The frame is a verge member as deep as the porch in front of the wall: its strip ends exactly on the wall's outer
 * face. The wall is not under the frame, so its top there is the roof plate's underside, as on its inner face. It used
 * to take the frame's underside on the outer face (the strip's boundary was read as inside it): the top sloped across
 * the wall's thickness, and from the side a triangle of sky opened between the frame's foot and the eave, the sloped
 * top showing through it. A wall that does stand under the frame still stops at the frame's underside.
 */
import { describe, expect, it } from 'vitest'
import { compileBuilding } from '../src/index.js'
import { withGround } from './helpers.js'

const DEPTH = 1
const T = 0.5
const model = () =>
  withGround(
    { type: 'createRoof', id: 'roof', levelId: 'ground', kind: 'GABLE', footprint: { minX: 0, maxX: 8, minZ: 0, maxZ: 10 }, eaveOffset: 2.5, pitchDeg: 40, ridgeAxis: 'Z', thickness: 0.28, edgeMembers: { verge: { width: 0.8, depth: DEPTH, ends: [{ side: 'MIN_Z', width: 0.8, depth: DEPTH }], materialId: 'm' } } },
    // the front wall behind the frame: its outer face on z = DEPTH, its material from there inward
    { type: 'createWall', id: 'front', levelId: 'ground', start: { x: 0, z: DEPTH }, end: { x: 8, z: DEPTH }, thickness: T, height: 8, kind: 'EXTERIOR', topProfile: { kind: 'FOLLOW_ROOF', roofId: 'roof' } },
    // a return under the frame, from the front edge back to the wall
    { type: 'createWall', id: 'return', levelId: 'ground', start: { x: 8, z: 0 }, end: { x: 8, z: DEPTH }, thickness: T, height: 8, kind: 'EXTERIOR', topProfile: { kind: 'FOLLOW_ROOF', roofId: 'roof' } },
  )

/** The highest point of a wall's mesh on the plane z = `z`, over x in [x0, x1]. */
const topOn = (id: string, z: number, x0: number, x1: number): number => {
  let top = -Infinity
  for (const mesh of compileBuilding(model()).meshes.filter((m) => m.objectId === id && m.part === 'WALL'))
    for (const t of mesh.triangles) for (const p of [t.a, t.b, t.c]) if (Math.abs(p.z - z) < 1e-6 && p.x >= x0 - 1e-6 && p.x <= x1 + 1e-6) top = Math.max(top, p.y)
  return top
}

describe('a wall behind a gable frame', () => {
  it('reaches the roof plate on its outer face, as on its inner face: no wedge across its thickness', () => {
    // near the eave, where the plate is lowest: both faces stop at the same underside
    const outer = topOn('front', DEPTH, 8, 8)
    const inner = topOn('front', DEPTH + T, 8, 8)
    expect(outer).toBeCloseTo(inner, 5)
  })
  it('leaves a wall standing under the frame stopping at the frame’s underside, lower than the plate', () => {
    const underFrame = topOn('return', 0, 8, 8)
    const behind = topOn('front', DEPTH, 8, 8)
    expect(underFrame).toBeLessThan(behind - 0.3)
  })
  it('compiles without a sliver or a diagnostic', () => {
    expect(compileBuilding(model()).diagnostics).toEqual([])
  })
})
