/**
 * v3.54.1: what a live answer leaves behind. Wraps the (spend-guarded) reader: every answer goes to `answers.json` in the
 * fixture format the product's replayer reads (`fixtureStructuredVision`, keyed by `structuredVisionKey` over the exact
 * question and bytes) and to `raw.jsonl` with the raw text, request id, usage and priced cost; every request, answered
 * or not, gets one line in the campaign ledger with the books' running total after it. No key, header or argument of
 * the client passes through here — only the request the product built and what the API returned.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { sha256Bytes } from '@buildapp/source-common'
import { HouseReaderUnavailable, structuredVisionKey } from '@buildapp/source-vision'
import type { StructuredVision } from '@buildapp/source-vision'
import { HOUSE_READER_PRICES, costUsd } from '../../../apps/analyzer-api/src/house-reader-spend.js'
import type { SpendLedger } from '../../../apps/analyzer-api/src/house-reader-spend.js'
import { PRICE_SOURCE } from './campaign.js'

export const CAMPAIGN_LEDGER = 'research/ai-assist/spend-ledger-v3541.json'

export type LedgerEntry = { at: string; phase: string; house: string; purpose: string; model: string; requestId: string | null; status: string; inputTokens: number | null; outputTokens: number | null; costUsd: number | null; latencyMs: number | null; booksCumulativeUsd: number }

export function appendLedger(path: string, entry: LedgerEntry): void {
  const ledger = existsSync(path)
    ? (JSON.parse(readFileSync(path, 'utf8')) as { entries: LedgerEntry[] })
    : { schema: 'buildapp.ai-spend-ledger.v3541', currency: 'USD', costBasis: 'USAGE_PRICED', billing: 'NOT_RECONCILED_WITH_INVOICE', priceSource: PRICE_SOURCE, eurConversion: '1 EUR = 1.00 USD for every ceiling (below any recent rate)', note: 'separate from the S53 CLI estimates (spend-ledger.json), which stay historical', entries: [] as LedgerEntry[] }
  ledger.entries.push(entry)
  const total = ledger.entries.reduce((s, e) => s + (e.costUsd ?? 0), 0)
  writeFileSync(path, `${JSON.stringify({ ...ledger, totalUsd: Math.round(total * 1e6) / 1e6, requests: ledger.entries.length }, null, 1)}\n`)
}

/** Records every answer (and every unusable one) beside the reader, in the replayable fixture format; asks only what is not recorded yet. */
export function recording(reader: StructuredVision, at: { books: SpendLedger; out: string; phase: string; house: string; ledgerPath: string; secret?: string }): StructuredVision {
  const { books, out, phase, house, ledgerPath } = at
  // an error text can carry whatever the transport put in it: nothing is written that contains the key
  const scrub = (text: string): string => (at.secret ? text.split(at.secret).join('[key]') : text)
  const trace = (line: unknown): void => appendFileSync(join(out, 'raw.jsonl'), `${scrub(JSON.stringify(line))}\n`)
  const answersPath = join(out, 'answers.json')
  const answers: Record<string, unknown> = existsSync(answersPath) ? (JSON.parse(readFileSync(answersPath, 'utf8')) as Record<string, unknown>) : {}
  return {
    provider: reader.provider,
    available: () => reader.available(),
    ask: async (request) => {
      const key = structuredVisionKey(request)
      const meta = { at: new Date().toISOString(), phase, house, purpose: request.purpose, key, pictures: request.pictures.map((p) => ({ number: p.number, mediaType: p.mediaType, bytes: p.bytes.byteLength, sha256: sha256Bytes(p.bytes) })) }
      const model = request.purpose === 'HOUSE_TRIAGE' ? reader.provider.triageModel : reader.provider.model
      // already answered for these exact bytes and this exact question (a house stopped by the budget and run again):
      // the recorded answer is used and nothing is sent or booked
      if (key in answers) {
        trace({ ...meta, status: 'REPLAYED_FROM_RECORD' })
        return { output: answers[key], usage: { latencyMs: 0, model } }
      }
      try {
        const a = await reader.ask(request)
        answers[key] = a.output
        writeFileSync(answersPath, scrub(JSON.stringify(answers, null, 1)))
        trace({ ...meta, status: 'ANSWERED', usage: a.usage, raw: a.raw ?? null })
        appendLedger(ledgerPath, { at: meta.at, phase, house, purpose: request.purpose, model, requestId: a.usage.requestId ?? null, status: 'ANSWERED', inputTokens: a.usage.inputTokens ?? null, outputTokens: a.usage.outputTokens ?? null, costUsd: a.usage.estimatedCostUsd ?? null, latencyMs: a.usage.latencyMs, booksCumulativeUsd: books.read().cumulativeUsd })
        return a
      } catch (e) {
        const u = e instanceof HouseReaderUnavailable ? e.raw?.usage : undefined
        const price = HOUSE_READER_PRICES[model]
        // priced as the books settle it; a timeout or a dropped answer has no usage and its reservation stands in the books
        const cost = u && typeof u.inputTokens === 'number' && typeof u.outputTokens === 'number' && price ? costUsd(price, u.inputTokens, u.outputTokens) : null
        trace({ ...meta, status: e instanceof HouseReaderUnavailable ? e.reason : 'ERROR', message: String((e as Error).message).slice(0, 400), raw: e instanceof HouseReaderUnavailable ? (e.raw ?? null) : null })
        appendLedger(ledgerPath, { at: meta.at, phase, house, purpose: request.purpose, model, requestId: u?.requestId ?? null, status: e instanceof HouseReaderUnavailable ? e.reason : 'ERROR', inputTokens: u?.inputTokens ?? null, outputTokens: u?.outputTokens ?? null, costUsd: cost, latencyMs: u?.latencyMs ?? null, booksCumulativeUsd: books.read().cumulativeUsd })
        throw e
      }
    },
  }
}
