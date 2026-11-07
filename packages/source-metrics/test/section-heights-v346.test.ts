/**
 * v3.46: a section's vertical dimensions — the number, the line beside it, the line's ends, and the span between them at
 * the section's level-ladder scale. The section is drawn here from invented dimensions (1.5 cm per pixel): a floor slab
 * and a ceiling slab as thick black bands, a faint grey dimension line between their faces, a knee-wall line that runs
 * on past its tick, and labels beside them. The recogniser is a fixture: these tests are of the reader's binding of a
 * heard number to a line, not of digit recognition.
 */
import { describe, expect, it } from 'vitest'
import type { Gray } from '@buildapp/source-cv'
import type { ExternalReading } from '../src/recogniser.js'
import { judgeSectionHeight, judgeSectionHeights, quarterTurn, sectionHeightCrops, sectionHeightLabels } from '../src/section-heights.js'
import type { SectionHeightLabel } from '../src/section-heights.js'

const CM_PER_PX = 1.5
const W = 400
const H = 400

function paper(): Gray {
  return { width: W, height: H, data: new Uint8ClampedArray(W * H).fill(255) }
}
const fill = (g: Gray, x0: number, x1: number, y0: number, y1: number, v: number): void => {
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) g.data[y * W + x] = v
}

/** Ceiling slab underside at row 100, floor slab top at row 280: 180 px, 270 cm at 1.5 cm/px. */
function section(): Gray {
  const g = paper()
  fill(g, 20, 380, 80, 99, 0) // ceiling slab
  fill(g, 20, 380, 281, 300, 0) // floor slab
  fill(g, 200, 200, 100, 280, 200) // the clear-height line, face to face
  // a knee wall's line: from the floor up past its tick at row 200 to a free end at row 186 (tick 80 px over the floor: 120 cm)
  fill(g, 300, 300, 186, 280, 200)
  fill(g, 296, 304, 200, 200, 190) // the tick crossing it
  // a second clear-height line of another length nearby (a window frame), 140 px
  fill(g, 120, 120, 130, 270, 200)
  return g
}

const reading = (key: string, text: string, meanP = 0.999): ExternalReading => ({
  key,
  engine: 'fixture',
  modelSha256: 'x',
  runtime: 'fixture',
  topK: [{ text: text.replace(/[,.]/, ''), p: 0.99 }],
  greedy: { text, meanP },
  stable: true,
  variants: [],
})

const label = (key: string, x0: number, y0: number, x1: number, y1: number, text = '27O'): SectionHeightLabel => ({ key, token: { id: key, text, box: { x0, y0, x1, y1 }, orientation: 'ROTATED_CW' } })

// the clear-height label, printed just left of its line
const CLEAR = label('h0', 182, 170, 196, 210)
// the knee-wall label, left of its line
const KNEE = label('h1', 282, 225, 296, 255, '12O')

describe('v3.46: a vertical dimension on a section is its line, its ends and their span', () => {
  it('a clear height printed beside a line from slab face to slab face stands, its ends the two faces', () => {
    const v = judgeSectionHeight(section(), CLEAR, [reading('h0c', '270')], CM_PER_PX, 'c')
    expect(v.admitted).toBe(true)
    expect(v.valueCm).toBe(270)
    expect(v.line).toMatchObject({ x: 200, top: 100, bottom: 280, topEnd: 'THICK', bottomEnd: 'THICK' })
  })

  it('a knee wall whose line runs on past its tick ends at the tick, not at the free end', () => {
    const v = judgeSectionHeight(section(), KNEE, [reading('h1c', '120')], CM_PER_PX, 'c')
    expect(v.admitted).toBe(true)
    expect(v.line).toMatchObject({ top: 200, topEnd: 'TICK', bottom: 280, bottomEnd: 'THICK' })
  })

  it('opposite: a heard value its own line does not measure is refused (a near digit: 254 for a 270 span)', () => {
    const v = judgeSectionHeight(section(), CLEAR, [reading('h0c', '254')], CM_PER_PX, 'c')
    expect(v.admitted).toBe(false)
    expect(v.why).toMatch(/not 254/)
  })

  it('opposite: the right number beside the wrong line is refused (270 printed by the 140 px window line)', () => {
    const v = judgeSectionHeight(section(), label('h2', 102, 180, 116, 220), [reading('h2c', '270')], CM_PER_PX, 'c')
    expect(v.admitted).toBe(false)
  })

  it('opposite: a label with no line beside it, or one the recogniser is unsure of, is refused', () => {
    expect(judgeSectionHeight(section(), label('h3', 30, 150, 44, 190), [reading('h3c', '270')], CM_PER_PX, 'c').why).toMatch(/no faint line/)
    expect(judgeSectionHeight(section(), CLEAR, [reading('h0c', '270', 0.8)], CM_PER_PX, 'c').admitted).toBe(false)
  })

  it('the sheet reads its labels one way: the turn the drawing admits decides, and the other turn is not heard', () => {
    const readings = [reading('h0c', '270'), reading('h0a', '072'), reading('h1c', '120'), reading('h1a', '021')]
    const sheet = judgeSectionHeights(section(), [CLEAR, KNEE], readings, CM_PER_PX)
    expect(sheet.turn).toBe('c')
    expect(sheet.verdicts.map((v) => v.admitted)).toEqual([true, true])
    // with no turn the drawing admits, a label read two ways stays unread
    const none = judgeSectionHeights(section(), [label('h3', 30, 150, 44, 190)], [reading('h3c', '270'), reading('h3a', '072')], CM_PER_PX)
    expect(none.turn).toBeUndefined()
    expect(none.verdicts[0].why).toMatch(/ambiguous/)
  })

  it('labels: vertical, at least two digits, taller than wide; crops are the label turned both ways', () => {
    const toks = [
      { id: 'a', text: '266', box: { x0: 0, y0: 0, x1: 20, y1: 42 }, orientation: 'ROTATED_CW' },
      { id: 'b', text: '1', box: { x0: 0, y0: 0, x1: 134, y1: 19 }, orientation: 'ROTATED_CW' },
      { id: 'c', text: '266', box: { x0: 0, y0: 0, x1: 42, y1: 20 }, orientation: 'HORIZONTAL' },
    ]
    const labels = sectionHeightLabels(toks)
    expect(labels.map((l) => l.token.id)).toEqual(['a'])
    const crops = sectionHeightCrops(section(), labels)
    expect(crops.map((c) => c.key)).toEqual(['h0c', 'h0a'])
    expect(crops[0].gray.width).toBeGreaterThan(crops[0].gray.height)
    const g: Gray = { width: 2, height: 3, data: Uint8ClampedArray.from([1, 2, 3, 4, 5, 6]) }
    expect(Array.from(quarterTurn(g, true).data)).toEqual([5, 3, 1, 6, 4, 2])
  })
})
