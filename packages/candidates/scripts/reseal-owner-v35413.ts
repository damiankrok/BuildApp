import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { parseModel, serializeModel, loadModel } from '@buildapp/model'
const SRC = '/home/user/BuildApp/packages/candidates/src'
const out: Record<string, { old: string; new: string }> = {}
for (const d of readdirSync(SRC).filter((x) => x.startsWith('owner-'))) {
  for (const f of readdirSync(join(SRC, d)).filter((x) => x.endsWith('.model.json'))) {
    const p = join(SRC, d, f)
    const text = readFileSync(p, 'utf8')
    const before = serializeModel(parseModel(text))
    const oldSeal = createHash('sha256').update(before).digest('hex')
    const restated = text.replace('"schemaVersion": "1.8.0"', '"schemaVersion": "1.9.0"')
    const r = loadModel(restated)
    if (!r.ok || r.issues.some((i) => i.severity === 'ERROR' || i.code === 'SCHEMA_MIGRATED')) throw new Error(`${f}: ${JSON.stringify(r.issues.slice(0, 3))}`)
    // the building is byte for byte the one sealed: only the version string and the migration note differ
    const a = JSON.parse(before) as Record<string, unknown> & { meta: { notes: string[] } }
    const b = JSON.parse(serializeModel(r.model)) as Record<string, unknown> & { meta: { notes: string[] } }
    a.meta.notes = a.meta.notes.filter((n) => !n.includes('to 1.9.0'))
    a.schemaVersion = '1.9.0'
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${f}: differs beyond the version`)
    writeFileSync(p, restated)
    out[f.replace('.model.json', '')] = { old: oldSeal, new: createHash('sha256').update(serializeModel(r.model)).digest('hex') }
  }
}
console.log(JSON.stringify(out, null, 1))
