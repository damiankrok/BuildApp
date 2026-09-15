import { describe, expect, it } from 'vitest'
import { metricLength, registerFrame, solveLevelLadder, toMetric, toPixels } from '../src/index.js'
import type { ScaleAnchorInput } from '../src/index.js'

const anchor = (id: string, axis: 'X' | 'Y', pixelSpan: number, metricSpan: number, weight = 0.8): ScaleAnchorInput => ({ id, kind: 'CHAIN_SEGMENT', evidenceIds: [`e-${id}`], axis, pixelSpan, metricSpan, weight })

const base = {
  frameId: 'frame-1',
  assetId: 'asset-1',
  variantByteHash: 'a'.repeat(64),
  plane: 'PLAN_XZ' as const,
  originPx: { x: 58, y: 221 },
  flipX: false,
  flipY: true,
  detail: 'test',
}

describe('frame registration', () => {
  it('fits one scale per axis and reports the anisotropy it measured', () => {
    const r = registerFrame({
      ...base,
      anchors: [anchor('a', 'X', 456, 12.05), anchor('b', 'X', 299, 7.9), anchor('c', 'X', 157, 4.15), anchor('d', 'Y', 193, 5.1), anchor('e', 'Y', 283.5, 7.5)],
    })
    expect(r).toBeDefined()
    if (!r) return
    expect(r.metresPerPixelX).toBeCloseTo(0.026425, 5)
    expect(r.metresPerPixelY).toBeCloseTo(0.026445, 4)
    expect(r.anisotropy).toBeGreaterThanOrEqual(1)
    expect(r.anisotropy).toBeLessThan(1.01)
    expect(r.anchors).toHaveLength(5)
    expect(r.rejected).toEqual([])
    expect(r.residual.rmsM).toBeLessThan(0.01)
    expect(r.confidence).toBeGreaterThan(0.8)
  })

  it('throws out the anchor that disagrees rather than splitting the difference with it', () => {
    const r = registerFrame({
      ...base,
      anchors: [anchor('a', 'X', 456, 12.05), anchor('b', 'X', 299, 7.9), anchor('c', 'X', 157, 4.15), anchor('bad', 'X', 200, 12.0), anchor('d', 'Y', 193, 5.1), anchor('e', 'Y', 283.5, 7.5)],
    })
    expect(r?.metresPerPixelX).toBeCloseTo(0.026425, 5)
    expect(r?.rejected.map((x) => x.id)).toEqual(['bad'])
    expect(r?.rejected[0].why).toMatch(/misses the fitted scale/)
  })

  it('is not dragged by a bad anchor into rejecting the good ones', () => {
    // A single wild reading would take a plain least-squares fit so far that
    // every honest anchor misses the tolerance and the frame registers at all.
    const r = registerFrame({
      ...base,
      anchors: [anchor('a', 'Y', 588.9, 7.95), anchor('b', 'Y', 226.7, 3.06), anchor('c', 'Y', 345.9, 4.67), anchor('wild', 'Y', 100, 40)],
    })
    expect(r).toBeDefined()
    expect(r?.anchors).toHaveLength(3)
    expect(r?.rejected.map((x) => x.id)).toEqual(['wild'])
  })

  it('says when it assumed square pixels instead of measuring them', () => {
    const r = registerFrame({ ...base, anchors: [anchor('a', 'X', 456, 12.05), anchor('b', 'X', 299, 7.9)] })
    expect(r?.anisotropy).toBe(1)
    expect(r?.note).toMatch(/assumed equal/)
    const both = registerFrame({ ...base, anchors: [anchor('a', 'X', 456, 12.05), anchor('b', 'X', 299, 7.9), anchor('c', 'Y', 193, 5.1), anchor('d', 'Y', 283.5, 7.5)] })
    expect(both?.note ?? '').not.toMatch(/assumed equal/)
  })

  it('maps pixels to metres and back, with the image y-axis flipped', () => {
    const r = registerFrame({ ...base, anchors: [anchor('a', 'X', 456, 12.05), anchor('b', 'X', 299, 7.9), anchor('c', 'Y', 193, 5.1), anchor('d', 'Y', 283.5, 7.5)] })
    expect(r).toBeDefined()
    if (!r) return
    expect(toMetric(r, { x: 58, y: 221 })).toEqual({ u: 0, v: 0 })
    const up = toMetric(r, { x: 58, y: 121 })
    expect(up.v).toBeGreaterThan(0)
    const round = toPixels(r, toMetric(r, { x: 300, y: 400 }))
    expect(round.x).toBeCloseTo(300, 4)
    expect(round.y).toBeCloseTo(400, 4)
    expect(metricLength(r, { x: 58, y: 221 }, { x: 58 + 456, y: 221 })).toBeCloseTo(12.05, 3)
  })

  it('refuses to register from nothing', () => {
    expect(registerFrame({ ...base, anchors: [] })).toBeUndefined()
    expect(registerFrame({ ...base, anchors: [anchor('a', 'X', 0, 5)] })).toBeUndefined()
  })
})

describe('the ladder of level datums', () => {
  const rung = (tokenId: string, rowPx: number, value: number, alternatives: number[] = []) => ({
    tokenId,
    rowPx,
    readings: [
      { value, rawText: `+${value.toFixed(2)}`, confidence: 1, substitutions: 0 },
      ...alternatives.map((v) => ({ value: v, rawText: `+${v.toFixed(2)}`, confidence: 0.9, substitutions: 1 })),
    ],
  })

  it('fits one scale and one zero through the heights a section prints', () => {
    const solved = solveLevelLadder([rung('a', 642, 0), rung('b', 415.3, 3.06), rung('c', 296.1, 4.67), rung('d', 53.1, 7.95)])
    expect(solved.fitted).toBe(4)
    expect(solved.metresPerPixel).toBeCloseTo(0.0135, 3)
    expect(solved.zeroRowPx).toBeCloseTo(642, 0)
    expect(solved.datums.map((d) => d.value)).toEqual([0, 3.06, 4.67, 7.95])
    expect(solved.datums.every((d) => d.origin === 'READ')).toBe(true)
  })

  it('corrects a misread leading digit that the other heights refuse', () => {
    // `+5,06` where the sheet prints `+3,06`: clean characters, plausible
    // value, and two metres wrong. Only the ladder can see it.
    const solved = solveLevelLadder([rung('a', 642, 0), rung('b', 415.3, 5.06, [3.06]), rung('c', 296.1, 4.67), rung('d', 53.1, 7.95)])
    expect(solved.datums[1].value).toBe(3.06)
    expect(solved.datums[1].origin).toBe('CHAIN_CORRECTED')
    expect(solved.datums[1].rejected.some((r) => r.value === 5.06 && /px from where it is drawn/.test(r.why))).toBe(true)
  })

  it('leaves a rung unresolved rather than forcing it onto the line', () => {
    const solved = solveLevelLadder([rung('a', 642, 0), rung('b', 415.3, 3.06), rung('c', 296.1, 4.67), rung('rogue', 500, 9.9)])
    expect(solved.fitted).toBe(3)
    expect(solved.datums[3].origin).toBe('UNRESOLVED')
    expect(solved.datums[3].value).toBeUndefined()
  })

  it('tolerates the few pixels a drawn rule really sits from where a height says it does, and reports the residual', () => {
    // The rows a reader actually recovers from a published section: each rule
    // is found to a pixel or three, so the rungs are never exactly collinear.
    const solved = solveLevelLadder([rung('a', 642, 0), rung('b', 419.4, 3.06), rung('c', 292, 4.67), rung('d', 54, 7.95)])
    expect(solved.fitted).toBeGreaterThanOrEqual(3)
    expect(solved.residualPx).toBeGreaterThan(0)
    expect(solved.residualPx).toBeLessThan(6)
    expect(solved.metresPerPixel).toBeGreaterThan(0.012)
    expect(solved.metresPerPixel).toBeLessThan(0.015)
  })

  it('needs at least two rungs, and refuses a ladder that leans the wrong way', () => {
    expect(solveLevelLadder([rung('a', 642, 0)]).fitted).toBe(0)
    // Heights that grow DOWN the page are not heights.
    const upside = solveLevelLadder([rung('a', 100, 0), rung('b', 400, 5)])
    expect(upside.metresPerPixel).toBeUndefined()
  })
})
