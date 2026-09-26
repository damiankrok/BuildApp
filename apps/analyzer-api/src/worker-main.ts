/**
 * The body of a job's worker thread: run the one job it was started with,
 * report progress as it goes, send the result or a sanitised error, exit.
 *
 * The wiring is passed in so that the production worker (`worker.ts`) and a
 * test's worker register different publishers through the same code.
 */
import { parentPort, workerData } from 'node:worker_threads'
import { toAnalysisError } from '@buildapp/analysis-service'
import { executeJob } from './executor.js'
import type { AnalysisWiring, JobInput, WorkerMessage } from './executor.js'

export function serveAnalysisWorker(wiring: () => AnalysisWiring): void {
  const port = parentPort
  if (!port) throw new Error('serveAnalysisWorker must run in a worker thread')
  const input = workerData as JobInput
  const post = (message: WorkerMessage): void => port.postMessage(message)
  executeJob(input, wiring(), { onProgress: (event) => post({ type: 'progress', event }) }).then(
    (output) => post({ type: 'done', output }),
    (error: unknown) => {
      const e = toAnalysisError(error)
      post({ type: 'error', code: e.code, message: e.message })
    },
  )
}
