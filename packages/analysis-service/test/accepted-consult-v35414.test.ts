/**
 * v3.54.14 — an accepted revision of a consulted analysis: the answers recorded under each request's own hash, replayed
 * for the same request with no network and no usage; a request with no stored answer is not sent; the binding names
 * everything that changes the answer; a revision is never replaced.
 */
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ACCEPTED_CONSULT_SCHEMA, ACCEPTED_CONSULT_VERSION, consultBinding, fileAcceptedConsultStore, recordingModel, replayModel, requestHash } from '../src/consult/accepted-consult.js'
import type { RecordedAnswer } from '../src/consult/accepted-consult.js'
import type { ConsultantModel, ModelTurn } from '../src/consult/loop.js'

const req = (n: number) => ({ system: 'read the dimensions', messages: [{ role: 'user', content: [{ type: 'text', text: `frame ${n}` }] }], tools: [{ name: 'report' }] })
let sent = 0
const live: ConsultantModel = { id: 'anthropic', model: 'claude-opus-5-5', maxOutputTokens: 16000, send: async (r): Promise<ModelTurn> => {
  sent += 1
  return { content: [{ type: 'text', text: `answer to ${JSON.stringify(r.messages)}` } as never], usage: { inputTokens: 1000, outputTokens: 300 }, model: 'claude-opus-5-5', latencyMs: 900, requestId: `req_${sent}` }
} }

describe('v3.54.14 accepted consulted revision', () => {
  it('replays the recorded answer of the same request, in any order, with no usage; an unknown request is not sent', async () => {
    sent = 0
    const answers: RecordedAnswer[] = []
    const rec = recordingModel(live, 'METRIC', answers)
    const a1 = await rec.send(req(1))
    const a2 = await rec.send(req(2))
    expect(sent).toBe(2)
    const counter = { replayed: 0, missing: 0 }
    const rep = replayModel(live, 'METRIC', answers, counter)
    expect(rep.id).toBe(live.id)
    expect(rep.model).toBe(live.model)
    const b2 = await rep.send(req(2))
    const b1 = await rep.send(req(1))
    expect(b1.content).toEqual(a1.content)
    expect(b2.content).toEqual(a2.content)
    expect(b1.usage).toEqual({ inputTokens: 0, outputTokens: 0 })
    await expect(rep.send(req(3))).rejects.toThrow(/no stored answer/)
    expect(sent).toBe(2)
    expect(counter).toEqual({ replayed: 2, missing: 1 })
    // a role answers only from its own answers
    await expect(replayModel(live, 'SKETCH', answers, counter).send(req(1))).rejects.toThrow()
  })

  it('the binding changes with the source, the models and the settings; the store keeps hashes and answers, never replaces', () => {
    const base = { sourcePackageHash: 'p'.repeat(64), analyzer: '1.11.0/x', consultant: 'c', models: { ROUNDS: 'm', METRIC: 'claude-opus-5-5' }, settings: 'metric=ON' }
    const k = consultBinding(base).key
    expect(consultBinding({ ...base }).key).toBe(k)
    expect(consultBinding({ ...base, sourcePackageHash: 'q'.repeat(64) }).key).not.toBe(k)
    expect(consultBinding({ ...base, models: { ...base.models, SKETCH: 'claude-sonnet-5-5' } }).key).not.toBe(k)
    expect(consultBinding({ ...base, settings: 'metric=OFF' }).key).not.toBe(k)
    const dir = mkdtempSync(join(tmpdir(), 'acc-'))
    const store = fileAcceptedConsultStore(dir)
    const b = consultBinding(base)
    const rev = { schema: ACCEPTED_CONSULT_SCHEMA, version: ACCEPTED_CONSULT_VERSION, key: b.key, binding: b.binding, acceptedAt: '2026-11-19T00:00:00.000Z', modelHash: 'h', answers: [{ role: 'METRIC' as const, requestSha256: requestHash(req(1)), turn: { content: [], usage: {}, model: 'm', latencyMs: 1 } }] }
    expect(store.put(rev)).toBe(true)
    expect(store.put({ ...rev, modelHash: 'other' })).toBe(false)
    expect(store.get(b.key)?.modelHash).toBe('h')
    expect(store.get('../x')).toBeUndefined()
    expect(readdirSync(dir)).toEqual([`${b.key}.json`])
    expect(readFileSync(join(dir, `${b.key}.json`), 'utf8')).not.toMatch(/https?:|\/home\//)
  })
})
