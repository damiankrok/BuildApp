/**
 * Linear solids: the generic primitive, on a generic building.
 *
 * Nothing here is about any particular house. The claims are the ones a
 * downstream solver needs to be able to rely on: a member is a closed solid
 * whose volume is exactly length × width × depth, its cross-section axes are
 * derived the same way by the model and the compiler, and it works horizontal,
 * vertical and raking — because a gable-edge member is raking and a
 * reconstruction that could only place horizontal ones would have to fall back
 * to flat regions on exactly the facades that need solids.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyModel, linearSolidBasis, linearSolidBounds, linearSolidVolume, serializeModel, loadModel, validateModel } from '@buildapp/model'
import { runCommands, type BuildingCommand } from '@buildapp/commands'
import { compileBuilding, compileLinearSolid } from '../src/index.js'
import { manifoldReport, meshVolume, materialLength, boundsOf } from '@buildapp/verification'

const BASE: BuildingCommand[] = [
  { type: 'createBuilding', id: 'b', name: 'plain' },
  { type: 'createLevel', id: 'l0', index: 0, elevation: 0, height: 3 },
  { type: 'defineMaterial', id: 'm-concrete', name: 'concrete', color: '#b0aaa0' },
  { type: 'createWall', id: 'w-front', levelId: 'l0', start: { x: 0, z: 0 }, end: { x: 8, z: 0 }, thickness: 0.3, height: 3 },
]

const model = (...extra: BuildingCommand[]) => runCommands(createEmptyModel('lin', 'linear solids'), [...BASE, ...extra])

const solidCmd = (over: Partial<Extract<BuildingCommand, { type: 'createLinearSolid' }>> = {}): BuildingCommand => ({
  type: 'createLinearSolid',
  id: 'solid-1',
  levelId: 'l0',
  start: { x: 0, y: 2.5, z: -0.2 },
  end: { x: 8, y: 2.5, z: -0.2 },
  width: 0.4,
  depth: 0.3,
  materialId: 'm-concrete',
  ...over,
})

describe('a linear solid is a real closed volume', () => {
  it('compiles to a closed manifold whose volume is length x width x depth', () => {
    const m = model(solidCmd())
    expect(validateModel(m).issues).toEqual([])
    const solid = m.linearSolids[0]
    const tris = compileLinearSolid(solid)
    const report = manifoldReport(tris)
    expect(report.closed).toBe(true)
    expect(report.boundaryEdges).toBe(0)
    expect(report.duplicateEdges).toBe(0)
    expect(Math.abs(meshVolume(tris))).toBeCloseTo(8 * 0.4 * 0.3, 9)
    expect(Math.abs(meshVolume(tris))).toBeCloseTo(linearSolidVolume(solid), 9)
  })

  it('is centred on its own stated centreline, not hung off one arris', () => {
    const solid = model(solidCmd()).linearSolids[0]
    const b = boundsOf(compileLinearSolid(solid))
    expect(b).not.toBeNull()
    if (!b) return
    // width runs up (world y) for a horizontal member, depth across (world z)
    expect((b.min.y + b.max.y) / 2).toBeCloseTo(2.5, 9)
    expect((b.min.z + b.max.z) / 2).toBeCloseTo(-0.2, 9)
    expect(b.max.y - b.min.y).toBeCloseTo(0.4, 9)
    expect(b.max.z - b.min.z).toBeCloseTo(0.3, 9)
  })

  it('measures width up the facade and depth out of it, for a horizontal member', () => {
    const solid = model(solidCmd()).linearSolids[0]
    const basis = linearSolidBasis(solid)
    expect(basis.pathDir).toEqual({ x: 1, y: 0, z: 0 })
    expect(basis.widthAxis.y).toBeCloseTo(1, 9)
    expect(Math.abs(basis.depthAxis.z)).toBeCloseTo(1, 9)
    // a ray along z through the member's centre passes through exactly `depth` of it
    expect(materialLength(compileLinearSolid(solid), { x: 4, y: 2.5, z: -5 }, { x: 0, y: 0, z: 1 })).toBeCloseTo(0.3, 9)
  })
})

describe('it works in every direction a facade member runs', () => {
  it('vertical: the basis stays fixed rather than arbitrary, and the volume is exact', () => {
    const solid = model(solidCmd({ start: { x: 1, y: 0, z: -0.2 }, end: { x: 1, y: 3, z: -0.2 }, width: 0.25, depth: 0.3 })).linearSolids[0]
    const basis = linearSolidBasis(solid)
    expect(basis.pathDir).toEqual({ x: 0, y: 1, z: 0 })
    expect(basis.depthAxis).toEqual({ x: 0, y: 0, z: 1 })
    const tris = compileLinearSolid(solid)
    expect(manifoldReport(tris).closed).toBe(true)
    expect(Math.abs(meshVolume(tris))).toBeCloseTo(3 * 0.25 * 0.3, 9)
  })

  it('raking: a gable-edge member keeps its section square to the rake', () => {
    const rise = 4 * Math.tan((40 * Math.PI) / 180)
    const solid = model(solidCmd({ start: { x: 0, y: 3, z: -0.2 }, end: { x: 4, y: 3 + rise, z: -0.2 }, width: 0.35, depth: 0.28 })).linearSolids[0]
    const basis = linearSolidBasis(solid)
    // 40 degrees, the pitch a gable of this span actually rakes at
    expect((Math.atan2(basis.pathDir.y, basis.pathDir.x) * 180) / Math.PI).toBeCloseTo(40, 4)
    const tris = compileLinearSolid(solid)
    expect(manifoldReport(tris).closed).toBe(true)
    expect(Math.abs(meshVolume(tris))).toBeCloseTo(basis.length * 0.35 * 0.28, 9)
    // the section is perpendicular to the path: its width axis is perpendicular too
    expect(basis.widthAxis.x * basis.pathDir.x + basis.widthAxis.y * basis.pathDir.y + basis.widthAxis.z * basis.pathDir.z).toBeCloseTo(0, 9)
  })

  it('rolled: a canted member turns its section about its own path and keeps its volume', () => {
    const upright = model(solidCmd()).linearSolids[0]
    const canted = model(solidCmd({ rollDeg: 30 })).linearSolids[0]
    const a = linearSolidBasis(upright)
    const b = linearSolidBasis(canted)
    const dot = a.widthAxis.x * b.widthAxis.x + a.widthAxis.y * b.widthAxis.y + a.widthAxis.z * b.widthAxis.z
    expect((Math.acos(dot) * 180) / Math.PI).toBeCloseTo(30, 6)
    expect(Math.abs(meshVolume(compileLinearSolid(canted)))).toBeCloseTo(8 * 0.4 * 0.3, 9)
    // the axes stay orthonormal through the roll
    expect(b.widthAxis.x * b.depthAxis.x + b.widthAxis.y * b.depthAxis.y + b.widthAxis.z * b.depthAxis.z).toBeCloseTo(0, 9)
  })
})

describe('it is an ordinary semantic object', () => {
  it('appears in the compiled scene as its own selectable solid, on its level', () => {
    const scene = compileBuilding(model(solidCmd({ hostId: 'w-front' })))
    expect(scene.diagnostics).toEqual([])
    const mesh = scene.meshes.find((x) => x.objectId === 'solid-1')
    expect(mesh).toBeDefined()
    expect(mesh?.objectKind).toBe('linearSolid')
    expect(mesh?.part).toBe('LINEAR_SOLID')
    expect(mesh?.levelId).toBe('l0')
    expect(mesh?.solidId).toBe('solid-1')
    expect(mesh?.structural).toBe(false)
    expect(mesh?.materialId).toBe('m-concrete')
  })

  it('survives save and load byte for byte, and keeps its id', () => {
    const m = model(solidCmd({ hostId: 'w-front', name: 'facade frame' }))
    const json = serializeModel(m)
    const back = loadModel(json)
    expect(back.ok).toBe(true)
    if (!back.ok) return
    expect(back.issues).toEqual([])
    expect(serializeModel(back.model)).toBe(json)
    expect(back.model.linearSolids[0].id).toBe('solid-1')
    expect(back.model.linearSolids[0].hostId).toBe('w-front')
  })

  it('does not change the walls it runs past: it is its own solid, not a wall modifier', () => {
    const without = compileBuilding(model())
    const with_ = compileBuilding(model(solidCmd({ hostId: 'w-front' })))
    const wallOf = (s: typeof without) => s.meshes.filter((x) => x.objectId === 'w-front')
    expect(wallOf(with_)).toEqual(wallOf(without))
    expect(with_.meshes.length).toBe(without.meshes.length + 1)
  })
})

describe('a member that cannot be built is reported, not drawn', () => {
  /** The DSL refuses an invalid command, so a defective member is built by hand to prove the validator catches it too. */
  const withSolid = (over: Record<string, unknown>) => {
    const m = model()
    return { ...m, linearSolids: [{ id: 'bad', levelId: 'l0', start: { x: 0, y: 2.5, z: -0.2 }, end: { x: 8, y: 2.5, z: -0.2 }, width: 0.4, depth: 0.3, materialId: 'm-concrete', ...over }] } as typeof m
  }

  it('refuses a degenerate member, and draws nothing rather than a sliver', () => {
    const m = withSolid({ end: { x: 0, y: 2.5, z: -0.2 } })
    expect(validateModel(m).issues.map((i) => i.code)).toContain('LINEAR_SOLID_DEGENERATE')
    expect(compileLinearSolid(m.linearSolids[0])).toEqual([])
    expect(linearSolidVolume(m.linearSolids[0])).toBe(0)
    expect(linearSolidBounds(m.linearSolids[0]).min.x).toBe(0)
    // the compiler refuses an invalid model up front rather than drawing half of it
    expect(compileBuilding(m).diagnostics.map((d) => d.code)).toEqual(['MODEL_INVALID'])
  })

  it('refuses the command that would have created it, rather than storing it', () => {
    expect(() => model(solidCmd({ end: { x: 0, y: 2.5, z: -0.2 } }))).toThrow(/LINEAR_SOLID_DEGENERATE/)
    expect(() => model(solidCmd({ levelId: 'nope' }))).toThrow(/UNKNOWN_LEVEL/)
    expect(() => model(solidCmd({ materialId: 'also-nope' }))).toThrow(/UNKNOWN_MATERIAL/)
  })

  it('reports a host that is not a surface a member could run on', () => {
    const m = model({ type: 'createRoom', id: 'r1', levelId: 'l0', polygon: [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 4 }, { x: 0, z: 4 }] })
    const bad = { ...m, linearSolids: [{ id: 'bad', levelId: 'l0', hostId: 'r1', start: { x: 0, y: 2.5, z: -0.2 }, end: { x: 8, y: 2.5, z: -0.2 }, width: 0.4, depth: 0.3, materialId: 'm-concrete' }] } as typeof m
    expect(validateModel(bad).issues.map((i) => i.code)).toContain('LINEAR_SOLID_HOST_INVALID')
  })
})
