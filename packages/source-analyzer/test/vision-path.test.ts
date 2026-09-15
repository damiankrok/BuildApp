/**
 * The vision path, end to end, with no key and no network.
 *
 * A recorded answer about a synthetic drawing goes through the same request
 * shaping, the same validation and the same conversion a live answer gets, and
 * lands in the graph beside what the deterministic extractors found. That is
 * the claim this file checks, and the second half of it — BESIDE, not instead
 * of — is the one that matters: the CV extractors run first and run whether or
 * not a provider is configured.
 *
 * The fixture here is hand-authored about a picture built in this file. It is
 * NOT a recorded answer about the benchmark's real drawings, and there is
 * deliberately no such fixture anywhere in the repository: writing one would be
 * a person doing the vision work and the pipeline taking the credit.
 */
import { describe, expect, it } from 'vitest'
import { sha256Bytes } from '@buildapp/source-common'
import { fixtureKey, fixtureVisionReasoner, nullVisionReasoner } from '@buildapp/source-vision'
import type { VisionFixtureRecord } from '@buildapp/source-vision'
import { analyzeSourcePackage } from '../src/index.js'
import { encodePng, scene } from './scene.js'
import { BLACK, WALL, fill, line, rectOutline, sheet } from './draw.js'

const RECORDED_FROM = { id: 'vision.handwritten', model: 'none', version: '1.0.0' }

function facade(): ReturnType<typeof sheet> {
  const r = sheet(800, 400)
  fill(r, 40, 40, 760, 360, WALL)
  rectOutline(r, 40, 40, 760, 360, BLACK)
  fill(r, 80, 120, 720, 150, [198, 192, 182])
  line(r, 80, 120, 720, 120, BLACK)
  line(r, 80, 150, 720, 150, BLACK)
  fill(r, 80, 151, 720, 160, [148, 144, 136])
  return r
}

/** A hand-authored answer about the picture above: one member and one opening, with a relation. */
const answer = (byteHash: string): VisionFixtureRecord => ({
  key: fixtureKey('FACADE_DECOMPOSITION', byteHash),
  task: 'FACADE_DECOMPOSITION',
  assetByteHash: byteHash,
  recordedFrom: RECORDED_FROM,
  recordedNote: 'hand-authored for this test against a synthetic facade; not a recording of any real drawing',
  response: {
    task: 'FACADE_DECOMPOSITION',
    assetByteHash: byteHash,
    observations: [
      {
        kind: 'LINEAR_VOLUME_CANDIDATE',
        semanticHints: ['beam', 'facade-frame'],
        geometry: { type: 'RECT', points: [[0.1, 0.3], [0.9, 0.375]] },
        depthLayer: 'PROUD_OF_WALL',
        confidence: 0.85,
        positionUncertaintyNorm: 0.006,
        angleUncertaintyDeg: 1.5,
        evidence: 'a dark strip runs the full length under the band and stops where the band stops: a cast shadow',
        alternatives: [{ why: 'it could be a painted band with a drawn shadow, if this elevation uses shadow as a convention', confidence: 0.2 }],
      },
      {
        kind: 'OPENING',
        semanticHints: ['reveal'],
        geometry: { type: 'RECT', points: [[0.2, 0.55], [0.35, 0.8]] },
        confidence: 0.6,
        positionUncertaintyNorm: 0.012,
        evidence: 'a rectangular hole in the wall below the band',
      },
    ],
    relations: [{ kind: 'ABOVE', from: 0, to: 1, confidence: 0.9, why: 'the member is drawn above the opening' }],
    notFound: ['any balcony or loggia on this facade'],
    notes: ['the wall is otherwise unrelieved'],
  },
})

const drawing = { slug: 'front', raster: facade(), roles: { document: 'ELEVATION' as const, view: 'FRONT' as const } }

describe('a recorded answer joins the graph beside the deterministic reading', () => {
  it('lands as observations on the frame the analyzer chose, carrying the provider version', async () => {
    const { pkg, bytes } = scene([drawing])
    const byteHash = sha256Bytes(encodePng(drawing.raster))
    const vision = fixtureVisionReasoner([answer(byteHash)])
    const result = await analyzeSourcePackage(pkg, { bytes: async (url) => bytes.get(url) ?? null, vision })

    expect(result.vision.attempted).toBe(1)
    expect(result.vision.accepted).toBe(1)
    expect(result.vision.rejected).toEqual([])

    const fromVision = result.graph.observations.filter((o) => o.provenance.extractor === 'VISION_MODEL')
    const fromCv = result.graph.observations.filter((o) => o.provenance.extractor === 'DETERMINISTIC_CV')
    expect(fromVision).toHaveLength(2)
    expect(fromCv.length).toBeGreaterThan(0)

    const beam = fromVision.find((o) => o.kind === 'LINEAR_VOLUME_CANDIDATE')
    expect(beam?.pixelGeometry).toEqual({ type: 'RECT', rect: { x0: 80, y0: 120, x1: 720, y1: 150 } })
    expect(beam?.semanticHints).toEqual(['beam', 'facade-frame'])
    expect(beam?.alternatives[0].why).toMatch(/painted band/)
    expect(beam?.provenance.name).toBe('vision.fixture/recorded@facade-decomposition')
    expect(result.graph.extractors.some((e) => e.kind === 'VISION_MODEL' && e.version.includes('contract-1.0.0'))).toBe(true)

    // what the provider looked for and did not find is a named gap, not silence
    expect(result.graph.unresolved.some((u) => u.what.includes('any balcony or loggia'))).toBe(true)
  })

  it('finds the SAME member with the CV extractor, and keeps the two readings apart', async () => {
    const { pkg, bytes } = scene([drawing])
    const byteHash = sha256Bytes(encodePng(drawing.raster))
    const result = await analyzeSourcePackage(pkg, { bytes: async (url) => bytes.get(url) ?? null, vision: fixtureVisionReasoner([answer(byteHash)]) })
    const members = result.graph.observations.filter((o) => o.kind === 'LINEAR_VOLUME_CANDIDATE')
    expect(members.length).toBeGreaterThanOrEqual(2)
    expect(new Set(members.map((o) => o.provenance.extractor))).toEqual(new Set(['DETERMINISTIC_CV', 'VISION_MODEL']))
    // two extractors that see the same edge produce two observations on purpose
    expect(new Set(members.map((o) => o.id)).size).toBe(members.length)
  })

  it('runs the deterministic extractors whether or not a provider is configured, and says which happened', async () => {
    const { pkg, bytes } = scene([drawing])
    const withVision = await analyzeSourcePackage(pkg, { bytes: async (url) => bytes.get(url) ?? null, vision: fixtureVisionReasoner([answer(sha256Bytes(encodePng(drawing.raster)))]) })
    const without = await analyzeSourcePackage(pkg, { bytes: async (url) => bytes.get(url) ?? null })

    const cvOf = (r: typeof without): number => r.graph.observations.filter((o) => o.provenance.extractor === 'DETERMINISTIC_CV').length
    expect(cvOf(without)).toBe(cvOf(withVision))
    expect(without.vision.provider).toBeNull()
    expect(without.graph.observations.every((o) => o.provenance.extractor !== 'VISION_MODEL')).toBe(true)
    expect(without.graph.unresolved.some((u) => u.what === 'a vision pass over this package' && u.status === 'NOT_ATTEMPTED')).toBe(true)
    expect(withVision.graph.contentHash).not.toBe(without.graph.contentHash)
  })

  it('records an unavailable provider as a gap rather than as an empty reading', async () => {
    const { pkg, bytes } = scene([drawing])
    const result = await analyzeSourcePackage(pkg, { bytes: async (url) => bytes.get(url) ?? null, vision: nullVisionReasoner('no key in this environment') })
    expect(result.vision.accepted).toBe(0)
    expect(result.vision.unavailable).toHaveLength(1)
    expect(result.vision.unavailable[0].reason).toBe('NO_PROVIDER')
    expect(result.graph.unresolved.some((u) => u.reason.includes('no key in this environment'))).toBe(true)
  })

  it('refuses a recorded answer about different bytes, so a fixture cannot describe the wrong picture', async () => {
    const { pkg, bytes } = scene([drawing])
    const result = await analyzeSourcePackage(pkg, { bytes: async (url) => bytes.get(url) ?? null, vision: fixtureVisionReasoner([answer('e'.repeat(64))]) })
    expect(result.vision.accepted).toBe(0)
    expect(result.vision.unavailable[0].reason).toBe('NO_FIXTURE')
    expect(result.graph.observations.every((o) => o.provenance.extractor !== 'VISION_MODEL')).toBe(true)
  })
})
