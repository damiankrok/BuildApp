/**
 * v3.54.17 §4 — a printed witness is bound to the real target by the model, its plan and the place of the mark, never by
 * a name or the count of roofs. Every counter-trial has its correct counterpart, and each counterpart really executes
 * (COMMITTED on a compiled model), so a refusal is never the only thing a test can see.
 */
import { describe, expect, it } from 'vitest'
import { applyCommands } from '@buildapp/commands'
import type { BuildingCommand } from '@buildapp/commands'
import { createEmptyModel } from '@buildapp/model'
import type { CanonicalBuildingModel } from '@buildapp/model'
import { executeCorrections, modelRevision } from '../src/consult/correct/execute.js'
import type { BindPicture, BindView, CorrectionProposal, PrintedWitness } from '../src/consult/correct/execute.js'
import { bodiesOf, bodyCommands } from '../src/consult/massing/massing.js'
import type { BodySpec } from '../src/consult/massing/massing.js'
import { locateWitness, targetBodies } from '../src/consult/correct/resolve.js'

const S = 's'.repeat(64)
const FRONT = 'frame-front'
// the front elevation: x = 0 at column 0, 2 cm per pixel, the ground on row 500
const view: BindView = { side: 'FRONT', frameId: FRONT, projection: { mpp: 0.02, alongAtPx0: 0, alongSign: 1, zeroRow: 500 }, heights: true, origin: 'ANALYZER', alongErrorM: 0.05, heightErrorM: 0.1 }
const at = (x: number, y: number): { x0: number; y0: number; x1: number; y1: number } => ({ x0: x / 0.02 - 20, x1: x / 0.02 + 20, y0: 500 - y / 0.02 - 8, y1: 500 - y / 0.02 + 8 })
const P = (provenance = 'CONTROL'): BodySpec['provenance'] => ({ outline: { fidelity: 'SOURCE_DERIVED', source: provenance, why: 'controlled' } })
const MAIN: BodySpec = { id: 'mass-main', rect: { minX: 0, maxX: 10, minZ: 0, maxZ: 8 }, roof: { kind: 'GABLE', ridgeAxis: 'X', pitchDeg: 35, eavesM: 3.2, ridgeM: 3.2 + 4 * Math.tan((35 * Math.PI) / 180) }, provenance: P() }
const WING: BodySpec = { id: 'mass-wing-1', rect: { minX: 10, maxX: 16, minZ: 0, maxZ: 6 }, roof: { kind: 'FLAT', eavesM: 2.8 }, provenance: P() }

function model(cmds: BuildingCommand[]): CanonicalBuildingModel {
  const r = applyCommands(createEmptyModel('m', 't'), [{ type: 'createBuilding', id: 'b' }, { type: 'createLevel', id: 'lvl-0', index: 0, elevation: 0, height: 6.2 }, ...cmds] as BuildingCommand[])
  if (r.failedAt !== undefined) throw new Error(JSON.stringify(r.results[r.failedAt]).slice(0, 300))
  return r.model
}
const twoBodies = (): CanonicalBuildingModel => model([...bodyCommands(MAIN, 'lvl-0', 0, [WING.rect], 0.3), ...bodyCommands(WING, 'lvl-0', 0, [MAIN.rect], 0.3)])
const propose = (m: CanonicalBuildingModel, p: Partial<CorrectionProposal>): CorrectionProposal => ({ proposalId: `p-${Math.random().toString(36).slice(2, 8)}`, baseRevision: modelRevision(m), operation: 'SET_PARAMETER', targetId: '', origin: 'CONTROL', uncertainty: 'LOW', ...p } as CorrectionProposal)
const run = (m: CanonicalBuildingModel, p: CorrectionProposal, witnesses: PrintedWitness[], pictures: BindPicture[] = []) => executeCorrections({ model: m, views: [view], pictures, proposals: [p], witnesses }).records[0]
const mark = (over: Partial<PrintedWitness>): PrintedWitness => ({ valueM: 0, unit: 'm', frameId: FRONT, by: 'METRIC_READ', sourceByteHash: S, ...over })

describe('v3.54.17 resolver: bodies are counted, marks are placed', () => {
  it('the model has the two bodies it was built with; the roofs and walls are placed on them', () => {
    const m = twoBodies()
    const b = bodiesOf(m)
    expect(b.map((x) => x.id).sort()).toEqual(['ring-mass-main', 'ring-mass-wing-1'])
    expect(targetBodies(m, b, 'roof-mass-main')?.ids).toEqual(['ring-mass-main'])
    expect(targetBodies(m, b, 'roof-mass-wing-1')?.ids).toEqual(['ring-mass-wing-1'])
    expect(targetBodies(m, b, 'ring-mass-wing-1-w1')?.ids).toEqual(['ring-mass-wing-1'])
    const loc = locateWitness(b, [view], mark({ valueM: 30, unit: 'deg', box: at(13, 4) }))
    expect('bodyId' in loc && loc.bodyId).toBe('ring-mass-wing-1')
  })

  it('equal angle on another roof: a pitch printed over the wing does not re-pitch the main roof; the same mark over the main body does', () => {
    const m = twoBodies()
    const p = propose(m, { targetId: 'roof-mass-main', patch: { property: 'ROOF_PITCH', value: 38, unit: 'deg', literal: '38°' } })
    const wrong = run(m, p, [mark({ valueM: 38, unit: 'deg', role: 'ROOF_PITCH', literal: '38°', box: at(13, 3.5) })])
    expect(wrong.status).toBe('NEEDS_EVIDENCE')
    expect(wrong.code).toBe('HOST_NOT_BOUND')
    const right = run(m, { ...p, proposalId: 'p-right' }, [mark({ valueM: 38, unit: 'deg', role: 'ROOF_PITCH', literal: '38°', box: at(5, 5) })])
    expect(right.status).toBe('COMMITTED')
    expect(right.witness?.bodyId).toBe('ring-mass-main')
  })

  it('matching host text, target in another body: "garage" on both sides of the proposal does not bind the main roof; on the garage roof it does', () => {
    const m = twoBodies()
    const w = mark({ valueM: 2.8, unit: 'm', role: 'EAVES', literal: '+2,80', host: 'garage', box: at(13, 2.8) })
    const wrong = run(m, propose(m, { targetId: 'ring-mass-main-w0', patch: { property: 'WALL_HEIGHT', value: 2.8, unit: 'm', literal: '+2,80', host: 'garage' } }), [w])
    // the main walls follow their roof: the binder must refuse before it ever reaches the wall — by body, not by name
    expect(wrong.code).toBe('HOST_NOT_BOUND')
    const right = run(m, propose(m, { targetId: 'ring-mass-wing-1-w1', patch: { property: 'WALL_HEIGHT', value: 3.4, unit: 'm', literal: '+3,40', host: 'garage' } }), [{ ...w, valueM: 3.4, literal: '+3,40', box: at(15, 3.4) }])
    expect(right.status).toBe('COMMITTED')
    expect(right.witness?.bodyId).toBe('ring-mass-wing-1')
  })

  it('two roofs of one body are one body: no host is asked for, and the mark binds', () => {
    const m = model([...bodyCommands(MAIN, 'lvl-0', 0, [], 0.3), { type: 'createRoof', id: 'roof-porch', levelId: 'lvl-0', kind: 'FLAT', footprint: { minX: 3, maxX: 6, minZ: 0, maxZ: 1.5 }, eaveOffset: 2.6, pitchDeg: 0, ridgeAxis: 'X', thickness: 0.15 } as BuildingCommand])
    expect(m.roofs.length).toBe(2)
    expect(bodiesOf(m).length).toBe(1)
    const out = run(m, propose(m, { targetId: 'roof-mass-main', patch: { property: 'ROOF_PITCH', value: 38, unit: 'deg', literal: '38°' } }), [mark({ valueM: 38, unit: 'deg', role: 'ROOF_PITCH', literal: '38°' })])
    expect(out.status).toBe('COMMITTED')
  })

  it('several bodies with roof planes and no roofs: still two bodies — the wrong body refuses, the right one executes', () => {
    const plane = (id: string, minX: number, maxX: number, maxZ: number, y: number): BuildingCommand => ({ type: 'createRoofPlane', id, levelId: 'lvl-0', boundary: [{ x: minX, z: 0 }, { x: maxX, z: 0 }, { x: maxX, z: maxZ }, { x: minX, z: maxZ }], datum: { x: minX, y, z: 0 }, pitchDeg: 0, downslope: { x: 0, z: -1 }, thickness: 0.2 }) as BuildingCommand
    const ring = (id: string, r: { minX: number; maxX: number; maxZ: number }, h: number): BuildingCommand => ({ type: 'createWallRing', id, levelId: 'lvl-0', polygon: [{ x: r.minX, z: 0 }, { x: r.maxX, z: 0 }, { x: r.maxX, z: r.maxZ }, { x: r.minX, z: r.maxZ }], thickness: 0.3, height: h, baseOffset: 0, kind: 'EXTERIOR', cornerOwnership: 'ALTERNATE' }) as BuildingCommand
    const chimney = (id: string, x: number, z: number, h: number): BuildingCommand => ({ type: 'placeChimney', id, levelId: 'lvl-0', footprint: { minX: x, maxX: x + 0.6, minZ: z, maxZ: z + 0.6 }, baseOffset: 0, height: h }) as BuildingCommand
    const m = model([ring('ring-a', { minX: 0, maxX: 10, maxZ: 8 }, 6), plane('pl-a', 0, 10, 8, 6.2), ring('ring-b', { minX: 10, maxX: 16, maxZ: 6 }, 3), plane('pl-b', 10, 16, 6, 3.2), chimney('ch-a', 4, 3, 7.5), chimney('ch-b', 13, 2, 4.2)])
    expect(m.roofs.length).toBe(0)
    expect(bodiesOf(m).length).toBe(2)
    // the stack of body b: a CHIMNEY mark printed over body a (an equal number, another stack) does not set it
    const p = propose(m, { targetId: 'ch-b', patch: { property: 'CHIMNEY_HEIGHT', value: 4.6, unit: 'm', literal: '+4,60' } })
    expect(run(m, p, [mark({ valueM: 4.6, role: 'CHIMNEY', literal: '+4,60', box: at(4, 4.6) })]).code).toBe('HOST_NOT_BOUND')
    const ok = run(m, { ...p, proposalId: 'p2' }, [mark({ valueM: 4.6, role: 'CHIMNEY', literal: '+4,60', box: at(13.3, 4.6) })])
    expect(ok.status).toBe('COMMITTED')
  })

  it('changed datum: an eaves level stated from the terrain is refused; the same number from the finished ±0,00 executes', () => {
    const m = twoBodies()
    const p = propose(m, { targetId: 'ring-mass-wing-1-w1', patch: { property: 'WALL_HEIGHT', value: 3.4, unit: 'm', literal: '+3,40' } })
    expect(run(m, p, [mark({ valueM: 3.4, role: 'EAVES', literal: '+3,40', datum: 'TERRAIN', box: at(14, 3.4) })]).code).toBe('DATUM_MISMATCH')
    const ok = run(m, { ...p, proposalId: 'p-datum' }, [mark({ valueM: 3.4, role: 'EAVES', literal: '+3,40', datum: 'FINISHED_LEVEL', box: at(14, 3.4) })])
    expect(ok.status).toBe('COMMITTED')
    expect(ok.witness?.datum).toBe('FINISHED_LEVEL')
  })

  it('a role-less number is not a witness; the same mark with its role executes', () => {
    const m = twoBodies()
    const p = propose(m, { targetId: 'ring-mass-wing-1-w1', patch: { property: 'WALL_HEIGHT', value: 3.4, unit: 'm', literal: '+3,40' } })
    expect(run(m, p, [mark({ valueM: 3.4, literal: '+3,40', box: at(14, 3.4) })]).code).toBe('WITNESS_ROLE_MISMATCH')
    expect(run(m, { ...p, proposalId: 'p-role' }, [mark({ valueM: 3.4, role: 'EAVES', literal: '+3,40', box: at(14, 3.4) })]).status).toBe('COMMITTED')
  })

  it('a mark without a place, or on a picture no registration puts on a side, is not located in a two-body model', () => {
    const m = twoBodies()
    const p = propose(m, { targetId: 'ring-mass-wing-1-w1', patch: { property: 'WALL_HEIGHT', value: 3.4, unit: 'm', literal: '+3,40' } })
    expect(run(m, p, [mark({ valueM: 3.4, role: 'EAVES', literal: '+3,40' })]).code).toBe('WITNESS_NOT_LOCATED')
    expect(run(m, { ...p, proposalId: 'p-sec' }, [mark({ valueM: 3.4, role: 'EAVES', literal: '+3,40', frameId: 'garage-section', box: at(14, 3.4) })]).code).toBe('WITNESS_NOT_LOCATED')
  })

  it('the checkpoint probe (roof-main, host "garage" on both sides, the garage section): refused now, by place', () => {
    // the probe's model: two roofs and no walls — counted as two bodies, not as two roofs
    const m = model([
      { type: 'createRoof', id: 'roof-main', levelId: 'lvl-0', kind: 'GABLE', footprint: { minX: 0, maxX: 10, minZ: 0, maxZ: 8 }, eaveOffset: 3, pitchDeg: 40, ridgeAxis: 'X' },
      { type: 'createRoof', id: 'roof-garage', levelId: 'lvl-0', kind: 'GABLE', footprint: { minX: 10, maxX: 16, minZ: 0, maxZ: 6 }, eaveOffset: 2.6, pitchDeg: 20, ridgeAxis: 'Z' },
    ] as BuildingCommand[])
    expect(bodiesOf(m).length).toBe(2)
    const raster = { width: 10, height: 10, data: new Uint8ClampedArray(400) }
    const pic: BindPicture = { n: 7, frameId: 'garage-section', projection: 'SECTION', transform: { x0: 0, y0: 0, scale: 1 }, raster, sourceByteHash: 'garage-source' }
    const probe = propose(m, { targetId: 'roof-main', patch: { property: 'ROOF_PITCH', value: 28, unit: 'deg', literal: '28', sourcePicture: 7, host: 'garage' } })
    const out = run(m, probe, [{ valueM: 28, unit: 'deg', frameId: 'garage-section', sourceByteHash: 'garage-source', role: 'ROOF_PITCH', host: 'garage', by: 'METRIC_READ', literal: '28' }], [pic])
    expect(out.status).toBe('NEEDS_EVIDENCE')
    expect(out.code).toBe('WITNESS_NOT_LOCATED')
    // counterpart: the same 28° printed on the registered front elevation over the main roof re-pitches it
    const ok = run(m, { ...probe, proposalId: 'p-probe-ok', patch: { property: 'ROOF_PITCH', value: 28, unit: 'deg', literal: '28' } }, [mark({ valueM: 28, unit: 'deg', role: 'ROOF_PITCH', literal: '28', box: at(5, 5) })])
    expect(ok.status).toBe('COMMITTED')
    expect(ok.witness?.bodyId).toBe('roofed-0')
  })
})
