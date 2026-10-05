/**
 * BUILDPLAN-ANALYZER-005G — OCR bake-off dataset builder (research only, never imported by production).
 *
 * For every label it does two things:
 *   1. runs the PRODUCTION numeric reader exactly as the analyzer does (`readNumbers` with hypotheses and
 *      retained passes, the plan's dimension style, `labelLattice` on the token the analyzer latticed);
 *   2. cuts the SAME label out of the same pass field (the page turned so the label reads upright, ink channel)
 *      with a fixed margin and writes it as a grayscale PNG to a directory OUTSIDE the worktree.
 *
 * External recognisers are later fed exactly these crops (run-external.mjs). The repository only ever receives the
 * manifest's text facts: label ids, page byte hashes, boxes, crop pixel hashes, transcriptions and reader outputs.
 *
 * Usage (from the BuildApp root):
 *   npx vite-node research/analyzer-005g/build-dataset.ts -- --out /home/user/work005g/dataset [--candidates]
 *
 * Inputs are the sealed source packages and byte caches the earlier stages left outside the worktree; their
 * locations are listed in SOURCES below and can be overridden with BAKEOFF_SOURCES (a JSON file of the same shape).
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { SourcePackageSchema, decodeImage, fileByteCache } from '@buildapp/source-package'
import { readNumbers, labelLattice, dimensionStyleOf, styleFor } from '@buildapp/source-metrics'
import type { TextOrientation, TextToken } from '@buildapp/source-metrics'
import { digitCorpus, renderLabel, CORPUS_SEEDS } from '@buildapp/synthetic-drawings'
import type { LabelStyle } from '@buildapp/synthetic-drawings'

type Box = { x0: number; y0: number; x1: number; y1: number }
type Gray = { width: number; height: number; data: Uint8ClampedArray }

const arg = (name: string, fallback?: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const OUT = arg('out', '/home/user/work005g/dataset')!
const CANDIDATES = process.argv.includes('--candidates')
const ONLY = arg('only')
mkdirSync(join(OUT, 'crops'), { recursive: true })

/** Where each house's sealed package and byte cache live (outside the worktree; never committed). */
type HouseSource = { pkg: string; cache: string; evidence?: string }
const SOURCES: Record<string, HouseSource> = existsSync(process.env.BAKEOFF_SOURCES ?? '')
  ? JSON.parse(readFileSync(process.env.BAKEOFF_SOURCES!, 'utf8'))
  : {
      'dom-w-dabecjach': { pkg: '/home/user/work005e/base/dom-w-dabecjach/source-package.json', cache: '/home/user/work005d/blind-cache' },
      'dom-w-tunbergiach': { pkg: '/home/user/work005e/base/dom-w-tunbergiach/source-package.json', cache: '/home/user/work005d/blind-cache' },
      'dom-w-modrzewnicy': { pkg: '/home/user/work005e/blind5/h1-dom-w-modrzewnicy/source-package.json', cache: '/home/user/work005e/blind5/cache', evidence: '/home/user/work005e/blind5/h1-dom-w-modrzewnicy/metric-evidence.json' },
      'dom-pod-milorzebem': { pkg: '/home/user/work005f/blind6/h1-dom-pod-milorzebem/source-package.json', cache: '/home/user/work005f/blind6/cache', evidence: '/home/user/work005f/blind6/h1-dom-pod-milorzebem/metric-evidence.json' },
    }
const sourceOf = (house: string): HouseSource => SOURCES[house] ?? { pkg: `/home/user/work005d/m4/${house}/source-package.json`, cache: '/home/user/work005d/cache' }

/** A page box in the frame of the pass that reads it upright (the inverse of the reader's `pageRectOfPass`). */
function passRectOfPage(r: Box, orientation: TextOrientation, page: { width: number; height: number }): Box {
  if (orientation === 'HORIZONTAL') return r
  if (orientation === 'ROTATED_CW') return { x0: page.height - r.y1, x1: page.height - r.y0, y0: r.x0, y1: r.x1 }
  if (orientation === 'ROTATED_CCW') return { x0: r.y0, x1: r.y1, y0: page.width - r.x1, y1: page.width - r.x0 }
  return { x0: page.width - 1 - r.x1, x1: page.width - 1 - r.x0, y0: page.height - 1 - r.y1, y1: page.height - 1 - r.y0 }
}

/**
 * The crop every recogniser sees: the label's box in its upright pass, padded by 0.35 of the text height on every
 * side (PaddleOCR's detector un-clips its boxes by a comparable margin), clamped to the field, off-page as paper.
 */
function cropOf(field: Gray, box: Box): { gray: Gray; box: Box } {
  const h = Math.max(1, box.y1 - box.y0)
  const m = Math.max(3, Math.round(0.35 * h))
  const b = { x0: Math.floor(box.x0) - m, y0: Math.floor(box.y0) - m, x1: Math.ceil(box.x1) + m, y1: Math.ceil(box.y1) + m }
  const w = b.x1 - b.x0
  const hh = b.y1 - b.y0
  const data = new Uint8ClampedArray(w * hh).fill(255)
  for (let y = 0; y < hh; y += 1)
    for (let x = 0; x < w; x += 1) {
      const sx = b.x0 + x
      const sy = b.y0 + y
      if (sx >= 0 && sy >= 0 && sx < field.width && sy < field.height) data[y * w + x] = field.data[sy * field.width + sx]
    }
  return { gray: { width: w, height: hh, data }, box: b }
}

/** Hash of the crop's pixels (size + bytes), independent of the PNG encoder. */
const pixelHash = (g: Gray): string => createHash('sha256').update(`${g.width}x${g.height}:`).update(Buffer.from(g.data.buffer, g.data.byteOffset, g.data.byteLength)).digest('hex')

function writePng(path: string, g: Gray): void {
  const png = new PNG({ width: g.width, height: g.height, colorType: 0, inputColorType: 0, bitDepth: 8, inputHasAlpha: false })
  png.data = Buffer.from(g.data)
  writeFileSync(path, PNG.sync.write(png, { colorType: 0, inputColorType: 0, inputHasAlpha: false }))
}

const area = (b: Box): number => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0)
const overlap = (a: Box, b: Box): number => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0))
const iou = (a: Box, b: Box): number => overlap(a, b) / Math.max(1e-6, area(a) + area(b) - overlap(a, b))

type LatticeSummary = {
  found: boolean
  raw?: string
  asRead?: string
  cls?: string
  asReadP?: number
  margin?: number
  stable?: boolean
  capPx?: number
  /** Every emitted value, by probability, highest first. */
  ranked?: Array<{ t: string; p: number }>
  latticeMs?: number
}

function summarise(lat: ReturnType<typeof labelLattice>, tok: TextToken, ms: number): LatticeSummary {
  if (!lat) return { found: false, raw: tok.text }
  const ranked = [...lat.sequences].sort((a, b) => b.p - a.p || a.text.localeCompare(b.text)).map((s) => ({ t: s.text, p: Number(s.p.toFixed(6)) }))
  return {
    found: true,
    raw: tok.text,
    asRead: lat.asRead,
    cls: lat.ocrClass,
    asReadP: Number((lat.sequences.find((s) => s.asRead)?.p ?? 0).toFixed(6)),
    margin: Number(lat.probabilityMargin.toFixed(6)),
    stable: lat.asReadStability.stable,
    capPx: lat.capHeightPx,
    ranked,
    latticeMs: Number(ms.toFixed(2)),
  }
}

type Rec = {
  id: string
  set: 'REAL' | 'SYN5001' | 'SYN9017' | 'STRESS'
  house?: string
  split?: string
  frameId?: string
  variantByteHash?: string
  boxPage?: Box
  orientation?: TextOrientation
  printed: string | null
  stratum?: string
  style?: Partial<LabelStyle>
  capPx: number
  crop: { file: string; width: number; height: number; pixelSha256: string; boxInPass: Box }
  buildplan: LatticeSummary
  readPageMs?: number
}
const records: Rec[] = []

// ---------------------------------------------------------------------------------------------------------------
// Real labels: 005E's 81 transcribed development labels, plus the 005G blind-house labels (transcribed for 005G).
// ---------------------------------------------------------------------------------------------------------------
type GtLabel = { house: string; split: string; frameId: string; variantByteHash: string; box: Box; orientation: TextOrientation; printed: string | null; textRegionId?: string }
const dev = JSON.parse(readFileSync('stage-reports/artifacts/analyzer-005e/calibration/development-labels.json', 'utf8')).labels as GtLabel[]
const blindPath = 'research/analyzer-005g/blind-labels-005g.json'
let blind: GtLabel[] = existsSync(blindPath) ? JSON.parse(readFileSync(blindPath, 'utf8')).labels : []

if (CANDIDATES) {
  // Every label the production analyzer latticed on each blind house's SELECTED plan frame (the frame its blind run
  // reasoned on), deduplicated by box (IoU > 0.5, whichever pass read it), with no printed value. Each box is emitted
  // in both passes that could read it upright (H / INVERTED, or CW / CCW) so the one that does is transcribed by eye.
  blind = []
  const selected: Record<string, { frame: string; split: string }> = {
    'dom-w-modrzewnicy': { frame: 'frame-asset-rzut-8d59c92ec1-b1cad0f4fa', split: 'BLIND_R5' },
    'dom-pod-milorzebem': { frame: 'frame-asset-rzut-ebe6069a09-06bbb9fc62', split: 'BLIND_R6' },
  }
  for (const [house, sel] of Object.entries(selected)) {
    const ev = JSON.parse(readFileSync(SOURCES[house].evidence!, 'utf8'))
    const vh = ev.ocrTokens.find((t: any) => t.frameId === sel.frame)?.variantByteHash as string
    const boxes: Box[] = []
    for (const l of ev.numericLattices) {
      if (l.frameId !== sel.frame) continue
      if (boxes.some((b) => iou(b, l.box) > 0.5)) continue
      boxes.push(l.box)
    }
    for (const box of boxes) {
      const vertical = box.y1 - box.y0 > box.x1 - box.x0
      for (const orientation of (vertical ? ['ROTATED_CW', 'ROTATED_CCW'] : ['HORIZONTAL', 'INVERTED']) as TextOrientation[])
        blind.push({ house, split: sel.split, frameId: sel.frame, variantByteHash: vh, box, orientation, printed: null })
    }
  }
}

const reads = new Map<string, { read: ReturnType<typeof readNumbers>; page: { width: number; height: number }; style: ReturnType<typeof dimensionStyleOf>; ms: number }>()
let n = 0
for (const l of [...dev, ...blind]) {
  if (ONLY && l.house !== ONLY) continue
  const key = `${l.house}|${l.variantByteHash}`
  if (!reads.has(key)) {
    const src = sourceOf(l.house)
    const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(src.pkg, 'utf8')))
    const v = pkg.assets.flatMap((a) => a.variants).find((x) => x.byteHash === l.variantByteHash)
    if (!v) throw new Error(`no variant ${l.variantByteHash} in ${src.pkg}`)
    const bytes = (await fileByteCache(src.cache).get(v.url))?.bytes
    if (!bytes) throw new Error(`no cached bytes for ${v.url}`)
    if (createHash('sha256').update(bytes).digest('hex') !== l.variantByteHash) throw new Error(`byte hash mismatch for ${l.house} ${v.url}`)
    const r = decodeImage(bytes)
    const t0 = performance.now()
    const read = readNumbers(r, { hypotheses: true, retainPasses: true })
    const ms = performance.now() - t0
    reads.set(key, { read, page: { width: r.width, height: r.height }, style: dimensionStyleOf(read), ms })
  }
  const { read, page, style, ms: readMs } = reads.get(key)!
  const field = read.passes?.[l.orientation] as Gray | undefined
  if (!field) throw new Error(`no ${l.orientation} pass for ${l.house}`)
  // The token production latticed: on this pass, 2–6 glyphs, best overlap ratio (005E/005F harness rule).
  const tok = (read.raw ?? []).filter((t) => t.orientation === l.orientation && t.glyphs.length >= 2 && t.glyphs.length <= 6 && t.passBox).sort((a, b) => iou(b.box, l.box) - iou(a.box, l.box))[0]
  let bp: LatticeSummary = { found: false }
  if (tok && overlap(tok.box, l.box) > 0) {
    const t0 = performance.now()
    const lat = labelLattice({ orientation: tok.orientation, ink: field, page }, tok, undefined, styleFor(style, tok.height))
    bp = summarise(lat, tok, performance.now() - t0)
  }
  const inPass = passRectOfPage(l.box, l.orientation, page)
  const crop = cropOf(field, inPass)
  const id = `real-${l.house}-${String(n).padStart(3, '0')}`
  n += 1
  const file = `${id}.png`
  writePng(join(OUT, 'crops', file), crop.gray)
  records.push({
    id,
    set: 'REAL',
    house: l.house,
    split: l.split,
    frameId: l.frameId,
    variantByteHash: l.variantByteHash,
    boxPage: l.box,
    orientation: l.orientation,
    printed: l.printed,
    capPx: Math.round(inPass.y1 - inPass.y0),
    crop: { file, width: crop.gray.width, height: crop.gray.height, pixelSha256: pixelHash(crop.gray), boxInPass: crop.box },
    buildplan: bp,
    readPageMs: Number(readMs.toFixed(1)),
  })
}
console.log('real labels', records.length)

// ---------------------------------------------------------------------------------------------------------------
// Synthetic: the 005E corpora (seeds 5001 and 9017) and a 005G stress corpus over the brief's regimes.
// ---------------------------------------------------------------------------------------------------------------
type Spec = { id: string; set: Rec['set']; text: string; stratum: string; style: Partial<LabelStyle> }

/** The stress corpus: confusable pairs, every digit, 3–5 digits, cap 11–25 px, condensed / italic / AA / blur / touching / broken. */
function stressCorpus(): Spec[] {
  let state = 20051005
  const rnd = (): number => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296)
  const pairs = ['94', '49', '40', '04', '86', '68', '35', '53']
  const values: string[] = []
  // Every confusable pair inside a 3-, 4- and 5-digit value, and every digit 0–9 in a non-leading position.
  for (const p of pairs) for (const len of [3, 4, 5]) {
    let t = String(1 + Math.floor(rnd() * 9))
    const at = 1 + Math.floor(rnd() * (len - 2))
    while (t.length < at) t += String(Math.floor(rnd() * 10))
    t += p
    while (t.length < len) t += String(Math.floor(rnd() * 10))
    values.push(t.slice(0, len))
  }
  for (let d = 0; d <= 9; d += 1) values.push(`1${d}${(d + 3) % 10}${(d + 7) % 10}`)
  const caps = [11, 13, 15, 17, 20, 25]
  const regimes: Array<[string, (cap: number) => Partial<LabelStyle>]> = [
    ['CLEAN', (c) => ({ slant: 0, pen: Math.max(1.2, c / 9), gap: 0.16 })],
    ['ITALIC', (c) => ({ slant: 0.28, pen: Math.max(1.2, c / 9), gap: 0.12 })],
    ['CONDENSED', (c) => ({ slant: 0, pen: Math.max(1.1, c / 10), gap: 0.08, condense: 0.72 })],
    ['CONDENSED_ITALIC', (c) => ({ slant: 0.22, pen: Math.max(1.1, c / 10), gap: 0.06, condense: 0.72 })],
    ['ANTIALIASED_THIN', (c) => ({ slant: 0.12, pen: Math.max(0.8, c / 16), gap: 0.14 })],
    ['BLURRED', (c) => ({ slant: 0.12, pen: Math.max(1.2, c / 9), gap: 0.14, blur: 0.5 + c / 30 })],
    ['TOUCHING', (c) => ({ slant: 0.2, pen: Math.max(1.3, c / 8), gap: -0.02 })],
    ['BROKEN', (c) => ({ slant: 0.12, pen: Math.max(1.2, c / 9), gap: 0.14, breaks: 0.6 })],
  ]
  const out: Spec[] = []
  let i = 0
  for (const [stratum, style] of regimes)
    for (const cap of caps)
      for (let k = 0; k < 4; k += 1) {
        const text = values[(i * 7 + k * 13) % values.length]
        out.push({ id: `stress-${stratum.toLowerCase()}-${cap}-${k}`, set: 'STRESS', text, stratum, style: { ...style(cap), capHeight: cap, face: (i + k) % 2 === 0 ? 'A' : 'B', seed: 1 + Math.floor(rnd() * 1e9) } })
        i += 1
      }
  return out
}

const synth: Spec[] = [
  ...digitCorpus(CORPUS_SEEDS.calibration, 24).map((s) => ({ id: s.id, set: 'SYN5001' as const, text: s.text, stratum: s.stratum, style: s.style })),
  ...digitCorpus(CORPUS_SEEDS.heldBack, 24).map((s) => ({ id: s.id, set: 'SYN9017' as const, text: s.text, stratum: s.stratum, style: s.style })),
  ...stressCorpus(),
]
if (!ONLY)
  for (const s of synth) {
    const r = renderLabel(s.text, s.style)
    const t0 = performance.now()
    const read = readNumbers(r.raster, { orientations: ['HORIZONTAL'], hypotheses: true, retainPasses: true })
    const readMs = performance.now() - t0
    const ink = read.passes?.HORIZONTAL as Gray | undefined
    const token = (read.raw ?? []).filter((t) => t.orientation === 'HORIZONTAL').sort((a, b) => b.box.x1 - b.box.x0 - (a.box.x1 - a.box.x0) || a.box.x0 - b.box.x0)[0]
    let bp: LatticeSummary = { found: false }
    if (token && ink) {
      const t1 = performance.now()
      // As the 005E/005F corpus gate reads it: no plan style.
      const lat = labelLattice({ orientation: 'HORIZONTAL', ink, page: { width: r.raster.width, height: r.raster.height } }, token)
      bp = summarise(lat, token, performance.now() - t1)
    }
    const field: Gray = ink ?? { width: r.raster.width, height: r.raster.height, data: Uint8ClampedArray.from({ length: r.raster.width * r.raster.height }, (_, i) => r.raster.data[i * 4]) }
    const crop = cropOf(field, r.box)
    const file = `${s.id}.png`
    writePng(join(OUT, 'crops', file), crop.gray)
    records.push({
      id: s.id,
      set: s.set,
      printed: s.text,
      stratum: s.stratum,
      style: s.style,
      capPx: s.style.capHeight ?? 14,
      crop: { file, width: crop.gray.width, height: crop.gray.height, pixelSha256: pixelHash(crop.gray), boxInPass: crop.box },
      buildplan: bp,
      readPageMs: Number(readMs.toFixed(1)),
    })
  }

writeFileSync(join(OUT, 'labels.json'), JSON.stringify({ schema: 'buildapp.ocr-bakeoff-dataset', version: '1.0.0', count: records.length, records }, null, 1))
const by = (set: string) => records.filter((r) => r.set === set)
for (const set of ['REAL', 'SYN5001', 'SYN9017', 'STRESS']) {
  const R = by(set).filter((r) => r.printed)
  console.log(set, R.length, 'asRead right', R.filter((r) => r.buildplan.asRead === r.printed).length)
}
