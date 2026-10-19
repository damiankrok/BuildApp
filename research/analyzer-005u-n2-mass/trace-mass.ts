/**
 * trace-mass.ts — 005U-N2: re-run the v2 solver on a sealed development row and dump, as numbers and ids only, how
 * the plan became bodies: the layout's regions and mass hypotheses, the storeys, the v2 masses, recesses, terraces,
 * attached roofs and the layout gate's reasons (RESEARCH ONLY; never imported by production; output outside the repo).
 *
 *   npx vite-node research/analyzer-005u-n2-mass/trace-mass.ts -- --run <dir> --package <pkg> --cache <dir> --out <dir>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join, resolve } from 'node:path'
import { SourcePackageSchema, archonAdapter, decodeImage, fileByteCache, genericProjectPageAdapter, selectedVariant } from '@buildapp/source-package'
import { reconstructV2 } from '@buildapp/reconstruction'
import { identityOf } from '../../packages/analysis-service/src/identity.js'

const REPO = resolve(import.meta.dirname, '../..')
const value = (n: string): string => {
  const i = process.argv.indexOf(`--${n}`)
  if (i < 0) throw new Error(`--${n} is required`)
  return process.argv[i + 1]
}
const out = resolve(value('out'))
if (out === REPO || out.startsWith(`${REPO}/`)) throw new Error('REFUSED: outputs never go inside the repository')
mkdirSync(out, { recursive: true })
const run = resolve(value('run'))
const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(value('package'), 'utf8')))
const graph = JSON.parse(gunzipSync(readFileSync(join(run, 'observation-graph.json.gz'))).toString('utf8'))
const metrics = JSON.parse(gunzipSync(readFileSync(join(run, 'metric-evidence.json.gz'))).toString('utf8'))
const cache = fileByteCache(value('cache'))
const rasters = new Map<string, ReturnType<typeof decodeImage> | undefined>()
for (const asset of pkg.assets) {
  const v = selectedVariant(asset)
  const got = await cache.get(v.url)
  if (got) rasters.set(v.byteHash, decodeImage(got.bytes))
}
const id = identityOf(pkg, [archonAdapter, genericProjectPageAdapter])
const debug: string[] = []
const r = reconstructV2({ debug: (l) => debug.push(l), modelId: id.modelId, label: id.label, slug: id.slug, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph, metrics, raster: (f: { variantByteHash: string }) => rasters.get(f.variantByteHash), publishedAreas: pkg.publishedFacts, publishedRooms: pkg.publishedRooms })
const strip = (o: unknown): unknown => JSON.parse(JSON.stringify(o, (k, v) => (k === 'raster' || k === 'data' || k === 'mask' ? undefined : v)))
writeFileSync(join(out, 'layout.json'), JSON.stringify(strip(r.layout), null, 1))
writeFileSync(join(out, 'building.json'), JSON.stringify(strip({ masses: r.building.masses, recesses: r.building.recesses, returns: r.building.returns, terraces: r.building.terraces, attachedRoofs: r.building.attachedRoofs, mainRoof: r.building.mainRoof, levels: r.building.levels }), null, 1))
writeFileSync(join(out, 'plan-diagnostics.json'), JSON.stringify(strip(r.planDiagnostics), null, 1))
writeFileSync(join(out, 'debug.txt'), debug.join('\n'))
console.log('ok', r.building.masses.length)
