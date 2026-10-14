#!/usr/bin/env node
/**
 * mutations.mjs — BUILDPLAN-ANALYZER-005Q-CHAIN mutation tests M1-M8 (RESEARCH ONLY; preregistration.md §6 G7).
 *
 *   node research/analyzer-005q-chain/mutations.mjs --work /home/user/work005q-chain [--only M1,M3]
 *
 * Each mutation breaks one rule in a COPY of a challenger (outside the repository) — or, for M7 and M8, in the gate's
 * input or in the repository's research files (a temporary, untracked file, removed afterwards) — and must be KILLED by
 * the named spec test or gate. A mutation that survives is reported as SURVIVED; nothing is retried or relaxed.
 *   M1 self-witness            C1 re-admits CHAIN_CORRECTED anchors            → G2a (scaleDependentAnchors > 0)
 *   M2 changed printed number  C1 states ink + 10 cm                           → G2b (inkFirstMismatch > 0)
 *   M3 duplicate reader        inkOfC1 accepts NOT_CORROBORATING (one reader) → c1.spec
 *   M4 max-p rotation          C3 stops flagging UNDECIDED chains              → G2a′ (scaleOrientedAnchors > 0)
 *   M5 missing as agreement    inkOfC1 accepts CONTESTS (rival readings)      → c1.spec
 *   M6 wrong-span promotion    C2 centring share 0.3 → 1.0                     → c2.spec
 *   M7 known-good switch       one window of a known-good model made a door   → G1
 *   M8 truth / name leakage    a challenger line naming a development row     → research-isolation.test.ts
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')
const arg = (n, f) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : f
}
const W = resolve(arg('work', '/home/user/work005q-chain'))
if (W === REPO || W.startsWith(REPO + '/')) throw new Error('mutation copies live outside the repository')
const only = (arg('only', '') || '').split(',').filter(Boolean)
const R = 'research/analyzer-005q-chain'
const results = []

function copyOf(name, patches, edits) {
  const dir = join(W, 'mut', name)
  execFileSync('node', [`${R}/variant.mjs`, 'setup', '--work', dir, ...patches.flatMap((p) => ['--patch', `${R}/${p}`])], { cwd: REPO })
  for (const [file, from, to] of edits) {
    const p = join(dir, 'packages/source-metrics/src', file)
    const s = readFileSync(p, 'utf8')
    if (!s.includes(from)) throw new Error(`${name}: mutation anchor not found in ${file}`)
    writeFileSync(p, s.replace(from, to))
  }
  return dir
}
const spec = (dir, which) => spawnSync('node', [`${R}/spec/run-spec.mjs`, '--variant', dir, '--spec', which], { cwd: REPO, encoding: 'utf8' }).status
function replay(name, dir, cases) {
  const label = `MUT-${name}`
  execFileSync('node', [`${R}/replay.mjs`, '--work', W, '--label', label, '--config', join(dir, 'vite.config.mjs'), '--cases', cases.join(','), '--par', String(Math.min(3, cases.length))], {
    cwd: REPO,
    env: { ...process.env, ACCEL_005Q_CHAIN_DIR: join(W, 'accel-memo') },
    stdio: 'inherit',
  })
  const out = join(W, `score-${label}.json`)
  execFileSync('python3', ['-I', `${R}/score_houses.py`, '--runs', join(W, 'runs'), '--label', label, '--out', out], { cwd: REPO, stdio: ['ignore', 'ignore', 'inherit'] })
  return JSON.parse(readFileSync(out, 'utf8')).rows.filter((r) => cases.includes(r.case))
}
const record = (id, killedBy, killed, detail) => {
  results.push({ id, killedBy, outcome: killed ? 'KILLED' : 'SURVIVED', detail })
  process.stdout.write(`${id} ${killed ? 'KILLED' : 'SURVIVED'} by ${killedBy}: ${JSON.stringify(detail)}\n`)
}
const want = (id) => only.length === 0 || only.includes(id)

if (want('M1')) {
  const d = copyOf('M1', ['ACCEL.patch', 'candidates/C1.patch'], [['extract.ts', "if (statedOrigin === 'READ' && !orientation?.dependsOnScale && segment.confidence > 0) {", "if (segment.origin !== 'DERIVED' && segment.confidence > 0) {"]])
  const rows = replay('M1', d, ['dom-w-gozdzikowcach', 'dom-w-glogownikach'])
  const n = rows.reduce((a, r) => a + (r.evidenceGates?.scaleDependentAnchors ?? 0), 0)
  record('M1', 'G2a', n > 0, { scaleDependentAnchors: n })
}
if (want('M2')) {
  const d = copyOf('M2', ['ACCEL.patch', 'candidates/C1.patch'], [['extract.ts', 'const statedCm = ink ? ink.valueCm : segment.valueCm', 'const statedCm = ink ? ink.valueCm + 10 : segment.valueCm']])
  const rows = replay('M2', d, ['dom-w-gozdzikowcach', 'dom-w-glogownikach'])
  const n = rows.reduce((a, r) => a + (r.evidenceGates?.inkFirstMismatch ?? 0), 0)
  record('M2', 'G2b', n > 0, { inkFirstMismatch: n })
}
if (want('M3')) {
  const d = copyOf('M3', ['ACCEL.patch', 'candidates/C1.patch'], [['extract.ts', "if (e.decision !== 'AGREES' && e.decision !== 'LEADS') return undefined", "if (e.decision !== 'AGREES' && e.decision !== 'LEADS' && e.decision !== 'NOT_CORROBORATING') return undefined"]])
  const status = spec(d, 'c1')
  record('M3', 'c1.spec', status !== 0, { specExit: status })
}
if (want('M4')) {
  const d = copyOf('M4', ['ACCEL.patch', 'candidates/C3.patch'], [['metric-solution.ts', "|| (chain.axis === 'VERTICAL' && choices[c].decidedBy === 'UNDECIDED')", '']])
  const rows = replay('M4', d, ['dom-pod-jarzabem'])
  const n = rows.reduce((a, r) => a + (r.evidenceGates?.scaleOrientedAnchors ?? 0), 0)
  record('M4', "G2a'", n > 0, { scaleOrientedAnchors: n })
}
if (want('M5')) {
  const d = copyOf('M5', ['ACCEL.patch', 'candidates/C1.patch'], [['extract.ts', "if (e.decision !== 'AGREES' && e.decision !== 'LEADS') return undefined", "if (e.decision !== 'AGREES' && e.decision !== 'LEADS' && e.decision !== 'CONTESTS') return undefined"]])
  const status = spec(d, 'c1')
  record('M5', 'c1.spec', status !== 0, { specExit: status })
}
if (want('M6')) {
  const d = copyOf('M6', ['ACCEL.patch', 'candidates/C2.patch'], [['chains.ts', 'export const C2_BOUNDS = { centred: 0.3, maxSkipped: 2 } as const', 'export const C2_BOUNDS = { centred: 1.0, maxSkipped: 2 } as const']])
  const status = spec(d, 'c2')
  record('M6', 'c2.spec', status !== 0, { specExit: status })
}
if (want('M7')) {
  const base = JSON.parse(readFileSync(join(W, 'score-C0.json'), 'utf8'))
  const mutated = JSON.parse(JSON.stringify(base))
  mutated.label = 'MUT-M7'
  const row = mutated.rows.find((r) => r.verdict === 'PASS' && r.model?.openings?.some((o) => o.startsWith('WINDOW:')))
  const i = row.model.openings.findIndex((o) => o.startsWith('WINDOW:'))
  row.model.openings[i] = row.model.openings[i].replace(/^WINDOW:/, 'DOOR:')
  row.model.openings.sort()
  mkdirSync(join(W, 'mut'), { recursive: true })
  const p = join(W, 'mut', 'M7-score.json')
  writeFileSync(p, JSON.stringify(mutated))
  const out = join(W, 'mut', 'M7-gates.json')
  execFileSync('python3', ['-I', `${R}/gates.py`, '--baseline', join(W, 'score-C0.json'), '--variant', p, '--out', out], { cwd: REPO, stdio: 'ignore' })
  const g = JSON.parse(readFileSync(out, 'utf8'))
  record('M7', 'G1', !g.G1.pass && g.G1.failures.some((f) => f.case === row.case), { row: row.case, g1Failures: g.G1.failures.length })
}
if (want('M8')) {
  const leak = join(REPO, R, 'candidates', 'ZZ-mutation-M8.patch')
  const c1 = readFileSync(join(REPO, R, 'candidates', 'C1.patch'), 'utf8')
  writeFileSync(leak, c1.replace("+// 005Q-CHAIN C1 INK-FIRST (research only).", "+// 005Q-CHAIN C1 INK-FIRST (research only). if (frame.assetId.includes('marcowki')) prefer the 1260 reading"))
  let status
  try {
    status = spawnSync('npx', ['vitest', 'run', 'tests/architecture/research-isolation.test.ts', '-t', '005Q-CHAIN'], { cwd: REPO, encoding: 'utf8' }).status
  } finally {
    rmSync(leak, { force: true })
  }
  record('M8', 'research-isolation.test.ts', status !== 0, { testExit: status })
}
mkdirSync(join(W, 'mut'), { recursive: true })
// results of earlier invocations (--only) are kept; a mutation run again replaces its own entry
const file = join(W, 'mut', 'results.json')
const kept = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).results.filter((r) => !results.some((x) => x.id === r.id)) : []
const all = [...kept, ...results].sort((a, b) => a.id.localeCompare(b.id))
writeFileSync(file, JSON.stringify({ schema: 'buildapp.005q-chain.mutations', version: 1, results: all }, null, 1) + '\n')
process.stdout.write(`${all.filter((r) => r.outcome === 'KILLED').length}/${all.length} killed\n`)
