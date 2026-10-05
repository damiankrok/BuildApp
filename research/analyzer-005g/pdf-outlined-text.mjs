/**
 * BUILDPLAN-ANALYZER-005G — reading OUTLINED text in a vector PDF (research only).
 *
 * Some publishers' PDFs carry no text at all: every glyph — the "1:500", the scale bar's numbers — is a filled path.
 * PDF.js then extracts nothing. This probe shows the deterministic way through without a PDF renderer:
 *   PDF.js operator list → filled glyph paths in a page region → own even-odd scanline raster (6 px per point)
 *   → PaddleOCR text recognition (ONNX Runtime, pinned model) on that crop.
 * The regions are given in page points (the scale bar's label row, the title block's scale cell); the output is
 * text facts only. The rasterised crop is written OUTSIDE the worktree when --crops is given.
 *
 *   node pdf-outlined-text.mjs --file galaktykaI_pk.pdf --sha256 <hex> --model <dir> [--crops /home/user/work005g/pdf]
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { PNG } from 'pngjs'

const require = createRequire(import.meta.url)
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const bytes = new Uint8Array(readFileSync(arg('file')))
const sha = createHash('sha256').update(bytes).digest('hex')
if (arg('sha256') && arg('sha256') !== sha) throw new Error(`sha256 mismatch ${sha}`)
const MODEL = arg('model', '/home/user/work005g/models/PP-OCRv6_tiny_rec_onnx')
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
const { OPS } = pdfjs
const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, disableFontFace: true, verbosity: 0 }).promise
const page = await doc.getPage(1)
const ol = await page.getOperatorList()
const textItems = (await page.getTextContent()).items.filter((i) => 'str' in i && i.str.trim()).length

const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]
const ap = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
let ctm = [1, 0, 0, 1, 0, 0]
const stack = []
let pending = []
const fills = [] // each fill = list of closed sub-paths (even-odd)
for (let i = 0; i < ol.fnArray.length; i += 1) {
  const fn = ol.fnArray[i]
  const a = ol.argsArray[i]
  if (fn === OPS.save) stack.push(ctm)
  else if (fn === OPS.restore) ctm = stack.pop() ?? ctm
  else if (fn === OPS.transform) ctm = mul(ctm, a)
  else if (fn === OPS.constructPath) {
    const [ops, coords] = a
    let k = 0
    let poly = []
    const flatten = (p0, c1, c2, p3) => {
      for (let t = 1; t <= 8; t += 1) {
        const u = t / 8
        const v = 1 - u
        poly.push([v * v * v * p0[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * p3[0], v * v * v * p0[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * p3[1]])
      }
    }
    for (const op of ops) {
      if (op === OPS.moveTo) {
        if (poly.length > 2) pending.push(poly)
        poly = [ap(ctm, coords[k], coords[k + 1])]
        k += 2
      } else if (op === OPS.lineTo) {
        poly.push(ap(ctm, coords[k], coords[k + 1]))
        k += 2
      } else if (op === OPS.curveTo) {
        flatten(poly.at(-1), ap(ctm, coords[k], coords[k + 1]), ap(ctm, coords[k + 2], coords[k + 3]), ap(ctm, coords[k + 4], coords[k + 5]))
        k += 6
      } else if (op === OPS.curveTo2) {
        const p0 = poly.at(-1)
        flatten(p0, p0, ap(ctm, coords[k], coords[k + 1]), ap(ctm, coords[k + 2], coords[k + 3]))
        k += 4
      } else if (op === OPS.curveTo3) {
        const p3 = ap(ctm, coords[k + 2], coords[k + 3])
        flatten(poly.at(-1), ap(ctm, coords[k], coords[k + 1]), p3, p3)
        k += 4
      } else if (op === OPS.rectangle) {
        const [rx, ry, rw, rh] = coords.slice(k, k + 4)
        pending.push([ap(ctm, rx, ry), ap(ctm, rx + rw, ry), ap(ctm, rx + rw, ry + rh), ap(ctm, rx, ry + rh)])
        k += 4
      }
    }
    if (poly.length > 2) pending.push(poly)
  } else if (fn === OPS.fill || fn === OPS.eoFill || fn === OPS.fillStroke || fn === OPS.eoFillStroke) {
    if (pending.length) fills.push(pending)
    pending = []
  } else if (fn === OPS.stroke || fn === OPS.closeStroke || fn === OPS.endPath) pending = []
}

/** Even-odd scanline raster of every fill whose box lies inside `r` (page points, y up), k px per point, ink dark. */
function rasterRegion(r, k = 6) {
  const W = Math.ceil((r.x1 - r.x0) * k)
  const H = Math.ceil((r.y1 - r.y0) * k)
  const g = new Uint8Array(W * H).fill(255)
  const inside = (f) => f.every((sp) => sp.every(([x, y]) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1))
  const chosen = fills.filter(inside)
  for (const f of chosen) {
    const P = f.map((sp) => sp.map(([x, y]) => [(x - r.x0) * k, (r.y1 - y) * k]))
    for (let y = 0; y < H; y += 1) {
      const yc = y + 0.5
      const xs = []
      for (const sp of P)
        for (let i = 0; i < sp.length; i += 1) {
          const a = sp[i]
          const b = sp[(i + 1) % sp.length]
          if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]))
        }
      xs.sort((u, v) => u - v)
      for (let j = 0; j + 1 < xs.length; j += 2) for (let x = Math.max(0, Math.ceil(xs[j] - 0.5)); x <= Math.min(W - 1, Math.floor(xs[j + 1] - 0.5)); x += 1) g[y * W + x] = 0
    }
  }
  return { width: W, height: H, data: g, glyphFills: chosen.length }
}

// Recognition: the pinned PaddleOCR model through ONNX Runtime (native, 1 thread), PaddleOCR's own preprocessing.
const ort = require('onnxruntime-node')
const dict = JSON.parse(readFileSync(join(MODEL, 'dict.json'), 'utf8')).dict
const modelBytes = readFileSync(join(MODEL, 'inference.onnx'))
const session = await ort.InferenceSession.create(join(MODEL, 'inference.onnx'), { intraOpNumThreads: 1, logSeverityLevel: 3 })
async function recognise(g) {
  const imgH = 48
  const ratio = g.width / g.height
  const imgW = Math.floor(imgH * Math.max(320 / 48, ratio))
  const rw = Math.min(imgW, Math.ceil(imgH * ratio))
  const t = new Float32Array(3 * imgH * imgW)
  for (let y = 0; y < imgH; y += 1)
    for (let x = 0; x < rw; x += 1) {
      const sx = Math.min(g.width - 1, Math.max(0, Math.floor(((x + 0.5) * g.width) / rw)))
      const sy = Math.min(g.height - 1, Math.max(0, Math.floor(((y + 0.5) * g.height) / imgH)))
      const v = (g.data[sy * g.width + sx] / 255 - 0.5) / 0.5
      for (let c = 0; c < 3; c += 1) t[c * imgH * imgW + y * imgW + x] = v
    }
  const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', t, [1, 3, imgH, imgW]) })
  const o = out[session.outputNames[0]]
  const [, T, C] = o.dims
  const classes = ['<blank>', ...dict, ' ']
  let text = ''
  let last = -1
  const kept = []
  for (let s = 0; s < T; s += 1) {
    let best = 0
    for (let c = 1; c < C; c += 1) if (o.data[s * C + c] > o.data[s * C + best]) best = c
    if (best !== 0 && best !== last) {
      text += classes[best]
      kept.push(o.data[s * C + best])
    }
    last = best
  }
  return { text, conf: kept.length ? +(kept.reduce((a, b) => a + b, 0) / kept.length).toFixed(4) : 0 }
}

// The same regions on the same publisher template: the scale bar's label row and the title block's scale cell.
const regions = [
  { name: 'scale-bar-labels', r: { x0: 270, y0: 258, x1: 485, y1: 276 } },
  { name: 'title-block-scale', r: { x0: 495, y0: 92, x1: 540, y1: 108 } },
]
const results = []
for (const { name, r } of regions) {
  const g = rasterRegion(r)
  const rec = g.glyphFills ? await recognise(g) : { text: null, conf: 0 }
  if (arg('crops')) {
    const png = new PNG({ width: g.width, height: g.height, colorType: 0, inputColorType: 0, inputHasAlpha: false })
    png.data = Buffer.from(g.data)
    writeFileSync(join(arg('crops'), `outlined-${name}.png`), PNG.sync.write(png, { colorType: 0, inputColorType: 0, inputHasAlpha: false }))
  }
  results.push({ region: name, boxPt: r, glyphFillsInRegion: g.glyphFills, recognised: rec.text, meanCharP: rec.conf })
}
const out = { sha256: sha, textItemsExtractedByPdfjs: textItems, filledPaths: fills.length, model: { dir: MODEL.split('/').pop(), sha256: createHash('sha256').update(modelBytes).digest('hex') }, node: process.version, results }
console.log(JSON.stringify(out, null, 1))
if (arg('out')) writeFileSync(arg('out'), JSON.stringify(out, null, 1))
