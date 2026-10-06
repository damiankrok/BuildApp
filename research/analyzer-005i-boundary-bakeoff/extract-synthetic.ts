/**
 * extract-synthetic.ts — RESEARCH ONLY (BUILDPLAN-ANALYZER-005I Track B). Run from the snapshot.
 *
 *   npx vite-node research/analyzer-005i-boundary-bakeoff/extract-synthetic.ts -- --corpus <dir> [--work /home/user/work005i]
 *
 * For every case of the synthetic corpus (synthetic/generate.py): decode its bytes (PNG, or JPEG for the compression
 * case) with the PRODUCTION decoder, write the decoded pixels as the frame every provider sees, and run BuildPlan
 * source-cv + the boundary evidence layer on them.
 *
 * The synthetic plans print dimension chains but this harness does not run the production chain reader (OCR + metric
 * solve) on them. The boundary layer therefore gets:
 *   - the EXTENT from the production plan-extent path itself — `planExtent([], bands, wallPx, witness)`, i.e. what the
 *     production code derives from the pixels when no chain is read (the wall witness / long-band box,
 *     WALL_GEOMETRY_EXTENT). Nothing about it comes from the truth. It also feeds the MobileSAM BOX / SOURCE prompts
 *     and the AUTO selection window, exactly as the production extent does on the real houses (council E6: an extent
 *     taken from the truth bbox would be a prompt taken from the answer);
 *   - an ORACLE SCALE (the generator's metres per pixel, registration confidence 1), labelled as such. It sets the
 *     boundary layer's metric thresholds (gap widths in metres), so it shapes the gap classes, the SCV-OUTLINE /
 *     SCV-BUILT comparators and the BUILT cells whose centres become the MSAM-SOURCE-PROMPTS positives; it never
 *     enters the BOX prompt, the AUTO selection or any line detector (post-review B7: the earlier wording "neither a
 *     prompt nor a selection" was too narrow).
 * No chain, callout, tick or extent side is given.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { decodeImage } from '@buildapp/source-package'
import { toGray } from '@buildapp/source-cv'
import { planExtent } from '@buildapp/reconstruction'
import { baselineObservations, r3, sha256 } from './baseline.js'
import { RESEARCH_ONLY } from './observation.js'

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main(): Promise<void> {
  const work = arg('work') ?? '/home/user/work005i'
  const corpusDir = arg('corpus') ?? join(work, 'synth')
  const only = arg('case')
  const corpus = JSON.parse(readFileSync(join(corpusDir, 'corpus.json'), 'utf8')) as { generatorSha256: string; cases: Array<{ id: string; file: string; sha256: string }> }
  const outFrames = join(work, 'frames', 'synthetic')
  const outObs = join(work, 'obs', 'source-cv', 'synthetic')
  mkdirSync(outFrames, { recursive: true })
  mkdirSync(outObs, { recursive: true })
  const snapshotSha = readFileSync(join(process.cwd(), 'SNAPSHOT_SHA'), 'utf8').trim()
  for (const c of corpus.cases) {
    if (only && c.id !== only) continue
    const bytes = readFileSync(join(corpusDir, c.file))
    if (sha256(bytes) !== c.sha256) throw new Error(`corpus hash mismatch ${c.id}`)
    const truth = JSON.parse(readFileSync(join(corpusDir, `${c.id}.truth.json`), 'utf8')) as { metresPerPx: number }
    const raster = decodeImage(new Uint8Array(bytes))
    const gray = toGray(raster)
    const frameId = `synthetic-${c.id}`
    const rgbPng = new PNG({ width: raster.width, height: raster.height })
    rgbPng.data = Buffer.from(raster.data)
    const rgbBytes = PNG.sync.write(rgbPng)
    const g4 = new Uint8Array(raster.width * raster.height * 4)
    for (let i = 0; i < gray.data.length; i += 1) {
      g4[i * 4] = g4[i * 4 + 1] = g4[i * 4 + 2] = gray.data[i]
      g4[i * 4 + 3] = 255
    }
    const grayPng = new PNG({ width: raster.width, height: raster.height })
    grayPng.data = Buffer.from(g4)
    const grayBytes = PNG.sync.write(grayPng)
    writeFileSync(join(outFrames, `${c.id}.rgb.png`), rgbBytes)
    writeFileSync(join(outFrames, `${c.id}.gray.png`), grayBytes)
    const mpp = truth.metresPerPx
    let extentUsed: { x0: number; y0: number; x1: number; y1: number } | null = null
    let extentWhy: unknown = null
    const registration = {
      id: `registration-oracle-${c.id}`,
      frameId,
      assetId: `asset-${c.id}`,
      variantByteHash: c.sha256,
      plane: 'PLAN_XZ',
      metresPerPixelX: mpp,
      metresPerPixelY: mpp,
      anisotropy: 1,
      originPx: { x: 0, y: 0 },
      flipX: false,
      flipY: true,
      anchors: [],
      rejected: [],
      residual: { rmsM: 0, maxM: 0, rmsPx: 0 },
      confidence: 1,
      provenance: { extractor: 'REGISTRATION', name: 'research-oracle', detail: 'BUILDPLAN-ANALYZER-005I synthetic: the generator scale, given' },
    }
    const t0 = performance.now()
    const res = baselineObservations({
      frameId,
      raster,
      snapshotSha,
      extentFromSheet: ({ bands, wallPx, witness }) => {
        const e = planExtent([], bands, wallPx, witness as Parameters<typeof planExtent>[3], [])
        if (!e) return null
        extentUsed = e.rect
        extentWhy = { provenance: e.provenance ?? null, weak: e.weak, why: e.why }
        return { chains: [], registration: registration as never, extent: e.rect, info: { provenance: e.provenance ?? 'PRODUCTION_PLAN_EXTENT_NO_CHAINS', weak: e.weak }, options: { callouts: [], sheetWallPx: wallPx } }
      },
    })
    const totalMs = performance.now() - t0
    // the production adaptive ink mask of these pixels, for the scorer's ink-support test (outside the repo)
    const inkPng = new PNG({ width: res.mask.width, height: res.mask.height })
    const ink4 = Buffer.alloc(res.mask.width * res.mask.height * 4)
    for (let i = 0; i < res.mask.data.length; i += 1) {
      ink4[i * 4] = ink4[i * 4 + 1] = ink4[i * 4 + 2] = res.mask.data[i] ? 255 : 0
      ink4[i * 4 + 3] = 255
    }
    inkPng.data = ink4
    writeFileSync(join(outFrames, `${c.id}.inkmask.png`), PNG.sync.write(inkPng))
    writeFileSync(join(outObs, `${c.id}.json`), JSON.stringify({ researchOnly: RESEARCH_ONLY, case: c.id, frameId, observations: res.observations }))
    const meta = {
      researchOnly: RESEARCH_ONLY,
      case: c.id,
      frameId,
      generatorSha256: corpus.generatorSha256,
      sourceBytes: { file: c.file, sha256: c.sha256, byteLength: bytes.length },
      decoded: { width: raster.width, height: raster.height, rgbaSha256: sha256(raster.data), grayLumaSha256: sha256(gray.data) },
      files: { rgbPngSha256: sha256(rgbBytes), grayPngSha256: sha256(grayBytes) },
      orientation: 'as decoded',
      crop: 'none at extraction (the partial-crop case is cropped by the generator)',
      resize: 'none at the frame',
      oracle: { scaleMetresPerPx: mpp, why: 'ORACLE SCALE (generator metres per pixel): the metric layer is not under test. It sets the boundary layer metric thresholds, so it shapes the gap classes, the SCV-OUTLINE / SCV-BUILT comparators and the BUILT cells whose centres are the MSAM-SOURCE-PROMPTS positives; it never enters the BOX prompt, the AUTO selection or any line detector' },
      extent: extentUsed ? { rect: extentUsed, source: 'production planExtent with no chains (wall witness); no truth', detail: extentWhy } : { rect: null, source: 'production planExtent returned null: no boundary layer, no MobileSAM prompt' },
      wallPx: r3(res.wallPx),
      boundary: res.boundary,
      msamPrompt: res.msamPrompt,
      timingsMs: { ...res.timingsMs, total: r3(totalMs) },
      counts: res.observations.reduce<Record<string, number>>((m, o) => ({ ...m, [o.configId]: (m[o.configId] ?? 0) + 1 }), {}),
    }
    writeFileSync(join(outFrames, `${c.id}.meta.json`), JSON.stringify(meta, null, 1))
    console.log(`${c.id}: ${raster.width}x${raster.height} wallPx ${r3(res.wallPx)} ${JSON.stringify(meta.counts)} gaps ${JSON.stringify((res.boundary as { gaps?: unknown }).gaps ?? null)}`)
  }
  console.log(`peakRssMB ${Math.round(process.resourceUsage().maxRSS / 1024)}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
