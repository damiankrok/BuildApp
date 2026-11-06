/**
 * E13: level marks a second reader (a vision model) read on a section, admitted only by the drawing itself — a level
 * symbol under each, one ladder through them — and the published height. Invented sheets: a ▽ under each label.
 */
import { describe, expect, it } from 'vitest'
import { fillRect, whiteRaster, drawLine } from '../../source-cv/test/draw.js'
import { checkLevelReadings, levelEvidenceFromReadings, MetricEvidenceSetSchema, supersededLevels } from '../src/index.js'
import type { ExternalLevelReading, MetricEvidence } from '../src/index.js'

const grey: [number, number, number] = [60, 60, 60]
/** A sheet with a ▽ whose apex marks `row` under a label box at (x, row − 30): zero at `zeroRow`, `mpp` metres a pixel. */
function sheet(marks: Array<{ value: number; x: number }>, zeroRow: number, mpp: number, w = 600, h = 500) {
  const r = whiteRaster(w, h)
  const readings: ExternalLevelReading[] = []
  for (const m of marks) {
    const apex = Math.round(zeroRow - m.value / mpp)
    const top = apex - 12
    drawLine(r, m.x - 7, top, m.x + 30, top, grey)
    for (let y = top; y <= apex; y += 1) {
      const d = (apex - y) * 0.577
      if (y % 3 !== 0) {
        fillRect(r, Math.round(m.x - d), y, Math.round(m.x - d), y, grey)
        fillRect(r, Math.round(m.x + d), y, Math.round(m.x + d), y, grey)
      }
    }
    const text = `${m.value > 0 ? '+' : m.value === 0 ? '±' : '-'}${Math.abs(m.value).toFixed(2).replace('.', ',')}`
    readings.push({ text, boxPx: { x0: m.x - 20, y0: top - 26, x1: m.x + 40, y1: top - 4 }, classConfidence: 0.9 })
  }
  return { r, readings }
}
const house = [
  { value: 8.55, x: 300 },
  { value: 2.93, x: 380 },
  { value: 2.42, x: 150 },
  { value: 0, x: 400 },
  { value: -0.47, x: 540 },
]
const published = { key: 'building_height', valueM: 9.02 }

describe('checkLevelReadings', () => {
  for (const [zeroRow, mpp] of [[420, 0.04], [460, 0.02], [300, 0.03]] as const) {
    it(`admits marks that lie on one ladder and meet the published height (zero row ${zeroRow}, ${mpp} m/px)`, () => {
      const { r, readings } = sheet(house, zeroRow, mpp)
      const v = checkLevelReadings(r, readings, published)
      expect(v.checks.map((c) => c.status)).toEqual(['ON_LADDER', 'ON_LADDER', 'ON_LADDER', 'ON_LADDER', 'ON_LADDER'])
      expect(v.admitted).toBe(true)
      expect(v.ladder?.metresPerPixel).toBeCloseTo(mpp, 3)
      expect(v.published?.agrees).toBe(true)
    })
  }
  it('a confidently misread floor mark is refused by the drawing (2,93 read as 3,93)', () => {
    const { r, readings } = sheet(house, 420, 0.04)
    const wrong = readings.map((x) => (x.text === '+2,93' ? { ...x, text: '+3,93', classConfidence: 0.99 } : x))
    const v = checkLevelReadings(r, wrong, published)
    expect(v.checks.find((c) => c.text === '+3,93')?.status).toBe('OFF_LADDER')
    expect(v.checks.filter((c) => c.status === 'ON_LADDER').length).toBe(4)
  })
  it('a confidently misread ridge may stay inside the ladder\'s interval, and the published height refuses it (8,55 read as 8,85)', () => {
    const { r, readings } = sheet(house, 420, 0.04)
    const wrong = readings.map((x) => (x.text === '+8,55' ? { ...x, text: '+8,85', classConfidence: 0.99 } : x))
    const v = checkLevelReadings(r, wrong, published)
    expect(v.published?.agrees).toBe(false)
  })
  it('counter: a label with no level symbol under it fixes no row; one that is not a level is no level', () => {
    const { r, readings } = sheet(house, 420, 0.04)
    const v = checkLevelReadings(r, [...readings, { text: '+5,00', boxPx: { x0: 10, y0: 10, x1: 60, y1: 30 }, classConfidence: 0.9 }, { text: '297', boxPx: { x0: 10, y0: 200, x1: 60, y1: 220 }, classConfidence: 0.9 }], published)
    expect(v.checks.find((c) => c.text === '+5,00')?.status).toBe('NO_SYMBOL')
    expect(v.checks.find((c) => c.text === '297')?.status).toBe('NOT_A_LEVEL')
    expect(v.admitted).toBe(true)
  })
  it('counter: two marks are no ladder; marks rising downwards are no section', () => {
    const { r, readings } = sheet(house.slice(0, 2), 420, 0.04)
    expect(checkLevelReadings(r, readings, published).admitted).toBe(false)
    const flipped = sheet(house, 420, 0.04)
    const upside = flipped.readings.map((x) => ({ ...x, text: x.text.startsWith('+') ? x.text.replace('+', '-') : x.text.startsWith('-') ? x.text.replace('-', '+') : x.text }))
    expect(checkLevelReadings(flipped.r, upside, published).admitted).toBe(false)
  })
  it('without a published height the ladder stands but says nothing corroborates it', () => {
    const { r, readings } = sheet(house, 420, 0.04)
    const v = checkLevelReadings(r, readings)
    expect(v.admitted).toBe(true)
    expect(v.published).toBeUndefined()
    expect(v.why).toMatch(/no published height/)
  })
})

describe('levelEvidenceFromReadings', () => {
  it('turns admitted marks into LEVEL_DATUM evidence and a section registration, named VISION_VALIDATED', () => {
    const { r, readings } = sheet(house, 420, 0.04)
    const v = checkLevelReadings(r, readings, published)
    const frame = { id: 'frame-section', assetId: 'asset-section', variantByteHash: 'a'.repeat(64) }
    const out = levelEvidenceFromReadings(frame, readings, v, { id: 'vision.test', model: 'm' })
    expect(out.evidence).toHaveLength(5)
    expect(out.evidence.every((e) => e.kind === 'LEVEL_DATUM' && e.provenance.extractor === 'VISION_VALIDATED')).toBe(true)
    expect(out.registration?.plane).toBe('SECTION_HY')
    expect(out.registration?.metresPerPixelY).toBeCloseTo(0.04, 3)
    // the evidence fits the schema the numeric reader's own does
    const set = MetricEvidenceSetSchema.shape.evidence.safeParse(out.evidence)
    expect(set.success).toBe(true)
  })
  it('counter: nothing from a refused ladder', () => {
    const { r, readings } = sheet(house.slice(0, 2), 420, 0.04)
    const v = checkLevelReadings(r, readings, published)
    expect(levelEvidenceFromReadings({ id: 'f', assetId: 'a', variantByteHash: 'a'.repeat(64) }, readings, v, { id: 'x', model: 'm' }).evidence).toEqual([])
  })
})

describe('supersededLevels', () => {
  const frame = { id: 'frame-section', assetId: 'asset-section', variantByteHash: 'a'.repeat(64) }
  /** The numeric reader's own datum: its value, its text box, the row its symbol marks. */
  const own = (id: string, value: number, box: { x0: number; y0: number; x1: number; y1: number }, row: number, frameId = frame.id): MetricEvidence =>
    ({ id, kind: 'LEVEL_DATUM', frameId, assetId: frame.assetId, variantByteHash: frame.variantByteHash, value, unit: 'm', origin: 'READ', rawText: String(value), textBox: box, measuredGeometry: { type: 'SEGMENT', a: { x: box.x0, y: row }, b: { x: box.x0 + 2, y: row } }, association: { kind: 'LEVEL_MARKER', score: 0.5, why: 'test', observationIds: [] }, ocrTokenIds: [], observationIds: [], alternatives: [], confidence: 0.6, provenance: { extractor: 'NUMERIC_OCR', name: 'test', detail: 'test' } }) as MetricEvidence
  for (const [zeroRow, mpp] of [[420, 0.04], [460, 0.02]] as const) {
    it(`one label read twice: the numeric reader's misread of an admitted mark gives way (2,93 read 2,43; zero row ${zeroRow})`, () => {
      const { r, readings } = sheet(house, zeroRow, mpp)
      const v = checkLevelReadings(r, readings, published)
      const box = readings.find((x) => x.text === '+2,93')?.boxPx as ExternalLevelReading['boxPx']
      const row = Math.round(zeroRow - 2.93 / mpp)
      const out = supersededLevels([own('cv-243', 2.43, { x0: box.x0 + 3, y0: box.y0 + 1, x1: box.x1 - 2, y1: box.y1 }, row)], frame.id, readings, v)
      expect(out.map((x) => x.evidenceId)).toEqual(['cv-243'])
      expect(out[0].why).toMatch(/same printed label/)
    })
    it(`a misread elsewhere on the sheet is refused by the ladder at its own row (zero row ${zeroRow})`, () => {
      const { r, readings } = sheet(house, zeroRow, mpp)
      const v = checkLevelReadings(r, readings.filter((x) => x.text !== '+2,42'), published)
      const row = Math.round(zeroRow - 2.42 / mpp)
      const out = supersededLevels([own('cv-elsewhere', 3.42, { x0: 10, y0: row - 40, x1: 60, y1: row - 16 }, row)], frame.id, readings.filter((x) => x.text !== '+2,42'), v)
      expect(out.map((x) => x.evidenceId)).toEqual(['cv-elsewhere'])
      expect(out[0].why).toMatch(/refuses it/)
    })
  }
  it('counter: an agreeing reading of the same label, a mark the ladder admits at its row, another frame and an admitted reading all stay', () => {
    const { r, readings } = sheet(house, 420, 0.04)
    const v = checkLevelReadings(r, readings.filter((x) => x.text !== '+2,42'), published)
    const live = readings.filter((x) => x.text !== '+2,42')
    const box = live.find((x) => x.text === '+2,93')?.boxPx as ExternalLevelReading['boxPx']
    const row242 = Math.round(420 - 2.42 / 0.04)
    const admitted = levelEvidenceFromReadings(frame, live, v, { id: 'x', model: 'm' }).evidence
    const keep = [
      own('cv-same', 2.93, box, Math.round(420 - 2.93 / 0.04)),
      own('cv-ladder', 2.42, { x0: 10, y0: row242 - 40, x1: 60, y1: row242 - 16 }, row242),
      own('cv-other-frame', 9.99, box, 10, 'frame-other'),
      ...admitted,
    ]
    expect(supersededLevels(keep, frame.id, live, v)).toEqual([])
  })
  it('counter: nothing is overruled by a ladder the drawing refused', () => {
    const { r, readings } = sheet(house.slice(0, 2), 420, 0.04)
    const v = checkLevelReadings(r, readings, published)
    expect(supersededLevels([own('cv', 1.11, readings[0].boxPx, 100)], frame.id, readings, v)).toEqual([])
  })
})
