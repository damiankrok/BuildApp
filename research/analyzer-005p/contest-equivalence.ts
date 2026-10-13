/**
 * contest-equivalence.ts — BUILDPLAN-ANALYZER-005P (RESEARCH ONLY): the production contest classifier
 * (`statementContests`, packages/reconstruction/src/statement-contest.ts) against the research policy files
 * (`policy_views.py`, 005O's candidate definitions) on every statement of the 44 development cases.
 *
 *   npx vite-node research/analyzer-005p/contest-equivalence.ts -- --policies /home/user/work005p/policies/P0H
 *
 * Prints the number of statements compared, contested in each, and every disagreement (contested flag or K-set).
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { statementContests } from '../../packages/reconstruction/src/statement-contest.js'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'

const REPO = resolve(import.meta.dirname, '../..')
const i = process.argv.indexOf('--policies')
const dir = resolve(i >= 0 ? process.argv[i + 1] : '/home/user/work005p/policies/P0H')
const cases = JSON.parse(readFileSync(join(REPO, 'research/analyzer-005o/cases.json'), 'utf8')).cases as Array<{ case: string; metrics: string }>
let compared = 0
let contestedTs = 0
let contestedPy = 0
const diffs: string[] = []
for (const c of cases) {
  const m = JSON.parse(readFileSync(c.metrics, 'utf8')) as MetricEvidenceSet
  const policy = JSON.parse(readFileSync(join(dir, `${c.case}.json`), 'utf8')) as { records: Array<{ evidenceId: string; K: number[]; contested: boolean }> }
  const byId = new Map(m.evidence.map((e) => [e.id, e]))
  const tokens = new Map(m.ocrTokens.map((t) => [t.id, t]))
  const contestOf = statementContests(m)
  const seen = new Set<string>()
  for (const r of policy.records) {
    if (seen.has(r.evidenceId)) continue
    seen.add(r.evidenceId)
    const e = byId.get(r.evidenceId)
    if (!e) {
      diffs.push(`${c.case} ${r.evidenceId}: no evidence`)
      continue
    }
    const token = e.ocrTokenIds.length === 1 ? tokens.get(e.ocrTokenIds[0]) : undefined
    const t = contestOf(e, token)
    compared += 1
    if (t.contested) contestedTs += 1
    if (r.contested) contestedPy += 1
    if (t.contested !== r.contested || JSON.stringify(t.values) !== JSON.stringify(r.K)) diffs.push(`${c.case} ${r.evidenceId}: ts ${JSON.stringify(t.values)} ${t.contested} / py ${JSON.stringify(r.K)} ${r.contested}`)
  }
}
process.stdout.write(`${compared} statements compared; contested: production ${contestedTs}, research ${contestedPy}; disagreements ${diffs.length}\n${diffs.slice(0, 20).join('\n')}\n`)
process.exit(diffs.length === 0 ? 0 : 1)
