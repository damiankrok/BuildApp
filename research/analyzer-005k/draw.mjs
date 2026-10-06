#!/usr/bin/env node
/**
 * draw.mjs — BUILDPLAN-ANALYZER-005K fresh-sheet gap set: the draw by lot (RESEARCH ONLY).
 *
 *   node research/analyzer-005k/draw.mjs --freeze-sha <40hex> --exclusions <gap-set-exclusion-manifest.json> --ledger <ndjson>
 *
 * Fixed before the draw (gap-set-protocol.md):
 *   - seed = SHA256(FREEZE_SHA + "BUILDPLAN-005K-FRESH-GAP-SET"), FREEZE_SHA the pushed commit of the frozen pre-rule
 *     analyzer; refused unless HEAD == FREEZE_SHA and the tree is clean;
 *   - ARCHON: 8 projects from holdout/pool.txt, DobreDomy: 6 from holdout/pool-dobredomy.txt, each pool less the
 *     families of the exclusion manifest, one project per family; the k-th pick of a pool is
 *     SHA256(seed + ":<publisher>:" + k) mod (what is still drawable), in pool order;
 *   - a DobreDomy pick is kept only when its page publishes technical material (`ddEligible`, as round 3 read it: a
 *     floor-plan section and an elevation section with an image each); an ineligible pick is recorded and burned, and
 *     the draw goes on with the next k. Nothing about an ARCHON page is read before the analyzer runs.
 *   - every pick, kept or burned, is appended to the ledger.
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ddEligible, ddFamily, family } from '../../holdout/select.mjs'

const REPO = resolve(import.meta.dirname, '../..')
const LABEL = 'BUILDPLAN-005K-FRESH-GAP-SET'
const COUNTS = { archon: 8, dobredomy: 6 }
const MAX_DD_DRAWS = 30
const sha256 = (s) => createHash('sha256').update(s).digest('hex')
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const freeze = arg('freeze-sha') ?? ''
if (!/^[0-9a-f]{40}$/.test(freeze)) throw new Error('--freeze-sha must be 40 lowercase hex')
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim()
if (head !== freeze) throw new Error(`HEAD ${head} is not the frozen commit ${freeze}`)
if (execFileSync('git', ['status', '--porcelain'], { cwd: REPO, encoding: 'utf8' }).trim() !== '') throw new Error('the tree is not clean')
const exclusions = JSON.parse(readFileSync(resolve(arg('exclusions') ?? 'stage-reports/artifacts/analyzer-005k/gap-set-exclusion-manifest.json'), 'utf8'))
const ledger = resolve(arg('ledger') ?? '/home/user/work005k/gapset/draw-ledger.ndjson')
const seed = sha256(freeze + LABEL)

const ARCHON_URL = /^https:\/\/www\.archon\.pl\/projekty-domow\/(projekt-[a-z0-9-]+)-(m[0-9a-f]{13})$/
const DD_URL = /^https:\/\/www\.dobredomy\.pl\/projekt\/([A-Za-z][A-Za-z0-9]*)\/$/
const pools = {
  archon: { file: 'holdout/pool.txt', familyOf: (u) => family(ARCHON_URL.exec(u)[1]), excluded: new Set(exclusions.archon.list) },
  dobredomy: { file: 'holdout/pool-dobredomy.txt', familyOf: (u) => ddFamily(DD_URL.exec(u)[1]), excluded: new Set(exclusions.dobredomy.list) },
}

const record = (entry) => appendFileSync(ledger, `${JSON.stringify({ at: new Date().toISOString(), label: LABEL, freezeSha: freeze, seed, exclusionsSha256: { archon: exclusions.archon.sha256, dobredomy: exclusions.dobredomy.sha256 }, ...entry })}\n`)

for (const [publisher, pool] of Object.entries(pools)) {
  const text = readFileSync(join(REPO, pool.file), 'utf8')
  const urls = text.split('\n').filter(Boolean)
  const drawn = new Set()
  let kept = 0
  for (let k = 0; kept < COUNTS[publisher]; k += 1) {
    if (publisher === 'dobredomy' && k >= MAX_DD_DRAWS) throw new Error('too many ineligible DobreDomy draws')
    const drawable = urls.filter((u) => !pool.excluded.has(pool.familyOf(u)) && !drawn.has(pool.familyOf(u)))
    const index = Number(BigInt(`0x${sha256(`${seed}:${publisher}:${k}`)}`) % BigInt(drawable.length))
    const url = drawable[index]
    drawn.add(pool.familyOf(url))
    let eligible = { eligible: true }
    if (publisher === 'dobredomy') eligible = ddEligible(await (await fetch(url)).text())
    record({ publisher, k, poolSha256: sha256(text), drawable: drawable.length, index, url, family: pool.familyOf(url), eligible: eligible.eligible, ...(publisher === 'dobredomy' ? { plans: eligible.plans, elevations: eligible.elevations } : {}) })
    process.stdout.write(`${publisher} k=${k} ${eligible.eligible ? 'KEPT' : 'BURNED'} ${url}\n`)
    if (eligible.eligible) kept += 1
  }
}
