/**
 * v3.53 S53-E3: one sealed source package through the PRODUCT's described path (`runDescribedAnalysis`), the reader
 * being the session CLI behind the product seam. Writes the result summary, model, scene sheet and the pictures sent.
 * vite-node product-path.ts -- --package <source-package.json> --cache <dir> --out <dir> [--model id] [--effort level]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { fileByteCache } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import { DescribedRefusal, identityOf, runDescribedAnalysis, summaryOf } from '@buildapp/analysis-service'
import { serializeModel } from '@buildapp/model'
import { ledgerGuard } from '../../ai-assist/spend-ledger.js'
import { renderSceneSheet } from '../../../packages/mobile-scene/scripts/scene-sheet.js'
import { cliStructuredVision } from './cli-reader.js'

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main(): Promise<void> {
  const out = arg('out') as string
  mkdirSync(out, { recursive: true })
  const pkg = JSON.parse(readFileSync(arg('package') as string, 'utf8')) as SourcePackage
  const calls: unknown[] = []
  const reader = cliStructuredVision({ model: arg('model') ?? 'claude-sonnet-5-5', triageModel: 'claude-haiku-5-5', effort: arg('effort') ?? 'medium', guard: ledgerGuard(arg('ledger') ?? 'research/ai-assist/spend-ledger.json', 'S53-E3 product described path'), what: out, onCall: (c) => calls.push(c) })
  try {
    const run = await runDescribedAnalysis({ pkg, cache: fileByteCache(arg('cache') as string), reader, identity: identityOf(pkg), onPictures: (sent) => sent.forEach((p) => writeFileSync(join(out, `sent-${String(p.number).padStart(2, '0')}.jpg`), p.bytes)) })
    writeFileSync(join(out, 'result-summary.json'), JSON.stringify(summaryOf(run.result), null, 1))
    writeFileSync(join(out, 'model.json'), serializeModel(run.result.model))
    writeFileSync(join(out, 'description.json'), JSON.stringify(run.reading.description, null, 1))
    writeFileSync(join(out, 'scene-all-sides.png'), PNG.sync.write(renderSceneSheet(run.result.scene, 360, 'ALL')))
    const cost = (calls as Array<{ estimatedCostUsd?: number | null }>).reduce((s, c) => s + (c.estimatedCostUsd ?? 0), 0)
    const record = { outcome: 'MODEL', url: pkg.canonicalUrl, picturesSent: run.reading.pictures.map((p) => ({ number: p.number, assetId: p.assetId, byteHash: p.byteHash, triage: p.kind })), issues: run.reading.issues, adjustments: run.adjustments, refused: run.refused, warnings: run.result.warningDetails.map((w) => `${w.severity} ${w.code}`), counts: run.result.counts, technical: run.result.assessment.technicalValidity.status, timings: run.timings, estimatedCostUsd: cost, calls, hashes: { model: run.result.modelSha256, scene: run.result.sceneSha256, sourcePackage: pkg.contentHash } }
    writeFileSync(join(out, 'run.json'), JSON.stringify(record, null, 1))
    console.log(JSON.stringify({ outcome: 'MODEL', cost, timings: run.timings, technical: record.technical, warnings: record.warnings }))
  } catch (e) {
    const record = { outcome: 'NO_MODEL', url: pkg.canonicalUrl, code: e instanceof DescribedRefusal ? e.code : 'ERROR', message: String((e as Error).message).slice(0, 500), calls }
    writeFileSync(join(out, 'run.json'), JSON.stringify(record, null, 1))
    console.log(JSON.stringify(record).slice(0, 600))
  }
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
