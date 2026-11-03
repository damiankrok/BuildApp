// SOURCE-01 (research): confusion matrix and routing of the production roles (BEFORE) and of the roles with the content
// check applied (AFTER, when a decisions file is given) against pixel labels, on SourcePackages acquired by acquire.ts.
//   node research/analyzer-source-01/evaluate.mjs <pkg-dir> [decisions.json] [--json out.json]
import { readFileSync, writeFileSync } from 'node:fs'
import { assetsOf } from './assets-of.mjs'
const argv = process.argv.slice(2)
const jsonOut = argv.includes('--json') ? argv[argv.indexOf('--json') + 1] : undefined
const [dir, decisionsFile] = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--json')
const labelFiles = ['research/image-understanding/data/labels-archon.json', 'research/image-understanding/data/labels-archon-final.json', 'research/image-understanding/data/labels-archon-iu03a.json', 'research/image-understanding/data/labels-archon-iu03b.json', 'research/analyzer-source-01/labels-test-new.json', 'research/analyzer-source-01/labels-dev-new.json']
const label = new Map()
for (const f of labelFiles) { try { for (const r of JSON.parse(readFileSync(f, 'utf8')).rows) label.set(r.sha256, r.label) } catch { /* optional file */ } }
const decisions = decisionsFile ? new Map(JSON.parse(readFileSync(decisionsFile, 'utf8')).map((d) => [d.sha256, d])) : undefined
// The use a production role gives an image: which reader it reaches.
const USE = { FLOOR_PLAN: 'PLAN', ELEVATION: 'FACADE', SECTION: 'SECTION', SITE_PLAN: 'SITE', PERSPECTIVE_RENDER: 'EXTERIOR_CAMERA', DETAIL: 'NONE', CHROME: 'NONE', UNKNOWN: 'NONE' }
// The use the true content should get.
const RIGHT = { FLOOR_PLAN: 'PLAN', ORTHOGRAPHIC_ELEVATION: 'FACADE', TECHNICAL_SECTION: 'SECTION', SITE_PLAN: 'SITE', EXTERIOR_PERSPECTIVE: 'EXTERIOR_CAMERA', INTERIOR_PERSPECTIVE: 'NONE', OTHER: 'NONE' }
const rows = assetsOf(dir).filter((r) => label.has(r.sha256))
const unlabelled = assetsOf(dir).length - rows.length
const useOf = (r) => {
  const before = USE[r.roles.document] ?? 'NONE'
  if (!decisions) return before
  const d = decisions.get(r.sha256)
  return d ? d.use : before
}
const confusion = {}; const routing = {}; const errors = []
let admittedWrong = 0, refusedRight = 0, correct = 0, unknown = 0
for (const r of rows) {
  const truth = label.get(r.sha256)
  const role = decisions?.get(r.sha256)?.document ?? r.roles.document
  confusion[truth] = confusion[truth] ?? {}; confusion[truth][role] = (confusion[truth][role] ?? 0) + 1
  const use = useOf(r); const right = RIGHT[truth]
  routing[right] = routing[right] ?? {}; routing[right][use] = (routing[right][use] ?? 0) + 1
  if (use === right) correct++
  else if (use === 'NONE') { if (right !== 'NONE') { refusedRight++; errors.push({ kind: 'WRONGLY_REFUSED', house: r.house, sha256: r.sha256, truth, role, use }) } }
  else { admittedWrong++; errors.push({ kind: 'WRONGLY_ADMITTED', house: r.house, sha256: r.sha256, truth, role, use }) }
  if (role === 'UNKNOWN') unknown++
}
const out = { assets: rows.length, unlabelled, correctUse: correct, wronglyAdmitted: admittedWrong, wronglyRefused: refusedRight, unknownRole: unknown, coverage: Object.fromEntries(Object.entries(routing).map(([k, v]) => [k, `${v[k] ?? 0}/${Object.values(v).reduce((a, b) => a + b, 0)}`])), confusion, routing, errors }
console.log(JSON.stringify({ ...out, errors: out.errors.length }, null, 1))
if (jsonOut) writeFileSync(jsonOut, `${JSON.stringify(out, null, 1)}\n`)
