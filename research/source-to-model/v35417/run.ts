/**
 * v3.54.17 (from v3.54.16) — the same runner; the sketch channel now also proposes SET_ROOF per body (massing/ops.ts), books into the v3.54.17 ledger.
 *
 * v3.54.16 (from v3.54.15) — adds the post-build check through the correction executor: --check-live (the reviewer on a live
 * transport) or --check-replay <check-turns.json>, --geometry-rounds N, --sketch-corrections OFF to compare without the
 * sketch channel; writes corrections.json (every executor run), quality.json, check-turns.json; books into the v3.54.16
 * ledger. --inject-ops <json> is NOT here: controlled defects run through correct-replay.ts.
 *
 * v3.54.15 (from v3.54.14) — one house through the SAME service path the host runs; v3.54.15 adds --strict, --prompt-cache 5m|1h on live transports (not --cache, which names the byte cache), replayed answers booked NOT_SENT, and every sketch written as PNG + SVG + canonical JSON (with the fate of each element) + its raw answer. L-M (`consultAnalysis`), with the metric consultant
 * ON and nothing else of the consultant (no label rounds, no post-build check), so its effect is its own.
 *
 *   npx vite-node research/source-to-model/v35415/run.ts -- --url <page> --cache <dir> --out <dir> --house <name>
 *       [--live] [--replay <dir>/turns.json] [--variant C|R] [--model claude-opus-5-5]
 *
 * --live sends real requests (key from the host's secret, books in research/ai-assist/spend-ledger-v35415.json; refused
 * past the stage ceiling); every turn is recorded (turns.json: content, usage, request id) so a later run replays the
 * same answers at 0 USD with --replay. Without either, the consultant has no transport and the result is LOCAL's.
 * Outputs: metric-read.json (independent reads raw + canonical, checks, resolution, applied, measured), model.json,
 * scene.json, result.json.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { serializeModel } from '@buildapp/model'
import { archonAdapter, fileByteCache, genericProjectPageAdapter, startDecoders } from '@buildapp/source-package'
import { stableJson } from '@buildapp/source-common'
import { pathToFileURL } from 'node:url'
import { workerImageEmbedder, workerRecogniser, workspaceAssetPaths, workspaceImageRolePaths } from '@buildapp/numeric-recogniser-ort'
// @ts-expect-error — a plain ES module without type declarations
import { bundleImageRoleWorker, bundleRecogniserWorker } from '../../../packages/numeric-recogniser-ort/build.mjs'
import { anthropicConsultant } from '../../../packages/analysis-service/src/consult/anthropic.js'
import { CONSULT_PRICES } from '../../../packages/analysis-service/src/consult/cost.js'
import { consultAnalysis } from '../../../packages/analysis-service/src/consult/consult-analysis.js'
import type { ConsultantModel, ModelTurn } from '../../../packages/analysis-service/src/consult/loop.js'
import { factTrace } from './fact-trace.js'
import { ledgerSpend } from './ledger.js'
import { renderModelViews } from '../../../packages/analysis-service/src/consult/model-views.js'
import { renderSketchPng, renderSketchSvg } from '../../../packages/analysis-service/src/appearance/elevation-sketch.js'

const argv = process.argv.slice(2).filter((a) => a !== '--')
const opt = (n: string): string | undefined => (argv.indexOf(`--${n}`) >= 0 ? argv[argv.indexOf(`--${n}`) + 1] : undefined)
const out = opt('out') as string
mkdirSync(out, { recursive: true })
const house = opt('house') ?? 'house'
const modelId = opt('model') ?? 'claude-opus-5-5'
const PRICES = CONSULT_PRICES
const strict = argv.includes('--strict')
const cacheTtl = opt('prompt-cache') === '5m' || opt('prompt-cache') === '1h' ? (opt('prompt-cache') as '5m' | '1h') : undefined
if (argv.includes('--prompt-cache') && !cacheTtl) throw new Error(`--prompt-cache takes 5m or 1h, not ${opt('prompt-cache')}`)
process.stderr.write(`transport: strict=${strict} promptCache=${cacheTtl ?? 'off'}\n`)
const transportOpts = { ...(strict ? { strict: true } : {}), ...(cacheTtl ? { cache: { ttl: cacheTtl } } : {}) }

type Recorded = { request: { systemSha: string; note: string; latencyMs?: number; at?: string }; turn: ModelTurn }
const turns: Recorded[] = []
let transport: ConsultantModel
// L-MS: the sketch step's own transport (Sonnet), live or replayed; the metric facts stay L-M's (its turns replayed)
const sketchTurns: Recorded[] = []
let sketchTransport: ConsultantModel | undefined
if (argv.includes('--sketch-live')) {
  const live = anthropicConsultant({ model: 'claude-sonnet-5-5', maxOutputTokens: 6000, timeoutMs: 240_000, effort: 'medium', ...transportOpts })
  if (!live.available()) throw new Error('no API key in this process environment: --sketch-live refused')
  sketchTransport = { ...live, send: async (req) => { const t0s = Date.now(); const t = await live.send(req); sketchTurns.push({ request: { systemSha: req.system.slice(0, 40), note: 'live', latencyMs: Date.now() - t0s, at: new Date(t0s).toISOString() }, turn: t }); writeFileSync(join(out, 'sketch-turns.json'), `${JSON.stringify(sketchTurns, null, 1)}\n`); return t } }
} else if (opt('sketch-replay')) {
  // v3.54.15: a recorded answer is replayed for the SAME picture only (the hash of the image bytes in the request,
  // matched to the recorded sketch's imageSha256 in --sketch-map <sketches.json>), never by position: a run that
  // registers other views must not hand one side's answer to another
  const rec = JSON.parse(readFileSync(opt('sketch-replay') as string, 'utf8')) as Recorded[]
  const map = opt('sketch-map') ? (JSON.parse(readFileSync(opt('sketch-map') as string, 'utf8')) as { reading: { sketches: Array<{ sketch?: { source: { imageSha256: string } } }> } }).reading.sketches.map((x) => x.sketch?.source.imageSha256) : []
  const byPicture = new Map<string, Recorded>()
  rec.forEach((r, i) => { const h = map[i]; if (h) byPicture.set(h, r) })
  let i = 0
  sketchTransport = { id: 'replay', model: rec[0]?.turn.model ?? 'claude-sonnet-5-5', maxOutputTokens: 6000, send: async (req) => {
    const img = JSON.stringify(req.messages).match(/"data":"([^"]+)"/)?.[1]
    const h = img ? createHash('sha256').update(Buffer.from(img, 'base64')).digest('hex') : undefined
    const r = map.length > 0 ? (h ? byPicture.get(h) : undefined) : rec[i++]
    if (!r) throw new Error('sketch replay: no recorded answer for this picture (not sent)')
    return { ...r.turn, usage: { inputTokens: 0, outputTokens: 0 } }
  } }
}
if (argv.includes('--live')) {
  const live = anthropicConsultant({ model: modelId, maxOutputTokens: 16000, timeoutMs: 300_000, effort: 'medium', ...transportOpts })
  if (!live.available()) throw new Error('no API key in this process environment: --live refused')
  transport = { ...live, send: async (req) => { const t0m = Date.now(); const t = await live.send(req); turns.push({ request: { systemSha: req.system.slice(0, 40), note: 'live', latencyMs: Date.now() - t0m, at: new Date(t0m).toISOString() }, turn: t }); writeFileSync(join(out, 'turns.json'), `${JSON.stringify(turns, null, 1)}\n`); return t } }
} else if (opt('replay')) {
  const rec = JSON.parse(readFileSync(opt('replay') as string, 'utf8')) as Recorded[]
  let i = 0
  transport = { id: 'replay', model: rec[0]?.turn.model ?? modelId, maxOutputTokens: 16000, send: async () => { const r = rec[i++]; if (!r) throw new Error('replay: no recorded turn left'); return { ...r.turn, usage: { inputTokens: 0, outputTokens: 0 } } } }
} else {
  transport = { id: 'none', model: modelId, maxOutputTokens: 16000, send: async () => { throw new Error('no transport') } }
}

await startDecoders()
// the recogniser and the image-content encoder exactly as second-house --recogniser --content (L0) runs them
const rw = join(process.cwd(), '.cache', 'numeric-recogniser-ort', 'ocr-worker.mjs')
await bundleRecogniserWorker(rw)
const recogniser = workerRecogniser({ workerUrl: pathToFileURL(rw), paths: workspaceAssetPaths() })
const cw = join(process.cwd(), '.cache', 'numeric-recogniser-ort', `image-role-worker-${process.pid}.mjs`)
await bundleImageRoleWorker(cw)
const content = workerImageEmbedder({ workerUrl: pathToFileURL(cw), paths: workspaceImageRolePaths() })
const events: unknown[] = []
// v3.54.15: the consultant's label rounds on a live Sonnet transport (as the host's pilot runs them), the metric facts replayed
let loopTransport: ConsultantModel | undefined
if (argv.includes('--loop-live')) {
  const live = anthropicConsultant({ model: 'claude-sonnet-5-5', ...transportOpts })
  if (!live.available()) throw new Error('no API key in this process environment: --loop-live refused')
  const loopTurns: Recorded[] = []
  loopTransport = { ...live, send: async (req) => { try { const t = await live.send(req); loopTurns.push({ request: { systemSha: req.system.slice(0, 40), note: 'loop' }, turn: t }); writeFileSync(join(out, 'loop-turns.json'), `${JSON.stringify(loopTurns, null, 1)}\n`); return t } catch (e) { writeFileSync(join(out, 'loop-error.txt'), `${String((e as Error).message)}\n`); throw e } } }
}
// v3.54.16: the reviewer of the built model (the post-build check that may change it), live or replayed in order
const checkTurns: Recorded[] = []
let checkTransport: ConsultantModel | undefined
if (argv.includes('--check-live')) {
  const live = anthropicConsultant({ model: opt('check-model') ?? modelId, maxOutputTokens: 16000, timeoutMs: 300_000, effort: 'medium', ...transportOpts })
  if (!live.available()) throw new Error('no API key in this process environment: --check-live refused')
  checkTransport = { ...live, send: async (req) => { const t0c = Date.now(); const t = await live.send(req); checkTurns.push({ request: { systemSha: req.system.slice(0, 40), note: 'check', latencyMs: Date.now() - t0c, at: new Date(t0c).toISOString() }, turn: t }); writeFileSync(join(out, 'check-turns.json'), `${JSON.stringify(checkTurns, null, 1)}\n`); return t } }
} else if (opt('check-replay')) {
  const rec = JSON.parse(readFileSync(opt('check-replay') as string, 'utf8')) as Recorded[]
  let i = 0
  checkTransport = { id: 'replay', model: rec[0]?.turn.model ?? modelId, maxOutputTokens: 16000, send: async () => { const r = rec[i++]; if (!r) throw new Error('check replay: no recorded turn left (not sent)'); return { ...r.turn, usage: { inputTokens: 0, outputTokens: 0 } } } }
}
// v3.54.17: the plan outline read (no-model path), live (recorded to outline-turns.json) or replayed in order
const outlineTurns: Recorded[] = []
let outlineTransport: ConsultantModel | undefined
if (argv.includes('--outline-live')) {
  const live = anthropicConsultant({ model: modelId, maxOutputTokens: 4000, timeoutMs: 180_000, effort: 'low', ...transportOpts })
  if (!live.available()) throw new Error('no API key in this process environment: --outline-live refused')
  outlineTransport = { ...live, send: async (req) => { const t0o = Date.now(); const t = await live.send(req); outlineTurns.push({ request: { systemSha: req.system.slice(0, 40), note: 'outline', latencyMs: Date.now() - t0o, at: new Date(t0o).toISOString() }, turn: t }); writeFileSync(join(out, 'outline-turns.json'), `${JSON.stringify(outlineTurns, null, 1)}\n`); return t } }
} else if (opt('outline-replay')) {
  const rec = JSON.parse(readFileSync(opt('outline-replay') as string, 'utf8')) as Recorded[]
  let i = 0
  outlineTransport = { id: 'replay', model: rec[0]?.turn.model ?? modelId, maxOutputTokens: 4000, send: async () => { const r = rec[i++]; if (!r) throw new Error('outline replay: no recorded turn left (not sent)'); return { ...r.turn, usage: { inputTokens: 0, outputTokens: 0 } } } }
}
const spend = argv.includes('--live') || argv.includes('--sketch-live') || argv.includes('--loop-live') || argv.includes('--check-live') || argv.includes('--outline-live') ? ledgerSpend({ phase: [argv.includes('--live') ? 'metric-read' : '', sketchTransport && argv.includes('--sketch-live') ? 'sketches' : '', checkTransport && argv.includes('--check-live') ? 'check' : '', argv.includes('--outline-live') ? 'plan-outline' : ''].filter(Boolean).join('+') || 'replay', house, variant: opt('variant-label') ?? (checkTransport ? 'L-MS-C' : sketchTransport ? 'L-MS' : 'L-M') }) : undefined
const t0 = Date.now()
const r = await consultAnalysis(
  { kind: 'URL', url: opt('url') as string },
  { adapters: [archonAdapter, genericProjectPageAdapter], cache: fileByteCache(opt('cache') as string), offline: true, recogniser, content, ...(process.env.BUILDPLAN_DEBUG === '1' ? { debug: (m: string) => process.stderr.write(`DBG ${m}\n`) } : {}) },
  { model: loopTransport ?? checkTransport ?? transport, metricModel: transport, price: loopTransport ? PRICES['claude-sonnet-5-5'] : PRICES[opt('check-model') ?? modelId], metricPrice: PRICES[modelId], variant: (opt('variant') as 'C' | 'R') ?? 'C', metricRead: 'ON', ...(sketchTransport ? { sketches: 'ON' as const, sketchModel: sketchTransport, sketchPrice: PRICES['claude-sonnet-5-5'] } : {}), maxRounds: loopTransport ? 2 : 0, maxGeometryRounds: checkTransport ? Number(opt('geometry-rounds') ?? 2) : 0, check: checkTransport ? 'ON' : 'OFF', ...(opt('sketch-corrections') === 'OFF' ? { sketchCorrections: 'OFF' as const } : {}), keepLocalModel: true, ...(outlineTransport ? { outlineModel: outlineTransport, outlinePrice: PRICES[modelId] } : { massing: 'OFF' as const }), ...(spend ? { spend } : {}), record: (e) => events.push(e) },
)
writeFileSync(join(out, 'metric-read.json'), `${stableJson(r.metricRead ?? null)}\n`)
if (r.sketches) {
  writeFileSync(join(out, 'sketches.json'), `${stableJson(r.sketches)}\n`)
  mkdirSync(join(out, 'sketches'), { recursive: true })
  mkdirSync(join(out, 'sketches', 'raw'), { recursive: true })
  for (const s of r.sketches.reading.sketches) {
    writeFileSync(join(out, 'sketches', 'raw', `${s.facade}.json`), `${JSON.stringify(s.raw ?? null, null, 1)}\n`)
    if (!s.sketch) continue
    writeFileSync(join(out, 'sketches', `${s.facade}.png`), renderSketchPng(s.sketch))
    writeFileSync(join(out, 'sketches', `${s.facade}.svg`), renderSketchSvg(s.sketch))
    writeFileSync(join(out, 'sketches', `${s.facade}.json`), `${stableJson({ sketch: s.sketch, check: s.check ?? null, failed: s.failed ?? null })}\n`)
  }
}
writeFileSync(join(out, 'events.json'), `${JSON.stringify(events, null, 1)}\n`)
const correctionRuns = r.sourceCheck?.correctionRuns ?? (r as { correctionRuns?: unknown[] }).correctionRuns ?? []
writeFileSync(join(out, 'corrections.json'), `${stableJson({ sketchChannel: r.sketches?.semantic ?? null, runs: correctionRuns, looks: r.geometry.map((g) => ({ round: g.round, revision: g.revision, status: g.status, decision: g.decision, why: g.why, afterRevision: g.afterRevision ?? null, defects: g.defects ?? [], patches: (g.patches ?? []).map((p) => ({ proposalId: p.proposalId, operation: p.operation, targetId: p.targetId, status: p.status, code: p.code ?? null, why: p.why })), reviewed: g.reviewed, observations: g.observations })) })}\n`)
writeFileSync(join(out, 'quality.json'), `${stableJson({ sourceCheck: r.sourceCheck ? { ...r.sourceCheck, correctionRuns: undefined } : null, quality: r.sourceCheck?.quality ?? null })}\n`)
if (r.sketchesWithoutModel) writeFileSync(join(out, 'sketches-without-model.json'), `${stableJson(r.sketchesWithoutModel)}\n`)
if (r.massing) {
  const { model: mm, sceneText: st, plan, ...rest } = r.massing
  writeFileSync(join(out, 'massing.json'), `${stableJson({ ...rest, plan: plan ?? null })}\n`)
  if (mm) writeFileSync(join(out, 'massing-model.json'), serializeModel(mm))
  if (st) writeFileSync(join(out, 'massing-scene.json'), st)
  console.log(`${house}: massing ${r.massing.decision} — ${r.massing.why.slice(0, 300)}`)
}
if (r.run) {
  mkdirSync(join(out, 'views'), { recursive: true })
  for (const v of renderModelViews(r.run.result.scene)) writeFileSync(join(out, 'views', `${v.name}.png`), v.png)
}
const trace = factTrace({ metricRead: r.metricRead, sketches: r.sketches, localModel: r.localModel as Record<string, unknown> | undefined, finalModel: r.run?.reconstruction.model as unknown as Record<string, unknown> | undefined, correctionRuns: correctionRuns as unknown[] })
writeFileSync(join(out, 'fact-trace.json'), `${stableJson(trace)}\n`)
if (r.localModel) writeFileSync(join(out, 'local-model.json'), `${JSON.stringify(r.localModel)}\n`)
if (r.run) {
  writeFileSync(join(out, 'model.json'), serializeModel(r.run.reconstruction.model))
  writeFileSync(join(out, 'scene.json'), r.run.sceneText)
  // what L-MS needs to run on exactly these metric facts: the sealed inputs, the metric evidence, the registrations
  writeFileSync(join(out, 'source-package.json'), `${stableJson(r.run.pkg)}\n`)
  writeFileSync(join(out, 'observation-graph.json'), `${stableJson(r.run.graph)}\n`)
  writeFileSync(join(out, 'metric-evidence.json'), `${stableJson(r.run.metrics)}\n`)
  writeFileSync(join(out, 'facade-alignment.json'), `${stableJson(r.run.reconstruction.facadeAlignment)}\n`)
  writeFileSync(join(out, 'view-audit.json'), `${stableJson((r.run.reconstruction as { viewAudit?: unknown }).viewAudit ?? null)}\n`)
  writeFileSync(join(out, 'consulted.json'), `${stableJson({ readings: r.readings, spans: r.spans })}\n`)
}
const mr = r.metricRead
const counts = (k: string): number => mr?.resolution.decisions.filter((d) => d.decision === k).length ?? 0
writeFileSync(join(out, 'result.json'), `${stableJson({ house, local: r.local, final: r.final, usd: r.usd, quality: r.sourceCheck?.quality ? { state: r.sourceCheck.quality.state, reasons: r.sourceCheck.quality.reasons, reviewCompleted: r.sourceCheck.quality.reviewCompleted, why: r.sourceCheck.quality.why } : null, corrections: { committed: (correctionRuns as Array<{ records: Array<{ status: string }> }>).reduce((a, x) => a + x.records.filter((y) => y.status === 'COMMITTED').length, 0), proposals: (correctionRuns as Array<{ records: unknown[] }>).reduce((a, x) => a + x.records.length, 0) }, modelSha256: r.run?.result.modelSha256 ?? null, decision: mr?.decision, why: mr?.why, sketches: r.sketches ? { accepted: r.sketches.reading.sketches.map((s) => `${s.facade}:${s.check?.verdict ?? 'NONE'}`), form: r.sketches.form, finish: r.sketches.finish, usd: r.sketches.usd } : null, counts: { AGREES: counts('AGREES'), CORRECTED: counts('CORRECTED'), RETAINED: counts('RETAINED'), UNRESOLVED: counts('UNRESOLVED'), NEW_SPAN: counts('NEW_SPAN'), NOT_MATCHED: counts('NOT_MATCHED') }, measured: mr?.measured, seconds: Math.round((Date.now() - t0) / 1000) })}\n`)
process.stdout.write(`${house}: quality ${r.sourceCheck?.quality?.state ?? '—'} (${r.sourceCheck?.quality?.why ?? ''}); sketch channel ${r.sketches?.semantic?.decision ?? '—'}: ${r.sketches?.semantic?.why ?? ''}\n${house}: ${mr?.decision} — ${mr?.why}\n  reads ${mr?.reads.map((x) => `${x.observations.length} obs/${x.refused.length} refused`).join(', ')}; checks ${mr?.checks.map((x) => `${x.verdicts.length} verdicts`).join(', ')}; usd ${r.usd}\n  AGREES ${counts('AGREES')} CORRECTED ${counts('CORRECTED')} UNRESOLVED ${counts('UNRESOLVED')} NEW_SPAN ${counts('NEW_SPAN')} NOT_MATCHED ${counts('NOT_MATCHED')} RETAINED ${counts('RETAINED')}\n  measured before ${JSON.stringify(mr?.measured.before)}\n  measured after ${JSON.stringify(mr?.measured.after)}\n`)
process.exit(0)
