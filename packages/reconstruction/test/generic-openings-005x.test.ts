/**
 * BUILDPLAN-ANALYZER-005X: one representation of openings, fed by the plan, the elevations and one perspective picture.
 *
 * - a rooflight callout drawn as a faint ring on a tinted knee-wall strip is found and read (`readTintedCallouts`);
 * - the plan of the storey under a gable states rooflights: slope, place along the ridge, size (`readPlanRooflights`);
 *   a wall callout outside the storey, an incoherent ring and a size no rooflight has are not rooflights;
 * - one picture of a house becomes a closed indicative model whose openings stand on its front wall in the picture's
 *   left-to-right order, a door reaching the floor and windows above it (`reconstructFromSingleImage`).
 *
 * Every raster is drawn here from invented shapes and colours; no drawing, render or photograph of a real house is used.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import { readTintedCallouts } from '@buildapp/source-metrics'
import type { CalloutReading } from '@buildapp/source-metrics'
import { readPlanRooflights, readSingleImage, reconstructFromSingleImage, SINGLE_IMAGE_LABEL } from '../src/index.js'

type RGB = [number, number, number]
function canvas(w: number, h: number, fill: RGB): Raster {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i += 1) {
    data[i * 4] = fill[0]
    data[i * 4 + 1] = fill[1]
    data[i * 4 + 2] = fill[2]
    data[i * 4 + 3] = 255
  }
  return { width: w, height: h, data }
}
const put = (r: Raster, x: number, y: number, c: RGB): void => {
  if (x < 0 || y < 0 || x >= r.width || y >= r.height) return
  const o = (Math.round(y) * r.width + Math.round(x)) * 4
  r.data[o] = c[0]
  r.data[o + 1] = c[1]
  r.data[o + 2] = c[2]
}
const rect = (r: Raster, x0: number, y0: number, x1: number, y1: number, c: RGB): void => {
  for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) put(r, x, y, c)
}

/** Digits as 3×5 bitmaps, scaled. */
const GLYPH: Record<string, string[]> = {
  '1': ['010', '110', '010', '010', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
}
function digits(r: Raster, text: string, x: number, y: number, s: number, c: RGB): void {
  text.split('').forEach((ch, k) => {
    const g = GLYPH[ch]
    for (let gy = 0; gy < 5; gy += 1) for (let gx = 0; gx < 3; gx += 1) if (g[gy][gx] === '1') rect(r, x + k * 4 * s + gx * s, y + gy * s, x + k * 4 * s + (gx + 1) * s, y + (gy + 1) * s, c)
  })
}

/** A callout ring of paper on a tinted field: a faint grey circle, a bar, digits above and below. */
function tintedCallout(r: Raster, cx: number, cy: number, radius: number, upper: string, lower: string, bar = true): void {
  for (let y = -radius; y <= radius; y += 1) for (let x = -radius; x <= radius; x += 1) if (x * x + y * y <= radius * radius) put(r, cx + x, cy + y, [231, 231, 232])
  for (let a = 0; a < 720; a += 1) {
    const t = (a * Math.PI) / 360
    put(r, cx + radius * Math.cos(t), cy + radius * Math.sin(t), [170, 170, 172])
  }
  if (bar) for (let x = -radius + 2; x <= radius - 2; x += 1) put(r, cx + x, cy, [175, 175, 177])
  digits(r, upper, cx - upper.length * 2 - 1, cy - 7, 1, [40, 40, 40])
  digits(r, lower, cx - lower.length * 2 - 1, cy + 2, 1, [40, 40, 40])
}

describe('005X tinted callout rings', () => {
  it('finds a faint ring on a tinted strip and reads its bar', () => {
    const r = canvas(200, 120, [231, 231, 232])
    rect(r, 0, 20, 200, 60, [210, 210, 212]) // the tinted strip
    tintedCallout(r, 60, 40, 14, '78', '118')
    const found = readTintedCallouts(r, { minRadiusPx: 10, maxRadiusPx: 18 })
    expect(found.length).toBeGreaterThanOrEqual(1)
    const ring = found.find((f) => Math.abs(f.circle.cx - 60) <= 2 && Math.abs(f.circle.cy - 40) <= 2)
    expect(ring).toBeDefined()
    expect(ring?.bar).not.toBeNull()
    // The rooflight-only option must preserve valid readings while skipping OCR for barless rings.
    const onlyBarred = readTintedCallouts(r, { minRadiusPx: 10, maxRadiusPx: 18, requireBar: true })
    const rooflightRing = onlyBarred.find((f) => Math.abs(f.circle.cx - 60) <= 2 && Math.abs(f.circle.cy - 40) <= 2)
    expect(rooflightRing).toEqual(ring)
    expect(onlyBarred.every((f) => f.bar !== null)).toBe(true)
  })

  it('005X-N3: the bar gate sends only barred rings to OCR and reads them exactly as without it', () => {
    const r = canvas(260, 120, [231, 231, 232])
    rect(r, 0, 20, 260, 60, [210, 210, 212])
    tintedCallout(r, 60, 40, 14, '78', '118')
    tintedCallout(r, 180, 40, 14, '78', '118', false) // the same symbol with no bar
    const all = { rings: 0, ocr: 0 }
    const gate = { rings: 0, ocr: 0 }
    const ungated = readTintedCallouts(r, { minRadiusPx: 10, maxRadiusPx: 18, stats: all })
    const gated = readTintedCallouts(r, { minRadiusPx: 10, maxRadiusPx: 18, requireBar: true, stats: gate })
    expect(ungated.some((f) => Math.abs(f.circle.cx - 60) <= 2 && f.bar !== null)).toBe(true)
    // the barless symbol is no longer read: fewer circles go to OCR, though more of its circles may be looked at,
    // because no reading of it claims them
    expect(gate.ocr).toBeLessThan(all.ocr)
    expect(gate.ocr).toBe(ungated.filter((f) => f.bar !== null).length)
    // every barred reading, in the same order, field for field
    expect(gated).toEqual(ungated.filter((f) => f.bar !== null))
    expect(gated.some((f) => Math.abs(f.circle.cx - 180) <= 2)).toBe(false)
  })

  it('reports nothing on a sheet without rings', () => {
    const r = canvas(160, 100, [231, 231, 232])
    rect(r, 0, 20, 160, 60, [210, 210, 212])
    rect(r, 40, 0, 46, 100, [30, 30, 30]) // a wall
    expect(readTintedCallouts(r, { minRadiusPx: 10, maxRadiusPx: 18 })).toHaveLength(0)
  })
})

describe('005X rooflights from the plan under the roof', () => {
  // A 10 × 8 m storey drawn at 50 px/m, front at the bottom (row 450), left face at column 50.
  const plan = { frameId: 'plan-attic', toWorld: (px: number, py: number) => ({ x: (px - 50) / 50, z: (450 - py) / 50 }) }
  const body = { x0: 0, z0: 0, x1: 10, z1: 8 }
  const roof = { ridgeAxis: 'X' as const, ridgeAt: 4, pitchDeg: 40, eaveY: 4.8 }
  const callout = (cx: number, cy: number, w: number | null, h: number | null, bar = true): CalloutReading => ({ id: `c-${cx}-${cy}`, circle: { cx, cy, radiusPx: 15 }, bar: bar ? { y: cy } : null, widthCm: w, heightCm: h, upperText: String(w ?? ''), lowerText: String(h ?? ''), widthCandidates: [], heightCandidates: [], confidence: 0.5, box: { x0: cx - 15, y0: cy - 15, x1: cx + 15, y1: cy + 15 }, why: 'synthetic' })

  it('places each rooflight on its slope, along the ridge and at its stated size', () => {
    const found = readPlanRooflights([callout(190, 410, 78, 118), callout(440, 410, 78, 118), callout(300, 90, 78, 118)], plan, body, 0.3, roof)
    expect(found.map((f) => f.slope)).toEqual(['LOW', 'LOW', 'HIGH'])
    const low = found.filter((f) => f.slope === 'LOW')
    expect((low[0].alongFrom + low[0].alongTo) / 2).toBeCloseTo(2.8, 6)
    expect((low[1].alongFrom + low[1].alongTo) / 2).toBeCloseTo(7.8, 6)
    expect(low[0].alongTo - low[0].alongFrom).toBeCloseTo(0.78, 6)
    // the stated length, foreshortened by the 40° pitch, up the slope
    expect(low[0].slopeTo - low[0].slopeFrom).toBeCloseTo(1.18 * Math.cos((40 * Math.PI) / 180), 6)
    const high = found.find((f) => f.slope === 'HIGH')
    expect(high && high.slopeFrom > roof.ridgeAt).toBe(true)
    expect(high && high.slopeTo <= body.z1).toBe(true)
  })

  it('refuses a callout outside the storey, one read incoherently, one without a bar, and a size no rooflight has', () => {
    const found = readPlanRooflights([callout(20, 300, 100, 220), callout(300, 410, null, null), callout(350, 410, 78, 118, false), callout(400, 410, 250, 220)], plan, body, 0.3, roof)
    expect(found).toHaveLength(0)
  })
})

describe('005X one picture of a house', () => {
  /** Sky, planting at the foot, a red roof over a white wall with two windows and a door, slightly in perspective. */
  function picture(): Raster {
    const W = 400
    const H = 300
    const r = canvas(W, H, [150, 190, 235])
    const eave = (x: number): number => 140 - 0.02 * (x - 60)
    const foot = (x: number): number => 240 + 0.03 * (x - 60)
    for (let x = 60; x < 340; x += 1) {
      // the roof: a red band from its top to the eaves
      for (let y = 70; y < eave(x); y += 1) put(r, x, y, y % 6 === 0 ? [90, 30, 20] : [170, 60, 45])
      for (let y = Math.ceil(eave(x)); y <= foot(x); y += 1) put(r, x, y, [245, 244, 240])
    }
    // two windows and a door, dark glass
    rect(r, 90, 165, 130, 210, [70, 80, 95])
    rect(r, 270, 168, 310, 213, [70, 80, 95])
    rect(r, 185, 160, 215, foot(200), [60, 55, 50])
    // planting in front of the wall's foot and the ground
    rect(r, 0, 252, W, H, [60, 120, 40])
    return r
  }

  it('reads the wall, the openings in their order and a door to the floor', () => {
    const reading = readSingleImage(picture())
    expect(reading.ok).toBe(true)
    if (!reading.ok) return
    expect(reading.openings.length).toBe(3)
    const centres = reading.openings.map((o) => (o.along[0] + o.along[1]) / 2)
    expect([...centres].sort((a, b) => a - b)).toEqual(centres)
    const door = reading.openings[1]
    expect(door.kind === 'GLAZED_DOOR' || door.kind === 'DOOR').toBe(true)
    expect(door.sillY).toBe(0)
    for (const w of [reading.openings[0], reading.openings[2]]) {
      expect(w.kind).toBe('WINDOW')
      expect(w.sillY).toBeGreaterThan(0.3)
    }
    // the windows are about as wide as each other: the perspective is corrected, not ignored
    const widths = [reading.openings[0], reading.openings[2]].map((o) => o.along[1] - o.along[0])
    expect(Math.abs(widths[0] - widths[1]) / Math.max(...widths)).toBeLessThan(0.2)
    expect(reading.assumptions.some((a) => a.includes('not seen'))).toBe(true)
  })

  it('emits a closed model named as indicative, with the openings on its front wall', () => {
    const result = reconstructFromSingleImage(picture(), 'm-photo-test')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const model = JSON.parse(result.modelJson)
    expect(model.name).toBe(SINGLE_IMAGE_LABEL)
    expect(model.walls.length).toBeGreaterThanOrEqual(4)
    // 005X-N1: the roof is built from its own planes (a gable here: two slopes)
    expect(model.roofs.length + model.roofPlanes.length).toBeGreaterThanOrEqual(2)
    expect(model.rooms).toHaveLength(0)
    expect(model.openings.length).toBe(3)
    const statuses = model.openings.map((o: { evidence?: { status?: string } }) => o.evidence?.status)
    expect(statuses.every((s: string | undefined) => s !== 'SOURCE_EXACT')).toBe(true)
  })

  it('refuses a picture with no house against the sky', () => {
    const r = canvas(200, 150, [150, 190, 235])
    rect(r, 0, 100, 200, 150, [60, 120, 40])
    const reading = readSingleImage(r)
    expect(reading.ok).toBe(false)
  })
})
