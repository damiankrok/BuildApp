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
import { BANDS, clear, glazeH, ring, run, wall } from './boundary-plan.js'
import { BLACK, drawLine } from '../../source-cv/test/draw.js'
import { PlanDrawing, TRANSFORMS, render, runScene } from './transforms.js'
import type { Scene } from './transforms.js'
import { WALL, chain, graphOf, mask, metricsOf, planFrame, registration, sheet, walls } from './plan.js'
import { bandWallThickness, decomposePlan, exteriorTicksOf, extentSidesOf, planExtent, reconstructV2, wallWitness } from '../src/index.js'
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

/** The spans the drawing's separators cut; a gap read and left whole is on the record too (`wholeOf`), with no intervals. */
const spansOf = (d: PlanDecomposition): CompoundFacadeSpan[] => (d.compoundFacades ?? []).filter((s) => s.intervals.length > 0)
const wholeOf = (d: PlanDecomposition): CompoundFacadeSpan[] => (d.compoundFacades ?? []).filter((s) => s.intervals.length === 0)
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

describe('005N §16 — each interval is weighed against its own pocket', () => {
  it('an undrawn mouth into the house beside the recess: the hall behind it is the interior, so its own width shuts it — the merged span would not', () => {
    // the recess, then past its return a 3 m mouth with nothing drawn across it into a hall 9 m deep that runs on
    // into the rooms: 27 m² behind 3 m is more than a pocket (limit 22.5 m²), but less than the merged 6.6 m span's
    // limit (109 m²), which would have left the house open through it
    const p = house()
    p.clear(120, FRONT, 251, 279)
    returnAt(p, 108, 100)
    returnAt(p, 180, 100)
    wallH(p, 108, 191, 228)
    doorH(p, 135, 155, 228)
    returnAt(p, 252, 100)
    wallH(p, 180, 263, 100)
    doorH(p, 200, 240, 100)
    for (const t of TRANSFORMS) {
      const r = runScene(scene(p), t)
      const mouth = spansOf(r.d)[0].intervals.find((i) => i.role !== 'RECESS_MOUTH')
      expect(mouth?.role, t).toBe('OPEN_SIDE')
      const decided = r.d.wideOpenings.find((w) => w.compound?.intervalId === mouth?.id)
      expect(decided?.decision, `${t}: shut by what lies behind it`).toBe('OPENING_IN_WALL')
      console.log('A2S', t, JSON.stringify((r.d.compoundFacades ?? []).map((s) => [s.fromPx, s.toPx, s.widthM, s.why, s.separators.map((x) => [x.kind, x.why.slice(0, 60)])])))
      console.log('A2X', t, JSON.stringify(r.d.wideOpenings.filter((w) => w.compound).map((w) => [w.widthM, w.decision, w.evidence.pocketM2 ?? null, w.compound?.role])))
      expect(r.builtAt(222, 160), `${t}: the hall`).toBe(true)
      expect(r.builtAt(300, 150), `${t}: the living room`).toBe(true)
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
    // a bin, a bollard: a free-standing block against the facade, off the wall's own axis (so no wall band takes it in)
    // but within the line reader's reach — wall-thick ink the reader sees, and a post that establishes no wall relation
    p.wall(164, 281, 175, 292)
    for (const t of TRANSFORMS) {
      const r = runScene(scene(p), t)
      expect(r.d.wideOpenings.some((w) => w.widthM > 4.5), `${t}: the 5 m gap is weighed`).toBe(true)
      expect(spansOf(r.d), t).toHaveLength(0)
      // council C2: the gap was read, and what was found in it and refused is on the record
      const whole = wholeOf(r.d)
      expect(whole.flatMap((x) => x.separators.map((y) => [y.accepted, y.kind])), t).toEqual([[false, 'NOT_A_SEPARATOR']])
      expect(whole[0].why, t).toMatch(/none a return or a pier/)
    }
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

describe('005N — a plan with no scale of its own is read as before', () => {
  it('a unit-placeholder registration states no return, depth or interval width: no span is read, the gaps decide as the incumbent did', () => {
    const m = mask(render(entranceAndGarage()))
    const bands = runLengthBands(m, BANDS)
    const wallPx = bandWallThickness(bands, WALL)
    const chains = [chain('cx', 'HORIZONTAL', [40, 360], { baselinePx: 12 }), chain('cy', 'VERTICAL', [40, 280], { baselinePx: 12 })]
    const extent = planExtent(chains, bands, wallPx, wallWitness(bands, wallPx, m))
    if (!extent) throw new Error('no frame')
    const read = (confidence: number): PlanDecomposition => decomposePlan(m, chains, bands, { ...registration(), confidence }, extent.rect, { sheetWallPx: WALL, exteriorTicks: exteriorTicksOf(chains, extent.roles), extentSides: extentSidesOf(chains, extent, wallPx) })
    expect(spansOf(read(0.9))).not.toHaveLength(0)
    const unscaled = read(0)
    expect(unscaled.compoundFacades).toBeUndefined()
    expect(unscaled.wideOpenings.some((w) => w.compound)).toBe(false)
  })
})

/**
 * A house whose outline the boundary adopts (a wing on short glazed piers beyond the chains' depth, at the south-east)
 * and, on the same front, the target compound: the recessed entrance and, past its return, a garage. The outline is
 * read from the box reading, so the box reading's compound span must stay on the record even though the outline's own
 * grid reads none.
 */
function adoptedOutlineWithCompound(garageDoor: boolean): ReturnType<typeof sheet> {
  const r = sheet(520, 460)
  ring(r, 40, 40, 459, 279)
  clear(r, 300, 268, 447, 279)
  wall(r, 288, 268, 299, 399)
  wall(r, 448, 268, 459, 399)
  wall(r, 288, 388, 315, 399)
  wall(r, 432, 388, 459, 399)
  glazeH(r, 388, 316, 431)
  clear(r, 120, 268, 251, 279)
  wall(r, 108, 150, 108 + WALL - 1, 279)
  wall(r, 180, 150, 180 + WALL - 1, 279)
  wall(r, 108, 228, 191, 228 + WALL - 1)
  clear(r, 135, 228, 155, 239)
  drawLine(r, 135, 233, 155, 233, BLACK)
  wall(r, 108, 150, 263, 161)
  wall(r, 252, 150, 263, 279)
  clear(r, 210, 150, 225, 161)
  drawLine(r, 210, 155, 225, 155, BLACK)
  if (garageDoor) drawLine(r, 192, 276, 251, 276, BLACK)
  return r
}

describe('005N §19 — an adopted outline keeps the box reading\'s compound spans on the record', () => {
  it('the outline is adopted, its own grid reads no span, and the box reading\'s span is carried with its roles', () => {
    for (const door of [true, false]) {
      const { d } = run(adoptedOutlineWithCompound(door), [40, 288, 460], [40, 280, 400])
      expect(d.boundary?.accepted, `door ${door}`).toBe(true)
      expect(d.compoundFacades, `door ${door}`).toBeUndefined()
      const box = d.compoundFacadesBoxReading
      expect(box?.spans.map((s) => s.intervals.map((i) => i.role)), `door ${door}`).toEqual([['RECESS_MOUTH', door ? 'OPENING_IN_WALL' : 'OPEN_SIDE']])
      // decided on its own reading: each interval's wide opening is among the box reading's
      for (const i of box?.spans[0].intervals ?? []) expect(box?.wideOpenings.some((w) => w.compound?.intervalId === i.id)).toBe(true)
    }
  })

  it('the plan digest carries it as the BOX reading, each interval with its decision and the cells behind its mouth', () => {
    const frame = planFrame('frame-plan', 'GROUND', { width: 520, height: 460 })
    const on = <T extends { frameId: string }>(x: T): T => ({ ...x, frameId: frame.id })
    const r = reconstructV2({
      label: 'fixture',
      slug: 'fixture',
      sourcePackageId: 'src-test',
      sourcePackageHash: 'd'.repeat(64),
      graph: graphOf([frame]),
      metrics: metricsOf([on(chain('cx', 'HORIZONTAL', [40, 288, 460], { baselinePx: 12 })), on(chain('cy', 'VERTICAL', [40, 280, 400], { baselinePx: 12 }))], [on(registration())]),
      raster: () => adoptedOutlineWithCompound(true),
    })
    const plan = r.planDiagnostics?.plans.find((p) => p.frameId === frame.id)
    expect(plan?.boundary?.accepted).toBe(true)
    const spans = plan?.compoundFacades ?? []
    expect(spans.map((s) => s.reading)).toEqual(['BOX'])
    expect(spans[0].intervals.map((i) => [i.role, i.decision])).toEqual([['RECESS_MOUTH', 'OPEN_SIDE'], ['OPENING_IN_WALL', 'OPENING_IN_WALL']])
    expect(spans[0].intervals.every((i) => i.behind.length > 0)).toBe(true)
  })
})

describe('005N council — what a back wall, a callout, a pattern and a sibling may not do', () => {
  /** Fixture 15's passage through the house beside a garage. */
  function passage(): PlanDrawing {
    const p = house()
    p.clear(120, FRONT, 263, 279)
    p.clear(120, 40, 191, 51)
    returnAt(p, 108, 40)
    returnAt(p, 192, 40)
    wallH(p, 204, 275, 150)
    returnAt(p, 264, 150)
    vehicleDoor(p, 204, 263)
    return p
  }

  it('A1/B2. a step line, or a flight of them, in front of the set-back wall is not the set-back wall: the recess keeps its depth, nothing is built in it', () => {
    // the entrance recess 4 m deep (its door in a back wall at rows 200..211); steps drawn across its floor
    const deep = (): PlanDrawing => {
      const p = house()
      p.clear(120, FRONT, 251, 279)
      returnAt(p, 108, 150)
      returnAt(p, 180, 150)
      wallH(p, 108, 191, 200)
      doorH(p, 135, 155, 200)
      wallH(p, 108, 263, 150)
      returnAt(p, 252, 150)
      doorH(p, 210, 225, 150)
      vehicleDoor(p, 192, 251)
      return p
    }
    const one = deep().line(120, 240, 179, 240)
    const flight = deep().line(120, 226, 179, 226).line(120, 232, 179, 232).line(120, 238, 179, 238).line(120, 244, 179, 244)
    for (const [name, p] of [['one step', one], ['a flight', flight]] as const) {
      for (const t of TRANSFORMS) {
        const r = runScene(scene(p), t)
        const recess = spansOf(r.d)[0].intervals.find((i) => i.role === 'RECESS_MOUTH')
        expect(recess?.recess?.depthM, `${name} ${t}`).toBeGreaterThan(3)
        expect(r.builtAt(150, 222), `${name} ${t}: inside the recess, behind the steps`).toBe(false)
        expect(r.builtAt(150, 180), `${name} ${t}: the hall`).toBe(true)
      }
    }
  })

  it('B1/C1. a callout at a shallow bay whose back wall was not read does not shut it: only walls running deeper than a recess let a callout close a mouth', () => {
    // the left return stops 2.55 m in and nothing closes the bay behind it (no set-back wall to read); a callout states
    // the mouth. However the pocket test then weighs it, the callout alone does not make it an opening in a wall.
    const p = house()
    p.clear(120, FRONT, 251, 279)
    returnAt(p, 108, 228)
    returnAt(p, 180, 150)
    wallH(p, 180, 263, 150)
    returnAt(p, 252, 150)
    vehicleDoor(p, 192, 251)
    const callouts: PlanCallout[] = [{ id: 'c-bay', at: { x: 150, y: 292 }, widthsCm: [{ value: 300, confidence: 0.9 }] }]
    for (const t of TRANSFORMS) {
      const r = runScene(scene(p, callouts), t)
      const bay = spansOf(r.d)[0].intervals.find((i) => i.evidence.callout?.id === 'c-bay')
      expect(bay, t).toBeDefined()
      expect(bay?.role, t).not.toBe('OPENING_IN_WALL')
    }
  })

  it('B3. a paving pattern across a blank garage mouth is no door and no set-back wall: the interval is not shut by it', () => {
    // Lines repeated across the mouth, up to the facade: their sum is "infill", their last edge looks like glazing. The
    // compound reading neither shuts the interval on them nor reads a phantom back wall at their edge. (The incumbent's
    // per-edge rule still takes a line inside the wall's band as drawn across the cell edge and builds the bay; that is
    // the starting code's behaviour too, unchanged here — recorded as a residual in the stage report.)
    const p = entranceAndGarage({ garage: 'BLANK' })
    for (let y = 262; y <= 300; y += 4) p.line(192, y, 251, y)
    for (const t of TRANSFORMS) {
      const r = runScene(scene(p), t)
      const garage = spansOf(r.d)[0].intervals.find((i) => i.role !== 'RECESS_MOUTH' || (i.recess?.depthM ?? 0) < 1.5)
      expect(garage?.role, t).toBe('OPEN_SIDE')
      expect(garage?.recess, t).toBeUndefined()
      expect(r.classAt(150, 255), t).toBe('RECESS')
    }
  })

  it('A2. two undrawn mouths side by side: the hall behind one is shut by its own pocket, the shallow bay beside it is not shut by the hall\'s', () => {
    // left: a 3 m mouth into a hall 9.75 m deep (29 m², more than a pocket); right, past a return: a walled bay 5.4 m
    // deep with nothing across its mouth (16 m², a pocket). In every orientation the bay stays open.
    const p = house()
    p.clear(120, FRONT, 251, 279)
    returnAt(p, 108, 60)
    returnAt(p, 180, 60)
    wallH(p, 108, 191, 60)
    doorH(p, 135, 155, 60)
    wallH(p, 180, 263, 160)
    returnAt(p, 252, 160)
    for (const t of TRANSFORMS) {
      const r = runScene(scene(p), t)
      expect(r.builtAt(150, 150), `${t}: the hall`).toBe(true)
      expect(r.builtAt(222, 220), `${t}: the bay`).toBe(false)
    }
  })
})

describe('005N council D1 — mouths side by side into one space are weighed together', () => {
  /**
   * Two 4 m mouths with nothing drawn across them, either side of a pier (1 m on the facade, tied to a 1.6 m stub: one
   * wall body, no return), and a dimension tick at the pier, so the grid gives each mouth its own edge. Each mouth alone
   * lets the outside into nothing the other does not; together they open onto whatever lies behind both.
   */
  const pierFront = (): PlanDrawing => {
    const p = house()
    p.clear(100, FRONT, 279, 279)
    p.wall(180, FRONT, 199, 279)
    p.wall(184, 248, 195, 279)
    return p
  }
  const atPier = (p: PlanDrawing): Scene => ({ p, xs: [40, 190, 360], ys: [40, 280] })

  it('an open-plan house behind them is the interior: both mouths are shut, the house stands', () => {
    for (const t of TRANSFORMS) {
      const r = runScene(atPier(pierFront()), t)
      expect(acceptedOf(r.d), t).toEqual(['FACADE_PIER'])
      expect(r.d.wideOpenings.filter((w) => w.compound).map((w) => w.decision), t).toEqual(['OPENING_IN_WALL', 'OPENING_IN_WALL'])
      expect(r.builtAt(140, 200), `${t}: behind the left mouth`).toBe(true)
      expect(r.builtAt(300, 100), `${t}: the house`).toBe(true)
    }
  })

  it('a shared space behind them no bigger than their joint 8 m allows a pocket stays open', () => {
    const p = pierFront()
    returnAt(p, 88, 160)
    returnAt(p, 280, 160)
    wallH(p, 88, 291, 160) // 9 m × 5.4 m behind the two mouths: 49 m², under the 160 m² their joint width allows
    for (const t of TRANSFORMS) {
      const r = runScene(atPier(p), t)
      expect(r.d.wideOpenings.filter((w) => w.compound).map((w) => w.decision), t).toEqual(['OPEN_SIDE', 'OPEN_SIDE'])
      expect(r.builtAt(140, 220), `${t}: the shared space`).toBe(false)
      expect(r.builtAt(300, 100), `${t}: the house`).toBe(true)
    }
  })
})
