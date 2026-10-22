/**
 * Council E — test case G: does `adjudicateThinBody`'s elevation corroboration (`elevationOver`, "not sky" share) accept
 * trees, shadows or a body standing BEHIND as "built"? Uses the PRODUCTION `skyMask` (the unit test stubs it).
 * Invented geometry only (same frame as packages/reconstruction/test/thin-body-n7-p2r.test.ts).
 *   npx vite-node research/analyzer-n7-council/E/thin-body-sky.ts
 */
import type { Raster } from '@buildapp/source-cv'
import { adjudicateThinBody, skyMask } from '@buildapp/reconstruction'
import type { ElevationFrameV2, MassV2, PlanFrameV2, ThinBodyInput } from '@buildapp/reconstruction'

const PPM = 50, OX = 40, OY = 40, T = 0.3, W = 900, H = 600
const frame: PlanFrameV2 = { frameId: 'plan-0', assetId: 'a', storeyIndex: 0, mppX: 1 / PPM, mppY: 1 / PPM, originPx: { x: OX, y: OY }, why: 't', toWorld: (px, py) => ({ x: (px - OX) / PPM, z: (py - OY) / PPM }), toPixel: (x, z) => ({ x: OX + x * PPM, y: OY + z * PPM }), wallPx: (T * PPM) / 2 }
function plan(strokes: Array<{ from: number; to: number }>): Raster {
  const data = new Uint8ClampedArray(W * H * 4).fill(255)
  for (const s of strokes) for (let py = OY; py < OY + 8 * PPM; py += 1) for (let px = Math.round(OX + s.from * PPM); px < Math.round(OX + s.to * PPM); px += 1) { const o = (py * W + px) * 4; data[o] = data[o + 1] = data[o + 2] = 30 }
  return { width: W, height: H, data }
}
const mass = (id: string, role: 'MAIN' | 'ATTACHED', x0: number, x1: number, z0 = 0, z1 = 8): MassV2 => ({ id, role, x0, z0, x1, z1, storeys: [0], featureId: `f-${id}`, sourceMassId: `m-${id}` })
const main = mass('main', 'MAIN', 0, 8)
const band = mass('band', 'ATTACHED', 8, 8.45)
const GROUND = 500
const frontView: ElevationFrameV2 = { registration: { frameId: 'front', assetId: 'a-front' } as ElevationFrameV2['registration'], side: 'FRONT', planeAt: 0, alongOf: (px) => (px - OX) / PPM, pxOf: (a) => OX + a * PPM, yOf: (py) => (GROUND - py) / PPM, pyOf: (y) => GROUND - y * PPM }

type Paint = { x0: number; x1: number; y0: number; y1: number; rgb: [number, number, number] }
/** A render: pale-blue sky gradient, grass below the ground row, the main body's wall (x 0..8, 0..2.8 m), plus extras. */
function render(extras: Paint[], background: 'SKY' | 'WHITE' = 'SKY'): Raster {
  const data = new Uint8ClampedArray(W * H * 4)
  for (let py = 0; py < H; py += 1) for (let px = 0; px < W; px += 1) {
    const o = (py * W + px) * 4
    const sky: [number, number, number] = background === 'WHITE' ? [255, 255, 255] : [150 + Math.round((py / H) * 40), 185 + Math.round((py / H) * 30), 235]
    const c = py >= GROUND ? [110, 140, 80] : sky
    data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255
  }
  const paint = (p: Paint): void => {
    for (let py = Math.round(frontView.pyOf(p.y1)); py < Math.round(frontView.pyOf(p.y0)); py += 1) for (let px = Math.round(frontView.pxOf(p.x0)); px < Math.round(frontView.pxOf(p.x1)); px += 1) { const o = (py * W + px) * 4; data[o] = p.rgb[0]; data[o + 1] = p.rgb[1]; data[o + 2] = p.rgb[2] }
  }
  paint({ x0: 0, x1: 8, y0: 0, y1: 2.8, rgb: [232, 228, 220] })
  paint({ x0: -0.5, x1: 8.5, y0: 2.8, y1: 3.4, rgb: [120, 60, 50] })
  extras.forEach(paint)
  return { width: W, height: H, data }
}

const planWiden = plan([{ from: 7.7, to: 8 }, { from: 11.7, to: 12 }]) // main's east wall; a wall/parapet/fence line 4 m out, paper between
const base = (masses: MassV2[], raster: Raster): ThinBodyInput => ({
  masses, wallThicknessM: T,
  sourceOf: () => ({ why: 'test', widthBasis: 'SCALED', evidenceIds: [] }),
  plan: () => ({ frame, raster: planWiden }), chains: [],
  views: [{ view: frontView, raster }],
  skyOf: (r) => skyMask(r),
  levels: [{ index: 0, elevation: 0, wallTop: 2.8 }],
})

const cases: Array<{ name: string; masses: MassV2[]; raster: Raster; truth: 'NOTHING_BUILT' | 'BUILT' }> = [
  { name: 'G0 control: empty sky over the widened part', masses: [main, band], raster: render([]), truth: 'NOTHING_BUILT' },
  { name: 'G0b control: real wall 8..12 m (built)', masses: [main, band], raster: render([{ x0: 8, x1: 12, y0: 0, y1: 2.8, rgb: [225, 220, 210] }]), truth: 'BUILT' },
  { name: 'G1 trees (green foliage) over 8..12 m, nothing built', masses: [main, band], raster: render([{ x0: 8.2, x1: 12, y0: 0, y1: 4.2, rgb: [60, 105, 50] }]), truth: 'NOTHING_BUILT' },
  { name: 'G2 dark-olive/brown trees (autumn, not g-dominant)', masses: [main, band], raster: render([{ x0: 8.2, x1: 12, y0: 0, y1: 4.2, rgb: [95, 85, 60] }]), truth: 'NOTHING_BUILT' },
  { name: 'G3 cast shadow/hedge in grey (90,90,95) up to 1.6 m only', masses: [main, band], raster: render([{ x0: 8, x1: 12, y0: 0, y1: 1.6, rgb: [90, 90, 95] }]), truth: 'NOTHING_BUILT' },
  { name: 'G4 a garage BEHIND (z 9..15) at x 8..12, the band\'s widened part empty', masses: [main, band, mass('garage', 'ATTACHED', 8, 12, 9, 15)], raster: render([{ x0: 8, x1: 12, y0: 0, y1: 2.6, rgb: [225, 220, 210] }]), truth: 'NOTHING_BUILT' },
  { name: 'G5 white paper drawing (ARCHON-like line elevation), widened part blank', masses: [main, band], raster: render([], 'WHITE'), truth: 'NOTHING_BUILT' },
]
let wrong = 0
for (const c of cases) {
  const r = adjudicateThinBody({ ...band }, 'X', base(c.masses, c.raster))
  const widened = r.decision.kind === 'WIDEN'
  const bad = (c.truth === 'NOTHING_BUILT') === widened
  if (bad && c.truth === 'NOTHING_BUILT') wrong += 1
  console.log(`${bad ? 'WRONG' : 'ok   '} ${c.name}\n      elevations=${JSON.stringify(r.elevations.map((e) => [e.side, e.builtShare, e.verdict, (e as any).edges]))} decision=${r.decision.kind}${r.decision.after ? ` x1->${r.decision.after.x1}` : ''}`)
}
console.log(`RESULT: ${wrong} case(s) where nothing is built yet the body was WIDENED on the elevation's word`)
