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

  it('a hip keeps its ridge along the longer side: a ridge stated across the shorter side is turned, by name — a gable and a near-square hip keep what was read', () => {
    const d = fixture()
    const main = d.bodies[0]
    const w = main.x1 - main.x0
    const dep = main.z1 - main.z0
    const across = w > dep ? 'ALONG_Z' : 'ALONG_X'
    const longer = w > dep ? 'X' : 'Z'
    expect(Math.abs(w - dep)).toBeGreaterThan(1)
    const only = (roof: Partial<typeof main.roof>, rect: Partial<typeof main> = {}) => buildingFromHouseDescription({ ...d, bodies: [{ ...main, ...rect, roof: { ...main.roof, ...roof } }], openings: [], dormers: [], rooflights: [], chimneys: [], balconies: [], terraces: [], canopies: [] })
    const hip = only({ kind: 'HIP', ridge: across })
    expect(hip.building.planeRoofs?.[0]?.ridgeAxis).toBe(longer)
    expect(hip.adjustments.map((a) => a.code)).toContain('HIP_RIDGE_ALONG_LONGER_SIDE')
    expect(reconstructFromHouseDescription({ ...d, bodies: [{ ...main, roof: { ...main.roof, kind: 'HIP', ridge: across } }], openings: [], dormers: [], rooflights: [], chimneys: [], balconies: [], terraces: [], canopies: [] }, 'hip').ok).toBe(true)
    // stated along the longer side already: nothing to say
    expect(only({ kind: 'HIP', ridge: w > dep ? 'ALONG_X' : 'ALONG_Z' }).adjustments.map((a) => a.code)).not.toContain('HIP_RIDGE_ALONG_LONGER_SIDE')
    // a gable may run either way
    const gable = only({ kind: 'GABLE', ridge: across })
    expect(gable.building.planeRoofs?.[0]?.ridgeAxis).toBe(longer === 'X' ? 'Z' : 'X')
    expect(gable.adjustments.map((a) => a.code)).not.toContain('HIP_RIDGE_ALONG_LONGER_SIDE')
    // within a metre of square the reading stands
    const square = only({ kind: 'HIP', ridge: 'ALONG_Z' }, { x0: 0, x1: 8.4, z0: 0, z1: 8 })
    expect(square.building.planeRoofs?.[0]?.ridgeAxis).toBe('Z')
    expect(square.adjustments.map((a) => a.code)).not.toContain('HIP_RIDGE_ALONG_LONGER_SIDE')
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

describe('described house — a cross gable', () => {
  it('a wing whose ridge runs into the main slope dies into it along two valleys, whatever the two eaves heights', () => {
    const checked = checkHouseDescription(JSON.parse(readFileSync(new URL('./fixtures/described-house-a.json', import.meta.url), 'utf8')))
    if (!checked.ok) throw new Error('fixture')
    const d = checked.description
    // the main body's ridge runs front to back; a lower wing stands against its right eave wall, its ridge along the front
    const main = { ...d.bodies[0], x0: 0, x1: 9, z0: 0, z1: 11, roof: { ...d.bodies[0].roof, ridge: 'ALONG_Z' as const, overhangM: 0 } }
    const wing = { ...d.bodies[1], x0: 9, x1: 12.5, z0: 2, z1: 9, eavesHeightM: 2.7, roof: { ...d.bodies[0].roof, ridge: 'ALONG_X' as const, overhangM: 0 } }
    const house = { ...d, overall: { ...d.overall, widthM: 12.5, depthM: 11 }, bodies: [main, wing], openings: [], dormers: [], rooflights: [], chimneys: [], balconies: [], terraces: [], canopies: [], sides: d.sides.map((x) => ({ ...x, openingsByStorey: [] })) }
    const { building } = buildingFromHouseDescription(house)
    const cross = building.pitchedAttachedRoofs.find((r) => r.massId === 'body-garage')
    expect(cross?.layout.join.kind).toBe('VALLEY')
    expect(cross?.joinRoofId).toBe('roof-main-plane-high')
    expect(building.planeRoofs?.map((r) => r.massId)).toEqual(['main'])
    const mainRoof = building.planeRoofs?.[0]
    expect(cross && mainRoof && cross.ridgeY < mainRoof.ridgeY).toBe(true)
    const built = reconstructFromHouseDescription(house, 'cross')
    expect(built.ok).toBe(true)
    if (built.ok) expect(built.refused).toEqual([])
    // the same wing with its ridge front to back does not run into the slope: it keeps a roof of its own
    const parallel = buildingFromHouseDescription({ ...house, bodies: [main, { ...wing, roof: { ...wing.roof, ridge: 'ALONG_Z' as const } }] })
    expect(parallel.building.pitchedAttachedRoofs).toEqual([])
  })
})

describe('described house — scale', () => {
  const load = (): HouseDescription => fixture()
  const fig = (key: string, value: number) => ({ key, label: key, raw: String(value), value, unit: 'm' })
  it('a size printed on the drawing is never rescaled by a published figure', () => {
    const d = load()
    const r = buildingFromHouseDescription(d, { published: [fig('footprint_area', 300)] })
    expect(r.adjustments.map((a) => a.code)).not.toContain('SCALED_TO_PUBLISHED_FIGURE')
    expect(r.building.masses[0].x1).toBeCloseTo(10.5, 6)
  })
  it('a size scaled or estimated takes its scale from the published footprint, by one factor, and says so', () => {
    const d = load()
    const area = d.bodies.reduce((s, b) => s + (b.x1 - b.x0) * (b.z1 - b.z0), 0)
    const est = { ...d, overall: { ...d.overall, basis: 'SCALED_FROM_DRAWING' as const, printedWidthLabel: '', printedDepthLabel: '' } }
    const r = buildingFromHouseDescription(est, { published: [fig('footprint_area', area * 0.81)] })
    expect(r.adjustments.map((a) => a.code)).toContain('SCALED_TO_PUBLISHED_FIGURE')
    expect(r.building.masses[0].x1).toBeCloseTo(10.5 * 0.9, 1)
    expect(r.building.masses[0].z1 / r.building.masses[0].x1).toBeCloseTo(10 / 10.5, 1)
    // agreeing figures change nothing
    const same = buildingFromHouseDescription(est, { published: [fig('footprint_area', area * 1.03)] })
    expect(same.adjustments.map((a) => a.code)).not.toContain('SCALED_TO_PUBLISHED_FIGURE')
  })
})

describe('described house — measures the drawings give (v3.53.1)', () => {
  const span = (d: HouseDescription) => ({ w: Math.max(...d.bodies.map((b) => b.x1)) - Math.min(...d.bodies.map((b) => b.x0)), dep: Math.max(...d.bodies.map((b) => b.z1)) - Math.min(...d.bodies.map((b) => b.z0)) })
  const built = (b: ReturnType<typeof buildingFromHouseDescription>) => ({ w: Math.max(...b.building.masses.map((m) => m.x1)), dep: Math.max(...b.building.masses.map((m) => m.z1)) })

  it('a footprint measured on the drawings sets the size by one factor, whichever way round the two paths took the front, and outranks a printed label', () => {
    const d = fixture()
    const { w, dep } = span(d)
    const printed = { ...d, overall: { ...d.overall, basis: 'PRINTED_ON_DRAWING' as const, printedWidthLabel: '1240', printedDepthLabel: '900' } }
    for (const anchor of [{ widthM: w * 1.15, depthM: dep * 1.15 }, { widthM: dep * 1.15, depthM: w * 1.15 }]) {
      const out = buildingFromHouseDescription(printed, { anchors: { footprint: { ...anchor, why: 'the drawings verify it' } } })
      expect(out.adjustments.map((a) => a.code)).toContain('SCALED_TO_DRAWINGS_MEASURE')
      expect(built(out).w).toBeCloseTo(w * 1.15, 1)
      expect(built(out).dep).toBeCloseTo(dep * 1.15, 1)
    }
  })

  it('a measured footprint of another proportion is not forced on the description: refused by name, the description keeps its size', () => {
    const d = fixture()
    const { w, dep } = span(d)
    const out = buildingFromHouseDescription(d, { anchors: { footprint: { widthM: w * 1.6, depthM: dep * 0.9, why: 'the drawings verify it' } } })
    const codes = out.adjustments.map((a) => a.code)
    expect(codes).toContain('DRAWINGS_MEASURE_NOT_APPLIED')
    expect(codes).not.toContain('SCALED_TO_DRAWINGS_MEASURE')
    expect(built(out).w).toBeCloseTo(w, 1)
  })

  it('a measured storey height replaces the described one, by name; the bodies, roofs and openings stay the description\'s', () => {
    const d = fixture()
    const plain = buildingFromHouseDescription(d)
    const out = buildingFromHouseDescription(d, { anchors: { storeyHeightM: { value: 3.12, why: 'the section measures it' } } })
    expect(out.building.levels[0].height).toBe(3.12)
    expect(out.adjustments.map((a) => a.code)).toContain('HEIGHT_FROM_DRAWINGS_MEASURE')
    expect(out.building.masses.map((m) => [m.id, m.x0, m.x1, m.z0, m.z1])).toEqual(plain.building.masses.map((m) => [m.id, m.x0, m.x1, m.z0, m.z1]))
    expect(out.building.openings.length).toBe(plain.building.openings.length)
    expect(out.building.planeRoofs?.map((r) => [r.massId, r.ridgeAxis])).toEqual(plain.building.planeRoofs?.map((r) => [r.massId, r.ridgeAxis]))
    expect(reconstructFromHouseDescription(d, 'anchored', { anchors: { storeyHeightM: { value: 3.12, why: 'x' } } }).ok).toBe(true)
  })

  it('without anchors nothing changes: the same building, byte for byte', () => {
    const d = fixture()
    expect(JSON.stringify(buildingFromHouseDescription(d, { anchors: {} }))).toBe(JSON.stringify(buildingFromHouseDescription(d)))
  })
})
