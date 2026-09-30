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
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const [dir, expectation, ...rest] = process.argv.slice(2)
if (!dir || !expectation) {
  process.stderr.write('usage: dev-row.mjs <out dir> <pass|complete:<n>|footprint:<n>|refuse:<CODE|CODE>> [--same-model <sha256>] [--limits <CODE,CODE>]\n')
  process.exit(2)
}
const valueOf = (flag) => (rest.includes(flag) ? rest[rest.indexOf(flag) + 1] : undefined)
const pinned = valueOf('--same-model')
const limits = (valueOf('--limits') ?? '').split(',').filter(Boolean)
const fail = (message) => {
  process.stdout.write(`::error::${dir}: ${message}\n`)
  process.exit(1)
}
const read = (name) => JSON.parse(readFileSync(join(dir, name), 'utf8'))
const verdictScript = resolve(import.meta.dirname, '../../../holdout/verdict.mjs')
const verdict = JSON.parse(execFileSync(process.execPath, [verdictScript, dir]).toString())
const [kind, arg] = expectation.split(':')

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
  process.stdout.write(`${dir}: completed, ${bodies} bodies, verdict ${verdict.verdict}, footprint ${verdict.conditions?.footprint?.builtM2 ?? '-'} m²${pinned ? ', model unchanged' : ''}${limits.length ? `, limited by ${limits.join(', ')}` : ''}\n`)
} else {
  const failure = read('failure.json')
  const code = failure.reasonCode ?? failure.code
  if (kind !== 'refuse') fail(`refused (${code}); this row must complete`)
  if (!arg.split('|').includes(code)) fail(`refused with ${code}, not one of the named ${arg}`)
  process.stdout.write(`${dir}: refused by name (${code})\n`)
}
