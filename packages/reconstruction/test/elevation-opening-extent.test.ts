/**
 * BUILDPLAN-ANALYZER-005W: an opening's vertical extent read as an object against the wall it is cut in.
 *
 * The plan says which stretches of a wall are solid; a registered elevation shows what those stretches look like, row
 * by row. A row of the opening's columns belongs to the opening where most of its pixels look like no wall stretch —
 * glass behind a striped blind, a reflected tree, a dark door leaf alike. The mean-brightness contrast reader loses a
 * striped blind whose rows swing either side of the wall's grey; this one does not. Every picture is drawn here from
 * invented dimensions and colours; no drawing or render of any real building is used.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import { elevationExtent, readWallOpenings, wallAppearanceExtent } from '../src/index.js'
import type { ElevationFrameV2, OpeningReadingInput, PlanFrameV2, WallHost } from '../src/index.js'

type RGB = [number, number, number]

// --- the elevation: 50 px per metre, the floor on row 400, a 14 m wall from column 40
const PPM = 50
const FLOOR_ROW = 400
const X0 = 40
const EW = 800
const EH = 480

function view(shiftM = 0): ElevationFrameV2 {
  return {
    registration: { frameId: 'frame-front', assetId: 'asset-front' } as ElevationFrameV2['registration'],
    side: 'FRONT',
    planeAt: 0,
    alongOf: (px) => (px - X0) / PPM + shiftM,
    pxOf: (a) => X0 + (a - shiftM) * PPM,
    yOf: (py) => (FLOOR_ROW - py) / PPM,
    pyOf: (y) => FLOOR_ROW - y * PPM,
  }
}

type Fill = (row: number, col: number) => RGB
type Opening = { from: number; to: number; head: number; fill: Fill }

/** A storey of plaster up to 2.8 m with a lighter band above it, sky over that, grass under the floor. */
function elevation(wall: RGB, openings: Opening[], options: { band?: RGB; noisyWall?: boolean } = {}): Raster {
  const data = new Uint8ClampedArray(EW * EH * 4)
  const band = options.band ?? [236, 236, 232]
  let seed = 7
  const noise = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return (seed / 2147483648) * 2 - 1
  }
  for (let y = 0; y < EH; y += 1) {
    for (let x = 0; x < EW; x += 1) {
      const a = (x - X0) / PPM
      const h = (FLOOR_ROW - y) / PPM
      let c: RGB = y >= FLOOR_ROW ? [70, 120, 60] : [140, 185, 230]
      if (a >= 0 && a <= 14 && h >= 0 && h < 4) c = h < 2.8 ? wall : band
      if (a >= 0 && a <= 14 && h >= 0 && h < 2.8 && options.noisyWall) c = (Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 0 ? [40, 40, 40] : [220, 220, 220]
      for (const o of openings) if (a >= o.from && a <= o.to && h >= 0 && h <= o.head) c = o.fill(y, x)
      const n = options.noisyWall ? 0 : Math.round(noise() * 3)
      const k = (y * EW + x) * 4
      data[k] = c[0] + n
      data[k + 1] = c[1] + n
      data[k + 2] = c[2] + n
      data[k + 3] = 255
    }
  }
  return { width: EW, height: EH, data }
}

const GREY: RGB = [128, 128, 130]
/** Glass behind a striped blind: rows swing either side of the wall's grey, and every eighth slat matches it. */
const blind = (wall: RGB): Fill => (row) => (row % 8 === 0 ? wall : Math.floor(row / 3) % 2 === 0 ? [212, 216, 222] : [88, 94, 100])
/** Glass reflecting trees below and sky above. */
const reflection: Fill = (row) => (row > 340 ? [62, 104, 66] : [176, 198, 226])
const doorLeaf: Fill = (_row, col) => (col % 23 === 0 ? [180, 180, 180] : [58, 60, 64])

const OPENINGS = (wall: RGB): Opening[] => [
  { from: 2, to: 4.6, head: 2.2, fill: blind(wall) },
  { from: 6, to: 7, head: 2.2, fill: blind(wall) },
  { from: 8.5, to: 9.55, head: 2.1, fill: doorLeaf },
  { from: 9.9, to: 10.8, head: 2.1, fill: reflection },
]
const SOLIDS = (openings: Opening[]): Array<[number, number]> => {
  const out: Array<[number, number]> = []
  let at = 0
  for (const o of openings) {
    out.push([at, o.from])
    at = o.to
  }
  out.push([at, 14])
  return out
}

// --- the plan: 50 px per metre too, the wall band on rows 400..420
const MPP = 0.02
const PO = 20
const POY = 400
const PW = 760
const PH = 520
const ppx = (x: number, z: number) => ({ x: PO + x / MPP, y: POY + z / MPP })
type Gap = { from: number; to: number; glazed?: boolean; swing?: boolean }

function sheet(gaps: Gap[]): { raster: Raster; plan: PlanFrameV2 } {
  const data = new Uint8ClampedArray(PW * PH * 4).fill(255)
  const set = (x: number, y: number, l: number): void => {
    const o = (Math.round(y) * PW + Math.round(x)) * 4
    data[o] = data[o + 1] = data[o + 2] = l
  }
  const inGap = (x: number): boolean => gaps.some((g) => x >= ppx(g.from, 0).x && x <= ppx(g.to, 0).x)
  for (let y = ppx(0, 0).y; y <= ppx(0, 0.4).y; y += 1) for (let x = ppx(0, 0).x; x <= ppx(14, 0).x; x += 1) if (!inGap(x)) set(x, y, 0)
  for (const g of gaps) {
    // glazing as many plans draw it: light grey frame and glass lines across the wall band
    if (g.glazed) for (const row of [404, 410, 416]) for (let x = ppx(g.from, 0).x; x <= ppx(g.to, 0).x; x += 1) set(x, row, 199)
    else for (let x = ppx(g.from, 0).x; x <= ppx(g.to, 0).x; x += 1) set(x, 404, 187)
    if (g.swing) {
      const r = (g.to - g.from) / MPP
      const cx = ppx(g.from, 0).x
      const cy = ppx(0, 0.4).y + 2
      for (let a = 0; a <= 90; a += 0.5) set(cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180), 60)
    }
  }
  const plan: PlanFrameV2 = { frameId: 'frame-plan', assetId: 'asset-plan', storeyIndex: 0, mppX: MPP, mppY: MPP, originPx: { x: PO, y: POY }, why: 'synthetic', toWorld: (x, y) => ({ x: (x - PO) * MPP, z: (y - POY) * MPP }), toPixel: (x, z) => ppx(x, z), wallPx: 0.2 / MPP }
  return { raster: { width: PW, height: PH, data }, plan }
}

const HOST: WallHost = { massId: 'main', facade: 'FRONT', planeAt: 0, from: 0, to: 14, centreAt: 0.2, storeyIndex: 0, floorY: 0, storeyHeightM: 2.8 }
const GAPS: Gap[] = [
  { from: 2, to: 4.6, glazed: true },
  { from: 6, to: 7, glazed: true },
  { from: 8.5, to: 9.55, swing: true },
  { from: 9.9, to: 10.8, glazed: true },
]
const read = (views: OpeningReadingInput['views'], gaps = GAPS) => {
  const { raster, plan } = sheet(gaps)
  return readWallOpenings({ plan, planRaster: raster, host: HOST, wallThicknessM: 0.4, callouts: [], views, attachedSingleStorey: false, index: 0 })
}

describe('005W the opening read as an object against the wall', () => {
  it('reads all four openings floor to head: a striped blind, a door leaf, a reflection', () => {
    const r = elevation(GREY, OPENINGS(GREY))
    for (const o of OPENINGS(GREY)) {
      const ext = wallAppearanceExtent(r, view(), [o.from, o.to], SOLIDS(OPENINGS(GREY)), 0, 2.8)
      expect(ext, `${o.from}..${o.to}`).not.toBeNull()
      expect(ext?.sillY).toBe(0)
      expect(Math.abs((ext?.headY ?? 0) - o.head)).toBeLessThanOrEqual(0.06)
    }
  })

  it('the contrast reader sees only part of the blind (the first bad this replaces)', () => {
    const r = elevation(GREY, OPENINGS(GREY))
    const old = elevationExtent(r, view(), [6, 7], 0, 2.8)
    expect(old === null || old.headY - old.sillY < 1.8).toBe(true)
  })

  it('is indifferent to the wall colour: brick, dark render, white render', () => {
    for (const wall of [[150, 72, 52], [52, 52, 56], [232, 232, 228]] as RGB[]) {
      const r = elevation(wall, OPENINGS(wall), { band: wall[0] > 200 ? [128, 128, 130] : [236, 236, 232] })
      for (const o of OPENINGS(wall)) {
        const ext = wallAppearanceExtent(r, view(), [o.from, o.to], SOLIDS(OPENINGS(wall)), 0, 2.8)
        expect(ext, `${wall.join(',')} ${o.from}..${o.to}`).not.toBeNull()
        expect(Math.abs((ext?.headY ?? 0) - o.head)).toBeLessThanOrEqual(0.06)
      }
    }
  })

  it('a solid stretch of wall reads as no opening', () => {
    const r = elevation(GREY, OPENINGS(GREY))
    expect(wallAppearanceExtent(r, view(), [11, 13], SOLIDS(OPENINGS(GREY)), 0, 2.8)).toBeNull()
  })

  it('a run that leaves the wall without a lintel over it (to the storey top, into the band and the sky) is refused', () => {
    const tall: Opening[] = [...OPENINGS(GREY), { from: 11.5, to: 12.5, head: 3.6, fill: reflection }]
    const r = elevation(GREY, tall)
    expect(wallAppearanceExtent(r, view(), [11.5, 12.5], SOLIDS(tall), 0, 2.8)).toBeNull()
  })

  it('nothing is learnt from a wall no stretch shows plainly (a pattern, an occluder): no reading', () => {
    const r = elevation(GREY, OPENINGS(GREY), { noisyWall: true })
    expect(wallAppearanceExtent(r, view(), [6, 7], SOLIDS(OPENINGS(GREY)), 0, 2.8)).toBeNull()
  })

  it('end to end: heights read on the elevation, kinds from the plan symbol (screen, full-height windows, the door)', () => {
    const r = elevation(GREY, OPENINGS(GREY))
    const out = read([{ view: view(), raster: r }])
    expect(out.map((o) => o.family)).toEqual(['MULTI_PANEL_GLAZING', 'WINDOW', 'DOOR', 'WINDOW'])
    for (const o of out) {
      expect(o.sillY).toBe(0)
      expect(o.provenance.sill).toBe('IMAGE_METRIC_REGISTERED')
      expect(o.provenance.head).toBe('IMAGE_METRIC_REGISTERED')
    }
    expect(out.map((o) => Math.round(o.headY * 10) / 10)).toEqual([2.2, 2.2, 2.1, 2.1])
  })

  it('without an elevation nothing changes: assumed heights, the ground-storey door convention, the window placeholder', () => {
    // The light glazing symbol is consulted only for a gap whose heights an elevation read; unread, a door-wide gap on
    // the ground storey stays a door by the plan convention, as before 005W.
    const out = read([])
    expect(out.map((o) => o.family)).toEqual(['WINDOW', 'DOOR', 'DOOR', 'DOOR'])
    expect(out.every((o) => o.provenance.sill === 'ASSUMED_FOR_RENDERING')).toBe(true)
  })

  it('a view registered on the walls band alone stands where the gaps read on it', () => {
    const r = elevation(GREY, OPENINGS(GREY))
    const out = read([{ view: view(), raster: r, bandOnly: true }])
    expect(out.every((o) => o.provenance.sill === 'IMAGE_METRIC_REGISTERED')).toBe(true)
  })

  it('a band-only view registered 1.3 m off is refused for the whole wall: the gaps land on wall', () => {
    const r = elevation(GREY, OPENINGS(GREY))
    const out = read([{ view: view(1.3), raster: r, bandOnly: true }])
    expect(out.every((o) => o.provenance.sill === 'ASSUMED_FOR_RENDERING')).toBe(true)
    expect(out.map((o) => o.family)).toEqual(['WINDOW', 'DOOR', 'DOOR', 'DOOR'])
  })

  it('a band-only view with a single gap on the wall cannot be checked and is not read', () => {
    const r = elevation(GREY, [OPENINGS(GREY)[1]])
    const out = read([{ view: view(), raster: r, bandOnly: true }], [GAPS[1]])
    expect(out[0].provenance.sill).toBe('ASSUMED_FOR_RENDERING')
  })
})
