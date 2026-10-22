/**
 * N7-P2: re-run the production solver on a development house's sealed graph + metric evidence and write, OUTSIDE the
 * repository, what P2 audits: the model and its program, every view's use (`viewAudit`), the base plan, the facade
 * opening reading against the model (`facadeAlignment`), and — with `--overlays` — the before/after overlays of the
 * model's projected contours on each registered elevation (PNG, from the publisher's own raster: never committed).
 *
 *   npx vite-node research/analyzer-005y-n7-p2/replay.ts -- --run <dir> --package <source-package.json> \
 *        --cache <byte cache> --out <dir outside the repo> [--overlays]
 *
 * RESEARCH ONLY; production never imports it. OFFLINE: rasters are decoded from already-cached bytes.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'
import { serializeModel } from '@buildapp/model'
import { SourcePackageSchema, archonAdapter, decodeImage, fileByteCache, genericProjectPageAdapter, selectedVariant } from '@buildapp/source-package'
import { reconstructV2 } from '@buildapp/reconstruction'
import { identityOf } from '../../packages/analysis-service/src/identity.js'
import { writeOverlays } from './overlays.js'

const REPO = resolve(import.meta.dirname, '../..')
const value = (name: string, fallback?: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0 || i + 1 >= process.argv.length) {
    if (fallback !== undefined) return fallback
    throw new Error(`--${name} is required`)
  }
  return process.argv[i + 1]
}
const out = resolve(value('out'))
if (out === REPO || out.startsWith(`${REPO}/`)) throw new Error('REFUSED: replay outputs never go inside the repository')
mkdirSync(out, { recursive: true })
const run = resolve(value('run'))
const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(value('package'), 'utf8')))
const load = (name: string): unknown => JSON.parse(existsSync(join(run, `${name}.json`)) ? readFileSync(join(run, `${name}.json`), 'utf8') : gunzipSync(readFileSync(join(run, `${name}.json.gz`))).toString('utf8'))
const graph = load('observation-graph') as never
const metrics = load('metric-evidence') as never
const cache = fileByteCache(value('cache'))
const rasters = new Map<string, ReturnType<typeof decodeImage> | undefined>()
for (const asset of pkg.assets) {
  const variant = selectedVariant(asset)
  const got = await cache.get(variant.url)
  if (!got) continue
  try {
    rasters.set(variant.byteHash, decodeImage(got.bytes))
  } catch {
    rasters.set(variant.byteHash, undefined)
  }
}
const identity = identityOf(pkg, [archonAdapter, genericProjectPageAdapter])
const masks = new Map<string, Array<{ mask: Uint8Array; closed: Uint8Array; box: { c0: number; r0: number; W: number; H: number } }>>()
const r = reconstructV2({
  ...(process.env.GREP ? { debug: (line: string) => { if (new RegExp(process.env.GREP as string).test(line)) console.error(`debug ${line}`) } } : {}),
  ...(process.argv.includes('--overlays') ? { facadeMaskSink: (frameId: string, mask: Uint8Array, closed: Uint8Array, box: { c0: number; r0: number; W: number; H: number }) => masks.set(frameId, [...(masks.get(frameId) ?? []), { mask, closed: closed.slice(), box }]) } : {}),
  modelId: identity.modelId,
  label: identity.label,
  slug: identity.slug,
  sourcePackageId: pkg.id,
  sourcePackageHash: pkg.contentHash,
  graph,
  metrics,
  raster: (frame: { variantByteHash: string }) => rasters.get(frame.variantByteHash),
  publishedAreas: pkg.publishedFacts,
  publishedRooms: pkg.publishedRooms,
})
const modelText = serializeModel(r.model)
writeFileSync(join(out, 'model.json'), modelText)
writeFileSync(join(out, 'program.json'), JSON.stringify(r.candidate.program) + '\n')
const plan = r.planDiagnostics.plans.find((p) => p.frameId === r.planDiagnostics.selectedPlanFrameId)
const asset = plan ? pkg.assets.find((a) => a.id === plan.assetId) : undefined
const variant = asset ? selectedVariant(asset) : undefined
const elevationAssets = pkg.assets.filter((a) => a.roles.document === 'ELEVATION' || a.roles.document === 'PERSPECTIVE_RENDER').map((a) => ({ id: a.id, document: a.roles.document, view: a.roles.view, projection: a.roles.projection, sizePx: `${selectedVariant(a).decoded.width}x${selectedVariant(a).decoded.height}`, variants: a.variants.length }))
const audit = {
  modelSha256: createHash('sha256').update(modelText).digest('hex'),
  basePlan: plan && asset && variant ? { assetId: asset.id, storey: asset.roles.storey, annotation: asset.roles.annotation, projection: asset.roles.projection, sizePx: `${variant.decoded.width}x${variant.decoded.height}`, variants: asset.variants.length, byteHash: variant.byteHash, mpp: plan.scale, metric: plan.metric ?? null, chains: plan.chains.length, segmentsRead: plan.chains.reduce((a, c) => a + c.read, 0), dimensionEvidence: plan.dimensionEvidence?.kind ?? 'READ' } : null,
  plansRegistered: r.registrations.plans.map((p) => ({ storey: p.storeyIndex, mppX: p.mppX, mppY: p.mppY })),
  elevationAssets,
  views: r.viewAudit,
  facadeAlignment: (r as { facadeAlignment?: unknown }).facadeAlignment ?? null,
  crossView: r.crossViewResiduals.views,
  thinBodies: r.thinBodies,
  // N7-FIX-01: bodies named in an open zone, and how many things the run left unresolved
  zoneBodies: r.zoneBodies,
  unresolved: r.unresolved.length,
  openingCounts: r.openingCounts,
  openings: r.building.openings.map((o) => ({ id: o.id, facade: o.facade, storeyIndex: o.storeyIndex, interval: o.interval, sillY: o.sillY, headY: o.headY, provenance: o.provenance, callout: o.callout ?? null, elevation: o.elevation ?? null, why: o.why })),
}
writeFileSync(join(out, 'audit.json'), JSON.stringify(audit, null, 1) + '\n')
if (process.argv.includes('--overlays')) writeOverlays(r, (frameId) => {
  const f = (graph as { coordinateFrames: Array<{ id: string; variantByteHash: string }> }).coordinateFrames.find((x) => x.id === frameId)
  return f ? rasters.get(f.variantByteHash) : undefined
}, join(out, 'overlays'), masks)
console.log(JSON.stringify({ outcome: 'COMPLETED', modelSha256: audit.modelSha256, views: r.viewAudit.map((v) => `${v.side ?? '-'}:${v.use}`).join(' ') }))
