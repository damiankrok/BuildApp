/**
 * N9-01 (research only, offline, read-only): relation R1 (`roofLayersRelation`, production code) over model files —
 * the historical contrast of a model from before N8-03C and today's.
 *   npx vite-node research/analyzer-n9-01/r1-history.ts -- <label>=<model.json> …
 * Prints JSON; nothing is written.
 */
import { readFileSync } from 'node:fs'
import { parseModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import { roofLayersRelation } from '../../packages/analysis-service/src/assessment/index.js'

const out = process.argv.slice(2).filter((a) => a.includes('=')).map((a) => {
  const [label, path] = a.split('=')
  const model = parseModel(readFileSync(path, 'utf8'))
  const r = roofLayersRelation(model, compileBuilding(model))
  return { label, modelId: model.id, schemaVersion: model.schemaVersion, status: r.status, counts: r.counts, items: r.items.map((i) => ({ status: i.status, code: i.code, objects: i.objects, measured: i.measured, why: i.why })) }
})
console.log(JSON.stringify(out, null, 1))
