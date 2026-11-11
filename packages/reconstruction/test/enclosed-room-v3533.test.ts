import { describe, expect, it } from 'vitest'
import { assignCallouts, completeBoundary, decompositionIdOf, withCallout } from '../src/index.js'
import type { BoundaryGap, CompletionPart, LinePiece, OutlineEdge, WallLine } from '../src/index.js'

/**
 * v3.53.3 — a room the box's reading walked into through its own opening.
 *
 * The found cause, on a public single-storey plan of one rectangle under one gable: a bedroom's balcony door, printed
 * 150/230, measured 121 cm between its jambs (the leaves and the frame read as wall), so its callout agreed with no
 * gap; grid lines struck at both jambs left each cell edge one piece of wall, the flood walked through the door, the
 * bedroom was ground, and the house was cut into a body and a flat-roofed annexe beside the lost corner.
 *
 * Two readers are tested here on hand-built input: the callout's agreement with a gap narrowed by jamb ink
 * (`assignCallouts`), and the judgement that a part the house has only a door into is a ROOM when it has a named
 * opening of its own (`completeBoundary`). The second reading itself is tested on a drawn plan in
 * `enclosed-room-plan-v3533.test.ts`.
 */

const MPP = 0.023 // metres per pixel, about the plan the cause was found on
const WALL = 11

const gap = (over: Partial<BoundaryGap> & Pick<BoundaryGap, 'id' | 'axis' | 'linePx' | 'fromPx' | 'toPx'>): BoundaryGap => ({
  widthM: (over.toPx - over.fromPx) * MPP,
  jambs: ['WALL', 'WALL'],
  strokes: [],
  signature: 'LEAF_FACE',
  cls: 'UNKNOWN_GAP',
  boundary: 'WEAK',
  occupancy: 'OPENING',
  why: 'a gap',
  ...over,
})
const lineOf = (axis: 'X' | 'Y', px: number, gaps: BoundaryGap[]): WallLine => ({ axis, px, from: 0, to: 1000, pieces: [], gaps, drawingBreaks: 0 })
const assign = (lines: WallLine[], callouts: Parameters<typeof assignCallouts>[1]) => assignCallouts(lines, callouts, () => MPP, () => MPP, WALL)

describe('a callout and the gap it is printed over (v3.53.3)', () => {
  // a door printed 150 cm, measured 121 cm between its jambs: 53 px at 2.3 cm/px
  const door = gap({ id: 'door', axis: 'Y', linePx: 220, fromPx: 696, toPx: 749 })
  // the recogniser's reading, sure, with the lattice's weaker candidates still listed beside it: 130 fits the gap as measured
  const sure = [{ id: 'c1', at: { x: 722, y: 180 }, widthsCm: [{ value: 150, confidence: 0.9996 }, { value: 130, confidence: 0.4 }] }]
  const only = [{ id: 'c1', at: { x: 722, y: 180 }, widthsCm: [{ value: 150, confidence: 1 }] }]

  it('agrees with a gap between two walls that measures narrower by no more than the ink a leaf and a frame put at the jambs', () => {
    const got = assign([lineOf('Y', 220, [door])], sure)
    expect(got.get('door')).toEqual({ id: 'c1', widthCm: 150, confidence: 0.9996 })
    // and the opening is then one: a leaf is drawn across it and its width is stated
    const upgraded = withCallout(door, got.get('door') as NonNullable<BoundaryGap['callout']>, 8)
    expect([upgraded.cls, upgraded.boundary]).toEqual(['OPENING_SUPPORTED', 'STRONG'])
  })

  it('counter-case: a gap wider than the printed width is never agreed with — ink can narrow an opening, not widen it', () => {
    const wide = gap({ id: 'wide', axis: 'Y', linePx: 220, fromPx: 690, toPx: 772 }) // 189 cm
    expect(assign([lineOf('Y', 220, [wide])], only).size).toBe(0)
  })

  it('counter-case: the allowance is two walls of ink, no more', () => {
    const narrow = gap({ id: 'narrow', axis: 'Y', linePx: 220, fromPx: 700, toPx: 735 }) // 80 cm against 150
    expect(assign([lineOf('Y', 220, [narrow])], only).size).toBe(0)
  })

  it('counter-case: between a wall and a post the measure is the opening’s own, and the allowance does not apply', () => {
    const posted = gap({ id: 'posted', axis: 'Y', linePx: 220, fromPx: 696, toPx: 749, jambs: ['WALL', 'POST'] })
    expect(assign([lineOf('Y', 220, [posted])], only).size).toBe(0)
  })

  it('a gap the width fits as measured outranks one it fits only with the allowance, however near', () => {
    const near = gap({ id: 'near', axis: 'Y', linePx: 190, fromPx: 696, toPx: 749 }) // 122 cm, 10 px off the callout
    const exact = gap({ id: 'exact', axis: 'Y', linePx: 240, fromPx: 690, toPx: 755 }) // 149.5 cm, 60 px off it
    expect([...assign([lineOf('Y', 190, [near]), lineOf('Y', 240, [exact])], only).keys()]).toEqual(['exact'])
    // and alone, the near one is the callout's
    expect([...assign([lineOf('Y', 190, [near])], only).keys()]).toEqual(['near'])
  })

  it('one opening read on both faces of its wall is one opening: the callout is given on both lines', () => {
    const outer = gap({ id: 'outer', axis: 'Y', linePx: 200, fromPx: 696, toPx: 749, signature: 'LEAF_AXIS' })
    const got = assign([lineOf('Y', 200, [outer]), lineOf('Y', 220, [door])], sure)
    expect([...got.keys()].sort()).toEqual(['door', 'outer'])
  })

  it('counter-case: two different openings it agrees with about equally get neither', () => {
    const other = gap({ id: 'other', axis: 'Y', linePx: 140, fromPx: 690, toPx: 755 })
    const exact = gap({ id: 'exact', axis: 'Y', linePx: 220, fromPx: 690, toPx: 755 })
    expect(assign([lineOf('Y', 140, [other]), lineOf('Y', 220, [exact])], only).size).toBe(0)
  })

  it('a first reading read surely decides although weaker alternatives are listed; an unsure one only corroborates', () => {
    // the sure first reading (150) is the callout's statement, not the weak candidate (130) that fits the gap as measured
    expect(assign([lineOf('Y', 220, [door])], sure).get('door')).toEqual({ id: 'c1', widthCm: 150, confidence: 0.9996 })
    const unsure = [{ id: 'c1', at: { x: 722, y: 180 }, widthsCm: [{ value: 150, confidence: 0.7 }, { value: 130, confidence: 0.4 }] }]
    const got = assign([lineOf('Y', 220, [door])], unsure).get('door')
    expect(got?.confidence).toBeLessThanOrEqual(0.5)
    // corroborated only: the gap stays a question
    expect(withCallout(door, got as NonNullable<BoundaryGap['callout']>, 8).boundary).toBe('WEAK')
    // an alternative that agrees where the first reading does not is not the callout's statement either
    const second = [{ id: 'c1', at: { x: 722, y: 180 }, widthsCm: [{ value: 240, confidence: 0.99 }, { value: 150, confidence: 0.95 }] }]
    expect(assign([lineOf('Y', 220, [door])], second).get('door')?.confidence).toBe(0.5)
  })
})

/**
 * A hand-built grid (5 cm/px): the house (10 × 6 m, built by the box's reading) and beside it a part 4 × 6 m the
 * outline encloses and the reading does not build. The wall between them is solid with a door bridged in it — the house
 * has a door into the part and nothing else. `own` is what stands in the part's outer wall.
 */
function judge(own: BoundaryGap[], opts: { swap?: boolean; doorInJunction?: boolean; junctionGap?: BoundaryGap } = {}): CompletionPart[] {
  const along = [0, 200, 280]
  const across = [0, 120]
  const LX = opts.swap ? across : along
  const LY = opts.swap ? along : across
  const nx = LX.length - 1
  const ny = LY.length - 1
  const piece = (from: number, to: number, axisPx: number): LinePiece => ({ from, to, axisPx, kind: 'WALL', partId: 0, along: true })
  const full = (axis: 'X' | 'Y', px: number, a: number, b: number, gaps: BoundaryGap[] = []): WallLine => ({ axis, px, from: a, to: b, pieces: [piece(a, b, px)], gaps, drawingBreaks: 0 })
  const lineAxis = opts.swap ? 'Y' : 'X'
  // the junction line (along[1]) carries the door into the part; the part's outer line (along[2]) carries `own`
  const junctionDoor: BoundaryGap = { id: 'way-in', axis: lineAxis, linePx: along[1], fromPx: 40, toPx: 58, widthM: 0.9, jambs: ['WALL', 'WALL'], strokes: [], signature: 'LEAF_AXIS', cls: 'UNKNOWN_GAP', boundary: 'WEAK', occupancy: 'OPENING', why: 'a door' }
  const gapsAt = (p: number): BoundaryGap[] => (p === along[1] ? [...(opts.doorInJunction === false ? [] : [junctionDoor]), ...(opts.junctionGap ? [opts.junctionGap] : [])] : p === along[2] ? own : [])
  const alongLines = along.map((p) => full(lineAxis, p, 0, across[1], gapsAt(p)))
  const acrossLines = across.map((p) => full(opts.swap ? 'X' : 'Y', p, 0, along[2]))
  const wallsX = opts.swap ? acrossLines : alongLines
  const wallsY = opts.swap ? alongLines : acrossLines
  const closed: OutlineEdge = { solid: 1, bridged: 0, closed: true }
  const vEdge: OutlineEdge[][] = LX.map(() => Array.from({ length: ny }, () => ({ ...closed })))
  const hEdge: OutlineEdge[][] = LY.map(() => Array.from({ length: nx }, () => ({ ...closed })))
  const doorEdge: OutlineEdge = opts.doorInJunction === false ? { ...closed } : { solid: 0.85, bridged: 0.15, closed: true }
  if (opts.swap) hEdge[1][0] = doorEdge
  else vEdge[1][0] = doorEdge
  const inside = new Uint8Array(nx * ny).fill(1)
  const builtA = new Uint8Array(nx * ny)
  builtA[0] = 1
  const outline = { inside, nx, ny, vEdge, hEdge, bridged: { strong: [], weak: [] }, pocketMouths: [], unjudged: 0, floods: 1 }
  const solid = { width: LX[nx], height: LY[ny], radius: 4, wallPx: 12, labels: new Int32Array(LX[nx] * LY[ny]), parts: [] }
  const extent = { x0: 0, y0: 0, x1: LX[nx], y1: LY[ny] }
  return completeBoundary({ linesX: LX, linesY: LY, wallsX, wallsY, mppX: 0.05, mppY: 0.05, wallPx: 12, outline, strict: outline, inA: new Uint8Array(nx * ny).fill(1), builtA, accepted: new Uint8Array(nx * ny), box: extent, extent, solid, sides: [], chains: [] }).parts
}

describe('a part the house has only a door into: a room behind its own opening, or a yard behind a wall (v3.53.3)', () => {
  for (const swap of [false, true]) {
    const name = swap ? 'along y' : 'along x'
    const axis = swap ? 'Y' : 'X'
    const named = (over: Partial<BoundaryGap> = {}): BoundaryGap => ({ id: 'balcony-door', axis, linePx: 280, fromPx: 50, toPx: 76, widthM: 1.3, jambs: ['WALL', 'WALL'], strokes: [], signature: 'LEAF_FACE', callout: { id: 'c1', widthCm: 150, confidence: 0.99 }, cls: 'OPENING_SUPPORTED', boundary: 'STRONG', occupancy: 'OPENING', why: 'a named door', ...over })

    it(`with a leaf of its own that a callout names it is a room: a QUESTION carrying that opening, to be read again — ${name}`, () => {
      const parts = judge([named()], { swap })
      expect(parts).toHaveLength(1)
      const [p] = parts
      expect([p.kind, p.decision], p.reason).toEqual(['BOX_COMPLETION', 'QUESTION'])
      expect(p.reason).toMatch(/^ENCLOSED_ROOM: 0\.90 m way in from the built rooms, .* 1 opening of its own named by a callout/)
      expect(p.evidence.labelled).toBe(1)
      expect(p.reread).toEqual([{ gapId: 'balcony-door', axis, linePx: 280, fromPx: 50, toPx: 76, widthM: 1.3, signature: 'LEAF_FACE', calloutCm: 150 }])
    })

    it(`glazing of its own between wall jambs is the same statement — ${name}`, () => {
      const [p] = judge([named({ id: 'window', signature: 'GLAZING', callout: undefined })], { swap })
      expect(p.decision, p.reason).toBe('QUESTION')
      expect(p.reason).toMatch(/glazed/)
      expect(p.reread?.map((o) => o.gapId)).toEqual(['window'])
    })

    it(`counter-case: with nothing of its own it is a yard behind a wall, rejected exactly as before — ${name}`, () => {
      const [p] = judge([], { swap })
      expect(p.decision).toBe('REJECTED')
      expect(p.reason).toMatch(/^NO_CONTINUATION: 0\.00 m of open edge/)
      expect(p.reread).toBeUndefined()
      expect(p.evidence).toEqual({ glazing: 0, chains: 0, vehicleDoors: 0, returns: 0, strictEncloses: true })
    })

    it(`counter-case: a leaf no callout names, and a named gap left WEAK, say nothing — ${name}`, () => {
      expect(judge([named({ callout: undefined })], { swap })[0].decision).toBe('REJECTED')
      // weak gaps on its own side also leave the two outline policies to disagree: never a room on a question
      const weak = judge([named({ cls: 'UNKNOWN_GAP', boundary: 'WEAK' })], { swap })[0]
      expect(weak.decision).toBe('REJECTED')
      expect(weak.reread).toBeUndefined()
    })

    it(`counter-case: an opening between a wall and a post is a canopy’s, not a room’s — ${name}`, () => {
      expect(judge([named({ jambs: ['WALL', 'POST'] })], { swap })[0].decision).toBe('REJECTED')
    })

    it(`counter-case: the house’s own named door into it is the way in, not an opening of the part’s own — ${name}`, () => {
      const [p] = judge([], { swap, junctionGap: named({ id: 'house-door', linePx: 200, fromPx: 70, toPx: 96 }) })
      expect(p.decision).toBe('REJECTED')
    })

    it(`counter-case: no way in from the house — a room of another building, or a shaft — ${name}`, () => {
      const [p] = judge([named()], { swap, doorInJunction: false })
      expect(p.decision).toBe('REJECTED')
      expect(p.reread).toBeUndefined()
    })
  }
})

describe('the identity of a reading (005K) and the second reading', () => {
  const base = { extent: { x0: 0, y0: 0, x1: 100, y1: 80 }, mppX: 0.02, mppY: 0.02, wallPx: 11, linesX: [0, 100], linesY: [0, 80], shutPocketMouths: false }
  it('a reading with no opening shut hashes exactly as it did; one with openings shut is another reading', () => {
    expect(decompositionIdOf({ ...base, shutOpenings: [] })).toBe(decompositionIdOf(base))
    expect(decompositionIdOf({ ...base, shutOpenings: undefined })).toBe(decompositionIdOf(base))
    expect(decompositionIdOf({ ...base, shutOpenings: [{ axis: 'Y', linePx: 0, fromPx: 10, toPx: 30 }] })).not.toBe(decompositionIdOf(base))
  })
})
