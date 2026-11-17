/**
 * v3.54.5 — enters into the books requests that were sent outside the run script (schema probes: a text-only request
 * with the tool attached, to learn whether the provider's strict grammar accepts it). They were billed, so they count.
 *   npx vite-node research/source-to-model/v3545/book-probe.ts -- <note> <inputTokens> <outputTokens> [<inputTokens> <outputTokens> …]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { DEFAULT_SPEND_LIMITS, HOUSE_READER_PRICES, openSpendLedger } from '../../../apps/analyzer-api/src/house-reader-spend.js'

const LEDGER = 'research/ai-assist/spend-ledger-v3545.json'
const model = 'claude-sonnet-5-5'
const price = HOUSE_READER_PRICES[model]
const args = process.argv.slice(2).filter((a) => a !== '--')
const note = args[0]
const books = openSpendLedger({ dir: '/home/user/rd/v3542/books', limits: { ...DEFAULT_SPEND_LIMITS, maxUsd: 24.11036, maxRequestsPerDay: 600 }, openingUsd: 4.11036 })
const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : { schema: 'buildapp.ai-spend-ledger.v3545', currency: 'USD', costBasis: 'USAGE_PRICED', billing: 'NOT_RECONCILED_WITH_INVOICE', priceSource: 'list prices as in apps/analyzer-api HOUSE_READER_PRICES: Sonnet 5.5 $2/$10 per MTok', openingUsd: 14.453496, openingNote: 'the cumulative books as v3.54.4 left them (14.453496 USD); this ledger lists the v3.54.5 requests only; ceiling 24.11036 USD cumulative', entries: [] }
for (let i = 1; i + 1 < args.length; i += 2) {
  const it = Number(args[i])
  const ot = Number(args[i + 1])
  const usd = Math.round(((it * price.inputUsdPerMTok + ot * price.outputUsdPerMTok) / 1e6) * 1e6) / 1e6
  const r = books.reserve('CONSULTATION', model, usd)
  books.settle({ id: r.id, purpose: 'CONSULTATION', model, reservedUsd: r.reservedUsd }, { usd, inputTokens: it, outputTokens: ot }, note)
  ledger.entries.push({ at: new Date().toISOString(), phase: 'dev-probe', house: '-', variant: 'PROBE', note, model, requestId: null, inputTokens: it, outputTokens: ot, costUsd: usd })
}
const total = ledger.entries.reduce((s: number, e: { costUsd: number }) => s + e.costUsd, 0)
writeFileSync(LEDGER, `${JSON.stringify({ ...ledger, totalUsd: Math.round(total * 1e6) / 1e6, requests: ledger.entries.length }, null, 1)}\n`)
process.stdout.write(`booked ${(args.length - 1) / 2} request(s); campaign total ${Math.round(total * 1e6) / 1e6} USD\n`)
