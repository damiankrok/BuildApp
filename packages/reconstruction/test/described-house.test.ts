/**
 * v3.53: a described house (source-vision `HouseDescription`) as BuildingV2, through the emitter and the model's own
 * validator. The fixture is synthetic — written by hand for these tests, describing no published project.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { checkHouseDescription } from '@buildapp/source-vision'
import type { HouseDescription } from '@buildapp/source-vision'
import { buildingFromHouseDescription, reconstructFromHouseDescription } from '../src/index.js'

const fixture = (): HouseDescription => {
  const checked = checkHouseDescription(JSON.parse(readFileSync(new URL('./fixtures/described-house-a.json', import.meta.url), 'utf8')))
  if (!checked.ok) throw new Error(JSON.stringify(checked.issues))
  return checked.description
}

describe('described house → BuildingV2', () => {
  it('builds the bodies, roofs, openings and features the description states', () => {
    const { building, adjustments } = buildingFromHouseDescription(fixture())
    expect(building.masses.map((m) => [m.id, m.role, m.storeys])).toEqual([['main', 'MAIN', [0, 1]], ['body-garage', 'ATTACHED', [0]]])
    const roof = building.planeRoofs?.find((r) => r.massId === 'main')
    expect(roof?.ridgeAxis).toBe('X')
    expect(roof?.ends).toEqual({ min: 'GABLE', max: 'GABLE' })
    expect(building.attachedRoofs.map((r) => r.massId)).toEqual(['body-garage'])
    expect(building.openings.filter((o) => o.facade === 'FRONT').map((o) => o.family).sort()).toEqual(['DOOR', 'GARAGE_DOOR', 'WINDOW', 'WINDOW'])
    expect(building.openings.find((o) => o.family === 'GARAGE_DOOR')?.massId).toBe('body-garage')
    expect(building.dormers?.map((d) => [d.planeKey, d.type])).toEqual([['LOW', 'GABLE'], ['HIGH', 'SHED']])
    expect(building.chimneys).toHaveLength(1)
    expect(building.balconies).toHaveLength(1)
    expect(building.canopies).toHaveLength(1)
    expect(adjustments).toEqual([])
  })

  it('passes the model validator whole, and never states a body as measured from printed chains', () => {
    const built = reconstructFromHouseDescription(fixture(), 'described-test')
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.refused).toEqual([])
    const statuses = (built.program as Array<{ type: string; evidence?: { status: string } }>).filter((c) => c.type === 'setEvidence').map((c) => c.evidence?.status)
    expect(statuses.length).toBeGreaterThan(10)
    expect(statuses).not.toContain('SOURCE_EXACT')
    expect(statuses).not.toContain('SOURCE_CORROBORATED')
    expect(statuses).not.toContain('USER_CONFIRMED')
  })

  it('a mirrored description gives the mirrored building', () => {
    const d = fixture()
    const W = d.overall.widthM
    const flip = (s: 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT'): 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT' => (s === 'LEFT' ? 'RIGHT' : s === 'RIGHT' ? 'LEFT' : s)
    const m: HouseDescription = {
      ...d,
      bodies: d.bodies.map((b) => ({ ...b, x0: W - b.x1, x1: W - b.x0 })),
      openings: d.openings.map((o) => ({ ...o, side: flip(o.side), at: o.side === 'FRONT' || o.side === 'REAR' ? W - o.at : o.at })),
      dormers: d.dormers.map((o) => ({ ...o, at: W - o.at })),
      rooflights: d.rooflights.map((o) => ({ ...o, at: W - o.at })),
      chimneys: d.chimneys.map((c) => ({ ...c, x: W - c.x })),
      balconies: d.balconies.map((b) => ({ ...b, side: flip(b.side) })),
      terraces: d.terraces.map((t) => ({ ...t, from: W - t.to, to: W - t.from })),
      canopies: d.canopies.map((c) => ({ ...c, x0: W - c.x1, x1: W - c.x0 })),
    }
    const a = buildingFromHouseDescription(d).building
    const b = buildingFromHouseDescription(m).building
    const garageA = a.masses.find((x) => x.id === 'body-garage')
    const garageB = b.masses.find((x) => x.id === 'body-garage')
    expect(garageB?.x0).toBeCloseTo(W - (garageA?.x1 ?? 0), 6)
    const frontA = a.openings.filter((o) => o.facade === 'FRONT').map((o) => [o.family, Math.round((W - (o.interval[0] + o.interval[1]) / 2) * 100)]).sort()
    const frontB = b.openings.filter((o) => o.facade === 'FRONT').map((o) => [o.family, Math.round(((o.interval[0] + o.interval[1]) / 2) * 100)]).sort()
    expect(frontB).toEqual(frontA)
    expect(b.openings.filter((o) => o.facade === 'EAST').length).toBe(a.openings.filter((o) => o.facade === 'WEST').length)
    expect(reconstructFromHouseDescription(m, 'mirrored').ok).toBe(true)
  })

  it('reads the ridge direction and the roof kind as stated; an unseen kind is a named stand-in, never a flat roof', () => {
    const d = fixture()
    const main = d.bodies[0]
    const z = buildingFromHouseDescription({ ...d, bodies: [{ ...main, roof: { ...main.roof, ridge: 'ALONG_Z' } }, d.bodies[1]], dormers: [], rooflights: [] })
    expect(z.building.planeRoofs?.find((r) => r.massId === 'main')?.ridgeAxis).toBe('Z')
    const hip = buildingFromHouseDescription({ ...d, bodies: [{ ...main, roof: { ...main.roof, kind: 'HIP' } }, d.bodies[1]], dormers: [], rooflights: [] })
    expect(hip.building.planeRoofs?.find((r) => r.massId === 'main')?.ends).toEqual({ min: 'HIP', max: 'HIP' })
    const other = buildingFromHouseDescription({ ...d, bodies: [{ ...main, roof: { ...main.roof, kind: 'OTHER' } }, d.bodies[1]] })
    expect(other.building.attachedRoofs.some((r) => r.massId === 'main')).toBe(false)
    expect(other.building.planeRoofs?.some((r) => r.massId === 'main')).toBe(true)
    expect(other.adjustments.map((a) => a.code)).toContain('ROOF_KIND_STOOD_IN')
    const shed = buildingFromHouseDescription({ ...d, bodies: [main, { ...d.bodies[1], roof: { ...d.bodies[1].roof, kind: 'SHED', highSide: 'REAR', pitchDeg: 12 } }] })
    const shedRoof = shed.building.planeRoofs?.find((r) => r.massId === 'body-garage')
    expect(shedRoof?.layout.planes).toHaveLength(1)
    expect(shedRoof?.ridgeY).toBeGreaterThan(shedRoof?.eaveY ?? 0)
    expect(reconstructFromHouseDescription({ ...d, bodies: [main, { ...d.bodies[1], roof: { ...d.bodies[1].roof, kind: 'SHED', highSide: 'REAR', pitchDeg: 12 } }] }, 'shed').ok).toBe(true)
  })

  it('does not cut an opening where another body stands against the wall, nor two in one place', () => {
    const d = fixture()
    // the garage stands against the main body's right wall over z 1..6.5: a ground-floor window there has no outside
    const blocked = buildingFromHouseDescription({ ...d, openings: [...d.openings, { ...d.openings[1], side: 'RIGHT', at: 4, bodyId: 'main' }] })
    expect(blocked.building.openings.some((o) => o.massId === 'main' && o.facade === 'EAST' && o.storeyIndex === 0)).toBe(false)
    expect(blocked.adjustments.some((a) => a.code === 'OPENING_DROPPED')).toBe(true)
    const twice = buildingFromHouseDescription({ ...d, openings: [...d.openings, { ...d.openings[1] }] })
    expect(twice.building.openings.filter((o) => o.facade === 'FRONT' && o.massId === 'main')).toHaveLength(3)
    expect(twice.adjustments.some((a) => a.code === 'OPENING_DROPPED')).toBe(true)
  })

  it('cuts back a body stated over another, and says so', () => {
    const d = fixture()
    const over = buildingFromHouseDescription({ ...d, bodies: [d.bodies[0], { ...d.bodies[1], x0: 9.5 }] })
    const [main, garage] = over.building.masses
    expect(garage.x0).toBeGreaterThanOrEqual(main.x1 - 1e-6)
    expect(over.adjustments.map((a) => a.code)).toContain('BODY_CLIPPED')
  })
})
