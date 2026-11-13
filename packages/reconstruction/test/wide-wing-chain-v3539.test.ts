/**
 * v3.53.9 — a wing beyond the long-band box whose side walls are not one band starting at the box's edge.
 *
 * The found cause, on public plans: the walled envelope is the box the long wall bands' axes span. A facade made only of
 * piers and openings (wide glazing, a garage gate) has no long band, so the box stops at an inner wall and every cell
 * beyond it is outside by construction. A bay (`baysOf`) brings such a wing back when two side walls leave the box and
 * the drawing shuts the mouth between their ends — but a side wall was taken only as ONE band STARTING at the box's
 * edge. A house wall that runs through the edge from inside the box, or that a glazing wider than a lintel breaks where
 * the edge falls, was not a side wall, and the wing stayed ground: the house lost its part beyond the box.
 *
 * The side wall is now the chain of collinear bands one wall line carries, joined across holes no wider than a lintel
 * or across a hole the wide-gap reader has already decided, on the drawing's evidence, is an opening in that very wall.
 * What shuts the mouth is unchanged: both side walls reach the far line, and a drawn infill or a matching callout.
 *
 * Scale 5 cm/px, walls 12 px (0.6 m). The fixture is drawn for this test; it is no drawing of any real building.
 */
import { describe, expect, it } from 'vitest'
import { runLengthBands } from '@buildapp/source-cv'
import { bandWallThickness, decomposePlan, planExtent } from '../src/index.js'
import type { PlanCallout, PlanDecomposition } from '../src/index.js'
import { WALL, chain, mask, registration, sheet } from './plan.js'
import { BLACK, drawLine, fillRect } from '../../source-cv/test/draw.js'
import type { Raster } from '@buildapp/source-cv'

const BANDS = { minThickness: 6, maxThickness: 30, minLength: 24 }

function run(r: Raster, chains: Parameters<typeof decomposePlan>[1], callouts: PlanCallout[] = []): PlanDecomposition {
  const m = mask(r)
  const bands = runLengthBands(m, BANDS)
  const wallPx = bandWallThickness(bands, WALL)
  const frame = planExtent(chains, bands, wallPx)
  if (!frame) throw new Error('the fixture has no frame')
  return decomposePlan(m, chains, bands, registration(), frame.rect, { callouts })
}
function classAt(d: PlanDecomposition, x: number, y: number): string {
  const cell = d.cells.find((c) => x >= c.rect.x0 && x < c.rect.x1 && y >= c.rect.y0 && y < c.rect.y1)
  if (!cell) throw new Error(`no cell at ${x}, ${y}`)
  return cell.classification
}
/** Two lines across a gap, inside the wall's thickness: glazing. */
const glazeH = (r: Raster, y0: number, from: number, to: number): void => {
  drawLine(r, from, y0 + 2, to, y0 + 2, BLACK)
  drawLine(r, from, y0 + WALL - 3, to, y0 + WALL - 3, BLACK)
}
const glazeV = (r: Raster, x0: number, from: number, to: number): void => {
  drawLine(r, x0 + 2, from, x0 + 2, to, BLACK)
  drawLine(r, x0 + WALL - 3, from, x0 + WALL - 3, to, BLACK)
}

type Front = 'GLAZED' | 'OPEN'
type Gate = 'LEAF' | 'NOTHING'
/**
 * A 12 × 18 m house, outer faces x 40..280, y 40..400, and a 8 × 10 m garage beside it, x 280..440, y 200..400. The
 * long bands: the north wall, the garage's north wall (y 200..211), the garage's east wall and the wall the two share.
 * The house's south front is short piers between two glazings — no long band — so the box stops at the garage's
 * north wall (y 200) and the house's south half lies beyond it. The house's west wall is broken by a 3.75 m glazing at
 * y 170..245, across the box's edge; the wall the house shares with the garage runs from y 40 to 400, through it.
 */
function plan(front: Front, gate: Gate, westGlazing = true): Raster {
  const r = sheet(500, 470)
  fillRect(r, 40, 40, 280, 51, BLACK) // house north wall
  fillRect(r, 269, 40, 280, 400, BLACK) // the wall house and garage share
  fillRect(r, 280, 200, 440, 211, BLACK) // garage north wall
  fillRect(r, 429, 200, 440, 400, BLACK) // garage east wall
  // house west wall, broken by a 3.75 m glazing at y 170..245
  fillRect(r, 40, 40, 51, 170, BLACK)
  fillRect(r, 40, 245, 51, 400, BLACK)
  if (westGlazing) glazeV(r, 40, 170, 245)
  // the house's south front: piers no longer than a band must be, kept clear of the corners; 3.5 m and 2.75 m gaps
  for (const [a, b] of [[40, 64], [135, 159], [215, 239]] as const) fillRect(r, a, 389, b, 400, BLACK)
  if (front === 'GLAZED') {
    glazeH(r, 389, 65, 134)
    glazeH(r, 389, 160, 214)
  }
  // the garage's south front: two piers and a 3.5 m gate between them
  fillRect(r, 305, 389, 324, 400, BLACK)
  fillRect(r, 395, 389, 414, 400, BLACK)
  if (gate === 'LEAF') drawLine(r, 325, 397, 394, 397, BLACK)
  return r
}
const chains = () => [chain('cx', 'HORIZONTAL', [40, 280, 440], { baselinePx: 20 }), chain('cy', 'VERTICAL', [40, 200, 400], { baselinePx: 20 })]

describe('v3.53.9: a wing whose side walls run through the box edge or across an opening', () => {
  it('the cause: the box stops at the garage’s inner wall and the house’s south half is beyond it', () => {
    const d = run(plan('GLAZED', 'LEAF'), chains())
    expect(d.envelope?.rect.y1).toBe(200)
  })

  it('the house’s south half is a bay with chained side walls, its glazed front shut — built, not ground', () => {
    const d = run(plan('GLAZED', 'LEAF'), chains())
    const bay = d.bays.find((b) => b.side === 'MAX_Z' && b.rect.x0 < 60)
    expect(bay?.sideWalls).toBe('CHAIN')
    expect(bay?.mouth.decision).toBe('OPENING_IN_WALL')
    expect(classAt(d, 150, 320)).toBe('BUILT')
    expect(classAt(d, 150, 120)).toBe('BUILT')
  })

  it('the west wall is chained across its 3.75 m glazing only because that glazing is decided an opening in it', () => {
    const d = run(plan('GLAZED', 'LEAF'), chains())
    const glazing = d.wideOpenings.find((w) => w.kind === 'COLLINEAR_GAP' && w.axis === 'X' && Math.abs(w.widthM - 3.75) < 0.2)
    expect(glazing?.decision).toBe('OPENING_IN_WALL')
  })

  it('counter-case: a front of posts with nothing across its gaps (a portico) stays open — the south half is ground', () => {
    const d = run(plan('OPEN', 'LEAF'), chains())
    const bay = d.bays.find((b) => b.side === 'MAX_Z' && b.rect.x0 < 60)
    expect(bay?.mouth.decision).toBe('OPEN_SIDE')
    expect(classAt(d, 150, 320)).not.toBe('BUILT')
  })

  it('counter-case: a callout of the mouth’s very width printed at the neighbouring opening (the west glazing) does not shut the mouth', () => {
    // 350 cm is the width of the front's widest gap; the callout stands beside the west wall's glazing, not at the front
    const callouts: PlanCallout[] = [{ id: 'c-west', at: { x: 22, y: 207 }, widthsCm: [{ value: 350, confidence: 0.9 }] }]
    const d = run(plan('OPEN', 'LEAF'), chains(), callouts)
    const bay = d.bays.find((b) => b.side === 'MAX_Z' && b.rect.x0 < 60)
    expect(bay?.mouth.decision).toBe('OPEN_SIDE')
    expect(classAt(d, 150, 320)).not.toBe('BUILT')
  })

  it('counter-case: the garage with nothing drawn across its mouth (a carport) stays open', () => {
    const d = run(plan('GLAZED', 'NOTHING'), chains())
    expect(classAt(d, 360, 320)).not.toBe('BUILT')
    expect(classAt(d, 150, 320)).toBe('BUILT')
  })

  it('the garage behind a drawn gate is built', () => {
    const d = run(plan('GLAZED', 'LEAF'), chains())
    expect(classAt(d, 360, 320)).toBe('BUILT')
  })
})
