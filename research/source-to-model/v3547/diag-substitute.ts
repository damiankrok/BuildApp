/**
 * v3.54.7 — DIAGNOSTIC ONLY: a manual substitution into an observations document, built by the production builder.
 *   npx vite-node research/source-to-model/v3547/diag-substitute.ts -- <observations.json> <patch.json> <out dir>
 * The patch adds or replaces fields of named elevation openings and adds elevation features
 * ({ "elevations": { "<el id>": { "openings": { "<o id>": {…fields} }, "features": [ …new features ] } } }). Its values come
 * from a documented source (the sealed source truth's registrations), not from a reading. Every result made this way is
 * labelled MANUAL_DIAGNOSTIC and is never an automatic run.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { compileHouse } from '../../../packages/analysis-service/src/house/describe.js'

const [obsPath, patchPath, out] = process.argv.slice(2).filter((a) => a !== '--')
const doc = JSON.parse(readFileSync(obsPath, 'utf8'))
const patch = JSON.parse(readFileSync(patchPath, 'utf8')) as { elevations: Record<string, { openings?: Record<string, Record<string, unknown>>; features?: Array<Record<string, unknown>> }> }
doc.origin = 'MANUAL_DIAGNOSTIC'
for (const [id, p] of Object.entries(patch.elevations)) {
  const el = doc.observations.elevations.find((e: { id: string }) => e.id === id)
  if (!el) throw new Error(`no elevation ${id}`)
  for (const [oid, fields] of Object.entries(p.openings ?? {})) Object.assign(el.openings.find((o: { id: string }) => o.id === oid), fields)
  el.features.push(...(p.features ?? []).map((f) => ({ ...f, origin: undefined })).map(({ origin, ...f }) => (void origin, f)))
}
delete doc.geometry
delete doc.verification
const compiled = compileHouse(doc, 'house-diag')
mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'house.json'), `${JSON.stringify(compiled.document, null, 1)}\n`)
if (compiled.modelJson) writeFileSync(join(out, 'model.json'), compiled.modelJson)
writeFileSync(join(out, 'summary.json'), `${JSON.stringify({ origin: 'MANUAL_DIAGNOSTIC', modelHash: compiled.modelHash, compileErrors: compiled.compileErrors, kernelRefusals: compiled.built?.kernelRefusals.map((k) => ({ id: k.id, codes: k.codes })), failed: compiled.failed, frames: compiled.document.geometry?.frames, heads: compiled.document.geometry?.openings.filter((o) => o.head).map((o) => ({ id: o.id, head: o.head })) }, null, 1)}\n`)
process.stdout.write(`${compiled.modelHash ?? 'no model'}\n`)
