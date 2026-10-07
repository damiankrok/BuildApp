/**
 * BUILDPLAN-ANALYZER-005L — per-storey geometry, through the emitted model.
 *
 * The storey a support relation decides is only real once the model has it: a storey count is not a building. Each
 * house below is drawn as PNG sheets (`@buildapp/synthetic-drawings`, dimensions made up there), read by the whole
 * v2 pipeline, and judged on the model it emits — each level's exterior wall rings and slabs — never on the layout's
 * storey spans alone.
 */
import { describe, expect, it } from 'vitest'
import { decodeImage } from '@buildapp/source-package'
import type { SyntheticHouse } from '@buildapp/synthetic-drawings'
import { SHAPE_FAMILIES } from '@buildapp/synthetic-drawings'
import { reconstructV2 } from '../src/index.js'
import type { ReconstructionV2Result } from '../src/index.js'
import { buildFixture } from './pipeline.js'
import { HOUSE_AND_GARAGE, HOUSE_AND_WING_UP, INSET_REAR, ringsByLevel } from './storey-houses.js'
import type { Box } from './storey-houses.js'

const solveV2 = async (house: SyntheticHouse): Promise<ReconstructionV2Result> => {
  const fx = await buildFixture(house)
  return reconstructV2({
    label: house.name,
    slug: 'storey-emission',
    sourcePackageId: fx.pkg.id,
    sourcePackageHash: fx.pkg.contentHash,
    graph: fx.graph,
    metrics: fx.metrics,
    raster: (frame) => {
      const asset = fx.pkg.assets.find((a) => a.id === frame.assetId)
      const bytes = asset ? fx.bytesByUrl.get(asset.variants[0].url) : undefined
      return bytes ? decodeImage(bytes) : undefined
    },
  })
}

const area = (b: Box): number => (b[2] - b[0]) * (b[3] - b[1])
const sameBox = (a: Box, b: Box, tol = 0.05): boolean => a.every((v, i) => Math.abs(v - b[i]) <= tol)

describe('005L per-storey geometry in the emitted model', () => {
  it('a house the same on both storeys: two levels, the upper ring the ground ring', async () => {
    const family = SHAPE_FAMILIES.find((f) => f.id === 'rectangle-two-storeys')
    if (!family) throw new Error('no family')
    const r = await solveV2(family.house)
    const rings = ringsByLevel(r.model)
    expect(r.model.levels).toHaveLength(2)
    expect(rings.get(1)).toHaveLength(1)
    expect(sameBox(rings.get(1)![0], rings.get(0)![0])).toBe(true)
  }, 120_000)

  it('an upper storey set back from the rear: its walls stop where its own plan draws them, not at the ground ring', async () => {
    const r = await solveV2(INSET_REAR)
    const rings = ringsByLevel(r.model)
    expect(r.model.levels).toHaveLength(2)
    const ground = rings.get(0)!
    const upper = rings.get(1)!
    expect(ground).toHaveLength(1)
    expect(upper).toHaveLength(1)
    // not a copy of the ground ring
    expect(sameBox(upper[0], ground[0])).toBe(false)
    // as wide as the house, about 2.4 m shallower
    expect(upper[0][2] - upper[0][0]).toBeCloseTo(ground[0][2] - ground[0][0], 1)
    expect(ground[0][3] - ground[0][1] - (upper[0][3] - upper[0][1])).toBeGreaterThan(2.0)
    expect(ground[0][3] - ground[0][1] - (upper[0][3] - upper[0][1])).toBeLessThan(2.8)
    // flush with the front, set back from the rear (model frame: z = 0 is the front)
    expect(upper[0][1]).toBeCloseTo(ground[0][1], 1)
    // the upper storey still has a floor
    const lvl1 = r.model.levels.find((l) => l.index === 1)!
    expect(r.model.slabs.some((s) => s.levelId === lvl1.id)).toBe(true)
    // no upper room over the strip the storey steps back from
    for (const room of r.model.rooms.filter((x) => x.levelId === lvl1.id)) {
      for (const p of room.polygon ?? []) expect(p.z).toBeLessThanOrEqual(upper[0][3] + 0.3)
    }
  }, 120_000)

  it('a one-storey garage against a two-storey house stays one storey in the model', async () => {
    const r = await solveV2(HOUSE_AND_GARAGE)
    const rings = ringsByLevel(r.model)
    expect(r.model.levels).toHaveLength(2)
    expect(rings.get(0)).toHaveLength(2)
    const upper = rings.get(1)!
    expect(upper).toHaveLength(1)
    // the upper ring is the house's, not the garage's and not both
    const house = rings.get(0)!.reduce((a, b) => (area(a) > area(b) ? a : b))
    expect(sameBox(upper[0], house, 0.3)).toBe(true)
  }, 120_000)

  it('a wing whose upper plan carries it up: both bodies on both storeys', async () => {
    const r = await solveV2(HOUSE_AND_WING_UP)
    const rings = ringsByLevel(r.model)
    expect(r.model.levels).toHaveLength(2)
    expect(rings.get(0)).toHaveLength(2)
    expect(rings.get(1)).toHaveLength(2)
  }, 120_000)
})
