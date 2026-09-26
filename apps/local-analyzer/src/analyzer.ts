/**
 * The bundle the APK ships as `analyzer.mjs`: the production pipeline and the
 * program around it, as a module with no side effects of its own. The app
 * starts it through `main.mjs` (`runtime/main.mjs`), which registers the
 * production publishers; a test launcher can register an in-memory publisher
 * instead and still run these exact bytes.
 */
export { LOCAL_ANALYZER_PROTOCOL, OUTPUT_FILES, EXIT, parseProgramArgs, runProgram, runtimeFacts } from './program.js'
export { runLocalAnalysis } from './local.js'
export { localWiring } from './wiring.js'
