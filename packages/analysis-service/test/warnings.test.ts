import { describe, expect, it } from 'vitest'
import type { AcquisitionFailure } from '@buildapp/source-package'
import { warningsOf } from '../src/warnings.js'

// BUILDPLAN-ANALYZER-005A: a warning says whether it limits the result. The
// phone called a result "limited" on the bare count of sentences, and every
// phone run carries "no vision provider ran".

const clean = { residuals: 12, residualsOutside: 0, exteriorJointErrors: 0, graphViolations: 0, ledgerViolations: 0 }
const guess = (url: string, status = 404): AcquisitionFailure => ({ stage: 'ASSET_FETCH', target: url, code: 'HTTP_STATUS', message: `HTTP ${status}`, status, claim: { channel: 'VARIANT_CONVENTION' } })
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

  it('a guess is information only when the copy is definitely absent: a busy server or a timeout may hide a larger copy', () => {
    const timedOut: AcquisitionFailure = { stage: 'ASSET_FETCH', target: 'https://a.example/t-big.jpg', code: 'TIMEOUT', message: 'timed out', attempts: 2, claim: { channel: 'VARIANT_CONVENTION' } }
    const unknown: AcquisitionFailure = { stage: 'ASSET_FETCH', target: 'https://a.example/u-big.jpg', code: 'HTTP_STATUS', message: 'HTTP ?', claim: { channel: 'VARIANT_CONVENTION' } }
    const offline: AcquisitionFailure = { stage: 'ASSET_FETCH', target: 'https://a.example/o-big.jpg', code: 'OFFLINE_CACHE_MISS', message: 'not in the cache', claim: { channel: 'VARIANT_CONVENTION' } }
    const w = warningsOf({ visionMode: 'DETERMINISTIC_ONLY', failures: [guess('https://a.example/g-big.jpg', 410), guess('https://a.example/b-big.jpg', 503), timedOut, unknown, offline], ...clean })
    expect(w.map((x) => [x.code, x.severity])).toEqual([
      ['DETERMINISTIC_ONLY', 'INFO'],
      ['GUESSED_ADDRESS_UNREAD_HTTP_STATUS', 'LIMITING'],
      ['GUESSED_ADDRESS_UNREAD_TIMEOUT', 'LIMITING'],
      ['GUESSED_ADDRESS_HTTP_STATUS', 'INFO'],
      ['GUESSED_ADDRESS_OFFLINE_CACHE_MISS', 'INFO'],
    ])
    expect(w[1].message).toBe('2 guessed larger copies could not be read (http status) and may exist; the published copy was used')
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

  it('a building the gate passed with a degrading reason, or with an opening not built, is limited; noted reasons are not', () => {
    const w = warningsOf({
      visionMode: 'DETERMINISTIC_ONLY',
      failures: [],
      ...clean,
      layoutReasons: [
        { code: 'FOOTPRINT_AREA_AGREES', severity: 'NOTED', what: 'agrees' },
        { code: 'PLAN_RESOLVED_BY_HYPOTHESIS', severity: 'DEGRADING', what: 'the building is taken from another reading of the plan' },
        { code: 'A_REASON_ADDED_LATER', severity: 'DEGRADING', what: 'something new' },
      ],
      openingFits: [
        { openingId: 'op-1', action: 'SHRUNK', why: 'fitted' },
        { openingId: 'op-2', action: 'DROPPED', why: 'not built' },
        { openingId: 'op-3', action: 'DROPPED', why: 'not built' },
      ],
    })
    expect(w.map((x) => [x.code, x.severity])).toEqual([
      ['DETERMINISTIC_ONLY', 'INFO'],
      ['LAYOUT_PLAN_RESOLVED_BY_HYPOTHESIS', 'LIMITING'],
      ['LAYOUT_A_REASON_ADDED_LATER', 'LIMITING'],
      ['OPENINGS_NOT_BUILT', 'LIMITING'],
    ])
    expect(w[3].message).toBe('2 openings the drawings print were not built: op-2, op-3')
  })

  it('the order is stable whatever order the failures arrived in', () => {
    const fs = [guess('https://a.example/1.jpg'), exposed('https://a.example/2.jpg'), guess('https://a.example/3.jpg')]
    const a = warningsOf({ visionMode: 'DETERMINISTIC_ONLY', failures: fs, ...clean })
    const b = warningsOf({ visionMode: 'DETERMINISTIC_ONLY', failures: [...fs].reverse(), ...clean })
    expect(b).toEqual(a)
  })
})
