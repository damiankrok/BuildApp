/** N7-COUNCIL-FIX-03 (research only): the base plan's boundary record (005C) for one invented case, as JSON. */
import { memoryByteCache } from '@buildapp/source-package'
import { syntheticPublisher } from '@buildapp/synthetic-drawings'
import { runAnalysis } from '../../packages/analysis-service/src/index.js'
import { FIX03_CASES } from './cases.js'
const code = process.argv[process.argv.indexOf('--only') + 1]
const publisher = syntheticPublisher({ projects: [{ code, title: code, house: FIX03_CASES[code] }] })
const { reconstruction: r } = await runAnalysis({ kind: 'URL', url: publisher.pageUrl(code) }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })
const p = r.planDiagnostics.plans.find((x) => x.frameId === r.planDiagnostics.selectedPlanFrameId)
console.log(JSON.stringify({ scale: p?.scale, linesX: p?.linesX, linesY: p?.linesY, boundary: { ...p?.boundary, gapEvidence: (p?.boundary as { gapEvidence?: unknown[] } | undefined)?.gapEvidence?.slice(0, 40) } }, null, 1))
