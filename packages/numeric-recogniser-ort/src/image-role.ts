/**
 * SOURCE-01: the image-content encoder — MobileNetV4-conv-small (timm, Apache-2.0) exported to ONNX — on the same
 * ONNX Runtime Web (WebAssembly, one thread) and under the same rules as the numeric recogniser: every file verified
 * against its pin before the runtime sees it, the loader run from a private copy of the verified bytes, no network.
 *
 * It turns a 3×224×224 tensor (`source-analyzer/content.ts` makes it) into a 1280-value embedding. It decides
 * nothing: the head and the veto live in `source-analyzer`, which knows no runtime. Production runs it in a worker
 * per batch (`workerImageEmbedder`), so the memory a live runtime holds is given back before the analysis goes on.
 */
import * as ort from 'onnxruntime-web'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'
import imageRoleJson from '../models/image-role.json'
import { MANIFEST, WASM_FILE, WASM_LOADER_FILE, readPinned } from './manifest.js'

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

export type ImageRoleEngine = { embed(tensor: Float32Array): Promise<Float32Array>; release(): Promise<void>; loadMs: number }

/** Open one session over the verified model. Refuses unpinned files before the runtime sees a byte of them. */
export async function openImageRoleEngine(paths: ImageRolePaths, clock: () => number = () => performance.now()): Promise<ImageRoleEngine> {
  const started = clock()
  const model = readPinned(paths.model, IMAGE_ROLE, `the image encoder ${IMAGE_ROLE.file}`)
  const wasm = readPinned(paths.wasm, MANIFEST.runtime.files[WASM_FILE], WASM_FILE)
  const wasmLoader = readPinned(paths.wasmLoader, MANIFEST.runtime.files[WASM_LOADER_FILE], WASM_LOADER_FILE)
  let copy: { file: string; dir: string } | undefined
  try {
    const dir = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'ort-loader-'))
    const file = join(dir, WASM_LOADER_FILE)
    writeFileSync(file, wasmLoader, { mode: 0o600 })
    copy = { file, dir }
  } catch {
    copy = undefined
  }
  const removeLoader = (): void => {
    if (copy) rmSync(copy.dir, { recursive: true, force: true })
  }
  let session: ort.InferenceSession
  try {
    ort.env.wasm.numThreads = 1
    ort.env.wasm.proxy = false
    ort.env.wasm.wasmBinary = wasm
    ort.env.wasm.wasmPaths = { mjs: pathToFileURL(copy?.file ?? paths.wasmLoader).href }
    ort.env.logLevel = 'error'
    session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all', intraOpNumThreads: 1, interOpNumThreads: 1, logSeverityLevel: 3 })
  } catch (error) {
    removeLoader()
    throw error
  }
  const [n, c, h, w] = IMAGE_ROLE.input.dims
  let released = false
  return {
    loadMs: Math.round(clock() - started),
    async embed(tensor) {
      if (released) throw new Error('the image encoder session was released')
      if (tensor.length !== n * c * h * w) throw new Error(`the tensor holds ${tensor.length} values, the encoder takes ${n}×${c}×${h}×${w}`)
      const out = await session.run({ [IMAGE_ROLE.input.name]: new ort.Tensor('float32', tensor, IMAGE_ROLE.input.dims) })
      const e = out[IMAGE_ROLE.output.name].data as Float32Array
      if (e.length !== IMAGE_ROLE.output.values) throw new Error(`the encoder gave ${e.length} values, the manifest says ${IMAGE_ROLE.output.values}`)
      return new Float32Array(e)
    },
    async release() {
      if (released) return
      released = true
      try {
        await session.release()
      } finally {
        removeLoader()
      }
    },
  }
}

const abortError = (signal?: AbortSignal): Error => (signal?.reason instanceof Error ? signal.reason : new DOMException('the image classification was cancelled', 'AbortError'))
const identity = { id: IMAGE_ROLE.id, modelSha256: IMAGE_ROLE.sha256, runtime: IMAGE_ROLE_RUNTIME } as const

/** The engine on the calling thread, one session kept until `release`: tests and research harnesses. */
export function inlineImageEmbedder(paths: ImageRolePaths): OrtImageEmbedder {
  let engine: Promise<ImageRoleEngine> | undefined
  const history: ReturnType<OrtImageEmbedder['stats']> = []
  return {
    ...identity,
    async embed(tensors, signal) {
      if (tensors.length === 0) return []
      const fresh = engine === undefined
      engine ??= openImageRoleEngine(paths)
      const e = await engine
      const t0 = performance.now()
      const out: Float32Array[] = []
      for (const t of tensors) {
        if (signal?.aborted) throw abortError(signal)
        out.push(await e.embed(t))
      }
      history.push({ images: tensors.length, loadMs: fresh ? e.loadMs : 0, embedMs: Math.round(performance.now() - t0), mode: 'INLINE' })
      return out
    },
    stats: () => history.slice(),
    async release() {
      const held = engine
      engine = undefined
      if (held) await (await held).release()
    },
  }
}

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
