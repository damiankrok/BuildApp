/**
 * N9-02R (research only, offline, read-only): the research facade reader on every elevation of one sealed source
 * package, beside the N9-02A neutral band, with the ORIGINAL sheet and an overlay of the anchors written OUTSIDE the
 * repository (they carry source pixels). Nothing here feeds a run.
 *
 * Overlay legend: orange box — the traced outline; green vertical — an accepted wall end; red vertical — a refused edge;
 * blue horizontal — the N9-02A neutral band; cyan — eaves; yellow — ground; magenta — ridge; red box — a chimney.
 *   npx vite-node research/analyzer-n9-02r/reader-probe.ts -- --package <source-package.json> --graph <graph.json> --cache <dir> --out <dir>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SourcePackageSchema, decodeImage, fileByteCache, selectedVariant } from '@buildapp/source-package'
import { buildingExtent, skyMask } from '@buildapp/reconstruction'
import type { Raster } from '@buildapp/source-cv'
import { encodePng } from '../../packages/analysis-service/src/diagnostics.js'
import { WALL_BAND_MIN_SHARE, WALL_BAND_MIN_WIDTH, wallBands } from '../../packages/analysis-service/src/assessment/elevation-axes.js'
import { facadeAnchors } from '../../packages/analysis-service/src/assessment/facade-anchors.js'

const arg = (n: string): string => process.argv[process.argv.indexOf(`--${n}`) + 1]
const out = arg('out')
mkdirSync(out, { recursive: true })
const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(arg('package'), 'utf8')))
const graph = JSON.parse(readFileSync(arg('graph'), 'utf8'))
const cache = fileByteCache(arg('cache'))
const rasters = new Map<string, Raster>()
for (const a of pkg.assets) {
  const v = selectedVariant(a)
  const got = await cache.get(v.url)
  if (got) {
    try {
      rasters.set(v.byteHash, decodeImage(got.bytes))
    } catch {
      // undecodable: the view is listed without a reading
    }
  }
}
const rows: unknown[] = []
for (const f of graph.coordinateFrames.filter((x: any) => x.roles.document === 'ELEVATION' && x.roles.projection === 'ORTHOGRAPHIC_ELEVATION')) {
  const r = rasters.get(f.variantByteHash)
  const ext = buildingExtent(f, graph.observations.filter((o: any) => o.frameId === f.id), r)
  if (!r || !ext) {
    rows.push({ frameId: f.id, view: f.roles.view, reading: null, why: !r ? 'no pixels' : 'no outline' })
    continue
  }
  const t0 = performance.now()
  const a = facadeAnchors(r, ext.rect)
  const ms = Math.round(performance.now() - t0)
  const neutral = wallBands(r, ext.rect, undefined, skyMask(r)).filter((b) => !b.clipped && b.share >= WALL_BAND_MIN_SHARE && b.x1 - b.x0 >= WALL_BAND_MIN_WIDTH * (ext.rect.x1 - ext.rect.x0)).sort((p, q) => q.rows - p.rows || q.x1 - q.x0 - (p.x1 - p.x0))[0]
  rows.push({ frameId: f.id, view: f.roles.view, size: f.size, outline: ext.rect, ms, wallEnds: a.wallEnds, neutralBand: neutral ? { x0: neutral.x0, x1: neutral.x1, rows: neutral.rows } : null, rowStats: a.rowStats, candidates: a.candidates.map((c) => ({ side: c.side, x: c.x, y0: c.y0, y1: c.y1, rows: c.rows, lean: c.lean, covered: c.covered, onGround: c.standsOnGround, cut: c.cutLine, accepted: c.accepted, why: c.why.slice(0, 160) })), anchors: a.anchors.map((x) => ({ type: x.type, px: x.px, accepted: x.accepted, why: x.why.slice(0, 120) })) })
  // the original sheet (downscaled, untouched) and the overlay
  const s = Math.max(1, Math.ceil(r.width / 900))
  const w = Math.floor(r.width / s)
  const h = Math.floor(r.height / s)
  const copy = (): Raster => {
    const c: Raster = { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }
    for (let y = 0; y < h; y += 1)
      for (let x = 0; x < w; x += 1) {
        const o = (y * s * r.width + x * s) * 4
        const p = (y * w + x) * 4
        c.data[p] = r.data[o]
        c.data[p + 1] = r.data[o + 1]
        c.data[p + 2] = r.data[o + 2]
        c.data[p + 3] = 255
      }
    return c
  }
  const key = f.id.slice(-10)
  writeFileSync(join(out, `${key}-original.png`), encodePng(copy()))
  const c = copy()
  const put = (x: number, y: number, rgb: number[]): void => {
    const X = Math.round(x / s)
    const Y = Math.round(y / s)
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      if (X + dx < 0 || Y + dy < 0 || X + dx >= w || Y + dy >= h) continue
      const p = ((Y + dy) * w + X + dx) * 4
      c.data[p] = rgb[0]
      c.data[p + 1] = rgb[1]
      c.data[p + 2] = rgb[2]
    }
  }
  const hline = (x0: number, x1: number, y: number, rgb: number[]): void => {
    for (let x = x0; x <= x1; x += s) put(x, y, rgb)
  }
  const vline = (x: number, y0: number, y1: number, rgb: number[]): void => {
    for (let y = y0; y <= y1; y += s) put(x, y, rgb)
  }
  const e = ext.rect
  hline(e.x0, e.x1, e.y0, [255, 140, 0])
  hline(e.x0, e.x1, e.y1, [255, 140, 0])
  vline(e.x0, e.y0, e.y1, [255, 140, 0])
  vline(e.x1, e.y0, e.y1, [255, 140, 0])
  if (neutral) hline(neutral.x0, neutral.x1, Math.round((neutral.y0 + neutral.y1) / 2), [40, 90, 255])
  for (const x of a.anchors) {
    if (x.type === 'OUTER_WALL_END' && x.px.x !== undefined) vline(x.px.x, x.px.y0 ?? e.y0, x.px.y1 ?? e.y1, x.accepted ? [0, 200, 0] : [230, 0, 0])
    if (x.type === 'EAVE' && x.px.y !== undefined) hline(e.x0, e.x1, x.px.y, [0, 220, 220])
    if (x.type === 'GROUND_LINE' && x.px.y !== undefined && x.accepted) hline(e.x0, e.x1, x.px.y, [240, 220, 0])
    if (x.type === 'RIDGE' && x.px.y !== undefined) hline(e.x0, e.x1, x.px.y, [230, 0, 230])
    if (x.type === 'CHIMNEY' && x.px.x0 !== undefined) {
      hline(x.px.x0, x.px.x1 as number, x.px.y0 as number, [230, 0, 0])
      hline(x.px.x0, x.px.x1 as number, x.px.y1 as number, [230, 0, 0])
    }
  }
  writeFileSync(join(out, `${key}-anchors.png`), encodePng(c))
}
writeFileSync(join(out, 'reader.json'), JSON.stringify(rows, null, 1))
console.log(JSON.stringify(rows.map((x: any) => ({ f: x.frameId.slice(-10), v: x.view, state: x.wallEnds?.state, ends: x.wallEnds?.x0 !== undefined ? [x.wallEnds.x0, x.wallEnds.x1] : null, neutral: x.neutralBand ? [x.neutralBand.x0, x.neutralBand.x1] : null, ms: x.ms }))))
