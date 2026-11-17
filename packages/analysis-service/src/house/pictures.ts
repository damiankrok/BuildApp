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

/** The package's pictures that can be a drawing or a view of the house: decoded, one per distinct bytes, the named roles first. */
export async function housePictures(assets: ReadonlyArray<PackageAsset>, bytes: ByteSource): Promise<{ pictures: HousePicture[]; skipped: Array<{ assetId: string; why: string }> }> {
  const skipped: Array<{ assetId: string; why: string }> = []
  const seen = new Set<string>()
  const rank = (a: PackageAsset): number => {
    const d = a.roles?.document ?? 'UNKNOWN'
    return d === 'FLOOR_PLAN' ? 0 : d === 'ELEVATION' ? 1 : d === 'SECTION' ? 2 : d === 'PERSPECTIVE_RENDER' || d === 'PHOTO' ? 3 : d === 'UNKNOWN' ? 4 : 5
  }
  const ordered = [...assets].sort((p, q) => rank(p) - rank(q) || (q.variants[0]?.decoded ? q.variants[0].decoded.width * q.variants[0].decoded.height : 0) - (p.variants[0]?.decoded ? p.variants[0].decoded.width * p.variants[0].decoded.height : 0))
  const pictures: HousePicture[] = []
  for (const a of ordered) {
    const v = a.variants[0]
    if (!v) continue
    if (pictures.length >= PICTURE_LIMITS.maxPictures) {
      skipped.push({ assetId: a.id, why: `more than ${PICTURE_LIMITS.maxPictures} pictures: not sent` })
      continue
    }
    // a picture the page names as a drawing is taken smaller than one it does not name
    const named = ['FLOOR_PLAN', 'ELEVATION', 'SECTION'].includes(a.roles?.document ?? '')
    const minSide = named ? PICTURE_LIMITS.minDrawingSidePx : PICTURE_LIMITS.minSidePx
    if (v.decoded && Math.min(v.decoded.width, v.decoded.height) < minSide) {
      skipped.push({ assetId: a.id, why: 'too small to be a drawing of the house' })
      continue
    }
    if (v.byteHash && seen.has(v.byteHash)) continue
    const got = await bytes.get(v.url)
    if (!got) {
      skipped.push({ assetId: a.id, why: 'its bytes are not in the cache' })
      continue
    }
    let raster: Raster
    try {
      raster = decodeImage(got.bytes)
    } catch (e) {
      skipped.push({ assetId: a.id, why: `not decoded: ${(e as Error).message.slice(0, 80)}` })
      continue
    }
    if (Math.min(raster.width, raster.height) < minSide) {
      skipped.push({ assetId: a.id, why: 'too small to be a drawing of the house' })
      continue
    }
    if (v.byteHash) seen.add(v.byteHash)
    const n = pictures.length + 1
    pictures.push({ n, id: `p${n}`, assetId: a.id, caption: a.caption ?? '', pageRole: { document: a.roles?.document ?? 'UNKNOWN', storey: a.roles?.storey ?? 'UNKNOWN', view: a.roles?.view ?? 'UNKNOWN' }, width: raster.width, height: raster.height, byteHash: v.byteHash ?? '', raster })
  }
  return { pictures, skipped }
}
