#!/usr/bin/env node
/**
 * replay.mjs — BUILDPLAN-ANALYZER-005P matched replays (005O replay.mjs with the 005P consumer-scoped harness) (RESEARCH ONLY; never imported by production).
 *
 *   node research/analyzer-005p/replay.mjs --work /home/user/work005p --label P0 [--policies <dir>] [--cases a,b] [--par 2] [--frozen]
 *
 * Every case of `cases.json` is re-solved by the solver alone on its sealed package, observation graph and metric
 * evidence (`second-house.ts --package --graph --metrics`): OCR, binding and metric solution are held fixed, so the
 * challengers differ ONLY in the consumer-scoped policy handed to plan resolution (consumer-harness.mjs). `--policies <dir>`
 * gives `<dir>/<case>.json` per case (absent file = no view = the frozen behaviour). `--frozen` runs the unpatched
 * production module (no Vite alias) - the M0 reference the harness's no-view control is compared with.
 * Outputs (and wall time, peak RSS of the process tree) live outside the repository; plan overlays are deleted.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')
const arg = (n, f) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : f
}
const work = resolve(arg('work', '/home/user/work005p'))
const label = arg('label', 'M0')
const views = arg('policies', '')
const frozen = process.argv.includes('--frozen')
const cases = JSON.parse(readFileSync(join(REPO, 'research/analyzer-005o/cases.json'), 'utf8')).cases
const only = arg('cases', '')
const todo = cases.filter((c) => !only || only.split(',').includes(c.case))
const par = Number(arg('par', '2'))
mkdirSync(join(work, 'runs', label), { recursive: true })

// overlays (publisher-derived pictures) go, and so do the run's copies of its sealed inputs (up to 6 MB each, byte-identical
// to the case's own files, which the scorer reads instead)
const prune = (out) => {
  for (const d of [out, join(out, 'plan-diagnostics')]) if (existsSync(d)) for (const f of readdirSync(d)) if (f.endsWith('.png')) rmSync(join(d, f), { force: true })
  for (const f of ['metric-evidence.json', 'source-package.json', 'observation-graph.json']) rmSync(join(out, f), { force: true })
}
const rssOfTree = (pid) => {
  // peak sampled RSS (kB) of the process and its descendants, from /proc
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
    const a = ['vite-node', ...(frozen ? [] : ['--config', join(work, 'harness/vite.config.mjs')]), 'packages/analysis-service/scripts/second-house.ts', '--', '--package', c.package, '--graph', c.graph, '--metrics', c.metrics, '--cache', c.cache, '--out', out]
    if (c.dropFrames?.length) a.push('--drop-frames', c.dropFrames.join(','))
    const view = views ? join(views, `${c.case}.json`) : ''
    const env = { ...process.env, OFFLINE: '1', ...(view && existsSync(view) ? { AS_PRINTED_POLICY_005P: view } : {}) }
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
      writeFileSync(join(work, 'runs', label, `${c.case}.log`), `${log}\nexit ${code} wall ${wall.toFixed(2)} peakRssKb ${peak} view ${env.AS_PRINTED_POLICY_005P ?? 'none'}\n`)
      prune(out)
      process.stdout.write(`${label} ${c.case} exit ${code} ${wall.toFixed(1)} s\n`)
      done()
    })
  })
let next = 0
await Promise.all(Array.from({ length: par }, async () => {
  while (next < todo.length) await runOne(todo[next++])
}))
