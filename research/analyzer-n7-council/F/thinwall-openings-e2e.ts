/** Council F refutation of D-3 end to end: THINWALL (invented) with windows on the 0.15 m-walled wing's long side. */
import { memoryByteCache } from '@buildapp/source-package'
import { THINWALL, syntheticPublisher } from '@buildapp/synthetic-drawings'
import { runAnalysis } from '../../../packages/analysis-service/src/index.js'
const n = Number(process.argv.find((a) => a.startsWith('--n='))?.slice(4) ?? 2)
const openings = Array.from({ length: n }, (_, k) => ({ side: 'RIGHT' as const, kind: 'WINDOW' as const, at: 0.4 + k * (5.2 / n), width: Math.min(1.0, 5.2 / n - 0.3), height: 1.2, sill: 0.9, storey: 0 }))
const house = { ...THINWALL, name: 'Thinwall-win', wings: [{ ...THINWALL.wings![0], openings }] }
const publisher = syntheticPublisher({ projects: [{ code: 'tw-win', title: 'Thinwall win', house }] })
try {
  const { result, reconstruction } = await runAnalysis({ kind: 'URL', url: publisher.pageUrl('tw-win') }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })
  const r = result as any
  console.log(`n=${n}`, 'outcome', r.preview.outcome, 'thin', reconstruction.thinBodies.map((t: any) => `${t.massId} ${t.decision.kind} t=${t.decision.wallThicknessM}`))
  console.log('failures', JSON.stringify((r.preview.partial?.failures ?? []).map((f: any) => `${f.commandIndex} ${f.type} ${f.id} ${f.codes}`)))
  console.log('model openings on wing', r.model.openings.filter((o: any) => String(o.wallId).startsWith('ring-attached-0')).length, 'windows', r.model.windows?.length)
  console.log('unresolved mentioning attached-0 openings', r.unresolved.filter((u: any) => /attached-0|east/i.test(u.what)).map((u: any) => u.what).slice(0, 5))
} catch (e) {
  console.log(`n=${n} REFUSED`, (e as any).code ?? '', String((e as Error).message).slice(0, 300))
}
try {
  const { result, reconstruction } = await runAnalysis({ kind: 'URL', url: publisher.pageUrl('tw-win') }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })
  console.log('masses', (reconstruction as any).building.masses.map((m: any) => `${m.id} ${m.x0}..${m.x1} x ${m.z0}..${m.z1}`))
  for (const t of reconstruction.thinBodies as any[]) console.log('decision', t.decision.why, '| bands', JSON.stringify(t.profile?.bands), '| hyps', t.hypotheses.map((h: any) => `${h.kind}:${h.status}`).join(' '))
  console.log('counts.openings', (result as any).counts.openings)
} catch {}
