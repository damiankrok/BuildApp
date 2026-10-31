import { describe, expect, it } from 'vitest'
import { assessmentLines } from './assessment.js'
import type { AssessmentView } from './assessment.js'

const view = (fidelity: 'PASS' | 'CONFLICT' | 'UNCHECKED', technical: 'VALID' | 'ERRORS' = 'VALID'): AssessmentView => ({
  technicalValidity: { status: technical, errors: technical === 'VALID' ? 0 : 2, warnings: 1, checks: [{ check: 'COMPILER', errors: technical === 'VALID' ? 0 : 2, warnings: 1 }] },
  decompositionCompleteness: { verdict: 'COMPLETE', meaning: 'completeness of the reading' },
  sourceFidelity: { status: fidelity, relations: [{ id: 'R5_REGISTERED_ELEVATIONS', title: 't', status: fidelity, counts: { PASS: 1, CONFLICT: fidelity === 'CONFLICT' ? 1 : 0, UNCHECKED: 2 } }], conflicts: fidelity === 'CONFLICT' ? ['R5_REGISTERED_ELEVATIONS: the view and the model disagree'] : [] },
  sourceUnchecked: { counts: { total: 3, none: 2, partial: 1 }, items: [{ kind: 'ELEVATION', what: 'REAR elevation (NOT_REGISTERED)', why: 'no ridge datum' }, { kind: 'PERSPECTIVE', what: 'render', why: 'x' }] },
  previewAvailable: true,
})

describe('the assessment as the Analyze panel says it (N9-01)', () => {
  it('keeps the three axes apart: a COMPLETE reading with a conflict says both, on their own lines', () => {
    const lines = assessmentLines(view('CONFLICT'))
    expect(lines.map((l) => [l.axis, l.state])).toEqual([
      ['TECHNICAL', 'OK'],
      ['COMPLETENESS', 'OK'],
      ['FIDELITY', 'WARN'],
      ['UNCHECKED', 'OPEN'],
    ])
    expect(lines[1].label).toBe('reading completeness (decomposition)')
    expect(lines[2].detail).toContain('R5_REGISTERED_ELEVATIONS: the view and the model disagree')
  })

  it('never says UNCHECKED as a pass, and says technical validity is not agreement', () => {
    const lines = assessmentLines(view('UNCHECKED'))
    expect(lines[2].state).toBe('OPEN')
    expect(lines[2].value).toContain('not agreement')
    expect(lines[0].value).toContain('not evidence of agreement')
    expect(lines[3].detail).toEqual(['elevation · REAR elevation (NOT_REGISTERED): no ridge datum'])
  })

  it('N9-02A: says which axes of each elevation are registered, when the service sends them', () => {
    const a = { ...view('UNCHECKED'), elevationRegistration: { counts: { before: { FULL: 1, ALONG_ONLY: 0, VERTICAL_ONLY: 0, UNREGISTERED: 1 }, after: { FULL: 1, ALONG_ONLY: 1, VERTICAL_ONLY: 0, UNREGISTERED: 0 } }, views: [{ frameId: 'e1', class: 'ALONG_ONLY', side: { state: 'AXIS_ONLY', value: 'LEFT_OR_RIGHT' }, along: { state: 'SPAN_ONLY' }, vertical: { state: 'UNCHECKED' }, scale: { state: 'ALONG_ONLY' } }] } }
    const line = assessmentLines(a).find((l) => l.axis === 'ELEVATIONS')
    expect(line?.value).toBe('1 full · 1 along only · 0 vertical only · 0 unregistered')
    expect(line?.detail[0]).toBe('e1: along only — side axis_only left_or_right, along span_only, vertical unchecked, scale along_only')
    expect(assessmentLines(view('PASS')).some((l) => l.axis === 'ELEVATIONS')).toBe(false)
  })

  it('names technical errors per check', () => {
    expect(assessmentLines(view('PASS', 'ERRORS'))[0]).toMatchObject({ state: 'WARN', value: '2 technical errors', detail: ['COMPILER: 2 errors'] })
  })

  it('N9-02R: says how many comparisons stood on valid axes and that a disputed axis is disputed', () => {
    const a = { ...view('UNCHECKED'), elevationRegistration: { counts: { before: { FULL: 1 }, after: { UNREGISTERED: 1 } }, views: [{ frameId: 'e1', class: 'UNREGISTERED', side: { state: 'REGISTERED', value: 'FRONT' }, along: { state: 'UNCHECKED' }, vertical: { state: 'UNCHECKED' }, scale: { state: 'UNCHECKED' }, validity: { along: 'DISPUTED', vertical: 'UNAVAILABLE' } }], scorecard: { totals: { potential: 12, executed: 4, independent: 0, rawObserved: 11 } } } }
    const line = assessmentLines(a).find((l) => l.axis === 'ELEVATIONS')
    expect(line?.detail[0]).toBe('comparisons: 12 potential · 4 executed on valid axes · 0 independent of the model (11 measured in all)')
    expect(line?.detail[1]).toContain('along unchecked (disputed), vertical unchecked (unavailable)')
  })
})
