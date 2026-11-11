// The program the app's embedded Node runtime starts: the production analyzer
// (analyzer.mjs, beside this file) with the production publishers. One job per
// process; see apps/local-analyzer/src/program.ts for the arguments and events.
// `--self-test ocr` (005H) loads the OCR parity self-test (ocr-self-test.mjs)
// instead, and never the analyzer.
const argv = process.argv.slice(2)
if (argv.includes('--self-test')) {
  const { runSelfTest } = await import('./ocr-self-test.mjs')
  process.exitCode = await runSelfTest(argv)
} else {
  // A bundle that cannot be loaded must not end the process: an uncaught failure here is fatal to Node, which then
  // calls exit() — on Android that ends the whole :analyzer process, and the app can only say "it stopped". Caught,
  // the reason goes to stderr (logcat: BuildAppNode) and Node returns normally with exit code 4 (RUNTIME_EXITED).
  let analyzer
  try {
    analyzer = await import('./analyzer.mjs')
  } catch (error) {
    process.stderr.write(`local analyzer: the analyzer bundle could not be loaded: ${error?.stack ?? error}\n`)
    process.exitCode = 4
  }
  if (analyzer) process.exitCode = await analyzer.runProgram(argv, analyzer.localWiring())
}
