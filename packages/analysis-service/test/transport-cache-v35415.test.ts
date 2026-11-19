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

describe('v3.54.15 a strict grammar the provider will not compile', () => {
  const tooLarge = Object.assign(new Error('400 {"type":"error","error":{"type":"invalid_request_error","message":"The compiled grammar is too large, which would cause performance issues. Simplify your tool schemas or reduce the number of strict tools."}}'), { status: 400 })
  it('is sent once more without strict, the answer kept and the fallback named on the turn', async () => {
    const sent: Array<Record<string, unknown>> = []
    const create = async (body: Record<string, unknown>) => {
      sent.push(body)
      if ((body.tools as Array<{ strict?: boolean }>)[0].strict) throw tooLarge
      return { content: [], stop_reason: 'end_turn', model: 'claude-sonnet-5-5', usage: { input_tokens: 10, output_tokens: 2 } }
    }
    const t = anthropicConsultant({ apiKey: 'test-key', strict: true, createClient: async () => ({ messages: { create } }) })
    const turn = await t.send({ system: 'S', messages, tools: [tool] })
    expect(sent).toHaveLength(2)
    expect((sent[1].tools as Array<{ strict?: boolean }>)[0].strict).toBeUndefined()
    expect(turn.strictFallback).toMatch(/compiled grammar is too large/)
  })
  it('counter-trial: another 400 is not retried; without strict nothing is retried', async () => {
    let n = 0
    const other = Object.assign(new Error('400 invalid image'), { status: 400 })
    const create = async () => { n += 1; throw other }
    const t = anthropicConsultant({ apiKey: 'test-key', strict: true, createClient: async () => ({ messages: { create } }) })
    await expect(t.send({ system: 'S', messages, tools: [tool] })).rejects.toThrow(/REJECTED_UNBILLED|invalid image/)
    expect(n).toBe(1)
    let m = 0
    const plain = anthropicConsultant({ apiKey: 'test-key', createClient: async () => ({ messages: { create: async () => { m += 1; throw tooLarge } } }) })
    await expect(plain.send({ system: 'S', messages, tools: [tool] })).rejects.toThrow()
    expect(m).toBe(1)
  })
})

describe('v3.54.15 a refused strict grammar stays refused for the conversation', () => {
  it('the next turn with the same tools goes without strict at once (its thinking blocks stay bound to the same tools)', async () => {
    const strictFlags: boolean[] = []
    const tooLarge = Object.assign(new Error('400 The compiled grammar is too large, which would cause performance issues.'), { status: 400 })
    const create = async (body: Record<string, unknown>) => {
      const strict = (body.tools as Array<{ strict?: boolean }>)[0].strict === true
      strictFlags.push(strict)
      if (strict) throw tooLarge
      return { content: [], stop_reason: 'end_turn', model: 'claude-sonnet-5-5', usage: { input_tokens: 10, output_tokens: 2 } }
    }
    const t = anthropicConsultant({ apiKey: 'test-key', strict: true, createClient: async () => ({ messages: { create } }) })
    await t.send({ system: 'S', messages, tools: [tool] })
    const second = await t.send({ system: 'S', messages, tools: [tool] })
    expect(strictFlags).toEqual([true, false, false])
    expect(second.strictFallback).toMatch(/refused earlier/)
    // another tool set on the same transport still tries strict first
    await t.send({ system: 'S', messages, tools: [{ ...tool, name: 'other' }] }).catch(() => undefined)
    expect(strictFlags[3]).toBe(true)
  })
})
