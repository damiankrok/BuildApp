/**
 * BUILDPLAN-ANALYZER-005L — the storey-support corpus, as the council attacked it.
 *
 * Each fixture is one of the five reviewers' probes (stage-reports/artifacts/analyzer-005l/post-review/), kept as a
 * test of what the fix decides: plans drawn in code, so the answer is known. Nothing here is a drawing of any real
 * building.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import type { CoordinateRegistration, DimensionChain } from '@buildapp/source-metrics'
import type { SourceCoordinateFrame } from '@buildapp/source-observations'
import { evaluateLayoutGate, groundStoreyOf, inferStructuralLayout, ringBounds } from '../src/index.js'
import type { StructuralLayoutDraft } from '../src/index.js'
import { chain, graphOf, metricsOf, partition, planFrame, registration, sheet, walls } from './plan.js'
import { BLACK, fillRect } from '../../source-cv/test/draw.js'

type Plan = { id: string; storey: 'GROUND' | 'UPPER' | 'ATTIC' | 'BASEMENT'; raster: Raster; chains?: DimensionChain[]; reg?: Partial<CoordinateRegistration> }

function layoutOf(plans: readonly Plan[], order: { frames?: number[] } = {}): StructuralLayoutDraft {
  const frames: SourceCoordinateFrame[] = plans.map((p) => planFrame(p.id, p.storey, { width: p.raster.width, height: p.raster.height }))
  const chains = plans.flatMap((p) => (p.chains ?? []).map((c) => ({ ...c, frameId: p.id })))
  const regs: CoordinateRegistration[] = plans.filter((p) => (p.chains?.length ?? 0) > 0).map((p) => ({ ...registration(p.id), ...(p.reg ?? {}) }))
  const permute = <T>(xs: readonly T[], idx?: number[]): T[] => (idx ? idx.map((i) => xs[i]) : [...xs])
  return inferStructuralLayout({
    slug: 'storey-council',
    sourcePackageId: 'src-test',
    sourcePackageHash: 'd'.repeat(64),
    graph: graphOf(permute(frames, order.frames)),
    metrics: metricsOf(chains, regs),
    raster: (frame) => plans.find((p) => p.id === frame.id)?.raster,
  })
}

const r1 = (v: number): number => Number(v.toFixed(1))
const boxOf = (ring: Parameters<typeof ringBounds>[0]): number[] => {
  const b = ringBounds(ring)
  return [b.x0, b.z0, b.x1, b.z1].map(r1)
}
const spans = (d: StructuralLayoutDraft): string[] => d.masses.map((m) => `${boxOf(m.ring).join(',')} ${m.storeySpan.fromIndex}..${m.storeySpan.toIndex}`).sort()
const footprintsAt = (d: StructuralLayoutDraft, index: number): number[][] =>
  d.footprintRegions
    .filter((f) => f.kind === 'BUILT' && d.storeys.find((s) => s.id === f.storeyId)?.index === index)
    .map((f) => boxOf(f.ring))
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
const decisionOf = (d: StructuralLayoutDraft, frameId: string): string | undefined => d.storeyRegistrations.find((r) => r.frameId === frameId)?.decision
const registrationOf = (d: StructuralLayoutDraft, frameId: string) => d.storeyRegistrations.find((r) => r.frameId === frameId)

/** A 12 × 17 m house. */
const ground = (): Raster => {
  const g = sheet(400, 560)
  walls(g, 40, 40, 279, 379, [{ side: 'S', from: 120, to: 200 }])
  return g
}
const gChains = (): DimensionChain[] => [chain('gx', 'HORIZONTAL', [40, 280]), chain('gy', 'VERTICAL', [40, 380])]
/** A 12 × 17 m house and an 8 × 9 m one-storey garage against its east wall. */
const houseAndGarage = (): Raster => {
  const r = sheet(560, 520)
  walls(r, 40, 40, 279, 379, [{ side: 'S', from: 120, to: 200 }])
  walls(r, 268, 200, 439, 379, [{ side: 'S', from: 320, to: 400 }])
  partition(r, 40, 200, 279, 205)
  return r
}
const groundChains5 = (): DimensionChain[] => [chain('gx', 'HORIZONTAL', [40, 280, 440]), chain('gy', 'VERTICAL', [40, 200, 380])]

describe('005L council A: registration topology', () => {
  it('A5L-1 an upper storey set back on two sides, its chains measuring its own walls: never the ground ring stretched upstairs', () => {
    const g = sheet(400, 360)
    walls(g, 40, 40, 279, 239, [{ side: 'S', from: 120, to: 200 }])
    partition(g, 140, 40, 145, 239)
    const u = sheet(400, 360)
    walls(u, 40, 40, 239, 199)
    partition(u, 140, 40, 145, 199)
    const d = layoutOf([
      { id: 'g', storey: 'GROUND', raster: g, chains: [chain('gx', 'HORIZONTAL', [40, 280]), chain('gy', 'VERTICAL', [40, 240])] },
      { id: 'u', storey: 'UPPER', raster: u, chains: [chain('ux', 'HORIZONTAL', [40, 240]), chain('uy', 'VERTICAL', [40, 200])] },
    ])
    // the printed scale holds: the storey is 10 × 8 m, and which end of the house it is flush with nothing states
    expect(registrationOf(d, 'u')?.chosen?.scale).toBeCloseTo(1, 3)
    expect(footprintsAt(d, 1).every((b) => !(b[2] - b[0] === 12 && b[3] - b[1] === 10))).toBe(true)
    expect(decisionOf(d, 'u')).toBe('AMBIGUOUS')
  })

  it('A5L-1 an inset storey sharing no wall with the house below: the printed scale the fit overrules is on the record', () => {
    const u = sheet(400, 560)
    walls(u, 80, 80, 239, 306)
    const d = layoutOf([
      { id: 'g', storey: 'GROUND', raster: ground(), chains: gChains() },
      { id: 'u', storey: 'UPPER', raster: u, chains: [chain('ux', 'HORIZONTAL', [80, 240]), chain('uy', 'VERTICAL', [80, 307])] },
    ])
    // the residual: nothing in the walls tells this from a misread printed scale, and the fit stands — but not in silence
    expect(registrationOf(d, 'u')?.printedScale).toMatchObject({ k: 1, bodyInsideBelow: true, outcome: 'REFUTED' })
  })

  it('A5L-2 a storey set in 1.0 m on every side, stated by whole-building chains, keeps its set-backs', () => {
    const u = sheet(400, 560)
    walls(u, 60, 60, 259, 359)
    const d = layoutOf([
      { id: 'g', storey: 'GROUND', raster: ground(), chains: gChains() },
      { id: 'u', storey: 'UPPER', raster: u, chains: [chain('ux', 'HORIZONTAL', [40, 60, 260, 280]), chain('uy', 'VERTICAL', [40, 60, 360, 380])] },
    ])
    expect(footprintsAt(d, 1)).toEqual([[1, 1, 11, 16]])
  })

  it('A5L-3 a storey reaching 2 m past the short side of the house below: the overhang is named, whichever side it is on', () => {
    const u = sheet(400, 560)
    walls(u, 40, 40, 279, 419)
    const d = layoutOf([
      { id: 'g', storey: 'GROUND', raster: ground(), chains: gChains() },
      { id: 'u', storey: 'UPPER', raster: u, chains: [chain('ux', 'HORIZONTAL', [40, 280]), chain('uy', 'VERTICAL', [40, 380, 420])] },
    ])
    expect(footprintsAt(d, 1)).toEqual([[0, 0, 12, 17]])
    expect(registrationOf(d, 'u')?.regions.find((r) => r.body)?.overhang).toBe('BEYOND_TOLERANCE')
    expect(d.unresolved.some((u2) => u2.what.includes('what carries'))).toBe(true)
  })

  it('A5L-4 a partial basement keeps its own footprint, and the ground floor is still the storey the building stands at', () => {
    const g = ground()
    partition(g, 40, 200, 279, 205)
    const b = sheet(400, 560)
    walls(b, 40, 40, 279, 205)
    const d = layoutOf([
      { id: 'g', storey: 'GROUND', raster: g, chains: gChains() },
      { id: 'b', storey: 'BASEMENT', raster: b, chains: [chain('bx', 'HORIZONTAL', [40, 280]), chain('by', 'VERTICAL', [40, 206, 380])] },
    ])
    expect(decisionOf(d, 'b')).toBe('STACKED')
    expect(footprintsAt(d, -1)).toEqual([[0, 0, 12, 8.3]])
    expect(groundStoreyOf(d.storeys, d.footprintRegions)?.index).toBe(0)
    const gate = evaluateLayoutGate({ masses: d.masses, roofs: [], storeys: d.storeys, regions: d.footprintRegions, conflicts: d.conflicts, unresolved: d.unresolved, metrics: { chains: [], evidence: [], coordinateRegistrations: [] } as never, baseFrameId: 'g', publishedAreas: [{ key: 'footprint_area', label: 'footprint', value: 204, unit: 'm2' }] })
    expect(gate.reasons.find((r) => r.code.startsWith('FOOTPRINT'))?.code).toBe('FOOTPRINT_AREA_AGREES')
  })

  it('A5L-5 a basement 5 m larger than the ground floor (under a terrace) is built under the house, its excess named', () => {
    const b = sheet(400, 560)
    walls(b, 40, 40, 279, 479)
    const d = layoutOf([
      { id: 'g', storey: 'GROUND', raster: ground(), chains: gChains() },
      { id: 'b', storey: 'BASEMENT', raster: b, chains: [chain('bx', 'HORIZONTAL', [40, 280]), chain('by', 'VERTICAL', [40, 380, 480])] },
    ])
    expect(decisionOf(d, 'b')).toBe('STACKED')
    expect(spans(d)).toEqual(['0,0,12,17 -1..0'])
    expect(d.conflicts.some((c) => c.kind === 'STOREY_COVERAGE_DISAGREES' && c.what.includes('basement'))).toBe(true)
  })

  it('A5L-6 an attic over an upper storey whose place is unresolved is not built over a storey that is not there', () => {
    const g = sheet(400, 460)
    walls(g, 40, 40, 279, 379, [{ side: 'S', from: 120, to: 200 }])
    const u = sheet(400, 460)
    walls(u, 40, 40, 279, 259)
    const a = sheet(400, 460)
    walls(a, 80, 120, 239, 299)
    const plans: Plan[] = [
      { id: 'g', storey: 'GROUND', raster: g, chains: [chain('gx', 'HORIZONTAL', [40, 280]), chain('gy', 'VERTICAL', [40, 380])] },
      { id: 'u', storey: 'UPPER', raster: u, chains: [chain('ux', 'HORIZONTAL', [40, 280]), chain('uy', 'VERTICAL', [40, 260])] },
      { id: 'a', storey: 'ATTIC', raster: a, chains: [chain('ax', 'HORIZONTAL', [40, 80, 240, 280]), chain('ay', 'VERTICAL', [40, 120, 300, 380])] },
    ]
    const d = layoutOf(plans)
    expect(decisionOf(d, 'u')).toBe('AMBIGUOUS')
    expect(decisionOf(d, 'a')).toBe('AMBIGUOUS')
    expect(spans(d)).toEqual(['0,0,12,17 0..0'])
    expect(d.unresolved.some((x) => x.what.includes('attic storey over'))).toBe(true)
    // and in another order of the plans, the same
    expect(JSON.stringify(layoutOf(plans, { frames: [2, 1, 0] }).storeyRegistrations.map((r) => [r.frameId, r.decision]).sort())).toBe(JSON.stringify(d.storeyRegistrations.map((r) => [r.frameId, r.decision]).sort()))
  })

  for (const moved of [0, 1, -1]) {
    it(`A5L-7 two equal bodies, one of them ${moved} px wider: the walls cannot tell which one the upper storey stands on`, () => {
      const g = sheet(520, 460)
      walls(g, 40, 40, 199, 299)
      walls(g, 188, 100, 347 + moved, 359)
      const u = sheet(520, 460)
      walls(u, 160, 60, 319, 319)
      const d = layoutOf([
        { id: 'g', storey: 'GROUND', raster: g, chains: [chain('gx', 'HORIZONTAL', [40, 200, 348 + moved]), chain('gy', 'VERTICAL', [40, 100, 300, 360])] },
        { id: 'u', storey: 'UPPER', raster: u },
      ])
      expect(decisionOf(d, 'u')).toBe('AMBIGUOUS')
      expect(d.masses.every((m) => m.storeySpan.toIndex === 0)).toBe(true)
    })
  }

  it('A5L-8 a roof terrace over the garage closed by a thin parapet is no storey of the garage', () => {
    const u = sheet(560, 520)
    walls(u, 40, 40, 279, 379, [{ side: 'S', from: 120, to: 200 }])
    fillRect(u, 279, 200, 439, 205, BLACK)
    fillRect(u, 434, 200, 439, 379, BLACK)
    fillRect(u, 279, 370, 439, 375, BLACK)
    const d = layoutOf([
      { id: 'g', storey: 'GROUND', raster: houseAndGarage(), chains: groundChains5() },
      { id: 'u', storey: 'UPPER', raster: u, chains: [chain('ux', 'HORIZONTAL', [40, 280]), chain('uy', 'VERTICAL', [40, 380])] },
    ])
    expect(spans(d)).toEqual(['0,0,12,17 0..1', '12,8,20,17 0..0'])
  })

  it('A5L-9 a heavy frame drawn beside an upper plan that prints no scale lifts no body', () => {
    const u = sheet(560, 420)
    const at = (v: number): number => Math.round(30 + v * 0.8)
    walls(u, at(40), at(40), at(279), at(379))
    partition(u, at(40), at(220), at(279), at(220) + 4)
    const [x0, y0, x1, y1] = [300, at(40), 520, at(379)]
    for (const [a0, b0, a1, b1] of [[x0, y0, x1, y0 + 5], [x0, y1 - 5, x1, y1], [x0, y0, x0 + 5, y1], [x1 - 5, y0, x1, y1]]) fillRect(u, a0, b0, a1, b1, BLACK)
    const d = layoutOf([
      { id: 'g', storey: 'GROUND', raster: houseAndGarage(), chains: groundChains5() },
      { id: 'u', storey: 'UPPER', raster: u },
    ])
    expect(spans(d).find((s) => s.startsWith('12,8,20,17'))).toBe('12,8,20,17 0..0')
  })

  it('A5L-11 a placement both plans state, held against a fit that would stand the storey elsewhere, says so on the record', () => {
    const g = ground()
    partition(g, 40, 200, 279, 205)
    const u = sheet(400, 460)
    walls(u, 40, 40, 279, 349)
    partition(u, 40, 200, 279, 205)
    fillRect(u, 100, 10, 101, 40, BLACK)
    fillRect(u, 180, 10, 181, 40, BLACK)
    fillRect(u, 100, 10, 181, 11, BLACK)
    const d = layoutOf([
      { id: 'g', storey: 'GROUND', raster: g, chains: gChains(), reg: { originPx: { x: 40, y: 40 } } },
      { id: 'u', storey: 'UPPER', raster: u, chains: [chain('ux', 'HORIZONTAL', [40, 280]), chain('uy', 'VERTICAL', [10, 40, 350])], reg: { originPx: { x: 40, y: 10 } } },
    ])
    const reg = registrationOf(d, 'u')
    expect(reg?.chosen?.stated).toBe(true)
    // the fit it was held against, which lands the partition on the partition, is named with the place it puts the storey
    expect(reg?.held?.by).toBe('STATEMENT')
    expect(reg?.held?.standsElsewhere).toBe(true)
    expect(reg?.held?.over.score).toBeGreaterThan(reg?.chosen?.score ?? 1)
    // and it is a record, not a conflict: a correctly stated set-back is held against a better-fitting shift as well
    // (fixtures.test.ts, REDMIRE), and the walls do not tell the two apart
    expect(d.conflicts.some((c) => c.id.includes('storey-held'))).toBe(false)
  })
})

describe('005L council B: the storey outline is where its outer walls run', () => {
  /** A 12 × 17 m upper storey whose plan breaks its depth chain a metre inside each gable, at a balustrade line. */
  const gabled = (eavesToGable: boolean): Raster => {
    const u = sheet(400, 460)
    // the eaves walls: the whole depth, or stopping at the balustrade line (a storey set back from both gables)
    fillRect(u, 40, eavesToGable ? 40 : 60, 51, eavesToGable ? 379 : 360, BLACK)
    fillRect(u, 268, eavesToGable ? 40 : 60, 279, eavesToGable ? 379 : 360, BLACK)
    if (eavesToGable) {
      for (const y of [40, 368]) {
        fillRect(u, 40, y, 100, y + 11, BLACK)
        fillRect(u, 220, y, 279, y + 11, BLACK)
      }
    }
    partition(u, 40, 200, 279, 205)
    fillRect(u, 55, 59, 264, 60, BLACK)
    fillRect(u, 55, 360, 264, 361, BLACK)
    return u
  }
  const run = (eavesToGable: boolean): StructuralLayoutDraft => {
    const g = ground()
    partition(g, 40, 200, 279, 205)
    return layoutOf([
      { id: 'g', storey: 'GROUND', raster: g, chains: gChains() },
      { id: 'u', storey: 'UPPER', raster: gabled(eavesToGable), chains: [chain('ux', 'HORIZONTAL', [40, 280]), chain('uy', 'VERTICAL', [60, 360])] },
    ])
  }

  it('B5L-1 a region the chain lines cut a metre short of its gables, where both eaves walls run on to them: the storey is the body', () => {
    const d = run(true)
    expect(footprintsAt(d, 1)).toEqual([[0, 0, 12, 17]])
  })
})

describe('005L council D: generalization', () => {
  for (const mirrored of [false, true]) {
    it(`D5L-4 a storey 2 m shallower than the house, with nothing stating which end it is flush with${mirrored ? ', the drawings mirrored' : ''}: ambiguous, never the first found`, () => {
      const g = sheet(400, 460)
      walls(g, 40, 40, 279, 379, [{ side: mirrored ? 'N' : 'S', from: 120, to: 200 }])
      const u = sheet(400, 460)
      walls(u, 40, 60, 279, 359)
      const d = layoutOf([
        { id: 'g', storey: 'GROUND', raster: g, chains: [chain('gx', 'HORIZONTAL', [40, 280]), chain('gy', 'VERTICAL', [40, 380])] },
        { id: 'u', storey: 'UPPER', raster: u, chains: [chain('ux', 'HORIZONTAL', [40, 280]), chain('uy', 'VERTICAL', [60, 360])] },
      ])
      expect(decisionOf(d, 'u')).toBe('AMBIGUOUS')
    })
  }
})
