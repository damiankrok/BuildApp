/**
 * truth.ts — BUILDPLAN-ANALYZER-005Q-OCR local truth readers (RESEARCH ONLY; never imported by production; never an
 * input to a contender).
 *
 *   npx vite-node research/analyzer-005q-ocr/truth.ts -- --work /home/user/work005q-ocr [--only S5]
 *
 * No page, crop or pixel is shown to a remote model or service (OWNER rule for this stage). The two truth readers run
 * in this container and neither is a contender's reader:
 *   R1  PaddleOCR PP-OCRv6 MEDIUM recogniser (native ONNX Runtime sidecar, r1_server.py) (76.6 MB, Apache-2.0, pinned revision/hash; NOT the deployed tiny model),
 *       its own unconstrained greedy answer over its 18 708-symbol alphabet;
 *   R2  Tesseract 5.3.4 LSTM (eng), single line, characters limited to digits and the separators , . (a different
 *       family, different training data).
 * A location's value is LOCAL_DOUBLE_READ when R1 and R2 give the same text; anything else is AMBIGUOUS_READ or
 * UNREADABLE. The way up is the one R1 reads with the higher mean frame probability (both turns of the box's axis).
 *
 * Where truth readers look (the sampling frame — NOT only the incumbent's crops):
 *   - every classic template token of ≥ 2 glyphs on the page (the incumbent's DISCOVERY, before any line test);
 *   - every B1 detector box (independent discovery);
 *   - LINE WINDOWS: for every segment between two consecutive marks of every frozen dimension line (production
 *     `findDimensionLines`) that no proposal above sits on, the bands on both sides of the line over the segment's
 *     span. A number read there is a label both discoveries missed.
 * Only boxes and geometry enter from the contender files; no contender READING is read here.
 *
 * Output: $W/truth/<sheet>.json — numbers, texts and boxes only.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { decodeImage } from '@buildapp/source-package'
import { readNumbers } from '@buildapp/source-metrics'
import type { TextToken } from '@buildapp/source-metrics'
import { classesOf, paddleTensor, resizeBilinear } from '@buildapp/numeric-recogniser-ort'
import { passRectOfPage } from './geometry.ts'

const REPO = resolve(import.meta.dirname, '../..')
const arg = (n: string, f?: string): string | undefined => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : f
}
const W = resolve(arg('work', '/home/user/work005q-ocr')!)
if (W === REPO || W.startsWith(REPO + '/')) throw new Error(`--work ${W} is inside the repository: refused`)
const only = (arg('only', '') ?? '').split(',').filter(Boolean)
const sha = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex')
const out = (rel: string, v: unknown): void => {
  const p = join(W, rel)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, `${JSON.stringify(v, null, 1)}\n`)
}
type Box = { x0: number; x1: number; y0: number; y1: number }
type Orientation = TextToken['orientation']
type Gray = { width: number; height: number; data: Uint8ClampedArray }
const round = (v: number, d = 3): number => Number(v.toFixed(d))

const R1 = { file: join(W, 'models/rec-medium/inference.onnx'), dict: join(W, 'models/rec-medium/dict.json'), sha256: '9c09abf0957f7968c7586464b7397b84ad2387a0497a351af40e9acc71b673ba', repo: 'PaddlePaddle/PP-OCRv6_medium_rec_onnx', revision: '50c7eacafc52fa7bcf4194e8cd08e46f8558504b' }
/** Frozen before scoring (preregistration §2): pad of half the box height for both truth readers; Tesseract sees the crop ×3. */
export const TRUTH = { padShare: 0.5, minPad: 4, tessUpscale: 3, tessBorder: 12, windowFrom: 0.25, windowTo: 2.6, minSegmentPx: 18 } as const

/** R1 runs on native ONNX Runtime in a Python sidecar (`r1_server.py`): the WASM build took ~20 min per sheet. */
async function medium(): Promise<{ read: (g: Gray) => Promise<{ text: string; meanP: number }>; close: () => void; ort: string }> {
  const classes = classesOf(JSON.parse(readFileSync(R1.dict, 'utf8')))
  const child = spawn('python3', ['-I', resolve(import.meta.dirname, 'r1_server.py'), '--pylib', join(W, 'pylib'), '--model', R1.file, '--sha256', R1.sha256], { stdio: ['pipe', 'pipe', 'inherit'] })
  const lines = createInterface({ input: child.stdout! })
  const it = lines[Symbol.asyncIterator]()
  const next = async (): Promise<Record<string, unknown>> => {
    const r = await it.next()
    if (r.done) throw new Error('r1_server ended')
    return JSON.parse(r.value)
  }
  const hello = await next()
  return {
    ort: String(hello.ort),
    close: () => child.stdin!.end(),
    read: async (g) => {
      const { data, dims } = paddleTensor(g)
      child.stdin!.write(`${JSON.stringify({ dims, data: Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('base64') })}\n`)
      const r = (await next()) as { C: number; argmax: number[]; p: number[] }
      if (r.C !== classes.length) throw new Error(`medium: ${r.C} classes vs dictionary ${classes.length}`)
      // greedyDecode's collapse over the per-frame argmax
      let text = '', last = -1, sum = 0, kept = 0
      r.argmax.forEach((best, t) => {
        if (best !== 0 && best !== last) {
          text += classes[best]
          sum += r.p[t]
          kept += 1
        }
        last = best
      })
      return { text, meanP: kept > 0 ? sum / kept : 0 }
    },
  }
}

const TMP = join(W, 'tmp-tess')
function tesseract(g: Gray): string {
  const s = TRUTH.tessUpscale
  const w = g.width * s, h = g.height * s, b = TRUTH.tessBorder
  const up = resizeBilinear(g, w, h)
  const W2 = w + 2 * b, H2 = h + 2 * b
  const px = new Uint8Array(W2 * H2).fill(255)
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) px[(y + b) * W2 + x + b] = Math.max(0, Math.min(255, Math.round(up[y * w + x])))
  mkdirSync(TMP, { recursive: true })
  const file = join(TMP, 'c.pgm')
  writeFileSync(file, Buffer.concat([Buffer.from(`P5\n${W2} ${H2}\n255\n`), Buffer.from(px)]))
  const r = spawnSync('tesseract', [file, 'stdout', '--psm', '7', '-l', 'eng', '-c', 'tessedit_char_whitelist=0123456789.,'], { encoding: 'utf8' })
  return (r.stdout ?? '').trim()
}

/** The box upright in its pass field, padded by `TRUTH.padShare` of its height, off-field as paper. */
function cut(field: Gray, b: Box): Gray {
  const m = Math.max(TRUTH.minPad, Math.round(TRUTH.padShare * (b.y1 - b.y0)))
  const x0 = Math.floor(b.x0) - m, y0 = Math.floor(b.y0) - m
  const width = Math.ceil(b.x1) + m - x0, height = Math.ceil(b.y1) + m - y0
  const data = new Uint8ClampedArray(width * height).fill(255)
  for (let y = 0; y < height; y += 1) {
    const sy = y0 + y
    if (sy < 0 || sy >= field.height) continue
    for (let x = 0; x < width; x += 1) {
      const sx = x0 + x
      if (sx >= 0 && sx < field.width) data[y * width + x] = field.data[sy * field.width + sx]
    }
  }
  return { width, height, data }
}

const norm = (t: string): string => t.replace(/\s+/g, ' ').trim()
type Location = { origin: 'CLASSIC' | 'B1' | 'LINE_WINDOW'; box: Box; axis: 'HORIZONTAL' | 'VERTICAL'; ref?: number }

async function main(): Promise<void> {
  const reader = await medium()
  const corpus = JSON.parse(readFileSync(resolve(REPO, 'research/analyzer-005q-ocr/corpus.json'), 'utf8')).sheets as Array<{ id: string }>
  for (const { id } of corpus) {
    if (only.length && !only.includes(id)) continue
    const man = JSON.parse(readFileSync(join(W, `manifest/${id}.json`), 'utf8'))
    const con = JSON.parse(readFileSync(join(W, `contenders/${id}.json`), 'utf8'))
    const bytes = new Uint8Array(readFileSync(man.bytesFile))
    if (sha(bytes) !== man.variantByteHash) throw new Error(`${id}: bytes changed`)
    const raster = decodeImage(bytes)
    const page = { width: raster.width, height: raster.height }
    const read = readNumbers(raster, { hypotheses: true, retainPasses: true })
    const passes = read.passes!
    const heights = (con.classic as Array<{ height: number; glyphs: number }>).filter((t) => t.glyphs >= 2).map((t) => t.height).sort((a, b) => a - b)
    const h = heights[Math.floor(heights.length / 2)] ?? 12
    const locs: Location[] = []
    for (const t of con.classic as Array<{ box: Box; orientation: Orientation; glyphs: number }>) if (t.glyphs >= 2) locs.push({ origin: 'CLASSIC', box: t.box, axis: t.orientation === 'HORIZONTAL' || t.orientation === 'INVERTED' ? 'HORIZONTAL' : 'VERTICAL' })
    ;(con.b1 as Box[]).forEach((b, i) => locs.push({ origin: 'B1', box: { x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 }, axis: b.x1 - b.x0 >= b.y1 - b.y0 ? 'HORIZONTAL' : 'VERTICAL', ref: i }))
    // line windows for segments no proposal sits on
    const onSeg = (b: Box, axis: string, base: number, from: number, to: number): boolean => {
      const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2
      const along = axis === 'HORIZONTAL' ? cx : cy
      const across = axis === 'HORIZONTAL' ? cy : cx
      return Math.abs(across - base) <= 2.2 * h && along >= from && along <= to
    }
    for (const c of con.chains as Array<{ axis: string; baselinePx: number; ticks: Array<{ atPx: number }> }>) {
      for (let i = 0; i + 1 < c.ticks.length; i += 1) {
        const from = c.ticks[i].atPx, to = c.ticks[i + 1].atPx
        if (to - from < TRUTH.minSegmentPx) continue
        if (locs.some((l) => l.origin !== 'LINE_WINDOW' && l.axis === c.axis && onSeg(l.box, c.axis, c.baselinePx, from, to))) continue
        for (const side of [-1, 1]) {
          const a = c.baselinePx + side * TRUTH.windowFrom * h, b = c.baselinePx + side * TRUTH.windowTo * h
          const lo = Math.max(0, Math.min(a, b)), hi = Math.min(c.axis === 'HORIZONTAL' ? page.height : page.width, Math.max(a, b))
          const box = c.axis === 'HORIZONTAL' ? { x0: from + 2, x1: to - 2, y0: lo, y1: hi } : { x0: lo, x1: hi, y0: from + 2, y1: to - 2 }
          locs.push({ origin: 'LINE_WINDOW', box, axis: c.axis as Location['axis'] })
        }
      }
    }
    const items = []
    for (const [n, l] of locs.entries()) {
      const hyps: Orientation[] = l.axis === 'HORIZONTAL' ? ['HORIZONTAL', 'INVERTED'] : ['ROTATED_CW', 'ROTATED_CCW']
      const r1: Array<{ o: Orientation; text: string; meanP: number }> = []
      for (const o of hyps) {
        const g = cut(passes[o] as Gray, passRectOfPage(l.box, o, page))
        const r = await reader.read(g)
        r1.push({ o, text: norm(r.text), meanP: r.meanP })
      }
      r1.sort((a, b) => b.meanP - a.meanP)
      const best = r1[0]
      // a line window is a band: Tesseract reads it only when R1 heard a digit in it
      const heard = /\d/.test(best.text)
      const r2 = l.origin !== 'LINE_WINDOW' || heard ? norm(tesseract(cut(passes[best.o] as Gray, passRectOfPage(l.box, best.o, page)))) : ''
      const m = best.text.replace(/\s/g, '')
      const t = r2.replace(/\s/g, '')
      const status = m === '' && t === '' ? 'UNREADABLE' : m !== '' && m === t ? 'LOCAL_DOUBLE_READ' : 'AMBIGUOUS_READ'
      items.push({ n, origin: l.origin, ...(l.ref !== undefined ? { ref: l.ref } : {}), box: l.box, axis: l.axis, orientation: best.o, r1: { text: best.text, meanP: round(best.meanP, 4), rival: { o: r1[1].o, text: r1[1].text, meanP: round(r1[1].meanP, 4) } }, r2, status, ...(status === 'LOCAL_DOUBLE_READ' ? { value: m } : {}) })
    }
    out(`truth/${id}.json`, { schema: 'buildapp.005q-ocr.truth-local', sheet: id, page, labelHeightPx: h, readers: { r1: { ...R1, file: undefined, dict: undefined, runtime: `onnxruntime ${reader.ort} (native CPU, 4 threads)` }, r2: { tool: 'tesseract', version: spawnSync('tesseract', ['--version'], { encoding: 'utf8' }).stdout.split('\n')[0], psm: 7, whitelist: '0123456789.,' } }, params: TRUTH, items })
    const st = items.reduce<Record<string, number>>((a, i) => ((a[`${i.origin}:${i.status}`] = (a[`${i.origin}:${i.status}`] ?? 0) + 1), a), {})
    process.stdout.write(`${id} locations ${items.length} ${JSON.stringify(st)}\n`)
  }
  rmSync(TMP, { recursive: true, force: true })
  reader.close()
}
await main()
