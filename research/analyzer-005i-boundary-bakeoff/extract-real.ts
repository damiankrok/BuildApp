/**
 * extract-real.ts — RESEARCH ONLY (BUILDPLAN-ANALYZER-005I Track B). Run from the snapshot (snapshot.sh), never
 * imported by production code.
 *
 *   npx vite-node research/analyzer-005i-boundary-bakeoff/extract-real.ts -- --house <id> [--work /home/user/work005i]
 *
 * For one development house:
 *   1. takes the FROZEN 005H run of that house (observation graph, metric evidence, plan digest — houses.json `run`),
 *      picks the ground-floor plan frame the production resolver based the building on (`selectedPlanFrameId`, or,
 *      when the run refused before choosing one, the frame the production `readPlans` order reads first: GROUND,
 *      dimensioned, largest),
 *   2. decodes that frame's variant bytes from the sealed offline byte cache with the PRODUCTION decoder
 *      (`decodeImage`), checks them against the package's byte hash, and writes the decoded pixels — the one input
 *      every provider sees — as lossless PNGs outside the repository (RGBA as decoded; the production Rec.601 luma),
 *   3. runs BuildPlan source-cv and the boundary evidence layer on exactly those pixels and writes the normalized
 *      observations (observation.ts), plus the MobileSAM prompt inputs (the plan extent and the BUILT cells).
 *
 * Publisher pixels stay under --work. Only text facts (ids, hashes, numbers) are copied into the repository later.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { SourcePackageSchema, decodeImage, fileByteCache } from '@buildapp/source-package'
import type { SourceObservationGraph } from '@buildapp/source-observations'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import { toGray } from '@buildapp/source-cv'
import type { Raster } from '@buildapp/source-cv'
import { exteriorTicksOf, extentSidesOf, planCallouts, planExtent } from '@buildapp/reconstruction'
import { baselineObservations, r3, sha256 } from './baseline.js'
import { RESEARCH_ONLY } from './observation.js'

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const HERE = new URL('.', import.meta.url).pathname
const REPO = process.env.REPO ?? '/home/user/BuildApp'

type House = { id: string; package: string; packageSha256: string; cache: string; run: string; purpose: string }

async function main(): Promise<void> {
  const work = arg('work') ?? '/home/user/work005i'
  const houseId = arg('house')
  const houses = (JSON.parse(readFileSync(join(HERE, 'houses.json'), 'utf8')) as { houses: House[] }).houses
  const house = houses.find((h) => h.id === houseId)
  if (!house) throw new Error(`unknown house ${houseId}`)
  const pkgPath = house.package.startsWith('/') ? house.package : join(REPO, house.package)
  const pkgBytes = readFileSync(pkgPath)
  if (sha256(pkgBytes) !== house.packageSha256) throw new Error(`package hash mismatch for ${house.id}`)
  const pkg = SourcePackageSchema.parse(JSON.parse(pkgBytes.toString('utf8')))
  const graph = JSON.parse(readFileSync(join(house.run, 'observation-graph.json'), 'utf8')) as SourceObservationGraph
  const metrics = JSON.parse(readFileSync(join(house.run, 'metric-evidence.json'), 'utf8')) as MetricEvidenceSet
  const digest = JSON.parse(readFileSync(join(house.run, 'plan-diagnostics', 'digest.json'), 'utf8')) as {
    selectedPlanFrameId: string | null
    plans: Array<Record<string, unknown> & { frameId: string; storey: string }>
  }
  const planFrames = graph.coordinateFrames.filter((f) => f.roles.projection === 'ORTHOGRAPHIC_PLAN' && f.roles.document === 'FLOOR_PLAN')
  const ground = planFrames
    .filter((f) => f.roles.storey === 'GROUND')
    .sort((a, b) => (b.roles.annotation === 'DIMENSIONED' ? 1 : 0) - (a.roles.annotation === 'DIMENSIONED' ? 1 : 0) || b.size.width * b.size.height - a.size.width * a.size.height || a.id.localeCompare(b.id))
  const frameId = arg('frame') ?? digest.selectedPlanFrameId ?? ground[0]?.id
  const frame = planFrames.find((f) => f.id === frameId)
  if (!frame) throw new Error(`no plan frame for ${house.id}`)
  const frameSelection = arg('frame') ? 'ARGUMENT' : digest.selectedPlanFrameId ? 'DIGEST_SELECTED_PLAN_FRAME' : 'READPLANS_ORDER_GROUND_DIMENSIONED_LARGEST'

  // --- the pixels -------------------------------------------------------------------------------------------------
  const variant = pkg.assets.flatMap((a) => a.variants).find((v) => v.byteHash === frame.variantByteHash)
  if (!variant) throw new Error('frame variant not in package')
  const got = await fileByteCache(house.cache).get(variant.url)
  if (!got) throw new Error(`offline cache has no bytes for ${variant.url}`)
  const bytes = got.bytes
  const byteSha = sha256(bytes)
  if (byteSha !== variant.byteHash) throw new Error(`byte hash mismatch ${byteSha} != ${variant.byteHash}`)
  const t0 = performance.now()
  const raster: Raster = decodeImage(bytes)
  const decodeMs = performance.now() - t0
  const gray = toGray(raster)
  let alphaBelow255 = 0
  for (let i = 3; i < raster.data.length; i += 4) if (raster.data[i] < 255) alphaBelow255 += 1
  const outFrames = join(work, 'frames', 'real')
  mkdirSync(outFrames, { recursive: true })
  const rgbPng = new PNG({ width: raster.width, height: raster.height })
  rgbPng.data = Buffer.from(raster.data)
  const rgbBytes = PNG.sync.write(rgbPng)
  const grayRgba = new Uint8Array(raster.width * raster.height * 4)
  for (let i = 0; i < gray.data.length; i += 1) {
    grayRgba[i * 4] = grayRgba[i * 4 + 1] = grayRgba[i * 4 + 2] = gray.data[i]
    grayRgba[i * 4 + 3] = 255
  }
  const grayPng = new PNG({ width: raster.width, height: raster.height })
  grayPng.data = Buffer.from(grayRgba)
  const grayBytes = PNG.sync.write(grayPng)
  const rgbFile = join(outFrames, `${house.id}.rgb.png`)
  const grayFile = join(outFrames, `${house.id}.gray.png`)
  writeFileSync(rgbFile, rgbBytes)
  writeFileSync(grayFile, grayBytes)

  // --- source-cv + boundary evidence on exactly these pixels (baseline.ts); the default reading's options ------------
  const chains = metrics.chains.filter((c) => c.frameId === frame.id)
  const registration = metrics.coordinateRegistrations.find((r) => r.frameId === frame.id && r.plane === 'PLAN_XZ')
  const res = baselineObservations({
    frameId: frame.id,
    raster,
    snapshotSha: readFileSync(join(process.cwd(), 'SNAPSHOT_SHA'), 'utf8').trim(),
    extentFromSheet: ({ bands, wallPx, witness }) => {
      const extent = planExtent(chains, bands, wallPx, witness as Parameters<typeof planExtent>[3], metrics.dimensionObservations?.filter((o) => o.frameId === frame.id))
      if (!extent || !registration) return null
      return { chains, registration, extent: extent.rect, info: { provenance: extent.provenance ?? null, weak: extent.weak }, options: { callouts: planCallouts(metrics, frame.id), sheetWallPx: wallPx, exteriorTicks: exteriorTicksOf(chains, extent.roles), extentSides: extentSidesOf(chains, extent, wallPx) } }
    },
  })
  const obs = res.observations
  // the production adaptive ink mask of these pixels, for the scorer's ink-support test (outside the repo)
  const inkPng = new PNG({ width: res.mask.width, height: res.mask.height })
  const ink4 = Buffer.alloc(res.mask.width * res.mask.height * 4)
  for (let i = 0; i < res.mask.data.length; i += 1) {
    ink4[i * 4] = ink4[i * 4 + 1] = ink4[i * 4 + 2] = res.mask.data[i] ? 255 : 0
    ink4[i * 4 + 3] = 255
  }
  inkPng.data = ink4
  writeFileSync(join(outFrames, `${house.id}.inkmask.png`), PNG.sync.write(inkPng))
  const wallPx = res.wallPx
  const boundary = res.boundary
  const msamPrompt = res.msamPrompt

  const frozen = digest.plans.find((p) => p.frameId === frame.id) ?? null
  const outObs = join(work, 'obs', 'source-cv', 'real')
  mkdirSync(outObs, { recursive: true })
  writeFileSync(join(outObs, `${house.id}.json`), JSON.stringify({ researchOnly: RESEARCH_ONLY, house: house.id, frameId: frame.id, observations: obs }))
  const meta = {
    researchOnly: RESEARCH_ONLY,
    house: house.id,
    purpose: house.purpose,
    frameId: frame.id,
    frameSelection,
    frameRoles: frame.roles,
    packageSha256: house.packageSha256,
    frozenRun: house.run,
    variant: { id: variant.id, url: variant.url, mediaType: variant.mediaType, byteSha256: byteSha, byteLength: bytes.length },
    decoded: { width: raster.width, height: raster.height, rgbaSha256: sha256(raster.data), grayLumaSha256: sha256(gray.data), alphaBelow255 },
    files: { rgbPng: rgbFile, rgbPngSha256: sha256(rgbBytes), grayPng: grayFile, grayPngSha256: sha256(grayBytes) },
    orientation: 'as decoded (no EXIF handling in the production decoder; no rotation)',
    crop: 'none: the frame is the whole decoded variant',
    resize: 'none at the frame; source-cv lines run on a box downscale to MAX_WORKING_EDGE and are mapped back',
    wallPx: r3(wallPx),
    boundary,
    msamPrompt,
    frozenDigest: frozen,
    timingsMs: { decode: r3(decodeMs), ...res.timingsMs },
    peakRssMB: Math.round(process.resourceUsage().maxRSS / 1024),
    counts: obs.reduce<Record<string, number>>((m, o) => ({ ...m, [o.configId]: (m[o.configId] ?? 0) + 1 }), {}),
  }
  writeFileSync(join(outFrames, `${house.id}.meta.json`), JSON.stringify(meta, null, 1))
  console.log(`${house.id}: ${frame.id} ${raster.width}x${raster.height} wallPx ${r3(wallPx)} obs ${JSON.stringify(meta.counts)} gaps ${JSON.stringify((boundary as { gaps?: unknown }).gaps ?? null)} frozen gaps ${JSON.stringify((frozen as { boundary?: { gaps?: unknown } } | null)?.boundary?.gaps ?? null)}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
