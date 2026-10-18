/**
 * seal-case.ts — 005T preview-first: one development row through the production pipeline with its N1v observation
 * graph REPLAYED (so drawings are not re-read) and one offline metric pass (PP-OCR in its worker, as on the phone),
 * sealing the metric evidence EVEN WHEN the solver refuses — the N1v failure rows kept only the graph
 * (RESEARCH ONLY; never imported by production).
 *
 *   npx vite-node research/analyzer-005t-preview-first/seal-case.ts -- \
 *        --package <source-package.json> --cache <byte cache dir> --graph <N1v observation-graph.json.gz> --out <dir outside the repo>
 *
 * Written outside Git, numbers and ids only: metric-evidence.json.gz, failure.json | summary.json, model.json.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'
import { stableJson } from '@buildapp/source-common'
import { serializeModel } from '@buildapp/model'
import { SourcePackageSchema, archonAdapter, fileByteCache, genericProjectPageAdapter } from '@buildapp/source-package'
import { runAnalysis, summaryOf } from '../../packages/analysis-service/src/index.js'
import { workerRecogniser, workspaceAssetPaths } from '@buildapp/numeric-recogniser-ort'
// @ts-expect-error — a plain ES module without type declarations
import { bundleRecogniserWorker } from '../../packages/numeric-recogniser-ort/build.mjs'

const REPO = resolve(import.meta.dirname, '../..')
const value = (name: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0 || i + 1 >= process.argv.length) throw new Error(`--${name} is required`)
  return process.argv[i + 1]
}
const out = resolve(value('out'))
if (out === REPO || out.startsWith(`${REPO}/`)) throw new Error('REFUSED: outputs never go inside the repository')
mkdirSync(out, { recursive: true })
const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(value('package'), 'utf8')))
if (!['www.archon.pl', 'www.projektydomownowoczesnych.pl'].includes(new URL(pkg.canonicalUrl).host)) throw new Error('REFUSED: publisher not screened USABLE_FOR_LOCAL_RESEARCH')
const graph = JSON.parse(gunzipSync(readFileSync(value('graph'))).toString('utf8'))
const worker = join(REPO, '.cache', 'numeric-recogniser-ort', 'ocr-worker.mjs')
await bundleRecogniserWorker(worker)
const recogniser = workerRecogniser({ workerUrl: pathToFileURL(worker), paths: workspaceAssetPaths() })
const gz = (name: string, data: unknown): void => writeFileSync(join(out, `${name}.gz`), gzipSync(`${stableJson(data)}\n`, { level: 9 }))
const t0 = performance.now()
try {
  const run = await runAnalysis({ kind: 'PACKAGE', pkg, graph }, { adapters: [archonAdapter, genericProjectPageAdapter], cache: fileByteCache(value('cache')), offline: true, recogniser })
  gz('metric-evidence.json', run.metrics)
  writeFileSync(join(out, 'model.json'), serializeModel(run.result.model))
  const { startedAt: _s, completedAt: _c, ...summary } = summaryOf(run.result) as unknown as Record<string, unknown>
  writeFileSync(join(out, 'summary.json'), `${stableJson(summary)}\n`)
  process.stdout.write(`completed ${(summary as { modelHash: string }).modelHash} ${Math.round(performance.now() - t0)} ms\n`)
} catch (error) {
  const e = error as { code?: string; detail?: Record<string, unknown>; attachments?: { metrics?: { contentHash?: string } }; message?: string }
  if (!e.code) throw error
  if (e.attachments?.metrics) gz('metric-evidence.json', e.attachments.metrics)
  writeFileSync(join(out, 'failure.json'), `${stableJson({ code: e.code, reasonCode: e.detail?.reasonCode ?? null, detail: e.detail ?? null, metricEvidenceHash: e.attachments?.metrics?.contentHash ?? null, message: e.message })}\n`)
  process.stdout.write(`failed ${e.code} ${Math.round(performance.now() - t0)} ms\n`)
}
process.exit(0)
