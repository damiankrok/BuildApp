/**
 * 005Y feasibility probe (RESEARCH ONLY; never imported by production): does the pinned PaddleOCR PP-OCRv6 tiny
 * recogniser read the halves of plan opening callouts ("300/230" in a small barred ring) where the template reader of
 * `callouts.ts` (`readHalf`) fails?
 *
 *   npx vite-node research/analyzer-005y-archon-visual/callout-paddle-probe.ts -- --out /home/user/work005y/paddle-probe \
 *        [--truth /home/user/work005y/paddle-probe/truth.json] [--only gozd] [--crop disc|cc] [--refine] [--score-only]
 *
 * For each house's 853x853 FLOOR_PLAN rasters: rings from `readOpeningCallouts` (default radii) and
 * `readTintedCallouts` (6..22 px, requireBar), kept only with a bar, merged by position. Each ring's upper and lower
 * halves are cut from the raster's ink channel (min RGB), normalised to the disc's own paper (paper -> 255), the ring
 * and the bar painted out, tightened to the ink box and padded as `cropForToken` pads; each half is read in-process by
 * `openEngine(workspaceAssetPaths()).read` (the 4-variant stability bracket). Confident = stable && posterior >= 0.9 &&
 * meanP >= 0.9 (`OCR_ENSEMBLE_BOUNDS`).
 *
 * OFFLINE, deterministic. Everything written goes under --out, which must be outside the repository: per ring an
 * enlarged crop PNG and the two Paddle input crops, a contact sheet per frame, results.json and, with --truth, score.json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PNG } from 'pngjs'
import { SourcePackageSchema, decodeImage, fileByteCache, selectedVariant } from '@buildapp/source-package'
import { readOpeningCallouts, readTintedCallouts, RECOGNISER_CROP, OCR_ENSEMBLE_BOUNDS } from '@buildapp/source-metrics'
import type { CalloutReading } from '@buildapp/source-metrics'
import { inkChannel } from '@buildapp/source-cv'
import type { Gray, Raster } from '@buildapp/source-cv'
import { openEngine, workspaceAssetPaths } from '@buildapp/numeric-recogniser-ort'

const REPO = resolve(import.meta.dirname, '../..')
const arg = (name: string, fallback?: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback
}
const out = resolve(arg('out', '/home/user/work005y/paddle-probe') as string)
if (out === REPO || out.startsWith(`${REPO}/`)) throw new Error('REFUSED: probe outputs never go inside the repository')
const only = arg('only')
const truthPath = arg('truth')
/** `--refine`: re-fit the detector's circle (centre +-3 px, radius -1..+4) to the best ring contrast before cutting. Measured WORSE (gozd 37 -> 25 exact of 46, one confident wrong half); off by default. */
const REFINE = process.argv.includes('--refine')
/** How a half is cut: 'disc' (circle mask r - 2.5, default) or 'cc' (ink components, ring arc dropped; measured WORSE on ciesz: digits touching the ring are dropped with it). */
const CROP = arg('crop', 'disc') as 'disc' | 'cc'
const TAG = CROP === 'disc' ? '' : `-${CROP}`

const HOUSES: Array<{ house: string; pkg: string; cache: string }> = [
  { house: 'a01', pkg: '/home/user/work005k/gapset/runs/A01/source-package.json', cache: '/home/user/work005k/gapset/cache' },
  { house: 'gozd', pkg: '/home/user/work005i-a/blind8/h1-dom-w-gozdzikowcach/source-package.json', cache: '/home/user/work005i-a/blind8/cache' },
  { house: 'marcowki', pkg: '/home/user/work005i-a/m-on/marcowki/source-package.json', cache: '/home/user/work005r/corpus/v0/cache' },
  { house: 'ciesz', pkg: '/home/user/work005l/blind/h2-dom-w-cieszyniankach/source-package.json', cache: '/home/user/work005l/blind/cache' },
  { house: 'rary', pkg: '/home/user/work005i-a/m-on/rarytasy-g2e/source-package.json', cache: '/home/user/work005r/corpus/v0/cache' },
]

const writePng = (path: string, w: number, h: number, px: (x: number, y: number) => [number, number, number]): void => {
  const png = new PNG({ width: w, height: h })
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1) {
      const [r, g, b] = px(x, y)
      const o = (y * w + x) * 4
      png.data[o] = r
      png.data[o + 1] = g
      png.data[o + 2] = b
      png.data[o + 3] = 255
    }
  writeFileSync(path, PNG.sync.write(png))
}
const greyPng = (path: string, g: Gray, k: number): void => writePng(path, g.width * k, g.height * k, (x, y) => {
  const v = g.data[Math.floor(y / k) * g.width + Math.floor(x / k)]
  return [v, v, v]
})

type Ring = { cx: number; cy: number; r: number; barY: number; readers: Array<{ reader: 'OPENING' | 'TINTED'; widthCm: number | null; heightCm: number | null; upperText: string; lowerText: string; confidence: number }> }

/** The two halves of a ring as Paddle sees them: ink dark on paper 255, ring and bar painted out, tightened to ink. */
function halves(ink: Gray, ring: Ring): { upper: Gray | null; lower: Gray | null; refined: { cx: number; cy: number; R: number; bar: number } } {
  const g = (x: number, y: number): number => (x < 0 || y < 0 || x >= ink.width || y >= ink.height ? 255 : ink.data[y * ink.width + x])
  // The detectors' circle can sit a pixel or two off, or be a radius short (a short radius clips the digits): refine
  // centre and radius to the darkest circumference near it (48 samples, bilinear-free nearest), then the bar to the
  // darkest row across the disc near the reported one.
  let best = { cx: ring.cx, cy: ring.cy, R: ring.r, score: -Infinity }
  // Score: the circumference darker than the circle 2.5 px inside it AND than the one 2 px outside (a ring, not a
  // stroke of the digits), summed over 48 directions with each direction's contrast floored at 0.
  const at = (x: number, y: number): number => g(Math.round(x), Math.round(y))
  for (let dy = -3; dy <= 3; dy += 1)
    for (let dx = -3; dx <= 3; dx += 1)
      for (let R = Math.max(5, ring.r - 1); R <= ring.r + 4; R += 1) {
        let dark = 0
        for (let k = 0; k < 48; k += 1) {
          const c = Math.cos((2 * Math.PI * k) / 48)
          const sn = Math.sin((2 * Math.PI * k) / 48)
          const X = ring.cx + dx
          const Y = ring.cy + dy
          const on = at(X + R * c, Y + R * sn)
          dark += Math.max(0, Math.min(at(X + (R - 2.5) * c, Y + (R - 2.5) * sn), at(X + (R + 2) * c, Y + (R + 2) * sn)) - on)
        }
        const score = dark / 48
        if (score > best.score) best = { cx: ring.cx + dx, cy: ring.cy + dy, R, score }
      }
  if (!REFINE) best = { cx: ring.cx, cy: ring.cy, R: ring.r, score: 0 }
  const { cx, cy, R: r } = best
  let barBest = { y: Math.round(ring.barY), dark: -Infinity }
  if (REFINE) for (let y = Math.round(ring.barY) - 2; y <= Math.round(ring.barY) + 2; y += 1) {
    let dark = 0
    for (let x = cx - Math.round(r * 0.6); x <= cx + Math.round(r * 0.6); x += 1) dark += 255 - g(x, y)
    if (dark > barBest.dark) barBest = { y, dark }
  }
  const inner = r - 2.5
  // The disc's own paper: the 85th percentile of the interior (tinted or white).
  const vals: number[] = []
  for (let y = cy - r; y <= cy + r; y += 1) for (let x = cx - r; x <= cx + r; x += 1) if (Math.hypot(x - cx, y - cy) <= inner) vals.push(g(x, y))
  vals.sort((a, b) => a - b)
  const paper = Math.max(1, vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.85))] ?? 255)
  const norm = (v: number): number => Math.max(0, Math.min(255, Math.round((255 * v) / paper)))
  const bar = barBest.y
  const cut = (y0: number, y1: number): Gray | null => {
    // Ink box inside the disc between rows y0..y1 (inclusive).
    let bx0 = Infinity
    let by0 = Infinity
    let bx1 = -Infinity
    let by1 = -Infinity
    for (let y = y0; y <= y1; y += 1)
      for (let x = cx - r; x <= cx + r; x += 1) {
        if (Math.hypot(x - cx, y - cy) > inner) continue
        if (norm(g(x, y)) < 170) {
          bx0 = Math.min(bx0, x)
          by0 = Math.min(by0, y)
          bx1 = Math.max(bx1, x)
          by1 = Math.max(by1, y)
        }
      }
    if (!Number.isFinite(bx0)) return null
    const h = by1 - by0 + 1
    const m = Math.max(RECOGNISER_CROP.minPadPx, Math.round(RECOGNISER_CROP.padShare * h))
    const X0 = bx0 - m
    const Y0 = by0 - m
    const W = bx1 - bx0 + 1 + 2 * m
    const H = h + 2 * m
    const data = new Uint8ClampedArray(W * H).fill(255)
    for (let y = 0; y < H; y += 1)
      for (let x = 0; x < W; x += 1) {
        const sx = X0 + x
        const sy = Y0 + y
        if (sy < y0 || sy > y1 || Math.hypot(sx - cx, sy - cy) > inner) continue
        data[y * W + x] = norm(g(sx, sy))
      }
    return { width: W, height: H, data }
  }
  if (CROP === 'cc') return { upper: ccCut(cy - r - 4, bar - 2), lower: ccCut(bar + 2, cy + r + 4), refined: { cx, cy, R: r, bar } }
  return { upper: cut(cy - r, bar - 2), lower: cut(bar + 2, cy + r), refined: { cx, cy, R: r, bar } }

  /**
   * `--crop cc`: no circle mask (a detector radius a pixel or two short clips the outer digits). The band between the
   * ring and the bar, 4 px wider than the detected circle on every side, is split into 8-connected ink components; the
   * ring's arc (a component touching the band's border, or wider than 1.2 r) is dropped, the rest kept with a 1 px
   * halo of their own grey, everything else paper.
   */
  function ccCut(y0: number, y1: number): Gray | null {
    const X0 = cx - r - 4
    const W = 2 * r + 9
    const H = y1 - y0 + 1
    if (H < 3) return null
    const val = (x: number, y: number): number => norm(g(X0 + x, y0 + y))
    const lab = new Int32Array(W * H).fill(-1)
    const comps: Array<{ px: number[]; x0: number; x1: number; y0: number; y1: number; border: boolean }> = []
    for (let y = 0; y < H; y += 1)
      for (let x = 0; x < W; x += 1) {
        if (lab[y * W + x] !== -1 || val(x, y) >= 170) continue
        const c = { px: [] as number[], x0: x, x1: x, y0: y, y1: y, border: false }
        const stack = [y * W + x]
        lab[y * W + x] = comps.length
        while (stack.length) {
          const i = stack.pop() as number
          const px = i % W
          const py = (i - px) / W
          c.px.push(i)
          c.x0 = Math.min(c.x0, px); c.x1 = Math.max(c.x1, px); c.y0 = Math.min(c.y0, py); c.y1 = Math.max(c.y1, py)
          if (px === 0 || py === 0 || px === W - 1 || py === H - 1) c.border = true
          for (let dy = -1; dy <= 1; dy += 1)
            for (let dx = -1; dx <= 1; dx += 1) {
              const nx = px + dx
              const ny = py + dy
              if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
              const j = ny * W + nx
              if (lab[j] === -1 && val(nx, ny) < 170) { lab[j] = comps.length; stack.push(j) }
            }
        }
        comps.push(c)
      }
    const keep = comps.filter((c) => !c.border && c.x1 - c.x0 + 1 <= 1.2 * r && c.px.length >= 3)
    if (!keep.length) return null
    const bx0 = Math.min(...keep.map((c) => c.x0)), bx1 = Math.max(...keep.map((c) => c.x1))
    const by0 = Math.min(...keep.map((c) => c.y0)), by1 = Math.max(...keep.map((c) => c.y1))
    const mask = new Uint8Array(W * H)
    for (const c of keep) for (const i of c.px) {
      const px = i % W, py = (i - px) / W
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        const nx = px + dx, ny = py + dy
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && (lab[ny * W + nx] === -1 || keep.includes(comps[lab[ny * W + nx]]))) mask[ny * W + nx] = 1
      }
    }
    const h = by1 - by0 + 1
    const m = Math.max(RECOGNISER_CROP.minPadPx, Math.round(RECOGNISER_CROP.padShare * h))
    const OW = bx1 - bx0 + 1 + 2 * m
    const OH = h + 2 * m
    const data = new Uint8ClampedArray(OW * OH).fill(255)
    for (let y = 0; y < OH; y += 1)
      for (let x = 0; x < OW; x += 1) {
        const sx = bx0 - m + x, sy = by0 - m + y
        if (sx >= 0 && sy >= 0 && sx < W && sy < H && mask[sy * W + sx]) data[y * OW + x] = val(sx, sy)
      }
    return { width: OW, height: OH, data }
  }
}

const SCORE_ONLY = process.argv.includes('--score-only')
const engine = SCORE_ONLY ? undefined : await openEngine(workspaceAssetPaths())
const results: Array<Record<string, unknown>> = SCORE_ONLY ? JSON.parse(readFileSync(join(out, `results${TAG}.json`), 'utf8')) : []
const crops: Array<{ key: string; gray: Gray; capPx: number }> = []
if (engine) for (const h of HOUSES) {
  if (only && only !== h.house) continue
  const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(h.pkg, 'utf8')))
  const cache = fileByteCache(h.cache)
  const dir = join(out, h.house)
  mkdirSync(dir, { recursive: true })
  for (const [assetIndex, asset] of pkg.assets.entries()) {
    if (asset.roles.document !== 'FLOOR_PLAN') continue
    const got = await cache.get(selectedVariant(asset).url)
    if (!got) continue
    let raster: Raster
    try {
      raster = decodeImage(got.bytes)
    } catch {
      continue
    }
    if (raster.width !== 853 || raster.height !== 853) continue
    const frame = `${String(assetIndex).padStart(2, '0')}-${asset.roles.storey}`
    const t0 = performance.now()
    const opening = readOpeningCallouts(raster, { frameId: frame })
    const t1 = performance.now()
    const tinted = readTintedCallouts(raster, { frameId: frame, minRadiusPx: 6, maxRadiusPx: 22, requireBar: true })
    const t2 = performance.now()
    console.log(`${h.house} ${frame}: opening ${opening.length} (${opening.filter((c) => c.bar).length} barred, ${Math.round(t1 - t0)} ms), tinted ${tinted.length} (${Math.round(t2 - t1)} ms)`)
    const rings: Ring[] = []
    const add = (c: CalloutReading, reader: 'OPENING' | 'TINTED'): void => {
      if (!c.bar) return
      const rd = { reader, widthCm: c.widthCm, heightCm: c.heightCm, upperText: c.upperText, lowerText: c.lowerText, confidence: c.confidence }
      const near = rings.find((k) => Math.hypot(k.cx - c.circle.cx, k.cy - c.circle.cy) < Math.max(k.r, c.circle.radiusPx))
      if (near) near.readers.push(rd)
      else rings.push({ cx: Math.round(c.circle.cx), cy: Math.round(c.circle.cy), r: Math.round(c.circle.radiusPx), barY: c.bar.y, readers: [rd] })
    }
    for (const c of opening) add(c, 'OPENING')
    for (const c of tinted) add(c, 'TINTED')
    rings.sort((a, b) => a.cy - b.cy || a.cx - b.cx)
    const ink = inkChannel(raster)
    const K = 8
    const tiles: Array<{ ring: Ring; m: number }> = []
    for (const [i, ring] of rings.entries()) {
      const id = `${h.house}/${frame}/r${String(i).padStart(2, '0')}`
      const m = ring.r + 4
      const side = 2 * m + 1
      writePng(join(dir, `${frame}-r${String(i).padStart(2, '0')}.png`), side * K, side * K, (x, y) => {
        const sx = ring.cx - m + Math.floor(x / K)
        const sy = ring.cy - m + Math.floor(y / K)
        if (sx < 0 || sy < 0 || sx >= raster.width || sy >= raster.height) return [255, 255, 255]
        const o = (sy * raster.width + sx) * 4
        return [raster.data[o], raster.data[o + 1], raster.data[o + 2]]
      })
      tiles.push({ ring, m })
      const { upper, lower, refined } = halves(ink, ring)
      const paddle: Record<string, unknown> = {}
      for (const [half, g] of [['upper', upper], ['lower', lower]] as const) {
        if (!g) {
          paddle[half] = null
          continue
        }
        greyPng(join(dir, `${frame}-r${String(i).padStart(2, '0')}-${half}${TAG}.png`), g, 6)
        const s = performance.now()
        const reading = await engine.read({ key: `${id}/${half}`, gray: g, capPx: g.height })
        const ms = performance.now() - s
        const top = reading.topK[0]
        const confident = reading.stable && (top?.p ?? 0) >= OCR_ENSEMBLE_BOUNDS.posterior && reading.greedy.meanP >= OCR_ENSEMBLE_BOUNDS.meanP
        paddle[half] = { text: top?.text ?? '', p: +(top?.p ?? 0).toFixed(4), greedy: reading.greedy.text, meanP: +reading.greedy.meanP.toFixed(4), stable: reading.stable, confident, variants: reading.variants.map((v) => `${v.variant}:${v.top}@${v.p.toFixed(2)}`), ms: +ms.toFixed(1), crop: `${g.width}x${g.height}` }
        crops.push({ key: `${id}/${half}`, gray: g, capPx: g.height })
      }
      results.push({ id, house: h.house, frame, cx: ring.cx, cy: ring.cy, r: ring.r, barY: ring.barY, refined, template: ring.readers, paddle })
    }
    // Contact sheet: tiles row-major, 6 per row, separated by a red gutter; tile i is ring r<i>.
    if (tiles.length) {
      const S = Math.max(...tiles.map((t) => 2 * t.m + 1)) * K
      const cols = Math.min(6, tiles.length)
      const rows = Math.ceil(tiles.length / cols)
      const G = 6
      writePng(join(dir, `${frame}-sheet.png`), cols * (S + G), rows * (S + G), (x, y) => {
        const col = Math.floor(x / (S + G))
        const row = Math.floor(y / (S + G))
        const lx = x - col * (S + G)
        const ly = y - row * (S + G)
        const t = tiles[row * cols + col]
        if (!t || lx >= S || ly >= S) return [220, 0, 0]
        const sx = t.ring.cx - t.m + Math.floor(lx / K)
        const sy = t.ring.cy - t.m + Math.floor(ly / K)
        if (lx >= (2 * t.m + 1) * K || ly >= (2 * t.m + 1) * K || sx < 0 || sy < 0 || sx >= raster.width || sy >= raster.height) return [255, 255, 255]
        const o = (sy * raster.width + sx) * 4
        return [raster.data[o], raster.data[o + 1], raster.data[o + 2]]
      })
    }
  }
}
if (engine) {
await engine.release()
writeFileSync(join(out, only ? `results${TAG}-${only}.json` : `results${TAG}.json`), JSON.stringify(results, null, 1) + '\n')
}
for (const r of results) {
  const p = r.paddle as Record<string, { text: string; p: number; confident: boolean; greedy: string } | null>
  const t = (r.template as Ring['readers']).map((x) => `${x.reader[0]}:${x.upperText || '?'}/${x.lowerText || '?'}`).join(' ')
  console.log(`${r.id} r${r.r} | template ${t} | paddle ${p.upper?.text ?? '-'}/${p.lower?.text ?? '-'} (${p.upper?.p ?? 0}/${p.lower?.p ?? 0}${p.upper?.confident && p.lower?.confident ? ' CONF' : ''}) greedy ${p.upper?.greedy ?? ''}/${p.lower?.greedy ?? ''}`)
}

// Scoring against a hand-made truth table: { "<id>": "300/230" | null (looked at, not a centred callout), "_misfit": [ids] }.
if (truthPath && existsSync(truthPath)) {
  const truth = JSON.parse(readFileSync(truthPath, 'utf8')) as Record<string, unknown>
  const misfit = new Set((truth._misfit as string[] | undefined) ?? [])
  type Half = { text: string; p: number; meanP: number; stable: boolean; confident: boolean; ms: number } | null
  type Row = {
    rings: number; misfit: number; template: number; templateComplete: number; templateCompleteWrong: number
    paddle: number; paddleFit: number; paddleHalves: number; paddleBothConfident: number; paddleBothConfidentCorrect: number
    paddleConfidentHalves: number; paddleConfidentWrong: string[]; agree: number; agreeCorrect: number
    nonCallouts: number; paddlePhantomConfident: string[]; templatePhantom: number; ms: number[]
  }
  const blank = (): Row => ({ rings: 0, misfit: 0, template: 0, templateComplete: 0, templateCompleteWrong: 0, paddle: 0, paddleFit: 0, paddleHalves: 0, paddleBothConfident: 0, paddleBothConfidentCorrect: 0, paddleConfidentHalves: 0, paddleConfidentWrong: [], agree: 0, agreeCorrect: 0, nonCallouts: 0, paddlePhantomConfident: [], templatePhantom: 0, ms: [] })
  const by = new Map<string, Row>()
  for (const r of results) {
    const id = r.id as string
    if (!(id in truth)) continue
    const row = by.get(r.house as string) ?? blank()
    by.set(r.house as string, row)
    const tmpl = r.template as Ring['readers']
    const p = r.paddle as { upper: Half; lower: Half }
    const pw = p.upper?.text ?? ''
    const ph = p.lower?.text ?? ''
    for (const x of [p.upper, p.lower]) if (x) row.ms.push(x.ms)
    const want = truth[id]
    if (want === null) {
      row.nonCallouts += 1
      if (p.upper?.confident && p.lower?.confident && pw.length >= 2 && ph.length >= 2) row.paddlePhantomConfident.push(`${id}: ${pw}/${ph}`)
      if (tmpl.some((x) => x.widthCm !== null && x.heightCm !== null)) row.templatePhantom += 1
      continue
    }
    const [tw, th] = (want as string).split('/')
    row.rings += 1
    if (misfit.has(id)) row.misfit += 1
    if (tmpl.some((x) => x.upperText === tw && x.lowerText === th)) row.template += 1
    const complete = tmpl.filter((x) => x.widthCm !== null && x.heightCm !== null)
    if (complete.length) {
      row.templateComplete += 1
      if (!complete.some((x) => String(x.widthCm) === tw && String(x.heightCm) === th)) row.templateCompleteWrong += 1
    }
    const pOk = pw === tw && ph === th
    if (pOk) row.paddle += 1
    if (pOk && !misfit.has(id)) row.paddleFit += 1
    row.paddleHalves += (pw === tw ? 1 : 0) + (ph === th ? 1 : 0)
    if (p.upper?.confident && p.lower?.confident) {
      row.paddleBothConfident += 1
      if (pOk) row.paddleBothConfidentCorrect += 1
    }
    for (const [half, x, w] of [['upper', p.upper, tw], ['lower', p.lower, th]] as const)
      if (x?.confident) {
        row.paddleConfidentHalves += 1
        if (x.text !== w) row.paddleConfidentWrong.push(`${id} ${half}: read ${x.text} (p ${x.p}), true ${w}`)
      }
    if (tmpl.some((x) => x.upperText === pw && x.lowerText === ph)) {
      row.agree += 1
      if (pOk) row.agreeCorrect += 1
    }
  }
  const score = Object.fromEntries(
    [...by].map(([k, v]) => {
      const ms = [...v.ms].sort((a, b) => a - b)
      const { ms: _drop, ...rest } = v
      return [k, { ...rest, msPerCropMedian: ms[Math.floor(ms.length / 2)], msPerCropMean: +(ms.reduce((a, b) => a + b, 0) / Math.max(1, ms.length)).toFixed(1) }]
    }),
  )
  writeFileSync(join(out, `score${TAG}.json`), JSON.stringify(score, null, 1) + '\n')
  console.log(JSON.stringify(score, null, 1))
}
console.log(`engine load ${engine?.loadMs ?? '-'} ms; ${crops.length} crops`)
