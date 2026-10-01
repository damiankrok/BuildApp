/**
 * `npm run -s evidence:diverge -- <pack or run dir A> <pack or run dir B> [--json]`
 *
 * Where two runs part: the first stage, in analyzer order, at which any object's decision differs —
 * the frozen code against a new one, the clean link against the tracked one, evidence ON against
 * OFF. A run directory is packed in memory first.
 */
import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { buildEvidencePack, firstDivergence } from '../src/index.js'
import type { DecisionEvent } from '../src/index.js'
import { readRunDir } from './run-dir.js'

const timelineOf = (dir: string): DecisionEvent[] => {
  const file = join(dir, '18-decision-timeline.json')
  if (existsSync(file)) return (JSON.parse(readFileSync(file, 'utf8')) as { events: DecisionEvent[] }).events
  return buildEvidencePack(readRunDir(dir, basename(dir))).timeline
}
const [a, b, flag] = process.argv.slice(2)
if (!a || !b) {
  process.stderr.write('usage: evidence:diverge -- <pack|run dir A> <pack|run dir B> [--json]\n')
  process.exit(2)
}
const d = firstDivergence(timelineOf(a), timelineOf(b))
if (flag === '--json') process.stdout.write(`${JSON.stringify(d, null, 2)}\n`)
else {
  process.stdout.write(`FIRST_DIVERGENCE = ${d.firstDivergence}\n`)
  if (d.object) process.stdout.write(`object = ${d.object}\nbefore = ${d.before}${d.reasonBefore ? `  (${d.reasonBefore})` : ''}\nafter  = ${d.after}${d.reasonAfter ? `  (${d.reasonAfter})` : ''}\n${d.differing} object(s) differ in that stage; later stages differing: ${d.stagesDiffering.slice(1).join(', ') || 'none'}\n`)
}
