/**
 * s5311 — ask (or replay) the evidence questions and score the answers. See README.md in this folder.
 *
 * Replay (offline, no key, no books, no ledger):
 *   npx vite-node research/source-to-model/s5311/evidence-questions/run.ts -- \
 *     --payloads <private payload dir> --mode replay --fixtures <fixture.json> --out <private dir>
 *
 * Live (the owner's key, on the owner's host; reserved against the campaign's ONE set of books):
 *   npx vite-node research/source-to-model/s5311/evidence-questions/run.ts -- \
 *     --payloads <dir> --mode live --model claude-sonnet-5-5 --max-usd 1 --out <private dir> \
 *     [--books ~/.buildplan/house-reader-books] [--ledger research/ai-assist/spend-ledger.json] [--only Q3,Q4-C] [--dry-run]
 *
 * THE KEY is read from ANTHROPIC_API_KEY in the terminal that runs this. It is never an argument, never printed, stored
 * or logged. Without it a live run refuses before anything is asked (exit 3). ANTHROPIC_BASE_URL must be unset.
 * Exit codes: 0 every request answered, 2 asked and stopped (budget, transport, refusal), 3 nothing asked, 1 a crash.
 */
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { RUN_EXIT, executeRun } from './runner.js'

const here = import.meta.dirname
const repoRoot = resolve(here, '../../../..')
const arg = (name: string, fallback?: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0 || process.argv[i + 1] === undefined || process.argv[i + 1].startsWith('--')) {
    if (fallback !== undefined) return fallback
    throw new Error(`--${name} is required`)
  }
  return process.argv[i + 1]
}

async function main(): Promise<number> {
  const mode = arg('mode')
  if (mode !== 'replay' && mode !== 'live') throw new Error('--mode is required: replay or live')
  if (mode === 'live' && process.env.ANTHROPIC_BASE_URL) throw new Error('unset ANTHROPIC_BASE_URL: this run must reach the API by its own host, on the key the owner configured, not through a gateway')
  const payloads = resolve(arg('payloads'))
  const only = arg('only', '').split(',').map((s) => s.trim()).filter(Boolean)
  const record = await executeRun({
    mode,
    payloads,
    questionsPath: resolve(arg('questions', join(here, 'questions.json'))),
    sealPath: resolve(arg('seal', join(here, 'questions.seal.json'))),
    out: resolve(arg('out', join(payloads, '..', 'runs', `${mode}-${new Date().toISOString().replace(/[:.]/g, '-')}`))),
    repoRoot,
    only,
    ...(mode === 'replay'
      ? { fixtures: resolve(arg('fixtures')) }
      : {
          apiKey: process.env.ANTHROPIC_API_KEY ?? '',
          model: arg('model', 'claude-sonnet-5-5'),
          books: resolve(arg('books', join(homedir(), '.buildplan', 'house-reader-books'))),
          ledger: resolve(arg('ledger', join(repoRoot, 'research/ai-assist/spend-ledger.json'))),
          maxUsd: Number(arg('max-usd', '1')),
          dryRun: process.argv.includes('--dry-run'),
        }),
  })
  const s = record.summary?.byVariant
  console.log(JSON.stringify({ exitCode: record.exitCode, code: record.code, message: record.message ?? null, B: s?.B ?? null, C: s?.C ?? null, booked: record.booked ?? null }))
  return record.exitCode
}

main().then(
  (code) => process.exit(code),
  (e: unknown) => {
    console.error(String((e as Error).message ?? e).slice(0, 400))
    process.exit(e instanceof Error && /is required|unset ANTHROPIC_BASE_URL|QUESTIONS_NOT_SEALED|PAYLOAD/.test(e.message) ? RUN_EXIT.NOT_STARTED : 1)
  },
)
