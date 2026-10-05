/**
 * BUILDPLAN-ANALYZER-005G — external recognisers on the bake-off crops (research only).
 *
 * Feeds the crops written by build-dataset.ts to:
 *   - PaddleOCR text-recognition models (official ONNX exports) through ONNX Runtime — `onnxruntime-node` (native CPU)
 *     or `onnxruntime-web` (WebAssembly, single thread), the second being the candidate phone/CI parity runtime;
 *   - Tesseract 5 LSTM through tesseract.js (WebAssembly), single-line mode, digit whitelist.
 *
 * Every model is loaded from a local path whose SHA-256 is checked against MODELS below before use; nothing is
 * downloaded at run time. Output: one JSON per engine with, for every crop, the engine's text, its own confidence,
 * a digit-constrained top-K (Paddle: CTC prefix beam over {blank, 0-9}), and the wall time.
 *
 *   node run-external.mjs --dataset /home/user/work005g/dataset --models /home/user/work005g/models \
 *        --engine paddle:en_PP-OCRv5_mobile_rec_onnx [--backend node|wasm] [--out file.json] [--limit N]
 *   node run-external.mjs --dataset ... --engine tesseract:best_int [--scale 1|3]
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { PNG } from 'pngjs'

const require = createRequire(import.meta.url)
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const DATASET = arg('dataset', '/home/user/work005g/dataset')
const MODELS = arg('models', '/home/user/work005g/models')
const ENGINE = arg('engine', 'paddle:en_PP-OCRv5_mobile_rec_onnx')
const BACKEND = arg('backend', 'node')
const SCALE = Number(arg('scale', '1'))
const LIMIT = Number(arg('limit', '0'))
const SET = arg('set')
/** Optional comma-separated splits (REAL labels only), e.g. BLIND_R5,BLIND_R6,TARGET. */
const SPLITS = arg('splits')
/** A small preprocessing perturbation (the stability bracket): pad2 = 2 px more paper, trim1 = 1 px less, scale90 = 90 %. */
const VARIANT = arg('variant', 'none')
const OUT = arg('out', join(DATASET, `out-${ENGINE.replace(/[:/]/g, '_')}-${BACKEND}${SCALE !== 1 ? `-x${SCALE}` : ''}${VARIANT !== 'none' ? `-${VARIANT}` : ''}.json`))

/** Pinned model artefacts (Hugging Face `PaddlePaddle/<repo>`, file `inference.onnx`, LFS SHA-256). */
export const MODELS_PINNED = {
  'en_PP-OCRv5_mobile_rec_onnx': 'b5f833dfc5d0eb71da397b4efa06ebeee9b431b690a47d6af40d77d8eabc557f',
  'latin_PP-OCRv5_mobile_rec_onnx': '7888113072263cb471b93f66dd5e2ad70548dc526fa1ace760d0d973dd121498',
  'PP-OCRv5_mobile_rec_onnx': 'da72dc72ca4dc220df0dfde68c1dedc31c58d3e76a25871122e5056227d50092',
  'PP-OCRv6_tiny_rec_onnx': '9ef676d6ed3c88256a2d92c640c44f25b0c40947e111b14b8be8f594091563e6',
  'PP-OCRv6_small_rec_onnx': '5435fd747c9e0efe15a96d0b378d5bd157e9492ed8fd80edf08f30d02fa24634',
  'PP-OCRv6_medium_rec_onnx': '9c09abf0957f7968c7586464b7397b84ad2387a0497a351af40e9acc71b673ba',
}

const dataset = JSON.parse(readFileSync(join(DATASET, 'labels.json'), 'utf8'))
let records = dataset.records.filter((r) => r.printed && (!SET || r.set === SET) && (!SPLITS || SPLITS.split(',').includes(r.split)))
if (LIMIT > 0) records = records.slice(0, LIMIT)

/** A package's version without importing its package.json (onnxruntime-web does not export it). */
const pkgVersion = (name) => {
  let dir = dirname(require.resolve(name))
  while (!dir.endsWith(name)) dir = dirname(dir)
  return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version
}

const readGray = (file) => {
  const png = PNG.sync.read(readFileSync(join(DATASET, 'crops', file)))
  const g = new Uint8Array(png.width * png.height)
  for (let i = 0; i < g.length; i += 1) g[i] = png.data[i * 4]
  return perturb({ width: png.width, height: png.height, data: g })
}

function perturb(g) {
  if (VARIANT === 'pad2') {
    const W = g.width + 4
    const H = g.height + 4
    const d = new Uint8Array(W * H).fill(255)
    for (let y = 0; y < g.height; y += 1) for (let x = 0; x < g.width; x += 1) d[(y + 2) * W + x + 2] = g.data[y * g.width + x]
    return { width: W, height: H, data: d }
  }
  if (VARIANT === 'trim1') {
    const W = g.width - 2
    const H = g.height - 2
    const d = new Uint8Array(W * H)
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) d[y * W + x] = g.data[(y + 1) * g.width + x + 1]
    return { width: W, height: H, data: d }
  }
  if (VARIANT === 'scale90') {
    const W = Math.max(4, Math.round(g.width * 0.9))
    const H = Math.max(4, Math.round(g.height * 0.9))
    const f = resizeBilinear(g, W, H)
    return { width: W, height: H, data: Uint8Array.from(f, (v) => Math.round(v)) }
  }
  return g
}

/** Bilinear resize with half-pixel centres (OpenCV INTER_LINEAR's mapping, in floating point). */
function resizeBilinear(src, W, H) {
  const out = new Float32Array(W * H)
  const sx = src.width / W
  const sy = src.height / H
  for (let y = 0; y < H; y += 1) {
    let fy = (y + 0.5) * sy - 0.5
    if (fy < 0) fy = 0
    const y0 = Math.min(src.height - 1, Math.floor(fy))
    const y1 = Math.min(src.height - 1, y0 + 1)
    const wy = Math.min(1, fy - y0)
    for (let x = 0; x < W; x += 1) {
      let fx = (x + 0.5) * sx - 0.5
      if (fx < 0) fx = 0
      const x0 = Math.min(src.width - 1, Math.floor(fx))
      const x1 = Math.min(src.width - 1, x0 + 1)
      const wx = Math.min(1, fx - x0)
      const a = src.data[y0 * src.width + x0]
      const b = src.data[y0 * src.width + x1]
      const c = src.data[y1 * src.width + x0]
      const d = src.data[y1 * src.width + x1]
      out[y * W + x] = (a * (1 - wx) + b * wx) * (1 - wy) + (c * (1 - wx) + d * wx) * wy
    }
  }
  return out
}

/** PaddleOCR `resize_norm_img` for a batch of one: height 48, width ≥ 320 (padded with 0 after normalisation). */
function paddleTensor(gray) {
  const imgH = 48
  const ratio = gray.width / gray.height
  const imgW = Math.floor(imgH * Math.max(320 / 48, ratio))
  const rw = Math.min(imgW, Math.ceil(imgH * ratio))
  const resized = resizeBilinear(gray, rw, imgH)
  const t = new Float32Array(3 * imgH * imgW)
  for (let c = 0; c < 3; c += 1)
    for (let y = 0; y < imgH; y += 1)
      for (let x = 0; x < rw; x += 1) t[c * imgH * imgW + y * imgW + x] = (Math.round(resized[y * rw + x]) / 255 - 0.5) / 0.5
  return { data: t, dims: [1, 3, imgH, imgW] }
}

const logsumexp = (a, b) => (a === -Infinity ? b : b === -Infinity ? a : Math.max(a, b) + Math.log1p(Math.exp(-Math.abs(a - b))))

/**
 * CTC prefix beam search over a restricted alphabet (indices into the model's classes), probabilities renormalised
 * per frame over {blank} ∪ alphabet. Returns the top-K label sequences with their posterior among the beam.
 */
function prefixBeam(probs, T, C, allowed, beam = 24, topK = 5) {
  let beams = new Map([['', { b: 0, nb: -Infinity }]])
  for (let t = 0; t < T; t += 1) {
    const row = probs.subarray(t * C, (t + 1) * C)
    let z = row[0]
    for (const k of allowed) z += row[k]
    const lp = (k) => Math.log(Math.max(1e-30, row[k] / z))
    const next = new Map()
    const add = (key, b, nb) => {
      const e = next.get(key) ?? { b: -Infinity, nb: -Infinity }
      e.b = logsumexp(e.b, b)
      e.nb = logsumexp(e.nb, nb)
      next.set(key, e)
    }
    for (const [prefix, { b, nb }] of beams) {
      const total = logsumexp(b, nb)
      add(prefix, total + lp(0), -Infinity)
      const last = prefix.length ? prefix[prefix.length - 1] : null
      for (const k of allowed) {
        const ch = allowed.charOf.get(k)
        const p = lp(k)
        if (ch === last) {
          add(prefix, -Infinity, nb + p)
          add(prefix + ch, -Infinity, b + p)
        } else add(prefix + ch, -Infinity, total + p)
      }
    }
    beams = new Map([...next.entries()].sort((x, y) => logsumexp(y[1].b, y[1].nb) - logsumexp(x[1].b, x[1].nb)).slice(0, beam))
  }
  const scored = [...beams.entries()].map(([t, { b, nb }]) => ({ t, lp: logsumexp(b, nb) })).filter((s) => s.t.length > 0)
  const norm = scored.reduce((a, s) => logsumexp(a, s.lp), -Infinity)
  return scored
    .sort((a, b) => b.lp - a.lp)
    .slice(0, topK)
    .map((s) => ({ t: s.t, p: Number(Math.exp(s.lp - norm).toFixed(6)), seqP: Number(Math.exp(s.lp).toExponential(4)) }))
}

async function runPaddle(modelKey) {
  const path = join(MODELS, modelKey, 'inference.onnx')
  const bytes = readFileSync(path)
  const sha = createHash('sha256').update(bytes).digest('hex')
  if (MODELS_PINNED[modelKey] !== sha) throw new Error(`model hash mismatch for ${modelKey}: ${sha}`)
  const dict = JSON.parse(readFileSync(join(MODELS, modelKey, 'dict.json'), 'utf8')).dict
  const ort = BACKEND === 'wasm' ? require('onnxruntime-web') : require('onnxruntime-node')
  if (BACKEND === 'wasm') {
    ort.env.wasm.numThreads = 1
    ort.env.wasm.simd = true
  }
  const mem0 = process.memoryUsage().rss
  const tLoad = performance.now()
  const session = await ort.InferenceSession.create(BACKEND === 'wasm' ? new Uint8Array(bytes) : path, {
    executionProviders: [BACKEND === 'wasm' ? 'wasm' : 'cpu'],
    intraOpNumThreads: 1,
    interOpNumThreads: 1,
    graphOptimizationLevel: 'all',
    logSeverityLevel: 3,
  })
  const loadMs = performance.now() - tLoad
  const inputName = session.inputNames[0]
  const outputName = session.outputNames[0]
  // classes = blank + dict + space (use_space_char)
  const classes = ['<blank>', ...dict, ' ']
  const allowed = []
  allowed.charOf = new Map()
  for (const d of '0123456789') {
    const k = classes.indexOf(d)
    allowed.push(k)
    allowed.charOf.set(k, d)
  }
  const out = []
  let peak = process.memoryUsage().rss
  for (const r of records) {
    const gray = readGray(r.crop.file)
    const t0 = performance.now()
    const { data, dims } = paddleTensor(gray)
    const res = await session.run({ [inputName]: new ort.Tensor('float32', data, dims) })
    const o = res[outputName]
    const [, T, C] = o.dims
    if (C !== classes.length) throw new Error(`classes ${C} != dict ${classes.length}`)
    const probs = o.data
    // Greedy (the engine's own answer): argmax, collapse repeats, drop blanks; confidence = mean max prob of kept frames.
    let text = ''
    let last = -1
    const kept = []
    for (let t = 0; t < T; t += 1) {
      let best = 0
      for (let k = 1; k < C; k += 1) if (probs[t * C + k] > probs[t * C + best]) best = k
      if (best !== 0 && best !== last) {
        text += classes[best]
        kept.push(probs[t * C + best])
      }
      last = best
    }
    const conf = kept.length ? kept.reduce((a, b) => a + b, 0) / kept.length : 0
    const top = prefixBeam(probs, T, C, allowed)
    const ms = performance.now() - t0
    peak = Math.max(peak, process.memoryUsage().rss)
    out.push({ id: r.id, text, conf: Number(conf.toFixed(6)), minCharP: Number((kept.length ? Math.min(...kept) : 0).toFixed(6)), top, ms: Number(ms.toFixed(2)) })
  }
  return { engine: `paddle:${modelKey}`, backend: BACKEND, runtime: `${BACKEND === 'wasm' ? 'onnxruntime-web' : 'onnxruntime-node'}@${pkgVersion(BACKEND === 'wasm' ? 'onnxruntime-web' : 'onnxruntime-node')}`, node: process.version, modelSha256: sha, modelBytes: bytes.length, loadMs: Number(loadMs.toFixed(1)), rssBeforeMiB: Number((mem0 / 2 ** 20).toFixed(1)), rssPeakMiB: Number((peak / 2 ** 20).toFixed(1)), results: out }
}

async function runTesseract(variant) {
  const { createWorker, OEM } = require('tesseract.js')
  const langDir = require.resolve('@tesseract.js-data/eng/package.json').replace(/package\.json$/, variant === 'best_int' ? '4.0.0_best_int' : '4.0.0')
  const trained = join(langDir, 'eng.traineddata.gz')
  const sha = createHash('sha256').update(readFileSync(trained)).digest('hex')
  const mem0 = process.memoryUsage().rss
  const tLoad = performance.now()
  const worker = await createWorker('eng', OEM.LSTM_ONLY, { langPath: langDir, cacheMethod: 'none', gzip: true })
  await worker.setParameters({ tessedit_pageseg_mode: '7', tessedit_char_whitelist: '0123456789', user_defined_dpi: '300' })
  const loadMs = performance.now() - tLoad
  const out = []
  let peak = process.memoryUsage().rss
  for (const r of records) {
    const g = readGray(r.crop.file)
    // Optional upscale (Tesseract wants x-heights well above these labels'); bilinear, same mapping as Paddle's.
    const W = Math.round(g.width * SCALE)
    const H = Math.round(g.height * SCALE)
    const up = SCALE === 1 ? Float32Array.from(g.data) : resizeBilinear(g, W, H)
    const png = new PNG({ width: W, height: H })
    for (let i = 0; i < W * H; i += 1) {
      const v = Math.max(0, Math.min(255, Math.round(up[i])))
      png.data[i * 4] = v
      png.data[i * 4 + 1] = v
      png.data[i * 4 + 2] = v
      png.data[i * 4 + 3] = 255
    }
    const t0 = performance.now()
    const { data } = await worker.recognize(PNG.sync.write(png), {}, { text: true, blocks: true })
    const ms = performance.now() - t0
    const text = (data.text ?? '').replace(/\s+/g, '')
    // Per-symbol LSTM choices, when the engine reports them, give a top-K over substitutions (product of choices).
    const symbols = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words.flatMap((w) => w.symbols))))
    const alts = symbols.map((s) => (s.choices?.length ? s.choices : [{ text: s.text, confidence: s.confidence }]).map((c) => ({ c: c.text, p: Math.max(1e-6, c.confidence / 100) })))
    let seqs = [{ t: '', p: 1 }]
    for (const a of alts) seqs = seqs.flatMap((s) => a.map((c) => ({ t: s.t + c.c, p: s.p * c.p }))).sort((x, y) => y.p - x.p).slice(0, 16)
    const z = seqs.reduce((a, s) => a + s.p, 0) || 1
    peak = Math.max(peak, process.memoryUsage().rss)
    out.push({ id: r.id, text, conf: Number(((data.confidence ?? 0) / 100).toFixed(4)), top: seqs.filter((s) => s.t).slice(0, 5).map((s) => ({ t: s.t, p: Number((s.p / z).toFixed(6)) })), ms: Number(ms.toFixed(2)) })
  }
  await worker.terminate()
  return { engine: `tesseract:${variant}`, scale: SCALE, runtime: `tesseract.js@${pkgVersion('tesseract.js')} / tesseract.js-core@${pkgVersion('tesseract.js-core')}`, node: process.version, modelSha256: sha, loadMs: Number(loadMs.toFixed(1)), rssBeforeMiB: Number((mem0 / 2 ** 20).toFixed(1)), rssPeakMiB: Number((peak / 2 ** 20).toFixed(1)), results: out }
}

const [kind, key] = ENGINE.split(':')
const t0 = performance.now()
const result = kind === 'paddle' ? await runPaddle(key) : await runTesseract(key ?? 'best_int')
result.totalMs = Number((performance.now() - t0).toFixed(0))
result.count = result.results.length
writeFileSync(OUT, JSON.stringify(result))
const right = result.results.filter((x, i) => x.text === records[i].printed).length
console.log(ENGINE, BACKEND, `x${SCALE}`, 'n', result.count, 'greedy exact', right, 'load ms', result.loadMs, 'mean ms', (result.results.reduce((a, x) => a + x.ms, 0) / result.count).toFixed(1), 'rss peak MiB', result.rssPeakMiB)
