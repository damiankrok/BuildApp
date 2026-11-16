/**
 * v3.54.2 — the consultant pilot on a list of sealed houses, through the service entrypoint `consultAnalysis`.
 *
 *   npx vite-node research/source-to-model/v3542/consult-run.ts -- --list <house pkg cache lines> --out <dir>
 *       --variant R|C --books <dir> --max-usd <cumulative ceiling> --phase <label> [--model claude-sonnet-5-5]
 *       [--replay <dir of an earlier run>]   (offline: the recorded answers, in order, instead of the API)
 *
 * The key is read by the transport from BUILDPLAN_ANTHROPIC_API_KEY in this process's environment; it is never an
 * argument, never printed, and every line written here is scrubbed of it. Each house writes consult.json (the
 * transaction: rounds, proposals, verdicts, decisions, states before/after), events.jsonl (everything sent and
 * received, pictures by hash and transform, no image bytes) and readings.json (the consumed readings, replayable with
 * second-house --consulted). Every billed request is reserved in the cumulative books before it is sent and gets one
 * line in research/ai-assist/spend-ledger-v3542.json.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { SourcePackageSchema, archonAdapter, fileByteCache, genericProjectPageAdapter, startDecoders } from '@buildapp/source-package'
import { workerImageEmbedder, workerRecogniser, workspaceAssetPaths, workspaceImageRolePaths } from '@buildapp/numeric-recogniser-ort'
import { bundleImageRoleWorker, bundleRecogniserWorker } from '../../../packages/numeric-recogniser-ort/build.mjs'
import { anthropicConsultant, consultAnalysis } from '../../../packages/analysis-service/src/index.js'
import type { ConsultEvent, ConsultSpend, ConsultantModel, ModelTurn } from '../../../packages/analysis-service/src/index.js'
import { DEFAULT_SPEND_LIMITS, HOUSE_READER_PRICES, openSpendLedger } from '../../../apps/analyzer-api/src/house-reader-spend.js'
import { PNG } from 'pngjs'
import { compileBuilding } from '@buildapp/geometry'
import { buildMobileSceneBundle } from '@buildapp/mobile-scene'
import { renderSceneSheet } from '../../../packages/mobile-scene/scripts/scene-sheet.js'
import type { AnalysisRun } from '../../../packages/analysis-service/src/index.js'

/** The model's views for the post-build check: the same nine cameras as every before/after board. */
export const VIEW_LABELS = 'one sheet of 5 x 2 tiles; top row left to right: front, right, rear, left (orthographic), top; bottom row: axonometrics from front-right, front-left, rear-left, rear-right'
export function viewsOf(run: AnalysisRun): { png: Uint8Array; width: number; height: number; labels: string } {
  const model = run.reconstruction.model
  const png = renderSceneSheet(buildMobileSceneBundle(model, { scene: compileBuilding(model) }), 300, 'ALL')
  return { png: new Uint8Array(PNG.sync.write(png)), width: png.width, height: png.height, labels: VIEW_LABELS }
}

export const LEDGER = 'research/ai-assist/spend-ledger-v3542.json'
const PRICE_SOURCE = 'list prices as in apps/analyzer-api HOUSE_READER_PRICES (platform.claude.com pricing, 2026-11-03); checked against the claude-api reference on 2026-11-16: Sonnet 5.5 $2/$10, Opus 5.5 $4/$20 per MTok'

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined
}

type LedgerEntry = { at: string; phase: string; house: string; variant: string; note: string; model: string; requestId: string | null; inputTokens: number | null; outputTokens: number | null; costUsd: number | null; latencyMs: number | null; booksCumulativeUsd: number }

function appendLedger(entry: LedgerEntry): void {
  const ledger = existsSync(LEDGER)
    ? (JSON.parse(readFileSync(LEDGER, 'utf8')) as { entries: LedgerEntry[] })
    : { schema: 'buildapp.ai-spend-ledger.v3542', currency: 'USD', costBasis: 'USAGE_PRICED', billing: 'NOT_RECONCILED_WITH_INVOICE', priceSource: PRICE_SOURCE, openingUsd: 4.11036, openingNote: 'v3.54.1 usage-priced total (132 requests), carried as the books’ balance; the S53 CLI estimate of 2.72807938 USD stays separate and is not added', entries: [] as LedgerEntry[] }
  ledger.entries.push(entry)
  const total = ledger.entries.reduce((s, e) => s + (e.costUsd ?? 0), 0)
  writeFileSync(LEDGER, `${JSON.stringify({ ...ledger, totalUsd: Math.round(total * 1e6) / 1e6, requests: ledger.entries.length }, null, 1)}\n`)
}

/** The recorded answers of an earlier run, handed back in the order they were received. */
function replayModel(dir: string, model: string): ConsultantModel {
  const turns: ModelTurn[] = readFileSync(join(dir, 'events.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as ConsultEvent)
    .filter((e) => e.kind === 'RESPONSE')
    .map((e) => ({ content: e.content as ModelTurn['content'], usage: {}, model: String(e.model), latencyMs: 0, ...(e.requestId ? { requestId: `replay:${String(e.requestId)}` } : {}) }))
  let i = 0
  return {
    // the recorded transport's id: a consulted reading names its engine, and the engine is part of the evidence the
    // next round's revision is hashed from — a replay must not change it (consult.json says replayOf)
    id: 'anthropic-messages',
    model,
    maxOutputTokens: 8000,
    send: async () => {
      if (i >= turns.length) throw new Error('REPLAY_EXHAUSTED: the recording has no further answer')
      return turns[i++]
    },
  }
}

async function main(): Promise<void> {
  const list = arg('list')
  const outRoot = arg('out')
  const variant = (arg('variant') ?? 'C') as 'R' | 'C'
  const phase = arg('phase') ?? 'dev'
  const replayRoot = arg('replay')
  const model = arg('model') ?? 'claude-sonnet-5-5'
  if (!list || !outRoot) throw new Error('give --list and --out')
  const price = HOUSE_READER_PRICES[model]
  if (!price) throw new Error(`no price for ${model}`)
  const key = process.env.BUILDPLAN_ANTHROPIC_API_KEY ?? ''
  const scrub = (t: string): string => (key ? t.split(key).join('[key]') : t)
  const books = replayRoot ? undefined : openSpendLedger({ dir: arg('books') ?? '/home/user/rd/v3542/books', limits: { ...DEFAULT_SPEND_LIMITS, maxUsd: Number(arg('max-usd') ?? '0'), maxRequestsPerDay: 400 }, openingUsd: 4.11036 })
  if (!replayRoot && !(Number(arg('max-usd') ?? '0') > 0)) throw new Error('give --max-usd (a cumulative ceiling)')
  await startDecoders()
  const worker = join(process.cwd(), '.cache', 'numeric-recogniser-ort', 'ocr-worker.mjs')
  await bundleRecogniserWorker(worker)
  const roleWorker = join(process.cwd(), '.cache', 'numeric-recogniser-ort', `image-role-worker-${process.pid}.mjs`)
  await bundleImageRoleWorker(roleWorker)
  const houses = readFileSync(list, 'utf8').split('\n').map((l) => l.trim().split(/\s+/)).filter((p) => p.length >= 3 && !p[0].startsWith('#'))
  for (const [house, pkgPath, cachePath] of houses) {
    const out = join(outRoot, house)
    if (existsSync(join(out, 'consult.json'))) {
      process.stdout.write(`${house}: done before, skipped\n`)
      continue
    }
    mkdirSync(out, { recursive: true })
    const events = join(out, 'events.jsonl')
    writeFileSync(events, '')
    const record = (e: ConsultEvent): void => appendFileSync(events, `${scrub(JSON.stringify(e))}\n`)
    const spend: ConsultSpend | undefined = books
      ? {
          reserve: (m, usd, note) => {
            const r = books.reserve('CONSULTATION', m, usd)
            return { id: r.id, usd: r.reservedUsd, note }
          },
          settle: (r, actual, note) => books.settle({ id: r.id, purpose: 'CONSULTATION', model, reservedUsd: r.usd }, actual, note),
        }
      : undefined
    const live = replayRoot ? replayModel(join(replayRoot, house), model) : anthropicConsultant({ model, maxOutputTokens: 8000 })
    // every response is booked in the campaign ledger as it arrives
    const ledgered: ConsultantModel = {
      ...live,
      send: async (req) => {
        const t = await live.send(req)
        if (!replayRoot) {
          const it = t.usage.inputTokens ?? null
          const ot = t.usage.outputTokens ?? null
          appendLedger({ at: new Date().toISOString(), phase, house, variant, note: 'consultation turn', model: t.model, requestId: t.requestId ?? null, inputTokens: it, outputTokens: ot, costUsd: it !== null && ot !== null ? Math.round(((it * price.inputUsdPerMTok + ot * price.outputUsdPerMTok) / 1e6) * 1e6) / 1e6 : null, latencyMs: t.latencyMs, booksCumulativeUsd: books?.read().cumulativeUsd ?? 0 })
        }
        return t
      },
    }
    const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(pkgPath, 'utf8')))
    const recogniser = workerRecogniser({ workerUrl: pathToFileURL(worker), paths: workspaceAssetPaths() })
    const content = workerImageEmbedder({ workerUrl: pathToFileURL(roleWorker), paths: workspaceImageRolePaths() })
    const t0 = Date.now()
    try {
      const r = await consultAnalysis({ kind: 'PACKAGE', pkg }, { adapters: [archonAdapter, genericProjectPageAdapter], cache: fileByteCache(cachePath), offline: true, recogniser, content }, { model: ledgered, price, ...(spend ? { spend } : {}), variant, record, maxRounds: Number(arg('max-rounds') ?? '2'), ...(process.argv.includes('--no-model-check') ? {} : { views: viewsOf }) })
      const { run, error, ...rest } = r
      writeFileSync(join(out, 'consult.json'), scrub(`${JSON.stringify({ house, phase, variant, model, replayOf: replayRoot ?? null, ms: Date.now() - t0, ...rest, finalError: error ? error.failure() : null, finalModelHash: run?.reconstruction.candidate.modelHash ?? null, packageHash: createHash('sha256').update(readFileSync(pkgPath)).digest('hex') }, null, 1)}\n`))
      writeFileSync(join(out, 'readings.json'), `${JSON.stringify(r.readings, null, 1)}\n`)
      writeFileSync(join(out, 'spans.json'), `${JSON.stringify(r.spans, null, 1)}\n`)
      process.stdout.write(`${house}: ${r.local.outcome}${r.local.reasonCode ? `/${r.local.reasonCode}` : ''} -> ${r.final.outcome}${r.final.reasonCode ? `/${r.final.reasonCode}` : ''}; rounds ${r.rounds.map((x) => x.decision).join(',')}; ${r.usd.toFixed(4)} USD\n`)
    } catch (e) {
      writeFileSync(join(out, 'failure.json'), scrub(`${JSON.stringify({ house, error: (e as Error).message.slice(0, 500) }, null, 1)}\n`))
      process.stdout.write(`${house}: FAILED ${scrub((e as Error).message).slice(0, 200)}\n`)
    } finally {
      await recogniser.release?.()
      await content.release?.()
    }
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    process.stderr.write(`${(e as Error).message}\n`)
    process.exit(1)
  },
)
