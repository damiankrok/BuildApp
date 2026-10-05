/**
 * `@buildapp/numeric-recogniser-ort/client`: what an analyzer that runs the recogniser in a worker needs, and nothing
 * that would put ONNX Runtime in its own bundle — the worker client, the pins and the asset layout.
 */
export { recogniserIdentity, workerRecogniser } from './client.js'
export type { BatchStats, OrtRecogniser } from './client.js'
export { MANIFEST, MODEL, RECOGNISER_ID, RECOGNISER_RUNTIME, WASM_FILE, WASM_LOADER_FILE, assetsPresent, bundledAssetPaths, sha256Hex } from './manifest.js'
export type { RecogniserAssetPaths } from './manifest.js'
