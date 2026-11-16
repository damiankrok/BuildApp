/**
 * v3.54.2 pilot — the consultant's transport to the provider's Messages API, server-side only.
 *
 * The key is read from this process's environment (`BUILDPLAN_ANTHROPIC_API_KEY`, else `ANTHROPIC_API_KEY`) and goes
 * nowhere else: not into a request body, a record, an error text or a result. One `send` is at most one billed request:
 * the SDK's own retries are off, and whoever holds the budget (`consultLabels`) owns the single retry the brief allows.
 * Thinking models refuse a forced tool choice, so the answer tool is offered with `tool_choice: auto`.
 */
import { ConsultantUnavailable } from './loop.js'
import type { ConsultantModel, ModelTurn } from './loop.js'

type MessagesLike = { messages: { create(body: Record<string, unknown>, opts?: { signal?: AbortSignal }): Promise<{ content: Array<Record<string, unknown>>; usage?: Record<string, number>; stop_reason?: string; model?: string; _request_id?: string | null }> } }

export function anthropicConsultant(options: { model?: string; maxOutputTokens?: number; timeoutMs?: number; effort?: 'low' | 'medium' | 'high'; apiKey?: string; createClient?: (key: string, timeoutMs: number) => Promise<MessagesLike> } = {}): ConsultantModel & { available(): boolean } {
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
  return {
    id: 'anthropic-messages',
    model,
    maxOutputTokens,
    available: () => key.length > 0,
    send: async ({ system, messages, tools, signal }): Promise<ModelTurn> => {
      if (!key) throw new ConsultantUnavailable('NO_CREDENTIALS', 'no API key in this process environment')
      client ??= create(key, timeoutMs)
      const started = Date.now()
      let r: Awaited<ReturnType<MessagesLike['messages']['create']>>
      try {
        r = await (await client).messages.create({ model, max_tokens: maxOutputTokens, system, messages, tools, tool_choice: { type: 'auto' }, ...(options.effort ? { output_config: { effort: options.effort } } : {}) }, signal ? { signal } : undefined)
      } catch (e) {
        const status = (e as { status?: unknown }).status
        const unbilled = typeof status === 'number' && [400, 401, 403, 404, 413, 429].includes(status)
        const timeout = /timed? ?out/i.test((e as Error).message)
        throw new ConsultantUnavailable(unbilled ? 'REJECTED_UNBILLED' : timeout ? 'TIMEOUT' : 'TRANSPORT', scrub(`${typeof status === 'number' ? `HTTP ${status}: ` : ''}${(e as Error).message}`).slice(0, 400))
      }
      const u = r.usage ?? {}
      return {
        content: r.content as ModelTurn['content'],
        usage: { inputTokens: u.input_tokens, outputTokens: u.output_tokens, ...(typeof u.cache_read_input_tokens === 'number' ? { cacheReadInputTokens: u.cache_read_input_tokens } : {}), ...(typeof u.cache_creation_input_tokens === 'number' ? { cacheCreationInputTokens: u.cache_creation_input_tokens } : {}) },
        ...(r.stop_reason ? { stopReason: r.stop_reason } : {}),
        ...(r._request_id ? { requestId: r._request_id } : {}),
        model: r.model ?? model,
        latencyMs: Date.now() - started,
      }
    },
  }
}
