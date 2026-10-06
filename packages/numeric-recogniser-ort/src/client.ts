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

/** What one batch cost: diagnostics only, never part of a reading. Recorded however the batch ended. */
export type BatchStats = {
  crops: number
  loadMs: number
  ocrMs: number
  /** Per crop (its four reads), in the order read. */
  perCropMs: number[]
  /**
   * Process resident memory around the batch (the worker shares the process): before it started, once the model was
   * loaded, once the batch was read, once the worker was gone. A sample the batch never reached is absent.
   */
  rss?: { beforeBytes: number; afterLoadBytes?: number; afterOcrBytes?: number; afterExitBytes: number }
  mode: 'WORKER' | 'INLINE'
  /** READ, or how it ended without: a failure (its kind's error name) or a cancel. */
  outcome: 'READ' | 'FAILED' | 'CANCELLED'
  error?: string
}

/** A worker that gave no sign of life for longer than its watchdog allows (005H red team C3). */
export class RecogniserTimeout extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecogniserTimeout'
  }
}

/**
 * How long a worker may stay silent: while it loads (verifying ~19 MB, compiling the WebAssembly, creating the
 * session — about 0.3 s on a desktop, minutes under emulation) and between two labels (about 0.1 s). Generous on
 * purpose: they catch a worker that hangs, not one that is slow.
 */
export const WATCHDOG = { loadMs: 300_000, cropMs: 120_000 } as const

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
 * The production recogniser: one worker per batch, terminated as soon as the batch is read (or cancelled, or silent
 * past its watchdog). `workerUrl` is the bundled worker (`ocr-worker.mjs` beside the analyzer bundle); `paths` the
 * verified files it loads.
 */
export function workerRecogniser(options: { workerUrl: URL; paths: RecogniserAssetPaths; rss?: () => number; clock?: () => number; watchdog?: { loadMs: number; cropMs: number } }): OrtRecogniser {
  const rss = options.rss ?? (() => process.memoryUsage.rss())
  const clock = options.clock ?? (() => performance.now())
  const watchdog = options.watchdog ?? WATCHDOG
  const history: BatchStats[] = []
  // every batch in flight, so `release` ends all of them — not only the last one started
  const live = new Set<{ stop: (error: Error) => void; gone: Promise<void> }>()
  const recognise = (crops: readonly LabelCrop[], o: RecogniseOptions = {}): Promise<ExternalReading[]> => {
    if (crops.length === 0) return Promise.resolve([])
    if (o.signal?.aborted) return Promise.reject(abortError(o.signal))
    const beforeBytes = rss()
    const started = clock()
    const worker = new Worker(options.workerUrl, { workerData: { paths: options.paths } satisfies WorkerRequest['init'] })
    let markGone: () => void = () => undefined
    const gone = new Promise<void>((r) => (markGone = r))
    return new Promise<ExternalReading[]>((resolve, reject) => {
      let settled = false
      let afterLoadBytes: number | undefined
      let afterOcrBytes: number | undefined
      let loadMs = 0
      let timer: ReturnType<typeof setTimeout> | undefined
      const finish = (outcome: { readings: ExternalReading[]; perCropMs: number[] } | { error: unknown }): void => {
        if (settled) return
        settled = true
        if (timer) clearTimeout(timer)
        o.signal?.removeEventListener('abort', onAbort)
        const done = (): void => {
          live.delete(entry)
          markGone()
          const failed = 'error' in outcome
          const name = failed ? String((outcome.error as Error | undefined)?.name ?? 'Error') : undefined
          history.push({
            crops: crops.length,
            loadMs,
            ocrMs: Math.round(clock() - started - loadMs),
            perCropMs: failed ? [] : outcome.perCropMs,
            rss: { beforeBytes, ...(afterLoadBytes !== undefined ? { afterLoadBytes } : {}), ...(afterOcrBytes !== undefined ? { afterOcrBytes } : {}), afterExitBytes: rss() },
            mode: 'WORKER',
            outcome: !failed ? 'READ' : name === 'AbortError' ? 'CANCELLED' : 'FAILED',
            ...(failed ? { error: name } : {}),
          })
          if (failed) return reject(outcome.error)
          resolve(outcome.readings)
        }
        // The batch is over either way: the worker goes now, and the result is handed back once it has gone.
        worker.terminate().then(done, done)
      }
      const arm = (ms: number, what: string): void => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => finish({ error: new RecogniserTimeout(`the recogniser worker gave no sign of life for ${Math.round(ms / 1000)} s while ${what}`) }), ms)
        timer.unref?.()
      }
      const entry = { stop: (error: Error) => finish({ error }), gone }
      live.add(entry)
      const onAbort = (): void => finish({ error: abortError(o.signal) })
      o.signal?.addEventListener('abort', onAbort, { once: true })
      // A listener that throws — the analysis checkpoint does, to cancel — ends the batch with its own error.
      const tell = (done: number): void => {
        try {
          o.onProgress?.(done, crops.length)
        } catch (error) {
          finish({ error })
        }
      }
      arm(watchdog.loadMs, 'loading')
      worker.on('message', (message: WorkerReply) => {
        // a terminated worker's queued messages still arrive: once the batch is over, none of them is heard
        if (settled) return
        if (message.type === 'loading') {
          arm(watchdog.loadMs, 'loading')
          tell(0)
        } else if (message.type === 'ready') {
          afterLoadBytes = rss()
          loadMs = message.loadMs
          arm(watchdog.cropMs, 'reading a label')
          worker.postMessage({ type: 'recognise', crops: crops.map((c) => ({ key: c.key, capPx: c.capPx, gray: c.gray })) } satisfies WorkerRequest['recognise'])
        } else if (message.type === 'progress') {
          arm(watchdog.cropMs, 'reading a label')
          tell(message.done)
        } else if (message.type === 'result') {
          afterOcrBytes = rss()
          finish({ readings: message.readings, perCropMs: message.perCropMs })
        } else if (message.type === 'error') {
          const error = Object.assign(new Error(`the recogniser worker failed: ${message.message}`), message.code ? { code: message.code } : {})
          error.name = message.name
          finish({ error })
        }
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
      const all = [...live]
      for (const e of all) e.stop(new DOMException('the recogniser was released', 'AbortError'))
      await Promise.all(all.map((e) => e.gone))
    },
  }
}

