import type { JSX } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../use-store.js'
import { ANALYSIS_STAGE_IDS, AnalyzerClientError, createAnalyzerClient, describeFailure, isTerminalStatus, normalizeServiceUrl } from '../analyzer/client.js'
import type { AnalysisSummary, JobStatus } from '../analyzer/client.js'

/**
 * The Analyze panel: paste a project page, watch the analyzer service work
 * through its stages, open the building it made.
 *
 * Nothing is analysed here. The service runs the one pipeline the CLI runs;
 * this panel sends the URL, shows the stages and the progress exactly as the
 * service reports them (never a timer), and opens the model only after its
 * bytes have been checked against the hash in the service's result. What it
 * shows is what the analyzer made of the sources and how sure it is — there
 * is no reference, score or "expected" anywhere in it.
 */

const SERVICE_KEY = 'buildworld.analyzer.service'
const JOB_KEY = 'buildworld.analyzer.job'
const POLL_MS = 1000

const configuredService = (): string => {
  const fromBuild = (import.meta.env.VITE_ANALYZER_API_BASE_URL as string | undefined)?.trim() ?? ''
  try {
    return localStorage.getItem(SERVICE_KEY) ?? fromBuild
  } catch {
    return fromBuild
  }
}

const remember = (key: string, value: string | null): void => {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* private mode: nothing to remember */
  }
}

const STATE_MARK: Record<string, string> = { PENDING: '○', RUNNING: '◐', DONE: '●', FAILED: '✕', CANCELLED: '–' }

const visionText = (mode: string): string => (mode === 'LIVE_PROVIDER' ? 'vision provider contributed' : mode === 'REPLAYED_GRAPH' ? 'replayed observation graph' : 'deterministic analyzer — no vision provider')

type Failure = { code: string; message: string; retryAfterS?: number }

export function Analyzer(): JSX.Element {
  const store = useStore()
  const [service, setService] = useState(configuredService)
  const [serviceDraft, setServiceDraft] = useState(configuredService)
  const [url, setUrl] = useState('')
  const [job, setJob] = useState<JobStatus | null>(null)
  const [summary, setSummary] = useState<AnalysisSummary | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [busy, setBusy] = useState(false)
  const [connection, setConnection] = useState<'ok' | 'retrying'>('ok')
  const [opened, setOpened] = useState<string | null>(null)
  const jobIdRef = useRef<string | null>(null)
  const timer = useRef<number | null>(null)

  const client = useCallback(() => createAnalyzerClient(service), [service])

  const fail = (e: unknown): void => {
    const err = e instanceof AnalyzerClientError ? e : new AnalyzerClientError('UNKNOWN', 'unexpected error')
    setFailure({ code: err.code, message: describeFailure(err.code, err.message), retryAfterS: err.retryAfterS })
  }

  const stopPolling = (): void => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }

  const poll = useCallback(
    async (jobId: string): Promise<void> => {
      if (jobIdRef.current !== jobId) return
      try {
        const status = await client().status(jobId)
        if (jobIdRef.current !== jobId) return
        setConnection('ok')
        setJob(status)
        if (isTerminalStatus(status.status)) {
          remember(JOB_KEY, null)
          if (status.status === 'COMPLETED') setSummary(await client().result(jobId))
          else if (status.error) setFailure({ code: status.error.code, message: describeFailure(status.error.code, status.error.message) })
          return
        }
      } catch (e) {
        if (e instanceof AnalyzerClientError && e.code === 'NETWORK') setConnection('retrying')
        else {
          remember(JOB_KEY, null)
          fail(e)
          return
        }
      }
      timer.current = window.setTimeout(() => void poll(jobId), POLL_MS)
    },
    [client],
  )

  // Resume a job this browser was following when the page was closed.
  useEffect(() => {
    let saved: string | null = null
    try {
      saved = localStorage.getItem(JOB_KEY)
    } catch {
      saved = null
    }
    if (saved && service && /^[0-9a-f]{32}$/.test(saved)) {
      jobIdRef.current = saved
      void poll(saved)
    }
    return stopPolling
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveService = (): void => {
    try {
      const normalized = normalizeServiceUrl(serviceDraft)
      remember(SERVICE_KEY, normalized)
      setService(normalized)
      setServiceDraft(normalized)
      setFailure(null)
    } catch (e) {
      fail(e)
    }
  }

  const analyze = async (): Promise<void> => {
    stopPolling()
    setFailure(null)
    setSummary(null)
    setJob(null)
    setOpened(null)
    setBusy(true)
    try {
      const { jobId } = await client().submit(url)
      jobIdRef.current = jobId
      remember(JOB_KEY, jobId)
      await poll(jobId)
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (): Promise<void> => {
    const jobId = jobIdRef.current
    if (!jobId) return
    try {
      await client().cancel(jobId)
    } catch (e) {
      fail(e)
    }
  }

  const openModel = async (): Promise<void> => {
    if (!job || !summary) return
    setFailure(null)
    try {
      const text = await client().model(job.jobId, summary.modelSha256)
      const loaded = store.loadJson(text)
      if (!loaded.ok) {
        setFailure({ code: 'INVALID_MODEL', message: 'The model the service sent does not validate; it was not opened.' })
        return
      }
      setOpened(summary.label)
    } catch (e) {
      fail(e)
    }
  }

  const running = !!job && !isTerminalStatus(job.status)
  const stages = job?.stages ?? ANALYSIS_STAGE_IDS.map((id) => ({ id, label: id, state: 'PENDING' as const }))

  return (
    <div className="inspector analyzer" data-testid="analyzer-panel">
      <div className="panel-title">Analyze a project link</div>

      <div className="section">
        {service ? (
          <div className="kv">
            <span className="k">service</span>
            <span className="v" data-testid="analyzer-service" title={service}>
              {service}
            </span>
          </div>
        ) : (
          <div className="analyzer-note" data-testid="analyzer-not-configured">
            No analyzer service is configured for this build. Enter its address to use it.
          </div>
        )}
        <details className="analyzer-settings" open={!service}>
          <summary>Service address</summary>
          <div className="analyzer-row">
            <input data-testid="analyzer-service-input" value={serviceDraft} placeholder="https://…" onChange={(e) => setServiceDraft(e.target.value)} />
            <button data-testid="analyzer-service-save" onClick={saveService}>
              Use
            </button>
          </div>
        </details>
      </div>

      <div className="section">
        <label className="analyzer-label" htmlFor="analyzer-url">
          Project page
        </label>
        <input id="analyzer-url" data-testid="analyzer-url" value={url} placeholder="https://www.archon.pl/projekty-domow/…" onChange={(e) => setUrl(e.target.value)} disabled={running || busy} />
        <div className="actions">
          <button data-testid="analyzer-submit" onClick={() => void analyze()} disabled={!service || !url.trim() || running || busy}>
            Analyze project
          </button>
          {running ? (
            <button data-testid="analyzer-cancel" onClick={() => void cancel()}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      {job ? (
        <div className="section" data-testid="analyzer-progress">
          <div className="analyzer-status">
            <span data-testid="analyzer-status">{job.status}</span>
            <span>{Math.round(job.progress * 100)}%</span>
          </div>
          <progress data-testid="analyzer-progress-bar" max={1} value={job.progress} />
          {job.stage?.detail ? <div className="analyzer-detail">{job.stage.detail}</div> : null}
          {connection === 'retrying' ? <div className="analyzer-detail">Connection lost — retrying…</div> : null}
          <ol className="analyzer-stages">
            {stages.map((s) => (
              <li key={s.id} className={`stage-${s.state}`} data-testid={`analyzer-stage-${s.id}`} data-state={s.state}>
                <span className="mark">{STATE_MARK[s.state] ?? '○'}</span> {s.label}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {failure ? (
        <div className="section">
          <div className="error" data-testid="analyzer-error" data-code={failure.code}>
            {failure.message}
            {failure.retryAfterS ? ` (retry in about ${Math.ceil(failure.retryAfterS / 60)} min)` : ''}
          </div>
        </div>
      ) : null}

      {summary && job?.status === 'COMPLETED' ? (
        <div className="section" data-testid="analyzer-result">
          <div className="analyzer-title" data-testid="analyzer-title">
            {summary.title}
          </div>
          <div className="kv">
            <span className="k">candidate</span>
            <span className="v" data-testid="analyzer-candidate" title={summary.candidateHash}>
              {summary.candidateHash.slice(0, 12)}
            </span>
            <span className="k">quality</span>
            <span className="v" data-testid="analyzer-quality">
              L0 {summary.quality.levels.L0} · L1 {summary.quality.levels.L1} · L2 {summary.quality.levels.L2}
            </span>
            <span className="k">unresolved</span>
            <span className="v" data-testid="analyzer-unresolved">
              {summary.unresolved.length}
            </span>
            <span className="k">warnings</span>
            <span className="v" data-testid="analyzer-warnings">
              {summary.warnings.length}
            </span>
            <span className="k">vision</span>
            <span className="v" data-testid="analyzer-vision">
              {visionText(summary.vision.mode)}
            </span>
          </div>
          <div className="actions">
            <button data-testid="analyzer-open" onClick={() => void openModel()}>
              Open model
            </button>
            {opened ? <span className="analyzer-detail">opened as “{opened}”</span> : null}
          </div>
          <details className="analyzer-diagnostics" data-testid="analyzer-diagnostics">
            <summary>Diagnostics</summary>
            {summary.warnings.length > 0 ? (
              <>
                <div className="analyzer-label">warnings</div>
                <ul>
                  {summary.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {summary.unresolved.length > 0 ? (
              <>
                <div className="analyzer-label">unresolved</div>
                <ul>
                  {summary.unresolved.map((u) => (
                    <li key={u.what}>
                      <b>{u.what}</b> — {u.reason}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <div className="analyzer-label">hashes</div>
            <div className="kv">
              {(
                [
                  ['source package', summary.sourcePackageHash],
                  ['observations', summary.observationGraphHash],
                  ['metric evidence', summary.metricEvidenceHash],
                  ['candidate', summary.candidateHash],
                  ['model', summary.modelHash],
                  ['scene', summary.sceneContentHash],
                ] as const
              ).map(([k, v]) => (
                <span key={k} style={{ display: 'contents' }}>
                  <span className="k">{k}</span>
                  <span className="v" title={v}>
                    {v.slice(0, 16)}
                  </span>
                </span>
              ))}
            </div>
            <div className="analyzer-label">counts</div>
            <div className="kv">
              {Object.entries(summary.counts)
                .filter(([, v]) => typeof v === 'number')
                .map(([k, v]) => (
                  <span key={k} style={{ display: 'contents' }}>
                    <span className="k">{k}</span>
                    <span className="v">{String(v)}</span>
                  </span>
                ))}
            </div>
            <div className="analyzer-label">verification</div>
            <div className="kv">
              <span className="k">replay</span>
              <span className="v">{summary.verification.replay.toLowerCase().replace('_', ' ')}</span>
              <span className="k">view checks</span>
              <span className="v">
                {summary.verification.residuals - summary.verification.residualsOutsideTolerance} of {summary.verification.residuals} within tolerance
              </span>
            </div>
          </details>
        </div>
      ) : null}
    </div>
  )
}
