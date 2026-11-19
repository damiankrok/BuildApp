/**
 * v3.54.14 — the OWNER's three phone defects traced on a compiled model, cell by cell along the ray:
 *  1. a light line in a finish (a row of cells whose nearest surface is not the finish while the finish is above and
 *     below it on the same column);
 *  2./3. a wall behind a balcony / balustrade that keeps no finish where a post, a rail, a slab or the balcony stands in
 *     front of it (the wall's finish stops at the obstruction instead of running on behind it).
 * For every facade: a depth stack per cell (all surfaces the orthographic ray meets, nearest first), the counts by
 * surface, part, object and material, and probe points (under an obstruction and beside it). Pictures: the four sides
 * in flat material colours, a picture with every defect cell marked, and two obliques (from above, from slightly below).
 *
 *   npx vite-node research/source-to-model/v35414/defect-trace.ts -- <model.json> <out dir> [label]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { parseModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import type { CompiledMesh } from '@buildapp/geometry'
import { facadeAxes } from '../../../packages/analysis-service/src/appearance/visibility.js'
import type { Facade } from '../../../packages/analysis-service/src/appearance/visibility.js'

const [modelPath, out, label = 'model'] = process.argv.slice(2).filter((a) => a !== '--')
mkdirSync(out, { recursive: true })
const model = parseModel(readFileSync(modelPath, 'utf8'))
const scene = compileBuilding(model)
const colour = new Map(model.materials.map((m) => [m.id, m.color ?? '#c8c8c8']))
const hex = (c: string): [number, number, number] => {
  const n = parseInt(c.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const meshColour = (m: CompiledMesh): [number, number, number] => {
  if (/GLASS|INFILL/.test(m.part)) return [150, 200, 225]
  return hex(colour.get(m.materialId ?? '') ?? '#c8c8c8')
}
const meshes = scene.meshes.filter((m) => m.part !== 'ROOM_FLOOR')
const CELL = 0.02

type Hit = { mi: number; d: number }
/** Orthographic depth stacks of one facade: every surface the ray through a cell centre meets, nearest first. */
function stacks(facade: Facade): { w: number; h: number; a0: number; y1: number; at: Hit[][] } {
  const ax = facadeAxes(facade)
  let a0 = Infinity
  let a1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  for (const m of meshes) for (const t of m.triangles) for (const p of [t.a, t.b, t.c]) {
    const a = ax.along(p.x, p.z)
    a0 = Math.min(a0, a)
    a1 = Math.max(a1, a)
    y0 = Math.min(y0, p.y)
    y1 = Math.max(y1, p.y)
  }
  a0 -= CELL
  y1 += CELL
  const w = Math.ceil((a1 - a0) / CELL) + 2
  const h = Math.ceil((y1 - y0) / CELL) + 2
  const at: Hit[][] = Array.from({ length: w * h }, () => [])
  meshes.forEach((m, mi) => {
    for (const t of m.triangles) {
      const P = [t.a, t.b, t.c].map((p) => ({ u: (ax.along(p.x, p.z) - a0) / CELL, v: (y1 - p.y) / CELL, d: ax.depth(p.x, p.z) }))
      const den = (P[1].v - P[2].v) * (P[0].u - P[2].u) + (P[2].u - P[1].u) * (P[0].v - P[2].v)
      if (Math.abs(den) < 1e-12) continue
      for (let j = Math.max(0, Math.floor(Math.min(P[0].v, P[1].v, P[2].v))); j <= Math.min(h - 1, Math.ceil(Math.max(P[0].v, P[1].v, P[2].v))); j++) {
        for (let i = Math.max(0, Math.floor(Math.min(P[0].u, P[1].u, P[2].u))); i <= Math.min(w - 1, Math.ceil(Math.max(P[0].u, P[1].u, P[2].u))); i++) {
          const u = i + 0.5
          const v = j + 0.5
          const l0 = ((P[1].v - P[2].v) * (u - P[2].u) + (P[2].u - P[1].u) * (v - P[2].v)) / den
          const l1 = ((P[2].v - P[0].v) * (u - P[2].u) + (P[0].u - P[2].u) * (v - P[2].v)) / den
          const l2 = 1 - l0 - l1
          if (l0 < -1e-9 || l1 < -1e-9 || l2 < -1e-9) continue
          const list = at[j * w + i]
          const d = l0 * P[0].d + l1 * P[1].d + l2 * P[2].d
          if (!list.some((x) => x.mi === mi && Math.abs(x.d - d) < 1e-6)) list.push({ mi, d })
        }
      }
    }
  })
  for (const l of at) l.sort((a, b) => a.d - b.d || a.mi - b.mi)
  return { w, h, a0, y1, at }
}

const isRegion = (m: CompiledMesh): boolean => m.part === 'SURFACE_REGION'
const describe = (m: CompiledMesh): string => `${m.part}:${m.objectId}${m.hostWallId ? `@${m.hostWallId}` : ''}[${m.materialId ?? '-'}]`
/** The surface a viewer sees at a cell: the nearest hit, a region over its own wall winning a tie with it (it lies on it). */
const seen = (l: Hit[]): Hit | undefined => {
  const vis = l.filter((x) => !/GLASS|INFILL/.test(meshes[x.mi].part))
  if (vis.length === 0) return undefined
  const near = vis[0].d
  return vis.filter((x) => x.d <= near + 0.012).sort((a, b) => Number(isRegion(meshes[b.mi])) - Number(isRegion(meshes[a.mi])))[0]
}
const OBSTRUCTIONS = /^(RAILING_POST|RAILING_RAIL|BALCONY|SLAB|LINEAR_SOLID|PLATFORM|TERRACE)$/

const report: Record<string, unknown> = { label, model: modelPath }
const facades: Facade[] = ['FRONT', 'REAR', 'EAST', 'WEST']
for (const facade of facades) {
  const S = stacks(facade)
  const png = new PNG({ width: S.w, height: S.h })
  const mark = new PNG({ width: S.w, height: S.h })
  // 1. lines: a non-region cell between region cells of one material on the same column, within 0.30 m
  const lineCells = new Map<string, { cells: number; yMin: number; yMax: number; aMin: number; aMax: number }>()
  // 2/3. walls behind an obstruction: the first wall behind the obstruction and whether a region of it covers the cell
  const behind = new Map<string, { cells: number; withRegion: number; regionMaterials: Record<string, number> }>()
  const probe: Array<Record<string, unknown>> = []
  for (let j = 0; j < S.h; j++) {
    for (let i = 0; i < S.w; i++) {
      const k = j * S.w + i
      const l = S.at[k]
      const s = seen(l)
      const o = k * 4
      const c = s ? meshColour(meshes[s.mi]) : [255, 255, 255]
      png.data[o] = c[0]
      png.data[o + 1] = c[1]
      png.data[o + 2] = c[2]
      png.data[o + 3] = 255
      mark.data[o] = Math.round(c[0] * 0.5 + 127)
      mark.data[o + 1] = Math.round(c[1] * 0.5 + 127)
      mark.data[o + 2] = Math.round(c[2] * 0.5 + 127)
      mark.data[o + 3] = 255
      if (!s) continue
      const m = meshes[s.mi]
      const y = S.y1 - (j + 0.5) * CELL
      const a = S.a0 + (i + 0.5) * CELL
      if (!isRegion(m)) {
        const regionAt = (jj: number): string | undefined => {
          if (jj < 0 || jj >= S.h) return undefined
          const ss = seen(S.at[jj * S.w + i])
          return ss && isRegion(meshes[ss.mi]) ? meshes[ss.mi].materialId : undefined
        }
        let up: string | undefined
        let down: string | undefined
        for (let dj = 1; dj <= 15 && !up; dj++) up = regionAt(j - dj)
        for (let dj = 1; dj <= 15 && !down; dj++) down = regionAt(j + dj)
        if (up && up === down && up !== m.materialId) {
          const key = `${describe(m)} between ${up}`
          const e = lineCells.get(key) ?? { cells: 0, yMin: Infinity, yMax: -Infinity, aMin: Infinity, aMax: -Infinity }
          e.cells++
          e.yMin = Math.min(e.yMin, y)
          e.yMax = Math.max(e.yMax, y)
          e.aMin = Math.min(e.aMin, a)
          e.aMax = Math.max(e.aMax, a)
          lineCells.set(key, e)
          mark.data[o] = 255
          mark.data[o + 1] = 0
          mark.data[o + 2] = 255
        }
      }
      const first = l.find((x) => !/GLASS|INFILL/.test(meshes[x.mi].part) && !isRegion(meshes[x.mi]))
      if (first && OBSTRUCTIONS.test(meshes[first.mi].part)) {
        const wall = l.find((x) => meshes[x.mi].part === 'WALL' && x.d > first.d + 0.01)
        if (wall && wall.d - first.d < 3) {
          const wm = meshes[wall.mi]
          const reg = l.find((x) => isRegion(meshes[x.mi]) && meshes[x.mi].objectId !== '' && Math.abs(x.d - wall.d) < 0.03 && regionHost(meshes[x.mi]) === wm.objectId)
          const key = `${meshes[first.mi].part} in front of ${wm.objectId}[${wm.materialId ?? '-'}]`
          const e = behind.get(key) ?? { cells: 0, withRegion: 0, regionMaterials: {} }
          behind.set(key, e)
          e.cells++
          if (reg) {
            e.withRegion++
            const rm = meshes[reg.mi].materialId ?? '-'
            e.regionMaterials[rm] = (e.regionMaterials[rm] ?? 0) + 1
          } else {
            mark.data[o] = 255
            mark.data[o + 1] = 140
            mark.data[o + 2] = 0
          }
          if (probe.length < 400 && i % 25 === 0 && j % 10 === 0) probe.push({ along: +a.toFixed(2), y: +y.toFixed(2), stack: l.slice(0, 5).map((x) => `${describe(meshes[x.mi])} d=${x.d.toFixed(3)}`) })
        }
      }
    }
  }
  writeFileSync(join(out, `${facade}-${label}.png`), PNG.sync.write(flipIfNeeded(png, facade)))
  writeFileSync(join(out, `${facade}-${label}-marked.png`), PNG.sync.write(flipIfNeeded(mark, facade)))
  report[facade] = {
    frame: { a0: S.a0, y1: S.y1, cellM: CELL, w: S.w, h: S.h, note: 'columns grow with the facade axis of appearance/visibility.ts; the pictures are mirrored for REAR and EAST so the viewer sees them as from outside' },
    lines: [...lineCells].map(([k, v]) => ({ surface: k, ...v, areaM2: +(v.cells * CELL * CELL).toFixed(3) })).sort((a, b) => b.cells - a.cells),
    wallBehindObstruction: [...behind].map(([k, v]) => ({ where: k, cells: v.cells, coveredByWallRegion: v.withRegion, uncovered: v.cells - v.withRegion, regionMaterials: v.regionMaterials })).sort((a, b) => b.cells - a.cells),
    probes: probe.slice(0, 40),
  }
}
writeFileSync(join(out, `trace-${label}.json`), `${JSON.stringify(report, null, 1)}\n`)
for (const f of facades) {
  const r = report[f] as { lines: Array<{ surface: string; cells: number; yMin: number; yMax: number; aMin: number; aMax: number }>; wallBehindObstruction: Array<{ where: string; cells: number; uncovered: number }> }
  process.stdout.write(`${f}: line cells ${r.lines.reduce((s, x) => s + x.cells, 0)} (${r.lines.slice(0, 4).map((x) => `${x.surface} ${x.cells} y ${x.yMin.toFixed(2)}–${x.yMax.toFixed(2)} a ${x.aMin.toFixed(2)}–${x.aMax.toFixed(2)}`).join('; ')}); behind obstruction uncovered ${r.wallBehindObstruction.reduce((s, x) => s + x.uncovered, 0)} of ${r.wallBehindObstruction.reduce((s, x) => s + x.cells, 0)} (${r.wallBehindObstruction.slice(0, 4).map((x) => `${x.where} ${x.uncovered}/${x.cells}`).join('; ')})\n`)
}

function regionHost(m: CompiledMesh): string {
  const r = model.surfaceRegions.find((x) => x.id === m.objectId)
  return r?.hostId ?? ''
}
function flipIfNeeded(p: PNG, facade: Facade): PNG {
  // the facade axis grows left-to-right as seen from outside for FRONT and WEST (see visibility.ts axes); REAR and EAST
  // grow right-to-left as seen from outside
  if (facade === 'FRONT' || facade === 'WEST') return p
  const q = new PNG({ width: p.width, height: p.height })
  for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) p.data.copy(q.data, (y * p.width + (p.width - 1 - x)) * 4, (y * p.width + x) * 4, (y * p.width + x) * 4 + 4)
  return q
}

// ---- seams: where two stacked walls of one facade meet (the floor line), is the finish of the lower wall continued on
// the upper one up to the very edge? Sampled every 1 cm along the shared length, 2 mm on each side of the joint.
type P2 = { a: number; b: number }
const inPoly = (poly: P2[], a: number, b: number): boolean => {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (poly[i].b > b !== poly[j].b > b && a < ((poly[j].a - poly[i].a) * (b - poly[i].b)) / (poly[j].b - poly[i].b) + poly[i].a) c = !c
  }
  return c
}
const regionPoly = (r: (typeof model.surfaceRegions)[number]): P2[] => (r.outline && r.outline.length >= 3 ? r.outline : [{ a: r.rect.a0, b: r.rect.b0 }, { a: r.rect.a1, b: r.rect.b0 }, { a: r.rect.a1, b: r.rect.b1 }, { a: r.rect.a0, b: r.rect.b1 }])
const finishAt = (wallId: string, a: number, b: number): string | undefined => {
  for (const r of model.surfaceRegions) if (r.hostId === wallId && r.face === 'OUTER' && inPoly(regionPoly(r), a, b)) return r.materialId
  return undefined
}
const levelEl = new Map(model.levels.map((l) => [l.id, l.elevation]))
const seams: Array<Record<string, unknown>> = []
for (const lo of model.walls) {
  for (const up of model.walls) {
    if (lo === up) continue
    const loTop = (levelEl.get(lo.levelId) ?? 0) + (lo.baseOffset ?? 0) + lo.height
    const upBase = (levelEl.get(up.levelId) ?? 0) + (up.baseOffset ?? 0)
    if (Math.abs(loTop - upBase) > 0.005) continue
    const L1 = Math.hypot(lo.end.x - lo.start.x, lo.end.z - lo.start.z)
    const L2 = Math.hypot(up.end.x - up.start.x, up.end.z - up.start.z)
    if (L1 < 1e-6 || L2 < 1e-6) continue
    const u1 = { x: (lo.end.x - lo.start.x) / L1, z: (lo.end.z - lo.start.z) / L1 }
    const u2 = { x: (up.end.x - up.start.x) / L2, z: (up.end.z - up.start.z) / L2 }
    if (u1.x * u2.x + u1.z * u2.z < 0.999) continue
    const off = (up.start.x - lo.start.x) * -u1.z + (up.start.z - lo.start.z) * u1.x
    if (Math.abs(off) > 0.01) continue // not one plane
    let both = 0
    let lowerOnly = 0
    let upperOnly = 0
    let differ = 0
    let n = 0
    for (let a1 = 0.005; a1 < L1; a1 += 0.01) {
      const px = lo.start.x + u1.x * a1
      const pz = lo.start.z + u1.z * a1
      const a2 = (px - up.start.x) * u2.x + (pz - up.start.z) * u2.z
      if (a2 < 0 || a2 > L2) continue
      n++
      const f1 = finishAt(lo.id, a1, lo.height - 0.002)
      const f2 = finishAt(up.id, a2, 0.002)
      if (f1 && f2) (f1 === f2 ? both++ : differ++)
      else if (f1) lowerOnly++
      else if (f2) upperOnly++
    }
    if (n === 0) continue
    // the gap measured: how far above the joint the upper wall's finish starts where the lower one reaches the joint
    let gap = 0
    for (let a1 = 0.005; a1 < L1; a1 += 0.05) {
      const px = lo.start.x + u1.x * a1
      const pz = lo.start.z + u1.z * a1
      const a2 = (px - up.start.x) * u2.x + (pz - up.start.z) * u2.z
      if (a2 < 0 || a2 > L2 || !finishAt(lo.id, a1, lo.height - 0.002) || finishAt(up.id, a2, 0.002)) continue
      for (let b = 0.002; b < 0.1; b += 0.001) if (finishAt(up.id, a2, b)) { gap = Math.max(gap, b); break }
    }
    seams.push({ lower: lo.id, upper: up.id, sharedM: +(n * 0.01).toFixed(2), sameFinishBothSidesM: +(both * 0.01).toFixed(2), lowerFinishUpperBareM: +(lowerOnly * 0.01).toFixed(2), upperFinishLowerBareM: +(upperOnly * 0.01).toFixed(2), differentFinishM: +(differ * 0.01).toFixed(2), largestBareStripAboveJointM: +gap.toFixed(3) })
  }
}
report.seams = seams
writeFileSync(join(out, `trace-${label}.json`), `${JSON.stringify(report, null, 1)}\n`)
for (const s of seams) if ((s.lowerFinishUpperBareM as number) > 0 || (s.sameFinishBothSidesM as number) > 0) process.stdout.write(`seam ${s.lower} | ${s.upper}: same ${s.sameFinishBothSidesM} m, lower finish / upper bare ${s.lowerFinishUpperBareM} m (strip ${s.largestBareStripAboveJointM} m)\n`)

// ---- obliques: a perspective camera from above and from slightly below, glass at half opacity
function perspective(name: string, eye: { x: number; y: number; z: number }, at: { x: number; y: number; z: number }, W = 900, H = 640, fovDeg = 40): void {
  const f = { x: at.x - eye.x, y: at.y - eye.y, z: at.z - eye.z }
  const fl = Math.hypot(f.x, f.y, f.z)
  f.x /= fl; f.y /= fl; f.z /= fl
  let r = { x: f.z, y: 0, z: -f.x } // right = f × up(0,1,0) with a right-handed y-up world, sign fixed by the view check
  const rl = Math.hypot(r.x, r.z) || 1
  r = { x: r.x / rl, y: 0, z: r.z / rl }
  const u = { x: f.y * r.z - f.z * r.y, y: f.z * r.x - f.x * r.z, z: f.x * r.y - f.y * r.x }
  const k = H / 2 / Math.tan((fovDeg * Math.PI) / 360)
  const proj = (p: { x: number; y: number; z: number }): [number, number, number] => {
    const d = { x: p.x - eye.x, y: p.y - eye.y, z: p.z - eye.z }
    const zc = d.x * f.x + d.y * f.y + d.z * f.z
    return [W / 2 + (k * (d.x * r.x + d.y * r.y + d.z * r.z)) / zc, H / 2 - (k * (d.x * u.x + d.y * u.y + d.z * u.z)) / zc, zc]
  }
  const img = new PNG({ width: W, height: H })
  img.data.fill(255)
  const zb = new Float64Array(W * H).fill(Infinity)
  const light = { x: 0.35, y: 0.8, z: -0.5 }
  const pass = (glass: boolean): void => {
    for (const m of scene.meshes) {
      if (m.part === 'ROOM_FLOOR') continue
      const isGlass = /GLASS|INFILL/.test(m.part)
      if (isGlass !== glass) continue
      const base = meshColour(m)
      for (const t of m.triangles) {
        const P = [t.a, t.b, t.c].map(proj)
        if (P.some((p) => p[2] <= 0.05)) continue
        const e1 = { x: t.b.x - t.a.x, y: t.b.y - t.a.y, z: t.b.z - t.a.z }
        const e2 = { x: t.c.x - t.a.x, y: t.c.y - t.a.y, z: t.c.z - t.a.z }
        const n = { x: e1.y * e2.z - e1.z * e2.y, y: e1.z * e2.x - e1.x * e2.z, z: e1.x * e2.y - e1.y * e2.x }
        const nl = Math.hypot(n.x, n.y, n.z) || 1
        const sh = 0.55 + 0.45 * Math.abs((n.x * light.x + n.y * light.y + n.z * light.z) / nl / Math.hypot(light.x, light.y, light.z))
        const area = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (P[1][1] - P[0][1])
        if (Math.abs(area) < 1e-9) continue
        for (let y = Math.max(0, Math.floor(Math.min(P[0][1], P[1][1], P[2][1]))); y <= Math.min(H - 1, Math.ceil(Math.max(P[0][1], P[1][1], P[2][1]))); y++) {
          for (let x = Math.max(0, Math.floor(Math.min(P[0][0], P[1][0], P[2][0]))); x <= Math.min(W - 1, Math.ceil(Math.max(P[0][0], P[1][0], P[2][0]))); x++) {
            const px = x + 0.5
            const py = y + 0.5
            const w0 = ((P[1][0] - px) * (P[2][1] - py) - (P[2][0] - px) * (P[1][1] - py)) / area
            const w1 = ((P[2][0] - px) * (P[0][1] - py) - (P[0][0] - px) * (P[2][1] - py)) / area
            const w2 = 1 - w0 - w1
            if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue
            const iz = w0 / P[0][2] + w1 / P[1][2] + w2 / P[2][2]
            const z = 1 / iz
            const q = y * W + x
            // a finish skin lies a few millimetres off its wall: a small bias lets the nearer of two coplanar faces win
            if (z >= zb[q] - (m.part === 'SURFACE_REGION' ? 0.004 : 0)) continue
            const o = q * 4
            if (glass) {
              for (let c = 0; c < 3; c++) img.data[o + c] = Math.round(img.data[o + c] * 0.55 + base[c] * sh * 0.45)
            } else {
              zb[q] = z
              for (let c = 0; c < 3; c++) img.data[o + c] = Math.min(255, Math.round(base[c] * sh))
            }
          }
        }
      }
    }
  }
  pass(false)
  pass(true)
  writeFileSync(join(out, `${name}-${label}.png`), PNG.sync.write(img))
}
{
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y1 = -Infinity
  for (const m of scene.meshes) for (const t of m.triangles) for (const p of [t.a, t.b, t.c]) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); y1 = Math.max(y1, p.y) }
  const c = { x: (x0 + x1) / 2, y: 3, z: (z0 + z1) / 2 }
  const R = Math.max(x1 - x0, z1 - z0) * 1.6
  // the front looks at −z (the viewer stands at −z), the rear at +z
  perspective('oblique-front-above', { x: c.x - 0.45 * R, y: 3 + 0.55 * R, z: z0 - R }, { x: c.x - 2, y: 3.2, z: z0 + 1 })
  perspective('oblique-front-below', { x: c.x - 0.35 * R, y: 1.2, z: z0 - 0.8 * R }, { x: c.x - 2, y: 3.4, z: z0 + 1 })
  perspective('oblique-rear-above', { x: c.x + 0.45 * R, y: 3 + 0.55 * R, z: z1 + R }, { x: c.x + 1, y: 3.2, z: z1 - 1 })
  perspective('oblique-rear-below', { x: c.x + 0.35 * R, y: 1.2, z: z1 + 0.8 * R }, { x: c.x + 1, y: 3.4, z: z1 - 1 })
  perspective('close-front-balcony', { x: c.x - 3.5, y: 2.2, z: z0 - 4.5 }, { x: c.x - 1.5, y: 3.6, z: z0 + 1 }, 900, 640, 50)
  perspective('close-rear-balcony', { x: c.x + 2.5, y: 2.4, z: z1 + 5 }, { x: c.x, y: 3.6, z: z1 - 1 }, 900, 640, 50)
}
