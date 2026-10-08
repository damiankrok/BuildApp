/**
 * Compound facade spans (BUILDPLAN-ANALYZER-005N): a recessed entrance and a garage door on one facade line are two
 * mouths, not one — and a carport, a loggia, an open porch or a passage stays open however its neighbour is read.
 *
 * Every family is a synthetic plan drawn the way a plan draws it (5 cm/px, 12 px = 0.6 m walls, chains on the overall
 * dimensions only, so the grid has no line at a return or a set-back wall unless a wall band makes one). Ground truth
 * comes from how each family is drawn, never from a published figure. The major families run in five orientations
 * (`TRANSFORMS`): as drawn, mirrored both ways and turned a quarter either way, and must answer the same. Nothing here
 * is a drawing of any real building.
 */
import { describe, expect, it } from 'vitest'
import { runLengthBands } from '@buildapp/source-cv'
import { BANDS, wall } from './boundary-plan.js'
import { PlanDrawing, TRANSFORMS, runScene } from './transforms.js'
import type { Scene } from './transforms.js'
import { WALL, chain, mask, sheet, walls } from './plan.js'
import { bandWallThickness, planExtent } from '../src/index.js'
import type { CompoundFacadeSpan, PlanCallout, PlanDecomposition } from '../src/index.js'

const W = 460
const H = 400
/** The facade (the plan's bottom) runs along rows 268..279: a 16 × 12 m house, outer faces x 40..359, y 40..279. */
const FRONT = 268
const house = (): PlanDrawing => new PlanDrawing(W, H).ring(40, 40, 359, 279)
/** A 12 px wall from row `top` down through the facade. */
const returnAt = (p: PlanDrawing, x: number, top: number): PlanDrawing => p.wall(x, top, x + WALL - 1, 279)
/** A horizontal wall whose top face is row `y`. */
const wallH = (p: PlanDrawing, a: number, b: number, y: number): PlanDrawing => p.wall(a, y, b, y + WALL - 1)
/** A door in a horizontal wall: the gap, its leaf on the axis. */
const doorH = (p: PlanDrawing, a: number, b: number, y: number): PlanDrawing => p.clear(a, y, b, y + WALL - 1).line(a, y + 5, b, y + 5)
/** A vehicle door drawn across a facade gap: one line at the outer face. */
const vehicleDoor = (p: PlanDrawing, a: number, b: number): PlanDrawing => p.line(a, 276, b, 276)
/** Glazing across a facade gap: two lines inside the wall's thickness. */
const glazeFront = (p: PlanDrawing, a: number, b: number): PlanDrawing => p.line(a, FRONT + 3, b, FRONT + 3).line(a, FRONT + 8, b, FRONT + 8)
const scene = (p: PlanDrawing, callouts: PlanCallout[] = []): Scene => ({ p, xs: [40, 360], ys: [40, 280], callouts })

/**
 * The target topology: the recessed entrance (mouth x 120..179, 3 m; returns at 108 and 180; back wall at rows
 * 228..239 with a 1 m door; the hall behind it up to row 150), and beside it, past the separator (the recess's right
 * return, which runs on as the garage's left wall), a garage door x 192..251 (3 m) into a 3 m × 6.5 m garage whose
 * right wall is at 252 and whose back wall has a door into the house.
 */
function entranceAndGarage(opts: { garage?: 'DOOR' | 'BLANK'; garageRight?: number; backDoor?: boolean } = {}): PlanDrawing {
  const right = opts.garageRight ?? 252
  const p = house()
  p.clear(120, FRONT, right - 1, 279)
  returnAt(p, 108, 150) // the recess's left return, running on as the hall's wall
  returnAt(p, 180, 150) // the separator: the recess's right return, the garage's left wall
  wallH(p, 108, 191, 228) // the recess's set-back wall: the house's front there
  if (opts.backDoor !== false) doorH(p, 135, 155, 228) // the entrance door in it
  wallH(p, 108, right + WALL - 1, 150) // the hall's and the garage's back wall
  returnAt(p, right, 150) // the garage's right wall
  doorH(p, 210, 225, 150) // a door from the garage into the house
  if ((opts.garage ?? 'DOOR') === 'DOOR') vehicleDoor(p, 192, right - 1)
  return p
}

const spansOf = (d: PlanDecomposition): CompoundFacadeSpan[] => d.compoundFacades ?? []
const rolesOf = (d: PlanDecomposition): string[] => spansOf(d).flatMap((s) => s.intervals.map((i) => i.role)).sort()
const acceptedOf = (d: PlanDecomposition): string[] => spansOf(d).flatMap((s) => s.separators.filter((x) => x.accepted).map((x) => x.kind)).sort()

describe('005N §21 — recessed entrance beside a garage: two mouths of one body', () => {
  it('1–2. recess + separator + garage door drawn: the recess stays a recess, the garage and the hall behind the entrance are built (every orientation)', () => {
    for (const t of TRANSFORMS) {
      const r = runScene(scene(entranceAndGarage()), t)
      expect(acceptedOf(r.d), t).toEqual(['WALL_RETURN'])
      expect(rolesOf(r.d), t).toEqual(['OPENING_IN_WALL', 'RECESS_MOUTH'])
      expect(r.classAt(150, 255), `${t}: the recess`).toBe('RECESS')
      expect(r.builtAt(150, 200), `${t}: the hall behind the entrance`).toBe(true)
      expect(r.builtAt(222, 210), `${t}: the garage`).toBe(true)
      expect(r.builtAt(300, 150), `${t}: the living room`).toBe(true)
      expect(r.builtAt(70, 250), `${t}: the front room`).toBe(true)
    }
  })

  it('the recess is linked to its set-back wall: a grid line on it, its span shut, its depth and returns on the record', () => {
    const r = runScene(scene(entranceAndGarage()), 'id')
    const recess = spansOf(r.d)[0].intervals.find((i) => i.role === 'RECESS_MOUTH')
    expect(recess?.recess?.depthM).toBeGreaterThan(1.5)
    expect(recess?.recess?.depthM).toBeLessThan(2.5)
    expect(recess?.recess?.returns.every((m) => m >= 2)).toBe(true)
    expect(r.d.linesY.some((l) => Math.abs(l.px - (recess?.recess?.gridLinePx ?? -1)) < 1e-6)).toBe(true)
  })

  it('the garage door blank: the garage is not fabricated — open in the first reading — while the recess and the hall stand', () => {
    for (const t of TRANSFORMS) {
      const r = runScene(scene(entranceAndGarage({ garage: 'BLANK' })), t)
      expect(rolesOf(r.d), t).toEqual(['OPEN_SIDE', 'RECESS_MOUTH'])
      expect(r.builtAt(222, 210), `${t}: a blank garage mouth`).toBe(false)
      expect(r.classAt(150, 255), t).toBe('RECESS')
      expect(r.builtAt(150, 200), t).toBe(true)
    }
  })

  it('3 + 17. recess + double garage (5 m door): a 8.6 m parent, wider than any opening, cut into mouths each within reach', () => {
    for (const t of TRANSFORMS) {
      const r = runScene(scene(entranceAndGarage({ garageRight: 292 })), t)
      const span = spansOf(r.d)[0]
      expect(span.widthM, t).toBeGreaterThan(8)
      expect(rolesOf(r.d), t).toEqual(['OPENING_IN_WALL', 'RECESS_MOUTH'])
      expect(r.builtAt(242, 210), `${t}: the double garage`).toBe(true)
      expect(r.classAt(150, 255), t).toBe('RECESS')
    }
  })

  it('4. recess + a glazed window: the window is an opening in its own wall, the recess open', () => {
    const p = house()
    p.clear(120, FRONT, 251, 279)
    returnAt(p, 108, 150)
    returnAt(p, 180, 150)
    wallH(p, 108, 191, 228)
    doorH(p, 135, 155, 228)
    wallH(p, 108, 263, 150)
    returnAt(p, 252, 150)
    glazeFront(p, 192, 251)
    for (const t of TRANSFORMS) {
      const r = runScene(scene(p), t)
      expect(rolesOf(r.d), t).toEqual(['OPENING_IN_WALL', 'RECESS_MOUTH'])
      expect(r.builtAt(222, 210), t).toBe(true)
      expect(r.classAt(150, 255), t).toBe('RECESS')
    }
  })
})

describe('005N §21 — separators: structural ink only', () => {
  it('5. two openings separated by a real pier (1 m, shorter than a wall band, tied to a partition): two openings in one wall', () => {
    const p = house()
    p.clear(120, FRONT, 235, 279)
    p.wall(168, FRONT, 187, 279) // the pier: 1 m of wall along the facade
    p.wall(172, 248, 183, 279) // tied into a 1.6 m stub of partition behind it: one wall body, too short to be a return
    glazeFront(p, 120, 167)
    glazeFront(p, 188, 235)
    for (const t of TRANSFORMS) {
      const r = runScene(scene(p), t)
      expect(acceptedOf(r.d).length, t).toBe(1)
      expect(rolesOf(r.d), t).toEqual(['OPENING_IN_WALL', 'OPENING_IN_WALL'])
      expect(r.builtAt(140, 250), t).toBe(true)
      expect(r.builtAt(210, 250), t).toBe(true)
    }
  })

  it('6. two openings with only a mullion between them: no separator — a thin line is not wall-thick', () => {
    const p = house()
    p.clear(120, FRONT, 299, 279)
    glazeFront(p, 120, 299)
    p.line(210, FRONT, 210, 279) // the mullion
    const r = runScene(scene(p), 'id')
    expect(spansOf(r.d)).toHaveLength(0)
    expect(r.builtAt(200, 250)).toBe(true)
  })

  it('19. a dimension line, a leader and hatching across the span make no separator', () => {
    const p = entranceAndGarage()
    p.line(100, 300, 300, 300) // a dimension line outside
    p.line(160, 330, 200, 262) // a leader crossing the facade near the separator
    for (let k = 0; k < 8; k += 1) p.line(122 + k * 7, 244, 128 + k * 7, 266) // hatching in the recess
    for (const t of TRANSFORMS) {
      const r = runScene(scene(p), t)
      expect(acceptedOf(r.d), t).toEqual(['WALL_RETURN'])
      expect(r.classAt(150, 255), t).not.toBe('BUILT')
      expect(r.builtAt(222, 210), t).toBe(true)
    }
  })

  it('20. a block of furniture standing on the facade line is a post, not a separator', () => {
    const p = house()
    p.clear(120, FRONT, 219, 279)
    p.wall(164, 266, 175, 277) // a bin, a bollard: a free-standing block on the line
    const r = runScene(scene(p), 'id')
    const refused = spansOf(r.d).flatMap((s) => s.separators)
    expect(refused.filter((x) => x.accepted)).toHaveLength(0)
    expect(spansOf(r.d)).toHaveLength(0)
  })

  it('21. a narrow wall-thick return (0.6 m) still separates two mouths', () => {
    for (const t of TRANSFORMS) {
      const r = runScene(scene(entranceAndGarage()), t)
      const sep = spansOf(r.d)[0].separators.find((x) => x.accepted)
      expect(sep?.kind, t).toBe('WALL_RETURN')
      expect((sep?.toPx ?? 0) - (sep?.fromPx ?? 0), t).toBeLessThanOrEqual(WALL + 1)
    }
  })
})

describe('005N §21 — open sides stay open', () => {
  /** The recess, then past its return a carport: walled behind (the house) and on its far side, open at its mouth, nothing drawn across. */
  function entranceAndCarport(): PlanDrawing {
    const p = house()
    p.clear(120, FRONT, 259, 279)
    returnAt(p, 108, 150)
    returnAt(p, 180, 150)
    wallH(p, 108, 191, 228)
    doorH(p, 135, 155, 228)
    wallH(p, 180, 271, 160) // the house wall behind the carport, a car's length (5.5 m) in
    returnAt(p, 260, 160) // the carport's far side: a storage wall
    return p
  }

  it('7. a genuine carport beside a recessed entrance stays outside', () => {
    for (const t of TRANSFORMS) {
      const r = runScene(scene(entranceAndCarport()), t)
      expect(rolesOf(r.d), t).toEqual(['OPEN_SIDE', 'RECESS_MOUTH'])
      expect(r.builtAt(220, 230), `${t}: the carport`).toBe(false)
      expect(r.classAt(150, 255), t).toBe('RECESS')
      expect(r.builtAt(300, 120), t).toBe(true)
    }
  })

  it('8. an open porch beside a garage — its roof on posts standing in front of the facade: the porch stays open, the garage built', () => {
    const p = entranceAndGarage()
    p.wall(112, 320, 127, 335).wall(172, 320, 187, 335) // the porch roof's posts, 2 m in front of the facade
    p.line(104, 342, 196, 342) // the porch slab's edge
    for (const t of TRANSFORMS) {
      const r = runScene(scene(p), t)
      expect(rolesOf(r.d), t).toEqual(['OPENING_IN_WALL', 'RECESS_MOUTH'])
      expect(r.classAt(150, 255), t).toBe('RECESS')
      expect(r.builtAt(150, 300), `${t}: under the porch roof`).toBe(false)
      expect(r.builtAt(222, 210), t).toBe(true)
    }
  })

  it('a post standing IN a mouth is no separator (the per-edge width convention around it is pre-existing and unchanged)', () => {
    const p = entranceAndGarage()
    p.wall(144, 268, 155, 279)
    const r = runScene(scene(p), 'id')
    expect(spansOf(r.d).flatMap((x) => x.separators).filter((x) => x.accepted).map((x) => x.kind)).toEqual(['WALL_RETURN'])
    expect(r.builtAt(222, 210)).toBe(true)
  })

  it('9. a loggia beside a large glazed opening: the loggia open, the glazing an opening', () => {
    const p = house()
    p.clear(120, FRONT, 279, 279)
    returnAt(p, 108, 150)
    returnAt(p, 180, 150)
    wallH(p, 108, 191, 228)
    p.clear(124, 228, 175, 239).line(124, 231, 175, 231).line(124, 236, 175, 236) // the loggia's back: glazed
    glazeFront(p, 192, 279)
    for (const t of TRANSFORMS) {
      const r = runScene(scene(p), t)
      expect(rolesOf(r.d), t).toEqual(['OPENING_IN_WALL', 'RECESS_MOUTH'])
      expect(r.classAt(150, 255), t).toBe('RECESS')
      expect(r.builtAt(240, 250), t).toBe(true)
    }
  })

  it('a covered terrace beside a window: its far end only a thin beam, an overhead line across it — the window an opening, the terrace open', () => {
    const p = house()
    p.clear(120, FRONT, 359, 279).clear(348, 160, 359, 279) // the facade stops: the terrace runs to the corner
    returnAt(p, 180, 150) // the window's room ends on a return; the terrace lies beyond it
    glazeFront(p, 120, 179)
    wallH(p, 192, 359, 150) // the house wall behind the terrace, 6 m in
    p.wall(262, FRONT + 2, 290, FRONT + 6) // a thin beam on the line (not wall-thick)
    for (let x = 192; x < 359; x += 13) p.line(x, FRONT + 9, Math.min(x + 8, 359), FRONT + 9) // the roof's dashed edge
    for (const t of TRANSFORMS) {
      const r = runScene(scene(p), t)
      expect(r.builtAt(150, 250), `${t}: the room behind the window`).toBe(true)
      expect(r.builtAt(230, 230), `${t}: the covered terrace`).toBe(false)
    }
  })

  it('15. a recess with no back wall is a passage through: open, whatever is beside it', () => {
    const p = house()
    p.clear(120, FRONT, 263, 279)
    p.clear(120, 40, 191, 51) // the rear wall open too, 3.6 m — wider than a door: a passage through the house
    returnAt(p, 108, 40)
    returnAt(p, 192, 40)
    wallH(p, 204, 275, 150)
    returnAt(p, 264, 150)
    vehicleDoor(p, 204, 263)
    for (const t of TRANSFORMS) {
      const r = runScene(scene(p), t)
      expect(spansOf(r.d)[0].intervals.some((i) => i.role === 'RECESS_MOUTH'), t).toBe(false)
      expect(r.builtAt(150, 160), `${t}: the passage`).toBe(false)
      expect(r.builtAt(234, 210), `${t}: the garage`).toBe(true)
    }
  })

  it('16. a corner recess (open on its side) stays outside', () => {
    const p = house()
    p.clear(280, FRONT, 359, 279).clear(348, 220, 359, 279)
    wallH(p, 268, 359, 208)
    returnAt(p, 268, 208)
    const r = runScene(scene(p), 'id')
    expect(r.builtAt(320, 250)).toBe(false)
    expect(r.builtAt(150, 150)).toBe(true)
  })
})

describe('005N §21 — recesses need the drawing to make them one', () => {
  it('13. a recess with both returns and a back wall: RECESS_MOUTH, never shut by its own mouth', () => {
    const r = runScene(scene(entranceAndGarage()), 'id')
    const recess = spansOf(r.d)[0].intervals.find((i) => i.recess)
    expect(recess?.role).toBe('RECESS_MOUTH')
  })

  it('14. one return missing: no recess — the mouth leads into the house, which stays enclosed', () => {
    const p = house()
    p.clear(120, FRONT, 251, 279)
    returnAt(p, 180, 150) // the separator
    wallH(p, 120, 191, 228) // a "back wall", but no return on the mouth's outer side: the front room runs on into it
    doorH(p, 135, 155, 228)
    wallH(p, 180, 263, 150)
    returnAt(p, 252, 150)
    vehicleDoor(p, 192, 251)
    for (const t of TRANSFORMS) {
      const r = runScene(scene(p), t)
      expect(spansOf(r.d)[0].intervals, t).toHaveLength(2)
      expect(spansOf(r.d)[0].intervals.some((i) => i.role === 'RECESS_MOUTH'), t).toBe(false)
      expect(r.builtAt(70, 200), `${t}: the front room`).toBe(true)
      expect(r.builtAt(150, 200), `${t}: the room behind the mouth`).toBe(true)
    }
  })

  it('18. a set-back door callout near the recess mouth does not shut the recess, and does not cross the separator to the garage', () => {
    // the callout prints 300 cm, the width of both mouths; it stands at the recess
    const callouts: PlanCallout[] = [{ id: 'c-recess', at: { x: 150, y: 292 }, widthsCm: [{ value: 300, confidence: 0.7 }] }]
    for (const t of TRANSFORMS) {
      const r = runScene(scene(entranceAndGarage({ garage: 'BLANK' }), callouts), t)
      const intervals = spansOf(r.d)[0].intervals
      const recess = intervals.find((i) => i.role === 'RECESS_MOUTH')
      const garage = intervals.find((i) => i.role !== 'RECESS_MOUTH')
      expect(recess?.evidence.callout?.id, t).toBe('c-recess')
      expect(garage?.evidence.callout, t).toBeUndefined()
      expect(r.classAt(150, 255), t).toBe('RECESS')
      expect(r.builtAt(222, 210), `${t}: the blank garage, with no callout of its own`).toBe(false)
    }
  })

  it('11. a blank garage mouth with its own callout, walled on both sides: an opening in its own wall', () => {
    const callouts: PlanCallout[] = [{ id: 'c-garage', at: { x: 222, y: 292 }, widthsCm: [{ value: 300, confidence: 0.6 }] }]
    for (const t of TRANSFORMS) {
      const r = runScene(scene(entranceAndGarage({ garage: 'BLANK' }), callouts), t)
      expect(rolesOf(r.d), t).toEqual(['OPENING_IN_WALL', 'RECESS_MOUTH'])
      expect(r.builtAt(222, 210), t).toBe(true)
    }
  })
})

describe('005N §21 — bays (10–12) keep their own reading', () => {
  function withBay(front: 'NOTHING' | 'DOOR'): PlanDrawing {
    const p = new PlanDrawing(W, 480).ring(40, 40, 359, 279)
    p.clear(112, FRONT, 219, 279)
    p.wall(100, 268, 111, 388).wall(220, 268, 231, 388)
    if (front === 'DOOR') p.wall(100, 389, 131, 400).wall(200, 389, 231, 400).line(132, 392, 199, 392)
    return p
  }
  it('10. a garage bay with its door drawn is built; 12. an open carport bay stays outside', () => {
    const shut = runScene({ p: withBay('DOOR'), xs: [40, 100, 232, 360], ys: [40, 280, 400] }, 'id')
    expect(shut.d.bays[0]?.mouth.decision).toBe('OPENING_IN_WALL')
    expect(shut.builtAt(166, 340)).toBe(true)
    const open = runScene({ p: withBay('NOTHING'), xs: [40, 100, 232, 360], ys: [40, 280, 400] }, 'id')
    expect(open.d.bays[0]?.mouth.decision).toBe('OPEN_SIDE')
    expect(open.builtAt(166, 340)).toBe(false)
  })
})

describe('005N §21.22 — the extent: an attached wing is joined by its walls, a detached garage is not', () => {
  /**
   * The walls frame this plan: its only chains measure the rooms inside (ticks on the inner faces of x 40..200 and of
   * the depth), so every outer wall lies outside the chains' rect and the frame is the walls' (the weak branch). A
   * garage stands beyond the chains' margin: detached 3 m clear of the house, or attached, the house's front wall
   * running on into its corner.
   */
  function extentOf(attached: boolean): { x1: number; why: string } {
    const r = sheet(700, 420)
    walls(r, 40, 40, 359, 279)
    // detached: set back from the house's front line, so no wall line of the house runs on into it
    walls(r, 420, attached ? 40 : 70, 619, attached ? 259 : 289)
    if (attached) wall(r, 359, 40, 420, 51)
    const m = mask(r)
    const bands = runLengthBands(m, BANDS)
    const wallPx = bandWallThickness(bands, WALL)
    const chains = [chain('cx', 'HORIZONTAL', [52, 120, 200], { baselinePx: 12 }), chain('cy', 'VERTICAL', [52, 160, 268], { baselinePx: 12 })]
    const extent = planExtent(chains, bands, wallPx)
    if (!extent) throw new Error('no extent')
    return { x1: extent.rect.x1, why: extent.why }
  }
  it('22. a detached garage nearby is not joined; the same garage with the house wall running into its corner is', () => {
    const detached = extentOf(false)
    expect(detached.x1).toBeLessThan(420)
    const attached = extentOf(true)
    expect(attached.x1).toBeGreaterThan(600)
    expect(attached.why).toMatch(/running into/)
  })
})
