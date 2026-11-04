/**
 * EXTERIOR-COMPLETE (Bakopy, disclosed DEV house): a level reading is replaced by a substituted one only where the
 * clean reading is clearly off the ladder.
 *
 * The first wrong decision: a section with three heights — ±0,00, +3,27 and the ridge's +6,28, read clean — fits its
 * scale through the first two exactly, and the ridge's rule, drawn 6.4 px off that line (one px beyond the ladder's
 * tolerance), was "corrected" to an unread +6,18. A label drawn a few pixels off the line is the drawing's placement;
 * a misread digit puts a height half a metre or metres off. The first attempt (substitute only with three other rungs)
 * also stopped true corrections — Willa Maja's section prints +2,96 and +7,98, read "+2,46" and "+7,48" (a 9 read as a
 * 4), on three rungs — and was replaced: the clean reading must miss by more than `LADDER_SUBSTITUTION_MIN_MISS`
 * tolerances before a substitute is taken.
 */
import { describe, expect, it } from 'vitest'
import { LADDER_SUBSTITUTION_MIN_MISS, solveLevelLadder } from '../src/registration.js'

const rung = (id: string, rowPx: number, read: number, subs: number[] = []) => ({
  tokenId: id,
  rowPx,
  readings: [{ value: read, rawText: read.toFixed(2), confidence: 0.9, substitutions: 0 }, ...subs.map((v) => ({ value: v, rawText: v.toFixed(2), confidence: 0.8, substitutions: 1 }))],
})
/** 0.015567 m per pixel, zero at row 620 (the section's own scale). */
const rowOf = (h: number): number => 620 - h / 0.015567

describe('EXTERIOR-COMPLETE: a reading is substituted only where the clean one is clearly off the ladder', () => {
  it('three rungs, the third drawn 6.4 px off: the clean reading stands (unresolved against the scale), never the substitute', () => {
    const solved = solveLevelLadder([rung('zero', 620, 0), rung('eaves', rowOf(3.27), 3.27), rung('ridge', rowOf(6.28) + 6.4, 6.28, [6.18, 6.38])])
    const ridge = solved.datums[2]
    expect(ridge.origin).not.toBe('CHAIN_CORRECTED')
    expect(ridge.value).toBeUndefined()
    expect(LADDER_SUBSTITUTION_MIN_MISS).toBe(2)
  })
  it('on a ladder three other rungs over-determine, a clean reading off it by more than the tolerance is corrected as before', () => {
    // the synthetic section's "+5,40" read 5.1: 11.7 px off a line through three other rungs
    const solved = solveLevelLadder([rung('a', 406, 0), rung('b', 301, 2.8), rung('c', 201, 5.1, [5.4]), rung('d', 119, 7.56)])
    expect(solved.datums[2]).toMatchObject({ value: 5.4, origin: 'CHAIN_CORRECTED' })
  })
  it('a misread by metres against three other heights is still corrected', () => {
    const solved = solveLevelLadder([rung('a', 642, 0), rung('b', 415.3, 5.06, [3.06]), rung('c', 296.1, 4.67), rung('d', 53.1, 7.95)])
    expect(solved.datums[1]).toMatchObject({ value: 3.06, origin: 'CHAIN_CORRECTED' })
  })
  it('two rungs of three misread by half a metre (a 9 read as a 4) are corrected', () => {
    const solved = solveLevelLadder([rung('zero', 622, 0), rung('floor', 410, 2.46, [2.96]), rung('ridge', 50, 7.48, [7.98])])
    expect(solved.datums[1]).toMatchObject({ value: 2.96, origin: 'CHAIN_CORRECTED' })
    expect(solved.datums[2]).toMatchObject({ value: 7.98, origin: 'CHAIN_CORRECTED' })
  })
})
