/** 005Y-N7 (B): the model against each registered view, per view and per kind of check. */
import { describe, expect, it } from 'vitest'
import { crossViewResiduals, summariseKind, verdictOf } from '../src/v2/cross-view.js'
import type { SourceViewResidual } from '../src/v2/verify.js'

const r = (frameId: string, kind: SourceViewResidual['kind'], residualM: number, toleranceM = 0.1, featureId = `f-${residualM}`): SourceViewResidual => ({ featureId, frameId, kind, modelM: 1, observedM: 1 - residualM, residualM, toleranceM, withinTolerance: Math.abs(residualM) <= toleranceM, why: 'synthetic' })
const noRepair = { iterations: [], converged: true }

describe('cross-view residuals', () => {
  it('a kind of check: its count, median and worst residual, and its outliers worst first', () => {
    const s = summariseKind('OPENING_HEAD', [r('v', 'OPENING_HEAD', 0.02), r('v', 'OPENING_HEAD', -0.3), r('v', 'OPENING_HEAD', 0.05), r('v', 'OPENING_HEAD', 0.2)])
    expect(s).toMatchObject({ checks: 4, withinTolerance: 2, maxAbsM: 0.3 })
    expect(s.outliers.map((o) => o.residualM)).toEqual([-0.3, 0.2])
  })

  it('a view agrees, disagrees, or is mixed by the share outside tolerance; one never compared is unchecked', () => {
    expect(verdictOf(0, 0)).toBe('UNCHECKED')
    expect(verdictOf(6, 6)).toBe('AGREES')
    expect(verdictOf(6, 5)).toBe('MIXED')
    expect(verdictOf(6, 4)).toBe('DISAGREES')
  })

  it('every registered view is listed, with the reconciliation that ran', () => {
    const out = crossViewResiduals([r('front', 'OPENING_SILL', 0.01), r('front', 'ROOF_EDGE', 0.4)], [{ frameId: 'front', side: 'FRONT', mpp: 0.02 }, { frameId: 'rear', side: 'REAR' }], { iterations: [{ index: 0, residualsBefore: 3, residualsAfter: 1, applied: [{ kind: 'MOVE_OPENING', featureId: 'x', before: {}, after: {}, why: '' }], refused: [] }], converged: true })
    expect(out.views.map((v) => [v.side, v.verdict])).toEqual([['FRONT', 'DISAGREES'], ['REAR', 'UNCHECKED']])
    expect(out.reconciliation).toEqual({ iterations: 1, applied: 1, refused: 0, converged: true, residualsBefore: 3, residualsAfter: 1 })
    expect(crossViewResiduals([], [], noRepair).views).toEqual([])
  })
})
