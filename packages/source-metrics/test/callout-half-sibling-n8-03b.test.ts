/**
 * N8-03B: one half of a ring the gate refused only on the stability bracket or the mean character probability, the
 * other half passing on its own, is read when another ring on the same sheet reads that half outright with the same
 * text (`corroborateHalfBySibling`). A sheet prints its sizes in one hand. Every case is invented.
 *  - `300/230` with its height refused on the mean, beside `180/230` whose height passed: the height is read;
 *  - the same with no sibling, a sibling that reads another height, or a sibling's WIDTH that happens to read 230: not;
 *  - a height refused for a glyph it did not read (a leader line through the ring), or for its posterior: not;
 *  - a ring with neither half outright, or one already accepted: untouched; a lifted half never lifts another.
 */
import { describe, expect, it } from 'vitest'
import { corroborateHalfBySibling, judgeCalloutHalf } from '../src/callout-recogniser.js'
import type { CalloutHalfVerdict } from '../src/callout-recogniser.js'
import type { ExternalReading } from '../src/recogniser.js'

const reading = (text: string, p = 0.99, meanP = 0.99, stable = true): ExternalReading => ({ key: 'k', engine: 'ocr.fixture@0', modelSha256: 'a'.repeat(64), runtime: 'fixture', topK: [{ text, p }], greedy: { text, meanP }, stable }) as ExternalReading
const relaxedOf = (r: ExternalReading, glyphs: number, half: 'width' | 'height'): boolean => judgeCalloutHalf({ ...r, stable: true, greedy: { ...r.greedy, meanP: 1 } }, glyphs, half).accepted
type Ring = { id: string; width: CalloutHalfVerdict; height: CalloutHalfVerdict; accepted: boolean; relaxed: { width: boolean; height: boolean } }
const ring = (id: string, w: ExternalReading, h: ExternalReading, glyphs: { w?: number; h?: number } = {}): Ring => {
  const width = judgeCalloutHalf(w, glyphs.w ?? w.topK[0].text.length, 'width')
  const height = judgeCalloutHalf(h, glyphs.h ?? h.topK[0].text.length, 'height')
  return { id, width, height, accepted: width.accepted && height.accepted, relaxed: { width: relaxedOf(w, glyphs.w ?? w.topK[0].text.length, 'width'), height: relaxedOf(h, glyphs.h ?? h.topK[0].text.length, 'height') } }
}
const lift = (rings: Ring[]) => corroborateHalfBySibling(rings, rings)

describe('a ring half lifted by a sibling half', () => {
  const sibling = ring('s', reading('180', 0.92, 0.85, false), reading('230'))
  it('reads the height a sibling reads outright, the width having passed, the height refused on its mean', () => {
    const r = ring('r', reading('300'), reading('230', 0.993, 0.86))
    expect(r.accepted).toBe(false)
    const out = lift([r, sibling])
    expect(out.get('r')?.height).toMatchObject({ accepted: true, valueCm: 230 })
    expect(out.get('r')?.height.why).toMatch(/s on this sheet reads its height 230 outright/)
    expect(out.get('r')?.width.accepted).toBe(true)
  })
  it('reads one refused on the stability bracket the same way', () => {
    expect(lift([ring('r', reading('300'), reading('230', 0.99, 0.99, false)), sibling]).get('r')?.height.accepted).toBe(true)
  })
  it('does not without a sibling, with a sibling of another height, or with a sibling whose other half reads the text', () => {
    const r = ring('r', reading('300'), reading('230', 0.993, 0.86))
    expect(lift([r]).size).toBe(0)
    expect(lift([r, ring('s', reading('180'), reading('220'))]).size).toBe(0)
    expect(lift([r, ring('s', reading('230'), reading('210', 0.5, 0.5))]).size).toBe(0)
  })
  it('does not lift a half the ink says dropped a glyph, or one refused on its posterior', () => {
    // a leader line through the ring: four glyphs of ink for three digits read
    expect(lift([ring('r', reading('200'), reading('230', 0.96, 0.72, false), { h: 4 }), sibling]).size).toBe(0)
    expect(lift([ring('r', reading('290'), reading('230', 0.6, 0.95)), sibling]).size).toBe(0)
  })
  it('leaves alone a ring with neither half outright, and one already read', () => {
    const neither = ring('n', reading('300', 0.99, 0.8), reading('230', 0.99, 0.8))
    const read = ring('a', reading('300'), reading('230'))
    expect(lift([neither, read, sibling]).has('n')).toBe(false)
    expect(lift([neither, read, sibling]).has('a')).toBe(false)
  })
  it('takes its siblings as the gate judged them: a half lifted here is no sibling for another', () => {
    const r = ring('r', reading('300'), reading('230', 0.993, 0.86))
    const q = ring('q', reading('230', 0.99, 0.8), reading('140'))
    // `q`'s width 230 would need a sibling WIDTH of 230 outright; `r`'s height is neither a width nor outright
    expect(lift([r, q, sibling]).has('q')).toBe(false)
  })
})
