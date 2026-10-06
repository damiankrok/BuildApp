/**
 * BUILDPLAN-ANALYZER-005K §10 / §28 — the gap evidence and the drawn-gap rule know the drawing, not the building.
 *
 * Whether a drawn gap is an opening may be read only from the raster, the wall line, its jambs and the decomposition's
 * own scale. A rule that upgrades a gap because the published footprint then agrees, because the house then
 * completes, because a refusal goes away, or because this gap on this sheet is known to be a window, would make the
 * outline agree with the figure it is later checked against. These tests hold, by the code itself, that it cannot:
 *
 *  - the classification and the rule import pixel types and the line reader only; the records import those and the
 *    outline's result type — nothing that holds a published fact, a model, a verdict or a source package;
 *  - their code names no published figure, area, footprint, refusal, outcome, verdict, truth, label, house, publisher
 *    or benchmark (M3: an outcome-circular rule fails here);
 *  - their numbers are a frozen set: a width, a position or a threshold that fits one sheet is a new literal, and
 *    fails here until it is argued for (M4: a house or publisher special case fails here); no gap id is ever a literal;
 *  - the product never turns the rule on: the apps and the service's own code pass it through, and only the research
 *    script and the tests ask for ON.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(import.meta.dirname, '../..')
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8')
const codeOf = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ')
const importsOf = (source: string): string[] => [...source.matchAll(/^\s*(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1])
/** The body of the function or const `name` (from its declaration to the next top-level declaration). */
const bodyOf = (source: string, name: string): string => {
  const start = source.search(new RegExp(`(?:function|const) ${name}\\b`))
  if (start < 0) throw new Error(`no ${name}`)
  const next = source.slice(start + 1).search(/\n(?:export )?(?:function|const|type) /)
  return source.slice(start, next < 0 ? undefined : start + 1 + next)
}
/** Code with its string and template literals emptied: the messages a decision explains itself with are not reads. */
const withoutStrings = (code: string): string => code.replace(/`[^`]*`/g, '""').replace(/'[^']*'/g, '""')
/** Numeric literals in code, string and template literals removed. */
const numbersIn = (code: string): string[] => [...new Set([...withoutStrings(code).matchAll(/(?<![\w.])(\d+(?:\.\d+)?)(?!\w)/g)].map((m) => m[1]))].sort()

const BOUNDARY = 'packages/reconstruction/src/boundary-evidence.ts'
const RECORDS = 'packages/reconstruction/src/gap-evidence.ts'
/** The functions that decide a gap and the rule's conditions. */
const RULE = ['classifyGap', 'drawnGapCheck', 'solidShare', 'inkShare', 'drawnSignature', 'JAMB_SOLID']

/** What a gap decision or record may never be read from (§10). Matched on code, comments removed. */
const FORBIDDEN = /publish|footprint|\barea\b|areaM2|refus|outcome|verdict|truth|oracle|expected|\bhouse\b|slug|family|archon|dobredomy|projektydomow|gold|benchmark|holdout|blind|label_source|modelHash|reconstruct|metrics\./i
/** Development and blind houses by name: a special case for one of them is a special case (M4). */
const HOUSES = /gozdzik|cyklamen|marcowk|rarytas|kosac|jarzab|arkadi|azali|helikon|morel|zurawk|miranda|modrzew|modrzyk|jablonk|dabecj|tunbergi|milorzeb|aster|galaktyk|eoze/i

describe('005K §10 the gap rule and its records read the drawing only', () => {
  it('the classification and the rule import pixel types and the common helpers only', () => {
    expect([...new Set(importsOf(read(BOUNDARY)))].sort()).toEqual(['@buildapp/source-common', '@buildapp/source-cv'])
  })

  it('the records import those, the boundary’s own types and the outline’s result type — nothing else', () => {
    expect([...new Set(importsOf(read(RECORDS)))].sort()).toEqual(['./boundary-evidence.js', './boundary-outline.js', '@buildapp/source-common', '@buildapp/source-cv'])
  })

  it('no rule or record code names a published figure, an area, a refusal, an outcome, a verdict, a truth or a house (M3)', () => {
    const boundary = codeOf(read(BOUNDARY))
    for (const name of RULE) expect(withoutStrings(bodyOf(boundary, name)).match(FORBIDDEN), name).toBeNull()
    for (const name of ['withCallout', 'because']) expect(withoutStrings(bodyOf(boundary, name)).match(FORBIDDEN), name).toBeNull()
    expect(withoutStrings(codeOf(read(RECORDS))).match(FORBIDDEN)).toBeNull()
  })

  it('the records are built from the reading’s own walls, mask, scale and outline — the call site hands them nothing else', () => {
    const decomposition = codeOf(read('packages/reconstruction/src/plan-decomposition.ts'))
    const call = decomposition.slice(decomposition.indexOf('gapEvidenceRecords('), decomposition.indexOf('gapEvidenceRecords(') + 400).split('\n')[0]
    expect(call).toMatch(/gapEvidenceRecords\(\{ mask, wallsX: outlineWalls\.x, wallsY: outlineWalls\.y, mppX, mppY, wallPx, decompositionId, outline, drawnGapRule \}\)/)
    const id = decomposition.slice(decomposition.indexOf('decompositionIdOf('), decomposition.indexOf('decompositionIdOf(') + 300).split('\n')[0]
    expect(id).not.toMatch(FORBIDDEN)
  })

  it('the decomposition’s options carry nothing published: a decoy figure cannot reach a gap', () => {
    const decomposition = read('packages/reconstruction/src/plan-decomposition.ts')
    const options = decomposition.slice(decomposition.indexOf('export type PlanDecompositionOptions'), decomposition.indexOf('type CoreOptions'))
    expect(codeOf(options).match(/publish|footprint|area|refus|outcome|verdict/i)).toBeNull()
  })
})

describe('005K §28 M4 the rule has no special cases', () => {
  it('its numbers are a frozen set: the conventions of the line reader, nothing that fits a sheet', () => {
    const boundary = codeOf(read(BOUNDARY))
    const frozen: Record<string, string[]> = {
      classifyGap: ['0', '1', '2', '2.2', '3'],
      drawnGapCheck: ['0', '1'],
      solidShare: ['0', '1'],
      inkShare: ['0', '1'],
      drawnSignature: [],
      JAMB_SOLID: ['0.8'],
    }
    for (const name of RULE) expect(numbersIn(bodyOf(boundary, name)), name).toEqual(frozen[name])
    expect(numbersIn(codeOf(read(RECORDS)))).toEqual(['0', '1', '1.5', '12', '3', '4', '400', '7', '8', '9'])
  })

  it('no gap id, coordinate key, house or publisher is a literal in the rule or the records', () => {
    for (const file of [BOUNDARY, RECORDS]) {
      const code = codeOf(read(file))
      expect(code.match(/['"`](?:gap|corner|wide)-[XY]-\d/), file).toBeNull()
      expect(code.match(HOUSES), file).toBeNull()
      expect(code.match(/archon|dobredomy|projektydomow/i), file).toBeNull()
    }
  })
})

describe('005K §19 the product never turns the rule on', () => {
  const walk = (dir: string): string[] =>
    readdirSync(join(ROOT, dir)).flatMap((name) => {
      const p = join(dir, name)
      if (['node_modules', 'dist', 'build', '.gradle', 'third_party'].includes(name)) return []
      return statSync(join(ROOT, p)).isDirectory() ? walk(p) : /\.(ts|tsx|mjs|js|kt)$/.test(name) ? [p] : []
    })

  it('apps never name it; the service and the solver only pass ON through when their caller asked for it', () => {
    for (const f of walk('apps')) expect(read(f).includes('drawnGapRule'), relative(ROOT, f)).toBe(false)
    const passes = (f: string): string[] => [...codeOf(read(f)).matchAll(/^.*drawnGapRule.*$/gm)].map((m) => m[0])
    for (const f of ['packages/analysis-service/src/run.ts', 'packages/reconstruction/src/v2/reconstruct-v2.ts', 'packages/reconstruction/src/layout.ts']) {
      // every line that says ON, other than the option's own type
      const lines = passes(f).filter((l) => l.includes("'ON'") && !/drawnGapRule\?: 'OFF' \| 'ON'/.test(l))
      expect(lines.length, f).toBeGreaterThan(0)
      for (const l of lines) expect(l, f).toMatch(/options\.drawnGapRule === 'ON' \? \{ drawnGapRule: 'ON' as const \} : \{\}/)
    }
    // the decomposition reads the option, defaulting to OFF
    expect(codeOf(read('packages/reconstruction/src/plan-decomposition.ts'))).toMatch(/const drawnGapRule = options\.drawnGapRule \?\? 'OFF'/)
  })

  // council C3: a resolver hypothesis `{ ...shared, drawnGapRule: 'ON' }`, or `drawnGapRule: MODE` behind a constant, would
  // pass a check that reads only the lines saying 'ON' in three files. Every production mention of the option, in every
  // package, must be one of the fixed forms below: its type, the conditional pass-through, its default, a record copied.
  it('every production mention of the option is a type, the conditional pass-through, the OFF default or a record copied', () => {
    const CARRIERS = [
      'packages/analysis-service/src/run.ts',
      'packages/evidence-pack/src/pack.ts',
      'packages/evidence-pack/src/types.ts',
      'packages/reconstruction/src/boundary-evidence.ts',
      'packages/reconstruction/src/failure.ts',
      'packages/reconstruction/src/gap-evidence.ts',
      'packages/reconstruction/src/layout.ts',
      'packages/reconstruction/src/plan-decomposition.ts',
      'packages/reconstruction/src/plan-diagnostics.ts',
      'packages/reconstruction/src/v2/reconstruct-v2.ts',
    ]
    const named = walk('packages').filter((f) => /\/src\//.test(f) && codeOf(read(f)).includes('drawnGapRule'))
    expect(named.sort()).toEqual(CARRIERS)
    const FORMS = [
      /drawnGapRule\?: 'OFF' \| 'ON'/g,
      /drawnGapRule: 'OFF' \| 'ON'/g,
      /\.\.\.\(options\.drawnGapRule === 'ON' \? \{ drawnGapRule: 'ON' as const \} : \{\}\)/g,
      /const drawnGapRule = options\.drawnGapRule \?\? 'OFF'/g,
      /drawnGapRule: b\?\.drawnGapRule \?\? null/g,
      /drawnGapRule: b\.drawnGapRule\b/g,
      /\bg\.drawnGapRule\.(check|upgraded)\b/g,
      /drawnGapRule: \{ mode: string;/g,
      /drawnGapRule\?: string\b/g,
      /'drawnGapRule'/g,
    ]
    // the rule's own files define it (held by the other 005K tests); the decomposition passes its defaulted const on by name
    for (const f of CARRIERS.filter((c) => c !== BOUNDARY && c !== RECORDS)) {
      let code = codeOf(read(f))
      for (const form of FORMS) code = code.replace(form, '')
      if (f.endsWith('plan-decomposition.ts')) code = code.replace(/(?<=[{,(]\s*|^\s*)drawnGapRule(?=\s*[,})])/gm, '')
      expect([...code.matchAll(/^.*drawnGapRule.*$/gm)].map((m) => m[0].trim()), f).toEqual([])
    }
  })
})
