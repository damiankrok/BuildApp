/**
 * v3.54.13 — the finish boundary measure: each model's facade, as the compiled scene shows it (finish regions included,
 * a balustrade's glass seen through), classed by the material actually seen, compared pixel by pixel with the
 * MANUAL_REFERENCE outlines traced on the original elevations (refs-marcowki-boundaries.json), in the source's own pixels.
 *
 *   npx vite-node research/source-to-model/v35413/boundary-metric.ts -- <refs.json> <facade-alignment.json> <out.json> label=model.json …
 *
 * Per side and model: IoU per class over the scored pixels (inside a reference outline, not an opening: glass, frames
 * and doors are not scored); boundary F1 at 0.10 m (a reference boundary pixel is found if a predicted boundary between
 * the same two classes lies within the tolerance, and vice versa); and continuity: the share of a reference run along
 * a floor line where the class is seen both 0.15 m below and 0.15 m above it. The historical 14 zone points stay a
 * separate measure.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { parseModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import { stableJson } from '@buildapp/source-common'
import { inside, visibilityMap, elevationToCell } from '../../../packages/analysis-service/src/appearance/index.js'
import type { Facade } from '../../../packages/analysis-service/src/appearance/index.js'

const argv = process.argv.slice(2).filter((a) => a !== '--')
const [refsPath, alignPath, outPath, ...specs] = argv
const refs = JSON.parse(readFileSync(refsPath, 'utf8')) as { sides: Record<string, { sourceByteHash: string; regions: Array<{ id: string; class: string; polygon: Array<[number, number]> }>; boundaries: Array<{ id: string; between: [string, string] }>; continuity: Array<{ id: string; class: string; atY: number; alongPx: [number, number] }> }> }
const align = JSON.parse(readFileSync(alignPath, 'utf8')) as { views: Array<{ facade: string; projection: { alongAtPx0: number; alongSign: number; mpp: number; zeroRow: number } }> }
const TOL_M = 0.1
const classOfColor = (hex: string | undefined): string => {
  if (!hex) return 'OTHER'
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const L = (r + g + b) / 3
  const C = Math.max(r, g, b) - Math.min(r, g, b)
  if (C >= 0.18 && r > b) return 'TIMBER'
  if (C < 0.12 && L <= 0.36) return 'DARK_RENDER'
  if (C < 0.12 && L >= 0.75) return 'LIGHT_RENDER'
  return 'OTHER'
}
const OPENING = /^(WINDOW_|DOOR_|ROOFLIGHT_|WALL_REVEAL)/
const results: Record<string, unknown> = {}
for (const spec of specs) {
  const [label, path] = spec.split('=')
  const model = parseModel(readFileSync(path, 'utf8'))
  const scene = compileBuilding(model)
  const color = new Map(model.materials.map((m) => [m.id, m.color]))
  const perSide: Record<string, unknown> = {}
  for (const [side, ref] of Object.entries(refs.sides)) {
    const view = align.views.find((v) => v.facade === side)
    if (!view) continue
    const p = view.projection
    const vis = visibilityMap(scene, side as Facade, 0.01, { withRegions: true })
    const xs = ref.regions.flatMap((r) => r.polygon.map((q) => q[0]))
    const ys = ref.regions.flatMap((r) => r.polygon.map((q) => q[1]))
    const x0 = Math.floor(Math.min(...xs))
    const x1 = Math.ceil(Math.max(...xs))
    const y0 = Math.floor(Math.min(...ys))
    const y1 = Math.ceil(Math.max(...ys))
    const W = x1 - x0 + 1
    const H = y1 - y0 + 1
    const refC: string[] = new Array(W * H).fill('')
    const predC: string[] = new Array(W * H).fill('')
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = (y - y0) * W + (x - x0)
      for (const r of ref.regions) if (inside(r.polygon, x + 0.5, y + 0.5)) refC[k] = r.class
      if (!refC[k]) continue
      const along = p.alongAtPx0 + p.alongSign * p.mpp * (x + 0.5)
      const h = (p.zeroRow - (y + 0.5)) * p.mpp
      const [ci, cj] = elevationToCell(vis, along, h)
      const i = Math.floor(ci)
      const j = Math.floor(cj)
      const mi = i >= 0 && j >= 0 && i < vis.w && j < vis.h ? vis.mesh[j * vis.w + i] : -1
      if (mi < 0) { predC[k] = 'NOTHING'; continue }
      const m = vis.meshes[mi]
      if (OPENING.test(m.part)) { predC[k] = 'OPENING'; continue }
      predC[k] = classOfColor(m.materialId ? color.get(m.materialId) : undefined)
    }
    const scored = (k: number): boolean => refC[k] !== '' && predC[k] !== 'OPENING'
    const classes = [...new Set(ref.regions.map((r) => r.class))]
    const iou: Record<string, number> = {}
    let agree = 0
    let n = 0
    for (let k = 0; k < W * H; k++) if (scored(k)) { n++; if (predC[k] === refC[k]) agree++ }
    for (const c of classes) {
      let I = 0
      let U = 0
      for (let k = 0; k < W * H; k++) {
        if (!scored(k)) continue
        const a = refC[k] === c
        const b = predC[k] === c
        if (a && b) I++
        if (a || b) U++
      }
      iou[c] = U > 0 ? Math.round((I / U) * 1000) / 1000 : 1
    }
    // boundary F1: pixels where the class changes to a 4-neighbour, for each named pair
    const tolPx = Math.max(1, Math.round(TOL_M / p.mpp))
    const boundary = (C: string[], a: string, b: string): Set<number> => {
      const s = new Set<number>()
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const k = y * W + x
        if (C[k] !== a) continue
        for (const q of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, y > 0 ? k - W : -1, y < H - 1 ? k + W : -1]) if (q >= 0 && C[q] === b) { s.add(k); break }
      }
      return s
    }
    const near = (k: number, set: Set<number>): boolean => {
      const x = k % W
      const y = (k - x) / W
      for (let dy = -tolPx; dy <= tolPx; dy++) for (let dx = -tolPx; dx <= tolPx; dx++) {
        if (dx * dx + dy * dy > tolPx * tolPx) continue
        const xx = x + dx
        const yy = y + dy
        if (xx >= 0 && yy >= 0 && xx < W && yy < H && set.has(yy * W + xx)) return true
      }
      return false
    }
    const bf: Record<string, unknown> = {}
    for (const bd of ref.boundaries) {
      const [a, b] = bd.between
      // the reference boundary only where both sides are scored, the predicted only inside the reference outlines
      const R = new Set([...boundary(refC, a, b)].filter((k) => predC[k] !== 'OPENING'))
      const P = new Set([...boundary(predC.map((c, k) => (refC[k] ? c : '')), a, b)])
      const rec = R.size ? [...R].filter((k) => near(k, P)).length / R.size : 1
      const prec = P.size ? [...P].filter((k) => near(k, R)).length / P.size : R.size ? 0 : 1
      bf[bd.id] = { recall: Math.round(rec * 1000) / 1000, precision: Math.round(prec * 1000) / 1000, f1: rec + prec > 0 ? Math.round(((2 * rec * prec) / (rec + prec)) * 1000) / 1000 : 0, refPx: R.size, predPx: P.size }
    }
    const cont: Record<string, number> = {}
    for (const c of ref.continuity) {
      let both = 0
      let tot = 0
      const yRow = (h: number): number => Math.round(p.zeroRow - h / p.mpp) - y0
      for (let x = c.alongPx[0]; x <= c.alongPx[1]; x++) {
        const below = predC[yRow(c.atY - 0.15) * W + (x - x0)]
        const above = predC[yRow(c.atY + 0.15) * W + (x - x0)]
        if (below === 'OPENING' || above === 'OPENING') continue
        tot++
        if (below === c.class && above === c.class) both++
      }
      cont[c.id] = tot ? Math.round((both / tot) * 1000) / 1000 : 1
    }
    perSide[side] = { scoredPx: n, pixelAgreement: Math.round((agree / Math.max(1, n)) * 1000) / 1000, iou, boundaryF1: bf, continuity: cont }
  }
  results[label] = perSide
  process.stdout.write(`${label}: ${Object.entries(perSide).map(([s, v]) => { const r = v as { pixelAgreement: number; iou: Record<string, number>; boundaryF1: Record<string, { f1: number }>; continuity: Record<string, number> }; return `${s} agree ${r.pixelAgreement} IoU ${Object.entries(r.iou).map(([c, x]) => `${c.slice(0, 5)} ${x}`).join(' ')} | F1 ${Object.entries(r.boundaryF1).map(([b, x]) => `${b} ${x.f1}`).join(' ')}${Object.keys(r.continuity).length ? ` | cont ${Object.values(r.continuity).join(' ')}` : ''}` }).join('  ||  ')}\n`)
}
writeFileSync(outPath, `${stableJson({ tolM: TOL_M, results })}\n`)
