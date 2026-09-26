import { describe, expect, it } from 'vitest'
import { decodeImage } from '@buildapp/source-package'
import { ASHBY, BRACKENHOLT, COLDHARBOUR, DUNMORE, ELMBRIDGE, ELMBRIDGE_ROOMS, FOXLOW, GREYWELL, HATHERLEIGH, IVYBANK, KELSALL, V2_FIXTURES } from '@buildapp/synthetic-drawings'
import type { SyntheticHouse } from '@buildapp/synthetic-drawings'
import { reconstructV2, verifyReplay } from '../src/index.js'
import type { ReconstructionV2Result } from '../src/index.js'
import { buildFixture } from './pipeline.js'

/**
 * §25: ten houses that exist only in `packages/synthetic-drawings`, one
 * theme each, through the v2 analyzer exactly as a published project goes
 * through it: PNG sheets in a source package, observed, measured, read.
 *
 * Every expectation below is the number the sheet was drawn from, in the
 * model frame the sheets were drawn in. Nothing here is a reference project;
 * the architecture tests hold the analyzer to the same.
 */
const cache = new Map<string, Promise<ReconstructionV2Result>>()
const run = (house: SyntheticHouse): Promise<ReconstructionV2Result> => {
  let p = cache.get(house.name)
  if (!p) {
    p = (async () => {
      const published = house === ELMBRIDGE ? { rooms: ELMBRIDGE_ROOMS as never } : {}
      const f = await buildFixture(house, {}, undefined, published)
      return reconstructV2({
        label: house.name,
        slug: house.name.toLowerCase(),
        sourcePackageId: f.pkg.id,
        sourcePackageHash: f.pkg.contentHash,
        graph: f.graph,
        metrics: f.metrics,
        raster: (frame) => {
          const asset = f.pkg.assets.find((a) => a.id === frame.assetId)
          const bytes = asset ? f.bytesByUrl.get(asset.variants[0].url) : undefined
          return bytes ? decodeImage(bytes) : undefined
        },
        publishedRooms: (f.pkg.publishedRooms as never) ?? [],
      })
    })()
    cache.set(house.name, p)
  }
  return p
}

const facadeOf = (side: string): 'FRONT' | 'REAR' | 'WEST' | 'EAST' => (side === 'LEFT' ? 'WEST' : side === 'RIGHT' ? 'EAST' : (side as 'FRONT' | 'REAR'))

/** Every opening the sheet draws has one in the candidate on the same wall, within a few centimetres. */
function expectOpenings(house: SyntheticHouse, r: ReconstructionV2Result, toleranceM = 0.08): void {
  const drawn = [...house.openings, ...(house.wings ?? []).flatMap((w) => w.openings ?? [])]
  for (const o of drawn) {
    const facade = facadeOf(o.side)
    const match = r.building.openings.find((x) => x.facade === facade && x.storeyIndex === o.storey && Math.abs(x.interval[0] - o.at) <= toleranceM && Math.abs(x.interval[1] - (o.at + o.width)) <= toleranceM)
    expect(match, `${house.name}: the ${o.kind} at ${o.at} on the ${o.side} of storey ${o.storey}`).toBeDefined()
  }
}

describe('§25 synthetic fixtures through the v2 analyzer', () => {
  it('seals every fixture as a replayable candidate with a clean graph and ledger, from no reference', async () => {
    for (const house of V2_FIXTURES) {
      const r = await run(house)
      expect(verifyReplay(r.candidate).ok, house.name).toBe(true)
      expect(r.violations.graph, house.name).toEqual([])
      expect(r.violations.ledger, house.name).toEqual([])
      for (const f of r.featureGraph.solved) expect(String(f.provenance)).not.toMatch(/REFERENCE|BENCHMARK|TRUTH/)
      expect(r.candidate.program.length).toBeGreaterThan(10)
    }
  }, 120_000)

  it('1 Ashby: one body, one storey, a gable along x, two windows and a door', async () => {
    const r = await run(ASHBY)
    expect(r.building.masses).toHaveLength(1)
    expect(r.building.levels).toHaveLength(1)
    expect(r.building.mainRoof?.kind).toBe('GABLE')
    expect(r.building.mainRoof?.ridgeAxis).toBe('X')
    expect(Math.abs((r.building.mainRoof?.pitchDeg ?? 0) - ASHBY.roof.pitchDeg)).toBeLessThan(1)
    expect(r.building.openings).toHaveLength(3)
    expectOpenings(ASHBY, r)
    const door = r.building.openings.find((o) => o.family === 'DOOR')
    expect(door?.sillY).toBeCloseTo(0, 1)
    for (const w of r.building.openings.filter((o) => o.family === 'WINDOW')) {
      expect(Math.abs(w.sillY - 0.9)).toBeLessThan(0.06)
      expect(Math.abs(w.headY - 2.3)).toBeLessThan(0.06)
    }
  }, 60_000)

  it('2 Brackenholt: two storeys, windows on both, the ridge along z read off the gable ends', async () => {
    const r = await run(BRACKENHOLT)
    expect(r.building.levels.map((l) => l.elevation)).toEqual([0, 2.75])
    expect(r.building.mainRoof?.ridgeAxis).toBe('Z')
    expect(Math.abs((r.building.mainRoof?.pitchDeg ?? 0) - BRACKENHOLT.roof.pitchDeg)).toBeLessThan(1)
    expect(r.building.openings).toHaveLength(7)
    expectOpenings(BRACKENHOLT, r)
    expect(r.building.openings.filter((o) => o.storeyIndex === 1)).toHaveLength(3)
  }, 60_000)

  it('3 Coldharbour: a lower attached body with a flat roof, with its own openings', async () => {
    const r = await run(COLDHARBOUR)
    expect(r.building.masses.map((m) => m.role).sort()).toEqual(['ATTACHED', 'MAIN'])
    const wing = r.building.masses.find((m) => m.role === 'ATTACHED')
    expect(wing?.storeys).toEqual([0])
    expect(Math.abs((wing?.x1 ?? 0) - (wing?.x0 ?? 0) - 3.4)).toBeLessThan(0.1)
    const roof = r.building.attachedRoofs.find((a) => a.massId === wing?.id)
    expect(roof).toBeDefined()
    expect(Math.abs((roof?.slabTopY ?? 0) - 2.85)).toBeLessThan(0.1)
    expectOpenings(COLDHARBOUR, r)
  }, 60_000)

  it('4 Dunmore: a front loggia with a return at each end, the roof running on over it', async () => {
    const r = await run(DUNMORE)
    const front = r.building.recesses.find((x) => x.side === 'FRONT' && x.storeyIndex === 0)
    expect(front).toBeDefined()
    expect(front?.returns).toHaveLength(2)
    expect(front?.open).toHaveLength(1)
    expect(Math.abs((front?.open[0].from ?? 0) - 0.4)).toBeLessThan(0.1)
    expect(Math.abs((front?.open[0].to ?? 0) - 8.0)).toBeLessThan(0.1)
    expect(r.world.envelope.z0).toBe(0)
    expect(Math.abs(r.world.walled.z0 - 1.6)).toBeLessThan(0.1)
    expect(r.building.returns).toHaveLength(2)
    expect(r.building.mainRoof?.coversZones).toBe(true)
    expect(r.building.mainRoof?.footprint.z0).toBe(0)
    // The loggia's floor is a first-class terrace: at the threshold, against the front facade, covering the open mouth.
    const terrace = r.building.terraces.find((t) => t.side === 'FRONT' && t.storeyIndex === 0)
    expect(terrace).toBeDefined()
    expect(r.building.balconies.some((b) => b.kind === 'TERRACE')).toBe(false)
    const xs = terrace?.polygon.map((p) => p.x) ?? []
    const zs = terrace?.polygon.map((p) => p.z) ?? []
    expect(Math.min(...xs)).toBeLessThan((front?.open[0].from ?? 0) + 0.1)
    expect(Math.max(...xs)).toBeGreaterThan((front?.open[0].to ?? 0) - 0.1)
    expect(Math.min(...zs)).toBeLessThan(0.1)
    expect(Math.max(...zs)).toBeGreaterThan(1.5)
    expect(r.model.terraces.find((t) => t.id === terrace?.id)).toBeDefined()
    expectOpenings(DUNMORE, r)
  }, 60_000)

  it('5 Elmbridge: a partition with a door on each storey, two numbered rooms each, labelled from the published list', async () => {
    const r = await run(ELMBRIDGE)
    for (const storey of [0, 1]) {
      const s = r.building.interior.find((x) => x.storeyIndex === storey && x.rooms.length > 1)
      expect(s, `storey ${storey}`).toBeDefined()
      expect(s?.walls.length).toBeGreaterThanOrEqual(1)
      expect(s?.doors).toHaveLength(1)
      expect(s?.rooms).toHaveLength(2)
      const published = ELMBRIDGE_ROOMS.filter((p) => p.storey === (storey === 0 ? 'GROUND' : 'UPPER'))
      for (const p of published) {
        const room = s?.rooms.find((x) => x.number === String(p.index))
        expect(room, `room ${p.index} on storey ${storey}`).toBeDefined()
        expect(room?.label).toBe(p.label)
        expect(Math.abs((room?.areaM2 ?? 0) - p.area) / p.area).toBeLessThan(0.08)
      }
    }
    expectOpenings(ELMBRIDGE, r)
  }, 60_000)

  it('6 Foxlow: a straight stair of sixteen risers with its walking-line arrow', async () => {
    const r = await run(FOXLOW)
    const stair = r.building.stair?.hypothesis
    expect(stair).toBeDefined()
    expect(stair?.turnKind).toBe('STRAIGHT')
    expect(stair?.flights).toHaveLength(1)
    expect(stair?.flights[0].direction).toBe(FOXLOW.stair?.direction)
    expect(stair?.risersTotal).toBe(FOXLOW.stair?.risers)
    expect(Math.abs((stair?.flights[0].goingM ?? 0) - (FOXLOW.stair?.going ?? 0))).toBeLessThan(0.02)
    expect(Math.abs((stair?.widthM ?? 0) - (FOXLOW.stair?.width ?? 0))).toBeLessThan(0.1)
    expect(Math.abs((stair?.start.x ?? 0) - (FOXLOW.stair?.x ?? 0))).toBeLessThan(0.05)
    expect(stair?.arrow).toBeDefined()
    expect(stair?.unresolved).toEqual([])
    expect(r.model.stairs.length).toBe(1)
  }, 60_000)

  it('7 Greywell: a chimney read on both plans and measured above the roof on the elevations', async () => {
    const r = await run(GREYWELL)
    expect(r.building.chimneys).toHaveLength(1)
    const c = r.building.chimneys[0]
    const spec = GREYWELL.chimneys?.[0]
    expect(Math.abs(c.x0 - (spec?.x0 ?? 0))).toBeLessThan(0.1)
    expect(Math.abs(c.x1 - (spec?.x1 ?? 0))).toBeLessThan(0.1)
    expect(Math.abs(c.z0 - (spec?.z0 ?? 0))).toBeLessThan(0.1)
    expect(Math.abs(c.z1 - (spec?.z1 ?? 0))).toBeLessThan(0.1)
    expect(Math.abs((c.topY ?? 0) - (spec?.top ?? 0))).toBeLessThan(0.15)
    expect(r.model.chimneys.length).toBe(1)
    // The stack stands on the west slope, so the roof carries its penetration.
    expect(r.model.roofOpenings.filter((o) => o.kind === 'PENETRATION')).toHaveLength(1)
  }, 60_000)

  it('8 Hatherleigh: a rooflight found as a light patch in the roof plane', async () => {
    const r = await run(HATHERLEIGH)
    expect(r.building.rooflights).toHaveLength(1)
    const spec = HATHERLEIGH.rooflights?.[0]
    const light = r.building.rooflights[0]
    expect(light.slope).toBe(spec?.slope)
    expect(Math.abs(light.alongFrom - (spec?.along ?? 0))).toBeLessThan(0.1)
    expect(Math.abs(light.alongTo - ((spec?.along ?? 0) + (spec?.width ?? 0)))).toBeLessThan(0.1)
    expect(r.model.rooflights.length).toBe(1)
  }, 60_000)

  it('9 Ivybank: the attic window on the gable end takes a raked head', async () => {
    const r = await run(IVYBANK)
    const attic = r.building.openings.filter((o) => o.storeyIndex === 1)
    expect(attic).toHaveLength(1)
    const w = attic[0]
    expect(w.profile).toBe('RAKED_SINGLE')
    expect(w.headFarY).toBeDefined()
    expect((w.headFarY ?? 0) < w.headY).toBe(true)
    expect(Math.abs(w.sillY - 3.7)).toBeLessThan(0.1)
    // With no printed height, the head is read off the elevation's band; the rake keeps it under the roof line.
    expect(w.headY).toBeLessThan(r.building.mainRoof?.ridgeY ?? 0)
    expect(r.model.openings.find((o) => o.id === w.id)?.head?.kind).toBe('RAKED')
    expectOpenings(IVYBANK, r)
  }, 60_000)

  it('10 Kelsall: an upper loggia with a balcony slab, its fascia and a railing', async () => {
    const r = await run(KELSALL)
    const upper = r.building.recesses.find((x) => x.side === 'FRONT' && x.storeyIndex === 1)
    expect(upper?.returns).toHaveLength(2)
    const balcony = r.building.balconies.find((b) => b.kind === 'BALCONY' && b.storeyIndex === 1)
    expect(balcony).toBeDefined()
    const spec = KELSALL.balconies?.[0]
    expect(Math.abs((balcony?.x0 ?? 0) - (spec?.x0 ?? 0))).toBeLessThan(0.1)
    expect(Math.abs((balcony?.x1 ?? 0) - (spec?.x1 ?? 0))).toBeLessThan(0.1)
    expect(Math.abs((balcony?.topY ?? 0) - 2.85)).toBeLessThan(0.1)
    expect(Math.abs((balcony?.thicknessM ?? 0) - (spec?.fasciaDepth ?? 0))).toBeLessThan(0.08)
    expect(r.building.railings).toHaveLength(1)
    expect(Math.abs(r.building.railings[0].heightM - (spec?.railingHeight ?? 0))).toBeLessThan(0.1)
    expect(r.building.mainRoof?.coversZones).toBe(true)
    expectOpenings(KELSALL, r)
  }, 60_000)
})
