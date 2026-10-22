/**
 * Council A (research only): are the 400/550/853 "DIMENSIONED" plan assets of one storey the SAME drawing?
 * Resample each to 200x200 grey (box filter) after cropping to its ink bbox, and report the mean abs difference against
 * the largest copy; the AREA_TABLE copy of the same storey is the control. Also: how many metric chains/registrations
 * each copy contributes (are duplicated frames independent evidence in the metric layer?).
 */
import { HOUSES, loadHouse } from './corpus.js'
import { selectedVariant } from '@buildapp/source-package'
type R = { width: number; height: number; data: Uint8ClampedArray }
function inkBox(r: R) {
  let x0 = r.width, y0 = r.height, x1 = -1, y1 = -1
  for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) {
    const i = (y * r.width + x) * 4
    const g = 0.299 * r.data[i] + 0.587 * r.data[i + 1] + 0.114 * r.data[i + 2]
    if (g < 140) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  }
  return { x0, y0, x1: x1 + 1, y1: y1 + 1 }
}
function sample(r: R, n = 200) {
  const b = inkBox(r)
  const out = new Float64Array(n * n)
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const xa = b.x0 + ((b.x1 - b.x0) * i) / n, xb = b.x0 + ((b.x1 - b.x0) * (i + 1)) / n
    const ya = b.y0 + ((b.y1 - b.y0) * j) / n, yb = b.y0 + ((b.y1 - b.y0) * (j + 1)) / n
    let s = 0, c = 0
    for (let y = Math.floor(ya); y < Math.max(Math.floor(ya) + 1, Math.ceil(yb)); y++) for (let x = Math.floor(xa); x < Math.max(Math.floor(xa) + 1, Math.ceil(xb)); x++) {
      const k = (y * r.width + x) * 4
      s += 0.299 * r.data[k] + 0.587 * r.data[k + 1] + 0.114 * r.data[k + 2]; c++
    }
    out[j * n + i] = s / c
  }
  return { out, aspect: (b.x1 - b.x0) / (b.y1 - b.y0) }
}
const mad = (a: Float64Array, b: Float64Array) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length }
for (const h of HOUSES) {
  const { pkg, rasters, metrics, graph } = await loadHouse(h)
  const plans = pkg.assets.filter((a) => a.roles.document === 'FLOOR_PLAN')
  for (const storey of ['GROUND', 'ATTIC', 'UPPER']) {
    const own = plans.filter((a) => a.roles.storey === storey)
    if (own.length === 0) continue
    const ref = [...own].filter((a) => a.roles.annotation === 'DIMENSIONED').sort((a, b) => selectedVariant(b).decoded.width - selectedVariant(a).decoded.width)[0]
    const rr = rasters.get(selectedVariant(ref).byteHash)
    if (!rr) continue
    const rs = sample(rr)
    const rows: string[] = []
    for (const a of own) {
      const v = selectedVariant(a)
      const r = rasters.get(v.byteHash)
      if (!r) { rows.push(`${a.roles.annotation}/${v.decoded.width}: no raster`); continue }
      const s = sample(r)
      const frame = graph.coordinateFrames.find((f: any) => f.assetId === a.id)
      const chains = frame ? metrics.chains.filter((c: any) => c.frameId === frame.id).length : -1
      const regs = frame ? metrics.coordinateRegistrations.filter((c: any) => c.frameId === frame.id).length : -1
      const ev = frame ? metrics.evidence.filter((c: any) => c.frameId === frame.id).length : -1
      rows.push(`${a.roles.annotation.slice(0, 4)}/${v.decoded.width} mad=${mad(rs.out, s.out).toFixed(1)} inkAspect=${s.aspect.toFixed(3)} chains=${chains} regs=${regs} evidence=${ev}`)
    }
    console.log(`${h.padEnd(11)} ${storey.padEnd(6)} ref=${selectedVariant(ref).decoded.width} :: ${rows.join(' | ')}`)
  }
}
