/** Council F: what a PARTIAL_3D_PREVIEW result carries that tells a P2R run from an older one (invented fixture). */
import { memoryByteCache } from '@buildapp/source-package'
import { SLIVERTON, syntheticPublisher } from '@buildapp/synthetic-drawings'
import { runAnalysis } from '../../../packages/analysis-service/src/index.js'
const publisher = syntheticPublisher({ projects: [{ code: 'sliverton-s02', title: 'Sliverton', house: SLIVERTON }] })
const { result, reconstruction } = await runAnalysis({ kind: 'URL', url: publisher.pageUrl('sliverton-s02') }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })
const r = result as any
console.log('outcome', r.preview.outcome, 'built', JSON.stringify(r.preview.built))
console.log('failure', JSON.stringify(r.preview.partial?.failure).slice(0, 220))
console.log('checkpoint', r.preview.partial?.checkpoint?.commands, r.preview.partial?.checkpoint?.modelSha256.slice(0, 12))
console.log('analyzer', JSON.stringify(r.analyzer), 'candidateHash', r.candidateHash.slice(0, 12), 'counts.masses', r.counts.masses, 'counts.openings', r.counts.openings)
console.log('unresolved', r.unresolved.length, 'thin-body gap:', r.unresolved.filter((u: any) => /narrower than its own two walls/.test(u.reason)).map((u: any) => u.what))
console.log('thinBodies', reconstruction.thinBodies.map((t: any) => `${t.massId} ${t.decision.kind} predicted ${t.predictedOverlapM2}`))
