/**
 * v3.54.1: the live campaign's plumbing, checked without a key and without the network. The product's real adapter
 * (`anthropicStructuredVision`) is driven over a stand-in client (`createClient`), so everything between the request
 * and the books is the code the campaign runs: picture packing, structured-output request, usage, request id, stop
 * reason, refusal by name, the spend books' reservation and settlement, the recorder, the campaign ledger, the replay.
 *
 *   npx vite-node research/source-to-model/v3541/selfcheck.ts -- <work dir> <house> <source-package.json> <cache dir> <recorded description.json>
 * Exit 0 when every check holds; prints one line per check. Sends nothing; spends nothing.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileByteCache } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import { HOUSE_TRIAGE_SYSTEM, anthropicStructuredVision, fixtureStructuredVision } from '@buildapp/source-vision'
import type { AnthropicMessagesLike } from '@buildapp/source-vision'
import { DescribedRefusal, identityOf, runDescribedAnalysis } from '@buildapp/analysis-service'
import { describeHouses } from './campaign-run.js'
import { CAMPAIGN_MODELS } from './campaign.js'

const [work, house, pkgPath, cacheDir, descriptionPath] = process.argv.slice(2).filter((a) => a !== '--')
const SECRET = 'sk-ant-selfcheck-0000-NOT-A-KEY-7f3a9c'
const results: Array<{ check: string; ok: boolean; detail?: unknown }> = []
const check = (name: string, ok: boolean, detail?: unknown): void => void results.push({ check: name, ok, ...(detail !== undefined ? { detail } : {}) })

type Mode = 'GOOD' | 'NOT_JSON' | 'TRANSPORT_WITH_KEY'
function standIn(mode: Mode, calls: Array<Record<string, unknown>>): () => Promise<AnthropicMessagesLike> {
  const description = readFileSync(descriptionPath, 'utf8')
  return async () => ({
    messages: {
      create: async (body: Record<string, unknown>) => {
        calls.push(body)
        const triage = body.system === HOUSE_TRIAGE_SYSTEM
        if (mode === 'TRANSPORT_WITH_KEY') throw Object.assign(new Error(`socket hang up (Authorization: Bearer ${SECRET})`), { status: undefined })
        const content = (body.messages as Array<{ content: Array<{ type: string; text?: string }> }>)[0].content
        const numbers = content.filter((c) => c.type === 'text' && /^Picture \d+:$/.test(c.text ?? '')).map((c) => Number(/\d+/.exec(c.text as string)?.[0]))
        const text = mode === 'NOT_JSON' && !triage ? 'I cannot describe this house as JSON' : triage ? JSON.stringify({ pictures: numbers.map((n) => ({ picture: n, kind: 'FLOOR_PLAN', duplicateOf: 0 })) }) : description
        return { content: [{ type: 'thinking' }, { type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 12_000, output_tokens: 3_000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, _request_id: `req_selfcheck_${calls.length}` }
      },
    },
  })
}
const reader = (mode: Mode, calls: Array<Record<string, unknown>>) => anthropicStructuredVision({ apiKey: SECRET, baseURL: 'https://api.anthropic.com', model: CAMPAIGN_MODELS.description, triageModel: CAMPAIGN_MODELS.triage, createClient: standIn(mode, calls) })
const jsonl = (p: string): Array<Record<string, unknown>> => (existsSync(p) ? readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>) : [])
const ledgerOf = (p: string): { entries: Array<Record<string, unknown>>; totalUsd: number; costBasis: string; priceSource: { readOn: string } } => JSON.parse(readFileSync(p, 'utf8'))
const allFiles = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? allFiles(join(dir, f)) : [join(dir, f)]))
const silent = (): void => undefined

async function main(): Promise<number> {
  rmSync(work, { recursive: true, force: true })
  mkdirSync(work, { recursive: true })
  const houses = [{ house, pkgPath, cacheDir }]

  // 1 — a good answer, priced and booked
  const calls1: Array<Record<string, unknown>> = []
  const ledger1 = join(work, 'ledger-1.json')
  const [o1] = await describeHouses({ houses, outRoot: join(work, 'good'), booksDir: join(work, 'books-1'), ledgerPath: ledger1, phase: 'selfcheck', maxUsd: 5, live: reader('GOOD', calls1), secret: SECRET, log: silent })
  const out1 = join(work, 'good', house)
  const answers = JSON.parse(readFileSync(join(out1, 'answers.json'), 'utf8')) as Record<string, unknown>
  const raw1 = jsonl(join(out1, 'raw.jsonl'))
  const l1 = ledgerOf(ledger1)
  const triageUsd = (12_000 * 0.1 + 3_000 * 0.5) / 1e6
  const describeUsd = (12_000 * 2 + 3_000 * 10) / 1e6
  check('two requests sent (triage, description), each to its model', calls1.length === 2 && calls1[0].model === CAMPAIGN_MODELS.triage && calls1[1].model === CAMPAIGN_MODELS.description, calls1.map((c) => c.model))
  check('structured output requested, effort only on the description', !!(calls1[1].output_config as { format?: unknown }).format && (calls1[1].output_config as { effort?: string }).effort === 'medium' && (calls1[0].output_config as { effort?: string }).effort === undefined)
  check('two answers recorded in the fixture format', Object.keys(answers).length === 2)
  check('raw trace keeps request id, usage and the raw text', raw1.length === 2 && raw1.every((r) => r.status === 'ANSWERED' && typeof r.raw === 'string' && (r.usage as { requestId?: string }).requestId?.startsWith('req_selfcheck_') === true))
  check('ledger: USD at list prices, request ids, price date', l1.entries.length === 2 && Math.abs((l1.entries[0].costUsd as number) - triageUsd) < 1e-9 && Math.abs((l1.entries[1].costUsd as number) - describeUsd) < 1e-9 && l1.costBasis === 'USAGE_PRICED' && l1.priceSource.readOn === '2026-11-16' && l1.entries.every((e) => typeof e.requestId === 'string'), l1.entries.map((e) => e.costUsd))
  check('books settled to the usage (no reservation left standing)', Math.abs((l1.entries[1].booksCumulativeUsd as number) - (triageUsd + describeUsd)) < 1e-9, l1.entries.map((e) => e.booksCumulativeUsd))
  check('the house has an outcome on disk', existsSync(join(out1, 'run.json')), o1)

  // 2 — the recorded answers replay offline through the product's own replayer to the same result
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as SourcePackage
  const run1 = JSON.parse(readFileSync(join(out1, 'run.json'), 'utf8')) as { outcome: string; code?: string; hashes?: { model: string; scene: string } }
  let replay: { outcome: string; code?: string; hashes?: { model: string; scene: string } }
  try {
    const r = await runDescribedAnalysis({ pkg, cache: fileByteCache(cacheDir), reader: fixtureStructuredVision(answers, { model: CAMPAIGN_MODELS.description, triageModel: CAMPAIGN_MODELS.triage }), identity: identityOf(pkg) })
    replay = { outcome: 'MODEL', hashes: { model: r.result.modelSha256, scene: r.result.sceneSha256 } }
  } catch (e) {
    replay = { outcome: 'NO_MODEL', code: e instanceof DescribedRefusal ? e.code : 'ERROR' }
  }
  check('offline replay = live result (outcome, model and scene hash)', replay.outcome === run1.outcome && replay.code === run1.code && replay.hashes?.model === run1.hashes?.model && replay.hashes?.scene === run1.hashes?.scene, { live: run1.outcome, replay: replay.outcome, code: run1.code })

  // 3 — a house run again asks nothing: its recorded answers are used
  rmSync(join(out1, 'run.json'))
  const calls3: Array<Record<string, unknown>> = []
  await describeHouses({ houses, outRoot: join(work, 'good'), booksDir: join(work, 'books-1'), ledgerPath: ledger1, phase: 'selfcheck', maxUsd: 5, live: reader('GOOD', calls3), secret: SECRET, log: silent })
  check('a house run again sends nothing and books nothing', calls3.length === 0 && ledgerOf(ledger1).entries.length === 2 && jsonl(join(out1, 'raw.jsonl')).filter((r) => r.status === 'REPLAYED_FROM_RECORD').length === 2)

  // 4 — the ceiling stops before anything is sent
  const calls4: Array<Record<string, unknown>> = []
  const [o4] = await describeHouses({ houses, outRoot: join(work, 'budget'), booksDir: join(work, 'books-4'), ledgerPath: join(work, 'ledger-4.json'), phase: 'selfcheck', maxUsd: 0.001, live: reader('GOOD', calls4), secret: SECRET, log: silent })
  check('a ceiling below one reservation sends nothing and stops the campaign', calls4.length === 0 && o4.outcome === 'BUDGET_STOP' && !existsSync(join(work, 'budget', house, 'run.json')) && existsSync(join(work, 'budget', house, 'budget-stop.json')), o4)

  // 5 — an answer that came but is not JSON: refused by name, booked at its usage
  const calls5: Array<Record<string, unknown>> = []
  const ledger5 = join(work, 'ledger-5.json')
  const [o5] = await describeHouses({ houses, outRoot: join(work, 'notjson'), booksDir: join(work, 'books-5'), ledgerPath: ledger5, phase: 'selfcheck', maxUsd: 5, live: reader('NOT_JSON', calls5), secret: SECRET, log: silent })
  const l5 = ledgerOf(ledger5)
  check('an unusable answer is refused by name and booked at its usage', o5.outcome === 'NO_MODEL' && o5.code === 'READER_UNAVAILABLE' && l5.entries[1]?.status === 'NO_ANSWER' && Math.abs((l5.entries[1]?.costUsd as number) - describeUsd) < 1e-9 && Math.abs((l5.entries[1]?.booksCumulativeUsd as number) - (triageUsd + describeUsd)) < 1e-9, { o5, entry: l5.entries[1] })
  check('its raw text is kept for the record', jsonl(join(work, 'notjson', house, 'raw.jsonl')).some((r) => r.status === 'NO_ANSWER' && JSON.stringify(r.raw).includes('cannot describe')))

  // 6 — a transport failure whose message carries the key: the reservation stands, the key reaches no file
  const calls6: Array<Record<string, unknown>> = []
  const lines6: string[] = []
  const ledger6 = join(work, 'ledger-6.json')
  await describeHouses({ houses, outRoot: join(work, 'transport'), booksDir: join(work, 'books-6'), ledgerPath: ledger6, phase: 'selfcheck', maxUsd: 5, live: reader('TRANSPORT_WITH_KEY', calls6), secret: SECRET, log: (l) => lines6.push(l) })
  const l6 = ledgerOf(ledger6)
  check('a transport failure keeps its reservation in the books', l6.entries[0]?.status === 'TRANSPORT' && l6.entries[0]?.costUsd === null && (l6.entries[0]?.booksCumulativeUsd as number) > 0, l6.entries[0])
  const leaked = allFiles(work).filter((f) => readFileSync(f).includes(SECRET))
  check('the key appears in no file the campaign wrote', leaked.length === 0, leaked)
  check('the key appears in no line it printed', lines6.every((l) => !l.includes(SECRET)))

  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.check}${r.ok ? '' : `  ${JSON.stringify(r.detail ?? null).slice(0, 400)}`}`)
  console.log(JSON.stringify({ checks: results.length, failed: results.filter((r) => !r.ok).length, liveOutcome: run1.outcome, liveCode: run1.code ?? null }))
  return results.every((r) => r.ok) ? 0 : 1
}

main().then((code) => process.exit(code)).catch((e) => {
  console.error(e)
  process.exit(1)
})
