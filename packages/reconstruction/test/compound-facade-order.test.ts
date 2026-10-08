/**
 * Compound facades are read the same whatever order the evidence arrives in (BUILDPLAN-ANALYZER-005N §31): the wall
 * bands, the dimension chains and the printed callouts are shuffled, eight seeded permutations each, and every
 * separator, interval, role, recess and cell class must come out byte for byte the same. Separator candidates and
 * intervals are read from the ink in its own order along the line, never from an enumeration. 5 cm/px, 12 px walls.
 */
import { describe, expect, it } from 'vitest'
import { runLengthBands } from '@buildapp/source-cv'
import type { Band } from '@buildapp/source-cv'
import { BANDS } from './boundary-plan.js'
import { PlanDrawing, render } from './transforms.js'
import { WALL, chain, mask, registration } from './plan.js'
import { bandWallThickness, decomposePlan, extentSidesOf, exteriorTicksOf, planExtent, wallWitness } from '../src/index.js'
import type { PlanCallout } from '../src/index.js'
import type { DimensionChain } from '@buildapp/source-metrics'

const FRONT = 268
const house = (): PlanDrawing => new PlanDrawing(460, 400).ring(40, 40, 359, 279)
const returnAt = (p: PlanDrawing, x: number, top: number): PlanDrawing => p.wall(x, top, x + WALL - 1, 279)
const wallH = (p: PlanDrawing, a: number, b: number, y: number): PlanDrawing => p.wall(a, y, b, y + WALL - 1)
const doorH = (p: PlanDrawing, a: number, b: number, y: number): PlanDrawing => p.clear(a, y, b, y + WALL - 1).line(a, y + 5, b, y + 5)

/** The target topology with a blank garage, a callout at each mouth and a dashed overhead line: every input order matters to something. */
function scene(): PlanDrawing {
  const p = house()
  p.clear(120, FRONT, 251, 279)
  returnAt(p, 108, 150)
  returnAt(p, 180, 150)
  wallH(p, 108, 191, 228)
  doorH(p, 135, 155, 228)
  wallH(p, 108, 263, 150)
  returnAt(p, 252, 150)
  doorH(p, 210, 225, 150)
  for (let x = 100; x < 300; x += 13) p.line(x, 300, Math.min(x + 8, 300), 300)
  return p
}
const CALLOUTS: PlanCallout[] = [
  { id: 'c-a', at: { x: 150, y: 292 }, widthsCm: [{ value: 300, confidence: 0.7 }] },
  { id: 'c-b', at: { x: 222, y: 292 }, widthsCm: [{ value: 300, confidence: 0.6 }, { value: 250, confidence: 0.3 }] },
  { id: 'c-c', at: { x: 300, y: 292 }, widthsCm: [{ value: 120, confidence: 0.5 }] },
  // a second callout at the garage's mouth, read less surely: the better reading is bound whichever comes first
  { id: 'c-d', at: { x: 231, y: 296 }, widthsCm: [{ value: 290, confidence: 0.5 }] },
]

/** A seeded permutation (a small LCG, so that every run shuffles the same eight ways). */
function permute<T>(items: readonly T[], seed: number): T[] {
  const out = [...items]
  let s = seed >>> 0
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    const j = s % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function read(order: { bands?: number; chains?: number; callouts?: number }): string {
  const m = mask(render(scene()))
  const found = runLengthBands(m, BANDS)
  const bands: Band[] = order.bands === undefined ? found : permute(found, order.bands)
  const wallPx = bandWallThickness(bands, WALL)
  const given: DimensionChain[] = [chain('cx', 'HORIZONTAL', [40, 360], { baselinePx: 12 }), chain('cy', 'VERTICAL', [40, 280], { baselinePx: 12 }), chain('cz', 'HORIZONTAL', [40, 120, 192, 252, 360], { baselinePx: 380, read: false })]
  const chains = order.chains === undefined ? given : permute(given, order.chains)
  const extent = planExtent(chains, bands, wallPx, wallWitness(bands, wallPx, m))
  if (!extent) throw new Error('no frame')
  const callouts = order.callouts === undefined ? CALLOUTS : permute(CALLOUTS, order.callouts)
  const d = decomposePlan(m, chains, bands, registration(), extent.rect, { callouts, sheetWallPx: WALL, exteriorTicks: exteriorTicksOf(chains, extent.roles), extentSides: extentSidesOf(chains, extent, wallPx) })
  return JSON.stringify({ compound: d.compoundFacades ?? null, cells: d.cells.map((c) => [c.ix, c.iy, c.classification]), wide: d.wideOpenings.map((w) => [w.axis, w.linePx, w.fromPx, w.toPx, w.decision, w.compound?.role ?? null]) })
}

describe('005N §31 — order invariance of the compound reading', () => {
  const reference = read({})
  it('the reference reading has a compound span with a separator, a recess and a callout bound to each mouth', () => {
    const parsed = JSON.parse(reference) as { compound: Array<{ separators: Array<{ accepted: boolean }>; intervals: Array<{ role: string; evidence: { callout?: { id: string } } }> }> }
    expect(parsed.compound[0].separators.some((s) => s.accepted)).toBe(true)
    expect(parsed.compound[0].intervals.map((i) => i.role).sort()).toEqual(['OPENING_IN_WALL', 'RECESS_MOUTH'])
    expect(parsed.compound[0].intervals.map((i) => i.evidence.callout?.id).sort()).toEqual(['c-a', 'c-b'])
  })
  for (const family of ['bands', 'chains', 'callouts'] as const) {
    it(`eight shuffles of the ${family} change nothing`, () => {
      for (let k = 1; k <= 8; k += 1) expect(read({ [family]: k * 7919 }), `${family} shuffle ${k}`).toBe(reference)
    })
  }
  it('all three shuffled together change nothing', () => {
    for (let k = 1; k <= 8; k += 1) expect(read({ bands: k * 31, chains: k * 37, callouts: k * 41 }), `shuffle ${k}`).toBe(reference)
  })
})
