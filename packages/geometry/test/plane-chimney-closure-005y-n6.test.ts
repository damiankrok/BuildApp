/**
 * A stack standing under a roof plane pierces it. Over a ridge no cut confined to one plane can hold the stack, so the
 * emitter places it through without one; the joint audit judges that overlap as the intended penetration it is (as it
 * already does for a one-piece roof), not as two solids that should stand apart. A stack that misses the roof is not
 * touched by the rule.
 */
import { describe, expect, it } from 'vitest'
import { compileBuilding, geometryClosureAudit } from '../src/index.js'
import { withGround } from './helpers.js'

const model = (chimneyX: number) =>
  withGround(
    { type: 'createRoofPlane', id: 'p', levelId: 'ground', boundary: [{ x: 0, z: 0 }, { x: 6, z: 0 }, { x: 6, z: 6 }, { x: 0, z: 6 }], datum: { x: 0, y: 2.5, z: 0 }, pitchDeg: 0, thickness: 0.2 },
    { type: 'placeChimney', id: 'c', levelId: 'ground', footprint: { minX: chimneyX, maxX: chimneyX + 0.6, minZ: 2.7, maxZ: 3.3 }, baseOffset: 0, height: 4 },
  )

const exteriorErrors = (m: ReturnType<typeof model>) => geometryClosureAudit(m, compileBuilding(m)).findings.filter((f) => f.scope === 'EXTERIOR' && f.severity === 'ERROR')

describe('a stack through a roof plane with no cut', () => {
  it('is an intended penetration, not an exterior intersection error', () => {
    expect(exteriorErrors(model(2.7))).toEqual([])
    const contacts = geometryClosureAudit(model(2.7), compileBuilding(model(2.7))).contacts.filter((c) => [c.a, c.b].some((id) => id.startsWith('c')))
    expect(contacts.some((c) => c.relation === 'CHIMNEY<->ROOF' && c.intended === 'PENETRATION')).toBe(true)
  })
})
