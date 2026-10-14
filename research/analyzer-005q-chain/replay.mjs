#!/usr/bin/env node
/**
 * replay.mjs — BUILDPLAN-ANALYZER-005Q-CHAIN end-to-end development replays (RESEARCH ONLY; never imported by production).
 *
 *   node research/analyzer-005q-chain/replay.mjs --work /home/user/work005q-chain --label C0 \
 *        [--config <variant>/vite.config.mjs] [--cases a,b] [--par 3] [--order given|reverse|rotate:<k>]
 *
 * Unlike 005Q (solver only on sealed metric evidence), every EXTRACT row of research/analyzer-005q-chain/cases.json
 * goes through the source-metrics pass again, so a challenger in `packages/source-metrics/src` reaches the model:
 *
 *   1. extract  `second-house.ts --package --graph --cache --recogniser` (OFFLINE=1): the production pipeline on the
 *               row's sealed source package and observation graph, the publisher bytes from the sealed cache, the
 *               deployed PP-OCRv6 recogniser in its worker, as the phone runs it. Kept: metric-evidence.json (gzip),
 *               result-summary.json | failure.json, analysis-trace.json, model.json, performance.json.
 *   2. solve    `research/analyzer-005q/solve.ts --metrics <the fresh evidence>` (+ the row's --drop-frames): the solver
 *               alone on that evidence, writing the 005Q research sidecars (unresolved.json, provenance.json) the
 *               scorer reads. For a row without dropped frames its model must equal step 1's (checked by the scorer).
 *
 * SOLVE_ONLY_LEGACY rows (sealed legacy evidence is their input) run step 2 alone on the sealed evidence.
 * With --config both steps resolve `@buildapp/source-metrics` and `@buildapp/reconstruction` to the variant copy.
 * Outputs (and wall time, peak RSS of the process tree) live outside the repository; plan overlays, scene sheets,
 * evidence packs and copies of the inputs (publisher-derived) are deleted.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')
const arg = (n, f) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : f
}
const work = resolve(arg('work', '/home/user/work005q-chain'))
if (work === REPO || work.startsWith(REPO + '/')) throw new Error('replays live outside the repository')
const label = arg('label', 'C0')
const config = arg('config', '')
const cases = JSON.parse(readFileSync(join(REPO, 'research/analyzer-005q-chain/cases.json'), 'utf8')).cases
const only = arg('cases', '')
let todo = cases.filter((c) => !only || only.split(',').includes(c.case))
const order = arg('order', 'given')
if (order === 'reverse') todo = [...todo].reverse()
else if (order.startsWith('rotate:')) {
  const k = Number(order.slice(7)) % todo.length
  todo = [...todo.slice(k), ...todo.slice(0, k)]
}
const par = Number(arg('par', '3'))
mkdirSync(join(work, 'runs', label), { recursive: true })

const prune = (out) => {
  for (const d of [out, join(out, 'plan-diagnostics')]) if (existsSync(d)) for (const f of readdirSync(d)) if (f.endsWith('.png')) rmSync(join(d, f), { force: true })
  for (const f of ['source-package.json', 'observation-graph.json', 'source-hashes.json', 'telemetry.ndjson', 'evidence-performance.json']) rmSync(join(out, f), { force: true })
  rmSync(join(out, 'evidence-pack'), { recursive: true, force: true })
  const me = join(out, 'metric-evidence.json')
  if (existsSync(me)) {
    writeFileSync(`${me}.gz`, gzipSync(readFileSync(me), { level: 9 }))
    rmSync(me)
  }
}
const rssOfTree = (pid) => {
  let total = 0
  const walk = (p) => {
    try {
      const st = readFileSync(`/proc/${p}/status`, 'utf8')
      total += Number(/VmRSS:\s+(\d+)/.exec(st)?.[1] ?? 0)
      for (const t of readdirSync(`/proc/${p}/task`)) {
        const ch = readFileSync(`/proc/${p}/task/${t}/children`, 'utf8').trim()
        for (const c of ch ? ch.split(/\s+/) : []) walk(c)
      }
    } catch {
      /* the process ended between two reads: its RSS is no longer held */
    }
  }
  walk(pid)
  return total
}
const step = (name, args, logFile) =>
  new Promise((done) => {
    const t0 = process.hrtime.bigint()
    const child = spawn('npx', ['vite-node', ...(config ? ['--config', config] : []), ...args], { cwd: REPO, env: { ...process.env, OFFLINE: '1' } })
    let peak = 0
    const timer = setInterval(() => (peak = Math.max(peak, rssOfTree(child.pid))), 250)
    let log = ''
    child.stdout.on('data', (d) => (log += d))
    child.stderr.on('data', (d) => (log += d))
    child.on('close', (code) => {
      clearInterval(timer)
      const wall = Number(process.hrtime.bigint() - t0) / 1e9
      writeFileSync(logFile, `${log}\nexit ${code} wall ${wall.toFixed(2)} peakRssKb ${peak} config ${config || 'none'} step ${name}\n`)
      done({ code, wall, peak })
    })
  })

const runOne = async (c) => {
  const base = join(work, 'runs', label, c.case)
  rmSync(base, { recursive: true, force: true })
  mkdirSync(base, { recursive: true })
  const res = { case: c.case, mode: c.mode }
  let metrics = c.metrics
  if (c.mode === 'EXTRACT') {
    const out = join(base, 'extract')
    const r = await step('extract', ['packages/analysis-service/scripts/second-house.ts', '--', '--package', c.package, '--graph', c.graph, '--cache', c.cache, '--out', out, '--recogniser'], join(base, 'extract.log'))
    res.extract = r
    metrics = join(out, 'metric-evidence.json')
    if (!existsSync(metrics)) {
      prune(out)
      res.solve = { skipped: 'no metric evidence was produced' }
      writeFileSync(join(base, 'replay.json'), JSON.stringify(res, null, 1) + '\n')
      return res
    }
  }
  const sout = join(base, 'solve')
  const a = ['research/analyzer-005q/solve.ts', '--', '--package', c.package, '--graph', c.graph, '--metrics', metrics, '--cache', c.cache, '--out', sout]
  if (c.dropFrames?.length) a.push('--drop-frames', c.dropFrames.join(','))
  res.solve = await step('solve', a, join(base, 'solve.log'))
  if (c.mode === 'EXTRACT') prune(join(base, 'extract'))
  prune(sout)
  rmSync(join(sout, 'metric-evidence.json.gz'), { force: true })
  writeFileSync(join(base, 'replay.json'), JSON.stringify(res, null, 1) + '\n')
  process.stdout.write(`${label} ${c.case} extract ${res.extract?.code ?? '-'} ${res.extract ? res.extract.wall.toFixed(1) : '-'} s solve ${res.solve.code} ${res.solve.wall.toFixed(1)} s\n`)
  return res
}
let next = 0
await Promise.all(
  Array.from({ length: par }, async () => {
    while (next < todo.length) await runOne(todo[next++])
  }),
)
writeFileSync(join(work, 'runs', `${label}.done`), `${todo.length} rows, order ${order}, par ${par}, config ${config || 'none'}\n`)
