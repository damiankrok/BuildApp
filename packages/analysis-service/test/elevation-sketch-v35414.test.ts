/**
 * v3.54.14 R2 — the automatic coloured sketch: contours read in the original's pixels, drawn locally, checked for
 * proportions against what is not the sketch. Counter-trials: an anisotropic stretch, a moved ground line, an opening
 * moved inside a correct silhouette, a palette that changes nothing of the shape.
 */
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { checkProportions, readElevationSketch, renderSketch, renderSketchPng, sketchToAppearance, SKETCH_PALETTE } from '../src/appearance/elevation-sketch.js'
import type { ElevationSketch } from '../src/appearance/elevation-sketch.js'
import { parseAppearanceObservation } from '../src/appearance/contract.js'
import type { ConsultantModel, ModelTurn } from '../src/consult/loop.js'

const raster = (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(255) })
const rect = (x0: number, y0: number, x1: number, y1: number): Array<[number, number]> => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
// a 10 m × 3 m wall with a gable to 5.5 m, at 0.02 m/px: x 100..600 px, ground row 500
const answer = (dx = 0, sx = 1) => ({
  groundRow: 500,
  silhouette: [[100 * sx + dx, 500], [600 * sx + dx, 500], [600 * sx + dx, 350], [350 * sx + dx, 225], [100 * sx + dx, 350]],
  roofs: [{ polygon: [[90 * sx + dx, 355], [350 * sx + dx, 225], [610 * sx + dx, 355]] }],
  walls: [{ class: 'LIGHT_RENDER', polygon: rect(100 * sx + dx, 350, 600 * sx + dx, 500), host: 'main', visibility: 'VISIBLE' }, { class: 'BRICK', polygon: rect(350 * sx + dx, 350, 600 * sx + dx, 500), host: 'main', visibility: 'VISIBLE' }],
  openings: [{ kind: 'WINDOW', polygon: rect(150 * sx + dx, 400, 200 * sx + dx, 460), host: 'main' }, { kind: 'DOOR', polygon: rect(420 * sx + dx, 395, 465 * sx + dx, 500), host: 'main' }],
  elements: [],
})
const fake = (input: unknown): ConsultantModel => ({ id: 'fake', model: 'fake', maxOutputTokens: 1000, send: async (): Promise<ModelTurn> => ({ content: [{ type: 'tool_use', id: 't', name: 'report_elevation', input } as never], usage: { inputTokens: 900, outputTokens: 400 }, model: 'fake', latencyMs: 1 }) })
const price = { inputUsdPerMTok: 2, outputUsdPerMTok: 10 }
const frame = { frameId: 'E', raster: raster(700, 560), caption: 'elewacja frontowa' }
const expect0 = { alongSign: 1, alongMin: 0, alongMax: 10, ridge: 5.5, eaves: 2.9, local: { mpp: 0.02, alongAtPx0: -2, zeroRow: 500 }, openings: [{ id: 'w1', a0: 1, a1: 2, b0: 2, b1: 3.2 }, { id: 'd1', a0: 6.4, a1: 7.3, b0: 0, b1: 2.1 }] }
const read = async (input: unknown): Promise<ElevationSketch> => (await readElevationSketch({ model: fake(input), price }, frame)).sketch as ElevationSketch

describe('v3.54.14 the elevation sketch', () => {
  it('reads the contours in the frame\'s pixels with stable ids; the answer\'s order changes nothing', async () => {
    const a = await read(answer())
    const rev = answer()
    rev.walls.reverse()
    rev.openings.reverse()
    const b = await read(rev)
    expect(b.walls).toEqual(a.walls)
    expect(b.openings).toEqual(a.openings)
    expect(a.walls.map((w) => w.class).sort()).toEqual(['BRICK', 'LIGHT_RENDER'])
    expect(a.source).toMatchObject({ width: 700, height: 560, scale: 1 })
  })

  it('refuses a contour outside the picture rather than clipping it into shape', async () => {
    const bad = answer()
    bad.openings.push({ kind: 'WINDOW', polygon: rect(650, 400, 900, 460), host: 'main' })
    const s = await read(bad)
    expect(s.openings).toHaveLength(2)
    expect(s.refused.join(' ')).toMatch(/outside the picture/)
  })

  it('draws deterministically at the frame\'s size; a light finish stays distinct from the background by its outline', async () => {
    const s = await read(answer())
    const r = renderSketch(s)
    expect([r.width, r.height]).toEqual([700, 560])
    const h1 = createHash('sha256').update(renderSketchPng(s)).digest('hex')
    const h2 = createHash('sha256').update(renderSketchPng(s)).digest('hex')
    expect(h1).toBe(h2)
    const at = (x: number, y: number) => Array.from(r.data.slice(4 * (y * 700 + x), 4 * (y * 700 + x) + 3))
    expect(at(120, 380)).toEqual([...SKETCH_PALETTE.LIGHT_RENDER])
    expect(at(500, 380)).toEqual([...SKETCH_PALETTE.BRICK])
    expect(at(175, 430)).toEqual([...SKETCH_PALETTE.WINDOW])
    expect(at(100, 420)).toEqual([...SKETCH_PALETTE.outline])
    expect(at(50, 420)).toEqual([...SKETCH_PALETTE.background])
  })

  it('proportions: the true sketch is ACCEPTED with its own registration; an anisotropic stretch or a ground line off the terrain is REJECTED, not stretched back', async () => {
    const ok = checkProportions(await read(answer()), expect0)
    expect(ok.verdict).toBe('ACCEPTED')
    expect(ok.projection?.mpp).toBeCloseTo(0.02, 6)
    expect(ok.projection?.zeroRow).toBeCloseTo(500, 3)
    expect(ok.local.every((l) => Math.abs(l.residualPx) < 1)).toBe(true)
    const stretched = checkProportions(await read(answer(0, 1.08)), expect0)
    expect(stretched.verdict).toBe('REJECTED')
    expect(stretched.why).toMatch(/eaves line/)
    expect(stretched.projection).toBeUndefined()
    const ground = answer()
    ground.groundRow = 470
    expect(checkProportions(await read(ground), expect0).verdict).toBe('REJECTED')
    // a sketch shifted sideways is the same drawing: one scale, the same proportions (the solver's registration notes it)
    const shifted = checkProportions(await read(answer(12)), expect0)
    expect(shifted.verdict).toBe('ACCEPTED')
    expect(shifted.local.find((l) => l.anchor === 'left wall end')?.residualPx).toBeCloseTo(12, 3)
  })

  it('an opening moved inside a correct silhouette (same count, same box) decides the form: PARTIAL, finish only; one the model lacks is kept, named', async () => {
    const moved = answer()
    moved.openings[0].polygon = rect(170, 400, 220, 460)
    const c = checkProportions(await read(moved), expect0)
    // v3.54.15: the residual is not a dead metric — the form is refused, the finish still taken
    expect(c.verdict).toBe('PARTIAL')
    expect(c.properties).toMatchObject({ form: 'REJECTED', finish: 'ACCEPTED', vertical: 'VERIFIED' })
    const w = c.openings.find((o) => o.modelId === 'w1')
    expect(w?.status).toBe('OFF')
    expect(w?.centreResidualM).toBeCloseTo(0.4, 3)
    // the true one is ACCEPTED on the same facts
    expect(checkProportions(await read(answer()), expect0).verdict).toBe('ACCEPTED')
    const extra = answer()
    extra.openings.push({ kind: 'WINDOW', polygon: rect(520, 400, 560, 460), host: 'main' })
    const e = checkProportions(await read(extra), expect0)
    expect(e.openings.filter((o) => o.status === 'NOT_IN_MODEL')).toHaveLength(1)
  })

  it('v3.54.15: no ridge admitted — the finish by the sketch\'s own ground line (PARTIAL), never the form; a contradicted witness rejects all', async () => {
    const { ridge: _r, eaves: _e, ...noVertical } = expect0
    void _r
    void _e
    const p = checkProportions(await read(answer()), noVertical)
    expect(p.verdict).toBe('PARTIAL')
    expect(p.properties).toMatchObject({ vertical: 'UNVERIFIED', form: 'REJECTED', finish: 'ACCEPTED' })
    expect(p.projection?.zeroRow).toBe(500)
    expect(checkProportions(await read(answer(0, 1.08)), expect0).properties.finish).toBe('REJECTED')
  })

  it('its wall zones become an appearance observation of contract 1.1.0, brick included', async () => {
    const o = parseAppearanceObservation(sketchToAppearance(await read(answer()), 'FRONT', 'c'.repeat(64)))
    expect(o.schemaVersion).toBe('1.1.0')
    expect(o.regions.map((r) => r.class).sort()).toEqual(['BRICK', 'GLASS', 'GLASS', 'LIGHT_RENDER'])
    expect(o.toSource).toEqual([[1, 0, 0], [0, 1, 0]])
  })
})
