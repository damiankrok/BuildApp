import { describe, expect, it } from 'vitest'
import { BLACK, drawLine } from '../../source-cv/test/draw.js'
import { sheet, chain } from './plan.js'
import { M2_PER_PX2, builtAt, clear, glazeH, glazeV, near, post, ring, run, wall } from './boundary-plan.js'
import { COMPLETION_BOUNDS, alignmentTargets, completeBoundary, extentSidesOf } from '../src/index.js'
import type { CompletionPart, PlanDecomposition, PlanReading } from '../src/index.js'

/**
 * BUILDPLAN-ANALYZER-005F: a strong physical extent challenges a box that stops short — and fills nothing by itself.
 *
 * Synthetic plans (`boundary-plan.ts`: 5 cm/px, 12 px walls; not a drawing of any building). A side of the extent that
 * exterior dimension chains state past the box is an ENVELOPE_EXTENT_CONFLICT, always recorded. A part the outline
 * encloses there is built only as an attached room — a way in from the house, walled, room evidence of its own, two
 * returns — clipped to its own free floor; inside the box, a room's end the incumbent grid had no line for is completed
 * when it continues the rooms the box built. A terrace on posts, a canopy, a walled yard and a strip with nothing
 * enclosed in it stay outside, whatever the chains state.
 */

const HOUSE_M2 = 16 * 12
// An east bay 2 m deep (40 px) and 5 m wide (y 120..219) against a 16 × 12 m house, its outer wall at x 388..399.
const bay = (o: { junction: 'OPEN' | 'FACE_LINE' | 'SOLID' | 'DOOR'; outer: 'GLAZED' | 'SOLID' | 'POSTS' | 'DOORED' }) => {
  const r = sheet(460, 340)
  ring(r, 40, 40, 359, 279)
  if (o.outer === 'POSTS') {
    post(r, 392, 124)
    post(r, 392, 216)
    drawLine(r, 360, 120, 399, 120, BLACK)
    drawLine(r, 360, 220, 399, 220, BLACK)
    drawLine(r, 399, 120, 399, 220, BLACK)
  } else {
    wall(r, 348, 120, 399, 131)
    wall(r, 348, 208, 399, 219)
    wall(r, 388, 120, 399, 219)
    if (o.outer === 'DOORED') {
      clear(r, 388, 140, 399, 199)
      drawLine(r, 393, 140, 393, 199, BLACK)
    }
    if (o.outer === 'GLAZED') {
      clear(r, 388, 140, 399, 199)
      glazeV(r, 388, 140, 199)
    }
  }
  if (o.junction !== 'SOLID') clear(r, 348, 132, 359, 207)
  // a counter or a beam drawn across the open side, at the house's face: what 005E blind 2's kitchen bay had
  if (o.junction === 'FACE_LINE') drawLine(r, 358, 132, 358, 207, BLACK)
  if (o.junction === 'DOOR') {
    wall(r, 348, 132, 359, 207)
    clear(r, 348, 150, 359, 169)
    drawLine(r, 353, 150, 353, 169, BLACK)
  }
  return r
}
const X = [40, 360, 400]
const Y = [40, 120, 220, 280]
const conflictOn = (d: PlanDecomposition, side: string) => d.boundary?.extentConflicts.find((c) => c.side === side)

describe('§29 ENVELOPE_EXTENT_CONFLICT: a strong extent past the box', () => {
  it('a flush bay behind a line drawn across its open side: the conflict is raised, the bay is an attached room, clipped to its walls', () => {
    const { d, builtM2 } = run(bay({ junction: 'FACE_LINE', outer: 'GLAZED' }), X, Y)
    expect(builtAt(d, 375, 170)).toBe(true)
    const c = conflictOn(d, 'E')
    expect(c?.strength).toBe('STRONG')
    expect(c?.decision).toBe('ACCEPTED')
    expect(c?.gapM ?? 0).toBeGreaterThanOrEqual(COMPLETION_BOUNDS.conflictWalls * 0.6)
    const part = d.boundary?.completions.find((p) => p.decision === 'ACCEPTED')
    expect(part?.kind).toBe('ATTACHED_ROOM')
    // the bay, not the strip: its rect stays within its own side walls (y 120..220), whatever the strip's length
    expect(part?.rect.y0 ?? 0).toBeGreaterThanOrEqual(120 - 12)
    expect(part?.rect.y1 ?? 0).toBeLessThanOrEqual(220 + 12)
    expect(near(builtM2, HOUSE_M2 + 2 * 5, 0.04), `${builtM2}`).toBe(true)
  })

  it('a door in the junction and a glazed outer face: built', () => {
    const { d } = run(bay({ junction: 'DOOR', outer: 'GLAZED' }), X, Y)
    expect(builtAt(d, 375, 170)).toBe(true)
  })

  it('an open junction is the 005C continuation, as before', () => {
    const { d, builtM2 } = run(bay({ junction: 'OPEN', outer: 'GLAZED' }), X, Y)
    expect(builtAt(d, 375, 170)).toBe(true)
    expect(near(builtM2, HOUSE_M2 + 2 * 5, 0.04)).toBe(true)
  })

  it('walled off from the house (no way in): not built, and the conflict says so', () => {
    const { d } = run(bay({ junction: 'SOLID', outer: 'GLAZED' }), X, Y)
    expect(builtAt(d, 375, 170)).toBe(false)
    expect(conflictOn(d, 'E')?.decision).not.toBe('ACCEPTED')
  })

  it('a walled store or yard with only a door of its own (no window, no vehicle door): not built', () => {
    const { d } = run(bay({ junction: 'DOOR', outer: 'DOORED' }), X, Y)
    expect(builtAt(d, 375, 170)).toBe(false)
  })

  it('§21 a canopy on posts the overall chain dimensions: never built', () => {
    const { d, builtM2 } = run(bay({ junction: 'FACE_LINE', outer: 'POSTS' }), X, Y)
    expect(builtAt(d, 375, 170)).toBe(false)
    expect(near(builtM2, HOUSE_M2, 0.03), `${builtM2}`).toBe(true)
  })

  it('the same bay with no chain stating the side: the 005C rule alone, and no conflict', () => {
    const { d } = run(bay({ junction: 'FACE_LINE', outer: 'GLAZED' }), [40, 360], Y)
    expect(builtAt(d, 375, 170)).toBe(false)
    expect(conflictOn(d, 'E')).toBeUndefined()
  })

  it('§30 a strong extent with nothing enclosed in the strip (a terrace edge, paving): the conflict is a ZONE, nothing is invented', () => {
    const r = sheet(460, 340)
    ring(r, 40, 40, 359, 279)
    // a terrace: thin paving lines only
    drawLine(r, 360, 100, 399, 100, BLACK)
    drawLine(r, 360, 240, 399, 240, BLACK)
    drawLine(r, 399, 100, 399, 240, BLACK)
    const { d, builtM2 } = run(r, X, Y)
    expect(builtAt(d, 380, 170)).toBe(false)
    expect(near(builtM2, HOUSE_M2, 0.03)).toBe(true)
    expect(['ZONE', 'INCONCLUSIVE']).toContain(conflictOn(d, 'E')?.decision)
  })

  it('a walled yard reached through a house door, with a gate and no window: not built (no room evidence)', () => {
    // 1.4 m deep (28 px, 2.3 walls): past the box by more than two walls, its garden walls too short to be long bands —
    // the long-band box cannot take it, so only the attached-room rule could (a deeper yard's long walls make the box
    // swallow it, as before this stage: recorded as debt, reviewer D P2-c)
    const r = sheet(460, 340)
    ring(r, 40, 40, 359, 279)
    wall(r, 360, 120, 387, 131)
    wall(r, 360, 208, 387, 219)
    wall(r, 376, 120, 387, 219)
    clear(r, 376, 146, 387, 193) // the gate: a wide blank gap, leaving garden-wall piers too short to be long bands
    clear(r, 348, 150, 359, 169) // the house door into the yard
    drawLine(r, 353, 150, 353, 169, BLACK)
    const { d } = run(r, [40, 360, 388], Y)
    expect(builtAt(d, 370, 170)).toBe(false)
    // the chains still state the yard's wall: the conflict is recorded, and it builds nothing
    expect(conflictOn(d, 'E')?.strength).toBe('STRONG')
    expect(conflictOn(d, 'E')?.decision).not.toBe('ACCEPTED')
    for (const part of d.boundary?.completions ?? []) if (part.kind === 'ATTACHED_ROOM') expect(part.decision, part.reason).not.toBe('ACCEPTED')
  })

  it('an L-shaped body: a flush wing beyond the box through a door in a party wall, glazed, is built as its own body', () => {
    const r = sheet(560, 340)
    ring(r, 40, 40, 359, 279)
    // the wing: 6 m deep (120 px) and 6 m wide (y 40..159), flush with the house's north face
    wall(r, 348, 40, 479, 51)
    wall(r, 348, 148, 479, 159)
    wall(r, 468, 40, 479, 159)
    clear(r, 468, 70, 479, 129)
    glazeV(r, 468, 70, 129)
    clear(r, 348, 90, 359, 109)
    drawLine(r, 353, 90, 353, 109, BLACK)
    const { d, builtM2 } = run(r, [40, 360, 480], [40, 160, 280])
    expect(builtAt(d, 420, 100), JSON.stringify(d.boundary?.completions.map((p) => [p.kind, p.decision, p.reason]))).toBe(true)
    expect(near(builtM2, HOUSE_M2 + 6 * 6, 0.04), `${builtM2}`).toBe(true)
    // the house's own body is untouched: still one rectangle where it was
    expect(d.regions.some((g) => g.classification === 'BUILT' && g.rect.x0 === 40 && g.rect.x1 >= 359 && g.rect.y0 === 40 && g.rect.y1 >= 279)).toBe(true)
  })
})

describe('§19 garage end: a room’s end the grid had no line for', () => {
  /**
   * A house (16 × 13 m) with a 4 m garage on its west side. The garage's south wall stands 1.4 m short of the house's
   * south face; it is two piers either side of a door. The chains tick the garage's interior shallowly (the last row
   * 0.75 m) and stop short of its end wall, which only an unread exterior chain ticks (`unreadTicks`): the incumbent
   * grid has no line there, the shadow grid has. `flip` draws the same plan upside down — what is built must not
   * depend on which way up the plan is drawn.
   */
  const H = 360
  const ys = [40, 60, 120, 185, 200, 300]
  const garage = (door: 'DASHED' | 'BLANK', flip: boolean) => {
    const f = (y: number): number => (flip ? H - 1 - y : y)
    const r = sheet(520, H)
    const at = (paint: typeof wall, x0: number, y0: number, x1: number, y1: number): void => paint(r, x0, Math.min(f(y0), f(y1)), x1, Math.max(f(y0), f(y1)))
    at(ring, 140, 40, 459, 299)
    at(wall, 60, 60, 151, 71) // garage north wall
    at(wall, 60, 60, 71, 271) // garage west wall
    at(wall, 60, 260, 151, 271) // garage south wall: piers and a 2.55 m door
    at(clear, 75, 260, 125, 271)
    // an overhead door: a dashed line across the opening
    if (door === 'DASHED') for (let x = 75; x <= 125; x += 13) drawLine(r, x, f(266), Math.min(x + 9, 125), f(266), BLACK)
    const { d, builtM2 } = run(r, [60, 140, 460], ys.map(f), [], { unreadTicks: { y: [f(271)] } })
    return { d, builtM2, end: (x: number) => builtAt(d, x, f(240)) }
  }
  for (const flip of [false, true]) {
    it(`a drawn vehicle door with a vehicle's length behind it completes the garage to its end wall${flip ? ' (drawn upside down)' : ''}`, () => {
      const { d, builtM2, end } = garage('DASHED', flip)
      expect(end(100)).toBe(true)
      const part = d.boundary?.completions.find((p) => p.kind === 'BOX_COMPLETION')
      expect(part?.decision, part?.reason).toBe('ACCEPTED')
      expect(part?.weakGaps.some((g) => g.signature === 'DASHED' && g.vehicleDoor)).toBe(true)
      // the house, the garage and its end: 16 × 13 + 4 × 10.55
      expect(near(builtM2, 208 + 4 * 10.55, 0.03), `${builtM2}`).toBe(true)
    })
    it(`a blank gap is no vehicle door: the end stays a question, not built${flip ? ' (drawn upside down)' : ''}`, () => {
      const { d, end } = garage('BLANK', flip)
      expect(end(100)).toBe(false)
      const part = d.boundary?.completions.find((p) => p.kind === 'BOX_COMPLETION')
      expect(part?.decision, part?.reason).toBe('QUESTION')
      expect(part?.weakGaps.every((g) => !g.vehicleDoor)).toBe(true)
    })
  }
})

describe('bounds and separation', () => {
  it('every completion is bounded: at most `maxParts` parts, none larger than half of what the box builds', () => {
    for (const junction of ['OPEN', 'FACE_LINE', 'SOLID', 'DOOR'] as const) {
      for (const outer of ['GLAZED', 'SOLID', 'POSTS', 'DOORED'] as const) {
        const { d } = run(bay({ junction, outer }), X, Y)
        const b = d.boundary
        if (!b) continue
        expect(b.completions.length).toBeLessThanOrEqual(COMPLETION_BOUNDS.maxParts)
        const box = b.candidates.find((c) => c.id === 'A_LONG_BAND_BOX')?.support.areaM2 ?? Infinity
        for (const p of b.completions) if (p.decision === 'ACCEPTED') expect(p.areaM2).toBeLessThanOrEqual(COMPLETION_BOUNDS.partShare * box + 1e-6)
        expect(b.extentConflicts.length).toBeLessThanOrEqual(4)
        for (const c of b.extentConflicts) expect(c.stretches.length).toBeLessThanOrEqual(COMPLETION_BOUNDS.stretchesPerSide)
      }
    }
  })

  it('the conflict reads geometry only: no published figure, no printed value enters it', () => {
    expect(completeBoundary.length).toBe(1)
    const sides = extentSidesOf([chain('h', 'HORIZONTAL', [40, 360, 400], { read: false, baselinePx: 12 })], { rect: { x0: 40, y0: 40, x1: 400, y1: 280 }, weak: false, why: '' }, 12)
    // an unread chain with no role states nothing: the extent's roles decide what is exterior
    expect(sides).toEqual([])
  })

  it('a decomposition with no completion is the 005C decomposition byte for byte', () => {
    const r = sheet(460, 340)
    ring(r, 40, 40, 359, 279)
    const on = run(r, [40, 360], [40, 280]).d
    const off = run(r, [40, 360], [40, 280], [], { extentSides: false }).d
    expect(JSON.stringify({ ...on, boundary: undefined })).toBe(JSON.stringify({ ...off, boundary: undefined }))
    expect(M2_PER_PX2).toBeGreaterThan(0)
  })
})

describe('the part cap (005F post-review B5F-1)', () => {
  // the §29 bay on a long house, and N small closed closets on its north face, each its own enclosed part beyond the box
  const plan = (closets: number) => {
    const r = sheet(1100, 420)
    ring(r, 40, 80, 959, 359)
    wall(r, 948, 160, 999, 171)
    wall(r, 948, 248, 999, 259)
    wall(r, 988, 160, 999, 259)
    clear(r, 988, 180, 999, 239)
    glazeV(r, 988, 180, 239)
    clear(r, 948, 172, 959, 247)
    drawLine(r, 958, 172, 958, 247, BLACK)
    const xs = [40, 960, 1000]
    for (let i = 0; i < closets; i += 1) {
      const x0 = 52 + i * 48
      ring(r, x0, 44, x0 + 35, 91)
      xs.push(x0, x0 + 36)
    }
    return { r, xs: [...new Set(xs)].sort((a, b) => a - b), ys: closets > 0 ? [44, 80, 160, 260, 360] : [80, 160, 260, 360] }
  }
  it('more small parts than the cap: the room is judged first and built, and what the cap left is counted', () => {
    const { r, xs, ys } = plan(18)
    const { d } = run(r, xs, ys)
    expect(builtAt(d, 975, 210)).toBe(true)
    expect(d.boundary?.completions.length ?? 0).toBeLessThanOrEqual(COMPLETION_BOUNDS.maxParts)
    expect(d.boundary?.completionsUnjudged ?? 0).toBeGreaterThan(0)
    // no side claims "nothing enclosed reaches it" while parts went unjudged
    for (const c of d.boundary?.extentConflicts ?? []) expect(c.decision).not.toBe('ZONE')
  })
})

describe('glazing beside a door junction stays a window', () => {
  it('a bay whose only junction opening is glazing has no way in: not built', () => {
    const r = sheet(460, 340)
    ring(r, 40, 40, 359, 279)
    wall(r, 348, 120, 399, 131)
    wall(r, 348, 208, 399, 219)
    wall(r, 388, 120, 399, 219)
    clear(r, 388, 140, 399, 199)
    glazeV(r, 388, 140, 199)
    clear(r, 348, 150, 359, 189)
    glazeV(r, 348, 150, 189)
    void glazeH
    const { d } = run(r, X, Y)
    expect(builtAt(d, 375, 170)).toBe(false)
  })
})

describe('the storey above an attached room', () => {
  // A house 0..200 × 0..150 px and a single-storey bay 200..240 × 50..100 px completed against it.
  const house = { x0: 0, y0: 0, x1: 200, y1: 150 }
  const bayRect = { x0: 200, y0: 50, x1: 240, y1: 100 }
  const reading = (part: Pick<CompletionPart, 'kind' | 'decision'>): PlanReading =>
    ({
      wallPx: 12,
      decomposition: {
        regions: [
          { id: 'region-house', classification: 'BUILT', rect: house },
          { id: 'region-bay', classification: 'BUILT', rect: bayRect },
        ],
        envelope: { rect: { x0: 0, y0: 0, x1: 240, y1: 150 } },
        boundary: { completions: [{ ...part, rect: bayRect }] },
      },
    }) as unknown as PlanReading
  it('an accepted attached room leaves the house without it as a target of its own, beside the envelope with it', () => {
    const targets = alignmentTargets(reading({ kind: 'ATTACHED_ROOM', decision: 'ACCEPTED' }))
    expect(targets.find((t) => t.id === 'envelope')?.rect).toEqual({ x0: 0, y0: 0, x1: 240, y1: 150 })
    expect(targets.find((t) => t.id === 'envelope-without-attached')?.rect).toEqual(house)
  })
  it('a question, a rejection or a box completion changes no target', () => {
    for (const part of [
      { kind: 'ATTACHED_ROOM', decision: 'QUESTION' },
      { kind: 'ATTACHED_ROOM', decision: 'REJECTED' },
      { kind: 'BOX_COMPLETION', decision: 'ACCEPTED' },
    ] as const) {
      expect(alignmentTargets(reading(part)).some((t) => t.id === 'envelope-without-attached')).toBe(false)
    }
  })
})
