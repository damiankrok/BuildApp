/**
 * v3.53 — the seam through which a whole-house description is asked for, and the sorting of a page's pictures that
 * comes before it.
 *
 * `StructuredVision` is one question with numbered pictures and a JSON Schema for the answer. It is all a provider is:
 * the prompts, the vocabulary, the choice of pictures, the admission of the answer and everything built from it are
 * this repository's, deterministic and the same whichever provider answers. Three providers exist: the live Anthropic
 * adapter (a key on the HOST — never in an APK, never in the repository), a fixture replayer keyed by the bytes it was
 * asked about, and none at all (the analyzer then says so and keeps its drawings-only behaviour).
 */
import { sha256Bytes, sha256Hex } from '@buildapp/source-common'
import type { JsonSchemaNode } from './house-description.js'

export const HOUSE_READER_VERSION = '0.1.0'

export type ReaderPicture = { number: number; bytes: Uint8Array; mediaType: string }

export type StructuredVisionRequest = {
  purpose: 'HOUSE_TRIAGE' | 'HOUSE_DESCRIPTION'
  system: string
  text: string
  pictures: ReaderPicture[]
  schema: JsonSchemaNode
  signal?: AbortSignal
}

export type StructuredVisionUsage = { inputTokens?: number; outputTokens?: number; estimatedCostUsd?: number; latencyMs: number; model: string }

export interface StructuredVision {
  readonly provider: { id: string; model: string; triageModel: string; version: string }
  available(): boolean
  ask(request: StructuredVisionRequest): Promise<{ output: unknown; usage: StructuredVisionUsage }>
}

export class HouseReaderUnavailable extends Error {
  constructor(
    readonly reason: 'NO_PROVIDER' | 'NO_CREDENTIALS' | 'TRANSPORT' | 'NO_ANSWER' | 'FIXTURE_MISS',
    message: string,
  ) {
    super(message)
    this.name = 'HouseReaderUnavailable'
  }
}

// --- sorting the page's pictures -----------------------------------------------------------------------------------

export const PICTURE_KINDS = ['FLOOR_PLAN', 'ELEVATION', 'SECTION', 'EXTERIOR_VIEW', 'INTERIOR', 'SITE_PLAN', 'OTHER'] as const
export type PictureKind = (typeof PICTURE_KINDS)[number]

export const HOUSE_TRIAGE_SYSTEM = 'You sort pictures from a house-plan web page by what they are. You answer only in the given vocabulary.'

export const houseTriagePrompt = (n: number): string =>
  [
    `You are given ${n} small pictures from one project page, each preceded by its number. For each say what it is:`,
    '- FLOOR_PLAN: an architectural plan of a storey seen from above (walls, rooms).',
    '- ELEVATION: a flat, orthographic drawing or flat render of one facade.',
    '- SECTION: a vertical cut through the building.',
    '- EXTERIOR_VIEW: a perspective picture, render or photo of the building from outside.',
    '- INTERIOR: a room seen from inside.',
    '- SITE_PLAN: the building on its plot, a roof plan or a location plan.',
    '- OTHER: logos, icons, adverts, people, maps, details, anything else.',
    '`duplicateOf`: the number of an EARLIER picture that shows the same picture (another size or crop of it), else 0.',
    'Answer for every picture, in order.',
  ].join('\n')

export const HOUSE_TRIAGE_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  required: ['pictures'],
  properties: { pictures: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['picture', 'kind', 'duplicateOf'], properties: { picture: { type: 'integer' }, kind: { type: 'string', enum: [...PICTURE_KINDS] }, duplicateOf: { type: 'integer' } } } } },
}

export type TriagedPicture = { number: number; kind: PictureKind; duplicateOf: number }

/** A triage answer, kept only where it names a picture that was asked about, in the vocabulary. */
export function parseHouseTriage(raw: unknown, asked: ReadonlySet<number>): TriagedPicture[] {
  const list = (raw as { pictures?: unknown })?.pictures
  if (!Array.isArray(list)) return []
  const out = new Map<number, TriagedPicture>()
  for (const p of list as Array<Record<string, unknown>>) {
    const number = typeof p.picture === 'number' ? p.picture : NaN
    const kind = (PICTURE_KINDS as readonly string[]).includes(String(p.kind)) ? (p.kind as PictureKind) : undefined
    if (!asked.has(number) || !kind || out.has(number)) continue
    out.set(number, { number, kind, duplicateOf: typeof p.duplicateOf === 'number' && asked.has(p.duplicateOf) && p.duplicateOf < number ? p.duplicateOf : 0 })
  }
  return [...out.values()]
}

/** How many pictures of each kind a description is asked over: the largest of each, never a duplicate. */
export const HOUSE_PICTURE_BUDGET: Array<[PictureKind, number]> = [['FLOOR_PLAN', 4], ['ELEVATION', 6], ['SECTION', 1], ['SITE_PLAN', 1], ['EXTERIOR_VIEW', 4]]

export function selectHousePictures(triaged: TriagedPicture[], areaPx: (number: number) => number): TriagedPicture[] {
  const chosen: TriagedPicture[] = []
  for (const [kind, max] of HOUSE_PICTURE_BUDGET) chosen.push(...triaged.filter((t) => t.kind === kind && t.duplicateOf === 0).sort((a, b) => areaPx(b.number) - areaPx(a.number) || a.number - b.number).slice(0, max))
  return chosen.sort((a, b) => a.number - b.number)
}

// --- providers -------------------------------------------------------------------------------------------------------

/** What a recorded answer is keyed by: the question's purpose and the exact bytes of every picture, in order. */
export const structuredVisionKey = (request: Pick<StructuredVisionRequest, 'purpose' | 'pictures'>): string => sha256Hex(`${request.purpose}\n${request.pictures.map((p) => sha256Bytes(p.bytes)).join('\n')}`)

/**
 * Replays recorded answers against the bytes they were given for. A question about other bytes is a miss, loudly —
 * never an answer about a different house. `recordedFrom` says which live provider the answers came from.
 */
export function fixtureStructuredVision(answers: Record<string, unknown>, recordedFrom: { model: string; triageModel: string }): StructuredVision {
  return {
    provider: { id: 'house-reader.fixture', model: recordedFrom.model, triageModel: recordedFrom.triageModel, version: `${HOUSE_READER_VERSION}+fixture-${sha256Hex(JSON.stringify(Object.keys(answers).sort())).slice(0, 12)}` },
    available: () => true,
    ask: async (request) => {
      const key = structuredVisionKey(request)
      if (!(key in answers)) throw new HouseReaderUnavailable('FIXTURE_MISS', `no recorded ${request.purpose} answer for these ${request.pictures.length} pictures (${key.slice(0, 12)})`)
      return { output: answers[key], usage: { latencyMs: 0, model: request.purpose === 'HOUSE_TRIAGE' ? recordedFrom.triageModel : recordedFrom.model } }
    },
  }
}

export type AnthropicMessagesLike = {
  messages: { create(body: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<{ content: Array<{ type: string; text?: string }>; stop_reason?: string | null; usage?: { input_tokens?: number; output_tokens?: number } }> }
}

const toBase64 = (bytes: Uint8Array): string => (typeof Buffer !== 'undefined' ? Buffer.from(bytes).toString('base64') : btoa(String.fromCharCode(...bytes)))

/**
 * The live adapter: the official SDK, the pictures as base64 blocks each preceded by its number, the answer
 * constrained to the schema as a structured output (never a forced tool: the current models refuse a forced
 * `tool_choice`). The key is read from the host's environment and is never logged. NOT run live in this repository's
 * checks — there is no key here; `fixtureStructuredVision` replays what a live provider answered.
 */
export function anthropicStructuredVision(options: { apiKey?: string; model?: string; triageModel?: string; maxTokens?: number; createClient?: (apiKey: string) => Promise<AnthropicMessagesLike> } = {}): StructuredVision {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY ?? ''
  const model = options.model ?? 'claude-sonnet-5-5'
  const triageModel = options.triageModel ?? 'claude-haiku-5-5'
  const createClient =
    options.createClient ??
    (async (key: string): Promise<AnthropicMessagesLike> => {
      const mod = (await import('@anthropic-ai/sdk')) as unknown as { default: new (o: { apiKey: string }) => AnthropicMessagesLike }
      return new mod.default({ apiKey: key })
    })
  let client: Promise<AnthropicMessagesLike> | undefined
  return {
    provider: { id: 'house-reader.anthropic', model, triageModel, version: HOUSE_READER_VERSION },
    available: () => apiKey.length > 0,
    ask: async (request) => {
      if (apiKey.length === 0) throw new HouseReaderUnavailable('NO_CREDENTIALS', 'ANTHROPIC_API_KEY is not set on this host, so no house description can be asked for')
      client ??= createClient(apiKey)
      const use = request.purpose === 'HOUSE_TRIAGE' ? triageModel : model
      const content: unknown[] = []
      for (const p of request.pictures) content.push({ type: 'text', text: `Picture ${p.number}:` }, { type: 'image', source: { type: 'base64', media_type: p.mediaType, data: toBase64(p.bytes) } })
      content.push({ type: 'text', text: request.text })
      const started = Date.now()
      let response: Awaited<ReturnType<AnthropicMessagesLike['messages']['create']>>
      try {
        response = await (await client).messages.create(
          { model: use, max_tokens: options.maxTokens ?? 16000, system: request.system, messages: [{ role: 'user', content }], output_config: { format: { type: 'json_schema', schema: request.schema }, ...(request.purpose === 'HOUSE_DESCRIPTION' ? { effort: 'medium' } : {}) } },
          request.signal ? { signal: request.signal } : undefined,
        )
      } catch (e) {
        throw new HouseReaderUnavailable('TRANSPORT', (e as Error).message.slice(0, 300))
      }
      const text = response.content.find((b) => b.type === 'text' && typeof b.text === 'string')?.text
      if (response.stop_reason === 'refusal' || !text) throw new HouseReaderUnavailable('NO_ANSWER', `the provider returned no structured answer (${response.stop_reason ?? 'no text'})`)
      let output: unknown
      try {
        output = JSON.parse(text)
      } catch {
        throw new HouseReaderUnavailable('NO_ANSWER', 'the provider answered outside the schema (not JSON)')
      }
      return { output, usage: { inputTokens: response.usage?.input_tokens, outputTokens: response.usage?.output_tokens, latencyMs: Date.now() - started, model: use } }
    },
  }
}
