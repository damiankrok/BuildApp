/**
 * @buildapp/numeric-recogniser-ort — the external numeric recogniser (BUILDPLAN-ANALYZER-005H): PaddleOCR
 * PP-OCRv6_tiny_rec on ONNX Runtime Web (WebAssembly, one thread), behind source-metrics' `LabelRecogniser`.
 * The only package in the repository that imports `onnxruntime-web`.
 */
export { recogniserIdentity, workerRecogniser } from './client.js'
export type { BatchStats, OrtRecogniser } from './client.js'
export { inlineRecogniser } from './inline.js'
export { MANIFEST, MODEL, RECOGNISER_ID, RECOGNISER_RUNTIME, WASM_FILE, WASM_LOADER_FILE, RecogniserAssetError, assetsPresent, bundledAssetPaths, readPinned, sha256Hex, verifiedAssets, workspaceAssetPaths } from './manifest.js'
export type { RecogniserAssetPaths, RecogniserManifest, VerifiedAssets } from './manifest.js'
export { DECODER, classesOf, digitClasses, digitPrefixBeam, greedyDecode, paddleTensor, resizeBilinear } from './paddle.js'
export type { GrayImage } from './paddle.js'
export { BRACKET, variantOf } from './bracket.js'
export { openEngine } from './engine.js'
export type { Engine } from './engine.js'
export type { WorkerReply, WorkerRequest } from './worker.js'
