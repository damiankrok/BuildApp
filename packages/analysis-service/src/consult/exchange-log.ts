/**
 * v3.54.17 R2 (audit §6) — the private record of every request the consultant path sends, written at the moment it is
 * sent and at the moment its answer is received, whatever happens to the job afterwards.
 *
 * Before this, an answer was kept only inside an ACCEPTED revision (`accepted-consult.ts`), which is written after a
 * complete, failure-free analysis. A job that received and paid for an answer and then failed in normalization,
 * binding or compilation kept nothing of it: the failure could not be replayed (Aurora Midi, ANALYSIS_FAILED after one
 * paid read). Now each attempt leaves, in the host's private data directory (never a job's public files):
 *
 *   journal.jsonl              one line per event, appended at once: SENT, RECEIVED, TRANSPORT_ERROR, RESERVED,
 *                              SETTLED, STAGE (processing reached a step), FAILED (the first loss: stage + sanitized
 *                              cause), END (the job's state)
 *   <seq>-<attempt>.request.json  what was sent: system, conversation (pictures by hash), tools, versions, hashes
 *   <seq>-<attempt>.raw.json      the provider's message as received, before anything here reads it
 *   <seq>-<attempt>.turn.json     the canonical turn the analyzer reads (content, usage, stop reason)
 *   <seq>-<attempt>.error.json    a transport failure: status, reason, the provider's error body, sanitized message
 *   img/<sha256>.<ext>            each picture once, by the hash of its bytes
 *
 * No key and no Authorization header is ever written: the transport never hands them out, and every message is scrubbed
 * of anything shaped like a provider key. Paths, addresses and page bodies are not written by this module; the
 * conversation holds what the provider was shown (the publisher's pictures included), which is why the record is
 * private. `replayAnswersOf` turns a record back into answers for `replayModel`: the same failure, offline.
 */
import { createHash, randomBytes } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { requestHash } from './accepted-consult.js'
import type { ConsultRole, RecordedAnswer } from './accepted-consult.js'
import type { ConsultSpend, ConsultantModel, ModelTurn } from './loop.js'

export const EXCHANGE_LOG_SCHEMA = 'buildapp.consult-exchange' as const
export const EXCHANGE_LOG_VERSION = '1.0.0' as const

/** The provider's message as the transport received it (non-enumerable to JSON and spreads that serialize). */
export const RAW_RESPONSE: unique symbol = Symbol.for('buildapp.consult.rawResponse') as never
/** The transport's view of a failed request: HTTP status and the provider's error body, when there was one. */
export const RAW_ERROR: unique symbol = Symbol.for('buildapp.consult.rawError') as never

export type ExchangeRole = ConsultRole
export type ExchangeVersions = Record<string, string>
export type ExchangeEvent = { at: string; event: string; [k: string]: unknown }

export type ExchangeSink = {
  /** Write a whole file at once (temporary file + rename). */
  put(name: string, data: string | Uint8Array): void
  /** Append one line to the journal, at once. */
  append(line: string): void
  has(name: string): boolean
}

/** The host's sink: `<dir>/…`, created on first write. */
export function fileExchangeSink(dir: string): ExchangeSink & { dir: string } {
  const ensure = (sub?: string): void => void mkdirSync(sub ? join(dir, sub) : dir, { recursive: true })
  return {
    dir,
    put: (name, data) => {
      ensure(name.includes('/') ? name.slice(0, name.lastIndexOf('/')) : undefined)
      const p = join(dir, name)
      const tmp = `${p}.tmp-${process.pid}-${randomBytes(3).toString('hex')}`
      writeFileSync(tmp, data)
      renameSync(tmp, p)
    },
    append: (line) => {
      ensure()
      appendFileSync(join(dir, 'journal.jsonl'), `${line}\n`)
    },
    has: (name) => existsSync(join(dir, name)),
  }
}

export function memoryExchangeSink(): ExchangeSink & { files: Map<string, string | Uint8Array>; journal: string[] } {
  const files = new Map<string, string | Uint8Array>()
  const journal: string[] = []
  return { files, journal, put: (n, d) => void files.set(n, d), append: (l) => void journal.push(l), has: (n) => files.has(n) }
}

const sha = (b: string | Uint8Array): string => createHash('sha256').update(b).digest('hex')
/** Anything shaped like a provider key, and an Authorization header's value, never reaches the record. */
export const scrubSecrets = (text: string): string => text.replace(/sk-ant-[A-Za-z0-9_-]{8,}/g, '[key]').replace(/(authorization|x-api-key)(["']?\s*[:=]\s*["']?)[^"',\s}]+/gi, '$1$2[redacted]')
/** A cause as a person may read it: its kind, its message without keys or paths, the function names it passed through. */
export function sanitizedCause(e: unknown): { name: string; message: string; frames: string[] } {
  const err = e instanceof Error ? e : new Error(String(e))
  const frames = (err.stack ?? '').split('\n').slice(1, 9).map((l) => l.trim().match(/^at (?:async )?([^\s(]+)/)?.[1] ?? '').filter((f) => f && !f.includes('/'))
  return { name: err.name, message: scrubSecrets(err.message).replace(/(?:[A-Za-z]:)?(?:\/[\w.@-]+){2,}/g, '[path]').slice(0, 400), frames }
}

type Picture = { sha256: string; mediaType: string; bytes: number }
/** The conversation with each base64 picture replaced by its hash (the bytes go to `img/` once). */
function externalise(messages: unknown, sink: ExchangeSink, pictures: Picture[]): unknown {
  const walk = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(walk)
    if (!x || typeof x !== 'object') return x
    const o = x as Record<string, unknown>
    const src = o.source as { type?: string; media_type?: string; data?: string } | undefined
    if (o.type === 'image' && src?.type === 'base64' && typeof src.data === 'string') {
      const bytes = Buffer.from(src.data, 'base64')
      const h = sha(bytes)
      const ext = (src.media_type ?? 'image/png').split('/')[1] ?? 'bin'
      const name = `img/${h}.${ext}`
      if (!sink.has(name)) sink.put(name, bytes)
      pictures.push({ sha256: h, mediaType: src.media_type ?? 'image/png', bytes: bytes.length })
      return { ...o, source: { type: 'base64-ref', media_type: src.media_type, sha256: h } }
    }
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, walk(v)]))
  }
  return walk(messages)
}

/** The conversation as it was sent, the pictures read back from `img/` (for an offline replay of the same request). */
export function internalise(messages: unknown, dir: string): unknown {
  const walk = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(walk)
    if (!x || typeof x !== 'object') return x
    const o = x as Record<string, unknown>
    const src = o.source as { type?: string; media_type?: string; sha256?: string } | undefined
    if (o.type === 'image' && src?.type === 'base64-ref' && src.sha256) {
      const ext = (src.media_type ?? 'image/png').split('/')[1] ?? 'bin'
      return { ...o, source: { type: 'base64', media_type: src.media_type, data: readFileSync(join(dir, 'img', `${src.sha256}.${ext}`)).toString('base64') } }
    }
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, walk(v)]))
  }
  return walk(messages)
}

export type ExchangeLog = {
  /** The transport, recording each attempt before it is sent and each answer as it is received. */
  wrap(model: ConsultantModel, role: ExchangeRole, versions?: ExchangeVersions): ConsultantModel
  /** The books, recording each reservation and settlement beside the attempt it paid for. */
  wrapSpend(spend: ConsultSpend): ConsultSpend
  /** Processing reached a step (the place a later failure is reported at). */
  stage(name: string, detail?: Record<string, unknown>): void
  /** The first loss: where processing stopped and why (sanitized). Later calls are recorded as `FAILED_AGAIN`. */
  failed(stage: string | undefined, cause: unknown): void
  end(state: 'COMPLETED' | 'FAILED' | 'CANCELLED', detail?: Record<string, unknown>): void
  /** The step processing is at. */
  current(): string | undefined
  events(): ExchangeEvent[]
}

export function exchangeLog(sink: ExchangeSink, meta: { jobId?: string | null; now?: () => Date } = {}): ExchangeLog {
  const now = meta.now ?? ((): Date => new Date())
  const events: ExchangeEvent[] = []
  let seq = 0
  let stageNow: string | undefined
  let failedOnce = false
  const line = (event: string, body: Record<string, unknown> = {}): void => {
    const e: ExchangeEvent = { at: now().toISOString(), event, ...body }
    events.push(e)
    sink.append(scrubSecrets(JSON.stringify(e)))
  }
  const json = (x: unknown): string => `${scrubSecrets(JSON.stringify(x, null, 1))}\n`
  line('OPENED', { schema: EXCHANGE_LOG_SCHEMA, version: EXCHANGE_LOG_VERSION, jobId: meta.jobId ?? null })
  return {
    wrap: (model, role, versions = {}) => ({
      ...model,
      send: async (request) => {
        seq += 1
        const attemptId = `${String(seq).padStart(3, '0')}-${randomBytes(4).toString('hex')}`
        const pictures: Picture[] = []
        const requestSha256 = requestHash(request)
        const messages = externalise(request.messages, sink, pictures)
        sink.put(`${attemptId}.request.json`, json({ schema: EXCHANGE_LOG_SCHEMA, version: EXCHANGE_LOG_VERSION, attemptId, seq, role, stage: stageNow ?? null, at: now().toISOString(), transport: { id: model.id, model: model.model, maxOutputTokens: model.maxOutputTokens, strict: model.strict === true, cache: model.cache ?? null }, versions, requestSha256, systemSha256: sha(request.system), toolsSha256: sha(JSON.stringify(request.tools)), pictures, system: request.system, messages, tools: request.tools }))
        line('SENT', { attemptId, role, stage: stageNow ?? null, requestSha256, pictures: pictures.map((p) => p.sha256) })
        let turn: ModelTurn
        try {
          turn = await model.send(request)
        } catch (e) {
          const rawErr = (e as { [RAW_ERROR]?: { status?: number; body?: unknown } })[RAW_ERROR]
          const reason = (e as { reason?: string }).reason ?? 'TRANSPORT'
          sink.put(`${attemptId}.error.json`, json({ attemptId, role, reason, status: rawErr?.status ?? null, providerError: rawErr?.body ?? null, cause: sanitizedCause(e) }))
          line('TRANSPORT_ERROR', { attemptId, role, reason, status: rawErr?.status ?? null })
          throw e
        }
        // the provider's message first, as it came; then what the analyzer reads of it
        const raw = (turn as { [RAW_RESPONSE]?: unknown })[RAW_RESPONSE]
        sink.put(`${attemptId}.raw.json`, json(raw ?? null))
        const { [RAW_RESPONSE]: _raw, ...canonical } = turn as ModelTurn & { [RAW_RESPONSE]?: unknown }
        sink.put(`${attemptId}.turn.json`, json({ attemptId, role, requestSha256, turn: canonical }))
        line('RECEIVED', { attemptId, role, requestId: turn.requestId ?? null, model: turn.model, stopReason: turn.stopReason ?? null, refusal: turn.stopReason === 'refusal', truncated: turn.stopReason === 'max_tokens', usage: turn.usage, rawKept: raw !== undefined, ...(turn.strictFallback ? { strictFallback: turn.strictFallback } : {}) })
        return canonical as ModelTurn
      },
    }),
    wrapSpend: (spend) => ({
      reserve: (m, usd, note) => {
        const r = spend.reserve(m, usd, note)
        line('RESERVED', { reservationId: r.id, model: m, usd: r.usd, note: note.slice(0, 120) })
        return r
      },
      settle: (r, actual, note) => {
        spend.settle(r, actual, note)
        line('SETTLED', { reservationId: r.id, reservedUsd: r.usd, ...(actual === 'NOT_SENT' ? { notSent: true } : { usd: actual.usd, inputTokens: actual.inputTokens, outputTokens: actual.outputTokens }), ...(note ? { note } : {}) })
      },
    }),
    stage: (name, detail) => {
      stageNow = name
      line('STAGE', { stage: name, ...(detail ?? {}) })
    },
    failed: (stage, cause) => {
      line(failedOnce ? 'FAILED_AGAIN' : 'FAILED', { stage: stage ?? stageNow ?? null, cause: sanitizedCause(cause), attemptsSoFar: seq })
      failedOnce = true
    },
    end: (state, detail) => line('END', { state, attempts: seq, ...(detail ?? {}) }),
    current: () => stageNow,
    events: () => [...events],
  }
}

export type ExchangeRecord = { dir: string; journal: ExchangeEvent[]; answers: RecordedAnswer[]; firstLoss?: ExchangeEvent; requests: Array<{ attemptId: string; role: string; requestSha256: string }> }

/** A record read back: its journal, its first loss, and every received answer as `RecordedAnswer` for `replayModel`. */
export function readExchangeRecord(dir: string): ExchangeRecord {
  const journal = readFileSync(join(dir, 'journal.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as ExchangeEvent)
  const answers: RecordedAnswer[] = []
  const requests: ExchangeRecord['requests'] = []
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.request.json')).sort()) {
    const r = JSON.parse(readFileSync(join(dir, f), 'utf8')) as { attemptId: string; role: string; requestSha256: string }
    requests.push({ attemptId: r.attemptId, role: r.role, requestSha256: r.requestSha256 })
    const t = join(dir, `${r.attemptId}.turn.json`)
    if (existsSync(t)) {
      const got = JSON.parse(readFileSync(t, 'utf8')) as { role: ConsultRole; requestSha256: string; turn: ModelTurn }
      answers.push({ role: got.role, requestSha256: got.requestSha256, turn: got.turn })
    }
  }
  const firstLoss = journal.find((e) => e.event === 'FAILED')
  return { dir, journal, answers, requests, ...(firstLoss ? { firstLoss } : {}) }
}
