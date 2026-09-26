/**
 * The analyzer service's process: configuration, store, runner, server.
 *
 * `node dist/server.mjs` in production (worker threads from `dist/worker.mjs`);
 * `npm run dev` runs the same wiring in-process from source.
 */
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadConfig } from './config.js'
import { InProcessExecutor, WorkerExecutor } from './executor.js'
import type { JobExecutor } from './executor.js'
import { createApiServer } from './http.js'
import { JobRunner } from './runner.js'
import { FileJobStore } from './store.js'
import { productionAdapters, productionWiring } from './wiring.js'

async function main(): Promise<void> {
  const config = loadConfig()
  const store = new FileJobStore(config.dataDir)
  const restored = await store.init()
  const workerScript = new URL('./worker.mjs', import.meta.url)
  const useWorker = config.executor === 'worker' && existsSync(fileURLToPath(workerScript))
  const executor: JobExecutor = useWorker ? new WorkerExecutor(workerScript, { memoryMb: config.workerMemoryMb }) : new InProcessExecutor(() => productionWiring())
  const log = config.log ? (line: Record<string, unknown>): void => void process.stdout.write(`${JSON.stringify(line)}\n`) : () => undefined
  const runner = new JobRunner(store, executor, config, () => new Date(), {
    onJobEnd: (job) => log({ t: new Date().toISOString(), msg: 'job ended', jobId: job.jobId, status: job.status, error: job.error?.code ?? null, startedAt: job.startedAt, completedAt: job.completedAt }),
  })
  await runner.sweep()
  const server = createApiServer({ config, store, runner, adapters: productionAdapters(), log })
  const sweeper = setInterval(() => void runner.sweep().catch(() => undefined), 10 * 60_000)
  sweeper.unref()
  server.listen(config.port, config.host, () => {
    log({ t: new Date().toISOString(), msg: 'listening', port: config.port, executor: useWorker ? 'worker' : 'inprocess', concurrency: config.concurrency, restoredJobs: restored.loaded, interruptedJobs: restored.interrupted })
  })
  const stop = (signal: string): void => {
    log({ t: new Date().toISOString(), msg: 'stopping', signal })
    server.close()
    void runner.close().finally(() => process.exit(0))
  }
  process.on('SIGTERM', () => stop('SIGTERM'))
  process.on('SIGINT', () => stop('SIGINT'))
}

main().catch((error: unknown) => {
  process.stderr.write(`analyzer-api failed to start: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
