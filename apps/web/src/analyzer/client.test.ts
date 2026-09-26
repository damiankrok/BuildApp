import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { AnalyzerClientError, checkProjectUrl, createAnalyzerClient, describeFailure, normalizeServiceUrl } from './client.js'

const JOB = 'a'.repeat(32)
const sha = (text: string): string => createHash('sha256').update(text).digest('hex')

type Call = { url: string; init?: RequestInit }
const fakeFetch = (routes: Record<string, () => Response>, calls: Call[] = []): typeof fetch =>
  (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    const key = `${init?.method ?? 'GET'} ${url}`
    const route = routes[key]
    if (!route) throw new TypeError('network down')
    return route()
  }) as typeof fetch

const json = (status: number, body: unknown, headers: Record<string, string> = {}): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

describe('service address', () => {
  it.each([
    ['https://analyzer.example.com/', 'https://analyzer.example.com'],
    ['https://analyzer.example.com/api/?x=1#y', 'https://analyzer.example.com/api'],
    ['http://127.0.0.1:4180', 'http://127.0.0.1:4180'],
    ['http://localhost:8080/', 'http://localhost:8080'],
  ])('%s → %s', (raw, normalized) => expect(normalizeServiceUrl(raw)).toBe(normalized))

  it.each(['http://analyzer.example.com', 'ftp://x', 'file:///etc', 'https://u:p@analyzer.example.com', 'not a url'])('refuses %s', (raw) => {
    expect(() => normalizeServiceUrl(raw)).toThrow(AnalyzerClientError)
  })

  it('a project page must be https', () => {
    expect(checkProjectUrl(' https://www.archon.pl/projekty-domow/x ')).toBe('https://www.archon.pl/projekty-domow/x')
    expect(() => checkProjectUrl('http://www.archon.pl/x')).toThrow(/https/)
  })
})

describe('client', () => {
  const base = 'https://analyzer.example.com'

  it('submits the URL as JSON, without credentials, and returns the job id', async () => {
    const calls: Call[] = []
    const client = createAnalyzerClient(base, fakeFetch({ [`POST ${base}/v1/analyses`]: () => json(202, { jobId: JOB, status: 'QUEUED' }) }, calls))
    expect(await client.submit('https://www.archon.pl/projekty-domow/x')).toEqual({ jobId: JOB, status: 'QUEUED' })
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ url: 'https://www.archon.pl/projekty-domow/x' })
    expect(calls[0].init?.credentials).toBe('omit')
  })

  it('maps the error envelope to a code, with Retry-After', async () => {
    const client = createAnalyzerClient(base, fakeFetch({ [`POST ${base}/v1/analyses`]: () => json(429, { error: { code: 'RATE_LIMITED', message: 'slow down' } }, { 'retry-after': '30' }) }))
    const error = await client.submit('https://www.archon.pl/x').catch((e: AnalyzerClientError) => e)
    expect(error).toBeInstanceOf(AnalyzerClientError)
    expect(error).toMatchObject({ code: 'RATE_LIMITED', status: 429, retryAfterS: 30 })
  })

  it('a network failure is NETWORK, and says so in words', async () => {
    const client = createAnalyzerClient(base, fakeFetch({}))
    await expect(client.status(JOB)).rejects.toMatchObject({ code: 'NETWORK' })
    expect(describeFailure('NETWORK')).toMatch(/cannot be reached/)
  })

  it('never puts something that is not a job id into a path', async () => {
    const client = createAnalyzerClient(base, fakeFetch({}))
    await expect(client.status('../../etc')).rejects.toMatchObject({ code: 'INVALID_JOB' })
  })

  it('opens a model only when its bytes hash to what the result says', async () => {
    const model = '{"id":"m-analysis-x"}'
    const client = createAnalyzerClient(base, fakeFetch({ [`GET ${base}/v1/analyses/${JOB}/model`]: () => new Response(model, { status: 200 }) }))
    expect(await client.model(JOB, sha(model))).toBe(model)
    await expect(client.model(JOB, sha('something else'))).rejects.toMatchObject({ code: 'HASH_MISMATCH' })
  })
})
