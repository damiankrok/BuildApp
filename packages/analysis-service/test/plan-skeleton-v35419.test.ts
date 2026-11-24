/**
 * v3.54.19 — the plan skeleton and BUILD_INTERIOR.
 *
 * A controlled sheet (not a benchmark house): a 9 × 6.6 m body at 3 cm/px whose walls are FILLED MID GREY with thin black
 * outlines — the style the partition reader's fixed "dark ink" rule could not see — with one partition, one interior door
 * gap, one window (glazing lines in its gap) and one clear door gap in the exterior walls. Every assertion has a cause and
 * a counter-trial.
 */
import { describe, expect, it } from 'vitest'
import { applyCommands } from '@buildapp/commands'
import type { BuildingCommand } from '@buildapp/commands'
import { createEmptyModel } from '@buildapp/model'
import type { CanonicalBuildingModel } from '@buildapp/model'
import type { Raster } from '@buildapp/source-cv'
import { executeCorrections, modelRevision } from '../src/consult/correct/execute.js'
import type { CorrectionProposal } from '../src/consult/correct/execute.js'
import { interiorRuns, planGapsFromSkeleton, resolveOverlaps, skeletonInModel } from '../src/consult/correct/interior.js'
import { bodyCommands, pointWithFront } from '../src/consult/massing/massing.js'
import { edgesOf, insetOutline, paintWalls, readPlanSkeleton, slabsOf, snapOutline, wallInkOf } from '../src/consult/plan-skeleton.js'

const S = 0.03 // m per px
const [X0, Y0, X1, Y1] = [60, 50, 360, 270] // outer faces: 9.0 × 6.6 m
const T = 12 // exterior wall, px (0.36 m)
const PART_X = 200 // partition centre line
const PART_T = 5

type Opt = { fill?: [number, number, number]; outlineOnly?: boolean }
function sheet(o: Opt = {}): Raster {
  const [W, H] = [420, 320]
  const data = new Uint8ClampedArray(W * H * 4).fill(255)
  const set = (x: number, y: number, c: [number, number, number]): void => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2] }
  const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]): void => { for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) set(x, y, c) }
  const fill = o.fill ?? [128, 128, 128]
  const BLACK: [number, number, number] = [10, 10, 10]
  const WHITE: [number, number, number] = [255, 255, 255]
  const band = (x0: number, y0: number, x1: number, y1: number): void => { rect(x0, y0, x1, y1, BLACK); if (!o.outlineOnly) rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, fill); else rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, WHITE) }
  band(X0, Y0, X1, Y0 + T) // top (rear) wall
  band(X0, Y1 - T, X1, Y1) // bottom (front) wall
  band(X0, Y0, X0 + T, Y1) // left
  band(X1 - T, Y0, X1, Y1) // right
  // a window in the top wall at x 100..140: the gap is paper with two glazing lines along it
  rect(100, Y0, 140, Y0 + T, WHITE)
  rect(100, Y0 + 4, 140, Y0 + 4, BLACK)
  rect(100, Y0 + 8, 140, Y0 + 8, BLACK)
  // a clear door gap in the bottom wall at x 250..280 (0.9 m)
  rect(250, Y1 - T, 280, Y1, WHITE)
  // the partition, top wall to bottom wall, with a door gap at y 150..180 (0.9 m)
  band(PART_X - 2, Y0 + T, PART_X + 2, Y1 - T)
  rect(PART_X - 2, 150, PART_X + 2, 180, WHITE)
  // furniture: a thin grey line that meets no wall
  rect(90, 200, 150, 200, [150, 150, 150])
  return { width: W, height: H, data }
}
const OUTLINE: Array<[number, number]> = [[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1]]
/** The outline as a reader traces it: every edge a few pixels off the face. */
const TRACED: Array<[number, number]> = [[X0 - 3, Y0 + 2], [X1 + 2, Y0 + 2], [X1 + 2, Y1 - 3], [X0 - 3, Y1 - 3]]
const read = (raster: Raster, outline = TRACED) => readPlanSkeleton({ frameId: 'frame-plan', sourceByteHash: 'h', raster, outlinePx: outline, mPerPx: S })

describe('v3.54.19 the sheet says how it draws a wall', () => {
  it('walls filled mid grey are this sheet\'s wall colour (the fixed dark-ink rule saw only their outlines)', () => {
    const ink = wallInkOf(sheet(), TRACED)
    expect(ink.filled).toBe(true)
    expect(Math.abs(ink.rgb[0] - 128)).toBeLessThanOrEqual(8)
    expect(ink.share).toBeGreaterThan(0.5)
    // painted, the band is ink for the partition reader
    const p = paintWalls(sheet(), ink)
    const i = ((Y0 + 6) * p.width + 200) * 4
    expect(p.data[i]).toBe(0)
  })
  it('counter-trial: walls drawn as outlines only leave a paper band — named, nothing is read', () => {
    const sk = read(sheet({ outlineOnly: true }))
    expect(sk.ink.filled).toBe(false)
    expect(sk.refused.join(' ')).toMatch(/WALL_STYLE/)
    expect(sk.walls).toHaveLength(0)
    expect(sk.gaps).toHaveLength(0)
  })
  it('black-filled walls need no painting and read the same', () => {
    const sk = read(sheet({ fill: [12, 12, 12] }))
    expect(sk.refused).toEqual([])
    expect(sk.walls.length).toBeGreaterThanOrEqual(2)
  })
})

describe('v3.54.19 the traced outline is put on the wall bands', () => {
  it('each edge moves onto the outer face of its band, and the band\'s thickness is measured', () => {
    const r = sheet()
    const snap = snapOutline(paintWalls(r, wallInkOf(r, TRACED)), TRACED)
    const xs = snap.outlinePx.map((q) => q[0])
    const ys = snap.outlinePx.map((q) => q[1])
    expect(Math.abs(Math.min(...xs) - X0)).toBeLessThanOrEqual(1)
    expect(Math.abs(Math.max(...xs) - X1)).toBeLessThanOrEqual(1)
    expect(Math.abs(Math.min(...ys) - Y0)).toBeLessThanOrEqual(1)
    expect(Math.abs(Math.max(...ys) - Y1)).toBeLessThanOrEqual(1)
    expect(Math.abs(snap.wallPx - (T + 1))).toBeLessThanOrEqual(2)
    expect(snap.snapped.length).toBe(4)
  })
  it('counter-trial: an outline nowhere near a wall band is left as traced', () => {
    const far: Array<[number, number]> = [[150, 110], [330, 110], [330, 230], [150, 230]]
    const r = sheet()
    const snap = snapOutline(paintWalls(r, wallInkOf(r, OUTLINE)), far)
    // the left edge runs 50 px from the partition and 90 px from the outer wall: beyond the reach
    expect(snap.outlinePx[0][0]).toBe(150)
  })
  it('the inside of each edge follows the outline\'s direction of travel, either way round', () => {
    const cw = edgesOf(OUTLINE)
    const ccw = edgesOf([...OUTLINE].reverse())
    expect(cw.map((e) => e.face).sort()).toEqual(['BOTTOM', 'LEFT', 'RIGHT', 'TOP'])
    expect(ccw.map((e) => e.face).sort()).toEqual(['BOTTOM', 'LEFT', 'RIGHT', 'TOP'])
    // the top edge's inside is below it (larger y)
    expect(cw.find((e) => e.face === 'TOP')?.inward).toBe(1)
    expect(ccw.find((e) => e.face === 'TOP')?.inward).toBe(1)
  })
  it('an L is cut into slabs that tile it, and its inset keeps every corner', () => {
    const L: Array<[number, number]> = [[0, 0], [100, 0], [100, 40], [60, 40], [60, 90], [0, 90]]
    const slabs = slabsOf(L)
    const area = slabs.reduce((t, q) => t + (q.x1 - q.x0) * (q.y1 - q.y0), 0)
    expect(area).toBe(100 * 40 + 60 * 50)
    const inner = insetOutline(L, 10) as Array<[number, number]>
    expect(inner).toHaveLength(6)
    expect(inner).toContainEqual([10, 10])
    expect(inner).toContainEqual([50, 80])
    // a wing thinner than two wall thicknesses has no floor: its end edge would turn over — no inset
    expect(insetOutline([[0, 0], [100, 0], [100, 15], [60, 15], [60, 90], [0, 90]], 10)).toBeUndefined()
  })
})

describe('v3.54.19 what the plan draws inside the outline', () => {
  const sk = read(sheet())
  it('the partition is read in two pieces with its door gap between them, in the sheet\'s pixels', () => {
    expect(sk.refused).toEqual([])
    const onLine = sk.walls.filter((w) => w.axis === 'V' && Math.abs(w.at - PART_X) <= 2)
    expect(onLine).toHaveLength(2)
    expect(sk.doors).toHaveLength(1)
    expect(sk.doors[0].axis).toBe('V')
    expect(Math.abs(sk.doors[0].from - 150)).toBeLessThanOrEqual(3)
    expect(Math.abs(sk.doors[0].to - 180)).toBeLessThanOrEqual(3)
    // the furniture line meets no wall: not a partition
    expect(sk.walls.some((w) => w.axis === 'H' && Math.abs(w.at - 200) <= 2)).toBe(false)
  })
  it('the gaps of the exterior walls: the window with its glazing lines, the door gap clear', () => {
    const top = sk.gaps.filter((g) => g.face === 'TOP')
    const bottom = sk.gaps.filter((g) => g.face === 'BOTTOM')
    expect(top).toHaveLength(1)
    expect(bottom).toHaveLength(1)
    expect(Math.abs(top[0].from - 100)).toBeLessThanOrEqual(2)
    expect(Math.abs(top[0].to - 140)).toBeLessThanOrEqual(2)
    expect(top[0].lines).toBe(true)
    expect(Math.abs(bottom[0].from - 250)).toBeLessThanOrEqual(2)
    expect(bottom[0].lines).toBe(false)
    // a wall without a gap gives none
    expect(sk.gaps.filter((g) => g.face === 'LEFT' || g.face === 'RIGHT')).toHaveLength(0)
  })
})

// ---- the model side -------------------------------------------------------------------------------------------------

function body(): CanonicalBuildingModel {
  const cmds: BuildingCommand[] = [
    { type: 'createBuilding', id: 'building', name: 't' } as BuildingCommand,
    { type: 'createLevel', id: 'lvl-0', name: 'Ground', index: 0, elevation: 0, height: 5.5 } as BuildingCommand,
    ...bodyCommands({ id: 'mass-main', rect: { minX: 0, maxX: 9, minZ: 0, maxZ: 6.6 }, roof: { kind: 'GABLE', ridgeAxis: 'X', pitchDeg: 30, eavesM: 3.2, ridgeM: 5.1 }, provenance: {} as never }, 'lvl-0', 0, [], 0.36),
  ]
  const res = applyCommands(createEmptyModel('t', 't'), cmds)
  if (res.failedAt !== undefined) throw new Error(JSON.stringify(res.results[res.failedAt]))
  return res.model
}
/** The controlled sheet's own frame: x from its left face, z up from its foot. */
const toModel = (px: number, py: number): { x: number; z: number } => ({ x: (px - X0) * S, z: (Y1 - py) * S })
const proposal = (m: CanonicalBuildingModel, origin: CorrectionProposal['origin'] = 'PLAN'): CorrectionProposal => ({ proposalId: 'interior:test', baseRevision: modelRevision(m), operation: 'BUILD_INTERIOR', targetId: 'WHOLE', origin, uncertainty: 'MEDIUM', justification: 'test' })

describe('v3.54.19 BUILD_INTERIOR', () => {
  const sk = read(sheet())
  const obs = skeletonInModel(sk, toModel)
  it('the skeleton in the model\'s frame: the partition runs along z at x 4.2 m, its door 2.7–3.6 m up from the front', () => {
    const w = obs.walls.filter((q) => q.axis === 'Z')
    expect(w).toHaveLength(2)
    expect(Math.abs(w[0].at - (PART_X - X0) * S)).toBeLessThan(0.08)
    expect(Math.abs(obs.doors[0].from - (Y1 - 180) * S)).toBeLessThan(0.12)
    const runs = interiorRuns(obs.walls, obs.doors)
    // one wall line with one door in it
    expect(runs).toHaveLength(1)
    expect(runs[0].doors).toHaveLength(1)
  })
  it('builds the partition and its door inside the body, through one committed transaction', () => {
    const m = body()
    const out = executeCorrections({ model: m, views: [], pictures: [], proposals: [proposal(m)], interior: obs })
    expect(out.records[0].status).toBe('COMMITTED')
    const iw = out.model.walls.filter((w) => w.kind === 'INTERIOR')
    expect(iw).toHaveLength(1)
    // from the front wall's inner face to the rear wall's inner face
    expect(Math.min(iw[0].start.z, iw[0].end.z)).toBeCloseTo(0.36, 2)
    expect(Math.max(iw[0].start.z, iw[0].end.z)).toBeCloseTo(6.6 - 0.36, 2)
    // under the eaves (3.2 m), at the assumed height at most
    expect(iw[0].height).toBeLessThanOrEqual(2.7)
    const doors = out.model.openings.filter((o) => o.wallId === iw[0].id)
    expect(doors).toHaveLength(1)
    expect(doors[0].width).toBeGreaterThan(0.75)
    // the exterior is untouched
    expect(out.model.walls.filter((w) => w.kind === 'EXTERIOR')).toEqual(m.walls)
    expect(out.model.roofs).toEqual(m.roofs)
  })
  it('counter-trials: an interior that is there is kept; a reviewer cannot ask for the operation; no skeleton, no walls', () => {
    const m = body()
    const once = executeCorrections({ model: m, views: [], pictures: [], proposals: [proposal(m)], interior: obs })
    const again = executeCorrections({ model: once.model, views: [], pictures: [], proposals: [{ ...proposal(once.model), proposalId: 'interior:again' }], interior: obs })
    expect(again.records[0].code).toBe('INTERIOR_PRESENT')
    expect(again.model.walls.length).toBe(once.model.walls.length)
    const review = executeCorrections({ model: m, views: [], pictures: [], proposals: [proposal(m, 'REVIEW')], interior: obs })
    expect(review.records[0].code).toBe('NOT_IN_REGISTRY')
    const none = executeCorrections({ model: m, views: [], pictures: [], proposals: [proposal(m)] })
    expect(none.records[0].code).toBe('NO_PLAN_SKELETON')
    // a plan read in another frame (its walls outside every body) builds nothing
    const off = skeletonInModel(sk, (px, py) => ({ x: (px - X0) * S + 40, z: (Y1 - py) * S }))
    const outside = executeCorrections({ model: m, views: [], pictures: [], proposals: [proposal(m)], interior: off })
    expect(outside.records[0].code).toBe('NO_PARTITION_INSIDE_A_BODY')
  })
  it('a body built turned against the sheet takes the skeleton turned with its outline', () => {
    // the sheet's LEFT side as the model's front: the body is 6.6 m wide and 9 m deep, the partition runs along x
    const frameOutline = [{ x: 0, z: 0 }, { x: 9, z: 0 }, { x: 9, z: 6.6 }, { x: 0, z: 6.6 }]
    const turned = skeletonInModel(sk, (px, py) => pointWithFront(toModel(px, py), 'LEFT', frameOutline))
    expect(turned.walls.every((w) => w.axis === 'X')).toBe(true)
    expect(Math.abs(turned.walls[0].at - 4.2)).toBeLessThan(0.08)
    // rigid, not mirrored: the sheet's foot (z = 0) is at the model's right (x = 6.6)
    const p = pointWithFront({ x: 2, z: 0 }, 'LEFT', frameOutline)
    expect(p).toEqual({ x: 6.6, z: 2 })
  })
  it('the plan\'s exterior gaps become witnesses on the side of the wall they lie in', () => {
    const gaps = planGapsFromSkeleton(body(), obs)
    const rear = gaps.filter((g) => g.side === 'REAR')
    const front = gaps.filter((g) => g.side === 'FRONT')
    expect(rear).toHaveLength(1)
    expect(front).toHaveLength(1)
    expect(rear[0].a0).toBeCloseTo((100 - X0) * S, 1)
    expect(front[0].a1).toBeCloseTo((280 - X0) * S, 1)
    // a gap that lies on no wall of the model witnesses nothing
    const shifted = { ...obs, gaps: obs.gaps.map((g) => ({ ...g, a: { x: g.a.x, z: g.a.z + 3 }, b: { x: g.b.x, z: g.b.z + 3 } })) }
    expect(planGapsFromSkeleton(body(), shifted).filter((g) => g.side === 'FRONT')).toHaveLength(0)
  })
})

describe('v3.54.19 a gap of the plan the model does not cover', () => {
  const sk = read(sheet())
  const obs = skeletonInModel(sk, toModel)
  const gapsOf = (m: CanonicalBuildingModel) => planGapsFromSkeleton(m, obs)
  const add = (m: CanonicalBuildingModel, gap: ReturnType<typeof gapsOf>[number], over: Partial<NonNullable<CorrectionProposal['planOpening']>> = {}, id = `plan-gap:${gap.id}`): CorrectionProposal => ({ proposalId: id, baseRevision: modelRevision(m), operation: 'ADD_PLAN_OPENING', targetId: gap.side, origin: 'PLAN', uncertainty: 'MEDIUM', planOpening: { side: gap.side, a0: gap.a0, a1: gap.a1, kind: 'DOOR', sillM: 0, heightM: 2.1, gapId: gap.id, frameId: 'frame-front', share: 0.9, ...over } })
  it('is cut where the plan has the gap, with the kind and heights the metric list gives — in one committed transaction', () => {
    const m = body()
    const front = gapsOf(m).find((g) => g.side === 'FRONT') as ReturnType<typeof gapsOf>[number]
    const out = executeCorrections({ model: m, views: [], pictures: [], proposals: [add(m, front)], planGaps: gapsOf(m) })
    expect(out.records[0].status).toBe('COMMITTED')
    const o = out.model.openings[0]
    expect(o.kind).toBe('DOOR')
    expect(o.width).toBeCloseTo(front.a1 - front.a0, 1)
    expect(o.sill).toBe(0)
    expect((o as { evidence?: { properties?: Record<string, string> } }).evidence?.properties).toMatchObject({ offset: 'SOURCE_DERIVED', sill: 'VISUAL_INFERRED' })
    expect(out.records[0].measure?.sourceVerified).toBeNull()
  })
  it('the element id follows the proposal\'s own name: the same gap builds the same id on a rebuilt base', () => {
    const m = body()
    const front = gapsOf(m).find((g) => g.side === 'FRONT') as ReturnType<typeof gapsOf>[number]
    const first = executeCorrections({ model: m, views: [], pictures: [], proposals: [add(m, front)], planGaps: gapsOf(m) })
    const again = executeCorrections({ model: m, views: [], pictures: [], proposals: [add(m, front, {}, `plan-gap:${front.id}@${modelRevision(m)}`)], planGaps: gapsOf(m) })
    expect(again.model.openings[0].id).toBe(first.model.openings[0].id)
  })
  it('counter-trials: no such gap, no opening; an opening that stands on a gap of the plan is not displaced; one on plain wall gives way', () => {
    const m = body()
    const gaps = gapsOf(m)
    const front = gaps.find((g) => g.side === 'FRONT') as (typeof gaps)[number]
    const noGap = executeCorrections({ model: m, views: [], pictures: [], proposals: [add(m, { ...front, id: 'plan-nowhere' })], planGaps: gaps })
    expect(noGap.records[0].code).toBe('NO_PLAN_GAP')
    const implausible = executeCorrections({ model: m, views: [], pictures: [], proposals: [add(m, front, { heightM: 9 })], planGaps: gaps })
    expect(implausible.records[0].status).not.toBe('COMMITTED')
    // an opening already on the gap: nothing is doubled
    const once = executeCorrections({ model: m, views: [], pictures: [], proposals: [add(m, front)], planGaps: gaps })
    const twice = executeCorrections({ model: once.model, views: [], pictures: [], proposals: [add(once.model, front, {}, 'plan-gap:second')], planGaps: gaps })
    expect(twice.records[0].code).toBe('OPENING_ALREADY_THERE')
    // an opening of the model that overlaps the gap a little and stands on NO gap of the plan: it gives way
    const frontWall = m.walls.find((w) => w.id === 'ring-mass-main-w0') as CanonicalBuildingModel['walls'][number]
    const phantom = applyCommands(m, [{ type: 'cutOpening', id: 'phantom', wallId: frontWall.id, kind: 'WINDOW', offset: front.a1 - 0.25, sill: 0.9, width: 2.2, height: 1.2 } as BuildingCommand]).model
    const out = executeCorrections({ model: phantom, views: [], pictures: [], proposals: [add(phantom, front)], planGaps: gapsOf(phantom) })
    expect(out.records[0].status).toBe('COMMITTED')
    expect(out.model.openings.map((o) => o.id)).not.toContain('phantom')
  })
})

describe('v3.54.19 read pieces never share plan area', () => {
  const P = (id: string, axis: 'X' | 'Z', at: number, from: number, to: number, half = 0.06) => ({ id, axis, at, half, from, to, doors: [], height: 2.7 })
  it('an end inside another wall\'s band stops at the band\'s face', () => {
    const out = resolveOverlaps([P('a', 'X', 2, 0, 4.03), P('b', 'Z', 4, 0, 5)])
    expect(out.find((p) => p.id === 'a')?.to).toBeCloseTo(3.94, 6)
    expect(out.find((p) => p.id === 'b')?.to).toBe(5)
  })
  it('of two walls that cross, the thinner is cut in two at the other\'s band', () => {
    const out = resolveOverlaps([P('thick', 'X', 2, 0, 6, 0.12), P('thin', 'Z', 3, 0, 5, 0.05)])
    const thin = out.filter((p) => p.id.startsWith('thin'))
    expect(thin).toHaveLength(2)
    expect(thin[0].to).toBeCloseTo(1.88, 6)
    expect(thin[1].from).toBeCloseTo(2.12, 6)
    expect(out.filter((p) => p.id === 'thick')).toHaveLength(1)
  })
  it('one wall found twice: the shorter gives way over the stretch they share', () => {
    const out = resolveOverlaps([P('long', 'X', 2, 0, 6), P('twin', 'X', 2.05, 1, 3)])
    expect(out.map((p) => p.id)).toEqual(['long'])
  })
  it('counter-trial: walls that only touch are left alone', () => {
    const input = [P('a', 'X', 2, 0, 3.94), P('b', 'Z', 4, 0, 5)]
    expect(resolveOverlaps(input)).toEqual(input)
  })
})
