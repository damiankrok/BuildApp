/**
 * v3.54.17 R2 — one independent client of the research books, for the separate-process test
 * (`apps/analyzer-api/test/research-ledger-v35417.test.ts`) and the audit's probe. Sends nothing anywhere.
 *   npx vite-node research/source-to-model/v35417/ledger-client.ts -- <books.json> <attemptId> <usd> <RESERVE|RESERVE_SETTLE|SETTLE_TWICE> <opening> <ceiling> [<settleUsd>]
 */
import { LedgerRefusal, ledgerSpend } from './ledger.js'

const [path, attemptId, usd, mode, opening, ceiling, settleUsd] = process.argv.slice(2).filter((a) => a !== '--')
const spend = ledgerSpend({ phase: 'TEST', house: 'probe', variant: `client-${process.pid}` }, { path, openingUsd: Number(opening), ceilingUsd: Number(ceiling) })
const out: Record<string, unknown> = { pid: process.pid, attemptId }
try {
  const r = spend.reserveAttempt(attemptId, 'test-model', Number(usd), `controlled reservation ${attemptId}`)
  out.reserved = r.usd
  if (mode === 'RESERVE_SETTLE' || mode === 'SETTLE_TWICE') {
    const actual = { usd: Number(settleUsd ?? usd), inputTokens: 100, outputTokens: 10 }
    spend.settle(r, actual)
    if (mode === 'SETTLE_TWICE') {
      // a retry of the same attempt: reserve and settle again under the same id
      const again = spend.reserveAttempt(attemptId, 'test-model', Number(usd), `retry ${attemptId}`)
      spend.settle(again, actual)
    }
    out.settled = Number(settleUsd ?? usd)
  }
  out.accepted = true
} catch (e) {
  out.accepted = false
  out.refused = e instanceof LedgerRefusal
  out.why = (e as Error).message
}
process.stdout.write(`${JSON.stringify(out)}\n`)
