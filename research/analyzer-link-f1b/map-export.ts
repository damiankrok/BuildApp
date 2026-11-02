/**
 * LINK-F1B (research only): the plan map of a sealed run, as production builds it, for overlays and control points.
 * Reconstructs the run (reconstructV2 on its sealed evidence and the cached rasters) and writes, per storey plan frame:
 * the frame and the hash of the image it reads, the map's inverse control points — every body face (a chain-ladder line),
 * a point between two faces and one beyond the outer faces, each world → pixel → world — and the model's walls and
 * openings of that storey in pixels through the same inverse map. No image is read back or written.
 *   npx vite-node research/analyzer-link-f1b/map-export.ts -- --run <dir> --cache <dir> --out <file.json>
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join, resolve } from 'node:path'
import { SourcePackageSchema, archonAdapter, decodeImage, fileByteCache, genericProjectPageAdapter, selectedVariant } from '@buildapp/source-package'
import { reconstructV2 } from '@buildapp/reconstruction'
import { identityOf } from '../../packages/analysis-service/src/identity.js'

const value = (name: string): string => process.argv[process.argv.indexOf(`--${name}`) + 1]
const run = resolve(value('run'))
const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(join(run, 'source-package.json'), 'utf8')))
const load = (name: string): unknown => JSON.parse(existsSync(join(run, `${name}.json`)) ? readFileSync(join(run, `${name}.json`), 'utf8') : gunzipSync(readFileSync(join(run, `${name}.json.gz`))).toString('utf8'))
const cache = fileByteCache(value('cache'))
const rasters = new Map<string, ReturnType<typeof decodeImage> | undefined>()
for (const asset of pkg.assets) {
  const variant = selectedVariant(asset)
  const got = await cache.get(variant.url)
  if (got) try { rasters.set(variant.byteHash, decodeImage(got.bytes)) } catch { rasters.set(variant.byteHash, undefined) }
}
const graph = load('observation-graph') as { coordinateFrames: Array<{ id: string; variantByteHash: string; assetId: string }> }
const identity = identityOf(pkg, [archonAdapter, genericProjectPageAdapter])
const r = reconstructV2({ modelId: identity.modelId, label: identity.label, slug: identity.slug, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph: graph as never, metrics: load('metric-evidence') as never, raster: (frame: { variantByteHash: string }) => rasters.get(frame.variantByteHash), publishedAreas: pkg.publishedFacts, publishedRooms: pkg.publishedRooms } as never)
type M = { id: string; x0: number; z0: number; x1: number; z1: number; storeys: number[] }
const masses = (r as unknown as { building: { masses: M[] } }).building.masses
const model = (r as unknown as { model: { levels: Array<{ id: string; index: number }>; walls: Array<{ id: string; kind: string; levelId: string; start: { x: number; z: number }; end: { x: number; z: number }; thickness: number }>; openings: Array<{ id: string; kind: string; wallId: string; offset: number; width: number }> } }).model
const r6 = (v: number): number => Math.round(v * 1e6) / 1e6
const out = r.registrations.plans.map((p) => {
  const frame = graph.coordinateFrames.find((f) => f.id === p.frameId)
  const faces = { x: [...new Set(masses.flatMap((m) => [m.x0, m.x1]))].sort((a, b) => a - b), z: [...new Set(masses.flatMap((m) => [m.z0, m.z1]))].sort((a, b) => a - b) }
  const xs = [...faces.x, (faces.x[0] + faces.x[1]) / 2, faces.x[0] - 1, faces.x[faces.x.length - 1] + 1]
  const zs = [...faces.z, (faces.z[0] + faces.z[1]) / 2, faces.z[0] - 1, faces.z[faces.z.length - 1] + 1]
  const control = xs.flatMap((x) => zs.map((z) => {
    const px = p.toPixel(x, z)
    const back = p.toWorld(px.x, px.y)
    return { world: { x: r6(x), z: r6(z) }, px: { x: r6(px.x), y: r6(px.y) }, back: { x: r6(back.x), z: r6(back.z) }, errM: r6(Math.hypot(back.x - x, back.z - z)), kind: faces.x.includes(x) && faces.z.includes(z) ? 'FACE×FACE' : x < faces.x[0] || x > faces.x[faces.x.length - 1] || z < faces.z[0] || z > faces.z[faces.z.length - 1] ? 'BEYOND' : 'BETWEEN' }
  }))
  const level = model.levels.find((l) => l.index === p.storeyIndex)
  const walls = model.walls.filter((w) => w.levelId === level?.id)
  const wallsPx = walls.map((w) => ({ id: w.id, kind: w.kind, a: p.toPixel(w.start.x, w.start.z), b: p.toPixel(w.end.x, w.end.z), thicknessPx: r6(w.thickness / p.mppX) }))
  const openingsPx = model.openings.flatMap((o) => {
    const w = walls.find((x) => x.id === o.wallId)
    if (!w) return []
    const L = Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z) || 1
    const at = (s: number) => p.toPixel(w.start.x + ((w.end.x - w.start.x) * s) / L, w.start.z + ((w.end.z - w.start.z) * s) / L)
    return [{ id: o.id, kind: o.kind, a: at(o.offset), b: at(o.offset + o.width) }]
  })
  return { frameId: p.frameId, storeyIndex: p.storeyIndex, imageByteHash: frame?.variantByteHash, mppX: p.mppX, mppY: p.mppY, why: p.why, controlPoints: control, maxRoundTripErrM: Math.max(...control.map((c) => c.errM)), walls: wallsPx, openings: openingsPx }
})
writeFileSync(value('out'), `${JSON.stringify({ run: run.split('/').slice(-1)[0], modelHash: (r as unknown as { candidate: { modelHash: string } }).candidate.modelHash, plans: out }, null, 1)}\n`)
console.log(value('out'), out.map((p) => `${p.frameId.slice(-10)} s${p.storeyIndex} max round trip ${p.maxRoundTripErrM} m, ${p.walls.length} walls`).join('; '))
