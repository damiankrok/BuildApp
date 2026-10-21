/**
 * 005Y-N3 diagnostic (research only): look at one part of a compiled model from any camera, with everything else
 * hidden or greyed. The model is compiled with the production compiler (`compileBuilding`); the picture is a plain
 * z-buffered rasterisation of its triangles, flat-shaded, coloured by geometry part, so what it shows is exactly the
 * triangles the viewer would draw — no viewer state, no publisher image.
 *
 *   npx vite-node research/analyzer-005y-n3-architectural-primitives/isolate.ts -- <model.json> <out.png> [options]
 *     --eye x,y,z --at x,y,z      perspective camera (default: a ¾ view of the whole model)
 *     --fov 40 --size 900x700
 *     --only <regex>              keep meshes whose `objectId part` matches
 *     --hide <regex>              drop meshes whose `objectId part` matches (e.g. 'ROOF|ROOF_TRIM')
 *     --mark <regex>              draw matching meshes in red over the rest
 *     --clip axis,op,value        drop triangles whose centroid fails it, e.g. 'x,<,4.2' (a vertical section)
 *     --probe x0,x1,y0,y1,z0,z1   print every mesh with a vertex in the box, and its triangles there
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { PNG } from 'pngjs'
import { validateModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import type { CompiledMesh, Triangle, Vec3 } from '@buildapp/geometry'

const argv = process.argv.slice(2).filter((a) => a !== '--')
const [modelPath, outPath] = argv
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const vec = (s: string): Vec3 => {
  const [x, y, z] = s.split(',').map(Number)
  return { x, y, z }
}
const v = validateModel(JSON.parse(readFileSync(modelPath, 'utf8')))
if (!v.model) throw new Error('invalid model')
const scene = compileBuilding(v.model)
const key = (m: CompiledMesh) => `${m.objectId} ${m.part}`
const only = opt('only') ? new RegExp(opt('only') as string) : null
const hide = opt('hide') ? new RegExp(opt('hide') as string) : null
const mark = opt('mark') ? new RegExp(opt('mark') as string) : null
const meshes = scene.meshes.filter((m) => (!only || only.test(key(m))) && (!hide || !hide.test(key(m))))

const probe = opt('probe')
if (probe) {
  const [x0, x1, y0, y1, z0, z1] = probe.split(',').map(Number)
  const inside = (p: Vec3) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && p.z >= z0 && p.z <= z1
  for (const m of scene.meshes) {
    const tris = m.triangles.filter((t) => inside(t.a) || inside(t.b) || inside(t.c))
    if (tris.length === 0) continue
    console.log(`${m.objectKind} ${m.objectId} ${m.part} solid=${m.solidId} host=${m.hostWallId ?? '-'} level=${m.levelId ?? '-'} tris-in-box ${tris.length}/${m.triangles.length}`)
    if (process.env.TRIS) for (const t of tris) console.log('   ', [t.a, t.b, t.c].map((p) => `(${p.x.toFixed(Number(process.env.DIGITS ?? 3))},${p.y.toFixed(Number(process.env.DIGITS ?? 3))},${p.z.toFixed(Number(process.env.DIGITS ?? 3))})`).join(' '))
  }
}

const clip = opt('clip')
const keepTri = (t: Triangle): boolean => {
  if (!clip) return true
  const [axis, op, value] = clip.split(',')
  const c = (t.a[axis as 'x'] + t.b[axis as 'x'] + t.c[axis as 'x']) / 3
  return op === '<' ? c < Number(value) : c > Number(value)
}

const b = scene.bounds ?? { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 8, z: 10 } }
const centre = { x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2, z: (b.min.z + b.max.z) / 2 }
const span = Math.max(b.max.x - b.min.x, b.max.z - b.min.z, b.max.y - b.min.y)
const at = opt('at') ? vec(opt('at') as string) : centre
const eye = opt('eye') ? vec(opt('eye') as string) : { x: centre.x + span, y: centre.y + span * 0.8, z: centre.z - span }
const [W, H] = (opt('size') ?? '900x700').split('x').map(Number)
const fov = (Number(opt('fov') ?? 40) * Math.PI) / 180

const sub = (p: Vec3, q: Vec3): Vec3 => ({ x: p.x - q.x, y: p.y - q.y, z: p.z - q.z })
const cross = (p: Vec3, q: Vec3): Vec3 => ({ x: p.y * q.z - p.z * q.y, y: p.z * q.x - p.x * q.z, z: p.x * q.y - p.y * q.x })
const dot = (p: Vec3, q: Vec3) => p.x * q.x + p.y * q.y + p.z * q.z
const norm = (p: Vec3): Vec3 => {
  const l = Math.hypot(p.x, p.y, p.z) || 1
  return { x: p.x / l, y: p.y / l, z: p.z / l }
}
const fwd = norm(sub(at, eye))
const right = norm(cross({ x: 0, y: 1, z: 0 }, fwd)) // the viewer's convention: x right, y up, z into the building
const up = cross(fwd, right)
const f = H / 2 / Math.tan(fov / 2)
const project = (p: Vec3): { x: number; y: number; d: number } => {
  const r = sub(p, eye)
  const d = dot(r, fwd)
  return { x: W / 2 + (dot(r, right) * f) / d, y: H / 2 - (dot(r, up) * f) / d, d }
}

const PART_RGB: Record<string, [number, number, number]> = {
  WALL: [205, 200, 190], WALL_REVEAL: [170, 165, 155], ROOF: [90, 85, 80], ROOF_PLANE: [90, 85, 80], ROOF_TRIM: [235, 235, 235], ROOF_REVEAL: [70, 70, 70],
  SLAB: [150, 150, 170], WINDOW_GLASS: [120, 170, 200], DOOR_GLASS: [120, 170, 200], WINDOW_FRAME: [60, 60, 60], DOOR_LEAF: [150, 100, 60], DOOR_FRAME: [60, 60, 60],
  CHIMNEY: [110, 110, 110], STAIR_STEP: [200, 150, 60], STAIR_PLACEHOLDER: [200, 150, 60], WALL_PANEL: [230, 225, 210], LINEAR_SOLID: [245, 245, 245],
  ROOM_FLOOR: [120, 160, 120], TERRACE: [150, 140, 130], PLATFORM: [150, 140, 130], RAILING_INFILL: [100, 140, 170], BALCONY: [140, 140, 140],
}
const light = norm({ x: 0.4, y: 0.8, z: -0.3 })
const zbuf = new Float64Array(W * H).fill(Infinity)
const png = new PNG({ width: W, height: H })
for (let i = 0; i < W * H; i += 1) {
  png.data[i * 4] = 24
  png.data[i * 4 + 1] = 26
  png.data[i * 4 + 2] = 30
  png.data[i * 4 + 3] = 255
}
function raster(t: Triangle, rgb: [number, number, number]): void {
  const n = norm(cross(sub(t.b, t.a), sub(t.c, t.a)))
  const s = 0.45 + 0.55 * Math.abs(dot(n, light))
  const [a, bb, c] = [project(t.a), project(t.b), project(t.c)]
  if (a.d <= 0.05 || bb.d <= 0.05 || c.d <= 0.05) return
  const x0 = Math.max(0, Math.floor(Math.min(a.x, bb.x, c.x)))
  const x1 = Math.min(W - 1, Math.ceil(Math.max(a.x, bb.x, c.x)))
  const y0 = Math.max(0, Math.floor(Math.min(a.y, bb.y, c.y)))
  const y1 = Math.min(H - 1, Math.ceil(Math.max(a.y, bb.y, c.y)))
  const area = (bb.x - a.x) * (c.y - a.y) - (c.x - a.x) * (bb.y - a.y)
  if (Math.abs(area) < 1e-9) return
  for (let y = y0; y <= y1; y += 1)
    for (let x = x0; x <= x1; x += 1) {
      const px = x + 0.5
      const py = y + 0.5
      const w0 = ((bb.x - px) * (c.y - py) - (c.x - px) * (bb.y - py)) / area
      const w1 = ((c.x - px) * (a.y - py) - (a.x - px) * (c.y - py)) / area
      const w2 = 1 - w0 - w1
      if (w0 < 0 || w1 < 0 || w2 < 0) continue
      const d = 1 / (w0 / a.d + w1 / bb.d + w2 / c.d)
      const i = y * W + x
      if (d >= zbuf[i]) continue
      zbuf[i] = d
      png.data[i * 4] = Math.min(255, rgb[0] * s)
      png.data[i * 4 + 1] = Math.min(255, rgb[1] * s)
      png.data[i * 4 + 2] = Math.min(255, rgb[2] * s)
    }
}
let drawn = 0
for (const m of meshes) {
  const rgb: [number, number, number] = mark?.test(key(m)) ? [230, 40, 40] : PART_RGB[m.part] ?? [180, 120, 200]
  for (const t of m.triangles) if (keepTri(t)) {
    raster(t, rgb)
    drawn += 1
  }
}
writeFileSync(outPath, PNG.sync.write(png))
console.log(`${outPath}: ${drawn} triangles of ${meshes.length} meshes; eye ${JSON.stringify(eye)} at ${JSON.stringify(at)}`)
