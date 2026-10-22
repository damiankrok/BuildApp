/**
 * Council A (research only): mutate the sealed graph's frame ROLES in memory and re-run the production reconstructV2.
 * Mutations: swap FRONT<->REAR labels; relabel the smaller ATTIC copies as UPPER (the piętro mismatch); drop the
 * DIMENSIONED role of the chosen base copy (simulate an adapter that misses the dimensioned copy).
 * Reports, per mutation: model hash, levels, walls, view verdicts, and whether ANY audit flag names the mutation.
 */
import { reconstructV2 } from '@buildapp/reconstruction'
import { serializeModel } from '@buildapp/model'
import { createHash } from 'node:crypto'
import { archonAdapter, genericProjectPageAdapter } from '@buildapp/source-package'
import { identityOf } from '../../../packages/analysis-service/src/identity.js'
import { loadHouse } from './corpus.js'
const h = process.argv[2]
const which = (process.argv[3] ?? 'none,swapFR,atticAsUpper,undimension').split(',')
const { pkg, graph, metrics, rasters } = await loadHouse(h)
const identity = identityOf(pkg, [archonAdapter, genericProjectPageAdapter])
const clone = () => ({ ...graph, coordinateFrames: graph.coordinateFrames.map((f: any) => ({ ...f, roles: { ...f.roles } })) })
const mutations: Record<string, (g: any) => void> = {
  none: () => {},
  swapFR: (g) => { for (const f of g.coordinateFrames) if (f.roles.view === 'FRONT') f.roles.view = 'REAR'; else if (f.roles.view === 'REAR') f.roles.view = 'FRONT' },
  atticAsUpper: (g) => { for (const f of g.coordinateFrames) if (f.roles.document === 'FLOOR_PLAN' && f.roles.storey === 'ATTIC' && f.size.width < 853) f.roles.storey = 'UPPER' },
  undimension: (g) => { for (const f of g.coordinateFrames) if (f.roles.document === 'FLOOR_PLAN' && f.roles.annotation === 'DIMENSIONED' && f.size.width === 853) f.roles.annotation = 'UNKNOWN' },
  sidesAsFront: (g) => { for (const f of g.coordinateFrames) if (f.roles.view === 'SIDE_UNSPECIFIED') { f.roles.view = 'FRONT'; break } },
}
for (const name of which) {
  const g = clone()
  mutations[name](g)
  const t0 = Date.now()
  try {
    const r: any = reconstructV2({ modelId: identity.modelId, label: identity.label, slug: identity.slug, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph: g, metrics, raster: (f: { variantByteHash: string }) => rasters.get(f.variantByteHash), publishedAreas: pkg.publishedFacts, publishedRooms: pkg.publishedRooms } as never)
    const hash = createHash('sha256').update(serializeModel(r.model)).digest('hex').slice(0, 8)
    const levels = r.model.levels.map((l: any) => `${l.elevation}+${l.height}`).join(' ')
    const views = r.viewAudit.filter((v: any) => v.document === 'ELEVATION').map((v: any) => `${v.labelledView}->${v.side ?? '-'}:${v.use}`).join(' ')
    const fa = (r.facadeAlignment?.views ?? []).map((v: any) => `${v.facade}:${v.verdict}(${v.matched}/${v.readings})`).join(' ')
    const cv = (r.crossViewResiduals?.views ?? []).map((v: any) => `${v.side}:${v.verdict}(${v.withinTolerance}/${v.checks})`).join(' ')
    const read = r.planDiagnostics.plans.map((p: any) => `${p.storey}/${p.annotation.slice(0, 4)}/${p.sizePx.width}`).join(',')
    const storeys = (r.planDiagnostics.storeys ?? []).map((s: any) => `${s.storeyIndex}:${s.decision}`).join(',')
    const prev = r.partialPreview ? `partial(${r.partialPreview.skipped?.length ?? 0} skipped)` : 'full'
    console.log(`${h} ${name.padEnd(13)} hash=${hash} levels=[${levels}] walls=${r.model.walls.length} openings=${r.model.openings.length} ${prev} read=${read} storeys=${storeys} (${Date.now() - t0}ms)\n    views: ${views}\n    facadeAlignment: ${fa}\n    crossView: ${cv}`)
  } catch (e) {
    console.log(`${h} ${name} THREW ${(e as Error).message.slice(0, 300)}`)
  }
}
