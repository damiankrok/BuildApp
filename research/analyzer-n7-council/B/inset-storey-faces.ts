/**
 * N7-COUNCIL B (research only, synthetic, invented numbers): an upper storey drawn at the base plan's own sheet scale
 * (0.025 m/px) whose walls stand 0.5 m in from the 10.0 × 8.0 m body below on every side. `planFrameByOuterFaces`
 * puts its faces on the whole body; the two axes then disagree by under 3 %, so the frame is accepted at a scale 11 %
 * off. In `reconstruct-v2.ts` the agreement test against the layout's alignment runs only for a STATED/PRINTED_SCALE
 * basis, so a FITTED / WALL_PAIRS / SAME_PIXEL_SCALE alignment (every corpus upper storey) never checks it.
 */
import { planFrameByOuterFaces } from '../../../packages/reconstruction/src/v2/frame.js'

const MPP = 0.025
const W = 600
const H = 520
const data = new Uint8ClampedArray(W * H * 4).fill(255)
const ink = (x0: number, y0: number, x1: number, y1: number): void => {
  for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) { const o = (y * W + x) * 4; data[o] = data[o + 1] = data[o + 2] = 0 }
}
// the upper storey: 9.0 × 7.0 m outer faces, 0.4 m (16 px) walls, at px 60.. ; body below is 10.0 × 8.0 m
const fx0 = 60, fy0 = 60, fw = Math.round(9.0 / MPP), fh = Math.round(7.0 / MPP), t = 16
ink(fx0, fy0, fx0 + fw, fy0 + t); ink(fx0, fy0 + fh - t, fx0 + fw, fy0 + fh); ink(fx0, fy0, fx0 + t, fy0 + fh); ink(fx0 + fw - t, fy0, fx0 + fw, fy0 + fh)
const plan = { frame: { id: 'f-up', assetId: 'a-up' }, wallPx: t, extent: { x0: fx0, y0: fy0, x1: fx0 + fw, y1: fy0 + fh } } as never
const world = { envelope: { x0: 0, z0: 0, x1: 10, z1: 8 }, walled: { x0: 0, z0: 0, x1: 10, z1: 8 }, zFlip: 8, frontSide: 'SHEET_BOTTOM', why: '' } as never
const f = planFrameByOuterFaces(plan, 1, world, { x0: 0, z0: 0, x1: 10, z1: 8 }, { width: W, height: H, data })
if (!f) throw new Error('refused (the expected safe outcome)')
const err = f.mppX / MPP - 1
console.log(`accepted: mppX ${f.mppX} mppY ${f.mppY} against the sheet's ${MPP}: ${(err * 100).toFixed(1)} % off; ${f.why}`)
const p = f.toWorld(fx0 + fw / 2 + 80, fy0 + t)
console.log(`a window 2.0 m east of the storey's centre on its rear wall lands at x ${p.x} (true 6.5): ${(p.x - 6.5).toFixed(2)} m`)
