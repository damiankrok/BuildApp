/**
 * v3.54.17 (from v3.54.16) — enters the final host E2E's billed requests into the stage's ledger (research/ai-assist/spend-ledger-v35417.json).
 * The host kept its own books, opened at the stage ledger's balance (`--spent-usd`) under the stage ceiling
 * (`--max-usd` 28.854612); each SETTLED line of its journal is one billed request, booked here once (by its id).
 * A FAILED line kept its reservation as spent on the host, and is booked at that reservation.
 *   npx vite-node research/source-to-model/v35417/book-host.ts -- <host books journal.jsonl> <commit of the build>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { LEDGER, OPENING_USD, loadLedger } from './ledger.js'

const [journal, commit] = process.argv.slice(2).filter((a) => a !== '--')
if (!commit) throw new Error('give the journal and the commit of the build')
type Line = { event: string; id?: string; at: string; model?: string; usd?: number; reservedUsd?: number; inputTokens?: number; outputTokens?: number; cacheReadInputTokens?: number; cacheCreation5mInputTokens?: number; cacheCreation1hInputTokens?: number; note?: string }
const lines = readFileSync(journal, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Line)
const ledger = loadLedger()
const done = new Set(ledger.entries.filter((e) => e.phase === 'host-e2e').map((e) => e.note.split(' ')[0]))
let n = 0
for (const l of lines.filter((x) => (x.event === 'SETTLED' || x.event === 'FAILED') && !done.has(`host:${x.id}`))) {
  const usd = l.event === 'SETTLED' ? l.usd ?? 0 : l.reservedUsd ?? l.usd ?? 0
  ledger.entries.push({ at: l.at, phase: 'host-e2e', house: '-', variant: 'HOST', note: `host:${l.id} final host E2E (build of ${commit}): ${l.note ?? ''}`, model: l.model ?? '-', reservedUsd: l.reservedUsd ?? usd, costUsd: usd, inputTokens: l.inputTokens ?? 0, outputTokens: l.outputTokens ?? 0, ...(l.cacheReadInputTokens !== undefined ? { cacheReadInputTokens: l.cacheReadInputTokens } : {}), ...(l.cacheCreation5mInputTokens !== undefined ? { cacheCreation5mInputTokens: l.cacheCreation5mInputTokens } : {}), ...(l.cacheCreation1hInputTokens !== undefined ? { cacheCreation1hInputTokens: l.cacheCreation1hInputTokens } : {}), status: l.event === 'SETTLED' ? 'SETTLED' : 'FAILED_KEPT_RESERVED' })
  n += 1
}
ledger.totalUsd = Math.round((OPENING_USD + ledger.entries.reduce((s, e) => s + e.costUsd, 0)) * 1e6) / 1e6
ledger.stageSpentUsd = Math.round((ledger.totalUsd - OPENING_USD) * 1e6) / 1e6
ledger.requests = ledger.entries.filter((e) => e.status !== 'NOT_SENT').length
writeFileSync(LEDGER, `${JSON.stringify(ledger, null, 1)}\n`)
process.stdout.write(`booked ${n} host request(s); stage ${ledger.stageSpentUsd} USD of the stage pool, books ${ledger.totalUsd}\n`)
