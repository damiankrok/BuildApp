/**
 * 005Y-N7 (A): walls the model refuses as overlapping, reconciled within the plan's uncertainty — or named.
 *
 * The validator stays strict (`WALL_OVERLAP_AREA_LIMIT`); every model here passes it. What is tested is the reading:
 * a partition drawn into the band it stops against is trimmed to that face, a body measured a line weight into its
 * neighbour moves onto its face, the same band read twice is built once — and a wall that truly crosses another is
 * left out (a partition) or refused with the pair named (an exterior wall), never moved further than the reading allows.
 */
import { describe, expect, it } from 'vitest'
import { applyCommands } from '@buildapp/commands'
import type { BuildingCommand } from '@buildapp/commands'
import { createEmptyModel } from '@buildapp/model'
import { fitOpeningsToHosts, reconcileWallOverlaps } from '../src/candidate.js'
import { classifyWallConflict, proposeWallRepair, reconcileToleranceM } from '../src/v2/wall-reconciliation.js'
import type { WallLine } from '../src/v2/wall-reconciliation.js'
import { modeOf, planReconcileTolerance, refusalDiagnostics } from '../src/v2/wall-reconciliation-report.js'

/** A 3 px reading on a 0.02 m/px plan. */
const TOL = reconcileToleranceM(0.02)

/** A 10 × 8 m ring, 0.4 m walls; w0 runs along x at z = 0 with its material at z 0..0.4, w2 along z = 8 (7.6..8). */
const shell = (): BuildingCommand[] =>
  [
    { type: 'createBuilding', id: 'b', name: 'fixture' },
    { type: 'createLevel', id: 'l0', name: 'Ground', index: 0, elevation: 0, height: 2.8 },
    { type: 'createWallRing', id: 'ring', levelId: 'l0', polygon: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 8 }, { x: 0, z: 8 }], thickness: 0.4, height: 2.8, baseOffset: 0, kind: 'EXTERIOR', cornerOwnership: 'ALTERNATE' },
  ] as BuildingCommand[]

const partition = (id: string, start: { x: number; z: number }, end: { x: number; z: number }, kind: 'INTERIOR' | 'EXTERIOR' = 'INTERIOR', levelId = 'l0'): BuildingCommand =>
  ({ type: 'createWall', id, levelId, start, end, thickness: 0.12, height: 2.8, baseOffset: 0, kind }) as BuildingCommand

const door = (id: string, wallId: string, offset: number): BuildingCommand[] =>
  [
    { type: 'cutOpening', id, wallId, kind: 'DOOR', offset, sill: 0, width: 0.9, height: 2.0 },
    { type: 'placeDoor', id: `${id}-door`, openingId: id, frameDepth: 0.08, frameInset: 0.02 },
  ] as BuildingCommand[]

const attached = (z0: number): BuildingCommand =>
  ({ type: 'createWallRing', id: 'garage', levelId: 'l0', polygon: [{ x: 2, z: z0 }, { x: 8, z: z0 }, { x: 8, z: 12 }, { x: 2, z: 12 }], thickness: 0.4, height: 2.8, baseOffset: 0, kind: 'EXTERIOR', cornerOwnership: 'ALTERNATE' }) as BuildingCommand

const valid = (program: BuildingCommand[]): boolean => applyCommands(createEmptyModel('m', 'm'), program).failedAt === undefined
const run = (program: BuildingCommand[]) => reconcileWallOverlaps(program, 'fixture', 'm-fixture', { toleranceM: TOL })
const line = (id: string, sx: number, sz: number, ex: number, ez: number, thickness: number, kind: 'INTERIOR' | 'EXTERIOR' = 'INTERIOR'): WallLine => ({ id, start: { x: sx, z: sz }, end: { x: ex, z: ez }, thickness, kind })
const front = line('w0', 0, 0, 10, 0, 0.4, 'EXTERIOR')

describe('the overlap, read as what it is (pure geometry)', () => {
  it('the tolerance is three plan pixels', () => {
    expect(TOL).toBe(0.06)
  })

  it('a partition starting inside the band it meets: its start goes to the near face', () => {
    const p = line('p', 5, 0.3, 5, 4, 0.12)
    const c = classifyWallConflict(p, front, TOL)
    expect(c.relation).toBe('END_INTO_BAND')
    expect(c.end).toBe('START')
    expect(c.trimM).toBeCloseTo(0.1, 6)
    const r = proposeWallRepair(p, front, c, TOL)
    expect(r.action).toBe('TRIMMED_TO_FACE')
    if ('wall' in r) expect(r.wall.start).toEqual({ x: 5, z: 0.4 })
  })

  it('a partition drawn 2 cm through the outer face (a line weight) is trimmed; one that runs a metre past is not', () => {
    const over = line('p', 5, -0.02, 5, 4, 0.12)
    const c = classifyWallConflict(over, front, TOL)
    expect(c).toMatchObject({ relation: 'END_INTO_BAND', end: 'START' })
    expect(c.throughM).toBeCloseTo(0.02, 6)
    expect(proposeWallRepair(over, front, c, TOL).action).toBe('TRIMMED_TO_FACE')
    const through = line('p', 5, -1, 5, 4, 0.12)
    const x = classifyWallConflict(through, front, TOL)
    expect(x.relation).toBe('CROSSING')
    expect(proposeWallRepair(through, front, x, TOL).action).toBe('OMITTED')
    expect(proposeWallRepair({ ...through, kind: 'EXTERIOR' }, front, x, TOL).action).toBe('REFUSED')
  })

  it('a parallel wall 4 cm into the band moves onto the face; 10 cm into it is the same band read twice', () => {
    const near = line('p', 2, 0.36, 6, 0.36, 0.12)
    const c = classifyWallConflict(near, front, TOL)
    expect(c.relation).toBe('PARALLEL_OVERLAP')
    expect(c.shiftM).toBeCloseTo(0.04, 6)
    const r = proposeWallRepair(near, front, c, TOL)
    expect(r.action).toBe('SHIFTED_CLEAR')
    if ('wall' in r) expect(r.wall.start.z).toBeCloseTo(0.4, 6)
    const inside = line('p', 2, 0.3, 6, 0.3, 0.12)
    const d = classifyWallConflict(inside, front, TOL)
    expect(d.relation).toBe('COINCIDENT_BAND')
    expect(proposeWallRepair(inside, front, d, TOL).action).toBe('DUPLICATE_OMITTED')
  })

  it('a parallel overlap deeper than the tolerance and not inside the band is not moved', () => {
    const deep = line('p', 2, 0.2, 6, 0.2, 0.4)
    const c = classifyWallConflict(deep, front, TOL)
    expect(c.relation).toBe('PARALLEL_OVERLAP')
    expect(proposeWallRepair(deep, front, c, TOL).action).toBe('OMITTED')
  })

  it('a wall continuing another in line keeps only the stretch beyond it', () => {
    const cont = line('p', 9, 0, 14, 0, 0.4, 'EXTERIOR')
    const c = classifyWallConflict(cont, front, TOL)
    expect(c.relation).toBe('COINCIDENT_BAND')
    const r = proposeWallRepair(cont, front, c, TOL)
    expect(r.action).toBe('DUPLICATE_TRIMMED')
    if ('wall' in r) expect(r.wall.start).toEqual({ x: 10, z: 0 })
  })
})

describe('reconciled in the program, every model valid', () => {
  it('a program with no overlap comes back unchanged, index for index, with no record', () => {
    const program = [...shell(), partition('p', { x: 5, z: 0.4 }, { x: 5, z: 4 })]
    const r = run(program)
    expect(r.ok).toBe(true)
    expect(r.program).toEqual(program)
    expect(r.indexMap).toEqual(program.map((_, i) => i))
    expect(r.records).toEqual([])
  })

  it('a partition drawn into the front wall is trimmed to its face; its door keeps its place in the world', () => {
    const program = [...shell(), partition('p', { x: 5, z: 0.3 }, { x: 5, z: 4 }), ...door('d', 'p', 1.0)]
    expect(valid(program)).toBe(false)
    const r = run(program)
    expect(r.ok).toBe(true)
    expect(valid(r.program)).toBe(true)
    expect(r.records).toHaveLength(1)
    expect(r.records[0]).toMatchObject({ kind: 'GEOMETRY_RECONCILIATION', wallId: 'p', otherWallId: 'ring-w0', relation: 'END_INTO_BAND', action: 'TRIMMED_TO_FACE', withinUncertainty: true })
    expect(r.records[0].moveM).toBeCloseTo(0.1, 6)
    const cut = r.program.find((c) => c.type === 'cutOpening') as { offset: number }
    // 1.0 m from (5, 0.3) is 0.9 m from (5, 0.4): the same door
    expect(cut.offset).toBeCloseTo(0.9, 6)
  })

  it('a partition that crosses the envelope is left out and named, with its door; the rest of the model stands', () => {
    const program = [...shell(), partition('p', { x: 5, z: -1 }, { x: 5, z: 4 }), ...door('d', 'p', 2.0), partition('q', { x: 2, z: 0.4 }, { x: 2, z: 3 })]
    const r = run(program)
    expect(r.ok).toBe(true)
    expect(valid(r.program)).toBe(true)
    expect(r.records.map((x) => x.action)).toEqual(['OMITTED'])
    expect(r.dependents.map((d) => d.id)).toEqual(['d', 'd-door'])
    expect(r.program.some((c) => c.type === 'createWall' && c.id === 'q')).toBe(true)
  })

  it('an exterior wall that crosses the envelope is refused with the pair named, not moved', () => {
    const r = run([...shell(), partition('x', { x: 5, z: -1 }, { x: 5, z: 4 }, 'EXTERIOR')])
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.refusal).toMatchObject({ wallId: 'x', otherWallId: 'ring-w0', relation: 'CROSSING', action: 'REFUSED' })
  })

  it('an attached body measured 2 cm into the main body: its edge moves onto the main wall’s face', () => {
    const r = run([...shell(), attached(7.98)])
    expect(r.ok).toBe(true)
    expect(valid(r.program)).toBe(true)
    expect(r.records.map((x) => x.action)).toEqual(['EDGE_MOVED'])
    const ring = r.program.find((c) => c.type === 'createWallRing' && c.id === 'garage') as { polygon: Array<{ x: number; z: number }> }
    expect(ring.polygon.slice(0, 2)).toEqual([{ x: 2, z: 8 }, { x: 8, z: 8 }])
  })

  it('an attached body whose shared wall IS the main wall: that wall is built once, the body’s other walls meet it', () => {
    const r = run([...shell(), attached(7.6), { type: 'setEvidence', targetId: 'garage', evidence: { status: 'SOURCE_EXACT', note: 'body' } } as unknown as BuildingCommand])
    expect(r.ok).toBe(true)
    expect(valid(r.program)).toBe(true)
    expect(r.records[0]).toMatchObject({ action: 'RING_OPENED', wallId: 'garage-w0', otherWallId: 'ring-w2' })
    expect(r.records.slice(1).map((x) => x.action)).toEqual(['TRIMMED_TO_FACE', 'TRIMMED_TO_FACE'])
    const walls = r.program.filter((c) => c.type === 'createWall').map((c) => (c as { id: string }).id)
    expect(walls).toEqual(['garage-w1', 'garage-w2', 'garage-w3'])
    // the ring's evidence goes to each of its walls
    expect(r.program.filter((c) => c.type === 'setEvidence').map((c) => (c as { targetId: string }).targetId)).toEqual(['garage-w1', 'garage-w2', 'garage-w3'])
  })

  it('negative: a body drawn a metre into the main body is refused, not bent to fit', () => {
    const r = run([...shell(), attached(7.0)])
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.refusal?.action).toBe('REFUSED')
    expect(r.refusal?.wallId.startsWith('garage-')).toBe(true)
  })

  it('on an upper storey the same reading applies; a partition below in the same place does not meet it', () => {
    const program = [
      ...shell(),
      partition('p0', { x: 5, z: 0.4 }, { x: 5, z: 4 }),
      { type: 'createLevel', id: 'l1', name: 'First', index: 1, elevation: 2.8, height: 2.6 },
      { type: 'createWallRing', id: 'ring1', levelId: 'l1', polygon: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 8 }, { x: 0, z: 8 }], thickness: 0.4, height: 2.6, baseOffset: 0, kind: 'EXTERIOR', cornerOwnership: 'ALTERNATE' },
      { ...partition('p1', { x: 5, z: 0.35 }, { x: 5, z: 4 }, 'INTERIOR', 'l1'), height: 2.6 },
    ] as BuildingCommand[]
    const r = run(program)
    expect(r.ok).toBe(true)
    expect(valid(r.program)).toBe(true)
    expect(r.records.map((x) => `${x.wallId}:${x.otherWallId}:${x.action}`)).toEqual(['p1:ring1-w0:TRIMMED_TO_FACE'])
  })

  it('an opening the model refuses is not the reconciliation’s: it goes on, unapplied, to the opening fit', () => {
    const program = [...shell(), ...door('d', 'ring-w0', 20)]
    const r = run(program)
    expect(r.ok).toBe(true)
    expect(r.program).toEqual(program)
    expect(r.records).toEqual([])
    const fit = fitOpeningsToHosts(r.program, 'fixture', 'm-fixture')
    expect(fit.ok).toBe(true)
    expect(fit.fits.map((f) => f.action)).toEqual(['DROPPED'])
  })

  it('a wall the model refuses for anything but overlap is returned as the failure it is', () => {
    const r = run([...shell(), partition('p', { x: 5, z: 0.4 }, { x: 5, z: 4 }, 'INTERIOR', 'no-such-level')])
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.records).toEqual([])
    expect(r.refusal).toBeUndefined()
  })
})

describe('what the reconciliation says about the model', () => {
  it('walls moved within the uncertainty make a preview with adjustments; a partition left out makes it partial; a refusal names the pair', () => {
    const moved = run([...shell(), partition('p', { x: 5, z: 0.3 }, { x: 5, z: 4 })])
    expect(modeOf(moved)).toBe('PREVIEW_WITH_ADJUSTMENTS')
    const partial = run([...shell(), partition('p', { x: 5, z: -1 }, { x: 5, z: 4 })])
    expect(modeOf(partial)).toBe('PARTIAL_SOURCE_GROUNDED')
    const refused = run([...shell(), partition('x', { x: 5, z: -1 }, { x: 5, z: 4 }, 'EXTERIOR')])
    expect(modeOf(refused)).toBe('REFUSED')
    if (refused.ok || !refused.refusal) throw new Error('expected a refusal')
    expect(refusalDiagnostics(refused.refusal)).toMatchObject({ reconciliation: 'CROSSING', reconciliationAgainst: 'ring-w0', toleranceM: TOL })
  })

  it('the tolerance is the coarsest plan’s', () => {
    expect(planReconcileTolerance([{ mppX: 0.02, mppY: 0.021 }, { mppX: 0.025, mppY: 0.024 }])).toBeCloseTo(0.075, 6)
  })
})
