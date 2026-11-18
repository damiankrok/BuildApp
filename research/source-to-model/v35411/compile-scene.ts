/**
 * v3.54.11 — compile a house document (its observations, by the current resolver and builder) and write its scene
 * bundle, for measurements of the model before review (`house-first.json`), which a run does not save as a scene.
 *   npx vite-node research/source-to-model/v35411/compile-scene.ts -- <house.json> <out scene.json>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { compileHouse } from '../../../packages/analysis-service/src/house/describe.js'

const [inp, out] = process.argv.slice(2).filter((a) => a !== '--')
const raw = JSON.parse(readFileSync(inp, 'utf8')) as Record<string, unknown>
const doc = { ...raw }
delete doc.geometry
delete doc.verification
const c = compileHouse(doc, 'compile-scene')
if (!c.bundle) throw new Error('no scene')
writeFileSync(out, JSON.stringify(c.bundle))
console.log(out, c.modelHash)
