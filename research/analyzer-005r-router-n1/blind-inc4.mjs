#!/usr/bin/env node
/**
 * blind.mjs — BUILDPLAN-ANALYZER-005R-ROUTER-N1-ADOPT BLIND_13, one drawn house (RESEARCH ONLY; never imported by
 * production). Preregistration §8.
 *
 *   node research/analyzer-005r-router-n1/blind.mjs --url <drawn ARCHON address> --house <h1|h2> --work <dir outside repo>
 *
 * 1. Acquire once, live, with the FROZEN code (production `second-house.ts --recogniser`, cache and output outside Git).
 * 2. R0: `run-case.ts` through a variant of the base revision with no patch (the incumbent), on the sealed package and
 *    the same byte cache. N1v: `run-case.ts` with no alias (the frozen tree carries the patch).
 * 3. `ledger.ts` on both when the R0 solver solves at least one camera.
 * 4. `compare_n1.py predicates` and `p8_n1.py`; coverage; a sealed per-house verdict (ids, counts, hashes only).
 * Refuses unless the tree is clean and HEAD equals the drawn SHA recorded in holdout/LEDGER.ndjson.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'

const REPO = '/home/user/BuildApp'  // INC-4: run from outside the repository, HEAD stays the drawn SHA
const BASE = '0f2c347c0be03a32510f1e54460eab6fdf1b65a5'
const arg = (n) => { const i = process.argv.indexOf(`--${n}`); if (i < 0) throw new Error(`--${n} is required`); return process.argv[i + 1] }
const url = arg('url'), house = arg('house'), work = resolve(arg('work'))
if (work.startsWith(REPO)) throw new Error('blind outputs live outside the repository')
if (!/^h[12]$/.test(house)) throw new Error('house is h1 or h2')
const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' }).trim()
const head = git('rev-parse', 'HEAD')
// the draw appends to holdout/LEDGER.ndjson, committed with the run evidence (holdout/README.md T3): nothing else may differ
if (execFileSync('git', ['status', '--porcelain', '-z'], { cwd: REPO, encoding: 'utf8' }).split('\0').filter((l) => l && l.slice(3) !== 'holdout/LEDGER.ndjson').length) throw new Error('REFUSED: the tree is not clean')
const draw = readFileSync(join(REPO, 'holdout/LEDGER.ndjson'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((d) => d.label === 'BUILDPLAN-005R-ROUTER-N1-ADOPT-HOLDOUT')
if (!draw || !draw.urls.includes(url)) throw new Error('REFUSED: the address is not a round-13 draw')
if (draw.preHoldoutSha !== head) throw new Error(`REFUSED: HEAD ${head} is not the drawn SHA ${draw.preHoldoutSha}`)
// Review R-B #1 (addendum C): the harness the blind relies on is pinned to the hashes recorded before the freeze;
// a house runs exactly once (an existing house directory is refused, never resumed or overwritten); any step that
// exits non-zero stops the run fail-closed.
const PINS = {"compare_n1.py": "8bcb3c08d331bd91fd5a46b60b87ff282f5f8792a29fb081b91d7126ffa03ddb", "p8_n1.py": "cf6765076c31dda89003f49f0445c59d6e00272711021c0c90cedbbc749ca035", "run-case.ts": "cc8203f31f13c0e9c72fab1528d15c0c50c4073e04923cc55e5d6b365edffdbb", "ledger.ts": "a5a4cfe9f00f87a522f8b0d953aa42ace62719d5e1c65e1fa8a3bdd698b1c032", "variant.mjs": "d29313ccd5bfa5e9c30469783ad7118569a34182a43e36087c057683d137fe80"}
for (const [f, want] of Object.entries(PINS)) {
  const got = createHash('sha256').update(readFileSync(join(REPO, 'research/analyzer-005r-router-n1', f))).digest('hex')
  if (got !== want) throw new Error(`REFUSED: ${f} is ${got}, pinned ${want}`)
}
const dir = join(work, house)
if (existsSync(dir)) throw new Error(`REFUSED: ${dir} exists; a blind house runs once and is never resumed or overwritten`)
const cache = join(dir, 'cache'), acq = join(dir, 'acquire'), runs = join(dir, 'runs'), led = join(dir, 'ledger')
for (const d of [cache, acq, runs, led]) mkdirSync(d, { recursive: true })
const sh = (cmd, args, env = {}) => {
  const r = spawnSync(cmd, args, { cwd: REPO, encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 1 << 28 })
  if (r.status !== 0) throw new Error(`STOPPED fail-closed: ${cmd} ${args.slice(0, 3).join(' ')} exited ${r.status}\n${String(r.stderr).slice(-2000)}`)
  return { code: r.status, out: `${r.stdout}\n${r.stderr}` }
}
const log = []
// 1. acquisition (live, once)
if (!existsSync(join(acq, 'source-package.json'))) {
  const r = sh('npx', ['vite-node', 'packages/analysis-service/scripts/second-house.ts', '--', '--url', url, '--cache', cache, '--out', acq, '--recogniser'])
  log.push({ step: 'acquire', code: r.code, tail: r.out.split('\n').filter((l) => /completed|failed|refused|error/i.test(l)).slice(-5) })
}
if (!existsSync(join(acq, 'source-package.json'))) throw new Error(`acquisition produced no sealed package: ${JSON.stringify(log)}`)
// 2. R0 (variant at the base, unpatched) and N1v (frozen tree)
const variantR0 = join(work, 'variant-R0')
if (!existsSync(join(variantR0, 'vite.config.mjs'))) sh('node', ['research/analyzer-005r-router-n1/variant.mjs', 'setup', '--work', variantR0, '--rev', BASE])
for (const [label, config] of [['R0', join(variantR0, 'vite.config.mjs')], ['N1v', null]]) {
  const out = join(runs, label)
  if (existsSync(join(out, 'model.json')) || existsSync(join(out, 'failure.json'))) continue
  mkdirSync(out, { recursive: true })
  const r = sh('npx', ['vite-node', ...(config ? ['--config', config] : []), 'research/analyzer-005r-router-n1/run-case.ts', '--', '--package', join(acq, 'source-package.json'), '--cache', cache, '--out', out], { OFFLINE: '1' })
  writeFileSync(join(out, 'run.log'), r.out)
  log.push({ step: `run ${label}`, code: r.code })
}
// 3. ledger when R0 solves a camera
const graphOf = (label) => JSON.parse(gunzipSync(readFileSync(join(runs, label, 'observation-graph.json.gz'))).toString('utf8'))
let ledger = 'NOT_EXERCISED'
if (existsSync(join(runs, 'R0', 'metric-evidence.json.gz')) && existsSync(join(runs, 'N1v', 'metric-evidence.json.gz'))) {
  for (const [label, config] of [['R0', join(variantR0, 'vite.config.mjs')], ['N1v', null]]) {
    const f = join(led, `${label}-${house}.json.gz`)
    if (!existsSync(f)) log.push({ step: `ledger ${label}`, ...sh('npx', ['vite-node', ...(config ? ['--config', config] : []), 'research/analyzer-005r-router-n1/ledger.ts', '--', '--package', join(acq, 'source-package.json'), '--cache', cache, '--run', join(runs, label), '--out', f]) })
  }
  const r0 = JSON.parse(gunzipSync(readFileSync(join(led, `R0-${house}.json.gz`))).toString('utf8'))
  ledger = r0.cameras.some((c) => c.solved) ? 'EXERCISED' : 'NOT_EXERCISED'
}
// 4. predicates
const cmpOut = join(dir, 'compare.json'), p8Out = join(dir, 'p8.json')
mkdirSync(join(dir, 'cmpA', house), { recursive: true }); mkdirSync(join(dir, 'cmpB', house), { recursive: true })
for (const [side, label] of [['cmpA', 'R0'], ['cmpB', 'N1v']]) sh('sh', ['-c', `cp -a '${join(runs, label)}/.' '${join(dir, side, house)}/'`])
sh('python3', ['-I', 'research/analyzer-005r-router-n1/compare_n1.py', 'predicates', join(dir, 'cmpA'), join(dir, 'cmpB'), cmpOut])
const cmp = JSON.parse(readFileSync(cmpOut, 'utf8')).perRow[house]
let p8 = null
if (ledger === 'EXERCISED') {
  const p8dir = join(dir, 'p8chal'); mkdirSync(p8dir, { recursive: true })
  sh('sh', ['-c', `cp '${join(led, `N1v-${house}.json.gz`)}' '${p8dir}/' && mkdir -p '${join(dir, 'p8base')}' && cp '${join(led, `R0-${house}.json.gz`)}' '${join(dir, 'p8base')}/'`])
  sh('python3', ['-I', 'research/analyzer-005r-router-n1/p8_n1.py', join(dir, 'p8base'), p8dir, p8Out])
  p8 = JSON.parse(readFileSync(p8Out, 'utf8')).perRow[house]
}
const g0 = graphOf('R0')
const refused = g0.coordinateFrames.filter((f) => f.roles.document === 'PERSPECTIVE_RENDER' && f.roles.projection !== 'ORTHOGRAPHIC_ELEVATION').length
const isModel = cmp.outcome === 'MODEL'
const applicable = { P1: cmp.P1, P2: cmp.P2, P4prime: cmp.P4prime, ...(isModel ? { P3: cmp.P3, P5prime: cmp.P5prime, P6: cmp.P6 } : {}), ...(p8 ? { P8: p8.P8 } : {}) }
const exercised = refused > 0
const verdict = !exercised ? 'TARGET_NOT_EXERCISED' : Object.values(applicable).every((v) => v === true) ? 'PASS' : 'FAIL'
const sealed = { schema: 'research.005r-router-n1.blind.1', house, url, head, drawnSha: draw.preHoldoutSha, outcome: cmp.outcome, refusedPerspectiveFrames: refused,
  elevationFrames: g0.coordinateFrames.filter((f) => f.roles.document === 'ELEVATION').length, ledger, applicable, verdict,
  notMeasured: isModel ? [] : ['P3 (typed refusal keeps no metric content)', 'P5prime', 'P6'],
  graph: cmp.graph ? { typed: cmp.graph.typed, unexpectedCount: cmp.graph.unexpectedCount, removedByKind: cmp.graph.removedByKind } : null,
  p8: p8 ? { camerasSolved: p8.camerasSolved, removedByDisposition: p8.removedByDisposition, added: p8.added } : null, log }
writeFileSync(join(dir, 'verdict.json'), JSON.stringify(sealed, null, 1) + '\n')
process.stdout.write(`${house} ${verdict} ${JSON.stringify(applicable)} refused=${refused} ledger=${ledger}\n`)
