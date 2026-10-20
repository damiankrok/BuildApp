/**
 * 005X-N3 (Phase B, RESEARCH ONLY — never imported by production): what a licence-cleared, off-the-shelf semantic
 * segmenter says about one photograph, offline. Model: DETR ResNet-50 panoptic (facebook/detr-resnet-50-panoptic,
 * Apache-2.0), ONNX export Xenova/detr-resnet-50-panoptic `onnx/model_quantized.onnx`, pinned by SHA-256 below, run on
 * the repository's own onnxruntime-web (WebAssembly, one thread). The model file stays OUTSIDE the repository.
 *
 * Output (outside the repository): a per-pixel class map grouped into SKY / VEGETATION / TERRAIN / ROOF / FACADE /
 * OPENING / OTHER / NONE as a PNG and the shares and timings as JSON. No pixel of the photograph is written.
 *
 *   npx vite-node research/analyzer-005x-n3-cross-provider/segment-probe.ts -- <modelDir> <picture> <outDir> [shortEdge=480]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { PNG } from 'pngjs'
import * as ort from 'onnxruntime-web'
import { decodeImage } from '@buildapp/source-package'

const MODEL_SHA256 = '93abfec8b8abd77329f203726b231ee5e5d4c2d52c881a74ab1c1134d888c41d'
export const GROUPS: Record<string, readonly string[]> = {
  SKY: ['sky-other', 'clouds', 'sky'],
  VEGETATION: ['tree', 'bush', 'grass', 'plant-other', 'potted plant', 'flower', 'leaves', 'moss', 'straw', 'branch'],
  TERRAIN: ['mountain', 'hill', 'dirt', 'sand', 'gravel', 'road', 'pavement', 'playingfield', 'ground-other', 'snow', 'water-other', 'river', 'sea', 'rock', 'stone', 'mud', 'railroad', 'platform', 'fog'],
  ROOF: ['roof'],
  FACADE: ['house', 'building-other', 'wall-brick', 'wall-concrete', 'wall-other', 'wall-panel', 'wall-stone', 'wall-tile', 'wall-wood', 'skyscraper', 'bridge', 'tent'],
  OPENING: ['window', 'window-blind', 'window-other', 'door', 'door-stuff'],
}
const COLOURS: Record<string, [number, number, number]> = { SKY: [120, 180, 255], VEGETATION: [40, 160, 60], TERRAIN: [150, 120, 80], ROOF: [200, 40, 40], FACADE: [240, 220, 120], OPENING: [60, 60, 200], OTHER: [200, 0, 200], NONE: [0, 0, 0] }

const [modelDir, picture, outDir, shortArg] = process.argv.slice(2)
if (!modelDir || !picture || !outDir) throw new Error('usage: segment-probe.ts <modelDir> <picture> <outDir> [shortEdge]')
const REPO = resolve(import.meta.dirname, '../..')
const out = resolve(outDir)
if (out === REPO || out.startsWith(`${REPO}/`)) throw new Error('REFUSED: outputs never go inside the repository')
mkdirSync(out, { recursive: true })
const modelBytes = new Uint8Array(readFileSync(join(modelDir, 'model_quantized.onnx')))
if (createHash('sha256').update(modelBytes).digest('hex') !== MODEL_SHA256) throw new Error('REFUSED: model bytes are not the pinned file')
// The export names the COCO-panoptic "merged" stuff classes only by id (LABEL_184…); their names are COCO's own.
const MERGED: Record<string, string> = { '184': 'tree', '185': 'fence', '186': 'ceiling', '187': 'sky-other', '188': 'cabinet', '189': 'table', '190': 'floor-other', '191': 'pavement', '192': 'mountain', '193': 'grass', '194': 'dirt', '195': 'paper', '196': 'food-other', '197': 'building-other', '198': 'rock', '199': 'wall-other', '200': 'rug' }
const id2label: Record<string, string> = { ...JSON.parse(readFileSync(join(modelDir, 'config.json'), 'utf8')).id2label, ...MERGED }
const groupOf = (label: string | undefined): string => (label === undefined ? 'NONE' : (Object.entries(GROUPS).find(([, ls]) => ls.includes(label))?.[0] ?? 'OTHER'))

const raster = decodeImage(new Uint8Array(readFileSync(picture)))
const short = Number(shortArg ?? 480)
const s = short / Math.min(raster.width, raster.height)
const W = Math.round(raster.width * s)
const H = Math.round(raster.height * s)
// Bilinear resize to the network's input, ImageNet normalisation, NCHW.
const mean = [0.485, 0.456, 0.406]
const std = [0.229, 0.224, 0.225]
const input = new Float32Array(3 * W * H)
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const sx = Math.min(raster.width - 1, Math.max(0, (x + 0.5) / s - 0.5))
    const sy = Math.min(raster.height - 1, Math.max(0, (y + 0.5) / s - 0.5))
    const x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(raster.width - 1, x0 + 1), y1 = Math.min(raster.height - 1, y0 + 1)
    const fx = sx - x0, fy = sy - y0
    for (let c = 0; c < 3; c++) {
      const p = (xx: number, yy: number): number => raster.data[(yy * raster.width + xx) * 4 + c]
      const v = (p(x0, y0) * (1 - fx) + p(x1, y0) * fx) * (1 - fy) + (p(x0, y1) * (1 - fx) + p(x1, y1) * fx) * fy
      input[c * W * H + y * W + x] = (v / 255 - mean[c]) / std[c]
    }
  }
const resolveDep = createRequire(import.meta.url).resolve
ort.env.wasm.numThreads = 1
ort.env.wasm.proxy = false
ort.env.wasm.wasmBinary = new Uint8Array(readFileSync(resolveDep('onnxruntime-web/ort-wasm-simd-threaded.wasm')))
ort.env.wasm.wasmPaths = { mjs: pathToFileURL(resolveDep('onnxruntime-web/ort-wasm-simd-threaded.mjs')).href }
ort.env.logLevel = 'error'
const rss0 = process.memoryUsage().rss
const t0 = performance.now()
const session = await ort.InferenceSession.create(modelBytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all', intraOpNumThreads: 1, interOpNumThreads: 1 })
const t1 = performance.now()
const feeds: Record<string, ort.Tensor> = { [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, H, W]) }
if (session.inputNames.includes('pixel_mask')) {
  // The export fixes this input at 64×64 (what it was traced with); all ones = no padding, whatever its size.
  const [mh0, mw0] = (session.inputMetadata.find((m) => m.name === 'pixel_mask') as { shape: Array<number | string> }).shape.slice(1).map((d) => (typeof d === 'number' ? d : 0))
  const ph = mh0 || H, pw = mw0 || W
  feeds.pixel_mask = new ort.Tensor('int64', new BigInt64Array(ph * pw).fill(1n), [1, ph, pw])
}
const result = await session.run(feeds)
const t2 = performance.now()
const logits = result.logits
const masks = result.pred_masks
const [, Q, C] = logits.dims as number[]
const [, , mh, mw] = masks.dims as number[]
const L = logits.data as Float32Array
const M = masks.data as Float32Array
// Panoptic post-processing as the model's own processor does it: keep queries whose best real class beats 0.85, give
// each pixel to the kept query with the highest class score × mask probability (no per-pixel threshold).
const kept: Array<{ q: number; label: number; score: number }> = []
for (let q = 0; q < Q; q++) {
  let mx = -Infinity
  for (let c = 0; c < C; c++) mx = Math.max(mx, L[q * C + c])
  let sum = 0
  for (let c = 0; c < C; c++) sum += Math.exp(L[q * C + c] - mx)
  let best = -1, bp = 0
  for (let c = 0; c < C - 1; c++) {
    const p = Math.exp(L[q * C + c] - mx) / sum
    if (p > bp) { bp = p; best = c }
  }
  if (bp > 0.85) kept.push({ q, label: best, score: bp })
}
const groupMap = new Uint8Array(raster.width * raster.height)
const names = ['NONE', 'SKY', 'VEGETATION', 'TERRAIN', 'ROOF', 'FACADE', 'OPENING', 'OTHER']
const labelCount = new Map<string, number>()
for (let y = 0; y < raster.height; y++)
  for (let x = 0; x < raster.width; x++) {
    const my = Math.min(mh - 1, Math.floor(((y + 0.5) * s * mh) / H)), mx = Math.min(mw - 1, Math.floor(((x + 0.5) * s * mw) / W))
    let best: (typeof kept)[number] | undefined, bv = 0
    for (const k of kept) {
      const v = k.score / (1 + Math.exp(-M[k.q * mh * mw + my * mw + mx]))
      if (v > bv) { bv = v; best = k }
    }
    const label = best ? id2label[String(best.label)] : undefined
    const g = groupOf(label)
    groupMap[y * raster.width + x] = names.indexOf(g)
    labelCount.set(label ?? 'NONE', (labelCount.get(label ?? 'NONE') ?? 0) + 1)
  }
const png = new PNG({ width: raster.width, height: raster.height })
for (let i = 0; i < groupMap.length; i++) {
  const c = COLOURS[names[groupMap[i]]]
  png.data.set([c[0], c[1], c[2], 255], i * 4)
}
writeFileSync(join(out, 'groups.png'), PNG.sync.write(png))
writeFileSync(join(out, 'groups.bin'), groupMap)
const share = Object.fromEntries(names.map((n, i) => [n, +(groupMap.filter((v) => v === i).length / groupMap.length).toFixed(3)]))
const labels = Object.fromEntries([...labelCount].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => [k, +(v / groupMap.length).toFixed(3)]))
const summary = { picture: picture.split('/').pop(), inputSha256: createHash('sha256').update(readFileSync(picture)).digest('hex'), input: `${W}x${H}`, loadMs: Math.round(t1 - t0), inferMs: Math.round(t2 - t1), rssDeltaMB: Math.round((process.memoryUsage().rss - rss0) / 1e6), keptSegments: kept.map((k) => `${id2label[String(k.label)]}:${k.score.toFixed(2)}`), share, labels }
writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 1))
console.log(JSON.stringify(summary))
