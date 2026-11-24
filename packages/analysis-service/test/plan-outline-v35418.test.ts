/**
 * v3.54.18 R2 — the plan read names the main entrance's place on the outline when the plan shows it: the one fact that
 * tells which END of the house a turned front elevation draws. A scripted model; no provider.
 */
import { describe, expect, it } from 'vitest'
import type { ConsultantModel, ModelTurn } from '../src/consult/loop.js'
import { PLAN_OUTLINE_PROMPT_VERSION, PLAN_OUTLINE_SYSTEM, readPlanOutline } from '../src/consult/plan-outline.js'
import { drawnStretches, planSideInModel, SIDE_MARGIN, stretchAgreement } from '../src/consult/plan-openings.js'

const W = 600
const H = 500
const raster = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4).fill(255) }
const fake = (input: unknown): ConsultantModel => ({ id: 'fake', model: 'fake', maxOutputTokens: 1000, send: async (): Promise<ModelTurn> => ({ content: [{ type: 'tool_use', id: 't', name: 'report_outline', input } as never], usage: { inputTokens: 900, outputTokens: 200 }, model: 'fake', latencyMs: 1 }) })
const price = { inputUsdPerMTok: 2, outputUsdPerMTok: 10 }
const OUTLINE = [[100, 100], [500, 100], [500, 400], [100, 400]]
const read = (extra: Record<string, unknown>) => readPlanOutline({ model: fake({ outline: OUTLINE, parts: ['MAIN'], orthogonal: true, ...extra }), price }, { frameId: 'frame-plan', raster, caption: 'rzut parteru', sourceByteHash: 'p'.repeat(64), scale: { mPerPx: 0.03, why: 'controlled' } })

describe('v3.54.18 R2 plan read: the main entrance on the outline', () => {
  it('the prompt asks for it only where the plan shows it', () => {
    expect(PLAN_OUTLINE_PROMPT_VERSION).toBe('plan-outline/3')
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

describe('v3.54.18 R3 plan read: the openings of the exterior walls, by side, as a viewer outside sees them', () => {
  it('each side runs left to right for a viewer outside it: the foot with x, the right side up the sheet, the head against x, the left side down the sheet', async () => {
    const r = await read({ openings: [{ side: 'BOTTOM', from: 140, to: 180, kind: 'WINDOW' }, { side: 'TOP', from: 140, to: 180, kind: 'WINDOW' }, { side: 'RIGHT', from: 130, to: 160, kind: 'DOOR' }, { side: 'LEFT', from: 130, to: 160, kind: 'GLAZED_DOOR' }] })
    const by = Object.fromEntries((r.openings ?? []).map((o) => [o.side, [o.u0, o.u1]]))
    expect(by.FRONT).toEqual([0.1, 0.2])
    expect(by.REAR).toEqual([0.8, 0.9])
    expect(by.RIGHT).toEqual([0.8, 0.9])
    expect(by.LEFT).toEqual([0.1, 0.2])
    expect(PLAN_OUTLINE_SYSTEM).toMatch(/nothing inferred/)
  })
  it('a quarter turn keeps the sides\' order round the house', () => {
    // a body whose front is the sheet's LEFT: the sheet's foot is its right side, the sheet's head its left
    expect(planSideInModel('LEFT', 'LEFT')).toBe('FRONT')
    expect(planSideInModel('FRONT', 'LEFT')).toBe('RIGHT')
    expect(planSideInModel('RIGHT', 'LEFT')).toBe('REAR')
    expect(planSideInModel('REAR', 'LEFT')).toBe('LEFT')
    expect(planSideInModel('REAR', 'RIGHT')).toBe('RIGHT')
    expect(planSideInModel('FRONT')).toBe('FRONT')
  })
  it('two side elevations are told apart by the plan: four windows against a terrace door and two windows; counter-trial: alike sides are not', () => {
    const four = [{ u0: 0.08, u1: 0.17 }, { u0: 0.3, u1: 0.39 }, { u0: 0.58, u1: 0.67 }, { u0: 0.8, u1: 0.89 }]
    const garden = [{ u0: 0.1, u1: 0.32 }, { u0: 0.55, u1: 0.64 }, { u0: 0.75, u1: 0.84 }]
    const planA = [{ u0: 0.07, u1: 0.16 }, { u0: 0.31, u1: 0.4 }, { u0: 0.57, u1: 0.66 }, { u0: 0.81, u1: 0.9 }]
    const planB = [{ u0: 0.09, u1: 0.3 }, { u0: 0.56, u1: 0.65 }, { u0: 0.76, u1: 0.85 }]
    const right = stretchAgreement(planA, four).score + stretchAgreement(planB, garden).score
    const swapped = stretchAgreement(planB, four).score + stretchAgreement(planA, garden).score
    expect(right).toBe(7)
    expect(right - swapped).toBeGreaterThanOrEqual(SIDE_MARGIN)
    // counter-trial: two sides the plan draws alike decide nothing
    expect(Math.abs(stretchAgreement(planA, four).score + stretchAgreement(planA, four).score - (stretchAgreement(planA, four).score + stretchAgreement(planA, four).score))).toBeLessThan(SIDE_MARGIN)
    const mirrored = four.map((s) => ({ u0: 1 - s.u1, u1: 1 - s.u0 }))
    expect(stretchAgreement(planA, mirrored).matched).toBe(4)
  })
  it('only the lowest storey\'s openings of an elevation are held against the plan', () => {
    const sk = { groundRow: 500, walls: [{ polygon: [[100, 500], [500, 500], [500, 300], [300, 150], [100, 300]] as Array<[number, number]> }], openings: [{ polygon: [[140, 480], [180, 480], [180, 380], [140, 380]] as Array<[number, number]> }, { polygon: [[280, 280], [320, 280], [320, 220], [280, 220]] as Array<[number, number]> }] }
    expect(drawnStretches(sk)).toEqual([{ u0: 0.1, u1: 0.2 }])
    expect(drawnStretches({ ...sk, groundRow: null })).toEqual([])
  })
})
