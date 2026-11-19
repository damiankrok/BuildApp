/**
 * v3.54.14 — L-MS: the SAME metric facts as L-M (its package, graph, metric evidence and consulted readings, reused, not
 * read again) plus the four automatic coloured sketches:
 *   1. each registered elevation read by the API into typed contours (`readElevationSketch`, recorded; --replay at 0 USD);
 *   2. drawn locally at the frame's size (`renderSketch`) and checked for proportions against the registration of the
 *      ORIGINAL elevation, the model's extent along that side and its ridge (`checkProportions`); REJECTED is not used;
 *   3. FORM: the accepted sketches read by the shape reader in place of the originals (`elevationSketches`);
 *   4. FINISH: their wall zones applied by the appearance consumer (usable-geometry fingerprint guarded).
 *
 *   npx vite-node research/source-to-model/v35414/lms-run.ts -- --lm <L-M out dir> --cache <dir> --out <dir> --house <name>
 *       (--live | --replay <dir>/sketch-turns.json) [--model claude-sonnet-5-5] [--no-form] [--no-finish]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseModel, serializeModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import { buildMobileSceneBundle, serializeBundle } from '@buildapp/mobile-scene'
import { archonAdapter, decodeImage, fileByteCache, genericProjectPageAdapter, startDecoders } from '@buildapp/source-package'
import { frameRasters } from '@buildapp/source-cv'
import { stableJson } from '@buildapp/source-common'
import { workerImageEmbedder, workerRecogniser, workspaceAssetPaths, workspaceImageRolePaths } from '@buildapp/numeric-recogniser-ort'
// @ts-expect-error — a plain ES module without type declarations
import { bundleImageRoleWorker, bundleRecogniserWorker } from '../../../packages/numeric-recogniser-ort/build.mjs'
import { runAnalysis } from '../../../packages/analysis-service/src/run.js'
import { anthropicConsultant } from '../../../packages/analysis-service/src/consult/anthropic.js'
import type { ConsultantModel, ModelTurn } from '../../../packages/analysis-service/src/consult/loop.js'
import { measureBuilt } from '../../../packages/analysis-service/src/consult/metric-read.js'
import { applyAppearance, usableGeometryFingerprint } from '../../../packages/analysis-service/src/appearance/index.js'
import { checkProportions, readElevationSketch, renderSketch, renderSketchPng, sketchToAppearance } from '../../../packages/analysis-service/src/appearance/elevation-sketch.js'
import type { ElevationSketch } from '../../../packages/analysis-service/src/appearance/elevation-sketch.js'
import { facadeAxes } from '../../../packages/analysis-service/src/appearance/visibility.js'
import { ledgerSpend } from './ledger.js'

const argv = process.argv.slice(2).filter((a) => a !== '--')
const opt = (n: string): string | undefined => (argv.indexOf(`--${n}`) >= 0 ? argv[argv.indexOf(`--${n}`) + 1] : undefined)
const lm = opt('lm') as string
const out = opt('out') as string
mkdirSync(join(out, 'sketches'), { recursive: true })
const house = opt('house') ?? 'house'
const modelId = opt('model') ?? 'claude-sonnet-5-5'
const PRICE = modelId === 'claude-opus-5-5' ? { inputUsdPerMTok: 4, outputUsdPerMTok: 20 } : { inputUsdPerMTok: 2, outputUsdPerMTok: 10 }
const J = (f: string): any => JSON.parse(readFileSync(join(lm, f), 'utf8'))
const pkg = J('source-package.json')
const graph = J('observation-graph.json')
const metrics = J('metric-evidence.json')
const consulted = J('consulted.json') as { readings: unknown[]; spans: unknown[] }
const alignment = J('facade-alignment.json') as { views: Array<{ facade: 'FRONT' | 'REAR' | 'EAST' | 'WEST'; frameId: string; projection: { alongAtPx0: number; alongSign: number; mpp: number; zeroRow: number } }> }
const lmModel = parseModel(readFileSync(join(lm, 'model.json'), 'utf8'))
const cache = fileByteCache(opt('cache') as string)

type Recorded = { turn: ModelTurn }
const turns: Recorded[] = []
let transport: ConsultantModel
if (argv.includes('--live')) {
  const live = anthropicConsultant({ model: modelId, maxOutputTokens: 6000, timeoutMs: 240_000, effort: 'medium' })
  if (!live.available()) throw new Error('no API key in this process environment: --live refused')
  transport = { ...live, send: async (req) => { const t = await live.send(req); turns.push({ turn: t }); writeFileSync(join(out, 'sketch-turns.json'), `${JSON.stringify(turns, null, 1)}\n`); return t } }
} else {
  const rec = JSON.parse(readFileSync(opt('replay') as string, 'utf8')) as Recorded[]
  let i = 0
  transport = { id: 'replay', model: rec[0]?.turn.model ?? modelId, maxOutputTokens: 6000, send: async () => { const r = rec[i++]; if (!r) throw new Error('replay: no recorded turn left'); return { ...r.turn, usage: { inputTokens: 0, outputTokens: 0 } } } }
}
const spend = argv.includes('--live') ? ledgerSpend({ phase: 'elevation-sketch', house, variant: 'L-MS' }) : undefined

await startDecoders()
const rasters = frameRasters()
rasters.useFrames(graph.coordinateFrames)
const rasterOfFrame = async (frameId: string) => {
  const f = graph.coordinateFrames.find((x: { id: string }) => x.id === frameId)
  const a = pkg.assets.find((x: { id: string }) => x.id === f.assetId)
  const v = a.variants.find((x: { byteHash: string }) => x.byteHash === f.variantByteHash)
  const got = await cache.get(v.url)
  rasters.set(v.byteHash, decodeImage(got!.bytes))
  return { raster: rasters.get(v.byteHash)!, caption: a.caption as string, sourceByteHash: v.byteHash as string }
}

// the model's extent along each side (outer faces) and its ridge: what the sketch's proportions are checked against
const scene = compileBuilding(lmModel)
const measured = measureBuilt(lmModel, scene)
// the printed levels both readers agree on — the API's section read (L-M's metric consultant) and the analyzer's own
// datum OCR: the sketch's proportions are tested against the drawing's printed heights, never against a built roof
const lmRead = J('metric-read.json') as { reads: Array<{ observations: Array<{ kind: string; value: number | null; hostHint?: string; literal: string }> }> } | null
const localLevels = (metrics.evidence ?? []).filter((e: { kind: string; value?: number }) => e.kind === 'LEVEL_DATUM' && typeof e.value === 'number').map((e: { value: number }) => e.value)
const agreed = (lmRead?.reads ?? []).flatMap((r) => r.observations).filter((o) => o.kind === 'LEVEL' && o.value !== null && localLevels.some((v: number) => Math.abs(v - (o.value as number)) <= 0.005))
const printedRidge = agreed.length > 0 ? Math.max(...agreed.map((o) => o.value as number)) : undefined
const printedEaves = agreed.find((o) => /eave|okap/i.test(o.hostHint ?? ''))?.value ?? undefined
process.stdout.write(`printed levels agreed by both readers: ${agreed.map((o) => `${o.literal} (${o.hostHint ?? '?'})`).join(', ') || 'none'}\n`)
const extentAlong = (facade: 'FRONT' | 'REAR' | 'EAST' | 'WEST'): [number, number] => {
  const ax = facadeAxes(facade)
  let lo = Infinity
  let hi = -Infinity
  for (const m of scene.meshes) if (m.part === 'WALL') for (const t of m.triangles) for (const p of [t.a, t.b, t.c]) { const a = ax.along(p.x, p.z); lo = Math.min(lo, a); hi = Math.max(hi, a) }
  return [lo, hi]
}
const openingsAlong = (facade: 'FRONT' | 'REAR' | 'EAST' | 'WEST') => {
  const ax = facadeAxes(facade)
  const out: Array<{ id: string; a0: number; a1: number; b0: number; b1: number }> = []
  for (const m of scene.meshes) {
    if (!m.openingId || !/GLASS|LEAF|PANEL/.test(m.part)) continue
    const n = ax.toViewer
    const pts = m.triangles.flatMap((t) => [t.a, t.b, t.c])
    // only openings facing this side: their glass normal along the viewer direction
    const t = m.triangles[0]
    const u = { x: t.b.x - t.a.x, z: t.b.z - t.a.z }
    const v = { x: t.c.x - t.a.x, z: t.c.z - t.a.z }
    const ny = { x: u.z * 0 - 0, z: 0 }
    void ny
    const nx = (t.b.y - t.a.y) * v.z - u.z * (t.c.y - t.a.y)
    const nz = u.x * (t.c.y - t.a.y) - (t.b.y - t.a.y) * v.x
    const len = Math.hypot(nx, nz) || 1
    if (Math.abs((nx * n.x + nz * n.z) / len) < 0.9) continue
    const as = pts.map((p) => ax.along(p.x, p.z))
    const ys = pts.map((p) => p.y)
    if (out.some((o) => o.id === m.openingId)) continue
    out.push({ id: m.openingId, a0: Math.min(...as), a1: Math.max(...as), b0: Math.min(...ys), b1: Math.max(...ys) })
  }
  return out
}

const sketches: Array<{ facade: string; frameId: string; sketch?: ElevationSketch; check?: ReturnType<typeof checkProportions>; usd: number; failed?: string; sourceByteHash: string }> = []
for (const view of alignment.views) {
  const fr = await rasterOfFrame(view.frameId)
  const r = await readElevationSketch({ model: transport, price: PRICE, ...(spend ? { spend } : {}) }, { frameId: view.frameId, raster: fr.raster, caption: fr.caption })
  if (!r.sketch) {
    sketches.push({ facade: view.facade, frameId: view.frameId, usd: r.usd, failed: r.failed, sourceByteHash: fr.sourceByteHash })
    continue
  }
  const [lo, hi] = extentAlong(view.facade)
  const check = checkProportions(r.sketch, { alongSign: view.projection.alongSign, alongMin: lo, alongMax: hi, ...(printedRidge !== undefined ? { ridge: printedRidge } : {}), ...(printedEaves !== undefined && printedEaves !== null ? { eaves: printedEaves } : {}), openings: openingsAlong(view.facade), local: view.projection })
  writeFileSync(join(out, 'sketches', `${view.facade}.json`), `${stableJson({ sketch: r.sketch, raw: r.raw, check, requestId: r.requestId ?? null })}\n`)
  writeFileSync(join(out, 'sketches', `${view.facade}.png`), renderSketchPng(r.sketch))
  sketches.push({ facade: view.facade, frameId: view.frameId, sketch: r.sketch, check, usd: r.usd, sourceByteHash: fr.sourceByteHash })
  process.stdout.write(`${view.facade}: ${r.sketch.walls.length} walls, ${r.sketch.openings.length} openings, ${r.sketch.elements.length} elements, ${r.sketch.refused.length} refused; proportions ${check.verdict} (${check.why})\n`)
}
const accepted = sketches.filter((s) => s.sketch && s.check?.verdict === 'ACCEPTED')

// FORM: the shape reader on the accepted sketches, the metric facts L-M's (reused, never read again)
let formModel = lmModel
let formRun: Awaited<ReturnType<typeof runAnalysis>> | undefined
if (!argv.includes('--no-form') && accepted.length > 0) {
  const rw = join(process.cwd(), '.cache', 'numeric-recogniser-ort', 'ocr-worker.mjs')
  await bundleRecogniserWorker(rw)
  const cw = join(process.cwd(), '.cache', 'numeric-recogniser-ort', `image-role-worker-${process.pid}.mjs`)
  await bundleImageRoleWorker(cw)
  formRun = await runAnalysis({ kind: 'PACKAGE', pkg, graph }, {
    adapters: [archonAdapter, genericProjectPageAdapter],
    cache,
    offline: true,
    recogniser: workerRecogniser({ workerUrl: pathToFileURL(rw), paths: workspaceAssetPaths() }),
    content: workerImageEmbedder({ workerUrl: pathToFileURL(cw), paths: workspaceImageRolePaths() }),
    ...(consulted.readings.length > 0 ? { consulted: consulted.readings as never } : {}),
    ...(consulted.spans.length > 0 ? { consultedSpans: consulted.spans as never } : {}),
    ...(consulted.readings.length + consulted.spans.length > 0 ? { crossAxisWitness: true } : {}),
    reuseMetrics: metrics,
    elevationSketches: accepted.map((s) => ({ frameId: s.frameId, raster: renderSketch(s.sketch as ElevationSketch) })),
  })
  formModel = formRun.reconstruction.model
}
// FINISH: the sketches' wall zones on the form model, each by its OWN registration (one scale from its wall ends against
// the plans' extent, ±0.00 from its ridge against the section) — the solver's registration of the original may carry
// the eaves in its span (Bakopy: 0.25–0.5 m per end), which would shift every boundary by as much
const projections = new Map(accepted.map((s) => [`${s.facade}|${s.frameId}`, s.check?.projection as { alongAtPx0: number; alongSign: number; mpp: number; zeroRow: number }]))
const observations = argv.includes('--no-finish') ? [] : accepted.map((s) => sketchToAppearance(s.sketch as ElevationSketch, s.facade as never, s.sourceByteHash))
const frameOfHash = new Map(accepted.map((s) => [s.sourceByteHash, s.frameId]))
const finish = observations.length > 0 ? applyAppearance(formModel, observations, (f, h) => projections.get(`${f}|${frameOfHash.get(h)}`)) : undefined
const finalModel = finish?.model ?? formModel
writeFileSync(join(out, 'model.json'), serializeModel(finalModel))
writeFileSync(join(out, 'scene.json'), serializeBundle(buildMobileSceneBundle(finalModel, { scene: compileBuilding(finalModel) })))
writeFileSync(join(out, 'form-model.json'), serializeModel(formModel))
writeFileSync(join(out, 'result.json'), `${stableJson({
  house,
  sketches: sketches.map((s) => ({ facade: s.facade, frameId: s.frameId, verdict: s.check?.verdict ?? 'NO_SKETCH', why: s.check?.why ?? s.failed, residuals: s.check?.residuals, openings: s.check?.openings, walls: s.sketch?.walls.length, openingsRead: s.sketch?.openings.length, usd: s.usd })),
  form: formRun ? { ran: true, sketchesUsed: accepted.length, lmFingerprint: usableGeometryFingerprint(lmModel), formFingerprint: usableGeometryFingerprint(formModel), changed: usableGeometryFingerprint(lmModel) !== usableGeometryFingerprint(formModel), measuredLm: measured, measuredForm: measureBuilt(formModel, compileBuilding(formModel)) } : { ran: false, why: accepted.length === 0 ? 'no sketch passed the proportion check' : '--no-form' },
  finish: finish ? { traces: finish.traces.map((t) => ({ facade: t.facade, added: t.added.length, removed: t.removed.length, inferred: t.inferredUnderOcclusion })), fingerprintUnchanged: finish.fingerprintAfter === finish.fingerprintBefore } : null,
  usd: sketches.reduce((a, s) => a + s.usd, 0),
})}\n`)
process.stdout.write(`L-MS ${house}: ${accepted.length}/${sketches.length} sketches accepted; form ${formRun ? (usableGeometryFingerprint(lmModel) !== usableGeometryFingerprint(formModel) ? 'CHANGED the geometry' : 'same geometry as L-M') : 'not run'}; finish ${finish ? finish.traces.map((t) => `${t.facade} +${t.added.length}`).join(' ') : 'none'}\n`)
process.exit(0)
