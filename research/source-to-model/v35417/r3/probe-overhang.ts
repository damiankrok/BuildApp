/** v3.54.17 R3 probe: an all-round overhang on a delivered model — which exterior joints the closure audit names, and why. */
import { readFileSync } from 'node:fs'
import { parseModel } from '@buildapp/model'
import { compileBuilding, geometryClosureAudit } from '@buildapp/geometry'
const [file, roofId, oh, trim] = process.argv.slice(2)
const raw = JSON.parse(readFileSync(file, 'utf8'))
const m0 = parseModel(JSON.stringify(raw.model ?? raw))
const variants: Array<[string, (r: (typeof m0.roofs)[number]) => (typeof m0.roofs)[number]]> = [
  ['as delivered', (r) => r],
  [`overhang ${oh}`, (r) => ({ ...r, overhang: Number(oh) })],
  [`overhang ${oh} trimmed ${trim}`, (r) => ({ ...r, overhang: Number(oh), plateInset: { ...(r.plateInset ?? {}), [trim]: Number(oh) } })],
]
for (const [name, f] of variants) {
  const m = { ...m0, roofs: m0.roofs.map((r) => (r.id === roofId ? f(r) : r)) }
  const scene = compileBuilding(m)
  const c = geometryClosureAudit(m, scene)
  const errs = c.findings.filter((x) => x.scope === 'EXTERIOR' && x.severity === 'ERROR')
  console.log(name, errs.length)
  for (const e of errs) console.log('  ', e.code, e.objects.join('+'), JSON.stringify(e).slice(0, 400))
}
