import { describe, expect, it } from 'vitest'
import type { AcquisitionFailure } from '@buildapp/source-package'
import { warningsOf } from '../src/warnings.js'

// BUILDPLAN-ANALYZER-005A: a warning says whether it limits the result. The
// phone called a result "limited" on the bare count of sentences, and every
// phone run carries "no vision provider ran".

const clean = { residuals: 12, residualsOutside: 0, exteriorJointErrors: 0, graphViolations: 0, ledgerViolations: 0 }
const guess = (url: string): AcquisitionFailure => ({ stage: 'ASSET_FETCH', target: url, code: 'HTTP_STATUS', message: 'HTTP 404', claim: { channel: 'VARIANT_CONVENTION' } })
const exposed = (url: string): AcquisitionFailure => ({ stage: 'ASSET_FETCH', target: url, code: 'HTTP_STATUS', message: 'HTTP 404', claim: { channel: 'IMG_TAG', document: 'FLOOR_PLAN' } })

describe('warning severity', () => {
  it('a deterministic run with nothing lost has only information', () => {
    const w = warningsOf({ visionMode: 'DETERMINISTIC_ONLY', failures: [], ...clean })
    expect(w.map((x) => [x.code, x.severity])).toEqual([['DETERMINISTIC_ONLY', 'INFO']])
  })

  it('a guessed larger copy that does not exist is information; an exposed drawing not read limits', () => {
    const w = warningsOf({ visionMode: 'DETERMINISTIC_ONLY', failures: [guess('https://a.example/x-big.jpg'), guess('https://a.example/y-big.jpg'), exposed('https://a.example/plan.jpg')], ...clean })
    expect(w.map((x) => [x.code, x.severity])).toEqual([
      ['DETERMINISTIC_ONLY', 'INFO'],
      ['SOURCE_ADDRESS_HTTP_STATUS', 'LIMITING'],
      ['GUESSED_ADDRESS_HTTP_STATUS', 'INFO'],
    ])
    expect(w[2].message).toBe('2 guessed larger copies not available (http status); the published copy was used')
  })

  it('a duplicate counted once is information; a failure with no claim limits, because unknown is not harmless', () => {
    const w = warningsOf({
      visionMode: 'LIVE_PROVIDER',
      failures: [
        { stage: 'ROLE', target: 'https://a.example/b.jpg', code: 'BYTE_IDENTICAL', message: 'same bytes' },
        { stage: 'ASSET_FETCH', target: 'https://a.example/c.jpg', code: 'BUDGET_EXCEEDED', message: 'beyond budget' },
      ],
      ...clean,
    })
    expect(w.map((x) => [x.code, x.severity])).toEqual([
      ['SOURCE_BYTE_IDENTICAL', 'INFO'],
      ['SOURCE_ADDRESS_BUDGET_EXCEEDED', 'LIMITING'],
    ])
  })

  it('checks that did not hold always limit', () => {
    const w = warningsOf({ visionMode: 'REPLAYED_GRAPH', failures: [], residuals: 12, residualsOutside: 2, exteriorJointErrors: 1, graphViolations: 0, ledgerViolations: 3 })
    expect(w.map((x) => [x.code, x.severity])).toEqual([
      ['GRAPH_REPLAYED', 'INFO'],
      ['RESIDUALS_OUTSIDE_TOLERANCE', 'LIMITING'],
      ['EXTERIOR_JOINTS', 'LIMITING'],
      ['INVARIANT_VIOLATIONS', 'LIMITING'],
    ])
  })

  it('the order is stable whatever order the failures arrived in', () => {
    const fs = [guess('https://a.example/1.jpg'), exposed('https://a.example/2.jpg'), guess('https://a.example/3.jpg')]
    const a = warningsOf({ visionMode: 'DETERMINISTIC_ONLY', failures: fs, ...clean })
    const b = warningsOf({ visionMode: 'DETERMINISTIC_ONLY', failures: [...fs].reverse(), ...clean })
    expect(b).toEqual(a)
  })
})
