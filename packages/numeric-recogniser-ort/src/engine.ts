/**
 * One ONNX Runtime Web session over the pinned model, and the reading of one crop through it.
 *
 * The runtime is configured so that nothing can reach the network and nothing runs but this: one thread (no worker
 * pool, no SharedArrayBuffer), no proxy worker, the WebAssembly binary handed over as the verified bytes
 * (`wasmBinary`) rather than located, and its loader imported from the one verified file path. The model is handed
 * over as verified bytes too. A session is opened per batch of crops and released after it (`release`); the process
 * that holds it is the one that gives its memory back — which is why the analyzer runs it in a worker that exits.
 */
import * as ort from 'onnxruntime-web'
import { pathToFileURL } from 'node:url'
import type { ExternalReading, LabelCrop } from '@buildapp/source-metrics'
import { BRACKET, variantOf } from './bracket.js'
import { MODEL, RECOGNISER_ID, RECOGNISER_RUNTIME, verifiedAssets } from './manifest.js'
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

/** Open a session over the verified model. Refuses unpinned files before the runtime sees a byte of them. */
export async function openEngine(paths: RecogniserAssetPaths, clock: () => number = () => performance.now()): Promise<Engine> {
  const started = clock()
  const assets = verifiedAssets(paths)
  ort.env.wasm.numThreads = 1
  ort.env.wasm.proxy = false
  ort.env.wasm.wasmBinary = assets.wasm
  ort.env.wasm.wasmPaths = { mjs: pathToFileURL(assets.wasmLoaderPath).href }
  ort.env.logLevel = 'error'
  const session = await ort.InferenceSession.create(assets.model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all', intraOpNumThreads: 1, interOpNumThreads: 1, logSeverityLevel: 3 })
  const classes = classesOf(assets.dictionary)
  if (classes.length !== MODEL.dictionary.classes) throw new Error(`the dictionary gives ${classes.length} classes, the manifest ${MODEL.dictionary.classes}`)
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
      await session.release()
    },
  }
}
