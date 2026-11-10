/**
 * v3.53 S53 research transport: one headless Claude Code call (`claude -p`) with SEVERAL numbered pictures and one
 * text, answered as structured output against a JSON Schema. Same isolation as the E12/E13 transport
 * (`research/ai-assist/claude-code-reasoner.ts`): tools off, MCP off, no session persistence, an empty working
 * directory; every call reserved in the cumulative spend ledger before it starts and settled after. Research only.
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { traceOf } from '../../ai-assist/claude-code-reasoner.js'
import type { CliCall, SpendGuard } from '../../ai-assist/claude-code-reasoner.js'

const sha = (b: Uint8Array | string): string => createHash('sha256').update(b).digest('hex')

export type NumberedImage = { number: number; bytes: Uint8Array; mediaType: string }

export async function claudeCodeMulti(opts: { model: string; system: string; images: NumberedImage[]; text: string; schema: object; capUsd: number; effort?: string; guard: SpendGuard; what: string; timeoutMs?: number }): Promise<{ output: unknown; call: CliCall }> {
  const content: unknown[] = []
  for (const im of opts.images) {
    content.push({ type: 'text', text: `Picture ${im.number}:` })
    content.push({ type: 'image', source: { type: 'base64', media_type: im.mediaType, data: Buffer.from(im.bytes).toString('base64') } })
  }
  content.push({ type: 'text', text: opts.text })
  const message = JSON.stringify({ type: 'user', message: { role: 'user', content } }) + '\n'
  const schemaText = JSON.stringify(opts.schema)
  const hashes = { modelRequested: opts.model, promptHash: sha(`${opts.system}\n---\n${opts.text}`), schemaHash: sha(schemaText), imageHash: sha(opts.images.map((i) => sha(i.bytes)).join(',')) }
  opts.guard.reserve(opts.capUsd, opts.what)
  const cwd = mkdtempSync(join(tmpdir(), 'cc-vision-'))
  const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--model', opts.model, '--json-schema', schemaText, '--tools', '', '--no-session-persistence', '--strict-mcp-config', '--max-budget-usd', String(opts.capUsd), '--system-prompt', opts.system, ...(opts.effort ? ['--effort', opts.effort] : [])]
  const started = Date.now()
  let events: Array<Record<string, unknown>> = []
  let call: CliCall | undefined
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn('claude', args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] })
      let stdout = ''
      let stderr = ''
      const timer = setTimeout(() => child.kill('SIGKILL'), opts.timeoutMs ?? 600_000)
      child.stdout.on('data', (d) => (stdout += String(d)))
      child.stderr.on('data', (d) => (stderr += String(d)))
      child.on('error', reject)
      child.on('close', (code) => {
        clearTimeout(timer)
        events = stdout.trim().split('\n').filter(Boolean).flatMap((l) => {
          try {
            return [JSON.parse(l) as Record<string, unknown>]
          } catch {
            return []
          }
        })
        if (code === 0) resolve()
        else reject(new Error(`claude exited ${code}: ${stderr.slice(0, 400)}`))
      })
      child.stdin.end(message)
    })
    call = traceOf(events, { ...hashes, latencyMs: Date.now() - started })
    if (!call.ok) throw new Error(`no structured answer (${call.status}): ${call.raw.slice(0, 300)}`)
    return { output: events.filter((e) => e.type === 'result').pop()?.structured_output, call }
  } catch (e) {
    call ??= traceOf(events, { ...hashes, latencyMs: Date.now() - started, error: (e as Error).message })
    throw Object.assign(new Error((e as Error).message), { call })
  } finally {
    if (call) opts.guard.settle(call, opts.what)
    rmSync(cwd, { recursive: true, force: true })
  }
}
