/**
 * BUILDPLAN-ANALYZER-005I: the holdout verdict reads the witness of the reading a run was resolved to from whichever
 * step chose it. The plan resolver (PLAN_RESOLUTION) and the metric challenge (METRIC_CHALLENGE, REPLACED, 005D R9)
 * both emit PLAN_RESOLVED_BY_HYPOTHESIS; before 005I only the resolver's record was read, so a replacement the drawing
 * chose could never show its witness (the e-OZE development row, whose page vote 005I reads right and whose confirmed
 * registration the drawing's outer totals then contradict). Run on hand-made run directories, nothing else.
 */
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const VERDICT = resolve(import.meta.dirname, '../../holdout/verdict.mjs')
type Entry = { substage: string; counts: Record<string, unknown> }

function run(entries: Entry[], resolved: boolean): { verdict: string; conditions: Record<string, { holds: boolean; by?: string | null }> } {
  const dir = mkdtempSync(join(tmpdir(), 'verdict-'))
  const write = (name: string, value: unknown): void => writeFileSync(join(dir, name), JSON.stringify(value))
  write('source-package.json', { assets: [{ roles: { document: 'FLOOR_PLAN', storey: 'GROUND' } }], publishedFacts: [{ key: 'footprint_area', unit: 'm2', value: 100 }], failures: [] })
  write('result-summary.json', { counts: { masses: 1 }, warningDetails: resolved ? [{ severity: 'DEGRADING', code: 'LAYOUT_PLAN_RESOLVED_BY_HYPOTHESIS', message: 'another reading' }] : [] })
  write('analysis-trace.json', { entries })
  write('model.json', { levels: [{ id: 'l0', index: 0 }], slabs: [{ levelId: 'l0', polygon: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }] }] })
  write('observation-graph.json', { coordinateFrames: [] })
  write('metric-evidence.json', { ocrTokens: [] })
  mkdirSync(join(dir, 'plan-diagnostics'))
  write('plan-diagnostics/digest.json', { plans: [] })
  return JSON.parse(execFileSync(process.execPath, [VERDICT, dir], { encoding: 'utf8' }))
}

const challenge = (extra: Record<string, unknown>): Entry => ({ substage: 'METRIC_CHALLENGE', counts: { outcome: 'REPLACED', chosen: 'copy A', sourceConflict: 'OUTER_TOTALS', publishedFigure: 'VERIFIED', ...extra } })

describe('the verdict reads the witness from the step that chose the reading', () => {
  it('a reading the drawing chose in the metric challenge, with a witness: PASS, by METRIC_CHALLENGE', () => {
    const v = run([challenge({ chosenCorroborations: 'ISOTROPY' })], true)
    expect(v.conditions.resolvedWithAWitness).toMatchObject({ holds: true, by: 'METRIC_CHALLENGE' })
    expect(v.verdict).toBe('PASS')
  })

  it('the same replacement without a witness besides the figure still fails', () => {
    expect(run([challenge({ chosenCorroborations: '' })], true).conditions.resolvedWithAWitness.holds).toBe(false)
  })

  it('a reading the plan resolver chose is judged by its own record, as before', () => {
    const v = run([{ substage: 'PLAN_RESOLUTION', counts: { chosen: 'copy B', chosenCorroborations: 'CHAIN_SUM' } }], true)
    expect(v.conditions.resolvedWithAWitness).toMatchObject({ holds: true, by: 'PLAN_RESOLUTION' })
  })

  it('a resolved run with no record of what chose it fails: the warning alone is no witness', () => {
    expect(run([], true).conditions.resolvedWithAWitness.holds).toBe(false)
    expect(run([challenge({ outcome: 'KEPT', chosenCorroborations: 'ISOTROPY' })], true).conditions.resolvedWithAWitness.holds).toBe(false)
  })

  it('a first reading that held needs no witness', () => {
    expect(run([], false).verdict).toBe('PASS')
  })
})
