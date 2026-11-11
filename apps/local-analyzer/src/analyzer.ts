/**
 * The bundle the APK ships as `analyzer.mjs`: the production pipeline and the
 * program around it, as a module with one side effect of its own: the first
 * import below gives a runtime without ICU a strict UTF-8 decoder before any
 * library's module is evaluated (src/utf8-decoder.ts). Keep it first. The app
 * starts it through `main.mjs` (`runtime/main.mjs`), which registers the
 * production publishers; a test launcher can register an in-memory publisher
 * instead and still run these exact bytes.
 */
// FIRST: evaluated before every other module of the bundle (ESM evaluates imports in order)
export { UTF8_DECODER, installStrictUtf8Decoder, runtimeDecodesUtf8Strictly } from './utf8-decoder.js'
export { LOCAL_ANALYZER_PROTOCOL, OUTPUT_FILES, EXIT, parseProgramArgs, runProgram, runtimeFacts } from './program.js'
export { runLocalAnalysis } from './local.js'
export { RECOGNISER_WORKER_FILE, bundledRecogniser, localWiring } from './wiring.js'
export { installTextAdapter, nfd, rootCompare, runtimeHasIcu } from './text.js'
// v3.51: lets a launcher (and the bundle's own test) ask whether the decoders that need WebAssembly start in this runtime
export { decoderSelfCheck, startDecoders, SVG_WASM_FILE, WEBP_WASM_FILE } from '@buildapp/source-package'
