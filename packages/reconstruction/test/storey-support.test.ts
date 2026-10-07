/**
 * BUILDPLAN-ANALYZER-005L — the storey-support corpus.
 *
 * Plans drawn in code, so the answer is known: which body each walled region of another storey's plan stands on,
 * and the footprint it stands on there. Registration (where the plan sits) and support (what carries each of its
 * walled regions) are separate questions, and each fixture below asks one of the ways they differ:
 *
 *   1 the same rectangle up and down          9 an upper envelope that takes in a terrace its walls do not enclose
 *   2 inset on one side                      10 an L-shaped upper storey over one body
 *   3 inset on every side                    11 two disconnected upper regions over one body
 *   4 an upper floor under half the body     12 a registration a few pixels out, within a wall
 *   5 a house and a one-storey garage        13 an upper storey reaching past every body below it
 *   6 an upper floor over both bodies        14 an attic plan
 *   7 two equal bodies: ambiguous            15 ground, upper and attic, in order
 *   8 an upper plan with no scale of its own 16 the same buildings mirrored, and enumerated in other orders
 *
 * Nothing here is a drawing of any real building.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import type { CoordinateRegistration, DimensionChain } from '@buildapp/source-metrics'
import type { SourceCoordinateFrame } from '@buildapp/source-observations'
import { inferStructuralLayout, ringBounds } from '../src/index.js'
import type { StructuralLayoutDraft } from '../src/index.js'
import { chain, graphOf, metricsOf, partition, planFrame, registration, sheet, walls } from './plan.js'
import { BLACK, fillRect } from '../../source-cv/test/draw.js'

type Plan = { id: string; storey: 'GROUND' | 'UPPER' | 'ATTIC' | 'BASEMENT'; raster: Raster; chains?: DimensionChain[]; registered?: boolean }

/**
 * What each fixture decided, for the stage's corpus record (`synthetic-storey-corpus.json`): written only when
 * STOREY_ARTIFACTS_DIR names a directory outside the repository, and never read back by any test.
 */
const corpus: unknown[] = []
const ARTIFACTS = process.env.STOREY_ARTIFACTS_DIR
afterAll(() => {
  if (!ARTIFACTS) return
  if (resolve(ARTIFACTS).startsWith(resolve(import.meta.dirname, '../../..'))) throw new Error('the corpus record is written outside the repository')
  mkdirSync(ARTIFACTS, { recursive: true })
  writeFileSync(join(ARTIFACTS, 'synthetic-storey-corpus.json'), `${JSON.stringify({ fixtures: corpus }, null, 1)}\n`)
})

/** The layout pass over a set of plans: chains and a registration only where a plan prints them. */
export function layoutOf(plans: readonly Plan[], order: { frames?: number[]; chains?: boolean } = {}): StructuralLayoutDraft {
  const draft = layoutPass(plans, order)
  if (ARTIFACTS) {
    const r6 = (v: number): number => Number(v.toFixed(3))
    const boxOf = (ring: Parameters<typeof ringBounds>[0]): number[] => {
      const b = ringBounds(ring)
      return [b.x0, b.z0, b.x1, b.z1].map(r6)
    }
    corpus.push({
      fixture: expect.getState().currentTestName,
      order,
      plans: plans.map((p) => ({ id: p.id, storey: p.storey, sizePx: [p.raster.width, p.raster.height], chains: (p.chains ?? []).length, registered: p.registered !== false && (p.chains?.length ?? 0) > 0 })),
      base: draft.base?.frame.id ?? null,
      masses: draft.masses.map((m) => ({ id: m.id, box: boxOf(m.ring), storeys: [m.storeySpan.fromIndex, m.storeySpan.toIndex], role: m.role })),
      registrations: draft.storeyRegistrations.map((r) => ({
        frameId: r.frameId,
        storeyIndex: r.storeyIndex,
        decision: r.decision,
        candidates: r.candidates,
        chosen: r.chosen ? { targetId: r.chosen.targetId, scale: r6(r.chosen.scale), stated: r.chosen.stated, score: r6(r.chosen.score) } : null,
        margin: r.margin ?? null,
        regions: r.regions.map((g) => ({ id: g.regionId, bounds: [g.bounds.x0, g.bounds.z0, g.bounds.x1, g.bounds.z1].map(r6), body: g.body, overhang: g.overhang, unsupportedM2: r6(g.unsupportedM2) })),
        relations: r.relations.map((x) => ({ region: x.upperRegionId, mass: x.lowerMassId, status: x.supportStatus, overlapM: [r6(x.overlapM.x), r6(x.overlapM.z)], upperSupportedShare: r6(x.upperSupportedShare), lowerCoveredShare: r6(x.lowerCoveredShare) })),
        why: r.why,
      })),
      footprints: draft.footprintRegions.filter((f) => f.kind === 'BUILT').map((f) => ({ id: f.id, storey: draft.storeys.find((s) => s.id === f.storeyId)?.index ?? null, box: boxOf(f.ring) })),
      unresolved: draft.unresolved.map((u) => `${u.status}: ${u.what}`),
      conflicts: draft.conflicts.map((c) => c.kind),
    })
  }
  return draft
}

function layoutPass(plans: readonly Plan[], order: { frames?: number[]; chains?: boolean }): StructuralLayoutDraft {
  const frames: SourceCoordinateFrame[] = plans.map((p) => planFrame(p.id, p.storey, { width: p.raster.width, height: p.raster.height }))
  const chains = plans.flatMap((p) => (p.chains ?? []).map((c) => ({ ...c, frameId: p.id })))
  const regs: CoordinateRegistration[] = plans.filter((p) => p.registered !== false && (p.chains?.length ?? 0) > 0).map((p) => registration(p.id))
  const permute = <T>(xs: readonly T[], idx?: number[]): T[] => (idx ? idx.map((i) => xs[i]) : [...xs])
  return inferStructuralLayout({
    slug: 'storey-support',
    sourcePackageId: 'src-test',
    sourcePackageHash: 'd'.repeat(64),
    graph: graphOf(permute(frames, order.frames)),
    metrics: metricsOf(order.chains ? [...chains].reverse() : chains, regs),
    raster: (frame) => plans.find((p) => p.id === frame.id)?.raster,
  })
}

const box = (draft: StructuralLayoutDraft, id: string): number[] => {
  const r = draft.footprintRegions.find((f) => f.id === id)
  if (!r) return []
  const b = ringBounds(r.ring)
  return [b.x0, b.z0, b.x1, b.z1].map((v) => Number(v.toFixed(1)))
}
const massBox = (draft: StructuralLayoutDraft, id: string): number[] => {
  const m = draft.masses.find((x) => x.id === id)
  if (!m) return []
  const b = ringBounds(m.ring)
  return [b.x0, b.z0, b.x1, b.z1].map((v) => Number(v.toFixed(1)))
}
const spans = (draft: StructuralLayoutDraft): string[] =>
  draft.masses.map((m) => `${massBox(draft, m.id).join(',')} ${m.storeySpan.fromIndex}..${m.storeySpan.toIndex}`).sort()
const upperRegions = (draft: StructuralLayoutDraft, index = 1): number[][] =>
  draft.footprintRegions
    .filter((r) => r.kind === 'BUILT' && draft.storeys.find((s) => s.id === r.storeyId)?.index === index)
    .map((r) => {
      const b = ringBounds(r.ring)
      return [b.x0, b.z0, b.x1, b.z1].map((v) => Number(v.toFixed(1)))
    })
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
const decisionOf = (draft: StructuralLayoutDraft, frameId: string): string | undefined => draft.storeyRegistrations.find((r) => r.frameId === frameId)?.decision

/** The ground plan of fixture 5: a 12 × 17 m house and an 8.6 × 9 m one-storey garage against its east wall. */
const houseAndGarage = (): Raster => {
  const r = sheet(560, 520)
  walls(r, 40, 40, 279, 379, [{ side: 'S', from: 120, to: 200 }])
  walls(r, 268, 200, 439, 379, [{ side: 'S', from: 320, to: 400 }])
  partition(r, 40, 200, 279, 205)
  return r
}
const groundChains5 = (): DimensionChain[] => [chain('gx', 'HORIZONTAL', [40, 280, 440]), chain('gy', 'VERTICAL', [40, 200, 380])]

describe('005L storey support: the corpus', () => {
  it('1. the same rectangle up and down: one body on two storeys, the upper footprint the body', () => {
    const g = sheet(400, 460)
    walls(g, 40, 40, 279, 379, [{ side: 'S', from: 120, to: 200 }])
    partition(g, 40, 200, 279, 205)
    const u = sheet(400, 460)
    walls(u, 40, 40, 279, 379)
    partition(u, 40, 220, 279, 225)
    const d = layoutOf([
      { id: 'g', storey: 'GROUND', raster: g, chains: [chain('gx', 'HORIZONTAL', [40, 280]), chain('gy', 'VERTICAL', [40, 380])] },
      { id: 'u', storey: 'UPPER', raster: u, chains: [chain('ux', 'HORIZONTAL', [40, 280]), chain('uy', 'VERTICAL', [40, 380])] },
    ])
    expect(spans(d)).toEqual(['0,0,12,17 0..1'])
    expect(upperRegions(d)).toEqual([[0, 0, 12, 17]])
    expect(decisionOf(d, 'u')).toBe('STACKED')
  })

  it('2. inset on one side: the upper footprint stops where its own walls do', () => {
    const g = sheet(400, 460)
    walls(g, 40, 40, 279, 379, [{ side: 'S', from: 120, to: 200 }])
    const u = sheet(400, 460)
    walls(u, 40, 40, 279, 259)
    const d = layoutOf([
      { id: 'g', storey: 'GROUND', raster: g, chains: [chain('gx', 'HORIZONTAL', [40, 280]), chain('gy', 'VERTICAL', [40, 380])] },
      // its own depth chain runs the whole building and breaks where its walls stop: it states where it stands
      { id: 'u', storey: 'UPPER', raster: u, chains: [chain('ux', 'HORIZONTAL', [40, 280]), chain('uy', 'VERTICAL', [40, 260, 380])] },
    ])
    expect(spans(d)).toEqual(['0,0,12,17 0..1'])
    expect(upperRegions(d)).toEqual([[0, 0, 12, 11]])
  })

  it('2b. inset on one side with nothing stating which side: the ambiguity is named, never guessed', () => {
    const g = sheet(400, 460)
    walls(g, 40, 40, 279, 379, [{ side: 'S', from: 120, to: 200 }])
    const u = sheet(400, 460)
    walls(u, 40, 40, 279, 259)
    const d = layoutOf([
      { id: 'g', storey: 'GROUND', raster: g, chains: [chain('gx', 'HORIZONTAL', [40, 280]), chain('gy', 'VERTICAL', [40, 380])] },
      // its chains measure only its own walls: flush at the rear or at the front fit the walls the same
      { id: 'u', storey: 'UPPER', raster: u, chains: [chain('ux', 'HORIZONTAL', [40, 280]), chain('uy', 'VERTICAL', [40, 260])] },
    ])
    expect(decisionOf(d, 'u')).toBe('AMBIGUOUS')
    expect(spans(d)).toEqual(['0,0,12,17 0..0'])
    expect(d.unresolved.some((x) => x.what.includes('which body the upper storey stands on'))).toBe(true)
  })

  it('3. inset on every side: a footprint inside the body on all four', () => {
    const g = sheet(400, 460)
    walls(g, 40, 40, 279, 379, [{ side: 'S', from: 120, to: 200 }])
    const u = sheet(400, 460)
    walls(u, 80, 80, 239, 339)
    const d = layoutOf([
      { id: 'g', storey: 'GROUND', raster: g, chains: [chain('gx', 'HORIZONTAL', [40, 280]), chain('gy', 'VERTICAL', [40, 380])] },
      { id: 'u', storey: 'UPPER', raster: u, chains: [chain('ux', 'HORIZONTAL', [40, 80, 240, 280]), chain('uy', 'VERTICAL', [40, 80, 340, 380])] },
    ])
    expect(spans(d)).toEqual(['0,0,12,17 0..1'])
    expect(upperRegions(d)).toEqual([[2, 2, 10, 15]])
  })

  it('4. an upper floor covering a fifth of a large body is still carried by it', () => {
    const g = sheet(520, 460)
    walls(g, 40, 40, 439, 379, [{ side: 'S', from: 120, to: 200 }])
    const u = sheet(520, 460)
    walls(u, 40, 40, 199, 219)
    const d = layoutOf([
      { id: 'g', storey: 'GROUND', raster: g, chains: [chain('gx', 'HORIZONTAL', [40, 440]), chain('gy', 'VERTICAL', [40, 380])] },
      { id: 'u', storey: 'UPPER', raster: u, chains: [chain('ux', 'HORIZONTAL', [40, 200, 440]), chain('uy', 'VERTICAL', [40, 220, 380])] },
    ])
    expect(spans(d)).toEqual(['0,0,20,17 0..1'])
    expect(upperRegions(d)).toEqual([[0, 0, 8, 9]])
    const rel = d.storeyRegistrations[0].relations.find((r) => r.supportStatus === 'SUPPORTS')
    expect(rel?.lowerCoveredShare).toBeLessThan(0.5)
    // carried entirely: the region is measured to its walls' outer faces, a few centimetres past the grid line
    expect(rel?.upperSupportedShare).toBeGreaterThan(0.98)
  })

  it('5. a house and a one-storey garage, the upper floor over the house: the garage stays one storey', () => {
    const u = sheet(560, 520)
    walls(u, 40, 40, 279, 379, [{ side: 'S', from: 120, to: 200 }])
    partition(u, 40, 220, 279, 225)
    const d = layoutOf([
      { id: 'g', storey: 'GROUND', raster: houseAndGarage(), chains: groundChains5() },
      { id: 'u', storey: 'UPPER', raster: u, chains: [chain('ux', 'HORIZONTAL', [40, 280]), chain('uy', 'VERTICAL', [40, 380])] },
    ])
    expect(spans(d)).toEqual(['0,0,12,17 0..1', '12,8,20,17 0..0'])
    expect(upperRegions(d)).toEqual([[0, 0, 12, 17]])
    const garage = d.storeyRegistrations[0].relations.find((r) => r.lowerMassId !== 'mass-0' && r.lowerMassId !== d.masses.find((m) => massBox(d, m.id)[0] === 0)?.id)
    expect(garage?.supportStatus ?? 'NONE').not.toBe('SUPPORTS')
  })

  it('5b. an upper floor a wall wider than the house, its east wall over the garage: a sliver over the garage carries nothing (M7)', () => {
    // The upper plan draws its east wall a wall's thickness further east than the house's: 0.6 m over the garage
    // along x, the garage's whole depth along z. A room needs 1.4 m on both axes; that strip is a wall standing on
    // the garage's roof edge, not a storey of the garage.
    const u = sheet(560, 520)
    walls(u, 40, 40, 291, 379, [{ side: 'S', from: 120, to: 200 }])
    partition(u, 40, 220, 291, 225)
    const d = layoutOf([
      { id: 'g', storey: 'GROUND', raster: houseAndGarage(), chains: groundChains5() },
      { id: 'u', storey: 'UPPER', raster: u, chains: [chain('ux', 'HORIZONTAL', [40, 292]), chain('uy', 'VERTICAL', [40, 380])] },
    ])
    expect(decisionOf(d, 'u')).toBe('STACKED')
    expect(spans(d)).toEqual(['0,0,12,17 0..1', '12,8,20,17 0..0'])
    const garage = d.masses.find((m) => massBox(d, m.id)[0] === 12)
    const over = d.storeyRegistrations[0].relations.filter((r) => r.lowerMassId === garage?.id)
    expect(over.length).toBeGreaterThan(0)
    expect(over.every((r) => r.supportStatus === 'INCIDENTAL')).toBe(true)
  })

  it('6. an upper floor over both bodies, as its own plan draws it: both reach the upper storey', () => {
    const u = sheet(560, 520)
    walls(u, 40, 40, 279, 379, [{ side: 'S', from: 120, to: 200 }])
    walls(u, 268, 200, 439, 379)
    const d = layoutOf([
      { id: 'g', storey: 'GROUND', raster: houseAndGarage(), chains: groundChains5() },
      { id: 'u', storey: 'UPPER', raster: u, chains: [chain('ux', 'HORIZONTAL', [40, 280, 440]), chain('uy', 'VERTICAL', [40, 200, 380])] },
    ])
    expect(spans(d)).toEqual(['0,0,12,17 0..1', '12,8,20,17 0..1'])
  })

  it('7. two equal bodies and an upper plan with no scale of its own that fits either: left unresolved, never the first found', () => {
    const g = sheet(480, 360)
    walls(g, 40, 40, 199, 299)
    walls(g, 260, 40, 419, 299)
    const u = sheet(480, 360)
    walls(u, 160, 40, 319, 299)
    const d = layoutOf([
      { id: 'g', storey: 'GROUND', raster: g, chains: [chain('gx', 'HORIZONTAL', [40, 200, 260, 420]), chain('gy', 'VERTICAL', [40, 300])] },
      { id: 'u', storey: 'UPPER', raster: u },
    ])
    expect(d.masses.every((m) => m.storeySpan.toIndex === 0)).toBe(true)
    expect(decisionOf(d, 'u')).toBe('AMBIGUOUS')
    expect(d.conflicts.some((c) => c.kind === 'STOREY_COVERAGE_DISAGREES')).toBe(true)
    expect(d.unresolved.some((u2) => u2.what.includes('which body the upper storey stands on'))).toBe(true)
  })

  it('8. an upper plan that prints no scale, drawn smaller: registered by its walls alone', () => {
    const g = sheet(560, 520)
    walls(g, 40, 40, 279, 379, [{ side: 'S', from: 120, to: 200 }])
    walls(g, 268, 200, 439, 379, [{ side: 'S', from: 320, to: 400 }])
    partition(g, 40, 200, 279, 205)
    // the same house at 0.8 of the ground plan's scale, offset on the sheet, with no chain and no registration
    const u = sheet(400, 420)
    const at = (v: number): number => Math.round(30 + v * 0.8)
    walls(u, at(40), at(40), at(279), at(379))
    partition(u, at(40), at(220), at(279), at(220) + 4)
    const d = layoutOf([
      { id: 'g', storey: 'GROUND', raster: g, chains: groundChains5() },
      { id: 'u', storey: 'UPPER', raster: u },
    ])
    expect(spans(d)).toEqual(['0,0,12,17 0..1', '12,8,20,17 0..0'])
    const reg = d.storeyRegistrations.find((r) => r.frameId === 'u')
    expect(reg?.chosen?.scale).toBeCloseTo(1.25, 1)
  })

  it('9. an upper envelope that takes in a terrace its walls do not enclose: the terrace is no upper room', () => {
    const g = sheet(400, 460)
    walls(g, 40, 40, 279, 379, [{ side: 'S', from: 120, to: 200 }])
    const u = sheet(400, 460)
    walls(u, 40, 40, 279, 259)
    // the terrace's parapet: a wall band down the west side and along the south edge, open to the east
    fillRect(u, 40, 259, 51, 379, BLACK)
    fillRect(u, 40, 368, 200, 379, BLACK)
    const d = layoutOf([
      { id: 'g', storey: 'GROUND', raster: g, chains: [chain('gx', 'HORIZONTAL', [40, 280]), chain('gy', 'VERTICAL', [40, 380])] },
      { id: 'u', storey: 'UPPER', raster: u, chains: [chain('ux', 'HORIZONTAL', [40, 280]), chain('uy', 'VERTICAL', [40, 260, 380])] },
    ])
    expect(spans(d)).toEqual(['0,0,12,17 0..1'])
    expect(upperRegions(d)).toEqual([[0, 0, 12, 11]])
  })

  it('10. an L-shaped upper storey over one body: two footprints, never their bounding box', () => {
    const g = sheet(520, 460)
    walls(g, 40, 40, 439, 379, [{ side: 'S', from: 120, to: 200 }])
    const u = sheet(520, 460)
    walls(u, 40, 40, 279, 379)
    walls(u, 268, 40, 439, 199)
    const d = layoutOf([
      { id: 'g', storey: 'GROUND', raster: g, chains: [chain('gx', 'HORIZONTAL', [40, 440]), chain('gy', 'VERTICAL', [40, 380])] },
      { id: 'u', storey: 'UPPER', raster: u, chains: [chain('ux', 'HORIZONTAL', [40, 280, 440]), chain('uy', 'VERTICAL', [40, 200, 380])] },
    ])
    expect(spans(d)).toEqual(['0,0,20,17 0..1'])
    const regions = upperRegions(d)
    expect(regions).toHaveLength(2)
    const area = regions.reduce((a, r) => a + (r[2] - r[0]) * (r[3] - r[1]), 0)
    expect(area).toBeGreaterThan(260)
    expect(area).toBeLessThan(300)
    // nothing over the south-east corner the L leaves open
    for (const r of regions) expect(r[0] >= 12 && r[1] >= 8).toBe(false)
  })

  it('11. two disconnected upper regions over one body: two footprints and nothing over the gap', () => {
    const g = sheet(520, 460)
    walls(g, 40, 40, 439, 379, [{ side: 'S', from: 120, to: 200 }])
    const u = sheet(520, 460)
    walls(u, 40, 40, 159, 379)
    walls(u, 320, 40, 439, 379)
    const d = layoutOf([
      { id: 'g', storey: 'GROUND', raster: g, chains: [chain('gx', 'HORIZONTAL', [40, 440]), chain('gy', 'VERTICAL', [40, 380])] },
      { id: 'u', storey: 'UPPER', raster: u, chains: [chain('ux', 'HORIZONTAL', [40, 160, 320, 440]), chain('uy', 'VERTICAL', [40, 380])] },
    ])
    expect(spans(d)).toEqual(['0,0,20,17 0..1'])
    expect(upperRegions(d)).toEqual([
      [0, 0, 6, 17],
      [14, 0, 20, 17],
    ])
  })

  it('12. a registration a few pixels out stays within a wall: the footprint is the body, no overhang is claimed', () => {
    const g = sheet(400, 460)
    walls(g, 40, 40, 279, 379, [{ side: 'S', from: 120, to: 200 }])
    const u = sheet(400, 460)
    walls(u, 44, 43, 283, 382)
    const d = layoutOf([
      { id: 'g', storey: 'GROUND', raster: g, chains: [chain('gx', 'HORIZONTAL', [40, 280]), chain('gy', 'VERTICAL', [40, 380])] },
      { id: 'u', storey: 'UPPER', raster: u, chains: [chain('ux', 'HORIZONTAL', [44, 284]), chain('uy', 'VERTICAL', [43, 383])] },
    ])
    expect(spans(d)).toEqual(['0,0,12,17 0..1'])
    expect(upperRegions(d)).toEqual([[0, 0, 12, 17]])
    expect(d.unresolved.some((u2) => u2.id.startsWith('gap-overhang'))).toBe(false)
  })

  it('13. an upper storey reaching 2.5 m past every body below it: built where it stands, the overhang named', () => {
    const g = sheet(460, 460)
    walls(g, 40, 40, 279, 379, [{ side: 'S', from: 120, to: 200 }])
    const u = sheet(460, 460)
    walls(u, 40, 40, 329, 379)
    const d = layoutOf([
      { id: 'g', storey: 'GROUND', raster: g, chains: [chain('gx', 'HORIZONTAL', [40, 280]), chain('gy', 'VERTICAL', [40, 380])] },
      { id: 'u', storey: 'UPPER', raster: u, chains: [chain('ux', 'HORIZONTAL', [40, 330]), chain('uy', 'VERTICAL', [40, 380])] },
    ])
    expect(spans(d)).toEqual(['0,0,12,17 0..1'])
    expect(upperRegions(d)).toEqual([[0, 0, 12, 17]])
    const region = d.storeyRegistrations[0].regions.find((r) => r.body)
    expect(region?.overhang).toBe('BEYOND_TOLERANCE')
    expect(region?.unsupportedM2).toBeGreaterThan(30)
    expect(d.unresolved.some((u2) => u2.id.startsWith('gap-overhang'))).toBe(true)
    expect(d.conflicts.some((c) => c.what.includes('overhangs'))).toBe(true)
  })

  it('14. an attic plan is a storey above the ground floor and stacks the same way', () => {
    const g = sheet(400, 460)
    walls(g, 40, 40, 279, 379, [{ side: 'S', from: 120, to: 200 }])
    const a = sheet(400, 460)
    walls(a, 40, 80, 279, 339)
    const d = layoutOf([
      { id: 'g', storey: 'GROUND', raster: g, chains: [chain('gx', 'HORIZONTAL', [40, 280]), chain('gy', 'VERTICAL', [40, 380])] },
      { id: 'a', storey: 'ATTIC', raster: a, chains: [chain('ax', 'HORIZONTAL', [40, 280]), chain('ay', 'VERTICAL', [40, 80, 340, 380])] },
    ])
    expect(d.storeys.map((s) => s.index)).toEqual([0, 1])
    expect(spans(d)).toEqual(['0,0,12,17 0..1'])
    expect(upperRegions(d)).toEqual([[0, 2, 12, 15]])
  })

  it('15. ground, upper and attic: three storeys in order, each with its own footprint', () => {
    const g = sheet(400, 460)
    walls(g, 40, 40, 279, 379, [{ side: 'S', from: 120, to: 200 }])
    const u = sheet(400, 460)
    walls(u, 40, 40, 279, 379)
    partition(u, 40, 220, 279, 225)
    const a = sheet(400, 460)
    walls(a, 80, 120, 239, 299)
    const d = layoutOf([
      { id: 'a', storey: 'ATTIC', raster: a, chains: [chain('ax', 'HORIZONTAL', [40, 80, 240, 280]), chain('ay', 'VERTICAL', [40, 120, 300, 380])] },
      { id: 'g', storey: 'GROUND', raster: g, chains: [chain('gx', 'HORIZONTAL', [40, 280]), chain('gy', 'VERTICAL', [40, 380])] },
      { id: 'u', storey: 'UPPER', raster: u, chains: [chain('ux', 'HORIZONTAL', [40, 280]), chain('uy', 'VERTICAL', [40, 380])] },
    ])
    expect(d.storeys.map((s) => s.index)).toEqual([0, 1, 2])
    expect(spans(d)).toEqual(['0,0,12,17 0..2'])
    expect(upperRegions(d, 1)).toEqual([[0, 0, 12, 17]])
    expect(upperRegions(d, 2)).toEqual([[2, 4, 10, 13]])
  })

  it('16. the same buildings mirrored, and their plans, chains and frames enumerated in other orders, decide the same', () => {
    const mirror = (r: Raster): Raster => {
      const out = sheet(r.width, r.height)
      for (let y = 0; y < r.height; y += 1)
        for (let x = 0; x < r.width; x += 1) {
          const i = (y * r.width + x) * 4
          const j = (y * r.width + (r.width - 1 - x)) * 4
          for (let k = 0; k < 4; k += 1) out.data[j + k] = r.data[i + k]
        }
      return out
    }
    const flipX = (W: number, ticks: number[]): number[] => ticks.map((t) => W - t).reverse()
    const u = sheet(560, 520)
    walls(u, 40, 40, 279, 379, [{ side: 'S', from: 120, to: 200 }])
    const plans: Plan[] = [
      { id: 'g', storey: 'GROUND', raster: houseAndGarage(), chains: groundChains5() },
      { id: 'u', storey: 'UPPER', raster: u, chains: [chain('ux', 'HORIZONTAL', [40, 280]), chain('uy', 'VERTICAL', [40, 380])] },
    ]
    const mirrored: Plan[] = [
      { id: 'g', storey: 'GROUND', raster: mirror(houseAndGarage()), chains: [chain('gx', 'HORIZONTAL', flipX(560, [40, 280, 440])), chain('gy', 'VERTICAL', [40, 200, 380])] },
      { id: 'u', storey: 'UPPER', raster: mirror(u), chains: [chain('ux', 'HORIZONTAL', flipX(560, [40, 280])), chain('uy', 'VERTICAL', [40, 380])] },
    ]
    const straight = layoutOf(plans)
    const garageStays = (d: StructuralLayoutDraft): string[] => d.masses.map((m) => `${Math.round(ringBounds(m.ring).x1 - ringBounds(m.ring).x0)}x${Math.round(ringBounds(m.ring).z1 - ringBounds(m.ring).z0)} ${m.storeySpan.toIndex}`).sort()
    expect(garageStays(straight)).toEqual(['12x17 1', '8x9 0'])
    expect(garageStays(layoutOf(mirrored))).toEqual(garageStays(straight))
    expect(garageStays(layoutOf(plans, { frames: [1, 0] }))).toEqual(garageStays(straight))
    expect(garageStays(layoutOf(plans, { chains: true }))).toEqual(garageStays(straight))
    expect(JSON.stringify(layoutOf(plans, { frames: [1, 0], chains: true }).storeyRegistrations)).toBe(JSON.stringify(straight.storeyRegistrations))
  })
})
