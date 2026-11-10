/**
 * v3.51 ANY-LINK-4: the measure a large plan sheet's reading size is decided by is the caller's to choose, and the
 * analyzer says which sheets the other measure would read at another size (`rereadable`). A run whose first reading
 * was refused reads exactly those sheets again (analysis-service `runAnalysis`); a sheet with one reading size under
 * both measures is never read twice.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import { analyzeSourcePackage } from '../src/index.js'
import { BLACK, fill, sheet } from './draw.js'
import { analyseScene, scene } from './scene.js'

/** A 1600×1200 plan: an outer ring `wall` px thick, and short thin bars inside it that share no row or column. */
const furnished = (wall: number, bars: number): Raster => {
  const r = sheet(1600, 1200)
  const [x0, y0, x1, y1] = [100, 60, 1500, 1140]
  fill(r, x0, y0, x1, y0 + wall - 1, BLACK)
  fill(r, x0, y1 - wall + 1, x1, y1, BLACK)
  fill(r, x0, y0, x0 + wall - 1, y1, BLACK)
  fill(r, x1 - wall + 1, y0, x1, y1, BLACK)
  for (let i = 0; i < bars; i += 1) {
    const bx = 220 + ((i * 110) % 1100)
    const by = 160 + ((i * 20) % 820)
    fill(r, bx, by, bx + 99, by + 11, BLACK)
  }
  return r
}

const planFrame = (result: Awaited<ReturnType<typeof analyseScene>>) => result.graph.coordinateFrames.find((f) => f.roles.document === 'FLOOR_PLAN')

describe('the measure a plan sheet’s reading size is decided by', () => {
  it('by the first measure a furnished sheet with thick outer walls keeps its size, and is named as readable at another', async () => {
    const result = await analyseScene([{ slug: 'plan-furnished', raster: furnished(48, 60), roles: { document: 'FLOOR_PLAN' } }])
    expect(planFrame(result)?.size).toEqual({ width: 1600, height: 1200 })
    expect(result.readingSizes).toEqual([])
    expect(result.rereadable).toEqual([{ assetId: 'asset-plan-furnished', readAt: { width: 1600, height: 1200 }, otherwiseAt: { width: 600, height: 450 } }])
  })

  it('by the second measure the same sheet is read at the size its walls ask for, in a frame of that size', async () => {
    const { pkg, bytes } = scene([{ slug: 'plan-furnished', raster: furnished(48, 60), roles: { document: 'FLOOR_PLAN' } }])
    const result = await analyzeSourcePackage(pkg, { bytes: async (url) => bytes.get(url) ?? null, readingMeasure: 'WALL_LONG_BANDS' })
    expect(planFrame(result)?.size).toEqual({ width: 600, height: 450 })
    expect(result.readingSizes).toMatchObject([{ assetId: 'asset-plan-furnished', readAt: { width: 600, height: 450 }, typicalWallPx: 48 }])
    expect(result.rereadable).toEqual([{ assetId: 'asset-plan-furnished', readAt: { width: 600, height: 450 }, otherwiseAt: { width: 1600, height: 1200 } }])
  })

  it('counter-case: a sheet both measures read at one size is not named — nothing is read twice', async () => {
    // an unfurnished large sheet with thick walls: both measures bring it down alike
    const thick = await analyseScene([{ slug: 'plan-bare', raster: furnished(48, 0), roles: { document: 'FLOOR_PLAN' } }])
    expect(thick.readingSizes.length).toBe(1)
    expect(thick.rereadable).toEqual([])
    // a large sheet with walls of ordinary thickness: both leave it alone
    const ordinary = await analyseScene([{ slug: 'plan-ordinary', raster: furnished(14, 60), roles: { document: 'FLOOR_PLAN' } }])
    expect(ordinary.readingSizes).toEqual([])
    expect(ordinary.rereadable).toEqual([])
  })

  it('counter-case: only plan sheets have a reading size — an elevation is never named', async () => {
    const result = await analyseScene([{ slug: 'elevation-furnished', raster: furnished(48, 60), roles: { document: 'ELEVATION', view: 'FRONT' } }])
    expect(result.rereadable).toEqual([])
    expect(result.readingSizes).toEqual([])
  })
})
