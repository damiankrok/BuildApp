/**
 * v3.45: a room number the recogniser read supersedes the template's readings of the same ink; which room it numbers
 * is decided by the interior reader exactly as for any token. Synthetic sheets only; no drawing of any real building.
 */
import { describe, expect, it } from 'vitest'
import { labelTokensOf, readInterior } from '../src/index.js'
import type { PlanFrameV2 } from '../src/index.js'
import { BLACK, fillRect, whiteRaster } from '../../source-cv/test/draw.js'

// a 12 × 9 m house at 2.5 cm/px, a room 4 × 6 m in its front-east corner
const MPP = 0.025
const OX = 40
const OY = 400
const px = (x: number): number => Math.round(OX + x / MPP)
const py = (z: number): number => Math.round(OY - z / MPP)
const frame: PlanFrameV2 = {
  frameId: 'synthetic-plan',
  assetId: 'synthetic',
  storeyIndex: 0,
  mppX: MPP,
  mppY: MPP,
  originPx: { x: OX, y: OY },
  why: 'a fixture',
  toWorld: (x, y) => ({ x: (x - OX) * MPP, z: (OY - y) * MPP }),
  toPixel: (x, z) => ({ x: OX + x / MPP, y: OY - z / MPP }),
  wallPx: 6,
}
const BODY = { x0: 0, z0: 0, x1: 12, z1: 9 }
function house() {
  const r = whiteRaster(560, 460)
  fillRect(r, px(0), py(9), px(12) - 1, py(9) + 11, BLACK)
  fillRect(r, px(0), py(0) - 11, px(12) - 1, py(0), BLACK)
  fillRect(r, px(0), py(9), px(0) + 11, py(0), BLACK)
  fillRect(r, px(12) - 12, py(9), px(12) - 1, py(0), BLACK)
  fillRect(r, px(8) - 6, py(6), px(8) + 5, py(0), BLACK)
  fillRect(r, px(8), py(6) - 3, px(12), py(6) + 2, BLACK)
  return r
}
type Tok = Parameters<typeof labelTokensOf>[0][number]
/** An OCR token record centred on world (x, z), `h` px tall. */
const tok = (id: string, text: string, x: number, z: number, opts: Partial<Tok> & { h?: number } = {}): Tok => {
  const h = opts.h ?? 17
  return { id, text, box: { x0: px(x) - 5, y0: py(z) - h / 2, x1: px(x) + 5, y1: py(z) + h / 2 }, heightPx: h, confidence: 0.55, orientation: 'HORIZONTAL', pageVote: 'KEPT', ...opts }
}
const dimensions = [tok('d1', '544', -1, -1, { h: 13 }), tok('d2', '317', 5, -1, { h: 13 }), tok('d3', '524', 10, -1, { h: 13 })]
const published = [
  { number: '1', label: 'Salon', areaM2: 60 },
  { number: '3', label: 'Kuchnia', areaM2: 12 },
  { number: '6', label: 'Garaż', areaM2: 19.8 },
  { number: '8', label: 'Spiżarnia', areaM2: 3 },
]
const cornerRoom = (tokens: Tok[]) => readInterior(house(), frame, BODY, 0.3, 0, labelTokensOf(tokens), published).rooms.find((r) => r.bounds.x0 > 7.9 && r.bounds.z1 < 6.1)

describe('v3.45 room numbers read by the recogniser', () => {
  it('without it, the template misread (6 read as 8) names the wrong published room', () => {
    const room = cornerRoom([...dimensions, tok('t8', '8', 10, 3)])
    expect(room?.number).toBe('8')
  })
  it('with it, the recogniser reading supersedes the misread of the same ink and numbers the room', () => {
    const room = cornerRoom([...dimensions, tok('t8', '8', 10, 3), tok('t0', '0', 10, 3, { orientation: 'INVERTED', pageVote: 'DISCARDED' }), tok('r6', '6', 10, 3, { confidence: 0.999, reader: 'RECOGNISER', supersedes: ['t8', 't0'] })])
    expect(room?.number).toBe('6')
    expect(room?.label).toBe('Garaż')
  })
  it('a clean upright reading the page vote set aside, superseded by the recogniser, numbers the room as a kept token', () => {
    const room = cornerRoom([...dimensions, tok('t6', '6', 10, 3, { pageVote: 'DISCARDED' }), tok('t3', '3', 10, 3, { orientation: 'ROTATED_CW' }), tok('r6', '6', 10, 3, { confidence: 0.999, reader: 'RECOGNISER', supersedes: ['t6', 't3'] })])
    expect(room?.number).toBe('6')
    expect(room?.why).not.toMatch(/set aside/)
  })
  it('a recogniser reading naming no published room numbers nothing (foliage read as 66)', () => {
    expect(cornerRoom([...dimensions, tok('r66', '66', 10, 3, { confidence: 0.9999, reader: 'RECOGNISER', supersedes: [] })])?.number).toBeUndefined()
  })
  it('on a sheet whose dimension labels are as large as its room numbers, a recogniser reading still numbers its room; the template reading of the same size does not', () => {
    const large = [tok('d1', '544', -1, -1, { h: 17 }), tok('d2', '317', 5, -1, { h: 17 }), tok('d3', '524', 10, -1, { h: 17 })]
    expect(cornerRoom([...large, tok('t6', '6', 10, 3, { h: 16 })])?.number).toBeUndefined()
    expect(cornerRoom([...large, tok('t6', '6', 10, 3, { h: 16 }), tok('r6', '6', 10, 3, { h: 16, reader: 'RECOGNISER', supersedes: ['t6'] })])?.number).toBe('6')
  })
  it('a region holding two published numbers is several rooms: it takes neither number nor label, and says so', () => {
    const reading = readInterior(house(), frame, BODY, 0.3, 0, labelTokensOf([...dimensions, tok('r1', '1', 3, 6, { reader: 'RECOGNISER' }), tok('r3', '3', 5, 3, { reader: 'RECOGNISER' })]), published)
    const big = reading.rooms.find((r) => r.bounds.x0 < 1 && r.bounds.x1 > 7)
    expect(big?.number).toBeUndefined()
    expect(big?.label).toBeUndefined()
    expect(big?.why).toMatch(/2 published numbers are printed inside it \(1 Salon, 3 Kuchnia\)/)
    expect(reading.unresolved.some((u) => /two numbers \(1, 3\)/.test(u.reason))).toBe(true)
  })
  it('the superseded tokens stay out of the interior reader only: the frame keeps every other token', () => {
    const tokens = labelTokensOf([...dimensions, tok('t8', '8', 10, 3), tok('r6', '6', 10, 3, { supersedes: ['t8'] })])
    expect(tokens.map((t) => t.text)).toEqual(['544', '317', '524', '6'])
  })
})
