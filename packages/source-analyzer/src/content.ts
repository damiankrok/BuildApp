/**
 * SOURCE-01: what an image SHOWS, read from its pixels, and the one thing that reading may do with it.
 *
 * A publisher's caption, slug and gallery order give each asset its roles (`source-package/roles.ts`). They are right
 * for the drawings and wrong in one systematic way: the gallery's interior renders ("strefa dzienna", "wizualizacja
 * kuchni") are published as visualisations exactly like the exterior views, become `PERSPECTIVE_RENDER`, and reach
 * the exterior camera solver, which fits a house's silhouette to a kitchen. Nothing looked at the pixels.
 *
 * Here a small image encoder (`ImageEmbedder`, MobileNetV4-conv-small on ONNX Runtime, injected by the caller) and a
 * linear head (`content-head.json`, fitted on house-family-separated ARCHON images) give each asset a probability
 * over six kinds of content. The reading never edits a role and never adds a use: it is a **veto**. When the roles send
 * an image to a reader (plan, facade, section, site, exterior camera) and the pixels say, with confidence, that the
 * image is something that reader must not read, the image is kept as a source and taken away from that reader, with
 * the publisher's claim and the pixels' answer both recorded. An uncertain reading changes nothing and says so.
 *
 * The decision is deterministic for given pixels: the tensor is computed here (area resampling, no randomness), the
 * encoder runs single-threaded WebAssembly, and the head is a fixed linear map.
 */
import type { Raster } from '@buildapp/source-cv'
import type { SourceRoles } from '@buildapp/source-package'
import HEAD_JSON from './content-head.json'

/** The kinds of content the head separates. Projection follows: the two perspective kinds against the four drawings. */
export const CONTENT_CLASSES = ['FLOOR_PLAN', 'ELEVATION', 'SECTION', 'SITE_PLAN', 'EXTERIOR_PERSPECTIVE', 'INTERIOR'] as const
export type ContentClass = (typeof CONTENT_CLASSES)[number]

/** The reader a role sends an image to. `NONE`: no reader (UNKNOWN, CHROME, DETAIL). */
export type ContentUse = 'PLAN' | 'FACADE' | 'SECTION' | 'SITE' | 'EXTERIOR_CAMERA' | 'NONE'

/** The runtime seam: a batch of 3×224×224 tensors in, one embedding per tensor out. No runtime is imported here. */
export type ImageEmbedder = {
  readonly id: string
  readonly modelSha256: string
  embed(tensors: Float32Array[], signal?: AbortSignal): Promise<Float32Array[]>
  release?(): Promise<void>
}

export type ContentHead = {
  schema: 'buildapp.image-content-head'
  version: string
  /** The encoder this head was fitted on, by the SHA-256 of its ONNX file: a head is meaningless on another encoder. */
  encoderSha256: string
  classes: ContentClass[]
  /** Standardisation of the embedding, then logits = W · z + b. */
  mean: number[]
  scale: number[]
  weights: number[][]
  bias: number[]
  /** Fitting record: what it was fitted on and how it was checked. Text only. */
  provenance: Record<string, unknown>
}

export const CONTENT_HEAD = HEAD_JSON as unknown as ContentHead
export const CONTENT_INPUT = { size: 224, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] } as const

/**
 * The encoder's input: the whole image (no crop — a facade's ends matter as much as its middle) area-resampled onto
 * 224 × 224, ImageNet-normalised, planar RGB. Transparent pixels are composited on white, as a page shows them.
 */
export function contentTensor(raster: Raster): Float32Array {
  const S = CONTENT_INPUT.size
  const out = new Float32Array(3 * S * S)
  const { width: W, height: H, data } = raster
  const sx = W / S
  const sy = H / S
  for (let oy = 0; oy < S; oy += 1) {
    const y0 = oy * sy
    const y1 = y0 + sy
    for (let ox = 0; ox < S; ox += 1) {
      const x0 = ox * sx
      const x1 = x0 + sx
      let r = 0
      let g = 0
      let b = 0
      let wsum = 0
      for (let y = Math.floor(y0); y < Math.min(H, Math.ceil(y1)); y += 1) {
        const wy = Math.min(y + 1, y1) - Math.max(y, y0)
        if (wy <= 0) continue
        for (let x = Math.floor(x0); x < Math.min(W, Math.ceil(x1)); x += 1) {
          const wx = Math.min(x + 1, x1) - Math.max(x, x0)
          if (wx <= 0) continue
          const w = wx * wy
          const i = (y * W + x) * 4
          const a = data[i + 3] / 255
          r += w * (data[i] * a + 255 * (1 - a))
          g += w * (data[i + 1] * a + 255 * (1 - a))
          b += w * (data[i + 2] * a + 255 * (1 - a))
          wsum += w
        }
      }
      const k = oy * S + ox
      out[k] = (r / wsum / 255 - CONTENT_INPUT.mean[0]) / CONTENT_INPUT.std[0]
      out[S * S + k] = (g / wsum / 255 - CONTENT_INPUT.mean[1]) / CONTENT_INPUT.std[1]
      out[2 * S * S + k] = (b / wsum / 255 - CONTENT_INPUT.mean[2]) / CONTENT_INPUT.std[2]
    }
  }
  return out
}

/** The head's class probabilities for one embedding (softmax of the linear logits). */
export function contentProbabilities(embedding: Float32Array, head: ContentHead = CONTENT_HEAD): number[] {
  if (embedding.length !== head.mean.length) throw new Error(`the embedding has ${embedding.length} values, the head expects ${head.mean.length}`)
  const logits = head.weights.map((row, c) => {
    let s = head.bias[c]
    for (let i = 0; i < row.length; i += 1) s += row[i] * ((embedding[i] - head.mean[i]) / head.scale[i])
    return s
  })
  const m = Math.max(...logits)
  const e = logits.map((l) => Math.exp(l - m))
  const z = e.reduce((a, b) => a + b, 0)
  return e.map((v) => v / z)
}

/** The reader a set of roles sends an image to (what the production path does with it). */
export function useOfRoles(roles: SourceRoles): ContentUse {
  switch (roles.document) {
    case 'FLOOR_PLAN':
      return 'PLAN'
    case 'ELEVATION':
      return roles.projection === 'PERSPECTIVE' ? 'EXTERIOR_CAMERA' : 'FACADE'
    case 'SECTION':
      return 'SECTION'
    case 'SITE_PLAN':
      return 'SITE'
    case 'PERSPECTIVE_RENDER':
      return roles.projection === 'ORTHOGRAPHIC_ELEVATION' ? 'FACADE' : 'EXTERIOR_CAMERA'
    default:
      return 'NONE'
  }
}

/** Which content each reader may read. A reader is never handed content outside its set when the pixels are sure. */
export const READABLE_BY: Record<Exclude<ContentUse, 'NONE'>, readonly ContentClass[]> = {
  PLAN: ['FLOOR_PLAN'],
  FACADE: ['ELEVATION'],
  SECTION: ['SECTION'],
  SITE: ['SITE_PLAN'],
  EXTERIOR_CAMERA: ['EXTERIOR_PERSPECTIVE'],
}

/**
 * How sure the pixels must be to take an image away from its reader: the content the reader may read has at most
 * `maxAllowed` probability AND one other kind has at least `minOther`. Both are needed — a head that is merely unsure
 * (an unusual style, a collage) keeps the publisher's use. Fixed before the TEST houses were scored.
 */
export const CONTENT_VETO = { maxAllowed: 0.05, minOther: 0.9 } as const

export type ContentVerdict = {
  assetId: string
  /** The probability of each kind, rounded to 4 decimals (they are evidence, not a hash input). */
  probabilities: Record<ContentClass, number>
  top: ContentClass
  topProbability: number
  /** Projection the pixels show: perspective (an exterior or interior render) or orthographic (a drawing). */
  projection: 'PERSPECTIVE' | 'ORTHOGRAPHIC' | 'UNKNOWN'
  /** What the publisher's roles make of the image, and what is done with it now. */
  claimedUse: ContentUse
  use: ContentUse
  decision: 'AGREES' | 'VETOED' | 'UNCERTAIN' | 'NO_READER' | 'NOT_CLASSIFIED'
  /** One plain sentence for a person. */
  why: string
}

const LABEL: Record<ContentClass, string> = {
  FLOOR_PLAN: 'a floor plan',
  ELEVATION: 'an orthographic elevation',
  SECTION: 'a section',
  SITE_PLAN: 'a site plan',
  EXTERIOR_PERSPECTIVE: 'an exterior perspective',
  INTERIOR: 'an interior',
}
const READER: Record<ContentUse, string> = { PLAN: 'the plan reader', FACADE: 'the facade reader', SECTION: 'the section reader', SITE: 'the site reader', EXTERIOR_CAMERA: 'the exterior camera check', NONE: 'no reader' }

/** The verdict for one asset: its roles' use, and whether the pixels take the image away from it. */
export function contentVerdict(assetId: string, roles: SourceRoles, probabilities: number[] | undefined, head: ContentHead = CONTENT_HEAD): ContentVerdict {
  const claimedUse = useOfRoles(roles)
  if (!probabilities) {
    return { assetId, probabilities: {} as Record<ContentClass, number>, top: 'FLOOR_PLAN', topProbability: 0, projection: 'UNKNOWN', claimedUse, use: claimedUse, decision: 'NOT_CLASSIFIED', why: 'the pixels were not classified; the publisher’s roles decide alone' }
  }
  const p = Object.fromEntries(head.classes.map((c, i) => [c, Math.round(probabilities[i] * 1e4) / 1e4])) as Record<ContentClass, number>
  let top = head.classes[0]
  for (const c of head.classes) if (p[c] > p[top]) top = c
  const persp = p.EXTERIOR_PERSPECTIVE + p.INTERIOR
  const projection = persp >= CONTENT_VETO.minOther ? 'PERSPECTIVE' : 1 - persp >= CONTENT_VETO.minOther ? 'ORTHOGRAPHIC' : 'UNKNOWN'
  const base = { assetId, probabilities: p, top, topProbability: p[top], projection } as const
  const shows = `the pixels show ${LABEL[top]} (${Math.round(p[top] * 100)} %)`
  if (claimedUse === 'NONE') return { ...base, claimedUse, use: 'NONE', decision: 'NO_READER', why: `no role sends it to a reader; ${shows} — kept as a source only` }
  const allowed = READABLE_BY[claimedUse]
  const allowedP = allowed.reduce((a, c) => a + p[c], 0)
  if (allowed.includes(top)) return { ...base, claimedUse, use: claimedUse, decision: 'AGREES', why: `${shows}, which ${READER[claimedUse]} reads` }
  if (allowedP <= CONTENT_VETO.maxAllowed && p[top] >= CONTENT_VETO.minOther) {
    return { ...base, claimedUse, use: 'NONE', decision: 'VETOED', why: `the publisher’s caption sends it to ${READER[claimedUse]}, but ${shows}; kept as a source, not read as ${LABEL[allowed[0]]}` }
  }
  return { ...base, claimedUse, use: claimedUse, decision: 'UNCERTAIN', why: `${shows}, but not surely enough to overrule the publisher’s caption; ${READER[claimedUse]} reads it` }
}
