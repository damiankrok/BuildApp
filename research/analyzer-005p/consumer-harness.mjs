#!/usr/bin/env node
/**
 * consumer-harness.mjs — BUILDPLAN-ANALYZER-005P (RESEARCH ONLY; never imported by production).
 *
 *   node research/analyzer-005p/consumer-harness.mjs setup --work <dir outside the repo>
 *   AS_PRINTED_POLICY_005P=<policy.json> npx vite-node --config <dir>/vite.config.mjs packages/analysis-service/scripts/second-house.ts -- ...
 *
 * 005O's harness gave plan resolution ONE as-printed view for every consumer. This one makes the consumer explicit:
 * a copy of the frozen `plan-resolution.ts` in which every call that reads a statement "as printed" names its consumer,
 * and a policy file says, per consumer, how a CONTESTED statement (two or more confident readers of one ink disagree)
 * is read there. The consumers (call sites, frozen line numbers at 5906afa):
 *
 *   LATTICE           latticeScales (:253), from resolvePlan (:586) and challengeFirstReading (:998)
 *   CONFLICT_LATTICE  latticeScales called by sourceConflictOf to offer T1 alternatives (:841)
 *   ISOTROPY          the both-axes support tests (:590, :997)
 *   RANKING           refutedShareAsRead from metricsAtScale (:345) and refutedShareAtRegistration (:350)
 *   T1_REG            sourceConflictOf T1: the registration's refuted share (:840)
 *   T1_ALT            sourceConflictOf T1: each offered alternative's refuted share (:842)
 *   T3_ACCUSE         sourceConflictOf T3: the long readings that may agree on another scale (:868, :873); seeds are the
 *                     frozen readings except under DROP (005O M1 read the seeds through the view too)
 *   T3_DEFEND         sourceConflictOf T3: the long length that agrees with the registration (:869)
 *
 * Not view consumers (recorded, frozen in every variant): metricsAtScale's re-read options (`firstReadCm` then the
 * reader's alternatives, :330) and T2 PARTIAL_BINDING (`evidence.rawText`, :851-864).
 *
 * Modes (for a statement the policy marks contested; an uncontested statement, or one without an entry, is always read
 * exactly as frozen):
 *   FROZEN    the frozen list
 *   DROP      005O M1: states nothing (empty list) — neither for nor against a scale
 *   KSET_ANY  the statement may have been printed as any of its confident readings: refuted only if NONE agrees
 *   KSET_ALL  (an accuser's own scale) refuted unless EVERY confident reading agrees; (T3) accuses a scale only if
 *             EVERY confident reading agrees with it
 * KSET never adds a reading to a statement whose frozen list is empty (no promotion).
 *
 * The patch is applied by exact text replacement and fails loudly if an anchor is not found exactly once. Without the
 * environment variable, or with an empty config, the copy behaves as the frozen file (checked by the P0H control).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')
const i = process.argv.indexOf('--work')
const work = resolve(i >= 0 ? process.argv[i + 1] : '/home/user/work005p/harness')
if (process.argv[2] !== 'setup') {
  process.stderr.write('usage: consumer-harness.mjs setup --work <dir>\n')
  process.exit(2)
}
if (work.startsWith(REPO)) throw new Error('the harness lives outside the repository')
mkdirSync(work, { recursive: true })
const SRC = join(REPO, 'packages/reconstruction/src')
let text = readFileSync(join(SRC, 'plan-resolution.ts'), 'utf8')

const replace = (from, to) => {
  const n = text.split(from).length - 1
  if (n !== 1) throw new Error(`anchor found ${n} times: ${from.slice(0, 90)}`)
  text = text.replace(from, to)
}
text = text.replace(/from '\.\/([a-z0-9/-]+)\.js'/g, (_, p) => `from '${join(SRC, p)}.ts'`)

replace(
  "type Statement = { evidence: MetricEvidence; axis: 'X' | 'Y'; pixelLength: number; firstReadCm?: number }",
  `type Statement = { evidence: MetricEvidence; axis: 'X' | 'Y'; pixelLength: number; firstReadCm?: number; policy?: { K: number[]; contested: boolean } }
// 005P research harness: the consumer-scoped policy under test (absent = the frozen behaviour).
import { readFileSync as __read005p } from 'node:fs'
type Consumer005P = 'LATTICE' | 'CONFLICT_LATTICE' | 'ISOTROPY' | 'RANKING' | 'T1_REG' | 'T1_ALT' | 'T3_ACCUSE' | 'T3_DEFEND'
type Mode005P = 'FROZEN' | 'DROP' | 'KSET_ANY' | 'KSET_ALL'
const POLICY_005P: { config: Partial<Record<Consumer005P, Mode005P>>; view: Record<string, { K: number[]; contested: boolean }> } = process.env.AS_PRINTED_POLICY_005P ? JSON.parse(__read005p(process.env.AS_PRINTED_POLICY_005P, 'utf8')) : { config: {}, view: {} }
const mode005p = (c: Consumer005P): Mode005P => POLICY_005P.config[c] ?? 'FROZEN'
const scoped005p = (s: Statement, c: Consumer005P, frozen: number[]): number[] => {
  const m = mode005p(c)
  if (!s.policy || !s.policy.contested || m === 'FROZEN') return frozen
  if (m === 'DROP') return []
  return frozen.length === 0 ? [] : [...new Set([...frozen, ...s.policy.K])].sort((a, b) => a - b)
}`,
)
replace(
  "      out.push({ evidence, axis: chain.axis === 'HORIZONTAL' ? 'X' : 'Y', pixelLength: segment.pixelLength, firstReadCm })",
  "      out.push({ evidence, axis: chain.axis === 'HORIZONTAL' ? 'X' : 'Y', pixelLength: segment.pixelLength, firstReadCm, ...(Object.prototype.hasOwnProperty.call(POLICY_005P.view, evidence.id) ? { policy: POLICY_005P.view[evidence.id] } : {}) })",
)
// frozen readers keep their bodies; the consumer-scoped readers wrap them
replace('const zeroSubstitution = (s: Statement): number[] =>', 'const zeroSubstitutionFrozen = (s: Statement): number[] =>')
replace(
  "const asRead = (s: Statement): number[] => (s.evidence.origin === 'READ' && s.evidence.derivation?.dependsOnScale ? [] : zeroSubstitution(s))",
  `const asReadFrozen = (s: Statement): number[] => (s.evidence.origin === 'READ' && s.evidence.derivation?.dependsOnScale ? [] : zeroSubstitutionFrozen(s))
const zeroSubstitution = (s: Statement, c: Consumer005P): number[] => scoped005p(s, c, zeroSubstitutionFrozen(s))
const asRead = (s: Statement, c: Consumer005P): number[] => scoped005p(s, c, asReadFrozen(s))`,
)
replace(
  "function refutedShareAsRead(statements: readonly Statement[], cmPerPxOn: (axis: 'X' | 'Y') => number, tolerancePx: number): number {",
  "function refutedShareAsRead(statements: readonly Statement[], cmPerPxOn: (axis: 'X' | 'Y') => number, tolerancePx: number, c: Consumer005P): number {",
)
replace('    const read = asRead(s)\n', '    const read = asRead(s, c)\n    const every005p = mode005p(c) === \'KSET_ALL\' && s.policy?.contested === true\n')
replace(
  '    if (!read.some((cm) => agrees(cm, s.pixelLength, cmPerPxOn(s.axis), tolerancePx))) refuted += s.pixelLength',
  '    if (!(every005p ? read.every((cm) => agrees(cm, s.pixelLength, cmPerPxOn(s.axis), tolerancePx)) : read.some((cm) => agrees(cm, s.pixelLength, cmPerPxOn(s.axis), tolerancePx)))) refuted += s.pixelLength',
)
replace(
  'export function latticeScales(metrics: MetricEvidenceSet, frameId: string, registration: CoordinateRegistration, extent: PixelRect, tolerancePx: number): Array<',
  "export function latticeScales(metrics: MetricEvidenceSet, frameId: string, registration: CoordinateRegistration, extent: PixelRect, tolerancePx: number, consumer005p: Consumer005P = 'LATTICE'): Array<",
)
replace('  const readings = long.flatMap((s) => zeroSubstitution(s).map(', '  const readings = long.flatMap((s) => zeroSubstitution(s, consumer005p).map(')
replace("refutedShare: refutedShareAsRead([...statements.values()], () => cmPerPx, tolerancePx) }", "refutedShare: refutedShareAsRead([...statements.values()], () => cmPerPx, tolerancePx, 'RANKING') }")
replace(
  '(axis === \'X\' ? registration.metresPerPixelX : registration.metresPerPixelY) * 100, tolerancePx)\n}',
  "(axis === 'X' ? registration.metresPerPixelX : registration.metresPerPixelY) * 100, tolerancePx, 'RANKING')\n}",
)
replace(
  "zeroSubstitution(s).some((cm) => agrees(cm, s.pixelLength, axis === 'X' ? cmX : cmY, tolerancePx))",
  "zeroSubstitution(s, 'ISOTROPY').some((cm) => agrees(cm, s.pixelLength, axis === 'X' ? cmX : cmY, tolerancePx))",
)
replace(
  'zeroSubstitution(st).some((cm) => agrees(cm, st.pixelLength, cmPerPx, tolerancePx))',
  "zeroSubstitution(st, 'ISOTROPY').some((cm) => agrees(cm, st.pixelLength, cmPerPx, tolerancePx))",
)
replace('  const registrationRefuted = refutedShareAsRead(statements, regAxis, tolerancePx)', "  const registrationRefuted = refutedShareAsRead(statements, regAxis, tolerancePx, 'T1_REG')")
replace(
  ': latticeScales(metrics, frameId, registration, judge, tolerancePx)\n',
  ": latticeScales(metrics, frameId, registration, judge, tolerancePx, 'CONFLICT_LATTICE')\n",
)
replace('refuted: refutedShareAsRead(statements, () => o.cmPerPx, tolerancePx) }))', "refuted: refutedShareAsRead(statements, () => o.cmPerPx, tolerancePx, 'T1_ALT') }))")
// T3 seeds: DROP reads the seeds through the view (005O M1); every other mode seeds from the frozen readings, so an
// accusation can only be made on a scale the incumbent would have tried. Membership is the consumer's mode.
replace(
  '  const longRead = statements.flatMap((s) => (s.pixelLength >= SUBSTANTIAL_SHARE * extentOn(s.axis) ? asRead(s).map((cm) => ({ s, cm })) : []))',
  `  const longStatements005p = statements.filter((s) => s.pixelLength >= SUBSTANTIAL_SHARE * extentOn(s.axis))
  const longRead = longStatements005p.flatMap((s) => (mode005p('T3_ACCUSE') === 'DROP' ? asRead(s, 'T3_ACCUSE') : asReadFrozen(s)).map((cm) => ({ s, cm })))
  const accuses005p = (s: Statement, cmPerPx: number): boolean => {
    const r = asRead(s, 'T3_ACCUSE')
    const all = mode005p('T3_ACCUSE') === 'KSET_ALL' && s.policy?.contested === true
    return r.length > 0 && (all ? r.every((cm) => agrees(cm, s.pixelLength, cmPerPx, tolerancePx)) : r.some((cm) => agrees(cm, s.pixelLength, cmPerPx, tolerancePx)))
  }`,
)
replace(
  '    const agreeing = longRead.filter((r) => agrees(r.cm, r.s.pixelLength, cmPerPx, tolerancePx))',
  '    const agreeing = longStatements005p.filter((s) => accuses005p(s, cmPerPx)).map((s) => ({ s, cm: asReadFrozen(s)[0] ?? 0 }))',
)
replace(
  '  const supportedLength = longRead.filter((r) => agrees(r.cm, r.s.pixelLength, regAxis(r.s.axis), tolerancePx)).reduce((a, r) => a + r.s.pixelLength, 0)',
  "  const supportedLength = statements.filter((s) => s.pixelLength >= SUBSTANTIAL_SHARE * extentOn(s.axis) && asRead(s, 'T3_DEFEND').some((cm) => agrees(cm, s.pixelLength, regAxis(s.axis), tolerancePx))).reduce((a, s) => a + s.pixelLength, 0)",
)
// every reader is now consumer-scoped: a call left without a consumer would not typecheck, and would read undefined here
for (const bare of ['zeroSubstitution(s)', 'zeroSubstitution(st)', 'asRead(s)']) if (text.includes(bare)) throw new Error(`unscoped call left: ${bare}`)

const patched = join(work, 'plan-resolution.consumer.ts')
writeFileSync(patched, text)
const pk = (p) => join(REPO, 'packages', p, 'src/index.ts')
writeFileSync(
  join(work, 'vite.config.mjs'),
  `export default { resolve: { alias: [\n  { find: /^\\.\\.?\\/plan-resolution\\.js$/, replacement: '${patched}' },\n  { find: /^@buildapp\\/source-common$/, replacement: '${pk('source-common')}' },\n  { find: /^@buildapp\\/source-cv$/, replacement: '${pk('source-cv')}' },\n  { find: /^@buildapp\\/source-metrics$/, replacement: '${pk('source-metrics')}' },\n] } }\n`,
)
process.stdout.write(`wrote ${patched} and ${join(work, 'vite.config.mjs')}\n`)
