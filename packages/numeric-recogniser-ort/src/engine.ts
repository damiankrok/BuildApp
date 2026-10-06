/**
 * One ONNX Runtime Web session over the pinned model, and the reading of one crop through it.
 *
 * The runtime is configured so that nothing can reach the network and nothing runs but this: one thread (no worker
 * pool, no SharedArrayBuffer), no proxy worker, the WebAssembly binary handed over as the verified bytes
 * (`wasmBinary`) rather than located, and its loader imported from a private copy of the verified bytes — written to a
 * fresh temporary directory and removed on release, so the code that runs is the code that was hashed. The model is
 * handed over as verified bytes too.
 *
 * The temporary directory is `$TMPDIR` read from `process.env`, not `os.tmpdir()`: Node reads that through
 * `safeGetenv`, which ignores the environment in a process the kernel marks AT_SECURE — as Android may mark an app
 * process — and falls back to `/tmp`, which Android does not have. Where no private copy can be written, the loader is
 * imported from the file it was verified from, a moment before. A session is opened per batch of crops and released after it (`release`); the process
 * that holds it is the one that gives its memory back — which is why the analyzer runs it in a worker that exits.
 */
import * as ort from 'onnxruntime-web'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { ExternalReading, LabelCrop } from '@buildapp/source-metrics'
import { BRACKET, variantOf } from './bracket.js'
import { MODEL, RECOGNISER_ID, RECOGNISER_RUNTIME, WASM_LOADER_FILE, verifiedAssets } from './manifest.js'
import type { RecogniserAssetPaths } from './manifest.js'
import { classesOf, digitClasses, digitPrefixBeam, greedyDecode, paddleTensor } from './paddle.js'
import type { GrayImage } from './paddle.js'

export type Engine = {
  /** One forward pass: the class probabilities per frame. */
  infer(gray: GrayImage): Promise<{ probs: Float32Array; T: number; C: number }>
  read(crop: LabelCrop): Promise<ExternalReading>
  release(): Promise<void>
  loadMs: number
}

/** Where opening the engine has got to: the files verified, then the session created (the WebAssembly compiled). */
export type EngineStep = 'VERIFIED' | 'SESSION'

/** Open a session over the verified model. Refuses unpinned files before the runtime sees a byte of them. */
export async function openEngine(paths: RecogniserAssetPaths, clock: () => number = () => performance.now(), onStep?: (step: EngineStep) => void): Promise<Engine> {
  const started = clock()
  const assets = verifiedAssets(paths)
  const classes = classesOf(assets.dictionary)
  if (classes.length !== MODEL.dictionary.classes) throw new Error(`the dictionary gives ${classes.length} classes, the manifest ${MODEL.dictionary.classes}`)
  onStep?.('VERIFIED')
  const privateLoader = (): { file: string; dir: string } | undefined => {
    try {
      const dir = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'ort-loader-'))
      const file = join(dir, WASM_LOADER_FILE)
      writeFileSync(file, assets.wasmLoader, { mode: 0o600 })
      return { file, dir }
    } catch {
      return undefined
    }
  }
  const copy = privateLoader()
  const removeLoader = (): void => {
    if (copy) rmSync(copy.dir, { recursive: true, force: true })
  }
  let session: ort.InferenceSession
  try {
    const loader = copy?.file ?? paths.wasmLoader
    ort.env.wasm.numThreads = 1
    ort.env.wasm.proxy = false
    ort.env.wasm.wasmBinary = assets.wasm
    ort.env.wasm.wasmPaths = { mjs: pathToFileURL(loader).href }
    ort.env.logLevel = 'error'
    session = await ort.InferenceSession.create(assets.model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all', intraOpNumThreads: 1, interOpNumThreads: 1, logSeverityLevel: 3 })
  } catch (error) {
    removeLoader()
    throw error
  }
  onStep?.('SESSION')
  const digits = digitClasses(classes)
  const input = session.inputNames[0]
  const output = session.outputNames[0]
  let released = false

  const infer: Engine['infer'] = async (gray) => {
    if (released) throw new Error('the recogniser session was released')
    const { data, dims } = paddleTensor(gray)
    const result = await session.run({ [input]: new ort.Tensor('float32', data, dims) })
    const o = result[output]
    const [, T, C] = o.dims as readonly number[]
    if (C !== classes.length) throw new Error(`the model emits ${C} classes, the dictionary ${classes.length}`)
    return { probs: o.data as Float32Array, T, C }
  }

  /** The crop as cut and the bracket's three variants; the candidates and the model's own answer from the first. */
  const read: Engine['read'] = async (crop) => {
    const variants: ExternalReading['variants'] = []
    let base: Pick<ExternalReading, 'topK' | 'greedy'> = { topK: [], greedy: { text: '', meanP: 0 } }
    for (const variant of BRACKET) {
      const { probs, T, C } = await infer(variantOf(crop.gray, variant))
      const topK = digitPrefixBeam(probs, T, C, digits)
      if (variant === 'BASE') base = { topK, greedy: greedyDecode(probs, T, C, classes) }
      variants.push({ variant, top: topK[0]?.text ?? '', p: topK[0]?.p ?? 0 })
    }
    const stable = variants.every((v) => v.top === variants[0].top)
    return { key: crop.key, engine: RECOGNISER_ID, modelSha256: MODEL.sha256, runtime: RECOGNISER_RUNTIME, topK: base.topK, greedy: base.greedy, stable, variants }
  }

  return {
    infer,
    read,
    loadMs: Math.round(clock() - started),
    release: async () => {
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
