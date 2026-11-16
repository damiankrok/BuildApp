/** v3.54.2: offline check of what the consultant would be shown (problem, overview, crops) from a stage-A run dir. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { decodeImage, fileByteCache, startDecoders } from '@buildapp/source-package'
import { frameRasters } from '@buildapp/source-cv'
import { labelCropOf, labelProblemOf, overviewOf } from '../../../packages/analysis-service/src/index.js'
const [runDir, cacheDir, out] = process.argv.slice(2).filter((a) => a !== '--')
await startDecoders()
const metrics = JSON.parse(readFileSync(join(runDir, 'metric-evidence.json'), 'utf8'))
const graph = JSON.parse(readFileSync(join(runDir, 'observation-graph.json'), 'utf8'))
const pkg = JSON.parse(readFileSync(join(runDir, 'source-package.json'), 'utf8'))
const diag = (() => { try { return JSON.parse(readFileSync(join(runDir, 'plan-diagnostics', 'digest.json'), 'utf8')) } catch { return {} } })()
const failure = (() => { try { return JSON.parse(readFileSync(join(runDir, 'failure.json'), 'utf8')) } catch { return undefined } })()
const frameId = failure?.diagnostics?.selectedPlanFrameId ?? diag.selectedPlanFrameId
const frame = graph.coordinateFrames.find((f: { id: string }) => f.id === frameId)
const asset = pkg.assets.find((a: { id: string }) => a.id === frame.assetId)
const variant = asset.variants.find((v: { byteHash: string }) => v.byteHash === frame.variantByteHash)
const got = await fileByteCache(cacheDir).get(variant.url)
const rasters = frameRasters()
rasters.set(variant.byteHash, decodeImage(got!.bytes))
rasters.useFrames(graph.coordinateFrames)
const raster = rasters.get(variant.byteHash)!
const problem = labelProblemOf(metrics, frameId, frame.assetId)
mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'problem.json'), JSON.stringify(problem, null, 1))
if (problem) {
  const o = overviewOf(raster, frameId, problem.labels)
  writeFileSync(join(out, 'overview.png'), o.png)
  for (const l of problem.labels) writeFileSync(join(out, `${l.labelId}.png`), labelCropOf(raster, l).png)
}
console.log(frameId, problem?.labels.map((l) => `${l.labelId}:${l.lattices.map((x) => x.asRead + '/' + x.orientation[0]).join('|')}${l.binding ? '@' + l.binding.spanPx : ''}`).join(' '))
