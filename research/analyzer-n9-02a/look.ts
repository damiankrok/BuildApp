/**
 * N9-02A (research only, offline): what each elevation of one sealed run looks like to the registration — its traced
 * extent, the neutral bands the wall-band registration reads, and a downscaled copy of the sheet with them drawn,
 * written OUTSIDE the repository (the copy carries source pixels).
 *   npx vite-node research/analyzer-n9-02a/look.ts -- --run <dir> --graph <graph.json> --cache <dir> --out <dir>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SourcePackageSchema, decodeImage, fileByteCache, selectedVariant } from '@buildapp/source-package'
import { buildingExtent, neutralBands } from '@buildapp/reconstruction'
import type { Raster } from '@buildapp/source-cv'
import { encodePng } from '../../packages/analysis-service/src/diagnostics.js'

const arg = (n: string): string => process.argv[process.argv.indexOf(`--${n}`) + 1]
const run = arg('run')
const out = arg('out')
mkdirSync(out, { recursive: true })
const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(join(run, 'source-package.json'), 'utf8')))
const graph = JSON.parse(readFileSync(arg('graph'), 'utf8'))
const cache = fileByteCache(arg('cache'))
const rasters = new Map<string, Raster>()
for (const a of pkg.assets) {
  const v = selectedVariant(a)
  const got = await cache.get(v.url)
  if (got) try { rasters.set(v.byteHash, decodeImage(got.bytes)) } catch { /* undecodable: listed as such */ }
}
const rows: unknown[] = []
for (const f of graph.coordinateFrames.filter((x: any) => x.roles.document === 'ELEVATION')) {
  const r = rasters.get(f.variantByteHash)
  const obs = graph.observations.filter((o: any) => o.frameId === f.id)
  const ext = buildingExtent(f, obs, r)
  const bands = r && ext ? neutralBands(r, ext.rect) : []
  rows.push({ frameId: f.id, roles: f.roles, size: f.size, extent: ext?.rect, extentWhy: ext?.why, bands: bands.map((b) => ({ x0: b.x0, x1: b.x1, rows: b.rows, share: Math.round(b.share * 1000) / 1000 })).filter((b) => b.share >= 0.05) })
  if (r && ext) {
    const s = Math.max(1, Math.ceil(r.width / 700))
    const w = Math.floor(r.width / s), h = Math.floor(r.height / s)
    const c: Raster = { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = ((y * s) * r.width + x * s) * 4, p = (y * w + x) * 4; c.data[p] = r.data[o]; c.data[p + 1] = r.data[o + 1]; c.data[p + 2] = r.data[o + 2]; c.data[p + 3] = 255 }
    const box = (x0: number, y0: number, x1: number, y1: number, rgb: number[]) => { for (let x = Math.round(x0 / s); x <= Math.round(x1 / s); x++) for (const y of [Math.round(y0 / s), Math.round(y1 / s)]) if (x >= 0 && x < w && y >= 0 && y < h) { const p = (y * w + x) * 4; c.data[p] = rgb[0]; c.data[p + 1] = rgb[1]; c.data[p + 2] = rgb[2] } for (let y = Math.round(y0 / s); y <= Math.round(y1 / s); y++) for (const x of [Math.round(x0 / s), Math.round(x1 / s)]) if (x >= 0 && x < w && y >= 0 && y < h) { const p = (y * w + x) * 4; c.data[p] = rgb[0]; c.data[p + 1] = rgb[1]; c.data[p + 2] = rgb[2] } }
    box(ext.rect.x0, ext.rect.y0, ext.rect.x1, ext.rect.y1, [255, 0, 0])
    for (const b of bands.filter((b) => b.share >= 0.15)) box(b.x0, b.y0, b.x1, b.y1, [0, 160, 0])
    writeFileSync(join(out, `${f.id.slice(-24)}.png`), encodePng(c))
  }
}
console.log(JSON.stringify(rows, null, 1))
