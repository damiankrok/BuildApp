/**
 * BUILDPLAN-ANALYZER-005X-N2: the plan of the storey under the roof is read for rooflights on its own.
 *
 * DEC-UNIVERSAL-OPENING-CORE-003: the plan is the ground, a render only confirms. 005X-N1 had made the plan's callouts
 * wait on a render showing a rooflight patch; here a synthetic house states two rooflights on its attic plan only — no
 * elevation draws a patch, the roof plane is not even coloured — and both come out of the analyzer as SOURCE_DERIVED,
 * on the slope and at the place the plan states. The same house without the callouts has none, and the ring search's
 * prefilter changes nothing it reads.
 *
 * Every sheet is drawn here from an invented house; no drawing of a real project is used.
 */
import { describe, expect, it } from 'vitest'
import { decodeImage } from '@buildapp/source-package'
import { readTintedCallouts } from '@buildapp/source-metrics'
import { IVYBANK, renderGroundPlan } from '@buildapp/synthetic-drawings'
import type { SyntheticHouse } from '@buildapp/synthetic-drawings'
import { reconstructV2 } from '../src/index.js'
import type { ReconstructionV2Result } from '../src/index.js'
import { buildFixture } from './pipeline.js'

const STATED: SyntheticHouse = {
  ...IVYBANK,
  name: 'Juniper',
  rooflights: [
    { slope: 'LOW', along: 1.4, width: 0.78, y: 0.5, height: 1.18, stated: { widthCm: 78, lengthCm: 118 }, onElevations: false },
    { slope: 'HIGH', along: 3.6, width: 0.66, y: 0.5, height: 0.98, stated: { widthCm: 66, lengthCm: 98 }, onElevations: false },
  ],
}

/** Sheets at a scale whose callout digits are legible (about ten pixels tall). */
const SHEET = { pixelsPerMetre: 60 }

async function run(house: SyntheticHouse): Promise<ReconstructionV2Result> {
  const f = await buildFixture(house, SHEET)
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
    publishedRooms: [],
  })
}

describe('005X-N2 rooflights from the plan alone', () => {
  it('reads the rooflights the attic plan states, with no render or elevation showing them', async () => {
    const r = await run(STATED)
    const lights = [...r.building.rooflights].sort((a, b) => a.alongFrom - b.alongFrom)
    expect(lights).toHaveLength(2)
    for (const l of lights) expect(l.provenance).toBe('SOURCE_DERIVED')
    expect(lights[0].slope).toBe('LOW')
    expect(lights[1].slope).toBe('HIGH')
    expect(lights[0].alongFrom).toBeCloseTo(1.4, 0)
    expect(lights[0].alongTo - lights[0].alongFrom).toBeCloseTo(0.78, 1)
    expect(lights[1].alongTo - lights[1].alongFrom).toBeCloseTo(0.66, 1)
    expect(r.model.rooflights.length).toBe(2)
  }, 180_000)

  it('finds none where the plan states none, and none on a sheet without rings', async () => {
    const r = await run(IVYBANK)
    expect(r.building.rooflights).toHaveLength(0)
    const plain = renderGroundPlan(IVYBANK, { ...SHEET, storey: 1 }).toRaster()
    const t0 = performance.now()
    expect(readTintedCallouts(plain, { minRadiusPx: 9, maxRadiusPx: 27 })).toHaveLength(0)
    expect(performance.now() - t0).toBeLessThan(5_000)
  }, 180_000)

  it('the ring search reads the same with its prefilter as without it', () => {
    const sheet = renderGroundPlan(STATED, { ...SHEET, storey: 1 }).toRaster()
    const options = { minRadiusPx: 9, maxRadiusPx: 27 }
    const full = readTintedCallouts(sheet, { ...options, prefilter: false })
    const fast = readTintedCallouts(sheet, options)
    expect(full.filter((c) => c.widthCm !== null)).toHaveLength(2)
    expect(JSON.stringify(fast)).toBe(JSON.stringify(full))
  }, 60_000)
})
