/**
 * v3.54.9 (from v3.54.8) — enters the final host E2E's requests into the campaign books and ledger. The host kept its own books (opened
 * at the campaign's balance, `--spent-usd`); each SETTLED line of its journal is one billed request, booked here once.
 *   npx vite-node research/source-to-model/v35410/book-host.ts -- <host books journal.jsonl> <commit of the build>
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { DEFAULT_SPEND_LIMITS, openSpendLedger } from '../../../apps/analyzer-api/src/house-reader-spend.js'

const LEDGER = 'research/ai-assist/spend-ledger-v35410.json'
const [journal, commit] = process.argv.slice(2).filter((a) => a !== '--')
if (!commit) throw new Error('give the journal and the commit of the build')
const lines = readFileSync(journal, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as { event: string; id?: string; at: string; model?: string; usd?: number; inputTokens?: number; outputTokens?: number; note?: string })
const ledger = (existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : { schema: 'buildapp.ai-spend-ledger.v35410', currency: 'USD', costBasis: 'USAGE_PRICED', billing: 'NOT_RECONCILED_WITH_INVOICE', openingUsd: 23.2994, openingNote: 'the cumulative books as v3.54.9 left them (23.2994 USD); this ledger lists the v3.54.10 requests only; ceiling 24.11036 USD cumulative', entries: [] }) as { entries: Array<Record<string, unknown>> }
const done = new Set(ledger.entries.filter((e) => e.phase === 'host-e2e').map((e) => e.requestId))
const books = openSpendLedger({ dir: '/home/user/rd/v3542/books', limits: { ...DEFAULT_SPEND_LIMITS, maxUsd: 24.11036, maxRequestsPerDay: 600 }, openingUsd: 4.11036 })
let n = 0
for (const l of lines.filter((x) => x.event === 'SETTLED' && !done.has(`host:${x.id}`))) {
  const usd = l.usd ?? 0
  const r = books.reserve('CONSULTATION', l.model ?? 'claude-sonnet-5-5', usd)
  books.settle({ id: r.id, purpose: 'CONSULTATION', model: l.model ?? 'claude-sonnet-5-5', reservedUsd: r.reservedUsd }, { usd, inputTokens: l.inputTokens ?? 0, outputTokens: l.outputTokens ?? 0 }, `host e2e: ${l.note ?? ''}`)
  ledger.entries.push({ at: l.at, phase: 'host-e2e', house: '-', variant: 'HOST', note: `final host E2E (build of ${commit}): ${l.note ?? ''}`, model: l.model, requestId: `host:${l.id}`, inputTokens: l.inputTokens ?? 0, outputTokens: l.outputTokens ?? 0, costUsd: usd })
  n += 1
}
const total = ledger.entries.reduce((s, e) => s + Number(e.costUsd), 0)
writeFileSync(LEDGER, `${JSON.stringify({ ...ledger, totalUsd: Math.round(total * 1e6) / 1e6, requests: ledger.entries.length }, null, 1)}\n`)
process.stdout.write(`booked ${n} host request(s); campaign ledger ${Math.round(total * 1e6) / 1e6} USD\n`)
