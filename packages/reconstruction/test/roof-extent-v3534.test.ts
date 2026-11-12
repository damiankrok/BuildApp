/**
 * v3.53.4 — what one roof covers, read from the eaves line a single-storey plan draws (`eave-outline.ts`,
 * `bodiesUnderTheEaves`), on plans drawn in code (5 cm/px; not drawings of any real building).
 *
 * The cause this stage fixes: a plan was cut into bodies on its walls alone. A part of the house behind an interior
 * wall, with a covered terrace cut out of its corner, was then an annexe beside the main body — and an annexe is given
 * a flat roof by convention. The plan says otherwise in its own ink: a thin dashed line runs around the whole house,
 * some way outside the walls. That line is the eaves, and what it encloses is what the roof covers.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import { inferStructuralLayout } from '../src/index.js'
import type { StructuralLayoutDraft } from '../src/index.js'
import { EAVE_BOUNDS, readCornerPost, readEaveOutline } from '../src/eave-outline.js'
import { WALL, chain, graphOf, metricsOf, planFrame, registration, sheet } from './plan.js'
import { BLACK, fillRect } from '../../source-cv/test/draw.js'
import { clear, ring, wall } from './boundary-plan.js'

const MPP = 0.05
const FRAME = planFrame('frame-ground', 'GROUND', { width: 560, height: 420 })
/** The eaves stand 0.7 m outside the walls. */
const OVERHANG = 14

/** A thin dashed line (6 px dashes, 4 px gaps), as a plan draws what is overhead. */
function dashed(r: Raster, x0: number, y0: number, x1: number, y1: number): void {
  if (y0 === y1) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 1) if ((x - Math.min(x0, x1)) % 10 < 6) fillRect(r, x, y0, x, y0, BLACK)
  if (x0 === x1) for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y += 1) if ((y - Math.min(y0, y1)) % 10 < 6) fillRect(r, x0, y, x0, y, BLACK)
}
/** A closed dashed outline through the corners given, in order. */
function outline(r: Raster, corners: ReadonlyArray<[number, number]>): void {
  corners.forEach(([x, y], i) => {
    const [nx, ny] = corners[(i + 1) % corners.length]
    dashed(r, x, y, nx, ny)
  })
}

const layoutOf = (raster: Raster, xs: number[], ys: number[]): StructuralLayoutDraft =>
  inferStructuralLayout({
    slug: 'test',
    sourcePackageId: 'src-test',
    sourcePackageHash: 'd'.repeat(64),
    graph: graphOf([FRAME]),
    metrics: metricsOf([chain('gx', 'HORIZONTAL', xs, { frameId: 'frame-ground', baselinePx: 12 }), chain('gy', 'VERTICAL', ys, { frameId: 'frame-ground', baselinePx: 12 })], [registration('frame-ground')]),
    raster: () => raster,
  })
const sizes = (d: StructuralLayoutDraft): Array<[number, number]> => d.masses.map((m) => [Number(m.widthM.value.toFixed(1)), Number(m.depthM.value.toFixed(1))] as [number, number]).sort((a, b) => b[0] * b[1] - a[0] * a[1])

/**
 * A house 20 × 12 m. Its rear 8.6 m is one walled rectangle; in front of it, behind that rectangle's own thick wall,
 * stand rooms over the left 12 m, and the right 8 m of the front is a covered terrace, open on two sides, a post at its
 * outer corner.
 */
function houseWithCoveredCorner(eaves: boolean): Raster {
  const r = sheet(560, 420)
  ring(r, 60, 60, 459, 231)
  ring(r, 60, 220, 299, 299)
  fillRect(r, 444, 284, 459, 299, BLACK)
  if (eaves) outline(r, [[60 - OVERHANG, 60 - OVERHANG], [459 + OVERHANG, 60 - OVERHANG], [459 + OVERHANG, 299 + OVERHANG], [60 - OVERHANG, 299 + OVERHANG]])
  return r
}

/**
 * An L: a main body 20 × 10 m and, in front of its right 13 m, a wing 4 m deep. The wing's left 4 m is an open porch
 * (a post at its outer corner) in front of the main body's own wall; the rest is walled, and one room runs from the
 * main body into it (no wall between them there).
 */
function houseWithWing(eaves: boolean): Raster {
  const r = sheet(560, 420)
  ring(r, 60, 60, 459, 259)
  // the wing's walled part: its left wall, its front, its right (the main body's right wall runs on)
  wall(r, 280, 248, 280 + WALL - 1, 339)
  wall(r, 280, 328, 459, 339)
  wall(r, 448, 248, 459, 339)
  // one room through the contact
  clear(r, 280 + WALL, 248, 447, 259)
  // the porch's post
  fillRect(r, 200, 324, 215, 339, BLACK)
  if (eaves) outline(r, [[60 - OVERHANG, 60 - OVERHANG], [459 + OVERHANG, 60 - OVERHANG], [459 + OVERHANG, 339 + OVERHANG], [200 - OVERHANG, 339 + OVERHANG], [200 - OVERHANG, 259 + OVERHANG], [60 - OVERHANG, 259 + OVERHANG]])
  return r
}

describe('the eaves line of a plan (v3.53.4)', () => {
  it('a dashed line around the walls, a little outside them, closes: the eaves, and the roofed footprint is that line taken in to the walls', () => {
    const reading = readEaveOutline(houseWithCoveredCorner(true), [{ x0: 60, y0: 60, x1: 460, y1: 232 }, { x0: 60, y0: 220, x1: 300, y1: 300 }], MPP, MPP)
    expect(reading.state).toBe('CLOSED')
    expect(reading.overhangM).toBeCloseTo(0.7, 1)
    expect(reading.roofedRects).toHaveLength(1)
    const [roofed] = reading.roofedRects ?? []
    expect(Math.abs(roofed.x0 - 60)).toBeLessThanOrEqual(2)
    expect(Math.abs(roofed.x1 - 460)).toBeLessThanOrEqual(2)
    expect(Math.abs(roofed.y0 - 60)).toBeLessThanOrEqual(2)
    expect(Math.abs(roofed.y1 - 300)).toBeLessThanOrEqual(2)
  })

  it('an L of eaves encloses two rectangles that overlap', () => {
    const reading = readEaveOutline(houseWithWing(true), [{ x0: 60, y0: 60, x1: 460, y1: 260 }, { x0: 280, y0: 260, x1: 460, y1: 340 }], MPP, MPP)
    expect(reading.state).toBe('CLOSED')
    expect(reading.roofedRects).toHaveLength(2)
  })

  it('counter-case: no dashed line, no eaves', () => {
    expect(readEaveOutline(houseWithCoveredCorner(false), [{ x0: 60, y0: 60, x1: 460, y1: 232 }], MPP, MPP).state).toBe('NO_EAVES_LINE')
  })

  it('counter-case: a dashed rectangle beside the house — a pergola over a terrace — is not around it, and is no eaves', () => {
    const r = houseWithCoveredCorner(false)
    outline(r, [[470, 80], [540, 80], [540, 200], [470, 200]])
    const reading = readEaveOutline(r, [{ x0: 60, y0: 60, x1: 460, y1: 232 }, { x0: 60, y0: 220, x1: 300, y1: 300 }], MPP, MPP)
    expect(reading.state).not.toBe('CLOSED')
    expect(reading.roofedRects).toBeUndefined()
  })

  it('counter-case: a dashed outline inside the walls — a void, a beam overhead — is no eaves', () => {
    const r = houseWithCoveredCorner(false)
    outline(r, [[120, 100], [300, 100], [300, 180], [120, 180]])
    expect(readEaveOutline(r, [{ x0: 60, y0: 60, x1: 460, y1: 232 }], MPP, MPP).state).toBe('NO_EAVES_LINE')
  })

  it('counter-case: a dashed line further out than any eaves reach — a plot line, a paved edge — is no eaves', () => {
    const r = sheet(700, 560)
    ring(r, 120, 120, 519, 359)
    const far = Math.round((EAVE_BOUNDS.maxOffsetM + 0.6) / MPP)
    outline(r, [[120 - far, 120 - far], [519 + far, 120 - far], [519 + far, 359 + far], [120 - far, 359 + far]])
    expect(readEaveOutline(r, [{ x0: 120, y0: 120, x1: 520, y1: 360 }], MPP, MPP).state).toBe('NO_EAVES_LINE')
  })

  it('counter-case: eaves that stop part way along one side do not close, and say nothing of what is roofed', () => {
    const r = houseWithCoveredCorner(false)
    dashed(r, 46, 46, 474, 46)
    dashed(r, 46, 46, 46, 314)
    dashed(r, 474, 46, 474, 314)
    dashed(r, 46, 314, 170, 314)
    const reading = readEaveOutline(r, [{ x0: 60, y0: 60, x1: 460, y1: 232 }, { x0: 60, y0: 220, x1: 300, y1: 300 }], MPP, MPP)
    expect(reading.state).toBe('NOT_CLOSED')
    expect(reading.roofedRects).toBeUndefined()
    // and the layout keeps the walls' cut
    const d = layoutOf(r, [60, 300, 460], [60, 232, 300])
    expect(d.roofExtent).toBeUndefined()
    expect(d.masses.length).toBe(2)
  })

  it('a post is a solid block in the corner; a wall running on from the corner, or bare paper, is none', () => {
    const r = sheet(200, 200)
    fillRect(r, 40, 40, 55, 53, BLACK)
    const post = readCornerPost(r, { x: 40, y: 40 }, { dx: 1, dy: 1 }, MPP, MPP)
    expect(post).toEqual({ x0: 40, y0: 40, x1: 56, y1: 54 })
    fillRect(r, 100, 100, 180, 111, BLACK)
    expect(readCornerPost(r, { x: 100, y: 100 }, { dx: 1, dy: 1 }, MPP, MPP)).toBeUndefined()
    expect(readCornerPost(r, { x: 20, y: 150 }, { dx: 1, dy: 1 }, MPP, MPP)).toBeUndefined()
  })
})

describe('bodies under one roof (v3.53.4)', () => {
  it('the cause: cut on its walls alone, the part of the house behind an interior wall is an annexe beside the main body', () => {
    const d = layoutOf(houseWithCoveredCorner(false), [60, 300, 460], [60, 232, 300])
    expect(d.masses.length).toBe(2)
    expect(d.roofExtent).toBeUndefined()
  })

  it('with the eaves line the plan draws around both, they are one body under one roof — the covered corner inside it', () => {
    const d = layoutOf(houseWithCoveredCorner(true), [60, 300, 460], [60, 232, 300])
    expect(d.roofExtent?.taken).toBe(true)
    expect(d.roofExtent?.state).toBe('CLOSED')
    expect(d.masses.length).toBe(1)
    expect(sizes(d)).toEqual([[20, 12]])
    expect(d.roofExtent?.bodies.map((b) => b.role)).toEqual(['MAIN'])
  })

  it('a wing under the same eaves is a second body, cut where the main rectangle ends; its open end is under its roof and outside its walls', () => {
    const d = layoutOf(houseWithWing(true), [60, 200, 280, 460], [60, 260, 340])
    expect(d.roofExtent?.taken).toBe(true)
    expect(d.roofExtent?.bodies.map((b) => b.role)).toEqual(['MAIN', 'WING'])
    const wing = d.roofExtent?.bodies[1]
    // the wing's roof stands on all the eaves enclose past the main body; its body is the walled part
    expect(wing?.roofedPx).toEqual({ x0: 200, y0: 260, x1: 460, y1: 340 })
    expect(wing?.rectPx).toEqual({ x0: 280, y0: 260, x1: 460, y1: 340 })
    expect(wing?.open).toHaveLength(1)
    expect(wing?.open?.[0].rectPx).toEqual({ x0: 200, y0: 260, x1: 280, y1: 340 })
    expect(wing?.open?.[0].postsPx).toHaveLength(1)
    expect(sizes(d)).toEqual([[20, 10], [9, 4]])
  })

  it('counter-case: a garage beside the house, outside the house’s eaves line, keeps the walls’ cut — a body of its own, its roof not this one', () => {
    const r = sheet(700, 420)
    ring(r, 60, 60, 399, 299)
    // the garage: lower, built against the house's right wall, no eaves drawn around it
    ring(r, 388, 140, 559, 299)
    outline(r, [[46, 46], [413, 46], [413, 313], [46, 313]])
    const d = layoutOf(r, [60, 400, 560], [60, 140, 300])
    // v3.53.5: the cut is still the walls' — and the record now says what the plan shows: the house's eaves are drawn
    // through the garage, which stands beside that roof (v3.53.4 read nothing here and kept no record)
    expect(d.roofExtent?.taken).toBe(false)
    expect(d.roofExtent?.bodies).toEqual([])
    expect(d.roofExtent?.beyond).toHaveLength(1)
    expect(d.roofExtent?.beyond?.[0].eavesDrawnThrough).toBe(true)
    expect(d.masses.length).toBe(2)
  })

  it('an entrance set back in the front of the body, under the eaves, stays a recess in that face — the body is not cut on its back wall', () => {
    // a house 20 × 12 m whose front is set back 2.4 m over 10 m in the middle: two returns and a back wall
    const r = sheet(560, 420)
    ring(r, 60, 60, 459, 299)
    clear(r, 160, 288, 359, 299)
    wall(r, 160, 252, 359, 263)
    wall(r, 160, 252, 171, 299)
    wall(r, 348, 252, 359, 299)
    outline(r, [[60 - OVERHANG, 60 - OVERHANG], [459 + OVERHANG, 60 - OVERHANG], [459 + OVERHANG, 299 + OVERHANG], [60 - OVERHANG, 299 + OVERHANG]])
    const d = layoutOf(r, [60, 160, 360, 460], [60, 252, 300])
    expect(d.masses.length).toBe(1)
    expect(sizes(d)).toEqual([[20, 12]])
    expect(d.recesses).toHaveLength(1)
    expect(d.recesses[0].massId).toBe(d.masses[0].id)
    expect(d.recesses[0].depthM.value).toBeCloseTo(2.4, 1)
  })

  it('the same plan gives the same bodies twice', () => {
    const a = layoutOf(houseWithWing(true), [60, 200, 280, 460], [60, 260, 340])
    const b = layoutOf(houseWithWing(true), [60, 200, 280, 460], [60, 260, 340])
    expect(JSON.stringify(a.masses)).toBe(JSON.stringify(b.masses))
    expect(JSON.stringify(a.roofExtent)).toBe(JSON.stringify(b.roofExtent))
  })
})
