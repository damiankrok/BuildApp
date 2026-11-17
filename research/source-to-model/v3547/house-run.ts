/**
 * v3.54.4 — the whole-house reading on a list of source packages: variant H (live or replayed).
 * v3.54.7: the review's defects, source/render pairs and re-readings are written (review.json); the choice holds both
 * models to the characteristic features (D41) and the delivered model carries a quality status.
 *
 *   BUILDPLAN_ANTHROPIC_API_KEY=… npx vite-node research/source-to-model/v3547/house-run.ts -- \
 *       --list <file: "<slug> <source-package.json> <cache dir>" per line> --out <dir> --phase <smoke|dev|confirm> \
 *       --max-usd <cumulative ceiling on the books> [--local <root of LOCAL runs, <root>/<slug>/model.json>] \
 *       [--replay <root of an earlier run>] [--reuse <root> --fresh STEP,STEP] [--only <slug>] [--no-review] [--plan-only]
 *
 * Every billed request is reserved in the cumulative books before it is sent and written to the campaign ledger when it
 * returns. With --replay no request is sent: the recorded answers go through today's converter, resolver and builder.
 * The key is read from the environment by the transport and written nowhere. Outputs hold publishers' pictures'
 * readings and stay outside Git.
 */
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SourcePackageSchema, fileByteCache, startDecoders } from '@buildapp/source-package'
import { parseModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import { buildMobileSceneBundle, serializeBundle } from '@buildapp/mobile-scene'
import { anthropicConsultant } from '../../../packages/analysis-service/src/consult/anthropic.js'
import { renderModelViews } from '../../../packages/analysis-service/src/consult/model-views.js'
import { housePictures } from '../../../packages/analysis-service/src/house/pictures.js'
import { HOUSE_READING_LIMITS, ReadingFailed, readFacades, readInventory, readPlan } from '../../../packages/analysis-service/src/house/read.js'
import type { ReadingContext, ReadingRecord, ReadingStep } from '../../../packages/analysis-service/src/house/read.js'
import { arbitrate, compileHouse, documentFromReading, planFactsForFacades } from '../../../packages/analysis-service/src/house/describe.js'
import type { CompiledHouse, LocalMeasure } from '../../../packages/analysis-service/src/house/describe.js'
import { deliveredQuality } from '../../../packages/analysis-service/src/house/describe.js'
import type { DefectRecord } from '../../../packages/analysis-service/src/house/review.js'
import { reviewHouse } from '../../../packages/analysis-service/src/house/review.js'
import { measureScene } from '../../../packages/analysis-service/src/house/measure.js'
import { DEFAULT_SPEND_LIMITS, HOUSE_READER_PRICES, openSpendLedger } from '../../../apps/analyzer-api/src/house-reader-spend.js'

export const LEDGER = 'research/ai-assist/spend-ledger-v3547.json'
const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined
}
const flag = (name: string): boolean => process.argv.includes(`--${name}`)

type LedgerEntry = { at: string; phase: string; house: string; variant: string; note: string; model: string; requestId: string | null; inputTokens: number | null; outputTokens: number | null; costUsd: number | null }
function appendLedger(entry: LedgerEntry): void {
  const lock = `${LEDGER}.lock`
  for (let i = 0; ; i += 1) {
    try {
      closeSync(openSync(lock, 'wx'))
      break
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST' || i > 2000) throw e
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10)
    }
  }
  try {
    const ledger = existsSync(LEDGER)
      ? (JSON.parse(readFileSync(LEDGER, 'utf8')) as { entries: LedgerEntry[] })
      : { schema: 'buildapp.ai-spend-ledger.v3546', currency: 'USD', costBasis: 'USAGE_PRICED', billing: 'NOT_RECONCILED_WITH_INVOICE', priceSource: 'list prices as in apps/analyzer-api HOUSE_READER_PRICES: Sonnet 5.5 $2/$10 per MTok', openingUsd: 19.27633, openingNote: 'the cumulative books as v3.54.5 left them (19.27633 USD); this ledger lists the v3.54.6 requests only; ceiling 24.11036 USD cumulative', entries: [] as LedgerEntry[] }
    ledger.entries.push(entry)
    const total = ledger.entries.reduce((s, e) => s + (e.costUsd ?? 0), 0)
    writeFileSync(LEDGER, `${JSON.stringify({ ...ledger, totalUsd: Math.round(total * 1e6) / 1e6, requests: ledger.entries.length }, null, 1)}\n`)
  } finally {
    unlinkSync(lock)
  }
}

function localMeasureOf(dir: string): LocalMeasure | undefined {
  const path = join(dir, 'model.json')
  if (!existsSync(path)) return undefined
  const model = parseModel(readFileSync(path, 'utf8'))
  const bundle = buildMobileSceneBundle(model as never, { scene: compileBuilding(model as never) })
  const m = measureScene(bundle)
  // v3.54.6: the saved LOCAL run is an archive: nothing is written into it (measure-scene.ts measures it elsewhere)
  const raw = JSON.parse(readFileSync(path, 'utf8')) as { slabs?: Array<{ levelId: string; polygon: Array<{ x: number; z: number }> }>; levels?: Array<{ id: string; elevation: number }>; roofPlanes?: unknown[]; roofs?: unknown[] }
  const groundLevel = (raw.levels ?? []).slice().sort((p, q) => p.elevation - q.elevation).find((l) => l.elevation >= -0.01)?.id
  const shoelace = (p: Array<{ x: number; z: number }>): number => Math.abs(p.reduce((s, a, i) => s + a.x * p[(i + 1) % p.length].z - p[(i + 1) % p.length].x * a.z, 0)) / 2
  const ground = (raw.slabs ?? []).filter((s) => s.levelId === groundLevel)
  if (!m.exteriorWalls) return undefined
  return { widthM: m.exteriorWalls.widthM, depthM: m.exteriorWalls.depthM, heightAboveTerrainM: null, topAboveGroundFloorM: m.roofTopY ?? m.buildingTopY, groundAreaM2: ground.length ? ground.reduce((s, x) => s + shoelace(x.polygon), 0) : null, roofPlanes: (raw.roofPlanes ?? []).length + (raw.roofs ?? []).length, groundPolygons: ground.map((x) => x.polygon), levelElevations: (raw.levels ?? []).map((l) => l.elevation), rooms: ((raw as { rooms?: unknown[] }).rooms ?? []).length, interiorWalls: ((raw as { walls?: Array<{ kind?: string }> }).walls ?? []).filter((w) => w.kind === 'INTERIOR').length, openings: m.openings, sides: m.sides }
}

async function main(): Promise<void> {
  const list = arg('list')
  const outRoot = arg('out')
  const phase = arg('phase') ?? 'dev'
  const replayRoot = arg('replay')
  const localRoot = arg('local')
  const reuseRoot = arg('reuse')
  const fresh = (arg('fresh') ?? '').split(',').filter(Boolean)
  const only = arg('only')
  const model = arg('model') ?? 'claude-sonnet-5-5'
  if (!list || !outRoot) throw new Error('give --list and --out')
  const price = HOUSE_READER_PRICES[model]
  if (!price) throw new Error(`no price for ${model}`)
  const key = process.env.BUILDPLAN_ANTHROPIC_API_KEY ?? ''
  const scrub = (t: string): string => (key ? t.split(key).join('[key]') : t)
  const books = replayRoot ? undefined : openSpendLedger({ dir: arg('books') ?? '/home/user/rd/v3542/books', limits: { ...DEFAULT_SPEND_LIMITS, maxUsd: Number(arg('max-usd') ?? '0'), maxRequestsPerDay: 600 }, openingUsd: 4.11036 })
  await startDecoders()
  const rows = readFileSync(list, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => l.split(/\s+/))
  for (const [house, pkgPath, cacheDir] of rows) {
    if (only && house !== only) continue
    const out = join(outRoot, house)
    mkdirSync(join(out, 'answers'), { recursive: true })
    const t0 = Date.now()
    const records: ReadingRecord[] = []
    let spentUsd = 0
    const transports = new Map<ReadingStep, ReturnType<typeof anthropicConsultant>>()
    const ctx: ReadingContext = {
      modelFor: (step) => {
        if (!transports.has(step)) transports.set(step, anthropicConsultant({ model, maxOutputTokens: HOUSE_READING_LIMITS.maxOutputTokens[step], timeoutMs: 300_000 }))
        return transports.get(step) as ReturnType<typeof anthropicConsultant>
      },
      price,
      ...(books ? { spend: { reserve: (m: string, usd: number) => { const r = books.reserve('CONSULTATION', m, usd); return { id: r.id, usd: r.reservedUsd } }, settle: (r: { id: string; usd: number }, actual: { usd: number; inputTokens: number; outputTokens: number } | 'NOT_SENT', note?: string) => books.settle({ id: r.id, purpose: 'CONSULTATION', model, reservedUsd: r.usd }, actual, note) } } : {}),
      ...(replayRoot || reuseRoot
        ? {
            // --replay: nothing is sent. --reuse: a recorded answer is taken where there is one, except the steps named in --fresh
            replay: (step: ReadingStep, round: number) => {
              if (!replayRoot && fresh.includes(step)) return undefined
              const p = join((replayRoot ?? reuseRoot) as string, house, 'answers', `${step}${round ? `-${round}` : ''}.json`)
              return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as ReadingRecord) : undefined
            },
            replayOnly: Boolean(replayRoot),
          }
        : {}),
      record: (r) => {
        records.push(r)
        writeFileSync(join(out, 'answers', `${r.step}${r.round ? `-${r.round}` : ''}.json`), `${scrub(JSON.stringify(r, null, 1))}\n`)
        if (!replayRoot && ((r.usage.inputTokens ?? 0) > 0 || (r.usage.outputTokens ?? 0) > 0)) {
          const it = (r.usage.inputTokens ?? 0) + (r.usage.cacheReadInputTokens ?? 0) + (r.usage.cacheCreationInputTokens ?? 0)
          const ot = r.usage.outputTokens ?? 0
          const cost = Math.round(((it * price.inputUsdPerMTok + ot * price.outputUsdPerMTok) / 1e6) * 1e6) / 1e6
          spentUsd += cost
          appendLedger({ at: new Date().toISOString(), phase, house, variant: 'H', note: `house reading ${r.step}${r.round ? ` round ${r.round}` : ''}`, model: r.model, requestId: r.requestId ?? null, inputTokens: it, outputTokens: ot, costUsd: cost })
        }
      },
    }
    const summary: Record<string, unknown> = { house, phase, variant: 'H', model, replayOf: replayRoot ?? null }
    try {
      const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(pkgPath, 'utf8')))
      const published = (pkg.publishedFacts ?? []).filter((f) => typeof f.value === 'number').map((f) => ({ key: f.key, value: f.value as number, unit: String(f.unit ?? ''), ...(f.raw ? { raw: String(f.raw) } : {}) }))
      const { pictures, skipped } = await housePictures(pkg.assets as never, fileByteCache(cacheDir))
      summary.pictures = pictures.length
      summary.skippedPictures = skipped.length
      const inventory = await readInventory(ctx, pictures, `publisher: ${pkg.project?.publisher ?? 'unknown'}`)
      if (!inventory.selection) throw new ReadingFailed('SOURCE_UNKNOWN', inventory.why ?? 'no plan')
      const selection = inventory.selection
      summary.selection = { ground: selection.ground.id, upperPlans: selection.upperPlans.length, sections: selection.sections.length, elevations: selection.elevations.length, views: selection.views.length, notThisHouse: selection.notThisHouse.length }
      const plan = await readPlan(ctx, selection, published)
      const roleOf = new Map(pkg.assets.map((a) => [a.id, a.roles.document === 'ELEVATION' || a.roles.document === 'SECTION' ? a.roles.document : undefined]))
      const base = { id: `h-${house}`.slice(0, 80), project: pkg.project?.name, sourcePackageHash: pkg.contentHash, model, selection, planSent: plan.sent, published, at: arg('date') ?? new Date().toISOString().slice(0, 10), skipped: skipped.map((x) => ({ ...x, ...(roleOf.get(x.assetId) ? { role: roleOf.get(x.assetId) as string } : {}) })) }
      // the plan alone, resolved: the bodies in metres, so that the facades are bound to bodies the plan defines
      const planOnly = compileHouse(documentFromReading({ ...base, answers: { plan: plan.answer } }).document, `plan-${house}`)
      const bodiesInMetres = planOnly.document.geometry ? planFactsForFacades(planOnly.document.geometry) : ''
      let compiled: CompiledHouse
      let reviewDefects: DefectRecord[] = []
      let notes: ReturnType<typeof documentFromReading>['notes'] = []
      let observationsDocument: unknown
      // --plan-only (ablation): the plan's dimensions, outline and bodies alone, as if no section or elevation was read
      if (!flag('plan-only') && selection.elevations.length + selection.sections.length > 0) {
        const facades = await readFacades(ctx, selection, plan.answer, bodiesInMetres, published)
        const converted = documentFromReading({ ...base, facadesSent: facades.sent, coverage: facades.coverage, answers: { inventory: inventory.answer, plan: plan.answer, facades: facades.answer } })
        summary.facadeCoverage = facades.coverage
        notes = converted.notes
        observationsDocument = converted.document
        compiled = compileHouse(JSON.parse(JSON.stringify(converted.document)), `house-${house}`)
        writeFileSync(join(out, 'house-first.json'), `${JSON.stringify(compiled.document, null, 1)}\n`)
        if (!flag('no-review') && compiled.bundle) {
          const reviewed = await reviewHouse({ ctx, selection, facadesSent: facades.sent, observationsDocument: converted.document, compiled, modelId: `house-${house}`, writeView: (name, png) => writeFileSync(join(out, name), png) })
          compiled = reviewed.compiled
          observationsDocument = reviewed.observationsDocument
          writeFileSync(join(out, 'proposals.json'), `${JSON.stringify(reviewed.proposals, null, 1)}\n`)
          writeFileSync(join(out, 'review.json'), `${JSON.stringify({ defects: reviewed.defects, pairs: reviewed.pairs, supplements: reviewed.supplements }, null, 1)}\n`)
          reviewDefects = reviewed.defects
          summary.review = { rounds: reviewed.rounds, proposals: reviewed.proposals.length, applied: reviewed.proposals.filter((p) => p.state === 'APPLIED').length, verdicts: reviewed.verdicts }
        }
      } else {
        const converted = documentFromReading({ ...base, answers: { inventory: inventory.answer, plan: plan.answer } })
        notes = converted.notes
        observationsDocument = converted.document
        compiled = compileHouse(JSON.parse(JSON.stringify(converted.document)), `house-${house}`)
      }
      writeFileSync(join(out, 'observations.json'), `${JSON.stringify(observationsDocument, null, 1)}\n`)
      const local = localRoot ? localMeasureOf(join(localRoot, house)) : undefined
      const decision = arbitrate(compiled, local, published, { defects: reviewDefects })
      decision.quality = deliveredQuality(decision, reviewDefects)
      writeFileSync(join(out, 'house.json'), `${JSON.stringify(compiled.document, null, 1)}\n`)
      writeFileSync(join(out, 'trace.json'), `${JSON.stringify({ conversionNotes: notes, rejected: compiled.rejected ?? null, checks: compiled.document.verification?.checks ?? [], held: compiled.document.verification?.held ?? [], knownDefects: compiled.document.verification?.knownDefects ?? [], kernelRefusals: compiled.built?.kernelRefusals ?? [], compileErrors: compiled.compileErrors, arbitration: decision, local: local ?? null }, null, 1)}\n`)
      if (compiled.bundle && compiled.modelJson) {
        writeFileSync(join(out, 'model.json'), compiled.modelJson)
        writeFileSync(join(out, 'scene.json'), serializeBundle(compiled.bundle))
        writeFileSync(join(out, 'measured.json'), `${JSON.stringify(compiled.measured, null, 1)}\n`)
        for (const v of renderModelViews(compiled.bundle, 520)) writeFileSync(join(out, `views-${v.name}.png`), v.png)
      }
      const checks = compiled.document.verification?.checks ?? []
      Object.assign(summary, { status: compiled.rejected ? 'PARSE_REJECTED' : compiled.bundle ? 'BUILT' : 'NOT_RESOLVED', failedChecks: compiled.failed.length, checks: { pass: checks.filter((c) => c.status === 'PASS').length, fail: checks.filter((c) => c.status === 'FAIL').length }, held: compiled.document.verification?.held?.length ?? 0, kernelRefusals: compiled.built?.kernelRefusals.length ?? 0, compileErrors: compiled.compileErrors.length, modelHash: compiled.modelHash ?? null, widthM: compiled.measured?.exteriorWalls?.widthM ?? null, depthM: compiled.measured?.exteriorWalls?.depthM ?? null, heightAboveTerrainM: compiled.measured?.heightAboveTerrainM ?? null, counts: compiled.measured?.counts ?? null, accepted: decision.accepted, decisionCode: decision.code, partial: decision.partial, contradictions: decision.contradictions, interior: decision.interior, why: decision.why, quality: decision.quality?.status ?? null, qualityWhy: decision.quality?.why ?? null, sides: compiled.measured?.sides ?? null, conversionNotes: notes.length, houseStatus: compiled.document.verification?.status ?? null, views: (compiled.document.verification?.views ?? []).map((v) => ({ side: v.side, state: v.state, registered: v.registered, read: v.read.openings + v.read.features, built: v.built.openings + v.built.features, build: v.build })), openingFits: (compiled.document.verification?.openings ?? []).reduce((acc: Record<string, number>, o) => ({ ...acc, [o.fit]: (acc[o.fit] ?? 0) + 1 }), {}) })
    } catch (e) {
      Object.assign(summary, { status: e instanceof ReadingFailed ? e.code : 'ERROR', error: scrub((e as Error).message).slice(0, 500) })
    }
    Object.assign(summary, { requests: replayRoot ? 0 : records.filter((r) => (r.usage.inputTokens ?? 0) > 0).length, spentUsd: Math.round(spentUsd * 1e6) / 1e6, seconds: Math.round((Date.now() - t0) / 1000) })
    writeFileSync(join(out, 'summary.json'), `${JSON.stringify(summary, null, 1)}\n`)
    appendFileSync(join(outRoot, 'runs.jsonl'), `${JSON.stringify(summary)}\n`)
    process.stdout.write(`${house}: ${JSON.stringify(summary).slice(0, 900)}\n`)
  }
}

main().catch((e) => {
  const key = process.env.BUILDPLAN_ANTHROPIC_API_KEY ?? ''
  process.stderr.write(`${(key ? String((e as Error).stack ?? e).split(key).join('[key]') : String((e as Error).stack ?? e)).slice(0, 2000)}\n`)
  process.exit(1)
})
