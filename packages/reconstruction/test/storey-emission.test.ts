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
import type { CanonicalBuildingModel } from '@buildapp/model'
import type { SyntheticHouse, SyntheticOpening } from '@buildapp/synthetic-drawings'
import { SHAPE_FAMILIES } from '@buildapp/synthetic-drawings'
import { reconstructV2 } from '../src/index.js'
import type { ReconstructionV2Result } from '../src/index.js'
import { buildFixture } from './pipeline.js'

const door = (at: number, width = 1.0, storey = 0, side: SyntheticOpening['side'] = 'FRONT'): SyntheticOpening => ({ side, kind: 'DOOR', at, width, height: 2.1, sill: 0, storey })
const window_ = (at: number, width: number, storey = 0, side: SyntheticOpening['side'] = 'FRONT'): SyntheticOpening => ({ side, kind: 'WINDOW', at, width, height: 1.4, sill: 0.9, storey })
const twoStoreys = [
  { name: 'ground', height: 2.8 },
  { name: 'upper', height: 2.6 },
]

/** An upper storey set back 2.4 m from the rear wall: its own plan draws it 6.0 m deep over an 8.4 m house. */
export const INSET_REAR: SyntheticHouse = {
  name: 'Inset upper storey',
  frame: 'MODEL',
  width: 9.6,
  depth: 8.4,
  wallThickness: 0.4,
  storeys: twoStoreys,
  roof: { pitchDeg: 35, overhang: 0, ridgeAxis: 'X' },
  openings: [door(1.0), window_(4.4, 1.6), window_(1.6, 1.3, 1), window_(5.6, 1.3, 1)],
  members: [],
  chainsX: [9.6],
  chainsZ: [8.4],
  upperInset: { minZ: 2.4 },
  upperChainsX: [9.6],
  upperChainsZ: [6.0],
  // a bearing wall 3.0 m behind the front wall that carries on up: the one wall both plans draw inside the house,
  // and what fixes where the shallower upper storey stands
  partitions: [0, 1].map((storey) => ({ storey, axis: 'X' as const, at: 3.0, from: 0.4, to: 9.2, thickness: 0.24, doors: [{ at: 4.0, width: 0.9 }] })),
}

/** A two-storey house and a one-storey garage against its east wall; the upper plan draws the house only. */
export const HOUSE_AND_GARAGE: SyntheticHouse = {
  name: 'House and garage',
  frame: 'MODEL',
  width: 8.4,
  depth: 7.6,
  wallThickness: 0.4,
  storeys: twoStoreys,
  roof: { pitchDeg: 38, overhang: 0, ridgeAxis: 'Z' },
  openings: [door(1.0), window_(4.4, 1.6), window_(1.4, 1.3, 1), window_(5.2, 1.3, 1)],
  members: [],
  chainsX: [8.4, 4.0],
  chainsZ: [7.6],
  upperChainsX: [8.4],
  upperChainsZ: [7.6],
  wings: [{ name: 'garage', width: 4.0, depth: 5.2, offsetZ: 0, storeys: 1, roof: 'FLAT', openings: [window_(1.2, 1.2, 0, 'RIGHT')] }],
}

/** The same house with the wing carried up: its upper plan draws both bodies. */
export const HOUSE_AND_WING_UP: SyntheticHouse = {
  ...HOUSE_AND_GARAGE,
  name: 'House and two-storey wing',
  upperChainsX: [8.4, 4.0],
  wings: [{ name: 'wing', width: 4.0, depth: 5.2, offsetZ: 0, storeys: 2, roof: 'FLAT', openings: [window_(1.2, 1.2, 0, 'RIGHT')] }],
}

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

type Box = [number, number, number, number]
/** Each level's exterior wall rings, as the boxes their walls span (wall axes), in model metres. */
export function ringsByLevel(model: CanonicalBuildingModel): Map<number, Box[]> {
  const walls = new Map(model.walls.map((w) => [w.id, w]))
  const out = new Map<number, Box[]>()
  for (const level of model.levels) {
    const boxes = model.wallRings
      .filter((r) => r.levelId === level.id)
      .map((r) => r.wallIds.map((id) => walls.get(id)).filter((w): w is NonNullable<typeof w> => w !== undefined))
      .filter((ws) => ws.length > 0)
      .map((ws): Box => {
        const xs = ws.flatMap((w) => [w.start.x, w.end.x])
        const zs = ws.flatMap((w) => [w.start.z, w.end.z])
        return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)]
      })
      .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    out.set(level.index, boxes)
  }
  return out
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
