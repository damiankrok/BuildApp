/**
 * N7-COUNCIL-FIX-02, end to end through the production service: the exterior wall is read off the outer faces, not
 * from the median of every band (Council B-1); a body drawn with walls of its own is built with them (B-1/B-2); and a
 * body narrower than its walls with a printed width that contradicts the drawing still leaves the partial preview with
 * the way back to the reading (the OWNER's signature: an attached ring, w1/w3, width ≈ wall, SOURCE_CONFLICT). Every
 * fixture is invented (`synthetic-drawings`); a reconstruction of nothing.
 */
import { describe, expect, it } from 'vitest'
import { memoryByteCache } from '@buildapp/source-package'
import { ELMBRIDGE, HOLLOWAY, SLIVERTON, syntheticPublisher } from '@buildapp/synthetic-drawings'
import type { SyntheticHouse } from '@buildapp/synthetic-drawings'
import { loadBundle, sha256 } from '@buildapp/mobile-scene'
import { serializeModel } from '@buildapp/model'
import { verifyReplay } from '@buildapp/reconstruction'
import { runAnalysis } from '../src/index.js'

/** 0.43 m outer walls and heavy 0.20 m partitions, more partition than facade: the plan's band median is a partition. */
const THICK43: SyntheticHouse = {
  ...ELMBRIDGE,
  name: 'Thick 43',
  wallThickness: 0.43,
  partitions: [0, 1].flatMap((storey) => [
    ...[2.0, 3.6, 5.2, 6.4].map((at) => ({ storey, axis: 'Z' as const, at, from: 0.43, to: 5.97, thickness: 0.2, doors: [{ at: 1.0, width: 0.9 }] })),
    ...[2.2, 4.2].map((at) => ({ storey, axis: 'X' as const, at, from: 0.43, to: 7.57, thickness: 0.2, doors: [{ at: 0.6, width: 0.9 }] })),
  ]),
}
const garage = (HOLLOWAY.wings ?? [])[0]
/** A 0.44 m house with a 1.05 m store drawn with its own 0.25 m walls. */
const STORE25: SyntheticHouse = { ...HOLLOWAY, name: 'Store 25', wallThickness: 0.44, chainsX: [8.4, 1.05], wings: [{ ...garage, name: 'store', width: 1.05, ownWallThickness: 0.25, openings: [] }] }
/** A 0.48 m body beside a 0.44 m house, drawn at the house's walls. */
const SLIVER48: SyntheticHouse = { ...SLIVERTON, name: 'Sliver 48', wallThickness: 0.44, wings: [{ ...(SLIVERTON.wings ?? [])[0], width: 0.48 }] }

const publisher = syntheticPublisher({ projects: [{ code: 'thick43', title: 'Thick 43', house: THICK43 }, { code: 'store25', title: 'Store 25', house: STORE25 }, { code: 'sliver48', title: 'Sliver 48', house: SLIVER48 }] })
const run = (code: string) => runAnalysis({ kind: 'URL', url: publisher.pageUrl(code) }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })
const runs = { thick43: run('thick43'), store25: run('store25'), sliver48: run('sliver48') }
for (const p of Object.values(runs)) p.catch(() => undefined)

const sound = async (p: (typeof runs)['thick43']): Promise<void> => {
  const { result, sceneText } = await p
  expect(result.verification.replay).toBe('BYTE_IDENTICAL')
  expect(verifyReplay(result.candidate).ok).toBe(true)
  expect(sha256(serializeModel(result.model))).toBe(result.modelSha256)
  expect(loadBundle(sceneText).ok).toBe(true)
}

describe('N7-COUNCIL-FIX-02 (B-1): the exterior wall from the outer faces', () => {
  it('a 0.43 m house with more partition than facade is built with its outer wall, not a partition’s', async () => {
    const { result, reconstruction } = await runs.thick43
    const house = reconstruction.wallThickness.house
    expect(house?.source).toBe('EXTERIOR_FACE_BANDS')
    // drawn 0.43 m plus the outline's own ink; the old all-band median read 0.24 m here
    expect(house?.m).toBeGreaterThan(0.41)
    expect(house?.m).toBeLessThan(0.47)
    expect(reconstruction.building.wallThicknessM).toBe(reconstruction.wallThickness.houseM)
    for (const w of result.model.walls.filter((x) => x.kind === 'EXTERIOR' && x.id.startsWith('ring-') && !x.id.includes('-party-'))) expect(w.thickness).toBeCloseTo(house?.m as number, 6)
    // N8-02B: where the decomposition cut the house into bodies along a 0.20 m partition, the one wall between them is
    // built at the band's drawn thickness, never at two exterior walls'
    for (const w of result.model.walls.filter((x) => x.id.includes('-party-'))) expect(w.thickness).toBeLessThan(0.3)
    expect(result.preview.outcome).toBe('COMPLETE')
    await sound(runs.thick43)
  })
})

describe('N7-COUNCIL-FIX-02 (B-1/B-2): a body with walls of its own', () => {
  it('a 1.05 m store drawn with 0.25 m walls is built with them, the house with its own, no WALLS_OVERLAP', async () => {
    const { result, reconstruction } = await runs.store25
    const store = reconstruction.building.masses.find((m) => m.role === 'ATTACHED')
    expect(store?.wallThicknessM).toBeGreaterThan(0.23)
    expect(store?.wallThicknessM).toBeLessThan(0.29)
    expect(reconstruction.wallThickness.bodies.map((b) => [b.massId, b.applied])).toEqual([[store?.id, true]])
    expect(reconstruction.wallThickness.house?.m).toBeGreaterThan(0.42)
    const ring = result.model.walls.filter((w) => w.id.startsWith(`ring-${store?.id}-0-`))
    expect(ring).toHaveLength(4)
    for (const w of ring) expect(w.thickness).toBeCloseTo(store?.wallThicknessM as number, 6)
    expect(result.preview.outcome).toBe('COMPLETE')
    expect(reconstruction.preEmitRings).toEqual([])
    await sound(runs.store25)
  })
})

describe('N7-COUNCIL-FIX-02: the OWNER-shaped refusal still gives a partial preview and its reason', () => {
  it('a body about as wide as its walls, its printed width against its drawn one: SOURCE_CONFLICT, named before emission, the house kept', async () => {
    const { result, reconstruction } = await runs.sliver48
    expect(result.preview.outcome).toBe('PARTIAL_3D_PREVIEW')
    expect(reconstruction.thinBodies.map((t) => [t.massId, t.decision.kind, t.firstBad.split(':')[0]])).toEqual([['attached-0', 'KEEP_PARTIAL', 'SOURCE_CONFLICT']])
    expect(reconstruction.preEmitRings.map((c) => [c.massId, c.kind, c.verdict])).toEqual([['attached-0', 'BODY', 'SOURCE_CONFLICT']])
    const [c] = result.preview.partial?.ringCollisions ?? []
    expect(c).toMatchObject({ ringId: 'ring-attached-0-0', kind: 'OWN_WALLS', walls: ['ring-attached-0-0-w1', 'ring-attached-0-0-w3'], preEmit: { kind: 'BODY', verdict: 'SOURCE_CONFLICT' }, removedByPartialPreview: true })
    expect(result.model.wallRings.map((r) => r.id).sort()).toEqual(['ring-main-0', 'ring-main-1'])
    await sound(runs.sliver48)
  })
})
