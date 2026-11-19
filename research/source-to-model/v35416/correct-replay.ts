/**
 * v3.54.16 — the correction executor on a SAVED run (its model, its registrations, its package and graph) and the
 * ORIGINAL source bytes, with proposals from a file: no analyzer run, no request. For replay and controlled cases; the
 * product path is `consultAnalysis` (the same `executeCorrections`).
 *
 *   npx vite-node research/source-to-model/v35416/correct-replay.ts -- --run <run dir> --cache <byte cache dir>
 *     --proposals <proposals.json> --out <dir> [--model <model.json instead of run/model.json>] [--inject <commands.json>]
 *
 * proposals.json: [{ proposalId, operation, targetId, frameId, patch, origin, group?, defectId? }] — frame pixels;
 * baseRevision "BASE" is replaced by the revision of the model the executor starts from.
 * --inject: commands applied first (a controlled defect), recorded as such; the executor then starts from that model.
 * Writes outcome.json, model-before.json, model-after.json and overlay-<frame>.png (the source with the model's openings
 * and stacks before in red, after in green).
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { applyCommands } from '../../../packages/commands/src/index.js'
import type { BuildingCommand } from '../../../packages/commands/src/index.js'
import type { CanonicalBuildingModel } from '../../../packages/model/src/index.js'
import { decodeImage, startDecoders } from '../../../packages/source-package/src/image.js'
import { encodePng } from '../../../packages/analysis-service/src/diagnostics.js'
import { executeCorrections, modelRevision, openingBoxes, viewsOfRun } from '../../../packages/analysis-service/src/consult/correct/execute.js'
import type { BindPicture, BindView, CorrectionProposal, PrintedWitness } from '../../../packages/analysis-service/src/consult/correct/execute.js'
import { proposalsFromSketch } from '../../../packages/analysis-service/src/consult/correct/from-sketch.js'
import type { ElevationSketch } from '../../../packages/analysis-service/src/appearance/elevation-sketch.js'

const argv = process.argv.slice(2).filter((a) => a !== '--')
const opt = (n: string): string | undefined => (argv.indexOf(`--${n}`) >= 0 ? argv[argv.indexOf(`--${n}`) + 1] : undefined)
const run = opt('run') as string
const out = opt('out') as string
mkdirSync(out, { recursive: true })
const read = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T
let model = read<CanonicalBuildingModel>(opt('model') ?? join(run, 'model.json'))
const fa = read<{ views: Parameters<typeof viewsOfRun>[0] }>(join(run, 'facade-alignment.json'))
const pkg = read<{ assets: Array<{ id: string; variants: Array<{ url: string; byteHash: string }> }> }>(join(run, 'source-package.json'))
const graph = read<{ coordinateFrames: Array<{ id: string; assetId: string; variantByteHash: string; roles: { projection: string; view?: string } }> }>(join(run, 'observation-graph.json'))
const cacheFile = (url: string): string => join(opt('cache') as string, `${createHash('sha256').update(url).digest('hex').slice(0, 32)}.bin`)

await startDecoders()
const pictures: BindPicture[] = []
for (const f of graph.coordinateFrames.filter((x) => x.roles.projection === 'ORTHOGRAPHIC_ELEVATION')) {
  const v = pkg.assets.find((a) => a.id === f.assetId)?.variants.find((x) => x.byteHash === f.variantByteHash)
  if (!v || !existsSync(cacheFile(v.url))) continue
  const bytes = new Uint8Array(readFileSync(cacheFile(v.url)))
  if (createHash('sha256').update(bytes).digest('hex') !== f.variantByteHash) throw new Error(`cached bytes of ${f.id} are not the package's`)
  pictures.push({ n: pictures.length + 1, frameId: f.id, projection: f.roles.projection, transform: { x0: 0, y0: 0, scale: 1 }, raster: decodeImage(bytes), sourceByteHash: f.variantByteHash })
}
const injected: unknown[] = []
if (opt('inject')) {
  const cmds = read<BuildingCommand[]>(opt('inject') as string)
  const r = applyCommands(model, cmds)
  if (r.failedAt !== undefined) throw new Error(`the controlled defect does not apply: ${JSON.stringify(r.results[r.failedAt])}`)
  model = r.model
  injected.push(...cmds)
}
const views: BindView[] = viewsOfRun(fa.views)
const before = model
const revision = modelRevision(model)
const fromFile = opt('proposals') ? read<CorrectionProposal[]>(opt('proposals') as string).map((p) => ({ ...p, baseRevision: p.baseRevision === 'BASE' ? revision : p.baseRevision })) : []
// --sketches: the run's own saved sketch answers (API readings of the original elevations), each element a proposal
const sketchAccounts = opt('sketches') ? read<{ reading: { sketches: Array<{ facade: string; sketch?: ElevationSketch }> } }>(opt('sketches') as string).reading.sketches.filter((x) => x.sketch).map((x) => proposalsFromSketch(x.sketch as ElevationSketch, x.facade, model, viewsOfRun(fa.views), revision)) : []
const proposals = [...fromFile, ...sketchAccounts.flatMap((a) => a.proposals)]
const witnesses = existsSync(join(run, 'witnesses.json')) ? read<PrintedWitness[]>(join(run, 'witnesses.json')) : []
const outcome = executeCorrections({ model, views, pictures, proposals, witnesses })
writeFileSync(join(out, 'model-before.json'), `${JSON.stringify(before, null, 1)}\n`)
writeFileSync(join(out, 'model-after.json'), `${JSON.stringify(outcome.model, null, 1)}\n`)
const { model: _m, ...rest } = outcome
void _m
writeFileSync(join(out, 'outcome.json'), `${JSON.stringify({ injected, sketchAccounts: sketchAccounts.map((a) => ({ ...a, proposals: a.proposals.map((p) => p.proposalId) })), views: views.map((v) => ({ side: v.side, frameId: v.frameId, heights: v.heights })), ...rest }, null, 1)}\n`)

// overlays: the source picture with the model's openings and stacks, before (red) and after (green)
const draw = (data: Uint8ClampedArray, w: number, h: number, b: { x0: number; y0: number; x1: number; y1: number }, c: [number, number, number], inset: number): void => {
  const put = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    data.set([...c, 255], (y * w + x) * 4)
  }
  const [x0, y0, x1, y1] = [Math.round(b.x0) - inset, Math.round(b.y0) - inset, Math.round(b.x1) + inset, Math.round(b.y1) + inset]
  for (let x = x0; x <= x1; x += 1) { put(x, y0); put(x, y1) }
  for (let y = y0; y <= y1; y += 1) { put(x0, y); put(x1, y) }
}
for (const v of outcome.views) {
  const pic = pictures.find((p) => p.frameId === v.frameId)
  if (!pic) continue
  const data = new Uint8ClampedArray(pic.raster.data)
  for (const o of openingBoxes(before, v)) draw(data, pic.raster.width, pic.raster.height, o.box, [220, 30, 30], 2)
  for (const o of openingBoxes(outcome.model, v)) draw(data, pic.raster.width, pic.raster.height, o.box, [20, 170, 60], 0)
  for (const r of outcome.records.filter((x) => x.bound?.frameId === v.frameId && x.bound.box)) draw(data, pic.raster.width, pic.raster.height, r.bound?.box as never, r.status === 'COMMITTED' ? [20, 90, 220] : [240, 160, 0], 4)
  writeFileSync(join(out, `overlay-${v.side}.png`), encodePng({ width: pic.raster.width, height: pic.raster.height, data }))
}
process.stdout.write(`${revision} → ${outcome.revision}\n${outcome.records.map((r) => `  ${r.proposalId} ${r.operation} ${r.targetId}: ${r.status}${r.code ? ` ${r.code}` : ''} — ${r.why.slice(0, 160)}${r.gate ? ` [gate ${r.gate.winner} p=${r.gate.proposedZ} c=${r.gate.currentZ ?? '-'} n=${r.gate.nullBoxes}]` : ''}${r.measure ? ` [measure iou=${r.measure.iouWithProposal} z=${r.measure.builtSupportZ}]` : ''}`).join('\n')}\n`)
process.exit(0)
