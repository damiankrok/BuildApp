/**
 * The mutation catalogue: thirteen ways the Marcówki model could quietly go
 * wrong, each applied to the real model and each caught by a NAMED checker
 * from `./measure.ts` (or the generic model validator) that passes on the
 * unmutated model. A checker that cannot tell the mutation from the
 * reference would be a checker measuring nothing; this file is the proof
 * that every metric in the stage's reports has teeth.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyModel, validateModel, type CanonicalBuildingModel } from '@buildapp/model'
import { applyCommand, runCommands, type BuildingCommand } from '@buildapp/commands'
import { compileBuilding, solidTriangles } from '@buildapp/geometry'
import { boundsOf, materialLength, meshVolume, overlapEstimate } from '@buildapp/verification'
import { createMarcowkiReferenceBuilding } from '../src/index.js'
import { EXPECTED_OPENINGS, EXPECTED_SHELL, depthReport, marcowkiScene, openingReport, railingReport, recessReport, roofReport, roomBehindOpening, structuralSolids, V, verticalRuns, type Scene } from './measure.js'

const E = EXPECTED_SHELL
const reference = createMarcowkiReferenceBuilding()
const base = marcowkiScene(reference)

/** Apply DSL commands to the reference; they must all succeed. */
function mutate(...commands: BuildingCommand[]): CanonicalBuildingModel {
  return runCommands(reference, commands)
}

/** A direct record edit for mutations the DSL would (rightly) refuse. */
function edit(fn: (m: CanonicalBuildingModel) => void): CanonicalBuildingModel {
  const m = structuredClone(reference)
  fn(m)
  return m
}

type Catalogue = { n: number; name: string; checker: string; mutant: () => CanonicalBuildingModel; caught: (s: Scene) => boolean }

const CATALOGUE: Catalogue[] = [
  {
    n: 1,
    name: 'front recess flattened: the facade brought flush to the outer plane',
    checker: 'recessReport(FRONT).atOuterPlane / shallowest',
    // an infill wall standing on the outer plane across the main body's part of the mouth (x 0.61..7.29), under the balcony
    mutant: () => mutate({ type: 'createWall', id: 'mut-flush-front', levelId: 'ground', start: { x: E.frontRecessX[0], z: E.frontOuterPlaneZ }, end: { x: E.mainWidth - E.returnThickness, z: E.frontOuterPlaneZ }, thickness: 0.45, height: 2.3 }),
    caught: (s) => {
      const r = recessReport(s, 'FRONT')
      return r.atOuterPlane > 0 || r.shallowest < r.statedDepth - 1e-3
    },
  },
  {
    n: 2,
    name: 'rear recess halved: the rear wall moved 0.55 m out, the returns shortened to suit',
    checker: 'recessReport(REAR).nearerThanStated + depthReport.rearZone',
    mutant: () =>
      edit((m) => {
        for (const id of ['g-rear', 'u-rear']) {
          const w = m.walls.find((x) => x.id === id)!
          w.start = { ...w.start, z: w.start.z + 0.55 }
          w.end = { ...w.end, z: w.end.z + 0.55 }
        }
        // the side walls follow so the rings still close
        for (const id of ['g-right', 'u-right']) m.walls.find((x) => x.id === id)!.end.z += 0.55
        for (const id of ['g-left', 'u-left']) m.walls.find((x) => x.id === id)!.start.z += 0.55
        for (const id of ['ret-west-rear', 'ret-east-rear']) {
          const w = m.walls.find((x) => x.id === id)!
          if (w.start.z < w.end.z) w.start = { ...w.start, z: w.start.z + 0.55 }
          else w.end = { ...w.end, z: w.end.z + 0.55 }
        }
        m.rooms.filter((r) => r.polygon.some((p) => p.z > 13.1)).forEach((r) => (r.polygon = r.polygon.map((p) => (p.z > 13.1 ? { ...p, z: p.z + 0.55 } : p))))
        for (const w of m.walls.filter((x) => x.kind === 'INTERIOR' && Math.max(x.start.z, x.end.z) > 13.1)) {
          if (w.start.z > w.end.z) w.start = { ...w.start, z: w.start.z + 0.55 }
          else w.end = { ...w.end, z: w.end.z + 0.55 }
        }
        const slab = m.slabs.find((s) => s.id === 'slab-upper')!
        slab.polygon = slab.polygon.map((p) => (p.z > 13.1 ? { ...p, z: p.z + 0.55 } : p))
      }),
    caught: (s) => recessReport(s, 'REAR').nearerThanStated > 0 && Math.abs(depthReport(s).rearZone - E.rearZone) > 1e-6,
  },
  {
    n: 3,
    name: 'a facade opening removed (the west kitchen window)',
    checker: 'openingReport.found + facade count',
    mutant: () => mutate({ type: 'removeFeature', targetId: 'og-west-kitchen-window' }),
    caught: (s) => !openingReport(s, EXPECTED_OPENINGS.find((o) => o.id === 'og-west-kitchen-window')!).found || s.model.openings.filter((o) => o.tags?.includes('facade')).length !== 12,
  },
  {
    n: 4,
    name: 'fill kept but the cut removed: the window record survives without its opening',
    checker: 'validateModel → UNKNOWN_OPENING (the compiler then refuses the model)',
    mutant: () => edit((m) => (m.openings = m.openings.filter((o) => o.id !== 'og-west-kitchen-window'))),
    caught: (s) => validateModel(s.model).issues.some((i) => i.code === 'UNKNOWN_OPENING' && i.severity === 'ERROR') && s.scene.diagnostics.some((d) => d.code === 'MODEL_INVALID'),
  },
  {
    n: 5,
    name: 'an opening moved to the wrong facade: the kitchen window re-hosted on the east wall at the same offset',
    checker: 'openingReport.through on the expected wall + expected host wall id',
    mutant: () => edit((m) => (m.openings.find((o) => o.id === 'og-west-kitchen-window')!.wallId = 'g-right')),
    caught: (s) => {
      const e = EXPECTED_OPENINGS.find((o) => o.id === 'og-west-kitchen-window')!
      const o = s.model.openings.find((x) => x.id === e.id)!
      // the ray across the WEST wall where the source puts the window now meets 0.45 m of material
      const west = solidTriangles(s.scene, e.wallId)
      const mid = (e.span[0] + e.span[1]) / 2
      return o.wallId !== e.wallId && materialLength(west, V(e.facePlane + e.outward, (e.sill + e.headNear) / 2, mid), V(-e.outward, 0, 0)) > 0.4
    },
  },
  {
    n: 6,
    name: 'the front balcony removed',
    checker: 'verticalRuns at the balcony + structuralSolids',
    mutant: () => mutate({ type: 'removeFeature', targetId: 'balcony-front' }),
    caught: (s) => {
      const runs = verticalRuns(s, 5, 0.5).filter((r) => r.y1 > 0)
      const hasSoffit = runs.some((r) => Math.abs(r.y0 - E.portalSoffit) < 1e-6 && Math.abs(r.y1 - E.balconyTop) < 1e-6)
      return !hasSoffit || !structuralSolids(s.scene).has('balcony-front')
    },
  },
  {
    n: 7,
    name: 'the railing made opaque and short (bars, 0.5 m)',
    checker: 'railingReport.glassParts / top + lineCoverage of RAILING_INFILL',
    mutant: () => mutate({ type: 'setProperty', targetId: 'rail-front', property: 'infill', value: 'NONE' }, { type: 'setProperty', targetId: 'rail-front', property: 'height', value: 0.5 }),
    caught: (s) => {
      const rr = railingReport(s, 'rail-front')
      return rr.coverage < 0.85 || rr.glassParts !== 1 || Math.abs(rr.top - (E.balconyTop + E.railingHeight)) > 1e-6
    },
  },
  {
    n: 8,
    name: 'a raked gable opening made rectangular',
    checker: 'openingReport.headError against the printed callout',
    mutant: () => edit((m) => {
      const o = m.openings.find((x) => x.id === 'og-front-gable-glazing')!
      o.head = { kind: 'LEVEL' }
    }),
    caught: (s) => openingReport(s, EXPECTED_OPENINGS.find((o) => o.id === 'og-front-gable-glazing')!).headError > 1e-3,
  },
  {
    n: 9,
    name: 'the roof pitch changed to 35°',
    checker: 'roofReport.pitches / ridgeY (upwardPlanes)',
    mutant: () => mutate({ type: 'setProperty', targetId: 'roof-main', property: 'pitchDeg', value: 35 }),
    caught: (s) => {
      const r = roofReport(s)
      return r.pitches.some((p) => Math.abs(p - E.pitchDeg) > 0.01) || Math.abs(r.ridgeY - E.ridge) > 1e-3
    },
  },
  {
    n: 10,
    name: 'the depth relation reversed: every z mirrored (the reference frame written with the wrong sign)',
    checker: 'recessReport(FRONT/REAR) + openingReport.through',
    mutant: () =>
      edit((m) => {
        const flip = (z: number): number => 14.6 - z
        for (const w of m.walls) {
          w.start = { ...w.start, z: flip(w.start.z) }
          w.end = { ...w.end, z: flip(w.end.z) }
        }
        for (const r of m.rooms) r.polygon = r.polygon.map((p) => ({ ...p, z: flip(p.z) })).reverse()
        for (const s of m.slabs) s.polygon = s.polygon.map((p) => ({ ...p, z: flip(p.z) })).reverse()
        const rect = (f: { minZ: number; maxZ: number }): void => {
          const a = flip(f.maxZ)
          const b = flip(f.minZ)
          f.minZ = a
          f.maxZ = b
        }
        for (const b of m.balconies) rect(b.footprint)
        for (const c of m.chimneys) rect(c.footprint)
        for (const r of m.roofs) rect(r.footprint)
        for (const r of m.roofOpenings) rect(r.footprint)
        for (const st of m.stairs) {
          rect(st.footprint)
          if (st.kind === 'FLIGHTS') {
            // a mirror swaps hands: the left end of the first riser line is the mirrored right end, every turn goes the other way
            st.start = { ...st.start, z: flip(st.start.z - st.width) }
            st.segments = st.segments.map((seg) => (seg.kind === 'WINDER' ? { ...seg, turn: seg.turn === 'LEFT' ? 'RIGHT' : 'LEFT' } : seg.kind === 'LANDING' && seg.turn !== 'NONE' ? { ...seg, turn: seg.turn === 'LEFT' ? 'RIGHT' : 'LEFT' } : seg))
          }
        }
        for (const sl of m.slabs) sl.holes = sl.holes?.map((hole) => hole.map((p) => ({ ...p, z: flip(p.z) })).reverse())
        for (const r of m.railings) {
          r.start = { ...r.start, z: flip(r.start.z) }
          r.end = { ...r.end, z: flip(r.end.z) }
        }
      }),
    caught: (s) => {
      const front = recessReport(s, 'FRONT')
      const rear = recessReport(s, 'REAR')
      const through = EXPECTED_OPENINGS.filter((e) => e.facade === 'FRONT' || e.facade === 'REAR').map((e) => openingReport(s, e).through)
      return front.atBackPlane === 0 || rear.atBackPlane === 0 || through.some((t) => t > 0.1)
    },
  },
  {
    n: 11,
    name: 'a wrong room behind an opening: the salon and kitchen polygons swapped',
    checker: 'roomBehindOpening against the source room',
    mutant: () =>
      edit((m) => {
        const a = m.rooms.find((r) => r.id === 'g-salon')!
        const b = m.rooms.find((r) => r.id === 'g-kitchen')!
        const p = a.polygon
        a.polygon = b.polygon
        b.polygon = p
      }),
    caught: (s) => EXPECTED_OPENINGS.some((e) => roomBehindOpening(s.model, e) !== e.roomId),
  },
  {
    n: 12,
    name: 'a multi-leaf passage with one leaf only cut (generic two-leaf wall, not Marcówki)',
    checker: 'material through the passage across both leaves',
    mutant: () => {
      // a free-standing pair of parallel leaves 0.2 + 0.3 with a passage through both; the mutant drops the second leaf
      const two = runCommands(createEmptyModel('leaf', 'leaf'), [
        { type: 'createBuilding', id: 'b' },
        { type: 'createLevel', id: 'l', index: 0, elevation: 0, height: 3 },
        { type: 'createWall', id: 'inner', levelId: 'l', start: { x: 0, z: 0 }, end: { x: 6, z: 0 }, thickness: 0.2, height: 3 },
        { type: 'createWall', id: 'outer', levelId: 'l', start: { x: 0, z: 0.2 }, end: { x: 6, z: 0.2 }, thickness: 0.3, height: 3 },
        { type: 'cutOpening', id: 'passage', wallId: 'inner', kind: 'DOOR', offset: 2, sill: 0, width: 1, height: 2.1, leaves: [{ wallId: 'outer', offset: 2 }] },
      ])
      return runCommands(two, [{ type: 'cutOpening', id: 'passage2', wallId: 'inner', kind: 'DOOR', offset: 4, sill: 0, width: 1, height: 2.1 }])
    },
    caught: (s) => {
      // the checker: a ray through each passage centre across BOTH leaves; the intact one reads 0, the one-leaf cut reads the outer leaf
      const both = ['inner', 'outer'].map((id) => solidTriangles(s.scene, id))
      const through = (x: number): number => both.reduce((sum, t) => sum + materialLength(t, V(x, 1, -1), V(0, 0, 1)), 0)
      return through(2.5) === 0 && through(4.5) > 0.29
    },
  },
  {
    n: 13,
    name: 'a roof opening filled: the laundry rooflight and its cut removed',
    checker: 'roof material through the rooflight centre + rooflight count',
    mutant: () => mutate({ type: 'removeFeature', targetId: 'rl-pralnia-w' }),
    caught: (s) => {
      const roof = solidTriangles(s.scene, 'roof-main')
      const centre = V((0.45 + 1.35393) / 2, 0, (7.202 + 7.982) / 2)
      return materialLength(roof, centre, V(0, 1, 0)) > 0.2 || s.model.rooflights.length !== 3
    },
  },
]

describe('mutation catalogue: every named checker passes the reference and catches its mutation', () => {
  it('has the thirteen required items', () => {
    expect(CATALOGUE.map((c) => c.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
  })

  for (const c of CATALOGUE) {
    it(`${c.n}. ${c.name} → ${c.checker}`, () => {
      if (c.n !== 12) expect(c.caught(base), 'the checker must pass on the reference').toBe(false)
      const mutant = c.mutant()
      expect(mutant, 'the mutant must be a model').toBeDefined()
      const scene = marcowkiScene(mutant)
      expect(c.caught(scene), 'the checker must catch the mutation').toBe(true)
    })
  }

  it('the roof-opening-filled variant where the unit is kept is refused by the model itself', () => {
    const m = edit((x) => (x.roofOpenings = x.roofOpenings.filter((o) => o.id !== 'rl-pralnia-w')))
    expect(validateModel(m).issues.map((i) => i.code)).toContain('UNKNOWN_ROOF_OPENING')
    expect(compileBuilding(m).diagnostics.some((d) => d.code === 'MODEL_INVALID')).toBe(true)
  })

  it('the DSL refuses the mutations a user could not make by accident: moving a ring wall, removing a level under walls', () => {
    const moved = applyCommand(reference, { type: 'moveFeature', targetId: 'g-front', dz: -1 })
    expect(moved.ok).toBe(false)
    const overlap = overlapEstimate(solidTriangles(base.scene, 'g-front'), solidTriangles(base.scene, 'ret-west-front'), 0.05)
    expect(overlap.volume).toBe(0)
    expect(meshVolume(solidTriangles(base.scene, 'g-front'))).toBeGreaterThan(0)
    expect(boundsOf(solidTriangles(base.scene, 'g-front'))!.min.z).toBeCloseTo(E.frontBackPlaneZ, 9)
  })
})
