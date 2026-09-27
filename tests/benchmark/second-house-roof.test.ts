/**
 * INTEGRATION-003B: the second house's garage roof, as evaluation.
 *
 * Dom w rarytasach 5 (G2E) has a double garage projecting in front of the
 * main body under a gable of its own — its gable end faces the street and its
 * ridge runs back into the main roof's front slope. Until this stage the
 * analyzer took every attached body's roof as flat by convention, and the two
 * identically labelled side elevations were registered mirrored, so the
 * views that show the garage's ridge were read over the main body's gable.
 *
 * The fix is generic (the attached roof's form is read on any registered
 * elevation that sees the body against the sky; unlabelled side views are
 * oriented by the main body's profile), and the production sources never
 * name this project (`tests/architecture/second-house.test.ts`). The numbers
 * below are the project's own and live here, in evaluation, only.
 *
 * It reads a completed run's directory, written by
 * `npm run analysis:second-house -- … --out <dir>`, from outside the
 * repository: `BUILDAPP_SECOND_HOUSE_DIR=<dir> npx vitest run tests/benchmark/second-house-roof.test.ts`.
 * Without it the suite is skipped — the publisher's drawings are not committed.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const DIR = process.env.BUILDAPP_SECOND_HOUSE_DIR
const ready = !!DIR && existsSync(join(DIR, 'model.json'))

type Vec2 = { x: number; z: number }
type Model = {
  roofs: Array<{ id: string; kind: string; pitchDeg: number; ridgeAxis?: string; overhang: number; footprint: { minX: number; maxX: number; minZ: number; maxZ: number }; eaveOffset: number }>
  roofPlanes: Array<{ id: string; boundary: Vec2[]; pitchDeg: number; downslope: Vec2; datum: { x: number; y: number; z: number } }>
  roofEdges: Array<{ id: string; kind: string; planeIds: string[]; start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number } }>
  relationships: Array<{ kind: string; from: string; to: string }>
  slabs: Array<{ id: string; polygon: Vec2[] }>
}

describe.skipIf(!ready)('the second house: a gabled garage, not a flat one', () => {
  const model = (): Model => JSON.parse(readFileSync(join(DIR as string, 'model.json'), 'utf8')) as Model
  const trace = (): { entries: Array<{ substage?: string; status: string; counts?: Record<string, number> }> } => JSON.parse(readFileSync(join(DIR as string, 'analysis-trace.json'), 'utf8'))

  it('keeps the main roof a 30° gable along the width, without eaves, as the published description states', () => {
    const m = model()
    expect(m.roofs.map((r) => [r.id, r.kind])).toEqual([['roof-main', 'GABLE']])
    const main = m.roofs[0]
    expect(main.ridgeAxis).toBe('X')
    expect(main.pitchDeg).toBe(30)
    expect(main.overhang).toBe(0)
  })

  it('keeps the footprint the plan draws: a 17.21 × 8.48 m main body and a 6.17 × 6.21 m garage in front of it', () => {
    const m = model()
    const box = (id: string) => {
      const s = m.slabs.find((x) => x.id === id)
      const xs = s?.polygon.map((p) => p.x) ?? []
      const zs = s?.polygon.map((p) => p.z) ?? []
      return { w: Math.max(...xs) - Math.min(...xs), d: Math.max(...zs) - Math.min(...zs), z0: Math.min(...zs), z1: Math.max(...zs) }
    }
    const main = box('slab-main-0')
    const garage = box('slab-attached-0-0')
    expect(Math.abs(main.w - 17.21)).toBeLessThan(0.05)
    expect(Math.abs(main.d - 8.48)).toBeLessThan(0.05)
    expect(Math.abs(garage.w - 6.17)).toBeLessThan(0.05)
    expect(Math.abs(garage.d - 6.21)).toBeLessThan(0.05)
    expect(Math.abs(garage.z1 - main.z0)).toBeLessThan(0.02)
  })

  it('roofs the garage with two 30° planes whose ridge runs from the front gable back into the main slope', () => {
    const m = model()
    expect(m.roofs.some((r) => r.kind === 'FLAT')).toBe(false)
    const planes = m.roofPlanes.filter((p) => p.id.startsWith('roof-attached-0-'))
    expect(planes).toHaveLength(2)
    for (const p of planes) expect(p.pitchDeg).toBe(30)
    expect(planes.map((p) => p.downslope.x).sort()).toEqual([-1, 1])
    const ridge = m.roofEdges.find((e) => e.kind === 'RIDGE' && e.planeIds.every((id) => id.startsWith('roof-attached-0-')))
    expect(ridge).toBeDefined()
    if (!ridge) return
    // Along z, level, from the front gable end at z = 0 to past the party line into the main slope.
    expect(ridge.start.x).toBeCloseTo(ridge.end.x, 6)
    expect(ridge.start.y).toBeCloseTo(ridge.end.y, 3)
    expect(Math.min(ridge.start.z, ridge.end.z)).toBeCloseTo(0, 6)
    const main = m.roofs[0]
    expect(Math.max(ridge.start.z, ridge.end.z)).toBeGreaterThan(main.footprint.minZ + 1)
    // Lower than the main ridge, and meeting the main slope exactly where it ends.
    const mainTop = (z: number): number => main.eaveOffset + (z - main.footprint.minZ) * Math.tan((30 * Math.PI) / 180)
    expect(ridge.end.y).toBeCloseTo(mainTop(Math.max(ridge.start.z, ridge.end.z)), 3)
    // The garage's gable end faces the street: two verges at z = 0, and the valleys are declared against the main roof.
    expect(m.roofEdges.filter((e) => e.kind === 'VERGE' && e.planeIds[0].startsWith('roof-attached-0-') && Math.abs(e.start.z) < 1e-6 && Math.abs(e.end.z) < 1e-6)).toHaveLength(2)
    expect(m.relationships.filter((r) => r.kind === 'INTERSECTS' && r.to === 'roof-main' && r.from.startsWith('roof-attached-0-'))).toHaveLength(2)
  })

  it('closes the exterior: no exterior closure error', () => {
    const closure = trace().entries.find((e) => e.substage === 'CLOSURE')
    expect(closure?.status).toBe('PASSED')
    expect(closure?.counts?.exteriorErrors).toBe(0)
  })
})
