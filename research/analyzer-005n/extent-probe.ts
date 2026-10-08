/**
 * extent-probe.ts — BUILDPLAN-ANALYZER-005N baseline forensics (RESEARCH ONLY): for one row's plans, the parts of the
 * extent decision — the read chains' rect, the legacy frame, the wall witness, the framing chains — and every long band
 * with whether it lies inside each. Numbers and ids only.
 *
 *   npx vite-node research/analyzer-005n/extent-probe.ts -- --package <pkg> --graph <graph> --metrics <metrics> --cache <dir> [--frame <id>]
 */
import { readFileSync } from 'node:fs'
import { decodeImage, fileByteCache } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import type { SourceObservationGraph } from '@buildapp/source-observations'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import type { Raster } from '@buildapp/source-cv'
import { planSheet } from '../../packages/reconstruction/src/layout.js'
import { dimensionedExtent, planExtent } from '../../packages/reconstruction/src/plan-decomposition.js'
import { framingChains } from '../../packages/reconstruction/src/plan-extent.js'

const arg = (n: string, f = ''): string => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : f
}
const pkg = JSON.parse(readFileSync(arg('package'), 'utf8')) as SourcePackage
const graph = JSON.parse(readFileSync(arg('graph'), 'utf8')) as SourceObservationGraph
const metrics = JSON.parse(readFileSync(arg('metrics'), 'utf8')) as MetricEvidenceSet
const cache = fileByteCache(arg('cache'))
const rasters = new Map<string, Raster | undefined>()
for (const a of pkg.assets) for (const v of a.variants) if (!rasters.has(v.byteHash)) {
  const got = await cache.get(v.url)
  try { rasters.set(v.byteHash, got ? decodeImage(got.bytes) : undefined) } catch { rasters.set(v.byteHash, undefined) }
}
const options = { slug: 'probe', sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph, metrics, raster: (f: { variantByteHash: string }) => rasters.get(f.variantByteHash), sheetCache: new Map() }
for (const frame of graph.coordinateFrames.filter((f) => f.roles.projection === 'ORTHOGRAPHIC_PLAN' && f.roles.document === 'FLOOR_PLAN' && (!arg('frame') || f.id === arg('frame')))) {
  const sheet = planSheet(frame, options as never)
  if (!sheet) continue
  const chains = metrics.chains.filter((c) => c.frameId === frame.id)
  const ext = planExtent(chains, sheet.bands, sheet.wallPx, sheet.witness, metrics.dimensionObservations?.filter((o) => o.frameId === frame.id))
  const fr = framingChains(chains, sheet.witness ?? null, sheet.wallPx)
  console.log(JSON.stringify({
    frame: frame.id, storey: frame.roles, wallPx: sheet.wallPx,
    chainRect: dimensionedExtent(chains),
    readChains: chains.filter((c) => c.segments.some((s) => s.status === 'READ' || s.status === 'CHAIN_CORRECTED')).map((c) => ({ id: c.id, axis: c.axis, ticks: [c.ticksPx[0], c.ticksPx[c.ticksPx.length - 1]], baseline: c.baselinePx })),
    witness: sheet.witness ? { rect: sheet.witness.rect } : null,
    roles: fr.roles,
    extent: ext ? { rect: ext.rect, weak: ext.weak, why: ext.why, provenance: ext.provenance, refused: ext.refused } : null,
    longBands: sheet.bands.filter((b) => b.length >= sheet.wallPx * 2.5).map((b) => [b.axis[0], Math.round(b.axisPx), Math.round(b.thickness), b.bounds.x0, b.bounds.y0, b.bounds.x1, b.bounds.y1]),
  }, null, 1))
}
