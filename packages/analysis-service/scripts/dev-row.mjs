#!/usr/bin/env node
/**
 * One development house through today's analyzer, judged by the row it is expected to meet
 * (BUILDPLAN-ANALYZER-005B §45 "development houses"). The run re-extracts everything but the
 * sealed source package: observations, metric evidence and the model are today's.
 *
 * `node dev-row.mjs <out dir> <expectation> [--same-model <sha256>]`
 *
 *   pass              completed, and holdout/verdict.mjs says PASS (storeys, openings, footprint
 *                     within 6 %, a resolved plan with a witness);
 *   complete:<n>      completed with n bodies — a house whose model is still limited, which must
 *                     not fall back to a failure;
 *   footprint:<n>     completed with n bodies and its lowest storey within 6 % of the published
 *                     footprint, whatever else the verdict says;
 *   refuse:<A|B>      refused, by one of the named reason codes only — never a silent smaller
 *                     building, never another code.
 *
 * `--same-model` pins the model hash where the stage requires the model not to move (a house whose
 * hash may only change with a genuine correction explained in the stage report).
 * `--limits <CODE,CODE>` requires those LIMITING warnings on a completed result: a house whose metric
 * truth is weak must say so, and deleting the warning must fail the row.
 *
 * 005D, the dimension-chain gate, completed or refused: `--metric <RELATION,RELATION>` requires the
 * selected plan copy's metric solution to stand in one of those relations to the page vote, and
 * `--metric-overall` requires its scale to be stated by an overall reading (a witness spanning at
 * least 80 % of its axis) whose binding is primary and ends at no rejected mark — a spurious tick
 * may not cut the total that decides the scale. Whatever a later stage then makes of the plan, the
 * metric decision is judged on its own.
 *
 * 005E: `--metric-scale <cm/px>` requires the selected plan copy's scale (both axes) within 1.5 % of the scale the
 * printed overall dimensions state — for a row whose defect was a wrong scale read from misread labels.
 *
 * 005F: `--dimension-evidence <KIND>` requires a METRIC_RESOLUTION_INCONCLUSIVE refusal to say which dimension evidence
 * it had (`NO_DIMENSION_EVIDENCE` or `DIMENSION_EVIDENCE_INCONCLUSIVE`): a plan whose dimensions were found and misread
 * may not be refused as one that prints none.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const [dir, expectation, ...rest] = process.argv.slice(2)
if (!dir || !expectation) {
  process.stderr.write('usage: dev-row.mjs <out dir> <pass|complete:<n>|footprint:<n>|refuse:<CODE|CODE>> [--same-model <sha256>] [--limits <CODE,CODE>] [--metric <RELATION,RELATION>] [--metric-overall] [--metric-scale <cm/px>] [--dimension-evidence <KIND>]\n')
  process.exit(2)
}
const valueOf = (flag) => (rest.includes(flag) ? rest[rest.indexOf(flag) + 1] : undefined)
const pinned = valueOf('--same-model')
const limits = (valueOf('--limits') ?? '').split(',').filter(Boolean)
const metricRelations = (valueOf('--metric') ?? '').split(',').filter(Boolean)
const metricOverall = rest.includes('--metric-overall')
const metricScale = valueOf('--metric-scale') !== undefined ? Number(valueOf('--metric-scale')) : undefined
const dimensionEvidence = valueOf('--dimension-evidence')
const fail = (message) => {
  process.stdout.write(`::error::${dir}: ${message}\n`)
  process.exit(1)
}
const read = (name) => JSON.parse(readFileSync(join(dir, name), 'utf8'))
const verdictScript = resolve(import.meta.dirname, '../../../holdout/verdict.mjs')
const verdict = JSON.parse(execFileSync(process.execPath, [verdictScript, dir]).toString())
const [kind, arg] = expectation.split(':')

/** The selected plan copy's metric decision, judged on its own (005D). */
function metricGate() {
  if (metricRelations.length === 0 && !metricOverall && metricScale === undefined) return ''
  const digest = existsSync(join(dir, 'plan-diagnostics/digest.json')) ? read('plan-diagnostics/digest.json') : undefined
  if (!existsSync(join(dir, 'metric-evidence.json'))) fail('no metric evidence to judge')
  const metrics = read('metric-evidence.json')
  const frameId = digest?.selectedPlanFrameId
  const solution = (metrics.metricSolutions ?? []).find((s) => s.frameId === frameId)
  if (!solution) fail(`no metric solution on the selected plan copy (${frameId ?? 'none selected'})`)
  if (metricRelations.length > 0 && !metricRelations.includes(solution.relation)) fail(`the selected plan copy's scale is ${solution.relation}/${solution.confidence}; the row requires ${metricRelations.join(' or ')}`)
  const selected = solution.hypotheses.find((h) => h.id === solution.selectedHypothesisId)
  if (metricScale !== undefined) {
    for (const [axis, at] of [['X', solution.cmPerPixelX], ['Y', solution.cmPerPixelY]]) {
      if (!(at > 0) || Math.abs(at / metricScale - 1) > 0.015) fail(`the selected plan copy's ${axis} scale is ${at ?? 'none'} cm/px; the printed overall dimensions state ${metricScale}`)
    }
  }
  if (metricOverall) {
    if (!selected || selected.longestShare < 0.8) fail(`the selected scale is not stated by an overall reading (longest share ${selected?.longestShare ?? '-'})`)
    const observations = new Map((metrics.dimensionObservations ?? []).map((o) => [o.id, o]))
    const chains = new Map((metrics.chains ?? []).map((c) => [c.id, c]))
    for (const id of selected.witnessIds) {
      const o = observations.get(id)
      if (!o || o.binding?.role !== 'PRIMARY') continue
      const ends = (chains.get(o.chainId)?.marks ?? []).filter((m) => Math.abs(m.atPx - o.fromPx) <= 0.5 || Math.abs(m.atPx - o.toPx) <= 0.5)
      if (ends.some((m) => m.class === 'REJECTED')) fail(`"${o.rawText}", a witness of the selected scale, is bound to a rejected mark`)
    }
  }
  return `, metric ${solution.relation}/${solution.confidence}${selected ? ` at ${selected.cmPerPixel} cm/px (longest share ${selected.longestShare})` : ''}`
}

if (existsSync(join(dir, 'result-summary.json'))) {
  const summary = read('result-summary.json')
  const bodies = summary.counts?.masses ?? summary.masses
  if (kind === 'refuse') fail(`completed with ${bodies} bodies; this row expects a named refusal (${arg})`)
  if (kind === 'pass' && verdict.verdict !== 'PASS') fail(`completed, but the verdict is ${verdict.verdict}: ${JSON.stringify(verdict.conditions)}`)
  if ((kind === 'complete' || kind === 'footprint') && bodies !== Number(arg)) fail(`completed with ${bodies} bodies; the house has ${arg}`)
  if (kind === 'footprint' && !verdict.conditions?.footprint?.holds) fail(`the lowest storey is ${verdict.conditions?.footprint?.residualPct} % from the published footprint`)
  if (pinned && summary.modelHash !== pinned) fail(`the model moved: ${summary.modelHash}, the stage requires ${pinned}`)
  const limiting = new Set((summary.warningDetails ?? []).filter((w) => w.severity === 'LIMITING').map((w) => w.code))
  const missing = limits.filter((c) => !limiting.has(c))
  if (missing.length > 0) fail(`completed without the LIMITING warning${missing.length === 1 ? '' : 's'} it must carry: ${missing.join(', ')}`)
  process.stdout.write(`${dir}: completed, ${bodies} bodies, verdict ${verdict.verdict}, footprint ${verdict.conditions?.footprint?.builtM2 ?? '-'} m²${pinned ? ', model unchanged' : ''}${limits.length ? `, limited by ${limits.join(', ')}` : ''}${metricGate()}\n`)
} else {
  const failure = read('failure.json')
  const code = failure.reasonCode ?? failure.code
  if (kind !== 'refuse') fail(`refused (${code}); this row must complete`)
  if (!arg.split('|').includes(code)) fail(`refused with ${code}, not one of the named ${arg}`)
  const evidence = failure.diagnostics?.dimensionEvidence
  if (dimensionEvidence && evidence !== dimensionEvidence) fail(`refused with dimension evidence ${evidence ?? 'unstated'}; the row requires ${dimensionEvidence}`)
  process.stdout.write(`${dir}: refused by name (${code}${evidence ? `, ${evidence}` : ''})${metricGate()}\n`)
}
