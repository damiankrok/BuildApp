#!/usr/bin/env node
/**
 * replay.mjs — BUILDPLAN-ANALYZER-005Q matched replays (RESEARCH ONLY; never imported by production).
 *
 *   node research/analyzer-005q/replay.mjs --work /home/user/work005q --label B0 [--config <variant>/vite.config.mjs] [--cases a,b] [--par 2]
 *
 * The 005P replay (research/analyzer-005p/replay.mjs) over the 46 development rows of research/analyzer-005q/cases.json.
 * Every row is re-solved by the solver alone on its sealed package, observation graph and metric evidence
 * (`second-house.ts --package --graph --metrics`): source acquisition, OCR, binding, the metric solution and plan
 * registration are held fixed, so a challenger differs ONLY in its `packages/reconstruction/src` copy, aliased by
 * `--config` (variant.mjs). No `--config` runs the working tree's production module. Outputs (and wall time, peak RSS
 * of the process tree) live outside the repository; plan overlays (publisher-derived pictures) are deleted.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')
const arg = (n, f) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : f
}
const work = resolve(arg('work', '/home/user/work005q'))
if (work.startsWith(REPO)) throw new Error('replays live outside the repository')
const label = arg('label', 'B0')
const config = arg('config', '')
const cases = JSON.parse(readFileSync(join(REPO, 'research/analyzer-005q/cases.json'), 'utf8')).cases
const only = arg('cases', '')
const todo = cases.filter((c) => !only || only.split(',').includes(c.case))
const par = Number(arg('par', '2'))
mkdirSync(join(work, 'runs', label), { recursive: true })

const prune = (out) => {
  for (const d of [out, join(out, 'plan-diagnostics')]) if (existsSync(d)) for (const f of readdirSync(d)) if (f.endsWith('.png')) rmSync(join(d, f), { force: true })
  for (const f of ['metric-evidence.json', 'source-package.json', 'observation-graph.json']) rmSync(join(out, f), { force: true })
  rmSync(join(out, 'evidence-pack'), { recursive: true, force: true })
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
const runOne = (c) =>
  new Promise((done) => {
    const out = join(work, 'runs', label, c.case)
    rmSync(out, { recursive: true, force: true })
    mkdirSync(out, { recursive: true })
    // --solve: the research runner (research/analyzer-005q/solve.ts: the same files plus unresolved.json and provenance.json)
    const runner = process.argv.includes('--solve') ? 'research/analyzer-005q/solve.ts' : 'packages/analysis-service/scripts/second-house.ts'
    const a = ['vite-node', ...(config ? ['--config', config] : []), runner, '--', '--package', c.package, '--graph', c.graph, '--metrics', c.metrics, '--cache', c.cache, '--out', out]
    if (c.dropFrames?.length) a.push('--drop-frames', c.dropFrames.join(','))
    // --probe: an instrumented variant (research only) appends its decisions to <out>/probe.ndjson
    const env = { ...process.env, OFFLINE: '1', ...(process.argv.includes('--probe') ? { PROBE_005Q_FILE: join(out, 'probe.ndjson') } : {}) }
    const t0 = process.hrtime.bigint()
    const child = spawn('npx', a, { cwd: REPO, env })
    let peak = 0
    const timer = setInterval(() => (peak = Math.max(peak, rssOfTree(child.pid))), 200)
    let log = ''
    child.stdout.on('data', (d) => (log += d))
    child.stderr.on('data', (d) => (log += d))
    child.on('close', (code) => {
      clearInterval(timer)
      const wall = Number(process.hrtime.bigint() - t0) / 1e9
      writeFileSync(join(work, 'runs', label, `${c.case}.log`), `${log}\nexit ${code} wall ${wall.toFixed(2)} peakRssKb ${peak} config ${config || 'none'}\n`)
      prune(out)
      process.stdout.write(`${label} ${c.case} exit ${code} ${wall.toFixed(1)} s\n`)
      done()
    })
  })
let next = 0
await Promise.all(Array.from({ length: par }, async () => {
  while (next < todo.length) await runOne(todo[next++])
}))
