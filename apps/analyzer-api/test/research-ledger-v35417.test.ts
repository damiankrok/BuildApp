import { execFile } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'
import { committedUsd, ledgerSpend, loadLedger } from '../../../research/source-to-model/v35417/ledger.js'

// v3.54.17 R2 (audit §6): the research books reserve globally — every reservation is on disk and every change is made
// inside the host's own exclusive lock (`file-lock.ts`). The audit's probe accepted 0.80 + 0.80 USD against 1.042255 USD.
const run = promisify(execFile)
const ROOT = join(__dirname, '../../..')
const OPENING = 27.812357
const CEILING = 28.854612
const client = async (path: string, id: string, usd: number, mode: string, settleUsd?: number): Promise<{ accepted: boolean; refused?: boolean; reserved?: number }> => {
  const { stdout } = await run(join(ROOT, 'node_modules/.bin/vite-node'), [join(ROOT, 'research/source-to-model/v35417/ledger-client.ts'), '--', path, id, String(usd), mode, String(OPENING), String(CEILING), ...(settleUsd !== undefined ? [String(settleUsd)] : [])], { cwd: ROOT, timeout: 90_000 })
  return JSON.parse(stdout.trim().split('\n').pop() as string)
}

describe('v3.54.17 R2 research ledger: one reservation state for every client', () => {
  it("the audit's probe: two clients in one process — the second reservation is refused, both are on disk", () => {
    const path = join(mkdtempSync(join(tmpdir(), 'ledger-r2-')), 'ledger.json')
    const a = ledgerSpend({ phase: 'TEST', house: 'A', variant: 'A' }, { path, openingUsd: OPENING, ceilingUsd: CEILING })
    const b = ledgerSpend({ phase: 'TEST', house: 'B', variant: 'B' }, { path, openingUsd: OPENING, ceilingUsd: CEILING })
    a.reserve('test-model', 0.8, 'controlled reservation A')
    expect(() => b.reserve('test-model', 0.8, 'controlled reservation B')).toThrow(/would pass the ceiling/)
    expect(a.open()).toBeCloseTo(0.8, 6)
    expect(b.open()).toBe(0)
    expect(committedUsd(loadLedger(path))).toBeLessThanOrEqual(CEILING)
  })

  it('separate processes at once: the reserves never pass the ceiling; every settlement survives; a retried attempt is booked once', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'ledger-r2-')), 'ledger.json')
    // six clients each ask 0.30 USD of a 1.042255 USD pool: at most three fit
    const results = await Promise.all([0, 1, 2, 3, 4, 5].map((i) => client(path, `att-${i}`, 0.3, 'RESERVE_SETTLE', 0.25)))
    const accepted = results.filter((r) => r.accepted)
    expect(accepted.length).toBeLessThanOrEqual(3)
    expect(accepted.length).toBeGreaterThanOrEqual(1)
    expect(results.filter((r) => !r.accepted).every((r) => r.refused === true)).toBe(true)
    const books = loadLedger(path)
    expect(books.entries.filter((e) => e.status === 'SETTLED')).toHaveLength(accepted.length)
    expect(books.entries.filter((e) => e.status === 'RESERVED')).toHaveLength(0)
    expect(books.totalUsd).toBeCloseTo(OPENING + 0.25 * accepted.length, 6)
    expect(committedUsd(books)).toBeLessThanOrEqual(CEILING + 1e-9)
    // a retry of an attempt already settled — reserve and settle again under its id — changes nothing
    const before = readFileSync(path, 'utf8')
    const again = await client(path, 'att-retry', 0.1, 'SETTLE_TWICE', 0.05)
    expect(again.accepted).toBe(true)
    const after = loadLedger(path)
    expect(after.entries.filter((e) => e.attemptId === 'att-retry')).toHaveLength(1)
    expect(after.totalUsd).toBeCloseTo(books.totalUsd + 0.05, 6)
    expect(before).not.toBe(readFileSync(path, 'utf8'))
  }, 240_000)

  it('reservations standing in other processes count: a reservation that would pass them is refused', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'ledger-r2-')), 'ledger.json')
    const first = await client(path, 'hold-1', 0.8, 'RESERVE')
    expect(first.accepted).toBe(true)
    const second = await client(path, 'hold-2', 0.8, 'RESERVE')
    expect(second).toMatchObject({ accepted: false, refused: true })
    // the same attempt again is the reservation already held, not a second one
    const same = await client(path, 'hold-1', 0.8, 'RESERVE')
    expect(same).toMatchObject({ accepted: true, reserved: 0.8 })
    expect(loadLedger(path).openReservedUsd).toBeCloseTo(0.8, 6)
  }, 240_000)
})
