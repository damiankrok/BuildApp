/**
 * N7-FIX-04, end to end through the production service: a garage set back from the house's front is built to its own
 * face, not to the house's (set-backs of 0.15 to 0.60 m, and none), its gate kept and no wall doubled; a layout whose
 * own gate holds an unresolved BLOCKING reason is not called complete. Every fixture is invented (`synthetic-drawings`,
 * HOLLOWAY: an 8.40 × 10.20 m two-storey house, a 3.60 × 6.00 m garage); a reconstruction of nothing.
 */
import { describe, expect, it } from 'vitest'
import { memoryByteCache } from '@buildapp/source-package'
import { HOLLOWAY, syntheticPublisher } from '@buildapp/synthetic-drawings'
import type { SyntheticHouse, SyntheticOpening } from '@buildapp/synthetic-drawings'
import { loadBundle, sha256 } from '@buildapp/mobile-scene'
import { serializeModel } from '@buildapp/model'
import { verifyReplay } from '@buildapp/reconstruction'
import { runAnalysis } from '../src/index.js'

const gate: SyntheticOpening = { side: 'FRONT', kind: 'DOOR', at: 0.6, width: 2.4, height: 2.1, sill: 0, storey: 0 }
/** The garage's front `s` metres behind the house's, its chain printing the set-back. */
const setback = (s: number): SyntheticHouse => ({
  ...HOLLOWAY,
  name: `Setback ${s}`,
  ...(s > 0 ? { chainsZ: [Number((4.2 - s).toFixed(2)), 6.0, s] } : {}),
  wings: [{ name: 'garage', width: 3.6, depth: 6.0, offsetZ: Number((4.2 - s).toFixed(2)), storeys: 1, roof: 'FLAT', openings: [gate] }],
})
const SETBACKS = [0, 0.15, 0.3, 0.4, 0.45, 0.6]
const CASES: Record<string, SyntheticHouse> = {
  ...Object.fromEntries(SETBACKS.map((s) => [`s${Math.round(s * 100)}`, setback(s)])),
  // the 5 m gate garage built 0.05 m wider than FIX-03's: the silhouette check holds its step BLOCKING
  blocking: { ...HOLLOWAY, name: 'Blocking', chainsX: [8.4, 0.55, 5.0, 0.5], wings: [{ name: 'garage', width: 6.05, depth: 6.0, offsetZ: 4.2, storeys: 1, roof: 'FLAT', openings: [{ ...gate, at: 0.55, width: 5.0 }] }] },
}

const publisher = syntheticPublisher({ projects: Object.entries(CASES).map(([code, house]) => ({ code, title: house.name, house })) })
const run = (code: string) => runAnalysis({ kind: 'URL', url: publisher.pageUrl(code) }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })
const runs = Object.fromEntries(Object.keys(CASES).map((c) => [c, run(c)])) as Record<string, ReturnType<typeof run>>
for (const p of Object.values(runs)) p.catch(() => undefined)

type Out = Awaited<ReturnType<typeof run>>
const sound = ({ result, sceneText }: Out): void => {
  expect(result.verification.replay).toBe('BYTE_IDENTICAL')
  expect(verifyReplay(result.candidate).ok).toBe(true)
  expect(sha256(serializeModel(result.model))).toBe(result.modelSha256)
  expect(loadBundle(sceneText).ok).toBe(true)
}
/** Within the reading's own error: a few centimetres on a 0.026 m/px sheet. */
const READING_M = 0.05

describe('N7-FIX-04 (A): a set-back garage is built to its own face', () => {
  for (const s of SETBACKS) {
    it(`set back ${s.toFixed(2)} m: the house 8.40 × 10.20, the garage 3.60 × 6.00 from ${s.toFixed(2)} m behind its front, the gate on its own front`, async () => {
      const o = await runs[`s${Math.round(s * 100)}`]
      const { building } = o.reconstruction
      const main = building.masses.find((m) => m.id === 'main')
      const garage = building.masses.find((m) => m.role === 'ATTACHED')
      expect(main?.z1 ?? 0).toBeCloseTo(10.2, 2)
      expect(main?.z0 ?? 1).toBeCloseTo(0, 2)
      expect(garage).toBeDefined()
      if (!garage) return
      expect(Math.abs(garage.x1 - garage.x0 - 3.6)).toBeLessThan(READING_M)
      expect(Math.abs(garage.z1 - garage.z0 - 6.0)).toBeLessThan(READING_M)
      // the v2 frame's front is z = 0: the garage's front stands the set-back behind it
      expect(Math.abs(garage.z0 - s)).toBeLessThan(READING_M)
      // the gate in the garage's own front wall, and no wall of the garage on the house's front line
      const front = o.result.model.walls.find((w) => w.id === 'ring-attached-0-0-w0')
      expect(front && Math.abs(front.start.z - garage.z0)).toBeLessThan(1e-6)
      const gates = o.result.model.openings.filter((op) => op.wallId === 'ring-attached-0-0-w0')
      expect(gates).toHaveLength(1)
      expect(Math.abs(gates[0].width - 2.4)).toBeLessThan(0.1)
      expect(o.result.preview.outcome).toBe('COMPLETE')
      expect(o.reconstruction.preEmitRings.filter((c) => c.ringWouldOverlap)).toEqual([])
      sound(o)
    })
  }
})

describe('N7-FIX-04 (B/C): a chosen layout holding a BLOCKING reason is not complete', () => {
  it('the silhouette check holds the step BLOCKING: the model is built and kept, and the preview says partial, with the reason', async () => {
    const o = await runs.blocking
    expect(o.reconstruction.layout.gate.status).toBe('STRUCTURAL_LAYOUT_REJECTED')
    expect(o.result.preview.outcome).toBe('PARTIAL_3D_PREVIEW')
    expect(o.result.preview.partial?.layoutBlocking?.map((b) => b.code)).toEqual(['STRUCTURE_SILHOUETTE_DISAGREES'])
    expect(o.result.preview.partial?.failure.codes).toContain('LAYOUT_BLOCKING_UNRESOLVED')
    // nothing of the model is taken away: both bodies' rings stand (N8-02B: a body sharing the one wall the plan draws
    // with the other is built wall by wall, its walls tagged as its envelope)
    const bodies = new Set([...o.result.model.wallRings.map((r) => r.id), ...o.result.model.walls.filter((w) => w.tags?.includes('body-envelope')).map((w) => /^(ring-.+?-\d+)-w\d/.exec(w.id)?.[1] ?? '')])
    expect([...bodies].sort()).toEqual(['ring-attached-0-0', 'ring-main-0', 'ring-main-1'])
    expect(o.result.preview.partial?.missing).toEqual([])
    expect(o.result.preview.completeness?.verdict).toBe('PARTIAL')
    expect(o.result.preview.completeness?.conflicts.blocking.map((b) => b.code)).toEqual(['STRUCTURE_SILHOUETTE_DISAGREES'])
    sound(o)
  })

  it('a run with nothing unresolved says COMPLETE, and that its coverage is of its own accepted reading', async () => {
    const o = await runs.s0
    const c = o.result.preview.completeness
    expect(c?.verdict).toBe('COMPLETE')
    expect(c?.decomposition.basis).toBe('ACCEPTED_DECOMPOSITION')
    expect(c?.unexplainedWalls.count).toBe(0)
  })
})
