/**
 * N9-01 (research only): R3/R4 boards on a synthetic plan drawn from the demo house (no source image), with two
 * defects by construction — the house’s right wall left open along the garage on the sheet (R3: the model's wall on
 * blank paper), and a 4 m wing drawn behind the garage that the model does not build (R4).
 *   npx vite-node research/analyzer-n9-01/synthetic-board.ts -- --out <dir>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseModel } from '@buildapp/model'
import type { CanonicalBuildingModel, Wall } from '@buildapp/model'
import type { Raster } from '@buildapp/source-cv'
import { encodePng, planRelations } from '../../packages/analysis-service/src/index.js'
import { bandQuad, wallAxes } from '../../packages/analysis-service/src/assessment/plan-geometry.js'

const out = process.argv[process.argv.indexOf('--out') + 1]
mkdirSync(out, { recursive: true })
const MPP = 0.02
const W = 1100
const H = 700
const toPixel = (x: number, z: number) => ({ x: 120 + x / MPP, y: 60 + (10 - z) / MPP })
const r: Raster = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4).fill(255) }
const paint = (x: number, y: number, v: [number, number, number], a = 1): void => {
  const xi = Math.round(x), yi = Math.round(y)
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return
  const o = (yi * W + xi) * 4
  for (let k = 0; k < 3; k += 1) r.data[o + k] = Math.round(r.data[o + k] * (1 - a) + v[k] * a)
}
const fill = (quad: Array<{ x: number; z: number }>, v: number): void => {
  const p = quad.map((q) => toPixel(q.x, q.z))
  for (let y = Math.floor(Math.min(...p.map((a) => a.y))); y <= Math.ceil(Math.max(...p.map((a) => a.y))); y += 1)
    for (let x = Math.floor(Math.min(...p.map((a) => a.x))); x <= Math.ceil(Math.max(...p.map((a) => a.x))); x += 1) {
      let inside = false
      for (let i = 0, j = p.length - 1; i < p.length; j = i, i += 1) if (p[i].y > y !== p[j].y > y && x < ((p[j].x - p[i].x) * (y - p[i].y)) / (p[j].y - p[i].y) + p[i].x) inside = !inside
      if (inside) paint(x, y, [v, v, v])
    }
}
const model: CanonicalBuildingModel = parseModel(readFileSync('packages/model/test/fixtures/demo-house-1.7.0.json', 'utf8'))
const drawn: Wall[] = [...model.walls.filter((w) => w.levelId === 'ground'), { ...model.walls.find((w) => w.id === 'gar-right')!, id: 'x1', start: { x: 15, z: 6 }, end: { x: 15, z: 10 } }, { ...model.walls.find((w) => w.id === 'gar-right')!, id: 'x2', start: { x: 15, z: 10 }, end: { x: 10, z: 10 } }]
for (const w of drawn) {
  fill(bandQuad(w), 25)
  const { u, n } = wallAxes(w)
  const gaps = [...model.openings.filter((o) => o.wallId === w.id).map((o) => [o.offset, o.offset + o.width]), ...(w.id === 'g-right' ? [[0, 6.2]] : [])]
  for (const [a0, a1] of gaps) fill([{ x: w.start.x + u.x * a0 - n.x * 0.02, z: w.start.z + u.z * a0 - n.z * 0.02 }, { x: w.start.x + u.x * a1 - n.x * 0.02, z: w.start.z + u.z * a1 - n.z * 0.02 }, { x: w.start.x + u.x * a1 + n.x * (w.thickness + 0.02), z: w.start.z + u.z * a1 + n.z * (w.thickness + 0.02) }, { x: w.start.x + u.x * a0 + n.x * (w.thickness + 0.02), z: w.start.z + u.z * a0 + n.z * (w.thickness + 0.02) }], 255)
}
const sheetRaster: Raster = { width: W, height: H, data: r.data.slice() }
const rel = planRelations(model, [{ frameId: 'synthetic-ground', assetId: 'synthetic', storeyIndex: 0, mppX: MPP, mppY: MPP, wallPx: 7.5, toPixel, raster: sheetRaster }], { keepMasks: true })
const s = rel.storeys[0]
const m = s.outline.masks!
for (let i = 0; i < W * H; i += 1) {
  for (let k = 0; k < 3; k += 1) r.data[i * 4 + k] = Math.round(255 - (255 - r.data[i * 4 + k]) * 0.45)
  if (m.footprint[i]) paint(i % W, Math.floor(i / W), [60, 110, 230], 0.22)
  if (m.outside[i]) paint(i % W, Math.floor(i / W), [230, 30, 30], 0.85)
}
const col = { BAND: [20, 160, 60], THIN: [240, 140, 0], BLANK: [220, 0, 0], EXCLUDED: [150, 150, 150] } as const
for (const w of s.ink.walls) {
  const { u, n } = wallAxes(w.wall)
  for (const st of w.stations) {
    const c = (st.cls === 'BAND' && !st.inline ? [0, 170, 200] : col[st.cls]) as [number, number, number]
    const p = toPixel(w.wall.start.x + u.x * st.a + (n.x * w.wall.thickness) / 2, w.wall.start.z + u.z * st.a + (n.z * w.wall.thickness) / 2)
    for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) paint(p.x + dx, p.y + dy, c)
  }
}
writeFileSync(join(out, 'synthetic-r3-r4-conflicts.png'), encodePng(r))
writeFileSync(join(out, 'synthetic-r3-r4-conflicts.json'), JSON.stringify({ r3: rel.r3.items.map((i) => ({ status: i.status, code: i.code, objects: i.objects, why: i.why })), r4: rel.r4.items.map((i) => ({ status: i.status, code: i.code, measured: i.measured, why: i.why })) }, null, 1))
console.log(rel.r3.status, rel.r4.status)
