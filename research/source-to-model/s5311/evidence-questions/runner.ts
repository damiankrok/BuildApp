/**
 * s5311 — the file side of the evidence-question harness: writing payloads (prepare), replaying fixtures, and the live
 * run behind the campaign's ONE set of spend books. `prepare.ts` and `run.ts` are the command lines over this file.
 *
 * The live path copies `apps/analyzer-api/scripts/house-reader-trial.ts` exactly where money is concerned:
 *  - the books are a persistent private directory (`--books`, default ~/.buildplan/house-reader-books) opened at the
 *    campaign ledger's total and refused if they hold less;
 *  - every request is reserved before it leaves (`spendGuardedStructuredVision`), there are no retries (the SDK runs
 *    with maxRetries 0 and a request is never re-sent), a timeout or dropped connection keeps its whole reservation;
 *  - what the run booked is appended to the campaign ledger as ONE entry, billing UNCONFIRMED.
 * Replay opens no books and touches no ledger, whatever it is given.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { anthropicStructuredVision } from '@buildapp/source-vision'
import type { AnthropicMessagesLike } from '@buildapp/source-vision'
import { DEFAULT_SPEND_LIMITS, HOUSE_READER_PRICES, SpendLedgerError, openSpendLedger, reservationUsd, spendGuardedStructuredVision } from '../../../../apps/analyzer-api/src/house-reader-spend.js'
import {
  EXPECTED_OUTPUT_TOKENS,
  HARNESS_VERSION,
  answerCacheKey,
  askAll,
  checkSeal,
  expectedInputTokens,
  fixtureReader,
  loadRequest,
  prepareRequests,
  questionSchema,
  questionText,
  summarise,
  toVisionRequest,
  usd,
} from './harness.js'
import type { AnswerCache, FixtureFile, LoadedRequest, MetricEvidence, Observation, PreparedRequest, QuestionSet } from './harness.js'

const round6 = (n: number): number => Math.round(n * 1e6) / 1e6
export const inside = (root: string, path: string): boolean => {
  const r = relative(resolve(root), resolve(path))
  return r === '' || (!r.startsWith('..') && !isAbsolute(r))
}
const writeJson = (path: string, value: unknown): void => writeFileSync(path, `${JSON.stringify(value, null, 1)}\n`)

export type Manifest = {
  schema: 'buildapp.evidence-questions-payloads'
  harnessVersion: string
  questionsSha256: string
  sheets: Record<string, { packageDir: string | null; metricEvidence: string | null }>
  requests: PreparedRequest[]
  estimates: Estimates
}

export function loadSealedQuestions(questionsPath: string, sealPath: string): { set: QuestionSet; sha256: string } {
  const text = readFileSync(questionsPath, 'utf8')
  const seal = JSON.parse(readFileSync(sealPath, 'utf8')) as { sha256?: string }
  return { set: checkSeal(text, seal), sha256: seal.sha256 as string }
}

// --- estimates -------------------------------------------------------------------------------------------------------

export const ESTIMATE_MODELS = ['claude-sonnet-5-5', 'claude-haiku-5-5'] as const
/** The answer ceiling of a HOUSE_TRIAGE request in the live adapter (`triageMaxTokens`), and so of its reservation. */
export const TRIAGE_MAX_OUTPUT_TOKENS = 4096

export type EstimateRow = { request: string; pictures: Array<{ number: number; role: string; width: number; height: number; bytes: number; tokens: number }>; payloadBytes: number; imageTokens: number; textTokens: number; inputTokens: number; outputTokens: number; costUsd: Record<string, number>; reservedUsd: Record<string, number> }
export type Estimates = {
  assumptions: string[]
  rows: EstimateRow[]
  totals: Record<string, { B: number; C: number; BC: number; reservedBC: number }>
  cascade: { perSheet: Array<{ sheet: string; questions: string[]; inputTokens: number; outputTokens: number; costUsd: Record<string, number> }>; costUsd: Record<string, { best: number; worst: number }>; rule: string }
}

export function estimate(set: QuestionSet, requests: Array<PreparedRequest | LoadedRequest>): Estimates {
  const rows: EstimateRow[] = requests.map((r) => {
    const t = expectedInputTokens(r)
    const costUsd: Record<string, number> = {}
    const reservedUsd: Record<string, number> = {}
    for (const m of ESTIMATE_MODELS) {
      costUsd[m] = usd(HOUSE_READER_PRICES[m], t.total, EXPECTED_OUTPUT_TOKENS)
      reservedUsd[m] = reservationUsd({ system: r.system, text: r.text, schema: r.schema, pictures: r.pictures.map((p) => ({ number: p.number, bytes: new Uint8Array(0), mediaType: p.mediaType })) }, TRIAGE_MAX_OUTPUT_TOKENS, HOUSE_READER_PRICES[m])
    }
    const payloadBytes = r.pictures.reduce((s, p) => s + p.bytes, 0) + r.system.length + r.text.length + JSON.stringify(r.schema).length
    return { request: r.id, pictures: r.pictures.map((p) => ({ number: p.number, role: p.role, width: p.width, height: p.height, bytes: p.bytes, tokens: Math.max(...p.tokens.map((x) => x.tokens)) })), payloadBytes, imageTokens: t.imageTokens, textTokens: t.textTokens, inputTokens: t.total, outputTokens: EXPECTED_OUTPUT_TOKENS, costUsd, reservedUsd }
  })
  const totals: Estimates['totals'] = {}
  for (const m of ESTIMATE_MODELS) {
    const sum = (v: 'B' | 'C' | 'BC', key: 'costUsd' | 'reservedUsd' = 'costUsd'): number => round6(rows.filter((x) => v === 'BC' || x.request.endsWith(`-${v}`)).reduce((s, x) => s + x[key][m], 0))
    totals[m] = { B: sum('B'), C: sum('C'), BC: sum('BC'), reservedBC: sum('BC', 'reservedUsd') }
  }
  // the cascade: one request per sheet (its original, all its questions in one prompt and one schema), then one C
  // request (original + pointer) for each question the first round left UNKNOWN: best = none left, worst = all left
  const perSheet: Estimates['cascade']['perSheet'] = []
  for (const sheet of [...new Set(set.questions.map((q) => q.sheet))]) {
    const qs = set.questions.filter((q) => q.sheet === sheet)
    const first = requests.find((r) => r.questionId === qs[0].id && r.variant === 'B') as PreparedRequest
    const textChars = questionText(qs[0], set.sheets[sheet]).length + qs.slice(1).reduce((s, q) => s + q.prompt.length + 120, 0) + qs.reduce((s, q) => s + JSON.stringify(questionSchema(q)).length, 0) + first.system.length
    const imageTokens = Math.max(...first.pictures[0].tokens.map((x) => x.tokens))
    const inputTokens = imageTokens + Math.ceil(textChars / 3.5) + 400
    const outputTokens = EXPECTED_OUTPUT_TOKENS + 250 * (qs.length - 1)
    perSheet.push({ sheet, questions: qs.map((q) => q.id), inputTokens, outputTokens, costUsd: Object.fromEntries(ESTIMATE_MODELS.map((m) => [m, usd(HOUSE_READER_PRICES[m], inputTokens, outputTokens)])) })
  }
  const cascadeCost: Estimates['cascade']['costUsd'] = {}
  for (const m of ESTIMATE_MODELS) {
    const best = round6(perSheet.reduce((s, x) => s + x.costUsd[m], 0))
    cascadeCost[m] = { best, worst: round6(best + rows.filter((x) => x.request.endsWith('-C')).reduce((s, x) => s + x.costUsd[m], 0)) }
  }
  return {
    assumptions: [
      'image tokens = ceil(w*h/750) after the API downscale; every picture here is <= 1560 px on its long edge and <= 1.15 MP, so neither the legacy 1568-px rule nor the 2576-px high-res tier downscales it and both give the same count',
      'text tokens = (system + question + schema characters) / 3.5, plus 400 tokens per request for picture labels, the structured-output preamble and framing',
      `output = ${EXPECTED_OUTPUT_TOKENS} tokens per single question (~150 of JSON plus adaptive thinking at the model's default effort; the HOUSE_TRIAGE adapter sets no effort), +250 per extra question in a batched cascade request`,
      'prices: HOUSE_READER_PRICES (apps/analyzer-api/src/house-reader-spend.ts, list prices of 2026-11-03), no prompt caching, no batch discount',
      `reserved = what the spend books hold back before the request leaves: 5000 tokens per picture, text at 2.5 chars/token + 1500, and the ${TRIAGE_MAX_OUTPUT_TOKENS}-token answer ceiling; settled down to the reported usage afterwards`,
      'count_tokens was not called: there is no key in this environment',
    ],
    rows,
    totals,
    cascade: { perSheet, costUsd: cascadeCost, rule: 'one request per sheet with all its questions; then one C request for each question left UNKNOWN (best: none, worst: all)' },
  }
}

export function estimateTable(e: Estimates): string {
  const m1 = ESTIMATE_MODELS[0]
  const m2 = ESTIMATE_MODELS[1]
  const lines = ['| request | pictures (w x h, bytes) | payload bytes | image tok | text tok | in tok | out tok | sonnet-5-5 USD | haiku-5-5 USD | reserved sonnet USD |', '|---|---|---|---|---|---|---|---|---|---|']
  for (const r of e.rows) lines.push(`| ${r.request} | ${r.pictures.map((p) => `${p.role} ${p.width}x${p.height} ${p.bytes}`).join('; ')} | ${r.payloadBytes} | ${r.imageTokens} | ${r.textTokens} | ${r.inputTokens} | ${r.outputTokens} | ${r.costUsd[m1].toFixed(5)} | ${r.costUsd[m2].toFixed(5)} | ${r.reservedUsd[m1].toFixed(4)} |`)
  lines.push('', '| model | all B | all C | B + C (experiment) | reserved, B + C | cascade best | cascade worst |', '|---|---|---|---|---|---|---|')
  for (const m of [m1, m2]) lines.push(`| ${m} | ${e.totals[m].B.toFixed(4)} | ${e.totals[m].C.toFixed(4)} | ${e.totals[m].BC.toFixed(4)} | ${e.totals[m].reservedBC.toFixed(4)} | ${e.cascade.costUsd[m].best.toFixed(4)} | ${e.cascade.costUsd[m].worst.toFixed(4)} |`)
  return lines.join('\n')
}

// --- prepare ---------------------------------------------------------------------------------------------------------

export function writePayloads(input: { set: QuestionSet; questionsSha256: string; originals: Record<string, Uint8Array>; sheets: Manifest['sheets']; out: string; repoRoot: string }): { manifest: Manifest; requests: LoadedRequest[] } {
  if (inside(input.repoRoot, input.out)) throw new Error(`PRIVATE_DIR_INSIDE_REPOSITORY: the payload directory holds a publisher's pictures and must be outside the repository (${input.out})`)
  const { requests, files } = prepareRequests(input.set, input.originals)
  mkdirSync(join(input.out, 'pictures'), { recursive: true })
  mkdirSync(join(input.out, 'requests'), { recursive: true })
  for (const [file, bytes] of Object.entries(files)) writeFileSync(join(input.out, file), bytes)
  const prepared: PreparedRequest[] = requests.map(({ bytes: _bytes, ...rest }) => rest)
  for (const r of prepared) writeJson(join(input.out, 'requests', `${r.id}.json`), r)
  const estimates = estimate(input.set, prepared)
  const manifest: Manifest = { schema: 'buildapp.evidence-questions-payloads', harnessVersion: HARNESS_VERSION, questionsSha256: input.questionsSha256, sheets: input.sheets, requests: prepared, estimates }
  writeJson(join(input.out, 'manifest.json'), manifest)
  writeFileSync(join(input.out, 'estimate.md'), `${estimateTable(estimates)}\n\nAssumptions:\n${estimates.assumptions.map((a) => `- ${a}`).join('\n')}\n`)
  return { manifest, requests }
}

export function loadPayloads(dir: string, questionsSha256: string): { manifest: Manifest; requests: LoadedRequest[]; metricBySheet: Record<string, MetricEvidence | null> } {
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as Manifest
  if (manifest.questionsSha256 !== questionsSha256) throw new Error(`PAYLOADS_FOR_ANOTHER_QUESTION_SET: the payloads were prepared from questions ${manifest.questionsSha256.slice(0, 12)}, the sealed set is ${questionsSha256.slice(0, 12)}`)
  if (manifest.harnessVersion !== HARNESS_VERSION) throw new Error(`PAYLOADS_FROM_ANOTHER_HARNESS: prepared by ${manifest.harnessVersion}, this is ${HARNESS_VERSION}; prepare again`)
  const requests = manifest.requests.map((r) => loadRequest(r, (file) => new Uint8Array(readFileSync(join(dir, file)))))
  const metricBySheet: Record<string, MetricEvidence | null> = {}
  for (const [sheet, s] of Object.entries(manifest.sheets)) metricBySheet[sheet] = s.metricEvidence && existsSync(s.metricEvidence) ? (JSON.parse(readFileSync(s.metricEvidence, 'utf8')) as MetricEvidence) : null
  return { manifest, requests, metricBySheet }
}

// --- running ---------------------------------------------------------------------------------------------------------

export const RUN_EXIT = { DONE: 0, INCOMPLETE: 2, NOT_STARTED: 3 } as const

type CampaignLedger = { schema: string; limitUsd: number; entries: Array<Record<string, unknown>> } & Record<string, unknown>
const campaignSpentUsd = (l: CampaignLedger): number => round6(l.entries.reduce((s, e) => s + (typeof e.countedUsd === 'number' ? e.countedUsd : 0), 0))

export type RunOptions = {
  mode: 'replay' | 'live'
  payloads: string
  questionsPath: string
  sealPath: string
  out: string
  repoRoot: string
  /** Request ids or question ids to keep (e.g. Q3, Q4-C); all when empty. */
  only?: string[]
  // replay
  fixtures?: string
  // live
  apiKey?: string
  model?: string
  books?: string
  ledger?: string
  maxUsd?: number
  dryRun?: boolean
  timeoutMs?: number
  /** For a test with a stand-in client: replaces the SDK client. Never set by the command line. */
  createClient?: (apiKey: string, limits: { timeoutMs: number }) => Promise<AnthropicMessagesLike>
  log?: (line: string) => void
}

export type RunRecord = { exitCode: number; code: string | null; message?: string; summary?: ReturnType<typeof summarise>; observations?: Observation[]; plan?: Array<{ request: string; reservedUsd: number; cached: boolean }>; booked?: Record<string, unknown> }

function dirCache(dir: string): AnswerCache {
  mkdirSync(dir, { recursive: true })
  return {
    get: (key) => (existsSync(join(dir, `${key}.json`)) ? (JSON.parse(readFileSync(join(dir, `${key}.json`), 'utf8')) as { output: unknown; usage: Record<string, unknown> }) : null),
    put: (key, value) => writeJson(join(dir, `${key}.json`), value),
  }
}

export async function executeRun(o: RunOptions): Promise<RunRecord> {
  const log = o.log ?? ((line: string) => console.log(line))
  for (const [name, path] of [['out', o.out], ...(o.mode === 'live' ? [['books', o.books ?? '']] : [])] as const) {
    if (!path || inside(o.repoRoot, path)) return { exitCode: RUN_EXIT.NOT_STARTED, code: 'PRIVATE_DIR_INSIDE_REPOSITORY', message: `--${name} must be a directory outside the repository` }
  }
  const { set, sha256: questionsSha256 } = loadSealedQuestions(o.questionsPath, o.sealPath)
  const loaded = loadPayloads(o.payloads, questionsSha256)
  const keep = (r: PreparedRequest): boolean => !o.only || o.only.length === 0 || o.only.includes(r.id) || o.only.includes(r.questionId)
  const requests = loaded.requests.filter(keep)
  mkdirSync(o.out, { recursive: true })
  const finish = (rec: RunRecord): RunRecord => {
    if (rec.observations) {
      writeJson(join(o.out, 'observations.json'), rec.observations)
      writeJson(join(o.out, 'summary.json'), rec.summary)
    }
    writeJson(join(o.out, 'run.json'), { schema: 'buildapp.evidence-questions-run', harnessVersion: HARNESS_VERSION, mode: o.mode, questionsSha256, payloads: o.payloads, at: new Date().toISOString(), exitCode: rec.exitCode, code: rec.code, message: rec.message ?? null, plan: rec.plan ?? null, booked: rec.booked ?? null, summary: rec.summary?.byVariant ?? null })
    return rec
  }

  if (o.mode === 'replay') {
    // no books, no ledger: replay costs nothing and records nothing as spent, whatever paths it was handed
    if (!o.fixtures) return finish({ exitCode: RUN_EXIT.NOT_STARTED, code: 'NO_FIXTURES', message: '--fixtures is required in replay mode' })
    const fixture = JSON.parse(readFileSync(o.fixtures, 'utf8')) as FixtureFile
    if (fixture.questionsSha256 !== questionsSha256) return finish({ exitCode: RUN_EXIT.NOT_STARTED, code: 'FIXTURE_FOR_ANOTHER_QUESTION_SET', message: `the fixture answers questions ${String(fixture.questionsSha256).slice(0, 12)}, the sealed set is ${questionsSha256.slice(0, 12)}` })
    const reader = fixtureReader(fixture)
    const { observations, stoppedBy } = await askAll({ set, requests, reader, model: fixture.recordedFrom.model, metricBySheet: loaded.metricBySheet })
    const summary = summarise(observations)
    return finish({ exitCode: stoppedBy ? RUN_EXIT.INCOMPLETE : RUN_EXIT.DONE, code: stoppedBy?.reason ?? null, observations, summary })
  }

  // --- live ----------------------------------------------------------------------------------------------------------
  const apiKey = o.apiKey ?? ''
  const model = o.model ?? 'claude-sonnet-5-5'
  const price = HOUSE_READER_PRICES[model]
  if (!price) return finish({ exitCode: RUN_EXIT.NOT_STARTED, code: 'NO_PRICE', message: `${model} has no list price in HOUSE_READER_PRICES: a request that cannot be reserved for is not sent` })
  let campaign: CampaignLedger
  try {
    campaign = JSON.parse(readFileSync(o.ledger ?? '', 'utf8')) as CampaignLedger
    if (campaign.schema !== 'buildapp.ai-spend-ledger' || !Array.isArray(campaign.entries) || typeof campaign.limitUsd !== 'number') throw new Error('not a campaign spend ledger')
  } catch (e) {
    return finish({ exitCode: RUN_EXIT.NOT_STARTED, code: 'CAMPAIGN_LEDGER_UNREADABLE', message: String((e as Error).message).slice(0, 200) })
  }
  const floorUsd = campaignSpentUsd(campaign)
  const books = o.books as string
  const unopened = (): boolean => !['house-reader-spend.json', 'house-reader-spend.json.bak', 'house-reader-spend.journal.jsonl'].some((n) => existsSync(join(books, n)))
  // --max-usd is what THIS run may add to the books; the campaign ledger's limit stays the cumulative ceiling
  const limits = { ...DEFAULT_SPEND_LIMITS, maxUsd: campaign.limitUsd }
  let ledger: ReturnType<typeof openSpendLedger>
  let beforeUsd: number
  try {
    beforeUsd = unopened() ? floorUsd : openSpendLedger({ dir: books, limits, openingUsd: floorUsd }).read().cumulativeUsd
    limits.maxUsd = round6(Math.min(beforeUsd + Math.max(0, o.maxUsd ?? 0), campaign.limitUsd))
    ledger = openSpendLedger({ dir: books, limits, openingUsd: floorUsd })
  } catch (e) {
    return finish({ exitCode: RUN_EXIT.NOT_STARTED, code: e instanceof SpendLedgerError ? 'BOOKS_UNREADABLE' : 'BOOKS_UNAVAILABLE', message: String((e as Error).message).slice(0, 300) })
  }
  if (beforeUsd + 1e-6 < floorUsd) return finish({ exitCode: RUN_EXIT.NOT_STARTED, code: 'BOOKS_BEHIND_CAMPAIGN_LEDGER', message: `these books hold $${beforeUsd.toFixed(6)} and the campaign's ledger $${floorUsd.toFixed(6)}: use the directory earlier runs used, or an empty one` })

  const ceilingUsd = limits.maxUsd
  const cache = dirCache(join(o.out, 'answer-cache'))
  const plan = requests.map((r) => ({ request: r.id, reservedUsd: reservationUsd(toVisionRequest(r), TRIAGE_MAX_OUTPUT_TOKENS, price), cached: cache.get(answerCacheKey(r, model)) !== null }))
  const toReserve = round6(plan.filter((p) => !p.cached).reduce((s, p) => s + p.reservedUsd, 0))
  const remaining = round6(ceilingUsd - beforeUsd)
  log(`plan: ${plan.length} requests (${plan.filter((p) => p.cached).length} answered from the cache), model ${model}, purpose HOUSE_TRIAGE`)
  for (const p of plan) log(`  ${p.request.padEnd(8)} ${p.cached ? 'cached' : `reserve $${p.reservedUsd.toFixed(4)}`}`)
  log(`books $${beforeUsd.toFixed(6)} (campaign ledger $${floorUsd.toFixed(6)}, limit $${campaign.limitUsd}); this run may add $${remaining.toFixed(4)} (ceiling $${ceilingUsd.toFixed(6)}); the plan reserves at most $${toReserve.toFixed(4)} in all, one request at a time`)
  if (o.dryRun) return finish({ exitCode: RUN_EXIT.NOT_STARTED, code: 'DRY_RUN', message: 'dry run: nothing was asked', plan })
  // the plan can be read without a key; nothing is asked without one
  if (!apiKey) return finish({ exitCode: RUN_EXIT.NOT_STARTED, code: 'NO_CREDENTIALS', message: 'ANTHROPIC_API_KEY is not set in this terminal: nothing is asked and nothing is booked', plan })
  if (toReserve > remaining + 1e-9) return finish({ exitCode: RUN_EXIT.NOT_STARTED, code: 'PLAN_EXCEEDS_BUDGET', message: `the plan reserves up to $${toReserve.toFixed(4)} and $${remaining.toFixed(4)} is left: narrow it with --only`, plan })

  const calls: Array<Record<string, unknown>> = []
  // purpose HOUSE_TRIAGE is the billing class: the adapter sends it to the TRIAGE model slot, which is the model asked for
  const adapter = anthropicStructuredVision({
    apiKey,
    model,
    triageModel: model,
    triageMaxTokens: TRIAGE_MAX_OUTPUT_TOKENS,
    timeoutMs: o.timeoutMs ?? 120_000,
    createClient:
      o.createClient ??
      (async (key, { timeoutMs }) => {
        const mod = (await import('@anthropic-ai/sdk')) as unknown as { default: new (x: { apiKey: string; maxRetries: number; timeout: number; baseURL: string }) => AnthropicMessagesLike }
        const client = new mod.default({ apiKey: key, maxRetries: 0, timeout: timeoutMs, baseURL: 'https://api.anthropic.com' })
        return {
          messages: {
            create: async (body, options) => {
              const started = Date.now()
              try {
                const r = (await client.messages.create(body, options)) as Awaited<ReturnType<AnthropicMessagesLike['messages']['create']>> & { model?: string; id?: string }
                calls.push({ requested: body.model, served: r.model ?? null, id: r.id ?? null, stop: r.stop_reason ?? null, usage: r.usage ?? null, ms: Date.now() - started })
                return r
              } catch (e) {
                const err = e as { status?: number; name?: string; message?: string }
                calls.push({ requested: body.model, failed: true, status: err.status ?? null, name: err.name ?? null, message: String(err.message ?? '').slice(0, 200), ms: Date.now() - started })
                throw e
              }
            },
          },
        }
      }),
  })
  const reader = spendGuardedStructuredVision(adapter, ledger, { limits })
  const { observations, stoppedBy } = await askAll({ set, requests, reader, model, metricBySheet: loaded.metricBySheet, cache, onRecord: (x) => log(`  ${x.requestId.padEnd(8)} ${x.error ? `ERROR ${x.error.reason}` : `${x.score.result} / ${x.verifiedOnOriginal.status}`}`) })
  const summary = summarise(observations)
  // what was answered, filed by request key, so the same payloads replay offline later
  const recorded: Record<string, unknown> = {}
  for (const x of observations) if (!x.error) recorded[x.provenance.requestKey] = x.output
  writeJson(join(o.out, 'recorded-fixture.json'), { schema: 'buildapp.evidence-questions-fixture', kind: 'recorded', synthetic: false, note: `answers recorded from ${model} by run.ts; observations, not facts`, questionsSha256, recordedFrom: { model, triageModel: model }, hints: {}, answers: recorded })
  writeJson(join(o.out, 'calls.json'), calls)

  let afterUsd = beforeUsd
  try {
    if (!unopened()) afterUsd = ledger.read().cumulativeUsd
  } catch (e) {
    return finish({ exitCode: RUN_EXIT.INCOMPLETE, code: 'BOOKS_UNREADABLE_AFTER_RUN', message: String((e as Error).message).slice(0, 200), observations, summary, plan })
  }
  const bookedUsd = round6(afterUsd - beforeUsd)
  const booked: Record<string, unknown> = { booksBeforeUsd: beforeUsd, booksAfterUsd: afterUsd, bookedUsd }
  if (bookedUsd > 0) {
    const usage = calls.reduce<{ inputTokens: number; outputTokens: number }>((s, c) => {
      const u = c.usage as { input_tokens?: number; output_tokens?: number } | null | undefined
      return { inputTokens: s.inputTokens + (u?.input_tokens ?? 0), outputTokens: s.outputTokens + (u?.output_tokens ?? 0) }
    }, { inputTokens: 0, outputTokens: 0 })
    campaign.entries.push({
      at: new Date().toISOString(),
      stage: 'S5311 evidence questions (SDK)',
      what: `HOUSE_TRIAGE x${calls.length}: ${[...new Set(requests.map((r) => r.id))].join(' ')}`,
      modelRequested: model,
      modelsReturned: [...new Set(calls.map((c) => c.served).filter((m): m is string => typeof m === 'string'))],
      authCategory: 'api-key',
      status: stoppedBy ? `INCOMPLETE ${stoppedBy.reason}` : 'OK',
      estimatedCostUsd: bookedUsd,
      countedUsd: bookedUsd,
      usage,
      note: `counted from the API's usage at list prices by the product's spend books${calls.some((c) => c.failed === true) ? '; a request failed in a way that may have been billed, so its reservation stands' : ''}; billing UNCONFIRMED until the provider's console shows it`,
    })
    writeJson(o.ledger as string, campaign)
    booked.campaignLedgerAfterUsd = campaignSpentUsd(campaign)
  }
  return finish({ exitCode: stoppedBy ? RUN_EXIT.INCOMPLETE : RUN_EXIT.DONE, code: stoppedBy?.reason ?? null, message: stoppedBy?.message, observations, summary, plan, booked })
}
