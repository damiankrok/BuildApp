/**
 * SOURCE-01: what a picture shows may take it away from a reader, never give it one.
 *
 * The rules are exercised with probabilities written down; the analyzer with a stub encoder whose embeddings the head
 * reads as an interior or a plan (so no publisher pixel is needed); the real encoder only for its contract — it loads
 * from its pin, gives 1280 finite values, the same twice.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SourceRoles } from '@buildapp/source-package'
import { CONTENT_CLASSES, CONTENT_HEAD, CONTENT_VETO, analyzeSourcePackage, contentProbabilities, contentTensor, contentVerdict, useOfRoles } from '../src/index.js'
import type { ContentClass, ImageEmbedder } from '../src/index.js'
import { scene } from './scene.js'
import { BLACK, WALL, fill, rectOutline, sheet } from './draw.js'

const roles = (document: SourceRoles['document'], projection: SourceRoles['projection'] = 'UNKNOWN'): SourceRoles => ({ document, storey: 'UNKNOWN', annotation: 'UNKNOWN', view: 'UNKNOWN', projection })
const probs = (top: ContentClass, p: number): number[] => CONTENT_CLASSES.map((c) => (c === top ? p : (1 - p) / (CONTENT_CLASSES.length - 1)))

describe('SOURCE-01 the veto: pixels take an image away from a reader, never give one', () => {
  it('an interior published as a visualisation is taken from the exterior camera', () => {
    const v = contentVerdict('a', roles('PERSPECTIVE_RENDER', 'PERSPECTIVE'), probs('INTERIOR', 0.99))
    expect(v).toMatchObject({ claimedUse: 'EXTERIOR_CAMERA', use: 'NONE', decision: 'VETOED', top: 'INTERIOR', projection: 'PERSPECTIVE' })
    expect(v.why).toMatch(/caption sends it to the exterior camera check/)
  })

  it('an exterior perspective captioned as an elevation is taken from the facade reader', () => {
    expect(contentVerdict('a', roles('ELEVATION', 'ORTHOGRAPHIC_ELEVATION'), probs('EXTERIOR_PERSPECTIVE', 0.97))).toMatchObject({ use: 'NONE', decision: 'VETOED' })
  })

  it('agreement keeps the use', () => {
    expect(contentVerdict('a', roles('FLOOR_PLAN'), probs('FLOOR_PLAN', 0.99))).toMatchObject({ use: 'PLAN', decision: 'AGREES' })
  })

  it('an unsure reading keeps the publisher’s use and says so', () => {
    const v = contentVerdict('a', roles('ELEVATION', 'ORTHOGRAPHIC_ELEVATION'), probs('EXTERIOR_PERSPECTIVE', CONTENT_VETO.minOther - 0.05))
    expect(v).toMatchObject({ use: 'FACADE', decision: 'UNCERTAIN' })
  })

  it('a reader’s own content above the veto floor is never vetoed, however sure the other kind is', () => {
    const p = CONTENT_CLASSES.map((c) => (c === 'INTERIOR' ? 0.9 : c === 'EXTERIOR_PERSPECTIVE' ? CONTENT_VETO.maxAllowed + 0.01 : 0.0))
    expect(contentVerdict('a', roles('PERSPECTIVE_RENDER', 'PERSPECTIVE'), p).decision).toBe('UNCERTAIN')
  })

  it('an image no role sends anywhere stays a source only, whatever its pixels say', () => {
    expect(contentVerdict('a', roles('UNKNOWN'), probs('FLOOR_PLAN', 1))).toMatchObject({ claimedUse: 'NONE', use: 'NONE', decision: 'NO_READER' })
  })

  it('without probabilities the roles decide alone', () => {
    expect(contentVerdict('a', roles('PERSPECTIVE_RENDER', 'PERSPECTIVE'), undefined)).toMatchObject({ use: 'EXTERIOR_CAMERA', decision: 'NOT_CLASSIFIED' })
  })

  it('a render an adapter declares orthographic is a facade use, as the analyzer reads it', () => {
    expect(useOfRoles(roles('PERSPECTIVE_RENDER', 'ORTHOGRAPHIC_ELEVATION'))).toBe('FACADE')
  })
})

describe('SOURCE-01 the tensor and the head', () => {
  it('the tensor is the whole picture on 224 × 224, ImageNet-normalised, deterministic', () => {
    const r = sheet(300, 200)
    fill(r, 0, 0, 150, 200, [0, 0, 0])
    const a = contentTensor(r)
    expect(a.length).toBe(3 * 224 * 224)
    expect(Array.from(a)).toEqual(Array.from(contentTensor(r)))
    // the left half black, the right half white, in every channel
    expect(a[10]).toBeCloseTo((0 - 0.485) / 0.229, 5)
    expect(a[200]).toBeCloseTo((1 - 0.485) / 0.229, 5)
  })

  it('the head is fitted on the pinned encoder and covers the six kinds', () => {
    const manifest = JSON.parse(readFileSync(join(__dirname, '../../numeric-recogniser-ort/models/image-role.json'), 'utf8')) as { sha256: string; output: { values: number } }
    expect(CONTENT_HEAD.encoderSha256).toBe(manifest.sha256)
    expect(CONTENT_HEAD.classes).toEqual([...CONTENT_CLASSES])
    expect(CONTENT_HEAD.mean).toHaveLength(manifest.output.values)
    expect(CONTENT_HEAD.weights.every((w) => w.length === manifest.output.values)).toBe(true)
  })
})

/** An embedding the head reads as `kind` with near certainty: its standardised value along that class's weights. */
function embeddingFor(kind: ContentClass): Float32Array {
  const c = CONTENT_HEAD.classes.indexOf(kind)
  const w = CONTENT_HEAD.weights[c]
  const norm = Math.sqrt(w.reduce((a, v) => a + v * v, 0))
  return Float32Array.from(w.map((v, i) => CONTENT_HEAD.mean[i] + CONTENT_HEAD.scale[i] * (40 * v) / norm))
}
const stub = (kinds: ContentClass[]): ImageEmbedder => ({ id: 'stub', modelSha256: '0'.repeat(64), embed: async (t) => t.map((_, i) => embeddingFor(kinds[i])) })

describe('SOURCE-01 the analyzer with an encoder', () => {
  const facade = (): ReturnType<typeof sheet> => {
    const r = sheet(900, 460)
    fill(r, 40, 60, 860, 420, WALL)
    rectOutline(r, 40, 60, 860, 420, BLACK)
    return r
  }

  it('the stub reads as intended', () => {
    expect(contentProbabilities(embeddingFor('INTERIOR'))[CONTENT_CLASSES.indexOf('INTERIOR')]).toBeGreaterThan(0.99)
    expect(contentProbabilities(embeddingFor('ELEVATION'))[CONTENT_CLASSES.indexOf('ELEVATION')]).toBeGreaterThan(0.99)
  })

  it('a vetoed picture gets no frame and is skipped by name; the others are read as before', async () => {
    const { pkg, bytes } = scene([
      { slug: 'front', raster: facade(), roles: { document: 'ELEVATION', view: 'FRONT' } },
      { slug: 'kitchen', raster: facade(), roles: { document: 'PERSPECTIVE_RENDER', view: 'UNKNOWN' } },
    ])
    const ids = [...pkg.assets].sort((a, b) => a.id.localeCompare(b.id)).map((a) => a.id)
    const kinds = ids.map((id) => (id.includes('kitchen') ? 'INTERIOR' : 'ELEVATION') as ContentClass)
    const withContent = await analyzeSourcePackage(pkg, { bytes: async (u) => bytes.get(u) ?? null, content: stub(kinds) })
    const without = await analyzeSourcePackage(pkg, { bytes: async (u) => bytes.get(u) ?? null })
    const kitchen = ids.find((id) => id.includes('kitchen')) as string
    const front = ids.find((id) => id.includes('front')) as string
    expect(withContent.graph.coordinateFrames.some((f) => f.assetId === kitchen)).toBe(false)
    expect(without.graph.coordinateFrames.some((f) => f.assetId === kitchen)).toBe(true)
    expect(withContent.skipped.find((s) => s.assetId === kitchen)?.reason).toMatch(/^content: .*interior/)
    expect(withContent.content.find((c) => c.assetId === kitchen)).toMatchObject({ decision: 'VETOED', use: 'NONE' })
    expect(withContent.content.find((c) => c.assetId === front)).toMatchObject({ decision: 'AGREES', use: 'FACADE' })
    expect(withContent.contentClassifier).toMatchObject({ id: 'stub', headVersion: CONTENT_HEAD.version })
    // the elevation's reading does not change
    const obs = (r: typeof without): string => JSON.stringify(r.graph.observations.filter((o) => o.frameId === r.graph.coordinateFrames.find((f) => f.assetId === front)?.id))
    expect(obs(withContent)).toBe(obs(without))
    expect(without.contentClassifier).toBeNull()
    expect(without.content.every((c) => c.decision === 'NOT_CLASSIFIED')).toBe(true)
  })
})
