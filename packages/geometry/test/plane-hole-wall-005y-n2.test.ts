/**
 * BUILDPLAN-ANALYZER-005Y-N2: a wall that dies into roof planes stops at the plane even where the plane is cut. A
 * chimney's penetration (or a rooflight's opening) is a hole in the roof's covering, not in what the roof bears on: a
 * partition standing under one used to keep its nominal height there and rise through the roof as a spike, with a
 * WALL_NOT_UNDER_ROOF warning. The wall here ends inside the hole, as the partition under the chimney did.
 */
import { describe, expect, it } from 'vitest'
import { compileBuilding } from '../src/index.js'
import { withGround } from './helpers.js'

const model = (hole: boolean) =>
  withGround(
    { type: 'createRoofPlane', id: 'p', levelId: 'ground', boundary: [{ x: 0, z: 0 }, { x: 6, z: 0 }, { x: 6, z: 6 }, { x: 0, z: 6 }], datum: { x: 0, y: 2.5, z: 0 }, pitchDeg: 0, thickness: 0.2 },
    { type: 'createWall', id: 'w', levelId: 'ground', start: { x: 2, z: 3 }, end: { x: 3, z: 3 }, thickness: 0.2, height: 6, kind: 'INTERIOR', topProfile: { kind: 'FOLLOW_ROOF_PLANES', planeIds: ['p'] } },
    ...(hole ? [{ type: 'cutRoofOpening' as const, id: 'pen', roofId: 'p', kind: 'PENETRATION' as const, footprint: { minX: 2.6, maxX: 3.4, minZ: 2.7, maxZ: 3.5 }, cut: 'VERTICAL' as const }] : []),
  )

const wallTop = (m: ReturnType<typeof model>): number => {
  const scene = compileBuilding(m)
  let top = -Infinity
  for (const mesh of scene.meshes.filter((x) => x.objectId === 'w')) for (const t of mesh.triangles) for (const p of [t.a, t.b, t.c]) top = Math.max(top, p.y)
  return top
}

describe('a wall under a cut roof plane', () => {
  it('stops at the plane under the hole as it does beside it, and is not reported as standing outside the roof', () => {
    const plain = wallTop(model(false))
    const cut = wallTop(model(true))
    expect(plain).toBeLessThan(2.5)
    expect(cut).toBeCloseTo(plain, 6)
    expect(compileBuilding(model(true)).diagnostics.filter((d) => d.code === 'WALL_NOT_UNDER_ROOF')).toEqual([])
  })
})
