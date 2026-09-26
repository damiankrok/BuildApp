/**
 * The service's configuration, from the environment.
 *
 * Every limit that protects the service has a default that is safe on a small
 * public instance, and none of them is a secret. The one credential the
 * service may hold — a vision provider's key — is read by the provider on the
 * server, never echoed, and never reaches a client.
 */

export type ApiConfig = {
  port: number
  host: string
  dataDir: string
  /** `worker`: one worker thread per job (production). `inprocess`: the job runs on the server's thread (tests, dev). */
  executor: 'worker' | 'inprocess'
  concurrency: number
  maxQueued: number
  jobTimeoutMs: number
  resultTtlMs: number
  maxStoredJobs: number
  submitLimit: { max: number; windowMs: number }
  readLimit: { max: number; windowMs: number }
  trustProxy: boolean
  requireHttps: boolean
  /** `['*']`, or the exact origins allowed to call the API from a browser. */
  corsOrigins: string[]
  maxBodyBytes: number
  workerMemoryMb: number
  /** `deterministic` (default) or `live`: a server-side vision provider, whose key never leaves the server. */
  vision: 'deterministic' | 'live'
  log: boolean
}

const int = (value: string | undefined, fallback: number, min: number, max: number): number => {
  const n = value === undefined || value.trim() === '' ? NaN : Number(value)
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : fallback
}
const flag = (value: string | undefined): boolean => value === '1' || value === 'true'

export function loadConfig(env: Record<string, string | undefined> = process.env): ApiConfig {
  return {
    port: int(env.PORT, 8080, 0, 65535),
    host: env.HOST?.trim() || '0.0.0.0',
    dataDir: env.ANALYZER_DATA_DIR?.trim() || '.data/analyzer',
    executor: env.ANALYZER_EXECUTOR === 'inprocess' ? 'inprocess' : 'worker',
    concurrency: int(env.ANALYZER_CONCURRENCY, 1, 1, 8),
    maxQueued: int(env.ANALYZER_MAX_QUEUED, 8, 0, 200),
    jobTimeoutMs: int(env.ANALYZER_JOB_TIMEOUT_MS, 15 * 60_000, 1_000, 2 * 60 * 60_000),
    resultTtlMs: int(env.ANALYZER_RESULT_TTL_HOURS, 72, 1, 24 * 90) * 60 * 60_000,
    maxStoredJobs: int(env.ANALYZER_MAX_STORED_JOBS, 200, 1, 10_000),
    submitLimit: { max: int(env.ANALYZER_RATE_LIMIT_MAX, 6, 1, 10_000), windowMs: int(env.ANALYZER_RATE_LIMIT_WINDOW_MS, 600_000, 1_000, 86_400_000) },
    readLimit: { max: int(env.ANALYZER_POLL_LIMIT_MAX, 1200, 10, 1_000_000), windowMs: int(env.ANALYZER_POLL_LIMIT_WINDOW_MS, 600_000, 1_000, 86_400_000) },
    trustProxy: flag(env.ANALYZER_TRUST_PROXY),
    requireHttps: flag(env.ANALYZER_REQUIRE_HTTPS),
    corsOrigins: (env.ANALYZER_CORS_ORIGINS?.trim() || '*')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    maxBodyBytes: 4096,
    workerMemoryMb: int(env.ANALYZER_WORKER_MEMORY_MB, 2048, 256, 16_384),
    vision: env.ANALYZER_VISION === 'live' ? 'live' : 'deterministic',
    log: env.ANALYZER_LOG !== '0',
  }
}
