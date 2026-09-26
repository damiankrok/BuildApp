/**
 * A scene bundle drawn from four fixed cameras onto one sheet — front, right,
 * top, and a front-right axonometric — by a small z-buffered software
 * rasterizer, with each mesh flat-shaded in its material's colour. For CI
 * artifacts and stage reports: a reviewer sees the building without a GPU, a
 * browser or a phone. It reads the bundle exactly as a client does and
 * decides nothing about the building. (The CLI is `scene-views.ts`.)
 */
import { PNG } from 'pngjs'
import type { MobileSceneBundle } from '../src/index.js'

type V3 = [number, number, number]
type View = { name: string; project: (p: V3) => V3 }

const hex = (c: string | undefined): V3 => {
  const m = /^#?([0-9a-f]{6})$/i.exec(c ?? '')
  if (!m) return [200, 200, 200]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function renderSceneSheet(bundle: MobileSceneBundle, tile = 480): PNG {
  const colours = new Map<string, V3>()
  for (const m of (bundle as unknown as { materials?: Array<{ id: string; color?: string }> }).materials ?? []) colours.set(m.id, hex(m.color))
  const b = bundle.scene.bounds
  const cx = b ? (b.min.x + b.max.x) / 2 : 0
  const cy = b ? (b.min.y + b.max.y) / 2 : 0
  const cz = b ? (b.min.z + b.max.z) / 2 : 0
  const ay = (35 * Math.PI) / 180
  const ax = (30 * Math.PI) / 180
  const views: View[] = [
    // screen x, screen y (up), depth (towards the viewer is larger)
    { name: 'front', project: ([x, y, z]) => [x - cx, y - cy, -(z - cz)] },
    { name: 'right', project: ([x, y, z]) => [z - cz, y - cy, x - cx] },
    { name: 'top', project: ([x, y, z]) => [x - cx, -(z - cz), y - cy] },
    {
      name: 'axonometric',
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
  const png = new PNG({ width: tile * 2, height: tile * 2 })
  png.data.fill(255)
  views.forEach((view, vi) => {
    const ox = (vi % 2) * tile
    const oy = Math.floor(vi / 2) * tile
    const tris: Array<{ p: V3[]; c: V3 }> = []
    let lo = [Infinity, Infinity]
    let hi = [-Infinity, -Infinity]
    for (const mesh of bundle.scene.meshes) {
      const base = colours.get(mesh.materialId ?? '') ?? [200, 200, 200]
      for (let i = 0; i + 8 < mesh.positions.length; i += 9) {
        const p = [0, 1, 2].map((k) => view.project([mesh.positions[i + k * 3], mesh.positions[i + k * 3 + 1], mesh.positions[i + k * 3 + 2]]))
        for (const q of p) {
          lo = [Math.min(lo[0], q[0]), Math.min(lo[1], q[1])]
          hi = [Math.max(hi[0], q[0]), Math.max(hi[1], q[1])]
        }
        tris.push({ p, c: base })
      }
    }
    const span = Math.max(hi[0] - lo[0], hi[1] - lo[1], 1e-6)
    const scale = (tile * 0.88) / span
    const mx = (lo[0] + hi[0]) / 2
    const my = (lo[1] + hi[1]) / 2
    const depth = new Float64Array(tile * tile).fill(-Infinity)
    const light: V3 = [0.35, 0.8, 0.5]
    for (const t of tris) {
      const s = t.p.map((q) => [tile / 2 + (q[0] - mx) * scale, tile / 2 - (q[1] - my) * scale, q[2]] as V3)
      const u: V3 = [t.p[1][0] - t.p[0][0], t.p[1][1] - t.p[0][1], t.p[1][2] - t.p[0][2]]
      const v: V3 = [t.p[2][0] - t.p[0][0], t.p[2][1] - t.p[0][1], t.p[2][2] - t.p[0][2]]
      const n: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
      const len = Math.hypot(...n) || 1
      const shade = 0.45 + 0.55 * Math.abs((n[0] * light[0] + n[1] * light[1] + n[2] * light[2]) / len)
      const minX = Math.max(0, Math.floor(Math.min(s[0][0], s[1][0], s[2][0])))
      const maxX = Math.min(tile - 1, Math.ceil(Math.max(s[0][0], s[1][0], s[2][0])))
      const minY = Math.max(0, Math.floor(Math.min(s[0][1], s[1][1], s[2][1])))
      const maxY = Math.min(tile - 1, Math.ceil(Math.max(s[0][1], s[1][1], s[2][1])))
      const area = (s[1][0] - s[0][0]) * (s[2][1] - s[0][1]) - (s[2][0] - s[0][0]) * (s[1][1] - s[0][1])
      if (Math.abs(area) < 1e-9) continue
      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const px = x + 0.5
          const py = y + 0.5
          const w0 = ((s[1][0] - px) * (s[2][1] - py) - (s[2][0] - px) * (s[1][1] - py)) / area
          const w1 = ((s[2][0] - px) * (s[0][1] - py) - (s[0][0] - px) * (s[2][1] - py)) / area
          const w2 = 1 - w0 - w1
          if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue
          const z = w0 * s[0][2] + w1 * s[1][2] + w2 * s[2][2]
          const k = y * tile + x
          if (z <= depth[k]) continue
          depth[k] = z
          const o = ((oy + y) * tile * 2 + ox + x) * 4
          png.data[o] = Math.min(255, t.c[0] * shade)
          png.data[o + 1] = Math.min(255, t.c[1] * shade)
          png.data[o + 2] = Math.min(255, t.c[2] * shade)
          png.data[o + 3] = 255
        }
      }
    }
    // tile border
    for (let i = 0; i < tile; i += 1) {
      for (const [x, y] of [[ox + i, oy], [ox + i, oy + tile - 1], [ox, oy + i], [ox + tile - 1, oy + i]]) {
        const o = (y * tile * 2 + x) * 4
        png.data[o] = png.data[o + 1] = png.data[o + 2] = 180
      }
    }
  })
  return png
}

