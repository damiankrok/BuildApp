#!/usr/bin/env node
/**
 * mutations.mjs — BUILDPLAN-ANALYZER-005P mutation gates (RESEARCH ONLY; no mutation is ever committed).
 *
 *   node research/analyzer-005p/mutations.mjs --out <dir outside the repository>
 *
 * 005N's method: each mutation is a temporary patch applied in place to one production file at the commit under test;
 * the 005P suites run; the file is restored (`git checkout -- <file>`) and checked clean before the next. A mutation must
 * make at least one test fail, and the failing test must be the safety assertion named beside it (matched by its title),
 * not a type or import error. The tree must be clean before and after.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')
const i = process.argv.indexOf('--out')
const out = resolve(i >= 0 ? process.argv[i + 1] : '/home/user/work005p/mutations')
if (out.startsWith(REPO)) throw new Error('mutation logs stay outside the repository')
mkdirSync(out, { recursive: true })
const RESOLUTION = 'packages/reconstruction/src/plan-resolution.ts'
const CONTEST = 'packages/reconstruction/src/statement-contest.ts'
const SUITES = ['packages/reconstruction/test/statement-contest.test.ts', 'packages/reconstruction/test/source-conflict.test.ts', 'packages/reconstruction/test/plan-resolution.test.ts', 'tests/architecture/statement-contest.test.ts']

const MUTATIONS = [
  {
    id: 'X1',
    what: 'undo the innovation: the source conflict reads every statement as printed (the 1.4.0 test)',
    must: /accuse nothing \(failed under 1\.4\.0\)/,
    file: RESOLUTION,
    from: '  return conflictUnder(metrics, frameId, registration, judge, wallPx, true)\n}\n\n/** The source conflict (1.5.0)',
    to: '  return conflictUnder(metrics, frameId, registration, judge, wallPx, false)\n}\n\n/** The source conflict (1.5.0)',
  },
  {
    id: 'X2',
    what: 'widen the scope: the ranking reads a contested statement by the doubt policy too (refutedShareAsRead defaults to ANY_FITS)',
    must: /the ranking still reads every statement as printed/,
    file: RESOLUTION,
    from: "tolerancePx: number, doubt: Doubt = 'AS_PRINTED'): number {",
    to: "tolerancePx: number, doubt: Doubt = 'ANY_FITS'): number {",
  },
  {
    id: 'X3',
    what: 'promote a contested external number: a statement the incumbent reads as nothing states its readers\' values',
    must: /states nothing/,
    file: RESOLUTION,
    from: "  if (doubt === 'AS_PRINTED' || !s.contest.contested || read.length === 0) return read",
    to: "  if (doubt === 'AS_PRINTED' || !s.contest.contested) return read",
  },
  {
    id: 'X4',
    what: 'count readers of one ink as separate readings: three readers agreeing are a contest (reader count, not distinct values)',
    must: /three readers reading the same value are one reading/,
    file: CONTEST,
    from: '    return { readings, values, contested: values.length >= 2 }',
    to: '    return { readings, values, contested: readings.length >= 2 }',
  },
  {
    id: 'X5',
    what: 'promote, not withhold: the accuser\'s side reads a contested statement as ANY of its readings (doubt helps the accuser)',
    must: /monotone|accuse nothing/,
    file: RESOLUTION,
    from: "  const accuser: Doubt = withDoubt ? 'ALL_FIT' : 'AS_PRINTED'",
    to: "  const accuser: Doubt = withDoubt ? 'ANY_FITS' : 'AS_PRINTED'",
  },
  {
    id: 'X6',
    what: 'the published footprint decides whether the drawing is accused (a figure present silences the conflict)',
    must: /published figure|never chooses|does not read the published/,
    file: RESOLUTION,
    from: "  const base = incumbent.draft.base\n  if (!base) return { conflict: null, withdrawn: null }",
    to: "  const base = incumbent.draft.base\n  if (!base || (options.publishedAreas ?? []).length > 0) return { conflict: null, withdrawn: null }",
  },
  {
    id: 'X7',
    what: 'trust missing data: a statement with no lattice (a missing reader) counts as contested',
    must: /no value is conjured|1\.4\.0s|another copy/,
    file: CONTEST,
    from: '    return { readings, values, contested: values.length >= 2 }',
    to: '    return { readings, values, contested: values.length >= 2 || lattice === undefined }',
  },
  {
    id: 'X8',
    what: 'an external reading that does not corroborate counts (any CONTESTS external is a confident reading)',
    must: /corroborating/,
    file: CONTEST,
    from: "  if (e.decision === 'CONTESTS' && e.rival?.witness === 'EXTERNAL') return value",
    to: "  if (e.decision === 'CONTESTS' || e.decision === 'CONTESTS_COUNT' || e.decision === 'NOT_CORROBORATING') return value",
  },
]

const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' })
if (git('status', '--porcelain').trim() !== '') throw new Error('the tree must be clean before the mutation gates')
const results = []
for (const m of MUTATIONS) {
  const path = join(REPO, m.file)
  const text = readFileSync(path, 'utf8')
  const n = text.split(m.from).length - 1
  if (n !== 1) {
    results.push({ id: m.id, status: 'ANCHOR_NOT_FOUND', count: n })
    continue
  }
  writeFileSync(path, text.replace(m.from, m.to))
  const run = spawnSync('npx', ['vitest', 'run', '--reporter=json', ...SUITES], { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28 })
  git('checkout', '--', m.file)
  if (git('status', '--porcelain').trim() !== '') throw new Error(`the tree is not clean after ${m.id}`)
  let failed = []
  try {
    const report = JSON.parse(run.stdout.slice(run.stdout.indexOf('{')))
    failed = report.testResults.flatMap((f) => f.assertionResults.filter((a) => a.status === 'failed').map((a) => `${f.name.replace(REPO + '/', '')} :: ${a.fullName}`))
    const suiteErrors = report.testResults.filter((f) => f.status === 'failed' && f.assertionResults.length === 0).map((f) => f.name)
    if (suiteErrors.length > 0) failed.push(...suiteErrors.map((s) => `SUITE_ERROR ${s}`))
  } catch {
    failed = ['UNPARSEABLE_REPORT']
  }
  const intended = failed.some((f) => m.must.test(f))
  const status = failed.length === 0 ? 'SURVIVED' : failed.some((f) => f.startsWith('SUITE_ERROR') || f === 'UNPARSEABLE_REPORT') && !intended ? 'COMPILE_OR_SUITE_ONLY' : intended ? 'KILLED' : 'KILLED_BY_OTHER'
  results.push({ id: m.id, what: m.what, must: String(m.must), status, failed })
  process.stdout.write(`${m.id} ${status} (${failed.length} failing)\n`)
}
writeFileSync(join(out, 'mutation-results.json'), JSON.stringify(results, null, 1))
process.stdout.write(`${results.filter((r) => r.status === 'KILLED').length}/${results.length} killed by the intended assertion\n`)
