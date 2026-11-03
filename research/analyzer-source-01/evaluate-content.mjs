// SOURCE-01 (research): BEFORE/AFTER routing from decide.ts output against pixel labels, for the publisher's roles and
// for adversarial (wrong) captions. Duplicate assets (same bytes on a page twice) are counted per asset.
//   node research/analyzer-source-01/evaluate-content.mjs <decisions.json> [--json out]
import { readFileSync, writeFileSync } from 'node:fs'
const argv = process.argv.slice(2)
const jsonOut = argv.includes('--json') ? argv[argv.indexOf('--json') + 1] : undefined
const decisions = JSON.parse(readFileSync(argv[0], 'utf8'))
const label = new Map()
for (const f of ['research/image-understanding/data/labels-archon.json', 'research/image-understanding/data/labels-archon-final.json', 'research/image-understanding/data/labels-archon-iu03a.json', 'research/image-understanding/data/labels-archon-iu03b.json', 'research/analyzer-source-01/labels-test-new.json', 'research/analyzer-source-01/labels-dev-new.json']) for (const r of JSON.parse(readFileSync(f, 'utf8')).rows) label.set(r.sha256, r.label)
const RIGHT = { FLOOR_PLAN: 'PLAN', ORTHOGRAPHIC_ELEVATION: 'FACADE', TECHNICAL_SECTION: 'SECTION', SITE_PLAN: 'SITE', EXTERIOR_PERSPECTIVE: 'EXTERIOR_CAMERA', INTERIOR_PERSPECTIVE: 'NONE' }
const PIX = { FLOOR_PLAN: 'FLOOR_PLAN', ORTHOGRAPHIC_ELEVATION: 'ELEVATION', TECHNICAL_SECTION: 'SECTION', SITE_PLAN: 'SITE_PLAN', EXTERIOR_PERSPECTIVE: 'EXTERIOR_PERSPECTIVE', INTERIOR_PERSPECTIVE: 'INTERIOR' }
function score(rows, useKey) {
  const s = { assets: 0, correctUse: 0, wronglyAdmitted: 0, wronglyRefused: 0, routing: {}, errors: [] }
  for (const d of rows) {
    const truth = label.get(d.sha256); if (!truth) continue
    const right = RIGHT[truth]; const use = d[useKey]
    s.assets++; s.routing[right] = s.routing[right] ?? {}; s.routing[right][use] = (s.routing[right][use] ?? 0) + 1
    if (use === right) s.correctUse++
    else if (use === 'NONE') { s.wronglyRefused++; s.errors.push({ kind: 'WRONGLY_REFUSED', house: d.house, sha256: d.sha256, truth, claimed: d.claimed ?? d.adversarialClaim, top: d.top, p: d.topProbability }) }
    else { s.wronglyAdmitted++; s.errors.push({ kind: 'WRONGLY_ADMITTED', house: d.house, sha256: d.sha256, truth, claimed: d.claimed ?? d.adversarialClaim, use, top: d.top, p: d.topProbability }) }
  }
  s.coverage = Object.fromEntries(Object.entries(s.routing).map(([k, v]) => [k, `${v[k] ?? 0}/${Object.values(v).reduce((a, b) => a + b, 0)}`]))
  return s
}
const real = decisions.filter((d) => !d.adversarialClaim)
const adv = decisions.filter((d) => d.adversarialClaim && d.claimedUse !== RIGHT[label.get(d.sha256)])
// pixel classification confusion (top class vs label) and decision counts
const confusion = {}; const decisionCounts = {}; let pixErr = 0
for (const d of real) { const t = label.get(d.sha256); if (!t) continue; confusion[t] = confusion[t] ?? {}; confusion[t][d.top] = (confusion[t][d.top] ?? 0) + 1; if (PIX[t] !== d.top) pixErr++; decisionCounts[d.decision] = (decisionCounts[d.decision] ?? 0) + 1 }
const out = {
  pixels: { assets: real.length, topClassErrors: pixErr, confusion, decisions: decisionCounts },
  realCaptions: { before: score(real, 'claimedUse'), after: score(real, 'use') },
  wrongCaptions: { before: score(adv, 'claimedUse'), after: score(adv, 'use') },
}
const brief = (s) => ({ assets: s.assets, correctUse: s.correctUse, wronglyAdmitted: s.wronglyAdmitted, wronglyRefused: s.wronglyRefused, coverage: s.coverage })
console.log(JSON.stringify({ pixels: out.pixels, realBefore: brief(out.realCaptions.before), realAfter: brief(out.realCaptions.after), wrongBefore: brief(out.wrongCaptions.before), wrongAfter: brief(out.wrongCaptions.after), realAfterErrors: out.realCaptions.after.errors, wrongAfterErrors: out.wrongCaptions.after.errors.filter((e) => e.kind === 'WRONGLY_ADMITTED') }, null, 1))
if (jsonOut) writeFileSync(jsonOut, `${JSON.stringify(out, null, 1)}\n`)
