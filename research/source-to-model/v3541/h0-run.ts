/**
 * v3.54.1 strategy H0 — the product's existing local→description channel applied to EVERY house, measured on the
 * recorded live answers of B (no API call; the description's question does not depend on the anchors, so B's answers
 * replay exactly). One house per invocation:
 *
 *   OFFLINE=1 npx vite-node research/source-to-model/v3541/h0-run.ts -- --package <pkg.json> --cache <dir> --answers <B house dir> --out <dir>
 *
 * 1. LOCAL: runAnalysis on the sealed package, offline, with the recogniser and the content encoder exactly as the
 *    v3.54 A runs (second-house.ts --content --recogniser). Its model, if any, is written under local/.
 * 2. If LOCAL built a model — weak or not by its own account (the product's gate asks only for weak ones) — the
 *    description is built on LOCAL's measures (`anchorsOfDrawings`: overall from framed dimension chains or a complete
 *    outline, bodies at a verified scale, a measured storey height) through `runDescribedAnalysis`.
 *    If LOCAL refused with a describable code, the description is built alone (= B). Otherwise there is no model.
 * Writes result-summary.json, model.json, description.json, scene-all-sides.png and run.json (what was taken from
 * LOCAL, every adjustment) so the v3.54 scorer reads it unchanged.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { PNG } from 'pngjs'
import { SourcePackageSchema, archonAdapter, fileByteCache, genericProjectPageAdapter } from '@buildapp/source-package'
import { fixtureStructuredVision } from '@buildapp/source-vision'
import { serializeModel } from '@buildapp/model'
import { workerImageEmbedder, workerRecogniser, workspaceAssetPaths, workspaceImageRolePaths } from '@buildapp/numeric-recogniser-ort'
import { AnalysisError, DESCRIBABLE_AFTER, DescribedRefusal, anchorsOfDrawings, drawingsWeaknesses, identityOf, runAnalysis, runDescribedAnalysis, summaryOf } from '@buildapp/analysis-service'
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
  mkdirSync(join(out, 'local'), { recursive: true })
  const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(arg('package') as string, 'utf8')))
  const cache = fileByteCache(arg('cache') as string)
  const answersPath = join(arg('answers') as string, 'answers.json')
  const answers = existsSync(answersPath) ? (JSON.parse(readFileSync(answersPath, 'utf8')) as Record<string, unknown>) : {}
  const reader = fixtureStructuredVision(answers, { model: CAMPAIGN_MODELS.description, triageModel: CAMPAIGN_MODELS.triage })
  const ocr = join(process.cwd(), '.cache', 'numeric-recogniser-ort', `ocr-worker-${process.pid}.mjs`)
  await bundleRecogniserWorker(ocr)
  const recogniser = workerRecogniser({ workerUrl: pathToFileURL(ocr), paths: workspaceAssetPaths() })
  const role = join(process.cwd(), '.cache', 'numeric-recogniser-ort', `image-role-worker-${process.pid}.mjs`)
  await bundleImageRoleWorker(role)
  const content = workerImageEmbedder({ workerUrl: pathToFileURL(role), paths: workspaceImageRolePaths() })
  const t0 = Date.now()
  const record: Record<string, unknown> = { url: pkg.canonicalUrl, answersRecorded: Object.keys(answers).length }
  let local: Awaited<ReturnType<typeof runAnalysis>> | null = null
  try {
    local = await runAnalysis({ kind: 'PACKAGE', pkg }, { adapters: [archonAdapter, genericProjectPageAdapter], cache, offline: true, recogniser, content })
    writeFileSync(join(out, 'local', 'result-summary.json'), JSON.stringify(summaryOf(local.result), null, 1))
    writeFileSync(join(out, 'local', 'model.json'), serializeModel(local.result.model))
    record.local = { outcome: 'MODEL', weaknesses: drawingsWeaknesses(local.result), modelSha256: local.result.modelSha256, sceneSha256: local.result.sceneSha256, ms: Date.now() - t0 }
  } catch (e) {
    const err = e instanceof AnalysisError ? e : null
    record.local = { outcome: 'NO_MODEL', code: err?.code ?? 'ERROR', reasonCode: err?.detail.reasonCode ?? null, ms: Date.now() - t0 }
    if (!err || !DESCRIBABLE_AFTER.has(err.code)) {
      writeFileSync(join(out, 'run.json'), JSON.stringify({ outcome: 'NO_MODEL', code: err?.code ?? 'ERROR', basis: 'NONE', ...record }, null, 1))
      console.log(JSON.stringify({ outcome: 'NO_MODEL', basis: 'NONE', local: record.local }))
      return
    }
  }
  const anchors = local ? anchorsOfDrawings(local) : undefined
  record.anchors = anchors ?? null
  record.basis = local ? 'DESCRIPTION_ON_LOCAL_MEASURES' : 'DESCRIPTION_ALONE'
  try {
    const run = await runDescribedAnalysis({ pkg, cache, reader, identity: identityOf(pkg), after: local ? { code: 'H0_ALWAYS', reasonCode: drawingsWeaknesses(local.result).join('+') || 'NONE' } : { code: (record.local as { code: string }).code, reasonCode: null }, ...(anchors ? { anchors } : {}) })
    writeFileSync(join(out, 'result-summary.json'), JSON.stringify(summaryOf(run.result), null, 1))
    writeFileSync(join(out, 'model.json'), serializeModel(run.result.model))
    writeFileSync(join(out, 'description.json'), JSON.stringify(run.reading.description, null, 1))
    writeFileSync(join(out, 'scene-all-sides.png'), PNG.sync.write(renderSceneSheet(run.result.scene, 360, 'ALL')))
    writeFileSync(join(out, 'run.json'), JSON.stringify({ outcome: 'MODEL', ...record, adjustments: run.adjustments, refused: run.refused, warnings: run.result.warningDetails.map((w) => `${w.severity} ${w.code}`), hashes: { model: run.result.modelSha256, scene: run.result.sceneSha256 }, ms: Date.now() - t0 }, null, 1))
    console.log(JSON.stringify({ outcome: 'MODEL', basis: record.basis, local: record.local, adjustments: run.adjustments.map((a) => a.code) }))
  } catch (e) {
    // the description refused: the product keeps LOCAL's model where there is one
    const code = e instanceof DescribedRefusal ? e.code : 'ERROR'
    if (local) {
      writeFileSync(join(out, 'result-summary.json'), JSON.stringify(summaryOf(local.result), null, 1))
      writeFileSync(join(out, 'model.json'), serializeModel(local.result.model))
      writeFileSync(join(out, 'scene-all-sides.png'), PNG.sync.write(renderSceneSheet(local.result.scene, 360, 'ALL')))
    }
    writeFileSync(join(out, 'run.json'), JSON.stringify({ outcome: local ? 'MODEL' : 'NO_MODEL', ...record, basis: local ? 'LOCAL_KEPT' : 'NONE', describedRefusal: { code, message: String((e as Error).message).slice(0, 400) }, ms: Date.now() - t0 }, null, 1))
    console.log(JSON.stringify({ outcome: local ? 'MODEL' : 'NO_MODEL', basis: local ? 'LOCAL_KEPT' : 'NONE', describedRefusal: code }))
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e)
  process.exit(1)
})
