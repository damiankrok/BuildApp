/**
 * The web client of the analyzer HTTP API (docs/ANALYZER_API.md).
 *
 * BuildWorld does not analyse anything itself: it sends a URL to the service,
 * shows the stages the service reports, and opens the model the service made
 * — after checking that the bytes it received are the bytes the service's
 * result names. The phone speaks the same contract.
 */

export const ANALYSIS_STAGE_IDS = [
  'ACQUIRING_SOURCE',
  'CLASSIFYING_SOURCES',
  'EXTRACTING_OBSERVATIONS',
  'REGISTERING_VIEWS',
  'SOLVING_TOPOLOGY',
  'SOLVING_METRICS',
  'BUILDING_MODEL',
  'COMPILING_SCENE',
  'VERIFYING',
] as const

export type StageState = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'CANCELLED'

export type JobStatus = {
  jobId: string
  status: string
  progress: number
  stage: { id: string; label: string; index: number; count: number; fraction: number; detail?: string } | null
  stages: Array<{ id: string; label: string; state: StageState; startedAt?: string; completedAt?: string }>
  sourceUrl: string
  error: { code: string; message: string } | null
  result: {
    title: string
    label: string
    candidateHash: string
    modelHash: string
    sceneSha256: string
    sceneContentHash: string
    sceneBytes: number
    quality: { L0: number; L1: number; L2: number }
    unresolved: number
    warnings: number
    vision: string
  } | null
}

export type AnalysisSummary = {
  title: string
  label: string
  modelId: string
  sourceUrl: string
  canonicalUrl: string
  sourcePackageHash: string
  observationGraphHash: string
  metricEvidenceHash: string
  candidateHash: string
  modelHash: string
  modelSha256: string
  sceneContentHash: string
  sceneSha256: string
  counts: Record<string, number | Record<string, number>>
  quality: { levels: { L0: number; L1: number; L2: number } }
  unresolved: Array<{ what: string; reason: string; status: string }>
  warnings: string[]
  vision: { mode: string; provider: string | null }
  verification: { replay: string; residuals: number; residualsOutsideTolerance: number }
  completedAt: string
}

export const isTerminalStatus = (status: string): boolean => status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED'

export class AnalyzerClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
    readonly retryAfterS?: number,
  ) {
    super(message)
    this.name = 'AnalyzerClientError'
  }
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * The service address, checked: https, or http on this machine's loopback
 * only (a service run locally for development). No credentials in it.
 */
export function normalizeServiceUrl(raw: string): string {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new AnalyzerClientError('INVALID_SERVICE_URL', 'The service address is not a URL.')
  }
  const local = url.protocol === 'http:' && LOOPBACK.has(url.hostname)
  if (url.protocol !== 'https:' && !local) throw new AnalyzerClientError('INVALID_SERVICE_URL', 'The service address must start with https://.')
  if (url.username || url.password) throw new AnalyzerClientError('INVALID_SERVICE_URL', 'The service address must not carry credentials.')
  url.hash = ''
  url.search = ''
  return url.toString().replace(/\/+$/, '')
}

/** A project page address the user typed, checked the way the service will check it before sending it. */
export function checkProjectUrl(raw: string): string {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new AnalyzerClientError('INVALID_URL', 'That is not a web address.')
  }
  if (url.protocol !== 'https:') throw new AnalyzerClientError('INVALID_URL', 'Only https project pages can be analysed.')
  return url.toString()
}

const JOB_ID = /^[0-9a-f]{32}$/

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** What each failure means to someone looking at the panel. */
export function describeFailure(code: string, message?: string): string {
  switch (code) {
    case 'NETWORK':
      return 'The analyzer service cannot be reached. Check the connection and the service address, then retry.'
    case 'RATE_LIMITED':
      return 'Too many analyses from this browser recently. Wait a few minutes and retry.'
    case 'QUEUE_FULL':
      return 'The analyzer is busy with other projects. Retry in a few minutes.'
    case 'INVALID_URL':
      return message ?? 'That address cannot be analysed.'
    case 'UNSUPPORTED_PUBLISHER':
      return message ?? 'The analyzer does not read projects from that site.'
    case 'HASH_MISMATCH':
      return 'The model received does not match the analysis result. It was not opened.'
    case 'CANCELLED':
      return 'The analysis was cancelled.'
    case 'TIMEOUT':
      return 'The analysis took longer than the service allows.'
    case 'NOT_FOUND':
      return 'The service no longer has this analysis (results expire). Run it again.'
    default:
      return message ?? 'The analysis failed.'
  }
}

export type AnalyzerClient = ReturnType<typeof createAnalyzerClient>

export function createAnalyzerClient(serviceUrl: string, fetchImpl: typeof fetch = (...a) => fetch(...a)) {
  const base = normalizeServiceUrl(serviceUrl)
  const jobPath = (jobId: string, part = ''): string => {
    if (!JOB_ID.test(jobId)) throw new AnalyzerClientError('INVALID_JOB', 'That is not an analysis id.')
    return `${base}/v1/analyses/${jobId}${part}`
  }

  const request = async (url: string, init?: RequestInit): Promise<Response> => {
    let res: Response
    try {
      res = await fetchImpl(url, { ...init, credentials: 'omit', cache: 'no-store' })
    } catch {
      throw new AnalyzerClientError('NETWORK', 'network error')
    }
    if (res.ok) return res
    let code = `HTTP_${res.status}`
    let message: string | undefined
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string } }
      code = body.error?.code ?? code
      message = body.error?.message
    } catch {
      /* not JSON: keep the status */
    }
    const retry = Number(res.headers.get('retry-after') ?? NaN)
    throw new AnalyzerClientError(code, message ?? `HTTP ${res.status}`, res.status, Number.isFinite(retry) ? retry : undefined)
  }

  return {
    base,
    async health(): Promise<{ status: string; publishers: string[]; vision: string }> {
      return (await request(`${base}/health`)).json()
    },
    async submit(projectUrl: string): Promise<{ jobId: string; status: string }> {
      const res = await request(`${base}/v1/analyses`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: checkProjectUrl(projectUrl) }) })
      const body = (await res.json()) as { jobId: string; status: string }
      if (!JOB_ID.test(body.jobId)) throw new AnalyzerClientError('BAD_RESPONSE', 'The service answered with an invalid analysis id.')
      return body
    },
    async status(jobId: string): Promise<JobStatus> {
      return (await request(jobPath(jobId))).json()
    },
    async result(jobId: string): Promise<AnalysisSummary> {
      return (await request(jobPath(jobId, '/result'))).json()
    },
    async cancel(jobId: string): Promise<void> {
      await request(jobPath(jobId), { method: 'DELETE' })
    },
    /** The model's JSON, only if its bytes hash to what the result says. */
    async model(jobId: string, expectedSha256: string): Promise<string> {
      const res = await request(jobPath(jobId, '/model'))
      const bytes = await res.arrayBuffer()
      if ((await sha256Hex(bytes)) !== expectedSha256) throw new AnalyzerClientError('HASH_MISMATCH', 'model bytes do not match the result')
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    },
  }
}
