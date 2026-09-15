import { describe, expect, it } from 'vitest'
import { compileBuilding, solidTriangles } from '@buildapp/geometry'
import { boundsOf, manifoldReport, materialLength, materialRuns, meshVolume, overlapEstimate } from '@buildapp/verification'
import { EXPECTED_ROOFLIGHT_ROOMS, EXPECTED_STAIR, EXPECTED_STAIR_VOID, EXPECTED_STAIR_VOID_AREA, EXPECTED_TERRACES } from '../src/index.js'
import { EXPECTED_SHELL, marcowkiScene, railingReport, roomAt, slabVoidReport, structuralSolids, V, verticalRuns } from './measure.js'

const s = marcowkiScene()
const E = EXPECTED_SHELL

describe('Marcówki balconies, portal, railings', () => {
  it('the balcony slabs and the portal head are closed solids of the measured extent and volume', () => {
    const front = solidTriangles(s.scene, 'balcony-front')
    const rear = solidTriangles(s.scene, 'balcony-rear')
    const head = solidTriangles(s.scene, 'portal-head')
    for (const [id, t] of [['balcony-front', front], ['balcony-rear', rear], ['portal-head', head]] as const) expect(manifoldReport(t).closed, id).toBe(true)
    expect(meshVolume(front)).toBeCloseTo(E.balconyFrontVolume, 9)
    expect(meshVolume(rear)).toBeCloseTo(E.balconyRearVolume, 9)
    expect(meshVolume(head)).toBeCloseTo(E.portalHeadVolume, 9)
    expect(boundsOf(front)).toEqual({ min: V(3.338, E.balconyTop - E.balconyThickness, E.frontOuterPlaneZ), max: V(E.mainWidth, E.balconyTop, E.frontBackPlaneZ) })
    expect(boundsOf(rear)).toEqual({ min: V(E.rearRecessX[0], E.balconyTop - E.balconyThickness, E.rearBackPlaneZ), max: V(E.rearRecessX[1], E.balconyTop, E.rearOuterPlaneZ) })
    expect(boundsOf(head)).toEqual({ min: V(E.mainWidth, E.portalSoffit, E.frontOuterPlaneZ), max: V(E.frontRecessX[1], E.portalHeadTop, E.frontBackPlaneZ) })
    // the whole front zone above the portal floor is open below the portal soffit / balcony soffit: a vertical probe from the ground meets nothing before 2.41
    for (const x of [1, 3, 5, 7.5, 9, 11]) {
      const runs = verticalRuns(s, x, 0.5).filter((r) => r.y1 > 1e-9)
      expect(runs.length > 0 ? runs[0].y0 : Infinity, `x ${x}`).toBeGreaterThanOrEqual(E.portalSoffit - 1e-9)
      // the portal floor: the plinth from the terrain datum to ±0,00
      const floor = verticalRuns(s, x, 0.5)[0]
      expect(floor.y0, `floor at x ${x}`).toBeCloseTo(E.terrain, 9)
      expect(floor.y1, `floor at x ${x}`).toBeCloseTo(E.groundFfl, 9)
    }
    for (const [id, t] of Object.entries(EXPECTED_TERRACES)) {
      const tris = solidTriangles(s.scene, id)
      expect(manifoldReport(tris).closed, id).toBe(true)
      expect(boundsOf(tris), id).toEqual({ min: V(t.minX, t.bottom, t.minZ), max: V(t.maxX, t.top, t.maxZ) })
      expect(s.model.balconies.find((b) => b.id === id)!.kind).toBe('TERRACE')
    }
    // the east front return stands on the balcony: its base is the slab top
    const ret = boundsOf(solidTriangles(s.scene, 'ret-east-front'))!
    expect(ret.min.y).toBeCloseTo(E.balconyTop, 9)
  })

  it('the portal mouth: 0 of 66 rays blocked at the outer plane, jambs and head are the named returns and slabs', () => {
    const solids = [...structuralSolids(s.scene).values()]
    let blocked = 0
    let rays = 0
    for (const y of [0.4, 1.2, 2.0, 2.3]) {
      for (let i = 0; i < 16; i++) {
        const x = E.frontRecessX[0] + 0.05 + ((E.frontRecessX[1] - E.frontRecessX[0] - 0.1) * (i + 0.5)) / 16
        rays++
        for (const t of solids) if (materialLength(t, V(x, y, -0.5), V(0, 0, 1)) > 0 && materialRuns(t, V(x, y, -0.5), V(0, 0, 1))[0].t0 < 0.5 + 1e-6) blocked++
      }
    }
    expect(rays).toBe(64)
    expect(blocked).toBe(0)
    // the jambs: 1.00 m of material just outside each side of the mouth, from the outer plane
    for (const x of [E.frontRecessX[0] - 0.3, E.frontRecessX[1] + 0.3]) {
      const runs = solids.map((t) => materialRuns(t, V(x, 1.2, -0.5), V(0, 0, 1))).flat().sort((a, b) => a.t0 - b.t0)
      expect(runs[0].t0).toBeCloseTo(0.5, 9)
      expect(runs[0].t1 - runs[0].t0).toBeCloseTo(1.0, 9)
    }
    // the head over the mouth's centre at the garage: the portal head; over the balcony part: the slab (above the portal floor)
    const above = (x: number) => verticalRuns(s, x, 0.5).filter((r) => r.y1 > 1e-9)
    expect(above(9.5)[0]).toMatchObject({ y0: expect.closeTo(E.portalSoffit, 9), y1: expect.closeTo(E.portalHeadTop, 9) })
    expect(above(5)[0]).toMatchObject({ y0: expect.closeTo(E.portalSoffit, 9), y1: expect.closeTo(E.balconyTop, 9) })
  })

  it('the balustrades are glass: four panels each, glass over more than 85 % of the run, posts the only gaps', () => {
    const front = railingReport(s, 'rail-front')
    const rear = railingReport(s, 'rail-rear')
    expect(front.run[0]).toBeCloseTo(E.railingFrontRun[0], 6)
    expect(front.run[1]).toBeCloseTo(E.railingFrontRun[1], 6)
    expect(rear.run[0]).toBeCloseTo(E.railingRearRun[0], 6)
    expect(rear.run[1]).toBeCloseTo(E.railingRearRun[1], 6)
    for (const r of [front, rear]) {
      expect(r.coverage).toBeGreaterThan(0.85)
      expect(r.longestGap).toBeLessThan(0.12)
      expect(r.glassParts).toBe(1)
      expect(r.base).toBeCloseTo(E.balconyTop, 9)
      expect(r.top).toBeCloseTo(E.balconyTop + E.railingHeight, 9)
    }
    const posts = s.scene.meshes.find((m) => m.objectId === 'rail-front' && m.part === 'RAILING_POST')!
    // five posts, four panels: the two end posts are clipped to half width at the run's ends, so four full posts of volume
    expect(meshVolume(posts.triangles)).toBeCloseTo(4 * 0.05 * 0.05 * E.railingHeight, 6)
    expect(s.model.railings.every((r) => r.infill === 'GLASS')).toBe(true)
  })
})

describe('Marcówki roof features and slabs', () => {
  it('two chimney stacks pass through modelled penetrations: no shared volume, roof material right beside each', () => {
    const roof = solidTriangles(s.scene, 'roof-main')
    for (const c of s.model.chimneys) {
      const stack = solidTriangles(s.scene, c.id)
      expect(manifoldReport(stack).closed).toBe(true)
      const b = boundsOf(stack)!
      expect(b.max.y).toBeCloseTo(E.chimneyTop, 9)
      expect(b.min.y).toBeCloseTo(E.upperFfl, 9)
      const est = overlapEstimate(roof, stack, 0.02)
      expect(est.volume, c.id).toBe(0)
      expect(est.worstSharedLength, c.id).toBe(0)
      const cx = (c.footprint.minX + c.footprint.maxX) / 2
      const cz = (c.footprint.minZ + c.footprint.maxZ) / 2
      expect(materialLength(roof, V(cx, 0, cz), V(0, 1, 0))).toBe(0)
      expect(materialLength(roof, V(c.footprint.maxX + 0.01, 0, cz), V(0, 1, 0))).toBeCloseTo(E.roofVerticalDrop, 6)
      expect(materialLength(roof, V(cx, 0, c.footprint.minZ - 0.01), V(0, 1, 0))).toBeCloseTo(E.roofVerticalDrop, 6)
      const pen = s.model.roofOpenings.find((o) => o.throughId === c.id)!
      expect(pen.kind).toBe('PENETRATION')
      expect(pen.footprint).toEqual(c.footprint)
    }
    expect(manifoldReport(roof).closed).toBe(true)
  })

  it('three rooflights are real cuts of the printed 78/118 units, each over the room the attic plan puts it in', () => {
    const roof = solidTriangles(s.scene, 'roof-main')
    const cos = Math.cos((E.pitchDeg * Math.PI) / 180)
    for (const [id, roomId] of Object.entries(EXPECTED_ROOFLIGHT_ROOMS)) {
      const o = s.model.roofOpenings.find((x) => x.id === id)!
      expect(o.kind).toBe('ROOFLIGHT')
      expect(o.footprint.maxZ - o.footprint.minZ).toBeCloseTo(0.78, 9)
      expect(o.footprint.maxX - o.footprint.minX).toBeCloseTo(1.18 * cos, 4)
      const cx = (o.footprint.minX + o.footprint.maxX) / 2
      const cz = (o.footprint.minZ + o.footprint.maxZ) / 2
      expect(materialLength(roof, V(cx, 0, cz), V(0, 1, 0)), `${id} hole`).toBe(0)
      expect(materialLength(roof, V(cx, 0, o.footprint.maxZ + 0.02), V(0, 1, 0)), `${id} roof beside`).toBeCloseTo(E.roofVerticalDrop, 6)
      // the unit's lower edge is 0.45 m in from the eave, the wall's inner face
      const lower = cx < E.mainWidth / 2 ? o.footprint.minX : E.mainWidth - o.footprint.maxX
      expect(lower).toBeCloseTo(0.45, 9)
      // the fill: closed frame and glass inside the cut, glass only through the pane centre
      const parts = s.scene.meshes.filter((m) => m.openingId === id && !m.structural)
      expect(parts.map((p) => p.part).sort()).toEqual(['ROOFLIGHT_FRAME', 'ROOFLIGHT_GLASS'])
      for (const p of parts) expect(manifoldReport(p.triangles).closed, p.part).toBe(true)
      const glass = parts.find((p) => p.part === 'ROOFLIGHT_GLASS')!.triangles
      const frame = parts.find((p) => p.part === 'ROOFLIGHT_FRAME')!.triangles
      expect(materialLength(glass, V(cx, 0, cz), V(0, 1, 0))).toBeCloseTo(0.024, 9)
      expect(materialLength(frame, V(cx, 0, cz), V(0, 1, 0))).toBe(0)
      // the room below, by point-in-polygon on the attic
      expect(roomAt(s.model, 'upper', { x: cx, z: cz }), id).toBe(roomId)
    }
  })

  it('the upper slab bears inside the walls with the L-shaped stair void as a hole that touches the east face; the ground slab reaches the terrain', () => {
    const slab = solidTriangles(s.scene, 'slab-upper')
    expect(manifoldReport(slab).closed).toBe(true)
    const inner = (E.mainWidth - 2 * E.wallThickness) * (E.nominalDepth - 2 * E.wallThickness)
    expect(EXPECTED_STAIR_VOID_AREA).toBeCloseTo(2.08 * 0.99 + 0.99 * 2.12, 9)
    expect(meshVolume(slab)).toBeCloseTo((inner - EXPECTED_STAIR_VOID_AREA) * E.slabThickness, 9)
    const v = slabVoidReport(s)
    expect(v.holes).toBe(1)
    expect(v.holeArea).toBeCloseTo(EXPECTED_STAIR_VOID_AREA, 9)
    expect(v.insideRays).toBeGreaterThan(1500)
    expect(v.insideBlocked).toBe(0)
    expect(v.outsideRays).toBeGreaterThan(800)
    expect(v.outsideThin).toBe(0)
    expect(v.eastFaceOpen).toBe(true)
    const shaft = EXPECTED_STAIR.extent
    expect(materialLength(slab, V(shaft.minX - 0.2, 0, (shaft.minZ + shaft.maxZ) / 2), V(0, 1, 0))).toBeCloseTo(E.slabThickness, 9)
    expect(materialLength(slab, V((shaft.minX + shaft.maxX) / 2, 0, shaft.maxZ + 0.2), V(0, 1, 0))).toBeCloseTo(E.slabThickness, 9)
    // the corner of the shaft the L leaves out (west of the eastern band, north of the southern band) is slab
    expect(materialLength(slab, V(EXPECTED_STAIR.cornerX - 0.2, 0, EXPECTED_STAIR.southBand[1] + 0.5), V(0, 1, 0))).toBeCloseTo(E.slabThickness, 9)
    const b = boundsOf(slab)!
    expect(b.max.y).toBeCloseTo(E.upperFfl, 9)
    expect(b.min.y).toBeCloseTo(E.upperFfl - E.slabThickness, 9)
    expect([b.min.x, b.max.x, b.min.z, b.max.z]).toEqual([E.wallThickness, E.mainWidth - E.wallThickness, E.frontBackPlaneZ + E.wallThickness, E.rearBackPlaneZ - E.wallThickness])
    // the stair occupies the shaft and the attic stair compartment lies over it
    const stair = s.model.stairs[0]
    expect(stair.kind).toBe('FLIGHTS')
    expect(stair.footprint).toEqual(shaft)
    expect(s.model.slabs.find((x) => x.id === 'slab-upper')!.holes![0]).toEqual(EXPECTED_STAIR_VOID)
    expect(roomAt(s.model, 'upper', { x: (EXPECTED_STAIR.eastBand[0] + EXPECTED_STAIR.eastBand[1]) / 2, z: (shaft.minZ + shaft.maxZ) / 2 })).toBe('u-stairs')
    const ground = boundsOf(solidTriangles(s.scene, 'slab-ground'))!
    expect(ground.min.y).toBeCloseTo(E.terrain, 9)
    expect(ground.max.y).toBeCloseTo(E.groundFfl, 9)
  })

  it('the garage flat roof, walls and the main body wall meet without gap or overlap', () => {
    const garageRoof = solidTriangles(s.scene, 'roof-garage')
    const runs = verticalRuns(s, 10, 5)
    // ground slab, then nothing until the garage roof at 2.54..2.88
    expect(runs.map((r) => [Number(r.y0.toFixed(6)), Number(r.y1.toFixed(6))])).toEqual([[E.terrain, E.groundFfl], [E.garageWallTop, E.garageRoofTop]])
    expect(boundsOf(garageRoof)).toEqual({ min: V(E.mainWidth, E.garageWallTop, E.frontBackPlaneZ), max: V(E.overallWidth, E.garageRoofTop, E.frontBackPlaneZ + E.garageDepth) })
    void compileBuilding
  })
})
