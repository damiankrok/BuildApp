/**
 * BUILDPLAN-ANALYZER-005X-N1: one picture's roof and openings, read for what they are.
 *
 * - a roof of its own planes lays out a gable, a hip at either end and a pyramid, closing over the body (`planeRoofLayout`);
 * - a hipped roof seen from the front is read as hipped and built from its planes, not as a gable;
 * - a light gate in a light wall, dark smooth glass, and a gable facing the camera with a round-headed window above the
 *   eaves are all read; a soft shadow beside the gate is not an opening;
 * - a grey covering over a wall in the shade of its eaves and a white band lower down: the eaves are where the covering
 *   ends, not under the band;
 * - a picture with no house in it is refused.
 *
 * Every raster is drawn here from invented shapes and colours; no drawing, render or photograph of a real house is used.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import { planeAt, planeRoofLayout, readSingleImage, reconstructFromSingleImage } from '../src/index.js'

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
const SKY: RGB = [150, 190, 235]
const GRASS: RGB = [60, 120, 40]
const WALL: RGB = [245, 244, 240]
const TILE: RGB = [170, 60, 45]
const TILE_ROW: RGB = [90, 30, 20]
const GLASS: RGB = [70, 80, 95]

/**
 * A house against the sky: a red roof over a white wall from x0 to x1, its eave at row 140, its foot at row 240; the
 * roof's top at row 70, level from `ridge[0]` to `ridge[1]` and coming down to the eave at the wall's ends outside it.
 */
function house(ridge: [number, number], x0 = 60, x1 = 340): Raster {
  const r = canvas(400, 300, SKY)
  for (let x = x0; x < x1; x += 1) {
    const top = x < ridge[0] ? 140 - ((x - x0) / (ridge[0] - x0)) * 70 : x > ridge[1] ? 140 - ((x1 - x) / (x1 - ridge[1])) * 70 : 70
    for (let y = Math.round(top); y < 140; y += 1) put(r, x, y, y % 6 === 0 ? TILE_ROW : TILE)
    for (let y = 140; y <= 240; y += 1) put(r, x, y, WALL)
  }
  rect(r, 0, 252, 400, 300, GRASS)
  return r
}

describe('005X-N1 a roof of its own planes', () => {
  const body = { x0: 0, x1: 12, z0: 0, z1: 8 }
  const area = (ps: Array<{ x: number; z: number }>): number => Math.abs(ps.reduce((s, p, i) => s + p.x * ps[(i + 1) % ps.length].z - ps[(i + 1) % ps.length].x * p.z, 0)) / 2

  it('covers the body exactly, gable, half-hip or hip', () => {
    for (const ends of [{ min: 'GABLE', max: 'GABLE' }, { min: 'HIP', max: 'GABLE' }, { min: 'HIP', max: 'HIP' }] as const) {
      const l = planeRoofLayout(body, 'X', 40, 3, ends)
      expect(l.planes.reduce((s, p) => s + area(p.boundary), 0)).toBeCloseTo(96, 6)
      expect(l.planes).toHaveLength(2 + (ends.min === 'HIP' ? 1 : 0) + (ends.max === 'HIP' ? 1 : 0))
      expect(l.joins.filter((j) => j.kind === 'HIP')).toHaveLength(2 * ((ends.min === 'HIP' ? 1 : 0) + (ends.max === 'HIP' ? 1 : 0)))
      expect(l.verges).toHaveLength(2 * ((ends.min === 'GABLE' ? 1 : 0) + (ends.max === 'GABLE' ? 1 : 0)))
    }
  })

  it('runs a hip in by half the depth, so the ridge is shorter by the depth', () => {
    const l = planeRoofLayout(body, 'X', 40, 3, { min: 'HIP', max: 'HIP' })
    expect(l.ridge[0].x).toBeCloseTo(4, 6)
    expect(l.ridge[1].x).toBeCloseTo(8, 6)
    expect(l.ridgeY).toBeCloseTo(3 + 4 * Math.tan((40 * Math.PI) / 180), 6)
    // a point near the end's eave belongs to the hip, one on the long eave to the front slope
    expect(planeAt(l, { x: 0.5, z: 4 })?.key).toBe('END_MIN')
    expect(planeAt(l, { x: 6, z: 0.5 })?.key).toBe('LOW')
  })

  it('makes a pyramid of a body shorter than it is deep, its eaves level all round', () => {
    const l = planeRoofLayout({ x0: 0, x1: 6, z0: 0, z1: 8 }, 'X', 40, 3, { min: 'HIP', max: 'HIP' })
    expect(l.joins.some((j) => j.kind === 'RIDGE')).toBe(false)
    expect(l.ridge[0]).toEqual(l.ridge[1])
    expect(l.planes.reduce((s, p) => s + area(p.boundary), 0)).toBeCloseTo(48, 6)
  })
})

describe('005X-N1 the roof form from one picture', () => {
  it('reads a roof whose top comes down to both ends inside the wall as hipped, and builds it from its planes', () => {
    const r = house([150, 250])
    rect(r, 90, 165, 130, 210, GLASS)
    rect(r, 270, 165, 310, 210, GLASS)
    const result = reconstructFromSingleImage(r, 'm-hip-test')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const main = result.reading.segments.find((s) => s.main)
    expect(main?.ends.min.kind).toBe('HIP')
    expect(main?.ends.max.kind).toBe('HIP')
    const model = JSON.parse(result.modelJson)
    expect(model.roofs).toHaveLength(0)
    expect(model.roofPlanes.map((p: { id: string }) => p.id).sort()).toEqual(['roof-main-plane-end-max', 'roof-main-plane-end-min', 'roof-main-plane-high', 'roof-main-plane-low'])
    expect(model.roofEdges.filter((e: { kind: string }) => e.kind === 'HIP')).toHaveLength(4)
    // the walls die into the planes
    expect(model.walls.filter((w: { topProfile?: { kind: string } }) => w.topProfile?.kind === 'FOLLOW_ROOF_PLANES').length).toBeGreaterThanOrEqual(4)
  })

  it('reads a roof whose top runs level to the wall ends as a gable', () => {
    const r = house([60, 340])
    rect(r, 90, 165, 130, 210, GLASS)
    const reading = readSingleImage(r)
    expect(reading.ok).toBe(true)
    if (!reading.ok) return
    const main = reading.segments.find((s) => s.main)
    expect(main?.ends.min.kind).toBe('GABLE')
    expect(main?.ends.max.kind).toBe('GABLE')
  })
})

describe('005X-N1 openings that one brightness threshold misses', () => {
  it('reads a light ribbed gate in a light wall as a gate, dark smooth glass as a window, and not the soft shadow by the gate', () => {
    const r = house([60, 340])
    // the gate: a light sectional leaf, its embossed panels a groove and a highlight every four rows, in a darker
    // frame, on the foot
    rect(r, 196, 165, 290, 241, [200, 200, 198])
    rect(r, 199, 168, 287, 241, [232, 232, 230])
    for (let y = 170; y < 241; y += 4) {
      rect(r, 199, y, 287, y + 1, [185, 185, 183])
      rect(r, 199, y + 1, 287, y + 2, [250, 250, 248])
    }
    // a soft shadow to its left: a smooth fall of light, no edge
    for (let x = 160; x < 192; x += 1) for (let y = 150; y <= 240; y += 1) put(r, x, y, WALL.map((v) => Math.round(v - (x - 160) * 1.8)) as RGB)
    // dark glass, smooth
    rect(r, 90, 165, 130, 210, [40, 45, 55])
    const reading = readSingleImage(r)
    expect(reading.ok).toBe(true)
    if (!reading.ok) return
    const gate = reading.openings.find((o) => o.kind === 'GARAGE_DOOR')
    expect(gate).toBeDefined()
    expect(gate && gate.rectPx.x0 >= 190 && gate.rectPx.x1 <= 296).toBe(true)
    expect(reading.openings.filter((o) => o.kind === 'WINDOW')).toHaveLength(1)
    // nothing in the shadow's columns
    expect(reading.openings.some((o) => o.rectPx.x1 > 160 && o.rectPx.x0 < 190)).toBe(false)
  })

  it('reads a gable facing the camera over the front, and the round-headed window in it above the eaves', () => {
    const r = house([60, 340])
    // the face rises from the eave at 150..250 to an apex at row 60 over column 200, its rakes in roof colour
    for (let x = 150; x < 250; x += 1) {
      const rake = 60 + Math.abs(x - 200) * 1.6
      for (let y = Math.round(rake) - 8; y < Math.round(rake); y += 1) put(r, x, y, TILE)
      for (let y = Math.round(rake); y < 140; y += 1) put(r, x, y, WALL)
    }
    // a window with a round head in the face
    for (let y = 85; y < 132; y += 1)
      for (let x = 186; x < 214; x += 1) {
        const inArch = y >= 99 || (x - 200) ** 2 + (y - 99) ** 2 <= 14 ** 2
        if (inArch) put(r, x, y, ((x + y) % 5 === 0 ? [200, 210, 220] : GLASS) as RGB)
      }
    rect(r, 90, 165, 130, 210, GLASS)
    const result = reconstructFromSingleImage(r, 'm-cross-gable-test')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const cross = result.reading.gables.filter((g) => g.kind === 'CROSS')
    expect(cross).toHaveLength(1)
    const high = result.reading.openings.find((o) => o.inGable === 0)
    expect(high).toBeDefined()
    expect(high?.headShape).toBe('ARCHED')
    expect(high && high.sillY > result.reading.wall.heightM).toBe(true)
    const model = JSON.parse(result.modelJson)
    // the gable's body and its roof, the window cut in its face, noted as level-headed in the model
    const opening = model.openings.find((o: { id: string }) => o.id === high?.id)
    expect(opening?.wallId).toBe('ring-gable-0-0-w0')
  })
})

describe('005X-N1 the eaves of a grey roof', () => {
  it('puts the eaves where the grey covering ends, over the shaded wall, not under a white band lower down', () => {
    const r = canvas(400, 300, SKY)
    for (let x = 60; x < 340; x += 1) {
      for (let y = 70; y < 140; y += 1) put(r, x, y, y % 7 === 0 ? [45, 50, 55] : [120, 125, 131])
      // the wall in the shade of the eaves, a warm grey lightening downwards, then a white band, then a grey render
      for (let y = 140; y < 168; y += 1) put(r, x, y, [104 + (y - 140) * 2, 100 + (y - 140) * 2, 89 + (y - 140) * 2])
      for (let y = 168; y < 182; y += 1) put(r, x, y, [252, 252, 252])
      for (let y = 182; y <= 240; y += 1) put(r, x, y, [183, 183, 185])
    }
    rect(r, 100, 190, 160, 238, [40, 48, 60])
    rect(r, 240, 190, 300, 238, [40, 48, 60])
    rect(r, 0, 252, 400, 300, GRASS)
    const reading = readSingleImage(r)
    expect(reading.ok).toBe(true)
    if (!reading.ok) return
    expect(Math.abs(reading.wall.eave[0] - 140)).toBeLessThanOrEqual(4)
    expect(Math.abs(reading.wall.eave[1] - 140)).toBeLessThanOrEqual(4)
  })
})

describe('005X-N1 no house', () => {
  it('refuses a picture of sky, trees and grass', () => {
    const r = canvas(300, 200, SKY)
    for (let x = 0; x < 300; x += 1) for (let y = 120 - Math.round(20 * Math.sin(x / 15)); y < 200; y += 1) put(r, x, y, (x + y) % 3 === 0 ? [40, 100, 30] : GRASS)
    expect(readSingleImage(r).ok).toBe(false)
  })
})
