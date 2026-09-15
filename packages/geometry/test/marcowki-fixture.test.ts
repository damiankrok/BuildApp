import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseModel } from '@buildapp/model'
import { compileBuilding, solidTriangles } from '../src/index.js'
import { boundsOf, manifoldReport, materialLength, unionMaterialRuns } from '@buildapp/verification'

/**
 * The Marcówki reference compiled from its saved JSON alone. No import of the
 * reference package: the compiler sees an ordinary model and must reproduce
 * the characteristic depth and the recesses from the records in the file.
 */
const FIXTURE = resolve(import.meta.dirname, '../../model/test/fixtures/marcowki-ge-1.2.0.json')

describe('Marcówki from JSON alone', () => {
  const model = parseModel(readFileSync(FIXTURE, 'utf8'))
  const scene = compileBuilding(model)

  it('compiles without diagnostics into one tagged scene', () => {
    expect(scene.diagnostics).toEqual([])
    expect(scene.stats.triangleCount).toBeGreaterThan(3000)
    expect(scene.stats.objectCount).toBeGreaterThan(100)
    const ids = new Set([model.building!.id, ...[...model.walls, ...model.openings, ...model.windows, ...model.doors, ...model.slabs, ...model.roofs, ...model.roofOpenings, ...model.rooflights, ...model.balconies, ...model.railings, ...model.chimneys, ...model.stairs, ...model.rooms, ...model.levels].map((o) => o.id)])
    for (const mesh of scene.meshes) expect(ids.has(mesh.objectId), mesh.objectId).toBe(true)
  })

  it('measures 14.60 m front to rear over 12.60 m of walls, with 1.00 m recesses at both ends', () => {
    const b = scene.bounds!
    expect(b.max.z - b.min.z).toBeCloseTo(14.6, 9)
    expect(b.max.x - b.min.x).toBeCloseTo(12.05, 9)
    // the ring walls stop 1.00 m short of both outer planes
    const ring = model.wallRings.flatMap((r) => r.wallIds)
    let zMin = Infinity
    let zMax = -Infinity
    for (const id of ring) {
      const wb = boundsOf(solidTriangles(scene, id))!
      zMin = Math.min(zMin, wb.min.z)
      zMax = Math.max(zMax, wb.max.z)
    }
    expect(zMin - b.min.z).toBeCloseTo(1.0, 9)
    expect(b.max.z - zMax).toBeCloseTo(1.0, 9)
    expect(zMax - zMin).toBeCloseTo(12.6, 9)
    // a ray into the front recess at ground level meets the first material 1.00 m behind the outer plane; beside the mouth, at the plane
    const solids = [...new Set(scene.meshes.filter((m) => m.structural).map((m) => m.solidId))].map((id) => solidTriangles(scene, id))
    const first = (x: number, z0: number, dz: number): number => unionMaterialRuns(solids, { x, y: 1.2, z: z0 }, { x: 0, y: 0, z: dz })[0]?.t0 ?? Infinity
    // (x 1.0 at the front is wall between the room window and the entrance; x 7.1 at the rear is wall east of the living glazing)
    expect(first(1.0, b.min.z - 0.5, 1)).toBeCloseTo(1.5, 9)
    expect(first(0.3, b.min.z - 0.5, 1)).toBeCloseTo(0.5, 9)
    expect(first(7.1, b.max.z + 0.5, -1)).toBeCloseTo(1.5, 9)
    expect(first(0.3, b.max.z + 0.5, -1)).toBeCloseTo(0.5, 9)
  })

  it('every structural solid in the file is closed and the roof is a 40° gable', () => {
    for (const id of new Set(scene.meshes.filter((m) => m.structural).map((m) => m.solidId))) expect(manifoldReport(solidTriangles(scene, id)).closed, id).toBe(true)
    const roof = solidTriangles(scene, 'roof-main')
    const rb = boundsOf(roof)!
    expect(rb.max.y).toBeCloseTo(7.95, 5)
    // the roof underside rises with the 40° pitch: two probes 1 m apart differ by tan 40°
    const under = (x: number): number => unionMaterialRuns([roof], { x, y: 0, z: 7 }, { x: 0, y: 1, z: 0 })[0].t0
    expect(under(2) - under(1)).toBeCloseTo(Math.tan((40 * Math.PI) / 180), 6)
    expect(materialLength(roof, { x: 2, y: 0, z: 7 }, { x: 0, y: 1, z: 0 })).toBeGreaterThan(0.2)
  })
})
