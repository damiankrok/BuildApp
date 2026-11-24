/**
 * v3.54.20 — the product's structure read (`form-read/2`) asked of one recorded run's sheets: the elevations the sketch
 * reading used, the ground-floor plan, a section, the page's facts. Billed (one request a house, booked in the one
 * continuing ledger); writes <out>/<house>-structure.json (the raw answer, the parsed form, the refusals).
 *   npx vite-node research/source-to-model/v35420/structure-read.ts -- --run <run dir> --cache <byte cache> --house <id> --out <dir>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { decodeImage, fileByteCache, startDecoders } from '@buildapp/source-package'
import type { Raster } from '@buildapp/source-cv'
import { anthropicConsultant } from '../../../packages/analysis-service/src/consult/anthropic.js'
import { CONSULT_PRICES } from '../../../packages/analysis-service/src/consult/cost.js'
import { readForm } from '../../../packages/analysis-service/src/consult/form-read.js'
import { ledgerSpend } from '../v35417/ledger.js'

const argv = process.argv.slice(2).filter((a) => a !== '--')
const opt = (n: string): string | undefined => (argv.indexOf(`--${n}`) >= 0 ? argv[argv.indexOf(`--${n}`) + 1] : undefined)
const [runDir, cacheDir, house, outDir] = [opt('run') as string, opt('cache') as string, opt('house') as string, opt('out') as string]
mkdirSync(outDir, { recursive: true })
const J = <T>(f: string): T => JSON.parse(readFileSync(join(runDir, f), 'utf8')) as T
const MODEL = 'claude-sonnet-5-5'
type Pkg = { assets: Array<{ id: string; roles: { document: string; view?: string; storey?: string }; variants: Array<{ url: string; byteHash: string }> }>; publishedFacts?: Array<{ key: string; value: unknown; unit?: string }> }

async function main(): Promise<void> {
  if (!process.env.BUILDPLAN_ANTHROPIC_API_KEY) throw new Error('no key in the environment')
  await startDecoders()
  const pkg = J<Pkg>('source-package.json')
  const graph = J<{ coordinateFrames: Array<{ id: string; assetId: string; variantByteHash: string }> }>('observation-graph.json')
  const sketches = J<{ reading: { sketches: Array<{ facade: string; frameId: string; sketch?: unknown }> } }>('sketches.json').reading.sketches.filter((x) => x.sketch)
  const cache = fileByteCache(cacheDir)
  const rasterOfFrame = async (frameId: string): Promise<Raster | undefined> => {
    const frame = graph.coordinateFrames.find((f) => f.id === frameId)
    const variant = pkg.assets.find((a) => a.id === frame?.assetId)?.variants.find((v) => v.byteHash === frame?.variantByteHash)
    const got = variant ? await cache.get(variant.url) : undefined
    return got ? (decodeImage(got.bytes) as Raster) : undefined
  }
  const rasterOfRole = async (pick: (r: Pkg['assets'][number]['roles']) => boolean): Promise<Raster | undefined> => {
    const frames = graph.coordinateFrames.filter((f) => { const a = pkg.assets.find((q) => q.id === f.assetId); return a ? pick(a.roles) : false })
    let best: Raster | undefined
    for (const f of frames) { const r = await rasterOfFrame(f.id); if (r && (!best || r.width * r.height > best.width * best.height)) best = r }
    return best
  }
  const pictures: Array<{ caption: string; raster: Raster }> = []
  for (const x of sketches) { const r = await rasterOfFrame(x.frameId); if (r) pictures.push({ caption: x.facade.replace('SIDE_UNSPECIFIED', 'SIDE (which side is not captioned)').replace('SIDE_', 'SIDE '), raster: r }) }
  const plan = await rasterOfRole((r) => r.document === 'FLOOR_PLAN' && r.storey === 'GROUND')
  const section = await rasterOfRole((r) => r.document === 'SECTION')
  const storeys = [...new Set(pkg.assets.filter((a) => a.roles.document === 'FLOOR_PLAN').map((a) => a.roles.storey ?? 'UNKNOWN'))]
  const facts = [...(pkg.publishedFacts ?? []).filter((f) => typeof f.value === 'number' || typeof f.value === 'string').map((f) => `${f.key}: ${String(f.value)}${f.unit && f.unit !== 'none' ? ` ${f.unit}` : ''}`), `floor plans published for: ${storeys.join(', ')}`]
  const spend = ledgerSpend({ phase: 'structure-read', house, variant: 'FORM-READ-2' }, { ...(opt('ledger') ? { path: opt('ledger') as string } : {}), ...(opt('opening') ? { openingUsd: Number(opt('opening')) } : {}), ...(opt('ceiling') ? { ceilingUsd: Number(opt('ceiling')) } : {}) })
  const model = anthropicConsultant({ model: MODEL, maxOutputTokens: 1600, timeoutMs: 180_000, effort: 'medium' })
  const read = await readForm({ model, price: CONSULT_PRICES[MODEL], spend }, pictures, { ...(plan ? { plan } : {}), ...(section ? { section } : {}), facts })
  writeFileSync(join(outDir, `${house}-structure.json`), `${JSON.stringify({ house, model: MODEL, captions: pictures.map((p) => p.caption), plan: !!plan, section: !!section, facts, read }, null, 1)}\n`)
  const f = read.form
  process.stdout.write(`${house}: ${f ? `${f.storeys}(${f.storeysBasis}) main ${f.main.roof.kind}/${f.main.roof.ridgeAlong} pitch ${f.main.pitch.deg}(${f.main.pitch.status}) eaves ${f.main.eaves.m}(${f.main.eaves.status}) ridge ${f.main.ridge.m}(${f.main.ridge.status}) parts ${JSON.stringify(f.parts.map((p) => `${p.what}@${p.where}:${p.storeys}:${p.roof.kind}/${p.roof.ridgeAlong}`))} not ${JSON.stringify(f.notVolumes.map((p) => `${p.what}@${p.where}`))} pics ${JSON.stringify(f.pictures.map((p) => `${p.n}:${p.shows}:${p.roofSeenAs}${p.entranceDoor ? ':E' : ''}${p.garageDoor ? ':G' : ''}`))} ch ${f.chimneys} rw ${f.roofWindows} dorm ${f.dormers}` : `REFUSED ${read.refused.join('; ')}`} | captions ${JSON.stringify(pictures.map((p) => p.caption))} | ${read.usd.toFixed(4)} USD\n`)
}
void main().then(() => process.exit(0), (e) => { process.stderr.write(`${(e as Error).stack}\n`); process.exit(1) })
