/**
 * N9-02A (research only, offline, read-only): every elevation of one sealed run, BEFORE (the solver's use of it, from
 * its view audit) and AFTER (the four-axis diagnostic registration of `assessment/elevation-axes.ts`), with the raw
 * readings behind both: extent, wall bands, apex, ground, datums. Optionally writes boards (source pixels: outside the
 * repository only).
 *   npx vite-node research/analyzer-n9-02a/axes-probe.ts -- --run <dir> --graph <graph.json> --cache <dir> [--boards <dir>]
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join } from 'node:path'
import { SourcePackageSchema, archonAdapter, decodeImage, fileByteCache, genericProjectPageAdapter, selectedVariant } from '@buildapp/source-package'
import { levelsFrom, reconstructV2 } from '@buildapp/reconstruction'
import type { Raster } from '@buildapp/source-cv'
import { identityOf } from '../../packages/analysis-service/src/identity.js'
import { encodePng } from '../../packages/analysis-service/src/diagnostics.js'
import { elevationAxes, solverClass } from '../../packages/analysis-service/src/assessment/elevation-axes.js'
import { terrainDatumOf } from '../../packages/analysis-service/src/assessment/elevation-inputs.js'

const arg = (n: string): string | undefined => (process.argv.includes(`--${n}`) ? process.argv[process.argv.indexOf(`--${n}`) + 1] : undefined)
const run = arg('run') as string
const load = (name: string): unknown => JSON.parse(existsSync(join(run, `${name}.json`)) ? readFileSync(join(run, `${name}.json`), 'utf8') : gunzipSync(readFileSync(join(run, `${name}.json.gz`))).toString('utf8'))
const pkg = SourcePackageSchema.parse(load('source-package'))
const graph = JSON.parse(readFileSync(arg('graph') as string, 'utf8'))
const metrics = load('metric-evidence') as any
const cache = fileByteCache(arg('cache') as string)
const rasters = new Map<string, Raster | undefined>()
for (const a of pkg.assets) {
  const v = selectedVariant(a)
  const got = await cache.get(v.url)
  if (!got) continue
  try {
    rasters.set(v.byteHash, decodeImage(got.bytes))
  } catch {
    rasters.set(v.byteHash, undefined)
  }
}
const raster = (f: { variantByteHash: string }): Raster | undefined => rasters.get(f.variantByteHash)
const identity = identityOf(pkg, [archonAdapter, genericProjectPageAdapter])
const r = reconstructV2({ modelId: identity.modelId, label: identity.label, slug: identity.slug, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph, metrics, raster, publishedAreas: pkg.publishedFacts, publishedRooms: pkg.publishedRooms })
const section = graph.coordinateFrames.find((f: any) => f.roles.projection === 'ORTHOGRAPHIC_SECTION')
const levels = levelsFrom(metrics, section?.id)
const terrainY = terrainDatumOf(metrics)
const byFacade = { FRONT: 0, REAR: 0, LEFT: 0, RIGHT: 0 }
const emitted = new Set(r.model.openings.map((o) => o.id))
for (const o of r.building.openings) if (emitted.has(o.id)) byFacade[o.facade === 'WEST' ? 'LEFT' : o.facade === 'EAST' ? 'RIGHT' : o.facade] += 1
const axes = elevationAxes({ frames: graph.coordinateFrames, observations: graph.observations, raster, world: r.world, ...(levels.topDatum !== undefined ? { ridgeY: levels.topDatum } : {}), ...(terrainY !== undefined ? { terrainY } : {}), viewAudit: r.viewAudit, solverRegistrations: r.registrations.elevations, openingsByFacade: byFacade })
const rows = axes.map((v) => ({ ...v, before: solverClass(v.solver.use, v.solver.openingHeights) }))
const boards = arg('boards')
if (boards) {
  mkdirSync(boards, { recursive: true })
  for (const v of axes) {
    const f = graph.coordinateFrames.find((x: any) => x.id === v.frameId)
    const src = f ? raster(f) : undefined
    if (!src) continue
    const b: Raster = { width: src.width, height: src.height, data: src.data.slice() }
    const put = (x: number, y: number, c: number[]) => { const xi = Math.round(x), yi = Math.round(y); if (xi < 0 || yi < 0 || xi >= b.width || yi >= b.height) return; const o = (yi * b.width + xi) * 4; b.data[o] = c[0]; b.data[o + 1] = c[1]; b.data[o + 2] = c[2]; b.data[o + 3] = 255 }
    const hline = (y: number, x0: number, x1: number, c: number[], t = 2) => { for (let x = x0; x <= x1; x++) for (let d = 0; d < t; d++) put(x, y + d, c) }
    const vline = (x: number, y0: number, y1: number, c: number[], t = 2) => { for (let y = y0; y <= y1; y++) for (let d = 0; d < t; d++) put(x + d, y, c) }
    if (v.extent) { hline(v.extent.y0, v.extent.x0, v.extent.x1, [255, 0, 0], 1); hline(v.extent.y1, v.extent.x0, v.extent.x1, [255, 0, 0], 1); vline(v.extent.x0, v.extent.y0, v.extent.y1, [255, 0, 0], 1); vline(v.extent.x1, v.extent.y0, v.extent.y1, [255, 0, 0], 1) }
    const bp = v.along.bandPx
    if (bp && v.extent) { vline(bp.x0, v.extent.y0, v.extent.y1, [0, 200, 0], 3); vline(bp.x1, v.extent.y0, v.extent.y1, [0, 200, 0], 3) }
    if (v.vertical.apexRow !== undefined && v.extent) hline(Math.round(v.vertical.apexRow), v.extent.x0, v.extent.x1, [0, 120, 255], 2)
    if (v.vertical.groundRow !== undefined && v.extent) hline(Math.round(v.vertical.groundRow) - 2, v.extent.x0, v.extent.x1, [255, 160, 0], 2)
    if (v.vertical.zeroRow !== undefined && v.extent) hline(Math.round(v.vertical.zeroRow), v.extent.x0, v.extent.x1, [200, 0, 200], 1)
    writeFileSync(join(boards, `${v.class}-${v.frameId.slice(-28)}.png`), encodePng(b))
  }
}
console.log(JSON.stringify({ ridgeY: levels.topDatum ?? null, terrainY: terrainY ?? null, world: r.world.walled, modelHash: r.candidate.modelHash, rows }, null, 1))
