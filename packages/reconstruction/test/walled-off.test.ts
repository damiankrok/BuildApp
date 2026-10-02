import { describe, expect, it } from 'vitest'
import { completeBoundary } from '../src/index.js'
import type { CompletionPart, LinePiece, OutlineEdge, WallLine } from '../src/index.js'

/**
 * 005F post-review C5F-2 and D5F-12: floor beside a part behind a wall is split off only when one could stand in it —
 * a door's width across both ways. A hand-built grid (5 cm/px) of three cells in a row: the house (15 × 5 m, built),
 * the part (5 × 5 m, open to the house), and floor behind a solid edge of the part, `widthPx` deep. The row is laid
 * along either axis, either way round: the rule reads the same any way up.
 */
type Orientation = { swap: boolean; mirror: boolean }
const ORIENTATIONS: Record<string, Orientation> = {
  'along x': { swap: false, mirror: false },
  'along x, mirrored': { swap: false, mirror: true },
  'along y': { swap: true, mirror: false },
  'along y, mirrored': { swap: true, mirror: true },
}

function judge(widthPx: number, o: Orientation): { parts: CompletionPart[]; span: (p: CompletionPart) => [number, number]; at: (along: number) => number } {
  const sizes = o.mirror ? [widthPx, 100, 300] : [300, 100, widthPx]
  const along = sizes.reduce<number[]>((xs, s) => [...xs, xs[xs.length - 1] + s], [0])
  const total = along[3]
  const across = [0, 100]
  const LX = o.swap ? across : along
  const LY = o.swap ? along : across
  const nx = LX.length - 1
  const ny = LY.length - 1
  const piece = (from: number, to: number, axisPx: number): LinePiece => ({ from, to, axisPx, kind: 'WALL', partId: 0, along: true })
  const full = (axis: 'X' | 'Y', px: number, a: number, b: number): WallLine => ({ axis, px, from: a, to: b, pieces: [piece(a, b, px)], gaps: [], drawingBreaks: 0 })
  const wallsX: WallLine[] = LX.map((x) => full('X', x, 0, LY[ny]))
  const wallsY: WallLine[] = LY.map((y) => full('Y', y, 0, LX[nx]))
  const closed: OutlineEdge = { solid: 1, bridged: 0, closed: true }
  const vEdge: OutlineEdge[][] = LX.map(() => Array.from({ length: ny }, () => ({ ...closed })))
  const hEdge: OutlineEdge[][] = LY.map(() => Array.from({ length: nx }, () => ({ ...closed })))
  // house → part: open (the line between them is the second in plan order, or the third when mirrored)
  const open = o.mirror ? 2 : 1
  if (o.swap) hEdge[open][0] = { solid: 0, bridged: 0, closed: false }
  else vEdge[open][0] = { solid: 0, bridged: 0, closed: false }
  const inside = new Uint8Array(nx * ny).fill(1)
  const builtA = new Uint8Array(nx * ny)
  builtA[o.mirror ? 2 : 0] = 1
  const outline = { inside, nx, ny, vEdge, hEdge, bridged: { strong: [], weak: [] }, pocketMouths: [], unjudged: 0, floods: 1 }
  const solid = { width: LX[nx], height: LY[ny], radius: 4, wallPx: 12, labels: new Int32Array(LX[nx] * LY[ny]), parts: [] }
  const extent = { x0: 0, y0: 0, x1: LX[nx], y1: LY[ny] }
  const parts = completeBoundary({ linesX: LX, linesY: LY, wallsX, wallsY, mppX: 0.05, mppY: 0.05, wallPx: 12, outline, strict: outline, inA: new Uint8Array(nx * ny).fill(1), builtA, accepted: new Uint8Array(nx * ny), box: extent, extent, solid, sides: [], chains: [] }).parts
  // every probe in the row's own coordinate: 0 at the house's far end, increasing towards the floor behind the part
  const at = (a: number): number => (o.mirror ? total - a : a)
  const span = (p: CompletionPart): [number, number] => {
    const [lo, hi] = o.swap ? [p.rect.y0, p.rect.y1] : [p.rect.x0, p.rect.x1]
    return o.mirror ? [total - hi, total - lo] : [lo, hi]
  }
  return { parts, span, at }
}

describe('floor behind a wall beside a part (C5F-2, D5F-12)', () => {
  for (const [name, o] of Object.entries(ORIENTATIONS)) {
    it(`narrower than a door (a reveal, a niche) stays with the part’s walls, nothing is split off — ${name}`, () => {
      const { parts, span } = judge(10, o) // 0.5 m
      expect(parts.some((p) => p.reason.startsWith('WALLED_OFF'))).toBe(false)
      const part = parts.find((p) => p.kind === 'BOX_COMPLETION')
      expect(part?.decision, part?.reason).toBe('ACCEPTED')
      if (part) expect(span(part)).toEqual([300, 410])
    })
    it(`a room’s width (3 m) is split off, recorded WALLED_OFF, and the part ends at its own wall — ${name}`, () => {
      const { parts, span } = judge(60, o)
      const part = parts.find((p) => p.kind === 'BOX_COMPLETION' && p.decision === 'ACCEPTED')
      expect(part && span(part)).toEqual([300, 400])
      const walled = parts.filter((p) => p.decision === 'REJECTED' && p.reason.startsWith('WALLED_OFF'))
      expect(walled.map(span)).toEqual([[400, 460]])
    })
  }
})
