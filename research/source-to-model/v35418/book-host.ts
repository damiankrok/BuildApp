/**
 * v3.54.17 (from v3.54.16) — enters the final host E2E's billed requests into the stage's ledger (research/ai-assist/spend-ledger-v35417.json).
 * The host kept its own books, opened at the stage ledger's balance (`--spent-usd`) under the stage ceiling
 * (`--max-usd` 28.854612); each SETTLED line of its journal is one billed request, booked here once (by its id).
 * A FAILED line kept its reservation as spent on the host, and is booked at that reservation.
 *   npx vite-node research/source-to-model/v35417/book-host.ts -- <host books journal.jsonl> <commit of the build>
 */
import { readFileSync } from 'node:fs'
import { underLock } from '../v35417/ledger.js'
import { join } from 'node:path'
// v3.54.18: the one continuing ledger (R3's file, ceiling 68.542857 USD) — no new pool
const LEDGER = join(__dirname, '../../ai-assist/spend-ledger-v35417r3.json')

const [journal, commit] = process.argv.slice(2).filter((a) => a !== '--')
if (!commit) throw new Error('give the journal and the commit of the build')
type Line = { event: string; id?: string; at: string; model?: string; usd?: number; reservedUsd?: number; inputTokens?: number; outputTokens?: number; cacheReadInputTokens?: number; cacheCreation5mInputTokens?: number; cacheCreation1hInputTokens?: number; note?: string }
const lines = readFileSync(journal, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Line)
// v3.54.17 R2: read, booked and written inside the books' one lock (`ledger.ts` underLock), never beside a running client
const { n, stage, total } = underLock(LEDGER, (ledger) => {
const done = new Set(ledger.entries.filter((e) => e.phase === 'host-e2e').map((e) => e.note.split(' ')[0]))
let n = 0
for (const l of lines.filter((x) => (x.event === 'SETTLED' || x.event === 'FAILED') && !done.has(`host:${x.id}`))) {
  const usd = l.event === 'SETTLED' ? l.usd ?? 0 : l.reservedUsd ?? l.usd ?? 0
  ledger.entries.push({ at: l.at, phase: 'host-e2e', house: '-', variant: 'HOST', note: `host:${l.id} final host E2E (build of ${commit}): ${l.note ?? ''}`, model: l.model ?? '-', reservedUsd: l.reservedUsd ?? usd, costUsd: usd, inputTokens: l.inputTokens ?? 0, outputTokens: l.outputTokens ?? 0, ...(l.cacheReadInputTokens !== undefined ? { cacheReadInputTokens: l.cacheReadInputTokens } : {}), ...(l.cacheCreation5mInputTokens !== undefined ? { cacheCreation5mInputTokens: l.cacheCreation5mInputTokens } : {}), ...(l.cacheCreation1hInputTokens !== undefined ? { cacheCreation1hInputTokens: l.cacheCreation1hInputTokens } : {}), status: l.event === 'SETTLED' ? 'SETTLED' : 'FAILED_KEPT_RESERVED' })
  n += 1
}
const spent = ledger.entries.filter((e) => e.status !== 'RESERVED').reduce((s, e) => s + e.costUsd, 0)
return { n, stage: Math.round(spent * 1e6) / 1e6, total: Math.round((ledger.openingUsd + spent) * 1e6) / 1e6 }
})
process.stdout.write(`booked ${n} host request(s); stage ${stage} USD of the stage pool, books ${total}\n`)
