/**
 * BUILDPLAN-ANALYZER-005P — the contest record and the doubt policy stay inside their seam.
 *
 * Plan resolver 1.5.0 reads what a statement's confident readers of the same ink read (`statement-contest.ts`) and lets
 * ONE decision use it: the source-conflict test, where doubt never helps the accuser. These gates hold, by the code
 * itself, that the change cannot quietly become something else:
 *
 *  - `statement-contest.ts` imports source-metrics' types only and names no published figure, area, outcome, verdict,
 *    house or truth: a contest is an observation about the readers, never about the building;
 *  - the doubt policies (ANY_FITS / ALL_FIT) are used only inside the conflict test; every other reading of a statement
 *    (the ranking's refuted shares, the lattice scales, the isotropy support, the re-read options) reads as printed;
 *  - the conflict test is given no published figure;
 *  - a withdrawn accusation reaches the trace only: it never touches the draft, the layout or the metrics;
 *  - no development or blind house is named in any of it.
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(import.meta.dirname, '../..')
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8')
const codeOf = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ')
const importsOf = (source: string): string[] => [...source.matchAll(/^\s*(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1])
const withoutStrings = (code: string): string => code.replace(/`[^`]*`/g, '""').replace(/'[^']*'/g, '""')
const bodyOf = (source: string, name: string): string => {
  const start = source.search(new RegExp(`(?:export )?(?:function|const) ${name}\\b`))
  if (start < 0) throw new Error(`no ${name}`)
  const next = source.slice(start + 1).search(/\n(?:export )?(?:function|const|type) /)
  return source.slice(start, next < 0 ? undefined : start + 1 + next)
}

/** An arrow function declared inside another, up to its closing brace at its own indentation. */
const innerBodyOf = (source: string, name: string): string => {
  const m = new RegExp(`\\n( +)const ${name}\\b`).exec(source)
  if (!m) throw new Error(`no ${name}`)
  const end = source.indexOf(`\n${m[1]}}\n`, m.index + 1)
  return source.slice(m.index, end < 0 ? undefined : end + m[1].length + 2)
}

const CONTEST = 'packages/reconstruction/src/statement-contest.ts'
const RESOLUTION = 'packages/reconstruction/src/plan-resolution.ts'
const V2 = 'packages/reconstruction/src/v2/reconstruct-v2.ts'
const FORBIDDEN = /publish|footprint|\barea\b|areaM2|refus|outcome|verdict|truth|oracle|expected|\bhouse\b|slug|family|archon|dobredomy|benchmark|holdout|blind|modelHash/i
const HOUSES = /gozdzik|cyklamen|marcowk|rarytas|kosac|jarzab|arkadi|azali|helikon|morel|zurawk|miranda|modrzew|modrzyk|jablonk|dabecj|tunbergi|milorzeb|\baster\b|galaktyk|eoze|muraj|cieszyn|glogown|akebi/i

describe('005P the contest is an observation about the readers', () => {
  it('statement-contest.ts imports source-metrics types only', () => {
    const text = read(CONTEST)
    expect(importsOf(text)).toEqual(['@buildapp/source-metrics'])
    expect(text).toMatch(/^import type \{[^}]*\} from '@buildapp\/source-metrics'$/m)
  })

  it('it names no published figure, area, outcome, verdict, truth or house', () => {
    expect(withoutStrings(codeOf(read(CONTEST))).match(FORBIDDEN)).toBeNull()
    expect(read(CONTEST).match(HOUSES)).toBeNull()
  })
})

describe('005P the doubt policy is used by the source-conflict test only', () => {
  const code = codeOf(read(RESOLUTION))

  it('ANY_FITS and ALL_FIT appear only in the policy itself and in the conflict test', () => {
    const outside = code
      .replace(bodyOf(code, 'conflictUnder'), ' ')
      .replace(bodyOf(code, 'readingsUnder'), ' ')
      .replace(bodyOf(code, 'fitsUnder'), ' ')
      .replace(/type Doubt = 'AS_PRINTED' \| 'ANY_FITS' \| 'ALL_FIT'/, ' ')
    expect(outside).not.toMatch(/ANY_FITS|ALL_FIT/)
  })

  it('every refuted share outside the conflict test reads as printed: no doubt argument is passed', () => {
    const outside = code.replace(bodyOf(code, 'conflictUnder'), ' ')
    const calls = [...outside.matchAll(/refutedShareAsRead\(([^()]|\([^()]*\))*\)/g)].map((m) => m[0])
    expect(calls.length).toBeGreaterThanOrEqual(3) // the definition's own signature, metricsAtScale, refutedShareAtRegistration
    for (const call of calls) expect(call, call).not.toMatch(/accused|accuser|ANY_FITS|ALL_FIT/)
  })

  it('the lattice scales, the isotropy support and the re-read options never read the contest', () => {
    for (const name of ['latticeScales', 'metricsAtScale', 'scoreReading', 'compareReadings', 'acceptable']) expect(bodyOf(code, name), name).not.toMatch(/contest|readingsUnder|fitsUnder/)
    for (const name of ['resolvePlan', 'challengeFirstReading']) expect(bodyOf(code, name), name).not.toMatch(/\.contest|readingsUnder|fitsUnder/)
  })

  it('the conflict test is given no published figure', () => {
    for (const name of ['conflictUnder', 'sourceConflictOf', 'sourceConflictReview', 'doubtedAmong']) expect(withoutStrings(bodyOf(code, name)), name).not.toMatch(/publish|footprint|areaM2/i)
  })

  it('no house is named in plan resolution', () => {
    expect(read(RESOLUTION).match(HOUSES)).toBeNull()
  })
})

describe('005P a withdrawn accusation is recorded, never acted on', () => {
  it('reconstruct-v2 hands the review to the trace and takes only the conflict from it', () => {
    const code = codeOf(read(V2))
    const note = innerBodyOf(code, 'noteWithdrawn')
    expect(note).toMatch(/trace\(\{ phase: 'REGISTRATION', substage: 'SOURCE_CONFLICT_REVIEW'/)
    expect(note).not.toMatch(/draft|layout|metrics\s*=|planDiagnostics|gap\(/)
    // the only thing read from a review besides the trace is its conflict
    const uses = [...code.matchAll(/(earlyReview|lateReview)\??\.(\w+)/g)].map((m) => m[2])
    expect([...new Set(uses)]).toEqual(['conflict'])
  })
})
