/**
 * N9-02A (research only, offline, read-only): the 32-elevation table from the production regression
 * (`result-summary.json` → `assessment.elevationRegistration`), and the hash comparison with the N9-01 regression on the
 * same sealed inputs.
 *   npx vite-node research/analyzer-n9-02a/aggregate.ts -- --base <N9-01 dir> --head <dir> --out <file.json> --md <file.md>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const arg = (n: string): string => process.argv[process.argv.indexOf(`--${n}`) + 1]
const HOUSES = ['a01', 'gozd', 'marcowki', 'ciesz', 'rary', 'trytomach', 'arganiach', 'sasankach3']
const NAMES: Record<string, string> = { a01: 'Jarzmianki (A01)', gozd: 'Goździkowce 3', marcowki: 'Marcówki GE', ciesz: 'Cieszynianki 12', rary: 'Rarytasy 5', trytomach: 'Trytomach', arganiach: 'Arganiach', sasankach3: 'Sasanki 3' }
const read = (dir: string, h: string): any => JSON.parse(readFileSync(join(dir, h, 'result-summary.json'), 'utf8'))
const hashes = ['candidateHash', 'modelHash', 'sceneContentHash', 'sceneSha256', 'metricEvidenceHash'] as const
const houses = HOUSES.map((h) => {
  const b = read(arg('base'), h)
  const r = read(arg('head'), h)
  const e = r.assessment.elevationRegistration
  const r1 = (x: any) => Object.fromEntries(x.assessment.sourceFidelity.relations.map((rel: any) => [rel.id, rel.status]))
  return {
    house: h,
    name: NAMES[h],
    unchanged: Object.fromEntries(hashes.map((k) => [k, b[k] === r[k]])),
    service: { base: b.analyzer.service, head: r.analyzer.service },
    relationsUnchanged: JSON.stringify(r1(b)) === JSON.stringify(r1(r)) && b.assessment.technicalValidity.status === r.assessment.technicalValidity.status && b.assessment.decompositionCompleteness.verdict === r.assessment.decompositionCompleteness.verdict,
    relations: r1(r),
    datums: e.datums,
    counts: e.counts,
    slots: e.slots,
    lost: e.lost,
    views: e.views.map((v: any) => ({
      frameId: v.frameId, labelled: v.labelledView, size: v.sizePx, extent: v.extent, solver: v.solver, before: beforeOf(v.solver), after: v.class,
      side: { state: v.side.state, value: v.side.value, basis: v.side.basis, why: v.side.why },
      along: { state: v.along.state, mpp: v.along.mpp ?? null, spanM: v.along.spanM ?? null, bandPx: v.along.bandPx ?? null, anchors: v.along.anchors.map((a: any) => `${a.kind}${a.independentOfModel ? '' : ' (shared with model)'}`), why: v.along.why, alternatives: v.along.alternatives },
      vertical: { state: v.vertical.state, apexRow: v.vertical.apexRow ?? null, groundRow: v.vertical.groundRow ?? null, groundY: v.vertical.groundY ?? null, groundErrorM: v.vertical.groundErrorM ?? null, anchors: v.vertical.anchors.map((a: any) => a.kind), why: v.vertical.why },
      scale: v.scale, checkable: v.checkable, solverAgreement: v.solverAgreement ?? null,
    })),
  }
})
function beforeOf(s: any): string {
  if (s.use === 'REGISTERED') return s.openingHeights === 'REFUSED' ? 'ALONG_ONLY' : 'FULL'
  if (s.use === 'OPENINGS_ONLY' || s.use === 'POSITIONS_ONLY') return 'ALONG_ONLY'
  return 'UNREGISTERED'
}
const all = houses.flatMap((h) => h.views.map((v) => ({ ...v, house: h.house })))
const tally = (k: 'before' | 'after') => Object.fromEntries(['FULL', 'ALONG_ONLY', 'VERTICAL_ONLY', 'UNREGISTERED'].map((c) => [c, all.filter((v) => v[k] === c).length]))
const slots = { before: houses.reduce((a, h) => a + h.slots.before, 0), after: houses.reduce((a, h) => a + h.slots.after, 0) }
const summary = { views: all.length, before: tally('before'), after: tally('after'), slots, lost: houses.flatMap((h) => h.lost.map((l: any) => ({ house: h.house, ...l }))), hashesUnchanged: houses.every((h) => Object.values(h.unchanged).every(Boolean)), relationsUnchanged: houses.every((h) => h.relationsUnchanged) }
writeFileSync(arg('out'), JSON.stringify({ summary, houses }, null, 1))
const L: string[] = []
L.push('# 32 elevations — BEFORE (the solver’s use) → AFTER (four-axis registration)\n')
L.push(`Totals: BEFORE ${JSON.stringify(summary.before)} → AFTER ${JSON.stringify(summary.after)}. Checkable feature slots ${slots.before} → ${slots.after}. Hashes unchanged in all houses: ${summary.hashesUnchanged ? 'yes' : 'NO'}; technical validity, completeness and R1/R3/R4/R5 statuses unchanged: ${summary.relationsUnchanged ? 'yes' : 'NO'}.\n`)
L.push('| house | view | label | solver use | before | after | SIDE | ALONG (m/px, anchors) | VERTICAL (ground m) | SCALE | why not further |')
L.push('|---|---|---|---|---|---|---|---|---|---|---|')
for (const h of houses) for (const v of h.views) {
  const why = v.after === 'FULL' ? '' : (v.along.state !== 'REGISTERED' ? `ALONG: ${v.along.why}` : `VERTICAL: ${v.vertical.why}`).replace(/\|/g, '/').slice(0, 260)
  L.push(`| ${h.name} | …${v.frameId.slice(-10)} | ${v.labelled} | ${v.solver.use} | ${v.before} | **${v.after}** | ${v.side.state} ${v.side.value} (${v.side.basis}) | ${v.along.state}${v.along.mpp !== null ? ` ${v.along.mpp}` : ''} [${v.along.anchors.join(', ')}] | ${v.vertical.state}${v.vertical.groundY !== null ? ` ${v.vertical.groundY}` : ''} | ${v.scale.state} | ${why} |`)
}
writeFileSync(arg('md'), L.join('\n') + '\n')
console.log(JSON.stringify(summary, null, 1))
