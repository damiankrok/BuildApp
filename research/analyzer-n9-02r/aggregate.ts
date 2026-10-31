/**
 * N9-02R (research only, offline, read-only): the before/after of the eight-house regression against N9-02A on the same
 * sealed inputs — model hashes, all 32 elevations (class, facade reader, adjudicated axes), every R5 item and the
 * P/E/I scorecard, and the SOURCE_UNCHECKED elevation items.
 *   npx vite-node research/analyzer-n9-02r/aggregate.ts -- --base <N9-02A dir> --head <dir> --out <file.json> --md <file.md>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const arg = (n: string): string => process.argv[process.argv.indexOf(`--${n}`) + 1]
const HOUSES = ['a01', 'gozd', 'marcowki', 'ciesz', 'rary', 'trytomach', 'arganiach', 'sasankach3']
const NAMES: Record<string, string> = { a01: 'Jarzmianki (A01)', gozd: 'Goździkowce 3', marcowki: 'Marcówki GE', ciesz: 'Cieszynianki 12', rary: 'Rarytasy 5', trytomach: 'Trytomach', arganiach: 'Arganiach', sasankach3: 'Sasanki 3' }
const read = (dir: string, h: string): any => JSON.parse(readFileSync(join(dir, h, 'result-summary.json'), 'utf8'))
const hashes = ['candidateHash', 'modelHash', 'sceneContentHash', 'sceneSha256', 'metricEvidenceHash'] as const
const r5Of = (x: any): any[] => x.assessment.sourceFidelity.relations.find((r: any) => r.id === 'R5_REGISTERED_ELEVATIONS').items
const statusOf = (x: any): Record<string, string> => Object.fromEntries(x.assessment.sourceFidelity.relations.map((r: any) => [r.id, r.status]))

const houses = HOUSES.map((h) => {
  const b = read(arg('base'), h)
  const r = read(arg('head'), h)
  const eb = b.assessment.elevationRegistration
  const e = r.assessment.elevationRegistration
  const r5b = r5Of(b)
  const r5h = r5Of(r)
  const views = e.views.filter((v: any) => v.solver.use !== 'DUPLICATE').map((v: any) => {
    const vb = eb.views.find((x: any) => x.frameId === v.frameId)
    const ib = r5b.find((i: any) => i.source?.frameId === v.frameId)
    const ih = r5h.find((i: any) => i.source?.frameId === v.frameId)
    const sc = e.scorecard.views.find((x: any) => x.frameId === v.frameId)
    return {
      frameId: v.frameId,
      labelled: v.labelledView,
      solverUse: v.solver.use,
      classN902A: vb?.class,
      class: v.class,
      facade: v.facade ? { state: v.facade.state, x0: v.facade.x0 ?? null, x1: v.facade.x1 ?? null, uncertaintyPx: v.facade.uncertaintyPx ?? null, why: v.facade.why, anchors: (v.facade.anchors ?? []).map((a: any) => `${a.type}${a.accepted ? '' : ' (refused)'} ${JSON.stringify(a.px)}`) } : null,
      neutralBandN902A: vb?.along?.bandPx ?? null,
      along: { state: v.along.state, mpp: v.along.mpp ?? null, why: v.along.why, dispute: v.along.dispute ?? null, anchors: v.along.anchors.map((a: any) => `${a.kind}${a.independentOfModel ? '' : ' (shared with model)'}`) },
      vertical: { state: v.vertical.state, groundY: v.vertical.groundY ?? null, dispute: v.vertical.dispute ?? null, why: v.vertical.why },
      validity: v.validity,
      side: `${v.side.state} ${v.side.value}`,
      scale: v.scale.state,
      r5: { before: ib ? `${ib.status} ${ib.code}` : null, after: ih ? `${ih.status} ${ih.code}` : null, raw: ih ? { observed: ih.measured.rawObserved ?? null, outside: ih.measured.rawOutsideTolerance ?? null, worst: ih.measured.rawWorst ?? null } : null, excluded: ih ? { disputed: ih.measured.excludedDisputed ?? 0, unavailable: ih.measured.excludedUnavailable ?? 0, circular: ih.measured.excludedCircular ?? 0 } : null, why: ih?.why ?? null },
      pei: sc ? { P: sc.potential, E: sc.executed, I: sc.independent } : null,
      pN902A: vb?.checkable?.slots ?? null,
      eN901: ib ? Number(ib.measured.observed ?? 0) : 0,
    }
  })
  const unchecked = r.assessment.sourceUnchecked.items.filter((i: any) => i.kind === 'ELEVATION').map((i: any) => ({ frameId: i.frameId, axes: i.axes, extent: i.extent, registration: i.registration?.class }))
  return {
    house: h,
    name: NAMES[h],
    unchanged: Object.fromEntries(hashes.map((k) => [k, b[k] === r[k]])),
    service: { base: b.analyzer.service, head: r.analyzer.service },
    technicalUnchanged: b.assessment.technicalValidity.status === r.assessment.technicalValidity.status && b.assessment.technicalValidity.errors === r.assessment.technicalValidity.errors,
    completenessUnchanged: b.assessment.decompositionCompleteness.verdict === r.assessment.decompositionCompleteness.verdict,
    relations: { before: statusOf(b), after: statusOf(r) },
    r1r4Unchanged: ['R1_ROOF_LAYERS', 'R3_WALL_INK', 'R4_STOREY_OUTLINE'].every((id) => JSON.stringify(b.assessment.sourceFidelity.relations.find((x: any) => x.id === id)) === JSON.stringify(r.assessment.sourceFidelity.relations.find((x: any) => x.id === id))),
    counts: { n902a: eb.counts.after, n902r: e.counts.after, solver: e.counts.before },
    scorecard: e.scorecard.totals,
    views,
    unchecked,
    uncheckedTotal: { before: b.assessment.sourceUnchecked.counts.total, after: r.assessment.sourceUnchecked.counts.total },
  }
})
const all = houses.flatMap((h) => h.views.map((v: any) => ({ ...v, house: h.house })))
const tally = (k: 'classN902A' | 'class') => Object.fromEntries(['FULL', 'ALONG_ONLY', 'VERTICAL_ONLY', 'UNREGISTERED'].map((c) => [c, all.filter((v) => v[k] === c).length]))
const r5changes = all.filter((v) => v.r5.before !== v.r5.after).map((v) => ({ house: v.house, frameId: v.frameId, before: v.r5.before, after: v.r5.after, validity: v.validity, why: v.r5.why }))
const summary = {
  views: all.length,
  classes: { n902a: tally('classN902A'), n902r: tally('class') },
  facadeReader: { ACCEPTED: all.filter((v) => v.facade?.state === 'ACCEPTED').length, REFUSED: all.filter((v) => v.facade?.state === 'REFUSED').length, UNKNOWN: all.filter((v) => v.facade?.state === 'UNKNOWN').length, none: all.filter((v) => !v.facade).length },
  validity: { along: Object.fromEntries(['VALID', 'SPAN_ONLY', 'DISPUTED', 'UNAVAILABLE'].map((s) => [s, all.filter((v) => v.validity.along === s).length])), vertical: Object.fromEntries(['VALID', 'DISPUTED', 'UNAVAILABLE'].map((s) => [s, all.filter((v) => v.validity.vertical === s).length])) },
  pei: { P: all.reduce((a, v) => a + (v.pei?.P ?? 0), 0), E: all.reduce((a, v) => a + (v.pei?.E ?? 0), 0), I: all.reduce((a, v) => a + (v.pei?.I ?? 0), 0), pN902A: all.reduce((a, v) => a + (v.pN902A ?? 0), 0), eN901: all.reduce((a, v) => a + v.eN901, 0) },
  r5: { before: Object.fromEntries(['PASS', 'CONFLICT', 'UNCHECKED'].map((s) => [s, all.filter((v) => v.r5.before?.startsWith(s)).length])), after: Object.fromEntries(['PASS', 'CONFLICT', 'UNCHECKED'].map((s) => [s, all.filter((v) => v.r5.after?.startsWith(s)).length])), changes: r5changes },
  hashesUnchanged: houses.every((h) => Object.values(h.unchanged).every(Boolean)),
  technicalAndCompletenessUnchanged: houses.every((h) => h.technicalUnchanged && h.completenessUnchanged),
  r1r4Unchanged: houses.every((h) => h.r1r4Unchanged),
}
writeFileSync(arg('out'), JSON.stringify({ summary, houses }, null, 1))
const L: string[] = []
L.push('# 32 elevations — N9-02A → N9-02R\n')
L.push(`Classes N9-02A ${JSON.stringify(summary.classes.n902a)} → N9-02R ${JSON.stringify(summary.classes.n902r)}. Facade reader: ${JSON.stringify(summary.facadeReader)}. Hashes unchanged in all houses: ${summary.hashesUnchanged ? 'yes' : 'NO'}; technical validity and completeness unchanged: ${summary.technicalAndCompletenessUnchanged ? 'yes' : 'NO'}; R1/R3/R4 unchanged: ${summary.r1r4Unchanged ? 'yes' : 'NO'}.\n`)
L.push(`P/E/I: potential ${summary.pei.P} (N9-02A slots ${summary.pei.pN902A}), executed on valid axes ${summary.pei.E} (N9-01 observed ${summary.pei.eN901}), independent ${summary.pei.I}. R5 items ${JSON.stringify(summary.r5.before)} → ${JSON.stringify(summary.r5.after)}.\n`)
L.push('| house | view | label | solver use | class N9-02A → N9-02R | facade reader | ALONG (validity) | VERTICAL (validity) | R5 before → after | P/E/I | why (facade reader / R5) |')
L.push('|---|---|---|---|---|---|---|---|---|---|---|')
for (const h of houses)
  for (const v of h.views) {
    const why = `${v.facade ? v.facade.why.slice(0, 160) : '—'}${v.r5.after && v.r5.before !== v.r5.after ? ` / R5: ${String(v.r5.why).slice(0, 160)}` : ''}`.replace(/\|/g, '/')
    L.push(`| ${h.name} | …${v.frameId.slice(-10)} | ${v.labelled} | ${v.solverUse} | ${v.classN902A} → **${v.class}** | ${v.facade ? `${v.facade.state}${v.facade.x0 !== null ? ` ${v.facade.x0}..${v.facade.x1}` : ''}` : '—'} | ${v.along.state}${v.along.mpp !== null ? ` ${v.along.mpp}` : ''} (${v.validity.along}) | ${v.vertical.state} (${v.validity.vertical}) | ${v.r5.before ?? '—'} → ${v.r5.after ?? '—'} | ${v.pei ? `${v.pei.P}/${v.pei.E}/${v.pei.I}` : '—'} | ${why} |`)
  }
writeFileSync(arg('md'), L.join('\n') + '\n')
console.log(JSON.stringify(summary, null, 1))
