/**
 * v3.53.1: the whole path of a link on the CURRENT code — the drawings' path, the routing decision and, where it is
 * taken, the described path — on a sealed source package, with the recorded answers of an earlier reading replayed by
 * a stand-in reader. Nothing is paid for and no provider is reached; the reader's own latency is taken from the
 * recorded run and reported beside the measured times, never added silently.
 * vite-node url-to-result.ts -- --package <source-package.json> --cache <dir> --recorded <dir with run.json, description.json> --out <file.json>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { archonAdapter, decodeImage, fileByteCache, genericProjectPageAdapter, startDecoders } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import { AnalysisError, analyseLink } from '@buildapp/analysis-service'
import type { DescribingEvent } from '@buildapp/analysis-service'
import type { StructuredVision } from '@buildapp/source-vision'

const arg = (name: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0) throw new Error(`--${name} is required`)
  return process.argv[i + 1]
}

async function main(): Promise<void> {
  const pkg = JSON.parse(readFileSync(arg('package'), 'utf8')) as SourcePackage
  const cache = fileByteCache(arg('cache'))
  const recorded = arg('recorded')
  const run = JSON.parse(readFileSync(join(recorded, 'run.json'), 'utf8')) as { picturesSent: Array<{ assetId: string; triage: string }>; timings?: { readMs: number } }
  const description = JSON.parse(readFileSync(join(recorded, 'description.json'), 'utf8')) as unknown
  // the numbering the sorting is asked in: the page's pictures that decode, in the package's order (as `readHouse` numbers them)
  await startDecoders()
  const numbered: string[] = []
  for (const asset of pkg.assets) {
    const v = asset.variants.find((x) => x.id === asset.selectedVariantId) ?? asset.variants[0]
    const hit = v ? await cache.get(v.url) : null
    if (!v || !hit) continue
    try {
      const r = decodeImage(hit.bytes)
      if (Math.min(r.width, r.height) >= 120) numbered.push(asset.id)
    } catch {
      // not shown to the reader
    }
  }
  const kindOf = new Map(run.picturesSent.map((p) => [p.assetId, p.triage]))
  const asked: string[] = []
  const reader: StructuredVision = {
    provider: { id: 'house-reader.replay', model: 'recorded', triageModel: 'recorded', version: 'replay' },
    available: () => true,
    ask: async (request) => {
      asked.push(`${request.purpose}:${request.pictures.length}`)
      return { output: request.purpose === 'HOUSE_TRIAGE' ? { pictures: request.pictures.map((p) => ({ picture: p.number, kind: kindOf.get(numbered[p.number - 1]) ?? 'OTHER', duplicateOf: 0 })) } : description, usage: { latencyMs: 0, model: 'recorded' } }
    },
  }
  const progress: Array<{ t: number; stage: string; progress: number; detail?: string }> = []
  const events: Array<{ t: number; phase: string; pictures: number; after: DescribingEvent['after'] }> = []
  const t0 = performance.now()
  const at = (): number => Math.round(performance.now() - t0)
  let describingAt: number | null = null
  const out: Record<string, unknown> = { url: pkg.canonicalUrl, recordedReaderMs: run.timings?.readMs ?? null }
  try {
    const result = await analyseLink(
      { kind: 'PACKAGE', pkg },
      {
        adapters: [archonAdapter, genericProjectPageAdapter],
        cache,
        houseReader: reader,
        progress: (p) => progress.push({ t: at(), stage: p.stage, progress: p.progress, ...(p.detail ? { detail: p.detail.slice(0, 60) } : {}) }),
        onDescribing: (e) => {
          describingAt ??= at()
          events.push({ t: at(), phase: e.phase, pictures: e.pictures.length, after: e.after })
        },
      },
    )
    const total = at()
    Object.assign(out, {
      outcome: 'MODEL',
      basis: result.basis,
      after: result.basis === 'DESCRIPTION' ? result.after : null,
      alternative: result.basis === 'DESCRIPTION' && result.alternative ? { modelHash: result.alternative.result.modelHash, provisional: result.alternative.result.preview.provisional.map((p) => p.code) } : null,
      anchors: result.basis === 'DESCRIPTION' ? result.adjustments.filter((a) => /DRAWINGS_MEASURE/.test(a.code)).map((a) => `${a.code}: ${a.why}`) : [],
      provisional: result.result.preview.provisional.map((p) => p.code),
      technical: { compileErrors: result.result.warningDetails.filter((w) => w.code === 'COMPILER_ERRORS').length, exteriorErrors: result.result.verification.closure.exteriorErrors },
      ms: { total, drawings: describingAt ?? total, describedWithoutReader: describingAt === null ? 0 : total - describingAt },
    })
  } catch (e) {
    Object.assign(out, { outcome: 'NO_MODEL', code: e instanceof AnalysisError ? e.code : 'ERROR', described: e instanceof AnalysisError ? (e.attachments?.described ?? null) : null, message: String((e as Error).message).slice(0, 300), ms: { total: at(), drawings: describingAt ?? at() } })
  }
  const stageIndexBack = progress.some((p, i) => i > 0 && p.progress < progress[i - 1].progress)
  Object.assign(out, { asked, events, progress: { reports: progress.length, everMovedBack: stageIndexBack, atDescribingStart: describingAt === null ? null : (progress.filter((p) => p.t <= (describingAt as number)).pop()?.progress ?? null), last: progress[progress.length - 1] ?? null, firstDescribed: progress.find((p) => p.detail?.startsWith('described')) ?? null } })
  writeFileSync(arg('out'), JSON.stringify(out, null, 1))
  console.log(JSON.stringify({ outcome: out.outcome, basis: out.basis, after: out.after, ms: out.ms, anchors: out.anchors }))
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
