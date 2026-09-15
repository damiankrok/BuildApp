/**
 * `npm run audit:marcowki:facades` — the four-facade source-registered
 * feature comparison (STAGE BUILDAPP-01A §16). Measures the compiled
 * Marcówki model orthographically against every registered elevation reading
 * and writes `stage-reports/artifacts/marcowki-facade-audit.json`. Exit code
 * 1 when a modelled feature cannot be found at all; deviations are reported,
 * each with the reading, the model figure, the difference and the note that
 * explains it.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMarcowkiReferenceBuilding } from '../src/index.js'
import { facadeAudit } from '../test/facade-audit.js'
import { marcowkiScene } from '../test/measure.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '../../../stage-reports/artifacts/marcowki-facade-audit.json')

const s = marcowkiScene(createMarcowkiReferenceBuilding())
const audit = facadeAudit(s)
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(audit, null, 2) + '\n')

const f = (v: number | undefined): string => (v === undefined || Number.isNaN(v) ? '—' : v.toFixed(3))
const range = (r?: [number, number]): string => (r ? (r[0] === r[1] ? f(r[0]) : `${f(r[0])}..${f(r[1])}`) : '—')
console.log(`Marcówki facade audit — ${audit.generatedFrom.modelId}, schema ${audit.generatedFrom.schemaVersion}, ${audit.generatedFrom.triangles} triangles`)
console.log(audit.method)
console.log('')
for (const facade of ['FRONT', 'REAR', 'EAST', 'WEST'] as const) {
  console.log(`== ${facade} ==`)
  console.log('status       id                             reading across     model across       reading up         model up           delta   tol')
  for (const r of audit.features.filter((x) => x.facade === facade)) {
    const readUp = r.reading.point ? `(${f(r.reading.point.across)}, ${f(r.reading.point.up)})` : range(r.reading.up)
    const modelUp = r.model?.point ? `(${f(r.model.point.across)}, ${f(r.model.point.up)})` : range(r.model?.up)
    console.log(`${r.status.padEnd(12)} ${r.id.padEnd(30)} ${range(r.reading.across).padEnd(18)} ${range(r.model?.across).padEnd(18)} ${readUp.padEnd(18)} ${modelUp.padEnd(18)} ${f(r.delta ?? undefined).padEnd(7)} ${r.tolerance.toFixed(2)}`)
    if (r.status === 'DEVIATION' && r.note) console.log(`             ↳ ${r.note}`)
  }
  console.log('')
}
console.log(`features ${audit.summary.features}: pass ${audit.summary.pass}, deviation ${audit.summary.deviation}, not modelled ${audit.summary.notModelled}, not found ${audit.summary.notFound}; worst delta ${audit.summary.worstDelta.toFixed(3)} m`)
console.log(`written ${OUT}`)
process.exit(audit.summary.notFound === 0 ? 0 : 1)
