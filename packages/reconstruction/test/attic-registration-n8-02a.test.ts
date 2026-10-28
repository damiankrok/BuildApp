/**
 * N8-02A: an upper plan's extent and its registration on the plan below. The extent keeps the walls joined to the
 * chained ones (an attic whose chains measure only part of it is still the whole attic) and leaves an eaves outline
 * out; the registration lays the upper plan's outer-wall frame on a body below at that sheet's own scale, against a
 * fit that shrinks the plan onto inner walls or a scale read from too few anchors. Grids and dimensions are invented.
 */
import { describe, expect, it } from 'vitest'
import type { Band, Raster } from '@buildapp/source-cv'
import { BLACK, fillRect } from '../../source-cv/test/draw.js'
import type { CoordinateRegistration, DimensionChain } from '@buildapp/source-metrics'
import { inferStructuralLayout } from '../src/index.js'
import { wallsJoinedTo } from '../src/plan-decomposition.js'
import type { MassHypothesis, StructuralLayoutDraft } from '../src/index.js'
import { CM_PER_PX, chain, graphOf, metricsOf, partition, planFrame, registration, sheet, walls } from './plan.js'

const layoutOf = (ground: Raster, upper: Raster, chains: DimensionChain[], upperRegistration: CoordinateRegistration = registration('frame-upper')): StructuralLayoutDraft => {
  const rasters: Record<string, Raster> = { 'frame-ground': ground, 'frame-upper': upper }
  return inferStructuralLayout({
    slug: 'test',
    sourcePackageId: 'src-test',
    sourcePackageHash: 'd'.repeat(64),
    graph: graphOf([planFrame('frame-ground', 'GROUND', { width: ground.width, height: ground.height }), planFrame('frame-upper', 'UPPER', { width: upper.width, height: upper.height })]),
    metrics: metricsOf(chains, [registration('frame-ground'), upperRegistration]),
    raster: (frame) => rasters[frame.id],
  })
}

/** A chain whose printed values are `cmPerPx` per pixel (an upper sheet drawn at another scale). */
const scaled = (c: DimensionChain, cmPerPx: number): DimensionChain => ({ ...c, segments: c.segments.map((s) => ({ ...s, valueCm: s.pixelLength * cmPerPx })) })

const size = (m: MassHypothesis): [number, number] => [Number(m.widthM.value.toFixed(1)), Number(m.depthM.value.toFixed(1))]
const upperMass = (d: StructuralLayoutDraft) => d.masses.filter((m) => m.storeySpan.toIndex >= 1)
const coverageConflicts = (d: StructuralLayoutDraft) => d.conflicts.filter((c) => c.kind === 'STOREY_COVERAGE_DISAGREES')

/** The ground floor every case stands on: a 12 × 17 m body (240 × 340 px at 5 cm/px) and an 8 × 9 m wing beside it. */
const groundFloor = (): Raster => {
  const g = sheet(560, 520)
  walls(g, 40, 40, 279, 379, [{ side: 'S', from: 120, to: 200 }])
  walls(g, 268, 200, 439, 379, [{ side: 'S', from: 320, to: 400 }])
  partition(g, 40, 200, 279, 205)
  return g
}
const GROUND_CHAINS = [chain('gx', 'HORIZONTAL', [40, 280, 440], { frameId: 'frame-ground' }), chain('gy', 'VERTICAL', [40, 200, 380], { frameId: 'frame-ground' })]

/** A wall-thick band, its axis at `at`, running `from`..`to` (pixels). */
const band = (axis: 'VERTICAL' | 'HORIZONTAL', at: number, from: number, to: number): Band => ({
  axis,
  axisPx: at,
  bounds: axis === 'VERTICAL' ? { x0: at - 6, x1: at + 6, y0: from, y1: to } : { x0: from, x1: to, y0: at - 6, y1: at + 6 },
  thickness: 12,
  length: to - from,
  fill: 1,
  pieces: 1,
  segments: [{ from, to }],
})

describe('N8-02A: the walls joined to the walls the chains frame', () => {
  // an attic 40..280 × 40..380 px; the chains frame its right part, so the seed is the right wall and the stair wall
  const right = band('VERTICAL', 274, 40, 380)
  const stair = band('VERTICAL', 160, 40, 380)
  const top = band('HORIZONTAL', 46, 40, 280)
  const bottom = band('HORIZONTAL', 374, 40, 280)
  // the left end wall, cut short by a door and a window: its longest piece runs 160..300 only, ending on neither wall
  const leftEnd = band('VERTICAL', 46, 160, 300)

  it('follows corners and tees from the seed, and takes an end wall its openings cut short', () => {
    const joined = wallsJoinedTo([right, stair], [right, stair, top, bottom, leftEnd], 12)
    expect(joined).toContain(top)
    expect(joined).toContain(bottom)
    // two walls of the set (top and bottom) end on its axis and it stands between them
    expect(joined).toContain(leftEnd)
  })

  it('leaves out an outline running past the walls across it at both ends, as an eaves line does', () => {
    const eaves = band('HORIZONTAL', 250, 10, 310)
    const joined = wallsJoinedTo([right, stair], [right, stair, top, bottom, leftEnd, eaves], 12)
    expect(joined).not.toContain(eaves)
    expect(joined).toContain(top)
  })

  it('does not take a band no wall of the set ends on or runs into: a second drawing on the sheet', () => {
    const logo = band('HORIZONTAL', 470, 400, 520)
    expect(wallsJoinedTo([right, stair], [right, stair, top, bottom, logo], 12)).not.toContain(logo)
  })
})

describe('N8-02A: registering an upper storey on the plan below', () => {
  it('an upper sheet drawn at another image scale stands on the body it matches, at its own size', () => {
    // the same 12 × 17 m body drawn at 2.5 cm/px on a larger sheet
    const u = sheet(700, 900)
    walls(u, 60, 60, 539, 739, [{ side: 'S', from: 220, to: 380 }])
    partition(u, 60, 420, 539, 429)
    const reg = { ...registration('frame-upper'), metresPerPixelX: 0.025, metresPerPixelY: 0.025 }
    const d = layoutOf(groundFloor(), u, [...GROUND_CHAINS, scaled(chain('ux', 'HORIZONTAL', [60, 540], { frameId: 'frame-upper' }), 2.5), scaled(chain('uy', 'VERTICAL', [60, 740], { frameId: 'frame-upper' }), 2.5)], reg)
    expect(upperMass(d).map(size)).toEqual([[12, 17]])
    expect(coverageConflicts(d)).toEqual([])
  })

  it('a storey drawn at another place on its sheet is registered by its walls, not by its pixel position', () => {
    const u = sheet(560, 520)
    walls(u, 100, 90, 339, 429)
    partition(u, 100, 260, 339, 265)
    const d = layoutOf(groundFloor(), u, [...GROUND_CHAINS, chain('ux', 'HORIZONTAL', [100, 340], { frameId: 'frame-upper' }), chain('uy', 'VERTICAL', [90, 430], { frameId: 'frame-upper' })])
    expect(upperMass(d).map(size)).toEqual([[12, 17]])
    expect(coverageConflicts(d)).toEqual([])
  })

  it('a scale read from two anchors a third of the sheet’s is not taken: the attic is not a third of the house', () => {
    const u = sheet(560, 520)
    walls(u, 40, 40, 279, 379, [{ side: 'S', from: 120, to: 200 }])
    partition(u, 40, 220, 279, 225)
    const bad: CoordinateRegistration = {
      ...registration('frame-upper'),
      metresPerPixelX: CM_PER_PX / 300,
      metresPerPixelY: CM_PER_PX / 300,
      anchors: [],
      confidence: 0.66,
    }
    const d = layoutOf(groundFloor(), u, GROUND_CHAINS, bad)
    for (const m of upperMass(d)) expect(size(m)[0]).toBeGreaterThan(4)
    expect(d.masses.some((m) => m.storeySpan.toIndex >= 1)).toBe(true)
  })

  it('a fit that shrinks the plan onto inner walls below does not beat the placement laying its outline on a body', () => {
    // below: the body, the wing, and inside the body a wall-thick box and cross 0.8 the size of the upper plan, which
    // a shrunk upper plan lands on wall for wall; the upper sheet's own scale is misread (two anchors, a third of it)
    const g = sheet(560, 520)
    walls(g, 40, 40, 279, 379)
    walls(g, 268, 200, 439, 379)
    const S = (v: number) => Math.round(v * 0.8)
    const [ox, oy] = [70, 60]
    fillRect(g, ox + S(40), oy + S(40), ox + S(279), oy + S(40) + 11, BLACK)
    fillRect(g, ox + S(40), oy + S(379) - 11, ox + S(279), oy + S(379), BLACK)
    fillRect(g, ox + S(40), oy + S(40), ox + S(40) + 11, oy + S(379), BLACK)
    fillRect(g, ox + S(279) - 11, oy + S(40), ox + S(279), oy + S(379), BLACK)
    fillRect(g, ox + S(40), oy + S(200), ox + S(279), oy + S(200) + 11, BLACK)
    fillRect(g, ox + S(160), oy + S(40), ox + S(160) + 11, oy + S(379), BLACK)
    const u = sheet(560, 520)
    walls(u, 40, 40, 279, 379)
    fillRect(u, 40, 200, 279, 211, BLACK)
    fillRect(u, 160, 40, 171, 379, BLACK)
    const bad: CoordinateRegistration = { ...registration('frame-upper'), metresPerPixelX: CM_PER_PX / 300, metresPerPixelY: CM_PER_PX / 300, confidence: 0.66 }
    const d = layoutOf(g, u, [chain('gx', 'HORIZONTAL', [40, 280, 440], { frameId: 'frame-ground' }), chain('gy', 'VERTICAL', [40, 200, 380], { frameId: 'frame-ground' })], bad)
    const chosen = d.storeyRegistrations.find((r) => r.storeyIndex === 1)?.chosen
    // the fit at 0.79 lands 95 % of the wall on wall, inside the body; the outline on the body's faces is the reading
    expect(chosen?.scale).toBeCloseTo(1, 2)
    expect(coverageConflicts(d)).toEqual([])
  })

  it('an attic smaller than the ground floor stays smaller: it is not stretched onto the outer walls below', () => {
    // the attic covers the rear 12 × 9 m of the 12 × 17 m body only, its front wall over the partition below
    const small = sheet(560, 520)
    walls(small, 40, 200, 279, 379)
    const d = layoutOf(groundFloor(), small, [...GROUND_CHAINS, chain('ux', 'HORIZONTAL', [40, 280], { frameId: 'frame-upper' }), chain('uy', 'VERTICAL', [200, 380], { frameId: 'frame-upper' })])
    const upper = d.storeys.find((s) => s.index === 1)
    const built = d.footprintRegions.filter((r) => r.kind === 'BUILT' && r.storeyId === upper?.id)
    expect(built.length).toBeGreaterThan(0)
    const area = built.reduce((a, r) => a + r.areaM2, 0)
    expect(area).toBeGreaterThan(12 * 9 * 0.95)
    expect(area).toBeLessThan(12 * 9 * 1.05)
    // the body splits: the part under the attic on two storeys, the front on one
    expect(upperMass(d).map(size)).toEqual([[12, 9]])
  })
})
