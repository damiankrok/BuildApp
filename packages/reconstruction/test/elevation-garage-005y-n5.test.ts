/**
 * BUILDPLAN-ANALYZER-005Y-N5 (C5): three readings behind a garage door that was built as a window.
 *
 *  - An elevation whose traced silhouette stops at the eaves (the roof read as background) puts the ridge datum on the
 *    eaves line; the walls' band then lands its ground only at a wrong scale. `roofTopOverBand` finds the roof's top over
 *    the band — the point where a hip or gable end's outline closes, or the flat top of a ridge seen lengthwise — and
 *    refuses where only chimneys or a ridge cap stand over the silhouette's top.
 *  - A run of rows over an opening that is only partly unlike the wall (a watermark, a shadow) and taller than any frame
 *    is not the opening: `wallAppearanceExtent` puts the head where the rows turn wholly foreign.
 *  - The plan's symbol of an overhead door — two dashed or dotted tracks running from both jambs into the room, of one
 *    length — makes a wide ground-storey gap a vehicle door (`overheadDoorTracks`).
 *
 * Every picture is drawn here from invented dimensions and colours; no drawing or render of any real building is used.
 */
import { describe, expect, it } from 'vitest'
import type { Mask, Raster } from '@buildapp/source-cv'
import { overheadDoorTracks, readWallOpenings, wallAppearanceExtent } from '../src/index.js'
import { roofTopOverBand } from '../src/v2/side-orientation.js'
import type { ElevationFrameV2, PlanFrameV2, WallHost } from '../src/index.js'

// ---------------------------------------------------------------------------------------------------------------------
// roofTopOverBand
// ---------------------------------------------------------------------------------------------------------------------

const MW = 400
const MH = 300
/** A sky mask (1 = sky) with `solid(x, y)` cut out of it. */
function mask(solid: (x: number, y: number) => boolean): Mask {
  const data = new Uint8Array(MW * MH)
  for (let y = 0; y < MH; y += 1) for (let x = 0; x < MW; x += 1) data[y * MW + x] = solid(x, y) ? 0 : 1
  return { width: MW, height: MH, data }
}
// Walls from column 100 to 300, rows 200..280; the eaves line on row 200.
const walls = (x: number, y: number): boolean => x >= 100 && x <= 300 && y >= 200 && y <= 280
/** A hip end seen from the front: a triangle over the walls (with eaves past them), apex on row 120. */
const hipEnd = (x: number, y: number): boolean => y >= 120 && y < 200 && Math.abs(x - 200) <= (y - 120) * 1.5
/** A ridge seen lengthwise: a trapezoid whose flat top runs along row 140. */
const ridgeLong = (x: number, y: number): boolean => y >= 140 && y < 200 && x >= 80 + (200 - y) * 0.3 && x <= 320 - (200 - y) * 0.3
const chimney = (x0: number, x1: number, top: number) => (x: number, y: number): boolean => x >= x0 && x <= x1 && y >= top && y < 200

describe('005Y-N5 (C5) roofTopOverBand: the roof over a silhouette cut at the eaves', () => {
  it('closes a hip end’s outline at its apex, under the chimney standing on it', () => {
    const m = mask((x, y) => walls(x, y) || hipEnd(x, y) || chimney(195, 215, 100)(x, y))
    const top = roofTopOverBand(m, 200, 280, 100, 300)
    expect(top).toBeDefined()
    expect(Math.abs((top?.row ?? 0) - 120)).toBeLessThanOrEqual(3)
  })
  it('takes the flat top of a ridge seen lengthwise', () => {
    const m = mask((x, y) => walls(x, y) || ridgeLong(x, y) || chimney(150, 165, 115)(x, y))
    const top = roofTopOverBand(m, 200, 280, 100, 300)
    expect(top?.row).toBe(140)
  })
  it('refuses where the silhouette already reaches the ridge: only chimneys and a ridge cap over it', () => {
    // counterfactual: the same chimneys over a silhouette whose top is the ridge (row 140), with a 1 px cap on row 139
    const m = mask((x, y) => (x >= 100 && x <= 300 && y >= 139 && y <= 280) || chimney(120, 160, 110)(x, y) || chimney(240, 290, 112)(x, y))
    expect(roofTopOverBand(m, 140, 280, 100, 300)).toBeUndefined()
  })
  it('refuses where sky lies directly over the top', () => {
    expect(roofTopOverBand(mask(walls), 200, 280, 100, 300)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------------------------------------------------
// wallAppearanceExtent: a partly foreign overlay over the head
// ---------------------------------------------------------------------------------------------------------------------

type RGB = [number, number, number]
const PPM = 50
const FLOOR_ROW = 400
const X0 = 40
const EW = 800
const EH = 480
const view: ElevationFrameV2 = {
  registration: { frameId: 'frame-front', assetId: 'asset-front' } as ElevationFrameV2['registration'],
  side: 'FRONT',
  planeAt: 0,
  alongOf: (px) => (px - X0) / PPM,
  pxOf: (a) => X0 + a * PPM,
  yOf: (py) => (FLOOR_ROW - py) / PPM,
  pyOf: (y) => FLOOR_ROW - y * PPM,
}
const WALL: RGB = [232, 232, 228]
/** A plastered wall to 3.0 m with one window from 4 to 6 m along (0.9..2.2 m) and an overlay from `overlay` up. */
function elevation(overlay: { from: number; to: number } | null): Raster {
  const data = new Uint8ClampedArray(EW * EH * 4)
  for (let y = 0; y < EH; y += 1) {
    for (let x = 0; x < EW; x += 1) {
      const a = (x - X0) / PPM
      const h = (FLOOR_ROW - y) / PPM
      let c: RGB = y >= FLOOR_ROW ? [70, 120, 60] : [140, 185, 230]
      if (a >= 0 && a <= 14 && h >= 0 && h < 3.0) c = WALL
      if (a >= 4 && a <= 6 && h >= 0.9 && h <= 2.2) c = [70, 96, 128]
      // a pale watermark-like overlay: two columns in three drawn grey over the wall, over the window's columns only
      if (overlay && a >= 3.9 && a <= 6.1 && h > 2.2 && h <= overlay.to && h >= overlay.from && x % 3 !== 0) c = [196, 196, 196]
      const k = (y * EW + x) * 4
      data[k] = c[0]
      data[k + 1] = c[1]
      data[k + 2] = c[2]
      data[k + 3] = 255
    }
  }
  return { width: EW, height: EH, data }
}
const SOLIDS: Array<[number, number]> = [
  [0, 4],
  [6, 14],
]

describe('005Y-N5 (C5) wallAppearanceExtent: a partly foreign stretch over the head is not the opening', () => {
  it('reads the window alone without an overlay', () => {
    const ext = wallAppearanceExtent(elevation(null), view, [4, 6], SOLIDS, 0, 3.0)
    expect(ext?.headY).toBeCloseTo(2.2, 1)
    expect(ext?.sillY).toBeCloseTo(0.9, 1)
  })
  it('puts the head under a 0.6 m overlay, where the rows turn wholly foreign', () => {
    const ext = wallAppearanceExtent(elevation({ from: 2.2, to: 2.8 }), view, [4, 6], SOLIDS, 0, 3.0)
    expect(ext?.headY).toBeCloseTo(2.2, 1)
    expect(ext?.why).toContain('only partly unlike the wall')
  })
  it('keeps a frame-high overlay (0.2 m) as part of the opening', () => {
    const ext = wallAppearanceExtent(elevation({ from: 2.2, to: 2.4 }), view, [4, 6], SOLIDS, 0, 3.0)
    expect(ext?.headY).toBeCloseTo(2.4, 1)
  })
})

// ---------------------------------------------------------------------------------------------------------------------
// overheadDoorTracks
// ---------------------------------------------------------------------------------------------------------------------

const MPP = 0.02
const PO = 20
const POY = 100
const PW = 760
const PH = 400
const ppx = (x: number, z: number) => ({ x: PO + x / MPP, y: POY + z / MPP })
type Track = { at: number; lengthM: number; style: 'DASHED' | 'DOTTED' | 'SOLID' }

/** A 14 m front wall (z 0..0.4) with one gap 5..7.5 m and the given tracks running from the wall's inner face. */
function plan(tracks: Track[], gap: [number, number] = [5, 7.5]): { raster: Raster; frame: PlanFrameV2 } {
  const data = new Uint8ClampedArray(PW * PH * 4).fill(255)
  const set = (x: number, y: number, l: number): void => {
    const o = (Math.round(y) * PW + Math.round(x)) * 4
    data[o] = data[o + 1] = data[o + 2] = l
  }
  // the room's light floor fill behind the wall
  for (let y = ppx(0, 0.4).y; y < PH; y += 1) for (let x = ppx(0, 0).x; x <= ppx(14, 0).x; x += 1) set(x, y, 236)
  for (let y = ppx(0, 0).y; y <= ppx(0, 0.4).y; y += 1) for (let x = ppx(0, 0).x; x <= ppx(14, 0).x; x += 1) if (x < ppx(gap[0], 0).x || x > ppx(gap[1], 0).x) set(x, y, 0)
  for (const t of tracks) {
    const x = ppx(t.at, 0).x
    const y0 = ppx(0, 0.4).y + 1
    const n = Math.round(t.lengthM / MPP)
    for (let i = 0; i < n; i += 1) {
      if (t.style === 'DASHED' && i % 10 >= 6) continue
      set(x, y0 + i, t.style === 'DOTTED' ? [207, 191, 176][i % 3] : t.style === 'SOLID' ? 40 : 120)
    }
  }
  const frame: PlanFrameV2 = { frameId: 'frame-plan', assetId: 'asset-plan', storeyIndex: 0, mppX: MPP, mppY: MPP, originPx: { x: PO, y: POY }, why: 'synthetic', toWorld: (x, y) => ({ x: (x - PO) * MPP, z: (y - POY) * MPP }), toPixel: (x, z) => ppx(x, z), wallPx: 0.4 / MPP }
  return { raster: { width: PW, height: PH, data }, frame }
}
const HOST: WallHost = { massId: 'main', facade: 'FRONT', planeAt: 0, from: 0, to: 14, centreAt: 0.2, storeyIndex: 0, floorY: 0, storeyHeightM: 2.8 }
const pair = (style: Track['style'], a = 2.6, b = 2.6): Track[] => [
  { at: 5.04, lengthM: a, style },
  { at: 7.46, lengthM: b, style },
]
const tracksOf = (tracks: Track[]) => {
  const { raster, frame } = plan(tracks)
  return overheadDoorTracks(raster, frame, HOST, [5, 7.5], 0.4)
}
const familyOf = (tracks: Track[], host: WallHost = HOST) => {
  const { raster, frame } = plan(tracks)
  const read = readWallOpenings({ plan: frame, planRaster: raster, host, wallThicknessM: 0.4, callouts: [], views: [], attachedSingleStorey: false, index: 0 })
  return read.find((o) => Math.abs(o.interval[0] - 5) < 0.1)
}

describe('005Y-N5 (C5) overheadDoorTracks: the plan symbol of an overhead door', () => {
  it('reads two dashed tracks of one length from both jambs', () => {
    const t = tracksOf(pair('DASHED'))
    expect(t).toBeDefined()
    expect(t?.lengthsM[0]).toBeGreaterThan(2.3)
  })
  it('reads two soft dotted tracks (lightness swinging pixel to pixel)', () => {
    expect(tracksOf(pair('DOTTED'))).toBeDefined()
  })
  it('refuses solid lines (partitions), one track alone, tracks of different lengths, and short ones', () => {
    expect(tracksOf(pair('SOLID'))).toBeUndefined()
    expect(tracksOf([pair('DASHED')[0]])).toBeUndefined()
    expect(tracksOf(pair('DASHED', 2.6, 1.9))).toBeUndefined()
    expect(tracksOf(pair('DASHED', 1.0, 1.0))).toBeUndefined()
  })
  it('makes the gap a vehicle door, its heights assumed and said so; without the tracks it is not one', () => {
    const door = familyOf(pair('DOTTED'))
    expect(door?.family).toBe('GARAGE_DOOR')
    expect(door?.provenance.family).toBe('SOURCE_DERIVED')
    expect(door?.sillY).toBe(0)
    expect(door?.unresolved.some((u) => u.includes('overhead door') && u.includes('assumed'))).toBe(true)
    // counterfactual: the same gap with no tracks drawn
    expect(familyOf([])?.family).not.toBe('GARAGE_DOOR')
  })
  it('does not read a vehicle door above the ground storey', () => {
    expect(familyOf(pair('DOTTED'), { ...HOST, storeyIndex: 1, floorY: 2.8 })?.family).not.toBe('GARAGE_DOOR')
  })
})
