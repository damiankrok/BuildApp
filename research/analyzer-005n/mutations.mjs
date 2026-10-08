#!/usr/bin/env node
/**
 * mutations.mjs — BUILDPLAN-ANALYZER-005N §30 mutation gates (RESEARCH ONLY; no mutation is ever committed).
 *
 *   node research/analyzer-005n/mutations.mjs --out <dir outside the repository>
 *
 * Each mutation is a temporary patch applied in place to one production file at the commit under test; the 005N
 * suites run; the file is restored (`git checkout -- <file>`) and checked clean before the next. A mutation must make
 * at least one test fail — the gate named beside it. The tree must be clean before and after.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')
const i = process.argv.indexOf('--out')
const out = resolve(i >= 0 ? process.argv[i + 1] : '/home/user/work005n/mutations')
if (out.startsWith(REPO)) throw new Error('mutation logs stay outside the repository')
mkdirSync(out, { recursive: true })
const COMPOUND = 'packages/reconstruction/src/compound-facade.ts'
const DECOMPOSITION = 'packages/reconstruction/src/plan-decomposition.ts'
const SUITES = [
  'packages/reconstruction/test/compound-facade.test.ts',
  'packages/reconstruction/test/compound-facade-order.test.ts',
  'packages/reconstruction/test/compound-facade-emission.test.ts',
  'packages/reconstruction/test/wide-openings.test.ts',
  'tests/architecture/compound-facade.test.ts',
  'tests/architecture/gap-evidence.test.ts',
]

const MUTATIONS = [
  {
    id: 'M1',
    what: 'do not split a compound span: the reader never returns a span',
    must: 'the target synthetic fixture fails (recess + garage on one line)',
    file: COMPOUND,
    from: '  if (accepted.length === 0) return null',
    to: '  if (accepted.length >= 0) return null',
  },
  {
    id: 'M2',
    what: 'close every child interval: each interval is an opening in its wall',
    must: 'the carport / loggia fixtures fail',
    file: DECOMPOSITION,
    from: "    decision: interval.role === 'OPENING_IN_WALL' ? 'OPENING_IN_WALL' : 'OPEN_SIDE',",
    to: "    decision: 'OPENING_IN_WALL',",
  },
  {
    id: 'M3',
    what: 'a callout crosses a separator: every interval may take any callout printed along the whole parent span',
    must: 'the recess-callout safety fixture (18) fails',
    file: COMPOUND,
    from: "  const lo = bounds[0] === 'JAMB' ? from - slack : from\n  const hi = bounds[1] === 'JAMB' ? to + slack : to",
    to: '  const lo = parent.fromPx - slack\n  const hi = parent.toPx + slack',
  },
  {
    id: 'M4',
    what: 'the published area chooses segmentation: a span is left whole when the page states a footprint',
    must: 'the non-circularity architecture gate fails',
    file: COMPOUND,
    from: '  if (accepted.length === 0) return null',
    to: '  if (accepted.length === 0) return null\n  const publishedAreas = (ctx as unknown as { publishedAreas?: Array<{ value: number }> }).publishedAreas ?? []\n  if (publishedAreas.some((a) => a.value < 0)) return null',
  },
  {
    id: 'M5',
    what: "use the whole span's pocket limit after segmentation: each interval is weighed against max(6, 2.5 w²) of its parent",
    must: 'the per-interval pocket fixture fails (an undrawn mouth into the hall beside the recess)',
    file: DECOMPOSITION,
    from: '        const limitM2 = round6(Math.max(6, 2.5 * g.decision.widthM * g.decision.widthM))',
    to: '        const w5 = g.decision.compound ? (spans.find((s) => s.id === g.decision.compound?.spanId)?.widthM ?? g.decision.widthM) : g.decision.widthM\n        const limitM2 = round6(Math.max(6, 2.5 * w5 * w5))',
  },
  {
    id: 'M6',
    what: 'accept any short block as a separator: a post or a bin on the line cuts the span',
    must: 'the furniture / post negative fixtures fail',
    file: COMPOUND,
    from: "  if (piece.kind === 'WALL' && piece.along) {",
    to: '  if (piece.to > piece.from) {',
  },
  {
    id: 'M7',
    what: "a missing return still makes a recess: the back wall is sought as deep as the LONGER return reaches",
    must: 'the missing-return fixture (14) fails',
    file: COMPOUND,
    from: '    const reach = Math.min(left, right, RECESS_MAX_DEPTH_M / mppIn)',
    to: '    const reach = Math.min(Math.max(left, right), RECESS_MAX_DEPTH_M / mppIn)',
  },
  {
    id: 'M8',
    what: 'enable the 005K drawn-gap rule by default',
    must: 'the drawn-gap architecture gate fails',
    file: DECOMPOSITION,
    from: "  const drawnGapRule = options.drawnGapRule ?? 'OFF'",
    to: "  const drawnGapRule = options.drawnGapRule ?? 'ON'",
  },
  {
    id: 'M9',
    what: 'enumeration order changes child intervals: an interval takes the first agreeing callout in input order',
    must: 'the order-invariance gate fails (callout shuffles)',
    file: COMPOUND,
    from: '  for (const c of [...ctx.callouts].sort((p, q) => (p.id < q.id ? -1 : p.id > q.id ? 1 : 0))) {',
    to: '  for (const c of ctx.callouts) {',
    also: [{ from: '      if (!best || w.confidence > best.confidence) best = { id: c.id', to: '      if (!best) best = { id: c.id' }],
  },
  {
    id: 'M10',
    what: 'a house special case: one facade line, by its pixel row, is never read for separators',
    must: 'the generalization guard fails (a new literal)',
    file: COMPOUND,
    from: '  if (inside.length === 0) return null',
    to: '  if (inside.length === 0 || Math.round(parent.linePx) === 598) return null',
  },
]

const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' })
if (git('status', '--porcelain', '--', 'packages')) throw new Error('packages/ must be clean before mutating')
const results = []
for (const m of MUTATIONS) {
  const path = join(REPO, m.file)
  const source = readFileSync(path, 'utf8')
  const patches = [{ from: m.from, to: m.to }, ...(m.also ?? [])]
  let mutated = source
  for (const p of patches) {
    if (mutated.split(p.from).length !== 2) throw new Error(`${m.id}: the anchor is not unique in ${m.file}: ${p.from}`)
    mutated = mutated.replace(p.from, p.to)
  }
  writeFileSync(path, mutated)
  const t0 = Date.now()
  const run = spawnSync('npx', ['vitest', 'run', ...SUITES], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 2 ** 20 })
  git('checkout', '--', m.file)
  if (git('status', '--porcelain', '--', 'packages')) throw new Error(`${m.id}: the tree is not clean after restoring ${m.file}`)
  const log = `${run.stdout}\n${run.stderr}`.replace(/\x1b\[[0-9;]*m/g, '')
  writeFileSync(join(out, `${m.id}.log`), log)
  const failed = [...new Set([...log.matchAll(/^ FAIL {2}(\S+) > (.+)$/gm)].map((x) => `${x[1]} > ${x[2]}`))]
  results.push({ id: m.id, what: m.what, must: m.must, file: m.file, killed: run.status !== 0 && failed.length > 0, failedTests: failed.length, firstFailures: failed.slice(0, 6), seconds: Math.round((Date.now() - t0) / 1000) })
  process.stdout.write(`${m.id} ${run.status !== 0 && failed.length > 0 ? 'KILLED' : 'SURVIVED'} (${failed.length} failing) ${Math.round((Date.now() - t0) / 1000)} s\n`)
}
writeFileSync(join(out, 'mutation-results.json'), JSON.stringify({ stage: 'BUILDPLAN-ANALYZER-005N', gitSha: git('rev-parse', 'HEAD').trim(), suites: SUITES, results }, null, 1) + '\n')
