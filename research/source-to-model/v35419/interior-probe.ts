/**
 * v3.54.19 probe (0 USD): the plan skeleton (`consult/plan-skeleton.ts`) on the plan of a finished run, inside the outline
 * the run recorded — walls, interior doors and exterior gaps drawn back on the sheet.
 *   npx vite-node research/source-to-model/v35419/interior-probe.ts -- <run dir> <byte cache dir> <out dir> [name]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { decodeImage, fileByteCache, startDecoders } from '@buildapp/source-package'
import { frameRasters } from '@buildapp/source-cv'
import type { Raster } from '@buildapp/source-cv'
import { encodePng } from '../../../packages/analysis-service/src/diagnostics.js'
import { readPlanSkeleton } from '../../../packages/analysis-service/src/consult/plan-skeleton.js'

const [runDir, cacheDir, outDir, nameArg] = process.argv.slice(2).filter((a) => a !== '--')
const name = nameArg ?? runDir.split('/').filter(Boolean).pop() ?? 'house'
mkdirSync(outDir, { recursive: true })
const J = <T>(f: string): T => JSON.parse(readFileSync(join(runDir, f), 'utf8')) as T
type Plan = { frameId: string; outlinePx?: Array<[number, number]>; observation?: { outline: Array<{ x: number; z: number }> } }
const pkg = J<{ assets: Array<{ id: string; variants: Array<{ url: string; byteHash: string }> }> }>('source-package.json')
const graph = J<{ coordinateFrames: Array<{ id: string; assetId: string; variantByteHash: string }> }>('observation-graph.json')
let plan: Plan | undefined = existsSync(join(runDir, 'massing.json')) ? J<{ plan?: Plan }>('massing.json').plan : undefined
let cmPerPx: number | undefined
for (const e of J<Array<Record<string, unknown>>>('events.json')) {
  if (e.kind === 'PLAN_SCALE_FROM_OUTLINE' || e.kind === 'PLAN_SCALE_FROM_PRINTED_DIMENSIONS') cmPerPx = e.cmPerPx as number
}
if (!plan?.outlinePx) throw new Error('no outline recorded for this run')
const o = plan.outlinePx
const wPx = Math.max(...o.map((q) => q[0])) - Math.min(...o.map((q) => q[0]))
const s = plan.observation ? Math.max(...plan.observation.outline.map((q) => q.x)) / wPx : cmPerPx ? cmPerPx / 100 : NaN
if (!Number.isFinite(s)) throw new Error('no scale recorded for this run')

async function main(): Promise<void> {
  await startDecoders()
  const frame = graph.coordinateFrames.find((f) => f.id === plan?.frameId)
  const asset = pkg.assets.find((a) => a.id === frame?.assetId)
  const variant = asset?.variants.find((v) => v.byteHash === frame?.variantByteHash)
  if (!frame || !variant) throw new Error('plan frame not found')
  const got = await fileByteCache(cacheDir).get(variant.url)
  if (!got) throw new Error(`bytes of ${variant.url} are not in the cache`)
  const rasters = frameRasters()
  rasters.set(variant.byteHash, decodeImage(got.bytes))
  rasters.useFrames(graph.coordinateFrames as never)
  const raster = rasters.get(variant.byteHash) as Raster
  const sk = readPlanSkeleton({ frameId: frame.id, sourceByteHash: variant.byteHash, raster, outlinePx: o, mPerPx: s })
  const lenM = sk.walls.reduce((t, w) => t + (w.to - w.from) * s, 0)
  console.log(`${name}: ${(s * 100).toFixed(3)} cm/px; ink ${sk.ink.rgb.join(',')} ${(sk.ink.share * 100).toFixed(0)} % filled=${sk.ink.filled}; wall ${(sk.wallPx * s).toFixed(2)} m; snapped ${sk.snapped.map((q) => `e${q.edge}:${q.byPx}`).join(' ') || 'none'}; walls ${sk.walls.length} (${lenM.toFixed(1)} m), doors ${sk.doors.length}, gaps ${sk.gaps.length} (${sk.gaps.filter((g) => g.lines).length} with lines); refused ${JSON.stringify(sk.refused)}`)
  const out: Raster = { width: raster.width, height: raster.height, data: new Uint8ClampedArray(raster.data) }
  const blend = (x: number, y: number, c: [number, number, number], a: number): void => {
    if (x < 0 || y < 0 || x >= out.width || y >= out.height) return
    const i = (y * out.width + x) * 4
    for (let k = 0; k < 3; k += 1) out.data[i + k] = Math.round(out.data[i + k] * (1 - a) + c[k] * a)
  }
  const rect = (ax: number, ay: number, bx: number, by: number, c: [number, number, number], a: number): void => { for (let y = Math.round(Math.min(ay, by)); y <= Math.round(Math.max(ay, by)); y += 1) for (let x = Math.round(Math.min(ax, bx)); x <= Math.round(Math.max(ax, bx)); x += 1) blend(x, y, c, a) }
  sk.outlinePx.forEach((p, i) => { const q = sk.outlinePx[(i + 1) % sk.outlinePx.length]; rect(p[0] - 1, p[1] - 1, q[0] + 1, q[1] + 1, [0, 90, 255], 1) })
  for (const w of sk.walls) { const h = Math.max(1.5, w.thicknessPx / 2); if (w.axis === 'H') rect(w.from, w.at - h, w.to, w.at + h, [255, 0, 0], 0.6); else rect(w.at - h, w.from, w.at + h, w.to, [255, 0, 0], 0.6) }
  for (const d of sk.doors) { if (d.axis === 'H') rect(d.from, d.at - 4, d.to, d.at + 4, [0, 170, 0], 0.85); else rect(d.at - 4, d.from, d.at + 4, d.to, [0, 170, 0], 0.85) }
  const edges = sk.outlinePx.map((p, i) => ({ p, q: sk.outlinePx[(i + 1) % sk.outlinePx.length] }))
  for (const g of sk.gaps) {
    const e = edges[g.edge]
    const c: [number, number, number] = g.lines ? [0, 200, 255] : [255, 150, 0]
    const inward = g.face === 'TOP' || g.face === 'LEFT' ? 1 : -1
    if (g.face === 'TOP' || g.face === 'BOTTOM') rect(g.from, e.p[1], g.to, e.p[1] + inward * sk.wallPx, c, 0.6)
    else rect(e.p[0], g.from, e.p[0] + inward * sk.wallPx, g.to, c, 0.6)
  }
  writeFileSync(join(outDir, `${name}-skeleton.png`), encodePng(out))
  writeFileSync(join(outDir, `${name}-skeleton.json`), `${JSON.stringify(sk, null, 1)}\n`)
}
void main().then(() => process.exit(0))
