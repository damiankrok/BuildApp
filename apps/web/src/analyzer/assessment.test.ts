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

  it('names technical errors per check', () => {
    expect(assessmentLines(view('PASS', 'ERRORS'))[0]).toMatchObject({ state: 'WARN', value: '2 technical errors', detail: ['COMPILER: 2 errors'] })
  })
})
