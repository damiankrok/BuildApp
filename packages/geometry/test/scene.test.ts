import { describe, expect, it } from 'vitest'
import { createDemoBuilding } from '@buildapp/demo'
import { findObject, serializeModel } from '@buildapp/model'
import { boundsOf, boxesOverlap, manifoldReport, materialLength, meshVolume, overlapEstimate } from '@buildapp/verification'
import { compileBuilding, solidTriangles } from '../src/index.js'
import { V, withGround } from './helpers.js'

/** Penetrations the demo states on purpose: a chimney passes through the roof (no roof cut yet). */
const KNOWN_PENETRATIONS = new Set(['chimney-1|roof-main'])

describe('compiled demo scene', () => {
  const model = createDemoBuilding()
  const scene = compileBuilding(model)

  it('compiles without diagnostics and every mesh maps back to a semantic object', () => {
    expect(scene.diagnostics).toEqual([])
    expect(scene.meshes.length).toBeGreaterThan(0)
    for (const m of scene.meshes) {
      const hit = findObject(model, m.objectId)
      expect(hit, `mesh owner ${m.objectId}`).toBeDefined()
      expect(hit!.kind).toBe(m.objectKind)
      if (m.hostWallId) expect(findObject(model, m.hostWallId)?.kind).toBe('wall')
      if (m.openingId) expect(findObject(model, m.openingId)?.kind).toBe('opening')
    }
    expect(scene.stats.objectCount).toBeGreaterThanOrEqual(model.walls.length + model.openings.length + model.windows.length + model.doors.length)
  })

  it('every structural solid is closed, consistently wound and has positive volume', () => {
    const solids = [...new Set(scene.meshes.filter((m) => m.structural).map((m) => m.solidId))]
    expect(solids.length).toBeGreaterThanOrEqual(model.walls.length + model.slabs.length + model.roofs.length)
    for (const id of solids) {
      const tris = solidTriangles(scene, id)
      const r = manifoldReport(tris)
      expect(r, id).toMatchObject({ closed: true, boundaryEdges: 0, duplicateEdges: 0 })
      expect(meshVolume(tris), id).toBeGreaterThan(0)
    }
  })

  it('every fill is closed and sits inside its opening on its host wall', () => {
    for (const m of scene.meshes.filter((x) => x.objectKind === 'window' || x.objectKind === 'door')) {
      expect(manifoldReport(m.triangles), `${m.objectId} ${m.part}`).toMatchObject({ closed: true })
      expect(m.hostWallId).toBeDefined()
      expect(m.openingId).toBeDefined()
      const opening = model.openings.find((o) => o.id === m.openingId)!
      expect(opening.wallId).toBe(m.hostWallId)
      if (m.part === 'DOOR_LEAF' || m.part === 'DOOR_HANDLE') continue // may swing out of the opening
      const wallTris = solidTriangles(scene, m.hostWallId!)
      const b = boundsOf(m.triangles)!
      const wb = boundsOf(wallTris)!
      // inside the host wall's box, which the opening is cut from
      expect(b.min.x).toBeGreaterThanOrEqual(wb.min.x - 1e-9)
      expect(b.max.x).toBeLessThanOrEqual(wb.max.x + 1e-9)
      expect(b.min.z).toBeGreaterThanOrEqual(wb.min.z - 1e-9)
      expect(b.max.z).toBeLessThanOrEqual(wb.max.z + 1e-9)
      // and never inside wall material: sample the fill's box corners against the wall solid
      for (const p of [b.min, b.max, V(b.min.x, b.max.y, b.min.z), V(b.max.x, b.min.y, b.max.z)]) {
        const eps = 1e-6
        const inside = V(p.x === b.min.x ? p.x + eps : p.x - eps, p.y === b.min.y ? p.y + eps : p.y - eps, p.z === b.min.z ? p.z + eps : p.z - eps)
        const runs = materialLength(wallTris, V(inside.x, -10, inside.z), V(0, 1, 0))
        // the vertical line through a fill corner crosses wall material only below the sill and above the head
        expect(runs).toBeLessThan(wb.max.y - wb.min.y)
      }
    }
  })

  it('every opening in the model is really cut: no wall material through its centre', () => {
    for (const o of model.openings) {
      const wall = model.walls.find((w) => w.id === o.wallId)!
      const level = model.levels.find((l) => l.id === wall.levelId)!
      const L = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z)
      const ux = (wall.end.x - wall.start.x) / L
      const uz = (wall.end.z - wall.start.z) / L
      // outward normal is up x u
      const nx = uz
      const nz = -ux
      const a = o.offset + o.width / 2
      const y = level.elevation + wall.baseOffset + o.sill + o.height / 2
      const origin = V(wall.start.x + ux * a + nx * 2, y, wall.start.z + uz * a + nz * 2)
      const dir = V(-nx, 0, -nz)
      const tris = solidTriangles(scene, wall.id)
      expect(materialLength(tris, origin, dir), `opening ${o.id}`).toBe(0)
      // beside the opening, the wall is there
      const beside = V(wall.start.x + ux * (o.offset - 0.05) + nx * 2, y, wall.start.z + uz * (o.offset - 0.05) + nz * 2)
      expect(materialLength(tris, beside, dir), `beside ${o.id}`).toBeCloseTo(wall.thickness, 9)
      expect(scene.meshes.some((m) => m.part === 'WALL_REVEAL' && m.objectId === o.id && m.hostWallId === wall.id)).toBe(true)
    }
  })

  it('independent structural elements do not share volume (except the stated penetrations)', () => {
    const solids = [...new Set(scene.meshes.filter((m) => m.structural).map((m) => m.solidId))].sort()
    const bounds = new Map(solids.map((id) => [id, boundsOf(solidTriangles(scene, id))!]))
    const found: string[] = []
    for (let i = 0; i < solids.length; i++) {
      for (let j = i + 1; j < solids.length; j++) {
        if (!boxesOverlap(bounds.get(solids[i])!, bounds.get(solids[j])!)) continue
        const est = overlapEstimate(solidTriangles(scene, solids[i]), solidTriangles(scene, solids[j]), 0.1)
        if (est.volume > 1e-6 || est.worstSharedLength > 1e-6) found.push(`${solids[i]}|${solids[j]}`)
      }
    }
    expect(found.sort()).toEqual([...KNOWN_PENETRATIONS].sort())
  })

  it('walls of one storey stand on the storey below with no seam and no overlap', () => {
    const lower = solidTriangles(scene, 'g-left')
    const upper = solidTriangles(scene, 'u-left')
    const l = boundsOf(lower)!
    const u = boundsOf(upper)!
    expect(u.min.y).toBeCloseTo(l.max.y, 12)
  })

  it('geometry is a pure function of the model', () => {
    const again = compileBuilding(createDemoBuilding())
    expect(again).toEqual(scene)
    expect(serializeModel(model)).toBe(serializeModel(createDemoBuilding()))
  })

  it('slabs, balconies, chimneys and railings are independent semantic objects', () => {
    for (const kind of ['slab', 'balcony', 'chimney', 'railing', 'room', 'stair'] as const) {
      const meshes = scene.meshes.filter((m) => m.objectKind === kind)
      expect(meshes.length, kind).toBeGreaterThan(0)
    }
    const slab = solidTriangles(scene, 'slab-upper')
    expect(meshVolume(slab)).toBeCloseTo(9.4 * 7.4 * 0.25, 9)
    const chimney = solidTriangles(scene, 'chimney-1')
    expect(boundsOf(chimney)).toEqual({ min: V(7, 3, 3), max: V(7.6, 9, 3.6) })
    const balcony = solidTriangles(scene, 'balcony-rear')
    expect(boundsOf(balcony)).toEqual({ min: V(3, 2.8, 8), max: V(7, 3, 9.5) })
    const railing = scene.meshes.filter((m) => m.objectId === 'rail-rear')
    expect(railing.map((m) => m.part).sort()).toEqual(['RAILING_INFILL', 'RAILING_POST', 'RAILING_RAIL'])
    for (const m of railing) expect(manifoldReport(m.triangles).closed).toBe(true)
  })

  it('an invalid model is not compiled', () => {
    const broken = { ...model, openings: [...model.openings, { ...model.openings[0], id: 'dup' }] }
    const s = compileBuilding(broken)
    expect(s.meshes).toEqual([])
    expect(s.diagnostics[0].code).toBe('MODEL_INVALID')
  })
})

describe('slab polygons', () => {
  it('extrudes an L-shaped slab into a closed solid with the right volume', () => {
    const scene = compileBuilding(
      withGround({
        type: 'createSlab',
        id: 's',
        levelId: 'ground',
        polygon: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 4 }, { x: 6, z: 4 }, { x: 6, z: 8 }, { x: 0, z: 8 }],
        topOffset: 0,
        thickness: 0.3,
      }),
    )
    const tris = solidTriangles(scene, 's')
    expect(manifoldReport(tris)).toMatchObject({ closed: true, boundaryEdges: 0, duplicateEdges: 0 })
    expect(meshVolume(tris)).toBeCloseTo((10 * 4 + 6 * 4) * 0.3, 9)
    expect(materialLength(tris, V(8, -1, 6), V(0, 1, 0))).toBe(0)
    expect(materialLength(tris, V(3, -1, 6), V(0, 1, 0))).toBeCloseTo(0.3, 9)
  })
})
