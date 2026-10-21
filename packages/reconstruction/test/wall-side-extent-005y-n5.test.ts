/**
 * BUILDPLAN-ANALYZER-005Y-N5 (C3): a body side no chain prints the face of — a garage's side wall with a door in it —
 * stands on that wall, not on a room's dimension tick that has no wall there.
 *  - the wall sets its own grid line even when a scrap of ink lies beside it (bands are taken longest first);
 *  - the side stands on the wall's line — its axis, half a wall inside its outer face (known: a wall-only side is not
 *    moved to the face; doing so hid a printed-chain disagreement the structural audit has to see, see the report);
 *  - counterfactual: where a chain prints that face, the chain's position stands.
 */
import { describe, expect, it } from 'vitest'
import { runLengthBands } from '@buildapp/source-cv'
import { bandWallThickness, decomposePlan, gridLines, planExtent } from '../src/index.js'
import type { PlanDecomposition } from '../src/index.js'
import type { Band } from '@buildapp/source-cv'
import { CM_PER_PX, WALL, chain, mask, registration, sheet, walls } from './plan.js'

const BANDS = { minThickness: 6, maxThickness: 30, minLength: 24 }
const run = (r: ReturnType<typeof sheet>, chains: Parameters<typeof decomposePlan>[1]): PlanDecomposition => {
  const m = mask(r)
  const bands = runLengthBands(m, BANDS)
  const frame = planExtent(chains, bands, bandWallThickness(bands, WALL))
  if (!frame) throw new Error('the fixture has no frame')
  return decomposePlan(m, chains, bands, registration(), frame.rect)
}
const wing = (d: PlanDecomposition) => d.regions.filter((g) => g.classification === 'BUILT').find((g) => g.rect.y0 >= 200)

/**
 * A main body 40..439 × 40..211 and, under it, a wing 100..299 × 200..379 whose east wall (288..299) has a door in it
 * (y 260..300) and, optionally, a scrap of ink beside it. The overall chain prints the main body's faces only.
 */
function sheetWithWing(opts: { door?: boolean; scrap?: boolean } = {}): ReturnType<typeof sheet> {
  const r = sheet(520, 460)
  walls(r, 40, 40, 439, 211, [{ side: 'N', from: 120, to: 200 }])
  walls(r, 100, 200, 299, 379, [{ side: 'S', from: 150, to: 250 }, ...(opts.door !== false ? [{ side: 'E' as const, from: 260, to: 300 }] : [])])
  if (opts.scrap !== false) for (let y = 222; y < 252; y += 1) for (let x = 281; x < 287; x += 1) {
    const o = (y * r.width + x) * 4
    r.data[o] = r.data[o + 1] = r.data[o + 2] = 0
  }
  return r
}
// the overall chain, the wing's west face, and a room chain inside the wing ticking 10 px inside its east wall
const CHAINS = [chain('cx', 'HORIZONTAL', [40, 100, 440]), chain('room', 'HORIZONTAL', [120, 278]), chain('cy', 'VERTICAL', [40, 212, 380])]

describe('005Y-N5 a wing side only its wall draws', () => {
  // the east wall is drawn 288..299: its axis is 293.5
  it('stands on its wall, not on a room tick inside the wing, a scrap of ink beside the wall notwithstanding', () => {
    const w = wing(run(sheetWithWing(), CHAINS))
    expect(w).toBeDefined()
    expect(Math.abs((w?.rect.x1 ?? 0) - 293.5)).toBeLessThanOrEqual(1)
    expect(((w?.metric.x1 ?? 0) - (w?.metric.x0 ?? 0)) * 100).toBeGreaterThan((288 - 100) * CM_PER_PX)
  })
  it('the same without the scrap and without the door', () => {
    expect(Math.abs((wing(run(sheetWithWing({ scrap: false, door: false }), CHAINS))?.rect.x1 ?? 0) - 293.5)).toBeLessThanOrEqual(1)
  })
  it('counterfactual: where a chain prints the face, the chain\'s position stands', () => {
    const d = run(sheetWithWing(), [chain('cx', 'HORIZONTAL', [40, 100, 300, 440]), chain('cy', 'VERTICAL', [40, 212, 380])])
    expect(wing(d)?.rect.x1).toBe(300)
  })
})

describe('005Y-N5 a wall sets its own grid line before a scrap of ink beside it (Rarytasy: garage side wall)', () => {
  const vertical = (x0: number, x1: number, y0: number, y1: number): Band => ({ axis: 'VERTICAL', bounds: { x0, y0, x1, y1 }, thickness: x1 - x0 + 1, length: y1 - y0 + 1, fill: 1, axisPx: (x0 + x1) / 2 }) as Band
  // as the band reader returns them: the 23 px scrap (axis 410.5) before the 294 px wall (411..427, axis 419)
  const scrap = vertical(408, 413, 443, 465)
  const wall = vertical(411, 427, 467, 760)
  const extent = { x0: 100, y0: 100, x1: 740, y1: 760 }
  const room = chain('room', 'HORIZONTAL', [382, 402])
  it('the wall keeps a line at its own axis, carrying its length', () => {
    const { linesX } = gridLines([room], [scrap, wall], extent)
    const own = linesX.find((l) => Math.abs(l.px - 419) <= 1)
    expect(own).toBeDefined()
    expect(own?.support.bandLength).toBeGreaterThanOrEqual(wall.length)
  })
  it('the order the bands come in decides nothing', () => {
    const a = gridLines([room], [scrap, wall], extent).linesX.map((l) => [l.px, l.support.bandLength])
    const b = gridLines([room], [wall, scrap], extent).linesX.map((l) => [l.px, l.support.bandLength])
    expect(a).toEqual(b)
  })
})
