/**
 * v3.53.5 — a common roof beside a roof of its own, on plans drawn in code (5 cm/px; not drawings of any real building).
 *
 * The house: a main body 20 × 10 m, a wing of rooms 10 × 4 m behind its left half under the SAME hipped roof, and a
 * block 12 × 5 m in front of its left part under a low roof of its own. The plan draws the eaves of the common roof as
 * one dashed L around the main body and the wing — and, because that roof's edge hangs over the lower block, the front
 * side of the L runs dashed straight THROUGH the block's rooms. Beside the wing stands a pergola, its rafters dashed.
 *
 * v3.53.4 read the eaves only as a line around EVERY walled body, outside all of them. On this house it lost the
 * common roof three times over, and each is pinned below:
 *
 *   1. a few dashes of clutter on the rows beside the rear eaves made that line "a hatch" (the thickness test measured
 *      the overlap against the shorter run), so one side of the outline was never read;
 *   2. the pergola's rafter nearest the wing ran nearer its wall than the eaves do, and "the nearer of two parallel
 *      lines is the eaves" took the rafter;
 *   3. the front eaves, drawn through the block, were "inside a body" and dropped — and had they been read, the block
 *      outside the outline would have unread the whole outline (`NOT_AROUND_THE_BODIES`).
 *
 * With none of the eaves read, the wing was an annexe and got a slab for a roof.
 */
import { describe, expect, it } from 'vitest'
import type { PixelRect } from '@buildapp/source-common'
import type { Raster } from '@buildapp/source-cv'
import { inferStructuralLayout } from '../src/index.js'
import type { StructuralLayoutDraft } from '../src/index.js'
import { readEaveOutline } from '../src/eave-outline.js'
import { WALL, chain, graphOf, metricsOf, planFrame, registration, sheet } from './plan.js'
import { BLACK, fillRect } from '../../source-cv/test/draw.js'
import { clear, ring, wall } from './boundary-plan.js'

const MPP = 0.05
/** The eaves stand 0.7 m outside the walls. */
const OVERHANG = 14

/** A thin dashed line (6 px dashes, 4 px gaps), as a plan draws what is overhead. */
function dashed(r: Raster, x0: number, y0: number, x1: number, y1: number): void {
  if (y0 === y1) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 1) if ((x - Math.min(x0, x1)) % 10 < 6) fillRect(r, x, y0, x, y0, BLACK)
  if (x0 === x1) for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y += 1) if ((y - Math.min(y0, y1)) % 10 < 6) fillRect(r, x0, y, x0, y, BLACK)
}

const MAIN: PixelRect = { x0: 100, y0: 200, x1: 500, y1: 400 }
const WING: PixelRect = { x0: 100, y0: 120, x1: 300, y1: 200 }
const BLOCK: PixelRect = { x0: 100, y0: 400, x1: 340, y1: 500 }

type Parts = {
  /** The low block in front, with a roof of its own. */
  block?: boolean
  /** How the front eaves are drawn where the block stands: dashed through it, or not at all (hidden). */
  frontEaves?: 'THROUGH' | 'HIDDEN'
  /** The pergola beside the wing: rafters at 0.6 m, the first 0.4 m from the wing's wall. */
  pergola?: boolean
  /** A few dashes on the rows either side of the rear eaves. */
  clutter?: boolean
  /** No eaves at all. */
  noEaves?: boolean
  /** The rear eaves over the terrace left out: the outline does not close. */
  rearEavesMissing?: boolean
  /** A pier standing in the eaves' projection, in the corner between the wing and the main body. */
  pier?: boolean
}

function house(p: Parts = {}): Raster {
  const r = sheet(700, 560)
  ring(r, MAIN.x0, MAIN.y0, MAIN.x1 - 1, MAIN.y1 - 1)
  // the wing stands on the main body's rear wall, the block against its front wall
  ring(r, WING.x0, WING.y0, WING.x1 - 1, WING.y1 + WALL - 1)
  if (p.block) ring(r, BLOCK.x0, BLOCK.y0 - WALL, BLOCK.x1 - 1, BLOCK.y1 - 1)
  if (p.pier) fillRect(r, 300, 188, 311, 199, BLACK)
  if (!p.noEaves) {
    const [left, right, top, wingRight, rear, front] = [MAIN.x0 - OVERHANG, MAIN.x1 - 1 + OVERHANG, WING.y0 - OVERHANG, WING.x1 - 1 + OVERHANG, MAIN.y0 - OVERHANG, MAIN.y1 - 1 + OVERHANG]
    dashed(r, left, top, wingRight, top)
    dashed(r, wingRight, top, wingRight, rear)
    if (!p.rearEavesMissing) dashed(r, wingRight, rear, right, rear)
    dashed(r, right, rear, right, front)
    dashed(r, left, top, left, front)
    // the front: free of the block to the right of it; over the block, through its rooms or hidden
    if (p.block && p.frontEaves === 'HIDDEN') dashed(r, BLOCK.x1 + 4, front, right, front)
    else dashed(r, left, front, right, front)
  }
  if (p.pergola) for (let x = WING.x1 + 8; x <= MAIN.x1 - 12; x += 12) dashed(r, x, WING.y0 + 6, x, MAIN.y0 - 4)
  // clutter: four short rows of fine dashes (3 px on, 2 off, 2.5 m long) two and four pixels either side of the rear eaves
  if (p.clutter) for (const dy of [-4, -2, 2, 4]) for (let x = 420; x <= 470; x += 1) if ((x - 420) % 5 < 3) fillRect(r, x, MAIN.y0 - OVERHANG + dy, x, MAIN.y0 - OVERHANG + dy, BLACK)
  return r
}

const FRAME = planFrame('frame-ground', 'GROUND', { width: 700, height: 560 })
const layoutOf = (raster: Raster, xs: number[], ys: number[], frame = FRAME): StructuralLayoutDraft =>
  inferStructuralLayout({
    slug: 'test',
    sourcePackageId: 'src-test',
    sourcePackageHash: 'd'.repeat(64),
    graph: graphOf([frame]),
    metrics: metricsOf([chain('gx', 'HORIZONTAL', xs, { frameId: frame.id, baselinePx: 12 }), chain('gy', 'VERTICAL', ys, { frameId: frame.id, baselinePx: 12 })], [registration(frame.id)]),
    raster: () => raster,
  })
const sizes = (d: StructuralLayoutDraft): Array<[number, number]> => d.masses.map((m) => [Number(m.widthM.value.toFixed(1)), Number(m.depthM.value.toFixed(1))] as [number, number]).sort((a, b) => b[0] * b[1] - a[0] * a[1])
const near = (a: number, b: number): boolean => Math.abs(a - b) <= 2
const sameRect = (a: PixelRect | undefined, b: PixelRect): boolean => a !== undefined && near(a.x0, b.x0) && near(a.y0, b.y0) && near(a.x1, b.x1) && near(a.y1, b.y1)

describe('the eaves of a common roof beside a roof of its own (v3.53.5)', () => {
  it('the cause: the L of eaves around the main body and the wing is read, and the block the front eaves run through lies beyond it', () => {
    const reading = readEaveOutline(house({ block: true, frontEaves: 'THROUGH', pergola: true, clutter: true }), [MAIN, WING, BLOCK], MPP, MPP)
    expect(reading.state).toBe('CLOSED')
    expect(reading.roofedRects).toHaveLength(2)
    // the main body's own rectangle, and the wing's taken through the main body
    expect(reading.roofedRects?.some((q) => sameRect(q, MAIN))).toBe(true)
    expect(reading.roofedRects?.some((q) => sameRect(q, { x0: WING.x0, y0: WING.y0, x1: WING.x1, y1: MAIN.y1 }))).toBe(true)
    expect(reading.beyond).toEqual([{ body: 2, eavesDrawnThrough: true }])
    expect(reading.overhangM).toBeCloseTo(0.7, 1)
  })

  it('first wrong decision 1: a few dashes of clutter beside a long eaves line do not make it a hatch', () => {
    const reading = readEaveOutline(house({ clutter: true }), [MAIN, WING], MPP, MPP)
    expect(reading.state).toBe('CLOSED')
    expect(reading.lines.some((l) => l.axis === 'Y' && near(l.atPx, MAIN.y0 - OVERHANG))).toBe(true)
    expect(reading.roofedRects).toHaveLength(2)
  })

  it('first wrong decision 2: the rafters of a pergola are a family of equal dashed lines, and none of them is the eaves — however near the wall', () => {
    const reading = readEaveOutline(house({ pergola: true }), [MAIN, WING], MPP, MPP)
    expect(reading.state).toBe('CLOSED')
    const beside = reading.lines.filter((l) => l.axis === 'X' && l.atPx > WING.x1 && l.atPx < MAIN.x1 - 20)
    expect(beside).toHaveLength(1)
    expect(near(beside[0].atPx, WING.x1 - 1 + OVERHANG)).toBe(true)
  })

  it('first wrong decision 3: the eaves drawn through a body beside the house are still the eaves, and that body is beside the roof, not under it', () => {
    const reading = readEaveOutline(house({ block: true, frontEaves: 'THROUGH' }), [MAIN, WING, BLOCK], MPP, MPP)
    expect(reading.state).toBe('CLOSED')
    const front = reading.lines.find((l) => l.axis === 'Y' && near(l.atPx, MAIN.y1 - 1 + OVERHANG))
    expect(front?.through).toEqual([2])
    expect(reading.beyond).toEqual([{ body: 2, eavesDrawnThrough: true }])
  })

  it('counter-case (uncertain outline): where the eaves are hidden over the block and not drawn, the outline does not close and nothing is said of any roof', () => {
    const reading = readEaveOutline(house({ block: true, frontEaves: 'HIDDEN' }), [MAIN, WING, BLOCK], MPP, MPP)
    expect(reading.state).toBe('NOT_CLOSED')
    expect(reading.roofedRects).toBeUndefined()
    expect(reading.beyond).toBeUndefined()
  })

  it('counter-case (uncertain outline): a side of the eaves that is not drawn leaves the outline open', () => {
    const reading = readEaveOutline(house({ block: true, frontEaves: 'THROUGH', rearEavesMissing: true }), [MAIN, WING, BLOCK], MPP, MPP)
    expect(reading.state).not.toBe('CLOSED')
    expect(reading.roofedRects).toBeUndefined()
  })

  it('counter-case (false dashed lines): a pergola alone, no eaves drawn — its rafters are read as nothing', () => {
    const reading = readEaveOutline(house({ noEaves: true, pergola: true }), [MAIN, WING], MPP, MPP)
    expect(reading.state).toBe('NO_EAVES_LINE')
    expect(reading.lines).toHaveLength(0)
  })

  it('counter-case: a dashed line inside a room, on no eaves line seen outside, is still not the eaves', () => {
    const r = house({ block: true, frontEaves: 'HIDDEN' })
    // a beam across the block's rooms, 0.5 m lower than the eaves would run
    dashed(r, BLOCK.x0 + 14, MAIN.y1 - 1 + OVERHANG + 10, BLOCK.x1 - 14, MAIN.y1 - 1 + OVERHANG + 10)
    const reading = readEaveOutline(r, [MAIN, WING, BLOCK], MPP, MPP)
    expect(reading.state).toBe('NOT_CLOSED')
    expect(reading.lines.some((l) => l.through)).toBe(false)
  })

  it('counter-case: a body the outline’s edge runs across is neither under the roof nor beside it — the lines are not read as the eaves', () => {
    // the block as the walls might have cut it, reaching 1.5 m in under the main body
    const straddling: PixelRect = { x0: BLOCK.x0, y0: BLOCK.y0 - 30, x1: BLOCK.x1, y1: BLOCK.y1 }
    const reading = readEaveOutline(house({ block: true, frontEaves: 'THROUGH' }), [{ ...MAIN, y1: MAIN.y1 }, WING, straddling], MPP, MPP)
    expect(reading.state).toBe('NOT_AROUND_THE_BODIES')
    expect(reading.roofedRects).toBeUndefined()
  })

  it('counter-case: an outline that leaves the largest body outside is not the eaves of the building', () => {
    const r = sheet(700, 560)
    ring(r, MAIN.x0, MAIN.y0, MAIN.x1 - 1, MAIN.y1 - 1)
    ring(r, WING.x0, WING.y0, WING.x1 - 1, WING.y1 + WALL - 1)
    // a dashed loop round the wing alone, its front side drawn through the main body
    const [l, t, rr, b] = [WING.x0 - OVERHANG, WING.y0 - OVERHANG, WING.x1 - 1 + OVERHANG, WING.y1 + OVERHANG]
    dashed(r, l, t, rr, t)
    dashed(r, rr, t, rr, b)
    dashed(r, l, t, l, b)
    dashed(r, l, b, rr, b)
    const reading = readEaveOutline(r, [MAIN, WING], MPP, MPP)
    expect(reading.state).not.toBe('CLOSED')
  })

  it('a pier in the eaves’ projection is no face of the house: the footprint is taken in to the walls behind it', () => {
    const pier: PixelRect = { x0: 300, y0: 188, x1: 312, y1: 200 }
    const reading = readEaveOutline(house({ pier: true }), [MAIN, WING, pier], MPP, MPP)
    expect(reading.state).toBe('CLOSED')
    expect(reading.roofedRects?.some((q) => sameRect(q, MAIN))).toBe(true)
    expect(reading.roofedRects?.some((q) => sameRect(q, { x0: WING.x0, y0: WING.y0, x1: WING.x1, y1: MAIN.y1 }))).toBe(true)
    expect(reading.beyond).toEqual([{ body: 2, eavesDrawnThrough: false }])
  })
})

describe('bodies under a common roof, and the body beside it (v3.53.5)', () => {
  const XS = [100, 300, 340, 500]
  const YS = [120, 200, 400, 500]

  it('the cause, at the layout: the main body and the wing are cut on the eaves; the block beside keeps the walls’ cut and is named as beyond that roof', () => {
    const d = layoutOf(house({ block: true, frontEaves: 'THROUGH', pergola: true, clutter: true }), XS, YS)
    expect(d.roofExtent?.state).toBe('CLOSED')
    expect(d.roofExtent?.taken).toBe(true)
    expect(d.roofExtent?.bodies.map((b) => b.role)).toEqual(['MAIN', 'WING'])
    expect(sameRect(d.roofExtent?.bodies[0].rectPx, MAIN)).toBe(true)
    expect(sameRect(d.roofExtent?.bodies[1].rectPx, WING)).toBe(true)
    expect(d.roofExtent?.beyond).toHaveLength(1)
    expect(sameRect(d.roofExtent?.beyond?.[0].rectPx, BLOCK)).toBe(true)
    expect(d.roofExtent?.beyond?.[0].eavesDrawnThrough).toBe(true)
    // three bodies, each its own size: nothing merged, nothing lost
    expect(sizes(d)).toEqual([[20, 10], [12, 5], [10, 4]])
    // the block is not one of the bodies under the roof
    expect(d.roofExtent?.bodies.some((b) => b.regionId === d.roofExtent?.beyond?.[0].regionId)).toBe(false)
  })

  it('counter-case (a real separate roof stays separate): where nothing changes in the cut, the block is still named as beside the roof and no body is merged', () => {
    // no wing: a rectangle under its eaves and the block in front, the eaves drawn through it
    const r = sheet(700, 560)
    ring(r, MAIN.x0, MAIN.y0, MAIN.x1 - 1, MAIN.y1 - 1)
    ring(r, BLOCK.x0, BLOCK.y0 - WALL, BLOCK.x1 - 1, BLOCK.y1 - 1)
    const [left, right, rear, front] = [MAIN.x0 - OVERHANG, MAIN.x1 - 1 + OVERHANG, MAIN.y0 - OVERHANG, MAIN.y1 - 1 + OVERHANG]
    dashed(r, left, rear, right, rear)
    dashed(r, right, rear, right, front)
    dashed(r, left, rear, left, front)
    dashed(r, left, front, right, front)
    const d = layoutOf(r, [100, 340, 500], [200, 400, 500])
    expect(sizes(d)).toEqual([[20, 10], [12, 5]])
    expect(d.roofExtent?.taken).toBe(false)
    expect(d.roofExtent?.bodies).toEqual([])
    expect(d.roofExtent?.beyond).toHaveLength(1)
    expect(d.roofExtent?.beyond?.[0].eavesDrawnThrough).toBe(true)
  })

  it('counter-case (uncertain outline): with the eaves hidden over the block the walls’ cut stands and no roof is said to cover anything', () => {
    const d = layoutOf(house({ block: true, frontEaves: 'HIDDEN', pergola: true }), XS, YS)
    expect(d.roofExtent).toBeUndefined()
    expect(sizes(d)).toEqual([[20, 10], [12, 5], [10, 4]])
  })

  it('a join with an open porch: the wing keeps its open end and its post, with a body of another roof standing beside the house', () => {
    // a main body 20 × 10 m; in front of its right 13 m a wing 4 m deep, the left 4 m of it an open porch on a post;
    // against the main body's left wall a block 7 × 6 m under a roof of its own, the left eaves drawn through it
    // (the eaves are seen free of the block over 4 m before they run over it: a line is read as the eaves where it
    // runs along a face in the open, and only then followed through a body)
    const frame = planFrame('frame-ground', 'GROUND', { width: 760, height: 420 })
    const r = sheet(760, 420)
    ring(r, 160, 60, 559, 259)
    wall(r, 380, 248, 380 + WALL - 1, 339)
    wall(r, 380, 328, 559, 339)
    wall(r, 548, 248, 559, 339)
    clear(r, 380 + WALL, 248, 547, 259)
    fillRect(r, 300, 324, 315, 339, BLACK)
    ring(r, 20, 140, 171, 259)
    const corners: Array<[number, number]> = [[146, 46], [573, 46], [573, 353], [286, 353], [286, 273], [146, 273]]
    corners.forEach(([x, y], i) => {
      const [nx, ny] = corners[(i + 1) % corners.length]
      dashed(r, x, y, nx, ny)
    })
    const d = layoutOf(r, [20, 160, 300, 380, 560], [60, 140, 260, 340], frame)
    expect(d.roofExtent?.taken).toBe(true)
    expect(d.roofExtent?.bodies.map((b) => b.role)).toEqual(['MAIN', 'WING'])
    const wing = d.roofExtent?.bodies[1]
    expect(wing?.roofedPx).toEqual({ x0: 300, y0: 260, x1: 560, y1: 340 })
    expect(wing?.rectPx).toEqual({ x0: 380, y0: 260, x1: 560, y1: 340 })
    expect(wing?.open).toHaveLength(1)
    expect(wing?.open?.[0].postsPx).toHaveLength(1)
    expect(d.roofExtent?.beyond).toHaveLength(1)
    expect(d.roofExtent?.beyond?.[0].eavesDrawnThrough).toBe(true)
    expect(sizes(d)).toEqual([[20, 10], [7, 6], [9, 4]])
  })

  it('the same plan gives the same bodies twice', () => {
    const a = layoutOf(house({ block: true, frontEaves: 'THROUGH', pergola: true, clutter: true }), XS, YS)
    const b = layoutOf(house({ block: true, frontEaves: 'THROUGH', pergola: true, clutter: true }), XS, YS)
    expect(JSON.stringify(a.masses)).toBe(JSON.stringify(b.masses))
    expect(JSON.stringify(a.roofExtent)).toBe(JSON.stringify(b.roofExtent))
  })
})
