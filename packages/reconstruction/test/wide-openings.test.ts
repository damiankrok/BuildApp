/**
 * Wide openings and open sides (BUILDAPP-03Y2G §18).
 *
 * A width alone cannot tell a 5 m double garage door from the open side of a
 * carport, or a 6 m sliding glass wall from the mouth of a loggia. These
 * fixtures draw each case the way a plan draws it and assert what the
 * decomposition must conclude: a wide opening IN a wall keeps the building
 * enclosed when the drawing says so (a door or glazing drawn across it, a
 * callout printing its width, the interior behind it), and a side the drawing
 * leaves open stays open.
 *
 * Scale 5 cm/px, walls 12 px (0.6 m). Nothing here is a drawing of any real
 * building.
 */
import { describe, expect, it } from 'vitest'
import { runLengthBands } from '@buildapp/source-cv'
import { bandWallThickness, decomposePlan, planExtent } from '../src/index.js'
import type { PlanCallout, PlanDecomposition } from '../src/index.js'
import { WALL, chain, glazing, mask, registration, sheet, walls } from './plan.js'
import { BLACK, drawLine, fillRect } from '../../source-cv/test/draw.js'
import type { Raster } from '@buildapp/source-cv'

const BANDS = { minThickness: 6, maxThickness: 30, minLength: 24 }
const WHITE: [number, number, number] = [255, 255, 255]

function run(r: Raster, chains: Parameters<typeof decomposePlan>[1], callouts: PlanCallout[] = []): PlanDecomposition {
  const m = mask(r)
  const bands = runLengthBands(m, BANDS)
  const wallPx = bandWallThickness(bands, WALL)
  const frame = planExtent(chains, bands, wallPx)
  if (!frame) throw new Error('the fixture has no frame')
  return decomposePlan(m, chains, bands, registration(), frame.rect, { callouts })
}

/** The class of the cell a pixel falls in. */
function classAt(d: PlanDecomposition, x: number, y: number): string {
  const cell = d.cells.find((c) => x >= c.rect.x0 && x < c.rect.x1 && y >= c.rect.y0 && y < c.rect.y1)
  if (!cell) throw new Error(`no cell at ${x}, ${y}`)
  return cell.classification
}

const builtBodies = (d: PlanDecomposition) => d.regions.filter((g) => g.classification === 'BUILT')

/** A 16 × 12 m house, outer faces x 40..360, y 40..280; its front (the sheet's bottom) with the openings given. */
function house(openings: Parameters<typeof walls>[5] = []): Raster {
  const r = sheet(460, 480)
  walls(r, 40, 40, 359, 279, openings)
  return r
}
const houseChains = (extraX: number[] = [], extraY: number[] = []) => [
  chain('cx', 'HORIZONTAL', [40, ...extraX, 360].sort((a, b) => a - b), { baselinePx: 20 }),
  chain('cy', 'VERTICAL', [40, ...extraY, 280].sort((a, b) => a - b), { baselinePx: 20 }),
]

describe('a wide opening in a wall keeps the building enclosed where the drawing says so', () => {
  it('1. a 2.4 m opening: shut by the width convention, as before', () => {
    const d = run(house([{ side: 'S', from: 150, to: 197 }]), houseChains())
    expect(classAt(d, 200, 160)).toBe('BUILT')
    expect(builtBodies(d)).toHaveLength(1)
  })

  it('2. a 3.5 m opening with glazing drawn across it', () => {
    const r = house([{ side: 'S', from: 150, to: 219 }])
    glazing(r, 'H', 268, 150, 219)
    const d = run(r, houseChains())
    expect(classAt(d, 200, 160)).toBe('BUILT')
  })

  it('3. a 5.0 m double garage door in a wall that carries on either side: one drawn leaf line, off the grid line', () => {
    const r = house([{ side: 'S', from: 120, to: 219 }])
    drawLine(r, 120, 272, 219, 272, BLACK)
    const d = run(r, houseChains())
    expect(classAt(d, 200, 160)).toBe('BUILT')
    const gap = d.wideOpenings.find((w) => w.kind === 'COLLINEAR_GAP' && Math.abs(w.widthM - 5) < 0.2)
    expect(gap?.decision).toBe('OPENING_IN_WALL')
    expect(gap?.evidence.infill).toBeGreaterThanOrEqual(0.7)
  })

  it('4. a 6.0 m glazed opening', () => {
    const r = house([{ side: 'S', from: 100, to: 219 }])
    glazing(r, 'H', 268, 100, 219)
    const d = run(r, houseChains())
    expect(classAt(d, 200, 160)).toBe('BUILT')
  })

  it('a 7 m gap with nothing drawn across it, into the building’s interior, is still a hole in a wall, not an open side', () => {
    // 7 m of a 16 m front: the width convention alone would open the edge and flood the house
    const d = run(house([{ side: 'S', from: 130, to: 269 }]), houseChains())
    expect(classAt(d, 200, 160)).toBe('BUILT')
    const gap = d.wideOpenings.find((w) => w.kind === 'COLLINEAR_GAP')
    expect(gap?.decision).toBe('OPENING_IN_WALL')
    expect(gap?.evidence.pocketM2).toBeGreaterThan(100)
    expect(d.chosenHypothesis).toBe('H1_WIDE_OPENING_CONTINUITY')
    // H0 is still recorded, and would have lost the house
    expect(d.hypotheses.find((h) => h.id === 'H0_STRICT_ENCLOSURE')?.builtCells).toBe(0)
  })

  it('8. two openings separated by a narrow pier', () => {
    const d = run(house([{ side: 'S', from: 120, to: 167 }, { side: 'S', from: 178, to: 225 }]), houseChains())
    expect(classAt(d, 200, 160)).toBe('BUILT')
  })

  it('9. an opening near a corner', () => {
    const d = run(house([{ side: 'S', from: 55, to: 102 }]), houseChains())
    expect(classAt(d, 200, 160)).toBe('BUILT')
  })
})

describe('a bay reaching out of the building: a garage when its mouth is shut, a carport when it is not', () => {
  /** Two 0.6 m side walls leaving the front, outer faces x 100..232, reaching y 400. */
  function withBay(front: 'NOTHING' | 'DOOR' | 'PIERS'): Raster {
    const r = house([{ side: 'S', from: 112, to: 219 }])
    fillRect(r, 100, 268, 111, 388, BLACK)
    fillRect(r, 220, 268, 231, 388, BLACK)
    if (front !== 'NOTHING') {
      // piers at both front corners, a wall's thickness deep
      fillRect(r, 100, 389, 131, 400, BLACK)
      fillRect(r, 200, 389, 231, 400, BLACK)
    }
    if (front === 'DOOR') drawLine(r, 132, 392, 199, 392, BLACK)
    return r
  }
  const bayChains = () => houseChains([100, 232], [400])

  it('5. a truly open carport: side walls and nothing across the mouth — the bay is ground and the house one body', () => {
    const d = run(withBay('NOTHING'), bayChains())
    expect(classAt(d, 166, 340)).toBe('OUTSIDE')
    expect(classAt(d, 300, 160)).toBe('BUILT')
    expect(d.bays).toHaveLength(1)
    expect(d.bays[0].mouth.decision).toBe('OPEN_SIDE')
  })

  it('a double garage: piers and the door leaf drawn across the mouth — the bay is built, a second body', () => {
    const d = run(withBay('DOOR'), bayChains())
    expect(d.bays[0].mouth.decision).toBe('OPENING_IN_WALL')
    expect(d.bays[0].mouth.evidence.corners).toBe(true)
    expect(classAt(d, 166, 340)).toBe('BUILT')
    expect(builtBodies(d).length).toBeGreaterThanOrEqual(2)
  })

  it('a double garage whose door is not drawn but whose callout prints the mouth’s width', () => {
    // the mouth between the piers: 132..199 px = 3.4 m
    const callouts: PlanCallout[] = [{ id: 'c1', at: { x: 166, y: 410 }, widthsCm: [{ value: 340, confidence: 0.6 }] }]
    const d = run(withBay('PIERS'), bayChains(), callouts)
    expect(d.bays[0].mouth.decision).toBe('OPENING_IN_WALL')
    expect(d.bays[0].mouth.evidence.callout?.widthCm).toBe(340)
    expect(classAt(d, 166, 340)).toBe('BUILT')
  })

  it('piers alone, with no door and no callout, do not shut a mouth', () => {
    const d = run(withBay('PIERS'), bayChains())
    expect(d.bays[0].mouth.decision).toBe('OPEN_SIDE')
    expect(classAt(d, 166, 340)).toBe('OUTSIDE')
  })
})

describe('the sides a building leaves open stay open', () => {
  it('6. a loggia mouth: returns at both ends, a back wall, nothing across — a pocket, not a room', () => {
    // a 5 m × 3 m pocket in the front, returns at x 138..149 and 250..261, back wall at y 208..219
    const r = house([{ side: 'S', from: 150, to: 249 }])
    fillRect(r, 138, 208, 261, 219, BLACK)
    fillRect(r, 138, 208, 149, 279, BLACK)
    fillRect(r, 250, 208, 261, 279, BLACK)
    const d = run(r, houseChains([150, 250], [220]))
    expect(classAt(d, 200, 250)).not.toBe('BUILT')
    expect(classAt(d, 80, 160)).toBe('BUILT')
    const gap = d.wideOpenings.find((w) => w.kind === 'COLLINEAR_GAP')
    if (gap) {
      expect(gap.decision).toBe('OPEN_SIDE')
      expect(gap.evidence.pocketM2).toBeLessThan(20)
    }
  })

  it('a loggia whose back glazing callout matches its mouth is still open: a callout alone never shuts a gap in a wall', () => {
    const r = house([{ side: 'S', from: 150, to: 249 }])
    fillRect(r, 138, 208, 261, 219, BLACK)
    fillRect(r, 138, 208, 149, 279, BLACK)
    fillRect(r, 250, 208, 261, 279, BLACK)
    const callouts: PlanCallout[] = [{ id: 'c1', at: { x: 200, y: 290 }, widthsCm: [{ value: 500, confidence: 0.7 }] }]
    const d = run(r, houseChains([150, 250], [220]), callouts)
    expect(classAt(d, 200, 250)).not.toBe('BUILT')
  })

  it('7. a terrace recess at a corner: shut on two sides only — ground', () => {
    const r = sheet(460, 480)
    fillRect(r, 40, 40, 359, 51, BLACK) // rear
    fillRect(r, 40, 40, 51, 279, BLACK) // left
    fillRect(r, 40, 268, 279, 279, BLACK) // front, stopping at the recess
    fillRect(r, 268, 220, 279, 279, BLACK) // the recess's side
    fillRect(r, 268, 220, 359, 231, BLACK) // the recess's back
    fillRect(r, 348, 40, 359, 231, BLACK) // right, stopping at the recess
    const d = run(r, houseChains([280], [220]))
    expect(classAt(d, 320, 250)).not.toBe('BUILT')
    expect(classAt(d, 150, 150)).toBe('BUILT')
  })

  it('10. hatching and a leader line outside the walls are not walls: the house stays one body of its own size', () => {
    const r = house([{ side: 'S', from: 150, to: 197 }])
    for (let k = 0; k < 16; k += 1) drawLine(r, 380 + k * 4, 300, 380 + k * 4 + 40, 460, BLACK)
    drawLine(r, 30, 300, 430, 300, BLACK)
    fillRect(r, 390, 60, 440, 64, BLACK) // a heavy stroke of annotation, short
    const d = run(r, houseChains())
    expect(builtBodies(d)).toHaveLength(1)
    const body = builtBodies(d)[0]
    expect([body.metric.x1 - body.metric.x0, body.metric.z1 - body.metric.z0].map((v) => Number(v.toFixed(2)))).toEqual([16, 12])
    expect(classAt(d, 200, 160)).toBe('BUILT')
  })
})

void WHITE
