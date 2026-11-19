/**
 * v3.54.14 — the stage's spend books: one limit of 5 USD of new API cost for the whole of v3.54.14 over the books v3.54.13
 * closed (23.854612 USD). Every request reserves its worst case first and is refused when the reservation would pass the
 * ceiling; it is settled at the reported usage (a transport failure keeps its reservation as spent: unknown cost stays
 * reserved). No key is read or written here.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ConsultSpend } from '../../../packages/analysis-service/src/consult/loop.js'

export const ROOT = join(__dirname, '../../..')
export const LEDGER = join(ROOT, 'research/ai-assist/spend-ledger-v35414.json')
export const OPENING_USD = 23.854612
export const STAGE_CAP_USD = 5
export const CEILING_USD = Math.round((OPENING_USD + STAGE_CAP_USD) * 1e6) / 1e6

type Entry = { at: string; phase: string; house: string; variant: string; note: string; model: string; reservedUsd: number; costUsd: number; inputTokens: number; outputTokens: number; status: 'SETTLED' | 'NOT_SENT' | 'FAILED_KEPT_RESERVED' }
type Ledger = { schema: string; currency: 'USD'; costBasis: string; billing: string; openingUsd: number; stageCapUsd: number; ceilingUsd: number; openingNote: string; entries: Entry[]; totalUsd: number; stageSpentUsd: number; requests: number }

export function loadLedger(): Ledger {
  if (existsSync(LEDGER)) return JSON.parse(readFileSync(LEDGER, 'utf8')) as Ledger
  return { schema: 'buildapp.ai-spend-ledger.v35414', currency: 'USD', costBasis: 'USAGE_PRICED (official list prices per MTok)', billing: 'NOT_RECONCILED_WITH_INVOICE', openingUsd: OPENING_USD, stageCapUsd: STAGE_CAP_USD, ceilingUsd: CEILING_USD, openingNote: 'the books v3.54.13 closed (23.854612 USD); no v3.54.14 request was made before R2 (none in the repository or the private run directories); one limit of 5 USD for all of v3.54.14; the old 24.11036 ceiling is history and not this stage\'s limit', entries: [], totalUsd: OPENING_USD, stageSpentUsd: 0, requests: 0 }
}

export function ledgerSpend(context: { phase: string; house: string; variant: string }): ConsultSpend & { open: () => number } {
  const ledger = loadLedger()
  const open = new Map<string, { usd: number; model: string; note: string }>()
  let n = 0
  const save = (): void => {
    ledger.totalUsd = Math.round((OPENING_USD + ledger.entries.reduce((s, e) => s + e.costUsd, 0)) * 1e6) / 1e6
    ledger.stageSpentUsd = Math.round((ledger.totalUsd - OPENING_USD) * 1e6) / 1e6
    ledger.requests = ledger.entries.filter((e) => e.status !== 'NOT_SENT').length
    writeFileSync(LEDGER, `${JSON.stringify(ledger, null, 1)}\n`)
  }
  return {
    open: () => [...open.values()].reduce((s, r) => s + r.usd, 0),
    reserve(model, usd, note) {
      const reserved = [...open.values()].reduce((s, r) => s + r.usd, 0)
      if (ledger.totalUsd + reserved + usd > CEILING_USD + 1e-9) throw new Error(`a reservation of ${usd.toFixed(4)} USD would pass the stage ceiling ${CEILING_USD} (books ${ledger.totalUsd}, open ${reserved.toFixed(4)}): not sent`)
      const id = `r${++n}`
      open.set(id, { usd, model, note })
      return { id, usd }
    },
    settle(reservation, actual, note) {
      const r = open.get(reservation.id)
      open.delete(reservation.id)
      const base = { at: new Date().toISOString(), phase: context.phase, house: context.house, variant: context.variant, note: `${r?.note ?? ''}${note ? ` (${note})` : ''}`, model: r?.model ?? '?', reservedUsd: Math.round(reservation.usd * 1e6) / 1e6 }
      if (actual === 'NOT_SENT') ledger.entries.push({ ...base, costUsd: 0, inputTokens: 0, outputTokens: 0, status: 'NOT_SENT' })
      else ledger.entries.push({ ...base, costUsd: Math.round(actual.usd * 1e6) / 1e6, inputTokens: actual.inputTokens, outputTokens: actual.outputTokens, status: actual.inputTokens === 0 && actual.outputTokens === 0 ? 'FAILED_KEPT_RESERVED' : 'SETTLED' })
      save()
    },
  }
}
