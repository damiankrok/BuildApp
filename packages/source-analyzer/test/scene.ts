/**
 * A whole synthetic project: a package, its bytes, and the analyzer run over
 * them.
 *
 * The mutation tests need to change ONE thing about a project and see what the
 * pipeline does differently, which means they need a project small enough to
 * build in code and complete enough to go through acquisition's own contracts
 * — real PNG bytes, real decoded sizes, real roles, a real sealed package.
 * Anything less and the mutation would be testing the test.
 */
import { PNG } from 'pngjs'
import { sha256Bytes, sha256Hex } from '@buildapp/source-common'
import { SourcePackageSchema, sourcePackageContentHash } from '@buildapp/source-package'
import type { SourceAsset, SourcePackage, SourceRoles } from '@buildapp/source-package'
import type { Raster } from '@buildapp/source-cv'
import { analyzeSourcePackage } from '../src/index.js'
import type { AnalysisResult } from '../src/index.js'

export function encodePng(raster: Raster): Uint8Array {
  const png = new PNG({ width: raster.width, height: raster.height })
  png.data.set(raster.data)
  return new Uint8Array(PNG.sync.write(png))
}

export type SceneDrawing = { slug: string; raster: Raster; roles: Partial<SourceRoles> & { document: SourceRoles['document'] } }

const ROLE_DEFAULTS: SourceRoles = { document: 'UNKNOWN', storey: 'NOT_APPLICABLE', annotation: 'PLAIN', view: 'NOT_APPLICABLE', projection: 'UNKNOWN' }

const PROJECTION: Record<string, SourceRoles['projection']> = { ELEVATION: 'ORTHOGRAPHIC_ELEVATION', FLOOR_PLAN: 'ORTHOGRAPHIC_PLAN', SECTION: 'ORTHOGRAPHIC_SECTION', PERSPECTIVE_RENDER: 'PERSPECTIVE' }

/** Build a sealed package over the drawings, plus the bytes it refers to. */
export function scene(drawings: readonly SceneDrawing[]): { pkg: SourcePackage; bytes: Map<string, { bytes: Uint8Array; mediaType: string }> } {
  const bytes = new Map<string, { bytes: Uint8Array; mediaType: string }>()
  const assets: SourceAsset[] = drawings.map((d) => {
    const encoded = encodePng(d.raster)
    const url = `https://example.test/assets/${d.slug}.png`
    bytes.set(url, { bytes: encoded, mediaType: 'image/png' })
    const roles: SourceRoles = { ...ROLE_DEFAULTS, ...d.roles, projection: d.roles.projection ?? PROJECTION[d.roles.document] ?? 'UNKNOWN' }
    const variant = {
      id: `var-${d.slug}`,
      url,
      discoveredVia: 'https://example.test/project',
      mediaType: 'image/png',
      byteLength: encoded.length,
      byteHash: sha256Bytes(encoded),
      decoded: { width: d.raster.width, height: d.raster.height },
      declaredMismatch: false,
      aspect: Number((d.raster.width / d.raster.height).toFixed(6)),
    }
    return { id: `asset-${d.slug}`, roles, roleEvidence: [], variants: [variant], selectedVariantId: variant.id, selectionReason: 'the only copy found' }
  })

  const draft: Omit<SourcePackage, 'contentHash'> = {
    schema: 'buildapp.source-package',
    schemaVersion: '1.0.0',
    id: 'src-synthetic-0000000000',
    canonicalUrl: 'https://example.test/project',
    pageHash: sha256Hex('synthetic'),
    project: { publisher: 'example.test' },
    adapter: { id: 'example.test', version: '1.0.0' },
    assets,
    publishedFacts: [],
    publishedSpecifications: [],
    publishedRooms: [],
    failures: [],
  }
  return { pkg: SourcePackageSchema.parse({ ...draft, contentHash: sourcePackageContentHash(draft) }), bytes }
}

export const analyseScene = async (drawings: readonly SceneDrawing[]): Promise<AnalysisResult> => {
  const { pkg, bytes } = scene(drawings)
  return analyzeSourcePackage(pkg, { bytes: async (url) => bytes.get(url) ?? null })
}

/** Mirror a raster left-to-right. */
export function mirror(raster: Raster): Raster {
  const out = new Uint8ClampedArray(raster.data.length)
  for (let y = 0; y < raster.height; y += 1) {
    for (let x = 0; x < raster.width; x += 1) {
      const from = (y * raster.width + x) * 4
      const to = (y * raster.width + (raster.width - 1 - x)) * 4
      out[to] = raster.data[from]
      out[to + 1] = raster.data[from + 1]
      out[to + 2] = raster.data[from + 2]
      out[to + 3] = raster.data[from + 3]
    }
  }
  return { width: raster.width, height: raster.height, data: out }
}

/** Box-downscale a raster by an integer factor: a published drawing served at a quarter of its size. */
export function downscale(raster: Raster, factor: number): Raster {
  const width = Math.max(1, Math.floor(raster.width / factor))
  const height = Math.max(1, Math.floor(raster.height / factor))
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let dy = 0; dy < factor; dy += 1) {
        for (let dx = 0; dx < factor; dx += 1) {
          const sx = x * factor + dx
          const sy = y * factor + dy
          if (sx >= raster.width || sy >= raster.height) continue
          const o = (sy * raster.width + sx) * 4
          r += raster.data[o]
          g += raster.data[o + 1]
          b += raster.data[o + 2]
          n += 1
        }
      }
      const o = (y * width + x) * 4
      data[o] = Math.round(r / n)
      data[o + 1] = Math.round(g / n)
      data[o + 2] = Math.round(b / n)
      data[o + 3] = 255
    }
  }
  return { width, height, data }
}

/** Crop a raster: the same drawing, framed differently. */
export function crop(raster: Raster, x0: number, y0: number, width: number, height: number): Raster {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const from = ((y0 + y) * raster.width + (x0 + x)) * 4
      const to = (y * width + x) * 4
      for (let c = 0; c < 4; c += 1) data[to + c] = raster.data[from + c]
    }
  }
  return { width, height, data }
}
