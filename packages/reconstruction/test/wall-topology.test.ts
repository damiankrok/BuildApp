/**
 * The wall topology planner, on synthetic cases (BUILDPLAN-INTEGRATION-004A §19).
 *
 * Each case is a handful of partition runs, in metres, against the four
 * exterior walls of one 10 × 8 body, and the assertions are on what the
 * planner decided and on the one property the model demands of the result:
 * no two emitted walls share plan area. The last cases hand the planned runs
 * to the real Building DSL, command by command, because the DSL validates
 * incrementally and a prefix that fails is a failure whatever the whole says.
 */
import { applyCommand } from '@buildapp/commands'
import type { BuildingCommand } from '@buildapp/commands'
import { createEmptyModel } from '@buildapp/model'
import { describe, expect, it } from 'vitest'
import { planWallTopology, residualOverlaps } from '../src/v2/wall-topology.js'
import type { HostBand, PlannedRun } from '../src/v2/wall-topology.js'

const T = 0.3
/** A 10 × 8 body: front z=0, east x=10, rear z=8, west x=0; material inside. */
const HOSTS: HostBand[] = [
  { id: 'ring-w0', axis: 'X', at: T / 2, thicknessM: T, from: 0, to: 10 },
  { id: 'ring-w1', axis: 'Z', at: 10 - T / 2, thicknessM: T, from: 0, to: 8 },
  { id: 'ring-w2', axis: 'X', at: 8 - T / 2, thicknessM: T, from: 0, to: 10 },
  { id: 'ring-w3', axis: 'Z', at: T / 2, thicknessM: T, from: 0, to: 8 },
]

const run = (id: string, axis: 'X' | 'Z', at: number, from: number, to: number, thicknessM = 0.12, doors: PlannedRun['doors'] = []): PlannedRun => ({ id, axis, at, from, to, thicknessM, pieces: [id], doors, featureId: id })

const kinds = (plan: ReturnType<typeof planWallTopology>): string[] => plan.decisions.map((d) => `${d.kind}:${d.runId}${d.otherId ? `→${d.otherId}` : ''}`)

describe('the planner leaves no two walls sharing plan area', () => {
  it('clean L corner: the Z wall arrives at the X wall’s face and the X wall owns the corner block, as the exterior rings do', () => {
    const plan = planWallTopology([run('x', 'X', 4, 0.3, 6.06), run('z', 'Z', 6, 4, 7.7)], HOSTS)
    expect(residualOverlaps(plan.runs, HOSTS)).toEqual([])
    expect(plan.runs.map((r) => r.id).sort()).toEqual(['x', 'z'])
    const x = plan.runs.find((r) => r.id === 'x')!
    const z = plan.runs.find((r) => r.id === 'z')!
    expect(x.to).toBe(6.06)
    expect(z.from).toBeCloseTo(4 + 0.06 + 0.015, 6)
    expect(kinds(plan)).toContain('TRIMMED_TO_PARTITION:z→x')
    expect(kinds(plan)).not.toContain('TRIMMED_TO_PARTITION:x→z')
  })

  it('T into an exterior wall: the end is pulled to the inner face, on the side the run lies', () => {
    const plan = planWallTopology([run('z', 'Z', 5, 0.1, 4)], HOSTS)
    const z = plan.runs[0]
    expect(z.from).toBeCloseTo(T + 0.015, 6)
    expect(z.to).toBe(4)
    expect(kinds(plan)).toEqual(['TRIMMED_TO_HOST:z→ring-w0'])
    expect(residualOverlaps(plan.runs, HOSTS)).toEqual([])
  })

  it('T into an interior wall: the arriving run stops at the host partition’s face; the host is untouched', () => {
    const host = run('x', 'X', 4, 0.5, 9.5, 0.15)
    const plan = planWallTopology([host, run('z', 'Z', 5, 4.05, 7.5)], HOSTS)
    const z = plan.runs.find((r) => r.id === 'z')!
    expect(z.from).toBeCloseTo(4 + 0.075 + 0.015, 6)
    expect(plan.runs.find((r) => r.id === 'x')).toMatchObject({ from: 0.5, to: 9.5 })
    expect(residualOverlaps(plan.runs, HOSTS)).toEqual([])
  })

  it('cross: the thinner run is split into two, one each side, and the thicker runs through', () => {
    const plan = planWallTopology([run('x', 'X', 4, 0.5, 9.5, 0.2), run('z', 'Z', 5, 0.5, 7.5, 0.12)], HOSTS)
    expect(plan.runs.map((r) => r.id).sort()).toEqual(['x', 'z-a', 'z-b'])
    const a = plan.runs.find((r) => r.id === 'z-a')!
    const b = plan.runs.find((r) => r.id === 'z-b')!
    expect(a.to).toBeCloseTo(4 - 0.1 - 0.015, 6)
    expect(b.from).toBeCloseTo(4 + 0.1 + 0.015, 6)
    expect(kinds(plan)).toContain('SPLIT_AT_CROSSING:z→x')
    expect(residualOverlaps(plan.runs, HOSTS)).toEqual([])
  })

  it('cross of equals: the Z run yields, deterministically', () => {
    const plan = planWallTopology([run('x', 'X', 4, 0.5, 9.5), run('z', 'Z', 5, 0.5, 7.5)], HOSTS)
    expect(plan.runs.map((r) => r.id).sort()).toEqual(['x', 'z-a', 'z-b'])
    const again = planWallTopology([run('z', 'Z', 5, 0.5, 7.5), run('x', 'X', 4, 0.5, 9.5)], HOSTS)
    expect(again.runs.map((r) => r.id).sort()).toEqual(['x', 'z-a', 'z-b'])
  })

  it('a door on a crossing run travels with the piece it sits in; a door under the crossing is dropped and said', () => {
    const doors = [
      { id: 'd1', from: 1.5, to: 2.4, widthM: 0.9 },
      { id: 'd2', from: 5.5, to: 6.4, widthM: 0.9 },
      { id: 'd3', from: 3.6, to: 4.5, widthM: 0.9 },
    ]
    const plan = planWallTopology([run('x', 'X', 4, 0.5, 9.5, 0.2), run('z', 'Z', 5, 0.5, 7.5, 0.12, doors)], HOSTS)
    expect(plan.runs.find((r) => r.id === 'z-a')!.doors.map((d) => d.id)).toEqual(['d1'])
    expect(plan.runs.find((r) => r.id === 'z-b')!.doors.map((d) => d.id)).toEqual(['d2'])
    expect(plan.decisions.find((d) => d.kind === 'DOOR_DROPPED')?.otherId).toBe('d3')
  })

  it('duplicate observation: two readings of one wall become one, with the longer’s identity', () => {
    const plan = planWallTopology([run('a', 'X', 4.0, 0.5, 6.0), run('b', 'X', 4.03, 2.0, 9.0)], HOSTS)
    expect(plan.runs).toHaveLength(1)
    expect(plan.runs[0].id).toBe('b')
    expect(plan.runs[0].pieces.sort()).toEqual(['a', 'b'])
    expect(plan.runs[0]).toMatchObject({ from: 0.5, to: 9.0 })
    expect(plan.runs[0].at).toBeGreaterThan(4.0)
    expect(plan.runs[0].at).toBeLessThan(4.03)
    expect(kinds(plan)).toContain('FUSED_DUPLICATE:b→a')
  })

  it('partial collinear overlap: overlapping stretches fuse into one run over the union', () => {
    const plan = planWallTopology([run('a', 'X', 4.0, 0.5, 5.0), run('b', 'X', 4.0, 4.5, 9.5)], HOSTS)
    expect(plan.runs).toHaveLength(1)
    expect(plan.runs[0]).toMatchObject({ from: 0.5, to: 9.5 })
    expect(residualOverlaps(plan.runs, HOSTS)).toEqual([])
  })

  it('near-collinear noise against an exterior wall: a run grazing the wall by less than half its thickness is snapped clear', () => {
    // the Kosaćce case: a 0.168 m partition 8 mm inside the east wall's band
    const plan = planWallTopology([run('stub', 'Z', 10 - T - 0.084 + 0.008, 7.0, 7.6, 0.168)], HOSTS)
    expect(kinds(plan)).toContain('SNAPPED_OFF_HOST:stub→ring-w1')
    const d = plan.decisions.find((x) => x.kind === 'SNAPPED_OFF_HOST')!
    expect(d.measuredM).toBeCloseTo(0.008, 3)
    expect(plan.runs).toHaveLength(1)
    expect(plan.runs[0].at + 0.084).toBeLessThan(10 - T)
    expect(residualOverlaps(plan.runs, HOSTS)).toEqual([])
  })

  it('a run mostly inside an exterior wall is the exterior wall seen from inside, and is dropped as such', () => {
    const plan = planWallTopology([run('inside', 'Z', 10 - T / 2 + 0.02, 2, 5, 0.15)], HOSTS)
    expect(plan.runs).toEqual([])
    expect(kinds(plan)).toEqual(['DROPPED_INSIDE_HOST:inside→ring-w1'])
    expect(plan.dropped).toEqual([{ pieceId: 'inside', why: expect.stringMatching(/inside the exterior wall ring-w1/) }])
  })

  it('genuinely separate nearby walls stay separate', () => {
    const plan = planWallTopology([run('a', 'X', 4.0, 0.5, 9.5), run('b', 'X', 4.4, 0.5, 9.5)], HOSTS)
    expect(plan.runs.map((r) => r.id).sort()).toEqual(['a', 'b'])
    expect(plan.decisions.filter((d) => d.kind === 'FUSED_DUPLICATE')).toEqual([])
    expect(residualOverlaps(plan.runs, HOSTS)).toEqual([])
  })

  it('a run that is too short once trimmed is dropped, and its pieces are named', () => {
    const plan = planWallTopology([run('x', 'X', 4, 0.5, 9.5, 0.2), run('stub', 'Z', 5, 3.85, 4.2)], HOSTS)
    expect(plan.runs.map((r) => r.id)).toEqual(['x'])
    expect(plan.dropped.map((d) => d.pieceId)).toEqual(['stub'])
  })

  it('what cannot be resolved is left out and named, never emitted', () => {
    // a partition whose middle lies inside the front exterior wall's band, perpendicular to it:
    // not a graze, not an end, not a crossing — no rule explains it, so it is left out and named.
    const plan = planWallTopology([run('a', 'X', 4, 3, 6), run('b', 'Z', 5, -0.2, 0.4, 0.15)], HOSTS)
    expect(plan.runs.map((r) => r.id)).toEqual(['a'])
    expect(plan.unresolved).toHaveLength(1)
    expect(plan.unresolved[0]).toMatchObject({ runId: 'b', otherId: 'ring-w0' })
    expect(residualOverlaps(plan.runs, HOSTS)).toEqual([])
  })

  it('is deterministic: the same runs in any order plan the same', () => {
    const a = [run('x', 'X', 4, 0.5, 9.5, 0.2), run('z', 'Z', 5, 0.5, 7.5), run('d', 'X', 4.02, 2, 5), run('s', 'Z', 10 - T - 0.084 + 0.008, 7.0, 7.6, 0.168)]
    const p1 = planWallTopology(a, HOSTS)
    const p2 = planWallTopology([...a].reverse(), [...HOSTS].reverse())
    expect(JSON.stringify(p1.runs)).toBe(JSON.stringify(p2.runs))
    expect(p1.decisions.map((d) => d.kind).sort()).toEqual(p2.decisions.map((d) => d.kind).sort())
  })
})

// ---------------------------------------------------------------------------

/** The planned runs as Building DSL commands, the way the emitter states them. */
function program(runs: readonly PlannedRun[]): BuildingCommand[] {
  const out: BuildingCommand[] = [
    { type: 'createBuilding', id: 'bld', name: 'planner test' },
    { type: 'defineMaterial', id: 'mat-wall', name: 'wall', color: '#eeeeee' },
    { type: 'createLevel', id: 'lvl-0', name: 'Ground', index: 0, elevation: 0, height: 2.8 },
    { type: 'createWallRing', id: 'ring', levelId: 'lvl-0', polygon: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 8 }, { x: 0, z: 8 }], thickness: T, height: 2.8, baseOffset: 0, kind: 'EXTERIOR', cornerOwnership: 'ALTERNATE', materialId: 'mat-wall' },
  ]
  for (const r of runs) {
    const half = r.thicknessM / 2
    const start = r.axis === 'X' ? { x: r.from, z: r.at - half } : { x: r.at + half, z: r.from }
    const end = r.axis === 'X' ? { x: r.to, z: r.at - half } : { x: r.at + half, z: r.to }
    out.push({ type: 'createWall', id: r.id, levelId: 'lvl-0', start, end, thickness: r.thicknessM, height: 2.7, baseOffset: 0, kind: 'INTERIOR', materialId: 'mat-wall' })
  }
  return out
}

/** Apply a program command by command; the first refusal is returned with its index. */
function replayPrefixes(commands: readonly BuildingCommand[]): { ok: true } | { ok: false; at: number; codes: string[] } {
  let model = createEmptyModel('m-planner', 'planner test')
  for (let i = 0; i < commands.length; i++) {
    const result = applyCommand(model, commands[i])
    if (!result.ok) return { ok: false, at: i, codes: result.errors.map((e) => e.code) }
    model = result.model
  }
  return { ok: true }
}

describe('every emitted command prefix validates in the real DSL', () => {
  const HOST_RING: HostBand[] = HOSTS.map((h, i) => ({ ...h, id: `ring-w${i}` }))

  it('the whole matrix, planned, replays command by command without a refusal', () => {
    const raw = [
      run('x-main', 'X', 4, 0.1, 9.9, 0.2),
      run('z-cross', 'Z', 5, 0.1, 7.9, 0.12),
      run('z-t', 'Z', 2, 4.05, 7.9, 0.12),
      run('x-dup', 'X', 4.02, 6, 9.5, 0.2),
      run('x-l', 'X', 6, 0.1, 2.06, 0.12),
      run('stub', 'Z', 10 - T - 0.084 + 0.008, 6.0, 7.6, 0.168),
      run('near', 'X', 6.4, 0.1, 2.06, 0.12),
    ]
    const plan = planWallTopology(raw, HOST_RING)
    expect(residualOverlaps(plan.runs, HOST_RING)).toEqual([])
    expect(replayPrefixes(program(plan.runs))).toEqual({ ok: true })
  })

  it('the same raw runs, emitted unplanned, are refused by the model at the first overlap — the validator is not weakened', () => {
    const raw = [run('x-main', 'X', 4, 0.3, 9.7, 0.2), run('z-cross', 'Z', 5, 0.3, 7.7, 0.12)]
    const result = replayPrefixes(program(raw))
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.codes).toContain('WALLS_OVERLAP')
  })

  it('a genuinely invalid overlap that the planner cannot explain is left out, so what IS emitted still validates', () => {
    const raw = [run('a', 'X', 4, 3, 6), run('b', 'Z', 5, -0.2, 0.4, 0.15)]
    const plan = planWallTopology(raw, HOST_RING)
    expect(plan.unresolved).toHaveLength(1)
    expect(replayPrefixes(program(plan.runs))).toEqual({ ok: true })
    // and the model still refuses the pair itself
    const refused = replayPrefixes(program(raw))
    expect(refused.ok === false && refused.codes).toContain('WALLS_OVERLAP')
  })
})
