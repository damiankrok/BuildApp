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
  const { localWiring, runProgram } = await import('./analyzer.mjs')
  process.exitCode = await runProgram(argv, localWiring())
}
