/**
 * v3.53.2 — the record of ONE reading of ONE page by the house reader, through the product's real adapter and the
 * product's spend books: what `research/source-to-model/s53/sdk-live.ts` runs with the owner's key, and what
 * `test/house-reader-trial.test.ts` runs with a stand-in client at no cost.
 *
 * What a trial leaves in its private `out` directory:
 *   trial.json        the record: outcome, exit code, the provider's answers beside the content (model served, usage,
 *                     stop reason, status of a refusal), what the books hold before and after, what was compared
 *   description.json  the admitted description                          (MODEL only)
 *   model.json        the accepted model, as the product serialises it  (MODEL only)
 *   program.json      the command program the model was built by       (MODEL only)
 *   scene.json        the mobile scene bundle the phone would download  (MODEL only)
 *   result.json       the result in the service's contract             (MODEL only)
 *   diagnostics.json  the description's check against the page's published figures, what the builder adjusted or
 *                     dropped, what the model refused, the compiler's and the joint audit's findings
 *
 * The outcome is an exit code a script can branch on (`TRIAL_EXIT`): a paid reading that built no model is a FAILURE,
 * not a quiet zero.
 *
 * One set of books. `books` is a persistent private directory that every run continues; it is opened at what the
 * campaign's ledger already holds and is never opened below it, so pointing a run at a new directory cannot hand out
 * a budget the campaign has spent. What a run booked is appended to the campaign's ledger as one entry.
 *
 * Two different comparisons, kept apart: a NEW reading is compared with the SOURCES (the page's published figures, the
 * sides its pictures show) — two readings of one page are not expected to be the same text; the BUILD is deterministic
 * and is checked byte for byte by rebuilding the same description.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { DescribedRefusal, describedResult, identityOf, publishedFiguresOf, runDescribedAnalysis } from '@buildapp/analysis-service'
import type { SourceByteCache, SourcePackage } from '@buildapp/source-package'
import { HouseReaderUnavailable } from '@buildapp/source-vision'
import type { HouseDescription, StructuredVision } from '@buildapp/source-vision'
import { DEFAULT_SPEND_LIMITS, SpendLedgerError, openSpendLedger, spendGuardedStructuredVision } from '../src/house-reader-spend.js'

/** 0: a model was built. 2: the reader was asked (or refused) and no model came of it. 3: nothing was asked at all. 1 is left to a crash. */
export const TRIAL_EXIT = { MODEL: 0, NO_MODEL: 2, NOT_STARTED: 3 } as const
export type TrialOutcome = keyof typeof TRIAL_EXIT

export type TrialCall = Record<string, unknown>

export type TrialInput = {
  pkg: SourcePackage
  cache: SourceByteCache
  /** The reader as the product wires it, before the spend guard. */
  adapter: StructuredVision
  /** What the provider answered beside the content, one entry a request; filled by whoever built `adapter`. */
  calls: TrialCall[]
  keyPresent: boolean
  /** The persistent private directory of the books every run continues. */
  books: string
  /** The campaign's committed ledger: its total is the floor the books open at, and the run's cost is appended to it. */
  campaignLedger: string
  maxUsd: number
  out: string
  /** The repository root: `out` and `books` must lie outside it (a publisher's pictures and a private balance). */
  repoRoot: string
  /** A description recorded earlier for the same page, to set its shape beside the new one. Never a byte comparison. */
  recorded?: HouseDescription
  now?: () => Date
}

export type TrialRecord = Record<string, unknown> & { outcome: TrialOutcome; exitCode: number; code: string | null }

type CampaignLedger = { schema: string; limitUsd: number; entries: Array<Record<string, unknown>> } & Record<string, unknown>

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex')
const round6 = (n: number): number => Math.round(n * 1e6) / 1e6
const inside = (root: string, path: string): boolean => {
  const r = relative(resolve(root), resolve(path))
  return r === '' || (!r.startsWith('..') && !isAbsolute(r))
}

function loadCampaignLedger(path: string): CampaignLedger {
  const ledger = JSON.parse(readFileSync(path, 'utf8')) as CampaignLedger
  if (ledger.schema !== 'buildapp.ai-spend-ledger' || !Array.isArray(ledger.entries) || typeof ledger.limitUsd !== 'number') throw new Error('not a campaign spend ledger')
  return ledger
}

export const campaignSpentUsd = (ledger: CampaignLedger): number => round6(ledger.entries.reduce((sum, e) => sum + (typeof e.countedUsd === 'number' ? e.countedUsd : 0), 0))

const shapeOf = (d: HouseDescription) => ({
  overall: { widthM: d.overall.widthM, depthM: d.overall.depthM, basis: d.overall.basis },
  bodies: d.bodies.map((b) => ({ role: b.role, widthM: round6(Math.abs(b.x1 - b.x0)), depthM: round6(Math.abs(b.z1 - b.z0)), storeys: b.storeys, habitableAttic: b.habitableAttic, roof: b.roof.kind, ridge: b.roof.ridge, pitchDeg: b.roof.pitchDeg })),
  footprintOfBodiesM2: round6(d.bodies.reduce((sum, b) => sum + Math.abs(b.x1 - b.x0) * Math.abs(b.z1 - b.z0), 0)),
  openingsBySide: Object.fromEntries((['FRONT', 'REAR', 'LEFT', 'RIGHT'] as const).map((s) => [s, d.openings.filter((o) => o.side === s).length])),
  features: { dormers: d.dormers.length, rooflights: d.rooflights.length, chimneys: d.chimneys.length, balconies: d.balconies.length, terraces: d.terraces.length, canopies: d.canopies.length },
  hypotheticalSides: d.hypotheticalSides,
  unknowns: d.unknowns.length,
})

/** One reading, recorded. Never throws for an outcome it can name: the record and the exit code say what happened. */
export async function runHouseReaderTrial(input: TrialInput): Promise<TrialRecord> {
  const now = input.now ?? (() => new Date())
  const write = (name: string, value: unknown): void => writeFileSync(join(input.out, name), typeof value === 'string' ? value : `${JSON.stringify(value, null, 1)}\n`)
  const record: Record<string, unknown> = { schema: 'buildapp.house-reader-trial', version: 1, at: now().toISOString(), page: input.pkg.canonicalUrl, sourcePackageHash: input.pkg.contentHash, keyPresent: input.keyPresent, provider: input.adapter.provider, ceilingUsd: input.maxUsd }
  const finish = (outcome: TrialOutcome, code: string | null, more: Record<string, unknown> = {}): TrialRecord => {
    const done = { ...record, ...more, outcome, exitCode: TRIAL_EXIT[outcome], code, calls: input.calls } as TrialRecord
    if (existsSync(input.out)) write('trial.json', done)
    return done
  }

  // --- nothing is asked until the private places and the one set of books are in order ---------------------------------
  for (const [name, path] of [['out', input.out], ['books', input.books]] as const) {
    if (inside(input.repoRoot, path)) return finish('NOT_STARTED', 'PRIVATE_DIR_INSIDE_REPOSITORY', { message: `--${name} must be a directory outside the repository: it holds ${name === 'out' ? "a publisher's pictures and what was read from them" : 'a private balance'}` })
  }
  mkdirSync(input.out, { recursive: true })
  let campaign: CampaignLedger
  try {
    campaign = loadCampaignLedger(input.campaignLedger)
  } catch (e) {
    return finish('NOT_STARTED', 'CAMPAIGN_LEDGER_UNREADABLE', { message: `the campaign's ledger cannot be read, so what is already spent is not known: ${String((e as Error).message).slice(0, 200)}` })
  }
  const floorUsd = campaignSpentUsd(campaign)
  const ceilingUsd = Math.min(input.maxUsd, campaign.limitUsd)
  const limits = { ...DEFAULT_SPEND_LIMITS, maxUsd: ceilingUsd, maxDescriptionsPerDay: 1, maxRequestsPerDay: 3 }
  const unopened = (): boolean => !['house-reader-spend.json', 'house-reader-spend.json.bak', 'house-reader-spend.journal.jsonl'].some((name) => existsSync(join(input.books, name)))
  let ledger: ReturnType<typeof openSpendLedger>
  let beforeUsd: number
  try {
    ledger = openSpendLedger({ dir: input.books, limits, openingUsd: floorUsd, now })
    // books nobody has opened yet open — at their first reservation — at the campaign's total; anything else is read
    beforeUsd = unopened() ? floorUsd : ledger.read().cumulativeUsd
  } catch (e) {
    // damaged or half-written books are a person's to look at: never a fresh start
    return finish('NOT_STARTED', e instanceof SpendLedgerError ? 'BOOKS_UNREADABLE' : 'BOOKS_UNAVAILABLE', { campaignLedgerUsd: floorUsd, message: String((e as Error).message).slice(0, 300) })
  }
  Object.assign(record, { ceilingUsd, campaignLedgerUsd: floorUsd, booksBeforeUsd: beforeUsd })
  if (beforeUsd + 1e-6 < floorUsd) return finish('NOT_STARTED', 'BOOKS_BEHIND_CAMPAIGN_LEDGER', { message: `these books hold $${beforeUsd.toFixed(6)} and the campaign's ledger $${floorUsd.toFixed(6)}: they are not the campaign's books. Use the directory the earlier runs used, or an empty one (it opens at the ledger's total).` })

  /** Why the guarded reader says it is not available at all, read from the adapter and the books. */
  const whyUnasked = (): { reason: string; detail: string } | null => {
    if (!input.adapter.available()) return { reason: 'NO_CREDENTIALS', detail: 'the adapter has no key' }
    if (unopened()) return null
    const state = ledger.read()
    if (state.cumulativeUsd >= limits.maxUsd) return { reason: 'BUDGET', detail: 'the books hold ' + state.cumulativeUsd.toFixed(6) + ' USD of the ' + limits.maxUsd + ' USD ceiling' }
    if (state.dayDescriptions >= limits.maxDescriptionsPerDay) return { reason: 'BUDGET', detail: 'the one description of the day has been asked for (' + state.day + ')' }
    if (state.dayRequests >= limits.maxRequestsPerDay) return { reason: 'BUDGET', detail: 'the requests of the day have been made (' + state.day + ')' }
    return null
  }

  // --- the reading ------------------------------------------------------------------------------------------------------
  const reader = spendGuardedStructuredVision(input.adapter, ledger, { limits })
  const identity = identityOf(input.pkg)
  let outcome: TrialOutcome = 'MODEL'
  let code: string | null = null
  const more: Record<string, unknown> = {}
  try {
    const run = await runDescribedAnalysis({ pkg: input.pkg, cache: input.cache, reader, identity, now })
    const d = run.reading.description
    write('description.json', d)
    write('model.json', run.modelText)
    write('program.json', run.program)
    write('scene.json', run.sceneText)
    write('result.json', run.result)
    const technical = run.result.assessment?.technicalValidity ?? null
    write('diagnostics.json', {
      descriptionCheck: run.reading.issues,
      adjustments: run.adjustments,
      refusedByModel: run.refused,
      warnings: run.result.warningDetails,
      technicalValidity: technical,
      closure: run.result.verification?.closure ?? null,
    })
    // the build is a function of the description: the same description, built again, is the same bytes
    const again = [0, 1].map(() => describedResult({ pkg: input.pkg, identity, sourceUrl: input.pkg.canonicalUrl, jobId: null, reading: run.reading, after: null, startedAt: now().toISOString(), now }))
    const hashes = { model: sha256(run.modelText), scene: sha256(run.sceneText), program: sha256(JSON.stringify(run.program)) }
    const sameBytes = again.every((a) => sha256(a.modelText) === hashes.model && sha256(a.sceneText) === hashes.scene && sha256(JSON.stringify(a.program)) === hashes.program)
    Object.assign(more, {
      timings: run.timings,
      pictures: run.reading.pictures.map((p) => ({ number: p.number, kind: p.kind, original: p.byteHash, sent: p.sentSha256, sentBytes: p.sentBytes })),
      hashes: { description: sha256(JSON.stringify(d)), ...hashes },
      // a new reading against the SOURCES: the page's own figures, the check's findings, the sides no picture shows
      againstSources: { publishedFigures: publishedFiguresOf(input.pkg), disagreements: run.reading.issues.filter((i) => i.severity === 'WARN').map((i) => ({ code: i.code, detail: i.detail })), shape: shapeOf(d), note: 'whether the described house is the pictured one is a person looking at the pictures and the scene; this lists what can be compared without one' },
      ...(input.recorded ? { recordedEarlier: { shape: shapeOf(input.recorded), note: 'another reading of the same page, for its shape: two readings are not expected to be the same text' } } : {}),
      built: { adjustments: run.adjustments.map((a) => a.code), droppedOrStoodIn: run.adjustments.filter((a) => /DROPPED|STOOD_IN/.test(a.code)).length, refusedByModel: run.refused.length, technicalStatus: technical?.status ?? null, technicalErrors: technical?.errors ?? null },
      determinism: { what: 'the same description built again, twice', sameBytes, compared: ['model.json', 'scene.json', 'program.json'] },
    })
    if (!sameBytes) {
      outcome = 'NO_MODEL'
      code = 'BUILD_NOT_DETERMINISTIC'
    }
  } catch (e) {
    outcome = 'NO_MODEL'
    const message = String((e as Error).message)
    code = e instanceof DescribedRefusal ? e.code : e instanceof HouseReaderUnavailable ? 'READER_UNAVAILABLE' : 'ERROR'
    // why the reader was not available, as the adapter or the books named it (BUDGET, REJECTED_UNBILLED, TRANSPORT, …)
    let reader: string | null = e instanceof HouseReaderUnavailable ? e.reason : code === 'READER_UNAVAILABLE' ? (/^([A-Z_]+):/.exec(message)?.[1] ?? null) : null
    if (code === 'READER_UNAVAILABLE' && !reader) {
      // refused before any request, without a word why: the books or the adapter say which
      const why = whyUnasked()
      if (why) {
        reader = why.reason
        Object.assign(more, { why: why.detail })
      }
    }
    Object.assign(more, {
      message: message.slice(0, 400),
      ...(reader ? { reader } : {}),
      ...(e instanceof DescribedRefusal && e.issues.length > 0 ? { issues: e.issues.slice(0, 20) } : {}),
    })
    write('diagnostics.json', { refusal: { code, ...more } })
  }

  // --- the books, and the campaign's ledger -----------------------------------------------------------------------------
  let afterUsd = beforeUsd
  let requests: unknown = null
  try {
    if (!unopened()) {
      const after = ledger.read()
      afterUsd = after.cumulativeUsd
      requests = after.requests
    }
  } catch (e) {
    return finish('NO_MODEL', 'BOOKS_UNREADABLE_AFTER_RUN', { ...more, message: `the books could not be read after the run — look at them before another: ${String((e as Error).message).slice(0, 200)}` })
  }
  const bookedUsd = round6(afterUsd - beforeUsd)
  Object.assign(more, { booksAfterUsd: afterUsd, bookedUsd, remainingUsd: round6(ceilingUsd - afterUsd), requests })
  if (bookedUsd > 0) {
    const served = [...new Set(input.calls.map((c) => c.served).filter((m): m is string => typeof m === 'string'))]
    const usage = input.calls.reduce<{ inputTokens: number; outputTokens: number }>((sum, c) => { const u = c.usage as { input_tokens?: number; output_tokens?: number } | null | undefined; return { inputTokens: sum.inputTokens + (u?.input_tokens ?? 0), outputTokens: sum.outputTokens + (u?.output_tokens ?? 0) } }, { inputTokens: 0, outputTokens: 0 })
    const failed = input.calls.some((c) => c.failed === true)
    campaign.entries.push({
      at: now().toISOString(),
      stage: 'S53 house-reader trial (SDK)',
      what: `HOUSE_TRIAGE + HOUSE_DESCRIPTION ${input.pkg.id}`,
      modelRequested: input.adapter.provider.model,
      modelsReturned: served,
      authCategory: 'api-key',
      status: outcome === 'MODEL' ? 'OK' : `NO_MODEL ${code}`,
      estimatedCostUsd: bookedUsd,
      countedUsd: bookedUsd,
      usage,
      note: `counted from the API's usage at list prices by the product's spend books${failed ? '; a request failed in a way that may have been billed, so its reservation stands' : ''}; billing UNCONFIRMED until the provider's console shows it`,
    })
    writeFileSync(input.campaignLedger, `${JSON.stringify(campaign, null, 1)}\n`)
    Object.assign(more, { campaignLedgerAfterUsd: campaignSpentUsd(campaign) })
  }
  return finish(outcome, code, more)
}
