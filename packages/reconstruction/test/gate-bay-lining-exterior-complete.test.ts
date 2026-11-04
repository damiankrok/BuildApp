/**
 * EXTERIOR-COMPLETE (Bakopy, disclosed DEV house): a garage behind a wide gate whose back wall stands behind a row of
 * built-in cupboards.
 *
 * The first wrong decision: the plan draws the cupboards' front as line work on the grid line where the house's face
 * runs on, and the wall that closes the garage a cupboard's depth behind it. The gate rule read wall only on cell
 * edges, saw 27 % of a back wall, and never weighed the garage; its door into the house stands in that wall too, and
 * the gate's piers on the mouth's line were grazed by the band reader and only read off the ink for a door-sized hole.
 * The garage was ground, the model lost it.
 *
 * The fixture is drawn here, cell by cell and pixel by pixel, at 0.05 m per pixel: a 6.0 × 6.0 m pocket, side walls
 * 0.4 m, a 0.4 m partition 0.6 m behind the cupboards' front with a 0.8 m door in it, and a 4.0 m gate between two
 * 1.0 m piers on the mouth's line.
 */
import { describe, expect, it } from 'vitest'
import type { Mask } from '@buildapp/source-cv'
import { shutGateBays } from '../src/plan-decomposition.js'
import type { EdgeClosure, GridLine, PlanCell } from '../src/plan-decomposition.js'

const MPP = 0.05
const W = 200
const H = 260
const WALL_PX = 8

function mask(draw: (fill: (x0: number, y0: number, x1: number, y1: number) => void) => void): Mask {
  const data = new Uint8Array(W * H)
  draw((x0, y0, x1, y1) => {
    for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) data[y * W + x] = 1
  })
  return { width: W, height: H, data } as unknown as Mask
}

const line = (axis: 'X' | 'Y', px: number): GridLine => ({ axis, px, probesPx: [px], support: { chainIds: [] }, confidence: 1, why: 'fixture' }) as unknown as GridLine
const LINES_X = [line('X', 10), line('X', 70), line('X', 130)]
/** row 0: the cupboards' row (built, the house behind it); rows 1–2: the garage; row 3: the ground before its gate */
const LINES_Y = [line('Y', 20), line('Y', 50), line('Y', 110), line('Y', 170), line('Y', 200)]
const edge = (wall: number, l = wall): EdgeClosure => ({ wall, line: l, opening: 0, closure: Math.max(wall, l) })

function cells(): PlanCell[] {
  const out: PlanCell[] = []
  for (let iy = 0; iy < 4; iy += 1) {
    for (let ix = 0; ix < 2; ix += 1) {
      const rect = { x0: LINES_X[ix].px, y0: LINES_Y[iy].px, x1: LINES_X[ix + 1].px, y1: LINES_Y[iy + 1].px }
      const built = iy === 0
      // the side walls on the outer edges; the cupboards' front drawn as a line on the garage's top edge, no wall there
      const top = iy === 0 ? edge(1) : iy === 1 ? edge(0, 1) : edge(0)
      const left = ix === 0 && iy < 3 ? edge(1) : edge(0)
      const right = ix === 1 && iy < 3 ? edge(1) : edge(0)
      const bottom = iy === 0 ? edge(0, 1) : edge(0)
      out.push({ ix, iy, rect, classification: built ? 'BUILT' : 'OUTSIDE', edges: [top, right, bottom, left], enclosed: built, interiorInk: 0, confidence: 0.8, why: 'fixture' })
    }
  }
  return out
}

/** The ink: side walls, the partition behind the cupboards (with or without its door), the piers, the cupboards' lines. */
function ink(o: { door: boolean; partitionAt?: number }): Mask {
  return mask((fill) => {
    fill(2, 20, 10, 172) // left wall
    fill(130, 20, 138, 172) // right wall
    const py = o.partitionAt ?? 30
    if (o.door) {
      fill(10, py, 94, py + WALL_PX)
      fill(110, py, 130, py + WALL_PX)
    } else fill(10, py, 130, py + WALL_PX)
    fill(2, 160, 30, 172) // the gate's piers, drawn across the mouth's line
    fill(110, 160, 138, 172)
    fill(10, 50, 90, 51) // the cupboards' front, one pixel of line work, and their diagonals
    for (let k = 0; k < 12; k += 1) fill(10 + k * 6, 38 + k, 11 + k * 6, 39 + k)
  })
}

function run(m: Mask) {
  const cs = cells()
  const byKey = new Map(cs.map((c) => [`${c.ix}:${c.iy}`, c]))
  const bays = shutGateBays({ mask: m, cells: cs, byKey, linesX: LINES_X, linesY: LINES_Y, inside: [], tolerance: 3, minJambPx: 4, maxOpeningPx: 3.2 / MPP, maxWidePx: 7.0 / MPP, mppX: MPP, mppY: MPP, wallM: WALL_PX * MPP, wallPx: WALL_PX, chains: [] })
  return { bays, cells: cs }
}

describe('EXTERIOR-COMPLETE: a garage whose back wall stands behind its cupboards', () => {
  it('the wall behind the lining closes the back, the door in it says the hole is a gate, the piers are its jambs: built', () => {
    const { bays, cells: cs } = run(ink({ door: true }))
    const bay = bays.find((b) => b.decision === 'GATE_SHUT')
    expect(bay?.why).toMatch(/doorway in the wall behind its top lining leads into the building/)
    expect(bay?.gapM).toBeCloseTo(4.0, 1)
    expect(bay?.depthM).toBeCloseTo(6.0, 1)
    for (const c of cs.filter((x) => x.iy === 1 || x.iy === 2)) expect(c.classification).toBe('BUILT')
    // the ground before the gate stays ground
    for (const c of cs.filter((x) => x.iy === 3)) expect(c.classification).toBe('OUTSIDE')
  })

  it('without a door in that wall nothing says the hole is a gate: weighed, named, left open', () => {
    const { bays, cells: cs } = run(ink({ door: false }))
    expect(bays.some((b) => b.decision === 'GATE_SHUT')).toBe(false)
    expect(bays.find((b) => b.decision === 'LEFT_OPEN')?.why).toMatch(/nothing says its mouth is a gate/)
    for (const c of cs.filter((x) => x.iy === 1)) expect(c.classification).toBe('OUTSIDE')
  })

  it('a wall further back than a lining is not this pocket’s back wall: the pocket stays open', () => {
    // the partition 2.1 m behind the cupboards' front (rows 0..8): no lining is that deep
    const far = run(mask((fill) => {
      fill(2, 0, 10, 172)
      fill(130, 0, 138, 172)
      fill(10, 0, 94, 8)
      fill(110, 0, 130, 8)
      fill(2, 160, 30, 172)
      fill(110, 160, 138, 172)
    }))
    expect(far.bays.some((b) => b.decision === 'GATE_SHUT')).toBe(false)
  })
})
