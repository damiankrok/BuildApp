/**
 * N7-FIX-01, end to end through the production service: a thin attached body whose far wall carries windows is still a
 * body with walls (Council F-R1), its frames sit in its own walls (D-3), a body the plan decomposition loses is named,
 * and a source that does not decide still leaves the partial preview (N7-P1) with the way back to the reading. Every
 * fixture is invented (`synthetic-drawings`): THINWALL's 0.50 m body with 0.15 m walls of its own.
 */
import { describe, expect, it } from 'vitest'
import { memoryByteCache } from '@buildapp/source-package'
import { SLIVERTON, THINWALL, syntheticPublisher } from '@buildapp/synthetic-drawings'
import type { SyntheticHouse, SyntheticOpening } from '@buildapp/synthetic-drawings'
import { loadBundle, sha256 } from '@buildapp/mobile-scene'
import { serializeModel } from '@buildapp/model'
import { verifyReplay } from '@buildapp/reconstruction'
import { runAnalysis } from '../src/index.js'

/** n windows in the body's far (east) wall, 1.0 m wide where they fit. */
const windows = (n: number): SyntheticOpening[] => Array.from({ length: n }, (_, k) => ({ side: 'RIGHT' as const, kind: 'WINDOW' as const, at: 0.4 + k * (5.2 / n), width: Math.min(1.0, 5.2 / n - 0.3), height: 1.2, sill: 0.9, storey: 0 }))
const withOpenings = (name: string, openings: SyntheticOpening[]): SyntheticHouse => ({ ...THINWALL, name, wings: [{ ...(THINWALL.wings ?? [])[0], openings }] })

const publisher = syntheticPublisher({
  projects: [
    { code: 'tw-w1', title: 'Thinwall 1', house: withOpenings('Thinwall 1', windows(1)) },
    { code: 'tw-w2', title: 'Thinwall 2', house: withOpenings('Thinwall 2', windows(2)) },
    { code: 'tw-w4', title: 'Thinwall 4', house: withOpenings('Thinwall 4', windows(4)) },
    { code: 'tw-wide', title: 'Thinwall wide', house: withOpenings('Thinwall wide', [{ side: 'RIGHT', kind: 'WINDOW', at: 0.6, width: 1.5, height: 1.2, sill: 0.9, storey: 0 }, { side: 'RIGHT', kind: 'WINDOW', at: 3.6, width: 1.5, height: 1.2, sill: 0.9, storey: 0 }]) },
    { code: 'tw-wd', title: 'Thinwall window door', house: withOpenings('Thinwall wd', [{ side: 'RIGHT', kind: 'WINDOW', at: 0.6, width: 1.0, height: 1.2, sill: 0.9, storey: 0 }, { side: 'RIGHT', kind: 'DOOR', at: 3.4, width: 1.0, height: 2.1, sill: 0, storey: 0 }]) },
    { code: 'sl-s', title: 'Sliverton', house: SLIVERTON },
  ],
})
const run = (code: string) => runAnalysis({ kind: 'URL', url: publisher.pageUrl(code) }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })
const runs = { w1: run('tw-w1'), w2: run('tw-w2'), w4: run('tw-w4'), wide: run('tw-wide'), wd: run('tw-wd'), sliverton: run('sl-s') }
for (const p of Object.values(runs)) p.catch(() => undefined)

/** The model replays byte for byte, its hash is its own, and the mobile scene bundle loads with meshes in it. */
const sound = async (p: (typeof runs)['w1']): Promise<void> => {
  const { result, sceneText } = await p
  expect(result.verification.replay).toBe('BYTE_IDENTICAL')
  expect(verifyReplay(result.candidate).ok).toBe(true)
  expect(sha256(serializeModel(result.model))).toBe(result.modelSha256)
  expect(loadBundle(sceneText).ok).toBe(true)
  expect(result.counts.meshes).toBeGreaterThan(0)
}
/** The thin body built whole: its ring at its own drawn thickness and `n` windows cut in its far wall. */
const builtWith = async (p: (typeof runs)['w1'], n: number): Promise<void> => {
  const { result, reconstruction } = await p
  expect(result.preview.outcome).toBe('COMPLETE')
  const [t] = reconstruction.thinBodies
  expect(t).toMatchObject({ massId: 'attached-0', decision: { kind: 'DRAWN_THIN_WALLS' } })
  expect(t.hypotheses.find((h) => h.kind === 'CANOPY_ON_POSTS')?.status).toBe('REFUTED')
  expect(result.model.wallRings.map((r) => r.id)).toContain('ring-attached-0-0')
  const ring = result.model.walls.filter((w) => w.id.startsWith('ring-attached-0-0-'))
  for (const w of ring) expect(w.thickness).toBeCloseTo(t.decision.wallThicknessM as number, 6)
  const cut = result.model.openings.filter((o) => o.wallId.startsWith('ring-attached-0-0-'))
  expect(cut).toHaveLength(n)
  const units = result.model.windows.filter((w) => cut.some((o) => o.id === w.openingId))
  expect(units).toHaveLength(n)
  expect(result.unresolved.filter((u) => /FILL_TOO_LARGE|ring-attached-0/.test(`${u.what} ${u.reason}`))).toEqual([])
  await sound(p)
}

describe('N7-FIX-01 (F-R1, D-3) a thin body with windows in its far wall', () => {
  it('one window: built whole, the window in its own 0.15 m wall', async () => builtWith(runs.w1, 1))
  it('two windows (the Council reproduction that reached WALLS_OVERLAP at command 21): built whole', async () => builtWith(runs.w2, 2))

  it('two 1.5 m windows: masonry under 60 % of the face — read along it, its gaps drawn as openings — built whole', async () => {
    const { reconstruction } = await runs.wide
    const fw = reconstruction.thinBodies[0]?.profile?.farWall
    expect(fw).toMatchObject({ holds: true })
    expect(fw?.pieceShare).toBeLessThan(0.6)
    expect(fw?.gaps.map((g) => g.drawnAcross >= 0.8)).toEqual([true, true])
    await builtWith(runs.wide, 2)
  })

  it('a window and a door: both cut and filled in the body’s own walls, no FILL_TOO_LARGE', async () => {
    const { result } = await runs.wd
    expect(result.preview.outcome).toBe('COMPLETE')
    const cut = result.model.openings.filter((o) => o.wallId.startsWith('ring-attached-0-0-'))
    expect(cut.map((o) => o.kind).sort()).toEqual(['DOOR', 'WINDOW'])
    const doors = result.model.doors.filter((d) => cut.some((o) => o.id === d.openingId))
    const wins = result.model.windows.filter((w) => cut.some((o) => o.id === w.openingId))
    expect(doors).toHaveLength(1)
    expect(wins).toHaveLength(1)
    await sound(runs.wd)
  })

  it('four windows: the body the plan decomposition loses is named, with its walls and the first bad step', async () => {
    const { result, reconstruction } = await runs.w4
    // the house stands; the body is not built — and not silently
    expect(result.model.wallRings.map((r) => r.id)).not.toContain('ring-attached-0-0')
    expect(reconstruction.zoneBodies).toHaveLength(1)
    const [z] = reconstruction.zoneBodies
    expect(z).toMatchObject({ side: 'EAST', storeyIndex: 0 })
    expect(z.depthM).toBeCloseTo(0.5, 1)
    expect(z.to - z.from).toBeGreaterThan(5)
    const named = result.unresolved.find((u) => u.what.startsWith('a body drawn in the 0.50 m zone on the east'))
    expect(named?.reason).toMatch(/FIRST_BAD: PLAN_DECOMPOSITION/)
    await sound(runs.w4)
  })
})

describe('N7-FIX-01 the partial preview stands where the source does not decide', () => {
  it('SLIVERTON (a printed width contradicting the drawing): the last valid model, and the collision traced to its reading', async () => {
    const { result } = await runs.sliverton
    expect(result.preview.outcome).toBe('PARTIAL_3D_PREVIEW')
    const partial = result.preview.partial
    expect(partial?.failure).toMatchObject({ commandIndex: 21, type: 'createWallRing', id: 'ring-attached-0-0', codes: ['WALLS_OVERLAP'] })
    // the main body's base is kept: its ring and slab are in the model
    expect(result.model.wallRings.map((r) => r.id)).toContain('ring-main-0')
    expect(result.model.wallRings.map((r) => r.id)).not.toContain('ring-attached-0-0')
    const [c] = partial?.ringCollisions ?? []
    expect(c).toMatchObject({ ringId: 'ring-attached-0-0', walls: ['ring-attached-0-0-w1', 'ring-attached-0-0-w3'], massId: 'attached-0', selectedByThinBodies: true, decision: { kind: 'KEEP_PARTIAL' }, removedByPartialPreview: true, reconciliation: { changedGeometry: false } })
    expect(c.firstBad).toMatch(/^SOURCE_CONFLICT/)
    expect(c.hypotheses.map((h) => h.kind)).toEqual(['WIDEN', 'SHARED_WALL', 'DRAWN_THIN_WALLS', 'SOLID_WALL', 'CANOPY_ON_POSTS', 'FALSE_STRIP', 'RECESS_OF_MAIN'])
    expect(c.widthM).toBeLessThan(2 * (c.wallThicknessM as number))
    expect(c.removedIds).toEqual(expect.arrayContaining(['ring-attached-0-0', 'slab-attached-0-0']))
    await sound(runs.sliverton)
  })
})
