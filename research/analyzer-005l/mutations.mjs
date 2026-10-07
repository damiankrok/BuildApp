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
const STRUCTURAL = 'packages/reconstruction/src/structural.ts'
const V2 = 'packages/reconstruction/src/v2/reconstruct-v2.ts'
const SUITES = ['packages/reconstruction/test/storey-support.test.ts', 'packages/reconstruction/test/storey-council.test.ts', 'packages/reconstruction/test/storey-emission.test.ts', 'packages/reconstruction/test/storey-council-emission.test.ts', 'packages/reconstruction/test/layout.test.ts', 'packages/reconstruction/test/fixtures.test.ts', 'packages/reconstruction/test/fixtures-v2.test.ts', 'tests/architecture/storey-support.test.ts']

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
    from: '      if (!kept.includes(mass.id)) continue\n      const pieces = chosen.supported.get(mass.id)\n      if (!pieces) continue',
    to: '      const pieces = (kept.includes(mass.id) ? chosen.supported.get(mass.id) : undefined) ?? [{ regionId: mass.id, ...ringBoundsOf(mass.ring) }]',
  },
  {
    id: 'M3',
    what: "the upper envelope stands for the upper storey's walled regions: every region is the plan's long-band box",
    must: 'the terrace / void / set-back fixtures fail',
    file: LAYOUT,
    from: '      return { region, rect, faces, wallFraction:',
    to: '      return { region, rect: plan.decomposition.envelope?.rect ?? rect, faces, wallFraction:',
  },
  {
    id: 'M4',
    what: 'the published room list chooses support: a storey the page lists rooms on is stacked over every body',
    must: 'the non-circularity architecture gate fails',
    file: LAYOUT,
    from: "    record.why = `stands on ${kept.join(', ')}",
    to: "    const publishedRooms = (options as { publishedRooms?: unknown[] }).publishedRooms ?? []\n    if (publishedRooms.length > 0) for (const m of masses) if (!kept.includes(m.id)) kept.push(m.id), chosen.supported.set(m.id, [{ regionId: m.id, ...ringBoundsOf(m.ring) }])\n    record.why = `stands on ${kept.join(', ')}",
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
    must: 'the end-to-end emitted-geometry fixtures fail (the inset upper storey)',
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
  {
    id: 'M8',
    what: "the published footprint area decides support: read from the caller's options, past the layout-only filter",
    must: 'the non-circularity architecture gates fail (vocabulary of the support section; no non-layout key is read)',
    file: LAYOUT,
    from: "    record.why = `stands on ${kept.join(', ')}",
    to: "    const footprintArea = (given as { publishedAreas?: Array<{ key: string; value: number }> }).publishedAreas?.find((a) => a.key === 'footprint_area')?.value\n    if (footprintArea !== undefined && kept.length < masses.length) for (const m of masses) if (!kept.includes(m.id)) kept.push(m.id), chosen.supported.set(m.id, [{ regionId: m.id, ...ringBoundsOf(m.ring) }])\n    record.why = `stands on ${kept.join(', ')}",
  },
  {
    id: 'M9',
    what: 'the structural pass hands the published areas to the layout inference that decides support',
    must: 'the structural.ts publish-use gate fails',
    file: STRUCTURAL,
    from: '  const draft = inferStructuralLayout(options)',
    to: "  const draft = inferStructuralLayout(options.publishedAreas?.some((a) => a.key === 'footprint_area') ? { ...options, frameFilter: undefined } : options)",
  },
  {
    id: 'M10',
    what: 'the v2 emitter builds an upper storey of its own only where the page lists rooms on it',
    must: 'the v2 storeyRects vocabulary gate fails',
    file: V2,
    from: '      if (storeyId === measuredOn || own.length === 0) continue',
    to: '      if (storeyId === measuredOn || own.length === 0 || !(options.publishedRooms ?? []).some((r) => r.index === s)) continue',
  },
]

// Council D5L-8: each 005L knob moved by about a quarter either way. Not mutations (nothing must fail): the record says
// which synthetic fixtures pin a knob, and a knob no fixture pins is named as such.
const knob = (id, name, decl, values) => values.map((v, k) => ({ id: `${id}${k === 0 ? '-' : '+'}`, what: `${name} ${decl.split('=')[1].trim()} → ${v}`, file: LAYOUT, from: decl, to: `${decl.split('=')[0]}= ${v}`, kind: 'KNOB' }))
const KNOBS = [
  ...knob('K1', 'FACADE_WALL_SHARE', 'const FACADE_WALL_SHARE = 0.25', [0.1875, 0.3125]),
  ...knob('K2', 'WALL_PAIR_SCALE_AGREEMENT', 'const WALL_PAIR_SCALE_AGREEMENT = 0.02', [0.015, 0.025]),
  ...knob('K3', 'STOREY_RIVAL_WINDOW', 'const STOREY_RIVAL_WINDOW = 0.1', [0.075, 0.125]),
  ...knob('K4', 'SAME_SCALE_OFFSETS_PER_AXIS', 'const SAME_SCALE_OFFSETS_PER_AXIS = 6', [4, 8]),
  ...knob('K5', 'STOREY_WALL_SHARE', 'const STOREY_WALL_SHARE = 0.75', [0.5625, 0.9375]),
  ...knob('K6', 'STATED_HOLDS_SHARE', 'const STATED_HOLDS_SHARE = 0.5', [0.375, 0.625]),
  { id: 'K7-', what: 'minSpanM (SUPPORTS on both axes) × 0.75', file: LAYOUT, from: '  const minSpanM = minBodySpanM(wallM)', to: '  const minSpanM = 0.75 * minBodySpanM(wallM)', kind: 'KNOB' },
  { id: 'K7+', what: 'minSpanM (SUPPORTS on both axes) × 1.25', file: LAYOUT, from: '  const minSpanM = minBodySpanM(wallM)', to: '  const minSpanM = 1.25 * minBodySpanM(wallM)', kind: 'KNOB' },
]

const clean = () => execFileSync('git', ['status', '--porcelain', '--', 'packages', 'tests'], { cwd: REPO, encoding: 'utf8' }).trim() === ''
if (!clean()) throw new Error('the tree is not clean before the mutations')
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim()
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null
const results = []
const knobsRun = process.argv.includes('--knobs')
for (const m of (knobsRun ? KNOBS : MUTATIONS).filter((x) => !only || only.includes(x.id))) {
  const path = join(REPO, m.file)
  const source = readFileSync(path, 'utf8')
  if (source.split(m.from).length !== 2) throw new Error(`${m.id}: the patch anchor is not unique in ${m.file}`)
  writeFileSync(path, source.replace(m.from, m.to))
  const report = join(out, `${m.id}.json`)
  // a knob is weighed by the behaviour suites only: the architecture gate freezes every literal, so it fails them all
  const suites = m.kind === 'KNOB' ? SUITES.filter((x) => !x.startsWith('tests/')) : SUITES
  const r = spawnSync('npx', ['vitest', 'run', ...suites, '--reporter=json', `--outputFile=${report}`], { cwd: REPO, encoding: 'utf8', env: { ...process.env, TMPDIR: process.env.TMPDIR ?? '/tmp' } })
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
  const verdict = m.kind === 'KNOB' ? (killed ? 'PINNED' : 'NOT_PINNED') : killed ? 'KILLED' : 'SURVIVED'
  results.push({ id: m.id, what: m.what, ...(m.must ? { must: m.must } : {}), file: m.file, exit: r.status, total: json.numTotalTests, failed: failed.length, failing: failed, brokenFiles, verdict })
  process.stdout.write(`${m.id} ${verdict}: ${failed.length} of ${json.numTotalTests} failed${brokenFiles.length ? `, ${brokenFiles.length} suites did not load` : ''}\n`)
}
writeFileSync(join(out, knobsRun ? 'knob-results.json' : 'mutation-results.json'), `${JSON.stringify({ stage: 'BUILDPLAN-ANALYZER-005L', commit: sha, suites: SUITES, results }, null, 1)}\n`)
