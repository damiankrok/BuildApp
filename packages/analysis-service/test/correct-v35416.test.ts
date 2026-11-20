/**
 * v3.54.16 — the correction executor, the source gate and the quality states, on a controlled two-storey house whose
 * source elevation is drawn here and is the independent truth (windows A, B, D, E and a chimney drawn; C drawn and
 * missing from the model). Controlled defects are injected by the same commands the analyzer emits. The Council's
 * reproductions (checkProportions, ridgeAndEaves) are pinned on the repaired functions.
 */
import { describe, expect, it } from 'vitest'
import { applyCommands } from '@buildapp/commands'
import type { BuildingCommand } from '@buildapp/commands'
import { compileBuilding } from '@buildapp/geometry'
import { createEmptyModel, serializeModel } from '@buildapp/model'
import type { CanonicalBuildingModel } from '@buildapp/model'
import { buildMobileSceneBundle, serializeBundle } from '@buildapp/mobile-scene'
import { executeCorrections, modelRevision, objectDigests } from '../src/consult/correct/execute.js'
import type { BindPicture, BindView, CorrectionProposal } from '../src/consult/correct/execute.js'
import { capabilityPrompt, CAPABILITIES, PATCH_OPERATIONS } from '../src/consult/correct/registry.js'
import { qualityOf, reconcileLedger, settleDefects } from '../src/consult/correct/quality.js'
import type { DefectEntry } from '../src/consult/correct/quality.js'
import { compareFill, compareHypotheses } from '../src/consult/correct/source-gate.js'
import { proposalsFromSketch } from '../src/consult/correct/from-sketch.js'
import { checkProportions } from '../src/appearance/elevation-sketch.js'
import type { ElevationSketch } from '../src/appearance/elevation-sketch.js'
import { ridgeAndEaves } from '../src/consult/sketch-step.js'
import { usableGeometryFingerprint } from '../src/appearance/consumer.js'
import { MODEL_CHECK_SYSTEM } from '../src/consult/loop.js'

// ---- the controlled house --------------------------------------------------------------------------------------
const MPP = 0.025
const ALONG0 = -1.25 // x = 0 at column 50
const ZERO = 400 // y = 0 at row 400
const col = (x: number): number => Math.round((x - ALONG0) / MPP)
const row = (y: number): number => Math.round(ZERO - y / MPP)
const W = 500
const H = 420

const program = (extra: BuildingCommand[] = []): BuildingCommand[] =>
  [
    { type: 'createBuilding', id: 'b', name: 'controlled' },
    { type: 'createLevel', id: 'l0', name: 'Ground', index: 0, elevation: 0, height: 2.8 },
    { type: 'createLevel', id: 'l1', name: 'Upper', index: 1, elevation: 2.8, height: 2.8 },
    { type: 'createWallRing', id: 'g', levelId: 'l0', polygon: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 8 }, { x: 0, z: 8 }], thickness: 0.3, height: 2.8, baseOffset: 0, kind: 'EXTERIOR', cornerOwnership: 'ALTERNATE' },
    { type: 'createWallRing', id: 'u', levelId: 'l1', polygon: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 8 }, { x: 0, z: 8 }], thickness: 0.3, height: 2.8, baseOffset: 0, kind: 'EXTERIOR', cornerOwnership: 'ALTERNATE' },
    { type: 'cutOpening', id: 'A', wallId: 'g-w0', kind: 'WINDOW', offset: 1.0, sill: 0.9, width: 1.2, height: 1.2 },
    { type: 'placeWindow', id: 'A-unit', openingId: 'A' },
    { type: 'cutOpening', id: 'B', wallId: 'g-w0', kind: 'WINDOW', offset: 6.0, sill: 0.9, width: 1.2, height: 1.2 },
    { type: 'placeWindow', id: 'B-unit', openingId: 'B' },
    { type: 'cutOpening', id: 'D', wallId: 'u-w0', kind: 'WINDOW', offset: 6.0, sill: 0.9, width: 1.2, height: 1.2 },
    { type: 'placeWindow', id: 'D-unit', openingId: 'D' },
    { type: 'cutOpening', id: 'E', wallId: 'u-w0', kind: 'WINDOW', offset: 8.2, sill: 0.9, width: 1.2, height: 1.2 },
    { type: 'placeWindow', id: 'E-unit', openingId: 'E' },
    ...extra,
  ] as BuildingCommand[]

const build = (cmds: BuildingCommand[]): CanonicalBuildingModel => {
  const r = applyCommands(createEmptyModel('m-controlled', 'controlled'), cmds)
  if (r.failedAt !== undefined) throw new Error(`fixture: ${JSON.stringify(r.results[r.failedAt])}`)
  return r.model
}
const inject = (m: CanonicalBuildingModel, cmds: BuildingCommand[]): CanonicalBuildingModel => {
  const r = applyCommands(m, cmds)
  if (r.failedAt !== undefined) throw new Error(`injection: ${JSON.stringify(r.results[r.failedAt])}`)
  return r.model
}

/** The source elevation: textured render on the walls, roof band, sky, ground; windows and the stack drawn. */
function elevation(): BindPicture['raster'] {
  const data = new Uint8ClampedArray(W * H * 4)
  let seed = 7
  const rnd = (): number => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  const put = (x: number, y: number, c: [number, number, number]): void => {
    if (x < 0 || y < 0 || x >= W || y >= H) return
    data.set([c[0], c[1], c[2], 255], (y * W + x) * 4)
  }
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const n = Math.round((rnd() - 0.5) * 18)
    const inWall = x >= col(0) && x <= col(10) && y <= row(0) && y >= row(5.6)
    const inRoof = x >= col(-0.4) && x <= col(10.4) && y < row(5.6) && y >= row(8.4)
    const c: [number, number, number] = inWall ? [228 + n, 218 + n, 198 + n] : inRoof ? [92 + n, 92 + n, 98 + n + ((x % 9) < 2 ? 25 : 0)] : y > row(0) ? [120 + n, 150 + n, 100 + n] : [225, 235, 245]
    put(x, y, c)
  }
  const win = (x0: number, x1: number, y0: number, y1: number): void => {
    for (let y = row(y1); y <= row(y0); y += 1) for (let x = col(x0); x <= col(x1); x += 1) {
      const frame = x - col(x0) < 3 || col(x1) - x < 3 || y - row(y1) < 3 || row(y0) - y < 3
      put(x, y, frame ? [250, 250, 250] : [55, 66, 78])
    }
  }
  win(1.0, 2.2, 0.9, 2.1) // A
  win(6.0, 7.2, 0.9, 2.1) // B
  win(4.0, 4.8, 0.9, 2.1) // C (missing from the model)
  win(6.0, 7.2, 3.7, 4.9) // D
  win(8.2, 9.4, 3.7, 4.9) // E
  for (let y = row(9.2); y <= row(8.3); y += 1) for (let x = col(7.6); x <= col(8.2); x += 1) put(x, y, [150, 82, 60]) // the stack
  return { width: W, height: H, data }
}
const RASTER = elevation()
const FRAME = 'frame-front'
const picture: BindPicture = { n: 2, frameId: FRAME, projection: 'ORTHOGRAPHIC_ELEVATION', transform: { x0: 0, y0: 0, scale: 1 }, raster: RASTER, sourceByteHash: 'a'.repeat(64) }
const view: BindView = { side: 'FRONT', frameId: FRAME, projection: { mpp: MPP, alongAtPx0: ALONG0, alongSign: 1, zeroRow: ZERO }, heights: true, roofAnchored: true, origin: 'ANALYZER', alongErrorM: 0.03, heightErrorM: 0.05 }
const boxOf = (x0: number, x1: number, y0: number, y1: number): { x0: number; y0: number; x1: number; y1: number } => ({ x0: col(x0), x1: col(x1), y0: row(y1), y1: row(y0) })
const propose = (m: CanonicalBuildingModel, p: Partial<CorrectionProposal> & { operation: string }): CorrectionProposal => ({ proposalId: p.proposalId ?? `p-${Math.random().toString(36).slice(2, 8)}`, baseRevision: p.baseRevision ?? modelRevision(m), targetId: p.targetId ?? 'FRONT', frameId: p.frameId ?? FRAME, origin: 'CONTROL', uncertainty: 'LOW', ...p } as CorrectionProposal)
const run = (m: CanonicalBuildingModel, proposals: CorrectionProposal[], extra: Partial<Parameters<typeof executeCorrections>[0]> = {}) => executeCorrections({ model: m, views: [view], pictures: [picture], proposals, ...extra })
const unchangedExcept = (a: CanonicalBuildingModel, b: CanonicalBuildingModel, allowed: (k: string) => boolean): string[] => {
  const da = objectDigests(a)
  const db = objectDigests(b)
  return [...new Set([...da.keys(), ...db.keys()])].filter((k) => da.get(k) !== db.get(k) && !allowed(k))
}

describe('v3.54.16 registry: one declaration drives the prompt and the dispatch', () => {
  it('every operation has a consumer, a measure and a prompt line, and the reviewer prompt is generated from them', () => {
    for (const op of PATCH_OPERATIONS) {
      expect(CAPABILITIES[op].consumer.length).toBeGreaterThan(10)
      expect(CAPABILITIES[op].measure.length).toBeGreaterThan(10)
      expect(capabilityPrompt()).toContain(CAPABILITIES[op].prompt)
    }
    expect(MODEL_CHECK_SYSTEM).toContain(capabilityPrompt())
    expect(MODEL_CHECK_SYSTEM).not.toContain('Colour, materials, garden, people and shadows do not matter')
  })
})

describe('v3.54.16 lossless round trip of the model that stands', () => {
  it('serialize → parse → serialize is byte-identical, and the compiled scene of the reloaded model is the same bundle', () => {
    const m = build(program())
    const text = serializeModel(m)
    const back = JSON.parse(text) as CanonicalBuildingModel
    expect(serializeModel(back)).toBe(text)
    expect(serializeBundle(buildMobileSceneBundle(back, { scene: compileBuilding(back) }))).toBe(serializeBundle(buildMobileSceneBundle(m, { scene: compileBuilding(m) })))
    // an executor run with nothing to do returns the same model
    const out = run(m, [])
    expect(serializeModel(out.model)).toBe(text)
    expect(out.revision).toBe(out.baseRevision)
  })
})

describe('v3.54.16 proof 1: a window the source draws and the model lacks', () => {
  it('ADD_OPENING binds through the registration to the ground-floor front wall, is built, measured back in the source and nothing else moves', () => {
    const m = build(program())
    const out = run(m, [propose(m, { proposalId: 'add-C', operation: 'ADD_OPENING', patch: { box: boxOf(4.0, 4.8, 0.9, 2.1), kind: 'WINDOW' } })])
    const r = out.records[0]
    expect(r.status).toBe('COMMITTED')
    expect(r.bound?.hostId).toBe('g-w0')
    expect(r.gate?.winner).toBe('PROPOSED')
    expect(r.measure?.iouWithProposal).toBeGreaterThanOrEqual(0.85)
    expect(r.measure?.sourceVerified).toBe(true)
    const built = out.model.openings.find((o) => o.id === r.bound?.ids[0])
    expect(built?.wallId).toBe('g-w0')
    expect(Math.abs((built?.offset ?? 0) - 4.0)).toBeLessThan(0.06)
    expect(Math.abs((built?.width ?? 0) - 0.8)).toBeLessThan(0.06)
    expect(Math.abs((built?.sill ?? 0) - 0.9)).toBeLessThan(0.06)
    expect(unchangedExcept(m, out.model, (k) => k.startsWith('openings:op-fix') || k.startsWith('windows:op-fix') || k === 'meta')).toEqual([])
  })
  it('counter-trial: a window proposed on blank wall is refused by the source, not added', () => {
    const m = build(program())
    const out = run(m, [propose(m, { operation: 'ADD_OPENING', patch: { box: boxOf(8.4, 9.2, 0.9, 2.1), kind: 'WINDOW' } })])
    expect(out.records[0].status).toBe('REJECTED_BY_SOURCE')
    expect(serializeModel(out.model)).toBe(serializeModel(m))
  })
  it('a repeated proposal id is not applied twice; an opening where one already stands is a duplicate, never a second one', () => {
    const m = build(program())
    const seen = new Set<string>()
    const p = propose(m, { proposalId: 'same', operation: 'ADD_OPENING', patch: { box: boxOf(4.0, 4.8, 0.9, 2.1), kind: 'WINDOW' } })
    const first = run(m, [p], { seen })
    const again = run(first.model, [{ ...p, baseRevision: first.revision }], { seen })
    expect(again.records[0].status).toBe('DUPLICATE')
    const onA = run(m, [propose(m, { operation: 'ADD_OPENING', patch: { box: boxOf(1.0, 2.2, 0.9, 2.1), kind: 'WINDOW' } })])
    expect(onA.records[0].status).toBe('DUPLICATE')
  })
})

describe('v3.54.16 proof 2: a controlled wrong opening is repaired against the source, beyond the old 0.30 m guard', () => {
  it('moved 0.6 m: UPDATE_OPENING back to the drawn place is kept under the same id', () => {
    const m = inject(build(program()), [{ type: 'moveFeature', targetId: 'A', dAlong: 0.6 }])
    const out = run(m, [propose(m, { operation: 'UPDATE_OPENING', targetId: 'A', patch: { box: boxOf(1.0, 2.2, 0.9, 2.1), kind: 'WINDOW' } })])
    expect(out.records[0].status).toBe('COMMITTED')
    expect(out.records[0].gate?.winner).toBe('PROPOSED')
    const a = out.model.openings.find((o) => o.id === 'A')
    expect(Math.abs((a?.offset ?? 0) - 1.0)).toBeLessThan(0.06)
    expect(out.model.windows.find((w) => w.openingId === 'A')?.id).toBe('A-unit')
  })
  it('3 m wide against 1.2 m drawn: the width is repaired (a shared centre is not agreement)', () => {
    const m = inject(build(program()), [{ type: 'resizeFeature', targetId: 'A', width: 2.6 }])
    const out = run(m, [propose(m, { operation: 'UPDATE_OPENING', targetId: 'A', patch: { box: boxOf(1.0, 2.2, 0.9, 2.1), kind: 'WINDOW' } })])
    expect(out.records[0].status).toBe('COMMITTED')
    expect(Math.abs((out.model.openings.find((o) => o.id === 'A')?.width ?? 0) - 1.2)).toBeLessThan(0.06)
  })
  it('a storey too low: E is re-hosted to the upper wall at the same place along it', () => {
    const base = build(program())
    const m = inject(base, [{ type: 'removeFeature', targetId: 'E', cascade: true }, { type: 'cutOpening', id: 'E', wallId: 'g-w0', kind: 'WINDOW', offset: 8.2, sill: 0.9, width: 1.2, height: 1.2 }, { type: 'placeWindow', id: 'E-unit', openingId: 'E' }])
    const out = run(m, [propose(m, { operation: 'UPDATE_OPENING', targetId: 'E', patch: { box: boxOf(8.2, 9.4, 3.7, 4.9), kind: 'WINDOW' } })])
    expect(out.records[0].status).toBe('COMMITTED')
    expect(out.model.openings.find((o) => o.id === 'E')?.wallId).toBe('u-w0')
  })
  it('counter-trial: a wrong move proposed against a correct model is refused — the source supports the model', () => {
    const m = build(program())
    const out = run(m, [propose(m, { operation: 'UPDATE_OPENING', targetId: 'A', patch: { box: boxOf(1.6, 2.8, 0.9, 2.1), kind: 'WINDOW' } })])
    expect(out.records[0].status).toBe('REJECTED_BY_SOURCE')
    expect(out.records[0].code).toBe('MODEL_BETTER_SUPPORTED')
    expect(serializeModel(out.model)).toBe(serializeModel(m))
  })
  it('REMOVE_OPENING takes out a false opening the source does not draw, and refuses to remove a drawn one', () => {
    const m = inject(build(program()), [{ type: 'cutOpening', id: 'F', wallId: 'g-w0', kind: 'WINDOW', offset: 8.4, sill: 0.9, width: 0.8, height: 1.2 }, { type: 'placeWindow', id: 'F-unit', openingId: 'F' }])
    const out = run(m, [propose(m, { operation: 'REMOVE_OPENING', targetId: 'F', patch: {} }), propose(m, { operation: 'REMOVE_OPENING', targetId: 'A', patch: {} })])
    expect(out.records.find((r) => r.targetId === 'F')?.status).toBe('COMMITTED')
    expect(out.records.find((r) => r.targetId === 'A')?.status).toBe('REJECTED_BY_SOURCE')
    expect(out.model.openings.some((o) => o.id === 'F')).toBe(false)
    expect(out.model.openings.some((o) => o.id === 'A')).toBe(true)
  })
})

describe('v3.54.16 proof 3: independent proposals stand or fall alone; a dependent group stands or falls together', () => {
  it('a correct chimney and a wrong window in one review: the chimney is built, the window refused, everything else unchanged', () => {
    const m = build(program())
    const out = run(m, [
      propose(m, { proposalId: 'chimney', operation: 'ADD_CHIMNEY', patch: { box: boxOf(7.6, 8.2, 8.3, 9.2) } }),
      propose(m, { proposalId: 'bad-window', operation: 'ADD_OPENING', patch: { box: boxOf(8.4, 9.2, 0.9, 2.1), kind: 'WINDOW' } }),
    ])
    expect(out.records.find((r) => r.proposalId === 'chimney')?.status).toBe('COMMITTED')
    expect(out.records.find((r) => r.proposalId === 'bad-window')?.status).toBe('REJECTED_BY_SOURCE')
    expect(out.model.chimneys).toHaveLength(1)
    const c = out.model.chimneys[0]
    expect(Math.abs(c.footprint.minX - 7.6)).toBeLessThan(0.06)
    expect(Math.abs(c.height - 9.2)).toBeLessThan(0.06)
    expect(out.transactions.filter((t) => t.decision === 'COMMITTED')).toHaveLength(1)
    expect(unchangedExcept(m, out.model, (k) => k.startsWith('chimneys:') || k === 'meta')).toEqual([])
  })
  it('a group with a good and a wrong window is undone as a whole (the shared rollback)', () => {
    const m = build(program())
    const out = run(m, [
      propose(m, { proposalId: 'good', group: 'g1', operation: 'ADD_OPENING', patch: { box: boxOf(4.0, 4.8, 0.9, 2.1), kind: 'WINDOW' } }),
      propose(m, { proposalId: 'bad', group: 'g1', operation: 'ADD_OPENING', patch: { box: boxOf(8.4, 9.2, 0.9, 2.1), kind: 'WINDOW' } }),
    ])
    expect(out.records.map((r) => r.status).sort()).toEqual(['GROUP_ROLLED_BACK', 'REJECTED_BY_SOURCE'])
    expect(serializeModel(out.model)).toBe(serializeModel(m))
  })
})

describe('v3.54.16 counter-examples of the contract', () => {
  it('a stale revision, an operation outside the registry, HIGH uncertainty and a picture that is not an elevation are refused by name', () => {
    const m = build(program())
    const out = run(m, [
      propose(m, { proposalId: 'stale', operation: 'ADD_OPENING', baseRevision: 'deadbeef0000', patch: { box: boxOf(4.0, 4.8, 0.9, 2.1), kind: 'WINDOW' } }),
      propose(m, { proposalId: 'form', operation: 'ROOF_FORM', patch: {} }),
      propose(m, { proposalId: 'high', operation: 'ADD_OPENING', uncertainty: 'HIGH', patch: { box: boxOf(4.0, 4.8, 0.9, 2.1), kind: 'WINDOW' } }),
      propose(m, { proposalId: 'plan', operation: 'ADD_OPENING', frameId: 'not-a-picture', patch: { box: boxOf(4.0, 4.8, 0.9, 2.1), kind: 'WINDOW' } }),
    ])
    const by = (id: string): string | undefined => out.records.find((r) => r.proposalId === id)?.status
    expect(by('stale')).toBe('STALE_REVISION')
    expect(by('form')).toBe('UNSUPPORTED_OPERATION')
    expect(by('high')).toBe('HELD')
    expect(by('plan')).toBe('INVALID')
  })
  it('an opening drawn across the floor between storeys has no host wall; one on a view without heights needs evidence', () => {
    const m = build(program())
    const across = run(m, [propose(m, { operation: 'ADD_OPENING', patch: { box: boxOf(4.0, 4.8, 2.2, 3.6), kind: 'WINDOW' } })])
    expect(across.records[0].code).toBe('NO_HOST_WALL')
    const noHeights = executeCorrections({ model: m, views: [{ ...view, heights: false, roofAnchored: false }], pictures: [picture], proposals: [propose(m, { operation: 'ADD_OPENING', patch: { box: boxOf(4.0, 4.8, 0.9, 2.1), kind: 'WINDOW' } })] })
    expect(noHeights.records[0].status).toBe('NEEDS_EVIDENCE')
  })
  it('SET_PARAMETER needs a printed value someone else read, the right unit, and restates the storey below with it', () => {
    const m = build(program())
    const p = (v: number, unit: 'm' | 'deg', id = 'lv') => propose(m, { proposalId: id, operation: 'SET_PARAMETER', targetId: 'l1', patch: { property: 'LEVEL_ELEVATION', value: v, unit, literal: `+${v.toFixed(2)}` } })
    expect(run(m, [p(2.95, 'deg')]).records[0].code).toBe('WRONG_UNIT')
    expect(run(m, [p(2.95, 'm')]).records[0].status).toBe('NEEDS_EVIDENCE')
    // audit A3: an equal number with no role and no anchor is not a witness any more
    expect(run(m, [p(2.95, 'm')], { witnesses: [{ valueM: 2.95, unit: 'm', frameId: 'section', by: 'ANALYZER' }] }).records[0].code).toBe('WITNESS_ROLE_MISMATCH')
    const ok = run(m, [p(2.95, 'm')], { witnesses: [{ valueM: 2.95, unit: 'm', frameId: 'section', by: 'METRIC_READ', role: 'FLOOR', sourceByteHash: 's'.repeat(64), literal: '+2.95' }] })
    expect(ok.records[0].status).toBe('COMMITTED')
    expect(ok.model.levels.find((l) => l.id === 'l1')?.elevation).toBe(2.95)
    expect(ok.model.levels.find((l) => l.id === 'l0')?.height).toBe(2.95)
    expect(ok.model.walls.filter((w) => w.levelId === 'l0').every((w) => w.height === 2.95)).toBe(true)
    expect(unchangedExcept(m, ok.model, (k) => k.startsWith('levels:') || k.startsWith('walls:g-') || k === 'meta')).toEqual([])
  })
  it('SET_FINISH paints the wall area the box covers and leaves the usable geometry alone', () => {
    const m = build(program())
    const out = run(m, [propose(m, { operation: 'SET_FINISH', patch: { box: { x0: col(0), x1: col(10), y0: row(2.8), y1: row(0) }, material: 'BRICK' } })])
    expect(out.records[0].status).toBe('COMMITTED')
    expect(out.model.surfaceRegions.length).toBeGreaterThan(0)
    expect(usableGeometryFingerprint(out.model)).toBe(usableGeometryFingerprint(m))
  })
  it('ASSIGN_VIEW registers an unregistered elevation for the openings placed through it in the same group; the wrong axis is refused', () => {
    const m = build(program())
    const add = propose(m, { proposalId: 'add', group: 'v', operation: 'ADD_OPENING', patch: { box: boxOf(4.0, 4.8, 0.9, 2.1), kind: 'WINDOW' } })
    const alone = executeCorrections({ model: m, views: [], pictures: [picture], proposals: [{ ...add, group: undefined }] })
    expect(alone.records[0].code).toBe('VIEW_NOT_REGISTERED')
    const assign = (side: 'FRONT' | 'LEFT') => propose(m, { proposalId: `assign-${side}`, group: 'v', operation: 'ASSIGN_VIEW', targetId: side, patch: { side, wallLeftX: col(0), wallRightX: col(10), groundY: row(0), eavesY: row(5.6) } })
    const good = executeCorrections({ model: m, views: [], pictures: [picture], proposals: [assign('FRONT'), add] })
    expect(good.records.map((r) => r.status)).toEqual(['COMMITTED', 'COMMITTED'])
    const wrong = executeCorrections({ model: m, views: [], pictures: [picture], proposals: [assign('LEFT'), { ...add, proposalId: 'add2' }] })
    expect(wrong.records.find((r) => r.operation === 'ASSIGN_VIEW')?.code).toBe('AXIS_MISMATCH')
    expect(serializeModel(wrong.model)).toBe(serializeModel(m))
  })
})

describe('v3.54.16 the sketch channel: typed elements become proposals, one to one', () => {
  it('pairs by overlap, proposes an UPDATE for a disagreeing pair, an ADD for an unpaired opening, a chimney once', () => {
    const m = inject(build(program()), [{ type: 'moveFeature', targetId: 'A', dAlong: 0.6 }])
    const poly = (b: { x0: number; y0: number; x1: number; y1: number }): Array<[number, number]> => [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]]
    const sketch = { schema: 'buildapp.elevation-sketch', schemaVersion: '1.1.0', sketchId: 's', frameId: FRAME, source: { imageSha256: 'a'.repeat(64), width: W, height: H, scale: 1 }, groundRow: ZERO, silhouette: null, roofs: [], walls: [], openings: [
      { id: 'sA', kind: 'WINDOW', polygon: poly(boxOf(1.0, 2.2, 0.9, 2.1)), host: '' },
      { id: 'sB', kind: 'WINDOW', polygon: poly(boxOf(6.0, 7.2, 0.9, 2.1)), host: '' },
      { id: 'sC', kind: 'WINDOW', polygon: poly(boxOf(4.0, 4.8, 0.9, 2.1)), host: '' },
    ], elements: [{ id: 'sK', kind: 'CHIMNEY', polygon: poly(boxOf(7.6, 8.2, 8.3, 9.2)) }], producer: { kind: 'API_CONTOUR_READING', model: 'x', promptVersion: 'x' }, refused: [], account: { parserVersion: 4, response: 'COMPLETE', completeness: 'COMPLETE', reasons: [], elements: [], unknownFields: [] } } as unknown as ElevationSketch
    const acc = proposalsFromSketch(sketch, 'FRONT', m, [view], modelRevision(m))
    expect(acc.agreed.map((a) => a.modelId)).toEqual(['B'])
    expect(acc.proposals.map((p) => `${p.operation}:${p.targetId}`).sort()).toEqual(['ADD_CHIMNEY:FRONT', 'ADD_OPENING:FRONT', 'UPDATE_OPENING:A'])
    const out = run(m, acc.proposals)
    expect(out.records.every((r) => r.status === 'COMMITTED')).toBe(true)
  })
})

describe('v3.54.16 Council reproductions on the repaired functions', () => {
  const sketchWith = (b: { x0: number; y0: number; x1: number; y1: number }): ElevationSketch => ({ schema: 'buildapp.elevation-sketch', schemaVersion: '1.1.0', sketchId: 's', frameId: FRAME, source: { imageSha256: 'a'.repeat(64), width: W, height: H, scale: 1 }, groundRow: ZERO, silhouette: null, roofs: [{ id: 'r', polygon: [[col(-0.4), row(5.6)], [col(10.4), row(5.6)], [col(10.4), row(8.4)], [col(-0.4), row(8.4)]] }], walls: [{ id: 'w', class: 'LIGHT_RENDER', polygon: [[col(0), row(0)], [col(10), row(0)], [col(10), row(5.6)], [col(0), row(5.6)]], host: '', visibility: 'VISIBLE' }], openings: [{ id: 'o', kind: 'WINDOW', polygon: [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]], host: '' }], elements: [], producer: { kind: 'API_CONTOUR_READING', model: 'x', promptVersion: 'x' }, refused: [], account: { parserVersion: 4, response: 'COMPLETE', completeness: 'COMPLETE', reasons: [], elements: [], unknownFields: [] } }) as unknown as ElevationSketch
  const expectation = (m: { a0: number; a1: number; b0: number; b1: number }) => ({ alongSign: 1, alongMin: 0, alongMax: 10, ridge: 8.4, eaves: 5.6, openings: [{ id: 'm', ...m }] })
  it('the same 2 m window matches; 0.4 m off along, 8 m against 2 m, and a storey higher are all OFF or unmatched — never ACCEPTED as the same', () => {
    const src = sketchWith(boxOf(3, 5, 0.9, 2.1))
    expect(checkProportions(src, expectation({ a0: 3, a1: 5, b0: 0.9, b1: 2.1 })).openings[0].status).toBe('MATCHED')
    expect(checkProportions(src, expectation({ a0: 3.4, a1: 5.4, b0: 0.9, b1: 2.1 })).openings[0].status).toBe('OFF')
    expect(checkProportions(src, expectation({ a0: 0, a1: 8, b0: 0.9, b1: 2.1 })).openings[0].status).toBe('OFF')
    const higher = checkProportions(src, expectation({ a0: 3, a1: 5, b0: 3.9, b1: 5.1 }))
    expect(higher.openings[0].status).toBe('NOT_IN_MODEL')
    expect(higher.missingInSketch).toEqual(['m'])
  })
  it('two ridges of two named bodies are not a dispute; two values on one body, or on marks naming no body, are', () => {
    expect(ridgeAndEaves([{ role: 'RIDGE', value: 6.28, hostHint: 'main roof' }, { role: 'RIDGE', value: 5.5, hostHint: 'wing' }, { role: 'EAVES', value: 3.27, hostHint: 'main roof' }])).toMatchObject({ ridge: 6.28, eaves: 3.27 })
    expect(ridgeAndEaves([{ role: 'RIDGE', value: 6.28, hostHint: 'main roof' }, { role: 'RIDGE', value: 6.1, hostHint: 'main roof' }]).ridge).toBeUndefined()
    expect(ridgeAndEaves([{ role: 'RIDGE', value: 6.28 }, { role: 'RIDGE', value: 5.5 }]).ridge).toBeUndefined()
  })
})

describe('v3.54.16 quality: review, verification and reuse are three facts', () => {
  const defect = (id: string, severity: 'KEY' | 'MINOR', operation: string) => ({ id, about: id, scope: 'FRONT' as const, severity, certainty: 'CERTAIN' as const, operation: operation as never })
  it('an applied patch closes its defect only when the look at the new revision agrees; otherwise it stays open', () => {
    const rec = { proposalId: 'g1:P1', operation: 'ADD_OPENING', targetId: 'LEFT', origin: 'REVIEW' as const, status: 'COMMITTED' as const, why: '', bound: { frameId: 'f', ids: ['op-1'] }, measure: { sourceVerified: true, why: '' } }
    const closed = settleDefects(1, [defect('D1', 'KEY', 'ADD_OPENING')], [{ proposalId: 'g1:P1', defectId: 'D1' }], [rec], new Map([['op-1', 'MATCHES']]), 'rev2', false)
    expect(closed[0].settlement).toBe('CLOSED_VERIFIED')
    const notLooked = settleDefects(1, [defect('D1', 'KEY', 'ADD_OPENING')], [{ proposalId: 'g1:P1', defectId: 'D1' }], [rec], undefined, undefined, false)
    expect(notLooked[0].settlement).toBe('APPLIED_NOT_REVIEWED')
    const wrong = settleDefects(1, [defect('D1', 'KEY', 'ADD_OPENING')], [{ proposalId: 'g1:P1', defectId: 'D1' }], [rec], new Map([['op-1', 'WRONG_PLACE']]), 'rev2', false)
    expect(wrong[0].settlement).toBe('APPLIED_REVIEW_DISAGREES')
  })
  it('VERIFIED only on the delivered revision with nothing open; an unsupported KEY defect is UNSUPPORTED_OPERATION; a measured contradiction is never cancelled by MATCHES', () => {
    const q0 = qualityOf({ looked: true, checkedRevision: 'r', deliveredRevision: 'r', lastStatus: 'VERIFIED_IN_SCOPE', defects: [], measuredContradictions: 0, pendingAtLimit: 0, attemptedForKey: 0, committedForKey: 0 })
    expect(q0.state).toBe('SOURCE_VERIFIED_IN_SCOPE')
    const q1 = qualityOf({ looked: true, checkedRevision: 'r', deliveredRevision: 'r', lastStatus: 'VERIFIED_IN_SCOPE', defects: [], measuredContradictions: 1, pendingAtLimit: 0, attemptedForKey: 0, committedForKey: 0 })
    expect(q1.state).toBe('RECOGNIZABLE_PARTIAL')
    const unsupported = settleDefects(2, [defect('D2', 'KEY', 'UNSUPPORTED')], [], [], undefined, undefined, false)
    const q2 = qualityOf({ looked: true, checkedRevision: 'r', deliveredRevision: 'r', lastStatus: 'ISSUE_FOUND', defects: unsupported, measuredContradictions: 0, pendingAtLimit: 0, attemptedForKey: 0, committedForKey: 0 })
    expect(q2.state).toBe('UNSUPPORTED_OPERATION')
    const q3 = qualityOf({ looked: true, checkedRevision: 'old', deliveredRevision: 'new', lastStatus: 'VERIFIED_IN_SCOPE', defects: [], measuredContradictions: 0, pendingAtLimit: 0, attemptedForKey: 0, committedForKey: 0 })
    expect(q3.reviewCompleted).toBe(false)
    expect(q3.state).not.toBe('SOURCE_VERIFIED_IN_SCOPE')
    expect(qualityOf({ looked: false, checkedRevision: null, deliveredRevision: 'r', lastStatus: null, defects: [], measuredContradictions: 0, pendingAtLimit: 0, attemptedForKey: 0, committedForKey: 0 }).state).toBe('NOT_REVIEWED')
  })
})

describe('v3.54.16 fact trace: acceptance in the producers words, effects bound to the governed parameter', () => {
  it('an ADMITTED span is not REFUSED, and a roof pitch moved for another reason does not make an applied length CHANGED', async () => {
    const { factTrace } = await import('../../../research/source-to-model/v35416/fact-trace.js')
    const same = { outlineX: 10, outlineZ: 5 }
    const out = factTrace({ localModel: { roofs: [{ id: 'roof-main', pitchDeg: 20 }] }, finalModel: { roofs: [{ id: 'roof-main', pitchDeg: 30 }] }, metricRead: { measured: { before: same, after: same }, applied: { readings: [{ proposalId: 'reading-a', status: 'APPLIED', valueCm: 100, why: 'test length' }], spans: [{ proposalId: 'span-a', status: 'ADMITTED', valueCm: 1365, why: 'admitted span' }] }, reads: [], resolution: { decisions: [] } } })
    const len = out.rows.find((r) => r.id === 'reading-a')
    const span = out.rows.find((r) => r.id === 'span-a')
    expect(len?.closure).toBe('NO_EFFECT')
    expect(len?.elementIds).toEqual([])
    expect(span?.closure).toBe('NO_EFFECT')
    expect(span?.status).toBe('ADMITTED')
    const moved = factTrace({ localModel: {}, finalModel: {}, metricRead: { measured: { before: same, after: { outlineX: 10.5, outlineZ: 5.2 } }, applied: { readings: [{ proposalId: 'r1', status: 'APPLIED', valueCm: 100, why: '' }], spans: [{ proposalId: 's1', status: 'ADMITTED', valueCm: 1365, why: '' }] }, reads: [], resolution: { decisions: [] } } })
    expect(moved.rows.filter((r) => r.class === 'LENGTH' || r.class === 'SPAN').every((r) => r.closure === 'CHANGED_JOINTLY')).toBe(true)
  })
})

// ================================================================================================================
// v3.54.16 audit (20.11.2026) A1–A4: each probe as the audit wrote it, and its correct counterpart
// ================================================================================================================

describe('v3.54.16 audit A1: a defect leaves the open set only by a stated closure, never by omission', () => {
  const roof: DefectEntry = { id: 'L1:roof', key: 'L1:roof', look: 1, about: 'missing gable roof', scope: 'ROOF', severity: 'KEY', certainty: 'CERTAIN', operation: 'UNSUPPORTED', family: 'ROOF_FORM', settlement: 'UNSUPPORTED_OPERATION', why: 'not repaired' }
  const base = { looked: true, checkedRevision: 'same-revision', deliveredRevision: 'same-revision', measuredContradictions: 0, pendingAtLimit: 0, attemptedForKey: 0, committedForKey: 0 }
  it('the audit probe: look 2 omits the KEY roof and says VERIFIED_IN_SCOPE on the same revision — the roof is still open', () => {
    const q = qualityOf({ ...base, lastStatus: 'VERIFIED_IN_SCOPE', defects: [], allDefects: [roof] })
    expect(q.state).toBe('UNSUPPORTED_OPERATION')
    expect(q.openKey).toBe(1)
    // with the later look named, the entry says it was carried over, not repeated
    const named = qualityOf({ ...base, lastStatus: 'VERIFIED_IN_SCOPE', defects: [], allDefects: [roof], lookRevision: new Map([[1, 'same-revision'], [2, 'same-revision']]), lastLook: 2 })
    expect(named.state).toBe('UNSUPPORTED_OPERATION')
    expect(named.defects[0].carriedFrom).toBe(1)
    expect(named.defects[0].why).toMatch(/omission is not closure/)
  })
  it('counterparts: an explicit NO_LONGER_DIFFERENT on a changed revision closes it on the reviewer\'s word; NOT_IN_SOURCE or the same revision is a dispute', () => {
    const revs = new Map([[1, 'rev-a'], [2, 'rev-b']])
    const moved = qualityOf({ ...base, checkedRevision: 'rev-b', deliveredRevision: 'rev-b', lastStatus: 'VERIFIED_IN_SCOPE', defects: [], allDefects: [roof], resolutions: [{ look: 2, revision: 'rev-b', defectId: 'L1:roof', verdict: 'NO_LONGER_DIFFERENT', note: 'the gable is there now' }], lookRevision: revs, lastLook: 2 })
    expect(moved.defects[0].settlement).toBe('RESOLVED_BY_REVIEW')
    expect(moved.openKey).toBe(0)
    expect(moved.state).toBe('RECOGNIZABLE_PARTIAL') // closed on the reviewer's word: never SOURCE_VERIFIED_IN_SCOPE
    expect(moved.closedReviewOnly).toBe(1)
    const sameRev = qualityOf({ ...base, lastStatus: 'VERIFIED_IN_SCOPE', defects: [], allDefects: [roof], resolutions: [{ look: 2, revision: 'same-revision', defectId: 'L1:roof', verdict: 'NO_LONGER_DIFFERENT', note: 'fine' }], lookRevision: new Map([[1, 'same-revision'], [2, 'same-revision']]), lastLook: 2 })
    expect(sameRev.defects[0].settlement).toBe('DISPUTED')
    expect(sameRev.state).toBe('NEEDS_EVIDENCE')
    const refuted = qualityOf({ ...base, checkedRevision: 'rev-b', deliveredRevision: 'rev-b', lastStatus: 'ISSUE_FOUND', defects: [], allDefects: [roof], resolutions: [{ look: 2, revision: 'rev-b', defectId: 'L1:roof', verdict: 'NOT_IN_SOURCE', note: 'flat roof drawn' }], lookRevision: revs, lastLook: 2 })
    expect(refuted.defects[0].settlement).toBe('DISPUTED')
    expect(refuted.openKey).toBe(1)
  })
  it('identity: a restated defect (continues) is one defect, a SUPERSEDED one hands its identity on, and a verified closure stays closed', () => {
    const d1: DefectEntry = { id: 'L1:D1', key: 'L1:D1', look: 1, about: 'rear door is a window', scope: 'REAR', severity: 'MAJOR', certainty: 'LIKELY', operation: 'UPDATE_OPENING', settlement: 'NO_PROPOSAL', why: '' }
    const d1again: DefectEntry = { ...d1, id: 'L2:D4', key: 'L2:D4', look: 2, about: 'the rear sliding door is a raised window', continues: 'L1:D1' }
    const rec = reconcileLedger([d1, d1again], [], new Map([[1, 'a'], [2, 'b']]), 2)
    expect(rec).toHaveLength(1)
    expect(rec[0].key).toBe('L1:D1')
    expect(rec[0].id).toBe('L2:D4')
    const d2: DefectEntry = { ...d1, id: 'L2:D2', key: 'L2:D2', look: 2, about: 'rear opening: a two-leaf glazed door', continues: undefined }
    const sup = reconcileLedger([d1, d2], [{ look: 2, revision: 'b', defectId: 'L1:D1', verdict: 'SUPERSEDED', note: 'more precise', supersededBy: 'D2' }], new Map([[1, 'a'], [2, 'b']]), 2)
    expect(sup).toHaveLength(1)
    expect(sup[0].key).toBe('L1:D1')
    const closed: DefectEntry = { ...d1, settlement: 'CLOSED_VERIFIED', verifiedOn: 'b' }
    const q = qualityOf({ ...base, checkedRevision: 'b', deliveredRevision: 'b', lastStatus: 'VERIFIED_IN_SCOPE', defects: [], allDefects: [closed], lookRevision: new Map([[1, 'a'], [2, 'b']]), lastLook: 2 })
    expect(q.state).toBe('SOURCE_VERIFIED_IN_SCOPE')
    expect(q.closedVerified).toBe(1)
  })
  it('the reviewer is told the open defects and how to close them; the contract carries continues and resolved', () => {
    expect(MODEL_CHECK_SYSTEM).toMatch(/Not mentioning an earlier defect leaves it open/)
  })
})

describe('v3.54.16 audit A4: CLOSED_VERIFIED needs a source measure that supports the built element', () => {
  const d = { id: 'finish', about: 'wrong finish', scope: 'FRONT' as const, severity: 'MAJOR' as const, certainty: 'CERTAIN' as const, operation: 'SET_FINISH' as const }
  const rec = (v: boolean | null) => ({ proposalId: 'p', operation: 'SET_FINISH', targetId: 'FRONT', origin: 'REVIEW' as const, status: 'COMMITTED' as const, why: '', bound: { frameId: 'f', ids: ['wall'] }, measure: { sourceVerified: v, why: v === null ? 'the finish class is not measured' : '' } })
  it('the audit probe: null measure + MATCHES is CLOSED_REVIEW_ONLY, and the delivered revision is not SOURCE_VERIFIED_IN_SCOPE', () => {
    const s = settleDefects(1, [d], [{ proposalId: 'p', defectId: 'finish' }], [rec(null)], new Map([['wall', 'MATCHES']]), 'new-rev', false)
    expect(s[0].settlement).toBe('CLOSED_REVIEW_ONLY')
    const q = qualityOf({ looked: true, checkedRevision: 'new-rev', deliveredRevision: 'new-rev', lastStatus: 'VERIFIED_IN_SCOPE', defects: [], allDefects: s, lastLook: 2, measuredContradictions: 0, pendingAtLimit: 0, attemptedForKey: 0, committedForKey: 0 })
    expect(q.state).toBe('RECOGNIZABLE_PARTIAL')
    expect(q.closedReviewOnly).toBe(1)
    expect(q.closedVerified).toBe(0)
  })
  it('counterparts: a supporting measure verifies; a contradicting one disagrees', () => {
    expect(settleDefects(1, [d], [{ proposalId: 'p', defectId: 'finish' }], [rec(true)], new Map([['wall', 'MATCHES']]), 'r', false)[0].settlement).toBe('CLOSED_VERIFIED')
    expect(settleDefects(1, [d], [{ proposalId: 'p', defectId: 'finish' }], [rec(false)], new Map([['wall', 'MATCHES']]), 'r', false)[0].settlement).toBe('APPLIED_REVIEW_DISAGREES')
  })
  it('the finish executor says what it does not measure (sourceVerified null, with why)', () => {
    const m = build(program())
    const out = run(m, [propose(m, { operation: 'SET_FINISH', patch: { box: { x0: col(0), x1: col(10), y0: row(2.8), y1: row(0) }, material: 'BRICK' } })])
    expect(out.records[0].measure?.sourceVerified).toBeNull()
    expect(out.records[0].measure?.why).toMatch(/not measured/)
  })
})

/** A copy of the controlled elevation with `paint` applied (wall colour first where `clear` says). */
const repaint = (paint: (put: (x: number, y: number, c: [number, number, number]) => void) => void): BindPicture => {
  const data = new Uint8ClampedArray(RASTER.data)
  const put = (x: number, y: number, c: [number, number, number]): void => {
    if (x < 0 || y < 0 || x >= W || y >= H) return
    data.set([c[0], c[1], c[2], 255], (y * W + x) * 4)
  }
  paint(put)
  return { ...picture, raster: { width: W, height: H, data } }
}
const WALL: [number, number, number] = [228, 218, 198]
/** D redrawn with a raked head: 4.9 m at its left end, 4.3 m at its right. */
const rakedD = repaint((put) => {
  for (let y = row(5.0); y <= row(3.6); y += 1) for (let x = col(5.9); x <= col(7.3); x += 1) put(x, y, WALL)
  for (let x = col(6.0); x <= col(7.2); x += 1) {
    const t = (x - col(6.0)) / (col(7.2) - col(6.0))
    const top = Math.round(row(4.9) + t * (row(4.3) - row(4.9)))
    for (let y = top; y <= row(3.7); y += 1) {
      const frame = x - col(6.0) < 3 || col(7.2) - x < 3 || y - top < 3 || row(3.7) - y < 3
      put(x, y, frame ? [250, 250, 250] : [55, 66, 78])
    }
  }
})
const garage = (striped: boolean): BindPicture => repaint((put) => {
  for (let y = row(2.1); y <= row(0); y += 1) for (let x = col(8.2); x <= col(9.6); x += 1) {
    const frame = x - col(8.2) < 3 || col(9.6) - x < 3 || y - row(2.1) < 3
    put(x, y, frame ? [250, 250, 250] : striped ? (Math.floor((y - row(2.1)) / 4) % 2 === 0 ? [170, 170, 172] : [120, 120, 124]) : [120, 82, 52])
  }
})
const withDoor = (m: CanonicalBuildingModel): CanonicalBuildingModel => inject(m, [{ type: 'cutOpening', id: 'G', wallId: 'g-w0', kind: 'DOOR', offset: 8.2, sill: 0, width: 1.4, height: 2.1 }, { type: 'placeDoor', id: 'G-leaf', openingId: 'G' }] as BuildingCommand[])

describe('v3.54.16 audit A2: a raked head and an exact kind are hypotheses of their own', () => {
  it('the audit probe stays right where it is right: one box against itself is undecided', () => {
    const raster = { width: 300, height: 100, data: new Uint8ClampedArray(300 * 100 * 4).fill(255) }
    for (let y = 30; y <= 70; y += 1) for (let x = 100; x <= 130; x += 1) for (let k = 0; k < 3; k += 1) raster.data[(y * 300 + x) * 4 + k] = 30
    const box = { x0: 100, y0: 30, x1: 130, y1: 70 }
    expect(compareHypotheses(raster, box, box, { x0: 0, x1: 299, y0: 0, y1: 99 }, [], 0).winner).toBe('UNDECIDED')
  })
  it('one bounding box, two heads: the drawn raked head wins as a polygon, and the level head wins where a level one is drawn', () => {
    const box = boxOf(6.0, 7.2, 3.7, 4.9)
    const raked = { ...box, headLeftY: row(4.9), headRightY: row(4.3) }
    const facade = { x0: col(0), x1: col(10), y0: row(5.6), y1: row(0) }
    const others = [boxOf(8.2, 9.4, 3.7, 4.9)]
    const onRaked = compareHypotheses(rakedD.raster, raked, box, facade, others, 2)
    expect(onRaked.measure).toBe('POLYGON')
    expect(onRaked.winner).toBe('PROPOSED')
    const onLevel = compareHypotheses(RASTER, raked, box, facade, others, 2)
    expect(onLevel.winner).not.toBe('PROPOSED')
  })
  it('UPDATE_OPENING with the head ends builds a RAKED head, measured by its ends; the same proposal on a level drawing is not applied', () => {
    const m = build(program())
    const p = propose(m, { proposalId: 'rake-D', operation: 'UPDATE_OPENING', targetId: 'D', patch: { box: boxOf(6.0, 7.2, 3.7, 4.9), headLeftY: row(4.9), headRightY: row(4.3), kind: 'WINDOW' } })
    const out = run(m, [p], { pictures: [rakedD] })
    expect(out.records[0].status).toBe('COMMITTED')
    const d = out.model.openings.find((o) => o.id === 'D')
    expect(d?.head?.kind).toBe('RAKED')
    expect(out.records[0].measure?.headErrorPx).toBeLessThanOrEqual(3)
    expect(out.records[0].measure?.sourceVerified).toBe(true)
    const level = run(m, [{ ...p, proposalId: 'rake-D2' }])
    expect(level.records[0].status).not.toBe('COMMITTED')
  })
  it('the same shape, another kind: the fill decides (panelled → GARAGE_DOOR kept), a solid fill refuses it, and two kinds of one fill are never decided by it', () => {
    const m = withDoor(build(program()))
    const p = (id: string) => propose(m, { proposalId: id, operation: 'UPDATE_OPENING', targetId: 'G', patch: { box: boxOf(8.2, 9.6, 0, 2.1), kind: 'GARAGE_DOOR' } })
    const ok = run(m, [p('kind-G')], { pictures: [garage(true)] })
    expect(ok.records[0].gate?.measure).toBe('FILL')
    expect(ok.records[0].status).toBe('COMMITTED')
    expect(ok.records[0].measure?.builtKind).toBe('GARAGE_DOOR')
    const solid = run(m, [p('kind-G2')], { pictures: [garage(false)] })
    expect(solid.records[0].status).toBe('REJECTED_BY_SOURCE')
    expect(solid.records[0].code).toBe('MODEL_FILL_BETTER_SUPPORTED')
    expect(compareFill(garage(true).raster, boxOf(8.2, 9.6, 0, 2.1), 'WINDOW', 'GLAZED_DOOR').winner).toBe('UNDECIDED')
    // the same shape and the same kind is no change at all
    const same = run(m, [propose(m, { proposalId: 'same-G', operation: 'UPDATE_OPENING', targetId: 'G', patch: { box: boxOf(8.2, 9.6, 0, 2.1), kind: 'DOOR' } })], { pictures: [garage(false)] })
    expect(same.records[0].status).toBe('NO_EFFECT')
  })
  it('the sketch channel keeps the raked head and the exact kind (the audit probe and its counterpart)', () => {
    const m = withDoor(build(program()))
    const sk = (openings: Array<{ id: string; kind: string; polygon: Array<[number, number]> }>) => ({ sketchId: 's', frameId: FRAME, openings, elements: [], walls: [], roofs: [] }) as unknown as ElevationSketch
    const raked = proposalsFromSketch(sk([{ id: 'raked', kind: 'WINDOW', polygon: [[10, 10], [30, 30], [30, 60], [10, 60]] }]), 'FRONT', m, [view], 'rev')
    expect(raked.proposals[0].patch).toMatchObject({ box: { x0: 10, y0: 10, x1: 30, y1: 60 }, headLeftY: 10, headRightY: 30, kind: 'WINDOW' })
    const g = boxOf(8.2, 9.6, 0, 2.1)
    const glazed = proposalsFromSketch(sk([{ id: 'gd', kind: 'GLAZED_DOOR', polygon: [[g.x0, g.y0], [g.x1, g.y0], [g.x1, g.y1], [g.x0, g.y1]] }]), 'FRONT', m, [view], 'rev')
    expect(glazed.agreed).toHaveLength(0)
    expect(glazed.proposals[0]).toMatchObject({ operation: 'UPDATE_OPENING', targetId: 'G', patch: { kind: 'GLAZED_DOOR' } })
    const door = proposalsFromSketch(sk([{ id: 'd', kind: 'DOOR', polygon: [[g.x0, g.y0], [g.x1, g.y0], [g.x1, g.y1], [g.x0, g.y1]] }]), 'FRONT', m, [view], 'rev')
    expect(door.agreed.map((a) => a.modelId)).toContain('G')
  })
})

describe('v3.54.16 audit A3: a number is a witness only as a bound observation of the same parameter', () => {
  const S = 's'.repeat(64)
  it('the audit probe: +5.50 read on the garage section, no role, does not set the main wall\'s height', () => {
    const m = build(program())
    const out = run(m, [propose(m, { operation: 'SET_PARAMETER', targetId: 'g-w0', patch: { property: 'WALL_HEIGHT', value: 5.5, unit: 'm', literal: '+5.50', sourcePicture: 7 } })], { witnesses: [{ valueM: 5.5, unit: 'm', frameId: 'garage-section', by: 'METRIC_READ', literal: '+5.50' }] })
    expect(out.records[0].status).toBe('NEEDS_EVIDENCE')
    expect(out.records[0].code).toBe('WITNESS_ROLE_MISMATCH')
    expect(out.revision).toBe(out.baseRevision)
  })
  it('role, anchor, picture and body each refuse by name; two equal marks on two bodies are ambiguous', () => {
    const m = build(program())
    const lv = (extra: Record<string, unknown> = {}) => propose(m, { operation: 'SET_PARAMETER', targetId: 'l1', patch: { property: 'LEVEL_ELEVATION', value: 2.95, unit: 'm', literal: '+2.95', ...extra } })
    const w = { valueM: 2.95, unit: 'm' as const, frameId: FRAME, by: 'METRIC_READ' as const, literal: '+2.95' }
    expect(run(m, [lv()], { witnesses: [{ ...w, role: 'CEILING', sourceByteHash: S }] }).records[0].code).toBe('WITNESS_ROLE_MISMATCH')
    expect(run(m, [lv()], { witnesses: [{ ...w, role: 'FLOOR' }] }).records[0].code).toBe('WITNESS_NOT_ANCHORED')
    expect(run(m, [lv({ sourcePicture: 2 })], { witnesses: [{ ...w, frameId: 'garage-section', role: 'FLOOR', sourceByteHash: S }] }).records[0].code).toBe('WITNESS_NOT_ON_PICTURE')
    expect(run(m, [lv()], { witnesses: [{ ...w, frameId: 'section-a', role: 'FLOOR', sourceByteHash: S, host: 'garage' }, { ...w, frameId: 'section-b', role: 'FLOOR', sourceByteHash: S, host: 'main house' }] }).records[0].code).toBe('AMBIGUOUS_WITNESS')
    const twoBodies = inject(m, [{ type: 'createRoof', id: 'r-main', levelId: 'l1', kind: 'GABLE', footprint: { minX: 0, maxX: 6, minZ: 0, maxZ: 8 }, eaveOffset: 0, pitchDeg: 35, ridgeAxis: 'Z', thickness: 0.2 }, { type: 'createRoof', id: 'r-garage', levelId: 'l1', kind: 'GABLE', footprint: { minX: 6, maxX: 10, minZ: 0, maxZ: 8 }, eaveOffset: 0, pitchDeg: 35, ridgeAxis: 'Z', thickness: 0.2 }] as BuildingCommand[])
    const tb = executeCorrections({ model: twoBodies, views: [view], pictures: [picture], proposals: [propose(twoBodies, { operation: 'SET_PARAMETER', targetId: 'l1', patch: { property: 'LEVEL_ELEVATION', value: 2.95, unit: 'm', literal: '+2.95' } })], witnesses: [{ ...w, role: 'FLOOR', sourceByteHash: S, host: 'garage' }] })
    expect(tb.records[0].code).toBe('HOST_NOT_NAMED')
    const tb2 = executeCorrections({ model: twoBodies, views: [view], pictures: [picture], proposals: [propose(twoBodies, { operation: 'SET_PARAMETER', targetId: 'l1', patch: { property: 'LEVEL_ELEVATION', value: 2.95, unit: 'm', literal: '+2.95', host: 'main house' } })], witnesses: [{ ...w, role: 'FLOOR', sourceByteHash: S, host: 'garage' }] })
    expect(tb2.records[0].code).toBe('HOST_NOT_BOUND')
  })
  it('counterpart: the FLOOR mark on the proposal\'s own picture, anchored, binds — and its source record names the bytes', () => {
    const m = build(program())
    const out = run(m, [propose(m, { operation: 'SET_PARAMETER', targetId: 'l1', patch: { property: 'LEVEL_ELEVATION', value: 2.95, unit: 'm', literal: '+2.95', sourcePicture: 2 } })], { witnesses: [{ valueM: 2.95, unit: 'm', frameId: FRAME, by: 'METRIC_READ', literal: '+2.95', role: 'FLOOR', sourceByteHash: S }] })
    expect(out.records[0].status).toBe('COMMITTED')
    expect(out.records[0].source?.sourceByteHash).toBe(S)
  })
})
