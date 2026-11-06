/**
 * E13 (contract v3.42): the review loop with invented steps — no provider, no file, no compiler. Each case is one way an
 * answer or a change can be wrong, and what the loop must do about it.
 */
import { describe, expect, it } from 'vitest'
import { AI_LOOP_CONTRACT_VERSION, aiAnswerJsonSchema, parseAiAnswer, runReviewLoop, AiAnswerSchema, LoopObservationKindSchema } from '../src/index.js'
import type { AiAnswer, AnalyzerProblem, LoopSteps, RevisionProposal } from '../src/index.js'

const problem: AnalyzerProblem = {
  contractVersion: AI_LOOP_CONTRACT_VERSION,
  problemId: 'p1',
  runId: 'run',
  modelRevision: 'rev-1',
  modelHash: 'rev-1',
  code: 'UNCHECKED',
  task: 'READ_TEXT',
  subject: { kind: 'SECTION_LEVEL_MARKS', frameId: 'f' },
  question: 'read the level marks',
  facts: [],
  sources: [{ assetId: 'a', byteHash: 'b'.repeat(64), frameId: 'f', widthPx: 400, heightPx: 300, document: 'SECTION', projection: 'ORTHOGRAPHIC_SECTION', side: 'UNKNOWN', storey: 'UNKNOWN', cropRectPx: { x0: 0, y0: 0, x1: 400, y1: 300 }, transform: { scale: 1, offsetPx: { x: 0, y: 0 } } }],
  allowedOps: ['ADD_SOURCE_READINGS'],
  limits: { maxObservations: 8, maxRounds: 2, maxUsd: 0.5 },
}
const obs = (text: string, conf = 0.95) => ({ sourceIndex: 0, kind: 'LEVEL_MARK' as const, textAsPrinted: text, regionNorm: { x0: 0.4, y0: 0.1, x1: 0.5, y1: 0.15 }, locationUncertaintyNorm: 0.01, classConfidence: conf, legible: true, premise: 'a label over a triangle' })
const answer = (texts: string[], conf = 0.95): AiAnswer => ({ status: 'ANSWERED', observations: texts.map((t) => obs(t, conf)) })
const proposalOf = (base = 'rev-1', op: RevisionProposal['op'] = 'ADD_SOURCE_READINGS'): RevisionProposal => ({ contractVersion: AI_LOOP_CONTRACT_VERSION, proposalId: 'pr', problemId: 'p1', baseRevision: base, op, target: 'f', premises: [0], expectedEffect: 'the section registers', checks: ['ladder'] })
const call = (model: string) => ({ model, sessionId: 's', estimatedCostUsd: 0.001, status: 'OK' })

function steps(over: Partial<LoopSteps<string>> & { answers?: unknown[] }): LoopSteps<string> & { built: number } {
  const answers = over.answers ?? [answer(['+8,55'])]
  const s = {
    built: 0,
    ask: async (_p: AnalyzerProblem, round: number) => (round < answers.length ? { raw: answers[round], call: call(round === 0 ? 'cheap' : 'strong') } : { unavailable: 'no further model' }),
    // the deterministic check: only "+8,55" fits the drawing
    validate: (a: AiAnswer) => {
      const ok = a.observations.map((o, i) => ({ i, ok: o.textAsPrinted === '+8,55' }))
      return { usable: ok.filter((x) => x.ok).map((x) => x.i), checks: ok.map((x) => ({ name: `reading ${x.i}`, passed: x.ok, detail: '' })), enough: ok.some((x) => x.ok), why: ok.some((x) => x.ok) ? 'fits' : 'off the ladder' }
    },
    propose: () => proposalOf(),
    buildVariant: async () => {
      s.built += 1
      return 'variant'
    },
    compare: () => ({ revision: 'rev-2', changedElements: ['roof-main'], errorsAfter: {}, sourceChecks: [{ name: 'ridge against the print', passed: true, detail: '8.55' }], regressions: [] }),
    ...over,
  }
  return s as LoopSteps<string> & { built: number }
}

describe('runReviewLoop', () => {
  it('a validated answer, an admissible proposal, no regression and a source check passed: accepted, the variant returned', async () => {
    const s = steps({})
    const r = await runReviewLoop(problem, { revision: 'rev-1', errors: { E: 1 } }, s)
    expect(r.decision.outcome).toBe('ACCEPTED')
    expect(r.variant).toBe('variant')
    expect(r.decision.newRevision).toBe('rev-2')
    expect(r.decision.calls.map((c) => c.model)).toEqual(['cheap'])
  })
  // E13 (Azalie, Goździkowce: the readings registered the section, and elevations the levels unlocked then placed openings)
  it('a passing variant that also changes what nothing checked is not applied: deferred, the changes named', async () => {
    const s = steps({ compare: () => ({ revision: 'rev-2', changedElements: ['roof-main', 'opening-0-front-0-1'], errorsAfter: {}, sourceChecks: [{ name: 'ridge against the print', passed: true, detail: '8.55' }], regressions: [], unverified: ['opening-0-front-0-1: sill 0.80 -> 0.27 (read on an elevation the levels registered)'] }) })
    const r = await runReviewLoop(problem, { revision: 'rev-1', errors: {} }, s)
    expect(r.decision.outcome).toBe('DEFERRED')
    expect(r.variant).toBeUndefined()
    expect(r.decision.why).toMatch(/nothing checked: opening-0-front-0-1/)
    expect(r.decision.newRevision).toBe('rev-2')
  })
  it('a confident wrong answer fails the deterministic check: the stronger model is asked, and with no better answer the question is deferred', async () => {
    const s = steps({ answers: [answer(['+8,85'], 0.99), answer(['+8,85'], 0.99)] })
    const r = await runReviewLoop(problem, { revision: 'rev-1', errors: {} }, s)
    expect(r.decision.outcome).toBe('DEFERRED')
    expect(r.decision.calls.map((c) => c.model)).toEqual(['cheap', 'strong'])
    expect(s.built).toBe(0)
    expect(r.variant).toBeUndefined()
  })
  it('the cheap model wrong, the strong one right: accepted on the second round', async () => {
    const r = await runReviewLoop(problem, { revision: 'rev-1', errors: {} }, steps({ answers: [answer(['+8,85'], 0.99), answer(['+8,55'])] }))
    expect(r.decision.outcome).toBe('ACCEPTED')
    expect(r.decision.rounds).toBe(2)
  })
  it('a proposal on a stale base revision, or for an operation the problem does not allow, is rejected before anything is built', async () => {
    for (const p of [proposalOf('rev-0'), proposalOf('rev-1', 'SET_ROOF_AXIS')]) {
      const s = steps({ propose: () => p })
      const r = await runReviewLoop(problem, { revision: 'rev-1', errors: {} }, s)
      expect(r.decision.outcome).toBe('REJECTED')
      expect(s.built).toBe(0)
    }
  })
  it('a variant that loses an element, adds compile errors or fails a source check is rolled back', async () => {
    const cases: Array<Partial<ReturnType<LoopSteps<string>['compare']>>> = [{ regressions: ['LOST opening front lvl-0 at 3.1'] }, { errorsAfter: { OPENING_ABOVE_WALL_TOP: 2 } }, { sourceChecks: [{ name: 'ridge against the print', passed: false, detail: '' }] }, { sourceChecks: [] }]
    for (const c of cases) {
      const s = steps({ compare: () => ({ revision: 'rev-2', changedElements: [], errorsAfter: {}, sourceChecks: [{ name: 'x', passed: true, detail: '' }], regressions: [], ...c }) })
      const r = await runReviewLoop(problem, { revision: 'rev-1', errors: { OPENING_ABOVE_WALL_TOP: 1 } }, s)
      expect(r.decision.outcome).toBe('REJECTED')
      expect(r.variant).toBeUndefined()
      expect(r.decision.why).toMatch(/rolled back/)
    }
  })
  it('a malformed answer, one about a source it was not shown, or UNKNOWN: refused, and the loop moves on or defers', async () => {
    const bad = [{ status: 'ANSWERED', observations: [{ ...obs('+8,55'), regionNorm: { x0: 0.5, y0: 0.1, x1: 0.4, y1: 0.2 } }] }, { status: 'ANSWERED', observations: [{ ...obs('+8,55'), sourceIndex: 3 }] }]
    for (const b of bad) {
      const r = await runReviewLoop(problem, { revision: 'rev-1', errors: {} }, steps({ answers: [b] }))
      expect(r.decision.outcome).toBe('DEFERRED')
    }
    const unknown = await runReviewLoop(problem, { revision: 'rev-1', errors: {} }, steps({ answers: [{ status: 'UNKNOWN', observations: [] }] }))
    expect(unknown.decision.outcome).toBe('DEFERRED')
    expect(unknown.decision.why).toMatch(/could not see it/)
  })
  it('no provider (no network, no budget): deferred, the analyzer\'s own model stands', async () => {
    const r = await runReviewLoop(problem, { revision: 'rev-1', errors: {} }, steps({ ask: async () => ({ unavailable: 'budget reached' }) }))
    expect(r.decision.outcome).toBe('DEFERRED')
    expect(r.decision.why).toMatch(/budget reached/)
  })
})

describe('the provider contract', () => {
  it('the JSON Schema is generated from the vocabularies: OTHER and UNKNOWN are answers', () => {
    const js = aiAnswerJsonSchema(8) as { properties: { observations: { items: { properties: { kind: { enum: string[] } } } } } }
    expect(js.properties.observations.items.properties.kind.enum).toEqual([...LoopObservationKindSchema.options])
    expect(js.properties.observations.items.properties.kind.enum).toEqual(expect.arrayContaining(['OTHER', 'UNKNOWN']))
  })
  it('NEED_MORE_EVIDENCE must say what; too many observations are refused', () => {
    expect(parseAiAnswer({ status: 'NEED_MORE_EVIDENCE', observations: [] }, problem).ok).toBe(false)
    expect(parseAiAnswer({ status: 'NEED_MORE_EVIDENCE', observations: [], needMore: { what: 'a wider crop', why: 'the label is cut' } }, problem).ok).toBe(true)
    expect(parseAiAnswer(answer(Array.from({ length: 9 }, () => '+1,00')), problem).ok).toBe(false)
    expect(AiAnswerSchema.safeParse({ status: 'ANSWERED', observations: [obs('+8,55')], extra: 1 }).success).toBe(false)
  })
})
