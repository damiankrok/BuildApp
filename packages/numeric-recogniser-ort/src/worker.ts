/**
 * The recogniser's worker: what `ocr-worker.mjs` runs in a `worker_threads` Worker beside the analyzer.
 *
 *   init        (workerData) the four file paths; the worker verifies them against the pins and opens the session,
 *               then says `ready`
 *   recognise   one batch of crops; the worker reads each (with its bracket), says `progress` after each, and answers
 *               `result` with the candidate records — never a value, never a decision
 *
 * While it loads it says `loading` after each step (the files verified, the session created), so a caller that
 * listens hears it before the first label. It releases the session before it answers, and is terminated by its caller
 * once it has answered (or when the run is cancelled); it never outlives one batch, and the memory the WebAssembly
 * instance held goes with it. It has no network: `fetch` here throws, so a code path that tried would fail by name.
 */
import { parentPort, workerData } from 'node:worker_threads'
import type { ExternalReading, LabelCrop } from '@buildapp/source-metrics'
import { openEngine } from './engine.js'
import type { EngineStep } from './engine.js'
import type { RecogniserAssetPaths } from './manifest.js'

export type WorkerRequest = {
  init: { paths: RecogniserAssetPaths }
  recognise: { type: 'recognise'; crops: LabelCrop[] }
}

export type WorkerReply =
  | { type: 'loading'; step: EngineStep }
  | { type: 'ready'; loadMs: number }
  | { type: 'progress'; done: number; total: number }
  | { type: 'result'; readings: ExternalReading[]; perCropMs: number[] }
  | { type: 'error'; name: string; message: string }

/** The worker reaches nothing: a `fetch` anywhere in it — ONNX Runtime's included — fails at once, by name. */
export function forbidNetwork(scope: { fetch?: unknown } = globalThis): void {
  Object.defineProperty(scope, 'fetch', {
    configurable: true,
    writable: false,
    value: () => Promise.reject(new Error('the recogniser has no network: fetch is not available in its worker')),
  })
}

const failure = (error: unknown): WorkerReply => ({ type: 'error', name: (error as Error)?.name ?? 'Error', message: (error as Error)?.message ?? String(error) })

/** Run the worker's side of the protocol on `port`. */
export async function serveRecogniser(port: NonNullable<typeof parentPort>, init: WorkerRequest['init']): Promise<void> {
  const reply = (m: WorkerReply): void => port.postMessage(m)
  try {
    forbidNetwork()
    const engine = await openEngine(init.paths, undefined, (step) => reply({ type: 'loading', step }))
    port.on('message', async (message: WorkerRequest['recognise']) => {
      if (message?.type !== 'recognise') return
      try {
        const readings: ExternalReading[] = []
        const perCropMs: number[] = []
        for (const [i, crop] of message.crops.entries()) {
          const t0 = performance.now()
          readings.push(await engine.read(crop))
          perCropMs.push(Math.round(performance.now() - t0))
          reply({ type: 'progress', done: i + 1, total: message.crops.length })
        }
        // the session goes before the answer does: nothing of it is held while the caller takes the result
        await engine.release()
        reply({ type: 'result', readings, perCropMs })
      } catch (error) {
        reply(failure(error))
      }
    })
    reply({ type: 'ready', loadMs: engine.loadMs })
  } catch (error) {
    reply(failure(error))
  }
}

if (parentPort && workerData && typeof workerData === 'object' && 'paths' in workerData) void serveRecogniser(parentPort, workerData as WorkerRequest['init'])
