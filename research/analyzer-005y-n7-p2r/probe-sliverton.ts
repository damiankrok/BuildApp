import { memoryByteCache } from '@buildapp/source-package'
import { HOLLOWAY, SLIVERTON, syntheticPublisher } from '@buildapp/synthetic-drawings'
import { runAnalysis } from '../../packages/analysis-service/src/index.js'
const publisher = syntheticPublisher({ projects: [{ code: 's', title: 'Sliverton', house: SLIVERTON }, { code: 'h', title: 'Holloway', house: HOLLOWAY }] })
for (const code of process.argv.slice(2).length ? process.argv.slice(2) : ['s', 'h']) {
  const { reconstruction: r, result } = await runAnalysis({ kind: 'URL', url: publisher.pageUrl(code) }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })
  console.log('==', code, result.preview.outcome, 'T', r.building.wallThicknessM, 'rings', result.model.wallRings.map((x) => x.id).join(','), 'walls', result.model.walls.length)
  for (const t of r.thinBodies) console.log(JSON.stringify({ ...t, profile: { ...t.profile, bands: t.profile?.bands } }, null, 1))
}
