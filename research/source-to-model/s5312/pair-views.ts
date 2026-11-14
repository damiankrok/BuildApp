/**
 * v3.53.12 boards: two models (before / after) drawn from the SAME cameras at the SAME scale — one projection, centre
 * and pixels-per-metre per view, fitted to the union of both models, never to each one alone — so what grows or shrinks
 * between the two is visible as it is. The scene is the production compiler's, exactly as the replay's `--views`
 * makes it (`compileBuilding` → `buildMobileSceneBundle`); the rasterizer is the one of `mobile-scene/scripts/
 * scene-sheet.ts` with the fit taken out of the loop. A model that is absent (a refusal) is drawn as an empty sheet.
 *
 *   npx vite-node research/source-to-model/s5312/pair-views.ts -- <before model.json|-> <after model.json|-> <out-prefix>
 *
 * Writes <out-prefix>-before.png and <out-prefix>-after.png (four views each: front, right, top, front-right
 * axonometric, 2 × 2 tiles of 480 px) and <out-prefix>-camera.json (the shared fit, in metres).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { PNG } from 'pngjs'
import { compileBuilding } from '@buildapp/geometry'
import { buildMobileSceneBundle } from '@buildapp/mobile-scene'
import type { MobileSceneBundle } from '@buildapp/mobile-scene'

type V3 = [number, number, number]
type View = { name: string; project: (p: V3) => V3 }
const args = process.argv.slice(2).filter((a) => a !== '--')
const [beforePath, afterPath, prefix] = args
const TILE = 480

const bundleOf = (path: string): MobileSceneBundle | undefined => {
  if (path === '-' || !existsSync(path)) return undefined
  const model = JSON.parse(readFileSync(path, 'utf8'))
  return buildMobileSceneBundle(model, { scene: compileBuilding(model) })
}
const bundles = [bundleOf(beforePath), bundleOf(afterPath)]
const hex = (c: string | undefined): V3 => {
  const m = /^#?([0-9a-f]{6})$/i.exec(c ?? '')
  if (!m) return [200, 200, 200]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
// one centre for both: the middle of the union of the two scenes' bounds
const bs = bundles.flatMap((b) => (b?.scene.bounds ? [b.scene.bounds] : []))
const c = bs.length === 0 ? [0, 0, 0] : (['x', 'y', 'z'] as const).map((k) => (Math.min(...bs.map((b) => b.min[k])) + Math.max(...bs.map((b) => b.max[k]))) / 2)
const [cx, cy, cz] = c
const ay = (35 * Math.PI) / 180
const ax = (30 * Math.PI) / 180
const views: View[] = [
  { name: 'front', project: ([x, y, z]) => [x - cx, y - cy, -(z - cz)] },
  { name: 'right', project: ([x, y, z]) => [z - cz, y - cy, x - cx] },
  { name: 'top', project: ([x, y, z]) => [x - cx, -(z - cz), y - cy] },
  {
    name: 'front-right',
    project: ([x, y, z]) => {
      const X = x - cx
      const Y = y - cy
      const Z = -(z - cz)
      const x1 = X * Math.cos(ay) + Z * Math.sin(ay)
      const z1 = -X * Math.sin(ay) + Z * Math.cos(ay)
      return [x1, Y * Math.cos(ax) - z1 * Math.sin(ax), Y * Math.sin(ax) + z1 * Math.cos(ax)]
    },
  },
]
type Tri = { p: V3[]; c: V3 }
const trisOf = (b: MobileSceneBundle | undefined, view: View): Tri[] => {
  if (!b) return []
  const colours = new Map<string, V3>()
  for (const m of (b as unknown as { materials?: Array<{ id: string; color?: string }> }).materials ?? []) colours.set(m.id, hex(m.color))
  const out: Tri[] = []
  for (const mesh of b.scene.meshes) {
    const base = colours.get(mesh.materialId ?? '') ?? [200, 200, 200]
    for (let i = 0; i + 8 < mesh.positions.length; i += 9) out.push({ p: [0, 1, 2].map((k) => view.project([mesh.positions[i + k * 3], mesh.positions[i + k * 3 + 1], mesh.positions[i + k * 3 + 2]])), c: base })
  }
  return out
}
// the shared fit per view: the union of both models' projected extents
const fits = views.map((view) => {
  let lo = [Infinity, Infinity]
  let hi = [-Infinity, -Infinity]
  for (const b of bundles)
    for (const t of trisOf(b, view))
      for (const q of t.p) {
        lo = [Math.min(lo[0], q[0]), Math.min(lo[1], q[1])]
        hi = [Math.max(hi[0], q[0]), Math.max(hi[1], q[1])]
      }
  if (!Number.isFinite(lo[0])) return { scale: 1, mx: 0, my: 0 }
  return { scale: (TILE * 0.88) / Math.max(hi[0] - lo[0], hi[1] - lo[1], 1e-6), mx: (lo[0] + hi[0]) / 2, my: (lo[1] + hi[1]) / 2 }
})
const render = (b: MobileSceneBundle | undefined): PNG => {
  const W = TILE * 2
  const png = new PNG({ width: W, height: TILE * 2 })
  png.data.fill(255)
  views.forEach((view, vi) => {
    const ox = (vi % 2) * TILE
    const oy = Math.floor(vi / 2) * TILE
    const { scale, mx, my } = fits[vi]
    const depth = new Float64Array(TILE * TILE).fill(-Infinity)
    const light: V3 = [0.35, 0.8, 0.5]
    for (const t of trisOf(b, view)) {
      const s = t.p.map((q) => [TILE / 2 + (q[0] - mx) * scale, TILE / 2 - (q[1] - my) * scale, q[2]] as V3)
      const u: V3 = [t.p[1][0] - t.p[0][0], t.p[1][1] - t.p[0][1], t.p[1][2] - t.p[0][2]]
      const v: V3 = [t.p[2][0] - t.p[0][0], t.p[2][1] - t.p[0][1], t.p[2][2] - t.p[0][2]]
      const n: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
      const shade = 0.45 + 0.55 * Math.abs((n[0] * light[0] + n[1] * light[1] + n[2] * light[2]) / (Math.hypot(...n) || 1))
      const minX = Math.max(0, Math.floor(Math.min(s[0][0], s[1][0], s[2][0])))
      const maxX = Math.min(TILE - 1, Math.ceil(Math.max(s[0][0], s[1][0], s[2][0])))
      const minY = Math.max(0, Math.floor(Math.min(s[0][1], s[1][1], s[2][1])))
      const maxY = Math.min(TILE - 1, Math.ceil(Math.max(s[0][1], s[1][1], s[2][1])))
      const area = (s[1][0] - s[0][0]) * (s[2][1] - s[0][1]) - (s[2][0] - s[0][0]) * (s[1][1] - s[0][1])
      if (Math.abs(area) < 1e-9) continue
      for (let y = minY; y <= maxY; y += 1)
        for (let x = minX; x <= maxX; x += 1) {
          const px = x + 0.5
          const py = y + 0.5
          const w0 = ((s[1][0] - px) * (s[2][1] - py) - (s[2][0] - px) * (s[1][1] - py)) / area
          const w1 = ((s[2][0] - px) * (s[0][1] - py) - (s[0][0] - px) * (s[2][1] - py)) / area
          const w2 = 1 - w0 - w1
          if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue
          const z = w0 * s[0][2] + w1 * s[1][2] + w2 * s[2][2]
          const k = y * TILE + x
          if (z <= depth[k]) continue
          depth[k] = z
          const o = ((oy + y) * W + ox + x) * 4
          png.data[o] = Math.min(255, t.c[0] * shade)
          png.data[o + 1] = Math.min(255, t.c[1] * shade)
          png.data[o + 2] = Math.min(255, t.c[2] * shade)
          png.data[o + 3] = 255
        }
    }
    for (let i = 0; i < TILE; i += 1)
      for (const [x, y] of [[ox + i, oy], [ox + i, oy + TILE - 1], [ox, oy + i], [ox + TILE - 1, oy + i]]) {
        const o = (y * W + x) * 4
        png.data[o] = png.data[o + 1] = png.data[o + 2] = 180
      }
  })
  return png
}
writeFileSync(`${prefix}-before.png`, PNG.sync.write(render(bundles[0])))
writeFileSync(`${prefix}-after.png`, PNG.sync.write(render(bundles[1])))
writeFileSync(`${prefix}-camera.json`, JSON.stringify({ centre: c, views: views.map((v, i) => ({ name: v.name, pxPerM: Math.round(fits[i].scale * 1000) / 1000 })) }, null, 1))
console.log(prefix, JSON.stringify(fits.map((f) => Math.round(f.scale * 100) / 100)))
