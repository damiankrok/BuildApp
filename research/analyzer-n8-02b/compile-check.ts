/**
 * N8-02B (research only, offline): a model.json through the production model validator and BuildWorld geometry
 * compiler, with the physical check the JSON cannot give: for every opening, a ray through its centre across its host
 * wall must meet no triangle of that wall's solid (the hole is really cut); for every wall, its thickness, length and
 * the triangles compiled for it. Prints JSON; nothing is written.
 *   npx vite-node research/analyzer-n8-02b/compile-check.ts -- <model.json> [<model.json> ...]
 */
import { readFileSync } from 'node:fs'
import { parseModel, validateModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import type { Triangle, Vec3 } from '@buildapp/geometry'

const files = process.argv.slice(2).filter((a) => a !== '--')
// Möller–Trumbore on a segment p..q
function hits(t: Triangle, p: Vec3, q: Vec3): boolean {
  const d = { x: q.x - p.x, y: q.y - p.y, z: q.z - p.z }
  const e1 = { x: t.b.x - t.a.x, y: t.b.y - t.a.y, z: t.b.z - t.a.z }
  const e2 = { x: t.c.x - t.a.x, y: t.c.y - t.a.y, z: t.c.z - t.a.z }
  const h = { x: d.y * e2.z - d.z * e2.y, y: d.z * e2.x - d.x * e2.z, z: d.x * e2.y - d.y * e2.x }
  const a = e1.x * h.x + e1.y * h.y + e1.z * h.z
  if (Math.abs(a) < 1e-12) return false
  const f = 1 / a
  const s = { x: p.x - t.a.x, y: p.y - t.a.y, z: p.z - t.a.z }
  const u = f * (s.x * h.x + s.y * h.y + s.z * h.z)
  if (u < 0 || u > 1) return false
  const qq = { x: s.y * e1.z - s.z * e1.y, y: s.z * e1.x - s.x * e1.z, z: s.x * e1.y - s.y * e1.x }
  const v = f * (d.x * qq.x + d.y * qq.y + d.z * qq.z)
  if (v < 0 || u + v > 1) return false
  const tt = f * (e2.x * qq.x + e2.y * qq.y + e2.z * qq.z)
  return tt >= 0 && tt <= 1
}
const out: Record<string, unknown> = {}
for (const file of files) {
  const model = parseModel(readFileSync(file, 'utf8'))
  const validation = validateModel(model)
  const scene = compileBuilding(model)
  const levels = new Map(model.levels.map((l) => [l.id, l]))
  const bySolid = new Map<string, Triangle[]>()
  for (const m of scene.meshes) if (m.part === 'WALL' || m.part === 'WALL_REVEAL') bySolid.set(m.solidId, [...(bySolid.get(m.solidId) ?? []), ...m.triangles])
  const openings = model.openings.map((o) => {
    const w = model.walls.find((x) => x.id === o.wallId)
    if (!w) return { id: o.id, wallId: o.wallId, cut: false, why: 'no host wall' }
    const l = levels.get(w.levelId)
    const len = Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z)
    const u = { x: (w.end.x - w.start.x) / len, z: (w.end.z - w.start.z) / len }
    // material lies to the left of the run
    const n = { x: -u.z, z: u.x }
    const along = o.offset + o.width / 2
    const y = (l?.elevation ?? 0) + w.baseOffset + o.sill + o.height / 2
    const base = { x: w.start.x + u.x * along, z: w.start.z + u.z * along }
    const p = { x: base.x - n.x * 0.05, y, z: base.z - n.z * 0.05 }
    const q = { x: base.x + n.x * (w.thickness + 0.05), y, z: base.z + n.z * (w.thickness + 0.05) }
    const tris = bySolid.get(w.id) ?? []
    const blocked = tris.some((t) => hits(t, p, q))
    return { id: o.id, kind: o.kind, wallId: o.wallId, wallThicknessM: w.thickness, widthM: o.width, heightM: o.height, sillM: o.sill, centre: { x: +base.x.toFixed(3), y: +y.toFixed(3), z: +base.z.toFixed(3) }, cut: !blocked }
  })
  const walls = model.walls.map((w) => ({ id: w.id, kind: w.kind, levelId: w.levelId, start: w.start, end: w.end, lengthM: +Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z).toFixed(3), thicknessM: w.thickness, heightM: w.height, triangles: (bySolid.get(w.id) ?? []).length }))
  out[file] = {
    modelId: model.id,
    validation: { ok: validation.ok, errors: validation.issues.filter((i) => i.severity === 'ERROR').map((i) => `${i.code} ${i.objectId ?? ''} ${i.message}`), warnings: validation.issues.filter((i) => i.severity !== 'ERROR').length, overlaps: validation.issues.filter((i) => i.code === 'WALLS_OVERLAP').length },
    compile: { stats: scene.stats, diagnostics: scene.diagnostics.map((d) => `${d.severity} ${d.code} ${d.objectId ?? ''}: ${d.message}`) },
    openings: { total: openings.length, cut: openings.filter((o) => o.cut).length, notCut: openings.filter((o) => !o.cut) },
    walls,
    openingList: openings,
  }
}
console.log(JSON.stringify(out, null, 1))
