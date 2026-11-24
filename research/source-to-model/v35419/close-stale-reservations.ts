/**
 * v3.54.19 — closes reservations left OPEN in the one continuing ledger by a process that no longer runs (a batch stopped
 * mid-request). Whether the provider answered — and billed — such a request is not known here, so each is booked the way
 * the ledger books a transport failure: AT ITS RESERVATION (an upper bound), with the reason on the line. Never deletes.
 *   npx vite-node research/source-to-model/v35419/close-stale-reservations.ts
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { underLock } from '../v35417/ledger.js'

const LEDGER = join(__dirname, '../../ai-assist/spend-ledger-v35417r3.json')
const closed = underLock(LEDGER, (l) => {
  const out: Array<{ at: string; house: string; note: string; usd: number }> = []
  for (const e of l.entries as Array<Record<string, unknown>>) {
    if (e.status !== 'RESERVED' || existsSync(`/proc/${String(e.pid)}`)) continue
    e.status = 'SETTLED'
    e.costUsd = e.reservedUsd
    e.note = `${String(e.note)} — INTERRUPTED: the process was stopped while this request was in flight; whether it was answered and billed is unknown, so it is booked at its reservation (an upper bound), closed ${new Date().toISOString()}`
    out.push({ at: String(e.at), house: String(e.house), note: String(e.note).slice(0, 60), usd: Number(e.reservedUsd) })
  }
  return out
}, { openingUsd: 28.542857, ceilingUsd: 68.542857 })
process.stdout.write(`${JSON.stringify(closed, null, 1)}\n`)
