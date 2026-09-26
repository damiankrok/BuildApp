/**
 * An analyzer API on a loopback port, wired to the in-memory publisher.
 *
 * The server, runner and store are the production classes; only the wiring
 * differs — the synthetic publisher's adapter and network instead of the real
 * publishers — which is exactly the seam the production wiring owns.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import type { SyntheticPublisher } from '@buildapp/synthetic-drawings'
import { loadConfig } from '../../src/config.js'
import type { ApiConfig } from '../../src/config.js'
import { InProcessExecutor } from '../../src/executor.js'
import type { JobExecutor } from '../../src/executor.js'
import { createApiServer } from '../../src/http.js'
import { JobRunner } from '../../src/runner.js'
import { FileJobStore } from '../../src/store.js'

export type Api = {
  base: string
  dataDir: string
  config: ApiConfig
  store: FileJobStore
  runner: JobRunner
  server: Server
  close: (options?: { keepData?: boolean }) => Promise<void>
}

export async function startApi(publisher: SyntheticPublisher, overrides: Partial<ApiConfig> = {}, options: { dataDir?: string; executor?: JobExecutor } = {}): Promise<Api> {
  const dataDir = options.dataDir ?? mkdtempSync(join(tmpdir(), 'analyzer-api-'))
  const config: ApiConfig = { ...loadConfig({}), dataDir, executor: 'inprocess', log: false, ...overrides }
  const store = new FileJobStore(dataDir)
  await store.init()
  const executor = options.executor ?? new InProcessExecutor(() => ({ adapters: [publisher.adapter], deps: publisher.deps }))
  const runner = new JobRunner(store, executor, config)
  const server = createApiServer({ config, store, runner, adapters: [publisher.adapter], log: () => undefined })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    base: `http://127.0.0.1:${port}`,
    dataDir,
    config,
    store,
    runner,
    server,
    close: async ({ keepData = false } = {}) => {
      await runner.close()
      await new Promise<void>((resolve) => server.close(() => resolve()))
      if (!keepData) rmSync(dataDir, { recursive: true, force: true })
    },
  }
}

export type Json = Record<string, any>

export async function call(api: Api, method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<{ status: number; headers: Headers; json: Json; text: string }> {
  const res = await fetch(`${api.base}${path}`, {
    method,
    headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  })
  const text = await res.text()
  let json: Json = {}
  try {
    json = text ? (JSON.parse(text) as Json) : {}
  } catch {
    json = {}
  }
  return { status: res.status, headers: res.headers, json, text }
}

/** Poll a job until `until` holds or it reaches a terminal status. Returns every distinct record seen. */
export async function pollJob(api: Api, jobId: string, until: (job: Json) => boolean = () => false, timeoutMs = 120_000): Promise<Json[]> {
  const seen: Json[] = []
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const { json } = await call(api, 'GET', `/v1/analyses/${jobId}`)
    if (seen.length === 0 || JSON.stringify(seen[seen.length - 1]) !== JSON.stringify(json)) seen.push(json)
    if (until(json) || ['COMPLETED', 'FAILED', 'CANCELLED'].includes(json.status)) return seen
    if (Date.now() > deadline) throw new Error(`job ${jobId} still ${json.status} after ${timeoutMs} ms`)
    await new Promise((r) => setTimeout(r, 20))
  }
}

/** A gate a test opens: requests matching `holds` wait until it is opened or they are aborted. */
export function gate(): { hold: (url: string, signal?: AbortSignal) => Promise<void>; open: () => void; waiting: () => number } {
  let release!: () => void
  const opened = new Promise<void>((r) => (release = r))
  let waiting = 0
  return {
    hold: (_url, signal) => {
      waiting += 1
      return new Promise<void>((resolve, reject) => {
        opened.then(resolve)
        signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true })
      }).finally(() => (waiting -= 1))
    },
    open: () => release(),
    waiting: () => waiting,
  }
}
