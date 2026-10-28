/**
 * N8-03D1 (research only, offline): the floor slabs of one model, measured on the compiled triangles.
 *
 * For every slab: vertical rays on a 0.05 m grid over the slab's polygon; a cell is solid when the ray meets the slab's
 * triangles. Reported per slab: solid and open area, and for every hole of the model, the rays inside it (inset by
 * 0.05 m) that still hit, and the rays in a 0.3 m ring around it (inside the slab polygon, outside every hole) that miss.
 * Also: every other mesh whose triangles a ray through a hole meets between the slab's underside and 0.05 m above its top
 * (a room floor plate lying over the void, say).
 *
 *   npx vite-node research/analyzer-n8-03d1/slab-probe.ts -- --model <model.json>
 * Prints JSON; nothing is written.
 */
import { readFileSync } from 'node:fs'
import { parseModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import type { Triangle, Vec3 } from '@buildapp/geometry'

const arg = (name: string): string | undefined => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : undefined)
const model = parseModel(readFileSync(arg('model') as string, 'utf8'))
const scene = compileBuilding(model)
const r3 = (v: number): number => Math.round(v * 1e3) / 1e3
type P = { x: number; z: number }

function rayHit(t: Triangle, p: Vec3, d: Vec3): number | undefined {
  const e1 = { x: t.b.x - t.a.x, y: t.b.y - t.a.y, z: t.b.z - t.a.z }
  const e2 = { x: t.c.x - t.a.x, y: t.c.y - t.a.y, z: t.c.z - t.a.z }
  const h = { x: d.y * e2.z - d.z * e2.y, y: d.z * e2.x - d.x * e2.z, z: d.x * e2.y - d.y * e2.x }
  const a = e1.x * h.x + e1.y * h.y + e1.z * h.z
  if (Math.abs(a) < 1e-12) return undefined
  const f = 1 / a
  const s = { x: p.x - t.a.x, y: p.y - t.a.y, z: p.z - t.a.z }
  const u = f * (s.x * h.x + s.y * h.y + s.z * h.z)
  if (u < 0 || u > 1) return undefined
  const q = { x: s.y * e1.z - s.z * e1.y, y: s.z * e1.x - s.x * e1.z, z: s.x * e1.y - s.y * e1.x }
  const v = f * (d.x * q.x + d.y * q.y + d.z * q.z)
  if (v < 0 || u + v > 1) return undefined
  const tt = f * (e2.x * q.x + e2.y * q.y + e2.z * q.z)
  return tt >= 0 ? tt : undefined
}
function inside(poly: P[], x: number, z: number): boolean {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i] as P
    const b = poly[j] as P
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c
  }
  return c
}
function distToPoly(poly: P[], x: number, z: number): number {
  let best = Infinity
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i] as P
    const b = poly[(i + 1) % poly.length] as P
    const dx = b.x - a.x
    const dz = b.z - a.z
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)))
    best = Math.min(best, Math.hypot(x - a.x - t * dx, z - a.z - t * dz))
  }
  return best
}

const step = 0.05
const out = model.slabs.map((slab) => {
  const level = model.levels.find((l) => l.id === slab.levelId)
  const y0 = (level?.elevation ?? 0) + slab.topOffset
  const tris = scene.meshes.filter((m) => m.part === 'SLAB' && m.objectId === slab.id).flatMap((m) => m.triangles)
  const hits = (x: number, z: number): boolean => tris.some((t) => rayHit(t, { x, y: y0 - 10, z }, { x: 0, y: 1, z: 0 }) !== undefined)
  const holes = slab.holes ?? []
  const xs = slab.polygon.map((p) => p.x)
  const zs = slab.polygon.map((p) => p.z)
  let solid = 0
  let open = 0
  for (let x = Math.min(...xs) + step / 2; x < Math.max(...xs); x += step)
    for (let z = Math.min(...zs) + step / 2; z < Math.max(...zs); z += step) {
      if (!inside(slab.polygon, x, z)) continue
      if (hits(x, z)) solid += 1
      else open += 1
    }
  const perHole = holes.map((h) => {
    const hx = h.map((p) => p.x)
    const hz = h.map((p) => p.z)
    let inRays = 0
    let inHits = 0
    let ringRays = 0
    let ringMiss = 0
    const others = new Map<string, number>()
    for (let x = Math.min(...hx) - 0.3; x < Math.max(...hx) + 0.3; x += step)
      for (let z = Math.min(...hz) - 0.3; z < Math.max(...hz) + 0.3; z += step) {
        const d = distToPoly(h, x, z)
        if (inside(h, x, z) && d >= 0.05) {
          inRays += 1
          if (hits(x, z)) inHits += 1
          for (const m of scene.meshes) {
            if (m.objectId === slab.id) continue
            const hit = m.triangles.some((t) => {
              const tt = rayHit(t, { x, y: y0 - slab.thickness - 0.01, z }, { x: 0, y: 1, z: 0 })
              return tt !== undefined && tt <= slab.thickness + 0.06
            })
            if (hit) others.set(`${m.part}:${m.objectId}`, (others.get(`${m.part}:${m.objectId}`) ?? 0) + 1)
          }
        } else if (!inside(h, x, z) && d >= 0.05 && d <= 0.3 && inside(slab.polygon, x, z) && !holes.some((o) => inside(o, x, z))) {
          ringRays += 1
          if (!hits(x, z)) ringMiss += 1
        }
      }
    return { hole: h.map((p) => [r3(p.x), r3(p.z)]), inRays, inHits, ringRays, ringMiss, othersOverHole: Object.fromEntries([...others].map(([k, n]) => [k, r3((n * step * step))])) }
  })
  return { slab: slab.id, level: slab.levelId, top: r3(y0), solidM2: r3(solid * step * step), openM2: r3(open * step * step), holes: perHole }
})
console.log(JSON.stringify(out, null, 1))
