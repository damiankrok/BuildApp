/**
 * Council D, Q5: SHARED_WALL is decided when the other body covers > 50 % of the band's length; the open side is then
 * left with NO wall along the stretch the other body does not cover. Drawn raster (invented): main 10 x 8 with a 0.30
 * wall; a 0.45 m body east of it at z 4.5..10.5 whose far wall is drawn; its west side beyond z = 8 is drawn as a wall
 * too (the plan closes the body), but the emitted body has no wall there.
 *   npx vite-node research/analyzer-n7-council/D/h5-shared-wall-partial-overlap.ts
 */
import { adjudicateThinBody, thinBodies } from '../../../packages/reconstruction/src/v2/thin-body.js'
import type { PlanFrameV2 } from '../../../packages/reconstruction/src/v2/frame.js'
import { building, mass, run, check, done, T } from './lib.js'

const mpp = 0.01
const W = 1400
const H = 1300
const data = new Uint8ClampedArray(W * H * 4).fill(255)
const frame: PlanFrameV2 = { frameId: 'plan-0', assetId: 'a', storeyIndex: 0, mppX: mpp, mppY: mpp, originPx: { x: 100, y: 100 }, why: 'council', toWorld: (px, py) => ({ x: (px - 100) * mpp, z: (py - 100) * mpp }), toPixel: (x, z) => ({ x: 100 + x / mpp, y: 100 + z / mpp }), wallPx: 15 }
const ink = (x0: number, z0: number, x1: number, z1: number): void => {
  for (let py = Math.round(100 + z0 / mpp); py < Math.round(100 + z1 / mpp); py += 1) for (let px = Math.round(100 + x0 / mpp); px < Math.round(100 + x1 / mpp); px += 1) {
    const o = (py * W + px) * 4
    data[o] = data[o + 1] = data[o + 2] = 0
  }
}
// main ring 0..10 x 0..8
ink(0, 0, 10, T); ink(0, 8 - T, 10, 8); ink(0, 0, T, 8); ink(10 - T, 0, 10, 8)
// the thin body 10..10.45 x 4.5..10.5: far wall, front and rear walls, and its own west wall beyond the main body
ink(10.15, 4.5, 10.45, 10.5); ink(10, 4.5, 10.45, 4.5 + T); ink(10, 10.5 - T, 10.45, 10.5); ink(10 - T, 8, 10, 10.5)
const raster = { width: W, height: H, data } as never

const main = mass('main', 'MAIN', 0, 0, 10, 8)
const a = mass('attached-0', 'ATTACHED', 10, 4.5, 10.45, 10.5)
const [tb] = thinBodies([main, a], T)
const rec = adjudicateThinBody(tb.mass, tb.axis, { masses: [main, a], wallThicknessM: T, sourceOf: () => ({ why: 'c', widthBasis: 'MEASURED', evidenceIds: [] }), plan: () => ({ frame, raster }), chains: [], views: [], skyOf: () => ({ data: new Uint8Array(1), width: 1 }), levels: [{ index: 0, elevation: 0, wallTop: 2.65 }] })
console.log('decision', rec.decision.kind, rec.decision.openSide, '\n', rec.hypotheses.map((h) => `${h.kind}:${h.status}`).join(', '))
check('SHARED_WALL decided although main covers only 3.5 of the 6.0 m side', rec.decision.kind === 'SHARED_WALL')
if (rec.decision.kind === 'SHARED_WALL') {
  a.openSide = rec.decision.openSide
  const r = run(building([main, a]))
  const west = r.model?.walls.filter((w) => w.id.startsWith('ring-attached-0-0-')).map((w) => w.id)
  check('model builds (validator accepts the open envelope)', r.plainFailedAt === undefined, `${r.plainFailedId}`)
  // any wall on the line x = 10 over z 8..10.5?
  const covering = r.model?.walls.filter((w) => Math.abs(w.start.x - w.end.x) < 1e-6 && Math.abs(w.start.x - 10) < 0.35 && Math.max(w.start.z, w.end.z) > 9 && Math.min(w.start.z, w.end.z) < 9.5)
  check('NO wall closes the body over z 8..10.5 on its west side (the plan draws one)', (covering ?? []).length === 0, JSON.stringify(covering?.map((w) => w.id)), )
  console.log('  attached walls:', JSON.stringify(west))
}
done()
