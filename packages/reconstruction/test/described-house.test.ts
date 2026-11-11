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
      const out = buildingFromHouseDescription(printed, { anchors: { overall: { ...anchor, premise: 'OVERALL_DIMENSION_LINES', why: 'the plan\'s overall dimension lines give it' } } })
      expect(out.adjustments.map((a) => a.code)).toContain('SCALED_TO_DRAWINGS_MEASURE')
      expect(built(out).w).toBeCloseTo(w * 1.15, 1)
      expect(built(out).dep).toBeCloseTo(dep * 1.15, 1)
    }
  })

  it('a measured footprint of another proportion is not forced on the description: refused by name, the description keeps its size', () => {
    const d = fixture()
    const { w, dep } = span(d)
    const out = buildingFromHouseDescription(d, { anchors: { overall: { widthM: w * 1.6, depthM: dep * 0.9, premise: 'COMPLETE_OUTLINE', why: 'the drawings verify it' } } })
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

describe('described house — roofs over open areas, terraces and flat roofs meet what they stand against (v3.53.1)', () => {
  const canopy = (over: Partial<HouseDescription['canopies'][number]>): HouseDescription['canopies'][number] => ({ kind: 'PORCH_ROOF', x0: 0, x1: 1, z0: 0, z1: 1, undersideM: 2.5, posts: 0, images: [1], confidence: 0.7, ...over })
  // one gabled body 10.5 × 9 m, ridge along x, eaves 0.5 m out; nothing else on the plot
  const alone = (canopies: HouseDescription['canopies'], roof: Partial<HouseDescription['bodies'][number]['roof']> = {}): HouseDescription => {
    const d = fixture()
    return { ...d, bodies: [{ ...d.bodies[0], roof: { ...d.bodies[0].roof, ...roof } }], openings: [], dormers: [], rooflights: [], chimneys: [], balconies: [], terraces: [], canopies }
  }
  const codes = (b: ReturnType<typeof buildingFromHouseDescription>, subject: string) => b.adjustments.filter((a) => a.subject === subject).map((a) => `${a.code}: ${a.why}`)

  it('a terrace lies at its storey\'s floor level, against the wall it is stated on', () => {
    const b = buildingFromHouseDescription(fixture())
    expect(b.building.terraces.map((t) => t.topY)).toEqual([0])
  })

  it('a flat roof\'s plate lies within the walls, below their top: the stated eaves height is the walls\' top', () => {
    const b = buildingFromHouseDescription(fixture())
    const flat = b.building.attachedRoofs.find((r) => r.massId === 'body-garage')
    expect(flat?.parapetTopY).toBe(2.9)
    expect(flat?.slabTopY).toBeCloseTo(2.75, 6)
  })

  it('a canopy stated partly within a body is cut back to the open ground; an edge stated a hand from a face is on it', () => {
    const b = buildingFromHouseDescription(alone([canopy({ x0: 2, x1: 6, z0: -1.5, z1: 1.9, undersideM: 2.4 })]))
    const c = b.building.canopies?.[0]
    expect(c).toBeDefined()
    // the body's front face is the frame's z = 0 here (one body: its own face is the origin); nothing of the plate is inside it
    expect(c?.rect.z1).toBeLessThanOrEqual(0)
    expect(codes(b, 'canopy 1').join(' ')).toMatch(/within main's walls is not built|eaves reach over it/)
  })

  it('a shallow canopy stated inside a face projects from it; a deep one across a whole face is a porch under the body\'s own roof — the walls stand back, the roof keeps its outline, posts stand where the face was', () => {
    const d = alone([])
    const w = d.bodies[0].x1 - d.bodies[0].x0
    const dep = d.bodies[0].z1 - d.bodies[0].z0
    const z0 = d.bodies[0].z0
    const shallow = buildingFromHouseDescription(alone([canopy({ kind: 'ENTRANCE_CANOPY', x0: 3, x1: 5, z0, z1: z0 + 0.6 })], { overhangM: 0 }))
    expect(shallow.building.canopies?.[0]?.rect).toMatchObject({ z0: -0.6, z1: 0 })
    expect(shallow.building.masses[0].z1 - shallow.building.masses[0].z0).toBeCloseTo(dep, 6)

    const plain = buildingFromHouseDescription(d)
    const recess = buildingFromHouseDescription(alone([canopy({ kind: 'COVERED_TERRACE', x0: 0, x1: w, z0: z0 + dep - 3, z1: z0 + dep, posts: 2 })]))
    const m = recess.building.masses[0]
    expect(m.z1 - m.z0).toBeCloseTo(dep - 3, 6)
    // the roof's planes are the ones of the house without the porch: same outline, same ridge
    expect(JSON.stringify(recess.building.planeRoofs?.[0].layout)).toBe(JSON.stringify(plain.building.planeRoofs?.[0].layout))
    const porch = recess.building.canopies?.[0]
    expect(porch?.plate).toBe(false)
    expect(porch?.hostId).toMatch(/^roof-main-plane-/)
    expect(porch?.posts).toHaveLength(2)
    expect(porch?.posts.every((q) => q.z > m.z1 + 2)).toBe(true)
    expect(reconstructFromHouseDescription(alone([canopy({ kind: 'COVERED_TERRACE', x0: 0, x1: w, z0: z0 + dep - 3, z1: z0 + dep, posts: 2 })]), 'porch').ok).toBe(true)
  })

  // v3.53.2: until now such a porch was said and not built. It is the model's own pocket: a passage through the body's
  // wall over the mouth, a wall behind it, a post at an open corner — never a plate through the walls.
  const opening = (over: Partial<HouseDescription['openings'][number]>): HouseDescription['openings'][number] => ({ ...fixture().openings[0], bodyId: 'main', side: 'FRONT', storey: 0, kind: 'WINDOW', at: 2, widthM: 1.2, sillM: 0.9, heightM: 1.4, panes: 1, ...over })

  it('a deep porch stated in a corner of a body is a recess cut out of that corner: both faces open under a head, a post at the corner, and the door stated there stands in the wall behind', () => {
    const d = alone([])
    const { x1, z0 } = d.bodies[0]
    const described: HouseDescription = {
      ...alone([canopy({ x0: 6, x1, z0, z1: z0 + 1.8, undersideM: 2.5, posts: 1 })]),
      openings: [opening({ kind: 'ENTRANCE_DOOR', at: 8.6, widthM: 1.1, sillM: 0, heightM: 2.1 }), opening({ at: 2.5, widthM: 1.8 }), opening({ side: 'RIGHT', at: z0 + 0.9, widthM: 0.8 })],
    }
    const b = buildingFromHouseDescription(described)
    expect(b.building.canopies ?? []).toEqual([])
    expect(codes(b, 'canopy 1')).toHaveLength(1)
    expect(codes(b, 'canopy 1')[0]).toMatch(/^FEATURE_ADJUSTED: .*front-east corner: built as a recess cut out of that corner.*post at the corner/)
    const pockets = b.building.pockets ?? []
    expect(pockets.map((q) => [q.facade, q.from, q.to, q.mouthAt, q.backAt, q.openEnd, q.headY, q.storeyIndex])).toEqual([
      ['FRONT', 6, x1, 0, 1.8, 'HIGH', 2.5, 0],
      ['EAST', 0, 1.8, x1, 6, 'LOW', 2.5, 0],
    ])
    expect(pockets.map((q) => q.walls.map((w) => w.role))).toEqual([['BACK'], ['BACK']])
    // one post, at the corner the two faces shared, inside the body's outline
    expect(pockets.map((q) => q.post ?? null)).toEqual([{ x0: x1 - 0.3, x1, z0: 0, z1: 0.3 }, null])
    // the door stated on the front at 8.6 m stands in the wall behind the recess; the window beside it stays in the face
    expect(pockets[0].backOpenings.map((o) => [o.family, o.planeAt, o.interval])).toEqual([['DOOR', 1.8, [8.05, 9.15]]])
    expect(pockets[1].backOpenings.map((o) => [o.family, o.planeAt])).toEqual([['WINDOW', 6]])
    expect(b.building.openings.map((o) => [o.facade, o.storeyIndex, o.planeAt])).toEqual([['FRONT', 0, 0]])
    expect(b.adjustments.filter((x) => x.code === 'OPENING_MOVED_TO_WALL').map((x) => x.subject)).toEqual(['opening 1 (entrance_door on front, storey 0)', 'opening 3 (window on right, storey 0)'])
    expect(b.adjustments.filter((x) => x.code === 'OPENING_DROPPED')).toEqual([])
    // the body is whole: same outline, same roof as the house without the porch
    expect(b.building.masses).toEqual(buildingFromHouseDescription(d).building.masses)
    // and the model takes it whole: nothing refused, a passage in each face, the post, the door in the back wall
    const model = reconstructFromHouseDescription(described, 'corner-porch')
    expect(model.ok).toBe(true)
    if (!model.ok) return
    expect(model.refused).toEqual([])
    const program = model.program as Array<{ type: string; id?: string; kind?: string; wallId?: string; openEnd?: string; role?: string }>
    expect(program.filter((c) => c.type === 'cutOpening' && c.kind === 'PASSAGE').map((c) => [c.id, Boolean(c.openEnd)])).toEqual([['pocket-main-0-0-mouth', true], ['pocket-main-0-1-mouth', true]])
    expect(program.filter((c) => c.type === 'createColumn' && c.role === 'POST').map((c) => c.id)).toEqual(['pocket-main-0-0-post'])
    expect(program.find((c) => c.type === 'cutOpening' && c.id === 'opening-front-0-1')?.wallId).toBe('pocket-main-0-0-back')
  })

  it('a deep porch stated inside one face is a recess between two returns; a window stated where its mouth is does not float in the passage', () => {
    const d = alone([])
    const { z0 } = d.bodies[0]
    const described: HouseDescription = { ...alone([canopy({ x0: 3, x1: 6, z0, z1: z0 + 1.5, undersideM: 2.4 })]), openings: [opening({ kind: 'ENTRANCE_DOOR', at: 4.5, widthM: 1, sillM: 0, heightM: 2.1 }), opening({ at: 1.5, widthM: 1.2 })] }
    const b = buildingFromHouseDescription(described)
    const pockets = b.building.pockets ?? []
    expect(pockets).toHaveLength(1)
    expect(pockets[0]).toMatchObject({ facade: 'FRONT', from: 3, to: 6, mouthAt: 0, backAt: 1.5, headY: 2.4 })
    expect(pockets[0].openEnd).toBeUndefined()
    expect(pockets[0].post).toBeUndefined()
    expect(pockets[0].walls.map((w) => w.role)).toEqual(['RETURN', 'RETURN', 'BACK'])
    expect(pockets[0].backOpenings.map((o) => o.family)).toEqual(['DOOR'])
    expect(b.building.openings.map((o) => o.interval)).toEqual([[0.9, 2.1]])
    expect(codes(b, 'canopy 1')[0]).toMatch(/^FEATURE_ADJUSTED: .*over part of its front face: built as a recess cut into that face/)
    const model = reconstructFromHouseDescription(described, 'face-porch')
    expect(model.ok && model.refused).toEqual([])
  })

  it('what cannot be cut is still said and not built: a corner another body stands against, a recess that would leave no house, a porch hard against a corner without reaching it', () => {
    // the fixture's garage stands against the main body's east face from the front: that corner is not open on two faces
    const two = fixture()
    const main = two.bodies[0]
    const against = buildingFromHouseDescription({ ...two, openings: [], terraces: [], balconies: [], canopies: [canopy({ x0: 7.5, x1: main.x1, z0: main.z0, z1: main.z0 + 1.8, posts: 1 })] })
    expect(against.building.pockets ?? []).toEqual([])
    expect(codes(against, 'canopy 1')[0]).toMatch(/^FEATURE_DROPPED: .*corner of main where another body stands against it/)

    const d = alone([])
    const { x1, z0, z1 } = d.bodies[0]
    const noHouse = buildingFromHouseDescription(alone([canopy({ x0: 2, x1, z0, z1: z1 - 2 })]))
    expect(noHouse.building.pockets ?? []).toEqual([])
    expect(codes(noHouse, 'canopy 1')[0]).toMatch(/^FEATURE_DROPPED/)

    const hard = buildingFromHouseDescription(alone([canopy({ x0: 0.3, x1: 3, z0, z1: z0 + 1.5 })]))
    expect(hard.building.pockets ?? []).toEqual([])
    expect(codes(hard, 'canopy 1')[0]).toMatch(/^FEATURE_DROPPED: .*over part of a face/)
  })

  it('under a roof\'s eaves the plate begins at the roof\'s edge; its posts still stand along the long outer edge, as many as were stated', () => {
    const d = alone([])
    const w = d.bodies[0].x1 - d.bodies[0].x0
    const z0 = d.bodies[0].z0
    const b = buildingFromHouseDescription(alone([canopy({ x0: 0, x1: w, z0: z0 - 2.4, z1: z0, undersideM: 3.6, posts: 5 })]))
    const c = b.building.canopies?.[0]
    expect(c?.rect.z1).toBeCloseTo(-0.5, 6) // the eaves stand 0.5 m out: the plate starts there
    expect(c?.posts).toHaveLength(5)
    expect(new Set(c?.posts.map((q) => q.z)).size).toBe(1)
    const xs = (c?.posts ?? []).map((q) => q.x).sort((p, q) => p - q)
    expect(xs.every((x, i) => i === 0 || x - xs[i - 1] > 0.9)).toBe(true)
  })

  it('two covers do not lie in one another, and a post never stands in a wall', () => {
    const d = fixture() // main and a garage to its right whose front stands 1 m forward of main's
    const two = buildingFromHouseDescription({ ...d, balconies: [], terraces: [], canopies: [canopy({ x0: 2, x1: 8, z0: -2, z1: 1, undersideM: 2.4, posts: 2 }), canopy({ x0: 6, x1: 10.5, z0: -1, z1: 1, undersideM: 2.4, posts: 2 })] })
    const [a, b] = two.building.canopies ?? []
    expect(a && b && (b.rect.x0 >= a.rect.x1 || b.rect.z1 <= a.rect.z0 || b.rect.z0 >= a.rect.z1)).toBe(true)
    for (const c of two.building.canopies ?? []) for (const q of c.posts) for (const m of two.building.masses) expect(q.x > m.x0 - 0.15 && q.x < m.x1 + 0.15 && q.z > m.z0 - 0.15 && q.z < m.z1 + 0.15).toBe(false)
  })
})

describe('described house — a measure is a measure OF something (v3.53.2)', () => {
  // one body, read printed as 10 × 15 m
  const one = (basis: HouseDescription['overall']['basis'], w = 10, dep = 15): HouseDescription => {
    const d = fixture()
    return { ...d, overall: { ...d.overall, widthM: w, depthM: dep, basis, printedWidthLabel: basis === 'PRINTED_ON_DRAWING' ? '1000' : '', printedDepthLabel: basis === 'PRINTED_ON_DRAWING' ? '1500' : '' }, bodies: [{ ...d.bodies[0], x0: 0, x1: w, z0: 0, z1: dep }], openings: [], dormers: [], rooflights: [], chimneys: [], balconies: [], terraces: [], canopies: [] }
  }
  const size = (b: ReturnType<typeof buildingFromHouseDescription>) => ({ w: Math.max(...b.building.masses.map((m) => m.x1)), dep: Math.max(...b.building.masses.map((m) => m.z1)) })
  const part = { role: 'MAIN' as const, widthM: 8, depthM: 12, why: 'the drawings place the main body at a verified scale as 8.00 × 12.00 m' }

  it('COUNTER-CASE: a partial drawings model whose remaining body is 8 × 12 m does not shrink a correct 10 × 15 m house, though the proportions match', () => {
    const out = buildingFromHouseDescription(one('PRINTED_ON_DRAWING'), { anchors: { bodies: [part], partial: true } })
    expect(size(out)).toEqual({ w: 10, dep: 15 })
    const codes = out.adjustments.map((a) => a.code)
    expect(codes).not.toContain('SCALED_TO_DRAWINGS_MEASURE')
    expect(codes).not.toContain('SCALED_TO_DRAWINGS_LOCAL_MEASURE')
    expect(out.adjustments.find((a) => a.code === 'DRAWINGS_MEASURE_NOT_APPLIED')?.why).toMatch(/only part of the house/)
    // the same holds whatever the description's own basis: a part's size is not the size of the one body described
    expect(size(buildingFromHouseDescription(one('SCALED_FROM_DRAWING'), { anchors: { bodies: [part], partial: true } }))).toEqual({ w: 10, dep: 15 })
  })

  it('a WHOLE outline from the plan\'s overall dimension lines is valid for a partial model too, and outranks a size read printed', () => {
    const overall = { widthM: 10, depthM: 15, premise: 'OVERALL_DIMENSION_LINES' as const, why: 'the plan\'s overall dimension lines give the building 10.00 × 15.00 m' }
    // a description 12 % too large, scaled from a drawing: brought to the measured outline, not to the 8 × 12 part
    const scaled = buildingFromHouseDescription(one('SCALED_FROM_DRAWING', 11.2, 16.8), { anchors: { overall, bodies: [part], partial: true } })
    expect(size(scaled).w).toBeCloseTo(10, 1)
    expect(size(scaled).dep).toBeCloseTo(15, 1)
    expect(scaled.adjustments.map((a) => a.code)).toContain('SCALED_TO_DRAWINGS_MEASURE')
    // a label misread as 1120 × 1680: the measured outline stands
    const misread = buildingFromHouseDescription(one('PRINTED_ON_DRAWING', 11.2, 16.8), { anchors: { overall, bodies: [part], partial: true } })
    expect(size(misread).w).toBeCloseTo(10, 1)
    // and a correct one is confirmed, unchanged
    const right = buildingFromHouseDescription(one('PRINTED_ON_DRAWING'), { anchors: { overall, bodies: [part], partial: true } })
    expect(size(right)).toEqual({ w: 10, dep: 15 })
    expect(right.adjustments.map((a) => a.code)).toContain('SCALED_TO_DRAWINGS_MEASURE')
  })

  it('a LOCAL measure constrains the body it is: with the bodies told apart, a description scaled from a drawing takes its scale from the measured main body', () => {
    const d = fixture() // main 10.5 × 9 and a garage 5 × 6.5
    const main = d.bodies[0]
    const mw = main.x1 - main.x0
    const md = main.z1 - main.z0
    const scaled = { ...d, overall: { ...d.overall, basis: 'SCALED_FROM_DRAWING' as const, printedWidthLabel: '', printedDepthLabel: '' } }
    const plain = buildingFromHouseDescription(scaled)
    const local = { role: 'MAIN' as const, widthM: mw * 0.9, depthM: md * 0.9, why: 'the drawings place the main body at a verified scale' }
    const out = buildingFromHouseDescription(scaled, { anchors: { bodies: [local], partial: true } })
    expect(out.adjustments.map((a) => a.code)).toContain('SCALED_TO_DRAWINGS_LOCAL_MEASURE')
    const m = (b: ReturnType<typeof buildingFromHouseDescription>, id: string) => b.building.masses.find((x) => x.id === id)
    expect((m(out, 'main')?.x1 ?? 0) - (m(out, 'main')?.x0 ?? 0)).toBeCloseTo(mw * 0.9, 1)
    // the garage, which nothing measured, keeps its proportion to the main body
    const ratio = (b: ReturnType<typeof buildingFromHouseDescription>) => ((m(b, 'body-garage')?.x1 ?? 0) - (m(b, 'body-garage')?.x0 ?? 0)) / ((m(b, 'main')?.x1 ?? 0) - (m(b, 'main')?.x0 ?? 0))
    expect(ratio(out)).toBeCloseTo(ratio(plain), 1)
  })

  it('a local measure does not overrule a size read printed for the whole: agreement and disagreement are both said, neither rescales', () => {
    const d = fixture() // printed 1550 × 1000
    const main = d.bodies[0]
    const mw = main.x1 - main.x0
    const md = main.z1 - main.z0
    const plain = buildingFromHouseDescription(d)
    const agrees = buildingFromHouseDescription(d, { anchors: { bodies: [{ role: 'MAIN', widthM: mw * 1.02, depthM: md * 1.02, why: 'measured' }], partial: true } })
    expect(agrees.adjustments.map((a) => a.code)).toContain('DRAWINGS_LOCAL_MEASURE_AGREES')
    expect(JSON.stringify(agrees.building.masses)).toBe(JSON.stringify(plain.building.masses))
    const disagrees = buildingFromHouseDescription(d, { anchors: { bodies: [{ role: 'MAIN', widthM: mw * 0.8, depthM: md * 0.8, why: 'measured' }], partial: true } })
    expect(disagrees.adjustments.map((a) => a.code)).toContain('DRAWINGS_LOCAL_MEASURE_DISAGREES')
    expect(JSON.stringify(disagrees.building.masses)).toBe(JSON.stringify(plain.building.masses))
  })

  it('a measured body whose described counterpart cannot be told (no body, or two, of its shape) is not applied', () => {
    const d = fixture()
    const scaled = { ...d, overall: { ...d.overall, basis: 'SCALED_FROM_DRAWING' as const, printedWidthLabel: '', printedDepthLabel: '' } }
    const none = buildingFromHouseDescription(scaled, { anchors: { bodies: [{ role: 'MAIN', widthM: 20, depthM: 5, why: 'measured' }] } })
    expect(none.adjustments.find((a) => a.code === 'DRAWINGS_MEASURE_NOT_APPLIED')?.why).toMatch(/no described body of that role has its shape/)
    expect(none.adjustments.map((a) => a.code)).not.toContain('SCALED_TO_DRAWINGS_LOCAL_MEASURE')
  })
})
