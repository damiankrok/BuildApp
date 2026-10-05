/**
 * The bundle the APK ships as `ocr-self-test.mjs` (005H): the OCR parity self-test and nothing of the analyzer. It
 * reads with the recogniser the analysis uses — the worker, WebAssembly and model beside it — and is loaded by
 * `main.mjs` only when the app asks for `--self-test ocr`.
 */
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { WASM_FILE, bundledAssetPaths, workerRecogniser } from '@buildapp/numeric-recogniser-ort/client'
import { runSelfTestProgram } from './self-test.js'

export async function runSelfTest(argv: readonly string[]): Promise<number> {
  const dir = dirname(fileURLToPath(import.meta.url))
  return runSelfTestProgram(argv, () => workerRecogniser({ workerUrl: pathToFileURL(join(dir, 'ocr-worker.mjs')), paths: bundledAssetPaths(dir) }), { wasmPath: join(dir, WASM_FILE) })
}
