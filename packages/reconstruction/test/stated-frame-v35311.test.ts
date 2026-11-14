/**
 * v3.53.11 — the frame a fully read overall dimension states, where the wall witness runs on past it.
 *
 * The found cause, on a public plan: the wall witness (the largest group of wall-thick ink joined within two walls)
 * took in ink beside the building — the letters of the publisher's logo printed under the plan and the low walls of a
 * driveway running on past the garage gate. Against that witness the overall lines drawn under the plan met "walls" on
 * both sides and were taken for lines across a room (INTERIOR); the frame then came from the witness alone: the logo
 * inside it became bodies, and a wing of the house drawn in thinner walls fell outside it.
 *
 * Now a chain whose every segment was read, drawn beside the building and spanning most of the witness states the
 * building's extent on its axis: ink beyond its end ticks is cut from the witness, the other axis's chains are judged
 * against the cut witness, and the frame is the read chain on its axis and an exterior chain's ticks on the other, each
 * side snapped outward to the outer face of a long wall band its tick falls in.
 *
 * Scale 5 cm/px, walls 12 px. The fixture is drawn for this test; it is no drawing of any real building.
 */
import { describe, expect, it } from 'vitest'
import { runLengthBands } from '@buildapp/source-cv'
import type { Raster } from '@buildapp/source-cv'
import type { DimensionChain } from '@buildapp/source-metrics'
import { bandWallThickness, decomposePlan, planExtent } from '../src/index.js'
import type { PlanDecomposition } from '../src/index.js'
import { wallWitness } from '../src/plan-extent.js'
import { WALL, chain, mask, registration, sheet, walls } from './plan.js'
import { BLACK, fillRect } from '../../source-cv/test/draw.js'

const BANDS = { minThickness: 6, maxThickness: 30, minLength: 24 }

/** A 18 × 13 m house, outer faces x 40..400, y 40..300, a partition at x 220. */
function house(r: Raster): void {
  walls(r, 40, 40, 400, 300)
  fillRect(r, 216, 40, 222, 300, BLACK)
}
/** Low walls of a driveway running on past the south face, and a logo of thick letters just below their ends. */
function driveAndLogo(r: Raster): void {
  fillRect(r, 260, 300, 271, 342, BLACK)
  fillRect(r, 389, 300, 400, 342, BLACK)
  for (const x of [270, 300, 330, 360]) {
    fillRect(r, x, 346, x + 11, 368, BLACK) // letter stems
    fillRect(r, x, 346, x + 24, 357, BLACK) // letter bars
  }
}
const depthRead = (): DimensionChain => chain('depth', 'VERTICAL', [40, 160, 300], { baselinePx: 12 })
/** The overall line under the plan, unread (no OCR value), ticks on the outer faces. */
const widthUnread = (baselinePx: number, ticks: number[] = [40, 220, 400]): DimensionChain => chain('width', 'HORIZONTAL', ticks, { baselinePx, read: false })

function read(r: Raster, chains: DimensionChain[]): { rect: { x0: number; y0: number; x1: number; y1: number }; why: string; d: PlanDecomposition } {
  const m = mask(r)
  const bands = runLengthBands(m, BANDS)
  const wallPx = bandWallThickness(bands, WALL)
  const witness = wallWitness(bands, wallPx, m)
  const extent = planExtent(chains, bands, wallPx, witness)
  if (!extent) throw new Error('no extent')
  return { rect: extent.rect, why: extent.why, d: decomposePlan(m, chains, bands, registration(), extent.rect) }
}
const built = (d: PlanDecomposition, x: number, y: number): boolean => d.cells.some((c) => x >= c.rect.x0 && x < c.rect.x1 && y >= c.rect.y0 && y < c.rect.y1 && c.classification === 'BUILT')
const near = (a: number, b: number): boolean => Math.abs(a - b) <= 1

describe('v3.53.11: the frame a read overall line states, where the wall witness runs on past it', () => {
  it('the cause: driveway walls and a logo below the plan stay outside the frame; the frame is the house', () => {
    const r = sheet(480, 440)
    house(r)
    driveAndLogo(r)
    const { rect, why, d } = read(r, [depthRead(), widthUnread(324)])
    expect(near(rect.y1, 300)).toBe(true)
    expect(near(rect.x0, 40) && near(rect.x1, 400) && near(rect.y0, 40)).toBe(true)
    expect(why).toMatch(/states the building's depth/)
    expect(built(d, 120, 170) && built(d, 320, 170)).toBe(true)
    expect(built(d, 320, 360)).toBe(false) // the logo is no body
    expect(built(d, 330, 320)).toBe(false) // the driveway past the gate stays open
  })

  it('counter-case: no ink beyond the read line — the frame is read as before (no stated frame)', () => {
    const r = sheet(480, 440)
    house(r)
    const { why } = read(r, [depthRead(), widthUnread(324)])
    expect(why).not.toMatch(/states the building's depth/)
  })

  it('counter-case: a read chain that does not span most of the witness (a room dimension) states nothing', () => {
    const r = sheet(480, 440)
    house(r)
    driveAndLogo(r)
    const { why } = read(r, [chain('room', 'VERTICAL', [40, 160], { baselinePx: 12 }), widthUnread(324)])
    expect(why).not.toMatch(/states the building's depth/)
  })

  it('counter-case: a chain with an unread segment is no statement — only a fully read line states the extent', () => {
    const r = sheet(480, 440)
    house(r)
    driveAndLogo(r)
    const partly = depthRead()
    partly.segments = partly.segments.map((s, i) => (i === 1 ? { ...s, origin: 'DERIVED' as const } : s))
    const { why } = read(r, [partly, widthUnread(324)])
    expect(why).not.toMatch(/states the building's depth/)
  })

  it('a tick inside the wall band snaps the side to the wall’s outer face (outward only)', () => {
    const r = sheet(480, 440)
    house(r)
    driveAndLogo(r)
    const { rect, why } = read(r, [depthRead(), widthUnread(324, [44, 220, 394])])
    expect(why).toMatch(/states the building's depth/)
    expect(near(rect.x0, 40) && near(rect.x1, 400)).toBe(true)
  })

  it('counter-case: no exterior line on the other axis — nothing is stated, the frame is read as before', () => {
    const r = sheet(480, 440)
    house(r)
    driveAndLogo(r)
    const { why } = read(r, [depthRead()])
    expect(why).not.toMatch(/states the building's depth/)
  })

  it('counter-case: a real wing beyond a read chain that measures only the main body, the overall line within the span — nothing is cut', () => {
    const r = sheet(480, 440)
    house(r)
    walls(r, 40, 288, 200, 380) // a closed wing south of the main body, under it
    // the read line measures the main body only; the unread overall line is drawn west of the plan, inside the stated depth
    const { why, d } = read(r, [depthRead(), chain('width', 'HORIZONTAL', [40, 220, 400], { baselinePx: 150, read: false })])
    expect(why).not.toMatch(/states the building's depth/)
    expect(d.cells.length).toBeGreaterThan(0)
  })
})
