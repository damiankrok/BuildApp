/**
 * v3.54.15 — the transport and the books on fixtures, before any paid request: strict tools with a schema the provider
 * accepts, one cache breakpoint on the stable prefix (tools + system) with the variable picture after it, the usage's
 * cache split read back, and one price for every step (input, 5-minute / 1-hour writes, reads, output). Counter-trials:
 * no cache asked → no breakpoint; a usage without the TTL split is booked at the dearer rate; the reservation of a
 * cached request is the cold write.
 */
import { describe, expect, it } from 'vitest'
import { anthropicConsultant, requestBody, strictInputSchema, usageOf } from '../src/consult/anthropic.js'
import { CONSULT_PRICES, costOf, reserveOf } from '../src/consult/cost.js'

const tool = { name: 'report', description: 'd', input_schema: { type: 'object', required: ['items'], properties: { items: { type: 'array', minItems: 1, items: { type: 'object', properties: { v: { type: 'number', minimum: 0 }, s: { type: 'string', maxLength: 9 } } } } } } }
const messages = [{ role: 'user', content: [{ type: 'text', text: 'frame A' }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } }] }]

describe('v3.54.15 transport: strict tools and the cache breakpoint', () => {
  it('strict: additionalProperties false on every object, unsupported keywords removed, the tool marked strict', () => {
    const b = requestBody({ model: 'claude-opus-5-5', maxOutputTokens: 100, system: 'S', messages, tools: [tool], strict: true })
    const t = (b.tools as Array<Record<string, unknown>>)[0]
    expect(t.strict).toBe(true)
    const sch = JSON.stringify(t.input_schema)
    expect(sch).not.toMatch(/minItems|minimum|maxLength/)
    expect((t.input_schema as { additionalProperties: boolean }).additionalProperties).toBe(false)
    expect(((strictInputSchema(tool.input_schema) as { properties: { items: { items: { additionalProperties: boolean } } } }).properties.items.items.additionalProperties)).toBe(false)
    // the tool the caller holds is not changed (the local validation keeps the constraints)
    expect(JSON.stringify(tool)).toMatch(/minItems/)
  })

  it('cache: one breakpoint on the system text (tools + system cached together); the picture stays after it; none when not asked', () => {
    const b = requestBody({ model: 'claude-opus-5-5', maxOutputTokens: 100, system: 'S', messages, tools: [tool], cache: { ttl: '5m' } })
    expect(b.system).toEqual([{ type: 'text', text: 'S', cache_control: { type: 'ephemeral' } }])
    expect(JSON.stringify(b.messages)).not.toMatch(/cache_control/)
    const h = requestBody({ model: 'claude-opus-5-5', maxOutputTokens: 100, system: 'S', messages, tools: [tool], cache: { ttl: '1h' } })
    expect((h.system as Array<{ cache_control: unknown }>)[0].cache_control).toEqual({ type: 'ephemeral', ttl: '1h' })
    expect(requestBody({ model: 'm', maxOutputTokens: 1, system: 'S', messages, tools: [tool] }).system).toBe('S')
  })

  it('the transport sends that body and reads the cache split back', async () => {
    let sent: Record<string, unknown> | undefined
    const create = async (body: Record<string, unknown>) => {
      sent = body
      return { content: [], stop_reason: 'end_turn', model: 'claude-opus-5-5', usage: { input_tokens: 40, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 900, cache_creation: { ephemeral_5m_input_tokens: 900, ephemeral_1h_input_tokens: 0 } } }
    }
    const t = anthropicConsultant({ apiKey: 'test-key', model: 'claude-opus-5-5', strict: true, cache: { ttl: '5m' }, createClient: async () => ({ messages: { create } }) })
    expect(t.cache).toEqual({ ttl: '5m' })
    const turn = await t.send({ system: 'S', messages, tools: [tool] })
    expect((sent?.system as Array<unknown>)[0]).toMatchObject({ cache_control: { type: 'ephemeral' } })
    expect(turn.usage).toEqual({ inputTokens: 40, outputTokens: 10, cacheReadInputTokens: 0, cacheCreationInputTokens: 900, cacheCreation5mInputTokens: 900, cacheCreation1hInputTokens: 0 })
    expect(usageOf({ input_tokens: 5 })).toEqual({ inputTokens: 5 })
  })
})

describe('v3.54.15 one price for every step', () => {
  const opus = CONSULT_PRICES['claude-opus-5-5']
  it('cold write, warm read, output: each at its own rate', () => {
    const cold = costOf(opus, { inputTokens: 40, outputTokens: 10, cacheCreationInputTokens: 900, cacheCreation5mInputTokens: 900, cacheCreation1hInputTokens: 0, cacheReadInputTokens: 0 })
    expect(cold.inputUsd).toBeCloseTo((40 * 4) / 1e6, 9)
    expect(cold.cacheWriteUsd).toBeCloseTo((900 * 5) / 1e6, 9)
    expect(cold.outputUsd).toBeCloseTo((10 * 20) / 1e6, 9)
    const warm = costOf(opus, { inputTokens: 40, outputTokens: 10, cacheReadInputTokens: 900, cacheCreationInputTokens: 0 })
    expect(warm.cacheReadUsd).toBeCloseTo((900 * 0.2) / 1e6, 9)
    expect(warm.usd).toBeLessThan(cold.usd)
    // the same prefix uncached
    expect(costOf(opus, { inputTokens: 940, outputTokens: 10 }).usd).toBeCloseTo((940 * 4 + 10 * 20) / 1e6, 9)
  })
  it('counter-trial: writes without the TTL split are booked at the 1-hour rate; the reservation is the cold write at the TTL in use', () => {
    expect(costOf(opus, { cacheCreationInputTokens: 1000 }).cacheWriteUsd).toBeCloseTo((1000 * 8) / 1e6, 9)
    expect(reserveOf(opus, 1000, 100, { ttl: '5m' })).toBeCloseTo((1000 * 5 + 100 * 20) / 1e6, 9)
    expect(reserveOf(opus, 1000, 100)).toBeCloseTo((1000 * 4 + 100 * 20) / 1e6, 9)
    expect(reserveOf(CONSULT_PRICES['claude-sonnet-5-5'], 1000, 100, { ttl: '1h' })).toBeCloseTo((1000 * 4 + 100 * 10) / 1e6, 9)
  })
})
