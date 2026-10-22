/**
 * N7-P2R, end to end through the production service: an attached body read narrower than its own two walls is
 * adjudicated on the source before the partial preview is the answer. Every fixture is invented (`synthetic-drawings`).
 *
 *   - THINWALL draws its narrow body with walls of its own, 0.15 m: the ring is built at the drawn thickness, whole.
 *   - SLIVERTON_DIMENSIONED draws one wall between the bodies (the house's): the body is built with three walls.
 *   - SLIVERTON prints a dimension that contradicts its drawing: the source conflicts, the partial preview stands.
 */
import { describe, expect, it } from 'vitest'
import { memoryByteCache } from '@buildapp/source-package'
import { SLIVERTON, SLIVERTON_DIMENSIONED, THINWALL, syntheticPublisher } from '@buildapp/synthetic-drawings'
import { loadBundle, sha256 } from '@buildapp/mobile-scene'
import { serializeModel } from '@buildapp/model'
import { verifyReplay } from '@buildapp/reconstruction'
import { runAnalysis } from '../src/index.js'

const publisher = syntheticPublisher({
  projects: [
    { code: 'thinwall-t01', title: 'Thinwall', house: THINWALL },
    { code: 'sliverton-d01', title: 'Sliverton dimensioned', house: SLIVERTON_DIMENSIONED },
    { code: 'sliverton-s02', title: 'Sliverton', house: SLIVERTON },
  ],
})
const run = (code: string) => runAnalysis({ kind: 'URL', url: publisher.pageUrl(code) }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })
const thinwall = run('thinwall-t01')
const dimensioned = run('sliverton-d01')
const conflicting = run('sliverton-s02')
for (const p of [thinwall, dimensioned, conflicting]) p.catch(() => undefined)

const sound = async (p: typeof thinwall): Promise<void> => {
  const { result, sceneText } = await p
  expect(result.verification.replay).toBe('BYTE_IDENTICAL')
  expect(verifyReplay(result.candidate).ok).toBe(true)
  expect(sha256(serializeModel(result.model))).toBe(result.modelSha256)
  const back = loadBundle(sceneText)
  expect(back.ok).toBe(true)
  expect(result.counts.meshes).toBeGreaterThan(0)
}

describe('N7-P2R a thin attached body the source decides', () => {
  it('drawn with thinner walls of its own: the ring at the drawn thickness, the house whole', async () => {
    const { result, reconstruction } = await thinwall
    expect(result.preview.outcome).toBe('COMPLETE')
    const [t] = reconstruction.thinBodies
    expect(t).toMatchObject({ massId: 'attached-0', narrowAxis: 'X', decision: { kind: 'DRAWN_THIN_WALLS' } })
    expect(t.decision.wallThicknessM).toBeGreaterThan(0.1)
    expect(t.decision.wallThicknessM).toBeLessThan(0.25)
    const ring = result.model.walls.filter((w) => w.id.startsWith('ring-attached-0-0-'))
    expect(ring).toHaveLength(4)
    for (const w of ring) expect(w.thickness).toBeCloseTo(t.decision.wallThicknessM as number, 6)
    expect(result.model.wallRings.map((r) => r.id)).toContain('ring-attached-0-0')
    await sound(thinwall)
  })

  it('one wall between the bodies: built with its three own walls and no ring, nothing overlapping', async () => {
    const { result, reconstruction } = await dimensioned
    expect(result.preview.outcome).toBe('COMPLETE')
    const [t] = reconstruction.thinBodies
    expect(t).toMatchObject({ massId: 'attached-0', shared: { facade: 'WEST', withMassId: 'main' }, decision: { kind: 'SHARED_WALL', openSide: 'WEST' } })
    expect(t.firstBad).toMatch(/^EMISSION/)
    expect(result.model.wallRings.map((r) => r.id)).toEqual(['ring-main-0', 'ring-main-1'])
    expect(result.model.walls.filter((w) => w.id.startsWith('ring-attached-0-0-')).map((w) => w.id).sort()).toEqual(['ring-attached-0-0-w0', 'ring-attached-0-0-w1', 'ring-attached-0-0-w2'])
    expect(result.model.slabs.some((s) => s.id === 'slab-attached-0-0')).toBe(true)
    await sound(dimensioned)
  })
})

describe('N7-P2R a thin attached body the source does not decide', () => {
  it('a printed dimension contradicting the drawing: every reading recorded, the partial preview of N7-P1 kept', async () => {
    const { result, reconstruction } = await conflicting
    expect(result.preview.outcome).toBe('PARTIAL_3D_PREVIEW')
    expect(result.preview.partial?.failure).toMatchObject({ commandIndex: 21, id: 'ring-attached-0-0', codes: ['WALLS_OVERLAP'] })
    const [t] = reconstruction.thinBodies
    expect(t.decision.kind).toBe('KEEP_PARTIAL')
    expect(t.firstBad).toMatch(/^SOURCE_CONFLICT/)
    expect(t.chains.some((c) => c.role === 'CONFLICTS')).toBe(true)
    expect(t.hypotheses.map((h) => h.kind).sort()).toEqual(['CANOPY_ON_POSTS', 'DRAWN_THIN_WALLS', 'FALSE_STRIP', 'RECESS_OF_MAIN', 'SHARED_WALL', 'SOLID_WALL', 'WIDEN'])
    // what the model would have refused is predicted from the reading: the same overlap the model reports
    const reported = Number(/share ([0-9.]+) m²/.exec(result.preview.partial?.failure.message ?? '')?.[1])
    expect(t.predictedOverlapM2).toBeCloseTo(reported, 3)
    expect(result.unresolved.some((u) => u.what.startsWith('the body attached-0') && u.status === 'AMBIGUOUS')).toBe(true)
  })
})
