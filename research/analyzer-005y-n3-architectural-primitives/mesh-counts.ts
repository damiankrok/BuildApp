/** 005Y-N3 diagnostic (research only): triangle count per compiled mesh (`objectId part`), one line each, sorted. */
import { readFileSync } from 'node:fs'
import { validateModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
const v = validateModel(JSON.parse(readFileSync(process.argv[process.argv.length - 1], 'utf8')))
const scene = compileBuilding(v.model!)
for (const d of scene.diagnostics) console.log('DIAG', d.code, d.objectId ?? '')
for (const l of scene.meshes.map((m) => `${m.objectId} ${m.part} ${m.triangles.length}`).sort()) console.log(l)
