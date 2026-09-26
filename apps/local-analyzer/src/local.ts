/**
 * The analyzer, run on the device that asked for it.
 *
 *   URL ─► runAnalysis (the one production pipeline) ─► files + timings + memory
 *
 * This is the whole of the "local analyzer": a scratch directory for the
 * fetched bytes, a call to `runAnalysis` exactly as the HTTP API's worker makes
 * it, and the same four delivery files (`analysisFilesOf`). There is no second
 * solver, no second geometry kernel and no mobile variant of any stage — the
 * Android app runs this module's bundle in its embedded Node runtime, and the
 * desktop runs the same source under Node 22; the parity tests hold the two to
 * the same hashes.
 *
 * What this module adds is only what a phone needs around the pipeline:
 *
 *  - the fetched source bytes live in `workDir/bytes` and are removed when the
 *    run ends — completed, failed or cancelled — so no source image outlives
 *    the analysis that needed it;
 *  - where the time went (`AnalysisRun.timings`) and how much memory the
 *    process needed (`memorySample`), because on a phone both are the cost.
 *
 * The wiring has no vision member on purpose: the app carries no provider key,
 * so the deterministic analyzer runs alone and the result says so.
 */
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { analysisFilesOf, runAnalysis } from '@buildapp/analysis-service'
import type { AnalysisFiles, AnalysisProgress, AnalysisRun, AnalysisTimings } from '@buildapp/analysis-service'
import { fileByteCache } from '@buildapp/source-package'
import type { FetchDeps, FetchPolicy, SourceAdapter } from '@buildapp/source-package'
import { memorySample } from './memory.js'
import type { MemorySample } from './memory.js'

/** What a local runtime registers: the publishers it trusts and, in tests only, a network seam. No vision provider. */
export type LocalWiring = { adapters: readonly SourceAdapter[]; deps?: FetchDeps; policy?: FetchPolicy }

export type LocalAnalysisRequest = {
  url: string
  /** This job's private scratch directory. The run's byte cache is `workDir/bytes`, removed when the run ends. */
  workDir: string
  wiring: LocalWiring
  signal?: AbortSignal
  progress?: (event: AnalysisProgress) => void
  jobId?: string
  now?: () => Date
}

export type LocalAnalysisOutput = {
  run: AnalysisRun
  files: AnalysisFiles
  timings: AnalysisTimings
  memory: MemorySample
}

/** The scratch directory a run keeps its fetched bytes in. */
export const bytesDirOf = (workDir: string): string => join(workDir, 'bytes')

export async function runLocalAnalysis(request: LocalAnalysisRequest): Promise<LocalAnalysisOutput> {
  const bytesDir = bytesDirOf(request.workDir)
  try {
    const run = await runAnalysis(
      { kind: 'URL', url: request.url },
      {
        adapters: request.wiring.adapters,
        deps: request.wiring.deps,
        policy: request.wiring.policy,
        // An empty cache in this job's own scratch directory, as the API's worker does.
        cache: fileByteCache(bytesDir),
        jobId: request.jobId,
        signal: request.signal,
        progress: request.progress,
        now: request.now,
      },
    )
    return { run, files: analysisFilesOf(run), timings: run.timings, memory: memorySample() }
  } finally {
    // Success, failure or cancel: the source bytes go. Only the result is kept.
    await rm(bytesDir, { recursive: true, force: true })
  }
}
