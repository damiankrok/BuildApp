/**
 * Compound facades end to end (BUILDPLAN-ANALYZER-005N §23): the target topology and its open-side neighbours, drawn
 * as one ground plan and compiled through the production solver (`reconstructV2`) to a building and its structural
 * layout. 5 cm/px, 12 px walls, chains on the overall dimensions only. Nothing here is a drawing of a real building.
 *
 * What is asserted is what the decomposition and the structural layout own: the main body is enclosed (the hall
 * behind the entrance is in a mass), the garage is a body only when its door is drawn, its door is an opening on its
 * own wall, a carport stays outside every mass, and the entrance recess stays a recess (a RECESS footprint region and
 * a recess hypothesis with both returns, never a BUILT region). How the v2 emitter draws a pocket bitten out of a
 * rectangular mass is the emitter's (it carves recesses only from dimensioned zones), unchanged by this stage and
 * recorded as a residual in the stage report.
 */
import { describe, expect, it } from 'vitest'
import { reconstructV2 } from '../src/index.js'
import { PlanDrawing, render } from './transforms.js'
import { WALL, chain, graphOf, metricsOf, planFrame, registration } from './plan.js'

const FRAME = 'frame-plan'
const W = 460
const H = 400
const FRONT = 268
const frame = planFrame(FRAME, 'GROUND', { width: W, height: H })
const on = <T extends { frameId: string }>(x: T): T => ({ ...x, frameId: FRAME })

const house = (): PlanDrawing => new PlanDrawing(W, H).ring(40, 40, 359, 279)
const returnAt = (p: PlanDrawing, x: number, top: number): PlanDrawing => p.wall(x, top, x + WALL - 1, 279)
const wallH = (p: PlanDrawing, a: number, b: number, y: number): PlanDrawing => p.wall(a, y, b, y + WALL - 1)
const doorH = (p: PlanDrawing, a: number, b: number, y: number): PlanDrawing => p.clear(a, y, b, y + WALL - 1).line(a, y + 5, b, y + 5)

/** The recessed entrance (mouth x 120..179, back wall at 228..239 with a door) and, past its return, a garage x 192..251. */
function entranceAndGarage(door: boolean): PlanDrawing {
  const p = house()
  p.clear(120, FRONT, 251, 279)
  returnAt(p, 108, 150)
  returnAt(p, 180, 150)
  wallH(p, 108, 191, 228)
  doorH(p, 135, 155, 228)
  wallH(p, 108, 263, 150)
  returnAt(p, 252, 150)
  doorH(p, 210, 225, 150)
  if (door) p.line(192, 276, 251, 276)
  return p
}

/** The same entrance and, past its return, a carport a car's length deep with nothing across its mouth. */
function entranceAndCarport(): PlanDrawing {
  const p = house()
  p.clear(120, FRONT, 259, 279)
  returnAt(p, 108, 150)
  returnAt(p, 180, 150)
  wallH(p, 108, 191, 228)
  doorH(p, 135, 155, 228)
  wallH(p, 180, 271, 160)
  returnAt(p, 260, 160)
  return p
}

function compile(p: PlanDrawing, publishedFootprintM2?: number): ReturnType<typeof reconstructV2> {
  return reconstructV2({
    ...(publishedFootprintM2 === undefined ? {} : { publishedAreas: [{ key: 'footprint_area', label: 'footprint', unit: 'm2' as const, value: publishedFootprintM2 }] }),
    label: 'fixture',
    slug: 'fixture',
    sourcePackageId: 'src-test',
    sourcePackageHash: 'd'.repeat(64),
    graph: graphOf([frame]),
    metrics: metricsOf([on(chain('cx', 'HORIZONTAL', [40, 360], { baselinePx: 20 })), on(chain('cy', 'VERTICAL', [40, 280], { baselinePx: 20 }))], [on(registration())]),
    raster: () => render(p),
  })
}

/** Plan pixels to the model's world (the front is the sheet's bottom: z = 0 is the front face, mirrored about 12 m). */
const world = (x: number, y: number): { x: number; z: number } => ({ x: (x - 40) * 0.05, z: 12 - (y - 40) * 0.05 })
const inMass = (r: ReturnType<typeof reconstructV2>, px: number, py: number): boolean => {
  const { x, z } = world(px, py)
  return r.building.masses.some((m) => x > m.x0 && x < m.x1 && z > m.z0 && z < m.z1)
}
type Region = { kind: string; pixelRect: { x0: number; y0: number; x1: number; y1: number } }
const regionAt = (r: ReturnType<typeof reconstructV2>, px: number, py: number): string[] =>
  (r.layout.footprintRegions as Region[]).filter((g) => px > g.pixelRect.x0 && px < g.pixelRect.x1 && py > g.pixelRect.y0 && py < g.pixelRect.y1).map((g) => g.kind)

describe('005N §23 — compound facades through the production solver', () => {
  it('recess + garage door drawn: one enclosed body with the hall and the garage, the garage door on the garage wall, the recess a recess', () => {
    const r = compile(entranceAndGarage(true))
    expect(inMass(r, 150, 200), 'the hall behind the entrance').toBe(true)
    expect(inMass(r, 222, 210), 'the garage').toBe(true)
    expect(inMass(r, 300, 150), 'the living room').toBe(true)
    // the garage door is an opening on the front wall within the garage's mouth (x 7.6..10.6 m)
    const garageDoor = r.building.openings.filter((o) => o.facade === 'FRONT' && o.interval[0] >= 7.5 && o.interval[1] <= 10.7)
    expect(garageDoor).toHaveLength(1)
    // the entrance recess: a RECESS region, a recess hypothesis on the front with both returns, never a BUILT region of its own
    expect(regionAt(r, 150, 255)).toContain('RECESS')
    const recess = r.layout.recesses.find((x) => x.mouthSide === 'MAX_Z' && x.mouth.from >= 3.5 && x.mouth.to <= 7.5)
    expect(recess?.returns).toEqual({ low: true, high: true })
    expect(recess?.depthM.value).toBeGreaterThan(1.5)
  })

  it('garage door blank: no garage body is fabricated (the first reading leaves it open), the house and its hall stand', () => {
    const r = compile(entranceAndGarage(false))
    expect(inMass(r, 222, 210), 'a blank garage mouth').toBe(false)
    expect(inMass(r, 150, 200), 'the hall').toBe(true)
    expect(inMass(r, 300, 150), 'the living room').toBe(true)
    expect(regionAt(r, 150, 255)).toContain('RECESS')
  })

  it('a carport beside the recessed entrance stays outside every mass', () => {
    const r = compile(entranceAndCarport())
    expect(inMass(r, 225, 240), 'the carport').toBe(false)
    expect(inMass(r, 300, 100), 'the house').toBe(true)
    expect(regionAt(r, 225, 240)).not.toContain('BUILT')
    expect(regionAt(r, 150, 255)).toContain('RECESS')
  })

  it('§20 non-circularity, executed: a published footprint as the house has it, as a 1.25× decoy, or absent — the same separators, intervals, roles and recess', () => {
    const plan = entranceAndGarage(true)
    const records = [undefined, 192, 240].map((published) => JSON.stringify(compile(plan, published).planDiagnostics?.plans.map((x) => x.compoundFacades ?? null)))
    expect(JSON.parse(records[0]).flat().filter(Boolean)).not.toHaveLength(0)
    expect(records[1]).toBe(records[0])
    expect(records[2]).toBe(records[0])
  })
})
