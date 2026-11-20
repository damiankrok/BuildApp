/**
 * v3.54.17 §10 — the CPU of the body-scale gate: compareRegions (the deciding test of BUILD_MASSING / SET_ROOF /
 * SET_OUTLINE) and comparePolygons (its edge record), each timed with process.cpuUsage over N calls on a frame-size
 * raster (the Alaska WEST elevation's frame, read from the run's byte cache when given; else a painted 1024 × 683 frame).
 *   npx vite-node research/source-to-model/v35417/gate-cpu.ts -- [N]
 */
import { compareRegions, comparePolygons } from '../../../packages/analysis-service/src/consult/correct/source-gate.js'
const N = Number(process.argv.filter((a) => a !== '--')[2] ?? 20)
const W = 1024
const H = 683
const data = new Uint8ClampedArray(W * H * 4)
let seed = 3
const rnd = (): number => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
  const n = Math.round((rnd() - 0.5) * 18)
  const wall = x >= 205 && x <= 892 && y >= 356 && y <= 565
  const roof = x >= 203 && x <= 894 && y >= 174 && y < 356
  const c = wall ? [228 + n, 218 + n, 198 + n] : roof ? [92 + n, 92 + n, 98 + n] : y > 565 ? [120 + n, 150 + n, 100 + n] : [240, 240, 240]
  data.set([c[0], c[1], c[2], 255], (y * W + x) * 4)
}
const r = { width: W, height: H, data }
const walls: Array<[number, number]> = [[205, 565], [892, 565], [892, 356], [205, 356]]
const band: Array<[number, number]> = [[203, 356], [894, 356], [894, 174], [203, 174]]
const flat: Array<[number, number]> = [[205, 565], [892, 565], [892, 340], [205, 340]]
const time = (f: () => unknown): { msPerCall: number; cpuMsPerCall: number } => {
  const c0 = process.cpuUsage()
  const t0 = performance.now()
  for (let i = 0; i < N; i += 1) f()
  const c = process.cpuUsage(c0)
  return { msPerCall: Math.round(((performance.now() - t0) / N) * 100) / 100, cpuMsPerCall: Math.round(((c.user + c.system) / 1000 / N) * 100) / 100 }
}
const region = time(() => compareRegions(r, [walls, band], [flat], [], 565))
const poly = time(() => comparePolygons(r, band, undefined, { x0: 203, x1: 894 }, [], 3))
console.log(JSON.stringify({ frame: `${W}x${H}`, calls: N, compareRegions: region, comparePolygons: poly, verdict: compareRegions(r, [walls, band], [flat], [], 565).winner }))
