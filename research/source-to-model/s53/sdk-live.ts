/**
 * ONE reading of ONE DEV page through the product's real adapter (`anthropicStructuredVision`, the official SDK)
 * behind the product's spend books, on a sealed source package. The trial itself — what is saved, the one set of
 * books, the exit codes — is `apps/analyzer-api/scripts/house-reader-trial.ts`; this file is its command line and the
 * only place the SDK's client is made.
 *
 * THE KEY is read by the SDK from the ANTHROPIC_API_KEY variable of the terminal that runs this — the owner's own.
 * It is never an argument, never printed, stored or logged, and it must not be pasted into a chat. Without one the
 * request carries a placeholder and the API refuses it with 401: nothing is billed and nothing is booked — the dry run.
 *
 * From the repository root, with Node 22 and `npm ci` done.
 *
 * Windows PowerShell (the variable lives in this window only; close the window and it is gone):
 *   $env:ANTHROPIC_API_KEY = Read-Host -MaskInput "API key"      # PowerShell 7.1+; typed, not echoed, not in history
 *   Remove-Item Env:ANTHROPIC_BASE_URL -ErrorAction SilentlyContinue
 *   npx vite-node research/source-to-model/s53/sdk-live.ts -- --url "<a DEV project page>" `
 *     --cache "$HOME\buildplan-private\cache" --out "$HOME\buildplan-private\trial-1"
 *   "exit code: $LASTEXITCODE"                                    # 0 model, 2 no model, 3 nothing was asked
 *   Remove-Item Env:ANTHROPIC_API_KEY
 * (Windows PowerShell 5.1 has no -MaskInput: use
 *   $s = Read-Host -AsSecureString "API key"; $env:ANTHROPIC_API_KEY = [System.Net.NetworkCredential]::new('', $s).Password )
 *
 * bash / zsh:
 *   read -rs ANTHROPIC_API_KEY && export ANTHROPIC_API_KEY
 *   npx vite-node research/source-to-model/s53/sdk-live.ts -- --url '<a DEV project page>' \
 *     --cache ~/buildplan-private/cache --out ~/buildplan-private/trial-1; echo "exit code: $?"
 *   unset ANTHROPIC_API_KEY
 *
 * Arguments: `--url <page>` or `--package <source-package.json>` (a package sealed earlier); `--cache <dir>`,
 * `--out <dir>` (private, outside the repository); `--books <dir>` (default: `.buildplan/house-reader-books` in the
 * home directory — ONE directory, continued by every run; it opens at the campaign ledger's total and is refused if it
 * holds less); `--ledger <file>` (default: the campaign's `research/ai-assist/spend-ledger.json`, to which a run's
 * cost is appended — commit that change); `--max <USD>` (default and upper bound: the ledger's own limit);
 * `--recorded <dir>` (a description recorded earlier, for its shape beside the new one).
 * ANTHROPIC_BASE_URL must be unset: the adapter talks to the API's own host.
 *
 * What a reading costs is not a fixed price: the books reserve an upper bound for the pictures actually sent and the
 * answer ceiling, and settle to the usage the API reports. The provider-side stop is the WORKSPACE's monthly spend
 * limit in the provider's console, for the workspace the key belongs to; these books are what enforces the campaign's
 * cumulative limit.
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { acquireSourcePackage, archonAdapter, fileByteCache, genericProjectPageAdapter } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import { anthropicStructuredVision } from '@buildapp/source-vision'
import type { AnthropicMessagesLike, HouseDescription } from '@buildapp/source-vision'
import { TRIAL_EXIT, runHouseReaderTrial } from '../../../apps/analyzer-api/scripts/house-reader-trial.js'
import type { TrialCall } from '../../../apps/analyzer-api/scripts/house-reader-trial.js'

const repoRoot = resolve(import.meta.dirname, '../../..')
const arg = (name: string, fallback?: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0 || process.argv[i + 1] === undefined) {
    if (fallback !== undefined) return fallback
    throw new Error(`--${name} is required`)
  }
  return process.argv[i + 1]
}

async function main(): Promise<number> {
  if (process.env.ANTHROPIC_BASE_URL) throw new Error('unset ANTHROPIC_BASE_URL: this run must reach the API by its own host, on the key the owner configured, not through a gateway')
  const out = resolve(arg('out'))
  const cache = fileByteCache(resolve(arg('cache')))
  const url = arg('url', '')
  const pkg = url ? await acquireSourcePackage(url, [archonAdapter, genericProjectPageAdapter], { cache }) : (JSON.parse(readFileSync(arg('package'), 'utf8')) as SourcePackage)
  const calls: TrialCall[] = []
  // the SDK, as the adapter builds it — with one addition for the record: what the API answered beside the content
  const adapter = anthropicStructuredVision({
    apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-api03-placeholder-no-key-in-this-environment',
    createClient: async (key, { timeoutMs }) => {
      const mod = (await import('@anthropic-ai/sdk')) as unknown as { default: new (o: { apiKey: string; maxRetries: number; timeout: number; baseURL: string }) => AnthropicMessagesLike }
      const client = new mod.default({ apiKey: key, maxRetries: 0, timeout: timeoutMs, baseURL: 'https://api.anthropic.com' })
      return {
        messages: {
          create: async (body, options) => {
            const started = Date.now()
            try {
              const r = (await client.messages.create(body, options)) as Awaited<ReturnType<AnthropicMessagesLike['messages']['create']>> & { model?: string; id?: string }
              calls.push({ requested: body.model, served: r.model ?? null, id: r.id ?? null, stop: r.stop_reason ?? null, usage: r.usage ?? null, ms: Date.now() - started, blocks: r.content.map((b) => b.type) })
              return r
            } catch (e) {
              const err = e as { status?: number; name?: string; message?: string; error?: { error?: { type?: string } } }
              calls.push({ requested: body.model, failed: true, status: err.status ?? null, name: err.name ?? null, type: err.error?.error?.type ?? null, message: String(err.message ?? '').slice(0, 200), ms: Date.now() - started })
              throw e
            }
          },
        },
      }
    },
  })
  const recordedDir = arg('recorded', '')
  const record = await runHouseReaderTrial({
    pkg,
    cache,
    adapter,
    calls,
    keyPresent: Boolean(process.env.ANTHROPIC_API_KEY),
    books: resolve(arg('books', join(homedir(), '.buildplan', 'house-reader-books'))),
    campaignLedger: resolve(arg('ledger', join(repoRoot, 'research/ai-assist/spend-ledger.json'))),
    maxUsd: Number(arg('max', '5')),
    out,
    repoRoot,
    ...(recordedDir ? { recorded: JSON.parse(readFileSync(join(recordedDir, 'description.json'), 'utf8')) as HouseDescription } : {}),
  })
  // one line a script can parse; the whole record is trial.json
  console.log(JSON.stringify({ outcome: record.outcome, exitCode: record.exitCode, code: record.code, message: record.message ?? null, bookedUsd: record.bookedUsd ?? 0, booksAfterUsd: record.booksAfterUsd ?? null, determinism: (record.determinism as { sameBytes?: boolean } | undefined)?.sameBytes ?? null, out }))
  if (record.outcome !== 'MODEL') console.error(`NO MODEL (${record.code}): ${String(record.message ?? '').slice(0, 300)}`)
  return record.exitCode
}

main().then(
  (code) => process.exit(code),
  (e: unknown) => {
    console.error(String((e as Error).message ?? e).slice(0, 400))
    process.exit(e instanceof Error && /is required|unset ANTHROPIC_BASE_URL/.test(e.message) ? TRIAL_EXIT.NOT_STARTED : 1)
  },
)
