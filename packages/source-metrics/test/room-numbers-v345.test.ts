/**
 * v3.45: room numbers read by the shipped numeric recogniser. Invented sheets and invented recogniser readings: no
 * publisher image, no development house's figures.
 */
import { describe, expect, it } from 'vitest'
import { fillRect, whiteRaster } from '../../source-cv/test/draw.js'
import { toGray } from '@buildapp/source-cv'
import { OcrTokenSchema, ROOM_NUMBER_MIN_CAP_PX, ROOM_NUMBER_MIN_MEAN_P, roomNumberLabels, roomNumberReadingOf, roomNumberTokens, widenAlongRow } from '../src/index.js'
import type { ExternalReading, OcrToken } from '../src/index.js'

const reading = (key: string, greedy: string, meanP: number, top: string[]): ExternalReading => ({
  key,
  engine: 'fixture',
  modelSha256: '0'.repeat(64),
  runtime: 'fixture',
  topK: top.map((text, i) => ({ text, p: i === 0 ? 0.9 : 0.05 })),
  greedy: { text: greedy, meanP },
  stable: true,
  variants: [],
})

const ink: [number, number, number] = [200, 30, 30]
/** Glyph-like blocks of ink: one per digit, `h` tall, `w` wide, `gap` apart. */
function digits(r: ReturnType<typeof whiteRaster>, x: number, y: number, n: number, h: number, w = Math.round(h * 0.45), gap = 2): { x0: number; x1: number; y0: number; y1: number } {
  for (let i = 0; i < n; i += 1) fillRect(r, x + i * (w + gap), y, x + i * (w + gap) + w - 1, y + h - 1, ink)
  return { x0: x, x1: x + n * w + (n - 1) * gap - 1, y0: y, y1: y + h - 1 }
}
const token = (id: string, text: string, box: { x0: number; x1: number; y0: number; y1: number }, orientation: OcrToken['orientation'] = 'HORIZONTAL') => ({ id, text, box, orientation, heightPx: box.y1 - box.y0 + 1 })

describe('roomNumberLabels: which template tokens are read again', () => {
  it('upright one- and two-digit tokens at least the cap tall; a rotated or a short one is not', () => {
    const r = whiteRaster(300, 200)
    const a = digits(r, 20, 20, 1, 16)
    const b = digits(r, 80, 20, 2, 16)
    const c = digits(r, 160, 20, 1, ROOM_NUMBER_MIN_CAP_PX - 2)
    const d = digits(r, 220, 20, 1, 16)
    const { labels, crops } = roomNumberLabels(toGray(r), [token('a', '7', a), token('b', '12', b), token('c', '4', c), token('d', '5', d, 'ROTATED_CW'), token('e', 'A', a)])
    expect(labels.map((l) => l.tokenIds)).toEqual([['a'], ['b']])
    expect(labels.map((l) => l.heightPx)).toEqual([16, 16])
    expect(crops.map((c) => c.key)).toEqual(['n0', 'n1'])
  })
  it('a digit the template split off a longer label comes back as the whole label (one label for both tokens)', () => {
    const r = whiteRaster(300, 200)
    const whole = digits(r, 40, 40, 3, 16)
    const first = { x0: whole.x0, x1: whole.x0 + 6, y0: whole.y0, y1: whole.y1 }
    const second = { x0: whole.x0 + 9, x1: whole.x0 + 15, y0: whole.y0, y1: whole.y1 }
    const { labels } = roomNumberLabels(toGray(r), [token('p', '2', first), token('q', '9', second)])
    expect(labels).toHaveLength(1)
    expect(labels[0].tokenIds).toEqual(['p', 'q'])
    expect(labels[0].box.x0).toBe(whole.x0)
    expect(labels[0].box.x1).toBe(whole.x1)
  })
  it('the widening stops at paper wider than its gap share of the height', () => {
    const r = whiteRaster(300, 200)
    const a = digits(r, 40, 40, 1, 20)
    digits(r, a.x1 + 30, 40, 1, 20)
    expect(widenAlongRow(toGray(r), a)).toEqual(a)
  })
})

describe('roomNumberReadingOf: the gate a reading passes to be heard', () => {
  const label = { key: 'n0', box: { x0: 0, x1: 8, y0: 0, y1: 16 }, tokenIds: ['t'], heightPx: 17 }
  it('one or two digits, mean probability, the digit beam agreeing', () => {
    expect(roomNumberReadingOf(label, reading('n0', '6', 0.999, ['6', '60'])).text).toBe('6')
    expect(roomNumberReadingOf({ ...label, box: { x0: 0, x1: 18, y0: 0, y1: 16 } }, reading('n0', '12', 0.995, ['12'])).text).toBe('12')
  })
  it('refuses: a third digit (a dimension), a letter, a low mean, a beam that reads otherwise, a label wider than its digits', () => {
    expect(roomNumberReadingOf(label, reading('n0', '290', 0.999, ['290'])).text).toBeUndefined()
    expect(roomNumberReadingOf(label, reading('n0', '6a', 0.999, ['6'])).text).toBeUndefined()
    expect(roomNumberReadingOf(label, reading('n0', '6', ROOM_NUMBER_MIN_MEAN_P - 0.01, ['6'])).text).toBeUndefined()
    expect(roomNumberReadingOf(label, reading('n0', '6', 0.999, ['8', '6'])).text).toBeUndefined()
    expect(roomNumberReadingOf({ ...label, box: { x0: 0, x1: 30, y0: 0, y1: 16 } }, reading('n0', '6', 0.999, ['6'])).text).toBeUndefined()
    expect(roomNumberReadingOf(label, undefined).text).toBeUndefined()
  })
})

describe('roomNumberTokens: heard readings as kept upright tokens that supersede the template’s', () => {
  const frame = { id: 'frame-plan', assetId: 'asset-plan', variantByteHash: 'a'.repeat(64) }
  it('a heard reading is a schema-valid token naming the template tokens it replaces; a refused one adds nothing', () => {
    const labels = [
      { key: 'n0', box: { x0: 10, x1: 18, y0: 10, y1: 26 }, tokenIds: ['ocr-8', 'ocr-8-inverted'], heightPx: 17 },
      { key: 'n1', box: { x0: 60, x1: 68, y0: 10, y1: 26 }, tokenIds: ['ocr-x'], heightPx: 17 },
    ]
    const { tokens, verdicts } = roomNumberTokens(frame, labels, [reading('n0', '6', 0.9993, ['6', '60']), reading('n1', '5', 0.6, ['5'])])
    expect(tokens).toHaveLength(1)
    const [t] = tokens
    expect(OcrTokenSchema.parse(t)).toEqual(t)
    // the cap height is the template's own measure of the same ink, so the interior compares like with like
    expect(t).toMatchObject({ text: '6', orientation: 'HORIZONTAL', pageVote: 'KEPT', reader: 'RECOGNISER', supersedes: ['ocr-8', 'ocr-8-inverted'], heightPx: 17 })
    expect(t.glyphs).toHaveLength(1)
    expect(verdicts[1].why).toMatch(/mean probability/)
  })
  it('is deterministic: the same readings make the same token ids', () => {
    const labels = [{ key: 'n0', box: { x0: 10, x1: 26, y0: 10, y1: 26 }, tokenIds: ['t'], heightPx: 17 }]
    const a = roomNumberTokens(frame, labels, [reading('n0', '11', 0.999, ['11'])]).tokens
    const b = roomNumberTokens(frame, labels, [reading('n0', '11', 0.999, ['11'])]).tokens
    expect(a).toEqual(b)
    expect(a[0].glyphs.map((g) => g.char)).toEqual(['1', '1'])
  })
})
