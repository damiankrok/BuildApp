#!/usr/bin/env node
/**
 * mutations.mjs — BUILDPLAN-ANALYZER-005L §22 mutation gates (RESEARCH ONLY; no mutation is ever committed).
 *
 *   node research/analyzer-005l/mutations.mjs --out <dir>
 *
 * Each mutation is a temporary patch applied in place to one production file at the commit under test; the 005L suites
 * run; the file is restored (`git checkout -- <file>`) and checked clean before the next. A mutation must make at least
 * one test fail — the gate named beside it. The tree must be clean before and after.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')
const i = process.argv.indexOf('--out')
const out = resolve(i >= 0 ? process.argv[i + 1] : '/home/user/work005l/mutations')
mkdirSync(out, { recursive: true })
const LAYOUT = 'packages/reconstruction/src/layout.ts'
const EMIT = 'packages/reconstruction/src/v2/emit.ts'
const SUITES = ['packages/reconstruction/test/storey-support.test.ts', 'packages/reconstruction/test/storey-emission.test.ts', 'packages/reconstruction/test/layout.test.ts', 'tests/architecture/storey-support.test.ts']

const MUTATIONS = [
  {
    id: 'M1',
    what: 'the lower-mass 50 % rule is restored as the only criterion: a region stands on a body only where it covers half of it',
    must: 'the partial upper-storey fixtures fail (an upper floor over a fifth of a large body)',
    file: LAYOUT,
    from: 'const supports = ox >= ctx.minSpanM && oz >= ctx.minSpanM',
    to: 'const supports = inter / massArea >= 0.5',
  },
  {
    id: 'M2',
    what: 'every mass gets every storey: a body no walled region stands on is stacked over its whole ring',
    must: 'the garage / wing safety fixtures fail',
    file: LAYOUT,
    from: '      const pieces = chosen.supported.get(mass.id)\n      if (!pieces) continue',
    to: '      const pieces = chosen.supported.get(mass.id) ?? [{ regionId: mass.id, ...ringBoundsOf(mass.ring) }]\n      if (!pieces) continue',
  },
  {
    id: 'M3',
    what: "the upper envelope stands for the upper storey's walled regions: every region is the plan's long-band box",
    must: 'the terrace / void fixture fails',
    file: LAYOUT,
    from: '    .map((region) => ({ region, wallFraction: perimeterWallEvidence(region, plan.decomposition, unit).fraction }))',
    to: '    .map((region) => ({ region: { ...region, rect: plan.decomposition.envelope?.rect ?? region.rect }, wallFraction: perimeterWallEvidence(region, plan.decomposition, unit).fraction }))',
  },
  {
    id: 'M4',
    what: 'the published room list chooses support: a storey the page lists rooms on is stacked whatever its walls say',
    must: 'the non-circularity architecture gate fails',
    file: LAYOUT,
    from: '    record.why = `stands on ${[...chosen.supported.keys()].sort().join(\', \')}`',
    to: '    const publishedRooms = (options as { publishedRooms?: unknown[] }).publishedRooms ?? []\n    if (publishedRooms.length > 0 && chosen.supported.size === 0) for (const m of masses) chosen.supported.set(m.id, [{ regionId: m.id, ...ringBoundsOf(m.ring) }])\n    record.why = `stands on ${[...chosen.supported.keys()].sort().join(\', \')}`',
  },
  {
    id: 'M5',
    what: 'the first alignment candidate wins: the placements are taken in the order they were generated, unsorted',
    must: 'the order / ambiguity fixtures fail',
    file: LAYOUT,
    from: '  considered.sort((a, b) => b.score - a.score ||',
    to: '  void ((a: PlanAlignment, b: PlanAlignment) => b.score - a.score ||',
  },
  {
    id: 'M6',
    what: "the ground ring is copied upstairs: every storey's walls enclose the whole body",
    must: 'the end-to-end emitted-geometry fixture fails (the inset upper storey)',
    file: EMIT,
    from: '      const r = rectAt(m, storey)',
    to: '      const r = rectAt(m, m.storeys[0])',
  },
  {
    id: 'M7',
    what: 'incidental overlap is accepted: any overlap at all stands a region on a body',
    must: 'the garage / overhang fixtures fail',
    file: LAYOUT,
    from: 'const supports = ox >= ctx.minSpanM && oz >= ctx.minSpanM',
    to: 'const supports = inter > 0',
  },
]

const clean = () => execFileSync('git', ['status', '--porcelain', '--', 'packages', 'tests'], { cwd: REPO, encoding: 'utf8' }).trim() === ''
if (!clean()) throw new Error('the tree is not clean before the mutations')
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim()
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null
const results = []
for (const m of MUTATIONS.filter((x) => !only || only.includes(x.id))) {
  const path = join(REPO, m.file)
  const source = readFileSync(path, 'utf8')
  if (source.split(m.from).length !== 2) throw new Error(`${m.id}: the patch anchor is not unique in ${m.file}`)
  writeFileSync(path, source.replace(m.from, m.to))
  const report = join(out, `${m.id}.json`)
  const r = spawnSync('npx', ['vitest', 'run', ...SUITES, '--reporter=json', `--outputFile=${report}`], { cwd: REPO, encoding: 'utf8', env: { ...process.env, TMPDIR: process.env.TMPDIR ?? '/tmp' } })
  execFileSync('git', ['checkout', '--', m.file], { cwd: REPO })
  if (!clean()) throw new Error(`${m.id}: the tree is not clean after restoring ${m.file}`)
  let json
  try {
    json = JSON.parse(readFileSync(report, 'utf8'))
  } catch {
    json = { numTotalTests: 0, testResults: [] }
  }
  const failed = json.testResults.flatMap((f) => (f.assertionResults ?? []).filter((a) => a.status === 'failed').map((a) => `${f.name.replace(`${REPO}/`, '')} > ${a.fullName}`))
  // a suite that does not even load (a type error the mutation introduced) fails as a whole
  const brokenFiles = json.testResults.filter((f) => f.status === 'failed' && (f.assertionResults ?? []).length === 0).map((f) => f.name.replace(`${REPO}/`, ''))
  const killed = failed.length > 0 || brokenFiles.length > 0 || (r.status !== 0 && json.numTotalTests === 0)
  results.push({ id: m.id, what: m.what, must: m.must, file: m.file, exit: r.status, total: json.numTotalTests, failed: failed.length, failing: failed, brokenFiles, verdict: killed ? 'KILLED' : 'SURVIVED' })
  process.stdout.write(`${m.id} ${killed ? 'KILLED' : 'SURVIVED'}: ${failed.length} of ${json.numTotalTests} failed${brokenFiles.length ? `, ${brokenFiles.length} suites did not load` : ''}\n`)
}
writeFileSync(join(out, 'mutation-results.json'), `${JSON.stringify({ stage: 'BUILDPLAN-ANALYZER-005L', commit: sha, suites: SUITES, results }, null, 1)}\n`)
