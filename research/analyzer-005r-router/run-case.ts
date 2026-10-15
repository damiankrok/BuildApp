/**
 * run-case.ts — BUILDPLAN-ANALYZER-005R-ROUTER one development row through the production pipeline
 * (RESEARCH ONLY; never imported by production).
 *
 *   npx vite-node [--config <variant>/vite.config.mjs] research/analyzer-005r-router/run-case.ts -- \
 *        --package <source-package.json> --cache <byte cache dir> --out <dir outside the repository>
 *
 * Unlike the 005Q-CHAIN replays (which replayed a sealed observation graph), the observation graph is extracted
 * again from the sealed package and the cached publisher bytes (OFFLINE), so a variant of `@buildapp/source-analyzer`
 * aliased by --config reaches the model. The PP-OCRv6 recogniser runs in its worker, as on the phone.
 *
 * Kept (outside Git; numbers and ids only, never pixels): observation-graph.json.gz, candidate.json.gz, metric-evidence.json.gz,
 * model.json, summary.json (the run summary without its two wall-clock fields), perf.json.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { stableJson } from '@buildapp/source-common'
import { serializeModel } from '@buildapp/model'
import { SourcePackageSchema, archonAdapter, fileByteCache, genericProjectPageAdapter } from '@buildapp/source-package'
import { runAnalysis, summaryOf } from '../../packages/analysis-service/src/index.js'
import { workerRecogniser, workspaceAssetPaths } from '@buildapp/numeric-recogniser-ort'
// @ts-expect-error — a plain ES module without type declarations
import { bundleRecogniserWorker } from '../../packages/numeric-recogniser-ort/build.mjs'

const REPO = resolve(import.meta.dirname, '../..')
const argv = process.argv
const value = (name: string): string => {
  const i = argv.indexOf(`--${name}`)
  if (i < 0 || i + 1 >= argv.length) throw new Error(`--${name} is required`)
  return argv[i + 1]
}
const out = resolve(value('out'))
if (out === REPO || out.startsWith(`${REPO}/`)) throw new Error('REFUSED: replay outputs never go inside the repository')
mkdirSync(out, { recursive: true })
const sealed = SourcePackageSchema.parse(JSON.parse(readFileSync(value('package'), 'utf8')))
// --shuffle <seed>: permute the package's asset list (a seeded Fisher–Yates), so order invariance is tested inside a
// package and not only across rows. The sealed content hash is carried unchanged: only the list order moves.
const shuffleSeed = argv.includes('--shuffle') ? value('shuffle') : null
const permuted = [...sealed.assets]
if (shuffleSeed) {
  let state = BigInt(`0x${createHash('sha256').update(shuffleSeed).digest('hex').slice(0, 15)}`)
  for (let i = permuted.length - 1; i > 0; i -= 1) {
    state = (state * 6364136223846793005n + 1442695040888963407n) & 0xfffffffffffffffn
    const j = Number(state % BigInt(i + 1))
    ;[permuted[i], permuted[j]] = [permuted[j], permuted[i]]
  }
}
const pkg = { ...sealed, assets: permuted }
const cache = fileByteCache(value('cache'))
const worker = join(REPO, '.cache', 'numeric-recogniser-ort', 'ocr-worker.mjs')
await bundleRecogniserWorker(worker)
const recogniser = workerRecogniser({ workerUrl: pathToFileURL(worker), paths: workspaceAssetPaths() })

const t0 = performance.now()
const phaseMs: Record<string, number> = {}
let run: Awaited<ReturnType<typeof runAnalysis>>
try {
run = await runAnalysis({ kind: 'PACKAGE', pkg }, {
  adapters: [archonAdapter, genericProjectPageAdapter],
  cache,
  offline: true,
  recogniser,
  onPhaseStats: (stats) => {
    for (const s of stats as Array<{ phase: string; ms?: number; wallMs?: number }>) phaseMs[s.phase] = s.ms ?? s.wallMs ?? 0
  },
})
} catch (error) {
  // A typed refusal is an outcome to compare like any other: keep its code and the graph it carries.
  const e = error as { code?: string; detail?: { reasonCode?: string }; attachments?: { graph?: unknown; metrics?: { contentHash?: string } }; message?: string }
  if (!e.code) throw error
  if (e.attachments?.graph) writeFileSync(join(out, 'observation-graph.json.gz'), gzipSync(`${stableJson(e.attachments.graph)}\n`, { level: 9 }))
  writeFileSync(join(out, 'failure.json'), `${stableJson({ code: e.code, reasonCode: e.detail?.reasonCode ?? null, metricEvidenceHash: e.attachments?.metrics?.contentHash ?? null, message: e.message })}\n`)
  process.stdout.write(`failed ${e.code}\n`)
  process.exit(0)
}
const totalMs = Math.round(performance.now() - t0)
const gz = (name: string, data: unknown): void => writeFileSync(join(out, `${name}.gz`), gzipSync(`${stableJson(data)}\n`, { level: 9 }))
gz('observation-graph.json', run.graph)
gz('candidate.json', run.result.candidate)
gz('metric-evidence.json', run.metrics)
writeFileSync(join(out, 'model.json'), serializeModel(run.result.model))
const { startedAt: _s, completedAt: _c, ...summary } = summaryOf(run.result) as unknown as Record<string, unknown>
writeFileSync(join(out, 'summary.json'), `${stableJson(summary)}\n`)
writeFileSync(join(out, 'perf.json'), `${stableJson({ node: process.version, arch: process.arch, totalMs, peakRssMB: Math.round(process.resourceUsage().maxRSS / 1024), phaseMs, timings: run.timings })}\n`)
process.stdout.write(`completed ${pkg.project?.externalId ?? pkg.id} model ${(summary as { modelHash: string }).modelHash} graph ${(summary as { observationGraphHash: string }).observationGraphHash} ${totalMs} ms\n`)
process.exit(0)
