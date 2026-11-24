/**
 * v3.54.19 — openings: the plan's gap as the witness of a door the elevation does not show by contrast; a door's head cut
 * to its wall; an opening running a little past its wall's end; the consumer of GLAZED_WALL. A controlled bare wall and
 * synthetic pictures (not a benchmark house); every rule with its counter-trial.
 */
import { describe, expect, it } from 'vitest'
import { applyCommands } from '@buildapp/commands'
import type { BuildingCommand } from '@buildapp/commands'
import { createEmptyModel } from '@buildapp/model'
import type { CanonicalBuildingModel } from '@buildapp/model'
import { executeCorrections, modelRevision } from '../src/consult/correct/execute.js'
import type { BindPicture, BindView, CorrectionProposal, PlanGap } from '../src/consult/correct/execute.js'
import { GLAZED_WALL_FLOOR_M, proposalsFromSketch } from '../src/consult/correct/from-sketch.js'
import type { ElevationSketch } from '../src/appearance/elevation-sketch.js'

const MPP = 0.025
const ALONG0 = -1.25
const ZERO = 400
const [W, H] = [500, 420]
const col = (x: number): number => Math.round((x - ALONG0) / MPP)
const row = (y: number): number => Math.round(ZERO - y / MPP)
const boxOf = (x0: number, x1: number, y0: number, y1: number): { x0: number; y0: number; x1: number; y1: number } => ({ x0: col(x0), x1: col(x1), y0: row(y1), y1: row(y0) })
const FRAME = 'frame-front'
/** A rendered wall 10 m long and 2.8 m high under a roof, with NOTHING drawn in it: a door of the wall's own tone. */
const plainWall = (): BindPicture => {
  const data = new Uint8ClampedArray(W * H * 4)
  let seed = 11
  const rnd = (): number => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const n = Math.round((rnd() - 0.5) * 18)
    const inWall = x >= col(0) && x <= col(10) && y <= row(0) && y >= row(2.8)
    const inRoof = x >= col(-0.4) && x <= col(10.4) && y < row(2.8) && y >= row(5.4)
    const c = inWall ? [228 + n, 218 + n, 198 + n] : inRoof ? [92 + n, 92 + n, 98 + n] : y > row(0) ? [120 + n, 150 + n, 100 + n] : [225, 235, 245]
    data.set([c[0], c[1], c[2], 255], (y * W + x) * 4)
  }
  return { n: 1, frameId: FRAME, projection: 'ORTHOGRAPHIC_ELEVATION', transform: { x0: 0, y0: 0, scale: 1 }, raster: { width: W, height: H, data }, sourceByteHash: 'e'.repeat(64) }
}
const view: BindView = { side: 'FRONT', frameId: FRAME, projection: { mpp: MPP, alongAtPx0: ALONG0, alongSign: 1, zeroRow: ZERO }, heights: true, roofAnchored: true, origin: 'ANALYZER', alongErrorM: 0.03, heightErrorM: 0.05 }
const bare = (): CanonicalBuildingModel => {
  const r = applyCommands(createEmptyModel('m-bare', 'bare'), [
    { type: 'createBuilding', id: 'b', name: 'bare' },
    { type: 'createLevel', id: 'l0', name: 'Ground', index: 0, elevation: 0, height: 2.8 },
    { type: 'createWallRing', id: 'g', levelId: 'l0', polygon: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 8 }, { x: 0, z: 8 }], thickness: 0.3, height: 2.8, baseOffset: 0, kind: 'EXTERIOR', cornerOwnership: 'ALTERNATE' },
  ] as BuildingCommand[])
  if (r.failedAt !== undefined) throw new Error(`fixture: ${JSON.stringify(r.results[r.failedAt])}`)
  return r.model
}
const add = (m: CanonicalBuildingModel, kind: string, x0: number, x1: number, y1 = 2.1, y0 = 0): CorrectionProposal => ({ baseRevision: modelRevision(m), proposalId: `${kind}-${x0}-${y1}`, operation: 'ADD_OPENING', targetId: 'FRONT', frameId: FRAME, origin: 'SKETCH', uncertainty: 'MEDIUM', justification: 'test', patch: { box: boxOf(x0, x1, y0, y1), kind } }) as CorrectionProposal
const gap = (a0: number, a1: number, storeyLo = 0): PlanGap => ({ id: `plan-gap-${a0}`, side: 'FRONT', a0, a1, storeyLo, storeyHi: storeyLo + 2.8 })
const run = (m: CanonicalBuildingModel, p: CorrectionProposal, gaps: PlanGap[] = []) => executeCorrections({ model: m, views: [view], pictures: [plainWall()], ...(gaps.length > 0 ? { planGaps: gaps } : {}), proposals: [p] }).records[0]

describe('v3.54.19 a door the elevation does not show by contrast, standing on a gap the plan draws', () => {
  it('REPRODUCES the loss: on the picture alone the door is refused; with the plan\'s gap under it, it is built — a cross-witness, never source-verified', () => {
    const m = bare()
    const alone = run(m, add(m, 'DOOR', 4.5, 5.5))
    expect(alone.status).not.toBe('COMMITTED')
    const withGap = run(m, add(m, 'DOOR', 4.5, 5.5), [gap(4.45, 5.55)])
    expect(withGap.status, withGap.why).toBe('COMMITTED')
    expect((withGap.gate as { crossWitness?: string }).crossWitness).toBe('PLAN_GAP')
    expect(withGap.measure?.sourceVerified).not.toBe(true)
  })
  it('counter-trials: a WINDOW on the same gap still needs the picture; a door beside the gap, or on another storey\'s gap, has no witness', () => {
    const m = bare()
    expect(run(m, add(m, 'WINDOW', 4.5, 5.5, 2.1, 0.9), [gap(4.45, 5.55)]).status).not.toBe('COMMITTED')
    expect(run(m, add(m, 'DOOR', 6.5, 7.5), [gap(4.45, 5.55)]).status).not.toBe('COMMITTED')
    expect(run(m, add(m, 'DOOR', 4.5, 5.5), [gap(4.45, 5.55, 2.8)]).status).not.toBe('COMMITTED')
  })
  it('a garage door and a glazed door are doors too', () => {
    const m = bare()
    expect(run(m, add(m, 'GARAGE_DOOR', 6.0, 8.6, 2.3), [gap(6.0, 8.6)]).status).toBe('COMMITTED')
    expect(run(m, add(m, 'GLAZED_DOOR', 1.0, 2.8, 2.2), [gap(1.0, 2.8)]).status).toBe('COMMITTED')
  })
})

describe('v3.54.19 a door drawn a little past the wall it stands in', () => {
  it('its head a few centimetres above the wall\'s top is cut to the wall; counter-trial: more than a quarter of its height above is another storey\'s business', () => {
    const m = bare()
    const cut = run(m, add(m, 'DOOR', 4.5, 5.5, 3.05), [gap(4.45, 5.55)])
    expect(cut.status, cut.why).toBe('COMMITTED')
    const hc = (cut.bound as { headCut?: { fromM: number; toM: number } }).headCut
    expect(hc?.fromM).toBeCloseTo(3.05, 1)
    expect(hc?.toM).toBeCloseTo(2.77, 2)
    const far = run(m, add(m, 'DOOR', 4.5, 5.5, 3.9), [gap(4.45, 5.55)])
    expect(far.status).not.toBe('COMMITTED')
    expect(far.code).toBe('NO_HOST_WALL')
  })
  it('its span a few centimetres past the wall\'s end is cut back to the end; counter-trial: half of it outside the wall is not this wall\'s opening', () => {
    const m = bare()
    const clipped = run(m, add(m, 'GARAGE_DOOR', 7.6, 10.2, 2.2), [gap(7.6, 10.0)])
    expect(clipped.status, clipped.why).toBe('COMMITTED')
    const ec = (clipped.bound as { endClip?: { fromM: [number, number]; toM: [number, number] } }).endClip
    expect(ec?.toM[1]).toBeLessThanOrEqual(10)
    expect(ec?.toM[1]).toBeGreaterThan(9.9)
    const half = run(m, add(m, 'GARAGE_DOOR', 8.8, 11.2, 2.2), [gap(8.8, 10.0)])
    expect(half.status).not.toBe('COMMITTED')
  })
})

describe('v3.54.19 GLAZED_WALL has a consumer', () => {
  const sk = (openings: Array<{ id: string; kind: string; polygon: Array<[number, number]> }>) => ({ sketchId: 's', frameId: FRAME, openings, elements: [], walls: [], roofs: [] }) as unknown as ElevationSketch
  const poly = (x0: number, x1: number, y0: number, y1: number): Array<[number, number]> => { const b = boxOf(x0, x1, y0, y1); return [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]] }
  it('a glazing that reaches the floor is proposed as a glazed door, one on a sill as a window — it was dropped as "no consumer"', () => {
    const m = bare()
    const toFloor = proposalsFromSketch(sk([{ id: 'gw1', kind: 'GLAZED_WALL', polygon: poly(1, 4, 0.05, 2.4) }]), 'FRONT', m, [view], modelRevision(m))
    expect(toFloor.proposals).toHaveLength(1)
    expect(toFloor.proposals[0]).toMatchObject({ operation: 'ADD_OPENING', patch: { kind: 'GLAZED_DOOR' } })
    const onSill = proposalsFromSketch(sk([{ id: 'gw2', kind: 'GLAZED_WALL', polygon: poly(1, 4, 0.9, 2.4) }]), 'FRONT', m, [view], modelRevision(m))
    expect(onSill.proposals[0]).toMatchObject({ operation: 'ADD_OPENING', patch: { kind: 'WINDOW' } })
    expect(GLAZED_WALL_FLOOR_M).toBe(0.35)
  })
  it('counter-trial: a kind the registry does not know is still named as skipped, not guessed', () => {
    const m = bare()
    const unknown = proposalsFromSketch(sk([{ id: 'x', kind: 'SHUTTER', polygon: poly(1, 2, 0.9, 2.1) }]), 'FRONT', m, [view], modelRevision(m))
    expect(unknown.proposals).toHaveLength(0)
    expect(unknown.skipped.length).toBeGreaterThan(0)
  })
})
