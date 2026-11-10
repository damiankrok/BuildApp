/**
 * v3.53.1: every joint-audit finding of a described model, with the objects it names — for the verdicts in
 * S53-CLOSURE-FINDINGS.json. Rebuilds a recorded description with the CURRENT builder; no reader is asked.
 * vite-node closure-findings.ts -- <description.json> [<description.json> ...]
 */
import { readFileSync } from 'node:fs'
import { basename, dirname } from 'node:path'
import { checkHouseDescription } from '@buildapp/source-vision'
import { reconstructFromHouseDescription } from '@buildapp/reconstruction'
import { compileBuilding, geometryClosureAudit } from '@buildapp/geometry'
import { parseModel } from '@buildapp/model'

for (const file of process.argv.slice(2).filter((a) => a !== '--' && a.endsWith('.json'))) {
  const slug = basename(dirname(file))
  const checked = checkHouseDescription(JSON.parse(readFileSync(file, 'utf8')))
  if (!checked.ok) {
    console.log(JSON.stringify({ slug, refused: checked.issues.filter((i) => i.severity === 'REJECT') }))
    continue
  }
  const built = reconstructFromHouseDescription(checked.description, slug)
  if (!built.ok) {
    console.log(JSON.stringify({ slug, modelRefused: built.reason }))
    continue
  }
  const model = parseModel(built.modelJson)
  const scene = compileBuilding(model)
  const closure = geometryClosureAudit(model, scene)
  const findings = closure.findings.map((f) => ({ code: f.code, severity: f.severity, scope: f.scope, objects: f.objects, relation: f.relation, intended: f.intended, measure: Number(f.measure.toFixed(4)), unit: f.unit, message: f.message.slice(0, 260) }))
  console.log(JSON.stringify({ slug, compileErrors: scene.diagnostics.filter((x) => x.severity === 'ERROR').map((x) => `${x.code} ${x.message}`.slice(0, 160)), exterior: findings.filter((f) => f.scope === 'EXTERIOR'), interior: findings.filter((f) => f.scope === 'INTERIOR').length, dropped: built.adjustments.filter((a) => /DROPPED|STOOD_IN|NOT_APPLIED/.test(a.code)), refused: built.refused }))
}
