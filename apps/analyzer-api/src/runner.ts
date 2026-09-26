/**
 * The job runner: a bounded queue in front of a fixed number of executors.
 *
 * - `concurrency` jobs run at once; `maxQueued` more may wait; beyond that a
 *   submission is refused (`QueueFull`) rather than accepted and starved.
 * - Each job gets its own scratch directory and an empty byte cache in it; the
 *   directory is removed when the job ends, whatever the outcome.
 * - A job past `jobTimeoutMs` is stopped (TIMEOUT); a cancelled one is stopped
 *   at once (CANCELLED). Either way its worker is terminated, not asked.
 * - Progress reaches the store in the order the pipeline reported it; the
 *   terminal update is written after every progress update, never before.
 * - Finished jobs are swept after `resultTtlMs`, and the oldest finished ones
 *   are evicted beyond `maxStoredJobs`.
 */
import { AnalysisError, isTerminal, toAnalysisError } from '@buildapp/analysis-service'
import type { AnalysisProgress } from '@buildapp/analysis-service'
import { applyProgress, completeJob, failJob, newJob, newJobId } from './job.js'
import type { JobRecord } from './job.js'
import type { AnalysisJobStore } from './store.js'
import type { JobExecutor } from './executor.js'

export class QueueFull extends Error {
  constructor() {
    super('the analysis queue is full')
    this.name = 'QueueFull'
  }
}

export type RunnerLimits = { concurrency: number; maxQueued: number; jobTimeoutMs: number; resultTtlMs: number; maxStoredJobs: number }

export type RunnerEvents = { onJobEnd?: (job: JobRecord, error?: unknown) => void }

export class JobRunner {
  private readonly queue: string[] = []
  private readonly urls = new Map<string, string>()
  private readonly running = new Map<string, AbortController>()
  private readonly done = new Set<Promise<void>>()
  private closed = false

  constructor(
    private readonly store: AnalysisJobStore,
    private readonly executor: JobExecutor,
    private readonly limits: RunnerLimits,
    private readonly now: () => Date = () => new Date(),
    private readonly events: RunnerEvents = {},
  ) {}

  stats(): { running: number; queued: number; concurrency: number; capacity: number } {
    return { running: this.running.size, queued: this.queue.length, concurrency: this.limits.concurrency, capacity: this.limits.maxQueued }
  }

  /** Accept a validated URL. Throws `QueueFull` when there is no room. */
  async submit(url: string): Promise<JobRecord> {
    if (this.closed) throw new QueueFull()
    // room for `concurrency` running jobs and `maxQueued` waiting behind them
    if (this.running.size + this.queue.length >= this.limits.concurrency + this.limits.maxQueued) throw new QueueFull()
    const job = newJob(newJobId(), url, this.now().toISOString())
    await this.store.create(job)
    this.urls.set(job.jobId, url)
    this.queue.push(job.jobId)
    this.pump()
    return job
  }

  async cancel(jobId: string): Promise<'CANCELLED' | 'ALREADY_FINISHED' | 'NOT_FOUND'> {
    const job = await this.store.get(jobId)
    if (!job) return 'NOT_FOUND'
    if (isTerminal(job.status)) return 'ALREADY_FINISHED'
    const queued = this.queue.indexOf(jobId)
    if (queued >= 0) {
      this.queue.splice(queued, 1)
      this.urls.delete(jobId)
      await this.store.update(jobId, (j) => failJob(j, { code: 'CANCELLED', message: 'the analysis was cancelled' }, this.now().toISOString()))
      return 'CANCELLED'
    }
    this.running.get(jobId)?.abort(new DOMException('cancelled', 'AbortError'))
    return 'CANCELLED'
  }

  /** Resolves when nothing is queued or running. */
  async idle(): Promise<void> {
    while (this.queue.length > 0 || this.done.size > 0) await Promise.race([...this.done, new Promise((r) => setTimeout(r, 5))])
  }

  /** Stop accepting, cancel everything, wait for the workers to be gone. */
  async close(): Promise<void> {
    this.closed = true
    for (const id of [...this.queue]) await this.cancel(id)
    for (const controller of this.running.values()) controller.abort(new DOMException('service stopping', 'AbortError'))
    await Promise.allSettled([...this.done])
  }

  private pump(): void {
    while (!this.closed && this.running.size < this.limits.concurrency && this.queue.length > 0) {
      const jobId = this.queue.shift()!
      const url = this.urls.get(jobId)!
      this.urls.delete(jobId)
      const controller = new AbortController()
      this.running.set(jobId, controller)
      const task = this.run(jobId, url, controller).finally(() => {
        this.running.delete(jobId)
        this.done.delete(task)
        this.pump()
      })
      this.done.add(task)
    }
  }

  private async run(jobId: string, url: string, controller: AbortController): Promise<void> {
    const stamp = (): string => this.now().toISOString()
    const timer = setTimeout(() => controller.abort(new DOMException('job time limit', 'TimeoutError')), this.limits.jobTimeoutMs)
    let pending: Promise<unknown> = Promise.resolve()
    const onProgress = (event: AnalysisProgress): void => {
      pending = this.store.update(jobId, (j) => applyProgress(j, event, stamp()))
    }
    let failure: unknown
    try {
      const workDir = await this.store.workspace(jobId)
      const output = await this.executor.execute({ jobId, url, workDir }, { signal: controller.signal, onProgress })
      if (controller.signal.aborted) throw toAnalysisError(controller.signal.reason, controller.signal)
      await pending
      await this.store.saveResult(jobId, output)
      await this.store.update(jobId, (j) => completeJob(j, output.parsed, stamp()))
    } catch (error) {
      failure = error
      const e = error instanceof AnalysisError ? error : toAnalysisError(error, controller.signal)
      await pending.catch(() => undefined)
      await this.store.update(jobId, (j) => failJob(j, { code: e.code, message: e.message }, stamp()))
    } finally {
      clearTimeout(timer)
      await this.store.clearWorkspace(jobId).catch(() => undefined)
      const job = await this.store.get(jobId)
      if (job) this.events.onJobEnd?.(job, failure)
      await this.sweep().catch(() => undefined)
    }
  }

  /** Delete finished jobs past their time to live, then the oldest finished beyond the cap. */
  async sweep(): Promise<number> {
    const now = this.now().getTime()
    const finished = (await this.store.list()).filter((j) => isTerminal(j.status)).sort((a, b) => (a.completedAt ?? a.updatedAt).localeCompare(b.completedAt ?? b.updatedAt))
    let removed = 0
    for (const j of finished) {
      if (now - Date.parse(j.completedAt ?? j.updatedAt) > this.limits.resultTtlMs) {
        await this.store.delete(j.jobId)
        removed += 1
      }
    }
    const all = await this.store.list()
    const overflow = all.length - this.limits.maxStoredJobs
    if (overflow > 0) {
      const oldest = all.filter((j) => isTerminal(j.status)).sort((a, b) => (a.completedAt ?? a.updatedAt).localeCompare(b.completedAt ?? b.updatedAt))
      for (const j of oldest.slice(0, overflow)) {
        await this.store.delete(j.jobId)
        removed += 1
      }
    }
    return removed
  }
}
