/**
 * The HTTP surface of the analyzer — `docs/ANALYZER_API.md` is its contract.
 *
 * node:http and nothing else: the surface is seven routes, and a framework
 * would be more code to audit than the routes are. Every response is built
 * here from a code and a sentence this module or the analysis service wrote;
 * no exception's own text, no path and no stack ever reaches a client.
 */
import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { ANALYSIS_SERVICE_VERSION, AnalysisError, validateAnalysisUrl } from '@buildapp/analysis-service'
import { SOLVER_V2_VERSION } from '@buildapp/reconstruction'
import type { SourceAdapter } from '@buildapp/source-package'
import type { ApiConfig } from './config.js'
import { JOB_ID_PATTERN } from './job.js'
import type { JobRecord } from './job.js'
import { RateLimiter } from './rate-limit.js'
import { JobRunner, QueueFull } from './runner.js'
import type { AnalysisJobStore, ResultPart } from './store.js'

export const API_VERSION = '1.0.0' as const

export type ApiDeps = {
  config: ApiConfig
  store: AnalysisJobStore
  runner: JobRunner
  adapters: readonly SourceAdapter[]
  now?: () => number
  log?: (line: Record<string, unknown>) => void
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(message)
  }
}

const URL_STATUS: Record<string, number> = { INVALID_URL: 400, UNSUPPORTED_PUBLISHER: 422 }

const ROUTE = /^\/v1\/analyses\/([^/]+)(?:\/(result|scene|model|candidate))?\/?$/

/** `GET /v1/analyses/:id` for a record: the record without its schema tag, plus links. */
export const statusBodyOf = (job: JobRecord): Record<string, unknown> => {
  const { schema: _schema, schemaVersion: _version, ...rest } = job
  return { ...rest, links: linksOf(job) }
}

const linksOf = (job: JobRecord): Record<string, string> => {
  const base = `/v1/analyses/${job.jobId}`
  return job.status === 'COMPLETED' ? { self: base, result: `${base}/result`, scene: `${base}/scene`, model: `${base}/model`, candidate: `${base}/candidate` } : { self: base }
}

export function createApiServer(deps: ApiDeps): Server {
  const { config, store, runner, adapters } = deps
  const now = deps.now ?? (() => Date.now())
  const submitLimit = new RateLimiter(config.submitLimit.max, config.submitLimit.windowMs)
  const readLimit = new RateLimiter(config.readLimit.max, config.readLimit.windowMs)
  const log = deps.log ?? (config.log ? (line: Record<string, unknown>) => process.stdout.write(`${JSON.stringify(line)}\n`) : () => undefined)
  const vision = config.vision === 'live' ? 'LIVE_PROVIDER_CONFIGURED' : 'DETERMINISTIC_ONLY'

  const clientOf = (req: IncomingMessage): string => {
    if (config.trustProxy) {
      // One trusted proxy in front: the LAST entry is the address it saw and
      // appended. Everything before it came from the client and can be forged.
      const forwarded = req.headers['x-forwarded-for']
      const hops = (Array.isArray(forwarded) ? forwarded.join(',') : forwarded ?? '').split(',').map((h) => h.trim()).filter(Boolean)
      const last = hops[hops.length - 1]
      if (last) return last
    }
    return req.socket.remoteAddress ?? 'unknown'
  }

  const corsHeaders = (req: IncomingMessage): Record<string, string> => {
    const origin = req.headers.origin
    const any = config.corsOrigins.includes('*')
    if (!any && !(origin && config.corsOrigins.includes(origin))) return {}
    return {
      'access-control-allow-origin': any ? '*' : origin!,
      ...(any ? {} : { vary: 'Origin' }),
      'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-expose-headers': 'location, retry-after, etag, x-content-sha256',
      'access-control-max-age': '600',
    }
  }

  const baseHeaders = (req: IncomingMessage): Record<string, string> => ({
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
    ...(config.requireHttps ? { 'strict-transport-security': 'max-age=31536000' } : {}),
    ...corsHeaders(req),
  })

  const json = (req: IncomingMessage, res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void => {
    const text = `${JSON.stringify(body)}\n`
    res.writeHead(status, { ...baseHeaders(req), 'content-type': 'application/json; charset=utf-8', 'content-length': String(Buffer.byteLength(text)), 'cache-control': 'no-store', ...headers })
    res.end(req.method === 'HEAD' ? undefined : text)
  }

  const readBody = (req: IncomingMessage): Promise<string> =>
    new Promise((resolve, reject) => {
      const declared = Number(req.headers['content-length'] ?? NaN)
      if (Number.isFinite(declared) && declared > config.maxBodyBytes) {
        reject(new HttpError(413, 'BODY_TOO_LARGE', `the request body is limited to ${config.maxBodyBytes} bytes`))
        return
      }
      const chunks: Buffer[] = []
      let size = 0
      req.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > config.maxBodyBytes) {
          reject(new HttpError(413, 'BODY_TOO_LARGE', `the request body is limited to ${config.maxBodyBytes} bytes`))
          req.pause()
          return
        }
        chunks.push(chunk)
      })
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      req.on('error', () => reject(new HttpError(400, 'BAD_REQUEST', 'the request body could not be read')))
    })

  const serveFile = async (req: IncomingMessage, res: ServerResponse, job: JobRecord, part: ResultPart): Promise<void> => {
    if (job.status !== 'COMPLETED') throw job.status === 'FAILED' || job.status === 'CANCELLED' ? new HttpError(410, 'GONE', 'this analysis did not complete, so it has no result') : new HttpError(409, 'NOT_READY', 'the analysis has not finished yet')
    const opened = await store.openResult(job.jobId, part)
    if (!opened) throw new HttpError(404, 'NOT_FOUND', 'this result is no longer stored')
    const sha = part === 'scene' ? job.result?.sceneSha256 : undefined
    const summary = part === 'model' ? await store.loadResult(job.jobId, 'summary') : null
    const modelSha = summary ? (JSON.parse(summary) as { modelSha256?: string }).modelSha256 : undefined
    const digest = sha ?? modelSha
    if (digest && req.headers['if-none-match'] === `"${digest}"`) {
      opened.stream.destroy()
      res.writeHead(304, { ...baseHeaders(req), etag: `"${digest}"` })
      res.end()
      return
    }
    res.writeHead(200, {
      ...baseHeaders(req),
      'content-type': 'application/json; charset=utf-8',
      'content-length': String(opened.size),
      'cache-control': 'private, max-age=86400, immutable',
      ...(digest ? { etag: `"${digest}"`, 'x-content-sha256': digest } : {}),
    })
    if (req.method === 'HEAD') {
      opened.stream.destroy()
      res.end()
      return
    }
    opened.stream.pipe(res)
  }

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const method = req.method ?? 'GET'
    let path: string
    try {
      path = new URL(req.url ?? '/', 'http://analyzer.invalid').pathname
    } catch {
      throw new HttpError(400, 'BAD_REQUEST', 'the request target is not a valid path')
    }

    if (method === 'OPTIONS') {
      res.writeHead(204, baseHeaders(req))
      res.end()
      return
    }
    if (path === '/health' || path === '/healthz') {
      if (method !== 'GET' && method !== 'HEAD') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'use GET', { allow: 'GET' })
      json(req, res, 200, { status: 'ok', service: 'buildapp-analyzer-api', version: API_VERSION, analyzer: { service: ANALYSIS_SERVICE_VERSION, solver: SOLVER_V2_VERSION }, publishers: adapters.map((a) => a.id), vision, queue: runner.stats() })
      return
    }
    if (config.requireHttps) {
      const proto = req.headers['x-forwarded-proto']
      if ((Array.isArray(proto) ? proto[0] : proto)?.split(',')[0]?.trim() !== 'https') throw new HttpError(403, 'HTTPS_REQUIRED', 'this service is only served over https')
    }
    const client = clientOf(req)
    const read = readLimit.take(client, now())
    if (!read.ok) throw new HttpError(429, 'RATE_LIMITED', 'too many requests from this client; try again later', { 'retry-after': String(read.retryAfterS) })

    if (path === '/v1/analyses' || path === '/v1/analyses/') {
      if (method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'use POST to start an analysis', { allow: 'POST' })
      const type = (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()
      if (type !== 'application/json') throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'send the request as application/json')
      const text = await readBody(req)
      let body: unknown
      try {
        body = JSON.parse(text)
      } catch {
        throw new HttpError(400, 'BAD_REQUEST', 'the request body is not JSON')
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'BAD_REQUEST', 'send {"url": "<project page>"}')
      let url: URL
      try {
        url = validateAnalysisUrl((body as { url?: unknown }).url, adapters)
      } catch (e) {
        if (e instanceof AnalysisError) throw new HttpError(URL_STATUS[e.code] ?? 400, e.code, e.message)
        throw e
      }
      const submitted = submitLimit.take(client, now())
      if (!submitted.ok) throw new HttpError(429, 'RATE_LIMITED', 'this client has started too many analyses recently; try again later', { 'retry-after': String(submitted.retryAfterS) })
      let job: JobRecord
      try {
        job = await runner.submit(url.toString())
      } catch (e) {
        if (e instanceof QueueFull) throw new HttpError(503, 'QUEUE_FULL', 'the analyzer is busy; try again in a few minutes', { 'retry-after': '120' })
        throw e
      }
      json(req, res, 202, { jobId: job.jobId, status: job.status, links: linksOf(job) }, { location: `/v1/analyses/${job.jobId}` })
      return
    }

    const m = ROUTE.exec(path)
    if (!m) throw new HttpError(404, 'NOT_FOUND', 'no such endpoint')
    const [, jobId, part] = m
    // an id of the wrong shape is indistinguishable from an unknown one
    const job = JOB_ID_PATTERN.test(jobId) ? await store.get(jobId) : null
    if (!job) throw new HttpError(404, 'NOT_FOUND', 'no such analysis (it may have expired)')

    if (!part) {
      if (method === 'DELETE') {
        const outcome = await runner.cancel(jobId)
        if (outcome === 'NOT_FOUND') throw new HttpError(404, 'NOT_FOUND', 'no such analysis (it may have expired)')
        if (outcome === 'ALREADY_FINISHED') throw new HttpError(409, 'ALREADY_FINISHED', 'this analysis has already finished')
        json(req, res, 202, { jobId, status: 'CANCELLED' })
        return
      }
      if (method !== 'GET' && method !== 'HEAD') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'use GET or DELETE', { allow: 'GET, DELETE' })
      json(req, res, 200, statusBodyOf(job))
      return
    }
    if (method !== 'GET' && method !== 'HEAD') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'use GET', { allow: 'GET' })
    if (part === 'result') {
      if (job.status !== 'COMPLETED') throw job.status === 'FAILED' || job.status === 'CANCELLED' ? new HttpError(410, 'GONE', 'this analysis did not complete, so it has no result') : new HttpError(409, 'NOT_READY', 'the analysis has not finished yet')
      const summary = await store.loadResult(jobId, 'summary')
      if (!summary) throw new HttpError(404, 'NOT_FOUND', 'this result is no longer stored')
      json(req, res, 200, { ...(JSON.parse(summary) as Record<string, unknown>), links: linksOf(job) }, { 'cache-control': 'private, max-age=86400, immutable' })
      return
    }
    await serveFile(req, res, job, part as ResultPart)
  }

  const server = createServer((req, res) => {
    const started = now()
    handle(req, res)
      .catch((error: unknown) => {
        const e = error instanceof HttpError ? error : new HttpError(500, 'INTERNAL', 'the service could not handle this request')
        if (!(error instanceof HttpError)) log({ level: 'error', msg: 'unhandled', kind: error instanceof Error ? error.name : typeof error })
        // A 413 stops reading the body, so the connection cannot be reused: say so, and close it only
        // once the answer is out. (Destroying it at once let a client's next request race onto a dying socket.)
        const closing = e.status === 413
        if (closing) res.once('finish', () => req.destroy())
        if (!res.headersSent) json(req, res, e.status, { error: { code: e.code, message: e.message } }, closing ? { ...e.headers, connection: 'close' } : e.headers)
        else res.destroy()
      })
      .finally(() => {
        const route = (req.url ?? '').replace(/[0-9a-f]{32}/g, ':id').split('?')[0].slice(0, 80)
        log({ t: new Date(started).toISOString(), method: req.method, route, status: res.statusCode, ms: now() - started })
      })
  })
  server.requestTimeout = 30_000
  server.headersTimeout = 15_000
  return server
}
