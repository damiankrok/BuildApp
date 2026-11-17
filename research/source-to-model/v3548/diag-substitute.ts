/**
 * v3.54.8 — DIAGNOSTIC ONLY: a manual substitution into an observations document, built by the production builder.
 *   npx vite-node research/source-to-model/v3548/diag-substitute.ts -- <observations.json> <patch.json> <out dir>
 * The patch sets fields of named elevation openings and features, or adds features:
 *   { "label": "...", "elevations": { "<el id>": { "openings": { "<o id>": {…} }, "featureFields": { "<f id>": {…} }, "features": [ … ] } } }
 * A field set to null is removed. Its values come from a documented source (the sealed truth's registrations, in the
 * elevation's own pixels), never from a reading. Every result is labelled MANUAL_DIAGNOSTIC and is never an automatic run;
 * the only path is the public one: observations → compileHouse (resolver, builder, kernel, measurement).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { compileHouse } from '../../../packages/analysis-service/src/house/describe.js'

type Fields = Record<string, unknown>
const [obsPath, patchPath, out] = process.argv.slice(2).filter((a) => a !== '--')
const doc = JSON.parse(readFileSync(obsPath, 'utf8'))
const patch = JSON.parse(readFileSync(patchPath, 'utf8')) as { label?: string; elevations: Record<string, { openings?: Record<string, Fields>; featureFields?: Record<string, Fields>; features?: Fields[] }> }
const set = (o: Fields, fields: Fields): void => {
  for (const [k, v] of Object.entries(fields)) if (v === null) delete o[k]; else o[k] = v
}
doc.origin = 'MANUAL_DIAGNOSTIC'
for (const [id, p] of Object.entries(patch.elevations)) {
  const el = doc.observations.elevations.find((e: { id: string }) => e.id === id)
  if (!el) throw new Error(`no elevation ${id}`)
  for (const [oid, fields] of Object.entries(p.openings ?? {})) set(el.openings.find((o: { id: string }) => o.id === oid), fields)
  for (const [fid, fields] of Object.entries(p.featureFields ?? {})) {
    const f = el.features.find((x: { id: string }) => x.id === fid)
    if (!f) throw new Error(`no feature ${fid} on ${id}`)
    set(f, fields)
  }
  el.features.push(...(p.features ?? []))
}
delete doc.geometry
delete doc.verification
const compiled = compileHouse(doc, 'house-diag')
mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'house.json'), `${JSON.stringify(compiled.document, null, 1)}\n`)
if (compiled.modelJson) writeFileSync(join(out, 'model.json'), compiled.modelJson)
const g = compiled.document.geometry
writeFileSync(join(out, 'summary.json'), `${JSON.stringify({ origin: 'MANUAL_DIAGNOSTIC', label: patch.label ?? null, modelHash: compiled.modelHash, compileErrors: compiled.compileErrors, kernelRefusals: compiled.built?.kernelRefusals.map((k) => ({ id: k.id, codes: k.codes })), failed: compiled.failed, frames: g?.frames, portals: g?.portals, balconies: g?.balconies, checks: compiled.document.verification.checks.filter((c) => c.id === 'facade-values-built'), knownDefects: compiled.document.verification.knownDefects }, null, 1)}\n`)
process.stdout.write(`${compiled.modelHash ?? 'no model'}\n`)
