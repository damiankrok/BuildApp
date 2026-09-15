import { describe, expect, it } from 'vitest'
import { solidTriangles } from '@buildapp/geometry'
import { boundsOf, manifoldReport, materialLength, meshVolume } from '@buildapp/verification'
import { EXPECTED_OPENINGS, EXPECTED_SHELL, marcowkiScene, openingNearIsLow, openingReport, roomBehindOpening, V } from './measure.js'

const s = marcowkiScene()
const E = EXPECTED_SHELL

describe('Marcówki facade openings: twelve structural holes', () => {
  it('lists the twelve source-supported openings, eleven exposed and one concealed, on the facades the plans put them on', () => {
    const facade = s.model.openings.filter((o) => o.tags?.includes('facade'))
    expect(facade.map((o) => o.id).sort()).toEqual(EXPECTED_OPENINGS.map((o) => o.id).sort())
    expect(EXPECTED_OPENINGS.filter((o) => o.exposure === 'EXTERIOR')).toHaveLength(11)
    for (const e of EXPECTED_OPENINGS) expect(s.model.openings.find((o) => o.id === e.id)!.wallId, e.id).toBe(e.wallId)
    // per facade: FRONT 4 (room window, entrance, garage door, gable glazing), REAR 3, EAST 1 + 1 concealed, WEST 2, garage north 1
    const count = (f: string, exposure?: string): number => EXPECTED_OPENINGS.filter((o) => o.facade === f && (!exposure || o.exposure === exposure)).length
    expect([count('FRONT'), count('REAR'), count('EAST', 'EXTERIOR'), count('EAST', 'CONCEALED'), count('WEST'), count('GARAGE_NORTH')]).toEqual([4, 3, 1, 1, 2, 1])
  })

  for (const e of EXPECTED_OPENINGS) {
    it(`${e.id} (${e.printed ?? 'not printed'}): a real hole through ${e.wallId}, wall beside and above it, fill hosted inside it`, () => {
      const r = openingReport(s, e)
      expect(r.found).toBe(true)
      expect(r.through, 'material through the opening').toBe(0)
      expect(r.beside, 'material beside the jamb').toBeCloseTo(e.thickness, 9)
      expect(r.above, 'material above the head').toBeCloseTo(e.thickness, 9)
      expect(r.fillParts).toBeGreaterThan(0)
      expect(r.fillHost).toBe(true)
      expect(r.fillInside).toBe(true)
      expect(r.leaves).toBe(1)
      const fill = e.fill === 'window' ? s.model.windows.find((w) => w.openingId === e.id) : s.model.doors.find((d) => d.openingId === e.id)
      expect(fill, 'a fill of the right kind').toBeDefined()
      // the reveal meshes belong to the opening and close the host wall's solid
      const reveals = s.scene.meshes.filter((m) => m.part === 'WALL_REVEAL' && m.objectId === e.id)
      expect(reveals).toHaveLength(1)
      expect(reveals[0]).toMatchObject({ hostWallId: e.wallId, solidId: e.wallId })
      expect(manifoldReport(solidTriangles(s.scene, e.wallId)).closed).toBe(true)
      // the source rectangle: through its centre nothing, at its four edges (2 cm in) nothing, 4 cm outside the wall
      const [u0, u1] = e.span
      const low = e.sill
      const high = Math.min(e.headNear, e.headFar)
      const alongX = e.facade === 'FRONT' || e.facade === 'REAR' || e.facade === 'GARAGE_NORTH'
      const outside = e.facePlane + e.outward
      const ray = (u: number, y: number): number => (alongX ? materialLength(solidTriangles(s.scene, e.wallId), V(u, y, outside), V(0, 0, -e.outward)) : materialLength(solidTriangles(s.scene, e.wallId), V(outside, y, u), V(-e.outward, 0, 0)))
      for (const [u, y] of [
        [u0 + 0.02, (low + high) / 2],
        [u1 - 0.02, (low + high) / 2],
        [(u0 + u1) / 2, low + 0.02],
        [(u0 + u1) / 2, high - 0.02],
      ]) {
        expect(ray(u, y), `inside at ${u.toFixed(3)}, ${y.toFixed(3)}`).toBe(0)
      }
      expect(ray(u0 - 0.04, (low + high) / 2)).toBeCloseTo(e.thickness, 9)
      expect(ray(u1 + 0.04, (low + high) / 2)).toBeCloseTo(e.thickness, 9)
      const wall = s.model.walls.find((w) => w.id === e.wallId)!
      const base = s.model.levels.find((l) => l.id === wall.levelId)!.elevation + wall.baseOffset
      if (e.sill - base > 0.05) expect(ray((u0 + u1) / 2, e.sill - 0.04)).toBeCloseTo(e.thickness, 9)
      if (e.raked) expect(r.headError, 'worst raked head error against the printed callout and pitch').toBeLessThan(1e-6)
    })
  }

  it('each opening looks into the room the source names, by point-in-polygon 0.33 m inside the host wall', () => {
    const table = EXPECTED_OPENINGS.map((e) => ({ id: e.id, claims: e.roomId, found: roomBehindOpening(s.model, e) }))
    for (const row of table) expect(row.found, row.id).toBe(row.claims)
    expect(table).toHaveLength(12)
  })

  it('the kotłownia door is one 0.45 m leaf cut right through: a ray from the garage to the boiler room meets no wall', () => {
    const e = EXPECTED_OPENINGS.find((o) => o.id === 'og-east-garage-door')!
    const mid = (e.span[0] + e.span[1]) / 2
    // every wall standing in the house/garage plane x 7.45..7.90 at the door's depth: the ray from the garage into the boiler room
    const plane = s.model.walls.filter((w) => Math.min(w.start.x, w.end.x) >= 7.4 && Math.max(w.start.x, w.end.x) <= 8.4 && Math.min(w.start.z, w.end.z) <= mid && Math.max(w.start.z, w.end.z) >= mid)
    expect(plane.map((w) => w.id)).toEqual(['g-right', 'u-right'])
    let total = 0
    for (const w of plane) total += materialLength(solidTriangles(s.scene, w.id), V(9, 1.0, mid), V(-1, 0, 0))
    expect(total).toBe(0)
    // and 6 cm beside it, exactly one leaf, the 0.45 m wall
    let beside = 0
    for (const w of plane) beside += materialLength(solidTriangles(s.scene, w.id), V(9, 1.0, e.span[1] + 0.06), V(-1, 0, 0))
    expect(beside).toBeCloseTo(E.wallThickness, 9)
  })

  it("the three raked gable openings: fills stay under the head line, the wall closes over each with at least 1.05 m of material", async () => {
    const tan = Math.tan((E.pitchDeg * Math.PI) / 180)
    for (const e of EXPECTED_OPENINGS.filter((o) => o.raked)) {
      const wall = solidTriangles(s.scene, e.wallId)
      const fills = s.scene.meshes.filter((m) => m.openingId === e.id && !m.structural).flatMap((m) => m.triangles)
      expect(manifoldReport(wall).closed).toBe(true)
      const [u0, u1] = e.span
      const nearIsLow = openingNearIsLow(s.model, e)
      for (let k = 0; k <= 10; k++) {
        const f = 0.05 + (k / 10) * 0.9
        const u = u0 + f * (u1 - u0)
        const hLow = nearIsLow ? e.headNear : e.headFar
        const hHigh = nearIsLow ? e.headFar : e.headNear
        const h = hLow + f * (hHigh - hLow)
        const outside = e.facePlane + e.outward
        const dir = V(0, 0, -e.outward)
        expect(materialLength(fills, V(u, h + 0.01, outside), dir), `fill above the head at ${u.toFixed(2)}`).toBe(0)
        expect(materialLength(wall, V(u, h - 0.02, outside), dir), `wall just under the head at ${u.toFixed(2)}`).toBe(0)
        expect(materialLength(wall, V(u, h + 0.02, outside), dir), `wall just over the head at ${u.toFixed(2)}`).toBeCloseTo(e.thickness, 9)
        // glass a little below the head, inside the frame
        expect(materialLength(fills, V(u, h - 0.2, outside), dir), `fill under the head at ${u.toFixed(2)}`).toBeGreaterThan(0)
        // the roof underside is a constant distance above the rear gable heads (the source's 1.05 m), and clears the front one
        const soffit = E.eaveUnderside + tan * Math.min(u, E.mainWidth - u)
        expect(soffit - h).toBeGreaterThan(1.0)
      }
      // the wall lost exactly the trapezoid the callout describes
      const w = u1 - u0
      const trapezoid = ((e.headNear - e.sill + (e.headFar - e.sill)) / 2) * w * e.thickness
      const without = solidTriangles(
        (await import('@buildapp/geometry')).compileBuilding({ ...s.model, openings: s.model.openings.filter((o) => o.id !== e.id), windows: s.model.windows.filter((x) => x.openingId !== e.id) }),
        e.wallId,
      )
      expect(meshVolume(without) - meshVolume(wall)).toBeCloseTo(trapezoid, 6)
      // the fill's bounds sit in the trapezoid's rectangle hull and inside the wall thickness
      const fb = boundsOf(fills)!
      const wb = boundsOf(wall)!
      expect(fb.min.z).toBeGreaterThanOrEqual(wb.min.z - 1e-9)
      expect(fb.max.z).toBeLessThanOrEqual(wb.max.z + 1e-9)
    }
  })
})
