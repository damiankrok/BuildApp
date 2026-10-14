#!/usr/bin/env node
/**
 * results.mjs — BUILDPLAN-ANALYZER-005Q: the wall-strip synthetic results and the G10 record, written from vitest JSON
 * reports (RESEARCH ONLY; never imported by production).
 *
 * From the repository root, with <out> a directory outside the repository and <work> the frozen variant
 * (`synth/oracle-config.mjs`'s header):
 *
 *   npx vitest run packages/reconstruction/test/wall-strip.test.ts packages/reconstruction/test/wall-strip-unit.test.ts packages/reconstruction/test/wall-strip-invariance.test.ts --reporter=json --outputFile=<out>/production.json
 *   npx vitest run --config <work>/oracle.config.mjs --reporter=json --outputFile=<out>/frozen.json
 *   node research/analyzer-005q/synth/results.mjs --production <out>/production.json --frozen <out>/frozen.json
 *
 * writes stage-reports/artifacts/analyzer-005q/synthetic-results.json (every test of wall-strip.test.ts and
 * wall-strip-unit.test.ts: production passed/failed, frozen passed/failed/absent) and order-invariance.json (G10 at unit
 * level, wall-strip-unit.test.ts, beside the end-to-end order and placement tests of wall-strip-invariance.test.ts).
 * Test titles only: no pixel, no path outside the repository, no house. The fixtures are made up.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../../..')
const OUT = join(REPO, 'stage-reports/artifacts/analyzer-005q')
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0) throw new Error(`usage: results.mjs --production <report.json> --frozen <report.json>`)
  return resolve(process.argv[i + 1])
}
const production = JSON.parse(readFileSync(arg('production'), 'utf8'))
const frozen = JSON.parse(readFileSync(arg('frozen'), 'utf8'))

const STRIP = 'packages/reconstruction/test/wall-strip.test.ts'
const UNIT = 'packages/reconstruction/test/wall-strip-unit.test.ts'
const INVARIANCE = 'packages/reconstruction/test/wall-strip-invariance.test.ts'
const COMMANDS = [
  `npx vitest run ${STRIP} ${UNIT} ${INVARIANCE} --reporter=json --outputFile=<out>/production.json`,
  'npx vitest run --config <work>/oracle.config.mjs --reporter=json --outputFile=<out>/frozen.json   (<work>: node research/analyzer-005q/variant.mjs setup --work <work>; node research/analyzer-005q/synth/oracle-config.mjs --work <work> — the frozen 005Q base 04d5568, outside the repository; it runs wall-strip.test.ts only)',
  'node research/analyzer-005q/synth/results.mjs --production <out>/production.json --frozen <out>/frozen.json',
]

/** Every assertion of a report, keyed by file, describe titles and title. */
function testsOf(report) {
  const out = new Map()
  for (const f of report.testResults) {
    const file = f.name.startsWith(REPO) ? f.name.slice(REPO.length + 1) : f.name
    for (const a of f.assertionResults) out.set(`${file}\u0000${a.ancestorTitles.join(' > ')}\u0000${a.title}`, { file, describe: a.ancestorTitles.join(' > '), title: a.title, status: a.status })
  }
  return out
}
const prod = testsOf(production)
const froz = testsOf(frozen)
for (const file of [STRIP, UNIT, INVARIANCE]) if (![...prod.values()].some((t) => t.file === file)) throw new Error(`the production report has no ${file}`)
if (![...froz.values()].some((t) => t.file === STRIP)) throw new Error(`the frozen report has no ${STRIP}`)

// --- synthetic-results.json ---------------------------------------------------
const UNIT_FAMILY = 17
const familyOf = (t) => {
  if (t.file === UNIT) return [UNIT_FAMILY, 'G10 at unit level (wallStripsOf on a hand-built reading)']
  const m = /^005Q wall strip — (\d+)\. (.*)$/.exec(t.describe)
  if (!m) throw new Error(`no family in ${t.describe}`)
  return [Number(m[1]), m[2]]
}
const familyNames = new Map()
const tests = [...prod.entries()]
  .filter(([, t]) => t.file === STRIP || t.file === UNIT)
  .map(([key, t]) => {
    const [family, name] = familyOf(t)
    if (!familyNames.has(family)) familyNames.set(family, name)
    const f = froz.get(key)
    return { file: t.file, family, familyName: familyNames.get(family), group: t.describe, test: t.title, production: t.status, frozen: f ? f.status : 'absent' }
  })
const families = [...new Set(tests.map((t) => t.family))].sort((a, b) => a - b).map((family) => {
  const ts = tests.filter((t) => t.family === family)
  return { family, name: familyNames.get(family), tests: ts.length, passOnProduction: ts.filter((t) => t.production === 'passed').length, failOnFrozen: ts.filter((t) => t.frozen === 'failed').length, passOnFrozen: ts.filter((t) => t.frozen === 'passed').length, absentOnFrozen: ts.filter((t) => t.frozen === 'absent').length }
})
const strip = tests.filter((t) => t.file === STRIP)
writeFileSync(
  join(OUT, 'synthetic-results.json'),
  `${JSON.stringify(
    {
      stage: 'BUILDPLAN-ANALYZER-005Q',
      rule: 'N1a wall strip (layout 1.2.0), after review rounds 1 and 2 (PROD3)',
      files: [STRIP, UNIT],
      fixtures: 'packages/reconstruction/test/wall-strip-plans.ts and the readings in wall-strip-unit.test.ts: made-up plans and readings, every dimension invented; no publisher drawing, no house',
      solver: 'production: reconstructV2 end to end (wall-strip.test.ts) and wallStripsOf directly (wall-strip-unit.test.ts); frozen: wall-strip.test.ts through the 005Q base 04d5568 via a Vite alias outside the repository (the unit test has no frozen counterpart: the base has no wallStripsOf, so it is "absent")',
      meaning: 'a test that fails on the frozen code is one where N1a fires and the frozen solver reads a terrace in the wall strip with a SOURCE_EXACT ring (or, family 16, carries it out to an outlined platform; four redraws there do not finish in the frozen solver, whose emitter refuses that terrace polygon, and are recorded in FROZEN_REFUSED); a test that passes on both is a hard negative asserted whole (the frozen outcome), not an endorsement of it',
      commands: COMMANDS,
      summary: {
        families: families.length,
        tests: tests.length,
        passOnProduction: tests.filter((t) => t.production === 'passed').length,
        failOnFrozen: tests.filter((t) => t.frozen === 'failed').length,
        passOnFrozen: tests.filter((t) => t.frozen === 'passed').length,
        absentOnFrozen: tests.filter((t) => t.frozen === 'absent').length,
        endToEnd: { tests: strip.length, passOnProduction: strip.filter((t) => t.production === 'passed').length, failOnFrozen: strip.filter((t) => t.frozen === 'failed').length, passOnFrozen: strip.filter((t) => t.frozen === 'passed').length },
      },
      families,
      tests: tests.map(({ file, ...rest }) => ({ ...rest, file })),
    },
    null,
    1,
  )}\n`,
)

// --- order-invariance.json -----------------------------------------------------
const unit = [...prod.values()].filter((t) => t.file === UNIT)
const invariance = [...prod.values()].filter((t) => t.file === INVARIANCE)
const group = (t) => t.describe.replace(/^005Q G10 \(unit\) — /, '')
writeFileSync(
  join(OUT, 'order-invariance.json'),
  `${JSON.stringify(
    {
      stage: 'BUILDPLAN-ANALYZER-005Q',
      gate: 'G10 (preregistration, Addendum C): band order, chain order, mirrored and rotated plans and ±0.2 px perturbations at the face-pair tolerances give the same decision — evaluated at unit level, as written',
      files: { unit: UNIT, endToEnd: INVARIANCE },
      commands: COMMANDS.filter((c) => !c.includes('oracle.config')),
      unitLevel: {
        function: 'wallStripsOf(base, envelope) from packages/reconstruction/src/layout.ts, called directly on a PlanReading reduced to the fields it and envelopeStrips read (bands, decomposition.wallThickness.px, wallPx, extent, frame.id, registration metresPerPixelX/Y)',
        decision: 'the set of sides named; per side the gap what, status, frame, reason (so the depth text at the scale across the strip and the cover as a whole percent) and the gap id side prefix; backOn on every body; and, by bisection on backOn, the strip back edge and the covered stretches at nine points along it (to 1e-9 px after the transform: the cover itself is exposed only as the whole percent)',
        cases: [
          { case: 'A', what: 'two bodies on one front strip (a house open on it, a garage beside the covered stretch and a body behind the house not); the front wall in two overlapping pieces; walls 18 px, 0.012 × 0.01 m/px', decides: 'front strip, 0.17 m, 56 %; house on it, garage and the body behind not' },
          { case: 'B', what: 'two strips, front and east, a 58 px door in the front wall; a main body on both strips and a set-back body on the front strip only', decides: 'east 0.21 m 100 %, front 0.17 m 90 %; main on both, set-back body on the front only' },
          { case: 'C', what: 'a front strip deeper than the modal wall (24 px front wall over 18 px walls), reachable only at unit level', decides: 'front 0.24 m 100 %; the house on it (the back edge is the inner edge, 24 px from the outer one)' },
          { case: 'D', what: 'the cover bound: one 150 px piece on the 600 px front strip, a cover of exactly 0.25', decides: 'named at 0.25 and at +0.2 px, not at −0.2 px: the one place the decision may flip, and still the same under every symmetry' },
        ],
        transforms: ['id', 'mirrorX', 'mirrorY', 'turn90', 'turn180', 'turn270', 'transpose', 'antitranspose (the eight symmetries of the sheet; a quarter turn swaps the band axes and the two scales)'],
        bandOrders: ['reversed', 'rotated by one', 'shuffled with seeds 7, 1009 and 65537'],
        perturbations: ['every coordinate alone (each band face and end, the extent, the envelope, each body) by +0.2 and −0.2 px', 'every coordinate at once, jittered within ±0.2 px (twelve seeds), as drawn and under the eight symmetries'],
        margins: 'each reading’s distance to every bound of the rule is computed in the test and must exceed what ±0.2 px can move it (the margin tests’ titles give the tightest bound per case)',
        chainOrder: 'not an input of wallStripsOf (it reads no chain); held end to end in wall-strip-invariance.test.ts',
        summary: { tests: unit.length, passed: unit.filter((t) => t.status === 'passed').length, failed: unit.filter((t) => t.status !== 'passed').length },
        results: unit.map((t) => ({ group: group(t), test: t.title, status: t.status })),
      },
      endToEnd: {
        fixture: 'a made-up 600 × 360 px ring of 18 px walls at 0.026 m/px with chains cx, cy and cy2 [60, 403, 420]: the face-pair mechanism, no publisher drawing',
        perturbations: ['band order through sheetCache: reversed, rotated, shuffled (seeds 7, 1009)', 'chain order: reversed, inner chain first, depth chains first', 'translation (1, 0), (0, 1), (1, 1), (37, 23) px: the same decision and words (ids hash the pixel rectangle and are not compared)', 'mirrored and turned: the wall is either cut on its outer face (no strip) or named on the side it is drawn on'],
        summary: { tests: invariance.length, passed: invariance.filter((t) => t.status === 'passed').length, failed: invariance.filter((t) => t.status !== 'passed').length },
        results: invariance.map((t) => ({ group: t.describe.replace(/^005Q /, ''), test: t.title, status: t.status })),
      },
      endToEndOrientation:
        'End to end, a mirror or a quarter turn can change whether the base cuts the body on the wall’s inner face at all: the band claim upstream (plan-decomposition.ts:509, unchanged and identical in the 005Q base) breaks a tie between the wall’s two faces toward the lower pixel, so in some orientations the body is cut on the outer face and there is no strip (wall-strip.test.ts family 13: family 1 mirrored top–bottom or turned 90°; family 16: the L and the platform fixture likewise). The rule names the strip exactly where the base reads one, on the side the wall is drawn on (family 13 and 16 redraws; wall-strip-invariance.test.ts, both outcomes exercised). That dependence is a property of the base, not of the rule; G10 is evaluated on the rule, at unit level.',
      corpus: 'PROD3 and PROD3-rep (see prod-vs-harness.json)',
    },
    null,
    1,
  )}\n`,
)
process.stdout.write(`synthetic-results.json: ${tests.length} tests (${families.length} families); order-invariance.json: ${unit.length} unit, ${invariance.length} end-to-end\n`)
