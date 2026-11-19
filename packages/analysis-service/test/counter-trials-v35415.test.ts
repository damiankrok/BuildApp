/**
 * v3.54.15 §9 — counter-trials of the general cause, the ones not already held by the contract, sketch and metric tests:
 * a missing or deliberately wrong host; a ceiling mark versus the eaves; two witnesses disputing the ridge; the highest
 * mark that is not the ridge; another palette with the same form. Each states what reaches the geometry, not only that a
 * field is present.
 */
import { describe, expect, it } from 'vitest'
import { canonicalizeElevationAnswer, checkProportions, readElevationSketch, sketchToAppearance } from '../src/appearance/elevation-sketch.js'
import type { ElevationSketch } from '../src/appearance/elevation-sketch.js'
import { ridgeAndEaves } from '../src/consult/sketch-step.js'
import type { ConsultantModel, ModelTurn } from '../src/consult/loop.js'

const pic = { width: 800, height: 400, scale: 1, sha256: 'a'.repeat(64) }
const canon = (raw: unknown) => canonicalizeElevationAnswer({ raw, stopReason: 'tool_use', frameId: 'F', picture: pic, frame: { width: 800, height: 400 }, model: 'm' })
const win = [[300, 240], [380, 240], [380, 320], [300, 320]]
const wall = [[100, 200], [700, 200], [700, 380], [100, 380]]
const base = { groundRow: 380, silhouette: null, roofs: [], walls: [{ class: 'LIGHT_RENDER', polygon: wall, host: 'main', visibility: 'VISIBLE' }], elements: [] }

describe('v3.54.15 counter-trial: the host of an element', () => {
  it('a tuple without its host is the same opening with no host named: NORMALIZED, kept, the host left empty — not invented', () => {
    const r = canon({ ...base, openings: [['WINDOW', win]] })
    expect(r.sketch?.openings).toHaveLength(1)
    expect(r.sketch?.openings[0].host).toBe('')
    expect(r.account.elements.find((e) => e.path === 'openings[0]')?.fate).toBe('NORMALIZED')
  })
  it('a deliberately wrong host (a number where a body is named) is refused with its reason; the answer is PARTIAL', () => {
    const r = canon({ ...base, openings: [{ kind: 'WINDOW', polygon: win, host: 7 }] })
    expect(r.sketch?.openings).toHaveLength(0)
    expect(r.account.elements.find((e) => e.path === 'openings[0]')?.fate).toBe('REFUSED')
    expect(r.account.completeness).toBe('PARTIAL')
  })
})

describe('v3.54.15 counter-trial: which mark is the ridge and which the eaves', () => {
  it('a ceiling mark is never the eaves, and the highest mark is not the ridge unless it is called the ridge', () => {
    expect(ridgeAndEaves([{ role: 'CEILING', value: 2.8 }, { role: 'RIDGE', value: 5.54 }, { role: 'FLOOR', value: 0 }])).toEqual({ ridge: 5.54 })
    expect(ridgeAndEaves([{ role: 'CHIMNEY', value: 7.1 }, { role: 'RIDGE', value: 5.54 }])).toEqual({ ridge: 5.54 })
    expect(ridgeAndEaves([{ role: 'OTHER', value: 6.2 }, { role: 'UNKNOWN', value: 5.54 }])).toEqual({})
    expect(ridgeAndEaves([{ role: 'EAVES', value: 3.27 }, { role: 'CEILING', value: 2.8 }])).toEqual({ eaves: 3.27 })
  })
  it('two witnesses disputing the ridge leave it unset — the nearer or the larger is not chosen', () => {
    expect(ridgeAndEaves([{ role: 'RIDGE', value: 5.54 }, { role: 'RIDGE', value: 6.1 }])).toEqual({})
    // the same value twice is one statement, not a dispute
    expect(ridgeAndEaves([{ role: 'RIDGE', value: 5.54 }, { role: 'RIDGE', value: 5.54 }])).toEqual({ ridge: 5.54 })
  })
})

describe('v3.54.15 counter-trial: another palette with the same form', () => {
  const rect = (x0: number, y0: number, x1: number, y1: number): Array<[number, number]> => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
  const answer = (cls: string) => ({ groundRow: 500, silhouette: [[100, 500], [600, 500], [600, 350], [350, 225], [100, 350]], roofs: [{ polygon: [[90, 355], [350, 225], [610, 355]] }], walls: [{ class: cls, polygon: rect(100, 350, 600, 500), host: 'main', visibility: 'VISIBLE' }], openings: [{ kind: 'WINDOW', polygon: rect(150, 400, 200, 460), host: 'main' }, { kind: 'DOOR', polygon: rect(420, 395, 465, 500), host: 'main' }], elements: [] })
  const fake = (input: unknown): ConsultantModel => ({ id: 'fake', model: 'fake', maxOutputTokens: 1000, send: async (): Promise<ModelTurn> => ({ content: [{ type: 'tool_use', id: 't', name: 'report_elevation', input } as never], usage: { inputTokens: 900, outputTokens: 400 }, model: 'fake', latencyMs: 1 }) })
  const read = async (input: unknown): Promise<ElevationSketch> => (await readElevationSketch({ model: fake(input), price: { inputUsdPerMTok: 2, outputUsdPerMTok: 10 } }, { frameId: 'E', raster: { width: 700, height: 560, data: new Uint8ClampedArray(700 * 560 * 4).fill(255) }, caption: 'elewacja' })).sketch as ElevationSketch
  const facts = { alongSign: 1 as const, alongMin: 0, alongMax: 10, ridge: 5.5, eaves: 2.9, local: { mpp: 0.02, alongAtPx0: -2, zeroRow: 500 }, openings: [{ id: 'w1', a0: 1, a1: 2, b0: 2, b1: 3.2 }, { id: 'd1', a0: 6.4, a1: 7.3, b0: 0, b1: 2.1 }] }
  it('the form verdict and the registration do not move; only the finish class the appearance carries does', async () => {
    const light = await read(answer('LIGHT_RENDER'))
    const timber = await read(answer('TIMBER'))
    const a = checkProportions(light, facts)
    const b = checkProportions(timber, facts)
    expect(b.verdict).toBe(a.verdict)
    expect(b.properties).toEqual(a.properties)
    expect(b.projection).toEqual(a.projection)
    const classes = (s: ElevationSketch) => JSON.stringify(sketchToAppearance(s, 'FRONT', 'h'.repeat(64))).match(/"class":"[A-Z_]+"/g)
    expect(classes(light)).not.toEqual(classes(timber))
  })
})

describe('v3.54.15 counter-trial: another unit system (feet and inches)', () => {
  it('a literal with its own foot and inch marks is parsed by them, whatever unit the answer named; a malformed one is not', async () => {
    const { feetInches, valueOfLiteral } = await import('../src/consult/metric-read.js')
    expect(feetInches(`45'-6"`)).toBeCloseTo(13.8684, 6)
    expect(feetInches(`10' 0"`)).toBeCloseTo(3.048, 6)
    expect(feetInches(`3'-4 1/2"`)).toBeCloseTo(1.0287, 6)
    expect(feetInches(`12'`)).toBeCloseTo(3.6576, 6)
    expect(valueOfLiteral(`45'-6"`, 'none', 'LENGTH')).toBeCloseTo(13.8684, 6)
    expect(valueOfLiteral(`45'-6"`, 'cm', 'LENGTH')).toBeCloseTo(13.8684, 6)
    // inches of 12 or more are not feet-inches; a cm label stays cm; an ft-in claim without marks has no value
    expect(feetInches(`10'-14"`)).toBeUndefined()
    expect(valueOfLiteral('1365', 'cm', 'LENGTH')).toBeCloseTo(13.65, 6)
    expect(valueOfLiteral('1365', 'ft-in', 'LENGTH')).toBeUndefined()
  })
})
