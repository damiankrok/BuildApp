import { describe, expect, it } from 'vitest'
import { runLengthBands } from '@buildapp/source-cv'
import { bandWallThickness, decomposePlan, gridLines, planExtent } from '../src/index.js'
import type { PlanDecomposition } from '../src/index.js'
import { CM_PER_PX, WALL, chain, glazing, mask, partition, registration, sheet, walls } from './plan.js'

const BANDS = { minThickness: 6, maxThickness: 30, minLength: 24 }

const run = (r: ReturnType<typeof sheet>, chains: Parameters<typeof decomposePlan>[1]): PlanDecomposition => {
  const m = mask(r)
  const bands = runLengthBands(m, BANDS)
  const wallPx = bandWallThickness(bands, WALL)
  const frame = planExtent(chains, bands, wallPx)
  if (!frame) throw new Error('the fixture has no frame')
  return decomposePlan(m, chains, bands, registration(), frame.rect)
}

const built = (d: PlanDecomposition) => d.regions.filter((g) => g.classification === 'BUILT')
const size = (g: { metric: { x0: number; z0: number; x1: number; z1: number } }) => [Number((g.metric.x1 - g.metric.x0).toFixed(2)), Number((g.metric.z1 - g.metric.z0).toFixed(2))]

/** FIXTURE A — a plain rectangle. The decomposition is allowed to say "one box" when one box is the truth. */
describe('a rectangular building', () => {
  const r = sheet(400, 400)
  walls(r, 40, 40, 279, 319, [
    { side: 'N', from: 120, to: 200 },
    { side: 'S', from: 100, to: 180 },
    { side: 'W', from: 150, to: 230 },
  ])
  partition(r, 40, 180, 279, 185)
  const d = run(r, [chain('cx', 'HORIZONTAL', [40, 280]), chain('cy', 'VERTICAL', [40, 320])])

  it('finds one mass, the size of the building', () => {
    expect(built(d).length).toBe(1)
    expect(size(built(d)[0])).toEqual([12, 14])
  })

  it('puts the walled envelope on the outer faces the chains measured to', () => {
    expect(d.envelope?.rect).toEqual({ x0: 40, y0: 40, x1: 280, y1: 320 })
  })

  it('measures the wall thickness off the drawing', () => {
    expect(d.wallThickness.px).toBe(WALL)
    expect(d.wallThickness.m).toBeCloseTo((WALL * CM_PER_PX) / 100, 6)
  })
})

/** FIXTURE B — a main body with a lower, shallower wing attached along one side. */
describe('a building with an attached wing', () => {
  const r = sheet(520, 460)
  walls(r, 40, 40, 279, 379, [{ side: 'S', from: 120, to: 200 }])
  walls(r, 268, 200, 439, 379, [{ side: 'S', from: 320, to: 400 }])
  const chains = [chain('cx', 'HORIZONTAL', [40, 280, 440]), chain('cy', 'VERTICAL', [40, 200, 380])]
  const d = run(r, chains)

  it('finds two masses, not one rectangle over both', () => {
    expect(built(d).length).toBe(2)
  })

  it('gives each mass the size its own walls have', () => {
    const sizes = built(d).map(size)
    expect(sizes).toContainEqual([12, 17])
    expect(sizes).toContainEqual([8, 9])
  })

  it('does not put the wing under the main body', () => {
    const wing = built(d).find((g) => size(g)[0] === 8)
    expect(wing?.metric.z0).toBe(10)
  })

  it('keeps the shared wall as a grid line both a chain and a wall agree on', () => {
    const shared = d.linesX.find((l) => l.px === 280)
    expect(shared?.support.printedChainIds.length).toBe(1)
    expect(shared?.support.bandLength).toBeGreaterThan(0)
    expect(shared?.confidence).toBe(0.95)
  })
})

/** FIXTURE C — a recess bitten out of one facade. */
describe('a building with a recess in a facade', () => {
  const r = sheet(460, 460)
  // Two wings with a pocket between them, open to the south.
  walls(r, 40, 40, 339, 199)
  walls(r, 40, 188, 139, 379)
  walls(r, 240, 188, 339, 379)
  const chains = [chain('cx', 'HORIZONTAL', [40, 140, 240, 340]), chain('cy', 'VERTICAL', [40, 200, 380])]
  const d = run(r, chains)

  it('reports the pocket as a recess and not as a room', () => {
    const recesses = d.regions.filter((g) => g.classification === 'RECESS')
    expect(recesses.length).toBe(1)
    expect(size(recesses[0])).toEqual([5, 9])
  })

  it('does not fill the pocket in with building', () => {
    for (const g of built(d)) expect(g.metric.x0 === 5 && g.metric.z0 === 8).toBe(false)
  })
})

describe('a glazed wall still closes the building', () => {
  const r = sheet(400, 400)
  walls(r, 40, 40, 279, 319)
  // Replace most of the east wall with glass.
  for (let y = 80; y <= 280; y += 1) for (let x = 268; x <= 279; x += 1) r.data[(y * r.width + x) * 4 + 0] = r.data[(y * r.width + x) * 4 + 1] = r.data[(y * r.width + x) * 4 + 2] = 255
  glazing(r, 'V', 268, 80, 280)
  const d = run(r, [chain('cx', 'HORIZONTAL', [40, 280]), chain('cy', 'VERTICAL', [40, 320])])

  it('does not leak out through the glass', () => {
    expect(built(d).length).toBe(1)
    expect(size(built(d)[0])).toEqual([12, 14])
  })

  it('records that the closure came from line work rather than wall', () => {
    const east = d.cells.filter((c) => c.rect.x1 === 280).map((c) => c.edges[1])
    expect(east.some((e) => e.line > e.wall)).toBe(true)
  })
})

describe('what the decomposition refuses to do', () => {
  it('reports a hole rather than a grid when nothing is dimensioned or drawn', () => {
    const r = sheet(200, 200)
    const m = mask(r)
    const d = decomposePlan(m, [], [], registration(), { x0: 0, y0: 0, x1: 199, y1: 199 })
    expect(d.regions).toEqual([])
    expect(d.unresolved.map((u) => u.what)).toContain('a structural grid for this plan')
  })

  it('does not take a ring of paving outside the walls for a room', () => {
    const r = sheet(400, 460)
    walls(r, 40, 40, 279, 319)
    // A terrace edge one metre beyond the south wall, drawn as a line.
    glazing(r, 'H', 340, 40, 280)
    const chains = [chain('cx', 'HORIZONTAL', [40, 280]), chain('cy', 'VERTICAL', [40, 320, 352])]
    const d = run(r, chains)
    expect(built(d).length).toBe(1)
    expect(size(built(d)[0])).toEqual([12, 14])
    expect(d.envelope?.rect.y1).toBe(320)
  })

  it('gives the same answer twice', () => {
    const r = sheet(400, 400)
    walls(r, 40, 40, 279, 319)
    const chains = [chain('cx', 'HORIZONTAL', [40, 280]), chain('cy', 'VERTICAL', [40, 320])]
    expect(JSON.stringify(run(r, chains))).toBe(JSON.stringify(run(r, chains)))
  })
})

describe('grid lines', () => {
  it('prefers the position a chain states to the axis of the wall on it', () => {
    const r = sheet(400, 400)
    walls(r, 40, 40, 279, 319)
    const m = mask(r)
    const bands = runLengthBands(m, BANDS)
    const { linesX } = gridLines([chain('cx', 'HORIZONTAL', [40, 280])], bands, { x0: 40, y0: 40, x1: 280, y1: 320 })
    const left = linesX.find((l) => Math.abs(l.px - 40) < 1)
    expect(left?.px).toBe(40)
    expect(left?.probesPx).toContain(45.5) // the wall's own axis, kept for probing
  })

  it('scores a line no chain and no wall supports out of existence', () => {
    const r = sheet(400, 400)
    walls(r, 40, 40, 279, 319)
    const bands = runLengthBands(mask(r), BANDS)
    const { linesY } = gridLines([], bands, { x0: 40, y0: 40, x1: 280, y1: 320 })
    expect(linesY.every((l) => l.support.bandCoverage > 0)).toBe(true)
  })
})
