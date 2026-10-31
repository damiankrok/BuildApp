/**
 * LINK-F1 (research only): the exterior joint findings of a sealed run's model.json, through this checkout's compiler.
 *   npx vite-node research/analyzer-link-f1/closure-findings.ts -- <model.json>...
 */
import { readFileSync } from 'node:fs'
import { compileBuilding, geometryClosureAudit } from '@buildapp/geometry'
import { parseModel } from '@buildapp/model'

for (const file of process.argv.slice(2).filter((a) => a.endsWith('.json'))) {
  const model = parseModel(readFileSync(file, 'utf8'))
  const scene = compileBuilding(model)
  const report = geometryClosureAudit(model, scene)
  const ext = report.findings.filter((f) => f.scope === 'EXTERIOR')
  console.log(file, JSON.stringify({ metrics: { ext: report.metrics.exteriorFindingCount, int: report.metrics.interiorFindingCount }, ext: ext.map((f) => `${f.severity} ${f.code} ${f.objects.join(' + ')} ${f.measure} ${f.unit}: ${f.message}`) }, null, 1))
}
