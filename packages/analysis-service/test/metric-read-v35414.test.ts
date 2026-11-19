/**
 * v3.54.14 R2 — the metric consultant, boundary by boundary: what the independent read sends and how its answer becomes
 * canonical observations; what the resolver hands the analyzer and with which witness; when the candidate stands.
 * The counter-trials of the brief: answers in another order, the same reading twice, a wrong unit, a label that is its
 * own scale's only anchor, an estimate instead of a print.
 */
import { describe, expect, it } from 'vitest'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import { DIMENSION_OBSERVATION_VERSION, readDimensions, resolveMetric, valueOfLiteral } from '../src/consult/metric-read.js'
import type { IndependentRead, LocalCheck, LocalItem } from '../src/consult/metric-read.js'
import { compareMetricRead } from '../src/consult/consult-analysis.js'
import type { ConsultantModel, ModelTurn } from '../src/consult/loop.js'

const raster = (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(255) })
const fake = (items: unknown[], sent: unknown[] = []): ConsultantModel => ({
  id: 'fake',
  model: 'fake-model',
  maxOutputTokens: 1000,
  send: async (req): Promise<ModelTurn> => {
    sent.push(req)
    return { content: [{ type: 'tool_use', id: 't1', name: 'report_dimensions', input: { items } } as never], usage: { inputTokens: 1000, outputTokens: 500 }, model: 'fake-model', latencyMs: 1 }
  },
})
const item = (literal: string, unit: string, value: number | null, box: [number, number, number, number], extra: Record<string, unknown> = {}) => ({ kind: 'LENGTH', literal, unit, value, labelBox: box, ends: { from: [box[0] - 50, box[3] + 5], to: [box[2] + 50, box[3] + 5] }, storey: 'GROUND', axis: 'HORIZONTAL', scope: 'SEGMENT', reference: 'OUTER_FACE', status: 'PRINTED', ...extra })
const price = { inputUsdPerMTok: 4, outputUsdPerMTok: 20 }
const frame = { frameId: 'F', kind: 'PLAN' as const, storey: 'GROUND' as const, raster: raster(2000, 1000), caption: 'rzut parteru' }

describe('v3.54.14 metric consultant — the independent read', () => {
  it('sends the frame downscaled by a whole factor and nothing of the analyzer; positions come back in frame pixels', async () => {
    const sent: unknown[] = []
    const [r] = await readDimensions({ model: fake([item('1365', 'cm', 13.65, [100, 50, 140, 60])], sent), price }, [frame])
    expect(r.observations).toHaveLength(1)
    const o = r.observations[0]
    expect(o.schemaVersion).toBe(DIMENSION_OBSERVATION_VERSION)
    expect(o.image.scale).toBe(2)
    expect(o.labelBox).toEqual([200, 100, 280, 120])
    expect(o.ends?.from).toEqual([100, 130])
    expect(o.value).toBeCloseTo(13.65, 6)
    expect(JSON.stringify(sent)).not.toMatch(/analyzer read|LOCAL|status ACCEPTED/)
    expect(r.usd).toBeCloseTo((1000 * 4 + 500 * 20) / 1e6, 9)
  })

  it('keeps the printed literal\'s value when the answer\'s number disagrees with it, and says so', async () => {
    const [r] = await readDimensions({ model: fake([item('1365', 'cm', 1.365, [100, 50, 140, 60])]), price }, [frame])
    expect(r.observations[0].value).toBeCloseTo(13.65, 6)
    expect(r.refused.join(' ')).toMatch(/not the printed literal's/)
  })

  it('stable ids: the same answer in another order gives the same observations', async () => {
    const a = [item('300', 'cm', 3, [100, 50, 130, 60]), item('610', 'cm', 6.1, [400, 50, 430, 60]), item('300', 'cm', 3, [700, 50, 730, 60])]
    const [x] = await readDimensions({ model: fake(a), price }, [frame])
    const [y] = await readDimensions({ model: fake([...a].reverse()), price }, [frame])
    expect(y.observations).toEqual(x.observations)
    expect(new Set(x.observations.map((o) => o.id)).size).toBe(3)
  })

  it('an illegible text has no value; a box outside the picture is refused', async () => {
    const [r] = await readDimensions({ model: fake([item('3?5', 'cm', null, [100, 50, 130, 60], { status: 'UNKNOWN' }), item('500', 'cm', 5, [1500, 50, 1530, 60])]), price }, [frame])
    expect(r.observations.map((o) => o.value)).toEqual([null])
    expect(r.refused.join(' ')).toMatch(/not inside the picture/)
  })

  it('reads literals by their printed form and unit', () => {
    expect(valueOfLiteral('1365', 'cm', 'LENGTH')).toBeCloseTo(13.65, 6)
    expect(valueOfLiteral('4,50', 'm', 'LENGTH')).toBeCloseTo(4.5, 6)
    expect(valueOfLiteral('+5,54', 'm', 'LEVEL')).toBeCloseTo(5.54, 6)
    expect(valueOfLiteral('−0,30', 'm', 'LEVEL')).toBeCloseTo(-0.3, 6)
    expect(valueOfLiteral('28°', 'deg', 'ANGLE')).toBe(28)
    expect(valueOfLiteral('ok', 'cm', 'LENGTH')).toBeUndefined()
  })
})

// ---- resolver -----------------------------------------------------------------------------------------------------
const obs = (literal: string, valueM: number | null, box: [number, number, number, number], extra: Record<string, unknown> = {}) => ({ schema: 'buildapp.dimension-observation' as const, schemaVersion: '1.0.0' as const, id: `o-${literal}-${box[0]}`, frameId: 'F', image: { sha256: 'a'.repeat(64), width: 1000, height: 1000, scale: 1 }, kind: 'LENGTH' as const, literal, unit: 'cm' as const, value: valueM, labelBox: box, storey: 'GROUND' as const, axis: 'HORIZONTAL' as const, scope: 'SEGMENT' as const, reference: 'OUTER_FACE' as const, status: 'PRINTED' as const, ...extra })
const read = (o: ReturnType<typeof obs>[]): IndependentRead[] => [{ frameId: 'F', raw: null, observations: o as never, refused: [], usd: 0, model: 'm', promptVersion: 'p' }]
const L = (itemId: string, literal: string, valueCm: number | undefined, x0: number, from: number, to: number, chainId: string, extra: Partial<LocalItem> = {}): LocalItem => ({ itemId, frameId: 'F', dimensionId: `dim-${itemId}`, latticeId: `lat-${itemId}`, literal, ...(valueCm !== undefined ? { valueCm } : {}), status: 'ACCEPTED', axis: 'X', fromPx: from, toPx: to, atPx: 100, box: { x0, y0: 90, x1: x0 + 30, y1: 100 }, chainId, ...extra })
// a chain 300 | 455 | 610 under an overall 1365 (another chain, the same extent): the analyzer misread 455 as 445
const table = [L('L1', '300', 300, 50, 0, 150, 'c1'), L('L2', '445', 445, 260, 150, 377.5, 'c1'), L('L3', '610', 610, 500, 377.5, 682.5, 'c1'), L('L4', '1365', 1365, 330, 0, 682.5, 'c0')]
const apiChain = [obs('300', 3, [50, 90, 80, 100]), obs('455', 4.55, [261, 90, 291, 100]), obs('610', 6.1, [500, 90, 530, 100]), obs('1365', 13.65, [330, 90, 360, 100], { scope: 'WHOLE_HOUSE' })]
const metrics = (extra: Partial<Record<string, unknown>> = {}) => ({ metricSolutions: [], coordinateRegistrations: [], ...extra }) as unknown as MetricEvidenceSet
const consultant = { engine: 'metric-consultant.fake', model: 'fake' }

describe('v3.54.14 metric consultant — the resolver', () => {
  it('a different reading is handed with a CHAIN witness: the chain closes on its overall with the API value only', () => {
    const r = resolveMetric({ metrics: metrics(), table, reads: read(apiChain), checks: [], consultant })
    const d = r.decisions.find((x) => x.itemId === 'L2')
    expect(d?.decision).toBe('CORRECTED')
    expect(d?.witness).toBe('CHAIN')
    expect(r.readings).toEqual([{ proposalId: 'mr:o-455-261', frameId: 'F', latticeId: 'lat-L2', literal: '455', consultant }])
    expect(r.decisions.filter((x) => x.decision === 'AGREES').map((x) => x.itemId)).toEqual(['L1', 'L3', 'L4'])
  })

  it('the same reading again from the check is not a witness: without chain or scale it stays UNRESOLVED', () => {
    const noParent = table.filter((t) => t.itemId !== 'L4')
    const checks: LocalCheck[] = [{ frameId: 'F', raw: null, verdicts: [{ itemId: 'L2', verdict: 'DISAGREES', sourceLiteral: '455', why: 'the label under the bedroom reads 455', proposal: { literal: '455', scope: 'SEGMENT' } }], refused: [], usd: 0, promptVersion: 'v' }]
    const r = resolveMetric({ metrics: metrics(), table: noParent, reads: read(apiChain.slice(0, 3)), checks, consultant })
    const d = r.decisions.find((x) => x.itemId === 'L2')
    expect(d?.decision).toBe('UNRESOLVED')
    expect(d?.why).toMatch(/same reader twice is not a second witness/)
    expect(r.readings).toEqual([])
  })

  it('a SCALE witness from other labels corrects; a label that is its scale\'s only anchor does not test itself', () => {
    // a misreading the scale can tell apart (405 against 455 on a 227.5 px line at 2 cm/px); 445 against 455 it could
    // not (both within 3 %): that case is UNRESOLVED, below
    const solo = [L('L2', '405', 405, 260, 150, 377.5, 'c9')]
    const sol = { metricSolutions: [{ frameId: 'F', cmPerPixelX: 2, cmPerPixelY: 2, confidence: 'SUPPORTED' }] }
    const ok = resolveMetric({ metrics: metrics({ ...sol, coordinateRegistrations: [{ anchors: [{ evidenceIds: ['metric-dimension-other-1'] }, { evidenceIds: ['metric-dimension-other-2'] }] }] }), table: solo, reads: read([apiChain[1]]), checks: [], consultant })
    expect(ok.decisions[0].decision).toBe('CORRECTED')
    expect(ok.decisions[0].witness).toBe('SCALE')
    const self = resolveMetric({ metrics: metrics({ ...sol, coordinateRegistrations: [{ anchors: [{ evidenceIds: ['metric-dimension-dim-L2'] }] }] }), table: solo, reads: read([apiChain[1]]), checks: [], consultant })
    expect(self.decisions[0].decision).toBe('UNRESOLVED')
    const close = resolveMetric({ metrics: metrics({ ...sol, coordinateRegistrations: [{ anchors: [{ evidenceIds: ['a'] }, { evidenceIds: ['b'] }] }] }), table: [table[1]], reads: read([apiChain[1]]), checks: [], consultant })
    expect(close.decisions[0].decision).toBe('UNRESOLVED')
    expect(close.decisions[0].why).toMatch(/both readings fit/)
  })

  it('a wrong unit (13,65 read as centimetres) finds no witness and changes nothing', () => {
    const r = resolveMetric({ metrics: metrics({ metricSolutions: [{ frameId: 'F', cmPerPixelX: 2, cmPerPixelY: 2, confidence: 'SUPPORTED' }] }), table: [table[3]], reads: read([obs('13,65', 0.14, [330, 90, 360, 100])]), checks: [], consultant })
    expect(r.decisions[0].decision).toBe('UNRESOLVED')
    expect(r.readings).toEqual([])
  })

  it('an ESTIMATED value is never handed; a printed whole dimension with no label becomes a span the metric layer judges', () => {
    const est = resolveMetric({ metrics: metrics(), table: [table[1]], reads: read([obs('455', 4.55, [261, 90, 291, 100], { status: 'ESTIMATED' })]), checks: [], consultant })
    expect(est.decisions[0].decision).toBe('RETAINED')
    const span = resolveMetric({ metrics: metrics(), table: [], reads: read([obs('815', 8.15, [900, 300, 920, 330], { scope: 'WHOLE_HOUSE', axis: 'VERTICAL', ends: { from: [910, 100], to: [910, 600] } })]), checks: [], consultant })
    expect(span.spans).toEqual([{ proposalId: 'ms:o-815-900', frameId: 'F', literal: '815', unit: 'cm', from: { x: 910, y: 100 }, to: { x: 910, y: 600 }, consultant }])
    expect(span.decisions[0].decision).toBe('NEW_SPAN')
  })

  it('the API answers in another order: the same decisions', () => {
    const a = resolveMetric({ metrics: metrics(), table, reads: read(apiChain), checks: [], consultant })
    const b = resolveMetric({ metrics: metrics(), table, reads: read([...apiChain].reverse()), checks: [], consultant })
    expect(b).toEqual(a)
  })
})

describe('v3.54.14 metric consultant — the candidate', () => {
  const state = (modelHash: string, confidence: string, k = 2) => ({ outcome: 'COMPLETED', modelHash, metric: { confidence, cmPerPixelX: k, cmPerPixelY: k } }) as never
  it('a changed model stands only when the metric layer applied a handed reading, at a scale no less settled and not moved', () => {
    expect(compareMetricRead(state('a', 'SUPPORTED'), state('b', 'SUPPORTED'), 0).decision).toBe('ROLLBACK')
    expect(compareMetricRead(state('a', 'SUPPORTED'), state('b', 'SUPPORTED'), 1).decision).toBe('ACCEPT')
    expect(compareMetricRead(state('a', 'SUPPORTED'), state('b', 'WEAK'), 1).decision).toBe('ROLLBACK')
    expect(compareMetricRead(state('a', 'SUPPORTED', 2), state('b', 'SUPPORTED', 2.2), 1).decision).toBe('ROLLBACK')
    expect(compareMetricRead(state('a', 'SUPPORTED'), state('a', 'SUPPORTED'), 1).decision).toBe('NO_CHANGE')
  })
})
