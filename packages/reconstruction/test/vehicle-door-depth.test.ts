import { describe, expect, it } from 'vitest'
import { completeBoundary } from '../src/index.js'
import type { BoundaryGap, LinePiece, OutlineEdge, WallLine } from '../src/index.js'

/**
 * 005F post-review C5F-4: a vehicle's length behind a door is floor one drives onto — the part and the built cells it
 * continues across open edges — never a room behind a wall. A hand-built grid (5 cm/px, reviewer C's probe): column 0
 * is a garage 4 m wide, rows 0–1 built, row 2 its end (the BOX_COMPLETION part) open to row 1; a dashed 2.5 m gap in the
 * end's SIDE wall; columns 1–2 the house, behind the garage's solid east wall.
 */
function probe(houseRow2: boolean) {
  const LX = [0, 80, 200, 300]
  const LY = [0, 100, 200, 260]
  const nx = 3
  const ny = 3
  const piece = (from: number, to: number, axisPx: number): LinePiece => ({ from, to, axisPx, kind: 'WALL', partId: 0, along: true })
  const full = (axis: 'X' | 'Y', px: number, a: number, b: number): WallLine => ({ axis, px, from: a, to: b, pieces: [piece(a, b, px)], gaps: [], drawingBreaks: 0 })
  const door: BoundaryGap = { id: 'gap-X-0-205-255', axis: 'X', linePx: 0, fromPx: 205, toPx: 255, widthM: 2.5, jambs: ['WALL', 'WALL'], strokes: [], signature: 'DASHED', cls: 'UNKNOWN_GAP', boundary: 'WEAK', occupancy: 'OPENING', why: 'test' }
  const wallsX: WallLine[] = [
    { axis: 'X', px: 0, from: 0, to: 260, pieces: [piece(0, 205, 0), piece(255, 260, 0)], gaps: [door], drawingBreaks: 0 },
    full('X', 80, 0, 260),
    full('X', 200, 0, 260),
    full('X', 300, 0, 260),
  ]
  const wallsY: WallLine[] = [
    full('Y', 0, 0, 300),
    { axis: 'Y', px: 100, from: 0, to: 300, pieces: [piece(80, 300, 100)], gaps: [], drawingBreaks: 0 },
    { axis: 'Y', px: 200, from: 0, to: 300, pieces: [piece(80, 300, 200)], gaps: [], drawingBreaks: 0 },
    full('Y', 260, 0, 300),
  ]
  const closed: OutlineEdge = { solid: 1, bridged: 0, closed: true }
  const open: OutlineEdge = { solid: 0, bridged: 0, closed: false }
  const vEdge: OutlineEdge[][] = []
  for (let ix = 0; ix <= nx; ix += 1) vEdge.push(Array.from({ length: ny }, () => ({ ...closed })))
  const hEdge: OutlineEdge[][] = []
  for (let iy = 0; iy <= ny; iy += 1) hEdge.push(Array.from({ length: nx }, () => ({ ...closed })))
  hEdge[1][0] = { ...open }
  hEdge[2][0] = { ...open } // garage row 1 -> its end, open
  vEdge[0][2] = { solid: 1 - 50 / 60, bridged: 50 / 60, closed: true } // the WEAK door, bridged in the reading
  const k = (ix: number, iy: number) => iy * nx + ix
  const inside = new Uint8Array(nx * ny).fill(1)
  const builtA = new Uint8Array(nx * ny).fill(1)
  builtA[k(0, 2)] = 0
  if (!houseRow2) {
    builtA[k(1, 2)] = 0
    builtA[k(2, 2)] = 0
    inside[k(1, 2)] = 0
    inside[k(2, 2)] = 0
  }
  const strictInside = new Uint8Array(inside)
  strictInside[k(0, 2)] = 0
  const outline = { inside, nx, ny, vEdge, hEdge, bridged: { strong: [], weak: [] }, pocketMouths: [], unjudged: 0, floods: 1 }
  const strict = { ...outline, inside: strictInside }
  const solid = { width: 300, height: 260, radius: 4, wallPx: 12, labels: new Int32Array(300 * 260), parts: [] }
  const r = completeBoundary({
    linesX: LX, linesY: LY, wallsX, wallsY, mppX: 0.05, mppY: 0.05, wallPx: 12, outline, strict,
    inA: new Uint8Array(nx * ny).fill(1), builtA, accepted: new Uint8Array(nx * ny), box: { x0: 0, y0: 0, x1: 300, y1: 260 }, extent: { x0: 0, y0: 0, x1: 300, y1: 260 }, solid, sides: [], chains: [],
  })
  return r.parts
}

describe('C5F-4 vehicle-door depth', () => {
  it('a side gap with 4 m of garage behind it is no vehicle door, whether or not the house behind the wall is built', () => {
    for (const houseRow2 of [true, false]) {
      const part = probe(houseRow2).find((p) => p.kind === 'BOX_COMPLETION')
      expect(part?.evidence.vehicleDoors, `house row built: ${houseRow2}`).toBe(0)
      expect(part?.decision, `house row built: ${houseRow2}`).not.toBe('ACCEPTED')
    }
  })
})
