/**
 * side-walls.ts — 005L council B5L-1 probe (RESEARCH ONLY): for one row, the other plans' walls near each side of the
 * body their storey stands on, placed into the building frame. Numbers only.
 *   npx vite-node research/analyzer-005l/side-walls.ts -- --row marcowki
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { decodeImage, fileByteCache } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import type { SourceObservationGraph } from '@buildapp/source-observations'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import type { Raster } from '@buildapp/source-cv'
import { composeStructuralLayout, levelsFrom, ringBounds } from '@buildapp/reconstruction'

const REPO = resolve(import.meta.dirname, '../..')
const rowId = process.argv[process.argv.indexOf('--row') + 1]
const rows = (JSON.parse(readFileSync(join(REPO, 'research/analyzer-005l/rows.json'), 'utf8')) as { rows: Array<{ row: string; cache: string; inputs: { package: string; graph: string; metrics: string } }> }).rows
const row = rows.find((r) => r.row === rowId)!
const pkg = JSON.parse(readFileSync(row.inputs.package, 'utf8')) as SourcePackage
const graph = JSON.parse(readFileSync(row.inputs.graph, 'utf8')) as SourceObservationGraph
const metrics = JSON.parse(readFileSync(row.inputs.metrics, 'utf8')) as MetricEvidenceSet
const cache = fileByteCache(row.cache)
const rasters = new Map<string, Raster | undefined>()
for (const a of pkg.assets) for (const v of a.variants) if (!rasters.has(v.byteHash)) { const got = await cache.get(v.url); rasters.set(v.byteHash, got ? decodeImage(got.bytes) : undefined) }
const section = graph.coordinateFrames.find((f) => f.roles.projection === 'ORTHOGRAPHIC_SECTION')
const { draft } = composeStructuralLayout({ slug: row.row, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph, metrics, raster: (f) => rasters.get(f.variantByteHash), levels: levelsFrom(metrics, section?.id), publishedAreas: pkg.publishedFacts, sheetCache: new Map() })
const frame = draft.frame!
const base = draft.base!
const mx = frame.metresPerPixelX, my = frame.metresPerPixelY
const toX = (px: number) => (px - frame.originPx.x) * mx
const toZ = (px: number) => (px - frame.originPx.y) * my
for (const m of draft.masses) console.log('mass', m.id, m.role, JSON.stringify(ringBounds(m.ring)), m.storeySpan.fromIndex + '..' + m.storeySpan.toIndex)
console.log('frame', JSON.stringify({ mx, my, origin: frame.originPx, zFlip: (frame as { zFlip?: unknown }).zFlip }))
console.log('base wallPx', base.wallPx, 'wallM', +(base.wallPx * mx).toFixed(3))
for (const plan of draft.plans) {
  if (plan.frame.id === base.frame.id) continue
  const a = draft.alignments.get(plan.frame.id)
  if (!a) continue
  console.log(`\nplan ${plan.storey} wallPx ${plan.wallPx} placed wall ${(plan.wallPx * a.scale * mx).toFixed(3)} m; k ${a.scale} offset ${a.offsetX},${a.offsetY}`)
  const reg = draft.storeyRegistrations.find((r) => r.frameId === plan.frame.id)
  for (const g of reg?.regions ?? []) console.log('  region', g.regionId, JSON.stringify(g.bounds), 'body', g.body, g.overhang, 'wf', g.wallFraction)
  const env = plan.decomposition.envelope?.rect
  if (env) console.log('  envelope placed', JSON.stringify({ x0: +toX(env.x0 * a.scale + a.offsetX).toFixed(2), x1: +toX(env.x1 * a.scale + a.offsetX).toFixed(2), z0: +toZ(env.y0 * a.scale + a.offsetY).toFixed(2), z1: +toZ(env.y1 * a.scale + a.offsetY).toFixed(2) }))
  const longest = Math.max(...plan.bands.map((b) => b.length))
  for (const b of [...plan.bands].filter((b) => b.length >= plan.wallPx * 2.5).sort((p, q) => (p.axis === q.axis ? p.axisPx - q.axisPx : p.axis.localeCompare(q.axis)))) {
    const at = b.axis === 'VERTICAL' ? toX(b.axisPx * a.scale + a.offsetX) : toZ(b.axisPx * a.scale + a.offsetY)
    const from = b.axis === 'VERTICAL' ? toZ(b.bounds.y0 * a.scale + a.offsetY) : toX(b.bounds.x0 * a.scale + a.offsetX)
    const to = b.axis === 'VERTICAL' ? toZ(b.bounds.y1 * a.scale + a.offsetY) : toX(b.bounds.x1 * a.scale + a.offsetX)
    console.log(`  band ${b.axis === 'VERTICAL' ? 'x' : 'z'}=${at.toFixed(2)} along ${from.toFixed(2)}..${to.toFixed(2)} len ${(b.length * a.scale * mx).toFixed(2)} m thick ${b.thickness.toFixed(1)}px (${(b.thickness / plan.wallPx).toFixed(2)} wall) ${b.length >= longest * 0.25 ? 'FACADE' : ''}`)
  }
  for (const [axis, lines] of [['x', plan.decomposition.linesX], ['z', plan.decomposition.linesY]] as const) console.log(`  lines ${axis}:`, lines.map((l) => `${(axis === 'x' ? toX(l.px * a.scale + a.offsetX) : toZ(l.px * a.scale + a.offsetY)).toFixed(2)}${l.support.chainIds.length ? 'c' : ''}${l.support.bandLength > 0 ? 'b' : ''}`).join(' '))
}
