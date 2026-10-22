/**
 * N7-P1: the last valid model when a later object fails.
 *
 * A refused command used to throw the whole reconstruction away. Now the refused object goes out atomically with its
 * body and whatever needs it, the rest is fitted again, and the base — the levels and the main body's floors and
 * walls — is a checkpoint a test can replay. The validator is not touched: every model here passes it whole.
 */
import { describe, expect, it } from 'vitest'
import { applyCommands } from '@buildapp/commands'
import type { BuildingCommand } from '@buildapp/commands'
import { compileBuilding } from '@buildapp/geometry'
import { createEmptyModel, serializeModel } from '@buildapp/model'
import { buildMobileSceneBundle, loadBundle, serializeBundle } from '@buildapp/mobile-scene'
import { sha256Hex } from '@buildapp/source-common'
import { buildCandidateModel, cutFailedObject, fitOpeningsToHosts, fitPreviewProgram, isPreviewBase, minimalPreviewProgram, previewCheckpoint } from '../src/candidate.js'

const T = 0.3
const ring = (id: string, levelId: string, x0: number, z0: number, x1: number, z1: number, extra: Record<string, unknown> = {}): BuildingCommand =>
  ({ type: 'createWallRing', id, levelId, polygon: [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }], thickness: T, height: 2.7, baseOffset: 0, kind: 'EXTERIOR', cornerOwnership: 'ALTERNATE', ...extra }) as BuildingCommand
const slab = (id: string, levelId: string, x0: number, z0: number, x1: number, z1: number): BuildingCommand =>
  ({ type: 'createSlab', id, levelId, polygon: [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }], topOffset: 0, thickness: 0.25 }) as BuildingCommand
const window = (id: string, wallId: string, offset: number, place: Record<string, unknown> = {}): BuildingCommand[] =>
  [
    { type: 'cutOpening', id, wallId, kind: 'WINDOW', offset, sill: 0.9, width: 1.2, height: 1.4 },
    { type: 'placeWindow', id: `${id}-window`, openingId: id, ...place },
    { type: 'setEvidence', targetId: id, evidence: { status: 'SOURCE_EXACT', interpretation: 'a window on the plan' } },
  ] as BuildingCommand[]

/** An 8 × 10 m two-storey main body; the program as `emit.ts` orders it: header, levels, bodies, then the rest. */
const header = (): BuildingCommand[] =>
  [
    { type: 'setModelName', name: 'fixture' },
    { type: 'createBuilding', id: 'bld', name: 'fixture' },
    { type: 'defineMaterial', id: 'mat-wall', name: 'wall', color: '#e8e4dc' },
    { type: 'createLevel', id: 'lvl-0', name: 'Ground', index: 0, elevation: 0, height: 2.7 },
    { type: 'createLevel', id: 'lvl-1', name: 'Level 1', index: 1, elevation: 2.95, height: 2.6 },
  ] as BuildingCommand[]
const mainBody = (): BuildingCommand[] => [
  slab('slab-main-0', 'lvl-0', 0, 0, 8, 10),
  ring('ring-main-0', 'lvl-0', 0, 0, 8, 10),
  slab('slab-main-1', 'lvl-1', T, T, 8 - T, 10 - T),
  ring('ring-main-1', 'lvl-1', 0, 0, 8, 10, { height: 2.6 }),
  { type: 'setEvidence', targetId: 'ring-main-0', evidence: { status: 'SOURCE_EXACT', interpretation: 'the body from the printed chains' } } as BuildingCommand,
]
/** An attached body beside the main one; `width` below 2 × T makes its east and west walls one band. */
const attachedBody = (width: number): BuildingCommand[] => [
  slab('slab-attached-0-0', 'lvl-0', 8, 4, 8 + width, 10),
  ring('ring-attached-0-0', 'lvl-0', 8, 4, 8 + width, 10),
  { type: 'setEvidence', targetId: 'ring-attached-0-0', evidence: { status: 'SOURCE_EXACT', interpretation: 'the attached body' } } as BuildingCommand,
  { type: 'cutOpening', id: 'att-door', wallId: 'ring-attached-0-0-w0', kind: 'DOOR', offset: 0.05, sill: 0, width: 0.3, height: 2.0 } as BuildingCommand,
  { type: 'createRoof', id: 'roof-attached-0', levelId: 'lvl-0', kind: 'FLAT', footprint: { minX: 8, maxX: 8 + width, minZ: 4, maxZ: 10 }, eaveOffset: 2.7, overhang: 0, thickness: 0.2 } as BuildingCommand,
]
const later = (): BuildingCommand[] => [
  ...window('win-front-0', 'ring-main-0-w0', 2),
  ...window('win-front-1', 'ring-main-1-w0', 2),
  { type: 'createWall', id: 'main-iwall-0-x-0', levelId: 'lvl-0', start: { x: T, z: 5 }, end: { x: 8 - T, z: 5 }, thickness: 0.12, height: 2.7, baseOffset: 0, kind: 'INTERIOR' } as BuildingCommand,
]
const OPTIONS = { label: 'fixture', modelId: 'm-fixture', mainMassId: 'main', toleranceM: 0.06 }

/** What a phone gets: the model built, compiled, packed, and read back. */
function delivered(program: BuildingCommand[]) {
  const model = buildCandidateModel(program, OPTIONS.label, OPTIONS.modelId)
  const scene = compileBuilding(model)
  const text = serializeBundle(buildMobileSceneBundle(model, { scene }))
  const back = loadBundle(text)
  return { model, scene, back, replayed: sha256Hex(serializeModel(buildCandidateModel(program, OPTIONS.label, OPTIONS.modelId))) === sha256Hex(serializeModel(model)) }
}

describe('a valid main body and a refused attached ring: a partial model', () => {
  const program = [...header(), ...mainBody(), ...attachedBody(0.45), ...later()]

  it('the plain fit refuses the sliver exactly as the owner’s house was refused', () => {
    const plain = fitOpeningsToHosts(program, OPTIONS.label, OPTIONS.modelId)
    expect(plain.ok).toBe(false)
    if (plain.ok) return
    expect(plain.command).toMatchObject({ type: 'createWallRing', id: 'ring-attached-0-0' })
    expect(plain.errors[0].message).toMatch(/walls ring-attached-0-0-w1 and ring-attached-0-0-w3 share [0-9.]+ m²/)
  })

  it('the preview keeps everything before it and after it, and leaves out the body, its door and its roof', () => {
    const r = fitPreviewProgram(program, OPTIONS)
    expect(r.fit.ok).toBe(true)
    expect(r.basis).toBe('CHECKPOINT')
    expect(r.failures).toHaveLength(1)
    expect(r.failures[0]).toMatchObject({ commandIndex: program.findIndex((c) => 'id' in c && c.id === 'ring-attached-0-0'), type: 'createWallRing', id: 'ring-attached-0-0', codes: ['WALLS_OVERLAP'] })
    expect(r.failures[0].message).toMatch(/ring-attached-0-0-w1 and ring-attached-0-0-w3/)
    const skipped = Object.fromEntries(r.skipped.map((s) => [s.id ?? `${s.type}@${s.commandIndex}`, s.cause]))
    expect(skipped).toEqual({ 'slab-attached-0-0': 'SAME_BODY', 'ring-attached-0-0': 'FAILED', 'setEvidence@12': 'DEPENDENT', 'att-door': 'DEPENDENT', 'roof-attached-0': 'SAME_BODY' })
    const { model, scene, back, replayed } = delivered(r.fit.program)
    expect(model.wallRings.map((w) => w.id)).toEqual(['ring-main-0', 'ring-main-1'])
    expect(model.walls.some((w) => w.id.startsWith('ring-attached'))).toBe(false)
    expect(model.walls.map((w) => w.id)).toContain('main-iwall-0-x-0')
    expect(model.windows).toHaveLength(2)
    expect(model.slabs.map((s) => s.id)).toEqual(['slab-main-0', 'slab-main-1'])
    expect(scene.meshes.length).toBeGreaterThan(0)
    expect(back.ok).toBe(true)
    expect(replayed).toBe(true)
    // every emitted command is either in the fitted program or named as skipped
    const fittedFrom = r.fit.indexMap.filter((k) => k >= 0).length
    expect(fittedFrom + r.skipped.length).toBe(program.length)
  })

  it('the checkpoint is the main body’s prefix, and replaying that prefix gives its hash', () => {
    const r = fitPreviewProgram(program, OPTIONS)
    const cp = previewCheckpoint(r.fit.program, 'main', OPTIONS.label, OPTIONS.modelId)
    expect(cp).toBeDefined()
    expect(cp?.wallRings).toEqual(['ring-main-0', 'ring-main-1'])
    const prefix = r.fit.program.slice(0, cp?.commands)
    expect(prefix.every((c) => isPreviewBase(c, 'main') || c.type === 'setEvidence')).toBe(true)
    const applied = applyCommands(createEmptyModel(OPTIONS.modelId, OPTIONS.label), prefix)
    expect(applied.failedAt).toBeUndefined()
    expect(sha256Hex(serializeModel(applied.model))).toBe(cp?.modelSha256)
  })
})

describe('what stood against the refused body goes with it; what the drawings show free-standing stays', () => {
  /** A return in front of a face at z = `face`, one metre deep. */
  const returnWall = (id: string, x: number, face = 4): BuildingCommand => ({ type: 'createWall', id, levelId: 'lvl-0', start: { x, z: face }, end: { x, z: face - 1 }, thickness: T, height: 2.7, baseOffset: 0, kind: 'EXTERIOR' }) as BuildingCommand

  it('a recess return at the refused body’s outer face meets nothing once the body is out: it is left out and named', () => {
    // the sliver's outer face at x = 8.45: a return stands in front of it; another in front of the main body's corner
    const program = [...header(), ...mainBody(), ...attachedBody(0.45), returnWall('return-front-0-1', 8.45), returnWall('return-front-0-0', 0, 0), ...later()]
    const r = fitPreviewProgram(program, OPTIONS)
    expect(r.fit.ok).toBe(true)
    expect(r.skipped.find((x) => x.id === 'return-front-0-1')).toMatchObject({ cause: 'DEPENDENT', why: expect.stringMatching(/no wall that stands meets either of its ends/) })
    expect(r.skipped.some((x) => x.id === 'return-front-0-0')).toBe(false)
    const { model } = delivered(r.fit.program)
    expect(model.walls.map((w) => w.id)).toContain('return-front-0-0')
    expect(model.walls.map((w) => w.id)).not.toContain('return-front-0-1')
  })

  it('a wall that met nothing before the cut is not taken for one that leaned on the body', () => {
    const program = [...header(), ...mainBody(), ...attachedBody(0.45), returnWall('garden-wall', 14), ...later()]
    const r = fitPreviewProgram(program, OPTIONS)
    expect(r.fit.ok).toBe(true)
    expect(r.skipped.some((x) => x.id === 'garden-wall')).toBe(false)
  })

  it('a refused window takes nothing standing with it: the rule runs only when a body is cut', () => {
    const program = [...header(), ...mainBody(), returnWall('garden-wall', 14), ...window('win-bad', 'ring-main-0-w0', 5, { frameDepth: 0.5, frameInset: 0.3 })]
    const r = fitPreviewProgram(program, OPTIONS)
    expect(r.skipped.map((x) => x.id)).toEqual(['win-bad-window'])
  })
})

describe('a refused window or roof: the walls built before it can still be looked at', () => {
  it('a window the model refuses goes alone; the wall it was cut in stays', () => {
    // a frame deeper than the wall it sits in: the model refuses the window, not the wall
    const program = [...header(), ...mainBody(), ...window('win-bad', 'ring-main-0-w0', 5, { frameDepth: 0.5, frameInset: 0.3 }), ...later()]
    expect(fitOpeningsToHosts(program, OPTIONS.label, OPTIONS.modelId).ok).toBe(false)
    const r = fitPreviewProgram(program, OPTIONS)
    expect(r.fit.ok).toBe(true)
    expect(r.failures[0]).toMatchObject({ type: 'placeWindow', id: 'win-bad-window' })
    expect(r.skipped.map((s) => s.id)).toEqual(['win-bad-window'])
    const { model, back } = delivered(r.fit.program)
    expect(model.wallRings.map((w) => w.id)).toEqual(['ring-main-0', 'ring-main-1'])
    expect(model.openings.map((o) => o.id)).toContain('win-bad')
    expect(back.ok).toBe(true)
  })

  it('a roof the model refuses goes with what stands on it; every wall stays', () => {
    const roof = { type: 'createRoof', id: 'roof-main', levelId: 'lvl-1', kind: 'GABLE', footprint: { minX: 0, maxX: 8, minZ: 0, maxZ: 10 }, eaveOffset: 2.6, pitchDeg: 40, ridgeAxis: 'Z', overhang: 0.4, thickness: 0.25, capWallIds: ['ring-main-1-w0', 'no-such-wall'] } as BuildingCommand
    const after = [{ type: 'setEvidence', targetId: 'roof-main', evidence: { status: 'SOURCE_DERIVED', interpretation: 'the roof' } }] as BuildingCommand[]
    const program = [...header(), ...mainBody(), ...later(), roof, ...after]
    expect(fitOpeningsToHosts(program, OPTIONS.label, OPTIONS.modelId).ok).toBe(false)
    const r = fitPreviewProgram(program, OPTIONS)
    expect(r.fit.ok).toBe(true)
    expect(r.failures[0]).toMatchObject({ type: 'createRoof', id: 'roof-main' })
    expect(r.skipped.map((s) => `${s.type}:${s.cause}`)).toEqual(['createRoof:FAILED', 'setEvidence:DEPENDENT'])
    const { model, back } = delivered(r.fit.program)
    expect(model.roofs).toHaveLength(0)
    expect(model.wallRings).toHaveLength(2)
    expect(model.windows).toHaveLength(2)
    expect(back.ok).toBe(true)
  })

  it('an upper storey of the main body that is refused takes the storeys above it, and the ground floor stays', () => {
    const program = [...header(), slab('slab-main-0', 'lvl-0', 0, 0, 8, 10), ring('ring-main-0', 'lvl-0', 0, 0, 8, 10), slab('slab-main-1', 'lvl-1', T, T, 8 - T, 10 - T), ring('ring-main-1', 'lvl-1', 0, 0, 0.4, 10), ...window('win-front-0', 'ring-main-0-w0', 2), ...window('win-front-1', 'ring-main-1-w0', 0.05)]
    const r = fitPreviewProgram(program, OPTIONS)
    expect(r.fit.ok).toBe(true)
    expect(r.failures[0]).toMatchObject({ id: 'ring-main-1' })
    const { model } = delivered(r.fit.program)
    expect(model.wallRings.map((w) => w.id)).toEqual(['ring-main-0'])
    expect(model.windows.map((w) => w.id)).toEqual(['win-front-0-window'])
  })
})

describe('no reliable outline: no house is made up', () => {
  it('a main ground ring the model refuses is not cut around', () => {
    const program = [...header(), slab('slab-main-0', 'lvl-0', 0, 0, 0.4, 10), ring('ring-main-0', 'lvl-0', 0, 0, 0.4, 10), ...window('win', 'ring-main-0-w1', 2)]
    expect(cutFailedObject(program, 6, 'main', 'refused')).toBeNull()
    expect(minimalPreviewProgram(program, 'main', OPTIONS.label, OPTIONS.modelId)).toBeNull()
    const r = fitPreviewProgram(program, OPTIONS)
    expect(r.fit.ok).toBe(false)
    expect(r.failures).toEqual([])
    expect(r.skipped).toEqual([])
  })

  it('a program with no main body walls at all has no preview', () => {
    const program = [...header(), ...attachedBody(0.45)]
    const r = fitPreviewProgram(program, OPTIONS)
    expect(r.fit.ok).toBe(false)
    expect(r.failures).toEqual([])
  })

  it('a refusal in the header is never cut around', () => {
    const program = [...header(), { type: 'createLevel', id: 'lvl-0', name: 'again', index: 0, elevation: 0, height: 2.7 } as BuildingCommand, ...mainBody()]
    expect(fitPreviewProgram(program, OPTIONS).fit.ok).toBe(false)
  })
})

describe('the base alone, when what stands on it is refused with it', () => {
  it('a main ring that follows roof planes that are not there is built at its storey height, and named as minimal', () => {
    const program = [...header(), slab('slab-main-0', 'lvl-0', 0, 0, 8, 10), ring('ring-main-0', 'lvl-0', 0, 0, 8, 10, { height: 6.5, topProfile: { kind: 'FOLLOW_ROOF_PLANES', planeIds: ['roof-main-plane-low'] } }), ...window('win', 'ring-main-0-w0', 2)]
    expect(fitOpeningsToHosts(program, OPTIONS.label, OPTIONS.modelId).ok).toBe(false)
    const r = fitPreviewProgram(program, OPTIONS)
    expect(r.fit.ok).toBe(true)
    expect(r.basis).toBe('MINIMAL_BASE')
    expect(r.skipped.every((s) => s.cause === 'NOT_IN_MINIMAL_PREVIEW')).toBe(true)
    const { model } = delivered(r.fit.program)
    expect(model.wallRings.map((w) => w.id)).toEqual(['ring-main-0'])
    expect(model.walls.every((w) => w.height === 2.7)).toBe(true)
    expect(model.openings).toHaveLength(0)
  })
})

describe('programs the model takes whole: nothing changes', () => {
  it('the preview fit of a valid program is the plain fit, command for command', () => {
    const program = [...header(), ...mainBody(), ...attachedBody(2.4).filter((c) => !('id' in c && c.id === 'att-door')), ...later()]
    const plain = fitOpeningsToHosts(program, OPTIONS.label, OPTIONS.modelId)
    expect(plain.ok).toBe(true)
    const r = fitPreviewProgram(program, OPTIONS)
    expect(r.failures).toEqual([])
    expect(r.skipped).toEqual([])
    expect(r.fit).toEqual(plain)
  })
})
