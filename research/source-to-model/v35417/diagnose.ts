/**
 * v3.54.17 §8 — first loss of information on a frozen package, LOCAL alone, no model request (0 USD): is there a
 * source, was it read, was it bound, is there a consumer, was it built, and what exactly blocks. Writes the failure
 * (or the model's summary), the plan diagnostics and the partial readings the run reached.
 *   npx vite-node research/source-to-model/v35417/diagnose.ts -- --url <project url> --cache <dir> --out <dir>
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { archonAdapter, fileByteCache, genericProjectPageAdapter, startDecoders } from '@buildapp/source-package'
import { stableJson } from '@buildapp/source-common'
import { workerImageEmbedder, workerRecogniser, workspaceAssetPaths, workspaceImageRolePaths } from '@buildapp/numeric-recogniser-ort'
// @ts-expect-error untyped build helper
import { bundleImageRoleWorker, bundleRecogniserWorker } from '../../../packages/numeric-recogniser-ort/build.mjs'
import { runAnalysis } from '../../../packages/analysis-service/src/run.js'

const argv = process.argv.slice(2).filter((a) => a !== '--')
const opt = (n: string): string | undefined => (argv.indexOf(`--${n}`) >= 0 ? argv[argv.indexOf(`--${n}`) + 1] : undefined)
const out = opt('out') as string
mkdirSync(out, { recursive: true })
await startDecoders()
const rw = join(process.cwd(), '.cache', 'numeric-recogniser-ort', 'ocr-worker.mjs')
await bundleRecogniserWorker(rw)
const recogniser = workerRecogniser({ workerUrl: pathToFileURL(rw), paths: workspaceAssetPaths() })
const cw = join(process.cwd(), '.cache', 'numeric-recogniser-ort', `image-role-worker-${process.pid}.mjs`)
await bundleImageRoleWorker(cw)
const content = workerImageEmbedder({ workerUrl: pathToFileURL(cw), paths: workspaceImageRolePaths() })
const summary: Record<string, unknown> = { url: opt('url') }
try {
  const r = await runAnalysis({ kind: 'URL', url: opt('url') as string }, { adapters: [archonAdapter, genericProjectPageAdapter], cache: fileByteCache(opt('cache') as string), offline: true, recogniser, content })
  const m = r.reconstruction.model
  summary.outcome = 'MODEL'
  summary.model = { levels: m.levels.map((l) => [l.id, l.elevation, l.height]), walls: m.walls.length, exterior: m.walls.filter((w) => w.kind === 'EXTERIOR').length, roofs: m.roofs.map((x) => ({ id: x.id, kind: x.kind, pitchDeg: x.pitchDeg, ridgeAxis: x.ridgeAxis, footprint: x.footprint, levelId: x.levelId })), roofPlanes: m.roofPlanes.length, openings: m.openings.length }
  summary.layout = (r.reconstruction as { layout?: unknown }).layout ?? null
  writeFileSync(join(out, 'model.json'), JSON.stringify(m))
  writeFileSync(join(out, 'graph.json'), stableJson(r.graph))
  writeFileSync(join(out, 'plan-diagnostics.json'), stableJson(r.planDiagnostics ?? null))
} catch (e) {
  const err = e as { code?: string; message: string; detail?: Record<string, unknown>; attachments?: Record<string, unknown> }
  summary.outcome = 'FAILED'
  summary.code = err.code
  summary.message = err.message
  summary.detail = err.detail
  const att = err.attachments ?? {}
  summary.attachments = Object.keys(att)
  if (att.plans) writeFileSync(join(out, 'plan-diagnostics.json'), stableJson(att.plans))
  if (att.graph) writeFileSync(join(out, 'graph.json'), stableJson(att.graph))
  if (att.metrics) writeFileSync(join(out, 'metrics.json'), stableJson(att.metrics))
  if (att.trace) writeFileSync(join(out, 'trace.json'), stableJson(att.trace))
}
writeFileSync(join(out, 'summary.json'), `${JSON.stringify(summary, null, 1)}\n`)
process.stdout.write(`${JSON.stringify(summary, null, 1).slice(0, 3000)}\n`)
process.exit(0)
