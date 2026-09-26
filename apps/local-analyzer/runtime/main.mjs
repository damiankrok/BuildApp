// The program the app's embedded Node runtime starts: the production analyzer
// (analyzer.mjs, beside this file) with the production publishers. One job per
// process; see apps/local-analyzer/src/program.ts for the arguments and events.
import { localWiring, runProgram } from './analyzer.mjs'

process.exitCode = await runProgram(process.argv.slice(2), localWiring())
