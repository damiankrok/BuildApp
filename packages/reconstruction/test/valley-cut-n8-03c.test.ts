/**
 * N8-03C: a main gable a wing's roof runs into along valleys is stated as its planes, the slope under the wing cut
 * back to the wing's valleys (`valley-cut.ts`), and emitted so (`emitBuilding`): no roof stands inside another, the
 * two surfaces meet along each valley, a wall under the cut rises to the wing's roof, and a wall outside it keeps the
 * main slope. Every house here is invented: a body 8 × 10 m on two storeys, ridge along Z at 45°, a wing to its east.
 *  - a wing whose ridge reaches the main ridge with its eaves lower (the valleys meet ON the main ridge): the cut slope
 *    is two planes, either side of the apex;
 *  - a wing whose ridge is lower (the valleys meet on the slope): one plane with a notch;
 *  - refused, the gable kept whole: eaves projecting past the walls, edge members, no valley at all;
 *  - the roof as built over a point: the wing's underside in the cut, the main slope's outside it.
 */
import { describe, expect, it } from 'vitest'
import { applyCommands } from '@buildapp/commands'
import { createEmptyModel, validateModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import type { Triangle } from '@buildapp/geometry'
import { attachedGableLayout } from '../src/v2/attached-roof-form.js'
import type { MainRoofForJoin } from '../src/v2/attached-roof-form.js'
import { builtRoofUndersideAt, isValleyCut, segmentCrossesNotch, valleyCutMainRoof } from '../src/v2/valley-cut.js'
import type { ValleyCut, ValleyCutWing } from '../src/v2/valley-cut.js'
import { emitBuilding } from '../src/index.js'
import type { BuildingV2, MassV2 } from '../src/index.js'

const T = 0.4
const LEVEL1 = 2.9
const EAVE = 4.4
const PITCH = 45
const main = { ridgeAxis: 'Z' as const, ridgeAt: 4, eaveY: EAVE, pitchDeg: PITCH, thicknessM: 0.28, footprint: { x0: 0, z0: 0, x1: 8, z1: 10 }, overhangM: 0, hasEdgeMembers: false }
const join: MainRoofForJoin = { ridgeAxis: 'Z', ridgeAt: 4, eaveY: EAVE, ridgeY: EAVE + 4, pitchDeg: PITCH, footprint: main.footprint }
/** A wing 9 m deep to the east, eaves 0.5 m below the main ones: its ridge reaches the main ridge. */
const highWing = (): ValleyCutWing => ({ massId: 'attached-0', pitchDeg: PITCH, thicknessM: 0.28, layout: attachedGableLayout({ x0: 8, z0: 0.5, x1: 12, z1: 9.5 }, 'X', PITCH, EAVE - 0.5, join), planeIds: { LOW: 'roof-attached-0-plane-low', HIGH: 'roof-attached-0-plane-high' } })
/** A wing 7 m deep, eaves at the main eaves: its ridge stays under the main ridge. */
const lowWing = (): ValleyCutWing => ({ massId: 'attached-0', pitchDeg: PITCH, thicknessM: 0.28, layout: attachedGableLayout({ x0: 8, z0: 1.5, x1: 12, z1: 8.5 }, 'X', PITCH, EAVE, join), planeIds: { LOW: 'roof-attached-0-plane-low', HIGH: 'roof-attached-0-plane-high' } })
const legacyTop = (x: number): number => EAVE + (4 - Math.abs(x - 4))

describe('N8-03C: the main gable cut back to a wing’s valleys', () => {
  it('valleys that meet on the main ridge: the low slope whole, the high one two planes either side of the apex', () => {
    const c = valleyCutMainRoof(main, [highWing()]) as ValleyCut
    expect(isValleyCut(c)).toBe(true)
    expect(c.planes.map((p) => p.id)).toEqual(['roof-main-plane-low', 'roof-main-plane-high-0', 'roof-main-plane-high-1'])
    expect(c.planes[1].boundary).toEqual([{ x: 8, z: 0 }, { x: 8, z: 1 }, { x: 4, z: 5 }, { x: 4, z: 0 }])
    expect(c.planes[2].boundary).toEqual([{ x: 4, z: 5 }, { x: 8, z: 9 }, { x: 8, z: 10 }, { x: 4, z: 10 }])
    expect(c.ridges.map((r) => [r.low, r.high])).toEqual([['roof-main-plane-low', 'roof-main-plane-high-0'], ['roof-main-plane-low', 'roof-main-plane-high-1']])
    expect(c.valleys.map((v) => [v.mainPlaneId, v.wingPlaneId])).toEqual([['roof-main-plane-high-0', 'roof-attached-0-plane-low'], ['roof-main-plane-high-1', 'roof-attached-0-plane-high']])
    expect(c.notches[0].polygon).toEqual([{ x: 8, z: 1 }, { x: 4, z: 5 }, { x: 8, z: 9 }])
  })
  it('valleys that meet on the slope: one plane with a notch, the ridge whole', () => {
    const c = valleyCutMainRoof(main, [lowWing()]) as ValleyCut
    expect(c.planes.map((p) => p.id)).toEqual(['roof-main-plane-low', 'roof-main-plane-high'])
    const apex = c.notches[0].polygon[1]
    expect(apex.x).toBeGreaterThan(4)
    expect(apex.x).toBeLessThan(8)
    expect(c.planes[1].boundary).toContainEqual(apex)
    expect(c.ridges).toHaveLength(1)
  })
  it('every plane is the legacy gable where it stands: the same top surface, eave and ridge', () => {
    const c = valleyCutMainRoof(main, [highWing()]) as ValleyCut
    const top = (id: string, x: number, z: number): number => {
      const p = c.planes.find((q) => q.id === id) as ValleyCut['planes'][number]
      return p.datum.y - Math.tan((PITCH * Math.PI) / 180) * ((x - p.datum.x) * p.downslope.x + (z - p.datum.z) * p.downslope.z)
    }
    for (const [id, x, z] of [['roof-main-plane-low', 1, 3], ['roof-main-plane-low', 3.5, 9], ['roof-main-plane-high-0', 6, 0.5], ['roof-main-plane-high-1', 5, 9.5]] as const) expect(top(id, x, z)).toBeCloseTo(legacyTop(x), 9)
  })
  it('refuses, keeping the gable whole, eaves past the walls, edge members, and a house with no valley', () => {
    expect(valleyCutMainRoof({ ...main, overhangM: 0.5 }, [highWing()])).toMatchObject({ refused: expect.stringMatching(/project/) })
    expect(valleyCutMainRoof({ ...main, hasEdgeMembers: true }, [highWing()])).toMatchObject({ refused: expect.stringMatching(/edge members/) })
    const free = { ...highWing(), layout: attachedGableLayout({ x0: 9, z0: 0.5, x1: 13, z1: 9.5 }, 'X', PITCH, EAVE - 0.5, join) }
    expect(valleyCutMainRoof(main, [free])).toMatchObject({ refused: expect.stringMatching(/no wing/) })
    // a wing whose eaves stand 0.1 m off the main eaves lays valleys the two surfaces do not both pass through
    const off = { ...highWing(), layout: attachedGableLayout({ x0: 8, z0: 1, x1: 12, z1: 9 }, 'X', PITCH, EAVE - 0.1, join) }
    expect(valleyCutMainRoof(main, [off])).toMatchObject({ refused: expect.stringMatching(/apart at the end of a valley/) })
  })
  it('the roof as built: the wing’s underside in the cut, the main slope’s outside it; a wall across the cut is under it', () => {
    const w = highWing()
    const c = valleyCutMainRoof(main, [w]) as ValleyCut
    const drop = 0.28 / Math.cos((PITCH * Math.PI) / 180)
    // in the cut, 0.3 m in from the main eave on the wing's ridge line: the wing's ridge, not the main slope
    expect(builtRoofUndersideAt(c, [w], 7.7, 5)).toBeCloseTo(EAVE + 4 - drop, 6)
    expect(builtRoofUndersideAt(c, [w], 6, 0.5)).toBeCloseTo(legacyTop(6) - drop, 6)
    expect(segmentCrossesNotch({ x: 7.8, z: 1 }, { x: 7.8, z: 9 }, c)).toBe(true)
    expect(segmentCrossesNotch({ x: 7.8, z: 0 }, { x: 7.8, z: 0.9 }, c)).toBe(false)
  })
})

// --- through the emitter, the commands and the compiler ---------------------------------------------------------
const mass = (id: string, role: 'MAIN' | 'ATTACHED', x0: number, z0: number, x1: number, z1: number): MassV2 => ({ id, role, x0, z0, x1, z1, storeys: [0, 1], featureId: `f-${id}`, sourceMassId: `src-${id}` })
function building(wingBox: { x0: number; z0: number; x1: number; z1: number }, wingEave: number, mainExtra: Partial<BuildingV2['mainRoof'] & object> = {}): BuildingV2 {
  const layout = attachedGableLayout(wingBox, 'X', PITCH, wingEave, join)
  return {
    label: 'n8-03c',
    wallThicknessM: T,
    slabThicknessM: 0.25,
    levels: [0, 1].map((i) => ({ index: i, id: `lvl-${i}`, elevation: i * LEVEL1, height: i === 0 ? LEVEL1 : 5.6, wallTop: i * LEVEL1 + 2.65, featureId: `f-lvl-${i}` })),
    masses: [mass('main', 'MAIN', 0, 0, 8, 10), mass('attached-0', 'ATTACHED', wingBox.x0, wingBox.z0, wingBox.x1, wingBox.z1)],
    mainRoof: { massId: 'main', kind: 'GABLE', pitchDeg: PITCH, ridgeAxis: 'Z', ridgeAt: 4, eaveY: EAVE, ridgeY: EAVE + 4, footprint: main.footprint, coversZones: false, coversZonesWhy: 'test', buildUpVerticalM: 0.3, thicknessM: 0.28, authority: 'TEST', featureId: 'f-roof', provenance: 'SOURCE_DERIVED', ...mainExtra },
    attachedRoofs: [],
    pitchedAttachedRoofs: [{ massId: 'attached-0', kind: 'GABLE', ridgeAxis: 'X', pitchDeg: PITCH, pitchSource: 'STATED', eaveY: wingEave, ridgeY: layout.ridgeY, thicknessM: 0.28, footprint: wingBox, layout, form: { kind: 'GABLE', ridgeAxis: 'X', pitchDeg: PITCH, pitchSource: 'STATED', readings: [], confidence: 0.6, why: 'test' } as never, featureId: 'f-wing', provenance: 'SOURCE_DERIVED' }],
    recesses: [],
    returns: [],
    balconies: [],
    railings: [],
    portalHeads: [],
    verges: [],
    terraces: [],
    massTones: [],
    returnTones: [],
    facadeGraph: { nodes: [], edges: [] },
    chimneys: [],
    rooflights: [],
    openings: [],
    sharedDoors: [],
    interior: [],
    assemblies: [],
    surfaceRegions: [],
  }
}
function vertical(t: Triangle, x: number, z: number): boolean {
  const d = (a: { x: number; z: number }, b: { x: number; z: number }, p: { x: number; z: number }) => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x)
  const p = { x, z }
  const d1 = d(t.a, t.b, p)
  const d2 = d(t.b, t.c, p)
  const d3 = d(t.c, t.a, p)
  const area = d(t.a, t.b, t.c)
  if (Math.abs(area) < 1e-12) return false
  // on an edge counts: a point on a diagonal of one plate's triangulation is under that plate
  return (d1 >= -1e-9 && d2 >= -1e-9 && d3 >= -1e-9) || (d1 <= 1e-9 && d2 <= 1e-9 && d3 <= 1e-9)
}

describe('N8-03C: emitted, applied and compiled', () => {
  for (const [name, box, eave] of [['valleys meeting on the main ridge', { x0: 8, z0: 0.5, x1: 12, z1: 9.5 }, EAVE - 0.5], ['valleys meeting on the slope', { x0: 8, z0: 1.5, x1: 12, z1: 8.5 }, EAVE]] as const) {
    describe(name, () => {
      const applied = applyCommands(createEmptyModel('m', 'n8-03c'), emitBuilding(building(box, eave), 'n8-03c').program)
      const m = applied.model
      const scene = compileBuilding(m)
      it('every command applies and the model validates, and compiles with no diagnostic', () => {
        expect(applied.failedAt === undefined ? [] : applied.results[applied.failedAt]).toEqual([])
        expect(validateModel(m).issues.filter((i) => i.severity === 'ERROR')).toEqual([])
        expect(scene.diagnostics).toEqual([])
      })
      it('no legacy gable; the creases are stated: two VALLEY edges between the main plane and the wing’s', () => {
        expect(m.roofs).toEqual([])
        const valleys = m.roofEdges.filter((e) => e.kind === 'VALLEY')
        expect(valleys).toHaveLength(2)
        for (const v of valleys) expect(v.planeIds.some((p) => p.startsWith('roof-attached-0'))).toBe(true)
      })
      it('no roof stands inside another: over the main body one plate covers every point the wing’s roof does not', () => {
        const plates = new Map<string, Triangle[]>()
        for (const mesh of scene.meshes) if (mesh.part === 'ROOF_PLANE') plates.set(mesh.solidId, [...(plates.get(mesh.solidId) ?? []), ...mesh.triangles])
        let doubled = 0
        let bare = 0
        // a grid off every crease line (a point on a valley is on both plates' shared edge)
        for (let x = 0.1371; x < 8; x += 0.2917) {
          for (let z = 0.1093; z < 10; z += 0.3121) {
            const over = [...plates].filter(([, tris]) => tris.some((t) => vertical(t, x, z))).length
            if (over > 1) doubled += 1
            if (over === 0) bare += 1
          }
        }
        expect(doubled).toBe(0)
        expect(bare).toBe(0)
      })
      it('a wall of the main body under the cut dies into the wing’s planes; one outside it keeps the main slope only', () => {
        const east = m.walls.filter((w) => w.levelId === 'lvl-1' && w.id.startsWith('ring-main-1-w1'))
        expect(east.length).toBeGreaterThan(0)
        for (const w of east) expect(w.topProfile).toMatchObject({ kind: 'FOLLOW_ROOF_PLANES', planeIds: expect.arrayContaining(['roof-attached-0-plane-low', 'roof-attached-0-plane-high']) })
        const west = m.walls.find((w) => w.id === 'ring-main-1-w3')
        expect(west?.topProfile).toEqual({ kind: 'FOLLOW_ROOF_PLANES', planeIds: m.roofPlanes.filter((p) => p.id.startsWith('roof-main')).map((p) => p.id) })
      })
    })
  }
  it('with eaves projecting past the walls the gable is built whole, as before', () => {
    const b = building({ x0: 8, z0: 0.5, x1: 12, z1: 9.5 }, EAVE - 0.5, { eaves: { overhangM: 0.4, provenance: 'SOURCE_DERIVED', why: 'test' } })
    const r = emitBuilding(b, 'n8-03c')
    const m = applyCommands(createEmptyModel('m', 'n8-03c'), r.program).model
    expect(m.roofs.map((x) => x.id)).toEqual(['roof-main'])
    expect(r.notes.some((n) => /built whole/.test(n))).toBe(true)
  })
})
