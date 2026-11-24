/**
 * v3.54.19 experiment 2 (OWNER 2026-11-24: "check the API's descriptions too … a JSON with the right data may be more
 * efficient"): the FORM of the house as ONE typed answer from all its labelled elevations in one request — storeys, the
 * number of volumes under their own roofs, the main roof's kind and ridge direction, lower parts, dormers, chimneys —
 * beside what the pipeline built from the contour sketches of the same pictures (the delivered model of the run given).
 * Nothing here feeds the product: it measures whether a typed description of the form carries what the silhouettes lose.
 *
 *   BUILDPLAN_ANTHROPIC_API_KEY=… npx vite-node research/source-to-model/v35419/form-read.ts -- --run <run dir> --cache <dir> --house <n> --out <dir> [--ledger <json> --opening <usd> --ceiling <usd>]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { decodeImage, fileByteCache, startDecoders } from '@buildapp/source-package'
import { frameRasters } from '@buildapp/source-cv'
import type { Raster } from '@buildapp/source-cv'
import { anthropicConsultant } from '../../../packages/analysis-service/src/consult/anthropic.js'
import { CONSULT_PRICES, reserveOf } from '../../../packages/analysis-service/src/consult/cost.js'
import { settledOf } from '../../../packages/analysis-service/src/consult/loop.js'
import type { ModelTurn } from '../../../packages/analysis-service/src/consult/loop.js'
import { pictureOf } from '../../../packages/analysis-service/src/consult/metric-read.js'
import { ledgerSpend } from '../v35417/ledger.js'

const argv = process.argv.slice(2).filter((a) => a !== '--')
const opt = (n: string): string | undefined => (argv.indexOf(`--${n}`) >= 0 ? argv[argv.indexOf(`--${n}`) + 1] : undefined)
const [runDir, cacheDir, house, outDir] = [opt('run') as string, opt('cache') as string, opt('house') as string, opt('out') as string]
mkdirSync(outDir, { recursive: true })
const J = <T>(f: string): T => JSON.parse(readFileSync(join(runDir, f), 'utf8')) as T
const MODEL = 'claude-sonnet-5-5'
const ROOFS = ['GABLE', 'HIP', 'FLAT', 'SHED', 'MANSARD', 'OTHER']
const SYSTEM = `You are given the orthographic elevations of ONE house (each captioned with the side it shows). Report the FORM of the house as typed facts. Do not describe it in prose and do not guess what no elevation shows.
"storeys": ONE (ground floor only, the roof space not lived in), ONE_WITH_ATTIC (ground floor and rooms in the roof: windows in the gables, roof windows or dormers), TWO (two full storeys under the eaves), TWO_WITH_ATTIC.
"volumes": how many separate volumes stand under their OWN roofs (the main house is one; a lower garage or wing with its own roof is another; a porch canopy or a dormer is NOT a volume).
"mainRoof": the roof of the main volume: its kind (GABLE: two slopes and two gable walls; HIP: slopes on all four sides; FLAT; SHED: one slope; MANSARD; OTHER), "ridgeAlong": FRONT when the ridge runs parallel to the front elevation (the front shows a roof slope), SIDE when it runs front to back (the front shows a gable), NONE for a flat roof; "pitchDeg": the slope's angle as the gable-end elevation draws it (0 if flat).
"lowerParts": each lower volume or attached part with its own roof: what it is (GARAGE, WING, ANNEX), its roof kind, and where it stands as seen on the front elevation (LEFT, RIGHT, FRONT for one projecting forward, REAR).
"dormers", "chimneys", "roofWindows": counts over the whole house (a chimney seen on several elevations is one chimney).
"garageDoor" and "entrance": the side whose elevation shows the garage door / the main entrance door (NONE if no elevation shows one).`
const TOOL = {
  name: 'report_form',
  description: 'Report the form of the house as typed facts.',
  input_schema: {
    type: 'object', additionalProperties: false, required: ['storeys', 'volumes', 'mainRoof', 'lowerParts', 'dormers', 'chimneys', 'roofWindows', 'garageDoor', 'entrance'],
    properties: {
      storeys: { type: 'string', enum: ['ONE', 'ONE_WITH_ATTIC', 'TWO', 'TWO_WITH_ATTIC'] },
      volumes: { type: 'integer' },
      mainRoof: { type: 'object', additionalProperties: false, required: ['kind', 'ridgeAlong', 'pitchDeg'], properties: { kind: { type: 'string', enum: ROOFS }, ridgeAlong: { type: 'string', enum: ['FRONT', 'SIDE', 'NONE'] }, pitchDeg: { type: 'number' } } },
      lowerParts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['what', 'roof', 'where'], properties: { what: { type: 'string', enum: ['GARAGE', 'WING', 'ANNEX'] }, roof: { type: 'string', enum: ROOFS }, where: { type: 'string', enum: ['LEFT', 'RIGHT', 'FRONT', 'REAR'] } } } },
      dormers: { type: 'integer' }, chimneys: { type: 'integer' }, roofWindows: { type: 'integer' },
      garageDoor: { type: 'string', enum: ['FRONT', 'LEFT', 'RIGHT', 'REAR', 'NONE'] },
      entrance: { type: 'string', enum: ['FRONT', 'LEFT', 'RIGHT', 'REAR', 'NONE'] },
      note: { type: 'string' },
    },
  },
}

async function main(): Promise<void> {
  if (!process.env.BUILDPLAN_ANTHROPIC_API_KEY) throw new Error('no key in the environment')
  await startDecoders()
  const pkg = J<{ assets: Array<{ id: string; caption?: string; variants: Array<{ url: string; byteHash: string }> }> }>('source-package.json')
  const graph = J<{ coordinateFrames: Array<{ id: string; assetId: string; variantByteHash: string }> }>('observation-graph.json')
  const sketches = J<{ reading: { sketches: Array<{ facade: string; frameId: string; sketch?: unknown }> } }>('sketches.json').reading.sketches.filter((x) => x.sketch)
  const cache = fileByteCache(cacheDir)
  const content: unknown[] = [{ type: 'text', text: `The elevations of one house (${sketches.length} picture(s)).` }]
  for (const x of sketches) {
    const frame = graph.coordinateFrames.find((f) => f.id === x.frameId)
    const variant = pkg.assets.find((a) => a.id === frame?.assetId)?.variants.find((v) => v.byteHash === frame?.variantByteHash)
    const got = variant ? await cache.get(variant.url) : undefined
    if (!frame || !variant || !got) continue
    const rasters = frameRasters(); rasters.set(variant.byteHash, decodeImage(got.bytes)); rasters.useFrames(graph.coordinateFrames as never)
    const pic = pictureOf(rasters.get(variant.byteHash) as Raster)
    content.push({ type: 'text', text: `Elevation captioned ${x.facade.replace('SIDE_UNSPECIFIED', 'SIDE (which side is not captioned)')}:` }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: Buffer.from(pic.png).toString('base64') } })
  }
  const spend = ledgerSpend({ phase: 'form-read', house, variant: 'FORM-JSON' }, { ...(opt('ledger') ? { path: opt('ledger') as string } : {}), ...(opt('opening') ? { openingUsd: Number(opt('opening')) } : {}), ...(opt('ceiling') ? { ceilingUsd: Number(opt('ceiling')) } : {}) })
  const model = anthropicConsultant({ model: MODEL, maxOutputTokens: 1500, timeoutMs: 180_000, effort: 'medium' })
  const price = CONSULT_PRICES[MODEL]
  const reserveUsd = reserveOf(price, Math.ceil((SYSTEM.length + JSON.stringify(TOOL).length + 300) / 2.5) + 2600 * Math.max(1, sketches.length), 1500, model.cache)
  const res = spend.reserve(MODEL, reserveUsd, `form read ${house}`)
  let turn: ModelTurn
  try { turn = await model.send({ system: SYSTEM, messages: [{ role: 'user', content }], tools: [TOOL] } as never) } catch (e) { spend.settle(res, { usd: reserveUsd, inputTokens: 0, outputTokens: 0 }, 'TRANSPORT'); throw e }
  const settled = settledOf(price, turn.usage)
  spend.settle(res, settled)
  const form = (turn.content as Array<{ type: string; input?: unknown }>).find((b) => b.type === 'tool_use')?.input
  // what the pipeline built from the contour sketches of the same pictures
  let built: unknown = { model: false }
  if (existsSync(join(runDir, 'model.json'))) {
    const raw = J<{ model?: unknown }>('model.json') as { model?: Record<string, unknown> } & Record<string, unknown>
    const m = (raw.model ?? raw) as { wallRings: unknown[]; roofs: Array<{ kind: string; pitchDeg?: number; ridgeAxis?: string }>; roofPlanes: unknown[]; chimneys: unknown[]; roofOpenings?: unknown[]; levels: unknown[] }
    built = { model: true, volumes: m.wallRings.length, roofs: m.roofs.map((r) => ({ kind: r.kind, pitchDeg: r.pitchDeg, ridgeAxis: r.ridgeAxis })), roofPlanes: m.roofPlanes.length, levels: m.levels.length, chimneys: m.chimneys.length, roofWindows: (m.roofOpenings ?? []).length }
  }
  writeFileSync(join(outDir, `${house}-form-read.json`), `${JSON.stringify({ house, model: MODEL, pictures: sketches.length, usd: settled.usd, form, built }, null, 1)}\n`)
  process.stdout.write(`${house}: ${JSON.stringify(form)}\n   built: ${JSON.stringify(built)}\n   ${settled.usd.toFixed(4)} USD\n`)
}
void main().then(() => process.exit(0), (e) => { process.stderr.write(`${(e as Error).message}\n`); process.exit(1) })
