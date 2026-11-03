/**
 * SOURCE-01: the image encoder's worker (`image-role-worker.mjs` beside the analyzer bundle). It verifies and loads
 * the pinned model, embeds one batch of tensors, answers and is terminated by its caller. It has no network.
 */
import { parentPort, workerData } from 'node:worker_threads'
import { openImageRoleEngine } from './image-role.js'
import type { ImageRolePaths, ImageRoleWorkerReply } from './image-role-client.js'

/** As the recogniser's worker: a `fetch` anywhere in it fails at once, by name (not imported from `worker.ts`, whose
 * import would start the recogniser's own server on this worker's data). */
function forbidNetwork(scope: { fetch?: unknown } = globalThis): void {
  Object.defineProperty(scope, 'fetch', { configurable: true, writable: false, value: () => Promise.reject(new Error('the image encoder has no network: fetch is not available in its worker')) })
}

async function serve(port: NonNullable<typeof parentPort>, init: { paths: ImageRolePaths }): Promise<void> {
  const reply = (m: ImageRoleWorkerReply): void => port.postMessage(m)
  try {
    forbidNetwork()
    const engine = await openImageRoleEngine(init.paths)
    port.on('message', async (message: { type: 'embed'; tensors: Float32Array[] }) => {
      if (message?.type !== 'embed') return
      try {
        const embeddings: Float32Array[] = []
        for (const t of message.tensors) embeddings.push(await engine.embed(t))
        await engine.release()
        reply({ type: 'result', embeddings })
      } catch (error) {
        reply({ type: 'error', name: (error as Error)?.name ?? 'Error', message: (error as Error)?.message ?? String(error) })
      }
    })
    reply({ type: 'ready', loadMs: engine.loadMs })
  } catch (error) {
    reply({ type: 'error', name: (error as Error)?.name ?? 'Error', message: (error as Error)?.message ?? String(error) })
  }
}

if (parentPort && workerData?.paths) void serve(parentPort, workerData as { paths: ImageRolePaths })
