/**
 * v3.53.1: ONE paid reading of ONE DEV page through the product's real adapter (`anthropicStructuredVision`, the
 * official SDK) behind the product's spend books (`house-reader-spend`), on a sealed source package.
 *
 * The key is never in this process's hands unless the host's environment holds it: by default the request carries a
 * placeholder and the session's network proxy, where a credential for the API's host was saved by the owner on a
 * secure form, replaces it. Nothing here prints, stores or logs a key. The books are opened at what the campaign's
 * ledger already holds, under the campaign's ceiling, so the reservation is refused if it would pass it.
 *
 * vite-node sdk-live.ts -- --package <source-package.json> --cache <dir> --books <dir> --opening <usd> --max <usd> --out <dir> [--recorded <dir>]
 * Run it with ANTHROPIC_BASE_URL unset (the adapter must talk to the API's own host, not to the session's gateway).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileByteCache } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import { DescribedRefusal, identityOf, runDescribedAnalysis } from '@buildapp/analysis-service'
import { anthropicStructuredVision } from '@buildapp/source-vision'
import type { AnthropicMessagesLike, HouseDescription } from '@buildapp/source-vision'
import { DEFAULT_SPEND_LIMITS, openSpendLedger, spendGuardedStructuredVision } from '../../../apps/analyzer-api/src/house-reader-spend.js'

const arg = (name: string, fallback?: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0) {
    if (fallback !== undefined) return fallback
    throw new Error(`--${name} is required`)
  }
  return process.argv[i + 1]
}

const shape = (d: HouseDescription) => ({
  overall: `${d.overall.widthM} x ${d.overall.depthM} (${d.overall.basis})`,
  bodies: d.bodies.map((b) => `${b.role} ${Math.abs(b.x1 - b.x0).toFixed(1)}x${Math.abs(b.z1 - b.z0).toFixed(1)} storeys ${b.storeys}${b.habitableAttic ? '+attic' : ''} ${b.roof.kind} ${b.roof.ridge} ${b.roof.pitchDeg}`),
  openingsBySide: Object.fromEntries(['FRONT', 'REAR', 'LEFT', 'RIGHT'].map((s) => [s, d.openings.filter((o) => o.side === s).length])),
  features: { dormers: d.dormers.length, rooflights: d.rooflights.length, chimneys: d.chimneys.length, balconies: d.balconies.length, terraces: d.terraces.length, canopies: d.canopies.length },
})

async function main(): Promise<void> {
  if (process.env.ANTHROPIC_BASE_URL) throw new Error('unset ANTHROPIC_BASE_URL: this run must reach the API by its own host, on the key the owner configured, not through the session’s gateway')
  const out = arg('out')
  mkdirSync(out, { recursive: true })
  const pkg = JSON.parse(readFileSync(arg('package'), 'utf8')) as SourcePackage
  const limits = { ...DEFAULT_SPEND_LIMITS, maxUsd: Number(arg('max')), maxDescriptionsPerDay: 1, maxRequestsPerDay: 3 }
  const ledger = openSpendLedger({ dir: arg('books'), limits, openingUsd: Number(arg('opening')) })
  const calls: Array<Record<string, unknown>> = []
  // the SDK, as the adapter builds it — with one addition for the record: what the API answered beside the content
  const adapter = anthropicStructuredVision({
    apiKey: process.env.BUILDAPP_PILOT_API_KEY ?? 'sk-ant-api03-placeholder-replaced-by-the-session-proxy',
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
  const reader = spendGuardedStructuredVision(adapter, ledger, { limits })
  const before = (() => {
    try {
      return ledger.read().cumulativeUsd
    } catch {
      return Number(arg('opening'))
    }
  })()
  const record: Record<string, unknown> = { url: pkg.canonicalUrl, provider: adapter.provider, booksBeforeUsd: before, ceilingUsd: limits.maxUsd }
  try {
    const run = await runDescribedAnalysis({ pkg, cache: fileByteCache(arg('cache')), reader, identity: identityOf(pkg) })
    writeFileSync(join(out, 'description.json'), JSON.stringify(run.reading.description, null, 1))
    writeFileSync(join(out, 'result-warnings.json'), JSON.stringify(run.result.warningDetails, null, 1))
    Object.assign(record, { outcome: 'MODEL', usage: run.reading.usage, timings: run.timings, pictures: run.reading.pictures.map((p) => ({ number: p.number, kind: p.kind, original: p.byteHash, sent: p.sentSha256, sentBytes: p.sentBytes })), issues: run.reading.issues, adjustments: run.adjustments.map((a) => a.code), technical: { compileErrors: run.result.warningDetails.filter((w) => w.code === 'COMPILER_ERRORS').length, exterior: run.result.verification.closure }, shape: shape(run.reading.description) })
    const recorded = arg('recorded', '')
    if (recorded) Object.assign(record, { recordedCliShape: shape(JSON.parse(readFileSync(join(recorded, 'description.json'), 'utf8')) as HouseDescription) })
  } catch (e) {
    Object.assign(record, { outcome: 'NO_MODEL', code: e instanceof DescribedRefusal ? e.code : 'ERROR', message: String((e as Error).message).slice(0, 400) })
  }
  const after = ledger.read()
  Object.assign(record, { calls, booksAfterUsd: after.cumulativeUsd, bookedUsd: Number((after.cumulativeUsd - before).toFixed(6)), requests: after.requests })
  writeFileSync(join(out, 'sdk-live.json'), JSON.stringify(record, null, 1))
  console.log(JSON.stringify({ outcome: record.outcome, code: record.code ?? null, message: record.message ?? null, calls, bookedUsd: record.bookedUsd, booksAfterUsd: record.booksAfterUsd }, null, 1))
}

main().catch((e: unknown) => {
  console.error(String((e as Error).message ?? e).slice(0, 400))
  process.exit(1)
})
