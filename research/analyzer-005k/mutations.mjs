#!/usr/bin/env node
/**
 * mutations.mjs — BUILDPLAN-ANALYZER-005K §28 mutation gates (RESEARCH ONLY; no mutation is ever committed).
 *
 *   node research/analyzer-005k/mutations.mjs --out <dir>
 *
 * Each mutation is a temporary patch applied in place to one production file at the commit under test; the 005K suites
 * run; the file is restored (`git checkout -- <file>`) and checked clean before the next. A mutation must make at least
 * one test fail — the gate named beside it. The tree must be clean before and after.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')
const i = process.argv.indexOf('--out')
const out = resolve(i >= 0 ? process.argv[i + 1] : '/home/user/work005k/mutations')
mkdirSync(out, { recursive: true })
const BOUNDARY = 'packages/reconstruction/src/boundary-evidence.ts'
const RECORDS = 'packages/reconstruction/src/gap-evidence.ts'
const SUITES = ['packages/reconstruction/test/gap-evidence.test.ts', 'tests/architecture/gap-evidence.test.ts']

const MUTATIONS = [
  {
    id: 'M1',
    what: 'a BLANK gap is allowed: the rule upgrades a WALL/WALL gap with nothing drawn across it',
    must: 'the safety fixtures fail (the blank door-sized gap, the blank doorway of the record test)',
    file: BOUNDARY,
    from: 'eligible: wallJambs && alongJambs && withinLintel && drawn && inWallBand && jambInk }',
    to: "eligible: wallJambs && alongJambs && withinLintel && ((drawn && inWallBand) || gap.signature === 'BLANK') && jambInk }",
  },
  {
    id: 'M2',
    what: 'the jamb-ink check is removed: a line drawn from ink that is not wall-thick qualifies',
    must: 'the phantom fixture fails',
    file: BOUNDARY,
    from: 'const jambInk = trace.jambInk[0] >= JAMB_SOLID && trace.jambInk[1] >= JAMB_SOLID',
    to: 'const jambInk = trace.jambInk.length === 2',
  },
  {
    id: 'M3',
    what: 'an outcome-circular rule: the check takes the published footprint and only upgrades while the house is short of it',
    must: 'the architecture gate fails',
    file: BOUNDARY,
    from: 'export function drawnGapCheck(gap: Pick<BoundaryGap, \'jambs\' | \'widthM\' | \'signature\' | \'strokes\'>, trace: Pick<GapTrace, \'jambAlong\' | \'jambInk\' | \'signatureRaw\' | \'signatureLoose\'>, maxOpeningM: number): DrawnGapCheck {',
    to: 'export function drawnGapCheck(gap: Pick<BoundaryGap, \'jambs\' | \'widthM\' | \'signature\' | \'strokes\'>, trace: Pick<GapTrace, \'jambAlong\' | \'jambInk\' | \'signatureRaw\' | \'signatureLoose\'>, maxOpeningM: number, publishedFootprintM2?: number, builtM2?: number): DrawnGapCheck {\n  if (publishedFootprintM2 !== undefined && builtM2 !== undefined && builtM2 >= publishedFootprintM2) return { wallJambs: false, alongJambs: false, withinLintel: false, drawn: false, drawnVia: null, inWallBand: false, jambInk: false, eligible: false }',
  },
  {
    id: 'M4',
    what: 'a house special case: a 0.41 m face line is always an opening',
    must: 'the generalization guard fails (frozen literals)',
    file: BOUNDARY,
    from: 'const withinLintel = gap.widthM <= maxOpeningM',
    to: 'const withinLintel = gap.widthM <= maxOpeningM || Math.abs(gap.widthM - 0.41) < 0.01',
  },
  {
    id: 'M5',
    what: 'enumeration order as the tie-break: records in the order the lines and gaps were read',
    must: 'the determinism (order-invariance) gate fails',
    file: RECORDS,
    from: '  all.sort((p, q) =>',
    to: '  void ((p: GapEvidenceRecord, q: GapEvidenceRecord) =>',
  },
  {
    id: 'M6',
    what: 'the along-jamb test is removed: a jamb that is a crossing wall, not a stretch of this wall, qualifies (council A6)',
    must: 'the crossing-wall fixture fails',
    file: BOUNDARY,
    from: 'const alongJambs = trace.jambAlong[0] && trace.jambAlong[1]',
    to: 'const alongJambs = trace.jambAlong.length === 2',
  },
]

const clean = () => execFileSync('git', ['status', '--porcelain', '--', 'packages', 'tests'], { cwd: REPO, encoding: 'utf8' }).trim() === ''
if (!clean()) throw new Error('the tree is not clean before the mutations')
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim()
const results = []
for (const m of MUTATIONS) {
  const path = join(REPO, m.file)
  const source = readFileSync(path, 'utf8')
  if (source.split(m.from).length !== 2) throw new Error(`${m.id}: the patch anchor is not unique in ${m.file}`)
  writeFileSync(path, source.replace(m.from, m.to))
  const report = join(out, `${m.id}.json`)
  const r = spawnSync('npx', ['vitest', 'run', ...SUITES, '--reporter=json', `--outputFile=${report}`], { cwd: REPO, encoding: 'utf8', env: { ...process.env, TMPDIR: process.env.TMPDIR ?? '/tmp' } })
  execFileSync('git', ['checkout', '--', m.file], { cwd: REPO })
  if (!clean()) throw new Error(`${m.id}: the tree is not clean after restoring ${m.file}`)
  const json = JSON.parse(readFileSync(report, 'utf8'))
  const failed = json.testResults.flatMap((f) => f.assertionResults.filter((a) => a.status === 'failed').map((a) => `${f.name.replace(`${REPO}/`, '')} > ${a.fullName}`))
  results.push({ id: m.id, what: m.what, must: m.must, file: m.file, exit: r.status, total: json.numTotalTests, failed: failed.length, failing: failed, verdict: failed.length > 0 ? 'KILLED' : 'SURVIVED' })
  process.stdout.write(`${m.id} ${failed.length > 0 ? 'KILLED' : 'SURVIVED'}: ${failed.length} of ${json.numTotalTests} failed\n`)
}
writeFileSync(join(out, 'mutation-results.json'), `${JSON.stringify({ stage: 'BUILDPLAN-ANALYZER-005K', commit: sha, suites: SUITES, results }, null, 1)}\n`)
