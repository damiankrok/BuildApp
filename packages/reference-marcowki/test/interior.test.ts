import { describe, expect, it } from 'vitest'
import { validateModel, wallLength } from '@buildapp/model'
import { solidTriangles } from '@buildapp/geometry'
import { boundsOf, manifoldReport, materialLength, overlapEstimate, pointInPolygon } from '@buildapp/verification'
import { EXPECTED_INTERIOR_DOORS, EXPECTED_ROOMS } from '../src/index.js'
import { EXPECTED_SHELL, marcowkiScene, roomsEitherSide, structuralSolids, V } from './measure.js'

const s = marcowkiScene()
const E = EXPECTED_SHELL

describe('Marcówki interior', () => {
  it('eighteen rooms on the right levels, every polygon simple and inside its storey envelope', () => {
    expect(s.model.rooms).toHaveLength(18)
    for (const r of s.model.rooms) {
      expect(EXPECTED_ROOMS[r.id], r.id).toBe(r.levelId)
      for (const p of r.polygon) {
        expect(p.x, r.id).toBeGreaterThanOrEqual(E.wallThickness - 1e-9)
        expect(p.x, r.id).toBeLessThanOrEqual(r.id === 'g-garage' ? E.overallWidth - E.wallThickness + 1e-9 : E.mainWidth - E.wallThickness + 1e-9)
        expect(p.z, r.id).toBeGreaterThanOrEqual(E.frontBackPlaneZ + E.wallThickness - 1e-9)
        expect(p.z, r.id).toBeLessThanOrEqual(E.rearBackPlaneZ - E.wallThickness + 1e-9)
      }
      expect(s.scene.meshes.some((m) => m.objectId === r.id && m.part === 'ROOM_FLOOR'), r.id).toBe(true)
    }
    // no two rooms on a level overlap: every grid point inside a room's polygon lies in that polygon alone
    // (a centroid is no use here: the notched garderoba polygons are not convex)
    for (const r of s.model.rooms) {
      const xs = r.polygon.map((p) => p.x)
      const zs = r.polygon.map((p) => p.z)
      let inside = 0
      for (let i = 0; i < 12; i++) {
        for (let j = 0; j < 12; j++) {
          const c = { x: Math.min(...xs) + ((Math.max(...xs) - Math.min(...xs)) * (i + 0.5)) / 12, z: Math.min(...zs) + ((Math.max(...zs) - Math.min(...zs)) * (j + 0.5)) / 12 }
          if (!pointInPolygon(c, r.polygon)) continue
          inside++
          const hits = s.model.rooms.filter((o) => o.levelId === r.levelId && pointInPolygon(c, o.polygon))
          expect(hits.map((h) => h.id), `${r.id} at ${c.x.toFixed(2)}, ${c.z.toFixed(2)}`).toEqual([r.id])
        }
      }
      expect(inside, r.id).toBeGreaterThan(20)
    }
    // the published area of the exact rectangles is reproduced by the finished-surface rule (20 mm per face)
    const area = (poly: ReadonlyArray<{ x: number; z: number }>): number => Math.abs(poly.reduce((a, p, i) => a + (p.x * poly[(i + 1) % poly.length].z - poly[(i + 1) % poly.length].x * p.z), 0) / 2)
    const nw = s.model.rooms.find((r) => r.id === 'u-pokoj-nw')!
    const A = area(nw.polygon)
    const P = 2 * (3.44 + 4.49)
    expect(A - P * 0.02 + 4 * 0.02 * 0.02).toBeCloseTo(15.13, 2)
  })

  it('every interior partition is a closed solid inside the shell, touching but never overlapping it or another wall', () => {
    expect(validateModel(s.model).issues.filter((i) => i.code === 'WALLS_OVERLAP')).toEqual([])
    const exterior = s.model.walls.filter((w) => w.kind === 'EXTERIOR').map((w) => solidTriangles(s.scene, w.id))
    for (const w of s.model.walls.filter((x) => x.kind === 'INTERIOR')) {
      const t = solidTriangles(s.scene, w.id)
      expect(manifoldReport(t).closed, w.id).toBe(true)
      const b = boundsOf(t)!
      expect(b.min.x, w.id).toBeGreaterThanOrEqual(E.wallThickness - 1e-9)
      expect(b.max.x, w.id).toBeLessThanOrEqual(E.mainWidth - E.wallThickness + 1e-9)
      expect(b.min.z, w.id).toBeGreaterThanOrEqual(E.frontBackPlaneZ + E.wallThickness - 1e-9)
      expect(b.max.z, w.id).toBeLessThanOrEqual(E.rearBackPlaneZ - E.wallThickness + 1e-9)
      for (const ext of exterior) {
        const est = overlapEstimate(t, ext, 0.05)
        expect(est.worstSharedLength, w.id).toBe(0)
      }
      // ground partitions reach the slab underside, attic partitions the 2.60 cap or the soffit
      const level = s.model.levels.find((l) => l.id === w.levelId)!
      if (w.levelId === 'ground') expect(b.max.y, w.id).toBeCloseTo(E.upperFfl - E.slabThickness, 9)
      else expect(b.max.y, w.id).toBeLessThanOrEqual(level.elevation + 2.6 + 1e-9)
    }
    // the attic corridor-south partition follows the soffit where the roof is below the 2.60 cap
    const cs = solidTriangles(s.scene, 'uw-corridor-south')
    const tan = Math.tan((E.pitchDeg * Math.PI) / 180)
    expect(materialLength(cs, V(4, -1, 4.76), V(0, 1, 0))).toBeCloseTo(2.6, 9)
    expect(materialLength(cs, V(7.3, -1, 4.76), V(0, 1, 0))).toBeCloseTo(1.3 + tan * (E.mainWidth - 7.3), 4)
    // a T-junctioned partition's end lies on the exterior wall's inner face, in contact
    const ks = solidTriangles(s.scene, 'gw-kitchen-south')
    expect(boundsOf(ks)!.min.x).toBeCloseTo(E.wallThickness, 9)
    expect(structuralSolids(s.scene).size).toBeGreaterThan(40)
  })

  it('eleven interior doors are real cuts between exactly the two rooms the plans connect', () => {
    for (const [id, [a, b]] of Object.entries(EXPECTED_INTERIOR_DOORS)) {
      const o = s.model.openings.find((x) => x.id === id)!
      expect(o.kind).toBe('DOOR')
      const w = s.model.walls.find((x) => x.id === o.wallId)!
      const t = solidTriangles(s.scene, w.id)
      const L = wallLength(w)
      const ux = (w.end.x - w.start.x) / L
      const uz = (w.end.z - w.start.z) / L
      const c = o.offset + o.width / 2
      // heights are taken from the storey the wall stands on (the attic doors sit 3.06 m up)
      const base = s.model.levels.find((l) => l.id === w.levelId)!.elevation + w.baseOffset
      const origin = V(w.start.x + ux * c + uz * 1, base + 1.0, w.start.z + uz * c - ux * 1)
      const dir = V(-uz, 0, ux)
      expect(materialLength(t, origin, dir), `${id} through`).toBe(0)
      const beside = V(w.start.x + ux * (o.offset - 0.06) + uz * 1, base + 1.0, w.start.z + uz * (o.offset - 0.06) - ux * 1)
      expect(materialLength(t, beside, dir), `${id} beside`).toBeCloseTo(w.thickness, 9)
      const above = V(w.start.x + ux * c + uz * 1, base + o.height + 0.08, w.start.z + uz * c - ux * 1)
      expect(materialLength(t, above, dir), `${id} above`).toBeCloseTo(w.thickness, 9)
      expect(o.height).toBeGreaterThanOrEqual(2.0)
      const rooms = roomsEitherSide(s.model, o)
      expect([...rooms].sort(), id).toEqual([a, b].sort())
      expect(s.model.doors.some((d) => d.openingId === id)).toBe(true)
    }
  })
})
