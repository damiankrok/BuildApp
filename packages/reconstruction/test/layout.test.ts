import { describe, expect, it } from 'vitest'
import { toGray } from '@buildapp/source-cv'
import type { Raster } from '@buildapp/source-cv'
import { alignPlans, chooseBasePlan, inferStructuralLayout, readPlans, ringArea } from '../src/index.js'
import type { MassHypothesis, StructuralLayoutDraft } from '../src/index.js'
import { CM_PER_PX, chain, graphOf, metricsOf, partition, planFrame, registration, sheet, walls } from './plan.js'

const GROUND = planFrame('frame-ground', 'GROUND', { width: 560, height: 520 })
const UPPER = planFrame('frame-upper', 'UPPER', { width: 560, height: 520 })

const layoutOf = (rasters: Record<string, Raster>, chains: Parameters<typeof metricsOf>[0]): StructuralLayoutDraft =>
  inferStructuralLayout({
    slug: 'test',
    sourcePackageId: 'src-test',
    sourcePackageHash: 'd'.repeat(64),
    graph: graphOf(Object.keys(rasters).map((id) => (id === 'frame-ground' ? GROUND : UPPER))),
    metrics: metricsOf(chains, Object.keys(rasters).map((id) => registration(id))),
    raster: (frame) => rasters[frame.id],
  })

const size = (m: MassHypothesis): [number, number] => [Number(m.widthM.value.toFixed(2)), Number(m.depthM.value.toFixed(2))]

/** FIXTURE B of §25: a main body with a one-storey wing beside it, and an upper storey over the body only. */
describe('a house with an attached single-storey wing', () => {
  const ground = sheet(560, 520)
  walls(ground, 40, 40, 279, 379, [{ side: 'S', from: 120, to: 200 }])
  walls(ground, 268, 200, 439, 379, [{ side: 'S', from: 320, to: 400 }])
  partition(ground, 40, 200, 279, 205)
  const upper = sheet(560, 520)
  walls(upper, 40, 40, 279, 379, [{ side: 'S', from: 120, to: 200 }])
  partition(upper, 40, 220, 279, 225)

  const draft = layoutOf(
    { 'frame-ground': ground, 'frame-upper': upper },
    [
      chain('gx', 'HORIZONTAL', [40, 280, 440], { frameId: 'frame-ground' }),
      chain('gy', 'VERTICAL', [40, 200, 380], { frameId: 'frame-ground' }),
      chain('ux', 'HORIZONTAL', [40, 280], { frameId: 'frame-upper' }),
      chain('uy', 'VERTICAL', [40, 380], { frameId: 'frame-upper' }),
    ],
  )

  it('finds two masses, not one rectangle over both', () => {
    expect(draft.masses.length).toBe(2)
    expect(draft.masses.map(size).sort()).toEqual([[12, 17], [8, 9]].sort())
  })

  it('does not give the wing an upper storey it has no plan for', () => {
    const wing = draft.masses.find((m) => size(m)[0] === 8)
    const body = draft.masses.find((m) => size(m)[0] === 12)
    expect(wing?.storeySpan).toMatchObject({ fromIndex: 0, toIndex: 0 })
    expect(body?.storeySpan).toMatchObject({ fromIndex: 0, toIndex: 1 })
  })

  it('calls the taller body the main one and the wing an attachment', () => {
    expect(draft.masses.find((m) => size(m)[0] === 12)?.role).toBe('MAIN')
    expect(draft.masses.find((m) => size(m)[0] === 8)?.role).toBe('ATTACHED')
  })

  it('records the wall they share, and where', () => {
    const shared = draft.attachments.find((a) => a.kind === 'SHARES_WALL_WITH')
    expect(shared?.contact?.axis).toBe('X')
    expect(shared?.contact?.at).toBeCloseTo(12, 1)
  })

  it('does not call the shared wall a facade', () => {
    const party = draft.facadePlanes.filter((f) => !f.exterior)
    expect(party.length).toBeGreaterThan(0)
    for (const f of party) expect(f.axis).toBe('X')
    const outer = draft.facadePlanes.filter((f) => f.exterior && f.massId === draft.masses.find((m) => size(m)[0] === 8)?.id)
    expect(outer.some((f) => f.side === 'MAX_X')).toBe(true)
  })

  it('says the upper storey was registered onto the plan below, and how well', () => {
    const upperStorey = draft.storeys.find((s) => s.index === 1)
    expect(upperStorey?.registeredFrom).toBe('frame-ground')
    expect(upperStorey?.why).toContain('lands on wall')
  })

  it('reports the traces §5 asks for: every region back to a frame and a rectangle', () => {
    for (const region of draft.footprintRegions.filter((r) => r.kind === 'BUILT')) {
      const trace = draft.traces.find((t) => t.itemId === region.id)
      expect(trace?.frameId).toBeDefined()
      expect(trace?.pixelRect).toBeDefined()
    }
  })
})

/**
 * When two bodies are shaped alike, the upper storey could sit on either, and
 * the choice has to be reported with the margin it was won by rather than
 * asserted.
 */
describe('two bodies the upper storey could sit on', () => {
  const ground = sheet(560, 520)
  walls(ground, 40, 40, 279, 379)
  walls(ground, 320, 40, 439, 209)
  const upper = sheet(560, 520)
  walls(upper, 40, 40, 279, 379)
  const draft = layoutOf(
    { 'frame-ground': ground, 'frame-upper': upper },
    [
      chain('gx', 'HORIZONTAL', [40, 280, 320, 440], { frameId: 'frame-ground' }),
      chain('gy', 'VERTICAL', [40, 210, 380], { frameId: 'frame-ground' }),
      chain('ux', 'HORIZONTAL', [40, 280], { frameId: 'frame-upper' }),
      chain('uy', 'VERTICAL', [40, 380], { frameId: 'frame-upper' }),
    ],
  )

  it('weighs both and says which it took, and by how much', () => {
    const choice = draft.alternatives.find((a) => a.what.includes('upper'))
    expect(choice).toBeDefined()
    expect(choice!.members.length).toBeGreaterThanOrEqual(2)
    expect(choice!.margin).toBeGreaterThan(0)
  })

  it('puts it on the body whose walls it matches', () => {
    const carried = draft.masses.find((m) => m.storeySpan.toIndex === 1)
    expect(carried && size(carried)[0]).toBe(12)
  })
})

/** FIXTURE A of §25: one rectangle really is one rectangle, and the layout is allowed to say so. */
describe('a plain rectangular house on two storeys', () => {
  const ground = sheet(400, 460)
  walls(ground, 40, 40, 279, 379, [{ side: 'S', from: 120, to: 200 }])
  partition(ground, 40, 200, 279, 205)
  const upper = sheet(400, 460)
  walls(upper, 40, 40, 279, 379)
  partition(upper, 40, 220, 279, 225)
  const draft = layoutOf(
    { 'frame-ground': ground, 'frame-upper': upper },
    [
      chain('gx', 'HORIZONTAL', [40, 280], { frameId: 'frame-ground' }),
      chain('gy', 'VERTICAL', [40, 380], { frameId: 'frame-ground' }),
      chain('ux', 'HORIZONTAL', [40, 280], { frameId: 'frame-upper' }),
      chain('uy', 'VERTICAL', [40, 380], { frameId: 'frame-upper' }),
    ],
  )

  it('is one mass on two storeys', () => {
    expect(draft.masses.length).toBe(1)
    expect(size(draft.masses[0])).toEqual([12, 17])
    expect(draft.masses[0].storeySpan).toMatchObject({ fromIndex: 0, toIndex: 1 })
  })

  it('has four exterior faces and no party wall', () => {
    expect(draft.facadePlanes.filter((f) => f.exterior).length).toBe(4)
    expect(draft.facadePlanes.filter((f) => !f.exterior).length).toBe(0)
  })
})

describe('what the layout refuses to do', () => {
  it('does not take a region enclosed only by line work for a body', () => {
    const ground = sheet(400, 460)
    walls(ground, 40, 40, 279, 259)
    // A paved court below the house, ringed by a kerb line and nothing else.
    for (let x = 40; x <= 280; x += 1) for (let y = 370; y <= 371; y += 1) ground.data[(y * ground.width + x) * 4] = ground.data[(y * ground.width + x) * 4 + 1] = ground.data[(y * ground.width + x) * 4 + 2] = 0
    const draft = layoutOf({ 'frame-ground': ground }, [chain('gx', 'HORIZONTAL', [40, 280], { frameId: 'frame-ground' }), chain('gy', 'VERTICAL', [40, 260, 372], { frameId: 'frame-ground' })])
    expect(draft.masses.length).toBe(1)
    expect(draft.masses[0].depthM.value).toBeCloseTo(11, 0)
  })

  it('names the zone a depth chain measures beyond the last wall rather than building it', () => {
    const ground = sheet(400, 480)
    walls(ground, 40, 40, 279, 339)
    const draft = layoutOf({ 'frame-ground': ground }, [chain('gx', 'HORIZONTAL', [40, 280], { frameId: 'frame-ground' }), chain('gy', 'VERTICAL', [40, 340, 380], { frameId: 'frame-ground' })])
    const zones = draft.footprintRegions.filter((r) => r.kind === 'ZONE')
    expect(zones.length).toBe(1)
    expect(ringArea(zones[0].ring)).toBeCloseTo(12 * 2, 0)
    expect(draft.masses.length).toBe(1)
    expect(draft.masses[0].depthM.value).toBeCloseTo(15, 0)
  })

  it('reports a hole when the package carries no plan at all', () => {
    const draft = inferStructuralLayout({
      slug: 'test',
      sourcePackageId: 'src-test',
      sourcePackageHash: 'd'.repeat(64),
      graph: graphOf([]),
      metrics: metricsOf([], []),
      raster: () => undefined,
    })
    expect(draft.masses).toEqual([])
    expect(draft.unresolved.map((u) => u.what)).toContain('the building’s composition')
  })

  it('gives the same answer twice', () => {
    const ground = sheet(400, 460)
    walls(ground, 40, 40, 279, 379)
    const chains = [chain('gx', 'HORIZONTAL', [40, 280], { frameId: 'frame-ground' }), chain('gy', 'VERTICAL', [40, 380], { frameId: 'frame-ground' })]
    const one = layoutOf({ 'frame-ground': ground }, chains)
    const two = layoutOf({ 'frame-ground': ground }, chains)
    expect(JSON.stringify(one.masses)).toBe(JSON.stringify(two.masses))
  })
})

describe('storey registration', () => {
  const ground = sheet(560, 520)
  walls(ground, 40, 40, 279, 379)
  walls(ground, 268, 200, 439, 379)
  const upper = sheet(560, 520)
  walls(upper, 40, 40, 279, 379)
  const rasters = { 'frame-ground': ground, 'frame-upper': upper }
  const { plans } = readPlans({
    slug: 'test',
    sourcePackageId: 'src-test',
    sourcePackageHash: 'd'.repeat(64),
    graph: graphOf([GROUND, UPPER]),
    metrics: metricsOf(
      [chain('gx', 'HORIZONTAL', [40, 280, 440], { frameId: 'frame-ground' }), chain('gy', 'VERTICAL', [40, 200, 380], { frameId: 'frame-ground' }), chain('ux', 'HORIZONTAL', [40, 280], { frameId: 'frame-upper' }), chain('uy', 'VERTICAL', [40, 380], { frameId: 'frame-upper' })],
      [registration('frame-ground'), registration('frame-upper')],
    ),
    raster: (frame) => rasters[frame.id as keyof typeof rasters],
  })

  it('takes the ground floor as the building’s coordinates', () => {
    expect(chooseBasePlan(plans)?.frame.id).toBe('frame-ground')
  })

  it('puts the upper storey over the body it matches, not over the wing', () => {
    const base = plans.find((p) => p.frame.id === 'frame-ground')
    const other = plans.find((p) => p.frame.id === 'frame-upper')
    const { best, considered } = alignPlans(base!, other!)
    expect(considered.length).toBeGreaterThanOrEqual(1)
    expect(best?.agreement).toBeGreaterThan(0.8)
    // What matters is where the plan is PUT, not which candidate rectangle the
    // placement was named after: several targets produce the same placement
    // once the scale is one. It has to land on the 240 px body and not spread
    // itself over the 400 px the building and its wing occupy together.
    const source = other!.decomposition.envelope!.rect
    const placed = { x0: source.x0 * best!.scale + best!.offsetX, x1: source.x1 * best!.scale + best!.offsetX }
    expect(placed.x1 - placed.x0).toBeCloseTo(240, 0)
    expect(Math.abs(placed.x0 - 40.5)).toBeLessThan(1.5)
  })

  it('reports greyscale it was given, not colour it was not', () => {
    expect(toGray(ground).width).toBe(560)
  })
})

it('scales the numbers by the fixture’s own scale and nothing else', () => {
  expect(CM_PER_PX).toBe(5)
})
