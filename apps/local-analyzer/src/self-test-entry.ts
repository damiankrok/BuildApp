/**
 * The bundle the APK ships as `ocr-self-test.mjs` (005H): the OCR parity self-test and nothing of the analyzer. It
 * reads with the recogniser the analysis uses — the worker, WebAssembly and model beside it — and is loaded by
 * `main.mjs` only when the app asks for `--self-test ocr`.
 */
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { WASM_FILE, WATCHDOG, bundledAssetPaths, workerRecogniser } from '@buildapp/numeric-recogniser-ort/client'
import { runSelfTestProgram } from './self-test.js'

/**
 * `--watchdog-scale <1–100>` stretches the worker's watchdog for the self-test alone — for a CPU emulated in software
 * (an arm64 runtime under QEMU on a desktop reads a label in minutes, not tenths of a second). An analysis always runs
 * with the default watchdog; the app never passes this.
 */
function watchdogOf(argv: readonly string[]): { loadMs: number; cropMs: number } {
  const i = argv.indexOf('--watchdog-scale')
  const n = i >= 0 ? Number(argv[i + 1]) : 1
  const scale = Number.isFinite(n) ? Math.min(100, Math.max(1, n)) : 1
  return { loadMs: WATCHDOG.loadMs * scale, cropMs: WATCHDOG.cropMs * scale }
}

export async function runSelfTest(argv: readonly string[]): Promise<number> {
  const dir = dirname(fileURLToPath(import.meta.url))
  return runSelfTestProgram(argv, () => workerRecogniser({ workerUrl: pathToFileURL(join(dir, 'ocr-worker.mjs')), paths: bundledAssetPaths(dir), watchdog: watchdogOf(argv) }), { wasmPath: join(dir, WASM_FILE) })
}
