#!/usr/bin/env node
/**
 * Smoke-test a running (or freshly started) analyzer API over HTTP.
 *
 *   node apps/analyzer-api/scripts/smoke.mjs                 start dist/server.mjs on a free port, test it, stop it
 *   node apps/analyzer-api/scripts/smoke.mjs --base <url>    test a service that is already running (a container, a deployment)
 *   ... --analyze <project url> [--timeout-s 900] [--out <dir>]
 *                                                            also run one real analysis end to end and keep its
 *                                                            status record and result summary
 *
 * Plain Node, no dependencies: CI runs it against the bundle, the container and
 * a deployment alike.
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const argv = process.argv.slice(2)
const value = (name) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const here = dirname(fileURLToPath(import.meta.url))
const failures = []
const check = (ok, what) => {
  process.stdout.write(`${ok ? 'ok  ' : 'FAIL'} ${what}\n`)
  if (!ok) failures.push(what)
}
const freePort = () =>
  new Promise((resolve) => {
    const s = createServer().listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close(() => resolve(port))
    })
  })

let base = value('base')?.replace(/\/+$/, '')
let child
let dataDir
if (!base) {
  const port = await freePort()
  dataDir = mkdtempSync(join(tmpdir(), 'analyzer-smoke-'))
  child = spawn(process.execPath, [join(here, '../dist/server.mjs')], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', ANALYZER_DATA_DIR: dataDir }, stdio: ['ignore', 'inherit', 'inherit'] })
  base = `http://127.0.0.1:${port}`
}

const get = async (path, init) => {
  const res = await fetch(`${base}${path}`, init)
  const text = await res.text()
  let json = {}
  try {
    json = JSON.parse(text)
  } catch {}
  return { status: res.status, json, text, headers: res.headers }
}

try {
  let health
  for (let i = 0; i < 60; i++) {
    try {
      health = await get('/health')
      if (health.status === 200) break
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  check(health?.status === 200 && health.json.status === 'ok', `GET /health → 200 ok (${base})`)
  check(Array.isArray(health?.json.publishers) && health.json.publishers.length > 0, `publishers registered: ${health?.json.publishers}`)
  check(health?.headers.get('x-content-type-options') === 'nosniff', 'security headers present')

  const post = (body, headers = { 'content-type': 'application/json' }) => get('/v1/analyses', { method: 'POST', headers, body })
  const r1 = await post(JSON.stringify({ url: 'http://www.archon.pl/x' }))
  check(r1.status === 400 && r1.json.error?.code === 'INVALID_URL', 'http:// is refused (400 INVALID_URL)')
  const r2 = await post(JSON.stringify({ url: 'https://169.254.169.254/latest/meta-data' }))
  check(r2.status === 400 && r2.json.error?.code === 'INVALID_URL', 'an address literal is refused (400 INVALID_URL)')
  const r3 = await post(JSON.stringify({ url: 'https://example.com/house' }))
  check(r3.status === 422 && r3.json.error?.code === 'UNSUPPORTED_PUBLISHER', 'an unknown publisher is refused (422)')
  const r4 = await post('{"url": "x"}', { 'content-type': 'text/plain' })
  check(r4.status === 415, 'a non-JSON body is refused (415)')
  const r5 = await get('/v1/analyses/0123456789abcdef0123456789abcdef')
  check(r5.status === 404 && r5.json.error?.code === 'NOT_FOUND', 'an unknown job is 404')
  const all = [health, r1, r2, r3, r4, r5].map((r) => r?.text ?? '').join('\n')
  check(!/\/(home|tmp|app|data|root)\/|node_modules|\bat \w+ \(/.test(all), 'no path or stack in any response')

  const project = value('analyze')
  if (project) {
    const started = await post(JSON.stringify({ url: project }))
    check(started.status === 202 && /^[0-9a-f]{32}$/.test(started.json.jobId ?? ''), `POST ${project} → 202 with an opaque job id`)
    const jobId = started.json.jobId
    const deadline = Date.now() + Number(value('timeout-s') ?? 900) * 1000
    let job
    let last = ''
    for (;;) {
      job = (await get(`/v1/analyses/${jobId}`)).json
      const line = `${job.status} ${Math.round((job.progress ?? 0) * 100)}% ${job.stage?.detail ?? ''}`
      if (line !== last) process.stdout.write(`     ${new Date().toISOString().slice(11, 19)} ${line}\n`)
      last = line
      if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status) || Date.now() > deadline) break
      await new Promise((r) => setTimeout(r, 2000))
    }
    check(job.status === 'COMPLETED', `the analysis completed (${job.status}${job.error ? `: ${job.error.code} ${job.error.message}` : ''})`)
    if (job.status === 'COMPLETED') {
      const result = (await get(`/v1/analyses/${jobId}/result`)).json
      const scene = await fetch(`${base}/v1/analyses/${jobId}/scene`)
      const bytes = Buffer.from(await scene.arrayBuffer())
      check(createHash('sha256').update(bytes).digest('hex') === result.sceneSha256, `scene bytes hash to sceneSha256 (${bytes.length} bytes)`)
      check(JSON.parse(bytes.toString('utf8')).contentHash === result.sceneContentHash, 'scene bundle contentHash matches the result')
      process.stdout.write(`     ${result.label}: candidate ${result.candidateHash}, model ${result.modelHash}, L0/L1/L2 ${result.quality.levels.L0}/${result.quality.levels.L1}/${result.quality.levels.L2}, ${result.unresolved.length} unresolved, ${result.warnings.length} warnings, vision ${result.vision.mode}\n`)
      const out = value('out')
      if (out) {
        mkdirSync(out, { recursive: true })
        writeFileSync(join(out, 'live-job.json'), `${JSON.stringify(job, null, 2)}\n`)
        writeFileSync(join(out, 'live-result.json'), `${JSON.stringify(result, null, 2)}\n`)
      }
    }
  }
} finally {
  if (child) {
    child.kill('SIGTERM')
    await new Promise((r) => child.once('exit', r))
  }
  if (dataDir) rmSync(dataDir, { recursive: true, force: true })
}

process.stdout.write(failures.length === 0 ? 'analyzer API smoke: all checks passed\n' : `analyzer API smoke: ${failures.length} check(s) failed\n`)
process.exit(failures.length === 0 ? 0 : 1)
