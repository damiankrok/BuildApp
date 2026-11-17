/**
 * v3.54.6 (D39) — an accepted revision reused by an independent job: Marcówki GE through `describeLink`, offline, one
 * process per job, one store shared by the jobs (the host's data directory in production).
 *   npx vite-node research/source-to-model/v3546/accepted-reuse.ts -- --job A|B|C|D --store <dir> --answers <run>/marcowki-ge
 *     --package <source-package.json> --cache <bytes dir>
 * A: the reading's transport PLAYS BACK the answers a live read recorded (no request leaves; labelled as playback) —
 *    the job whose house is accepted. B: a second job, a transport that FAILS if it is called — the same binding.
 * C: review off (a setting that changes the geometry): another binding. D: a re-analysis asked for.
 * Prints what each job did: the revision rule's state, the decision, the delivered model hash, requests to the transport.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { archonAdapter, fileByteCache, startDecoders } from '@buildapp/source-package'
import { describeLink, fileAcceptedStore } from '../../../packages/analysis-service/src/index.js'
import type { ConsultantModel, ModelTurn } from '../../../packages/analysis-service/src/consult/loop.js'
import type { ReadingRecord, ReadingStep } from '../../../packages/analysis-service/src/house/read.js'

const argv = process.argv.slice(2).filter((a) => a !== '--')
const arg = (n: string): string => {
  const i = argv.indexOf(`--${n}`)
  if (i < 0 || i + 1 >= argv.length) throw new Error(`--${n} is required`)
  return argv[i + 1]
}
const job = arg('job')
await startDecoders()
const pkg = JSON.parse(readFileSync(arg('package'), 'utf8'))
const dir = join(arg('answers'), 'answers')
const recorded = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as ReadingRecord)
let sent = 0
const playback = (step: ReadingStep): ConsultantModel => {
  const queue = recorded.filter((r) => r.step === step).sort((p, q) => (p.round ?? 0) - (q.round ?? 0))
  return {
    id: `playback-${step}`,
    model: 'claude-sonnet-5-5',
    maxOutputTokens: 16000,
    send: async (req): Promise<ModelTurn> => {
      sent += 1
      const r = queue.shift()
      if (!r) throw Object.assign(new Error(`playback: no recorded ${step} answer left`), { reason: 'TRANSPORT' })
      const name = (req.tools[0] as { name: string }).name
      return { content: [{ type: 'tool_use', id: `pb-${sent}`, name, input: r.answer } as never], usage: { inputTokens: 0, outputTokens: 0 }, stopReason: 'tool_use', model: r.model, latencyMs: 0 }
    },
  }
}
const refuse = (step: ReadingStep): ConsultantModel => ({
  id: `refuse-${step}`,
  model: 'claude-sonnet-5-5',
  maxOutputTokens: 16000,
  send: async () => {
    sent += 1
    throw Object.assign(new Error('this job must not call the provider'), { reason: 'NO_CREDENTIALS' })
  },
})
const transports = new Map<ReadingStep, ConsultantModel>()
const describer = {
  modelFor: (step: ReadingStep): ConsultantModel => {
    if (!transports.has(step)) transports.set(step, job === 'B' ? refuse(step) : playback(step))
    return transports.get(step) as ConsultantModel
  },
  price: { inputUsdPerMTok: 2, outputUsdPerMTok: 10 },
  accepted: fileAcceptedStore(arg('store')),
  ...(job === 'C' ? { review: false } : {}),
  ...(job === 'D' ? { reanalyse: true } : {}),
}
const outcome = await describeLink({ kind: 'PACKAGE', pkg }, { adapters: [archonAdapter], cache: fileByteCache(arg('cache')), offline: true, jobId: `job-${job}` }, describer)
console.log(JSON.stringify({ job, reuse: outcome.reuse, accepted: outcome.decision.accepted, code: outcome.decision.code, partial: outcome.decision.partial, delivered: outcome.decision.delivered ? { which: outcome.decision.delivered.which, modelHash: outcome.decision.delivered.modelHash.slice(0, 16), same: outcome.decision.delivered.same } : null, describedModel: outcome.described.modelHash?.slice(0, 16) ?? null, requestsToTransport: sent }))
