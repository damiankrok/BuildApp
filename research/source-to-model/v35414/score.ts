/**
 * v3.54.14 — the fixed-row score of one house's variants against its source card (refs/<house>.json, written before
 * any model of the house). Every row of the card is kept (an element missing is a failed row, never a removed one).
 * What a model can be measured for is measured here; a row that needs a look (a roof form, a pergola) is MANUAL and its
 * verdict comes from manual-<house>.json, written from the boards with its reason.
 *
 *   npx vite-node research/source-to-model/v35414/score.ts -- <refs.json> <out.json> [manual.json] label=model.json …
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { parseModel } from '@buildapp/model'
import type { CanonicalBuildingModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import { measureBuilt } from '../../../packages/analysis-service/src/consult/metric-read.js'
import { facadeAxes, visibilityMap } from '../../../packages/analysis-service/src/appearance/visibility.js'
import type { Facade } from '../../../packages/analysis-service/src/appearance/visibility.js'

const [refsPath, outPath, ...rest] = process.argv.slice(2).filter((a) => a !== '--')
const manualPath = rest[0] && !rest[0].includes('=') ? rest.shift() : undefined
const refs = JSON.parse(readFileSync(refsPath, 'utf8')) as { house: string; tolerances: { METRIC_printed_m: number; MINIATURE_position_m: number; MINIATURE_height_m: number; pitch_deg: number }; dimensions: Array<{ id: string; valueM?: number | number[]; valueDeg?: number }>; rows: Array<{ id: string; kind: string; check: string }> }
const manual = manualPath && existsSync(manualPath) ? (JSON.parse(readFileSync(manualPath, 'utf8')) as Record<string, Record<string, { verdict: 'PASS' | 'PARTIAL' | 'FAIL'; why: string }>>) : {}
const dim = (id: string): number | undefined => {
  const d = refs.dimensions.find((x) => x.id === id)
  return typeof d?.valueM === 'number' ? d.valueM : d?.valueDeg
}

function facts(model: CanonicalBuildingModel) {
  const scene = compileBuilding(model)
  const m = measureBuilt(model, scene)
  // the dominant roof pitch: the largest roof surface's slope
  const pitches: Array<{ area: number; deg: number }> = []
  const roofAreas = new Map<string, number>()
  for (const mesh of scene.meshes) if (mesh.part === 'ROOF' || mesh.part === 'ROOF_PLANE') for (const t of mesh.triangles) roofAreas.set(mesh.objectId, (roofAreas.get(mesh.objectId) ?? 0) + Math.hypot((t.b.y - t.a.y) * (t.c.z - t.a.z) - (t.b.z - t.a.z) * (t.c.y - t.a.y), (t.b.z - t.a.z) * (t.c.x - t.a.x) - (t.b.x - t.a.x) * (t.c.z - t.a.z), (t.b.x - t.a.x) * (t.c.y - t.a.y) - (t.b.y - t.a.y) * (t.c.x - t.a.x)) / 2)
  const mainRoof = [...roofAreas].sort((a, b) => b[1] - a[1])[0]?.[0]
  for (const mesh of scene.meshes) {
    if ((mesh.part !== 'ROOF' && mesh.part !== 'ROOF_PLANE') || mesh.objectId !== mainRoof) continue
    let area = 0
    let nyA = 0
    for (const t of mesh.triangles) {
      const ux = t.b.x - t.a.x, uy = t.b.y - t.a.y, uz = t.b.z - t.a.z
      const vx = t.c.x - t.a.x, vy = t.c.y - t.a.y, vz = t.c.z - t.a.z
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
      const a = Math.hypot(nx, ny, nz) / 2
      // the top surface only: the underside and the edge faces are the roof's thickness
      if (a < 1e-6 || ny / (2 * a) < 0.3) continue
      area += a
      nyA += (Math.abs(ny) / (2 * a)) * a
    }
    if (area > 0.5) pitches.push({ area, deg: (Math.acos(Math.min(1, nyA / area)) * 180) / Math.PI })
  }
  // the main roof's pitch: its object is the roof with the largest surface (a wing's cross gable may be steeper)
  pitches.sort((p, q) => q.area - p.area)
  // openings per side: by the outward normal of their host wall
  const sideOf = (w: { start: { x: number; z: number }; end: { x: number; z: number } }): Facade => {
    const L = Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z) || 1
    const nx = (w.end.z - w.start.z) / L
    const nz = -(w.end.x - w.start.x) / L
    return Math.abs(nz) >= Math.abs(nx) ? (nz < 0 ? 'FRONT' : 'REAR') : nx > 0 ? 'EAST' : 'WEST'
  }
  const wallById = new Map(model.walls.map((w) => [w.id, w]))
  const exterior = (id: string): boolean => !/iwall|partition|nib|party/.test(id)
  const gates: number[] = []
  const perSide: Record<string, { windows: number; doors: number; gates: number }> = { FRONT: { windows: 0, doors: 0, gates: 0 }, REAR: { windows: 0, doors: 0, gates: 0 }, EAST: { windows: 0, doors: 0, gates: 0 }, WEST: { windows: 0, doors: 0, gates: 0 } }
  for (const o of model.openings) {
    const w = wallById.get(o.wallId)
    if (!w || !exterior(w.id)) continue
    const s = sideOf(w)
    const door = model.doors.find((d) => d.openingId === o.id) as { usage?: string } | undefined
    const isDoor = door !== undefined
    const gate = door?.usage === 'GARAGE'
    if (gate) gates.push(o.width)
    if (gate) perSide[s].gates++
    else if (isDoor || o.sill <= 0.05) perSide[s].doors++
    else perSide[s].windows++
  }
  // what each side shows: the material shares of the surfaces seen (finish regions included)
  const shares: Record<string, Record<string, number>> = {}
  for (const f of ['FRONT', 'REAR', 'EAST', 'WEST'] as Facade[]) {
    const v = visibilityMap(scene, f, 0.05, { withRegions: true })
    const c: Record<string, number> = {}
    let n = 0
    for (let k = 0; k < v.mesh.length; k++) {
      const mesh = v.meshes[v.mesh[k]]
      if (!mesh || !/WALL|SURFACE_REGION/.test(mesh.part)) continue
      c[mesh.materialId ?? '-'] = (c[mesh.materialId ?? '-'] ?? 0) + 1
      n++
    }
    shares[f] = Object.fromEntries(Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, x]) => [k, Math.round((x / Math.max(1, n)) * 100) / 100]))
  }
  void facadeAxes
  return { ...m, gateWidths: gates, pitchDeg: pitches[0] ? Math.round(pitches[0].deg * 10) / 10 : null, bodies: model.wallRings?.length ?? 0, chimneys: model.chimneys.length, rooms: model.rooms.length, doors: model.doors.length, perSide, shares }
}

type Verdict = 'PASS' | 'PARTIAL' | 'FAIL' | 'MANUAL'
const out: Record<string, unknown> = { house: refs.house, refs: refsPath, variants: {} }
const table: Array<Record<string, string>> = []
for (const spec of rest) {
  const at = spec.indexOf('=')
  const label = spec.slice(0, at)
  const f = facts(parseModel(readFileSync(spec.slice(at + 1), 'utf8')))
  const T = refs.tolerances
  const rows: Record<string, { verdict: Verdict; measured: string; why: string }> = {}
  const metric = (id: string, measured: number | undefined, expected: number | undefined, miniTol: number, metricTol = T.METRIC_printed_m): { verdict: Verdict; measured: string; why: string } => {
    if (measured === undefined || expected === undefined) return { verdict: 'FAIL', measured: String(measured), why: 'not built / not measurable' }
    const d = Math.abs(measured - expected)
    return { verdict: d <= metricTol ? 'PASS' : d <= miniTol ? 'PARTIAL' : 'FAIL', measured: measured.toFixed(3), why: `${(measured - expected >= 0 ? '+' : '') + (measured - expected).toFixed(3)} against ${expected} (METRIC ±${metricTol}, miniature ±${miniTol}; PARTIAL = miniature only)` }
  }
  for (const row of refs.rows) {
    const m = manual[label]?.[row.id]
    if (m) {
      rows[row.id] = { verdict: m.verdict, measured: '—', why: `MANUAL: ${m.why}` }
      continue
    }
    switch (row.id) {
      case 'storeys': rows[row.id] = { verdict: f.levels.length === 1 ? 'PASS' : 'FAIL', measured: `${f.levels.length} storey(s)`, why: 'one storey expected' }; break
      case 'outline-x': rows[row.id] = metric(row.id, f.outlineX, dim('outline-x'), T.MINIATURE_position_m); break
      case 'outline-z': rows[row.id] = metric(row.id, f.outlineZ, dim('outline-z'), T.MINIATURE_position_m); break
      case 'ridge': rows[row.id] = metric(row.id, f.ridge, dim('ridge'), T.MINIATURE_height_m); break
      case 'eaves': rows[row.id] = metric(row.id, f.eaves, dim('eaves'), T.MINIATURE_height_m); break
      case 'pitch': rows[row.id] = metric(row.id, f.pitchDeg ?? undefined, dim('pitch'), T.pitch_deg, 1); break
      case 'chimneys': rows[row.id] = { verdict: f.chimneys >= 2 ? 'PASS' : f.chimneys === 1 ? 'PARTIAL' : 'FAIL', measured: `${f.chimneys}`, why: 'two chimneys in the source' }; break
      case 'rooms': rows[row.id] = { verdict: f.rooms === 9 ? 'PASS' : f.rooms >= 7 ? 'PARTIAL' : 'FAIL', measured: `${f.rooms} rooms`, why: '9 rooms on the plan (count only; names and shapes not checked)' }; break
      case 'body': rows[row.id] = { verdict: f.bodies === 1 ? 'PASS' : 'FAIL', measured: `${f.bodies} wall ring(s)`, why: 'one body' }; break
      case 'front-openings': { const s = f.perSide.FRONT; rows[row.id] = { verdict: s.windows === 4 && s.doors === 1 ? 'PASS' : s.windows + s.doors >= 4 ? 'PARTIAL' : 'FAIL', measured: `${s.windows} w + ${s.doors} d`, why: '4 windows + 1 door' }; break }
      case 'rear-openings': { const s = f.perSide.REAR; rows[row.id] = { verdict: s.windows + s.doors === 3 ? 'PASS' : s.windows + s.doors >= 2 ? 'PARTIAL' : 'FAIL', measured: `${s.windows} w + ${s.doors} d`, why: '2 windows + 1 terrace glazing' }; break }
      case 'left-openings': { const s = f.perSide.WEST; rows[row.id] = { verdict: s.windows + s.doors === 1 ? 'PASS' : 'FAIL', measured: `${s.windows} w + ${s.doors} d`, why: '1 window' }; break }
      case 'right-openings': { const s = f.perSide.EAST; rows[row.id] = { verdict: s.windows + s.doors === 1 ? 'PASS' : 'FAIL', measured: `${s.windows} w + ${s.doors} d`, why: '1 window' }; break }
      case 'garage-gate': {
        const w = f.gateWidths
        const exp = (refs.dimensions.find((x) => x.id === 'gate')?.valueM as number[] | undefined)?.[0]
        rows[row.id] = w.length !== 1 || exp === undefined ? { verdict: 'FAIL', measured: `${w.length} garage door(s)`, why: 'one garage gate expected' } : { ...metric(row.id, w[0], exp, T.MINIATURE_position_m), why: `one garage gate, width ${w[0].toFixed(3)} against ${exp}` }
        break
      }
      default: rows[row.id] = { verdict: 'MANUAL', measured: '—', why: 'needs a look at the boards (no manual verdict written yet)' }
    }
  }
  ;(out.variants as Record<string, unknown>)[label] = { facts: f, rows }
  const pass = Object.values(rows).filter((r) => r.verdict === 'PASS').length
  const partial = Object.values(rows).filter((r) => r.verdict === 'PARTIAL').length
  const fail = Object.values(rows).filter((r) => r.verdict === 'FAIL').length
  const man = Object.values(rows).filter((r) => r.verdict === 'MANUAL').length
  table.push({ label, pass: `${pass}`, partial: `${partial}`, fail: `${fail}`, manual: `${man}`, of: `${refs.rows.length}` })
  process.stdout.write(`${label}: PASS ${pass}, PARTIAL ${partial}, FAIL ${fail}, MANUAL ${man} of ${refs.rows.length}\n`)
  for (const [id, r] of Object.entries(rows)) process.stdout.write(`   ${id.padEnd(18)} ${r.verdict.padEnd(7)} ${r.measured.padEnd(14)} ${r.why.slice(0, 110)}\n`)
}
out.table = table
writeFileSync(outPath, `${JSON.stringify(out, null, 1)}\n`)
