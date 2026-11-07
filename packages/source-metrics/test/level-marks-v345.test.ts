/**
 * v3.45: section level marks read by the numeric recogniser and admitted only by the same drawing.
 * Invented sheets and invented recogniser readings: no publisher image, no development house's figures.
 */
import { describe, expect, it } from 'vitest'
import { drawLine, fillRect, whiteRaster } from '../../source-cv/test/draw.js'
import { toGray } from '@buildapp/source-cv'
import { checkLevelReadings, levelCrops, levelEvidenceFromReadings, levelLabels, levelReadingOf, levelReadingsFrom, markerApexBelow, MIN_CAP_PX } from '../src/index.js'
import type { ExternalLevelReading, ExternalReading } from '../src/index.js'

const reading = (greedy: string, meanP: number, top: string[]): ExternalReading => ({
  key: 'k',
  engine: 'fixture',
  modelSha256: '0'.repeat(64),
  runtime: 'fixture',
  topK: top.map((text, i) => ({ text, p: i === 0 ? 0.6 : 0.3 })),
  greedy: { text: greedy, meanP },
  stable: false,
  variants: [],
})

describe('levelReadingOf: what one recogniser reading of a level label says', () => {
  it('reads sign, digits and decimal comma when the digit beam agrees', () => {
    expect(levelReadingOf(reading('+7,70', 0.999, ['770', '4770'])).text).toBe('+7,70')
    expect(levelReadingOf(reading('-0,32', 0.99, ['032'])).text).toBe('-0,32')
    expect(levelReadingOf(reading('±0,00', 0.99, ['0900', '000'])).text).toBe('±0,00')
    // the beam may read the sign as one more digit
    expect(levelReadingOf(reading('+2,96', 0.99, ['4296', '296'])).text).toBe('+2,96')
  })
  it('a decimal point reads as the comma, a typographic minus as a minus', () => {
    expect(levelReadingOf(reading('+3.15', 0.95, ['4315'])).text).toBe('+3,15')
    expect(levelReadingOf(reading('−0,57', 0.99, ['057'])).text).toBe('-0,57')
  })
  it('junk the widened crop caught beside the mark is dropped; an unsigned neighbour is no second level', () => {
    expect(levelReadingOf(reading('7+3,36', 0.93, ['7336', '74336'])).text).toBe('+3,36')
    expect(levelReadingOf(reading('9,04 l +2,93', 0.95, ['2793', '293'])).text).toBe('+2,93')
  })
  it('refuses: two signed levels in one crop, no sign, a low mean, a digit beam that reads other digits', () => {
    expect(levelReadingOf(reading('+2,96 -0,32', 0.99, ['296032'])).text).toBeUndefined()
    expect(levelReadingOf(reading('3.01', 0.99, ['301'])).text).toBeUndefined()
    expect(levelReadingOf(reading('+2,96', 0.85, ['296'])).text).toBeUndefined()
    expect(levelReadingOf(reading('+2,96', 0.99, ['4286', '286'])).text).toBeUndefined()
    expect(levelReadingOf(reading('300', 0.99, ['300'])).text).toBeUndefined() // an angle 30° read without its sign
  })
})

const grey: [number, number, number] = [60, 60, 60]
/** A section: a ▽ whose apex marks the row of each level, a label above it. `shift` misreads every label by that much. */
function section(marks: Array<{ value: number; x: number }>, zeroRow: number, mpp: number, opts: { shift?: number; mirror?: boolean; w?: number } = {}) {
  const w = opts.w ?? 600
  const r = whiteRaster(w, 520)
  const readings: ExternalLevelReading[] = []
  for (const m of marks) {
    const x = opts.mirror ? w - m.x : m.x
    const apex = Math.round(zeroRow - m.value / mpp)
    const top = apex - 12
    drawLine(r, x - 7, top, x + 30, top, grey)
    for (let y = top; y <= apex; y += 1) {
      const d = (apex - y) * 0.577
      if (y % 3 !== 0) {
        fillRect(r, Math.round(x - d), y, Math.round(x - d), y, grey)
        fillRect(r, Math.round(x + d), y, Math.round(x + d), y, grey)
      }
    }
    const v = Math.round((m.value + (opts.shift ?? 0)) * 100) / 100
    const text = `${v > 0 ? '+' : v === 0 ? '±' : '-'}${Math.abs(v).toFixed(2).replace('.', ',')}`
    readings.push({ text, boxPx: { x0: x - 20, y0: top - 26, x1: x + 40, y1: top - 4 }, classConfidence: 0.99 })
  }
  return { r, readings }
}
const house = [
  { value: 7.6, x: 300 },
  { value: 3.4, x: 480 },
  { value: 2.96, x: 120 },
  { value: 0, x: 380 },
  { value: -0.32, x: 540 },
]

describe('the zero is anchored by a printed ±0,00, never by consistent differences (audit 1320, +0,15 m)', () => {
  for (const [zeroRow, mpp] of [[420, 0.04], [460, 0.02]] as const) {
    it(`every label misread by +0,15 m: one straight ladder, the published height met — and still no anchor (${mpp} m/px)`, () => {
      const { r, readings } = section(house, zeroRow, mpp, { shift: 0.15 })
      const v = checkLevelReadings(r, readings, { key: 'building_height', valueM: 7.92 })
      expect(readings.some((x) => x.text.startsWith('±'))).toBe(false)
      expect(v.checks.filter((c) => c.status === 'ON_LADDER').length).toBe(5) // the differences agree…
      expect(v.zeroAnchor).toBe('NONE') // …and that anchors nothing
      expect(v.admitted).toBe(false)
      expect(levelEvidenceFromReadings({ id: 'f', assetId: 'a', variantByteHash: 'h' }, readings, v, { id: 'r', model: 'm', kind: 'RECOGNISER' }).evidence).toEqual([])
    })
    // A correct ±0,00 among labels all shifted by less than the drawing's own placement (LADDER_TOLERANCE_M, 0.25 m,
    // measured on development sections) is not separable by geometry: only the printed zero sign anchors, and the
    // two decoders' agreement is what keeps digits honest. Beyond that tolerance the drawing refuses the shift.
    it(`the printed ±0,00 among labels shifted +0,40 m stands off their ladder: still no anchor (${mpp} m/px)`, () => {
      const { r, readings } = section(house, zeroRow, mpp, { shift: 0.4 })
      const withZero = readings.map((x, i) => (house[i].value === 0 ? { ...x, text: '±0,00' } : x))
      const v = checkLevelReadings(r, withZero)
      expect(v.admitted).toBe(false)
      expect(levelEvidenceFromReadings({ id: 'f', assetId: 'a', variantByteHash: 'h' }, withZero, v, { id: 'r', model: 'm', kind: 'RECOGNISER' }).evidence).toEqual([])
    })
  }
  it('read right, the same sheet is admitted with the printed zero as its anchor, mirrored or not', () => {
    for (const mirror of [false, true]) {
      const { r, readings } = section(house, 420, 0.04, { mirror })
      const v = checkLevelReadings(r, readings)
      expect(v.zeroAnchor).toBe('PRINTED_ZERO')
      expect(v.admitted).toBe(true)
      const made = levelEvidenceFromReadings({ id: 'f', assetId: 'a', variantByteHash: 'h' }, readings, v, { id: 'r', model: 'm', kind: 'RECOGNISER' })
      expect(made.evidence.map((e) => e.value).sort((a, b) => a - b)).toEqual([-0.32, 0, 2.96, 3.4, 7.6])
      expect(made.evidence.every((e) => e.provenance.extractor === 'RECOGNISER_VALIDATED')).toBe(true)
      expect(made.registration).toBeDefined()
    }
  })
  it('removing the printed zero removes the knowledge: the same marks without ±0,00 are not admitted', () => {
    const { r, readings } = section(house, 420, 0.04)
    const v = checkLevelReadings(r, readings.filter((x) => !x.text.startsWith('±')))
    expect(v.zeroAnchor).toBe('NONE')
    expect(v.admitted).toBe(false)
  })
  it('a confidently misread digit is refused by its own row (+2,96 heard as +2,46)', () => {
    const { r, readings } = section(house, 420, 0.04)
    const wrong = readings.map((x) => (x.text === '+2,96' ? { ...x, text: '+2,46' } : x))
    const v = checkLevelReadings(r, wrong)
    expect(v.checks.find((c) => c.text === '+2,46')?.status).toBe('OFF_LADDER')
    expect(v.admitted).toBe(true)
  })
})

describe('levelLabels: which template tokens are level labels, and their full ink', () => {
  /** A ▽ at `apexRow` under x, and a block of "glyphs" (ink columns) from gx0 to gx1 above it. */
  function mark(r: ReturnType<typeof whiteRaster>, x: number, apexRow: number, gx0: number, gx1: number, cap = 16) {
    const top = apexRow - 12
    drawLine(r, x - 7, top, x + 30, top, grey)
    for (let y = top; y <= apexRow; y += 1) {
      const d = (apexRow - y) * 0.577
      if (y % 3 !== 0) {
        fillRect(r, Math.round(x - d), y, Math.round(x - d), y, grey)
        fillRect(r, Math.round(x + d), y, Math.round(x + d), y, grey)
      }
    }
    for (let gx = gx0; gx < gx1; gx += 7) fillRect(r, gx, top - 4 - cap, gx + 3, top - 4, [20, 20, 20])
    return { y0: top - 4 - cap, y1: top - 4 }
  }
  it('a token over a level symbol is a label, widened over the ink of its own rows (a split sign or last digit)', () => {
    const r = whiteRaster(400, 300)
    const rows = mark(r, 150, 200, 120, 190)
    const labels = levelLabels(r, toGray(r), [{ box: { x0: 134, x1: 170, y0: rows.y0, y1: rows.y1 }, upright: true }])
    expect(labels).toHaveLength(1)
    expect(labels[0].box.x0).toBeLessThanOrEqual(120)
    expect(labels[0].box.x1).toBeGreaterThanOrEqual(186)
  })
  it('a token with no level symbol under it, a rotated token and one under the legibility gate are no labels', () => {
    const r = whiteRaster(400, 300)
    const rows = mark(r, 150, 200, 120, 190)
    for (let gx = 260; gx < 320; gx += 7) fillRect(r, gx, 100, gx + 3, 116, [20, 20, 20])
    const g = toGray(r)
    // the word of ink with no symbol under it never becomes a label, by token or by ink; the real mark is found once,
    // from its own ink, whatever the rotated or under-gate tokens say
    for (const tokens of [
      [{ box: { x0: 260, x1: 320, y0: 100, y1: 116 }, upright: true }],
      [{ box: { x0: 120, x1: 190, y0: rows.y0, y1: rows.y1 }, upright: false }],
      [{ box: { x0: 120, x1: 190, y0: rows.y1 - (MIN_CAP_PX - 2), y1: rows.y1 }, upright: true }],
    ]) {
      const labels = levelLabels(r, g, tokens)
      expect(labels).toHaveLength(1)
      expect(labels[0].source).toBe('INK')
      expect(labels[0].box.x1).toBeLessThan(250)
    }
  })
  it('two tokens of one mark are one label', () => {
    const r = whiteRaster(400, 300)
    const rows = mark(r, 150, 200, 120, 190)
    const labels = levelLabels(r, toGray(r), [
      { box: { x0: 120, x1: 150, y0: rows.y0, y1: rows.y1 }, upright: true },
      { box: { x0: 155, x1: 190, y0: rows.y0, y1: rows.y1 }, upright: true },
    ])
    expect(labels).toHaveLength(1)
  })
  it('a label is read twice: what one crop hears and the other does not contradict is heard; two different levels refuse it', () => {
    const box = { x0: 0, x1: 10, y0: 0, y1: 10 }
    const labels = ['L0', 'L1', 'L2', 'L3'].map((key) => ({ key, box, tight: box, apexRow: 20, source: 'TOKEN' as const }))
    const r = (key: string, g: string, p: number, top: string[]) => ({ ...reading(g, p, top), key })
    const out = levelReadingsFrom(labels, [
      r('L0t', '±0,00', 0.99, ['000']), r('L0w', '7±0,00', 0.88, ['7000']), // junk beside the widened crop: the tight one hears
      r('L1t', '+2,96', 0.99, ['296']), r('L1w', '+2,96', 0.99, ['4296']),
      r('L2t', '+2,96', 0.99, ['296']), r('L2w', '+2,46', 0.99, ['246']), // two crops, two levels: refused
      r('L3t', '3.01', 0.99, ['301']), // nothing heard
    ])
    expect(out.readings.map((x) => x.text)).toEqual(['±0,00', '+2,96'])
    expect(out.refused).toHaveLength(2)
    expect(out.refused[0].why).toMatch(/ambiguous/)
  })
  it('a label the template never tokenised is found from the ink over its symbol', () => {
    const r = whiteRaster(400, 300)
    mark(r, 150, 200, 120, 190)
    const labels = levelLabels(r, toGray(r), [])
    expect(labels).toHaveLength(1)
    expect(labels[0].source).toBe('INK')
    expect(levelCrops(toGray(r), labels).map((c) => c.key)).toEqual(['L0t', 'L0w'])
  })
})

describe('markerApexBelow: the point of a symbol drawn onto a slab is the slab\'s first row, not a row inside it', () => {
  it('a ▽ whose point touches a 20 px fill', () => {
    const r = whiteRaster(300, 200)
    const apex = 120
    const top = apex - 12
    drawLine(r, 93, top, 130, top, grey)
    for (let y = top; y <= apex; y += 1) {
      const d = (apex - y) * 0.577
      if (y % 3 !== 0) {
        fillRect(r, Math.round(100 - d), y, Math.round(100 - d), y, grey)
        fillRect(r, Math.round(100 + d), y, Math.round(100 + d), y, grey)
      }
    }
    fillRect(r, 20, apex + 1, 280, apex + 20, [0, 0, 0])
    const found = markerApexBelow(r, { x0: 80, x1: 140, y0: top - 26, y1: top - 4 })
    expect(found).toBeDefined()
    expect(Math.abs((found?.row ?? 0) - apex)).toBeLessThanOrEqual(1)
  })
})
