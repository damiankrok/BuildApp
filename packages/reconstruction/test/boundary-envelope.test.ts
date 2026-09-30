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
import type { Raster } from '@buildapp/source-cv'
import { readWallLine, solidLayer } from '../src/index.js'
import { CM_PER_PX, WALL, mask, sheet } from './plan.js'
import { BLACK, drawLine, fillRect } from '../../source-cv/test/draw.js'
import { builtAt, clear, glazeH, glazeV, near, post, ring, run, wall } from './boundary-plan.js'
import type { Run } from './boundary-plan.js'

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

describe('§37 the same architecture drawn differently keeps its envelope', () => {
  /** How a sheet is drawn: scale, offset, ink, walls thinned, a wall stroke broken, windows left undrawn. */
  type Drawing = { s?: number; dx?: number; dy?: number; ink?: [number, number, number]; erode?: number; split?: number; noGlazing?: boolean }
  /** The wing house (§36 no. 7) under a drawing: its front piers and glazing, the wing's glazed front. */
  function wingHouse(t: Drawing): { r: Raster; xs: number[]; ys: number[]; cmPerPx: number; wallPx: number } {
    const s = t.s ?? 1
    const dx = t.dx ?? 0
    const dy = t.dy ?? 0
    const e = t.erode ?? 0
    const ink = t.ink ?? BLACK
    const X = (x: number): number => Math.round(dx + x * s)
    const Y = (y: number): number => Math.round(dy + y * s)
    const r = sheet(Math.round(460 * s + dx + 20), Math.round(420 * s + dy + 20))
    const box = (x0: number, y0: number, x1: number, y1: number): void => fillRect(r, X(x0) + e, Y(y0) + e, X(x1) - e, Y(y1) - e, ink)
    const white = (x0: number, y0: number, x1: number, y1: number): void => fillRect(r, X(x0), Y(y0), X(x1), Y(y1), [255, 255, 255])
    const glaze = (top: number, from: number, to: number): void => {
      if (t.noGlazing) return
      drawLine(r, X(from), Y(top + 3), X(to), Y(top + 3), ink)
      drawLine(r, X(from), Y(top + WALL - 4), X(to), Y(top + WALL - 4), ink)
    }
    box(40, 40, 359, 51)
    box(40, 40, 51, 279)
    box(348, 40, 359, 279)
    box(40, 268, 211, 279)
    box(200, 200, 211, 339)
    box(348, 268, 359, 339)
    box(200, 328, 229, 339)
    box(330, 328, 359, 339)
    glaze(328, 230, 329)
    // a front window of the main body, glazed
    white(90, 268, 150, 279)
    glaze(268, 90, 150)
    // one exterior stroke (the west wall) broken into `split` pieces by 2 px of white
    for (let k = 1; k < (t.split ?? 1); k += 1) {
      const y = 40 + Math.round((240 * k) / (t.split ?? 1))
      fillRect(r, X(40), Y(y), X(51), Y(y) + 1, [255, 255, 255])
    }
    return { r, xs: [40, 200, 360].map(X), ys: [40, 280, 340].map(Y), cmPerPx: CM_PER_PX / s, wallPx: Math.max(4, Math.round(WALL * s) - 2 * e) }
  }
  const readingOf = (t: Drawing, shutPocketMouths = false): Run => {
    const w = wingHouse(t)
    return run(w.r, w.xs, w.ys, [], { cmPerPx: w.cmPerPx, sheetWallPx: w.wallPx, shutPocketMouths })
  }
  const areaOf = (t: Drawing): number => readingOf(t).builtM2
  const reference = HOUSE_M2 + 8 * 3

  it('reads the reference drawing', () => {
    expect(near(areaOf({}), reference)).toBe(true)
  })
  it.each<[string, Drawing]>([
    ['one exterior stroke split into 2 pieces', { split: 2 }],
    ['one exterior stroke split into 5 pieces', { split: 5 }],
    ['a mild downscale (0.85)', { s: 0.85 }],
    ['walls eroded by 1 px on each face', { erode: 1 }],
    ['grey ink instead of black', { ink: [90, 90, 90] }],
    ['cropped and padded differently', { dx: 17, dy: 9 }],
  ])('%s: the same envelope', (_what, drawing) => {
    expect(near(areaOf(drawing), reference, 0.05)).toBe(true)
  })
  it('window symbols removed, jambs kept: the wing is named, and the reading that shuts its mouth recovers the envelope', () => {
    // With nothing drawn across it the wing's 5 m front is a blank gap: the first reading cannot tell it from a
    // loggia's mouth, and the house behind its open junction goes with it. That is a question, not a building: the
    // wing is named an open-mouthed garage, and the resolver's reading that shuts pocket mouths reads it whole.
    const first = readingOf({ noGlazing: true })
    expect((first.d.boundary?.bodies ?? []).map((b) => b.relation)).toContain('OPEN_MOUTH_GARAGE')
    const shut = readingOf({ noGlazing: true }, true)
    expect(near(shut.builtM2, reference, 0.05)).toBe(true)
  })
})

