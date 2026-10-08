/**
 * BUILDPLAN-ANALYZER-005N §20 / §30 — the compound-facade reading knows the drawing, not the building.
 *
 * Where a facade gap is cut, what each interval is, which recess is linked to its back wall and which long wall joins
 * the extent may be read only from the plan's ink, its wall layer, its grid, its scale and its callouts. A rule that
 * splits a span because the published footprint then agrees, because the house then completes, because a refusal goes
 * away, or because this facade of this house is known to hold a garage, would make the outline agree with the figure
 * it is later checked against. These gates hold, by the code itself, that it cannot:
 *
 *  - `compound-facade.ts` imports the line reader and pixel/common types only, and a type from the decomposition;
 *  - neither it nor the decomposition's 005N functions name a published figure, area, footprint, refusal, outcome,
 *    verdict, truth, house, publisher or benchmark (M4);
 *  - no development or blind house is named anywhere in them (M10);
 *  - their numbers are a frozen set: a width or a threshold fitted to one sheet is a new literal and fails here (M10);
 *  - none of them names the drawn-gap rule, which stays OFF (M8; `gap-evidence.test.ts` holds the product to OFF).
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(import.meta.dirname, '../..')
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8')
const codeOf = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ')
const importsOf = (source: string): string[] => [...source.matchAll(/^\s*(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1])
const bodyOf = (source: string, name: string): string => {
  const start = source.search(new RegExp(`(?:function|const) ${name}\\b`))
  if (start < 0) throw new Error(`no ${name}`)
  const next = source.slice(start + 1).search(/\n(?:export )?(?:function|const|type) /)
  return source.slice(start, next < 0 ? undefined : start + 1 + next)
}
const withoutStrings = (code: string): string => code.replace(/`[^`]*`/g, '""').replace(/'[^']*'/g, '""')
const numbersIn = (code: string): string[] => [...new Set([...withoutStrings(code).matchAll(/(?<![\w.])(\d+(?:\.\d+)?)(?!\w)/g)].map((m) => m[1]))].sort()

const COMPOUND = 'packages/reconstruction/src/compound-facade.ts'
const DECOMPOSITION = 'packages/reconstruction/src/plan-decomposition.ts'
/** The decomposition's 005N functions: the reader's wiring, the back-wall lines, the structural evidence, the extent join. */
const WIRING = ['facadeCompoundReader', 'backWallLineOf', 'backWallLines', 'structuralEvidence', 'intervalDecision', 'cornerJoined']

const FORBIDDEN = /publish|footprint|\barea\b|areaM2|refus|outcome|verdict|truth|oracle|expected|\bhouse\b|slug|family|archon|dobredomy|projektydomow|gold|benchmark|holdout|blind|label_source|modelHash|reconstruct|metrics\./i
const HOUSES = /gozdzik|cyklamen|marcowk|rarytas|kosac|jarzab|arkadi|azali|helikon|morel|zurawk|miranda|modrzew|modrzyk|jablonk|dabecj|tunbergi|milorzeb|aster|galaktyk|eoze|muraj|cieszyn|wrzos/i

describe('005N §20 the compound-facade reading reads the drawing only', () => {
  it('compound-facade.ts imports the line reader, the pixel and common types, and a type from the decomposition — nothing else', () => {
    expect([...new Set(importsOf(read(COMPOUND)))].sort()).toEqual(['./boundary-evidence.js', './plan-decomposition.js', '@buildapp/source-common', '@buildapp/source-cv'])
    // the decomposition is imported for its types only: no runtime path from the reader back into the pipeline
    expect(read(COMPOUND)).toMatch(/import type \{ OpeningEvidence, PlanCallout \} from '\.\/plan-decomposition\.js'/)
  })

  it('no compound-facade code names a published figure, an area, a refusal, an outcome, a verdict or a house (M4)', () => {
    expect(withoutStrings(codeOf(read(COMPOUND))).match(FORBIDDEN)).toBeNull()
    const decomposition = codeOf(read(DECOMPOSITION))
    for (const name of WIRING) expect(withoutStrings(bodyOf(decomposition, name)).match(FORBIDDEN), name).toBeNull()
  })

  it('no development or blind house is named in the reader, its wiring or the extent join (M10)', () => {
    expect(read(COMPOUND).match(HOUSES)).toBeNull()
    const decomposition = read(DECOMPOSITION)
    for (const name of WIRING) expect(bodyOf(decomposition, name).match(HOUSES), name).toBeNull()
  })

  it('the drawn-gap rule is not named by any of it: it stays OFF (M8)', () => {
    expect(read(COMPOUND)).not.toMatch(/drawnGap/)
    const decomposition = read(DECOMPOSITION)
    for (const name of WIRING) expect(bodyOf(decomposition, name), name).not.toMatch(/drawnGap/)
  })
})

describe('005N §30 M10 the reading has no special cases', () => {
  it('its constants are the stated conventions, frozen by value', () => {
    const source = read(COMPOUND)
    expect(source).toMatch(/export const RECESS_MAX_DEPTH_M = 4\.5\n/)
    expect(source).toMatch(/export const RETURN_MIN_M = 0\.9\n/)
    expect(source).toMatch(/export const MIN_INTERVAL_M = 0\.6\n/)
    expect(source).toMatch(/export const BACK_WALL_COVER = 0\.9\n/)
    expect(source).toMatch(/export const COMPOUND_BOUNDS = \{ spans: 24, separators: 8, backWallReads: 64 \} as const\n/)
  })

  it('its numbers are a frozen set: a wall, a half, a step, nothing that fits a sheet', () => {
    expect(numbersIn(codeOf(read(COMPOUND)))).toEqual(['0', '0.12', '0.6', '0.75', '0.9', '1', '1.25', '1.5', '100', '2', '24', '3', '35', '4', '4.5', '64', '8'])
    const decomposition = codeOf(read(DECOMPOSITION))
    expect(numbersIn(WIRING.map((n) => bodyOf(decomposition, n)).join('\n'))).toEqual(['0', '0.2', '0.3', '0.5', '0.7', '0.9', '1', '1.5', '2'])
  })
})
