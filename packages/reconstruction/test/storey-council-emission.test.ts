/**
 * BUILDPLAN-ANALYZER-005L — per-storey geometry in the emitted model, as council reviewer B attacked it.
 *
 * Each house is drawn as PNG sheets (`@buildapp/synthetic-drawings`, dimensions made up in `storey-houses.ts`), read by
 * the whole v2 pipeline and judged on the model it emits. A plan of another storey (a basement, an attic) is drawn as
 * a second house's plan sheet and named for its storey, as a publisher's page would name it.
 */
import { describe, expect, it } from 'vitest'
import { decodeImage } from '@buildapp/source-package'
import { renderSheets } from '@buildapp/synthetic-drawings'
import type { SyntheticHouse, SyntheticSheet } from '@buildapp/synthetic-drawings'
import type { CanonicalBuildingModel } from '@buildapp/model'
import { reconstructV2 } from '../src/index.js'
import type { ReconstructionV2Result } from '../src/index.js'
import { buildFixtureFrom } from './pipeline.js'
import { BASEMENT_PLAN, GARAGE_BASEMENT_PLAN, GARAGE_HOUSE, INSET_WEST, L_TWO_MASSES, THREE, THREE_ATTIC_PLAN, WITH_BASEMENT, ringsByLevel } from './storey-houses.js'

const solveSheets = async (name: string, sheets: SyntheticSheet[]): Promise<ReconstructionV2Result> => {
  const fx = await buildFixtureFrom(sheets)
  return reconstructV2({
    label: name,
    slug: 'storey-council',
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
/** Another house's ground plan, named as this house's plan of another storey. */
const planOf = (house: SyntheticHouse, slug: 'rzut-parteru' | 'rzut-pietra', storey: SyntheticSheet['storey'], as: string): SyntheticSheet => {
  const sheet = renderSheets(house).find((s) => s.slug === slug)
  if (!sheet) throw new Error(`no ${slug}`)
  return { ...sheet, storey, slug: as }
}
const level = (m: CanonicalBuildingModel, index: number) => m.levels.find((l) => l.index === index)
const openingsOn = (m: CanonicalBuildingModel, index: number) => {
  const id = level(m, index)?.id
  const walls = new Map(m.walls.map((w) => [w.id, w]))
  return m.openings.filter((o) => walls.get(o.wallId)?.levelId === id)
}
const slabsOn = (m: CanonicalBuildingModel, index: number) => m.slabs.filter((s) => s.levelId === level(m, index)?.id)
const boxOf = (poly: ReadonlyArray<{ x: number; z: number }>): number[] => [Math.min(...poly.map((p) => p.x)), Math.min(...poly.map((p) => p.z)), Math.max(...poly.map((p) => p.x)), Math.max(...poly.map((p) => p.z))]

describe('005L council B: per-storey geometry in the emitted model', () => {
  it('B5L-5 an upper storey set back from one side builds its windows on its own set-back wall, and no window where its plan draws wall', async () => {
    const r = await solveSheets(INSET_WEST.name, renderSheets(INSET_WEST))
    const rings = ringsByLevel(r.model)
    expect(rings.get(1)).toHaveLength(1)
    const upper = rings.get(1)![0]
    expect(upper[0]).toBeGreaterThan(2.2)
    expect(upper[0]).toBeLessThan(2.6)
    // the three windows the upper plan draws, each with a sill: no sill-0 "window" where a drawn wall was missed
    const windows = openingsOn(r.model, 1).filter((o) => o.kind === 'WINDOW')
    expect(windows).toHaveLength(3)
    expect(windows.every((o) => o.sill > 0.5)).toBe(true)
  }, 180_000)

  it('B5L-5 an L outline on the upper sheet is not put on one leg of it: the plan keeps the scale its registration states', async () => {
    const r = await solveSheets(L_TWO_MASSES.name, renderSheets(L_TWO_MASSES))
    const upper = ringsByLevel(r.model).get(1) ?? []
    expect(upper.length).toBeGreaterThan(0)
    expect(upper[0][3] - upper[0][1]).toBeGreaterThan(5.0)
    expect(upper[0][3] - upper[0][1]).toBeLessThan(5.4)
    // the two windows the upper plan draws on the house's front, and nothing else
    const ops = openingsOn(r.model, 1)
    expect(ops.filter((o) => o.kind === 'WINDOW')).toHaveLength(2)
    expect(ops.every((o) => o.kind !== 'WINDOW' || o.sill > 0.5)).toBe(true)
  }, 180_000)

  it('B5L-2 ground, upper and attic plans: the attic is storey 2, built on its own level with its own openings', async () => {
    const r = await solveSheets(THREE.name, [...renderSheets(THREE), planOf(THREE_ATTIC_PLAN, 'rzut-pietra', 'ATTIC', 'rzut-poddasza')])
    expect(r.model.levels.map((l) => l.index)).toEqual([0, 1, 2])
    const rings = ringsByLevel(r.model)
    // the upper storey is the whole box; the attic is shallower than it, never a copy of it
    expect(rings.get(1)).toEqual(rings.get(0))
    expect(rings.get(2)).toHaveLength(1)
    expect(rings.get(2)![0][3] - rings.get(2)![0][1]).toBeLessThan(4.5)
    expect(openingsOn(r.model, 2).length).toBeGreaterThan(0)
  }, 180_000)

  it('B5L-6 a partial basement: its own ring and its own floor, the ground floor at its datum', async () => {
    const r = await solveSheets(WITH_BASEMENT.name, [...renderSheets(WITH_BASEMENT), planOf(BASEMENT_PLAN, 'rzut-parteru', 'BASEMENT', 'rzut-piwnicy')])
    expect(r.model.levels.map((l) => l.index)).toEqual([-1, 0, 1])
    const rings = ringsByLevel(r.model)
    const basement = rings.get(-1)![0]
    expect(basement[3] - basement[1]).toBeGreaterThan(5.0)
    expect(basement[3] - basement[1]).toBeLessThan(5.8)
    expect(rings.get(0)![0][3] - rings.get(0)![0][1]).toBeCloseTo(8.4, 1)
    const floor = boxOf(slabsOn(r.model, -1)[0].polygon)
    expect(floor[3] - floor[1]).toBeLessThan(5.8)
    expect(level(r.model, 0)?.elevation).toBeCloseTo(0, 2)
  }, 180_000)

  it('B5L-6 a basement under the garage only: built under the garage, the model emitted', async () => {
    const r = await solveSheets(GARAGE_HOUSE.name, [...renderSheets(GARAGE_HOUSE), planOf(GARAGE_BASEMENT_PLAN, 'rzut-parteru', 'BASEMENT', 'rzut-piwnicy')])
    expect(r.model.levels.map((l) => l.index)).toEqual([-1, 0, 1])
    const basement = ringsByLevel(r.model).get(-1)!
    expect(basement).toHaveLength(1)
    expect(basement[0][2] - basement[0][0]).toBeCloseTo(4.0, 1)
    // the house above it is still the two-storey house, the garage still one storey
    expect(ringsByLevel(r.model).get(1)).toHaveLength(1)
  }, 180_000)
})
