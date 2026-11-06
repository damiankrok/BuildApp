/**
 * EXTERIOR-COMPLETE research (E12, traced in E13): a `VisionReasoner` whose transport is Claude Code's headless mode
 * (`claude -p`), so a second look can be tried live in a Claude Code session that has no API key of its own: the
 * session authenticates the call. Research only — production keeps `anthropicVisionReasoner` (SDK + key) and the null
 * provider; nothing under `packages/` imports this file, and nothing here runs on a phone.
 *
 * Same contract as the SDK adapter: the same system text and prompt (`VISION_SYSTEM`, `buildVisionPrompt`), the task's
 * JSON Schema (here as the run's structured output rather than a forced tool), and the answer through
 * `validateVisionResponse` — a rejected answer is thrown away whole. The image goes as a base64 block in a stream-json
 * user message; tools are off, MCP is off, sessions are not persisted, and the working directory is a fresh empty one,
 * so the model sees the one picture and the one question and nothing else (no project file, no reference answer).
 *
 * E13: every call is traced without a secret — the model asked for and the model(s) that answered, the CLI session id,
 * which kind of credential the CLI says it used (`apiKeySource`, a category, never a value), tokens in and out with the
 * cache reads and writes, wall and API latency, and the cost. The cost is what the CLI computes from tokens and its
 * price table: an ESTIMATE, recorded as one. Whether and from which balance it was billed is not knowable from here
 * and is recorded as unconfirmed, never as a figure.
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { VISION_CONTRACT_VERSION, VISION_SYSTEM, VisionResponseRejected, VisionUnavailable, buildVisionPrompt, validateVisionResponse, visionResponseJsonSchema } from '@buildapp/source-vision'
import type { VisionObservationRequest, VisionObservationResponse, VisionProviderInfo, VisionReasoner } from '@buildapp/source-vision'

export const CLAUDE_CODE_TRANSPORT_VERSION = '0.2.0'

const sha = (b: Uint8Array | string): string => createHash('sha256').update(b).digest('hex')

/** One headless call as the ledger keeps it. No credential, no image bytes, no prompt text — hashes of them. */
export type CliCall = {
  transport: 'claude-code-cli'
  transportVersion: string
  modelRequested: string
  /** The models the CLI says produced the answer (its `modelUsage` keys), and the session model it announced. */
  modelsReturned: string[]
  sessionModel: string | null
  sessionId: string | null
  /** The CLI's own name for the credential category (e.g. `none` for the session's login, or an env key's name). */
  authCategory: string | null
  promptHash: string
  schemaHash: string
  imageHash: string | null
  usage: { inputTokens: number | null; outputTokens: number | null; cacheReadTokens: number | null; cacheCreationTokens: number | null }
  latencyMs: number
  apiLatencyMs: number | null
  turns: number | null
  status: 'OK' | 'NO_STRUCTURED_ANSWER' | 'CLI_ERROR' | 'TRANSPORT_ERROR'
  /** What the CLI computes from tokens and its price table. An estimate, not a bill. */
  estimatedCostUsd: number | null
  costBasis: 'CLI_TOKEN_ESTIMATE'
  /** Whether the amount was charged, and to which balance, cannot be confirmed from this side. */
  billedCostUsd: null
  billing: 'UNCONFIRMED'
  raw: string
  error?: string
  /** For the old field name in E12 records. */
  model: string
  costUsd: number | null
  ok: boolean
}

type Event = Record<string, unknown>
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null)

/** Pure: the trace of one call from the CLI's stream-json events. Exported for the test. */
export function traceOf(events: Event[], o: { modelRequested: string; promptHash: string; schemaHash: string; imageHash: string | null; latencyMs: number; error?: string }): CliCall {
  const init = events.find((e) => e.type === 'system' && e.subtype === 'init')
  const last = events.filter((e) => e.type === 'result').pop()
  const usage = (last?.usage ?? {}) as Record<string, unknown>
  const modelUsage = (last?.modelUsage ?? {}) as Record<string, unknown>
  const ok = !!last && last.is_error !== true && last.structured_output !== undefined
  const status: CliCall['status'] = o.error && !last ? 'TRANSPORT_ERROR' : !last || last.is_error === true ? 'CLI_ERROR' : last.structured_output === undefined ? 'NO_STRUCTURED_ANSWER' : 'OK'
  const cost = num(last?.total_cost_usd)
  return {
    transport: 'claude-code-cli',
    transportVersion: CLAUDE_CODE_TRANSPORT_VERSION,
    modelRequested: o.modelRequested,
    modelsReturned: Object.keys(modelUsage).sort(),
    sessionModel: typeof init?.model === 'string' ? init.model : null,
    sessionId: typeof last?.session_id === 'string' ? last.session_id : typeof init?.session_id === 'string' ? init.session_id : null,
    authCategory: typeof init?.apiKeySource === 'string' ? init.apiKeySource : null,
    promptHash: o.promptHash,
    schemaHash: o.schemaHash,
    imageHash: o.imageHash,
    usage: { inputTokens: num(usage.input_tokens), outputTokens: num(usage.output_tokens), cacheReadTokens: num(usage.cache_read_input_tokens), cacheCreationTokens: num(usage.cache_creation_input_tokens) },
    latencyMs: o.latencyMs,
    apiLatencyMs: num(last?.duration_api_ms),
    turns: num(last?.num_turns),
    status,
    estimatedCostUsd: cost,
    costBasis: 'CLI_TOKEN_ESTIMATE',
    billedCostUsd: null,
    billing: 'UNCONFIRMED',
    raw: JSON.stringify(last?.structured_output ?? last?.result ?? null).slice(0, 4000),
    ...(o.error ? { error: o.error.slice(0, 400) } : {}),
    model: o.modelRequested,
    costUsd: cost,
    ok,
  }
}

/** A spend guard, consulted before each call: it throws instead of letting a call start past the limit. */
export type SpendGuard = { reserve: (estimateUsd: number, what: string) => void; settle: (call: CliCall, what: string) => void }

/** One headless call: an image and a text, a JSON Schema for the answer; returns the structured output (or throws). */
export async function claudeCodeStructured(opts: { model: string; system: string; imagePng?: Uint8Array; mediaType?: string; text: string; schema: object; budgetUsd?: number; effort?: string; onCall?: (c: CliCall) => void; guard?: SpendGuard; what?: string }): Promise<unknown> {
  const content: unknown[] = []
  if (opts.imagePng) content.push({ type: 'image', source: { type: 'base64', media_type: opts.mediaType ?? 'image/png', data: Buffer.from(opts.imagePng).toString('base64') } })
  content.push({ type: 'text', text: opts.text })
  const message = JSON.stringify({ type: 'user', message: { role: 'user', content } }) + '\n'
  const schemaText = JSON.stringify(opts.schema)
  const hashes = { modelRequested: opts.model, promptHash: sha(`${opts.system}\n---\n${opts.text}`), schemaHash: sha(schemaText), imageHash: opts.imagePng ? sha(opts.imagePng) : null }
  const perCallCap = opts.budgetUsd ?? 0.5
  opts.guard?.reserve(perCallCap, opts.what ?? 'call')
  // an empty working directory: no project memory, no files to read, tools off
  const cwd = mkdtempSync(join(tmpdir(), 'cc-vision-'))
  const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--model', opts.model, '--json-schema', schemaText, '--tools', '', '--no-session-persistence', '--strict-mcp-config', '--max-budget-usd', String(perCallCap), '--system-prompt', opts.system, ...(opts.effort ? ['--effort', opts.effort] : [])]
  const started = Date.now()
  let events: Event[] = []
  let call: CliCall | undefined
  try {
    const out = await new Promise<string>((resolve, reject) => {
      const child = spawn('claude', args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] })
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (d) => (stdout += String(d)))
      child.stderr.on('data', (d) => (stderr += String(d)))
      child.on('error', reject)
      child.on('close', (code) => {
        events = stdout.trim().split('\n').filter(Boolean).flatMap((l) => {
          try {
            return [JSON.parse(l) as Event]
          } catch {
            return [{ type: 'unparsed', text: l.slice(0, 200) }]
          }
        })
        if (code === 0) resolve(stdout)
        else reject(new Error(`claude exited ${code}: ${stderr.slice(0, 400)}`))
      })
      child.stdin.end(message)
    })
    void out
    call = traceOf(events, { ...hashes, latencyMs: Date.now() - started })
    opts.onCall?.(call)
    if (!call.ok) throw new VisionResponseRejected('NO_ANSWER', `no structured answer (${call.status})`)
    return events.filter((e) => e.type === 'result').pop()?.structured_output
  } catch (e) {
    if (e instanceof VisionResponseRejected) throw e
    call = traceOf(events, { ...hashes, latencyMs: Date.now() - started, error: (e as Error).message })
    opts.onCall?.(call)
    throw new VisionUnavailable('TRANSPORT', (e as Error).message)
  } finally {
    if (call) opts.guard?.settle(call, opts.what ?? 'call')
    rmSync(cwd, { recursive: true, force: true })
  }
}

export function claudeCodeVisionReasoner(opts: { model: string; effort?: string; onCall?: (c: CliCall) => void; guard?: SpendGuard }): VisionReasoner {
  const provider: VisionProviderInfo = { id: 'vision.claude-code-cli', model: opts.model, version: `${CLAUDE_CODE_TRANSPORT_VERSION}+contract-${VISION_CONTRACT_VERSION}` }
  return {
    provider,
    available: () => true,
    analyze: async (request: VisionObservationRequest): Promise<VisionObservationResponse> => {
      // the SDK prompt's last line names its tool; this transport answers as the run's structured output instead
      const prompt = buildVisionPrompt(request).replace(/\n\nReturn your answer by calling [\s\S]*$/, '\n\nReturn your answer as the structured output only.')
      const raw = await claudeCodeStructured({ model: opts.model, system: VISION_SYSTEM, imagePng: request.asset.bytes, mediaType: request.asset.mediaType, text: prompt, schema: visionResponseJsonSchema(request.task), effort: opts.effort, onCall: opts.onCall, guard: opts.guard, what: request.asset.assetId })
      return validateVisionResponse(raw, request)
    },
  }
}
