import { createHash } from 'node:crypto'
/**
 * v3.54.2 pilot — the consultant's transport to the provider's Messages API, server-side only.
 *
 * The key is read from this process's environment (`BUILDPLAN_ANTHROPIC_API_KEY`, else `ANTHROPIC_API_KEY`) and goes
 * nowhere else: not into a request body, a record, an error text or a result. One `send` is at most one billed request:
 * the SDK's own retries are off, and whoever holds the budget (`consultLabels`) owns the single retry the brief allows.
 * Thinking models refuse a forced tool choice, so the answer tool is offered with `tool_choice: auto`.
 *
 * v3.54.15 (opt-in, both off by default):
 *  - `strict: true` — every tool goes with `strict: true` and an input schema the provider's strict mode accepts
 *    (`strictInputSchema`: `additionalProperties: false` on every object; numeric, length and array-size keywords
 *    removed — they stay in the local validation, which still reads the whole raw answer);
 *  - `cache: { ttl }` — one explicit breakpoint on the stable prefix (tools, then the system text): the variable
 *    pictures, ids and question come after it in `messages`. The usage's cache split (5-minute / 1-hour writes, reads)
 *    is returned for the books (`cost.ts`). A prefix below the model's minimum simply reports no cache tokens.
 */
import { ConsultantUnavailable } from './loop.js'
import type { ConsultantModel, ModelTurn } from './loop.js'

type MessagesLike = { messages: { create(body: Record<string, unknown>, opts?: { signal?: AbortSignal }): Promise<{ content: Array<Record<string, unknown>>; usage?: Record<string, unknown>; stop_reason?: string; model?: string; _request_id?: string | null }> } }

/** A JSON schema as the provider's strict tool use accepts it (see the module header); the input is not changed. */
export function strictInputSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(strictInputSchema)
  if (!schema || typeof schema !== 'object') return schema
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'minLength', 'maxLength', 'minItems', 'maxItems', 'uniqueItems', 'pattern'].includes(k)) continue
    out[k] = k === 'properties' && v && typeof v === 'object' ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([pk, pv]) => [pk, strictInputSchema(pv)])) : strictInputSchema(v)
  }
  if (out.type === 'object' || (Array.isArray(out.type) && (out.type as unknown[]).includes('object'))) out.additionalProperties = false
  return out
}

/** v3.54.15: the provider's refusal of a strict grammar it cannot compile (too large); retried once without `strict`. */
export const STRICT_TOO_LARGE = /compiled grammar is too large|reduce the number of strict tools/i

/** The request body as sent (exported for the transport tests): strict tools and the cache breakpoint when asked. */
export function requestBody(input: { model: string; maxOutputTokens: number; system: string; messages: unknown[]; tools: unknown[]; effort?: 'low' | 'medium' | 'high'; strict?: boolean; cache?: { ttl: '5m' | '1h' } }): Record<string, unknown> {
  const tools = input.strict ? input.tools.map((t) => ({ ...(t as Record<string, unknown>), input_schema: strictInputSchema((t as { input_schema?: unknown }).input_schema), strict: true })) : input.tools
  const cacheControl = input.cache ? { type: 'ephemeral', ...(input.cache.ttl === '1h' ? { ttl: '1h' } : {}) } : undefined
  const system = cacheControl ? [{ type: 'text', text: input.system, cache_control: cacheControl }] : input.system
  return { model: input.model, max_tokens: input.maxOutputTokens, system, messages: input.messages, tools, tool_choice: { type: 'auto' }, ...(input.effort ? { output_config: { effort: input.effort } } : {}) }
}

export function anthropicConsultant(options: { model?: string; maxOutputTokens?: number; timeoutMs?: number; effort?: 'low' | 'medium' | 'high'; apiKey?: string; strict?: boolean; cache?: { ttl: '5m' | '1h' }; createClient?: (key: string, timeoutMs: number) => Promise<MessagesLike> } = {}): ConsultantModel & { available(): boolean } {
  const key = options.apiKey ?? process.env.BUILDPLAN_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? ''
  const model = options.model ?? 'claude-sonnet-5-5'
  const maxOutputTokens = options.maxOutputTokens ?? 8000
  const timeoutMs = options.timeoutMs ?? 180_000
  const create =
    options.createClient ??
    (async (k: string, t: number): Promise<MessagesLike> => {
      const mod = (await import('@anthropic-ai/sdk')) as unknown as { default: new (o: { apiKey: string; maxRetries: number; timeout: number }) => MessagesLike }
      return new mod.default({ apiKey: k, maxRetries: 0, timeout: t })
    })
  let client: Promise<MessagesLike> | undefined
  const scrub = (text: string): string => (key ? text.split(key).join('[key]') : text)
  /** v3.54.15: the tool sets (by content hash) whose strict grammar the provider refused on this transport. */
  const strictRefused = new Set<string>()
  return {
    id: 'anthropic-messages',
    model,
    maxOutputTokens,
    ...(options.cache ? { cache: options.cache } : {}),
    ...(options.strict ? { strict: true } : {}),
    available: () => key.length > 0,
    send: async ({ system, messages, tools, signal }): Promise<ModelTurn> => {
      if (!key) throw new ConsultantUnavailable('NO_CREDENTIALS', 'no API key in this process environment')
      client ??= create(key, timeoutMs)
      const started = Date.now()
      let r: Awaited<ReturnType<MessagesLike['messages']['create']>>
      let strictFallback: string | undefined
      const body = (strict: boolean) => requestBody({ model, maxOutputTokens, system, messages, tools, ...(options.effort ? { effort: options.effort } : {}), ...(strict ? { strict: true } : {}), ...(options.cache ? { cache: options.cache } : {}) })
      // a tool set whose strict grammar the provider refused stays non-strict on this transport: every turn of a
      // conversation must offer the same tools, or its earlier thinking blocks no longer bind (preserved thinking)
      const toolsKey = createHash('sha256').update(JSON.stringify(tools)).digest('hex')
      const sticky = strictRefused.has(toolsKey)
      if (sticky) strictFallback = 'this tool set\'s strict grammar was refused earlier on this transport: sent without strict'
      try {
        try {
          r = await (await client).messages.create(body(options.strict === true && !sticky), signal ? { signal } : undefined)
        } catch (e) {
          // v3.54.15: a strict grammar the provider will not compile (a large answer schema with several tools) is refused
          // unbilled (400); that one request goes again without `strict` — the answer is still validated here — and says so
          const status = (e as { status?: unknown }).status
          if (!(options.strict === true && status === 400 && STRICT_TOO_LARGE.test((e as Error).message))) throw e
          strictFallback = scrub((e as Error).message).slice(0, 200)
          strictRefused.add(toolsKey)
          r = await (await client).messages.create(body(false), signal ? { signal } : undefined)
        }
      } catch (e) {
        const status = (e as { status?: unknown }).status
        const unbilled = typeof status === 'number' && [400, 401, 403, 404, 413, 429].includes(status)
        const timeout = /timed? ?out/i.test((e as Error).message)
        throw new ConsultantUnavailable(unbilled ? 'REJECTED_UNBILLED' : timeout ? 'TIMEOUT' : 'TRANSPORT', scrub(`${typeof status === 'number' ? `HTTP ${status}: ` : ''}${(e as Error).message}`).slice(0, 400))
      }
      return {
        content: r.content as ModelTurn['content'],
        usage: usageOf(r.usage),
        ...(r.stop_reason ? { stopReason: r.stop_reason } : {}),
        ...(r._request_id ? { requestId: r._request_id } : {}),
        model: r.model ?? model,
        latencyMs: Date.now() - started,
        ...(strictFallback ? { strictFallback } : {}),
      }
    },
  }
}

/** The usage as the books read it: regular input, output, cache reads and writes with the TTL split when reported. */
export function usageOf(u: Record<string, unknown> | undefined): ModelTurn['usage'] {
  const n = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)
  const split = (u?.cache_creation ?? undefined) as Record<string, unknown> | undefined
  const w5 = n(split?.ephemeral_5m_input_tokens)
  const w1 = n(split?.ephemeral_1h_input_tokens)
  return {
    ...(n(u?.input_tokens) !== undefined ? { inputTokens: n(u?.input_tokens) } : {}),
    ...(n(u?.output_tokens) !== undefined ? { outputTokens: n(u?.output_tokens) } : {}),
    ...(n(u?.cache_read_input_tokens) !== undefined ? { cacheReadInputTokens: n(u?.cache_read_input_tokens) } : {}),
    ...(n(u?.cache_creation_input_tokens) !== undefined ? { cacheCreationInputTokens: n(u?.cache_creation_input_tokens) } : {}),
    ...(w5 !== undefined ? { cacheCreation5mInputTokens: w5 } : {}),
    ...(w1 !== undefined ? { cacheCreation1hInputTokens: w1 } : {}),
  }
}
