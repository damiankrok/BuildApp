import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LARCHFIELD, syntheticPublisher } from '@buildapp/synthetic-drawings'
import { CONSULT_PRICES, anthropicConsultant, readExchangeRecord, replayModel } from '@buildapp/analysis-service'
import type { ConsultantWiring } from '@buildapp/analysis-service'
import { InProcessExecutor } from '../src/executor.js'
import type { AnalysisWiring } from '../src/executor.js'
import { openSpendLedger, DEFAULT_SPEND_LIMITS } from '../src/house-reader-spend.js'
import { call, pollJob, startApi } from './support/harness.js'

// v3.54.17 R2 (audit §6) — a CONTROLLED TEST, not an organic result. Through the host's public entry (POST with the pilot
// token → runner → executor → consultAnalysis), the metric consultant's request is sent through the real Anthropic
// transport (its SDK client replaced by a stub that answers like the provider), received, settled in the host's books,
// and then a controlled exception is raised right after the answer is normalized. The job fails; the exchange record
// written at receipt must let the same failure be replayed OFFLINE at the same step with the same cause.
const TOKEN = 't'.repeat(32)
const publisher = syntheticPublisher({ projects: [{ code: 'larchfield-lf01', title: 'Larchfield', house: LARCHFIELD }] })
const URL_A = publisher.pageUrl('larchfield-lf01')

/** What the provider would send back: one report_dimensions call with no items (a valid, empty read). */
const providerMessage = (model: string) => ({ id: 'msg_test_r2', type: 'message', role: 'assistant', model, content: [{ type: 'tool_use', id: 'toolu_r2', name: 'report_dimensions', input: { items: [] } }], stop_reason: 'tool_use', stop_sequence: null, usage: { input_tokens: 1800, output_tokens: 40 } })

class ControlledFault extends Error {
  constructor() {
    super('controlled fault after the metric read was normalized (test)')
    this.name = 'ControlledFault'
  }
}

function wiringOf(dataDir: string, metricModel: ConsultantWiring['model'], spend: ConsultantWiring['spend'] | undefined): AnalysisWiring {
  const price = CONSULT_PRICES['claude-opus-5-5']
  const neverAsked = anthropicConsultant({ model: 'claude-sonnet-5-5', apiKey: 'sk-test-not-a-key', createClient: async () => ({ messages: { create: async () => { throw new Error('the rounds transport is not asked in this test') } } }) })
  return {
    adapters: [publisher.adapter],
    deps: publisher.deps,
    exchangeDir: join(dataDir, 'consult-exchanges'),
    consultant: {
      model: neverAsked,
      price,
      variant: 'C',
      check: 'OFF',
      metricRead: 'ON',
      metricModel,
      metricPrice: price,
      ...(spend ? { spend } : {}),
      // the controlled fault: raised by the record callback the analysis calls once the read's answer is normalized
      record: (e) => {
        if (e.kind === 'METRIC_READ') throw new ControlledFault()
      },
    },
  }
}

describe('v3.54.17 R2 exchange record through the public host path (controlled test)', () => {
  it('an answer received and settled, then a controlled exception: the job fails, the record replays the same first loss offline', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'r2-exchange-'))
    let providerCalls = 0
    const transport = anthropicConsultant({
      model: 'claude-opus-5-5',
      apiKey: 'sk-test-not-a-key',
      maxOutputTokens: 16000,
      createClient: async () => ({ messages: { create: async (body: Record<string, unknown>) => {
        providerCalls += 1
        return providerMessage(String(body.model))
      } } }),
    })
    const books = openSpendLedger({ dir: join(dataDir, 'books'), limits: { ...DEFAULT_SPEND_LIMITS, maxUsd: 5 }, openingUsd: 0 })
    const spend = { reserve: (m: string, usd: number) => { const r = books.reserve('CONSULTATION', m, usd); return { id: r.id, usd: r.reservedUsd } }, settle: (r: { id: string; usd: number }, actual: { usd: number; inputTokens: number; outputTokens: number } | 'NOT_SENT', note?: string) => books.settle({ id: r.id, purpose: 'CONSULTATION', model: 'claude-opus-5-5', reservedUsd: r.usd }, actual, note) }
    const api = await startApi(publisher, { houseReaderToken: TOKEN }, { dataDir, executor: new InProcessExecutor(() => wiringOf(dataDir, transport, spend)) })
    try {
      const posted = await call(api, 'POST', '/v1/analyses', { url: URL_A }, { authorization: `Bearer ${TOKEN}` })
      expect(posted.status).toBe(202)
      const jobId = String(posted.json.jobId)
      const seen = await pollJob(api, jobId, () => false, 240_000)
      expect(seen[seen.length - 1].status).toBe('FAILED')
      expect(providerCalls).toBe(1)

      // the record: written at the job's end in the private data directory, never among the job's public files
      const dir = join(dataDir, 'consult-exchanges', jobId)
      const rec = readExchangeRecord(dir)
      const kinds = rec.journal.map((e) => e.event)
      expect(kinds.slice(0, 2)).toEqual(['OPENED', 'STAGE'])
      // sent → received → reserved/settled (the books' events wrap the transport's) → the first loss → the end
      const sent = kinds.indexOf('SENT')
      const received = kinds.indexOf('RECEIVED')
      const settled = kinds.indexOf('SETTLED')
      const failed = kinds.indexOf('FAILED')
      expect(kinds.indexOf('RESERVED')).toBeLessThan(sent)
      expect(sent).toBeLessThan(received)
      expect(received).toBeLessThan(settled)
      expect(settled).toBeLessThan(failed)
      expect(kinds[kinds.length - 1]).toBe('END')
      expect(rec.journal[kinds.length - 1].state).toBe('FAILED')
      expect(rec.firstLoss).toMatchObject({ stage: 'METRIC_READ', cause: { name: 'ControlledFault' } })
      // raw and canonical kept apart; the raw is the provider's message as received
      const attempt = rec.requests[0].attemptId
      const raw = JSON.parse(readFileSync(join(dir, `${attempt}.raw.json`), 'utf8'))
      expect(raw).toMatchObject({ id: 'msg_test_r2', stop_reason: 'tool_use', usage: { input_tokens: 1800, output_tokens: 40 } })
      const canonical = JSON.parse(readFileSync(join(dir, `${attempt}.turn.json`), 'utf8'))
      expect(canonical.turn).toMatchObject({ stopReason: 'tool_use', usage: { inputTokens: 1800, outputTokens: 40 } })
      // the request as sent, with versions, hashes and its picture by hash (the bytes once under img/)
      const request = JSON.parse(readFileSync(join(dir, `${attempt}.request.json`), 'utf8'))
      expect(request).toMatchObject({ role: 'METRIC', stage: 'METRIC_READ', transport: { model: 'claude-opus-5-5' } })
      expect(request.versions.contract).toBeTruthy()
      expect(request.pictures.length).toBe(1)
      expect(readdirSync(join(dir, 'img'))).toHaveLength(1)
      // no key anywhere in the record
      for (const f of readdirSync(dir).filter((n) => n.endsWith('.json') || n.endsWith('.jsonl'))) expect(readFileSync(join(dir, f), 'utf8')).not.toContain('sk-test-not-a-key')
      // the books settled the answer to its usage before the fault
      const journalOfBooks = readFileSync(join(dataDir, 'books', 'house-reader-spend.journal.jsonl'), 'utf8')
      expect(journalOfBooks).toMatch(/"event":"SETTLED"/)
      // public files of the job hold nothing of it
      const result = await call(api, 'GET', `/v1/analyses/${jobId}/result`)
      expect(result.status).not.toBe(200)

      // OFFLINE: the same job from the record alone — no provider, no books
      const counter = { replayed: 0, missing: 0 }
      const offline = replayModel(transport, 'METRIC', rec.answers, counter)
      const dataDir2 = mkdtempSync(join(tmpdir(), 'r2-exchange-replay-'))
      const api2 = await startApi(publisher, { houseReaderToken: TOKEN }, { dataDir: dataDir2, executor: new InProcessExecutor(() => wiringOf(dataDir2, offline, undefined)) })
      try {
        const again = await call(api2, 'POST', '/v1/analyses', { url: URL_A }, { authorization: `Bearer ${TOKEN}` })
        const seen2 = await pollJob(api2, String(again.json.jobId), () => false, 240_000)
        expect(seen2[seen2.length - 1].status).toBe('FAILED')
        expect(counter).toEqual({ replayed: 1, missing: 0 })
        expect(providerCalls).toBe(1)
        const rec2 = readExchangeRecord(join(dataDir2, 'consult-exchanges', String(again.json.jobId)))
        // the same request (by hash), the same first loss: step, kind, message and the functions it passed through
        expect(rec2.requests.map((r) => r.requestSha256)).toEqual(rec.requests.map((r) => r.requestSha256))
        expect(rec2.firstLoss?.stage).toBe(rec.firstLoss?.stage)
        expect(rec2.firstLoss?.cause).toEqual(rec.firstLoss?.cause)
      } finally {
        await api2.close()
      }
    } finally {
      await api.close({ keepData: false })
    }
  }, 600_000)
})
