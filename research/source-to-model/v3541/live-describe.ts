/**
 * v3.54.1 strategy B, LIVE: sealed source packages → the product's described path (`runDescribedAnalysis`: sorting of
 * the page's pictures, one whole-house description, checker, builder, emitter, compiler) with the product's live
 * adapter (`anthropicStructuredVision`, official SDK) behind the product's spend books. No drawings-path anchor is
 * passed: B measures what the reading alone builds. The hybrid H replays these same answers.
 *
 *   npx vite-node research/source-to-model/v3541/live-describe.ts -- --list <file> --out <dir> --books <dir> \
 *     --phase pilot|development|acceptance [--max-usd <cumulative USD, never above the phase ceiling>]
 *   list lines: "<house> <source-package.json> <byte cache dir>"
 *
 * THE KEY comes only from BUILDPLAN_ANTHROPIC_API_KEY (see campaign.ts); it is passed to the SDK explicitly with the
 * API's own host, never printed, stored, logged or put in an argument. Without it nothing is sent (exit 3).
 * Every request is reserved in the books before it is sent and settled to the usage the API reports (a timeout keeps
 * its reservation); every answer is recorded for offline replay (recording.ts). One house and one request at a time,
 * no retry inside the SDK. Exit: 0 done, 3 no key, 4 stopped by the budget, 1 error.
 */
import { readFileSync } from 'node:fs'
import { anthropicStructuredVision } from '@buildapp/source-vision'
import { CAMPAIGN_API_HOST, CAMPAIGN_KEY_VARIABLE, CAMPAIGN_MODELS, CAMPAIGN_PHASE_CEILING_USD } from './campaign.js'
import { CAMPAIGN_LEDGER } from './recording.js'
import { describeHouses, parseHouseList } from './campaign-run.js'

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main(): Promise<number> {
  const list = arg('list')
  const outRoot = arg('out')
  const booksDir = arg('books')
  const phase = arg('phase') ?? 'pilot'
  if (!list || !outRoot || !booksDir || !(phase in CAMPAIGN_PHASE_CEILING_USD)) throw new Error('usage: --list <file> --out <dir> --books <dir> --phase pilot|development|acceptance [--max-usd n]')
  const ceiling = CAMPAIGN_PHASE_CEILING_USD[phase as keyof typeof CAMPAIGN_PHASE_CEILING_USD]
  const maxUsd = Math.min(Number(arg('max-usd') ?? ceiling), ceiling)
  if (!Number.isFinite(maxUsd) || maxUsd <= 0) throw new Error('--max-usd must be a positive number')
  const key = process.env[CAMPAIGN_KEY_VARIABLE] ?? ''
  if (key.length === 0) {
    console.log(JSON.stringify({ sent: 0, why: `${CAMPAIGN_KEY_VARIABLE} is not set; nothing was asked` }))
    return 3
  }
  const live = anthropicStructuredVision({ apiKey: key, baseURL: CAMPAIGN_API_HOST, model: CAMPAIGN_MODELS.description, triageModel: CAMPAIGN_MODELS.triage })
  const outcomes = await describeHouses({ houses: parseHouseList(readFileSync(list, 'utf8')), outRoot, booksDir, ledgerPath: CAMPAIGN_LEDGER, phase, maxUsd, live, secret: key })
  return outcomes.some((o) => o.outcome === 'BUDGET_STOP') ? 4 : 0
}

main().then((code) => process.exit(code)).catch((e) => {
  const key = process.env[CAMPAIGN_KEY_VARIABLE]
  const text = String((e as Error).message ?? e)
  console.error((key ? text.split(key).join('[key]') : text).slice(0, 500))
  process.exit(1)
})
