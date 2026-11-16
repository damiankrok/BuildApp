/**
 * v3.54.1: B's recorded live answers replayed through today's code (sorting, checker, builder, compiler), no API call.
 * The recorded answers are keyed by the exact question and bytes (`structuredVisionKey`): a changed question is a loud
 * FIXTURE_MISS, never another house's answer. Writes what campaign-run.ts writes, so the scorers read it unchanged.
 *   npx vite-node research/source-to-model/v3541/replay-b.ts -- --list <file> --answers <B root> --out <dir>
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { fileByteCache } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import { fixtureStructuredVision } from '@buildapp/source-vision'
import { DescribedRefusal, identityOf, runDescribedAnalysis, summaryOf } from '@buildapp/analysis-service'
import { serializeModel } from '@buildapp/model'
import { renderSceneSheet } from '../../../packages/mobile-scene/scripts/scene-sheet.js'
import { CAMPAIGN_MODELS } from './campaign.js'
import { parseHouseList } from './campaign-run.js'

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main(): Promise<void> {
  const answersRoot = arg('answers') as string
  const outRoot = arg('out') as string
  for (const { house, pkgPath, cacheDir } of parseHouseList(readFileSync(arg('list') as string, 'utf8'))) {
    const out = join(outRoot, house)
    mkdirSync(out, { recursive: true })
    const answersPath = join(answersRoot, house, 'answers.json')
    if (!existsSync(answersPath)) {
      console.log(JSON.stringify({ house, outcome: 'NOT_RECORDED' }))
      continue
    }
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as SourcePackage
    const reader = fixtureStructuredVision(JSON.parse(readFileSync(answersPath, 'utf8')) as Record<string, unknown>, { model: CAMPAIGN_MODELS.description, triageModel: CAMPAIGN_MODELS.triage })
    try {
      const run = await runDescribedAnalysis({ pkg, cache: fileByteCache(cacheDir), reader, identity: identityOf(pkg) })
      writeFileSync(join(out, 'result-summary.json'), JSON.stringify(summaryOf(run.result), null, 1))
      writeFileSync(join(out, 'model.json'), serializeModel(run.result.model))
      writeFileSync(join(out, 'description.json'), JSON.stringify(run.reading.description, null, 1))
      writeFileSync(join(out, 'scene-all-sides.png'), PNG.sync.write(renderSceneSheet(run.result.scene, 360, 'ALL')))
      writeFileSync(join(out, 'run.json'), JSON.stringify({ outcome: 'MODEL', house, issues: run.reading.issues, adjustments: run.adjustments, refused: run.refused, warnings: run.result.warningDetails.map((w) => `${w.severity} ${w.code}`), hashes: { model: run.result.modelSha256, scene: run.result.sceneSha256 } }, null, 1))
      console.log(JSON.stringify({ house, outcome: 'MODEL', issues: run.reading.issues.filter((i) => i.severity === 'WARN').map((i) => i.code) }))
    } catch (e) {
      const code = e instanceof DescribedRefusal ? e.code : 'ERROR'
      writeFileSync(join(out, 'run.json'), JSON.stringify({ outcome: 'NO_MODEL', house, code, message: String((e as Error).message).slice(0, 600) }, null, 1))
      console.log(JSON.stringify({ house, outcome: 'NO_MODEL', code, message: String((e as Error).message).slice(0, 160) }))
    }
  }
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
