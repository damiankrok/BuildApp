#!/usr/bin/env node
/**
 * run-gapset.mjs — BUILDPLAN-ANALYZER-005K: the fresh projects, analysed (RESEARCH ONLY).
 *
 *   node research/analyzer-005k/run-gapset.mjs live   --ledger <draw-ledger.ndjson> --work <gapset dir> [--par 2]
 *   node research/analyzer-005k/run-gapset.mjs replay --work <gapset dir> --modes OFF,ON,CONSTANT --constant <constant work dir> [--par 3]
 *
 * live    every kept draw, once, live, at the frozen commit with the rule OFF: the production pipeline
 *         (`second-house.ts --url`), the external recogniser as the phone reads, the Evidence Pack on; byte cache and
 *         outputs under <work> (outside the repository). Project ids: A<k> (ARCHON pick k), D<k> (DobreDomy pick k).
 * replay  each project re-solved by the solver alone on its own sealed evidence (package, graph, metrics), so OCR and
 *         metric are held fixed: OFF, ON (`--drawn-gap-rule ON`), and CONSTANT (the replay-only copy of the boundary
 *         through `constant-replay.mjs`'s Vite config, with `--drawn-gap-rule ON`). Run only after the labels are sealed.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const cmd = process.argv[2]
const work = resolve(arg('work', '/home/user/work005k/gapset'))
const par = Number(arg('par', '2'))

const run = (args, env, log) =>
  new Promise((done) => {
    const t0 = Date.now()
    const child = spawn('npx', args, { cwd: REPO, env: { ...process.env, ...env } })
    let text = ''
    child.stdout.on('data', (d) => (text += d))
    child.stderr.on('data', (d) => (text += d))
    child.on('close', (code) => {
      writeFileSync(log, `${text}\nexit ${code} wall ${((Date.now() - t0) / 1000).toFixed(1)}\n`)
      done(code)
    })
  })
const lanes = async (jobs) => {
  let next = 0
  await Promise.all(
    Array.from({ length: par }, async () => {
      while (next < jobs.length) await jobs[next++]()
    }),
  )
}

if (cmd === 'live') {
  const ledger = readFileSync(resolve(arg('ledger', join(work, 'draw-ledger.ndjson'))), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  mkdirSync(join(work, 'runs'), { recursive: true })
  const jobs = ledger
    .filter((e) => e.eligible)
    .map((e) => async () => {
      const id = `${e.publisher === 'archon' ? 'A' : 'D'}${String(e.k).padStart(2, '0')}`
      const out = join(work, 'runs', id)
      rmSync(out, { recursive: true, force: true })
      const code = await run(['vite-node', 'packages/analysis-service/scripts/second-house.ts', '--', '--url', e.url, '--cache', join(work, 'cache'), '--out', out, '--recogniser'], { ANALYZER_EVIDENCE: '1' }, join(work, 'runs', `${id}.log`))
      process.stdout.write(`${id} exit ${code} ${e.url}\n`)
    })
  await lanes(jobs)
} else if (cmd === 'replay') {
  const modes = arg('modes', 'OFF,ON,CONSTANT').split(',')
  const constant = resolve(arg('constant', '/home/user/work005k/constant'))
  const projects = readdirSync(join(work, 'runs')).filter((d) => existsSync(join(work, 'runs', d, 'metric-evidence.json')))
  const jobs = []
  for (const mode of modes) {
    mkdirSync(join(work, 'replay', mode), { recursive: true })
    for (const id of projects) {
      jobs.push(async () => {
        const src = join(work, 'runs', id)
        const out = join(work, 'replay', mode, id)
        rmSync(out, { recursive: true, force: true })
        const base = ['packages/analysis-service/scripts/second-house.ts', '--', '--package', join(src, 'source-package.json'), '--graph', join(src, 'observation-graph.json'), '--metrics', join(src, 'metric-evidence.json'), '--cache', join(work, 'cache'), '--out', out]
        const args = mode === 'CONSTANT' ? ['vite-node', '--config', join(constant, 'vite.config.mjs'), ...base, '--drawn-gap-rule', 'ON'] : ['vite-node', ...base, ...(mode === 'ON' ? ['--drawn-gap-rule', 'ON'] : [])]
        const code = await run(args, { OFFLINE: '1' }, join(work, 'replay', mode, `${id}.log`))
        // keep the decisions; drop the copied inputs and the overlay pictures
        for (const f of ['source-package.json', 'metric-evidence.json', 'observation-graph.json']) rmSync(join(out, f), { force: true })
        const diag = join(out, 'plan-diagnostics')
        if (existsSync(diag)) for (const f of readdirSync(diag)) if (f.endsWith('.png')) rmSync(join(diag, f), { force: true })
        process.stdout.write(`${mode} ${id} exit ${code}\n`)
      })
    }
  }
  await lanes(jobs)
} else {
  process.stderr.write('usage: run-gapset.mjs live|replay ...\n')
  process.exit(2)
}
