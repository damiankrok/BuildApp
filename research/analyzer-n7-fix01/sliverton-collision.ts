/** N7-FIX-01 research: the ring-collision diagnostic on SLIVERTON (a printed width contradicting the drawing). */
import { memoryByteCache } from '@buildapp/source-package'
import { SLIVERTON, syntheticPublisher } from '@buildapp/synthetic-drawings'
import { runAnalysis } from '../../packages/analysis-service/src/index.js'
const publisher = syntheticPublisher({ projects: [{ code: 'sl', title: 'Sliverton', house: SLIVERTON }] })
const { result } = await runAnalysis({ kind: 'URL', url: publisher.pageUrl('sl') }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })
const r = result as any
console.log('outcome', r.preview.outcome)
console.log(JSON.stringify(r.preview.partial?.ringCollisions, null, 1))
