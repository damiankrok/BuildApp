/**
 * The vision boundary.
 *
 * Everything a provider returns is a claim from an untrusted source until it
 * has passed validation, and the cases below are the ways a real multimodal
 * model actually gets it wrong: the right answer about the wrong picture,
 * coordinates outside the frame it was shown, a polygon with two points, an
 * index into a list that is shorter than the index, an answer in the
 * vocabulary of a different drawing, and a claim to know exactly where
 * something is.
 *
 * And the rule the whole stage rests on: whatever a provider says, what comes
 * out of this layer is observations. There is no path from here to a wall, a
 * mesh or a command.
 */
import { describe, expect, it, vi } from 'vitest'
import { ObservationGraphBuilder } from '@buildapp/source-observations'
import {
  MIN_VISION_POSITION_PX,
  VisionResponseRejected,
  VisionUnavailable,
  anthropicVisionReasoner,
  applyVisionResponse,
  extractorNameFor,
  extractorVersionFor,
  fixtureKey,
  fixtureVisionReasoner,
  nullVisionReasoner,
  parseProviderJson,
  taskDefinition,
  tasksForDocument,
  toPixelGeometry,
  validateVisionResponse,
  visionResponseJsonSchema,
} from '../src/index.js'
import type { AnthropicLike, VisionObservationRequest, VisionObservationResponse } from '../src/index.js'

const BYTES = new Uint8Array([1, 2, 3, 4])
const HASH = 'a'.repeat(64)
const OTHER = 'b'.repeat(64)

const request = (over: Partial<VisionObservationRequest> = {}): VisionObservationRequest => ({
  task: 'FACADE_DECOMPOSITION',
  asset: { assetId: 'asset-front', byteHash: HASH, mediaType: 'image/png', bytes: BYTES },
  roles: { document: 'ELEVATION', storey: 'NOT_APPLICABLE', annotation: 'PLAIN', view: 'FRONT', projection: 'ORTHOGRAPHIC_ELEVATION' },
  size: { width: 1000, height: 500 },
  ...over,
})

const good = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  task: 'FACADE_DECOMPOSITION',
  assetByteHash: HASH,
  observations: [
    {
      kind: 'LINEAR_VOLUME_CANDIDATE',
      semanticHints: ['beam', 'facade-frame'],
      geometry: { type: 'RECT', points: [[0.2, 0.3], [0.8, 0.36]] },
      depthLayer: 'PROUD_OF_WALL',
      confidence: 0.8,
      positionUncertaintyNorm: 0.01,
      angleUncertaintyDeg: 2,
      evidence: 'a shadow runs the whole length beneath it and its left end shows a face of its own',
    },
    {
      kind: 'OPENING',
      semanticHints: ['reveal'],
      geometry: { type: 'RECT', points: [[0.3, 0.5], [0.4, 0.7]] },
      confidence: 0.7,
      positionUncertaintyNorm: 0.008,
      evidence: 'a rectangular hole in the wall with a visible reveal',
    },
  ],
  relations: [{ kind: 'ABOVE', from: 0, to: 1, confidence: 0.9, why: 'the member is drawn above the opening' }],
  ...over,
})

describe('a well-formed answer', () => {
  it('is accepted, and keeps its coordinates in the image it was shown', () => {
    const response = validateVisionResponse(good(), request())
    expect(response.observations).toHaveLength(2)
    expect(response.relations[0].from).toBe(0)
  })

  it('becomes observations on the frame the CALLER chose, never one the provider names', () => {
    const builder = new ObservationGraphBuilder('pkg-1', 'c'.repeat(64))
    const provider = { id: 'vision.test', model: 'test-1', version: '1.0.0' }
    const handle = builder.declareExtractor(extractorNameFor(provider, 'FACADE_DECOMPOSITION'), extractorVersionFor(provider), 'VISION_MODEL')
    const frame = builder.declareFrame('asset-front', HASH, { width: 1000, height: 500 }, { document: 'ELEVATION', storey: 'NOT_APPLICABLE', annotation: 'PLAIN', view: 'FRONT', projection: 'ORTHOGRAPHIC_ELEVATION' })
    const applied = applyVisionResponse(builder, handle, frame, validateVisionResponse(good(), request()), provider, 'FACADE_DECOMPOSITION')
    expect(applied.observations).toHaveLength(2)
    expect(applied.relations).toBe(1)
    const beam = applied.observations[0]
    expect(beam.kind).toBe('LINEAR_VOLUME_CANDIDATE')
    expect(beam.pixelGeometry).toEqual({ type: 'RECT', rect: { x0: 200, y0: 150, x1: 800, y1: 180 } })
    expect(beam.provenance.extractor).toBe('VISION_MODEL')
    expect(beam.provenance.name).toBe('vision.test/test-1@facade-decomposition')
    const graph = builder.seal()
    expect(graph.observations).toHaveLength(2)
    // Nothing in the graph is 3D, a wall, or a command.
    expect(JSON.stringify(graph)).not.toMatch(/\bcreateWall\b|\btriangle\b|\bmesh\b|"z"\s*:/)
  })

  it('refuses to land an answer about one picture on a frame built from another', () => {
    const builder = new ObservationGraphBuilder('pkg-1', 'c'.repeat(64))
    const provider = { id: 'vision.test', model: 'test-1', version: '1.0.0' }
    const handle = builder.declareExtractor(extractorNameFor(provider, 'FACADE_DECOMPOSITION'), extractorVersionFor(provider), 'VISION_MODEL')
    const frame = builder.declareFrame('asset-front', OTHER, { width: 1000, height: 500 }, { document: 'ELEVATION', storey: 'NOT_APPLICABLE', annotation: 'PLAIN', view: 'FRONT', projection: 'ORTHOGRAPHIC_ELEVATION' })
    const response = validateVisionResponse(good(), request()) as VisionObservationResponse
    expect(() => applyVisionResponse(builder, handle, frame, response, provider, 'FACADE_DECOMPOSITION')).toThrow(/refusing to apply/)
  })

  it('floors a provider’s positional tolerance, and says so where it did', () => {
    const builder = new ObservationGraphBuilder('pkg-1', 'c'.repeat(64))
    const provider = { id: 'vision.test', model: 'test-1', version: '1.0.0' }
    const handle = builder.declareExtractor(extractorNameFor(provider, 'FACADE_DECOMPOSITION'), extractorVersionFor(provider), 'VISION_MODEL')
    const frame = builder.declareFrame('asset-front', HASH, { width: 1000, height: 500 }, { document: 'ELEVATION', storey: 'NOT_APPLICABLE', annotation: 'PLAIN', view: 'FRONT', projection: 'ORTHOGRAPHIC_ELEVATION' })
    const exact = good({ observations: [{ ...(good().observations as Record<string, unknown>[])[0], positionUncertaintyNorm: 0 }], relations: [] })
    const applied = applyVisionResponse(builder, handle, frame, validateVisionResponse(exact, request()), provider, 'FACADE_DECOMPOSITION')
    expect(applied.flooredUncertainty).toBe(1)
    expect(applied.observations[0].uncertainty.positionPx).toBe(MIN_VISION_POSITION_PX)
    expect(applied.observations[0].provenance.detail).toMatch(/tolerance raised to the 1px floor/)
    // and the graph seals, where a zero-tolerance vision observation would not
    expect(() => builder.seal()).not.toThrow()
  })
})

describe('answers that are refused', () => {
  const reject = (body: Record<string, unknown>, req = request()): VisionResponseRejected => {
    try {
      validateVisionResponse(body, req)
    } catch (err) {
      return err as VisionResponseRejected
    }
    throw new Error('expected the answer to be refused')
  }

  it('refuses an answer about a different picture', () => {
    expect(reject(good({ assetByteHash: OTHER })).code).toBe('WRONG_ASSET')
  })

  it('refuses an answer to a different question', () => {
    expect(reject(good({ task: 'PLAN_INTERPRETATION' })).code).toBe('WRONG_TASK')
  })

  it('refuses coordinates outside the image the provider was shown', () => {
    const out = good({ observations: [{ ...(good().observations as Record<string, unknown>[])[0], geometry: { type: 'RECT', points: [[0.2, 0.3], [1.4, 0.36]] } }], relations: [] })
    expect(reject(out).code).toBe('OUT_OF_BOUNDS')
  })

  it('allows a feature that touches the very edge', () => {
    const edge = good({ observations: [{ ...(good().observations as Record<string, unknown>[])[0], geometry: { type: 'RECT', points: [[0, 0], [1, 1]] } }], relations: [] })
    expect(() => validateVisionResponse(edge, request())).not.toThrow()
  })

  it('refuses a shape with the wrong number of points for its type', () => {
    const arity = good({ observations: [{ ...(good().observations as Record<string, unknown>[])[0], geometry: { type: 'POLYGON', points: [[0.2, 0.3], [0.8, 0.36]] } }], relations: [] })
    expect(reject(arity).code).toBe('GEOMETRY_ARITY')
  })

  it('refuses a shape that locates nothing', () => {
    const degenerate = good({ observations: [{ ...(good().observations as Record<string, unknown>[])[0], geometry: { type: 'SEGMENT', points: [[0.2, 0.3], [0.2, 0.3]] } }], relations: [] })
    expect(reject(degenerate).code).toBe('DEGENERATE_GEOMETRY')
  })

  it('refuses a relation pointing past the end of its own list', () => {
    expect(reject(good({ relations: [{ kind: 'ABOVE', from: 0, to: 7, confidence: 0.9, why: 'nowhere' }] })).code).toBe('RELATION_INDEX')
  })

  it('refuses an answer in the vocabulary of a different drawing', () => {
    const wrong = good({ observations: [{ ...(good().observations as Record<string, unknown>[])[0], kind: 'ROOM_AREA' }], relations: [] })
    expect(reject(wrong).code).toBe('KIND_NOT_ALLOWED')
  })

  it('refuses an identity relation asserted from one image', () => {
    expect(reject(good({ relations: [{ kind: 'SAME_FEATURE', from: 0, to: 1, confidence: 0.95, why: 'they look alike' }] })).code).toBe('RELATION_NOT_ALLOWED')
  })

  it('refuses a malformed document outright, rather than salvaging half of it', () => {
    expect(reject({ task: 'FACADE_DECOMPOSITION' }).code).toBe('SCHEMA_INVALID')
    expect(reject(good({ observations: [{ kind: 'OPENING' }] })).code).toBe('SCHEMA_INVALID')
  })

  it('refuses text that is not JSON, and JSON that is not an object', () => {
    expect(() => parseProviderJson('not json at all', 'FACADE_DECOMPOSITION')).toThrow(/not valid JSON/)
    expect(() => parseProviderJson('[1,2,3]', 'FACADE_DECOMPOSITION')).toThrow(/an array, not an object/)
  })

  it('refuses more observations than were asked for', () => {
    const many = good({ observations: Array.from({ length: 5 }, () => (good().observations as Record<string, unknown>[])[1]), relations: [] })
    expect(reject(many, request({ maxObservations: 3 })).code).toBe('TOO_MANY_OBSERVATIONS')
  })
})

describe('the task contract handed to a provider', () => {
  it('narrows the vocabulary to the drawing being looked at', () => {
    const facade = visionResponseJsonSchema('FACADE_DECOMPOSITION')
    const plan = visionResponseJsonSchema('PLAN_INTERPRETATION')
    const at = (value: unknown, path: readonly string[]): unknown => path.reduce<unknown>((v, k) => (v as Record<string, unknown>)[k], value)
    const kindsOf = (schema: Record<string, unknown>): string[] => at(schema, ['properties', 'observations', 'items', 'properties', 'kind', 'enum']) as string[]
    expect(kindsOf(facade)).toContain('LINEAR_VOLUME_CANDIDATE')
    expect(kindsOf(facade)).not.toContain('ROOM_AREA')
    expect(kindsOf(plan)).toContain('STAIR_SYMBOL')
    expect(kindsOf(plan)).not.toContain('RIDGE')
  })

  it('is generated from the observation vocabulary, so the two cannot drift apart', () => {
    const schema = visionResponseJsonSchema('PLAN_INTERPRETATION')
    const at = (value: unknown, path: readonly string[]): unknown => path.reduce<unknown>((v, k) => (v as Record<string, unknown>)[k], value)
    const hints = at(schema, ['properties', 'observations', 'items', 'properties', 'semanticHints', 'items', 'enum']) as string[]
    expect(hints).toContain('stair-winder')
    expect(hints).toContain('side-return')
  })

  it('never offers a provider a cross-view relation, because one image cannot show one', () => {
    for (const task of ['FACADE_DECOMPOSITION', 'PLAN_INTERPRETATION', 'SECTION_INTERPRETATION'] as const) {
      expect(taskDefinition(task).relations).not.toContain('SAME_FEATURE')
      expect(taskDefinition(task).relations).not.toContain('POSSIBLY_SAME_FEATURE')
    }
  })

  it('asks for the stair as a structure, not as a box', () => {
    const text = taskDefinition('PLAN_INTERPRETATION').instructions.join(' ')
    expect(text).toMatch(/tread lines/)
    expect(text).toMatch(/direction arrow/)
    expect(text).toMatch(/winder/)
    expect(text).toMatch(/Never report a stair as a plain rectangle/)
    expect(text).toMatch(/Do not infer anything from the size of a shaft/)
  })

  it('asks a facade for depth cues and for the sides of a recess', () => {
    const text = taskDefinition('FACADE_DECOMPOSITION').instructions.join(' ')
    expect(text).toMatch(/LINEAR_VOLUME_CANDIDATE/)
    expect(text).toMatch(/The test is depth, not colour/)
    expect(text).toMatch(/side wall or return/)
  })

  it('routes each document role to the tasks meant for it', () => {
    expect(tasksForDocument('ELEVATION').map((t) => t.task)).toEqual(['FACADE_DECOMPOSITION'])
    expect(tasksForDocument('FLOOR_PLAN').map((t) => t.task)).toEqual(['PLAN_INTERPRETATION'])
    expect(tasksForDocument('SITE_PLAN')).toEqual([])
  })
})

describe('providers', () => {
  it('replays a recorded answer, keyed by the bytes it describes', async () => {
    const reasoner = fixtureVisionReasoner([{ key: fixtureKey('FACADE_DECOMPOSITION', HASH), task: 'FACADE_DECOMPOSITION', assetByteHash: HASH, recordedFrom: { id: 'vision.test', model: 'test-1', version: '1.0.0' }, response: good() }])
    expect(reasoner.available(request())).toBe(true)
    const response = await reasoner.analyze(request())
    expect(response.observations).toHaveLength(2)
  })

  it('misses loudly when the picture is not the one the fixture was recorded against', async () => {
    const reasoner = fixtureVisionReasoner([{ key: fixtureKey('FACADE_DECOMPOSITION', OTHER), task: 'FACADE_DECOMPOSITION', assetByteHash: OTHER, recordedFrom: { id: 'vision.test', model: 'test-1', version: '1.0.0' }, response: good({ assetByteHash: OTHER }) }])
    expect(reasoner.available(request())).toBe(false)
    await expect(reasoner.analyze(request())).rejects.toThrow(VisionUnavailable)
  })

  it('puts a recorded answer through the same validation a live one gets', async () => {
    const reasoner = fixtureVisionReasoner([{ key: fixtureKey('FACADE_DECOMPOSITION', HASH), task: 'FACADE_DECOMPOSITION', assetByteHash: HASH, recordedFrom: { id: 'vision.test', model: 'test-1', version: '1.0.0' }, response: good({ observations: [{ ...(good().observations as Record<string, unknown>[])[0], geometry: { type: 'RECT', points: [[0.2, 0.3], [2, 0.36]] } }], relations: [] }) }])
    await expect(reasoner.analyze(request())).rejects.toThrow(VisionResponseRejected)
  })

  it('says a replay is a replay, and carries the version of the fixture SET', () => {
    const one = fixtureVisionReasoner([{ key: fixtureKey('FACADE_DECOMPOSITION', HASH), task: 'FACADE_DECOMPOSITION', assetByteHash: HASH, recordedFrom: { id: 'v', model: 'm', version: '1' }, response: good() }])
    const edited = fixtureVisionReasoner([{ key: fixtureKey('FACADE_DECOMPOSITION', HASH), task: 'FACADE_DECOMPOSITION', assetByteHash: HASH, recordedFrom: { id: 'v', model: 'm', version: '1' }, response: good({ notes: ['edited'] }) }])
    expect(one.provider.id).toBe('vision.fixture')
    expect(edited.provider.version).not.toBe(one.provider.version)
  })

  it('admits there is no provider rather than returning an empty answer', async () => {
    const none = nullVisionReasoner()
    expect(none.available()).toBe(false)
    await expect(none.analyze(request())).rejects.toThrow(VisionUnavailable)
  })

  it('refuses to make a live call without a key, instead of pretending', async () => {
    const live = anthropicVisionReasoner({ apiKey: '' })
    expect(live.available()).toBe(false)
    await expect(live.analyze(request())).rejects.toThrow(/ANTHROPIC_API_KEY is not set/)
  })
})

describe('the live adapter, exercised against a stubbed transport', () => {
  const clientReturning = (content: Array<Record<string, unknown>>): AnthropicLike => ({ messages: { create: vi.fn(async () => ({ content: content as never, usage: { input_tokens: 10, output_tokens: 20 } })) } })

  it('sends the image and the task schema, forces the tool, and accepts the tool input', async () => {
    const sent: Array<Record<string, unknown>> = []
    const create = vi.fn(async (body: Record<string, unknown>) => {
      sent.push(body)
      return { content: [{ type: 'tool_use', name: 'record_source_observations', input: good() }] as never, usage: { input_tokens: 1, output_tokens: 2 } }
    })
    const reasoner = anthropicVisionReasoner({ apiKey: 'test-key', createClient: async () => ({ messages: { create } }) })
    const response = await reasoner.analyze(request())
    expect(response.observations).toHaveLength(2)
    const body = sent[0]
    expect(body.tool_choice).toEqual({ type: 'tool', name: 'record_source_observations' })
    expect(body.temperature).toBe(0)
    const content = (body.messages as Array<{ content: Array<Record<string, unknown>> }>)[0].content
    expect(content[0].type).toBe('image')
    expect((content[1].text as string)).toContain(HASH)
    expect((content[1].text as string)).toContain('FACADE_DECOMPOSITION')
    // the model is never told a pixel size it could scale its answer by
    expect(content[1].text as string).not.toContain('1000')
  })

  it('refuses an answer that did not call the tool, rather than parsing prose', async () => {
    const reasoner = anthropicVisionReasoner({ apiKey: 'test-key', createClient: async () => clientReturning([{ type: 'text', text: 'Here is a nice house with a big window.' }]) })
    await expect(reasoner.analyze(request())).rejects.toThrow(/without calling record_source_observations/)
  })

  it('reports a transport failure as unavailability, not as an empty reading', async () => {
    const reasoner = anthropicVisionReasoner({
      apiKey: 'test-key',
      createClient: async () => ({
        messages: {
          create: async () => {
            throw new Error('connection reset')
          },
        },
      }),
    })
    await expect(reasoner.analyze(request())).rejects.toThrow(VisionUnavailable)
  })

  it('traces what it sent and what came back, including the latency the graph must not hash', async () => {
    const traces: Array<{ accepted: boolean; latencyMs?: number }> = []
    const reasoner = anthropicVisionReasoner({ apiKey: 'test-key', onTrace: (t) => traces.push(t), createClient: async () => clientReturning([{ type: 'tool_use', name: 'record_source_observations', input: good() }]) })
    await reasoner.analyze(request())
    expect(traces).toHaveLength(1)
    expect(traces[0].accepted).toBe(true)
    expect(typeof traces[0].latencyMs).toBe('number')
  })

  it('traces a refusal with the reason it was refused', async () => {
    const traces: Array<{ accepted: boolean; rejection?: { code: string } }> = []
    const reasoner = anthropicVisionReasoner({ apiKey: 'test-key', onTrace: (t) => traces.push(t), createClient: async () => clientReturning([{ type: 'tool_use', name: 'record_source_observations', input: good({ assetByteHash: OTHER }) }]) })
    await expect(reasoner.analyze(request())).rejects.toThrow(VisionResponseRejected)
    expect(traces[0].accepted).toBe(false)
    expect(traces[0].rejection?.code).toBe('WRONG_ASSET')
  })
})

describe('geometry conversion', () => {
  it('turns normalized shapes into the frame’s own pixels', () => {
    const size = { width: 800, height: 400 }
    expect(toPixelGeometry({ type: 'POINT', points: [[0.5, 0.25]] }, size)).toEqual({ type: 'POINT', point: { x: 400, y: 100 } })
    expect(toPixelGeometry({ type: 'RECT', points: [[0.8, 0.6], [0.2, 0.1]] }, size)).toEqual({ type: 'RECT', rect: { x0: 160, y0: 40, x1: 640, y1: 240 } })
    expect(toPixelGeometry({ type: 'LINE_FAMILY', points: [[0, 0], [1, 0], [0, 0.5], [1, 0.5]] }, size)).toEqual({
      type: 'LINE_FAMILY',
      lines: [
        { a: { x: 0, y: 0 }, b: { x: 800, y: 0 } },
        { a: { x: 0, y: 200 }, b: { x: 800, y: 200 } },
      ],
    })
  })
})
