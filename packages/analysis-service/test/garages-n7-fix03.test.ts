/**
 * N7-COUNCIL-FIX-03, end to end through the production service: garages and attached bodies the plan draws are not
 * lost between the decomposition and the model (Council C-1/C-2), a gate wider than a door is not an open side, a
 * porch open across its front does not become a garage, and a body lost anyway cannot leave the run COMPLETE. Every
 * fixture is invented (`synthetic-drawings`, HOLLOWAY: an 8.40 × 10.20 m two-storey house); a reconstruction of
 * nothing.
 */
import { describe, expect, it } from 'vitest'
import { memoryByteCache } from '@buildapp/source-package'
import { HOLLOWAY, syntheticPublisher } from '@buildapp/synthetic-drawings'
import type { SyntheticHouse, SyntheticOpening } from '@buildapp/synthetic-drawings'
import { loadBundle, sha256 } from '@buildapp/mobile-scene'
import { serializeModel } from '@buildapp/model'
import { verifyReplay } from '@buildapp/reconstruction'
import { runAnalysis } from '../src/index.js'

const gate = (at = 0.6, width = 2.4): SyntheticOpening => ({ side: 'FRONT', kind: 'DOOR', at, width, height: 2.1, sill: 0, storey: 0 })
const win = (side: SyntheticOpening['side'], at: number, width = 1.0): SyntheticOpening => ({ side, kind: 'WINDOW', at, width, height: 1.2, sill: 0.9, storey: 0 })
const wing = (depth: number, offsetZ: number, openings: SyntheticOpening[] = [gate()], width = 3.6, more: Partial<NonNullable<SyntheticHouse['wings']>[number]> = {}) => ({ name: 'garage', width, depth, offsetZ, storeys: 1, roof: 'FLAT' as const, openings, ...more })

const CASES: Record<string, SyntheticHouse> = {
  // C-2: a 3.6 m garage set back 0.30 m from the house's front, a 2.4 m gate
  setback: { ...HOLLOWAY, name: 'Setback', chainsZ: [3.9, 6.0, 0.3], wings: [wing(6.0, 3.9)] },
  // §3: a 6.0 m garage behind a 5.0 m gate between 0.5 m jambs, the gate's width printed on the front chain
  wide5: { ...HOLLOWAY, name: 'Wide gate', chainsX: [8.4, 0.5, 5.0, 0.5], wings: [wing(6.0, 4.2, [gate(0.5, 5.0)], 6.0)] },
  // the same hole with nothing printed across it: walls round a hole and no word that it is a gate
  wide5blank: { ...HOLLOWAY, name: 'Wide hole', chainsX: [8.4, 6.0], wings: [wing(6.0, 4.2, [gate(0.5, 5.0)], 6.0)] },
  // C-1: a garage on the house's rear face, its front 1.2 m behind the house's (house + garage the largest rectangle)
  strip120: { ...HOLLOWAY, name: 'Strip', chainsZ: [1.2, 9.0], wings: [wing(9.0, 1.2)] },
  // C-1: a one-storey garage flush with both faces of the two-storey house, under a roof of its own
  flush: { ...HOLLOWAY, name: 'Flush', chainsZ: [10.2], wings: [wing(10.2, 0)] },
  // a 1.6 m store drawn with 0.15 m walls of its own
  thin: { ...HOLLOWAY, name: 'Thin store', chainsX: [8.4, 1.6], wings: [wing(6.0, 4.2, [], 1.6, { ownWallThickness: 0.15 })] },
  // a garage with its gate and four windows in its side wall
  four: { ...HOLLOWAY, name: 'Four', wings: [wing(6.0, 4.2, [gate(), win('RIGHT', 0.5, 0.9), win('RIGHT', 2.0, 0.9), win('RIGHT', 3.5, 0.9), win('RIGHT', 5.0, 0.6)])] },
  // FIX-02's WING25: a 0.44 m house whose garage is drawn with 0.25 m walls of its own (short jambs the band reader drops)
  wing25: { ...HOLLOWAY, name: 'Wing 25', wallThickness: 0.44, wings: [wing(6.0, 4.2, [gate()], 3.6, { ownWallThickness: 0.25 })] },
  // must not become a garage: a 2.4 m deep porch open across its whole front
  portico: { ...HOLLOWAY, name: 'Portico', chainsZ: [7.8, 2.4], wings: [{ ...wing(2.4, 7.8, [gate(0, 3.6)]), name: 'porch' }] },
}

const publisher = syntheticPublisher({ projects: Object.entries(CASES).map(([code, house]) => ({ code, title: house.name, house })) })
const run = (code: string) => runAnalysis({ kind: 'URL', url: publisher.pageUrl(code) }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })
const runs = Object.fromEntries(Object.keys(CASES).map((c) => [c, run(c)])) as Record<keyof typeof CASES, ReturnType<typeof run>>
for (const p of Object.values(runs)) p.catch(() => undefined)

type Out = Awaited<ReturnType<typeof run>>
const sound = ({ result, sceneText }: Out): void => {
  expect(result.verification.replay).toBe('BYTE_IDENTICAL')
  expect(verifyReplay(result.candidate).ok).toBe(true)
  expect(sha256(serializeModel(result.model))).toBe(result.modelSha256)
  expect(loadBundle(sceneText).ok).toBe(true)
}
const bodies = ({ reconstruction }: Out) => reconstruction.building.masses.map((m) => ({ id: m.id, x0: m.x0, x1: m.x1, z0: m.z0, z1: m.z1, storeys: m.storeys }))
const attached = (o: Out) => bodies(o).filter((m) => m.id !== 'main')
const main = (o: Out) => bodies(o).find((m) => m.id === 'main')
/** The house, 8.40 m wide and two storeys, untouched by its garage. */
const houseIntact = (o: Out): void => {
  expect(main(o)?.x0).toBeCloseTo(0, 1)
  expect(main(o)?.x1).toBeCloseTo(8.4, 1)
  expect(main(o)?.storeys).toEqual([0, 1])
  expect(o.reconstruction.building.mainRoof?.footprint.x1).toBeLessThan(8.6)
}
const completeAndAccounted = (o: Out): void => {
  expect(o.result.preview.outcome).toBe('COMPLETE')
  expect(o.reconstruction.bodyCompleteness?.missing).toEqual([])
  expect(o.reconstruction.bodyCompleteness?.coverage).toBe(1)
}

describe('N7-COUNCIL-FIX-03 (C-2): a garage behind its gate is not ground', () => {
  it('a garage set back 0.30 m behind the house face, its gate 2.4 m: built, one storey, its own roof', async () => {
    const o = await runs.setback
    houseIntact(o)
    const [g] = attached(o)
    expect(g).toMatchObject({ storeys: [0] })
    expect(g.x1 - g.x0).toBeCloseTo(3.6, 1)
    // 6.00 m drawn; the grid thins the 0.30 m set-back onto the house's face line (minCellM 0.45): 6.30 m, on the record
    expect(g.z1 - g.z0).toBeGreaterThan(5.9)
    expect(g.z1 - g.z0).toBeLessThan(6.4)
    expect(o.result.model.roofs.map((r) => r.id).sort()).toEqual(['roof-attached-0', 'roof-main'])
    completeAndAccounted(o)
    sound(o)
  })

  it('WING25: a 0.44 m house, its garage drawn with 0.25 m walls and a 2.4 m gate between short jambs, is built with its own walls', async () => {
    const o = await runs.wing25
    houseIntact(o)
    const [g] = attached(o)
    expect(g.x1 - g.x0).toBeCloseTo(3.6, 1)
    expect(g.z1 - g.z0).toBeCloseTo(6.0, 1)
    const garage = o.reconstruction.building.masses.find((m) => m.role === 'ATTACHED')
    expect(garage?.wallThicknessM).toBeGreaterThan(0.22)
    expect(garage?.wallThicknessM).toBeLessThan(0.3)
    expect(o.reconstruction.bodyRecovery.gateBays.map((b) => b.decision)).toEqual(['GATE_SHUT'])
    completeAndAccounted(o)
    sound(o)
  })

  it('a 5.0 m gate between jambs, two side walls and a back wall: the gate shuts a garage, it is not an open side', async () => {
    const o = await runs.wide5
    houseIntact(o)
    const [g] = attached(o)
    expect(g.x1 - g.x0).toBeCloseTo(6.0, 1)
    expect(g.z1 - g.z0).toBeCloseTo(6.0, 1)
    expect(o.reconstruction.bodyCompleteness?.areas.every((a) => a.decision === 'REPRESENTED' || a.decision === 'JOINED')).toBe(true)
    const [bay] = o.reconstruction.bodyRecovery.gateBays
    expect(bay).toMatchObject({ decision: 'GATE_SHUT' })
    expect(bay.gapM).toBeCloseTo(5.0, 0)
    expect(bay.why).toContain('the gate\u2019s width is printed')
    completeAndAccounted(o)
    sound(o)
  })

  it('the same 5.0 m hole with nothing saying it is a gate is not closed blindly: named as a question, the house kept', async () => {
    const o = await runs.wide5blank
    houseIntact(o)
    expect(attached(o)).toEqual([])
    const pocket = o.reconstruction.bodyCompleteness?.areas.find((a) => a.decision === 'UNRESOLVED')
    expect(pocket?.why).toContain('nothing says its mouth is a gate')
    expect(o.reconstruction.bodyRecovery.gateBays.map((b) => b.decision)).toEqual(['LEFT_OPEN'])
    sound(o)
  })

  it('a porch 2.4 m deep, open across its whole front, is not made a garage: named, not built', async () => {
    const o = await runs.portico
    houseIntact(o)
    expect(attached(o)).toEqual([])
    const pocket = o.reconstruction.bodyCompleteness?.areas.find((a) => a.decision === 'UNRESOLVED')
    expect(pocket?.why).toContain('no jamb of wall')
    expect(pocket?.why).toContain('less than the 4.5 m a car stands in')
    expect(o.reconstruction.unresolved.some((u) => u.reason.includes('no jamb of wall'))).toBe(true)
    sound(o)
  })
})

describe('N7-COUNCIL-FIX-03 (C-1): a garage is not merged into the house because the merged rectangle is larger', () => {
  it('a garage behind the house front by 1.2 m: the house keeps its 8.40 × 10.20 m, the garage its 3.60 × 9.00 m, no phantom strip', async () => {
    const o = await runs.strip120
    houseIntact(o)
    expect((main(o)?.z1 ?? 0) - (main(o)?.z0 ?? 0)).toBeCloseTo(10.2, 1)
    const [g, ...more] = attached(o)
    expect(more).toEqual([])
    expect(g).toMatchObject({ storeys: [0] })
    expect(g.x1 - g.x0).toBeCloseTo(3.6, 1)
    expect(g.z1 - g.z0).toBeCloseTo(9.0, 1)
    expect(o.reconstruction.layout.gate.status).toBe('STRUCTURAL_LAYOUT_ACCEPTED')
    completeAndAccounted(o)
    sound(o)
  })

  it('a one-storey garage flush with both faces: cut on the wall the upper storey stops at, under its own roof', async () => {
    const o = await runs.flush
    houseIntact(o)
    const [g] = attached(o)
    expect(g).toMatchObject({ storeys: [0] })
    expect(g.x1 - g.x0).toBeCloseTo(3.6, 1)
    expect(o.result.model.roofs.map((r) => r.id).sort()).toEqual(['roof-attached-0', 'roof-main'])
    expect(o.reconstruction.layout.gate.status).toBe('STRUCTURAL_LAYOUT_ACCEPTED')
    completeAndAccounted(o)
    sound(o)
  })
})

describe('N7-COUNCIL-FIX-03: bodies that were sound stay sound', () => {
  it('a 1.6 m store with 0.15 m walls of its own is built with them (FIX-02)', async () => {
    const o = await runs.thin
    houseIntact(o)
    const store = o.reconstruction.building.masses.find((m) => m.role === 'ATTACHED')
    expect(store?.wallThicknessM).toBeGreaterThan(0.12)
    expect(store?.wallThicknessM).toBeLessThan(0.2)
    expect(o.reconstruction.preEmitRings.filter((c) => c.ringWouldOverlap)).toEqual([])
    completeAndAccounted(o)
    sound(o)
  })

  it('a garage with a gate and four windows in one wall keeps all five openings', async () => {
    const o = await runs.four
    houseIntact(o)
    expect(attached(o)).toHaveLength(1)
    const ring = o.result.model.walls.filter((w) => w.id.startsWith('ring-attached-0-0-')).map((w) => w.id)
    const onGarage = o.result.model.openings.filter((op) => ring.includes(op.wallId))
    expect(onGarage.length).toBeGreaterThanOrEqual(5)
    completeAndAccounted(o)
    sound(o)
  })
})
