/**
 * v3.54.5 — enters the final host E2E's requests into the campaign books and ledger. The host kept its own books (opened
 * at the campaign's balance, `--spent-usd`); each SETTLED line of its journal is one billed request, booked here once.
 *   npx vite-node research/source-to-model/v3545/book-host.ts -- <host books journal.jsonl>
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { DEFAULT_SPEND_LIMITS, openSpendLedger } from '../../../apps/analyzer-api/src/house-reader-spend.js'

const LEDGER = 'research/ai-assist/spend-ledger-v3545.json'
const journal = process.argv.slice(2).filter((a) => a !== '--')[0]
const lines = readFileSync(journal, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as { event: string; id?: string; at: string; model?: string; usd?: number; inputTokens?: number; outputTokens?: number; note?: string })
const ledger = JSON.parse(readFileSync(LEDGER, 'utf8')) as { entries: Array<Record<string, unknown>> }
const done = new Set(ledger.entries.filter((e) => e.phase === 'host-e2e').map((e) => e.requestId))
const books = openSpendLedger({ dir: '/home/user/rd/v3542/books', limits: { ...DEFAULT_SPEND_LIMITS, maxUsd: 24.11036, maxRequestsPerDay: 600 }, openingUsd: 4.11036 })
let n = 0
for (const l of lines.filter((x) => x.event === 'SETTLED' && !done.has(`host:${x.id}`))) {
  const usd = l.usd ?? 0
  const r = books.reserve('CONSULTATION', l.model ?? 'claude-sonnet-5-5', usd)
  books.settle({ id: r.id, purpose: 'CONSULTATION', model: l.model ?? 'claude-sonnet-5-5', reservedUsd: r.reservedUsd }, { usd, inputTokens: l.inputTokens ?? 0, outputTokens: l.outputTokens ?? 0 }, `host e2e: ${l.note ?? ''}`)
  ledger.entries.push({ at: l.at, phase: 'host-e2e', house: '-', variant: 'HOST', note: `final host E2E (build of 627e4f1): ${l.note ?? ''}`, model: l.model, requestId: `host:${l.id}`, inputTokens: l.inputTokens ?? 0, outputTokens: l.outputTokens ?? 0, costUsd: usd })
  n += 1
}
const total = ledger.entries.reduce((s, e) => s + Number(e.costUsd), 0)
if (existsSync(LEDGER)) writeFileSync(LEDGER, `${JSON.stringify({ ...ledger, totalUsd: Math.round(total * 1e6) / 1e6, requests: ledger.entries.length }, null, 1)}\n`)
process.stdout.write(`booked ${n} host request(s); campaign ledger ${Math.round(total * 1e6) / 1e6} USD\n`)
