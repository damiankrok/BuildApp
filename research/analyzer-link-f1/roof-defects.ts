/**
 * LINK-F1B (research only): where a roof solid's open edges and sliver triangles are — the roof body, its reveals and
 * its trims, as the closure audit groups them — so a NON_MANIFOLD or SLIVER_TRIANGLES warning can be explained.
 *   npx vite-node research/analyzer-link-f1/roof-defects.ts -- <model.json> <roofId>
 */
import { readFileSync } from 'node:fs'
import { compileBuilding } from '@buildapp/geometry'
import { parseModel } from '@buildapp/model'

const [file, roofId] = process.argv.slice(2).filter((a) => a !== '--')
const scene = compileBuilding(parseModel(readFileSync(file, 'utf8')))
type V = { x: number; y: number; z: number }
const tris: Array<{ a: V; b: V; c: V; part: string; opening?: string }> = []
for (const m of scene.meshes) {
  const mine = (m.objectId === roofId && m.part !== 'ROOF_TRIM' && m.part !== 'ROOF_REVEAL') || (m.part === 'ROOF_REVEAL' && m.hostRoofId === roofId)
  if (mine) for (const t of m.triangles) tris.push({ ...t, part: m.part, opening: m.openingId })
}
const key = (p: V): string => `${Math.round(p.x * 1e5)},${Math.round(p.y * 1e5)},${Math.round(p.z * 1e5)}`
const edges = new Map<string, { n: number; parts: Set<string> }>()
for (const t of tris) for (const [p, q] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]] as const) {
  const a = key(p)
  const b = key(q)
  const k = a < b ? `${a}|${b}` : `${b}|${a}`
  const e = edges.get(k) ?? { n: 0, parts: new Set<string>() }
  e.n += 1
  e.parts.add(t.opening ? `${t.part}:${t.opening}` : t.part)
  edges.set(k, e)
}
const open = [...edges.entries()].filter(([, e]) => e.n !== 2)
console.log(`${tris.length} triangles, ${open.length} edges not shared by exactly two`)
const fmt = (k: string): string => k.split('|').map((p) => `(${p.split(',').map((v) => (Number(v) / 1e5).toFixed(3)).join(',')})`).join('–')
for (const [k, e] of open.slice(0, 60)) console.log(`OPEN n=${e.n} ${fmt(k)} ${[...e.parts].join(' ')}`)
let slivers = 0
for (const t of tris) {
  const u = { x: t.b.x - t.a.x, y: t.b.y - t.a.y, z: t.b.z - t.a.z }
  const v = { x: t.c.x - t.a.x, y: t.c.y - t.a.y, z: t.c.z - t.a.z }
  const area = Math.hypot(u.y * v.z - u.z * v.y, u.z * v.x - u.x * v.z, u.x * v.y - u.y * v.x) / 2
  const e = Math.min(Math.hypot(u.x, u.y, u.z), Math.hypot(v.x, v.y, v.z), Math.hypot(t.c.x - t.b.x, t.c.y - t.b.y, t.c.z - t.b.z))
  if (area < 1e-6 || e < 0.0005) {
    slivers += 1
    if (slivers <= 40) console.log(`SLIVER area ${area.toExponential(2)} m² edge ${e.toExponential(2)} m ${t.opening ? `${t.part}:${t.opening}` : t.part} (${t.a.x.toFixed(3)},${t.a.y.toFixed(3)},${t.a.z.toFixed(3)})`)
  }
}
console.log(`${slivers} slivers`)
