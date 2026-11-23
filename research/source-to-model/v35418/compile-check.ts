/** v3.54.18 — what the compiler does not cut in a model file: `compile-check.ts <model.json>` prints the diagnostics by code and each uncut opening. */
import { readFileSync } from 'node:fs'
import { compileBuilding } from '@buildapp/geometry'
const m = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const d = compileBuilding(m).diagnostics
const by: Record<string, number> = {}
for (const i of d) by[`${i.severity}:${i.code}`] = (by[`${i.severity}:${i.code}`] ?? 0) + 1
console.log(JSON.stringify(by))
for (const i of d.filter((x) => x.severity === 'ERROR')) console.log(i.message.slice(0, 220))
