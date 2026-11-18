/**
 * v3.54.11 — derived source packages for the LOCAL image-layer experiment (protocol: LAYERS_PROTOCOL.md).
 *
 *   npx vite-node research/source-to-model/v35411/layers.ts -- --package <pkg.json> --cache <dir> --mode auto|mask
 *        [--masks <masks.json>] --out <dir>
 *
 * Every photographic picture (ELEVATION, PERSPECTIVE_RENDER) is replaced, in every variant, by a derivative of its
 * own decoded pixels; plans, sections, site plans and anything else are passed through byte for byte. The derivative:
 *  - auto: pixels that are sky-blue or vegetation-green AND connected to the picture's border through such pixels are
 *    set to flat white (the background). Nothing else changes — white clouds, the building, its glass, any logo stay.
 *  - mask (MANUAL_MASK_DIAGNOSTIC): every pixel outside a hand-traced building polygon (masks.json, in the selected
 *    variant's pixels, scaled to each variant) is set to flat white. A picture with no polygon is passed through.
 * Inside the kept region every pixel is the original decoded pixel (stored as PNG: lossless). The derivative has its
 * own bytes, hash and URL (`https://derived.invalid/<mode>/<hash>.png`) and goes into its own cache, so it can never
 * be served the original's cached reading; the package's content hash is recomputed. Written beside: the validity
 * mask (white = kept, the observation; black = suppressed), and per picture the pixels changed and the edge pixels the
 * suppression ADDED (a strong gradient in the derivative where the original had none — the mask's boundary), which a
 * reader must not take for architecture.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { cacheKeyFor, decodeImage, fileByteCache, sourcePackageContentHash, SourcePackageSchema } from '@buildapp/source-package'
import type { Raster } from '@buildapp/source-package'
import { encodePng } from '../../../packages/analysis-service/src/diagnostics.js'

const argv = process.argv.slice(2).filter((a) => a !== '--')
const value = (k: string): string | undefined => {
  const i = argv.indexOf(`--${k}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const pkgPath = value('package') as string
const cacheDir = value('cache') as string
const mode = value('mode') as 'auto' | 'mask'
const out = value('out') as string
const masks = value('masks') ? (JSON.parse(readFileSync(value('masks') as string, 'utf8')) as Record<string, { polygons: Array<Array<[number, number]>> }>) : {}
if (!pkgPath || !cacheDir || !out || (mode !== 'auto' && mode !== 'mask')) throw new Error('give --package, --cache, --mode auto|mask, --out')

const PHOTO = new Set(['ELEVATION', 'PERSPECTIVE_RENDER'])
const sha = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex')

function backgroundAuto(r: Raster): Uint8Array {
  const { width: W, height: H, data } = r
  const bg = new Uint8Array(W * H)
  const like = (i: number): boolean => {
    const R = data[4 * i]
    const G = data[4 * i + 1]
    const B = data[4 * i + 2]
    const sky = B > 120 && B >= R + 15 && B >= G - 5
    const veg = G > R + 8 && G > B + 8
    return sky || veg
  }
  const q: number[] = []
  for (let x = 0; x < W; x += 1) for (const y of [0, H - 1]) q.push(y * W + x)
  for (let y = 0; y < H; y += 1) for (const x of [0, W - 1]) q.push(y * W + x)
  while (q.length) {
    const i = q.pop() as number
    if (bg[i] || !like(i)) continue
    bg[i] = 1
    const x = i % W
    const y = (i - x) / W
    if (x > 0) q.push(i - 1)
    if (x < W - 1) q.push(i + 1)
    if (y > 0) q.push(i - W)
    if (y < H - 1) q.push(i + W)
  }
  return bg
}

function backgroundMask(r: Raster, polys: Array<Array<[number, number]>>, sx: number, sy: number): Uint8Array {
  const { width: W, height: H } = r
  const bg = new Uint8Array(W * H).fill(1)
  const inside = (px: number, py: number, poly: Array<[number, number]>): boolean => {
    let c = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = [poly[i][0] * sx, poly[i][1] * sy]
      const [xj, yj] = [poly[j][0] * sx, poly[j][1] * sy]
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c
    }
    return c
  }
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (polys.some((p) => inside(x + 0.5, y + 0.5, p))) bg[y * W + x] = 0
  return bg
}

const lum = (d: Uint8ClampedArray, i: number): number => 0.2126 * d[4 * i] + 0.7152 * d[4 * i + 1] + 0.0722 * d[4 * i + 2]
function edgeMap(r: Raster): Uint8Array {
  const { width: W, height: H, data } = r
  const e = new Uint8Array(W * H)
  for (let y = 1; y < H - 1; y += 1)
    for (let x = 1; x < W - 1; x += 1) {
      const i = y * W + x
      const gx = lum(data, i + 1) - lum(data, i - 1)
      const gy = lum(data, i + W) - lum(data, i - W)
      if (Math.hypot(gx, gy) > 60) e[i] = 1
    }
  return e
}

async function main(): Promise<void> {
  const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(pkgPath, 'utf8')))
  const cache = fileByteCache(cacheDir)
  const outCache = join(out, 'cache')
  mkdirSync(outCache, { recursive: true })
  mkdirSync(join(out, 'derived'), { recursive: true })
  const outCacheApi = fileByteCache(outCache)
  const record: Array<Record<string, unknown>> = []
  const assets = []
  for (const asset of pkg.assets) {
    const photo = PHOTO.has(asset.roles.document)
    const selected = asset.variants.find((v) => v.id === asset.selectedVariantId) ?? asset.variants[0]
    const variants = []
    for (const v of asset.variants) {
      const got = await cache.get(v.url)
      const available = !!got && sha(got.bytes) === v.byteHash
      if (!got || !available) {
        record.push({ asset: asset.id, variant: v.id, role: asset.roles.document, original: v.byteHash, available: false })
        variants.push(v)
        continue
      }
      const polys = masks[asset.id]?.polygons
      if (!photo || (mode === 'mask' && !polys)) {
        // passed through byte for byte (its own cache entry, the same URL and hash)
        for (const ext of ['.bin', '.type', '.url']) {
          const src = join(cacheDir, cacheKeyFor(v.url) + ext)
          if (existsSync(src)) copyFileSync(src, join(outCache, cacheKeyFor(v.url) + ext))
        }
        record.push({ asset: asset.id, variant: v.id, role: asset.roles.document, original: v.byteHash, available: true, derived: false, why: photo ? 'no mask traced for this picture' : 'not a photographic picture: kept as published' })
        variants.push(v)
        continue
      }
      const r = decodeImage(got.bytes)
      const bg = mode === 'auto' ? backgroundAuto(r) : backgroundMask(r, polys as Array<Array<[number, number]>>, r.width / selected.decoded.width, r.height / selected.decoded.height)
      const d = new Uint8ClampedArray(r.data)
      let changed = 0
      for (let i = 0; i < r.width * r.height; i += 1)
        if (bg[i]) {
          if (d[4 * i] !== 255 || d[4 * i + 1] !== 255 || d[4 * i + 2] !== 255) changed += 1
          d[4 * i] = 255
          d[4 * i + 1] = 255
          d[4 * i + 2] = 255
          d[4 * i + 3] = 255
        }
      const dr: Raster = { width: r.width, height: r.height, data: d }
      const eo = edgeMap(r)
      const ed = edgeMap(dr)
      let added = 0
      let keptSame = 0
      let keptAll = 0
      for (let i = 0; i < eo.length; i += 1) {
        if (ed[i] && !eo[i]) added += 1
        if (!bg[i]) {
          keptAll += eo[i]
          if (eo[i] && ed[i]) keptSame += 1
        }
      }
      const bytes = encodePng(dr)
      const h = sha(bytes)
      const url = `https://derived.invalid/${mode}/${h}.png`
      await outCacheApi.put(url, bytes, 'image/png')
      writeFileSync(join(out, 'derived', `${asset.id}-${v.id}.png`), bytes)
      const mask: Raster = { width: r.width, height: r.height, data: new Uint8ClampedArray(r.width * r.height * 4) }
      for (let i = 0; i < r.width * r.height; i += 1) {
        const k = bg[i] ? 0 : 255
        mask.data[4 * i] = k
        mask.data[4 * i + 1] = k
        mask.data[4 * i + 2] = k
        mask.data[4 * i + 3] = 255
      }
      writeFileSync(join(out, 'derived', `${asset.id}-${v.id}.mask.png`), encodePng(mask))
      record.push({ asset: asset.id, variant: v.id, role: asset.roles.document, original: v.byteHash, available: true, derived: true, method: mode === 'auto' ? 'AUTO_BACKGROUND_SKY_VEGETATION@1' : 'MANUAL_MASK_DIAGNOSTIC@1', transform: 'identity: same size and frame; suppressed pixels set to white', derivedHash: h, url, pixels: r.width * r.height, suppressed: Array.from(bg).reduce((a, b) => a + b, 0), changed, edgesAdded: added, edgesKeptInsideKept: `${keptSame}/${keptAll}` })
      variants.push({ ...v, url, mediaType: 'image/png', byteLength: bytes.length, byteHash: h, discoveredVia: `DERIVED:${mode}:${v.byteHash}` })
    }
    // the selected variant keeps its id; ids are names, the bytes are the hash
    assets.push({ ...asset, variants })
  }
  const draft = { ...pkg, assets }
  delete (draft as { contentHash?: string }).contentHash
  const derived = SourcePackageSchema.parse({ ...draft, contentHash: sourcePackageContentHash(draft as never) })
  writeFileSync(join(out, 'package.json'), `${JSON.stringify(derived, null, 1)}\n`)
  writeFileSync(join(out, 'record.json'), `${JSON.stringify({ schema: 'buildapp.v35411-layers/1', mode, sourcePackage: pkg.contentHash, derivedPackage: derived.contentHash, record }, null, 1)}\n`)
  const d = record.filter((x) => x.derived)
  process.stdout.write(`${mode}: ${d.length} variant(s) derived, ${record.filter((x) => x.available === false).length} unavailable; package ${derived.contentHash.slice(0, 12)}\n`)
  for (const x of d) process.stdout.write(`  ${String(x.asset).slice(0, 50)} suppressed ${(Number(x.suppressed) / Number(x.pixels) * 100).toFixed(1)} % edges added ${x.edgesAdded} kept ${x.edgesKeptInsideKept}\n`)
}
main().catch((e) => {
  process.stderr.write(`${(e as Error).stack}\n`)
  process.exit(1)
})
