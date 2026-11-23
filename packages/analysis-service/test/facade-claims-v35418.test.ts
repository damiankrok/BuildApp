/**
 * v3.54.18 — the source gate on a wall the MODEL fills with openings (gate 1.3.0).
 *
 * The first loss reproduced from the live R3 records (Alaska: 21 of 21 opening corrections NEEDS_EVIDENCE with "too few
 * free same-size places on this wall band (0)"): the gate's null band was taken only from places free of the model's own
 * openings, so a wall LOCAL had filled with wide phantom openings could never be corrected — the error under test removed
 * the evidence against itself. The band is now taken, when the joint one is too thin, from the wall the proposing reading
 * of that picture calls plain (its own openings excluded), read robustly; the measure stays the original picture.
 *
 * Positive case, the old blockade (no claims: byte-for-byte the 1.2.0 answer), and three counter-trials: a proposal the
 * picture does not draw, a reading that MISSED real windows (they contaminate the band and must not hide a real window
 * from a removal), and a wall with no place free even of the reading's own openings.
 */
import { describe, expect, it } from 'vitest'
import { applyCommands } from '@buildapp/commands'
import type { BuildingCommand } from '@buildapp/commands'
import { createEmptyModel } from '@buildapp/model'
import type { CanonicalBuildingModel } from '@buildapp/model'
import { executeCorrections, modelRevision } from '../src/consult/correct/execute.js'
import type { BindPicture, BindView, CorrectionProposal } from '../src/consult/correct/execute.js'
import { SOURCE_GATE_VERSION, supportOf } from '../src/consult/correct/source-gate.js'
import { FACADE_ADOPTION, facadeAdoption } from '../src/consult/correct/from-sketch.js'
import type { ElevationSketch } from '../src/appearance/elevation-sketch.js'

const MPP = 0.025
const ALONG0 = -1.25
const ZERO = 400
const col = (x: number): number => Math.round((x - ALONG0) / MPP)
const row = (y: number): number => Math.round(ZERO - y / MPP)
const W = 500
const H = 420
const boxOf = (x0: number, x1: number, y0: number, y1: number): { x0: number; y0: number; x1: number; y1: number } => ({ x0: col(x0), x1: col(x1), y0: row(y1), y1: row(y0) })

/** One storey, 10 m front wall. LOCAL's error: three wide "windows" that cover the wall from end to end. */
const phantomHouse = (): CanonicalBuildingModel => {
  const cmds = [
    { type: 'createBuilding', id: 'b', name: 'phantoms' },
    { type: 'createLevel', id: 'l0', name: 'Ground', index: 0, elevation: 0, height: 2.8 },
    { type: 'createWallRing', id: 'g', levelId: 'l0', polygon: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 8 }, { x: 0, z: 8 }], thickness: 0.3, height: 2.8, baseOffset: 0, kind: 'EXTERIOR', cornerOwnership: 'ALTERNATE' },
    { type: 'cutOpening', id: 'P1', wallId: 'g-w0', kind: 'WINDOW', offset: 0.5, sill: 0.6, width: 2.8, height: 1.7 },
    { type: 'placeWindow', id: 'P1-unit', openingId: 'P1' },
    { type: 'cutOpening', id: 'P2', wallId: 'g-w0', kind: 'WINDOW', offset: 3.6, sill: 0.6, width: 2.8, height: 1.7 },
    { type: 'placeWindow', id: 'P2-unit', openingId: 'P2' },
    { type: 'cutOpening', id: 'P3', wallId: 'g-w0', kind: 'WINDOW', offset: 6.7, sill: 0.6, width: 2.8, height: 1.7 },
    { type: 'placeWindow', id: 'P3-unit', openingId: 'P3' },
  ] as BuildingCommand[]
  const r = applyCommands(createEmptyModel('m-phantoms', 'phantoms'), cmds)
  if (r.failedAt !== undefined) throw new Error(`fixture: ${JSON.stringify(r.results[r.failedAt])}`)
  return r.model
}

/** The source: a textured wall with two real windows (A at 1.0–2.2 m, C at 7.4–8.6 m) and a door (4.5–5.5 m). */
const REAL = { A: [1.0, 2.2, 0.9, 2.1], C: [7.4, 8.6, 0.9, 2.1], DOOR: [4.5, 5.5, 0.0, 2.1] } as const
function elevation(): BindPicture['raster'] {
  const data = new Uint8ClampedArray(W * H * 4)
  let seed = 11
  const rnd = (): number => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  const put = (x: number, y: number, c: [number, number, number]): void => { if (x >= 0 && y >= 0 && x < W && y < H) data.set([c[0], c[1], c[2], 255], (y * W + x) * 4) }
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const n = Math.round((rnd() - 0.5) * 18)
    const inWall = x >= col(0) && x <= col(10) && y <= row(0) && y >= row(2.8)
    const inRoof = x >= col(-0.4) && x <= col(10.4) && y < row(2.8) && y >= row(5.4)
    put(x, y, inWall ? [228 + n, 218 + n, 198 + n] : inRoof ? [92 + n, 92 + n, 98 + n] : y > row(0) ? [120 + n, 150 + n, 100 + n] : [225, 235, 245])
  }
  const win = ([x0, x1, y0, y1]: readonly number[], glass: [number, number, number]): void => {
    for (let y = row(y1); y <= row(y0); y += 1) for (let x = col(x0); x <= col(x1); x += 1) {
      const frame = x - col(x0) < 3 || col(x1) - x < 3 || y - row(y1) < 3 || row(y0) - y < 3
      put(x, y, frame ? [250, 250, 250] : glass)
    }
  }
  win(REAL.A, [55, 66, 78])
  win(REAL.C, [55, 66, 78])
  win(REAL.DOOR, [120, 80, 50])
  return { width: W, height: H, data }
}
const RASTER = elevation()
const FRAME = 'frame-front'
const picture: BindPicture = { n: 1, frameId: FRAME, projection: 'ORTHOGRAPHIC_ELEVATION', transform: { x0: 0, y0: 0, scale: 1 }, raster: RASTER, sourceByteHash: 'b'.repeat(64) }
const view: BindView = { side: 'FRONT', frameId: FRAME, projection: { mpp: MPP, alongAtPx0: ALONG0, alongSign: 1, zeroRow: ZERO }, heights: true, roofAnchored: true, origin: 'ANALYZER', alongErrorM: 0.03, heightErrorM: 0.05 }
const prop = (m: CanonicalBuildingModel, p: Partial<CorrectionProposal> & { operation: string; proposalId: string }): CorrectionProposal => ({ baseRevision: modelRevision(m), targetId: 'FRONT', frameId: FRAME, origin: 'SKETCH', uncertainty: 'MEDIUM', justification: 'test', ...p }) as CorrectionProposal
/** What the reading of this picture draws: the two windows and the door (frame pixels). */
const CLAIMS = new Map([[FRAME, [boxOf(...(REAL.A as unknown as [number, number, number, number])), boxOf(...(REAL.C as unknown as [number, number, number, number])), boxOf(...(REAL.DOOR as unknown as [number, number, number, number]))]]])
const b4 = (v: readonly number[]) => boxOf(v[0], v[1], v[2], v[3])

describe('v3.54.18 gate 1.3.0: a wall the model fills with openings', () => {
  it('names its version', () => expect(SOURCE_GATE_VERSION).toBe('1.3.0'))

  it('REPRODUCES the R3 blockade without claims: no joint place is free, every correction is NEEDS_EVIDENCE', () => {
    const m = phantomHouse()
    const out = executeCorrections({ model: m, views: [view], pictures: [picture], proposals: [prop(m, { proposalId: 'u1', operation: 'UPDATE_OPENING', targetId: 'P1', patch: { box: b4(REAL.A), kind: 'WINDOW' } }), prop(m, { proposalId: 'r2', operation: 'REMOVE_OPENING', targetId: 'P2', patch: {} })] })
    expect(out.records.map((r) => [r.status, r.code])).toEqual([['NEEDS_EVIDENCE', 'SOURCE_UNDECIDED'], ['NEEDS_EVIDENCE', 'SOURCE_UNDECIDED']])
    expect(out.records[0].gate?.nullBoxes ?? 0).toBeLessThan(8)
    expect(out.revision).toBe(out.baseRevision)
  })

  it('with the reading\'s claims the same corrections are judged on the original picture and committed', () => {
    const m = phantomHouse()
    const out = executeCorrections({ model: m, views: [view], pictures: [picture], claims: CLAIMS, proposals: [
      prop(m, { proposalId: 'u1', operation: 'UPDATE_OPENING', targetId: 'P1', patch: { box: b4(REAL.A), kind: 'WINDOW' } }),
      prop(m, { proposalId: 'u3', operation: 'UPDATE_OPENING', targetId: 'P3', patch: { box: b4(REAL.C), kind: 'WINDOW' } }),
      prop(m, { proposalId: 'u2', operation: 'UPDATE_OPENING', targetId: 'P2', patch: { box: b4(REAL.DOOR), kind: 'DOOR' } }),
    ] })
    expect(out.records.map((r) => r.status)).toEqual(['COMMITTED', 'COMMITTED', 'COMMITTED'])
    expect(out.records.map((r) => r.gate?.nullMode)).toEqual(['CLAIMS_ROBUST', 'CLAIMS_ROBUST', 'DISPLACED'])
    for (const r of out.records) {
      expect(r.gate?.winner).toBe('PROPOSED')
      expect(r.gate?.nullBoxes ?? 0).toBeGreaterThanOrEqual(8)
    }
    const A = out.model.openings.find((o) => o.id === 'P1')
    expect(A?.width).toBeCloseTo(1.2, 1)
    expect(A?.sill).toBeCloseTo(0.9, 1)
    expect(out.model.doors.some((d) => d.openingId === 'P2')).toBe(true)
  })

  it('COUNTER-TRIAL: a proposal where the picture draws plain wall is refused even with claims', () => {
    const m = phantomHouse()
    const out = executeCorrections({ model: m, views: [view], pictures: [picture], claims: CLAIMS, proposals: [prop(m, { proposalId: 'bad', operation: 'UPDATE_OPENING', targetId: 'P1', patch: { box: boxOf(2.6, 3.8, 0.9, 2.1), kind: 'WINDOW' } })] })
    expect(out.records[0].status).not.toBe('COMMITTED')
    expect(out.revision).toBe(out.baseRevision)
  })

  it('a phantom over plain wall is removed; COUNTER-TRIAL: a model opening over a real window the reading MISSED is not', () => {
    // the model: one opening over plain wall (2.6–3.8 m), one exactly on the real window C; the rest of the band is
    // filled so that no joint place is free
    const cmds = [
      { type: 'createBuilding', id: 'b', name: 'missed' },
      { type: 'createLevel', id: 'l0', name: 'Ground', index: 0, elevation: 0, height: 2.8 },
      { type: 'createWallRing', id: 'g', levelId: 'l0', polygon: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 8 }, { x: 0, z: 8 }], thickness: 0.3, height: 2.8, baseOffset: 0, kind: 'EXTERIOR', cornerOwnership: 'ALTERNATE' },
      { type: 'cutOpening', id: 'X1', wallId: 'g-w0', kind: 'WINDOW', offset: 0.5, sill: 0.9, width: 1.9, height: 1.2 },
      { type: 'placeWindow', id: 'X1-unit', openingId: 'X1' },
      { type: 'cutOpening', id: 'PH', wallId: 'g-w0', kind: 'WINDOW', offset: 2.6, sill: 0.9, width: 1.2, height: 1.2 },
      { type: 'placeWindow', id: 'PH-unit', openingId: 'PH' },
      { type: 'cutOpening', id: 'X2', wallId: 'g-w0', kind: 'WINDOW', offset: 4.2, sill: 0.9, width: 2.6, height: 1.2 },
      { type: 'placeWindow', id: 'X2-unit', openingId: 'X2' },
      { type: 'cutOpening', id: 'RC', wallId: 'g-w0', kind: 'WINDOW', offset: 7.4, sill: 0.9, width: 1.2, height: 1.2 },
      { type: 'placeWindow', id: 'RC-unit', openingId: 'RC' },
      { type: 'cutOpening', id: 'X3', wallId: 'g-w0', kind: 'WINDOW', offset: 8.8, sill: 0.9, width: 0.9, height: 1.2 },
      { type: 'placeWindow', id: 'X3-unit', openingId: 'X3' },
    ] as BuildingCommand[]
    const r0 = applyCommands(createEmptyModel('m-missed', 'missed'), cmds)
    if (r0.failedAt !== undefined) throw new Error(`fixture: ${JSON.stringify(r0.results[r0.failedAt])}`)
    const m = r0.model
    // the reading saw only the door: it MISSED both real windows (A and C stay in its "plain wall")
    const missed = new Map([[FRAME, [b4(REAL.DOOR)]]])
    const out = executeCorrections({ model: m, views: [view], pictures: [picture], claims: missed, proposals: [prop(m, { proposalId: 'rm-phantom', operation: 'REMOVE_OPENING', targetId: 'PH', patch: {} }), prop(m, { proposalId: 'rm-real', operation: 'REMOVE_OPENING', targetId: 'RC', patch: {} })] })
    const byId = new Map(out.records.map((r) => [r.proposalId, r]))
    expect(byId.get('rm-phantom')?.status).toBe('COMMITTED')
    expect(byId.get('rm-real')?.status).toBe('REJECTED_BY_SOURCE')
    expect(byId.get('rm-real')?.code).toBe('SOURCE_SHOWS_OPENING')
    expect(out.model.openings.some((o) => o.id === 'RC')).toBe(true)
    expect(out.model.openings.some((o) => o.id === 'PH')).toBe(false)
  })

  it('COUNTER-TRIAL: without a reading\'s claims a wall with no place free stays undecided (1.2.0 unchanged)', () => {
    const everything = [{ x0: col(0), y0: row(2.8), x1: col(10), y1: row(0) }]
    const s = supportOf(RASTER, b4(REAL.A), { x0: col(0), x1: col(10), y0: row(2.8), y1: row(0) }, everything, 2, false)
    expect(s.z).toBeNull()
    expect(s.supported).toBeNull()
  })

  it('a door on a small wall is read against its own displaced copies (DISPLACED), and a displaced door is not supported', () => {
    const facade = { x0: col(0), x1: col(10), y0: row(2.8), y1: row(0) }
    const door = b4(REAL.DOOR)
    const wall = [{ x0: col(0), y0: row(2.8), x1: col(10), y1: row(0) }]
    const real = supportOf(RASTER, door, facade, wall, 2, false, wall)
    expect(real.null.mode).toBe('DISPLACED')
    expect(real.supported).toBe(true)
    const off = boxOf(2.9, 3.9, 0.0, 2.1) // plain wall between the window and the door
    const wrong = supportOf(RASTER, off, facade, wall, 2, false, wall)
    expect(wrong.null.mode).toBe('DISPLACED')
    expect(wrong.supported).not.toBe(true)
  })
})

// ---- v3.54.18: a window in a slope ------------------------------------------------------------------------------------
describe('v3.54.18 ADD_ROOF_WINDOW: a window in a slope, placed from the elevation that sees the slope face-on', () => {
  const roofed = (): CanonicalBuildingModel => {
    const cmds = [
      { type: 'createBuilding', id: 'b', name: 'roofed' },
      { type: 'createLevel', id: 'l0', name: 'Ground', index: 0, elevation: 0, height: 2.8 },
      { type: 'createWallRing', id: 'g', levelId: 'l0', polygon: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 8 }, { x: 0, z: 8 }], thickness: 0.3, height: 2.8, baseOffset: 0, kind: 'EXTERIOR', cornerOwnership: 'ALTERNATE' },
      { type: 'createRoof', id: 'roof', levelId: 'l0', kind: 'GABLE', footprint: { minX: 0, maxX: 10, minZ: 0, maxZ: 8 }, eaveOffset: 2.8, pitchDeg: 35, ridgeAxis: 'X', overhang: 0, thickness: 0.25 },
    ] as BuildingCommand[]
    const r = applyCommands(createEmptyModel('m-roofed', 'roofed'), cmds)
    if (r.failedAt !== undefined) throw new Error(`fixture: ${JSON.stringify(r.results[r.failedAt])}`)
    return r.model
  }
  // the eaves-side elevation: wall to 2.8 m, the slope's band to the ridge at 2.8 + 4·tan 35° = 5.6 m, one framed skylight
  const SKY = [3.0, 3.8, 3.6, 4.4] as const
  const roofPicture = (): BindPicture => {
    const data = new Uint8ClampedArray(W * H * 4)
    let seed = 5
    const rnd = (): number => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      const n = Math.round((rnd() - 0.5) * 14)
      const inWall = x >= col(0) && x <= col(10) && y <= row(0) && y >= row(2.8)
      const inRoof = x >= col(0) && x <= col(10) && y < row(2.8) && y >= row(5.6)
      const c = inWall ? [228 + n, 218 + n, 198 + n] : inRoof ? [92 + n, 92 + n, 98 + n] : y > row(0) ? [120 + n, 150 + n, 100 + n] : [225, 235, 245]
      data.set([c[0], c[1], c[2], 255], (y * W + x) * 4)
    }
    for (let y = row(SKY[3]); y <= row(SKY[2]); y += 1) for (let x = col(SKY[0]); x <= col(SKY[1]); x += 1) {
      const frame = x - col(SKY[0]) < 3 || col(SKY[1]) - x < 3 || y - row(SKY[3]) < 3 || row(SKY[2]) - y < 3
      data.set(frame ? [240, 240, 240, 255] : [150, 190, 220, 255], (y * W + x) * 4)
    }
    return { n: 1, frameId: FRAME, projection: 'ORTHOGRAPHIC_ELEVATION', transform: { x0: 0, y0: 0, scale: 1 }, raster: { width: W, height: H, data }, sourceByteHash: 'c'.repeat(64) }
  }
  const pic = roofPicture()

  it('places the window up the slope by its height over the eaves and the pitch, and builds it with its light', () => {
    const m = roofed()
    const out = executeCorrections({ model: m, views: [view], pictures: [pic], claims: new Map([[FRAME, [b4(SKY)]]]), proposals: [prop(m, { proposalId: 'rw', operation: 'ADD_ROOF_WINDOW', patch: { box: b4(SKY) } })] })
    expect(out.records[0].status).toBe('COMMITTED')
    const ro = out.model.roofOpenings[0] as unknown as { roofId: string; kind: string; footprint: { minX: number; maxX: number; minZ: number; maxZ: number } }
    expect(ro.roofId).toBe('roof')
    expect(ro.kind).toBe('ROOFLIGHT')
    expect(ro.footprint.minX).toBeCloseTo(3.0, 1)
    expect(ro.footprint.maxX).toBeCloseTo(3.8, 1)
    // 0.8..1.6 m above the eaves at 35° → 1.14..2.28 m in from the front eaves (z = 0)
    expect(ro.footprint.minZ).toBeCloseTo(0.8 / Math.tan((35 * Math.PI) / 180), 1)
    expect(ro.footprint.maxZ).toBeCloseTo(1.6 / Math.tan((35 * Math.PI) / 180), 1)
    expect(out.model.rooflights.length).toBe(1)
    expect(out.model.openings.length).toBe(m.openings.length)
  })

  it('COUNTER-TRIALS: plain covering is refused; a gable-side view is named; a box under the eaves is not on the slope', () => {
    const m = roofed()
    const plain = executeCorrections({ model: m, views: [view], pictures: [pic], claims: new Map([[FRAME, [b4(SKY)]]]), proposals: [prop(m, { proposalId: 'rw-plain', operation: 'ADD_ROOF_WINDOW', patch: { box: boxOf(6.5, 7.3, 3.6, 4.4) } })] })
    expect(plain.records[0].status).not.toBe('COMMITTED')
    expect(plain.model.roofOpenings.length).toBe(0)
    const gableView: BindView = { ...view, side: 'RIGHT' }
    const edgeOn = executeCorrections({ model: m, views: [gableView], pictures: [pic], proposals: [prop(m, { proposalId: 'rw-gable', operation: 'ADD_ROOF_WINDOW', targetId: 'RIGHT', patch: { box: b4(SKY) } })] })
    expect(edgeOn.records[0].code).toBe('SLOPE_SEEN_EDGE_ON')
    const low = executeCorrections({ model: m, views: [view], pictures: [pic], proposals: [prop(m, { proposalId: 'rw-low', operation: 'ADD_ROOF_WINDOW', patch: { box: boxOf(3.0, 3.8, 1.0, 1.8) } })] })
    expect(low.records[0].code).toBe('NOT_ON_THE_SLOPE')
  })
})

// ---- v3.54.18: facade adoption ------------------------------------------------------------------------------------------
describe('v3.54.18 facade adoption: the picture supports most of a reading and refutes none of it', () => {
  const poly = (b: { x0: number; y0: number; x1: number; y1: number }): Array<[number, number]> => [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]]
  // the model: the two real windows as the picture has them, a window where the door is, and an opening (Z) the reading does not draw
  const house = (): CanonicalBuildingModel => {
    const cmds = [
      { type: 'createBuilding', id: 'b', name: 'adopt' },
      { type: 'createLevel', id: 'l0', name: 'Ground', index: 0, elevation: 0, height: 2.8 },
      { type: 'createWallRing', id: 'g', levelId: 'l0', polygon: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 8 }, { x: 0, z: 8 }], thickness: 0.3, height: 2.8, baseOffset: 0, kind: 'EXTERIOR', cornerOwnership: 'ALTERNATE' },
      { type: 'cutOpening', id: 'A', wallId: 'g-w0', kind: 'WINDOW', offset: 1.0, sill: 0.9, width: 1.2, height: 1.2 }, { type: 'placeWindow', id: 'A-unit', openingId: 'A' },
      { type: 'cutOpening', id: 'C', wallId: 'g-w0', kind: 'WINDOW', offset: 7.4, sill: 0.9, width: 1.2, height: 1.2 }, { type: 'placeWindow', id: 'C-unit', openingId: 'C' },
      { type: 'cutOpening', id: 'D', wallId: 'g-w0', kind: 'WINDOW', offset: 4.3, sill: 0.9, width: 1.5, height: 1.2 }, { type: 'placeWindow', id: 'D-unit', openingId: 'D' },
      { type: 'cutOpening', id: 'Z', wallId: 'g-w0', kind: 'WINDOW', offset: 2.6, sill: 0.9, width: 1.2, height: 1.2 }, { type: 'placeWindow', id: 'Z-unit', openingId: 'Z' },
    ] as BuildingCommand[]
    const r = applyCommands(createEmptyModel('m-adopt', 'adopt'), cmds)
    if (r.failedAt !== undefined) throw new Error(`fixture: ${JSON.stringify(r.results[r.failedAt])}`)
    return r.model
  }
  // the reading: both windows, the door, and two finish zones meeting at 3.2 m (Z's box lies across that boundary)
  const zones = [{ id: 'w-light', class: 'LIGHT_RENDER', polygon: poly(boxOf(0, 3.2, 0, 2.8)), host: 'main', visibility: 'VISIBLE' }, { id: 'w-timber', class: 'TIMBER', polygon: poly(boxOf(3.2, 10, 0, 2.8)), host: 'main', visibility: 'VISIBLE' }]
  const reading = (extra: Array<{ id: string; kind: string; polygon: Array<[number, number]> }> = []): ElevationSketch => ({ sketchId: 's', frameId: FRAME, groundRow: ZERO, elements: [], roofs: [], walls: zones, openings: [{ id: 'sA', kind: 'WINDOW', polygon: poly(b4(REAL.A)) }, { id: 'sC', kind: 'WINDOW', polygon: poly(b4(REAL.C)) }, { id: 'sDoor', kind: 'DOOR', polygon: poly(b4(REAL.DOOR)) }, ...extra] }) as unknown as ElevationSketch
  const none = (): string | undefined => undefined

  it('states its criteria', () => expect(FACADE_ADOPTION).toEqual({ minOpenings: 2, minSupportedShare: 0.6 }))

  it('adopts a reading the picture supports on two of three openings and refutes on none: the undecided follow it', () => {
    const m = house()
    const a = facadeAdoption(reading(), 'FRONT', m, [view], modelRevision(m), none)
    expect([a.decision, a.drawn, a.supported, a.refuted, a.pending]).toEqual(['ADOPTED', 3, 2, 0, 1])
    expect(a.proposals.map((q) => [q.operation, q.targetId, (q.patch as { adopt?: boolean }).adopt])).toEqual([['REMOVE_OPENING', 'Z', true], ['UPDATE_OPENING', 'D', true]])
    expect(a.proposals.every((q) => q.proposalId.endsWith('@adopt'))).toBe(true)
  })

  it('COUNTER-TRIAL: one opening the picture refuted and the reading is not adopted', () => {
    const m = house()
    const a = facadeAdoption(reading(), 'FRONT', m, [view], modelRevision(m), (k) => (k === 'open:sDoor' ? 'REJECTED_BY_SOURCE' : undefined))
    expect(a.decision).toBe('NOT_ADOPTED')
    expect(a.proposals).toEqual([])
    expect(a.why).toMatch(/refutes 1/)
  })

  it('COUNTER-TRIAL: a reading the picture supports on too little is not adopted', () => {
    const m = house()
    const invented = [{ id: 'x1', kind: 'WINDOW', polygon: poly(boxOf(0.2, 0.7, 0.9, 2.1)) }, { id: 'x2', kind: 'WINDOW', polygon: poly(boxOf(8.9, 9.7, 0.9, 2.1)) }, { id: 'x3', kind: 'WINDOW', polygon: poly(boxOf(6.2, 7.0, 0.2, 0.7)) }]
    const a = facadeAdoption(reading(invented), 'FRONT', m, [view], modelRevision(m), none)
    expect(a.decision).toBe('NOT_ADOPTED')
    expect(a.supported / a.drawn).toBeLessThan(FACADE_ADOPTION.minSupportedShare)
  })

  it('a model opening the picture seemed to support goes only where the reading explains its edges (a finish boundary through its box)', () => {
    const m = house()
    const across = facadeAdoption(reading(), 'FRONT', m, [view], modelRevision(m), (k) => (k === 'rem:Z' ? 'REJECTED_BY_SOURCE' : undefined))
    const z = across.proposals.find((q) => q.targetId === 'Z')
    expect((z?.patch as { explained?: string }).explained).toMatch(/LIGHT_RENDER zone w-light and TIMBER zone w-timber/)
    // COUNTER-TRIAL: the same opening inside ONE zone is not explained: the picture's support for it stands
    const oneZone = { ...reading(), walls: [{ id: 'w-all', class: 'LIGHT_RENDER', polygon: poly(boxOf(0, 10, 0, 2.8)), host: 'main', visibility: 'VISIBLE' }] } as unknown as ElevationSketch
    const inside = facadeAdoption(oneZone, 'FRONT', m, [view], modelRevision(m), (k) => (k === 'rem:Z' ? 'REJECTED_BY_SOURCE' : undefined))
    expect(inside.decision).toBe('ADOPTED')
    expect(inside.proposals.some((q) => q.targetId === 'Z')).toBe(false)
  })

  it('the executor honours `adopt` only for a SKETCH proposal on an adopted frame, and never marks the element source-verified', () => {
    const m = phantomHouse() // no joint place free and no claims given: the gate alone is UNDECIDED for every correction
    const upd = (id: string, origin: 'SKETCH' | 'REVIEW' = 'SKETCH'): CorrectionProposal => ({ ...prop(m, { proposalId: id, operation: 'UPDATE_OPENING', targetId: 'P1', patch: { box: b4(REAL.A), kind: 'WINDOW', adopt: true } }), origin }) as CorrectionProposal
    const notAdopted = executeCorrections({ model: m, views: [view], pictures: [picture], proposals: [upd('a1')] })
    expect(notAdopted.records[0].code).toBe('SOURCE_UNDECIDED')
    const reviewer = executeCorrections({ model: m, views: [view], pictures: [picture], adopted: new Set([FRAME]), proposals: [upd('a2', 'REVIEW')] })
    expect(reviewer.records[0].code).toBe('SOURCE_UNDECIDED')
    const adopted = executeCorrections({ model: m, views: [view], pictures: [picture], adopted: new Set([FRAME]), proposals: [upd('a3')] })
    expect(adopted.records[0].status).toBe('COMMITTED')
    expect(adopted.records[0].gate?.adopted).toBe(true)
    expect(adopted.records[0].measure?.sourceVerified).toBe(false)
  })
})

// ---- v3.54.18: per-property arbitration ---------------------------------------------------------------------------------
describe('v3.54.18 per-property arbitration: the plan keeps the span, the reading replaces what was ASSUMED', () => {
  const EV_ASSUMED = { status: 'ASSUMED', interpretation: 'a 1.20 m gap in the front wall, no callout read, not read on an elevation', properties: { offset: 'SOURCE_DERIVED', width: 'SOURCE_DERIVED', sill: 'ASSUMED', height: 'ASSUMED', head: 'SOURCE_DERIVED', kind: 'ASSUMED' } }
  const EV_PRINTED = { status: 'SOURCE_CORROBORATED', interpretation: 'a 1.20 m gap in the front wall, printed 120/120', properties: { offset: 'SOURCE_DERIVED', width: 'SOURCE_EXACT', sill: 'SOURCE_DERIVED', height: 'SOURCE_EXACT', head: 'SOURCE_DERIVED', kind: 'VISUAL_INFERRED' } }
  // the picture: window A with a framed panel of the same width directly above and below it (a spandrel) — the tall box
  // the model assumed (0.5–2.4 m) and the window the reading draws (0.9–2.1 m) both sit on strong drawn edges
  const faint = (): BindPicture => {
    const data = new Uint8ClampedArray(RASTER.data)
    const [x0, x1] = REAL.A
    const panel = (y0: number, y1: number): void => {
      for (let y = row(y1); y <= row(y0); y += 1) for (let x = col(x0); x <= col(x1); x += 1) {
        const frame = x - col(x0) < 3 || col(x1) - x < 3 || y - row(y1) < 3 || row(y0) - y < 3
        data.set(frame ? [250, 250, 250, 255] : [70, 80, 92, 255], (y * W + x) * 4)
      }
    }
    panel(0.5, 0.9)
    panel(2.1, 2.4)
    return { ...picture, raster: { width: W, height: H, data }, sourceByteHash: 'd'.repeat(64) }
  }
  const house = (ev: unknown): CanonicalBuildingModel => {
    const cmds = [
      { type: 'createBuilding', id: 'b', name: 'pp' },
      { type: 'createLevel', id: 'l0', name: 'Ground', index: 0, elevation: 0, height: 2.8 },
      { type: 'createWallRing', id: 'g', levelId: 'l0', polygon: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 8 }, { x: 0, z: 8 }], thickness: 0.3, height: 2.8, baseOffset: 0, kind: 'EXTERIOR', cornerOwnership: 'ALTERNATE' },
      // the plan's gap where window A is; its sill and height are the default 0.9 / 1.3 → drawn 0.2 m too tall
      { type: 'cutOpening', id: 'A', wallId: 'g-w0', kind: 'WINDOW', offset: 1.0, sill: 0.5, width: 1.2, height: 1.9, evidence: ev },
      { type: 'placeWindow', id: 'A-unit', openingId: 'A' },
    ] as BuildingCommand[]
    const r = applyCommands(createEmptyModel('m-pp', 'pp'), cmds)
    if (r.failedAt !== undefined) throw new Error(`fixture: ${JSON.stringify(r.results[r.failedAt])}`)
    return r.model
  }
  const update = (m: CanonicalBuildingModel, box = b4(REAL.A)): CorrectionProposal => prop(m, { proposalId: `pp-${Math.round(box.x0)}`, operation: 'UPDATE_OPENING', targetId: 'A', patch: { box, kind: 'WINDOW' } })

  it('an update that keeps the plan-traced span and changes only ASSUMED sill and height needs the picture not to refute it', () => {
    const pic = faint()
    const m = house(EV_ASSUMED)
    const out = executeCorrections({ model: m, views: [view], pictures: [pic], proposals: [update(m)] })
    const g = out.records[0].gate as { winner: string; proposedZ: number | null; currentZ?: number | null; crossWitness?: string }
    // the gate alone keeps the ASSUMED tall box (it ends on the spandrel's edges and outscores the window)
    expect(g.winner).toBe('CURRENT')
    expect(g.proposedZ ?? 0).toBeGreaterThanOrEqual(2)
    expect(g.crossWitness).toBe('PLAN_SPAN')
    expect(out.records[0].status).toBe('COMMITTED')
    expect(out.model.openings.find((o) => o.id === 'A')?.sill).toBeCloseTo(0.9, 1)
    expect(out.model.openings.find((o) => o.id === 'A')?.height).toBeCloseTo(1.2, 1)
  })

  it('COUNTER-TRIALS: a printed height is never replaced this way; another stretch of wall is not the same opening', () => {
    const pic = faint()
    const printed = house(EV_PRINTED)
    const a = executeCorrections({ model: printed, views: [view], pictures: [pic], proposals: [update(printed)] })
    expect((a.records[0].gate as { crossWitness?: string }).crossWitness).toBeUndefined()
    const m = house(EV_ASSUMED)
    const moved = executeCorrections({ model: m, views: [view], pictures: [pic], proposals: [update(m, boxOf(2.9, 4.1, 0.9, 2.1))] })
    expect((moved.records[0].gate as { crossWitness?: string } | undefined)?.crossWitness).toBeUndefined()
    expect(moved.records[0].status).not.toBe('COMMITTED')
    expect(a.records[0].status).toBe('REJECTED_BY_SOURCE') // the printed 120/120 box stands where the picture scores it higher
  })
})
