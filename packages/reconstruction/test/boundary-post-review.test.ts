/**
 * 005C post-implementation review (boundary and bodies): the cases the four
 * reviewers built to make the opening-aware outline build what is not there,
 * or drop what is. Each fixture is the structure only — synthetic plans at
 * 5 cm/px with 0.6 m walls, no drawing of any real building.
 */
import { describe, expect, it } from 'vitest'
import { readWallLine, recutSlivers, solidLayer, planBodies } from '../src/index.js'
import type { PlanDecomposition } from '../src/index.js'
import { BLACK, drawLine } from '../../source-cv/test/draw.js'
import { WALL, mask, sheet } from './plan.js'
import { builtAt, clear, glazeH, near, post, ring, run, wall } from './boundary-plan.js'

const HOUSE_M2 = 16 * 12
const X = [40, 360]
const lineOpts = { wallPx: WALL, mppAlong: 0.05, maxOpeningM: 3.2, maxWideOpeningM: 8 }
/** The gaps a horizontal wall line reads, one fixture per call. */
const gapsOn = (r: ReturnType<typeof sheet>, y: number) => {
  const m = mask(r)
  return readWallLine(m, solidLayer(m, WALL), 'Y', y, 0, r.width - 1, lineOpts).gaps
}
/** A facade y = 100..111 with a gap between two stretches of wall. */
const facade = (from: number, to: number) => {
  const r = sheet(420, 220)
  wall(r, 20, 100, from - 1, 111)
  wall(r, to + 1, 100, 399, 111)
  return r
}
/** The §36 no. 7 wing: a house 16 × 12 m, a wing 8 × 3 m in front with a glazed front between short piers. */
const wingHouse = () => {
  const r = sheet(420, 460)
  ring(r, 40, 40, 359, 279)
  clear(r, 212, 268, 347, 279)
  wall(r, 200, 200, 211, 339)
  wall(r, 348, 200, 359, 339)
  wall(r, 200, 328, 229, 339)
  wall(r, 330, 328, 359, 339)
  glazeH(r, 328, 230, 329)
  return r
}
const WING_M2 = HOUSE_M2 + 23.175

describe('line work across a gap is not infill (B P0-1, A P0-2)', () => {
  it('a paving line on the face row or just outside it, running past both jambs, opens nothing', () => {
    for (const y of [111, 113]) {
      const r = facade(120, 199)
      drawLine(r, 0, y, 419, y, BLACK)
      // never a drawn opening: a question at most (WEAK), which the pocket rule decides by what lies behind it
      const [g] = gapsOn(r, 106)
      expect(g.cls).not.toBe('OPENING_SUPPORTED')
      expect(g.boundary).not.toBe('STRONG')
    }
  })

  it('a pattern the gap sits in — tiles or treads, beyond the wall on both sides — is not glazing', () => {
    const tiles = facade(120, 199)
    for (let y = 94; y <= 118; y += 6) drawLine(tiles, 120, y, 199, y, BLACK)
    const treads = facade(120, 199)
    for (let y = 96; y <= 116; y += 5) drawLine(treads, 120, y, 199, y, BLACK)
    expect(gapsOn(tiles, 106)[0].signature).not.toBe('GLAZING')
    expect(gapsOn(treads, 106)[0].signature).not.toBe('GLAZING')
  })

  it('a dimension line on the axis past the end of the wall is not a door leaf', () => {
    const r = facade(150, 169)
    drawLine(r, 0, 106, 419, 106, BLACK)
    expect(gapsOn(r, 106)[0].cls).not.toBe('OPENING_SUPPORTED')
  })

  it('glazing between stretches of wall is still glazing, and a slab edge that stops at the jambs still reads like a vehicle door', () => {
    const glazed = facade(120, 199)
    drawLine(glazed, 120, 103, 199, 103, BLACK)
    drawLine(glazed, 120, 108, 199, 108, BLACK)
    expect(gapsOn(glazed, 106)[0]).toMatchObject({ signature: 'GLAZING', boundary: 'STRONG' })
    const edge = facade(120, 199)
    drawLine(edge, 120, 110, 199, 110, BLACK)
    expect(gapsOn(edge, 106)[0]).toMatchObject({ signature: 'LEAF_FACE', boundary: 'STRONG' })
  })

  it('two lines between two free-standing posts are a pergola’s or a rail’s, not a facade’s glazing (B P1-4)', () => {
    const r = sheet(420, 220)
    post(r, 100, 106)
    post(r, 176, 106)
    drawLine(r, 108, 103, 167, 103, BLACK)
    drawLine(r, 108, 108, 167, 108, BLACK)
    for (const g of gapsOn(r, 106)) expect(g.boundary).toBe('NONE')
  })

  it('a terrace fronted by a paving edge beside an accepted wing is not built', () => {
    const r = wingHouse()
    wall(r, 40, 268, 51, 339)
    drawLine(r, 20, 339, 440, 339, BLACK)
    const { d, builtM2 } = run(r, X, [40, 280, 340])
    expect(builtAt(d, 280, 310)).toBe(true)
    expect(builtAt(d, 120, 310)).toBe(false)
    expect(near(builtM2, WING_M2, 0.01)).toBe(true)
  })
})

describe('an extension grows only through open edges and doorways (A P0-1, B P0-2)', () => {
  it('a walled yard with a gate, against the wing’s solid side wall, does not ride in with the wing', () => {
    const r = wingHouse()
    wall(r, 120, 268, 131, 399)
    wall(r, 200, 339, 211, 399)
    wall(r, 120, 388, 145, 399)
    wall(r, 186, 388, 211, 399)
    const { d, builtM2 } = run(r, [40, 120, 360], [40, 280, 340, 400])
    expect(builtAt(d, 280, 310)).toBe(true)
    expect(builtAt(d, 160, 310)).toBe(false)
    expect(builtAt(d, 160, 370)).toBe(false)
    expect(builtM2).toBeLessThan(WING_M2 + 2)
    expect(d.boundary?.extensions.some((e) => !e.accepted)).toBe(true)
  })
})

describe('an adopted outline never drops a cell the box built (A P0-3)', () => {
  it('a thin line across the wing’s junction lets the box build its back rooms; the wing adds to them, never replaces them', () => {
    const D = 140
    const r = sheet(420, 600)
    ring(r, 40, 40 + D, 359, 279 + D)
    wall(r, 40, 80 + D, 359, 91 + D)
    clear(r, 180, 80 + D, 199, 91 + D)
    clear(r, 212, 268 + D, 347, 279 + D)
    drawLine(r, 212, 274 + D, 347, 274 + D, BLACK)
    wall(r, 200, 200 + D, 211, 339 + D)
    wall(r, 348, 200 + D, 359, 339 + D)
    wall(r, 200, 328 + D, 229, 339 + D)
    wall(r, 330, 328 + D, 359, 339 + D)
    glazeH(r, 328 + D, 230, 329)
    // a walled yard behind the house: rejected, and it must not pad the outline past the box's own area
    wall(r, 40, 50, 51, 191)
    wall(r, 139, 50, 150, 191)
    wall(r, 40, 50, 65, 61)
    wall(r, 125, 50, 150, 61)
    const { d, builtM2 } = run(r, [40, 150, 360], [50, 40 + D, 280 + D, 340 + D])
    expect(builtAt(d, 60, 60 + D)).toBe(true)
    expect(builtAt(d, 150, 200 + D)).toBe(true)
    expect(builtM2).toBeGreaterThanOrEqual(HOUSE_M2 - 1)
  })
})

describe('bodies are named against the building this reading cuts (B P1-6, C P1-7)', () => {
  it('a 3 × 3 m terrace between a garden wall and an accepted wing is no garage, and the reading that shuts mouths does not build it', () => {
    const terrace = () => {
      const r = wingHouse()
      wall(r, 140, 268, 151, 339)
      return r
    }
    const first = run(terrace(), [40, 140, 360], [40, 280, 340])
    expect((first.d.boundary?.bodies ?? []).map((b) => b.relation)).not.toContain('OPEN_MOUTH_GARAGE')
    const shut = run(terrace(), [40, 140, 360], [40, 280, 340], [], { shutPocketMouths: true })
    expect(builtAt(shut.d, 170, 310)).toBe(false)
  })
})

describe('mass making on an outline frame (C P0-1, C P0-2)', () => {
  it('a U-shaped outline is not inflated across its courtyard', () => {
    // two wings in front of a 16 × 12 m house, each continuing its interior, a 4.6 × 3 m courtyard between them open
    // to the south: the plan is cut on the outline, and the courtyard is ground a U wraps, not a pocket of one body
    const r = sheet(420, 460)
    ring(r, 40, 40, 359, 279)
    clear(r, 72, 268, 147, 279)
    clear(r, 252, 268, 327, 279)
    wall(r, 60, 200, 71, 339)
    wall(r, 148, 200, 159, 339)
    wall(r, 60, 328, 79, 339)
    wall(r, 140, 328, 159, 339)
    glazeH(r, 328, 80, 139)
    wall(r, 240, 200, 251, 339)
    wall(r, 328, 200, 339, 339)
    wall(r, 240, 328, 259, 339)
    wall(r, 320, 328, 339, 339)
    glazeH(r, 328, 260, 319)
    const { d } = run(r, X, [40, 280, 340])
    expect(d.envelope?.outline).toBeDefined()
    const courtyard = { x: 200, y: 310 }
    expect(builtAt(d, courtyard.x, courtyard.y)).toBe(false)
    const bodies = planBodies(d)
    expect(bodies.length).toBeGreaterThanOrEqual(3)
    for (const b of bodies) expect(courtyard.x >= b.rect.x0 && courtyard.x < b.rect.x1 && courtyard.y >= b.rect.y0 && courtyard.y < b.rect.y1).toBe(false)
  })

  it('a strip is joined to a neighbour only along its whole side: no cut is made where nothing is drawn', () => {
    const cell = (ix: number, iy: number, x0: number, y0: number, x1: number, y1: number) => ({ ix, iy, rect: { x0, y0, x1, y1 }, classification: 'BUILT' as const, edges: [] as never[] })
    // a 3 × 2 grid: the house is the whole top row and the middle of the bottom row; the bottom middle is a 0.5 m strip
    const cells = [cell(0, 0, 0, 0, 100, 100), cell(1, 0, 100, 0, 200, 100), cell(2, 0, 200, 0, 300, 100), cell(1, 1, 100, 100, 200, 110)]
    const region = (id: string, cs: typeof cells, rect: { x0: number; y0: number; x1: number; y1: number }) => ({ id, classification: 'BUILT' as const, rect, metric: { x0: 0, z0: 0, x1: 0, z1: 0 }, cells: cs.map((c) => ({ ix: c.ix, iy: c.iy })), confidence: 0.9, why: '' })
    const house = region('house', cells.slice(0, 3), { x0: 0, y0: 0, x1: 300, y1: 100 })
    const strip = region('strip', cells.slice(3), { x0: 100, y0: 100, x1: 200, y1: 110 })
    const decomposition = { cells } as unknown as PlanDecomposition
    const registration = { originPx: { x: 0, y: 0 }, metresPerPixelX: 0.05, metresPerPixelY: 0.05 } as never
    const out = recutSlivers([house, strip], decomposition, registration, 1)
    // the strip runs along part of the house's side: the house is not cut in three around it
    expect(out.map((r) => r.id).sort()).toEqual(['house', 'strip'])
  })
})
