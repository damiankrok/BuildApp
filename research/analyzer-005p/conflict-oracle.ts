/**
 * conflict-oracle.ts — BUILDPLAN-ANALYZER-005P (RESEARCH ONLY): the INCUMBENT source-conflict test (plan resolver 1.4.0,
 * `5906afa`) run on the statement-contest suite's seeded plans, frozen as the oracle that suite's monotonicity test holds
 * 1.5.0 to. The incumbent is the start revision's own file (`old-resolver.mjs setup` exports it outside the repository),
 * so a regression shared by 1.5.0's two modes cannot hide behind them (005P review finding C2).
 *
 *   node research/analyzer-005p/old-resolver.mjs setup --work /home/user/work005p/old-5906afa
 *   npx vite-node research/analyzer-005p/conflict-oracle.ts -- --old /home/user/work005p/old-5906afa \
 *       --out packages/reconstruction/test/fixtures/conflict-oracle-1.4.0.json
 */
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { FRAME, JUDGE, REG, generatePlans, metricsOfPlan } from '../../packages/reconstruction/test/contest-fixtures.js'
import { WALL } from '../../packages/reconstruction/test/plan.js'

const arg = (n: string, f: string): string => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : f
}
const old = resolve(arg('old', '/home/user/work005p/old-5906afa'))
const out = resolve(arg('out', 'packages/reconstruction/test/fixtures/conflict-oracle-1.4.0.json'))
const SEED = 5050
const COUNT = 2000

const mod = (await import(pathToFileURL(join(old, 'packages/reconstruction/src/plan-resolution.ts')).href)) as {
  PLAN_RESOLVER_VERSION: string
  sourceConflictOf: (...a: unknown[]) => { triggers: string[]; why: string; evidenceIds: string[]; registrationRefuted: number; alternatives: unknown[] } | null
}
if (mod.PLAN_RESOLVER_VERSION !== '1.4.0') throw new Error(`the oracle must be the incumbent 1.4.0, not ${mod.PLAN_RESOLVER_VERSION}`)
const plans = generatePlans(SEED, COUNT)
const plansSha256 = createHash('sha256').update(JSON.stringify(plans)).digest('hex')
const results = plans.map((p) => {
  const c = mod.sourceConflictOf(metricsOfPlan(p), FRAME, REG, JUDGE, WALL)
  return c ? { triggers: c.triggers, why: c.why, evidenceIds: c.evidenceIds, registrationRefuted: c.registrationRefuted, alternatives: c.alternatives } : null
})
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, `${JSON.stringify({ oracle: 'plan resolver 1.4.0 sourceConflictOf (5906afa)', seed: SEED, count: COUNT, plansSha256, withConflict: results.filter(Boolean).length, results })}\n`)
process.stdout.write(`${COUNT} plans (sha ${plansSha256.slice(0, 12)}), ${results.filter(Boolean).length} with a 1.4.0 conflict -> ${out}\n`)
