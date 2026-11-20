/**
 * v3.54.17 R2 §5 — the four sides of one evaluated house for the gallery and its board, from data already held, 0 USD.
 * No request leaves the process: the provider's sketch answers are taken from the host job's accepted revision (replayed
 * by request hash through the same path) — a side the path never asked about is NOT_REQUESTED, never drawn in.
 * For each side: the original elevation (the cached bytes, private), the sketch drawn from the REAL read (PNG/SVG/JSON),
 * the model before the corrections (LOCAL) and the final host model, each as that side's tile of the SIDES picture.
 *   npx vite-node research/source-to-model/v35417/r2/sketch-delivery.ts -- --house <name> --url <page> --cache <dir>
 *     [--accepted <accepted revision json>] [--final <final host model json>] [--failed-job <why>] --out <dir>
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { archonAdapter, fileByteCache, genericProjectPageAdapter } from '@buildapp/source-package'
import { compileBuilding } from '@buildapp/geometry'
import { buildMobileSceneBundle } from '@buildapp/mobile-scene'
import { parseModel } from '@buildapp/model'
import type { CanonicalBuildingModel } from '@buildapp/model'
import { consultAnalysis } from '../../../../packages/analysis-service/src/consult/consult-analysis.js'
import { CONSULT_PRICES } from '../../../../packages/analysis-service/src/consult/cost.js'
import { replayModel } from '../../../../packages/analysis-service/src/consult/accepted-consult.js'
import type { AcceptedConsultRevision } from '../../../../packages/analysis-service/src/consult/accepted-consult.js'
import { ConsultantUnavailable } from '../../../../packages/analysis-service/src/consult/loop.js'
import type { ConsultantModel } from '../../../../packages/analysis-service/src/consult/loop.js'
import { renderModelViews } from '../../../../packages/analysis-service/src/consult/model-views.js'
import { renderSketchPng, renderSketchSvg } from '../../../../packages/analysis-service/src/appearance/elevation-sketch.js'

const argv = process.argv.slice(2).filter((a) => a !== '--')
const opt = (n: string): string | undefined => (argv.indexOf(`--${n}`) >= 0 ? argv[argv.indexOf(`--${n}`) + 1] : undefined)
const house = opt('house') as string
const out = join(opt('out') as string, house)
mkdirSync(out, { recursive: true })
const cacheDir = opt('cache') as string
const accepted = opt('accepted') ? (JSON.parse(readFileSync(opt('accepted') as string, 'utf8')) as AcceptedConsultRevision) : undefined
const counter = { replayed: 0, missing: 0 }
const base = { id: 'anthropic-messages', maxOutputTokens: 8000 }
const notSent = (model: string): ConsultantModel => ({ ...base, model, send: async () => { throw new ConsultantUnavailable('REJECTED_UNBILLED', 'NOT SENT (R2 offline): no new request') } })
const metric = accepted ? replayModel({ ...base, model: 'claude-opus-5-5', maxOutputTokens: 16000 }, 'METRIC', accepted.answers, counter) : notSent('claude-opus-5-5')
const sketch = accepted ? replayModel({ ...base, model: 'claude-sonnet-5-5', maxOutputTokens: 6000 }, 'SKETCH', accepted.answers, counter) : notSent('claude-sonnet-5-5')
const price = CONSULT_PRICES['claude-sonnet-5-5']
const r = await consultAnalysis(
  { kind: 'URL', url: opt('url') as string },
  { adapters: [archonAdapter, genericProjectPageAdapter], cache: fileByteCache(cacheDir), offline: true },
  { model: notSent('claude-sonnet-5-5'), price, metricRead: 'ON', metricModel: metric, metricPrice: CONSULT_PRICES['claude-opus-5-5'], sketches: 'ON', sketchModel: sketch, sketchPrice: price, variant: 'C', check: 'OFF', maxRounds: 0, keepLocalModel: true },
)
const SIDES = ['FRONT', 'RIGHT', 'REAR', 'LEFT'] as const
const FACADE: Record<string, (typeof SIDES)[number]> = { FRONT: 'FRONT', REAR: 'REAR', EAST: 'RIGHT', WEST: 'LEFT', RIGHT: 'RIGHT', LEFT: 'LEFT' }
const graph = r.run?.graph ?? (r as { sketchesWithoutModel?: unknown }).sketchesWithoutModel ? undefined : undefined
void graph
// --record: a run's own record of the reads it made (a DEV run without a model kept them there): drawn from that record
const record = opt('record') ? (JSON.parse(readFileSync(opt('record') as string, 'utf8')) as NonNullable<typeof r.sketchesWithoutModel>) : undefined
const reads = record ? record.sketches : [...(r.sketches?.reading.sketches ?? []), ...(r.sketchesWithoutModel?.sketches ?? [])]
const sideStatus = new Map((record?.sides ?? r.sketchesWithoutModel?.sides ?? []).map((s) => [FACADE[s.facade], s]))
const failedJob = opt('failed-job')
// the sources: the labelled elevation of each side from the package (the same frames the path chose)
// without a model the run's graph and package come from the analyzer's own failure (its attachments)
let failedLocal: { graph?: NonNullable<typeof r.run>['graph']; pkg?: NonNullable<typeof r.run>['pkg'] } = {}
if (!r.run) {
  const { runAnalysis } = await import('../../../../packages/analysis-service/src/run.js')
  try {
    await runAnalysis({ kind: 'URL', url: opt('url') as string }, { adapters: [archonAdapter, genericProjectPageAdapter], cache: fileByteCache(cacheDir), offline: true })
  } catch (e) {
    const a = (e as { attachments?: { graph?: NonNullable<typeof r.run>['graph']; pkg?: NonNullable<typeof r.run>['pkg'] } }).attachments
    failedLocal = { ...(a?.graph ? { graph: a.graph } : {}), ...(a?.pkg ? { pkg: a.pkg } : {}) }
  }
}
const pkgFrames = r.run?.graph.coordinateFrames ?? failedLocal.graph?.coordinateFrames ?? []
const pkg = r.run?.pkg ?? failedLocal.pkg
const sha = (b: Uint8Array | string): string => createHash('sha256').update(b).digest('hex')
const srcOf = (frameId: string): { file: string; sha256: string } | undefined => {
  const f = pkgFrames.find((x) => x.id === frameId)
  const a = f ? pkg?.assets.find((x) => x.id === f.assetId) : undefined
  const v = a?.variants.find((x) => x.byteHash === f?.variantByteHash)
  if (!v) return undefined
  const p = join(cacheDir, `${sha(v.url).slice(0, 32)}.bin`)
  if (!existsSync(p)) return undefined
  const bytes = readFileSync(p)
  const ext = bytes[0] === 0x89 ? 'png' : 'jpg'
  return { file: `source.${ext}`, sha256: sha(bytes) }
}
const tiles = (m: CanonicalBuildingModel | undefined, name: string): string | undefined => {
  if (!m) return undefined
  const sides = renderModelViews(buildMobileSceneBundle(m, { scene: compileBuilding(m) })).find((v) => v.name === 'SIDES')
  if (!sides) return undefined
  writeFileSync(join(out, `${name}-SIDES.png`), sides.png)
  return `${name}-SIDES.png`
}
// "before": LOCAL's model; where LOCAL built none but the path did, the same path with its correction channel OFF
let beforeIs = 'LOCAL'
let before = (r.localModel as CanonicalBuildingModel | undefined) ?? undefined
if (!before && r.run) {
  const k2 = { replayed: 0, missing: 0 }
  const r0 = await consultAnalysis(
    { kind: 'URL', url: opt('url') as string },
    { adapters: [archonAdapter, genericProjectPageAdapter], cache: fileByteCache(cacheDir), offline: true },
    { model: notSent('claude-sonnet-5-5'), price, metricRead: 'ON', metricModel: accepted ? replayModel({ ...base, model: 'claude-opus-5-5', maxOutputTokens: 16000 }, 'METRIC', accepted.answers, k2) : notSent('claude-opus-5-5'), metricPrice: CONSULT_PRICES['claude-opus-5-5'], sketches: 'ON', sketchModel: accepted ? replayModel({ ...base, model: 'claude-sonnet-5-5', maxOutputTokens: 6000 }, 'SKETCH', accepted.answers, k2) : notSent('claude-sonnet-5-5'), sketchPrice: price, variant: 'C', check: 'OFF', maxRounds: 0, sketchCorrections: 'OFF' },
  )
  before = r0.run?.reconstruction.model
  beforeIs = 'BEFORE_CORRECTIONS (LOCAL failed; the metric consultant\'s model, the correction channel off)'
}
const final = opt('final') ? (parseModel(readFileSync(opt('final') as string, 'utf8')) as unknown as CanonicalBuildingModel) : undefined
const index: Record<string, unknown> = { house, local: r.local, beforeIs: beforeIs, replay: counter, requests: 0, usd: 0, failedJob: failedJob ?? null, before: tiles(before, 'before') ?? null, final: tiles(final, 'final') ?? null, finalModelSha256: final ? sha(readFileSync(opt('final') as string, 'utf8')) : null, sides: [] as unknown[] }
for (const side of SIDES) {
  const s = reads.find((x) => FACADE[x.facade] === side)
  const dir = join(out, side)
  mkdirSync(dir, { recursive: true })
  // a side not read still shows its original, when the source labels one for it (or labels drawings only as "a side")
  const LABEL: Record<string, string[]> = { FRONT: ['FRONT'], REAR: ['REAR'], RIGHT: ['SIDE_RIGHT', 'EAST', 'RIGHT'], LEFT: ['SIDE_LEFT', 'WEST', 'LEFT'] }
  const elevations = pkgFrames.filter((f) => f.roles.projection === 'ORTHOGRAPHIC_ELEVATION').sort((a, b) => (b.size?.width ?? 0) * (b.size?.height ?? 0) - (a.size?.width ?? 0) * (a.size?.height ?? 0))
  const unspecified = elevations.filter((f) => String(f.roles.view) === 'SIDE_UNSPECIFIED')
  const labelled = elevations.find((f) => LABEL[side].includes(String(f.roles.view)))
  const fallback = labelled ?? (side === 'RIGHT' ? unspecified[0] : side === 'LEFT' ? unspecified[1] : undefined)
  const frameId = s?.frameId ?? sideStatus.get(side)?.frameId ?? fallback?.id
  const sourceNote = !s && !labelled && fallback ? ' The original shown is labelled by the source only as a side elevation; which side it is was not stated (taken in the source order).' : ''
  const src = frameId ? srcOf(frameId) : undefined
  if (src) writeFileSync(join(dir, src.file), readFileSync(join(cacheDir, `${sha((() => { const f = pkgFrames.find((x) => x.id === frameId); const a = f ? pkg?.assets.find((x) => x.id === f.assetId) : undefined; return a?.variants.find((x) => x.byteHash === f?.variantByteHash)?.url ?? '' })()).slice(0, 32)}.bin`)))
  let status: string
  let why: string
  if (failedJob) {
    status = 'NOT_REQUESTED'
    why = `the job ended FAILED before any sketch request (${failedJob}); nothing was read for this side and nothing is drawn`
  } else if (s?.sketch) {
    writeFileSync(join(dir, 'sketch.png'), renderSketchPng(s.sketch))
    writeFileSync(join(dir, 'sketch.svg'), renderSketchSvg(s.sketch))
    writeFileSync(join(dir, 'sketch.json'), `${JSON.stringify(s.sketch, null, 1)}\n`)
    writeFileSync(join(dir, 'raw.json'), `${JSON.stringify(s.raw ?? null, null, 1)}\n`)
    status = (s as { check?: { verdict?: string } }).check?.verdict ?? 'READ'
    why = (s as { check?: { why?: string } }).check?.why ?? sideStatus.get(side)?.why ?? 'the provider\'s real read, replayed from the host job\'s accepted revision'
  } else if (s?.failed) {
    status = 'FAILED'
    why = s.failed
  } else if (sideStatus.get(side)?.status === 'MISSING_SOURCE') {
    status = 'MISSING_SOURCE'
    why = sideStatus.get(side)?.why ?? 'the source has no elevation labelled for this side'
  } else {
    status = 'NOT_REQUESTED'
    why = 'the sketch step was not asked about this side: it reads the elevations the analyzer registered to a model side, and none was registered for this one'
  }
  ;(index.sides as unknown[]).push({ side, status, why: `${why}${sourceNote}`.slice(0, 600), frameId: frameId ?? null, source: src ? `${side}/${src.file}` : null, sourceSha256: src?.sha256 ?? null, sketch: existsSync(join(dir, 'sketch.png')) ? `${side}/sketch.png` : null })
}
writeFileSync(join(out, 'index.json'), `${JSON.stringify(index, null, 1)}\n`)
process.stdout.write(`${JSON.stringify(index, null, 1)}\n`)
