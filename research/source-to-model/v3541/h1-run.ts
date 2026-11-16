/**
 * v3.54.1 strategy H1 through the PRODUCT entry, `analyseLink`: the drawings' path as the host runs it (recogniser and
 * content encoder as in the A runs), the recorded live answers of B as the house reader (replay, no API call), and
 * `readEveryModel` on or off. One house per invocation:
 *   OFFLINE=1 npx vite-node research/source-to-model/v3541/h1-run.ts -- --package <pkg.json> --cache <dir> --answers <B house dir> --out <dir> [--read-every-model]
 * Writes result-summary.json, model.json, scene-all-sides.png and run.json (basis, the decision and its reason, the
 * gate's reason, adjustments), so the scorers read it unchanged.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { PNG } from 'pngjs'
import { SourcePackageSchema, archonAdapter, fileByteCache, genericProjectPageAdapter } from '@buildapp/source-package'
import { fixtureStructuredVision } from '@buildapp/source-vision'
import { serializeModel } from '@buildapp/model'
import { workerImageEmbedder, workerRecogniser, workspaceAssetPaths, workspaceImageRolePaths } from '@buildapp/numeric-recogniser-ort'
import { AnalysisError, analyseLink, summaryOf } from '@buildapp/analysis-service'
// @ts-expect-error — a plain ES module without type declarations (as in second-house.ts)
import { bundleImageRoleWorker, bundleRecogniserWorker } from '../../../packages/numeric-recogniser-ort/build.mjs'
import { renderSceneSheet } from '../../../packages/mobile-scene/scripts/scene-sheet.js'
import { CAMPAIGN_MODELS } from './campaign.js'

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main(): Promise<void> {
  const out = arg('out') as string
  mkdirSync(out, { recursive: true })
  const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(arg('package') as string, 'utf8')))
  const answersPath = join(arg('answers') as string, 'answers.json')
  const answers = existsSync(answersPath) ? (JSON.parse(readFileSync(answersPath, 'utf8')) as Record<string, unknown>) : {}
  const houseReader = fixtureStructuredVision(answers, { model: CAMPAIGN_MODELS.description, triageModel: CAMPAIGN_MODELS.triage })
  const ocr = join(process.cwd(), '.cache', 'numeric-recogniser-ort', `ocr-worker-${process.pid}.mjs`)
  await bundleRecogniserWorker(ocr)
  const role = join(process.cwd(), '.cache', 'numeric-recogniser-ort', `image-role-worker-${process.pid}.mjs`)
  await bundleImageRoleWorker(role)
  const t0 = Date.now()
  try {
    const run = await analyseLink(
      { kind: 'PACKAGE', pkg },
      {
        adapters: [archonAdapter, genericProjectPageAdapter],
        cache: fileByteCache(arg('cache') as string),
        offline: true,
        recogniser: workerRecogniser({ workerUrl: pathToFileURL(ocr), paths: workspaceAssetPaths() }),
        content: workerImageEmbedder({ workerUrl: pathToFileURL(role), paths: workspaceImageRolePaths() }),
        houseReader,
        readEveryModel: process.argv.includes('--read-every-model'),
      },
    )
    writeFileSync(join(out, 'result-summary.json'), JSON.stringify(summaryOf(run.result), null, 1))
    writeFileSync(join(out, 'model.json'), serializeModel(run.result.model))
    writeFileSync(join(out, 'scene-all-sides.png'), PNG.sync.write(renderSceneSheet(run.result.scene, 360, 'ALL')))
    if (run.basis === 'DESCRIPTION') writeFileSync(join(out, 'description.json'), JSON.stringify(run.reading.description, null, 1))
    const record = {
      outcome: 'MODEL',
      basis: run.basis,
      descriptionCheck: run.descriptionCheck ?? null,
      after: run.basis === 'DESCRIPTION' ? run.after : null,
      adjustments: run.basis === 'DESCRIPTION' ? run.adjustments : [],
      warnings: run.result.warningDetails.map((w) => `${w.severity} ${w.code}`),
      hashes: { model: run.result.modelSha256, scene: run.result.sceneSha256 },
      ms: Date.now() - t0,
    }
    writeFileSync(join(out, 'run.json'), JSON.stringify(record, null, 1))
    console.log(JSON.stringify({ outcome: 'MODEL', basis: run.basis, check: run.descriptionCheck?.decision ?? null, after: record.after?.code ?? null, perAxis: record.adjustments.some((a) => a.code === 'SCALED_TO_DRAWINGS_MEASURE_PER_AXIS') }))
  } catch (e) {
    const err = e instanceof AnalysisError ? e : null
    writeFileSync(join(out, 'run.json'), JSON.stringify({ outcome: 'NO_MODEL', code: err?.code ?? 'ERROR', reasonCode: err?.detail.reasonCode ?? null, described: (err?.attachments as { described?: unknown } | undefined)?.described ?? null, message: String((e as Error).message).slice(0, 400), ms: Date.now() - t0 }, null, 1))
    console.log(JSON.stringify({ outcome: 'NO_MODEL', code: err?.code ?? 'ERROR' }))
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e)
  process.exit(1)
})
