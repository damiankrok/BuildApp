/**
 * v3.54.1 strategy C (crops.ts), live or replayed. Live: as live-describe.ts (key from BUILDPLAN_ANTHROPIC_API_KEY,
 * the product's adapter behind the product's books, every answer recorded). Replay: --replay <C root> reads the
 * recorded answers instead (no API call); the crops are recomputed from the same bytes, so the questions are the same.
 *   npx vite-node research/source-to-model/v3541/c-describe.ts -- --list <file> --out <dir> --books <dir> --phase development [--max-usd n]
 *   npx vite-node research/source-to-model/v3541/c-describe.ts -- --list <file> --out <dir> --replay <C root>
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { anthropicStructuredVision, fixtureStructuredVision } from '@buildapp/source-vision'
import { fileByteCache } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import { DescribedRefusal, identityOf, runDescribedAnalysis, summaryOf } from '@buildapp/analysis-service'
import { serializeModel } from '@buildapp/model'
import { renderSceneSheet } from '../../../packages/mobile-scene/scripts/scene-sheet.js'
import { CAMPAIGN_API_HOST, CAMPAIGN_KEY_VARIABLE, CAMPAIGN_MODELS, CAMPAIGN_PHASE_CEILING_USD } from './campaign.js'
import { CAMPAIGN_LEDGER } from './recording.js'
import { describeHouses, parseHouseList } from './campaign-run.js'
import { withCrops } from './crops.js'

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main(): Promise<number> {
  const houses = parseHouseList(readFileSync(arg('list') as string, 'utf8'))
  const outRoot = arg('out') as string
  const replay = arg('replay')
  if (replay) {
    for (const { house, pkgPath, cacheDir } of houses) {
      const out = join(outRoot, house)
      mkdirSync(out, { recursive: true })
      const answersPath = join(replay, house, 'answers.json')
      if (!existsSync(answersPath)) continue
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as SourcePackage
      const cache = fileByteCache(cacheDir)
      const c = withCrops(fixtureStructuredVision(JSON.parse(readFileSync(answersPath, 'utf8')) as Record<string, unknown>, { model: CAMPAIGN_MODELS.description, triageModel: CAMPAIGN_MODELS.triage }), { cache, log: (e) => appendFileSync(join(out, 'crops.jsonl'), `${JSON.stringify(e)}\n`) })
      try {
        const run = await runDescribedAnalysis({ pkg, cache, reader: c.reader, identity: identityOf(pkg), onPictures: c.onPictures })
        writeFileSync(join(out, 'result-summary.json'), JSON.stringify(summaryOf(run.result), null, 1))
        writeFileSync(join(out, 'model.json'), serializeModel(run.result.model))
        writeFileSync(join(out, 'description.json'), JSON.stringify(run.reading.description, null, 1))
        writeFileSync(join(out, 'scene-all-sides.png'), PNG.sync.write(renderSceneSheet(run.result.scene, 360, 'ALL')))
        writeFileSync(join(out, 'run.json'), JSON.stringify({ outcome: 'MODEL', house, issues: run.reading.issues, adjustments: run.adjustments, hashes: { model: run.result.modelSha256, scene: run.result.sceneSha256 } }, null, 1))
        console.log(JSON.stringify({ house, outcome: 'MODEL' }))
      } catch (e) {
        writeFileSync(join(out, 'run.json'), JSON.stringify({ outcome: 'NO_MODEL', house, code: e instanceof DescribedRefusal ? e.code : 'ERROR', message: String((e as Error).message).slice(0, 600) }, null, 1))
        console.log(JSON.stringify({ house, outcome: 'NO_MODEL', code: e instanceof DescribedRefusal ? e.code : 'ERROR' }))
      }
    }
    return 0
  }
  const phase = arg('phase') ?? 'development'
  const ceiling = CAMPAIGN_PHASE_CEILING_USD[phase as keyof typeof CAMPAIGN_PHASE_CEILING_USD]
  if (!ceiling) throw new Error('--phase pilot|development|acceptance')
  const maxUsd = Math.min(Number(arg('max-usd') ?? ceiling), ceiling)
  const key = process.env[CAMPAIGN_KEY_VARIABLE] ?? ''
  if (!key) {
    console.log(JSON.stringify({ sent: 0, why: `${CAMPAIGN_KEY_VARIABLE} is not set; nothing was asked` }))
    return 3
  }
  const live = anthropicStructuredVision({ apiKey: key, baseURL: CAMPAIGN_API_HOST, model: CAMPAIGN_MODELS.description, triageModel: CAMPAIGN_MODELS.triage })
  const outcomes = await describeHouses({
    houses,
    outRoot,
    booksDir: arg('books') as string,
    ledgerPath: CAMPAIGN_LEDGER,
    phase: `${phase}:C`,
    maxUsd,
    live,
    secret: key,
    variant: (reader, ctx) => withCrops(reader, { cache: ctx.cache, log: (e) => appendFileSync(join(ctx.out, 'crops.jsonl'), `${JSON.stringify(e)}\n`) }),
  })
  return outcomes.some((o) => o.outcome === 'BUDGET_STOP') ? 4 : 0
}

main().then((code) => process.exit(code)).catch((e) => {
  const key = process.env[CAMPAIGN_KEY_VARIABLE]
  const text = String((e as Error).message ?? e)
  console.error((key ? text.split(key).join('[key]') : text).slice(0, 500))
  process.exit(1)
})
