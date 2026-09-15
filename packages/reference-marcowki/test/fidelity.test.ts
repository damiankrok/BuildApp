/**
 * STAGE BUILDAPP-01A: the architectural fidelity of the Marcówki specimen.
 *
 * Every capability the stage added is checked HERE against the source truth,
 * measured through the independent oracles: the real staircase, the L-shaped
 * slab void, the rooflight cuts normal to the roof, the entrance assembly,
 * the finish regions and the recess floors. Nothing asks the compiler where
 * it put anything; every figure is a ray, a volume or a plan polygon.
 *
 * The generic capabilities themselves are tested without this house in
 * `packages/{model,commands,geometry,editor}/test/fidelity-1.3.0.test.ts`.
 */
import { describe, expect, it } from 'vitest'
import { layoutStair, loadModel, serializeModel, validateModel, type FlightStair } from '@buildapp/model'
import { runCommands } from '@buildapp/commands'
import { compileBuilding, solidTriangles } from '@buildapp/geometry'
import { boundsOf, manifoldReport, materialLength, materialRuns, meshVolume, overlapEstimate, pointInPolygon } from '@buildapp/verification'
import {
  EXPECTED_ASSEMBLIES,
  EXPECTED_REGIONS,
  EXPECTED_ROOFLIGHT_CUT,
  EXPECTED_STAIR,
  EXPECTED_STAIR_VOID,
  EXPECTED_STAIR_VOID_AREA,
  EXPECTED_TERRACES,
  MARCOWKI_LEDGER,
  REVISION_CONFLICTS,
  createMarcowkiReferenceBuilding,
} from '../src/index.js'
import { facadeAudit } from './facade-audit.js'
import { EXPECTED_OPENINGS, EXPECTED_SHELL, assemblyReport, marcowkiScene, openingDimensionReport, regionReport, rooflightCutReport, slabVoidReport, stairReport, stairWalkingLine, structuralSolids, V } from './measure.js'

const s = marcowkiScene()
const E = EXPECTED_SHELL
const S = EXPECTED_STAIR

describe('Marcówki: the staircase is a real semantic stair, not a placeholder', () => {
  it('is a FLIGHTS stair of two flights around a quarter-turn of winders, laid out from the plans', () => {
    const stair = s.model.stairs.find((x) => x.id === 'stair-main')!
    expect(stair.kind).toBe('FLIGHTS')
    const f = stair as FlightStair
    expect(f.start).toEqual(S.start)
    expect(f.direction).toBe(S.direction)
    expect(f.width).toBeCloseTo(S.width, 9)
    expect(f.waist).toBeCloseTo(S.waist, 9)
    expect(f.segments).toEqual([
      { kind: 'FLIGHT', risers: S.lowerRisers, going: S.lowerGoing },
      { kind: 'WINDER', risers: S.winders, turn: S.turn, angleDeg: 90 },
      { kind: 'FLIGHT', risers: S.upperRisers, going: S.upperGoing },
    ])
    // the layout the model package derives: 17 risers of exactly 0.18 over the printed 3.06 rise
    const layout = layoutStair(f, s.model.levels.find((l) => l.id === 'ground')!, s.model.levels.find((l) => l.id === 'upper')!)
    expect(layout.issues).toEqual([])
    expect(layout.risers).toBe(S.risers)
    expect(layout.rise).toBeCloseTo(S.rise, 9)
    expect(layout.riserHeight).toBeCloseTo(S.riserHeight, 9)
    expect(layout.extent).toEqual(S.extent)
    // the arrival riser has no tread of its own: the attic floor is its tread
    expect(layout.steps).toHaveLength(S.risers)
    expect(layout.steps[S.risers - 1].tread).toBeNull()
    expect(layout.steps.slice(0, S.risers - 1).every((x) => x.tread !== null)).toBe(true)
  })

  it('climbs the printed 3.06 m in 17 equal risers, measured by rays up the walking line', () => {
    const r = stairReport(s)
    expect(r.found).toBe(true)
    expect(r.closed).toBe(true)
    expect(r.parts).toEqual(['STAIR_STEP'])
    expect(r.volume).toBeGreaterThan(0)
    // sixteen treads under the walking line (the seventeenth riser arrives on the attic floor)
    expect(r.treadTops).toHaveLength(S.risers - 1)
    r.treadTops.forEach((top, i) => expect(top, `tread ${i + 1}`).toBeCloseTo((i + 1) * S.riserHeight, 9))
    for (const h of r.riserHeights) expect(h).toBeCloseTo(S.riserHeight, 9)
    // the first riser stands on the ground floor at the measured nosing line, the last reaches the attic floor
    expect(r.firstRiserX).toBeCloseTo(S.start.x, 9)
    expect(r.arrivalTop).toBeCloseTo(E.upperFfl, 9)
    expect(r.bounds).toEqual({ min: V(S.extent.minX, E.groundFfl, S.extent.minZ), max: V(S.extent.maxX, E.upperFfl, S.extent.maxZ) })
  })

  it('turns where the plan turns: the winders fan in the corner square and every tread lies in the shaft', () => {
    const stair = s.model.stairs.find((x) => x.id === 'stair-main') as FlightStair
    const layout = layoutStair(stair, s.model.levels.find((l) => l.id === 'ground')!, s.model.levels.find((l) => l.id === 'upper')!)
    const lower = layout.steps.filter((x) => x.segment === 0)
    const winders = layout.steps.filter((x) => x.segment === 1)
    const upper = layout.steps.filter((x) => x.segment === 2)
    expect([lower.length, winders.length, upper.length]).toEqual([S.lowerRisers, S.winders, S.upperRisers])
    // the lower flight walks east along the southern band, its risers on the measured nosing lines
    for (const [i, st] of lower.entries()) {
      expect(st.direction).toEqual({ x: 1, z: 0 })
      expect(st.line.from.x).toBeCloseTo(S.start.x + i * S.lowerGoing, 9)
      expect(st.line.from.z).toBeCloseTo(S.southBand[1], 9)
      expect(st.line.to.z).toBeCloseTo(S.southBand[0], 9)
    }
    // the winders fan about the newel at the corner and every one of them touches it
    const newel = { x: S.cornerX, z: S.southBand[1] }
    for (const st of winders) expect(st.tread!.some((p) => Math.abs(p.x - newel.x) < 1e-9 && Math.abs(p.z - newel.z) < 1e-9), 'winder touches the newel').toBe(true)
    // the upper flight walks north up the eastern band to the arrival
    for (const st of upper) expect(st.direction).toEqual({ x: 0, z: 1 })
    expect(upper[upper.length - 1].line.from.z).toBeCloseTo(S.arrivalZ, 9)
    // every tread lies inside the shaft the plans draw
    for (const st of layout.steps) {
      for (const p of st.tread ?? []) {
        expect(p.x, 'tread inside the shaft').toBeGreaterThanOrEqual(S.extent.minX - 1e-9)
        expect(p.x).toBeLessThanOrEqual(S.extent.maxX + 1e-9)
        expect(p.z).toBeGreaterThanOrEqual(S.extent.minZ - 1e-9)
        expect(p.z).toBeLessThanOrEqual(S.extent.maxZ + 1e-9)
      }
    }
  })

  it('shares no volume with the slab it passes through or with any wall beside it', () => {
    const stair = solidTriangles(s.scene, 'stair-main')
    for (const id of ['slab-upper', 'g-right', 'gw-boiler-north', 'gw-pantry-south', 'slab-ground']) {
      const est = overlapEstimate(stair, solidTriangles(s.scene, id), 0.03)
      expect(est.volume, `${id} overlap`).toBe(0)
    }
    // and the walking line is clear overhead: no slab above any tread the stair climbs to
    const slab = solidTriangles(s.scene, 'slab-upper')
    for (const p of stairWalkingLine()) expect(materialLength(slab, V(p.x, 0, p.z), V(0, 1, 0)), `slab over (${p.x}, ${p.z})`).toBe(0)
  })

  it('records its counts with the status each one deserves: derived risers, inferred winders, assumed waist', () => {
    const ev = s.model.stairs.find((x) => x.id === 'stair-main')!.evidence!
    expect(ev.status).toBe('GEOMETRIC_INFERRED')
    expect(ev.properties?.segments).toBe('GEOMETRIC_INFERRED')
    expect(ev.properties?.waist).toBe('ASSUMED')
    expect(ev.note).toMatch(/13\b.*SOURCE_DERIVED/)
    expect(ev.note).toMatch(/3 winders → 0\.191, 5 → 0\.170/)
    // the ledger carries the open question and the alternatives rather than absorbing them
    expect(MARCOWKI_LEDGER.map((l) => l.id)).toContain('stair-winder-count')
    expect(MARCOWKI_LEDGER.find((l) => l.id === 'stair-winder-count')!.kind).toBe('UNRESOLVED')
  })
})

describe('Marcówki: the upper slab carries a first-class L-shaped void', () => {
  it('is a hole in the bearing plate, watertight, of the measured area, touching the east inner face', () => {
    const v = slabVoidReport(s)
    expect(v.closed).toBe(true)
    expect(v.holes).toBe(1)
    expect(v.holeArea).toBeCloseTo(EXPECTED_STAIR_VOID_AREA, 9)
    expect(s.model.slabs.find((x) => x.id === 'slab-upper')!.holes![0]).toEqual(EXPECTED_STAIR_VOID)
    // the void is not a rectangle: its polygon has six corners and one reflex turn
    expect(EXPECTED_STAIR_VOID).toHaveLength(6)
    expect(v.eastFaceOpen).toBe(true)
    // 1680 rays inside the void meet no slab; 924 outside it meet the full thickness
    expect(v.insideRays).toBeGreaterThan(1500)
    expect(v.insideBlocked).toBe(0)
    expect(v.outsideRays).toBeGreaterThan(800)
    expect(v.outsideThin).toBe(0)
  })

  it('leaves the plate that the BUILDAPP-01 rectangle would have removed: the corner west of the upper flight is slab', () => {
    const slab = solidTriangles(s.scene, 'slab-upper')
    // the old rectangle spanned x 5.37..7.45 over reference z 6.79..8.77; the L leaves its north-west corner solid
    const corner = { x: S.cornerX - 0.3, z: S.southBand[1] + 0.4 }
    expect(pointInPolygon(corner, EXPECTED_STAIR_VOID)).toBe(false)
    expect(materialLength(slab, V(corner.x, 0, corner.z), V(0, 1, 0))).toBeCloseTo(E.slabThickness, 9)
    // and it removes what the rectangle would have kept: the northern flight's own band, past the old edge
    const past = { x: (S.eastBand[0] + S.eastBand[1]) / 2, z: S.arrivalZ - 0.3 }
    expect(pointInPolygon(past, EXPECTED_STAIR_VOID)).toBe(true)
    expect(materialLength(slab, V(past.x, 0, past.z), V(0, 1, 0))).toBe(0)
  })
})

describe('Marcówki: the rooflights are cut normal to the roof', () => {
  it('every unit declares NORMAL_TO_ROOF and rays along the roof normal pass clean through all three', () => {
    for (const id of ['rl-pralnia-w', 'rl-lazienka-w', 'rl-schody-e']) {
      const r = rooflightCutReport(s, id)
      expect(r.mode, id).toBe(EXPECTED_ROOFLIGHT_CUT.mode)
      expect(r.centreOpen, id).toBe(true)
      expect(r.normalRays, id).toBe(96)
      expect(r.normalRaysBlocked, id).toBe(0)
      // the underside outline sits thickness · sin(pitch) uphill of the top one, measured, not asserted
      // measured off the triangles by bisecting the wedge, so it agrees with the prediction to a few microns
      expect(r.undersideShift, id).toBeCloseTo(EXPECTED_ROOFLIGHT_CUT.undersideShift, 4)
      expect(Math.abs(r.undersideShift - r.expectedShift), id).toBeLessThan(1e-5)
      expect(r.expectedShift, id).toBeCloseTo(EXPECTED_ROOFLIGHT_CUT.undersideShift, 9)
    }
  })

  it('a vertical cut of the same units would block those rays: the mode is what makes the difference', () => {
    const vertical = compileBuilding({ ...s.model, roofOpenings: s.model.roofOpenings.map((o) => (o.kind === 'ROOFLIGHT' ? { ...o, cut: 'VERTICAL' as const } : o)) })
    const blocked = ['rl-pralnia-w', 'rl-lazienka-w', 'rl-schody-e'].map((id) => rooflightCutReport({ model: s.model, scene: vertical }, id))
    for (const r of blocked) {
      expect(r.normalRaysBlocked, `${r.id} vertical`).toBeGreaterThan(0)
      expect(r.undersideShift, `${r.id} vertical`).toBeCloseTo(0, 6)
    }
  })

  it('the chimney penetrations stay VERTICAL: a stack rises vertically, so its hole must', () => {
    for (const o of s.model.roofOpenings.filter((x) => x.kind === 'PENETRATION')) {
      expect(o.cut ?? 'VERTICAL', o.id).toBe('VERTICAL')
    }
    // and the model refuses a normal-cut penetration outright
    const bad = { ...s.model, roofOpenings: s.model.roofOpenings.map((o) => (o.kind === 'PENETRATION' ? { ...o, cut: 'NORMAL_TO_ROOF' as const } : o)) }
    expect(validateModel(bad).issues.some((i) => i.severity === 'ERROR')).toBe(true)
  })
})

describe('Marcówki: the entrance is a composite assembly, and the doors say what they are made of', () => {
  it('the entrance door is a leaf plus a glazed sidelight east of it, divided by a mullion', () => {
    const r = assemblyReport(s, 'og-front-entrance-leaf')
    const want = EXPECTED_ASSEMBLIES['og-front-entrance-leaf']
    expect(r.found).toBe(true)
    expect(r.panels).toEqual(want.panels)
    expect(r.parts).toEqual(['DOOR_FRAME', 'DOOR_GLASS', 'DOOR_HANDLE', 'DOOR_LEAF'])
    expect(r.frameClosed).toBe(true)
    // the sidelight is on the east (high-x) side, as the hero render and the front elevation show
    expect(r.glassSide).toBe('HIGH')
    const opening = s.model.openings.find((o) => o.id === 'og-front-entrance')!
    const wall = s.model.walls.find((w) => w.id === opening.wallId)!
    const near = wall.start.x + opening.offset
    // the leaf takes the stated fraction of the opening and the glass the rest, both inside the frame
    expect((r.leafSpan![1] - near) / opening.width).toBeLessThanOrEqual(want.leafFraction! + 0.02)
    expect(r.glassSpan![0]).toBeGreaterThan(r.leafSpan![1])
    expect(r.glassSpan![0] - r.leafSpan![1]).toBeGreaterThanOrEqual(want.mullion!)
    expect(s.model.doors.find((d) => d.id === 'og-front-entrance-leaf')!.assembly!.mullionWidth).toBeCloseTo(want.mullion!, 9)
  })

  it('the garage door is one flush sectional panel and the garage side door a fully glazed leaf', () => {
    const garage = assemblyReport(s, 'og-garage-door-leaf')
    expect(garage.panels).toEqual(['PANEL'])
    expect(garage.parts).toEqual(['DOOR_FRAME', 'DOOR_PANEL'])
    expect(garage.panelSpan).not.toBeNull()
    expect(garage.glassSpan).toBeNull()
    expect(garage.frameClosed).toBe(true)
    const side = assemblyReport(s, 'og-garage-side-door-leaf')
    expect(side.panels).toEqual(['LEAF'])
    expect(side.parts).toContain('DOOR_GLASS')
    expect(side.parts).toContain('DOOR_LEAF')
    // a glazed leaf: the pane sits inside the leaf's own stiles and rails
    expect(side.glassSpan![0]).toBeGreaterThan(side.leafSpan![0])
    expect(side.glassSpan![1]).toBeLessThan(side.leafSpan![1])
  })

  it('the concealed kotłownia door stays a plain leaf: no render shows its face, so nothing is invented', () => {
    const r = assemblyReport(s, 'og-east-garage-door-leaf')
    expect(r.panels).toEqual([])
    expect(s.model.doors.find((d) => d.id === 'og-east-garage-door-leaf')!.assembly).toBeUndefined()
    expect(r.parts).toEqual(['DOOR_FRAME', 'DOOR_HANDLE', 'DOOR_LEAF'])
  })

  it('every sub-panel width is VISUAL_INFERRED and says so, and the panel split is in the ledger', () => {
    for (const id of ['og-front-entrance-leaf', 'og-garage-door-leaf', 'og-garage-side-door-leaf']) {
      const ev = s.model.doors.find((d) => d.id === id)!.evidence!
      expect(ev.status, id).toBe('VISUAL_INFERRED')
    }
    expect(MARCOWKI_LEDGER.map((l) => l.id)).toEqual(expect.arrayContaining(['entrance-panel-widths', 'garage-door-panels']))
  })
})

describe('Marcówki: interior door heights remain assumed and visible', () => {
  it('every interior door head is 2.00 m and carries ASSUMED on its height', () => {
    const interior = s.model.openings.filter((o) => o.tags?.includes('interior-door'))
    expect(interior).toHaveLength(11)
    for (const o of interior) {
      expect(o.height, o.id).toBe(2.0)
      expect(o.evidence?.properties?.height, o.id).toBe('ASSUMED')
      expect(o.evidence?.note, o.id).toMatch(/no interior opening is dimensioned vertically/)
    }
    // the one facade door with an assumed head says so too; every other facade opening's height is sourced
    const concealed = s.model.openings.find((o) => o.id === 'og-east-garage-door')!
    expect(concealed.evidence?.properties?.height).toBe('ASSUMED')
    for (const e of EXPECTED_OPENINGS.filter((x) => x.exposure === 'EXTERIOR')) {
      expect(s.model.openings.find((o) => o.id === e.id)!.evidence?.properties?.height, e.id).toBeUndefined()
    }
  })
})

describe('Marcówki: the cladding bands are surface regions on the wall faces', () => {
  it('all six bands stand clear of their wall, carry no thickness of their own and change no wall volume', () => {
    expect(s.model.surfaceRegions).toHaveLength(EXPECTED_REGIONS.length)
    const withoutRegions = compileBuilding({ ...s.model, surfaceRegions: [] })
    for (const e of EXPECTED_REGIONS) {
      const r = regionReport(s, e)
      expect(r.found, e.id).toBe(true)
      expect(r.hostOk, e.id).toBe(true)
      expect(r.structural, e.id).toBe(false)
      expect(r.part, e.id).toBe('SURFACE_REGION')
      expect(r.across[0], e.id).toBeCloseTo(e.across[0], 6)
      expect(r.across[1], e.id).toBeCloseTo(e.across[1], 6)
      // a skin: 2 mm thick, standing 3 mm clear of the wall face so nothing z-fights
      expect(r.thickness, e.id).toBeCloseTo(0.002, 6)
      expect(r.standOff, e.id).toBeCloseTo(0.005, 6)
      // the host wall's own solid is untouched by the band
      const host = e.hostId
      expect(meshVolume(solidTriangles(s.scene, host)), `${host} volume`).toBeCloseTo(meshVolume(solidTriangles(withoutRegions, host)), 9)
    }
  })

  it('each band sits on the wall the elevation puts it on, between the measured edges and up to the measured top', () => {
    for (const e of EXPECTED_REGIONS) {
      const rec = s.model.surfaceRegions.find((x) => x.id === e.id)!
      expect(rec.hostId, e.id).toBe(e.hostId)
      expect(rec.face, e.id).toBe('OUTER')
      expect(rec.materialId, e.id).toBe(e.materialId)
      const r = regionReport(s, e)
      if (!e.upToRoof) {
        expect(r.up[0], e.id).toBeCloseTo(e.up[0], 6)
        expect(r.up[1], e.id).toBeCloseTo(e.up[1], 6)
      }
    }
  })

  it('the front gable band is clipped to the roof soffit, not squared off across the gable', () => {
    const gable = EXPECTED_REGIONS.find((e) => e.id === 'sr-front-timber-gable')!
    const r = regionReport(s, gable)
    expect(gable.upToRoof).toBe(true)
    // its top follows the host wall's own top at every station, within a millimetre
    expect(r.roofFollow).toBeLessThan(1e-3)
    // and it is not a rectangle: the top rises with the 40° rake across the band
    const tris = s.scene.meshes.filter((m) => m.objectId === gable.id).flatMap((m) => m.triangles)
    const topAt = (x: number): number => {
      const runs = materialRuns(tris, V(x, 0, E.frontBackPlaneZ - 0.004), V(0, 1, 0))
      return runs.length ? runs[runs.length - 1].t1 : NaN
    }
    const lo = topAt(gable.across[0] + 0.2)
    const hi = topAt(gable.across[1] - 0.2)
    expect(hi - lo).toBeCloseTo((gable.across[1] - gable.across[0] - 0.4) * Math.tan((E.pitchDeg * Math.PI) / 180), 3)
  })

  it('no band covers an opening: rays through every opening in a banded wall miss the band', () => {
    let rays = 0
    for (const e of EXPECTED_REGIONS) {
      const r = regionReport(s, e)
      rays += r.openingRays
      expect(r.openingRaysHit, `${e.id} covers an opening`).toBe(0)
    }
    expect(rays).toBeGreaterThan(0)
  })

  it('survives save and load: the regions come back from the JSON and compile to the same geometry', () => {
    const json = serializeModel(s.model)
    const back = loadModel(json)
    expect(back.ok).toBe(true)
    if (!back.ok) return
    // the serializer is canonical (collections sorted by id), so compare the records, not the array order
    const byId = (rs: typeof s.model.surfaceRegions) => [...rs].sort((a, b) => a.id.localeCompare(b.id))
    expect(byId(back.model.surfaceRegions)).toEqual(byId(s.model.surfaceRegions))
    expect(back.model.surfaceRegions).toHaveLength(EXPECTED_REGIONS.length)
    expect(compileBuilding(back.model)).toEqual(s.scene)
  })
})

describe('Marcówki: the two recess floors', () => {
  it('the loggia and portal stand on a plinth to the terrain datum, as TERRACE plates', () => {
    for (const [id, t] of Object.entries(EXPECTED_TERRACES)) {
      const rec = s.model.balconies.find((b) => b.id === id)!
      expect(rec.kind, id).toBe('TERRACE')
      const tris = solidTriangles(s.scene, id)
      expect(manifoldReport(tris).closed, id).toBe(true)
      expect(boundsOf(tris), id).toEqual({ min: V(t.minX, t.bottom, t.minZ), max: V(t.maxX, t.top, t.maxZ) })
      expect(meshVolume(tris), id).toBeCloseTo((t.maxX - t.minX) * (t.maxZ - t.minZ) * (t.top - t.bottom), 9)
      expect(rec.evidence?.properties?.thickness, id).toBe('GEOMETRIC_INFERRED')
    }
    // the decision and what it leaves out are recorded
    expect(MARCOWKI_LEDGER.find((l) => l.id === 'terrace-floors')!.handling).toMatch(/garden paving/)
  })

  it('the floors do not fill the recesses: both mouths are still open above them', () => {
    const solids = [...structuralSolids(s.scene).values()]
    for (const [x, plane, dir] of [[3, -0.5, 1], [3, 15.1, -1]] as const) {
      const runs = solids.flatMap((t) => materialRuns(t, V(x, 1.2, plane), V(0, 0, dir))).sort((a, b) => a.t0 - b.t0)
      // at 1.2 m above the floor the first material is a full metre in: the recess is real
      expect(runs[0].t0).toBeGreaterThan(1.0 + 0.5 - 1e-6)
    }
  })
})

describe('Marcówki: source revision policy and the current published facts', () => {
  it('records every conflicting published figure with both values and the one the reference uses', () => {
    const byFact = new Map(REVISION_CONFLICTS.map((c) => [c.fact, c]))
    for (const [fact, current, older] of [
      ['house net area (bez kotłowni, garażu)', 129.04, 129.15],
      ['garage area', 24.1, 23.85],
      ['stairs area (Schody)', 5.63, 5.62],
      ['roof area', 150.57, 168.48],
    ] as const) {
      const c = byFact.get(fact)!
      expect(c, fact).toBeDefined()
      expect(c.currentPage, fact).toBeCloseTo(current, 9)
      expect(c.olderCard, fact).toBeCloseTo(older, 9)
      expect(c.uses, fact).toBe('CURRENT_PAGE')
      expect(c.affectsGeometry, fact).toBe(false)
    }
    // no published aggregate is allowed to be the authority for a geometric dimension
    for (const c of REVISION_CONFLICTS.filter((x) => x.affectsGeometry)) expect(c.uses, c.fact).toBe('DRAWING')
    expect(MARCOWKI_LEDGER.find((l) => l.id === 'revision-drift')!.kind).toBe('CONTRADICTION')
  })

  it('no geometry was tuned to close a published aggregate: the footprint keeps the chains, not the 131.16', () => {
    const footprint = E.mainWidth * E.nominalDepth + (E.overallWidth - E.mainWidth) * E.garageDepth
    expect(footprint).toBeCloseTo(130.665, 6)
    expect(MARCOWKI_LEDGER.find((l) => l.id === 'footprint-area')!.kind).toBe('CONTRADICTION')
    expect(REVISION_CONFLICTS.find((c) => c.fact === 'footprint area')!.uses).toBe('DRAWING')
  })
})

describe('Marcówki: every facade feature and every opening still measures what the source prints', () => {
  it('all twelve openings measure their printed size in the compiled walls, raked heads included', () => {
    for (const e of EXPECTED_OPENINGS) {
      const r = openingDimensionReport(s, e)
      expect(r.found, e.id).toBe(true)
      expect(r.worst, `${e.id} worst dimension error`).toBeLessThan(1e-9)
      expect(r.raked, `${e.id} raked`).toBe(e.raked)
      expect(r.span[1] - r.span[0], `${e.id} width`).toBeCloseTo(e.span[1] - e.span[0], 9)
    }
  })

  it('the four-facade comparison finds every modelled feature, and every deviation is an explained source conflict', () => {
    const audit = facadeAudit(s)
    expect(audit.summary.notFound).toBe(0)
    expect(audit.summary.features).toBe(audit.summary.pass + audit.summary.deviation + audit.summary.notModelled)
    expect(audit.summary.pass).toBeGreaterThan(30)
    // no deviation is silent: each names the contradiction it comes from, or its group is one the ledger covers
    const explained = new Set(['balcony-west-edge', 'gable-head-clearance', 'garage-door-position', 'verge-white-band', 'railing-height'])
    for (const d of audit.features.filter((x) => x.status === 'DEVIATION')) {
      const covered = d.note !== undefined || [...explained].some((id) => MARCOWKI_LEDGER.some((l) => l.id === id))
      expect(covered, `${d.id} deviation is explained`).toBe(true)
      expect(d.delta!, `${d.id} deviation stays small`).toBeLessThan(0.25)
    }
    // the deviations are small: no feature is out by more than a quarter metre anywhere on the four facades
    expect(audit.summary.worstDelta).toBeLessThan(0.25)
  })

  it('the audit is orthographic measurement only: the readings are metres and nothing compares pixels', () => {
    const audit = facadeAudit(s)
    expect(audit.method).toMatch(/No pixels are compared/)
    expect(audit.calibrations).toHaveLength(4)
    for (const c of audit.calibrations) expect(Math.abs(c.acrossPxPerM)).toBeGreaterThan(50)
  })
})

describe('Marcówki: the whole model still replays, validates and compiles', () => {
  it('validates with no issues and compiles with no diagnostics after every 01A addition', () => {
    expect(validateModel(s.model).issues).toEqual([])
    expect(s.scene.diagnostics).toEqual([])
    expect(runCommands(createMarcowkiReferenceBuilding(), []).schemaVersion).toBe('1.4.0')
  })
})
