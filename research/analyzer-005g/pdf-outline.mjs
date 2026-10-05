/**
 * BUILDPLAN-ANALYZER-005G — can an outline PDF's vector paths state a footprint and a scale? (research only)
 *
 * PDF.js gives the painted paths in page points. This probe:
 *   1. collects every FILLED closed path and every STROKED path (with its line width) outside the title block;
 *   2. unions the filled paths with `polygon-clipping` (a low-level boolean: it decides nothing about which polygon
 *      is the house) and reports each resulting polygon's outer-ring and net area;
 *   3. reads the scale bar as geometry: the printed tick labels (text items "0", "5", … with a "[m]" unit) and the
 *      vertical tick strokes under them, fitted by least squares → metres per point, independently of the "1:500"
 *      text, which it then checks;
 *   4. converts the union's areas to m² by the scale bar and by the stated scale.
 * The published footprint is NOT an input: it is printed beside the result for the reader to compare.
 *
 *   node pdf-outline.mjs --file asterVIII_pk.pdf --sha256 <hex> [--out result.json]
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import polygonClipping from 'polygon-clipping'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const bytes = new Uint8Array(readFileSync(arg('file')))
const sha = createHash('sha256').update(bytes).digest('hex')
if (arg('sha256') && arg('sha256') !== sha) throw new Error(`sha256 mismatch ${sha}`)
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
const { OPS } = pdfjs
const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, disableFontFace: true, verbosity: 0 }).promise
const page = await doc.getPage(1)
const text = (await page.getTextContent()).items.filter((i) => 'str' in i && i.str.trim())
const ol = await page.getOperatorList()

const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]
const ap = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
let ctm = [1, 0, 0, 1, 0, 0]
let lineWidth = 1
const stack = []
let pending = []
const fills = []
const strokes = []
for (let i = 0; i < ol.fnArray.length; i += 1) {
  const fn = ol.fnArray[i]
  const a = ol.argsArray[i]
  if (fn === OPS.save) stack.push([ctm, lineWidth])
  else if (fn === OPS.restore) [ctm, lineWidth] = stack.pop() ?? [ctm, lineWidth]
  else if (fn === OPS.transform) ctm = mul(ctm, a)
  else if (fn === OPS.setLineWidth) lineWidth = a[0]
  else if (fn === OPS.constructPath) {
    const [ops, coords] = a
    let k = 0
    let poly = []
    for (const op of ops) {
      if (op === OPS.moveTo) {
        if (poly.length > 1) pending.push(poly)
        poly = [ap(ctm, coords[k], coords[k + 1])]
        k += 2
      } else if (op === OPS.lineTo) {
        poly.push(ap(ctm, coords[k], coords[k + 1]))
        k += 2
      } else if (op === OPS.curveTo) {
        poly.push(ap(ctm, coords[k + 4], coords[k + 5]))
        k += 6
      } else if (op === OPS.curveTo2 || op === OPS.curveTo3) {
        poly.push(ap(ctm, coords[k + 2], coords[k + 3]))
        k += 4
      } else if (op === OPS.rectangle) {
        const [rx, ry, rw, rh] = coords.slice(k, k + 4)
        pending.push([ap(ctm, rx, ry), ap(ctm, rx + rw, ry), ap(ctm, rx + rw, ry + rh), ap(ctm, rx, ry + rh)])
        k += 4
      } else if (op === OPS.closePath && poly.length) poly.push(poly[0])
    }
    if (poly.length > 1) pending.push(poly)
  } else if (fn === OPS.fill || fn === OPS.eoFill || fn === OPS.fillStroke || fn === OPS.eoFillStroke || fn === OPS.closeFillStroke || fn === OPS.closeEOFillStroke) {
    for (const p of pending) fills.push(p)
    pending = []
  } else if (fn === OPS.stroke || fn === OPS.closeStroke) {
    const w = Math.abs(lineWidth * Math.hypot(ctm[0], ctm[1]))
    for (const p of pending) strokes.push({ pts: p, w })
    pending = []
  } else if (fn === OPS.endPath) pending = []
}

// The title block and its logo: the region below the scale bar's labels (generic: everything under the lowest "[m]").
const unit = text.find((t) => t.str.trim() === '[m]')
const barLabels = unit ? text.filter((t) => /^\d+$/.test(t.str.trim()) && Math.abs(t.transform[5] - unit.transform[5]) < 1) : []
const floorY = unit ? unit.transform[5] + 10 : 0
const bbox = (pts) => ({ x0: Math.min(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), x1: Math.max(...pts.map((p) => p[0])), y1: Math.max(...pts.map((p) => p[1])) })
const drawingFills = fills.filter((p) => p.length >= 3 && bbox(p).y0 > floorY)

// Scale bar: the label centres against their values (least squares), then the tick strokes nearest each label.
let mPerPtBar = null
let barFit = null
if (barLabels.length >= 3) {
  const pts = barLabels.map((t) => ({ v: Number(t.str.trim()), x: t.transform[4] + t.width / 2 }))
  const ticks = strokes.filter((s) => s.pts.length === 2 && Math.abs(s.pts[0][0] - s.pts[1][0]) < 0.01 && Math.abs(s.pts[0][1] - s.pts[1][1]) > 1 && Math.min(s.pts[0][1], s.pts[1][1]) > unit.transform[5] && Math.min(s.pts[0][1], s.pts[1][1]) < unit.transform[5] + 40)
  const snapped = pts.map((p) => {
    const t = ticks.map((s) => s.pts[0][0]).sort((a, b) => Math.abs(a - p.x) - Math.abs(b - p.x))[0]
    return { v: p.v, xLabel: p.x, xTick: t ?? null }
  })
  const use = snapped.filter((s) => s.xTick != null && Math.abs(s.xTick - s.xLabel) < 4)
  const n = use.length
  const mx = use.reduce((a, s) => a + s.xTick, 0) / n
  const mv = use.reduce((a, s) => a + s.v, 0) / n
  const sxx = use.reduce((a, s) => a + (s.xTick - mx) ** 2, 0)
  const sxv = use.reduce((a, s) => a + (s.xTick - mx) * (s.v - mv), 0)
  mPerPtBar = sxv / sxx
  const resid = Math.max(...use.map((s) => Math.abs(mv + mPerPtBar * (s.xTick - mx) - s.v)))
  barFit = { labels: pts.length, ticksUsed: n, mPerPt: Number(mPerPtBar.toFixed(6)), impliedScale: Number((mPerPtBar / (25.4 / 72 / 1000)).toFixed(1)), maxResidualM: Number(resid.toFixed(3)) }
}
const stated = text.map((t) => t.str.trim().match(/^1\s*:\s*(\d+)$/)).find(Boolean)
const mPerPtStated = stated ? (25.4 / 72 / 1000) * Number(stated[1]) : null

// Union of the drawing's filled shapes (low-level boolean; no choice of "the house").
const ring = (p) => {
  const r = p.map(([x, y]) => [x, y])
  if (r[0][0] !== r.at(-1)[0] || r[0][1] !== r.at(-1)[1]) r.push(r[0])
  return r
}
const t0 = performance.now()
const union = drawingFills.length ? polygonClipping.union(...drawingFills.map((p) => [[ring(p)]])) : []
const unionMs = performance.now() - t0
const area = (r) => Math.abs(r.reduce((a, p, i) => (i + 1 < r.length ? a + p[0] * r[i + 1][1] - r[i + 1][0] * p[1] : a), 0)) / 2
const polys = union
  .map((poly) => ({ outerPt2: area(poly[0]), holesPt2: poly.slice(1).reduce((a, h) => a + area(h), 0), holes: poly.length - 1, vertices: poly[0].length - 1, bbox: bbox(poly[0]) }))
  .sort((a, b) => b.outerPt2 - a.outerPt2)
const m2 = (pt2, s) => (s ? Number((pt2 * s * s).toFixed(2)) : null)

/**
 * Enclosure, measured on a raster of the vector drawing (8 px per point): paint the drawing's filled shapes, and
 * optionally its strokes (at their own width, at least one pixel), flood the outside from the border, and count what
 * the flood cannot reach. This is a measurement of what the lines close, not a decision about which line is the
 * envelope: the two variants (filled shapes alone; filled shapes plus every stroke) are both reported.
 */
function enclosed(withStrokes) {
  const drawStrokes = strokes.filter((s) => bbox(s.pts).y0 > floorY)
  const all = [...drawingFills.flat(), ...(withStrokes ? drawStrokes.flatMap((s) => s.pts) : [])]
  if (!all.length) return null
  const B = bbox(all)
  const k = 8
  const pad = 4
  const W = Math.ceil((B.x1 - B.x0) * k) + 2 * pad
  const H = Math.ceil((B.y1 - B.y0) * k) + 2 * pad
  const ink = new Uint8Array(W * H)
  const px = (p) => [(p[0] - B.x0) * k + pad, (p[1] - B.y0) * k + pad]
  // Filled polygons: even-odd scanline at pixel centres.
  for (const poly of drawingFills) {
    const P = poly.map(px)
    for (let y = 0; y < H; y += 1) {
      const yc = y + 0.5
      const xs = []
      for (let i = 0; i < P.length; i += 1) {
        const a = P[i]
        const b = P[(i + 1) % P.length]
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]))
      }
      xs.sort((u, v) => u - v)
      for (let j = 0; j + 1 < xs.length; j += 2) for (let x = Math.max(0, Math.ceil(xs[j] - 0.5)); x <= Math.min(W - 1, Math.floor(xs[j + 1] - 0.5)); x += 1) ink[y * W + x] = 1
    }
  }
  if (withStrokes)
    for (const s of drawStrokes) {
      const r = Math.max(0.75, (s.w * k) / 2)
      for (let i = 0; i + 1 < s.pts.length; i += 1) {
        const [ax, ay] = px(s.pts[i])
        const [bx, by] = px(s.pts[i + 1])
        const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 2) + 1
        for (let t = 0; t <= n; t += 1) {
          const cx = ax + ((bx - ax) * t) / n
          const cy = ay + ((by - ay) * t) / n
          for (let yy = Math.floor(cy - r); yy <= Math.ceil(cy + r); yy += 1)
            for (let xx = Math.floor(cx - r); xx <= Math.ceil(cx + r); xx += 1)
              if (xx >= 0 && yy >= 0 && xx < W && yy < H && Math.hypot(xx + 0.5 - cx, yy + 0.5 - cy) <= r) ink[yy * W + xx] = 1
        }
      }
    }
  const outside = new Uint8Array(W * H)
  const queue = [0]
  outside[0] = 1
  while (queue.length) {
    const i = queue.pop()
    const x = i % W
    const y = (i - x) / W
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
      const j = ny * W + nx
      if (outside[j] || ink[j]) continue
      outside[j] = 1
      queue.push(j)
    }
  }
  let inside = 0
  for (let i = 0; i < W * H; i += 1) if (!outside[i]) inside += 1
  const pt2 = inside / (k * k)
  return { rasterPxPerPt: k, enclosedM2ByBar: m2(pt2, mPerPtBar), enclosedM2ByStated: m2(pt2, mPerPtStated) }
}
const result = {
  sha256: sha,
  engine: 'pdfjs-dist 4.8.69 (legacy) + polygon-clipping 0.15.7',
  node: process.version,
  statedScale: stated ? `1:${stated[1]}` : null,
  scaleBar: barFit,
  scaleAgreement: barFit && mPerPtStated ? Number((mPerPtBar / mPerPtStated - 1).toFixed(5)) : null,
  drawingFilledPaths: drawingFills.length,
  enclosureFilledShapesOnly: enclosed(false),
  enclosureFilledShapesAndStrokes: enclosed(true),
  strokedPaths: strokes.length,
  unionMs: Number(unionMs.toFixed(1)),
  unionPolygons: polys.slice(0, 6).map((p) => ({
    vertices: p.vertices,
    holes: p.holes,
    outerM2ByBar: m2(p.outerPt2, mPerPtBar),
    outerM2ByStated: m2(p.outerPt2, mPerPtStated),
    netM2ByBar: m2(p.outerPt2 - p.holesPt2, mPerPtBar),
    widthM: mPerPtBar ? Number(((p.bbox.x1 - p.bbox.x0) * mPerPtBar).toFixed(2)) : null,
    depthM: mPerPtBar ? Number(((p.bbox.y1 - p.bbox.y0) * mPerPtBar).toFixed(2)) : null,
  })),
}
await doc.destroy()
if (arg('out')) writeFileSync(arg('out'), JSON.stringify(result, null, 1))
console.log(JSON.stringify(result, null, 1))
