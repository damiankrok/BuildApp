/**
 * v3.54.19 probe (0 USD): LOCAL's own partition reader (`readInterior`) run on the plan of a finished run, inside the
 * body the SOURCE outline gives — the question being whether the interior can be read for a body LOCAL did not build.
 *   npx vite-node research/source-to-model/v35419/interior-probe.ts -- <run dir> <byte cache dir> <out dir> [name]
 * Writes <name>-interior.png (plan with the outline, the read walls and door gaps) and prints the reading.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { decodeImage, fileByteCache, startDecoders } from '@buildapp/source-package'
import { frameRasters } from '@buildapp/source-cv'
import type { Raster } from '@buildapp/source-cv'
import { readInterior } from '@buildapp/reconstruction'
import type { PlanFrameV2 } from '@buildapp/reconstruction'
import { encodePng } from '../../../packages/analysis-service/src/diagnostics.js'

const [runDir, cacheDir, outDir, nameArg] = process.argv.slice(2).filter((a) => a !== '--')
const name = nameArg ?? runDir.split('/').filter(Boolean).pop() ?? 'house'
mkdirSync(outDir, { recursive: true })
const J = <T>(f: string): T => JSON.parse(readFileSync(join(runDir, f), 'utf8')) as T
const pkg = J<{ assets: Array<{ id: string; variants: Array<{ url: string; byteHash: string }> }> }>('source-package.json')
const graph = J<{ coordinateFrames: Array<{ id: string; assetId: string; variantByteHash: string }> }>('observation-graph.json')
const massing = J<{ plan?: { frameId: string; outlinePx?: Array<[number, number]>; observation?: { outline: Array<{ x: number; z: number }> } } }>('massing.json')
const plan = massing.plan
if (!plan?.outlinePx || !plan.observation) throw new Error('no outline in metres recorded for this run')

const dark = (r: Raster, x: number, y: number): boolean => {
  if (x < 0 || y < 0 || x >= r.width || y >= r.height) return false
  const i = (Math.round(y) * r.width + Math.round(x)) * 4
  const [a, b, c] = [r.data[i], r.data[i + 1], r.data[i + 2]]
  return 0.299 * a + 0.587 * b + 0.114 * c < 95 && Math.max(a, b, c) - Math.min(a, b, c) < 70
}
const median = (v: number[]): number => { const s = [...v].sort((p, q) => p - q); return s.length === 0 ? NaN : s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2 }

async function main(): Promise<void> {
  await startDecoders()
  const frame = graph.coordinateFrames.find((f) => f.id === plan!.frameId)
  const asset = pkg.assets.find((a) => a.id === frame?.assetId)
  const variant = asset?.variants.find((v) => v.byteHash === frame?.variantByteHash)
  if (!frame || !variant) throw new Error('plan frame not found')
  const got = await fileByteCache(cacheDir).get(variant.url)
  if (!got) throw new Error(`bytes of ${variant.url} are not in the cache`)
  const rasters = frameRasters()
  rasters.set(variant.byteHash, decodeImage(got.bytes))
  rasters.useFrames(graph.coordinateFrames as never)
  const raster0 = rasters.get(variant.byteHash) as Raster
  const o = plan!.outlinePx as Array<[number, number]>
  const xs = o.map((q) => q[0]); const ys = o.map((q) => q[1])
  let [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const widthM = Math.max(...plan!.observation!.outline.map((q) => q.x))
  const s = widthM / (x1 - x0)
  // how this sheet draws a wall: the commonest colour in the band just inside the traced outline (0.10–0.25 m in)
  const hist = new Map<number, number>()
  let total = 0
  const sample = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= raster0.width || y >= raster0.height) return
    const i = (Math.round(y) * raster0.width + Math.round(x)) * 4
    const k = ((raster0.data[i] >> 4) << 8) | ((raster0.data[i + 1] >> 4) << 4) | (raster0.data[i + 2] >> 4)
    hist.set(k, (hist.get(k) ?? 0) + 1); total += 1
  }
  for (let d = Math.max(2, Math.round(0.1 / s)); d <= Math.max(4, Math.round(0.25 / s)); d += 1) {
    for (let x = x0 + 20; x < x1 - 20; x += 2) { sample(x, y0 + d); sample(x, y1 - d) }
    for (let y = y0 + 20; y < y1 - 20; y += 2) { sample(x0 + d, y); sample(x1 - d, y) }
  }
  const ranked = [...hist.entries()].sort((a, b) => b[1] - a[1])
  const [mk, mn] = ranked[0]
  const mode: [number, number, number] = [((mk >> 8) & 15) * 16 + 8, ((mk >> 4) & 15) * 16 + 8, (mk & 15) * 16 + 8]
  const luma = 0.299 * mode[0] + 0.587 * mode[1] + 0.114 * mode[2]
  console.log(`${name}: wall colour ${mode.join(',')} (luma ${luma.toFixed(0)}) on ${((mn / total) * 100).toFixed(0)} % of the band; next ${ranked.slice(1, 4).map(([k, n]) => `${((k >> 8) & 15) * 16 + 8},${((k >> 4) & 15) * 16 + 8},${(k & 15) * 16 + 8}:${((n / total) * 100).toFixed(0)}%`).join(' ')}`)
  // the sheet as the partition reader expects it: pixels of the wall colour are painted as ink
  const raster: Raster = { width: raster0.width, height: raster0.height, data: new Uint8ClampedArray(raster0.data) }
  if (luma < 215 && luma >= 60) {
    const TOL = 26
    for (let i = 0; i < raster.data.length; i += 4) if (Math.abs(raster.data[i] - mode[0]) <= TOL && Math.abs(raster.data[i + 1] - mode[1]) <= TOL && Math.abs(raster.data[i + 2] - mode[2]) <= TOL) { raster.data[i] = 0; raster.data[i + 1] = 0; raster.data[i + 2] = 0 }
  }
  // the outer face and the band's thickness on each side of the outline's box, from the ink itself
  const sideScan = (side: 'L' | 'R' | 'T' | 'B'): { face: number; thick: number; n: number } => {
    const faces: number[] = []; const thick: number[] = []
    const [a0, a1] = side === 'L' || side === 'R' ? [y0, y1] : [x0, x1]
    const base = side === 'L' ? x0 : side === 'R' ? x1 : side === 'T' ? y0 : y1
    const inward = side === 'L' || side === 'T' ? 1 : -1
    for (let a = a0 + (a1 - a0) * 0.08; a < a1 - (a1 - a0) * 0.08; a += 3) {
      let first: number | undefined
      for (let d = -30; d <= 45; d += 1) {
        const p = base + d * inward
        const isDark = side === 'L' || side === 'R' ? dark(raster, p, a) : dark(raster, a, p)
        if (isDark && first === undefined) first = d
        if (!isDark && first !== undefined) { if (d - first >= 3) { faces.push(base + first * inward); thick.push(d - first) } break }
      }
    }
    return { face: median(faces), thick: median(thick), n: faces.length }
  }
  const scans = { L: sideScan('L'), R: sideScan('R'), T: sideScan('T'), B: sideScan('B') }
  console.log(`${name}: outline box ${x0},${y0}..${x1},${y1} px; ${(s * 100).toFixed(3)} cm/px; side scans ${JSON.stringify(scans)}`)
  const snapped = { x0: Number.isFinite(scans.L.face) ? scans.L.face : x0, x1: Number.isFinite(scans.R.face) ? scans.R.face : x1, y0: Number.isFinite(scans.T.face) ? scans.T.face : y0, y1: Number.isFinite(scans.B.face) ? scans.B.face : y1 }
  ;[x0, x1, y0, y1] = [snapped.x0, snapped.x1, snapped.y0, snapped.y1]
  const wallPxFull = median(Object.values(scans).map((q) => q.thick).filter((v) => Number.isFinite(v))) || 0.4 / s
  const wallM = wallPxFull * s
  const frameV2: PlanFrameV2 = {
    frameId: frame.id, assetId: frame.assetId, storeyIndex: 0, mppX: s, mppY: s, originPx: { x: x0, y: y1 }, why: 'the traced outline snapped to its ink, at the outline scale',
    toWorld: (px, py) => ({ x: (px - x0) * s, z: (y1 - py) * s }), toPixel: (x, z) => ({ x: x0 + x / s, y: y1 - z / s }), wallPx: wallPxFull / 2,
  }
  const body = { x0: 0, z0: 0, x1: (x1 - x0) * s, z1: (y1 - y0) * s }
  const notes: string[] = []
  const reading = readInterior(raster, frameV2, body, wallM, 0, [], [], { onNote: (n) => notes.push(n) })
  console.log(`  body ${body.x1.toFixed(2)} × ${body.z1.toFixed(2)} m, exterior wall ${wallM.toFixed(2)} m (${wallPxFull.toFixed(1)} px)`)
  console.log(`  walls ${reading.walls.length}, doors ${reading.doors.length}, blocks ${reading.blocks.length}, rooms ${reading.rooms.length}, unresolved ${reading.unresolved.length}`)
  for (const w of reading.walls) console.log(`   wall ${w.id} ${w.axis} at ${w.at.toFixed(2)} ${w.from.toFixed(2)}..${w.to.toFixed(2)} t ${w.thicknessM.toFixed(2)} ends ${w.ends.start}/${w.ends.end} c ${w.confidence.toFixed(2)}`)
  for (const d of reading.doors) console.log(`   door ${d.id} ${d.wallAxis} at ${d.at.toFixed(2)} ${d.from.toFixed(2)}..${d.to.toFixed(2)}`)
  for (const u of reading.unresolved.slice(0, 6)) console.log(`   unresolved: ${u.what}: ${u.reason}`)
  // overlay
  const out: Raster = { width: raster0.width, height: raster0.height, data: new Uint8ClampedArray(raster0.data) }
  const blend = (x: number, y: number, c: [number, number, number], a: number): void => {
    if (x < 0 || y < 0 || x >= out.width || y >= out.height) return
    const i = (y * out.width + x) * 4
    for (let k = 0; k < 3; k += 1) out.data[i + k] = Math.round(out.data[i + k] * (1 - a) + c[k] * a)
  }
  const rect = (ax: number, ay: number, bx: number, by: number, c: [number, number, number], a: number): void => { for (let y = Math.round(Math.min(ay, by)); y <= Math.round(Math.max(ay, by)); y += 1) for (let x = Math.round(Math.min(ax, bx)); x <= Math.round(Math.max(ax, bx)); x += 1) blend(x, y, c, a) }
  rect(x0, y0, x1, y0 + 1, [0, 90, 255], 1); rect(x0, y1 - 1, x1, y1, [0, 90, 255], 1); rect(x0, y0, x0 + 1, y1, [0, 90, 255], 1); rect(x1 - 1, y0, x1, y1, [0, 90, 255], 1)
  for (const w of reading.walls) {
    const h = w.thicknessM / 2
    const a = w.axis === 'X' ? frameV2.toPixel(w.from, w.at - h) : frameV2.toPixel(w.at - h, w.from)
    const b = w.axis === 'X' ? frameV2.toPixel(w.to, w.at + h) : frameV2.toPixel(w.at + h, w.to)
    rect(a.x, a.y, b.x, b.y, [255, 0, 0], 0.6)
  }
  for (const d of reading.doors) {
    const a = d.wallAxis === 'X' ? frameV2.toPixel(d.from, d.at - 0.08) : frameV2.toPixel(d.at - 0.08, d.from)
    const b = d.wallAxis === 'X' ? frameV2.toPixel(d.to, d.at + 0.08) : frameV2.toPixel(d.at + 0.08, d.to)
    rect(a.x, a.y, b.x, b.y, [0, 170, 0], 0.8)
  }
  writeFileSync(join(outDir, `${name}-interior.png`), encodePng(out))
  writeFileSync(join(outDir, `${name}-interior.json`), `${JSON.stringify({ name, cmPerPx: s * 100, box: { x0, x1, y0, y1 }, wallM, walls: reading.walls, doors: reading.doors, rooms: reading.rooms.map((r) => ({ id: r.id, areaM2: r.areaM2, openPlan: r.openPlan })), unresolved: reading.unresolved, notes }, null, 1)}\n`)
}
void main().then(() => process.exit(0))
