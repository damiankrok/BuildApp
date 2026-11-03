/**
 * LINK-F1C: a wall that dies into two roof planes meeting in a valley which crosses the wall's thickness at a slant.
 * The top used to be read at the two faces only and ruled between them; over the valley (the lowest line of the
 * surface) that ruled top rose through the plane — the Rarytasy wall under the garage roof's valley. Across such a
 * section the top is now the lowest underside over it. A wall the valley does not cross keeps its exact top.
 * Invented geometry: two 30° planes over a 6 m square, the valley on its diagonal x = z.
 */
import { describe, expect, it } from 'vitest'
import { compileBuilding, geometryClosureAudit } from '../src/index.js'
import { withGround } from './helpers.js'

const PITCH = 30
const tan = Math.tan((PITCH * Math.PI) / 180)
// A falls along +x from y 3 at x = 0, B along +z from y 3 at z = 0: equal on the valley x = z, higher either side; the
// mirror (x → 6 − x) puts the valley on x + z = 6, crossing a wall's top quads along their other diagonal
const planesOf = (mirror: boolean) => [
  { type: 'createRoofPlane' as const, id: 'pa', levelId: 'ground', boundary: mirror ? [{ x: 6, z: 0 }, { x: 6, z: 6 }, { x: 0, z: 6 }] : [{ x: 0, z: 0 }, { x: 6, z: 6 }, { x: 0, z: 6 }], datum: { x: mirror ? 6 : 0, y: 3, z: 0 }, pitchDeg: PITCH, downslope: { x: mirror ? -1 : 1, z: 0 }, thickness: 0.2 },
  { type: 'createRoofPlane' as const, id: 'pb', levelId: 'ground', boundary: mirror ? [{ x: 6, z: 0 }, { x: 0, z: 6 }, { x: 0, z: 0 }] : [{ x: 0, z: 0 }, { x: 6, z: 0 }, { x: 6, z: 6 }], datum: { x: 0, y: 3, z: 0 }, pitchDeg: PITCH, downslope: { x: 0, z: 1 }, thickness: 0.2 },
]
let MIRROR = false
const model = (z: number, from = 1, to = 5) =>
  withGround(...planesOf(MIRROR), { type: 'createWall', id: 'w', levelId: 'ground', start: { x: from, z }, end: { x: to, z }, thickness: 0.3, height: 6, kind: 'INTERIOR', topProfile: { kind: 'FOLLOW_ROOF_PLANES', planeIds: ['pa', 'pb'] } })
const intersections = (m: ReturnType<typeof model>) => geometryClosureAudit(m, compileBuilding(m)).findings.filter((f) => f.code === 'INTERSECTION' && f.objects.includes('w'))
const topVertices = (m: ReturnType<typeof model>) => compileBuilding(m).meshes.filter((x) => x.objectId === 'w').flatMap((x) => x.triangles.flatMap((t) => [t.a, t.b, t.c])).filter((p) => p.y > 0.5)
/** The most any point of the wall's top triangles stands above the underside (sampled inside every triangle). */
const rise = (m: ReturnType<typeof model>): number => {
  let worst = -Infinity
  for (const mesh of compileBuilding(m).meshes.filter((x) => x.objectId === 'w')) {
    for (const t of mesh.triangles) {
      if (Math.min(t.a.y, t.b.y, t.c.y) < 0.5) continue
      for (let i = 0; i <= 10; i += 1) for (let j = 0; i + j <= 10; j += 1) {
        const k = 10 - i - j
        const x = (t.a.x * i + t.b.x * j + t.c.x * k) / 10
        const y = (t.a.y * i + t.b.y * j + t.c.y * k) / 10
        const z = (t.a.z * i + t.b.z * j + t.c.z * k) / 10
        worst = Math.max(worst, y - underside(x, z))
      }
    }
  }
  return worst
}
const underside = (x: number, z: number): number => Math.max(3 - (MIRROR ? 6 - x : x) * tan, 3 - z * tan) - 0.2 / Math.cos((PITCH * Math.PI) / 180)

describe.each([false, true])('LINK-F1C a wall top under a valley that crosses its thickness (mirrored: %s)', (mirror) => {
  MIRROR = mirror
  it('does not rise through either plane', () => {
    MIRROR = mirror
    for (const m of [model(3), model(3, 1, 5)]) {
      expect(intersections(m)).toEqual([])
      expect(rise(m)).toBeLessThanOrEqual(1e-6)
    }
  })
  it('nor where the valley leaves the wall through its end, not its other face', () => {
    MIRROR = mirror
    // the valley crosses the faces' lines 0.3 m apart; the wall stops half-way between
    const m = mirror ? model(3, 2.85, 5) : model(3, 1, 3.15)
    expect(intersections(m)).toEqual([])
    expect(rise(m)).toBeLessThanOrEqual(1e-6)
  })
  it('a wall the valley does not cross keeps its top on the plane exactly', () => {
    MIRROR = mirror
    const m = mirror ? model(4, 5.5, 3) : model(4, 3, 0.5)
    expect(intersections(m)).toEqual([])
    const tops = topVertices(m)
    expect(tops.length).toBeGreaterThan(0)
    for (const p of tops) expect(p.y).toBeCloseTo(underside(p.x, p.z), 6)
  })
})
