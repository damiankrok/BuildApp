/**
 * The opening-aware envelope on synthetic plans (BUILDPLAN-ANALYZER-005C §36–§40).
 *
 * Every plan is drawn in code at 5 cm/px with 12 px (0.6 m) walls, so each
 * face, opening and post has a known position and the expected footprint is
 * arithmetic, not a hope. The fixtures are generic shapes; none is a drawing of
 * any real building.
 *
 * What is proved: an outline made of piers and openings survives, a wing is
 * built by its relations rather than by how far it reaches, and the solver does
 * NOT simply close every gap — a blank wide gap, a row of terrace posts, a
 * paving line and a decorative outline stay open.
 */
import { describe, expect, it } from 'vitest'
import { runLengthBands } from '@buildapp/source-cv'
import type { Raster } from '@buildapp/source-cv'
import { bandWallThickness, decomposePlan, exteriorTicksOf, planExtent, readWallLine, solidLayer, wallWitness } from '../src/index.js'
import type { PlanCallout, PlanDecomposition } from '../src/index.js'
import { CM_PER_PX, WALL, chain, mask, registration, sheet } from './plan.js'
import { BLACK, drawLine, fillRect } from '../../source-cv/test/draw.js'

const BANDS = { minThickness: 6, maxThickness: 30, minLength: 24 }
const WHITE: [number, number, number] = [255, 255, 255]
const M2_PER_PX2 = (CM_PER_PX / 100) ** 2

/** A wall between outer faces, inclusive, as a plan draws it: solid ink. */
const wall = (r: Raster, x0: number, y0: number, x1: number, y1: number): void => fillRect(r, x0, y0, x1, y1, BLACK)
const clear = (r: Raster, x0: number, y0: number, x1: number, y1: number): void => fillRect(r, x0, y0, x1, y1, WHITE)
/** A closed ring of walls whose OUTER faces are the rectangle given. */
function ring(r: Raster, x0: number, y0: number, x1: number, y1: number): void {
  wall(r, x0, y0, x1, y0 + WALL - 1)
  wall(r, x0, y1 - WALL + 1, x1, y1)
  wall(r, x0, y0, x0 + WALL - 1, y1)
  wall(r, x1 - WALL + 1, y0, x1, y1)
}
/** Glazing across a gap in a horizontal wall whose outer face row is `face` (the wall runs face..face±WALL). */
const glazeH = (r: Raster, top: number, from: number, to: number): void => {
  drawLine(r, from, top + 3, to, top + 3, BLACK)
  drawLine(r, from, top + WALL - 4, to, top + WALL - 4, BLACK)
}
const glazeV = (r: Raster, left: number, from: number, to: number): void => {
  drawLine(r, left + 3, from, left + 3, to, BLACK)
  drawLine(r, left + WALL - 4, from, left + WALL - 4, to, BLACK)
}
/** A free-standing post, about one and a half walls square. */
const post = (r: Raster, cx: number, cy: number): void => fillRect(r, cx - 8, cy - 8, cx + 8, cy + 8, BLACK)

type Run = { d: PlanDecomposition; builtM2: number }
/** The plan as the layout pass reads it: sheet wall, witness-checked extent, exterior ticks. */
function run(r: Raster, xs: number[], ys: number[], callouts: PlanCallout[] = [], options: { openingAware?: boolean; shutPocketMouths?: boolean } = {}): Run {
  const m = mask(r)
  const bands = runLengthBands(m, BANDS)
  const wallPx = bandWallThickness(bands, WALL)
  const chains = [chain('cx', 'HORIZONTAL', [...xs].sort((a, b) => a - b), { baselinePx: 12 }), chain('cy', 'VERTICAL', [...ys].sort((a, b) => a - b), { baselinePx: 12 })]
  const extent = planExtent(chains, bands, wallPx, wallWitness(bands, wallPx, m))
  if (!extent) throw new Error('the fixture has no frame')
  const d = decomposePlan(m, chains, bands, registration(), extent.rect, { callouts, sheetWallPx: WALL, exteriorTicks: exteriorTicksOf(chains, extent.roles), ...options })
  const builtM2 = d.cells.filter((c) => c.classification === 'BUILT').reduce((a, c) => a + (c.rect.x1 - c.rect.x0) * (c.rect.y1 - c.rect.y0), 0) * M2_PER_PX2
  return { d, builtM2 }
}
const near = (value: number, expected: number, share = 0.04): boolean => Math.abs(value - expected) <= expected * share
const builtAt = (d: PlanDecomposition, x: number, y: number): boolean => d.cells.some((c) => c.classification === 'BUILT' && x >= c.rect.x0 && x < c.rect.x1 && y >= c.rect.y0 && y < c.rect.y1)

/** The reference house: 16 × 12 m between outer faces x 40..359, y 40..279 (192 m²). */
const X = [40, 360]
const Y = [40, 280]
const HOUSE_M2 = 16 * 12

describe('§36 synthetic shapes and openings', () => {
  it('1. a rectangle with one small door: built whole, the door bridged by what lies behind it', () => {
    const r = sheet(420, 340)
    ring(r, 40, 40, 359, 279)
    clear(r, 180, 268, 197, 279)
    const { d, builtM2 } = run(r, X, Y)
    expect(near(builtM2, HOUSE_M2)).toBe(true)
    expect(d.boundary?.accepted ?? false).toBe(false)
  })

  it('2. a facade with three large windows: glazing keeps the front', () => {
    const r = sheet(420, 340)
    ring(r, 40, 40, 359, 279)
    for (const [a, b] of [[70, 119], [160, 219], [260, 319]]) {
      clear(r, a, 268, b, 279)
      glazeH(r, 268, a, b)
    }
    expect(near(run(r, X, Y).builtM2, HOUSE_M2)).toBe(true)
  })

  it('3. a facade 70 % open: piers and glazing are a facade', () => {
    const r = sheet(420, 340)
    ring(r, 40, 40, 359, 279)
    for (const [a, b] of [[64, 139], [164, 239], [264, 334]]) {
      clear(r, a, 268, b, 279)
      glazeH(r, 268, a, b)
    }
    expect(near(run(r, X, Y).builtM2, HOUSE_M2)).toBe(true)
  })

  it('4. a 5 m garage door: one leaf at the face between wall jambs is a vehicle door', () => {
    const r = sheet(420, 340)
    ring(r, 40, 40, 359, 279)
    clear(r, 150, 268, 249, 279)
    drawLine(r, 150, 277, 249, 277, BLACK)
    expect(near(run(r, X, Y).builtM2, HOUSE_M2)).toBe(true)
  })

  it('5. a corner window: glazing turning the corner keeps the corner', () => {
    const r = sheet(420, 340)
    ring(r, 40, 40, 359, 279)
    clear(r, 300, 268, 359, 279)
    clear(r, 348, 220, 359, 279)
    glazeH(r, 268, 300, 359)
    glazeV(r, 348, 220, 279)
    expect(near(run(r, X, Y).builtM2, HOUSE_M2)).toBe(true)
  })

  it('6. an attached garage with an open mouth: named, and left open in the first reading', () => {
    const r = sheet(420, 460)
    ring(r, 40, 40, 359, 279)
    // side walls running out 5 m from the front, nothing across their ends
    wall(r, 200, 268, 211, 379)
    wall(r, 348, 268, 359, 379)
    const { d } = run(r, X, [40, 280, 380])
    expect(builtAt(d, 280, 330)).toBe(false)
    expect(near(run(r, X, [40, 280, 380]).builtM2, HOUSE_M2)).toBe(true)
  })

  it('7. a projecting wing whose side walls cross the main front: its interior runs on, and it is built', () => {
    const r = sheet(420, 420)
    ring(r, 40, 40, 359, 279)
    clear(r, 212, 268, 347, 279)
    wall(r, 200, 200, 211, 339)
    wall(r, 348, 200, 359, 339)
    // the wing's front: two short piers and glazing
    wall(r, 200, 328, 229, 339)
    wall(r, 330, 328, 359, 339)
    glazeH(r, 328, 230, 329)
    const { d, builtM2 } = run(r, X, [40, 280, 340])
    expect(builtAt(d, 280, 310)).toBe(true)
    expect(near(builtM2, HOUSE_M2 + 8 * 3)).toBe(true)
  })

  it('8. a wing whose side walls start inside the main body: built by the same relation', () => {
    const r = sheet(420, 420)
    ring(r, 40, 40, 359, 279)
    clear(r, 212, 268, 347, 279)
    wall(r, 200, 150, 205, 279)
    wall(r, 200, 268, 211, 339)
    wall(r, 348, 268, 359, 339)
    wall(r, 200, 328, 229, 339)
    wall(r, 330, 328, 359, 339)
    glazeH(r, 328, 230, 329)
    const { d } = run(r, X, [40, 280, 340])
    expect(builtAt(d, 280, 310)).toBe(true)
  })

  it('9. a covered terrace on posts is not enclosed', () => {
    const r = sheet(420, 460)
    ring(r, 40, 40, 359, 279)
    post(r, 60, 380)
    post(r, 340, 380)
    drawLine(r, 52, 280, 52, 388, BLACK)
    drawLine(r, 52, 388, 348, 388, BLACK)
    drawLine(r, 348, 280, 348, 388, BLACK)
    const { d, builtM2 } = run(r, X, [40, 280, 388])
    expect(builtAt(d, 200, 330)).toBe(false)
    expect(near(builtM2, HOUSE_M2)).toBe(true)
  })

  it('10. a pergola is not enclosed', () => {
    const r = sheet(420, 460)
    ring(r, 40, 40, 359, 279)
    for (const x of [60, 200, 340]) post(r, x, 380)
    for (let x = 60; x <= 340; x += 20) drawLine(r, x, 280, x, 388, BLACK)
    const { d } = run(r, X, [40, 280, 388])
    expect(builtAt(d, 210, 330)).toBe(false)
  })

  it('11. a U-shaped recess (a loggia with a blank mouth) stays outside', () => {
    const r = sheet(420, 340)
    ring(r, 40, 40, 359, 279)
    // recess 4 m wide, 3 m deep in the front
    clear(r, 160, 268, 239, 279)
    wall(r, 148, 208, 159, 279)
    wall(r, 240, 208, 251, 279)
    wall(r, 148, 208, 251, 219)
    const { d, builtM2 } = run(r, [40, 148, 252, 360], [40, 208, 280])
    expect(builtAt(d, 200, 250)).toBe(false)
    expect(near(builtM2, HOUSE_M2 - 5.2 * 3.6, 0.05)).toBe(true)
  })

  it('12. an L-shaped house', () => {
    const r = sheet(420, 460)
    wall(r, 40, 40, 359, 51)
    wall(r, 40, 40, 51, 399)
    wall(r, 348, 40, 359, 279)
    wall(r, 200, 268, 359, 279)
    wall(r, 200, 268, 211, 399)
    wall(r, 40, 388, 211, 399)
    const { builtM2 } = run(r, [40, 212, 360], [40, 280, 400])
    expect(near(builtM2, 16 * 12 + 8.6 * 6)).toBe(true)
  })

  it('13. an exterior wall drawn only as short piers with glazing between them', () => {
    const r = sheet(420, 340)
    ring(r, 40, 40, 359, 279)
    clear(r, 52, 268, 347, 279)
    for (const x of [52, 112, 172, 232, 292]) {
      wall(r, x + 42, 268, x + 55, 279)
      glazeH(r, 268, x, x + 41)
    }
    glazeH(r, 268, 344, 347)
    expect(near(run(r, X, Y).builtM2, HOUSE_M2)).toBe(true)
  })

  it('14. one wall piece missing with nothing drawn: bridged only because the house is behind it, and named weak', () => {
    const r = sheet(420, 340)
    ring(r, 40, 40, 359, 279)
    clear(r, 348, 120, 359, 159)
    const { builtM2 } = run(r, X, Y)
    expect(near(builtM2, HOUSE_M2)).toBe(true)
  })

  it('15. a true courtyard open on one side is not closed', () => {
    const r = sheet(420, 340)
    // U: two arms and a back, courtyard 6 m wide open to the front
    wall(r, 40, 40, 359, 51)
    wall(r, 40, 40, 51, 279)
    wall(r, 348, 40, 359, 279)
    wall(r, 40, 268, 139, 279)
    wall(r, 260, 268, 359, 279)
    wall(r, 128, 140, 139, 279)
    wall(r, 260, 140, 271, 279)
    wall(r, 128, 140, 271, 151)
    const { d } = run(r, [40, 140, 260, 360], [40, 140, 280])
    expect(builtAt(d, 200, 220)).toBe(false)
  })
})

describe('§38 a wide unsupported gap is not bridged', () => {
  it('two collinear wall pieces 4.5 m apart with nothing drawn: exterior, never an opening', () => {
    const r = sheet(420, 200)
    wall(r, 20, 100, 119, 111)
    wall(r, 210, 100, 309, 111)
    const m = mask(r)
    const line = readWallLine(m, solidLayer(m, WALL), 'Y', 106, 0, 419, { wallPx: WALL, mppAlong: CM_PER_PX / 100, maxOpeningM: 3.2, maxWideOpeningM: 8 })
    const gap = line.gaps.find((g) => g.fromPx >= 110 && g.toPx <= 215)
    expect(gap).toBeDefined()
    expect(gap?.boundary).toBe('NONE')
    expect(gap?.cls).toBe('TRUE_EXTERIOR_GAP')
  })

  it('the opening-aware outline leaves a house behind such a gap open, and adopts nothing', () => {
    // The first reading still shuts a gap that would open the whole interior (03Y2G's continuity
    // hypothesis, byte for byte as before); what 005C adds must not close it on its own account.
    const r = sheet(420, 340)
    ring(r, 40, 40, 359, 279)
    clear(r, 100, 268, 199, 279)
    const { d } = run(r, X, Y)
    const outline = d.boundary?.candidates.find((c) => c.id === 'B_OPENING_AWARE_OUTLINE')
    expect(outline?.support.areaM2 ?? 0).toBeLessThan(HOUSE_M2 * 0.5)
    expect(d.boundary?.accepted).toBe(false)
    expect(d.boundary?.gaps.TRUE_EXTERIOR_GAP ?? 0).toBeGreaterThan(0)
  })
})

describe('§39 a covered terrace never becomes floor', () => {
  it('posts, a roof outline and no wall: the terrace is outside whatever area it would add', () => {
    const r = sheet(420, 480)
    ring(r, 40, 40, 359, 279)
    for (const x of [52, 200, 348]) post(r, x, 400)
    // the roof's outline, dashed, and a paving edge: line work
    for (let x = 40; x < 360; x += 12) drawLine(r, x, 410, x + 6, 410, BLACK)
    drawLine(r, 40, 280, 40, 410, BLACK)
    drawLine(r, 359, 280, 359, 410, BLACK)
    const { d, builtM2 } = run(r, X, [40, 280, 410])
    expect(builtAt(d, 200, 340)).toBe(false)
    expect(near(builtM2, HOUSE_M2)).toBe(true)
  })
})

describe('§40 a wing is built by its relations, not by its reach', () => {
  const bay = (depthPx: number): Raster => {
    const r = sheet(420, 420)
    ring(r, 40, 40, 359, 279)
    clear(r, 172, 268, 267, 279)
    wall(r, 160, 268, 171, 279 + depthPx)
    wall(r, 268, 268, 279, 279 + depthPx)
    clear(r, 172, 268 + depthPx, 267, 279 + depthPx)
    wall(r, 160, 268 + depthPx, 279, 279 + depthPx)
    clear(r, 184, 268 + depthPx, 255, 279 + depthPx)
    glazeH(r, 268 + depthPx, 184, 255)
    return r
  }

  it('a 1.0 m wing with two side walls and a glazed front: the legacy reach rule drops it, the relation builds it', () => {
    // the chain dimensions the wing, as a published plan does: its sides are ticks
    const r = bay(20)
    const legacy = run(r, [40, 160, 280, 360], [40, 280, 300], [], { openingAware: false })
    const next = run(r, [40, 160, 280, 360], [40, 280, 300])
    expect(legacy.d.bays).toHaveLength(0)
    expect(builtAt(legacy.d, 220, 290)).toBe(false)
    expect(builtAt(next.d, 220, 290)).toBe(true)
    expect(near(next.builtM2, HOUSE_M2 + 6 * 1)).toBe(true)
    expect(next.d.boundary?.extensions.filter((e) => e.accepted)).toHaveLength(1)
  })

  it('a 2.0 m decorative outline with no wall: rejected', () => {
    const r = sheet(420, 420)
    ring(r, 40, 40, 359, 279)
    drawLine(r, 160, 280, 160, 320, BLACK)
    drawLine(r, 160, 320, 280, 320, BLACK)
    drawLine(r, 280, 280, 280, 320, BLACK)
    const { d, builtM2 } = run(r, X, [40, 280, 320])
    expect(builtAt(d, 220, 300)).toBe(false)
    expect(near(builtM2, HOUSE_M2)).toBe(true)
  })
})
