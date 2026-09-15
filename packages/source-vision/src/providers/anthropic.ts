/**
 * A real multimodal provider.
 *
 * This adapter is the proof that the abstraction above it is not decorative:
 * it takes the same `VisionObservationRequest` every other provider takes,
 * shows the image to a live model, forces the answer through the task's JSON
 * Schema, and hands back something the graph will accept — or throws.
 *
 * Four deliberate choices:
 *
 * **Forced tool use, not free prose.** The task schema is attached as a tool
 * and the model is required to call it. There is no prose-parsing path and no
 * "extract the JSON from the markdown" fallback, because both of those are
 * ways to accept an answer the model did not commit to.
 *
 * **Temperature 0.** Not determinism — a language model is not deterministic —
 * but the least variance available, since the graph is content-addressed and
 * needless variance shows up as a changed hash.
 *
 * **The byte hash goes in the prompt and comes back in the answer.** It is the
 * cheapest possible check that the model answered about the picture it was
 * shown.
 *
 * **No key in the repository.** The key comes from the environment. A missing
 * key is `VisionUnavailable('NO_CREDENTIALS')` and never a silent fallback to
 * something that fabricates an answer.
 */
import { VisionResponseRejected, VisionUnavailable } from '../reasoner.js'
import type { VisionReasoner, VisionTrace } from '../reasoner.js'
import { extractorNameFor, VISION_CONTRACT_VERSION } from '../schema.js'
import type { VisionObservationRequest, VisionObservationResponse, VisionProviderInfo } from '../schema.js'
import { taskDefinition, visionResponseJsonSchema } from '../tasks.js'
import { validateVisionResponse } from '../validate.js'

/** The adapter's own version. Bump it whenever the prompt or the parsing below changes: it is part of every graph's hash. */
export const ANTHROPIC_ADAPTER_VERSION = '1.0.0'

const TOOL_NAME = 'record_source_observations'

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number]

const isSupportedImageType = (m: string): m is SupportedImageType => (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(m)

export type AnthropicVisionOptions = {
  apiKey?: string
  model?: string
  maxTokens?: number
  /** Injected in tests; defaults to the real SDK, imported lazily so this package works without it installed. */
  createClient?: (apiKey: string) => Promise<AnthropicLike>
  onTrace?: (trace: VisionTrace) => void
}

/** The narrow slice of the SDK this adapter uses, so it can be exercised without one. */
export type AnthropicLike = {
  messages: {
    create(body: Record<string, unknown>): Promise<{ content: Array<{ type: string; name?: string; input?: unknown; text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } }>
  }
}

const toBase64 = (bytes: Uint8Array): string => {
  // Chunked so a large raster does not blow the argument limit.
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  return typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64')
}

const SYSTEM = [
  'You are a source-observation extractor for an architectural reconstruction pipeline.',
  '',
  'You report WHAT YOU CAN SEE in one image, in that image\'s own normalized coordinates. You never describe a building, never state a dimension in metres, and never propose how anything should be modelled. Your entire output is 2D observations on the picture in front of you.',
  '',
  'Hard rules:',
  '- Coordinates are [x, y] with 0,0 at the TOP-LEFT and 1,1 at the bottom-right of the image you were given. x runs right, y runs DOWN.',
  '- Report only what the image shows. If something is hidden, cut off or too small to resolve, put it in notFound rather than guessing at it.',
  '- `confidence` is how sure you are the feature EXISTS. `positionUncertaintyNorm` is how wrong your coordinates might be. They are different questions and a high one does not imply a high other. Never report positionUncertaintyNorm as 0.',
  '- When two readings both fit, give the better one and put the other in `alternatives`. Do not average them and do not silently pick.',
  '- `evidence` must name the visual cue you used, in one sentence someone can check by looking at the image.',
  '- Echo the assetByteHash you are given, exactly.',
].join('\n')

function buildPrompt(request: VisionObservationRequest): string {
  const def = taskDefinition(request.task)
  const lines = [
    `Task: ${request.task}.`,
    `assetByteHash: ${request.asset.byteHash}`,
    `The publisher classifies this drawing as: document=${request.roles.document}, storey=${request.roles.storey}, annotation=${request.roles.annotation}, view=${request.roles.view}, projection=${request.roles.projection}.`,
    '',
    'Work through these, in order:',
    ...def.instructions.map((s, i) => `${i + 1}. ${s}`),
  ]
  if (request.contextFacts && request.contextFacts.length > 0) {
    lines.push(
      '',
      'Published figures for this project, for context only. They are aggregates: do not use them as dimensions and do not scale anything by them.',
      ...request.contextFacts.map((f) => `- ${f.label}: ${f.value} ${f.unit}`),
    )
  }
  if (request.focus) lines.push('', `Focus for this call: ${request.focus}`)
  lines.push('', `Return your answer by calling ${TOOL_NAME}. Do not answer in prose.`)
  return lines.join('\n')
}

async function defaultClient(apiKey: string): Promise<AnthropicLike> {
  const mod = (await import('@anthropic-ai/sdk')) as unknown as { default: new (opts: { apiKey: string }) => AnthropicLike }
  const Ctor = mod.default
  return new Ctor({ apiKey })
}

export function anthropicVisionReasoner(options: AnthropicVisionOptions = {}): VisionReasoner {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY ?? ''
  const model = options.model ?? 'claude-opus-5'
  const provider: VisionProviderInfo = { id: 'vision.anthropic', model, version: `${ANTHROPIC_ADAPTER_VERSION}+contract-${VISION_CONTRACT_VERSION}` }
  const createClient = options.createClient ?? defaultClient

  return {
    provider,
    available: () => apiKey.length > 0,
    analyze: async (request: VisionObservationRequest): Promise<VisionObservationResponse> => {
      if (apiKey.length === 0) throw new VisionUnavailable('NO_CREDENTIALS', 'ANTHROPIC_API_KEY is not set in this environment, so no live vision call can be made')
      if (!isSupportedImageType(request.asset.mediaType)) throw new VisionUnavailable('TRANSPORT', `${request.asset.mediaType} cannot be sent as an image block; re-encode the asset first`)

      const started = Date.now()
      let raw: string | undefined
      const trace = (accepted: boolean, rejection?: { code: VisionResponseRejected['code']; message: string }, usage?: { inputTokens?: number; outputTokens?: number }): void => {
        options.onTrace?.({ provider, task: request.task, assetId: request.asset.assetId, assetByteHash: request.asset.byteHash, rawResponse: raw, accepted, rejection, latencyMs: Date.now() - started, usage })
      }

      let message: Awaited<ReturnType<AnthropicLike['messages']['create']>>
      try {
        const client = await createClient(apiKey)
        message = await client.messages.create({
          model,
          max_tokens: options.maxTokens ?? 8192,
          temperature: 0,
          system: SYSTEM,
          tools: [{ name: TOOL_NAME, description: `Record the source observations you made for ${extractorNameFor(provider, request.task)}.`, input_schema: visionResponseJsonSchema(request.task) }],
          tool_choice: { type: 'tool', name: TOOL_NAME },
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: request.asset.mediaType, data: toBase64(request.asset.bytes) } },
                { type: 'text', text: buildPrompt(request) },
              ],
            },
          ],
        })
      } catch (err) {
        trace(false, { code: 'NO_ANSWER', message: (err as Error).message })
        throw new VisionUnavailable('TRANSPORT', `the provider call failed: ${(err as Error).message}`)
      }

      const usage = { inputTokens: message.usage?.input_tokens, outputTokens: message.usage?.output_tokens }
      const call = message.content.find((b) => b.type === 'tool_use' && b.name === TOOL_NAME)
      if (!call) {
        raw = message.content.map((b) => b.text ?? '').join('\n')
        trace(false, { code: 'NO_ANSWER', message: 'the model did not call the observation tool' }, usage)
        throw new VisionResponseRejected('NO_ANSWER', `the model answered ${request.task} without calling ${TOOL_NAME}`)
      }
      raw = JSON.stringify(call.input)
      try {
        const response = validateVisionResponse(call.input, request)
        trace(true, undefined, usage)
        return response
      } catch (err) {
        if (err instanceof VisionResponseRejected) trace(false, { code: err.code, message: err.message }, usage)
        throw err
      }
    },
  }
}
