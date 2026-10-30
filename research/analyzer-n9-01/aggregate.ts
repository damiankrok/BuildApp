/**
 * N9-01 (research only, offline, read-only): the 8-house table from two production regressions on the same sealed
 * inputs — the base commit (no assessment) and this one — and the proof that the models did not change.
 *   npx vite-node research/analyzer-n9-01/aggregate.ts -- --base <dir> --head <dir> --out <file.json>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const arg = (n: string): string => process.argv[process.argv.indexOf(`--${n}`) + 1]
const HOUSES = ['a01', 'gozd', 'marcowki', 'ciesz', 'rary', 'trytomach', 'arganiach', 'sasankach3']
const read = (dir: string, h: string): any => JSON.parse(readFileSync(join(dir, h, 'result-summary.json'), 'utf8'))
const rows = HOUSES.map((h) => {
  const b = read(arg('base'), h)
  const r = read(arg('head'), h)
  const a = r.assessment
  const hashes = ['candidateHash', 'modelHash', 'sceneContentHash', 'sceneSha256', 'metricEvidenceHash'] as const
  return {
    house: h,
    unchanged: Object.fromEntries(hashes.map((k) => [k, b[k] === r[k]])),
    modelHash: r.modelHash,
    service: { base: b.analyzer.service, head: r.analyzer.service },
    before: { verdict: b.preview?.completeness?.verdict ?? 'NOT_ASSESSED', warnings: b.warningDetails.filter((w: any) => w.severity === 'LIMITING').map((w: any) => w.code) },
    technical: { status: a.technicalValidity.status, errors: a.technicalValidity.errors, warnings: a.technicalValidity.warnings, byCheck: Object.fromEntries(a.technicalValidity.checks.map((c: any) => [c.check, `${c.errors}E/${c.warnings}W`])), firstErrors: a.technicalValidity.checks.flatMap((c: any) => c.findings.filter((f: any) => f.severity === 'ERROR').slice(0, 3).map((f: any) => `${c.check}: ${f.code} ${f.objectId ?? ''}`)) },
    completeness: a.decompositionCompleteness.verdict,
    sourceFidelity: { status: a.sourceFidelity.status, relations: Object.fromEntries(a.sourceFidelity.relations.map((x: any) => [x.id, { status: x.status, counts: x.counts, items: x.items.map((i: any) => ({ status: i.status, code: i.code, objects: i.objects.slice(0, 8), source: i.source?.frameId ?? null, measured: i.measured, why: i.why })) }])), conflicts: a.sourceFidelity.conflicts },
    unchecked: { counts: a.sourceUnchecked.counts, items: a.sourceUnchecked.items.filter((i: any) => i.kind !== 'PERSPECTIVE').map((i: any) => ({ kind: i.kind, frameId: i.frameId, extent: i.extent, axes: i.axes, what: i.what, why: i.why, couldCheck: i.couldCheck })) },
    summary: a.summary,
  }
})
writeFileSync(arg('out'), JSON.stringify({ generatedFrom: 'two production runAnalysis regressions on the sealed 8-house inputs (pkg + graph)', rows }, null, 1))
for (const r of rows) console.log(r.house, JSON.stringify(r.unchanged), r.before.verdict, '→', r.technical.status, r.completeness, r.sourceFidelity.status, Object.values(r.sourceFidelity.relations).map((x: any) => x.status).join('/'), 'unchecked', r.unchecked.counts.total)
