/** v3.54.1: how large is each answer schema the reader sends (properties, optional ones, unions)? Grammar limits of
 * the API's strict mode: 24 optional properties and 16 union-typed properties per request. */
import { HOUSE_TRIAGE_SCHEMA, houseDescriptionJsonSchema } from '@buildapp/source-vision'
type N = Record<string, unknown>
function walk(n: unknown, acc = { props: 0, optional: 0, unions: 0, enums: 0, chars: 0 }) {
  if (!n || typeof n !== 'object') return acc
  const o = n as N
  if (o.properties && typeof o.properties === 'object') {
    const keys = Object.keys(o.properties as N)
    const req = new Set((o.required as string[]) ?? [])
    acc.props += keys.length
    acc.optional += keys.filter((k) => !req.has(k)).length
    for (const k of keys) {
      const p = (o.properties as N)[k] as N
      if (p && (p.anyOf || Array.isArray(p.type))) acc.unions++
    }
  }
  if (o.enum) acc.enums++
  for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v, acc)
  return acc
}
for (const [name, s] of [['triage', HOUSE_TRIAGE_SCHEMA], ['description', houseDescriptionJsonSchema()]] as const) console.log(name, JSON.stringify({ ...walk(s), chars: JSON.stringify(s).length, top: (s as N).type }))
