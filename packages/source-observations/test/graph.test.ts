/**
 * The observation graph's contract: deterministic ids, geometry that agrees
 * with the frame it claims to be on, relations that agree with the picture,
 * uncertainty that a solver can use, and a hash that depends on the reading
 * and nothing else.
 */
import { describe, expect, it } from 'vitest'
import {
  ObservationGraphBuilder,
  OBSERVATION_GRAPH_SCHEMA,
  SourceObservationGraphSchema,
  frameId,
  graphHashIsIntact,
  normalizeGeometry,
  observationGraphContentHash,
  observationId,
  parseObservationGraph,
  stripSeal,
  validateObservationGraph,
  errorsOnly,
} from '../src/index.js'
import type { ExtractorHandle, FrameRoles, SourceObservationGraph } from '../src/index.js'

const BYTES_A = 'a'.repeat(64)
const BYTES_B = 'b'.repeat(64)
const PKG = 'srcpkg-example-0123456789'
const PKG_HASH = 'c'.repeat(64)

const ELEVATION_ROLES: FrameRoles = { document: 'ELEVATION', storey: 'NOT_APPLICABLE', annotation: 'PLAIN', view: 'FRONT', projection: 'ORTHOGRAPHIC_ELEVATION' }
const PLAN_ROLES: FrameRoles = { document: 'FLOOR_PLAN', storey: 'GROUND', annotation: 'DIMENSIONED', view: 'NOT_APPLICABLE', projection: 'ORTHOGRAPHIC_PLAN' }

function scene(): { b: ObservationGraphBuilder; cv: ExtractorHandle; frame: ReturnType<ObservationGraphBuilder['declareFrame']> } {
  const b = new ObservationGraphBuilder(PKG, PKG_HASH)
  const cv = b.declareExtractor('cv.axis-lines', '1.0.0', 'DETERMINISTIC_CV')
  const frame = b.declareFrame('asset-front', BYTES_A, { width: 1000, height: 500 }, ELEVATION_ROLES)
  return { b, cv, frame }
}

const beam = (x0: number) =>
  ({
    kind: 'LINEAR_VOLUME_CANDIDATE' as const,
    pixelGeometry: { type: 'RECT' as const, rect: { x0, y0: 100, x1: x0 + 300, y1: 140 } },
    semanticHints: ['beam' as const, 'facade-frame' as const],
    depthLayer: 'PROUD_OF_WALL' as const,
    confidence: 0.7,
    uncertainty: { positionPx: 3, angleDeg: 1 },
    detail: 'a band of ink 40px deep with shadow below it',
  })

describe('deterministic ids', () => {
  it('gives the same observation the same id across two independent builds', () => {
    const one = scene()
    const first = one.b.observe(one.cv, { frame: one.frame, ...beam(200) })
    const two = scene()
    const second = two.b.observe(two.cv, { frame: two.frame, ...beam(200) })
    expect(second.id).toBe(first.id)
  })

  it('renames an observation when its geometry moves, and not when its prose changes', () => {
    const { b, cv, frame } = scene()
    const base = b.observe(cv, { frame, ...beam(200) })
    const moved = b.observe(cv, { frame, ...beam(240) })
    const reworded = b.observe(cv, { frame, ...beam(200), detail: 'the same band, described differently' })
    expect(moved.id).not.toBe(base.id)
    expect(reworded.id).toBe(base.id)
  })

  it('is independent of the order semantic hints were listed in', () => {
    const { b, cv, frame } = scene()
    const a = b.observe(cv, { frame, ...beam(200), semanticHints: ['beam', 'facade-frame'] })
    const c = b.observe(cv, { frame, ...beam(200), semanticHints: ['facade-frame', 'beam', 'beam'] })
    expect(c.id).toBe(a.id)
    expect(b.observationCount).toBe(1)
  })

  it('separates the same reading on two different byte copies of a drawing', () => {
    const { b, cv, frame } = scene()
    const other = b.declareFrame('asset-front', BYTES_B, { width: 2000, height: 1000 }, ELEVATION_ROLES)
    const a = b.observe(cv, { frame, ...beam(200) })
    const c = b.observe(cv, { frame: other, ...beam(400), pixelGeometry: { type: 'RECT', rect: { x0: 400, y0: 200, x1: 1000, y1: 280 } } })
    // The same feature, normalized identically, is still two observations,
    // because it was read off two different sets of bytes.
    expect(c.normGeometry).toEqual(a.normGeometry)
    expect(c.id).not.toBe(a.id)
    expect(frameId('asset-front', BYTES_A)).not.toBe(frameId('asset-front', BYTES_B))
  })

  it('separates two extractors that see the same edge', () => {
    const { b, cv, frame } = scene()
    const vlm = b.declareExtractor('vision.fixture', '1.0.0', 'VISION_MODEL')
    const a = b.observe(cv, { frame, ...beam(200) })
    const c = b.observe(vlm, { frame, ...beam(200) })
    expect(c.id).not.toBe(a.id)
  })

  it('computes normalized geometry from the frame, and refuses an undeclared frame', () => {
    const { b, cv, frame } = scene()
    const o = b.observe(cv, { frame, ...beam(200) })
    expect(o.normGeometry).toEqual({ type: 'RECT', rect: { x0: 0.2, y0: 0.2, x1: 0.5, y1: 0.28 } })
    const foreign = { ...frame, id: 'frame-not-registered' }
    expect(() => b.observe(cv, { frame: foreign, ...beam(200) })).toThrow(/was not declared/)
  })

  it('refuses an extractor declared at two versions', () => {
    const { b } = scene()
    expect(() => b.declareExtractor('cv.axis-lines', '2.0.0', 'DETERMINISTIC_CV')).toThrow(/already declared at version 1\.0\.0/)
  })
})

describe('sealing', () => {
  it('seals a schema-valid, self-consistent graph', () => {
    const { b, cv, frame } = scene()
    const a = b.observe(cv, { frame, ...beam(200) })
    const below = b.observe(cv, {
      frame,
      kind: 'OPENING',
      pixelGeometry: { type: 'RECT', rect: { x0: 220, y0: 200, x1: 320, y1: 320 } },
      semanticHints: ['reveal'],
      confidence: 0.8,
      uncertainty: { positionPx: 2 },
      detail: 'a closed rectangle of ink',
    })
    b.relate(cv, { kind: 'BELOW', from: below, to: a, confidence: 0.95, why: 'its centroid is lower in the image' })
    b.conflict({ observations: [a, below], kind: 'PRESENCE', what: 'whether the band is a beam or a lintel over the opening' })
    b.unresolved('depth of the facade frame', 'no section cuts through it', 'MISSING', 'asset-front')
    const graph = b.seal()
    expect(() => SourceObservationGraphSchema.parse(graph)).not.toThrow()
    expect(graph.schema).toBe(OBSERVATION_GRAPH_SCHEMA)
    expect(validateObservationGraph(graph, { checkHash: true })).toEqual([])
    expect(graphHashIsIntact(graph)).toBe(true)
    expect(() => parseObservationGraph(JSON.parse(JSON.stringify(graph)))).not.toThrow()
  })

  it('sorts every collection by id, so two runs produce identical files', () => {
    const build = (reverse: boolean): SourceObservationGraph => {
      const { b, cv, frame } = scene()
      const xs = [200, 500, 320, 60]
      for (const x of reverse ? [...xs].reverse() : xs) b.observe(cv, { frame, ...beam(x) })
      return b.seal()
    }
    const forward = build(false)
    const backward = build(true)
    expect(JSON.stringify(backward)).toBe(JSON.stringify(forward))
    expect([...forward.observations].map((o) => o.id)).toEqual([...forward.observations].map((o) => o.id).sort())
  })
})

describe('normalized coordinate validation', () => {
  const sealedWith = (mutate: (g: SourceObservationGraph) => void): SourceObservationGraph => {
    const { b, cv, frame } = scene()
    b.observe(cv, { frame, ...beam(200) })
    const graph = JSON.parse(JSON.stringify(b.seal())) as SourceObservationGraph
    mutate(graph)
    return graph
  }

  it('catches normalized coordinates that disagree with the pixels they claim to come from', () => {
    const graph = sealedWith((g) => {
      const n = g.observations[0].normGeometry
      if (n.type === 'RECT') n.rect.x1 = 0.9
    })
    expect(errorsOnly(validateObservationGraph(graph, { checkIds: false })).map((i) => i.code)).toContain('NORMALIZED_DISAGREES_WITH_PIXELS')
  })

  it('catches a reading placed outside the image it claims to be on', () => {
    const graph = sealedWith((g) => {
      const o = g.observations[0]
      if (o.pixelGeometry.type === 'RECT') o.pixelGeometry.rect.x1 = 1400
      o.normGeometry = normalizeGeometry(o.pixelGeometry, { width: 1000, height: 500 })
    })
    const codes = errorsOnly(validateObservationGraph(graph, { checkIds: false })).map((i) => i.code)
    expect(codes).toContain('OUT_OF_BOUNDS')
  })

  it('allows a reading that sits on the very edge of the image', () => {
    const { b, cv, frame } = scene()
    b.observe(cv, { frame, ...beam(0), pixelGeometry: { type: 'RECT', rect: { x0: 0, y0: 0, x1: 1000, y1: 500 } } })
    expect(() => b.seal()).not.toThrow()
  })

  it('catches a pixel and normalized geometry of different shapes', () => {
    const graph = sealedWith((g) => {
      g.observations[0].normGeometry = { type: 'POINT', point: { x: 0.2, y: 0.2 } }
    })
    expect(errorsOnly(validateObservationGraph(graph, { checkIds: false })).map((i) => i.code)).toContain('GEOMETRY_TYPE_MISMATCH')
  })

  it('catches an observation on a frame the graph does not define, and on the wrong bytes', () => {
    const missing = sealedWith((g) => {
      g.observations[0].frameId = 'frame-elsewhere'
    })
    expect(errorsOnly(validateObservationGraph(missing, { checkIds: false })).map((i) => i.code)).toContain('FRAME_MISSING')
    const wrongBytes = sealedWith((g) => {
      g.observations[0].variantByteHash = BYTES_B
    })
    expect(errorsOnly(validateObservationGraph(wrongBytes, { checkIds: false })).map((i) => i.code)).toContain('FRAME_BYTES_MISMATCH')
  })

  it('catches an id that was not derived from its content', () => {
    const graph = sealedWith((g) => {
      const old = g.observations[0].id
      g.observations[0].id = 'obs-handwritten'
      for (const r of g.relations) {
        if (r.from === old) r.from = 'obs-handwritten'
      }
    })
    expect(errorsOnly(validateObservationGraph(graph, { checkIds: true })).map((i) => i.code)).toContain('OBSERVATION_ID_NOT_DERIVED')
  })

  it('catches an extractor that never declared itself, so its version is not in the hash', () => {
    const graph = sealedWith((g) => {
      g.extractors = []
    })
    expect(errorsOnly(validateObservationGraph(graph, { checkIds: false })).map((i) => i.code)).toContain('EXTRACTOR_UNDECLARED')
  })
})

describe('relation validation', () => {
  it('refuses a within-view relation whose ends are in two different views', () => {
    const { b, cv, frame } = scene()
    const other = b.declareFrame('asset-plan', BYTES_B, { width: 800, height: 800 }, PLAN_ROLES)
    const a = b.observe(cv, { frame, ...beam(200) })
    const c = b.observe(cv, { frame: other, ...beam(200) })
    b.relate(cv, { kind: 'PROUD_OF', from: a, to: c, confidence: 0.6, why: 'it casts a shadow' })
    expect(() => b.seal()).toThrow(/RELATION_CROSSES_VIEWS/)
  })

  it('refuses an identity relation that does not actually cross views', () => {
    const { b, cv, frame } = scene()
    const a = b.observe(cv, { frame, ...beam(200) })
    const c = b.observe(cv, { frame, ...beam(600) })
    b.relate(cv, { kind: 'SAME_FEATURE', from: a, to: c, confidence: 0.95, why: 'they look alike' })
    expect(() => b.seal()).toThrow(/RELATION_WITHIN_ONE_VIEW/)
  })

  it('refuses a weakly-held SAME_FEATURE, which must be POSSIBLY_SAME_FEATURE instead', () => {
    const { b, cv, frame } = scene()
    const other = b.declareFrame('asset-plan', BYTES_B, { width: 800, height: 800 }, PLAN_ROLES)
    const a = b.observe(cv, { frame, ...beam(200) })
    const c = b.observe(cv, { frame: other, ...beam(200) })
    b.relate(cv, { kind: 'SAME_FEATURE', from: a, to: c, confidence: 0.5, why: 'similar width' })
    expect(() => b.seal()).toThrow(/SAME_FEATURE_UNDER_CONFIDENT/)
    const { b: b2, cv: cv2, frame: f2 } = scene()
    const o2 = b2.declareFrame('asset-plan', BYTES_B, { width: 800, height: 800 }, PLAN_ROLES)
    b2.relate(cv2, { kind: 'POSSIBLY_SAME_FEATURE', from: b2.observe(cv2, { frame: f2, ...beam(200) }), to: b2.observe(cv2, { frame: o2, ...beam(200) }), confidence: 0.5, why: 'similar width' })
    expect(() => b2.seal()).not.toThrow()
  })

  it('refuses a direction relation that contradicts the pixels', () => {
    const { b, cv, frame } = scene()
    const high = b.observe(cv, { frame, ...beam(200) })
    const low = b.observe(cv, { frame, ...beam(200), pixelGeometry: { type: 'RECT', rect: { x0: 200, y0: 300, x1: 500, y1: 340 } } })
    b.relate(cv, { kind: 'ABOVE', from: low, to: high, confidence: 0.9, why: 'mistaken' })
    expect(() => b.seal()).toThrow(/DIRECTION_CONTRADICTS_GEOMETRY/)
  })

  it('refuses a relation to an observation that is not in the graph, and a self-relation', () => {
    const { b, cv, frame } = scene()
    const a = b.observe(cv, { frame, ...beam(200) })
    b.relate(cv, { kind: 'ALIGNS_WITH', from: a, to: 'obs-nowhere', confidence: 0.5, why: 'dangling' })
    expect(() => b.seal()).toThrow(/RELATION_DANGLING/)
    const { b: b2, cv: cv2, frame: f2 } = scene()
    const a2 = b2.observe(cv2, { frame: f2, ...beam(200) })
    b2.relate(cv2, { kind: 'CONTAINS', from: a2, to: a2, confidence: 0.5, why: 'itself' })
    expect(() => b2.seal()).toThrow(/RELATION_SELF/)
  })
})

describe('uncertainty validation', () => {
  it('refuses a vision model that claims a pixel-exact position', () => {
    const { b, frame } = scene()
    const vlm = b.declareExtractor('vision.fixture', '1.0.0', 'VISION_MODEL')
    b.observe(vlm, { frame, ...beam(200), uncertainty: { positionPx: 0, angleDeg: 2 } })
    expect(() => b.seal()).toThrow(/VISION_CLAIMS_EXACT_POSITION/)
  })

  it('allows a deterministic extractor to be exact', () => {
    const { b, cv, frame } = scene()
    b.observe(cv, { frame, ...beam(200), uncertainty: { positionPx: 0, angleDeg: 0 } })
    expect(() => b.seal()).not.toThrow()
  })

  it('refuses positional uncertainty larger than the picture', () => {
    const { b, cv, frame } = scene()
    b.observe(cv, { frame, ...beam(200), uncertainty: { positionPx: 900, angleDeg: 1 } })
    expect(() => b.seal()).toThrow(/UNCERTAINTY_EXCEEDS_IMAGE/)
  })

  it('warns when a directed shape states no angular tolerance, and when an alternative outranks the primary', () => {
    const { b, cv, frame } = scene()
    b.observe(cv, {
      frame,
      kind: 'WALL_AXIS',
      pixelGeometry: { type: 'SEGMENT', a: { x: 10, y: 20 }, b: { x: 900, y: 20 } },
      confidence: 0.4,
      uncertainty: { positionPx: 1 },
      detail: 'a long horizontal run of ink',
      alternatives: [{ why: 'it may be a dimension line', confidence: 0.6 }],
    })
    const graph = b.seal()
    const codes = validateObservationGraph(graph).map((i) => i.code)
    expect(codes).toContain('ORIENTED_WITHOUT_ANGLE_UNCERTAINTY')
    expect(codes).toContain('ALTERNATIVE_BEATS_PRIMARY')
    expect(errorsOnly(validateObservationGraph(graph))).toEqual([])
  })

  it('rejects a negative or non-finite tolerance at the schema', () => {
    const { b, cv, frame } = scene()
    expect(() => b.observe(cv, { frame, ...beam(200), uncertainty: { positionPx: -1 } })).not.toThrow()
    const graph = (() => {
      const { b: b2, cv: c2, frame: f2 } = scene()
      b2.observe(c2, { frame: f2, ...beam(200) })
      const g = JSON.parse(JSON.stringify(b2.seal())) as SourceObservationGraph
      g.observations[0].uncertainty.positionPx = -1
      return g
    })()
    expect(() => SourceObservationGraphSchema.parse(graph)).toThrow()
    expect(errorsOnly(validateObservationGraph(graph, { checkIds: false })).map((i) => i.code)).toContain('UNCERTAINTY_INVALID')
  })
})

describe('content hash', () => {
  const withProvenance = (name: string, version: string, detail: string): SourceObservationGraph => {
    const b = new ObservationGraphBuilder(PKG, PKG_HASH)
    const vlm = b.declareExtractor(name, version, 'VISION_MODEL')
    const frame = b.declareFrame('asset-front', BYTES_A, { width: 1000, height: 500 }, ELEVATION_ROLES)
    b.observe(vlm, { frame, ...beam(200), detail })
    return b.seal()
  }

  it('does not depend on the order things were observed in', () => {
    const build = (xs: number[]): SourceObservationGraph => {
      const { b, cv, frame } = scene()
      for (const x of xs) b.observe(cv, { frame, ...beam(x) })
      return b.seal()
    }
    const a = build([100, 400, 700])
    const c = build([700, 100, 400])
    expect(c.contentHash).toBe(a.contentHash)
    expect(c.id).toBe(a.id)
  })

  it('changes when the reading changes', () => {
    const { b, cv, frame } = scene()
    b.observe(cv, { frame, ...beam(200) })
    const one = b.seal()
    const { b: b2, cv: cv2, frame: f2 } = scene()
    b2.observe(cv2, { frame: f2, ...beam(201) })
    expect(b2.seal().contentHash).not.toBe(one.contentHash)
  })

  it('changes when an observation grows less certain', () => {
    const { b, cv, frame } = scene()
    b.observe(cv, { frame, ...beam(200) })
    const sure = b.seal()
    const { b: b2, cv: cv2, frame: f2 } = scene()
    b2.observe(cv2, { frame: f2, ...beam(200), uncertainty: { positionPx: 12, angleDeg: 4 } })
    expect(b2.seal().contentHash).not.toBe(sure.contentHash)
  })

  // §24: provider metadata that should and should not move the hash.
  it('changes when a provider version changes: a different reader is a different reading', () => {
    expect(withProvenance('vision.acme/model', '2.0.0', 'same words').contentHash).not.toBe(withProvenance('vision.acme/model', '1.0.0', 'same words').contentHash)
  })

  it('changes when a different provider produced the same reading', () => {
    expect(withProvenance('vision.other/model', '1.0.0', 'same words').contentHash).not.toBe(withProvenance('vision.acme/model', '1.0.0', 'same words').contentHash)
  })

  it('does NOT change when a provider merely narrates its answer differently', () => {
    expect(withProvenance('vision.acme/model', '1.0.0', 'a shadow under the band').contentHash).toBe(withProvenance('vision.acme/model', '1.0.0', 'there is a shadow beneath the band').contentHash)
  })

  it('does NOT change when a human note is added to an observation', () => {
    const { b, cv, frame } = scene()
    b.observe(cv, { frame, ...beam(200) })
    const plain = b.seal()
    const annotated = JSON.parse(JSON.stringify(plain)) as SourceObservationGraph
    annotated.observations[0].note = 'worth a second look'
    expect(observationGraphContentHash(stripSeal(annotated))).toBe(plain.contentHash)
  })

  it('binds the graph to the exact package it was read from', () => {
    const { b, cv, frame } = scene()
    b.observe(cv, { frame, ...beam(200) })
    const one = b.seal()
    const other = new ObservationGraphBuilder(PKG, 'd'.repeat(64))
    const cv2 = other.declareExtractor('cv.axis-lines', '1.0.0', 'DETERMINISTIC_CV')
    other.observe(cv2, { frame: other.declareFrame('asset-front', BYTES_A, { width: 1000, height: 500 }, ELEVATION_ROLES), ...beam(200) })
    expect(other.seal().contentHash).not.toBe(one.contentHash)
  })

  it('notices a tampered graph', () => {
    const { b, cv, frame } = scene()
    b.observe(cv, { frame, ...beam(200) })
    const graph = JSON.parse(JSON.stringify(b.seal())) as SourceObservationGraph
    graph.observations[0].confidence = 0.99
    expect(graphHashIsIntact(graph)).toBe(false)
    expect(() => parseObservationGraph(graph)).toThrow(/CONTENT_HASH_STALE|OBSERVATION_ID/)
  })

  it('has a stable id derived from the package and the hash', () => {
    const { b, cv, frame } = scene()
    b.observe(cv, { frame, ...beam(200) })
    const graph = b.seal()
    expect(graph.id).toMatch(/^obsgraph-/)
    expect(graph.contentHash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('observation ids are content addresses', () => {
  it('is a pure function of the identity fields', () => {
    const identity = {
      assetId: 'asset-front',
      variantByteHash: BYTES_A,
      kind: 'LINEAR_VOLUME_CANDIDATE' as const,
      semanticHints: ['beam' as const],
      normGeometry: { type: 'RECT' as const, rect: { x0: 0.2, y0: 0.2, x1: 0.5, y1: 0.28 } },
      provenance: { extractor: 'DETERMINISTIC_CV' as const, name: 'cv.axis-lines', detail: 'x' },
    }
    const a = observationId(identity)
    const withOtherProse = observationId({ ...identity, provenance: { ...identity.provenance, detail: 'y' } })
    expect(withOtherProse).toBe(a)
    expect(a).toMatch(/^obs-linear-volume-candidate-beam-[0-9a-f]{10}$/)
  })
})
