/**
 * 005X-N3: the public URL route end to end (acquisition → observations → metrics → v2 solver), for a page on any
 * publisher. On a refusal it keeps what the run had produced (package, graph, metric evidence, plan diagnostics) so the
 * FIRST_BAD can be read; on success it writes the model. Everything goes OUTSIDE the repository; RESEARCH ONLY.
 *
 *   npx vite-node research/analyzer-005x-n3-cross-provider/run-url.ts -- <url> <cacheDir> <outDir>
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { serializeModel } from '@buildapp/model'
import { archonAdapter, fileByteCache, genericProjectPageAdapter } from '@buildapp/source-package'
import { AnalysisError, runAnalysis } from '@buildapp/analysis-service'

const [url, cacheDir, outDir] = process.argv.slice(2)
if (!url || !cacheDir || !outDir) throw new Error('usage: run-url.ts <url> <cacheDir> <outDir>')
const REPO = resolve(import.meta.dirname, '../..')
const out = resolve(outDir)
if (out === REPO || out.startsWith(`${REPO}/`)) throw new Error('REFUSED: outputs never go inside the repository')
mkdirSync(out, { recursive: true })
const json = (name: string, data: unknown): void => writeFileSync(`${out}/${name}`, JSON.stringify(data, null, 1))
const t0 = Date.now()
try {
  const run = await runAnalysis({ kind: 'URL', url }, { adapters: [archonAdapter, genericProjectPageAdapter], cache: fileByteCache(resolve(cacheDir)), identity: { slug: 'url-run', label: 'URL run', modelId: 'm-url-run' } })
  const model = serializeModel(run.reconstruction.model)
  writeFileSync(`${out}/model.json`, model)
  json('metrics.json', run.metrics)
  json('graph.json', run.graph)
  json('building.json', run.reconstruction.building)
  json('plans.json', run.planDiagnostics)
  json('steps.json', run.reconstruction.steps)
  json('unresolved.json', run.reconstruction.unresolved)
  console.log(JSON.stringify({ ok: true, ms: Date.now() - t0, modelSha256: createHash('sha256').update(model).digest('hex'), timings: run.timings }))
} catch (e) {
  if (!(e instanceof AnalysisError)) throw e
  const a = e.attachments ?? {}
  if (a.pkg) json('package.json', a.pkg)
  if (a.graph) json('graph.json', a.graph)
  if (a.metrics) json('metrics.json', a.metrics)
  if (a.plans) json('plans.json', a.plans)
  console.log(JSON.stringify({ ok: false, ms: Date.now() - t0, code: e.code, message: e.message, detail: e.detail }))
}
