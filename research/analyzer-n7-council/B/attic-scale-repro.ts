/**
 * N7-COUNCIL B (research only, offline): arganiach's attic plan carries a coordinate registration fitted on two
 * anchors (a READ "71" on 79 px and a CHAIN_CORRECTED "42" on 47 px, residual 0) — 0.0090 m/px on a sheet drawn like the
 * ground plan's 0.0269. The layout takes it as "the scale both plans print on their own chains" (PRINTED_SCALE), the
 * storey lands at one third of its size, NO_SUPPORT, and the house loses its attic. This runs the production solver
 * twice — as sealed, and with that one registration withheld — and prints the storeys each one builds.
 */
import { existsSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join } from 'node:path'
import { SourcePackageSchema, archonAdapter, decodeImage, fileByteCache, genericProjectPageAdapter, selectedVariant } from '@buildapp/source-package'
import { reconstructV2 } from '@buildapp/reconstruction'
import { identityOf } from '../../../packages/analysis-service/src/identity.js'

const run = '/home/user/work005yn6/prod-r4/an/arganiach'
const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(join(run, 'source-package.json'), 'utf8')))
const load = (name: string): any => JSON.parse(existsSync(join(run, `${name}.json`)) ? readFileSync(join(run, `${name}.json`), 'utf8') : gunzipSync(readFileSync(join(run, `${name}.json.gz`))).toString('utf8'))
const cache = fileByteCache('/home/user/work005yn3/analogs/cache')
const rasters = new Map<string, ReturnType<typeof decodeImage> | undefined>()
for (const asset of pkg.assets) {
  const variant = selectedVariant(asset)
  const got = await cache.get(variant.url)
  if (got) rasters.set(variant.byteHash, decodeImage(got.bytes))
}
const identity = identityOf(pkg, [archonAdapter, genericProjectPageAdapter])
const once = (metrics: any, label: string): void => {
  const r = reconstructV2({ modelId: identity.modelId, label: identity.label, slug: identity.slug, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph: load('observation-graph'), metrics, raster: (frame: { variantByteHash: string }) => rasters.get(frame.variantByteHash), publishedAreas: pkg.publishedFacts, publishedRooms: pkg.publishedRooms })
  const st = r.planDiagnostics.storeys?.map((s) => `storey ${s.storeyIndex}: ${s.decision} scale ${s.chosen?.scale} basis ${s.scaleBasis?.basis}`).join('; ')
  console.log(`${label}: levels ${r.building.levels.length}, masses ${r.building.masses.map((m) => `${m.id}[${m.storeys.join(',')}]`).join(' ')}, plans ${r.registrations.plans.map((p) => `${p.storeyIndex}@${p.mppX}`).join(' ')}, walls ${r.model.walls.length}, slabs ${r.model.slabs.length}, openings ${r.model.openings.length}; ${st}`)
}
const sealed = load('metric-evidence')
once(sealed, 'AS SEALED')
const withheld = { ...sealed, coordinateRegistrations: sealed.coordinateRegistrations.filter((r: any) => !String(r.frameId).includes('f7e5dd139a')) }
once(withheld, 'ATTIC REGISTRATION WITHHELD')
