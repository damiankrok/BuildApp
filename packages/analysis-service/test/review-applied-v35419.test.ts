/**
 * v3.54.19 — a look that was told which corrections were applied and answers with no verdict on any of them is asked for
 * them once more, by name. Scripted transport (no provider); every rule with its counter-trial.
 */
import { describe, expect, it } from 'vitest'
import { checkModel } from '../src/consult/loop.js'
import type { ConsultEvent, ConsultantModel, ModelTurn } from '../src/consult/loop.js'

const png = new Uint8Array([137, 80, 78, 71])
const review = (id: string, applied?: Array<{ id: string; verdict: string; note: string }>): ModelTurn => ({
  content: [{ type: 'tool_use', id, name: 'submit_review', input: { status: 'ISSUE_FOUND', observations: [{ about: 'front', seen: 'a door', certainty: 'LIKELY' }], requestedEvidence: [], proposedCorrections: [], checked: ['front'], notChecked: [], ...(applied ? { appliedReview: applied } : {}) } }],
  stopReason: 'tool_use',
  usage: { inputTokens: 10, outputTokens: 10 },
}) as unknown as ModelTurn
const scripted = (steps: ModelTurn[]): ConsultantModel & { sent: unknown[][] } => {
  let i = 0
  const sent: unknown[][] = []
  return { id: 'script', model: 'm', maxOutputTokens: 1000, sent, send: async (req: { messages: unknown[] }) => { sent.push([...req.messages]); const s = steps[i++]; if (!s) throw new Error('exhausted'); return s } } as never
}
const run = (model: ConsultantModel, events: ConsultEvent[], applied: Array<{ id: string; what: string }>) =>
  checkModel({ baseRevision: 'rev1', sources: [], views: [{ png, width: 2, height: 2, labels: 'FRONT', name: 'sides' }], applied, model, price: { inputPerMTok: 1, outputPerMTok: 1 } as never, record: (e) => events.push(e) })

describe('v3.54.19 the review of applied corrections', () => {
  const applied = [{ id: 'op-fix-front-1', what: 'ADD_OPENING' }, { id: 'iw-H10-20', what: 'BUILD_INTERIOR' }]
  it('a look that omits appliedReview is asked once more, naming the ids; the second answer is the review', async () => {
    const events: ConsultEvent[] = []
    const model = scripted([review('a'), review('b', [{ id: 'op-fix-front-1', verdict: 'MATCHES', note: 'door' }])])
    const out = await run(model, events, applied)
    expect('review' in out && out.review.appliedReview).toEqual([{ id: 'op-fix-front-1', verdict: 'MATCHES', note: 'door' }])
    expect(events.filter((e) => e.kind === 'REVIEW_REASKED')).toHaveLength(1)
    expect(JSON.stringify(model.sent[1])).toMatch(/NOT RECORDED: appliedReview is missing.*op-fix-front-1, iw-H10-20/)
    expect(out.turns).toBe(2)
  })
  it('counter-trials: asked once only — a second answer without verdicts stands; a look with verdicts, or with nothing applied, is not asked again', async () => {
    const e1: ConsultEvent[] = []
    const twice = await run(scripted([review('a'), review('b'), review('never')]), e1, applied)
    expect('review' in twice).toBe(true)
    expect(twice.turns).toBe(2)
    expect(e1.filter((e) => e.kind === 'REVIEW_REASKED')).toHaveLength(1)
    const e2: ConsultEvent[] = []
    const withVerdicts = await run(scripted([review('a', [{ id: 'iw-H10-20', verdict: 'NOT_VISIBLE', note: 'interior' }])]), e2, applied)
    expect(withVerdicts.turns).toBe(1)
    expect(e2.some((e) => e.kind === 'REVIEW_REASKED')).toBe(false)
    const e3: ConsultEvent[] = []
    const nothingApplied = await run(scripted([review('a')]), e3, [])
    expect(nothingApplied.turns).toBe(1)
    expect(e3.some((e) => e.kind === 'REVIEW_REASKED')).toBe(false)
  })
})
