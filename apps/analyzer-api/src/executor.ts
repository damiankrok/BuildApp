/**
 * How one job's analysis is executed.
 *
 * Both executors call the SAME `runAnalysis`; they differ only in where it
 * runs. Production uses `WorkerExecutor`: every job gets a worker thread of its
 * own, so the analyzer's long synchronous stretches never stall the server's
 * event loop (a phone polling for progress keeps getting answers), a
 * cancellation or a time limit can stop a job at once by terminating its
 * thread, and a job that exhausts its heap takes down its thread, not the
 * service. `InProcessExecutor` runs on the server's own thread, for tests and
 * local development.
 */
import { Worker } from 'node:worker_threads'
import { join } from 'node:path'
import { AnalysisError, runAnalysis, summaryOf, toAnalysisError } from '@buildapp/analysis-service'
import type { AnalysisProgress, LinkAnalysisSummary } from '@buildapp/analysis-service'
import { stableJson } from '@buildapp/source-common'
import { serializeModel } from '@buildapp/model'
import { fileByteCache } from '@buildapp/source-package'
import type { FetchDeps, FetchPolicy, SourceAdapter } from '@buildapp/source-package'
import type { VisionReasoner } from '@buildapp/source-vision'
import type { ResultFiles } from './store.js'

export type JobInput = { jobId: string; url: string; workDir: string }

export type JobOutput = ResultFiles & { parsed: LinkAnalysisSummary }

export interface JobExecutor {
  execute(input: JobInput, control: { signal: AbortSignal; onProgress: (event: AnalysisProgress) => void }): Promise<JobOutput>
}

/** What a runtime registers: the publishers it trusts, and optionally a network seam and a vision provider. */
export type AnalysisWiring = { adapters: readonly SourceAdapter[]; deps?: FetchDeps; policy?: FetchPolicy; vision?: VisionReasoner }

/** Run one job to its stored files. Shared by both executors and by the worker. */
export async function executeJob(input: JobInput, wiring: AnalysisWiring, control: { signal?: AbortSignal; onProgress?: (event: AnalysisProgress) => void }): Promise<JobOutput> {
  const run = await runAnalysis(
    { kind: 'URL', url: input.url },
    {
      adapters: wiring.adapters,
      deps: wiring.deps,
      policy: wiring.policy,
      vision: wiring.vision,
      // An empty cache in this job's own scratch directory: nothing is read from another job.
      cache: fileByteCache(join(input.workDir, 'bytes')),
      jobId: input.jobId,
      signal: control.signal,
      progress: control.onProgress,
    },
  )
  const summary = summaryOf(run.result)
  return {
    parsed: summary,
    summary: `${JSON.stringify(summary)}\n`,
    scene: run.sceneText,
    model: serializeModel(run.result.model),
    candidate: `${stableJson(run.result.candidate)}\n`,
  }
}

export class InProcessExecutor implements JobExecutor {
  constructor(private readonly wiring: () => AnalysisWiring) {}

  /**
   * On the server's own thread a stage cannot be interrupted, so a cancelled
   * or timed-out job is released at once and the run behind it stops at its
   * next checkpoint. Production uses the worker, which is terminated instead.
   */
  execute(input: JobInput, control: { signal: AbortSignal; onProgress: (event: AnalysisProgress) => void }): Promise<JobOutput> {
    const run = executeJob(input, this.wiring(), { signal: control.signal, onProgress: (e) => (control.signal.aborted ? undefined : control.onProgress(e)) })
    const stopped = new Promise<never>((_, reject) => {
      const fail = (): void => reject(toAnalysisError(control.signal.reason, control.signal))
      if (control.signal.aborted) fail()
      else control.signal.addEventListener('abort', fail, { once: true })
    })
    run.catch(() => undefined)
    stopped.catch(() => undefined)
    return Promise.race([run, stopped])
  }
}

/** Messages a job's worker sends back. */
export type WorkerMessage = { type: 'progress'; event: AnalysisProgress } | { type: 'done'; output: JobOutput } | { type: 'error'; code: AnalysisError['code']; message: string }

export class WorkerExecutor implements JobExecutor {
  constructor(
    private readonly script: URL,
    private readonly options: { memoryMb: number; env?: Record<string, string | undefined> },
  ) {}

  execute(input: JobInput, control: { signal: AbortSignal; onProgress: (event: AnalysisProgress) => void }): Promise<JobOutput> {
    return new Promise<JobOutput>((resolve, reject) => {
      if (control.signal.aborted) {
        reject(toAnalysisError(control.signal.reason, control.signal))
        return
      }
      const worker = new Worker(this.script, {
        workerData: input,
        resourceLimits: { maxOldGenerationSizeMb: this.options.memoryMb },
        ...(this.options.env ? { env: this.options.env } : {}),
        stdout: false,
        stderr: false,
      })
      let settled = false
      const settle = (fn: () => void): void => {
        if (settled) return
        settled = true
        control.signal.removeEventListener('abort', onAbort)
        fn()
      }
      const onAbort = (): void => {
        settle(() => reject(toAnalysisError(control.signal.reason, control.signal)))
        void worker.terminate()
      }
      control.signal.addEventListener('abort', onAbort, { once: true })
      worker.on('message', (message: WorkerMessage) => {
        if (message.type === 'progress') {
          if (!settled) control.onProgress(message.event)
        } else if (message.type === 'done') {
          settle(() => resolve(message.output))
        } else {
          settle(() => reject(new AnalysisError(message.code, message.message)))
        }
      })
      worker.on('error', (error: Error & { code?: string }) => {
        // a worker that hit its heap limit, or crashed: its message may carry internals, so it is not passed on
        const outOfMemory = error.code === 'ERR_WORKER_OUT_OF_MEMORY'
        settle(() => reject(new AnalysisError('ANALYSIS_FAILED', outOfMemory ? 'the analysis needed more memory than the service allows' : 'the analyzer stopped unexpectedly')))
      })
      worker.on('exit', () => {
        settle(() => reject(new AnalysisError('ANALYSIS_FAILED', 'the analyzer stopped unexpectedly')))
      })
    })
  }
}
