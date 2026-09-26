// TEST LAUNCHER ONLY: the production analyzer.mjs with the in-memory synthetic
// publisher instead of the production publishers. Never shipped in the app APK.
import { runProgram } from './analyzer.mjs'
import { fixtureWiring } from './fixture.mjs'

process.exitCode = await runProgram(process.argv.slice(2), fixtureWiring())
