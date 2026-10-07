/**
 * pair.ts — BUILDPLAN-ANALYZER-005L (RESEARCH ONLY): a row's base plan and each other plan the layout pass reads, side
 * by side, for a developer's eyes. Written outside the repository only.
 *
 *   npx vite-node research/analyzer-005l/pair.ts -- --row <row> --out <png>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PNG } from 'pngjs'
import { decodeImage, fileByteCache } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import type { SourceObservationGraph } from '@buildapp/source-observations'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import type { Raster } from '@buildapp/source-cv'
import { chooseBasePlan, readPlans } from '@buildapp/reconstruction'

const REPO = resolve(import.meta.dirname, '../..')
const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const out = arg('out', '')
if (!out || out.startsWith('/home/user/BuildApp')) throw new Error('pictures stay outside the repository')
type Row = { row: string; cache: string; inputs: { package: string; graph: string; metrics: string }; dropFrames?: string[] }
const row = (JSON.parse(readFileSync(join(REPO, 'research/analyzer-005l/rows.json'), 'utf8')) as { rows: Row[] }).rows.find((r) => r.row === arg('row', ''))
if (!row) throw new Error('no row')
const p = (x: string): string => (x.startsWith('/') ? x : join(REPO, x))
const pkg = JSON.parse(readFileSync(p(row.inputs.package), 'utf8')) as SourcePackage
const graph = JSON.parse(readFileSync(p(row.inputs.graph), 'utf8')) as SourceObservationGraph
const metrics = JSON.parse(readFileSync(p(row.inputs.metrics), 'utf8')) as MetricEvidenceSet
const cache = fileByteCache(row.cache)
const rasters = new Map<string, Raster | undefined>()
for (const a of pkg.assets) for (const v of a.variants) {
  if (rasters.has(v.byteHash)) continue
  const got = await cache.get(v.url)
  try {
    rasters.set(v.byteHash, got ? decodeImage(got.bytes) : undefined)
  } catch {
    rasters.set(v.byteHash, undefined)
  }
}
const { plans } = readPlans({ slug: row.row, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph, metrics, raster: (f) => rasters.get(f.variantByteHash), sheetCache: new Map() })
const base = chooseBasePlan(plans)
if (!base) throw new Error('no base')
const ordered = [base, ...plans.filter((x) => x !== base)]
const images = ordered.map((pl) => rasters.get(pl.frame.variantByteHash)).filter((r): r is Raster => !!r)
const W = images.reduce((a, r) => a + r.width, 0)
const H = Math.max(...images.map((r) => r.height))
const png = new PNG({ width: W, height: H })
png.data.fill(255)
let x0 = 0
for (const r of images) {
  for (let y = 0; y < r.height; y += 1)
    for (let x = 0; x < r.width; x += 1) {
      const i = (y * r.width + x) * 4
      const a = r.data[i + 3] / 255
      const k = (y * W + x0 + x) * 4
      for (let c = 0; c < 3; c += 1) png.data[k + c] = Math.round(r.data[i + c] * a + 255 * (1 - a))
      png.data[k + 3] = 255
    }
  x0 += r.width
}
writeFileSync(out, PNG.sync.write(png))
process.stdout.write(`${ordered.map((pl) => `${pl.storey}:${pl.frame.id}`).join(' | ')}\n`)
