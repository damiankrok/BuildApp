/**
 * v3.53.2 — the record of one house-reader trial, with a stand-in for the SDK's client: no provider is reached and
 * nothing is paid for. What is held is what the owner's paid run relies on: everything needed to judge it is saved,
 * a reading that built no model is a failure a script can see, there is one set of books that no argument can reset,
 * and the same description always builds the same bytes.
 */
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { acquireSourcePackage, fileByteCache, genericProjectPageAdapter } from '@buildapp/source-package'
import type { SourceByteCache, SourcePackage } from '@buildapp/source-package'
import { anthropicStructuredVision } from '@buildapp/source-vision'
import { PAGE, unknownPublisher } from '../../../packages/analysis-service/test/support/unknown-publisher.js'
import { TRIAL_EXIT, campaignSpentUsd, runHouseReaderTrial } from '../scripts/house-reader-trial.js'
import type { TrialCall, TrialRecord } from '../scripts/house-reader-trial.js'

const description = JSON.parse(readFileSync(new URL('../../../packages/reconstruction/test/fixtures/described-house-a.json', import.meta.url), 'utf8')) as Record<string, unknown>
const repoRoot = resolve(import.meta.dirname, '../../..')
const read = (dir: string, name: string): unknown => JSON.parse(readFileSync(join(dir, name), 'utf8'))

let pkg: SourcePackage
let cache: SourceByteCache

beforeAll(async () => {
  const site = unknownPublisher({ drawings: false })
  cache = fileByteCache(mkdtempSync(join(tmpdir(), 'trial-cache-')))
  pkg = await acquireSourcePackage(PAGE, [genericProjectPageAdapter], { deps: site.deps, cache })
})

type Answer = { description?: unknown; fail?: { status?: number; message: string } }

/** The product's adapter over a client that answers from this test: the sorting, then the description (or a failure). */
function standIn(answer: Answer): { adapter: ReturnType<typeof anthropicStructuredVision>; calls: TrialCall[]; requests: () => number } {
  const calls: TrialCall[] = []
  let requests = 0
  const adapter = anthropicStructuredVision({
    apiKey: 'test-key-not-real',
    createClient: async () => ({
      messages: {
        create: async (body) => {
          requests += 1
          if (answer.fail) {
            calls.push({ requested: body.model, failed: true, status: answer.fail.status ?? null })
            throw Object.assign(new Error(answer.fail.message), answer.fail.status ? { status: answer.fail.status } : {})
          }
          const triage = body.model === adapter.provider.triageModel
          const pictures = (body.messages as Array<{ content: Array<{ type: string }> }>)[0].content.filter((c) => c.type === 'image').length
          const output = triage ? { pictures: Array.from({ length: pictures }, (_, i) => ({ picture: i + 1, kind: 'EXTERIOR_VIEW', duplicateOf: 0 })) } : answer.description
          const usage = { input_tokens: triage ? 3000 : 9000, output_tokens: triage ? 400 : 5000 }
          calls.push({ requested: body.model, served: body.model, stop: 'end_turn', usage })
          return { content: [{ type: 'text', text: JSON.stringify(output) }], stop_reason: 'end_turn', usage }
        },
      },
    }),
  })
  return { adapter, calls, requests: () => requests }
}

function places(spentUsd = 2.5, limitUsd = 5): { out: string; books: string; campaignLedger: string } {
  const dir = mkdtempSync(join(tmpdir(), 'trial-'))
  const campaignLedger = join(dir, 'spend-ledger.json')
  writeFileSync(campaignLedger, JSON.stringify({ schema: 'buildapp.ai-spend-ledger', limitUsd, costBasis: 'CLI_TOKEN_ESTIMATE', billing: 'UNCONFIRMED', entries: [{ at: '2026-11-06T00:00:00Z', stage: 'earlier', what: 'earlier work', countedUsd: spentUsd }] }))
  return { out: join(dir, 'out'), books: join(dir, 'books'), campaignLedger }
}

const trial = (reader: ReturnType<typeof standIn>, at: ReturnType<typeof places>, more: Partial<Parameters<typeof runHouseReaderTrial>[0]> = {}): Promise<TrialRecord> =>
  runHouseReaderTrial({ pkg, cache, adapter: reader.adapter, calls: reader.calls, keyPresent: true, maxUsd: 5, repoRoot, ...at, ...more })

describe('one reading of one page, recorded', () => {
  it('a reading that builds a house leaves the model, the program, the scene and the diagnostics — and one line in the one ledger', async () => {
    const at = places()
    const reader = standIn({ description })
    const record = await trial(reader, at)
    expect(record).toMatchObject({ outcome: 'MODEL', exitCode: TRIAL_EXIT.MODEL, code: null, keyPresent: true, campaignLedgerUsd: 2.5, booksBeforeUsd: 2.5 })
    expect(readdirSync(at.out).sort()).toEqual(['description.json', 'diagnostics.json', 'model.json', 'program.json', 'result.json', 'scene.json', 'trial.json'])
    expect(read(at.out, 'description.json')).toEqual(description)
    expect((read(at.out, 'program.json') as unknown[]).length).toBeGreaterThan(10)
    expect((read(at.out, 'model.json') as { objects?: unknown }).objects ?? read(at.out, 'model.json')).toBeTruthy()
    expect((read(at.out, 'scene.json') as { scene: { meshes: unknown[] } }).scene.meshes.length).toBeGreaterThan(0)
    expect((read(at.out, 'result.json') as { warningDetails: Array<{ code: string }> }).warningDetails.map((w) => w.code)).toContain('MODEL_FROM_SOURCE_DESCRIPTION')
    const diagnostics = read(at.out, 'diagnostics.json') as Record<string, unknown>
    expect(Object.keys(diagnostics).sort()).toEqual(['adjustments', 'closure', 'descriptionCheck', 'refusedByModel', 'technicalValidity', 'warnings'])
    expect((diagnostics.technicalValidity as { status: string }).status).toBe('VALID')
    // what the API answered beside the content: two requests, the models that served them, their usage
    expect(reader.calls.map((c) => c.served)).toEqual([reader.adapter.provider.triageModel, reader.adapter.provider.model])
    expect(record.calls).toEqual(reader.calls)
    // the new reading against the SOURCES; the build, byte for byte, against itself
    expect(record.againstSources).toMatchObject({ shape: { overall: { widthM: (description.overall as { widthM: number }).widthM } } })
    expect(record.determinism).toMatchObject({ sameBytes: true, compared: ['model.json', 'scene.json', 'program.json'] })
    expect((record.hashes as Record<string, string>).scene).toMatch(/^[0-9a-f]{64}$/)
    // the books settled to the usage at list prices, and the campaign's ledger carries the same amount once
    const booked = record.bookedUsd as number
    expect(booked).toBeCloseTo((3000 * 0.1 + 400 * 0.5 + 9000 * 2 + 5000 * 10) / 1e6, 6)
    expect(record.booksAfterUsd).toBeCloseTo(2.5 + booked, 6)
    const ledger = JSON.parse(readFileSync(at.campaignLedger, 'utf8')) as Parameters<typeof campaignSpentUsd>[0]
    expect(ledger.entries).toHaveLength(2)
    expect(ledger.entries[1]).toMatchObject({ stage: 'S53 house-reader trial (SDK)', status: 'OK', countedUsd: booked, usage: { inputTokens: 12000, outputTokens: 5400 } })
    expect(campaignSpentUsd(ledger)).toBeCloseTo(2.5 + booked, 6)
    expect(record.campaignLedgerAfterUsd).toBeCloseTo(2.5 + booked, 6)
    // nothing of the key reaches the record
    expect(readFileSync(join(at.out, 'trial.json'), 'utf8')).not.toContain('test-key-not-real')
  })

  it('a paid reading that builds no model is a failure a script can see: exit 2, a code, the cost still on the books', async () => {
    const at = places()
    // an answer inside JSON but not a house: the check refuses it after the provider was paid
    const reader = standIn({ description: { ...description, bodies: [] } })
    const record = await trial(reader, at)
    expect(record).toMatchObject({ outcome: 'NO_MODEL', exitCode: 2, code: 'DESCRIPTION_REFUSED' })
    expect(TRIAL_EXIT.NO_MODEL).not.toBe(0)
    expect(String(record.message).length).toBeGreaterThan(10)
    expect(record.bookedUsd as number).toBeGreaterThan(0)
    expect(readdirSync(at.out).sort()).toEqual(['diagnostics.json', 'trial.json'])
    expect((read(at.out, 'diagnostics.json') as { refusal: { code: string } }).refusal.code).toBe('DESCRIPTION_REFUSED')
    const ledger = JSON.parse(readFileSync(at.campaignLedger, 'utf8')) as { entries: Array<{ status: string }> }
    expect(ledger.entries[1].status).toBe('NO_MODEL DESCRIPTION_REFUSED')
  })

  it('a key the provider refuses is the dry run: no model, exit 2, nothing booked and the ledger untouched', async () => {
    const at = places()
    const before = readFileSync(at.campaignLedger, 'utf8')
    const reader = standIn({ fail: { status: 401, message: 'invalid x-api-key' } })
    const record = await trial(reader, at, { keyPresent: false })
    expect(record).toMatchObject({ outcome: 'NO_MODEL', exitCode: 2, code: 'READER_UNAVAILABLE', reader: 'REJECTED_UNBILLED', bookedUsd: 0, keyPresent: false })
    expect(record.booksAfterUsd).toBe(2.5)
    expect(readFileSync(at.campaignLedger, 'utf8')).toBe(before)
    expect(reader.requests()).toBe(1)
  })

  it('a failure that may have been billed keeps its reservation, and the ledger says so', async () => {
    const at = places()
    const reader = standIn({ fail: { message: 'socket hang up' } })
    const record = await trial(reader, at)
    expect(record).toMatchObject({ outcome: 'NO_MODEL', exitCode: 2, code: 'READER_UNAVAILABLE', reader: 'TRANSPORT' })
    expect(record.bookedUsd as number).toBeGreaterThan(0)
    const ledger = JSON.parse(readFileSync(at.campaignLedger, 'utf8')) as { entries: Array<{ note: string }> }
    expect(ledger.entries[1].note).toContain('may have been billed')
  })
})

describe('one set of books', () => {
  it('a second run continues the first: the balance carries, and a fresh directory opens at the ledger, never at zero', async () => {
    const at = places()
    const first = await trial(standIn({ description }), at, { now: () => new Date('2026-11-11T10:00:00Z') })
    const booked = first.bookedUsd as number
    // the next day (one description a day), same books: opens where the first closed
    const second = await trial(standIn({ description }), { ...at, out: join(at.out, '..', 'out-2') }, { now: () => new Date('2026-11-12T10:00:00Z') })
    expect(second.booksBeforeUsd).toBeCloseTo(2.5 + booked, 6)
    expect(second.booksAfterUsd).toBeCloseTo(2.5 + 2 * booked, 6)
    // a new, empty books directory is not a new budget: it opens at what the ledger now holds
    const fresh = await trial(standIn({ description }), { ...at, out: join(at.out, '..', 'out-3'), books: join(at.books, '..', 'books-new') }, { now: () => new Date('2026-11-13T10:00:00Z') })
    expect(fresh.booksBeforeUsd).toBeCloseTo(2.5 + 2 * booked, 6)
    expect(fresh.outcome).toBe('MODEL')
  })

  it('a second description on the same day is refused by the books before any request', async () => {
    const at = places()
    const now = (): Date => new Date('2026-11-11T10:00:00Z')
    await trial(standIn({ description }), at, { now })
    const reader = standIn({ description })
    const again = await trial(reader, { ...at, out: join(at.out, '..', 'out-2') }, { now })
    expect(again).toMatchObject({ outcome: 'NO_MODEL', exitCode: 2, code: 'READER_UNAVAILABLE', reader: 'BUDGET', bookedUsd: 0 })
    expect(String(again.why)).toContain('description of the day has been asked for (2026-11-11)')
    expect(reader.requests()).toBe(0)
  })

  it('books that hold less than the campaign has spent are not the campaign’s books: nothing is asked', async () => {
    const at = places(1)
    await trial(standIn({ description }), at)
    // the ledger moves on elsewhere (other work of the campaign); these books did not see it
    const ledger = JSON.parse(readFileSync(at.campaignLedger, 'utf8')) as { entries: unknown[] }
    ledger.entries.push({ at: '2026-11-11T00:00:00Z', stage: 'elsewhere', what: 'other work', countedUsd: 2 })
    writeFileSync(at.campaignLedger, JSON.stringify(ledger))
    const reader = standIn({ description })
    const record = await trial(reader, { ...at, out: join(at.out, '..', 'out-2') })
    expect(record).toMatchObject({ outcome: 'NOT_STARTED', exitCode: 3, code: 'BOOKS_BEHIND_CAMPAIGN_LEDGER' })
    expect(reader.requests()).toBe(0)
  })

  it('the campaign’s limit is the ceiling whatever is asked for, and a reading that would pass it is refused unasked', async () => {
    const at = places(4.99)
    const reader = standIn({ description })
    const record = await trial(reader, at, { maxUsd: 50 })
    expect(record).toMatchObject({ outcome: 'NO_MODEL', exitCode: 2, reader: 'BUDGET', ceilingUsd: 5 })
    // the sorting of the pictures still fitted under the ceiling and was paid for; the description did not and was never sent
    expect(reader.calls.map((c) => c.requested)).toEqual([reader.adapter.provider.triageModel])
    expect(record.bookedUsd as number).toBeLessThan(0.01)
    expect(record.booksAfterUsd as number).toBeLessThanOrEqual(5)
    // at the ceiling itself nothing is asked at all
    const full = places(5)
    const none = standIn({ description })
    expect(await trial(none, full, { maxUsd: 50 })).toMatchObject({ outcome: 'NO_MODEL', exitCode: 2, bookedUsd: 0 })
    expect(none.requests()).toBe(0)
  })

  it('damaged books, an unreadable ledger and a private directory inside the repository all stop the run before it starts', async () => {
    const at = places()
    await trial(standIn({ description }), at)
    writeFileSync(join(at.books, 'house-reader-spend.json'), '{ not json')
    const damaged = standIn({ description })
    expect(await trial(damaged, { ...at, out: join(at.out, '..', 'out-2') })).toMatchObject({ outcome: 'NOT_STARTED', exitCode: 3, code: 'BOOKS_UNREADABLE' })
    expect(damaged.requests()).toBe(0)

    const other = places()
    writeFileSync(other.campaignLedger, '[]')
    expect(await trial(standIn({ description }), other)).toMatchObject({ outcome: 'NOT_STARTED', code: 'CAMPAIGN_LEDGER_UNREADABLE' })

    const inRepo = places()
    const reader = standIn({ description })
    const refused = await trial(reader, { ...inRepo, out: join(repoRoot, 'research', 'not-a-private-place') })
    expect(refused).toMatchObject({ outcome: 'NOT_STARTED', exitCode: 3, code: 'PRIVATE_DIR_INSIDE_REPOSITORY' })
    expect(existsSync(join(repoRoot, 'research', 'not-a-private-place'))).toBe(false)
    expect(reader.requests()).toBe(0)
  })
})
