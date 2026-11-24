/**
 * v3.54.18 R2 — the plan read names the main entrance's place on the outline when the plan shows it: the one fact that
 * tells which END of the house a turned front elevation draws. A scripted model; no provider.
 */
import { describe, expect, it } from 'vitest'
import type { ConsultantModel, ModelTurn } from '../src/consult/loop.js'
import { PLAN_OUTLINE_PROMPT_VERSION, PLAN_OUTLINE_SYSTEM, readPlanOutline } from '../src/consult/plan-outline.js'

const W = 600
const H = 500
const raster = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4).fill(255) }
const fake = (input: unknown): ConsultantModel => ({ id: 'fake', model: 'fake', maxOutputTokens: 1000, send: async (): Promise<ModelTurn> => ({ content: [{ type: 'tool_use', id: 't', name: 'report_outline', input } as never], usage: { inputTokens: 900, outputTokens: 200 }, model: 'fake', latencyMs: 1 }) })
const price = { inputUsdPerMTok: 2, outputUsdPerMTok: 10 }
const OUTLINE = [[100, 100], [500, 100], [500, 400], [100, 400]]
const read = (extra: Record<string, unknown>) => readPlanOutline({ model: fake({ outline: OUTLINE, parts: ['MAIN'], orthogonal: true, ...extra }), price }, { frameId: 'frame-plan', raster, caption: 'rzut parteru', sourceByteHash: 'p'.repeat(64), scale: { mPerPx: 0.03, why: 'controlled' } })

describe('v3.54.18 R2 plan read: the main entrance on the outline', () => {
  it('the prompt asks for it only where the plan shows it', () => {
    expect(PLAN_OUTLINE_PROMPT_VERSION).toBe('plan-outline/2')
    expect(PLAN_OUTLINE_SYSTEM).toMatch(/MAIN ENTRANCE/)
    expect(PLAN_OUTLINE_SYSTEM).toMatch(/do not guess/)
  })
  it('a point on the left wall is the LEFT side; at the plan\'s foot the FRONT; at its head the REAR', async () => {
    expect((await read({ entrance: [102, 260] })).entrance?.side).toBe('LEFT')
    expect((await read({ entrance: [498, 180] })).entrance?.side).toBe('RIGHT')
    expect((await read({ entrance: [300, 396] })).entrance?.side).toBe('FRONT')
    expect((await read({ entrance: [300, 104] })).entrance?.side).toBe('REAR')
  })
  it('counter-trials: no entrance named — none taken; a point at a corner or inside the house names no side; the outline is read all the same', async () => {
    const none = await read({})
    expect(none.entrance).toBeUndefined()
    expect(none.observation?.outline).toHaveLength(4)
    const corner = await read({ entrance: [110, 390] })
    expect(corner.entrance?.side).toBeUndefined()
    expect(corner.entrance?.why).toMatch(/no side taken/)
    expect((await read({ entrance: [300, 250] })).entrance?.side).toBeUndefined()
  })
})
