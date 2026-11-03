/**
 * SOURCE-01: the image-content encoder's engine — the ONNX Runtime session over the pinned model — and the in-process
 * embedder for tests and research. Only the worker (`image-role-worker.ts`) and those load this file; the analyzer
 * bundle reaches the encoder through `image-role-client.ts`, which imports no runtime.
 */
import * as ort from 'onnxruntime-web'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { MANIFEST, WASM_FILE, WASM_LOADER_FILE, readPinned } from './manifest.js'
import { IMAGE_ROLE, abortError, identity } from './image-role-client.js'
import type { ImageRolePaths, OrtImageEmbedder } from './image-role-client.js'

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

