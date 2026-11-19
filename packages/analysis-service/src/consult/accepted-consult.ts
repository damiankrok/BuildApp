/**
 * v3.54.14 — an accepted revision of a CONSULTED analysis (the consultant pilot: metric read, sketches, label rounds,
 * looks), reused by the next analysis of the same source at 0 USD — D39's rule (`house/accepted.ts`) on this path.
 *
 * What is kept is the provider's answers, never the model: each request the consultant sent is stored with its answer
 * under the hash of the request itself (system, conversation, tools — the pictures included). A later analysis under
 * the same BINDING (source package, analyzer, consultant contract and prompt, the models, the settings that change the
 * answer) runs the same deterministic pipeline and, for every request it would send, takes the stored answer of that
 * exact request: no request leaves the host, nothing is reserved in the books. A request with no stored answer is not
 * sent either — it fails as a transport failure would, and the analysis keeps what stood before it (recorded as
 * `sameGeometry: false`). Anything else — no accepted revision, another source or version, a re-analysis asked for —
 * reads afresh as a separate candidate, the earlier revision kept untouched.
 *
 * Files are named by hashes; they hold the answers and the request hashes, no address, path or key.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ConsultantModel, ModelTurn } from './loop.js'

export const ACCEPTED_CONSULT_SCHEMA = 'buildapp.accepted-consulted-revision' as const
export const ACCEPTED_CONSULT_VERSION = '1.0.0' as const

export type ConsultRole = 'ROUNDS' | 'METRIC' | 'SKETCH'
export type ConsultBinding = { source: string; analyzer: string; consultant: string; models: string; settings: string }
export type RecordedAnswer = { role: ConsultRole; requestSha256: string; turn: ModelTurn }
export type AcceptedConsultRevision = { schema: typeof ACCEPTED_CONSULT_SCHEMA; version: typeof ACCEPTED_CONSULT_VERSION; key: string; binding: ConsultBinding; acceptedAt: string; modelHash: string; answers: RecordedAnswer[] }
export type AcceptedConsultStore = { get(key: string): AcceptedConsultRevision | undefined; put(revision: AcceptedConsultRevision): boolean }
export type ConsultReuse =
  | { state: 'REUSED'; key: string; acceptedAt: string; sameGeometry: boolean; answersReplayed: number; missing: number }
  | { state: 'NEW_CANDIDATE'; key: string; why: 'NO_ACCEPTED_REVISION' | 'REANALYSIS_ASKED' }
  | { state: 'ACCEPTED_NOW'; key: string; answers: number }
  | { state: 'NOT_ACCEPTED'; key: string; why: string }

const sha = (s: string): string => createHash('sha256').update(s).digest('hex')
const stable = (x: unknown): string => JSON.stringify(x, (_k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v))

export function consultBinding(input: { sourcePackageHash: string; analyzer: string; consultant: string; models: Partial<Record<ConsultRole, string>>; settings: string }): { key: string; binding: ConsultBinding } {
  const binding: ConsultBinding = {
    source: input.sourcePackageHash,
    analyzer: input.analyzer,
    consultant: input.consultant,
    models: (['ROUNDS', 'METRIC', 'SKETCH'] as const).map((r) => `${r}=${input.models[r] ?? '-'}`).join(';'),
    settings: input.settings,
  }
  return { key: sha(stable(binding)).slice(0, 32), binding }
}

/** The hash a request is stored and found under: what the provider is sent, the signal excluded. */
export function requestHash(request: { system: string; messages: unknown[]; tools: unknown[] }): string {
  return sha(stable({ system: request.system, messages: request.messages, tools: request.tools }))
}

/** A transport that records every answer it gets (successful turns only) under its request's hash. */
export function recordingModel(inner: ConsultantModel, role: ConsultRole, into: RecordedAnswer[], failures?: { count: number }): ConsultantModel {
  return { ...inner, send: async (request) => {
    let turn: ModelTurn
    try {
      turn = await inner.send(request)
    } catch (e) {
      if (failures) failures.count += 1
      throw e
    }
    into.push({ role, requestSha256: requestHash(request), turn })
    return turn
  } }
}

/** A transport that answers only from the recorded answers of one role: no network, no usage, no spend. */
export function replayModel(original: Pick<ConsultantModel, 'id' | 'model' | 'maxOutputTokens'>, role: ConsultRole, answers: readonly RecordedAnswer[], counter: { replayed: number; missing: number }): ConsultantModel {
  const queue = new Map<string, ModelTurn[]>()
  for (const a of answers) if (a.role === role) queue.set(a.requestSha256, [...(queue.get(a.requestSha256) ?? []), a.turn])
  // the same id and model as the transport it stands in for: they are written into the readings' provenance
  return { id: original.id, model: original.model, maxOutputTokens: original.maxOutputTokens, send: async (request) => {
    const q = queue.get(requestHash(request))
    const turn = q?.shift()
    if (!turn) {
      counter.missing += 1
      throw new Error('accepted revision: this request has no stored answer; it is not sent')
    }
    counter.replayed += 1
    return { ...turn, usage: { inputTokens: 0, outputTokens: 0 }, latencyMs: 0 }
  } }
}

/** The host's store: `<dir>/<key>.json`. A revision is never replaced. */
export function fileAcceptedConsultStore(dir: string): AcceptedConsultStore {
  return {
    get: (key) => {
      const p = join(dir, `${key}.json`)
      return /^[0-9a-f]{32}$/.test(key) && existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as AcceptedConsultRevision) : undefined
    },
    put: (revision) => {
      const p = join(dir, `${revision.key}.json`)
      if (!/^[0-9a-f]{32}$/.test(revision.key) || existsSync(p)) return false
      mkdirSync(dir, { recursive: true })
      const tmp = `${p}.tmp-${process.pid}`
      writeFileSync(tmp, `${JSON.stringify(revision)}\n`)
      renameSync(tmp, p)
      return true
    },
  }
}

export function memoryAcceptedConsultStore(): AcceptedConsultStore & { size(): number } {
  const m = new Map<string, AcceptedConsultRevision>()
  return { get: (k) => m.get(k), put: (r) => (m.has(r.key) ? false : (m.set(r.key, structuredClone(r)), true)), size: () => m.size }
}
