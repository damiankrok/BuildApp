/**
 * N9-02A: elevations registered on four separate axes, on synthetic sheets whose truth is known by construction.
 * Each sheet is a render-like elevation: a pale-blue sky, a neutral wall band, a darker roof (level ridge for a front
 * or rear view, a gable for a side view), grass under the drawn ground. A 10 × 8 m walled plan; the sheets are drawn at
 * 0.025 m/px unless a case says otherwise. No house of the corpus is named and no threshold is fitted to one.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import type { SourceCoordinateFrame, SourceObservation } from '@buildapp/source-observations'
import type { ViewAuditRecord } from '@buildapp/reconstruction'
import { apexOf, elevationAxes, elevationRelation } from '../src/index.js'
import type { ElevationAxes } from '../src/index.js'

const W = 800
const H = 400
const SKY: Rgb = [170, 200, 240]
const WALL: Rgb = [222, 222, 222]
const WOOD: Rgb = [180, 120, 70]
const ROOF: Rgb = [150, 60, 50]
const GRASS: Rgb = [80, 150, 60]
type Rgb = [number, number, number]

function sheet(draw: (put: (x: number, y: number, c: Rgb) => void) => void): Raster {
  const data = new Uint8ClampedArray(W * H * 4)
  const put = (x: number, y: number, c: Rgb): void => {
    if (x < 0 || y < 0 || x >= W || y >= H) return
    const o = (y * W + x) * 4
    data[o] = c[0]
    data[o + 1] = c[1]
    data[o + 2] = c[2]
    data[o + 3] = 255
  }
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) put(x, y, y >= 350 ? GRASS : SKY)
  draw(put)
  return { width: W, height: H, data }
}
const rect = (put: (x: number, y: number, c: Rgb) => void, x0: number, y0: number, x1: number, y1: number, c: Rgb): void => {
  for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) put(x, y, c)
}
/** A front or rear view: walls 200..600 (10 m), a roof rising from eaves at row 200 to a level ridge at row 100. */
const frontView = (o: { chimney?: boolean; walls?: Rgb } = {}): Raster =>
  sheet((put) => {
    for (let y = 100; y < 200; y += 1) {
      const inset = Math.round(((y - 100) / 100) * 80)
      rect(put, 260 - inset, y, 540 + inset, y + 1, ROOF)
    }
    rect(put, 200, 200, 600, 350, o.walls ?? WALL)
    if (o.chimney) rect(put, 450, 50, 470, 100, [60, 60, 60])
  })
/** A side view: walls 240..560 (8 m), a gable from eaves at row 200 to the apex at column 400, row 100. */
const sideView = (o: { walls?: Rgb; pergola?: boolean; chimney?: boolean } = {}): Raster =>
  sheet((put) => {
    for (let y = 100; y < 200; y += 1) {
      const half = Math.round(((y - 100) / 100) * 180)
      rect(put, 400 - half, y, 400 + half, y + 1, ROOF)
    }
    rect(put, 240, 200, 560, 350, o.walls ?? WALL)
    if (o.pergola) rect(put, 560, 200, 640, 350, WOOD)
    if (o.chimney) rect(put, 460, 60, 480, 140, [60, 60, 60])
  })

const frame = (id: string, view: string, projection = 'ORTHOGRAPHIC_ELEVATION'): SourceCoordinateFrame => ({ id, assetId: `a-${id}`, variantByteHash: id.padEnd(64, '0').slice(0, 64), size: { width: W, height: H }, roles: { document: 'ELEVATION', storey: 'NONE', annotation: 'NONE', view, projection } })
const outline = (frameId: string, x0: number, x1: number): SourceObservation => ({ id: `s-${frameId}`, frameId, kind: 'SILHOUETTE', confidence: 0.9, pixelGeometry: { type: 'RECT', rect: { x0, y0: 100, x1, y1: 350 } } }) as unknown as SourceObservation
const audit = (frameId: string, use: ViewAuditRecord['use'], extra: Partial<ViewAuditRecord> = {}): ViewAuditRecord => ({ frameId, assetId: `a-${frameId}`, document: 'ELEVATION', projection: 'ORTHOGRAPHIC_ELEVATION', labelledView: 'X', sizePx: { width: W, height: H }, use, why: use === 'NOT_REGISTERED' ? 'not registered' : 'registered', lost: [], ...extra })

type Sheet = { id: string; view: string; raster: Raster; outline: [number, number]; projection?: string; audit?: Partial<ViewAuditRecord> & { use?: ViewAuditRecord['use'] } }
function run(sheets: Sheet[], datums: { ridgeY?: number; terrainY?: number } = {}): ElevationAxes[] {
  const rasters = new Map(sheets.map((s) => [frame(s.id, s.view).variantByteHash, s.raster]))
  return elevationAxes({
    frames: sheets.map((s) => frame(s.id, s.view, s.projection)),
    observations: sheets.map((s) => outline(s.id, s.outline[0], s.outline[1])),
    raster: (f) => rasters.get(f.variantByteHash),
    world: { walled: { x0: 0, z0: 0, x1: 10, z1: 8 }, envelope: { x0: 0, z0: 0, x1: 10, z1: 8 } },
    ...datums,
    viewAudit: sheets.map((s) => audit(s.id, s.audit?.use ?? 'NOT_REGISTERED', s.audit)),
    solverRegistrations: [],
    openingsByFacade: { FRONT: 3, REAR: 2, LEFT: 1, RIGHT: 1 },
  })
}
const byId = (vs: ElevationAxes[], id: string): ElevationAxes => vs.find((v) => v.frameId === id) as ElevationAxes

describe('N9-02A: four separate axes on an elevation', () => {
  it('1. no ridge datum, drawn wall faces on the plan span: ALONG registered, VERTICAL UNCHECKED — the missing ridge does not switch ALONG off', () => {
    const v = byId(run([{ id: 'f', view: 'FRONT', raster: frontView(), outline: [180, 620] }]), 'f')
    expect(v.side).toMatchObject({ state: 'REGISTERED', value: 'FRONT', basis: 'PUBLISHER_LABEL' })
    expect(v.along.state).toBe('REGISTERED')
    expect(v.along.mpp).toBeCloseTo(10 / 400, 3)
    expect(v.along.bandPx).toMatchObject({ x0: 200, x1: 599 })
    expect(v.vertical.state).toBe('UNCHECKED')
    expect(v.scale.state).toBe('ALONG_ONLY')
    expect(v.class).toBe('ALONG_ONLY')
    expect(v.checkable.along).toContain('the positions and widths of its 3 openings')
  })

  it('and with the ridge printed, the apex on the level ridge and the drawn ground make it FULL', () => {
    // 250 px from apex to ground at 0.025 m/px is 6.25 m: a 6.0 m ridge puts the ground 0.25 m below ±0.00
    const v = byId(run([{ id: 'f', view: 'FRONT', raster: frontView(), outline: [180, 620] }], { ridgeY: 6.0 }), 'f')
    expect(v.vertical.state).toBe('REGISTERED')
    expect(v.vertical.apexRow).toBeCloseTo(100, 0)
    expect(v.vertical.groundY).toBeCloseTo(-0.25, 1)
    expect(v.scale.state).toBe('ISOTROPY_PLAUSIBLE')
    expect(v.class).toBe('FULL')
    // with the terrain printed where the ground lands, the one scale is verified on both axes
    expect(byId(run([{ id: 'f', view: 'FRONT', raster: frontView(), outline: [180, 620] }], { ridgeY: 6.0, terrainY: -0.25 }), 'f').scale.state).toBe('VERIFIED_ISOTROPIC')
  })

  it('2. two unlabelled side views: the axis rests on the labelled front and rear, the hand stays UNKNOWN; without those labels, the side is UNKNOWN', () => {
    const sheets: Sheet[] = [
      { id: 'f', view: 'FRONT', raster: frontView(), outline: [180, 620] },
      { id: 'r', view: 'REAR', raster: frontView(), outline: [180, 620] },
      { id: 's1', view: 'SIDE_UNSPECIFIED', raster: sideView(), outline: [220, 580] },
      { id: 's2', view: 'SIDE_UNSPECIFIED', raster: sideView(), outline: [220, 580] },
    ]
    const vs = run(sheets)
    for (const id of ['s1', 's2']) {
      const v = byId(vs, id)
      expect(v.side).toMatchObject({ state: 'AXIS_ONLY', value: 'LEFT_OR_RIGHT', basis: 'LABEL_ELIMINATION' })
      expect(v.along.state).toBe('SPAN_ONLY')
      expect(v.along.mpp).toBeCloseTo(8 / 320, 3)
      expect(v.along.alongSign).toBeUndefined()
      expect(v.class).toBe('ALONG_ONLY')
    }
    const unlabelled = run(sheets.map((s) => ({ ...s, view: 'SIDE_UNSPECIFIED' })))
    for (const v of unlabelled) {
      expect(v.side.value).toBe('UNKNOWN')
      expect(v.along.state).toBe('UNCHECKED')
    }
  })

  it('one unlabelled view beside three labelled ones takes the one wall left, by elimination', () => {
    const vs = run([
      { id: 'f', view: 'FRONT', raster: frontView(), outline: [180, 620] },
      { id: 'r', view: 'REAR', raster: frontView(), outline: [180, 620] },
      { id: 'l', view: 'LEFT', raster: sideView(), outline: [220, 580] },
      { id: 's', view: 'SIDE_UNSPECIFIED', raster: sideView(), outline: [220, 580] },
    ])
    expect(byId(vs, 's').side).toMatchObject({ state: 'REGISTERED', value: 'RIGHT', basis: 'LABEL_ELIMINATION' })
    expect(byId(vs, 's').along).toMatchObject({ state: 'REGISTERED', alongSign: 1, alongAtLeft: 0 })
  })

  it('3. no legible ground for the scale: the ridge and the along scale put the ground off — VERTICAL REFUSED, ALONG kept, no height guessed', () => {
    // the printed ridge (9 m) and the band's scale put the drawn ground 2.75 m above ±0.00: one of the two is wrong
    const v = byId(run([{ id: 'f', view: 'FRONT', raster: frontView(), outline: [180, 620] }], { ridgeY: 9.0 }), 'f')
    expect(v.vertical.state).toBe('REFUSED')
    expect(v.vertical.groundY).toBeCloseTo(2.75, 1)
    expect(v.scale.state).toBe('REFUSED')
    expect(v.along.state).toBe('REGISTERED')
    expect(v.class).toBe('ALONG_ONLY')
  })

  it('4. a perspective sheet never enters as an orthographic view; a sheet of trees has no wall band', () => {
    const p = byId(run([{ id: 'p', view: 'FRONT', raster: frontView(), outline: [180, 620], projection: 'PERSPECTIVE' }], { ridgeY: 6 }), 'p')
    expect(p.class).toBe('UNREGISTERED')
    expect(p.along.why).toContain('not an orthographic elevation')
    const trees = sheet((put) => rect(put, 150, 120, 650, 350, GRASS))
    const t = byId(run([{ id: 't', view: 'FRONT', raster: trees, outline: [150, 650] }]), 't')
    expect(t.along.state).toBe('UNCHECKED')
    expect(t.class).toBe('UNREGISTERED')
  })

  it('5. a contested anchor has no vote: a band that disagrees with the sheet scale of the solver’s registrations is refused, the corroborated one kept', () => {
    // a side view whose neutral band is too narrow (a pale strip of a wider wall): 200 px for an 8 m depth would be 0.04 m/px
    const narrow = sheet((put) => {
      rect(put, 240, 200, 560, 350, WOOD)
      rect(put, 300, 200, 500, 350, WALL)
    })
    const vs = run([
      { id: 'f', view: 'FRONT', raster: frontView(), outline: [180, 620], audit: { use: 'OPENINGS_ONLY', side: 'FRONT', mpp: 0.025, spanM: 10 } },
      { id: 'r', view: 'REAR', raster: frontView(), outline: [180, 620], audit: { use: 'OPENINGS_ONLY', side: 'REAR', mpp: 0.025, spanM: 10 } },
      { id: 's', view: 'SIDE_UNSPECIFIED', raster: narrow, outline: [220, 580] },
    ])
    const s = byId(vs, 's')
    // the neutral band (0.04 m/px) is refused; the built band 240..560 is the walls at the sheet scale (0.025 m/px)
    expect(s.along.state).toBe('SPAN_ONLY')
    expect(s.along.mpp).toBeCloseTo(0.025, 3)
    expect(s.along.anchors.map((a) => a.kind)).toContain('SIBLING_SHEETS')
    expect(s.along.anchors.map((a) => a.kind)).toContain('BUILT_BAND_ENDS')
  })

  it('a pergola beside the gable does not pass as wall: its built band fits no span of the wall pair at the sheet scale', () => {
    const vs = run([
      { id: 'f', view: 'FRONT', raster: frontView(), outline: [180, 620], audit: { use: 'OPENINGS_ONLY', side: 'FRONT', mpp: 0.025, spanM: 10 } },
      { id: 'r', view: 'REAR', raster: frontView(), outline: [180, 620], audit: { use: 'OPENINGS_ONLY', side: 'REAR', mpp: 0.025, spanM: 10 } },
      { id: 's', view: 'SIDE_UNSPECIFIED', raster: sideView({ walls: WOOD, pergola: true }), outline: [220, 660] },
    ])
    const s = byId(vs, 's')
    // walls + pergola: 400 px is 10 m at the sheet scale — the WIDTH, which this side view cannot show
    expect(s.along.state).toBe('UNCHECKED')
    expect(s.class).toBe('UNREGISTERED')
  })

  it('6. a chimney does not become the ridge, on a level ridge or on a gable slope', () => {
    const f = byId(run([{ id: 'f', view: 'FRONT', raster: frontView({ chimney: true }), outline: [180, 620] }], { ridgeY: 6 }), 'f')
    expect(f.vertical.apexRow).toBeCloseTo(100, 0)
    expect(f.vertical.state).toBe('REGISTERED')
    const g = byId(run([
      { id: 'f', view: 'FRONT', raster: frontView(), outline: [180, 620] },
      { id: 'r', view: 'REAR', raster: frontView(), outline: [180, 620] },
      { id: 'l', view: 'LEFT', raster: sideView(), outline: [220, 580] },
      { id: 's', view: 'RIGHT', raster: sideView({ chimney: true }), outline: [220, 580] },
    ], { ridgeY: 6 }), 's')
    expect(g.vertical.apexRow).toBeGreaterThan(97)
    expect(g.vertical.apexRow).toBeLessThan(110)
  })

  it('and the eaves are not the wall face: the band ends at the walls, under a roof drawn wider than them', () => {
    const v = byId(run([{ id: 'f', view: 'FRONT', raster: frontView(), outline: [180, 620] }]), 'f')
    // the roof runs 180..620; the walls, and the band, 200..600
    expect(v.along.bandPx?.x0).toBe(200)
    expect(v.along.spanM).toBe(10)
  })

  it('apexOf: a level ridge, two slopes, and an outline that is neither', () => {
    const level = Array.from({ length: 100 }, (_, i) => ({ x: i, y: i < 10 || i > 90 ? 40 : 10 }))
    expect(apexOf(level, 20, 2)).toMatchObject({ row: 10, method: 'RIDGE_PLATEAU' })
    const gable = Array.from({ length: 101 }, (_, i) => ({ x: i, y: 10 + Math.abs(i - 50) }))
    expect(apexOf(gable, 20, 2)).toMatchObject({ method: 'GABLE_SLOPES' })
    expect(apexOf(gable, 20, 2).row).toBeCloseTo(10, 0)
    const ramp = Array.from({ length: 100 }, (_, i) => ({ x: i, y: 100 - i }))
    expect(apexOf(ramp, 20, 2).row).toBeUndefined()
  })

  it('7. the hand is never swapped: opposite unlabelled views on one axis keep LEFT_OR_RIGHT and read no position', () => {
    const vs = run([
      { id: 'f', view: 'FRONT', raster: frontView(), outline: [180, 620] },
      { id: 'r', view: 'REAR', raster: frontView(), outline: [180, 620] },
      { id: 's1', view: 'SIDE_UNSPECIFIED', raster: sideView(), outline: [220, 580] },
      { id: 's2', view: 'SIDE_UNSPECIFIED', raster: sideView(), outline: [220, 580] },
    ], { ridgeY: 6 })
    for (const id of ['s1', 's2']) {
      const v = byId(vs, id)
      expect(v.side.value).toBe('LEFT_OR_RIGHT')
      expect(v.along.alongAtLeft).toBeUndefined()
      expect(v.checkable.along).toEqual(['the facade’s width (the hand unknown: no position)'])
    }
  })

  it('two opposite views that disagree on the span: the sheet scale of the front and rear decides; with nothing to decide, neither is taken', () => {
    const wide = sheet((put) => {
      for (let y = 100; y < 200; y += 1) rect(put, 400 - Math.round(((y - 100) / 100) * 200), y, 400 + Math.round(((y - 100) / 100) * 200), y + 1, ROOF)
      rect(put, 200, 200, 600, 350, WALL)
    })
    const withSheetScale = run([
      { id: 'f', view: 'FRONT', raster: frontView(), outline: [180, 620] },
      { id: 'r', view: 'REAR', raster: frontView(), outline: [180, 620] },
      { id: 's1', view: 'LEFT', raster: sideView(), outline: [220, 580] },
      { id: 's2', view: 'RIGHT', raster: wide, outline: [200, 600] },
    ])
    expect(byId(withSheetScale, 's1').along.state).toBe('REGISTERED')
    expect(byId(withSheetScale, 's2').along.state).toBe('UNCHECKED')
    expect(byId(withSheetScale, 's2').along.why).toContain('off the sheet scale')
    const alone = run([
      { id: 's1', view: 'LEFT', raster: sideView(), outline: [220, 580] },
      { id: 's2', view: 'RIGHT', raster: wide, outline: [200, 600] },
    ])
    expect(byId(alone, 's1').along.state).toBe('UNCHECKED')
    expect(byId(alone, 's2').along.state).toBe('UNCHECKED')
  })

  it('8. an unregistered elevation never passes R5, whatever its axes say', () => {
    const m = { openings: [], walls: [], roofs: [], roofPlanes: [] } as never
    const rel = elevationRelation({ model: m, viewAudit: [audit('s', 'NOT_REGISTERED', { side: 'LEFT' })], residuals: [], crossView: { views: [], reconciliation: { iterations: 0, applied: 0, refused: 0, converged: true, residualsBefore: 0, residualsAfter: 0 } }, facadeAlignment: { views: [], readings: [], rejected: [], comparisons: [], corrections: [], unregistered: [], counts: {} as never, statusCounts: {} as never }, openings: [] })
    expect(rel.items[0].status).toBe('UNCHECKED')
    expect(rel.status).toBe('UNCHECKED')
  })
  it('a band cut by the outline (the wall goes on past its edge) is never a wall end', () => {
    // the traced outline stops at column 400, inside a wall that runs to 600
    const v = byId(run([{ id: 'f', view: 'FRONT', raster: frontView(), outline: [180, 400] }]), 'f')
    expect(v.along.state).toBe('UNCHECKED')
  })

  it('the solver’s registration is contested by two agreeing bands, unless the sheet’s other views stand at its scale', () => {
    // the solver registered front and rear at 0.0225 m/px; both bands say 0.025 (10 m over 400 px)
    const solver = { use: 'OPENINGS_ONLY' as const, mpp: 0.0225, spanM: 10 }
    const two = run([
      { id: 'f', view: 'FRONT', raster: frontView(), outline: [180, 620], audit: { ...solver, side: 'FRONT' } },
      { id: 'r', view: 'REAR', raster: frontView(), outline: [180, 620], audit: { ...solver, side: 'REAR' } },
    ])
    expect(byId(two, 'f').along.state).toBe('UNCHECKED')
    expect(byId(two, 'f').along.why).toContain('contested')
    // a side view registered by the solver at its scale arbitrates for it
    const three = run([
      { id: 'f', view: 'FRONT', raster: frontView(), outline: [180, 620], audit: { ...solver, side: 'FRONT' } },
      { id: 'r', view: 'REAR', raster: frontView(), outline: [180, 620], audit: { ...solver, side: 'REAR' } },
      { id: 'l', view: 'LEFT', raster: sideView(), outline: [220, 580], audit: { use: 'OPENINGS_ONLY', side: 'LEFT', mpp: 0.0225, spanM: 8 } },
    ])
    expect(byId(three, 'f').along.state).toBe('REGISTERED')
    expect(byId(three, 'f').along.mpp).toBe(0.0225)
  })
})
