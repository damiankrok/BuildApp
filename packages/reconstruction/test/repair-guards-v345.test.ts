/**
 * v3.45: the bounded reconciliation (`repairFromResiduals`) never lifts a door's sill off its floor. (That it reads no
 * opening height on a view whose opening heights were refused is shown on the development house it was found on, Willa
 * Maja: its rear door is no longer cut to 0.97 m on a 0.71 m sill.) Invented values only.
 */
import { describe, expect, it } from 'vitest'
import { repairFromResiduals } from '../src/v2/verify.js'
import type { SourceViewResidual } from '../src/v2/verify.js'
import type { BuildingV2 } from '../src/v2/building.js'

const opening = (id: string, family: string, sillY: number, headY: number) => ({ id, family, sillY, headY, storeyIndex: 0, facade: 'REAR', interval: [2, 3], uncertaintyM: 0.05, unresolved: [], provenance: { sill: 'ASSUMED_FOR_RENDERING', head: 'ASSUMED_FOR_RENDERING' } })
const building = (openings: ReturnType<typeof opening>[]) => ({ openings, levels: [{ index: 0, elevation: 0, height: 2.96 }] }) as unknown as BuildingV2
const residual = (id: string, kind: 'OPENING_SILL' | 'OPENING_HEAD', modelM: number, observedM: number): SourceViewResidual => ({ featureId: id, objectId: id, frameId: 'rear-view', kind, modelM, observedM, residualM: modelM - observedM, toleranceM: 0.15, withinTolerance: false, why: 'fixture' })

describe('v3.45 the bounded reconciliation', () => {
  it('a door’s assumed sill is not lifted to a view’s reading; its head may still be read', () => {
    const b = building([opening('d', 'DOOR', 0, 2.1)])
    const t = repairFromResiduals(b, [residual('d', 'OPENING_SILL', 0, 0.71), residual('d', 'OPENING_HEAD', 2.1, 2.3)], 1)
    const o = b.openings[0]
    expect(o.sillY).toBe(0)
    expect(o.headY).toBeCloseTo(2.3)
    expect(t.iterations[0].refused.some((r) => r.code === 'DOOR_OFF_ITS_ACCESS')).toBe(true)
  })
  it('the same for a glazed door and a garage door', () => {
    for (const family of ['GLAZED_DOOR', 'GARAGE_DOOR']) {
      const b = building([opening('g', family, 0, 2.25)])
      repairFromResiduals(b, [residual('g', 'OPENING_SILL', 0, 0.5)], 1)
      expect(b.openings[0].sillY).toBe(0)
    }
  })
  it('counter: a window’s assumed sill is still read from the view, as before', () => {
    const b = building([opening('w', 'WINDOW', 0.9, 2.2)])
    repairFromResiduals(b, [residual('w', 'OPENING_SILL', 0.9, 0.7)], 1)
    expect(b.openings[0].sillY).toBeCloseTo(0.7)
  })
})
