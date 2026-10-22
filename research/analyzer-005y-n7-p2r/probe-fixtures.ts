import { memoryByteCache } from '@buildapp/source-package'
import { BANDWALL, SLIVERTON, SLIVERTON_DIMENSIONED, THINWALL, HOLLOWAY, syntheticPublisher } from '@buildapp/synthetic-drawings'
import { runAnalysis } from '../../packages/analysis-service/src/index.js'
const houses = { sliverton: SLIVERTON, dimensioned: SLIVERTON_DIMENSIONED, thinwall: THINWALL, bandwall: BANDWALL, holloway: HOLLOWAY }
const publisher = syntheticPublisher({ projects: Object.entries(houses).map(([code, house]) => ({ code, title: code, house })) })
for (const code of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(houses)) {
  try {
    const { reconstruction: r, result } = await runAnalysis({ kind: 'URL', url: publisher.pageUrl(code) }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })
    console.log('==', code, result.preview.outcome, 'T', r.building.wallThicknessM, 'masses', r.building.masses.map((m) => `${m.id}[${m.x0},${m.x1}]${m.openSide ? ' open ' + m.openSide : ''}${m.wallThicknessM ? ' t ' + m.wallThicknessM : ''}`).join(' '), 'rings', result.model.wallRings.map((x) => x.id).join(','), 'walls', result.model.walls.length, 'band', (r.building.bandWalls ?? []).length, 'failures', JSON.stringify(result.preview.partial?.failure ?? null).slice(0, 160))
    for (const t of r.thinBodies) console.log('  ', t.massId, t.narrowM, t.decision.kind, '|', t.hypotheses.filter((h) => h.status === 'SUPPORTED').map((h) => h.kind).join(','), '|', t.chains.map((c) => `${c.valueCm}:${c.role}`).join(' '), '|', JSON.stringify(t.profile?.bands), t.profile?.solidShare, '|', t.firstBad, '|', t.decision.why.slice(0, 200))
  } catch (e) { console.log('==', code, 'ERROR', (e as Error).message.slice(0, 300)) }
}
