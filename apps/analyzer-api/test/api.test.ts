/**
 * The analyzer HTTP API against its contract (docs/ANALYZER_API.md), end to
 * end over a real socket: health, validation, the job lifecycle, results that
 * match their hashes, cancellation, time limits, failure cleanup, isolation
 * between jobs, the queue bound, rate limits, restart, and what a response
 * may never contain.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { HOLLOWAY, LARCHFIELD, syntheticPublisher } from '@buildapp/synthetic-drawings'
import { hashesOf, runAnalysis, ANALYSIS_STAGES } from '@buildapp/analysis-service'
import { memoryByteCache } from '@buildapp/source-package'
import { loadBundle } from '@buildapp/mobile-scene'
import { call, gate, pollJob, startApi } from './support/harness.js'
import type { Api, Json } from './support/harness.js'
import { FileJobStore } from '../src/store.js'
import { newJob } from '../src/job.js'

const sha256 = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex')

const SECRET = 'sk-ant-test-0123456789-not-a-real-key'
const publisher = syntheticPublisher({
  projects: [
    { code: 'larchfield-lf01', title: 'Larchfield', house: LARCHFIELD },
    { code: 'holloway-hw02', title: 'Holloway', house: HOLLOWAY },
  ],
})
const A = publisher.pageUrl('larchfield-lf01')
const B = publisher.pageUrl('holloway-hw02')

/** Everything any response body said, to check what it never says. */
const bodies: string[] = []
const record = <T extends { text: string }>(r: T): T => {
  bodies.push(r.text)
  return r
}

let api: Api
let previousKey: string | undefined
beforeAll(async () => {
  previousKey = process.env.ANTHROPIC_API_KEY
  process.env.ANTHROPIC_API_KEY = SECRET
  api = await startApi(publisher)
})
afterAll(async () => {
  if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY
  else process.env.ANTHROPIC_API_KEY = previousKey
  await api?.close()
})

describe('GET /health', () => {
  it('reports the service, the analyzer, the publishers and the queue — and nothing about the machine', async () => {
    const r = record(await call(api, 'GET', '/health'))
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ status: 'ok', service: 'buildapp-analyzer-api', publishers: ['synthetic-publisher'], vision: 'DETERMINISTIC_ONLY', queue: { running: 0, queued: 0, concurrency: 1 } })
    expect(r.json.analyzer.solver).toBe('2.0.0')
    expect(r.text).not.toContain(api.dataDir)
    expect(r.headers.get('x-content-type-options')).toBe('nosniff')
  })
})

describe('POST /v1/analyses refuses before it queues', () => {
  it.each([
    ['wrong media type', { 'content-type': 'text/plain' }, `{"url":"${A}"}`, 415, 'UNSUPPORTED_MEDIA_TYPE'],
    ['not JSON', {}, '{"url":', 400, 'BAD_REQUEST'],
    ['not an object', {}, '["x"]', 400, 'BAD_REQUEST'],
    ['no url', {}, '{}', 400, 'INVALID_URL'],
    ['http', {}, JSON.stringify({ url: A.replace('https:', 'http:') }), 400, 'INVALID_URL'],
    ['file', {}, JSON.stringify({ url: 'file:///etc/passwd' }), 400, 'INVALID_URL'],
    ['localhost', {}, JSON.stringify({ url: 'https://localhost/projects/x' }), 400, 'INVALID_URL'],
    ['private IP', {}, JSON.stringify({ url: 'https://10.0.0.1/projects/x' }), 400, 'INVALID_URL'],
    ['metadata IP', {}, JSON.stringify({ url: 'https://169.254.169.254/latest/meta-data' }), 400, 'INVALID_URL'],
    ['credentials', {}, JSON.stringify({ url: A.replace('https://', 'https://u:p@') }), 400, 'INVALID_URL'],
    ['other publisher', {}, JSON.stringify({ url: 'https://example.com/house' }), 422, 'UNSUPPORTED_PUBLISHER'],
    ['too large', {}, JSON.stringify({ url: A, pad: 'x'.repeat(5000) }), 413, 'BODY_TOO_LARGE'],
  ])('%s → %i %s', async (_name, headers, body, status, code) => {
    const before = publisher.requests.length
    const r = record(await call(api, 'POST', '/v1/analyses', body, { 'content-type': 'application/json', ...headers }))
    expect(r.status).toBe(status)
    expect(r.json.error.code).toBe(code)
    expect(typeof r.json.error.message).toBe('string')
    expect(publisher.requests.length).toBe(before)
    expect((await api.store.list()).length).toBe(0)
  })

  it('GET on the collection is not a way in', async () => {
    const r = record(await call(api, 'GET', '/v1/analyses'))
    expect(r.status).toBe(405)
  })
})

describe('a job, from URL to downloadable scene', () => {
  let jobId: string
  let polls: Json[]
  let final: Json

  beforeAll(async () => {
    const r = record(await call(api, 'POST', '/v1/analyses', { url: A }))
    expect(r.status).toBe(202)
    jobId = r.json.jobId
    expect(r.headers.get('location')).toBe(`/v1/analyses/${jobId}`)
    polls = await pollJob(api, jobId)
    final = polls[polls.length - 1]
    bodies.push(...polls.map((p) => JSON.stringify(p)))
  })

  it('is queued under an opaque id', () => {
    expect(jobId).toMatch(/^[0-9a-f]{32}$/)
    expect(polls[0].status === 'QUEUED' || ANALYSIS_STAGES.includes(polls[0].status)).toBe(true)
  })

  it('completes, having passed through every stage in order, with progress that never goes back', () => {
    expect(final.status).toBe('COMPLETED')
    expect(final.error).toBeNull()
    expect(final.progress).toBe(1)
    expect(final.stage).toBeNull()
    expect(final.stages.map((s: Json) => s.id)).toEqual([...ANALYSIS_STAGES])
    for (const s of final.stages) {
      expect(s.state).toBe('DONE')
      expect(Date.parse(s.completedAt)).toBeGreaterThanOrEqual(Date.parse(s.startedAt))
    }
    const order = ['QUEUED', ...ANALYSIS_STAGES, 'COMPLETED']
    for (let i = 1; i < polls.length; i++) {
      expect(polls[i].progress).toBeGreaterThanOrEqual(polls[i - 1].progress)
      expect(order.indexOf(polls[i].status)).toBeGreaterThanOrEqual(order.indexOf(polls[i - 1].status))
    }
    expect(final.links).toEqual({ self: `/v1/analyses/${jobId}`, result: `/v1/analyses/${jobId}/result`, scene: `/v1/analyses/${jobId}/scene`, model: `/v1/analyses/${jobId}/model`, candidate: `/v1/analyses/${jobId}/candidate` })
    expect(final.result).toMatchObject({ title: 'Larchfield', label: 'Larchfield (analysis)', vision: 'DETERMINISTIC_ONLY' })
  })

  it('/result carries the hashes; /scene, /model and /candidate are the bytes those hashes name', async () => {
    const result = record(await call(api, 'GET', `/v1/analyses/${jobId}/result`)).json
    expect(result.candidate).toBeUndefined()
    expect(result.scene).toBeUndefined()
    expect(result.candidateHash).toBe(final.result.candidateHash)

    const scene = await fetch(`${api.base}/v1/analyses/${jobId}/scene`)
    const bytes = Buffer.from(await scene.arrayBuffer())
    expect(scene.status).toBe(200)
    expect(sha256(bytes)).toBe(result.sceneSha256)
    expect(scene.headers.get('x-content-sha256')).toBe(result.sceneSha256)
    expect(scene.headers.get('etag')).toBe(`"${result.sceneSha256}"`)
    expect(Number(scene.headers.get('content-length'))).toBe(result.sceneBytes)
    const loaded = loadBundle(bytes.toString('utf8'))
    expect(loaded.ok && loaded.bundle.contentHash).toBe(result.sceneContentHash)

    const again = await fetch(`${api.base}/v1/analyses/${jobId}/scene`, { headers: { 'if-none-match': `"${result.sceneSha256}"` } })
    expect(again.status).toBe(304)

    const model = await fetch(`${api.base}/v1/analyses/${jobId}/model`)
    expect(sha256(Buffer.from(await model.arrayBuffer()))).toBe(result.modelSha256)
    const candidate = (await (await fetch(`${api.base}/v1/analyses/${jobId}/candidate`)).json()) as Json
    expect(candidate.contentHash).toBe(result.candidateHash)
    expect(candidate.modelHash).toBe(result.modelHash)
  })

  it('runs the same pipeline as the CLI: a direct runAnalysis of the same URL gives the same hashes', async () => {
    const result = (await call(api, 'GET', `/v1/analyses/${jobId}/result`)).json
    const direct = await runAnalysis({ kind: 'URL', url: A }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache() })
    expect(hashesOf(result as never)).toEqual(hashesOf(direct.result))
  })

  it('keeps only the result: no source bytes, no package, no scratch once the job has ended', () => {
    const dir = join(api.dataDir, 'jobs', jobId)
    expect(readdirSync(dir).sort()).toEqual(['candidate.json', 'job.json', 'model.json', 'result.json', 'scene.json'])
  })

  it('a second, different URL runs on the same service without a restart, isolated from the first', async () => {
    const before = publisher.requests.length
    const r = await call(api, 'POST', '/v1/analyses', { url: B })
    const polled = await pollJob(api, r.json.jobId)
    const b = polled[polled.length - 1]
    expect(b.status).toBe('COMPLETED')
    expect(b.result.label).toBe('Holloway (analysis)')
    expect(b.result.candidateHash).not.toBe(final.result.candidateHash)
    // it fetched its own sources, all of them, and nothing of A's
    const fetched = publisher.requests.slice(before)
    expect(fetched.every((u) => !u.includes('larchfield'))).toBe(true)
    expect(fetched.filter((u) => u.includes('/sheets/holloway-hw02/')).length).toBeGreaterThanOrEqual(5)
    // A's result is untouched
    expect((await call(api, 'GET', `/v1/analyses/${jobId}/result`)).json.candidateHash).toBe(final.result.candidateHash)
  })

  it('the same URL again fetches its sources again (no cross-job cache) and gives the same building', async () => {
    const before = publisher.requests.length
    const r = await call(api, 'POST', '/v1/analyses', { url: A })
    const polled = await pollJob(api, r.json.jobId)
    const again = polled[polled.length - 1]
    expect(again.result.candidateHash).toBe(final.result.candidateHash)
    expect(publisher.requests.slice(before).filter((u) => u.includes('/sheets/larchfield-lf01/')).length).toBeGreaterThanOrEqual(5)
    expect(again.jobId).not.toBe(jobId)
  })

  it('a finished job cannot be cancelled', async () => {
    expect(record(await call(api, 'DELETE', `/v1/analyses/${jobId}`)).status).toBe(409)
  })

  it('results stay downloadable after the service restarts', async () => {
    const store = new FileJobStore(api.dataDir)
    await store.init()
    const restored = await store.get(jobId)
    expect(restored?.status).toBe('COMPLETED')
    expect(await store.loadResult(jobId, 'scene')).toBe(readFileSync(join(api.dataDir, 'jobs', jobId, 'scene.json'), 'utf8'))
  })
})

describe('ids that are not jobs', () => {
  it.each([
    '/v1/analyses/0123456789abcdef0123456789abcdef',
    '/v1/analyses/0123456789ABCDEF0123456789ABCDEF',
    '/v1/analyses/..%2F..%2Fetc%2Fpasswd',
    '/v1/analyses/../../etc/passwd',
    '/v1/analyses/abc/scene',
    '/v1/analyses/0123456789abcdef0123456789abcdef/scene',
    '/v1/analyses/0123456789abcdef0123456789abcdef/../../../job.json',
    '/nope',
  ])('%s → 404', async (path) => {
    const r = record(await call(api, 'GET', path))
    expect(r.status).toBe(404)
    expect(r.json.error.code).toBe('NOT_FOUND')
  })
})

describe('cancellation, time limits and failures clean up after themselves', () => {
  it('DELETE stops a running job: CANCELLED, its stage marked, its scratch gone, no result', async () => {
    const g = gate()
    const held = syntheticPublisher({ projects: [{ code: 'larchfield-lf01', title: 'Larchfield', house: LARCHFIELD }], beforeRespond: (url, signal) => (url.includes('/sheets/') ? g.hold(url, signal) : undefined) })
    const local = await startApi(held)
    try {
      const { jobId } = (await call(local, 'POST', '/v1/analyses', { url: held.pageUrl('larchfield-lf01') })).json
      await pollJob(local, jobId, (j) => j.status === 'ACQUIRING_SOURCE' && g.waiting() > 0)
      expect(existsSync(join(local.dataDir, 'jobs', jobId, 'work'))).toBe(true)
      const cancel = record(await call(local, 'DELETE', `/v1/analyses/${jobId}`))
      expect(cancel.status).toBe(202)
      const polled = await pollJob(local, jobId)
      const job = polled[polled.length - 1]
      expect(job.status).toBe('CANCELLED')
      expect(job.error.code).toBe('CANCELLED')
      expect(job.stages.find((s: Json) => s.id === 'ACQUIRING_SOURCE').state).toBe('CANCELLED')
      await local.runner.idle()
      expect(existsSync(join(local.dataDir, 'jobs', jobId, 'work'))).toBe(false)
      expect(readdirSync(join(local.dataDir, 'jobs', jobId))).toEqual(['job.json'])
      expect(record(await call(local, 'GET', `/v1/analyses/${jobId}/result`)).status).toBe(410)
      expect(record(await call(local, 'GET', `/v1/analyses/${jobId}/scene`)).status).toBe(410)
    } finally {
      g.open()
      await local.close()
    }
  })

  it('a job past its time limit fails with TIMEOUT', async () => {
    const g = gate()
    const held = syntheticPublisher({ projects: [{ code: 'larchfield-lf01', title: 'Larchfield', house: LARCHFIELD }], beforeRespond: (url, signal) => (url.includes('/sheets/') ? g.hold(url, signal) : undefined) })
    const local = await startApi(held, { jobTimeoutMs: 1_000 })
    try {
      const { jobId } = (await call(local, 'POST', '/v1/analyses', { url: held.pageUrl('larchfield-lf01') })).json
      const polled = await pollJob(local, jobId)
      const job = polled[polled.length - 1]
      expect(job.status).toBe('FAILED')
      expect(job.error.code).toBe('TIMEOUT')
      await local.runner.idle()
      expect(existsSync(join(local.dataDir, 'jobs', jobId, 'work'))).toBe(false)
    } finally {
      g.open()
      await local.close()
    }
  })

  it('a page that is not there fails with SOURCE_UNREACHABLE and leaves nothing but its record', async () => {
    const { jobId } = (await call(api, 'POST', '/v1/analyses', { url: publisher.pageUrl('no-such-house') })).json
    const polled = await pollJob(api, jobId)
    const job = polled[polled.length - 1]
    bodies.push(JSON.stringify(job))
    expect(job.status).toBe('FAILED')
    expect(job.error.code).toBe('SOURCE_UNREACHABLE')
    expect(job.stages.find((s: Json) => s.id === 'ACQUIRING_SOURCE').state).toBe('FAILED')
    await api.runner.idle()
    expect(readdirSync(join(api.dataDir, 'jobs', jobId))).toEqual(['job.json'])
    expect(record(await call(api, 'GET', `/v1/analyses/${jobId}/result`)).status).toBe(410)
  })
})

describe('the service bounds what one client, or all of them, can cost', () => {
  it('the queue is bounded: past concurrency + maxQueued a submission is 503 QUEUE_FULL; a queued job can be cancelled before it runs', async () => {
    const g = gate()
    const held = syntheticPublisher({ projects: [{ code: 'larchfield-lf01', title: 'Larchfield', house: LARCHFIELD }], beforeRespond: (url, signal) => (url.includes('/sheets/') ? g.hold(url, signal) : undefined) })
    const local = await startApi(held, { concurrency: 1, maxQueued: 1 })
    try {
      const first = (await call(local, 'POST', '/v1/analyses', { url: held.pageUrl('larchfield-lf01') })).json.jobId
      const second = (await call(local, 'POST', '/v1/analyses', { url: held.pageUrl('larchfield-lf01') })).json.jobId
      const third = record(await call(local, 'POST', '/v1/analyses', { url: held.pageUrl('larchfield-lf01') }))
      expect(third.status).toBe(503)
      expect(third.json.error.code).toBe('QUEUE_FULL')
      expect(Number(third.headers.get('retry-after'))).toBeGreaterThan(0)
      expect((await call(local, 'GET', '/health')).json.queue).toMatchObject({ running: 1, queued: 1 })
      expect((await call(local, 'GET', `/v1/analyses/${second}`)).json.status).toBe('QUEUED')
      expect((await call(local, 'DELETE', `/v1/analyses/${second}`)).status).toBe(202)
      expect((await call(local, 'GET', `/v1/analyses/${second}`)).json.status).toBe('CANCELLED')
      await call(local, 'DELETE', `/v1/analyses/${first}`)
    } finally {
      g.open()
      await local.close()
    }
  })

  it('a client that submits too often is 429 RATE_LIMITED with Retry-After', async () => {
    const local = await startApi(publisher, { submitLimit: { max: 2, windowMs: 60_000 } })
    try {
      for (let i = 0; i < 2; i++) expect((await call(local, 'POST', '/v1/analyses', { url: A })).status).toBe(202)
      const r = record(await call(local, 'POST', '/v1/analyses', { url: A }))
      expect(r.status).toBe(429)
      expect(r.json.error.code).toBe('RATE_LIMITED')
      expect(Number(r.headers.get('retry-after'))).toBeGreaterThan(0)
      await local.runner.idle()
    } finally {
      await local.close()
    }
  })

  it('behind a trusted proxy, the limit follows the forwarded client address', async () => {
    const local = await startApi(publisher, { trustProxy: true, submitLimit: { max: 1, windowMs: 60_000 }, maxQueued: 10 })
    try {
      expect((await call(local, 'POST', '/v1/analyses', { url: A }, { 'x-forwarded-for': '198.51.100.1' })).status).toBe(202)
      expect((await call(local, 'POST', '/v1/analyses', { url: A }, { 'x-forwarded-for': '198.51.100.1' })).status).toBe(429)
      expect((await call(local, 'POST', '/v1/analyses', { url: A }, { 'x-forwarded-for': '198.51.100.2' })).status).toBe(202)
      for (const j of await local.store.list()) await local.runner.cancel(j.jobId)
    } finally {
      await local.close()
    }
  })

  it('with HTTPS required, a plain-http forwarded request is refused (health stays open for the platform probe)', async () => {
    const local = await startApi(publisher, { requireHttps: true })
    try {
      expect((await call(local, 'GET', '/health')).status).toBe(200)
      const refused = record(await call(local, 'POST', '/v1/analyses', { url: A }, { 'x-forwarded-proto': 'http' }))
      expect(refused.status).toBe(403)
      expect(refused.json.error.code).toBe('HTTPS_REQUIRED')
      const ok = await call(local, 'POST', '/v1/analyses', { url: A }, { 'x-forwarded-proto': 'https' })
      expect(ok.status).toBe(202)
      expect(ok.headers.get('strict-transport-security')).toContain('max-age=')
      await local.runner.cancel(ok.json.jobId)
    } finally {
      await local.close()
    }
  })

  it('CORS lets a browser call it without credentials, and can be narrowed to named origins', async () => {
    const pre = await fetch(`${api.base}/v1/analyses`, { method: 'OPTIONS', headers: { origin: 'https://viewer.example', 'access-control-request-method': 'POST' } })
    expect(pre.status).toBe(204)
    expect(pre.headers.get('access-control-allow-origin')).toBe('*')
    expect(pre.headers.get('access-control-allow-credentials')).toBeNull()
    const local = await startApi(publisher, { corsOrigins: ['https://app.example'] })
    try {
      const allowed = await fetch(`${local.base}/health`, { headers: { origin: 'https://app.example' } })
      expect(allowed.headers.get('access-control-allow-origin')).toBe('https://app.example')
      const other = await fetch(`${local.base}/health`, { headers: { origin: 'https://evil.example' } })
      expect(other.headers.get('access-control-allow-origin')).toBeNull()
    } finally {
      await local.close()
    }
  })
})

describe('restart', () => {
  it('a job that was running when the process stopped is reported as interrupted, not left running forever', async () => {
    const dir = join(api.dataDir, '..', `restart-${Date.now()}`)
    const jobId = 'ab'.repeat(16)
    mkdirSync(join(dir, 'jobs', jobId, 'work', 'bytes'), { recursive: true })
    writeFileSync(join(dir, 'jobs', jobId, 'job.json'), JSON.stringify({ ...newJob(jobId, A, '2026-01-01T00:00:00.000Z'), status: 'EXTRACTING_OBSERVATIONS' }))
    const store = new FileJobStore(dir)
    expect(await store.init()).toEqual({ loaded: 1, interrupted: 1 })
    const job = await store.get(jobId)
    expect(job?.status).toBe('FAILED')
    expect(job?.error?.code).toBe('SERVICE_RESTARTED')
    expect(existsSync(join(dir, 'jobs', jobId, 'work'))).toBe(false)
  })
})

describe('what a response never contains', () => {
  it('no server path, no stack, no environment secret, no reference or benchmark, in any body this suite received', () => {
    expect(bodies.length).toBeGreaterThan(30)
    const all = bodies.join('\n')
    expect(all).not.toContain(api.dataDir)
    expect(all).not.toContain(SECRET)
    expect(all).not.toMatch(/node_modules|\/home\/|\/tmp\/|\bat \w+ \(|\.ts:\d+:\d+/)
    expect(all).not.toMatch(/reference-marcowki|benchmark|marcowki-ge|expected[A-Z]/)
  })
})
