// TEST LAUNCHER ONLY: the production analyzer.mjs with the in-memory synthetic
// publisher instead of the production publishers, and the recogniser the bundle
// ships beside itself (005H) exactly as production registers it. Never shipped in
// the app APK.
import { bundledRecogniser, runProgram } from './analyzer.mjs'
import { fixtureWiring } from './fixture.mjs'

process.exitCode = await runProgram(process.argv.slice(2), { ...fixtureWiring(), recogniser: bundledRecogniser() })
