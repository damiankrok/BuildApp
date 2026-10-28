/**
 * N8-03C (research only, offline): the physical roof of one model, measured on its compiled BuildWorld geometry.
 *
 *   layers    over a plan grid (0.1 m) inside the building, how many roof plates a vertical ray passes through: one is a
 *             roof, two is a roof standing inside another (counted in m², with the plates named)
 *   creases   along every VALLEY and RIDGE edge, the top surfaces of the two plates either side, sampled: they must meet
 *   walls     for named walls, the height of the wall's top above its floor along it (both faces), from the triangles
 *   openings  every opening: a horizontal ray through its centre across its wall meets no wall triangle (cut)
 *
 *   npx vite-node research/analyzer-n8-03c/roof-probe.ts -- --model <model.json> [--walls id,id]
 * Prints JSON; nothing is written.
 */
import { readFileSync } from 'node:fs'
import { parseModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import type { Triangle, Vec3 } from '@buildapp/geometry'

const arg = (name: string): string | undefined => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : undefined)
const model = parseModel(readFileSync(arg('model') as string, 'utf8'))
const scene = compileBuilding(model)
const r6 = (v: number): number => Math.round(v * 1e3) / 1e3

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

// --- layers: roof plates over the plan
const roofSolids = new Map<string, Triangle[]>()
for (const m of scene.meshes) if (m.part === 'ROOF' || m.part === 'ROOF_PLANE') roofSolids.set(m.solidId, [...(roofSolids.get(m.solidId) ?? []), ...m.triangles])
const xs = model.walls.flatMap((w) => [w.start.x, w.end.x])
const zs = model.walls.flatMap((w) => [w.start.z, w.end.z])
const box = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }
const step = 0.1
let cells = 0
let covered = 0
const doubled = new Map<string, number>()
for (let x = box.x0 + step / 2; x < box.x1; x += step) {
  for (let z = box.z0 + step / 2; z < box.z1; z += step) {
    cells += 1
    const above: string[] = []
    for (const [id, tris] of roofSolids) {
      // a plate is crossed when the vertical ray meets its surface (an even number of times: top and underside)
      const n = tris.filter((t) => rayHit(t, { x, y: -50, z }, { x: 0, y: 1, z: 0 }) !== undefined).length
      if (n > 0) above.push(id)
    }
    if (above.length > 0) covered += 1
    if (above.length > 1) {
      const key = [...above].sort().join(' + ')
      doubled.set(key, (doubled.get(key) ?? 0) + 1)
    }
  }
}
const layers = { gridM: step, planCells: cells, coveredM2: r6(covered * step * step), doubleRoofM2: r6([...doubled.values()].reduce((a, b) => a + b, 0) * step * step), doubled: Object.fromEntries([...doubled].map(([k, v]) => [k, r6(v * step * step)])) }

// --- creases: the top surfaces either side of each join
const topOf = (solid: string, x: number, z: number): number | undefined => {
  const ys = (roofSolids.get(solid) ?? []).map((t) => rayHit(t, { x, y: -50, z }, { x: 0, y: 1, z: 0 })).filter((v): v is number => v !== undefined).map((tt) => -50 + tt)
  return ys.length === 0 ? undefined : Math.max(...ys)
}
const creases = model.roofEdges
  .filter((e) => e.kind === 'VALLEY' || e.kind === 'RIDGE')
  .map((e) => {
    const len = Math.hypot(e.end.x - e.start.x, e.end.z - e.start.z)
    const nx = -(e.end.z - e.start.z) / len
    const nz = (e.end.x - e.start.x) / len
    let worst = 0
    const samples: Array<{ s: number; edgeY: number; a?: number; b?: number }> = []
    for (let i = 1; i < 10; i++) {
      const s = i / 10
      const p = { x: e.start.x + (e.end.x - e.start.x) * s, z: e.start.z + (e.end.z - e.start.z) * s }
      const edgeY = e.start.y + (e.end.y - e.start.y) * s
      // just either side of the crease, each plate's own top
      const a = topOf(e.planeIds[0], p.x + nx * 0.02, p.z + nz * 0.02) ?? topOf(e.planeIds[0], p.x - nx * 0.02, p.z - nz * 0.02)
      const b = e.planeIds[1] ? (topOf(e.planeIds[1], p.x - nx * 0.02, p.z - nz * 0.02) ?? topOf(e.planeIds[1], p.x + nx * 0.02, p.z + nz * 0.02)) : undefined
      if (a !== undefined) worst = Math.max(worst, Math.abs(a - edgeY))
      if (b !== undefined) worst = Math.max(worst, Math.abs(b - edgeY))
      samples.push({ s, edgeY: r6(edgeY), ...(a !== undefined ? { a: r6(a) } : {}), ...(b !== undefined ? { b: r6(b) } : {}) })
    }
    return { id: e.id, kind: e.kind, planes: e.planeIds, start: e.start, end: e.end, worstTopMismatchM: r6(worst), samples }
  })

// --- walls: the top of each named wall above its floor, along it
const wallTris = new Map<string, Triangle[]>()
for (const m of scene.meshes) if (m.part === 'WALL' || m.part === 'WALL_REVEAL') wallTris.set(m.solidId, [...(wallTris.get(m.solidId) ?? []), ...m.triangles])
const levels = new Map(model.levels.map((l) => [l.id, l]))
const wantWalls = (arg('walls') ?? '').split(',').filter(Boolean)
const walls = wantWalls.map((id) => {
  const w = model.walls.find((x) => x.id === id)
  if (!w) return { id, missing: true }
  const L = Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z)
  const u = { x: (w.end.x - w.start.x) / L, z: (w.end.z - w.start.z) / L }
  const n = { x: -u.z, z: u.x }
  const floor = (levels.get(w.levelId)?.elevation ?? 0) + w.baseOffset
  const profile: Array<{ along: number; x: number; z: number; outer?: number; inner?: number }> = []
  for (let a = 0.05; a < L; a += 0.25) {
    const row: { along: number; x: number; z: number; outer?: number; inner?: number } = { along: r6(a), x: r6(w.start.x + u.x * a), z: r6(w.start.z + u.z * a) }
    for (const [face, c] of [['outer', 0.01], ['inner', w.thickness - 0.01]] as const) {
      const p = { x: w.start.x + u.x * a + n.x * c, z: w.start.z + u.z * a + n.z * c }
      const ys = (wallTris.get(w.id) ?? []).map((t) => rayHit(t, { x: p.x, y: 100, z: p.z }, { x: 0, y: -1, z: 0 })).filter((v): v is number => v !== undefined).map((tt) => 100 - tt)
      if (ys.length > 0) row[face] = r6(Math.max(...ys) - floor)
    }
    profile.push(row)
  }
  return { id, levelId: w.levelId, topProfile: w.topProfile, lengthM: r6(L), thicknessM: w.thickness, profile }
})

// --- openings: cut through their wall
const openings = model.openings.map((o) => {
  const w = model.walls.find((x) => x.id === o.wallId)
  if (!w) return { id: o.id, cut: false, why: 'no wall' }
  const l = levels.get(w.levelId)
  const L = Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z)
  const u = { x: (w.end.x - w.start.x) / L, z: (w.end.z - w.start.z) / L }
  const n = { x: -u.z, z: u.x }
  const along = o.offset + o.width / 2
  const y = (l?.elevation ?? 0) + w.baseOffset + o.sill + o.height / 2
  const p = { x: w.start.x + u.x * along - n.x * 0.05, y, z: w.start.z + u.z * along - n.z * 0.05 }
  const d = { x: n.x, y: 0, z: n.z }
  const hit = (wallTris.get(w.id) ?? []).some((t) => {
    const tt = rayHit(t, p, d)
    return tt !== undefined && tt <= w.thickness + 0.1
  })
  return { id: o.id, wallId: o.wallId, kind: o.kind, widthM: o.width, heightM: o.height, sillM: o.sill, cut: !hit }
})
console.log(JSON.stringify({ modelId: model.id, roofs: model.roofs.map((r) => r.id), roofPlanes: model.roofPlanes.map((p) => p.id), layers, creases, walls, openings: { total: openings.length, cut: openings.filter((o) => o.cut).length, rows: openings } }, null, 1))
