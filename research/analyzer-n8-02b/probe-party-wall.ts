/**
 * N8-02B (research only, offline): one sealed run replayed through this checkout's solver, printing what the party
 * wall between two bodies is built from — the bodies, the doorways read between them, the facade openings on the
 * faces they share, every partition piece and the topology's decisions about it — so the first stage at which one drawn
 * wall becomes two can be named. Rasters come from the byte cache; nothing is written.
 *   npx vite-node research/analyzer-n8-02b/probe-party-wall.ts -- --run <dir> --cache <dir> [--debug]
 */
import { existsSync, readFileSync } from 'node:fs'
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
  if (!got) continue
  try { rasters.set(variant.byteHash, decodeImage(got.bytes)) } catch { rasters.set(variant.byteHash, undefined) }
}
const lines: string[] = []
const debug = (s: string): void => { lines.push(s) }
const identity = identityOf(pkg, [archonAdapter, genericProjectPageAdapter])
const r = reconstructV2({ modelId: identity.modelId, label: identity.label, slug: identity.slug, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph: load('observation-graph') as never, metrics: load('metric-evidence') as never, raster: (frame: { variantByteHash: string }) => rasters.get(frame.variantByteHash), publishedAreas: pkg.publishedFacts, publishedRooms: pkg.publishedRooms, debug } as never)
const b = r.building as unknown as Record<string, unknown> & { masses: Array<Record<string, unknown>>; interior: Array<{ storeyIndex: number; walls: unknown[]; doors: unknown[] }>; openings: Array<Record<string, unknown>>; sharedDoors: Array<Record<string, unknown>> }
console.log(JSON.stringify({
  wallThickness: (r as unknown as { wallThickness: unknown }).wallThickness,
  masses: b.masses.map((m) => ({ id: m.id, role: m.role, x0: m.x0, z0: m.z0, x1: m.x1, z1: m.z1, storeys: m.storeys, wallThicknessM: m.wallThicknessM, openSide: m.openSide, storeyRects: m.storeyRects })),
  partyWalls: (b as { partyWalls?: unknown }).partyWalls,
  partyRecords: (r as unknown as { partyWalls?: unknown }).partyWalls,
  sharedDoors: b.sharedDoors.map((o) => ({ id: o.id, massId: o.massId, otherMassId: o.otherMassId, facade: o.facade, storey: o.storeyIndex, interval: o.interval, why: o.why })),
  facadeOpeningsOnSharedFaces: b.openings.filter((o) => o.facade === 'EAST' || o.facade === 'WEST').map((o) => ({ id: o.id, massId: o.massId, facade: o.facade, storey: o.storeyIndex, interval: o.interval, family: o.family })),
  interior: b.interior.map((i) => ({ storey: i.storeyIndex, walls: i.walls, doors: i.doors, blocks: (i as unknown as { blocks: unknown[] }).blocks })),
  steps: r.steps.filter((s) => /interior|emission|openings|N7-P2R|shared|party/i.test(`${s.stage} ${s.what}`)).map((s) => `${s.stage} | ${s.what} | ${s.detail}`),
  debug: lines.filter((l) => /interior|topology|raw|run |party|shared|mass /.test(l)),
  unresolved: r.unresolved.map((u) => `${u.what}: ${u.reason}`),
}, null, 1))
