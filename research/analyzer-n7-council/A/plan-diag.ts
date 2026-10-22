/** Council A (research only): which plan frame each storey was read from, and how the upper storeys registered. */
import { reconstructV2 } from '@buildapp/reconstruction'
import { archonAdapter, genericProjectPageAdapter } from '@buildapp/source-package'
import { identityOf } from '../../../packages/analysis-service/src/identity.js'
import { loadHouse } from './corpus.js'
const h = process.argv[2]
const { pkg, graph, metrics, rasters } = await loadHouse(h)
const identity = identityOf(pkg, [archonAdapter, genericProjectPageAdapter])
const t0 = Date.now()
const r = reconstructV2({ modelId: identity.modelId, label: identity.label, slug: identity.slug, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph, metrics, raster: (f: { variantByteHash: string }) => rasters.get(f.variantByteHash), publishedAreas: pkg.publishedFacts, publishedRooms: pkg.publishedRooms } as never)
const d = r.planDiagnostics
console.log(`${h}: planFrames=${d.planFrames} selected=${d.selectedPlanFrameId} (${Date.now() - t0} ms)`)
for (const p of d.plans) console.log(`  read ${p.storey} ${p.annotation} ${p.sizePx.width}x${p.sizePx.height} scale=${JSON.stringify(p.scale)} frame=${p.frameId.slice(-24)}`)
for (const s of d.skipped) console.log(`  skipped ${s.frameId.slice(-24)} ${s.why}`)
for (const s of d.storeys ?? []) console.log(`  storey ${s.storeyIndex} ${s.frameId.slice(-24)} ${s.decision} chosen=${JSON.stringify(s.chosen)} basis=${JSON.stringify(s.scaleBasis)} printed=${JSON.stringify(s.printedScale)} held=${JSON.stringify(s.held)} why=${s.why.slice(0, 300)}`)
console.log('  registrations.plans', JSON.stringify(r.registrations.plans))
console.log('  masses', JSON.stringify(r.layout.masses.map((m: any) => ({ id: m.id, storeys: m.storeyIds ?? m.storeys, bounds: m.ring ? undefined : undefined }))).slice(0, 600))
console.log('  storeys', JSON.stringify(r.building.storeys ?? r.building.levels ?? null).slice(0, 600))
