/**
 * Council F (read-only audit harness). Shows:
 *  A. thinBodies() skips any ATTACHED mass that has storeyRects or pieceOf, although emit.ts builds that mass's
 *     storey ring from rectAt(m, storey) and the ring is refused WALLS_OVERLAP exactly like an unpieced thin body.
 *  B. The partial-preview checkpoint hash depends only on the program prefix up to the main body's last slab/ring:
 *     it is identical whatever happens to the attached body or to the solver version.
 * Invented numbers only.
 */
import assert from 'node:assert/strict'
import { applyCommands } from '@buildapp/commands'
import type { BuildingCommand } from '@buildapp/commands'
import { createEmptyModel } from '@buildapp/model'
import { thinBodies, rectAt } from '../../../packages/reconstruction/src/v2/index.js'
import type { MassV2 } from '../../../packages/reconstruction/src/v2/index.js'
import { previewCheckpoint, fitOpeningsToHosts } from '../../../packages/reconstruction/src/candidate.js'

const T = 0.3
const base = { featureId: 'f', sourceMassId: 's' }
const main: MassV2 = { id: 'main', role: 'MAIN', x0: 0, z0: 0, x1: 8, z1: 10, storeys: [0, 1], ...base } as MassV2
// (i) plain thin attached body
const plain: MassV2 = { id: 'attached-0', role: 'ATTACHED', x0: 8, z0: 4, x1: 8.45, z1: 10, storeys: [0], ...base } as MassV2
// (ii) attached body measured on storey 1 (wide), whose storey-0 own footprint is a thin strip
const withRects: MassV2 = { id: 'attached-1', role: 'ATTACHED', x0: 8, z0: 0, x1: 11, z1: 4, storeys: [0, 1], storeyRects: [{ storey: 0, x0: 8, z0: 0, x1: 8.45, z1: 4 }], ...base } as MassV2
// (iii) the same, but the body rect ITSELF is thin too
const thinWithRects: MassV2 = { id: 'attached-2', role: 'ATTACHED', x0: -0.45, z0: 0, x1: 0, z1: 6, storeys: [0, 1], storeyRects: [{ storey: 0, x0: -0.45, z0: 0, x1: 0, z1: 5 }], ...base } as MassV2
// (iv) a thin piece
const piece: MassV2 = { id: 'attached-0-s1-1', role: 'ATTACHED', x0: 3, z0: -0.4, x1: 6, z1: 0, storeys: [1], pieceOf: 'attached-0', ...base } as MassV2

const flagged = thinBodies([main, plain, withRects, thinWithRects, piece], T).map((x) => x.mass.id)
console.log('thinBodies flags:', flagged)
assert.deepEqual(flagged, ['attached-0'])

const r = rectAt(withRects, 0)
console.log('rectAt(attached-1, 0):', r, 'width', (r.x1 - r.x0).toFixed(2), '< 2T =', 2 * T)
assert.ok(r.x1 - r.x0 < 2 * T)

// B/A: the ring emit.ts would build for attached-1 storey 0 (polygon = rectAt), thickness T
const ring = (id: string, levelId: string, q: { x0: number; z0: number; x1: number; z1: number }, h = 2.7): BuildingCommand =>
  ({ type: 'createWallRing', id, levelId, polygon: [{ x: q.x0, z: q.z0 }, { x: q.x1, z: q.z0 }, { x: q.x1, z: q.z1 }, { x: q.x0, z: q.z1 }], thickness: T, height: h, baseOffset: 0, kind: 'EXTERIOR', cornerOwnership: 'ALTERNATE' }) as BuildingCommand
const slab = (id: string, levelId: string, q: { x0: number; z0: number; x1: number; z1: number }): BuildingCommand =>
  ({ type: 'createSlab', id, levelId, polygon: [{ x: q.x0, z: q.z0 }, { x: q.x1, z: q.z0 }, { x: q.x1, z: q.z1 }, { x: q.x0, z: q.z1 }], topOffset: 0, thickness: 0.25 }) as BuildingCommand
const header = (): BuildingCommand[] =>
  [
    { type: 'setModelName', name: 'fx' },
    { type: 'createBuilding', id: 'bld', name: 'fx' },
    { type: 'createLevel', id: 'lvl-0', name: 'Ground', index: 0, elevation: 0, height: 2.7 },
    { type: 'createLevel', id: 'lvl-1', name: 'Level 1', index: 1, elevation: 2.95, height: 2.6 },
  ] as BuildingCommand[]
const mainBody = (): BuildingCommand[] => [slab('slab-main-0', 'lvl-0', main), ring('ring-main-0', 'lvl-0', main), slab('slab-main-1', 'lvl-1', { x0: T, z0: T, x1: 8 - T, z1: 10 - T }), ring('ring-main-1', 'lvl-1', main, 2.6)]
const attachedOf = (m: MassV2): BuildingCommand[] => m.storeys.flatMap((s) => [slab(`slab-${m.id}-${s}`, `lvl-${s}`, rectAt(m, s)), ring(`ring-${m.id}-${s}`, `lvl-${s}`, rectAt(m, s))])

const prog = [...header(), ...mainBody(), ...attachedOf(withRects)]
const applied = applyCommands(createEmptyModel('m', 'fx'), prog)
console.log('apply attached-1 (skipped by thinBodies): failedAt', applied.failedAt, prog[applied.failedAt ?? -1]?.type, (prog[applied.failedAt ?? -1] as { id?: string })?.id)
const fit = fitOpeningsToHosts(prog, 'fx', 'm')
if (!fit.ok) console.log('  ', fit.errors.map((e) => `${e.code}: ${e.message}`).join(' | '))
assert.equal(fit.ok, false)

// shared-area law: w1/w3 overlap for width w, depth d (ALTERNATE: odd edges lose their corners)
for (const [w, d] of [[0.45, 4], [0.45, 6], [0.5, 4], [0.55, 6.5]] as const) {
  const f = fitOpeningsToHosts([...header(), ring('ring-attached-9-0', 'lvl-0', { x0: 20, z0: 0, x1: 20 + w, z1: d })], 'fx', 'm')
  console.log(`w=${w} d=${d}:`, f.ok ? 'ok' : f.errors[0].message.match(/share ([0-9.]+) m²/)?.[1], ' (2T-w)*(d-2T)=', ((2 * T - w) * (d - 2 * T)).toFixed(4), ' (2T-w)*d=', ((2 * T - w) * d).toFixed(4))
}

// B: checkpoint hash invariance
const cpA = previewCheckpoint([...header(), ...mainBody(), ...attachedOf(withRects)], 'main', 'fx', 'm')
const cpB = previewCheckpoint([...header(), ...mainBody(), ...attachedOf({ ...withRects, storeyRects: [{ storey: 0, x0: 8, z0: 0, x1: 8.4, z1: 4 }] })], 'main', 'fx', 'm')
const cpC = previewCheckpoint([...header(), ...mainBody().slice(0, 3), ring('ring-main-1', 'lvl-1', main, 2.65)], 'main', 'fx', 'm')
console.log('checkpoint A', cpA?.commands, cpA?.modelSha256.slice(0, 12), ' B (attached changed)', cpB?.commands, cpB?.modelSha256.slice(0, 12), ' C (main changed)', cpC?.modelSha256.slice(0, 12))
assert.equal(cpA?.modelSha256, cpB?.modelSha256)
assert.notEqual(cpA?.modelSha256, cpC?.modelSha256)
console.log('ALL ASSERTIONS PASSED')
