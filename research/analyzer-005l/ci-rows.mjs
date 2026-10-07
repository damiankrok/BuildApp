#!/usr/bin/env node
/**
 * ci-rows.mjs — BUILDPLAN-ANALYZER-005L: the CI development-house rows, replayed locally before a push (RESEARCH ONLY).
 *
 *   node research/analyzer-005l/ci-rows.mjs --cache <merged offline byte cache> --out <dir> [--only a,b] [--jobs 2]
 *
 * Reads the `analyzer-development-houses` matrix from `.github/workflows/buildapp-ci.yml` and runs each row exactly as
 * the job does — `OFFLINE=1 ANALYZER_EVIDENCE=1 npm run -s analysis:second-house -- --package <sealed> --cache <cache>
 * --out <dir>`, then `dev-row.mjs` with the row's expectation, pin, limits and metric gate — against a local copy of
 * the publisher's bytes instead of a fresh fetch. The cache and the outputs stay outside the repository.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')
const arg = (name, fallback) => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : fallback)
const cache = resolve(arg('cache', '/home/user/work005l/ci-cache'))
const out = resolve(arg('out', '/home/user/work005l/ci-rows'))
const jobs = Number(arg('jobs', '2'))
const only = arg('only', '').split(',').filter(Boolean)
if (out.startsWith(REPO) || cache.startsWith(REPO)) throw new Error('the cache and the outputs stay outside the repository')
mkdirSync(out, { recursive: true })

const yaml = readFileSync(join(REPO, '.github/workflows/buildapp-ci.yml'), 'utf8')
const job = yaml.slice(yaml.indexOf('\n  analyzer-development-houses:'), yaml.indexOf('\n  architectural-assemblies:'))
const include = job.slice(job.indexOf('include:'), job.indexOf('\n    env:'))
const rows = []
for (const line of include.split('\n')) {
  const m = line.match(/^\s+(-\s+)?(house|expect|model|pkg|limits|metric):\s*(.*)$/)
  if (!m) continue
  if (m[1]) rows.push({})
  rows.at(-1)[m[2]] = m[3].replace(/^"(.*)"$/, '$1')
}
const DEV = 'stage-reports/artifacts/analyzer-005b/dev'
const todo = rows.filter((r) => only.length === 0 || only.includes(r.house))

const runRow = (r) =>
  new Promise((done) => {
    const pkg = r.pkg ?? `${DEV}/${r.house}/source-package.json`
    const dir = join(out, r.house)
    const log = createWriteStream(join(out, `${r.house}.log`))
    const t0 = Date.now()
    const child = spawn('npm', ['run', '-s', 'analysis:second-house', '--', '--package', pkg, '--cache', cache, '--out', dir], { cwd: REPO, env: { ...process.env, OFFLINE: '1', ANALYZER_EVIDENCE: '1' } })
    child.stdout.pipe(log)
    child.stderr.pipe(log)
    child.on('close', () => {
      const checkArgs = [join(REPO, 'packages/analysis-service/scripts/dev-row.mjs'), dir, r.expect, ...(r.model ? ['--same-model', r.model] : []), ...(r.limits ? ['--limits', r.limits] : []), ...(r.metric ? r.metric.split(/\s+/) : [])]
      const check = spawnSync(process.execPath, checkArgs, { cwd: REPO, encoding: 'utf8' })
      const verify = spawnSync('npm', ['run', '-s', 'evidence:verify', '--', join(dir, 'evidence-pack')], { cwd: REPO, encoding: 'utf8' })
      // a refused row writes failure.json and no summary
      const summary = join(dir, 'result-summary.json')
      const modelHash = existsSync(summary) ? (JSON.parse(readFileSync(summary, 'utf8')).modelHash ?? null) : null
      const res = { house: r.house, expect: r.expect, pinned: r.model ?? null, modelHash, row: check.status === 0 ? 'OK' : 'FAIL', rowSays: `${check.stdout}${check.stderr}`.trim().split('\n').slice(-3).join(' | '), evidence: verify.status === 0 ? 'OK' : 'FAIL', seconds: Math.round((Date.now() - t0) / 1000) }
      process.stdout.write(`${r.house}: ${res.row} (${res.rowSays}) evidence ${res.evidence} ${res.seconds}s\n`)
      done(res)
    })
  })

const results = []
const queue = [...todo]
await Promise.all(
  Array.from({ length: jobs }, async () => {
    while (queue.length > 0) results.push(await runRow(queue.shift()))
  }),
)
results.sort((a, b) => a.house.localeCompare(b.house))
writeFileSync(join(out, 'ci-rows.json'), `${JSON.stringify({ rows: results }, null, 1)}\n`)
