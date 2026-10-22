/**
 * N7-FIX-01 research: THINWALL (invented) with windows in its 0.15 m far wall, run end to end through the production
 * service; writes the model, the program and a summary OUTSIDE the repository. Synthetic only — no publisher image.
 *   npx vite-node research/analyzer-n7-fix01/thinwall-case.ts -- --case n1|n2|n4|wide2|wd --out <dir>
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { memoryByteCache } from '@buildapp/source-package'
import { THINWALL, syntheticPublisher } from '@buildapp/synthetic-drawings'
import { serializeModel } from '@buildapp/model'
import { runAnalysis } from '../../packages/analysis-service/src/index.js'

const arg = (n: string): string => process.argv[process.argv.indexOf(`--${n}`) + 1]
const kase = arg('case')
const out = resolve(arg('out'))
if (out.startsWith(resolve(import.meta.dirname, '../..'))) throw new Error('outputs never go inside the repository')
mkdirSync(out, { recursive: true })
const win = (at: number, width: number) => ({ side: 'RIGHT' as const, kind: 'WINDOW' as const, at, width, height: 1.2, sill: 0.9, storey: 0 })
const n = (k: number) => Array.from({ length: k }, (_, i) => win(0.4 + i * (5.2 / k), Math.min(1.0, 5.2 / k - 0.3)))
const openings = { n1: n(1), n2: n(2), n4: n(4), wide2: [win(0.6, 1.5), win(3.6, 1.5)], wd: [win(0.6, 1.0), { side: 'RIGHT' as const, kind: 'DOOR' as const, at: 3.4, width: 1.0, height: 2.1, sill: 0, storey: 0 }] }[kase]
if (!openings) throw new Error(`unknown case ${kase}`)
const house = { ...THINWALL, name: `Thinwall ${kase}`, wings: [{ ...THINWALL.wings![0], openings }] }
const publisher = syntheticPublisher({ projects: [{ code: `tw-${kase}`, title: `Thinwall ${kase}`, house }] })
try {
  const { result, reconstruction } = await runAnalysis({ kind: 'URL', url: publisher.pageUrl(`tw-${kase}`) }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })
  const r = result as any
  writeFileSync(join(out, 'model.json'), serializeModel(r.model))
  writeFileSync(join(out, 'program.json'), JSON.stringify(r.candidate.program, null, 1))
  const t = (reconstruction as any).thinBodies?.[0]
  const summary = {
    case: kase,
    solver: r.analyzer?.solver,
    outcome: r.preview.outcome,
    modelSha256: r.modelSha256,
    failures: (r.preview.partial?.failures ?? []).map((f: any) => `${f.commandIndex} ${f.type} ${f.id} ${f.codes.join(',')}`),
    thin: t ? { decision: t.decision.kind, wallThicknessM: t.decision.wallThicknessM ?? null, hypotheses: t.hypotheses.map((h: any) => `${h.kind}:${h.status}`), farEdgeInk: t.profile?.farEdgeInk, farWall: t.profile?.farWall ? { holds: t.profile.farWall.holds, pieceShare: t.profile.farWall.pieceShare, gaps: t.profile.farWall.gaps.map((g: any) => `${g.widthM}m drawn ${g.drawnAcross}`), why: t.profile.farWall.why } : null } : null,
    zoneBodies: (reconstruction as any).zoneBodies?.length ?? 'n/a',
    wingRings: r.model.wallRings.filter((x: any) => x.id.startsWith('ring-attached-0')).map((x: any) => x.id),
    wingWalls: r.model.walls.filter((w: any) => w.id.startsWith('ring-attached-0')).map((w: any) => `${w.id} t=${w.thickness}`),
    wingOpenings: r.model.openings.filter((o: any) => String(o.wallId).startsWith('ring-attached-0')).map((o: any) => `${o.id} ${o.kind} w=${o.width}`),
    wingUnits: [...r.model.windows, ...r.model.doors].filter((u: any) => r.model.openings.some((o: any) => o.id === u.openingId && String(o.wallId).startsWith('ring-attached-0'))).map((u: any) => u.id),
    unresolvedOnWing: r.unresolved.filter((u: any) => /attached-0|zone on the east/.test(u.what)).map((u: any) => u.what),
    commands: r.candidate.program.length,
  }
  writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 1))
  console.log(JSON.stringify(summary))
} catch (e) {
  console.log(JSON.stringify({ case: kase, refused: (e as any).code ?? '', message: String((e as Error).message).slice(0, 300) }))
}
