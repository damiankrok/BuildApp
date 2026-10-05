/**
 * The recogniser's pins: which model, from where, by which hash; which runtime files, by which hash. One JSON file
 * (`models/manifest.json`) read by the fetch tool, the bundler, the session and the tests, so a pin is written once.
 *
 * Every file is verified against its pin before it is used — the model before ONNX Runtime sees it, the WebAssembly
 * binary before it is instantiated, the loader before it is imported — and a mismatch is refused, never repaired.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import manifestJson from '../models/manifest.json'

export type RecogniserManifest = {
  schema: 'buildapp.numeric-recogniser-manifest'
  version: number
  default: string
  recogniser: { id: string; runtime: string }
  models: Record<
    string,
    {
      upstream: { host: string; repo: string; commit: string; file: string }
      file: string
      sha256: string
      bytes: number
      dictionary: { source: string; sourceSha256: string; key: string; file: string; sha256: string; entries: number; classes: number }
      license: { spdx: string; evidence: string; notice: string; text: string }
      trainingData: string
    }
  >
  runtime: { package: string; version: string; license: { spdx: string; text: string; notices: string }; files: Record<string, { sha256: string; bytes: number }> }
  licenses: Record<string, { source: string; sha256: string }>
}

export const MANIFEST = manifestJson as RecogniserManifest
export const MODEL = MANIFEST.models[MANIFEST.default]
export const RECOGNISER_ID = MANIFEST.recogniser.id
export const RECOGNISER_RUNTIME = MANIFEST.recogniser.runtime
export const WASM_FILE = 'ort-wasm-simd-threaded.wasm' as const
export const WASM_LOADER_FILE = 'ort-wasm-simd-threaded.mjs' as const

/** Where the four files live: the model, its dictionary, the WebAssembly binary and its loader. */
export type RecogniserAssetPaths = { model: string; dictionary: string; wasm: string; wasmLoader: string }

/** The layout the local analyzer ships: the runtime beside the bundle, the model under `models/`. */
export const bundledAssetPaths = (dir: string): RecogniserAssetPaths => ({
  model: join(dir, 'models', MODEL.file),
  dictionary: join(dir, 'models', MODEL.dictionary.file),
  wasm: join(dir, WASM_FILE),
  wasmLoader: join(dir, WASM_LOADER_FILE),
})

/** The development layout: the fetched model in this package's `models/`, the runtime in `onnxruntime-web`'s `dist/`. */
export function workspaceAssetPaths(): RecogniserAssetPaths {
  const here = dirname(fileURLToPath(import.meta.url))
  const resolve = createRequire(import.meta.url).resolve
  return {
    model: join(here, '..', 'models', MODEL.file),
    dictionary: join(here, '..', 'models', MODEL.dictionary.file),
    wasm: resolve(`onnxruntime-web/${WASM_FILE}`),
    wasmLoader: resolve(`onnxruntime-web/${WASM_LOADER_FILE}`),
  }
}

export const sha256Hex = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex')

export class RecogniserAssetError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecogniserAssetError'
  }
}

/** Read one file and refuse it unless it is the pinned bytes. */
export function readPinned(path: string, pin: { sha256: string; bytes?: number }, what: string): Uint8Array {
  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(readFileSync(path))
  } catch {
    throw new RecogniserAssetError(`${what} is missing`)
  }
  const sha = sha256Hex(bytes)
  if (sha !== pin.sha256 || (pin.bytes !== undefined && bytes.length !== pin.bytes)) throw new RecogniserAssetError(`${what}: SHA-256 ${sha} (${bytes.length} B), pinned ${pin.sha256} — refused`)
  return bytes
}

/** The verified bytes. The loader's bytes are kept so the engine runs exactly them, not a later read of the file (red team B2). */
export type VerifiedAssets = { model: Uint8Array; dictionary: string[]; wasm: Uint8Array; wasmLoader: Uint8Array }

/** Read and verify the four files. Nothing is fetched: a file that is not here and pinned is an error. */
export function verifiedAssets(paths: RecogniserAssetPaths): VerifiedAssets {
  const model = readPinned(paths.model, MODEL, `the model ${MODEL.file}`)
  const dictionaryBytes = readPinned(paths.dictionary, MODEL.dictionary, `the dictionary ${MODEL.dictionary.file}`)
  const dictionary = JSON.parse(Buffer.from(dictionaryBytes).toString('utf8')) as string[]
  if (!Array.isArray(dictionary) || dictionary.length !== MODEL.dictionary.entries) throw new RecogniserAssetError(`the dictionary ${MODEL.dictionary.file} does not hold ${MODEL.dictionary.entries} entries`)
  const wasm = readPinned(paths.wasm, MANIFEST.runtime.files[WASM_FILE], WASM_FILE)
  const wasmLoader = readPinned(paths.wasmLoader, MANIFEST.runtime.files[WASM_LOADER_FILE], WASM_LOADER_FILE)
  return { model, dictionary, wasm, wasmLoader }
}

/** Whether all four files are present and pinned, without loading anything. */
export function assetsPresent(paths: RecogniserAssetPaths): boolean {
  try {
    verifiedAssets(paths)
    return true
  } catch {
    return false
  }
}
