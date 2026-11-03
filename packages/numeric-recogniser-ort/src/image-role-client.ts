/**
* SOURCE-01 (runtime-free part: pins, layout, the worker client — no ONNX Runtime here): the image-content encoder — MobileNetV4-conv-small (timm, Apache-2.0) exported to ONNX — on the same
 * ONNX Runtime Web (WebAssembly, one thread) and under the same rules as the numeric recogniser: every file verified
 * against its pin before the runtime sees it, the loader run from a private copy of the verified bytes, no network.
 *
 * It turns a 3×224×224 tensor (`source-analyzer/content.ts` makes it) into a 1280-value embedding. It decides
 * nothing: the head and the veto live in `source-analyzer`, which knows no runtime. Production runs it in a worker
 * per batch (`workerImageEmbedder`), so the memory a live runtime holds is given back before the analysis goes on.
 */
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import imageRoleJson from '../models/image-role.json'
import { MANIFEST, WASM_FILE, WASM_LOADER_FILE } from './manifest.js'

export type ImageRoleManifest = {
  schema: 'buildapp.image-role-encoder'
  id: string
  file: string
  sha256: string
  bytes: number
  input: { name: string; dims: number[] }
  output: { name: string; values: number }
  upstream: { host: string; repo: string; revision: string; file: string; sha256: string }
  export: Record<string, string>
  license: { spdx: string; notice: string }
}
export const IMAGE_ROLE = imageRoleJson as ImageRoleManifest
export const IMAGE_ROLE_RUNTIME = `onnxruntime-web@${MANIFEST.runtime.version}/wasm-1-thread`

/** The model and the runtime's two files. */
export type ImageRolePaths = { model: string; wasm: string; wasmLoader: string }

export const bundledImageRolePaths = (dir: string): ImageRolePaths => ({ model: join(dir, 'models', IMAGE_ROLE.file), wasm: join(dir, WASM_FILE), wasmLoader: join(dir, WASM_LOADER_FILE) })

export function workspaceImageRolePaths(): ImageRolePaths {
  const here = dirname(fileURLToPath(import.meta.url))
  const resolve = createRequire(import.meta.url).resolve
  return { model: join(here, '..', 'models', IMAGE_ROLE.file), wasm: resolve(`onnxruntime-web/${WASM_FILE}`), wasmLoader: resolve(`onnxruntime-web/${WASM_LOADER_FILE}`) }
}

/** The embedder's structural shape: `source-analyzer`'s `ImageEmbedder`, which this package does not import. */
export type OrtImageEmbedder = {
  readonly id: string
  readonly modelSha256: string
  readonly runtime: string
  embed(tensors: Float32Array[], signal?: AbortSignal): Promise<Float32Array[]>
  release(): Promise<void>
  /** What each batch cost: diagnostics only. */
  stats(): Array<{ images: number; loadMs: number; embedMs: number; mode: 'WORKER' | 'INLINE'; rss?: { beforeBytes: number; afterLoadBytes?: number; afterExitBytes: number } }>
}

export const abortError = (signal?: AbortSignal): Error => (signal?.reason instanceof Error ? signal.reason : new DOMException('the image classification was cancelled', 'AbortError'))
export const identity = { id: IMAGE_ROLE.id, modelSha256: IMAGE_ROLE.sha256, runtime: IMAGE_ROLE_RUNTIME } as const

/** Worker protocol: `init` in workerData; one `embed` request; `ready`, `result` or `error` back. */
export type ImageRoleWorkerReply = { type: 'ready'; loadMs: number } | { type: 'result'; embeddings: Float32Array[] } | { type: 'error'; name: string; message: string }

/** Production: one worker per batch, terminated once it has answered (or the run is cancelled, or it stays silent). */
export function workerImageEmbedder(options: { workerUrl: URL; paths: ImageRolePaths; timeoutMs?: number; rss?: () => number }): OrtImageEmbedder {
  const rss = options.rss ?? (() => process.memoryUsage.rss())
  const history: ReturnType<OrtImageEmbedder['stats']> = []
  const live = new Set<Worker>()
  return {
    ...identity,
    embed(tensors, signal) {
      if (tensors.length === 0) return Promise.resolve([])
      if (signal?.aborted) return Promise.reject(abortError(signal))
      const beforeBytes = rss()
      const t0 = performance.now()
      const worker = new Worker(options.workerUrl, { workerData: { paths: options.paths } })
      live.add(worker)
      return new Promise<Float32Array[]>((resolve, reject) => {
        let settled = false
        let loadMs = 0
        let afterLoadBytes: number | undefined
        const timer = setTimeout(() => finish({ error: new Error(`the image encoder worker gave no answer in ${Math.round((options.timeoutMs ?? 600_000) / 1000)} s`) }), options.timeoutMs ?? 600_000)
        timer.unref?.()
        const onAbort = (): void => finish({ error: abortError(signal) })
        signal?.addEventListener('abort', onAbort, { once: true })
        const finish = (r: { embeddings: Float32Array[] } | { error: unknown }): void => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          signal?.removeEventListener('abort', onAbort)
          const done = (): void => {
            live.delete(worker)
            history.push({ images: tensors.length, loadMs, embedMs: Math.round(performance.now() - t0 - loadMs), mode: 'WORKER', rss: { beforeBytes, ...(afterLoadBytes !== undefined ? { afterLoadBytes } : {}), afterExitBytes: rss() } })
            if ('error' in r) reject(r.error)
            else resolve(r.embeddings)
          }
          worker.terminate().then(done, done)
        }
        worker.on('message', (m: ImageRoleWorkerReply) => {
          if (settled) return
          if (m.type === 'ready') {
            loadMs = m.loadMs
            afterLoadBytes = rss()
            worker.postMessage({ type: 'embed', tensors })
          } else if (m.type === 'result') finish({ embeddings: m.embeddings.map((e) => new Float32Array(e)) })
          else if (m.type === 'error') finish({ error: Object.assign(new Error(`the image encoder worker failed: ${m.message}`), { name: m.name }) })
        })
        worker.on('error', (error) => finish({ error }))
        worker.on('exit', (code) => finish({ error: new Error(`the image encoder worker exited (${code}) before it answered`) }))
      })
    },
    stats: () => history.slice(),
    async release() {
      await Promise.all([...live].map((w) => w.terminate()))
      live.clear()
    },
  }
}
