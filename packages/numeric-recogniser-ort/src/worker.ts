/**
 * The recogniser's worker: what `ocr-worker.mjs` runs in a `worker_threads` Worker beside the analyzer.
 *
 *   init        (workerData) the four file paths; the worker verifies them against the pins and opens the session,
 *               then says `ready`
 *   recognise   one batch of crops; the worker reads each (with its bracket), says `progress` after each, and answers
 *               `result` with the candidate records — never a value, never a decision
 *
 * The worker is terminated by its caller once it has answered (or when the run is cancelled); it never outlives one
 * batch, and the memory the WebAssembly instance held goes with it.
 */
import { parentPort, workerData } from 'node:worker_threads'
import type { ExternalReading, LabelCrop } from '@buildapp/source-metrics'
import { openEngine } from './engine.js'
import type { RecogniserAssetPaths } from './manifest.js'

export type WorkerRequest = {
  init: { paths: RecogniserAssetPaths }
  recognise: { type: 'recognise'; crops: LabelCrop[] }
}

export type WorkerReply =
  | { type: 'ready'; loadMs: number }
  | { type: 'progress'; done: number; total: number }
  | { type: 'result'; readings: ExternalReading[]; perCropMs: number[] }
  | { type: 'error'; message: string }

/** Run the worker's side of the protocol on `port`. */
export async function serveRecogniser(port: NonNullable<typeof parentPort>, init: WorkerRequest['init']): Promise<void> {
  const reply = (m: WorkerReply): void => port.postMessage(m)
  try {
    const engine = await openEngine(init.paths)
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
        reply({ type: 'result', readings, perCropMs })
      } catch (error) {
        reply({ type: 'error', message: (error as Error).message })
      }
    })
    reply({ type: 'ready', loadMs: engine.loadMs })
  } catch (error) {
    reply({ type: 'error', message: (error as Error).message })
  }
}

if (parentPort && workerData && typeof workerData === 'object' && 'paths' in workerData) void serveRecogniser(parentPort, workerData as WorkerRequest['init'])
