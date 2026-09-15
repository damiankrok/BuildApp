/**
 * STAGE BUILDAPP-01A mutation catalogue: thirteen ways the architectural
 * fidelity this stage added could quietly regress, each applied to the real
 * Marcówki model and each caught by a NAMED checker that PASSES on the
 * unmutated reference.
 *
 * A checker that cannot tell the mutation from the reference measures
 * nothing; this file is the proof that the stair, the slab void, the
 * rooflight cut mode, the entrance assembly, the finish regions, the balcony
 * edge, the balustrade and the opening dimensions all have teeth.
 */
import { describe, expect, it } from 'vitest'
import { validateModel, type CanonicalBuildingModel } from '@buildapp/model'
import { runCommands, type BuildingCommand } from '@buildapp/commands'
import { solidTriangles } from '@buildapp/geometry'
import { materialLength, meshVolume } from '@buildapp/verification'
import { EXPECTED_REGIONS, EXPECTED_ROOFLIGHT_CUT, EXPECTED_STAIR, createMarcowkiReferenceBuilding } from '../src/index.js'
import { facadeAudit } from './facade-audit.js'
import {
  EXPECTED_OPENINGS,
  EXPECTED_SHELL,
  assemblyReport,
  marcowkiScene,
  openingDimensionReport,
  railingReport,
  regionReport,
  rooflightCutReport,
  slabVoidReport,
  stairReport,
  stairWalkingLine,
  V,
  type Scene,
} from './measure.js'

const E = EXPECTED_SHELL
const S = EXPECTED_STAIR
const reference = createMarcowkiReferenceBuilding()
const base = marcowkiScene(reference)

/** Apply DSL commands to the reference; they must all succeed. */
const mutate = (...commands: BuildingCommand[]): CanonicalBuildingModel => runCommands(reference, commands)

/** A direct record edit, for mutations the DSL would (rightly) refuse. */
function edit(fn: (m: CanonicalBuildingModel) => void): CanonicalBuildingModel {
  const m = structuredClone(reference)
  fn(m)
  return m
}

type Catalogue = { n: number; name: string; checker: string; mutant: () => CanonicalBuildingModel; caught: (s: Scene) => boolean }

const westDark = EXPECTED_REGIONS.find((r) => r.id === 'sr-west-dark')!

const CATALOGUE: Catalogue[] = [
  {
    n: 1,
    name: 'the staircase reduced to a placeholder footprint again',
    checker: 'stairReport.kind / parts / riserHeights (rays up the walking line)',
    mutant: () =>
      edit((m) => {
        const st = m.stairs.find((x) => x.id === 'stair-main')!
        m.stairs = [{ id: st.id, name: st.name, evidence: st.evidence, levelId: st.levelId, toLevelId: st.toLevelId, footprint: st.footprint, kind: 'PLACEHOLDER' }]
      }),
    caught: (s) => {
      const r = stairReport(s)
      return r.kind !== 'FLIGHTS' || !r.parts.includes('STAIR_STEP') || r.riserHeights.some((h) => Math.abs(h - S.riserHeight) > 1e-6)
    },
  },
  {
    n: 2,
    name: 'the wrong rise: the stair arrives 0.20 m below the attic floor',
    checker: 'stairReport.arrivalTop / riserHeights against the printed +3,06',
    mutant: () =>
      edit((m) => {
        const st = m.stairs.find((x) => x.id === 'stair-main')!
        if (st.kind === 'FLIGHTS') st.topOffset = -0.2
      }),
    caught: (s) => {
      const r = stairReport(s)
      return Math.abs(r.arrivalTop - E.upperFfl) > 1e-6 || r.riserHeights.some((h) => Math.abs(h - S.riserHeight) > 1e-6)
    },
  },
  {
    n: 3,
    name: 'the staircase footprint shifted 0.30 m west, out from under its void',
    checker: 'stairReport.firstRiserX + slab material over the walking line',
    mutant: () => mutate({ type: 'moveFeature', targetId: 'stair-main', dx: -0.3 }),
    caught: (s) => {
      const r = stairReport(s)
      const slab = solidTriangles(s.scene, 'slab-upper')
      const covered = stairWalkingLine().some((p) => materialLength(slab, V(p.x, 0, p.z), V(0, 1, 0)) > 0)
      return Math.abs(r.firstRiserX - S.start.x) > 1e-6 || covered
    },
  },
  {
    n: 4,
    name: 'the stair void filled in: the upper slab becomes a solid plate',
    checker: 'slabVoidReport.holes / insideBlocked (a 0.05 m ray grid over the shaft)',
    mutant: () =>
      edit((m) => {
        delete m.slabs.find((x) => x.id === 'slab-upper')!.holes
      }),
    caught: (s) => {
      const v = slabVoidReport(s)
      return v.holes === 0 || v.insideBlocked > 0 || !v.eastFaceOpen
    },
  },
  {
    n: 5,
    name: 'a rooflight cut vertically instead of normal to the roof',
    checker: 'rooflightCutReport.normalRaysBlocked / undersideShift (rays along the roof normal)',
    mutant: () =>
      edit((m) => {
        m.roofOpenings.find((o) => o.id === 'rl-schody-e')!.cut = 'VERTICAL'
      }),
    caught: (s) => {
      const r = rooflightCutReport(s, 'rl-schody-e')
      return r.mode !== EXPECTED_ROOFLIGHT_CUT.mode || r.normalRaysBlocked > 0 || Math.abs(r.undersideShift - EXPECTED_ROOFLIGHT_CUT.undersideShift) > 1e-4
    },
  },
  {
    n: 6,
    name: 'the entrance sidelight removed: the door becomes one plain leaf',
    checker: 'assemblyReport(og-front-entrance-leaf).panels / parts',
    mutant: () =>
      edit((m) => {
        delete m.doors.find((d) => d.id === 'og-front-entrance-leaf')!.assembly
      }),
    caught: (s) => {
      const r = assemblyReport(s, 'og-front-entrance-leaf')
      return !r.panels.includes('GLAZED') || !r.parts.includes('DOOR_GLASS') || r.glassSpan === null
    },
  },
  {
    n: 7,
    name: 'the entrance sidelight on the wrong side: the panels mirrored about the opening',
    checker: 'assemblyReport(og-front-entrance-leaf).glassSide (which half of the opening the pane is in)',
    mutant: () =>
      edit((m) => {
        const d = m.doors.find((x) => x.id === 'og-front-entrance-leaf')!
        d.assembly = { ...d.assembly!, panels: [...d.assembly!.panels].reverse() }
      }),
    caught: (s) => assemblyReport(s, 'og-front-entrance-leaf').glassSide !== 'HIGH',
  },
  {
    n: 8,
    name: 'a finish region omitted: the west dark band disappears',
    checker: 'regionReport(sr-west-dark).found + the surfaceRegions count',
    mutant: () => mutate({ type: 'removeFeature', targetId: 'sr-west-dark' }),
    caught: (s) => !regionReport(s, westDark).found || s.model.surfaceRegions.length !== EXPECTED_REGIONS.length,
  },
  {
    n: 9,
    name: 'a finish region on the wrong wall: the west band re-hosted on the east wall',
    checker: 'regionReport(sr-west-dark).hostOk + a ray at the west face where the band should be',
    mutant: () =>
      edit((m) => {
        m.surfaceRegions.find((r) => r.id === 'sr-west-dark')!.hostId = 'g-right'
      }),
    caught: (s) => {
      const r = regionReport(s, westDark)
      const tris = s.scene.meshes.filter((x) => x.objectId === 'sr-west-dark').flatMap((x) => x.triangles)
      const mid = (westDark.across[0] + westDark.across[1]) / 2
      const onWestFace = materialLength(tris, V(-0.5, 1.2, mid), V(1, 0, 0)) > 0
      return !r.hostOk || !onWestFace
    },
  },
  {
    n: 10,
    name: 'the front balcony edge shifted 0.40 m east of the plan line',
    checker: 'facadeAudit(front-balcony-west-edge).delta beyond the recorded plan/render conflict',
    mutant: () =>
      edit((m) => {
        m.balconies.find((b) => b.id === 'balcony-front')!.footprint.minX = 3.738
      }),
    caught: (s) => {
      const f = facadeAudit(s).features.find((x) => x.id === 'front-balcony-west-edge')!
      return (f.delta ?? Infinity) > 0.25
    },
  },
  {
    n: 11,
    name: 'the front balustrade shortened by a metre',
    checker: 'railingReport(rail-front).run / coverage against the plan post marks',
    mutant: () => mutate({ type: 'setProperty', targetId: 'rail-front', property: 'end', value: { x: E.railingFrontRun[1] - 1.0, z: 0.025 } }),
    caught: (s) => {
      const r = railingReport(s, 'rail-front')
      return Math.abs(r.run[0] - E.railingFrontRun[0]) > 1e-6 || Math.abs(r.run[1] - E.railingFrontRun[1]) > 1e-6
    },
  },
  {
    n: 12,
    name: 'a door opening re-dimensioned: the garage door narrowed by 0.20 m',
    checker: 'openingDimensionReport(og-garage-door).worst (the hole measured in the wall by rays)',
    mutant: () => mutate({ type: 'setProperty', targetId: 'og-garage-door', property: 'width', value: 2.55 }),
    caught: (s) => openingDimensionReport(s, EXPECTED_OPENINGS.find((o) => o.id === 'og-garage-door')!).worst > 1e-6,
  },
  {
    n: 13,
    name: 'a raked gable opening squared off into a rectangle',
    checker: 'openingDimensionReport(og-rear-gable-east).raked / worst (the head measured at both ends)',
    mutant: () =>
      edit((m) => {
        m.openings.find((o) => o.id === 'og-rear-gable-east')!.head = { kind: 'LEVEL' }
      }),
    caught: (s) => {
      const r = openingDimensionReport(s, EXPECTED_OPENINGS.find((o) => o.id === 'og-rear-gable-east')!)
      return !r.raked || r.worst > 1e-6
    },
  },
]

describe('STAGE BUILDAPP-01A mutation catalogue: every named checker passes the reference and catches its mutation', () => {
  it('has the thirteen required items, each with its own checker', () => {
    expect(CATALOGUE.map((c) => c.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
    expect(new Set(CATALOGUE.map((c) => c.checker)).size).toBe(13)
  })

  for (const c of CATALOGUE) {
    it(`${c.n}. ${c.name} → ${c.checker}`, () => {
      expect(c.caught(base), 'the checker must pass on the reference').toBe(false)
      const mutant = c.mutant()
      expect(mutant, 'the mutant must be a model').toBeDefined()
      const scene = marcowkiScene(mutant)
      expect(c.caught(scene), 'the checker must catch the mutation').toBe(true)
    })
  }

  it('the reference itself is what every checker was run against: it validates and compiles clean', () => {
    expect(validateModel(reference).issues).toEqual([])
    expect(base.scene.diagnostics).toEqual([])
    // and the mutations really change the geometry, not just the records
    const solid = meshVolume(solidTriangles(base.scene, 'slab-upper'))
    const filled = meshVolume(solidTriangles(marcowkiScene(CATALOGUE[3].mutant()).scene, 'slab-upper'))
    expect(filled - solid).toBeCloseTo(4.158 * E.slabThickness, 6)
  })
})
