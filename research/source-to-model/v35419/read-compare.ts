/**
 * v3.54.19 experiment (OWNER 2026-11-24: "check the API's descriptions too, not only the minimal pictures — a JSON of the
 * elements' dimensions and positions may carry more") — three ways of reading the SAME labelled elevation, each held
 * against the same witness nobody read with a model: the gaps the ground-floor PLAN draws in the wall of that side
 * (`plan-skeleton.ts`, deterministic).
 *
 *   SKETCH  the recorded contour reading (polygons in the picture's pixels) — what the pipeline uses today, 0 USD here
 *   JSON-A  one request: the wall's two ends in pixels and each opening as a stretch 0..1 between them, with its storey
 *   JSON-B  one request, told the facade's width in metres (from the plan): each opening's distance from the left corner
 *           and its width, sill and height IN METRES, with its storey
 *
 * Score per elevation: openings of the ground storey matched to a plan gap (≥ 40 % of the longer span shared), plan gaps
 * left unmatched, read openings matching no gap. The plan is not the truth about an elevation (a gap may be a door the
 * elevation hides, a window may sit above a plinth) — it is the same yardstick for all three.
 *
 *   BUILDPLAN_ANTHROPIC_API_KEY=… npx vite-node research/source-to-model/v35419/read-compare.ts -- --run <run dir> --cache <dir> --house <n> --out <dir> [--ledger <json> --opening <usd> --ceiling <usd>]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { decodeImage, fileByteCache, startDecoders } from '@buildapp/source-package'
import { frameRasters } from '@buildapp/source-cv'
import type { Raster } from '@buildapp/source-cv'
import { anthropicConsultant } from '../../../packages/analysis-service/src/consult/anthropic.js'
import { CONSULT_PRICES, reserveOf } from '../../../packages/analysis-service/src/consult/cost.js'
import { settledOf } from '../../../packages/analysis-service/src/consult/loop.js'
import type { ModelTurn } from '../../../packages/analysis-service/src/consult/loop.js'
import { pictureOf } from '../../../packages/analysis-service/src/consult/metric-read.js'
import { sideOfFacade } from '../../../packages/analysis-service/src/consult/correct/execute.js'
import { drawnStretches, planSideInModel, stretchAgreement } from '../../../packages/analysis-service/src/consult/plan-openings.js'
import type { PlanSkeleton } from '../../../packages/analysis-service/src/consult/plan-skeleton.js'
import { ledgerSpend } from '../v35417/ledger.js'

const argv = process.argv.slice(2).filter((a) => a !== '--')
const opt = (n: string): string | undefined => (argv.indexOf(`--${n}`) >= 0 ? argv[argv.indexOf(`--${n}`) + 1] : undefined)
const [runDir, cacheDir, house, outDir] = [opt('run') as string, opt('cache') as string, opt('house') as string, opt('out') as string]
mkdirSync(outDir, { recursive: true })
const J = <T>(f: string): T => JSON.parse(readFileSync(join(runDir, f), 'utf8')) as T
type Side = 'FRONT' | 'RIGHT' | 'REAR' | 'LEFT'
type Stretch = { u0: number; u1: number }
const MODEL = 'claude-sonnet-5-5'

const SYSTEM_A = `You read one orthographic elevation of a house. You do not describe it in words and you do not estimate metres.
Give the two ends of the building's walls at ground level as pixel columns of the picture ("wallLeftX", "wallRightX": the outer corners of the walls, not the roof's overhang).
List EVERY opening in the walls of this elevation — windows, entrance doors, glazed (terrace or balcony) doors, garage doors — each with: its kind; "from" and "to", its left and right edge as fractions 0..1 of the distance from the wall's left end to its right end; "storey": GROUND for an opening of the ground floor, UPPER for one above it (an attic or first-floor window, a window in a gable). Roof windows lying in the roof slope are not wall openings: leave them out. Do not invent openings hidden behind something; do not merge two openings into one.`
const SYSTEM_B = `You read one orthographic elevation of a house and report where its wall openings are IN METRES. The total width of the building's walls on this elevation (outer corner to outer corner at ground level, without roof overhangs) is given to you: use it as the scale.
List EVERY opening in the walls — windows, entrance doors, glazed (terrace or balcony) doors, garage doors — each with: its kind; "leftM", the distance of its left edge from the walls' left outer corner; "widthM"; "sillM", the height of its lower edge above the ground-floor level (0 for a door); "heightM"; "storey": GROUND or UPPER (above the ground floor: an attic or first-floor window, a window in a gable). Roof windows lying in the roof slope are not wall openings: leave them out. Do not invent openings hidden behind something; do not merge two openings into one.`
const KINDS = ['WINDOW', 'DOOR', 'GLAZED_DOOR', 'GARAGE_DOOR']
const TOOL_A = { name: 'report_openings', description: 'Report the wall ends and the openings as fractions of the wall width.', input_schema: { type: 'object', additionalProperties: false, required: ['wallLeftX', 'wallRightX', 'openings'], properties: { wallLeftX: { type: 'number' }, wallRightX: { type: 'number' }, openings: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['kind', 'from', 'to', 'storey'], properties: { kind: { type: 'string', enum: KINDS }, from: { type: 'number' }, to: { type: 'number' }, storey: { type: 'string', enum: ['GROUND', 'UPPER'] } } } } } } }
const TOOL_B = { name: 'report_openings', description: 'Report the openings in metres.', input_schema: { type: 'object', additionalProperties: false, required: ['openings'], properties: { openings: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['kind', 'leftM', 'widthM', 'sillM', 'heightM', 'storey'], properties: { kind: { type: 'string', enum: KINDS }, leftM: { type: 'number' }, widthM: { type: 'number' }, sillM: { type: 'number' }, heightM: { type: 'number' }, storey: { type: 'string', enum: ['GROUND', 'UPPER'] } } } } } } }

async function main(): Promise<void> {
  const key = process.env.BUILDPLAN_ANTHROPIC_API_KEY
  if (!key) throw new Error('no key in the environment')
  await startDecoders()
  const pkg = J<{ assets: Array<{ id: string; caption?: string; variants: Array<{ url: string; byteHash: string }> }> }>('source-package.json')
  const graph = J<{ coordinateFrames: Array<{ id: string; assetId: string; variantByteHash: string }> }>('observation-graph.json')
  const ms = J<{ skeleton?: PlanSkeleton; records?: Array<{ massing?: { hypothesis?: { planFront?: Side } } }> }>('massing.json')
  const sk = ms.skeleton
  if (!sk || sk.gaps.length === 0) throw new Error('this run recorded no plan skeleton with exterior gaps')
  const planFront = ms.records?.[0]?.massing?.hypothesis?.planFront
  const xs = sk.outlinePx.map((q) => q[0]); const ys = sk.outlinePx.map((q) => q[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const [W, H] = [x1 - x0, y1 - y0]
  // the plan's gaps per side of the PLAN, as stretches seen from outside, left to right (plan-outline's convention)
  const planOf = (planSide: Side): Stretch[] => sk.gaps.filter((g) => (g.face === 'BOTTOM' ? 'FRONT' : g.face === 'TOP' ? 'REAR' : g.face) === planSide).map((g) => {
    const u = g.face === 'BOTTOM' ? [(g.from - x0) / W, (g.to - x0) / W] : g.face === 'TOP' ? [(x1 - g.from) / W, (x1 - g.to) / W] : g.face === 'RIGHT' ? [(y1 - g.from) / H, (y1 - g.to) / H] : [(g.from - y0) / H, (g.to - y0) / H]
    return { u0: Math.min(...u), u1: Math.max(...u) }
  }).sort((a, b) => a.u0 - b.u0)
  const planSideFor = (modelSide: Side): Side => (['FRONT', 'RIGHT', 'REAR', 'LEFT'] as Side[]).find((p) => planSideInModel(p, planFront) === modelSide) as Side
  const sketches = J<{ reading: { sketches: Array<{ facade: string; frameId: string; sketch?: { groundRow?: number | null; walls: Array<{ polygon: Array<[number, number]> }>; openings: Array<{ polygon: Array<[number, number]>; kind: string }> } }> } }>('sketches.json').reading.sketches
  const cache = fileByteCache(cacheDir)
  const spend = ledgerSpend({ phase: 'read-compare', house, variant: 'JSON-A/B' }, { ...(opt('ledger') ? { path: opt('ledger') as string } : {}), ...(opt('opening') ? { openingUsd: Number(opt('opening')) } : {}), ...(opt('ceiling') ? { ceilingUsd: Number(opt('ceiling')) } : {}) })
  const model = anthropicConsultant({ model: MODEL, maxOutputTokens: 3000, timeoutMs: 180_000, effort: 'medium' })
  const price = CONSULT_PRICES[MODEL]
  const ask = async (system: string, tool: unknown, text: string, raster: Raster, note: string): Promise<{ input: unknown; usd: number; scale: number }> => {
    const pic = pictureOf(raster)
    const content = [{ type: 'text', text: `${text} The picture is ${pic.width} × ${pic.height} px.` }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: Buffer.from(pic.png).toString('base64') } }]
    const reserveUsd = reserveOf(price, Math.ceil((system.length + JSON.stringify(tool).length + 200) / 2.5) + 2600, 3000, model.cache)
    const res = spend.reserve(MODEL, reserveUsd, note)
    let turn: ModelTurn
    try { turn = await model.send({ system, messages: [{ role: 'user', content }], tools: [tool] } as never) } catch (e) { spend.settle(res, { usd: reserveUsd, inputTokens: 0, outputTokens: 0 }, 'TRANSPORT'); throw e }
    const settled = settledOf(price, turn.usage)
    spend.settle(res, settled)
    return { input: (turn.content as Array<{ type: string; input?: unknown }>).find((b) => b.type === 'tool_use')?.input, usd: settled.usd, scale: pic.scale }
  }
  const rows: unknown[] = []
  let usd = 0
  for (const x of sketches) {
    const side = sideOfFacade(x.facade) as Side | undefined
    if (!x.sketch || (side !== 'FRONT' && side !== 'REAR')) continue
    const planSide = planSideFor(side)
    const plan = planOf(planSide)
    if (plan.length === 0) continue
    const frame = graph.coordinateFrames.find((f) => f.id === x.frameId)
    const variant = pkg.assets.find((a) => a.id === frame?.assetId)?.variants.find((v) => v.byteHash === frame?.variantByteHash)
    const got = variant ? await cache.get(variant.url) : undefined
    if (!frame || !variant || !got) continue
    const rasters = frameRasters(); rasters.set(variant.byteHash, decodeImage(got.bytes)); rasters.useFrames(graph.coordinateFrames as never)
    const raster = rasters.get(variant.byteHash) as Raster
    const widthM = (planSide === 'FRONT' || planSide === 'REAR' ? W : H) * sk.mPerPx
    const score = (drawn: Stretch[]): { plan: number; read: number; matched: number; planMissed: number; phantoms: number } => { const a = stretchAgreement(plan, drawn); return { plan: plan.length, read: drawn.length, matched: a.matched, planMissed: plan.length - a.matched, phantoms: drawn.length - a.matched } }
    const sketch = score(drawnStretches(x.sketch))
    const a = await ask(SYSTEM_A, TOOL_A, `The ${side.toLowerCase()} elevation of a house.`, raster, `read-compare A ${x.frameId}`)
    const b = await ask(SYSTEM_B, TOOL_B, `The ${side.toLowerCase()} elevation of a house. The building's walls on this elevation are ${widthM.toFixed(2)} m wide, outer corner to outer corner.`, raster, `read-compare B ${x.frameId}`)
    usd += a.usd + b.usd
    const ia = a.input as { openings?: Array<{ kind: string; from: number; to: number; storey: string }> } | undefined
    const ib = b.input as { openings?: Array<{ kind: string; leftM: number; widthM: number; sillM: number; heightM: number; storey: string }> } | undefined
    const clamp = (v: number): number => Math.min(1, Math.max(0, v))
    const sa = (ia?.openings ?? []).filter((o) => o.storey === 'GROUND').map((o) => ({ u0: clamp(Math.min(o.from, o.to)), u1: clamp(Math.max(o.from, o.to)) })).filter((s) => s.u1 - s.u0 > 0.005)
    const sb = (ib?.openings ?? []).filter((o) => o.storey === 'GROUND').map((o) => ({ u0: clamp(o.leftM / widthM), u1: clamp((o.leftM + o.widthM) / widthM) })).filter((s) => s.u1 - s.u0 > 0.005)
    const row = { house, frameId: x.frameId, side, planSide, widthM: Math.round(widthM * 100) / 100, planGaps: plan.map((s) => [Math.round(s.u0 * 1000) / 1000, Math.round(s.u1 * 1000) / 1000]), SKETCH: sketch, JSON_A: score(sa), JSON_B: score(sb), counts: { sketchAll: x.sketch.openings.length, jsonAAll: ia?.openings?.length ?? null, jsonBAll: ib?.openings?.length ?? null }, raw: { A: ia, B: ib }, usd: Math.round((a.usd + b.usd) * 1e6) / 1e6 }
    rows.push(row)
    process.stdout.write(`${house} ${side}: plan ${plan.length} | SKETCH m${sketch.matched} miss${sketch.planMissed} ph${sketch.phantoms} | JSON-A m${row.JSON_A.matched} miss${row.JSON_A.planMissed} ph${row.JSON_A.phantoms} | JSON-B m${row.JSON_B.matched} miss${row.JSON_B.planMissed} ph${row.JSON_B.phantoms}\n`)
  }
  writeFileSync(join(outDir, `${house}-read-compare.json`), `${JSON.stringify({ house, model: MODEL, usd: Math.round(usd * 1e6) / 1e6, rows }, null, 1)}\n`)
  process.stdout.write(`${house}: ${rows.length} elevation(s), ${usd.toFixed(4)} USD\n`)
}
void main().then(() => process.exit(0), (e) => { process.stderr.write(`${(e as Error).message}\n`); process.exit(1) })
