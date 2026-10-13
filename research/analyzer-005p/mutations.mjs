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
const DECOMPOSITION = 'packages/reconstruction/src/plan-decomposition.ts'
const V2 = 'packages/reconstruction/src/v2/reconstruct-v2.ts'
const SUITES = [
  'packages/reconstruction/test/statement-contest.test.ts',
  'packages/reconstruction/test/statement-contest-emission.test.ts',
  'packages/reconstruction/test/source-conflict.test.ts',
  'packages/reconstruction/test/plan-resolution.test.ts',
  'tests/architecture/statement-contest.test.ts',
]
const OPEN_SIDE_SUITES = ['packages/reconstruction/test/wide-openings.test.ts', 'packages/reconstruction/test/compound-facade.test.ts']

const MUTATIONS = [
  {
    id: 'X1',
    what: 'undo the innovation: the source conflict reads every statement as printed (the 1.4.0 test), in the review production uses',
    must: /accuse nothing \(failed under 1\.4\.0\)/,
    file: RESOLUTION,
    from: "  const accused: Doubt = withDoubt ? 'ANY_FITS' : 'AS_PRINTED'\n  const accuser: Doubt = withDoubt ? 'ALL_FIT' : 'AS_PRINTED'",
    to: "  const accused: Doubt = 'AS_PRINTED'\n  const accuser: Doubt = 'AS_PRINTED'",
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
    what: "promote a contested external number: a statement the incumbent reads as nothing states its readers' values",
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
    from: '    return { readings, values, contested: values.length >= 2, ...(lattice ? { latticeId: lattice.id } : {}) }',
    to: '    return { readings, values, contested: readings.length >= 2, ...(lattice ? { latticeId: lattice.id } : {}) }',
  },
  {
    id: 'X5',
    what: "promote, not withhold: the accuser's side reads a contested statement as ANY of its readings (doubt helps the accuser)",
    must: /monotone|accuse nothing|clause/,
    file: RESOLUTION,
    from: "  const accuser: Doubt = withDoubt ? 'ALL_FIT' : 'AS_PRINTED'",
    to: "  const accuser: Doubt = withDoubt ? 'ANY_FITS' : 'AS_PRINTED'",
  },
  {
    id: 'X6',
    what: 'the published footprint decides whether the drawing is accused (a figure present silences the conflict)',
    must: /published figure|never chooses/,
    file: RESOLUTION,
    from: "  const base = incumbent.draft.base\n  if (!base) return { conflict: null, withdrawn: null }",
    to: "  const base = incumbent.draft.base\n  if (!base || (options.publishedAreas ?? []).length > 0) return { conflict: null, withdrawn: null }",
  },
  {
    id: 'X7',
    what: 'trust missing data: a statement with no lattice (a missing reader) counts as contested',
    must: /no value is conjured|1\.4\.0’s|another copy|named once|withdrawn accusation is named/,
    file: CONTEST,
    from: '    return { readings, values, contested: values.length >= 2, ...(lattice ? { latticeId: lattice.id } : {}) }',
    to: '    return { readings, values, contested: values.length >= 2 || lattice === undefined, ...(lattice ? { latticeId: lattice.id } : {}) }',
  },
  {
    id: 'X8',
    what: 'an external reading that does not corroborate counts (any CONTESTS external is a confident reading)',
    must: /corroborating/,
    file: CONTEST,
    from: "  if (e.decision === 'CONTESTS' && e.rival?.witness === 'EXTERNAL') return value",
    to: "  if (e.decision === 'CONTESTS' || e.decision === 'CONTESTS_COUNT' || e.decision === 'NOT_CORROBORATING') return value",
  },
  {
    id: 'X9',
    what: 'clause 1 off: the registration is refuted by a contested statement as printed',
    must: /clause 1/,
    file: RESOLUTION,
    from: '  const registrationRefuted = refutedShareAsRead(statements, regAxis, tolerancePx, accused)',
    to: "  const registrationRefuted = refutedShareAsRead(statements, regAxis, tolerancePx, 'AS_PRINTED')",
  },
  {
    id: 'X10',
    what: 'clause 2 off: an offered rival is spared by a contested statement as printed',
    must: /clause 2/,
    file: RESOLUTION,
    from: 'refuted: refutedShareAsRead(statements, () => o.cmPerPx, tolerancePx, accuser) }))',
    to: "refuted: refutedShareAsRead(statements, () => o.cmPerPx, tolerancePx, 'AS_PRINTED') }))",
  },
  {
    id: 'X11',
    what: 'clause 3 off: a contested statement joins an OUTER_TOTALS accusation as printed',
    must: /clause 3/,
    file: RESOLUTION,
    from: '    const agreeing = long.filter((s) => fitsUnder(s, cmPerPx, tolerancePx, accuser))',
    to: "    const agreeing = long.filter((s) => fitsUnder(s, cmPerPx, tolerancePx, 'AS_PRINTED'))",
  },
  {
    id: 'X12',
    what: 'clause 4 off: a contested statement defends the registration as printed',
    must: /clause 4/,
    file: RESOLUTION,
    from: '  const supportedLength = long.filter((s) => fitsUnder(s, regAxis(s.axis), tolerancePx, accused))',
    to: "  const supportedLength = long.filter((s) => fitsUnder(s, regAxis(s.axis), tolerancePx, 'AS_PRINTED'))",
  },
  {
    id: 'X13',
    what: "count the same source twice: the lattice's confidence taken from the ensemble's decision class (a LEADS record's SUPPORTED makes the unconfident lattice a reader)",
    must: /LEADS record over an unconfident lattice/,
    file: CONTEST,
    from: '  const own = lattice.ensemble?.lattice.ocrClass ?? lattice.ocrClass',
    to: '  const own = lattice.ensemble?.ocrClass ?? lattice.ocrClass',
  },
  {
    id: 'X14',
    what: 'a statement carried by two segments is named twice in a withdrawal',
    must: /named once/,
    file: RESOLUTION,
    from: '    if (!ids.has(s.evidence.id) || !s.contest.contested || seen.has(s.evidence.id)) continue',
    to: '    if (!ids.has(s.evidence.id) || !s.contest.contested) continue',
  },
  {
    id: 'X15',
    what: 'a NOT_COMPARABLE external reading counts as corroborating',
    must: /corroborating/,
    file: CONTEST,
    from: "  if (e.decision === 'AGREES' || e.decision === 'LEADS') return value",
    to: "  if (e.decision === 'AGREES' || e.decision === 'LEADS' || e.decision === 'NOT_COMPARABLE') return value",
  },
  {
    id: 'X16',
    what: 'a duplicated crop joins the first lattice record instead of the sealed later one',
    must: /duplicated crop \(two lattice records/,
    file: CONTEST,
    from: '  for (const l of metrics.numericLattices ?? []) lattices.set(latticeKey(l), l)',
    to: '  for (const l of metrics.numericLattices ?? []) if (!lattices.has(latticeKey(l))) lattices.set(latticeKey(l), l)',
  },
  {
    id: 'X17',
    what: 'a full withdrawal is not recorded (only a partial one is): the doubt becomes silent',
    must: /SOURCE_CONFLICT_REVIEW|AMBIGUOUS gap|accusation is withdrawn/,
    file: V2,
    from: '    if (!review || !w) return',
    to: '    if (!review || !w || !review.conflict) return',
  },
  {
    id: 'X19',
    what: 'N1a off: a reading the registration\'s own solution cites may vouch for it again (the circular defence of review G2-1)',
    must: /cited by the registration/,
    file: RESOLUTION,
    from: '  const supporting = new Set(solution?.supportingObservationIds ?? [])\n  if (supporting.size === 0) return statements',
    to: '  const supporting = new Set<string>()\n  if (supporting.size === 0) return statements',
  },
  {
    id: 'X20',
    what: 'a withdrawal names every contested statement whose registration verdict flipped, whichever trigger was withdrawn (review F2-1)',
    must: /never reads/,
    file: RESOLUTION,
    from: '(t3.length > 0 && long.has(s) && (regFlip(s) || scaleFlip(s, t3)))',
    to: '(t3.length > 0 && (regFlip(s) || scaleFlip(s, t3)))',
  },
  // N1a's own properties (review round 3, I-1..I-7): each mutant undoes one, and its own fixture must catch it
  {
    id: 'X21',
    what: 'N1a cites a value on every ink, not on the ink it was read from (the citation key ignores the ink)',
    must: /another ink/,
    file: RESOLUTION,
    from: '  for (const o of metrics.dimensionObservations ?? []) if (supporting.has(o.id) && o.ocr?.latticeId) cited.add(`${ink(o.ocr.latticeId)}|${o.valueCm}`)',
    to: '  for (const o of metrics.dimensionObservations ?? []) if (supporting.has(o.id) && o.ocr?.latticeId) for (const l of metrics.numericLattices ?? []) cited.add(`${latticeKey(l)}|${o.valueCm}`)',
  },
  {
    id: 'X22',
    what: 'N1a sets aside every reading of a cited ink, whatever value was cited (the key ignores the value)',
    must: /another value of the same ink/,
    file: RESOLUTION,
    from: "c.latticeId !== undefined && cited.has(`${ink(c.latticeId)}|${r.valueCm}`)",
    to: "c.latticeId !== undefined && [...cited].some((k) => k.startsWith(`${ink(c.latticeId)}|`))",
  },
  {
    id: 'X23',
    what: 'N1a sets aside the as-printed value too when a reading of the same value is cited',
    must: /as-printed value is never set aside/,
    file: RESOLUTION,
    from: "    const isCited = (r: StatementContest['readings'][number]): boolean => r.reader !== 'AS_PRINTED' && c.latticeId",
    to: "    const isCited = (r: StatementContest['readings'][number]): boolean => c.latticeId",
  },
  {
    id: 'X24',
    what: "N1a takes citations from every frame's solution, not the registered frame's",
    must: /another frame/,
    file: RESOLUTION,
    from: '  const supporting = new Set(solution?.supportingObservationIds ?? [])',
    to: '  const supporting = new Set((metrics.metricSolutions ?? []).flatMap((x) => x.supportingObservationIds ?? []))',
  },
  {
    id: 'X25',
    what: 'N1a counts every observation as a citation, not only those the solution rests on',
    must: /does not rest on/,
    file: RESOLUTION,
    from: 'if (supporting.has(o.id) && o.ocr?.latticeId) cited.add(',
    to: 'if (o.ocr?.latticeId) cited.add(',
  },
  {
    id: 'X26',
    what: "N1a keys a citation on the lattice record's id, so a duplicated crop under another id escapes it (review H3-2)",
    must: /duplicated crop: a citation/,
    file: RESOLUTION,
    from: '  const ink = (latticeId: string): string => inkOf.get(latticeId) ?? `id:${latticeId}`',
    to: '  const ink = (latticeId: string): string => `id:${latticeId}`',
  },
  {
    id: 'X27',
    what: "N1a on one side only: T1's offered rivals are refuted by readings the solution cites",
    must: /on T1 a cited reading/,
    file: RESOLUTION,
    from: '  const alternatives = offered.map((o) => ({ cmPerPx: o.cmPerPx, refuted: refutedShareAsRead(statements, () => o.cmPerPx, tolerancePx, accuser) }))',
    to: '  const alternatives = offered.map((o) => ({ cmPerPx: o.cmPerPx, refuted: refutedShareAsRead(statementsOn(metrics, frameId), () => o.cmPerPx, tolerancePx, accuser) }))',
  },
  {
    id: 'X28',
    what: "N1a on one side only: T3's defence of the registration counts readings the solution cites",
    must: /on T3 cited readings cannot defend/,
    file: RESOLUTION,
    from: '  const supportedLength = long.filter((s) => fitsUnder(s, regAxis(s.axis), tolerancePx, accused))',
    to: '  const supportedLength = statementsOn(metrics, frameId).filter((s) => s.pixelLength >= SUBSTANTIAL_SHARE * extentOn(s.axis)).filter((s) => fitsUnder(s, regAxis(s.axis), tolerancePx, accused))',
  },
  {
    id: 'X29',
    what: 'a statement whose only rival reading is cited stays contested (and doubted)',
    must: /set aside: the accusation stands/,
    file: RESOLUTION,
    from: '    return { ...s, contest: { ...c, readings, values, contested: values.length >= 2 } }',
    to: '    return { ...s, contest: { ...c, readings, values, contested: c.contested } }',
  },
  {
    id: 'X30',
    what: 'a set-aside reading is not traced: the trace record drops the cited statements (review H3-1)',
    must: /traced as cited/,
    file: RESOLUTION,
    from: '    citedCount: w.cited.length,',
    to: '    citedCount: 0,',
  },
  {
    id: 'X18',
    what: 'change a protected open side: every wide-gap interval is decided an opening in its wall (open sides, carports, loggias closed)',
    must: /./,
    file: DECOMPOSITION,
    from: "    decision: interval.role === 'OPENING_IN_WALL' ? 'OPENING_IN_WALL' : 'OPEN_SIDE',",
    to: "    decision: 'OPENING_IN_WALL',",
    suites: OPEN_SIDE_SUITES,
  },
]

const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' })
if (git('status', '--porcelain').trim() !== '') throw new Error('the tree must be clean before the mutation gates')
const only = (process.argv.indexOf('--only') >= 0 ? process.argv[process.argv.indexOf('--only') + 1] : '').split(',').filter(Boolean)
const results = []
for (const m of MUTATIONS.filter((x) => only.length === 0 || only.includes(x.id))) {
  const path = join(REPO, m.file)
  const text = readFileSync(path, 'utf8')
  const n = text.split(m.from).length - 1
  if (n !== 1) {
    results.push({ id: m.id, status: 'ANCHOR_NOT_FOUND', count: n })
    continue
  }
  writeFileSync(path, text.replace(m.from, m.to))
  const run = spawnSync('npx', ['vitest', 'run', '--reporter=json', ...(m.suites ?? SUITES)], { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28 })
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
