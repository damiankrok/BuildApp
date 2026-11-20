/**
 * v3.54.17 — the continuation's spend books: no new pool. The books v3.54.16 closed at 27.812357 USD; the shared ceiling stays
 * 28.854612 USD, so 1.042255 USD remain for this stage (the panel balance is not a limit). Every request reserves its worst case first and is refused when the reservation would pass the
 * ceiling; it is settled at the reported usage (a transport failure keeps its reservation as spent: unknown cost stays
 * reserved). No key is read or written here.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ConsultSpend } from '../../../packages/analysis-service/src/consult/loop.js'

export const ROOT = join(__dirname, '../../..')
export const LEDGER = join(ROOT, 'research/ai-assist/spend-ledger-v35417.json')
export const OPENING_USD = 27.812357
export const STAGE_CAP_USD = 1.042255
export const CEILING_USD = Math.round((OPENING_USD + STAGE_CAP_USD) * 1e6) / 1e6

type Entry = { at: string; phase: string; house: string; variant: string; note: string; model: string; reservedUsd: number; costUsd: number; inputTokens: number; outputTokens: number; cacheReadInputTokens?: number; cacheCreation5mInputTokens?: number; cacheCreation1hInputTokens?: number; status: 'SETTLED' | 'NOT_SENT' | 'FAILED_KEPT_RESERVED' }
type Ledger = { schema: string; currency: 'USD'; costBasis: string; billing: string; openingUsd: number; stageCapUsd: number; ceilingUsd: number; openingNote: string; entries: Entry[]; totalUsd: number; stageSpentUsd: number; requests: number }

export function loadLedger(): Ledger {
  if (existsSync(LEDGER)) return JSON.parse(readFileSync(LEDGER, 'utf8')) as Ledger
  return { schema: 'buildapp.ai-spend-ledger.v35417', currency: 'USD', costBasis: 'USAGE_PRICED (official list prices per MTok)', billing: 'NOT_RECONCILED_WITH_INVOICE', openingUsd: OPENING_USD, stageCapUsd: STAGE_CAP_USD, ceilingUsd: CEILING_USD, openingNote: 'the books v3.54.16 closed at 27.812357 USD; v3.54.17 opens no new pool: the remaining pool to the shared ceiling 28.854612 USD is 1.042255 USD; replays and accepted revisions never pass through these books (0 USD, no request)', entries: [], totalUsd: OPENING_USD, stageSpentUsd: 0, requests: 0 }
}

export function ledgerSpend(context: { phase: string; house: string; variant: string }): ConsultSpend & { open: () => number } {
  const ledger = loadLedger()
  const open = new Map<string, { usd: number; model: string; note: string }>()
  let n = 0
  // v3.54.17: another process may have booked since this one loaded the books — merge on every write, never overwrite
  const save = (): void => {
    const onDisk = loadLedger()
    const mine = new Set(ledger.entries.map((e) => `${e.at}|${e.note}|${e.costUsd}`))
    ledger.entries = [...onDisk.entries.filter((e) => !mine.has(`${e.at}|${e.note}|${e.costUsd}`)), ...ledger.entries].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
    ledger.totalUsd = Math.round((OPENING_USD + ledger.entries.reduce((s, e) => s + e.costUsd, 0)) * 1e6) / 1e6
    ledger.stageSpentUsd = Math.round((ledger.totalUsd - OPENING_USD) * 1e6) / 1e6
    ledger.requests = ledger.entries.filter((e) => e.status !== 'NOT_SENT').length
    writeFileSync(LEDGER, `${JSON.stringify(ledger, null, 1)}\n`)
  }
  return {
    open: () => [...open.values()].reduce((s, r) => s + r.usd, 0),
    reserve(model, usd, note) {
      const reserved = [...open.values()].reduce((s, r) => s + r.usd, 0)
      const books = Math.max(ledger.totalUsd, loadLedger().totalUsd)
      if (books + reserved + usd > CEILING_USD + 1e-9) throw new Error(`a reservation of ${usd.toFixed(4)} USD would pass the stage ceiling ${CEILING_USD} (books ${books}, open ${reserved.toFixed(4)}): not sent`)
      const id = `r${++n}`
      open.set(id, { usd, model, note })
      return { id, usd }
    },
    settle(reservation, actual, note) {
      const r = open.get(reservation.id)
      open.delete(reservation.id)
      const base = { at: new Date().toISOString(), phase: context.phase, house: context.house, variant: context.variant, note: `${r?.note ?? ''}${note ? ` (${note})` : ''}`, model: r?.model ?? '?', reservedUsd: Math.round(reservation.usd * 1e6) / 1e6 }
      if (actual === 'NOT_SENT') ledger.entries.push({ ...base, costUsd: 0, inputTokens: 0, outputTokens: 0, status: 'NOT_SENT' })
      // a transport failure is settled at its reservation with no tokens (`loop.ts`); an answered request always has tokens
      else {
        const tokens = actual.inputTokens + actual.outputTokens + (actual.cacheReadInputTokens ?? 0) + (actual.cacheCreation5mInputTokens ?? 0) + (actual.cacheCreation1hInputTokens ?? 0)
        if (tokens === 0 && actual.usd === 0) ledger.entries.push({ ...base, costUsd: 0, inputTokens: 0, outputTokens: 0, status: 'NOT_SENT', note: `${base.note} — replayed answer: no request left the process` })
        else ledger.entries.push({ ...base, costUsd: Math.round(actual.usd * 1e6) / 1e6, inputTokens: actual.inputTokens, outputTokens: actual.outputTokens, ...(actual.cacheReadInputTokens !== undefined ? { cacheReadInputTokens: actual.cacheReadInputTokens } : {}), ...(actual.cacheCreation5mInputTokens !== undefined ? { cacheCreation5mInputTokens: actual.cacheCreation5mInputTokens } : {}), ...(actual.cacheCreation1hInputTokens !== undefined ? { cacheCreation1hInputTokens: actual.cacheCreation1hInputTokens } : {}), status: tokens === 0 ? 'FAILED_KEPT_RESERVED' : 'SETTLED' })
      }
      save()
    },
  }
}
