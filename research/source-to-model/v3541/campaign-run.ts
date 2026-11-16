/**
 * v3.54.1: the house loop of the live campaign, shared by the command (live-describe.ts, the real API) and its offline
 * self-check (selfcheck.ts, the same adapter over a stand-in client). Each house: the product's `runDescribedAnalysis`
 * with no drawings-path anchor, the reader being `live` behind the product's spend books and the recorder. Writes what
 * s53/product-path.ts writes, so the v3.54 tools read it unchanged.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { fileByteCache } from '@buildapp/source-package'
import type { SourceByteCache, SourcePackage } from '@buildapp/source-package'
import type { StructuredVision } from '@buildapp/source-vision'
import { DescribedRefusal, identityOf, runDescribedAnalysis, summaryOf } from '@buildapp/analysis-service'
import { serializeModel } from '@buildapp/model'
import { DEFAULT_SPEND_LIMITS, HOUSE_READER_PRICES, openSpendLedger, spendGuardedStructuredVision } from '../../../apps/analyzer-api/src/house-reader-spend.js'
import { renderSceneSheet } from '../../../packages/mobile-scene/scripts/scene-sheet.js'
import { recording } from './recording.js'

export type HouseLine = { house: string; pkgPath: string; cacheDir: string }
export type HouseOutcome = { house: string; outcome: 'MODEL' | 'NO_MODEL' | 'SKIPPED_DONE' | 'BUDGET_STOP'; code?: string; ms?: number; spentUsd: number }

export const parseHouseList = (text: string): HouseLine[] =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const [house, pkgPath, cacheDir] = l.split(/\s+/)
      if (!house || !pkgPath || !cacheDir) throw new Error(`a list line needs "<house> <source-package.json> <cache dir>": ${l.slice(0, 120)}`)
      return { house, pkgPath, cacheDir }
    })

/** A reader's refusal as runDescribedAnalysis reports it: the budget is the only one that stops the whole campaign. */
const isBudgetStop = (e: unknown): boolean => e instanceof DescribedRefusal && e.code === 'READER_UNAVAILABLE' && /^BUDGET:/.test(e.message)

export async function describeHouses(input: {
  houses: HouseLine[]
  outRoot: string
  booksDir: string
  ledgerPath: string
  phase: string
  maxUsd: number
  live: StructuredVision
  /** Whatever must never appear in a file or a line of output (the key); replaced by "[key]". */
  secret?: string
  /** A strategy's change to the request (C: crops), wrapped around the recorder so the recorded answer is the one asked. */
  variant?: (reader: StructuredVision, ctx: { cache: SourceByteCache; out: string }) => { reader: StructuredVision; onPictures?: (sent: Array<{ number: number; assetId: string; kind: string; sourceUrl: string | null; widthPx: number; heightPx: number }>) => void }
  log?: (line: string) => void
}): Promise<HouseOutcome[]> {
  const scrub = (text: string): string => (input.secret ? text.split(input.secret).join('[key]') : text)
  const log = input.log ?? ((line: string): void => console.log(line))
  const limits = { ...DEFAULT_SPEND_LIMITS, maxUsd: input.maxUsd, maxRequestsPerDay: 200, maxDescriptionsPerDay: 80 }
  const books = openSpendLedger({ dir: input.booksDir, limits })
  const guarded = spendGuardedStructuredVision(input.live, books, { limits, prices: HOUSE_READER_PRICES })
  const spent = (): number => {
    try {
      return books.read().cumulativeUsd
    } catch {
      return 0 // not opened yet: nothing was reserved
    }
  }
  const outcomes: HouseOutcome[] = []
  for (const { house, pkgPath, cacheDir } of input.houses) {
    const out = join(input.outRoot, house)
    mkdirSync(out, { recursive: true })
    if (existsSync(join(out, 'run.json'))) {
      outcomes.push({ house, outcome: 'SKIPPED_DONE', spentUsd: spent() })
      continue
    }
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as SourcePackage
    const recorded = recording(guarded, { books, out, phase: input.phase, house, ledgerPath: input.ledgerPath, ...(input.secret ? { secret: input.secret } : {}) })
    const cache = fileByteCache(cacheDir)
    const variant = input.variant ? input.variant(recorded, { cache, out }) : null
    const reader = variant ? variant.reader : recorded
    const t0 = Date.now()
    try {
      const run = await runDescribedAnalysis({ pkg, cache, reader, identity: identityOf(pkg), onPictures: (sent) => { sent.forEach((p) => writeFileSync(join(out, `sent-${String(p.number).padStart(2, '0')}.jpg`), p.bytes)); variant?.onPictures?.(sent) } })
      writeFileSync(join(out, 'result-summary.json'), JSON.stringify(summaryOf(run.result), null, 1))
      writeFileSync(join(out, 'model.json'), serializeModel(run.result.model))
      writeFileSync(join(out, 'description.json'), JSON.stringify(run.reading.description, null, 1))
      writeFileSync(join(out, 'scene-all-sides.png'), PNG.sync.write(renderSceneSheet(run.result.scene, 360, 'ALL')))
      const record = {
        outcome: 'MODEL',
        house,
        url: pkg.canonicalUrl,
        provider: run.reading.provider,
        picturesSent: run.reading.pictures.map((p) => ({ number: p.number, assetId: p.assetId, byteHash: p.byteHash, triage: p.kind, widthPx: p.widthPx, heightPx: p.heightPx })),
        triage: run.reading.triage,
        issues: run.reading.issues,
        adjustments: run.adjustments,
        refused: run.refused,
        warnings: run.result.warningDetails.map((w) => `${w.severity} ${w.code}`),
        counts: run.result.counts,
        technical: run.result.assessment.technicalValidity.status,
        timings: run.timings,
        usage: run.reading.usage,
        hashes: { model: run.result.modelSha256, scene: run.result.sceneSha256, sourcePackage: pkg.contentHash },
      }
      writeFileSync(join(out, 'run.json'), scrub(JSON.stringify(record, null, 1)))
      const o: HouseOutcome = { house, outcome: 'MODEL', ms: Date.now() - t0, spentUsd: spent() }
      outcomes.push(o)
      log(JSON.stringify(o))
    } catch (e) {
      const budget = isBudgetStop(e)
      const code = e instanceof DescribedRefusal ? e.code : 'ERROR'
      // a house stopped by the budget is not done: its recorded answers are used when it is run again
      writeFileSync(join(out, budget ? 'budget-stop.json' : 'run.json'), scrub(JSON.stringify({ outcome: 'NO_MODEL', house, url: pkg.canonicalUrl, code, message: String((e as Error).message).slice(0, 600), issues: e instanceof DescribedRefusal ? (e as DescribedRefusal & { issues?: unknown }).issues ?? null : null, ms: Date.now() - t0 }, null, 1)))
      const o: HouseOutcome = { house, outcome: budget ? 'BUDGET_STOP' : 'NO_MODEL', code: scrub(budget ? 'BUDGET' : code), ms: Date.now() - t0, spentUsd: spent() }
      outcomes.push(o)
      log(JSON.stringify(o))
      if (budget) break
    }
  }
  return outcomes
}
