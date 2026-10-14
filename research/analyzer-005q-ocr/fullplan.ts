/**
 * fullplan.ts — BUILDPLAN-ANALYZER-005Q-OCR contender harness (RESEARCH ONLY; never imported by production).
 *
 *   npx vite-node research/analyzer-005q-ocr/fullplan.ts -- --corpus research/analyzer-005q-ocr/corpus.json \
 *       --work /home/user/work005q-ocr --stage manifest|contenders [--only S5] [--scale 1|2]
 *
 * Read-only over the sealed development evidence. Writes JSON with boxes, numbers and texts only, and only under --work
 * (a path inside the repository is refused). No pixel, crop or page leaves the process.
 *
 *   manifest    per sheet: the sealed metric evidence, the variant bytes' SHA-256 and file, the page size, and the
 *               B0 proposal set as sealed (numericLattices of the frame).
 *   contenders  per sheet, on the same decoded raster:
 *     B0  the incumbent: classic token discovery (`readNumbers`, frozen) → the sealed numeric lattice set → the sealed
 *         PP-OCRv6 crop readings and ensemble decisions. Re-derived here only to verify that the frozen code proposes
 *         exactly the sealed boxes on these bytes.
 *     B1  independent discovery: the pinned PP-OCRv6 tiny DETECTOR (DB) on the full-resolution page in overlapping
 *         tiles (never downscaled), boxes de-duplicated across tile borders, each box read by the SAME deployed PP-OCRv6
 *         tiny recogniser (`inlineRecogniser`, pinned model and WASM, the same four-variant stability bracket) on the
 *         upright crop cut from the very pass field production cuts from (`labelCrop`). Both quarter turns are read for
 *         a tall box and both half turns for a wide one; every reading is kept.
 *   Shared, frozen line geometry: `findDimensionLines` → `dimensionChainsOf` on the same raster (production code), and
 *   every straight run with ≥ 2 crossing marks (`findStraightRuns`) for the scorer's adjacency test.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import * as ort from 'onnxruntime-web'
import { decodeImage } from '@buildapp/source-package'
import { adaptiveInkMask, inkChannel } from '@buildapp/source-cv'
import { dimensionChainsOf, findDimensionLines, findStraightRuns, labelCrop, readNumbers } from '@buildapp/source-metrics'
import type { ExternalReading, LabelCrop, MetricEvidenceSet, TextToken } from '@buildapp/source-metrics'
import { inlineRecogniser, workspaceAssetPaths } from '@buildapp/numeric-recogniser-ort'
import { dedupe, passRectOfPage } from './geometry.ts'
import type { Box, DetBox } from './geometry.ts'

const REPO = resolve(import.meta.dirname, '../..')
const arg = (n: string, f?: string): string | undefined => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : f
}
const W = resolve(arg('work', '/home/user/work005q-ocr')!)
if (W === REPO || W.startsWith(REPO + '/')) throw new Error(`--work ${W} is inside the repository: refused`)
const stage = arg('stage', 'contenders')
const only = (arg('only', '') ?? '').split(',').filter(Boolean)
const SCALE = Number(arg('scale', '1'))
const sha = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex')
const out = (rel: string, v: unknown): void => {
  const p = join(W, rel)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, `${JSON.stringify(v, null, 1)}\n`)
}

type Sheet = { id: string; case: string; family: string; role: string; frameId: string; variantByteHash: string; lineage: string; smoke?: boolean }
const corpus: { sheets: Sheet[] } = JSON.parse(readFileSync(resolve(REPO, arg('corpus', 'research/analyzer-005q-ocr/corpus.json')!), 'utf8'))
const cases: Record<string, { metrics: string }> = Object.fromEntries(
  (JSON.parse(readFileSync(resolve(REPO, 'research/analyzer-005o/cases.json'), 'utf8')).cases as Array<{ case: string; metrics: string }>).map((c) => [c.case, c]),
)
const byteIndex: Record<string, string> = JSON.parse(readFileSync('/home/user/work005o/byte-index.json', 'utf8'))
const sheets = corpus.sheets.filter((s) => only.length === 0 || only.includes(s.id))

type Orientation = TextToken['orientation']
const round = (v: number, d = 3): number => Number(v.toFixed(d))

function sealedFor(s: Sheet): { m: MetricEvidenceSet; hash: string; path: string } {
  const m: MetricEvidenceSet = JSON.parse(readFileSync(cases[s.case].metrics, 'utf8'))
  const hashes = new Set(m.ocrTokens.filter((t) => t.frameId === s.frameId).map((t) => t.variantByteHash))
  const full = [...hashes].filter((h) => h.startsWith(s.variantByteHash))
  if (full.length !== 1) throw new Error(`${s.id}: ${full.length} sealed variants match ${s.variantByteHash}`)
  const path = byteIndex[full[0]]
  if (!path) throw new Error(`${s.id}: no cached bytes for ${full[0]}`)
  return { m, hash: full[0], path }
}

// ---------------------------------------------------------------- B1: the DB text detector, full resolution, tiled
const DET = { file: '/home/user/work005q-ocr/models/det-tiny/inference.onnx', sha256: '193bab7a04fca699a6c82e6abb5b81bdb28177f0abd4062552b04908dafb19f8', repo: 'PaddlePaddle/PP-OCRv6_tiny_det_onnx', revision: '2ba1506c0380b8f0b03dd142459aac66d4421f6c' }
/** Frozen before any contender ran (preregistration §3): the model card's DBPostProcess values, tiles of 640 px with 160 px of overlap. */
export const DB = { thresh: 0.2, boxThresh: 0.4, unclipRatio: 1.4, tile: 640, overlap: 160, minSide: 3 } as const
const MEAN = [0.485, 0.456, 0.406]
const STD = [0.229, 0.224, 0.225]

let detSession: ort.InferenceSession | undefined
async function detector(): Promise<ort.InferenceSession> {
  if (detSession) return detSession
  const bytes = new Uint8Array(readFileSync(DET.file))
  if (sha(bytes) !== DET.sha256) throw new Error('the detector bytes are not the pinned ones: refused')
  const req = createRequire(import.meta.url)
  ort.env.wasm.numThreads = 1
  ort.env.wasm.proxy = false
  ort.env.wasm.wasmBinary = new Uint8Array(readFileSync(req.resolve('onnxruntime-web/ort-wasm-simd-threaded.wasm')))
  ort.env.wasm.wasmPaths = { mjs: pathToFileURL(req.resolve('onnxruntime-web/ort-wasm-simd-threaded.mjs')).href }
  ort.env.logLevel = 'error'
  detSession = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all', intraOpNumThreads: 1, interOpNumThreads: 1, logSeverityLevel: 3 })
  return detSession
}

/** Bilinear sample of the RGBA raster at page coordinates (scale ≥ 1 only: never a downscale). */
function tileTensor(r: { width: number; height: number; data: Uint8ClampedArray }, x0: number, y0: number, w: number, h: number, scale: number): Float32Array {
  const t = new Float32Array(3 * w * h)
  for (let y = 0; y < h; y += 1) {
    const fy = Math.min(r.height - 1, Math.max(0, (y0 + y + 0.5) / scale - 0.5))
    const ya = Math.floor(fy), yb = Math.min(r.height - 1, ya + 1), wy = fy - ya
    for (let x = 0; x < w; x += 1) {
      const fx = Math.min(r.width - 1, Math.max(0, (x0 + x + 0.5) / scale - 0.5))
      const xa = Math.floor(fx), xb = Math.min(r.width - 1, xa + 1), wx = fx - xa
      const inside = (y0 + y) / scale < r.height && (x0 + x) / scale < r.width
      for (let c = 0; c < 3; c += 1) {
        // BGR order (the model card's DecodeImage img_mode BGR); padding outside the page is white paper
        const ch = 2 - c
        const v = inside
          ? (r.data[(ya * r.width + xa) * 4 + ch] * (1 - wx) + r.data[(ya * r.width + xb) * 4 + ch] * wx) * (1 - wy) + (r.data[(yb * r.width + xa) * 4 + ch] * (1 - wx) + r.data[(yb * r.width + xb) * 4 + ch] * wx) * wy
          : 255
        t[c * w * h + y * w + x] = (v / 255 - MEAN[c]) / STD[c]
      }
    }
  }
  return t
}

async function detect(r: { width: number; height: number; data: Uint8ClampedArray }, scale: number): Promise<{ boxes: DetBox[]; tiles: number; ms: number }> {
  const s = await detector()
  const t0 = performance.now()
  const SW = Math.ceil(r.width * scale), SH = Math.ceil(r.height * scale)
  const step = DB.tile - DB.overlap
  const starts = (n: number): number[] => {
    if (n <= DB.tile) return [0]
    const xs: number[] = []
    for (let x = 0; x + DB.tile < n; x += step) xs.push(x)
    xs.push(n - DB.tile)
    return [...new Set(xs)]
  }
  const all: DetBox[] = []
  let tiles = 0
  for (const ty of starts(SH)) {
    for (const tx of starts(SW)) {
      const w = Math.ceil(Math.min(DB.tile, SW) / 32) * 32
      const h = Math.ceil(Math.min(DB.tile, SH) / 32) * 32
      const input = tileTensor(r, tx, ty, w, h, scale)
      const res = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, h, w]) })
      const prob = res[s.outputNames[0]].data as Float32Array
      tiles += 1
      // DBPostProcess with axis-aligned boxes: 4-connected components of prob > thresh, the component's mean
      // probability as its score, the box unclipped by area·ratio/perimeter (the polygon offset, for a rectangle).
      const seen = new Uint8Array(w * h)
      const stack: number[] = []
      for (let i = 0; i < w * h; i += 1) {
        if (seen[i] || prob[i] <= DB.thresh) continue
        let x0 = w, x1 = -1, y0 = h, y1 = -1, sum = 0, n = 0
        stack.push(i)
        seen[i] = 1
        while (stack.length) {
          const j = stack.pop()!
          const x = j % w, y = (j - x) / w
          sum += prob[j]
          n += 1
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          if (y > y1) y1 = y
          for (const k of [j - 1, j + 1, j - w, j + w]) {
            if (k < 0 || k >= w * h || seen[k] || prob[k] <= DB.thresh) continue
            if ((k === j - 1 && x === 0) || (k === j + 1 && x === w - 1)) continue
            seen[k] = 1
            stack.push(k)
          }
        }
        const bw = x1 - x0 + 1, bh = y1 - y0 + 1
        if (Math.min(bw, bh) < DB.minSide * scale) continue
        const score = sum / n
        if (score < DB.boxThresh) continue
        const d = (bw * bh * DB.unclipRatio) / (2 * (bw + bh))
        const toPage = (v: number, o: number): number => round((v + o) / scale, 2)
        const raw = { x0: toPage(x0, tx), x1: toPage(x1 + 1, tx), y0: toPage(y0, ty), y1: toPage(y1 + 1, ty) }
        const box = {
          x0: Math.max(0, toPage(x0 - d, tx)), x1: Math.min(r.width, toPage(x1 + 1 + d, tx)),
          y0: Math.max(0, toPage(y0 - d, ty)), y1: Math.min(r.height, toPage(y1 + 1 + d, ty)),
        }
        // a component cut by an interior tile border is left to the neighbouring tile that holds it whole
        const cutL = x0 === 0 && tx > 0, cutR = x1 === w - 1 && tx + w < SW, cutT = y0 === 0 && ty > 0, cutB = y1 === h - 1 && ty + h < SH
        all.push({ ...box, score: round(score, 4), tile: tiles - 1, raw, ...(cutL || cutR || cutT || cutB ? { cut: true } : {}) } as DetBox)
      }
    }
  }
  return { boxes: dedupe(all), tiles, ms: Math.round(performance.now() - t0) }
}

// ---------------------------------------------------------------- per sheet
type ChainOut = { id: string; axis: string; baselinePx: number; ticks: Array<{ atPx: number; class?: string }> }
const chainOut = (c: { axis: string; baselinePx: number; ticks: Array<{ atPx: number; class?: string }> }, i: number): ChainOut => ({ id: `L${i}`, axis: c.axis, baselinePx: c.baselinePx, ticks: c.ticks.map((t) => ({ atPx: t.atPx, ...(t.class ? { class: t.class } : {}) })) })

async function run(): Promise<void> {
  const recogniser = stage === 'contenders' ? inlineRecogniser({ paths: workspaceAssetPaths() }) : undefined
  const perf: Array<Record<string, unknown>> = []
  for (const s of sheets) {
    const { m, hash, path } = sealedFor(s)
    const bytes = new Uint8Array(readFileSync(path))
    if (sha(bytes) !== hash) throw new Error(`${s.id}: cached bytes are not the sealed variant`)
    const raster = decodeImage(bytes)
    const page = { width: raster.width, height: raster.height }
    const sealedLattices = (m.numericLattices ?? []).filter((l) => l.frameId === s.frameId)
    if (stage === 'manifest') {
      out(`manifest/${s.id}.json`, { ...s, variantByteHash: hash, bytesFile: path, bytesSha256: sha(bytes), page, metrics: cases[s.case].metrics, metricsSha256: sha(new Uint8Array(readFileSync(cases[s.case].metrics))), sealedLattices: sealedLattices.length })
      process.stdout.write(`${s.id} ${s.case} ${page.width}x${page.height} lattices ${sealedLattices.length}\n`)
      continue
    }
    const t0 = performance.now()
    const read = readNumbers(raster, { hypotheses: true, retainPasses: true })
    const tRead = performance.now() - t0
    const grey = inkChannel(raster)
    const mask = adaptiveInkMask(grey, {})
    const { allChains } = dimensionChainsOf(findDimensionLines(mask, { raster, grey }), read.raw ?? read.tokens, mask)
    const runs = findStraightRuns(mask, { raster, grey }).filter((l) => l.ticksPx.length >= 2)
    // B0, verified: the frozen selection (raw token with 2–6 glyphs on a chain) must give exactly the sealed boxes
    const k = (b: Box, o: string): string => [b.x0, b.x1, b.y0, b.y1, o].join('|')
    const sealedKeys = new Set(sealedLattices.map((l) => k(l.box, l.orientation)))
    const rawKeys = new Set((read.raw ?? []).map((t) => k(t.box, t.orientation)))
    const b0Reproduced = sealedLattices.every((l) => rawKeys.has(k(l.box, l.orientation)))
    const b0 = sealedLattices.map((l) => {
      const e = l.external as ExternalReading | undefined
      return {
        box: l.box, orientation: l.orientation, latticeAsRead: l.asRead ?? null, latticeClass: (l as { ocrClass?: string }).ocrClass ?? null,
        external: e ? { top: e.topK[0]?.text ?? '', p: e.topK[0]?.p ?? 0, greedy: e.greedy, stable: e.stable, variants: e.variants.map((v) => v.top) } : null,
        ensemble: l.ensemble ? { decision: (l.ensemble as { decision?: string }).decision ?? null, asRead: (l.ensemble as { asRead?: string }).asRead ?? null } : null,
      }
    })
    const classic = (read.raw ?? []).map((t) => ({ box: t.box, orientation: t.orientation, text: t.text, glyphs: t.glyphs.length, height: t.height, kept: read.tokens.includes(t) }))
    // B1
    const d = await detect(raster, SCALE)
    const crops: LabelCrop[] = []
    const hyp: Array<{ box: number; orientation: Orientation; key: string }> = []
    d.boxes.forEach((b, i) => {
      const wide = b.x1 - b.x0 >= b.y1 - b.y0
      for (const o of (wide ? ['HORIZONTAL', 'INVERTED'] : ['ROTATED_CW', 'ROTATED_CCW']) as Orientation[]) {
        const field = read.passes?.[o]
        if (!field) continue
        const key = `b${crops.length}`
        crops.push(labelCrop(key, field, passRectOfPage(b, o, page)))
        hyp.push({ box: i, orientation: o, key })
      }
    })
    const t1 = performance.now()
    const readings = crops.length ? await recogniser!.recognise(crops) : []
    const tRec = performance.now() - t1
    const byKey = new Map(readings.map((r) => [r.key, r]))
    const b1 = d.boxes.map((b, i) => ({
      ...b,
      reads: hyp.filter((h) => h.box === i).map((h) => {
        const r = byKey.get(h.key)
        return { orientation: h.orientation, top: r?.topK[0]?.text ?? '', p: r?.topK[0]?.p ?? 0, topK: r?.topK.slice(0, 3) ?? [], greedy: r?.greedy ?? { text: '', meanP: 0 }, stable: r?.stable ?? false, variants: r?.variants.map((v) => v.top) ?? [] }
      }),
    }))
    out(`contenders/${s.id}.json`, {
      schema: 'buildapp.005q-ocr.contenders', sheet: s.id, case: s.case, frameId: s.frameId, variantByteHash: hash, page, detectorScale: SCALE,
      detector: { ...DET, file: undefined, params: DB }, recogniser: { id: recogniser!.id, model: recogniser!.model, runtime: recogniser!.runtime, runtimeSha256: recogniser!.runtimeSha256 },
      b0Reproduced, b0SealedKeysOnRaw: [...sealedKeys].filter((x) => rawKeys.has(x)).length,
      b0, classic, b1, chains: allChains.map(chainOut), runs: runs.map((l, i) => ({ id: `R${i}`, axis: l.axis, baselinePx: l.baselinePx, fromPx: l.fromPx, toPx: l.toPx, fill: round(l.fill), ticks: l.ticksPx.map((atPx) => ({ atPx })) })),
    })
    const row = { sheet: s.id, page: `${page.width}x${page.height}`, readNumbersMs: Math.round(tRead), detectorTiles: d.tiles, detectorMs: d.ms, b1Boxes: d.boxes.length, b1Crops: crops.length, recogniseMs: Math.round(tRec), perCropMs: crops.length ? round(tRec / crops.length, 1) : 0, rssMb: Math.round(process.memoryUsage().rss / 1e6), b0Reproduced, b0: b0.length }
    perf.push(row)
    process.stdout.write(`${JSON.stringify(row)}\n`)
  }
  if (stage === 'contenders') out(`perf-contenders-x${SCALE}${only.length ? '-' + only.join('_') : ''}.json`, { node: process.version, perf })
  await recogniser?.release?.()
}

if (!existsSync(DET.file)) throw new Error(`the detector is not at ${DET.file}: NOT_RUN_DETECTOR_UNAVAILABLE`)
await run()
