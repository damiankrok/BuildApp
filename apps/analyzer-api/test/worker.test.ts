/**
 * The production executor: every job in a worker thread of its own.
 *
 * The worker here is the production worker body with the in-memory
 * publisher's wiring, bundled by esbuild exactly as `build.mjs` bundles the
 * real one.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { HOLLOWAY, LARCHFIELD, syntheticPublisher } from '@buildapp/synthetic-drawings'
import { hashesOf, runAnalysis } from '@buildapp/analysis-service'
import { memoryByteCache } from '@buildapp/source-package'
import { WorkerExecutor } from '../src/executor.js'
import { call, pollJob, startApi } from './support/harness.js'
import type { Api } from './support/harness.js'

const publisher = syntheticPublisher({
  projects: [
    { code: 'larchfield-lf01', title: 'Larchfield', house: LARCHFIELD },
    { code: 'holloway-hw02', title: 'Holloway', house: HOLLOWAY },
    { code: 'hangs', title: 'Never answers', house: LARCHFIELD },
  ],
})

const out = mkdtempSync(join(tmpdir(), 'analyzer-worker-'))
let api: Api

beforeAll(async () => {
  await build({
    entryPoints: { 'synthetic-worker': join(__dirname, 'support/synthetic-worker.ts') },
    outdir: out,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    outExtension: { '.js': '.mjs' },
    logLevel: 'error',
    banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
  })
  api = await startApi(publisher, { concurrency: 2 }, { executor: new WorkerExecutor(pathToFileURL(join(out, 'synthetic-worker.mjs')), { memoryMb: 1024 }) })
})
afterAll(async () => {
  await api?.close()
  rmSync(out, { recursive: true, force: true })
})

describe('WorkerExecutor', () => {
  it('runs the job in its own thread, with the same hashes as the pipeline run directly — and the server stays responsive meanwhile', async () => {
    const { jobId } = (await call(api, 'POST', '/v1/analyses', { url: publisher.pageUrl('larchfield-lf01') })).json
    const latencies: number[] = []
    let status = 'QUEUED'
    while (!['COMPLETED', 'FAILED', 'CANCELLED'].includes(status)) {
      const t0 = performance.now()
      await call(api, 'GET', '/health')
      latencies.push(performance.now() - t0)
      status = (await call(api, 'GET', `/v1/analyses/${jobId}`)).json.status
      await new Promise((r) => setTimeout(r, 25))
    }
    expect(status).toBe('COMPLETED')
    // the solver's long synchronous stretches happen on the worker's thread, not the server's
    expect(latencies.length).toBeGreaterThan(10)
    expect(Math.max(...latencies)).toBeLessThan(750)
    const result = (await call(api, 'GET', `/v1/analyses/${jobId}/result`)).json
    const direct = await runAnalysis({ kind: 'URL', url: publisher.pageUrl('larchfield-lf01') }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache() })
    expect(hashesOf(result as never)).toEqual(hashesOf(direct.result))
    const job = (await call(api, 'GET', `/v1/analyses/${jobId}`)).json
    // progress arrived from the thread stage by stage
    expect(job.stages.every((s: { state: string; startedAt?: string }) => s.state === 'DONE' && s.startedAt)).toBe(true)
  })

  it('two jobs run side by side in two threads, each with its own result', async () => {
    const a = (await call(api, 'POST', '/v1/analyses', { url: publisher.pageUrl('larchfield-lf01') })).json.jobId
    const b = (await call(api, 'POST', '/v1/analyses', { url: publisher.pageUrl('holloway-hw02') })).json.jobId
    const [ja, jb] = await Promise.all([pollJob(api, a), pollJob(api, b)])
    const fa = ja[ja.length - 1]
    const fb = jb[jb.length - 1]
    expect(fa.status).toBe('COMPLETED')
    expect(fb.status).toBe('COMPLETED')
    expect(fa.result.label).toBe('Larchfield (analysis)')
    expect(fb.result.label).toBe('Holloway (analysis)')
    expect(fa.result.candidateHash).not.toBe(fb.result.candidateHash)
  })

  it('a job stuck inside its thread is stopped by cancelling it: the thread is terminated, not asked', async () => {
    const { jobId } = (await call(api, 'POST', '/v1/analyses', { url: publisher.pageUrl('hangs') })).json
    await pollJob(api, jobId, (j) => j.status === 'ACQUIRING_SOURCE')
    await new Promise((r) => setTimeout(r, 200))
    const t0 = Date.now()
    expect((await call(api, 'DELETE', `/v1/analyses/${jobId}`)).status).toBe(202)
    const polled = await pollJob(api, jobId, undefined, 5_000)
    expect(polled[polled.length - 1].status).toBe('CANCELLED')
    await api.runner.idle()
    expect(Date.now() - t0).toBeLessThan(5_000)
    expect((await call(api, 'GET', '/health')).json.queue.running).toBe(0)
  })
})
