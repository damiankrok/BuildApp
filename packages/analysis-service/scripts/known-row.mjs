/**
 * One row of the known set, judged by rule rather than by hash (BUILDPLAN-ANALYZER-005A,
 * post-implementation Council C and G).
 *
 * `node known-row.mjs <out dir> <bodies> [must-complete|may-refuse|legacy-compat|decoy] [source-package.json]`
 *
 * A pinned model hash fails a fix that recovers the right house as surely as a regression,
 * so a row states what a right answer looks like instead:
 *
 *   - a completion has the house's own number of bodies; when the plan was resolved, it was
 *     chosen by a published figure the resolver was free to use (not one it had already
 *     spent refusing the first reading), and lands within 6 % of it;
 *   - a first reading the drawing itself contradicted and the resolver replaced
 *     (METRIC_CHALLENGE REPLACED, 005D) is judged the same way: the record names the source
 *     conflict, the figure only verified the replacement, and it lands within 6 % of that figure;
 *   - given the row's source package, any completion lands within 6 % of the published
 *     footprint, however it was reached: a silent wrong-scale completion fails;
 *   - a refusal is allowed only where the row says so, and only as the resolver's named
 *     PLAN_RESOLUTION_INCONCLUSIVE — never a silent smaller building, never another code.
 *
 * `legacy-compat` (005D §4, LEGACY_EVIDENCE_COMPATIBILITY): sealed evidence from an older
 * reader must complete correctly or be refused by name; it never counts as the current
 * reading's acceptance and says so. `decoy`: the same replay with a published footprint that
 * is not the publisher's (`--decoy-footprint`); it must be refused by name — a figure may
 * verify the drawing, never choose its scale.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const [dir, bodiesArg, modeArg, packagePath] = process.argv.slice(2)
const MODES = ['must-complete', 'may-refuse', 'legacy-compat', 'decoy']
const mode = modeArg ?? 'must-complete'
if (!dir || !bodiesArg || !MODES.includes(mode)) {
  process.stderr.write(`usage: known-row.mjs <out dir> <bodies> [${MODES.join('|')}] [source-package.json]\n`)
  process.exit(2)
}
const read = (name) => JSON.parse(readFileSync(join(dir, name), 'utf8'))
const fail = (message) => {
  process.stdout.write(`::error::${dir}: ${message}\n`)
  process.exit(1)
}
const lane = mode === 'legacy-compat' ? ' [LEGACY_EVIDENCE_COMPATIBILITY: not current acceptance]' : mode === 'decoy' ? ' [DECOY]' : ''
const entries = read('analysis-trace.json').entries
const resolution = entries.find((e) => e.substage === 'PLAN_RESOLUTION')?.counts
const challenge = entries.find((e) => e.substage === 'METRIC_CHALLENGE')?.counts
const published = packagePath ? JSON.parse(readFileSync(packagePath, 'utf8')).publishedFacts?.find((f) => f.key === 'footprint_area' && f.unit === 'm2')?.value : undefined
const ringArea = (poly) => Math.abs(poly.reduce((a, p, i) => { const q = poly[(i + 1) % poly.length]; return a + p.x * q.z - q.x * p.z }, 0)) / 2

if (existsSync(join(dir, 'result-summary.json'))) {
  const summary = read('result-summary.json')
  if (mode === 'decoy') fail(`completed with ${summary.masses} bodies against a decoy footprint: the figure chose the building`)
  if (summary.masses !== Number(bodiesArg)) fail(`completed with ${summary.masses} bodies; the house has ${bodiesArg}`)
  if (resolution) {
    if (resolution.outcome !== 'RESOLVED') fail(`completed, but the resolution says ${resolution.outcome}`)
    if (resolution.publishedFigure === 'SPENT') fail('chosen by a published figure that had already refused the first reading')
    const residual = Number(resolution.chosenResidualPct)
    if (!Number.isFinite(residual) || Math.abs(residual) > 6) fail(`resolved ${resolution.chosenResidualPct ?? 'without a residual'} % from the published footprint`)
  }
  if (challenge?.outcome === 'REPLACED') {
    // Replaced because the drawing contradicted the first reading (a named source conflict), the figure only
    // verifying; or, without a conflict, chosen with a witness besides the figure.
    if (challenge.sourceConflict && !['VERIFIED', 'NONE'].includes(challenge.publishedFigure)) fail(`the replacement of a reading the drawing contradicted (${challenge.sourceConflict}) used the published figure as ${challenge.publishedFigure}, not as a verifier`)
    if (!challenge.sourceConflict && !challenge.chosenCorroborations) fail('the first reading was replaced with nothing but the published figure behind the replacement')
    const residual = Number(challenge.chosenResidualPct)
    if (!Number.isFinite(residual) || Math.abs(residual) > 6) fail(`replaced ${challenge.chosenResidualPct ?? 'without a residual'} % from the published footprint`)
  }
  let footprint = ''
  if (published !== undefined) {
    const model = read('model.json')
    const lowest = [...model.levels].sort((a, b) => a.index - b.index)[0]
    const built = model.slabs.filter((s) => s.levelId === lowest?.id).reduce((a, s) => a + ringArea(s.polygon), 0)
    const residual = (built / published - 1) * 100
    if (Math.abs(residual) > 6) fail(`completed ${residual.toFixed(2)} % from the published footprint (${built.toFixed(2)} m² built, ${published} m² published): a wrong-scale completion`)
    footprint = `, ${residual.toFixed(2)} % of the published footprint`
  }
  const how = challenge?.outcome === 'REPLACED' ? `, the first reading replaced by the drawing (figure ${challenge.publishedFigure})` : resolution ? `, resolved at ${resolution.chosenResidualPct} % of the published footprint` : ''
  process.stdout.write(`${dir}: completed, ${summary.masses} bodies${how}${footprint}${lane}\n`)
} else {
  const failure = read('failure.json')
  const code = failure.reasonCode ?? failure.code
  if (mode === 'must-complete') fail(`refused (${code}); this row must complete`)
  if (code !== 'PLAN_RESOLUTION_INCONCLUSIVE') fail(`refused with ${code}, not the resolver's named PLAN_RESOLUTION_INCONCLUSIVE`)
  process.stdout.write(`${dir}: refused by name (${code})${lane}\n`)
}
