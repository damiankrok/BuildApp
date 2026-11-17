/**
 * v3.54.4 — the pictures of a source package, prepared for the whole-house reading.
 *
 * A picture is sent at one stated size and every coordinate in an answer is in the pixels of what was sent; `scale`
 * takes it back to the published picture's pixels, which is the frame the house document keeps. Small drawings are
 * enlarged (a 700 px elevation read at 1400 px), large ones reduced to the long side the provider reads at full detail.
 * Nothing is drawn on a picture and none is cropped: what is sent is the published picture.
 */
import { decodeImage, encodeJpeg } from '@buildapp/source-package'
import type { Raster } from '@buildapp/source-package'

export type PackageAsset = {
  id: string
  caption?: string
  roles?: { document?: string; storey?: string; view?: string }
  variants: Array<{ url: string; byteHash?: string; decoded?: { width: number; height: number } }>
}
export type ByteSource = { get(url: string): Promise<{ bytes: Uint8Array } | null> }

export type HousePicture = {
  /** Its number in the inventory (1-based) and its name in the house document. */
  n: number
  id: string
  assetId: string
  caption: string
  pageRole: { document: string; storey: string; view: string }
  width: number
  height: number
  byteHash: string
  raster: Raster
}
export type SentPicture = { picture: HousePicture; width: number; height: number; scale: number; jpegBase64: string }

export const PICTURE_LIMITS = { minSidePx: 280, minDrawingSidePx: 180, maxPictures: 24, detailLongSidePx: 1568, thumbLongSidePx: 512, enlargeBelowPx: 900, enlargeFactor: 2 } as const

function resize(src: Raster, width: number, height: number): Raster {
  const out = new Uint8ClampedArray(width * height * 4)
  const sx = src.width / width
  const sy = src.height / height
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const o = (y * width + x) * 4
      if (sx <= 1 && sy <= 1) {
        // enlarging: bilinear
        const fx = Math.min(src.width - 1, Math.max(0, (x + 0.5) * sx - 0.5))
        const fy = Math.min(src.height - 1, Math.max(0, (y + 0.5) * sy - 0.5))
        const x0 = Math.floor(fx)
        const y0 = Math.floor(fy)
        const x1 = Math.min(src.width - 1, x0 + 1)
        const y1 = Math.min(src.height - 1, y0 + 1)
        const tx = fx - x0
        const ty = fy - y0
        for (let c = 0; c < 4; c += 1) {
          const a = src.data[(y0 * src.width + x0) * 4 + c] * (1 - tx) + src.data[(y0 * src.width + x1) * 4 + c] * tx
          const b = src.data[(y1 * src.width + x0) * 4 + c] * (1 - tx) + src.data[(y1 * src.width + x1) * 4 + c] * tx
          out[o + c] = a * (1 - ty) + b * ty
        }
      } else {
        // reducing: the mean of the source pixels under this one
        const xa = Math.floor(x * sx)
        const xb = Math.max(xa + 1, Math.min(src.width, Math.ceil((x + 1) * sx)))
        const ya = Math.floor(y * sy)
        const yb = Math.max(ya + 1, Math.min(src.height, Math.ceil((y + 1) * sy)))
        const sum = [0, 0, 0, 0]
        for (let yy = ya; yy < yb; yy += 1) for (let xx = xa; xx < xb; xx += 1) for (let c = 0; c < 4; c += 1) sum[c] += src.data[(yy * src.width + xx) * 4 + c]
        const n = (xb - xa) * (yb - ya)
        for (let c = 0; c < 4; c += 1) out[o + c] = sum[c] / n
      }
    }
  }
  return { width, height, data: out }
}

/** What is sent of a picture: `detail` for a drawing that is measured on, a thumbnail for the inventory. */
export function sentPicture(picture: HousePicture, mode: 'detail' | 'thumb' | 'context'): SentPicture {
  const long = Math.max(picture.width, picture.height)
  const target = mode === 'thumb' ? PICTURE_LIMITS.thumbLongSidePx : mode === 'context' ? 800 : PICTURE_LIMITS.detailLongSidePx
  let scale = long > target ? target / long : 1
  if (mode === 'detail' && long < PICTURE_LIMITS.enlargeBelowPx) scale = Math.min(PICTURE_LIMITS.enlargeFactor, target / long)
  const width = Math.max(1, Math.round(picture.width * scale))
  const height = Math.max(1, Math.round(picture.height * scale))
  const raster = scale === 1 ? picture.raster : resize(picture.raster, width, height)
  return { picture, width, height, scale: width / picture.width, jpegBase64: Buffer.from(encodeJpeg(raster, 86)).toString('base64') }
}

/** v3.54.6 — what became of each picture of the package that was not sent, by code. */
export type SkipCode = 'TOO_SMALL' | 'NO_BYTES' | 'NOT_DECODED' | 'SAME_PICTURE' | 'LIMIT'
export type SkippedPicture = { assetId: string; why: string; code: SkipCode; role: string }

/**
 * The file name a publisher serves one picture under in every size (`…/1272x715/…/<name>.jpg`, `…/360x240/…/<name>.jpg`):
 * only a long name is taken for an identity — a short one (`image.jpg`) names nothing.
 */
export function renditionKey(url: string): string | undefined {
  const seg = url.split('?')[0].split('#')[0].split('/').pop() ?? ''
  const stem = seg.replace(/\.[a-z0-9]{2,5}$/i, '')
  return stem.length >= 20 ? stem.toLowerCase() : undefined
}

/** The share of a picture's pixels that are grey (a drawing's lines and paper) rather than coloured (a render, a photo). */
export function greyShare(r: Raster): number {
  const step = Math.max(1, Math.floor(Math.sqrt((r.width * r.height) / 40000)))
  let grey = 0
  let n = 0
  for (let y = 0; y < r.height; y += step) {
    for (let x = 0; x < r.width; x += step) {
      const o = (y * r.width + x) * 4
      const hi = Math.max(r.data[o], r.data[o + 1], r.data[o + 2])
      const lo = Math.min(r.data[o], r.data[o + 1], r.data[o + 2])
      if (hi - lo <= 24) grey += 1
      n += 1
    }
  }
  return n ? grey / n : 0
}

/** Renders and photographs the page names that are sent ahead of the unclassified pictures that do not look like drawings. */
export const VIEW_RESERVE = 4
/** An unclassified picture this grey is taken for a drawing candidate (a coloured elevation keeps its paper and lines). */
export const DRAWING_GREY_SHARE = 0.55

/** The package's pictures that can be a drawing or a view of the house: decoded, one per distinct bytes, the named roles first. */
export async function housePictures(assets: ReadonlyArray<PackageAsset>, bytes: ByteSource): Promise<{ pictures: HousePicture[]; skipped: SkippedPicture[] }> {
  const skipped: SkippedPicture[] = []
  const seen = new Set<string>()
  const roleOf = (a: PackageAsset): string => a.roles?.document ?? 'UNKNOWN'
  const rank = (a: PackageAsset): number => {
    const d = roleOf(a)
    return d === 'FLOOR_PLAN' ? 0 : d === 'ELEVATION' ? 1 : d === 'SECTION' ? 2 : d === 'PERSPECTIVE_RENDER' || d === 'PHOTO' ? 3 : d === 'UNKNOWN' ? 4 : 5
  }
  const areaOf = (a: PackageAsset): number => (a.variants[0]?.decoded ? a.variants[0].decoded.width * a.variants[0].decoded.height : 0)
  const ordered = [...assets].sort((p, q) => rank(p) - rank(q) || areaOf(q) - areaOf(p))
  // every picture that can be one: decoded, large enough, one per distinct bytes
  const candidates: Array<{ a: PackageAsset; raster: Raster; byteHash: string }> = []
  for (const a of ordered) {
    const v = a.variants[0]
    if (!v) continue
    // a picture the page names as a drawing is taken smaller than one it does not name
    const named = ['FLOOR_PLAN', 'ELEVATION', 'SECTION'].includes(roleOf(a))
    const minSide = named ? PICTURE_LIMITS.minDrawingSidePx : PICTURE_LIMITS.minSidePx
    const skip = (code: SkipCode, why: string): void => void skipped.push({ assetId: a.id, why, code, role: roleOf(a) })
    if (v.decoded && Math.min(v.decoded.width, v.decoded.height) < minSide) {
      skip('TOO_SMALL', 'too small to be a drawing of the house')
      continue
    }
    if (v.byteHash && seen.has(v.byteHash)) continue
    const got = await bytes.get(v.url)
    if (!got) {
      skip('NO_BYTES', 'its bytes are not in the cache')
      continue
    }
    let raster: Raster
    try {
      raster = decodeImage(got.bytes)
    } catch (e) {
      skip('NOT_DECODED', `not decoded: ${(e as Error).message.slice(0, 80)}`)
      continue
    }
    if (Math.min(raster.width, raster.height) < minSide) {
      skip('TOO_SMALL', 'too small to be a drawing of the house')
      continue
    }
    if (v.byteHash) seen.add(v.byteHash)
    candidates.push({ a, raster, byteHash: v.byteHash ?? '' })
  }
  // v3.54.6 — when the limit takes a choice, the choice is made on pictures, not on files: one published picture served in
  // four sizes is one picture (its largest copy is kept), and the unclassified pictures that look like drawings go ahead
  // of renders and photographs beyond a small reserve. Under the limit nothing is chosen and the order is the one above.
  let chosen = candidates
  if (candidates.length > PICTURE_LIMITS.maxPictures) {
    const byKey = new Map<string, (typeof candidates)[number]>()
    const unique: typeof candidates = []
    for (const c of candidates) {
      const key = renditionKey(c.a.variants[0]?.url ?? '')
      const first = key ? byKey.get(key) : undefined
      if (!first) {
        if (key) byKey.set(key, c)
        unique.push(c)
        continue
      }
      // the larger copy stands; the smaller is said to be the same picture
      const [keep, drop] = c.raster.width * c.raster.height > first.raster.width * first.raster.height ? [c, first] : [first, c]
      if (keep === c) {
        unique[unique.indexOf(first)] = c
        byKey.set(key as string, c)
      }
      skipped.push({ assetId: drop.a.id, why: `the same picture as ${keep.a.id} in another size (one file name, ${drop.raster.width}×${drop.raster.height} against ${keep.raster.width}×${keep.raster.height})`, code: 'SAME_PICTURE', role: roleOf(drop.a) })
    }
    const named = unique.filter((c) => rank(c.a) <= 2)
    const views = unique.filter((c) => rank(c.a) === 3)
    const unknown = unique.filter((c) => rank(c.a) >= 4).map((c) => ({ c, grey: greyShare(c.raster) }))
    const drawingLike = unknown.filter((x) => x.grey >= DRAWING_GREY_SHARE).sort((p, q) => q.grey - p.grey).map((x) => x.c)
    const other = unknown.filter((x) => x.grey < DRAWING_GREY_SHARE).map((x) => x.c)
    chosen = [...named, ...drawingLike, ...views.slice(0, VIEW_RESERVE), ...other, ...views.slice(VIEW_RESERVE)]
    for (const c of chosen.slice(PICTURE_LIMITS.maxPictures)) skipped.push({ assetId: c.a.id, why: `more than ${PICTURE_LIMITS.maxPictures} pictures: not sent (${rank(c.a) <= 2 ? `a ${roleOf(c.a).toLowerCase()} the page names` : rank(c.a) === 3 ? 'a view the page names' : 'its role is not known'})`, code: 'LIMIT', role: roleOf(c.a) })
    chosen = chosen.slice(0, PICTURE_LIMITS.maxPictures)
  }
  const pictures: HousePicture[] = chosen.map(({ a, raster, byteHash }, i) => ({ n: i + 1, id: `p${i + 1}`, assetId: a.id, caption: a.caption ?? '', pageRole: { document: roleOf(a), storey: a.roles?.storey ?? 'UNKNOWN', view: a.roles?.view ?? 'UNKNOWN' }, width: raster.width, height: raster.height, byteHash, raster }))
  return { pictures, skipped }
}
