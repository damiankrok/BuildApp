/**
 * BUILDPLAN-ANALYZER-005G — deterministic CV probe: production `@buildapp/source-cv` against OpenCV (opencv.js,
 * the WebAssembly build of the same C++ that OpenCV Android ships) on the synthetic plan sheets (research only).
 *
 * For every synthetic house's ground plan (14 fixtures with known, invented geometry — no publisher pixel):
 *   - connected components (8-connected) — counts and the multiset of bounding boxes;
 *   - morphology (square 5×5 erode / dilate) — pixel disagreement inside and on the border;
 *   - line extraction — source-cv's run-based axis segments and its Hough against OpenCV's HoughLinesP and LSD,
 *     scored by mutual coverage of long segments (≥ 40 px) within 2 px and 2°;
 *   - wall time of each.
 *
 *   npx vite-node research/analyzer-005g/cv-probe.ts -- --out /home/user/work005g/cv-probe.json
 */
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { toGray, inkMask, connectedComponents, erode, dilate, axisAlignedSegments, houghSegments } from '@buildapp/source-cv'
import type { Mask, Segment } from '@buildapp/source-cv'
import { LARCHFIELD, HOLLOWAY, REDMIRE, V2_FIXTURES, renderGroundPlan } from '@buildapp/synthetic-drawings'

const require = createRequire(import.meta.url)
const arg = (name: string, fallback?: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}

// opencv.js: a module object that resolves when the WebAssembly runtime is ready.
const cvModule = require('./node_modules/@techstark/opencv-js')
const cv: any = cvModule instanceof Promise ? await cvModule : await new Promise((resolve) => (cvModule.onRuntimeInitialized = () => resolve(cvModule)))

const houses = [LARCHFIELD, HOLLOWAY, REDMIRE, ...V2_FIXTURES]
type Seg = { x0: number; y0: number; x1: number; y1: number }
const toSeg = (s: Segment): Seg => ({ x0: s.a.x, y0: s.a.y, x1: s.b.x, y1: s.b.y })
const len = (s: Seg): number => Math.hypot(s.x1 - s.x0, s.y1 - s.y0)
const ang = (s: Seg): number => ((Math.atan2(s.y1 - s.y0, s.x1 - s.x0) * 180) / Math.PI + 180) % 180
const distPt = (px: number, py: number, s: Seg): number => {
  const dx = s.x1 - s.x0
  const dy = s.y1 - s.y0
  const l2 = dx * dx + dy * dy
  const t = l2 ? Math.max(0, Math.min(1, ((px - s.x0) * dx + (py - s.y0) * dy) / l2)) : 0
  return Math.hypot(px - (s.x0 + t * dx), py - (s.y0 + t * dy))
}
/** Share of `a`'s long-segment length lying within 2 px of some `b` segment at ≤ 2° (sampled every px). */
function coverage(a: Seg[], b: Seg[]): number {
  let total = 0
  let hit = 0
  for (const s of a.filter((x) => len(x) >= 40)) {
    const n = Math.ceil(len(s))
    const cand = b.filter((t) => Math.min(Math.abs(ang(t) - ang(s)), 180 - Math.abs(ang(t) - ang(s))) <= 2)
    for (let i = 0; i <= n; i += 1) {
      const px = s.x0 + ((s.x1 - s.x0) * i) / n
      const py = s.y0 + ((s.y1 - s.y0) * i) / n
      total += 1
      if (cand.some((t) => distPt(px, py, t) <= 2)) hit += 1
    }
  }
  return total ? hit / total : 1
}
const matOf = (m: Mask): any => {
  const mat = new cv.Mat(m.height, m.width, cv.CV_8UC1)
  for (let i = 0; i < m.data.length; i += 1) mat.data[i] = m.data[i] ? 255 : 0
  return mat
}
const maskOf = (mat: any): Uint8Array => Uint8Array.from(mat.data, (v: number) => (v ? 1 : 0))
const timed = <T>(f: () => T): [T, number] => {
  const t0 = performance.now()
  const r = f()
  return [r, performance.now() - t0]
}

const rows: any[] = []
for (const house of houses) {
  const raster = renderGroundPlan(house, { storey: 0 }).toRaster()
  const mask = inkMask(toGray(raster))
  const W = mask.width
  const H = mask.height
  const src = matOf(mask)

  // Connected components.
  const [bc, bcMs] = timed(() => connectedComponents(mask, { connectivity: 8, minPixels: 1 }))
  const labels = new cv.Mat()
  const stats = new cv.Mat()
  const cents = new cv.Mat()
  const [n, ocMs] = timed(() => cv.connectedComponentsWithStats(src, labels, stats, cents, 8, cv.CV_32S))
  const boxesB = bc.map((c) => `${c.bounds.x0},${c.bounds.y0},${c.bounds.x1},${c.bounds.y1},${c.pixels}`).sort()
  const boxesO: string[] = []
  for (let i = 1; i < n; i += 1) {
    const x = stats.intAt(i, 0)
    const y = stats.intAt(i, 1)
    const w = stats.intAt(i, 2)
    const h = stats.intAt(i, 3)
    boxesO.push(`${x},${y},${x + w},${y + h},${stats.intAt(i, 4)}`)
  }
  boxesO.sort()
  const sameBoxes = boxesB.length === boxesO.length && boxesB.every((b, i) => b === boxesO[i])
  const sameBoxesInclusive = boxesB.length === boxesO.length && boxesB.every((b, i) => {
    const [x0, y0, x1, y1, p] = b.split(',').map(Number)
    const [u0, v0, u1, v1, q] = boxesO[i].split(',').map(Number)
    return x0 === u0 && y0 === v0 && p === q && (x1 === u1 || x1 + 1 === u1) && (y1 === v1 || y1 + 1 === v1)
  })

  // Morphology, r = 2 (5×5 square).
  const k = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5))
  const [be, beMs] = timed(() => erode(mask, 2))
  const oe = new cv.Mat()
  const [, oeMs] = timed(() => cv.erode(src, oe, k))
  const [bd, bdMs] = timed(() => dilate(mask, 2))
  const od = new cv.Mat()
  const [, odMs] = timed(() => cv.dilate(src, od, k))
  const diff = (a: Uint8Array, b: Uint8Array) => {
    let inner = 0
    let border = 0
    for (let y = 0; y < H; y += 1)
      for (let x = 0; x < W; x += 1) {
        const i = y * W + x
        if ((a[i] ? 1 : 0) !== b[i]) (x < 2 || y < 2 || x >= W - 2 || y >= H - 2 ? (border += 1) : (inner += 1))
      }
    return { inner, border }
  }
  const erodeDiff = diff(be.data, maskOf(oe))
  const dilateDiff = diff(bd.data, maskOf(od))

  // Lines.
  const [axisB, axMs] = timed(() => axisAlignedSegments(mask, {}).map(toSeg))
  const [houghB, hbMs] = timed(() => houghSegments(mask, {}).map(toSeg))
  const lp = new cv.Mat()
  const [, hpMs] = timed(() => cv.HoughLinesP(src, lp, 1, Math.PI / 180, 60, 40, 3))
  const houghP: Seg[] = []
  // OpenCV 5's opencv.js returns HoughLinesP as one row of N CV_32SC4 columns: count by the data, not by rows.
  for (let i = 0; i < lp.data32S.length / 4; i += 1) houghP.push({ x0: lp.data32S[i * 4], y0: lp.data32S[i * 4 + 1], x1: lp.data32S[i * 4 + 2], y1: lp.data32S[i * 4 + 3] })
  let lsd: Seg[] | null = null
  let lsdMs: number | null = null
  if (typeof cv.createLineSegmentDetector === 'function') {
    const det = cv.createLineSegmentDetector()
    const gray = new cv.Mat(H, W, cv.CV_8UC1)
    for (let i = 0; i < mask.data.length; i += 1) gray.data[i] = mask.data[i] ? 0 : 255
    const out = new cv.Mat()
    const t0 = performance.now()
    det.detect(gray, out)
    lsdMs = performance.now() - t0
    lsd = []
    for (let i = 0; i < out.data32F.length / 4; i += 1) lsd.push({ x0: out.data32F[i * 4], y0: out.data32F[i * 4 + 1], x1: out.data32F[i * 4 + 2], y1: out.data32F[i * 4 + 3] })
    gray.delete()
    out.delete()
  }
  const bpLines = [...axisB, ...houghB]
  rows.push({
    house: house.name ?? house.label ?? rows.length,
    size: [W, H],
    inkPixels: mask.data.reduce((a, v) => a + v, 0),
    components: { sourceCv: bc.length, opencv: n - 1, sameBoxesAndPixelCounts: sameBoxes, sameUpToInclusiveBounds: sameBoxesInclusive, ms: { sourceCv: +bcMs.toFixed(1), opencv: +ocMs.toFixed(1) } },
    morphology: { erodeDiff, dilateDiff, ms: { sourceCvErode: +beMs.toFixed(1), opencvErode: +oeMs.toFixed(1), sourceCvDilate: +bdMs.toFixed(1), opencvDilate: +odMs.toFixed(1) } },
    lines: {
      sourceCvAxis: axisB.length,
      sourceCvHough: houghB.length,
      opencvHoughP: houghP.length,
      opencvLsd: lsd?.length ?? null,
      coverage: {
        sourceCvByHoughP: +coverage(bpLines, houghP).toFixed(3),
        houghPBySourceCv: +coverage(houghP, bpLines).toFixed(3),
        sourceCvByLsd: lsd ? +coverage(bpLines, lsd).toFixed(3) : null,
        lsdBySourceCv: lsd ? +coverage(lsd, bpLines).toFixed(3) : null,
      },
      ms: { sourceCvAxis: +axMs.toFixed(1), sourceCvHough: +hbMs.toFixed(1), opencvHoughP: +hpMs.toFixed(1), opencvLsd: lsdMs != null ? +lsdMs.toFixed(1) : null },
    },
  })
  for (const m of [src, labels, stats, cents, k, oe, od, lp]) m.delete()
}
const out = { engine: `@techstark/opencv-js (OpenCV ${cv.getBuildInformation ? (String(cv.getBuildInformation()).match(/General configuration for OpenCV ([^\s=]+)/)?.[1] ?? '?') : '?'}) vs @buildapp/source-cv`, node: process.version, lsdAvailable: typeof cv.createLineSegmentDetector === 'function', houses: rows }
writeFileSync(arg('out', '/home/user/work005g/cv-probe.json')!, JSON.stringify(out, null, 1))
for (const r of rows) console.log(r.house, r.size.join('x'), 'cc', r.components.sourceCv, r.components.opencv, r.components.sameBoxesAndPixelCounts, r.components.sameUpToInclusiveBounds, '| erode', JSON.stringify(r.morphology.erodeDiff), 'dilate', JSON.stringify(r.morphology.dilateDiff), '| lines', JSON.stringify(r.lines.coverage), JSON.stringify(r.lines.ms))
