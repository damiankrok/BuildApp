/**
 * 005Y-N2 diagnostic (research only): compile a model.json with the production compiler and print its diagnostics
 * (what the viewer counts as errors and warnings) and the closure audit's findings by code (NON_MANIFOLD among them).
 *   npx vite-node research/analyzer-005y-n2-archon-topology/scene-diagnostics.ts -- <model.json>
 */
import { readFileSync } from 'node:fs'
import { validateModel } from '@buildapp/model'
import { compileBuilding, geometryClosureAudit } from '@buildapp/geometry'
const file = process.argv[process.argv.length - 1]
const v = validateModel(JSON.parse(readFileSync(file, 'utf8')))
if (!v.model) {
  console.log('INVALID', JSON.stringify(v).slice(0, 2000))
  process.exit(1)
}
const scene = compileBuilding(v.model)
for (const d of scene.diagnostics) console.log(JSON.stringify(d))
const closure = geometryClosureAudit(v.model, scene)
const byCode = new Map<string, number>()
for (const f of closure.findings) byCode.set(`${f.severity}:${f.code}`, (byCode.get(`${f.severity}:${f.code}`) ?? 0) + 1)
console.log(`meshes ${scene.meshes?.length ?? '?'}; diagnostics ${scene.diagnostics.length}; nonManifold ${closure.metrics.nonManifoldSolidCount}; closure ${JSON.stringify(Object.fromEntries(byCode))}`)
// Every mesh with a vertex inside a column (CHIMNEY_COLUMN="x0,x1,z0,z1"), and how high it reaches there.
if (process.env.CHIMNEY_COLUMN) {
  const [x0, x1, z0, z1] = process.env.CHIMNEY_COLUMN.split(',').map(Number)
  for (const m of scene.meshes) {
    let top = -Infinity
    let n = 0
    for (const t of m.triangles) for (const p of [t.a, t.b, t.c] as const) if (p.x >= x0 - 0.3 && p.x <= x1 + 0.3 && p.z >= z0 - 0.3 && p.z <= z1 + 0.3) { top = Math.max(top, p.y); n += 1 }
    if (n > 0) console.log(`${m.objectKind} ${m.objectId} ${m.part} tris ${m.triangles.length} top-in-column ${top.toFixed(3)}`)
  }
}
