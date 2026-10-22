/**
 * Council A (research only): arganiach loses its attic (one 7.94 m level). Is the copy choice the cause? Re-run the
 * production reconstructV2 with `frameFilter` hiding one attic copy at a time and report levels / storey registration.
 */
import { reconstructV2 } from '@buildapp/reconstruction'
import { serializeModel } from '@buildapp/model'
import { createHash } from 'node:crypto'
import { archonAdapter, genericProjectPageAdapter } from '@buildapp/source-package'
import { identityOf } from '../../../packages/analysis-service/src/identity.js'
import { loadHouse } from './corpus.js'
const h = process.argv[2] ?? 'arganiach'
const { pkg, graph, metrics, rasters } = await loadHouse(h)
const identity = identityOf(pkg, [archonAdapter, genericProjectPageAdapter])
const attic = graph.coordinateFrames.filter((f: any) => f.roles.document === 'FLOOR_PLAN' && f.roles.storey === (process.argv[3] ?? 'ATTIC'))
const variants: Array<[string, (f: any) => boolean]> = [['as is', () => true]]
for (const f of attic) variants.push([`hide ${f.roles.annotation} ${f.size.width}`, (x: any) => x.id !== f.id])
for (const [label, keep] of variants) {
  const r = reconstructV2({ modelId: identity.modelId, label: identity.label, slug: identity.slug, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph, metrics, raster: (f: { variantByteHash: string }) => rasters.get(f.variantByteHash), publishedAreas: pkg.publishedFacts, publishedRooms: pkg.publishedRooms, frameFilter: keep } as never)
  const levels = (r.model as any).levels.map((l: any) => `${l.elevation}+${l.height}`).join(' ')
  const s = (r.planDiagnostics.storeys ?? [])[0]
  const read = r.planDiagnostics.plans.map((p: any) => `${p.storey}/${p.annotation}/${p.sizePx.width}`).join(',')
  const hash = createHash('sha256').update(serializeModel(r.model)).digest('hex').slice(0, 8)
  console.log(`${label.padEnd(26)} levels=[${levels}] walls=${(r.model as any).walls.length} read=${read} storey1=${s ? `${s.decision} k=${s.chosen?.scale} basis=${s.scaleBasis?.basis}` : '-'} hash=${hash}`)
}
