/**
 * BUILDPLAN-ANALYZER-005Y-N5 (C1): one glazing round a corner with no pier — two openings, one in each wall of a CORNER
 * junction, each stating `openEnd` at that corner — cut the corner block open between their common sill and head. The
 * walls stay closed solids, the block keeps its material below the sill and above the head, and the two fills meet face
 * to face. A stated open end with nothing to meet, or across from another height, is cut closed with a warning.
 */
import { describe, expect, it } from 'vitest'
import { validateModel } from '@buildapp/model'
import { manifoldReport, materialLength } from '@buildapp/verification'
import { compileBuilding, solidTriangles } from '../src/index.js'
import { V, withGround } from './helpers.js'

const T = 0.3
const SILL = 0.9
const H = 1.4
// The ring runs (0,0) -> (8,0) -> (8,6) -> (0,6): w0 starts and w3 ends at the corner (0,0).
const house = (opts: { open?: boolean; otherHeight?: number; partner?: boolean } = {}) =>
  withGround(
    { type: 'createWallRing', id: 'r', levelId: 'ground', polygon: [{ x: 0, z: 0 }, { x: 8, z: 0 }, { x: 8, z: 6 }, { x: 0, z: 6 }], thickness: T, height: 3 },
    { type: 'cutOpening', id: 'front', wallId: 'r-w0', kind: 'WINDOW', offset: T + 0.05, sill: SILL, width: 2, height: H, ...(opts.open !== false ? { openEnd: 'START' as const } : {}) },
    { type: 'placeWindow', id: 'front-unit', openingId: 'front' },
    ...(opts.partner === false
      ? []
      : [
          { type: 'cutOpening' as const, id: 'side', wallId: 'r-w3', kind: 'WINDOW' as const, offset: 6 - T - 0.05 - 1.5, sill: SILL, width: 1.5, height: opts.otherHeight ?? H, ...(opts.open !== false ? { openEnd: 'END' as const } : {}) },
          { type: 'placeWindow' as const, id: 'side-unit', openingId: 'side' },
        ]),
  )

/** Wall material on a vertical line through the middle of the corner block, both walls together. */
const blockColumn = (scene: ReturnType<typeof compileBuilding>): number =>
  ['r-w0', 'r-w3'].reduce((s, id) => s + materialLength(solidTriangles(scene, id), V(T / 2, 10, T / 2), V(0, -1, 0)), 0)

describe('005Y-N5 an open corner: one glazing round a corner, no pier', () => {
  it('cuts the corner block open between the common sill and head, and nowhere else; both walls stay closed', () => {
    const model = house()
    expect(validateModel(model).ok).toBe(true)
    const scene = compileBuilding(model)
    expect(scene.diagnostics.filter((d) => d.severity === 'ERROR')).toEqual([])
    for (const id of ['r-w0', 'r-w3']) expect(manifoldReport(solidTriangles(scene, id))).toMatchObject({ closed: true })
    expect(blockColumn(scene)).toBeCloseTo(3 - H, 9)
    // a horizontal line through the band, along the front wall's thickness, meets no wall from the corner to the far jamb
    const front = solidTriangles(scene, 'r-w0')
    expect(materialLength(front, V(-1, SILL + H / 2, T / 2), V(1, 0, 0))).toBeCloseTo(8 - (T + 0.05 + 2), 6)
    // both fills are there, and meet: the front fill reaches into the corner block, the side fill too
    const fills = scene.meshes.filter((m) => m.objectKind === 'window')
    expect(new Set(fills.map((m) => m.objectId))).toEqual(new Set(['front-unit', 'side-unit']))
  })

  it('counterfactual: the same two openings without openEnd keep the corner block as wall (a pier)', () => {
    const scene = compileBuilding(house({ open: false }))
    expect(scene.diagnostics.filter((d) => d.severity === 'ERROR')).toEqual([])
    expect(blockColumn(scene)).toBeCloseTo(3, 9)
  })

  it('negative: an open end across from an opening of another height is cut closed, never half-way, with a warning', () => {
    const model = house({ otherHeight: H - 0.2 })
    const v = validateModel(model)
    expect(v.ok).toBe(true)
    expect(v.issues.filter((i) => i.code === 'OPENING_OPEN_END_UNMATCHED').map((i) => i.message).join(' ')).toMatch(/differ in sill or head/)
    expect(blockColumn(compileBuilding(model))).toBeCloseTo(3, 9)
  })

  it('negative: an open end with no opening across the corner is cut closed, with a warning', () => {
    const model = house({ partner: false })
    expect(validateModel(model).issues.find((i) => i.code === 'OPENING_OPEN_END_UNMATCHED')?.message).toMatch(/0 open-ended openings/)
    expect(blockColumn(compileBuilding(model))).toBeCloseTo(3, 9)
  })

  it('negative: a piece that stops short of the corner opens neither side', () => {
    const model = withGround(
      { type: 'createWallRing', id: 'r', levelId: 'ground', polygon: [{ x: 0, z: 0 }, { x: 8, z: 0 }, { x: 8, z: 6 }, { x: 0, z: 6 }], thickness: T, height: 3 },
      { type: 'cutOpening', id: 'front', wallId: 'r-w0', kind: 'WINDOW', offset: 1.5, sill: SILL, width: 2, height: H, openEnd: 'START' },
      { type: 'cutOpening', id: 'side', wallId: 'r-w3', kind: 'WINDOW', offset: 6 - T - 0.05 - 1.5, sill: SILL, width: 1.5, height: H, openEnd: 'END' },
    )
    expect(validateModel(model).issues.filter((i) => i.code === 'OPENING_OPEN_END_UNMATCHED').length).toBe(2)
    expect(blockColumn(compileBuilding(model))).toBeCloseTo(3, 9)
  })
})
