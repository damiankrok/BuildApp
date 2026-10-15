#!/usr/bin/env node
/**
 * replay.mjs — BUILDPLAN-ANALYZER-005R-ROUTER development replays (RESEARCH ONLY; never imported by production).
 *
 *   node research/analyzer-005r-router/replay.mjs --work /home/user/work005r-router --label R0 \
 *        [--config <variant>/vite.config.mjs] [--cases a,b] [--par 3] [--order given|reverse] [--shuffle <seed>]
 *
 * Rows: every EXTRACT row of research/analyzer-005q-chain/cases.json whose sealed package is from a publisher that
 * 005R screened USABLE_FOR_LOCAL_RESEARCH (ARCHON, and its same-edition reprint host). DobreDomy rows (D00–D05,
 * aster-viii, galaktyka) are SOURCE_NOT_USABLE (005R corpus/source-eligibility.json) and are refused here, although
 * earlier stages cached their bytes. Each row runs run-case.ts (full extraction, OFFLINE, recogniser on) into
 * <work>/runs/<label>/<case>/. Nothing is written inside the repository.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(import.meta.dirname, '../..')
const USABLE_HOSTS = new Set(['www.archon.pl', 'www.projektydomownowoczesnych.pl'])
const arg = (n, f) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : f
}
const work = resolve(arg('work', '/home/user/work005r-router'))
if (work === REPO || work.startsWith(REPO + '/')) throw new Error('replays live outside the repository')
const label = arg('label', 'R0')
if (!/^[A-Za-z0-9_-]+$/.test(label)) throw new Error('a label is letters, digits, _ and - only')
if (existsSync(join(work, 'runs', `${label}.done.json`)) && !process.argv.includes('--overwrite')) throw new Error(`label ${label} already finished; pass --overwrite to replace it`)
const config = arg('config', '')
const only = arg('cases', '')
const shuffle = arg('shuffle', '')

export function eligibleRows() {
  const cases = JSON.parse(readFileSync(join(REPO, 'research/analyzer-005q-chain/cases.json'), 'utf8')).cases
  return cases
    .filter((c) => c.mode === 'EXTRACT')
    .map((c) => ({ ...c, host: new URL(JSON.parse(readFileSync(c.package, 'utf8')).canonicalUrl).host }))
    .filter((c) => USABLE_HOSTS.has(c.host))
}
// Importing this file (e.g. for eligibleRows) must never start a replay.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()

async function main() {
  let todo = eligibleRows().filter((c) => !only || only.split(',').includes(c.case))
  if (arg('order', 'given') === 'reverse') todo = [...todo].reverse()
  const par = Number(arg('par', '3'))
  mkdirSync(join(work, 'runs', label), { recursive: true })

  const runOne = (c) =>
    new Promise((done) => {
      const out = join(work, 'runs', label, c.case)
      rmSync(out, { recursive: true, force: true })
      mkdirSync(out, { recursive: true })
      const t0 = process.hrtime.bigint()
      const child = spawn('npx', ['vite-node', ...(config ? ['--config', config] : []), 'research/analyzer-005r-router/run-case.ts', '--', '--package', c.package, '--cache', c.cache, '--out', out, ...(shuffle ? ['--shuffle', `${shuffle}:${c.case}`] : [])], { cwd: REPO, env: { ...process.env, OFFLINE: '1' } })
      let log = ''
      child.stdout.on('data', (d) => (log += d))
      child.stderr.on('data', (d) => (log += d))
      child.on('close', (code) => {
        const wall = Number(process.hrtime.bigint() - t0) / 1e9
        writeFileSync(join(out, 'run.log'), `${log}\nexit ${code} wall ${wall.toFixed(2)} config ${config || 'none'}\n`)
        process.stdout.write(`${label} ${c.case} exit ${code} ${wall.toFixed(1)} s\n`)
        done({ case: c.case, code, wall })
      })
    })

  let next = 0
  const results = []
  await Promise.all(
    Array.from({ length: par }, async () => {
      while (next < todo.length) results.push(await runOne(todo[next++]))
    }),
  )
  writeFileSync(join(work, 'runs', `${label}.done.json`), JSON.stringify({ label, config: config || null, order: arg('order', 'given'), par, rows: results.sort((a, b) => a.case.localeCompare(b.case)) }, null, 1) + '\n')
  if (!existsSync(join(work, 'runs', label))) process.exit(1)
}
