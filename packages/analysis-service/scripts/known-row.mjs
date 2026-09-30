/**
 * One row of the known set, judged by rule rather than by hash (BUILDPLAN-ANALYZER-005A,
 * post-implementation Council C and G).
 *
 * `node known-row.mjs <out dir> <bodies> [may-refuse]`
 *
 * A pinned model hash fails a fix that recovers the right house as surely as a regression,
 * so a row states what a right answer looks like instead:
 *
 *   - a completion has the house's own number of bodies; when the plan was resolved, it was
 *     chosen by a published figure the resolver was free to use (not one it had already
 *     spent refusing the first reading), and lands within 6 % of it;
 *   - a refusal is allowed only where the row says so, and only as the resolver's named
 *     PLAN_RESOLUTION_INCONCLUSIVE — never a silent smaller building, never another code.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const [dir, bodiesArg, mayRefuse] = process.argv.slice(2)
if (!dir || !bodiesArg) {
  process.stderr.write('usage: known-row.mjs <out dir> <bodies> [may-refuse]\n')
  process.exit(2)
}
const read = (name) => JSON.parse(readFileSync(join(dir, name), 'utf8'))
const fail = (message) => {
  process.stdout.write(`::error::${dir}: ${message}\n`)
  process.exit(1)
}
const resolution = read('analysis-trace.json').entries.find((e) => e.substage === 'PLAN_RESOLUTION')?.counts

if (existsSync(join(dir, 'result-summary.json'))) {
  const summary = read('result-summary.json')
  if (summary.masses !== Number(bodiesArg)) fail(`completed with ${summary.masses} bodies; the house has ${bodiesArg}`)
  if (resolution) {
    if (resolution.outcome !== 'RESOLVED') fail(`completed, but the resolution says ${resolution.outcome}`)
    if (resolution.publishedFigure === 'SPENT') fail('chosen by a published figure that had already refused the first reading')
    const residual = Number(resolution.chosenResidualPct)
    if (!Number.isFinite(residual) || Math.abs(residual) > 6) fail(`resolved ${resolution.chosenResidualPct ?? 'without a residual'} % from the published footprint`)
  }
  process.stdout.write(`${dir}: completed, ${summary.masses} bodies${resolution ? `, resolved at ${resolution.chosenResidualPct} % of the published footprint` : ''}\n`)
} else {
  const failure = read('failure.json')
  const code = failure.reasonCode ?? failure.code
  if (mayRefuse !== 'may-refuse') fail(`refused (${code}); this row must complete`)
  if (code !== 'PLAN_RESOLUTION_INCONCLUSIVE') fail(`refused with ${code}, not the resolver's named PLAN_RESOLUTION_INCONCLUSIVE`)
  process.stdout.write(`${dir}: refused by name (${code})\n`)
}
