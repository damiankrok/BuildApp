#!/usr/bin/env node
/**
 * perf.mjs — BUILDPLAN-ANALYZER-005P interleaved old/new replay timing (RESEARCH ONLY; never imported by production).
 *
 *   node research/analyzer-005p/old-resolver.mjs setup --work /home/user/work005p/old-5906afa
 *   node research/analyzer-005p/perf.mjs --work /home/user/work005p --old /home/user/work005p/old-5906afa [--reps 2] \
 *       --out stage-reports/artifacts/analyzer-005p/performance.json
 *
 * Every case of `cases.json` is re-solved by the solver alone on its sealed inputs (`second-house.ts --package --graph
 * --metrics`), once with the incumbent plan resolution (5906afa's `packages/reconstruction/src`, aliased) and once with
 * HEAD's (aliased the same way, so both runs take the identical Vite path), one process at a time, in ABBA order per
 * repetition (OLD NEW, then NEW OLD) so a drift of the machine falls on both sides equally. Wall time and peak sampled
 * RSS of the process tree are recorded; outputs are written outside the repository and only their timings are kept.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { cpus, totalmem } from 'node:os'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')
const arg = (n, f) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : f
}
const work = resolve(arg('work', '/home/user/work005p'))
const old = resolve(arg('old', join(work, 'old-5906afa')))
const reps = Number(arg('reps', '2'))
const out = resolve(arg('out', 'stage-reports/artifacts/analyzer-005p/performance.json'))
const cases = JSON.parse(readFileSync(join(REPO, 'research/analyzer-005o/cases.json'), 'utf8')).cases

// HEAD through the same alias mechanism as the incumbent
const newDir = join(work, 'perf-new')
mkdirSync(newDir, { recursive: true })
const pk = (p) => join(REPO, 'packages', p, 'src/index.ts')
writeFileSync(
  join(newDir, 'vite.config.mjs'),
  `export default { resolve: { alias: [\n  { find: /^@buildapp\\/reconstruction$/, replacement: '${pk('reconstruction')}' },\n  { find: /^@buildapp\\/source-common$/, replacement: '${pk('source-common')}' },\n  { find: /^@buildapp\\/source-cv$/, replacement: '${pk('source-cv')}' },\n  { find: /^@buildapp\\/source-metrics$/, replacement: '${pk('source-metrics')}' },\n] } }\n`,
)
const configs = { OLD: join(old, 'vite.config.mjs'), NEW: join(newDir, 'vite.config.mjs') }

const rssOfTree = (pid) => {
  let total = 0
  const walk = (p) => {
    try {
      total += Number(/VmRSS:\s+(\d+)/.exec(readFileSync(`/proc/${p}/status`, 'utf8'))?.[1] ?? 0)
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
const runOne = (c, side) =>
  new Promise((done) => {
    const dir = join(work, 'perf-runs', side, c.case)
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
    const a = ['vite-node', '--config', configs[side], 'packages/analysis-service/scripts/second-house.ts', '--', '--package', c.package, '--graph', c.graph, '--metrics', c.metrics, '--cache', c.cache, '--out', dir]
    if (c.dropFrames?.length) a.push('--drop-frames', c.dropFrames.join(','))
    const t0 = process.hrtime.bigint()
    const child = spawn('npx', a, { cwd: REPO, env: { ...process.env, OFFLINE: '1' }, stdio: 'ignore' })
    let peak = 0
    const timer = setInterval(() => (peak = Math.max(peak, rssOfTree(child.pid))), 100)
    child.on('close', (code) => {
      clearInterval(timer)
      rmSync(dir, { recursive: true, force: true })
      done({ code, wall: Number(process.hrtime.bigint() - t0) / 1e9, peakRssKb: peak })
    })
  })

const samples = { OLD: {}, NEW: {} }
for (let r = 0; r < reps; r++) {
  for (const c of cases) {
    const order = r % 2 === 0 ? ['OLD', 'NEW'] : ['NEW', 'OLD']
    for (const side of order) {
      const s = await runOne(c, side)
      ;(samples[side][c.case] ??= []).push(s)
      process.stdout.write(`rep ${r + 1} ${side} ${c.case} exit ${s.code} ${s.wall.toFixed(2)} s ${Math.round(s.peakRssKb / 1024)} MB\n`)
    }
  }
}
const q = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]
}
const r2 = (x) => Math.round(x * 100) / 100
const median = (xs) => q(xs, 0.5)
const perCase = {}
for (const c of cases) {
  const o = samples.OLD[c.case]
  const n = samples.NEW[c.case]
  perCase[c.case] = { oldWallMedian: r2(median(o.map((s) => s.wall))), newWallMedian: r2(median(n.map((s) => s.wall))), ratio: r2(median(n.map((s) => s.wall)) / median(o.map((s) => s.wall))), oldPeakRssMb: Math.round(Math.max(...o.map((s) => s.peakRssKb)) / 1024), newPeakRssMb: Math.round(Math.max(...n.map((s) => s.peakRssKb)) / 1024), exits: [...new Set([...o, ...n].map((s) => s.code))] }
}
const side = (k) => {
  const walls = Object.values(samples[k]).flat().map((s) => s.wall)
  const rss = Object.values(samples[k]).flat().map((s) => s.peakRssKb / 1024)
  return { runs: walls.length, wallP50: r2(q(walls, 0.5)), wallP95: r2(q(walls, 0.95)), wallTotal: r2(walls.reduce((a, b) => a + b, 0)), peakRssMbP50: Math.round(q(rss, 0.5)), peakRssMbMax: Math.round(Math.max(...rss)) }
}
const ratios = Object.values(perCase).map((x) => x.ratio)
const summary = { OLD: side('OLD'), NEW: side('NEW'), perCaseRatioP50: r2(q(ratios, 0.5)), perCaseRatioP95: r2(q(ratios, 0.95)), perCaseRatioMax: r2(Math.max(...ratios)), casesOver15Percent: Object.entries(perCase).filter(([, x]) => x.ratio > 1.15).map(([k]) => k) }
writeFileSync(
  out,
  `${JSON.stringify({ schema: 'buildapp.005p.performance', machine: `${process.arch} container, ${cpus().length} cores (${cpus()[0]?.model ?? 'unknown'}), ${Math.round(totalmem() / 2 ** 30)} GiB; NOT a phone - no Android or ARM64 figure is measured or implied`, node: process.version, method: `solver-only replay of every development case (second-house.ts --package --graph --metrics), incumbent 5906afa plan resolution vs HEAD, both through a Vite alias, one process at a time, ABBA order over ${reps} repetitions; wall time of the whole process (Vite start-up included) and peak sampled RSS of the process tree`, reps, summary, perCase }, null, 1)}\n`,
)
process.stdout.write(`${JSON.stringify(summary)}\n`)
