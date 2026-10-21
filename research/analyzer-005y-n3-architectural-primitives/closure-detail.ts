import { readFileSync } from 'node:fs'
import { validateModel } from '@buildapp/model'
import { compileBuilding, geometryClosureAudit } from '@buildapp/geometry'
const file = process.argv[process.argv.length - 1]
const v = validateModel(JSON.parse(readFileSync(file, 'utf8')))
const scene = compileBuilding(v.model!)
const closure = geometryClosureAudit(v.model!, scene)
for (const f of closure.findings) if (!process.env.CODE || f.code === process.env.CODE) console.log(JSON.stringify(f).slice(0, 600))
