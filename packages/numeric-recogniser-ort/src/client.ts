/**
 * The external numeric recogniser as source-metrics' `LabelRecogniser`, two ways round the same engine (`engine.ts`):
 *
 *   in a worker   (`workerRecogniser`, production): each batch starts a `worker_threads` Worker that verifies and loads
 *                 the WebAssembly runtime and the model, reads the batch, hands back candidate records and is
 *                 terminated — so the +160–200 MiB a live ONNX Runtime instance holds (005G) is given back before the
 *                 analyzer goes on. Cancelling terminates the worker at once.
 *   in-process    (`inlineRecogniser`, `inline.ts`): the same engine on the calling thread, for tests and research
 *                 harnesses that read thousands of crops and want one session. Its memory stays until the process ends.
 *
 * Either way the recogniser sees crops and nothing else, and nothing it does reaches the network. This module imports
 * no ONNX Runtime: the analyzer that spawns the worker carries none of it.
 */
import { Worker } from 'node:worker_threads'
import type { ExternalReading, LabelCrop, LabelRecogniser, RecogniseOptions } from '@buildapp/source-metrics'
import { MANIFEST, MODEL, RECOGNISER_ID, RECOGNISER_RUNTIME, WASM_FILE } from './manifest.js'
import type { RecogniserAssetPaths } from './manifest.js'
import type { WorkerReply, WorkerRequest } from './worker.js'

/** What one batch cost: diagnostics only, never part of a reading. */
export type BatchStats = {
  crops: number
  loadMs: number
  ocrMs: number
  /** Per crop (its four reads), in the order read. */
  perCropMs: number[]
  /** Process resident memory around the batch (the worker shares the process): before it started, once the model was loaded, once the batch was read, once the worker was gone. */
  rss?: { beforeBytes: number; afterLoadBytes: number; afterOcrBytes: number; afterExitBytes: number }
  mode: 'WORKER' | 'INLINE'
}

export type OrtRecogniser = LabelRecogniser & {
  /** Every batch read so far, in order. */
  stats(): BatchStats[]
  release(): Promise<void>
}

/** The error a cancelled batch rejects with: the signal's own reason, or an AbortError. */
export const abortError = (signal?: AbortSignal): Error => (signal?.reason instanceof Error ? signal.reason : new DOMException('the recognition was cancelled', 'AbortError'))

/** Who reads: the recogniser's id, its model, its runtime and the runtime binary's pin (verified before every load). */
export const recogniserIdentity = { id: RECOGNISER_ID, model: { name: MODEL.file.replace(/\.onnx$/, ''), sha256: MODEL.sha256 }, runtime: RECOGNISER_RUNTIME, runtimeSha256: MANIFEST.runtime.files[WASM_FILE].sha256 } as const

/**
 * The production recogniser: one worker per batch, terminated as soon as the batch is read (or cancelled). `workerUrl`
 * is the bundled worker (`ocr-worker.mjs` beside the analyzer bundle); `paths` the verified files it loads.
 */
export function workerRecogniser(options: { workerUrl: URL; paths: RecogniserAssetPaths; rss?: () => number; clock?: () => number }): OrtRecogniser {
  const rss = options.rss ?? (() => process.memoryUsage.rss())
  const clock = options.clock ?? (() => performance.now())
  const history: BatchStats[] = []
  let live: Worker | undefined
  const recognise = (crops: readonly LabelCrop[], o: RecogniseOptions = {}): Promise<ExternalReading[]> => {
    if (crops.length === 0) return Promise.resolve([])
    if (o.signal?.aborted) return Promise.reject(abortError(o.signal))
    const beforeBytes = rss()
    const started = clock()
    const worker = new Worker(options.workerUrl, { workerData: { paths: options.paths } satisfies WorkerRequest['init'] })
    live = worker
    return new Promise<ExternalReading[]>((resolve, reject) => {
      let settled = false
      let afterLoadBytes = beforeBytes
      let loadMs = 0
      const finish = (outcome: { readings: ExternalReading[]; perCropMs: number[]; afterOcrBytes: number } | { error: unknown }): void => {
        if (settled) return
        settled = true
        o.signal?.removeEventListener('abort', onAbort)
        const done = (): void => {
          if (live === worker) live = undefined
          if ('error' in outcome) return reject(outcome.error)
          history.push({ crops: crops.length, loadMs, ocrMs: Math.round(clock() - started - loadMs), perCropMs: outcome.perCropMs, rss: { beforeBytes, afterLoadBytes, afterOcrBytes: outcome.afterOcrBytes, afterExitBytes: rss() }, mode: 'WORKER' })
          resolve(outcome.readings)
        }
        // The batch is over either way: the worker goes now, and the result is handed back once it has gone.
        worker.terminate().then(done, done)
      }
      const onAbort = (): void => finish({ error: abortError(o.signal) })
      o.signal?.addEventListener('abort', onAbort, { once: true })
      worker.on('message', (message: WorkerReply) => {
        if (message.type === 'ready') {
          afterLoadBytes = rss()
          loadMs = message.loadMs
          worker.postMessage({ type: 'recognise', crops: crops.map((c) => ({ key: c.key, capPx: c.capPx, gray: c.gray })) } satisfies WorkerRequest['recognise'])
        } else if (message.type === 'progress') {
          try {
            o.onProgress?.(message.done, message.total)
          } catch (error) {
            // a listener that cancels (the analysis checkpoint does) ends the batch, with its own error
            finish({ error })
          }
        } else if (message.type === 'result') finish({ readings: message.readings, perCropMs: message.perCropMs, afterOcrBytes: rss() })
        else if (message.type === 'error') finish({ error: new Error(`the recogniser worker failed: ${message.message}`) })
      })
      worker.on('error', (error) => finish({ error }))
      worker.on('exit', (code) => finish({ error: new Error(`the recogniser worker exited (${code}) before it answered`) }))
    })
  }
  return {
    ...recogniserIdentity,
    recognise,
    stats: () => history.slice(),
    release: async () => {
      const w = live
      live = undefined
      if (w) await w.terminate()
    },
  }
}

