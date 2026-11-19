/**
 * v3.54.15 §7 — the four sketches of a house whose LOCAL run built no model (no view was registered, so the product's
 * sketch step had nothing to send). The publisher's labelled elevations (FRONT, REAR, SIDE_LEFT, SIDE_RIGHT; the largest
 * rendering of each) are read by the same `readElevationSketch` and the same transport, drawn by the same renderer, and
 * recorded UNCHECKED: there is no model to check their proportions against, and nothing here feeds a model. A view the
 * source does not draw is MISSING_SOURCE. Research tooling only; the product path is unchanged (frozen).
 *
 *   npx vite-node research/source-to-model/v35415/sketch-unregistered.ts -- --package <pkg.json> --cache <dir>
 *     --out <dir> --house <name> [--sides LEFT,RIGHT] [--live --strict --prompt-cache 5m] [--replay <dir>/sketch-turns.json]
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { decodeImage, startDecoders } from '../../../packages/source-package/src/image.js'
import { readElevationSketch, renderSketchPng, renderSketchSvg } from '../../../packages/analysis-service/src/appearance/elevation-sketch.js'
import { anthropicConsultant } from '../../../packages/analysis-service/src/consult/anthropic.js'
import { CONSULT_PRICES } from '../../../packages/analysis-service/src/consult/cost.js'
import type { ConsultantModel, ModelTurn } from '../../../packages/analysis-service/src/consult/loop.js'
import { ledgerSpend } from './ledger.js'

const argv = process.argv.slice(2).filter((a) => a !== '--')
const opt = (n: string): string | undefined => (argv.indexOf(`--${n}`) >= 0 ? argv[argv.indexOf(`--${n}`) + 1] : undefined)
const out = opt('out') as string
const house = opt('house') as string
mkdirSync(join(out, 'raw'), { recursive: true })
const pkg = JSON.parse(readFileSync(opt('package') as string, 'utf8')) as { assets: Array<{ id: string; roles: { document: string; view: string }; caption?: string; variants: Array<{ url: string; byteHash: string; width?: number; height?: number }> }> }
const cacheFile = (url: string): string => join(opt('cache') as string, `${createHash('sha256').update(url).digest('hex').slice(0, 32)}.bin`)
const VIEW: Record<string, string> = { FRONT: 'FRONT', REAR: 'REAR', SIDE_LEFT: 'LEFT', SIDE_RIGHT: 'RIGHT' }

type Recorded = { request: { frameId: string; latencyMs?: number; at?: string }; turn: ModelTurn }
const turns: Recorded[] = []
let model: ConsultantModel
if (argv.includes('--live')) {
  const ttl = opt('prompt-cache') === '5m' || opt('prompt-cache') === '1h' ? (opt('prompt-cache') as '5m' | '1h') : undefined
  const live = anthropicConsultant({ model: 'claude-sonnet-5-5', maxOutputTokens: 6000, timeoutMs: 240_000, effort: 'medium', ...(argv.includes('--strict') ? { strict: true } : {}), ...(ttl ? { cache: { ttl } } : {}) })
  if (!live.available()) throw new Error('no API key in this process environment: --live refused')
  model = { ...live, send: async (req) => { const t0 = Date.now(); const t = await live.send(req); turns.push({ request: { frameId: String(req.messages.length), latencyMs: Date.now() - t0, at: new Date(t0).toISOString() }, turn: t }); writeFileSync(join(out, 'sketch-turns.json'), `${JSON.stringify(turns, null, 1)}\n`); return t } }
} else if (opt('replay')) {
  const rec = JSON.parse(readFileSync(opt('replay') as string, 'utf8')) as Recorded[]
  let i = 0
  model = { id: 'replay', model: rec[0]?.turn.model ?? 'claude-sonnet-5-5', maxOutputTokens: 6000, send: async () => { const r = rec[i++]; if (!r) throw new Error('replay: no recorded answer left'); return { ...r.turn, usage: { inputTokens: 0, outputTokens: 0 } } } }
} else throw new Error('--live or --replay')

await startDecoders()
const spend = argv.includes('--live') ? ledgerSpend({ phase: 'sketches-unregistered', house, variant: 'SKETCH_ONLY' }) : undefined
const summary: Array<Record<string, unknown>> = []
const size = (url: string): number => readFileSync(cacheFile(url)).length
const ofView = (view: string) => pkg.assets.filter((a) => a.roles.document === 'ELEVATION' && a.roles.view === view).flatMap((a) => a.variants.map((v) => ({ a, v }))).filter((x) => existsSync(cacheFile(x.v.url))).sort((p, q) => size(q.v.url) - size(p.v.url))
// sides the source labels only as "a side": one per asset, in the package's order, the side named as not stated
const unspecified = [...new Map(ofView('SIDE_UNSPECIFIED').map((x) => [x.a.id, x])).values()]
const only = opt('sides')?.split(',')
for (const view of ['FRONT', 'REAR', 'SIDE_LEFT', 'SIDE_RIGHT']) {
  const side = VIEW[view]
  if (only && !only.includes(side)) continue
  let best = ofView(view)[0]
  let sideNote: string | undefined
  if (!best && (view === 'SIDE_LEFT' || view === 'SIDE_RIGHT') && unspecified.length > 0) {
    best = unspecified.shift() as (typeof unspecified)[number]
    sideNote = 'the source labels this drawing only as a side elevation: which side it is was not stated (taken in the package order)'
  }
  if (!best) {
    summary.push({ side, status: 'MISSING_SOURCE', why: `the source labels no ${view} elevation` })
    continue
  }
  const bytes = new Uint8Array(readFileSync(cacheFile(best.v.url)))
  if (createHash('sha256').update(bytes).digest('hex') !== best.v.byteHash) throw new Error(`cached bytes of ${best.a.id} do not match the package`)
  const raster = decodeImage(bytes)
  const r = await readElevationSketch({ model, price: CONSULT_PRICES['claude-sonnet-5-5'], ...(spend ? { spend } : {}) }, { frameId: best.a.id, raster, caption: best.a.caption ?? view })
  writeFileSync(join(out, 'raw', `${side}.json`), `${JSON.stringify(r.raw ?? null, null, 1)}\n`)
  if (r.sketch) {
    writeFileSync(join(out, `${side}.png`), renderSketchPng(r.sketch))
    writeFileSync(join(out, `${side}.svg`), renderSketchSvg(r.sketch))
    writeFileSync(join(out, `${side}.json`), `${JSON.stringify({ sketch: r.sketch, check: null, verdict: 'UNCHECKED', why: 'no model of this house to check against: LOCAL built none and no view was registered' }, null, 1)}\n`)
  }
  summary.push({ side, ...(sideNote ? { sideNote } : {}), assetId: best.a.id, sourceByteHash: best.v.byteHash, size: `${raster.width}x${raster.height}`, status: r.sketch ? 'UNCHECKED' : 'FAILED', ...(r.failed ? { failed: r.failed } : {}), usd: r.usd, account: r.sketch?.account ?? null })
}
writeFileSync(join(out, 'summary.json'), `${JSON.stringify({ house, summary }, null, 1)}\n`)
process.stdout.write(`${house}: ${summary.map((s) => `${s.side}:${s.status}`).join(' ')}\n`)
process.exit(0)
