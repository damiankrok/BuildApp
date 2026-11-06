/**
 * EXTERIOR-COMPLETE E13 research: the experiment's spend ledger, kept across checkpoints and never reset.
 *
 * The owner set a limit of 5 USD of new measured spend for the AI experiment (contract v3.42), cumulative. The ledger
 * holds every call ever made by the harness (E12's calls are entered from their records), and a guard consults it
 * before each call: a call is reserved at its own `--max-budget-usd` cap before it starts — so calls run one after
 * another can never together pass the limit — and settled at the CLI's estimate when it returns (at the full cap when
 * the CLI reports no figure: an unknown cost is counted as the worst case, never as zero).
 *
 * The figures are CLI token estimates (`costBasis: CLI_TOKEN_ESTIMATE`), not bills; `billing` stays UNCONFIRMED.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { CliCall, SpendGuard } from './claude-code-reasoner.js'

export const EXPERIMENT_LIMIT_USD = 5

export type LedgerEntry = { at: string; stage: string; what: string; modelRequested: string; modelsReturned: string[]; sessionId: string | null; authCategory: string | null; status: string; estimatedCostUsd: number | null; countedUsd: number; usage?: CliCall['usage']; latencyMs?: number; note?: string }
export type Ledger = { schema: 'buildapp.ai-spend-ledger'; limitUsd: number; costBasis: 'CLI_TOKEN_ESTIMATE'; billing: 'UNCONFIRMED'; entries: LedgerEntry[] }

export const spentUsd = (l: Ledger): number => l.entries.reduce((s, e) => s + e.countedUsd, 0)

export function loadLedger(path: string): Ledger {
  if (!existsSync(path)) return { schema: 'buildapp.ai-spend-ledger', limitUsd: EXPERIMENT_LIMIT_USD, costBasis: 'CLI_TOKEN_ESTIMATE', billing: 'UNCONFIRMED', entries: [] }
  return JSON.parse(readFileSync(path, 'utf8')) as Ledger
}

export class SpendLimitReached extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SpendLimitReached'
  }
}

/** A guard over a ledger file: reserve before a call, settle after; the file is rewritten after every settlement. */
export function ledgerGuard(path: string, stage: string, now: () => string = () => new Date().toISOString()): SpendGuard & { ledger: Ledger; reservedUsd: () => number } {
  const ledger = loadLedger(path)
  let reserved = 0
  const open = new Map<string, number[]>()
  const save = (): void => writeFileSync(path, `${JSON.stringify(ledger, null, 1)}\n`)
  return {
    ledger,
    reservedUsd: () => reserved,
    reserve(capUsd: number, what: string): void {
      const after = spentUsd(ledger) + reserved + capUsd
      if (after > ledger.limitUsd + 1e-9) throw new SpendLimitReached(`${what}: a call capped at $${capUsd.toFixed(3)} would take the experiment to $${after.toFixed(3)}, past its $${ledger.limitUsd} limit — not started`)
      reserved += capUsd
      open.set(what, [...(open.get(what) ?? []), capUsd])
    },
    settle(call: CliCall, what: string): void {
      const caps = open.get(what) ?? []
      const cap = caps.shift() ?? 0
      open.set(what, caps)
      reserved = Math.max(0, reserved - cap)
      const counted = call.estimatedCostUsd ?? cap
      ledger.entries.push({ at: now(), stage, what, modelRequested: call.modelRequested, modelsReturned: call.modelsReturned, sessionId: call.sessionId, authCategory: call.authCategory, status: call.status, estimatedCostUsd: call.estimatedCostUsd, countedUsd: Number(counted.toFixed(6)), usage: call.usage, latencyMs: call.latencyMs, ...(call.estimatedCostUsd === null ? { note: 'no cost reported: counted at the call cap' } : {}) })
      save()
    },
  }
}
