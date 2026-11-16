/**
 * v3.54.1 strategy C — the same model, the same question and the same source bytes as B, plus enlarged crops of the
 * plans and elevations it is sent (PROTOCOL_V3541 §4, fixed before C was built):
 *  - per FLOOR_PLAN / ELEVATION picture, at most 2 crops of its ORIGINAL raster, chosen by a rule on the picture alone:
 *    (1) the ink's bounding box (white margins, banners and logos at the edges trimmed), (2) the half of that box,
 *    along its longer side, with more ink transitions — where small print (dimension labels) is densest;
 *  - every crop carries its transform: the rectangle in the original's pixels, the scale, a rotation and a mirror
 *    (always 0 / false for these crops, but inverted exactly wherever a crop is named), so a picture number or a
 *    picture edge the answer gives for a crop is mapped back to its parent before admission;
 *  - one request per house; no watermark removal; the original pictures are always sent first and unchanged.
 */
import { sha256Bytes } from '@buildapp/source-common'
import { decodeImage, encodeJpeg } from '@buildapp/source-package'
import type { SourceByteCache } from '@buildapp/source-package'
import { resampleRaster } from '@buildapp/source-cv'
import type { StructuredVision } from '@buildapp/source-vision'

export type Rgba = { width: number; height: number; data: Uint8ClampedArray }
export type Edge = 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT'
export type CropTransform = {
  number: number
  parent: number
  assetId: string
  why: string
  /** In the parent's ORIGINAL pixels. */
  rect: { x: number; y: number; w: number; h: number }
  /** Applied after cropping: rotation clockwise, then a horizontal mirror. */
  rotationDeg: 0 | 90 | 180 | 270
  mirrored: boolean
  /** Output pixels per original pixel. */
  scale: number
  outW: number
  outH: number
  sha256: string
}

export const CROP_MAX_EDGE = 1568
export const CROPS_PER_PICTURE = 2

export function cropRgba(r: Rgba, rect: { x: number; y: number; w: number; h: number }): Rgba {
  const out = new Uint8ClampedArray(rect.w * rect.h * 4)
  for (let y = 0; y < rect.h; y += 1) out.set(r.data.subarray(((rect.y + y) * r.width + rect.x) * 4, ((rect.y + y) * r.width + rect.x + rect.w) * 4), y * rect.w * 4)
  return { width: rect.w, height: rect.h, data: out }
}

export function rotateRgba(r: Rgba, deg: 0 | 90 | 180 | 270): Rgba {
  if (deg === 0) return r
  const w = deg === 180 ? r.width : r.height
  const h = deg === 180 ? r.height : r.width
  const out = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < r.height; y += 1)
    for (let x = 0; x < r.width; x += 1) {
      const [nx, ny] = deg === 90 ? [r.height - 1 - y, x] : deg === 180 ? [r.width - 1 - x, r.height - 1 - y] : [y, r.width - 1 - x]
      out.set(r.data.subarray((y * r.width + x) * 4, (y * r.width + x) * 4 + 4), (ny * w + nx) * 4)
    }
  return { width: w, height: h, data: out }
}

export function mirrorRgba(r: Rgba): Rgba {
  const out = new Uint8ClampedArray(r.data.length)
  for (let y = 0; y < r.height; y += 1) for (let x = 0; x < r.width; x += 1) out.set(r.data.subarray((y * r.width + x) * 4, (y * r.width + x) * 4 + 4), (y * r.width + (r.width - 1 - x)) * 4)
  return { width: r.width, height: r.height, data: out }
}

/** A point of the crop picture (its output pixels) in the parent's original pixels: mirror, rotation and scale inverted. */
export function cropPointToParent(t: CropTransform, px: number, py: number): { x: number; y: number } {
  let x = t.mirrored ? t.outW - px : px
  let y = py
  // undo the clockwise rotation: the rotated picture is outW × outH; before rotation it was (rotated back)
  const [w0, h0] = t.rotationDeg === 90 || t.rotationDeg === 270 ? [t.outH, t.outW] : [t.outW, t.outH]
  if (t.rotationDeg === 90) [x, y] = [y, h0 - x]
  else if (t.rotationDeg === 180) [x, y] = [w0 - x, h0 - y]
  else if (t.rotationDeg === 270) [x, y] = [w0 - y, x]
  return { x: t.rect.x + x / t.scale, y: t.rect.y + y / t.scale }
}

/** Which edge of the parent a named edge of the crop is (the side of the house a reader says is at that edge). */
export function cropEdgeToParent(t: CropTransform, edge: Edge): Edge {
  const mid = { TOP: [t.outW / 2, 0], BOTTOM: [t.outW / 2, t.outH], LEFT: [0, t.outH / 2], RIGHT: [t.outW, t.outH / 2] }[edge] as [number, number]
  const centre = cropPointToParent(t, t.outW / 2, t.outH / 2)
  const p = cropPointToParent(t, mid[0], mid[1])
  const dx = p.x - centre.x
  const dy = p.y - centre.y
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'RIGHT' : 'LEFT') : dy > 0 ? 'BOTTOM' : 'TOP'
}

const lum = (d: Uint8ClampedArray, i: number): number => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]

/** The rule of §4 on one picture: the ink's box, then its denser half. Rectangles in the picture's own pixels. */
export function chooseCrops(r: Rgba): Array<{ rect: { x: number; y: number; w: number; h: number }; why: string }> {
  const rows = new Float64Array(r.height)
  const cols = new Float64Array(r.width)
  for (let y = 0; y < r.height; y += 1)
    for (let x = 0; x < r.width; x += 1)
      if (lum(r.data, (y * r.width + x) * 4) < 160) {
        rows[y] += 1
        cols[x] += 1
      }
  const span = (a: Float64Array, n: number): [number, number] | null => {
    const min = Math.max(2, 0.004 * n)
    let lo = 0
    while (lo < a.length && a[lo] < min) lo += 1
    let hi = a.length - 1
    while (hi > lo && a[hi] < min) hi -= 1
    return hi - lo > 20 ? [lo, hi] : null
  }
  const sy = span(rows, r.width)
  const sx = span(cols, r.height)
  if (!sx || !sy) return []
  const pad = Math.round(0.01 * Math.max(r.width, r.height))
  const x0 = Math.max(0, sx[0] - pad)
  const y0 = Math.max(0, sy[0] - pad)
  const box = { x: x0, y: y0, w: Math.min(r.width, sx[1] + pad + 1) - x0, h: Math.min(r.height, sy[1] + pad + 1) - y0 }
  const out = [{ rect: box, why: 'the ink’s bounding box: margins, banners and edge logos trimmed' }]
  const transitions = (rect: typeof box): number => {
    let n = 0
    for (let y = rect.y; y < rect.y + rect.h; y += 2) {
      let prev = false
      for (let x = rect.x; x < rect.x + rect.w; x += 1) {
        const dark = lum(r.data, (y * r.width + x) * 4) < 160
        if (dark !== prev) n += 1
        prev = dark
      }
    }
    return n
  }
  const halves = box.w >= box.h ? [{ ...box, w: Math.floor(box.w / 2) }, { ...box, x: box.x + Math.floor(box.w / 2), w: box.w - Math.floor(box.w / 2) }] : [{ ...box, h: Math.floor(box.h / 2) }, { ...box, y: box.y + Math.floor(box.h / 2), h: box.h - Math.floor(box.h / 2) }]
  const [a, b] = halves.map(transitions)
  out.push({ rect: a >= b ? halves[0] : halves[1], why: `the ${box.w >= box.h ? (a >= b ? 'left' : 'right') : a >= b ? 'upper' : 'lower'} half of that box, where the ink changes most often (small print)` })
  return out
}

type Sent = { number: number; assetId: string; kind: string; sourceUrl: string | null; widthPx: number; heightPx: number }

/** Replaces every picture number the answer gives for a crop by its parent's, and an edge named on a crop by the parent's edge. */
export function mapAnswerToParents(output: unknown, crops: CropTransform[]): { output: unknown; mapped: string[] } {
  const byNumber = new Map(crops.map((c) => [c.number, c]))
  const mapped: string[] = []
  if (!output || typeof output !== 'object') return { output, mapped }
  const o = JSON.parse(JSON.stringify(output)) as Record<string, unknown>
  const frame = o.frame as { planImage?: number; frontIsPlanEdge?: string } | undefined
  if (frame && typeof frame.planImage === 'number' && byNumber.has(frame.planImage)) {
    const t = byNumber.get(frame.planImage) as CropTransform
    const edge = frame.frontIsPlanEdge as Edge | undefined
    if (edge === 'TOP' || edge === 'BOTTOM' || edge === 'LEFT' || edge === 'RIGHT') frame.frontIsPlanEdge = cropEdgeToParent(t, edge)
    mapped.push(`frame.planImage ${frame.planImage} → ${t.parent}${edge ? `, front edge ${edge} → ${frame.frontIsPlanEdge}` : ''}`)
    frame.planImage = t.parent
  }
  // the inventory lists one entry per picture: the crops' entries are not pictures of the page
  if (Array.isArray(o.images)) {
    const before = (o.images as unknown[]).length
    o.images = (o.images as Array<{ image?: number }>).filter((e) => !(typeof e?.image === 'number' && byNumber.has(e.image)))
    if ((o.images as unknown[]).length !== before) mapped.push(`${before - (o.images as unknown[]).length} inventory entries of crops removed`)
  }
  // every "images" list on an item: crop numbers become their parents', once each
  const walk = (v: unknown, path: string): void => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`))
    else if (v && typeof v === 'object') {
      const r = v as Record<string, unknown>
      if (Array.isArray(r.images) && path !== '') {
        const nums = r.images as unknown[]
        if (nums.some((n) => typeof n === 'number' && byNumber.has(n))) {
          r.images = [...new Set(nums.map((n) => (typeof n === 'number' && byNumber.has(n) ? (byNumber.get(n) as CropTransform).parent : n)))]
          mapped.push(`${path}.images`)
        }
      }
      for (const [k, x] of Object.entries(r)) if (k !== 'images') walk(x, path ? `${path}.${k}` : k)
    }
  }
  for (const [k, v] of Object.entries(o)) if (k !== 'images' && k !== 'frame') walk(v, k)
  return { output: o, mapped }
}

/**
 * The C reader: the description request gets the crops after the originals and one paragraph naming them; the
 * answer's crop references are mapped back to parents. Sorting is not changed. `log` receives the transforms.
 */
export function withCrops(reader: StructuredVision, ctx: { cache: SourceByteCache; log: (entry: { crops: CropTransform[]; mapped: string[] }) => void }): { reader: StructuredVision; onPictures: (sent: Sent[]) => void } {
  let sent: Sent[] = []
  return {
    onPictures: (s) => {
      sent = s.map(({ number, assetId, kind, sourceUrl, widthPx, heightPx }) => ({ number, assetId, kind, sourceUrl, widthPx, heightPx }))
    },
    reader: {
      provider: reader.provider,
      available: () => reader.available(),
      ask: async (request) => {
        if (request.purpose !== 'HOUSE_DESCRIPTION') return reader.ask(request)
        const crops: CropTransform[] = []
        const pictures = [...request.pictures]
        let next = pictures.length + 1
        for (const p of sent.filter((x) => x.kind === 'FLOOR_PLAN' || x.kind === 'ELEVATION')) {
          if (!p.sourceUrl) continue
          const hit = await ctx.cache.get(p.sourceUrl)
          if (!hit) continue
          const original = decodeImage(hit.bytes) as Rgba
          for (const c of chooseCrops(original).slice(0, CROPS_PER_PICTURE)) {
            const piece = cropRgba(original, c.rect)
            const k = Math.min(CROP_MAX_EDGE / Math.max(piece.width, piece.height), 3)
            const out = resampleRaster(piece, { width: Math.max(1, Math.round(piece.width * k)), height: Math.max(1, Math.round(piece.height * k)) })
            const bytes = encodeJpeg(out, 88)
            crops.push({ number: next, parent: p.number, assetId: p.assetId, why: c.why, rect: c.rect, rotationDeg: 0, mirrored: false, scale: Number(k.toFixed(6)), outW: out.width, outH: out.height, sha256: sha256Bytes(bytes) })
            pictures.push({ number: next, bytes, mediaType: 'image/jpeg' })
            next += 1
          }
        }
        if (crops.length === 0) {
          ctx.log({ crops, mapped: [] })
          return reader.ask(request)
        }
        const note = [
          '',
          `Pictures ${crops[0].number}–${crops[crops.length - 1].number} are ENLARGED CROPS of earlier pictures, added so that small print can be read; they are not further pictures of the page:`,
          ...crops.map((c) => `- Picture ${c.number} (${c.outW}×${c.outH} px) = part of picture ${c.parent}: ${c.why}; ×${c.scale.toFixed(2)} of the original drawing's pixels, not rotated, not mirrored.`),
          'Read text and dimensions on them, but answer in the frame of the original pictures: name a crop’s parent picture wherever you name a picture, and list only the original pictures in `images`.',
        ].join('\n')
        const answer = await reader.ask({ ...request, text: `${request.text}\n${note}`, pictures })
        const { output, mapped } = mapAnswerToParents(answer.output, crops)
        ctx.log({ crops, mapped })
        return { ...answer, output }
      },
    },
  }
}
