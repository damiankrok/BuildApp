/**
 * EXTERIOR-COMPLETE (Bakopy, disclosed DEV house): a level reading is replaced by a substituted one only on a ladder
 * the other rungs over-determine.
 *
 * The first wrong decision: a section with three heights — ±0,00, +3,27 and the ridge's +6,28, read clean — fits its
 * scale through the first two exactly, and the ridge's rule, drawn 6.4 px off that line (one px beyond the ladder's
 * tolerance), was "corrected" to an unread +6,18. Through two rungs the line is exact: a third drawn a few pixels off
 * is as much the drawing as a misread. A misread by metres against three other heights is still corrected.
 */
import { describe, expect, it } from 'vitest'
import { LADDER_CORRECTION_MIN_OTHERS, solveLevelLadder } from '../src/registration.js'

const rung = (id: string, rowPx: number, read: number, subs: number[] = []) => ({
  tokenId: id,
  rowPx,
  readings: [{ value: read, rawText: read.toFixed(2), confidence: 0.9, substitutions: 0 }, ...subs.map((v) => ({ value: v, rawText: v.toFixed(2), confidence: 0.8, substitutions: 1 }))],
})
/** 0.015567 m per pixel, zero at row 620 (the section's own scale). */
const rowOf = (h: number): number => 620 - h / 0.015567

describe('EXTERIOR-COMPLETE: a reading is substituted only where the other rungs over-determine the scale', () => {
  it('three rungs, the third drawn 6.4 px off: the clean reading stands (unresolved against the scale), never the substitute', () => {
    const solved = solveLevelLadder([rung('zero', 620, 0), rung('eaves', rowOf(3.27), 3.27), rung('ridge', rowOf(6.28) + 6.4, 6.28, [6.18, 6.38])])
    const ridge = solved.datums[2]
    expect(ridge.origin).not.toBe('CHAIN_CORRECTED')
    expect(ridge.value).toBeUndefined()
    expect(LADDER_CORRECTION_MIN_OTHERS).toBe(3)
  })
  it('a misread by metres against three other heights is still corrected', () => {
    const solved = solveLevelLadder([rung('a', 642, 0), rung('b', 415.3, 5.06, [3.06]), rung('c', 296.1, 4.67), rung('d', 53.1, 7.95)])
    expect(solved.datums[1]).toMatchObject({ value: 3.06, origin: 'CHAIN_CORRECTED' })
  })
})
