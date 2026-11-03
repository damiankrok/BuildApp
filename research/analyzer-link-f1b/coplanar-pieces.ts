/**
 * LINK-F1C (research only): the faces of two compiled solids that lie in one plane facing the same way, with their
 * plane, normal and extent — what a COPLANAR_DUPLICATE finding measures.
 *   npx vite-node research/analyzer-link-f1b/coplanar-pieces.ts -- <model.json> <objectIdA> <objectIdB>
 */
import { readFileSync } from 'node:fs'
import { compileBuilding } from '@buildapp/geometry'
import { parseModel } from '@buildapp/model'

const [file, a, b] = process.argv.slice(2).filter((x) => x !== '--')
const scene = compileBuilding(parseModel(readFileSync(file, 'utf8')))
type V = { x: number; y: number; z: number }
const tris = (id: string) => scene.meshes.filter((m) => m.objectId === id || m.solidId === id || m.hostWallId === id).flatMap((m) => m.triangles.map((t) => ({ ...t, part: m.part })))
const n = (t: { a: V; b: V; c: V }) => { const u = { x: t.b.x - t.a.x, y: t.b.y - t.a.y, z: t.b.z - t.a.z }; const v = { x: t.c.x - t.a.x, y: t.c.y - t.a.y, z: t.c.z - t.a.z }; const c = { x: u.y * v.z - u.z * v.y, y: u.z * v.x - u.x * v.z, z: u.x * v.y - u.y * v.x }; const l = Math.hypot(c.x, c.y, c.z) || 1; return { x: c.x / l, y: c.y / l, z: c.z / l, area: l / 2 } }
const key = (t: { a: V; b: V; c: V }) => { const k = n(t); const d = k.x * t.a.x + k.y * t.a.y + k.z * t.a.z; return `${k.x.toFixed(3)},${k.y.toFixed(3)},${k.z.toFixed(3)}@${d.toFixed(3)}` }
const group = (id: string) => { const g = new Map<string, { area: number; min: V; max: V; parts: Set<string> }>(); for (const t of tris(id)) { const k = key(t); const e = g.get(k) ?? { area: 0, min: { x: 1e9, y: 1e9, z: 1e9 }, max: { x: -1e9, y: -1e9, z: -1e9 }, parts: new Set() }; e.area += n(t).area; for (const p of [t.a, t.b, t.c]) { e.min = { x: Math.min(e.min.x, p.x), y: Math.min(e.min.y, p.y), z: Math.min(e.min.z, p.z) }; e.max = { x: Math.max(e.max.x, p.x), y: Math.max(e.max.y, p.y), z: Math.max(e.max.z, p.z) } } e.parts.add(t.part); g.set(k, e) } return g }
const ga = group(a)
const gb = group(b)
const r = (v: V) => `(${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)})`
for (const [k, e] of ga) { const f = gb.get(k); if (f) console.log(`PLANE ${k}\n  ${a}: ${e.area.toFixed(3)} m² ${r(e.min)}..${r(e.max)} ${[...e.parts]}\n  ${b}: ${f.area.toFixed(3)} m² ${r(f.min)}..${r(f.max)} ${[...f.parts]}`) }
