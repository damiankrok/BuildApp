import { describe, expect, it } from 'vitest'
import { ConsultantUnavailable, compareRuns, consultLabels, validateProposals } from '../src/index.js'
import type { ConsultEvent, ConsultantModel, LabelProblem, ModelTurn, ProposedCorrection, RunState } from '../src/index.js'

// v3.54.2 pilot counter-trials (SYNTHETIC: the proposals and the model below are written for the test, not recorded).
const problem: LabelProblem = {
  problemId: 'scale:f1',
  kind: 'SCALE_UNSETTLED',
  frameId: 'f1',
  assetId: 'a1',
  analyzerWhy: 'test',
  labels: [
    { labelId: 'L1', frameId: 'f1', box: { x0: 10, y0: 10, x1: 30, y1: 20 }, lattices: [{ latticeId: 'lat-h', orientation: 'HORIZONTAL', asRead: '640', ocrClass: 'AMBIGUOUS' }, { latticeId: 'lat-i', orientation: 'INVERTED', asRead: '064', ocrClass: 'AMBIGUOUS' }], why: 't' },
    { labelId: 'L2', frameId: 'f1', box: { x0: 0, y0: 40, x1: 10, y1: 80 }, lattices: [{ latticeId: 'lat-v', orientation: 'ROTATED_CW', asRead: '1150', ocrClass: 'AMBIGUOUS' }], why: 't' },
  ],
}
const P = (over: Partial<ProposedCorrection> & { literal?: string }): ProposedCorrection => ({
  proposalId: over.proposalId ?? 'p1',
  baseRevision: over.baseRevision ?? 'rev',
  operation: over.operation ?? 'READ_LABEL',
  targetId: over.targetId ?? 'L1',
  proposed: over.proposed ?? { literal: over.literal ?? '690', unit: 'cm', direction: 'LEFT_TO_RIGHT' },
  evidence: over.evidence ?? [{ sourceId: 'picture 2' }],
  justification: 'test',
  alternatives: [],
  uncertainty: over.uncertainty ?? 'LOW',
  expectedEffect: 'test',
})
const consultant = { engine: 'test', model: 'test' }

describe('v3.54.2 validator counter-trials', () => {
  it('accepts a valid reading and binds it to the lattice read the stated way up', () => {
    const { readings, verdicts } = validateProposals(problem, 'rev', [P({})], new Set(), consultant)
    expect(verdicts[0].status).toBe('ACCEPTED')
    expect(readings).toEqual([{ proposalId: 'p1', frameId: 'f1', latticeId: 'lat-h', literal: '690', consultant }])
  })
  it('refuses or holds every bad proposal with its reason', () => {
    const cases: Array<[ProposedCorrection, string]> = [
      [P({ proposalId: 'a', baseRevision: 'old' }), 'STALE_REVISION'],
      [P({ proposalId: 'b', targetId: 'L9' }), 'UNKNOWN_TARGET'],
      [P({ proposalId: 'c', proposed: { literal: '6,90', unit: 'cm', direction: 'LEFT_TO_RIGHT' } }), 'UNIT_MISMATCH'],
      [P({ proposalId: 'd', proposed: { literal: '690', unit: 'm', direction: 'LEFT_TO_RIGHT' } }), 'UNIT_MISMATCH'],
      [P({ proposalId: 'e', proposed: { literal: 'six hundred', unit: 'cm', direction: 'LEFT_TO_RIGHT' } }), 'UNPARSEABLE'],
      [P({ proposalId: 'f', evidence: [{ sourceId: 'https://example.com/other.png' }] }), 'FOREIGN_EVIDENCE'],
      [P({ proposalId: 'g', proposed: { literal: '690', unit: 'cm', direction: 'TOP_TO_BOTTOM' } }), 'NO_READING_THAT_WAY'],
      [P({ proposalId: 'h', targetId: 'L1', proposed: { literal: '690', unit: 'cm' } }), 'NO_DIRECTION'],
    ]
    for (const [p, why] of cases) {
      const { readings, verdicts } = validateProposals(problem, 'rev', [p], new Set(), consultant)
      expect(readings).toEqual([])
      expect(verdicts[0].status).toBe('REJECTED')
      expect(verdicts[0].why.startsWith(why)).toBe(true)
    }
  })
  it('a repeated proposalId is refused; a second reading of one label in one answer is refused', () => {
    const seen = new Set<string>(['p1'])
    expect(validateProposals(problem, 'rev', [P({})], seen, consultant).verdicts[0].why.startsWith('DUPLICATE_PROPOSAL_ID')).toBe(true)
    const two = validateProposals(problem, 'rev', [P({ proposalId: 'x' }), P({ proposalId: 'y', literal: '691' })], new Set(), consultant)
    expect(two.verdicts.map((v) => v.status)).toEqual(['ACCEPTED', 'REJECTED'])
  })
  it('a feet-inch reading and an unknown operation are CAPABILITY_MISSING; a HIGH-uncertainty reading is HELD', () => {
    const r = validateProposals(problem, 'rev', [P({ proposalId: 'ft', proposed: { literal: "47'-1\"", unit: 'ft-in', direction: 'LEFT_TO_RIGHT' } }), P({ proposalId: 'op', operation: 'ASSIGN_VIEW' }), P({ proposalId: 'hi', targetId: 'L2', uncertainty: 'HIGH', proposed: { literal: '1350', unit: 'cm', direction: 'BOTTOM_TO_TOP' } })], new Set(), consultant)
    expect(r.verdicts.map((v) => v.status)).toEqual(['CAPABILITY_MISSING', 'CAPABILITY_MISSING', 'HELD'])
    expect(r.readings).toEqual([])
  })
})

describe('v3.54.2 transaction rules (compareRuns)', () => {
  const failed = (confidence: string): RunState => ({ outcome: 'FAILED', code: 'RECONSTRUCTION_FAILED', reasonCode: 'X', metric: { relation: 'R', confidence } })
  const model = (confidence: string, hash: string, x = 2): RunState => ({ outcome: 'COMPLETED', modelHash: hash, metric: { relation: 'R', confidence, cmPerPixelX: x } })
  it('refusal to a model on a settled scale is ACCEPT; on an unsettled one ROLLBACK', () => {
    expect(compareRuns(failed('INCONCLUSIVE'), model('STRONG', 'a')).decision).toBe('ACCEPT')
    expect(compareRuns(failed('INCONCLUSIVE'), model('INCONCLUSIVE', 'a')).decision).toBe('ROLLBACK')
  })
  it('a model that becomes a refusal is ROLLBACK (a wrong proposal never damages the last good result)', () => {
    expect(compareRuns(model('STRONG', 'a'), failed('INCONCLUSIVE')).decision).toBe('ROLLBACK')
  })
  it('a settled scale that a consulted reading moves by more than 3 % is ROLLBACK; the same model is NO_CHANGE', () => {
    expect(compareRuns(model('STRONG', 'a', 2), model('STRONG', 'b', 2.2)).decision).toBe('ROLLBACK')
    expect(compareRuns(model('STRONG', 'a'), model('STRONG', 'a')).decision).toBe('NO_CHANGE')
  })
  it('an unsettled model whose scale becomes settled is ACCEPT; still refused but settled is PARTIAL', () => {
    expect(compareRuns(model('INCONCLUSIVE', 'a', 7), model('SUPPORTED', 'b', 5)).decision).toBe('ACCEPT')
    expect(compareRuns(failed('INCONCLUSIVE'), failed('STRONG')).decision).toBe('PARTIAL')
  })
})

describe('v3.54.2 transport counter-trials (consultLabels with a scripted model)', () => {
  const raster = { width: 100, height: 100, data: new Uint8ClampedArray(100 * 100 * 4).fill(255) }
  const metrics = { numericLattices: [], dimensionObservations: [], metricSolutions: [] } as never
  const review = (id: string): ModelTurn => ({ content: [{ type: 'tool_use', id, name: 'submit_review', input: { status: 'ISSUE_FOUND', observations: [], requestedEvidence: [], proposedCorrections: [P({ proposalId: id })], checked: ['L1'], notChecked: [] } }], usage: { inputTokens: 1000, outputTokens: 100 }, model: 'm', latencyMs: 1 })
  const scripted = (steps: Array<ModelTurn | Error>): ConsultantModel => {
    let i = 0
    return { id: 'script', model: 'm', maxOutputTokens: 1000, send: async () => { const s = steps[i++]; if (s instanceof Error) throw s; if (!s) throw new Error('exhausted'); return s } }
  }
  const run = (model: ConsultantModel, events: ConsultEvent[], spendLog: string[] = []) =>
    consultLabels({ problem, metrics, raster, baseRevision: 'rev', model, price: { inputUsdPerMTok: 2, outputUsdPerMTok: 10 }, record: (e) => events.push(e), spend: { reserve: (_m, usd) => (spendLog.push(`R ${usd}`), { id: String(spendLog.length), usd }), settle: (_r, a) => void spendLog.push(a === 'NOT_SENT' ? 'NOT_SENT' : `S ${a.usd}`) } })
  it('one transport failure is retried once; the reservation of the failed attempt stands', async () => {
    const events: ConsultEvent[] = []
    const spend: string[] = []
    const out = await run(scripted([new ConsultantUnavailable('TRANSPORT', 'reset'), review('s1'), review('s2')]), events, spend)
    expect(out.final?.review?.proposedCorrections[0].proposalId).toBe('s2')
    expect(events.filter((e) => e.kind === 'TRANSPORT_ERROR')).toHaveLength(1)
    // reserve (failed, kept), reserve + settle, reserve + settle
    expect(spend.filter((s) => s.startsWith('R'))).toHaveLength(3)
    expect(spend.filter((s) => s.startsWith('S'))).toHaveLength(2)
  })
  it('two transport failures in a row (no network) throw: the caller keeps the LOCAL result', async () => {
    await expect(run(scripted([new ConsultantUnavailable('TIMEOUT', 'timeout'), new ConsultantUnavailable('TRANSPORT', 'down')]), [])).rejects.toThrow()
  })
  it('a refused request (no key, bad request) is released, not retried', async () => {
    const spend: string[] = []
    await expect(run(scripted([new ConsultantUnavailable('NO_CREDENTIALS', 'no key')]), [], spend)).rejects.toThrow()
    expect(spend).toEqual([expect.stringMatching(/^R /), 'NOT_SENT'])
  })
  it('a model that never calls the answer tool ends the step as refused, without inventing a review', async () => {
    const silent: ModelTurn = { content: [{ type: 'text', text: 'I think it is fine.' }], usage: { inputTokens: 10, outputTokens: 5 }, model: 'm', latencyMs: 1, stopReason: 'end_turn' }
    const out = await run(scripted([silent, silent]), [])
    expect(out.literal.review).toBeUndefined()
    expect(out.literal.refused).toMatch(/no submit_review/)
  })
})
