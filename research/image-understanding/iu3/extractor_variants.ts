/**
 * IU-03A part B: the EXISTING production solver (reconstructV2) on one house, five times, with the same sealed graph,
 * metric evidence, plans and sections:
 *
 *   RAW            the publisher's elevation rasters (baseline)
 *   CLEAN          IU-02 clean-facade.png in their place
 *   ANCHORED       clean + source-confirmed anchors drawn back as ink (iu3/evidence.anchored)
 *   RAW_FGE        RESEARCH ADAPTER: the raw rasters, and each elevation frame's SILHOUETTE observation replaced by the
 *                  FacadeGeometryEvidence outline cut at its OBSERVED ground row (frames without one keep their own)
 *   ANCHORED_FGE   the adapter over the anchored rasters
 *
 * The solver's code is not touched: only the `raster` callback and, for the *_FGE variants, the graph object handed to
 * it differ. The graph is a research copy; the sealed file on disk is never written.
 *
 *   npx vite-node research/image-understanding/iu3/extractor_variants.ts -- --house <id> --run <dir> --package <json> \
 *        --cache <byte cache> --variants <dir with <house>-clean.json, -anchored.json, -silhouettes.json> --out <json>
 *
 * RESEARCH ONLY; production never imports it. OFFLINE: rasters come from cached bytes and local PNGs.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'
import { serializeModel } from '@buildapp/model'
import { SourcePackageSchema, archonAdapter, decodeImage, fileByteCache, genericProjectPageAdapter, selectedVariant } from '@buildapp/source-package'
import { reconstructV2 } from '@buildapp/reconstruction'
import { identityOf } from '../../../packages/analysis-service/src/identity.js'

const REPO = resolve(import.meta.dirname, '../../..')
const arg = (name: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0 || i + 1 >= process.argv.length) throw new Error(`--${name} is required`)
  return process.argv[i + 1]
}
const out = resolve(arg('out'))
if (out === REPO || out.startsWith(`${REPO}/`)) throw new Error('REFUSED: comparison outputs never go inside the repository')
const house = arg('house')
const run = resolve(arg('run'))
const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(arg('package'), 'utf8')))
const load = (name: string): unknown => JSON.parse(existsSync(join(run, `${name}.json`)) ? readFileSync(join(run, `${name}.json`), 'utf8') : gunzipSync(readFileSync(join(run, `${name}.json.gz`))).toString('utf8'))
const graph = load('observation-graph') as { observations: Array<Record<string, unknown>>; coordinateFrames: Array<{ id: string; assetId: string; size: { width: number; height: number } }> }
const metrics = load('metric-evidence') as never
const cache = fileByteCache(arg('cache'))
const vdir = resolve(arg('variants'))
const maps = {
  clean: JSON.parse(readFileSync(join(vdir, `${house}-clean.json`), 'utf8')) as Record<string, string>,
  anchored: JSON.parse(readFileSync(join(vdir, `${house}-anchored.json`), 'utf8')) as Record<string, string>,
  silhouettes: JSON.parse(readFileSync(join(vdir, `${house}-silhouettes.json`), 'utf8')) as Record<string, number[][] | null>,
}

type Raster = ReturnType<typeof decodeImage>
const rasters: Record<'raw' | 'clean' | 'anchored', Map<string, Raster | undefined>> = { raw: new Map(), clean: new Map(), anchored: new Map() }
for (const asset of pkg.assets) {
  const variant = selectedVariant(asset)
  const got = await cache.get(variant.url)
  if (!got) continue
  let raw: Raster | undefined
  try {
    raw = decodeImage(got.bytes)
  } catch {
    raw = undefined // an undecodable cached variant is simply not available as a raster, exactly as in production
  }
  rasters.raw.set(variant.byteHash, raw)
  for (const k of ['clean', 'anchored'] as const) {
    const p = maps[k][asset.id]
    if (p && raw) {
      const c = decodeImage(new Uint8Array(readFileSync(p)))
      if (c.width !== raw.width || c.height !== raw.height) throw new Error(`${k} raster for ${asset.id} is ${c.width}x${c.height}, source ${raw.width}x${raw.height}: not the identity transform`)
      rasters[k].set(variant.byteHash, c)
    } else rasters[k].set(variant.byteHash, raw)
  }
}

/** The adapter: a research copy of the graph whose elevation SILHOUETTEs are the evidence outlines. */
const injected: Array<{ assetId: string; frameId: string; replaced: number; points: number }> = []
function adaptedGraph(): typeof graph {
  const frameOfAsset = new Map(graph.coordinateFrames.map((f) => [f.assetId, f]))
  const replace = new Map<string, number[][]>()
  for (const [assetId, poly] of Object.entries(maps.silhouettes)) {
    const f = frameOfAsset.get(assetId)
    if (f && poly && poly.length >= 3) replace.set(f.id, poly)
  }
  const kept = graph.observations.filter((o) => !(o.kind === 'SILHOUETTE' && replace.has(o.frameId as string)))
  const added = [...replace.entries()].map(([frameId, poly]) => {
    const f = graph.coordinateFrames.find((x) => x.id === frameId)!
    const orig = graph.observations.find((o) => o.kind === 'SILHOUETTE' && o.frameId === frameId)
    injected.push({ assetId: f.assetId, frameId, replaced: graph.observations.filter((o) => o.kind === 'SILHOUETTE' && o.frameId === frameId).length, points: poly.length })
    return {
      ...(orig ?? {}),
      id: `obs-silhouette-iu03-fge-${createHash('sha256').update(frameId).digest('hex').slice(0, 10)}`,
      kind: 'SILHOUETTE',
      frameId,
      assetId: f.assetId,
      confidence: 0.8,
      alternatives: [],
      depthLayer: 'UNKNOWN',
      semanticHints: ['building'],
      pixelGeometry: { type: 'POLYGON', points: poly.map(([x, y]) => ({ x, y })) },
      normGeometry: { type: 'POLYGON', points: poly.map(([x, y]) => ({ x: Math.round((x / f.size.width) * 1e6) / 1e6, y: Math.round((y / f.size.height) * 1e6) / 1e6 })) },
      provenance: { extractor: 'RESEARCH_IU03', name: 'iu03.facade-geometry-evidence', detail: 'building mask outline cut at the OBSERVED ground row (research adapter, not production)' },
      uncertainty: { positionPx: 3, angleDeg: 2, reason: 'segmentation boundary: median 2.7 px on synthetic renders' },
    }
  })
  return { ...graph, observations: [...kept, ...added] }
}

const identity = identityOf(pkg, [archonAdapter, genericProjectPageAdapter])
function solve(g: typeof graph, rs: Map<string, Raster | undefined>) {
  const r = reconstructV2({
    modelId: identity.modelId,
    label: identity.label,
    slug: identity.slug,
    sourcePackageId: pkg.id,
    sourcePackageHash: pkg.contentHash,
    graph: g as never,
    metrics,
    raster: (frame: { variantByteHash: string }) => rs.get(frame.variantByteHash),
    publishedAreas: pkg.publishedFacts,
    publishedRooms: pkg.publishedRooms,
  })
  const fa = (r as unknown as { facadeAlignment: { views: Array<Record<string, unknown>>; readings: Array<Record<string, unknown>>; rejected: unknown[] } }).facadeAlignment
  const elevations = (r.viewAudit as unknown as Array<Record<string, unknown>>).filter((v) => v.document === 'ELEVATION')
  return {
    modelSha256: createHash('sha256').update(serializeModel(r.model)).digest('hex'),
    elevationViews: elevations.map((v) => ({ frameId: v.frameId, assetId: v.assetId, use: v.use, side: v.side, mpp: v.mpp, why: String(v.why ?? '').slice(0, 300) })),
    facadeViews: fa.views.map((v) => ({ frameId: v.frameId, facade: v.facade, registration: v.registration, heights: v.heights, readings: v.readings, matched: v.matched, verdict: v.verdict, projection: v.projection })),
    readings: fa.readings.map((x) => ({ facade: x.facade, frameId: x.frameId, storeyIndex: x.storeyIndex, from: x.from, to: x.to, sillY: x.sillY, headY: x.headY, kind: x.kind, widthM: x.widthM, matched: x.matched ?? x.planOpeningId ?? null })),
    rejected: fa.rejected.length,
    openings: r.building.openings.map((o) => ({ facade: o.facade, storeyIndex: o.storeyIndex, interval: o.interval, sillY: o.sillY, headY: o.headY })),
  }
}
const adapted = adaptedGraph()
const results: Record<string, unknown> = {}
const seconds: Record<string, number> = {}
for (const [name, g, rs] of [
  ['RAW', graph, rasters.raw],
  ['CLEAN', graph, rasters.clean],
  ['ANCHORED', graph, rasters.anchored],
  ['RAW_FGE', adapted, rasters.raw],
  ['ANCHORED_FGE', adapted, rasters.anchored],
] as const) {
  const t = Date.now()
  results[name] = solve(g, rs)
  seconds[name] = (Date.now() - t) / 1000
}
writeFileSync(out, JSON.stringify({ house, injected, results, seconds }, null, 1) + '\n')
console.log(JSON.stringify({ house, injected: injected.length, ...Object.fromEntries(Object.entries(results).map(([k, v]) => [k, { readings: (v as { readings: unknown[] }).readings.length, views: (v as { facadeViews: unknown[] }).facadeViews.length }])) }))
