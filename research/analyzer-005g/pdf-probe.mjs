/**
 * BUILDPLAN-ANALYZER-005G — PDF / vector evidence probe (research only).
 *
 * Opens a PDF already recorded (and hashed) by a sealed SourcePackage with Mozilla PDF.js (`pdfjs-dist`, legacy
 * build: the last line that still declares Node 18) and reports, as text facts only:
 *   - page count, page size in points, rotation, user unit;
 *   - text items with their transform (position, size, font), i.e. whether dimensions/scale are TEXT;
 *   - the operator list: path construction (move/line/curve/rect), strokes/fills, transforms, images, glyph
 *     painting — i.e. whether the drawing is VECTOR and whether its text is real text or outlined glyphs;
 *   - the stroked geometry's extent in page points and, under a stated scale, in metres (scale × 25.4/72 mm per pt);
 *   - axis-aligned segment statistics and the longest closed polyline (a candidate outline, not a decision).
 * Nothing is rasterised. No PDF byte leaves the machine; only the numbers above are written.
 *
 *   node pdf-probe.mjs --file /path/asterVIII_pk.pdf --sha256 <expected> --scale 500 --label aster-viii-base
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const FILE = arg('file')
const EXPECT = arg('sha256')
const SCALE = Number(arg('scale', '0'))
const LABEL = arg('label', 'pdf')
const OUT = arg('out')

const bytes = new Uint8Array(readFileSync(FILE))
const sha = createHash('sha256').update(bytes).digest('hex')
if (EXPECT && EXPECT !== sha) throw new Error(`sha256 mismatch: ${sha}`)

const t0 = performance.now()
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
const importMs = performance.now() - t0
const { OPS } = pdfjs
const opName = Object.fromEntries(Object.entries(OPS).map(([k, v]) => [v, k]))
const t1 = performance.now()
// isEvalSupported false: CVE-2024-4367 hardening (font compilation never builds JS); no worker thread in Node needed.
const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, disableFontFace: true, useSystemFonts: false, stopAtErrors: true, verbosity: 0 }).promise
const meta = await doc.getMetadata().catch(() => null)
const pages = []
for (let p = 1; p <= doc.numPages; p += 1) {
  const page = await doc.getPage(p)
  const [x0, y0, x1, y1] = page.view
  const text = await page.getTextContent({ includeMarkedContent: false, disableNormalization: false })
  const items = text.items.filter((i) => 'str' in i)
  const ol = await page.getOperatorList()
  // Walk the operator list with a CTM stack to put path geometry in page space.
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]
  const ap = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
  let ctm = [1, 0, 0, 1, 0, 0]
  const stack = []
  const opCounts = {}
  const segments = []
  const polylines = []
  let curves = 0
  let rects = 0
  let pending = []
  let images = 0
  let glyphRuns = 0
  for (let i = 0; i < ol.fnArray.length; i += 1) {
    const fn = ol.fnArray[i]
    const a = ol.argsArray[i]
    const name = opName[fn] ?? String(fn)
    opCounts[name] = (opCounts[name] ?? 0) + 1
    if (fn === OPS.save) stack.push(ctm)
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm
    else if (fn === OPS.transform) ctm = mul(ctm, a)
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintImageMaskXObject) images += 1
    else if (fn === OPS.showText || fn === OPS.showSpacedText) glyphRuns += 1
    else if (fn === OPS.constructPath) {
      // pdf.js 4.x: [ops[], coords[], minMax]
      const [ops, coords] = a
      let k = 0
      let cur = null
      let start = null
      let poly = []
      const flush = () => {
        if (poly.length > 1) pending.push(poly)
        poly = []
      }
      for (const op of ops) {
        if (op === OPS.moveTo) {
          flush()
          cur = ap(ctm, coords[k], coords[k + 1])
          start = cur
          poly = [cur]
          k += 2
        } else if (op === OPS.lineTo) {
          const nxt = ap(ctm, coords[k], coords[k + 1])
          if (cur) segments.push([cur, nxt])
          cur = nxt
          poly.push(cur)
          k += 2
        } else if (op === OPS.curveTo) {
          const nxt = ap(ctm, coords[k + 4], coords[k + 5])
          curves += 1
          cur = nxt
          poly.push(cur)
          k += 6
        } else if (op === OPS.curveTo2 || op === OPS.curveTo3) {
          const nxt = ap(ctm, coords[k + 2], coords[k + 3])
          curves += 1
          cur = nxt
          poly.push(cur)
          k += 4
        } else if (op === OPS.rectangle) {
          const [rx, ry, rw, rh] = coords.slice(k, k + 4)
          const c = [ap(ctm, rx, ry), ap(ctm, rx + rw, ry), ap(ctm, rx + rw, ry + rh), ap(ctm, rx, ry + rh)]
          for (let q = 0; q < 4; q += 1) segments.push([c[q], c[(q + 1) % 4]])
          pending.push([...c, c[0]])
          rects += 1
          k += 4
        } else if (op === OPS.closePath) {
          if (cur && start) {
            segments.push([cur, start])
            poly.push(start)
            cur = start
          }
        }
      }
      flush()
    } else if (fn === OPS.stroke || fn === OPS.closeStroke || fn === OPS.fill || fn === OPS.eoFill || fn === OPS.fillStroke || fn === OPS.eoFillStroke || fn === OPS.closeFillStroke || fn === OPS.closeEOFillStroke) {
      for (const pl of pending) polylines.push({ pts: pl, paint: opName[fn] })
      pending = []
    } else if (fn === OPS.endPath) pending = []
  }
  const xs = segments.flatMap((s) => [s[0][0], s[1][0]])
  const ys = segments.flatMap((s) => [s[0][1], s[1][1]])
  const extent = segments.length ? { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) } : null
  const len = (s) => Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1])
  const axis = segments.filter((s) => len(s) > 0.5 && (Math.abs(s[1][0] - s[0][0]) < 0.01 || Math.abs(s[1][1] - s[0][1]) < 0.01))
  const closed = polylines.filter((p) => p.pts.length >= 4 && Math.hypot(p.pts[0][0] - p.pts.at(-1)[0], p.pts[0][1] - p.pts.at(-1)[1]) < 0.01)
  const areaOf = (pts) => Math.abs(pts.reduce((a, p, i) => a + p[0] * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * p[1], 0)) / 2
  const bbox = (pts) => ({ x0: Math.min(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), x1: Math.max(...pts.map((p) => p[0])), y1: Math.max(...pts.map((p) => p[1])) })
  const largest = closed.map((p) => ({ n: p.pts.length - 1, paint: p.paint, areaPt2: areaOf(p.pts.slice(0, -1)), bbox: bbox(p.pts) })).sort((a, b) => b.areaPt2 - a.areaPt2).slice(0, 5)
  const mPerPt = SCALE > 0 ? (25.4 / 72 / 1000) * SCALE : null
  const toM = (v) => (mPerPt ? Number((v * mPerPt).toFixed(3)) : null)
  pages.push({
    page: p,
    viewPt: { x0, y0, x1, y1 },
    sizeMm: { w: Number((((x1 - x0) * 25.4) / 72).toFixed(1)), h: Number((((y1 - y0) * 25.4) / 72).toFixed(1)) },
    rotate: page.rotate,
    userUnit: page.userUnit,
    text: {
      items: items.length,
      nonEmpty: items.filter((i) => i.str.trim()).length,
      fonts: [...new Set(items.map((i) => i.fontName))].length,
      // Every text item as a fact: the string and where it sits (page points), its height and direction.
      sample: items
        .filter((i) => i.str.trim())
        .slice(0, 80)
        .map((i) => ({ str: i.str, x: Number(i.transform[4].toFixed(2)), y: Number(i.transform[5].toFixed(2)), h: Number(Math.hypot(i.transform[2], i.transform[3]).toFixed(2)), angleDeg: Number(((Math.atan2(i.transform[1], i.transform[0]) * 180) / Math.PI).toFixed(1)), w: Number(i.width.toFixed(2)) })),
      numericItems: items.filter((i) => /^[\s\d.,:+\-/°]+$/.test(i.str) && /\d/.test(i.str)).length,
    },
    ops: { total: ol.fnArray.length, counts: opCounts, glyphRuns, images, rects, curves },
    geometry: {
      segments: segments.length,
      axisAligned: axis.length,
      polylinesPainted: polylines.length,
      closedPainted: closed.length,
      extentPt: extent && Object.fromEntries(Object.entries(extent).map(([k, v]) => [k, Number(v.toFixed(2))])),
      extentM: extent && mPerPt ? { w: toM(extent.x1 - extent.x0), h: toM(extent.y1 - extent.y0) } : null,
      largestClosed: largest.map((c) => ({ ...c, areaPt2: Number(c.areaPt2.toFixed(2)), areaM2: mPerPt ? Number((c.areaPt2 * mPerPt * mPerPt).toFixed(2)) : null, wM: toM(c.bbox.x1 - c.bbox.x0), hM: toM(c.bbox.y1 - c.bbox.y0), bbox: Object.fromEntries(Object.entries(c.bbox).map(([k, v]) => [k, Number(v.toFixed(2))])) })),
    },
  })
  page.cleanup()
}
const parseMs = performance.now() - t1
const info = meta?.info ?? {}
const result = {
  label: LABEL,
  sha256: sha,
  bytes: bytes.length,
  engine: `pdfjs-dist@${JSON.parse(readFileSync(new URL('./node_modules/pdfjs-dist/package.json', import.meta.url))).version} (legacy build)`,
  node: process.version,
  statedScale: SCALE ? `1:${SCALE}` : null,
  pdfVersion: info.PDFFormatVersion ?? null,
  producer: info.Producer ?? null,
  creator: info.Creator ?? null,
  numPages: doc.numPages,
  importMs: Number(importMs.toFixed(1)),
  parseMs: Number(parseMs.toFixed(1)),
  rssMiB: Number((process.memoryUsage().rss / 2 ** 20).toFixed(1)),
  pages,
}
await doc.destroy()
if (OUT) writeFileSync(OUT, JSON.stringify(result, null, 1))
console.log(JSON.stringify({ label: LABEL, node: result.node, pages: result.numPages, parseMs: result.parseMs, producer: result.producer, creator: result.creator, p1: { size: pages[0].sizeMm, text: pages[0].text.nonEmpty, numeric: pages[0].text.numericItems, ops: pages[0].ops.total, segs: pages[0].geometry.segments, extentM: pages[0].geometry.extentM, glyphRuns: pages[0].ops.glyphRuns, images: pages[0].ops.images } }))
