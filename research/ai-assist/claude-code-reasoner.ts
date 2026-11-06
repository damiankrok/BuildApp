/**
 * EXTERIOR-COMPLETE E12 research: a `VisionReasoner` whose transport is Claude Code's headless mode (`claude -p`), so a
 * second look can be tried live in a Claude Code session that has no API key of its own: the session authenticates the
 * call and bills the owner's Claude Code budget. Research only — production keeps `anthropicVisionReasoner` (SDK + key)
 * and the null provider; nothing under `packages/` imports this file.
 *
 * Same contract as the SDK adapter: the same system text and prompt (`VISION_SYSTEM`, `buildVisionPrompt`), the task's
 * JSON Schema (here as the run's structured output rather than a forced tool, which today's models refuse), and the
 * answer through `validateVisionResponse` — a rejected answer is thrown away whole. The image goes as a base64 block in
 * a stream-json user message; tools are off, so the model sees the one picture and nothing else.
 *
 * Every call is traced with its model, cost (as Claude Code reports it), latency and raw answer.
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { VISION_CONTRACT_VERSION, VISION_SYSTEM, VisionResponseRejected, VisionUnavailable, buildVisionPrompt, validateVisionResponse, visionResponseJsonSchema } from '@buildapp/source-vision'
import type { VisionObservationRequest, VisionObservationResponse, VisionProviderInfo, VisionReasoner } from '@buildapp/source-vision'

export const CLAUDE_CODE_TRANSPORT_VERSION = '0.1.0'

export type CliCall = { model: string; costUsd: number | null; latencyMs: number; ok: boolean; raw: string; error?: string }

/** One headless call: an image and a text, a JSON Schema for the answer; returns the structured output (or throws). */
export async function claudeCodeStructured(opts: { model: string; system: string; imagePng?: Uint8Array; mediaType?: string; text: string; schema: object; budgetUsd?: number; effort?: string; onCall?: (c: CliCall) => void }): Promise<unknown> {
  const content: unknown[] = []
  if (opts.imagePng) content.push({ type: 'image', source: { type: 'base64', media_type: opts.mediaType ?? 'image/png', data: Buffer.from(opts.imagePng).toString('base64') } })
  content.push({ type: 'text', text: opts.text })
  const message = JSON.stringify({ type: 'user', message: { role: 'user', content } }) + '\n'
  // an empty working directory: no project memory, no files to read, tools off
  const cwd = mkdtempSync(join(tmpdir(), 'cc-vision-'))
  const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--model', opts.model, '--json-schema', JSON.stringify(opts.schema), '--tools', '', '--no-session-persistence', '--strict-mcp-config', '--max-budget-usd', String(opts.budgetUsd ?? 1), '--system-prompt', opts.system, ...(opts.effort ? ['--effort', opts.effort] : [])]
  const started = Date.now()
  try {
    const out = await new Promise<string>((resolve, reject) => {
      const child = spawn('claude', args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] })
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (d) => (stdout += String(d)))
      child.stderr.on('data', (d) => (stderr += String(d)))
      child.on('error', reject)
      child.on('close', (code) => (code === 0 ? resolve(stdout) : reject(new Error(`claude exited ${code}: ${stderr.slice(0, 400)}`))))
      child.stdin.end(message)
    })
    const last = out.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>).filter((e) => e.type === 'result').pop()
    const call: CliCall = { model: opts.model, costUsd: typeof last?.total_cost_usd === 'number' ? last.total_cost_usd : null, latencyMs: Date.now() - started, ok: !!last && last.is_error !== true && last.structured_output !== undefined, raw: JSON.stringify(last?.structured_output ?? last?.result ?? null) }
    opts.onCall?.(call)
    if (!call.ok) throw new VisionResponseRejected('NO_ANSWER', `no structured answer (${String(last?.subtype ?? 'no result')})`)
    return last?.structured_output
  } catch (e) {
    if (e instanceof VisionResponseRejected) throw e
    opts.onCall?.({ model: opts.model, costUsd: null, latencyMs: Date.now() - started, ok: false, raw: '', error: (e as Error).message })
    throw new VisionUnavailable('TRANSPORT', (e as Error).message)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
}

export function claudeCodeVisionReasoner(opts: { model: string; effort?: string; onCall?: (c: CliCall) => void }): VisionReasoner {
  const provider: VisionProviderInfo = { id: 'vision.claude-code-cli', model: opts.model, version: `${CLAUDE_CODE_TRANSPORT_VERSION}+contract-${VISION_CONTRACT_VERSION}` }
  return {
    provider,
    available: () => true,
    analyze: async (request: VisionObservationRequest): Promise<VisionObservationResponse> => {
      // the SDK prompt's last line names its tool; this transport answers as the run's structured output instead
      const prompt = buildVisionPrompt(request).replace(/\n\nReturn your answer by calling [\s\S]*$/, '\n\nReturn your answer as the structured output only.')
      const raw = await claudeCodeStructured({ model: opts.model, system: VISION_SYSTEM, imagePng: request.asset.bytes, mediaType: request.asset.mediaType, text: prompt, schema: visionResponseJsonSchema(request.task), effort: opts.effort, onCall: opts.onCall })
      return validateVisionResponse(raw, request)
    },
  }
}
