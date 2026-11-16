/** v3.53: the whole-house description — its schema as a provider sees it, its prompt, and its deterministic admission. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ANSWER_TOOL_NAME, DEFAULT_ANSWER_MODES, HouseDescriptionSchema, buildHouseDescriptionPrompt, checkHouseDescription, houseDescriptionJsonSchema, HouseReaderUnavailable, anthropicStructuredVision, fixtureStructuredVision, structuredVisionKey } from '../src/index.js'
import type { AnthropicMessagesLike } from '../src/index.js'

const raw = (): Record<string, unknown> => JSON.parse(readFileSync(new URL('../../reconstruction/test/fixtures/described-house-a.json', import.meta.url), 'utf8')) as Record<string, unknown>

describe('house description', () => {
  it('constrains a provider to the closed vocabulary: every property required, nothing additional, no mesh or command', () => {
    const schema = houseDescriptionJsonSchema() as { required: string[]; additionalProperties: boolean; properties: Record<string, unknown> }
    expect(schema.additionalProperties).toBe(false)
    expect(schema.required.sort()).toEqual(Object.keys(HouseDescriptionSchema.shape).sort())
    const text = JSON.stringify(schema)
    for (const banned of ['mesh', 'triangle', 'command', 'wallId', 'vertices']) expect(text).not.toContain(banned)
  })

  it('tells the reader the pictures by number and the published figures, and nothing that names the page', () => {
    const prompt = buildHouseDescriptionPrompt({ images: [{ number: 1, widthPx: 800, heightPx: 600 }], published: [{ key: 'building_width', label: 'Szerokość', raw: '13,84 m', value: 13.84, unit: 'm' }] })
    expect(prompt).toContain('13,84 m')
    expect(prompt).not.toMatch(/https?:\/\//)
    expect(prompt).toContain('hypotheticalSides')
  })

  it('admits a consistent description', () => {
    const r = checkHouseDescription(raw())
    expect(r.ok).toBe(true)
    expect(r.issues).toEqual([])
  })

  it('refuses what cannot be built as stated', () => {
    const d = raw() as { bodies: Array<Record<string, unknown>> }
    expect(checkHouseDescription({ ...d, bodies: [d.bodies[0], { ...d.bodies[1], role: 'MAIN' }] }).ok).toBe(false)
    expect(checkHouseDescription({ ...d, bodies: [d.bodies[0], { ...d.bodies[0], id: 'twin', role: 'WING' }] }).ok).toBe(false)
    expect(checkHouseDescription({ ...d, bodies: [] }).ok).toBe(false)
    expect(checkHouseDescription({ ...d, mesh: [] }).ok).toBe(false)
  })

  it('compares the stated size with the figures the page publishes, in either order, and reports — never corrects', () => {
    const fig = (key: string, value: number) => ({ key, label: key, raw: String(value), value, unit: 'm' })
    const agree = checkHouseDescription(raw(), [fig('building_width', 15.5), fig('building_length', 10)])
    expect(agree.issues.map((i) => i.code)).not.toContain('OVERALL_DISAGREES_WITH_PUBLISHED_EXTENT')
    const swapped = checkHouseDescription(raw(), [fig('building_width', 10), fig('building_length', 15.5)])
    expect(swapped.issues.map((i) => i.code)).not.toContain('OVERALL_DISAGREES_WITH_PUBLISHED_EXTENT')
    const off = checkHouseDescription(raw(), [fig('building_width', 19), fig('building_length', 12)])
    expect(off.ok).toBe(true)
    expect(off.issues.map((i) => i.code)).toContain('OVERALL_DISAGREES_WITH_PUBLISHED_EXTENT')
    const area = checkHouseDescription(raw(), [fig('footprint_area', 200)])
    expect(area.issues.map((i) => i.code)).toContain('FOOTPRINT_DISAGREES_WITH_PUBLISHED_AREA')
  })

  it('a side no picture shows must be declared hypothetical', () => {
    const d = raw()
    const r = checkHouseDescription({ ...d, hypotheticalSides: [] })
    expect(r.issues.map((i) => i.code)).toContain('SIDE_NOT_SHOWN_NOT_DECLARED')
  })
})

describe('house description — a side is counted, then listed', () => {
  it('names a side whose count and list disagree, and a side a picture shows with nothing listed', () => {
    const d = raw() as { sides: Array<{ side: string; pictures: number[]; openingsByStorey: number[] }>; openings: Array<{ side: string }> }
    const short = checkHouseDescription({ ...d, sides: d.sides.map((x) => (x.side === 'REAR' ? { ...x, openingsByStorey: [4] } : x)) })
    expect(short.ok).toBe(true)
    expect(short.issues.filter((i) => i.code === 'SIDE_COUNT_MISMATCH').map((i) => i.detail)).toEqual(['REAR storey 0: 4 counted, 1 listed'])
    const empty = checkHouseDescription({ ...d, openings: d.openings.filter((o) => o.side !== 'LEFT') })
    expect(empty.issues.map((i) => i.code)).toContain('SIDE_SHOWN_BUT_EMPTY')
  })
})

describe('what a recorded answer is keyed by (v3.53.1)', () => {
  const picture = (n: number, fill: number, mediaType = 'image/jpeg') => ({ number: n, bytes: new Uint8Array([fill, fill, fill]), mediaType })
  const base = { purpose: 'HOUSE_DESCRIPTION' as const, system: 'system', text: 'the question, with the published width 12.4 m', schema: { type: 'object', properties: { a: { type: 'number' } } } as never, pictures: [picture(1, 7), picture(2, 9)] }

  it('the same question over the same bytes is the same key; anything the answer depends on is another', () => {
    const key = structuredVisionKey(base)
    expect(structuredVisionKey({ ...base, pictures: [picture(1, 7), picture(2, 9)] })).toBe(key)
    const changed = [
      { ...base, text: 'the question, with the published width 12.6 m' }, // the page's figures ride in the question
      { ...base, system: 'another system' },
      { ...base, schema: { type: 'object', properties: { a: { type: 'string' } } } as never },
      { ...base, purpose: 'HOUSE_TRIAGE' as const },
      { ...base, pictures: [picture(1, 7), picture(2, 8)] },
      { ...base, pictures: [picture(2, 9), picture(1, 7)] },
      { ...base, pictures: [picture(1, 7), picture(3, 9)] },
      { ...base, pictures: [picture(1, 7), picture(2, 9, 'image/png')] },
      { ...base, pictures: [picture(1, 7)] },
    ]
    const keys = changed.map((c) => structuredVisionKey(c))
    expect(new Set([key, ...keys]).size).toBe(changed.length + 1)
  })

  it('a replayer answers only the question it recorded: a changed question is a loud miss, never the old answer', async () => {
    const replay = fixtureStructuredVision({ [structuredVisionKey(base)]: { recorded: true } }, { model: 'm', triageModel: 't' })
    expect((await replay.ask(base)).output).toEqual({ recorded: true })
    const miss = await replay.ask({ ...base, text: `${base.text} and one more rule` }).catch((e: unknown) => e)
    expect(miss).toBeInstanceOf(HouseReaderUnavailable)
    expect((miss as HouseReaderUnavailable).reason).toBe('FIXTURE_MISS')
  })

  it('the live adapter states what a guard needs — its answer ceilings and its time limit — and never retries on its own', async () => {
    const seen: Array<{ timeoutMs: number }> = []
    const bodies: Array<Record<string, unknown>> = []
    const adapter = anthropicStructuredVision({ apiKey: 'test-key-not-real', createClient: async (_key, limits) => { seen.push(limits); return { messages: { create: async (body) => { bodies.push(body); return body.tools ? { content: [{ type: 'thinking' }, { type: 'tool_use', name: 'record_answer', input: { ok: true } }], stop_reason: 'tool_use', usage: { input_tokens: 10, output_tokens: 5 } } : { content: [{ type: 'text', text: '{"ok":true}' }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 } } } } } } })
    expect(adapter.provider.maxOutputTokens).toEqual({ HOUSE_TRIAGE: 4096, HOUSE_DESCRIPTION: 16000 })
    const out = await adapter.ask(base)
    expect(out.output).toEqual({ ok: true })
    expect(out.usage).toMatchObject({ inputTokens: 10, outputTokens: 5, model: 'claude-sonnet-5-5' })
    expect(seen).toEqual([{ timeoutMs: adapter.provider.requestTimeoutMs }])
    expect(bodies[0].max_tokens).toBe(16000)
    await adapter.ask({ ...base, purpose: 'HOUSE_TRIAGE' })
    expect(bodies[1]).toMatchObject({ model: 'claude-haiku-5-5', max_tokens: 4096 })
    // the sorting's small schema is decoded under its grammar; never a forced tool choice
    expect(bodies[1].tool_choice).toBeUndefined()
    expect((bodies[1].output_config as { format: { type: string } }).format.type).toBe('json_schema')
  })
})

describe('the live adapter says whether a failure can have been billed (v3.53.1)', () => {
  const base = { purpose: 'HOUSE_DESCRIPTION' as const, system: 's', text: 't', schema: { type: 'object' } as never, pictures: [] }
  const failing = (error: unknown) => anthropicStructuredVision({ apiKey: 'test-key-not-real', createClient: async () => ({ messages: { create: async () => { throw error } } }) })
  it('a bad key, a bad request and a rate limit were refused before a model ran; a server error or a timeout may have been billed', async () => {
    for (const status of [400, 401, 403, 404, 413, 429]) expect(((await failing(Object.assign(new Error('refused'), { status })).ask(base).catch((e: unknown) => e)) as HouseReaderUnavailable).reason).toBe('REJECTED_UNBILLED')
    for (const error of [Object.assign(new Error('overloaded'), { status: 529 }), Object.assign(new Error('internal'), { status: 500 }), new Error('Request timed out.')]) expect(((await failing(error).ask(base).catch((e: unknown) => e)) as HouseReaderUnavailable).reason).toBe('TRANSPORT')
  })
})

describe('a description too large for a strict grammar is asked for through one answer tool (v3.54.1)', () => {
  // the API refuses the description's schema as a strict output format before any model runs ("The compiled grammar is
  // too large"): it is offered as a non-strict tool, never forced (thinking models refuse a forced tool choice)
  const base = { purpose: 'HOUSE_DESCRIPTION' as const, system: 's', text: 't', pictures: [{ number: 1, bytes: new Uint8Array([1, 2, 3]), mediaType: 'image/png' }], schema: houseDescriptionJsonSchema() }
  type Reply = Awaited<ReturnType<AnthropicMessagesLike['messages']['create']>>
  const adapterAnswering = (reply: Reply, bodies: Array<Record<string, unknown>> = []) => anthropicStructuredVision({ apiKey: 'test-key-not-real', createClient: async () => ({ messages: { create: async (body) => { bodies.push(body); return reply } } }) })
  const usage = { input_tokens: 10, output_tokens: 5 }
  it('the request carries the schema as the input of one tool, the question unchanged, no strict format', async () => {
    const bodies: Array<Record<string, unknown>> = []
    await adapterAnswering({ content: [{ type: 'tool_use', name: ANSWER_TOOL_NAME, input: { a: 1 } }], stop_reason: 'tool_use', usage }, bodies).ask(base)
    const body = bodies[0] as { tools: Array<{ name: string; input_schema: unknown; strict?: boolean }>; tool_choice: unknown; output_config?: { format?: unknown; effort?: string }; system: string; messages: Array<{ content: Array<{ type: string; text?: string }> }> }
    expect(body.tools).toHaveLength(1)
    expect(body.tools[0]).toMatchObject({ name: ANSWER_TOOL_NAME, input_schema: base.schema })
    expect(body.tools[0].strict).toBeUndefined()
    expect(body.tool_choice).toEqual({ type: 'auto' })
    expect(body.output_config?.format).toBeUndefined()
    expect(body.output_config?.effort).toBe('medium')
    expect(body.system.startsWith('s')).toBe(true)
    expect(body.messages[0].content.at(-1)).toEqual({ type: 'text', text: 't' })
  })
  it('the answer is the one call’s input; its raw form is kept beside it', async () => {
    const out = await adapterAnswering({ content: [{ type: 'thinking' }, { type: 'text', text: 'Here it is.' }, { type: 'tool_use', name: ANSWER_TOOL_NAME, input: { a: 1 } }], stop_reason: 'tool_use', usage, _request_id: 'req_t' }).ask(base)
    expect(out.output).toEqual({ a: 1 })
    expect(out.raw).toBe('{"a":1}')
    expect(out.usage).toMatchObject({ requestId: 'req_t', stopReason: 'tool_use' })
  })
  it('no call, two calls, a refusal or a cut answer is NO_ANSWER by name, with what came and its usage', async () => {
    const cases: Array<[Reply, string]> = [
      [{ content: [{ type: 'text', text: '{"a":1}' }], stop_reason: 'end_turn', usage }, 'did not answer through'],
      [{ content: [{ type: 'tool_use', name: ANSWER_TOOL_NAME, input: { a: 1 } }, { type: 'tool_use', name: ANSWER_TOOL_NAME, input: { a: 2 } }], stop_reason: 'tool_use', usage }, '2 times'],
      [{ content: [{ type: 'text', text: 'no' }], stop_reason: 'refusal', usage }, 'refused'],
      [{ content: [{ type: 'tool_use', name: ANSWER_TOOL_NAME, input: { a: 1 } }], stop_reason: 'max_tokens', usage: { input_tokens: 10, output_tokens: 16000 } }, 'max_tokens'],
      [{ content: [{ type: 'tool_use', name: 'other_tool', input: { a: 1 } }], stop_reason: 'tool_use', usage }, 'did not answer through'],
    ]
    for (const [reply, why] of cases) {
      const err = await adapterAnswering(reply).ask(base).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(HouseReaderUnavailable)
      expect((err as HouseReaderUnavailable).reason).toBe('NO_ANSWER')
      expect((err as HouseReaderUnavailable).message).toContain(why)
      expect((err as HouseReaderUnavailable).raw?.usage?.inputTokens).toBe(10)
    }
  })
  it('the mode is the adapter’s, stated per purpose; the sorting stays strict', () => {
    expect(DEFAULT_ANSWER_MODES).toEqual({ HOUSE_TRIAGE: 'STRICT_FORMAT', HOUSE_DESCRIPTION: 'ANSWER_TOOL' })
  })
})

describe('the live adapter keeps what the books and the trace need (v3.54.1)', () => {
  const base = { purpose: 'HOUSE_TRIAGE' as const, system: 's', text: 't', pictures: [{ number: 1, bytes: new Uint8Array([1, 2, 3]), mediaType: 'image/png' }], schema: { type: 'object' } as never }
  it('the request id, the stop reason, the cache counts and the raw answer beside the parsed one', async () => {
    const adapter = anthropicStructuredVision({ apiKey: 'test-key-not-real', createClient: async () => ({ messages: { create: async () => ({ content: [{ type: 'text', text: '{"ok":true}' }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, _request_id: 'req_test_1' }) } }) })
    const out = await adapter.ask(base)
    expect(out.raw).toBe('{"ok":true}')
    expect(out.usage).toMatchObject({ requestId: 'req_test_1', stopReason: 'end_turn', cacheReadInputTokens: 0, cacheCreationInputTokens: 0 })
  })
  it('an answer outside the schema is refused by name and keeps its text and usage — never an empty result', async () => {
    const adapter = anthropicStructuredVision({ apiKey: 'test-key-not-real', createClient: async () => ({ messages: { create: async () => ({ content: [{ type: 'text', text: '{"cut": ' }], stop_reason: 'max_tokens', usage: { input_tokens: 10, output_tokens: 16000 } }) } }) })
    const err = await adapter.ask(base).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(HouseReaderUnavailable)
    expect((err as HouseReaderUnavailable).reason).toBe('NO_ANSWER')
    expect((err as HouseReaderUnavailable).message).toContain('max_tokens')
    expect((err as HouseReaderUnavailable).raw).toMatchObject({ text: '{"cut": ', usage: { inputTokens: 10, outputTokens: 16000 } })
  })
})
