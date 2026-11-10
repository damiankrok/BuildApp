/**
 * v3.51 ANY-LINK-4: a run whose first reading of the plan the solver refused reads the plan sheets again at their
 * other admissible reading size — once, only where there is such a size, and the first refusal stands unless the
 * second reading builds a model. (That a second reading can build one is measured on real sheets, not here: these
 * synthetic sheets state no scale, so both readings are refused and the test observes the order of events.)
 */
import { describe, expect, it } from 'vitest'
import { memoryByteCache } from '@buildapp/source-package'
import type { Raster } from '@buildapp/source-cv'
import { AnalysisError, runAnalysis } from '../src/index.js'
import { BLACK, fill, sheet } from '../../source-analyzer/test/draw.js'
import { scene } from '../../source-analyzer/test/scene.js'

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

const elevation = (): Raster => {
  const r = sheet(800, 500)
  fill(r, 100, 200, 700, 204, BLACK)
  fill(r, 100, 200, 104, 420, BLACK)
  fill(r, 696, 200, 700, 420, BLACK)
  fill(r, 60, 420, 740, 424, BLACK)
  return r
}

const refusalOf = async (plan: Raster): Promise<{ error: AnalysisError; readings: number }> => {
  const { pkg, bytes } = scene([
    { slug: 'plan', raster: plan, roles: { document: 'FLOOR_PLAN', storey: 'GROUND' } },
    { slug: 'front', raster: elevation(), roles: { document: 'ELEVATION', view: 'FRONT' } },
  ])
  const cache = memoryByteCache()
  for (const [url, entry] of bytes) await cache.put(url, entry.bytes, entry.mediaType)
  let readings = 0
  try {
    await runAnalysis({ kind: 'PACKAGE', pkg }, { adapters: [], cache, now: () => new Date('2026-01-01T00:00:00Z'), onPhaseStats: () => (readings += 1) })
  } catch (e) {
    if (e instanceof AnalysisError) return { error: e, readings }
    throw e
  }
  throw new Error('expected the run to be refused')
}

describe('a refused plan reading and the sheet’s other reading size', () => {
  it('a sheet with a second admissible size is read twice; refused both times, the FIRST refusal is the run’s answer', async () => {
    const { error, readings } = await refusalOf(furnished(48, 60))
    expect(error.code).toBe('RECONSTRUCTION_FAILED')
    expect(readings).toBe(2)
    // the answer is the first reading's: its trace knows nothing of a second, and names the sheet as readable otherwise
    expect(error.attachments?.trace?.entries.some((e) => e.substage === 'PLAN_SHEETS_REREAD')).toBe(false)
    expect(error.attachments?.rereadable).toEqual([{ assetId: 'asset-plan', readAt: { width: 1600, height: 1200 }, otherwiseAt: { width: 600, height: 450 } }])
  }, 240_000)

  it('counter-case: a sheet with one reading size is read once', async () => {
    const { error, readings } = await refusalOf(furnished(14, 60))
    expect(error.code).toBe('RECONSTRUCTION_FAILED')
    expect(readings).toBe(1)
    expect(error.attachments?.rereadable).toBeUndefined()
  }, 240_000)
})
